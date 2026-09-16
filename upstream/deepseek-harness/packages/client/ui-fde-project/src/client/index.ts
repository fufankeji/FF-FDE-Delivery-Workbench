import { installProjectFileRefresh } from './file-refresh.ts'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
/** FDE project browser plugin: global progress plus four project-level views. */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import type { BetterSidebarService } from 'dsh-better-sidebar'
import { ApiDocsView } from './ApiDocsView.tsx'
import { ArchitectureView } from './ArchitectureView.tsx'
import { FdeProjectSurfaceController } from './controller.ts'
import { ProjectUsageController } from './usage-controller.ts'
import { EvaluationView } from './EvaluationView.tsx'
import { en, NS, zh, type FdeProjectKey } from './locales.ts'
import { ObservabilityView } from './ObservabilityView.tsx'
import { ProjectPageController } from './page-controller.ts'
import { ProjectProgressLauncher } from './ProjectProgressLauncher.tsx'
import { ProjectProgressOverlay } from './ProjectProgressOverlay.tsx'
import { ProjectRuntimeHeader } from './ProjectRuntimeHeader.tsx'
import { ProjectContextSidebar } from './ProjectContextSidebar.tsx'
import { ProjectStageWorkbenchHero, ProjectStageWorkbenchView } from './StageWorkbench.tsx'
import { latestProjectSessionId } from './project-data.ts'
import {
  ensureProjectRuntimeSidebar,
  openProjectPreview,
  resolveProjectPreview,
  projectRuntimeTerminalRecoveryPrompt,
  projectPreviewAuthority,
  revealProjectSidebar,
  showProjectRuntimeTerminal,
  waitForProjectSidebarSession,
} from './project-runtime-sidebar.ts'
import type {
  ProjectPageInjected,
  ProjectStageWorkbenchInjected,
  ProjectRuntimeHeaderInjected,
  ProjectViewInjected,
  DiscoveryAction,
} from './slots.ts'
import { ProjectStageController } from './stage-controller.ts'
import { ProjectStageViewController } from './stage-view-controller.ts'
import { ProjectSourceController } from './source-controller.ts'
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
export const inject = ['slots', 'locale', 'sessions', 'workspaces', 'conversation', 'layout', 'projectMetadata', 'uiWorkspace', 'sidebarRight']

const FDE_PROJECT_PROGRESS_OPEN_EVENT = 'fde:project-progress-open'
const FDE_PROJECT_CREATE_OPEN_EVENT = 'fde:project-create-open'
const FDE_PROJECT_SOURCE_UPLOAD_OPEN_EVENT = 'fde:project-source-upload-open'

