/** Project-stage workbench: business progress around the native Harness executor. */

import { useEffect, useRef, useState } from 'react'
import type { ProjectSurfaceSnapshot, V2LifecycleStageId, V2StageSurfaceSnapshot } from './controller.ts'
import type { FdeProjectState, FdeV2StageId, ProjectStageValue } from './stage-controller.ts'
import type { DiscoveryAction, ProjectStageWorkbenchHeroProps, ProjectStageWorkbenchViewProps } from './slots.ts'
import css from './StageWorkbench.module.css'

export const V2_STAGE_NAMES = [
  '发现高价值问题',
  '定义结果、范围与责任',
  '调查数据、系统、接口、安全与组织',
  '设计方案并完成端到端纵向切片',
  '运行 PoC 与 Eval',
  '企业集成、可靠性改造与受控 Pilot',
  '进入生产、推动采用并验收交接',
  '持续改进并沉淀可复用能力',
] as const

const LEGACY_TO_V2_STAGE: Readonly<Record<FdeProjectState, number>> = {
  requirements: 0,
  solution: 1,
  development: 3,
  validation: 4,
  pilot: 5,
  handoff: 6,
  completed: 7,
}

const FALLBACK_WORK = [
  { id: 'collect-originals', title: '听客户怎么说', purpose: '保留客户原话、已有资料和现场条件。' },
  { id: 'restore-workflow', title: '还原实际流程', purpose: '弄清谁在做、什么时候开始、正常怎么处理、出了问题怎么回退。' },
  { id: 'qualify-value', title: '确认是否值得做', purpose: '确认问题造成什么影响、谁负责、谁来判断结果。' },
  { id: 'form-conclusion', title: '决定下一步', purpose: '整理已确认事实和未解决问题，由 FDE 决定继续、调整还是停止。' },
] as const

type WorkbenchProps = ProjectStageWorkbenchHeroProps | ProjectStageWorkbenchViewProps

