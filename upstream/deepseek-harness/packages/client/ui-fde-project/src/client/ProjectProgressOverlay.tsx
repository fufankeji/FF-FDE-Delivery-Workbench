/** Full Project Progress page beside the persistent project/session sidebar. */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, RefObject } from 'react'
import type { DevelopmentArtifact, ProjectSurfaceLoadState, ValidationStageSnapshot } from './controller.ts'
import { readProjectMetadata, STAGE_NAMES } from './project-data.ts'
import { FDE_STAGES, type FdeStageId, type ProjectStageLoadState } from './stage-controller.ts'
import type { ProjectSourceItem, ProjectSourceLoadState } from './source-controller.ts'
import type { ProjectProgressOverlayProps, RequirementWikiRunTarget } from './slots.ts'
import type { ProjectPreviewFile } from './slots.ts'
import { RequirementIssuePanel, RequirementWikiPanel } from './RequirementWikiPanel.tsx'
import type { RequirementWikiLoadState } from './wiki-controller.ts'
import css from './project.module.css'

interface ProjectRow {
  readonly workspaceId: string
  readonly title: string
  readonly path: string
  readonly createdAt: string
  readonly sessions: number
  readonly runningSessions: number
  readonly wikiSessionId?: string
  readonly companyName: string
  readonly schedule: ReturnType<typeof readProjectMetadata>['schedule']
  readonly stage: ProjectStageLoadState | undefined
}

interface PortfolioActivity {
  readonly sessionId: string
  readonly workspaceId: string
  readonly projectTitle: string
  readonly sessionTitle: string
  readonly updatedAt: number
  readonly running: boolean
}

function formatDate(value: string): string {
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric' }).format(date)
}

function formatActivityTime(value: number): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value))
}

function formatBytes(value: number): string {
  if (value < 1024) return `${String(value)} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}

function currentStageIndex(stage: ProjectStageLoadState | undefined): number {
  return stage?.status === 'ready' ? FDE_STAGES.findIndex(item => item.id === stage.value.currentStage) : -1
}

function stageLabel(stage: ProjectStageLoadState | undefined, loading: string, failed: string): string {
  if (stage === undefined || stage.status === 'loading') return loading
  if (stage.status === 'error') return failed
  return STAGE_NAMES[stage.value.currentStage]
}

const STAGE_SUMMARIES: Readonly<Record<FdeStageId, string>> = {
  requirements: '梳理客户资料、业务目标、约束与待确认问题，形成可确认的需求基线。',
  solution: '把确认需求转为项目方案、研发计划、验收方式和可审阅的系统架构。',
  development: '按 Feature 推进实现，以任务证据、测试结果和收口产物记录真实研发状态。',
  validation: '围绕同一候选版本核对评估、测试、观测、风险和恢复证据。',
  pilot: '在客户环境进行受控试运行，记录运行问题、修复结果与上线边界。',
  handoff: '完成客户验收、交付材料、运行说明和后续责任移交。',
}

function stagePositionState(stage: ProjectStageLoadState | undefined, index: number): 'unknown' | 'done' | 'current' | 'pending' {
  const current = currentStageIndex(stage)
  if (current < 0) return 'unknown'
  if (index < current) return 'done'
  if (index === current) return 'current'
  return 'pending'
}

function stageStateLabel(state: ReturnType<typeof stagePositionState>): string {
  if (state === 'done') return '已通过'
  if (state === 'current') return '当前阶段'
  if (state === 'pending') return '尚未开始'
  return '状态未知'
}

function featureStatusLabel(status: string): string {
  const labels: Readonly<Record<string, string>> = {
    completed: '已完成',
    'in-progress': '进行中',
    blocked: '已阻塞',
    planned: '待开始',
    ready: '可开始',
  }
  return labels[status] ?? '状态待确认'
}

function ProjectStagePath({ stage }: { readonly stage: ProjectStageLoadState | undefined }) {
  return (
    <ol className={css.projectStagePath} aria-label="项目六阶段位置">
      {FDE_STAGES.map((definition, index) => {
        const state = stagePositionState(stage, index)
        return (
          <li key={definition.id} data-state={state}>
            <span>{index + 1}</span>
            <strong>{STAGE_NAMES[definition.id]}</strong>
          </li>
        )
      })}
    </ol>
  )
}

function StageNavigator({ stage, viewedStage, selectStage }: {
  readonly stage: ProjectStageLoadState | undefined
  readonly viewedStage: FdeStageId
  readonly selectStage: (stage: FdeStageId) => void
}) {
  return (
    <nav className={css.stageNavigator} aria-label="六阶段交付地图">
      {FDE_STAGES.map((definition, index) => {
        const state = stagePositionState(stage, index)
        const active = viewedStage === definition.id
        return (
          <button
            key={definition.id}
            type="button"
            data-stage={definition.id}
            data-state={state}
            data-active={active || undefined}
            aria-current={state === 'current' ? 'step' : undefined}
            aria-label={`查看阶段 ${String(index + 1)}：${STAGE_NAMES[definition.id]}`}
            onClick={() => { selectStage(definition.id) }}
          >
            <span className={css.stageNavigatorNumber}>{index + 1}</span>
            <span className={css.stageNavigatorText}>
              <strong>{STAGE_NAMES[definition.id]}</strong>
              <small>{stageStateLabel(state)}</small>
            </span>
          </button>
        )
      })}
    </nav>
  )
}

function scheduleDayCount(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00Z`).getTime()
  const end = new Date(`${endDate}T00:00:00Z`).getTime()
  return Math.max(1, Math.round((end - start) / 86_400_000) + 1)
}

function ProjectDeliverySummary({ row, sourceState, surfaceState, wikiState }: {
  readonly row: ProjectRow
  readonly sourceState: ProjectSourceLoadState | undefined
  readonly surfaceState: ProjectSurfaceLoadState | undefined
  readonly wikiState: RequirementWikiLoadState | undefined
}) {
  const snapshot = surfaceState?.status === 'ready' ? surfaceState.value : undefined
  const development = snapshot?.development
  const featureArtifacts = development?.features.flatMap(feature => feature.artifacts) ?? []
  const taskTotal = development?.features.reduce((total, feature) => total + feature.taskTotal, 0) ?? 0
  const taskCompleted = development?.features.reduce((total, feature) => total + feature.taskCompleted, 0) ?? 0
  const architectureTotal = snapshot?.solution === undefined ? 0 : 1
  const evidenceGroups = [
    {
      id: 'requirements', label: '需求调研',
      present: snapshot?.requirements.presentCount ?? 0,
      total: snapshot?.requirements.requiredCount ?? 0,
    },
    {
      id: 'solution', label: '方案设计',
      present: (snapshot?.solution?.presentCount ?? 0) + (snapshot?.architecture === null || snapshot?.architecture === undefined ? 0 : 1),
      total: (snapshot?.solution?.requiredCount ?? 0) + architectureTotal,
    },
    {
      id: 'development', label: '项目开发',
      present: (development?.core.presentCount ?? 0)
        + featureArtifacts.filter(artifact => artifact.status === 'present').length
        + (development?.closure.presentCount ?? 0),
      total: (development?.core.requiredCount ?? 0) + featureArtifacts.length + (development?.closure.requiredCount ?? 0),
    },
  ] as const
  const evidencePresent = evidenceGroups.reduce((total, group) => total + group.present, 0)
  const evidenceTotal = evidenceGroups.reduce((total, group) => total + group.total, 0)
  const sources = sourceState?.files ?? []
  const parsedSources = sources.filter(source => source.parse.status === 'ready').length
  const wiki = wikiState?.value?.current
  const unresolved = (wiki?.conflicts.length ?? 0) + (wiki?.unknowns.length ?? 0)
  const scheduled = row.schedule.status === 'estimated'
  const startTime = scheduled ? new Date(`${row.schedule.startDate}T00:00:00`).getTime() : 0
  const endTime = scheduled ? new Date(`${row.schedule.endDate}T23:59:59`).getTime() : 0
  const now = Date.now()
  const todayPosition = !scheduled || now < startTime || now > endTime
    ? undefined
    : Math.max(0, Math.min(1, (now - startTime) / Math.max(1, endTime - startTime)))
  return (
    <section className={css.projectDeliverySummary} aria-label="项目交付数据总览">
      <section className={css.projectCyclePanel} data-pending={!scheduled || undefined}>
        <header>
          <div><span>项目周期</span><h2>交付时间轴</h2></div>
          <strong>{scheduled ? `${String(scheduleDayCount(row.schedule.startDate, row.schedule.endDate))} 天` : '待确认'}</strong>
        </header>
        <div className={css.projectCycleTrack}>
          <span />
          {todayPosition !== undefined && (
            <i style={{ '--today-position': String(todayPosition) } as CSSProperties}><small>今天</small></i>
          )}
        </div>
        <dl>
          <div><dt>计划开始</dt><dd>{scheduled ? formatDate(row.schedule.startDate) : '待确认'}</dd></div>
          <div><dt>当前阶段</dt><dd>{stageLabel(row.stage, '读取中', '读取失败')}</dd></div>
          <div><dt>计划交付</dt><dd>{scheduled ? formatDate(row.schedule.endDate) : '待确认'}</dd></div>
        </dl>
      </section>
      <section className={css.projectEvidencePanel}>
        <header>
          <div><span>交付证据</span><h2>已接入产物构成</h2></div>
          <strong>{evidencePresent}<small> / {evidenceTotal}</small></strong>
        </header>
        <div className={css.projectEvidenceGroups}>
          {evidenceGroups.map(group => (
            <div key={group.id} data-stage={group.id}>
              <span><strong>{group.label}</strong><small>{group.present}/{group.total}</small></span>
              <i><span style={{ width: group.total === 0 ? '0%' : `${String(group.present / group.total * 100)}%` }} /></i>
            </div>
          ))}
        </div>
      </section>
      <section className={css.projectDataPanel}>
        <header><div><span>项目数据</span><h2>资料、知识与研发证据</h2></div></header>
        <dl>
          <div><dt>客户资料</dt><dd>{sources.length}</dd></div>
          <div><dt>已识别</dt><dd>{parsedSources}</dd></div>
          <div><dt>知识页 / 关系</dt><dd>{wiki?.pages.length ?? 0}<small> / {wiki?.relations.length ?? 0}</small></dd></div>
          <div><dt>冲突与待确认</dt><dd>{unresolved}</dd></div>
          <div><dt>Feature</dt><dd>{development?.features.length ?? 0}</dd></div>
          <div><dt>任务证据</dt><dd>{taskCompleted}<small> / {taskTotal}</small></dd></div>
          <div><dt>评估用例</dt><dd>{snapshot?.evaluation.casesCount ?? 0}</dd></div>
          <div><dt>评估报告</dt><dd>{snapshot?.evaluation.reports.length ?? 0}</dd></div>
        </dl>
      </section>
    </section>
  )
}