/** Register the global project page and the four project delivery views. */
export function apply(ctx: ClientContext): void {
  installProjectFileRefresh(ctx)
  const page = new ProjectPageController()
  const stages = new ProjectStageController()
  const stageView = new ProjectStageViewController()
  const sources = new ProjectSourceController()
  const surfaces = new FdeProjectSurfaceController()
  const usage = new ProjectUsageController()
  const loadProjectUsage = usage.load.bind(usage)
  ctx.effect(() => () => usage.dispose(), 'ui-fde-project: usage controller')
  ctx.effect(() => () => { page.dispose(); stages.dispose(); stageView.dispose(); sources.dispose(); surfaces.dispose() }, 'ui-fde-project: controllers')
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-fde-project: dictionaries')
  ctx.effect(() => {
    if (typeof window === 'undefined') return () => undefined
    const openProjectProgress = (event: Event): void => {
      const detail = (event as CustomEvent<{ workspaceId?: unknown } | undefined>).detail
      if (typeof detail?.workspaceId === 'string' && detail.workspaceId.length > 0) {
        event.preventDefault()
        page.showProject(detail.workspaceId)
      }
    }
    window.addEventListener(FDE_PROJECT_PROGRESS_OPEN_EVENT, openProjectProgress)
    return () => { window.removeEventListener(FDE_PROJECT_PROGRESS_OPEN_EVENT, openProjectProgress) }
  }, 'ui-fde-project: blank-stage progress entry')
  const t = ctx.locale.bind(NS)
  let projectSidebar: BetterSidebarService | undefined
  let enteredProject: { workspaceId: string; sessionId: string } | undefined

  const resolveProjectSession = async (workspaceId: string): Promise<SessionId> => {
    const workspaceState = ctx.workspaces.list.getSnapshot()
    const workspace = workspaceState.items.find(item => String(item.workspaceId) === workspaceId)
    if (workspace === undefined) throw new Error('当前项目不存在或已被移除。')
    const sessions = ctx.sessions.list.getSnapshot()
    return latestProjectSessionId(
      workspace.sessionIds,
      sessions.byId,
      workspaceState.archivedSessionIds,
    ) ?? await ctx.uiWorkspace.connectWorkspace(workspaceId as WorkspaceId)
  }

  const activateProjectWorkbenchLayout = (): void => {
    ctx.layout.openSidebar(396)
    if (ctx.sidebarRight.isExpanded()) ctx.sidebarRight.toggleExpanded()
    if (typeof document === 'undefined') return
    let attempts = 0
    const collapseProjectToolPanel = (): void => {
      if (document.body.hasAttribute('data-dsh-sidebar-collapsed')) return
      const toggles = document.querySelectorAll<HTMLButtonElement>('[data-dsh-toggle-cluster] button')
      const toggle = [...toggles].find(button => button.getBoundingClientRect().left > window.innerWidth / 2)
      if (toggle !== undefined) {
        toggle.click()
        return
      }
      attempts += 1
      if (attempts < 12) window.requestAnimationFrame(collapseProjectToolPanel)
    }
    collapseProjectToolPanel()
  }

  const enterProject = async (workspaceId: string, viewId?: string): Promise<void> => {
    const sessionId = await resolveProjectSession(workspaceId)
    enteredProject = { workspaceId, sessionId: String(sessionId) }
    const targetView = viewId ?? 'fde-stage-workbench'
    ctx.sessions.open(sessionId)
    const scoped = ctx.sessions.scope(sessionId)
    const conversation = scoped?.get('conversation')
    if (conversation === undefined) throw new Error('当前项目会话暂时无法打开。')
    conversation.selectView(targetView)
    page.close()
    // Opening the session can restore its last chat panel state. Apply the
    // workbench layout afterwards so chat's collapsed-left/open-files state
    // never leaks into the project surface.
    activateProjectWorkbenchLayout()
  }

  const pageInjected = (): ProjectPageInjected => ({
    hooks: { projectPage: page, stageProgress: stages, projectSurfaces: surfaces, projectSources: sources, projectMetadata: ctx.projectMetadata },
    loadProjectMetadata: (id, path, force) => { ctx.projectMetadata.load(id, path, force) },
    openActivitySession: async (workspaceId, sessionId) => {
      const state = ctx.workspaces.list.getSnapshot()
      const workspace = state.items.find(item => String(item.workspaceId) === workspaceId)
      const session = ctx.sessions.list.getSnapshot().byId[sessionId as SessionId]
      if (workspace === undefined || !workspace.sessionIds.includes(sessionId as SessionId)
        || state.archivedSessionIds.includes(sessionId as SessionId) || session === undefined || session.blank || session.origin === 'subagent') {
        throw new Error('这条会话已不存在或不再属于当前项目。')
      }
      ctx.sessions.open(sessionId as SessionId)
      const conversation = ctx.sessions.scope(sessionId as SessionId)?.get('conversation')
      if (conversation === undefined) throw new Error('当前项目会话暂时无法打开。')
      enteredProject = { workspaceId, sessionId }
      conversation.selectView('chat')
      page.close()
    },
    loadStage: (workspaceId) => { stages.load(workspaceId) },
    retryStage: (workspaceId) => { stages.retry(workspaceId) },
    loadProjectSurface: (workspaceId) => { surfaces.load(workspaceId) },
    refreshProjectSurface: (workspaceId) => { surfaces.refresh(workspaceId) },
    completeRequirements: async (workspaceId, expectedRevision) => {
      await stages.completeRequirements(workspaceId, expectedRevision)
      stageView.followCurrent(workspaceId)
      surfaces.refresh(workspaceId)
    },
    completeV2Stage: async (workspaceId, expectedRevision, stage) => {
      await stages.completeV2(workspaceId, expectedRevision, stage)
      stageView.followCurrent(workspaceId)
      surfaces.refresh(workspaceId)
    },
    returnV2Stage: async (workspaceId, expectedRevision, reason) => {
      await stages.returnV2(workspaceId, expectedRevision, reason)
      stageView.followCurrent(workspaceId)
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
    completePilot: async (workspaceId, expectedRevision) => {
      await stages.completePilot(workspaceId, expectedRevision)
      surfaces.refresh(workspaceId)
    },
    completeHandoff: async (workspaceId, expectedRevision) => {
      await stages.completeHandoff(workspaceId, expectedRevision)
      surfaces.refresh(workspaceId)
    },
    returnToPrevious: async (workspaceId, expectedRevision, reason) => {
      await stages.returnToPrevious(workspaceId, expectedRevision, reason)
      surfaces.refresh(workspaceId)
    },
    acceptValidationMetric: async (workspaceId, contractDigest, metricId, reason) => {
      await surfaces.acceptValidationMetric(workspaceId, contractDigest, metricId, reason)
    },
    waiveValidationIssue: async (workspaceId, contractDigest, issueId, reason) => {
      await surfaces.waiveValidationIssue(workspaceId, contractDigest, issueId, reason)
    },
    acceptDeploymentTrialIssue: async (workspaceId, contractDigest, issueId, reason) => {
      await surfaces.acceptDeploymentTrialIssue(workspaceId, contractDigest, issueId, reason)
    },
    confirmDeploymentTrialReadiness: async (workspaceId, contractDigest) => {
      await surfaces.confirmDeploymentTrialReadiness(workspaceId, contractDigest)
    },
    recordAcceptanceHandoverDecision: async (workspaceId, contractDigest, decision) => {
      await surfaces.recordAcceptanceHandoverDecision(workspaceId, contractDigest, decision)
    },
    loadProjectSources: (workspaceId, force) => { sources.load(workspaceId, force) },
    parseProjectSource: async (workspaceId, sourceId) => { await sources.parse(workspaceId, sourceId) },
    openProjectCreation: () => {
      window.dispatchEvent(new Event(FDE_PROJECT_CREATE_OPEN_EVENT, { cancelable: true }))
    },
    enterProject: async (workspaceId) => { await enterProject(workspaceId) },
    reviewProjectArchitecture: async (workspaceId) => { await enterProject(workspaceId, 'fde-architecture') },
    closeProjectPage: page.close,
    openProjectPage: page.open,
    showProjectHome: page.showHome,
    showProjectOverview: page.showOverview,
    showProjectTimeline: page.showTimeline,
    showProjectDetail: page.showProject,
  })

  const projectViewInjected = (sessionId: SessionId): ProjectViewInjected => ({
    hooks: { projectSurfaces: surfaces, projectUsage: usage },
    loadProjectUsage,
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

  const discoveryDraft = (
    action: DiscoveryAction,
    sourcePaths: readonly string[],
  ): string => {
    if (action === 'prepare-interview') {
      return '客户最近遇到的问题是：____。请先帮我还原他们现在怎么做、问题发生在哪一步，以及还需要向哪些业务人员确认。暂时不要讨论解决方案。'
    }
    if (action === 'reframe-engagement') {
      return '客户原先的说法和现场情况可能存在不一致。请帮我核对具体哪里不一致、会影响哪些已约定内容，以及需要由谁确认。暂时不要修改项目范围或讨论解决方案。'
    }
    if (action === 'restore-workflow') {
      const materials = sourcePaths.map(path => `- ${path}`).join('\n')
      return `请继续还原当前候选业务流程：明确真实执行人、触发条件、正常步骤、重要异常、人工回退和责任边界。只补当前仍缺的事实，不讨论技术方案。${materials === '' ? '' : `\n\n本次可核对资料：\n${materials}`}`
    }
    if (action === 'qualify-value') {
      return '请基于当前已经还原的业务流程，继续核对问题影响、业务结果、当前基线、结果验证人、风险上限和停止条件。请明确区分已确认事实、合理推断和仍需谁来核对的未知项，不推进项目阶段。'
    }
    if (action === 'form-conclusion') {
      return '请核对第一阶段三项必备记录和候选业务流程，整理当前已确认事实、未解决阻塞和 Go、Revise、Narrow 或 Stop 候选建议。不要代替 FDE 作出决定，也不要推进项目阶段。'
    }
    if (action === 'repair-stage-records') {
      return '请检查第一阶段 `.fde/discovery/artifacts.json` 与固定阶段记录合同，修复无效 ID、固定路径、来源版本、结构状态或证据引用。Catalog 只能登记 research-report、confirmation-checklist、requirement-baseline 和条件性的 engagement-reframe；其他补充文件可以保留，但不要登记进该 Catalog。不要改变业务结论或推进项目阶段。'
    }
    if (action === 'narrow-workflow') {
      return '我准备把当前问题缩小到：____。请根据已经确认的事实，保留原始范围和调整原因，更新优先处理的业务流程、暂不处理的部分、成功标准、停止条件和项目调整记录。不要推进项目阶段。'
    }
    if (action === 'pause-workflow') {
      return '我决定暂时不推进这个问题，原因是：____。请记录当前决定人、暂停原因、仍缺少的证据和重新启动条件，并更新项目调整记录或业务流程状态。不要推进项目阶段。'
    }
    const materials = sourcePaths.map(path => `- ${path}`).join('\n')
    return `请结合以下客户资料，从一个最近发生的案例开始，帮我还原客户现在怎么做、问题发生在哪一步，以及还需要向哪些业务人员确认。暂时不要讨论解决方案。\n\n本次参考资料：\n${materials}`
  }

  const focusNativeComposer = (): void => {
    const focus = (): void => {
      document.querySelector<HTMLTextAreaElement>('[data-input-scroll] textarea:not(:disabled)')?.focus()
    }
    if (typeof window.requestAnimationFrame === 'function') window.requestAnimationFrame(focus)
    else window.setTimeout(focus, 0)
  }

  const enterProjectAgentConversation = (sessionId: string): void => {
    const workspace = ctx.workspaces.list.getSnapshot().items.find(item => (
      item.sessionIds.some(id => String(id) === sessionId)
    ))
    ctx.sessions.scope(sessionId as SessionId)?.get('conversation')?.selectView('chat')
    ctx.sessions.open(sessionId as SessionId)
    ctx.layout.collapseSidebar()
    if (projectSidebar !== undefined && workspace !== undefined) {
      revealProjectSidebar(projectSidebar, sessionId, workspace.path)
    }
  }

  const stageWorkbenchInjected = (): ProjectStageWorkbenchInjected => ({
    runProjectAction: async (action, workspaceId, sessionId, workspacePath) => {
      if (projectSidebar === undefined) throw new Error('项目运行工作区暂时不可用。')
      await runtimeHeaderInjected(projectSidebar)[action](workspaceId, sessionId, workspacePath)
    },
    openProjectCapability: async (workspaceId, capability) => { await enterProject(workspaceId, capability) },
    pollProjectSurface: (workspaceId) => { surfaces.poll(workspaceId) },
    hooks: { stageProgress: stages, projectSurfaces: surfaces, projectSources: sources, stageView },
    loadStage: (workspaceId) => { stages.load(workspaceId) },
    loadProjectSurface: (workspaceId) => { surfaces.load(workspaceId) },
    refreshProjectSurface: (workspaceId) => { surfaces.refresh(workspaceId) },
    loadProjectSources: (workspaceId, force) => { sources.load(workspaceId, force) },
    completeRequirements: async (workspaceId, expectedRevision) => {
      await stages.completeRequirements(workspaceId, expectedRevision)
      stageView.followCurrent(workspaceId)
      surfaces.refresh(workspaceId)
    },
    completeV2Stage: async (workspaceId, expectedRevision, stage) => {
      await stages.completeV2(workspaceId, expectedRevision, stage)
      stageView.followCurrent(workspaceId)
      surfaces.refresh(workspaceId)
    },
    returnV2Stage: async (workspaceId, expectedRevision, reason) => {
      await stages.returnV2(workspaceId, expectedRevision, reason)
      stageView.followCurrent(workspaceId)
      surfaces.refresh(workspaceId)
    },
    openProjectSourceUpload: (workspaceId) => {
      window.dispatchEvent(new CustomEvent(FDE_PROJECT_SOURCE_UPLOAD_OPEN_EVENT, { detail: { workspaceId } }))
    },
    prepareDiscoveryDraft: (sessionId, action, sourcePaths) => {
      const scoped = ctx.sessions.scope(sessionId as SessionId)
      const conversation = scoped?.get('conversation')
      if (scoped === undefined || conversation === undefined) throw new Error('当前项目会话不可用。')
      const input = conversation.input.for(scoped)
      if (input.state.getSnapshot().draft.trim().length === 0) {
        input.setDraft(discoveryDraft(action, sourcePaths))
      } else {
        input.notify('info', '输入框已有内容，已为你保留。请补充完整后再发送。')
      }
      enterProjectAgentConversation(sessionId)
      focusNativeComposer()
    },
    prepareStageDraft: (sessionId, prompt) => {
      const scoped = ctx.sessions.scope(sessionId as SessionId)
      const conversation = scoped?.get('conversation')
      if (scoped === undefined || conversation === undefined) throw new Error('当前项目会话不可用。')
      const input = conversation.input.for(scoped)
      if (input.state.getSnapshot().draft.trim().length === 0) input.setDraft(prompt)
      else input.notify('info', '输入框已有内容，已为你保留。请补充完整后再发送。')
      enterProjectAgentConversation(sessionId)
      focusNativeComposer()
    },
    configureDesignRoute: async (workspaceId, input) => {
      await surfaces.configureDesignRoute(workspaceId, input)
    },
    bindDesignSources: async (workspaceId, sourceIds, permissionScope, authority) => {
      await surfaces.bindDesignSources(workspaceId, sourceIds, permissionScope, authority)
    },
    saveDesignDefinition: async (workspaceId, expectedRevision, definition) => {
      await surfaces.saveDesignDefinition(workspaceId, expectedRevision, definition)
    },
    reviewDesignCandidates: async (workspaceId, decisions) => {
      await surfaces.reviewDesignCandidates(workspaceId, decisions)
    },
    runDesignSemantica: async (workspaceId, action, input) => {
      await surfaces.runDesignSemantica(workspaceId, action, input)
    },
    recordDesignDecision: async (workspaceId, expectedRevision, outcome, rationale) => {
      await surfaces.recordDesignDecision(workspaceId, expectedRevision, outcome, rationale)
    },
    openProjectFile: async (sessionId, workspacePath, relativePath, title) => {
      if (projectSidebar === undefined) throw new Error('右侧项目文件面板暂时不可用。')
      ctx.sessions.open(sessionId as SessionId)
      await waitForProjectSidebarSession(projectSidebar, sessionId)
      revealProjectSidebar(projectSidebar, sessionId, workspacePath)
      const separator = workspacePath.endsWith('/') || relativePath.startsWith('/') ? '' : '/'
      projectSidebar.openFile({ sessionId, cwd: workspacePath }, `${workspacePath}${separator}${relativePath}`, title)
    },
    openProjectConversation: (sessionId) => {
      enterProjectAgentConversation(sessionId)
    },
    resolveProjectWorkspace: (sessionId) => {
      const workspaces = ctx.workspaces.list.getSnapshot().items
      const workspace = workspaces.find(item => item.sessionIds.some(id => String(id) === sessionId))
        ?? (enteredProject?.sessionId === sessionId
          ? workspaces.find(item => String(item.workspaceId) === enteredProject?.workspaceId)
          : undefined)
      return workspace === undefined
        ? undefined
        : {
          workspaceId: String(workspace.workspaceId),
          title: workspace.title,
          path: workspace.path,
        }
    },
    resolveEnteredProject: () => {
      if (enteredProject === undefined) return undefined
      const workspace = ctx.workspaces.list.getSnapshot().items.find(
        item => String(item.workspaceId) === enteredProject?.workspaceId,
      )
      return workspace === undefined
        ? undefined
        : {
          sessionId: enteredProject.sessionId,
          workspaceId: String(workspace.workspaceId),
          title: workspace.title,
          path: workspace.path,
        }
    },
    activateProjectWorkbenchLayout,
    viewProjectStage: (workspaceId, stage) => {
      stageView.view(workspaceId, stage)
      void enterProject(workspaceId).catch(() => { stageView.followCurrent(workspaceId) })
    },
    returnToCurrentStage: (workspaceId) => { stageView.followCurrent(workspaceId) },
    toggleProjectSidebar: () => { ctx.layout.toggleSidebar() },
    openProjectPage: page.open,
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
      const previewUrl = await resolveProjectPreview(workspaceId)
      await ensureProjectRuntimeSidebar(betterSidebar, projectPreviewAuthority(previewUrl))
      openProjectPreview(betterSidebar, sessionId, workspacePath, previewUrl)
    },
    showProjectTerminal: async (workspaceId, sessionId, workspacePath) => {
      const state = surfaces.getSnapshot().byWorkspace[workspaceId]
      const targetSessionId = state?.status === 'ready' ? state.value.runtime.sessionId ?? sessionId : sessionId
      const workspace = ctx.workspaces.list.getSnapshot().items.find(item => String(item.workspaceId) === workspaceId)
      if (workspace === undefined || !workspace.sessionIds.some(id => String(id) === targetSessionId)) {
        throw new Error('项目运行会话已经不可用。')
      }
      await ensureProjectRuntimeSidebar(betterSidebar)
      ctx.sessions.open(targetSessionId as SessionId)
      await waitForProjectSidebarSession(betterSidebar, targetSessionId)
      const shown = await showProjectRuntimeTerminal(
        betterSidebar,
        targetSessionId,
        workspacePath,
        state?.status === 'ready' ? state.value.runtime.terminalTitle : undefined,
      )
      if (shown) return
      showProjectConversation(targetSessionId)
      const runtime = state?.status === 'ready' ? state.value.runtime : undefined
      await queueRuntimePrompt(targetSessionId, projectRuntimeTerminalRecoveryPrompt(
        runtime?.previewUrl,
        runtime?.terminalTitle,
      ))
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
    children: {
      'fde.project.source.preview': { kind: 'single', scope: 'root' },
      'fde.workbench.module.action': { kind: 'list', scope: 'root' },
    },
  }, ProjectProgressOverlay))

  ctx.slots.inject('conversation.hero.content', () => ctx.slots.register({
    name: 'conversation.hero.content', priority: -20, locale: NS,
    inject: stageWorkbenchInjected,
  }, ProjectStageWorkbenchHero))

  ctx.slots.inject('conversation.view', () => ctx.slots.register({
    name: 'conversation.view', id: 'fde-stage-workbench', order: -1000, locale: NS,
    label: () => t('view.stage'), inject: stageWorkbenchInjected,
  }, ProjectStageWorkbenchView))

  ctx.slots.inject('sidebar.workspaces.projectContext', () => ctx.slots.register({
    name: 'sidebar.workspaces.projectContext', priority: -20, locale: NS,
    inject: stageWorkbenchInjected,
  }, ProjectContextSidebar))

  ctx.inject(['betterSidebar'], (scope: ClientContext) => {
    projectSidebar = scope.betterSidebar
    const dispose = scope.slots.inject('conversation.session.header.utilities', () => scope.slots.register({
      name: 'conversation.session.header.utilities', id: 'fde-project-runtime', order: -10, locale: NS,
      inject: () => runtimeHeaderInjected(scope.betterSidebar),
    }, ProjectRuntimeHeader))
    return () => {
      if (projectSidebar === scope.betterSidebar) projectSidebar = undefined
      dispose()
    }
  })

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
