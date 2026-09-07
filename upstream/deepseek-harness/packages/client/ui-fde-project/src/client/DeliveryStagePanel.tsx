/** Stage-specific delivery views over Host-verified project records. */
import { useEffect, useRef, useState } from 'react'
import type { V2DeliveryEvidence, V2DeliveryItem, V2DeliveryScope, V2DeliveryStatus, V2StageSurfaceSnapshot } from './controller.ts'
import type { ProjectStageWorkbenchHeroProps, ProjectStageWorkbenchViewProps } from './slots.ts'
import type { FdeV2StageId, ProjectStageValue } from './stage-controller.ts'
import css from './DeliveryStagePanel.module.css'

type Stage = 'pilot' | 'production' | 'improvement'
type Props = ProjectStageWorkbenchHeroProps | ProjectStageWorkbenchViewProps
const STAGES: readonly Stage[] = ['pilot', 'production', 'improvement']
const CONFIG = {
  pilot: { number: 6, title: '试点运行与交付', intro: '把已开发的项目放进获准的真实范围，核对接入、恢复能力和业务结果。', tabs: ['概览', '接入与准备', '运行与问题', '试点评审'], groups: [['authorization', 'integration', 'recovery'], ['authorization', 'integration', 'recovery'], ['technical', 'business', 'issue'], ['business', 'technical', 'issue']] },
  production: { number: 7, title: '生产与验收交接', intro: '生产在线、业务采用、客户验收和责任交接，分别留证，逐项确认。', tabs: ['生产与采用', '验收条件', '交付清单', '责任与实操'], groups: [['release', 'adoption'], ['acceptance'], ['deliverable'], ['handover']] },
  improvement: { number: 8, title: '运行反馈与持续改进', intro: '从可追溯的信号出发，验证改进，再决定是否发布与沉淀。', tabs: ['信号与发现', '改进事项', '影响与验证', '发布与复用'], groups: [['signal'], ['change'], ['impact', 'validation'], ['release', 'reuse']] },
} as const
const LABELS: Record<string, string> = { authorization: '范围与授权', integration: '系统与数据接入', recovery: '接管与恢复', technical: '技术运行', business: '业务结果', issue: '问题与异常', release: '发布记录', adoption: '业务采用', acceptance: '客户验收', deliverable: '交付物', handover: '责任与实操', signal: '信号与发现', change: '改进事项', impact: '影响范围', validation: '回归验证', reuse: '复用候选' }
const STATUS: Record<V2DeliveryStatus, string> = { unknown: '尚未确认', pending: '待处理', running: '已记录运行', passed: '证据已登记', failed: '已记录失败', blocked: '受阻', not_applicable: '不适用', stale: '证据待重核' }
const SCOPE: Record<V2DeliveryScope, string> = { local: '本地', sandbox: 'Sandbox', pilot: '试点', production: '生产', prior: '前序材料' }

function EvidenceLinks({ files, open }: { readonly files: readonly V2DeliveryEvidence[]; readonly open: (path: string) => void }) {
  return <div className={css.evidence}>{files.length === 0 ? <p>尚无文件证据</p> : files.map((file, index) => <button type="button" key={`${file.path}-${index}`} disabled={file.status !== 'present'} onClick={() => { open(file.path) }} title={file.message ?? file.path}>
    <span>↗ {file.path}</span><small>{file.current ? '摘要一致' : file.status !== 'present' ? '无法读取' : '内容已变化'}</small>
  </button>)}</div>
}

