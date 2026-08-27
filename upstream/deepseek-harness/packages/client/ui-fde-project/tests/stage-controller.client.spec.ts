// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  FDE_STAGE_CHANGED_EVENT,
  ProjectStageController,
} from '../src/client/stage-controller.ts'

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('ProjectStageController', () => {
  it('publishes the committed stage and invalidates the matching browser cache', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        value: {
          workspaceId: 'workspace-1',
          currentStage: 'solution',
          revision: 2,
          createdAt: '2026-08-27T00:00:00.000Z',
          updatedAt: '2026-08-27T00:01:00.000Z',
        },
      }), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: false,
        error: { message: 'revision conflict' },
      }), { status: 409, headers: { 'content-type': 'application/json' } })) as typeof fetch
    vi.stubGlobal('fetch', fetchImpl)
    const changed = vi.fn()
    window.addEventListener(FDE_STAGE_CHANGED_EVENT, changed)
    const controller = new ProjectStageController()

    await controller.completeRequirements('workspace-1', 1)

    expect(controller.getSnapshot().byWorkspace['workspace-1']).toMatchObject({
      status: 'ready', value: { currentStage: 'solution', revision: 2 },
    })
    expect(changed).toHaveBeenCalledTimes(1)
    expect((changed.mock.calls[0]?.[0] as CustomEvent).detail).toEqual({ workspaceId: 'workspace-1' })
    await expect(controller.completeRequirements('workspace-1', 1)).rejects.toThrow('revision conflict')
    expect(changed).toHaveBeenCalledTimes(1)
    controller.dispose()
    window.removeEventListener(FDE_STAGE_CHANGED_EVENT, changed)
  })

  it('uses the solution gate and emits the same scoped invalidation after development is committed', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      value: {
        workspaceId: 'workspace-1', currentStage: 'development', revision: 3,
        createdAt: '2026-08-27T00:00:00.000Z', updatedAt: '2026-08-27T00:02:00.000Z',
      },
    }), { status: 200, headers: { 'content-type': 'application/json' } })) as typeof fetch
    vi.stubGlobal('fetch', fetchImpl)
    const changed = vi.fn()
    window.addEventListener(FDE_STAGE_CHANGED_EVENT, changed)
    const controller = new ProjectStageController()

    await controller.completeSolution('workspace-1', 2)

    expect(fetchImpl).toHaveBeenCalledWith('/api/fde-stage/solution/complete', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ workspaceId: 'workspace-1', expectedRevision: 2 }),
    }))
    expect(controller.getSnapshot().byWorkspace['workspace-1']).toMatchObject({
      status: 'ready', value: { currentStage: 'development', revision: 3 },
    })
    expect(changed).toHaveBeenCalledTimes(1)
    controller.dispose()
    window.removeEventListener(FDE_STAGE_CHANGED_EVENT, changed)
  })
})
