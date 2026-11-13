"""Fixed internal-service snapshot calculations; stdlib, grant-gated originals only.
No model output, teacher baseline, arbitrary code or inferred business success.
"""
from pathlib import Path
from datetime import datetime, timedelta, timezone
from collections import Counter, defaultdict
from decimal import Decimal, InvalidOperation
import csv, hashlib, io, statistics

ROOT = Path(__file__).resolve().parents[1]
CASE_ID = 'internal-service'
TZ = timezone(timedelta(hours=8))
INPUTS = {
    'internal_service_workload': ['internal-service-history', 'internal-service-events', 'internal-service-export'],
    'internal_service_elapsed': ['internal-service-history', 'internal-service-events', 'internal-service-current', 'internal-service-export', 'internal-service-organization'],
    'internal_service_closure': ['internal-service-history', 'internal-service-events', 'internal-service-current', 'internal-service-export', 'internal-service-k03'],
}
COLUMNS = {
    'history': ['request_id','requester_id','channel','topic','original_request','recorded_category','created_at','first_reply_at','closed_at','handler_id','active_minutes','transfer_count','followup_count','referenced_document','document_version','closing_status','closing_note'],
    'events': ['event_id','request_id','event_at','actor_id','action','content'],
    'current': ['request_id','user_id','project_id','original_request','status','related_document','referenced_version'],
}
STATUS_RULES = {
    '已解决': ('explanation_obtained', '请求人确认已获得当前可用说明'),
    '已解释状态': ('explanation_obtained', '请求人确认已获得当前可用说明'),
    '已升级后恢复': ('restoration_recorded', '请求人确认已获得当前可用说明'),
    '已转交并关闭': ('registered_or_handed_off', '事项已登记/转交，后续状态另跟踪'),
    '已登记并关闭': ('registered_or_handed_off', '事项已登记/转交，后续状态另跟踪'),
    '已给说明并关闭': ('registered_or_handed_off', '事项已登记/转交，后续状态另跟踪'),
}

def require(condition, message):
    if not condition: raise ValueError(message)

def timestamp(value):
    require(isinstance(value,str) and bool(value), 'Missing timestamp')
    try: result=datetime.fromisoformat(value)
    except ValueError as error: raise ValueError('Invalid source timestamp') from error
    if result.tzinfo is None: result=result.replace(tzinfo=TZ)
    require(result.utcoffset()==timedelta(hours=8),'Unexpected source timezone')
    return result

def number(value, integer=False):
    try: result=Decimal(str(value))
    except InvalidOperation as error: raise ValueError('Invalid source number') from error
    require(result.is_finite() and result>=0,'Source number must be finite and nonnegative')
    if integer: require(result==result.to_integral_value(),'Count must be an integer')
    return int(result) if integer else float(result)

def csv_rows(data, kind):
    reader=csv.DictReader(io.StringIO(data.decode('utf-8-sig')))
    require(reader.fieldnames==COLUMNS[kind], 'Unexpected CSV columns: '+kind)
    rows=list(reader)
    require(all(None not in r and all(v is not None for v in r.values()) for r in rows),'CSV row width mismatch')
    key='event_id' if kind=='events' else 'request_id'
    require(len({r[key] for r in rows})==len(rows),'Duplicate source identity: '+kind)
    require(all(r[key] for r in rows),'Empty source identity')
    return rows

