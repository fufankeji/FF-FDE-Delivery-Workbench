/** Workspace-keyed stage initialization over the authoritative domain table. */

import type { KvTable } from '@deepseek-ai/dsh-storage-domain'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace'
import type { FdeStageId, ProjectStageRecord } from './spec.ts'

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
            : expected
    super(`当前项目已经不在${label}阶段。`)
    this.name = 'FdeStageTransitionError'
  }
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

  private transition(
    workspaceId: WorkspaceId,
    expectedRevision: number,
    from: FdeStageId,
    to: FdeStageId,
  ): Promise<ProjectStageRecord> {
    const before = this.transitions.get(workspaceId) ?? Promise.resolve(undefined)
    const attempt = before.catch(() => undefined).then(async () => {
      const current = await this.open(workspaceId)
      if (current.revision !== expectedRevision) throw new FdeStageConflictError(current)
      if (current.currentStage !== from) throw new FdeStageTransitionError(current, from)
      const next: ProjectStageRecord = {
        ...current,
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
