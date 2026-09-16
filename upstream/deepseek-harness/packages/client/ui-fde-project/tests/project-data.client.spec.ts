// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import type { SessionId, SessionSummary } from '@deepseek-ai/dsh-client-runtime/client'
import {
  latestProjectSessionId, projectActivityBuckets, projectRuntimeTotals, projectUsageSessions,
} from '../src/client/project-data.ts'

afterEach(() => { localStorage.clear() })

describe('FDE project browser data', () => {
  it('aggregates only real Session projection values', () => {
    const session = {
      id: 's-1' as SessionId, displayTitle: '研发', running: true, blank: false, updatedAt: 1,
      projectionValues: {
        sessionStats: { turns: 3, steps: 7, llmMs: 1200, toolMs: 800, ttftMs: 300, ttftSteps: 2, decodeMs: 500, decodeTokens: 18 },
        tokenUsage: { uncachedInputTokens: 100, cacheReadTokens: 40, cacheWriteTokens: 10, outputTokens: 20 },
      } as never,
    } satisfies SessionSummary
    expect(projectRuntimeTotals([session])).toEqual({
      sessions: 1, running: 1, completed: 0, blank: 0, turns: 3, steps: 7,
      uncachedInputTokens: 100, cacheReadTokens: 40, cacheWriteTokens: 10,
      inputTokens: 150, outputTokens: 20, toolMs: 800, llmMs: 1200,
      ttftMs: 300, ttftSteps: 2, decodeMs: 500, decodeTokens: 18,
    })
  })

  it('attributes actual request activity rather than session updatedAt to time buckets', () => {
    const now = new Date(2026, 7, 27, 18, 0, 0, 0).getTime()
    const session = (id: string, updatedAt: number, tokens: number): SessionSummary => ({
      id: id as SessionId, displayTitle: id, running: false, blank: false, updatedAt,
      projectionValues: {
        sessionStats: { turns: 1, steps: 2, llmMs: 100, toolMs: 50, ttftMs: 10, ttftSteps: 1, decodeMs: 20, decodeTokens: 5 },
        tokenUsage: { uncachedInputTokens: tokens, cacheReadTokens: 0, cacheWriteTokens: 0, outputTokens: tokens / 2 },
        sessionActivity: { buckets: [{ start: updatedAt, turns: 1, steps: 2, llmMs: 100, toolMs: 50,
          ttftMs: 10, ttftSteps: 1, decodeMs: 20, decodeTokens: 5,
          uncachedInputTokens: tokens, cacheReadTokens: 0, cacheWriteTokens: 0, outputTokens: tokens / 2 }] },
      } as never,
    })
    const sessions = [
      session('morning', new Date(2026, 7, 27, 9, 30).getTime(), 100),
      session('afternoon', new Date(2026, 7, 27, 15, 20).getTime(), 200),
      session('older', new Date(2026, 7, 24, 12, 0).getTime(), 300),
    ]

    const today = projectActivityBuckets(sessions, 'today', now)
    expect(today).toHaveLength(288)
    expect(today.find(bucket => bucket.label === '09:30')).toMatchObject({ sessions: 1, inputTokens: 100, outputTokens: 50 })
    expect(today.find(bucket => bucket.label === '15:20')).toMatchObject({ sessions: 1, inputTokens: 200, outputTokens: 100 })
    expect(today.reduce((sum, bucket) => sum + bucket.sessions, 0)).toBe(2)

    const week = projectActivityBuckets(sessions, '7d', now)
    expect(week).toHaveLength(7)
    expect(week.reduce((sum, bucket) => sum + bucket.sessions, 0)).toBe(3)
    expect(projectActivityBuckets(sessions, '30d', now)).toHaveLength(30)
    expect(projectActivityBuckets(sessions.map(session => ({ ...session, updatedAt: now })), 'today', now)).toEqual(today)
  })

  it('splits a multi-day session consistently across cards, table and chart without dropping old cumulative history', () => {
    const now = new Date(2026, 8, 8, 12).getTime()
    const stats = { turns: 1, steps: 2, llmMs: 100, toolMs: 50, ttftMs: 10, ttftSteps: 1, decodeMs: 20, decodeTokens: 5 }
    const usage = { uncachedInputTokens: 100, cacheReadTokens: 20, cacheWriteTokens: 0, outputTokens: 10 }
    const points = [new Date(2024, 0, 1, 12).getTime(), now].map(start => ({ ...stats, ...usage, start }))
    const data = { workspaceId: 'w', sessions: [{ sessionId: 's', status: 'ready' as const,
      stats: { ...stats, turns: 2, steps: 4 }, usage: { ...usage, uncachedInputTokens: 200, cacheReadTokens: 40, outputTokens: 20 }, activity: { buckets: points } }] }
    const sessions = [{ id: 's' as SessionId, displayTitle: '跨天会话', updatedAt: now, running: false, blank: false }]
    const today = projectUsageSessions(sessions, data, 'today', now)
    expect(projectRuntimeTotals(today)).toMatchObject({ turns: 1, steps: 2, inputTokens: 120, outputTokens: 10 })
    expect(projectActivityBuckets(today, 'today', now).reduce((sum, bucket) => sum + bucket.inputTokens, 0)).toBe(120)
    const all = projectUsageSessions(sessions, data, 'all', now)
    const chart = projectActivityBuckets(all, 'all', now)
    expect(chart.length).toBeLessThanOrEqual(90)
    expect(chart[0]?.description).toContain('–')
    expect(chart.reduce((sum, bucket) => sum + bucket.inputTokens, 0)).toBe(240)
    expect(projectRuntimeTotals(all)).toMatchObject({ steps: 4, inputTokens: 240, outputTokens: 20 })
    expect(projectUsageSessions(sessions, { workspaceId: 'w', sessions: [{ sessionId: 's', status: 'unavailable' }] }, 'all', now)).toEqual([])
  })

  it('selects the latest visible ordinary project Session', () => {
    const summary = (id: string, updatedAt: number, origin?: 'subagent', blank = false): SessionSummary => ({
      id: id as SessionId,
      displayTitle: id,
      running: false,
      blank,
      updatedAt,
      ...(origin === undefined ? {} : { origin }),
    })
    const byId = {
      older: summary('older', 1),
      latest: summary('latest', 4),
      blank: summary('blank', 12, undefined, true),
      child: summary('child', 9, 'subagent'),
      archived: summary('archived', 10),
    }

    expect(latestProjectSessionId(
      ['older', 'latest', 'blank', 'child', 'archived'] as SessionId[],
      byId,
      ['archived'] as SessionId[],
    )).toBe('latest')
    expect(latestProjectSessionId(
      ['child', 'archived'] as SessionId[],
      byId,
      ['archived'] as SessionId[],
    )).toBeUndefined()
  })
})
