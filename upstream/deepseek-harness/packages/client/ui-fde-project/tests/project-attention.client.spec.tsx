// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { ProjectProgressOverlay } from '../src/client/ProjectProgressOverlay.tsx'
import { zh } from '../src/client/locales.ts'
import type { ProjectProgressOverlayProps } from '../src/client/slots.ts'
import type { ProjectStageLoadState } from '../src/client/stage-controller.ts'
import type { ProjectSurfaceLoadState, ProjectSurfaceSnapshot, V2StageSurfaceSnapshot } from '../src/client/controller.ts'

const hook = <T,>(value: T) => <S,>(selector: (state: T) => S) => selector(value)
const readyStage: ProjectStageLoadState = { status: 'ready', value: {
  workspaceId: 'project', currentStage: 'solution', v2Stage: 'definition', lifecycleVersion: 2,
  revision: 1, createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z',
} }
const blocker = { id: 'owner', title: '客户数据访问尚未获批', severity: 'high' as const, status: 'open' as const }

function surface(overrides: Partial<V2StageSurfaceSnapshot> = {}, otherStages = {}): ProjectSurfaceLoadState {
  const current: V2StageSurfaceSnapshot = {
    id: 'definition', index: 2, title: '定义结果、范围与责任', objective: '', explanation: '', statePath: '', skill: '', prompt: '',
    stateStatus: 'ready', status: 'working', currentWorkId: 'scope',
    workItems: [{ id: 'scope', title: '界定范围', purpose: '', status: 'current' }],
    blockers: [], recommendation: 'pending', artifacts: [], requiredCount: 3, presentCount: 0,
    reviewReady: false, reviewBlockers: ['固定产物尚未形成'], ...overrides,
  }
  return { status: 'ready', value: {
    requirements: { presentCount: 0, requiredCount: 3 },
    discovery: { reviewReady: false, blockers: ['尚未形成带逐条证据引用的候选工作流。'] },
    v2Stages: { definition: current, ...otherStages },
  } as unknown as ProjectSurfaceSnapshot }
}

interface Entry {
  id: string
  stage?: ProjectStageLoadState
  surface?: ProjectSurfaceLoadState
  running?: boolean
  updatedAt?: string
}

function props(entries: Entry[]): ProjectProgressOverlayProps {
  return {
    useProjectPage: hook({ open: true, view: 'overview' }),
    useWorkspaces: hook({ archivedSessionIds: [], items: entries.map(entry => ({
      workspaceId: entry.id, title: entry.id, path: `/project/${entry.id}`, sessionIds: [entry.id],
      createdAt: '2026-09-01T00:00:00Z', updatedAt: entry.updatedAt ?? '2026-09-01T00:00:00Z',
    })) }),
    useSessions: hook({ byId: Object.fromEntries(entries.map(entry => [entry.id, {
      id: entry.id, displayTitle: '项目工作记录', running: entry.running ?? false, updatedAt: 0,
    }])) }),
    useStageProgress: hook({
      byWorkspace: Object.fromEntries(entries.flatMap(entry => entry.stage === undefined ? [] : [[entry.id, entry.stage]])),
    }),
    useProjectSurfaces: hook({
      byWorkspace: Object.fromEntries(entries.flatMap(entry => entry.surface === undefined ? [] : [[entry.id, entry.surface]])),
    }),
    useProjectSources: hook({ byWorkspace: {} }), loadStage: vi.fn(), retryStage: vi.fn(),
    useProjectMetadata: hook({ byWorkspace: metadataFixtures }), loadProjectMetadata: vi.fn(), openActivitySession: vi.fn(),
    loadProjectSurface: vi.fn(), refreshProjectSurface: vi.fn(), loadProjectSources: vi.fn(),
    enterProject: vi.fn(), showProjectDetail: vi.fn(), showProjectOverview: vi.fn(), showProjectTimeline: vi.fn(),
    openProjectCreation: vi.fn(), renderSlot: vi.fn(() => null), t: makeTranslate(zh),
  } as unknown as ProjectProgressOverlayProps
}

