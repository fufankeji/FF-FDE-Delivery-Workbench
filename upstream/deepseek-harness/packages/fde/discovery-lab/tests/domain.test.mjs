import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../src/vendor/store.js';
import { loadCases, publicCase, safeAsset } from '../src/vendor/cases.js';
import { validateCandidate, completionCount, evaluateRole, supportsQuote } from '../src/vendor/evaluation.js';
import { validateReport, compileReport, reportReferenceMap, expandReportReferences } from '../src/vendor/reports.js';
import { TrainingService } from '../src/vendor/training.js';
import { NativeSessions } from '../src/vendor/native-sessions.js';
import { materialEvidence } from '../src/vendor/evidence-input.js';

// These are deterministic domain tests. The native agent below is a test double,
// not evidence of a live DeepSeek conversation or official DSH persistence.
function temporary(t) {
  const dir = mkdtempSync(join(tmpdir(), 'fde-domain-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}
function deferred() { let resolve; let reject; const promise = new Promise((a,b) => {resolve=a;reject=b;}); return {promise,resolve,reject}; }
const tick = () => new Promise(resolve => setImmediate(resolve));
function pack(id = 'alpha') {
  const role = (rid) => ({id:rid,name:rid,title:'受访岗位',bio:'公开职责',style:'简洁',goals:[],unknowns:['不知道其他岗位私有信息'],factIds:[`${rid}.fact`],assetIds:[`${rid}.asset`]});
  return {id,version:'1',title:'离线规则夹具',industry:'测试',background:'公开背景',initialRequest:'请了解当前业务',snapshot:'2026-09-14T09:00:00+08:00',
    roles:[role('a'),role('b')],facts:['a','b'].map(rid=>({id:`${rid}.fact`,roleIds:[rid],topic:'当前状态',text:'资料接口尚未开放',kind:'unknown',sources:[]})),
    assets:['a','b'].map(rid=>({id:`${rid}.asset`,path:`source-materials/${rid}.txt`,title:`${rid}资料`,version:'1',mime:'text/plain',roleIds:[rid]})),
    discoveries:[{id:'a.point',roleId:'a',title:'接口现状',type:'interview',required:true,factIds:['a.fact'],requiredAssetIds:['a.asset'],allowUnknown:true,evidencePolicy:{requiresCommittedAssistant:true,learnerAssertionCounts:false,requiresQuoteSupport:true},hints:['了解接口现状','向本人询问当前接口是否开放']}],
    calculations:[],report:{title:'报告',sections:['原始诉求','业务现状'],requirements:[]}};
}
function fixture(t, ctx = {on() {}}) {
  const root = temporary(t); mkdirSync(join(root,'source-materials'));
  for(const id of ['alpha','beta']) {mkdirSync(join(root,'cases',id),{recursive:true});writeFileSync(join(root,'cases',id,'case.json'),JSON.stringify(pack(id)));}
  writeFileSync(join(root,'source-materials','a.txt'),'接口尚未开放');
  writeFileSync(join(root,'source-materials','b.txt'),'这是其他岗位的私有资料');
  const dataDir=join(root,'data');mkdirSync(dataDir);
  const service=new TrainingService(ctx,{root,dataDir});
  // Keep unit tests free of background model work and retry timers.
  service.queueEvaluation=()=>{};
  t.after(()=>service.store.close());
  return {root,service};
}
function fakeNative() {
  const turns=[];const disposed=[];const opened=[];const history=new Map();
  return {turns,disposed,opened,history,
    async open(options){opened.push(options);history.set(options.sessionId,history.get(options.sessionId)||[]);},
    events(id){return history.get(id)||[];}, messages(){return [];},
    send(id,text,before){const d=deferred();const messageId=`message-${turns.length}`;before({messageId,fromSeq:0});turns.push({id,text,...d});return {messageId,completion:d.promise};},
    async dispose(id){disposed.push(id);}, async cancelHelpers(){}, stop(){},
  };
}
function proposal(overrides={}) {return {itemId:'a.point',status:'completed',confirmedFactIds:['a.fact'],evidenceRefs:['ev-a'],citations:[{evidenceId:'ev-a',quote:'资料接口尚未开放'}],explanation:'已核对原始回答',...overrides};}
function candidateFixture() {
  const c=pack();return {item:c.discoveries[0],facts:new Map(c.facts.map(f=>[f.id,f])),grants:new Set(['a.asset']),evidence:new Map([['ev-a',{id:'ev-a',kind:'interview',role_id:'a',session_id:'native-a',seq:3,message_id:'message-a',text:'资料接口尚未开放'}]])};
}

test('Store enforces one active run, one native role mapping and transactional rollback', t => {
  const store=new Store(join(temporary(t),'state.sqlite'));t.after(()=>store.close());
  store.exec('INSERT INTO runs VALUES(?,?,?,?,?,?,?)','old','case','1',1,'investigating','now','now');
  assert.throws(()=>store.exec('INSERT INTO runs VALUES(?,?,?,?,?,?,?)','second','case','1',2,'investigating','now','now'),/UNIQUE/);
  store.exec('INSERT INTO role_sessions(run_id,role_id,session_id) VALUES(?,?,?)','old','a','native-a');
  assert.throws(()=>store.exec('INSERT INTO role_sessions(run_id,role_id,session_id) VALUES(?,?,?)','old','a','native-other'),/UNIQUE/);
  assert.throws(()=>store.transaction(()=>{store.exec("UPDATE runs SET status='archived' WHERE id='old'");throw new Error('fail');}),/fail/);
  assert.equal(store.live('old',1),true);assert.equal(store.live('old',2),false);
  store.exec("UPDATE runs SET status='archived' WHERE id='old'");assert.equal(store.live('old',1),false);
});

test('Case loading and public projection exclude role facts, permissions and private answers', t => {
  const {root}=fixture(t);const loaded=loadCases(root);assert.equal(loaded.size,2);
  const view=publicCase(loaded.get('alpha'),'run');
  assert.equal(view.currentRunId,'run');assert.equal(view.roles.length,2);
  assert.equal('facts' in view,false);assert.equal('discoveries' in view,false);
  assert.equal('factIds' in view.roles[0],false);assert.equal('assetIds' in view.roles[0],false);
});

test('safeAsset rejects traversal, symlink escape, teacher and future layers', t => {
  const {root}=fixture(t);const a={path:'source-materials/a.txt'};
  assert.equal(safeAsset(root,a),realpathSync(join(root,a.path)));
  writeFileSync(join(root,'outside.txt'),'outside');symlinkSync(join(root,'outside.txt'),join(root,'source-materials','escape.txt'));
  for(const name of ['教师专用','后续事件']){mkdirSync(join(root,'source-materials',name));writeFileSync(join(root,'source-materials',name,'secret.txt'),'secret');}
  for(const path of ['source-materials/../outside.txt','source-materials/escape.txt','source-materials/教师专用/secret.txt','source-materials/后续事件/secret.txt'])assert.throws(()=>safeAsset(root,{path}),e=>e.status===403,path);
});

test('Candidate validation rejects fabricated references, fabricated quotes and missing files', () => {
  const f=candidateFixture();const validate=p=>validateCandidate(p,f.item,f.evidence,f.grants,f.facts);
  assert.equal(validate(proposal({evidenceRefs:['missing']})),null);
  assert.equal(validate(proposal({citations:[{evidenceId:'ev-a',quote:'模型杜撰的回答'}]})),null);
  assert.equal(validateCandidate(proposal(),f.item,f.evidence,new Set(),f.facts)?.status,'needs_deeper');
  assert.equal(validate(proposal())?.status,'completed');
});

test('Incomplete public feedback cannot expose hidden reference answers', () => {
  const f=candidateFixture();
  const value=validateCandidate(proposal({status:'needs_deeper',explanation:'隐藏的标准答案是补件两天打两次电话'}),f.item,f.evidence,f.grants,f.facts);
  assert.equal(value.status,'needs_deeper');
  assert.equal(value.explanation.includes('两次电话'),false);
  assert.match(value.explanation,/提问提示/);
});

test('Explicit citation IDs reconcile a redundant list without accepting unknown or unauthorized evidence', () => {
  const f=candidateFixture();
  const validate=p=>validateCandidate(p,f.item,f.evidence,f.grants,f.facts);
  const value=validate(proposal({evidenceRefs:[]}));
  assert.equal(value.status,'completed');
  assert.deepEqual(value.refs,['ev-a']);
  assert.equal(validate(proposal({citations:[{evidenceId:'missing',quote:'资料接口尚未开放'}]})),null);
  f.evidence.set('ev-other',{id:'ev-other',kind:'interview',role_id:'b',session_id:'native-b',message_id:'message-b',text:'资料接口尚未开放'});
  assert.equal(validate(proposal({citations:[{evidenceId:'ev-other',quote:'资料接口尚未开放'}]})),null);
});

test('Visible Markdown quotations match durable evidence without accepting changed facts', () => {
  const f=candidateFixture();f.evidence.get('ev-a').text='凭据是交**供餐声明**，不要求虚构发票。';
  assert.equal(validateCandidate(proposal({citations:[{evidenceId:'ev-a',quote:'凭据是交供餐声明，不要求虚构发票。'}]}),f.item,f.evidence,f.grants,f.facts)?.status,'completed');
  assert.equal(validateCandidate(proposal({citations:[{evidenceId:'ev-a',quote:'凭据是交供餐声明，要求虚构发票。'}]}),f.item,f.evidence,f.grants,f.facts),null);
  f.facts.get('a.fact').kind='fact';
  assert.equal(validateCandidate(proposal({status:'verified_currently_unknown',citations:[{evidenceId:'ev-a',quote:'不要求虚构发票。'}]}),f.item,f.evidence,f.grants,f.facts)?.status,'verified_currently_unknown');
});

test('Candidate cannot award credit for learner assertions or unauthorized other-role testimony', () => {
  const f=candidateFixture();
  for(const change of [{kind:'user'},{role_id:'b'}]) {
    const bad=new Map([['ev-a',{...f.evidence.get('ev-a'),...change}]]);
    assert.equal(validateCandidate(proposal(),f.item,bad,f.grants,f.facts),null,JSON.stringify(change));
  }
});

test('Unknown completion requires an allowed missing fact and cannot inflate unrelated progress', () => {
  const f=candidateFixture();
  assert.equal(validateCandidate(proposal({status:'verified_currently_unknown'}),{...f.item,allowUnknown:false},f.evidence,f.grants,f.facts),null);
  assert.equal(validateCandidate(proposal({status:'verified_currently_unknown'}),f.item,f.evidence,f.grants,f.facts)?.status,'verified_currently_unknown');
  const progress=completionCount([{id:'known',required:true,allowUnknown:false},{id:'unknown',required:true,allowUnknown:true},{id:'optional',required:false}], [{item_id:'known',status:'verified_currently_unknown'},{item_id:'unknown',status:'verified_currently_unknown'},{item_id:'optional',status:'completed'}]);
  assert.deepEqual(progress,{completed:1,total:2,percent:50});
});

test('A point requiring the role interview cannot be completed from acquired documents alone', () => {
  const f=candidateFixture();f.evidence.get('ev-a').kind='asset';f.evidence.get('ev-a').asset_id='a.asset';
  assert.equal(validateCandidate(proposal(),f.item,f.evidence,f.grants,f.facts),null);
});

test('Numerical investigation prerequisites must appear in committed supporting quotations', () => {
  const f=candidateFixture();assert.equal(validateCandidate(proposal(),{...f.item,requiredNumericValues:[380,760]},f.evidence,f.grants,f.facts),null);
});

test('Report rejects absent sections, forged citations, invented numerals and local-only links', () => {
  const text='## 原始诉求\n'+('业务调查说明，区分意见和事实。'.repeat(40))+'\n## 业务现状\n资料接口尚未开放。[证据:ev-a]';
  const sections=['原始诉求','业务现状'];const evidence=[{id:'ev-a',text:'资料接口尚未开放'}];
  assert.equal(validateReport(text,sections,evidence,'资料接口尚未开放'),true);
  assert.throws(()=>validateReport(text.replace('业务现状','其他标题'),sections,evidence,''),/缺少章节/);
  assert.throws(()=>validateReport(text.replace('ev-a','missing'),sections,evidence,''),/引用/);
  assert.throws(()=>validateReport(text+' 节约9999元。',sections,evidence,''),/数值/);
  assert.throws(()=>validateReport(text+' 原件位于 /Users/private/file。',sections,evidence,''),/本机链接/);
});

test('Report numerals must be supported by citations in that paragraph, not a global input bag', () => {
  const preface='## 原始诉求\n\n'+('业务调查说明，区分意见和事实。'.repeat(40))+'[证据:ev-count]\n\n## 业务现状\n\n';
  const evidence=[{id:'ev-count',text:'历史样本为180笔'},{id:'ev-returned',text:'被退回的样本为60笔'}];
  const inputs=JSON.stringify(evidence);
  assert.equal(validateReport(preface+'历史样本180笔。[证据:ev-count]',['原始诉求','业务现状'],evidence,inputs),true);
  assert.throws(()=>validateReport(preface+'历史样本180笔。[证据:ev-returned]',['原始诉求','业务现状'],evidence,inputs),/数值/);
  assert.throws(()=>validateReport(preface+'历史样本180笔。',['原始诉求','业务现状'],evidence,inputs),/数值/);
});

test('Compiled quantitative baseline binds numerator, denominator and rate to program results', () => {
  const c={report:{sections:['原始诉求','问题量化与基线']},calculations:[{id:'returns',title:'历史退回比例',definition:'按完整历史样本计算。'}]};
  const draft='## 原始诉求\n\n'+('调查以已取得原始资料和岗位确认作为依据。'.repeat(30))+'[证据:ev-a]\n\n## 问题量化与基线\n\n{{QUANTITATIVE_BASELINE}}';
  const evidence=[{id:'ev-a',text:'调查已获得资料。'},{id:'metric-run-returns',kind:'calculation',text:'returnedClaims 60 totalClaims 180 ratePercent 33.3333'}];
  const analyses=[{metric_id:'returns',result:JSON.stringify({details:{returnedClaims:60,totalClaims:180,ratePercent:33.3333}})}];
  const report=compileReport(draft,c,evidence,analyses,'run');
  assert.match(report,/60 \/ 180 = 33\.3333%/);
  assert.match(report,/\[证据:metric-run-returns\]/);assert.equal(report.includes('{{QUANTITATIVE_BASELINE}}'),false);
  const policyDraft=draft.replace('## 原始诉求','## 原始 诉求').replace('## 问题量化与基线','制度要求分摊合计100%。[证据:policy]\n\n## 问题量化与基线');
  const policyReport=compileReport(policyDraft,c,[...evidence,{id:'policy',kind:'asset',text:'项目分摊合计100%。'}],analyses,'run');
  assert.match(policyReport,/## 原始诉求/);assert.match(policyReport,/制度要求分摊合计100%/);
  assert.throws(()=>compileReport(draft+'\n\n退回比例60%。[证据:metric-run-returns]',c,evidence,analyses,'run'),/百分比/);
  assert.throws(()=>compileReport(draft.replace('{{QUANTITATIVE_BASELINE}}',''),c,evidence,analyses,'run'),/占位/);
  assert.throws(()=>compileReport(draft+'{{QUANTITATIVE_BASELINE}}',c,evidence,analyses,'run'),/占位/);
  assert.throws(()=>compileReport(draft,c,evidence,[],'run'),/指标/);
  const misplaced=draft.replace('{{QUANTITATIVE_BASELINE}}','').replace('## 原始诉求','{{QUANTITATIVE_BASELINE}}\n\n## 原始诉求');
  assert.throws(()=>compileReport(misplaced,c,evidence,analyses,'run'),/量化占位/);
});

test('Short report references retain exact source identity and reject invented references', () => {
  const refs=reportReferenceMap([{id:'durable-source-one'},{id:'durable-source-two'}]);
  assert.deepEqual(refs,[{id:'E001',sourceId:'durable-source-one'},{id:'E002',sourceId:'durable-source-two'}]);
  assert.equal(expandReportReferences('原始依据[证据:E002]',refs),'原始依据[证据:durable-source-two]');
  assert.throws(()=>expandReportReferences('不存在[证据:E003]',refs),/不存在/);
});

test('Acquired original excerpts can support report citations without exposing ungranted files', async t => {
  const {service,root}=fixture(t);const run=await service.start('alpha');
  writeFileSync(join(root,'source-materials','a.txt'),'审批等待为24小时，尚无支付结果。');
  const records=[{id:'file-a',kind:'asset',asset_id:'a.asset',text:'已取得资料'}];
  assert.throws(()=>materialEvidence(service,run.runId,records),e=>e.status===403);
  service.store.exec('INSERT INTO grants VALUES(?,?,?,?,?,?,?,0)',run.runId,'a.asset','a','native-a',3,'message-a','now');
  const expanded=materialEvidence(service,run.runId,records);
  assert.match(expanded[0].text,/24小时/);
  assert.equal(records[0].text,'已取得资料','durable provenance is not overwritten by a derived excerpt');
  assert.equal(expanded[0].text.includes('其他岗位'),false);
  const report='## 原始诉求\n\n'+('调查限定已授权资料和原始证据。'.repeat(40))+'\n\n## 业务现状\n\n审批等待为24小时。[证据:file-a]';
  assert.equal(validateReport(report,['原始诉求','业务现状'],expanded,''),true);
  assert.throws(()=>validateReport(report,['原始诉求','业务现状'],records,''),/数值/);
  assert.throws(()=>materialEvidence(service,run.runId,[{id:'file-b',kind:'asset',asset_id:'b.asset',text:'猜测资料'}]),e=>e.status===403);
});

test('Quoted visible list text and ordered omissions preserve actual business wording', () => {
  const source='- 凭据上是交**供餐声明**，不要求虚构发票。\n- 天数按**出差自然日**算，首尾两天都计。';
  assert.equal(supportsQuote(source,'凭据上是交供餐声明，不要求虚构发票。天数按出差自然日算，首尾两天都计。'),true);
  assert.equal(supportsQuote(source,'凭据上是交供餐声明……首尾两天都计。'),true);
  assert.equal(supportsQuote(source,'首尾两天都计。……凭据上是交供餐声明'),false);
  assert.equal(supportsQuote('实际1 2小时的记录','实际12小时的记录'),false);
  assert.equal(supportsQuote(source,'凭据上是交供餐声明……首尾三天都计。'),false);
});

test('Native completion requires a completed turn, not a preamble before an error or cancellation', async () => {
  const adapter={ctx:{sessions:{flush:async()=>{}}},events:async()=>[]};
  const base=[{type:'turn/start',seq:1,data:{turn:'one'}},{type:'user/message',seq:2,data:{id:'q'}},{type:'assistant/message',seq:3,data:{turn:'one',message:{content:[{type:'text',text:'正在查找该资料。'}]}}}];
  for(const kind of ['completed','error','aborted']){
    const events=[...base,{type:'turn/end',seq:4,data:{turn:'one',reason:{kind}}}];
    const agent={whenIdle:async()=>{},session:{events}};adapter.events=async()=>events;
    const value=await NativeSessions.prototype.settle.call(adapter,agent,'q',0);
    assert.equal(value.status,kind==='completed'?'completed':'failed');
  }
  const agent={whenIdle:async()=>{},session:{events:base}};adapter.events=async()=>base;
  assert.equal((await NativeSessions.prototype.settle.call(adapter,agent,'q',0)).status,'failed');
});

test('Resuming a native role durably drops parked input once before exposing its handle', async t => {
  let cleared=0,flushed=0,resumed=0;
  const inbox={nextTurn:[{id:'old-unconsumed'}],nextStep:[],clear(){cleared++;this.nextTurn=[];}};
  const handle={agent:{inbox},dispose:async()=>{}};
  const ctx={on(){},sessionPersistence:{stat:async()=>({})},agents:{async resume(){resumed++;return handle;}},sessions:{async flush(){flushed++;}}};
  const native=new NativeSessions(ctx,{cwd:temporary(t)});
  await native.open({sessionId:'resumed-role',resume:true,prompt:'岗位'});
  assert.equal(cleared,1);assert.equal(flushed,1);assert.equal(inbox.nextTurn.length,0);
  inbox.nextTurn.push({id:'new-active-question'});
  await native.open({sessionId:'resumed-role',resume:true,prompt:'岗位'});
  assert.equal(resumed,1);assert.equal(cleared,1,'ordinary snapshot must not clear new live input');
  assert.equal(inbox.nextTurn[0].id,'new-active-question');
});

test('Native creation recovers only its exact durable identity collision', async t => {
  let resumes=0;
  const handle={agent:{inbox:{nextTurn:[],nextStep:[]}},dispose:async()=>{}};
  const ctx={on(){},sessionPersistence:{stat:async()=>undefined},agents:{async create({sessionId}){throw Object.assign(new Error('already exists'),{name:'SessionAlreadyExistsError',sessionId});},async resume(){resumes++;return handle;}},sessions:{flush:async()=>{}}};
  const native=new NativeSessions(ctx,{cwd:temporary(t)});
  await native.open({sessionId:'committed-before-opened',prompt:'角色'});
  assert.equal(resumes,1);
  ctx.agents.create=async()=>{throw new Error('disk failed');};
  await assert.rejects(native.open({sessionId:'another',prompt:'角色'}),/disk failed/);
  assert.equal(resumes,1);
});

test('Host startup releases interrupted report and evaluation flags without discarding prior versions', async t => {
  const {service,root}=fixture(t);const a=await service.start('alpha');const b=await service.start('beta');
  service.store.exec('INSERT INTO role_sessions(run_id,role_id,session_id,eval_status) VALUES(?,?,?,?)',a.runId,'a','persisted-native','pending');
  service.store.exec('INSERT INTO reports VALUES(?,?,?,?,?,?,?,?,?)','old',a.runId,1,'completed','{}','原报告',null,'helper-old','now');
  for(const [id,version,run] of [['next',2,a],['first',1,b]]){
    service.store.exec('INSERT INTO reports VALUES(?,?,?,?,?,?,?,?,?)',id,run.runId,version,'generating','{}',null,null,null,'now');
    service.store.exec("UPDATE runs SET status='reporting' WHERE id=?",run.runId);
  }
  const resumed=new TrainingService({on(){}},{root,dataDir:service.dataDir});t.after(()=>resumed.store.close());
  assert.equal(resumed.store.run(a.runId).status,'passed');
  assert.equal(resumed.store.run(b.runId).status,'ready');
  assert.equal(resumed.store.get("SELECT markdown FROM reports WHERE id='old'").markdown,'原报告');
  assert.equal(resumed.store.get("SELECT status FROM reports WHERE id='next'").status,'error');
  assert.equal(resumed.store.get('SELECT eval_status FROM role_sessions WHERE run_id=?',a.runId).eval_status,'error');
  assert.equal(resumed.store.get('SELECT session_id FROM role_sessions WHERE run_id=?',a.runId).session_id,'persisted-native');
});

test('Training grants reject guessed assets and assets from another case run', async t => {
  const {service}=fixture(t);const a=await service.start('alpha');const b=await service.start('beta');
  assert.throws(()=>service.grant(a.runId,'a.asset'),e=>e.status===403);
  service.store.exec('INSERT INTO grants VALUES(?,?,?,?,?,?,?,0)',a.runId,'a.asset','a','native-a',3,'message-a','now');
  assert.equal(service.grant(a.runId,'a.asset').asset.id,'a.asset');
  assert.throws(()=>service.grant(b.runId,'a.asset'),e=>e.status===403);
  assert.throws(()=>service.grant(a.runId,'b.asset'),e=>e.status===403);
});

test('An explicit request naming an authorized original does not require generic file keywords', async t => {
  const {service}=fixture(t);service.native=fakeNative();const snapshot=await service.start('alpha');
  const row=await service.ensureRole(snapshot.runId,'a'),run=service.store.run(snapshot.runId),c=service.caseFor(run);c.assets[0].title='历史报销单';
  const tool=service.roleTools(run,c,c.roles[0]).find(t=>t.name==='offerCaseAsset');
  const history=text=>service.native.history.set(row.session_id,[{type:'user/message',seq:1,data:{source:{kind:'user'},content:[{type:'text',text}]}}]);
  history('请提供历史报销单。');
  assert.equal((await tool.execute({assetId:'a.asset'},{signal:new AbortController().signal})).assetId,'a.asset');
  history('请说说历史报销单的情况。');
  await assert.rejects(tool.execute({assetId:'a.asset'},{signal:new AbortController().signal}),/尚未明确索取/);
});

test('Repeated request IDs enqueue a single interview and preserve per-role ownership', async t => {
  const {service}=fixture(t);service.native=fakeNative();const run=await service.start('alpha');
  await service.send(run.runId,'a','same-request','接口现在能用吗？');
  await service.send(run.runId,'a','same-request','接口现在能用吗？');
  assert.equal(service.native.turns.length,1);
  await assert.rejects(service.send(run.runId,'b','same-request','重复编号'),e=>e.status===409);
  service.native.turns[0].resolve({status:'completed',events:[]});await tick();
});

test('Concurrent retry of the same request ID returns a receipt rather than a busy error', async t => {
  const {service}=fixture(t);service.native=fakeNative();const run=await service.start('alpha');
  const responses=await Promise.allSettled([service.send(run.runId,'a','same','接口情况？'),service.send(run.runId,'a','same','接口情况？')]);
  service.native.turns.forEach(turn=>turn.resolve({status:'completed',events:[]}));await tick();
  assert.equal(service.native.turns.length,1);
  assert.equal(responses.filter(r=>r.status==='rejected').length,0);
});

test('Restart rejects a send waiting for role creation and preserves the other case', async t => {
  const gate=deferred();let created=0;let sent=0;let disposed=0;
  const session={seq:0,events:[]};
  const handle={agent:{status:'idle',session,followup(){sent++;},whenIdle:async()=>{},cancel(){}},dispose:async()=>{disposed++;}};
  const ctx={on(){},sessionPersistence:{stat:async()=>undefined},agents:{async create(){created++;await gate.promise;return handle;}},sessions:{flush:async()=>{}}};
  const {service}=fixture(t,ctx);const run=await service.start('alpha');const other=await service.start('beta');
  const pending=service.send(run.runId,'a','pending','当前接口情况？');await tick();assert.equal(created,1);
  // Do not await restart before releasing create: a correct implementation may
  // await the pending native handle so it can cancel/dispose it deterministically.
  const restarting=service.restart(run.runId);await tick();gate.resolve();
  const [sendResult,restartResult]=await Promise.allSettled([pending,restarting]);await tick();
  assert.equal(restartResult.status,'fulfilled');assert.equal(sendResult.status,'rejected');assert.equal(sent,0);
  assert.ok(disposed>=1,'late-created native handle must be disposed');
  assert.equal(service.store.live(other.runId),true);
  assert.equal(restartResult.value.generation,run.generation+1);
});

test('Late completed interview cannot grant evidence to a restarted run', async t => {
  const {service}=fixture(t);service.native=fakeNative();const run=await service.start('alpha');
  await service.send(run.runId,'a','late','当前接口情况？');const turn=service.native.turns[0];
  const next=await service.restart(run.runId);
  turn.resolve({status:'completed',events:[{type:'assistant/message',seq:9,data:{message:{id:'late-reply',content:[{type:'text',text:'迟到回答'}]}}}]});await tick();
  assert.equal(service.store.all('SELECT * FROM evidence WHERE run_id=?',next.runId).length,0);
  assert.equal(service.store.all('SELECT * FROM evidence WHERE run_id=?',run.runId).length,0);
  assert.equal(service.native.disposed.length,1);
});

test('Evaluation failure preserves interview evidence and retry does not resend the interview', async t => {
  const {service}=fixture(t);service.native=fakeNative();const run=await service.start('alpha');await service.ensureRole(run.runId,'a');
  service.store.exec('INSERT INTO evidence VALUES(?,?,?,?,?,?,?,?,?,?)','ev-a',run.runId,'a','native-a',3,'message-a',null,'interview','资料接口尚未开放','now');
  service.store.exec('INSERT INTO grants VALUES(?,?,?,?,?,?,?,0)',run.runId,'a.asset','a','native-a',4,'message-a','now');
  let evaluations=0;
  service.native.generate=async()=>{evaluations++;throw new Error('test-only unavailable');};
  await evaluateRole(service,run.runId,'a');
  assert.equal(service.store.get('SELECT eval_status FROM role_sessions WHERE run_id=? AND role_id=?',run.runId,'a').eval_status,'error');
  assert.equal(service.store.all('SELECT * FROM evidence WHERE run_id=?',run.runId).length,1);
  await evaluateRole(service,run.runId,'a');assert.equal(evaluations,2);assert.equal(service.native.turns.length,0);
});

test('Recovery retains a durable asset grant when the host stopped before the final reply', async t => {
  const {service}=fixture(t);service.native=fakeNative();const run=await service.start('alpha');
  service.store.exec('INSERT INTO role_sessions(run_id,role_id,session_id,opened) VALUES(?,?,?,1)',run.runId,'a','resumed-native');
  service.store.exec('INSERT INTO requests VALUES(?,?,?,?,?,?,?)',run.runId,'before-crash','a','question','running',null,'now');
  service.native.history.set('resumed-native',[
    {type:'turn/start',seq:1,data:{turn:'turn-1'}},
    {type:'user/message',seq:2,data:{id:'question',source:{kind:'user'},content:[{type:'text',text:'请提供资料'}]}},
    {type:'tool/call',seq:3,data:{turn:'turn-1',callId:'call-1',name:'offerCaseAsset'}},
    {type:'tool/result',seq:4,data:{turn:'turn-1',message:{id:'tool-message',role:'tool',toolCallId:'call-1',content:[{type:'text',text:JSON.stringify({assetId:'a.asset',title:'a资料',version:'1'})}]}}},
  ]);
  await service.ensureRole(run.runId,'a');
  assert.equal(service.native.opened[0].resume,true);
  assert.equal(service.store.get('SELECT session_id FROM role_sessions WHERE run_id=? AND role_id=?',run.runId,'a').session_id,'resumed-native');
  assert.equal(service.grant(run.runId,'a.asset').asset.id,'a.asset');
  assert.equal(service.receipt(run.runId,'before-crash').status,'failed','interrupted reply is retriable, but the file remains acquired');
});

test('Restart discards late evaluation and report callbacks and cancels their owning run', async t => {
  for(const task of ['evaluation','report']) await t.test(task,async sub => {
    const {service}=fixture(sub);service.native=fakeNative();const run=await service.start('alpha');
    await service.ensureRole(run.runId,'a');
    service.store.exec('INSERT INTO evidence VALUES(?,?,?,?,?,?,?,?,?,?)','ev-a',run.runId,'a','native-a',3,'message-a',null,'interview','资料接口尚未开放','now');
    service.store.exec('INSERT INTO grants VALUES(?,?,?,?,?,?,?,0)',run.runId,'a.asset','a','native-a',4,'message-a','now');
    const gate=deferred();const canceled=[];let owner;
    service.native.generate=async(_prompt,_input,options)=>{
      owner=options?.owner;
      if(task==='report'){
        assert.equal(_prompt.includes('{{'),false,'Official DSH treats double braces as prompt variables');
        assert.equal(JSON.parse(_input).quantitativePlaceholder,'{{QUANTITATIVE_BASELINE}}');
        assert.equal(options.maxTokens,8192);
      }
      return gate.promise;
    };
    service.native.cancelHelpers=async runId=>{canceled.push(runId);};
    let pending;
    if(task==='evaluation') pending=evaluateRole(service,run.runId,'a');
    else {
      service.store.exec('INSERT INTO discovery VALUES(?,?,?,?,?,?)',run.runId,'a.point','completed','["ev-a"]','test fixture','test');
      await service.generateReport(run.runId);
    }
    await tick();assert.equal(owner,run.runId);
    const next=await service.restart(run.runId);assert.deepEqual(canceled,[run.runId]);
    gate.resolve({sessionId:'late-helper',text:task==='evaluation'?JSON.stringify({candidates:[proposal()]}):'irrelevant late report'});
    if(pending)await pending;await tick();
    assert.equal(service.store.all('SELECT * FROM discovery WHERE run_id=?',next.runId).length,0);
    assert.equal(service.store.all('SELECT * FROM reports WHERE run_id=?',next.runId).length,0);
    assert.equal(service.store.get('SELECT status FROM runs WHERE id=?',next.runId).status,'investigating');
    assert.equal(service.store.all("SELECT * FROM reports WHERE run_id=? AND status='completed'",run.runId).length,0);
  });
});

test('Report validation gets one evidence-bound correction, then succeeds or exposes a retryable error', async t => {
  for(const corrected of [true,false]){
    const {service}=fixture(t);service.native=fakeNative();const run=await service.start('alpha');
    service.store.exec('INSERT INTO discovery VALUES(?,?,?,?,?,?)',run.runId,'a.point','completed','[]','test fixture','test');
    const inputs=[];
    service.native.generate=async(_prompt,input)=>{
      inputs.push(JSON.parse(input));
      return {sessionId:`helper-${inputs.length}`,text:corrected&&inputs.length===2
        ? '## 原始诉求\n\n'+('本次只依据公开委托理解现状，仍需核实业务条件。'.repeat(30))+'[证据:E001]\n\n## 业务现状\n\n当前事实以已取得证据为准。[证据:E001]\n\n## 问题量化与基线\n\n{{QUANTITATIVE_BASELINE}}'
        : '缺少章节的模型草稿'};
    };
    const {reportId}=await service.generateReport(run.runId);
    await tick();await tick();
    const report=service.store.get('SELECT * FROM reports WHERE id=?',reportId);
    assert.equal(inputs.length,2);
    assert.deepEqual(inputs[0].evidence,inputs[1].evidence);
    assert.match(inputs[1].validationFeedback,/程序校验/);
    assert.equal(report.status,corrected?'completed':'error');
    assert.equal(JSON.parse(report.snapshot).validationAttempts.length,corrected?1:2);
  }
});
