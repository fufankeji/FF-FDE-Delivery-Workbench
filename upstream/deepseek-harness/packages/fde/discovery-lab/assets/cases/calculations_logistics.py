# -*- coding: utf-8 -*-
"""Fixed logistics calculations over granted, hash-verified original rows."""
from pathlib import Path
from datetime import datetime,date,timedelta,timezone
from collections import defaultdict,Counter
import csv,json,hashlib,statistics
ROOT=Path(__file__).resolve().parents[1]
OPS={'logistics_stock','logistics_fulfillment','logistics_collaboration'}

def unique(rows,keys):
 ids=[tuple(r[k] for k in keys) for r in rows]
 if len(ids)!=len(set(ids)):raise ValueError('Duplicate business key: '+','.join(keys))

def quantity(value):
 n=int(value)
 if n<0:raise ValueError('Negative quantity')
 return n

def stock_check(stock,products,receipts,bridge,pos,shipments,freshness,snapshot):
 unique(stock,['warehouse_id','sku_id']);unique(products,['sku_id']);unique(receipts,['receipt_line_id']);unique(bridge,['entry_id']);unique(pos,['po_line_id']);unique(shipments,['shipment_id']);unique(freshness,['batch_id'])
 product_ids={r['sku_id'] for r in products};batches={r['batch_id']:r for r in freshness};output=[]
 for r in stock:
  if r['sku_id'] not in product_ids:raise ValueError('Unknown SKU')
  if r['warehouse_id'] not in {'W-KL','W-JB'}:raise ValueError('Unknown warehouse')
  p,v,q,a=[quantity(r[k]) for k in ['physical','reserved','quarantine','available']]
  if p-v-q!=a:raise ValueError('Snapshot available does not equal physical-reserved-quarantine')
  batch=batches[r['source_batch']];observed=datetime.fromisoformat(r['observed_at']);age=(snapshot-observed).total_seconds()/3600
  if age<0:raise ValueError('Future snapshot row')
  fresh=age<=float(batch['max_age_hours']) and r['freshness']=='有效'
  output.append({'skuId':r['sku_id'],'warehouseId':r['warehouse_id'],'physical':p,'reserved':v,'quarantine':q,'available':a,'formula':f'{p} - {v} - {q} = {a}','observedAt':r['observed_at'],'ageHours':round(age,3),'currentUsable':fresh,'rawRow':r})
 for r in receipts:
  if quantity(r['declared_qty'])!=quantity(r['counted_qty'])+quantity(r['shortage_qty']):raise ValueError('Declared/received/shortage mismatch')
  if quantity(r['counted_qty'])!=quantity(r['accepted_qty'])+quantity(r['quarantine_qty']):raise ValueError('Received/accepted/quarantine mismatch')
 sums=defaultdict(lambda:dict(physical=0,reserved=0,quarantine=0))
 for r in bridge:
  if r['included_in_snapshot']!='True':raise ValueError('Bridge row not posted')
  for k in ['physical','reserved','quarantine']:sums[(r['warehouse_id'],r['sku_id'])][k]+=int(r[k+'_delta'])
 for key,values in sums.items():
  row=next(x for x in stock if (x['warehouse_id'],x['sku_id'])==key)
  if any(int(row[k])!=v for k,v in values.items()):raise ValueError('Posted receipt bridge does not reconcile to snapshot')
 future=[];sindex={r['shipment_id']:r for r in shipments}
 for p in pos:
  ordered,received,remaining,confirmed=[quantity(p[k]) for k in ['ordered','received','open_qty','confirmed_open_qty']]
  if ordered-received!=remaining or confirmed>remaining:raise ValueError('Purchase open balance mismatch')
  ship=sindex[p['shipment_id']]
  if ship['po_line_id']!=p['po_line_id'] or int(ship['received_qty'])!=received:raise ValueError('Shipment and purchase identity/received mismatch')
  if confirmed and not p['expected_saleable_date']:raise ValueError('Confirmed future supply missing date')
  future.append({'poLineId':p['po_line_id'],'skuId':p['sku_id'],'warehouseId':p['warehouse_id'],'remaining':remaining,'confirmedFuture':confirmed,'expectedSaleableDate':p['expected_saleable_date'] or None,'shipmentStatus':ship['status'],'addedToCurrentStock':False})
 return {'summary':f'{len(output)}个仓库规格快照；{sum(not x["currentUsable"] for x in output)}行需更新时点','rows':output,'futureSupplySeparate':future,'receiptOriginalRows':receipts,'postedBridgeRows':bridge,'denominator':len(output),'unit':'件；时点年龄为小时','formula':'available = physical - reserved - quarantine；已入账收货与在途不再叠加','limitation':'过期行保留历史数值并标记不可直接用于当前决策；日期仅为预计；短少未确认不补算在途。'}

