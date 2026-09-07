import { randomUUID } from 'node:crypto';
import { neighborhood, CONSTRAINT_PATH, DEVICE_PATH, VENDOR_PATH, SAMPLE_PATH } from './catalog.mjs';

export class UserError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

export const DOMAIN_LABELS = { refrigeration: '制冷设备', network: '网络连接', 'pos-hardware': '收银设备', hvac: '空调设备', unknown: '故障域待确认' };
function domain(report) {
  const s = `${report.assetText} ${report.symptom}`;
  if (/网络|联网|网速|断网|VLAN|线路/i.test(s)) return 'network';
  if (/收银|扫码|付款|POS/i.test(s)) return 'pos-hardware';
  if (/空调|室内.*度/.test(s)) return 'hvac';
  if (/冷柜|冷藏|冷冻|冰柜|饮料柜|制冷/.test(s)) return 'refrigeration';
  return 'unknown';
}

export function riskFor(report) {
  const s = `${report.symptom}；${report.impact}`;
  // Conservative local hints; this does not diagnose or replace the emergency policy.
  const hazard = /焦味|烟雾|漏电|插座发热|碎玻璃|人身|食品安全|电气风险/.test(s);
  const stopped = /全店.*(中断|无法|不能)|收银全挂|都不能付款|全店不能交易/.test(s);
  if (hazard || stopped) return { priority: 'P0', title: '人工应急优先', reason: hazard ? '原文包含安全风险描述。请立即按门店应急预案联系负责人，不要等待分析完成。' : '原文描述交易中断。请立即联系值班负责人，工作台不阻断线下应急。' };
  if (/未说明|不知道/.test(report.impact) || !report.impact || domain(report) === 'unknown') return { priority: '待定', title: '先补充关键信息', reason: '影响或设备信息不足，不自动降为低优先级。' };
  if (/不制冷|销售受影响|31 度|滑倒|滴水到通道|温度.*升高/.test(s)) return { priority: 'P1', title: '优先人工复核', reason: '营业、商品或通道受到影响，建议优先核对现场情况。' };
  return { priority: 'P2', title: '常规候选处理', reason: '当前原文未触发明确应急条件；等级仍需人工确认。' };
}

export function validateReport(input, catalog) {
  const clean = {};
  for (const key of ['storeId', 'assetText', 'symptom', 'impact', 'assetId']) {
    if (input[key] !== undefined && typeof input[key] !== 'string') throw new UserError('报修字段必须为文本');
    clean[key] = (input[key] ?? '').trim();
    if (clean[key].length > (key === 'symptom' ? 3000 : 300)) throw new UserError('报修内容过长');
  }
  if (!clean.symptom || !clean.assetText) throw new UserError('请填写设备描述和故障原文');
  if ((input.region && input.region !== 'east-1') || !catalog.stores.includes(clean.storeId)) throw new UserError('仅支持当前已登记的华东一区门店');
  if (input.reportedAt && (typeof input.reportedAt !== 'string' || !Number.isFinite(Date.parse(input.reportedAt)))) throw new UserError('故障时间无效');
  return { ...clean, id: `LOCAL-${randomUUID().slice(0, 8).toUpperCase()}`, region: 'east-1', reportedAt: input.reportedAt ? new Date(input.reportedAt).toISOString() : null,
    origin: 'local', createdAt: new Date().toISOString(), sourcePath: null };
}

