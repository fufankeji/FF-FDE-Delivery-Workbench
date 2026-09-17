// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { bindSnapshotSelector, makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type { ComponentProps } from 'react'
import { WorkbenchNavigation, WorkbenchLabLauncher } from '../src/client/WorkbenchNavigation.tsx'
import { WorkbenchOverview } from '../src/client/WorkbenchOverview.tsx'
import { ProjectPageController } from '../src/client/page-controller.ts'
import { zh } from '../src/client/locales.ts'

const t = makeTranslate(zh)
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it('offers four peer destinations, preserves the project shortcut, and removes layout ownership on exit', () => {
  const page = new ProjectPageController()
  const renderSlot = vi.fn((key: string) => key === 'sidebar.settings.shortcut' ? <button type="button">设置</button> : null)
  const props = {
    useProjectPage: bindSnapshotSelector(page), showWorkbenchOverview: page.showDashboard,
    showProjectOverview: page.showOverview, showWorkbenchLab: page.showLab, showWorkbenchSkills: page.showSkills,
    showProjectHome: page.showHome, returnFromWorkbenchLab: page.returnFromLab, renderSlot, t,
  } as unknown as ComponentProps<typeof WorkbenchNavigation>
  const view = render(<WorkbenchNavigation {...props} />)
  expect(screen.queryByRole('navigation')).toBeNull()
  view.rerender(<><WorkbenchNavigation {...props} />
    <WorkbenchLabLauncher {...props as unknown as ComponentProps<typeof WorkbenchLabLauncher>} wide /></>)
  fireEvent.click(screen.getByRole('button', { name: '业务挖掘实验室' }))
  const nav = screen.getByRole('navigation', { name: '工作台导航' })
  expect(within(nav).getAllByRole('button').map(button => button.textContent)).toEqual(['总览', '项目中心', '实验室', '技能中心'])
  expect(document.body.dataset.fdeWorkbench).toBe('open')
  const settings = screen.getByRole('button', { name: '设置' })
  expect(screen.getByText('@赋范空间 独家研发').compareDocumentPosition(settings) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(renderSlot).toHaveBeenCalledWith('sidebar.settings.shortcut', { wide: true })
  for (const [label, destination] of [['总览', 'dashboard'], ['项目中心', 'overview'], ['技能中心', 'skills'], ['实验室', 'lab']] as const) {
    const button = within(nav).getByRole('button', { name: label })
    fireEvent.click(button)
    expect(page.getSnapshot().view).toBe(destination)
    expect(button.getAttribute('aria-current')).toBe('page')
  }
  const home = screen.getByRole('button', { name: '返回介绍首页' })
  expect(home.querySelectorAll('svg')).toHaveLength(1)
  expect(home.textContent).toBe('返回介绍首页')
  fireEvent.click(home)
  expect(page.getSnapshot().view).toBe('home')
  expect(document.body.dataset.fdeWorkbench).toBeUndefined()
  expect(screen.queryByRole('button', { name: '设置' })).toBeNull()
  expect(renderSlot).toHaveBeenLastCalledWith('fde.workbench.lab.page', { active: false, back: page.returnFromLab })
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