/** Render delivery facts without starting services, approving results, or advancing on view. */
export function DeliveryStagePanel({ props, workspace, sessionId, stage, actualStage, stageState, surface, view }: {
  readonly props: Props
  readonly workspace: { readonly workspaceId: string; readonly title: string; readonly path: string }
  readonly sessionId: string
  readonly stage: Stage
  readonly actualStage: FdeV2StageId
  readonly stageState: ProjectStageValue
  readonly surface: V2StageSurfaceSnapshot | undefined
  readonly view: boolean
}) {
  const [tab, setTab] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [returning, setReturning] = useState(false)
  const [reason, setReason] = useState('')
  const dialog = useRef<HTMLDialogElement>(null)
  const data = surface?.delivery
  const items = data?.items ?? []
  const selected = items.find(item => item.id === selectedId)
  const config = CONFIG[stage]
  const readonly = actualStage !== stage
  const completedCycles = stage === 'improvement' ? stageState.improvementCycles ?? 0 : 0
  const ready = surface?.reviewReady === true && data?.status === 'ready' && data.reviewBlockers.length === 0
  const issues = [...new Set(surface?.reviewBlockers ?? ['正在读取本阶段记录。'])]
  const groups: readonly string[] = config.groups[tab] ?? []

  useEffect(() => {
    if (selected !== undefined) dialog.current?.showModal()
    else dialog.current?.close()
  }, [selected])

  const perform = async (operation: () => Promise<void>): Promise<void> => {
    setBusy(true); setError(null)
    try { await operation() } catch (cause: unknown) { setError(cause instanceof Error ? cause.message : String(cause)) }
    finally { setBusy(false) }
  }
  const openFile = (path: string): void => { void perform(() => props.openProjectFile(sessionId, workspace.path, path, path.split('/').pop() ?? path)) }
  const prepare = (item?: V2DeliveryItem): void => {
    if (readonly) return
    props.prepareStageDraft(sessionId, `请继续处理第 ${config.number} 阶段“${config.title}”的${item === undefined ? config.tabs[tab] : item.title}。先读取 ${surface?.statePath} 和当前版本、来源证据。${item?.nextAction ?? ''}只按真实执行结果更新 delivery 记录；区分本地、Sandbox、试点与生产。不代替 FDE 或客户批准；未授权不部署、不执行生产写入、不推进阶段。`)
  }
  const rows = (category: string) => {
    const records = items.filter(item => item.category === category)
    return <section key={category} className={css.card} aria-label={LABELS[category]}>
      <header><h2>{LABELS[category]}</h2><span className={css.caption}>{records.length ? `${records.length} 项记录` : '尚无记录'}</span></header>
      {records.length === 0 ? <div className={css.empty}><span aria-hidden="true">＋</span><strong>等待{LABELS[category]}证据</strong><p>记录真实范围、版本、责任人与来源后，这里会同步显示。</p>{!readonly && <button type="button" onClick={() => { prepare() }}>在 Agent 中处理</button>}</div> : <div className={css.records}>{records.map(item => <button type="button" className={css.record} key={item.id} onClick={() => { setSelectedId(item.id) }}>
        <span className={css.recordTop}><small>{SCOPE[item.scope]} · {item.version}</small><span className={css.badge} data-status={item.status}>{STATUS[item.status]}</span></span>
        <strong>{item.title}</strong><p>{item.summary}</p>
        <span className={css.recordBottom}><span>{item.owner ?? '责任人待确认'}</span><span>证据与详情 ↗</span></span>
      </button>)}</div>}
    </section>
  }
  const acceptance = <section className={css.card}><header><h2>逐项对照验收条件</h2><p>结果、版本、接收方与证据共同构成验收依据。</p></header><div className={css.tableScroll} tabIndex={0} role="region" aria-label="验收条件表"><table><thead><tr><th>验收项 / 标准</th><th>受测版本</th><th>结果</th><th>确认责任人</th><th>证据</th></tr></thead><tbody>{items.filter(item => item.category === 'acceptance').map(item => <tr key={item.id}><td><strong>{item.title}</strong><p>{item.criterion ?? '标准待明确'}</p></td><td>{item.version}</td><td><span className={css.badge} data-status={item.status}>{STATUS[item.status]}</span></td><td>{item.owner ?? '待确认'}</td><td><button type="button" onClick={() => { setSelectedId(item.id) }}>查看</button></td></tr>)}</tbody></table></div>{!items.some(item => item.category === 'acceptance') && <p className={css.empty}>尚未登记客户验收条件，不能用服务在线替代客户签收。</p>}</section>

  return <section className={css.root} data-fde-stage-workbench="" data-stage={stage} data-delivery-workbench=""
    data-conversation-hero-project="" data-hide-stage-composer={readonly ? 'true' : undefined}
    data-conversation-composer-layout={readonly ? 'stage-history' : 'stage-evaluation'}
    data-conversation-composer-overlay={view ? '' : undefined} data-readonly={readonly ? 'true' : undefined}
    aria-label={config.title}>
    {readonly && <div className={css.notice}><span>阶段记录 · 只读查看</span><button type="button" onClick={() => { props.returnToCurrentStage(workspace.workspaceId) }}>返回当前阶段</button></div>}
    <header className={css.hero}>
      <div><span className={css.eyebrow}>第 {config.number} / 8 阶段 · 项目工作台</span><h1>{config.title}</h1><p>{config.intro}</p><div className={css.heroMeta}><span>{data?.version || '版本待登记'}</span><span>{data?.environment.label ?? '环境待登记'}</span><span>{completedCycles > 0 ? `已完成 ${completedCycles} 轮改进` : readonly ? '阶段记录' : ready ? '可提交人工评审' : '仍有待核对事项'}</span></div></div>
      <div className={css.stageMark} aria-hidden="true"><span>{String(config.number).padStart(2, '0')}</span><small>{stage === 'pilot' ? '限定运行' : stage === 'production' ? '责任交付' : '持续循环'}</small></div>
    </header>
    <div className={css.toolbar}><nav aria-label="交付阶段预览">{STAGES.map(key => <button type="button" key={key} aria-current={key === stage ? 'page' : undefined} onClick={() => { props.viewProjectStage(workspace.workspaceId, key) }}>{CONFIG[key].number} · {CONFIG[key].title}</button>)}</nav><button type="button" disabled={busy} onClick={() => { props.refreshProjectSurface(workspace.workspaceId) }}>↻ 刷新记录</button></div>
    {error !== null && <p className={css.error} role="alert">{error}</p>}
    {surface === undefined ? <section className={css.card} role="status"><h2>正在读取阶段记录</h2><p>读取失败可刷新重试，不会启动服务或执行部署。</p></section> : <>
      {data?.status !== 'ready' && <div className={css.notice} role={data?.status === 'invalid' ? 'alert' : 'status'}>{data?.message ?? '尚未登记专用交付记录，固定产物仍可查看。'}</div>}
      <div className={css.stats}>{(stage === 'pilot' ? ['authorization', 'integration', 'technical', 'business'] : stage === 'production' ? ['release', 'adoption', 'acceptance', 'handover'] : ['signal', 'change', 'validation', 'release']).map(category => {
        const records = items.filter(item => item.category === category)
        const count = records.filter(item => item.status === 'passed').length
        const context = records.length && records.every(item => item.scope === 'local' || item.scope === 'prior') ? '仅本地或前序材料' : '按记录范围核对'
        return <div className={css.stat} key={category}><span>{LABELS[category]}</span><strong>{records.length ? `${count} / ${records.length}` : '待登记'}</strong><small>{records.length ? `有效证据项 · ${context}` : '没有记录，不视为零故障或已完成'}</small></div>
      })}</div>
      <div className={css.tabs} role="tablist" aria-label={config.title}>{config.tabs.map((label, index) => <button type="button" role="tab" aria-selected={tab === index} aria-controls={`delivery-${stage}-panel`} id={`delivery-${stage}-tab-${index}`} tabIndex={tab === index ? 0 : -1} key={label} onClick={() => { setTab(index) }} onKeyDown={event => {
        if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return
        event.preventDefault()
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? 3 : (tab + (event.key === 'ArrowRight' ? 1 : 3)) % 4
        setTab(next); document.getElementById(`delivery-${stage}-tab-${next}`)?.focus()
      }}>{label}</button>)}</div>
      <div role="tabpanel" id={`delivery-${stage}-panel`} aria-labelledby={`delivery-${stage}-tab-${tab}`} className={css.panel}>
        <div className={css.sectionTitle}><div><span className={css.eyebrow}>{String(tab + 1).padStart(2, '0')} / {config.tabs[tab]}</span><h2>{stage === 'pilot' && tab === 0 ? '先确认能负责运行，再看运行结果' : stage === 'improvement' && tab === 1 ? '每项改进都要有依据和下一动作' : config.tabs[tab]}</h2></div>{!readonly && <button type="button" onClick={() => { prepare() }}>在 Agent 中处理 ↗</button>}</div>
        {stage === 'production' && tab === 1 ? acceptance : <div className={css.grid}>{groups.map(rows)}</div>}
        {data?.semantic !== undefined && (tab === 0 || stage === 'pilot' && tab === 1 || stage === 'improvement' && tab === 2) && <section className={css.semantic}><header><span className={css.semanticIcon} aria-hidden="true">◇</span><div><span className={css.eyebrow}>项目语义依赖</span><h2>{data.semantic.mode === 'snapshot' ? '图谱快照已登记 · 非在线查询服务' : '已登记运行时接入证据 · 仍按授权范围核对'}</h2></div></header><p>{data.semantic.summary}</p><dl className={css.facts}><div><dt>Schema</dt><dd>{data.semantic.schemaVersion}</dd></div><div><dt>图谱修订</dt><dd>{data.semantic.graphRevision}</dd></div></dl><EvidenceLinks files={data.semantic.evidence} open={openFile} /></section>}
      </div>
      <section className={css.card}><header><div><span className={css.eyebrow}>版本与固定记录</span><h2>证据随项目更新，不随页面猜测</h2></div><span className={css.badge}>{surface.presentCount} / {surface.requiredCount} 份文件可读</span></header>
        <div className={css.artifacts}>{surface.artifacts.map(artifact => <button type="button" key={artifact.id} disabled={artifact.status !== 'present' || busy} onClick={() => { openFile(artifact.path) }}><span>▤ <strong>{artifact.title}</strong><small>{artifact.purpose}</small></span><small>{artifact.status === 'present' ? '查看 ↗' : '尚未形成'}</small></button>)}</div>
        <details><summary>查看版本文件清单 · {data?.versionCurrent ? '摘要一致' : '待核对'}</summary><EvidenceLinks files={data?.versionFiles ?? []} open={openFile} /></details>
      </section>
      <section className={css.gate}><header><div><span className={css.eyebrow}>FDE 人工决定</span><h2>{completedCycles > 0 ? '本轮已完成，持续跟进下一轮改进' : stage === 'improvement' ? '改进是新一轮验证，不是自动发布' : readonly ? '查看阶段评审记录' : ready ? '证据已齐备，等待人工核对' : '继续补齐交付依据'}</h2></div><span className={css.badge}>{issues.length} 项待核对</span></header>
        {completedCycles > 0 && <p>已完成 {completedCycles} 轮 · 最近评审：{stageState.lastReviewedAt ?? '未登记'}</p>}
        {issues.length > 0 && <details open={issues.length < 4}><summary>查看当前评审缺口</summary><ul>{issues.map(issue => <li key={issue}>{issue}</li>)}</ul></details>}
        <p>{readonly ? '当前是只读预览，不能在这里批准、执行或推进阶段。' : '文件可读和技术运行不替代业务验收；只有有权人员的决定才能进入下一责任阶段。'}</p>
        {!readonly && <><div className={css.actions}><button type="button" className={css.primary} disabled={!ready || busy} onClick={() => { setConfirming(true) }}>{stage === 'improvement' ? '评审本轮改进' : '提交 FDE 评审'}</button><button type="button" disabled={busy} onClick={() => { setReturning(!returning) }}>返回上一阶段</button></div>
          {confirming && ready && <div className={css.confirm}><strong>已核对本轮范围、版本、证据与责任？</strong><p>{stage === 'improvement' ? '只记录本轮改进评审，仍停留在第八阶段，不执行生产发布。' : '确认后进入下一阶段，不自动部署或替客户签收。'}</p><div className={css.actions}><button type="button" disabled={busy} onClick={() => { void perform(() => props.completeV2Stage(workspace.workspaceId, stageState.revision, stage)) }}>确认并继续</button><button type="button" onClick={() => { setConfirming(false) }}>取消</button></div></div>}
          {returning && <div className={css.confirm}><label htmlFor="delivery-return">返回原因</label><textarea id="delivery-return" value={reason} onChange={event => { setReason(event.target.value) }} /><button type="button" disabled={!reason.trim() || busy} onClick={() => { void perform(() => props.returnV2Stage(workspace.workspaceId, stageState.revision, reason.trim())) }}>保留证据并返回</button></div>}
        </>}
      </section>
    </>}
    <footer className={css.footer}>@赋范空间 独家研发</footer>
    <dialog ref={dialog} className={css.drawer} aria-labelledby="delivery-detail-title" onCancel={() => { setSelectedId(null) }} onClick={event => { if (event.target === event.currentTarget) setSelectedId(null) }}>
      {selected !== undefined && <div className={css.drawerBody}><header><span className={css.eyebrow}>{LABELS[selected.category]} · 记录详情</span><button type="button" aria-label="关闭详情" onClick={() => { setSelectedId(null) }}>✕</button></header><h2 id="delivery-detail-title">{selected.title}</h2><span className={css.badge} data-status={selected.status}>{STATUS[selected.status]}</span><p>{selected.summary}</p><dl className={css.facts}><div><dt>原记录声明</dt><dd>{STATUS[selected.declaredStatus]}</dd></div><div><dt>适用环境</dt><dd>{SCOPE[selected.scope]}</dd></div><div><dt>版本</dt><dd>{selected.version}</dd></div><div><dt>责任人 / 确认人</dt><dd>{selected.owner ?? '待确认'}</dd></div><div><dt>观察时间</dt><dd>{selected.observedAt ?? '未登记'}</dd></div><div><dt>判定标准</dt><dd>{selected.criterion ?? '待明确'}</dd></div></dl><h3>下一动作</h3><p>{selected.nextAction ?? '根据证据确认是否需要后续处理。'}</p><h3>来源证据</h3><EvidenceLinks files={selected.evidence} open={path => { setSelectedId(null); openFile(path) }} />{!readonly && <button type="button" className={css.primary} onClick={() => { setSelectedId(null); prepare(selected) }}>在 Agent 中处理此项</button>}</div>}
    </dialog>
  </section>
}