function StageVisualSummary({ viewedStage, sourceState, surfaceState, wikiState }: {
  readonly viewedStage: FdeStageId
  readonly sourceState: ProjectSourceLoadState | undefined
  readonly surfaceState: ProjectSurfaceLoadState | undefined
  readonly wikiState: RequirementWikiLoadState | undefined
}) {
  const snapshot = surfaceState?.status === 'ready' ? surfaceState.value : undefined
  const sources = sourceState?.files ?? []
  const parsedSources = sources.filter(source => source.parse.status === 'ready').length
  const wiki = wikiState?.value?.current
  const development = snapshot?.development
  const taskTotal = development?.features.reduce((total, feature) => total + feature.taskTotal, 0) ?? 0
  const taskCompleted = development?.features.reduce((total, feature) => total + feature.taskCompleted, 0) ?? 0
  const latestEvaluation = snapshot?.evaluation.reports[0]
  if (viewedStage === 'requirements') {
    return (
      <section className={`${css.stageVisual} ${css.requirementsVisual}`} aria-label="需求调研数据链路">
        <header><span>需求知识链路</span><h3>原始资料如何沉淀为可确认需求</h3></header>
        <div className={css.requirementsFlow}>
          <article><span>01</span><strong>{sources.length}</strong><small>输入资料 · {parsedSources} 份已识别</small></article>
          <i aria-hidden="true">→</i>
          <article>
            <span>02</span><strong>{wiki?.pages.length ?? 0}</strong>
            <small>知识节点 · {wiki?.relations.length ?? 0} 条关系</small>
          </article>
          <i aria-hidden="true">→</i>
          <article>
            <span>03</span><strong>{snapshot?.requirements.presentCount ?? 0}</strong>
            <small>阶段文件 · 共 {snapshot?.requirements.requiredCount ?? 0} 份</small>
          </article>
        </div>
        <dl><div><dt>冲突</dt><dd>{wiki?.conflicts.length ?? 0}</dd></div><div><dt>待确认</dt><dd>{wiki?.unknowns.length ?? 0}</dd></div></dl>
      </section>
    )
  }
  if (viewedStage === 'solution') {
    const architecture = snapshot?.architecture
    return (
      <section className={`${css.stageVisual} ${css.solutionVisual}`} aria-label="方案设计蓝图">
        <header><span>方案蓝图</span><h3>文档基线与架构模型</h3></header>
        <div className={css.solutionBlueprint}>
          <div className={css.solutionDocs}>
            <strong>{snapshot?.solution?.presentCount ?? 0}<small> / {snapshot?.solution?.requiredCount ?? 0}</small></strong>
            <span>方案文件</span>
          </div>
          <div className={css.solutionCore}>
            <small>ARCH</small>
            <strong>{architecture === null || architecture === undefined ? '待建立' : `R${String(architecture.revision)}`}</strong>
            <span>{architecture?.status === 'confirmed' ? '架构已确认' : '架构待确认'}</span>
          </div>
          <div className={css.solutionTopology}>
            <strong>{architecture?.nodes.length ?? 0}<small> / {architecture?.edges.length ?? 0}</small></strong>
            <span>组件 / 连接</span>
          </div>
        </div>
      </section>
    )
  }
  if (viewedStage === 'development') {
    return (
      <section className={`${css.stageVisual} ${css.developmentVisual}`} aria-label="研发证据图谱">
        <header><span>研发执行</span><h3>研发证据图谱</h3></header>
        <div className={css.developmentVisualGrid}>
          <article><strong>{development?.features.length ?? 0}</strong><span>功能模块</span></article>
          <article>
            <strong>{taskCompleted}<small> / {taskTotal}</small></strong><span>任务完成证据</span>
            <i><span style={{ width: taskTotal === 0 ? '0%' : `${String(taskCompleted / taskTotal * 100)}%` }} /></i>
          </article>
          <article>
            <strong>{development?.closure.presentCount ?? 0}<small> / {development?.closure.requiredCount ?? 0}</small></strong>
            <span>研发收口文件</span>
          </article>
          <article data-warn={(development?.issues.length ?? 0) > 0 || undefined}>
            <strong>{development?.issues.length ?? 0}</strong><span>读取问题</span>
          </article>
        </div>
      </section>
    )
  }
  if (viewedStage === 'validation') {
    const total = latestEvaluation?.total ?? 0
    const passed = latestEvaluation?.passed ?? 0
    return (
      <section className={`${css.stageVisual} ${css.validationVisual}`} aria-label="验证证据矩阵">
        <header><span>质量验证</span><h3>验证证据矩阵</h3></header>
        <div className={css.validationMatrix}>
          <div
            className={css.validationRing}
            style={{ '--validation-angle': `${String(total === 0 ? 0 : passed / total * 360)}deg` } as CSSProperties}
          ><span><strong>{passed}</strong><small>/ {total}</small></span></div>
          <dl>
            <div><dt>评估用例</dt><dd>{snapshot?.evaluation.casesCount ?? 0}</dd></div>
            <div><dt>历史报告</dt><dd>{snapshot?.evaluation.reports.length ?? 0}</dd></div>
            <div>
              <dt>失败 / 错误</dt><dd>{(latestEvaluation?.failed ?? 0) + (latestEvaluation?.errors ?? 0)}</dd>
            </div>
            <div><dt>当前基线</dt><dd>{snapshot?.evaluation.baseline === undefined ? '未设置' : snapshot.evaluation.baseline.status}</dd></div>
          </dl>
        </div>
      </section>
    )
  }
  if (viewedStage === 'pilot') {
    return (
      <section className={`${css.stageVisual} ${css.pilotVisual}`} aria-label="部署试运行路径">
        <header><span>受控运行</span><h3>客户环境试运行路径</h3></header>
        <ol>
          <li><span>01</span><strong>候选版本</strong></li><li><span>02</span><strong>环境部署</strong></li>
          <li><span>03</span><strong>运行观察</strong></li><li><span>04</span><strong>问题收口</strong></li>
        </ol>
        <p>进入阶段后再从真实运行记录归集状态，不提前生成部署完成度。</p>
      </section>
    )
  }
  return (
    <section className={`${css.stageVisual} ${css.handoffVisual}`} aria-label="验收移交清单">
      <header><span>正式交付</span><h3>验收与责任移交包</h3></header>
      <div>
        <article><span>ACCEPT</span><strong>客户验收结论</strong></article>
        <article><span>PACKAGE</span><strong>正式交付包</strong></article>
        <article><span>RUNBOOK</span><strong>运行与维护说明</strong></article>
        <article><span>OWNER</span><strong>责任与支持移交</strong></article>
      </div>
      <p>仅在项目产生对应材料后显示真实状态与下载入口。</p>
    </section>
  )
}

function useSidebarOffset(open: boolean): [RefObject<HTMLDivElement>, number] {
  const ref = useRef<HTMLDivElement>(null)
  const [offset, setOffset] = useState(0)
  useLayoutEffect(() => {
    if (!open) return
    const overlay = ref.current?.parentElement
    const frame = overlay?.parentElement
    const sidebar = frame?.firstElementChild
    if (!(sidebar instanceof HTMLElement)) return
    const update = (): void => { setOffset(Math.round(sidebar.getBoundingClientRect().width)) }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(sidebar)
    return () => { observer.disconnect() }
  }, [open])
  return [ref, offset]
}

function useStandalonePage(open: boolean, rootRef: RefObject<HTMLDivElement>): void {
  useLayoutEffect(() => {
    if (!open) return
    document.body.dataset.fdePage = 'project-progress'
    const overlayHost = rootRef.current?.parentElement
    const details = overlayHost?.previousElementSibling
    const center = details?.previousElementSibling
    const hidden = [center, details].filter((item): item is HTMLElement => item instanceof HTMLElement)
    const previous = hidden.map(element => ({
      element,
      visibility: element.style.visibility,
      pointerEvents: element.style.pointerEvents,
      inert: element.inert,
      ariaHidden: element.getAttribute('aria-hidden'),
    }))
    for (const item of previous) {
      item.element.style.visibility = 'hidden'
      item.element.style.pointerEvents = 'none'
      item.element.inert = true
      item.element.setAttribute('aria-hidden', 'true')
    }
    return () => {
      delete document.body.dataset.fdePage
      for (const item of previous) {
        item.element.style.visibility = item.visibility
        item.element.style.pointerEvents = item.pointerEvents
        item.element.inert = item.inert
        if (item.ariaHidden === null) item.element.removeAttribute('aria-hidden')
        else item.element.setAttribute('aria-hidden', item.ariaHidden)
      }
    }
  }, [open, rootRef])
}

function ProjectCard({ row, showProject, labels }: {
  readonly row: ProjectRow
  readonly showProject: (workspaceId: string) => void
  readonly labels: {
    readonly companyMissing: string
    readonly scheduleMissing: string
    readonly view: string
    readonly created: (date: string) => string
    readonly loading: string
    readonly failed: string
  }
}) {
  const index = currentStageIndex(row.stage)
  const currentDefinition = index < 0 ? undefined : FDE_STAGES[index]
  const schedule = row.schedule.status === 'estimated'
    ? `${formatDate(row.schedule.startDate)} — ${formatDate(row.schedule.endDate)}`
    : labels.scheduleMissing
  return (
    <article className={css.projectCard}>
      <div className={css.projectCardLead}>
        <div className={css.projectIdentity}>
          <span className={css.projectMark} aria-hidden="true">{row.title.slice(0, 1).toUpperCase()}</span>
          <div><h2>{row.title}</h2><p>{row.companyName || labels.companyMissing}</p></div>
        </div>
        <div className={css.projectStageHeadline}>
          <span>{index < 0 ? '—' : String(index + 1).padStart(2, '0')}<small>/06</small></span>
          <div>
            <small>当前阶段</small>
            <strong>
              {currentDefinition === undefined
                ? stageLabel(row.stage, labels.loading, labels.failed)
                : STAGE_NAMES[currentDefinition.id]}
            </strong>
          </div>
        </div>
      </div>
      <div className={css.projectCardJourney}>
        <div>
          <span>六阶段交付路径</span>
          <span className={css.stageBadge} data-error={row.stage?.status === 'error' || undefined}>
            {index < 0
              ? stageLabel(row.stage, labels.loading, labels.failed)
              : `阶段 ${String(index + 1)}/6 · ${STAGE_NAMES[currentDefinition?.id ?? 'requirements']}`}
          </span>
        </div>
        <ProjectStagePath stage={row.stage} />
      </div>
      <dl className={css.projectFacts}>
        <div><dt>交付周期</dt><dd>{schedule}</dd></div>
        <div><dt>项目会话</dt><dd>{row.sessions} 个</dd></div>
        <div><dt>运行中</dt><dd>{row.runningSessions} 个会话</dd></div>
      </dl>
      <div className={css.projectCardFoot}>
        <span>{labels.created(formatDate(row.createdAt))}</span>
        <button type="button" onClick={() => { showProject(row.workspaceId) }}>{labels.view}<span aria-hidden="true">→</span></button>
      </div>
    </article>
  )
}

