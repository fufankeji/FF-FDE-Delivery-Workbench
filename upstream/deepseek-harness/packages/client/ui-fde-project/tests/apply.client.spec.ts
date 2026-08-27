import { Context } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { SlotRegistry, createSnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import { apply, inject } from '../src/client/index.ts'
import { ArchitectureView } from '../src/client/ArchitectureView.tsx'
import { ApiDocsView } from '../src/client/ApiDocsView.tsx'
import { ProjectProgressLauncher } from '../src/client/ProjectProgressLauncher.tsx'
import { ProjectProgressOverlay } from '../src/client/ProjectProgressOverlay.tsx'
import type { ProjectPageInjected } from '../src/client/slots.ts'

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
    ctx.provide('sessions', {
      list: createSnapshotStore({
        ids: ['session-1'],
        byId: { 'session-1': { id: 'session-1', displayTitle: '会话', running: false, blank: true, updatedAt: 1 } },
        current: 'session-1', phase: 'ready', subagentsByParent: {}, jobsBySession: {}, currentAddress: undefined,
      }),
      binding: () => undefined,
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
    ctx.provide('modelDirectories', {} as never)
    ctx.provide('conversation', {} as never)
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const path = requestPath(input)
      const completedRequirements = path.endsWith('/requirements/complete')
      const completedSolution = path.endsWith('/solution/complete')
      if (path.endsWith('/fde-project/snapshot')) {
        return new Response(JSON.stringify({ ok: true, value: {
          workspaceId: 'workspace-1', title: '项目一', apiDocs: { status: 'unconfigured', message: '未配置' },
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
    }) as typeof fetch
    vi.stubGlobal('fetch', fetchImpl)
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

    expect(slots.entries('sidebar.footer.action')[0]?.component).toBe(ProjectProgressLauncher)
    expect(slots.entries('shell.overlay')[0]?.component).toBe(ProjectProgressOverlay)
    expect(slots.spec('fde.project.source.preview')).toEqual({ kind: 'single', scope: 'root' })
    await vi.waitFor(() => { expect(fetchImpl).toHaveBeenCalledTimes(1) })
    expect(slots.entries('conversation.view')).toHaveLength(0)

    const injected = (slots.entries('shell.overlay')[0]!.inject as unknown as () => ProjectPageInjected)()
    await injected.completeRequirements('workspace-1', 1)
    await vi.waitFor(() => { expect(slots.entries('conversation.view')).toHaveLength(1) })
    const views = slots.entries('conversation.view')
    expect(views[0]?.component).toBe(ArchitectureView)
    expect(views.map(view => view.options.id)).toEqual(['fde-architecture'])
    expect(views.map((view) => {
      const label = view.options.label
      return typeof label === 'function' ? label() : label
    })).toEqual(['系统架构'])

    await injected.completeSolution('workspace-1', 2)
    await vi.waitFor(() => { expect(slots.entries('conversation.view')).toHaveLength(2) })
    expect(slots.entries('conversation.view').map(view => view.component)).toEqual([ApiDocsView, ArchitectureView])

    await fiber.dispose()
    expect(slots.entries('conversation.view')).toHaveLength(0)
  })

  it('confirms and rechecks the exact project Session model before queuing one visible Wiki instruction', async () => {
    const ctx = new Context()
    await ctx.plugin(SlotRegistry).await()
    const locale = new LocaleRuntime(ctx)
    locale.setLocale('zh')
    ctx.provide('locale', locale)
    const prompt = vi.fn(async (
      _content: readonly { readonly type: string; readonly text?: string }[],
      _mode: string,
    ) => ({ ok: true as const, value: { accepted: true as const } }))
    ctx.provide('sessions', {
      list: createSnapshotStore({
        ids: ['session-1'],
        byId: { 'session-1': { id: 'session-1', displayTitle: '项目会话', running: false, blank: false, updatedAt: 1 } },
        current: undefined, phase: 'ready', subagentsByParent: {}, jobsBySession: {}, currentAddress: undefined,
      }),
      binding: () => ({ session: { prompt } }),
      open: vi.fn(),
    } as never)
    ctx.provide('workspaces', {
      list: createSnapshotStore({
        items: [{
          workspaceId: 'workspace-1', path: '/project/one', title: '项目一', sessionIds: ['session-1'],
          createdAt: '2026-08-27T00:00:00.000Z', updatedAt: '2026-08-27T00:00:00.000Z',
        }],
        archivedSessionIds: [], state: 'idle', phase: 'ready', error: null,
        baselinesReady: true, recentWorkspaceId: undefined,
      }),
    } as never)
    const models = {
      current: { provider: 'deepseek-official', model: 'deepseek-v4-flash' }, routable: true,
      groups: [{ id: 'deepseek-official', name: 'DeepSeek', models: [{ id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash' }] }],
      failures: [],
    }
    const loadModels = vi.fn(async () => models)
    ctx.provide('modelDirectories', { directoryFor: () => ({ load: loadModels }) } as never)
    ctx.provide('conversation', {} as never)
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      value: {
        workspaceId: 'workspace-1',
        requirementWiki: {
          status: 'absent', current: null,
          build: {
            schemaVersion: 1, id: 'wiki_12345678901234567890123456789012', status: 'queued', expectedRevision: 0,
            sourceCatalogFingerprint: 'a'.repeat(64),
            sources: [{
              sourceId: 'src_123456789012', storedName: '客户需求.txt', relativePath: 'fde-resources/客户需求.txt',
              derivedPath: '.fde/derived/src_123456789012.md', bytes: 10, mtimeMs: 1,
              parser: '@jiaoqsh/dsh-document', parserVersion: '0.1.1',
            }],
            createdAt: '2026-08-27T00:00:00.000Z', updatedAt: '2026-08-27T00:00:00.000Z',
          },
        },
      },
    }), { status: 200 })) as typeof fetch
    vi.stubGlobal('fetch', fetchImpl)

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

    const target = await injected.prepareRequirementWikiRun('workspace-1', 'session-1')
    expect(target).toEqual({
      sessionId: 'session-1', provider: 'deepseek-official', providerName: 'DeepSeek',
      model: 'deepseek-v4-flash', modelName: 'DeepSeek V4 Flash',
    })
    await injected.startRequirementWikiBuild('workspace-1', ['src_123456789012'], 0, target)
    expect(loadModels).toHaveBeenCalledTimes(2)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(prompt.mock.calls[0]?.[0][0]?.type).toBe('text')
    expect(prompt.mock.calls[0]?.[0][0]?.text).toContain('src_123456789012: .fde/derived/src_123456789012.md')
    expect(prompt.mock.calls[0]?.[1]).toBe('queue')

    models.current.model = 'deepseek-v4-pro'
    await expect(injected.startRequirementWikiBuild(
      'workspace-1', ['src_123456789012'], 0, target,
    )).rejects.toThrow('当前项目会话的模型已变化')
    expect(loadModels).toHaveBeenCalledTimes(3)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(prompt).toHaveBeenCalledTimes(1)
    await fiber.dispose()
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
    ctx.provide('modelDirectories', {} as never)
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
    expect(open).toHaveBeenLastCalledWith('latest')
    expect(connectWorkspace).not.toHaveBeenCalled()

    await injected.reviewProjectArchitecture('workspace-1')
    expect(selectView).toHaveBeenLastCalledWith('fde-architecture')
    expect(open).toHaveBeenLastCalledWith('latest')
    expect(selectView.mock.invocationCallOrder[0]).toBeLessThan(open.mock.invocationCallOrder.at(-1) ?? 0)

    await injected.enterProject('workspace-2')
    expect(connectWorkspace).toHaveBeenCalledWith('workspace-2')
    expect(open).toHaveBeenLastCalledWith('new-session')
    await fiber.dispose()
  })
})
