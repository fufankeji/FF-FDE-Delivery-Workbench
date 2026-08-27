/** FDE project delivery surfaces Host plugin. @module @deepseek-ai/dsh-fde-project */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { isTrustedApiRequest } from '@deepseek-ai/dsh-client-connection'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { WorkspaceId } from '@deepseek-ai/dsh-workspace'
import { registerProjectArchitectureTools } from './architecture-tools.ts'
import { registerProjectEvaluationGuard } from './evaluation-guard.ts'
import {
  createArchitectureConfirmRoute,
  createEvaluationBaselineRoute,
  createProjectSnapshotRoute,
  createRequirementArtifactFileRoute,
  createRequirementWikiAbandonRoute,
  createRequirementWikiStartRoute,
} from './http.ts'
import { registerProjectOpenApiTools, type ProjectOpenApiPolicy } from './openapi-tools.ts'
import { approveProjectEvaluationBaseline, confirmProjectArchitecture, loadProjectSurfaceSnapshot } from './snapshot.ts'
import { abandonRequirementWikiBuild, startRequirementWikiBuild } from './requirement-wiki.ts'
import { registerRequirementWikiTools } from './requirement-wiki-tools.ts'
import {
  REQUIREMENT_ARTIFACT_FILE_PATH,
  resolveRequirementArtifact,
} from './requirement-artifacts.ts'
import {
  SOLUTION_ARTIFACT_FILE_PATH,
  resolveSolutionArtifact,
} from './solution-artifacts.ts'
import {
  DEVELOPMENT_ARTIFACT_FILE_PATH,
  resolveDevelopmentArtifact,
} from './development-docs.ts'

export {
  FdeProjectRequestError,
  createArchitectureConfirmRoute,
  createEvaluationBaselineRoute,
  createProjectSnapshotRoute,
  createRequirementArtifactFileRoute,
  createRequirementWikiAbandonRoute,
  createRequirementWikiStartRoute,
} from './http.ts'
export {
  approveProjectEvaluationBaseline, confirmProjectArchitecture, loadProjectSurfaceSnapshot, projectSurfacePaths,
  readProjectArchitecture, replaceProjectArchitecture,
} from './snapshot.ts'
export { loadProjectOpenApiConfig } from './snapshot.ts'
export {
  abandonRequirementWikiBuild,
  loadRequirementWikiSnapshot,
  markRequirementWikiBuildRunning,
  parseRequirementWikiCandidate,
  publishRequirementWiki,
  readCurrentRequirementWiki,
  requirementWikiPaths,
  startRequirementWikiBuild,
} from './requirement-wiki.ts'
export { registerProjectArchitectureTools } from './architecture-tools.ts'
export {
  loadRequirementArtifacts,
  requirementArtifactFileUrl,
  REQUIREMENT_ARTIFACT_FILE_PATH,
  REQUIREMENT_ARTIFACT_ROOT,
  REQUIREMENT_ARTIFACTS,
  resolveRequirementArtifact,
} from './requirement-artifacts.ts'
export {
  loadSolutionArtifacts,
  solutionArtifactFileUrl,
  SOLUTION_ARTIFACT_FILE_PATH,
  SOLUTION_ARTIFACT_ROOT,
  SOLUTION_ARTIFACTS,
  resolveSolutionArtifact,
} from './solution-artifacts.ts'
export {
  DEVELOPMENT_ARTIFACT_FILE_PATH,
  DEVELOPMENT_CLOSURE_ARTIFACTS,
  DEVELOPMENT_CLOSURE_ROOT,
  DEVELOPMENT_DOCS_ROOT,
  loadDevelopmentDocs,
  resolveDevelopmentArtifact,
} from './development-docs.ts'
export { registerRequirementWikiTools } from './requirement-wiki-tools.ts'
export { projectEvaluationDecision, registerProjectEvaluationGuard } from './evaluation-guard.ts'
export { loadProjectOpenApiCatalog, registerProjectOpenApiTools } from './openapi-tools.ts'
export type * from './types.ts'

/** Trusted project snapshot route. */
export const FDE_PROJECT_SNAPSHOT_PATH = '/api/fde-project/snapshot'
/** Verified read-only route for one fixed requirement-research output. */
export const FDE_REQUIREMENT_ARTIFACT_FILE_PATH = REQUIREMENT_ARTIFACT_FILE_PATH
/** Verified read-only route for one fixed solution-design output. */
export const FDE_SOLUTION_ARTIFACT_FILE_PATH = SOLUTION_ARTIFACT_FILE_PATH
/** Verified read-only route for one Host-indexed project-development document. */
export const FDE_DEVELOPMENT_ARTIFACT_FILE_PATH = DEVELOPMENT_ARTIFACT_FILE_PATH
/** Exact-revision project architecture confirmation route. */
export const FDE_ARCHITECTURE_CONFIRM_PATH = '/api/fde-project/architecture/confirm'
/** Project evaluation baseline approval route. */
export const FDE_EVALUATION_BASELINE_PATH = '/api/fde-project/evaluation/baseline'
/** Explicit project requirement-Wiki build start route. */
export const FDE_REQUIREMENT_WIKI_START_PATH = '/api/fde-project/requirement-wiki/start'
/** Explicit project requirement-Wiki build abandonment route. */
export const FDE_REQUIREMENT_WIKI_ABANDON_PATH = '/api/fde-project/requirement-wiki/abandon'
export const name = 'fde-project'
export const inject = ['tools', 'webServer', 'workspaceRegistry']

