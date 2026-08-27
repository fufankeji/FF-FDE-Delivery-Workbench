import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { SlotRegistry, createSnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import { apply, inject } from '../src/client/index.ts'
import { ApiDocsView } from '../src/client/ApiDocsView.tsx'
import { ProjectProgressLauncher } from '../src/client/ProjectProgressLauncher.tsx'
import { ProjectProgressOverlay } from '../src/client/ProjectProgressOverlay.tsx'

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
})