def fulfillment_check(rows,products):
 unique(rows,['warehouse_id','sku_id','date']);unique(products,['sku_id']);ids={r['sku_id'] for r in products};groups=defaultdict(list)
 dates={(date(2026,8,27)+timedelta(days=i)).isoformat() for i in range(14)}
 for r in rows:
  if r['sku_id'] not in ids or r['warehouse_id'] not in {'W-KL','W-JB'} or r['date'] not in dates:raise ValueError('Unknown SKU/warehouse or date outside window')
  if r['saleable_day'] not in {'0','1'}:raise ValueError('Invalid saleable flag')
  if r['saleable_day']=='0' and quantity(r['fulfilled_units']):raise ValueError('Fulfillment reported on non-saleable day')
  groups[(r['warehouse_id'],r['sku_id'])].append(r)
 output=[]
 for (wh,sku),g in sorted(groups.items()):
  if {r['date'] for r in g}!=dates:raise ValueError('Incomplete 14-day series')
  n=sum(int(r['saleable_day']) for r in g);fulfilled=sum(quantity(r['fulfilled_units']) for r in g);last=[r for r in g if r['date']>='2026-09-03'];lastn=sum(int(r['saleable_day']) for r in last)
  output.append({'skuId':sku,'warehouseId':wh,'calendarDays':14,'saleableDays':n,'unavailableDays':14-n,'fulfilledUnits':fulfilled,'referenceUnitsPerSaleableDay':round(fulfilled/n,6) if n else None,'applicability':'短样本线索' if 0<n<7 else '不适用：无可售日' if not n else '履约参考，非需求预测','last7SaleableDays':lastn,'last7FulfilledUnits':sum(int(r['fulfilled_units']) for r in last),'cancelledUnits':sum(quantity(r['cancelled_units']) for r in g),'returnedUnits':sum(quantity(r['returned_units']) for r in g),'rawRows':sorted(g,key=lambda r:r['date'])})
 return {'summary':f'{len(output)}组规格仓库、{len(rows)}条逐日记录；履约按可售日复算','rows':output,'numerator':'每组fulfilled_units之和','denominator':'每组saleable_day=1的天数；零分母返回null','unit':'件 / 可售日','filter':{'start':'2026-08-27','end':'2026-09-09'},'limitation':'504行是SKU×仓库×日期，不是订单；取消或退货不自动推断缺货原因、冲销库存或丢失销量。不外推未来需求。'}

def collaboration_check(rows,events):
 unique(rows,['request_id']);unique(events,['event_id']);by=defaultdict(list);ids={r['request_id'] for r in rows}
 for e in events:
  if e['request_id'] not in ids:raise ValueError('Orphan request event')
  by[e['request_id']].append(e)
 details=[]
 for r in rows:
  start=datetime.fromisoformat(r['created_at']);reply=datetime.fromisoformat(r['first_reply_at']) if r['first_reply_at'] else None;close=datetime.fromisoformat(r['closed_at']) if r['closed_at'] else None
  if not '2026-08-27'<=r['created_at'][:10]<='2026-09-09':raise ValueError('Request outside sample window')
  times=sorted(datetime.fromisoformat(e['event_at']) for e in by[r['request_id']])
  if not times or start!=times[0] or any(t<start for t in times):raise ValueError('Request event chronology mismatch')
  if reply and (reply<start or reply not in times):raise ValueError('First reply not supported by event')
  if close and (close<(reply or start) or close not in times):raise ValueError('Close not supported by event')
  end=close or reply or start
  details.append({'requestId':r['request_id'],'initialTopic':r['initial_topic'],'firstReplyElapsedMinutes':(reply-start).total_seconds()/60 if reply else None,'closeElapsedMinutes':(close-start).total_seconds()/60 if close else None,'activeMinutesEstimate':quantity(r['active_minutes_estimate']),'crossRoleContacts':quantity(r['cross_role_contacts']),'crossesCalendarDate':start.date()!=end.date(),'outside0900To1800OrWeekendPossible':start.date()!=end.date() or start.weekday()>=5 or end.weekday()>=5 or start.hour<9 or end.hour>=18,'closingRecord':r['closing_record'],'businessSupplyResolved':'unknown','eventIds':[e['event_id'] for e in by[r['request_id']]],'rawRequest':r})
 def average(key):
  vals=[x[key] for x in details if x[key] is not None];return round(statistics.mean(vals),6) if vals else None
 return {'summary':f'{len(rows)}件协作样本、{len(events)}个节点；回忆操作{sum(x["activeMinutesEstimate"] for x in details)}分钟','sampleRequests':len(rows),'eventCount':len(events),'firstResponseMeanCalendarMinutes':average('firstReplyElapsedMinutes'),'closeMeanCalendarMinutes':average('closeElapsedMinutes'),'activeMinutesEstimateTotal':sum(x['activeMinutesEstimate'] for x in details),'crossRoleContactsTotal':sum(x['crossRoleContacts'] for x in details),'unclosedRequestIds':[x['requestId'] for x in details if x['closeElapsedMinutes'] is None],'unansweredRequestIds':[x['requestId'] for x in details if x['firstReplyElapsedMinutes'] is None],'initialTopicCounts':dict(Counter(r['initial_topic'] for r in rows)),'rows':details,'denominator':len(rows),'unit':'自然分钟 / 回忆操作分钟 / 联络次数','limitation':'初始主题不是根因；跨夜及非工作时间仅提示，无完整工作日历故不算工作时长。关闭不等于供货解决，全部业务最终结果保留未知。研究样本与回忆值不外推公司全量或节约人力。'}

