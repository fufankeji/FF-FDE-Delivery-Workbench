import { describe, expect, expectTypeOf, it } from 'vitest'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import type { SessionProjectionStateMap } from '@deepseek-ai/dsh-session-projection/types'
import { createMessage } from '@deepseek-ai/dsh-llm'
import { sessionActivityProjectionDefinition as definition } from '../src/activity.ts'
import type { SessionActivityBucket } from '../src/types.ts'

const at = (time: number, type: string, data: unknown) => {
  const payload = data as { turn: number; step: number; chunk?: unknown }
  if (type === 'assistant/chunk') return { time, type: 'assistant/attempt', data: { turn: payload.turn, step: payload.step, stream: [{ type: 'chunk', time, chunk: payload.chunk }] }, seq: time } as SessionEvent
  return { time, type, data: type === 'assistant/message' ? { stream: [], ...payload } : data, seq: time } as SessionEvent
}
const message = createMessage({ role: 'assistant', content: [{ type: 'text', text: 'test' }], source: { kind: 'model', provider: 'mock', model: 'mock' } })
const fold = (events: SessionEvent[]) => definition.wire.view(events.reduce(definition.apply, definition.init()))

describe('request-dated activity', () => {
  it('keeps the registered state and checkpoint schema concrete', () => {
    expectTypeOf<SessionProjectionStateMap['sessionActivity']>().not.toBeAny()
    expectTypeOf<ReturnType<typeof definition.stateSchema.parse>>()
      .toEqualTypeOf<SessionProjectionStateMap['sessionActivity']>()
    expectTypeOf<ReturnType<typeof definition.wire.view>['buckets'][number]>()
      .toEqualTypeOf<SessionActivityBucket>()
    expect(definition.stateSchema.parse(definition.init())).toEqual(definition.init())
  })
  it('replaces streamed usage with the final receipt and attributes a cross-midnight step to its start', () => {
    const start = Date.UTC(2026, 8, 7, 23, 59)
    const result = fold([
      at(start, 'step/start', { turn: 1, step: 1 }),
      at(start + 100, 'assistant/chunk', { turn: 1, step: 1, chunk: { type: 'text-delta', index: 0, text: 't' } }),
      at(start + 90_000, 'assistant/chunk', { turn: 1, step: 1, chunk: { type: 'usage', usage: { inputTokens: 10, outputTokens: 2 } } }),
      at(start + 100_000, 'assistant/message', { turn: 1, step: 1, message, usage: { inputTokens: 20, outputTokens: 5, cacheReadTokens: 50 } }),
      at(start + 110_000, 'step/end', { turn: 1, step: 1 }),
      at(start + 120_000, 'turn/end', { turn: 1, reason: { kind: 'completed' } }),
    ])
    expect(result.buckets).toEqual([expect.objectContaining({ start: Math.floor(start / 300_000) * 300_000,
      turns: 1, steps: 1, uncachedInputTokens: 20, cacheReadTokens: 50, outputTokens: 5,
      llmMs: 100_000, ttftMs: 100, decodeTokens: 5 })])
  })
  it('retains reported usage for cancellation, keeps requests apart, and falls back to receipt time without a start', () => {
    const result = fold([
      at(1_000, 'step/start', { turn: 1, step: 1 }),
      at(2_000, 'assistant/chunk', { turn: 1, step: 1, chunk: { type: 'usage', usage: { inputTokens: 10, outputTokens: 2 } } }),
      at(3_000, 'step/end', { turn: 1, step: 1 }),
      at(600_000, 'assistant/message', { turn: 2, step: 1, message, usage: { inputTokens: 30, outputTokens: 6 } }),
    ])
    expect(result.buckets).toHaveLength(2)
    expect(result.buckets[0]).toMatchObject({ start: 0, uncachedInputTokens: 10, steps: 1, llmMs: 0 })
    expect(result.buckets[1]).toMatchObject({ start: 600_000, uncachedInputTokens: 30, outputTokens: 6 })
  })
  it('replays identically after a checkpoint and leaves an unrelated event unchanged', () => {
    let state = definition.apply(definition.init(), at(1_000, 'step/start', { turn: 1, step: 1 }))
    state = definition.apply(state, at(2_000, 'assistant/chunk', { turn: 1, step: 1, chunk: { type: 'usage', usage: { inputTokens: 20, outputTokens: 8 } } }))
    const before = structuredClone(state)
    const final = at(400_000, 'assistant/message', { turn: 1, step: 1, message, usage: { inputTokens: 10, outputTokens: 4 } })
    const restored = definition.stateSchema.parse(JSON.parse(JSON.stringify(state)))
    expect(definition.apply(restored, final)).toEqual(definition.apply(state, final))
    expect(state).toEqual(before)
    expect(definition.apply(state, at(500_000, 'user/message', { content: [] }))).toBe(state)
    expect(definition.wire.view(definition.apply(state, final)).buckets[0]).toMatchObject({ uncachedInputTokens: 10, outputTokens: 4 })
  })
})
