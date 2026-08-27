/** FDE project browser plugin: global progress plus four project-level views. */

import type { ClientContext, SessionId, WorkspaceId } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-model-selection/client'
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
import { latestProjectSessionId } from './project-data.ts'
import type { ProjectPageInjected, ProjectViewInjected, RequirementWikiRunTarget } from './slots.ts'
import { ProjectStageController } from './stage-controller.ts'
import { ProjectSourceController } from './source-controller.ts'
import { RequirementWikiController } from './wiki-controller.ts'
import { projectViewVisible, type FdeProjectViewId } from './view-availability.ts'

export type { ProjectSourcePreviewOwnerProps } from './slots.ts'
export type { ProjectSourceItem, ProjectSourcePreviewKind } from './source-controller.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** FDE project progress and project delivery views. */
    fdeProject: FdeProjectKey
  }
}

/** Required browser services and the Slot owners that declare our targets. */
export const inject = ['slots', 'locale', 'modelDirectories', 'sessions', 'workspaces', 'conversation']

/** Register the global project page and the four project delivery views. */
export function apply(ctx: ClientContext): void {
  const page = new ProjectPageController()
  const stages = new ProjectStageController()
  const sources = new ProjectSourceController()
  const requirementWiki = new RequirementWikiController()
  const surfaces = new FdeProjectSurfaceController()
  ctx.effect(() => () => { page.dispose(); stages.dispose(); sources.dispose(); requirementWiki.dispose(); surfaces.dispose() }, 'ui-fde-project: controllers')
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-fde-project: dictionaries')
  const t = ctx.locale.bind(NS)

  const resolveProjectSession = async (workspaceId: string): Promise<SessionId> => {
    const workspaceState = ctx.workspaces.list.getSnapshot()
    const workspace = workspaceState.items.find(item => String(item.workspaceId) === workspaceId)
    if (workspace === undefined) throw new Error('当前项目不存在或已被移除。')
    const sessions = ctx.sessions.list.getSnapshot()
    return latestProjectSessionId(
      workspace.sessionIds,
      sessions.byId,
      workspaceState.archivedSessionIds,
    ) ?? await ctx.workspaces.connectWorkspace(workspaceId as WorkspaceId)
  }

  const enterProject = async (workspaceId: string, viewId?: string): Promise<void> => {
    const sessionId = await resolveProjectSession(workspaceId)
    if (viewId !== undefined) {
      const scoped = ctx.sessions.scope(sessionId)
      const conversation = scoped?.get('conversation')
      if (conversation === undefined) throw new Error('当前项目会话暂时无法打开系统架构。')
      conversation.selectView(viewId)
    }
    ctx.sessions.open(sessionId)
    page.close()
  }

  const pageInjected = (): ProjectPageInjected => ({
    hooks: { projectPage: page, stageProgress: stages, projectSurfaces: surfaces, projectSources: sources, requirementWiki },
    loadStage: (workspaceId) => { stages.load(workspaceId) },
    retryStage: (workspaceId) => { stages.retry(workspaceId) },
    loadProjectSurface: (workspaceId) => { surfaces.load(workspaceId) },
    refreshProjectSurface: (workspaceId) => { surfaces.refresh(workspaceId) },
    completeRequirements: async (workspaceId, expectedRevision) => {
      await stages.completeRequirements(workspaceId, expectedRevision)
      surfaces.refresh(workspaceId)
    },
    completeSolution: async (workspaceId, expectedRevision) => {
      await stages.completeSolution(workspaceId, expectedRevision)
      surfaces.refresh(workspaceId)
    },
    completeDevelopment: async (workspaceId, expectedRevision) => {
      await stages.completeDevelopment(workspaceId, expectedRevision)
      surfaces.refresh(workspaceId)
    },
    loadProjectSources: (workspaceId, force) => { sources.load(workspaceId, force) },
    parseProjectSource: async (workspaceId, sourceId) => { await sources.parse(workspaceId, sourceId) },
    loadRequirementWiki: (workspaceId, force) => { requirementWiki.load(workspaceId, force) },
    prepareRequirementWikiRun: async (workspaceId, sessionId) => {
      const workspace = ctx.workspaces.list.getSnapshot().items.find(item => String(item.workspaceId) === workspaceId)
      if (workspace === undefined || !workspace.sessionIds.some(id => String(id) === sessionId)) {
        throw new Error('当前项目没有可用于需求整理的会话。')
      }
      const directory = await ctx.modelDirectories.directoryFor(sessionId as SessionId).load()
      if (!directory.routable) throw new Error('当前项目会话的模型不可用，请先在项目交付中选择可用模型。')
      const group = directory.groups.find(item => item.id === directory.current.provider)
      const model = group?.models.find(item => item.id === directory.current.model)
      return {
        sessionId,
        provider: directory.current.provider,
        providerName: group?.name ?? directory.current.provider,
        model: directory.current.model,
        modelName: model?.name ?? directory.current.model,
      } satisfies RequirementWikiRunTarget
    },
    startRequirementWikiBuild: async (workspaceId, sourceIds, expectedRevision, target) => {
      const workspace = ctx.workspaces.list.getSnapshot().items.find(item => String(item.workspaceId) === workspaceId)
      if (workspace === undefined || !workspace.sessionIds.some(id => String(id) === target.sessionId)) {
        throw new Error('已确认的需求整理会话不再属于当前项目，请重新确认。')
      }
      const directory = await ctx.modelDirectories.directoryFor(target.sessionId as SessionId).load()
      if (!directory.routable
        || directory.current.provider !== target.provider
        || directory.current.model !== target.model) {
        throw new Error('当前项目会话的模型已变化，请重新确认 Provider 与模型边界。')
      }
      const snapshot = await requirementWiki.startBuild(workspaceId, sourceIds, expectedRevision)
      const build = snapshot.build
      if (build === null || (build.status !== 'queued' && build.status !== 'running')) {
        throw new Error('需求整理任务没有进入可执行状态。')
      }
      try {
        const session = ctx.sessions.binding(target.sessionId as SessionId)?.session
        if (session === undefined) throw new Error('当前项目会话不可用。')
        const sourceList = build.sources.map(source => `- ${source.sourceId}: ${source.derivedPath}（${source.storedName}）`).join('\n')
        const result = await session.prompt([{
          type: 'text',
          text: `请执行当前 FDE 项目的需求知识整理。BuildId=${build.id}，页面基于 revision R${String(build.expectedRevision)}。\n\n先调用 requirement_wiki_get，并传入 BuildId；随后只读取它返回的以下固定派生文本，不要读取其他项目或自行扩展来源：\n${sourceList}\n\n把资料整体梳理为业务目标、角色、流程/SOP、系统与数据、业务规则、约束、验收方向、风险、冲突和未知项。每个知识页、关系、冲突和未知项都必须引用一个或多个本次 SourceId。完成后调用 requirement_wiki_publish 一次提交完整候选，expectedRevision 必须使用 requirement_wiki_get 返回的值。不要把候选理解写成客户已确认事实，不要推进项目阶段或项目基线。`,
        }], 'queue')
        if (!result.ok) throw new Error(result.error.message)
      } catch (error) {
        await requirementWiki.abandonBuild(workspaceId, build.id).catch(() => undefined)
        throw error
      }
    },
    abandonRequirementWikiBuild: async (workspaceId, buildId) => {
      await requirementWiki.abandonBuild(workspaceId, buildId)
    },
    enterProject: async (workspaceId) => { await enterProject(workspaceId) },
    reviewProjectArchitecture: async (workspaceId) => { await enterProject(workspaceId, 'fde-architecture') },
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
        text: `请刷新当前 FDE 项目的系统架构，并把结果作为待审阅候选提交。

1. 先调用 architecture_get 读取当前架构和 expectedRevision。页面当前显示的 revision 是 ${String(currentRevision)}；如果工具返回值不同，以工具返回值为准，并说明版本已经变化。
2. 先读取已确认的需求和方案，再只读检查真实源码的依赖清单、应用入口、API/事件入口、核心服务、存储、模型或外部集成、部署配置和交付输出。源码与文档不一致时区分当前实现与待实施候选，不虚构组件。
3. 按入口到交付输出的主链路使用 2–7 个职责分组；极小项目可以更少，不凑数。每组只保留主要运行组件、能力、存储、外部边界或独立输出，不把目录、文件、类、函数、任务步骤或运行轨迹画成节点。
4. 正确使用节点类型：entry 表示入口，core 表示编排/领域/AI 核心，store 表示持久数据或证据，external 表示系统外部边界，output 表示独立交付结果，其他情况才使用 default。
5. ID 使用稳定的 kebab-case，保留仍代表同一概念的现有 ID。label 保持简短，note 写清真实职责、依据、限制或未知项。
6. 只提交关键运行时、数据流、控制流或依赖关系；边从实际发起方指向接收方，不提交传递关系、重复关系或类级调用。dashed 只用于可选、异步或尚待落实的候选关系。
7. 检查所有分组和节点引用、重复边及自环后，只调用一次 architecture_set，携带 architecture_get 返回的精确 expectedRevision 并提交完整候选。不要自行确认架构或推进项目阶段。`,
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

  const views: readonly {
    readonly id: FdeProjectViewId
    readonly order: number
    readonly label: 'view.api' | 'view.architecture' | 'view.observe' | 'view.evaluate'
    readonly component: typeof ApiDocsView
  }[] = [
    { id: 'fde-api-docs', order: 20, label: 'view.api', component: ApiDocsView },
    { id: 'fde-architecture', order: 21, label: 'view.architecture', component: ArchitectureView },
    { id: 'fde-observability', order: 22, label: 'view.observe', component: ObservabilityView },
    { id: 'fde-evaluation', order: 23, label: 'view.evaluate', component: EvaluationView },
  ]
  ctx.effect(() => {
    const mounted = new Map<FdeProjectViewId, () => void>()
    const unmount = (id: FdeProjectViewId): void => {
      mounted.get(id)?.()
      mounted.delete(id)
    }
    const reconcile = (): void => {
      const current = ctx.sessions.list.getSnapshot().current
      const workspace = current === undefined
        ? undefined
        : ctx.workspaces.list.getSnapshot().items.find(item => item.sessionIds.includes(current))
      if (workspace === undefined) {
        for (const id of [...mounted.keys()]) unmount(id)
        return
      }
      const workspaceId = String(workspace.workspaceId)
      stages.load(workspaceId)
      const stageState = stages.getSnapshot().byWorkspace[workspaceId]
      const currentStage = stageState?.status === 'ready' ? stageState.value.currentStage : undefined
      for (const view of views) {
        const visible = projectViewVisible(view.id, currentStage)
        if (!visible) {
          unmount(view.id)
          continue
        }
        if (mounted.has(view.id)) continue
        mounted.set(view.id, ctx.slots.inject('conversation.view', () => ctx.slots.register({
          name: 'conversation.view', id: view.id, order: view.order, locale: NS,
          label: () => t(view.label), inject: projectViewInjected,
        }, view.component)))
      }
    }
    const unsubscribers = [
      ctx.sessions.list.subscribe(reconcile),
      ctx.workspaces.list.subscribe(reconcile),
      stages.subscribe(reconcile),
    ]
    reconcile()
    return () => {
      for (const unsubscribe of unsubscribers) unsubscribe()
      for (const id of [...mounted.keys()]) unmount(id)
    }
  }, 'ui-fde-project: stage-aware views')
}
