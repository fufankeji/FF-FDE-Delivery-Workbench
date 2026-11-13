# -*- coding: utf-8 -*-
"""Deterministic finance 1.1 calculations over the current run's granted originals.

No teacher results, model-generated programs, or legacy samples are loaded here.
Monetary arithmetic uses Decimal; JSON output amounts are exact two-decimal strings.
"""
from pathlib import Path
from decimal import Decimal, InvalidOperation
from datetime import datetime, timedelta
from collections import defaultdict
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1]
BASE = Path('source-materials/finance/深化调查补充包')
INPUTS = {
    'finance_budget_composition': (21, 22, 14, 10, 23),
    'finance_version_payment': (15, 20, 13, 17, 9, 23),
    'finance_issue_history': (19, 18, 12, 11, 8, 23),
}
PATHS = {
    8: '业务原件/历史样本移交与计时说明.md', 9: '业务原件/系统版本与复核职责说明.md',
    10: '业务原件/预算导出与办理口径说明.md', 11: '业务数据/人工操作回填.json',
    12: '业务数据/六类问题复核编码.json', 13: '业务数据/各系统所见截面.json',
    14: '业务数据/待批且未预占申请.json', 15: '业务数据/报销版本与分摊.json',
    17: '业务数据/新增费用明细.json', 18: '业务数据/深化调查事件原文.json',
    19: '业务数据/深化调查历史样本.json', 20: '业务数据/版本审批与支付事件.json',
    21: '业务数据/预算截面.json', 22: '业务数据/预算预占流水.json',
    23: '数据说明与字段口径.md',
}
ISSUES = {f'Q{i}' for i in range(1, 7)}
ZERO = Decimal(0)


def require(condition, message):
    if not condition:
        raise ValueError(message)


def money(value, signed=False):
    require(not isinstance(value, bool), 'Boolean is not an amount')
    try:
        n = Decimal(str(value))
    except InvalidOperation:
        raise ValueError('Invalid decimal amount')
    require(n.is_finite() and n == n.quantize(Decimal('.01')), 'Amount must have cent precision')
    require(signed or n >= 0, 'Negative amount')
    return n


def fmt(value):
    return format(value, '.2f')


def timestamp(value):
    t = datetime.fromisoformat(value)
    require(t.tzinfo is not None and t.utcoffset() == timedelta(hours=8), 'Expected UTC+08:00 timestamp')
    return t


def unique(rows, *keys):
    values = [tuple(r[k] for k in keys) for r in rows]
    require(len(values) == len(set(values)), 'Duplicate key: ' + ','.join(keys))


