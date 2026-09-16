import { join } from 'node:path';
import { now, uid } from './store.js';
import { pythonJSON } from './python.js';

// Keep full reproducible rows in analyses/UI; model evidence receives program-authored
// report facts plus input hashes instead of thousands of duplicate raw rows.
export function calculationEvidence(calculation){
  const r=calculation.result;
  if(!Array.isArray(r.reportLines))return calculation;
  const keys=['summary','reportLines','scope','snapshot','timeRange','filter','numerator','denominator','unit','formula','limitation','limitations','metadata'];
  return {...calculation,result:Object.fromEntries(keys.filter(k=>r[k]!==undefined).map(k=>[k,r[k]]))};
}
export async function calculateMetric(service,runId,metricId) {
  const run=service.requireLive(runId), c=service.caseFor(run), definition=c.calculations.find(x=>x.id===metricId);
  if(!definition)throw Object.assign(new Error('指标不存在'),{status:404});
  const grants=service.store.all('SELECT asset_id FROM grants WHERE run_id=?',runId).map(x=>x.asset_id);
  for(const id of definition.inputs)service.grant(runId,id);
  // Fixed module + enum only. Neither the NPC nor caller can supply executable code.
  const calculation=await pythonJSON(join(service.root,'cases/calculate_reference.py'),'calculate',{case:c,id:definition.operation,grants});
  if(!service.store.live(runId,run.generation))throw new Error('训练轮次已更新');
  const r=calculation.result;
  const summary=r.summary ?? r.ratePercent ?? r.totalMeanHours ?? (r.employeeMeanMinutes!==undefined?`员工准备 ${r.employeeMeanMinutes}；财务主动处理 ${r.financeMeanMinutes}`:r.countsByMonth?Object.entries(r.countsByMonth).map(([month,count])=>`${month}: ${count}单`).join(' / '):r.totalMeanMinutes!==undefined?r.totalMeanMinutes:`${r.parts?.length || 0}种配件，逐项可承诺量见计算明细`);
  const result={value:summary,numerator:r.returnedClaims,denominator:r.totalClaims,formula:definition.definition,filters:JSON.stringify(definition.filter),calculatedAt:now(),details:r,inputHashes:calculation.inputHashes};
  service.store.exec('INSERT OR REPLACE INTO analyses VALUES(?,?,?)',runId,metricId,JSON.stringify(result));
  const id=`metric-${runId}-${metricId}`;
  service.store.exec('INSERT OR REPLACE INTO evidence VALUES(?,?,?,?,?,?,?,?,?,?)',id,runId,'calculation',null,null,null,null,'calculation',`${definition.title}\n${JSON.stringify(calculationEvidence(calculation))}\n口径：${definition.definition}`,now());
  service.store.touch(runId);
  return {...service.metricView(runId,definition),...result};
}
