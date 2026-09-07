// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { ProjectProgressOverlay } from '../src/client/ProjectProgressOverlay.tsx'
import { zh } from '../src/client/locales.ts'
import type { ProjectProgressOverlayProps } from '../src/client/slots.ts'

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('ResizeObserver', class {
    observe(): void {}
    disconnect(): void {}
  })
  vi.stubGlobal('IntersectionObserver', class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  })
})

afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); delete document.body.dataset.fdePage })

const hook = <T,>(value: T) => <S,>(selector: (state: T) => S) => selector(value)

describe('ProjectProgressOverlay standalone page', () => {
  it('opens on the product homepage before entering project operations', () => {
    const showProjectOverview = vi.fn()
    const loadStage = vi.fn()
    const props = {
      useProjectPage: hook({ open: true, view: 'home' as const }),
      useStageProgress: hook({ byWorkspace: {} }),
      useProjectSurfaces: hook({ byWorkspace: {} }),
      useProjectSources: hook({ byWorkspace: {} }),
      useWorkspaces: hook({ items: [{
        workspaceId: 'workspace-1', title: '数据分析项目', path: '/project/one', sessionIds: [],
        createdAt: '2026-08-27T00:00:00.000Z', updatedAt: '2026-08-27T00:00:00.000Z',
      }] }),
      useSessions: hook({ byId: {} }),
      loadStage, retryStage: vi.fn(), loadProjectSurface: vi.fn(), refreshProjectSurface: vi.fn(),
      completeRequirements: vi.fn(), completeSolution: vi.fn(),
      loadProjectSources: vi.fn(), parseProjectSource: vi.fn(),
      enterProject: vi.fn(), reviewProjectArchitecture: vi.fn(), closeProjectPage: vi.fn(), showProjectOverview,
      showProjectTimeline: vi.fn(), showProjectDetail: vi.fn(), renderSlot: vi.fn(() => null),
      t: makeTranslate(zh),
    } as unknown as ProjectProgressOverlayProps

    render(<ProjectProgressOverlay {...props} />)
    expect(screen.getByRole('region', { name: 'FF-FDE工作台产品首页' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /进入工作台/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /进入交付工作台 · 1 个项目/ })).toBeTruthy()
    expect(screen.getByRole('link', { name: /查看交付生命周期/ }).getAttribute('href')).toBe('#fde-lifecycle')
    expect(screen.getByRole('region', { name: '示例项目动态交付窗口' })).toBeTruthy()
    expect(screen.getByText('证据驱动的 FDE 交付系统')).toBeTruthy()
    expect(screen.getAllByText('15 / 15').length).toBeGreaterThan(0)
    expect(screen.getByText('92%')).toBeTruthy()
    expect(document.querySelectorAll('[data-delivery-signal]')).toHaveLength(2)
    expect(document.querySelector('[data-delivery-lifecycle-ribbon]')).toBeNull()
    expect(document.querySelector('[data-delivery-hero-bridge]')?.textContent).toContain('不是交付一个 Demo，而是交付一套客户能持续运行的结果。')
    expect(document.querySelectorAll('[data-delivery-lifecycle-map] [data-lifecycle-node]')).toHaveLength(6)
    expect(screen.getByText('需求与现场')).toBeTruthy()
    expect(screen.getByText('调整方案')).toBeTruthy()
    expect(document.querySelectorAll('[data-delivery-lifecycle-notes] [data-lifecycle-principle]')).toHaveLength(3)
    expect(document.querySelector('[data-delivery-lifecycle-map] iframe')).toBeNull()
    expect(screen.getByRole('region', { name: '交付方法核心表达' })).toBeTruthy()
    expect(screen.getByText('模型与算力只是投入，自主程度需要设计；')).toBeTruthy()
    expect(screen.queryByRole('link', { name: /交付方法指南/ })).toBeNull()
    expect(screen.getByRole('button', { name: /开始一次真实交付/ })).toBeTruthy()
    expect(loadStage).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /进入工作台/ }))
    expect(showProjectOverview).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: /进入交付工作台 · 1 个项目/ }))
    expect(showProjectOverview).toHaveBeenCalledTimes(2)
    fireEvent.click(screen.getByRole('button', { name: /开始一次真实交付/ }))
    expect(showProjectOverview).toHaveBeenCalledTimes(3)
  })

  it('hides the center/details work surfaces while open and restores them on close', () => {
    const frame = document.createElement('div')
    const sidebar = document.createElement('div')
    const center = document.createElement('div')
    const details = document.createElement('div')
    const overlay = document.createElement('div')
    frame.append(sidebar, center, details, overlay)
    document.body.append(frame)
    const props = {
      useProjectPage: hook({ open: true, view: 'overview' as const }),
      useStageProgress: hook({ byWorkspace: {} }),
      useProjectSurfaces: hook({ byWorkspace: {} }),
      useProjectSources: hook({ byWorkspace: {} }),
      useWorkspaces: hook({ items: [] }),
      useSessions: hook({ byId: {} }),
      loadStage: vi.fn(), retryStage: vi.fn(), loadProjectSurface: vi.fn(), refreshProjectSurface: vi.fn(),
      completeRequirements: vi.fn(), completeSolution: vi.fn(),
      loadProjectSources: vi.fn(), parseProjectSource: vi.fn(),
      enterProject: vi.fn(), reviewProjectArchitecture: vi.fn(), closeProjectPage: vi.fn(), showProjectOverview: vi.fn(),
      showProjectTimeline: vi.fn(), showProjectDetail: vi.fn(), renderSlot: vi.fn(() => null),
      t: makeTranslate(zh),
    } as unknown as ProjectProgressOverlayProps
    const view = render(<ProjectProgressOverlay {...props} />, { container: overlay })
    expect(document.body.dataset.fdePage).toBe('project-progress')
    expect(center.style.visibility).toBe('hidden')
    expect(details.style.visibility).toBe('hidden')
    expect(center.getAttribute('aria-hidden')).toBe('true')
    view.unmount()
    expect(document.body.dataset.fdePage).toBeUndefined()
    expect(center.style.visibility).toBe('')
    expect(details.style.visibility).toBe('')
    frame.remove()
  })

  it('renders the V2 project detail from real stage, source, work-item, and artifact values', () => {
    const enterProject = vi.fn()
    const retryStage = vi.fn()
    const props = {
      useProjectPage: hook({ open: true, view: 'project' as const, workspaceId: 'workspace-1' }),
      useStageProgress: hook({ byWorkspace: { 'workspace-1': { status: 'ready', value: {
        workspaceId: 'workspace-1', currentStage: 'requirements', lifecycleVersion: 2, v2Stage: 'discovery',
        revision: 1, createdAt: '2026-09-03T00:00:00.000Z', updatedAt: '2026-09-03T00:00:00.000Z',
      } } } }),
      useProjectSurfaces: hook({ byWorkspace: { 'workspace-1': { status: 'ready', value: {
        workspaceId: 'workspace-1', title: '真实项目',
        requirements: { requiredCount: 3, presentCount: 1 },
        discovery: {
          status: 'understanding', currentWorkId: 'restore-workflow', requiredCount: 3, presentCount: 1,
          reviewReady: false, blockers: ['仍需确认负责人'],
          workItems: [{ id: 'restore-workflow', title: '还原实际流程', purpose: '核对真实工作方式。', status: 'current' }],
          artifacts: [{ id: 'research-report', title: '需求调研报告', path: 'fde-deliverables/report.md', purpose: '记录现场事实。', required: true, status: 'present', structureState: 'complete_valid', evidenceState: 'confirmed', evidenceRefs: [] }],
        },
        v2Stages: Object.fromEntries(['definition', 'investigation', 'design', 'evaluation', 'pilot', 'production', 'improvement'].map((id, index) => [id, {
          id, index: index + 2, title: id, objective: '', explanation: '', statePath: '', skill: '', prompt: '',
          stateStatus: 'missing', status: 'working', currentWorkId: '', workItems: [], blockers: [], recommendation: 'pending',
          artifacts: [], requiredCount: 0, presentCount: 0, reviewReady: false, reviewBlockers: [],
        }])),
      } } } }),
      useProjectSources: hook({ byWorkspace: { 'workspace-1': { status: 'ready', files: [] } } }),
      useWorkspaces: hook({ items: [{ workspaceId: 'workspace-1', title: '真实项目', path: '/project/one', sessionIds: ['session-1'], createdAt: '2026-09-03T00:00:00.000Z', updatedAt: '2026-09-03T00:00:00.000Z' }] }),
      useSessions: hook({ byId: { 'session-1': { id: 'session-1', displayTitle: '会话', running: false, blank: true, updatedAt: 1 } } }),
      loadStage: vi.fn(), retryStage, loadProjectSurface: vi.fn(), refreshProjectSurface: vi.fn(),
      completeRequirements: vi.fn(), completeSolution: vi.fn(), completeDevelopment: vi.fn(), completeValidation: vi.fn(), completePilot: vi.fn(), completeHandoff: vi.fn(), returnToPrevious: vi.fn(),
      acceptValidationMetric: vi.fn(), waiveValidationIssue: vi.fn(), acceptDeploymentTrialIssue: vi.fn(), confirmDeploymentTrialReadiness: vi.fn(), recordAcceptanceHandoverDecision: vi.fn(),
      loadProjectSources: vi.fn(), parseProjectSource: vi.fn(), openProjectCreation: vi.fn(), enterProject,
      reviewProjectArchitecture: vi.fn(), closeProjectPage: vi.fn(), showProjectOverview: vi.fn(), showProjectTimeline: vi.fn(), showProjectDetail: vi.fn(), renderSlot: vi.fn(() => null), t: makeTranslate(zh),
    } as unknown as ProjectProgressOverlayProps

    render(<ProjectProgressOverlay {...props} />)
    expect(retryStage).toHaveBeenCalledWith('workspace-1')
    expect(document.querySelector('[data-v2-project-detail]')).toBeTruthy()
    expect(screen.getByRole('region', { name: '项目关键状态' })).toBeTruthy()
    const navigation = screen.getByRole('navigation', { name: '八阶段交付地图' })
    expect(within(navigation).getAllByRole('button')).toHaveLength(8)
    expect(screen.getAllByText('还原实际流程').length).toBeGreaterThan(0)
    expect(screen.getByText('需求调研报告')).toBeTruthy()
    expect(screen.getAllByText('仍需确认负责人').length).toBeGreaterThan(0)
    fireEvent.click(within(navigation).getByRole('button', { name: '查看阶段 2：定义结果、范围与责任' }))
    expect(screen.getByRole('heading', { name: '定义结果、范围与责任' })).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button', { name: /进入项目交付/ })[0] as HTMLElement)
    expect(enterProject).toHaveBeenCalledWith('workspace-1')
  })

  it('shows every real project by default and keeps decision filtering separate from portfolio summaries', () => {
    const showProjectDetail = vi.fn()
    const showProjectTimeline = vi.fn()
    const enterProject = vi.fn()
    const openProjectCreation = vi.fn()
    localStorage.setItem('dsh.workspace.view.v6', JSON.stringify({
      projectMetadataByPath: {
        '/project/one': { companyName: '甲方', schedule: { status: 'estimated', startDate: '2026-08-27', endDate: '2026-09-27' } },
        '/project/two': { companyName: '乙方', schedule: { status: 'estimated', startDate: '2026-08-28', endDate: '2026-09-28' } },
      },
    }))
    const props = {
      useProjectPage: hook({ open: true, view: 'overview' as const }),
      useStageProgress: hook({ byWorkspace: {
        'workspace-1': { status: 'ready', value: {
          workspaceId: 'workspace-1', currentStage: 'requirements', revision: 1,
          createdAt: '2026-08-27T00:00:00.000Z', updatedAt: '2026-08-27T00:00:00.000Z',
        } },
        'workspace-2': { status: 'ready', value: {
          workspaceId: 'workspace-2', currentStage: 'completed', revision: 3,
          createdAt: '2026-08-27T00:00:00.000Z', updatedAt: '2026-08-27T00:02:00.000Z',
        } },
      } }),
      useProjectSurfaces: hook({ byWorkspace: {} }),
      useProjectSources: hook({ byWorkspace: {} }),
      useWorkspaces: hook({ items: [
        {
          workspaceId: 'workspace-1', title: '客户需求梳理', path: '/project/one', sessionIds: ['session-1'],
          createdAt: '2026-08-27T00:00:00.000Z', updatedAt: '2026-08-27T00:00:00.000Z',
        },
        {
          workspaceId: 'workspace-2', title: '数据分析项目', path: '/project/two', sessionIds: ['session-2'],
          createdAt: '2026-08-27T00:00:00.000Z', updatedAt: '2026-08-27T00:00:00.000Z',
        },
      ] }),
      useSessions: hook({ byId: {
        'session-1': { id: 'session-1', displayTitle: '需求会话', running: false, blank: false, updatedAt: 1 },
        'session-2': { id: 'session-2', displayTitle: '研发会话', running: false, blank: false, updatedAt: 2 },
      } }),
      loadStage: vi.fn(), retryStage: vi.fn(), loadProjectSurface: vi.fn(), refreshProjectSurface: vi.fn(),
      completeRequirements: vi.fn(), completeSolution: vi.fn(), completeDevelopment: vi.fn(),
      loadProjectSources: vi.fn(), parseProjectSource: vi.fn(),
      openProjectCreation, enterProject, reviewProjectArchitecture: vi.fn(), closeProjectPage: vi.fn(), showProjectOverview: vi.fn(),
      showProjectTimeline, showProjectDetail, renderSlot: vi.fn(() => null),
      t: makeTranslate(zh),
    } as unknown as ProjectProgressOverlayProps

    render(<ProjectProgressOverlay {...props} />)
    expect(screen.getByRole('heading', { name: '项目中心' })).toBeTruthy()
    expect(screen.getByLabelText('本地工作区')).toBeTruthy()
    expect(screen.getByRole('button', { name: '查看 1 个待处理项目' })).toBeTruthy()
    expect(screen.queryByLabelText('3 条通知')).toBeNull()
    expect(screen.getByLabelText('项目中心帮助')).toBeTruthy()
    expect(screen.getByText('当前优先事项')).toBeTruthy()
    expect(screen.getByText('已登记周期')).toBeTruthy()
    expect(screen.getByRole('heading', { name: '最近动态' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: '交付周期' })).toBeTruthy()
    expect(screen.queryByRole('list', { name: '项目阶段分布' })).toBeNull()
    expect(screen.getByRole('button', { name: /查看并处理/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '新建项目' }))
    expect(openProjectCreation).toHaveBeenCalledTimes(1)
    const filterButton = screen.getByRole('button', { name: '筛选项目，当前：全部项目' })
    const sortButton = screen.getByRole('button', { name: '项目排序，当前：优先事项' })
    expect(filterButton).toBeTruthy()
    expect(sortButton).toBeTruthy()
    expect(screen.getByRole('heading', { name: '全部项目 2' })).toBeTruthy()
    expect(within(screen.getByRole('region', { name: '项目卡片' })).getAllByText('当前阶段')).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: '查看产物' })).toHaveLength(2)
    const cardMarkPalettes = [...document.querySelectorAll('[data-project-mark]')].map(element => element.getAttribute('data-project-mark')).sort()
    const cardView = screen.getByRole('button', { name: '卡片' })
    const listView = screen.getByRole('button', { name: '列表' })
    expect(cardView.getAttribute('aria-pressed')).toBe('true')
    expect(listView.getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByRole('button', { name: /已登记/ })).toBeTruthy()
    const enterButtons = screen.getAllByRole('button', { name: /进入项目/ })
    expect(enterButtons).toHaveLength(2)
    fireEvent.click(enterButtons[0] as HTMLElement)
    expect(enterProject).toHaveBeenCalledWith('workspace-2')
    expect(screen.queryByText('项目现在集中在哪')).toBeNull()
    expect(screen.queryByText('需要怎样介入')).toBeNull()
    expect(screen.queryByText('六阶段从需求到验收')).toBeNull()
    expect(screen.queryByText('演示项目')).toBeNull()
    expect(screen.queryByText('演示数据')).toBeNull()
    expect(screen.queryByRole('table', { name: '项目列表' })).toBeNull()
    fireEvent.click(listView)
    const attentionTable = screen.getByRole('table', { name: '项目列表' })
    const listMarkPalettes = [...attentionTable.querySelectorAll('[data-project-mark]')].map(element => element.getAttribute('data-project-mark')).sort()
    expect(listMarkPalettes).toEqual(cardMarkPalettes)
    expect(within(attentionTable).getAllByRole('button', { name: '查看产物' })).toHaveLength(2)
    expect(within(attentionTable).getAllByRole('button', { name: /进入项目/ })).toHaveLength(2)
    fireEvent.click(filterButton)
    expect(screen.getByRole('button', { name: '筛选项目，当前：待我处理' })).toBeTruthy()
    expect(cardView.getAttribute('aria-pressed')).toBe('false')
    expect(listView.getAttribute('aria-pressed')).toBe('true')
    const projectTable = screen.getByRole('table', { name: '项目列表' })
    expect(within(projectTable).getByText('客户需求梳理')).toBeTruthy()
    expect(within(projectTable).queryByText('数据分析项目')).toBeNull()
    expect(within(projectTable).getAllByRole('button', { name: '查看产物' })).toHaveLength(1)
    expect(screen.getAllByText('数据分析项目').length).toBeGreaterThanOrEqual(2)
    const projectButtons = within(projectTable).getAllByRole('button', { name: '查看产物' })
    fireEvent.click(projectButtons[0] as HTMLElement)
    expect(showProjectDetail).toHaveBeenCalledWith('workspace-1')
    fireEvent.click(cardView)
    expect(screen.queryByRole('table', { name: '项目列表' })).toBeNull()
    expect(within(screen.getByRole('region', { name: '项目卡片' })).getAllByRole('button', { name: '查看产物' })).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: /查看全部 2 个周期/ }))
    expect(showProjectTimeline).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('heading', { name: '全部项目 2' })).toBeTruthy()
  })

  it('paginates the filtered collection without truncating totals, recent activity, or project navigation', () => {
    const workspaces = Array.from({ length: 13 }, (_, index) => ({
      workspaceId: `workspace-${index + 1}`, title: `客户项目 ${index + 1}`, path: `/project/${index + 1}`,
      sessionIds: [`session-${index + 1}`], createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z',
    }))
    const enterProject = vi.fn()
    const showProjectDetail = vi.fn()
    const input = {
      useProjectPage: hook({ open: true, view: 'overview' as const }),
      useStageProgress: hook({ byWorkspace: {} }), useProjectSurfaces: hook({ byWorkspace: {} }),
      useProjectSources: hook({ byWorkspace: {} }), useWorkspaces: hook({ items: workspaces }),
      useSessions: hook({ byId: Object.fromEntries(workspaces.map((workspace, index) => [workspace.sessionIds[0], { id: workspace.sessionIds[0], displayTitle: `交付记录 ${index + 1}`, running: false, updatedAt: index + 1 }])) }),
      loadStage: vi.fn(), retryStage: vi.fn(), loadProjectSurface: vi.fn(), refreshProjectSurface: vi.fn(),
      loadProjectSources: vi.fn(), enterProject, showProjectDetail, showProjectOverview: vi.fn(),
      showProjectTimeline: vi.fn(), openProjectCreation: vi.fn(), renderSlot: vi.fn(() => null), t: makeTranslate(zh),
    } as unknown as ProjectProgressOverlayProps
    const view = render(<ProjectProgressOverlay {...input} />)
    const collection = screen.getByRole('region', { name: '项目集合' })
    const activity = screen.getByRole('region', { name: '最近动态' })
    expect(within(collection).getAllByRole('button', { name: '查看产物' })).toHaveLength(6)
    expect(screen.getByRole('heading', { name: '全部项目 13' })).toBeTruthy()
    expect(within(activity).getAllByRole('listitem')).toHaveLength(3)
    fireEvent.click(screen.getByRole('button', { name: /查看全部动态/ }))
    expect(within(activity).getAllByRole('listitem')).toHaveLength(13)
    fireEvent.click(screen.getByRole('button', { name: /收起动态/ }))
    expect(within(activity).getAllByRole('listitem')).toHaveLength(3)
    expect(screen.getByRole('button', { name: '上一页' }).hasAttribute('disabled')).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: '下一页' }))
    expect(screen.getByText('2 / 3')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '下一页' }))
    expect(within(collection).getAllByRole('button', { name: '查看产物' })).toHaveLength(1)
    expect(screen.getByRole('button', { name: '下一页' }).hasAttribute('disabled')).toBe(true)
    fireEvent.click(within(collection).getByRole('button', { name: /进入项目/ }))
    expect(enterProject).toHaveBeenCalledWith('workspace-1')
    fireEvent.click(screen.getByRole('button', { name: '项目排序，当前：优先事项' }))
    expect(screen.getByText('1 / 3')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '下一页' }))
    fireEvent.change(screen.getByRole('searchbox', { name: '搜索项目或企业' }), { target: { value: '客户项目 13' } })
    expect(within(collection).getAllByRole('button', { name: '查看产物' })).toHaveLength(1)
    fireEvent.click(within(collection).getByRole('button', { name: '查看产物' }))
    expect(showProjectDetail).toHaveBeenCalledWith('workspace-13')
    expect(screen.queryByRole('navigation', { name: '项目分页' })).toBeNull()
    fireEvent.change(screen.getByRole('searchbox', { name: '搜索项目或企业' }), { target: { value: '不存在的名称' } })
    expect(within(collection).getByText('没有匹配的项目，请调整搜索条件。')).toBeTruthy()
    expect(within(collection).queryByRole('button', { name: /进入项目/ })).toBeNull()
    expect(within(activity).getAllByRole('listitem')).toHaveLength(3)
    expect(screen.getByText('真实项目').parentElement?.textContent).toContain('13')
    fireEvent.click(screen.getByRole('button', { name: '清除搜索' }))
    fireEvent.click(screen.getByRole('button', { name: '下一页' }))
    fireEvent.click(screen.getByRole('button', { name: '列表' }))
    expect(screen.getByText('1 / 3')).toBeTruthy()
    expect(within(screen.getByRole('table', { name: '项目列表' })).getAllByRole('row')).toHaveLength(7)
    fireEvent.click(screen.getByRole('button', { name: '下一页' }))
    fireEvent.click(screen.getByRole('button', { name: '下一页' }))
    view.rerender(<ProjectProgressOverlay {...input} useWorkspaces={hook({ items: workspaces.slice(0, 2) }) as ProjectProgressOverlayProps['useWorkspaces']} />)
    expect(within(screen.getByRole('table', { name: '项目列表' })).getAllByRole('row')).toHaveLength(3)
    expect(screen.queryByRole('navigation', { name: '项目分页' })).toBeNull()
  })

  it('separates stage inputs and outputs and requires the FDE second confirmation', async () => {
    const completeRequirements = vi.fn(async () => {})
    const renderSlot = vi.fn(() => <div>阶段产出正文</div>)
    const props = {
      useProjectPage: hook({ open: true, view: 'project' as const, workspaceId: 'workspace-1' }),
      useStageProgress: hook({ byWorkspace: { 'workspace-1': { status: 'ready', value: {
        workspaceId: 'workspace-1', currentStage: 'requirements', revision: 1,
        createdAt: '2026-08-27T00:00:00.000Z', updatedAt: '2026-08-27T00:00:00.000Z',
      } } } }),
      useProjectSurfaces: hook({ byWorkspace: { 'workspace-1': { status: 'ready', value: {
        workspaceId: 'workspace-1', title: '数据分析项目',
        runtime: { schemaVersion: 1, revision: 0, status: 'stopped', updatedAt: '1970-01-01T00:00:00.000Z' },
        apiDocs: { status: 'unconfigured', message: '未配置' },
        architecture: null, evaluation: { casesCount: 0, reports: [] },
        requirements: {
          root: 'fde-deliverables/01-requirement-research', requiredCount: 3, presentCount: 3,
          artifacts: [
            { id: 'research-report', title: '需求调研报告', path: 'fde-deliverables/01-requirement-research/requirement-research-report.md', status: 'present', bytes: 120, fileUrl: '/api/fde-project/requirements/artifact?workspaceId=workspace-1&artifactId=research-report' },
            { id: 'confirmation-checklist', title: '需求确认清单', path: 'fde-deliverables/01-requirement-research/confirmation-checklist.md', status: 'present', fileUrl: '/api/fde-project/requirements/artifact?workspaceId=workspace-1&artifactId=confirmation-checklist' },
            { id: 'requirement-baseline', title: '需求基线', path: 'fde-deliverables/01-requirement-research/requirement-baseline.md', status: 'present', fileUrl: '/api/fde-project/requirements/artifact?workspaceId=workspace-1&artifactId=requirement-baseline' },
          ],
        },
      } } } }),
      useProjectSources: hook({ byWorkspace: { 'workspace-1': { status: 'ready', files: [] } } }),
      useWorkspaces: hook({ items: [{
        workspaceId: 'workspace-1', title: '数据分析项目', path: '/project/one', sessionIds: ['session-1'],
        createdAt: '2026-08-27T00:00:00.000Z', updatedAt: '2026-08-27T00:00:00.000Z',
      }] }),
      useSessions: hook({ byId: { 'session-1': { id: 'session-1', displayTitle: '会话', running: false, blank: false, updatedAt: 1 } } }),
      loadStage: vi.fn(), retryStage: vi.fn(), loadProjectSurface: vi.fn(), refreshProjectSurface: vi.fn(),
      completeRequirements, completeSolution: vi.fn(),
      loadProjectSources: vi.fn(), parseProjectSource: vi.fn(),
      enterProject: vi.fn(), reviewProjectArchitecture: vi.fn(), closeProjectPage: vi.fn(), showProjectOverview: vi.fn(),
      showProjectTimeline: vi.fn(), showProjectDetail: vi.fn(), renderSlot,
      t: makeTranslate(zh),
    } as unknown as ProjectProgressOverlayProps

    render(<ProjectProgressOverlay {...props} />)
    expect(screen.getByText('八阶段证据成熟度')).toBeTruthy()
    const currentFocus = screen.getByRole('region', { name: '当前阶段重点' })
    expect(within(currentFocus).getByRole('heading', { name: '发现高价值问题' })).toBeTruthy()
    expect(within(currentFocus).getByRole('list', { name: '项目八阶段位置' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: '阶段输入尚未建立' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /进入项目交付并添加资料/ })).toBeTruthy()
    expect(screen.queryByText('六阶段工作区')).toBeNull()
    expect(screen.getByRole('button', { name: /阶段输入/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /阶段产出/ }))
    expect(screen.getByText('需求调研报告')).toBeTruthy()
    expect(screen.getByText('待 FDE 确认')).toBeTruthy()
    expect(screen.getByText('选择一份“已有文件”查看只读内容。')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '预览需求调研报告' }))
    expect(screen.getByText('阶段产出正文')).toBeTruthy()
    expect(renderSlot).toHaveBeenLastCalledWith('fde.project.source.preview', {
      source: {
        fileUrl: '/api/fde-project/requirements/artifact?workspaceId=workspace-1&artifactId=research-report',
        name: 'requirement-research-report.md',
        bytes: 120,
        previewKind: 'text',
      },
    })
    fireEvent.click(screen.getByRole('button', { name: '完成需求调研' }))
    expect(screen.getByText('我已核对客户原始资料、需求调研报告、确认清单、需求基线和仍保留的未决事项。')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '确认并进入方案设计' }))
    await waitFor(() => { expect(completeRequirements).toHaveBeenCalledWith('workspace-1', 1) })
  })

  it('shows five solution documents and the confirmed architecture before the FDE enters development', async () => {
    const completeSolution = vi.fn(async () => {})
    const renderSlot = vi.fn(() => <div>方案设计正文</div>)
    const props = {
      useProjectPage: hook({ open: true, view: 'project' as const, workspaceId: 'workspace-1' }),
      useStageProgress: hook({ byWorkspace: { 'workspace-1': { status: 'ready', value: {
        workspaceId: 'workspace-1', currentStage: 'solution', revision: 2,
        createdAt: '2026-08-27T00:00:00.000Z', updatedAt: '2026-08-27T00:01:00.000Z',
      } } } }),
      useProjectSurfaces: hook({ byWorkspace: { 'workspace-1': { status: 'ready', value: {
        workspaceId: 'workspace-1', title: '数据分析项目',
        runtime: { schemaVersion: 1, revision: 0, status: 'stopped', updatedAt: '1970-01-01T00:00:00.000Z' },
        apiDocs: { status: 'unconfigured', message: '未配置' },
        architecture: {
          version: 1, revision: 1, title: '数据分析系统架构', status: 'confirmed',
          updatedAt: '2026-08-27T00:00:00.000Z', groups: [], nodes: [], edges: [],
        },
        evaluation: { casesCount: 0, reports: [] },
        requirements: { root: 'fde-deliverables/01-requirement-research', requiredCount: 3, presentCount: 3, artifacts: [] },
        solution: {
          root: 'fde-deliverables/02-solution-design', requiredCount: 5, presentCount: 5,
          artifacts: [
            { id: 'project-prd', title: '项目 PRD', path: 'fde-deliverables/02-solution-design/project-prd.md', status: 'present', bytes: 320, fileUrl: '/api/fde-project/solution/artifact?workspaceId=workspace-1&artifactId=project-prd' },
            { id: 'solution-design', title: '方案设计', path: 'fde-deliverables/02-solution-design/solution-design.md', status: 'present', bytes: 240, fileUrl: '/api/fde-project/solution/artifact?workspaceId=workspace-1&artifactId=solution-design' },
            { id: 'development-plan', title: '研发计划', path: 'fde-deliverables/02-solution-design/development-plan.md', status: 'present', fileUrl: '/api/fde-project/solution/artifact?workspaceId=workspace-1&artifactId=development-plan' },
            { id: 'acceptance-plan', title: '验收方案', path: 'fde-deliverables/02-solution-design/acceptance-plan.md', status: 'present', fileUrl: '/api/fde-project/solution/artifact?workspaceId=workspace-1&artifactId=acceptance-plan' },
            { id: 'solution-baseline', title: '方案基线', path: 'fde-deliverables/02-solution-design/solution-baseline.md', status: 'present', fileUrl: '/api/fde-project/solution/artifact?workspaceId=workspace-1&artifactId=solution-baseline' },
          ],
        },
      } } } }),
      useProjectSources: hook({ byWorkspace: { 'workspace-1': { status: 'ready', files: [] } } }),
      useWorkspaces: hook({ items: [{
        workspaceId: 'workspace-1', title: '数据分析项目', path: '/project/one', sessionIds: ['session-1'],
        createdAt: '2026-08-27T00:00:00.000Z', updatedAt: '2026-08-27T00:00:00.000Z',
      }] }),
      useSessions: hook({ byId: { 'session-1': { id: 'session-1', displayTitle: '会话', running: false, blank: false, updatedAt: 1 } } }),
      loadStage: vi.fn(), retryStage: vi.fn(), loadProjectSurface: vi.fn(), refreshProjectSurface: vi.fn(),
      completeRequirements: vi.fn(), completeSolution,
      loadProjectSources: vi.fn(), parseProjectSource: vi.fn(),
      enterProject: vi.fn(), reviewProjectArchitecture: vi.fn(), closeProjectPage: vi.fn(), showProjectOverview: vi.fn(),
      showProjectTimeline: vi.fn(), showProjectDetail: vi.fn(), renderSlot,
      t: makeTranslate(zh),
    } as unknown as ProjectProgressOverlayProps

    render(<ProjectProgressOverlay {...props} />)
    fireEvent.click(screen.getByRole('button', { name: /阶段产出/ }))
    expect(screen.getByText('方案设计阶段产出')).toBeTruthy()
    expect(screen.getByText('项目 PRD')).toBeTruthy()
    expect(screen.getByText('研发计划')).toBeTruthy()
    expect(screen.getByText('验收方案')).toBeTruthy()
    expect(screen.getByText('方案基线')).toBeTruthy()
    expect(screen.getByText('系统架构')).toBeTruthy()
    expect(screen.getByText('已确认 R1')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '预览项目 PRD' }))
    expect(screen.getByText('方案设计正文')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '完成方案设计' }))
    expect(screen.getByText(/我已核对项目 PRD 等五份方案文档/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '确认并进入项目开发' }))
    await waitFor(() => { expect(completeSolution).toHaveBeenCalledWith('workspace-1', 2) })
  })

  it('shows docs-based development progress and keeps validation behind FDE confirmation', async () => {
    const completeDevelopment = vi.fn(async () => {})
    const renderSlot = vi.fn(() => <div>研发文档正文</div>)
    const props = {
      useProjectPage: hook({ open: true, view: 'project' as const, workspaceId: 'workspace-1' }),
      useStageProgress: hook({ byWorkspace: { 'workspace-1': { status: 'ready', value: {
        workspaceId: 'workspace-1', currentStage: 'development', revision: 3,
        createdAt: '2026-08-27T00:00:00.000Z', updatedAt: '2026-08-27T00:02:00.000Z',
      } } } }),
      useProjectSurfaces: hook({ byWorkspace: { 'workspace-1': { status: 'ready', value: {
        workspaceId: 'workspace-1', title: '数据分析项目',
        runtime: { schemaVersion: 1, revision: 0, status: 'stopped', updatedAt: '1970-01-01T00:00:00.000Z' },
        apiDocs: { status: 'unconfigured', message: '未配置' },
        architecture: null, evaluation: { casesCount: 0, reports: [] },
        requirements: { root: 'fde-deliverables/01-requirement-research', requiredCount: 3, presentCount: 3, artifacts: [] },
        solution: { root: 'fde-deliverables/02-solution-design', requiredCount: 5, presentCount: 5, artifacts: [] },
        development: {
          root: 'docs', issues: [],
          core: { requiredCount: 3, presentCount: 3, artifacts: [
            { id: 'core-prd', title: '项目 PRD', path: 'docs/PRD.md', kind: 'core', status: 'present', bytes: 120, fileUrl: '/api/fde-project/development/artifact?workspaceId=workspace-1&artifactId=core-prd' },
            { id: 'core-product-spec', title: '产品总规格', path: 'docs/specs/product-spec.md', kind: 'core', status: 'present' },
            { id: 'core-feature-map', title: 'Feature Map', path: 'docs/specs/feature-map.md', kind: 'core', status: 'present' },
          ] },
          features: [
            {
              id: 'F001', title: '数据接入', directory: 'docs/specs/F001-source-ingestion', status: 'in-progress',
              plannedStart: '2026-08-27', plannedEnd: '待确认', milestone: '完成数据源接入',
              taskTotal: 3, taskCompleted: 2,
              artifacts: [
                { id: 'feature-F001-spec', title: 'Feature Spec', path: 'docs/specs/F001-source-ingestion/spec.md', kind: 'feature', status: 'present' },
                { id: 'feature-F001-plan', title: '实施计划', path: 'docs/specs/F001-source-ingestion/plan.md', kind: 'feature', status: 'present' },
                { id: 'feature-F001-tasks', title: '任务清单', path: 'docs/specs/F001-source-ingestion/tasks.md', kind: 'feature', status: 'present' },
              ],
            },
            {
              id: 'F002', title: '模型评估', directory: 'docs/specs/F002-evaluation', status: 'unknown',
              taskTotal: 0, taskCompleted: 0, artifacts: [],
            },
          ],
          closure: { root: 'fde-deliverables/03-project-development', requiredCount: 3, presentCount: 3, artifacts: [
            { id: 'closure-implementation-report', title: '实施报告', path: 'fde-deliverables/03-project-development/implementation-report.md', kind: 'closure', status: 'present' },
            { id: 'closure-runbook', title: '运行手册', path: 'fde-deliverables/03-project-development/runbook.md', kind: 'closure', status: 'present' },
            { id: 'closure-development-baseline', title: '研发基线', path: 'fde-deliverables/03-project-development/development-baseline.md', kind: 'closure', status: 'present' },
          ] },
        },
      } } } }),
      useProjectSources: hook({ byWorkspace: { 'workspace-1': { status: 'ready', files: [] } } }),
      useWorkspaces: hook({ items: [{
        workspaceId: 'workspace-1', title: '数据分析项目', path: '/project/one', sessionIds: ['session-1'],
        createdAt: '2026-08-27T00:00:00.000Z', updatedAt: '2026-08-27T00:00:00.000Z',
      }] }),
      useSessions: hook({ byId: { 'session-1': { id: 'session-1', displayTitle: '会话', running: false, blank: false, updatedAt: 1 } } }),
      loadStage: vi.fn(), retryStage: vi.fn(), loadProjectSurface: vi.fn(), refreshProjectSurface: vi.fn(),
      completeRequirements: vi.fn(), completeSolution: vi.fn(), completeDevelopment,
      loadProjectSources: vi.fn(), parseProjectSource: vi.fn(),
      enterProject: vi.fn(), reviewProjectArchitecture: vi.fn(), closeProjectPage: vi.fn(), showProjectOverview: vi.fn(),
      showProjectTimeline: vi.fn(), showProjectDetail: vi.fn(), renderSlot,
      t: makeTranslate(zh),
    } as unknown as ProjectProgressOverlayProps

    render(<ProjectProgressOverlay {...props} />)
    expect(screen.getByRole('region', { name: '项目交付数据总览' })).toBeTruthy()
    expect(screen.getByRole('region', { name: '研发证据图谱' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '查看阶段 4：设计方案与纵向切片' }).getAttribute('aria-current')).toBe('step')
    expect(screen.getByRole('button', { name: '查看阶段 1：发现高价值问题' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '查看阶段 8：持续改进与能力沉淀' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /阶段产出/ }))
    expect(screen.getByText('Feature 研发进度')).toBeTruthy()
    expect(screen.getByText('F001')).toBeTruthy()
    expect(screen.getByText('数据接入')).toBeTruthy()
    expect(screen.getByLabelText('任务证据 2/3')).toBeTruthy()
    expect(screen.getByText('暂无任务证据')).toBeTruthy()
    expect(screen.getByText('状态待确认')).toBeTruthy()
    expect(screen.getByText('项目开发收口产物')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '预览项目 PRD' }))
    expect(screen.getByRole('dialog', { name: '预览项目 PRD' })).toBeTruthy()
    expect(screen.getByText('研发文档正文')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '关闭' }))
    expect(screen.queryByRole('dialog', { name: '预览项目 PRD' })).toBeNull()
    expect(screen.getByRole('button', { name: '查看阶段 4：设计方案与纵向切片' }).getAttribute('aria-current')).toBe('step')
    fireEvent.click(screen.getByRole('button', { name: '查看阶段 5：运行 PoC 与 Eval' }))
    expect(screen.getByRole('region', { name: '验证证据矩阵' })).toBeTruthy()
    expect(screen.getAllByText('尚未开始').length).toBeGreaterThan(0)
    expect(screen.getByText('项目当前处于 设计方案与纵向切片')).toBeTruthy()
    expect(completeDevelopment).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '查看阶段 4：设计方案与纵向切片' }))
    fireEvent.click(screen.getByRole('button', { name: '完成项目开发' }))
    expect(screen.getByText(/我已核对实施报告、运行手册、研发基线/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '确认并进入验证评估' }))
    await waitFor(() => { expect(completeDevelopment).toHaveBeenCalledWith('workspace-1', 3) })
  })

  it('shows validation inputs, evidence, outputs, and keeps pilot behind FDE confirmation', async () => {
    const completeValidation = vi.fn(async () => {})
    const acceptValidationMetric = vi.fn(async () => {})
    const waiveValidationIssue = vi.fn(async () => {})
    const renderSlot = vi.fn(() => <div>验证报告正文</div>)
    const props = {
      useProjectPage: hook({ open: true, view: 'project' as const, workspaceId: 'workspace-1' }),
      useStageProgress: hook({ byWorkspace: { 'workspace-1': { status: 'ready', value: {
        workspaceId: 'workspace-1', currentStage: 'validation', revision: 4,
        createdAt: '2026-08-27T00:00:00.000Z', updatedAt: '2026-08-27T00:03:00.000Z',
      } } } }),
      useProjectSurfaces: hook({ byWorkspace: { 'workspace-1': { status: 'ready', value: {
        workspaceId: 'workspace-1', title: '数据分析项目',
        runtime: { schemaVersion: 1, revision: 0, status: 'stopped', updatedAt: '1970-01-01T00:00:00.000Z' },
        apiDocs: { status: 'unconfigured', message: '未配置' }, architecture: null,
        evaluation: { casesCount: 1, reports: [] },
        validation: {
          contract: {
            status: 'ready', path: '.fde/evaluations/validation.json', digest: `sha256:${'1'.repeat(64)}`, candidateId: 'R1', environment: '本地验收环境',
            datasets: [{ id: 'core-cases', name: '核心业务用例', version: '1.0' }],
            metrics: [{
              id: 'runtime-smoke', name: '核心流程冒烟', category: 'functional', method: '启动并访问核心页面', threshold: '全部通过',
              sources: [{ path: 'fde-deliverables/02-solution-design/acceptance-plan.md', references: ['BA-1'], available: true }],
              required: true, status: 'PASS', value: '通过', evidence: '.fde/evaluations/reports/r1/smoke.md', evidenceAvailable: true,
            }, {
              id: 'million-row-performance', name: '百万行查询性能', category: 'performance',
              method: '正式设备压测', threshold: 'P95 小于 2 秒',
              sources: [{ path: 'fde-deliverables/02-solution-design/acceptance-plan.md', references: ['PA-1'], available: true }],
              required: true, status: 'NOT_RUN', evidenceAvailable: false, note: '正式性能设备尚未到位。',
            }],
            issues: [{
              id: 'model-window', title: '复购模型测试窗口尚未确定', severity: 'medium', status: 'open',
              evidenceAvailable: false, resolution: '增长团队确认时间窗口、正负样本定义和泄漏边界后再执行模型验收。',
            }],
          },
          artifacts: { root: 'fde-deliverables/04-validation', requiredCount: 3, presentCount: 3, items: [
            { id: 'validation-plan', title: '验证计划', path: 'fde-deliverables/04-validation/validation-plan.md', status: 'present', fileUrl: '/api/fde-project/validation/artifact?workspaceId=workspace-1&artifactId=validation-plan' },
            { id: 'validation-report', title: '验证报告', path: 'fde-deliverables/04-validation/validation-report.md', status: 'present', bytes: 220, fileUrl: '/api/fde-project/validation/artifact?workspaceId=workspace-1&artifactId=validation-report' },
            { id: 'validation-baseline', title: '验证基线', path: 'fde-deliverables/04-validation/validation-baseline.md', status: 'present', fileUrl: '/api/fde-project/validation/artifact?workspaceId=workspace-1&artifactId=validation-baseline' },
          ] },
          planReady: true, planBlockers: [], planApproval: { status: 'confirmed', contractDigest: `sha256:${'1'.repeat(64)}` },
          requiredMetricCount: 2, satisfiedMetricCount: 2, gateReady: true, blockers: [],
        },
        requirements: { root: 'fde-deliverables/01-requirement-research', requiredCount: 3, presentCount: 3, artifacts: [] },
      } } } }),
      useProjectSources: hook({ byWorkspace: { 'workspace-1': { status: 'ready', files: [] } } }),
      useWorkspaces: hook({ items: [{
        workspaceId: 'workspace-1', title: '数据分析项目', path: '/project/one', sessionIds: ['session-1'],
        createdAt: '2026-08-27T00:00:00.000Z', updatedAt: '2026-08-27T00:00:00.000Z',
      }] }),
      useSessions: hook({ byId: { 'session-1': { id: 'session-1', displayTitle: '会话', running: false, blank: false, updatedAt: 1 } } }),
      loadStage: vi.fn(), retryStage: vi.fn(), loadProjectSurface: vi.fn(), refreshProjectSurface: vi.fn(),
      completeRequirements: vi.fn(), completeSolution: vi.fn(), completeDevelopment: vi.fn(), completeValidation,
      acceptValidationMetric, waiveValidationIssue,
      loadProjectSources: vi.fn(), parseProjectSource: vi.fn(),
      enterProject: vi.fn(), reviewProjectArchitecture: vi.fn(), closeProjectPage: vi.fn(), showProjectOverview: vi.fn(),
      showProjectTimeline: vi.fn(), showProjectDetail: vi.fn(), renderSlot,
      t: makeTranslate(zh),
    } as unknown as ProjectProgressOverlayProps

    render(<ProjectProgressOverlay {...props} />)
    fireEvent.click(screen.getByRole('button', { name: /阶段产出/ }))
    expect(screen.getByText('评估方案、执行与产物')).toBeTruthy()
    expect(screen.getByText('R1')).toBeTruthy()
    expect(screen.getByText('核心业务用例')).toBeTruthy()
    expect(screen.getByText('核心流程冒烟')).toBeTruthy()
    expect(screen.getByText('BA-1')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '人工接受指标' }))
    expect(screen.getByText(/不会把“待执行”或缺少证据改成通过/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '确认人工接受' }))
    expect(screen.getByText('请填写本次人工接受的原因、适用范围或后续处理约定。')).toBeTruthy()
    fireEvent.change(screen.getByRole('textbox', { name: '接受理由' }), {
      target: { value: '客户确认本轮不具备正式性能设备，试运行阶段补测并回填证据。' },
    })
    fireEvent.click(screen.getByRole('button', { name: '确认人工接受' }))
    await waitFor(() => {
      expect(acceptValidationMetric).toHaveBeenCalledWith(
        'workspace-1', `sha256:${'1'.repeat(64)}`, 'million-row-performance',
        '客户确认本轮不具备正式性能设备，试运行阶段补测并回填证据。',
      )
    })
    fireEvent.click(screen.getByRole('button', { name: '人工确认关闭' }))
    expect(screen.getByText(/不会把未通过、未执行或缺少证据的指标改成通过/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '确认接受并关闭' }))
    expect(screen.getByText('请填写本次人工接受的原因、范围或后续处理约定。')).toBeTruthy()
    fireEvent.change(screen.getByRole('textbox', { name: '接受理由' }), {
      target: { value: '客户确认当前模型窗口不阻塞本轮交付，下一轮补充专项验证。' },
    })
    fireEvent.click(screen.getByRole('button', { name: '确认接受并关闭' }))
    await waitFor(() => {
      expect(waiveValidationIssue).toHaveBeenCalledWith(
        'workspace-1', `sha256:${'1'.repeat(64)}`, 'model-window',
        '客户确认当前模型窗口不阻塞本轮交付，下一轮补充专项验证。',
      )
    })
    fireEvent.click(screen.getByRole('button', { name: '预览验证报告' }))
    expect(screen.getByText('验证报告正文')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '完成验证评估' }))
    expect(screen.getByText(/我已核对候选版本、环境和数据版本/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '确认并进入部署试运行' }))
    await waitFor(() => { expect(completeValidation).toHaveBeenCalledWith('workspace-1', 4) })
  })

  it('refreshes the project snapshot and guides a candidate architecture to the full review view', async () => {
    const refreshProjectSurface = vi.fn()
    const reviewProjectArchitecture = vi.fn(async () => {})
    const props = {
      useProjectPage: hook({ open: true, view: 'project' as const, workspaceId: 'workspace-1' }),
      useStageProgress: hook({ byWorkspace: { 'workspace-1': { status: 'ready', value: {
        workspaceId: 'workspace-1', currentStage: 'solution', revision: 2,
        createdAt: '2026-08-27T00:00:00.000Z', updatedAt: '2026-08-27T00:01:00.000Z',
      } } } }),
      useProjectSurfaces: hook({ byWorkspace: { 'workspace-1': { status: 'ready', value: {
        workspaceId: 'workspace-1', title: '数据分析项目',
        runtime: { schemaVersion: 1, revision: 0, status: 'stopped', updatedAt: '1970-01-01T00:00:00.000Z' },
        apiDocs: { status: 'unconfigured', message: '未配置' },
        architecture: {
          version: 1, revision: 2, title: '数据分析系统架构', status: 'candidate',
          updatedAt: '2026-08-27T00:02:00.000Z', groups: [], nodes: [], edges: [],
        },
        evaluation: { casesCount: 0, reports: [] },
        requirements: { root: 'fde-deliverables/01-requirement-research', requiredCount: 3, presentCount: 3, artifacts: [] },
        solution: { root: 'fde-deliverables/02-solution-design', requiredCount: 5, presentCount: 0, artifacts: [] },
      } } } }),
      useProjectSources: hook({ byWorkspace: { 'workspace-1': { status: 'ready', files: [] } } }),
      useWorkspaces: hook({ items: [{
        workspaceId: 'workspace-1', title: '数据分析项目', path: '/project/one', sessionIds: ['session-1'],
        createdAt: '2026-08-27T00:00:00.000Z', updatedAt: '2026-08-27T00:00:00.000Z',
      }] }),
      useSessions: hook({ byId: { 'session-1': { id: 'session-1', displayTitle: '会话', running: false, blank: false, updatedAt: 1 } } }),
      loadStage: vi.fn(), retryStage: vi.fn(), loadProjectSurface: vi.fn(), refreshProjectSurface,
      completeRequirements: vi.fn(), completeSolution: vi.fn(),
      loadProjectSources: vi.fn(), parseProjectSource: vi.fn(),
      enterProject: vi.fn(), reviewProjectArchitecture, closeProjectPage: vi.fn(), showProjectOverview: vi.fn(),
      showProjectTimeline: vi.fn(), showProjectDetail: vi.fn(), renderSlot: vi.fn(() => null),
      t: makeTranslate(zh),
    } as unknown as ProjectProgressOverlayProps

    render(<ProjectProgressOverlay {...props} />)
    await waitFor(() => { expect(refreshProjectSurface).toHaveBeenCalledWith('workspace-1') })
    fireEvent.click(screen.getByRole('button', { name: /阶段产出/ }))
    fireEvent.click(screen.getByRole('button', { name: '去确认架构：数据分析系统架构 R2' }))
    await waitFor(() => { expect(reviewProjectArchitecture).toHaveBeenCalledWith('workspace-1') })
    expect(screen.queryByText('待 FDE 确认 R2')).toBeNull()
  })
})
