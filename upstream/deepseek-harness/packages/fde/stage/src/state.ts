/** Workspace-keyed stage initialization over the authoritative domain table. */

import type { KvTable } from '@deepseek-ai/dsh-storage-domain'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace'
import type { ProjectStageRecord } from './spec.ts'

/** Clock dependency used to stamp the one initial record. */
export type StageClock = () => string

/** Owns current-stage reads and coalesces one Workspace's first durable write. */
export class FdeStageState {
  private readonly pending = new Map<WorkspaceId, Promise<ProjectStageRecord>>()

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
