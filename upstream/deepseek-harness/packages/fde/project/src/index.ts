/** FDE project delivery surfaces Host plugin. @module @deepseek-ai/dsh-fde-project */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { isTrustedApiRequest } from '@deepseek-ai/dsh-client-connection'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { WorkspaceId } from '@deepseek-ai/dsh-workspace'
import { registerProjectArchitectureTools } from './architecture-tools.ts'
import { registerProjectEvaluationGuard } from './evaluation-guard.ts'
import { registerEvaluationWorkbenchTools } from './evaluation-workbench-tools.ts'
import {
  createArchitectureConfirmRoute,
  createAcceptanceHandoverDecisionRoute,
  createDeploymentTrialIssueAcceptRoute,
  createDeploymentTrialReadinessConfirmRoute,
  createEvaluationBaselineRoute,
  createProjectSnapshotRoute,
  createProjectPreviewRoute,
  createProjectRuntimeAbandonRoute,
  createProjectRuntimeStartRoute,
  createProjectRuntimeStopRoute,
  createRequirementArtifactFileRoute,
  createValidationMetricAcceptRoute,
  createValidationIssueWaiveRoute,
  createValidationPlanConfirmRoute,
} from './http.ts'
import { registerProjectOpenApiTools, type ProjectOpenApiPolicy } from './openapi-tools.ts'
import { approveProjectEvaluationBaseline, confirmProjectArchitecture, loadProjectSurfaceSnapshot } from './snapshot.ts'
import {
  abandonProjectRuntimeOperation,
  beginProjectRuntimeOperation,
  loadProjectRuntimeSnapshot,
} from './project-runtime.ts'
import { ProjectPreviewGateway } from './project-preview.ts'
import { registerProjectRuntimeTools } from './project-runtime-tools.ts'
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
import {
  acceptValidationMetric,
  confirmValidationPlan,
  resolveValidationArtifact,
  VALIDATION_ARTIFACT_FILE_PATH,
  waiveValidationIssue,
} from './validation.ts'
import {
  ACCEPTANCE_HANDOVER_ARTIFACT_FILE_PATH,
  acceptDeploymentTrialIssue,
  confirmDeploymentTrialReadiness,
  DEPLOYMENT_TRIAL_ARTIFACT_FILE_PATH,
  recordAcceptanceHandoverDecision,
  resolveAcceptanceHandoverArtifact,
  resolveDeploymentTrialArtifact,
} from './delivery-closeout.ts'

