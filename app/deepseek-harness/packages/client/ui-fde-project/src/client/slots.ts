/** Slot component props and injected FDE project faces. */

import type { InjectFace, PropsLocale, PropsRenderSlots, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { AcceptanceHandoverDecision, FdeProjectSurfaceController } from './controller.ts'
import type { ProjectPageController } from './page-controller.ts'
import type { ProjectStageController } from './stage-controller.ts'
import type { ProjectSourceController, ProjectSourcePreviewKind } from './source-controller.ts'
import type { RequirementWikiController } from './wiki-controller.ts'

/** Exact project Session and model selection confirmed for one Wiki run. */
export interface RequirementWikiRunTarget {
  readonly sessionId: string
  readonly provider: string
  readonly providerName: string
  readonly model: string
  readonly modelName: string
}

/** Browser-safe read-only file currency passed from Project Detail to one preview occupant. */
export interface ProjectPreviewFile {
  readonly fileUrl: string
  readonly name: string
  readonly bytes?: number
  readonly previewKind: ProjectSourcePreviewKind
}

/** Read-only project file passed from Project Detail to one preview occupant. */
export interface ProjectSourcePreviewOwnerProps {
  readonly source: ProjectPreviewFile
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    /** One shared read-only renderer for a selected project source or fixed deliverable. */
    'fde.project.source.preview': { kind: 'single'; scope: 'root'; owner: ProjectSourcePreviewOwnerProps }
  }
}

/** Root-page callbacks and observables injected into the launcher and overlay. */
export interface ProjectPageInjected {
  hooks: {
    projectPage: ProjectPageController
    stageProgress: ProjectStageController
    projectSurfaces: FdeProjectSurfaceController
    projectSources: ProjectSourceController
    requirementWiki: RequirementWikiController
  }
  loadStage: (workspaceId: string) => void
  retryStage: (workspaceId: string) => void
  loadProjectSurface: (workspaceId: string) => void
  refreshProjectSurface: (workspaceId: string) => void
  completeRequirements: (workspaceId: string, expectedRevision: number) => Promise<void>
  completeSolution: (workspaceId: string, expectedRevision: number) => Promise<void>
  completeDevelopment: (workspaceId: string, expectedRevision: number) => Promise<void>
  completeValidation: (workspaceId: string, expectedRevision: number) => Promise<void>
  completePilot: (workspaceId: string, expectedRevision: number) => Promise<void>
  completeHandoff: (workspaceId: string, expectedRevision: number) => Promise<void>
  returnToPrevious: (workspaceId: string, expectedRevision: number, reason: string) => Promise<void>
  acceptValidationMetric: (
    workspaceId: string,
    contractDigest: string,
    metricId: string,
    reason: string,
  ) => Promise<void>
  waiveValidationIssue: (
    workspaceId: string,
    contractDigest: string,
    issueId: string,
    reason: string,
  ) => Promise<void>
  acceptDeploymentTrialIssue: (
    workspaceId: string,
    contractDigest: string,
    issueId: string,
    reason: string,
  ) => Promise<void>
  confirmDeploymentTrialReadiness: (workspaceId: string, contractDigest: string) => Promise<void>
  recordAcceptanceHandoverDecision: (
    workspaceId: string,
    contractDigest: string,
    decision: AcceptanceHandoverDecision,
  ) => Promise<void>
  loadProjectSources: (workspaceId: string, force?: boolean) => void
  parseProjectSource: (workspaceId: string, sourceId: string) => Promise<void>
  loadRequirementWiki: (workspaceId: string, force?: boolean) => void
  prepareRequirementWikiRun: (workspaceId: string, sessionId: string) => Promise<RequirementWikiRunTarget>
  startRequirementWikiBuild: (
    workspaceId: string,
    sourceIds: readonly string[],
    expectedRevision: number,
    target: RequirementWikiRunTarget,
  ) => Promise<void>
  abandonRequirementWikiBuild: (workspaceId: string, buildId: string) => Promise<void>
  enterProject: (workspaceId: string) => Promise<void>
  reviewProjectArchitecture: (workspaceId: string) => Promise<void>
  closeProjectPage: () => void
  openProjectPage: () => void
  showProjectOverview: () => void
  showProjectTimeline: () => void
  showProjectDetail: (workspaceId: string) => void
}

/** Current-project callbacks and snapshot observable injected into project views. */
export interface ProjectViewInjected {
  hooks: { projectSurfaces: FdeProjectSurfaceController }
  loadProjectSurface: (workspaceId: string) => void
  refreshProjectSurface: (workspaceId: string) => void
  prepareValidationPlan: () => Promise<void>
  confirmValidationPlan: (workspaceId: string, contractDigest: string) => Promise<void>
  startValidation: () => Promise<void>
  runProjectEvaluation: (workspacePath: string) => Promise<void>
  requestArchitectureDraft: (currentRevision: number) => Promise<void>
  confirmProjectArchitecture: (workspaceId: string, revision: number) => Promise<void>
  approveEvaluationBaseline: (workspaceId: string, reportPath: string) => Promise<void>
}

/** Current-Session project runtime actions and observables injected into the header utility. */
export interface ProjectRuntimeHeaderInjected {
  hooks: {
    projectSurfaces: FdeProjectSurfaceController
    stageProgress: ProjectStageController
  }
  loadStage: (workspaceId: string) => void
  loadProjectSurface: (workspaceId: string) => void
  pollProjectSurface: (workspaceId: string) => void
  startProject: (workspaceId: string, sessionId: string, workspacePath: string) => Promise<void>
  stopProject: (workspaceId: string, sessionId: string, workspacePath: string) => Promise<void>
  openProjectPreview: (workspaceId: string, sessionId: string, workspacePath: string) => Promise<void>
  showProjectTerminal: (workspaceId: string, sessionId: string, workspacePath: string) => Promise<void>
  continueDevelopment: (sessionId: string) => void
}

/** Props for the sidebar Project Progress launcher. */
export type ProjectProgressLauncherProps =
  PropsRuntime<'sidebar.footer.action'> & InjectFace<ProjectPageInjected> & PropsLocale<'fdeProject'>

/** Props for the root Project Progress overlay. */
export type ProjectProgressOverlayProps =
  PropsRuntime<'shell.overlay'>
  & PropsRenderSlots<'fde.project.source.preview'>
  & InjectFace<ProjectPageInjected>
  & PropsLocale<'fdeProject'>

/** Shared props for all project-scoped conversation views. */
export type ProjectViewProps =
  PropsRuntime<'conversation.view'> & InjectFace<ProjectViewInjected> & PropsLocale<'fdeProject'>

/** Props for the project runtime utility in the active Session header. */
export type ProjectRuntimeHeaderProps =
  PropsRuntime<'conversation.session.header.utilities'>
  & InjectFace<ProjectRuntimeHeaderInjected>
  & PropsLocale<'fdeProject'>
