/** Full Project Progress page beside the persistent project/session sidebar. */

import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, RefObject } from 'react'
import type {
  AcceptanceHandoverDecision,
  AcceptanceHandoverStageSnapshot,
  DeliveryCloseoutArtifact,
  DeploymentTrialStageSnapshot,
  DevelopmentArtifact,
  ProjectSurfaceLoadState,
  ValidationStageSnapshot,
} from './controller.ts'
import { readProjectMetadata, STAGE_NAMES } from './project-data.ts'
import { FDE_STAGES, type FdeProjectState, type FdeStageId, type ProjectStageLoadState } from './stage-controller.ts'
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
  readonly preview?: {
    readonly kind: 'demo'
    readonly owner: string
    readonly health: 'stable' | 'attention' | 'risk'
    readonly pendingDecisions: number
    readonly blockers: number
    readonly nextMilestone: string
    readonly nextMilestoneDate: string
    readonly weeklyActivity: readonly number[]
  }
}

interface ProjectRowLabels {
  readonly companyMissing: string
  readonly scheduleMissing: string
  readonly view: string
  readonly created: (date: string) => string
  readonly loading: string
  readonly failed: string
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

function formatAuditTime(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(date)
}

function formatBytes(value: number): string {
  if (value < 1024) return `${String(value)} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}

function currentStageIndex(stage: ProjectStageLoadState | undefined): number {
  if (stage?.status !== 'ready') return -1
  return stage.value.currentStage === 'completed'
    ? FDE_STAGES.length
    : FDE_STAGES.findIndex(item => item.id === stage.value.currentStage)
}

function stageReached(currentStage: FdeProjectState | undefined, target: FdeStageId): boolean {
  if (currentStage === undefined) return false
  if (currentStage === 'completed') return true
  return FDE_STAGES.findIndex(item => item.id === currentStage) >= FDE_STAGES.findIndex(item => item.id === target)
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
  validation: '围绕同一候选版本核对评估、测试、运行用量、风险和恢复证据。',
  pilot: '在客户环境进行受控试运行，记录运行问题、修复结果与上线边界。',
  handoff: '完成客户验收、交付材料、运行说明和后续责任移交。',
}

const STAGE_OUTPUT_LABELS: Readonly<Record<FdeStageId, string>> = {
  requirements: '需求基线',
  solution: '方案与架构',
  development: '可运行项目',
  validation: '验证结论',
  pilot: '试运行记录',
  handoff: '验收与移交',
}

const DEMO_PROJECT_ROWS: readonly ProjectRow[] = [
  {
    workspaceId: 'demo-retail-copilot', title: '零售智能客服升级', path: '/demo/retail-copilot',
    createdAt: '2026-08-18T09:00:00.000Z', sessions: 6, runningSessions: 1,
    companyName: '星桥零售集团', schedule: { status: 'estimated', startDate: '2026-08-18', endDate: '2026-10-16' },
    stage: { status: 'ready', value: { workspaceId: 'demo-retail-copilot', currentStage: 'requirements', revision: 1, createdAt: '2026-08-18T09:00:00.000Z', updatedAt: '2026-08-27T10:30:00.000Z' } },
    preview: { kind: 'demo', owner: '周琳', health: 'attention', pendingDecisions: 5, blockers: 0, nextMilestone: '确认需求基线', nextMilestoneDate: '2026-09-04', weeklyActivity: [8, 3, 5, 10, 4, 7] },
  },
  {
    workspaceId: 'demo-supply-chain', title: '供应链预测中台', path: '/demo/supply-chain',
    createdAt: '2026-08-08T09:00:00.000Z', sessions: 9, runningSessions: 2,
    companyName: '恒川制造', schedule: { status: 'estimated', startDate: '2026-08-08', endDate: '2026-11-06' },
    stage: { status: 'ready', value: { workspaceId: 'demo-supply-chain', currentStage: 'solution', revision: 2, createdAt: '2026-08-08T09:00:00.000Z', updatedAt: '2026-08-27T09:40:00.000Z' } },
    preview: { kind: 'demo', owner: '陈骁', health: 'risk', pendingDecisions: 3, blockers: 1, nextMilestone: '评审系统架构', nextMilestoneDate: '2026-09-08', weeklyActivity: [3, 9, 6, 4, 11, 5] },
  },
  {
    workspaceId: 'demo-quality-vision', title: '质检视觉模型落地', path: '/demo/quality-vision',
    createdAt: '2026-07-28T09:00:00.000Z', sessions: 15, runningSessions: 3,
    companyName: '启辰精密', schedule: { status: 'estimated', startDate: '2026-07-28', endDate: '2026-11-20' },
    stage: { status: 'ready', value: { workspaceId: 'demo-quality-vision', currentStage: 'development', revision: 3, createdAt: '2026-07-28T09:00:00.000Z', updatedAt: '2026-08-27T11:10:00.000Z' } },
    preview: { kind: 'demo', owner: '韩启', health: 'attention', pendingDecisions: 2, blockers: 1, nextMilestone: '完成首轮端到端联调', nextMilestoneDate: '2026-09-12', weeklyActivity: [6, 8, 15, 9, 13, 12] },
  },
  {
    workspaceId: 'demo-churn-alert', title: '客户流失预警系统', path: '/demo/churn-alert',
    createdAt: '2026-07-16T09:00:00.000Z', sessions: 11, runningSessions: 1,
    companyName: '云栖会员业务部', schedule: { status: 'estimated', startDate: '2026-07-16', endDate: '2026-09-25' },
    stage: { status: 'ready', value: { workspaceId: 'demo-churn-alert', currentStage: 'validation', revision: 4, createdAt: '2026-07-16T09:00:00.000Z', updatedAt: '2026-08-27T08:20:00.000Z' } },
    preview: { kind: 'demo', owner: '沈岚', health: 'stable', pendingDecisions: 1, blockers: 0, nextMilestone: '确认离线评估报告', nextMilestoneDate: '2026-09-02', weeklyActivity: [5, 4, 9, 7, 6, 10] },
  },
  {
    workspaceId: 'demo-store-analysis', title: '门店经营分析试点', path: '/demo/store-analysis',
    createdAt: '2026-06-30T09:00:00.000Z', sessions: 13, runningSessions: 2,
    companyName: '澄海连锁商业', schedule: { status: 'estimated', startDate: '2026-06-30', endDate: '2026-09-15' },
    stage: { status: 'ready', value: { workspaceId: 'demo-store-analysis', currentStage: 'pilot', revision: 5, createdAt: '2026-06-30T09:00:00.000Z', updatedAt: '2026-08-27T07:50:00.000Z' } },
    preview: { kind: 'demo', owner: '许澄', health: 'stable', pendingDecisions: 2, blockers: 0, nextMilestone: '完成三店试运行复盘', nextMilestoneDate: '2026-09-10', weeklyActivity: [2, 7, 5, 11, 8, 6] },
  },
  {
    workspaceId: 'demo-knowledge-assistant', title: '企业知识助手一期', path: '/demo/knowledge-assistant',
    createdAt: '2026-06-05T09:00:00.000Z', sessions: 18, runningSessions: 0,
    companyName: '和光科技', schedule: { status: 'estimated', startDate: '2026-06-05', endDate: '2026-08-31' },
    stage: { status: 'ready', value: { workspaceId: 'demo-knowledge-assistant', currentStage: 'handoff', revision: 6, createdAt: '2026-06-05T09:00:00.000Z', updatedAt: '2026-08-26T16:20:00.000Z' } },
    preview: { kind: 'demo', owner: '林晗', health: 'stable', pendingDecisions: 1, blockers: 0, nextMilestone: '完成运维责任移交', nextMilestoneDate: '2026-08-31', weeklyActivity: [9, 6, 8, 5, 4, 3] },
  },
  {
    workspaceId: 'demo-contract-review', title: '合同审查智能助手', path: '/demo/contract-review',
    createdAt: '2026-08-22T09:00:00.000Z', sessions: 5, runningSessions: 1,
    companyName: '汇法企业服务', schedule: { status: 'pending-confirmation' },
    stage: { status: 'ready', value: { workspaceId: 'demo-contract-review', currentStage: 'requirements', revision: 1, createdAt: '2026-08-22T09:00:00.000Z', updatedAt: '2026-08-27T10:50:00.000Z' } },
    preview: { kind: 'demo', owner: '程可', health: 'attention', pendingDecisions: 4, blockers: 0, nextMilestone: '确认审查边界', nextMilestoneDate: '2026-09-06', weeklyActivity: [4, 12, 5, 7, 3, 8] },
  },
  {
    workspaceId: 'demo-predictive-maintenance', title: '工业设备预测维护', path: '/demo/predictive-maintenance',
    createdAt: '2026-07-21T09:00:00.000Z', sessions: 14, runningSessions: 2,
    companyName: '北辰能源设备', schedule: { status: 'estimated', startDate: '2026-07-21', endDate: '2026-11-28' },
    stage: { status: 'ready', value: { workspaceId: 'demo-predictive-maintenance', currentStage: 'development', revision: 3, createdAt: '2026-07-21T09:00:00.000Z', updatedAt: '2026-08-27T11:35:00.000Z' } },
    preview: { kind: 'demo', owner: '宋一帆', health: 'risk', pendingDecisions: 2, blockers: 2, nextMilestone: '设备数据联调', nextMilestoneDate: '2026-09-14', weeklyActivity: [7, 5, 13, 6, 14, 9] },
  },
  {
    workspaceId: 'demo-content-platform', title: '营销内容生成平台', path: '/demo/content-platform',
    createdAt: '2026-07-25T09:00:00.000Z', sessions: 12, runningSessions: 2,
    companyName: '元景品牌中心', schedule: { status: 'estimated', startDate: '2026-07-25', endDate: '2026-10-30' },
    stage: { status: 'ready', value: { workspaceId: 'demo-content-platform', currentStage: 'development', revision: 3, createdAt: '2026-07-25T09:00:00.000Z', updatedAt: '2026-08-27T11:05:00.000Z' } },
    preview: { kind: 'demo', owner: '姜姸', health: 'stable', pendingDecisions: 1, blockers: 0, nextMilestone: '完成品牌语料验收', nextMilestoneDate: '2026-09-09', weeklyActivity: [3, 11, 7, 12, 5, 15] },
  },
] as const

function isDemoProject(row: ProjectRow): boolean {
  return row.preview?.kind === 'demo'
}

function portfolioStageId(row: ProjectRow): FdeStageId | undefined {
  if (row.stage?.status !== 'ready') return undefined
  return row.stage.value.currentStage === 'completed' ? 'handoff' : row.stage.value.currentStage
}

function portfolioHealth(row: ProjectRow): 'stable' | 'attention' | 'risk' {
  if (row.preview !== undefined) return row.preview.health
  if (row.stage?.status === 'error') return 'risk'
  if (row.schedule.status === 'pending-confirmation') return 'attention'
  return 'stable'
}

function demoRowsFor(realRows: readonly ProjectRow[]): readonly ProjectRow[] {
  const previewTarget = 10
  if (realRows.length === 0 || realRows.length >= previewTarget) return []
  const occupied = new Set<FdeStageId>()
  for (const row of realRows) {
    const stageId = portfolioStageId(row)
    if (stageId !== undefined) occupied.add(stageId)
  }
  const ordered = [
    ...DEMO_PROJECT_ROWS.filter((row) => {
      const stageId = portfolioStageId(row)
      return stageId !== undefined && !occupied.has(stageId)
    }),
    ...DEMO_PROJECT_ROWS.filter((row) => {
      const stageId = portfolioStageId(row)
      return stageId !== undefined && occupied.has(stageId)
    }),
  ]
  return ordered.slice(0, previewTarget - realRows.length)
}

function previousStageOf(stage: FdeProjectState): FdeStageId | undefined {
  if (stage === 'requirements') return undefined
  if (stage === 'completed') return 'handoff'
  const index = FDE_STAGES.findIndex(item => item.id === stage)
  return index <= 0 ? undefined : FDE_STAGES[index - 1]?.id
}

function stagePositionState(stage: ProjectStageLoadState | undefined, index: number): 'unknown' | 'done' | 'current' | 'reconfirm' | 'pending' {
  const current = currentStageIndex(stage)
  if (current < 0) return 'unknown'
  if (current === FDE_STAGES.length) return 'done'
  if (index < current) return 'done'
  if (index === current) return 'current'
  if (stage?.status === 'ready' && stage.value.reconfirmThrough !== undefined) {
    const boundary = stage.value.reconfirmThrough === 'completed'
      ? FDE_STAGES.length
      : FDE_STAGES.findIndex(item => item.id === stage.value.reconfirmThrough)
    if (index <= boundary) return 'reconfirm'
  }
  return 'pending'
}

function stageStateLabel(state: ReturnType<typeof stagePositionState>): string {
  if (state === 'done') return '已通过'
  if (state === 'current') return '当前阶段'
  if (state === 'reconfirm') return '待重新确认'
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
          <li key={definition.id} data-stage={definition.id} data-state={state}>
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
    {
      id: 'validation', label: '验证评估',
      present: snapshot?.validation?.artifacts.presentCount ?? 0,
      total: snapshot?.validation?.artifacts.requiredCount ?? 0,
    },
    {
      id: 'pilot', label: '部署试运行',
      present: snapshot?.deploymentTrial?.artifacts.presentCount ?? 0,
      total: snapshot?.deploymentTrial?.artifacts.requiredCount ?? 0,
    },
    {
      id: 'handoff', label: '验收移交',
      present: snapshot?.acceptanceHandover?.artifacts.presentCount ?? 0,
      total: snapshot?.acceptanceHandover?.artifacts.requiredCount ?? 0,
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
    const pilot = snapshot?.deploymentTrial
    const evidence = pilot?.contract.evidence
    const evidenceReady = evidence === undefined ? 0 : Object.values(evidence).filter(item => item.available).length
    return (
      <section className={`${css.stageVisual} ${css.pilotVisual}`} aria-label="部署试运行路径">
        <header><span>受控运行</span><h3>客户环境试运行路径</h3></header>
        <ol>
          <li><span>01</span><strong>{pilot?.contract.candidateVersion ?? '候选版本待登记'}</strong></li>
          <li><span>02</span><strong>{pilot?.contract.environment?.name ?? '目标环境待登记'}</strong></li>
          <li><span>03</span><strong>{evidenceReady}/5 组证据</strong></li>
          <li><span>04</span><strong>{pilot?.contract.issues.length ?? 0} 个问题</strong></li>
        </ol>
        <p>{pilot?.contract.deploymentStatus === undefined ? '尚未建立试运行状态。' : `当前状态：${pilot.contract.deploymentStatus}；固定产物 ${String(pilot.artifacts.presentCount)}/${String(pilot.artifacts.requiredCount)}。`}</p>
      </section>
    )
  }
  const handoff = snapshot?.acceptanceHandover
  const handoverComplete = handoff?.contract.handover === undefined ? 0 : [
    handoff.contract.handover.trainingCompleted,
    handoff.contract.handover.accessResponsibilityTransferred,
    handoff.contract.handover.operationsResponsibilityTransferred,
  ].filter(Boolean).length
  return (
    <section className={`${css.stageVisual} ${css.handoffVisual}`} aria-label="验收移交清单">
      <header><span>正式交付</span><h3>验收与责任移交包</h3></header>
      <div>
        <article><span>ACCEPT</span><strong>{handoff?.contract.acceptance?.status ?? '验收待登记'}</strong></article>
        <article>
          <span>PACKAGE</span>
          <strong>
            {handoff?.contract.deliverables.filter(item => item.available).length ?? 0}/
            {handoff?.contract.deliverables.length ?? 0} 可取得
          </strong>
        </article>
        <article>
          <span>DOCS</span>
          <strong>{handoff?.artifacts.presentCount ?? 0}/{handoff?.artifacts.requiredCount ?? 0} 固定产物</strong>
        </article>
        <article><span>OWNER</span><strong>{handoverComplete}/3 项移交</strong></article>
      </div>
      <p>{handoff?.gateReady === true ? '验收移交事实已达到提交条件，仍需 FDE 最终确认。' : '仅展示项目已经记录的验收、交付物与责任移交事实。'}</p>
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
  readonly labels: ProjectRowLabels
}) {
  const index = currentStageIndex(row.stage)
  const currentDefinition = index < 0 || index >= FDE_STAGES.length ? undefined : FDE_STAGES[index]
  const schedule = row.schedule.status === 'estimated'
    ? `${formatDate(row.schedule.startDate)} — ${formatDate(row.schedule.endDate)}`
    : labels.scheduleMissing
  const demo = isDemoProject(row)
  const stageId = currentDefinition?.id ?? (index >= FDE_STAGES.length ? 'handoff' : 'requirements')
  return (
    <article className={css.projectCard} data-stage={stageId} data-demo={demo || undefined}>
      <div className={css.projectCardLead}>
        <div className={css.projectIdentity}>
          <span className={css.projectMark} aria-hidden="true">{row.title.slice(0, 1).toUpperCase()}</span>
          <div>
            <div className={css.projectTitleLine}><h2>{row.title}</h2></div>
            <p>{row.companyName || labels.companyMissing}{row.preview === undefined ? '' : ` · FDE ${row.preview.owner}`}</p>
          </div>
        </div>
        <div className={css.projectStageHeadline}>
          <span>{index < 0 ? '—' : String(Math.min(index + 1, 6)).padStart(2, '0')}<small>/06</small></span>
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
              : index >= FDE_STAGES.length
                ? '六阶段已完成 · 项目已交付'
                : `阶段 ${String(index + 1)}/6 · ${STAGE_NAMES[currentDefinition?.id ?? 'requirements']}`}
          </span>
        </div>
        <ProjectStagePath stage={row.stage} />
      </div>
      <dl className={css.projectFacts}>
        <div><dt>交付周期</dt><dd>{schedule}</dd></div>
        {row.preview === undefined
          ? <>
            <div><dt>项目会话</dt><dd>{row.sessions} 个</dd></div>
            <div><dt>运行中</dt><dd>{row.runningSessions} 个会话</dd></div>
          </>
          : <>
            <div><dt>待确认</dt><dd>{row.preview.pendingDecisions} 项</dd></div>
            <div><dt>阻塞</dt><dd>{row.preview.blockers} 项</dd></div>
          </>}
      </dl>
      <div className={css.projectCardFoot}>
        <span>{row.preview === undefined
          ? labels.created(formatDate(row.createdAt))
          : `下一节点：${row.preview.nextMilestone} · ${formatDate(row.preview.nextMilestoneDate)}`}</span>
        <button type="button" disabled={demo} onClick={() => { if (!demo) showProject(row.workspaceId) }}>
          {labels.view}{!demo && <span aria-hidden="true">→</span>}
        </button>
      </div>
    </article>
  )
}

function ProjectList({ rows, showProject, labels }: {
  readonly rows: readonly ProjectRow[]
  readonly showProject: (workspaceId: string) => void
  readonly labels: ProjectRowLabels
}) {
  return (
    <div className={css.projectListFrame}>
      <table className={css.projectList} aria-label="项目列表">
        <thead>
          <tr>
            <th scope="col">项目</th>
            <th scope="col">当前阶段</th>
            <th scope="col">交付周期</th>
            <th scope="col">会话</th>
            <th scope="col">项目状态</th>
            <th scope="col">近期节点</th>
            <th scope="col">操作</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const index = currentStageIndex(row.stage)
            const stageId = portfolioStageId(row) ?? 'requirements'
            const demo = isDemoProject(row)
            const health = portfolioHealth(row)
            const schedule = row.schedule.status === 'estimated'
              ? `${formatDate(row.schedule.startDate)} — ${formatDate(row.schedule.endDate)}`
              : labels.scheduleMissing
            const stageName = stageLabel(row.stage, labels.loading, labels.failed)
            const stagePosition = index < 0 ? '阶段待读取' : `阶段 ${String(Math.min(index + 1, 6))}/6`
            const healthLabel = health === 'stable' ? '进展平稳' : health === 'attention' ? '需要关注' : '存在阻塞'
            const healthDetail = row.preview !== undefined
              ? row.preview.blockers > 0
                ? `${String(row.preview.blockers)} 项阻塞`
                : row.preview.pendingDecisions > 0
                  ? `${String(row.preview.pendingDecisions)} 项待确认`
                  : '暂无待处理项'
              : row.stage?.status === 'error'
                ? labels.failed
                : row.schedule.status === 'pending-confirmation'
                  ? labels.scheduleMissing
                  : row.runningSessions > 0
                    ? `${String(row.runningSessions)} 个会话运行中`
                    : '暂无运行会话'
            return (
              <tr key={row.workspaceId} className={css.projectListRow} data-stage={stageId} data-demo={demo || undefined}>
                <td>
                  <div className={css.projectListIdentity}>
                    <span className={css.projectListMark} aria-hidden="true">{row.title.slice(0, 1).toUpperCase()}</span>
                    <span>
                      <strong>{row.title}</strong>
                      <small>{row.companyName || labels.companyMissing}{row.preview === undefined ? '' : ` · FDE ${row.preview.owner}`}</small>
                    </span>
                  </div>
                </td>
                <td>
                  <span className={css.projectListStage} data-stage={stageId}>
                    <strong>{stageName}</strong>
                    <small>{stagePosition}</small>
                  </span>
                </td>
                <td><span className={css.projectListValue}>{schedule}</span></td>
                <td>
                  <span className={css.projectListSessions}>
                    <strong>{row.sessions}</strong>
                    <small>{row.runningSessions > 0 ? `${String(row.runningSessions)} 个运行中` : '无运行会话'}</small>
                  </span>
                </td>
                <td>
                  <span className={css.projectListHealth} data-health={health}>
                    <strong>{healthLabel}</strong>
                    <small>{healthDetail}</small>
                  </span>
                </td>
                <td>
                  {row.preview === undefined
                    ? <span className={css.projectListEmpty}>待登记下一节点</span>
                    : <span className={css.projectListMilestone}>
                      <strong>{row.preview.nextMilestone}</strong>
                      <small>{formatDate(row.preview.nextMilestoneDate)}</small>
                    </span>}
                </td>
                <td>
                  <button className={css.projectListAction} type="button" disabled={demo} onClick={() => { if (!demo) showProject(row.workspaceId) }}>
                    {labels.view}{!demo && <span aria-hidden="true">→</span>}
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function PortfolioOverview({ rows, realCount, activeSessions, pendingSchedules, sessionCount }: {
  readonly rows: readonly ProjectRow[]
  readonly realCount: number
  readonly activeSessions: number
  readonly pendingSchedules: number
  readonly sessionCount: number
}) {
  const counts = FDE_STAGES.map(definition => (
    rows.filter(row => portfolioStageId(row) === definition.id).length
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
        <span>项目组合预览</span>
        <h2>FDE 交付全景</h2>
        <p>一屏查看项目所处阶段、近期节奏和需要 FDE 介入的位置。</p>
        <div className={css.portfolioProjectCount}><strong>{rows.length}</strong><span>个项目构成当前组合预览</span></div>
        <div className={css.portfolioComposition}>
          <span><i data-kind="real" />当前可进入 {realCount}</span>
        </div>
        <dl>
          <div><dt>项目活动</dt><dd>{sessionCount}</dd></div>
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
          <div><strong>交付周期已登记</strong><p>{pendingSchedules} 个项目仍需确认周期</p></div>
        </article>
        <article>
          <div
            className={css.portfolioRing}
            style={{ '--metric-angle': `${String(sessionAngle)}deg` } as CSSProperties}
            aria-label={`运行中会话 ${String(activeSessions)}/${String(sessionCount)}`}
          ><span><strong>{activeSessions}</strong><small>/ {sessionCount}</small></span></div>
          <div><strong>当前活跃工作</strong><p>组合预览共 {sessionCount} 条项目活动记录</p></div>
        </article>
      </div>
    </section>
  )
}

function PortfolioCharts({ rows }: { readonly rows: readonly ProjectRow[] }) {
  const stageCounts = FDE_STAGES.map(definition => rows.filter((row) => {
    return portfolioStageId(row) === definition.id
  }).length)
  const stageMaximum = Math.max(1, ...stageCounts)
  const health = {
    stable: rows.filter(row => portfolioHealth(row) === 'stable').length,
    attention: rows.filter(row => portfolioHealth(row) === 'attention').length,
    risk: rows.filter(row => portfolioHealth(row) === 'risk').length,
  }
  const total = Math.max(1, rows.length)
  const stableAngle = health.stable / total * 360
  const attentionAngle = (health.stable + health.attention) / total * 360
  const demoRows = rows.filter(row => row.preview !== undefined)
  const weeklyActivity = Array.from({ length: 6 }, (_, index) => demoRows.reduce((sum, row) => (
    sum + (row.preview?.weeklyActivity[index] ?? 0)
  ), 0))
  const weeklyMaximum = Math.max(1, ...weeklyActivity)
  const trendWidth = 640
  const trendHeight = 136
  const trendPadding = 14
  const trendPoints = weeklyActivity.map((value, index) => ({
    value,
    x: trendPadding + index * (trendWidth - trendPadding * 2) / Math.max(1, weeklyActivity.length - 1),
    y: trendHeight - trendPadding - value / weeklyMaximum * (trendHeight - trendPadding * 2),
  }))
  const trendLine = trendPoints.map(point => `${String(point.x)},${String(point.y)}`).join(' ')
  const trendArea = `${String(trendPadding)},${String(trendHeight - trendPadding)} ${trendLine} ${String(trendWidth - trendPadding)},${String(trendHeight - trendPadding)}`
  const pendingDecisions = rows.reduce((sum, row) => sum + (row.preview?.pendingDecisions ?? (row.schedule.status === 'pending-confirmation' ? 1 : 0)), 0)
  const blockers = rows.reduce((sum, row) => sum + (row.preview?.blockers ?? (row.stage?.status === 'error' ? 1 : 0)), 0)
  return (
    <section className={css.portfolioCharts} aria-label="项目组合数据图表">
      <article className={css.stageDistributionCard} aria-label="项目阶段分布">
        <header>
          <div><span>阶段分布</span><h2>项目现在集中在哪</h2></div>
          <small>{rows.length} 个组合项目</small>
        </header>
        <div className={css.stageDistributionFlow} role="img" aria-label={`六阶段项目分布：${stageCounts.join('、')}`}>
          <span className={css.stageDistributionTrack} aria-hidden="true" />
          {FDE_STAGES.map((definition, index) => {
            const count = stageCounts[index] ?? 0
            return (
              <div key={definition.id} data-stage={definition.id} data-empty={count === 0 ? '' : undefined}>
                <span
                  className={css.stageBubble}
                  style={{ '--bubble-size': `${String(44 + count / stageMaximum * 36)}px` } as CSSProperties}
                >
                  <strong>{count}</strong>
                  <small>个项目</small>
                </span>
                <span className={css.stageBubbleCopy}>
                  <strong>{STAGE_NAMES[definition.id]}</strong>
                  <small>{STAGE_OUTPUT_LABELS[definition.id]}</small>
                </span>
              </div>
            )
          })}
        </div>
      </article>
      <article className={css.healthDistributionCard} aria-label="项目交付健康分布">
        <header><div><span>交付健康</span><h2>需要怎样介入</h2></div><small>按当前状态汇总</small></header>
        <div className={css.healthDistributionBody}>
          <div
            className={css.healthRing}
            style={{ '--stable-angle': `${String(stableAngle)}deg`, '--attention-angle': `${String(attentionAngle)}deg` } as CSSProperties}
            role="img"
            aria-label={`平稳 ${String(health.stable)}，需关注 ${String(health.attention)}，有阻塞 ${String(health.risk)}`}
          ><span><strong>{rows.length}</strong><small>组合项目</small></span></div>
          <dl>
            <div data-health="stable"><dt><i />进展平稳</dt><dd>{health.stable}</dd></div>
            <div data-health="attention"><dt><i />需要关注</dt><dd>{health.attention}</dd></div>
            <div data-health="risk"><dt><i />存在阻塞</dt><dd>{health.risk}</dd></div>
          </dl>
        </div>
      </article>
      <article className={css.activityTrendCard} aria-label="近六周项目动态">
        <header>
          <div><span>项目动态</span><h2>近六周协作节奏</h2><p>曲线汇总项目每周的对话、评审与交付记录次数，不代表完成率。</p></div>
        </header>
        <div className={css.activityTrendBody}>
          <div className={css.activityTrendPlot} role="img" aria-label={`近六周活动次数：${weeklyActivity.join('、')}`}>
            <svg viewBox={`0 0 ${String(trendWidth)} ${String(trendHeight)}`} preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id="fde-portfolio-trend-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              {[0.25, 0.5, 0.75, 1].map(position => (
                <line
                  key={position}
                  className={css.activityTrendGridLine}
                  x1={trendPadding}
                  x2={trendWidth - trendPadding}
                  y1={trendHeight - trendPadding - position * (trendHeight - trendPadding * 2)}
                  y2={trendHeight - trendPadding - position * (trendHeight - trendPadding * 2)}
                />
              ))}
              <polygon className={css.activityTrendArea} points={trendArea} />
              <polyline className={css.activityTrendLine} points={trendLine} />
              {trendPoints.map((point, index) => (
                <circle key={index} className={css.activityTrendPoint} cx={point.x} cy={point.y} r="5" />
              ))}
            </svg>
            <div className={css.activityTrendLabels}>
              {trendPoints.map((point, index) => (
                <span key={index}><strong>{point.value}</strong><small>第 {index + 1} 周</small></span>
              ))}
            </div>
          </div>
          <dl className={css.portfolioSignals}>
            <div><dt>待 FDE 决定</dt><dd>{pendingDecisions}</dd><small>方案、范围与验收口径</small></div>
            <div><dt>当前阻塞</dt><dd>{blockers}</dd><small>需协调后继续推进</small></div>
            <div><dt>近期交付节点</dt><dd>{demoRows.length}</dd><small>已登记下一节点</small></div>
          </dl>
        </div>
      </article>
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
    || (row.preview?.pendingDecisions ?? 0) > 0 || (row.preview?.blockers ?? 0) > 0
  ))
  const scheduledRows = rows
    .filter((row): row is ProjectRow & { schedule: { status: 'estimated'; startDate: string; endDate: string } } => row.schedule.status === 'estimated')
    .toSorted((left, right) => left.schedule.endDate.localeCompare(right.schedule.endDate))
  return (
    <section className={css.portfolioFocus} aria-label="工作台焦点">
      <section className={css.attentionFocus}>
        <header>
          <div><span>项目关注</span><h2>需要 FDE 介入</h2></div>
          <strong>{attentionRows.length}</strong>
        </header>
        {attentionRows.length === 0
          ? <div className={css.focusEmpty}>当前没有待确认周期或阶段读取异常。</div>
          : <div className={css.attentionList}>{attentionRows.slice(0, 4).map((row) => {
            const issues = [
              ...(row.schedule.status === 'pending-confirmation' ? ['交付周期待确认'] : []),
              ...(row.stage?.status === 'error' ? ['项目阶段读取失败'] : []),
              ...((row.preview?.pendingDecisions ?? 0) > 0 ? [`${String(row.preview?.pendingDecisions ?? 0)} 项待决定`] : []),
              ...((row.preview?.blockers ?? 0) > 0 ? [`${String(row.preview?.blockers ?? 0)} 项阻塞`] : []),
            ]
            const demo = isDemoProject(row)
            return (
              <button key={row.workspaceId} type="button" disabled={demo} data-demo={demo || undefined} onClick={() => { if (!demo) showProject(row.workspaceId) }}>
                <span className={css.attentionMark} aria-hidden="true">!</span>
                <span><strong>{row.title}</strong><small>{issues.join(' · ')}</small></span>
                {!demo && <span aria-hidden="true">→</span>}
              </button>
            )
          })}</div>}
      </section>
      <section className={css.scheduleFocus}>
        <header><div><span>交付节奏</span><h2>交付节点</h2></div><small>{scheduledRows.length} 个已确认</small></header>
        {scheduledRows.length === 0
          ? <div className={css.focusEmpty}>暂无已确认交付周期，可进入项目补充。</div>
          : <div className={css.scheduleFocusList}>{scheduledRows.slice(0, 4).map(row => (
            <button key={row.workspaceId} type="button" disabled={isDemoProject(row)} data-demo={isDemoProject(row) || undefined} onClick={() => { if (!isDemoProject(row)) showProject(row.workspaceId) }}>
              <span className={css.scheduleDate}><strong>{formatDate(row.schedule.endDate)}</strong><small>计划交付</small></span>
              <span><strong>{row.title}</strong><small>{formatDate(row.schedule.startDate)} — {formatDate(row.schedule.endDate)} · {stageLabel(row.stage, '阶段读取中', '阶段读取失败')}</small></span>
              {!isDemoProject(row) && <span aria-hidden="true">→</span>}
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
    rows.filter(row => portfolioStageId(row) === definition.id).length
  ))
  return (
    <section className={css.portfolioStageFilter} aria-label="标准 FDE 六阶段交付流程">
      <header>
        <div><span>标准交付流程</span><h2>六阶段从需求到验收</h2><p>所有项目遵循同一主线；点击阶段可筛选下方项目。</p></div>
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
                <em>{STAGE_OUTPUT_LABELS[definition.id]}</em>
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
          const demo = isDemoProject(row)
          return (
            <button key={row.workspaceId} type="button" className={css.timelineRow} disabled={demo} data-demo={demo || undefined} onClick={() => { if (!demo) showProject(row.workspaceId) }}>
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
  readonly currentStage: FdeProjectState | undefined
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
  readonly currentStage: FdeProjectState | undefined
}) {
  const viewedIndex = FDE_STAGES.findIndex(item => item.id === viewedStage)
  const currentIndex = currentStage === undefined ? -1 : currentStage === 'completed' ? FDE_STAGES.length : FDE_STAGES.findIndex(item => item.id === currentStage)
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

function validationMetricNormallySatisfied(metric: ValidationStageSnapshot['contract']['metrics'][number]): boolean {
  return metric.evidenceAvailable
    && (metric.status === 'PASS' || (metric.status === 'WARN' && metric.waiverReason !== undefined))
}

function validationIssueStatusLabel(status: ValidationStageSnapshot['contract']['issues'][number]['status']): string {
  if (status === 'resolved') return '已解决'
  if (status === 'waived') return '已人工接受'
  return '待处理'
}

function ValidationOutputs({
  workspaceId, currentStage, revision, validation, completeValidation, acceptValidationMetric, waiveValidationIssue, renderPreview,
}: {
  readonly workspaceId: string
  readonly currentStage: FdeProjectState
  readonly revision: number | undefined
  readonly validation: ValidationStageSnapshot
  readonly completeValidation: (revision: number) => Promise<void>
  readonly acceptValidationMetric: (contractDigest: string, metricId: string, reason: string) => Promise<void>
  readonly waiveValidationIssue: (contractDigest: string, issueId: string, reason: string) => Promise<void>
  readonly renderPreview: (source: ProjectPreviewFile) => React.ReactNode
}) {
  const [confirming, setConfirming] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | undefined>()
  const [metricDecision, setMetricDecision] = useState<{ readonly metricId: string; readonly reason: string } | undefined>()
  const [metricSubmitting, setMetricSubmitting] = useState(false)
  const [metricError, setMetricError] = useState<string | undefined>()
  const [issueDecision, setIssueDecision] = useState<{ readonly issueId: string; readonly reason: string } | undefined>()
  const [issueSubmitting, setIssueSubmitting] = useState(false)
  const [issueError, setIssueError] = useState<string | undefined>()
  useEffect(() => {
    setConfirming(false); setSubmitting(false); setError(undefined); setSelectedArtifactId(undefined)
    setMetricDecision(undefined); setMetricSubmitting(false); setMetricError(undefined)
    setIssueDecision(undefined); setIssueSubmitting(false); setIssueError(undefined)
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
            <thead><tr>
              <th>指标</th><th>类别</th><th>指标来源</th><th>阈值</th><th>结果</th><th>证据</th><th>FDE 决策</th>
            </tr></thead>
            <tbody>{validation.contract.metrics.map((metric) => {
              const normallySatisfied = validationMetricNormallySatisfied(metric)
              const canAccept = metric.required && !normallySatisfied && metric.manualAcceptance === undefined
              return <Fragment key={metric.id}>
                <tr>
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
                  <td className={css.validationMetricDecision}>
                    {metric.manualAcceptance !== undefined
                      ? <>
                        <span className={css.outputBadge}>已人工接受</span>
                        <small>{metric.manualAcceptance.reason}</small>
                        <small>{formatActivityTime(Date.parse(metric.manualAcceptance.acceptedAt))}</small>
                      </>
                      : canAccept
                        ? <button type="button" disabled={metricSubmitting} onClick={() => {
                          setMetricDecision({ metricId: metric.id, reason: '' })
                          setMetricError(undefined)
                        }}>人工接受指标</button>
                        : <span>{normallySatisfied ? '正常满足' : '无需决定'}</span>}
                  </td>
                </tr>
                {metricDecision?.metricId === metric.id && (
                  <tr className={css.validationMetricFormRow}>
                    <td colSpan={7}>
                      <form className={css.validationIssueForm} onSubmit={(event) => {
                        event.preventDefault()
                        const reason = metricDecision.reason.trim()
                        const contractDigest = validation.contract.digest
                        if (reason === '') {
                          setMetricError('请填写本次人工接受的原因、适用范围或后续处理约定。')
                          return
                        }
                        if (contractDigest === undefined) {
                          setMetricError('当前评估方案缺少有效摘要，请刷新后重试。')
                          return
                        }
                        setMetricSubmitting(true); setMetricError(undefined)
                        void acceptValidationMetric(contractDigest, metric.id, reason).then(
                          () => { setMetricDecision(undefined) },
                          (cause: unknown) => { setMetricError(cause instanceof Error ? cause.message : String(cause)) },
                        ).finally(() => { setMetricSubmitting(false) })
                      }}>
                        <div>
                          <strong>确认由 FDE 接受该指标当前结果</strong>
                          <p>此操作只解除这一项阻塞，不会把“{validationStatusLabel(metric.status)}”或缺少证据改成通过。</p>
                        </div>
                        <label>
                          <span>接受理由</span>
                          <textarea
                            rows={3}
                            maxLength={1_000}
                            value={metricDecision.reason}
                            disabled={metricSubmitting}
                            placeholder="说明接受原因、适用范围和后续处理约定"
                            onChange={(event) => { setMetricDecision({ metricId: metric.id, reason: event.currentTarget.value }) }}
                          />
                        </label>
                        {metricError === undefined ? null : <p className={css.validationIssueError}>{metricError}</p>}
                        <div className={css.validationIssueFormActions}>
                          <button type="button" disabled={metricSubmitting} onClick={() => { setMetricDecision(undefined); setMetricError(undefined) }}>取消</button>
                          <button type="submit" disabled={metricSubmitting}>{metricSubmitting ? '正在确认…' : '确认人工接受'}</button>
                        </div>
                      </form>
                    </td>
                  </tr>
                )}
              </Fragment>
            })}</tbody>
          </table></div>}
      </section>
      {validation.contract.issues.length > 0 && (
        <section className={css.developmentSection}>
          <header><div><h3>问题与接受决定</h3><p>未关闭的 critical/high 问题会阻止进入部署试运行。</p></div></header>
          <div className={css.outputList}>{validation.contract.issues.map(issue => (
            <div key={issue.id} className={`${css.outputItem} ${css.validationIssueItem}`} data-static data-status={issue.status === 'open' ? 'error' : 'present'}>
              <span className={css.outputIcon} aria-hidden="true">ISSUE</span>
              <div>
                <h3>{issue.title}</h3>
                <code>{issue.id}</code>
                <p className={css.outputMeta}>{issue.resolution ?? issue.evidence ?? '尚未记录处理说明或证据。'}</p>
                {issue.waiverReason === undefined ? null : <p className={css.issueWaiverSummary}>人工接受理由：{issue.waiverReason}</p>}
              </div>
              <div className={css.validationIssueActions}>
                <span className={css.outputBadge}>{issue.severity} · {validationIssueStatusLabel(issue.status)}</span>
                {issue.status === 'open' && (
                  <button type="button" disabled={issueSubmitting} onClick={() => {
                    setIssueDecision({ issueId: issue.id, reason: '' })
                    setIssueError(undefined)
                  }}>人工确认关闭</button>
                )}
              </div>
              {issueDecision?.issueId === issue.id && (
                <form className={css.validationIssueForm} onSubmit={(event) => {
                  event.preventDefault()
                  const reason = issueDecision.reason.trim()
                  const contractDigest = validation.contract.digest
                  if (reason === '') {
                    setIssueError('请填写本次人工接受的原因、范围或后续处理约定。')
                    return
                  }
                  if (contractDigest === undefined) {
                    setIssueError('当前评估方案缺少有效摘要，请刷新后重试。')
                    return
                  }
                  setIssueSubmitting(true); setIssueError(undefined)
                  void waiveValidationIssue(contractDigest, issue.id, reason).then(
                    () => { setIssueDecision(undefined) },
                    (cause: unknown) => { setIssueError(cause instanceof Error ? cause.message : String(cause)) },
                  ).finally(() => { setIssueSubmitting(false) })
                }}>
                  <div>
                    <strong>确认由 FDE 接受该问题风险</strong>
                    <p>此操作只关闭这一条问题，不会把未通过、未执行或缺少证据的指标改成通过。</p>
                  </div>
                  <label>
                    <span>接受理由</span>
                    <textarea
                      rows={3}
                      maxLength={1_000}
                      value={issueDecision.reason}
                      disabled={issueSubmitting}
                      placeholder="说明接受原因、适用范围和后续处理约定"
                      onChange={(event) => { setIssueDecision({ issueId: issue.id, reason: event.currentTarget.value }) }}
                    />
                  </label>
                  {issueError === undefined ? null : <p className={css.validationIssueError}>{issueError}</p>}
                  <div className={css.validationIssueFormActions}>
                    <button type="button" disabled={issueSubmitting} onClick={() => { setIssueDecision(undefined); setIssueError(undefined) }}>取消</button>
                    <button type="submit" disabled={issueSubmitting}>{issueSubmitting ? '正在确认…' : '确认接受并关闭'}</button>
                  </div>
                </form>
              )}
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

function CloseoutArtifactSection({
  title, description, artifacts, selectedArtifactId, selectArtifact,
}: {
  readonly title: string
  readonly description: string
  readonly artifacts: { readonly presentCount: number; readonly requiredCount: number; readonly items: readonly DeliveryCloseoutArtifact[] }
  readonly selectedArtifactId: string | undefined
  readonly selectArtifact: (artifactId: string) => void
}) {
  return (
    <section className={css.developmentSection}>
      <header><div><h3>{title}</h3><p>{description}</p></div><strong>{artifacts.presentCount}/{artifacts.requiredCount}</strong></header>
      <div className={css.outputList}>{artifacts.items.map((artifact) => {
        const previewable = artifact.status === 'present' && artifact.fileUrl !== undefined
        return <button
          key={artifact.id}
          type="button"
          className={css.outputItem}
          data-status={artifact.status}
          data-active={artifact.id === selectedArtifactId || undefined}
          disabled={!previewable}
          onClick={() => { if (previewable) selectArtifact(artifact.id) }}
          aria-label={previewable ? `预览${artifact.title}` : undefined}
        >
          <span className={css.outputIcon} aria-hidden="true">MD</span>
          <div><h3>{artifact.title}</h3><code>{artifact.path}</code>{artifact.message !== undefined && <p>{artifact.message}</p>}</div>
          <span className={css.outputBadge}>{artifact.status === 'present' ? '已有文件' : artifact.status === 'error' ? '读取失败' : '待生成'}</span>
        </button>
      })}</div>
    </section>
  )
}

const PILOT_EVIDENCE_LABELS: Readonly<Record<keyof DeploymentTrialStageSnapshot['contract']['evidence'], string>> = {
  validationBaseline: '验证基线',
  deployment: '部署执行',
  health: '健康检查',
  rollback: '回滚演练',
  trial: '试运行观察',
}

function pilotIssueStatusLabel(status: DeploymentTrialStageSnapshot['contract']['issues'][number]['status']): string {
  if (status === 'resolved') return '已解决'
  if (status === 'accepted') return '已人工接受'
  if (status === 'deferred') return '已延期'
  return '待处理'
}

function DeploymentTrialOutputs({
  workspaceId, currentStage, revision, deploymentTrial, completePilot, acceptIssue, confirmReadiness, renderPreview,
}: {
  readonly workspaceId: string
  readonly currentStage: FdeProjectState
  readonly revision: number | undefined
  readonly deploymentTrial: DeploymentTrialStageSnapshot
  readonly completePilot: (revision: number) => Promise<void>
  readonly acceptIssue: (contractDigest: string, issueId: string, reason: string) => Promise<void>
  readonly confirmReadiness: (contractDigest: string) => Promise<void>
  readonly renderPreview: (source: ProjectPreviewFile) => React.ReactNode
}) {
  const [confirming, setConfirming] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | undefined>()
  const [issueDecision, setIssueDecision] = useState<{ readonly issueId: string; readonly reason: string } | undefined>()
  const [issueSubmitting, setIssueSubmitting] = useState(false)
  const [issueError, setIssueError] = useState<string | undefined>()
  const [readinessConfirming, setReadinessConfirming] = useState(false)
  const [readinessSubmitting, setReadinessSubmitting] = useState(false)
  const [readinessError, setReadinessError] = useState<string | undefined>()
  useEffect(() => {
    setConfirming(false); setSubmitting(false); setError(undefined); setSelectedArtifactId(undefined)
    setIssueDecision(undefined); setIssueSubmitting(false); setIssueError(undefined)
    setReadinessConfirming(false); setReadinessSubmitting(false); setReadinessError(undefined)
  }, [currentStage, workspaceId])
  const selectedArtifact = deploymentTrial.artifacts.items.find((artifact): artifact is typeof artifact & { readonly fileUrl: string } => (
    artifact.id === selectedArtifactId && artifact.status === 'present' && artifact.fileUrl !== undefined
  ))
  const evidenceEntries = Object.entries(deploymentTrial.contract.evidence) as [
    keyof typeof PILOT_EVIDENCE_LABELS,
    { readonly path?: string; readonly available: boolean },
  ][]
  const evidenceReady = evidenceEntries.filter(([, evidence]) => evidence.available).length
  const needsReadinessConfirmation = deploymentTrial.contract.status === 'ready'
    && (deploymentTrial.contract.environment?.authorized !== true || deploymentTrial.contract.deploymentStatus !== 'ready')
  return (
    <section className={css.outputRoot}>
      <header className={css.outputHeader}>
        <div><span className={css.sectionEyebrow}>部署试运行 · 真实环境</span><h2>版本、环境与运行证据</h2><p>本地启动不等于部署完成；页面只汇总当前项目记录的授权、证据、问题和固定产物。</p></div>
        <strong>{deploymentTrial.gateReady ? '可提交' : `${String(deploymentTrial.blockers.length)} 个阻塞`}</strong>
      </header>
      <div className={css.developmentSummary}>
        <div><span>候选版本</span><strong>{deploymentTrial.contract.candidateVersion ?? '待登记'}</strong></div>
        <div><span>目标环境</span><strong>{deploymentTrial.contract.environment?.name ?? '待登记'}</strong></div>
        <div><span>环境授权</span><strong>{deploymentTrial.contract.environment?.authorized === true ? '已授权' : '未授权'}</strong></div>
        <div><span>试运行状态</span><strong>{deploymentTrial.contract.deploymentStatus ?? '未建立'}</strong></div>
        <div><span>证据齐备</span><strong>{evidenceReady}/5</strong></div>
        <div><span>阶段产物</span><strong>{deploymentTrial.artifacts.presentCount}/{deploymentTrial.artifacts.requiredCount}</strong></div>
      </div>
      {deploymentTrial.contract.status !== 'ready' && <div className={css.developmentIssues}>
        <p>{deploymentTrial.contract.message ?? '部署试运行状态尚未就绪。'}</p>
      </div>}
      {currentStage === 'pilot' && needsReadinessConfirmation && <div className={css.stageGate}>
        {!readinessConfirming
          ? <>
            <div>
              <strong>确认目标环境与试运行结论</strong>
              <p>{deploymentTrial.confirmationReady
                ? '五类证据、问题决定和四份产物已经齐备。请由 FDE 明确确认当前目标环境授权与本次试运行结论。'
                : '当前仍有运行证据、问题决定或阶段产物缺口，暂不能确认试运行结论。'}</p>
            </div>
            <button
              type="button"
              disabled={!deploymentTrial.confirmationReady || deploymentTrial.contract.digest === undefined}
              onClick={() => { setReadinessConfirming(true); setReadinessError(undefined) }}
            >确认目标环境与试运行结论</button>
          </>
          : <>
            <div>
              <strong>确认授权并记录试运行完成</strong>
              <p>我已核对当前候选版本、目标环境、五类证据和问题决定；确认当前目标环境已获授权，并认可本次试运行结论。此操作不会执行部署、停止或回滚。</p>
            </div>
            <div className={css.stageGateActions}>
              <button type="button" disabled={readinessSubmitting} onClick={() => { setReadinessConfirming(false); setReadinessError(undefined) }}>返回核对</button>
              <button type="button" disabled={readinessSubmitting || deploymentTrial.contract.digest === undefined} onClick={() => {
                const digest = deploymentTrial.contract.digest
                if (digest === undefined) return
                setReadinessSubmitting(true); setReadinessError(undefined)
                void confirmReadiness(digest).then(() => { setReadinessConfirming(false) }, (reason: unknown) => {
                  setReadinessError(reason instanceof Error ? reason.message : String(reason))
                }).finally(() => { setReadinessSubmitting(false) })
              }}>{readinessSubmitting ? '正在确认…' : '确认授权并标记试运行完成'}</button>
            </div></>}
        {readinessError !== undefined && <p className={css.stageGateError}>{readinessError}</p>}
      </div>}
      <section className={css.developmentSection}>
        <header><div><h3>部署与试运行证据</h3><p>每项证据都必须是当前项目中的可读取文件，并与候选版本和目标环境一致。</p></div><strong>{evidenceReady}/5</strong></header>
        <div className={css.tableScroll}><table className={css.dataTable}>
          <thead><tr><th>证据类型</th><th>项目内路径</th><th>状态</th></tr></thead>
          <tbody>{evidenceEntries.map(([key, evidence]) => <tr key={key}>
            <td><strong>{PILOT_EVIDENCE_LABELS[key]}</strong></td>
            <td><code>{evidence.path ?? '未登记'}</code></td>
            <td>
              <span className={css.reportStatus} data-status={evidence.available ? 'PASS' : 'NOT_RUN'}>
                {evidence.available ? '可读取' : '缺失'}
              </span>
            </td>
          </tr>)}</tbody>
        </table></div>
      </section>
      <section className={css.developmentSection}>
        <header>
          <div><h3>试运行问题</h3><p>critical/high 问题必须解决或由 FDE 明确接受；延期问题保留理由和责任人。</p></div>
          <strong>{deploymentTrial.contract.issues.length}</strong>
        </header>
        {deploymentTrial.contract.issues.length === 0
          ? <div className={css.outputState}>当前没有登记试运行问题。</div>
          : <div className={css.outputList}>{deploymentTrial.contract.issues.map(issue => (
            <div key={issue.id} className={`${css.outputItem} ${css.validationIssueItem}`} data-static data-status={issue.status === 'open' || issue.status === 'deferred' ? 'error' : 'present'}>
              <span className={css.outputIcon} aria-hidden="true">ISSUE</span>
              <div><h3>{issue.title}</h3><code>{issue.id}</code><p className={css.outputMeta}>{issue.resolution ?? issue.decisionReason ?? issue.evidence ?? '尚未记录处理说明。'}</p>{issue.owner === undefined ? null : <p>责任人：{issue.owner}</p>}</div>
              <div className={css.validationIssueActions}>
                <span className={css.outputBadge}>{issue.severity} · {pilotIssueStatusLabel(issue.status)}</span>
                {(issue.status === 'open' || issue.status === 'deferred') && <button type="button" disabled={issueSubmitting} onClick={() => {
                  setIssueDecision({ issueId: issue.id, reason: '' }); setIssueError(undefined)
                }}>人工接受风险</button>}
              </div>
              {issueDecision?.issueId === issue.id && <form className={css.validationIssueForm} onSubmit={(event) => {
                event.preventDefault()
                const reason = issueDecision.reason.trim()
                const digest = deploymentTrial.contract.digest
                if (reason === '') { setIssueError('请填写本次人工接受的原因、范围和后续处理约定。'); return }
                if (digest === undefined) { setIssueError('当前部署试运行状态缺少有效摘要，请刷新后重试。'); return }
                setIssueSubmitting(true); setIssueError(undefined)
                void acceptIssue(digest, issue.id, reason).then(
                  () => { setIssueDecision(undefined) },
                  (cause: unknown) => { setIssueError(cause instanceof Error ? cause.message : String(cause)) },
                ).finally(() => { setIssueSubmitting(false) })
              }}>
                <div><strong>确认由 FDE 接受该问题风险</strong><p>此操作只解除这一条问题的阻塞，不会改写部署、回滚或试运行证据。</p></div>
                <label><span>接受理由</span><textarea rows={3} maxLength={1_000} value={issueDecision.reason} disabled={issueSubmitting} placeholder="说明接受原因、适用范围和后续处理约定" onChange={(event) => {
                  setIssueDecision({ issueId: issue.id, reason: event.currentTarget.value })
                }} /></label>
                {issueError === undefined ? null : <p className={css.validationIssueError}>{issueError}</p>}
                <div className={css.validationIssueFormActions}>
                  <button type="button" disabled={issueSubmitting} onClick={() => { setIssueDecision(undefined); setIssueError(undefined) }}>取消</button>
                  <button type="submit" disabled={issueSubmitting}>{issueSubmitting ? '正在确认…' : '确认接受风险'}</button>
                </div>
              </form>}
            </div>
          ))}</div>}
      </section>
      <CloseoutArtifactSection
        title="部署试运行阶段产物"
        description="四份文件齐备只表示可以提交，不能代替真实运行证据和 FDE 决定。"
        artifacts={deploymentTrial.artifacts}
        selectedArtifactId={selectedArtifactId}
        selectArtifact={setSelectedArtifactId}
      />
      {selectedArtifact === undefined
        ? <div className={css.outputPreviewHint}>选择一份“已有文件”查看只读内容。</div>
        : <ArtifactPreview
          artifact={selectedArtifact}
          close={() => { setSelectedArtifactId(undefined) }}
          renderPreview={renderPreview}
        />}
      {deploymentTrial.blockers.length > 0 && <div className={css.developmentIssues}>
        {deploymentTrial.blockers.map(blocker => <p key={blocker}>{blocker}</p>)}
      </div>}
      {currentStage === 'pilot'
        ? <div className={css.stageGate}>
          {!confirming
            ? <>
              <div>
                <strong>由 FDE 决定是否进入验收移交</strong>
                <p>{deploymentTrial.gateReady
                  ? '版本、环境授权、五类证据、问题决定和四份产物均已齐备，请再次核对。'
                  : '当前仍有部署试运行阻塞项，请继续补证或处理问题。'}</p>
              </div>
              <button
                type="button"
                disabled={!deploymentTrial.gateReady || revision === undefined}
                onClick={() => { setConfirming(true); setError(undefined) }}
              >完成部署试运行</button>
            </>
            : <>
              <div>
                <strong>确认进入验收移交</strong>
                <p>我已核对候选版本、目标环境授权、部署与回滚证据、试运行观察、客户反馈、问题决定及四份阶段产物。</p>
              </div>
              <div className={css.stageGateActions}>
                <button type="button" disabled={submitting} onClick={() => { setConfirming(false); setError(undefined) }}>返回核对</button>
                <button type="button" disabled={submitting || revision === undefined} onClick={() => {
                  if (revision === undefined) return
                  setSubmitting(true); setError(undefined)
                  void completePilot(revision)
                    .then(() => { setConfirming(false) }, (reason: unknown) => {
                      setError(reason instanceof Error ? reason.message : String(reason))
                    })
                    .finally(() => { setSubmitting(false) })
                }}>{submitting ? '正在确认…' : '确认并进入验收移交'}</button>
              </div></>}
          {error !== undefined && <p className={css.stageGateError}>{error}</p>}
        </div>
        : <div className={css.stageConfirmed}>部署试运行已由 FDE 确认，项目当前处于“{STAGE_NAMES[currentStage]}”。</div>}
    </section>
  )
}

function acceptanceStatusLabel(status: 'pending' | 'accepted' | 'conditionally-accepted' | 'returned' | 'terminated'): string {
  if (status === 'accepted') return '验收通过'
  if (status === 'conditionally-accepted') return '带条件通过'
  if (status === 'returned') return '已退回'
  if (status === 'terminated') return '已终止'
  return '待验收'
}

function acceptanceDecisionFrom(contract: AcceptanceHandoverStageSnapshot['contract']): AcceptanceHandoverDecision {
  const handover = contract.handover
  return {
    acceptance: {
      status: contract.acceptance?.status ?? 'pending',
      summary: contract.acceptance?.summary ?? '等待企业验收结论。',
      evidence: contract.acceptance?.evidence.flatMap(item => item.path === undefined ? [] : [item.path]) ?? [],
    },
    deliverables: contract.deliverables.map(item => ({ id: item.id, available: item.available })),
    conditions: contract.conditions.map(condition => ({
      id: condition.id,
      status: condition.status,
      ...(condition.reason === undefined ? {} : { reason: condition.reason }),
      ...(condition.owner === undefined ? {} : { owner: condition.owner }),
      ...(condition.followUp === undefined ? {} : { followUp: condition.followUp }),
    })),
    handover: {
      trainingCompleted: handover?.trainingCompleted ?? false,
      accessResponsibilityTransferred: handover?.accessResponsibilityTransferred ?? false,
      operationsResponsibilityTransferred: handover?.operationsResponsibilityTransferred ?? false,
      evidence: handover?.evidence.flatMap(item => item.path === undefined ? [] : [item.path]) ?? [],
    },
  }
}

function decisionPaths(value: string): readonly string[] {
  return value.split(/\r?\n/u).map(item => item.trim()).filter(item => item !== '')
}

function validateAcceptanceDecision(decision: AcceptanceHandoverDecision): string | undefined {
  if (decision.acceptance.summary.trim() === '') return '请填写企业验收摘要。'
  if (decision.acceptance.status !== 'pending' && decision.acceptance.evidence.length === 0) return '记录企业验收结论时，至少关联一份项目内证据。'
  if (decision.acceptance.status === 'conditionally-accepted' && !decision.conditions.some(item => item.status === 'accepted')) {
    return '带条件通过至少需要一项“人工接受”的条件和后续安排。'
  }
  const incompleteCondition = decision.conditions.find(item => item.status === 'accepted' && (
    item.reason?.trim() === '' || item.reason === undefined
    || item.owner?.trim() === '' || item.owner === undefined
    || item.followUp?.trim() === '' || item.followUp === undefined
  ))
  if (incompleteCondition !== undefined) return `条件“${incompleteCondition.id}”还缺少接受理由、责任人或后续安排。`
  const transferred = decision.handover.trainingCompleted
    || decision.handover.accessResponsibilityTransferred
    || decision.handover.operationsResponsibilityTransferred
  if (transferred && decision.handover.evidence.length === 0) return '记录培训或责任移交完成时，至少关联一份项目内证据。'
  return undefined
}

function AcceptanceHandoverOutputs({
  workspaceId, currentStage, revision, acceptanceHandover, completeHandoff, recordDecision, renderPreview,
}: {
  readonly workspaceId: string
  readonly currentStage: FdeProjectState
  readonly revision: number | undefined
  readonly acceptanceHandover: AcceptanceHandoverStageSnapshot
  readonly completeHandoff: (revision: number) => Promise<void>
  readonly recordDecision: (contractDigest: string, decision: AcceptanceHandoverDecision) => Promise<void>
  readonly renderPreview: (source: ProjectPreviewFile) => React.ReactNode
}) {
  const contract = acceptanceHandover.contract
  const [confirming, setConfirming] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | undefined>()
  const [decisionOpen, setDecisionOpen] = useState(false)
  const [decisionDraft, setDecisionDraft] = useState<AcceptanceHandoverDecision | undefined>()
  const [decisionSubmitting, setDecisionSubmitting] = useState(false)
  const [decisionError, setDecisionError] = useState<string | undefined>()
  useEffect(() => {
    setConfirming(false); setSubmitting(false); setError(undefined); setSelectedArtifactId(undefined)
    setDecisionOpen(false); setDecisionDraft(undefined); setDecisionSubmitting(false); setDecisionError(undefined)
  }, [contract.digest, currentStage, workspaceId])
  const selectedArtifact = acceptanceHandover.artifacts.items.find(
    (artifact): artifact is typeof artifact & { readonly fileUrl: string } => (
      artifact.id === selectedArtifactId && artifact.status === 'present' && artifact.fileUrl !== undefined
    ),
  )
  const availableDeliverables = contract.deliverables.filter(item => item.available).length
  const handoverFacts = contract.handover === undefined ? [] : [
    ['培训完成', contract.handover.trainingCompleted],
    ['权限责任移交', contract.handover.accessResponsibilityTransferred],
    ['运维责任移交', contract.handover.operationsResponsibilityTransferred],
  ] as const
  return (
    <section className={css.outputRoot}>
      <header className={css.outputHeader}>
        <div>
          <span className={css.sectionEyebrow}>验收移交 · 项目收口</span>
          <h2>最终交付与责任移交</h2>
          <p>统一引用前阶段事实和外部制品位置，不复制第二套结果；项目完成仍由 FDE 最终确认。</p>
        </div>
        <strong>{acceptanceHandover.gateReady ? '可完成' : `${String(acceptanceHandover.blockers.length)} 个阻塞`}</strong>
      </header>
      <div className={css.developmentSummary}>
        <div><span>最终版本</span><strong>{contract.finalVersion ?? '待登记'}</strong></div>
        <div><span>验收结论</span><strong>{contract.acceptance === undefined ? '待登记' : acceptanceStatusLabel(contract.acceptance.status)}</strong></div>
        <div><span>交付物可取得</span><strong>{availableDeliverables}/{contract.deliverables.length}</strong></div>
        <div><span>验收条件</span><strong>{contract.conditions.filter(item => item.status === 'open').length} 项待决定</strong></div>
        <div><span>责任移交</span><strong>{handoverFacts.filter(([, ready]) => ready).length}/3</strong></div>
        <div>
          <span>阶段产物</span>
          <strong>{acceptanceHandover.artifacts.presentCount}/{acceptanceHandover.artifacts.requiredCount}</strong>
        </div>
      </div>
      {contract.status !== 'ready' && <div className={css.developmentIssues}><p>{contract.message ?? '验收移交状态尚未就绪。'}</p></div>}
      {currentStage === 'handoff' && <section className={css.handoffDecisionPanel}>
        <header>
          <div><span>FDE 人工记录</span><h3>验收与移交事实</h3><p>按企业验收、交付物、条件项和责任移交逐步核对。保存只更新结构化事实，不会代替签字、上传制品、完成培训、变更权限或移交运维。</p></div>
          {!decisionOpen && <button type="button" disabled={contract.status !== 'ready' || contract.digest === undefined} onClick={() => {
            setDecisionDraft(acceptanceDecisionFrom(contract)); setDecisionOpen(true); setDecisionError(undefined)
          }}>记录验收与移交事实</button>}
        </header>
        {decisionOpen && decisionDraft !== undefined && <form className={css.handoffDecisionForm} onSubmit={(event) => {
          event.preventDefault()
          const validationError = validateAcceptanceDecision(decisionDraft)
          if (validationError !== undefined) { setDecisionError(validationError); return }
          const digest = contract.digest
          if (digest === undefined) { setDecisionError('当前验收移交状态缺少有效摘要，请刷新后重试。'); return }
          setDecisionSubmitting(true); setDecisionError(undefined)
          void recordDecision(digest, decisionDraft).then(() => {
            setDecisionOpen(false); setDecisionDraft(undefined)
          }, (cause: unknown) => {
            setDecisionError(cause instanceof Error ? cause.message : String(cause))
          }).finally(() => { setDecisionSubmitting(false) })
        }}>
          <fieldset disabled={decisionSubmitting}>
            <legend><span>1</span><div><strong>企业验收结论</strong><small>结论不是 Agent 推断，必须来自真实企业反馈，并关联项目内证据。</small></div></legend>
            <div className={css.handoffFieldGrid}>
              <label><span>验收状态</span><select aria-label="验收状态" value={decisionDraft.acceptance.status} onChange={(event) => {
                const status = event.currentTarget.value as AcceptanceHandoverDecision['acceptance']['status']
                setDecisionDraft(current => current === undefined ? current : { ...current, acceptance: { ...current.acceptance, status } })
              }}>
                <option value="pending">待验收</option><option value="accepted">验收通过</option><option value="conditionally-accepted">带条件通过</option><option value="returned">退回整改</option><option value="terminated">项目终止</option>
              </select></label>
              <label className={css.handoffWideField}><span>验收摘要</span><textarea aria-label="验收摘要" rows={3} maxLength={1_000} value={decisionDraft.acceptance.summary} onChange={(event) => {
                const summary = event.currentTarget.value
                setDecisionDraft(current => current === undefined
                  ? current
                  : { ...current, acceptance: { ...current.acceptance, summary } })
              }} /></label>
              <label className={css.handoffWideField}><span>验收证据路径（每行一份项目内文件）</span><textarea aria-label="验收证据路径" rows={3} value={decisionDraft.acceptance.evidence.join('\n')} placeholder="例如：customer-feedback/acceptance-record.md" onChange={(event) => {
                const evidence = decisionPaths(event.currentTarget.value)
                setDecisionDraft(current => current === undefined
                  ? current
                  : { ...current, acceptance: { ...current.acceptance, evidence } })
              }} /></label>
            </div>
          </fieldset>
          <fieldset disabled={decisionSubmitting}>
            <legend><span>2</span><div><strong>最终交付物</strong><small>只勾选客户当前确实可以取得的条目；项目文件还必须真实存在。</small></div></legend>
            {contract.deliverables.length === 0
              ? <p className={css.handoffEmpty}>当前结构化状态尚未登记交付物。</p>
              : <div className={css.handoffCheckList}>{contract.deliverables.map((item) => {
                const decision = decisionDraft.deliverables.find(candidate => candidate.id === item.id)
                return <label key={item.id}><input type="checkbox" checked={decision?.available === true} onChange={(event) => {
                  const available = event.currentTarget.checked
                  setDecisionDraft(current => current === undefined
                    ? current
                    : {
                      ...current,
                      deliverables: current.deliverables.map(candidate => (
                        candidate.id === item.id ? { ...candidate, available } : candidate
                      )),
                    })
                }} /><span><strong>{item.name}</strong><small>{item.location}</small></span></label>
              })}</div>}
          </fieldset>
          <fieldset disabled={decisionSubmitting}>
            <legend><span>3</span><div><strong>验收条件</strong><small>选择“人工接受”时，必须说明理由、责任人和后续安排。</small></div></legend>
            {contract.conditions.length === 0
              ? <p className={css.handoffEmpty}>当前没有附加验收条件。</p>
              : <div className={css.handoffConditionList}>{contract.conditions.map((condition) => {
                const decision = decisionDraft.conditions.find(candidate => candidate.id === condition.id)
                if (decision === undefined) return null
                return <article key={condition.id}>
                  <div><strong>{condition.title}</strong><small>{condition.id}</small></div>
                  <label><span>处理状态</span><select aria-label={`${condition.title}处理状态`} value={decision.status} onChange={(event) => {
                    const status = event.currentTarget.value as AcceptanceHandoverDecision['conditions'][number]['status']
                    setDecisionDraft(current => current === undefined
                      ? current
                      : {
                        ...current,
                        conditions: current.conditions.map(candidate => (
                          candidate.id === condition.id ? { ...candidate, status } : candidate
                        )),
                      })
                  }}><option value="open">待决定</option><option value="resolved">已解决</option><option value="accepted">人工接受</option></select></label>
                  {decision.status === 'accepted' && <div className={css.handoffConditionFields}>
                    <label><span>接受理由</span><input aria-label={`${condition.title}接受理由`} value={decision.reason ?? ''} onChange={(event) => {
                      const reason = event.currentTarget.value
                      setDecisionDraft(current => current === undefined
                        ? current
                        : {
                          ...current,
                          conditions: current.conditions.map(candidate => (
                            candidate.id === condition.id ? { ...candidate, reason } : candidate
                          )),
                        })
                    }} /></label>
                    <label><span>责任人</span><input aria-label={`${condition.title}责任人`} value={decision.owner ?? ''} onChange={(event) => {
                      const owner = event.currentTarget.value
                      setDecisionDraft(current => current === undefined
                        ? current
                        : {
                          ...current,
                          conditions: current.conditions.map(candidate => (
                            candidate.id === condition.id ? { ...candidate, owner } : candidate
                          )),
                        })
                    }} /></label>
                    <label><span>后续安排</span><input aria-label={`${condition.title}后续安排`} value={decision.followUp ?? ''} onChange={(event) => {
                      const followUp = event.currentTarget.value
                      setDecisionDraft(current => current === undefined
                        ? current
                        : {
                          ...current,
                          conditions: current.conditions.map(candidate => (
                            candidate.id === condition.id ? { ...candidate, followUp } : candidate
                          )),
                        })
                    }} /></label>
                  </div>}
                </article>
              })}</div>}
          </fieldset>
          <fieldset disabled={decisionSubmitting}>
            <legend><span>4</span><div><strong>培训与责任移交</strong><small>逐项记录真实完成状态，并关联培训或移交记录。</small></div></legend>
            <div className={css.handoffCheckList}>
              {([
                ['trainingCompleted', '培训已完成'],
                ['accessResponsibilityTransferred', '权限责任已移交'],
                ['operationsResponsibilityTransferred', '运维责任已移交'],
              ] as const).map(([key, label]) => <label key={key}><input type="checkbox" checked={decisionDraft.handover[key]} onChange={(event) => {
                const checked = event.currentTarget.checked
                setDecisionDraft(current => current === undefined
                  ? current
                  : { ...current, handover: { ...current.handover, [key]: checked } })
              }} /><span><strong>{label}</strong></span></label>)}
            </div>
            <label className={css.handoffEvidenceField}><span>移交证据路径（每行一份项目内文件）</span><textarea aria-label="移交证据路径" rows={3} value={decisionDraft.handover.evidence.join('\n')} placeholder="例如：handover/training-record.md" onChange={(event) => {
              const evidence = decisionPaths(event.currentTarget.value)
              setDecisionDraft(current => current === undefined ? current : { ...current, handover: { ...current.handover, evidence } })
            }} /></label>
          </fieldset>
          {decisionError !== undefined && <p className={css.handoffDecisionError}>{decisionError}</p>}
          <footer><p>保存后请继续核对页面阻塞项；只有全部事实齐备，独立的“完成验收移交”按钮才会启用。</p><div><button type="button" disabled={decisionSubmitting} onClick={() => { setDecisionOpen(false); setDecisionDraft(undefined); setDecisionError(undefined) }}>取消</button><button type="submit" disabled={decisionSubmitting}>{decisionSubmitting ? '正在保存…' : '保存验收与移交记录'}</button></div></footer>
        </form>}
      </section>}
      <section className={css.developmentSection}>
        <header>
          <div><h3>最终交付物</h3><p>外部制品只展示 FDE 记录的位置与可取得状态，平台不会主动上传、下载或探测。</p></div>
          <strong>{availableDeliverables}/{contract.deliverables.length}</strong>
        </header>
        {contract.deliverables.length === 0
          ? <div className={css.outputState}>尚未登记最终交付物。</div>
          : <div className={css.tableScroll}><table className={css.dataTable}>
            <thead><tr><th>交付物</th><th>版本</th><th>受控位置</th><th>校验值</th><th>状态</th></tr></thead>
            <tbody>{contract.deliverables.map(item => <tr key={item.id}>
              <td><strong>{item.name}</strong><small>{item.id}</small></td>
              <td>{item.version ?? '待登记'}</td>
              <td><code>{item.location}</code><small>{item.locationType === 'external' ? '外部位置' : '项目文件'}</small></td>
              <td><code>{item.checksum ?? '未登记'}</code></td>
              <td><span className={css.reportStatus} data-status={item.available ? 'PASS' : 'FAIL'}>{item.available ? '可取得' : '不可取得'}</span></td>
            </tr>)}</tbody>
          </table></div>}
      </section>
      <section className={css.developmentSection}>
        <header><div><h3>验收结论与条件</h3><p>{contract.acceptance?.summary ?? '尚未记录企业验收摘要。'}</p></div><strong>{contract.conditions.length}</strong></header>
        {contract.conditions.length === 0
          ? <div className={css.outputState}>当前没有登记附加验收条件。</div>
          : <div className={css.outputList}>{contract.conditions.map(condition => (
            <div key={condition.id} className={css.outputItem} data-static data-status={condition.status === 'open' ? 'error' : 'present'}>
              <span className={css.outputIcon} aria-hidden="true">TERM</span>
              <div><h3>{condition.title}</h3><code>{condition.id}</code><p className={css.outputMeta}>{[condition.reason, condition.owner, condition.followUp].filter(Boolean).join(' · ') || '尚未记录决定说明。'}</p></div>
              <span className={css.outputBadge}>{condition.status === 'resolved' ? '已解决' : condition.status === 'accepted' ? '已接受' : '待决定'}</span>
            </div>
          ))}</div>}
      </section>
      <section className={css.developmentSection}>
        <header>
          <div><h3>培训与责任移交</h3><p>只有培训、权限责任和运维责任都完成并留下项目内证据，才具备最终提交条件。</p></div>
          <strong>{handoverFacts.filter(([, ready]) => ready).length}/3</strong>
        </header>
        <div className={css.developmentSummary}>{handoverFacts.length === 0
          ? <div><span>移交状态</span><strong>待登记</strong></div>
          : handoverFacts.map(([label, ready]) => <div key={label}><span>{label}</span><strong>{ready ? '已完成' : '未完成'}</strong></div>)}</div>
      </section>
      <CloseoutArtifactSection title="验收移交阶段产物" description="交付物清单、验收报告、运维使用手册和移交记录共同索引最终事实。" artifacts={acceptanceHandover.artifacts} selectedArtifactId={selectedArtifactId} selectArtifact={setSelectedArtifactId} />
      {selectedArtifact === undefined
        ? <div className={css.outputPreviewHint}>选择一份“已有文件”查看只读内容。</div>
        : <ArtifactPreview
          artifact={selectedArtifact}
          close={() => { setSelectedArtifactId(undefined) }}
          renderPreview={renderPreview}
        />}
      {acceptanceHandover.blockers.length > 0 && <div className={css.developmentIssues}>
        {acceptanceHandover.blockers.map(blocker => <p key={blocker}>{blocker}</p>)}
      </div>}
      {currentStage === 'handoff'
        ? <div className={css.stageGate}>
          {!confirming
            ? <>
              <div>
                <strong>由 FDE 决定是否完成项目</strong>
                <p>{acceptanceHandover.gateReady
                  ? '验收结论、最终交付物、条件项、责任移交和四份产物均已齐备，请进行最终核对。'
                  : '当前仍有验收移交阻塞项，不能完成项目。'}</p>
              </div>
              <button
                type="button"
                disabled={!acceptanceHandover.gateReady || revision === undefined}
                onClick={() => { setConfirming(true); setError(undefined) }}
              >完成验收移交</button>
            </>
            : <>
              <div>
                <strong>确认完成项目</strong>
                <p>我已核对最终版本、部署试运行基线、企业验收证据、全部交付物可取得状态、条件项、培训、权限和运维责任移交。</p>
              </div>
              <div className={css.stageGateActions}>
                <button type="button" disabled={submitting} onClick={() => { setConfirming(false); setError(undefined) }}>返回核对</button>
                <button type="button" disabled={submitting || revision === undefined} onClick={() => {
                  if (revision === undefined) return
                  setSubmitting(true); setError(undefined)
                  void completeHandoff(revision)
                    .then(() => { setConfirming(false) }, (reason: unknown) => {
                      setError(reason instanceof Error ? reason.message : String(reason))
                    })
                    .finally(() => { setSubmitting(false) })
                }}>{submitting ? '正在确认…' : '确认并完成项目'}</button>
              </div></>}
          {error !== undefined && <p className={css.stageGateError}>{error}</p>}
        </div>
        : <div className={css.stageConfirmed}>验收移交已由 FDE 确认，项目状态为“{STAGE_NAMES[currentStage]}”。</div>}
    </section>
  )
}

function StageOutputs({
  workspaceId, stage, viewedStage, surfaceState, completeRequirements, completeSolution,
  completeDevelopment, completeValidation, completePilot, completeHandoff, acceptValidationMetric,
  waiveValidationIssue, acceptDeploymentTrialIssue, confirmDeploymentTrialReadiness,
  recordAcceptanceHandoverDecision, reviewArchitecture, renderPreview,
}: {
  readonly workspaceId: string
  readonly stage: ProjectStageLoadState | undefined
  readonly viewedStage: FdeStageId
  readonly surfaceState: ProjectSurfaceLoadState | undefined
  readonly completeRequirements: (revision: number) => Promise<void>
  readonly completeSolution: (revision: number) => Promise<void>
  readonly completeDevelopment: (revision: number) => Promise<void>
  readonly completeValidation: (revision: number) => Promise<void>
  readonly completePilot: (revision: number) => Promise<void>
  readonly completeHandoff: (revision: number) => Promise<void>
  readonly acceptValidationMetric: (contractDigest: string, metricId: string, reason: string) => Promise<void>
  readonly waiveValidationIssue: (contractDigest: string, issueId: string, reason: string) => Promise<void>
  readonly acceptDeploymentTrialIssue: (contractDigest: string, issueId: string, reason: string) => Promise<void>
  readonly confirmDeploymentTrialReadiness: (contractDigest: string) => Promise<void>
  readonly recordAcceptanceHandoverDecision: (contractDigest: string, decision: AcceptanceHandoverDecision) => Promise<void>
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
      currentStage={currentStage as FdeProjectState}
      revision={stage?.status === 'ready' ? stage.value.revision : undefined}
      development={surfaceState.value.development}
      completeDevelopment={completeDevelopment}
      renderPreview={renderPreview}
    />
  }
  if (viewedStage === 'validation') {
    if (!stageReached(currentStage, 'validation')) {
      return <StageAvailability viewedStage={viewedStage} currentStage={currentStage} />
    }
    return <ValidationOutputs
      workspaceId={workspaceId}
      currentStage={currentStage as FdeProjectState}
      revision={stage?.status === 'ready' ? stage.value.revision : undefined}
      validation={surfaceState.value.validation}
      completeValidation={completeValidation}
      acceptValidationMetric={acceptValidationMetric}
      waiveValidationIssue={waiveValidationIssue}
      renderPreview={renderPreview}
    />
  }
  if (viewedStage === 'pilot') {
    if (!stageReached(currentStage, 'pilot')) return <StageAvailability viewedStage={viewedStage} currentStage={currentStage} />
    return <DeploymentTrialOutputs
      workspaceId={workspaceId}
      currentStage={currentStage as FdeProjectState}
      revision={stage?.status === 'ready' ? stage.value.revision : undefined}
      deploymentTrial={surfaceState.value.deploymentTrial}
      completePilot={completePilot}
      acceptIssue={acceptDeploymentTrialIssue}
      confirmReadiness={confirmDeploymentTrialReadiness}
      renderPreview={renderPreview}
    />
  }
  if (viewedStage === 'handoff') {
    if (!stageReached(currentStage, 'handoff')) return <StageAvailability viewedStage={viewedStage} currentStage={currentStage} />
    return <AcceptanceHandoverOutputs
      workspaceId={workspaceId}
      currentStage={currentStage as FdeProjectState}
      revision={stage?.status === 'ready' ? stage.value.revision : undefined}
      acceptanceHandover={surfaceState.value.acceptanceHandover}
      completeHandoff={completeHandoff}
      recordDecision={recordAcceptanceHandoverDecision}
      renderPreview={renderPreview}
    />
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
      {currentStage !== undefined && currentStage !== viewedStage && stageReached(currentStage, viewedStage) && (
        <div className={css.stageConfirmed}>{STAGE_NAMES[viewedStage]}已由 FDE 确认，项目当前处于“{STAGE_NAMES[currentStage]}”。</div>
      )}
    </section>
  )
}

function ProjectDetail({
  row, sourceState, surfaceState, wikiState, selectedSource, selectSource, parseSource,
  prepareWiki, startWiki, abandonWiki, refreshWiki, completeRequirements, completeSolution,
  completeDevelopment, completeValidation, completePilot, completeHandoff, returnToPrevious,
  acceptValidationMetric, waiveValidationIssue,
  acceptDeploymentTrialIssue, confirmDeploymentTrialReadiness, recordAcceptanceHandoverDecision,
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
  readonly completePilot: (revision: number) => Promise<void>
  readonly completeHandoff: (revision: number) => Promise<void>
  readonly returnToPrevious: (revision: number, reason: string) => Promise<void>
  readonly acceptValidationMetric: (contractDigest: string, metricId: string, reason: string) => Promise<void>
  readonly waiveValidationIssue: (contractDigest: string, issueId: string, reason: string) => Promise<void>
  readonly acceptDeploymentTrialIssue: (contractDigest: string, issueId: string, reason: string) => Promise<void>
  readonly confirmDeploymentTrialReadiness: (contractDigest: string) => Promise<void>
  readonly recordAcceptanceHandoverDecision: (contractDigest: string, decision: AcceptanceHandoverDecision) => Promise<void>
  readonly reviewArchitecture: () => Promise<void>
  readonly enterProject: () => void
  readonly back: () => void
  readonly renderPreview: (source: ProjectPreviewFile) => React.ReactNode
}) {
  const currentStage = row.stage?.status === 'ready' ? row.stage.value.currentStage : undefined
  const [viewedStage, setViewedStage] = useState<FdeStageId>(currentStage === 'completed' ? 'handoff' : currentStage ?? 'requirements')
  const [section, setSection] = useState<'inputs' | 'outputs' | 'wiki' | 'conflicts' | 'unknowns'>('inputs')
  const [returnOpen, setReturnOpen] = useState(false)
  const [returnReason, setReturnReason] = useState('')
  const [returnError, setReturnError] = useState<string | undefined>()
  const [returnSubmitting, setReturnSubmitting] = useState(false)
  useEffect(() => {
    const nextStage = currentStage === 'completed' ? 'handoff' : currentStage ?? 'requirements'
    setViewedStage(nextStage)
    setSection(nextStage === 'requirements' ? 'inputs' : 'outputs')
    setReturnOpen(false)
    setReturnReason('')
    setReturnError(undefined)
  }, [currentStage, row.workspaceId])
  const canParse = selectedSource !== undefined && ['pending', 'error', 'stale'].includes(selectedSource.parse.status)
  const openSource = (sourceId: string): void => { selectSource(sourceId); setViewedStage('requirements'); setSection('inputs') }
  const viewedIndex = FDE_STAGES.findIndex(item => item.id === viewedStage)
  const viewedState = stagePositionState(row.stage, viewedIndex)
  const validationReached = stageReached(currentStage, 'validation')
  const schedule = row.schedule.status === 'estimated'
    ? `${formatDate(row.schedule.startDate)} — ${formatDate(row.schedule.endDate)}`
    : '待确认'
  const outputCount = surfaceState?.status === 'ready'
    ? viewedStage === 'validation' && validationReached
      ? surfaceState.value.validation.artifacts.presentCount
      : viewedStage === 'pilot'
        ? surfaceState.value.deploymentTrial.artifacts.presentCount
        : viewedStage === 'handoff'
          ? surfaceState.value.acceptanceHandover.artifacts.presentCount
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
  const stageValue = row.stage?.status === 'ready' ? row.stage.value : undefined
  const returnTarget = currentStage === undefined ? undefined : previousStageOf(currentStage)
  const returnLabel = currentStage === 'completed' ? '重新打开项目' : '返回上一阶段'
  const latestReturn = stageValue?.returns?.[(stageValue.returns.length ?? 0) - 1]
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
          <div><dt>项目当前阶段</dt><dd>{currentStage === undefined ? stageLabel(row.stage, '读取中', '读取失败') : currentStage === 'completed' ? '六阶段已完成 · 项目已交付' : `第 ${String(currentStageIndex(row.stage) + 1)}/6 阶段 · ${STAGE_NAMES[currentStage]}`}</dd></div>
          <div><dt>交付周期</dt><dd>{schedule}</dd></div>
          <div><dt>项目会话</dt><dd>{row.sessions} 个{row.runningSessions > 0 ? ` · ${String(row.runningSessions)} 个运行中` : ''}</dd></div>
        </dl>
        <div className={css.detailActions}>
          {returnTarget !== undefined && <button
            type="button"
            className={css.returnStageButton}
            aria-expanded={returnOpen}
            onClick={() => { setReturnOpen(true); setReturnError(undefined) }}
          >{returnLabel}</button>}
          <button type="button" className={css.enterDeliveryButton} onClick={enterProject}>进入项目交付 <span aria-hidden="true">→</span></button>
        </div>
      </section>
      {returnOpen && stageValue !== undefined && returnTarget !== undefined && <section
        className={css.stageReturnPanel}
        aria-label={returnLabel}
      >
        <div>
          <span>{currentStage === 'completed' ? '重新打开到验收移交' : `返回至${STAGE_NAMES[returnTarget]}`}</span>
          <h2>请填写本次返回原因</h2>
          <p>系统会保留全部会话、文档、代码、报告和交付物；当前阶段之后的确认会失效，需要由 FDE 重新核对并逐阶段确认。</p>
        </div>
        <label>
          <span>返回原因</span>
          <textarea
            value={returnReason}
            maxLength={1000}
            placeholder="例如：客户补充需求，需要回到项目开发继续调整。"
            onChange={(event) => { setReturnReason(event.currentTarget.value); setReturnError(undefined) }}
          />
        </label>
        <div className={css.stageReturnActions}>
          <button type="button" disabled={returnSubmitting} onClick={() => {
            setReturnOpen(false)
            setReturnReason('')
            setReturnError(undefined)
          }}>取消</button>
          <button type="button" disabled={returnSubmitting || returnReason.trim() === ''} onClick={() => {
            setReturnSubmitting(true)
            setReturnError(undefined)
            void returnToPrevious(stageValue.revision, returnReason.trim()).catch((error: unknown) => {
              setReturnError(error instanceof Error ? error.message : String(error))
            }).finally(() => { setReturnSubmitting(false) })
          }}>{returnSubmitting ? '正在返回…' : `确认${returnLabel}`}</button>
        </div>
        {returnError !== undefined && <p className={css.stageReturnError} role="alert">{returnError}</p>}
      </section>}
      {latestReturn !== undefined && <aside className={css.stageReturnAudit}>
        <strong>最近一次阶段调整</strong>
        <span>{STAGE_NAMES[latestReturn.from]} → {STAGE_NAMES[latestReturn.to]}</span>
        <p>{latestReturn.reason}</p>
        <time dateTime={latestReturn.returnedAt}>{formatAuditTime(latestReturn.returnedAt)}</time>
      </aside>}
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
            completePilot={completePilot}
            completeHandoff={completeHandoff}
            acceptValidationMetric={acceptValidationMetric}
            waiveValidationIssue={waiveValidationIssue}
            acceptDeploymentTrialIssue={acceptDeploymentTrialIssue}
            confirmDeploymentTrialReadiness={confirmDeploymentTrialReadiness}
            recordAcceptanceHandoverDecision={recordAcceptanceHandoverDecision}
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
  completeRequirements, completeSolution, completeDevelopment, completeValidation, completePilot, completeHandoff, returnToPrevious,
  acceptValidationMetric, waiveValidationIssue, acceptDeploymentTrialIssue, confirmDeploymentTrialReadiness,
  recordAcceptanceHandoverDecision, closeProjectPage,
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
  const [projectCollectionView, setProjectCollectionView] = useState<'card' | 'list'>('list')
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
  const demoRows = useMemo(() => demoRowsFor(rows), [rows])
  const portfolioRows = useMemo<readonly ProjectRow[]>(() => [...rows, ...demoRows], [demoRows, rows])
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
  const pendingSchedules = portfolioRows.filter(row => row.schedule.status === 'pending-confirmation').length
  const activeSessions = portfolioRows.reduce((total, row) => total + row.runningSessions, 0)
  const sessionCount = portfolioRows.reduce((total, row) => total + row.sessions, 0)
  const filteredRows = stageFilter === 'all'
    ? portfolioRows
    : portfolioRows.filter(row => portfolioStageId(row) === stageFilter)
  const projectRowLabels: ProjectRowLabels = {
    companyMissing: t('progress.companyMissing'), scheduleMissing: t('progress.scheduleMissing'),
    view: t('progress.viewProject'), created: date => t('progress.createdAt', { date }),
    loading: t('progress.stageLoading'), failed: t('progress.stageError'),
  }

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
          completePilot={async (revision) => {
            try {
              await completePilot(detailRow.workspaceId, revision)
            } catch (error) {
              retryStage(detailRow.workspaceId)
              throw error
            }
          }}
          completeHandoff={async (revision) => {
            try {
              await completeHandoff(detailRow.workspaceId, revision)
            } catch (error) {
              retryStage(detailRow.workspaceId)
              throw error
            }
          }}
          returnToPrevious={async (revision, reason) => {
            try {
              await returnToPrevious(detailRow.workspaceId, revision, reason)
            } catch (error) {
              retryStage(detailRow.workspaceId)
              throw error
            }
          }}
          acceptValidationMetric={async (contractDigest, metricId, reason) => {
            await acceptValidationMetric(detailRow.workspaceId, contractDigest, metricId, reason)
          }}
          waiveValidationIssue={async (contractDigest, issueId, reason) => {
            await waiveValidationIssue(detailRow.workspaceId, contractDigest, issueId, reason)
          }}
          acceptDeploymentTrialIssue={async (contractDigest, issueId, reason) => {
            await acceptDeploymentTrialIssue(detailRow.workspaceId, contractDigest, issueId, reason)
          }}
          confirmDeploymentTrialReadiness={async (contractDigest) => {
            await confirmDeploymentTrialReadiness(detailRow.workspaceId, contractDigest)
          }}
          recordAcceptanceHandoverDecision={async (contractDigest, decision) => {
            await recordAcceptanceHandoverDecision(detailRow.workspaceId, contractDigest, decision)
          }}
          reviewArchitecture={async () => { await reviewProjectArchitecture(detailRow.workspaceId) }}
          enterProject={() => { void enterProject(detailRow.workspaceId) }}
          back={showProjectOverview}
          renderPreview={source => renderSlot('fde.project.source.preview', { source })}
        />
        : <main className={css.pageBody}>
          <PortfolioOverview
            rows={portfolioRows}
            realCount={rows.length}
            activeSessions={activeSessions}
            pendingSchedules={pendingSchedules}
            sessionCount={sessionCount}
          />
          {portfolioRows.length > 0 && <PortfolioCharts rows={portfolioRows} />}
          <PortfolioFocus rows={portfolioRows} activities={recentActivities} showProject={showProjectDetail} />
          <PortfolioStageFilter rows={portfolioRows} selectedStage={stageFilter} selectStage={setStageFilter} />
          <div className={css.pageToolbar}>
            <div>
              <h2>{stageFilter === 'all' ? '全部项目' : `${STAGE_NAMES[stageFilter]}项目`}</h2>
              <span>{stageFilter === 'all'
                ? demoRows.length === 0
                  ? '阶段来自项目记录，周期来自新建项目时填写的信息。'
                  : `共 ${String(portfolioRows.length)} 个项目，当前可进入 ${String(rows.length)} 个。`
                : `当前筛选出 ${String(filteredRows.length)} 个项目。`}</span>
            </div>
            <div className={css.projectViewControls}>
              {page.view === 'overview' && <div className={css.collectionViewSwitch} role="group" aria-label="项目展示方式">
                <button type="button" aria-pressed={projectCollectionView === 'card'} data-active={projectCollectionView === 'card' || undefined} onClick={() => { setProjectCollectionView('card') }}>
                  <svg aria-hidden="true" viewBox="0 0 14 14"><rect x="1.5" y="1.5" width="4" height="4" rx="0.8" /><rect x="8.5" y="1.5" width="4" height="4" rx="0.8" /><rect x="1.5" y="8.5" width="4" height="4" rx="0.8" /><rect x="8.5" y="8.5" width="4" height="4" rx="0.8" /></svg>卡片
                </button>
                <button type="button" aria-pressed={projectCollectionView === 'list'} data-active={projectCollectionView === 'list' || undefined} onClick={() => { setProjectCollectionView('list') }}>
                  <svg aria-hidden="true" viewBox="0 0 14 14"><circle cx="2.2" cy="3" r="0.9" /><circle cx="2.2" cy="7" r="0.9" /><circle cx="2.2" cy="11" r="0.9" /><path d="M5 3h7M5 7h7M5 11h7" /></svg>列表
                </button>
              </div>}
              <div className={css.segmented} role="group" aria-label="项目页面模式">
                <button type="button" data-active={page.view === 'overview' || undefined} onClick={showProjectOverview}>{t('progress.overview')}</button>
                <button type="button" data-active={page.view === 'timeline' || undefined} onClick={showProjectTimeline}>{t('progress.timeline')}</button>
              </div>
            </div>
          </div>
          {rows.length === 0
            ? <div className={css.pageEmpty}>{t('progress.empty')}</div>
            : filteredRows.length === 0
              ? <div className={css.pageEmpty}>当前阶段没有项目。</div>
              : page.view === 'timeline'
                ? <Timeline rows={filteredRows} showProject={showProjectDetail} todayLabel={t('progress.today')} />
                : projectCollectionView === 'list'
                  ? <ProjectList rows={filteredRows} showProject={showProjectDetail} labels={projectRowLabels} />
                  : <div className={css.projectGrid}>{filteredRows.map(row => (
                    <ProjectCard key={row.workspaceId} row={row} showProject={showProjectDetail} labels={projectRowLabels} />
                  ))}</div>}
          {Object.values(stages).some(stage => stage.status === 'error') && (
            <button type="button" className={css.retryAll} onClick={() => { for (const row of rows) if (row.stage?.status === 'error') retryStage(row.workspaceId) }}>重新读取失败的项目阶段</button>
          )}
        </main>}
    </div>
  )
}
