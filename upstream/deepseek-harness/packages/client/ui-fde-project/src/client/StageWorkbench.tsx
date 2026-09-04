/** Project-stage workbench: business progress around the native Harness executor. */

import { useEffect, useRef, useState } from 'react'
import type { ProjectSurfaceSnapshot, V2LifecycleStageId, V2StageSurfaceSnapshot } from './controller.ts'
import type { ProjectSourceItem } from './source-controller.ts'
import { FDE_V2_STAGE_IDS, type FdeProjectState, type FdeV2StageId, type ProjectStageValue } from './stage-controller.ts'
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

function DocumentStatusIcon({ state }: { readonly state: 'current' | 'complete' | 'all' }) {
  return <svg className={css.recordDocumentIcon} data-state={state} viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M5.75 2.75h5.75l3.25 3.25v9.25A1.75 1.75 0 0 1 13 17H5.75A1.75 1.75 0 0 1 4 15.25V4.5a1.75 1.75 0 0 1 1.75-1.75Z" />
    <path d="M11.5 3v3h3M7 9.25h5M7 12h5" />
    {state === 'complete' && <path d="m12.2 15.1 1.25 1.25 2.55-2.8" />}
  </svg>
}

function SparkleIcon() {
  return <svg className={css.promptSparkleIcon} viewBox="0 0 36 36" fill="none" aria-hidden="true">
    <path d="M16 3c.8 7.2 3.8 10.2 11 11-7.2.8-10.2 3.8-11 11-.8-7.2-3.8-10.2-11-11 7.2-.8 10.2-3.8 11-11Z" fill="currentColor" />
    <path d="M28 3.5c.3 2.8 1.7 4.2 4.5 4.5-2.8.3-4.2 1.7-4.5 4.5-.3-2.8-1.7-4.2-4.5-4.5 2.8-.3 4.2-1.7 4.5-4.5Z" fill="currentColor" opacity=".35" />
  </svg>
}

function HistoricalNoticeIcon() {
  return <svg className={css.historicalNoticeIcon} viewBox="0 0 48 48" fill="none" aria-hidden="true">
    <path d="M12 7.5h16.5l7.5 7.5v18.5A4.5 4.5 0 0 1 31.5 38H12a4.5 4.5 0 0 1-4.5-4.5V12A4.5 4.5 0 0 1 12 7.5Z" />
    <path d="M28.5 8v7h7M15 21h9M15 27h7" />
    <circle cx="34.5" cy="33.5" r="9" />
    <path d="M34.5 28.5v5.5l3.5 2" />
  </svg>
}

function HistoricalFactIcon({ type }: { readonly type: 'input' | 'record' | 'gate' }) {
  return <svg className={css.historicalFactIcon} viewBox="0 0 20 20" fill="none" aria-hidden="true">
    {type === 'input' && <><rect x="4" y="4" width="12" height="12" rx="3" /><path d="M7 10h6M10 7v6" /></>}
    {type === 'record' && <><path d="M5 5.5h10v10H5z" /><path d="M7.5 3.5h5v3h-5zM7.5 9h5M7.5 12h4" /></>}
    {type === 'gate' && <><circle cx="10" cy="10" r="7" /><path d="m7 10 2 2 4-4" /></>}
  </svg>
}

function HistoricalArchiveIcon() {
  return <svg className={css.historicalArchiveIcon} viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 2.5 16 5v4.6c0 3.6-2.2 6.1-6 7.9-3.8-1.8-6-4.3-6-7.9V5l6-2.5Z" /><path d="m7.5 10 1.6 1.6 3.5-3.7" /></svg>
}

function EvidenceDocumentIcon() {
  return <svg className={css.evidenceDocumentIcon} viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M5.25 2.75h6l3.5 3.5v10.25a.75.75 0 0 1-.75.75H5.25a.75.75 0 0 1-.75-.75v-13a.75.75 0 0 1 .75-.75Z" />
    <path d="M11.25 3v3.5h3.5M7 10h5.5M7 13h5.5" />
  </svg>
}

function EvidenceShieldIcon({ ready = true }: { readonly ready?: boolean }) {
  return <svg className={css.evidenceShieldIcon} data-ready={ready ? 'true' : 'false'} viewBox="0 0 36 40" fill="none" aria-hidden="true">
    <path d="M18 2.5 32 8v10.7c0 8.1-4.9 13.8-14 18.8C8.9 32.5 4 26.8 4 18.7V8l14-5.5Z" />
    {ready ? <path d="m11.5 19.5 4.2 4.2 9-9.4" /> : <path d="M18 12.5v9M18 27v.5" />}
  </svg>
}

type WorkbenchProps = ProjectStageWorkbenchHeroProps | ProjectStageWorkbenchViewProps

function isStageRecordBlocker(value: string): boolean {
  return value.includes('阶段状态文件') || value.includes('.fde/stages/')
}

function matchesArtifactBlocker(value: string, title: string): boolean {
  return value.includes(title) && (value.includes('尚未形成') || value.includes('无法读取'))
}

