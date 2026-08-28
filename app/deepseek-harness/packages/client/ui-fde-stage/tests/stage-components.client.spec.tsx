// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { SessionId, WorkspaceId } from '@deepseek-ai/dsh-client-runtime/client'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { StageBlankStatus } from '../src/client/StageBlankStatus.tsx'
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
  it('shows the same current stage in the active header and blank composer', () => {
    const props = runtime()
    const header = render(<StageHeaderStatus {...props} />)
    expect(screen.getByText('阶段 1/6')).toBeTruthy()
    expect(screen.getByText('需求调研')).toBeTruthy()
    header.unmount()

    render(<StageBlankStatus
      {...props}
      session={{ composerPhase: 'blank' } as never}
      input={{} as never}
    />)
    expect(screen.getByRole('region', { name: '阶段 1/6' })).toBeTruthy()
    expect(screen.getByText('整理客户资料，形成可确认的需求基线')).toBeTruthy()
    expect(screen.queryByText('筛选正确场景，理解真实业务、岗位、SOP、问题边界和验收方向。')).toBeNull()
    expect(screen.queryByRole('list')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '查看项目进度' }))
    expect(props.openProjectProgress).toHaveBeenCalledWith('w-1')
  })
})