def budget_check(budget, movement_data, pending_data, snapshot):
    cutoff = timestamp(budget['snapshot_at'])
    require(cutoff <= snapshot, 'Budget snapshot is in the future')
    require(all(timestamp(d['snapshot_at']) == cutoff for d in (movement_data, pending_data)), 'Budget input snapshots differ')
    require(budget['currency'] == 'CNY', 'Unexpected currency')
    projects, movements, pending = budget['rows'], movement_data['rows'], pending_data['rows']
    unique(projects, 'project_id'); unique(movements, 'event_id'); unique(pending, 'request_id')
    pids = {p['project_id'] for p in projects}
    require(pids == {'P101', 'P102', 'P103'}, 'Unexpected budget project scope')
    by_reservation = defaultdict(list)
    for r in movements:
        require(r['project_id'] in pids, 'Reservation has unknown project')
        require(timestamp(r['event_at']) <= cutoff, 'Reservation is later than budget cutoff')
        delta = money(r['delta_yuan'], signed=True)
        require((r['action'] == 'RESERVE' and delta > 0) or (r['action'] == 'RELEASE' and delta < 0), 'Reservation action and sign disagree')
        by_reservation[r['reservation_id']].append(r)
    reservations = []
    for rid, rows in sorted(by_reservation.items()):
        require(len({(r['project_id'], r['business_id']) for r in rows}) == 1, 'Reservation identity changed without a new reservation')
        balance = ZERO
        for r in sorted(rows, key=lambda x: timestamp(x['event_at'])):
            balance += money(r['delta_yuan'], signed=True)
            require(balance >= 0, 'Release exceeds preceding reservation')
        reservations.append({'reservationId': rid, 'projectId': rows[0]['project_id'], 'businessId': rows[0]['business_id'], 'netReservedYuan': fmt(balance), 'eventIds': [r['event_id'] for r in rows], 'rawRows': rows})
    for r in pending:
        require(r['project_id'] in pids, 'Pending request has unknown project')
        require(r['reserved'] is False and r['status'] == 'PENDING_APPROVAL', 'Pending input contains an already reserved or approved request')
        require(timestamp(r['submitted_at']) <= cutoff, 'Pending request is later than budget cutoff')
        money(r['requested_yuan'])
    output = []
    for p in projects:
        pid = p['project_id']
        net = sum((money(r['delta_yuan'], signed=True) for r in movements if r['project_id'] == pid), ZERO)
        wait = sum((money(r['requested_yuan']) for r in pending if r['project_id'] == pid), ZERO)
        total, posted, reserved, available = [money(p[k]) for k in ('total_yuan', 'posted_yuan', 'reserved_yuan', 'available_yuan')]
        require(net == reserved and total - posted - net == available, 'Budget composition does not reconcile')
        output.append({'projectId': pid, 'totalYuan': fmt(total), 'postedYuan': fmt(posted), 'netReservedYuan': fmt(net), 'availableYuan': fmt(available), 'unreservedPendingYuan': fmt(wait), 'ifAllListedPendingApprovedRemainingYuan': fmt(available-wait), 'conditionalIsCurrent': False, 'reservationIds': [r['reservationId'] for r in reservations if r['projectId'] == pid], 'pendingRequestIds': [r['request_id'] for r in pending if r['project_id'] == pid], 'rawSnapshotRow': p})
    c009 = [r for r in reservations if r['businessId'] == 'C009']
    lines = [f"{r['projectId']}：总预算{r['totalYuan']}元 − 已入账{r['postedYuan']}元 − 净预占{r['netReservedYuan']}元 = 截面可用{r['availableYuan']}元；未占待批{r['unreservedPendingYuan']}元；仅若清单全部获批，条件余额{r['ifAllListedPendingApprovedRemainingYuan']}元，非当前余额。" for r in output]
    lines += [f"预占{r['reservationId']} / {r['businessId']}：仍归{r['projectId']}，净预占{r['netReservedYuan']}元；不按拟议分摊转移或再次扣款。" for r in c009]
    lines += [f"{r['reservationId']}的锁定和释放按符号相抵，净预占{r['netReservedYuan']}元。" for r in reservations if money(r['netReservedYuan']) == ZERO]
    return {'summary': f'{len(output)}个项目预算组成可复算，当前余额与待批条件余额分别列示', 'rows': output, 'reservationRows': reservations, 'pendingRows': pending, 'c009ReservationSeparate': c009, 'budgetSnapshot': budget['snapshot_at'], 'budgetAgeHours': (snapshot-cutoff).total_seconds()/3600, 'reportLines': lines + [f"预算导出时点{budget['snapshot_at']}；观察时点{snapshot.isoformat()}，无实时锁定接口。"], 'scope': '三项目完整预算汇总；累计入账不从旧历史或当前调查样本重新扣减', 'formula': '净预占=带符号流水之和；可用=总预算−已入账−净预占；条件余额=可用−清单未占待批', 'unit': '人民币元，两位小数', 'limitation': '待批清单不含C003未决归属与C009未来转移，不能视为全部潜在支出；条件测算不是批准或实时锁定。'}


