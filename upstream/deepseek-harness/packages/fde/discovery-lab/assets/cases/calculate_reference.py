"""Deterministic calculation reference. Runtime implementations must retain the grant gate.
No model, teacher answers, arbitrary expressions, or dynamically executed SQL/code.
"""
from pathlib import Path
from datetime import datetime
from collections import defaultdict, Counter
import csv,json,statistics,hashlib,runpy
ROOT=Path(__file__).resolve().parents[1]

EXTENSIONS = {
 'finance_budget_composition':'calculations_finance_deepening.py',
 'finance_version_payment':'calculations_finance_deepening.py',
 'finance_issue_history':'calculations_finance_deepening.py',
 'operations_weekly_channel_conversion':'calculations_operations.py',
 'operations_analysis_work':'calculations_operations.py',
 'operations_refund_cohort_d7':'calculations_operations.py',
 'internal_service_workload':'calculations_internal_service.py',
 'internal_service_elapsed':'calculations_internal_service.py',
 'internal_service_closure':'calculations_internal_service.py',
 'logistics_stock':'calculations_logistics.py',
 'logistics_fulfillment':'calculations_logistics.py',
 'logistics_collaboration':'calculations_logistics.py',
}
def calculate(case, operation, granted_asset_ids):
    if operation in EXTENSIONS:
        return runpy.run_path(str(ROOT/'cases'/EXTENSIONS[operation]))['calculate'](case,operation,granted_asset_ids)
    definitions=[x for x in case['calculations'] if x['operation']==operation]
    if len(definitions)!=1: raise ValueError('unknown calculation operation')
    definition=definitions[0]
    missing=set(definition['inputs'])-set(granted_asset_ids)
    if missing: raise PermissionError('Required inputs have not been obtained: '+','.join(sorted(missing)))
    index={a['id']:a for a in case['assets']}
    def rows(suffix):
        aid=case['id']+'-'+suffix
        if aid not in definition['inputs']: raise PermissionError('Input not declared by calculation')
        a=index[aid];p=(ROOT/a['path']).resolve()
        if not p.is_relative_to(ROOT/'source-materials'/case['id']): raise PermissionError('Outside case source')
        if hashlib.sha256(p.read_bytes()).hexdigest()!=a['sha256']:raise ValueError('Input version checksum mismatch')
        return list(csv.DictReader(p.open(encoding='utf-8-sig',newline='')))
    def mean(values):
        if not values:raise ValueError('No valid records')
        return round(statistics.mean(values),6)
    if operation=='finance_return_rate':
        claims=rows('history');events=rows('history-events')
        eligible={r['claim_id'] for r in claims if '2026-06-01'<=r['first_submitted_at'][:10]<='2026-08-31'}
        if len(eligible)!=len(claims):raise ValueError('Queue contains duplicates or records outside declared window')
        returned={r['claim_id'] for r in events if r['state']=='RETURNED' and r['claim_id'] in eligible}
        result={'returnedClaims':len(returned),'totalClaims':len(eligible),'ratePercent':round(len(returned)/len(eligible)*100,6),'unit':'%','warning':'主要原因不是全部因果标签；重复退回不重复算单。'}
    elif operation=='finance_stage_hours':
        claims=rows('history');events=rows('history-events');by=defaultdict(list)
        for e in events:by[e['claim_id']].append(e)
        keys=['SUBMITTED','REVIEW_STARTED','FINANCE_PASSED','APPROVED','PAID']
        values=[[],[],[],[]];totals=[];missing=[]
        for claim in claims:
            samples=[]
            for i,state in enumerate(keys):
                candidates=[datetime.fromisoformat(e['at']) for e in by[claim['claim_id']] if e['state']==state]
                if not candidates:break
                samples.append(min(candidates) if i<2 else max(candidates))
            if len(samples)!=5: missing.append(claim['claim_id']);continue
            if samples!=sorted(samples): raise ValueError('Non-monotonic business stages')
            for i in range(4): values[i].append((samples[i+1]-samples[i]).total_seconds()/3600)
            totals.append((samples[4]-samples[0]).total_seconds()/3600)
        result={'sampleCount':len(totals),'missingClaimIds':missing,'stageMeanHours':dict(zip(['待开始审核','审核含补件','待最终审批','待成功支付'],map(mean,values))),'totalMeanHours':mean(totals),'unit':'日历小时','warning':'周末夜晚属于日历等待，不是主动工时；補件不重复叠加。'}
    elif operation=='finance_active_minutes':
        data=rows('times')
        if any(r['includes_waiting']!='否' for r in data):raise ValueError('Convenience sample unexpectedly includes waiting')
        result={'sampleCount':len(data),'employeeMeanMinutes':mean([float(r['employee_preparation_minutes']) for r in data]),'financeMeanMinutes':mean([float(r['finance_active_minutes']) for r in data]),'unit':'分钟','warning':'便利抽样，不外推全院年收益或人力节约。'}
    elif operation=='manufacturing_monthly':
        data=rows('history');scopes=rows('scope')
        if len({r['ticket_id'] for r in data})!=len(data):raise ValueError('Duplicate ticket IDs')
        counts=Counter(r['opened_at'][:7] for r in data)
        if any(int(r['当月服务单量'])!=counts[r['月份']] for r in scopes):raise ValueError('Monthly scope cross-check mismatch')
        result={'sampleCount':len(data),'countsByMonth':dict(sorted(counts.items())),'augustVsJuneGrowthPercent':round((counts['2026-08']/counts['2026-06']-1)*100,6),'unit':'单 / %','warning':'服务单并非都为故障；月末设备数不是设备暴露天数。'}
    elif operation=='manufacturing_stage_minutes':
        data=rows('history');cols=['first_response_min','取证_min','等待_min','实际处理_min','等待确认_min']
        for r in data:
            if r['状态']!='已关闭':raise ValueError('Unclosed record in historical queue')
            if abs(sum(float(r[c]) for c in cols)-float(r['全过程_min']))>0.001:raise ValueError('Stage sum mismatch: '+r['ticket_id'])
        result={'sampleCount':len(data),'stageMeanMinutes':{c:mean([float(r[c]) for r in data]) for c in cols},'totalMeanMinutes':mean([float(r['全过程_min']) for r in data]),'seniorMeanMinutes':mean([float(r['资深介入_min']) for r in data]),'followupMeanRounds':mean([float(r['补问轮数']) for r in data]),'primaryWaitCounts':dict(Counter(r['主要等待类型'] for r in data)),'unit':'自然分钟；资深列为独立净投入','warning':'实际处理含协调观察；主要等待不代表全部因果，不能据此判定SLA违约。'}
    elif operation=='manufacturing_stock':
        stock=rows('stock');reservations=rows('reservations');reserved=defaultdict(float)
        for r in reservations:
            if r['状态']=='有效':reserved[r['part_id']]+=float(r['quantity'])
        output=[]
        for r in stock:
            qty=float(r['实物数量'])-reserved[r['part_id']]-float(r['隔离待检'])
            if qty!=float(r['可承诺数量']) or reserved[r['part_id']]!=float(r['已预留']):raise ValueError('Inventory cross-check mismatch: '+r['part_id'])
            output.append({'partId':r['part_id'],'physical':float(r['实物数量']),'reserved':reserved[r['part_id']],'quarantined':float(r['隔离待检']),'available':qty,'unit':r['单位']})
        result={'parts':output,'warning':'在途不计实物，历史耗用已含在快照中，不能再次扣减。'}
    else:raise ValueError('Unsupported operation')
    return {'calculationId':definition['id'],'version':definition['version'],'inputAssetIds':definition['inputs'],'inputHashes':{aid:index[aid]['sha256'] for aid in definition['inputs']},'result':result}

if __name__=='__main__':
    output=[]
    for case_id in sorted(p.parent.name for p in (ROOT/'cases').glob('*/case.json')):
        case=json.loads((ROOT/'cases'/case_id/'case.json').read_text())
        for definition in case['calculations']:
            try:calculate(case,definition['operation'],[])
            except PermissionError:pass
            else:raise AssertionError('Unauthorized calculation accepted')
            output.append(calculate(case,definition['operation'],definition['inputs']))
    p=ROOT/'evidence/cases/calculation-reference-results.json';p.write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'calculationCount':len(output),'authorizationNegativeChecks':len(output),'resultPath':str(p)},ensure_ascii=False))
