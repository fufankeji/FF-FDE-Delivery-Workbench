/** Workspace-keyed stage initialization over the authoritative domain table. */

import type { KvTable } from '@deepseek-ai/dsh-storage-domain'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace'
import { FDE_PROJECT_STATE_IDS, FDE_V2_STAGE_IDS } from './spec.ts'
import type { FdeProjectState, FdeStageId, FdeV2StageId, ProjectStageRecord } from './spec.ts'

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
  constructor(readonly current: ProjectStageRecord, expected: FdeStageId | FdeV2StageId) {
    const label: Readonly<Record<FdeStageId | FdeV2StageId, string>> = {
      requirements: '需求调研', solution: '方案设计', development: '项目开发', validation: '验证评估',
      handoff: '验收移交', discovery: '发现高价值问题', definition: '定义结果、范围与责任',
      investigation: '调查数据、系统、接口、安全与组织', design: '设计方案并完成端到端纵向切片',
      evaluation: '运行 PoC 与 Eval', pilot: '企业集成、可靠性改造与受控 Pilot',
      production: '进入生产、推动采用并验收交接', improvement: '持续改进并沉淀可复用能力',
    }
    super(`当前项目已经不在${label[expected]}阶段。`)
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

const LEGACY_TO_V2: Readonly<Record<FdeProjectState, FdeV2StageId>> = {
  requirements: 'discovery',
  solution: 'definition',
  development: 'design',
  validation: 'evaluation',
  pilot: 'pilot',
  handoff: 'production',
  completed: 'improvement',
}

const V2_TO_LEGACY: Readonly<Record<FdeV2StageId, FdeProjectState>> = {
  discovery: 'requirements',
  definition: 'solution',
  investigation: 'solution',
  design: 'development',
  evaluation: 'validation',
  pilot: 'pilot',
  production: 'handoff',
  improvement: 'completed',
}

function stateIndex(state: FdeProjectState): number {
  return FDE_PROJECT_STATE_IDS.indexOf(state)
}

function v2StateIndex(state: FdeV2StageId): number {
  return FDE_V2_STAGE_IDS.indexOf(state)
}

function withV2State(record: ProjectStageRecord): ProjectStageRecord {
  if (record.lifecycleVersion === 2 && record.v2Stage !== undefined) return record
  return {
    ...record,
    lifecycleVersion: 2,
    v2Stage: LEGACY_TO_V2[record.currentStage],
    improvementCycles: record.currentStage === 'completed' ? 1 : 0,
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
    if (existing !== undefined) {
      const upgraded = withV2State(existing)
      if (upgraded !== existing) {
        return this.table.put(workspaceId, upgraded).then(() => upgraded)
      }
      return Promise.resolve(existing)
    }
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

  /** Complete one exact V2 stage after an FDE review. The improvement stage records a cycle without leaving it. */
  completeV2(workspaceId: WorkspaceId, expectedRevision: number, expectedStage: FdeV2StageId): Promise<ProjectStageRecord> {
    const index = v2StateIndex(expectedStage)
    const nextStage = FDE_V2_STAGE_IDS[index + 1]
    return this.transitionV2(workspaceId, expectedRevision, expectedStage, nextStage)
  }

  /** Return exactly one authoritative V2 stage while retaining files and evidence. */
  returnV2ToPrevious(workspaceId: WorkspaceId, expectedRevision: number, reason: string): Promise<ProjectStageRecord> {
    const normalizedReason = reason.trim()
    if (normalizedReason === '' || normalizedReason.length > 1000) {
      return Promise.reject(new Error('返回原因必须填写，且不能超过 1000 个字符。'))
    }
    return this.serialize(workspaceId, async () => {
      const current = await this.open(workspaceId)
      if (current.revision !== expectedRevision) throw new FdeStageConflictError(current)
      const from = current.v2Stage ?? LEGACY_TO_V2[current.currentStage]
      const index = v2StateIndex(from)
      if (index === 0) throw new FdeStageReturnError(current, '发现高价值问题已经是第一个阶段，不能继续返回。')
      const to = FDE_V2_STAGE_IDS[index - 1]
      if (to === undefined) throw new FdeStageReturnError(current, '当前阶段没有可返回的上一阶段。')
      const returnedAt = this.clock()
      const revision = current.revision + 1
      const existingBoundary = current.v2ReconfirmThrough
      const v2ReconfirmThrough = existingBoundary === undefined || index > v2StateIndex(existingBoundary)
        ? from
        : existingBoundary
      const next: ProjectStageRecord = {
        ...current,
        lifecycleVersion: 2,
        v2Stage: to,
        currentStage: V2_TO_LEGACY[to],
        revision,
        updatedAt: returnedAt,
        v2ReconfirmThrough,
        v2Returns: [...(current.v2Returns ?? []), { from, to, reason: normalizedReason, returnedAt, revision }].slice(-50),
      }
      await this.table.put(workspaceId, next)
      return next
    })
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
        lifecycleVersion: 2,
        v2Stage: LEGACY_TO_V2[to],
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

  private transitionV2(
    workspaceId: WorkspaceId,
    expectedRevision: number,
    from: FdeV2StageId,
    to: FdeV2StageId | undefined,
  ): Promise<ProjectStageRecord> {
    return this.serialize(workspaceId, async () => {
      const current = await this.open(workspaceId)
      if (current.revision !== expectedRevision) throw new FdeStageConflictError(current)
      const currentV2 = current.v2Stage ?? LEGACY_TO_V2[current.currentStage]
      if (currentV2 !== from) throw new FdeStageTransitionError(current, from)
      const now = this.clock()
      const target = to ?? from
      const boundary = current.v2ReconfirmThrough
      const clearReconfirmation = boundary !== undefined && (
        v2StateIndex(target) > v2StateIndex(boundary)
        || (to === undefined && from === boundary)
      )
      const next: ProjectStageRecord = {
        ...current,
        lifecycleVersion: 2,
        v2Stage: target,
        currentStage: V2_TO_LEGACY[target],
        revision: current.revision + 1,
        updatedAt: now,
        ...(to === undefined
          ? { improvementCycles: (current.improvementCycles ?? 0) + 1, lastReviewedAt: now }
          : {}),
      }
      if (clearReconfirmation) delete next.v2ReconfirmThrough
      await this.table.put(workspaceId, next)
      return next
    })
  }

  private serialize(
    workspaceId: WorkspaceId,
    operation: () => Promise<ProjectStageRecord>,
  ): Promise<ProjectStageRecord> {
    const before = this.transitions.get(workspaceId) ?? Promise.resolve(undefined)
    const attempt = before.catch(() => undefined).then(operation)
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
      lifecycleVersion: 2,
      v2Stage: 'discovery',
      improvementCycles: 0,
      revision: 1,
      createdAt: now,
      updatedAt: now,
    }
    await this.table.put(workspaceId, record)
    return record
  }
}
