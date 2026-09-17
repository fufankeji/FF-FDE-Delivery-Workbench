// @vitest-environment jsdom
import { Context } from '@deepseek-ai/cordis'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import { TestRemote } from '@deepseek-ai/dsh-client-test-runtime'
import { expect, it, vi } from 'vitest'
import { apply, inject } from '../src/client/index.ts'
import { SettingsRoot, SettingsShortcut } from '../src/client/SettingsRoot.tsx'

it('binds the optional trigger to the original settings store and retracts it independently', async () => {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  ctx.provide('locale', new LocaleRuntime(ctx))
  ctx.provide('connection', { state: createSnapshotStore('connected'), reconnect: vi.fn() } as never)
  const remote = new TestRemote(ctx, { settings: {} })
  remote.$host.isLoopback = false
  ctx.provide('settingsScope', {} as never)
  const slots = ctx.get('slots') as SlotRegistry
  slots.register({ name: 'root', children: {
    'sidebar.settings': { kind: 'single', scope: 'root' },
    'shell.overlay': { kind: 'list', scope: 'root' },
  } } as never, () => null)
  const fiber = ctx.plugin({ inject, apply })
  await fiber.await()
  expect(slots.entries('sidebar.settings')[0]?.component).toBe(SettingsRoot)
  const release = slots.register({ name: 'shell.overlay', id: 'alternate-sidebar', children: {
    'sidebar.settings.shortcut': { kind: 'single', scope: 'root' },
  } } as never, () => null)
  await vi.waitFor(() => expect(slots.entries('sidebar.settings.shortcut')[0]?.component).toBe(SettingsShortcut))
  const shell = slots.entries('sidebar.settings')[0]!
  const shortcut = slots.entries('sidebar.settings.shortcut')[0]!
  expect(shortcut.store).toBe(shell.store)
  expect(shell.store).toBeDefined()
  release()
  expect(slots.entries('sidebar.settings.shortcut')).toHaveLength(0)
  expect(slots.entries('sidebar.settings')).toHaveLength(1)
  await fiber.dispose()
  expect(slots.entries('sidebar.settings')).toHaveLength(0)
  await ctx.fiber.dispose()
})