function PortfolioOverview({ rows, activeSessions, pendingSchedules, sessionCount }: {
  readonly rows: readonly ProjectRow[]
  readonly activeSessions: number
  readonly pendingSchedules: number
  readonly sessionCount: number
}) {
  const counts = FDE_STAGES.map(definition => (
    rows.filter(row => row.stage?.status === 'ready' && row.stage.value.currentStage === definition.id).length
  ))
  const confirmedSchedules = rows.filter(row => row.schedule.status === 'estimated').length
  const passedGates = rows.reduce((total, row) => {
    const index = currentStageIndex(row.stage)
    return total + Math.max(0, index)
  }, 0)
  const coveredStages = counts.filter(count => count > 0).length
  const scheduleAngle = rows.length === 0 ? 0 : confirmedSchedules / rows.length * 360
  const sessionAngle = sessionCount === 0 ? 0 : activeSessions / sessionCount * 360
  return (
    <section className={css.portfolioOverview} aria-label="项目汇总">
      <div className={css.portfolioHeadline}>
        <span>项目组合</span>
        <h2>交付组合概览</h2>
        <p>从真实项目阶段、交付周期与会话状态汇总。</p>
        <div className={css.portfolioProjectCount}><strong>{rows.length}</strong><span>个项目正在纳入统一进度管理</span></div>
        <dl>
          <div><dt>项目会话</dt><dd>{sessionCount}</dd></div>
          <div><dt>已通过阶段门</dt><dd>{passedGates}</dd></div>
          <div><dt>覆盖阶段</dt><dd>{coveredStages}/6</dd></div>
        </dl>
      </div>
      <div className={css.portfolioRadials}>
        <article>
          <div
            className={css.portfolioRing}
            style={{ '--metric-angle': `${String(scheduleAngle)}deg` } as CSSProperties}
            aria-label={`已确认交付周期 ${String(confirmedSchedules)}/${String(rows.length)}`}
          ><span><strong>{confirmedSchedules}</strong><small>/ {rows.length}</small></span></div>
          <div><strong>交付周期已确认</strong><p>{pendingSchedules} 个项目仍需确认周期</p></div>
        </article>
        <article>
          <div
            className={css.portfolioRing}
            style={{ '--metric-angle': `${String(sessionAngle)}deg` } as CSSProperties}
            aria-label={`运行中会话 ${String(activeSessions)}/${String(sessionCount)}`}
          ><span><strong>{activeSessions}</strong><small>/ {sessionCount}</small></span></div>
          <div><strong>当前运行会话</strong><p>全部项目共 {sessionCount} 个会话</p></div>
        </article>
      </div>
    </section>
  )
}

function PortfolioFocus({ rows, activities, showProject }: {
  readonly rows: readonly ProjectRow[]
  readonly activities: readonly PortfolioActivity[]
  readonly showProject: (workspaceId: string) => void
}) {
  const attentionRows = rows.filter(row => (
    row.schedule.status === 'pending-confirmation' || row.stage?.status === 'error'
  ))
  const scheduledRows = rows
    .filter((row): row is ProjectRow & { schedule: { status: 'estimated'; startDate: string; endDate: string } } => row.schedule.status === 'estimated')
    .toSorted((left, right) => left.schedule.endDate.localeCompare(right.schedule.endDate))
  return (
    <section className={css.portfolioFocus} aria-label="工作台焦点">
      <section className={css.attentionFocus}>
        <header>
          <div><span>工作台焦点</span><h2>需要关注</h2></div>
          <strong>{attentionRows.length}</strong>
        </header>
        {attentionRows.length === 0
          ? <div className={css.focusEmpty}>当前没有待确认周期或阶段读取异常。</div>
          : <div className={css.attentionList}>{attentionRows.slice(0, 4).map((row) => {
            const issues = [
              ...(row.schedule.status === 'pending-confirmation' ? ['交付周期待确认'] : []),
              ...(row.stage?.status === 'error' ? ['项目阶段读取失败'] : []),
            ]
            return (
              <button key={row.workspaceId} type="button" onClick={() => { showProject(row.workspaceId) }}>
                <span className={css.attentionMark} aria-hidden="true">!</span>
                <span><strong>{row.title}</strong><small>{issues.join(' · ')}</small></span>
                <span aria-hidden="true">→</span>
              </button>
            )
          })}</div>}
      </section>
      <section className={css.scheduleFocus}>
        <header><div><span>交付节奏</span><h2>交付节点</h2></div><small>{scheduledRows.length} 个已确认</small></header>
        {scheduledRows.length === 0
          ? <div className={css.focusEmpty}>暂无已确认交付周期，可进入项目补充。</div>
          : <div className={css.scheduleFocusList}>{scheduledRows.slice(0, 4).map(row => (
            <button key={row.workspaceId} type="button" onClick={() => { showProject(row.workspaceId) }}>
              <span className={css.scheduleDate}><strong>{formatDate(row.schedule.endDate)}</strong><small>计划交付</small></span>
              <span><strong>{row.title}</strong><small>{formatDate(row.schedule.startDate)} — {formatDate(row.schedule.endDate)} · {stageLabel(row.stage, '阶段读取中', '阶段读取失败')}</small></span>
              <span aria-hidden="true">→</span>
            </button>
          ))}</div>}
      </section>
      <section className={css.activityFocus}>
        <header><div><span>项目动态</span><h2>最近会话</h2></div><small>{activities.length} 条</small></header>
        {activities.length === 0
          ? <div className={css.focusEmpty}>暂无可展示的项目会话。</div>
          : <div className={css.activityFocusList}>{activities.map(activity => (
            <button key={activity.sessionId} type="button" onClick={() => { showProject(activity.workspaceId) }}>
              <span className={css.activityState} data-running={activity.running || undefined} aria-hidden="true" />
              <span>
                <strong>{activity.sessionTitle}</strong>
                <small>{activity.projectTitle} · {formatActivityTime(activity.updatedAt)}</small>
              </span>
              <span className={css.activityLabel}>{activity.running ? '运行中' : '最近更新'}</span>
            </button>
          ))}</div>}
      </section>
    </section>
  )
}

function PortfolioStageFilter({ rows, selectedStage, selectStage }: {
  readonly rows: readonly ProjectRow[]
  readonly selectedStage: 'all' | FdeStageId
  readonly selectStage: (stage: 'all' | FdeStageId) => void
}) {
  const counts = FDE_STAGES.map(definition => (
    rows.filter(row => row.stage?.status === 'ready' && row.stage.value.currentStage === definition.id).length
  ))
  return (
    <section className={css.portfolioStageFilter} aria-label="项目阶段筛选">
      <header>
        <div><span>阶段筛选</span><h2>六阶段项目分布</h2><p>点击有项目的阶段，直接筛选下方项目。</p></div>
        <button type="button" data-active={selectedStage === 'all' || undefined} onClick={() => { selectStage('all') }}>
          全部项目 <strong>{rows.length}</strong>
        </button>
      </header>
      <nav className={css.stageFilterRail} aria-label="按项目阶段筛选">
        <span className={css.stageFilterTrack} aria-hidden="true" />
        {FDE_STAGES.map((definition, index) => {
          const count = counts[index] ?? 0
          return (
            <button
              key={definition.id}
              type="button"
              className={css.stageFilterStop}
              data-stage={definition.id}
              data-active={selectedStage === definition.id || undefined}
              disabled={count === 0}
              aria-label={`筛选阶段 ${String(index + 1)}：${STAGE_NAMES[definition.id]}，${String(count)} 个项目`}
              onClick={() => { selectStage(definition.id) }}
            >
              <span className={css.stageFilterNode}><strong>{count}</strong></span>
              <span className={css.stageFilterLabel}>
                <small>{String(index + 1).padStart(2, '0')}</small>
                <strong>{STAGE_NAMES[definition.id]}</strong>
              </span>
            </button>
          )
        })}
      </nav>
    </section>
  )
}