def calculate(case,operation,grants):
 if case['id']!='logistics' or operation not in OPS:raise ValueError('Unsupported logistics operation')
 matches=[c for c in case['calculations'] if c['operation']==operation]
 if len(matches)!=1:raise ValueError('Unknown or duplicate calculation')
 definition=matches[0];missing=set(definition['inputs'])-set(grants)
 if missing:raise PermissionError('Required inputs have not been obtained: '+','.join(sorted(missing)))
 index={a['id']:a for a in case['assets']};loaded={}
 for aid in definition['inputs']:
  a=index[aid];p=(ROOT/a['path']).resolve()
  if not p.is_relative_to((ROOT/'source-materials/logistics').resolve()) or any(x in a['path'] for x in ['教师','研发','后续','开发验证','业务规则','操作模板']):raise PermissionError('Source outside runtime whitelist')
  data=p.read_bytes()
  if hashlib.sha256(data).hexdigest()!=a['sha256'] or len(data)!=a['sizeBytes']:raise ValueError('Source version mismatch')
  loaded[aid]=list(csv.DictReader(data.decode('utf-8-sig').splitlines())) if p.suffix=='.csv' else data.decode('utf-8-sig')
 def rows(key):return loaded['logistics-'+key]
 if operation=='logistics_stock':result=stock_check(*[rows(k) for k in ['stock','products','receipts','bridge','po','shipments','freshness']],datetime.fromisoformat(case['snapshot']))
 elif operation=='logistics_fulfillment':result=fulfillment_check(rows('daily'),rows('products'))
 else:result=collaboration_check(rows('history'),rows('events'))
 result['scope']='三款18规格、马来西亚两仓；协作台账为教学研究样本';result['snapshot']=case['snapshot'];result.setdefault('filter',definition['filter'])
 result['reportLines']=[result['summary']+'。']
 if operation=='logistics_stock':
  for row in result['rows']:
   if row['skuId'] in {'T01-BL-M','T01-BL-L','S02-SD-M'} or not row['currentUsable']:
    result['reportLines'].append(f"{row['warehouseId']} / {row['skuId']}：实物{row['physical']} − 预留{row['reserved']} − 隔离{row['quarantine']} = 可售{row['available']}件；原始时点{row['observedAt']}，{'时点有效' if row['currentUsable'] else '过期，只作历史值'}。")
  for row in result['futureSupplySeparate']:result['reportLines'].append(f"{row['poLineId']}：未履约{row['remaining']}件，已确认未来供给{row['confirmedFuture']}件，预计可售日期{row['expectedSaleableDate'] or '尚未确认'}；不加入当前库存。")
 elif operation=='logistics_fulfillment':
  for row in result['rows']:
   if row['skuId'] in {'T01-BL-M','T01-BL-L','T01-WH-S'}:
    result['reportLines'].append(f"{row['warehouseId']} / {row['skuId']}：14天可售{row['saleableDays']}天、不可售{row['unavailableDays']}天，履约{row['fulfilledUnits']}件；可售日参考速度{row['referenceUnitsPerSaleableDay'] if row['referenceUnitsPerSaleableDay'] is not None else '不适用'}件/日。最近7天可售{row['last7SaleableDays']}天，履约{row['last7FulfilledUnits']}件。")
 else:
  result['reportLines'] += [f"首次响应平均{result['firstResponseMeanCalendarMinutes']}自然分钟；关闭平均{result['closeMeanCalendarMinutes']}自然分钟；人工操作回忆合计{result['activeMinutesEstimateTotal']}分钟；跨岗联络{result['crossRoleContactsTotal']}次。",f"未关闭{len(result['unclosedRequestIds'])}件，未首次响应{len(result['unansweredRequestIds'])}件；关闭后供货最终是否解决仍未知。"]
  result['reportLines'] += [f"记录初始主题‘{k}’：{v}件（不作为已证实根因）。" for k,v in result['initialTopicCounts'].items()]
 return {'calculationId':definition['id'],'version':definition['version'],'inputAssetIds':definition['inputs'],'inputHashes':{aid:index[aid]['sha256'] for aid in definition['inputs']},'result':result}
