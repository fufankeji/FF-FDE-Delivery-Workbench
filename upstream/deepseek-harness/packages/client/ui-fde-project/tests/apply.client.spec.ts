import { Context } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { SlotRegistry, createSnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import { apply, inject } from '../src/client/index.ts'
import { ApiDocsView } from '../src/client/ApiDocsView.tsx'
import { ProjectProgressLauncher } from '../src/client/ProjectProgressLauncher.tsx'
import { ProjectProgressOverlay } from '../src/client/ProjectProgressOverlay.tsx'
import type { ProjectPageInjected } from '../src/client/slots.ts'

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('ui-fde-project apply', () => {
  it('registers one global page and four project views', async () => {
    const ctx = new Context()
    await ctx.plugin(SlotRegistry).await()
    const locale = new LocaleRuntime(ctx)
    locale.setLocale('zh')
    ctx.provide('locale', locale)
    ctx.provide('sessions', {
      list: createSnapshotStore({ ids: [], byId: {}, current: undefined, phase: 'ready', subagentsByParent: {}, jobsBySession: {}, currentAddress: undefined }),
      binding: () => undefined,
    } as never)
    ctx.provide('workspaces', {
      list: createSnapshotStore({ items: [], archivedSessionIds: [], state: 'idle', phase: 'ready', error: null, baselinesReady: true, recentWorkspaceId: undefined }),
    } as never)
    ctx.provide('modelDirectories', {} as never)
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
    const views = slots.entries('conversation.view')
    expect(views).toHaveLength(4)
    expect(views[0]?.component).toBe(ApiDocsView)
    expect(views.map(view => view.options.id)).toEqual([
      'fde-api-docs', 'fde-architecture', 'fde-observability', 'fde-evaluation',
    ])
    expect(views.map((view) => {
      const label = view.options.label
      return typeof label === 'function' ? label() : label
    })).toEqual(['API 文档', '系统架构', '观测', '评估'])

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
})
