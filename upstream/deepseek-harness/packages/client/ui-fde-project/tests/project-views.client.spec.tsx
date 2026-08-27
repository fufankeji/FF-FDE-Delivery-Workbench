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

  it('shows plan generation, FDE confirmation, and keeps fixed cases behind a second explicit action', async () => {
    const run = vi.fn(async () => undefined)
    const confirmPlan = vi.fn(async () => undefined)
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
          runtime: { schemaVersion: 1, revision: 0, status: 'stopped', updatedAt: '1970-01-01T00:00:00.000Z' },
          apiDocs: { status: 'unconfigured', message: 'none' }, architecture: null,
          evaluation: { casesCount: 2, reports: [] },
          validation: {
            contract: {
              status: 'ready', path: '.fde/evaluations/validation.json', digest: `sha256:${'1'.repeat(64)}`, candidateId: 'R1', environment: '本地验证环境',
              datasets: [], metrics: [{
                id: 'metric-1', name: '核心接口成功率', category: 'functional', method: '运行固定接口用例',
                threshold: '成功率 = 100%', sources: [{ path: 'fde-deliverables/02-solution-design/acceptance-plan.md', references: ['FA-1'], available: true }],
                required: true, status: 'NOT_RUN', evidenceAvailable: false,
              }], issues: [],
            },
            artifacts: { root: 'fde-deliverables/04-validation', requiredCount: 3, presentCount: 1, items: [] },
            planReady: true, planBlockers: [], planApproval: { status: 'pending' },
            requiredMetricCount: 1, satisfiedMetricCount: 0, gateReady: false, blockers: ['指标“核心接口成功率”尚未执行。'],
          },
        } },
      } }),
      loadProjectSurface: vi.fn(),
      refreshProjectSurface: vi.fn(),
      prepareValidationPlan: vi.fn(async () => undefined),
      confirmValidationPlan: confirmPlan,
      startValidation: vi.fn(async () => undefined),
      runProjectEvaluation: run,
      requestArchitectureDraft: vi.fn(),
      confirmProjectArchitecture: vi.fn(),
      approveEvaluationBaseline: vi.fn(),
      t: makeTranslate(zh),
    } as unknown as ProjectViewProps
    render(<EvaluationView {...props} />)
    expect(screen.getByText('候选版本')).toBeTruthy()
    expect(screen.getByText('必需指标完成度')).toBeTruthy()
    expect(screen.getByText('结果分布')).toBeTruthy()
    expect(screen.getByText('验证推进')).toBeTruthy()
    expect(screen.getByText('证据覆盖')).toBeTruthy()
    expect(screen.getByText('本轮验证指标')).toBeTruthy()
    expect(screen.getByText('核心接口成功率')).toBeTruthy()
    expect(screen.getByText('FA-1')).toBeTruthy()
    expect(screen.getByText('指标“核心接口成功率”尚未执行。')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '通过 0' }))
    expect(screen.getByText('当前筛选条件下没有指标。')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '全部 1' }))
    expect(screen.getByText('核心接口成功率')).toBeTruthy()
    expect(screen.getByRole('button', { name: '开始验证' }).hasAttribute('disabled')).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: '确认评估方案' }))
    await waitFor(() => { expect(confirmPlan).toHaveBeenCalledWith('w-1', `sha256:${'1'.repeat(64)}`) })
    expect(run).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '运行固定用例' }))
    expect(screen.getByText('确认运行 2 个固定用例')).toBeTruthy()
    expect(run).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '确认并运行固定用例' }))
    await waitFor(() => { expect(run).toHaveBeenCalledWith('/project') })
  })
})
