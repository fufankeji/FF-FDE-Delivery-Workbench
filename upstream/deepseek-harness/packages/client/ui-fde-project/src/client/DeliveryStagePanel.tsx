/** Stage-specific delivery views over Host-verified project records. */
import { useEffect, useRef, useState } from 'react'
import type { V2DeliveryEvidence, V2DeliveryItem, V2DeliveryScope, V2DeliveryStatus, V2StageSurfaceSnapshot } from './controller.ts'
import type { ProjectStageWorkbenchHeroProps, ProjectStageWorkbenchViewProps } from './slots.ts'
import type { FdeV2StageId, ProjectStageValue } from './stage-controller.ts'
import { FDE_V2_STAGE_IDS } from './stage-controller.ts'
import { DeliveryIcon } from './DeliveryIcon.tsx'
import { ProductionRecord } from './ProductionRecord.tsx'
import css from './DeliveryStagePanel.module.css'

type Stage = 'pilot' | 'production' | 'improvement'
type Props = ProjectStageWorkbenchHeroProps | ProjectStageWorkbenchViewProps
const STAGES: readonly Stage[] = ['pilot', 'production', 'improvement']
const CONFIG = {
  pilot: { number: 6, title: '试点运行与交付', intro: '把已开发的项目放进获准的真实范围，核对接入、恢复能力和业务结果。', tabs: ['概览', '接入与准备', '运行与问题', '试点评审'], groups: [['authorization', 'integration', 'recovery'], ['authorization', 'integration', 'recovery'], ['technical', 'business', 'issue'], ['business', 'technical', 'issue']] },
  production: { number: 7, title: '生产与验收交接', intro: '逐项核对生产运行、用户使用、客户验收和运维交接记录。', tabs: ['生产与使用', '验收条件', '交付清单', '培训与运维交接'], groups: [['release', 'adoption'], ['acceptance'], ['deliverable'], ['handover']] },
  improvement: { number: 8, title: '运行反馈与持续改进', intro: '根据运行问题选择改进，验证效果后决定是否发布，并记录可复用的方法与组件。', tabs: ['运行问题与反馈', '改进事项', '影响与验证', '发布与复用'], groups: [['signal'], ['change'], ['impact', 'validation'], ['release', 'reuse']] },
} as const
const LABELS: Record<string, string> = { authorization: '范围与授权', integration: '系统与数据接入', recovery: '接管与恢复', technical: '技术运行', business: '业务结果', issue: '问题与异常', release: '发布记录', adoption: '用户使用', acceptance: '客户验收', deliverable: '交付物', handover: '培训与运维交接', signal: '运行问题与反馈', change: '改进事项', impact: '影响范围', validation: '回归验证', reuse: '可复用方法与组件' }
const STATUS: Record<V2DeliveryStatus, string> = { unknown: '尚未确认', pending: '待处理', running: '已记录运行', passed: '证据已登记', failed: '已记录失败', blocked: '受阻', not_applicable: '不适用', stale: '证据需重新核对' }
const SCOPE: Record<V2DeliveryScope, string> = { local: '本地', sandbox: '沙箱测试', pilot: '试点', production: '生产', prior: '前序材料' }
const CATEGORY_ICONS: Record<string, string> = { authorization: 'shield', integration: 'database', technical: 'server', business: 'chart', release: 'file', adoption: 'users', acceptance: 'shield', handover: 'person' }

