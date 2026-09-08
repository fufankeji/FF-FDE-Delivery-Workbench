// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within, waitFor } from '@testing-library/react'
import { bindSnapshotSelector, makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { ProjectProgressOverlay } from '../src/client/ProjectProgressOverlay.tsx'
import { ProjectPageController } from '../src/client/page-controller.ts'
import type { ProjectProgressOverlayProps } from '../src/client/slots.ts'
import { zh } from '../src/client/locales.ts'

const hook = <T,>(value: T) => <S,>(selector: (state: T) => S) => selector(value)
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe(): void {} disconnect(): void {} })
  vi.stubGlobal('IntersectionObserver', class { observe(): void {} unobserve(): void {} disconnect(): void {} })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); delete document.body.dataset.fdePage })

function mount(metadata?: Record<string, unknown>) {
  const page = new ProjectPageController()
  page.showOverview()
  const openActivitySession = vi.fn(async () => {})
  const showProjectDetail = vi.fn(page.showProject)
  const loadProjectMetadata = vi.fn()
  const workspaces = ['one', 'two', 'three'].map(id => ({
    workspaceId: id, title: `项目 ${id}`, path: `/projects/${id}`,
    sessionIds: id === 'one' ? ['session-one', 'archived', 'blank', 'child'] : [],
    createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-02T00:00:00Z',
  }))
  const props = {
    useProjectPage: bindSnapshotSelector(page),
    useWorkspaces: hook({ items: workspaces, archivedSessionIds: ['archived'] }),
    useSessions: hook({ byId: Object.fromEntries(['session-one', 'archived', 'blank', 'child'].map(id => [id, {
      id, displayTitle: id, updatedAt: Date.parse('2026-09-08T02:00:00Z'), blank: id === 'blank', origin: id === 'child' ? 'subagent' : 'user', running: false,
    }])) }),
    useStageProgress: hook({ byWorkspace: Object.fromEntries(workspaces.map(row => [row.workspaceId, { status: 'ready', value: {
      workspaceId: row.workspaceId, currentStage: row.workspaceId === 'two' ? 'completed' : 'requirements', revision: 1,
      createdAt: row.createdAt, updatedAt: '2026-09-07T00:00:00Z',
    } }])) }),
    useProjectSurfaces: hook({ byWorkspace: {} }), useProjectSources: hook({ byWorkspace: {} }),
    useProjectMetadata: hook({ byWorkspace: metadata ?? {
      one: { status: 'ready', value: { companyName: '甲', schedule: { status: 'estimated', startDate: '2026-09-01', endDate: '2026-10-01' } } },
      two: { status: 'ready', value: { companyName: '乙', schedule: { status: 'estimated', startDate: '2026-08-01', endDate: '2026-08-31' } } },
      three: { status: 'ready', value: null },
    } }),
    loadStage: vi.fn(), retryStage: vi.fn(), loadProjectSurface: vi.fn(), refreshProjectSurface: vi.fn(),
    loadProjectSources: vi.fn(), parseProjectSource: vi.fn(), loadProjectMetadata, openActivitySession,
    enterProject: vi.fn(), showProjectDetail, showProjectHome: page.showHome, showProjectOverview: page.showOverview, showProjectTimeline: page.showTimeline,
    openProjectCreation: vi.fn(), renderSlot: vi.fn(() => null), t: makeTranslate(zh),
  } as unknown as ProjectProgressOverlayProps
  render(<ProjectProgressOverlay {...props} />)
  return { page, props, openActivitySession, showProjectDetail, loadProjectMetadata }
}