def version_check(version_data, event_data, system_data, line_data, snapshot):
    require(all(timestamp(d['snapshot_at']) == snapshot for d in (version_data, event_data, system_data)), 'Version inputs do not share the observation snapshot')
    require(line_data['currency'] == 'CNY', 'Unexpected expense currency')
    versions, events, systems, lines = [d['rows'] for d in (version_data, event_data, system_data, line_data)]
    unique(versions, 'claim_id', 'version'); unique(events, 'event_id'); unique(systems, 'claim_id', 'system'); unique(lines, 'line_id')
    vmap = {(r['claim_id'], r['version']): r for r in versions}
    claims = {r['claim_id'] for r in versions}
    require(claims == {'C009', 'C010'}, 'Version scope must contain the two extension claims')
    require(all(r['claim_id'] in claims for r in lines), 'Expense line is outside claim scope')
    for v in versions:
        require(timestamp(v['created_at']) <= snapshot, 'Future version')
        own = [r for r in lines if r['claim_id'] == v['claim_id']]
        require(own, 'Version has no expense lines')
        require(sum((money(r['claimed_yuan']) for r in own), ZERO) == money(v['submitted_yuan']), 'Claimed lines do not reconcile')
        reviewed = money(v['reviewed_yuan'])
        require(sum((money(r['ordinary_review_yuan']) for r in own), ZERO) == reviewed, 'Ordinary review lines do not reconcile')
        unique(v['allocation'], 'project_id')
        ratios = [money(r['ratio']) for r in v['allocation']]
        require(sum(ratios, ZERO) == 1, 'Allocation ratios do not sum to one')
        require(sum((money(r['yuan']) for r in v['allocation']), ZERO) == reviewed, 'Allocation amounts do not reconcile')
        require(all(money(r['yuan']) == reviewed * money(r['ratio']) for r in v['allocation']), 'Allocation ratio differs from its amount')
    for e in events:
        key = (e['claim_id'], e['version'])
        require(key in vmap, 'Event refers to unknown claim/version')
        require(timestamp(vmap[key]['created_at']) <= timestamp(e['event_at']) <= snapshot, 'Version event is outside version lifetime')
    for r in systems:
        key = (r['claim_id'], r['version'])
        require(key in vmap, 'System snapshot refers to unknown claim/version')
        require(timestamp(vmap[key]['created_at']) <= timestamp(r['updated_at']) <= snapshot, 'System row has impossible time')
        require(money(r['amount_yuan']) == money(vmap[key]['reviewed_yuan']), 'System amount differs from its referenced version')
    output, report = [], []
    for claim in sorted(claims):
        own_v = sorted((v for v in versions if v['claim_id'] == claim), key=lambda r: timestamp(r['created_at']))
        own_e = sorted((e for e in events if e['claim_id'] == claim), key=lambda r: timestamp(r['event_at']))
        own_s = [s for s in systems if s['claim_id'] == claim]
        latest = own_v[-1]
        approved = {e['version'] for e in own_e if e['action'] == 'APPROVED'}
        for v in own_v:
            recorded_approval = v['approval_status'].startswith('APPROVED_FOR_')
            require(recorded_approval == (v['version'] in approved), 'Version approval status disagrees with its events')
        payment_events = [e for e in own_e if e['action'] in {'PAYMENT_HOLD', 'PAYMENT_RESUMED', 'PAYMENT_REQUESTED', 'PAID'}]
        paid = any(e['action'] == 'PAID' for e in payment_events)
        hold = bool(payment_events and payment_events[-1]['action'] == 'PAYMENT_HOLD')
        for e in own_e:
            if e['action'] == 'PAID':
                require(any(a['action'] == 'APPROVED' and a['version'] == e['version'] and timestamp(a['event_at']) <= timestamp(e['event_at']) for a in own_e), 'Payment is not supported by preceding version approval')
        pay_rows = [s for s in own_s if s['system'] == 'PAY']
        require(len(pay_rows) == 1, 'Missing payment system snapshot')
        require(('HOLD' in pay_rows[0]['status']) == hold and (pay_rows[0]['status'] == 'PAID') == paid, 'Payment state contradicts event history')
        amount_changed = any((money(v['submitted_yuan']), money(v['reviewed_yuan'])) != (money(own_v[0]['submitted_yuan']), money(own_v[0]['reviewed_yuan'])) for v in own_v[1:])
        def allocation(v):
            return sorted((r['project_id'], money(r['ratio']), money(r['yuan'])) for r in v['allocation'])
        allocation_changed = any(allocation(v) != allocation(own_v[0]) for v in own_v[1:])
        vs = [{'version': v['version'], 'submittedYuan': fmt(money(v['submitted_yuan'])), 'ordinaryReviewedYuan': fmt(money(v['reviewed_yuan'])), 'differenceYuan': fmt(money(v['submitted_yuan'])-money(v['reviewed_yuan'])), 'allocation': v['allocation'], 'allocationStatus': v['allocation_status'], 'approvalStatus': v['approval_status'], 'hasApprovalEvent': v['version'] in approved, 'arithmeticValid': True, 'rawVersion': v} for v in own_v]
        no_request_record = any('无支付请求' in e['content'] for e in payment_events)
        require(not (no_request_record and any(e['action'] in {'PAYMENT_REQUESTED', 'PAID'} for e in payment_events)), 'No-payment statement contradicts payment events')
        output.append({'claimId': claim, 'latestVersion': latest['version'], 'amountChanged': amount_changed, 'allocationChanged': allocation_changed, 'latestApproved': latest['version'] in approved, 'approvedVersions': sorted(approved), 'currentHold': hold, 'paid': paid, 'paymentInitiated': True if paid or any(e['action'] == 'PAYMENT_REQUESTED' for e in payment_events) else False if no_request_record else None, 'versions': vs, 'events': own_e, 'systemRows': own_s, 'systemVersionsDiffer': len({s['version'] for s in own_s}) > 1, 'expenseRows': [r for r in lines if r['claim_id'] == claim]})
        for v in vs:
            alloc = '；'.join(f"{a['project_id']} {fmt(money(a['ratio'])*100)}% / {fmt(money(a['yuan']))}元" for a in v['allocation'])
            report.append(f"{claim} {v['version']}：申报{v['submittedYuan']}元，普通核定{v['ordinaryReviewedYuan']}元，差额{v['differenceYuan']}元；分摊{alloc}；{v['allocationStatus']}；该版{'有' if v['hasApprovalEvent'] else '没有'}批准事件。")
        report.append(f"{claim}：金额{'变化' if amount_changed else '未变'}，归属{'变化' if allocation_changed else '未变'}；当前{latest['version']}{'已获该版批准' if latest['version'] in approved else '未获该版批准'}；{'人工暂停' if hold else '无当前暂停'}，{'已支付' if paid else '未支付'}。保留历史批准，不把算术正确当业务获批。")
        if no_request_record:
            report.append(f'{claim}暂停记录明确无支付请求、无银行回执；不能据此声称已经发生或由AI防止一笔错付。')
    return {'summary': f'{len(output)}笔新增单据、{len(versions)}个版本完成金额、归属、批准与支付依据核对', 'rows': output, 'reportLines': report, 'scope': '只核对新增C009/C010；原八笔及C007批次状态仍属旧材料范围', 'formula': '明细按claim_id加总；批准按claim_id+version关联；系统截面保留原版本；相同金额不代表相同归属', 'unit': '人民币元，两位小数；版本与状态', 'limitation': '核对不执行批准或付款；拟议分摊不自动生效，旧批准不自动覆盖新版本；教学回执不是外部银行验真。'}


