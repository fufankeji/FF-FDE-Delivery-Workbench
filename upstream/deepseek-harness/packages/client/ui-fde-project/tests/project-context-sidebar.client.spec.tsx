// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
    useStageView: hook({ byWorkspace: {} }),
    loadStage: vi.fn(),
    loadProjectSources: vi.fn(),
    loadProjectSurface: vi.fn(),
    openProjectPage: vi.fn(),
    viewProjectStage: vi.fn(),
    returnToCurrentStage: vi.fn(),
    toggleProjectSidebar: vi.fn(),
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

const catalogStageIds = [
  'requirements', 'definition', 'investigation', 'design',
  'evaluation', 'pilot', 'production', 'improvement',
] as const

interface CatalogMethodFixture {
  readonly id: string
  readonly label: string
  readonly description: string
  readonly whenToUse: string
  readonly source: string
  readonly content: string
  readonly group?: 'required' | 'conditional'
}

interface CatalogStageFixture {
  readonly id: string
  readonly index: number
  readonly methods: readonly CatalogMethodFixture[]
}

function completeCatalogStages(): CatalogStageFixture[] {
  return catalogStageIds.map((id, index) => ({
    id,
    index,
    methods: [{
      id: `${id}-method`,
      label: `第 ${String(index + 1)} 阶段方法`,
      description: '阶段方法的业务用途。',
      whenToUse: '需要完成本阶段工作时使用。',
      source: 'fixed/source@commit',
      content: `# 第 ${String(index + 1)} 阶段方法`,
    }],
  }))
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
    ok: true,
    value: { schemaVersion: 1, stages: completeCatalogStages() },
  }), { status: 200, headers: { 'content-type': 'application/json' } })))
})

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

    await waitFor(() => { expect(fetchMock).toHaveBeenCalledTimes(1) })
    expect(screen.getAllByText('正在读取工作方法…')).toHaveLength(8)
    expect(requestSignal?.aborted).toBe(false)
  })

  it('opens every business method tree by default and opens one read-only Markdown definition', async () => {
    const stages = completeCatalogStages()
    stages[0] = {
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
    }
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      value: {
        schemaVersion: 1,
        stages,
      },
    }), { status: 200, headers: { 'content-type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    render(<ProjectContextSidebar {...sidebarProps()} />)

    expect(screen.getAllByRole('button', { name: /本阶段工作方法/ })).toHaveLength(8)
    const discoveryBranch = screen.getByText('发现高价值问题').closest('[data-active]')
    expect(discoveryBranch).toBeTruthy()
    const toggle = within(discoveryBranch as HTMLElement).getByRole('button', { name: /本阶段工作方法/ })
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    await waitFor(() => { expect(screen.getByText('项目启动与方向确认')).toBeTruthy() })
    expect(fetchMock).toHaveBeenCalledWith('/api/fde-stage/skills', expect.objectContaining({ method: 'GET' }))
    expect(screen.getAllByRole('button').filter(button => methodNames.some(([, label]) => button.textContent?.includes(label)))).toHaveLength(7)

    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByText('项目启动与方向确认')).toBeNull()
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(await screen.findByText('项目启动与方向确认')).toBeTruthy()
    expect(fetchMock).toHaveBeenCalledTimes(1)

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
    const stages = completeCatalogStages()
    stages[1] = {
      id: 'definition',
      index: 1,
      methods: ([
        ['engineer-ai-value', '算清当前成本和问题影响', 'required'],
        ['requirements-to-spec', '把成功标准写成可验收要求', 'required'],
        ['feasibility-probe', '检查现有条件是否做得到', 'required'],
        ['estimation', '估算周期、人力和主要风险', 'required'],
        ['delivery-plan', '按风险排出交付顺序', 'required'],
        ['qualify-ai-workflow', '信息不足时，返回补充业务流程', 'conditional'],
        ['reframe-ai-engagement', '现场事实变化时，重新界定项目', 'conditional'],
        ['stakeholder-brief', '需要负责人决定时，整理决策简报', 'conditional'],
        ['escalation-and-renegotiation', '范围、周期或资源冲突时，发起重谈', 'conditional'],
      ] as const).map(([id, label, group]) => ({
        id, label, group,
        description: `${label}的业务用途。`,
        whenToUse: `需要${label}时使用。`,
        source: 'fixed/source@commit',
        content: `# ${label}`,
      })),
    }
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      value: {
        schemaVersion: 1,
        stages,
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
    await waitFor(() => { expect(screen.getByRole('button', { name: /算清当前成本和问题影响/ })).toBeTruthy() })
    expect(screen.getByRole('region', { name: '必做工作' })).toBeTruthy()
    expect(screen.getByRole('region', { name: '按需处理' })).toBeTruthy()
    expect(screen.getAllByRole('button').filter(button => button.closest('[aria-label="第 2 阶段工作方法"]'))).toHaveLength(9)
    expect(screen.queryByText('项目启动与方向确认')).toBeNull()
  })

  it('opens another stage for viewing without changing the current project stage', () => {
    const input = sidebarProps()
    render(<ProjectContextSidebar {...input} />)

    fireEvent.click(screen.getByRole('button', { name: /调查数据、系统、接口、安全与组织/ }))

    expect(input.viewProjectStage).toHaveBeenCalledWith('workspace-1', 'investigation')
    expect(input.returnToCurrentStage).not.toHaveBeenCalled()
  })

  it('collapses and restores every stage method tree without changing the stage', () => {
    const input = sidebarProps()
    render(<ProjectContextSidebar {...input} />)

    expect(screen.getAllByRole('button', { name: /本阶段工作方法/ })).toHaveLength(8)
    fireEvent.click(screen.getByRole('button', { name: '一键收起所有阶段方法' }))
    expect(screen.queryAllByRole('button', { name: /本阶段工作方法/ })).toHaveLength(0)
    expect(input.viewProjectStage).not.toHaveBeenCalled()
    expect(input.returnToCurrentStage).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '展开所有阶段方法' }))
    expect(screen.getAllByRole('button', { name: /本阶段工作方法/ })).toHaveLength(8)
    expect(screen.getAllByRole('button', { name: /本阶段工作方法/ }).every(button => button.getAttribute('aria-expanded') === 'true')).toBe(true)
  })

  it('delegates one-click sidebar scaling to the shared layout', () => {
    const input = sidebarProps()
    render(<ProjectContextSidebar {...input} />)

    fireEvent.click(screen.getByRole('button', { name: '缩放项目侧栏' }))

    expect(input.toggleProjectSidebar).toHaveBeenCalledOnce()
    expect(input.viewProjectStage).not.toHaveBeenCalled()
  })

  it('marks the real current stage separately from the stage being viewed', () => {
    const input = sidebarProps()
    input.useStageView = hook({ byWorkspace: { 'workspace-1': 'investigation' } }) as typeof input.useStageView
    render(<ProjectContextSidebar {...input} />)

    expect(screen.getByText('发现高价值问题').closest('[data-active="true"]')).toBeTruthy()
    expect(screen.getByText('调查数据、系统、接口、安全与组织').closest('[data-viewing="true"]')).toBeTruthy()
    expect(screen.getByText('当前阶段')).toBeTruthy()
    expect(screen.getByText('正在查看')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '返回当前阶段' }))
    expect(input.returnToCurrentStage).toHaveBeenCalledWith('workspace-1')
  })

  it('shows the planned method count for a later stage before its catalog loads', () => {
    const input = sidebarProps()
    input.useStageView = hook({ byWorkspace: { 'workspace-1': 'investigation' } }) as typeof input.useStageView
    render(<ProjectContextSidebar {...input} />)

    const investigationBranch = screen.getByText('调查数据、系统、接口、安全与组织').closest('[data-viewing="true"]')
    expect(investigationBranch).toBeTruthy()
    expect(within(investigationBranch as HTMLElement).getByRole('button', { name: /本阶段工作方法/ }).textContent).toContain('7')
  })
})
