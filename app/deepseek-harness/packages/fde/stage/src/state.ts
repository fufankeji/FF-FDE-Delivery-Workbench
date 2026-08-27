/** Workspace-keyed stage initialization over the authoritative domain table. */

import type { KvTable } from '@deepseek-ai/dsh-storage-domain'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace'
import { FDE_PROJECT_STATE_IDS } from './spec.ts'
import type { FdeProjectState, FdeStageId, ProjectStageRecord } from './spec.ts'

/** Clock dependency used to stamp the one initial record. */
export type StageClock = () => string

/** A browser submitted an older project-stage revision. */
export class FdeStageConflictError extends Error {
  constructor(readonly current: ProjectStageRecord) {
    super('项目阶段已经变化，请刷新后重试。')
    this.name = 'FdeStageConflictError'
  }
}

/** A fixed stage action was attempted from the wrong current stage. */
export class FdeStageTransitionError extends Error {
  constructor(readonly current: ProjectStageRecord, expected: FdeStageId) {
    const label = expected === 'requirements'
      ? '需求调研'
      : expected === 'solution'
        ? '方案设计'
        : expected === 'development'
          ? '项目开发'
          : expected === 'validation'
            ? '验证评估'
            : expected === 'pilot'
              ? '部署试运行'
              : '验收移交'
    super(`当前项目已经不在${label}阶段。`)
    this.name = 'FdeStageTransitionError'
  }
}

/** The current stage cannot be returned any further. */
export class FdeStageReturnError extends Error {
  constructor(readonly current: ProjectStageRecord, message = '需求调研已经是第一个阶段，不能继续返回。') {
    super(message)
    this.name = 'FdeStageReturnError'
  }
}

const PREVIOUS_STAGE: Readonly<Record<Exclude<FdeProjectState, 'requirements'>, FdeStageId>> = {
  solution: 'requirements',
  development: 'solution',
  validation: 'development',
  pilot: 'validation',
  handoff: 'pilot',
  completed: 'handoff',
}

function stateIndex(state: FdeProjectState): number {
  return FDE_PROJECT_STATE_IDS.indexOf(state)
}

/** Owns current-stage reads and coalesces one Workspace's first durable write. */
export class FdeStageState {
  private readonly pending = new Map<WorkspaceId, Promise<ProjectStageRecord>>()
  private readonly transitions = new Map<WorkspaceId, Promise<ProjectStageRecord>>()

  /**
   * @param table - authoritative Workspace-keyed records.
   * @param clock - ISO timestamp source.
   */
  constructor(
    private readonly table: KvTable<WorkspaceId, ProjectStageRecord>,
    private readonly clock: StageClock = () => new Date().toISOString(),
  ) {}

  /**
   * Read the Workspace record or durably initialize its first stage. Concurrent
   * callers share the same write and receive the same committed value.
   * @param workspaceId - registered Harness Workspace identity.
   * @returns the committed project-stage record.
   */
  open(workspaceId: WorkspaceId): Promise<ProjectStageRecord> {
    const existing = this.table.get(workspaceId)
    if (existing !== undefined) return Promise.resolve(existing)
    const active = this.pending.get(workspaceId)
    if (active !== undefined) return active
    const attempt = this.initialize(workspaceId)
      .finally(() => { this.pending.delete(workspaceId) })
    this.pending.set(workspaceId, attempt)
    return attempt
  }

  /** Return the committed record without creating one. */
  current(workspaceId: WorkspaceId): ProjectStageRecord | undefined {
    return this.table.get(workspaceId)
  }

  /**
   * Atomically complete requirement research for one exact browser revision.
   * Calls for one Workspace are serialized; no arbitrary target stage is accepted.
   */
  completeRequirements(workspaceId: WorkspaceId, expectedRevision: number): Promise<ProjectStageRecord> {
    return this.transition(workspaceId, expectedRevision, 'requirements', 'solution')
  }

  /** Atomically complete solution design for one exact browser revision. */
  completeSolution(workspaceId: WorkspaceId, expectedRevision: number): Promise<ProjectStageRecord> {
    return this.transition(workspaceId, expectedRevision, 'solution', 'development')
  }

  /** Atomically complete project development for one exact browser revision. */
  completeDevelopment(workspaceId: WorkspaceId, expectedRevision: number): Promise<ProjectStageRecord> {
    return this.transition(workspaceId, expectedRevision, 'development', 'validation')
  }