function LaterStagePanel({ props, workspace, sessionId, view, stageState, stage, surface }: {
  readonly props: WorkbenchProps
  readonly workspace: { readonly workspaceId: string; readonly title: string; readonly path: string }
  readonly sessionId: string
  readonly view: boolean
  readonly stageState: ProjectStageValue
  readonly stage: FdeV2StageId
  readonly surface: V2StageSurfaceSnapshot | undefined
}) {
  const [artifactsCollapsed, setArtifactsCollapsed] = useState(true)
  const [reviewing, setReviewing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [returning, setReturning] = useState(false)
  const [returnReason, setReturnReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const index = (['discovery', 'definition', 'investigation', 'design', 'evaluation', 'pilot', 'production', 'improvement'] as const).indexOf(stage)
  if (surface === undefined) return <section className={css.state} role="alert"><strong>当前阶段资料尚未加载</strong><span>请刷新项目工作台后重试。</span></section>
  const current = surface.workItems.find(item => item.id === surface.currentWorkId) ?? surface.workItems[0]
  const openFile = (path: string, title: string): void => {
    setError(null)
    void props.openProjectFile(sessionId, workspace.path, path, title).catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : String(cause))
    })
  }
  const complete = async (): Promise<void> => {
    setSubmitting(true); setError(null)
    try { await props.completeV2Stage(workspace.workspaceId, stageState.revision, stage) }
    catch (cause: unknown) { setError(cause instanceof Error ? cause.message : String(cause)) }
    finally { setSubmitting(false) }
  }
  const returnStage = async (): Promise<void> => {
    if (returnReason.trim() === '') { setError('请先说明为什么要返回上一阶段。'); return }
    setSubmitting(true); setError(null)
    try { await props.returnV2Stage(workspace.workspaceId, stageState.revision, returnReason) }
    catch (cause: unknown) { setError(cause instanceof Error ? cause.message : String(cause)) }
    finally { setSubmitting(false) }
  }
  return <section className={`${css.root} ${css.genericStageRoot}`} data-conversation-composer-overlay={view ? '' : undefined} aria-label={`项目阶段工作台：${surface.title}`}>
    <div className={css.genericStageGrid} data-artifacts-collapsed={artifactsCollapsed ? 'true' : undefined}>
      <main>
        <section className={css.stageOverview}>
          <header className={css.stageIntro}><span>第 {surface.index}/8 阶段 · 本阶段目标</span><h1>{surface.objective}</h1><p>{surface.explanation}</p></header>
          <div className={css.workPathMeta}><span>本阶段进度</span><b>{surface.presentCount}/{surface.requiredCount} 项必备记录已形成</b></div>
          <ol className={css.workPath} aria-label={`${surface.title}工作路径`}>
            {surface.workItems.map((item, itemIndex) => <li key={item.id} data-status={item.status}><i>{item.status === 'complete' ? '✓' : String(itemIndex + 1).padStart(2, '0')}</i><span><strong>{item.title}</strong><small>{item.status === 'complete' ? '已完成' : item.status === 'current' ? '正在进行' : item.status === 'blocked' ? '存在阻塞' : '待开始'}</small></span></li>)}
          </ol>
        </section>

        <section className={css.currentWork}>
          <header><span>现在先做</span><b>第 {String(Math.max(1, surface.workItems.findIndex(item => item.id === current?.id) + 1))} 步</b></header>
          <h2>{current?.title ?? surface.title}</h2><p>{current?.purpose ?? surface.explanation}</p>
          <div className={css.promptGuide}><span>可以直接让 Agent 从这里开始</span><strong>{surface.prompt}</strong><small>按钮只把提示词放入输入框，不会自动发送，也不会替 FDE 确认阶段。</small></div>
          <div className={css.workActions}><button type="button" className={css.primaryButton} onClick={() => { props.prepareStageDraft(sessionId, surface.prompt) }}>开始本阶段工作</button><button type="button" className={css.secondaryButton} onClick={() => { props.refreshProjectSurface(workspace.workspaceId) }}>刷新阶段记录</button></div>
        </section>

        <section className={css.workflowsPanel}>
          <header><div><span>当前事实</span><h2>{surface.reviewReady ? '候选材料已可提交评审' : '还需要补齐的事项'}</h2><p>文件存在只说明已有候选记录；未运行、未授权和未确认的内容仍必须如实保留。</p></div><b>{surface.reviewBlockers.length} 项</b></header>
          {surface.reviewBlockers.length === 0 ? <div className={css.emptyWorkflow}><i aria-hidden="true" /><span><strong>没有发现阻止评审的缺口</strong><small>请逐份阅读阶段记录，再由 FDE 决定是否进入下一阶段。</small></span></div> : <ul className={css.genericBlockers}>{surface.reviewBlockers.map(item => <li key={item}>{item}</li>)}</ul>}
          <div className={css.genericGateActions}>
            {surface.reviewReady && <button type="button" className={css.primaryButton} onClick={() => { setReviewing(value => !value) }}>{reviewing ? '收起人工评审' : stage === 'improvement' ? '评审本轮改进' : '提交 FDE 评审'}</button>}
            <button type="button" className={css.tertiaryButton} onClick={() => { setReturning(value => !value) }}>返回上一阶段</button>
          </div>
          {reviewing && <div className={css.genericReview}><strong>确认阶段记录和证据已经核对？</strong><p>{stage === 'improvement' ? '确认后记录一次改进循环，项目仍停留在持续改进阶段。' : `确认后进入“${V2_STAGE_NAMES[Math.min(7, index + 1)]}”。后续仍可带原因返回补充。`}</p><button type="button" className={css.primaryButton} disabled={submitting} onClick={() => { void complete() }}>{submitting ? '正在提交…' : '确认并继续'}</button></div>}
          {returning && <div className={css.genericReview}><label htmlFor="v2-stage-return-reason">返回原因</label><textarea id="v2-stage-return-reason" value={returnReason} onChange={event => { setReturnReason(event.target.value) }} placeholder="例如：客户补充了新的业务边界，需要回到上一阶段重新核对。" /><button type="button" className={css.secondaryButton} disabled={submitting} onClick={() => { void returnStage() }}>保留现有材料并返回</button></div>}
          {error !== null && <p className={css.inlineError} role="alert">{error}</p>}
        </section>
      </main>

      <aside data-stage-artifact-column="" data-collapsed={artifactsCollapsed ? 'true' : undefined}>
        <section className={css.artifactsPanel} data-collapsed={artifactsCollapsed ? 'true' : undefined}>
          {artifactsCollapsed ? <button type="button" className={css.collapsedArtifactTrigger} aria-expanded="false" aria-label="展开阶段产物" data-tooltip={`${surface.title} · ${String(surface.presentCount)}/${String(surface.requiredCount)} 已形成`} onClick={() => { setArtifactsCollapsed(false) }}><svg className={css.artifactRailIcon} viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M6.5 3.5h6l3 3v8.75A1.75 1.75 0 0 1 13.75 17H6.5a1.75 1.75 0 0 1-1.75-1.75v-10A1.75 1.75 0 0 1 6.5 3.5Z" /><path d="M12.5 3.75v3h3M7.5 10h5M7.5 13h5" /></svg><b>{surface.presentCount}/{surface.requiredCount}</b></button> : <><header><div><span>阶段产物</span><h2>{surface.title}</h2><p>点击已有记录可在右侧文件面板预览。</p></div><div className={css.artifactHeaderActions}><b>{surface.presentCount}/{surface.requiredCount}</b><button type="button" onClick={() => { setArtifactsCollapsed(true) }}>收起</button></div></header><div className={css.artifactList}>{surface.artifacts.map(artifact => <article key={artifact.id} data-status={artifact.status}><header><i>{artifact.required ? '记' : '需'}</i><span><strong>{artifact.title}</strong><small>{artifact.purpose}</small></span></header><footer><b>{artifact.status === 'present' ? '已有记录' : artifact.status === 'error' ? '读取失败' : '待形成'}</b>{artifact.status === 'present' && <button type="button" onClick={() => { openFile(artifact.path, artifact.title) }}>预览</button>}</footer></article>)}</div></>}
        </section>
      </aside>
    </div>
  </section>
}

