// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { ProjectStageWorkbenchHero } from '../src/client/StageWorkbench.tsx'

afterEach(cleanup)

const hook = <T,>(snapshot: T) => <S,>(selector: (state: T) => S): S => selector(snapshot)

function props(overrides: Record<string, unknown> = {}) {
  return {
    sessionId: 'session-1',
    workspace: { workspaceId: 'workspace-1', title: '企业知识库搭建', path: '/isolated/project' },
    defaultContent: <div>官方首页</div>,
    useStageProgress: hook({
      byWorkspace: {
        'workspace-1': {
          status: 'ready',
          value: {
            workspaceId: 'workspace-1', currentStage: 'requirements', revision: 1,
            createdAt: '', updatedAt: '',
          },
        },
      },
    }),
    useProjectSurfaces: hook({ byWorkspace: {} }),
    useStageView: hook({ byWorkspace: {} }),
    useSessions: hook({ byId: { 'session-1': { running: false } } }),
    resolveEnteredProject: () => undefined,
    useProjectSources: hook({
      byWorkspace: {
        'workspace-1': {
          status: 'ready',
          files: [{
            sourceId: 'source-1', originalName: '客户访谈纪要.docx', storedName: '客户访谈纪要.docx',
            relativePath: 'fde-resources/客户访谈纪要.docx', extension: 'docx', bytes: 1024,
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            createdAt: '2026-09-01T00:00:00.000Z', modifiedAt: '2026-09-01T00:00:00.000Z',
            previewKind: 'office', fileUrl: '/api/fde-project-resources/file/source-1',
            parse: { status: 'ready', derivedPath: '.fde/derived/source-1.md' },
          }],
        },
      },
    }),
    loadStage: vi.fn(),
    loadProjectSurface: vi.fn(),
    refreshProjectSurface: vi.fn(),
    pollProjectSurface: vi.fn(),
    runProjectAction: vi.fn(async () => {}),
    openProjectCapability: vi.fn(async () => {}),
    loadProjectSources: vi.fn(),
    completeRequirements: vi.fn(async () => {}),
    completeV2Stage: vi.fn(async () => {}),
    returnV2Stage: vi.fn(async () => {}),
    openProjectSourceUpload: vi.fn(),
    prepareDiscoveryDraft: vi.fn(),
    prepareStageDraft: vi.fn(),
    configureDesignRoute: vi.fn(async () => {}),
    bindDesignSources: vi.fn(async () => {}),
    saveDesignDefinition: vi.fn(async () => {}),
    reviewDesignCandidates: vi.fn(async () => {}),
    runDesignSemantica: vi.fn(async () => {}),
    recordDesignDecision: vi.fn(async () => {}),
    openProjectFile: vi.fn(async () => {}),
    openProjectConversation: vi.fn(),
    viewProjectStage: vi.fn(),
    returnToCurrentStage: vi.fn(),
    openProjectPage: vi.fn(),
    t: vi.fn(),
    ...overrides,
  } as unknown as ComponentProps<typeof ProjectStageWorkbenchHero>
}

function evaluationProps(options: { historical?: boolean; empty?: boolean; status?: 'PASS' | 'FAIL' | 'STALE'; runtime?: 'running' | 'blocked' } = {}) {
  const ready = !options.empty && (options.status === undefined || options.status === 'PASS')
  const reviewBlockers = ready ? [] : ['当前版本缺少有效验证证据']
  const stage = {
    id: 'evaluation', index: 5, title: '运行 PoC 与 Eval', stateStatus: 'ready', statePath: '.fde/stages/evaluation.json',
    objective: 'Project evidence', explanation: '', prompt: '只准备验证记录，不开发项目、不运行测试。',
    status: ready ? 'review-ready' : 'working', recommendation: 'pending', currentWorkId: 'plan',
    requiredCount: 3, presentCount: 3, reviewReady: ready, reviewBlockers, blockers: [],
    workItems: ['plan', 'cases', 'run', 'conclusion'].map(id => ({ id, title: id, purpose: '', status: 'complete' })),
    artifacts: [{ id: 'evaluation-report', title: '验证报告', path: 'report.md', purpose: '', required: true, status: 'present' }],
    evaluation: {
      status: options.empty ? 'missing' : 'ready', reviewBlockers,
      candidate: { version: options.empty ? '' : 'candidate-r7', summary: '本轮受测业务链', sourceFiles: [{ path: 'app.ts', status: 'present' }] },
      testing: { environment: options.empty ? '' : 'local sandbox', current: ready, fingerprint: options.empty ? undefined : 'sha256:current', metrics: options.empty ? [] : [
        { id: 'latency', title: '接口响应', kind: '性能', required: true, criterion: 'P95 < 300ms', sources: [{ path: 'contract.md', status: 'present' }], status: options.status ?? 'PASS', value: '210ms', evidence: [{ path: 'evidence.txt', status: 'present' }] },
      ] },
    },
  }
  return props({
    useStageProgress: hook({ byWorkspace: { 'workspace-1': { status: 'ready', value: { workspaceId: 'workspace-1', lifecycleVersion: 2, currentStage: options.historical ? 'pilot' : 'validation', v2Stage: options.historical ? 'pilot' : 'evaluation', revision: 5 } } } }),
    useStageView: hook({ byWorkspace: options.historical ? { 'workspace-1': 'evaluation' } : {} }),
    useProjectSurfaces: hook({ byWorkspace: { 'workspace-1': { status: 'ready', value: {
      requirements: { artifacts: [] }, v2Stages: { evaluation: stage },
      runtime: { status: options.runtime ?? 'stopped', action: 'start', revision: 2, terminalTitle: 'test terminal', previewUrl: options.runtime === 'running' ? 'http://127.0.0.1:9000' : undefined },
    } } } }),
  })
}

describe('stage-five information workbench', () => {
  it('shows useful empty information without a developer panel, fake progress or a record rail', () => {
    const input = evaluationProps({ empty: true })
    const view = render(<ProjectStageWorkbenchHero {...input} />)
    expect(screen.getByRole('heading', { name: '项目运行与验证' })).toBeTruthy()
    const heroArt = view.container.querySelector('[data-evaluation-hero-art]')
    expect(heroArt?.getAttribute('aria-hidden')).toBe('true')
    expect(heroArt?.querySelector('img')?.getAttribute('src')).toBe('/fde-dashboard/evaluation-lab.webp')
    expect(screen.getByText('尚未登记受测版本')).toBeTruthy()
    expect(screen.getByText('尚无可展示的测试指标')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '开始本阶段工作' })).toBeNull()
    expect(screen.queryByRole('button', { name: '开始开发' })).toBeNull()
    expect(screen.queryByText('0%')).toBeNull()
    expect(view.container.querySelector('[aria-label="项目记录轴"]')).toBeNull()
    expect(screen.getByRole('button', { name: '提交 FDE 阶段验收' }).hasAttribute('disabled')).toBe(true)
    expect(input.prepareStageDraft).not.toHaveBeenCalled()
    expect(input.runProjectAction).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '准备验证范围与指标' }))
    expect(input.prepareStageDraft).toHaveBeenCalledWith('session-1', '只准备验证记录，不开发项目、不运行测试。')
  })

  it('renders actual metrics and uses the existing file, runtime and capability actions', async () => {
    const input = evaluationProps({ runtime: 'running' })
    render(<ProjectStageWorkbenchHero {...input} />)
    expect(screen.getByRole('heading', { name: 'candidate-r7' })).toBeTruthy()
    expect(screen.getByText('P95 < 300ms')).toBeTruthy()
    expect(screen.getByText('210ms')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'evidence.txt' }))
    await waitFor(() => { expect(input.openProjectFile).toHaveBeenCalledWith('session-1', '/isolated/project', 'evidence.txt', 'evidence.txt') })
    await waitFor(() => { expect(screen.getByRole('button', { name: '预览项目' }).hasAttribute('disabled')).toBe(false) })
    fireEvent.click(screen.getByRole('button', { name: '预览项目' }))
    await waitFor(() => { expect(input.runProjectAction).toHaveBeenCalledWith('openProjectPreview', 'workspace-1', 'session-1', '/isolated/project') })
    await waitFor(() => { expect(screen.getByRole('button', { name: '停止项目' }).hasAttribute('disabled')).toBe(false) })
    fireEvent.click(screen.getByRole('button', { name: '停止项目' }))
    await waitFor(() => { expect(input.runProjectAction).toHaveBeenCalledWith('stopProject', 'workspace-1', 'session-1', '/isolated/project') })
    await waitFor(() => { expect(screen.getByRole('button', { name: '系统架构' }).hasAttribute('disabled')).toBe(false) })
    fireEvent.click(screen.getByRole('button', { name: '系统架构' }))
    await waitFor(() => { expect(input.openProjectCapability).toHaveBeenCalledWith('workspace-1', 'fde-architecture') })
    fireEvent.click(screen.getByRole('button', { name: '在对话中验证' }))
    expect(input.prepareStageDraft).toHaveBeenCalledWith('session-1', expect.stringContaining('latency'))
    expect(input.completeV2Stage).not.toHaveBeenCalled()
  })

  it('keeps registration, issue details and the Agent entry backed by current records', () => {
    const input = evaluationProps({ empty: true })
    const view = render(<ProjectStageWorkbenchHero {...input} />)
    expect(view.container.querySelector('[data-hide-stage-composer="evaluation"]')).toBeNull()
    expect(screen.getByRole('region', { name: '登记信息' }).textContent).toContain('.fde/stages/evaluation.json')
    expect(screen.getByRole('region', { name: '登记信息' }).textContent).toContain('已生成')
    expect(screen.getByRole('region', { name: '验收材料' }).textContent).toContain('验证报告')
    const disclosure = screen.getByText('查看 1 项待核对条件详情')
    expect(disclosure.closest('details')?.textContent).toContain('当前版本缺少有效验证证据')
    fireEvent.click(screen.getByRole('button', { name: '前往 Agent 对话补充记录' }))
    expect(input.prepareStageDraft).toHaveBeenCalledWith('session-1', '只准备验证记录，不开发项目、不运行测试。')
    expect(input.runProjectAction).not.toHaveBeenCalled()
    expect(input.completeV2Stage).not.toHaveBeenCalled()
  })

  it.each(['FAIL', 'STALE'] as const)('keeps %s evidence visible and prevents stage approval', (status) => {
    render(<ProjectStageWorkbenchHero {...evaluationProps({ status })} />)
    expect(screen.getByText(status === 'FAIL' ? '失败' : '结果已过期')).toBeTruthy()
    expect(screen.getByText('210ms')).toBeTruthy()
    expect(screen.getByRole('button', { name: '提交 FDE 阶段验收' }).hasAttribute('disabled')).toBe(true)
  })

  it('requires explicit confirmation and preserves the reasoned return path', async () => {
    const input = evaluationProps()
    render(<ProjectStageWorkbenchHero {...input} />)
    fireEvent.click(screen.getByRole('button', { name: '提交 FDE 阶段验收' }))
    expect(input.completeV2Stage).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '确认并进入下一阶段' }))
    await waitFor(() => { expect(input.completeV2Stage).toHaveBeenCalledWith('workspace-1', 5, 'evaluation') })
    await waitFor(() => { expect(screen.getByRole('button', { name: '返回上一阶段' }).hasAttribute('disabled')).toBe(false) })
    fireEvent.click(screen.getByRole('button', { name: '返回上一阶段' }))
    fireEvent.change(screen.getByLabelText('返回方案阶段的原因'), { target: { value: '范围需要收窄' } })
    fireEvent.click(screen.getByRole('button', { name: '确认返回上一阶段' }))
    await waitFor(() => { expect(input.returnV2Stage).toHaveBeenCalledWith('workspace-1', 5, '范围需要收窄') })
  })

  it('keeps historical evidence readable without live runtime or approval actions', () => {
    const input = evaluationProps({ historical: true })
    const view = render(<ProjectStageWorkbenchHero {...input} />)
    expect(view.container.querySelector('[data-stage="evaluation"]')?.getAttribute('data-historical')).toBe('true')
    expect(screen.getByText('210ms')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '启动项目' })).toBeNull()
    expect(screen.queryByRole('button', { name: '前往 Agent 对话补充记录' })).toBeNull()
    expect(screen.queryByRole('button', { name: '在对话中验证' })).toBeNull()
    expect(screen.queryByRole('button', { name: '提交 FDE 阶段验收' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '返回当前阶段' }))
    expect(input.returnToCurrentStage).toHaveBeenCalledWith('workspace-1')
  })

  it('reports existing operation errors without claiming a successful start', async () => {
    const input = evaluationProps()
    input.runProjectAction = vi.fn(async () => { throw new Error('运行会话暂不可用') })
    render(<ProjectStageWorkbenchHero {...input} />)
    fireEvent.click(screen.getByRole('button', { name: '启动项目' }))
    await waitFor(() => { expect(screen.getByRole('alert').textContent).toBe('运行会话暂不可用') })
    expect(screen.getByRole('heading', { name: '未启动' })).toBeTruthy()
  })
})

