// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { ProjectRuntimeHeader } from '../src/client/ProjectRuntimeHeader.tsx'
import { zh } from '../src/client/locales.ts'
import type { ProjectRuntimeHeaderProps } from '../src/client/slots.ts'

afterEach(() => { cleanup(); vi.useRealTimers() })

const hook = <T,>(value: T) => <S,>(selector: (state: T) => S) => selector(value)

function propsFor(
  runtime: Readonly<Record<string, unknown>>,
  startProject = vi.fn(async () => undefined),
  openProjectPreview = vi.fn(async () => undefined),
  pollProjectSurface = vi.fn(),
) {
  const sessionId = 'session-1' as SessionId
  const workspaceId = 'workspace-1' as WorkspaceId
  return {
    props: {
      sessionId,
      useSession: (() => undefined) as never,
      useProjection: (() => undefined) as never,
      useInput: (() => undefined) as never,
      inputActions: {} as never,
      useSessions: hook({ byId: {} }),
      useWorkspaces: hook({ items: [{ workspaceId, path: '/project/one', title: '项目', sessionIds: [sessionId] }] }),
      useProjectSurfaces: hook({ byWorkspace: {
        'workspace-1': { status: 'ready', value: {
          workspaceId: 'workspace-1', title: '项目', runtime,
          apiDocs: { status: 'unconfigured', message: '未配置' }, architecture: null,
          evaluation: { casesCount: 0, reports: [] },
        } },
      } }),
      useStageProgress: hook({ byWorkspace: { 'workspace-1': { status: 'ready', value: {
        workspaceId: 'workspace-1', currentStage: 'development', revision: 3,
        createdAt: '2026-08-27T00:00:00.000Z', updatedAt: '2026-08-27T00:00:00.000Z',
      } } } }),
      loadStage: vi.fn(), loadProjectSurface: vi.fn(), pollProjectSurface,
      startProject, stopProject: vi.fn(async () => undefined),
      openManualTerminal: vi.fn(async () => undefined),
      openProjectPreview, showProjectTerminal: vi.fn(async () => undefined),
      continueDevelopment: vi.fn(), t: makeTranslate(zh),
    } as unknown as ProjectRuntimeHeaderProps,
    startProject, openProjectPreview, pollProjectSurface,
  }
}

describe('ProjectRuntimeHeader', () => {
  it('opens the original project externally only after an explicit fallback gesture', () => {
    const external = vi.spyOn(window, 'open').mockReturnValue(null)
    const url = 'http://127.0.0.1:4177/'
    const { props } = propsFor({ schemaVersion: 1, revision: 1, status: 'running', previewUrl: url, updatedAt: '2026-09-07T00:00:00Z' })
    try {
      render(<ProjectRuntimeHeader {...props} />)
      expect(external).not.toHaveBeenCalled()
      fireEvent.click(screen.getByRole('button', { name: '外部打开' }))
      expect(external).toHaveBeenCalledWith(url, '_blank', 'noopener,noreferrer')
    } finally { external.mockRestore() }
  })

  it('starts the current project from the development header', async () => {
    const { props, startProject } = propsFor({
      schemaVersion: 1, revision: 0, status: 'stopped', updatedAt: '1970-01-01T00:00:00.000Z',
    })
    render(<ProjectRuntimeHeader {...props} />)
    fireEvent.click(screen.getByRole('button', { name: '启动项目' }))
    await waitFor(() => {
      expect(startProject).toHaveBeenCalledWith('workspace-1', 'session-1', '/project/one')
    })
  })

  it('does not turn an unresolved stop into another start', () => {
    const { props } = propsFor({
      schemaVersion: 1, revision: 4, status: 'blocked', action: 'stop', sessionId: 'session-1',
      updatedAt: '2026-08-27T00:00:00.000Z', previewUrl: 'http://127.0.0.1:3000/',
      terminalTitle: '项目运行', message: '尚未确认退出。',
    })
    render(<ProjectRuntimeHeader {...props} />)
    expect(screen.getByRole('button', { name: '重试停止' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: '重试启动' })).toBeNull()
    expect(screen.getByRole('button', { name: '打开项目' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '运行输出' })).toBeTruthy()
  })

  it('keeps polling a blocked start so the same operation can recover', () => {
    vi.useFakeTimers()
    const pollProjectSurface = vi.fn()
    const { props } = propsFor({
      schemaVersion: 1, revision: 2, operationId: `runtime_${'a'.repeat(32)}`,
      status: 'blocked', action: 'start', sessionId: 'session-1',
      updatedAt: '2026-08-27T00:00:00.000Z', message: '缺少 AGENTS.md。',
    }, undefined, undefined, pollProjectSurface)
    render(<ProjectRuntimeHeader {...props} />)
    vi.advanceTimersByTime(3_000)
    expect(pollProjectSurface).toHaveBeenCalledWith('workspace-1')
  })

  it.each(['starting', 'blocked'] as const)(
    'opens the embedded project once when a %s start reaches running',
    async (initialStatus) => {
      const operationId = `runtime_${'a'.repeat(32)}`
      const openProjectPreview = vi.fn(async () => undefined)
      const blocked = propsFor({
        schemaVersion: 1, revision: 2, operationId, status: initialStatus, action: 'start', sessionId: 'session-1',
        updatedAt: '2026-08-27T00:00:00.000Z', message: '缺少 AGENTS.md。',
      }, undefined, openProjectPreview)
      const view = render(<ProjectRuntimeHeader {...blocked.props} />)
      const running = propsFor({
        schemaVersion: 1, revision: 3, operationId, status: 'running', action: 'start', sessionId: 'session-1',
        updatedAt: '2026-08-27T00:01:00.000Z', previewUrl: 'http://127.0.0.1:5173/',
        openapiSource: 'http://127.0.0.1:8000/openapi.json', terminalTitle: '项目运行',
      }, undefined, openProjectPreview)
      view.rerender(<ProjectRuntimeHeader {...running.props} />)
      await waitFor(() => {
        expect(openProjectPreview).toHaveBeenCalledWith('workspace-1', 'session-1', '/project/one')
      })
      view.rerender(<ProjectRuntimeHeader {...running.props} />)
      expect(openProjectPreview).toHaveBeenCalledTimes(1)
    },
  )
})