function Timeline({ rows, showProject, todayLabel }: {
  readonly rows: readonly ProjectRow[]
  readonly showProject: (workspaceId: string) => void
  readonly todayLabel: string
}) {
  const scheduled = rows.filter((row): row is ProjectRow & { schedule: { status: 'estimated'; startDate: string; endDate: string } } => row.schedule.status === 'estimated')
  if (scheduled.length === 0) return <div className={css.timelineEmpty}>还没有已确认交付周期的项目。</div>
  const dates = scheduled.flatMap(row => [new Date(`${row.schedule.startDate}T00:00:00`).getTime(), new Date(`${row.schedule.endDate}T00:00:00`).getTime()])
  const day = 86_400_000
  const start = Math.min(...dates) - day * 2
  const end = Math.max(Math.max(...dates) + day * 2, start + day)
  const position = (value: number): number => Math.max(0, Math.min(100, (value - start) / (end - start) * 100))
  const now = Date.now()
  return (
    <div className={css.timelinePanel}>
      <div className={css.timelineScale}>
        <span>{formatDate(new Date(start).toISOString())}</span>
        <span>{formatDate(new Date(end).toISOString())}</span>
      </div>
      <div className={css.timelineRows}>
        {now >= start && now <= end && (
          <div className={css.todayLine} style={{ '--timeline-today': String(position(now) / 100) } as CSSProperties}><span>{todayLabel}</span></div>
        )}
        {scheduled.map((row) => {
          const rowStart = new Date(`${row.schedule.startDate}T00:00:00`).getTime()
          const rowEnd = new Date(`${row.schedule.endDate}T00:00:00`).getTime()
          return (
            <button key={row.workspaceId} type="button" className={css.timelineRow} onClick={() => { showProject(row.workspaceId) }}>
              <span className={css.timelineName}>{row.title}<small>{row.companyName || '未填写所属企业'}</small></span>
              <span className={css.timelineTrack}>
                <span className={css.timelineBar} style={{ left: `${String(position(rowStart))}%`, width: `${String(Math.max(2, position(rowEnd) - position(rowStart)))}%` }}>
                  <span>{stageLabel(row.stage, '读取中', '读取失败')}</span>
                </span>
              </span>
              <span className={css.timelineDates}>{formatDate(row.schedule.startDate)} — {formatDate(row.schedule.endDate)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function parseLabel(source: ProjectSourceItem): string {
  const labels = {
    pending: '待识别', processing: '识别中', ready: '已识别', 'needs-ocr': '需要 OCR',
    unsupported: '暂不支持识别', error: '识别失败', stale: '需要重新识别',
  } as const
  return labels[source.parse.status]
}

function sourceStateLabel(source: ProjectSourceItem): string {
  const preview = source.previewKind === 'unsupported' ? '不支持预览' : '可预览'
  return `${preview} · ${parseLabel(source)}`
}

interface PreviewArtifact {
  readonly title: string
  readonly path: string
  readonly fileUrl: string
  readonly bytes?: number
}

function ArtifactPreview({ artifact, close, renderPreview }: {
  readonly artifact: PreviewArtifact
  readonly close: () => void
  readonly renderPreview: (source: ProjectPreviewFile) => React.ReactNode
}) {
  return (
    <div className={css.artifactPreviewLayer} role="dialog" aria-label={`预览${artifact.title}`}>
      <button type="button" className={css.artifactPreviewScrim} aria-label="关闭产物预览" onClick={close} />
      <section className={css.outputPreviewPanel}>
        <header className={css.previewHeader}>
          <div><span className={css.previewEyebrow}>阶段产物 · 只读预览</span><h2>{artifact.title}</h2><span>{artifact.path}{artifact.bytes === undefined ? '' : ` · ${formatBytes(artifact.bytes)}`}</span></div>
          <div className={css.previewActions}>
            <a href={artifact.fileUrl} download={artifact.path.split('/').at(-1)}>下载原件</a>
            <button type="button" onClick={close}>关闭</button>
          </div>
        </header>
        <div className={css.previewBody}>{renderPreview({
          fileUrl: artifact.fileUrl,
          name: artifact.path.split('/').at(-1) ?? artifact.title,
          ...(artifact.bytes === undefined ? {} : { bytes: artifact.bytes }),
          previewKind: 'text',
        })}</div>
      </section>
    </div>
  )
}

function DevelopmentOutputs({ workspaceId, currentStage, revision, development, completeDevelopment, renderPreview }: {
  readonly workspaceId: string
  readonly currentStage: FdeStageId | undefined
  readonly revision: number | undefined
  readonly development: NonNullable<Extract<ProjectSurfaceLoadState, { readonly status: 'ready' }>['value']['development']>
  readonly completeDevelopment: (revision: number) => Promise<void>
  readonly renderPreview: (source: ProjectPreviewFile) => React.ReactNode
}) {
  const [confirming, setConfirming] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | undefined>()
  useEffect(() => {
    setConfirming(false); setSubmitting(false); setError(undefined); setSelectedArtifactId(undefined)
  }, [currentStage, workspaceId])
  const artifacts = [
    ...development.core.artifacts,
    ...development.features.flatMap(feature => feature.artifacts),
    ...development.closure.artifacts,
  ]
  const selectedArtifact = artifacts.find((artifact): artifact is DevelopmentArtifact & { readonly fileUrl: string } => (
    artifact.id === selectedArtifactId && artifact.status === 'present' && artifact.fileUrl !== undefined
  ))
  const taskTotal = development.features.reduce((total, feature) => total + feature.taskTotal, 0)
  const taskCompleted = development.features.reduce((total, feature) => total + feature.taskCompleted, 0)
  const taskEvidencePercent = taskTotal === 0 ? 0 : taskCompleted / taskTotal * 100
  const ready = development.closure.presentCount === development.closure.requiredCount
  const artifactButton = (artifact: DevelopmentArtifact): React.ReactNode => {
    const previewable = artifact.status === 'present' && artifact.fileUrl !== undefined
    return (
      <button
        key={artifact.id}
        type="button"
        className={css.outputItem}
        data-status={artifact.status}
        data-active={selectedArtifact?.id === artifact.id || undefined}
        disabled={!previewable}
        onClick={() => { if (previewable) setSelectedArtifactId(artifact.id) }}
        aria-label={previewable ? `预览${artifact.title}` : undefined}
      >
        <span className={css.outputIcon} aria-hidden="true">MD</span>
        <div><h3>{artifact.title}</h3><code>{artifact.path}</code>{artifact.message !== undefined && <p>{artifact.message}</p>}</div>
        <span className={css.outputBadge}>{artifact.status === 'present' ? '已有文件' : artifact.status === 'error' ? '读取失败' : '待生成'}</span>
      </button>
    )
  }
  return (
    <section className={css.outputRoot}>
      <header className={css.outputHeader}>
        <div>
          <span className={css.sectionEyebrow}>项目开发 · 研发全景</span>
          <h2>Feature 研发进度</h2>
          <p>先看模块、任务证据与真实节奏，再按需下钻文档。页面不维护第二套任务状态，也不推算未提供的日期。</p>
        </div>
        <strong>{development.features.length} 个 Feature</strong>
      </header>
      <section className={css.developmentPulse} aria-label="研发证据摘要">
        <div
          className={css.developmentEvidenceRing}
          style={{ '--evidence-angle': `${String(taskEvidencePercent * 3.6)}deg` } as CSSProperties}
          aria-label={`研发任务证据总计 ${String(taskCompleted)}/${String(taskTotal)}`}
        >
          <div><strong>{taskCompleted}</strong><small>/ {taskTotal}</small></div>
        </div>
        <div className={css.developmentPulseCopy}>
          <span>任务证据</span>
          <h3>研发证据覆盖</h3>
          <p>只统计 tasks.md 中已有真实证据的勾选，不把页面展示换算成新的项目状态。</p>
          <div><span style={{ width: `${String(taskEvidencePercent)}%` }} /></div>
        </div>
        <dl>
          <div>
            <dt>研发核心文档</dt><dd>{development.core.presentCount}/{development.core.requiredCount}</dd>
            <span className={css.evidenceMiniTrack}><span style={{ width: development.core.requiredCount === 0 ? '0%' : `${String(development.core.presentCount / development.core.requiredCount * 100)}%` }} /></span>
          </div>
          <div>
            <dt>项目开发收口</dt><dd>{development.closure.presentCount}/{development.closure.requiredCount}</dd>
            <span className={css.evidenceMiniTrack}><span style={{ width: development.closure.requiredCount === 0 ? '0%' : `${String(development.closure.presentCount / development.closure.requiredCount * 100)}%` }} /></span>
          </div>
        </dl>
      </section>
      {development.issues.length > 0 && (
        <div className={css.developmentIssues}>
          {development.issues.map(issue => <p key={issue}>{issue}</p>)}
        </div>
      )}
      <section className={css.developmentSection}>
        <header><div><h3>研发核心文档</h3><p>PRD、产品总规格和 Feature Map 决定后续功能拆分。</p></div></header>
        <div className={`${css.outputList} ${css.evidenceList} ${css.coreEvidenceList}`}>{development.core.artifacts.map(artifactButton)}</div>
      </section>
      <section className={css.developmentSection}>
        <header><div><h3>Feature 与任务证据</h3><p>任务完成数只读取 tasks.md 中带真实证据的勾选。</p></div></header>
        {development.features.length === 0
          ? <div className={css.outputState}>尚未发现 `docs/specs/FNNN-slug/` Feature 文档。</div>
          : <div className={css.featureProgressChart}>
            <div className={css.featureChartLegend} aria-hidden="true"><span>Feature</span><span>任务证据</span><span>计划信息</span></div>
            <div className={css.featureProgressList}>{development.features.map((feature) => {
              const percent = feature.taskTotal === 0 ? 0 : feature.taskCompleted / feature.taskTotal * 100
              return (
                <article key={feature.directory} className={css.featureProgressCard}>
                  <header>
                    <div><span>{feature.id}</span><h4>{feature.title}</h4></div>
                    <strong data-status={feature.status}>{featureStatusLabel(feature.status)}</strong>
                  </header>
                  <div className={css.featureEvidenceChart}>
                    {feature.taskTotal > 0
                      ? <div className={css.featureTaskTrack} aria-label={`任务证据 ${String(feature.taskCompleted)}/${String(feature.taskTotal)}`}><span style={{ width: `${String(percent)}%` }} /></div>
                      : <div className={css.featureTaskTrack} data-empty aria-label="暂无任务证据" />}
                    <div className={css.featureEvidenceCount}>
                      <strong>{feature.taskCompleted}<small> / {feature.taskTotal}</small></strong>
                      <span>任务证据</span>
                    </div>
                  </div>
                  <div className={css.featureProgressMeta}>
                    <span>周期 {feature.plannedStart ?? '待确认'} — {feature.plannedEnd ?? '待确认'}</span>
                    <span>里程碑 {feature.milestone ?? '待确认'}</span>
                  </div>
                  {feature.taskTotal === 0 && <p className={css.featureNoEvidence}>暂无任务证据</p>}
                  {feature.blocker !== undefined && <p className={css.featureBlocker}>阻塞：{feature.blocker}</p>}
                  <details className={css.featureEvidence}>
                    <summary>查看研发文档 <span>{feature.artifacts.filter(artifact => artifact.status === 'present').length}/{feature.artifacts.length}</span></summary>
                    <div className={css.featureArtifactList}>{feature.artifacts.map(artifactButton)}</div>
                  </details>
                </article>
              )
            })}</div>
          </div>}
      </section>
      <section className={css.developmentSection}>
        <header>
          <div><h3>项目开发收口产物</h3><p>三份文件齐备只表示可以提交；进入验证评估仍由 FDE 决定。</p></div>
          <strong>{development.closure.presentCount}/{development.closure.requiredCount}</strong>
        </header>
        <div className={`${css.outputList} ${css.evidenceList} ${css.closureEvidenceList}`}>{development.closure.artifacts.map(artifactButton)}</div>
      </section>
      {selectedArtifact === undefined
        ? <div className={css.outputPreviewHint}>选择一份“已有文件”查看只读内容。</div>
        : <ArtifactPreview artifact={selectedArtifact} close={() => { setSelectedArtifactId(undefined) }} renderPreview={renderPreview} />}
      {currentStage === 'development'
        ? <div className={css.stageGate}>
          {!confirming
            ? <>
              <div><strong>由 FDE 决定是否进入验证评估</strong><p>{ready ? '三份研发收口产物已经齐备，请核对版本、测试/评估证据、运行恢复和剩余风险。' : '研发收口产物尚未齐备，请回到项目交付继续开发和更新文件。'}</p></div>
              <button type="button" disabled={!ready || revision === undefined} onClick={() => { setConfirming(true); setError(undefined) }}>完成项目开发</button>
            </>
            : <>
              <div><strong>确认进入验证评估</strong><p>我已核对实施报告、运行手册、研发基线，以及当前候选版本的测试、评估、已知风险和未完成项。</p></div>
              <div className={css.stageGateActions}>
                <button type="button" disabled={submitting} onClick={() => { setConfirming(false); setError(undefined) }}>返回核对</button>
                <button type="button" disabled={submitting || revision === undefined} onClick={() => {
                  if (revision === undefined) return
                  setSubmitting(true); setError(undefined)
                  void completeDevelopment(revision).then(
                    () => { setConfirming(false) },
                    (reason: unknown) => { setError(reason instanceof Error ? reason.message : String(reason)) },
                  ).finally(() => { setSubmitting(false) })
                }}>{submitting ? '正在确认…' : '确认并进入验证评估'}</button>
              </div>
            </>}
          {error !== undefined && <p className={css.stageGateError}>{error}</p>}
        </div>
        : currentStage === undefined
          ? <div className={css.outputState}>项目当前阶段正在读取，研发证据保持只读。</div>
          : <div className={css.stageConfirmed}>项目开发已由 FDE 确认，项目当前处于“{STAGE_NAMES[currentStage]}”。</div>}
    </section>
  )
}

function StageAvailability({ viewedStage, currentStage }: {
  readonly viewedStage: FdeStageId
  readonly currentStage: FdeStageId | undefined
}) {
  const viewedIndex = FDE_STAGES.findIndex(item => item.id === viewedStage)
  const currentIndex = currentStage === undefined ? -1 : FDE_STAGES.findIndex(item => item.id === currentStage)
  const future = currentIndex >= 0 && viewedIndex > currentIndex
  return (
    <section className={css.stageAvailability} data-stage={viewedStage}>
      <span>{future ? '后续阶段' : currentStage === viewedStage ? '当前阶段' : '阶段记录'}</span>
      <h2>{STAGE_NAMES[viewedStage]}</h2>
      <p>{STAGE_SUMMARIES[viewedStage]}</p>
      <div><strong>{future ? '尚未开始' : '暂无可核对的阶段专属产物'}</strong><p>{future ? '进入该阶段后，页面只会展示项目真实产生的状态与证据。' : '当前读模型还没有该阶段的专属产物；请进入项目交付继续工作或查看已经开放的业务页面。'}</p></div>
    </section>
  )
}

const VALIDATION_CATEGORY_LABELS = {
  business: '业务', functional: '功能', data: '数据', model: '模型', performance: '性能',
  security: '安全', recovery: '恢复', agent: 'Agent',
} as const

function validationStatusLabel(status: ValidationStageSnapshot['contract']['metrics'][number]['status']): string {
  if (status === 'PASS') return '通过'
  if (status === 'WARN') return '有条件通过'
  if (status === 'FAIL') return '未通过'
  return '待执行'
}

function ValidationOutputs({ workspaceId, currentStage, revision, validation, completeValidation, renderPreview }: {
  readonly workspaceId: string
  readonly currentStage: FdeStageId
  readonly revision: number | undefined
  readonly validation: ValidationStageSnapshot
  readonly completeValidation: (revision: number) => Promise<void>
  readonly renderPreview: (source: ProjectPreviewFile) => React.ReactNode
}) {
  const [confirming, setConfirming] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | undefined>()
  useEffect(() => {
    setConfirming(false); setSubmitting(false); setError(undefined); setSelectedArtifactId(undefined)
  }, [currentStage, workspaceId])
  const selectedArtifact = validation.artifacts.items.find((artifact): artifact is typeof artifact & { readonly fileUrl: string } => (
    artifact.id === selectedArtifactId && artifact.status === 'present' && artifact.fileUrl !== undefined
  ))
  return (
    <section className={css.outputRoot}>
      <header className={css.outputHeader}>
        <div><h2>评估方案、执行与产物</h2><p>从已确认文档建立评估方案，由 FDE 确认后再执行；结果只读取真实指标与项目内证据。</p></div>
        <strong>{validation.satisfiedMetricCount}/{validation.requiredMetricCount} 个必需指标</strong>
      </header>
      <div className={css.developmentSummary}>
        <div><span>候选版本</span><strong>{validation.contract.candidateId ?? '待登记'}</strong></div>
        <div><span>验证环境</span><strong>{validation.contract.environment ?? '待登记'}</strong></div>
        <div><span>数据/用例</span><strong>{validation.contract.datasets.length}</strong></div>
        <div><span>方案确认</span><strong>{validation.planApproval.status === 'confirmed' ? '已确认' : validation.planApproval.status === 'stale' ? '需重新确认' : validation.planReady ? '待 FDE 确认' : '方案未就绪'}</strong></div>
        <div><span>阶段产物</span><strong>{validation.artifacts.presentCount}/{validation.artifacts.requiredCount}</strong></div>
      </div>
      {validation.contract.status !== 'ready' && (
        <div className={css.developmentIssues}><p>{validation.contract.message ?? '验证合同尚未就绪。'}</p></div>
      )}
      <section className={css.developmentSection}>
        <header><div><h3>本轮输入</h3><p><code>{validation.contract.path}</code> 关联当前候选版本、环境以及项目适用的数据或用例。</p></div></header>
        {validation.contract.datasets.length === 0
          ? <div className={css.outputState}>当前项目没有登记独立数据集；是否需要数据集由验收方案决定。</div>
          : <div className={css.outputList}>{validation.contract.datasets.map(dataset => (
            <div key={dataset.id} className={css.outputItem} data-static>
              <span className={css.outputIcon} aria-hidden="true">DATA</span>
              <div><h3>{dataset.name}</h3><code>{dataset.id}</code><p className={css.outputMeta}>{[dataset.version, dataset.hash, dataset.source].filter(Boolean).join(' · ')}</p></div>
              <span className={css.outputBadge}>{dataset.version ?? '版本待确认'}</span>
            </div>
          ))}</div>}
      </section>
      <section className={css.developmentSection}>
        <header><div><h3>指标与证据</h3><p>必需指标只有在结果、阈值和项目内证据完整时才计入通过。</p></div></header>
        {validation.contract.metrics.length === 0
          ? <div className={css.outputState}>尚未定义本项目的验证指标。</div>
          : <div className={css.tableScroll}><table className={css.dataTable}>
            <thead><tr><th>指标</th><th>类别</th><th>指标来源</th><th>阈值</th><th>结果</th><th>证据</th></tr></thead>
            <tbody>{validation.contract.metrics.map(metric => (
              <tr key={metric.id}>
                <td><strong>{metric.name}</strong><small>{metric.required ? '必需' : '可选'} · {metric.method}</small></td>
                <td>{VALIDATION_CATEGORY_LABELS[metric.category]}</td>
                <td>{metric.sources.map(source => (
                  <small key={`${source.path}-${source.references.join('-')}`}>
                    <code>{source.path}</code><br />{source.references.join('、')}{source.available ? '' : ' · 文件不可读取'}
                  </small>
                ))}</td>
                <td>{metric.threshold}</td>
                <td>
                  <span className={css.reportStatus} data-status={metric.status}>{validationStatusLabel(metric.status)}</span>
                  {metric.value === undefined ? null : <small>{metric.value}</small>}
                </td>
                <td>{metric.evidenceAvailable
                  ? <code>{metric.evidence}</code>
                  : metric.evidence === undefined ? '未登记' : `不可读取：${metric.evidence}`}</td>
              </tr>
            ))}</tbody>
          </table></div>}
      </section>
      {validation.contract.issues.length > 0 && (
        <section className={css.developmentSection}>
          <header><div><h3>问题与接受决定</h3><p>未关闭的 critical/high 问题会阻止进入部署试运行。</p></div></header>
          <div className={css.outputList}>{validation.contract.issues.map(issue => (
            <div key={issue.id} className={css.outputItem} data-static data-status={issue.status === 'open' ? 'error' : 'present'}>
              <span className={css.outputIcon} aria-hidden="true">ISSUE</span>
              <div><h3>{issue.title}</h3><code>{issue.id}</code><p className={css.outputMeta}>{issue.resolution ?? issue.evidence ?? '尚未记录处理说明或证据。'}</p></div>
              <span className={css.outputBadge}>{issue.severity} · {issue.status}</span>
            </div>
          ))}</div>
        </section>
      )}
      <section className={css.developmentSection}>
        <header>
          <div><h3>验证评估阶段产物</h3><p>验证计划、验证报告和验证基线齐备只表示可以提交；进入部署试运行仍由 FDE 决定。</p></div>
          <strong>{validation.artifacts.presentCount}/{validation.artifacts.requiredCount}</strong>
        </header>
        <div className={css.outputList}>{validation.artifacts.items.map((artifact) => {
          const previewable = artifact.status === 'present' && artifact.fileUrl !== undefined
          return <button
            key={artifact.id}
            type="button"
            className={css.outputItem}
            data-status={artifact.status}
            data-active={selectedArtifact?.id === artifact.id || undefined}
            disabled={!previewable}
            onClick={() => { if (previewable) setSelectedArtifactId(artifact.id) }}
            aria-label={previewable ? `预览${artifact.title}` : undefined}
          >
            <span className={css.outputIcon} aria-hidden="true">MD</span>
            <div><h3>{artifact.title}</h3><code>{artifact.path}</code>{artifact.message !== undefined && <p>{artifact.message}</p>}</div>
            <span className={css.outputBadge}>{artifact.status === 'present' ? '已有文件' : artifact.status === 'error' ? '读取失败' : '待生成'}</span>
          </button>
        })}</div>
      </section>
      {selectedArtifact === undefined
        ? <div className={css.outputPreviewHint}>选择一份“已有文件”查看只读内容。</div>
        : <section className={css.outputPreviewPanel}>
          <header className={css.previewHeader}>
            <div><h2>{selectedArtifact.title}</h2><span>{selectedArtifact.path}{selectedArtifact.bytes === undefined ? '' : ` · ${formatBytes(selectedArtifact.bytes)}`}</span></div>
            <div className={css.previewActions}><a href={selectedArtifact.fileUrl} download={selectedArtifact.path.split('/').at(-1)}>下载原件</a></div>
          </header>
          <div className={css.previewBody}>{renderPreview({
            fileUrl: selectedArtifact.fileUrl,
            name: selectedArtifact.path.split('/').at(-1) ?? selectedArtifact.title,
            ...(selectedArtifact.bytes === undefined ? {} : { bytes: selectedArtifact.bytes }),
            previewKind: 'text',
          })}</div>
        </section>}
      {validation.blockers.length > 0 && (
        <div className={css.developmentIssues}>{validation.blockers.map(blocker => <p key={blocker}>{blocker}</p>)}</div>
      )}
      {currentStage === 'validation'
        ? <div className={css.stageGate}>
          {!confirming
            ? <>
              <div><strong>由 FDE 决定是否进入部署试运行</strong><p>{validation.gateReady ? '验证合同、必需指标证据和三份固定产物已经齐备，请核对候选版本、接受风险和剩余问题。' : '当前仍有验证阻塞项，请继续执行验证并更新合同和阶段产物。'}</p></div>
              <button type="button" disabled={!validation.gateReady || revision === undefined} onClick={() => { setConfirming(true); setError(undefined) }}>完成验证评估</button>
            </>
            : <>
              <div><strong>确认进入部署试运行</strong><p>我已核对候选版本、环境和数据版本、全部必需指标与证据、关键问题、接受风险、验证报告及验证基线。</p></div>
              <div className={css.stageGateActions}>
                <button type="button" disabled={submitting} onClick={() => { setConfirming(false); setError(undefined) }}>返回核对</button>
                <button type="button" disabled={submitting || revision === undefined} onClick={() => {
                  if (revision === undefined) return
                  setSubmitting(true); setError(undefined)
                  void completeValidation(revision).then(
                    () => { setConfirming(false) },
                    (reason: unknown) => { setError(reason instanceof Error ? reason.message : String(reason)) },
                  ).finally(() => { setSubmitting(false) })
                }}>{submitting ? '正在确认…' : '确认并进入部署试运行'}</button>
              </div>
            </>}
          {error !== undefined && <p className={css.stageGateError}>{error}</p>}
        </div>
        : <div className={css.stageConfirmed}>验证评估已由 FDE 确认，项目当前处于“{STAGE_NAMES[currentStage]}”。</div>}
    </section>
  )
}

function StageOutputs({
  workspaceId, stage, viewedStage, surfaceState, completeRequirements, completeSolution,
  completeDevelopment, completeValidation, reviewArchitecture, renderPreview,
}: {
  readonly workspaceId: string
  readonly stage: ProjectStageLoadState | undefined
  readonly viewedStage: FdeStageId
  readonly surfaceState: ProjectSurfaceLoadState | undefined
  readonly completeRequirements: (revision: number) => Promise<void>
  readonly completeSolution: (revision: number) => Promise<void>
  readonly completeDevelopment: (revision: number) => Promise<void>
  readonly completeValidation: (revision: number) => Promise<void>
  readonly reviewArchitecture: () => Promise<void>
  readonly renderPreview: (source: ProjectPreviewFile) => React.ReactNode
}) {
  const [confirming, setConfirming] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | undefined>()
  const currentStage = stage?.status === 'ready' ? stage.value.currentStage : undefined
  useEffect(() => {
    setConfirming(false); setSubmitting(false); setError(undefined); setSelectedArtifactId(undefined)
  }, [currentStage, viewedStage, workspaceId])

  if (surfaceState === undefined || surfaceState.status === 'loading') {
    return <div className={css.outputState}>正在读取阶段产出…</div>
  }
  if (surfaceState.status === 'error') {
    return <div className={css.outputState} data-error>{surfaceState.message}</div>
  }
  if (viewedStage === 'development') {
    if (surfaceState.value.development === undefined) {
      return <StageAvailability viewedStage={viewedStage} currentStage={currentStage} />
    }
    return <DevelopmentOutputs
      workspaceId={workspaceId}
      currentStage={currentStage}
      revision={stage?.status === 'ready' ? stage.value.revision : undefined}
      development={surfaceState.value.development}
      completeDevelopment={completeDevelopment}
      renderPreview={renderPreview}
    />
  }
  if (viewedStage === 'validation') {
    if (currentStage === undefined
      || FDE_STAGES.findIndex(item => item.id === currentStage) < FDE_STAGES.findIndex(item => item.id === 'validation')) {
      return <StageAvailability viewedStage={viewedStage} currentStage={currentStage} />
    }
    return <ValidationOutputs
      workspaceId={workspaceId}
      currentStage={currentStage}
      revision={stage?.status === 'ready' ? stage.value.revision : undefined}
      validation={surfaceState.value.validation}
      completeValidation={completeValidation}
      renderPreview={renderPreview}
    />
  }
  if (viewedStage !== 'requirements' && viewedStage !== 'solution') {
    return <StageAvailability viewedStage={viewedStage} currentStage={currentStage} />
  }
  const showSolution = viewedStage === 'solution'
  if (showSolution && surfaceState.value.solution === undefined) {
    return <StageAvailability viewedStage={viewedStage} currentStage={currentStage} />
  }
  const outputs = showSolution
    ? surfaceState.value.solution as NonNullable<typeof surfaceState.value.solution>
    : surfaceState.value.requirements
  const architecture = showSolution ? surfaceState.value.architecture : null
  const architectureError = surfaceState.value.architectureError
  const architectureReviewable = architecture !== null && architecture.status !== 'confirmed' && architectureError === undefined
  const documentsReady = outputs.presentCount === outputs.requiredCount
  const architectureReady = architecture?.status === 'confirmed'
  const ready = showSolution ? documentsReady && architectureReady : documentsReady
  const revision = stage?.status === 'ready' ? stage.value.revision : undefined
  const selectedArtifact = outputs.artifacts.find((artifact): artifact is typeof artifact & { readonly fileUrl: string } => (
    artifact.id === selectedArtifactId && artifact.status === 'present' && artifact.fileUrl !== undefined
  ))
  const outputCount = outputs.presentCount + (showSolution && architecture !== null ? 1 : 0)
  const outputTotal = outputs.requiredCount + (showSolution ? 1 : 0)
  const title = showSolution ? '方案设计阶段产出' : '需求调研阶段产出'
  const description = showSolution
    ? '项目 PRD 等五份文档与系统架构由 Agent 和 FDE 持续更新；文件存在和候选架构都不等于阶段已经完成。'
    : '这些文件由 Agent 与 FDE 在多轮沟通中持续更新；文件存在仍不等于客户已经确认。'
  return (
    <section className={css.outputRoot} data-stage={viewedStage}>
      <header className={css.outputHeader}>
        <div><h2>{title}</h2><p>{description}</p></div>
        <strong>{outputCount}/{outputTotal}</strong>
      </header>
      <div className={css.outputList}>
        {outputs.artifacts.map((artifact) => {
          const label = artifact.status === 'missing'
            ? '待生成'
            : artifact.status === 'error'
              ? '读取失败'
              : (artifact.id === 'requirement-baseline' && currentStage === 'requirements')
                || (artifact.id === 'solution-baseline' && currentStage === 'solution')
                ? '待 FDE 确认'
                : currentStage === undefined
                  ? '已纳入阶段确认'
                  : '已有文件'
          const previewable = artifact.status === 'present' && artifact.fileUrl !== undefined
          return (
            <button
              key={artifact.id}
              type="button"
              className={css.outputItem}
              data-status={artifact.status}
              data-active={selectedArtifact?.id === artifact.id || undefined}
              disabled={!previewable}
              onClick={() => { if (previewable) setSelectedArtifactId(artifact.id) }}
              aria-label={previewable ? `预览${artifact.title}` : undefined}
            >
              <span className={css.outputIcon} aria-hidden="true">MD</span>
              <div><h3>{artifact.title}</h3><code>{artifact.path}</code>{artifact.message !== undefined && <p>{artifact.message}</p>}</div>
              <span className={css.outputBadge}>{label}</span>
            </button>
          )
        })}
        {showSolution && (
          <button
            type="button"
            className={css.outputItem}
            data-status={architectureError !== undefined ? 'error' : architecture?.status === 'confirmed' ? 'present' : architecture === null ? 'missing' : 'pending'}
            disabled={!architectureReviewable}
            onClick={() => {
              if (!architectureReviewable) return
              setError(undefined)
              void reviewArchitecture().catch((reason: unknown) => {
                setError(reason instanceof Error ? reason.message : String(reason))
              })
            }}
            aria-label={architectureReviewable ? `去确认架构：${architecture.title} R${String(architecture.revision)}` : undefined}
          >
            <span className={css.outputIcon} aria-hidden="true">ARCH</span>
            <div>
              <h3>系统架构</h3>
              <code>.fde/architecture.json</code>
              {architecture !== null && <p className={css.outputMeta}>{architecture.title} · R{architecture.revision}</p>}
              {architectureError !== undefined && <p>{architectureError}</p>}
            </div>
            <span className={css.outputBadge}>{architectureError !== undefined
              ? '读取失败'
              : architecture === null
                ? '待生成'
                : architecture.status === 'confirmed'
                  ? `已确认 R${String(architecture.revision)}`
                  : '去确认架构'}</span>
          </button>
        )}
      </div>
      {selectedArtifact === undefined
        ? <div className={css.outputPreviewHint}>选择一份“已有文件”查看只读内容。</div>
        : <ArtifactPreview artifact={selectedArtifact} close={() => { setSelectedArtifactId(undefined) }} renderPreview={renderPreview} />}
      {viewedStage === 'requirements' && currentStage === 'requirements' && (
        <div className={css.stageGate}>
          {!confirming
            ? <>
              <div><strong>由 FDE 决定是否进入下一阶段</strong><p>{ready ? '三份标准产物已经齐备，请先核对内容和未决事项。' : '产物尚未齐备，请回到项目交付继续对话和更新文件。'}</p></div>
              <button type="button" disabled={!ready || revision === undefined} onClick={() => { setConfirming(true); setError(undefined) }}>完成需求调研</button>
            </>
            : <>
              <div><strong>确认进入方案设计</strong><p>我已核对客户原始资料、需求调研报告、确认清单、需求基线和仍保留的未决事项。</p></div>
              <div className={css.stageGateActions}>
                <button type="button" disabled={submitting} onClick={() => { setConfirming(false); setError(undefined) }}>返回核对</button>
                <button type="button" disabled={submitting || revision === undefined} onClick={() => {
                  if (revision === undefined) return
                  setSubmitting(true)
                  setError(undefined)
                  void completeRequirements(revision).then(
                    () => { setConfirming(false) },
                    (reason: unknown) => { setError(reason instanceof Error ? reason.message : String(reason)) },
                  ).finally(() => { setSubmitting(false) })
                }}>{submitting ? '正在确认…' : '确认并进入方案设计'}</button>
              </div>
            </>}
          {error !== undefined && <p className={css.stageGateError}>{error}</p>}
        </div>
      )}
      {viewedStage === 'solution' && currentStage === 'solution' && (
        <div className={css.stageGate}>
          {!confirming
            ? <>
              <div><strong>由 FDE 决定是否进入项目开发</strong><p>{ready ? '五份标准文档已经齐备，系统架构也已确认，请继续核对补充证据和剩余风险。' : !documentsReady ? '方案文档尚未齐备，请回到项目交付继续对话和更新文件。' : '系统架构尚未确认，请先在项目交付的“系统架构”中审阅并确认当前版本。'}</p></div>
              <button type="button" disabled={!ready || revision === undefined} onClick={() => { setConfirming(true); setError(undefined) }}>完成方案设计</button>
            </>
            : <>
              <div><strong>确认进入项目开发</strong><p>我已核对项目 PRD 等五份方案文档、已确认系统架构，以及本项目适用的原型、API 契约、数据映射、POC 证据或不适用理由和剩余风险。</p></div>
              <div className={css.stageGateActions}>
                <button type="button" disabled={submitting} onClick={() => { setConfirming(false); setError(undefined) }}>返回核对</button>
                <button type="button" disabled={submitting || revision === undefined} onClick={() => {
                  if (revision === undefined) return
                  setSubmitting(true)
                  setError(undefined)
                  void completeSolution(revision).then(
                    () => { setConfirming(false) },
                    (reason: unknown) => { setError(reason instanceof Error ? reason.message : String(reason)) },
                  ).finally(() => { setSubmitting(false) })
                }}>{submitting ? '正在确认…' : '确认并进入项目开发'}</button>
              </div>
            </>}
          {error !== undefined && <p className={css.stageGateError}>{error}</p>}
        </div>
      )}
      {currentStage !== undefined
        && FDE_STAGES.findIndex(item => item.id === currentStage) > FDE_STAGES.findIndex(item => item.id === viewedStage) && (
        <div className={css.stageConfirmed}>{STAGE_NAMES[viewedStage]}已由 FDE 确认，项目当前处于“{STAGE_NAMES[currentStage]}”。</div>
      )}
    </section>
  )
}

function ProjectDetail({
  row, sourceState, surfaceState, wikiState, selectedSource, selectSource, parseSource,
  prepareWiki, startWiki, abandonWiki, refreshWiki, completeRequirements, completeSolution, completeDevelopment, completeValidation,
  reviewArchitecture, enterProject, back, renderPreview,
}: {
  readonly row: ProjectRow
  readonly sourceState: ProjectSourceLoadState | undefined
  readonly surfaceState: ProjectSurfaceLoadState | undefined
  readonly wikiState: RequirementWikiLoadState | undefined
  readonly selectedSource: ProjectSourceItem | undefined
  readonly selectSource: (sourceId: string) => void
  readonly parseSource: (sourceId: string) => void
  readonly prepareWiki: (sessionId: string) => Promise<RequirementWikiRunTarget>
  readonly startWiki: (
    sourceIds: readonly string[],
    expectedRevision: number,
    target: RequirementWikiRunTarget,
  ) => Promise<void>
  readonly abandonWiki: (buildId: string) => Promise<void>
  readonly refreshWiki: () => void
  readonly completeRequirements: (revision: number) => Promise<void>
  readonly completeSolution: (revision: number) => Promise<void>
  readonly completeDevelopment: (revision: number) => Promise<void>
  readonly completeValidation: (revision: number) => Promise<void>
  readonly reviewArchitecture: () => Promise<void>
  readonly enterProject: () => void
  readonly back: () => void
  readonly renderPreview: (source: ProjectPreviewFile) => React.ReactNode
}) {
  const currentStage = row.stage?.status === 'ready' ? row.stage.value.currentStage : undefined
  const [viewedStage, setViewedStage] = useState<FdeStageId>(currentStage ?? 'requirements')
  const [section, setSection] = useState<'inputs' | 'outputs' | 'wiki' | 'conflicts' | 'unknowns'>('inputs')
  useEffect(() => {
    const nextStage = currentStage ?? 'requirements'
    setViewedStage(nextStage)
    setSection(nextStage === 'requirements' ? 'inputs' : 'outputs')
  }, [currentStage, row.workspaceId])
  const canParse = selectedSource !== undefined && ['pending', 'error', 'stale'].includes(selectedSource.parse.status)
  const openSource = (sourceId: string): void => { selectSource(sourceId); setViewedStage('requirements'); setSection('inputs') }
  const viewedIndex = FDE_STAGES.findIndex(item => item.id === viewedStage)
  const viewedState = stagePositionState(row.stage, viewedIndex)
  const validationReached = currentStage !== undefined
    && FDE_STAGES.findIndex(item => item.id === currentStage) >= FDE_STAGES.findIndex(item => item.id === 'validation')
  const schedule = row.schedule.status === 'estimated'
    ? `${formatDate(row.schedule.startDate)} — ${formatDate(row.schedule.endDate)}`
    : '待确认'
  const outputCount = surfaceState?.status === 'ready'
    ? viewedStage === 'validation' && validationReached
      ? surfaceState.value.validation.artifacts.presentCount
      : viewedStage === 'development'
        ? (surfaceState.value.development?.core.presentCount ?? 0)
          + (surfaceState.value.development?.features.reduce((total, feature) => total + feature.artifacts.filter(artifact => artifact.status === 'present').length, 0) ?? 0)
          + (surfaceState.value.development?.closure.presentCount ?? 0)
        : viewedStage === 'solution'
          ? (surfaceState.value.solution?.presentCount ?? 0) + (surfaceState.value.architecture === null ? 0 : 1)
          : viewedStage === 'requirements' ? surfaceState.value.requirements.presentCount : 0
    : 0
  const selectViewedStage = (nextStage: FdeStageId): void => {
    setViewedStage(nextStage)
    setSection(nextStage === 'requirements' ? 'inputs' : 'outputs')
  }
  return (
    <main className={css.detailPage}>
      <section className={css.detailHeader}>
        <div className={css.detailIdentity}>
          <div className={css.detailBreadcrumb}><button type="button" onClick={back}>← 全部项目</button></div>
          <div className={css.projectIdentity}>
            <span className={css.projectMark} aria-hidden="true">{row.title.slice(0, 1).toUpperCase()}</span>
            <div><span className={css.detailEyebrow}>单项目交付全景</span><h1>{row.title}</h1><p>{row.companyName || '未填写所属企业'}</p></div>
          </div>
        </div>
        <dl className={css.detailFacts}>
          <div><dt>项目当前阶段</dt><dd>{currentStage === undefined ? stageLabel(row.stage, '读取中', '读取失败') : `第 ${String(currentStageIndex(row.stage) + 1)}/6 阶段 · ${STAGE_NAMES[currentStage]}`}</dd></div>
          <div><dt>交付周期</dt><dd>{schedule}</dd></div>
          <div><dt>项目会话</dt><dd>{row.sessions} 个{row.runningSessions > 0 ? ` · ${String(row.runningSessions)} 个运行中` : ''}</dd></div>
        </dl>
        <button type="button" className={css.enterDeliveryButton} onClick={enterProject}>进入项目交付 <span aria-hidden="true">→</span></button>
      </section>
      <ProjectDeliverySummary row={row} sourceState={sourceState} surfaceState={surfaceState} wikiState={wikiState} />
      <div className={css.stageExperience}>
        <aside className={css.stageRail}>
          <header><span>交付阶段</span><h2>六阶段工作区</h2><p>选择阶段后，在右侧查看对应数据与产物。</p></header>
          <StageNavigator stage={row.stage} viewedStage={viewedStage} selectStage={selectViewedStage} />
        </aside>
        <div className={css.stageCanvas}>
          <section className={css.stageWorkspaceHeader} data-state={viewedState}>
            <span className={css.stageWorkspaceOrdinal} aria-hidden="true">{String(viewedIndex + 1).padStart(2, '0')}</span>
            <div className={css.stageWorkspaceCopy}>
              <span>正在查看 · 阶段 {String(viewedIndex + 1)}/6</span>
              <h2>{STAGE_NAMES[viewedStage]}</h2>
              <p>{STAGE_SUMMARIES[viewedStage]}</p>
            </div>
            <div className={css.stageWorkspaceState}>
              <strong>{stageStateLabel(viewedState)}</strong>
              {viewedStage !== currentStage && currentStage !== undefined && <small>项目当前处于 {STAGE_NAMES[currentStage]}</small>}
            </div>
          </section>
          <StageVisualSummary
            viewedStage={viewedStage}
            sourceState={sourceState}
            surfaceState={surfaceState}
            wikiState={wikiState}
          />
          <nav className={css.detailSections} aria-label={`${STAGE_NAMES[viewedStage]}工作区`}>
            {viewedStage === 'requirements' && <>
              <button type="button" data-active={section === 'inputs' || undefined} onClick={() => { setSection('inputs') }}>阶段输入 <span>{sourceState?.files.length ?? 0}</span></button>
              <button type="button" data-active={section === 'outputs' || undefined} onClick={() => { setSection('outputs') }}>阶段产出 <span>{outputCount}</span></button>
              <button type="button" data-active={section === 'wiki' || undefined} onClick={() => { setSection('wiki') }}>需求知识图谱</button>
              <button type="button" data-active={section === 'conflicts' || undefined} onClick={() => { setSection('conflicts') }}>冲突与缺口 <span>{wikiState?.value?.current?.conflicts.length ?? 0}</span></button>
              <button type="button" data-active={section === 'unknowns' || undefined} onClick={() => { setSection('unknowns') }}>待确认事项 <span>{wikiState?.value?.current?.unknowns.length ?? 0}</span></button>
            </>}
            {viewedStage !== 'requirements' && <button type="button" data-active>阶段产出 <span>{outputCount}</span></button>}
          </nav>
          {viewedStage === 'requirements' && section === 'wiki' && (
            <RequirementWikiPanel
              workspaceId={row.workspaceId}
              runSessionId={row.wikiSessionId}
              wikiState={wikiState}
              sourceState={sourceState}
              onPrepare={prepareWiki}
              onStart={startWiki}
              onAbandon={abandonWiki}
              onRefresh={refreshWiki}
              onOpenSource={openSource}
            />
          )}
          {viewedStage === 'requirements' && section === 'conflicts' && <RequirementIssuePanel kind="conflicts" wikiState={wikiState} onOpenSource={openSource} />}
          {viewedStage === 'requirements' && section === 'unknowns' && <RequirementIssuePanel kind="unknowns" wikiState={wikiState} onOpenSource={openSource} />}
          {(viewedStage !== 'requirements' || section === 'outputs') && <StageOutputs
            workspaceId={row.workspaceId}
            stage={row.stage}
            viewedStage={viewedStage}
            surfaceState={surfaceState}
            completeRequirements={completeRequirements}
            completeSolution={completeSolution}
            completeDevelopment={completeDevelopment}
            completeValidation={completeValidation}
            reviewArchitecture={reviewArchitecture}
            renderPreview={renderPreview}
          />}
          {viewedStage === 'requirements' && section === 'inputs' && <div className={css.detailLayout}>
            <aside className={css.sourcePanel}>
              <div className={css.sourcePanelHeader}>
                <div><h2>项目资料</h2><span>客户原始文件与本地识别状态</span></div>
                <strong>{sourceState?.files.length ?? 0}</strong>
              </div>
              {sourceState === undefined || sourceState.status === 'loading'
                ? <div className={css.sourceState}>正在读取项目资料…</div>
                : sourceState.status === 'error'
                  ? <div className={css.sourceState} data-error>{sourceState.message}</div>
                  : sourceState.files.length === 0
                    ? <div className={css.sourceState}>还没有项目资料。请从左侧项目行添加。</div>
                    : <div className={css.sourceList}>{sourceState.files.map(source => (
                      <button key={source.sourceId} type="button" data-active={selectedSource?.sourceId === source.sourceId || undefined} onClick={() => { selectSource(source.sourceId) }}>
                        <span className={css.sourceExtension}>{source.extension || 'FILE'}</span>
                        <span className={css.sourceText}>
                          <strong>{source.storedName}</strong>
                          <small>{formatBytes(source.bytes)} · {sourceStateLabel(source)}</small>
                        </span>
                      </button>
                    ))}</div>}
            </aside>
            <section className={css.previewPanel}>
              {selectedSource === undefined
                ? <div className={css.previewEmpty}><strong>选择一份项目资料</strong><span>这里会显示只读预览和真实处理状态。</span></div>
                : <>
                  <header className={css.previewHeader}>
                    <div>
                      <h2>{selectedSource.storedName}</h2>
                      <span>{selectedSource.mimeType} · {formatBytes(selectedSource.bytes)}</span>
                    </div>
                    <div className={css.previewActions}>
                      <span className={css.sourceStatus} data-status={selectedSource.parse.status}>{parseLabel(selectedSource)}</span>
                      {canParse && <button type="button" onClick={() => { parseSource(selectedSource.sourceId) }}>本地识别</button>}
                      <a href={selectedSource.fileUrl} download={selectedSource.storedName}>下载原件</a>
                    </div>
                  </header>
                  {selectedSource.parse.message !== undefined && <div className={css.sourceNotice}>{selectedSource.parse.message}</div>}
                  <div className={css.previewBody}>{renderPreview({
                    fileUrl: selectedSource.fileUrl,
                    name: selectedSource.storedName,
                    bytes: selectedSource.bytes,
                    previewKind: selectedSource.previewKind,
                  })}</div>
                </>}
            </section>
          </div>}
        </div>
      </div>
    </main>
  )
}

/** Render the global full page while retaining the ordinary project/session sidebar. */
export function ProjectProgressOverlay({
  useProjectPage, useStageProgress, useProjectSurfaces, useProjectSources, useRequirementWiki, useWorkspaces, useSessions,
  loadStage, retryStage, refreshProjectSurface, loadProjectSources, parseProjectSource, loadRequirementWiki,
  prepareRequirementWikiRun, startRequirementWikiBuild, abandonRequirementWikiBuild, enterProject, reviewProjectArchitecture,
  completeRequirements, completeSolution, completeDevelopment, completeValidation, closeProjectPage,
  showProjectOverview, showProjectTimeline, showProjectDetail,
  renderSlot, t,
}: ProjectProgressOverlayProps) {
  const page = useProjectPage(state => state)
  const workspaces = useWorkspaces(state => state.items)
  const sessions = useSessions(state => state)
  const stages = useStageProgress(state => state.byWorkspace)
  const surfaces = useProjectSurfaces(state => state.byWorkspace)
  const sources = useProjectSources(state => state.byWorkspace)
  const requirementWikis = useRequirementWiki(state => state.byWorkspace)
  const [selectedSourceId, setSelectedSourceId] = useState<string | undefined>()
  const [stageFilter, setStageFilter] = useState<'all' | FdeStageId>('all')
  const [rootRef, sidebarOffset] = useSidebarOffset(page.open)
  useStandalonePage(page.open, rootRef)

  useEffect(() => {
    if (!page.open) return
    for (const workspace of workspaces) loadStage(String(workspace.workspaceId))
  }, [loadStage, page.open, workspaces])

  useEffect(() => {
    if (page.view !== 'project' || page.workspaceId === undefined) return
    setSelectedSourceId(undefined)
    refreshProjectSurface(page.workspaceId)
    loadProjectSources(page.workspaceId)
    loadRequirementWiki(page.workspaceId)
  }, [loadProjectSources, loadRequirementWiki, page.view, page.workspaceId, refreshProjectSurface])

  useEffect(() => {
    if (page.view !== 'project' || page.workspaceId === undefined) return
    const build = requirementWikis[page.workspaceId]?.value?.build
    if (build === null || build === undefined || (build.status !== 'queued' && build.status !== 'running')) return
    const timer = window.setInterval(() => { loadRequirementWiki(page.workspaceId as string, true) }, 2_500)
    return () => { window.clearInterval(timer) }
  }, [loadRequirementWiki, page.view, page.workspaceId, requirementWikis])

  useEffect(() => {
    if (page.view !== 'project' || page.workspaceId === undefined || selectedSourceId !== undefined) return
    const first = sources[page.workspaceId]?.files[0]
    if (first !== undefined) setSelectedSourceId(first.sourceId)
  }, [page.view, page.workspaceId, selectedSourceId, sources])

  useEffect(() => {
    if (!page.open) return
    const onKey = (event: KeyboardEvent): void => { if (event.key === 'Escape') closeProjectPage() }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey) }
  }, [closeProjectPage, page.open])

  const rows = useMemo<readonly ProjectRow[]>(() => workspaces.map((workspace) => {
    const workspaceSessions = workspace.sessionIds.map(id => sessions.byId[id]).filter(item => item !== undefined)
    const wikiSessionId = workspaceSessions.find(item => item.origin !== 'subagent')?.id
    const metadata = readProjectMetadata(workspace.path)
    return {
      workspaceId: String(workspace.workspaceId), title: workspace.title, path: workspace.path,
      createdAt: workspace.createdAt, sessions: workspaceSessions.length,
      runningSessions: workspaceSessions.filter(item => item.running).length,
      ...(wikiSessionId === undefined ? {} : { wikiSessionId: String(wikiSessionId) }),
      companyName: metadata.companyName, schedule: metadata.schedule,
      stage: stages[String(workspace.workspaceId)],
    }
  }), [sessions.byId, stages, workspaces])
  const recentActivities = useMemo<readonly PortfolioActivity[]>(() => workspaces.flatMap(workspace => (
    workspace.sessionIds.flatMap((sessionId) => {
      const session = sessions.byId[sessionId]
      if (session === undefined || session.blank) return []
      return [{
        sessionId: String(session.id),
        workspaceId: String(workspace.workspaceId),
        projectTitle: workspace.title,
        sessionTitle: session.displayTitle,
        updatedAt: session.updatedAt,
        running: session.running,
      }]
    })
  )).toSorted((left, right) => right.updatedAt - left.updatedAt).slice(0, 5), [sessions.byId, workspaces])

  if (!page.open) return null
  const detailRow = page.workspaceId === undefined ? undefined : rows.find(row => row.workspaceId === page.workspaceId)
  const sourceState = page.workspaceId === undefined ? undefined : sources[page.workspaceId]
  const surfaceState = page.workspaceId === undefined ? undefined : surfaces[page.workspaceId]
  const wikiState = page.workspaceId === undefined ? undefined : requirementWikis[page.workspaceId]
  const selectedSource = sourceState?.files.find(source => source.sourceId === selectedSourceId)
  const pendingSchedules = rows.filter(row => row.schedule.status === 'pending-confirmation').length
  const activeSessions = rows.reduce((total, row) => total + row.runningSessions, 0)
  const sessionCount = rows.reduce((total, row) => total + row.sessions, 0)
  const filteredRows = stageFilter === 'all'
    ? rows
    : rows.filter(row => row.stage?.status === 'ready' && row.stage.value.currentStage === stageFilter)

  return (
    <div ref={rootRef} className={css.pageOverlay} style={{ left: sidebarOffset, width: `calc(100% - ${String(sidebarOffset)}px)` }} data-testid="fde-project-progress">
      <header className={css.pageHeader}>
        <div><span className={css.pageEyebrow}>FF - FDE 交付工作台</span><h1>{t('progress.title')}</h1><p>{t('progress.subtitle')}</p></div>
        <button type="button" className={css.closeButton} aria-label={t('progress.close')} onClick={closeProjectPage}>×</button>
      </header>

      {page.view === 'project' && detailRow !== undefined
        ? <ProjectDetail
          row={detailRow}
          sourceState={sourceState}
          surfaceState={surfaceState}
          wikiState={wikiState}
          selectedSource={selectedSource}
          selectSource={setSelectedSourceId}
          parseSource={(sourceId) => {
            void parseProjectSource(detailRow.workspaceId, sourceId)
              .then(() => { loadRequirementWiki(detailRow.workspaceId, true) })
              .catch(() => undefined)
          }}
          prepareWiki={async (sessionId) => {
            return await prepareRequirementWikiRun(detailRow.workspaceId, sessionId)
          }}
          startWiki={async (sourceIds, expectedRevision, target) => {
            await startRequirementWikiBuild(detailRow.workspaceId, sourceIds, expectedRevision, target)
          }}
          abandonWiki={async (buildId) => {
            await abandonRequirementWikiBuild(detailRow.workspaceId, buildId)
          }}
          refreshWiki={() => { loadRequirementWiki(detailRow.workspaceId, true) }}
          completeRequirements={async (revision) => {
            try {
              await completeRequirements(detailRow.workspaceId, revision)
            } catch (error) {
              retryStage(detailRow.workspaceId)
              throw error
            }
          }}
          completeSolution={async (revision) => {
            try {
              await completeSolution(detailRow.workspaceId, revision)
            } catch (error) {
              retryStage(detailRow.workspaceId)
              throw error
            }
          }}
          completeDevelopment={async (revision) => {
            try {
              await completeDevelopment(detailRow.workspaceId, revision)
            } catch (error) {
              retryStage(detailRow.workspaceId)
              throw error
            }
          }}
          completeValidation={async (revision) => {
            try {
              await completeValidation(detailRow.workspaceId, revision)
            } catch (error) {
              retryStage(detailRow.workspaceId)
              throw error
            }
          }}
          reviewArchitecture={async () => { await reviewProjectArchitecture(detailRow.workspaceId) }}
          enterProject={() => { void enterProject(detailRow.workspaceId) }}
          back={showProjectOverview}
          renderPreview={source => renderSlot('fde.project.source.preview', { source })}
        />
        : <main className={css.pageBody}>
          <PortfolioOverview
            rows={rows}
            activeSessions={activeSessions}
            pendingSchedules={pendingSchedules}
            sessionCount={sessionCount}
          />
          <PortfolioFocus rows={rows} activities={recentActivities} showProject={showProjectDetail} />
          <PortfolioStageFilter rows={rows} selectedStage={stageFilter} selectStage={setStageFilter} />
          <div className={css.pageToolbar}>
            <div>
              <h2>{stageFilter === 'all' ? '全部项目' : `${STAGE_NAMES[stageFilter]}项目`}</h2>
              <span>{stageFilter === 'all' ? '阶段来自项目记录，周期来自新建项目时填写的信息。' : `当前筛选出 ${String(filteredRows.length)} 个项目。`}</span>
            </div>
            <div className={css.segmented}>
              <button type="button" data-active={page.view === 'overview' || undefined} onClick={showProjectOverview}>{t('progress.overview')}</button>
              <button type="button" data-active={page.view === 'timeline' || undefined} onClick={showProjectTimeline}>{t('progress.timeline')}</button>
            </div>
          </div>
          {rows.length === 0
            ? <div className={css.pageEmpty}>{t('progress.empty')}</div>
            : filteredRows.length === 0
              ? <div className={css.pageEmpty}>当前阶段没有项目。</div>
              : page.view === 'timeline'
                ? <Timeline rows={filteredRows} showProject={showProjectDetail} todayLabel={t('progress.today')} />
                : <div className={css.projectGrid}>{filteredRows.map(row => (
                  <ProjectCard key={row.workspaceId} row={row} showProject={showProjectDetail} labels={{
                    companyMissing: t('progress.companyMissing'), scheduleMissing: t('progress.scheduleMissing'),
                    view: t('progress.viewProject'), created: date => t('progress.createdAt', { date }),
                    loading: t('progress.stageLoading'), failed: t('progress.stageError'),
                  }} />
                ))}</div>}
          {Object.values(stages).some(stage => stage.status === 'error') && (
            <button type="button" className={css.retryAll} onClick={() => { for (const row of rows) if (row.stage?.status === 'error') retryStage(row.workspaceId) }}>重新读取失败的项目阶段</button>
          )}
        </main>}
    </div>
  )
}
