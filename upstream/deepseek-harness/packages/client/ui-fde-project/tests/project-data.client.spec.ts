// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import type { SessionId, SessionSummary } from '@deepseek-ai/dsh-client-runtime/client'
import { projectRuntimeTotals, readProjectMetadata } from '../src/client/project-data.ts'

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
        sessionStats: { turns: 3, steps: 7, llmMs: 1200, toolMs: 800, ttftMs: 0, ttftSteps: 0, decodeMs: 0, decodeTokens: 0 },
        tokenUsage: { uncachedInputTokens: 100, cacheReadTokens: 40, cacheWriteTokens: 10, outputTokens: 20 },
      } as never,
    } satisfies SessionSummary
    expect(projectRuntimeTotals([session])).toEqual({
      sessions: 1, running: 1, turns: 3, steps: 7,
      inputTokens: 150, outputTokens: 20, toolMs: 800, llmMs: 1200,
    })
  })
})
