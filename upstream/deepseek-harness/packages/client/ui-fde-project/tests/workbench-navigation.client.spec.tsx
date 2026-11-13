// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { bindSnapshotSelector, makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import type { ComponentProps } from 'react'
import { WorkbenchNavigation, WorkbenchLabLauncher, WorkbenchNativeReturn } from '../src/client/WorkbenchNavigation.tsx'
import { WorkbenchOverview } from '../src/client/WorkbenchOverview.tsx'
import { ProjectPageController } from '../src/client/page-controller.ts'
import { zh } from '../src/client/locales.ts'

const t = makeTranslate(zh)
beforeEach(() => {
  vi.stubGlobal('matchMedia', (media: string) => Object.assign(new EventTarget(), { media, matches: false }))
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

type NavigationProps = ComponentProps<typeof WorkbenchNavigation>
function navigationProps(page: ProjectPageController, renderSlot: NavigationProps['renderSlot'], renderFactorySlot: NavigationProps['renderFactorySlot'] = () => null, panelInfo = createSnapshotStore<{ activePanelId: MainPanelId | null }>({ activePanelId: null })): NavigationProps {
  return {
    usePanelInfo: bindSnapshotSelector(panelInfo),
    useProjectPage: bindSnapshotSelector(page), showWorkbenchOverview: page.showDashboard,
    showProjectOverview: page.showOverview, showWorkbenchLab: page.showLab, showWorkbenchSkills: page.showSkills,
    showProjectHome: page.showHome, returnFromWorkbenchLab: page.returnFromLab, renderSlot, renderFactorySlot, t,
    suspendWorkbenchForNative: page.suspendForNative, returnFromNativePanel: () => { panelInfo.set({ activePanelId: null }); page.returnFromNative() },
  } as unknown as NavigationProps
}

it('offers four peer destinations, preserves the project shortcut, and removes layout ownership on exit', () => {
  const page = new ProjectPageController()
  const renderSlot = vi.fn((key: string) => key === 'sidebar.settings.shortcut' ? <button type="button">设置</button> : null)
  const props = navigationProps(page, renderSlot)
  const view = render(<WorkbenchNavigation {...props} />)
  expect(screen.queryByRole('navigation')).toBeNull()
  view.rerender(<><WorkbenchNavigation {...props} />
    <WorkbenchLabLauncher {...props} wide /></>)
  fireEvent.click(screen.getByRole('button', { name: '实验室' }))
  const nav = screen.getByRole('navigation', { name: '工作台导航' })
  expect(within(nav).getAllByRole('button').map(button => button.textContent)).toEqual(['总览', '项目中心', '实验室', '技能中心'])
  expect(document.body.dataset.fdeWorkbench).toBe('open')
  expect(document.querySelector('[data-fde-workbench-backdrop]')?.getAttribute('aria-hidden')).toBe('true')
  expect(screen.getByText('本地工作区')).toBeTruthy()
  expect(screen.getByRole('region', { name: 'Harness 原生功能' })).toBeTruthy()
  const settings = screen.getByRole('button', { name: '设置' })
  const home = screen.getByRole('button', { name: '产品介绍' })
  expect(settings.compareDocumentPosition(home) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(home.compareDocumentPosition(screen.getByText('@赋范空间 独家研发')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(screen.queryByRole('button', { name: '返回工作台' })).toBeNull()
  expect(renderSlot).toHaveBeenCalledWith('sidebar.settings.shortcut', { wide: true })
  for (const [label, destination] of [['总览', 'dashboard'], ['项目中心', 'overview'], ['技能中心', 'skills'], ['实验室', 'lab']] as const) {
    const button = within(nav).getByRole('button', { name: label })
    fireEvent.click(button)
    expect(page.getSnapshot().view).toBe(destination)
    expect(button.getAttribute('aria-current')).toBe('page')
  }
  expect(home.querySelectorAll('svg')).toHaveLength(0)
  expect(home.textContent).toBe('产品介绍')
  fireEvent.click(home)
  expect(page.getSnapshot().view).toBe('home')
  expect(document.body.dataset.fdeWorkbench).toBeUndefined()
  expect(document.querySelector('[data-fde-workbench-backdrop]')).toBeNull()
  expect(screen.queryByRole('button', { name: '设置' })).toBeNull()
  expect(renderSlot).toHaveBeenLastCalledWith('fde.workbench.lab.page', { active: false, back: page.returnFromLab })
})

it('keeps the rail but releases the content backdrop for native pages and restores the mounted lab', () => {
  const page = new ProjectPageController()
  page.showLab()
  const renderSlot = vi.fn((key: string) => key === 'sidebar.settings.shortcut' ? <button type="button">设置</button> : null)
  const renderFactorySlot = vi.fn(() => null)
  const panelInfo = createSnapshotStore<{ activePanelId: MainPanelId | null }>({ activePanelId: null })
  const props = navigationProps(page, renderSlot, renderFactorySlot, panelInfo)
  render(<WorkbenchNavigation {...props} />)
  expect(renderFactorySlot).toHaveBeenLastCalledWith('sidebar.panels', { wide: true, beforeNavigate: page.suspendForNative })
  fireEvent.click(screen.getByRole('button', { name: '实验室' }))
  act(() => { page.suspendForNative(); panelInfo.set({ activePanelId: 'plugins' as MainPanelId }) })
  expect(document.body.dataset.fdeWorkbench).toBe('open')
  expect(document.body.dataset.fdeNativePanel).toBe('open')
  const nav = screen.getByRole('navigation', { name: '工作台导航' })
  expect(within(nav).getAllByRole('button').every(button => !button.hasAttribute('aria-current'))).toBe(true)
  const back = screen.getByRole('button', { name: '返回工作台' })
  expect(screen.getAllByRole('button', { name: '返回工作台' })).toHaveLength(1)
  expect(screen.queryByRole('button', { name: '返回介绍首页' })).toBeNull()
  expect(back.compareDocumentPosition(screen.getByRole('button', { name: '设置' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(document.querySelector('[data-fde-workbench-backdrop]')).toBeNull()
  expect(renderSlot).toHaveBeenLastCalledWith('fde.workbench.lab.page', { active: false, back: page.returnFromLab })
  fireEvent.click(back)
  expect(page.getSnapshot().view).toBe('lab')
  expect(panelInfo.getSnapshot().activePanelId).toBeNull()
  expect(document.body.dataset.fdeNativePanel).toBeUndefined()
  expect(document.querySelector('[data-fde-workbench-backdrop]')).not.toBeNull()
  expect(renderSlot).toHaveBeenLastCalledWith('fde.workbench.lab.page', { active: true, back: page.returnFromLab })
})

it('uses the same global rail when a native page is opened from the project sidebar', () => {
  const page = new ProjectPageController()
  page.close()
  const panelInfo = createSnapshotStore<{ activePanelId: MainPanelId | null }>({ activePanelId: null })
  const props = navigationProps(page, () => null, () => null, panelInfo)
  render(<WorkbenchNavigation {...props} />)
  expect(screen.queryByRole('navigation')).toBeNull()
  for (const id of ['plugins', 'schedules']) {
    act(() => { panelInfo.set({ activePanelId: id as MainPanelId }) })
    expect(screen.getByRole('navigation', { name: '工作台导航' })).toBeTruthy()
    expect(document.body.dataset.fdeNativePanel).toBe('open')
    expect(document.querySelector('[data-fde-workbench-backdrop]')).toBeNull()
  }
  fireEvent.click(screen.getByRole('button', { name: '返回工作台' }))
  expect(page.getSnapshot()).toEqual({ open: false, view: 'closed' })
  expect(screen.queryByRole('navigation')).toBeNull()
  expect(document.body.dataset.fdeWorkbench).toBeUndefined()
  expect(document.body.dataset.fdeNativePanel).toBeUndefined()
})

it('leaves the native session draft visible when More starts plugin creation', () => {
  const page = new ProjectPageController()
  page.showSkills()
  const props = navigationProps(page, () => null)
  render(<><WorkbenchNavigation {...props} /><WorkbenchNativeReturn {...props} wide /></>)
  act(() => { page.suspendForNative() })
  expect(screen.queryByRole('navigation')).toBeNull()
  expect(document.querySelector('[data-fde-workbench-backdrop]')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '返回工作台' }))
  expect(page.getSnapshot().view).toBe('skills')
})

function overviewProps(): ComponentProps<typeof WorkbenchOverview> {
  return {
    status: 'ready', projects: [
      { workspaceId: 'old', title: '较早项目', companyName: '甲公司', stage: '发现高价值问题', updatedAt: 1 },
      { workspaceId: 'recent', title: '最近项目', companyName: '乙公司', stage: '设计方案', updatedAt: 9 },
    ],
    openProjects: vi.fn(), openLab: vi.fn(), openSkills: vi.fn(), createProject: vi.fn(),
    enterProject: vi.fn(async () => {}), renderSlot: vi.fn(() => <><h2>实验室</h2><p>实验室概况</p></>), t,
  }
}

it('uses the compact official navigation at the same breakpoint and releases its media listener', () => {
  const media = Object.assign(new EventTarget(), { media: '(max-width: 640px)', matches: true })
  const remove = vi.spyOn(media, 'removeEventListener')
  vi.stubGlobal('matchMedia', () => media)
  const page = new ProjectPageController()
  page.showDashboard()
  const factory = vi.fn(() => null)
  const renderSlot = vi.fn(() => null)
  const view = render(<WorkbenchNavigation {...navigationProps(page, renderSlot, factory)} />)
  expect(factory).toHaveBeenLastCalledWith('sidebar.panels', { wide: false, beforeNavigate: page.suspendForNative })
  expect(renderSlot).toHaveBeenCalledWith('sidebar.settings.shortcut', { wide: false })
  expect(screen.getByRole('region', { name: 'Harness 原生功能' })).toBeTruthy()
  expect(screen.getByRole('button', { name: '产品介绍' })).toBeTruthy()
  act(() => { media.matches = false; media.dispatchEvent(new Event('change')) })
  expect(factory).toHaveBeenLastCalledWith('sidebar.panels', { wide: true, beforeNavigate: page.suspendForNative })
  view.unmount()
  expect(remove).toHaveBeenCalledWith('change', expect.any(Function))
})

it('shows real projects ordered by update and opens the exact project without an intermediate selector', async () => {
  const props = overviewProps()
  render(<WorkbenchOverview {...props} />)
  const recent = screen.getByRole('region', { name: '继续工作' })
  const rows = within(recent).getAllByRole('listitem')
  expect(rows[0]?.textContent).toContain('最近项目')
  expect(screen.getByText('个真实项目').previousElementSibling?.textContent).toBe('2')
  fireEvent.click(within(rows[0]!).getByRole('button', { name: /进入项目/ }))
  await waitFor(() => { expect(props.enterProject).toHaveBeenCalledWith('recent') })
  expect(props.openProjects).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: /新建项目/ }))
  expect(props.createProject).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button', { name: /查看项目/ }))
  expect(props.openProjects).toHaveBeenCalledOnce()
  fireEvent.click(screen.getByRole('button', { name: /查看技能中心/ }))
  expect(props.openSkills).toHaveBeenCalledOnce()
})

it('keeps the compact metrics, three recent rows and platform/course library entry tied to real data', () => {
  const props = overviewProps()
  const title = '连锁门店设备故障智能分诊项目与企业知识检索工作流'
  const projects = [...props.projects,
    { workspaceId: 'long', title, companyName: '', stage: '调查真实环境', updatedAt: 12 },
    { workspaceId: 'fourth', title: '第四个项目', companyName: '', stage: '发现高价值问题', updatedAt: 0 },
  ]
  render(<WorkbenchOverview {...props} projects={projects} />)
  expect(screen.getByText('个真实项目').previousElementSibling?.textContent).toBe('4')
  const recent = screen.getByRole('region', { name: '继续工作' })
  expect(within(recent).getAllByRole('listitem')).toHaveLength(3)
  expect(within(recent).getByRole('heading', { name: '继续工作3' })).toBeTruthy()
  expect(within(recent).getByTitle(title).textContent).toBe(title)
  expect(within(recent).getAllByText('当前阶段')).toHaveLength(3)
  expect(within(recent).getByText('未填写所属企业')).toBeTruthy()
  expect(screen.queryByText('第四个项目')).toBeNull()
  expect(screen.getByText('内置 / 课程').closest('[data-overview-skills]')).toBeTruthy()
  expect(props.renderSlot).toHaveBeenCalledOnce()
  expect(props.renderSlot).toHaveBeenCalledWith('fde.workbench.lab.summary', { openLab: props.openLab })
})

it('distinguishes loading, failure, empty projects and a failed project entry', async () => {
  const props = overviewProps()
  const view = render(<WorkbenchOverview {...props} status="loading" />)
  expect(screen.queryByText('个真实项目')).toBeNull()
  expect(screen.getByRole('status').textContent).toBe('正在读取…')
  view.rerender(<WorkbenchOverview {...props} status="error" />)
  expect(screen.getByRole('alert').textContent).toContain('项目列表暂时无法读取')
  expect(screen.queryByText('个真实项目')).toBeNull()
  view.rerender(<WorkbenchOverview {...props} projects={[]} />)
  expect(screen.getByText('还没有项目')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '进入实验室' }))
  expect(props.openLab).toHaveBeenCalledTimes(1)
  view.rerender(<WorkbenchOverview {...props} enterProject={vi.fn(async () => { throw new Error('项目不可用') })} />)
  fireEvent.click(screen.getAllByRole('button', { name: /进入项目/ })[0]!)
  await waitFor(() => { expect(screen.getByRole('alert').textContent).toBe('项目不可用') })
})

it('offers the platform/course library without loading its files from the overview', () => {
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  const props = overviewProps()
  render(<WorkbenchOverview {...props} />)
  expect(screen.getByText('内置 / 课程')).toBeTruthy()
  expect(screen.queryByText('待接入')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /查看技能中心/ }))
  expect(props.openSkills).toHaveBeenCalledOnce()
  expect(fetch).not.toHaveBeenCalled()
})