export {
  FdeProjectRequestError,
  createArchitectureConfirmRoute,
  createAcceptanceHandoverDecisionRoute,
  createDeploymentTrialIssueAcceptRoute,
  createDeploymentTrialReadinessConfirmRoute,
  createEvaluationBaselineRoute,
  createProjectSnapshotRoute,
  createProjectRuntimeAbandonRoute,
  createProjectRuntimeStartRoute,
  createProjectRuntimeStopRoute,
  createRequirementArtifactFileRoute,
  createValidationMetricAcceptRoute,
  createValidationIssueWaiveRoute,
  createValidationPlanConfirmRoute,
} from './http.ts'
export {
  approveProjectEvaluationBaseline, confirmProjectArchitecture, loadProjectSurfaceSnapshot, projectSurfacePaths,
  readProjectArchitecture, replaceProjectArchitecture,
} from './snapshot.ts'
export { loadProjectOpenApiConfig } from './snapshot.ts'
export { loadV2StageSurface, loadV2StageSurfaces, V2_STAGE_DEFINITIONS } from './v2-stage-surface.ts'
export { registerProjectArchitectureTools } from './architecture-tools.ts'
export { DISCOVERY_CAPABILITY_ROUTE, loadDiscoveryStage } from './discovery-stage.ts'
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
export {
  acceptValidationMetric,
  confirmValidationPlan,
  loadValidationStage,
  resolveValidationArtifact,
  VALIDATION_ARTIFACT_FILE_PATH,
  VALIDATION_ARTIFACT_ROOT,
  VALIDATION_ARTIFACTS,
  VALIDATION_CONTRACT_PATH,
  VALIDATION_PLAN_APPROVAL_PATH,
  waiveValidationIssue,
} from './validation.ts'
export {
  ACCEPTANCE_HANDOVER_ARTIFACT_FILE_PATH,
  ACCEPTANCE_HANDOVER_ARTIFACT_ROOT,
  ACCEPTANCE_HANDOVER_ARTIFACTS,
  ACCEPTANCE_HANDOVER_CONTRACT_PATH,
  DEPLOYMENT_TRIAL_ARTIFACT_FILE_PATH,
  DEPLOYMENT_TRIAL_ARTIFACT_ROOT,
  DEPLOYMENT_TRIAL_ARTIFACTS,
  DEPLOYMENT_TRIAL_CONTRACT_PATH,
  acceptDeploymentTrialIssue,
  confirmDeploymentTrialReadiness,
  loadAcceptanceHandoverStage,
  loadDeploymentTrialStage,
  recordAcceptanceHandoverDecision,
  resolveAcceptanceHandoverArtifact,
  resolveDeploymentTrialArtifact,
} from './delivery-closeout.ts'
export {
  abandonProjectRuntimeOperation,
  beginProjectRuntimeOperation,
  loadProjectRuntimeSnapshot,
  PROJECT_RUNTIME_PATH,
  projectRuntimeUrl,
  readProjectRuntime,
  reportProjectRuntime,
} from './project-runtime.ts'
export { registerProjectRuntimeTools } from './project-runtime-tools.ts'
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
/** Verified read-only route for one fixed validation output. */
export const FDE_VALIDATION_ARTIFACT_FILE_PATH = VALIDATION_ARTIFACT_FILE_PATH
/** Verified read-only route for one fixed deployment-trial output. */
export const FDE_DEPLOYMENT_TRIAL_ARTIFACT_FILE_PATH = DEPLOYMENT_TRIAL_ARTIFACT_FILE_PATH
/** Verified read-only route for one fixed acceptance-handover output. */
export const FDE_ACCEPTANCE_HANDOVER_ARTIFACT_FILE_PATH = ACCEPTANCE_HANDOVER_ARTIFACT_FILE_PATH
/** Exact-revision project architecture confirmation route. */
export const FDE_ARCHITECTURE_CONFIRM_PATH = '/api/fde-project/architecture/confirm'
/** Exact-contract validation plan confirmation route. */
export const FDE_VALIDATION_PLAN_CONFIRM_PATH = '/api/fde-project/validation/confirm-plan'
/** Exact-contract validation metric manual-acceptance route. */
export const FDE_VALIDATION_METRIC_ACCEPT_PATH = '/api/fde-project/validation/accept-metric'
/** Exact-contract validation issue manual-acceptance route. */
export const FDE_VALIDATION_ISSUE_WAIVE_PATH = '/api/fde-project/validation/waive-issue'
/** Exact-contract deployment-trial issue manual-acceptance route. */
export const FDE_DEPLOYMENT_TRIAL_ISSUE_ACCEPT_PATH = '/api/fde-project/pilot/accept-issue'
/** Exact-contract deployment-trial target-environment and readiness confirmation route. */
export const FDE_DEPLOYMENT_TRIAL_READINESS_CONFIRM_PATH = '/api/fde-project/pilot/confirm-readiness'
/** Exact-contract acceptance-handover decision route. */
export const FDE_ACCEPTANCE_HANDOVER_DECISION_PATH = '/api/fde-project/handoff/record-decision'
/** Project evaluation baseline approval route. */
export const FDE_EVALUATION_BASELINE_PATH = '/api/fde-project/evaluation/baseline'
/** Begin one Agent-driven project start operation. */
export const FDE_PROJECT_RUNTIME_START_PATH = '/api/fde-project/runtime/start'
/** Begin one Agent-driven project stop operation. */
export const FDE_PROJECT_RUNTIME_STOP_PATH = '/api/fde-project/runtime/stop'
/** Settle an operation whose visible Agent prompt could not be queued. */
export const FDE_PROJECT_RUNTIME_ABANDON_PATH = '/api/fde-project/runtime/abandon'
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
  registerProjectRuntimeTools(ctx)
  registerProjectEvaluationGuard(ctx)
  registerEvaluationWorkbenchTools(ctx)
  const reportFailure = (error: unknown): void => { ctx.logger.warn(error instanceof Error ? error : new Error(String(error))) }
  const previews = new ProjectPreviewGateway({
    platformPort: ctx.webServer.port,
    timeoutMs: config.timeoutMs,
    target: async workspaceId => {
      const workspace = ctx.workspaceRegistry.get(WorkspaceId(workspaceId))
      if (workspace === undefined) return undefined
      const runtime = await loadProjectRuntimeSnapshot(workspace.path)
      return runtime.status === 'running' ? runtime.previewUrl : undefined
    },
  })
  ctx.effect(() => () => previews.dispose(), 'fde-project: isolated previews')
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact', path: '/api/fde-project/runtime/preview',
    handler: createProjectPreviewRoute({ trusted: request => isTrustedApiRequest(request, []), open: (id, parent) => previews.open(id, parent) }),
  }), 'fde-project: preview route')
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
  const validationArtifactFile = createRequirementArtifactFileRoute({
    trusted: request => isTrustedApiRequest(request, []),
    artifact: async (workspaceId, artifactId) => {
      const workspace = ctx.workspaceRegistry.get(WorkspaceId(workspaceId))
      if (workspace === undefined) return undefined
      return await resolveValidationArtifact(workspace.path, artifactId)
    },
    maxFileBytes: config.artifactPreviewMaxBytes,
    reportFailure,
  })
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: FDE_VALIDATION_ARTIFACT_FILE_PATH,
    handler: validationArtifactFile,
  }), `fde-project: ${FDE_VALIDATION_ARTIFACT_FILE_PATH}`)
  const deploymentTrialArtifactFile = createRequirementArtifactFileRoute({
    trusted: request => isTrustedApiRequest(request, []),
    artifact: async (workspaceId, artifactId) => {
      const workspace = ctx.workspaceRegistry.get(WorkspaceId(workspaceId))
      if (workspace === undefined) return undefined
      return await resolveDeploymentTrialArtifact(workspace.path, artifactId)
    },
    maxFileBytes: config.artifactPreviewMaxBytes,
    reportFailure,
  })
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: FDE_DEPLOYMENT_TRIAL_ARTIFACT_FILE_PATH,
    handler: deploymentTrialArtifactFile,
  }), `fde-project: ${FDE_DEPLOYMENT_TRIAL_ARTIFACT_FILE_PATH}`)
  const acceptanceHandoverArtifactFile = createRequirementArtifactFileRoute({
    trusted: request => isTrustedApiRequest(request, []),
    artifact: async (workspaceId, artifactId) => {
      const workspace = ctx.workspaceRegistry.get(WorkspaceId(workspaceId))
      if (workspace === undefined) return undefined
      return await resolveAcceptanceHandoverArtifact(workspace.path, artifactId)
    },
    maxFileBytes: config.artifactPreviewMaxBytes,
    reportFailure,
  })
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: FDE_ACCEPTANCE_HANDOVER_ARTIFACT_FILE_PATH,
    handler: acceptanceHandoverArtifactFile,
  }), `fde-project: ${FDE_ACCEPTANCE_HANDOVER_ARTIFACT_FILE_PATH}`)
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
  const confirmPlan = createValidationPlanConfirmRoute({
    trusted: request => isTrustedApiRequest(request, []),
    confirm: async (workspaceId, contractDigest) => {
      const workspace = ctx.workspaceRegistry.get(WorkspaceId(workspaceId))
      if (workspace === undefined) return undefined
      await confirmValidationPlan(workspace.path, contractDigest)
      return await loadProjectSurfaceSnapshot({ workspaceId, title: workspace.title, path: workspace.path })
    },
    reportFailure,
  })
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: FDE_VALIDATION_PLAN_CONFIRM_PATH,
    handler: confirmPlan,
  }), `fde-project: ${FDE_VALIDATION_PLAN_CONFIRM_PATH}`)
  const acceptMetric = createValidationMetricAcceptRoute({
    trusted: request => isTrustedApiRequest(request, []),
    accept: async (workspaceId, contractDigest, metricId, reason) => {
      const workspace = ctx.workspaceRegistry.get(WorkspaceId(workspaceId))
      if (workspace === undefined) return undefined
      await acceptValidationMetric(workspace.path, contractDigest, metricId, reason)
      return await loadProjectSurfaceSnapshot({ workspaceId, title: workspace.title, path: workspace.path })
    },
    reportFailure,
  })
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: FDE_VALIDATION_METRIC_ACCEPT_PATH,
    handler: acceptMetric,
  }), `fde-project: ${FDE_VALIDATION_METRIC_ACCEPT_PATH}`)
  const waiveIssue = createValidationIssueWaiveRoute({
    trusted: request => isTrustedApiRequest(request, []),
    waive: async (workspaceId, contractDigest, issueId, reason) => {
      const workspace = ctx.workspaceRegistry.get(WorkspaceId(workspaceId))
      if (workspace === undefined) return undefined
      await waiveValidationIssue(workspace.path, contractDigest, issueId, reason)
      return await loadProjectSurfaceSnapshot({ workspaceId, title: workspace.title, path: workspace.path })
    },
    reportFailure,
  })
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: FDE_VALIDATION_ISSUE_WAIVE_PATH,
    handler: waiveIssue,
  }), `fde-project: ${FDE_VALIDATION_ISSUE_WAIVE_PATH}`)
  const acceptPilotIssue = createDeploymentTrialIssueAcceptRoute({
    trusted: request => isTrustedApiRequest(request, []),
    accept: async (workspaceId, contractDigest, issueId, reason) => {
      const workspace = ctx.workspaceRegistry.get(WorkspaceId(workspaceId))
      if (workspace === undefined) return undefined
      await acceptDeploymentTrialIssue(workspace.path, contractDigest, issueId, reason)
      return await loadProjectSurfaceSnapshot({ workspaceId, title: workspace.title, path: workspace.path })
    },
    reportFailure,
  })
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: FDE_DEPLOYMENT_TRIAL_ISSUE_ACCEPT_PATH,
    handler: acceptPilotIssue,
  }), `fde-project: ${FDE_DEPLOYMENT_TRIAL_ISSUE_ACCEPT_PATH}`)
  const confirmPilotReadiness = createDeploymentTrialReadinessConfirmRoute({
    trusted: request => isTrustedApiRequest(request, []),
    confirm: async (workspaceId, contractDigest) => {
      const workspace = ctx.workspaceRegistry.get(WorkspaceId(workspaceId))
      if (workspace === undefined) return undefined
      await confirmDeploymentTrialReadiness(workspace.path, contractDigest)
      return await loadProjectSurfaceSnapshot({ workspaceId, title: workspace.title, path: workspace.path })
    },
    reportFailure,
  })
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: FDE_DEPLOYMENT_TRIAL_READINESS_CONFIRM_PATH,
    handler: confirmPilotReadiness,
  }), `fde-project: ${FDE_DEPLOYMENT_TRIAL_READINESS_CONFIRM_PATH}`)
  const recordHandoffDecision = createAcceptanceHandoverDecisionRoute({
    trusted: request => isTrustedApiRequest(request, []),
    record: async (workspaceId, contractDigest, decision) => {
      const workspace = ctx.workspaceRegistry.get(WorkspaceId(workspaceId))
      if (workspace === undefined) return undefined
      await recordAcceptanceHandoverDecision(workspace.path, contractDigest, decision)
      return await loadProjectSurfaceSnapshot({ workspaceId, title: workspace.title, path: workspace.path })
    },
    reportFailure,
  })
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: FDE_ACCEPTANCE_HANDOVER_DECISION_PATH,
    handler: recordHandoffDecision,
  }), `fde-project: ${FDE_ACCEPTANCE_HANDOVER_DECISION_PATH}`)
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
  const startRuntime = createProjectRuntimeStartRoute({
    trusted: request => isTrustedApiRequest(request, []),
    act: async (workspaceId, sessionId) => {
      const workspace = ctx.workspaceRegistry.get(WorkspaceId(workspaceId))
      if (workspace === undefined) return undefined
      await beginProjectRuntimeOperation(workspace.path, 'start', sessionId)
      return await loadProjectSurfaceSnapshot({ workspaceId, title: workspace.title, path: workspace.path })
    },
    reportFailure,
  })
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: FDE_PROJECT_RUNTIME_START_PATH,
    handler: startRuntime,
  }), `fde-project: ${FDE_PROJECT_RUNTIME_START_PATH}`)
  const stopRuntime = createProjectRuntimeStopRoute({
    trusted: request => isTrustedApiRequest(request, []),
    act: async (workspaceId, sessionId) => {
      const workspace = ctx.workspaceRegistry.get(WorkspaceId(workspaceId))
      if (workspace === undefined) return undefined
      await beginProjectRuntimeOperation(workspace.path, 'stop', sessionId)
      return await loadProjectSurfaceSnapshot({ workspaceId, title: workspace.title, path: workspace.path })
    },
    reportFailure,
  })
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: FDE_PROJECT_RUNTIME_STOP_PATH,
    handler: stopRuntime,
  }), `fde-project: ${FDE_PROJECT_RUNTIME_STOP_PATH}`)
  const abandonRuntime = createProjectRuntimeAbandonRoute({
    trusted: request => isTrustedApiRequest(request, []),
    abandon: async (workspaceId, operationId, message) => {
      const workspace = ctx.workspaceRegistry.get(WorkspaceId(workspaceId))
      if (workspace === undefined) return undefined
      await abandonProjectRuntimeOperation(workspace.path, operationId, message)
      return await loadProjectSurfaceSnapshot({ workspaceId, title: workspace.title, path: workspace.path })
    },
    reportFailure,
  })
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: FDE_PROJECT_RUNTIME_ABANDON_PATH,
    handler: abandonRuntime,
  }), `fde-project: ${FDE_PROJECT_RUNTIME_ABANDON_PATH}`)
}
