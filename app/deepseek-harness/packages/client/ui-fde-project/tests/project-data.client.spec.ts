// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import type { SessionId, SessionSummary } from '@deepseek-ai/dsh-client-runtime/client'
import {
  latestProjectSessionId, projectActivityBuckets, projectRuntimeTotals, readProjectMetadata,
} from '../src/client/project-data.ts'

afterEach(() => { localStorage.clear() })

describe('FDE project browser data', () => {
  it('reads creation metadata from the existing workspace view record', () => {
    localStorage.setItem('dsh.workspace.view.v6', JSON.stringify({
      projectMetadataByPath: {
        '/work/alpha': {
          companyName: '示例科技',
          schedule: { status: 'estimated', startDate: '2026-08-01', endDate: '2026-09-01' },
        },
      },
    }))
    expect(readProjectMetadata('/work/alpha')).toEqual({
      companyName: '示例科技',
      schedule: { status: 'estimated', startDate: '2026-08-01', endDate: '2026-09-01' },
    })
    expect(readProjectMetadata('/work/missing').schedule.status).toBe('pending-confirmation')
  })

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

  it('attributes cumulative Session activity to honest latest-activity time buckets', () => {
    const now = new Date(2026, 7, 27, 18, 0, 0, 0).getTime()
    const session = (id: string, updatedAt: number, tokens: number): SessionSummary => ({
      id: id as SessionId, displayTitle: id, running: false, blank: false, updatedAt,
      projectionValues: {
        sessionStats: { turns: 1, steps: 2, llmMs: 100, toolMs: 50, ttftMs: 10, ttftSteps: 1, decodeMs: 20, decodeTokens: 5 },
        tokenUsage: { uncachedInputTokens: tokens, cacheReadTokens: 0, cacheWriteTokens: 0, outputTokens: tokens / 2 },
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
  })

  it('selects the latest visible ordinary project Session', () => {
    const summary = (id: string, updatedAt: number, origin?: 'subagent'): SessionSummary => ({
      id: id as SessionId,
      displayTitle: id,
      running: false,
      blank: false,
      updatedAt,
      ...(origin === undefined ? {} : { origin }),
    })
    const byId = {
      older: summary('older', 1),
      latest: summary('latest', 4),
      child: summary('child', 9, 'subagent'),
      archived: summary('archived', 10),
    }

    expect(latestProjectSessionId(
      ['older', 'latest', 'child', 'archived'] as SessionId[],
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
