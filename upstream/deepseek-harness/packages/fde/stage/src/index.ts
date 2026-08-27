/** FDE project-stage Host plugin. @module @deepseek-ai/dsh-fde-stage */

import type { Context } from '@deepseek-ai/cordis'
import { isTrustedApiRequest } from '@deepseek-ai/dsh-client-connection'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-storage-domain'
import { WorkspaceId } from '@deepseek-ai/dsh-workspace'
import { createStageRoute } from './http.ts'
import { fdeStageDomainSpec } from './spec.ts'
import { FdeStageState } from './state.ts'

export { FdeStageRequestError, createStageRoute } from './http.ts'
export { FDE_STAGE_IDS, fdeStageDomainSpec, fdeStageId, projectStageRecord } from './spec.ts'
export type { FdeStageId, ProjectStageRecord } from './spec.ts'

/** Stable Host route used by the FDE Stage browser plugin. */
export const FDE_STAGE_OPEN_PATH = '/api/fde-stage/open'
/** Cordis plugin name. */
export const name = 'fde-stage'
/** Required durable Workspace and same-origin Web services. */
export const inject = ['storageDomain', 'workspaceRegistry', 'webServer']

/**
 * Open the project-stage domain and register the read/initialize route.
 * @param ctx - Host context carrying storage, Workspace registry, and WebServer.
 */
export async function apply(ctx: Context): Promise<void> {
  const domain = await ctx.storageDomain.open(fdeStageDomainSpec)
  const state = new FdeStageState(domain.table('projects'))
  ctx.effect(() => async () => { await domain.close() }, 'fde-stage: domain')
  const handler = createStageRoute({
    trusted: request => isTrustedApiRequest(request, []),
    workspaceExists: id => ctx.workspaceRegistry.get(WorkspaceId(id)) !== undefined,
    open: workspaceId => state.open(workspaceId),
    reportFailure: (error) => { ctx.logger.warn(error instanceof Error ? error : new Error(String(error))) },
  })
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: FDE_STAGE_OPEN_PATH,
    handler,
  }), `fde-stage: ${FDE_STAGE_OPEN_PATH}`)
}

/** No model-facing content: the current slice only persists and presents project stage. */
export const modelExperience = 'none'
