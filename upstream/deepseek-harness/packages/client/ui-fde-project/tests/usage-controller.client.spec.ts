// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { ProjectUsageController } from '../src/client/usage-controller.ts'

describe('project usage reads', () => {
  it('does not let a late previous-project response overwrite the current read', async () => {
    const pending: ((value: Response) => void)[] = []
    const fetchImpl = vi.fn(() => new Promise<Response>(resolve => pending.push(resolve)))
    const controller = new ProjectUsageController(fetchImpl as typeof fetch)
    controller.load('old')
    controller.load('new')
    pending[1]?.(new Response(JSON.stringify({ workspaceId: 'new', sessions: [] })))
    await vi.waitFor(() => expect(controller.getSnapshot().byWorkspace.new?.status).toBe('ready'))
    pending[0]?.(new Response(JSON.stringify({ workspaceId: 'old', sessions: [] })))
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(controller.getSnapshot().byWorkspace.old?.status).toBe('loading')
    controller.dispose()
  })
  it('distinguishes read failure from empty success and permits explicit retry', async () => {
    const fetchImpl = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ workspaceId: 'w', sessions: [] })))
    const controller = new ProjectUsageController(fetchImpl)
    controller.load('w')
    await vi.waitFor(() => expect(controller.getSnapshot().byWorkspace.w?.status).toBe('error'))
    controller.load('w')
    await vi.waitFor(() => expect(controller.getSnapshot().byWorkspace.w).toEqual({ status: 'ready', value: { workspaceId: 'w', sessions: [] } }))
    controller.dispose()
  })
  it('rejects mismatched or incomplete numeric payloads, and stops publishing after disposal', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ workspaceId: 'other', sessions: [] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ workspaceId: 'w', sessions: [{ sessionId: 's', status: 'ready', stats: {} }] })))
    const controller = new ProjectUsageController(fetchImpl)
    controller.load('w')
    await vi.waitFor(() => expect(controller.getSnapshot().byWorkspace.w?.status).toBe('error'))
    controller.load('w')
    await vi.waitFor(() => expect(controller.getSnapshot().byWorkspace.w?.status).toBe('error'))
    controller.dispose()
    controller.load('w')
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })
})
