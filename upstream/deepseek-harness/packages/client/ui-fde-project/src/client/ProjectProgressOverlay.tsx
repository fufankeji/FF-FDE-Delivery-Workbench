/** Full Project Progress page beside the persistent project/session sidebar. */

import { Fragment, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
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
import { STAGE_NAMES } from './project-data.ts'
import type { ProjectMetadataValue } from '@deepseek-ai/dsh-client-ui-workspace/client'
import {
  FDE_STAGES,
  FDE_V2_STAGE_IDS,
  type FdeProjectState,
  type FdeStageId,
  type FdeV2StageId,
  type ProjectStageLoadState,
} from './stage-controller.ts'
import type { ProjectSourceItem, ProjectSourceLoadState } from './source-controller.ts'
import type { ProjectProgressOverlayProps } from './slots.ts'
import type { ProjectPreviewFile } from './slots.ts'
import { DeliveryHomepage } from './DeliveryHomepage.tsx'
import css from './project.module.css'

interface ProjectRow {
  readonly workspaceId: string
  readonly title: string
  readonly path: string
  readonly createdAt: string
  readonly sessions: number
  readonly runningSessions: number
  readonly latestSessionTitle?: string
  readonly latestActivityAt?: number
  readonly companyName: string
  readonly schedule: ProjectMetadataValue['schedule']
  readonly stage: ProjectStageLoadState | undefined
  readonly surface: ProjectSurfaceLoadState | undefined
}

interface ProjectRowLabels {
  readonly companyMissing: string
  readonly scheduleMissing: string
  readonly view: string
  readonly created: (date: string) => string
  readonly loading: string
  readonly failed: string
}

type ProjectPalette = 'blue' | 'green' | 'orange' | 'violet'

function projectPalette(title: string): ProjectPalette {
  const palettes: readonly ProjectPalette[] = ['blue', 'green', 'orange', 'violet']
  let hash = 0
  for (const character of title) hash = (hash * 31 + (character.codePointAt(0) ?? 0)) >>> 0
  return palettes[hash % palettes.length] as ProjectPalette
}

function ProjectMark({ title, palette, className }: {
  readonly title: string
  readonly palette: ProjectPalette
  readonly className: string
}) {
  const glyph = palette === 'green'
    ? <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 19V12M12 19V8M19 19V4" /></svg>
    : title.slice(0, 1).toUpperCase()
  return <span className={className} data-project-mark={palette} aria-hidden="true">{glyph}</span>
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

const V2_STAGE_NAMES: Readonly<Record<FdeV2StageId, string>> = {
  discovery: '发现高价值问题',
  definition: '定义结果、范围与责任',
  investigation: '调查现场条件',
  design: '设计方案与业务流程验证',
  evaluation: '运行 PoC 与 Eval',
  pilot: '企业集成与受控试点',
  production: '生产采用与验收交接',
  improvement: '持续改进与能力沉淀',
}

const LEGACY_TO_V2_STAGE: Readonly<Record<FdeProjectState, FdeV2StageId>> = {
  requirements: 'discovery',
  solution: 'definition',
  development: 'design',
  validation: 'evaluation',
  pilot: 'pilot',
  handoff: 'production',
  completed: 'improvement',
}

function currentV2Stage(stage: ProjectStageLoadState | undefined): FdeV2StageId | undefined {
  if (stage?.status !== 'ready') return undefined
  return stage.value.v2Stage ?? LEGACY_TO_V2_STAGE[stage.value.currentStage]
}

function currentV2StageIndex(stage: ProjectStageLoadState | undefined): number {
  const current = currentV2Stage(stage)
  return current === undefined ? -1 : FDE_V2_STAGE_IDS.indexOf(current)
}

function stageReached(currentStage: FdeProjectState | undefined, target: FdeStageId): boolean {
  if (currentStage === undefined) return false
  if (currentStage === 'completed') return true
  return FDE_STAGES.findIndex(item => item.id === currentStage) >= FDE_STAGES.findIndex(item => item.id === target)
}

function stageLabel(stage: ProjectStageLoadState | undefined, loading: string, failed: string): string {
  if (stage === undefined || stage.status === 'loading') return loading
  if (stage.status === 'error') return failed
  return V2_STAGE_NAMES[stage.value.v2Stage ?? LEGACY_TO_V2_STAGE[stage.value.currentStage]]
}

const STAGE_SUMMARIES: Readonly<Record<FdeStageId, string>> = {
  requirements: '梳理客户资料、业务目标、约束与待确认问题，形成可确认的需求基线。',
  solution: '把确认需求转为项目方案、研发计划、验收方式和可审阅的系统架构。',
  development: '按 Feature 推进实现，以任务证据、测试结果和交付交付文件记录真实研发状态。',
  validation: '围绕同一候选版本核对评估、测试、运行用量、风险和恢复证据。',
  pilot: '在客户环境进行受控试运行，记录运行问题、修复结果与上线边界。',
  handoff: '完成客户验收、交付材料、运行说明和后续责任移交。',
}

const V2_STAGE_SUMMARIES: Readonly<Record<FdeV2StageId, string>> = {
  discovery: '还原客户真实工作方式，找到值得继续投入且能够验证的业务问题。',
  definition: '明确业务结果、当前基线、交付范围、责任人和停止条件。',
  investigation: '核对数据、系统、接口、权限、安全要求和现场责任人。',
  design: '比较实现方式，明确系统边界，并先走通一条端到端业务链路。',
  evaluation: '用真实案例、明确指标和可追溯证据验证关键假设。',
  pilot: '完成企业集成和可靠性准备，在授权范围内运行受控试点。',
  production: '受控进入生产，推动实际使用，完成客户验收和责任移交。',
  improvement: '根据生产证据选择改进，验证后发布，并沉淀可复用能力。',
}

function portfolioStageId(row: ProjectRow): FdeV2StageId | undefined {
  if (row.stage?.status !== 'ready') return undefined
  return row.stage.value.v2Stage ?? LEGACY_TO_V2_STAGE[row.stage.value.currentStage]
}

function portfolioHealth(row: ProjectRow): 'stable' | 'attention' | 'risk' {
  const attention = projectAttention(row)
  if (attention?.kind === 'blocker' || attention?.kind === 'overdue') return 'risk'
  if (attention !== undefined) return 'attention'
  return 'stable'
}

interface ProjectNextAction {
  readonly reason: string
  readonly action: string
  readonly decisionOwner: string
}

interface ProjectAttention extends ProjectNextAction {
  readonly kind: 'blocker' | 'overdue' | 'review' | 'read-error'
  readonly label: string
  readonly priority: number
}

function projectAttention(row: ProjectRow): ProjectAttention | undefined {
  if (row.stage?.status === 'ready' && row.stage.value.currentStage === 'completed') return undefined
  if (row.stage?.status === 'error' || row.surface?.status === 'error') {
    return {
      kind: 'read-error', label: '读取失败', priority: 4,
      reason: row.stage?.status === 'error' ? row.stage.message : row.surface?.status === 'error' ? row.surface.message : '',
      action: '重新读取项目状态', decisionOwner: 'FDE 处理',
    }
  }
  if (row.stage?.status !== 'ready') return undefined

  const surface = row.surface?.status === 'ready' ? row.surface.value : undefined
  const state = row.stage.value
  const isV2 = state.lifecycleVersion === 2 || state.v2Stage !== undefined
  const stageId = state.v2Stage ?? LEGACY_TO_V2_STAGE[state.currentStage]
  const stage = isV2 && stageId !== 'discovery' ? surface?.v2Stages?.[stageId] : undefined
  if (stage?.stateStatus === 'invalid') return {
    kind: 'read-error', label: '阶段记录无效', priority: 4,
    reason: stage.message ?? '当前阶段记录未通过格式检查。', action: '检查并修复阶段记录', decisionOwner: 'FDE 处理',
  }
  const issues: { title: string; severe: boolean }[] = []
  let reviewReady = false
  if (isV2) {
    if (stage?.stateStatus === 'ready') {
      issues.push(...stage.blockers.filter(item => item.status === 'open').map(item => ({
        title: item.title, severe: item.severity === 'critical' || item.severity === 'high',
      })))
      issues.push(...stage.workItems.filter(item => item.status === 'blocked').map(item => ({ title: item.title, severe: false })))
      if (stage.evaluation?.status === 'ready' && stage.evaluation.testing.current) {
        issues.push(...stage.evaluation.testing.metrics.filter(item => item.status === 'FAIL').map(item => ({ title: item.title, severe: item.required })))
      }
      if (stage.delivery?.status === 'ready' && stage.delivery.versionCurrent) {
        issues.push(...stage.delivery.items.filter(item => item.status === 'failed' || item.status === 'blocked').map(item => ({ title: item.title, severe: item.required })))
      }
      reviewReady = stage.reviewReady
    }
    if (stageId === 'discovery') reviewReady = surface?.discovery?.reviewReady === true
  } else if (surface !== undefined) {
    const contract = state.currentStage === 'validation' ? surface.validation?.contract
      : state.currentStage === 'pilot' ? surface.deploymentTrial?.contract : undefined
    if (contract?.status === 'ready') {
      issues.push(...contract.issues.filter(item => item.status === 'open').map(item => ({
        title: item.title, severe: item.severity === 'critical' || item.severity === 'high',
      })))
    }
    if (state.currentStage === 'handoff' && surface.acceptanceHandover?.contract.status === 'ready') {
      issues.push(...surface.acceptanceHandover.contract.conditions.filter(item => item.status === 'open').map(item => ({ title: item.title, severe: false })))
    }
    reviewReady = state.currentStage === 'requirements' ? surface.discovery?.reviewReady === true
      : state.currentStage === 'solution' ? surface.architecture?.status === 'pending-confirmation'
        : state.currentStage === 'validation' ? surface.validation?.gateReady === true || (surface.validation?.planReady === true && (surface.validation.planApproval.status === 'pending' || surface.validation.planApproval.status === 'stale'))
          : state.currentStage === 'pilot' ? surface.deploymentTrial?.gateReady === true || surface.deploymentTrial?.confirmationReady === true
            : state.currentStage === 'handoff' ? surface.acceptanceHandover?.gateReady === true : false
  }

  const issue = issues.find(item => item.severe) ?? issues[0]
  const blocker: ProjectAttention | undefined = issue === undefined ? undefined : {
    kind: 'blocker', label: issue.severe ? '存在阻塞' : '有待处理问题', priority: issue.severe ? 0 : 2,
    reason: issue.title, action: '查看并处理已登记问题', decisionOwner: 'FDE 处理',
  }
  if (blocker?.priority === 0) return blocker
  if (row.schedule.status === 'estimated') {
    const end = row.schedule.endDate
    const date = new Date(`${end}T00:00:00`)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    // Metadata is browser-local; reject invalid dates instead of inferring an overdue delivery.
    if (/^\d{4}-\d{2}-\d{2}$/.test(end) && Number.isFinite(date.getTime())
      && date.getFullYear() === Number(end.slice(0, 4)) && date.getMonth() + 1 === Number(end.slice(5, 7)) && date.getDate() === Number(end.slice(8, 10))
      && date < today) {
      return {
        kind: 'overdue', label: '已过计划交付日', priority: 1,
        reason: `登记的计划结束日期为 ${end}，项目尚未完成。`,
        action: '核对交付进展与计划日期', decisionOwner: 'FDE 跟进',
      }
    }
  }
  if (blocker !== undefined) return blocker
  if (reviewReady) return {
    kind: 'review', label: '待你确认', priority: 3,
    reason: `${V2_STAGE_NAMES[stageId]}已有可供 FDE 审阅和确认的记录。`,
    action: '进入项目审阅并确认', decisionOwner: 'FDE 确认',
  }
  return undefined
}

function projectNextAction(row: ProjectRow): ProjectNextAction {
  const attention = projectAttention(row)
  if (attention !== undefined) return attention
  if (row.stage?.status === 'error') {
    return { reason: '项目阶段读取失败', action: '重新读取项目状态', decisionOwner: 'FDE 处理' }
  }
  if (row.schedule.status === 'pending-confirmation') {
    return { reason: '交付周期尚未确认', action: '补充项目周期与交付边界', decisionOwner: 'FDE 确认' }
  }
  if (row.stage === undefined || row.stage.status === 'loading') {
    return { reason: '正在同步项目阶段', action: '查看项目读取进展', decisionOwner: '系统读取' }
  }
  if (row.runningSessions > 0) {
    return { reason: `${String(row.runningSessions)} 个会话正在运行`, action: '查看当前工作进展', decisionOwner: 'FDE 跟进' }
  }
  const current = row.stage.value.v2Stage ?? LEGACY_TO_V2_STAGE[row.stage.value.currentStage]
  const actions: Readonly<Record<FdeV2StageId, string>> = {
    discovery: '补充现场事实并判断问题价值',
    definition: '确认结果、范围、责任与停止条件',
    investigation: '补齐数据、系统、权限与责任人信息',
    design: '审阅实现方式、系统边界与业务流程验证',
    evaluation: '运行验证并处理证据缺口',
    pilot: '核对集成准备并记录受控试点结果',
    production: '完成生产采用、客户验收与责任移交',
    improvement: '根据生产证据选择下一轮改进',
  }
  return {
    reason: `当前处于${V2_STAGE_NAMES[current]}`,
    action: actions[current],
    decisionOwner: 'FDE 确认',
  }
}

interface ProjectProgressFacts {
  readonly status: string
  readonly evidence: string
  readonly detail: string
}

function projectProgressFacts(row: ProjectRow): ProjectProgressFacts {
  if (row.stage?.status === 'error') {
    return { status: '阶段状态读取受阻', evidence: '没有把读取失败显示为零进度。', detail: '请先重新读取项目阶段。' }
  }
  if (row.stage === undefined || row.stage.status === 'loading') {
    return { status: '正在同步项目阶段', evidence: `${String(row.sessions)} 个项目会话已登记。`, detail: '完成读取后再给出阶段建议。' }
  }
  if (row.surface?.status === 'error') {
    return { status: '项目证据读取受阻', evidence: '阶段位置已读取，但交付文件与证据暂不可用。', detail: row.surface.message }
  }
  if (row.surface === undefined || row.surface.status === 'loading') {
    return { status: row.runningSessions > 0 ? 'AI FDE 正在执行' : '正在读取项目证据', evidence: `${String(row.sessions)} 个项目会话已登记。`, detail: row.runningSessions > 0 ? `${String(row.runningSessions)} 个会话正在运行。` : '读取完成后展示真实交付文件。' }
  }
  const surface = row.surface.value
  const currentV2 = row.stage.value.v2Stage ?? LEGACY_TO_V2_STAGE[row.stage.value.currentStage]
  const compatibleV2Stages = (surface as { readonly v2Stages?: typeof surface.v2Stages }).v2Stages
  const v2Surface = currentV2 === 'discovery' ? undefined : compatibleV2Stages?.[currentV2]
  if (v2Surface !== undefined) {
    return {
      status: row.runningSessions > 0 ? `AI FDE 正在处理${V2_STAGE_NAMES[currentV2]}` : `${V2_STAGE_NAMES[currentV2]}记录已同步`,
      evidence: `本阶段交付文件 ${String(v2Surface.presentCount)}/${String(v2Surface.requiredCount)}。`,
      detail: v2Surface.blockers.filter(blocker => blocker.status === 'open').length === 0
        ? v2Surface.reviewReady ? '材料已达到 FDE 评审条件。' : '当前没有已登记阻塞，仍需完成阶段工作。'
        : `${String(v2Surface.blockers.filter(blocker => blocker.status === 'open').length)} 个问题待处理。`,
    }
  }
  const stage = row.stage.value.currentStage
  if (stage === 'requirements') {
    return {
      status: row.runningSessions > 0 ? 'AI FDE 正在整理需求' : '需求事实已同步',
      evidence: `需求阶段交付文件 ${String(surface.requirements.presentCount)}/${String(surface.requirements.requiredCount)}。`,
      detail: `${String(row.sessions)} 个项目会话可继续补充客户上下文。`,
    }
  }
  if (stage === 'solution') {
    const solution = surface.solution
    const architecture = surface.architecture === null ? '架构尚未形成' : `架构 ${surface.architecture.status === 'confirmed' ? '已确认' : '待确认'}`
    return {
      status: row.runningSessions > 0 ? 'AI FDE 正在完善方案' : '方案事实已同步',
      evidence: solution === undefined ? '方案交付文件尚未读取。' : `方案阶段交付文件 ${String(solution.presentCount)}/${String(solution.requiredCount)}。`,
      detail: architecture,
    }
  }
  if (stage === 'development') {
    const development = surface.development
    const completedTasks = development?.features.reduce((total, feature) => total + feature.taskCompleted, 0) ?? 0
    const taskTotal = development?.features.reduce((total, feature) => total + feature.taskTotal, 0) ?? 0
    return {
      status: row.runningSessions > 0 ? 'AI FDE 正在执行开发任务' : '研发事实已同步',
      evidence: development === undefined ? '研发任务证据尚未读取。' : `Feature ${String(development.features.length)} 个，任务证据 ${String(completedTasks)}/${String(taskTotal)}。`,
      detail: surface.runtime.status === 'running' ? '项目当前正在运行。' : `运行状态：${surface.runtime.status}。`,
    }
  }
  if (stage === 'validation') {
    return {
      status: row.runningSessions > 0 ? 'AI FDE 正在执行验证' : '验证事实已同步',
      evidence: `必需指标 ${String(surface.validation.satisfiedMetricCount)}/${String(surface.validation.requiredMetricCount)}，阶段交付文件 ${String(surface.validation.artifacts.presentCount)}/${String(surface.validation.artifacts.requiredCount)}。`,
      detail: surface.validation.blockers.length === 0 ? '当前没有验证阻塞。' : `${String(surface.validation.blockers.length)} 个验证阻塞待处理。`,
    }
  }
  if (stage === 'pilot') {
    return {
      status: row.runningSessions > 0 ? 'AI FDE 正在记录试运行' : '试运行事实已同步',
      evidence: `试运行交付文件 ${String(surface.deploymentTrial.artifacts.presentCount)}/${String(surface.deploymentTrial.artifacts.requiredCount)}。`,
      detail: surface.deploymentTrial.blockers.length === 0 ? '当前没有试运行阻塞。' : `${String(surface.deploymentTrial.blockers.length)} 个试运行阻塞待处理。`,
    }
  }
  return {
    status: row.runningSessions > 0 ? 'AI FDE 正在整理验收材料' : '验收移交事实已同步',
    evidence: `验收移交交付文件 ${String(surface.acceptanceHandover.artifacts.presentCount)}/${String(surface.acceptanceHandover.artifacts.requiredCount)}。`,
    detail: surface.acceptanceHandover.blockers.length === 0 ? '当前没有移交阻塞。' : `${String(surface.acceptanceHandover.blockers.length)} 个移交阻塞待处理。`,
  }
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

function v2StagePositionState(stage: ProjectStageLoadState | undefined, index: number): 'unknown' | 'done' | 'current' | 'reconfirm' | 'pending' {
  const current = currentV2StageIndex(stage)
  if (current < 0) return 'unknown'
  if (index < current) return 'done'
  if (index === current) return 'current'
  if (stage?.status === 'ready' && stage.value.v2ReconfirmThrough !== undefined) {
    const boundary = FDE_V2_STAGE_IDS.indexOf(stage.value.v2ReconfirmThrough)
    if (index <= boundary) return 'reconfirm'
  }
  return 'pending'
}

function ProjectStagePath({ stage }: { readonly stage: ProjectStageLoadState | undefined }) {
  return (
    <ol className={css.projectStagePath} aria-label="项目八阶段位置">
      {FDE_V2_STAGE_IDS.map((stageId, index) => {
        const state = v2StagePositionState(stage, index)
        return (
          <li key={stageId} data-stage={stageId} data-state={state}>
            <span>{index + 1}</span>
            <strong>{V2_STAGE_NAMES[stageId]}</strong>
          </li>
        )
      })}
    </ol>
  )
}

const V2_TO_ARCHIVE_STAGE: Readonly<Record<FdeV2StageId, FdeStageId>> = {
  discovery: 'requirements',
  definition: 'solution',
  investigation: 'development',
  design: 'development',
  evaluation: 'validation',
  pilot: 'pilot',
  production: 'handoff',
  improvement: 'handoff',
}

function StageNavigator({ stage, viewedStage, selectStage }: {
  readonly stage: ProjectStageLoadState | undefined
  readonly viewedStage: FdeV2StageId
  readonly selectStage: (stage: FdeV2StageId) => void
}) {
  return (
    <nav className={css.stageNavigator} aria-label="八阶段交付地图">
      {FDE_V2_STAGE_IDS.map((stageId, index) => {
        const state = v2StagePositionState(stage, index)
        const active = viewedStage === stageId
        return (
          <button
            key={stageId}
            type="button"
            data-stage={stageId}
            data-state={state}
            data-active={active || undefined}
            aria-current={state === 'current' ? 'step' : undefined}
            aria-label={`查看阶段 ${String(index + 1)}：${V2_STAGE_NAMES[stageId]}`}
            onClick={() => { selectStage(stageId) }}
          >
            <span className={css.stageNavigatorNumber}>{index + 1}</span>
            <span className={css.stageNavigatorText}>
              <strong>{V2_STAGE_NAMES[stageId]}</strong>
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

function ProjectDeliverySummary({ row, sourceState, surfaceState }: {
  readonly row: ProjectRow
  readonly sourceState: ProjectSourceLoadState | undefined
  readonly surfaceState: ProjectSurfaceLoadState | undefined
}) {
  const snapshot = surfaceState?.status === 'ready' ? surfaceState.value : undefined
  const discovery = snapshot === undefined
    ? undefined
    : (snapshot as { readonly discovery?: typeof snapshot.discovery }).discovery
  const v2Stages = snapshot === undefined
    ? undefined
    : (snapshot as { readonly v2Stages?: typeof snapshot.v2Stages }).v2Stages
  const evidenceGroups = [
    {
      id: 'discovery', label: V2_STAGE_NAMES.discovery,
      present: discovery?.presentCount ?? snapshot?.requirements.presentCount ?? 0,
      total: discovery?.requiredCount ?? snapshot?.requirements.requiredCount ?? 0,
    },
    {
      id: 'definition', label: V2_STAGE_NAMES.definition,
      present: v2Stages?.definition.presentCount ?? snapshot?.solution?.presentCount ?? 0,
      total: v2Stages?.definition.requiredCount ?? snapshot?.solution?.requiredCount ?? 0,
    },
    ...(['investigation', 'design', 'evaluation', 'pilot', 'production', 'improvement'] as const).map(stageId => ({
      id: stageId,
      label: V2_STAGE_NAMES[stageId],
      present: v2Stages?.[stageId].presentCount ?? 0,
      total: v2Stages?.[stageId].requiredCount ?? 0,
    })),
  ] as const
  const evidencePresent = evidenceGroups.reduce((total, group) => total + group.present, 0)
  const evidenceTotal = evidenceGroups.reduce((total, group) => total + group.total, 0)
  const sources = sourceState?.files ?? []
  const parsedSources = sources.filter(source => source.parse.status === 'ready').length
  const current = currentV2Stage(row.stage)
  const currentSurface = current === undefined || current === 'discovery' ? undefined : v2Stages?.[current]
  const currentPresent = current === 'discovery' ? discovery?.presentCount ?? snapshot?.requirements.presentCount ?? 0 : currentSurface?.presentCount ?? 0
  const currentRequired = current === 'discovery' ? discovery?.requiredCount ?? snapshot?.requirements.requiredCount ?? 0 : currentSurface?.requiredCount ?? 0
  const openBlockers = current === 'discovery'
    ? discovery?.blockers.length ?? 0
    : currentSurface?.blockers.filter(blocker => blocker.status === 'open').length ?? 0
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
          <div><span>交付证据</span><h2>八阶段证据成熟度</h2></div>
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
        <header><div><span>当前证据</span><h2>输入、Artifact 与人工门</h2></div></header>
        <dl>
          <div><dt>客户资料</dt><dd>{sources.length}</dd></div>
          <div><dt>已识别</dt><dd>{parsedSources}</dd></div>
          <div><dt>本阶段记录</dt><dd>{currentPresent}<small> / {currentRequired}</small></dd></div>
          <div><dt>未决阻塞</dt><dd>{openBlockers}</dd></div>
          <div><dt>评估用例</dt><dd>{snapshot?.evaluation.casesCount ?? 0}</dd></div>
          <div><dt>评估报告</dt><dd>{snapshot?.evaluation.reports.length ?? 0}</dd></div>
        </dl>
      </section>
    </section>
  )
}

function ProjectCurrentFocus({ row, sourceState, surfaceState, enterProject }: {
  readonly row: ProjectRow
  readonly sourceState: ProjectSourceLoadState | undefined
  readonly surfaceState: ProjectSurfaceLoadState | undefined
  readonly enterProject: () => void
}) {
  const snapshot = surfaceState?.status === 'ready' ? surfaceState.value : undefined
  const discovery = snapshot === undefined
    ? undefined
    : (snapshot as { readonly discovery?: typeof snapshot.discovery }).discovery
  const v2Stages = snapshot === undefined
    ? undefined
    : (snapshot as { readonly v2Stages?: typeof snapshot.v2Stages }).v2Stages
  const stage = currentV2Stage(row.stage)
  const stageIndex = stage === undefined ? -1 : FDE_V2_STAGE_IDS.indexOf(stage)
  const later = stage === undefined || stage === 'discovery' ? undefined : v2Stages?.[stage]
  const workItems = stage === 'discovery' ? discovery?.workItems : later?.workItems
  const currentWork = workItems?.find(item => item.status === 'current') ?? workItems?.find(item => item.status === 'waiting')
  const present = stage === 'discovery' ? discovery?.presentCount ?? snapshot?.requirements.presentCount ?? 0 : later?.presentCount ?? 0
  const required = stage === 'discovery' ? discovery?.requiredCount ?? snapshot?.requirements.requiredCount ?? 0 : later?.requiredCount ?? 0
  const blockers = stage === 'discovery'
    ? discovery?.blockers.length ?? 0
    : later?.blockers.filter(blocker => blocker.status === 'open').length ?? 0
  const reviewReady = stage === 'discovery' ? discovery?.reviewReady ?? false : later?.reviewReady ?? false
  const sources = sourceState?.files ?? []
  const parsedSources = sources.filter(source => source.parse.status === 'ready').length
  const action = projectNextAction(row)
  return (
    <section className={css.projectCurrentFocus} aria-label="当前阶段重点">
      <header>
        <div><span>当前阶段重点</span><h2>{stage === undefined ? '正在读取项目阶段' : V2_STAGE_NAMES[stage]}</h2></div>
        <strong>{stageIndex < 0 ? '—' : `${String(stageIndex + 1).padStart(2, '0')} / 08`}</strong>
      </header>
      <div className={css.projectCurrentFocusMain}>
        <p>{stage === undefined ? '完成阶段读取后再显示当前责任。' : V2_STAGE_SUMMARIES[stage]}</p>
        <ProjectStagePath stage={row.stage} />
        <dl>
          <div><dt>阶段输入</dt><dd>{sources.length} 份资料 · {parsedSources} 份已识别</dd></div>
          <div><dt>固定记录</dt><dd>{present}/{required}</dd></div>
          <div><dt>未决阻塞</dt><dd>{blockers === 0 ? '未登记' : `${String(blockers)} 项`}</dd></div>
          <div><dt>阶段评审</dt><dd>{reviewReady ? '可申请评审' : '继续补齐证据'}</dd></div>
        </dl>
      </div>
      <aside>
        <span>建议下一步</span>
        <h3>{currentWork?.title ?? action.action}</h3>
        <p>{currentWork?.purpose ?? action.reason}</p>
        <button type="button" onClick={enterProject}>进入项目交付 <span aria-hidden="true">→</span></button>
      </aside>
    </section>
  )
}

function ProjectDetailMetricIcon({ type }: { readonly type: 'stage' | 'schedule' | 'evidence' | 'sources' | 'records' }) {
  return <svg className={css.projectV2MetricIcon} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    {type === 'stage' && <><circle cx="16" cy="16" r="10" /><circle cx="16" cy="16" r="4" /><path d="m20 12 6-6M22 6h4v4" /></>}
    {type === 'schedule' && <><rect x="5" y="7" width="22" height="20" rx="3" /><path d="M10 4v6M22 4v6M5 13h22" /></>}
    {type === 'evidence' && <><path d="M16 3 27 7v8c0 7-4 11-11 14C9 26 5 22 5 15V7l11-4Z" /><path d="m11 16 3 3 7-7" /></>}
    {type === 'sources' && <><path d="M4 10h9l3 3h12v13H4V10Z" /><path d="M6 7h8l3 3" /></>}
    {type === 'records' && <><path d="M8 3h12l5 5v21H8V3Z" /><path d="M20 3v6h5M12 15h9M12 20h9M12 25h6" /></>}
  </svg>
}

function ProjectDetailDocumentArt() {
  return <svg className={css.projectV2DocumentArt} viewBox="0 0 150 150" fill="none" aria-hidden="true">
    <g transform="rotate(9 76 72)">
      <rect x="43" y="20" width="64" height="94" rx="9" fill="currentColor" opacity=".09" />
      <rect x="35" y="14" width="64" height="94" rx="9" fill="currentColor" opacity=".16" />
      <path d="M49 36h35M49 49h27M49 62h31M49 78h13v16H49zM67 85h17" stroke="currentColor" strokeWidth="5" strokeLinecap="round" opacity=".42" />
    </g>
    <g stroke="currentColor" opacity=".12"><ellipse cx="76" cy="122" rx="69" ry="20" /><ellipse cx="76" cy="122" rx="46" ry="12" /></g>
  </svg>
}

function ProjectStageFactIcon({ type }: { readonly type: 'input' | 'record' | 'blocker' | 'gate' }) {
  return <svg className={css.projectV2StageFactIcon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    {type === 'input' && <><path d="M5 18V8h5l2 3h7v7H5Z" /><path d="M5 14h14M8 5h6l2 3" /></>}
    {type === 'record' && <><rect x="6" y="5" width="13" height="15" rx="2" /><path d="M9 3h7v5H9zM10 12h5M10 16h5" /></>}
    {type === 'blocker' && <><path d="M12 3 21 20H3L12 3Z" /><path d="M12 9v5M12 17h.01" /></>}
    {type === 'gate' && <><circle cx="12" cy="8" r="4" /><path d="M4 21c.7-4.6 3.4-7 8-7s7.3 2.4 8 7M18 8h3M19.5 6.5v3" /></>}
  </svg>
}

function ProjectV2Detail({ row, sourceState, surfaceState, returnToPrevious, enterProject, back }: {
  readonly row: ProjectRow
  readonly sourceState: ProjectSourceLoadState | undefined
  readonly surfaceState: ProjectSurfaceLoadState | undefined
  readonly returnToPrevious: (revision: number, reason: string) => Promise<void>
  readonly enterProject: () => void
  readonly back: () => void
}) {
  const stageValue = row.stage?.status === 'ready' ? row.stage.value : undefined
  const currentStage = currentV2Stage(row.stage) ?? 'discovery'
  const currentStageIndex = FDE_V2_STAGE_IDS.indexOf(currentStage)
  const [viewedStage, setViewedStage] = useState<FdeV2StageId>(currentStage)
  const [returnOpen, setReturnOpen] = useState(false)
  const [returnReason, setReturnReason] = useState('')
  const [returnError, setReturnError] = useState<string>()
  const [returnSubmitting, setReturnSubmitting] = useState(false)
  useEffect(() => {
    setViewedStage(currentStage)
    setReturnOpen(false)
    setReturnReason('')
    setReturnError(undefined)
  }, [currentStage, row.workspaceId])
  const snapshot = surfaceState?.status === 'ready' ? surfaceState.value : undefined
  const discovery = snapshot?.discovery
  const v2Stages = snapshot?.v2Stages
  const later = viewedStage === 'discovery' ? undefined : v2Stages?.[viewedStage]
  const workItems: readonly { readonly id: string; readonly title: string; readonly purpose: string; readonly status: string }[] = viewedStage === 'discovery' ? discovery?.workItems ?? [] : later?.workItems ?? []
  const artifacts: readonly { readonly id: string; readonly title: string; readonly path: string; readonly purpose: string; readonly required: boolean; readonly status: 'missing' | 'present' | 'error' }[] = viewedStage === 'discovery' ? discovery?.artifacts ?? [] : later?.artifacts ?? []
  const blockers = viewedStage === 'discovery' ? discovery?.blockers ?? [] : later?.blockers.filter(blocker => blocker.status === 'open').map(blocker => blocker.title) ?? []
  const reviewBlockers = viewedStage === 'discovery' ? discovery?.blockers ?? [] : later?.reviewBlockers ?? []
  const presentCount = viewedStage === 'discovery' ? discovery?.presentCount ?? snapshot?.requirements.presentCount ?? 0 : later?.presentCount ?? 0
  const requiredCount = viewedStage === 'discovery' ? discovery?.requiredCount ?? snapshot?.requirements.requiredCount ?? 0 : later?.requiredCount ?? 0
  const reviewReady = viewedStage === 'discovery' ? discovery?.reviewReady ?? false : later?.reviewReady ?? false
  const recommendation = viewedStage === 'discovery' ? 'pending' : later?.recommendation ?? 'pending'
  const currentWork = workItems.find(item => item.status === 'current') ?? workItems.find(item => item.status === 'waiting')
  const completedWork = workItems.filter(item => item.status === 'complete').length
  const sources = sourceState?.files ?? []
  const parsedSources = sources.filter(source => source.parse.status === 'ready').length
  const allStageRecords = (discovery?.presentCount ?? snapshot?.requirements.presentCount ?? 0)
    + Object.values(v2Stages ?? {}).reduce((total, stage) => total + stage.presentCount, 0)
  const allRequiredRecords = (discovery?.requiredCount ?? snapshot?.requirements.requiredCount ?? 0)
    + Object.values(v2Stages ?? {}).reduce((total, stage) => total + stage.requiredCount, 0)
  const previousStageId = FDE_V2_STAGE_IDS[Math.max(0, FDE_V2_STAGE_IDS.indexOf(viewedStage) - 1)]
  const previousStage = previousStageId === 'discovery' ? discovery : previousStageId === undefined ? undefined : v2Stages?.[previousStageId]
  const inputCount = viewedStage === 'discovery' ? sources.length : previousStage?.presentCount ?? 0
  const schedule = row.schedule.status === 'estimated'
    ? `${formatDate(row.schedule.startDate)} — ${formatDate(row.schedule.endDate)}`
    : '待确认'
  const action = projectNextAction(row)
  const latestV2Return = stageValue?.v2Returns?.at(-1)
  const latestLegacyReturn = stageValue?.returns?.at(-1)
  const viewedIndex = FDE_V2_STAGE_IDS.indexOf(viewedStage)
  const viewedState = v2StagePositionState(row.stage, viewedIndex)
  const projectCompleted = stageValue?.currentStage === 'completed'
  const historical = viewedIndex < currentStageIndex
  const gateTitle = projectCompleted && viewedStage === currentStage
    ? '项目交付已由 FDE 确认'
    : historical ? '阶段记录已由 FDE 确认' : reviewReady ? '本阶段已具备 FDE 评审条件' : '本阶段仍需补齐证据'
  const gateDetail = projectCompleted && viewedStage === currentStage
    ? '项目状态为“项目已完成”；已有证据仍可用于后续改进。'
    : historical ? '该阶段已通过阶段评审，记录保持可追溯。' : reviewReady ? '固定记录和阻塞条件已满足，等待 FDE 最终决定。' : `${String(reviewBlockers.length)} 项条件仍待处理。`
  const returnLabel = stageValue?.currentStage === 'completed' ? '重新打开项目' : '返回上一阶段'
  const canReturn = stageValue !== undefined && stageValue.currentStage !== 'requirements'
  return (
    <main className={css.projectV2Detail} data-v2-project-detail="">
      <header className={css.projectV2Hero} data-v2-detail-hero="">
        <button type="button" className={css.projectV2Back} onClick={back}>←&nbsp; 全部项目</button>
        <div className={css.projectV2HeroMain}>
          <div className={css.projectV2Identity}>
            <span>单项目交付全景</span>
            <h1 data-v2-project-title="">{row.title}</h1>
            <p>{row.companyName || '未填写所属企业'}</p>
          </div>
          <dl className={css.projectV2HeroFacts} data-v2-hero-facts="">
            <div><dt>当前阶段</dt><dd>第 {String(currentStageIndex + 1)}/8 阶段 · {V2_STAGE_NAMES[currentStage]}</dd></div>
            <div><dt>交付周期</dt><dd>{schedule}</dd></div>
            <div><dt>项目会话</dt><dd>{row.sessions} 个{row.runningSessions > 0 ? ` · ${String(row.runningSessions)} 个运行中` : ''}</dd></div>
          </dl>
        </div>
        {latestV2Return !== undefined
          ? <p className={css.projectV2LatestReturn}>最近一次阶段调整：{V2_STAGE_NAMES[latestV2Return.from]} → {V2_STAGE_NAMES[latestV2Return.to]}</p>
          : latestLegacyReturn !== undefined && <p className={css.projectV2LatestReturn}>最近一次阶段调整：{latestLegacyReturn.from === 'completed' ? '项目完成' : STAGE_NAMES[latestLegacyReturn.from]} → {STAGE_NAMES[latestLegacyReturn.to]}</p>}
        <div className={css.projectV2Actions} data-v2-detail-actions="">
          {canReturn && <button type="button" onClick={() => { setReturnOpen(true) }}>{returnLabel}</button>}
          <button type="button" onClick={enterProject}>进入项目交付 <span aria-hidden="true">→</span></button>
        </div>
      </header>

      <section className={css.projectV2Metrics} data-v2-detail-metrics="" aria-label="项目关键状态">
        <article><ProjectDetailMetricIcon type="stage" /><div><span>当前阶段</span><strong>{String(currentStageIndex + 1).padStart(2, '0')} <small>/ 08</small></strong><p>{V2_STAGE_NAMES[currentStage]}</p></div></article>
        <article><ProjectDetailMetricIcon type="schedule" /><div><span>交付周期</span><strong>{schedule}</strong></div></article>
        <article><ProjectDetailMetricIcon type="evidence" /><div><span>交付证据</span><strong>{allStageRecords} <small>/ {allRequiredRecords}</small></strong><p>{allRequiredRecords === 0 ? '阶段合同读取中' : '固定记录真实汇总'}</p></div></article>
        <article><ProjectDetailMetricIcon type="sources" /><div><span>项目资料</span><strong>{sources.length} <small>份</small></strong><p>已识别 {parsedSources}</p></div></article>
        <article><ProjectDetailMetricIcon type="records" /><div><span>阶段记录</span><strong>{presentCount} <small>/ {requiredCount}</small></strong><p>未决阻塞 {blockers.length}</p></div></article>
      </section>

      {returnOpen && stageValue !== undefined && <section className={css.projectV2ReturnPanel} aria-label={returnLabel}>
        <label><span>返回原因</span><textarea value={returnReason} maxLength={1000} placeholder="说明为什么需要重新打开或返回阶段。" onChange={event => { setReturnReason(event.currentTarget.value); setReturnError(undefined) }} /></label>
        <div><button type="button" onClick={() => { setReturnOpen(false); setReturnReason('') }}>取消</button><button type="button" disabled={returnSubmitting || returnReason.trim() === ''} onClick={() => {
          setReturnSubmitting(true)
          void returnToPrevious(stageValue.revision, returnReason.trim()).catch(error => { setReturnError(error instanceof Error ? error.message : String(error)) }).finally(() => { setReturnSubmitting(false) })
        }}>{returnSubmitting ? '正在提交…' : `确认${returnLabel}`}</button></div>
        {returnError !== undefined && <p role="alert">{returnError}</p>}
      </section>}

      <div className={css.projectV2Main} data-v2-detail-main="">
        <aside className={css.projectV2StageRail} data-v2-stage-rail="">
          <header><span>阶段交付文件档案</span><h2>八阶段交付路径</h2><p>选择阶段，查看该阶段的真实记录与人工决定。</p></header>
          <StageNavigator stage={row.stage} viewedStage={viewedStage} selectStage={setViewedStage} />
        </aside>

        <section className={css.projectV2Workspace} data-v2-stage-workspace="">
          <header>
            <div><span>当前阶段里程碑 · {String(viewedIndex + 1).padStart(2, '0')} / 08</span><h2>{V2_STAGE_NAMES[viewedStage]}</h2><p>{V2_STAGE_SUMMARIES[viewedStage]}</p></div>
            <strong data-state={viewedState}>{stageStateLabel(viewedState)}</strong>
            <dl className={css.projectV2StageFacts} data-v2-stage-facts="">
              <div><dt><ProjectStageFactIcon type="input" />阶段输入</dt><dd>{inputCount} 项</dd><small>{viewedStage === 'discovery' ? `${String(parsedSources)} 份已识别` : '来自上一阶段固定记录'}</small></div>
              <div><dt><ProjectStageFactIcon type="record" />固定记录</dt><dd>{presentCount} / {requiredCount}</dd><small>只统计可读取 Artifact</small></div>
              <div><dt><ProjectStageFactIcon type="blocker" />未决阻塞</dt><dd>{blockers.length}</dd><small>{blockers.length === 0 ? '当前未登记阻塞' : '等待处理或人工决定'}</small></div>
              <div><dt><ProjectStageFactIcon type="gate" />阶段评审</dt><dd>{historical ? '已通过' : reviewReady ? '可评审' : '待补证据'}</dd><small>只有 FDE 可以改变阶段</small></div>
            </dl>
          </header>
          <section className={css.projectV2EvidenceCard}>
            <header><span>阶段证据门</span><h3>{currentWork?.title ?? `${V2_STAGE_NAMES[viewedStage]}记录`}</h3></header>
            <div className={css.projectV2GateKpis}>
              <div><span>STATUS</span><strong>{later?.status ?? discovery?.status ?? '读取中'}</strong></div>
              <div><span>ARTIFACT</span><strong>{presentCount}/{requiredCount}</strong></div>
              <div><span>BLOCKER</span><strong>{blockers.length}</strong></div>
              <div><span>RECOMMEND</span><strong>{recommendation}</strong></div>
            </div>
            <div className={css.projectV2Conditions}>
              <header><h3>阶段条件</h3><span>{reviewBlockers.length} 项待处理</span></header>
              <ul>{(reviewBlockers.length > 0 ? reviewBlockers : workItems.map(item => `${item.title}：${item.purpose}`)).slice(0, 5).map((item, index) => <li key={`${String(index)}-${item}`}><span>TERM</span><p>{item}</p><strong>{reviewBlockers.length > 0 ? '待处理' : '已登记'}</strong></li>)}</ul>
              {reviewBlockers.length === 0 && workItems.length === 0 && <p className={css.projectV2EmptyLine}>当前阶段尚未登记工作项或评审条件。</p>}
            </div>
          </section>
        </section>

        <aside className={css.projectV2ActionColumn} data-v2-action-column="">
          <section className={css.projectV2NextAction}>
            <ProjectDetailDocumentArt />
            <span>建议下一步</span><h2>{currentWork?.title ?? action.action}</h2><p>{currentWork?.purpose ?? action.reason}</p>
            <button type="button" onClick={enterProject}>进入项目交付 <span aria-hidden="true">→</span></button>
          </section>
          <section className={css.projectV2WorkItems}>
            <header><h3>本阶段工作项</h3><strong>{completedWork} / {workItems.length}</strong></header>
            <ul>{workItems.slice(0, 3).map(item => <li key={item.id} data-status={item.status}><i><svg viewBox="0 0 16 16" fill="none" aria-hidden="true">{item.status === 'complete' ? <path d="m3.5 8 3 3 6-6" /> : <circle cx="8" cy="8" r="2" fill="currentColor" stroke="none" />}</svg></i><span>{item.title}</span></li>)}</ul>
            {workItems.length === 0 && <p>尚未读取到阶段工作项。</p>}
          </section>
          <section className={css.projectV2Artifacts}>
            <header><h3>阶段交付文件</h3><strong>{presentCount} / {requiredCount}</strong></header>
            <div>{artifacts.slice(0, 4).map(artifact => <article key={artifact.id} data-status={artifact.status}><i><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M5 2.5h7l4 4v11H5v-15Z" /><path d="M12 2.5v4h4M8 11h5M8 14h5" /></svg></i><span><strong>{artifact.title}</strong><small>{artifact.status === 'present' ? '已有文件' : artifact.required ? '待形成' : '按需形成'}</small></span>{artifact.status === 'present' && <b aria-label="已有文件">✓</b>}</article>)}</div>
            {artifacts.length === 0 && <p>当前阶段尚未登记固定交付文件。</p>}
          </section>
        </aside>
      </div>

      <footer className={css.projectV2GateBanner} data-v2-gate-banner="" data-state={projectCompleted || historical ? 'complete' : reviewReady ? 'ready' : 'pending'}>
        <i aria-hidden="true">✓</i><div><strong>{gateTitle}</strong><span>{gateDetail}</span></div><button type="button" onClick={enterProject}>查看并继续 <span aria-hidden="true">→</span></button>
      </footer>
    </main>
  )
}

function StageVisualSummary({ viewedStage, sourceState, surfaceState }: {
  readonly viewedStage: FdeStageId
  readonly sourceState: ProjectSourceLoadState | undefined
  readonly surfaceState: ProjectSurfaceLoadState | undefined
}) {
  const snapshot = surfaceState?.status === 'ready' ? surfaceState.value : undefined
  const sources = sourceState?.files ?? []
  const parsedSources = sources.filter(source => source.parse.status === 'ready').length
  const development = snapshot?.development
  const taskTotal = development?.features.reduce((total, feature) => total + feature.taskTotal, 0) ?? 0
  const taskCompleted = development?.features.reduce((total, feature) => total + feature.taskCompleted, 0) ?? 0
  const latestEvaluation = snapshot?.evaluation.reports[0]
  if (viewedStage === 'requirements') {
    return (
      <section className={`${css.stageVisual} ${css.requirementsVisual}`} aria-label="需求调研数据链路">
        <header><span>需求调研链路</span><h3>原始资料如何沉淀为可确认需求</h3></header>
        <div className={css.requirementsFlow}>
          <article><span>01</span><strong>{sources.length}</strong><small>输入资料 · {parsedSources} 份已识别</small></article>
          <i aria-hidden="true">→</i>
          <article>
            <span>02</span><strong>{snapshot?.requirements.presentCount ?? 0}</strong>
            <small>阶段文件 · 共 {snapshot?.requirements.requiredCount ?? 0} 份</small>
          </article>
        </div>
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
            <span>研发交付文件</span>
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
        <p>{pilot?.contract.deploymentStatus === undefined ? '尚未建立试运行状态。' : `当前状态：${pilot.contract.deploymentStatus}；固定交付文件 ${String(pilot.artifacts.presentCount)}/${String(pilot.artifacts.requiredCount)}。`}</p>
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
          <strong>{handoff?.artifacts.presentCount ?? 0}/{handoff?.artifacts.requiredCount ?? 0} 固定交付文件</strong>
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

function ProjectList({ rows, showProject, labels, enterProject }: {
  readonly rows: readonly ProjectRow[]
  readonly showProject: (workspaceId: string) => void
  readonly labels: ProjectRowLabels
  readonly enterProject?: (workspaceId: string) => void
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
            const index = currentV2StageIndex(row.stage)
            const stageId = portfolioStageId(row) ?? 'discovery'
            const palette = projectPalette(row.title)
            const health = portfolioHealth(row)
            const attention = projectAttention(row)
            const nextAction = projectNextAction(row)
            const schedule = row.schedule.status === 'estimated'
              ? `${formatDate(row.schedule.startDate)} — ${formatDate(row.schedule.endDate)}`
              : labels.scheduleMissing
            const stageName = stageLabel(row.stage, labels.loading, labels.failed)
            const stagePosition = index < 0 ? '阶段待读取' : `阶段 ${String(index + 1)}/8`
            const healthLabel = attention?.label ?? (row.stage?.status !== 'ready' ? '阶段读取中'
              : row.stage.value.currentStage === 'completed' ? '项目已完成'
                : row.surface?.status !== 'ready' ? '资料读取中' : '暂无已登记待办')
            const healthDetail = attention?.reason ?? (row.runningSessions > 0
              ? `${String(row.runningSessions)} 个会话运行中` : '暂无运行会话')
            return (
              <tr key={row.workspaceId} className={css.projectListRow} data-stage={stageId} data-palette={palette}>
                <td>
                  <div className={css.projectListIdentity}>
                    <ProjectMark title={row.title ?? '未命名项目'} palette={palette} className={css.projectListMark!} />
                    <span>
                      <strong>{row.title}</strong>
                      <small>{row.companyName || labels.companyMissing}</small>
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
                  <span className={css.projectListMilestone}>
                    <strong>{nextAction.action}</strong>
                    <small>{nextAction.decisionOwner}</small>
                  </span>
                </td>
                <td>
                  {enterProject !== undefined
                    ? <div className={css.projectListActions}>
                      <button className={css.projectListSecondaryAction} type="button" onClick={() => { showProject(row.workspaceId) }}>查看交付文件</button>
                      <button className={css.projectListAction} type="button" onClick={() => { enterProject(row.workspaceId) }}>
                        进入项目<span aria-hidden="true">→</span>
                      </button>
                    </div>
                    : <button className={css.projectListAction} type="button" onClick={() => { showProject(row.workspaceId) }}>
                      {labels.view}<span aria-hidden="true">→</span>
                    </button>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ProjectArtwork({ hero = false, palette = 'blue' }: { readonly hero?: boolean; readonly palette?: ProjectPalette }) {
  const id = useId()
  return <svg viewBox={hero ? '0 0 380 240' : '0 0 120 126'} aria-hidden="true" data-project-art="" fill="none">
    <defs>
      <linearGradient id={`${id}-glass`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="currentColor" stopOpacity=".05" /><stop offset=".55" stopColor="currentColor" stopOpacity=".22" /><stop offset="1" stopColor="currentColor" stopOpacity=".65" /></linearGradient>
      <linearGradient id={`${id}-edge`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="currentColor" stopOpacity=".95" /><stop offset="1" stopColor="currentColor" stopOpacity=".15" /></linearGradient>
      <filter id={`${id}-glow`} x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="5" /></filter>
    </defs>
    {hero ? <>
      <path d="m22 163 165-77 173 83-156 66Z" stroke="currentColor" strokeOpacity=".4" fill={`url(#${id}-glass)`} />
      {[0,1,2,3,4].map(i => <path key={i} d={`M${42+i*29} ${154-i*14}l174 83M${53+i*33} ${178+i*15}l155-77`} stroke="currentColor" strokeOpacity=".15" />)}
      {[{x:185,y:19},{x:139,y:30},{x:83,y:54}].map(({x,y},i)=><g key={x}>
        <path d={`M${x} ${y+5}q0-10 10-6l104 42q8 3 8 12v126q0 10-9 6l-106-43q-7-3-7-11Z`} fill={`url(#${id}-glass)`} stroke={`url(#${id}-edge)`} strokeWidth="1.3" />
        <path d={`m${x+15} ${y+30} 68 28m-68-12 49 20m-49-3 60 24`} stroke="currentColor" strokeOpacity={.24+i*.1} strokeWidth="4" />
      </g>)}
      <path d="m109 103 37 15 17 22v44l-54-22Z" fill="currentColor" fillOpacity=".16" stroke="currentColor" strokeOpacity=".5" />
      <path d="m121 128 29 12m-29-2 24 10m-24 0 29 12" stroke="currentColor" strokeOpacity=".65" strokeWidth="4" />
      {[{x:51,y:186},{x:97,y:61},{x:305,y:195},{x:343,y:166}].map(p=><g key={p.x}><circle {...{cx:p.x,cy:p.y}} r="8" fill="currentColor" filter={`url(#${id}-glow)`} /><circle cx={p.x} cy={p.y} r="3" fill="currentColor" /></g>)}
    </> : <>
      <ellipse cx="61" cy="113" rx="42" ry="8" fill="currentColor" opacity=".1" />
      {[{x:43,y:10},{x:33,y:16},{x:22,y:24}].map(({x,y})=><path key={x} d={`M${x} ${y+7}q0-6 7-5l44 6q7 1 7 8v69q0 8-7 7l-44-7q-7-1-7-8Z`} fill={`url(#${id}-glass)`} stroke={`url(#${id}-edge)`} strokeWidth="2" />)}
      {palette==='green' ? <g fill="currentColor" opacity=".75"><rect x="34" y="70" width="7" height="15" rx="1" /><rect x="46" y="55" width="7" height="32" rx="1" /><rect x="58" y="42" width="7" height="47" rx="1" /></g> : palette==='violet' ? <g stroke="currentColor" strokeWidth="3"><path d="m35 45 29 4m-29 6 21 3" opacity=".5" /><circle cx="47" cy="73" r="11" /><path d="m55 82 11 13" strokeWidth="5" /></g> : <path d="m34 45 31 5m-31 7 31 5m-31 7 23 4m-23 7 27 4" stroke="currentColor" strokeOpacity=".65" strokeWidth="3" />}
    </>}
  </svg>
}

function ProjectAttentionCard({ row, showProject, enterProject }: {
  readonly row: ProjectRow
  readonly showProject: (workspaceId: string) => void
  readonly enterProject: (workspaceId: string) => void
}) {
  const action = projectNextAction(row)
  const attention = projectAttention(row)
  const progress = projectProgressFacts(row)
  const stageId = portfolioStageId(row) ?? 'discovery'
  const stage = stageLabel(row.stage, '阶段读取中', '阶段读取失败')
  const stageIndex = currentV2StageIndex(row.stage)
  const schedule = row.schedule.status === 'estimated'
    ? `${formatDate(row.schedule.startDate)} — ${formatDate(row.schedule.endDate)}`
    : '交付周期待确认'
  const palette = projectPalette(row.title)
  return (
    <article className={`${css.projectAttentionCard} ${css.projectCompactCard}`} data-project-card="" data-stage={stageId} data-palette={palette}>
      {attention !== undefined && <span className={css.projectPriorityRibbon} title={attention.reason}>{attention.label}</span>}
      <header>
        <div className={css.projectIdentity}>
          <ProjectMark title={row.title ?? '未命名项目'} palette={palette} className={css.projectMark!} />
          <div><h2 title={row.title}>{row.title}</h2><p>{row.companyName || '未填写所属企业'}</p></div>
        </div>
      </header>
      <div className={css.projectCompactMeta}><span><DashboardIcon kind="schedule" />{schedule}</span><span><DashboardIcon kind="sessions" />{row.sessions} 个会话{row.runningSessions > 0 && ` · ${row.runningSessions} 运行中`}</span></div>
      <div className={css.projectCompactProgress}>
        <div><span>当前阶段</span><b data-error={row.stage?.status === 'error' || undefined}>{stageIndex < 0 ? stage : `${stageIndex + 1}/8 · ${stage}`}</b></div>
        <strong title={`${progress.status}；${progress.evidence}；${progress.detail}`}>{progress.status}</strong>
        <p title={`${action.reason}；${action.action}`}>{attention?.reason ?? action.action}</p>
        <ProjectArtwork palette={palette} />
      </div>
      <div className={css.projectCompactSession}><span>最近会话</span><p title={row.latestSessionTitle}>{row.latestSessionTitle ?? '暂无项目会话'}</p></div>
      <footer className={css.projectCompactFooter}>
        <time>{row.latestActivityAt === undefined ? '暂无会话更新' : `${formatActivityTime(row.latestActivityAt)} 更新`}</time>
        <div className={css.projectAttentionActions}>
          <button type="button" onClick={() => { showProject(row.workspaceId) }}>查看交付文件</button>
          <button type="button" onClick={() => { enterProject(row.workspaceId) }}>进入项目 <span aria-hidden="true">→</span></button>
        </div>
      </footer>
    </article>
  )
}

function ProjectAttentionList({ rows, showProject, enterProject }: {
  readonly rows: readonly ProjectRow[]
  readonly showProject: (workspaceId: string) => void
  readonly enterProject: (workspaceId: string) => void
}) {
  return (
    <section className={css.projectAttention} aria-label="项目卡片">
      {rows.length === 0
        ? <div className={css.projectCenterEmpty}>当前范围内没有符合条件的项目，可切换到“全部项目”查看。</div>
        : <div className={css.projectAttentionCards}>{rows.map(row => (
          <ProjectAttentionCard key={row.workspaceId} row={row} showProject={showProject} enterProject={enterProject} />
        ))}</div>}
    </section>
  )
}

type DashboardIconKind = 'projects' | 'decisions' | 'sessions' | 'schedule' | 'attention' | 'filter' | 'sort'

function DashboardIcon({ kind }: { readonly kind: DashboardIconKind }) {
  if (kind === 'projects') {
    return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 8.5h16v10.25A1.25 1.25 0 0 1 18.75 20H5.25A1.25 1.25 0 0 1 4 18.75V8.5Z" /><path d="M8.5 8.5V6.25A1.25 1.25 0 0 1 9.75 5h4.5a1.25 1.25 0 0 1 1.25 1.25V8.5M4 12h16M12 10.5v3" /></svg>
  }
  if (kind === 'decisions') {
    return <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="10" cy="8" r="3" /><path d="M4.75 18.5c.65-3.1 2.4-4.65 5.25-4.65 1.6 0 2.85.48 3.75 1.45M17 10.5v5M14.5 13h5M16.25 19.5h1.5" /></svg>
  }
  if (kind === 'sessions') {
    return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5.25 6.25h13.5A2.25 2.25 0 0 1 21 8.5v6a2.25 2.25 0 0 1-2.25 2.25H11l-4.75 3v-3h-1A2.25 2.25 0 0 1 3 14.5v-6a2.25 2.25 0 0 1 2.25-2.25Z" /><circle cx="8" cy="11.5" r=".7" /><circle cx="12" cy="11.5" r=".7" /><circle cx="16" cy="11.5" r=".7" /></svg>
  }
  if (kind === 'schedule') {
    return <svg aria-hidden="true" viewBox="0 0 24 24"><rect x="4" y="5.5" width="16" height="14.5" rx="2" /><path d="M8 3.5v4M16 3.5v4M4 9.5h16M8 13h2M14 13h2M8 17h2M14 17h2" /></svg>
  }
  if (kind === 'attention') {
    return <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" /><path d="M12 7.5v5l3 1.75" /></svg>
  }
  if (kind === 'filter') {
    return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 6h16l-6.25 7v4.75L10.25 20v-7L4 6Z" /></svg>
  }
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M8 5v14M5 8l3-3 3 3M16 19V5M13 16l3 3 3-3" /></svg>
}

function Timeline({ rows, showProject, todayLabel }: {
  readonly rows: readonly ProjectRow[]
  readonly showProject: (workspaceId: string) => void
  readonly todayLabel: string
}) {
  const scheduled = rows.filter((row): row is ProjectRow & { schedule: { status: 'estimated'; startDate: string; endDate: string } } => row.schedule.status === 'estimated')
  if (scheduled.length === 0) return <div className={css.timelineEmpty}>还没有已登记交付周期的项目。</div>
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
      <button type="button" className={css.artifactPreviewScrim} aria-label="关闭交付文件预览" onClick={close} />
      <section className={css.outputPreviewPanel}>
        <header className={css.previewHeader}>
          <div><span className={css.previewEyebrow}>阶段交付文件 · 只读预览</span><h2>{artifact.title}</h2><span>{artifact.path}{artifact.bytes === undefined ? '' : ` · ${formatBytes(artifact.bytes)}`}</span></div>
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
            <dt>项目开发交付</dt><dd>{development.closure.presentCount}/{development.closure.requiredCount}</dd>
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
          <div><h3>项目开发交付交付文件</h3><p>三份文件齐备只表示可以提交；进入验证评估仍由 FDE 决定。</p></div>
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
              <div><strong>由 FDE 决定是否进入验证评估</strong><p>{ready ? '三份研发交付交付文件已经齐备，请核对版本、测试/评估证据、运行恢复和剩余风险。' : '研发交付交付文件尚未齐备，请回到项目交付继续开发和更新文件。'}</p></div>
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
      <div><strong>{future ? '尚未开始' : '暂无可核对的阶段专属交付文件'}</strong><p>{future ? '进入该阶段后，页面只会展示项目真实产生的状态与证据。' : '当前尚未读取到该阶段的交付文件；请进入项目交付继续工作或查看已经开放的业务页面。'}</p></div>
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
        <div><h2>评估方案、执行与交付文件</h2><p>从已确认文档建立评估方案，由 FDE 确认后再执行；结果只读取真实指标与项目内证据。</p></div>
        <strong>{validation.satisfiedMetricCount}/{validation.requiredMetricCount} 个必需指标</strong>
      </header>
      <div className={css.developmentSummary}>
        <div><span>候选版本</span><strong>{validation.contract.candidateId ?? '待登记'}</strong></div>
        <div><span>验证环境</span><strong>{validation.contract.environment ?? '待登记'}</strong></div>
        <div><span>数据/用例</span><strong>{validation.contract.datasets.length}</strong></div>
        <div><span>方案确认</span><strong>{validation.planApproval.status === 'confirmed' ? '已确认' : validation.planApproval.status === 'stale' ? '需重新确认' : validation.planReady ? '待 FDE 确认' : '方案未就绪'}</strong></div>
        <div><span>阶段交付文件</span><strong>{validation.artifacts.presentCount}/{validation.artifacts.requiredCount}</strong></div>
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
          <div><h3>验证评估阶段交付文件</h3><p>验证计划、验证报告和验证基线齐备只表示可以提交；进入部署试运行仍由 FDE 决定。</p></div>
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
              <div><strong>由 FDE 决定是否进入部署试运行</strong><p>{validation.gateReady ? '验证合同、必需指标证据和三份固定交付文件已经齐备，请核对候选版本、接受风险和剩余问题。' : '当前仍有验证阻塞项，请继续执行验证并更新合同和阶段交付文件。'}</p></div>
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
        <div><span className={css.sectionEyebrow}>部署试运行 · 真实环境</span><h2>版本、环境与运行证据</h2><p>本地启动不等于部署完成；页面只汇总当前项目记录的授权、证据、问题和固定交付文件。</p></div>
        <strong>{deploymentTrial.gateReady ? '可提交' : `${String(deploymentTrial.blockers.length)} 个阻塞`}</strong>
      </header>
      <div className={css.developmentSummary}>
        <div><span>候选版本</span><strong>{deploymentTrial.contract.candidateVersion ?? '待登记'}</strong></div>
        <div><span>目标环境</span><strong>{deploymentTrial.contract.environment?.name ?? '待登记'}</strong></div>
        <div><span>环境授权</span><strong>{deploymentTrial.contract.environment?.authorized === true ? '已授权' : '未授权'}</strong></div>
        <div><span>试运行状态</span><strong>{deploymentTrial.contract.deploymentStatus ?? '未建立'}</strong></div>
        <div><span>证据齐备</span><strong>{evidenceReady}/5</strong></div>
        <div><span>阶段交付文件</span><strong>{deploymentTrial.artifacts.presentCount}/{deploymentTrial.artifacts.requiredCount}</strong></div>
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
                ? '五类证据、问题决定和四份交付文件已经齐备。请由 FDE 明确确认当前目标环境授权与本次试运行结论。'
                : '当前仍有运行证据、问题决定或阶段交付文件缺口，暂不能确认试运行结论。'}</p>
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
        title="部署试运行阶段交付文件"
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
                  ? '版本、环境授权、五类证据、问题决定和四份交付文件均已齐备，请再次核对。'
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
                <p>我已核对候选版本、目标环境授权、部署与回滚证据、试运行观察、客户反馈、问题决定及四份阶段交付文件。</p>
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
          <span className={css.sectionEyebrow}>验收移交 · 项目交付</span>
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
          <span>阶段交付文件</span>
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
      <CloseoutArtifactSection title="验收移交阶段交付文件" description="交付物清单、验收报告、运维使用手册和移交记录共同记录最终交付情况。" artifacts={acceptanceHandover.artifacts} selectedArtifactId={selectedArtifactId} selectArtifact={setSelectedArtifactId} />
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
                  ? '验收结论、最终交付物、条件项、责任移交和四份交付文件均已齐备，请进行最终核对。'
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
      currentStage={currentStage}
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
              <div><strong>由 FDE 决定是否进入下一阶段</strong><p>{ready ? '三份标准交付文件已经齐备，请先核对内容和未决事项。' : '交付文件尚未齐备，请回到项目交付继续对话和更新文件。'}</p></div>
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
  row, sourceState, surfaceState, selectedSource, selectSource, parseSource,
  completeRequirements, completeSolution,
  completeDevelopment, completeValidation, completePilot, completeHandoff, returnToPrevious,
  acceptValidationMetric, waiveValidationIssue,
  acceptDeploymentTrialIssue, confirmDeploymentTrialReadiness, recordAcceptanceHandoverDecision,
  reviewArchitecture, enterProject, back, renderPreview,
}: {
  readonly row: ProjectRow
  readonly sourceState: ProjectSourceLoadState | undefined
  readonly surfaceState: ProjectSurfaceLoadState | undefined
  readonly selectedSource: ProjectSourceItem | undefined
  readonly selectSource: (sourceId: string) => void
  readonly parseSource: (sourceId: string) => void
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
  const currentProjectStage = currentV2Stage(row.stage)
  const currentProjectStageIndex = currentProjectStage === undefined ? -1 : FDE_V2_STAGE_IDS.indexOf(currentProjectStage)
  const [viewedProjectStage, setViewedProjectStage] = useState<FdeV2StageId>(currentProjectStage ?? 'discovery')
  const [viewedStage, setViewedStage] = useState<FdeStageId>(currentStage === 'completed' ? 'handoff' : currentStage ?? 'requirements')
  const [section, setSection] = useState<'inputs' | 'outputs'>('inputs')
  const [returnOpen, setReturnOpen] = useState(false)
  const [returnReason, setReturnReason] = useState('')
  const [returnError, setReturnError] = useState<string | undefined>()
  const [returnSubmitting, setReturnSubmitting] = useState(false)
  useEffect(() => {
    const nextStage = currentStage === 'completed' ? 'handoff' : currentStage ?? 'requirements'
    setViewedProjectStage(currentProjectStage ?? 'discovery')
    setViewedStage(nextStage)
    setSection(nextStage === 'requirements' ? 'inputs' : 'outputs')
    setReturnOpen(false)
    setReturnReason('')
    setReturnError(undefined)
  }, [currentProjectStage, currentStage, row.workspaceId])
  const canParse = selectedSource !== undefined && ['pending', 'error', 'stale'].includes(selectedSource.parse.status)
  const viewedProjectIndex = FDE_V2_STAGE_IDS.indexOf(viewedProjectStage)
  const viewedProjectState = v2StagePositionState(row.stage, viewedProjectIndex)
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
  const selectViewedProjectStage = (nextStage: FdeV2StageId): void => {
    const archiveStage = V2_TO_ARCHIVE_STAGE[nextStage]
    setViewedProjectStage(nextStage)
    selectViewedStage(archiveStage)
  }
  const stageValue = row.stage?.status === 'ready' ? row.stage.value : undefined
  const returnTarget = currentStage === undefined ? undefined : previousStageOf(currentStage)
  const returnLabel = currentStage === 'completed' ? '重新打开项目' : '返回上一阶段'
  const latestReturn = stageValue?.returns?.at(-1)
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
          <div><dt>项目当前阶段</dt><dd>{currentProjectStage === undefined ? stageLabel(row.stage, '读取中', '读取失败') : `第 ${String(currentProjectStageIndex + 1)}/8 阶段 · ${V2_STAGE_NAMES[currentProjectStage]}`}</dd></div>
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
      <ProjectDeliverySummary row={row} sourceState={sourceState} surfaceState={surfaceState} />
      <ProjectCurrentFocus row={row} sourceState={sourceState} surfaceState={surfaceState} enterProject={enterProject} />
      <div className={css.stageExperience}>
        <aside className={css.stageRail}>
          <header><span>交付档案</span><h2>阶段交付文件档案</h2><p>按已接入的交付文件类型查看资料、记录与人工确认。</p></header>
          <StageNavigator stage={row.stage} viewedStage={viewedProjectStage} selectStage={selectViewedProjectStage} />
        </aside>
        <div className={css.stageCanvas}>
          <section className={css.stageWorkspaceHeader} data-state={viewedProjectState}>
            <span className={css.stageWorkspaceOrdinal} aria-hidden="true">{String(viewedProjectIndex + 1).padStart(2, '0')}</span>
            <div className={css.stageWorkspaceCopy}>
              <span>正在查看 · 阶段交付文件</span>
              <h2>{V2_STAGE_NAMES[viewedProjectStage]}</h2>
              <p>{V2_STAGE_SUMMARIES[viewedProjectStage]}</p>
            </div>
            <div className={css.stageWorkspaceState}>
              <strong>{stageStateLabel(viewedProjectState)}</strong>
              {viewedProjectStage !== currentProjectStage && currentProjectStage !== undefined && <small>项目当前处于 {V2_STAGE_NAMES[currentProjectStage]}</small>}
            </div>
          </section>
          <StageVisualSummary
            viewedStage={viewedStage}
            sourceState={sourceState}
            surfaceState={surfaceState}
          />
          <nav className={css.detailSections} aria-label={`${STAGE_NAMES[viewedStage]}工作区`}>
            {viewedStage === 'requirements' && <>
              <button type="button" data-active={section === 'inputs' || undefined} onClick={() => { setSection('inputs') }}>阶段输入 <span>{sourceState?.files.length ?? 0}</span></button>
              <button type="button" data-active={section === 'outputs' || undefined} onClick={() => { setSection('outputs') }}>阶段产出 <span>{outputCount}</span></button>
            </>}
            {viewedStage !== 'requirements' && <button type="button" data-active>阶段产出 <span>{outputCount}</span></button>}
          </nav>
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
          {viewedStage === 'requirements' && section === 'inputs' && (sourceState?.status === 'ready' && sourceState.files.length === 0
            ? <section className={css.projectSourceEmpty}>
              <div><span>阶段输入</span><h2>阶段输入尚未建立</h2><p>先从当前阶段允许使用的客户原始材料开始，保留来源与识别状态，再让 Agent 形成候选记录。</p></div>
              <dl><div><dt>项目资料</dt><dd>0</dd></div><div><dt>已识别</dt><dd>0</dd></div><div><dt>阶段记录</dt><dd>{surfaceState?.status === 'ready' ? `${String(surfaceState.value.requirements.presentCount)}/${String(surfaceState.value.requirements.requiredCount)}` : '读取中'}</dd></div></dl>
              <button type="button" onClick={enterProject}>进入项目交付并添加资料 <span aria-hidden="true">→</span></button>
            </section>
            : <div className={css.detailLayout}>
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
            </div>)}
        </div>
      </div>
    </main>
  )
}

/** Render the global full page while retaining the ordinary project/session sidebar. */
export function ProjectProgressOverlay({
  useProjectPage, useStageProgress, useProjectSurfaces, useProjectSources, useProjectMetadata, useWorkspaces, useSessions,
  loadStage, retryStage, loadProjectSurface, refreshProjectSurface, loadProjectSources, parseProjectSource,
  openProjectCreation, enterProject, openActivitySession, loadProjectMetadata, reviewProjectArchitecture,
  completeRequirements, completeSolution, completeDevelopment, completeValidation, completePilot, completeHandoff, returnToPrevious,
  acceptValidationMetric, waiveValidationIssue, acceptDeploymentTrialIssue, confirmDeploymentTrialReadiness,
  recordAcceptanceHandoverDecision,
  showProjectHome, showProjectOverview, showProjectTimeline, showProjectDetail,
  renderSlot, t,
}: ProjectProgressOverlayProps) {
  const page = useProjectPage(state => state)
  const workspaces = useWorkspaces(state => state.items)
  const workspacePhase = useWorkspaces(state => state.phase)
  const workspaceReadState = useWorkspaces(state => state.state)
  const archivedSessionIds = useWorkspaces(state => state.archivedSessionIds)
  const sessions = useSessions(state => state)
  const stages = useStageProgress(state => state.byWorkspace)
  const surfaces = useProjectSurfaces(state => state.byWorkspace)
  const sources = useProjectSources(state => state.byWorkspace)
  const metadataStates = useProjectMetadata(state => state.byWorkspace)
  const [activityError, setActivityError] = useState<string | undefined>()
  const [selectedSourceId, setSelectedSourceId] = useState<string | undefined>()
  const [projectScope, setProjectScope] = useState<'attention' | 'all'>('all')
  const [projectCollectionView, setProjectCollectionView] = useState<'card' | 'list'>('card')
  const [projectSort, setProjectSort] = useState<'priority' | 'activity'>('activity')
  const [projectQuery, setProjectQuery] = useState('')
  const [projectPage, setProjectPage] = useState(1)
  const [allActivity, setAllActivity] = useState(false)
  const [rootRef, sidebarOffset] = useSidebarOffset(page.open)
  useStandalonePage(page.open, rootRef)

  useEffect(() => {
    if (!page.open || page.view === 'home') return
    for (const workspace of workspaces) {
      const workspaceId = String(workspace.workspaceId)
      loadStage(workspaceId)
      loadProjectSurface(workspaceId)
      loadProjectMetadata(workspaceId, workspace.path)
    }
  }, [loadProjectSurface, loadStage, loadProjectMetadata, page.open, page.view, workspaces])

  useEffect(() => {
    if (page.view !== 'project' || page.workspaceId === undefined) return
    setSelectedSourceId(undefined)
    retryStage(page.workspaceId)
    refreshProjectSurface(page.workspaceId)
    loadProjectSources(page.workspaceId)
  }, [loadProjectSources, page.view, page.workspaceId, refreshProjectSurface, retryStage])

  useEffect(() => {
    if (page.view !== 'project' || page.workspaceId === undefined || selectedSourceId !== undefined) return
    const first = sources[page.workspaceId]?.files[0]
    if (first !== undefined) setSelectedSourceId(first.sourceId)
  }, [page.view, page.workspaceId, selectedSourceId, sources])

  const rows = useMemo<readonly ProjectRow[]>(() => workspaces.map((workspace) => {
    const workspaceSessions = workspace.sessionIds.filter(id => !archivedSessionIds.includes(id)).map(id => sessions.byId[id]).filter(item => item !== undefined).filter(item => item.origin !== 'subagent')
    const latestSession = workspaceSessions.toSorted((left, right) => right.updatedAt - left.updatedAt)[0]
    const metadataState = metadataStates[String(workspace.workspaceId)]
    const metadata = metadataState?.status === 'ready' && metadataState.value !== null
      ? metadataState.value : { companyName: '', schedule: { status: 'pending-confirmation' as const } }
    const stage = stages[String(workspace.workspaceId)]
    const latestActivityAt = Math.max(
      Date.parse(workspace.createdAt) || 0,
      Date.parse(workspace.updatedAt) || 0,
      latestSession?.updatedAt ?? 0,
      stage?.status === 'ready' ? Date.parse(stage.value.updatedAt) || 0 : 0,
    )
    return {
      workspaceId: String(workspace.workspaceId), title: workspace.title, path: workspace.path,
      createdAt: workspace.createdAt, sessions: workspaceSessions.length,
      runningSessions: workspaceSessions.filter(item => item.running).length,
      latestActivityAt,
      ...(latestSession === undefined ? {} : { latestSessionTitle: latestSession.displayTitle }),
      companyName: metadata.companyName, schedule: metadata.schedule,
      stage,
      surface: surfaces[String(workspace.workspaceId)],
    }
  }), [sessions.byId, stages, surfaces, workspaces, archivedSessionIds, metadataStates])

  if (!page.open) return null
  const detailRow = page.workspaceId === undefined ? undefined : rows.find(row => row.workspaceId === page.workspaceId)
  const sourceState = page.workspaceId === undefined ? undefined : sources[page.workspaceId]
  const surfaceState = page.workspaceId === undefined ? undefined : surfaces[page.workspaceId]
  const selectedSource = sourceState?.files.find(source => source.sourceId === selectedSourceId)
  const attentionRows = rows.filter(row => projectAttention(row) !== undefined)
  const runningSessionCount = rows.reduce((total, row) => total + row.runningSessions, 0)
  const scheduledProjectCount = rows.filter(row => row.schedule.status === 'estimated').length
  const compareProjectPriority = (left: ProjectRow, right: ProjectRow): number => {
    const priorityDifference = (projectAttention(left)?.priority ?? 5) - (projectAttention(right)?.priority ?? 5)
    if (priorityDifference !== 0) return priorityDifference
    return (right.latestActivityAt ?? 0) - (left.latestActivityAt ?? 0)
  }
  const primaryAttentionRow = attentionRows.toSorted(compareProjectPriority)[0]
  const primaryAttentionAction = primaryAttentionRow === undefined ? undefined : projectAttention(primaryAttentionRow)
  const projectRowLabels: ProjectRowLabels = {
    companyMissing: t('progress.companyMissing'), scheduleMissing: t('progress.scheduleMissing'),
    view: t('progress.viewProject'), created: date => t('progress.createdAt', { date }),
    loading: t('progress.stageLoading'), failed: t('progress.stageError'),
  }
  const query = projectQuery.trim().toLocaleLowerCase()
  const visibleRows = (projectScope === 'attention' ? attentionRows : rows).filter(row => !query || `${row.title} ${row.companyName}`.toLocaleLowerCase().includes(query)).toSorted((left, right) => {
    if (projectSort === 'activity') return (right.latestActivityAt ?? 0) - (left.latestActivityAt ?? 0)
    return compareProjectPriority(left, right)
  })
  const collectionRows = page.view === 'timeline' ? visibleRows.filter(row => row.schedule.status === 'estimated') : visibleRows
  const pageCount = Math.max(1, Math.ceil(visibleRows.length / 6))
  const currentProjectPage = Math.min(projectPage, pageCount)
  const pagedRows = visibleRows.slice((currentProjectPage - 1) * 6, currentProjectPage * 6)
  const activityRows = workspaces.flatMap(workspace => {
    const row = rows.find(item => item.workspaceId === String(workspace.workspaceId))!
    const entries: { id: string; row: ProjectRow; description: string; at: number; sessionId?: string }[] = []
    for (const id of workspace.sessionIds) {
      const session = sessions.byId[id]
      if (session === undefined || session.blank || session.origin === 'subagent' || archivedSessionIds.includes(id)) continue
      entries.push({ id: `session:${id}`, row, description: `会话更新 · ${session.displayTitle}`, at: session.updatedAt, sessionId: String(id) })
    }
    if (row.stage?.status === 'ready') entries.push({
      id: `stage:${row.workspaceId}`, row,
      description: `阶段记录更新 · ${stageLabel(row.stage, projectRowLabels.loading, projectRowLabels.failed)}`,
      at: Date.parse(row.stage.value.updatedAt),
    })
    const createdAt = Date.parse(workspace.createdAt)
    const updatedAt = Date.parse(workspace.updatedAt)
    entries.push({ id: `project:${row.workspaceId}`, row, description: updatedAt > createdAt ? '项目记录更新' : '项目已登记', at: Math.max(createdAt, updatedAt) })
    return entries
  }).filter(entry => Number.isFinite(entry.at) && entry.at > 0)
    .toSorted((left, right) => right.at - left.at || left.id.localeCompare(right.id))
  const visibleActivityRows = activityRows.slice(0, allActivity ? undefined : 3)
  const visibleScheduleRows = rows.filter(row => row.schedule.status === 'estimated' && !(row.stage?.status === 'ready' && row.stage.value.currentStage === 'completed')).toSorted((left, right) => {
    if (left.schedule.status === 'estimated' && right.schedule.status === 'estimated') return left.schedule.endDate.localeCompare(right.schedule.endDate)
    if (left.schedule.status === 'estimated') return -1
    if (right.schedule.status === 'estimated') return 1
    return left.title.localeCompare(right.title, 'zh-CN')
  }).slice(0, 2)

  if (page.view === 'home') {
    return (
      <div
        ref={rootRef}
        className={`${css.pageOverlay} ${css.deliveryHomeOverlay}`}
        data-testid="fde-delivery-home"
      >
        <main className={`${css.pageBody} ${css.homeBody}`}>
          <DeliveryHomepage projectCount={workspacePhase === 'ready' ? rows.length : undefined} projectReadError={workspaceReadState === 'error'} openProjects={showProjectOverview} renderSlot={renderSlot} />
        </main>
      </div>
    )
  }

  const legacyDetailOpen = page.view === 'project'
    && detailRow?.stage?.status === 'ready'
    && detailRow.stage.value.lifecycleVersion !== 2
  const v2DetailOpen = page.view === 'project' && detailRow !== undefined && !legacyDetailOpen

  return (
    <div
      ref={rootRef}
      className={`${css.pageOverlay} ${page.view === 'project' && !v2DetailOpen ? '' : css.projectCenterOverlay}`}
      style={page.view === 'project' && !v2DetailOpen ? { left: sidebarOffset, width: `calc(100% - ${String(sidebarOffset)}px)` } : undefined}
      data-testid="fde-project-progress"
    >
      {detailRow !== undefined && metadataStates[detailRow.workspaceId]?.status === 'error' && <p role="alert" className={css.projectMetadataWarning}>
        项目基础信息未同步：{(metadataStates[detailRow.workspaceId] as { message: string }).message}
        <button type="button" onClick={() => { loadProjectMetadata(detailRow.workspaceId, detailRow.path, true) }}>重试保存或读取周期</button>
      </p>}
      {page.view === 'project' && detailRow !== undefined
        ? v2DetailOpen
          ? <ProjectV2Detail
            row={detailRow}
            sourceState={sourceState}
            surfaceState={surfaceState}
            returnToPrevious={async (revision, reason) => {
              try {
                await returnToPrevious(detailRow.workspaceId, revision, reason)
              } catch (error) {
                retryStage(detailRow.workspaceId)
                throw error
              }
            }}
            enterProject={() => { void enterProject(detailRow.workspaceId) }}
            back={showProjectOverview}
          />
          : <ProjectDetail
          row={detailRow}
          sourceState={sourceState}
          surfaceState={surfaceState}
          selectedSource={selectedSource}
          selectSource={setSelectedSourceId}
          parseSource={(sourceId) => {
            void parseProjectSource(detailRow.workspaceId, sourceId)
              .catch(() => undefined)
          }}
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
        : <main className={`${css.pageBody} ${css.projectCenterBody} ${css.projectCenterRefresh}`} data-project-center="">
          <nav className={css.projectModuleNavigation} aria-label="工作台独立功能">
            {renderSlot('fde.workbench.module.action', {})}
          </nav>
          <header className={css.projectCenterHeader} data-project-center-header="">
            <div>
              <p className={css.projectCenterBreadcrumb} data-project-breadcrumb=""><button type="button" onClick={showProjectHome}>返回首页</button><i>/</i><strong>项目中心</strong>{page.view === 'timeline' && <><i>/</i><span>交付时间轴</span></>}</p>
              <h1>项目中心</h1>
              <p data-project-center-copy="">掌握交付进展，处理需要你决定的事项。</p>
              <button type="button" className={css.projectCreateAction} data-project-create="" onClick={openProjectCreation}>
                <span aria-hidden="true">＋</span>新建项目
              </button>
            </div>
            <div className={css.projectCenterUtilities} aria-label="本地工作区">
              <button type="button" className={css.projectNotification} title={`${attentionRows.length} 个项目待处理`} aria-label={`查看 ${attentionRows.length} 个待处理项目`} onClick={() => { setProjectScope('attention'); setProjectPage(1); setProjectQuery(''); showProjectOverview() }}>
                <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M6.5 9.5a5.5 5.5 0 0 1 11 0c0 6 2.5 6 2.5 7H4c0-1 2.5-1 2.5-7ZM10 19h4" /></svg>
              </button>
              <details className={css.projectCenterHelp}><summary aria-label="项目中心帮助"><svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" /><path d="M9.8 9a2.4 2.4 0 1 1 3.15 2.28c-.67.28-.95.72-.95 1.47v.25M12 16.5h.01" /></svg></summary><div><strong>项目中心帮助</strong><p>查看交付文件可审阅项目记录；进入项目可继续交付。项目超过 6 个时支持搜索与分页，筛选和排序不会修改项目数据。</p></div></details>
              <span className={css.projectLocalIdentity} title="本地工作区"><img src="/ff-brand/ff-logo.png" alt="FF - FDE 交付工作台 Logo" /><span>本地工作区</span></span>
            </div>
          </header>

          <section className={css.projectCenterSummary} data-project-summary="" aria-label="项目概览">
            <dl className={css.projectCenterMetrics}>
              <div data-kind="projects"><span className={css.projectMetricIcon}><DashboardIcon kind="projects" /></span><div><dt>真实项目</dt><dd>{rows.length}</dd></div></div>
              <div data-kind="decisions"><span className={css.projectMetricIcon}><DashboardIcon kind="decisions" /></span><div><dt>待处理项目</dt><dd>{attentionRows.length}</dd></div></div>
              <div data-kind="sessions"><span className={css.projectMetricIcon}><DashboardIcon kind="sessions" /></span><div><dt>运行中会话</dt><dd>{runningSessionCount}</dd></div></div>
              <div data-kind="schedule"><span className={css.projectMetricIcon}><DashboardIcon kind="schedule" /></span><div><dt>已登记周期</dt><dd>{scheduledProjectCount}</dd></div></div>
            </dl>
            <aside className={css.projectCenterPriority} data-empty={primaryAttentionRow === undefined ? true : undefined}>
              <div className={css.projectPriorityCopy}>
                <span>当前待处理事项</span>
                {primaryAttentionRow === undefined || primaryAttentionAction === undefined
                  ? <><strong>暂无已登记待处理事项</strong><p>未读取的项目状态仍待确认，可以查看全部项目继续工作。</p></>
                  : <>
                    <strong title={primaryAttentionRow.title}>{primaryAttentionRow.title}</strong>
                    <b className={css.projectPriorityStage}>{stageLabel(primaryAttentionRow.stage, '阶段读取中', '阶段读取失败')}</b>
                    <p>{primaryAttentionAction.label}：{primaryAttentionAction.reason}</p>
                    <div>
                      <span>{primaryAttentionAction.action}</span>
                      <button type="button" onClick={() => { showProjectDetail(primaryAttentionRow.workspaceId) }}>查看并处理 <span aria-hidden="true">→</span></button>
                    </div>
                    <footer className={css.projectPriorityFacts}><span><DashboardIcon kind="sessions" />{primaryAttentionRow.sessions} 个会话</span><span><DashboardIcon kind="schedule" />{primaryAttentionRow.schedule.status === 'estimated' ? `${formatDate(primaryAttentionRow.schedule.startDate)} — ${formatDate(primaryAttentionRow.schedule.endDate)}` : '交付周期待确认'}</span></footer>
                  </>}
              </div>
              <div className={css.projectPriorityArt} aria-hidden="true">
                <img src="/fde-dashboard/project-priority-depth.webp" width={1881} height={836} alt="" decoding="async" draggable={false} />
              </div>
            </aside>
          </section>

          <section className={css.projectCollectionSurface} data-project-collection="" aria-label="项目集合">
            <div className={css.projectCollectionHeader}>
              <div className={css.projectCollectionTitle}>
                {page.view === 'timeline' && <button type="button" className={css.projectToolButton} onClick={() => { setProjectScope('all'); setProjectQuery(''); setProjectPage(1); showProjectOverview() }}>
                  <svg aria-hidden="true" viewBox="0 0 14 14"><path d="m6 3-4 4 4 4M2 7h10" /></svg>返回项目中心
                </button>}
                <div>
                  <h2 data-project-collection-title="">{page.view === 'timeline' ? '交付时间轴' : projectScope === 'attention' ? '待我处理' : '全部项目'} <b>{collectionRows.length}</b></h2>
                  <p>{query ? `“${projectQuery.trim()}”的搜索结果` : '项目进展与下一步'}</p>
                </div>
              </div>
              <div className={css.projectViewControls}>
                <div className={css.collectionViewSwitch} role="group" aria-label="项目展示方式">
                  <button type="button" aria-pressed={page.view === 'overview' && projectCollectionView === 'card'} data-active={(page.view === 'overview' && projectCollectionView === 'card') || undefined} onClick={() => { setProjectCollectionView('card'); setProjectPage(1); showProjectOverview() }}>
                    <svg aria-hidden="true" viewBox="0 0 14 14"><rect x="1.5" y="1.5" width="4" height="4" rx="0.8" /><rect x="8.5" y="1.5" width="4" height="4" rx="0.8" /><rect x="1.5" y="8.5" width="4" height="4" rx="0.8" /><rect x="8.5" y="8.5" width="4" height="4" rx="0.8" /></svg>卡片
                  </button>
                  <button type="button" aria-pressed={page.view === 'overview' && projectCollectionView === 'list'} data-active={(page.view === 'overview' && projectCollectionView === 'list') || undefined} onClick={() => { setProjectCollectionView('list'); setProjectPage(1); showProjectOverview() }}>
                    <svg aria-hidden="true" viewBox="0 0 14 14"><circle cx="2.2" cy="3" r="0.9" /><circle cx="2.2" cy="7" r="0.9" /><circle cx="2.2" cy="11" r="0.9" /><path d="M5 3h7M5 7h7M5 11h7" /></svg>列表
                  </button>
                </div>
                <button type="button" className={css.projectToolButton} data-project-filter="" data-active={projectScope === 'attention' || undefined} aria-label={`筛选项目，当前：${projectScope === 'attention' ? '待我处理' : '全部项目'}`} onClick={() => { setProjectScope(current => current === 'attention' ? 'all' : 'attention'); setProjectPage(1); showProjectOverview() }}>
                  <DashboardIcon kind="filter" />{projectScope === 'attention' ? '待我处理' : '筛选'}
                </button>
                <button type="button" className={css.projectToolButton} data-project-sort="" data-active={projectSort === 'activity' || undefined} aria-label={`项目排序，当前：${projectSort === 'priority' ? '优先事项' : '最近操作'}`} onClick={() => { setProjectSort(current => current === 'priority' ? 'activity' : 'priority'); setProjectPage(1) }}>
                  <DashboardIcon kind="sort" />{projectSort === 'activity' ? '最近操作' : '优先事项'}
                </button>
              </div>
            </div>
            {(rows.length > 6 || projectQuery !== '') && <div className={css.projectSearchRow}><label><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6" /><path d="m15 15 5 5" /></svg><input type="search" aria-label="搜索项目或企业" placeholder="搜索项目名称或所属企业" value={projectQuery} onChange={event => { setProjectQuery(event.target.value); setProjectPage(1) }} /></label><span>共 {collectionRows.length} 个项目{page.view !== 'timeline' && ' · 每页 6 个'}</span>{projectQuery !== '' && <button type="button" onClick={() => { setProjectQuery(''); setProjectPage(1) }}>清除搜索</button>}</div>}
            <div className={css.projectCenterContent}>
              {page.view === 'timeline'
                ? <Timeline rows={collectionRows} showProject={showProjectDetail} todayLabel={t('progress.today')} />
                : visibleRows.length === 0
                ? <div className={css.projectCenterEmpty}>{query ? '没有匹配的项目，请调整搜索条件。' : projectScope === 'attention' ? '当前没有已登记的待处理项目，可切换到全部项目继续工作。' : t('progress.empty')}</div>
                  : projectCollectionView === 'list'
                    ? <ProjectList
                      rows={pagedRows} showProject={showProjectDetail} labels={projectRowLabels}
                      enterProject={(workspaceId) => { void enterProject(workspaceId) }}
                    />
                    : <ProjectAttentionList
                      rows={pagedRows} showProject={showProjectDetail}
                      enterProject={(workspaceId) => { void enterProject(workspaceId) }}
                    />}
              {Object.values(stages).some(stage => stage.status === 'error') && (
                <button type="button" className={css.retryAll} onClick={() => { for (const row of rows) if (row.stage?.status === 'error') retryStage(row.workspaceId) }}>重新读取失败的项目阶段</button>
              )}
            </div>
            {page.view !== 'timeline' && pageCount > 1 && <nav className={css.projectPagination} aria-label="项目分页"><span>第 {(currentProjectPage - 1) * 6 + 1}–{Math.min(currentProjectPage * 6, visibleRows.length)} 个，共 {visibleRows.length} 个</span><button type="button" disabled={currentProjectPage === 1} onClick={() => { setProjectPage(currentProjectPage - 1) }}>上一页</button><span aria-live="polite">{currentProjectPage} / {pageCount}</span><button type="button" disabled={currentProjectPage === pageCount} onClick={() => { setProjectPage(currentProjectPage + 1) }}>下一页</button></nav>}
          </section>

          {page.view === 'overview' && rows.length > 0 && (
            <div className={css.projectManagementDetails}>
              <section aria-labelledby="recent-project-activity-title">
                <header>
                  <div><DashboardIcon kind="attention" /><h3 id="recent-project-activity-title">最近动态</h3></div>
                  <small>{activityRows.length} 条</small>
                  {activityRows.length > 3 && <button type="button" aria-expanded={allActivity} onClick={() => { setAllActivity(value => !value) }}>{allActivity ? '收起动态' : '查看全部动态'} <span aria-hidden="true">→</span></button>}
                </header>
                {visibleActivityRows.length === 0
                  ? <p>还没有可显示的项目更新记录。</p>
                  : <ul className={css.projectRecentActivityList}>{visibleActivityRows.map(entry => (
                    <li key={entry.id}>
                      <span className={css.projectActivityMark} data-stage={portfolioStageId(entry.row) ?? 'discovery'} data-palette={projectPalette(entry.row.title)} aria-hidden="true">{entry.row.title.slice(0, 1).toUpperCase()}</span>
                      <div><strong>{entry.row.title}</strong><small>{entry.description}</small></div>
                      <time dateTime={new Date(entry.at).toISOString()}>{formatActivityTime(entry.at)}</time>
                      <button type="button" onClick={() => {
                        setActivityError(undefined)
                        if (entry.sessionId === undefined) showProjectDetail(entry.row.workspaceId)
                        else void openActivitySession(entry.row.workspaceId, entry.sessionId).catch((error: unknown) => { setActivityError(error instanceof Error ? error.message : '会话打开失败。') })
                      }}>{entry.sessionId === undefined ? '查看项目' : '查看对话'}</button>
                    </li>
                  ))}</ul>}
                {activityError !== undefined && <p role="alert">{activityError}</p>}
              </section>
              <section aria-labelledby="project-delivery-schedule-title">
                <header>
                  <div><DashboardIcon kind="schedule" /><h3 id="project-delivery-schedule-title">交付周期</h3></div>
                  <button type="button" className={css.projectTimelineAction} onClick={() => { setProjectScope('all'); setProjectQuery(''); showProjectTimeline() }}>{scheduledProjectCount}/{rows.length} 已登记 <span aria-hidden="true">→</span></button>
                </header>
                <ul>{visibleScheduleRows.map(row => (
                  <li key={row.workspaceId}>
                    <button type="button" className={css.projectScheduleRowAction} aria-label={`查看 ${row.title} 的交付周期`} onClick={() => { showProjectDetail(row.workspaceId) }}>
                    <span className={css.projectActivityMark} data-stage={portfolioStageId(row) ?? 'discovery'} data-palette={projectPalette(row.title)} aria-hidden="true">{row.title.slice(0, 1).toUpperCase()}</span>
                    <div>
                      <strong>{row.title}</strong>
                      <small>{stageLabel(row.stage, projectRowLabels.loading, projectRowLabels.failed)}</small>
                    </div>
                    {row.schedule.status === 'estimated' && <div className={css.projectScheduleDates}><span><small>开始</small>{formatDate(row.schedule.startDate)}</span><i aria-hidden="true" /><span><small>结束</small>{formatDate(row.schedule.endDate)}</span></div>}
                    </button>
                  </li>
                ))}</ul>
                {visibleScheduleRows.length === 0 && <p>{scheduledProjectCount === 0 ? '还没有已登记的交付周期。' : '进行中的项目暂无已登记周期，可查看已完成项目的周期。'}</p>}
                {rows.some(row => metadataStates[row.workspaceId] === undefined || metadataStates[row.workspaceId]?.status === 'loading') && <p aria-live="polite">正在读取项目周期…</p>}
                {rows.map(row => {
                  const state = metadataStates[row.workspaceId]
                  return state?.status === 'error' ? <p key={row.workspaceId} role="alert">{row.title}：{state.message} <button type="button" onClick={() => { loadProjectMetadata(row.workspaceId, row.path, true) }}>重试保存或读取周期</button></p> : null
                })}
                {scheduledProjectCount > 0 && <button type="button" className={css.projectAllSchedules} onClick={() => { setProjectScope('all'); setProjectQuery(''); showProjectTimeline() }}>查看全部 {scheduledProjectCount} 个周期 <span aria-hidden="true">→</span></button>}
              </section>
            </div>
          )}
          <footer className={css.projectCenterFootnote}>@赋范空间 独家研发</footer>
        </main>}
    </div>
  )
}
