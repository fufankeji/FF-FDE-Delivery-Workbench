/** Request-dated numeric activity folded from durable events, without copying messages. */
import { z } from 'zod'
import type { ProjectionDefinition } from '@deepseek-ai/dsh-session-projection'
import type { SessionProjectionStateMap } from '@deepseek-ai/dsh-session-projection/types'
import { sessionStatsProjectionDefinition as statsDefinition, sessionStatsSchema, sessionStatsStateSchema } from './projection.ts'
import type { SessionActivityBucket } from './types.ts'

const tokenSchema = z.object({
  uncachedInputTokens: z.number().nonnegative(), cacheReadTokens: z.number().nonnegative(),
  cacheWriteTokens: z.number().nonnegative(), outputTokens: z.number().nonnegative(),
})
const bucketSchema = sessionStatsSchema.extend(tokenSchema.shape).extend({ start: z.number().nonnegative() })
const schema = z.object({
  stats: sessionStatsStateSchema,
  stepStart: z.number().nonnegative().nullable(),
  buckets: z.record(z.string(), bucketSchema),
  lastUsage: z.object({ turn: z.number(), step: z.number(), start: z.number(), tokens: tokenSchema }).nullable(),
})
interface State {
  stats: SessionProjectionStateMap['sessionStats']
  stepStart: number | null
  buckets: Record<string, SessionActivityBucket>
  lastUsage: {
    turn: number
    step: number
    start: number
    tokens: z.infer<typeof tokenSchema>
  } | null
}
declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionStateMap { sessionActivity: State }
}
const tokenKeys = ['uncachedInputTokens', 'cacheReadTokens', 'cacheWriteTokens', 'outputTokens'] as const

function emptyBucket(start: number): SessionActivityBucket {
  return {
    ...statsDefinition.wire.view(statsDefinition.init()), start,
    uncachedInputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, outputTokens: 0,
  }
}

/** Registered alongside cumulative stats; old logs replay into this independent cache key. */
export const sessionActivityProjectionDefinition = {
  key: 'sessionActivity', stateVersion: 2, stateSchema: schema,
  init: () => ({ stats: statsDefinition.init(), buckets: {}, stepStart: null, lastUsage: null }),
  apply(state, event) {
    const stats = statsDefinition.apply(state.stats, event)
    const before = statsDefinition.wire.view(state.stats)
    const after = statsDefinition.wire.view(stats)
    const stepStart = event.type === 'step/start' ? event.time : state.stepStart
    const nextStart = event.type === 'step/end' || event.type === 'turn/end' ? null : stepStart
    const streamUsage = event.type === 'assistant/message' || event.type === 'assistant/attempt'
      ? event.data.stream.filter(record => record.type === 'chunk' && record.chunk.type === 'usage').at(-1)
      : undefined
    const usage = event.type === 'assistant/message' && event.data.usage !== undefined
      ? event.data.usage
      : streamUsage?.type === 'chunk' && streamUsage.chunk.type === 'usage' ? streamUsage.chunk.usage : undefined
    // Most streamed deltas carry no new totals; avoid copying the history on that hot path.
    if (stats === state.stats && nextStart === state.stepStart && usage === undefined) return state
    const start = Math.floor((stepStart ?? event.time) / 300_000) * 300_000
    const buckets = { ...state.buckets }
    let changed = false
    for (const key of Object.keys(before) as (keyof typeof before)[]) {
      const delta = after[key] - before[key]
      if (delta === 0) continue
      const bucket = { ...(buckets[start] ?? emptyBucket(start)) }
      bucket[key] += delta
      buckets[start] = bucket
      changed = true
    }
    let lastUsage = state.lastUsage
    if (usage !== undefined && (event.type === 'assistant/message' || event.type === 'assistant/attempt')) {
      const previous = lastUsage?.turn === event.data.turn && lastUsage.step === event.data.step ? lastUsage : null
      // Keep a request in its original interval when its final sample replaces a streamed sample.
      const usageStart = previous?.start ?? start
      const tokens = {
        uncachedInputTokens: usage.inputTokens, outputTokens: usage.outputTokens,
        cacheReadTokens: usage.cacheReadTokens ?? 0, cacheWriteTokens: usage.cacheWriteTokens ?? 0,
      }
      const bucket = { ...(buckets[usageStart] ?? emptyBucket(usageStart)) }
      for (const key of tokenKeys) {
        const delta = tokens[key] - (previous?.tokens[key] ?? 0)
        bucket[key] += delta
        changed ||= delta !== 0
      }
      buckets[usageStart] = bucket
      lastUsage = { turn: event.data.turn, step: event.data.step, start: usageStart, tokens }
    }
    if (!changed && stats === state.stats && nextStart === state.stepStart && lastUsage === state.lastUsage) return state
    return { stats, stepStart: nextStart, lastUsage, buckets: changed ? buckets : state.buckets }
  },
  wire: {
    viewSchema: z.object({ buckets: z.array(bucketSchema) }),
    view: state => ({ buckets: Object.values(state.buckets).sort((a, b) => a.start - b.start) }),
  },
} satisfies ProjectionDefinition<'sessionActivity', State>
