/** FDE project delivery surfaces Host plugin. @module @deepseek-ai/dsh-fde-project */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { isTrustedApiRequest } from '@deepseek-ai/dsh-client-connection'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { WorkspaceId } from '@deepseek-ai/dsh-workspace'
import { registerProjectArchitectureTools } from './architecture-tools.ts'
import { registerProjectEvaluationGuard } from './evaluation-guard.ts'
import { createArchitectureConfirmRoute, createEvaluationBaselineRoute, createProjectSnapshotRoute } from './http.ts'
import { registerProjectOpenApiTools, type ProjectOpenApiPolicy } from './openapi-tools.ts'
import { approveProjectEvaluationBaseline, confirmProjectArchitecture, loadProjectSurfaceSnapshot } from './snapshot.ts'

export {
  FdeProjectRequestError, createArchitectureConfirmRoute, createEvaluationBaselineRoute, createProjectSnapshotRoute,
} from './http.ts'
export {
  approveProjectEvaluationBaseline, confirmProjectArchitecture, loadProjectSurfaceSnapshot, projectSurfacePaths,
  readProjectArchitecture, replaceProjectArchitecture,
} from './snapshot.ts'
export { loadProjectOpenApiConfig } from './snapshot.ts'
export { registerProjectArchitectureTools } from './architecture-tools.ts'
export { projectEvaluationDecision, registerProjectEvaluationGuard } from './evaluation-guard.ts'
export { loadProjectOpenApiCatalog, registerProjectOpenApiTools } from './openapi-tools.ts'
export type * from './types.ts'

/** Trusted project snapshot route. */
export const FDE_PROJECT_SNAPSHOT_PATH = '/api/fde-project/snapshot'
/** Exact-revision project architecture confirmation route. */
export const FDE_ARCHITECTURE_CONFIRM_PATH = '/api/fde-project/architecture/confirm'
/** Project evaluation baseline approval route. */
export const FDE_EVALUATION_BASELINE_PATH = '/api/fde-project/evaluation/baseline'
export const name = 'fde-project'
export const inject = ['tools', 'webServer', 'workspaceRegistry']

/** Bounded OpenAPI parsing and request limits enforced by dsh-openapi. */
export interface Config extends ProjectOpenApiPolicy {}

/** Project OpenAPI limits; deployments may tighten them without changing tools. */
export const Config: z<Config> = z.object({
  timeoutMs: z.number().default(30_000),
  maxSpecBytes: z.number().default(2_097_152),
  maxResponseBytes: z.number().default(262_144),
  maxRedirects: z.number().default(3),
  maxOperations: z.number().default(1_000),
})

function positiveInteger(label: string, value: number, minimum: number): void {
  if (!Number.isSafeInteger(value) || value < minimum) throw new Error(`fde-project: ${label} must be an integer >= ${String(minimum)}`)
}

/** Register one trusted read-only endpoint for project API, architecture, and eval artifacts. */
export function apply(ctx: Context, config: Config): void {
  positiveInteger('timeoutMs', config.timeoutMs, 1)
  positiveInteger('maxSpecBytes', config.maxSpecBytes, 1_024)
  positiveInteger('maxResponseBytes', config.maxResponseBytes, 1_024)
  positiveInteger('maxRedirects', config.maxRedirects, 0)
  positiveInteger('maxOperations', config.maxOperations, 1)
  registerProjectOpenApiTools(ctx, config)
  registerProjectArchitectureTools(ctx)
  registerProjectEvaluationGuard(ctx)
  const reportFailure = (error: unknown): void => { ctx.logger.warn(error instanceof Error ? error : new Error(String(error))) }
  const handler = createProjectSnapshotRoute({
    trusted: request => isTrustedApiRequest(request, []),
    snapshot: async (workspaceId) => {
      const workspace = ctx.workspaceRegistry.get(WorkspaceId(workspaceId))
      if (workspace === undefined) return undefined
      return await loadProjectSurfaceSnapshot({
        workspaceId,
        title: workspace.title,
        path: workspace.path,
      })
    },
    reportFailure,
  })
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: FDE_PROJECT_SNAPSHOT_PATH,
    handler,
  }), `fde-project: ${FDE_PROJECT_SNAPSHOT_PATH}`)
  const confirm = createArchitectureConfirmRoute({
    trusted: request => isTrustedApiRequest(request, []),
    confirm: async (workspaceId, revision) => {
      const workspace = ctx.workspaceRegistry.get(WorkspaceId(workspaceId))
      if (workspace === undefined) return undefined
      await confirmProjectArchitecture(workspace.path, revision)
      return await loadProjectSurfaceSnapshot({ workspaceId, title: workspace.title, path: workspace.path })
    },
    reportFailure,
  })
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: FDE_ARCHITECTURE_CONFIRM_PATH,
    handler: confirm,
  }), `fde-project: ${FDE_ARCHITECTURE_CONFIRM_PATH}`)
  const baseline = createEvaluationBaselineRoute({
    trusted: request => isTrustedApiRequest(request, []),
    approve: async (workspaceId, reportPath) => {
      const workspace = ctx.workspaceRegistry.get(WorkspaceId(workspaceId))
      if (workspace === undefined) return undefined
      await approveProjectEvaluationBaseline(workspace.path, reportPath)
      return await loadProjectSurfaceSnapshot({ workspaceId, title: workspace.title, path: workspace.path })
    },
    reportFailure,
  })
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: FDE_EVALUATION_BASELINE_PATH,
    handler: baseline,
  }), `fde-project: ${FDE_EVALUATION_BASELINE_PATH}`)
}
