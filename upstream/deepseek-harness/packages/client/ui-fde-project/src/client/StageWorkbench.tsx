/** Project-stage workbench: business progress around the native Harness executor. */

import { useEffect, useState } from 'react'
import type { ProjectSurfaceSnapshot } from './controller.ts'
import type { FdeProjectState } from './stage-controller.ts'
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

function StageWorkbenchPanel({ props, workspace, sessionId, view }: {
  readonly props: WorkbenchProps
  readonly workspace: { readonly workspaceId: string; readonly title: string; readonly path: string }
  readonly sessionId: string
  readonly view: boolean
}) {
  const [runningAction, setRunningAction] = useState<DiscoveryAction | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [artifactsCollapsed, setArtifactsCollapsed] = useState(true)
  const stageState = props.useStageProgress(snapshot => snapshot.byWorkspace[workspace.workspaceId])
  const surfaceState = props.useProjectSurfaces(snapshot => snapshot.byWorkspace[workspace.workspaceId])
  const sourceState = props.useProjectSources(snapshot => snapshot.byWorkspace[workspace.workspaceId])

  useEffect(() => {
    props.loadStage(workspace.workspaceId)
    props.loadProjectSurface(workspace.workspaceId)
    props.loadProjectSources(workspace.workspaceId)
  }, [props.loadProjectSources, props.loadProjectSurface, props.loadStage, workspace.workspaceId])

  const files = sourceState?.files ?? []
  const surface = surfaceState?.status === 'ready' ? surfaceState.value : undefined
  const stage = stageState?.status === 'ready' ? stageState.value.currentStage : undefined
  const stageIndex = stage === undefined ? 0 : LEGACY_TO_V2_STAGE[stage]
  const discovery = surface?.discovery
  const artifacts: readonly DiscoveryArtifact[] = discovery?.artifacts ?? fallbackArtifacts(surface)
  const requiredArtifacts = artifacts.filter(artifact => artifact.required)
  const presentCount = discovery?.presentCount ?? requiredArtifacts.filter(artifact => artifact.status === 'present').length
  const reviewReady = discovery?.reviewReady ?? presentCount === requiredArtifacts.length
  const hasEngagementReframe = artifacts.some(artifact => artifact.id === 'engagement-reframe' && artifact.status === 'present')
  const fallbackWorkIndex = presentCount === 0 ? 0 : presentCount === 1 ? 1 : 3
  const fallbackWork = FALLBACK_WORK[fallbackWorkIndex] ?? FALLBACK_WORK[0]
  const currentWorkId = discovery?.currentWorkId ?? fallbackWork.id
  const workItems = discovery?.workItems ?? FALLBACK_WORK.map((item, index) => ({
    ...item,
    status: reviewReady || index < fallbackWorkIndex ? 'complete' as const : index === fallbackWorkIndex ? 'current' as const : 'waiting' as const,
  }))
  const currentWork = workItems.find(item => item.id === currentWorkId) ?? workItems[0] ?? fallbackWork
  const currentWorkIndex = Math.max(0, workItems.findIndex(item => item.id === currentWorkId))
  const workflowCatalog = discovery?.workflows ?? {
    path: '.fde/discovery/workflows.json' as const,
    status: 'missing' as const,
    items: [],
  }
  const openFile = (relativePath: string, title: string): void => {
    setFileError(null)
    void props.openProjectFile(sessionId, workspace.path, relativePath, title).catch((error: unknown) => {
      setFileError(error instanceof Error ? error.message : String(error))
    })
  }

  const runAction = (action: DiscoveryAction, sourcePaths: readonly string[] = []): void => {
    if (runningAction !== null) return
    setActionError(null)
    setRunningAction(action)
    void props.runDiscoveryAction(sessionId, action, sourcePaths, '').catch((error: unknown) => {
      setActionError(error instanceof Error ? error.message : String(error))
    }).finally(() => { setRunningAction(null) })
  }

  if (stageState?.status === 'error') {
    return <section className={css.state} role="alert"><strong>当前阶段读取失败</strong><span>{stageState.message}</span></section>
  }

  if (stageIndex !== 0) {
    return (
      <section className={css.laterStage} data-conversation-composer-overlay={view ? '' : undefined}>
        <span>当前阶段</span>
        <h1>{V2_STAGE_NAMES[stageIndex]}</h1>
        <p>这一轮只完成第一阶段的 V2 工作台。当前项目仍可从原生对话和项目中心继续现有流程。</p>
        <div><button type="button" className={css.secondaryButton} onClick={() => { props.openProjectConversation(sessionId) }}>打开 Agent 执行</button><button type="button" className={css.secondaryButton} onClick={props.openProjectPage}>查看项目阶段</button></div>
      </section>
    )
  }

  const sourceError = sourceState?.status === 'error' ? sourceState.message : null
  const surfaceError = surfaceState?.status === 'error' ? surfaceState.message : null

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
        <main data-stage-execution-column="">
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
              <button type="button" className={css.primaryButton} disabled={runningAction !== null} onClick={() => { runAction('prepare-interview') }}>{runningAction === 'prepare-interview' ? '正在整理问题…' : '开始梳理真实流程'}</button>
              {files.length > 0 && <button type="button" className={css.secondaryButton} disabled={runningAction !== null} onClick={() => { runAction('qualify-workflow', files.map(file => file.relativePath)) }}>{runningAction === 'qualify-workflow' ? '正在梳理客户资料…' : `根据客户资料开始梳理（${String(files.length)}）`}</button>}
              {hasEngagementReframe && <button type="button" className={css.tertiaryButton} disabled={runningAction !== null} onClick={() => { runAction('reframe-engagement') }}>继续核对说法不一致</button>}
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
                  <button type="button" className={css.primaryButton} onClick={props.openProjectPage}>提交 FDE 评审 <span aria-hidden="true">→</span></button>
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
  const workspace = {
    workspaceId: String(props.workspace.workspaceId),
    title: props.workspace.title,
    path: props.workspace.path,
  }
  return <StageWorkbenchPanel props={props} sessionId={String(props.sessionId)} workspace={workspace} view={false} />
}

/** Keep the same stage guidance available after the project Session has history. */
export function ProjectStageWorkbenchView(props: ProjectStageWorkbenchViewProps) {
  const workspace = props.useWorkspaces(state => state.items.find(item => item.sessionIds.includes(props.sessionId)))
  if (workspace === undefined) return <div className={css.state}>当前会话未关联项目。</div>
  const projectWorkspace = {
    workspaceId: String(workspace.workspaceId),
    title: workspace.title,
    path: workspace.path,
  }
  return <StageWorkbenchPanel props={props} sessionId={String(props.sessionId)} workspace={projectWorkspace} view />
}
