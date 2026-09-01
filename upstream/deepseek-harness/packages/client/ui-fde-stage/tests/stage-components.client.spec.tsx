// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { SessionId, WorkspaceId } from '@deepseek-ai/dsh-client-runtime/client'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { StageHeaderStatus } from '../src/client/StageHeaderStatus.tsx'
import { zh } from '../src/client/locales.ts'
import type { FdeStageProgressSnapshot } from '../src/client/controller.ts'

afterEach(cleanup)

const t = makeTranslate(zh) as never
const sessionId = 's-1' as SessionId
const workspaceId = 'w-1' as WorkspaceId
const ready: FdeStageProgressSnapshot = {
  byWorkspace: {
    'w-1': {
      status: 'ready',
      value: {
        workspaceId: 'w-1', currentStage: 'requirements', revision: 1,
        createdAt: '2026-08-26T00:00:00.000Z', updatedAt: '2026-08-26T00:00:00.000Z',
      },
    },
  },
}

const hook = <T,>(value: T) => <S,>(selector: (state: T) => S) => selector(value)
const useWorkspaces = hook({
  items: [{ workspaceId, path: '/project', title: '项目', sessionIds: [sessionId], createdAt: '', updatedAt: '' }],
  archivedSessionIds: [], state: 'idle', phase: 'ready', error: null, baselinesReady: true,
  recentWorkspaceId: workspaceId,
}) as never

function runtime() {
  return {
    sessionId,
    useSession: (() => undefined) as never,
    useSessions: (() => undefined) as never,
    useWorkspaces,
    useProjection: (() => undefined) as never,
    useInput: (() => undefined) as never,
    inputActions: {} as never,
    useStageProgress: hook(ready),
    loadStage: vi.fn(),
    retryStage: vi.fn(),
    openProjectProgress: vi.fn(),
    t,
  }
}

describe('FDE stage components', () => {
  it('keeps the detailed stage in the header', () => {
    const props = runtime()
    const header = render(<StageHeaderStatus {...props} />)
    expect(screen.getByText('阶段 1/8')).toBeTruthy()
    expect(screen.getByText('发现高价值问题')).toBeTruthy()
    header.unmount()
  })
})
