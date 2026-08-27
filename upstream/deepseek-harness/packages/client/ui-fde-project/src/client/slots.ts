/** Slot component props and injected FDE project faces. */

import type { InjectFace, PropsLocale, PropsRenderSlots, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { FdeProjectSurfaceController } from './controller.ts'
import type { ProjectPageController } from './page-controller.ts'
import type { ProjectStageController } from './stage-controller.ts'
import type { ProjectSourceController, ProjectSourceItem } from './source-controller.ts'

/** Read-only source currency passed from Project Detail to one preview occupant. */
export interface ProjectSourcePreviewOwnerProps {
  readonly source: ProjectSourceItem
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    /** One shared read-only renderer for the selected project source. */
    'fde.project.source.preview': { kind: 'single'; scope: 'root'; owner: ProjectSourcePreviewOwnerProps }
  }
}

/** Root-page callbacks and observables injected into the launcher and overlay. */
export interface ProjectPageInjected {
  hooks: {
    projectPage: ProjectPageController
    stageProgress: ProjectStageController
    projectSources: ProjectSourceController
  }
  loadStage: (workspaceId: string) => void
  retryStage: (workspaceId: string) => void
  loadProjectSources: (workspaceId: string, force?: boolean) => void
  parseProjectSource: (workspaceId: string, sourceId: string) => Promise<void>
  enterProject: (workspaceId: string) => Promise<void>
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
  runProjectEvaluation: (workspacePath: string) => Promise<void>
  requestArchitectureDraft: (currentRevision: number) => Promise<void>
  confirmProjectArchitecture: (workspaceId: string, revision: number) => Promise<void>
  approveEvaluationBaseline: (workspaceId: string, reportPath: string) => Promise<void>
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
