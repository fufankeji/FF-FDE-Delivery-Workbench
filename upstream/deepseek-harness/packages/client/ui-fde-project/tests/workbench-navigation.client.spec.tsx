// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { bindSnapshotSelector, makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type { ComponentProps } from 'react'
import { WorkbenchNavigation, WorkbenchLabLauncher } from '../src/client/WorkbenchNavigation.tsx'
import { SkillsCenterPlaceholder, WorkbenchOverview } from '../src/client/WorkbenchOverview.tsx'
import { ProjectPageController } from '../src/client/page-controller.ts'
import { zh } from '../src/client/locales.ts'

const t = makeTranslate(zh)
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it('offers four peer destinations, preserves the project shortcut, and removes layout ownership on exit', () => {
  const page = new ProjectPageController()
  const renderSlot = vi.fn(() => null)
  const props = {
    useProjectPage: bindSnapshotSelector(page), showWorkbenchOverview: page.showDashboard,
    showProjectOverview: page.showOverview, showWorkbenchLab: page.showLab, showWorkbenchSkills: page.showSkills,
    showProjectHome: page.showHome, returnFromWorkbenchLab: page.returnFromLab, renderSlot, t,
  } as unknown as ComponentProps<typeof WorkbenchNavigation>
  const view = render(<WorkbenchNavigation {...props} />)
  expect(screen.queryByRole('navigation')).toBeNull()
  view.rerender(<><WorkbenchNavigation {...props} /><WorkbenchLabLauncher {...props as unknown as ComponentProps<typeof WorkbenchLabLauncher>} wide /></>)
  fireEvent.click(screen.getByRole('button', { name: '业务挖掘实验室' }))
  const nav = screen.getByRole('navigation', { name: '工作台导航' })
  expect(within(nav).getAllByRole('button').map(button => button.textContent)).toEqual(['总览', '项目中心', '实验室', '技能中心'])
  expect(document.body.dataset.fdeWorkbench).toBe('open')
  for (const [label, destination] of [['总览', 'dashboard'], ['项目中心', 'overview'], ['技能中心', 'skills'], ['实验室', 'lab']] as const) {
    const button = within(nav).getByRole('button', { name: label })
    fireEvent.click(button)
    expect(page.getSnapshot().view).toBe(destination)
    expect(button.getAttribute('aria-current')).toBe('page')
  }
  fireEvent.click(screen.getByRole('button', { name: '返回介绍首页' }))
  expect(page.getSnapshot().view).toBe('home')
  expect(document.body.dataset.fdeWorkbench).toBeUndefined()
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
  await waitFor(() => expect(props.enterProject).toHaveBeenCalledWith('recent'))
  expect(props.openProjects).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: /新建项目/ }))
  expect(props.createProject).toHaveBeenCalledTimes(1)
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
  await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('项目不可用'))
})

it('keeps Skills visibly unconnected and performs no catalog requests', () => {
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  const back = vi.fn()
  render(<SkillsCenterPlaceholder t={t} back={back} />)
  expect(screen.getByText('待接入')).toBeTruthy()
  expect(screen.getByText('项目内已有的阶段方法仍可正常查看和使用。')).toBeTruthy()
  expect(screen.getAllByRole('button')).toHaveLength(1)
  fireEvent.click(screen.getByRole('button', { name: /返回总览/ }))
  expect(back).toHaveBeenCalledOnce()
  expect(fetch).not.toHaveBeenCalled()
})