describe('Project Center recent activity and delivery navigation', () => {
  it('returns from the timeline to the complete project overview and to the product homepage', () => {
    const input = mount()
    const openTimeline = () => fireEvent.click(screen.getByRole('button', { name: /查看全部 2 个周期/ }))
    openTimeline()
    fireEvent.click(screen.getByRole('button', { name: '返回项目中心' }))
    expect(input.page.getSnapshot()).toEqual({ open: true, view: 'overview' })
    expect(screen.getByRole('heading', { name: '全部项目 3' })).toBeTruthy()
    expect(screen.getByRole('region', { name: '最近动态' })).toBeTruthy()
    expect(screen.getByRole('region', { name: '交付周期' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: '返回项目中心' })).toBeNull()
    openTimeline()
    fireEvent.click(screen.getByRole('button', { name: '返回首页' }))
    expect(input.page.getSnapshot()).toEqual({ open: true, view: 'home' })
    expect(screen.getByRole('region', { name: 'FF-FDE工作台产品首页' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /进入工作台/ }))
    expect(screen.getByRole('region', { name: '最近动态' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '返回首页' }))
    expect(input.page.getSnapshot().view).toBe('home')
    expect(input.props.enterProject).not.toHaveBeenCalled()
  })

  it('pairs each activity with its own timestamp and exact target, excluding hidden and blank sessions', () => {
    const input = mount()
    const activity = screen.getByRole('region', { name: '最近动态' })
    const latest = within(activity).getAllByRole('listitem')[0]!
    expect(within(latest).getByText('会话更新 · session-one')).toBeTruthy()
    expect(latest.querySelector('time')?.dateTime).toBe('2026-09-08T02:00:00.000Z')
    fireEvent.click(within(latest).getByRole('button', { name: '查看对话' }))
    expect(input.openActivitySession).toHaveBeenCalledWith('one', 'session-one')
    expect(input.showProjectDetail).not.toHaveBeenCalled()
    fireEvent.click(within(activity).getByRole('button', { name: /查看全部动态/ }))
    expect(within(activity).getAllByRole('listitem')).toHaveLength(7)
    expect(activity.textContent).not.toMatch(/archived|blank|child/)
    const projectRecord = within(activity).getAllByText('项目记录更新')[0]!.closest('li')!
    expect(projectRecord.querySelector('time')?.dateTime).toBe('2026-09-02T00:00:00.000Z')
    fireEvent.click(within(projectRecord).getByRole('button', { name: '查看项目' }))
    expect(input.showProjectDetail).toHaveBeenCalledWith('one')
  })

  it('opens active schedule rows and the complete timeline with matching counts and a working return path', () => {
    const input = mount()
    const schedule = screen.getByRole('region', { name: '交付周期' })
    expect(within(schedule).getByRole('button', { name: /2\/3 已登记/ })).toBeTruthy()
    expect(within(schedule).getByRole('button', { name: '查看 项目 one 的交付周期' })).toBeTruthy()
    expect(within(schedule).queryByText('项目 two')).toBeNull()
    fireEvent.click(within(schedule).getByRole('button', { name: '查看 项目 one 的交付周期' }))
    expect(input.page.getSnapshot().workspaceId).toBe('one')
    fireEvent.click(screen.getByRole('button', { name: /全部项目/ }))
    fireEvent.click(screen.getByRole('button', { name: /查看全部 2 个周期/ }))
    expect(screen.getByRole('heading', { name: '交付时间轴 2' })).toBeTruthy()
    const collection = screen.getByRole('region', { name: '项目集合' })
    expect(within(collection).queryByText('项目 three')).toBeNull()
    fireEvent.click(within(collection).getByRole('button', { name: /项目 two/ }))
    expect(input.page.getSnapshot().workspaceId).toBe('two')
    fireEvent.click(screen.getByRole('button', { name: /全部项目/ }))
    fireEvent.click(within(screen.getByRole('region', { name: '交付周期' })).getByRole('button', { name: /已登记/ }))
    expect(screen.getByRole('heading', { name: '交付时间轴 2' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '列表', exact: true }))
    expect(screen.getByRole('heading', { name: '全部项目 3' })).toBeTruthy()
    expect(screen.getByRole('table', { name: '项目列表' })).toBeTruthy()
  })

  it('does not count missing or failed dates and exposes a targeted retry', async () => {
    const input = mount({ one: { status: 'error', message: '周期文件无法读取' }, two: { status: 'ready', value: null }, three: { status: 'ready', value: null } })
    const schedule = screen.getByRole('region', { name: '交付周期' })
    fireEvent.click(within(schedule).getByRole('button', { name: '重试保存或读取周期' }))
    expect(input.loadProjectMetadata).toHaveBeenLastCalledWith('one', '/projects/one', true)
    fireEvent.click(within(schedule).getByRole('button', { name: /0\/3 已登记/ }))
    expect(screen.getByRole('heading', { name: '交付时间轴 0' })).toBeTruthy()
    expect(screen.getByText('还没有已登记交付周期的项目。')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '卡片', exact: true }))
    input.openActivitySession.mockRejectedValueOnce(new Error('会话已移除'))
    fireEvent.click(screen.getByRole('button', { name: '查看对话' }))
    await waitFor(() => expect(screen.getByText('会话已移除')).toBeTruthy())
    expect(input.props.enterProject).not.toHaveBeenCalled()
  })
})
