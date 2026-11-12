import { expect, it, vi } from 'vitest'
import { ChallengeClient } from '../src/client/resource.ts'
import { parseView } from '../src/client/response.ts'
import type { AttemptId } from '@deepseek-ai/dsh-fde-scenario-challenge/types'

const empty = { revision: 0, serverNow: 1_800_000_000_000, active: null, history: [] }

it('invokes native-style fetch without using the challenge client as its receiver for reads and writes', async () => {
  const request = vi.fn<typeof fetch>(async function (this: unknown) {
    if (this !== undefined && this !== globalThis) throw new TypeError('Illegal invocation')
    return new Response(JSON.stringify(empty))
  })
  const client = new ChallengeClient(request), lifetime = new AbortController()
  const iterator = client.watch(lifetime.signal)[Symbol.asyncIterator]()
  try {
    expect((await iterator.next()).value).toEqual({ ok: true, value: empty })
    expect(await client.mutate({ kind: 'submit', attemptId: 'a520b942-e55d-459c-83dd-d38cae2c529d' as AttemptId, revision: 0 })).toMatchObject({ ok: true })
    expect(request.mock.calls.map(call => call[1]?.method ?? 'GET')).toEqual(['GET', 'POST'])
    expect(request.mock.contexts).toEqual([undefined, undefined])
  } finally { lifetime.abort(); await iterator.return?.(); client.dispose() }
})

it('reads on subscription, invalidates explicitly, and releases on cancellation', async () => {
  const request = vi.fn<typeof fetch>().mockImplementation(async () => new Response(JSON.stringify(empty)))
  const client = new ChallengeClient(request)
  const lifetime = new AbortController()
  const iterator = client.watch(lifetime.signal)[Symbol.asyncIterator]()
  expect((await iterator.next()).value).toEqual({ ok: true, value: empty })
  client.refresh()
  expect((await iterator.next()).value).toEqual({ ok: true, value: empty })
  lifetime.abort()
  expect((await iterator.next()).done).toBe(true)
  expect(request).toHaveBeenCalledTimes(2)
  client.dispose()
})

it('does not turn malformed or failed reads into an empty successful history', async () => {
  expect(() => parseView({ active: null })).toThrow()
  const request = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response('{"error":"corrupt"}', { status: 503 }))
  const client = new ChallengeClient(request), lifetime = new AbortController()
  const iterator = client.watch(lifetime.signal)[Symbol.asyncIterator]()
  expect((await iterator.next()).value).toMatchObject({ ok: false, error: { message: 'corrupt' } })
  lifetime.abort(); await iterator.return?.(); client.dispose()
})

it('reports unconfirmed writes and does not retry them in the background', async () => {
  const request = vi.fn<typeof fetch>().mockRejectedValue(new Error('connection lost'))
  const client = new ChallengeClient(request)
  expect(await client.mutate({ kind: 'start', attemptId: 'a520b942-e55d-459c-83dd-d38cae2c529d' as AttemptId })).toEqual({ ok: false, code: 'storage' })
  expect(request).toHaveBeenCalledOnce()
  client.dispose()
})