describe('ProjectStageWorkbenchHero', () => {
  it('keeps the official hero outside a registered project', () => {
    render(<ProjectStageWorkbenchHero {...props({ sessionId: undefined, workspace: undefined })} />)
    expect(screen.getByText('官方首页')).toBeTruthy()
  })

  it('shows one guided stage surface without duplicating the native composer or project inputs', () => {
    const input = props()
    const view = render(<ProjectStageWorkbenchHero {...input} />)

    expect(screen.getByRole('heading', { name: '发现高价值问题' })).toBeTruthy()
    expect(view.container.querySelector('img')?.getAttribute('src')).toBe('/fde-dashboard/stage-evidence-stack-3d.webp')
    const workPath = screen.getByRole('list', { name: '第一阶段工作路径' })
    expect(workPath).toBeTruthy()
    expect(screen.getByText('当前工作 · 第 1/4 步')).toBeTruthy()
    expect(within(workPath).getByText('听客户怎么说')).toBeTruthy()
    expect(within(workPath).getByText('还原实际流程')).toBeTruthy()
    expect(within(workPath).getByText('确认是否值得做')).toBeTruthy()
    expect(within(workPath).getByText('决定下一步')).toBeTruthy()
    expect(within(workPath).getAllByRole('listitem')[0]?.getAttribute('data-status')).toBe('current')
    expect(screen.queryByText('等待前置事实')).toBeNull()
    expect(screen.getByText('待确认流程')).toBeTruthy()
    expect(screen.getByText('等待 FDE 完成本阶段判断')).toBeTruthy()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.queryByText('项目资料与现场记录')).toBeNull()
    expect(screen.queryByText('Agent 执行入口')).toBeNull()
    expect(screen.queryByText('AI FDE 执行入口')).toBeNull()
    const workbench = view.container.querySelector('[data-fde-stage-workbench]')
    expect(workbench?.getAttribute('data-conversation-composer-layout')).toBe('stage-execution')
    expect(workbench?.getAttribute('data-artifacts-collapsed')).toBe('true')
    expect(view.container.querySelector('[data-active-stage]')).toBeTruthy()
    expect(view.container.querySelector('[data-stage-decision-gate]')).toBeNull()
    expect(view.container.querySelector('[data-stage-review-action]')).toBeNull()
    expect(screen.queryByText('现场观察记录')).toBeNull()
    expect(screen.getByText((_, element) => element?.textContent === '0/3 份必备记录')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '查看第 2 阶段记录：定义结果、范围与责任' })).toBeNull()

    expect(screen.getByText('从一个最近发生的案例开始')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '继续核对说法不一致' })).toBeNull()
    const startButton = screen.getByRole('button', { name: '开始梳理真实流程' })
    fireEvent.click(startButton)
    expect(input.prepareDiscoveryDraft).toHaveBeenCalledWith('session-1', 'prepare-interview', [])

    const sourceHeading = screen.getByText('现在依据了什么')
    const outputHeading = screen.getByText('正在形成什么')
    expect(sourceHeading.compareDocumentPosition(outputHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByText('客户访谈纪要.docx')).toBeTruthy()
    expect(screen.getByText('已识别，可预览 · 1.0 KB')).toBeTruthy()
    expect(screen.getByText('客户现状记录')).toBeTruthy()
    expect(screen.getByText('待确认事项')).toBeTruthy()
    expect(screen.getByText('业务流程说明')).toBeTruthy()
    expect(screen.getByText('项目调整记录')).toBeTruthy()
    expect(screen.getAllByText(/尚未整理 ·/).length).toBe(3)
    expect(screen.getByText(/按需生成 ·/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '预览客户资料：客户访谈纪要.docx' }))
    expect(input.openProjectFile).toHaveBeenCalledWith(
      'session-1', '/isolated/project', 'fde-resources/客户访谈纪要.docx', '客户访谈纪要.docx',
    )
    fireEvent.click(screen.getByRole('button', { name: '根据客户资料开始梳理（1）' }))
    expect(input.prepareDiscoveryDraft).toHaveBeenCalledWith(
      'session-1',
      'qualify-workflow',
      ['fde-resources/客户访谈纪要.docx'],
    )
  })

  it('keeps project material optional and directs an empty project to the native composer', () => {
    const input = props({
      useProjectSources: hook({ byWorkspace: { 'workspace-1': { status: 'ready', files: [] } } }),
    })
    render(<ProjectStageWorkbenchHero {...input} />)

    expect(screen.getByText('尚未登记客户资料，可直接从真实案例开始。')).toBeTruthy()
    expect(screen.getByText('保留客户原话、已有资料和现场条件。')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /分析已上传资料/ })).toBeNull()
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('refreshes project records on entry and after the Agent finishes writing files', () => {
    let sessions = { byId: { 'session-1': { running: true } } }
    const refreshProjectSurface = vi.fn()
    const loadProjectSources = vi.fn()
    const input = props({
      useSessions: <S,>(selector: (state: typeof sessions) => S): S => selector(sessions),
      refreshProjectSurface,
      loadProjectSources,
    })
    const view = render(<ProjectStageWorkbenchHero {...input} />)

    expect(refreshProjectSurface).toHaveBeenCalledTimes(1)
    expect(refreshProjectSurface).toHaveBeenLastCalledWith('workspace-1')
    expect(loadProjectSources).toHaveBeenLastCalledWith('workspace-1', true)

    sessions = { byId: { 'session-1': { running: false } } }
    view.rerender(<ProjectStageWorkbenchHero {...input} />)

    expect(refreshProjectSurface).toHaveBeenCalledTimes(2)
    expect(loadProjectSources).toHaveBeenCalledTimes(2)
  })

  it('updates the visible current step when project records change', () => {
    let surfaces: Record<string, unknown> = { byWorkspace: {} }
    const input = props({
      useProjectSurfaces: <S,>(selector: (state: Record<string, unknown>) => S): S => selector(surfaces),
    })
    const view = render(<ProjectStageWorkbenchHero {...input} />)
    surfaces = {
      byWorkspace: {
        'workspace-1': {
          status: 'ready',
          value: {
            requirements: { artifacts: [] },
            discovery: {
              presentCount: 1,
              reviewReady: false,
              artifacts: [{
                id: 'research-report', title: '现场观察记录',
                path: 'fde-deliverables/01-requirement-research/requirement-research-report.md',
                purpose: '', required: true, status: 'present', structureState: 'starter_valid',
                evidenceState: 'unverified', version: 1, evidenceRefs: [],
              }],
            },
          },
        },
      },
    }
    view.rerender(<ProjectStageWorkbenchHero {...input} />)

    expect(screen.getByText('当前工作 · 第 2/4 步')).toBeTruthy()
    expect(screen.getByRole('heading', { name: '还原实际流程' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: '开始梳理真实流程' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '继续还原实际流程' }))
    expect(input.prepareDiscoveryDraft).toHaveBeenLastCalledWith(
      'session-1', 'restore-workflow', ['fde-resources/客户访谈纪要.docx'],
    )

    surfaces = {
      byWorkspace: {
        'workspace-1': {
          status: 'ready',
          value: {
            requirements: { artifacts: [] },
            discovery: {
              presentCount: 2, reviewReady: false,
              artifacts: [
                { id: 'research-report', title: '现场观察记录', path: 'one.md', purpose: '', required: true, status: 'present', structureState: 'starter_valid', evidenceState: 'unverified', version: 1, evidenceRefs: [] },
                { id: 'confirmation-checklist', title: '事实确认清单', path: 'two.md', purpose: '', required: true, status: 'present', structureState: 'starter_valid', evidenceState: 'unverified', version: 1, evidenceRefs: [] },
              ],
            },
          },
        },
      },
    }
    view.rerender(<ProjectStageWorkbenchHero {...input} />)
    expect(screen.getByText('当前工作 · 第 3/4 步')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '核对问题价值与责任' }))
    expect(input.prepareDiscoveryDraft).toHaveBeenLastCalledWith('session-1', 'qualify-value', [])

    surfaces = {
      byWorkspace: {
        'workspace-1': {
          status: 'ready',
          value: {
            requirements: { artifacts: [] },
            discovery: {
              presentCount: 3, reviewReady: false,
              artifacts: [
                { id: 'research-report', title: '现场观察记录', path: 'one.md', purpose: '', required: true, status: 'present', structureState: 'starter_valid', evidenceState: 'unverified', version: 1, evidenceRefs: [] },
                { id: 'confirmation-checklist', title: '事实确认清单', path: 'two.md', purpose: '', required: true, status: 'present', structureState: 'starter_valid', evidenceState: 'unverified', version: 1, evidenceRefs: [] },
                { id: 'requirement-baseline', title: '工作流章程', path: 'three.md', purpose: '', required: true, status: 'present', structureState: 'starter_valid', evidenceState: 'unverified', version: 1, evidenceRefs: [] },
              ],
            },
          },
        },
      },
    }
    view.rerender(<ProjectStageWorkbenchHero {...input} />)
    expect(screen.getByText('当前工作 · 第 4/4 步')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '整理阶段候选结论' }))
    expect(input.prepareDiscoveryDraft).toHaveBeenLastCalledWith('session-1', 'form-conclusion', [])
  })

  it('replaces ordinary stage actions with record repair when the fixed catalog is invalid', () => {
    const input = props({
      useProjectSurfaces: hook({
        byWorkspace: {
          'workspace-1': {
            status: 'ready',
            value: {
              requirements: { artifacts: [] },
              discovery: {
                presentCount: 0, reviewReady: false,
                artifacts: [{
                  id: 'research-report', title: '现场观察记录', path: 'one.md', purpose: '', required: true,
                  status: 'present', structureState: 'invalid', evidenceState: 'unverified', evidenceRefs: [],
                  message: 'Artifact Catalog 无效：固定来源版本不匹配。',
                }],
              },
            },
          },
        },
      }),
    })
    render(<ProjectStageWorkbenchHero {...input} />)

    expect(screen.getByRole('heading', { name: '修复无效的阶段记录' })).toBeTruthy()
    expect(screen.getByText('阶段记录未通过校验')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '开始梳理真实流程' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '修复阶段记录' }))
    expect(input.prepareDiscoveryDraft).toHaveBeenCalledWith('session-1', 'repair-stage-records', [])
  })

  it('reviews persisted evidence inside the project and advances only after a second FDE confirmation', async () => {
    const input = props({
      useProjectSurfaces: hook({
        byWorkspace: {
          'workspace-1': {
            status: 'ready',
            value: {
              requirements: { artifacts: [] },
              discovery: {
                question: '哪个真实工作流问题值得继续解决？',
                status: 'ready-for-review', currentWorkId: 'form-conclusion', requiredCount: 3, presentCount: 3,
                reviewReady: true, blockers: [],
                workItems: [
                  { id: 'collect-originals', title: '收集原始情况', purpose: '', status: 'complete' },
                  { id: 'restore-workflow', title: '还原真实工作', purpose: '', status: 'complete' },
                  { id: 'qualify-value', title: '核对问题价值', purpose: '', status: 'complete' },
                  { id: 'form-conclusion', title: '形成阶段结论', purpose: '', status: 'complete' },
                ],
                workflows: {
                  path: '.fde/discovery/workflows.json', status: 'ready', selectedWorkflowId: 'refund-review',
                  items: [{
                    id: 'refund-review', title: '退款申请复核', actor: '售后专员', trigger: '客户发起退款申请',
                    problem: '需要跨三个系统核对订单与履约状态。', disposition: 'selected',
                    evidence: { confirmed: 3, inferred: 1, unverified: 2 },
                    evidenceRefs: [
                      { id: 'ev-1', state: 'confirmed', kind: 'conversation', ref: 'session:test#turn-1', summary: '客户说明当前流程。' },
                    ],
                  }],
                },
                route: {
                  primaryMethod: { skill: 'qualify-ai-workflow', layer: 'method', condition: '所有候选工作流', source: { id: 'davidahmann/fde-guide', version: '060ef0f3', commit: '060ef0f3b67743b2e1fc3705763d423eae980236', license: 'Apache-2.0', artifact: 'qualify-ai-workflow' } },
                  conditionalMethod: { skill: 'reframe-ai-engagement', layer: 'method', condition: '重大冲突', source: { id: 'davidahmann/fde-guide', version: '060ef0f3', commit: '060ef0f3b67743b2e1fc3705763d423eae980236', license: 'Apache-2.0', artifact: 'reframe-ai-engagement' } },
                  engineering: [],
                },
                artifacts: [
                  { id: 'research-report', title: '现场观察记录', path: 'fde-deliverables/01-requirement-research/requirement-research-report.md', purpose: '', required: true, status: 'present', structureState: 'starter_valid', evidenceState: 'unverified', version: 1, evidenceRefs: [{ id: 'a-1', state: 'unverified', kind: 'conversation', ref: 'session:test#turn-1', summary: '待核对。' }] },
                  { id: 'confirmation-checklist', title: '事实确认清单', path: 'fde-deliverables/01-requirement-research/confirmation-checklist.md', purpose: '', required: true, status: 'present', structureState: 'starter_valid', evidenceState: 'unverified', version: 1, evidenceRefs: [{ id: 'a-2', state: 'unverified', kind: 'conversation', ref: 'session:test#turn-1', summary: '待核对。' }] },
                  { id: 'requirement-baseline', title: '工作流章程', path: 'fde-deliverables/01-requirement-research/requirement-baseline.md', purpose: '', required: true, status: 'present', structureState: 'starter_valid', evidenceState: 'unverified', version: 1, evidenceRefs: [{ id: 'a-3', state: 'unverified', kind: 'conversation', ref: 'session:test#turn-1', summary: '待核对。' }] },
                  { id: 'engagement-reframe', title: '项目重新界定记录', path: 'fde-deliverables/01-requirement-research/engagement-reframe.md', purpose: '', required: false, status: 'present', structureState: 'starter_valid', evidenceState: 'unverified', version: 1, evidenceRefs: [{ id: 'a-4', state: 'unverified', kind: 'conversation', ref: 'session:test#turn-1', summary: '客户说法不一致。' }] },
                ],
              },
            },
          },
        },
      }),
    })
    render(<ProjectStageWorkbenchHero {...input} />)

    expect(screen.getByText('候选材料已齐备')).toBeTruthy()
    expect(screen.getByText('核对记录后可提交人工阶段门。')).toBeTruthy()
    expect(screen.getByText('退款申请复核')).toBeTruthy()
    expect(screen.getByText('已确认 3 · 待核对 2')).toBeTruthy()
    expect(screen.getAllByText(/已有初稿 · v1 ·/).length).toBe(4)
    expect(screen.getByRole('button', { name: '继续核对未确认事项' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '继续核对范围冲突' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: '开始梳理真实流程' })).toBeNull()
    expect(document.querySelector('[data-active-stage]')?.contains(document.querySelector('[data-stage-review-action]'))).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: '预览阶段记录：客户现状记录' }))
    expect(input.openProjectFile).toHaveBeenCalledWith(
      'session-1', '/isolated/project',
      'fde-deliverables/01-requirement-research/requirement-research-report.md', '客户现状记录',
    )
    fireEvent.click(screen.getByRole('button', { name: '提交 FDE 评审' }))
    expect(document.querySelector('[data-stage-review-mode]')).toBeTruthy()
    expect(input.openProjectPage).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: '确认我们是否找对了要解决的问题' })).toBeTruthy()
    expect(screen.getByText('本次评审对象')).toBeTruthy()
    expect(screen.getAllByText('客户原始资料')).toHaveLength(2)
    expect(screen.getByText('请逐项作出人工判断')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '进入下一阶段' }))
    expect(document.querySelector('[data-stage-review-confirmation]')).toBeTruthy()
    expect(input.completeRequirements).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '确认并进入下一阶段' }))
    await waitFor(() => {
      expect(input.completeRequirements).toHaveBeenCalledWith('workspace-1', 1)
    })
  })

  it('guides a later V2 stage, previews its records, and leaves advancement to a second FDE confirmation', async () => {
    const definition = {
      id: 'definition', index: 2, title: '定义结果、范围与责任',
      objective: '把成功、范围、责任和停止条件说清楚。',
      explanation: '先建立当前基线，再明确谁用什么证据判断成功。',
      statePath: '.fde/stages/definition.json', skill: 'engineer-ai-value',
      prompt: '请根据第一阶段记录，定义业务结果、成功标准、范围、责任和停止条件。',
      status: 'review-ready', currentWorkId: 'ownership', recommendation: 'go',
      requiredCount: 3, presentCount: 3, reviewReady: true, reviewBlockers: [], blockers: [],
      workItems: [
        { id: 'baseline', title: '建立当前基线', purpose: '记录现状。', status: 'complete' },
        { id: 'outcome', title: '定义业务结果', purpose: '定义成功。', status: 'complete' },
        { id: 'scope', title: '划定交付范围', purpose: '明确边界。', status: 'complete' },
        { id: 'ownership', title: '确认责任与停止条件', purpose: '确认负责人。', status: 'complete' },
      ],
      artifacts: [
        { id: 'outcome-contract', title: '结果与成功标准', path: 'fde-deliverables/02-outcome-scope/outcome-contract.md', purpose: '记录结果。', required: true, status: 'present' },
        { id: 'value-case', title: '价值与成本判断', path: 'fde-deliverables/02-outcome-scope/value-case.md', purpose: '记录价值。', required: true, status: 'present' },
        { id: 'delivery-plan', title: '范围与责任计划', path: 'fde-deliverables/02-outcome-scope/delivery-plan.md', purpose: '记录范围。', required: true, status: 'present' },
      ],
      stateStatus: 'ready',
    }
    const input = props({
      useStageProgress: hook({
        byWorkspace: {
          'workspace-1': {
            status: 'ready',
            value: {
              workspaceId: 'workspace-1', currentStage: 'solution', revision: 4,
              lifecycleVersion: 2, v2Stage: 'definition', createdAt: '', updatedAt: '',
            },
          },
        },
      }),
      useProjectSurfaces: hook({
        byWorkspace: {
          'workspace-1': {
            status: 'ready',
            value: {
              requirements: { artifacts: [] },
              v2Stages: { definition },
            },
          },
        },
      }),
    })
    render(<ProjectStageWorkbenchHero {...input} />)

    expect(screen.getByRole('heading', { name: '把成功、范围、责任和停止条件说清楚。' })).toBeTruthy()
    expect(screen.getByText('3/3 项必备记录已形成')).toBeTruthy()
    expect(screen.getAllByText('确认责任与停止条件')).toHaveLength(2)
    expect(screen.getByText(/材料齐备 3\/3/)).toBeTruthy()
    expect(screen.getByText(/人工核对 2\/3/)).toBeTruthy()
    expect(screen.getByText('当前基线记录')).toBeTruthy()
    expect(screen.getByText('成功标准与交付边界')).toBeTruthy()
    expect(screen.getByText('责任人与停止条件')).toBeTruthy()
    expect(screen.getByText('阶段记录已更新 · 刚刚')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '开始本阶段工作' }))
    expect(input.prepareStageDraft).toHaveBeenCalledWith('session-1', definition.prompt)

    expect(document.querySelector('[data-stage-artifact-column]')?.getAttribute('data-collapsed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: '查看第 2 阶段记录：定义结果、范围与责任' }))
    const recordTabs = screen.getByRole('navigation', { name: '切换已有阶段记录' })
    expect(within(recordTabs).getByRole('button', { name: '01' })).toBeTruthy()
    expect(within(recordTabs).queryByRole('button', { name: '03' })).toBeNull()
    expect(screen.getAllByText('结果与成功标准')).toHaveLength(1)
    fireEvent.click(screen.getAllByRole('button', { name: '预览' })[0]!)
    expect(input.openProjectFile).toHaveBeenCalledWith(
      'session-1', '/isolated/project',
      'fde-deliverables/02-outcome-scope/outcome-contract.md', '结果与成功标准',
    )
    fireEvent.click(within(recordTabs).getByRole('button', { name: '01' }))
    expect(screen.getByText('FDE 已确认并推进到下一阶段')).toBeTruthy()
    expect(input.completeV2Stage).not.toHaveBeenCalled()
    fireEvent.click(within(recordTabs).getByRole('button', { name: '02' }))

    fireEvent.click(screen.getByRole('button', { name: '提交 FDE 评审' }))
    expect(screen.getByText('确认阶段记录和证据已经核对？')).toBeTruthy()
    expect(input.completeV2Stage).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '确认并继续' }))
    await waitFor(() => {
      expect(input.completeV2Stage).toHaveBeenCalledWith('workspace-1', 4, 'definition')
    })
  })

  it('turns second-stage review blockers into actionable business items without exposing internal paths', () => {
    const definition = {
      id: 'definition', index: 2, title: '定义结果、范围与责任',
      objective: '把成功、范围、责任和停止条件说清楚。',
      explanation: '先建立当前基线，再明确谁用什么证据判断成功。',
      statePath: '.fde/stages/definition.json', skill: 'engineer-ai-value',
      prompt: '请根据第一阶段记录，定义业务结果、成功标准、范围、责任和停止条件。',
      status: 'in-progress', currentWorkId: 'baseline', recommendation: undefined,
      requiredCount: 3, presentCount: 0, reviewReady: false,
      reviewBlockers: [
        '尚未生成阶段状态文件 .fde/stages/definition.json',
        '业务结果与范围约定尚未形成',
        '价值测算记录尚未形成',
        '交付计划尚未形成',
      ],
      blockers: [],
      workItems: [
        { id: 'baseline', title: '建立当前基线', purpose: '记录现状。', status: 'current' },
      ],
      artifacts: [
        { id: 'outcome-contract', title: '业务结果与范围约定', path: 'fde-deliverables/02-outcome-scope/outcome-contract.md', purpose: '写清业务结果、验收口径、交付范围和责任边界。', required: true, status: 'missing' },
        { id: 'value-case', title: '价值测算记录', path: 'fde-deliverables/02-outcome-scope/value-case.md', purpose: '记录当前成本、目标收益和继续投入的判断依据。', required: true, status: 'missing' },
        { id: 'delivery-plan', title: '交付计划', path: 'fde-deliverables/02-outcome-scope/delivery-plan.md', purpose: '明确周期、负责人、关键节点和停止条件。', required: true, status: 'missing' },
      ],
      stateStatus: 'missing',
    }
    const input = props({
      useStageProgress: hook({
        byWorkspace: {
          'workspace-1': {
            status: 'ready',
            value: {
              workspaceId: 'workspace-1', currentStage: 'solution', revision: 4,
              lifecycleVersion: 2, v2Stage: 'definition', createdAt: '', updatedAt: '',
            },
          },
        },
      }),
      useProjectSurfaces: hook({
        byWorkspace: {
          'workspace-1': {
            status: 'ready',
            value: { requirements: { artifacts: [] }, v2Stages: { definition } },
          },
        },
      }),
    })
    render(<ProjectStageWorkbenchHero {...input} />)

    expect(screen.getByText('评审准备')).toBeTruthy()
    expect(screen.getByRole('heading', { name: '本阶段尚未达到评审条件' })).toBeTruthy()
    expect(screen.getByText('4 项待完成')).toBeTruthy()
    expect(screen.getByText('0/3 份必备记录')).toBeTruthy()
    expect(screen.getByText('阶段进度尚未保存')).toBeTruthy()
    expect(screen.getAllByText('业务结果与范围约定')).toHaveLength(1)
    expect(screen.getAllByText('价值测算记录')).toHaveLength(1)
    expect(screen.getAllByText('交付计划')).toHaveLength(1)
    expect(screen.getAllByText('待整理')).toHaveLength(3)
    expect(screen.queryByText('.fde/stages/definition.json')).toBeNull()
    expect(screen.queryByText(/尚未生成阶段状态文件/)).toBeNull()
    expect(screen.queryByText(/尚未形成/)).toBeNull()
    expect(screen.queryByRole('button', { name: '提交 FDE 评审' })).toBeNull()
  })

  it('uses an evidence-backed environment cockpit for the active investigation stage', () => {
    const input = props({
      useStageProgress: hook({
        byWorkspace: {
          'workspace-1': {
            status: 'ready',
            value: {
              workspaceId: 'workspace-1', currentStage: 'development', revision: 5,
              lifecycleVersion: 2, v2Stage: 'investigation', createdAt: '', updatedAt: '',
            },
          },
        },
      }),
      useProjectSurfaces: hook({
        byWorkspace: {
          'workspace-1': {
            status: 'ready',
            value: {
              requirements: { artifacts: [] },
              v2Stages: {
                investigation: {
                  id: 'investigation', index: 3, title: '调查数据、系统、接口、安全与组织',
                  objective: '弄清客户现场允许做什么、现有条件能支持什么、还缺什么。',
                  explanation: '核对真实数据、系统、权限和责任，不在未知条件上设计方案。',
                  statePath: '.fde/stages/investigation.json', skill: 'access-and-onboarding',
                  prompt: '请开始最小范围的环境调查。',
                  stateStatus: 'ready', status: 'working', currentWorkId: 'systems',
                  requiredCount: 3, presentCount: 2, reviewReady: false,
                  reviewBlockers: ['安全审批人尚未确认'],
                  recommendation: 'pending',
                  workItems: [
                    { id: 'data', title: '检查数据条件', purpose: '确认数据来源和质量。', status: 'complete' },
                    { id: 'systems', title: '梳理系统与接口', purpose: '确认真实系统和接口。', status: 'current' },
                    { id: 'access', title: '核对权限与安全', purpose: '确认动作边界。', status: 'waiting' },
                    { id: 'owners', title: '确认现场责任人', purpose: '确认 Owner 和批准人。', status: 'waiting' },
                  ],
                  blockers: [{ id: 'security-owner', title: '安全审批人尚未确认', severity: 'high', status: 'open' }],
                  artifacts: [
                    { id: 'data-readiness', title: '数据可用性评估', path: 'fde-deliverables/03-environment/data-readiness.md', purpose: '记录数据条件。', required: true, status: 'present' },
                    { id: 'system-access-map', title: '系统与访问清单', path: 'fde-deliverables/03-environment/system-access-map.md', purpose: '记录系统和权限。', required: true, status: 'present' },
                    { id: 'governance-review', title: '安全与治理核对记录', path: 'fde-deliverables/03-environment/governance-review.md', purpose: '记录独立治理审查。', required: true, status: 'missing' },
                  ],
                  investigation: {
                    systems: [
                      { id: 'tickets', label: '历史工单', kind: 'data', status: 'confirmed', owner: '售后主管' },
                      { id: 'sandbox', label: '工单 Sandbox', kind: 'system', status: 'conditional', note: '仅开放只读样本。' },
                    ],
                    connections: [{ from: 'tickets', to: 'sandbox', label: '只读样本' }],
                    actionBoundaries: [{ target: '工单 Sandbox', read: 'allowed', suggest: 'allowed', draft: 'conditional', execute: 'denied' }],
                    dataFindings: [{ label: '设备 ID 缺失率', value: '17%', status: 'warning' }],
                    governanceReviews: [{ area: 'security', status: 'pending', owner: '信息安全' }],
                  },
                },
              },
            },
          },
        },
      }),
    })
    const view = render(<ProjectStageWorkbenchHero {...input} />)

    expect(screen.getByRole('heading', { name: '四个现场条件，分别留下证据' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: '真实环境中的对象和连接' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: '读取、建议、草稿和执行不能混淆' })).toBeTruthy()
    expect(screen.getAllByText('历史工单')).toHaveLength(2)
    expect(screen.getAllByText('工单 Sandbox')).toHaveLength(3)
    expect(screen.getByText('17%')).toBeTruthy()
    expect(screen.getByText('安全审批人尚未确认')).toBeTruthy()
    expect(screen.getByText('禁止')).toBeTruthy()
    expect(screen.queryByText('现在先做')).toBeNull()
    expect(view.container.querySelector('[data-stage="investigation"]')?.getAttribute('data-conversation-composer-layout')).toBe('stage-investigation')
    expect(view.container.querySelector('[data-stage="investigation"] [data-stage-artifact-column]')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: '开始环境调查' }))
    expect(input.prepareStageDraft).toHaveBeenCalledWith('session-1', '请开始最小范围的环境调查。')
    fireEvent.click(screen.getByRole('button', { name: '查看系统与访问记录' }))
    expect(input.openProjectFile).toHaveBeenCalledWith(
      'session-1', '/isolated/project',
      'fde-deliverables/03-environment/system-access-map.md', '系统与访问清单',
    )
    fireEvent.click(screen.getByRole('button', { name: '查看调查工作项：检查数据条件（数据可用性评估）' }))
    expect(input.openProjectFile).toHaveBeenLastCalledWith(
      'session-1', '/isolated/project',
      'fde-deliverables/03-environment/data-readiness.md', '数据可用性评估',
    )
    fireEvent.click(screen.getByRole('button', { name: '查看系统调查记录：工单 Sandbox（系统与访问清单）' }))
    fireEvent.click(screen.getByRole('button', { name: '查看系统连接记录：历史工单到工单 Sandbox（系统与访问清单）' }))
    fireEvent.keyDown(screen.getByRole('button', { name: '查看动作边界：工单 Sandbox（系统与访问清单）' }), { key: 'Enter' })
    expect(input.openProjectFile).toHaveBeenLastCalledWith(
      'session-1', '/isolated/project',
      'fde-deliverables/03-environment/system-access-map.md', '系统与访问清单',
    )
    fireEvent.keyDown(screen.getByRole('button', { name: '查看数据发现：设备 ID 缺失率（数据可用性评估）' }), { key: ' ' })
    expect(input.openProjectFile).toHaveBeenLastCalledWith(
      'session-1', '/isolated/project',
      'fde-deliverables/03-environment/data-readiness.md', '数据可用性评估',
    )
    expect(screen.queryByRole('button', { name: /查看治理记录：安全/ })).toBeNull()
  })

  it('renders the active ontology route and keeps preparation and run actions bound to project state', async () => {
    const design = {
      id: 'design', index: 4, title: '设计方案并完成端到端纵向切片',
      objective: '选择最合适的实现方式，并先走通一条可以验证的完整业务链路。',
      explanation: '比较实现方式，明确系统边界、失败回退并完成最小纵向切片。',
      statePath: '.fde/stages/design.json', skill: 'fde-design-vertical-slice',
      prompt: '请基于前三阶段事实完成第四阶段双轴机制判断。',
      stateStatus: 'ready', status: 'working', currentWorkId: 'slice',
      requiredCount: 3, presentCount: 2, reviewReady: false,
      reviewBlockers: ['纵向切片验证记录尚未形成'], recommendation: 'pending',
      workItems: [
        { id: 'mechanism', title: '选择实现方式', purpose: '比较实现机制。', status: 'complete' },
        { id: 'architecture', title: '明确系统边界', purpose: '明确工具与权限。', status: 'complete' },
        { id: 'slice', title: '走通纵向切片', purpose: '运行一条真实业务链路。', status: 'current' },
        { id: 'decision', title: '核对方案决定', purpose: '形成候选结论。', status: 'waiting' },
      ],
      blockers: [],
      artifacts: [
        { id: 'mechanism-selection', title: '实现方式选择记录', path: 'fde-deliverables/04-solution-design/mechanism-selection.md', purpose: '记录机制选择。', required: true, status: 'present' },
        { id: 'solution-design', title: '生产方案设计', path: 'fde-deliverables/04-solution-design/solution-design.md', purpose: '记录方案合同。', required: true, status: 'present' },
        { id: 'vertical-slice-record', title: '纵向切片验证记录', path: 'fde-deliverables/04-solution-design/vertical-slice-record.md', purpose: '记录真实运行结果。', required: true, status: 'missing' },
      ],
      design: {
        execution: { status: 'selected', mechanism: 'agent', label: '受控 Agent 工作流', rationale: '需要组合读取和候选生成。' },
        semantics: { mode: 'ontology', conclusion: 'pending', rationale: '需要实体消歧、来源时间与多跳关系。' },
        ontology: { status: 'published', schemaVersion: '0.1.0', classCount: 3, relationshipTypeCount: 2 },
        graph: {
          path: '.fde/design/knowledge-graph.json', status: 'ready', buildStatus: 'succeeded',
          snapshot: {
            schemaVersion: 1, provider: { id: 'semantica', version: '0.6.7' }, graphId: 'fde-project-graph',
            revision: 'build-17', ontologyVersion: '0.1.0', updatedAt: '2026-09-04T08:30:00.000Z',
            nodes: [
              { id: 'workflow', label: '报修业务流程', type: 'Workflow', communityId: 'delivery', confidence: 0.98, sourceRefs: ['outcome-contract.md'] },
              { id: 'system', label: '工单系统', type: 'System', communityId: 'delivery', confidence: 0.92, sourceRefs: ['system-access-map.md'] },
            ],
            edges: [{ id: 'uses', source: 'workflow', target: 'system', type: 'USES', label: '使用', weight: 1, confidence: 0.9, sourceRefs: ['system-access-map.md'] }],
            communities: [{ id: 'delivery', label: '交付闭环', level: 0, nodeIds: ['workflow', 'system'] }],
          },
        },
        workspace: {
          status: 'ready', path: '.fde/design/semantica/workspace.json', revision: 8,
          updatedAt: '2026-09-04T08:31:00.000Z', evidenceDigest: 'sha256:ontology-current',
          provider: { id: 'semantica', expectedVersion: '0.6.7', status: 'ready', version: '0.6.7' },
          route: {
            execution: { mechanism: 'agent', label: '受控 Agent 工作流', rationale: '需要组合读取和候选生成。' },
            semantics: { mode: 'ontology', rationale: '需要实体消歧、来源时间与多跳关系。' }, conclusion: 'pending',
          },
          sources: [],
          definition: {
            status: 'published', version: '0.1.0', revision: 2, digest: 'sha256:definition', updatedAt: '2026-09-04T08:10:00.000Z',
            competencyQuestions: [{ id: 'cq-workflow-system', text: '业务流程依赖哪个系统？', required: true, query: { kind: 'edge', sourceType: 'Workflow', relationshipType: 'USES', targetType: 'System', maxDepth: 1, minAnswers: 1 } }],
            classes: [
              { id: 'Workflow', label: '业务流程', aliases: ['流程'], identityKeys: ['name'], properties: [{ id: 'name', label: '名称', dataType: 'string', required: true, unique: true }], fieldMappings: [{ sourceField: '流程名称', targetProperty: 'name' }], extractionPatterns: [] },
              { id: 'System', label: '系统', aliases: [], identityKeys: ['name'], properties: [], fieldMappings: [], extractionPatterns: [] },
            ],
            relationships: [
              { id: 'USES', label: '使用', domain: 'Workflow', range: 'System', cardinality: 'many-to-many', extractionPatterns: [] },
              ...Array.from({ length: 5 }, (_, index) => ({ id: `DEPENDS_${index + 1}`, label: `依赖 ${index + 1}`, domain: 'Workflow', range: 'System', cardinality: 'many-to-many', extractionPatterns: [] })),
            ],
            provenanceRules: [{ id: 'source-required', label: '来源必填', description: '每条事实必须保留来源。' }],
            temporalRules: [{ id: 'valid-time', label: '有效时间', description: '事实必须区分有效时间。' }],
            confidenceThreshold: 0.65, shaclSeverity: 'Violation',
          },
          candidates: { status: 'ready', entities: [], relationships: [], warnings: [] },
          runs: [
            ...Array.from({ length: 6 }, (_, index) => ({ id: `health-${index}`, kind: 'health', status: 'succeeded', startedAt: `2026-09-04T06:0${index}:00.000Z`, summary: `服务检查记录 ${index}`, sourceDigests: [], evidencePaths: [`evidence/health-${index}.json`], diagnostics: [] })),
            { id: 'extract-old', kind: 'extract', status: 'succeeded', startedAt: '2026-09-04T07:00:00.000Z', summary: '上次抽取完成', sourceDigests: [], evidencePaths: [], diagnostics: [] },
            { id: 'extract-current', kind: 'extract', status: 'failed', startedAt: '2026-09-04T08:00:00.000Z', summary: '当前材料无法解析', sourceDigests: [], evidencePaths: [], diagnostics: [] },
            { id: 'publish-current', kind: 'publish-schema', status: 'stale', startedAt: '2026-09-04T08:10:00.000Z', summary: '定义变化后需要重新发布', sourceDigests: [], evidencePaths: [], diagnostics: [] },
          ],
        },
      },
    }
    const input = props({
      useStageProgress: hook({ byWorkspace: { 'workspace-1': { status: 'ready', value: {
        workspaceId: 'workspace-1', currentStage: 'development', revision: 7,
        lifecycleVersion: 2, v2Stage: 'design', createdAt: '', updatedAt: '',
      } } } }),
      useProjectSurfaces: hook({ byWorkspace: { 'workspace-1': { status: 'ready', value: {
        requirements: { artifacts: [] }, v2Stages: {
          definition: { artifacts: [
            { id: 'outcome-contract', title: '业务结果与范围约定', path: 'fde-deliverables/02-outcome-scope/outcome-contract.md', status: 'present' },
          ] },
          investigation: { artifacts: [
            { id: 'data-readiness', title: '数据可用性评估', path: 'fde-deliverables/03-environment/data-readiness.md', status: 'present' },
          ] },
          design,
        },
      } } } }),
    })
    const view = render(<ProjectStageWorkbenchHero {...input} />)

    expect(screen.getByRole('heading', { name: '先决定怎么实现，再决定是否需要本体' })).toBeTruthy()
    expect(screen.getAllByText('受控 Agent 工作流')).toHaveLength(2)
    expect(screen.getAllByText('Ontology 与知识图谱')).toHaveLength(2)
    expect(screen.getByText('阶段 02 · 业务与交付约定')).toBeTruthy()
    expect(screen.getByText('阶段 03 · 环境与访问边界')).toBeTruthy()
    expect(screen.getByText('outcome-contract.md')).toBeTruthy()
    expect(screen.getByRole('heading', { name: '从最小 Schema 到可查询的真实项目关系' })).toBeTruthy()
    expect(screen.getByText('semantica · 0.6.7')).toBeTruthy()
    expect(screen.getAllByText('2 个实体 · 1 条关系')).toHaveLength(2)
    expect(screen.getByLabelText('项目知识图谱：2 个节点，1 条关系')).toBeTruthy()
    expect(screen.getByText('当前环境无法启动三维图谱')).toBeTruthy()
    expect(screen.queryByText('现在先做')).toBeNull()
    expect(view.container.querySelector('[data-stage="design"]')?.getAttribute('data-conversation-composer-layout')).toBe('stage-execution')
    expect(view.container.querySelector('[data-stage="design"] [data-stage-artifact-column]')).toBeNull()

    const preparation = screen.getByRole('region', { name: '构建准备' })
    expect(within(preparation).getByText('尚未绑定代表材料')).toBeTruthy()
    expect(within(preparation).getByText('0 项已接受')).toBeTruthy()
    expect(within(preparation).queryByText('103')).toBeNull()
    const pipeline = within(screen.getByRole('region', { name: 'Semantica 分步运行' })).getByRole('table')
    expect(within(pipeline).getAllByRole('row')).toHaveLength(6)
    expect(within(pipeline).getByText('当前材料无法解析')).toBeTruthy()
    expect(within(pipeline).queryByText('上次抽取完成')).toBeNull()
    expect(within(pipeline).getByText('失败')).toBeTruthy()
    expect(within(pipeline).getByText('待重评')).toBeTruthy()
    expect(within(pipeline).getByRole('button', { name: '运行：抽取候选' }).hasAttribute('disabled')).toBe(true)
    expect(within(pipeline).getByRole('button', { name: '运行：构建项目图谱' }).hasAttribute('disabled')).toBe(true)
    const relations = screen.getByRole('table', { name: '关系定义' })
    expect(within(relations).getAllByRole('row')).toHaveLength(6)
    expect(within(relations).queryByText('DEPENDS_5')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '查看全部关系定义' }))
    expect(within(relations).getAllByRole('row')).toHaveLength(7)
    expect(within(relations).getByText('DEPENDS_5')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '收起关系定义' }))
    expect(within(relations).getAllByRole('row')).toHaveLength(6)
    const evidence = screen.getByRole('table', { name: '运行证据' })
    expect(within(evidence).getAllByRole('row')).toHaveLength(9)
    expect(within(evidence).queryByText('服务检查记录 0')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '查看全部 9 次运行' }))
    expect(within(evidence).getAllByRole('row')).toHaveLength(10)
    const oldestRun = within(evidence).getByText('服务检查记录 0').closest('tr')!
    fireEvent.click(within(oldestRun).getByRole('button', { name: /证据 1/ }))
    expect(input.openProjectFile).toHaveBeenCalledWith('session-1', '/isolated/project', 'evidence/health-0.json', expect.any(String))
    fireEvent.click(screen.getByRole('button', { name: '收起，显示最近 8 次运行' }))
    expect(within(evidence).getAllByRole('row')).toHaveLength(9)
    expect(screen.getByRole('button', { name: '选择问题并查询' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: '交给 Agent 实现并运行' }).hasAttribute('disabled')).toBe(true)
    expect(input.runDesignSemantica).not.toHaveBeenCalled()
    expect(input.completeV2Stage).not.toHaveBeenCalled()
    fireEvent.click(within(pipeline).getByRole('button', { name: '运行：发布 Ontology' }))
    await waitFor(() => expect(input.runDesignSemantica).toHaveBeenCalledWith('workspace-1', 'publish-schema', undefined))
    await waitFor(() => expect(within(preparation).getByRole('button', { name: '检查本地服务' }).hasAttribute('disabled')).toBe(false))
    fireEvent.click(within(preparation).getByRole('button', { name: '检查本地服务' }))
    await waitFor(() => expect(input.runDesignSemantica).toHaveBeenCalledWith('workspace-1', 'health', undefined))
    await waitFor(() => expect(within(preparation).getByRole('button', { name: '检查本地服务' }).hasAttribute('disabled')).toBe(false))
    fireEvent.click(within(preparation).getByRole('button', { name: '选择项目材料' }))
    expect(screen.getByRole('dialog', { name: '绑定项目材料' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    fireEvent.click(within(preparation).getByRole('button', { name: '查看候选与来源' }))
    expect(screen.getByRole('dialog', { name: '审核候选知识' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '取消' }))

    expect(screen.queryByRole('button', { name: '开始本阶段工作' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '审阅与编辑定义' }))
    expect(screen.getByRole('dialog', { name: '编辑 Ontology 定义' })).toBeTruthy()
    expect(screen.getByText('类、属性、别名与字段映射')).toBeTruthy()
    expect(screen.getByDisplayValue('流程')).toBeTruthy()
    expect(screen.getByDisplayValue('流程名称')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    fireEvent.click(screen.getByRole('button', { name: '调整路线' }))
    expect(screen.getByRole('dialog', { name: '双轴机制判断' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    fireEvent.click(screen.getByRole('button', { name: '查看前序记录：业务结果与范围约定' }))
    expect(input.openProjectFile).toHaveBeenCalledWith(
      'session-1', '/isolated/project',
      'fde-deliverables/02-outcome-scope/outcome-contract.md', '业务结果与范围约定',
    )
    fireEvent.click(screen.getAllByRole('button', { name: '查看' })[0]!)
    expect(input.openProjectFile).toHaveBeenCalledWith(
      'session-1', '/isolated/project',
      'fde-deliverables/04-solution-design/mechanism-selection.md', '实现方式选择记录',
    )
  })

  it('keeps the simple design route free of graph placeholders and demo nodes', () => {
    const input = props({
      useStageProgress: hook({ byWorkspace: { 'workspace-1': { status: 'ready', value: {
        workspaceId: 'workspace-1', currentStage: 'development', revision: 7,
        lifecycleVersion: 2, v2Stage: 'design', createdAt: '', updatedAt: '',
      } } } }),
      useProjectSurfaces: hook({ byWorkspace: { 'workspace-1': { status: 'ready', value: {
        requirements: { artifacts: [] },
        v2Stages: { design: {
          id: 'design', index: 4, title: '设计方案并完成端到端纵向切片',
          objective: '选择最合适的实现方式，并走通最小闭环。', explanation: '不默认采用本体。',
          statePath: '.fde/stages/design.json', skill: 'fde-design-vertical-slice', prompt: '开始第四阶段。',
          stateStatus: 'ready', status: 'working', currentWorkId: 'architecture', requiredCount: 3, presentCount: 1,
          reviewReady: false, reviewBlockers: ['生产方案设计尚未形成'], recommendation: 'pending', blockers: [],
          workItems: [
            { id: 'mechanism', title: '选择实现方式', purpose: '比较机制。', status: 'complete' },
            { id: 'architecture', title: '明确系统边界', purpose: '形成开发 Spec。', status: 'current' },
            { id: 'slice', title: '走通纵向切片', purpose: '运行闭环。', status: 'waiting' },
            { id: 'decision', title: '核对方案决定', purpose: '形成决定。', status: 'waiting' },
          ],
          artifacts: [
            { id: 'mechanism-selection', title: '实现方式选择记录', path: 'mechanism-selection.md', purpose: '记录机制。', required: true, status: 'present' },
            { id: 'solution-design', title: '生产方案设计', path: 'solution-design.md', purpose: '记录 Spec。', required: true, status: 'missing' },
            { id: 'vertical-slice-record', title: '纵向切片验证记录', path: 'vertical-slice-record.md', purpose: '记录运行。', required: true, status: 'missing' },
          ],
          design: {
            execution: { status: 'selected', mechanism: 'software', label: '普通软件与规则' },
            semantics: { mode: 'schema', conclusion: 'not_required', rationale: '普通数据合同足以回答当前问题。' },
            ontology: { status: 'not_applicable' },
            graph: { path: '.fde/design/knowledge-graph.json', status: 'not_applicable', buildStatus: 'not_applicable' },
          },
        } },
      } } } }),
    })
    render(<ProjectStageWorkbenchHero {...input} />)

    expect(screen.getByRole('heading', { name: '用开发 Spec 与普通 Schema 跑通最小闭环' })).toBeTruthy()
    expect(screen.getAllByText('不需要图谱').length).toBeGreaterThan(0)
    expect(screen.queryByRole('heading', { name: '从最小 Schema 到可查询的真实项目关系' })).toBeNull()
    expect(screen.queryByLabelText(/项目知识图谱/)).toBeNull()
    expect(screen.queryByText('尚未形成项目知识图谱快照')).toBeNull()
    expect(screen.queryByText('示例节点')).toBeNull()
  })

  it('records an explicit version-bound FDE decision and advances only for Go', async () => {
    const recordDesignDecision = vi.fn(async () => {})
    const completeV2Stage = vi.fn(async () => {})
    const semanticWorkspace = {
      status: 'ready', path: '.fde/design/semantica/workspace.json', revision: 12,
      updatedAt: '2026-09-04T10:00:00.000Z', evidenceDigest: 'sha256:current',
      provider: { id: 'semantica', expectedVersion: '0.6.7', status: 'unchecked' },
      route: {
        execution: { mechanism: 'software', label: '普通软件与规则', rationale: '确定性合同足够。' },
        semantics: { mode: 'schema', rationale: '不需要图推理。' }, conclusion: 'not_required',
      },
      sources: [],
      definition: { status: 'missing', version: '0.1.0', revision: 0, competencyQuestions: [], classes: [], relationships: [], provenanceRules: [], temporalRules: [], confidenceThreshold: 0.65, shaclSeverity: 'Violation' },
      candidates: { status: 'not_run', entities: [], relationships: [], warnings: [] },
      runs: [{ id: 'slice-1', kind: 'slice', status: 'succeeded', startedAt: '2026-09-04T09:50:00.000Z', completedAt: '2026-09-04T09:50:00.000Z', sourceDigests: [], summary: '真实切片已通过', evidencePaths: ['evidence/slice.log'], diagnostics: [] }],
      slice: { runId: 'slice-1', status: 'succeeded', createdAt: '2026-09-04T09:50:00.000Z', task: '运行最窄链路', result: '得到可验证结果', evidenceRefs: ['evidence/slice.log'], diagnostics: [] },
    }
    const design = {
      id: 'design', index: 4, title: '设计方案并完成端到端纵向切片', objective: '走通最小闭环。', explanation: '验证真实方案。',
      statePath: '.fde/stages/design.json', skill: 'fde-design-vertical-slice', prompt: '开始第四阶段。',
      stateStatus: 'ready', status: 'review-ready', currentWorkId: 'decision', requiredCount: 3, presentCount: 3,
      reviewReady: true, reviewBlockers: [], recommendation: 'go', blockers: [],
      workItems: [{ id: 'decision', title: '核对方案决定', purpose: '形成决定。', status: 'current' }],
      artifacts: [
        { id: 'mechanism-selection', title: '实现方式选择记录', path: 'mechanism-selection.md', purpose: '记录机制。', required: true, status: 'present' },
        { id: 'solution-design', title: '生产方案设计', path: 'solution-design.md', purpose: '记录 Spec。', required: true, status: 'present' },
        { id: 'vertical-slice-record', title: '纵向切片验证记录', path: 'vertical-slice-record.md', purpose: '记录运行。', required: true, status: 'present' },
      ],
      design: {
        execution: { status: 'selected', mechanism: 'software', label: '普通软件与规则', rationale: '确定性合同足够。' },
        semantics: { mode: 'schema', conclusion: 'not_required', rationale: '不需要图推理。' },
        ontology: { status: 'not_applicable' }, graph: { path: '.fde/design/knowledge-graph.json', status: 'not_applicable', buildStatus: 'not_applicable' },
        workspace: semanticWorkspace,
      },
    }
    const input = props({
      recordDesignDecision, completeV2Stage,
      useStageProgress: hook({ byWorkspace: { 'workspace-1': { status: 'ready', value: {
        workspaceId: 'workspace-1', currentStage: 'development', revision: 7,
        lifecycleVersion: 2, v2Stage: 'design', createdAt: '', updatedAt: '',
      } } } }),
      useProjectSurfaces: hook({ byWorkspace: { 'workspace-1': { status: 'ready', value: {
        requirements: { artifacts: [] }, v2Stages: { design },
      } } } }),
    })
    render(<ProjectStageWorkbenchHero {...input} />)

    fireEvent.click(screen.getByRole('button', { name: '提交 FDE 决定' }))
    fireEvent.click(screen.getByRole('button', { name: /Revise/ }))
    fireEvent.change(screen.getByLabelText('决定依据'), { target: { value: '当前接口合同仍需修订，暂不推进。' } })
    fireEvent.click(screen.getByRole('button', { name: /保存 Revise/ }))
    await waitFor(() => {
      expect(recordDesignDecision).toHaveBeenCalledWith('workspace-1', 12, 'revise', '当前接口合同仍需修订，暂不推进。')
    })
    expect(completeV2Stage).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '提交 FDE 决定' }))
    fireEvent.click(screen.getByRole('button', { name: /^Go/ }))
    fireEvent.change(screen.getByLabelText('决定依据'), { target: { value: '当前证据齐备，同意进入 PoC 与 Eval。' } })
    fireEvent.click(screen.getByRole('button', { name: '保存 Go 并进入下一阶段' }))
    await waitFor(() => {
      expect(recordDesignDecision).toHaveBeenLastCalledWith('workspace-1', 12, 'go', '当前证据齐备，同意进入 PoC 与 Eval。')
      expect(completeV2Stage).toHaveBeenCalledWith('workspace-1', 7, 'design')
    })
  })

  it('keeps the completed investigation cockpit visible as a read-only historical stage', () => {
    const input = props({
      useStageProgress: hook({
        byWorkspace: {
          'workspace-1': {
            status: 'ready',
            value: {
              workspaceId: 'workspace-1', currentStage: 'development', revision: 6,
              lifecycleVersion: 2, v2Stage: 'design', createdAt: '', updatedAt: '',
            },
          },
        },
      }),
      useStageView: hook({ byWorkspace: { 'workspace-1': 'investigation' } }),
      useProjectSurfaces: hook({
        byWorkspace: {
          'workspace-1': {
            status: 'ready',
            value: {
              requirements: { artifacts: [] },
              v2Stages: {
                investigation: {
                  id: 'investigation', index: 3, title: '调查数据、系统、接口、安全与组织',
                  objective: '判断客户问题真实性的关键信息是否齐全。',
                  explanation: '核对数据质量、系统边界、接口能力和现场责任人。',
                  statePath: '.fde/stages/investigation.json', skill: 'access-and-onboarding',
                  prompt: '请开始最小范围的环境调查。',
                  stateStatus: 'ready', status: 'review-ready', currentWorkId: 'systems',
                  requiredCount: 1, presentCount: 1, reviewReady: true,
                  reviewBlockers: [], recommendation: 'go',
                  workItems: [
                    { id: 'systems', title: '梳理系统与接口', purpose: '确认真实系统和接口。', status: 'complete' },
                  ],
                  blockers: [{
                    id: 'store-net-read',
                    title: 'StoreNet 告警读取未批（AR-304，~5 工作日）——不阻塞当前只读调查，阻塞下一阶段网络告警读回',
                    severity: 'high',
                    status: 'open',
                  }],
                  artifacts: [
                    { id: 'system-access-map', title: '系统与访问清单', path: 'fde-deliverables/03-environment/system-access-map.md', purpose: '记录系统和权限。', required: true, status: 'present' },
                  ],
                  investigation: {
                    systems: [{ id: 'tickets', label: 'WorkOrder Pro 7', kind: 'system', status: 'confirmed', owner: '林哲' }],
                    connections: [],
                    actionBoundaries: [{ target: 'WorkOrder 历史工单导出', read: 'allowed', suggest: 'not-applicable', draft: 'not-applicable', execute: 'denied' }],
                    dataFindings: [{ label: '评估标签隔离', value: 'final_domain 不进入候选上下文', status: 'confirmed' }],
                    governanceReviews: [{ area: 'security', status: 'confirmed', owner: '信息安全团队' }],
                  },
                },
              },
            },
          },
        },
      }),
    })
    const view = render(<ProjectStageWorkbenchHero {...input} />)

    const workbench = view.container.querySelector('[data-stage="investigation"]')
    expect(workbench?.getAttribute('data-historical')).toBe('true')
    expect(workbench?.getAttribute('data-hide-stage-composer')).toBe('true')
    expect(workbench?.getAttribute('data-conversation-composer-layout')).toBe('stage-history')
    expect(screen.getByText('阶段完成记录')).toBeTruthy()
    expect(screen.getByRole('heading', { name: '四个现场条件，分别留下证据' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: '真实环境中的对象和连接' })).toBeTruthy()
    expect(screen.getByText('WorkOrder Pro 7')).toBeTruthy()
    expect(screen.getByText('环境证据已确认，阶段记录已封存')).toBeTruthy()
    expect(screen.queryByText('4 项待确认事项 · 保留影响边界')).toBeNull()
    expect(screen.getByText('1 项待确认事项 · 保留影响边界')).toBeTruthy()
    expect(screen.getByText('StoreNet 告警读取未批')).toBeTruthy()
    expect(screen.getByText('AR-304 · 约 5 工作日')).toBeTruthy()
    expect(screen.getByText('不阻塞当前只读调查，阻塞下一阶段网络告警读回')).toBeTruthy()
    expect(screen.queryByText('从输入依据到人工结论')).toBeNull()
    expect(screen.queryByRole('button', { name: '开始环境调查' })).toBeNull()
    expect(screen.queryByRole('button', { name: '刷新调查记录' })).toBeNull()
    expect(screen.queryByRole('button', { name: '提交 FDE 评审' })).toBeNull()
    expect(screen.queryByRole('button', { name: '返回上一阶段' })).toBeNull()
    expect(screen.queryByRole('button', { name: '只读记录' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: '梳理系统与接口' }))
    expect(input.openProjectFile).toHaveBeenLastCalledWith(
      'session-1', '/isolated/project',
      'fde-deliverables/03-environment/system-access-map.md', '系统与访问清单',
    )

    fireEvent.click(screen.getByRole('button', { name: /返回当前阶段/ }))
    expect(input.returnToCurrentStage).toHaveBeenCalledWith('workspace-1')
    expect(input.completeV2Stage).not.toHaveBeenCalled()
    expect(input.returnV2Stage).not.toHaveBeenCalled()
  })

  it('keeps the completed second-stage workspace visible and read only after advancing', () => {
    const definition = {
      id: 'definition', index: 2, title: '定义结果、范围与责任',
      objective: '把成功、范围、责任和停止条件说清楚。',
      explanation: '先建立当前基线，再明确谁用什么证据判断成功。',
      statePath: '.fde/stages/definition.json', skill: 'engineer-ai-value',
      prompt: '请根据第一阶段记录，定义业务结果、成功标准、范围、责任和停止条件。',
      status: 'complete', currentWorkId: 'ownership', recommendation: 'go',
      requiredCount: 3, presentCount: 3, reviewReady: true, reviewBlockers: [], blockers: [],
      workItems: [
        { id: 'baseline', title: '建立当前基线', purpose: '记录现状。', status: 'complete' },
        { id: 'outcome', title: '定义业务结果', purpose: '定义成功。', status: 'complete' },
        { id: 'scope', title: '划定交付范围', purpose: '明确边界。', status: 'complete' },
        { id: 'ownership', title: '确认责任与停止条件', purpose: '确认负责人。', status: 'complete' },
      ],
      artifacts: [
        { id: 'outcome-contract', title: '结果与成功标准', path: 'fde-deliverables/02-outcome-scope/outcome-contract.md', purpose: '记录结果。', required: true, status: 'present' },
        { id: 'value-case', title: '价值与成本判断', path: 'fde-deliverables/02-outcome-scope/value-case.md', purpose: '记录价值。', required: true, status: 'present' },
        { id: 'delivery-plan', title: '范围与责任计划', path: 'fde-deliverables/02-outcome-scope/delivery-plan.md', purpose: '记录范围。', required: true, status: 'present' },
      ],
      stateStatus: 'ready',
    }
    const input = props({
      useStageProgress: hook({
        byWorkspace: {
          'workspace-1': {
            status: 'ready',
            value: {
              workspaceId: 'workspace-1', currentStage: 'development', revision: 7,
              lifecycleVersion: 2, v2Stage: 'design', createdAt: '', updatedAt: '',
            },
          },
        },
      }),
      useStageView: hook({ byWorkspace: { 'workspace-1': 'definition' } }),
      useProjectSurfaces: hook({
        byWorkspace: {
          'workspace-1': {
            status: 'ready',
            value: { requirements: { artifacts: [] }, v2Stages: { definition } },
          },
        },
      }),
    })
    const view = render(<ProjectStageWorkbenchHero {...input} />)

    const workbench = view.container.querySelector('[data-stage="definition"]')
    expect(workbench?.getAttribute('data-historical')).toBe('true')
    expect(workbench?.getAttribute('data-conversation-composer-layout')).toBe('stage-history')
    expect(screen.getAllByText('阶段完成记录')).toHaveLength(2)
    expect(screen.getByRole('heading', { name: definition.objective })).toBeTruthy()
    expect(screen.getByText('材料与人工决定已封存')).toBeTruthy()
    expect(screen.getByText(/人工核对 3\/3/)).toBeTruthy()
    expect(screen.getByText('当前基线记录')).toBeTruthy()
    expect(screen.getByText('成功标准与交付边界')).toBeTruthy()
    expect(screen.getByText('责任人与停止条件')).toBeTruthy()
    expect(screen.queryByText('从输入依据到人工结论')).toBeNull()
    expect(screen.queryByRole('button', { name: '开始本阶段工作' })).toBeNull()
    expect(screen.queryByRole('button', { name: '刷新阶段记录' })).toBeNull()
    expect(screen.queryByRole('button', { name: '提交 FDE 评审' })).toBeNull()
    expect(screen.queryByRole('button', { name: '返回上一阶段' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /返回当前阶段/ }))
    expect(input.returnToCurrentStage).toHaveBeenCalledWith('workspace-1')
    expect(input.completeV2Stage).not.toHaveBeenCalled()
    expect(input.returnV2Stage).not.toHaveBeenCalled()
  })

  it('shows a future stage as not started without presenting planned work as completed activity', () => {
    const input = props({
      useStageView: hook({ byWorkspace: { 'workspace-1': 'investigation' } }),
      useProjectSurfaces: hook({
        byWorkspace: {
          'workspace-1': {
            status: 'ready',
            value: {
              requirements: { artifacts: [] },
              v2Stages: {
                investigation: {
                  id: 'investigation', index: 3, title: '调查数据、系统、接口、安全与组织',
                  objective: '弄清真实环境允许什么、缺少什么。',
                  explanation: '核对数据、系统、接口、权限和组织条件。',
                  workItems: [
                    { id: 'systems', title: '盘点现有系统', purpose: '确认已有系统和接口。', status: 'waiting' },
                  ],
                  artifacts: [
                    { id: 'system-map', title: '系统与接口清单', path: 'fde-deliverables/03-investigation/system-map.md', purpose: '记录现有系统与接口。', required: true, status: 'missing' },
                  ],
                },
              },
            },
          },
        },
      }),
    })
    render(<ProjectStageWorkbenchHero {...input} />)

    expect(screen.getByText('未开始阶段')).toBeTruthy()
    expect(screen.getByText(/项目当前在“发现高价值问题”/)).toBeTruthy()
    expect(screen.getByRole('heading', { name: '调查数据、系统、接口、安全与组织' })).toBeTruthy()
    expect(screen.getByText('从前置条件到人工阶段门')).toBeTruthy()
    expect(screen.getByText('等待前置阶段完成')).toBeTruthy()
    expect(screen.getByText('先完成此前阶段并由 FDE 确认')).toBeTruthy()
    expect(screen.getByText('系统与接口清单')).toBeTruthy()
    expect(screen.queryByText('盘点现有系统')).toBeNull()
    expect(screen.queryByText('会依次做什么')).toBeNull()
    expect(screen.queryByRole('button', { name: '开始本阶段工作' })).toBeNull()
    expect(screen.queryByRole('button', { name: '提交 FDE 评审' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: '返回当前阶段' }))
    expect(input.returnToCurrentStage).toHaveBeenCalledWith('workspace-1')
    expect(input.completeV2Stage).not.toHaveBeenCalled()
  })

  it('reviews a completed stage from real inputs, outputs, and the FDE gate conclusion', () => {
    const input = props({
      useStageProgress: hook({
        byWorkspace: {
          'workspace-1': {
            status: 'ready',
            value: {
              workspaceId: 'workspace-1', currentStage: 'development', revision: 6,
              createdAt: '', updatedAt: '', lifecycleVersion: 2, v2Stage: 'investigation',
            },
          },
        },
      }),
      useStageView: hook({ byWorkspace: { 'workspace-1': 'definition' } }),
      useProjectSurfaces: hook({
        byWorkspace: {
          'workspace-1': {
            status: 'ready',
            value: {
              requirements: { artifacts: [] },
              discovery: {
                artifacts: [{
                  id: 'requirement-baseline', title: '工作流章程',
                  path: 'fde-deliverables/01-requirement-research/requirement-baseline.md',
                  purpose: '确认候选工作流。', required: true, status: 'present',
                  structureState: 'complete_valid', evidenceState: 'confirmed', evidenceRefs: [],
                }],
                workflows: { items: [], status: 'ready' }, blockers: [],
              },
              v2Stages: {
                definition: {
                  id: 'definition', index: 2, title: '定义结果、范围与责任',
                  objective: '把成功、范围和责任说清楚。', explanation: '形成可复核的项目边界。',
                  recommendation: 'go', blockers: [],
                  artifacts: [{
                    id: 'outcome-contract', title: '结果与成功标准',
                    path: 'fde-deliverables/02-outcome-scope/outcome-contract.md',
                    purpose: '记录业务结果与判断口径。', required: true, status: 'present',
                  }],
                },
              },
            },
          },
        },
      }),
    })
    render(<ProjectStageWorkbenchHero {...input} />)

    expect(screen.getByText('阶段完成记录')).toBeTruthy()
    expect(screen.getByText('从输入依据到人工结论')).toBeTruthy()
    expect(screen.getByRole('heading', { name: '定义结果、范围与责任' })).toBeTruthy()
    expect(screen.getByText('当时依据了什么')).toBeTruthy()
    expect(screen.getByText('业务流程说明')).toBeTruthy()
    expect(screen.getByText('已经留下什么')).toBeTruthy()
    expect(screen.getByText('结果与成功标准')).toBeTruthy()
    expect(screen.getByText('已通过 FDE 人工阶段门')).toBeTruthy()
    expect(screen.getByText('项目随后进入“调查数据、系统、接口、安全与组织”。')).toBeTruthy()
    expect(screen.getByLabelText('阶段封存轨迹')).toBeTruthy()
    expect(screen.getByText('查看全部阶段记录')).toBeTruthy()
    expect(screen.getByText('继续推进')).toBeTruthy()
    expect(screen.queryByText('会依次做什么')).toBeNull()
    expect(screen.queryByRole('button', { name: '开始本阶段工作' })).toBeNull()
  })
})