  /** Atomically complete validation for one exact browser revision. */
  completeValidation(workspaceId: WorkspaceId, expectedRevision: number): Promise<ProjectStageRecord> {
    return this.transition(workspaceId, expectedRevision, 'validation', 'pilot')
  }

  /** Atomically complete deployment trial for one exact browser revision. */
  completePilot(workspaceId: WorkspaceId, expectedRevision: number): Promise<ProjectStageRecord> {
    return this.transition(workspaceId, expectedRevision, 'pilot', 'handoff')
  }

  /** Atomically complete acceptance handover and enter the terminal state. */
  completeHandoff(workspaceId: WorkspaceId, expectedRevision: number): Promise<ProjectStageRecord> {
    return this.transition(workspaceId, expectedRevision, 'handoff', 'completed')
  }

  /**
   * Return exactly one stage after a second-confirmed FDE decision. Existing
   * project files and evidence are retained; the returned range must be
   * confirmed again before it can advance beyond its former position.
   */
  returnToPrevious(workspaceId: WorkspaceId, expectedRevision: number, reason: string): Promise<ProjectStageRecord> {
    const normalizedReason = reason.trim()
    if (normalizedReason === '' || normalizedReason.length > 1000) {
      return Promise.reject(new Error('返回原因必须填写，且不能超过 1000 个字符。'))
    }
    const before = this.transitions.get(workspaceId) ?? Promise.resolve(undefined)
    const attempt = before.catch(() => undefined).then(async () => {
      const current = await this.open(workspaceId)
      if (current.revision !== expectedRevision) throw new FdeStageConflictError(current)
      if (current.currentStage === 'requirements') throw new FdeStageReturnError(current)
      const to = PREVIOUS_STAGE[current.currentStage]
      const returnedAt = this.clock()
      const revision = current.revision + 1
      const existingBoundary = current.reconfirmThrough
      const reconfirmThrough = existingBoundary === undefined || stateIndex(current.currentStage) > stateIndex(existingBoundary)
        ? current.currentStage
        : existingBoundary
      const next: ProjectStageRecord = {
        ...current,
        currentStage: to,
        revision,
        updatedAt: returnedAt,
        reconfirmThrough,
        returns: [...(current.returns ?? []), {
          from: current.currentStage,
          to,
          reason: normalizedReason,
          returnedAt,
          revision,
        }].slice(-50),
      }
      await this.table.put(workspaceId, next)
      return next
    })
    this.transitions.set(workspaceId, attempt)
    return attempt.finally(() => {
      if (this.transitions.get(workspaceId) === attempt) this.transitions.delete(workspaceId)
    })
  }

  private transition(
    workspaceId: WorkspaceId,
    expectedRevision: number,
    from: FdeStageId,
    to: FdeProjectState,
  ): Promise<ProjectStageRecord> {
    const before = this.transitions.get(workspaceId) ?? Promise.resolve(undefined)
    const attempt = before.catch(() => undefined).then(async () => {
      const current = await this.open(workspaceId)
      if (current.revision !== expectedRevision) throw new FdeStageConflictError(current)
      if (current.currentStage !== from) throw new FdeStageTransitionError(current, from)
      const clearReconfirmation = current.reconfirmThrough !== undefined
        && (stateIndex(to) > stateIndex(current.reconfirmThrough)
          || (to === 'completed' && current.reconfirmThrough === 'completed'))
      const recordForNext = { ...current }
      if (clearReconfirmation) delete recordForNext.reconfirmThrough
      const next: ProjectStageRecord = {
        ...recordForNext,
        currentStage: to,
        revision: current.revision + 1,
        updatedAt: this.clock(),
      }
      await this.table.put(workspaceId, next)
      return next
    })
    this.transitions.set(workspaceId, attempt)
    return attempt.finally(() => {
      if (this.transitions.get(workspaceId) === attempt) this.transitions.delete(workspaceId)
    })
  }

  private async initialize(workspaceId: WorkspaceId): Promise<ProjectStageRecord> {
    const existing = this.table.get(workspaceId)
    if (existing !== undefined) return existing
    const now = this.clock()
    const record: ProjectStageRecord = {
      currentStage: 'requirements',
      revision: 1,
      createdAt: now,
      updatedAt: now,
    }
    await this.table.put(workspaceId, record)
    return record
  }
}
