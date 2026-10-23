import { Context } from '@deepseek-ai/cordis'
import { createServer } from 'node:http'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { beginProjectRuntimeOperation } from '../src/project-runtime.ts'
import { createRuntimeOutputRoute, readProjectRuntimeOutput } from '../src/runtime-output.ts'

const cleanups: (() => Promise<unknown>)[] = []
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup() })

it('reads only the recorded project owner and exact terminal name without creating or activating anything', async () => {
  const root = await mkdtemp(join(tmpdir(), 'fde-output-'))
  cleanups.push(() => rm(root, { recursive: true, force: true }))
  await beginProjectRuntimeOperation(root, 'start', 'session-run')
  const ctx = new Context()
  cleanups.push(() => ctx.fiber.dispose())
  const list = vi.fn(() => [{ sessionId: 'pty-other', name: 'unrelated' }, { sessionId: 'pty-run', name: '项目运行', status: { kind: 'running' } }])
  const read = vi.fn(() => ({ text: 'real output', truncated: false }))
  const agent = { ctx: { get: (key: string) => key === 'terminals' ? { list, read } : undefined } }
  const getAgent = vi.fn((): typeof agent | undefined => agent)
  let membership = ['session-run']
  ctx.provide('agents', { get: getAgent } as never)
  ctx.provide('workspaceRegistry', { get: (id: string) => id === 'project' ? { path: root, sessionIds: membership } : undefined } as never)
  expect(await readProjectRuntimeOutput(ctx, 'project')).toMatchObject({ status: 'ready', terminalId: 'pty-run', text: 'real output' })
  expect(getAgent).toHaveBeenCalledWith('session-run')
  expect(read).toHaveBeenCalledExactlyOnceWith(agent, 'pty-run', { count: 200 })
  membership = ['another-project-session']
  expect(await readProjectRuntimeOutput(ctx, 'project')).toBeUndefined()
  expect(await readProjectRuntimeOutput(ctx, 'unknown')).toBeUndefined()
  expect(read).toHaveBeenCalledTimes(1)
  membership = ['session-run']
  getAgent.mockReturnValue(undefined)
  expect(await readProjectRuntimeOutput(ctx, 'project')).toEqual({ status: 'missing' })
  expect(read).toHaveBeenCalledTimes(1)
})

it('rejects unauthenticated reads, writes, and client-selected terminal identities before reading', async () => {
  const read = vi.fn(async () => ({ status: 'missing' as const }))
  const server = createServer(createRuntimeOutputRoute({ trusted: req => req.headers.authorization === 'test-owner', read }))
  cleanups.push(() => new Promise<void>((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); server.closeAllConnections() }))
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('Missing listener')
  const url = `http://127.0.0.1:${address.port}/?workspaceId=project`
  expect((await fetch(url)).status).toBe(403)
  const headers = { authorization: 'test-owner' }
  expect((await fetch(url, { method: 'POST', headers, body: 'command' })).status).toBe(405)
  expect((await fetch(url + '&terminalId=other', { headers })).status).toBe(400)
  expect((await fetch(url + '&workspaceId=other', { headers })).status).toBe(400)
  expect(read).not.toHaveBeenCalled()
  expect(await (await fetch(url, { headers })).json()).toEqual({ workspaceId: 'project', status: 'missing' })
  expect(read).toHaveBeenCalledExactlyOnceWith('project')
})
