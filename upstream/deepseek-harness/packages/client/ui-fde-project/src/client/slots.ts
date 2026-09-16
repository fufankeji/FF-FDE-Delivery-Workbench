/** Slot component props and injected FDE project faces. */

import type { InjectFace, PropsLocale, PropsRenderSlots, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import type { AcceptanceHandoverDecision, DesignExecutionMechanism, FdeProjectSurfaceController, SemanticDefinitionInput } from './controller.ts'
import type { ProjectPageController } from './page-controller.ts'
import type { ProjectUsageController } from './usage-controller.ts'
import type { FdeV2StageId, ProjectStageController } from './stage-controller.ts'
import type { ProjectStageViewController } from './stage-view-controller.ts'
import type { ProjectSourceController, ProjectSourcePreviewKind } from './source-controller.ts'

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
    /** Independent modules available without selecting a project. */
    'fde.workbench.module.action': { kind: 'list'; scope: 'root' }
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
    projectMetadata: import('@deepseek-ai/dsh-client-ui-workspace/client').ProjectMetadataService
  }
  loadStage: (workspaceId: string) => void
  retryStage: (workspaceId: string) => void
  loadProjectSurface: (workspaceId: string) => void
  refreshProjectSurface: (workspaceId: string) => void
  completeRequirements: (workspaceId: string, expectedRevision: number) => Promise<void>
  completeV2Stage: (workspaceId: string, expectedRevision: number, stage: FdeV2StageId) => Promise<void>
  returnV2Stage: (workspaceId: string, expectedRevision: number, reason: string) => Promise<void>
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
  openProjectCreation: () => void
  enterProject: (workspaceId: string) => Promise<void>
  openActivitySession: (workspaceId: string, sessionId: string) => Promise<void>
  loadProjectMetadata: (workspaceId: string, path: string, force?: boolean) => void
  reviewProjectArchitecture: (workspaceId: string) => Promise<void>
  closeProjectPage: () => void
  openProjectPage: () => void
  showProjectHome: () => void
  showProjectOverview: () => void
  showProjectTimeline: () => void
  showProjectDetail: (workspaceId: string) => void
}

/** Current-project callbacks and snapshot observable injected into project views. */
export interface ProjectViewInjected {
  hooks: { projectSurfaces: FdeProjectSurfaceController; projectUsage: ProjectUsageController }
  loadProjectUsage: (workspaceId: string) => void
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

/** Stage-one business actions exposed without leaking Skill names into product copy. */
export type DiscoveryAction =
  | 'qualify-workflow'
  | 'prepare-interview'
  | 'restore-workflow'
  | 'qualify-value'
  | 'form-conclusion'
  | 'repair-stage-records'
  | 'reframe-engagement'
  | 'narrow-workflow'
  | 'pause-workflow'

/** Shared project-stage workbench data and actions. */
export interface ProjectStageWorkbenchInjected {
  runProjectAction: (action: 'startProject' | 'stopProject' | 'openProjectPreview' | 'showProjectTerminal', workspaceId: string, sessionId: string, workspacePath: string) => Promise<void>
  openProjectCapability: (workspaceId: string, capability: 'fde-architecture' | 'fde-evaluation') => Promise<void>
  pollProjectSurface: (workspaceId: string) => void
  hooks: {
    stageProgress: ProjectStageController
    projectSurfaces: FdeProjectSurfaceController
    projectSources: ProjectSourceController
    stageView: ProjectStageViewController
  }
  loadStage: (workspaceId: string) => void
  loadProjectSurface: (workspaceId: string) => void
  refreshProjectSurface: (workspaceId: string) => void
  loadProjectSources: (workspaceId: string, force?: boolean) => void
  completeRequirements: (workspaceId: string, expectedRevision: number) => Promise<void>
  completeV2Stage: (workspaceId: string, expectedRevision: number, stage: FdeV2StageId) => Promise<void>
  returnV2Stage: (workspaceId: string, expectedRevision: number, reason: string) => Promise<void>
  openProjectSourceUpload: (workspaceId: string) => void
  prepareDiscoveryDraft: (
    sessionId: string,
    action: DiscoveryAction,
    sourcePaths: readonly string[],
  ) => void
  prepareStageDraft: (sessionId: string, prompt: string) => void
  configureDesignRoute: (workspaceId: string, input: {
    readonly execution: { readonly mechanism: DesignExecutionMechanism; readonly label: string; readonly rationale: string }
    readonly semantics: { readonly mode: 'schema' | 'ontology'; readonly rationale: string }
  }) => Promise<void>
  bindDesignSources: (
    workspaceId: string,
    sourceIds: readonly string[],
    permissionScope: string,
    authority: 'primary' | 'supporting',
  ) => Promise<void>
  saveDesignDefinition: (workspaceId: string, expectedRevision: number, definition: SemanticDefinitionInput) => Promise<void>
  reviewDesignCandidates: (
    workspaceId: string,
    decisions: readonly { readonly id: string; readonly decision: 'accepted' | 'rejected' }[],
  ) => Promise<void>
  runDesignSemantica: (
    workspaceId: string,
    action: 'health' | 'extract' | 'propose-schema' | 'publish-schema' | 'build' | 'validate' | 'context',
    input?: Readonly<Record<string, unknown>>,
  ) => Promise<void>
  recordDesignDecision: (
    workspaceId: string,
    expectedRevision: number,
    outcome: 'go' | 'revise' | 'narrow' | 'stop',
    rationale: string,
  ) => Promise<void>
  openProjectFile: (sessionId: string, workspacePath: string, relativePath: string, title: string) => Promise<void>
  openProjectConversation: (sessionId: string) => void
  resolveProjectWorkspace: (sessionId: string) => {
    workspaceId: string
    title: string
    path: string
  } | undefined
  resolveEnteredProject: () => {
    sessionId: string
    workspaceId: string
    title: string
    path: string
  } | undefined
  /** Restore the full project-workbench frame after leaving the Agent execution view. */
  activateProjectWorkbenchLayout?: () => void
  viewProjectStage: (workspaceId: string, stage: FdeV2StageId) => void
  returnToCurrentStage: (workspaceId: string) => void
  toggleProjectSidebar: () => void
  openProjectPage: () => void
}

/** Props for the sidebar Project Progress launcher. */
export type ProjectProgressLauncherProps =
  PropsRuntime<'sidebar.footer.action'> & InjectFace<ProjectPageInjected> & PropsLocale<'fdeProject'>

/** Props for the root Project Progress overlay. */
export type ProjectProgressOverlayProps =
  PropsRuntime<'shell.overlay'>
  & PropsRenderSlots<'fde.project.source.preview' | 'fde.workbench.module.action'>
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

/** Product-specific blank-session home for one FDE project. */
export type ProjectStageWorkbenchHeroProps =
  PropsRuntime<'conversation.hero.content'>
  & InjectFace<ProjectStageWorkbenchInjected>
  & PropsLocale<'fdeProject'>

/** Current-stage workbench rendered as a normal tab after a Session has turns. */
export type ProjectStageWorkbenchViewProps =
  PropsRuntime<'conversation.view'>
  & InjectFace<ProjectStageWorkbenchInjected>
  & PropsLocale<'fdeProject'>

/** Project-local sidebar replacing the global project/session tree. */
export type ProjectContextSidebarProps =
  PropsRuntime<'sidebar.workspaces.projectContext'>
  & InjectFace<ProjectStageWorkbenchInjected>
  & PropsLocale<'fdeProject'>
