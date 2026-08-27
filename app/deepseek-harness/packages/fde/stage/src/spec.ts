/** Durable project-stage record and storage-domain declaration. @module @deepseek-ai/dsh-fde-stage/spec */

import { z } from 'zod'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace'

/** Stable FDE delivery stages in product order. */
export const FDE_STAGE_IDS = [
  'requirements',
  'solution',
  'development',
  'validation',
  'pilot',
  'handoff',
] as const

/** One project-level FDE delivery stage. */
export type FdeStageId = typeof FDE_STAGE_IDS[number]

/** Six active stages plus the terminal project-completed state. */
export const FDE_PROJECT_STATE_IDS = [...FDE_STAGE_IDS, 'completed'] as const

/** One durable project delivery state. */
export type FdeProjectState = typeof FDE_PROJECT_STATE_IDS[number]

/** Runtime validation for the closed stage set. */
export const fdeStageId = z.enum(FDE_STAGE_IDS)

/** Runtime validation for active stages and the terminal state. */
export const fdeProjectState = z.enum(FDE_PROJECT_STATE_IDS)

/** One explicit FDE decision to return a project by exactly one stage. */
export const stageReturnRecord = z.object({
  from: fdeProjectState,
  to: fdeStageId,
  reason: z.string().min(1).max(1000),
  returnedAt: z.string(),
  revision: z.number().int().min(2),
})

/** One Workspace's committed stage projection. */
export const projectStageRecord = z.object({
  currentStage: fdeProjectState,
  revision: z.number().int().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
  reconfirmThrough: fdeProjectState.optional(),
  returns: z.array(stageReturnRecord).max(50).optional(),
})

/** Stored stage record inferred from the durable schema. */
export type ProjectStageRecord = z.infer<typeof projectStageRecord>

/** Project-stage domain: one current record per Harness Workspace. */
export const fdeStageDomainSpec = defineDomain({
  name: 'fde_stage',
  version: 1,
  tables: { projects: domainTable<WorkspaceId, ProjectStageRecord>(projectStageRecord) },
})
