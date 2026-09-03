/** Browser-local project metadata and aggregate helpers. */

import type { SessionId, SessionSummary } from '@deepseek-ai/dsh-client-runtime/client'
import type { FdeProjectState } from './stage-controller.ts'

const WORKSPACE_VIEW_STORAGE_KEY = 'dsh.workspace.view.v6'

/** Display-safe metadata captured by the project creation form. */
export interface ProjectMetadataView {
  readonly companyName: string
  readonly schedule: { readonly status: 'pending-confirmation' } | {
    readonly status: 'estimated'
    readonly startDate: string
    readonly endDate: string
  }
}

interface PersistedWorkspaceView {
  readonly projectMetadataByPath?: Readonly<Record<string, {
    readonly companyName?: unknown
    readonly schedule?: unknown
  }>>
}

/**
 * Read one project's locally persisted creation metadata without mutating it.
 * @param path - canonical Workspace path used by the existing view store.
 * @returns display-safe metadata or the explicit pending fallback.
 */
export function readProjectMetadata(path: string): ProjectMetadataView {
  const fallback: ProjectMetadataView = { companyName: '', schedule: { status: 'pending-confirmation' } }
  if (typeof localStorage === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(WORKSPACE_VIEW_STORAGE_KEY)
    if (raw === null) return fallback
    const state = JSON.parse(raw) as PersistedWorkspaceView
    const value = state.projectMetadataByPath?.[path]
    if (value === undefined) return fallback
    const companyName = typeof value.companyName === 'string' ? value.companyName.trim() : ''
    const schedule = value.schedule
    if (schedule !== null && typeof schedule === 'object' && !Array.isArray(schedule)) {
      const record = schedule as Record<string, unknown>
      if (record.status === 'estimated' && typeof record.startDate === 'string' && typeof record.endDate === 'string') {
        return { companyName, schedule: { status: 'estimated', startDate: record.startDate, endDate: record.endDate } }
      }
    }
    return { companyName, schedule: { status: 'pending-confirmation' } }
  } catch {
    return fallback
  }
}

/** Numeric whole-project session statistics derived from existing projections. */
export interface ProjectRuntimeTotals {
  readonly sessions: number
  readonly running: number
  readonly completed: number
  readonly blank: number
  readonly turns: number
  readonly steps: number
  readonly uncachedInputTokens: number
  readonly cacheReadTokens: number
  readonly cacheWriteTokens: number
  readonly inputTokens: number
  readonly outputTokens: number
  readonly toolMs: number
  readonly llmMs: number
  readonly ttftMs: number
  readonly ttftSteps: number
  readonly decodeMs: number
  readonly decodeTokens: number
}

/** Time windows offered by the project observability surface. */
export type ProjectActivityRange = 'today' | '7d' | '30d'

/** One display bucket attributed by each Session's most recent activity time. */
export interface ProjectActivityBucket {
  readonly key: string
  readonly label: string
  readonly description: string
  readonly start: number
  readonly end: number
  readonly sessions: number
  readonly turns: number
  readonly steps: number
  readonly inputTokens: number
  readonly outputTokens: number
  readonly llmMs: number
  readonly toolMs: number
}

function finite(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0
}

/**
 * Aggregate durable projection values already carried by Session summaries.
 * @param sessions - current project's Session summaries.
 * @returns additive project totals; absent projections contribute zero.
 */
export function projectRuntimeTotals(sessions: readonly SessionSummary[]): ProjectRuntimeTotals {
  let turns = 0
  let steps = 0
  let uncachedInputTokens = 0
  let cacheReadTokens = 0
  let cacheWriteTokens = 0
  let outputTokens = 0
  let toolMs = 0
  let llmMs = 0
  let ttftMs = 0
  let ttftSteps = 0
  let decodeMs = 0
  let decodeTokens = 0
  for (const session of sessions) {
    const values = session.projectionValues as Readonly<Record<string, unknown>> | undefined
    const stats = values?.sessionStats as Readonly<Record<string, unknown>> | undefined
    const usage = values?.tokenUsage as Readonly<Record<string, unknown>> | undefined
    turns += finite(stats?.turns)
    steps += finite(stats?.steps)
    toolMs += finite(stats?.toolMs)
    llmMs += finite(stats?.llmMs)
    ttftMs += finite(stats?.ttftMs)
    ttftSteps += finite(stats?.ttftSteps)
    decodeMs += finite(stats?.decodeMs)
    decodeTokens += finite(stats?.decodeTokens)
    uncachedInputTokens += finite(usage?.uncachedInputTokens)
    cacheReadTokens += finite(usage?.cacheReadTokens)
    cacheWriteTokens += finite(usage?.cacheWriteTokens)
    outputTokens += finite(usage?.outputTokens)
  }
  const inputTokens = uncachedInputTokens + cacheReadTokens + cacheWriteTokens
  return {
    sessions: sessions.length,
    running: sessions.filter(item => item.running).length,
    completed: sessions.filter(item => item.completed).length,
    blank: sessions.filter(item => item.blank).length,
    turns, steps, uncachedInputTokens, cacheReadTokens, cacheWriteTokens,
    inputTokens, outputTokens, toolMs, llmMs, ttftMs, ttftSteps, decodeMs, decodeTokens,
  }
}

