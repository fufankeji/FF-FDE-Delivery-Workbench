/** Project Session aggregates and current-stage labels. */

import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { SessionSummary } from '@deepseek-ai/dsh-api-session-controller/client'
import type { FdeProjectState } from './stage-controller.ts'
import { STAT_KEYS, TOKEN_KEYS, type ProjectUsage, type UsageNumbers, type UsagePoint } from './usage-controller.ts'

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
export type ProjectActivityRange = 'all' | 'today' | '7d' | '30d'

/** One display interval over actual request-start activity. */
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

function activityBoundaries(range: ProjectActivityRange, now: number, earliest = now): readonly Date[] {
  const start = new Date(range === 'all' ? Math.min(now, earliest) : now)
  start.setHours(0, 0, 0, 0)
  if (range === '7d' || range === '30d') start.setDate(start.getDate() - (range === '7d' ? 6 : 29))
  const end = new Date(now)
  end.setHours(0, 0, 0, 0)
  end.setDate(end.getDate() + 1)
  const points = [start]
  // Long-lived projects retain every interval, merging adjacent days into at most 90 bars.
  const stride = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86_400_000 / 90))
  while ((points.at(-1) as Date).getTime() < end.getTime()) {
    const next = new Date(points.at(-1) as Date)
    if (range === 'today') next.setTime(next.getTime() + 300_000)
    else next.setDate(next.getDate() + stride)
    points.push(new Date(Math.min(next.getTime(), end.getTime())))
  }
  return points
}

function activityPoints(session: SessionSummary): readonly UsagePoint[] {
  const values = session.projectionValues as Readonly<Record<string, unknown>> | undefined
  return (values?.sessionActivity as { buckets?: readonly UsagePoint[] } | undefined)?.buckets ?? []
}

/** Limit both the table and cards by request time, while retaining the independent whole-log totals. */
export function projectUsageSessions(sessions: readonly SessionSummary[], data: ProjectUsage, range: ProjectActivityRange, now = Date.now()): SessionSummary[] {
  const boundaries = activityBoundaries(range, now)
  const start = range === 'all' ? Number.NEGATIVE_INFINITY : (boundaries[0] as Date).getTime()
  const end = (boundaries.at(-1) as Date).getTime()
  return sessions.flatMap(session => {
    if (session.origin === 'subagent') return []
    const row = data.sessions.find(item => item.sessionId === session.id)
    if (row?.status !== 'ready') return []
    const points = row.activity.buckets.filter(point => point.start >= start && point.start < end)
    if (range !== 'all' && points.length === 0) return []
    const totals = Object.fromEntries([...STAT_KEYS, ...TOKEN_KEYS].map(key => [key, points.reduce((sum, point) => sum + point[key], 0)])) as UsageNumbers
    return [{ ...session, projectionValues: {
      ...session.projectionValues,
      sessionStats: range === 'all' ? row.stats : totals,
      tokenUsage: range === 'all' ? row.usage : totals,
      sessionActivity: { buckets: points },
    } }]
  })
}

/**
 * Merge request-start activity into local calendar intervals. Session.updatedAt is not a usage date.
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
  const earliest = sessions.reduce((min, session) => activityPoints(session).reduce((value, point) => Math.min(value, point.start), min), now)
  const boundaries = activityBoundaries(range, now, earliest)
  const dateLabel = new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' })
  const buckets = boundaries.slice(0, -1).map((start, index) => {
    const end = boundaries[index + 1] as Date
    const timeLabel = (value: Date) => `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`
    const label = range === 'today'
      ? timeLabel(start)
      : dateLabel.format(start)
    const description = range === 'today'
      ? `${dateLabel.format(start)} ${label}–${timeLabel(end)}`
      : `${dateLabel.format(start)}${end.getTime() - start.getTime() > 90_000_000 ? `–${dateLabel.format(new Date(end.getTime() - 1))}` : ''}`
    return {
      key: start.toISOString(), label, description,
      start: start.getTime(), end: end.getTime(),
      sessions: 0, turns: 0, steps: 0, inputTokens: 0, outputTokens: 0, llmMs: 0, toolMs: 0,
    }
  })
  for (const session of sessions) {
    const active = new Set<string>()
    for (const point of activityPoints(session)) {
      const bucket = buckets.find(item => point.start >= item.start && point.start < item.end)
      if (bucket === undefined) continue
      bucket.turns += point.turns
      bucket.steps += point.steps
      bucket.inputTokens += point.uncachedInputTokens + point.cacheReadTokens + point.cacheWriteTokens
      bucket.outputTokens += point.outputTokens
      bucket.llmMs += point.llmMs
      bucket.toolMs += point.toolMs
      if (!active.has(bucket.key)) { bucket.sessions += 1; active.add(bucket.key) }
    }
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
