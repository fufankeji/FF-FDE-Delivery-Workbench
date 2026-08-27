import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { apply, inject } from '../src/client/index.ts'

describe('ui-fde-document-preview apply', () => {
  it('registers one Office viewer and one project-detail preview occupant', async () => {
    const ctx = new Context()
    await ctx.plugin(SlotRegistry).await()
    const disposeViewer = vi.fn()
    const registerFileViewer = vi.fn((_descriptor: unknown) => disposeViewer)
    ctx.provide('betterSidebar', { registerFileViewer } as never)
    const slots = ctx.get('slots') as SlotRegistry
    slots.register({
      name: 'root',
      children: { 'fde.project.source.preview': { kind: 'single', scope: 'root' } },
    } as never, () => null)
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    expect(registerFileViewer).toHaveBeenCalledTimes(1)
    expect(registerFileViewer.mock.calls[0]?.[0]).toMatchObject({
      id: 'fde-office', priority: 60, fetchStrategy: 'mediaUrl',
    })
    expect(slots.entries('fde.project.source.preview')).toHaveLength(1)
    await fiber.dispose()
    expect(disposeViewer).toHaveBeenCalledTimes(1)
  })
})