function EvidenceLinks({ files, open, decorated = false }: { readonly files: readonly V2DeliveryEvidence[]; readonly open: (path: string) => void; readonly decorated?: boolean }) {
  return <div className={css.evidence}>{files.length === 0 ? <p>尚无文件证据</p> : files.map((file, index) => <button type="button" key={`${file.path}-${index}`} disabled={file.status !== 'present'} onClick={() => { open(file.path) }} title={file.message ?? file.path}>
    <span>{decorated ? <DeliveryIcon kind={/\.[cm]?[jt]sx?$/.test(file.path) ? 'code' : 'file'} /> : '↗ '}{file.path}</span><small data-current={file.current}>{file.current ? '文件校验一致' : file.status !== 'present' ? '无法读取' : '内容已变化'}</small>{decorated && <DeliveryIcon kind="external" />}
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
  const pilot = stage === 'pilot'
  const production = stage === 'production'
  const improvement = stage === 'improvement'
  const improvementRecord = surface?.artifacts.find(artifact => artifact.id === 'improvement-record')
  const actualIndex = FDE_V2_STAGE_IDS.indexOf(actualStage) + 1
  const semantic = data?.semantic
  // These are reported observations, not newly executed measurements.
  const entityCount = semantic?.summary.match(/(\d+)\s*(?:个)?实体/)?.[1]
  const relationCount = semantic?.summary.match(/(\d+)\s*(?:条)?关系/)?.[1]
  const semanticModule = semantic?.evidence.find(file => /\.[cm]?[jt]sx?$/.test(file.path))
  const graphFile = semantic?.evidence.find(file => file.path.endsWith('knowledge-graph.json'))
  const [copyNotice, setCopyNotice] = useState('')
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
    if (production && (category === 'release' || category === 'adoption') && records.length > 0) return <section key={category} className={css.productionRecords} data-category={category} aria-label={LABELS[category]}>{records.map(item => <ProductionRecord key={item.id} item={item} statusLabel={STATUS[item.status]} scopeLabel={SCOPE[item.scope]} onOpen={() => { setSelectedId(item.id) }} />)}</section>
    return <section key={category} className={css.card} data-category={category} aria-label={LABELS[category]}>
      <header><h2>{LABELS[category]}</h2><span className={css.caption}>{records.length ? `${records.length} 项记录` : '尚无记录'}</span></header>
      {records.length === 0 ? <div className={css.empty}><span aria-hidden="true">＋</span><strong>等待{LABELS[category]}证据</strong><p>记录真实范围、版本、责任人与来源后，这里会同步显示。</p>{!readonly && <button type="button" onClick={() => { prepare() }}>在 Agent 中处理</button>}</div> : <div className={css.records}>{records.map(item => <button type="button" className={css.record} key={item.id} onClick={() => { setSelectedId(item.id) }}>
        <span className={css.recordTop}><small>{SCOPE[item.scope]} · {item.version}</small><span className={css.badge} data-status={item.status}>{STATUS[item.status]}</span></span>
        <strong>{item.title}</strong>
        {pilot && category === 'recovery' && item.summary.match(/(\d+)\s*分\s*(\d+)\s*秒/) !== null && <div className={css.recoveryMetric}><strong>{item.summary.match(/(\d+)\s*分\s*(\d+)\s*秒/)?.[1]}<small>分</small>{item.summary.match(/(\d+)\s*分\s*(\d+)\s*秒/)?.[2]}<small>秒</small></strong><span>记录中的恢复用时</span><span className={css.recoveryCriterion}>{item.criterion ?? '判定标准待明确'}</span></div>}
        <p>{item.summary}</p>
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
    {readonly && <div className={css.notice}><span>{(pilot || production) && <DeliveryIcon kind="history" />}{pilot || production ? `正在查看第 ${config.number} 阶段${actualIndex > config.number ? '历史记录' : '预览'} · 项目当前处于第 ${actualIndex} 阶段 · 只读查看` : '阶段记录 · 只读查看'}</span><button type="button" onClick={() => { props.returnToCurrentStage(workspace.workspaceId) }}>返回当前阶段{(pilot || production) && <span aria-hidden="true">→</span>}</button></div>}
    <header className={css.hero}>
      <div><span className={css.eyebrow}>第 {config.number} / 8 阶段 · {improvement && !readonly ? '当前阶段' : '项目工作台'}</span><h1>{config.title}</h1><p data-pilot-intro>{config.intro}</p><div className={css.heroMeta}><span>{data?.version || '版本待登记'}</span><span>{data?.environment.label ?? '环境待登记'}</span><span>{completedCycles > 0 ? `已完成 ${completedCycles} 轮改进` : readonly ? '阶段记录' : ready ? '可提交人工评审' : '仍有待核对事项'}</span></div></div>
      {improvement && <img data-improvement-art className={css.improvementArtwork} src="/fde-dashboard/improvement-panels.png" alt="" />}
      {pilot && <img data-pilot-art className={css.heroArtwork} src="/fde-dashboard/pilot-delivery-lab.png" alt="" />}
      <div className={css.stageMark} aria-hidden="true"><span>{String(config.number).padStart(2, '0')}</span><small>{stage === 'pilot' ? '受控试点' : stage === 'production' ? '验收交接' : '持续改进'}</small></div>
    </header>
    <div className={css.toolbar}><nav aria-label="交付阶段预览">{STAGES.map(key => <button type="button" key={key} aria-current={key === stage ? 'page' : undefined} onClick={() => { props.viewProjectStage(workspace.workspaceId, key) }}>{CONFIG[key].number} · {CONFIG[key].title}{key === actualStage && <small className={css.currentTag}>当前</small>}</button>)}</nav><button data-pilot-refresh type="button" disabled={busy} onClick={() => { props.refreshProjectSurface(workspace.workspaceId) }}>{<DeliveryIcon kind="refresh" />}刷新记录</button></div>
    {error !== null && <p className={css.error} role="alert">{error}</p>}
    {surface === undefined ? <section className={css.card} role="status"><h2>正在读取阶段记录</h2><p>读取失败可刷新重试，不会启动服务或执行部署。</p></section> : <>
      {data?.status !== 'ready' && <div className={css.notice} role={data?.status === 'invalid' ? 'alert' : 'status'}>{data?.message ?? '尚未登记详细交付情况，可先查看已保存的阶段文件。'}</div>}
      <div className={css.stats}>{(stage === 'pilot' ? ['authorization', 'integration', 'technical', 'business'] : stage === 'production' ? ['release', 'adoption', 'acceptance', 'handover'] : ['signal', 'change', 'validation', 'release']).map(category => {
        const records = items.filter(item => item.category === category)
        const count = records.filter(item => item.status === 'passed').length
        const context = records.length && records.every(item => item.scope === 'local' || item.scope === 'prior') ? '仅本地或前序材料' : '按记录范围核对'
        const notApplicable = records.filter(item => item.status === 'not_applicable').length
        return <div className={css.stat} key={category} data-incomplete={improvement && records.length > 0 && count < records.length ? 'true' : undefined}>{(pilot || production) && <DeliveryIcon className={css.statIcon} kind={CATEGORY_ICONS[category] ?? 'file'} />}<span>{LABELS[category]}</span><strong>{records.length ? `${count} / ${records.length}` : '待登记'}</strong><small data-improvement-caption={improvement && category === 'signal' ? '' : undefined} data-pilot-caption={category === 'authorization' ? '' : undefined}>{records.length ? `有效证据项 · ${context}` : '没有记录，不视为零故障或已完成'}</small>{pilot && notApplicable > 0 && <span className={css.notApplicable}>{notApplicable} 项不适用</span>}</div>
      })}</div>
      <div className={improvement ? css.improvementWorkspace : css.deliveryWorkspace}>
      <div className={css.tabs} role="tablist" aria-label={config.title}>{config.tabs.map((label, index) => <button type="button" role="tab" aria-selected={tab === index} aria-controls={`delivery-${stage}-panel`} id={`delivery-${stage}-tab-${index}`} tabIndex={tab === index ? 0 : -1} key={label} onClick={() => { setTab(index) }} onKeyDown={event => {
        if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return
        event.preventDefault()
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? 3 : (tab + (event.key === 'ArrowRight' ? 1 : 3)) % 4
        setTab(next); document.getElementById(`delivery-${stage}-tab-${next}`)?.focus()
      }}>{label}</button>)}</div>
      <div role="tabpanel" id={`delivery-${stage}-panel`} aria-labelledby={`delivery-${stage}-tab-${tab}`} className={css.panel}>
        {improvement && <div className={css.improvementNext}><div><span className={css.eyebrow}>现在先做</span><h3>核对改进内容与验证结果</h3><p>从具体问题进入，查看本轮改动、验证和发布记录，再决定后续处理。</p></div><div className={css.actions}><button type="button" className={css.primary} disabled={busy || improvementRecord?.status !== 'present'} onClick={() => { if (improvementRecord !== undefined) openFile(improvementRecord.path) }}>查看改进与验证记录</button>{!readonly && <button type="button" onClick={() => { prepare() }}>在 Agent 中处理 ↗</button>}</div></div>}
        <div className={css.sectionTitle}><div><span className={css.eyebrow}>{String(tab + 1).padStart(2, '0')} / {config.tabs[tab]}</span>{!(production && tab === 0) && <h2 data-pilot-section-title>{stage === 'pilot' && tab === 0 ? '核对试点授权、系统接入与故障恢复' : improvement && tab === 0 ? '先看具体问题，再核对改进证据' : stage === 'improvement' && tab === 1 ? '核对每项改进的原因与下一步操作' : config.tabs[tab]}</h2>}</div>{improvement ? <span className={css.caption}>{data === undefined ? '环境待登记' : `${SCOPE[data.environment.kind]} · ${data.version}`}　 {items.filter(item => groups.includes(item.category)).length} 项记录</span> : !readonly && <button type="button" onClick={() => { prepare() }}>在 Agent 中处理 ↗</button>}</div>
        {improvement && tab === 0 && items.some(item => item.category === 'signal') ? <div className={css.signalTable} tabIndex={0} role="region" aria-label="运行问题与反馈表"><table><thead><tr><th>问题与反馈</th><th>现场证据</th><th>处理结论与适用范围</th><th>负责人 / 操作</th></tr></thead><tbody>{items.filter(item => item.category === 'signal').map(item => {
          // Separate only explicit clauses; never infer causes or strip scope qualifiers.
          const [observation, ...judgment] = item.summary.split('；')
          const [code, ...title] = item.title.split(' · ')
          return <tr key={item.id}><td><strong>{code}</strong>{title.length > 0 && <span>{title.join(' · ')}</span>}<span className={css.badge} data-status={item.status}>{STATUS[item.status]}</span></td><td>{observation}</td><td>{judgment.length > 0 ? judgment.join('；') : item.criterion ?? '处理结论与适用范围待明确'}</td><td><div><span>{item.owner ?? '责任人待确认'}</span><button type="button" onClick={() => { setSelectedId(item.id) }}>证据与详情 <DeliveryIcon kind="external" /></button></div></td></tr>
        })}</tbody></table></div> : stage === 'production' && tab === 1 ? acceptance : <div className={css.grid} data-pilot-cards>{groups.map(rows)}</div>}
        {production && tab === 0 && <div className={css.productionShortcuts}>{(['acceptance', 'handover'] as const).map((category, index) => {
          const records = items.filter(item => item.category === category)
          return <button type="button" key={category} onClick={() => { setTab(index === 0 ? 1 : 3); document.getElementById(`delivery-production-tab-${index === 0 ? 1 : 3}`)?.focus() }}><DeliveryIcon kind={CATEGORY_ICONS[category]!} /><span>{LABELS[category]} · {records.filter(item => item.status === 'passed').length}/{records.length} 项有效证据</span><small>{index === 0 ? '查看验收条件' : '查看培训与运维交接'} →</small></button>
        })}</div>}
        {semantic !== undefined && !production && !improvement && (tab === 0 || stage === 'pilot' && tab === 1) && (pilot ?
          <section className={css.semantic} data-pilot-semantic>
            <header><DeliveryIcon className={css.semanticIcon} kind="cube" /><div><span className={css.eyebrow}>02 / 知识图谱接入与版本</span><div className={css.semanticTitle}><h2>{semantic.mode === 'snapshot' ? '图谱快照已登记' : '已登记运行时接入证据'}</h2><span className={css.badge} data-status={semantic.mode === 'snapshot' ? 'blocked' : undefined}>{semantic.mode === 'snapshot' ? '非在线查询服务' : '仍按授权范围核对'}</span></div></div></header>
            <div className={css.semanticBody}>
              <p>{semantic.summary.split('。')[0]}。</p>
              <div className={css.semanticGrid}>
                <div className={css.semanticSources}>
                  <div className={css.semanticFlow} aria-label="知识图谱接入与版本路径"><span><DeliveryIcon kind="cube" />{semantic.mode === 'snapshot' ? '本地应用' : '项目应用'}</span><i aria-hidden="true">→</i><span title={semanticModule?.path}><DeliveryIcon kind="code" />{semanticModule?.path ?? '已登记接入证据'}</span><i aria-hidden="true">→</i><span><DeliveryIcon kind="graph" />{semantic.mode === 'snapshot' ? '图谱快照' : '图谱查询服务'}</span></div>
                  <EvidenceLinks files={semantic.evidence} open={openFile} decorated />
                </div>
                <div className={css.semanticSummary}>
                  <div className={css.graphCounts} title="数量来自本阶段记录摘要，不代表实时查询或重新验证"><div><DeliveryIcon kind="graph" /><strong>{entityCount ?? '—'}<small>{entityCount === undefined ? '实体数未登记' : '实体'}</small></strong></div><div><DeliveryIcon kind="graph" /><strong>{relationCount ?? '—'}<small>{relationCount === undefined ? '关系数未登记' : '关系'}</small></strong></div></div>
                  <dl className={css.graphFacts}><div><dt>本体版本（Schema）</dt><dd>{semantic.schemaVersion}</dd></div><div><dt>图谱版本</dt><dd><code title={semantic.graphRevision}>{semantic.graphRevision}</code><button type="button" aria-label="复制图谱版本" disabled={busy} onClick={() => { void perform(async () => { await navigator.clipboard.writeText(semantic.graphRevision); setCopyNotice('已复制图谱版本') }) }}><DeliveryIcon kind="copy" /></button>{graphFile !== undefined && <button type="button" disabled={busy || graphFile.status !== 'present'} onClick={() => { openFile(graphFile.path) }}>详情 <DeliveryIcon kind="external" /></button>}</dd></div></dl>
                  {copyNotice !== '' && <span className={css.copyNotice} role="status">{copyNotice}</span>}
                </div>
              </div>
              <div className={css.semanticWarning}><DeliveryIcon kind="info" /><p>{semantic.summary.split('。').slice(1).filter(Boolean).join('。') || (semantic.mode === 'snapshot' ? '快照登记不代表在线图谱查询服务已接通；运行权限与更新链路仍需独立证据。' : '只按记录中的证据与授权范围核对，不自动授予生产执行权限。')}</p></div>
            </div>
          </section> : <section className={css.semantic}><header><span className={css.semanticIcon} aria-hidden="true">◇</span><div><span className={css.eyebrow}>知识图谱接入与版本</span><h2>{semantic.mode === 'snapshot' ? '图谱快照已登记 · 非在线查询服务' : '已登记运行时接入证据 · 仍按授权范围核对'}</h2></div></header><p>{semantic.summary}</p><dl className={css.facts}><div><dt>本体版本（Schema）</dt><dd>{semantic.schemaVersion}</dd></div><div><dt>图谱版本</dt><dd>{semantic.graphRevision}</dd></div></dl><EvidenceLinks files={semantic.evidence} open={openFile} /></section>)}
      </div>
        {improvement && <p className={css.improvementFootnote}>具体改进内容与改后结果，以改进与验证记录为准。</p>}
      </div>
      {improvement && <header className={css.improvementArchiveHeading}><div><span>第 8 阶段 · 运行反馈与持续改进</span><h2>本轮记录与人工评审</h2></div><span className={css.badge}>{data?.version || '版本待登记'}</span></header>}
      {improvement ? <section className={css.improvementRecords} data-improvement-records aria-label="本轮阶段记录"><header><div><span className={css.eyebrow}>02 / 版本与阶段记录</span><h2>看清改了什么、如何验证、怎样发布</h2><p>查看已保存的文件与版本记录。</p></div><span className={css.badge}>{surface.presentCount} / {surface.requiredCount} 份文件可读</span></header>
        <div className={css.improvementFiles} data-improvement-files>{surface.artifacts.map(artifact => <article key={artifact.id}><span className={css.eyebrow}><DeliveryIcon kind={artifact.id === 'improvement-record' ? 'clipboard' : artifact.id === 'controlled-release-record' ? 'book' : 'file'} />{artifact.id === 'field-learning-register' ? '问题来自哪里' : artifact.id === 'improvement-record' ? '改了什么，效果如何' : artifact.id === 'controlled-release-record' ? '发布范围与后续决定' : '本轮来源记录'}</span><h3>{artifact.title}</h3><p>{artifact.purpose}</p><div><span className={css.badge} data-status={artifact.status === 'present' ? 'passed' : undefined}>{artifact.status === 'present' ? '可读' : '尚未形成'}</span><button type="button" disabled={busy || artifact.status !== 'present'} onClick={() => { openFile(artifact.path) }} aria-label={`查看${artifact.title}`}>查看 <DeliveryIcon kind="external" /></button></div></article>)}</div>
        <details><summary>查看版本文件清单 · {data?.versionCurrent ? '文件校验一致' : '待核对'}</summary><EvidenceLinks files={data?.versionFiles ?? []} open={openFile} decorated /></details>
      </section> : production ? <section className={css.productionArchive} aria-label="交付与验收档案" data-production-archive>
        <header><h2>交付与验收档案</h2><span className={css.eyebrow}>第 07 阶段 · 责任交接</span><p>按交付内容查看阶段记录，核对依赖版本与阶段评审。</p></header>
        <div className={css.archiveGrid} data-semantic={semantic !== undefined ? 'true' : undefined}>
          <section className={css.archiveFiles} aria-label="交付记录目录">
            <div className={css.archiveBar}><DeliveryIcon kind="book" />版本与阶段记录</div>
            <div className={css.archiveFilesBody}><header><h3>交付记录目录</h3><span className={css.badge}>{surface.presentCount} / {surface.requiredCount} 份文件可读</span></header><p>查看已保存的文件与版本记录。<span className={css.badge}>{data?.version || '版本待登记'}</span></p>
              <div className={css.archiveList}>{surface.artifacts.map((artifact, index) => <button type="button" key={artifact.id} disabled={artifact.status !== 'present' || busy} onClick={() => { openFile(artifact.path) }}><span className={css.archiveNumber}>{String(index + 1).padStart(2, '0')}</span><DeliveryIcon kind={index === 1 ? 'clipboard' : index === 2 ? 'book' : 'file'} /><span className={css.archiveFileCopy}><strong>{artifact.title}</strong><small>{artifact.purpose}</small></span><span className={css.badge} data-status={artifact.status === 'present' ? 'passed' : undefined}>{artifact.status === 'present' ? '可读' : '尚未形成'}</span><span className={css.archiveView}>查看 <DeliveryIcon kind="external" /></span></button>)}</div>
              <details><summary>查看版本文件清单 · {data?.versionCurrent ? '文件校验一致' : '待核对'}</summary><EvidenceLinks files={data?.versionFiles ?? []} open={openFile} decorated /></details>
            </div>
          </section>
          {semantic !== undefined && <section className={css.archiveSemantic} aria-label="知识图谱接入与版本"><span className={css.eyebrow}><DeliveryIcon kind="graph" />知识图谱接入与版本</span><header><h3>{semantic.mode === 'snapshot' ? '图谱快照已登记' : '已登记运行时接入证据'}</h3><span className={css.badge} data-status={semantic.mode === 'snapshot' ? 'blocked' : undefined}>{semantic.mode === 'snapshot' ? '非在线查询服务' : '仍按授权范围核对'}</span></header><p>{semantic.summary.split('。')[0]}。</p>
            <div className={css.archiveCounts} title="来自本阶段记录摘要，不代表实时查询"><div><strong>{entityCount ?? '—'}</strong><small>{entityCount === undefined ? '实体数未登记' : '实体'}</small></div><div><strong>{relationCount ?? '—'}</strong><small>{relationCount === undefined ? '关系数未登记' : '关系'}</small></div></div>
            <dl className={css.archiveFacts}><div><dt>本体版本（Schema）</dt><dd>{semantic.schemaVersion}</dd></div><div><dt>图谱版本</dt><dd><code title={semantic.graphRevision}>{semantic.graphRevision}</code><button type="button" aria-label="复制图谱版本" disabled={busy} onClick={() => { void perform(async () => { await navigator.clipboard.writeText(semantic.graphRevision); setCopyNotice('已复制图谱版本') }) }}><DeliveryIcon kind="copy" /></button></dd></div></dl>
            {copyNotice !== '' && <span role="status" className={css.copyNotice}>{copyNotice}</span>}
            <div className={css.archiveWarning}><DeliveryIcon kind="info" /><p>{semantic.summary.split('。').slice(1).filter(Boolean).join('。') || '仅按本阶段已登记范围核对，不自动授予执行权限。'}</p></div>
            <EvidenceLinks files={semantic.evidence} open={openFile} decorated />
          </section>}
        </div>
      </section> : <section className={`${css.card} ${pilot ? css.fixedRecords : ''}`}><header>{pilot && <DeliveryIcon className={css.sectionIcon} kind="clipboard" />}<div><span className={css.eyebrow}>{pilot ? '03 / ' : ''}版本与阶段记录</span><h2>查看已保存的文件与版本记录</h2></div><span className={css.badge}>{surface.presentCount} / {surface.requiredCount} 份文件可读</span></header>
        <div className={css.artifacts}>{surface.artifacts.map((artifact, index) => <button type="button" key={artifact.id} disabled={artifact.status !== 'present' || busy} onClick={() => { openFile(artifact.path) }}>
          {pilot && <DeliveryIcon className={css.artifactIcon} kind={index === 1 ? 'clipboard' : 'file'} />}
          <span>{!pilot && '▤ '}<strong>{artifact.title}</strong><small>{artifact.purpose}</small></span>{pilot ? <span className={css.artifactStatus}><span className={css.badge} data-status={artifact.status === 'present' ? 'passed' : undefined}>{artifact.status === 'present' ? '可读' : '尚未形成'}</span><small>{artifact.status === 'present' ? '查看 ↗' : '待登记'}</small></span> : <small>{artifact.status === 'present' ? '查看 ↗' : '尚未形成'}</small>}</button>)}</div>
        <details><summary>查看版本文件清单 · {data?.versionCurrent ? '文件校验一致' : '待核对'}</summary><EvidenceLinks files={data?.versionFiles ?? []} open={openFile} decorated={pilot} /></details>
      </section>}
      {improvement && semantic !== undefined && <section className={css.improvementSemantic} aria-label="知识图谱接入与版本"><span className={css.eyebrow}>03 / 知识图谱接入与版本</span><header><h2>核对本轮依赖的图谱版本</h2><span className={css.badge} data-status="passed">{semantic.mode === 'snapshot' ? '图谱快照已登记' : '运行时接入证据已登记'}</span><span className={css.badge} data-status="blocked">{semantic.mode === 'snapshot' ? '非在线查询服务' : '仍按授权范围核对'}</span></header><p>{semantic.summary.split('。')[0]}。</p>
        <div className={css.improvementGraphFacts} title="数量来自本阶段记录摘要，不代表实时查询"><span><strong>{entityCount ?? '—'}</strong> {entityCount === undefined ? '实体数未登记' : '实体'}</span><span><strong>{relationCount ?? '—'}</strong> {relationCount === undefined ? '关系数未登记' : '关系'}</span><span>本体版本　{semantic.schemaVersion}</span><span>图谱版本 <code title={semantic.graphRevision}>{semantic.graphRevision}</code><button type="button" aria-label="复制图谱版本" disabled={busy} onClick={() => { void perform(async () => { await navigator.clipboard.writeText(semantic.graphRevision); setCopyNotice('已复制图谱版本') }) }}><DeliveryIcon kind="copy" /></button></span></div>
        {copyNotice !== '' && <span role="status" className={css.copyNotice}>{copyNotice}</span>}
        <EvidenceLinks files={semantic.evidence} open={openFile} decorated />
        <div className={css.archiveWarning}><DeliveryIcon kind="info" /><p>{semantic.summary.split('。').slice(1).filter(Boolean).join('。') || '仅按本阶段已登记范围核对，不自动授予执行权限。'}</p></div>
      </section>}
      <section className={css.gate} data-pilot-gate><header>{<DeliveryIcon className={css.sectionIcon} kind="shield" />}<div><span className={css.eyebrow}>{pilot || improvement ? '04 / ' : ''}{improvement ? 'FDE 人工评审' : 'FDE 人工决定'}</span><h2>{completedCycles > 0 ? '本轮已完成，持续跟进下一轮改进' : stage === 'improvement' ? '改进是新一轮验证，不是自动发布' : readonly ? '查看阶段评审记录' : ready ? '证据已齐备，等待人工核对' : '继续补齐交付依据'}</h2></div><span className={css.badge}>{issues.length} 项待核对{(pilot || production) && readonly && <span className={css.readonlyTag}><DeliveryIcon kind="lock" />只读</span>}</span></header>
        {completedCycles > 0 && <p>已完成 {completedCycles} 轮 · 最近评审（UTC）：{stageState.lastReviewedAt ?? '未登记'}</p>}
        {issues.length > 0 && <details open={issues.length < 4}><summary>查看当前评审缺口</summary><ul>{issues.map(issue => <li key={issue}>{issue}</li>)}</ul></details>}
        <p>{readonly ? '当前是只读预览，不能在这里批准、执行或推进阶段。' : '文件可读和技术运行不替代业务验收；只有有权人员的决定才能进入下一交付阶段。'}</p>
        {!readonly && <><div className={css.actions}><button type="button" className={css.primary} disabled={!ready || busy} onClick={() => { setConfirming(true) }}>{stage === 'improvement' ? '评审本轮改进' : '提交 FDE 评审'}</button><button type="button" disabled={busy} onClick={() => { setReturning(!returning) }}>返回上一阶段</button></div>
          {confirming && ready && <div className={css.confirm}><strong>已核对本轮范围、版本、证据与责任？</strong><p>{stage === 'improvement' ? '只记录本轮改进评审，仍停留在第八阶段，不执行生产发布。' : '确认后进入下一阶段，不自动部署或替客户签收。'}</p><div className={css.actions}><button type="button" disabled={busy} onClick={() => { void perform(() => props.completeV2Stage(workspace.workspaceId, stageState.revision, stage)) }}>确认并继续</button><button type="button" onClick={() => { setConfirming(false) }}>取消</button></div></div>}
          {returning && <div className={css.confirm}><label htmlFor="delivery-return">返回原因</label><textarea id="delivery-return" value={reason} onChange={event => { setReason(event.target.value) }} /><button type="button" disabled={!reason.trim() || busy} onClick={() => { void perform(() => props.returnV2Stage(workspace.workspaceId, stageState.revision, reason.trim())) }}>保留证据并返回</button></div>}
        </>}
      </section>
    </>}
    <footer className={css.footer}>@赋范空间 独家研发</footer>
    <dialog ref={dialog} className={css.drawer} aria-labelledby="delivery-detail-title" onCancel={() => { setSelectedId(null) }} onClick={event => { if (event.target === event.currentTarget) setSelectedId(null) }}>
      {selected !== undefined && <div className={css.drawerBody}><header><span className={css.eyebrow}>{LABELS[selected.category]} · 记录详情</span><button type="button" aria-label="关闭详情" onClick={() => { setSelectedId(null) }}>✕</button></header><h2 id="delivery-detail-title">{selected.title}</h2><span className={css.badge} data-status={selected.status}>{STATUS[selected.status]}</span><p>{selected.summary}</p><dl className={css.facts}><div><dt>原记录声明</dt><dd>{STATUS[selected.declaredStatus]}</dd></div><div><dt>适用环境</dt><dd>{SCOPE[selected.scope]}</dd></div><div><dt>版本</dt><dd>{selected.version}</dd></div><div><dt>责任人 / 确认人</dt><dd>{selected.owner ?? '待确认'}</dd></div><div><dt>观察时间</dt><dd>{selected.observedAt ?? '未登记'}</dd></div><div><dt>判定标准</dt><dd>{selected.criterion ?? '待明确'}</dd></div></dl><h3>下一步操作</h3><p>{selected.nextAction ?? '根据证据确认是否需要后续处理。'}</p><h3>来源证据</h3><EvidenceLinks files={selected.evidence} open={path => { setSelectedId(null); openFile(path) }} />{!readonly && <button type="button" className={css.primary} onClick={() => { setSelectedId(null); prepare(selected) }}>在 Agent 中处理此项</button>}</div>}
    </dialog>
  </section>
}
