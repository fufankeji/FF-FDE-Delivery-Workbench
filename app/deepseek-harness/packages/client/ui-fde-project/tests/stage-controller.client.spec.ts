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

  it('submits the validation gate to the fixed pilot route', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      value: {
        workspaceId: 'workspace-1', currentStage: 'pilot', revision: 5,
        createdAt: '2026-08-27T00:00:00.000Z', updatedAt: '2026-08-27T00:04:00.000Z',
      },
    }), { status: 200, headers: { 'content-type': 'application/json' } })) as typeof fetch
    vi.stubGlobal('fetch', fetchImpl)
    const controller = new ProjectStageController()

    await controller.completeValidation('workspace-1', 4)

    expect(fetchImpl).toHaveBeenCalledWith('/api/fde-stage/validation/complete', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ workspaceId: 'workspace-1', expectedRevision: 4 }),
    }))
    expect(controller.getSnapshot().byWorkspace['workspace-1']).toMatchObject({
      status: 'ready', value: { currentStage: 'pilot', revision: 5 },
    })
    controller.dispose()
  })

  it('submits the final two gates and accepts the terminal completed state', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, value: {
        workspaceId: 'workspace-1', currentStage: 'handoff', revision: 6,
        createdAt: '2026-08-27T00:00:00.000Z', updatedAt: '2026-08-27T00:05:00.000Z',
      } }), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, value: {
        workspaceId: 'workspace-1', currentStage: 'completed', revision: 7,
        createdAt: '2026-08-27T00:00:00.000Z', updatedAt: '2026-08-27T00:06:00.000Z',
      } }), { status: 200, headers: { 'content-type': 'application/json' } })) as typeof fetch
    vi.stubGlobal('fetch', fetchImpl)
    const controller = new ProjectStageController()

    await controller.completePilot('workspace-1', 5)
    expect(fetchImpl).toHaveBeenNthCalledWith(1, '/api/fde-stage/pilot/complete', expect.objectContaining({ body: JSON.stringify({ workspaceId: 'workspace-1', expectedRevision: 5 }) }))
    await controller.completeHandoff('workspace-1', 6)
    expect(fetchImpl).toHaveBeenNthCalledWith(2, '/api/fde-stage/handoff/complete', expect.objectContaining({ body: JSON.stringify({ workspaceId: 'workspace-1', expectedRevision: 6 }) }))
    expect(controller.getSnapshot().byWorkspace['workspace-1']).toMatchObject({ status: 'ready', value: { currentStage: 'completed', revision: 7 } })
    controller.dispose()
  })

  it('returns one stage with the FDE reason and publishes the reconfirmation boundary', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ ok: true, value: {
      workspaceId: 'workspace-1', currentStage: 'development', revision: 5,
      createdAt: '2026-08-27T00:00:00.000Z', updatedAt: '2026-08-27T00:05:00.000Z',
      reconfirmThrough: 'validation',
      returns: [{
        from: 'validation', to: 'development', reason: '客户补充需求',
        returnedAt: '2026-08-27T00:05:00.000Z', revision: 5,
      }],
    } }), { status: 200, headers: { 'content-type': 'application/json' } })) as typeof fetch
    vi.stubGlobal('fetch', fetchImpl)
    const controller = new ProjectStageController()

    await controller.returnToPrevious('workspace-1', 4, '客户补充需求')

    expect(fetchImpl).toHaveBeenCalledWith('/api/fde-stage/return', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ workspaceId: 'workspace-1', expectedRevision: 4, reason: '客户补充需求' }),
    }))
    expect(controller.getSnapshot().byWorkspace['workspace-1']).toMatchObject({
      status: 'ready',
      value: { currentStage: 'development', revision: 5, reconfirmThrough: 'validation' },
    })
    controller.dispose()
  })
})