export function analyze(report, reports, catalog) {
  const risk = riskFor(report);
  const category = domain(report);
  const domains = category === 'pos-hardware' && /付款|全挂|联网/.test(`${report.symptom} ${report.impact}`) ? ['pos-hardware', 'network'] : [category];
  const asset = catalog.devices.find(d => d.id === report.assetId && d.storeId === report.storeId);
  const assets = report.assetId ? (asset ? [asset] : []) : catalog.devices.filter(d => d.storeId === report.storeId && domains.includes(d.category));
  const vendors = catalog.vendors.filter(v => v.stores.includes(report.storeId) && v.categories.some(c => domains.includes(c)));
  const duplicates = reports.filter(other => {
    if (other.id === report.id || other.storeId !== report.storeId) return false;
    if (other.assetId && report.assetId && other.assetId !== report.assetId) return false;
    if (domain(other) !== category) return false;
    return !other.reportedAt || !report.reportedAt || Math.abs(Date.parse(other.reportedAt) - Date.parse(report.reportedAt)) <= 2 * 60 * 60 * 1000;
  }).map(other => ({ id: other.id, symptom: other.symptom, timeVerified: Boolean(other.reportedAt && report.reportedAt),
    reason: other.reportedAt && report.reportedAt ? '同店、设备/症状相近且在两小时内；仍需人工确认。' : '同店且设备/症状相近，但缺少时间或精确设备身份，不能断言为重复。' }));
  const warnings = ['只保存本地草稿，不执行正式派单、通知、费用承诺或关单。'];
  if (risk.priority === 'P0') warnings.unshift(risk.reason);
  if (domains.length > 1) warnings.push('收银不可用是业务症状，不等于收银硬件故障；网络和终端两条路径均需排查。');
  if (/忽略|绕过|直接派|派单成功/.test(report.symptom)) warnings.push('原文含操作指令，作为不可信报修内容保留；不改变系统权限。');
  if (asset?.status === 'retired') warnings.push('该设备台账标记为已停用，先核对现场铭牌和设备身份。');
  warnings.push('合同与值班表仅作候选依据，未核验权威合同、当前值班与费用批准。');
  const questions = [];
  if (!report.impact || report.impact === '未说明') questions.push('现在影响哪些营业或安全环节？是否已联系值班负责人？');
  if (!report.assetId || !asset || asset.status !== 'active') questions.push('请补充清晰铭牌与设备编号，确认现场设备是否与台账一致。');
  if (!report.reportedAt) questions.push('故障首次出现的具体时间是什么？');
  if (questions.length < 3 && domains.length > 1) questions.push('收银终端能否开机，网络线路和备用连接是否正常？');
  const seeds = catalog.graph.nodes.filter(n => [report.storeId, report.assetId, report.id, report.id.replace('-', '')].filter(Boolean).includes(n.label)).map(n => n.id);
  const graph = neighborhood(catalog.graph, seeds);
  return { id: `RUN-${randomUUID().slice(0, 8).toUpperCase()}`, reportId: report.id, createdAt: new Date().toISOString(), fingerprint: catalog.fingerprint,
    mode: '规则 + 既有图谱查询', modelConnected: false, risk, domains: domains.map(id => ({ id, label: DOMAIN_LABELS[id] })),
    assets, vendors, duplicates, warnings, questions: questions.slice(0, 3), graph,
    evidence: [...new Set([...(report.sourcePath ? [report.sourcePath] : []), CONSTRAINT_PATH, DEVICE_PATH, VENDOR_PATH])],
    steps: [
      { title: '保留报修原文', detail: report.origin === 'sample' ? '仅选取样本输入列，不读取最终分类或历史答案。' : '读取用户新提交的本地报修。' },
      { title: '执行风险与边界规则', detail: `${risk.priority} 候选；所有正式外部动作关闭。` },
      { title: '查询关联图谱', detail: `按门店和设备检索两跳关系，取得 ${graph.nodes.length} 个实体、${graph.edges.length} 条关系。图谱作为来源可查的背景，不作为历史答案。` },
      { title: '生成待确认记录', detail: `${questions.slice(0, 3).length} 个补充问题、${vendors.length} 个待核验联系候选。` },
    ],
  };
}

export function makeDraft(input, state, catalog) {
  if (input.confirmed !== true) throw new UserError('请先确认已核对证据和本地草稿边界');
  const operator = typeof input.operator === 'string' ? input.operator.trim() : '';
  const note = typeof input.note === 'string' ? input.note.trim() : '';
  if (!operator || operator.length > 80 || note.length > 2000) throw new UserError('请填写操作人，备注不超过 2000 字');
  if (typeof input.operationId !== 'string' || !/^[\w-]{8,100}$/.test(input.operationId)) throw new UserError('草稿操作标识无效');
  const existing = state.drafts.find(d => d.operationId === input.operationId);
  if (existing) {
    if (existing.runId !== input.runId || existing.operator !== operator || existing.note !== note) throw new UserError('同一操作不能提交不同内容', 409);
    return existing;
  }
  const run = state.runs.find(r => r.id === input.runId);
  if (!run) throw new UserError('请先完成报修分析', 404);
  if (run.fingerprint !== catalog.fingerprint) throw new UserError('资料或图谱已变化，请重新分析后再保存', 409);
  const report = [...catalog.reports, ...state.reports].find(r => r.id === run.reportId);
  if (!report) throw new UserError('报修记录不存在', 404);
  return { id: `DRAFT-${randomUUID().slice(0, 8).toUpperCase()}`, operationId: input.operationId, runId: run.id, reportId: report.id,
    operator, note, createdAt: new Date().toISOString(), status: 'local-draft', externalWrite: false, report,
    priority: run.risk.priority, domains: run.domains, warnings: run.warnings, questions: run.questions,
    evidence: run.evidence, fingerprint: run.fingerprint, graphRevision: run.graph.revision };
}
