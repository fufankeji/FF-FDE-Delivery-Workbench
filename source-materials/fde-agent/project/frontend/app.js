const $ = s => document.querySelector(s);
const html = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const paths = {
  inbox: '<path d="M4 4h16v16H4zM4 14h5l2 3h2l2-3h5"/>',
  graph: '<circle cx="12" cy="5" r="3"/><circle cx="5" cy="18" r="3"/><circle cx="19" cy="18" r="3"/><path d="m10 8-4 7m8-7 4 7M8 18h8"/>',
  file: '<path d="M7 3h7l4 4v14H5V3h2m7 0v5h4M8 12h7m-7 4h7"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>',
  spark: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  shield: '<path d="m12 3 8 3v6c0 4-5 7-8 9-3-2-8-5-8-9V6z"/><path d="m8 12 3 3 5-6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  store: '<path d="M4 10v11h16V10M3 4h18l1 6H2zM9 21v-7h6v7"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  refresh: '<path d="M20 7a9 9 0 1 0 1 9M20 3v5h-5"/>',
  monitor: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4M7 8h6"/>',
  cooling: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M5 10h14M8 6v1m0 7v3"/>',
  air: '<rect x="2" y="3" width="20" height="8" rx="2"/><path d="M5 8h14M7 14v4m5-4v7m5-7v4"/>',
  network: '<path d="M3 7a15 15 0 0 1 18 0M6 11a10 10 0 0 1 12 0m-9 4a5 5 0 0 1 6 0"/><circle cx="12" cy="20" r="1"/>',
};
const assetIcon = r => /空调/.test(r.assetText) ? 'air' : /网络/.test(r.assetText) ? 'network' : /冷|冰柜|饮料柜/.test(r.assetText) ? 'cooling' : 'monitor';
const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.file}</svg>`;
const button = (action, label, type = '', extra = '') => `<button type="button" class="button ${type}" data-action="${action}" ${extra}>${label}</button>`;
const pill = (label, style = '') => `<span class="pill ${style}">${html(label)}</span>`;
const priorityPill = risk => pill(risk.priority === '待定' ? '待补充' : risk.priority, risk.priority.toLowerCase());
const formatTime = date => date ? new Date(date).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }) : '时间待补充';
const TYPE_LABELS = { Store: '门店', Asset: '设备', WorkOrder: '历史工单', Vendor: '维修商', Contract: '合同候选', Incident: '事件候选', Alert: '告警', Report: '报修', Message: '消息', Principal: '权限主体' };
const COLORS = { Store: '#007aff', Asset: '#5e5ce6', WorkOrder: '#ff9f0a', Vendor: '#30a88b', Contract: '#ac68d9', Incident: '#ff6961', Alert: '#ff453a', Report: '#64a7c0', Message: '#5db4af', Principal: '#8e8e93' };
let state = { data: null, view: 'inbox', activeId: 'R-1002', query: '', filter: 'all', tab: 'analysis', busy: false, graph: null, graphZoom: 1 };
let toastTimer;

async function api(path, data) {
  const response = await fetch(path, data ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) } : undefined);
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || '操作未完成，请稍后重试');
  return value;
}
function notify(message, error = false) {
  const t = $('#toast'); t.textContent = message; t.className = `visible${error ? ' error' : ''}`;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.className = ''; }, 4500);
}
async function refresh() {
  state.data = await api('/api/overview');
  if (!state.data.reports.some(r => r.id === state.activeId)) state.activeId = state.data.reports[0]?.id;
}
const selected = () => state.data.reports.find(r => r.id === state.activeId);
const runFor = id => state.data.runs.filter(r => r.reportId === id).at(-1);
const draftsFor = id => state.data.drafts.filter(d => d.reportId === id);
const sourceLink = path => button('source', `${icon('file')} ${html(state.data.sources.find(s => s.path === path || s.id === path)?.name || path)}`, 'source-link', `data-id="${html(path)}"`);

function render() {
  const d = state.data;
  const views = { inbox: '报修处理', drafts: '本地草稿', knowledge: '知识与关系', sources: '项目资料' };
  const nav = (id, glyph, caption, count) => `<button class="nav-item ${state.view === id ? 'active' : ''}" data-action="nav" data-view="${id}" aria-label="${caption}" ${state.view === id ? 'aria-current="page"' : ''}>${icon(glyph)}<span>${caption}</span>${count !== undefined ? `<span class="nav-count">${count}</span>` : ''}</button>`;
  $('#app').innerHTML = `<div class="shell">
    <aside class="sidebar">
      <a class="brand" href="/" aria-label="FF - 门店维修工作台首页"><img src="/brand/ff-logo.png" alt="FF Logo"><div><strong>门店维修</strong><span>FF · MAINTENANCE</span></div></a>
      <div class="workspace-label">工作空间</div><div class="workspace-select">${icon('store')} 华东一区 ${pill('本地')}</div>
      <nav aria-label="主导航">${nav('inbox', 'inbox', '报修处理', d.reports.length)}${nav('drafts', 'file', '本地草稿', d.drafts.length)}${nav('knowledge', 'graph', '知识与关系')}${nav('sources', 'file', '项目资料', d.sources.length)}</nav>
      <button class="knowledge-shortcut" data-action="nav" data-view="knowledge"><span class="knowledge-mark">${icon('graph')}</span><strong>项目知识，随时可查</strong><p>${d.graph.nodes} 个实体 · ${d.graph.edges} 条关系</p><span>查看已有图谱 ${icon('arrow')}</span></button>
      <div class="sidebar-bottom"><div class="connection"><span class="dot"></span> 本地服务已连接</div><p>规则 + 图谱快照<br>大模型未连接 · 无外部写入</p><div class="profile"><span>运</span><div><strong>总部运维</strong><small>人工审核工作区</small></div></div></div>
    </aside>
    <main class="main">
      <header class="toolbar"><div class="breadcrumb">${icon('store')} 华东一区 <span>/</span> <strong>${views[state.view]}</strong></div><div class="toolbar-actions"><span class="desktop-only">${icon('shield')} 本地草稿权限</span>${button('refresh', icon('refresh'), 'icon-button', 'aria-label="刷新数据" title="刷新数据"')}<span class="toolbar-avatar" aria-label="总部运维">运</span></div></header>
      <div class="page"><div class="page-heading"><div><span class="eyebrow">${state.view === 'inbox' ? 'OPERATIONS / 维修处理' : 'PROJECT / 项目工作空间'}</span><h1>${views[state.view]}</h1><p>${({ inbox: '让每一次报修，都有清晰的下一步。', drafts: '人工确认的处理记录。只在本地保存，尚未正式派单。', knowledge: '从真实关联出发，让每一条建议都有据可查。', sources: '所有判断，从项目已经拥有的材料开始。' })[state.view]}</p></div>${state.view === 'inbox' ? button('new', `${icon('plus')} 新建报修`, 'primary') : pill('当前项目', 'blue')}</div>
      ${state.view === 'inbox' ? inboxPage() : state.view === 'drafts' ? draftsPage() : state.view === 'knowledge' ? knowledgePage() : sourcesPage()}
      <footer>@赋范空间 独家研发 <span>仅供当前项目本地验证 · 不代表生产批准</span></footer></div>
    </main></div>`;
}

function inboxPage() {
  const d = state.data;
  const pending = d.reports.filter(r => !draftsFor(r.id).length).length;
  return `<section class="stats" aria-label="当前运行概况">
    <div class="stat stat-focus"><div class="stat-heading"><span>待处理报修</span><span class="stat-icon">${icon('inbox')}</span></div><div class="stat-number"><strong>${pending}</strong><span>条待留存处理记录</span></div><div class="stat-bottom"><span>已载入 ${d.reports.length} 条报修</span><span>从队列开始 ${icon('arrow')}</span></div></div>
    <div class="stat"><div class="stat-heading"><span>应急优先候选</span><span class="stat-icon orange">${icon('shield')}</span></div><div class="stat-number"><strong>${d.reports.filter(r => r.risk.priority === 'P0').length}</strong><span>条需要优先关注</span></div><div class="stat-bottom"><span class="status-indicator orange-text">现场应急先行</span><span>规则提示 · 人工接管</span></div></div>
    <div class="stat"><div class="stat-heading"><span>已保存本地草稿</span><span class="stat-icon green">${icon('check')}</span></div><div class="stat-number"><strong>${d.drafts.length}</strong><span>份可回读的处理记录</span></div><div class="stat-bottom"><span class="status-indicator green-text">本地留存</span><span>未执行正式派单</span></div></div>
  </section>
  <div class="workbench"><section class="queue card"><header class="queue-header"><h2>报修队列 <span>${d.reports.length}</span></h2><div class="search">${icon('search')}<input id="queue-search" type="search" placeholder="搜索门店、设备或报修…" value="${html(state.query)}" aria-label="搜索报修"></div><div class="segments"><button data-action="filter" data-filter="all" class="${state.filter === 'all' ? 'active' : ''}">全部</button><button data-action="filter" data-filter="urgent" class="${state.filter === 'urgent' ? 'active' : ''}">应急优先</button><button data-action="filter" data-filter="pending" class="${state.filter === 'pending' ? 'active' : ''}">待处理</button></div></header><div id="queue-list">${queueRows()}</div></section>
  <section class="detail card">${selected() ? reportDetail(selected()) : '<div class="empty">暂无报修，点击新建开始。</div>'}</section></div>`;
}

function queueRows() {
  let reports = state.data.reports.filter(r => `${r.id} ${r.storeId} ${r.assetText} ${r.symptom}`.toLowerCase().includes(state.query.toLowerCase()));
  if (state.filter === 'urgent') reports = reports.filter(r => r.risk.priority === 'P0');
  if (state.filter === 'pending') reports = reports.filter(r => !draftsFor(r.id).length);
  return reports.length ? reports.map(r => `<button class="queue-row ${r.id === state.activeId ? 'selected' : ''}" data-action="select" data-id="${html(r.id)}" aria-pressed="${r.id === state.activeId}"><div class="queue-row-top"><span class="queue-device">${icon(assetIcon(r))}</span><div><strong>${html(r.storeId)}</strong><h3>${html(r.assetText)}</h3></div>${priorityPill(r.risk)}</div><p>${html(r.symptom)}</p><small>${html(r.id)} <span>${draftsFor(r.id).length ? '已存草稿' : runFor(r.id) ? '待人工确认' : '待分析'}</span></small></button>`).join('') : '<div class="empty small">没有符合条件的报修。</div>';
}

function reportDetail(r) {
  const run = runFor(r.id);
  const saved = draftsFor(r.id);
  return `<div class="detail-top"><div class="detail-title"><span class="store-icon">${icon(assetIcon(r))}</span><div><div class="eyebrow">${html(r.storeId)} · ${html(r.id)}</div><h2>${html(r.assetText)}<span class="muted">报修</span></h2></div>${pill(r.origin === 'sample' ? '脱敏样本' : '本地录入')}</div>
    <ol class="case-progress" aria-label="当前报修处理状态"><li class="complete"><span>${icon('check')}</span>原始报修</li><li class="${run ? 'complete' : 'current'}"><span>${run ? icon('check') : '02'}</span>${run ? '候选已形成' : '待分析'}</li><li class="${saved.length ? 'complete' : run ? 'current' : ''}"><span>${saved.length ? icon('check') : '03'}</span>${saved.length ? '已保存草稿' : '人工确认'}</li></ol>
    <div class="risk-banner ${r.risk.priority === 'P0' ? 'critical' : ''}">${icon('shield')}<div><strong>${html(r.risk.title)}</strong><p>${html(r.risk.reason)}</p></div>${priorityPill(r.risk)}</div>
    <div class="original"><span class="eyebrow">原始报修</span><blockquote>${html(r.symptom)}</blockquote><div class="meta-row"><span>${icon('store')} ${html(r.impact || '影响待补充')}</span><span>${icon('clock')} ${formatTime(r.reportedAt)}</span></div></div>
    <div class="tabs" role="tablist"><button role="tab" aria-selected="${state.tab === 'analysis'}" class="${state.tab === 'analysis' ? 'active' : ''}" data-action="tab" data-tab="analysis">处理建议</button><button role="tab" aria-selected="${state.tab === 'context'}" class="${state.tab === 'context' ? 'active' : ''}" data-action="tab" data-tab="context">关联与证据 ${run ? `<span>${run.graph.nodes.length}</span>` : ''}</button><button role="tab" aria-selected="${state.tab === 'history'}" class="${state.tab === 'history' ? 'active' : ''}" data-action="tab" data-tab="history">处理记录</button></div></div>
    <div class="detail-body">${state.tab === 'history' ? historyContent(r) : !run ? `<div class="analysis-empty"><div class="analysis-intro"><span class="big-icon">${icon('spark')}</span><div><span class="eyebrow">下一步 / 整理处理依据</span><h3>把零散信息，整理成清晰建议。</h3><p>结合当前项目资料，核对这条报修的风险、设备与关联。</p></div></div><div class="analysis-capabilities"><div>${icon('shield')}<strong>风险与权限</strong><span>先核对处理边界</span></div><div>${icon('graph')}<strong>设备与关系</strong><span>检索真实关联信息</span></div><div>${icon('file')}<strong>来源与证据</strong><span>每条建议可回溯</span></div></div><div class="analysis-start"><span>未知信息保留待确认，不自动派单。<small>本地规则 + 已有图谱 · 不调用模型</small></span>${button('analyze', state.busy ? '正在分析…' : `${icon('spark')} 分析这条报修`, 'primary', state.busy ? 'disabled' : '')}</div></div>` : state.tab === 'context' ? contextContent(run) : analysisContent(run)}</div>
    ${run && state.tab !== 'history' ? `<div class="detail-actions"><div>${icon('shield')} <span>${saved.length ? `已保存 ${saved.length} 份本地草稿` : '建议已形成，等待人工核对'}<small>不会执行正式派单</small></span></div><div>${button('analyze', `${icon('refresh')} 重新分析`, '', state.busy ? 'disabled' : '')}${button('confirm', `${icon('check')} 核对并存草稿`, 'primary', state.busy ? 'disabled' : '')}</div></div>` : ''}`;
}

function analysisContent(run) {
  return `<div class="section-title"><h3>候选处理建议</h3>${pill(run.mode, 'blue')}</div>
    <div class="recommendations"><article><span class="recommendation-icon">${icon('network')}</span><span class="eyebrow">故障域</span><h3>${run.domains.map(d => html(d.label)).join(' / ')}</h3><p>${run.domains.length > 1 ? '先核对连接与终端状态，不把症状当根因。' : '按当前报修文本识别，仍需现场核实。'}</p></article><article><span class="recommendation-icon purple">${icon('monitor')}</span><span class="eyebrow">设备身份</span><h3>${run.assets.length === 1 ? html(run.assets[0].name) : run.assets.length ? `${run.assets.length} 台候选设备` : '需要核对设备'}</h3><p>${run.assets.map(d => `${html(d.id)}${d.status !== 'active' ? ' · 已停用' : ''}`).join('<br>') || '未在已有台账中找到确定匹配。'}</p></article></div>
    <div class="info-section"><div class="section-title"><h3>补充这些信息</h3>${pill(`${run.questions.length} 个关键问题`)}</div>${run.questions.length ? run.questions.map((q, i) => `<div class="question"><span>${i + 1}</span><p>${html(q)}</p></div>`).join('') : '<p class="muted">基本字段已提供，仍需核对合同和处理权限。</p>'}</div>
    ${run.duplicates.length ? `<div class="duplicate-box">${icon('inbox')}<div><strong>${run.duplicates.length} 条相似报修，先核对再建单</strong>${run.duplicates.map(d => `<p>${html(d.id)} · ${html(d.reason)}</p>`).join('')}<small>保留全部原消息，不自动删除或合并。</small></div></div>` : ''}
    <div class="info-section"><div class="section-title"><h3>可联系的维修商候选</h3>${pill('合同待核验', 'orange')}</div>${run.vendors.length ? run.vendors.map(v => `<div class="vendor"><span class="vendor-avatar">${html(v.name.slice(0, 1))}</span><div><strong>${html(v.name)}</strong><p>${html(v.id)} · 值班表 ${html(v.duty)}</p>${v.warning ? `<p class="warning-text">${html(v.warning)}</p>` : ''}</div>${icon('arrow')}</div>`).join('') : '<p class="muted">没有匹配当前范围的联系候选，交由运维确认。</p>'}</div>
    <details class="boundary"><summary>${icon('shield')} 本次处理边界 · ${run.warnings.length} 项</summary><ul>${run.warnings.map(w => `<li>${html(w)}</li>`).join('')}</ul></details>`;
}

function contextContent(run) {
  return `<div class="section-title"><h3>当前报修的关联关系</h3>${pill(`${run.graph.nodes.length} 实体 · ${run.graph.edges.length} 关系`, 'blue')}</div><p class="muted">按当前门店和设备查询两跳范围。点击实体查看来源；历史关系不等于本次故障结论。</p>${graphSvg(run.graph, true)}<div class="info-section"><h3>本次使用的资料</h3><div class="source-links">${run.evidence.map(sourceLink).join('')}</div></div><details class="boundary"><summary>查看实际处理过程</summary><ol class="run-steps">${run.steps.map(s => `<li><strong>${html(s.title)}</strong><p>${html(s.detail)}</p></li>`).join('')}</ol><small>${html(run.id)} · ${formatTime(run.createdAt)}</small></details>`;
}

function historyContent(r) {
  const runs = state.data.runs.filter(x => x.reportId === r.id).toReversed();
  const drafts = draftsFor(r.id).toReversed();
  return `<h3>已保存的本地草稿</h3>${drafts.length ? drafts.map(d => `<div class="history-row">${icon('file')}<div><strong>${html(d.id)}</strong><p>${html(d.operator)} · ${formatTime(d.createdAt)}</p></div>${button('draft', '查看', '', `data-id="${html(d.id)}"`)}</div>`).join('') : '<p class="muted">尚未确认保存草稿。</p>'}<div class="info-section"><h3>分析运行</h3>${runs.length ? runs.map(run => `<div class="history-row">${icon('check')}<div><strong>${html(run.id)}</strong><p>${run.graph.nodes.length} 个关联实体 · ${formatTime(run.createdAt)}</p></div>${pill('已生成候选', 'green')}</div>`).join('') : '<p class="muted">还未运行分析。</p>'}</div>`;
}

function draftsPage() {
  const drafts = state.data.drafts.toReversed();
  return `<section class="card full-card"><div class="section-title"><h2>已保存记录</h2>${pill(`${drafts.length} 份草稿`)}</div>${drafts.length ? `<div class="table-scroll"><table><thead><tr><th>草稿编号</th><th>门店 / 设备</th><th>建议等级</th><th>操作人</th><th>保存时间</th><th></th></tr></thead><tbody>${drafts.map(d => `<tr><td><strong>${html(d.id)}</strong><small>本地草稿 · 未派单</small></td><td>${html(d.report.storeId)}<small>${html(d.report.assetText)}</small></td><td>${pill(d.priority, d.priority.toLowerCase())}</td><td>${html(d.operator)}</td><td>${formatTime(d.createdAt)}</td><td>${button('draft', '查看记录', '', `data-id="${html(d.id)}"`)}</td></tr>`).join('')}</tbody></table></div>` : `<div class="empty"><span class="big-icon">${icon('file')}</span><h3>处理成果，会留在这里</h3><p>在报修页完成分析并人工确认，即可保存第一份本地草稿。</p>${button('nav', '去处理报修', 'primary', 'data-view="inbox"')}</div>`}</section>`;
}

function graphSvg(graph, compact = false) {
  if (!graph?.nodes.length) return '<div class="empty small">当前报修没有匹配的图谱实体，保持未知。</div>';
  const width = 940, height = compact ? 440 : 660;
  const groups = [...new Set(graph.nodes.map(n => n.type))];
  const positions = new Map();
  groups.forEach((type, gi) => {
    const nodes = graph.nodes.filter(n => n.type === type);
    const angle = 2 * Math.PI * gi / groups.length - Math.PI / 2;
    const centerX = width / 2 + Math.cos(angle) * (groups.length === 1 ? 0 : width * .32);
    const centerY = height / 2 + Math.sin(angle) * (groups.length === 1 ? 0 : height * .31);
    nodes.forEach((n, ni) => {
      const a = 2 * Math.PI * ni / nodes.length;
      const radius = nodes.length === 1 ? 0 : Math.min(compact ? 53 : 80, 23 + nodes.length * 4);
      positions.set(n.id, { x: centerX + Math.cos(a) * radius, y: centerY + Math.sin(a) * radius * .72 });
    });
  });
  const zoom = compact ? 1 : state.graphZoom;
  return `<div class="graph-canvas ${compact ? 'compact' : ''}"><svg viewBox="${width / 2 - width / (2 * zoom)} ${height / 2 - height / (2 * zoom)} ${width / zoom} ${height / zoom}" aria-label="当前项目关系图，点击或使用 Tab 选择实体">
    ${graph.edges.map(e => { const a = positions.get(e.source), b = positions.get(e.target); return a && b ? `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#b9c9dd" stroke-width="1.3"><title>${html(e.label)}</title></line>` : ''; }).join('')}
    ${graph.nodes.map(n => { const p = positions.get(n.id); const color = COLORS[n.type] || '#8e8e93'; return `<g class="graph-node" role="button" tabindex="0" data-action="node" data-id="${html(n.id)}" aria-label="查看 ${html(n.label)}"><circle cx="${p.x}" cy="${p.y}" r="13" fill="${color}" opacity=".1"/><circle cx="${p.x}" cy="${p.y}" r="5.5" fill="${color}" stroke="white" stroke-width="2"/><text x="${p.x}" y="${p.y + 24}" text-anchor="middle" fill="#475569" font-size="10.5">${html(n.label.length > 21 ? n.label.slice(0, 19) + '…' : n.label)}</text><title>${html(n.label)} · ${html(TYPE_LABELS[n.type] || n.type)}</title></g>`; }).join('')}
    </svg></div>`;
}

function knowledgePage() {
  const graph = state.graph;
  return `<section class="card full-card"><div class="section-title"><div><h2>项目知识图谱</h2><p class="muted">Semantica 已有快照 · 只读浏览 · 不在此重新构建</p></div><div class="graph-tools">${button('zoom-out', '−', 'icon-button', 'aria-label="缩小图谱"')}${button('zoom-reset', '复位')}${button('zoom-in', '+', 'icon-button', 'aria-label="放大图谱"')}</div></div>${graph ? `${graphSvg(graph)}<div class="graph-legend">${[...new Set(graph.nodes.map(n => n.type))].map(t => `<span><i style="background:${COLORS[t] || '#888'}"></i>${html(TYPE_LABELS[t] || t)}</span>`).join('')}</div><div class="graph-facts"><span><strong>${graph.nodes.length}</strong> 实体</span><span><strong>${graph.edges.length}</strong> 关系</span><span>本体 ${html(graph.ontologyVersion)}</span><span>快照 ${formatTime(graph.updatedAt)}</span></div>` : '<div class="empty">正在读取图谱…</div>'}</section>`;
}

function sourcesPage() {
  return `<div class="material-note">${icon('shield')} <p>当前材料为脱敏仿真案例，仅用于开发验证。原件只读，所有分析与草稿单独保存。</p></div><section class="card full-card"><div class="section-title"><h2>项目原始资料</h2>${pill(`${state.data.sources.length} 份`)}</div><div class="source-grid">${state.data.sources.map(s => `<button class="source-card" data-kind="${html(s.name.split('.').at(-1))}" data-action="source" data-id="${html(s.id)}"><div class="source-card-top"><span class="source-icon">${icon('file')}</span><span class="file-format">${html(s.name.split('.').at(-1).toUpperCase())}</span></div><strong>${html(s.name)}</strong><small>${(s.bytes / 1024).toFixed(1)} KB · 只读原件</small><span class="source-open">查看资料 ${icon('arrow')}</span></button>`).join('')}</div></section>`;
}

function openSheet(title, content, wide = false) {
  const sheet = $('#sheet');
  sheet.className = `sheet${wide ? ' wide' : ''}`;
  sheet.innerHTML = `<header><div><span class="eyebrow">门店维修 / 当前项目</span><h2>${html(title)}</h2></div>${button('close', icon('close'), 'icon-button', 'aria-label="关闭详情"')}</header><div class="sheet-body">${content}</div>`;
  if (!sheet.open) sheet.showModal();
}
function newReport() {
  openSheet('新建报修', `<p class="muted">保留门店的原始描述。缺少的信息可以留空，后续会提示补充。</p><form id="report-form"><label>门店<select name="storeId">${state.data.stores.map(s => `<option>${html(s)}</option>`).join('')}</select></label><label>设备描述<input name="assetText" required maxlength="300" placeholder="例如：卖场空调、收银终端"></label><label>故障原文<textarea name="symptom" required maxlength="3000" rows="4" placeholder="请保留报修人的实际描述"></textarea></label><div id="live-risk" role="status"></div><label>营业或安全影响<input name="impact" maxlength="300" placeholder="例如：全店交易中断 / 部分设备不可用"></label><label>设备编号 <span>可选</span><input name="assetId" maxlength="300" placeholder="不确定时留空"></label><label>首次出现时间 <span>可选</span><input name="reportedAt" type="datetime-local"></label><p class="form-error" role="alert"></p><button class="button primary" type="submit">${icon('plus')} 保存报修</button></form>`);
}

function confirmDraft() {
  const r = selected(), run = runFor(r.id);
  if (!run) return;
  const op = crypto.randomUUID();
  openSheet('核对并保存本地草稿', `<div class="draft-preview">${priorityPill(run.risk)}<h3>${html(r.storeId)} · ${html(r.assetText)}</h3><p>${html(r.symptom)}</p></div><div class="boundary-summary"><strong>仍需保留的限制</strong><ul>${run.warnings.map(w => `<li>${html(w)}</li>`).join('')}</ul></div><form id="draft-form" data-run="${html(run.id)}" data-operation="${op}"><label>操作人<input name="operator" required maxlength="80" autocomplete="name" placeholder="请输入实际确认人"></label><label>处理备注 <span>可选</span><textarea name="note" maxlength="2000" rows="3" placeholder="记录人工核对结果、未解决的问题与下一步"></textarea></label><label class="checkbox"><input name="confirmed" type="checkbox" required><span>我已核对以上候选、证据与待确认项。本次只保存本地草稿，不代表现场问题已解决、正式派单或费用批准。</span></label><p class="form-error" role="alert"></p><button class="button primary" type="submit">${icon('check')} 确认保存本地草稿</button></form>`);
}

async function showDraft(id) {
  const d = await api(`/api/drafts/${encodeURIComponent(id)}`);
  openSheet('已保存的本地草稿', `<div class="saved-banner">${icon('check')} 已从本地服务读回</div><h3>${html(d.id)}</h3><div class="draft-preview"><h3>${html(d.report.storeId)} · ${html(d.report.assetText)}</h3><p>${html(d.report.symptom)}</p>${pill(d.priority, d.priority.toLowerCase())}</div><dl class="definition-list"><dt>操作人</dt><dd>${html(d.operator)}</dd><dt>保存时间</dt><dd>${formatTime(d.createdAt)}</dd><dt>运行记录</dt><dd>${html(d.runId)}</dd><dt>外部写入</dt><dd>未执行</dd><dt>备注</dt><dd>${html(d.note || '未填写')}</dd></dl><h3>引用资料</h3><div class="source-links">${d.evidence.map(sourceLink).join('')}</div><h3>待确认与限制</h3><ul class="readable-list">${d.warnings.map(w => `<li>${html(w)}</li>`).join('')}</ul>${button('download', `${icon('download')} 导出草稿 JSON`, '', `data-id="${html(d.id)}"`)}`);
}

async function showSource(id) {
  const source = state.data.sources.find(s => s.id === id || s.path === id);
  if (!source) throw new Error('此来源没有映射到当前资料清单');
  const url = `/api/source?id=${encodeURIComponent(source.id)}`;
  if (/\.(png|pdf)$/i.test(source.name)) {
    openSheet(source.name, `<p class="muted">原始资料 · 只读查看</p>${source.name.endsWith('.png') ? `<img class="source-image" src="${url}" alt="${html(source.name)}">` : `<iframe class="document-frame" src="${url}" title="${html(source.name)}"></iframe>`}`, true);
  } else {
    const file = await api(url);
    openSheet(source.name, `<p class="muted">${html(source.id)} · 只读原件</p><pre class="source-text">${html(file.text)}</pre>`, true);
  }
}

async function showNode(id) {
  const graph = state.graph || (await api('/api/graph'));
  const node = graph.nodes.find(n => n.id === id);
  if (!node) throw new Error('实体已经变化，请刷新图谱');
  const edges = graph.edges.filter(e => e.source === id || e.target === id);
  openSheet('知识实体', `${pill(TYPE_LABELS[node.type] || node.type, 'blue')}<h2 class="entity-title">${html(node.label)}</h2><p>${html(node.summary || '没有额外摘要')}</p><dl class="definition-list"><dt>快照置信度</dt><dd>${node.confidence ?? '未记录'} <small>非独立验真结果</small></dd><dt>有效时间</dt><dd>${html(node.validFrom || '尚未明确')} → ${html(node.validUntil || '尚未明确')}</dd></dl><h3>直接关联 · ${edges.length}</h3>${edges.map(e => { const other = graph.nodes.find(n => n.id === (e.source === id ? e.target : e.source)); return `<button class="relation-row" data-action="node" data-id="${html(other?.id)}"><span>${html(e.label || e.type)}</span><strong>${html(other?.label || '未知实体')}</strong>${icon('arrow')}</button>`; }).join('') || '<p class="muted">没有直接关联。</p>'}<h3>原始来源</h3><div class="source-links">${(node.sourceRefs || []).map(sourceLink).join('') || '<p class="muted">来源尚未登记。</p>'}</div>`);
}

async function action(target) {
  const { action: name, id } = target.dataset;
  if (name === 'close') return $('#sheet').close();
  if (name === 'new') return newReport();
  if (name === 'select') { state.activeId = id; state.tab = 'analysis'; render(); return; }
  if (name === 'filter') { state.filter = target.dataset.filter; render(); return; }
  if (name === 'tab') { state.tab = target.dataset.tab; render(); return; }
  if (name === 'nav') {
    state.view = target.dataset.view; render();
    if (state.view === 'knowledge') { state.graph = await api('/api/graph'); if (state.view === 'knowledge') render(); }
    return;
  }
  if (name === 'refresh') { await refresh(); if (state.view === 'knowledge') state.graph = await api('/api/graph'); render(); notify('已读取最新项目记录'); return; }
  if (name === 'confirm') return confirmDraft();
  if (name === 'source') return showSource(id);
  if (name === 'node') return showNode(id);
  if (name === 'draft') return showDraft(id);
  if (name === 'download') {
    const draft = await api(`/api/drafts/${encodeURIComponent(id)}`);
    const url = URL.createObjectURL(new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `${id}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); return;
  }
  if (name.startsWith('zoom-')) { state.graphZoom = name === 'zoom-reset' ? 1 : Math.max(.65, Math.min(2, state.graphZoom + (name === 'zoom-in' ? .2 : -.2))); render(); return; }
  if (name === 'analyze' && !state.busy) {
    const reportId = state.activeId; state.busy = true; render();
    try { await api('/api/analyze', { reportId }); await refresh(); notify('分析已完成，请核对建议和未确认事项'); }
    finally { state.busy = false; render(); }
  }
}
document.addEventListener('click', event => { const t = event.target.closest('[data-action]'); if (t && !t.disabled) action(t).catch(e => notify(e.message, true)); });
document.addEventListener('keydown', event => { if (['Enter', ' '].includes(event.key) && event.target.matches('.graph-node')) { event.preventDefault(); action(event.target).catch(e => notify(e.message, true)); } });
document.addEventListener('input', event => {
  if (event.target.id === 'queue-search') { state.query = event.target.value; $('#queue-list').innerHTML = queueRows(); }
  if (event.target.name === 'symptom' || event.target.name === 'impact') {
    const form = event.target.closest('#report-form'); if (!form) return;
    const text = `${form.elements.symptom.value} ${form.elements.impact.value}`;
    $('#live-risk').innerHTML = /焦味|烟雾|漏电|发热|碎玻璃|全店.*中断|全店.*不能|人身|电气风险/.test(text) ? '<p class="live-warning">检测到风险描述：请优先联系现场负责人并按门店应急流程处理，不要等待系统。</p>' : '';
  }
});
document.addEventListener('submit', async event => {
  const form = event.target; if (!['report-form', 'draft-form'].includes(form.id)) return;
  event.preventDefault();
  const submit = form.querySelector('[type=submit]'); if (submit.disabled) return; submit.disabled = true;
  form.querySelector('.form-error').textContent = '';
  try {
    const values = Object.fromEntries(new FormData(form));
    if (form.id === 'report-form') {
      const report = await api('/api/reports', { ...values, region: 'east-1' });
      state.activeId = report.id; state.view = 'inbox'; state.tab = 'analysis'; state.filter = 'all'; state.query = '';
      await refresh(); $('#sheet').close(); render(); notify('报修已保存，原文保持不变');
    } else {
      const draft = await api('/api/drafts', { ...values, confirmed: values.confirmed === 'on', operationId: form.dataset.operation, runId: form.dataset.run });
      await refresh(); render(); await showDraft(draft.id); notify('本地草稿已保存并读回，未执行派单');
    }
  } catch (error) { form.querySelector('.form-error').textContent = error.message; }
  finally { submit.disabled = false; }
});
$('#sheet').addEventListener('click', event => { if (event.target === $('#sheet')) { const r = event.target.getBoundingClientRect(); if (event.clientX < r.left || event.clientY < r.top || event.clientY > r.bottom) event.target.close(); } });

refresh().then(render).catch(error => { $('#app').innerHTML = `<div class="boot"><h1>暂时无法读取项目</h1><p>${html(error.message)}</p><a class="button primary" href="/">重新加载</a></div>`; });
