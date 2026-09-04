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
    loadProjectSources: vi.fn(),
    completeRequirements: vi.fn(async () => {}),
    completeV2Stage: vi.fn(async () => {}),
    returnV2Stage: vi.fn(async () => {}),
    openProjectSourceUpload: vi.fn(),
    prepareDiscoveryDraft: vi.fn(),
    prepareStageDraft: vi.fn(),
    openProjectFile: vi.fn(async () => {}),
    openProjectConversation: vi.fn(),
    viewProjectStage: vi.fn(),
    returnToCurrentStage: vi.fn(),
    openProjectPage: vi.fn(),
    t: vi.fn(),
    ...overrides,
  } as unknown as ComponentProps<typeof ProjectStageWorkbenchHero>
}

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

    expect(screen.getByRole('heading', { name: '四个现场条件必须分别有证据' })).toBeTruthy()
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
