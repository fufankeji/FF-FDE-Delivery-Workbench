import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { createUserMessage } from '@deepseek-ai/dsh-llm';

export const textContent = message => (message?.content ?? []).filter(x => x.type === 'text').map(x => x.text).join('\n');

/** DSH owns every message. This adapter only projects its durable session events. */
export class NativeSessions {
  constructor(ctx, {cwd, onEvent = () => {}, onStream = () => {}}) {
    this.ctx = ctx; this.cwd = cwd; this.handles = new Map(); this.pending = new Map(); this.helperOwners = new Map(); this.closing = new Set();
    mkdirSync(cwd, {recursive:true});
    ctx.on('session/event', (session, event) => {
      if (this.handles.has(session.id)) onEvent(session.id, event);
    });
    ctx.on('agent/assistant-stream', ({agent, frame}) => {
      if (this.handles.has(agent.id)) onStream(agent.id, frame);
    });
  }
  async open({sessionId, resume = false, prompt, tools = [], maxTokens = 4096}) {
    if(this.closed || this.closing.has(sessionId))throw new Error('SESSION_CLOSED');
    if (this.handles.has(sessionId)) return this.handles.get(sessionId).agent;
    if (this.pending.has(sessionId)) return this.pending.get(sessionId);
    const operation = (async () => {
      const allowed = new Set(tools.map(t => t.name));
      const setup = scope => {
        scope.tools.presentAs('native');
        scope.tools.restrict({allow: []});
        scope.tools.guard(exec => allowed.has(exec.name) ? undefined : '该人物只能使用被授权的业务工具。');
        for (const tool of tools) scope.tools.register(tool);
        scope.systemPrompt.section({name:'fde:persona', order:0, complete:true, text:prompt});
        // Preserve the native tool protocol, remove unrelated coding/workspace context.
        scope.on('system-prompt/assemble', async (_assembly, _context, next) => {
          const value = await next();
          return {...value, contexts: []};
        }, {prepend:true});
        // Native instruction/skill providers are shared by the ordinary DSH workspace.
        // Their synthetic user messages must never enter an interview or report session.
        scope.on('agent/pre-step', async (_payload, next) => {
          const value = await next();
          if (value.kind === 'reject') return value;
          return {...value, messages:value.messages.filter(m => m.source?.kind === 'user' || (m.source?.kind === 'plugin' && m.source.plugin === 'fde-discovery-lab'))};
        }, {prepend:true});
      };
      const options = {setup, agentOptions:{provider:process.env.DEEPSEEK_PROVIDER || 'deepseek-official', model:process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash', maxTokens}};
      // This host lazily materializes JSONL: selecting an idle role alone
      // leaves no artifact. Corrupt artifacts still throw; only absence is new.
      resume=(await this.ctx.sessionPersistence.stat(sessionId))!==undefined;
      let handle, resumed=resume;
      try {
        handle=resume
          ? await this.ctx.agents.resume({...options,resumeSessionId:sessionId})
          : await this.ctx.agents.create({...options,sessionId,meta:{cwd:this.cwd}});
      } catch(error) {
        // Native persistence may have committed before SQLite's opened flag.
        // Recover only this exact identity collision, never hide other failures.
        if(resume || error.name!=='SessionAlreadyExistsError' || error.sessionId!==sessionId)throw error;
        handle=await this.ctx.agents.resume({...options,resumeSessionId:sessionId});resumed=true;
      }
      if(this.closed || this.closing.has(sessionId)){await handle.dispose();throw new Error('SESSION_CLOSED');}
      if(resumed && (handle.agent.inbox.nextTurn.length || handle.agent.inbox.nextStep.length)) {
        // DSH resumes idle with durable queued input still parked. Training
        // recovery marks unfinished requests retryable; they must not run again
        // implicitly when the learner submits a new question.
        handle.agent.inbox.clear();
        try { await this.ctx.sessions.flush(handle.agent.session); }
        catch(error){await handle.dispose();throw error;}
      }
      if(this.closed || this.closing.has(sessionId)){await handle.dispose();throw new Error('SESSION_CLOSED');}
      this.handles.set(sessionId, handle);
      return handle.agent;
    })();
    this.pending.set(sessionId, operation);
    try { return await operation; } finally { this.pending.delete(sessionId); }
  }
  async events(sessionId) {
    const handle = this.handles.get(sessionId);
    if (!handle) throw new Error('SESSION_NOT_OPEN');
    await this.ctx.sessions.flush(handle.agent.session);
    const reader = await this.ctx.sessionPersistence.open(sessionId, 'read');
    try { return (await reader.read()).events; } finally { await reader.close(); }
  }
  async messages(sessionId) {
    return (await this.events(sessionId)).flatMap(e => {
      if (e.type === 'user/message' && e.data.source?.kind === 'user') return [{id:e.data.id,seq:e.seq,role:'user',text:textContent(e.data),createdAt:e.time}];
      if (e.type === 'assistant/message') {
        const text = textContent(e.data.message);
        return text ? [{id:e.data.message.id,seq:e.seq,role:'assistant',text,createdAt:e.time,interrupted:!!e.data.interrupted}] : [];
      }
      return [];
    });
  }
  send(sessionId, text, beforeSend = () => {}) {
    const agent = this.handles.get(sessionId)?.agent;
    if (!agent) throw new Error('SESSION_NOT_OPEN');
    if (agent.status !== 'idle') throw new Error('ROLE_BUSY');
    const message = createUserMessage({content:[{type:'text',text}],source:{kind:'user'}});
    const fromSeq = agent.session.seq;
    beforeSend({messageId:message.id,fromSeq});
    agent.followup(message);
    return {messageId:message.id,fromSeq,completion:this.settle(agent, message.id, fromSeq)};
  }
  async settle(agent, messageId, fromSeq) {
    await agent.whenIdle();
    await this.ctx.sessions.flush(agent.session);
    const events = (await this.events(agent.id)).filter(event => event.seq >= fromSeq);
    const consumed = events.find(e => e.type === 'user/message' && e.data.id === messageId);
    if (!consumed) {
      // send starts idle with one active request. Preparation can fail in its
      // first turn before user/message; older turns are excluded by fromSeq.
      const started = events.find(e => e.type === 'turn/start');
      const ended = started && events.find(e => e.type === 'turn/end' && e.data.turn === started.data.turn);
      if (ended?.data.reason?.kind === 'error') return {status:'failed',messageId,events,reason:ended.data.reason};
      return {status:'canceled',messageId,events:[]};
    }
    // One active request per owned session: identify its consumed turn first.
    const turnStart = events.filter(e => e.type === 'turn/start' && e.seq < consumed.seq).at(-1);
    const replies = events.filter(e => e.type === 'assistant/message' && e.data.turn === turnStart?.data.turn && !e.data.interrupted);
    const end = events.find(e => e.type === 'turn/end' && e.data.turn === turnStart?.data.turn);
    const text = replies.map(e => textContent(e.data.message)).filter(Boolean).join('\n\n');
    return {status:text && end?.data.reason?.kind==='completed' ? 'completed' : 'failed',messageId,events,replies,text,reason:end?.data.reason};
  }
  stop(sessionId) { this.handles.get(sessionId)?.agent.cancel(); }
  async shutdown() {
    this.closed = true;
    await Promise.allSettled(this.pending.values());
    await Promise.allSettled([...this.handles.keys()].map(id => this.dispose(id)));
  }
  async dispose(sessionId) {
    this.closing.add(sessionId);
    if(this.pending.has(sessionId))await this.pending.get(sessionId).catch(()=>{});
    const handle = this.handles.get(sessionId);
    if (handle) { await handle.dispose(); this.handles.delete(sessionId); }
  }
  async cancelHelpers(owner) {
    await Promise.allSettled([...this.helperOwners].filter(([,value])=>value===owner).map(([id])=>this.dispose(id)));
  }
  async generate(prompt, input, {owner,maxTokens=4096}={}) {
    const sessionId = `fde-helper-${randomUUID()}`;
    this.helperOwners.set(sessionId,owner);
    try {
      await this.open({sessionId,prompt,maxTokens});
      const result = await this.send(sessionId, input).completion;
      if (result.status !== 'completed') throw new Error(result.reason?.error?.message || '模型任务未生成完整内容，请重试。');
      return {sessionId,text:result.text};
    } finally { await this.dispose(sessionId); this.helperOwners.delete(sessionId); }
  }
}

export function businessTool(name, description, properties, required, execute) {
  return {name,description,parameters:{type:'object',properties,required,additionalProperties:false},
    output:{schema:{type:'object',additionalProperties:true},render:(_args,value)=>[{type:'text',text:JSON.stringify(value)}]},
    execute:async (args, execution) => {execution.signal.throwIfAborted(); return execute(args, execution);}};
}
