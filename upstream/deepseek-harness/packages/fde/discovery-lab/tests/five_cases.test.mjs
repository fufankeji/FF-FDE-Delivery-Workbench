import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {TrainingService} from '../src/vendor/training.js';
import {isRestrictedSource,loadCases} from '../src/vendor/cases.js';
import {calculationEvidence} from '../src/vendor/metrics.js';
import {quantitativeBaseline} from '../src/vendor/reports.js';
import {expandReportReferences,validateReport} from '../src/vendor/reports.js';
const root=join(dirname(fileURLToPath(import.meta.url)),'../.assets');
test('Bare report source labels expand to exact evidence while unknown labels and unsupported numbers are rejected',()=>{
 const references=[{id:'E001',sourceId:'original-1'}];
 assert.equal(expandReportReferences('事实[E001]、原件[证据:E001]',references),'事实[证据:original-1]、原件[证据:original-1]');
 assert.throws(()=>expandReportReferences('事实[E999]',references),/不存在/);
 const prose='已取得原件中的事实。'.repeat(45)+' 8件 [E001]';
 assert.throws(()=>validateReport(expandReportReferences(prose,references),[],[{id:'original-1',text:'原件记载2件'}]),/数值/);
});
test('An unrelated running interview does not block evaluation; the same role waits for its committed turn',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'fde-queue-'));const service=new TrainingService({on(){}},{root,dataDir:dir});
 t.after(()=>{service.store.close();rmSync(dir,{recursive:true,force:true});});
 service.native={messages:()=>[],events:()=>[]};
 const run=await service.start('logistics');
 service.active.set('unrelated/role',new Promise(()=>{}));
 service.queueEvaluation(run.runId,'buyer');
 await Promise.race([service.evaluationChain,new Promise((_,reject)=>{const timer=setTimeout(()=>reject(new Error('Unrelated interview blocked evaluation')),1500);timer.unref();})]);
 assert.equal(service.evaluations.size,0);
 const key=`${run.runId}/buyer`;service.active.set(key,new Promise(()=>{}));service.queueEvaluation(run.runId,'buyer');
 await new Promise(resolve=>setTimeout(resolve,30));assert.equal(service.evaluations.has(key),true);
 service.active.delete(key);await service.evaluationChain;assert.equal(service.evaluations.has(key),false);
});
test('New privileged directory names and mixed solution documents are never runtime originals',()=>{
 for(const p of ['研发与验证/expected.json','后续演练/a.json','教师核对/a.md','既有业务资产/开发验证/a.json','既有业务资产/业务规则/库存口径与补货方法.md','既有业务资产/操作模板/a.md','既有业务资产/业务全景与协作.md'])assert.equal(isRestrictedSource(p),true,p);
 for(const p of ['岗位摘录/访谈.md','初始业务材料/数据表/访问.csv','既有业务资产/业务原件/DOC09-专项预算与采购批复规则.md'])assert.equal(isRestrictedSource(p),false,p);
});
test('Five independent runs and public progress retain active version snapshots; one restart preserves others',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'fde-five-'));const service=new TrainingService({on(){}},{root,dataDir:dir});
 t.after(()=>{service.store.close();rmSync(dir,{recursive:true,force:true});});
 service.native={messages:()=>[],events:()=>[],cancelHelpers:async()=>{},dispose:async()=>{}};service.queueEvaluation=()=>{};
 const ids=['finance','manufacturing','operations','internal-service','logistics'];assert.deepEqual([...loadCases(root).keys()].sort(),[...ids].sort());
 const runs=await Promise.all(ids.map(id=>service.start(id)));assert.equal(new Set(runs.map(s=>s.runId)).size,5);
 for(const s of runs){assert.equal(s.progress.completed,0);assert.throws(()=>service.grant(s.runId,'finance-history'),/尚未取得/);}
 const old=runs.find(s=>s.caseId==='finance');service.cases.set('finance',{...service.cases.get('finance'),version:'future',title:'Future title'});
 assert.equal(service.list().find(c=>c.id==='finance').version,old.case.version);assert.equal(service.list().find(c=>c.id==='finance').progress.total,old.progress.total);
 const logistics=runs.find(s=>s.caseId==='logistics');const replacement=await service.restart(logistics.runId);assert.notEqual(replacement.runId,logistics.runId);
 for(const s of runs.filter(s=>s.caseId!=='logistics'))assert.equal(service.list().find(c=>c.id===s.caseId).currentRunId,s.runId);
});
test('Program-authored new case statistics enter reports while row-level reproductions stay outside model evidence',()=>{
 const calc={calculationId:'new-metric',version:'1',inputAssetIds:['source'],inputHashes:{source:'sha'},result:{summary:'样本',reportLines:['42件样本，126个事件。'],rows:[{raw:'large data'}],limitation:'关闭不是业务解决。'}};
 const view=calculationEvidence(calc);assert.equal(view.result.rows,undefined);assert.deepEqual(view.inputHashes,calc.inputHashes);assert.deepEqual(view.result.reportLines,calc.result.reportLines);
 const md=quantitativeBaseline({calculations:[{id:'new-metric',title:'样本',definition:'按请求计数'}]},[{metric_id:'new-metric',result:JSON.stringify({details:calc.result})}],'r');
 assert.match(md,/42件样本，126个事件。 \[证据:metric-r-new-metric\]/);assert.match(md,/关闭不是业务解决/);
});

test('Evaluator short labels preserve exact source identities without accepting mismatched quotes or unknown labels',async()=>{
 const {evaluationReferenceMap,expandEvaluationCandidate,validateCandidate}=await import('../src/vendor/evaluation.js');
 const rows=[{id:'long-native-record-1',kind:'interview',role_id:'buyer',session_id:'s',message_id:'m',text:'按规格和仓库核对原始记录。'},{id:'long-native-record-2',kind:'interview',role_id:'buyer',session_id:'s',message_id:'n',text:'操作分钟不包含消息等待。'}];const references=evaluationReferenceMap(rows);const evidence=new Map(rows.map(e=>[e.id,e]));const item={id:'d',roleId:'buyer',factIds:['f'],requiredAssetIds:[],evidencePolicy:{requiresCommittedAssistant:true}};
 const raw={itemId:'d',status:'completed',confirmedFactIds:['f'],evidenceRefs:['E002'],citations:[{evidenceId:'E002',quote:'操作分钟不包含消息等待。'}]};
 const candidate=expandEvaluationCandidate(raw,references);assert.deepEqual(candidate.evidenceRefs,['long-native-record-2']);assert.ok(validateCandidate(candidate,item,evidence,new Set(),new Map()));
 for(const label of ['E001','E999']){const bad=expandEvaluationCandidate({...raw,evidenceRefs:[label],citations:[{evidenceId:label,quote:'操作分钟不包含消息等待。'}]},references);assert.equal(validateCandidate(bad,item,evidence,new Set(),new Map()),null);}
});
