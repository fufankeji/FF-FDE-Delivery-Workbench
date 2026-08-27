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

/** Runtime validation for the closed stage set. */
export const fdeStageId = z.enum(FDE_STAGE_IDS)

/** One Workspace's committed stage projection. */
export const projectStageRecord = z.object({
  currentStage: fdeStageId,
  revision: z.number().int().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
})

/** Stored stage record inferred from the durable schema. */
export type ProjectStageRecord = z.infer<typeof projectStageRecord>

/** Project-stage domain: one current record per Harness Workspace. */
export const fdeStageDomainSpec = defineDomain({
  name: 'fde_stage',
  version: 1,
  tables: { projects: domainTable<WorkspaceId, ProjectStageRecord>(projectStageRecord) },
})
