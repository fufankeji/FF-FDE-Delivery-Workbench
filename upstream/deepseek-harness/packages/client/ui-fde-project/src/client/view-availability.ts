/** Stage-aware availability for project delivery conversation views. */

import { FDE_STAGE_IDS, type FdeStageId } from './stage-controller.ts'
import type { ProjectSurfaceSnapshot } from './controller.ts'

/** Project delivery views contributed by this plugin. */
export type FdeProjectViewId = 'fde-api-docs' | 'fde-architecture' | 'fde-observability' | 'fde-evaluation'

const MINIMUM_STAGE: Readonly<Record<FdeProjectViewId, FdeStageId>> = {
  'fde-architecture': 'solution',
  'fde-api-docs': 'development',
  'fde-observability': 'development',
  'fde-evaluation': 'validation',
}

/** Whether the project's current stage has reached the view's first useful stage. */
export function projectViewVisible(
  viewId: FdeProjectViewId,
  stage: FdeStageId | undefined,
  surface?: ProjectSurfaceSnapshot,
): boolean {
  if (stage === undefined) return false
  if (FDE_STAGE_IDS.indexOf(stage) < FDE_STAGE_IDS.indexOf(MINIMUM_STAGE[viewId])) return false
  if (viewId !== 'fde-api-docs') return true
  return surface?.runtime.status === 'running'
    && surface.apiDocs.status === 'configured'
    && surface.apiDocs.openapiSource !== undefined
}
