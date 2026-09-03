// @vitest-environment jsdom
import { Context } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { SlotRegistry, createSnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import { apply, inject } from '../src/client/index.ts'
import { ArchitectureView } from '../src/client/ArchitectureView.tsx'
import { ObservabilityView } from '../src/client/ObservabilityView.tsx'
import { ProjectContextSidebar } from '../src/client/ProjectContextSidebar.tsx'
import { ProjectProgressLauncher } from '../src/client/ProjectProgressLauncher.tsx'
import { ProjectProgressOverlay } from '../src/client/ProjectProgressOverlay.tsx'
import { ProjectRuntimeHeader } from '../src/client/ProjectRuntimeHeader.tsx'
import { ProjectStageWorkbenchHero, ProjectStageWorkbenchView } from '../src/client/StageWorkbench.tsx'
import type {
  ProjectPageInjected, ProjectRuntimeHeaderInjected, ProjectStageWorkbenchInjected, ProjectViewInjected,
} from '../src/client/slots.ts'

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

function requestPath(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  return input instanceof URL ? input.href : input.url
}

describe('ui-fde-project apply', () => {
  it('registers the global page and reveals project views only after their stage', async () => {
    const ctx = new Context()
    await ctx.plugin(SlotRegistry).await()
    const locale = new LocaleRuntime(ctx)
    locale.setLocale('zh')
    ctx.provide('locale', locale)
    const prompt = vi.fn(async (
      _content: readonly { readonly type: string; readonly text?: string }[],
      _mode: string,
    ) => ({ ok: true as const, value: { accepted: true as const } }))
    const openTab = vi.fn()
    const selectView = vi.fn()
    const openSession = vi.fn()
    ctx.provide('betterSidebar', {
      getSnapshot: () => ({
        prefs: {
          agentTerminalTools: true,
          tabsEnabled: { terminal: true, browser: true },
          browserAllowedLoopback: '',
        },
      }),
      openTab,
    } as never)
    ctx.provide('sessions', {
      list: createSnapshotStore({
        ids: ['session-1'],
        byId: { 'session-1': { id: 'session-1', displayTitle: '会话', running: false, blank: true, updatedAt: 1 } },
        current: 'session-1', phase: 'ready', subagentsByParent: {}, jobsBySession: {}, currentAddress: undefined,
      }),
      binding: () => ({ session: { prompt } }),
      scope: () => ({ get: () => ({ selectView }) }),
      open: openSession,
    } as never)
    ctx.provide('workspaces', {
      list: createSnapshotStore({
        items: [{
          workspaceId: 'workspace-1', path: '/project/one', title: '项目一', sessionIds: ['session-1'],
          createdAt: '2026-08-27T00:00:00.000Z', updatedAt: '2026-08-27T00:00:00.000Z',
        }],
        archivedSessionIds: [], state: 'idle', phase: 'ready', error: null, baselinesReady: true, recentWorkspaceId: 'workspace-1',
      }),
    } as never)
    ctx.provide('conversation', {} as never)
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const path = requestPath(input)
      const completedRequirements = path.endsWith('/requirements/complete')
      const completedSolution = path.endsWith('/solution/complete')
      if (path.endsWith('/fde-project/runtime/start')) {
        return new Response(JSON.stringify({ ok: true, value: {
          workspaceId: 'workspace-1', title: '项目一',
          runtime: {
            schemaVersion: 1, revision: 1, operationId: `runtime_${'a'.repeat(32)}`,
            action: 'start', status: 'starting', sessionId: 'session-1',
            updatedAt: '2026-08-27T00:00:00.000Z',
          },
          apiDocs: { status: 'unconfigured', message: '未配置' },
          architecture: null, evaluation: { casesCount: 0, reports: [] },
          requirements: { root: 'fde-deliverables/01-requirement-research', requiredCount: 3, presentCount: 0, artifacts: [] },
          solution: { root: 'fde-deliverables/02-solution-design', requiredCount: 5, presentCount: 0, artifacts: [] },
        } }), { status: 200 })
      }
      if (path.endsWith('/fde-project/snapshot')) {
        return new Response(JSON.stringify({ ok: true, value: {
          workspaceId: 'workspace-1', title: '项目一',
          runtime: { schemaVersion: 1, revision: 0, status: 'stopped', updatedAt: '1970-01-01T00:00:00.000Z' },
          apiDocs: { status: 'unconfigured', message: '未配置' },
          architecture: null, evaluation: { casesCount: 0, reports: [] },
          requirements: { root: 'fde-deliverables/01-requirement-research', requiredCount: 3, presentCount: 0, artifacts: [] },
          solution: { root: 'fde-deliverables/02-solution-design', requiredCount: 5, presentCount: 0, artifacts: [] },
        } }), { status: 200 })
      }
      return new Response(JSON.stringify({
        ok: true,
        value: {
          workspaceId: 'workspace-1',
          currentStage: completedSolution ? 'development' : completedRequirements ? 'solution' : 'requirements',
          revision: completedSolution ? 3 : completedRequirements ? 2 : 1,
          createdAt: '2026-08-27T00:00:00.000Z', updatedAt: '2026-08-27T00:00:00.000Z',
        },
      }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchImpl)
    const slots = ctx.get('slots') as SlotRegistry
    slots.register({
      name: 'root',
      children: {
        'sidebar.footer.action': { kind: 'list', scope: 'root' },
        'shell.overlay': { kind: 'list', scope: 'root' },
        'conversation.view': { kind: 'list', scope: 'session' },
        'conversation.hero.content': { kind: 'single', scope: 'root' },
        'conversation.session.header.utilities': { kind: 'list', scope: 'session' },
        'sidebar.workspaces.projectContext': { kind: 'single', scope: 'root' },
      },
    } as never, () => null)
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()

    expect(slots.entries('sidebar.footer.action')[0]?.component).toBe(ProjectProgressLauncher)
    expect(slots.entries('shell.overlay')[0]?.component).toBe(ProjectProgressOverlay)
    expect(slots.spec('fde.project.source.preview')).toEqual({ kind: 'single', scope: 'root' })
    await vi.waitFor(() => {
      expect(fetchImpl.mock.calls.filter(call => requestPath(call[0]).endsWith('/fde-project/snapshot'))).toHaveLength(1)
    })
    expect(slots.entries('conversation.hero.content')[0]?.component).toBe(ProjectStageWorkbenchHero)
    expect(slots.entries('sidebar.workspaces.projectContext')[0]?.component).toBe(ProjectContextSidebar)
    expect(slots.entries('conversation.view').map(view => view.component)).toEqual([ProjectStageWorkbenchView])

    const stageInjected = (slots.entries('conversation.hero.content')[0]!.inject as unknown as () => ProjectStageWorkbenchInjected)()
    const openSourceUpload = vi.fn()
    window.addEventListener('fde:project-source-upload-open', openSourceUpload)
    stageInjected.openProjectSourceUpload('workspace-1')
    expect(openSourceUpload).toHaveBeenCalledTimes(1)
    expect((openSourceUpload.mock.calls[0]?.[0] as CustomEvent).detail).toEqual({ workspaceId: 'workspace-1' })
    window.removeEventListener('fde:project-source-upload-open', openSourceUpload)

    await stageInjected.runDiscoveryAction(
      'session-1', 'qualify-workflow', ['fde-resources/客户访谈纪要.docx'], '',
    )
    expect(selectView).toHaveBeenCalledWith('chat')
    expect(openSession).toHaveBeenCalledWith('session-1')
    expect(prompt).toHaveBeenCalledTimes(1)
    expect(prompt.mock.calls[0]?.[0][0]?.text).toContain('请加载方法 Skill `qualify-ai-workflow`')
    expect(prompt.mock.calls[0]?.[0][0]?.text).toContain('不要一次加载全部')
    expect(prompt.mock.calls[0]?.[0][0]?.text).toContain('fde-resources/客户访谈纪要.docx')
    expect(prompt.mock.calls[0]?.[0][0]?.text).toContain('不要把未列出的项目文件视为本轮已经提供的事实来源')
    prompt.mockClear()

    const injected = (slots.entries('shell.overlay')[0]!.inject as unknown as () => ProjectPageInjected)()
    const progressEvent = new CustomEvent('fde:project-progress-open', {
      cancelable: true,
      detail: { workspaceId: 'workspace-1' },
    })
    window.dispatchEvent(progressEvent)
    expect(progressEvent.defaultPrevented).toBe(true)
    expect(injected.hooks.projectPage.getSnapshot()).toEqual({
      open: true, view: 'project', workspaceId: 'workspace-1',
    })
    const openProjectCreation = vi.fn((event: Event) => { event.preventDefault() })
    window.addEventListener('fde:project-create-open', openProjectCreation)
    injected.openProjectCreation()
    expect(openProjectCreation).toHaveBeenCalledTimes(1)
    window.removeEventListener('fde:project-create-open', openProjectCreation)
    await injected.completeRequirements('workspace-1', 1)
    await vi.waitFor(() => { expect(slots.entries('conversation.view')).toHaveLength(2) })
    const views = slots.entries('conversation.view')
    expect(views.map(view => view.component)).toEqual([ProjectStageWorkbenchView, ArchitectureView])
    expect(views.map(view => view.options.id)).toEqual(['fde-stage-workbench', 'fde-architecture'])
    expect(views.map((view) => {
      const label = view.options.label
      return typeof label === 'function' ? label() : label
    })).toEqual(['项目工作台', '系统架构'])
    expect(views[0]?.options.order).toBe(-1000)
    const architectureInjected = (views[1]!.inject as unknown as (sessionId: string) => ProjectViewInjected)('session-1')
    await architectureInjected.requestArchitectureDraft(4)
    const architectureInstruction = prompt.mock.calls[0]?.[0][0]?.text
    expect(architectureInstruction).toContain('architecture_get')
    expect(architectureInstruction).toContain('2–7 个职责分组')
    expect(architectureInstruction).toContain('保留仍代表同一概念的现有 ID')
    expect(architectureInstruction).toContain('关键运行时、数据流、控制流或依赖关系')
    expect(architectureInstruction).toContain('页面当前显示的 revision 是 4')
    prompt.mockClear()

    await injected.completeSolution('workspace-1', 2)
    await vi.waitFor(() => { expect(slots.entries('conversation.view')).toHaveLength(3) })
    expect(slots.entries('conversation.view').map(view => view.component)).toEqual([
      ProjectStageWorkbenchView, ArchitectureView, ObservabilityView,
    ])

    const runtimeEntry = slots.entries('conversation.session.header.utilities')[0]
    expect(runtimeEntry?.component).toBe(ProjectRuntimeHeader)
    const runtimeInjected = (runtimeEntry?.inject as unknown as () => ProjectRuntimeHeaderInjected)()
    await runtimeInjected.startProject('workspace-1', 'session-1', '/project/one')
    expect(selectView).toHaveBeenCalledWith('chat')
    expect(openSession).toHaveBeenCalledWith('session-1')
    expect(openTab).toHaveBeenCalledWith(
      { type: 'explorer', title: 'Files', path: '/project/one' },
      { sessionId: 'session-1', cwd: '/project/one' },
    )
    expect(prompt).toHaveBeenCalledTimes(1)
    expect(prompt.mock.calls[0]?.[0][0]?.text).toContain('operationId=runtime_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
    expect(prompt.mock.calls[0]?.[0][0]?.text).toContain('在当前对话用简短中文正常说明结果和下一步')
    expect(selectView.mock.invocationCallOrder[0]).toBeLessThan(prompt.mock.invocationCallOrder[0]!)
    expect(openSession.mock.invocationCallOrder[0]).toBeLessThan(prompt.mock.invocationCallOrder[0]!)

    await fiber.dispose()
    expect(slots.entries('conversation.view')).toHaveLength(0)
    window.dispatchEvent(new CustomEvent('fde:project-progress-open', { detail: { workspaceId: 'workspace-2' } }))
    expect(injected.hooks.projectPage.getSnapshot().workspaceId).toBe('workspace-1')
  })

  it('enters the latest visible project Session and creates one only when none is recoverable', async () => {
    const ctx = new Context()
    await ctx.plugin(SlotRegistry).await()
    const locale = new LocaleRuntime(ctx)
    locale.setLocale('zh')
    ctx.provide('locale', locale)
    const open = vi.fn()
    const selectView = vi.fn()
    ctx.provide('sessions', {
      list: createSnapshotStore({
        ids: ['older', 'latest', 'child', 'archived'],
        byId: {
          older: { id: 'older', displayTitle: '旧会话', running: false, blank: false, updatedAt: 1 },
          latest: { id: 'latest', displayTitle: '最新会话', running: false, blank: false, updatedAt: 4 },
          child: { id: 'child', displayTitle: '子智能体', origin: 'subagent', running: false, blank: false, updatedAt: 9 },
          archived: { id: 'archived', displayTitle: '已归档', running: false, blank: false, updatedAt: 10 },
        },
        current: undefined, phase: 'ready', subagentsByParent: {}, jobsBySession: {}, currentAddress: undefined,
      }),
      binding: () => undefined,
      scope: () => ({ get: () => ({ selectView }) }),
      open,
    } as never)
    const connectWorkspace = vi.fn(async () => 'new-session')
    ctx.provide('workspaces', {
      list: createSnapshotStore({
        items: [{
          workspaceId: 'workspace-1', path: '/project/one', title: '项目一',
          sessionIds: ['older', 'latest', 'child', 'archived'],
          createdAt: '2026-08-27T00:00:00.000Z', updatedAt: '2026-08-27T00:00:00.000Z',
        }, {
          workspaceId: 'workspace-2', path: '/project/two', title: '项目二', sessionIds: [],
          createdAt: '2026-08-27T00:00:00.000Z', updatedAt: '2026-08-27T00:00:00.000Z',
        }],
        archivedSessionIds: ['archived'], state: 'idle', phase: 'ready', error: null,
        baselinesReady: true, recentWorkspaceId: undefined,
      }),
      connectWorkspace,
    } as never)
    ctx.provide('conversation', {} as never)
    const slots = ctx.get('slots') as SlotRegistry
    slots.register({
      name: 'root',
      children: {
        'sidebar.footer.action': { kind: 'list', scope: 'root' },
        'shell.overlay': { kind: 'list', scope: 'root' },
        'conversation.view': { kind: 'list', scope: 'session' },
      },
    } as never, () => null)
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    const injected = (slots.entries('shell.overlay')[0]!.inject as unknown as () => ProjectPageInjected)()

    await injected.enterProject('workspace-1')
    expect(selectView).toHaveBeenLastCalledWith('fde-stage-workbench')
    expect(open).toHaveBeenLastCalledWith('latest')
    expect(connectWorkspace).not.toHaveBeenCalled()

    await injected.reviewProjectArchitecture('workspace-1')
    expect(selectView).toHaveBeenLastCalledWith('fde-architecture')
    expect(open).toHaveBeenLastCalledWith('latest')
    expect(selectView.mock.invocationCallOrder[0]).toBeLessThan(open.mock.invocationCallOrder.at(-1) ?? 0)

    await injected.enterProject('workspace-2')
    expect(selectView).toHaveBeenLastCalledWith('fde-stage-workbench')
    expect(connectWorkspace).toHaveBeenCalledWith('workspace-2')
    expect(open).toHaveBeenLastCalledWith('new-session')
    await fiber.dispose()
  })
})
