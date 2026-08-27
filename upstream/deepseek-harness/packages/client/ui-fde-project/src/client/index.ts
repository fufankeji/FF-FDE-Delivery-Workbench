/** FDE project browser plugin: global progress plus four project-level views. */

import type { ClientContext, SessionId, WorkspaceId } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-model-selection/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { BetterSidebarService } from 'dsh-better-sidebar'
import { ApiDocsView } from './ApiDocsView.tsx'
import { ArchitectureView } from './ArchitectureView.tsx'
import { FdeProjectSurfaceController } from './controller.ts'
import { EvaluationView } from './EvaluationView.tsx'
import { en, NS, zh, type FdeProjectKey } from './locales.ts'
import { ObservabilityView } from './ObservabilityView.tsx'
import { ProjectPageController } from './page-controller.ts'
import { ProjectProgressLauncher } from './ProjectProgressLauncher.tsx'
import { ProjectProgressOverlay } from './ProjectProgressOverlay.tsx'
import { ProjectRuntimeHeader } from './ProjectRuntimeHeader.tsx'
import { latestProjectSessionId } from './project-data.ts'
import {
  ensureProjectRuntimeSidebar,
  openProjectPreview,
  projectPreviewAuthority,
  revealProjectSidebar,
  showProjectRuntimeTerminal,
  waitForProjectSidebarSession,
} from './project-runtime-sidebar.ts'
import type {
  ProjectPageInjected,
  ProjectRuntimeHeaderInjected,
  ProjectViewInjected,
  RequirementWikiRunTarget,
} from './slots.ts'
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
    completeValidation: async (workspaceId, expectedRevision) => {
      await stages.completeValidation(workspaceId, expectedRevision)
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
    prepareValidationPlan: async () => {
      const session = ctx.sessions.binding(sessionId)?.session
      if (session === undefined) throw new Error('当前会话不可用。')
      ctx.sessions.scope(sessionId)?.get('conversation')?.selectView('chat')
      ctx.sessions.open(sessionId)
      const result = await session.prompt([{
        type: 'text',
        text: '请加载 Skill `fde-validation`，以“评估方案准备”模式为当前项目生成或完善评估方案。必须读取已确认的需求基线、项目 PRD、验收方案、方案基线和研发基线；把每项指标的来源文件与文档内编号写入 `.fde/evaluations/validation.json`（schemaVersion=2、metrics[].sources），并生成 `fde-deliverables/04-validation/validation-plan.md`。本次只准备方案：所有尚未真实执行的结果保持 NOT_RUN，不生成验证报告或验证基线，不修改项目阶段，也不要代替 FDE 确认方案。',
      }], 'queue')
      if (!result.ok) throw new Error(result.error.message)
    },
    confirmValidationPlan: async (workspaceId, contractDigest) => {
      await surfaces.confirmValidationPlan(workspaceId, contractDigest)
    },
    startValidation: async () => {
      const session = ctx.sessions.binding(sessionId)?.session
      if (session === undefined) throw new Error('当前会话不可用。')
      ctx.sessions.scope(sessionId)?.get('conversation')?.selectView('chat')
      ctx.sessions.open(sessionId)
      const result = await session.prompt([{
        type: 'text',
        text: '请加载 Skill `fde-validation`，以“开始验证”模式执行当前项目已经由 FDE 确认的评估方案。先读取 `.fde/evaluations/validation-plan-approval.json`、`.fde/evaluations/validation.json` 和 `fde-deliverables/04-validation/validation-plan.md`，只执行当前环境已具备且得到授权的真实检查，并把证据保存在项目目录中，再更新指标结果、验证报告和验证基线。不得虚构结果，不得把未执行项标为通过，也不得自行改变指标、阈值或来源；如方案定义必须改变，立即停止执行，更新候选方案并请 FDE 重新确认。不要推进项目阶段。',
      }], 'queue')
      if (!result.ok) throw new Error(result.error.message)
    },
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

  const promptFailure = (error: unknown): string => error instanceof Error ? error.message : String(error)

  const queueRuntimePrompt = async (
    sessionId: string,
    text: string,
  ): Promise<void> => {
    const session = ctx.sessions.binding(sessionId as SessionId)?.session
    if (session === undefined) throw new Error('项目运行会话不可用，请进入项目后重试。')
    const result = await session.prompt([{ type: 'text', text }], 'queue')
    if (!result.ok) throw new Error(result.error.message)
  }

  const showProjectConversation = (sessionId: string): void => {
    ctx.sessions.scope(sessionId as SessionId)?.get('conversation')?.selectView('chat')
    ctx.sessions.open(sessionId as SessionId)
  }

  const runtimeHeaderInjected = (betterSidebar: BetterSidebarService): ProjectRuntimeHeaderInjected => ({
    hooks: { projectSurfaces: surfaces, stageProgress: stages },
    loadStage: (workspaceId) => { stages.load(workspaceId) },
    loadProjectSurface: (workspaceId) => { surfaces.load(workspaceId) },
    pollProjectSurface: (workspaceId) => { surfaces.poll(workspaceId) },
    startProject: async (workspaceId, sessionId, workspacePath) => {
      const workspace = ctx.workspaces.list.getSnapshot().items.find(item => String(item.workspaceId) === workspaceId)
      if (workspace === undefined || !workspace.sessionIds.some(id => String(id) === sessionId)) {
        throw new Error('当前会话不属于这个项目。')
      }
      if (ctx.sessions.binding(sessionId as SessionId)?.session === undefined) throw new Error('当前项目会话不可用。')
      showProjectConversation(sessionId)
      await ensureProjectRuntimeSidebar(betterSidebar)
      revealProjectSidebar(betterSidebar, sessionId, workspacePath)
      const runtime = await surfaces.startRuntime(workspaceId, sessionId)
      if (runtime.operationId === undefined) throw new Error('项目启动操作缺少 operationId。')
      try {
        await queueRuntimePrompt(sessionId, `请启动当前 FDE 项目。本次操作 operationId=${runtime.operationId}。\n\n1. 先读取项目根目录 AGENTS.md；如其中引用 README、运行手册或脚本，继续按项目真实说明执行。不要猜测固定技术栈、启动命令、端口或 /docs。\n2. 在执行启动命令前，先依据上述真实项目说明验证其中声明的服务是否已经运行；若现有服务已可用，直接报告该运行事实，不要重复启动第二份。需要启动时，长时间运行的服务必须使用 Better Sidebar 的 terminal_list / terminal_create / terminal_send / terminal_read / terminal_wait_for / terminal_signal 工具。优先复用当前会话中标题为“项目运行”的终端；不存在时创建一个标题为“项目运行”的持久终端。不要用普通 Bash 启动不可观察的后台服务。\n3. 等待服务就绪并真实验证项目页面。只有验证成功后，才调用 project_runtime_report，传入本 operationId、status=running、previewUrl 和 terminalTitle=项目运行。若同时真实发现 OpenAPI，可一并传 docsUrl、openapiSource、baseUrl；不要猜测。\n4. 如果 AGENTS.md 不存在、项目尚未开发到可启动、终端依赖不可用或启动失败，调用 project_runtime_report，传入本 operationId、status=blocked 和具体原因。不要为了启动而大范围改代码，也不要反复重试。\n5. 无论启动成功还是阻塞，调用 project_runtime_report 后都要在当前对话用简短中文正常说明结果和下一步；阻塞时明确用户可以继续开发。不要只调用工具或只更新页头状态。`)
      } catch (error) {
        await surfaces.abandonRuntime(workspaceId, runtime.operationId, `启动指令未进入项目会话：${promptFailure(error)}`).catch(() => undefined)
        throw error
      }
    },
    stopProject: async (workspaceId, _sessionId, _workspacePath) => {
      const state = surfaces.getSnapshot().byWorkspace[workspaceId]
      if (state?.status !== 'ready'
        || (state.value.runtime.status !== 'running'
          && !(state.value.runtime.status === 'blocked' && state.value.runtime.action === 'stop'))) {
        throw new Error('当前项目不在可停止状态。')
      }
      const targetSessionId = state.value.runtime.sessionId
      if (targetSessionId === undefined || ctx.sessions.binding(targetSessionId as SessionId)?.session === undefined) {
        throw new Error('原项目运行会话不可用，不能安全定位要停止的终端。')
      }
      await ensureProjectRuntimeSidebar(betterSidebar)
      const runtime = await surfaces.stopRuntime(workspaceId, targetSessionId)
      if (runtime.operationId === undefined) throw new Error('项目停止操作缺少 operationId。')
      try {
        await queueRuntimePrompt(targetSessionId, `请停止当前 FDE 项目。本次操作 operationId=${runtime.operationId}。\n\n1. 使用 terminal_list 查找当前项目会话中标题为“项目运行”的持久终端，只处理这个项目终端。\n2. 使用 terminal_signal 向该终端发送 SIGINT，再用 terminal_wait_for / terminal_read 确认服务是否退出。禁止使用无范围的 pkill、killall，也不要调用 terminal_close；终端和输出必须保留。\n3. 确认退出后调用 project_runtime_report，传入本 operationId、status=stopped 和结果说明。若服务仍在运行，报告 status=running；若无法确认，报告 status=blocked 并说明原因。不要把无法确认冒充为停止成功。`)
      } catch (error) {
        await surfaces.abandonRuntime(workspaceId, runtime.operationId, `停止指令未进入项目会话：${promptFailure(error)}`).catch(() => undefined)
        throw error
      }
    },
    openProjectPreview: async (workspaceId, sessionId, workspacePath) => {
      const state = surfaces.getSnapshot().byWorkspace[workspaceId]
      const url = state?.status === 'ready' && state.value.runtime.status === 'running'
        ? state.value.runtime.previewUrl
        : undefined
      if (url === undefined) throw new Error('当前项目没有已验证的运行地址。')
      await ensureProjectRuntimeSidebar(betterSidebar, projectPreviewAuthority(url))
      openProjectPreview(betterSidebar, sessionId, workspacePath, url)
    },
    showProjectTerminal: async (workspaceId, sessionId, workspacePath) => {
      const state = surfaces.getSnapshot().byWorkspace[workspaceId]
      const targetSessionId = state?.status === 'ready' ? state.value.runtime.sessionId ?? sessionId : sessionId
      const workspace = ctx.workspaces.list.getSnapshot().items.find(item => String(item.workspaceId) === workspaceId)
      if (workspace === undefined || !workspace.sessionIds.some(id => String(id) === targetSessionId)) {
        throw new Error('项目运行会话已经不可用。')
      }
      await ensureProjectRuntimeSidebar(betterSidebar)
      if (targetSessionId !== sessionId) {
        ctx.sessions.open(targetSessionId as SessionId)
        await waitForProjectSidebarSession(betterSidebar, targetSessionId)
      }
      showProjectRuntimeTerminal(
        betterSidebar,
        targetSessionId,
        workspacePath,
        state?.status === 'ready' ? state.value.runtime.terminalTitle : undefined,
      )
    },
    continueDevelopment: (sessionId) => {
      showProjectConversation(sessionId)
    },
  })

  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
    name: 'sidebar.footer.action', id: 'fde-project-progress', order: -20, locale: NS, inject: pageInjected,
  }, ProjectProgressLauncher))

  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay', id: 'fde-project-progress', order: 10, locale: NS, inject: pageInjected,
    children: { 'fde.project.source.preview': { kind: 'single', scope: 'root' } },
  }, ProjectProgressOverlay))

  ctx.inject(['betterSidebar'], (scope: ClientContext) => scope.slots.inject(
    'conversation.session.header.utilities',
    () => scope.slots.register({
      name: 'conversation.session.header.utilities', id: 'fde-project-runtime', order: -10, locale: NS,
      inject: () => runtimeHeaderInjected(scope.betterSidebar),
    }, ProjectRuntimeHeader),
  ))

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
      surfaces.load(workspaceId)
      const stageState = stages.getSnapshot().byWorkspace[workspaceId]
      const currentStage = stageState?.status === 'ready' ? stageState.value.currentStage : undefined
      const surfaceState = surfaces.getSnapshot().byWorkspace[workspaceId]
      const surface = surfaceState?.status === 'ready' ? surfaceState.value : undefined
      for (const view of views) {
        const visible = projectViewVisible(view.id, currentStage, surface)
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
      surfaces.subscribe(reconcile),
    ]
    reconcile()
    return () => {
      for (const unsubscribe of unsubscribers) unsubscribe()
      for (const id of [...mounted.keys()]) unmount(id)
    }
  }, 'ui-fde-project: stage-aware views')
}
