import { describe, expect, it, vi } from 'vitest'
import { FdeProjectSurfaceController, fetchProjectSurface } from '../src/client/controller.ts'

const value = {
  workspaceId: 'w-1',
  title: '项目一',
  apiDocs: { status: 'unconfigured', message: '尚未配置' },
  architecture: null,
  evaluation: { casesCount: 0, reports: [] },
} as const

describe('FDE project surface controller', () => {
  it('reads the exact project through the same-origin route', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ ok: true, value }), {
      status: 200, headers: { 'content-type': 'application/json' },
    }))
    await expect(fetchProjectSurface('w-1', fetchImpl)).resolves.toEqual(value)
    expect(fetchImpl).toHaveBeenCalledWith('/api/fde-project/snapshot', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ workspaceId: 'w-1' }),
    }))
  })

  it('publishes one load and replaces it on explicit refresh', async () => {
    const original = globalThis.fetch
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ ok: true, value }), { status: 200 }))
    globalThis.fetch = fetchImpl
    try {
      const controller = new FdeProjectSurfaceController()
      controller.load('w-1')
      await vi.waitFor(() => { expect(controller.getSnapshot().byWorkspace['w-1']?.status).toBe('ready') })
      controller.load('w-1')
      expect(fetchImpl).toHaveBeenCalledTimes(1)
      controller.refresh('w-1')
      await vi.waitFor(() => { expect(fetchImpl).toHaveBeenCalledTimes(2) })
      controller.dispose()
    } finally {
      globalThis.fetch = original
    }
  })

  it('cancels a pending project read when another project becomes active', async () => {
    const original = globalThis.fetch
    let firstSignal: AbortSignal | undefined
    const fetchImpl: typeof fetch = async (_input, init) => {
      const body = init?.body
      if (typeof body !== 'string') throw new Error('expected a JSON request body')
      const workspaceId = JSON.parse(body) as { workspaceId: string }
      if (workspaceId.workspaceId === 'w-1') {
        firstSignal = init?.signal instanceof AbortSignal ? init.signal : undefined
        return await new Promise<Response>((_resolve, reject) => {
          firstSignal?.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'))
          }, { once: true })
        })
      }
      return new Response(JSON.stringify({ ok: true, value: { ...value, workspaceId: 'w-2' } }), { status: 200 })
    }
    globalThis.fetch = fetchImpl
    try {
      const controller = new FdeProjectSurfaceController()
      controller.load('w-1')
      controller.load('w-2')
      await vi.waitFor(() => { expect(firstSignal?.aborted).toBe(true) })
      await vi.waitFor(() => { expect(controller.getSnapshot().byWorkspace['w-2']?.status).toBe('ready') })
      controller.dispose()
    } finally {
      globalThis.fetch = original
    }
  })
})