type DiscoveryArtifact = {
  readonly id: string
  readonly title: string
  readonly path: string
  readonly required: boolean
  readonly purpose: string
  readonly status: 'missing' | 'present' | 'error'
  readonly structureState?: 'missing' | 'invalid' | 'starter_valid' | 'complete_valid' | 'not_applicable'
  readonly evidenceState?: 'confirmed' | 'inferred' | 'unverified'
  readonly version?: number
  readonly sourceAdapter?: { readonly id: string; readonly version: string; readonly artifact: string }
  readonly evidenceRefs?: readonly { readonly id: string }[]
  readonly message?: string
}

function fallbackArtifacts(surface: ProjectSurfaceSnapshot | undefined): readonly DiscoveryArtifact[] {
  const legacy = surface?.requirements.artifacts ?? []
  const mapped = legacy.map((artifact): DiscoveryArtifact => ({
    ...artifact,
    title: artifact.id === 'research-report'
      ? '现场观察记录'
      : artifact.id === 'confirmation-checklist'
        ? '事实确认清单'
        : '工作流章程',
    required: true,
    purpose: artifact.id === 'research-report'
      ? '记录人员陈述、代表案例、现场观察与未验证推断。'
      : artifact.id === 'confirmation-checklist'
        ? '管理待核对事实、来源、责任人和当前结论。'
        : '冻结候选工作流、业务结果、边界、回退和停止条件。',
  }))
  const defaults: readonly DiscoveryArtifact[] = [
    { id: 'research-report', title: '现场观察记录', path: 'fde-deliverables/01-requirement-research/requirement-research-report.md', required: true, purpose: '记录人员陈述、代表案例、现场观察与未验证推断。', status: 'missing' },
    { id: 'confirmation-checklist', title: '事实确认清单', path: 'fde-deliverables/01-requirement-research/confirmation-checklist.md', required: true, purpose: '管理待核对事实、来源、责任人和当前结论。', status: 'missing' },
    { id: 'requirement-baseline', title: '工作流章程', path: 'fde-deliverables/01-requirement-research/requirement-baseline.md', required: true, purpose: '冻结候选工作流、业务结果、边界、回退和停止条件。', status: 'missing' },
  ]
  return [
    ...(mapped.length === 0 ? defaults : mapped),
    { id: 'engagement-reframe', title: '项目重新界定记录', path: 'fde-deliverables/01-requirement-research/engagement-reframe.md', required: false, purpose: '仅在现场事实推翻原始边界、成功标准或停止条件时需要。', status: 'missing' },
  ]
}

function artifactGap(artifact: DiscoveryArtifact): string {
  if (artifact.status === 'present' && artifact.structureState === 'invalid') return artifact.message ?? '内容已经生成，但还缺少必要信息，请补充后再评审。'
  if (artifact.status === 'present') return '已有初稿，请继续核对信息来源和未确认事项。'
  if (artifact.status === 'error') return artifact.message ?? '暂时无法读取，请修复文件后再继续。'
  if (artifact.id === 'research-report') return '记录客户原话、实际操作步骤，以及正常和异常案例。'
  if (artifact.id === 'confirmation-checklist') return '列出哪些事实已经确认，哪些仍需找谁核对。'
  if (artifact.id === 'requirement-baseline') return '说明要解决的流程、预期结果、负责人和停止条件。'
  return '只有新事实改变了项目范围或成功标准时才需要。'
}

function artifactStatus(artifact: DiscoveryArtifact): string {
  if (artifact.status === 'error') return '读取失败'
  if (artifact.status === 'missing') return artifact.required ? '尚未整理' : '按需生成'
  if (artifact.structureState === 'complete_valid') return `已整理 · v${String(artifact.version ?? 1)}`
  if (artifact.structureState === 'starter_valid') return `已有初稿 · v${String(artifact.version ?? 1)}`
  return '已生成，待核对'
}

function artifactDisplayTitle(artifact: DiscoveryArtifact): string {
  if (artifact.id === 'research-report') return '客户现状记录'
  if (artifact.id === 'confirmation-checklist') return '待确认事项'
  if (artifact.id === 'requirement-baseline') return '业务流程说明'
  if (artifact.id === 'engagement-reframe') return '项目调整记录'
  return artifact.title
}

function workflowDisposition(value: 'candidate' | 'selected' | 'deferred' | 'rejected'): string {
  if (value === 'selected') return '当前选择'
  if (value === 'deferred') return '暂缓'
  if (value === 'rejected') return '已排除'
  return '候选'
}

