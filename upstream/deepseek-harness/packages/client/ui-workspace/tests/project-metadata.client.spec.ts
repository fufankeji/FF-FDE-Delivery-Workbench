// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProjectMetadataController } from '../src/client/project-metadata.ts'

afterEach(() => localStorage.clear())
const value = { companyName: '业务方', schedule: { status: 'estimated' as const, startDate: '2026-09-01', endDate: '2026-10-01' } }
const reply = (workspaceId: string, metadata: unknown) => new Response(JSON.stringify({ ok: true, workspaceId, value: metadata }))

describe('shared project metadata', () => {
  it('imports only the exact missing project and keeps the browser copy for recovery', async () => {
    localStorage.setItem('dsh.workspace.view.v6', JSON.stringify({ projectMetadataByPath: { '/one': value, '/other': { ...value, companyName: '其他项目' } } }))
    const fetcher = vi.fn().mockResolvedValueOnce(reply('one', null)).mockResolvedValueOnce(reply('one', value))
    const controller = new ProjectMetadataController(fetcher)
    controller.load('one', '/one')
    await vi.waitFor(() => expect(controller.getSnapshot().byWorkspace.one).toEqual({ status: 'ready', value }))
    expect(JSON.parse(fetcher.mock.calls[1]![1].body)).toEqual({ workspaceId: 'one', metadata: value })
    expect(localStorage.getItem('dsh.workspace.view.v6')).toContain('/one')
    controller.load('one', '/one')
    expect(fetcher).toHaveBeenCalledTimes(2)
    controller.dispose()
  })

  it('uses the Host record even if a different legacy value exists', async () => {
    localStorage.setItem('dsh.workspace.view.v6', JSON.stringify({ projectMetadataByPath: { '/one': { ...value, companyName: '过时' } } }))
    const fetcher = vi.fn().mockResolvedValue(reply('one', value))
    const controller = new ProjectMetadataController(fetcher)
    controller.load('one', '/one')
    await vi.waitFor(() => expect(controller.getSnapshot().byWorkspace.one).toEqual({ status: 'ready', value }))
    expect(fetcher).toHaveBeenCalledTimes(1)
    controller.dispose()
  })

  it('publishes save failures and retries only the same project metadata', async () => {
    localStorage.setItem('dsh.workspace.view.v6', JSON.stringify({ projectMetadataByPath: { '/one': value } }))
    const fetcher = vi.fn().mockRejectedValueOnce(new Error('磁盘不可写')).mockResolvedValueOnce(reply('one', null)).mockResolvedValueOnce(reply('one', value))
    const controller = new ProjectMetadataController(fetcher)
    await expect(controller.save('one', value)).rejects.toThrow('磁盘不可写')
    expect(controller.getSnapshot().byWorkspace.one).toEqual({ status: 'error', message: '磁盘不可写' })
    controller.load('one', '/one', true)
    await vi.waitFor(() => expect(controller.getSnapshot().byWorkspace.one).toEqual({ status: 'ready', value }))
    expect(fetcher.mock.calls.every(call => JSON.parse(call[1].body).workspaceId === 'one')).toBe(true)
    controller.dispose()
  })

  it('rejects cross-project replies and ignores late results after disposal', async () => {
    const controller = new ProjectMetadataController(vi.fn().mockResolvedValue(reply('other', value)))
    await expect(controller.save('one', value)).rejects.toThrow('不一致')
    controller.dispose()
    let finish!: (response: Response) => void
    const pending = new ProjectMetadataController(vi.fn(() => new Promise<Response>(resolve => { finish = resolve })))
    const listener = vi.fn()
    pending.subscribe(listener)
    pending.load('one', '/one')
    expect(listener).toHaveBeenCalledTimes(1)
    pending.dispose()
    finish(reply('one', value))
    await Promise.resolve()
    await Promise.resolve()
    expect(listener).toHaveBeenCalledTimes(1)
    expect(pending.getSnapshot().byWorkspace.one?.status).toBe('loading')
  })
})