def history_check(sample_data, event_data, coding_data, work_data, snapshot):
    require(timestamp(sample_data['snapshot_at']) == snapshot, 'History snapshot differs from case')
    samples, events, coding, work = [d['rows'] for d in (sample_data, event_data, coding_data, work_data)]
    unique(samples, 'sample_id'); unique(events, 'event_id'); unique(coding, 'sample_id', 'issue_code'); unique(work, 'work_id')
    smap = {r['sample_id']: r for r in samples}; emap = {r['event_id']: r for r in events}
    require(set(smap) == {f'EXH{i:03d}' for i in range(1, 25)}, 'Expected independent EXH001–EXH024 sample scope')
    by_event = defaultdict(list)
    for e in events:
        require(e['sample_id'] in smap, 'Event belongs to another sample scope')
        by_event[e['sample_id']].append(e)
    coded = defaultdict(set)
    for r in coding:
        require(r['sample_id'] in smap and r['issue_code'] in ISSUES, 'Unknown sample or issue code')
        require(r['observation_event_id'] in emap and r['resolution_event_id'] in emap, 'Coding lacks original event')
        a, b = emap[r['observation_event_id']], emap[r['resolution_event_id']]
        require(a['sample_id'] == b['sample_id'] == r['sample_id'] and a['action'] == 'OBSERVED' and b['action'] == 'CONFIRMED', 'Coding points to the wrong sample or event action')
        require(timestamp(a['event_at']) <= timestamp(b['event_at']) <= snapshot, 'Coding chronology is invalid')
        coded[r['sample_id']].add(r['issue_code'])
    by_work = defaultdict(list)
    for r in work:
        require(r['sample_id'] in smap and r['issue_code'] in coded[r['sample_id']], 'Work does not belong to a coded sample issue')
        require(r['related_event_id'] in emap and emap[r['related_event_id']]['sample_id'] == r['sample_id'], 'Work points to another sample event')
        matching = next(c for c in coding if c['sample_id'] == r['sample_id'] and c['issue_code'] == r['issue_code'])
        require(r['related_event_id'] in {matching['observation_event_id'], matching['resolution_event_id']}, 'Work points to a different issue within the same sample')
        money(r['active_minutes'])
        by_work[r['sample_id']].append(r)
    rows = []
    for sid, s in smap.items():
        start, end = timestamp(s['received_at']), timestamp(s['closed_at'])
        own = by_event[sid]
        require(own and start <= end <= snapshot, 'Invalid sample interval')
        times = [timestamp(e['event_at']) for e in own]
        require(min(times) == start and max(times) == end and all(start <= t <= end for t in times), 'Sample events do not match observation interval')
        require(any(e['action'] == 'RECEIVED' and timestamp(e['event_at']) == start for e in own), 'Sample start lacks receipt event')
        require(s['has_documented_issue'] is bool(coded[sid]), 'Documented issue flag disagrees with reviewed coding')
        rows.append({'sampleId': sid, 'issueCodes': sorted(coded[sid]), 'hasDocumentedIssue': bool(coded[sid]), 'calendarElapsedHours': (end-start).total_seconds()/3600, 'recordedActiveMinutes': float(sum((money(r['active_minutes']) for r in by_work[sid]), ZERO)), 'workIds': [r['work_id'] for r in by_work[sid]], 'eventIds': [e['event_id'] for e in own], 'rawSample': s})
    n = len(rows); abnormal = sum(r['hasDocumentedIssue'] for r in rows)
    issue_rows = []
    for q in sorted(ISSUES):
        ids = sorted(sid for sid in smap if q in coded[sid])
        minutes = sum((money(r['active_minutes']) for r in work if r['issue_code'] == q), ZERO)
        issue_rows.append({'issueCode': q, 'sampleIds': ids, 'sampleCount': len(ids), 'denominator': n, 'frequencyPercent': round(len(ids)*100/n, 4), 'recordedActiveMinutes': float(minutes), 'workIds': [r['work_id'] for r in work if r['issue_code'] == q]})
    active = float(sum((money(r['active_minutes']) for r in work), ZERO))
    elapsed = sum(r['calendarElapsedHours'] for r in rows)
    labels = sum(r['sampleCount'] for r in issue_rows)
    report = [f'EXH独立目的样本{n}笔，按单去重有六类记录问题{abnormal}笔、无该六类记录的正常对照{n-abnormal}笔；非互斥标签{labels}个，不是{labels}笔异常业务。']
    report += [f"{r['issueCode']}：{r['sampleCount']}/{n}笔，样本内频率{r['frequencyPercent']}%；已记录净操作估计{r['recordedActiveMinutes']:g}分钟。" for r in issue_rows]
    report += [f'去重操作记录{len(work)}条，已记录净操作估计合计{active:g}分钟；自然历时合计{elapsed:g}小时，平均{elapsed/n:.4f}小时，包含非工作时间。', '原180笔历史、旧12笔工时与EXH样本分组保留，不合并分母，不用本组分钟替换旧工时；本计算未读取旧组，不能推出年度损失、全院发生率或AI节省比例。']
    return {'summary': f'{n}笔独立目的样本：{abnormal}笔有记录问题、{n-abnormal}笔正常对照，净操作估计{active:g}分钟', 'rows': rows, 'issueRows': issue_rows, 'sampleCount': n, 'withDocumentedIssues': abnormal, 'normalComparators': n-abnormal, 'nonexclusiveLabelCount': labels, 'recordedActiveMinutes': active, 'meanCalendarElapsedHours': round(elapsed/n, 4), 'totalCalendarElapsedHours': elapsed, 'rawEvents': events, 'codingRows': coding, 'workRows': work, 'reportLines': report, 'scope': sample_data['sampling'], 'legacyGroups': {'loaded': False, 'combinedDenominator': None, 'legacyWorkMinutesReplaced': False}, 'denominator': n, 'numerator': '各类按sample_id去重；异常总数为各类样本ID并集', 'formula': '每单历时=(closed_at−received_at)小时；净操作按唯一work_id累加；问题类别非互斥', 'unit': '样本笔数、样本内百分比、回填净操作分钟、自然小时', 'limitation': '无该六类记录不证明业务完全无异常；回填只覆盖已记录核实动作，不是全流程总劳动；无工作日历，不算净工作历时。目的抽样不可外推总体发生率或AI效果。'}