function formatSourceBytes(bytes: number): string {
  if (bytes < 1024) return `${String(bytes)} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes >= 1024 * 100 ? 0 : 1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(bytes >= 1024 * 1024 * 10 ? 0 : 1)} MB`
}

function sourceStatus(file: { readonly previewKind: string; readonly parse: { readonly status: string } }): string {
  if (file.parse.status === 'processing') return '正在识别'
  if (file.parse.status === 'error' || file.parse.status === 'stale') return '待重新处理'
  if (file.parse.status === 'needs-ocr') return '可预览，待 OCR'
  if (file.previewKind === 'unsupported' || file.parse.status === 'unsupported') return '已归档'
  if (file.parse.status === 'ready') return '已识别，可预览'
  return '可预览'
}

function StageWorkbenchPanel({ props, workspace, sessionId, view }: {
  readonly props: WorkbenchProps
  readonly workspace: { readonly workspaceId: string; readonly title: string; readonly path: string }
  readonly sessionId: string
  readonly view: boolean
}) {
  const [actionError, setActionError] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [artifactsCollapsed, setArtifactsCollapsed] = useState(true)
  const [reviewMode, setReviewMode] = useState(false)
  const [reviewConfirming, setReviewConfirming] = useState(false)
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [reviewError, setReviewError] = useState<string | null>(null)
  const executionColumnRef = useRef<HTMLElement>(null)
  const sessionRunning = props.useSessions(snapshot => (
    snapshot.byId[sessionId as keyof typeof snapshot.byId]?.running ?? false
  ))
  const previousSessionRunning = useRef(sessionRunning)
  const stageState = props.useStageProgress(snapshot => snapshot.byWorkspace[workspace.workspaceId])
  const surfaceState = props.useProjectSurfaces(snapshot => snapshot.byWorkspace[workspace.workspaceId])
  const sourceState = props.useProjectSources(snapshot => snapshot.byWorkspace[workspace.workspaceId])

  useEffect(() => {
    props.loadStage(workspace.workspaceId)
    props.refreshProjectSurface(workspace.workspaceId)
    props.loadProjectSources(workspace.workspaceId, true)
  }, [props.loadProjectSources, props.loadStage, props.refreshProjectSurface, workspace.workspaceId])

  useEffect(() => {
    if (previousSessionRunning.current && !sessionRunning) {
      props.refreshProjectSurface(workspace.workspaceId)
      props.loadProjectSources(workspace.workspaceId, true)
    }
    previousSessionRunning.current = sessionRunning
  }, [props.loadProjectSources, props.refreshProjectSurface, sessionRunning, workspace.workspaceId])

  const files = sourceState?.files ?? []
  const surface = surfaceState?.status === 'ready' ? surfaceState.value : undefined
  const v2Stage = stageState?.status === 'ready'
    ? (stageState.value.v2Stage ?? (['discovery', 'definition', 'investigation', 'design', 'evaluation', 'pilot', 'production', 'improvement'] as const)[LEGACY_TO_V2_STAGE[stageState.value.currentStage]])
    : undefined
  const discovery = surface?.discovery
  const artifacts: readonly DiscoveryArtifact[] = discovery?.artifacts ?? fallbackArtifacts(surface)
  const requiredArtifacts = artifacts.filter(artifact => artifact.required)
  const presentCount = discovery?.presentCount ?? requiredArtifacts.filter(artifact => artifact.status === 'present').length
  const reviewReady = discovery?.reviewReady ?? presentCount === requiredArtifacts.length
  const hasEngagementReframe = artifacts.some(artifact => artifact.id === 'engagement-reframe' && artifact.status === 'present')
  const fallbackWorkIndex = presentCount === 0 ? 0 : presentCount === 1 ? 1 : 3
  const currentWorkId = discovery?.currentWorkId ?? FALLBACK_WORK[fallbackWorkIndex]!.id
  const workItems = discovery?.workItems ?? FALLBACK_WORK.map((item, index) => ({
    ...item,
    status: reviewReady || index < fallbackWorkIndex ? 'complete' as const : index === fallbackWorkIndex ? 'current' as const : 'waiting' as const,
  }))
  const currentWork = workItems.find(item => item.id === currentWorkId) ?? workItems[0] ?? FALLBACK_WORK[0]!
  const currentWorkIndex = Math.max(0, workItems.findIndex(item => item.id === currentWorkId))
  const workflowCatalog = discovery?.workflows ?? {
    path: '.fde/discovery/workflows.json' as const,
    status: 'missing' as const,
    items: [],
  }
  const selectedWorkflow = workflowCatalog.items.find(item => item.id === workflowCatalog.selectedWorkflowId)
    ?? workflowCatalog.items.find(item => item.disposition === 'selected')
    ?? workflowCatalog.items[0]
  const workflowEvidence = selectedWorkflow?.evidence ?? { confirmed: 0, inferred: 0, unverified: 0 }
  const artifactEvidenceCount = artifacts.reduce((total, artifact) => total + (artifact.evidenceRefs?.length ?? 0), 0)

  useEffect(() => {
    // A stage refresh can replace a shorter work item with a taller one while
    // preserving the column's old scroll offset. Always reveal the new current
    // work from the top instead of leaving the stage goal half clipped.
    if (executionColumnRef.current !== null) executionColumnRef.current.scrollTop = 0
  }, [currentWorkId, reviewReady])
  const openFile = (relativePath: string, title: string): void => {
    setFileError(null)
    void props.openProjectFile(sessionId, workspace.path, relativePath, title).catch((error: unknown) => {
      setFileError(error instanceof Error ? error.message : String(error))
    })
  }

  const prepareDraft = (action: DiscoveryAction, sourcePaths: readonly string[] = []): void => {
    setActionError(null)
    try {
      props.prepareDiscoveryDraft(sessionId, action, sourcePaths)
    } catch (error: unknown) {
      setActionError(error instanceof Error ? error.message : String(error))
    }
  }

  const continueAfterReview = (action: DiscoveryAction): void => {
    setReviewMode(false)
    setReviewConfirming(false)
    setReviewError(null)
    prepareDraft(action)
  }

  const advanceStage = async (): Promise<void> => {
    if (stageState?.status !== 'ready') {
      setReviewError('当前阶段状态尚未读取完成，请稍后重试。')
      return
    }
    setReviewError(null)
    setReviewSubmitting(true)
    try {
      await props.completeRequirements(workspace.workspaceId, stageState.value.revision)
      setReviewMode(false)
      setReviewConfirming(false)
    } catch (error: unknown) {
      setReviewError(error instanceof Error ? error.message : String(error))
    } finally {
      setReviewSubmitting(false)
    }
  }

  if (stageState?.status === 'error') {
    return <section className={css.state} role="alert"><strong>当前阶段读取失败</strong><span>{stageState.message}</span></section>
  }

  if (v2Stage !== undefined && v2Stage !== 'discovery' && stageState?.status === 'ready') return <LaterStagePanel props={props} workspace={workspace} sessionId={sessionId} view={view} stageState={stageState.value} stage={v2Stage} surface={surface?.v2Stages[v2Stage as V2LifecycleStageId]} />

  const sourceError = sourceState?.status === 'error' ? sourceState.message : null
  const surfaceError = surfaceState?.status === 'error' ? surfaceState.message : null

  if (reviewMode) {
    return (
      <section
        className={`${css.root} ${css.reviewRoot}`}
        data-stage-review-mode=""
        data-conversation-composer-overlay={view ? '' : undefined}
        aria-label="第一阶段 FDE 评审"
      >
        <header className={css.reviewHeader}>
          <button type="button" className={css.tertiaryButton} onClick={() => { setReviewMode(false); setReviewConfirming(false) }}>← 返回阶段工作台</button>
          <div><span>第一阶段 · FDE 评审</span><h1>确认我们是否找对了要解决的问题</h1><p>先核对业务流程、客户资料和未确认事实。提交评审不等于进入下一阶段，最终决定由你作出。</p></div>
          <b>{presentCount}/{requiredArtifacts.length} 项必备记录已整理</b>
        </header>

        <div className={css.reviewGrid}>
          <main>
            <section className={css.reviewWorkflow}>
              <header><div><span>本次评审对象</span><h2>{selectedWorkflow?.title ?? '尚未形成可评审的业务流程'}</h2></div><b>{selectedWorkflow === undefined ? '待补充' : workflowDisposition(selectedWorkflow.disposition)}</b></header>
              {selectedWorkflow === undefined
                ? <p>请返回第一阶段继续还原客户的真实工作流程。</p>
                : <><p>{selectedWorkflow.problem}</p><dl><div><dt>实际由谁处理</dt><dd>{selectedWorkflow.actor}</dd></div><div><dt>什么时候发生</dt><dd>{selectedWorkflow.trigger}</dd></div></dl></>}
            </section>

            <section className={css.reviewMetrics} aria-label="评审依据概览">
              <article><span>客户原始资料</span><strong>{files.length}</strong><small>份已归档资料</small></article>
              <article><span>已确认事实</span><strong>{workflowEvidence.confirmed}</strong><small>有明确来源</small></article>
              <article><span>仍待核对</span><strong>{workflowEvidence.unverified}</strong><small>不能当作事实</small></article>
              <article><span>记录证据引用</span><strong>{artifactEvidenceCount}</strong><small>可回到原始依据</small></article>
            </section>

            <section className={css.reviewChecklist}>
              <header><span>请逐项作出人工判断</span><h2>进入下一阶段前，确认下面五件事</h2></header>
              <ol>
                <li><i>1</i><span><strong>实际工作流程已经说清楚</strong><small>谁来做、什么时候开始、经过哪些步骤、问题发生在哪里。</small></span><b>待 FDE 核对</b></li>
                <li><i>2</i><span><strong>事实有来源，未知项没有被当成结论</strong><small>客户资料、访谈和现场观察能够追溯，推断与待确认事项已标明。</small></span><b>待 FDE 核对</b></li>
                <li><i>3</i><span><strong>问题确实值得继续投入</strong><small>业务影响、预期结果以及由谁判断结果已经能够支撑下一步。</small></span><b>待 FDE 核对</b></li>
                <li><i>4</i><span><strong>范围、责任人和停止条件清楚</strong><small>知道本次先做什么、不做什么，遇到什么情况应暂停或调整。</small></span><b>待 FDE 核对</b></li>
                <li><i>5</i><span><strong>重大说法冲突已经处理</strong><small>{hasEngagementReframe ? '已形成项目调整记录，请核对调整依据和决定人。' : '当前未形成项目调整记录；如事实改变原范围，应先返回处理。'}</small></span><b>待 FDE 核对</b></li>
              </ol>
            </section>

            <section className={css.reviewDecision}>
              <header><span>你的决定</span><h2>接下来怎么处理这个问题？</h2><p>只有“进入下一阶段”会改变项目阶段，其他操作都会留在当前阶段继续完善。</p></header>
              {!reviewConfirming
                ? <div className={css.reviewDecisionActions}>
                    <button type="button" className={css.primaryButton} onClick={() => { setReviewConfirming(true) }}>进入下一阶段</button>
                    <button type="button" className={css.secondaryButton} onClick={() => { continueAfterReview('prepare-interview') }}>继续补充调查</button>
                    <button type="button" className={css.secondaryButton} onClick={() => { continueAfterReview('narrow-workflow') }}>缩小问题范围</button>
                    <button type="button" className={css.tertiaryButton} onClick={() => { continueAfterReview('pause-workflow') }}>暂停这个问题</button>
                  </div>
                : <div className={css.reviewConfirmation} data-stage-review-confirmation="">
                    <div><strong>确认进入“定义结果、范围与责任”阶段？</strong><small>当前评审对象：{selectedWorkflow?.title ?? '未命名业务流程'}。进入后仍可返回第一阶段补充资料，但本次人工决定会写入项目阶段记录。</small></div>
                    <div><button type="button" className={css.secondaryButton} disabled={reviewSubmitting} onClick={() => { setReviewConfirming(false) }}>返回核对</button><button type="button" className={css.primaryButton} disabled={reviewSubmitting} onClick={() => { void advanceStage() }}>{reviewSubmitting ? '正在提交…' : '确认并进入下一阶段'}</button></div>
                  </div>}
              {reviewError !== null && <p className={css.inlineError} role="alert">{reviewError}</p>}
            </section>
          </main>

          <aside className={css.reviewEvidence}>
            <header><span>评审材料</span><h2>回到依据逐项核对</h2><p>文件存在只表示形成了候选记录，不代表客户已经确认。</p></header>
            <section><div><strong>客户原始资料</strong><b>{files.length} 份</b></div>{files.length === 0 ? <p>本阶段没有归档客户资料。</p> : files.map(file => <button key={file.sourceId} type="button" onClick={() => { openFile(file.relativePath, file.originalName) }}><span><strong>{file.originalName}</strong><small>{sourceStatus(file)}</small></span><em>预览</em></button>)}</section>
            <section><div><strong>阶段记录</strong><b>{presentCount}/{requiredArtifacts.length}</b></div>{artifacts.map(artifact => <button key={artifact.id} type="button" disabled={artifact.status !== 'present'} onClick={() => { openFile(artifact.path, artifactDisplayTitle(artifact)) }}><span><strong>{artifactDisplayTitle(artifact)}</strong><small>{artifactStatus(artifact)}</small></span><em>{artifact.status === 'present' ? '预览' : '待补充'}</em></button>)}</section>
            {fileError !== null && <p className={css.inlineError} role="alert">{fileError}</p>}
          </aside>
        </div>
      </section>
    )
  }

  return (
    <section
      className={css.root}
      data-conversation-hero-project=""
      data-fde-stage-workbench=""
      data-conversation-composer-layout="stage-execution"
      data-conversation-composer-overlay={view ? '' : undefined}
      data-artifacts-collapsed={artifactsCollapsed ? 'true' : undefined}
      aria-label="项目阶段工作台：发现高价值问题"
    >
      <div className={css.workbenchGrid} data-artifacts-collapsed={artifactsCollapsed ? 'true' : undefined}>
        <main ref={executionColumnRef} data-stage-execution-column="">
          <section className={css.stageOverview}>
            <header className={css.stageIntro}>
              <span>本阶段目标</span>
              <h1>先弄清客户现在怎么做、哪里出了问题，再决定先解决什么。</h1>
              <p>结合客户资料、访谈和实际案例，还原实际流程，确认问题影响、责任人和结果判断方式。事实没弄清前，不急着定方案。</p>
            </header>

            <div className={css.workPathMeta}><span>本阶段进度</span><b>第 {String(currentWorkIndex + 1)}/{String(workItems.length)} 步</b></div>
            <ol className={css.workPath} aria-label="第一阶段工作路径" data-progress={String(currentWorkIndex)}>
              {workItems.map((item, index) => {
                const display = FALLBACK_WORK[index] ?? item
                const hint = item.status === 'complete' ? '已完成' : item.status === 'current' ? '正在进行' : index === currentWorkIndex + 1 ? '下一步' : null
                return <li key={item.id} data-status={item.status}>
                  <i>{item.status === 'complete' ? '✓' : String(index + 1).padStart(2, '0')}</i>
                  <span><strong>{display.title}</strong>{hint !== null && <small>{hint}</small>}</span>
                </li>
              })}
            </ol>
          </section>

          <section className={css.currentWork}>
            <header><span>现在先做</span><b>第 {String(currentWorkIndex + 1)} 步</b></header>
            <h2>{reviewReady ? '核对已经整理的记录' : currentWorkIndex === 0 ? '从一个最近发生的案例开始' : (FALLBACK_WORK[currentWorkIndex]?.title ?? currentWork.title)}</h2>
            <p>{reviewReady
              ? '三份必备记录已经形成初稿。请继续核对信息来源、未确认事项和客户决策人，再由 FDE 决定是否进入下一阶段。'
              : currentWorkIndex === 0
                ? '请客户按时间顺序讲清楚：谁在什么情况下开始处理、经过哪些步骤、在哪里反复或出错，最后由谁判断结果。'
                : (FALLBACK_WORK[currentWorkIndex]?.purpose ?? currentWork.purpose)}</p>
            <div className={css.promptGuide}>
              <span>可以直接这样开始</span>
              <strong>“客户上周遇到了一次售后退款问题。请根据下面的描述，帮我整理还需要向业务人员核对的关键问题，暂时不要提出解决方案。”</strong>
              <small>先把最近一次真实案例讲清楚，系统会继续追问缺少的事实。</small>
            </div>
            <div className={css.workActions}>
              <button type="button" className={css.primaryButton} onClick={() => { prepareDraft('prepare-interview') }}>开始梳理真实流程</button>
              {files.length > 0 && <button type="button" className={css.secondaryButton} onClick={() => { prepareDraft('qualify-workflow', files.map(file => file.relativePath)) }}>{`根据客户资料开始梳理（${String(files.length)}）`}</button>}
              {hasEngagementReframe && <button type="button" className={css.tertiaryButton} onClick={() => { prepareDraft('reframe-engagement') }}>继续核对说法不一致</button>}
            </div>
            {actionError !== null && <p className={css.inlineError} role="alert">{actionError}</p>}
            {sourceError !== null && <p className={css.inlineError} role="alert">项目资料读取失败：{sourceError}</p>}
          </section>

          <section className={css.workflowsPanel}>
            <header>
              <div><span>调查结果</span><h2>待确认业务流程</h2><p>这里记录从客户描述中识别出的真实工作步骤，核对事实后再判断是否值得投入。</p></div>
              <b>{workflowCatalog.items.length} 项</b>
            </header>
            {workflowCatalog.status === 'invalid' && <p className={css.inlineError} role="alert">业务流程记录读取失败：{workflowCatalog.message ?? '文件结构无效。'}</p>}
            {workflowCatalog.items.length === 0 && workflowCatalog.status !== 'invalid' && <div className={css.emptyWorkflow}>
              <i aria-hidden="true" />
              <span><strong>还没有识别出具体流程</strong><small>先说清客户目前怎么做、由谁处理，以及在哪一步遇到问题。</small></span>
            </div>}
            {workflowCatalog.items.length > 0 && <div className={css.workflowList}>
              {workflowCatalog.items.map(workflow => (
                <article key={workflow.id} data-selected={workflow.disposition === 'selected' ? 'true' : undefined}>
                  <header><span>{workflowDisposition(workflow.disposition)}</span><b>{workflow.title}</b></header>
                  <dl><div><dt>谁在做</dt><dd>{workflow.actor}</dd></div><div><dt>何时发生</dt><dd>{workflow.trigger}</dd></div></dl>
                  <p>{workflow.problem}</p>
                  <footer><span data-kind="confirmed">已确认 {workflow.evidence.confirmed}</span><span data-kind="inferred">推断 {workflow.evidence.inferred}</span><span data-kind="unverified">待核对 {workflow.evidence.unverified}</span></footer>
                </article>
              ))}
            </div>}
          </section>
        </main>

        <aside data-stage-artifact-column="" data-collapsed={artifactsCollapsed ? 'true' : undefined}>
          <section className={css.artifactsPanel} data-collapsed={artifactsCollapsed ? 'true' : undefined}>
            {artifactsCollapsed
              ? <button
                  type="button"
                  className={css.collapsedArtifactTrigger}
                  aria-expanded="false"
                  aria-label="展开阶段产物"
                  data-tooltip={`本阶段记录 · ${String(presentCount)}/${String(requiredArtifacts.length)} 已整理`}
                  onClick={() => { setArtifactsCollapsed(false) }}
                >
                  <svg className={css.artifactRailIcon} viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path d="M6.5 3.5h6l3 3v8.75A1.75 1.75 0 0 1 13.75 17H6.5a1.75 1.75 0 0 1-1.75-1.75v-10A1.75 1.75 0 0 1 6.5 3.5Z" />
                    <path d="M12.5 3.75v3h3M7.5 10h5M7.5 13h5" />
                  </svg>
                  <b>{presentCount}/{requiredArtifacts.length}</b>
                </button>
              : <>
                  <header>
                    <div><span>本阶段记录</span><h2>把调查结果整理清楚</h2><p>这些记录会随着访谈和资料核对逐步补齐，确认无误后再提交 FDE 评审。</p></div>
                    <div className={css.artifactHeaderActions}>
                      <b>已整理 {presentCount}/{requiredArtifacts.length}</b>
                      <button type="button" aria-expanded="true" aria-label="收起阶段产物" title="收起阶段产物" onClick={() => { setArtifactsCollapsed(true) }}>收起</button>
                    </div>
                  </header>
                  {surfaceError !== null && <p className={css.inlineError} role="alert">阶段产物读取失败：{surfaceError}</p>}
                  <section className={css.sourceGroup} aria-label="客户原始资料">
                    <header>
                      <span><small>本阶段输入</small><strong>客户原始资料</strong></span>
                      <b>{files.length} 份</b>
                    </header>
                    {files.length === 0
                      ? <p className={css.emptySources}>尚未上传客户资料，可以先从客户讲述的真实案例开始。</p>
                      : <div className={css.sourceList}>
                          {files.map(file => (
                            <button
                              key={file.sourceId}
                              type="button"
                              aria-label={`预览客户资料：${file.originalName}`}
                              onClick={() => { openFile(file.relativePath, file.originalName) }}
                            >
                              <i>{file.extension === '' ? '文件' : file.extension.slice(0, 4).toUpperCase()}</i>
                              <span><strong>{file.originalName}</strong><small>{formatSourceBytes(file.bytes)} · {sourceStatus(file)}</small></span>
                              <em>打开</em>
                            </button>
                          ))}
                        </div>}
                  </section>
                  <div className={css.outputHeading}><span><small>阶段输出</small><strong>调查记录</strong></span><b>{presentCount}/{requiredArtifacts.length}</b></div>
                  <div className={css.artifactList}>
                    {artifacts.map(artifact => (
                      <article key={artifact.id} data-status={artifact.status}>
                        <header><i>{artifact.required ? '记' : '需'}</i><span><strong>{artifactDisplayTitle(artifact)}</strong><small>{artifactGap(artifact)}</small></span></header>
                        <footer><b>{artifactStatus(artifact)}</b>{artifact.status === 'present' && <button type="button" onClick={() => { openFile(artifact.path, artifactDisplayTitle(artifact)) }}>预览</button>}</footer>
                      </article>
                    ))}
                  </div>
                  {reviewReady && <div className={css.reviewAction} data-stage-review-action="">
                    <span><strong>候选材料已齐备</strong><small>文件齐备只表示可以评审，阶段仍由 FDE 人工决定。</small></span>
                    <button type="button" className={css.primaryButton} onClick={() => { setReviewError(null); setReviewConfirming(false); setReviewMode(true) }}>提交 FDE 评审 <span aria-hidden="true">→</span></button>
                  </div>}
                  {fileError !== null && <p className={css.inlineError} role="alert">{fileError}</p>}
                </>}
          </section>
        </aside>
      </div>
    </section>
  )
}

/** Replace the generic blank-session hero only for an actual project. */
export function ProjectStageWorkbenchHero(props: ProjectStageWorkbenchHeroProps) {
  if (props.sessionId === undefined || props.workspace === undefined) return <>{props.defaultContent}</>
  return <StageWorkbenchPanel props={props} sessionId={String(props.sessionId)} workspace={{ workspaceId: String(props.workspace.workspaceId), title: props.workspace.title, path: props.workspace.path }} view={false} />
}

/** Keep the same stage guidance available after the project Session has history. */
export function ProjectStageWorkbenchView(props: ProjectStageWorkbenchViewProps) {
  const workspace = props.useWorkspaces(state => state.items.find(item => item.sessionIds.includes(props.sessionId)))
  if (workspace === undefined) return <div className={css.state}>当前会话未关联项目。</div>
  return <StageWorkbenchPanel props={props} sessionId={String(props.sessionId)} workspace={{ workspaceId: String(workspace.workspaceId), title: workspace.title, path: workspace.path }} view />
}
