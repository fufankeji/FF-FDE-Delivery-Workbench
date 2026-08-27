/** FDE project browser plugin: global progress plus four project-level views. */

import type { ClientContext, SessionId, WorkspaceId } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import { ApiDocsView } from './ApiDocsView.tsx'
import { ArchitectureView } from './ArchitectureView.tsx'
import { FdeProjectSurfaceController } from './controller.ts'
import { EvaluationView } from './EvaluationView.tsx'
import { en, NS, zh, type FdeProjectKey } from './locales.ts'
import { ObservabilityView } from './ObservabilityView.tsx'
import { ProjectPageController } from './page-controller.ts'
import { ProjectProgressLauncher } from './ProjectProgressLauncher.tsx'
import { ProjectProgressOverlay } from './ProjectProgressOverlay.tsx'
import type { ProjectPageInjected, ProjectViewInjected } from './slots.ts'
import { ProjectStageController } from './stage-controller.ts'
import { ProjectSourceController } from './source-controller.ts'

export type { ProjectSourcePreviewOwnerProps } from './slots.ts'
export type { ProjectSourceItem, ProjectSourcePreviewKind } from './source-controller.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** FDE project progress and project delivery views. */
    fdeProject: FdeProjectKey
  }
}

/** Required browser services and the Slot owners that declare our targets. */
export const inject = ['slots', 'locale', 'sessions', 'workspaces']

/** Register the global project page and the four project delivery views. */
export function apply(ctx: ClientContext): void {
  const page = new ProjectPageController()
  const stages = new ProjectStageController()
  const sources = new ProjectSourceController()
  const surfaces = new FdeProjectSurfaceController()
  ctx.effect(() => () => { page.dispose(); stages.dispose(); sources.dispose(); surfaces.dispose() }, 'ui-fde-project: controllers')
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-fde-project: dictionaries')
  const t = ctx.locale.bind(NS)

  const pageInjected = (): ProjectPageInjected => ({
    hooks: { projectPage: page, stageProgress: stages, projectSources: sources },
    loadStage: (workspaceId) => { stages.load(workspaceId) },
    retryStage: (workspaceId) => { stages.retry(workspaceId) },
    loadProjectSources: (workspaceId, force) => { sources.load(workspaceId, force) },
    parseProjectSource: async (workspaceId, sourceId) => { await sources.parse(workspaceId, sourceId) },
    enterProject: async (workspaceId) => {
      const sessionId = await ctx.workspaces.connectWorkspace(workspaceId as WorkspaceId)
      ctx.sessions.open(sessionId)
      page.close()
    },
    closeProjectPage: page.close,
    openProjectPage: page.open,
    showProjectOverview: page.showOverview,
    showProjectTimeline: page.showTimeline,
    showProjectDetail: page.showProject,
  })

  const projectViewInjected = (sessionId: SessionId): ProjectViewInjected => ({
    hooks: { projectSurfaces: surfaces },
    loadProjectSurface: (workspaceId) => { surfaces.load(workspaceId) },
    refreshProjectSurface: (workspaceId) => { surfaces.refresh(workspaceId) },
    confirmProjectArchitecture: async (workspaceId, revision) => {
      await surfaces.confirmArchitecture(workspaceId, revision)
    },
    approveEvaluationBaseline: async (workspaceId, reportPath) => {
      await surfaces.approveEvaluationBaseline(workspaceId, reportPath)
    },
    requestArchitectureDraft: async (currentRevision) => {
      const session = ctx.sessions.binding(sessionId)?.session
      if (session === undefined) throw new Error('当前会话不可用。')
      const result = await session.prompt([{
        type: 'text',
        text: `请根据当前项目已经确认的需求、方案和真实源码完善系统架构。先调用 architecture_get 读取当前版本，再调用 architecture_set 提交完整候选；本次页面看到的 revision 是 ${String(currentRevision)}。架构应突出真实系统分组、组件、存储、外部依赖和关键连接，不要把任务步骤、运行轨迹或隐藏推理画成节点。`,
      }], 'queue')
      if (!result.ok) throw new Error(result.error.message)
    },
    runProjectEvaluation: async (workspacePath) => {
      const session = ctx.sessions.binding(sessionId)?.session
      if (session === undefined) throw new Error('当前会话不可用。')
      const runId = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
      const casesDir = `${workspacePath}/.fde/evaluations/cases`
      const runtimeRoot = `${workspacePath}/.runtime/fde-evaluations/${runId}`
      const outputDir = `${runtimeRoot}/output`
      const sessionRoot = `${runtimeRoot}/sessions`
      const publishDir = `${workspacePath}/.fde/evaluations/reports/${runId}`
      const result = await session.prompt([{
        type: 'text',
        text: `请使用 eval_run 工具运行当前项目的回归评估。cases_dir=${casesDir}，output_dir=${outputDir}，session_root=${sessionRoot}。使用 headless profile、串行执行。工具完成后，只把 output_dir 中的 report.json 与 report.md 复制到 ${publishDir}；不要复制 .workspace、overlay、Session 或其他临时文件。最后简要说明通过、失败和错误数量。`,
      }], 'queue')
      if (!result.ok) throw new Error(result.error.message)
    },
  })

  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
    name: 'sidebar.footer.action', id: 'fde-project-progress', order: -20, locale: NS, inject: pageInjected,
  }, ProjectProgressLauncher))

  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay', id: 'fde-project-progress', order: 10, locale: NS, inject: pageInjected,
    children: { 'fde.project.source.preview': { kind: 'single', scope: 'root' } },
  }, ProjectProgressOverlay))

  const views = [
    { id: 'fde-api-docs', order: 20, label: 'view.api', component: ApiDocsView },
    { id: 'fde-architecture', order: 21, label: 'view.architecture', component: ArchitectureView },
    { id: 'fde-observability', order: 22, label: 'view.observe', component: ObservabilityView },
    { id: 'fde-evaluation', order: 23, label: 'view.evaluate', component: EvaluationView },
  ] as const
  for (const view of views) {
    ctx.slots.inject('conversation.view', () => ctx.slots.register({
      name: 'conversation.view', id: view.id, order: view.order, locale: NS,
      label: () => t(view.label), inject: projectViewInjected,
    }, view.component))
  }
}
