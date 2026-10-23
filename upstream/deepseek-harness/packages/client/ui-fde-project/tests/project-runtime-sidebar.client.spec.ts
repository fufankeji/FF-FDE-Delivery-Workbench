import { afterEach, expect, it, vi } from 'vitest'
import { RuntimeOutputController } from '../src/client/runtime-output-controller.ts'

afterEach(() => vi.useRealTimers())

it('shares visible readers and stops polling when the last view leaves', async () => {
  vi.useFakeTimers()
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => new Response(JSON.stringify({ workspaceId: 'project', status: 'ready', text: '<script>text</script>', title: '项目运行', truncated: false, processStatus: 'running' })))
  const output = new RuntimeOutputController(fetcher)
  const first = output.watch('project')
  const second = output.watch('project')
  await vi.advanceTimersByTimeAsync(0)
  expect(fetcher).toHaveBeenCalledTimes(1)
  expect(output.getSnapshot().project).toMatchObject({ status: 'ready', text: '<script>text</script>' })
  first()
  await vi.advanceTimersByTimeAsync(1_500)
  expect(fetcher).toHaveBeenCalledTimes(2)
  second()
  const signal = fetcher.mock.calls.at(-1)?.[1]?.signal
  expect(signal?.aborted).toBe(true)
  await vi.advanceTimersByTimeAsync(5_000)
  expect(fetcher).toHaveBeenCalledTimes(2)
  expect(output.getSnapshot().project).toBeUndefined()
  output.dispose()
})

it('rejects mismatched output and does not revive a request after disposal', async () => {
  vi.useFakeTimers()
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ workspaceId: 'other', status: 'missing' })))
  const output = new RuntimeOutputController(fetcher)
  output.watch('project')
  await vi.advanceTimersByTimeAsync(0)
  expect(output.getSnapshot().project).toEqual({ status: 'error' })
  output.dispose()
  await vi.advanceTimersByTimeAsync(3_000)
  expect(fetcher).toHaveBeenCalledTimes(1)
})
