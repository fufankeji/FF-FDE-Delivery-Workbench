// @vitest-environment jsdom
import { Context } from '@deepseek-ai/cordis'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { WorkspaceFileWatchFrame } from '@deepseek-ai/dsh-api-workspace-files/types'
import { afterEach, expect, it, vi } from 'vitest'
import { installProjectFileRefresh } from '../src/client/file-refresh.ts'

const contexts: Context[] = []
afterEach(async () => {
  for (const ctx of contexts.splice(0).reverse()) await ctx.fiber.dispose()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function selected(current?: string) {
  return { byId: current === undefined ? {} : { [current]: { id: current, retainedBy: { mainView: 1 } } } }
}

async function fixture(current?: string) {
  vi.useFakeTimers()
  const ctx = new Context()
  contexts.push(ctx)
  const list = createSnapshotStore(selected(current))
  const accepts = vi.fn()
  const disposals: ReturnType<typeof vi.fn>[] = []
  const changes = vi.fn(async function* (_sessionId: string, _path: string, _signal: AbortSignal): AsyncGenerator<WorkspaceFileWatchFrame> {
    yield { kind: 'ready' }
    yield { kind: 'change', change: { absolutePath: '/project/result.md', version: 'updated' } }
  })
  const workspaceFiles = { changes }
  const remote = {
    workspaceFiles,
    $stream: vi.fn((options: { open: (signal: AbortSignal) => AsyncIterable<WorkspaceFileWatchFrame> }) => {
      const abort = new AbortController()
      const dispose = vi.fn(async () => { abort.abort() })
      disposals.push(dispose)
      return {
        dispose,
        async *[Symbol.asyncIterator]() {
          for await (const value of options.open(abort.signal)) yield { value, accept: accepts }
        },
      }
    }),
  }
  // Sibling providers preserve Cordis's injection checks; root-provided stubs bypass them.
  await ctx.plugin({ apply(scope: Context) { scope.provide('sessions', { list }) } })
  await ctx.plugin({ apply(scope: Context) { scope.provide('remote', remote) } })
  const consumer = ctx.plugin({ inject: ['sessions'], apply: installProjectFileRefresh })
  await consumer
  const mountNamespace = () => ctx.plugin({ apply(scope: Context) { scope.provide('remote.workspaceFiles', workspaceFiles) } })
  return { ctx, list, remote, changes, accepts, disposals, consumer, mountNamespace }
}

it('waits for the file namespace and refreshes the selected project after file changes', async () => {
  const f = await fixture('session-one')
  const refresh = vi.fn()
  window.addEventListener('dsh-sidebar:refresh-files', refresh)
  try {
    expect(f.remote.$stream).not.toHaveBeenCalled()
    await f.mountNamespace()
    await vi.advanceTimersByTimeAsync(300)
    expect(f.changes).toHaveBeenCalledWith('session-one', '.', expect.any(AbortSignal))
    expect(f.accepts).toHaveBeenCalledTimes(2)
    expect(refresh).toHaveBeenCalledOnce()
  } finally { window.removeEventListener('dsh-sidebar:refresh-files', refresh) }
})

it('releases the previous stream on session switches and removes subscriptions on disposal', async () => {
  const f = await fixture('session-one')
  await f.mountNamespace()
  await vi.advanceTimersByTimeAsync(300)
  expect(f.remote.$stream).toHaveBeenCalledOnce()
  f.list.set(selected('session-one'))
  expect(f.remote.$stream).toHaveBeenCalledOnce()
  f.list.set(selected('session-two'))
  await vi.advanceTimersByTimeAsync(300)
  expect(f.disposals[0]).toHaveBeenCalledOnce()
  expect(f.changes.mock.calls.map(([sessionId]) => sessionId)).toEqual(['session-one', 'session-two'])
  await f.consumer.dispose()
  expect(f.disposals[1]).toHaveBeenCalledOnce()
  f.list.set(selected('session-three'))
  window.dispatchEvent(new Event('fde:project-sources-changed'))
  expect(f.remote.$stream).toHaveBeenCalledTimes(2)
  expect(vi.getTimerCount()).toBe(0)
})

it('starts no stream without a selected session and cancels pending refresh when it leaves', async () => {
  const f = await fixture()
  await f.mountNamespace()
  await vi.advanceTimersByTimeAsync(0)
  expect(f.remote.$stream).not.toHaveBeenCalled()
  f.list.set(selected('session-one'))
  await vi.advanceTimersByTimeAsync(0)
  expect(f.remote.$stream).toHaveBeenCalledOnce()
  f.list.set(selected(undefined))
  expect(f.disposals[0]).toHaveBeenCalledOnce()
  await f.consumer.dispose()
  expect(vi.getTimerCount()).toBe(0)
})