def validate_rows(history, events, current):
    require(history, 'No historical sample')
    by=defaultdict(list)
    ids={r['request_id'] for r in history}
    for e in events:
        require(e['request_id'] in ids,'Orphan event')
        by[e['request_id']].append(e)
    for row in history:
        require(row['request_id'].startswith('H'),'Historical identity must use H')
        start=timestamp(row['created_at'])
        require('2026-08-10'<=start.date().isoformat()<='2026-09-02','Request outside declared registration window')
        for key in ['active_minutes','followup_count','transfer_count']: number(row[key],integer=key!='active_minutes')
        stages=[('发起','created_at'),('首次回应','first_reply_at'),(row['closing_status'],'closed_at')]
        own=by[row['request_id']]
        require(len(own)==sum(bool(row[col]) for _,col in stages),'Event count does not match recorded stages')
        previous=start
        for action,col in stages:
            matches=[e for e in own if e['action']==action]
            if not row[col]:
                require(not matches,'Event contradicts missing stage time');continue
            require(len(matches)==1,'Missing or duplicate stage event')
            at=timestamp(row[col]);require(timestamp(matches[0]['event_at'])==at,'Request/event timestamp conflict')
            require(at>=previous,'Non-monotonic request stages');previous=at
            require(at<=timestamp('2026-09-10T09:00:00+08:00'),'Event after case snapshot')
        require(row['closing_status'] in STATUS_RULES or not row['closed_at'],'Unknown closing status')
    require(all(r['request_id'].startswith('C') and r['request_id'] not in ids for r in current),'Current items must be a separate C cohort')
    return by

def mean(values): return round(statistics.mean(values),6) if values else None

def regular_non_duty_overlap(start,end):
    """Known Mon-Fri 09:00-18:00 baseline only; not a statutory work calendar."""
    require(end>=start,'Negative elapsed interval')
    total=(end-start).total_seconds();overlap=0.0
    day=start.replace(hour=0,minute=0,second=0,microsecond=0)
    while day<end:
        if day.weekday()<5:
            left=max(start,day+timedelta(hours=9));right=min(end,day+timedelta(hours=18))
            if right>left: overlap+=(right-left).total_seconds()
        day+=timedelta(days=1)
    return total-overlap>0.000001

def workload(history,events):
    detail=[]
    for r in history:
        detail.append({'requestId':r['request_id'],'recordedCategory':r['recorded_category'],'handlerId':r['handler_id'],
                       'followupCount':number(r['followup_count'],True),'transferCount':number(r['transfer_count'],True),'activeMinutesEstimate':number(r['active_minutes'])})
    def grouped(key):
        groups=defaultdict(list)
        for r in detail:groups[r[key]].append(r)
        return {g:{'requests':len(rs),'followupCount':sum(r['followupCount'] for r in rs),'transferCount':sum(r['transferCount'] for r in rs),'activeMinutesEstimate':sum(r['activeMinutesEstimate'] for r in rs)} for g,rs in sorted(groups.items())}
    n=len(detail);active=sum(r['activeMinutesEstimate'] for r in detail);follow=sum(r['followupCount'] for r in detail);transfer=sum(r['transferCount'] for r in detail)
    return {'summary':f'{n}条研究请求；轮值估计主动投入{active:g}分钟，追问{follow}次、转交{transfer}次。',
            'numerator':{'activeMinutesEstimate':active,'followupCount':follow,'transferCount':transfer},'denominator':{'requests':n,'eventsExcludedAsDenominator':len(events)},
            'sampleCount':n,'activeMinutesTotal':active,'activeMinutesMean':mean([r['activeMinutesEstimate'] for r in detail]),
            'requestsWithFollowup':sum(r['followupCount']>0 for r in detail),'requestsWithTransfer':sum(r['transferCount']>0 for r in detail),
            'followupCountTotal':follow,'transferCountTotal':transfer,'unit':'次；轮值估计主动分钟；条请求',
            'detail':{'byRecordedCategory':grouped('recordedCategory'),'byHandler':grouped('handlerId'),'requests':detail},
            'limitation':'按recorded_category原分类统计，不把类别视为已证实根因。active_minutes只含轮值事后估计的本人操作，未含申请人或其他部门人工；720事件不是720独立请求。均衡教学样本不外推全公司发生率、年成本或AI收益。'}

