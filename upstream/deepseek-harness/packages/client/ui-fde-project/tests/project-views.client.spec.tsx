// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { SessionId, WorkspaceId } from '@deepseek-ai/dsh-client-runtime/client'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { ApiDocsView } from '../src/client/ApiDocsView.tsx'
import { ArchitectureView } from '../src/client/ArchitectureView.tsx'
import { EvaluationView } from '../src/client/EvaluationView.tsx'
import { zh } from '../src/client/locales.ts'
import type { ProjectViewProps } from '../src/client/slots.ts'

afterEach(cleanup)

const hook = <T,>(value: T) => <S,>(selector: (state: T) => S) => selector(value)

describe('FDE project views', () => {
  it('presents configured API documentation as a connected project workspace', () => {
    const workspaceId = 'w-1' as WorkspaceId
    const sessionId = 's-1' as SessionId
    const refresh = vi.fn()
    const props = {
      sessionId,
      useSession: (() => undefined) as never,
      useProjection: (() => undefined) as never,
      useInput: (() => undefined) as never,
      inputActions: {} as never,
      useSessions: hook({ byId: { [sessionId]: { running: false } } }),
      useWorkspaces: hook({ items: [{ workspaceId, path: '/project', title: 'Northlight', sessionIds: [sessionId] }] }),
      useProjectSurfaces: hook({ byWorkspace: {
        'w-1': { status: 'ready', value: {
          workspaceId: 'w-1', title: 'Northlight',
          apiDocs: {
            status: 'configured',
            docsUrl: 'http://127.0.0.1:8000/docs',
            openapiSource: 'http://127.0.0.1:8000/openapi.json',
            baseUrl: 'http://127.0.0.1:8000/',
            allowedMethods: ['GET', 'HEAD', 'POST'],
            allowPrivateNetwork: true,
          },
          architecture: null,
          evaluation: { casesCount: 0, reports: [] },
          requirements: { root: '.fde/stages/requirements', requiredCount: 3, presentCount: 0, artifacts: [] },
        } },
      } }),
      loadProjectSurface: vi.fn(),
      refreshProjectSurface: refresh,
      runProjectEvaluation: vi.fn(),
      requestArchitectureDraft: vi.fn(),
      confirmProjectArchitecture: vi.fn(),
      approveEvaluationBaseline: vi.fn(),
      t: makeTranslate(zh),
    } as unknown as ProjectViewProps

    const view = render(<ApiDocsView {...props} />)

    expect(view.container.querySelector('[data-conversation-composer-overlay]')).toBeTruthy()
    expect(screen.getByText('接口工作区')).toBeTruthy()
    expect(screen.getByText('文档已连接')).toBeTruthy()
    expect(screen.getByText('交互式接口说明')).toBeTruthy()
    expect(screen.getByText('3 种')).toBeTruthy()
    expect(screen.getByTitle('Northlight API 文档').getAttribute('src')).toBe('http://127.0.0.1:8000/docs')
    expect(screen.getByRole('link', { name: '在新窗口打开' }).getAttribute('href')).toBe('http://127.0.0.1:8000/docs')

    fireEvent.click(screen.getByRole('button', { name: '刷新' }))
    expect(refresh).toHaveBeenCalledWith('w-1')
  })

  it('renders architecture as an interactive graph without the redundant artifact summary', () => {
    const workspaceId = 'w-1' as WorkspaceId
    const sessionId = 's-1' as SessionId
    const props = {
      sessionId,
      useSession: (() => undefined) as never,
      useProjection: (() => undefined) as never,
      useInput: (() => undefined) as never,
      inputActions: {} as never,
      useSessions: hook({ byId: { [sessionId]: { running: false } } }),
      useWorkspaces: hook({ items: [{ workspaceId, path: '/project', title: '项目', sessionIds: [sessionId] }] }),
      useProjectSurfaces: hook({ byWorkspace: {
        'w-1': { status: 'ready', value: {
          workspaceId: 'w-1', title: '项目',
          apiDocs: { status: 'unconfigured', message: 'none' },
          architecture: {
            version: 1,
            revision: 2,
            title: '候选架构标题',
            summary: '不再重复展示的架构摘要',
            status: 'confirmed',
            updatedAt: '2026-08-27T13:44:41.000Z',
            groups: [{ id: 'entry', label: '交互层' }, { id: 'core', label: '智能层' }, { id: 'data', label: '数据层' }],
            nodes: [
              { id: 'web', label: 'Web 入口', kind: 'entry', group: 'entry' },
              { id: 'agent', label: 'Agent 编排', kind: 'core', note: '组织项目任务', group: 'core' },
              { id: 'db', label: '项目数据库', kind: 'store', group: 'data' },
            ],
            edges: [
              { from: 'web', to: 'agent', label: '提交任务' },
              { from: 'agent', to: 'db', label: '写入状态' },
            ],
          },
          evaluation: { casesCount: 0, reports: [] },
          requirements: { root: '.fde/stages/requirements', requiredCount: 3, presentCount: 0, artifacts: [] },
        } },
      } }),
      loadProjectSurface: vi.fn(),
      refreshProjectSurface: vi.fn(),
      runProjectEvaluation: vi.fn(),
      requestArchitectureDraft: vi.fn(),
      confirmProjectArchitecture: vi.fn(),
      approveEvaluationBaseline: vi.fn(),
      t: makeTranslate(zh),
    } as unknown as ProjectViewProps

    render(<ArchitectureView {...props} />)

    expect(screen.getByRole('img', { name: '候选架构标题' })).toBeTruthy()
    expect(screen.queryByText('不再重复展示的架构摘要')).toBeNull()
    expect(screen.queryByText('版本')).toBeNull()
    expect(screen.queryByText('更新时间')).toBeNull()
    expect(screen.getByRole('button', { name: '暂停连线动画' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '查看 Agent 编排' }))
    expect(screen.getByText('输入关系')).toBeTruthy()
    expect(screen.getByText('输出关系')).toBeTruthy()
    expect(screen.getByRole('button', { name: '取消节点锁定' })).toBeTruthy()
  })

  it('does not run evaluation until the second explicit confirmation action', async () => {
    const run = vi.fn(async () => undefined)
    const workspaceId = 'w-1' as WorkspaceId
    const sessionId = 's-1' as SessionId
    const props = {
      sessionId,
      useSession: (() => undefined) as never,
      useProjection: (() => undefined) as never,
      useInput: (() => undefined) as never,
      inputActions: {} as never,
      useSessions: hook({ byId: { [sessionId]: { running: false } } }),
      useWorkspaces: hook({ items: [{ workspaceId, path: '/project', title: '项目', sessionIds: [sessionId] }] }),
      useProjectSurfaces: hook({ byWorkspace: {
        'w-1': { status: 'ready', value: {
          workspaceId: 'w-1', title: '项目',
          apiDocs: { status: 'unconfigured', message: 'none' }, architecture: null,
          evaluation: { casesCount: 2, reports: [] },
        } },
      } }),
      loadProjectSurface: vi.fn(),
      refreshProjectSurface: vi.fn(),
      runProjectEvaluation: run,
      requestArchitectureDraft: vi.fn(),
      confirmProjectArchitecture: vi.fn(),
      approveEvaluationBaseline: vi.fn(),
      t: makeTranslate(zh),
    } as unknown as ProjectViewProps
    render(<EvaluationView {...props} />)
    expect(run).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '运行评估' }))
    expect(screen.getByText('确认运行 2 个项目用例')).toBeTruthy()
    expect(run).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '确认并运行' }))
    await waitFor(() => { expect(run).toHaveBeenCalledWith('/project') })
  })
})
