// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FDE_STAGE_CHANGED_EVENT, FdeStageProgressController } from '../src/client/controller.ts'

afterEach(() => { vi.unstubAllGlobals() })

function success(workspaceId: string, currentStage = 'requirements', revision = 1) {
  return new Response(JSON.stringify({
    ok: true,
    value: {
      workspaceId,
      currentStage,
      revision,
      createdAt: '2026-08-26T00:00:00.000Z',
      updatedAt: '2026-08-26T00:00:00.000Z',
    },
  }), { status: 200, headers: { 'content-type': 'application/json' } })
}

async function waitForState(controller: FdeStageProgressController, workspaceId: string, status: 'ready' | 'error') {
  if (controller.getSnapshot().byWorkspace[workspaceId]?.status === status) return
  await new Promise<void>((resolve) => {
    const unsubscribe = controller.subscribe(() => {
      if (controller.getSnapshot().byWorkspace[workspaceId]?.status !== status) return
      unsubscribe()
      resolve()
    })
  })
}

describe('FdeStageProgressController', () => {
  it('coalesces one Workspace load and publishes the committed value', async () => {
    const fetchImpl = vi.fn(async () => success('w-1')) as typeof fetch
    vi.stubGlobal('fetch', fetchImpl)
    const controller = new FdeStageProgressController()
    controller.load('w-1')
    controller.load('w-1')
    await waitForState(controller, 'w-1', 'ready')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(controller.getSnapshot().byWorkspace['w-1']).toMatchObject({
      status: 'ready', value: { workspaceId: 'w-1', currentStage: 'requirements', revision: 1 },
    })
    controller.dispose()
  })

  it('keeps failures project-scoped and retries explicitly', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: false, error: { code: 'workspace-not-found', message: '当前项目不存在。' },
      }), { status: 404, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(success('w-1')) as typeof fetch
    vi.stubGlobal('fetch', fetchImpl)
    const controller = new FdeStageProgressController()
    controller.load('w-1')
    await waitForState(controller, 'w-1', 'error')
    expect(controller.getSnapshot().byWorkspace['w-1']).toEqual({
      status: 'error', message: '当前项目不存在。',
    })
    controller.retry('w-1')
    await waitForState(controller, 'w-1', 'ready')
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    controller.dispose()
  })

  it('re-reads the committed stage when the addressed project changes', async () => {
    const calls = new Map<string, number>()
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const workspaceId = JSON.parse(String(init?.body))?.workspaceId as string
      const count = (calls.get(workspaceId) ?? 0) + 1
      calls.set(workspaceId, count)
      return workspaceId === 'w-1' && count === 2
        ? success('w-1', 'solution', 2)
        : success(workspaceId)
    }) as typeof fetch
    vi.stubGlobal('fetch', fetchImpl)
    const controller = new FdeStageProgressController()
    controller.load('w-1')
    controller.load('w-2')
    await waitForState(controller, 'w-1', 'ready')
    await waitForState(controller, 'w-2', 'ready')

    window.dispatchEvent(new CustomEvent(FDE_STAGE_CHANGED_EVENT, { detail: { workspaceId: 'w-1' } }))

    await vi.waitFor(() => {
      expect(controller.getSnapshot().byWorkspace['w-1']).toMatchObject({
        status: 'ready', value: { currentStage: 'solution', revision: 2 },
      })
    })
    expect(calls).toEqual(new Map([['w-1', 2], ['w-2', 1]]))
    controller.dispose()
  })
})