def elapsed(history,events,current):
    details=[];response=[];closed=[];missing_response=[];unclosed=[]
    for r in history:
        start=timestamp(r['created_at']);first=timestamp(r['first_reply_at']) if r['first_reply_at'] else None;end=timestamp(r['closed_at']) if r['closed_at'] else None
        first_min=(first-start).total_seconds()/60 if first else None;closed_min=(end-start).total_seconds()/60 if end else None
        if first is None:missing_response.append(r['request_id'])
        else:response.append(first_min)
        if end is None:unclosed.append(r['request_id'])
        else:closed.append(closed_min)
        details.append({'requestId':r['request_id'],'createdAt':r['created_at'],'firstReplyAt':r['first_reply_at'] or None,'closedAt':r['closed_at'] or None,
                        'firstResponseNaturalMinutes':first_min,'closureNaturalMinutes':closed_min,
                        'responseCrossesKnownNonDuty':regular_non_duty_overlap(start,first) if first else None,
                        'closureCrossesKnownNonDuty':regular_non_duty_overlap(start,end) if end else None,
                        'sourceEventIds':[e['event_id'] for e in events if e['request_id']==r['request_id']]})
    crosses=sum(r['closureCrossesKnownNonDuty'] is True for r in details)
    return {'summary':f'历史首次响应均值{mean(response)}自然分钟；关闭均值{mean(closed)}自然分钟；{crosses}条关闭区间跨已知非值班时段，当前{len(current)}项未完事项单列。',
            'numerator':{'responseNaturalMinutesTotal':sum(response),'closureNaturalMinutesTotal':sum(closed)},
            'denominator':{'responseTimestampComplete':len(response),'closureTimestampComplete':len(closed)},'unit':'自然分钟；条请求',
            'firstResponseNaturalMinutesMean':mean(response),'closureNaturalMinutesMean':mean(closed),
            'responseCrossesKnownNonDutyCount':sum(r['responseCrossesKnownNonDuty'] is True for r in details),'closureCrossesKnownNonDutyCount':crosses,
            'workingTimeMinutes':None,'workingCalendarSufficient':False,
            'detail':{'requests':details,'historicalMissingFirstResponse':missing_response,'historicalUnclosed':unclosed,
                      'currentUnfinished':[{'requestId':r['request_id'],'status':r['status'],'naturalElapsedMinutes':None,'reason':'当前表没有created_at/closed_at，不能估算自然历时或当作0'} for r in current]},
            'limitation':'仅计算Asia/Shanghai自然历时。组织只给工作日09:00—18:00常规值班，未给完整节假日/调休日历；非值班标记据周末及常规夜间识别，不输出工作时间/SLA口径。当前C事项单列且时间缺失不填0，等待不能等同可节省人工。'}

def closure(history,by,current):
    statuses=Counter();semantics=Counter();rows=[];representatives={};unclosed=[]
    for r in history:
        if not r['closed_at']:unclosed.append(r['request_id']);continue
        status=r['closing_status'];category,needle=STATUS_RULES[status]
        last=[e for e in by[r['request_id']] if e['action']==status]
        require(len(last)==1 and needle in last[0]['content'],'Closing label/event outcome conflict')
        require('关闭表示本轮服务结束；登记与转交不代表下游业务已完成' == r['closing_note'], 'Closing note semantics conflict')
        statuses[status]+=1;semantics[category]+=1
        record={'requestId':r['request_id'],'recordedCategory':r['recorded_category'],'closingStatus':status,'closingNote':r['closing_note'],
                'serviceEvidenceClass':category,'downstreamBusinessOperationOutcome':'unknown',
                'eventId':last[0]['event_id'],'eventAction':last[0]['action'],'eventQuote':last[0]['content']}
        rows.append(record);representatives.setdefault(status,record)
    n=len(rows)
    return {'summary':f'{n}条历史服务已关闭；其中登记/转交等{semantics["registered_or_handed_off"]}条、标称升级恢复{semantics["restoration_recorded"]}条；关闭率不能替代业务办成率。',
            'numerator':{'closedServiceRequests':n,'explanationObtained':semantics['explanation_obtained'],'registeredOrHandedOff':semantics['registered_or_handed_off'],'restorationRecorded':semantics['restoration_recorded']},
            'denominator':{'historicalRequests':len(history),'currentItemsExcluded':len(current)},'unit':'条请求；服务状态',
            'closingStatusCounts':dict(sorted(statuses.items())),'serviceEvidenceClassCounts':dict(semantics),
            'downstreamOperationOutcomeCounts':{'confirmed_complete':0,'confirmed_failed':0,'unknown':n},'businessResolvedRate':None,
            'detail':{'mappingRules':{status:{'serviceEvidenceClass':value[0],'requiredEventPhrase':value[1]} for status,value in STATUS_RULES.items()},
                      'representatives':list(representatives.values()),'requests':rows,'historicalUnclosed':unclosed,
                      'currentUnfinished':[{'requestId':r['request_id'],'status':r['status'],'businessOutcome':'unknown'} for r in current]},
            'limitation':'逐请求同时核对关闭标签、closing_note和关闭事件；不以closed_at非空推算业务解决。已解决/已解释状态可证明取得说明，已升级后恢复仅记录标称恢复；都不证明后续导出、访问批准或开发完成。unknown表示没有完整下游完成证据，不等于失败，也不否认说明服务已完成。当前C事项不混入历史分母。'}