/** Bounded OpenAPI parsing and request limits enforced by dsh-openapi. */
export interface Config extends ProjectOpenApiPolicy {
  readonly artifactPreviewMaxBytes: number
}

/** Project OpenAPI limits; deployments may tighten them without changing tools. */
export const Config: z<Config> = z.object({
  timeoutMs: z.number().default(30_000),
  maxSpecBytes: z.number().default(2_097_152),
  maxResponseBytes: z.number().default(262_144),
  maxRedirects: z.number().default(3),
  maxOperations: z.number().default(1_000),
  artifactPreviewMaxBytes: z.number().default(2_097_152),
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
  positiveInteger('artifactPreviewMaxBytes', config.artifactPreviewMaxBytes, 1_024)
  registerProjectOpenApiTools(ctx, config)
  registerProjectArchitectureTools(ctx)
  registerRequirementWikiTools(ctx)
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
  const artifactFile = createRequirementArtifactFileRoute({
    trusted: request => isTrustedApiRequest(request, []),
    artifact: async (workspaceId, artifactId) => {
      const workspace = ctx.workspaceRegistry.get(WorkspaceId(workspaceId))
      if (workspace === undefined) return undefined
      return await resolveRequirementArtifact(workspace.path, artifactId)
    },
    maxFileBytes: config.artifactPreviewMaxBytes,
    reportFailure,
  })
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: FDE_REQUIREMENT_ARTIFACT_FILE_PATH,
    handler: artifactFile,
  }), `fde-project: ${FDE_REQUIREMENT_ARTIFACT_FILE_PATH}`)
  const solutionArtifactFile = createRequirementArtifactFileRoute({
    trusted: request => isTrustedApiRequest(request, []),
    artifact: async (workspaceId, artifactId) => {
      const workspace = ctx.workspaceRegistry.get(WorkspaceId(workspaceId))
      if (workspace === undefined) return undefined
      return await resolveSolutionArtifact(workspace.path, artifactId)
    },
    maxFileBytes: config.artifactPreviewMaxBytes,
    reportFailure,
  })
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: FDE_SOLUTION_ARTIFACT_FILE_PATH,
    handler: solutionArtifactFile,
  }), `fde-project: ${FDE_SOLUTION_ARTIFACT_FILE_PATH}`)
  const developmentArtifactFile = createRequirementArtifactFileRoute({
    trusted: request => isTrustedApiRequest(request, []),
    artifact: async (workspaceId, artifactId) => {
      const workspace = ctx.workspaceRegistry.get(WorkspaceId(workspaceId))
      if (workspace === undefined) return undefined
      return await resolveDevelopmentArtifact(workspace.path, artifactId)
    },
    maxFileBytes: config.artifactPreviewMaxBytes,
    reportFailure,
  })
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: FDE_DEVELOPMENT_ARTIFACT_FILE_PATH,
    handler: developmentArtifactFile,
  }), `fde-project: ${FDE_DEVELOPMENT_ARTIFACT_FILE_PATH}`)
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
  const startWiki = createRequirementWikiStartRoute({
    trusted: request => isTrustedApiRequest(request, []),
    start: async (workspaceId, sourceIds, expectedRevision) => {
      const workspace = ctx.workspaceRegistry.get(WorkspaceId(workspaceId))
      if (workspace === undefined) return undefined
      await startRequirementWikiBuild(workspace.path, sourceIds, expectedRevision)
      return await loadProjectSurfaceSnapshot({ workspaceId, title: workspace.title, path: workspace.path })
    },
    reportFailure,
  })
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: FDE_REQUIREMENT_WIKI_START_PATH,
    handler: startWiki,
  }), `fde-project: ${FDE_REQUIREMENT_WIKI_START_PATH}`)
  const abandonWiki = createRequirementWikiAbandonRoute({
    trusted: request => isTrustedApiRequest(request, []),
    abandon: async (workspaceId, buildId) => {
      const workspace = ctx.workspaceRegistry.get(WorkspaceId(workspaceId))
      if (workspace === undefined) return undefined
      await abandonRequirementWikiBuild(workspace.path, buildId)
      return await loadProjectSurfaceSnapshot({ workspaceId, title: workspace.title, path: workspace.path })
    },
    reportFailure,
  })
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: FDE_REQUIREMENT_WIKI_ABANDON_PATH,
    handler: abandonWiki,
  }), `fde-project: ${FDE_REQUIREMENT_WIKI_ABANDON_PATH}`)
}