def calculate(case, operation, grants):
    if case['id'] != 'finance' or operation not in INPUTS:
        raise ValueError('Unsupported finance deepening operation')
    matches = [c for c in case['calculations'] if c['operation'] == operation]
    require(len(matches) == 1, 'Unknown or duplicate calculation')
    definition = matches[0]
    required_ids = {f'FIN-DEEP-{n:03d}' for n in INPUTS[operation]}
    require(set(definition['inputs']) == required_ids and len(definition['inputs']) == len(required_ids), 'Calculation input contract mismatch')
    missing = required_ids-set(grants)
    if missing:
        raise PermissionError('Required inputs have not been obtained: '+','.join(sorted(missing)))
    index = {a['id']: a for a in case['assets']}
    require(len(index) == len(case['assets']), 'Duplicate asset IDs')
    loaded = {}
    for number in INPUTS[operation]:
        aid = f'FIN-DEEP-{number:03d}'
        a = index[aid]
        expected = BASE/PATHS[number]
        if Path(a['path']) != expected:
            raise PermissionError('Source is outside the fixed business input whitelist')
        p = (ROOT/a['path']).resolve()
        if not p.is_relative_to((ROOT/BASE).resolve()):
            raise PermissionError('Source resolved outside finance deepening materials')
        data = p.read_bytes()
        require(len(data) == a['sizeBytes'] and hashlib.sha256(data).hexdigest() == a['sha256'], 'Source version mismatch')
        loaded[number] = json.loads(data.decode('utf-8-sig')) if p.suffix == '.json' else data.decode('utf-8-sig')
        require(bool(loaded[number]), 'Empty required original')
    snapshot = timestamp(case['snapshot'])
    if operation == 'finance_budget_composition':
        result = budget_check(loaded[21], loaded[22], loaded[14], snapshot)
    elif operation == 'finance_version_payment':
        result = version_check(loaded[15], loaded[20], loaded[13], loaded[17], snapshot)
    else:
        result = history_check(loaded[19], loaded[18], loaded[12], loaded[11], snapshot)
    result['snapshot'] = case['snapshot']
    result['filter'] = definition.get('filter', {})
    result['reportLines'].append(result['limitation'])
    return {'calculationId': definition['id'], 'version': definition['version'], 'inputAssetIds': definition['inputs'], 'inputHashes': {aid: index[aid]['sha256'] for aid in definition['inputs']}, 'result': result}
