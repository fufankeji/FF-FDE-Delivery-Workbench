import { afterEach, describe, expect, it, vi } from 'vitest'
import { FdeStageProgressController } from '../src/client/controller.ts'

afterEach(() => { vi.unstubAllGlobals() })

function success(workspaceId: string) {
  return new Response(JSON.stringify({
    ok: true,
    value: {
      workspaceId,
      currentStage: 'requirements',
      revision: 1,
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
  })
})