function activityBoundaries(range: ProjectActivityRange, now: number): readonly Date[] {
  const end = new Date(now)
  if (range === 'today') {
    end.setHours(0, 0, 0, 0)
    return Array.from({ length: 289 }, (_, index) => {
      const point = new Date(end)
      point.setMinutes(index * 5)
      return point
    })
  }
  const days = range === '7d' ? 7 : 30
  end.setHours(0, 0, 0, 0)
  end.setDate(end.getDate() - days + 1)
  return Array.from({ length: days + 1 }, (_, index) => {
    const point = new Date(end)
    point.setDate(point.getDate() + index)
    return point
  })
}

/**
 * Attribute each Session's cumulative projection to its latest-activity bucket.
 * This supports honest local trend exploration without claiming event-level telemetry.
 * @param sessions - current project's Session summaries.
 * @param range - requested local calendar window.
 * @param now - range anchor, injectable for deterministic tests.
 * @returns ordered chart buckets covering the complete requested window.
 */
export function projectActivityBuckets(
  sessions: readonly SessionSummary[],
  range: ProjectActivityRange,
  now: number = Date.now(),
): readonly ProjectActivityBucket[] {
  const boundaries = activityBoundaries(range, now)
  const dateLabel = new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' })
  const buckets = boundaries.slice(0, -1).map((start, index) => {
    const end = boundaries[index + 1] as Date
    const timeLabel = (value: Date) => `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`
    const label = range === 'today'
      ? timeLabel(start)
      : dateLabel.format(start)
    const description = range === 'today'
      ? `${dateLabel.format(start)} ${label}–${timeLabel(end)}`
      : dateLabel.format(start)
    return {
      key: start.toISOString(), label, description,
      start: start.getTime(), end: end.getTime(),
      sessions: 0, turns: 0, steps: 0, inputTokens: 0, outputTokens: 0, llmMs: 0, toolMs: 0,
    }
  })
  for (const session of sessions) {
    const bucket = buckets.find(item => session.updatedAt >= item.start && session.updatedAt < item.end)
    if (bucket === undefined) continue
    const totals = projectRuntimeTotals([session])
    Object.assign(bucket, {
      sessions: bucket.sessions + 1,
      turns: bucket.turns + totals.turns,
      steps: bucket.steps + totals.steps,
      inputTokens: bucket.inputTokens + totals.inputTokens,
      outputTokens: bucket.outputTokens + totals.outputTokens,
      llmMs: bucket.llmMs + totals.llmMs,
      toolMs: bucket.toolMs + totals.toolMs,
    })
  }
  return buckets
}

/** Stable Chinese stage names shared by the progress surface. */
export const STAGE_NAMES: Readonly<Record<FdeProjectState, string>> = {
  requirements: '需求调研',
  solution: '方案设计',
  development: '项目开发',
  validation: '验证评估',
  pilot: '部署试运行',
  handoff: '验收移交',
  completed: '项目已完成',
}

/** Select the most recently updated visible ordinary Session in one project. */
export function latestProjectSessionId(
  sessionIds: readonly SessionId[],
  byId: Readonly<Record<string, SessionSummary | undefined>>,
  archivedSessionIds: readonly SessionId[],
): SessionId | undefined {
  const archived = new Set(archivedSessionIds)
  let selectedActive: SessionId | undefined
  let selectedActiveUpdatedAt = Number.NEGATIVE_INFINITY
  let selectedBlank: SessionId | undefined
  let selectedBlankUpdatedAt = Number.NEGATIVE_INFINITY
  for (const id of sessionIds) {
    const session = byId[id]
    if (session === undefined || session.origin === 'subagent' || archived.has(id)) continue
    if (session.blank) {
      if (session.updatedAt <= selectedBlankUpdatedAt) continue
      selectedBlank = session.id
      selectedBlankUpdatedAt = session.updatedAt
      continue
    }
    if (session.updatedAt <= selectedActiveUpdatedAt) continue
    selectedActive = session.id
    selectedActiveUpdatedAt = session.updatedAt
  }
  return selectedActive ?? selectedBlank
}