let metadataFixtures: Record<string, unknown> = {}
function schedule(id: string, endDate: string): void {
  metadataFixtures[id] = { status: 'ready', value: { companyName: '', schedule: { status: 'estimated', startDate: '2026-09-01', endDate } } }
}

beforeEach(() => {
  metadataFixtures = {}
  localStorage.clear()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 8, 8, 12))
  vi.stubGlobal('ResizeObserver', class { observe(): void {} disconnect(): void {} })
  vi.stubGlobal('IntersectionObserver', class { observe(): void {} unobserve(): void {} disconnect(): void {} })
})
afterEach(() => { cleanup(); localStorage.clear(); vi.useRealTimers(); vi.unstubAllGlobals(); delete document.body.dataset.fdePage })

describe('Project Center evidence-backed attention', () => {
  it.each<Entry>([
    { id: '普通未完成项目', stage: readyStage, surface: surface() },
    { id: '阶段尚未读取', surface: surface() },
    { id: '阶段读取中', stage: { status: 'loading' }, surface: surface() },
    { id: '资料读取中', stage: readyStage, surface: { status: 'loading' } },
    { id: '尚未建立阶段记录', stage: readyStage, surface: surface({ stateStatus: 'missing', status: 'blocked' }) },
    { id: '问题已经解决', stage: readyStage, surface: surface({ blockers: [{ ...blocker, status: 'resolved' }] }) },
    { id: '历史和后续问题', stage: readyStage, surface: surface({}, { design: { blockers: [blocker], reviewReady: true }, discovery: { blockers: [blocker] } }) },
    { id: '会话运行不等于待办', stage: readyStage, surface: surface(), running: true },
    { id: '已完成项目', stage: { ...readyStage, value: { ...readyStage.value, currentStage: 'completed' } }, surface: surface({ blockers: [blocker], reviewReady: true }) },
  ])('does not invent attention for $id', (entry) => {
    if (entry.id === '已完成项目') schedule(entry.id, '2026-09-07')
    render(<ProjectProgressOverlay {...props([entry])} />)
    const cards = within(screen.getByRole('region', { name: '项目卡片' }))
    expect(cards.queryByText(/优先关注|存在阻塞|有待处理问题|待你确认|已过计划交付日|读取失败/)).toBeNull()
    expect(screen.getByText('暂无已登记待处理事项')).toBeTruthy()
    expect(screen.getByRole('button', { name: '查看 0 个待处理项目' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '查看 0 个待处理项目' }))
    expect(within(screen.getByRole('region', { name: '项目集合' })).queryByRole('button', { name: /进入项目/ })).toBeNull()
  })

  it.each(['2026-09-08', '2026-09-09', '2026-02-30', 'invalid'])('does not mark a current, future or invalid date %s overdue', (end) => {
    schedule('日期检查', end)
    render(<ProjectProgressOverlay {...props([{ id: '日期检查', stage: readyStage, surface: surface() }])} />)
    expect(within(screen.getByRole('region', { name: '项目卡片' })).queryByText('已过计划交付日')).toBeNull()
    expect(screen.getByRole('button', { name: '查看 0 个待处理项目' })).toBeTruthy()
  })

  it('shares concrete reasons across cards, totals, filtering, list view and priority order', () => {
    schedule('计划日期已过', '2026-09-07')
    const input = props([
      { id: '等待人工评审', stage: readyStage, surface: surface({ reviewReady: true, status: 'review-ready' }), updatedAt: '2026-09-06T00:00:00Z' },
      { id: '普通项目', stage: readyStage, surface: surface(), updatedAt: '2026-09-08T00:00:00Z' },
      { id: '一般问题', stage: readyStage, surface: surface({ blockers: [{ ...blocker, severity: 'low', title: '需要补充责任人说明' }] }) },
      { id: '计划日期已过', stage: readyStage, surface: surface() },
      { id: '状态读取失败', stage: { status: 'error', message: '项目目录暂时不可用' } },
      { id: '高风险问题', stage: readyStage, surface: surface({ blockers: [blocker] }) },
    ])
    render(<ProjectProgressOverlay {...input} />)
    const cards = within(screen.getByRole('region', { name: '项目卡片' }))
    expect(cards.getByText('存在阻塞').title).toBe('客户数据访问尚未获批')
    expect(cards.getByText('有待处理问题').title).toBe('需要补充责任人说明')
    expect(cards.getByText('已过计划交付日').title).toContain('2026-09-07')
    expect(cards.getByText('读取失败').title).toBe('项目目录暂时不可用')
    expect(cards.getByText('待你确认')).toBeTruthy()
    expect(screen.queryByText(/优先关注/)).toBeNull()
    expect(screen.getByText('待处理项目').parentElement?.textContent).toBe('待处理项目5')
    expect(screen.getByText('存在阻塞：客户数据访问尚未获批')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /查看并处理/ }))
    expect(input.showProjectDetail).toHaveBeenCalledWith('高风险问题')
    expect(cards.getAllByRole('heading', { level: 2 })[0]?.textContent).toBe('普通项目')
    fireEvent.click(screen.getByRole('button', { name: '查看 5 个待处理项目' }))
    expect(cards.queryByRole('heading', { name: '普通项目' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '项目排序，当前：最近操作' }))
    expect(cards.getAllByRole('heading', { level: 2 }).map(node => node.textContent)).toEqual(['高风险问题', '计划日期已过', '一般问题', '等待人工评审', '状态读取失败'])
    fireEvent.click(screen.getByRole('button', { name: '列表' }))
    const list = within(screen.getByRole('table', { name: '项目列表' }))
    expect(list.getByText('存在阻塞')).toBeTruthy()
    expect(list.getByText('读取失败')).toBeTruthy()
    expect(list.getByText('项目目录暂时不可用')).toBeTruthy()
    expect(input.enterProject).not.toHaveBeenCalled()
  })

  it('removes resolved attention everywhere when the current project snapshot refreshes', () => {
    const input = props([{ id: '待处理项目甲', stage: readyStage, surface: surface({ blockers: [blocker] }) }])
    const view = render(<ProjectProgressOverlay {...input} />)
    fireEvent.click(screen.getByRole('button', { name: '查看 1 个待处理项目' }))
    expect(within(screen.getByRole('region', { name: '项目卡片' })).getByText('存在阻塞')).toBeTruthy()
    view.rerender(<ProjectProgressOverlay {...input} useProjectSurfaces={props([{ id: '待处理项目甲', surface: surface({ blockers: [{ ...blocker, status: 'resolved' }] }) }]).useProjectSurfaces} />)
    expect(screen.getByRole('button', { name: '查看 0 个待处理项目' })).toBeTruthy()
    expect(screen.getByText('暂无已登记待处理事项')).toBeTruthy()
    expect(within(screen.getByRole('region', { name: '项目集合' })).queryByRole('button', { name: /进入项目/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '筛选项目，当前：待我处理' }))
    expect(within(screen.getByRole('region', { name: '项目卡片' })).queryByText('存在阻塞')).toBeNull()
  })

  it('distinguishes invalid records from business blockers', () => {
    render(<ProjectProgressOverlay {...props([{ id: '记录格式错误', stage: readyStage,
      surface: surface({ stateStatus: 'invalid', message: '阶段记录的负责人字段格式无效' }),
    }])} />)
    const cards = within(screen.getByRole('region', { name: '项目卡片' }))
    expect(cards.getByText('阶段记录无效').title).toContain('负责人字段')
    expect(cards.queryByText('存在阻塞')).toBeNull()
    expect(screen.getByRole('button', { name: '查看 1 个待处理项目' })).toBeTruthy()
  })

  it.each(['evaluation', 'delivery'] as const)('uses actual failed %s results, not unrun work, and clears them on success', (kind) => {
    const resultSurface = (passed: boolean): Partial<V2StageSurfaceSnapshot> => kind === 'evaluation' ? {
      evaluation: {
        status: 'ready', candidate: { summary: '隔离验证候选', version: 'v1', sourceFiles: [] },
        testing: { environment: 'local', current: true, metrics: [
          { id: 'isolation', title: passed ? '隔离验证' : '跨项目数据隔离测试失败', kind: 'isolation', required: true,
            criterion: '项目数据相互隔离', sources: [], status: passed ? 'PASS' : 'FAIL', value: '', evidence: [] },
          { id: 'later', title: '尚未运行的测试', kind: 'regression', required: true,
            criterion: '回归验证通过', sources: [], status: 'NOT_RUN', value: '', evidence: [] },
        ] },
        reviewBlockers: [],
      },
    } : {
      delivery: {
        status: 'ready', version: 'v1', versionCurrent: true, versionFiles: [],
        environment: { kind: 'local', label: '本地验证' },
        items: [
          { id: 'rollback', category: 'recovery', title: passed ? '恢复演练' : '恢复演练执行失败', required: true,
            declaredStatus: passed ? 'passed' : 'failed', status: passed ? 'passed' : 'failed',
            scope: 'local', version: 'v1', summary: '', evidence: [] },
          { id: 'later', category: 'handoff', title: '尚未执行的交付工作', required: true,
            declaredStatus: 'pending', status: 'pending', scope: 'local', version: 'v1', summary: '', evidence: [] },
        ],
        reviewBlockers: [],
      },
    }
    const input = props([{ id: '执行结果项目', stage: readyStage, surface: surface(resultSurface(false)) }])
    const view = render(<ProjectProgressOverlay {...input} />)
    expect(within(screen.getByRole('region', { name: '项目卡片' })).getByText('存在阻塞').title).toContain('失败')
    view.rerender(<ProjectProgressOverlay {...input} useProjectSurfaces={props([{ id: '执行结果项目', surface: surface(resultSurface(true)) }]).useProjectSurfaces} />)
    expect(screen.getByRole('button', { name: '查看 0 个待处理项目' })).toBeTruthy()
    expect(within(screen.getByRole('region', { name: '项目卡片' })).queryByText('存在阻塞')).toBeNull()
  })

  it('keeps legacy validation approvals actionable and removes the notice after confirmation', () => {
    const legacy: ProjectStageLoadState = { status: 'ready', value: { workspaceId: '旧项目', currentStage: 'validation', revision: 1, createdAt: '', updatedAt: '' } }
    const legacySurface = (status: 'pending' | 'confirmed'): ProjectSurfaceLoadState => ({ status: 'ready', value: {
      validation: {
        contract: { status: 'ready', issues: [] }, planReady: true, planApproval: { status },
        gateReady: false, blockers: ['测试尚未执行'], satisfiedMetricCount: 0, requiredMetricCount: 1,
        artifacts: { presentCount: 1, requiredCount: 3 },
      },
    } as unknown as ProjectSurfaceSnapshot })
    const input = props([{ id: '旧项目', stage: legacy, surface: legacySurface('pending') }])
    const view = render(<ProjectProgressOverlay {...input} />)
    expect(within(screen.getByRole('region', { name: '项目卡片' })).getByText('待你确认')).toBeTruthy()
    view.rerender(<ProjectProgressOverlay {...input} useProjectSurfaces={props([{ id: '旧项目', surface: legacySurface('confirmed') }]).useProjectSurfaces} />)
    expect(screen.getByRole('button', { name: '查看 0 个待处理项目' })).toBeTruthy()
  })
})
