import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:http';
import {TrainingService} from '../src/vendor/training.js';
import {createApiHandler} from '../src/vendor/http.js';
import {newerVersion} from '../src/vendor/cases.js';
const root=join(dirname(fileURLToPath(import.meta.url)),'../.assets');
function fixture(t){const dir=mkdtempSync(join(tmpdir(),'fde-version-'));const service=new TrainingService({on(){}},{root,dataDir:dir});service.native={messages:()=>[],events:()=>[],dispose:async()=>{}};t.after(()=>{service.store.close();rmSync(dir,{recursive:true,force:true});});return service;}
function installNext(service){const old=service.cases.get('finance');const next={...old,version:'99.0.0',background:'新版本底稿'};service.cases.set('finance',next);service.store.exec('INSERT INTO cases VALUES(?,?,?)',next.id,next.version,JSON.stringify(next));return next;}
test('Upgrade is explicit and idempotent; old case, progress, report and other runs survive',async t=>{
 const s=fixture(t),old=await s.start('finance'),other=await s.start('logistics');const item=s.caseFor(s.store.run(old.runId)).discoveries.find(i=>i.required);
 s.store.exec('INSERT INTO discovery VALUES(?,?,?,?,?,?)',old.runId,item.id,'completed','[]','unit fixture','test');
 s.store.exec('INSERT INTO reports VALUES(?,?,?,?,?,?,?,?,?)','old-report',old.runId,1,'completed','{}','旧版真实记录的测试替身',null,null,new Date().toISOString());
 installNext(s);
 const listed=s.list().find(c=>c.id==='finance');assert.equal(listed.version,old.case.version);assert.equal(listed.upgradeAvailable,true);assert.equal(listed.progress.completed,1);
 const next=await s.upgrade(old.runId);assert.notEqual(next.runId,old.runId);assert.equal(next.case.version,'99.0.0');assert.equal(next.progress.completed,0);assert.equal(next.case.upgradeAvailable,false);
 assert.equal((await s.upgrade(old.runId)).runId,next.runId);assert.equal(s.caseFor(s.store.run(old.runId)).version,old.case.version);assert.equal(s.list().find(c=>c.id==='logistics').currentRunId,other.runId);
 const history=s.history('finance');assert.equal(history.find(r=>r.runId===old.runId).progress.completed,1);assert.equal(history.find(r=>r.runId===old.runId).reports[0].id,'old-report');
 const md=await s.exportReport(old.runId,'old-report','md');assert.equal(md.bytes.toString(),'旧版真实记录的测试替身');assert.throws(()=>s.requireLive(old.runId),/归档/);
});
test('An in-flight interview blocks upgrade without touching its current run',async t=>{
 const s=fixture(t),old=await s.start('finance');installNext(s);s.store.exec('INSERT INTO requests VALUES(?,?,?,?,?,?,?)',old.runId,'pending','employee','m','running',null,new Date().toISOString());
 await assert.rejects(s.upgrade(old.runId),/等待/);assert.equal(s.store.run(old.runId).status,'investigating');assert.equal(s.store.all('SELECT * FROM run_upgrades').length,0);
});
test('Classification release needs this run granted and viewed original plus an actual classification question',async t=>{
 const s=fixture(t),run=await s.start('finance'),gate={releaseGate:{viewedAssetIds:['finance-history'],questionTerms:['分类','复核']}};
 assert.throws(()=>s.checkReleaseGate(run.runId,gate,'请提供分类依据'),/查看/);
 s.store.exec('INSERT INTO grants VALUES(?,?,?,?,?,?,?,?)',run.runId,'finance-history','reviewer','unit-session',1,'unit-message',new Date().toISOString(),0);
 assert.throws(()=>s.checkReleaseGate(run.runId,gate,'请提供分类依据'),/查看/);s.markViewed(run.runId,'finance-history');
 assert.throws(()=>s.checkReleaseGate(run.runId,gate,'所有资料都给我'),/分类/);assert.doesNotThrow(()=>s.checkReleaseGate(run.runId,gate,'请给我分类复核依据'));
 installNext(s);const next=await s.upgrade(run.runId);assert.throws(()=>s.checkReleaseGate(next.runId,gate,'请提供分类依据'),/查看/);
});
test('Archived report HTTP stays readable but archived writes and ungranted material remain rejected',async t=>{
 const s=fixture(t),old=await s.start('finance');s.store.exec('INSERT INTO reports VALUES(?,?,?,?,?,?,?,?,?)','r',old.runId,1,'completed','{}','保存的旧报告',null,null,new Date().toISOString());installNext(s);await s.upgrade(old.runId);
 const server=createServer(createApiHandler(s));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>{server.close();server.closeAllConnections();});const base=`http://127.0.0.1:${server.address().port}/api/fde-discovery-lab/runs/${old.runId}`;
 const report=await fetch(base+'/reports/r/export?format=md');assert.equal(report.status,200);assert.equal(await report.text(),'保存的旧报告');
 assert.equal((await fetch(base+'/assets/finance-history')).status,403);
 assert.equal((await fetch(base+'/reports',{method:'POST',headers:{'content-type':'application/json'},body:'{}'})).status,409);
});
test('Version prompts do not offer downgrades',()=>{assert.equal(newerVersion('1.1.0','1.0.0'),true);assert.equal(newerVersion('1.0.0','1.1.0'),false);assert.equal(newerVersion('1.1.0','1.1.0'),false);});
test('Deepening reports admit cited problem narrative before computed baselines, without loosening legacy reports or source checks',async()=>{
 const {compileReport}=await import('../src/vendor/reports.js');
 const sections=['原始诉求与调查范围','业务背景与组织职责','现状流程与协作关系','数据系统与企业条件','问题量化与基线','AI价值分析与推荐方向','证据索引与数据字典'];
 const paragraph='原件说明业务仍待有权岗位确认，材料存在不等于承担决定已经作出。'.repeat(3)+'[证据:source]';
 const draft=sections.map(s=>`## ${s}\n\n${paragraph}${s==='问题量化与基线'?'\n\n{{QUANTITATIVE_BASELINE}}':''}`).join('\n\n');
 const c={report:{sections,allowQuantitativeNarrative:true},calculations:[],roles:[],assets:[]},ev=[{id:'source',kind:'asset',text:'原件说明业务仍待有权岗位确认，材料存在不等于承担决定已经作出。'}];
 assert.match(compileReport(draft,c,ev,[],'r'),/业务仍待有权岗位确认/);
 assert.throws(()=>compileReport(draft,{...c,report:{sections}},ev,[],'r'),/仅包含/);
 assert.throws(()=>compileReport(draft.replace(paragraph,paragraph+' 999笔'),c,ev,[],'r'),/数值/);
 assert.throws(()=>compileReport(draft.replace('原件说明','已批准[证据:unknown]'),c,ev,[],'r'),/不存在/);
});
test('Role lookup keeps the authorized catalog separate from the four retrieved facts and does not grant documents',async t=>{
 const s=fixture(t),run=await s.start('finance'),c=s.caseFor(s.store.run(run.runId)),role=c.roles.find(r=>r.id==='employee');
 const lookup=s.roleTools(s.store.run(run.runId),c,role).find(t=>t.name==='lookupRoleFacts');
 const result=await lookup.execute({query:'本人C001准备材料'},{signal:new AbortController().signal});
 assert.ok(result.facts.length<=4);assert.ok(result.availableAssets.some(a=>a.assetId==='FIN-DEEP-016'));
 assert.deepEqual(result.availableAssets.map(a=>a.assetId).sort(),c.assets.filter(a=>role.assetIds.includes(a.id)&&a.roleIds.includes(role.id)).map(a=>a.id).sort());
 assert.equal(s.store.all('SELECT * FROM grants WHERE run_id=?',run.runId).length,0);
 assert.match(result.assetScope,/不是完整资料目录/);
});
