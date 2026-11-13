"""Closed operations calculations. Standard library; no source generators/teacher files/code eval."""
from pathlib import Path
from datetime import datetime,timedelta,date
from collections import defaultdict,Counter
import csv,hashlib,json,sys
ROOT=Path(__file__).resolve().parents[1]
OPS={'operations_weekly_channel_conversion','operations_analysis_work','operations_refund_cohort_d7'}

def require(ok,message):
    if not ok:raise ValueError(message)
def stamp(s):
    d=datetime.fromisoformat(s);require(d.utcoffset()==timedelta(hours=8),'Expected timezone +08:00');return d
def integer(x):
    require(isinstance(x,str) and x.isdigit(),'Expected non-negative integer');return int(x)
def unique(rows,key):
    out={r[key]:r for r in rows};require(all(out) and len(out)==len(rows),'Duplicate or empty '+key);return out
def ratio(a,b):return round(a/b*100,6) if b else None

def calculate(case,operation,grants):
    require(case.get('id')=='operations' and operation in OPS,'Unknown case or operation')
    defs=[d for d in case['calculations'] if d['operation']==operation];require(len(defs)==1,'Calculation definition must be unique')
    definition=defs[0];missing=set(definition['inputs'])-set(grants)
    if missing:raise PermissionError('Required inputs have not been obtained: '+','.join(sorted(missing)))
    index={a['id']:a for a in case['assets']};loaded={};hashes={}
    for aid in definition['inputs']:
        require(aid in index,'Unknown input asset');a=index[aid];p=(ROOT/a['path']).resolve()
        if not p.is_relative_to((ROOT/'source-materials/operations').resolve()) or any(x in str(p.relative_to(ROOT)) for x in ['研发','后续','教师']):raise PermissionError('Outside allowed operations source')
        b=p.read_bytes();sha=hashlib.sha256(b).hexdigest();require(sha==a['sha256'] and len(b)==a['sizeBytes'],'Input version checksum/size mismatch: '+aid);hashes[aid]=sha;loaded[aid]=b.decode('utf-8-sig')
    def rows(key):
        aid='operations-'+key
        if aid not in loaded:raise PermissionError('Input not declared: '+aid)
        return list(csv.DictReader(loaded[aid].splitlines()))
    filt=definition['filter'];start=date.fromisoformat(filt['startDate']);end=date.fromisoformat(filt['endExclusive']);asof=stamp(filt['dataAsOf']);require(start<end and asof.date()==end-timedelta(days=1),'Inconsistent complete data window')
    def week(day):
        d=date.fromisoformat(day);require(start<=d<end,'Date outside source window');return 'W'+str((d-start).days//7+1)
    def trade():
        orders=unique(rows('orders'),'order_id');payments=unique(rows('payments'),'payment_id');by=defaultdict(list)
        for p in payments.values():
            require(p['order_id'] in orders,'Payment has no order');o=orders[p['order_id']];dt=stamp(p['attempted_at']);require(stamp(o['created_at'])<=dt<=asof,'Payment timestamp outside order window');require(p['status'] in ['success','declined','timeout','pending'],'Unknown payment state');amount=integer(p['amount_fen']);require(p['status']=='success' or amount==0,'Unsuccessful attempt records money');by[p['order_id']].append(p)
        for oid,o in orders.items():
            require(o['currency']=='CNY' and o['is_test'] in ['0','1'],'Unsupported currency/test flag');created=stamp(o['created_at']);require(created.date().isoformat()==o['date'] and created<=asof,'Order date mismatch');week(o['date']);require(integer(o['gross_fen'])-integer(o['discount_fen'])==integer(o['payable_fen']),'Order payable arithmetic mismatch')
            require(o['financial_status'] in ['paid','partially_refunded','refunded','pending','unpaid'],'Unknown financial status')
            attempts=by[oid];require(len(attempts)==1,'Snapshot must contain one final checked attempt per order')
            successes=[p for p in attempts if p['status']=='success'];paid=bool(o['paid_at'])
            require(paid==bool(successes),'paid_at and successful attempt mismatch')
            if paid:
                dt=stamp(o['paid_at']);require(created<=dt<=asof,'Invalid paid_at');require(o['financial_status'] in ['paid','partially_refunded','refunded'] and o['order_status']=='confirmed','Paid order state mismatch');require(integer(successes[0]['amount_fen'])==integer(o['payable_fen']),'Payment amount mismatch')
            else:require(o['financial_status'] in ['pending','unpaid'] and o['order_status'] in ['open','canceled'],'Unpaid order state mismatch')
        return orders,payments
    metadata={'caseId':'operations','snapshotAt':case['snapshot'],'completeDataAsOf':filt['dataAsOf'],'dateRange':{'start':filt['startDate'],'endExclusive':filt['endExclusive']},'inputFiles':[{'assetId':aid,'path':index[aid]['path'],'version':index[aid]['version'],'sha256':hashes[aid]} for aid in definition['inputs']],'definition':definition['definition'],'denominator':definition['denominator'],'moneyStorage':'CNY integer fen; yuan = fen / 100','arbitraryCodeExecuted':False}
    if operation=='operations_weekly_channel_conversion':
        sessions=unique(rows('sessions'),'session_id');orders,payments=trade();channels=unique(rows('channels'),'channel_id');spends=rows('channel_spend');require(len({(r['date'],r['channel_id']) for r in spends})==len(spends),'Duplicate daily channel fee')
        groups=defaultdict(lambda:{'sessionIds':set(),'orderIds':set(),'paidOrderIds':set(),'paidSessionIds':set(),'paidGmvFen':0,'spendFen':0,'paymentErrorCounts':Counter()})
        for sid,s in sessions.items():
            require(s['channel_id'] in channels,'Unknown session channel');dt=stamp(s['started_at']);require(dt.date().isoformat()==s['date'] and dt<=asof,'Session timestamp mismatch');k=(week(s['date']),s['channel_id']);groups[k]['sessionIds'].add(sid)
            if s['order_id']:require(s['order_id'] in orders and orders[s['order_id']]['session_id']==sid,'Broken session order link')
        for oid,o in orders.items():
            require(o['session_id'] in sessions,'Order missing session');s=sessions[o['session_id']];require(s['order_id']==oid and s['user_id']==o['user_id'] and s['channel_id']==o['channel_id'],'Order association mismatch');require(s['date']==o['date'] and stamp(s['started_at'])<=stamp(o['created_at']),'Snapshot date/journey mismatch')
            g=groups[(week(s['date']),s['channel_id'])];g['orderIds'].add(oid)
            if o['paid_at'] and o['is_test']=='0':
                require(stamp(o['paid_at']).date().isoformat()==s['date'],'Cross-day payment requires explicit alternate definition');g['paidOrderIds'].add(oid);g['paidSessionIds'].add(s['session_id']);g['paidGmvFen']+=integer(o['payable_fen'])
        for r in spends:
            require(r['channel_id'] in channels,'Unknown spend channel');groups[(week(r['date']),r['channel_id'])]['spendFen']+=integer(r['spend_fen'])
        for p in payments.values():
            o=orders[p['order_id']];s=sessions[o['session_id']]
            if p['status']!='success':groups[(week(s['date']),s['channel_id'])]['paymentErrorCounts'][p['status']+':'+p['error_code']]+=1
        result_rows=[]
        for (w,ch),g in sorted(groups.items()):
            n=len(g['sessionIds']);paid=len(g['paidOrderIds']);result_rows.append({'week':w,'channelId':ch,'channelName':channels[ch]['channel_name'],'visits':n,'submittedOrders':len(g['orderIds']),'paidOrders':paid,'payingSessions':len(g['paidSessionIds']),'paidOrdersPerVisitPercent':ratio(paid,n),'payingSessionConversionPercent':ratio(len(g['paidSessionIds']),n),'paidGmvFen':g['paidGmvFen'],'paidGmvYuan':g['paidGmvFen']/100,'channelSpendFen':g['spendFen'],'channelSpendYuan':g['spendFen']/100,'paymentErrorCounts':dict(g['paymentErrorCounts']),'sourceSessionIds':sorted(g['sessionIds']),'sourceOrderIds':sorted(g['orderIds'])})
        totals=[]
        for w in sorted({r['week'] for r in result_rows}):
            rs=[r for r in result_rows if r['week']==w];v=sum(r['visits'] for r in rs);paid=sum(r['paidOrders'] for r in rs);totals.append({'week':w,'visits':v,'submittedOrders':sum(r['submittedOrders'] for r in rs),'paidOrders':paid,'conversionPercent':ratio(paid,v),'paidGmvFen':sum(r['paidGmvFen'] for r in rs),'spendFen':sum(r['channelSpendFen'] for r in rs)})
        original=unique(rows('weekly-values'),'period_id')
        for r in totals:
            q=original[r['week']];require(r['visits']==integer(q['sessions']) and r['paidOrders']==integer(q['paid_orders']) and r['paidGmvFen']==integer(q['paid_gmv_fen']) and r['spendFen']==integer(q['channel_cost_fen']),'Original weekly report cross-check mismatch')
        byweek={t['week']:t for t in totals};bykey={(r['week'],r['channelId']):r for r in result_rows};decomp=[]
        for previous,current in zip(totals,totals[1:]):
            for ch in channels:
                a=bykey[(previous['week'],ch)];b=bykey[(current['week'],ch)];wa=a['visits']/previous['visits'];wb=b['visits']/current['visits'];ra=a['paidOrders']/a['visits'];rb=b['paidOrders']/b['visits'];decomp.append({'fromWeek':previous['week'],'toWeek':current['week'],'channelId':ch,'paidOrderDelta':b['paidOrders']-a['paidOrders'],'mixContributionPercentagePoints':round((wb-wa)*ra*100,6),'withinChannelContributionPercentagePoints':round(wb*(rb-ra)*100,6),'formula':'ΔCVR = Σ((w_new-w_old)*r_old + w_new*(r_new-r_old)); descriptive identity, not causation'})
        result={'summary':'；'.join(f"{t['week']}访问{t['visits']}次、支付{t['paidOrders']}单、支付单/访问{t['conversionPercent']}%" for t in totals),'sampleCount':len(sessions),'submittedOrderCount':len(orders),'paidOrderCount':sum(bool(o['paid_at']) and o['is_test']=='0' for o in orders.values()),'rows':result_rows,'weeklyTotals':totals,'channelChangeDecomposition':decomp,'warning':'渠道结构分解不是因果；支付尝试错误不等于确定流失。会话非人数，订单非商品行；退款订单仍曾付款。费用先聚合，不计算利润、损失或AI收益。'}
    elif operation=='operations_analysis_work':
        data=rows('work');unique(data,'work_id');groups=defaultdict(list)
        for r in data:groups[r['request_id']].append(r)
        output=[]
        for req,rs in sorted(groups.items()):
            rs=sorted(rs,key=lambda r:r['started_at']);active=wait=0;reasons=defaultdict(lambda:{'workIds':[],'activeMinutes':0,'waitMinutes':0});last=None
            for r in rs:
                a=stamp(r['started_at']);b=stamp(r['ended_at']);require(a<=b<=asof,'Invalid activity timeline');require(last is None or a>=last,'Overlapping activity intervals');last=b;am=integer(r['active_minutes']);wm=integer(r['wait_minutes']);require(abs((b-a).total_seconds()/60-am-wm)<1e-9,'Activity elapsed != active + waiting');active+=am;wait+=wm;z=reasons[r['rework_reason']];z['workIds'].append(r['work_id']);z['activeMinutes']+=am;z['waitMinutes']+=wm
            elapsed=(stamp(rs[-1]['ended_at'])-stamp(rs[0]['started_at'])).total_seconds()/60
            output.append({'requestId':req,'activityCount':len(rs),'activeMinutes':active,'waitMinutes':wait,'loggedMinutes':active+wait,'elapsedMinutes':elapsed,'unloggedGapMinutes':elapsed-active-wait,'reworkReasons':dict(reasons),'sourceRows':rs})
        result={'summary':'；'.join(f"{r['requestId']}主动{r['activeMinutes']}分钟、等待{r['waitMinutes']}分钟、经过{r['elapsedMinutes']:g}分钟，未记录间隔{r['unloggedGapMinutes']:g}分钟" for r in output),'requestCount':len(output),'activityCount':len(data),'rows':output,'warning':'只有一次教学请求的8个活动，不是8个请求。会议计主动，等待可处理别事，不等于可全部节省人力；未证明迟到分析的销售损失。'}
    else:
        orders,payments=trade();refunds=unique(rows('refunds'),'refund_id');paid={oid:o for oid,o in orders.items() if o['paid_at'] and o['is_test']=='0'};by=defaultdict(list);success_total=defaultdict(int)
        for r in refunds.values():
            require(r['order_id'] in paid,'Refund without paid non-test order');o=paid[r['order_id']];requested=stamp(r['requested_at']);pdt=stamp(o['paid_at']);require(pdt<=requested<=asof,'Refund request chronology mismatch');require(r['status'] in ['succeeded','pending'] and r['refund_type'] in ['full','partial'],'Unknown refund state/type');amount=integer(r['refund_fen']);require(amount>0 and amount<=integer(o['payable_fen']),'Refund amount outside order')
            if r['status']=='succeeded':
                require(bool(r['processed_at']),'Successful refund missing processed_at');processed=stamp(r['processed_at']);require(requested<=processed<=asof,'Refund process chronology mismatch');success_total[r['order_id']]+=amount
            else:require(not r['processed_at'],'Pending refund has processed_at')
            by[r['order_id']].append(r)
        for oid,o in paid.items():
            amount=success_total[oid];require(amount<=integer(o['payable_fen']),'Refund total exceeds paid amount');expected='refunded' if amount==integer(o['payable_fen']) else ('partially_refunded' if amount else 'paid');require(o['financial_status']==expected,'Refund/order financial state mismatch')
        days=integer(str(filt['observationDays']));require(days==7,'Only fixed seven-day observation allowed');cohorts=defaultdict(lambda:{'orders':[],'mature':[],'immature':[]})
        for oid,o in paid.items():
            pdt=stamp(o['paid_at']);endobs=pdt+timedelta(days=days);g=cohorts[week(pdt.date().isoformat())];g['orders'].append(oid);g['mature' if endobs<=asof else 'immature'].append(oid)
        out=[];immature=[];detail=[]
        for w,g in sorted(cohorts.items()):
            mature=g['mature'];applications=[];success=[];pending=[];all_observed=[]
            for oid in mature:
                pdt=stamp(paid[oid]['paid_at']);deadline=pdt+timedelta(days=days)
                for r in by[oid]:
                    if stamp(r['requested_at'])<=deadline:
                        applications.append(r)
                        if r['status']=='succeeded' and stamp(r['processed_at'])<=deadline:success.append(r)
                        elif r['status']=='pending' or stamp(r['processed_at'])>deadline:pending.append(r)
                detail.append({'orderId':oid,'paidAt':paid[oid]['paid_at'],'observationEnd':deadline.isoformat(),'mature':True,'refundIds':[r['refund_id'] for r in by[oid]]})
            for oid in g['immature']:
                o=paid[oid];rr=by[oid];immature.append({'orderId':oid,'cohortWeek':w,'paidAt':o['paid_at'],'observationEnd':(stamp(o['paid_at'])+timedelta(days=days)).isoformat(),'observedHours':round((asof-stamp(o['paid_at'])).total_seconds()/3600,6),'observedApplicationCount':len(rr),'observedSuccessfulRefundFen':sum(integer(r['refund_fen']) for r in rr if r['status']=='succeeded'),'pendingApplicationCount':sum(r['status']=='pending' for r in rr),'includedInComparison':False})
            successful_orders={r['order_id'] for r in success};amount=sum(integer(r['refund_fen']) for r in success)
            out.append({'week':w,'paidOrders':len(g['orders']),'maturePaidOrders':len(mature),'immaturePaidOrders':len(g['immature']),'d7ApplicationCount':len(applications) if mature else None,'d7SuccessfulRefundApplicationCount':len(success) if mature else None,'d7SuccessfulRefundOrderCount':len(successful_orders) if mature else None,'d7SuccessfulRefundOrderRatePercent':ratio(len(successful_orders),len(mature)),'d7SuccessfulRefundFen':amount if mature else None,'d7SuccessfulRefundYuan':amount/100 if mature else None,'applicationsNotSucceededByD7':len(pending) if mature else None,'sourceMatureOrderIds':sorted(mature),'sourceSuccessfulRefundIds':[r['refund_id'] for r in success]})
        result={'summary':'；'.join((f"{r['week']}成熟{r['maturePaidOrders']}/{r['paidOrders']}单，七天成功退款{r['d7SuccessfulRefundOrderCount']}单、{r['d7SuccessfulRefundYuan']:.2f}元，未满窗{r['immaturePaidOrders']}单" if r['maturePaidOrders'] else f"{r['week']}全部{r['paidOrders']}单未满七天，成熟退款指标不适用") for r in out),'observationDays':days,'paidOrderCount':len(paid),'refundApplicationCount':len(refunds),'successfulRefundApplicationCount':sum(r['status']=='succeeded' for r in refunds.values()),'pendingRefundApplicationCount':sum(r['status']=='pending' for r in refunds.values()),'rows':out,'immatureOrders':immature,'matureOrderObservationDetails':detail,'warning':'按支付周成熟订单比较，不是退款处理周现金口径。申请数、成功订单数与金额不同；不满窗不记零退款。部分退款非整单退；缺退回件数不能算净销量，样本不能外推长期质量或AI收益。'}
    lines=[]
    if operation=='operations_weekly_channel_conversion':
        lines.append(f"统计窗口：{filt['startDate']}至{asof.date()}四个完整自然周；会话{len(sessions)}次、提交订单{len(orders)}笔、已付款订单{result['paidOrderCount']}笔。转化为支付订单/访问会话；本样本每会话最多一单且当日付款，与付款会话口径一致。")
        for r in result['weeklyTotals']:
            lines.append(f"{r['week']}：访问{r['visits']}次，提交{r['submittedOrders']}单，付款{r['paidOrders']}单，支付转化{r['conversionPercent']}%；付款成交额{r['paidGmvFen']/100:.2f}元，渠道费用{r['spendFen']/100:.2f}元。")
        for r in result['rows']:
            lines.append(f"{r['week']} / {r['channelName']}：访问{r['visits']}次，付款{r['paidOrders']}单，支付单/访问{r['paidOrdersPerVisitPercent']}%，付款会话/访问{r['payingSessionConversionPercent']}%；付款成交额{r['paidGmvYuan']:.2f}元，渠道费用{r['channelSpendYuan']:.2f}元。")
        for r in result['channelChangeDecomposition']:
            lines.append(f"{r['fromWeek']}→{r['toWeek']} / {channels[r['channelId']]['channel_name']}：付款订单变化{r['paidOrderDelta']:+d}笔；总转化变化中的渠道占比项{r['mixContributionPercentagePoints']:+.6f}个百分点，渠道内转化项{r['withinChannelContributionPercentagePoints']:+.6f}个百分点。")
        lines.append('结构分解采用旧周渠道转化固定的占比项加新周权重的渠道内项，是数学恒等式，不是因果证明；支付异常还需工程调查，不能把渠道订单差直接算成故障损失。')
    elif operation=='operations_analysis_work':
        for r in result['rows']:
            lines.append(f"请求{r['requestId']}共{r['activityCount']}条活动：主动操作{r['activeMinutes']}分钟、等待{r['waitMinutes']}分钟、日志合计{r['loggedMinutes']}分钟；首末自然经过{r['elapsedMinutes']:g}分钟，未记录间隔{r['unloggedGapMinutes']:g}分钟。")
            for reason,z in r['reworkReasons'].items():lines.append(f"{r['requestId']} / 记录原因“{reason}”：{len(z['workIds'])}条活动，主动{z['activeMinutes']}分钟，等待{z['waitMinutes']}分钟；记录ID {', '.join(z['workIds'])}。")
    else:
        lines.append(f"统一观察规则：按订单支付所属周分组，每单支付后{days}×24小时；完整数据截至{filt['dataAsOf']}。全样本已付款{len(paid)}单、退款申请{len(refunds)}条，其中成功处理{result['successfulRefundApplicationCount']}条、待处理{result['pendingRefundApplicationCount']}条，三种粒度不互作分母。")
        for r in result['rows']:
            if r['maturePaidOrders']:
                lines.append(f"{r['week']}：付款{r['paidOrders']}单，满七天观察{r['maturePaidOrders']}单，未满{r['immaturePaidOrders']}单；七天内申请{r['d7ApplicationCount']}条、成功处理{r['d7SuccessfulRefundApplicationCount']}条，涉及{r['d7SuccessfulRefundOrderCount']}个去重订单，成功退款订单/成熟订单{r['d7SuccessfulRefundOrderRatePercent']}%；成功金额{r['d7SuccessfulRefundYuan']:.2f}元，七天时仍未成功申请{r['applicationsNotSucceededByD7']}条。")
            else:lines.append(f"{r['week']}：付款{r['paidOrders']}单全部未满七天观察，成熟分母为0；退款率、七天成功金额及成功订单数不适用，不能记录为无退款。")
        lines.append(f"未成熟订单共{len(immature)}单，仅作截至水位的观察记录：已见申请{sum(x['observedApplicationCount'] for x in immature)}条、已成功金额{sum(x['observedSuccessfulRefundFen'] for x in immature)/100:.2f}元、待处理申请{sum(x['pendingApplicationCount'] for x in immature)}条；不与成熟队列七天指标直接比较。")
    lines.append(result['warning'])
    result['reportLines']=lines
    result['metadata']=metadata
    return {'calculationId':definition['id'],'version':definition['version'],'inputAssetIds':definition['inputs'],'inputHashes':hashes,'result':result}

if __name__=='__main__':
    payload=json.load(sys.stdin);case=payload.get('case') or json.loads((ROOT/'cases/operations/case.json').read_text());print(json.dumps(calculate(case,payload['operation'],payload.get('grants',[])),ensure_ascii=False))