function LaterStagePanel({ props, workspace, sessionId, view, stageState, stage, surface, projectSurface, sourceFiles }: {
  readonly props: WorkbenchProps
  readonly workspace: { readonly workspaceId: string; readonly title: string; readonly path: string }
  readonly sessionId: string
  readonly view: boolean
  readonly stageState: ProjectStageValue
  readonly stage: FdeV2StageId
  readonly surface: V2StageSurfaceSnapshot | undefined
  readonly projectSurface: ProjectSurfaceSnapshot | undefined
  readonly sourceFiles: readonly ProjectSourceItem[]
}) {
  const [artifactsCollapsed, setArtifactsCollapsed] = useState(true)
  const [reviewing, setReviewing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [returning, setReturning] = useState(false)
  const [reviewCollapsed, setReviewCollapsed] = useState(false)
  const [returnReason, setReturnReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const stageOrder = [
    'discovery', 'definition', 'investigation', 'design',
    'evaluation', 'pilot', 'production', 'improvement',
  ] as const
  const index = stageOrder.indexOf(stage)
  if (surface === undefined) return <section className={css.state} role="alert"><strong>当前阶段资料尚未加载</strong><span>请刷新项目工作台后重试。</span></section>
  const current = surface.workItems.find(item => item.id === surface.currentWorkId) ?? surface.workItems[0]
  const requiredArtifacts = surface.artifacts.filter(artifact => artifact.required)
  const reviewedCount = surface.reviewReady ? Math.max(0, requiredArtifacts.length - 1) : 0
  const missingRequiredArtifacts = surface.artifacts.filter(artifact => artifact.required && artifact.status !== 'present')
  const stageRecordBlocker = surface.reviewBlockers.find(isStageRecordBlocker)
  const otherReviewBlockers = surface.reviewBlockers.filter(item => (
    !isStageRecordBlocker(item)
    && !surface.artifacts.some(artifact => matchesArtifactBlocker(item, artifact.title))
  ))
  const reviewReadinessItems = [
    ...(stageRecordBlocker === undefined ? [] : [{
      id: 'stage-progress',
      kind: 'progress',
      category: '阶段进度',
      title: stageRecordBlocker.includes('无法读取') ? '阶段进度读取失败' : '阶段进度尚未保存',
      purpose: stageRecordBlocker.includes('无法读取') ? '请修复阶段记录后刷新工作台。' : '完成第一次梳理后，系统会保存本阶段进度。',
      status: stageRecordBlocker.includes('无法读取') ? '需修复' : '待建立',
    }]),
    ...missingRequiredArtifacts.map(artifact => ({
      id: `artifact-${artifact.id}`,
      kind: 'artifact',
      category: '必备记录',
      title: artifact.title,
      purpose: artifact.status === 'error' ? '文件无法读取，请修复后刷新。' : artifact.purpose,
      status: artifact.status === 'error' ? '需修复' : '待整理',
    })),
    ...otherReviewBlockers.map((item, itemIndex) => ({
      id: `decision-${String(itemIndex)}`,
      kind: 'decision',
      category: '还需确认',
      title: item,
      purpose: '请继续核对事实，并把处理结果写入本阶段记录。',
      status: '待处理',
    })),
  ]
  if (!surface.reviewReady && reviewReadinessItems.length === 0) reviewReadinessItems.push({
    id: 'stage-in-progress',
    kind: 'progress',
    category: '阶段进度',
    title: '本阶段尚未进入可评审状态',
    purpose: '继续完成当前工作并刷新阶段记录。',
    status: '进行中',
  })
  const unresolvedReviewCount = surface.reviewReady
    ? 0
    : reviewReadinessItems.length
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
  return <section
    className={`${css.root} ${css.genericStageRoot}`}
    data-fde-stage-workbench=""
    data-conversation-hero-project=""
    data-stage={stage}
    data-conversation-composer-layout={stage === 'definition' ? 'stage-definition' : 'stage-execution'}
    data-conversation-composer-overlay={view ? '' : undefined}
    data-artifacts-collapsed={artifactsCollapsed ? 'true' : undefined}
    aria-label={`项目阶段工作台：${surface.title}`}
  >
    <div className={css.genericStageGrid} data-artifacts-collapsed={artifactsCollapsed ? 'true' : undefined}>
      <main>
        <section className={css.stageOverview} data-definition-hero={stage === 'definition' ? '' : undefined}>
          <header className={css.stageIntro}>
            <span>第 {surface.index}/8 阶段 · 本阶段目标</span>
            <h1 data-definition-stage-title={stage === 'definition' ? '' : undefined}>{surface.objective}</h1>
            <p>{surface.explanation}</p>
          </header>
          {stage === 'definition' && <>
            <div className={css.definitionHeroDecoration} aria-hidden="true"><img src="/fde-dashboard/project-priority-stack.png" alt="" /></div>
            <div className={css.definitionStageRing} data-definition-stage-ring="" aria-label={`当前处于第 ${String(surface.index)} 阶段，共 8 个阶段`}><strong>{surface.index}</strong><span>/8</span><small>当前阶段</small></div>
          </>}
          <div className={css.workPathMeta}><span>本阶段进度</span><b>{surface.presentCount}/{surface.requiredCount} 项必备记录已形成</b></div>
          <ol
            className={css.workPath}
            data-definition-work-path={stage === 'definition' ? '' : undefined}
            data-progress={stage === 'definition' && surface.reviewReady ? '3' : undefined}
            aria-label={`${surface.title}工作路径`}
          >
            {surface.workItems.map((item, itemIndex) => {
              const awaitingDecision = stage === 'definition' && surface.reviewReady && itemIndex === surface.workItems.length - 1
              const visibleStatus = awaitingDecision ? 'current' : item.status
              return <li key={item.id} data-status={visibleStatus}>
                <i>{awaitingDecision ? '●' : item.status === 'complete' ? '✓' : String(itemIndex + 1).padStart(2, '0')}</i>
                <span><strong>{item.title}</strong><small>{awaitingDecision || item.status === 'complete' ? '已完成' : item.status === 'current' ? '正在进行' : item.status === 'blocked' ? '存在阻塞' : '待开始'}</small></span>
              </li>
            })}
          </ol>
        </section>

        <section className={css.currentWork} data-definition-current-work={stage === 'definition' ? '' : undefined}>
          <header>
            <span>现在先做</span>
            <b>第 {String(Math.max(1, surface.workItems.findIndex(item => item.id === current?.id) + 1))} 步</b>
          </header>
          <h2>{current?.title ?? surface.title}</h2><p>{current?.purpose ?? surface.explanation}</p>
          <div className={css.promptGuide}>
            {stage === 'definition' && <SparkleIcon />}
            <div className={css.promptGuideCopy}>
              <span>可以直接让 Agent 从这里开始</span>
              <strong>{surface.prompt}</strong>
              {stage === 'definition' && <mark>不要更改 FDE 确认结论。</mark>}
              <small>按钮只把提示词放入输入框，不会自动发送，也不会替 FDE 确认阶段。</small>
            </div>
            {stage === 'definition' && <i className={css.promptSparkleAccent} aria-hidden="true">✦</i>}
          </div>
          <div className={css.workActions} data-definition-work-actions={stage === 'definition' ? '' : undefined}>
            <button type="button" className={css.primaryButton} onClick={() => {
              props.prepareStageDraft(sessionId, surface.prompt)
            }}>{stage === 'definition' && <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m5 3 8 5-8 5V3Z" /></svg>}开始本阶段工作</button>
            <button type="button" className={css.secondaryButton} onClick={() => {
              props.refreshProjectSurface(workspace.workspaceId)
            }}>{stage === 'definition' && <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M13 5.5A5.5 5.5 0 1 0 13.2 10M13 2.5v3h-3" /></svg>}刷新阶段记录</button>
            {stage === 'definition' && <span className={css.stageUpdateStatus}><i />阶段记录已更新 · 刚刚</span>}
          </div>
        </section>

        <section className={css.workflowsPanel} data-definition-review={stage === 'definition' ? '' : undefined}>
          <header>
            <div className={css.reviewHeading}>
              <span aria-hidden="true"><svg viewBox="0 0 20 20" fill="none"><path d="M6.5 4.5h7A1.5 1.5 0 0 1 15 6v10H5V6a1.5 1.5 0 0 1 1.5-1.5Z" /><path d="M8 4V2.75h4V4M7.5 9h5M7.5 12h5" /></svg></span>
              <div><small>评审准备</small><h2>{surface.reviewReady ? '材料已具备，请逐项核对' : '本阶段尚未达到评审条件'}</h2><p>{surface.reviewReady ? '文件齐备只代表可以开始评审，是否进入下一阶段仍由 FDE 决定。' : '还需保存阶段进度并补齐必备记录；材料齐备后仍由 FDE 人工判断。'}</p></div>
            </div>
            {surface.reviewReady
              ? <div className={css.reviewSummary} data-definition-review-summary={stage === 'definition' ? '' : undefined}>
                <b data-kind="materials"><i>✓</i>材料齐备 {surface.presentCount}/{surface.requiredCount}</b>
                <b data-kind="manual"><i>⊕</i>人工核对 {reviewedCount}/{requiredArtifacts.length}</b>
                <button type="button" onClick={() => { setReviewCollapsed(value => !value) }}><span aria-hidden="true">⌃</span>{reviewCollapsed ? '展开清单' : '收起清单'}</button>
              </div>
              : <div className={css.pendingReviewSummary}><b>{unresolvedReviewCount} 项待完成</b><span>{surface.presentCount}/{surface.requiredCount} 份必备记录</span></div>}
          </header>
          {surface.reviewReady
            ? !reviewCollapsed && <div className={css.stageReviewArtifacts}>
              {requiredArtifacts.map((artifact, artifactIndex, artifacts) => {
                const reviewPending = artifactIndex === artifacts.length - 1
                return <article key={artifact.id} data-review-pending={reviewPending ? 'true' : undefined}>
                  <i aria-hidden="true">{reviewPending ? '⊕' : '✓'}</i>
                  <b>{String(artifactIndex + 1).padStart(2, '0')}</b>
                  <span><svg aria-hidden="true" viewBox="0 0 20 20"><path d="M6.5 3.5h6l3 3v8.75A1.75 1.75 0 0 1 13.75 17H6.5a1.75 1.75 0 0 1-1.75-1.75v-10A1.75 1.75 0 0 1 6.5 3.5Z" /><path d="M12.5 3.75v3h3" /></svg><strong>{definitionArtifactTitle(artifact, artifactIndex)}</strong></span>
                  <small>{artifact.purpose}</small>
                  <em>{reviewPending ? '待核对' : '已核对'}</em>
                  {artifact.status === 'present' && <button type="button" onClick={() => { openFile(artifact.path, definitionArtifactTitle(artifact, artifactIndex)) }}>{reviewPending ? '查看并核对' : '查看'} <span aria-hidden="true">›</span></button>}
                </article>
              })}
            </div>
            : <div className={css.reviewReadinessGrid}>
              {reviewReadinessItems.map((item, itemIndex) => <article key={item.id} data-kind={item.kind}>
                <i>{String(itemIndex + 1).padStart(2, '0')}</i>
                <span><small>{item.category}</small><strong>{item.title}</strong><p>{item.purpose}</p></span>
                <b>{item.status}</b>
              </article>)}
            </div>}
          {surface.reviewReady && !reviewCollapsed && <button type="button" className={css.reviewAllRecords} onClick={() => { setArtifactsCollapsed(false) }}>查看全部记录 ({requiredArtifacts.length}) <span aria-hidden="true">›</span></button>}
          <div className={css.genericGateActions} data-definition-review-actions={stage === 'definition' ? '' : undefined}>
            {surface.reviewReady && <button type="button" className={css.primaryButton} onClick={() => { setReviewing(value => !value) }}>{reviewing ? '收起人工评审' : stage === 'improvement' ? '评审本轮改进' : '提交 FDE 评审'}</button>}
            <button type="button" className={css.tertiaryButton} onClick={() => { setReturning(value => !value) }}>返回上一阶段</button>
            {stage === 'definition' && <span className={css.gateDecisionHint}><i aria-hidden="true">♢</i>FDE 决定是否进入下一阶段</span>}
          </div>
          {reviewing && <div className={css.genericReview}><strong>确认阶段记录和证据已经核对？</strong><p>{stage === 'improvement' ? '确认后记录一次改进循环，项目仍停留在持续改进阶段。' : `确认后进入“${V2_STAGE_NAMES[Math.min(7, index + 1)]}”。后续仍可带原因返回补充。`}</p><button type="button" className={css.primaryButton} disabled={submitting} onClick={() => { void complete() }}>{submitting ? '正在提交…' : '确认并继续'}</button></div>}
          {returning && <div className={css.genericReview}><label htmlFor="v2-stage-return-reason">返回原因</label><textarea id="v2-stage-return-reason" value={returnReason} onChange={(event) => { setReturnReason(event.target.value) }} placeholder="例如：客户补充了新的业务边界，需要回到上一阶段重新核对。" /><button type="button" className={css.secondaryButton} disabled={submitting} onClick={() => { void returnStage() }}>保留现有材料并返回</button></div>}
          {error !== null && <p className={css.inlineError} role="alert">{error}</p>}
        </section>
      </main>

      <aside data-stage-artifact-column="" data-collapsed={artifactsCollapsed ? 'true' : undefined}>
        <ProjectRecordPanel
          actualStage={stage}
          collapsed={artifactsCollapsed}
          projectSurface={projectSurface}
          sourceFiles={sourceFiles}
          openFile={openFile}
          onCollapsedChange={setArtifactsCollapsed}
        />
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

function definitionArtifactTitle(artifact: DiscoveryArtifact, index: number): string {
  const titles = ['当前基线记录', '成功标准与交付边界', '责任人与停止条件'] as const
  return titles[index] ?? artifactDisplayTitle(artifact)
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

function stageArtifacts(surface: ProjectSurfaceSnapshot | undefined, index: number): readonly DiscoveryArtifact[] {
  // oxlint-disable-next-line typescript/no-unnecessary-condition -- persisted pre-V2 snapshots can omit discovery.
  if (index === 0) return surface?.discovery?.artifacts ?? fallbackArtifacts(surface)
  const stage = FDE_V2_STAGE_IDS[index]
  if (stage === undefined || stage === 'discovery') return []
  return surface?.v2Stages[stage as V2LifecycleStageId]?.artifacts ?? []
}

function recommendationLabel(value: V2StageSurfaceSnapshot['recommendation'] | undefined): string | undefined {
  if (value === 'go') return '继续推进'
  if (value === 'revise') return '补充后再推进'
  if (value === 'narrow') return '收窄范围后推进'
  if (value === 'stop') return '停止投入'
  return undefined
}

function recordStageTitle(surface: ProjectSurfaceSnapshot | undefined, index: number): string {
  const stage = FDE_V2_STAGE_IDS[index]
  if (stage === undefined || stage === 'discovery') return V2_STAGE_NAMES[index] ?? '项目记录'
  return surface?.v2Stages[stage as V2LifecycleStageId]?.title ?? V2_STAGE_NAMES[index] ?? '项目记录'
}

function recordStageInputs(surface: ProjectSurfaceSnapshot | undefined, index: number): readonly DiscoveryArtifact[] {
  if (index === 0) return []
  return stageArtifacts(surface, index - 1).filter(artifact => artifact.status === 'present')
}

function ProjectRecordPanel({
  actualStage, collapsed, projectSurface, sourceFiles, openFile, onCollapsedChange, onStartReview, reviewReady = false,
}: {
  readonly actualStage: FdeV2StageId
  readonly collapsed: boolean
  readonly projectSurface: ProjectSurfaceSnapshot | undefined
  readonly sourceFiles: readonly ProjectSourceItem[]
  readonly openFile: (path: string, title: string) => void
  readonly onCollapsedChange: (collapsed: boolean) => void
  readonly onStartReview?: () => void
  readonly reviewReady?: boolean
}) {
  const actualIndex = Math.max(0, FDE_V2_STAGE_IDS.indexOf(actualStage))
  const [selectedIndex, setSelectedIndex] = useState(actualIndex)
  const [showAll, setShowAll] = useState(false)
  const recordIndexes = Array.from({ length: actualIndex + 1 }, (_, offset) => actualIndex - offset)

  useEffect(() => {
    setSelectedIndex(actualIndex)
    setShowAll(false)
  }, [actualIndex])

  const selectStage = (index: number): void => {
    setSelectedIndex(index)
    setShowAll(false)
    onCollapsedChange(false)
  }
  const selectedTitle = recordStageTitle(projectSurface, selectedIndex)
  const selectedArtifacts = stageArtifacts(projectSurface, selectedIndex)
  const selectedRequired = selectedArtifacts.filter(artifact => artifact.required)
  const selectedPresent = selectedRequired.filter(artifact => artifact.status === 'present').length
  const selectedInputs = recordStageInputs(projectSurface, selectedIndex)
  const selectedIsCurrent = selectedIndex === actualIndex
  const selectedRecommendation = selectedIndex === 0
    ? undefined
    : recommendationLabel(projectSurface?.v2Stages[FDE_V2_STAGE_IDS[selectedIndex] as V2LifecycleStageId]?.recommendation)

  if (collapsed) {
    return <section className={css.projectRecordRail} data-definition-record-rail={actualStage === 'definition' ? '' : undefined} aria-label="项目记录轴">
      <header><svg className={css.artifactRailIcon} viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M6.5 3.5h6l3 3v8.75A1.75 1.75 0 0 1 13.75 17H6.5a1.75 1.75 0 0 1-1.75-1.75v-10A1.75 1.75 0 0 1 6.5 3.5Z" /><path d="M12.5 3.75v3h3M7.5 10h5M7.5 13h5" /></svg><span>项目记录</span></header>
      <div className={css.projectRecordNodes}>
        {recordIndexes.map((index) => {
          const artifacts = stageArtifacts(projectSurface, index)
          const required = artifacts.filter(artifact => artifact.required)
          const present = required.filter(artifact => artifact.status === 'present').length
          const current = index === actualIndex
          const title = recordStageTitle(projectSurface, index)
          return <button
            key={FDE_V2_STAGE_IDS[index]}
            type="button"
            className={css.projectRecordNode}
            data-current={current ? 'true' : undefined}
            aria-label={`查看第 ${String(index + 1)} 阶段记录：${title}`}
            data-tooltip={`第 ${String(index + 1)} 阶段 · ${title} · ${current ? '当前阶段' : '已完成'} · ${String(present)}/${String(required.length)} 项必备记录`}
            onClick={() => { selectStage(index) }}
          ><i>{String(index + 1).padStart(2, '0')}</i><span>{current ? '当前' : '已完成'}</span><b>{present}/{required.length}</b><DocumentStatusIcon state={current ? 'current' : 'complete'} /></button>
        })}
        <button type="button" className={css.projectRecordAllButton} data-definition-record-all={actualStage === 'definition' ? '' : undefined} aria-label="查看全部项目记录" data-tooltip="查看全部已有阶段记录" onClick={() => { setShowAll(true); onCollapsedChange(false) }}>全部<DocumentStatusIcon state="all" /></button>
      </div>
    </section>
  }

  return <section className={css.artifactsPanel} data-project-record-panel="">
    <header>
      <div><span>项目记录</span><h2>{showAll ? '全部已有记录' : selectedTitle}</h2><p>{showAll ? '按阶段查看项目已经留下的依据、产物和人工决定。' : selectedIsCurrent ? '当前阶段的输入和记录会随工作持续更新。' : '这是已经由 FDE 确认并推进的历史记录。'}</p></div>
      <div className={css.artifactHeaderActions}><b>{showAll ? `${String(recordIndexes.length)} 个阶段` : `${String(selectedPresent)}/${String(selectedRequired.length)}`}</b><button type="button" aria-expanded="true" aria-label="收起项目记录" title="收起项目记录" onClick={() => { onCollapsedChange(true) }}>收起</button></div>
    </header>

    {showAll
      ? <div className={css.projectRecordSummaryList}>{recordIndexes.map((index) => {
        const artifacts = stageArtifacts(projectSurface, index)
        const required = artifacts.filter(artifact => artifact.required)
        const present = required.filter(artifact => artifact.status === 'present').length
        return <button key={FDE_V2_STAGE_IDS[index]} type="button" onClick={() => { selectStage(index) }}>
          <i>{String(index + 1).padStart(2, '0')}</i>
          <span>
            <strong>{recordStageTitle(projectSurface, index)}</strong>
            <small>{index === actualIndex ? '当前阶段' : '已完成 · FDE 已确认'}</small>
          </span>
          <b>{present}/{required.length}</b>
        </button>
      })}</div>
      : <>
        <nav className={css.projectRecordStageTabs} aria-label="切换已有阶段记录">
          {recordIndexes.map(index => <button
            key={FDE_V2_STAGE_IDS[index]}
            type="button"
            data-active={index === selectedIndex ? 'true' : undefined}
            onClick={() => { setSelectedIndex(index); setShowAll(false) }}
          >{String(index + 1).padStart(2, '0')}</button>)}
        </nav>
        <section className={css.recordGroup} aria-label="阶段输入">
          <header>
            <span><small>阶段输入</small><strong>当时依据了什么</strong></span>
            <b>{selectedIndex === 0 ? sourceFiles.length : selectedInputs.length} 项</b>
          </header>
          {selectedIndex === 0 && sourceFiles.length > 0 && <div className={css.sourceList}>
            {sourceFiles.map(file => <button
              key={file.sourceId} type="button" aria-label={`预览客户资料：${file.originalName}`}
              onClick={() => { openFile(file.relativePath, file.originalName) }}
            >
              <i>{file.extension === '' ? '文件' : file.extension.slice(0, 4).toUpperCase()}</i>
              <span><strong>{file.originalName}</strong><small>{formatSourceBytes(file.bytes)} · {sourceStatus(file)}</small></span>
              <em>打开</em>
            </button>)}
          </div>}
          {selectedIndex > 0 && selectedInputs.length > 0 && <div className={css.sourceList}>
            {selectedInputs.map(artifact => <button
              key={artifact.id} type="button"
              onClick={() => { openFile(artifact.path, artifactDisplayTitle(artifact)) }}
            >
              <i>记</i>
              <span><strong>{artifactDisplayTitle(artifact)}</strong><small>来自上一阶段的已保存记录</small></span>
              <em>打开</em>
            </button>)}
          </div>}
          {(
            (selectedIndex === 0 && sourceFiles.length === 0)
            || (selectedIndex > 0 && selectedInputs.length === 0)
          ) && <p className={css.emptySources}>没有登记可直接追溯的阶段输入。</p>}
        </section>
        <div className={css.outputHeading}>
          <span><small>阶段输出</small><strong>留下了什么</strong></span>
          <b>{selectedPresent}/{selectedRequired.length}</b>
        </div>
        <div className={css.artifactList}>{selectedArtifacts.map(artifact => <article
          key={artifact.id} data-status={artifact.status}
        >
          <header>
            <i>{artifact.required ? '记' : '需'}</i>
            <span><strong>{artifactDisplayTitle(artifact)}</strong><small>{artifactGap(artifact)}</small></span>
          </header>
          <footer>
            <b>{artifactStatus(artifact)}</b>
            {artifact.status === 'present' && <button type="button" onClick={() => {
              openFile(artifact.path, artifactDisplayTitle(artifact))
            }}>预览</button>}
          </footer>
        </article>)}</div>
        <section className={css.projectRecordDecision} data-current={selectedIsCurrent ? 'true' : undefined}>
          <i aria-hidden="true">{selectedIsCurrent ? '○' : '✓'}</i>
          <span>
            <small>人工决定</small>
            <strong>{selectedIsCurrent ? '等待 FDE 完成本阶段判断' : 'FDE 已确认并推进到下一阶段'}</strong>
            {selectedRecommendation !== undefined && <em>当时建议：{selectedRecommendation}</em>}
          </span>
        </section>
        {selectedIsCurrent && reviewReady && onStartReview !== undefined && <div
          className={css.reviewAction} data-stage-review-action=""
        >
          <span><strong>候选材料已齐备</strong><small>请先阅读记录，再由 FDE 决定是否推进。</small></span>
          <button type="button" className={css.primaryButton} onClick={onStartReview}>
            提交 FDE 评审 <span aria-hidden="true">→</span>
          </button>
        </div>}
      </>}
    {!showAll && <button type="button" className={css.projectRecordAllLink} onClick={() => { setShowAll(true) }}>查看全部已有记录</button>}
  </section>
}

function BrowsedStagePanel({ props, workspace, sessionId, view, actualStage, viewedStage, surface, sourceFiles }: {
  readonly props: WorkbenchProps
  readonly workspace: { readonly workspaceId: string; readonly title: string; readonly path: string }
  readonly sessionId: string
  readonly view: boolean
  readonly actualStage: FdeV2StageId
  readonly viewedStage: FdeV2StageId
  readonly surface: ProjectSurfaceSnapshot | undefined
  readonly sourceFiles: readonly ProjectSourceItem[]
}) {
  const [fileError, setFileError] = useState<string | null>(null)
  const actualIndex = FDE_V2_STAGE_IDS.indexOf(actualStage)
  const viewedIndex = FDE_V2_STAGE_IDS.indexOf(viewedStage)
  const historical = viewedIndex < actualIndex
  const later = viewedStage === 'discovery' ? undefined : surface?.v2Stages[viewedStage as V2LifecycleStageId]
  const discovery = surface?.discovery
  const title = viewedStage === 'discovery' ? V2_STAGE_NAMES[0] : later?.title ?? V2_STAGE_NAMES[viewedIndex]
  const objective = viewedStage === 'discovery'
    ? '先弄清客户现在怎么做、哪里出了问题，再决定先解决什么。'
    : later?.objective ?? '本阶段资料尚未加载。'
  const explanation = viewedStage === 'discovery'
    ? '结合客户资料和真实案例还原现状，保留未确认事实，由 FDE 判断是否值得继续投入。'
    : later?.explanation ?? '请返回当前阶段，待项目前置事实具备后再查看。'
  const artifacts = stageArtifacts(surface, viewedIndex)
  const presentArtifacts = artifacts.filter(artifact => artifact.status === 'present')
  const previousArtifacts = viewedIndex > 0
    ? stageArtifacts(surface, viewedIndex - 1).filter(artifact => artifact.status === 'present')
    : []
  const selectedWorkflow = discovery?.workflows.items.find(item => item.id === discovery.workflows.selectedWorkflowId)
    ?? discovery?.workflows.items.find(item => item.disposition === 'selected')
  const stageRecommendation = recommendationLabel(later?.recommendation)
  const stageBlockers = viewedStage === 'discovery'
    ? discovery?.blockers ?? []
    : (later?.blockers ?? []).filter(blocker => blocker.status === 'open').map(blocker => blocker.title)
  const nextStageTitle = V2_STAGE_NAMES[Math.min(viewedIndex + 1, V2_STAGE_NAMES.length - 1)]
  const openFile = (path: string, artifactTitle: string): void => {
    setFileError(null)
    void props.openProjectFile(sessionId, workspace.path, path, artifactTitle).catch((error: unknown) => {
      setFileError(error instanceof Error ? error.message : String(error))
    })
  }

  return <section className={`${css.root} ${css.browsedStage}`} data-stage={viewedStage} data-historical={historical ? 'true' : undefined} data-future={historical ? undefined : 'true'} data-conversation-composer-layout="stage-history" data-conversation-composer-overlay={view ? '' : undefined} aria-label={`正在查看：${title}`}>
    <header className={css.browsedStageNotice}>
      {historical && <HistoricalNoticeIcon />}
      <div><span>{historical ? '阶段完成记录' : '未开始阶段'}</span><strong>正在查看第 {String(viewedIndex + 1)} 阶段，项目当前在“{V2_STAGE_NAMES[actualIndex]}”</strong><p>{historical ? '以下内容来自当前项目已经保存的资料和阶段记录，不用计划模板补齐缺失事实。' : '这里只说明该阶段何时可以开始，不代表已经安排或执行了工作。'}</p></div>
      <button type="button" className={css.secondaryButton} onClick={() => { props.returnToCurrentStage(workspace.workspaceId) }}>返回当前阶段 {historical && <span aria-hidden="true">→</span>}</button>
    </header>

    {historical
      ? <>
        <section className={css.browsedStageGoal} data-stage-goal="">
          <div className={css.historicalGoalCopy}>
            <span>第 {String(viewedIndex + 1)}/8 阶段 · 已完成</span><h1 data-stage-title="">{title}</h1><p>{explanation}</p>
            <div className={css.historicalGoalFacts}>
              <span><HistoricalFactIcon type="input" />{sourceFiles.length} 份输入材料</span>
              <span><HistoricalFactIcon type="record" />{presentArtifacts.length} 份阶段记录</span>
              <span><HistoricalFactIcon type="gate" />已通过人工阶段门</span>
            </div>
          </div>
          <div className={css.historicalCompletionRing} data-stage-ring="" aria-label={`第 ${String(viewedIndex + 1)}/8 阶段已完成`}><strong>{viewedIndex + 1}<small>/8</small></strong><span>已完成</span><i>✓</i></div>
          <div className={css.historicalGoalArt} data-stage-art="" aria-hidden="true"><img src="/fde-dashboard/stage-evidence-stack-3d.webp" alt="" /></div>
          <div className={css.historicalArchiveNote} data-stage-art-note="">◷ 阶段记录已封存 · 可追溯</div>
        </section>
        <section className={css.historicalEvidenceChain} data-evidence-chain="">
          <header className={css.historicalEvidenceHeader}>
            <div><span>阶段证据链</span><h2 data-evidence-title="">从输入依据到人工结论</h2><p>所有结论均可回到来源材料与阶段记录。</p></div>
            <div className={css.historicalEvidenceDirection} aria-hidden="true"><strong>01</strong><i /><strong>03</strong></div>
          </header>
          <div className={css.historicalStageGrid}>
            <section data-evidence-input="">
            <header className={css.historicalColumnHeader}><div><span>阶段输入</span><h2>当时依据了什么</h2></div><b>{viewedIndex === 0 ? sourceFiles.length : previousArtifacts.length} 份材料</b></header>
            {viewedIndex === 0 && sourceFiles.length > 0 && <span className={css.evidenceGroupLabel}>客户提供</span>}
            <ul className={css.historicalFactList}>
              {viewedIndex === 0 && sourceFiles.map(source => <li key={source.sourceId} data-evidence-row="" data-source-row="">
                <EvidenceDocumentIcon />
                <span>
                  <strong data-evidence-row-title="">{source.originalName}</strong>
                  <small>{sourceStatus(source)} · {formatSourceBytes(source.bytes)}</small>
                </span>
                <button type="button" onClick={() => {
                  openFile(source.relativePath, source.originalName)
                }}>预览</button>
              </li>)}
              {viewedIndex > 0 && previousArtifacts.map(artifact => <li key={artifact.id} data-evidence-row="" data-source-row="">
                <EvidenceDocumentIcon />
                <span><strong data-evidence-row-title="">{artifactDisplayTitle(artifact)}</strong><small>来自上一阶段的已保存记录</small></span>
                <button type="button" onClick={() => {
                  openFile(artifact.path, artifactDisplayTitle(artifact))
                }}>预览</button>
              </li>)}
            </ul>
            {(
              (viewedIndex === 0 && sourceFiles.length === 0)
              || (viewedIndex > 0 && previousArtifacts.length === 0)
            ) && <p className={css.unregisteredFact}>未登记可直接追溯的阶段输入。</p>}
            </section>
            <section data-evidence-output="">
            <header className={css.historicalColumnHeader}><div><span>阶段输出</span><h2>已经留下什么</h2></div><b>{presentArtifacts.length} 份记录</b></header>
            <ul className={css.historicalFactList}>{presentArtifacts.map(artifact => <li key={artifact.id} data-evidence-row="">
              <EvidenceDocumentIcon /><i className={css.evidenceStateDot} aria-hidden="true" />
              <span><strong data-evidence-row-title="">{artifactDisplayTitle(artifact)}</strong><small>{artifact.purpose}</small></span>
              <button type="button" onClick={() => {
                openFile(artifact.path, artifactDisplayTitle(artifact))
              }}>预览</button>
            </li>)}</ul>
            {presentArtifacts.length === 0 && <p className={css.unregisteredFact}>未发现可读取的阶段产物。</p>}
            </section>
            <section data-evidence-decision="">
            <header><span>人工结论</span><h2>当时如何决定</h2></header>
            <div className={css.historicalDecision}><EvidenceShieldIcon /><span><strong>已通过 FDE 人工阶段门</strong><small>项目随后进入“{nextStageTitle}”。</small></span></div>
            {selectedWorkflow !== undefined && viewedStage === 'discovery' && <dl><dt>选定业务流程</dt><dd>{selectedWorkflow.title}</dd></dl>}
            {stageRecommendation !== undefined && <dl><dt>阶段建议</dt><dd>{stageRecommendation}</dd></dl>}
              <dl><dt>遗留阻塞</dt><dd>{stageBlockers.length === 0 ? '未登记未解决阻塞' : `${String(stageBlockers.length)} 项`}</dd></dl>
              <div className={css.historicalDecisionLink}>查看决策记录 <span aria-hidden="true">→</span></div>
            </section>
          </div>
          <ol className={css.historicalMilestones} data-stage-milestones="" aria-label="阶段封存轨迹">
            {['材料进入', '事实还原', '待确认项', '流程冻结', 'FDE 阶段门'].map(item => <li key={item}><i>✓</i><span>{item}</span></li>)}
          </ol>
          <footer className={css.historicalArchiveFooter}><span><HistoricalArchiveIcon />阶段已封存；后续阶段可引用，但不能静默改写原始记录。</span><strong>查看全部阶段记录</strong></footer>
        </section>
      </>
      : <>
        <section className={css.browsedStageGoal}>
          <div className={css.historicalGoalCopy}>
            <span>第 {String(viewedIndex + 1)}/8 阶段 · 尚未开始</span><h1>{title}</h1><p>{explanation}</p>
            <div className={css.historicalGoalFacts}>
              <span><HistoricalFactIcon type="input" />{previousArtifacts.length} 份前置阶段记录</span>
              <span><HistoricalFactIcon type="record" />{artifacts.filter(artifact => artifact.required).length} 份预计必备记录</span>
              <span><HistoricalFactIcon type="gate" />尚未进入人工阶段门</span>
            </div>
          </div>
          <div className={css.historicalCompletionRing} data-complete="false" data-future="true" aria-label={`第 ${String(viewedIndex + 1)}/8 阶段尚未开始`}><strong>{viewedIndex + 1}<small>/8</small></strong><span>未开始</span><i>{viewedIndex + 1}</i></div>
          <div className={css.historicalGoalArt} aria-hidden="true"><img src="/fde-dashboard/stage-evidence-stack-3d.webp" alt="" /></div>
          <div className={css.historicalArchiveNote} data-stage-art-note="">◷ 等待“{V2_STAGE_NAMES[actualIndex]}”完成并通过人工阶段门</div>
        </section>
        <section className={css.historicalEvidenceChain} data-future-stage="">
          <header className={css.historicalEvidenceHeader}>
            <div><span>阶段准备</span><h2>从前置条件到人工阶段门</h2><p>这里只展示开始条件和预计记录，不把尚未发生的工作写成事实。</p></div>
            <div className={css.historicalEvidenceDirection} aria-hidden="true"><strong>01</strong><i /><strong>03</strong></div>
          </header>
          <div className={css.historicalStageGrid}>
            <section>
              <header><span>阶段输入</span><h2>开始前需要什么</h2></header>
              <ul className={css.historicalFactList}>{previousArtifacts.map(artifact => <li key={artifact.id}>
                <span><strong>{artifactDisplayTitle(artifact)}</strong><small>来自上一阶段的已保存记录</small></span>
                <button type="button" onClick={() => { openFile(artifact.path, artifactDisplayTitle(artifact)) }}>预览</button>
              </li>)}</ul>
              {previousArtifacts.length === 0 && <p className={css.unregisteredFact}>当前阶段尚未完成，前置记录仍在形成。</p>}
            </section>
            <section>
              <header><span>阶段输出</span><h2>开始后预计形成</h2></header>
              <ul className={css.historicalFactList}>{artifacts.map(artifact => <li key={artifact.id} data-status="waiting">
                <span><strong>{artifactDisplayTitle(artifact)}</strong><small>{artifact.required ? '必备记录' : '按需记录'} · {artifact.purpose}</small></span>
              </li>)}</ul>
              {artifacts.length === 0 && <p className={css.unregisteredFact}>阶段记录定义尚未加载。</p>}
            </section>
            <section>
              <header><span>人工结论</span><h2>何时能够开始</h2></header>
              <div className={css.historicalDecision}><i aria-hidden="true">{viewedIndex + 1}</i><span><strong>等待前置阶段完成</strong><small>尚未安排或执行本阶段工作。</small></span></div>
              <dl><dt>当前阶段</dt><dd>{V2_STAGE_NAMES[actualIndex]}</dd><dt>开始条件</dt><dd>先完成此前阶段并由 FDE 确认</dd><dt>阶段目标</dt><dd>{objective}</dd></dl>
            </section>
          </div>
          <ol className={css.historicalMilestones} aria-label={`第 ${String(viewedIndex + 1)} 阶段预计路径`}>
            {['前置阶段完成', '开始条件确认', '执行阶段工作', '形成阶段记录', 'FDE 阶段门'].map((item, index) => <li key={item} data-status="waiting"><i>{index + 1}</i><span>{item}</span></li>)}
          </ol>
          <footer className={css.historicalArchiveFooter}><span><HistoricalArchiveIcon />当前只读查看；返回当前阶段继续形成真实记录。</span><strong>尚未开始</strong></footer>
        </section>
      </>}
    {fileError !== null && <p className={css.inlineError} role="alert">{fileError}</p>}
  </section>
}

function StageWorkbenchPanel({ props, workspace, sessionId, view }: {
  readonly props: WorkbenchProps
  readonly workspace: { readonly workspaceId: string; readonly title: string; readonly path: string }
  readonly sessionId: string
  readonly view: boolean
}) {
  const [actionError, setActionError] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [reviewMode, setReviewMode] = useState(false)
  const [reviewConfirming, setReviewConfirming] = useState(false)
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [reviewError, setReviewError] = useState<string | null>(null)
  const sessionRunning = props.useSessions(snapshot => (
    snapshot.byId[sessionId as keyof typeof snapshot.byId]?.running ?? false
  ))
  const previousSessionRunning = useRef(sessionRunning)
  const stageState = props.useStageProgress(snapshot => snapshot.byWorkspace[workspace.workspaceId])
  const surfaceState = props.useProjectSurfaces(snapshot => snapshot.byWorkspace[workspace.workspaceId])
  const sourceState = props.useProjectSources(snapshot => snapshot.byWorkspace[workspace.workspaceId])
  const selectedStage = props.useStageView(snapshot => snapshot.byWorkspace[workspace.workspaceId])
  const loadActions = useRef({
    loadStage: props.loadStage,
    refreshProjectSurface: props.refreshProjectSurface,
    loadProjectSources: props.loadProjectSources,
  })

  useEffect(() => {
    loadActions.current.loadStage(workspace.workspaceId)
    loadActions.current.refreshProjectSurface(workspace.workspaceId)
    loadActions.current.loadProjectSources(workspace.workspaceId, true)
  }, [workspace.workspaceId])

  useEffect(() => {
    if (previousSessionRunning.current && !sessionRunning) {
      loadActions.current.refreshProjectSurface(workspace.workspaceId)
      loadActions.current.loadProjectSources(workspace.workspaceId, true)
    }
    previousSessionRunning.current = sessionRunning
  }, [sessionRunning, workspace.workspaceId])

  const files = sourceState?.files ?? []
  const surface = surfaceState?.status === 'ready' ? surfaceState.value : undefined
  const v2Stage = stageState?.status === 'ready'
    ? (stageState.value.v2Stage ?? (['discovery', 'definition', 'investigation', 'design', 'evaluation', 'pilot', 'production', 'improvement'] as const)[LEGACY_TO_V2_STAGE[stageState.value.currentStage]])
    : undefined
  const viewedStage = selectedStage ?? v2Stage
  const discovery = surface?.discovery
  const artifacts: readonly DiscoveryArtifact[] = discovery?.artifacts ?? fallbackArtifacts(surface)
  const requiredArtifacts = artifacts.filter(artifact => artifact.required)
  const presentCount = discovery?.presentCount ?? requiredArtifacts.filter(artifact => artifact.status === 'present').length
  const reviewReady = discovery?.reviewReady ?? presentCount === requiredArtifacts.length
  const hasEngagementReframe = artifacts.some(artifact => artifact.id === 'engagement-reframe' && artifact.status === 'present')
  const fallbackWorkIndex = Math.min(FALLBACK_WORK.length - 1, Math.max(0, presentCount))
  const fallbackWork = FALLBACK_WORK[fallbackWorkIndex]
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
  const selectedWorkflow = workflowCatalog.items.find(item => item.id === workflowCatalog.selectedWorkflowId)
    ?? workflowCatalog.items.find(item => item.disposition === 'selected')
    ?? workflowCatalog.items[0]
  const workflowEvidence = selectedWorkflow?.evidence ?? { confirmed: 0, inferred: 0, unverified: 0 }
  const artifactEvidenceCount = artifacts.reduce((total, artifact) => total + (artifact.evidenceRefs?.length ?? 0), 0)
  const artifactCatalogError = artifacts.find(artifact => artifact.message?.includes('Artifact Catalog 无效'))?.message

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

  const discoveryActions = () => {
    if (artifactCatalogError !== undefined) {
      return <button type="button" className={css.primaryButton} onClick={() => { prepareDraft('repair-stage-records') }}>修复阶段记录</button>
    }
    if (reviewReady) {
      return <>
        <button type="button" className={css.primaryButton} data-stage-review-action="" onClick={() => { setReviewError(null); setReviewConfirming(false); setReviewMode(true) }}>提交 FDE 评审</button>
        <button type="button" className={css.secondaryButton} onClick={() => { prepareDraft('form-conclusion') }}>继续核对未确认事项</button>
        {hasEngagementReframe && <button type="button" className={css.tertiaryButton} onClick={() => { prepareDraft('reframe-engagement') }}>继续核对范围冲突</button>}
      </>
    }
    if (currentWorkId === 'restore-workflow') {
      return <>
        <button type="button" className={css.primaryButton} onClick={() => { prepareDraft('restore-workflow', files.map(file => file.relativePath)) }}>继续还原实际流程</button>
        <button type="button" className={css.secondaryButton} onClick={() => { prepareDraft('prepare-interview') }}>补充流程访谈</button>
        {hasEngagementReframe && <button type="button" className={css.tertiaryButton} onClick={() => { prepareDraft('reframe-engagement') }}>继续核对范围冲突</button>}
      </>
    }
    if (currentWorkId === 'qualify-value') {
      return <>
        <button type="button" className={css.primaryButton} onClick={() => { prepareDraft('qualify-value') }}>核对问题价值与责任</button>
        {hasEngagementReframe && <button type="button" className={css.secondaryButton} onClick={() => { prepareDraft('reframe-engagement') }}>核对冲突并调整候选边界</button>}
      </>
    }
    if (currentWorkId === 'form-conclusion') {
      return <>
        <button type="button" className={css.primaryButton} onClick={() => { prepareDraft('form-conclusion') }}>整理阶段候选结论</button>
        {hasEngagementReframe && <button type="button" className={css.secondaryButton} onClick={() => { prepareDraft('reframe-engagement') }}>继续处理未决范围冲突</button>}
      </>
    }
    return <>
      <button type="button" className={css.primaryButton} onClick={() => { prepareDraft('prepare-interview') }}>开始梳理真实流程</button>
      {files.length > 0 && <button type="button" className={css.secondaryButton} onClick={() => { prepareDraft('qualify-workflow', files.map(file => file.relativePath)) }}>{`根据客户资料开始梳理（${String(files.length)}）`}</button>}
      {hasEngagementReframe && <button type="button" className={css.tertiaryButton} onClick={() => { prepareDraft('reframe-engagement') }}>继续核对范围冲突</button>}
    </>
  }

  if (stageState?.status === 'error') {
    return <section className={css.state} role="alert"><strong>当前阶段读取失败</strong><span>{stageState.message}</span></section>
  }

  if (v2Stage !== undefined && viewedStage !== undefined && viewedStage !== v2Stage) {
    return <BrowsedStagePanel
      props={props} workspace={workspace} sessionId={sessionId} view={view}
      actualStage={v2Stage} viewedStage={viewedStage} surface={surface} sourceFiles={files}
    />
  }

  if (v2Stage !== undefined && v2Stage !== 'discovery' && stageState?.status === 'ready') {
    return <LaterStagePanel
      props={props} workspace={workspace} sessionId={sessionId} view={view}
      stageState={stageState.value} stage={v2Stage}
      surface={surface?.v2Stages[v2Stage as V2LifecycleStageId]}
      projectSurface={surface} sourceFiles={files}
    />
  }

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
              <header>
                <div><span>本次评审对象</span><h2>{selectedWorkflow?.title ?? '尚未形成可评审的业务流程'}</h2></div>
                <b>{selectedWorkflow === undefined ? '待补充' : workflowDisposition(selectedWorkflow.disposition)}</b>
              </header>
              {selectedWorkflow === undefined
                ? <p>请返回第一阶段继续还原客户的真实工作流程。</p>
                : <>
                  <p>{selectedWorkflow.problem}</p>
                  <dl>
                    <div><dt>实际由谁处理</dt><dd>{selectedWorkflow.actor}</dd></div>
                    <div><dt>什么时候发生</dt><dd>{selectedWorkflow.trigger}</dd></div>
                  </dl>
                </>}
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
      className={`${css.root} ${css.browsedStage} ${css.currentDiscoveryStage}`}
      data-conversation-hero-project=""
      data-fde-stage-workbench=""
      data-stage="discovery"
      data-conversation-composer-layout="stage-execution"
      data-conversation-composer-overlay={view ? '' : undefined}
      data-artifacts-collapsed="true"
      aria-label="项目阶段工作台：发现高价值问题"
    >
      <section className={css.browsedStageGoal} data-stage-goal="">
        <div className={css.historicalGoalCopy}>
          <span>第 1/8 阶段 · 进行中</span><h1 data-stage-title="">发现高价值问题</h1>
          <p>结合客户资料和真实案例还原现状，保留未确认事实，由 FDE 判断是否值得继续投入。</p>
          <div className={css.historicalGoalFacts}>
            <span><HistoricalFactIcon type="input" />{files.length} 份输入材料</span>
            <span><HistoricalFactIcon type="record" />{presentCount}/{requiredArtifacts.length} 份必备记录</span>
            <span><HistoricalFactIcon type="gate" />{reviewReady ? '等待提交人工阶段门' : '尚未进入人工阶段门'}</span>
          </div>
        </div>
        <div className={css.historicalCompletionRing} data-stage-ring="" data-complete="false" aria-label="当前处于第 1/8 阶段">
          <strong>1<small>/8</small></strong><span>进行中</span><i>{currentWorkIndex + 1}</i>
        </div>
        <div className={css.historicalGoalArt} data-stage-art="" aria-hidden="true"><img src="/fde-dashboard/stage-evidence-stack-3d.webp" alt="" /></div>
        <div className={css.historicalArchiveNote} data-stage-art-note="">◷ 当前记录持续更新 · 待 FDE 确认</div>
      </section>

      <section className={css.historicalEvidenceChain} data-evidence-chain="" data-active-stage="">
        <header className={css.historicalEvidenceHeader}>
          <div><span>当前工作 · 第 {String(currentWorkIndex + 1)}/{String(workItems.length)} 步</span><h2 data-evidence-title="">{artifactCatalogError !== undefined ? '修复无效的阶段记录' : reviewReady ? '核对已经整理的记录' : currentWorkIndex === 0 ? '从一个最近发生的案例开始' : (FALLBACK_WORK[currentWorkIndex]?.title ?? currentWork.title)}</h2><p>{artifactCatalogError ?? (reviewReady ? '候选记录已经齐备，请回到依据逐项核对后再作出人工决定。' : (FALLBACK_WORK[currentWorkIndex]?.purpose ?? currentWork.purpose))}</p></div>
          <div className={css.historicalEvidenceDirection} aria-hidden="true"><strong>01</strong><i /><strong>03</strong></div>
        </header>
        <div className={css.historicalStageGrid}>
          <section data-evidence-input="">
            <header className={css.historicalColumnHeader}><div><span>阶段输入</span><h2>现在依据了什么</h2></div><b>{files.length} 份材料</b></header>
            {files.length > 0 && <span className={css.evidenceGroupLabel}>客户提供</span>}
            <ul className={css.historicalFactList}>{files.map(source => <li key={source.sourceId} data-evidence-row="" data-source-row="">
              <EvidenceDocumentIcon /><span><strong data-evidence-row-title="">{source.originalName}</strong><small>{sourceStatus(source)} · {formatSourceBytes(source.bytes)}</small></span>
              <button type="button" aria-label={`预览客户资料：${source.originalName}`} onClick={() => { openFile(source.relativePath, source.originalName) }}>预览</button>
            </li>)}</ul>
            {files.length === 0 && <p className={css.unregisteredFact}>尚未登记客户资料，可直接从真实案例开始。</p>}
          </section>
          <section data-evidence-output="">
            <header className={css.historicalColumnHeader}><div><span>阶段输出</span><h2>正在形成什么</h2></div><b>{presentCount}/{requiredArtifacts.length} 份记录</b></header>
            <ul className={css.historicalFactList}>{artifacts.map(artifact => <li key={artifact.id} data-evidence-row="" data-status={artifact.status}>
              <EvidenceDocumentIcon /><i className={css.evidenceStateDot} data-status={artifact.status} aria-hidden="true" />
              <span><strong data-evidence-row-title="">{artifactDisplayTitle(artifact)}</strong><small>{artifactStatus(artifact)} · {artifactGap(artifact)}</small></span>
              {artifact.status === 'present' && <button type="button" aria-label={`预览阶段记录：${artifactDisplayTitle(artifact)}`} onClick={() => { openFile(artifact.path, artifactDisplayTitle(artifact)) }}>预览</button>}
            </li>)}</ul>
          </section>
          <section data-evidence-decision="">
            <header><span>人工结论</span><h2>接下来如何决定</h2></header>
            <div className={css.historicalDecision} data-ready={reviewReady ? 'true' : undefined}><EvidenceShieldIcon ready={reviewReady} /><span><strong>{artifactCatalogError !== undefined ? '阶段记录未通过校验' : reviewReady ? '候选材料已齐备' : '等待 FDE 完成本阶段判断'}</strong><small>{artifactCatalogError !== undefined ? '先修复固定记录合同，再继续阶段判断。' : reviewReady ? '核对记录后可提交人工阶段门。' : '继续补齐事实与阶段记录。'}</small></span></div>
            <dl><dt>当前工作</dt><dd>{FALLBACK_WORK[currentWorkIndex]?.title ?? currentWork.title}</dd><dt>待确认流程</dt><dd>{selectedWorkflow?.title ?? `${String(workflowCatalog.items.length)} 项`}</dd><dt>事实状态</dt><dd>已确认 {workflowEvidence.confirmed} · 待核对 {workflowEvidence.unverified}</dd><dt>遗留阻塞</dt><dd>{(discovery?.blockers ?? []).length} 项</dd></dl>
          </section>
        </div>
        <ol className={css.historicalMilestones} data-stage-milestones="" aria-label="第一阶段工作路径">
          {workItems.map((item, index) => {
            const display = FALLBACK_WORK[index] ?? item
            return <li key={item.id} data-status={item.status}><i>{item.status === 'complete' ? '✓' : index + 1}</i><span>{display.title}</span></li>
          })}
          <li data-status={reviewReady ? 'current' : 'waiting'}><i>5</i><span>FDE 阶段门</span></li>
        </ol>
        <footer className={css.historicalArchiveFooter}>
          <span><HistoricalArchiveIcon />当前阶段记录会随对话与资料持续更新。</span>
          <div className={css.activeStageActions}>
            {discoveryActions()}
          </div>
        </footer>
      </section>
      {workflowCatalog.status === 'invalid' && <p className={css.inlineError} role="alert">业务流程记录读取失败：{workflowCatalog.message ?? '文件结构无效。'}</p>}
      {actionError !== null && <p className={css.inlineError} role="alert">{actionError}</p>}
      {sourceError !== null && <p className={css.inlineError} role="alert">项目资料读取失败：{sourceError}</p>}
      {surfaceError !== null && <p className={css.inlineError} role="alert">阶段记录读取失败：{surfaceError}</p>}
      {fileError !== null && <p className={css.inlineError} role="alert">{fileError}</p>}
    </section>
  )
}

/** Replace the generic blank-session hero only for an actual project. */
export function ProjectStageWorkbenchHero(props: ProjectStageWorkbenchHeroProps) {
  useEffect(() => { props.activateProjectWorkbenchLayout?.() }, [props.activateProjectWorkbenchLayout])
  const enteredProject = props.resolveEnteredProject()
  const sessionId = props.sessionId === undefined ? enteredProject?.sessionId : String(props.sessionId)
  if (sessionId === undefined) return <>{props.defaultContent}</>
  const workspace = props.workspace === undefined
    ? props.resolveProjectWorkspace(sessionId) ?? enteredProject
    : { workspaceId: String(props.workspace.workspaceId), title: props.workspace.title, path: props.workspace.path }
  if (workspace === undefined) return <>{props.defaultContent}</>
  return <StageWorkbenchPanel props={props} sessionId={sessionId} workspace={workspace} view={false} />
}

/** Keep the same stage guidance available after the project Session has history. */
export function ProjectStageWorkbenchView(props: ProjectStageWorkbenchViewProps) {
  const listedWorkspace = props.useWorkspaces(state => state.items.find(item => item.sessionIds.includes(props.sessionId)))
  const workspace = listedWorkspace === undefined
    ? props.resolveProjectWorkspace(String(props.sessionId))
    : { workspaceId: String(listedWorkspace.workspaceId), title: listedWorkspace.title, path: listedWorkspace.path }
  useEffect(() => { props.activateProjectWorkbenchLayout?.() }, [props.activateProjectWorkbenchLayout])
  if (workspace === undefined) return <div className={css.state}>当前会话未关联项目。</div>
  return <StageWorkbenchPanel props={props} sessionId={String(props.sessionId)} workspace={workspace} view />
}
