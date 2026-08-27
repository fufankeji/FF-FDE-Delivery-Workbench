import { describe, expect, it, vi } from 'vitest'
import {
  FDE_PROJECT_SNAPSHOT_PATH,
  FDE_REQUIREMENT_WIKI_ABANDON_PATH,
  FDE_REQUIREMENT_WIKI_START_PATH,
  RequirementWikiController,
  type RequirementWikiSnapshot,
} from '../src/client/wiki-controller.ts'

const absent: RequirementWikiSnapshot = {
  status: 'absent', current: null, build: null, message: '尚未整理需求知识。',
}

function response(workspaceId: string, requirementWiki: RequirementWikiSnapshot = absent): Response {
  return new Response(JSON.stringify({ ok: true, value: { workspaceId, requirementWiki } }), { status: 200 })
}

function requestPath(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  return input instanceof URL ? input.href : input.url
}

describe('RequirementWikiController', () => {
  it('loads once, retains the last good value while refreshing, and reports refresh failure', async () => {
    let rejectRefresh: ((error: Error) => void) | undefined
    const fetchMock = vi.fn((_input: RequestInfo | URL) => {
      if (fetchMock.mock.calls.length === 1) return Promise.resolve(response('workspace-1'))
      return new Promise<Response>((_resolve, reject) => { rejectRefresh = reject })
    })
    const fetchImpl = fetchMock as typeof fetch
    const controller = new RequirementWikiController(fetchImpl)
    controller.load('workspace-1')
    await vi.waitFor(() => { expect(controller.getSnapshot().byWorkspace['workspace-1']?.status).toBe('ready') })
    controller.load('workspace-1')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    controller.load('workspace-1', true)
    expect(controller.getSnapshot().byWorkspace['workspace-1']).toEqual({ status: 'loading', value: absent })
    rejectRefresh?.(new Error('refresh failed'))
    await vi.waitFor(() => {
      expect(controller.getSnapshot().byWorkspace['workspace-1']).toEqual({
        status: 'error', value: absent, message: 'refresh failed',
      })
    })
    expect(fetchMock.mock.calls[0]?.[0]).toBe(FDE_PROJECT_SNAPSHOT_PATH)
    controller.dispose()
  })

  it('posts exact start and abandonment inputs and publishes the returned snapshots', async () => {
    const queued: RequirementWikiSnapshot = {
      status: 'absent', current: null,
      build: {
        schemaVersion: 1, id: 'wiki_12345678901234567890123456789012', status: 'queued', expectedRevision: 0,
        sourceCatalogFingerprint: 'a'.repeat(64), sources: [],
        createdAt: '2026-08-27T00:00:00.000Z', updatedAt: '2026-08-27T00:00:00.000Z',
      },
    }
    const cancelled: RequirementWikiSnapshot = { ...queued, build: { ...queued.build!, status: 'cancelled' } }
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => response(
      'workspace-1', requestPath(input) === FDE_REQUIREMENT_WIKI_START_PATH ? queued : cancelled,
    ))
    const fetchImpl = fetchMock as typeof fetch
    const controller = new RequirementWikiController(fetchImpl)

    await expect(controller.startBuild('workspace-1', ['src_123456789012'], 0)).resolves.toEqual(queued)
    await expect(controller.abandonBuild('workspace-1', queued.build!.id)).resolves.toEqual(cancelled)
    expect(fetchMock).toHaveBeenNthCalledWith(1, FDE_REQUIREMENT_WIKI_START_PATH, expect.objectContaining({
      method: 'POST', body: JSON.stringify({ workspaceId: 'workspace-1', sourceIds: ['src_123456789012'], expectedRevision: 0 }),
    }))
    expect(fetchMock).toHaveBeenNthCalledWith(2, FDE_REQUIREMENT_WIKI_ABANDON_PATH, expect.objectContaining({
      method: 'POST', body: JSON.stringify({ workspaceId: 'workspace-1', buildId: queued.build!.id }),
    }))
    expect(controller.getSnapshot().byWorkspace['workspace-1']).toEqual({ status: 'ready', value: cancelled })
    controller.dispose()
  })

  it('rejects mismatched and invalid Host responses and aborts work at disposal', async () => {
    const mismatch = new RequirementWikiController(async () => response('workspace-2'))
    await expect(mismatch.startBuild('workspace-1', ['src_123456789012'], 0)).rejects.toThrow('当前项目不一致')
    mismatch.dispose()
    await expect(mismatch.startBuild('workspace-1', ['src_123456789012'], 0)).rejects.toThrow('页面已关闭')

    let signal: AbortSignal | undefined
    const pending = new RequirementWikiController(async (_input, init) => {
      signal = init?.signal instanceof AbortSignal ? init.signal : undefined
      return await new Promise<Response>(() => undefined)
    })
    pending.load('workspace-1')
    pending.dispose()
    expect(signal?.aborted).toBe(true)
  })
})
