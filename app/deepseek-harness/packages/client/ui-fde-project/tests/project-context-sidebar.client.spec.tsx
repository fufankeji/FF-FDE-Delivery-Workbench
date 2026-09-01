// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { ProjectContextSidebar } from '../src/client/ProjectContextSidebar.tsx'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const hook = <T,>(snapshot: T) => <S,>(selector: (state: T) => S): S => selector(snapshot)

function sidebarProps() {
  return {
    workspaceId: 'workspace-1',
    title: '企业知识库搭建',
    sessionCount: 1,
    useStageProgress: hook({
      byWorkspace: {
        'workspace-1': {
          status: 'ready',
          value: { workspaceId: 'workspace-1', currentStage: 'requirements', revision: 1, createdAt: '', updatedAt: '' },
        },
      },
    }),
    useProjectSources: hook({ byWorkspace: { 'workspace-1': { status: 'ready', files: [] } } }),
    useProjectSurfaces: hook({ byWorkspace: { 'workspace-1': { status: 'ready', value: { requirements: { presentCount: 0 } } } } }),
    loadStage: vi.fn(),
    loadProjectSources: vi.fn(),
    loadProjectSurface: vi.fn(),
    openProjectPage: vi.fn(),
    t: vi.fn(),
  } as unknown as ComponentProps<typeof ProjectContextSidebar>
}

const methodNames = [
  ['fde-orient', '项目启动与方向确认'],
  ['knowledge-interview', '访谈业务人员，还原真实做法'],
  ['ownership-map', '找到负责人和决策人'],
  ['repo-recon', '盘点现有系统与资料'],
  ['qualify-ai-workflow', '判断问题是否值得继续投入'],
  ['reframe-ai-engagement', '核对冲突并调整项目范围'],
  ['stakeholder-brief', '整理给负责人看的决策简报'],
] as const

describe('ProjectContextSidebar stage methods', () => {
  it('keeps an in-flight catalog request alive while the tree remains open', async () => {
    let requestSignal: AbortSignal | undefined
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      requestSignal = init?.signal ?? undefined
      return new Promise<Response>((_resolve, reject) => {
        requestSignal?.addEventListener('abort', () => { reject(new DOMException('Aborted', 'AbortError')) })
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<ProjectContextSidebar {...sidebarProps()} />)
    fireEvent.click(screen.getByRole('button', { name: /本阶段工作方法/ }))

    await waitFor(() => { expect(fetchMock).toHaveBeenCalledTimes(1) })
    expect(screen.getByText('正在读取工作方法…')).toBeTruthy()
    expect(requestSignal?.aborted).toBe(false)
  })

  it('keeps the business method tree collapsed and opens one read-only Markdown definition', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      value: {
        schemaVersion: 1,
        stages: [{
          id: 'requirements',
          index: 0,
          methods: methodNames.map(([id, label]) => ({
            id,
            label,
            description: `${label}的业务用途。`,
            whenToUse: `需要${label}时使用。`,
            source: 'fixed/source@commit',
            content: `# ${label}\n\n这是完整方法定义。`,
          })),
        }],
      },
    }), { status: 200, headers: { 'content-type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    render(<ProjectContextSidebar {...sidebarProps()} />)

    const toggle = screen.getByRole('button', { name: /本阶段工作方法/ })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByText('项目启动与方向确认')).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()

    fireEvent.click(toggle)
    await waitFor(() => { expect(screen.getByText('项目启动与方向确认')).toBeTruthy() })
    expect(fetchMock).toHaveBeenCalledWith('/api/fde-stage/skills', expect.objectContaining({ method: 'GET' }))
    expect(screen.getAllByRole('button').filter(button => methodNames.some(([, label]) => button.textContent?.includes(label)))).toHaveLength(7)

    fireEvent.click(screen.getByRole('button', { name: /项目启动与方向确认/ }))
    const dialog = screen.getByRole('dialog', { name: '项目启动与方向确认' })
    expect(within(dialog).getByRole('heading', { name: '项目启动与方向确认', level: 2 })).toBeTruthy()
    expect(within(dialog).getByRole('heading', { name: '项目启动与方向确认', level: 1 })).toBeTruthy()
    expect(within(dialog).getByText('这是完整方法定义。')).toBeTruthy()
    expect(within(dialog).queryByRole('button', { name: /运行|安装|启用/ })).toBeNull()
    const technical = dialog.querySelector('details')
    expect(technical?.hasAttribute('open')).toBe(false)
    expect(technical?.textContent).toContain('fde-orient')

    fireEvent.click(within(dialog).getByRole('button', { name: '关闭工作方法详情' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('loads the current V2 stage method instead of keeping the first-stage catalog', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      value: {
        schemaVersion: 1,
        stages: [{
          id: 'definition',
          index: 1,
          methods: [{
            id: 'fde-define-outcome-scope',
            label: '明确结果、范围与责任',
            description: '把项目结果、边界和责任说清楚。',
            whenToUse: '第一阶段完成后使用。',
            source: 'built-in',
            content: '# 明确结果、范围与责任',
          }],
        }],
      },
    }), { status: 200, headers: { 'content-type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)
    const props = sidebarProps()
    props.useStageProgress = hook({
      byWorkspace: {
        'workspace-1': {
          status: 'ready',
          value: {
            workspaceId: 'workspace-1', currentStage: 'solution', lifecycleVersion: 2,
            v2Stage: 'definition', revision: 2, createdAt: '', updatedAt: '',
          },
        },
      },
    }) as typeof props.useStageProgress

    render(<ProjectContextSidebar {...props} />)
    expect(screen.getByText('定义结果、范围与责任').closest('[data-active="true"]')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /本阶段工作方法/ }))
    await waitFor(() => { expect(screen.getByRole('button', { name: /明确结果、范围与责任/ })).toBeTruthy() })
    expect(screen.queryByText('项目启动与方向确认')).toBeNull()
  })
})