def calculate(case,operation,grants):
    require(isinstance(case,dict) and case.get('id')==CASE_ID and case.get('schemaVersion')==1,'Unsupported case')
    require(operation in INPUTS,'Unsupported fixed operation')
    require(isinstance(grants,list) and all(isinstance(g,str) for g in grants),'Invalid grant list')
    definitions=[d for d in case.get('calculations',[]) if d.get('operation')==operation]
    require(len(definitions)==1,'Unknown or duplicate calculation')
    definition=definitions[0]
    require(definition.get('inputs')==INPUTS[operation],'Unexpected fixed input manifest')
    require(definition.get('requiresAllInputsGranted') is True and definition.get('allowArbitraryCode') is False,'Unsafe calculation flags')
    missing=set(INPUTS[operation])-set(grants)
    if missing:raise PermissionError('Required inputs have not been obtained: '+','.join(sorted(missing)))
    loaded={};metadata={};base=(ROOT/'source-materials'/CASE_ID).resolve()
    # Validate every grant/manifest/path before opening source contents.
    paths=[]
    for aid in INPUTS[operation]:
        matches=[x for x in case.get('assets',[]) if x.get('id')==aid];require(len(matches)==1,'Unknown or duplicate asset')
        asset=matches[0];rel=Path(asset['path'])
        if rel.is_absolute() or '..' in rel.parts:raise PermissionError('Invalid source path')
        path=(ROOT/rel).resolve()
        if not path.is_relative_to(base) or any(part in ['教师核对','后续演练','研发'] for part in path.parts) or path.name=='04-岗位初访.md':raise PermissionError('Privileged or outside source')
        require(path.is_file() and path.stat().st_size<=5_000_000,'Input unavailable or too large')
        paths.append((aid,asset,path))
    for aid,asset,path in paths:
        data=path.read_bytes();require(len(data)==asset['sizeBytes'] and hashlib.sha256(data).hexdigest()==asset['sha256'],'Input source version mismatch')
        loaded[aid]=data;metadata[aid]={'path':asset['path'],'version':asset['version'],'sha256':asset['sha256']}
    history=csv_rows(loaded['internal-service-history'],'history');events=csv_rows(loaded['internal-service-events'],'events')
    current=csv_rows(loaded['internal-service-current'],'current') if 'internal-service-current' in loaded else []
    by=validate_rows(history,events,current)
    result=workload(history,events) if operation=='internal_service_workload' else elapsed(history,events,current) if operation=='internal_service_elapsed' else closure(history,by,current)
    if operation=='internal_service_workload':
        result['reportLines']=[
            f"研究范围为{len(history)}条H编号请求、{len(events)}条事件；事件不是独立请求，按原recorded_category分组，不解释为根因。",
            f"原台账追问合计{result['followupCountTotal']}次，涉及{result['requestsWithFollowup']}条请求；转交合计{result['transferCountTotal']}次，涉及{result['requestsWithTransfer']}条请求；请求分母均为{len(history)}条。",
            f"轮值事后估计主动投入合计{result['activeMinutesTotal']:g}分钟，请求均值{result['activeMinutesMean']:g}分钟；不含申请人和其他部门人工，不含自然等待，不外推年度成本或AI收益。"]
    elif operation=='internal_service_elapsed':
        result['reportLines']=[
            f"首次响应自然历时合计{result['numerator']['responseNaturalMinutesTotal']:g}分钟、有效时间戳对{result['denominator']['responseTimestampComplete']}条、均值{result['firstResponseNaturalMinutesMean']}分钟；缺首次响应{len(result['detail']['historicalMissingFirstResponse'])}条。",
            f"关闭自然历时合计{result['numerator']['closureNaturalMinutesTotal']:g}分钟、有效时间戳对{result['denominator']['closureTimestampComplete']}条、均值{result['closureNaturalMinutesMean']}分钟；历史未关闭{len(result['detail']['historicalUnclosed'])}条。",
            f"首次响应跨已知非值班时段{result['responseCrossesKnownNonDutyCount']}条，关闭跨已知非值班时段{result['closureCrossesKnownNonDutyCount']}条；仅按周一至周五09:00—18:00常规值班标记，缺完整节假日调休日历，不计算工作时间或SLA。",
            f"当前C事项{len(current)}条另列；该表无起止时间戳，自然历时未知，不补0、不混入历史分母，等待不等于可节省人工。"]
    else:
        counts=result['numerator']
        result['reportLines']=[
            f"历史分母{len(history)}条请求，已关闭服务{counts['closedServiceRequests']}条；关闭状态原标签分布："+'；'.join(f'{k}{v}条' for k,v in result['closingStatusCounts'].items())+'。',
            f"逐条核对关闭标签、关闭说明与事件，取得当前说明{counts['explanationObtained']}条，登记或转交等{counts['registeredOrHandedOff']}条，标称升级恢复{counts['restorationRecorded']}条。",
            f"下游业务操作完成证据：确定完成0条、确定失败0条、未知{result['downstreamOperationOutcomeCounts']['unknown']}条；未知不等于失败，也不否认说明服务已完成，不能推算业务办成率。",
            f"当前未完C事项{len(current)}条单列，保留原状态，不纳入历史分母。"]
    result['reportLines'].append('样本注册范围2026-08-10至2026-09-02，快照2026-09-10 09:00，Asia/Shanghai；均衡覆盖教学研究样本，不代表全公司总体。')
    result.update(scope={'caseId':CASE_ID,'cohort':'H编号均衡覆盖教学研究样本','historicalRequestCount':len(history),'historicalEventRows':len(events),'currentCItemsSeparate':len(current) if 'internal-service-current' in loaded else None,'currentInputRead':'internal-service-current' in loaded,'currentScopeNote':'C事项单列，未混入H分母' if 'internal-service-current' in loaded else '本项未读取current输入，不据此报告当前事项数量','notCompanyPopulation':True},
                  time={'snapshot':case['snapshot'],'timezone':'Asia/Shanghai','registeredFrom':'2026-08-10','registeredThrough':'2026-09-02','firstCreatedAt':min(r['created_at'] for r in history),'lastCreatedAt':max(r['created_at'] for r in history),'calendarComplete':False},
                  filter={'cohortPrefix':'H','registrationDateInclusive':['2026-08-10','2026-09-02'],'uniqueKey':'request_id','categoryField':'recorded_category','currentItemsExcludedFromHistoricalDenominator':True},inputs=metadata)
    return {'calculationId':definition['id'],'version':definition['version'],'inputAssetIds':definition['inputs'],'inputHashes':{aid:m['sha256'] for aid,m in metadata.items()},'result':result}
