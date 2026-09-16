import { readFileSync } from 'node:fs';
import { Store, uid, now } from './store.js';
import { loadCases, publicCase, newerVersion, rolePrompt, safeAsset } from './cases.js';
import { NativeSessions, businessTool, textContent } from './native-sessions.js';
import { completionCount, evaluateRole } from './evaluation.js';
import { generateReport, exportReport } from './reports.js';

export class TrainingService {
  constructor(ctx,{root,dataDir}) {
    this.disposed=false;this.reportTasks=new Set();
    this.root=root;this.dataDir=dataDir;this.store=new Store(`${dataDir}/training.sqlite`);
    this.cases=loadCases(root);this.streams=new Map();this.active=new Map();this.evaluations=new Set();this.preparing=new Map();this.evaluationChain=Promise.resolve();this.evaluationDirty=new Set();
    for(const c of this.cases.values())this.store.exec('INSERT OR IGNORE INTO cases VALUES(?,?,?)',c.id,c.version,JSON.stringify(c));
    // Helper work belongs to this process. A durable pending flag cannot mean
    // a live job after a host restart, and must not permanently disable retry.
    this.store.transaction(()=>{
      this.store.exec("UPDATE role_sessions SET eval_status='error',eval_error=? WHERE eval_status='pending'",'宿主重启使上次核对中断；对话和资料已保留，可重新核对。');
      this.store.exec("UPDATE reports SET status='error',error=? WHERE status='generating'",'宿主重启使报告生成中断；已有报告版本和证据保留，可重新生成。');
      for(const run of this.store.all("SELECT id FROM runs WHERE status='reporting'")){
        const previous=this.store.get("SELECT id FROM reports WHERE run_id=? AND status='completed'",run.id);
        this.store.exec('UPDATE runs SET status=? WHERE id=?',previous?'passed':'ready',run.id);
      }
    });
    this.native=new NativeSessions(ctx,{cwd:`${dataDir}/workspaces`,onStream:(id,frame)=>{
      if(frame.type==='chunk' && frame.chunk.type==='text-delta')this.streams.set(id,(this.streams.get(id)||'')+frame.chunk.text);
    }});
    ctx.on('dispose',()=>this.dispose());
  }
  async dispose() {
    if(this.disposed)return;
    this.disposed=true;
    await this.native.shutdown();
    await Promise.allSettled([...this.active.values(),...this.preparing.values(),this.evaluationChain,...this.reportTasks]);
    this.store.close();
  }
  caseFor(run) {const row=this.store.get('SELECT definition FROM cases WHERE id=? AND version=?',run.case_id,run.version);if(!row)throw new Error('案例版本不存在');return JSON.parse(row.definition);}
  requireLive(id){const run=this.store.run(id);if(run.status==='archived')throw Object.assign(new Error('此轮已归档，请进入当前训练。'),{status:409});return run;}
  role(c,id){const role=c.roles.find(r=>r.id===id);if(!role)throw Object.assign(new Error('人物不存在'),{status:404});return role;}
  caseView(c,runId){const latest=this.cases.get(c.id);return {...publicCase(c,runId),latestVersion:latest?.version||c.version,upgradeAvailable:!!runId&&newerVersion(latest?.version||c.version,c.version)};}
  list(){return [...this.cases.values()].map(c=>{
    const run=this.store.get("SELECT * FROM runs WHERE case_id=? AND status!='archived'",c.id);
    const definition=run?this.caseFor(run):c;
    return {...this.caseView(definition,run?.id),...(run?{runStatus:run.status,progress:completionCount(definition.discoveries,this.store.all('SELECT * FROM discovery WHERE run_id=?',run.id))}:{})};
  });}
  history(caseId){
    if(!this.cases.has(caseId))throw Object.assign(new Error('案例不存在'),{status:404});
    return this.store.all('SELECT * FROM runs WHERE case_id=? ORDER BY generation DESC LIMIT 30',caseId).map(run=>({
      runId:run.id,version:run.version,status:run.status,createdAt:run.created_at,
      progress:completionCount(this.caseFor(run).discoveries,this.store.all('SELECT * FROM discovery WHERE run_id=?',run.id)),
      reports:this.store.all('SELECT id,version,status,created_at FROM reports WHERE run_id=? ORDER BY version DESC',run.id).map(r=>({id:r.id,version:r.version,status:r.status,createdAt:r.created_at}))
    }));
  }
  async upgrade(runId){
    const previous=this.store.get('SELECT new_run_id FROM run_upgrades WHERE old_run_id=?',runId);
    if(previous)return this.snapshot(previous.new_run_id);
    const run=this.requireLive(runId),latest=this.cases.get(run.case_id);
    if(!latest||!newerVersion(latest.version,run.version))throw Object.assign(new Error('本轮已使用当前案例版本。'),{status:409});
    const busy=this.store.get("SELECT id FROM requests WHERE run_id=? AND status IN ('accepted','running')",runId)
      ||this.store.get("SELECT role_id FROM role_sessions WHERE run_id=? AND eval_status='pending'",runId)
      ||this.store.get("SELECT id FROM reports WHERE run_id=? AND status='generating'",runId);
    if(busy)throw Object.assign(new Error('请等待本轮回答、核对或报告完成后，再开启深化调查。'),{status:409});
    const id=uid('run'),generation=this.store.get('SELECT MAX(generation) AS value FROM runs WHERE case_id=?',run.case_id).value+1;
    this.store.transaction(()=>{
      this.store.exec("UPDATE runs SET status='archived',updated_at=? WHERE id=?",now(),runId);
      this.store.exec('INSERT INTO runs VALUES(?,?,?,?,?,?,?)',id,run.case_id,latest.version,generation,'investigating',now(),now());
      this.store.exec('INSERT INTO run_upgrades VALUES(?,?)',runId,id);
    });
    await Promise.allSettled(this.store.all('SELECT session_id FROM role_sessions WHERE run_id=?',runId).map(row=>this.native.dispose(row.session_id)));
    return this.snapshot(id);
  }
  async start(caseId){
    const c=this.cases.get(caseId);if(!c)throw Object.assign(new Error('案例不存在'),{status:404});
    let run=this.store.get("SELECT * FROM runs WHERE case_id=? AND status!='archived'",caseId);
    if(!run){const id=uid('run');const generation=(this.store.get('SELECT MAX(generation) AS generation FROM runs WHERE case_id=?',caseId)?.generation||0)+1;this.store.exec('INSERT INTO runs VALUES(?,?,?,?,?,?,?)',id,caseId,c.version,generation,'investigating',now(),now());run=this.store.run(id);}
    return this.snapshot(run.id);
  }
  async ensureRole(runId,roleId){
    const key=`${runId}/${roleId}`;if(this.preparing.has(key))return this.preparing.get(key);
    const task=(async()=>{
      const run=this.requireLive(runId),c=this.caseFor(run),role=this.role(c,roleId);
      let row=this.store.get('SELECT * FROM role_sessions WHERE run_id=? AND role_id=?',runId,roleId);
      if(!row){this.store.exec('INSERT INTO role_sessions(run_id,role_id,session_id) VALUES(?,?,?)',runId,roleId,uid('fde-role'));row=this.store.get('SELECT * FROM role_sessions WHERE run_id=? AND role_id=?',runId,roleId);}
      await this.native.open({sessionId:row.session_id,resume:!!row.opened,prompt:rolePrompt(c,role),tools:this.roleTools(run,c,role)});
      if(!this.store.live(runId,run.generation)){await this.native.dispose(row.session_id);throw Object.assign(new Error('训练轮次已更新，请进入新一轮。'),{status:409});}
      this.store.exec('UPDATE role_sessions SET opened=1 WHERE run_id=? AND role_id=?',runId,roleId);
      await this.recover(run,row);
      return row;
    })();
    this.preparing.set(key,task);try{return await task;}finally{this.preparing.delete(key);}
  }
  roleTools(run,c,role){return [
    businessTool('lookupRoleFacts','查询本人业务事实。query使用当前提问的具体主题，最多返回4项相关事实。',{query:{type:'string'}},['query'],({query})=>{
      if(!this.store.live(run.id,run.generation))throw new Error('RUN_ARCHIVED');
      const q=String(query).slice(0,500);const grams=new Set([...q].map((_,i)=>q.slice(i,i+2)).filter(x=>x.length===2));
      const facts=c.facts.filter(f=>role.factIds.includes(f.id)&&f.roleIds.includes(role.id));
      const ranked=facts.map(f=>({f,score:[...grams].filter(g=>(f.topic+' '+f.text).includes(g)).length})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,4);
      return {facts:ranked.map(({f})=>({id:f.id,topic:f.topic,text:f.text,kind:f.kind,sources:f.sources.map(s=>({assetId:s.assetId,locator:s.locator,quote:s.quote}))})),unknowns:role.unknowns,
        availableAssets:c.assets.filter(a=>role.assetIds.includes(a.id)&&a.roleIds.includes(role.id)).map(a=>({assetId:a.id,title:a.title,...(a.releaseGate?{releaseCondition:'需先取得并查看原始样本，再询问分类复核依据。'}:{})})),
        assetScope:'facts.sources只是本次查询事实引用，不是完整资料目录。availableAssets才是本人可提供目录；用户明确索取其中资料时调用offerCaseAsset，署名转交不代表本人亲历。目录可见不等于本轮已取得，仍须工具成功发放。'};
    }),
    businessTool('offerCaseAsset','用户明确索取资料时提供本人目录中的一份原件；不能发未授权资料。',{assetId:{type:'string'}},['assetId'],async ({assetId})=>{
      if(!this.store.live(run.id,run.generation))throw new Error('RUN_ARCHIVED');
      const mapping=this.store.get('SELECT session_id FROM role_sessions WHERE run_id=? AND role_id=?',run.id,role.id);
      const history=mapping?await this.native.events(mapping.session_id):[];
      const question=history.filter(e=>e.type==='user/message'&&e.data.source?.kind==='user').at(-1);
      const asked=textContent(question?.data);
      const previousAnswer=history.filter(e=>e.type==='assistant/message'&&e.seq<question?.seq).at(-1);
      const acceptsOffer=/^(?:好|可以|那就|请|麻烦|需要|行|要|发|给)/u.test(asked.trim())&&/(?:提供|发给|给你|查看).*(?:资料|原件|文件|台账|记录|单据|票据|数据|明细|清单|手册)/u.test(textContent(previousAnswer?.data.message));
      const namedAsset=c.assets.some(a=>role.assetIds.includes(a.id)&&asked.includes(a.title));
      const explicitRequest=(namedAsset||/(?:原件|附件|材料|资料|文件|台账|单据|票据|数据|表|清单|记录|明细|制度|样例|手册|作业卡|工单|日志|截图|索引|凭证|佐证)/u.test(asked))&&/(?:给|提供|发|看|拿|下载|查阅|出示|调取|索取|导出|贴)/u.test(asked);
      if(!explicitRequest&&!acceptsOffer)throw new Error('用户尚未明确索取资料；请先说明可以提供什么，等待其选择。');
      const asset=c.assets.find(a=>a.id===assetId);
      if(!asset || !role.assetIds.includes(assetId) || !asset.roleIds.includes(role.id))throw new Error('ASSET_FORBIDDEN');
      this.checkReleaseGate(run.id,asset,asked);
      safeAsset(this.root,asset);
      return {assetId:asset.id,title:asset.title,version:asset.version};
    }),
  ];}
  checkReleaseGate(runId,asset,question){
    const gate=asset.releaseGate;if(!gate)return;
    const viewed=(gate.viewedAssetIds||[]).every(id=>this.store.get('SELECT 1 FROM grants WHERE run_id=? AND asset_id=?',runId,id)&&this.store.get('SELECT 1 FROM asset_views WHERE run_id=? AND asset_id=?',runId,id));
    const asked=Array.isArray(gate.questionTerms)&&gate.questionTerms.some(term=>String(question).includes(term));
    if(!viewed||!asked)throw Object.assign(new Error('请先查看本轮已取得的原始样本，再向本岗位询问分类或复核依据。'),{status:403});
  }
  markViewed(runId,assetId){this.store.exec('INSERT OR IGNORE INTO asset_views VALUES(?,?,?)',runId,assetId,now());}
  async recover(run,row){
    if(!this.store.live(run.id,run.generation))return;
    const requests=this.store.all("SELECT * FROM requests WHERE run_id=? AND role_id=? AND status IN ('accepted','running')",run.id,row.role_id);
    if(!requests.length || this.active.has(`${run.id}/${row.role_id}`))return;
    const events=await this.native.events(row.session_id);
    for(const request of requests){
      const user=events.find(e=>e.type==='user/message'&&e.data.id===request.message_id);
      const start=user&&events.filter(e=>e.type==='turn/start'&&e.seq<user.seq).at(-1);
      const replies=start?events.filter(e=>e.type==='assistant/message'&&e.data.turn===start.data.turn&&!e.data.interrupted):[];
      const ended=start&&events.find(e=>e.type==='turn/end'&&e.data.turn===start.data.turn);
      const successful=ended?.data.reason?.kind==='completed'&&replies.some(e=>textContent(e.data.message));
      if(user)await this.commitEvidence(run,row,events.filter(e=>e.seq>user.seq),{includeInterview:!!successful});
      if(successful){this.store.exec("UPDATE requests SET status='completed',error=NULL WHERE run_id=? AND id=?",run.id,request.id);this.queueEvaluation(run.id,row.role_id);}
      else this.store.exec("UPDATE requests SET status='failed',error=? WHERE run_id=? AND id=?",'会话中断，已核对原生记录。可继续提问，已取得资料保留。',run.id,request.id);
    }
  }
  async send(runId,roleId,requestId,text){
    if(typeof requestId!=='string'||requestId.length>100||!requestId)throw new Error('请求编号无效');
    const prior=this.store.get('SELECT * FROM requests WHERE run_id=? AND id=?',runId,requestId);
    if(prior){if(prior.role_id!==roleId)throw Object.assign(new Error('请求编号已用于另一人物'),{status:409});return this.receipt(runId,requestId);}
    if(typeof text!=='string'||!text.trim()||text.length>8000)throw new Error('请输入1至8000字的问题');
    const run=this.requireLive(runId),row=await this.ensureRole(runId,roleId),key=`${runId}/${roleId}`;
    if(!this.store.live(runId,run.generation))throw Object.assign(new Error('训练轮次已更新。'),{status:409});
    if(this.store.get('SELECT id FROM requests WHERE run_id=? AND id=?',runId,requestId))return this.receipt(runId,requestId);
    if(this.active.size>=Number(process.env.FDE_MAX_INTERVIEWS||3))throw Object.assign(new Error('当前已有多个岗位正在回答，请稍候再发送，草稿已保留。'),{status:429});
    if(this.active.has(key)||this.store.get("SELECT id FROM requests WHERE run_id=? AND role_id=? AND status IN ('accepted','running')",runId,roleId))throw Object.assign(new Error('此人物正在回答，草稿已保留。'),{status:409});
    this.streams.set(row.session_id,'');
    const {completion}=this.native.send(row.session_id,text,({messageId})=>this.store.exec('INSERT INTO requests VALUES(?,?,?,?,?,?,?)',runId,requestId,roleId,messageId,'accepted',null,now()));
    this.store.exec("UPDATE requests SET status='running' WHERE run_id=? AND id=?",runId,requestId);
    const tracked=completion.then(async result=>{
      if(!this.store.live(runId,run.generation))return;
      await this.commitEvidence(run,row,result.events,{includeInterview:result.status==='completed'});
      const error=result.status==='completed'?null:result.reason?.error?.message || '回答已停止或未能完成，可继续提问。';
      this.store.exec('UPDATE requests SET status=?,error=? WHERE run_id=? AND id=?',result.status==='completed'?'completed':'failed',error,runId,requestId);
      if(result.status==='completed')this.queueEvaluation(runId,roleId);
    }).catch(error=>{if(this.store.live(runId,run.generation))this.store.exec("UPDATE requests SET status='failed',error=? WHERE run_id=? AND id=?",error.message,runId,requestId);})
      .finally(()=>{this.active.delete(key);this.streams.delete(row.session_id);this.store.touch(runId);});
    this.active.set(key,tracked);
    return {requestId,status:'accepted'};
  }
  async commitEvidence(run,row,events,{includeInterview=true}={}){
    if(!this.store.live(run.id,run.generation))return;
    const c=this.caseFor(run),role=this.role(c,row.role_id),all=await this.native.events(row.session_id);
    for(const event of events){
      if(includeInterview && event.type==='assistant/message' && !event.data.interrupted){
        const text=textContent(event.data.message);if(!text)continue;
        this.store.exec('INSERT OR IGNORE INTO evidence VALUES(?,?,?,?,?,?,?,?,?,?)',uid('ev'),run.id,row.role_id,row.session_id,event.seq,event.data.message.id,null,'interview',text,now());
      }
      if(event.type==='tool/result')for(const block of event.data.message.content??[]){
        if(block.type!=='tool-result'||block.isError)continue;
        const call=all.find(e=>e.type==='tool/call'&&e.data.callId===block.toolCallId&&e.data.name==='offerCaseAsset');if(!call)continue;
        let value;try{value=JSON.parse(textContent(block));}catch{continue;}
        const asset=c.assets.find(a=>a.id===value.assetId);if(!asset||!role.assetIds.includes(asset.id)||!asset.roleIds.includes(role.id))continue;
        safeAsset(this.root,asset);
        const changed=this.store.exec('INSERT OR IGNORE INTO grants VALUES(?,?,?,?,?,?,?,0)',run.id,asset.id,row.role_id,row.session_id,event.seq,event.data.message.id,now()).changes;
        if(changed)this.store.exec('INSERT OR IGNORE INTO evidence VALUES(?,?,?,?,?,?,?,?,?,?)',uid('ev'),run.id,row.role_id,row.session_id,event.seq,event.data.message.id,asset.id,'asset',`已授权取得原件：${asset.title}；版本：${asset.version}`,now());
      }
    }
  }
  receipt(runId,id){this.requireLive(runId);const row=this.store.get('SELECT * FROM requests WHERE run_id=? AND id=?',runId,id);return row?{requestId:id,status:row.status,error:row.error}:{requestId:id,status:'not_found'};}
  queueEvaluation(runId,roleId){
    if(this.disposed)return;
    const key=`${runId}/${roleId}`;if(this.evaluations.has(key)){this.evaluationDirty.add(key);return;}
    this.evaluations.add(key);
    this.store.exec("UPDATE role_sessions SET eval_status='pending' WHERE run_id=? AND role_id=?",runId,roleId);
    this.evaluationChain=this.evaluationChain.catch(()=>{}).then(async()=>{
      while(this.active.has(key)&&this.store.live(runId))await new Promise(resolve=>setTimeout(resolve,250));
      if(!this.disposed&&this.store.live(runId))await evaluateRole(this,runId,roleId);
    }).finally(()=>{this.evaluations.delete(key);if(this.evaluationDirty.delete(key)&&this.store.live(runId))this.queueEvaluation(runId,roleId);});
  }
  updateReadiness(runId){const run=this.requireLive(runId),c=this.caseFor(run);const p=completionCount(c.discoveries,this.store.all('SELECT * FROM discovery WHERE run_id=?',runId));if(p.completed===p.total&&p.total&&run.status==='investigating')this.store.exec("UPDATE runs SET status='ready',updated_at=? WHERE id=?",now(),runId);}
  grant(runId,assetId,{allowArchived=false}={}){const run=allowArchived?this.store.run(runId):this.requireLive(runId),c=this.caseFor(run);const grant=this.store.get('SELECT * FROM grants WHERE run_id=? AND asset_id=?',runId,assetId);const asset=c.assets.find(a=>a.id===assetId);if(!grant||!asset||!asset.roleIds.includes(grant.role_id))throw Object.assign(new Error('尚未取得该资料，请先向有权提供的岗位索取。'),{status:403});return {asset,grant,path:safeAsset(this.root,asset)};}
  async snapshot(runId){
    const run=this.requireLive(runId),c=this.caseFor(run);
    const rows=this.store.all('SELECT * FROM role_sessions WHERE run_id=?',runId);
    for(const row of rows)await this.ensureRole(runId,row.role_id);
    const grants=this.store.all('SELECT * FROM grants WHERE run_id=?',runId);
    const evidence=this.store.all('SELECT * FROM evidence WHERE run_id=? ORDER BY created_at,id',runId);
    const results=this.store.all('SELECT * FROM discovery WHERE run_id=?',runId);
    const sessions=await Promise.all(c.roles.map(async role=>{
      const row=this.store.get('SELECT * FROM role_sessions WHERE run_id=? AND role_id=?',runId,role.id);
      const active=this.store.get("SELECT * FROM requests WHERE run_id=? AND role_id=? ORDER BY created_at DESC LIMIT 1",runId,role.id);
      const busy=active&&['accepted','running'].includes(active.status);
      const messages=row?await this.native.messages(row.session_id):[];
      return {roleId:role.id,sessionId:row?.session_id,status:busy?'running':active?.status==='failed'?'error':'idle',messages:row?messages.map(m=>({...m,createdAt:new Date(m.createdAt).toISOString(),assetIds:grants.filter(g=>g.role_id===role.id&&g.seq<m.seq&&m.role==='assistant'&&!messages.some(other=>other.role==='assistant'&&other.seq>g.seq&&other.seq<m.seq)).map(g=>g.asset_id),evidenceIds:evidence.filter(e=>e.message_id===m.id).map(e=>e.id)})):[],streamingText:row?this.streams.get(row.session_id):undefined,activeRequestId:busy?active.id:undefined,error:active?.error,evaluationStatus:row?.eval_status||'idle',evaluationError:row?.eval_error};
    }));
    const acquiredIds=new Set(grants.map(g=>g.asset_id));
    const discovery=c.discoveries.map(item=>{const row=results.find(r=>r.item_id===item.id);const title=id=>c.assets.find(a=>a.id===id)?.title||id;return {id:item.id,roleId:item.roleId,topic:item.title,status:row?.status||'untouched',required:item.required,requiredAssetTitles:(item.requiredAssetIds||[]).map(title),missingAssetTitles:(item.requiredAssetIds||[]).filter(id=>!acquiredIds.has(id)).map(title),evidenceRefs:JSON.parse(row?.evidence_refs||'[]'),explanation:row?.status==='needs_deeper'?`“${item.title}”还需要更明确的访谈或原件依据，可使用提问提示继续核实。`:row?.explanation};});
    const displayedAssetMessage=(roleId,seq)=>sessions.find(s=>s.roleId===roleId)?.messages.find(m=>m.role==='assistant'&&m.seq>seq)?.id;
    return {runId,caseId:c.id,generation:run.generation,status:run.status,case:this.caseView(c,runId),sessions,discovery,evidence:evidence.map(e=>({id:e.id,roleId:e.role_id,messageId:e.kind==='asset'?displayedAssetMessage(e.role_id,e.seq):e.message_id,assetId:e.asset_id,text:e.text,kind:e.kind,createdAt:e.created_at})),assets:grants.map(g=>{const a=c.assets.find(a=>a.id===g.asset_id);return {id:a.id,title:a.title,mimeType:a.mime,size:a.sizeBytes,version:a.version,roleId:g.role_id,messageId:displayedAssetMessage(g.role_id,g.seq),grantedAt:g.granted_at,collected:!!g.collected};}),metrics:c.calculations.map(m=>this.metricView(runId,m)),reports:this.store.all('SELECT * FROM reports WHERE run_id=? ORDER BY version DESC',runId).map(r=>({id:r.id,version:r.version,status:r.status,markdown:r.markdown,error:r.error,createdAt:r.created_at})),progress:completionCount(c.discoveries,results),updatedAt:run.updated_at};
  }
  metricView(runId,m){const c=this.caseFor(this.store.run(runId));const grants=new Set(this.store.all('SELECT asset_id FROM grants WHERE run_id=?',runId).map(g=>g.asset_id));const missing=m.inputs.filter(id=>!grants.has(id));const existing=this.store.get('SELECT result FROM analyses WHERE run_id=? AND metric_id=?',runId,m.id);return {id:m.id,title:m.title,description:m.definition,available:!missing.length,missingAssetTitles:missing.map(id=>c.assets.find(a=>a.id===id)?.title||id),inputAssetIds:m.inputs,unit:m.unit,version:m.version||'1',columns:Object.values(m.columns??{}).flat(),...(existing?JSON.parse(existing.result):{})};}
  hints(runId,roleId,{level=1,itemId}={}){const c=this.caseFor(this.requireLive(runId));this.role(c,roleId);const done=this.store.all('SELECT item_id FROM discovery WHERE run_id=? AND status IN (?,?)',runId,'completed','verified_currently_unknown').map(r=>r.item_id);return c.discoveries.filter(i=>i.roleId===roleId&&!done.includes(i.id)&&(!itemId||i.id===itemId)).map(i=>({itemId:i.id,roleId,level:level===2?2:1,topic:i.title,text:i.hints[level===2?1:0]}));}
  generateReport(runId){return generateReport(this,runId);}
  exportReport(runId,reportId,format){return exportReport(this,runId,reportId,format);}
  async restart(runId){const run=this.requireLive(runId);this.store.exec("UPDATE runs SET status='archived',updated_at=? WHERE id=?",now(),runId);await Promise.allSettled([...this.store.all('SELECT * FROM role_sessions WHERE run_id=?',runId).map(row=>this.native.dispose(row.session_id)),this.native.cancelHelpers(runId)]);return this.start(run.case_id);}
}
