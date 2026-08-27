import type { IncomingMessage, ServerResponse } from 'node:http'
import { describe, expect, it, vi } from 'vitest'
import type { KvTable } from '@deepseek-ai/dsh-storage-domain'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace'
import { createStageRoute } from '../src/http.ts'
import type { ProjectStageRecord } from '../src/spec.ts'
import { FdeStageState } from '../src/state.ts'

const wid = (value: string): WorkspaceId => value as WorkspaceId

function table() {
  const records = new Map<WorkspaceId, ProjectStageRecord>()
  const put = vi.fn(async (key: WorkspaceId, value: ProjectStageRecord) => { records.set(key, value) })
  return {
    records,
    put,
    value: {
      get: (key: WorkspaceId) => records.get(key),
      entries: () => records.entries(),
      keys: () => records.keys(),
      get size() { return records.size },
      put,
      delete: async (key: WorkspaceId) => records.delete(key),
      update: async (key: WorkspaceId, fn: (current: ProjectStageRecord) => ProjectStageRecord) => {
        const current = records.get(key)
        if (current === undefined) throw new Error('missing')
        const next = fn(current)
        records.set(key, next)
        return next
      },
    } satisfies KvTable<WorkspaceId, ProjectStageRecord>,
  }
}

function request(body: unknown, method = 'POST'): IncomingMessage {
  const bytes = Buffer.from(JSON.stringify(body))
  return {
    method,
    headers: { 'content-length': String(bytes.byteLength) },
    resume: vi.fn(),
    async *[Symbol.asyncIterator]() { yield bytes },
  } as unknown as IncomingMessage
}

function response() {
  let status = 0
  let body = ''
  return {
    value: {
      writeHead: (next: number) => { status = next },
      end: (next?: string | Uint8Array) => { body = next === undefined ? '' : String(next) },
    } as unknown as ServerResponse,
    snapshot: () => ({ status, body: JSON.parse(body) as unknown }),
  }
}

describe('FdeStageState', () => {
  it('initializes one requirements record and coalesces concurrent readers', async () => {
    const data = table()
    const state = new FdeStageState(data.value, () => '2026-08-26T00:00:00.000Z')
    const [first, second] = await Promise.all([state.open(wid('w-1')), state.open(wid('w-1'))])
    expect(first).toEqual({
      currentStage: 'requirements', revision: 1,
      createdAt: '2026-08-26T00:00:00.000Z', updatedAt: '2026-08-26T00:00:00.000Z',
    })
    expect(second).toBe(first)
    expect(data.put).toHaveBeenCalledTimes(1)
    await expect(state.open(wid('w-1'))).resolves.toBe(first)
  })
})

describe('project-stage route', () => {
  it('returns the exact Workspace stage and rejects unknown projects', async () => {
    const open = vi.fn(async () => ({
      currentStage: 'requirements' as const,
      revision: 1,
      createdAt: '2026-08-26T00:00:00.000Z',
      updatedAt: '2026-08-26T00:00:00.000Z',
    }))
    const handler = createStageRoute({
      trusted: () => true,
      workspaceExists: id => id === 'w-1',
      open,
    })
    const ok = response()
    await handler(request({ workspaceId: 'w-1' }), ok.value)
    expect(ok.snapshot()).toMatchObject({
      status: 200,
      body: { ok: true, value: { workspaceId: 'w-1', currentStage: 'requirements', revision: 1 } },
    })
    expect(open).toHaveBeenCalledWith('w-1')

    const missing = response()
    await handler(request({ workspaceId: 'missing' }), missing.value)
    expect(missing.snapshot()).toEqual({
      status: 404,
      body: { ok: false, error: { code: 'workspace-not-found', message: '当前项目不存在或已被移除。' } },
    })
  })

  it('rejects untrusted and non-POST requests before persistence', async () => {
    const open = vi.fn()
    const forbidden = createStageRoute({ trusted: () => false, workspaceExists: () => true, open })
    const denied = response()
    await forbidden(request({ workspaceId: 'w-1' }), denied.value)
    expect(denied.snapshot()).toMatchObject({ status: 403 })

    const handler = createStageRoute({ trusted: () => true, workspaceExists: () => true, open })
    const method = response()
    await handler(request({}, 'GET'), method.value)
    expect(method.snapshot()).toMatchObject({ status: 405 })
    expect(open).not.toHaveBeenCalled()
  })
})
