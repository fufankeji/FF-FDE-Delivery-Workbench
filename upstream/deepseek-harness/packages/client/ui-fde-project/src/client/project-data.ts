/** Browser-local project metadata and aggregate helpers. */

import type { SessionSummary } from '@deepseek-ai/dsh-client-runtime/client'
import type { FdeStageId } from './stage-controller.ts'

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
  readonly turns: number
  readonly steps: number
  readonly inputTokens: number
  readonly outputTokens: number
  readonly toolMs: number
  readonly llmMs: number
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
  let inputTokens = 0
  let outputTokens = 0
  let toolMs = 0
  let llmMs = 0
  for (const session of sessions) {
    const values = session.projectionValues as Readonly<Record<string, unknown>> | undefined
    const stats = values?.sessionStats as Readonly<Record<string, unknown>> | undefined
    const usage = values?.tokenUsage as Readonly<Record<string, unknown>> | undefined
    turns += finite(stats?.turns)
    steps += finite(stats?.steps)
    toolMs += finite(stats?.toolMs)
    llmMs += finite(stats?.llmMs)
    inputTokens += finite(usage?.uncachedInputTokens) + finite(usage?.cacheReadTokens) + finite(usage?.cacheWriteTokens)
    outputTokens += finite(usage?.outputTokens)
  }
  return {
    sessions: sessions.length,
    running: sessions.filter(item => item.running).length,
    turns, steps, inputTokens, outputTokens, toolMs, llmMs,
  }
}

/** Stable Chinese stage names shared by the progress surface. */
export const STAGE_NAMES: Readonly<Record<FdeStageId, string>> = {
  requirements: '需求调研',
  solution: '方案设计',
  development: '项目开发',
  validation: '验证评估',
  pilot: '部署试运行',
  handoff: '验收移交',
}
