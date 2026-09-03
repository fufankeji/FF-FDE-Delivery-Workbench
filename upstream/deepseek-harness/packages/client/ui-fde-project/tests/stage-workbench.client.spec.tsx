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

    expect(screen.getByRole('heading', { name: '先弄清客户现在怎么做、哪里出了问题，再决定先解决什么。' })).toBeTruthy()
    const workPath = screen.getByRole('list', { name: '第一阶段工作路径' })
    expect(workPath).toBeTruthy()
    expect(screen.getByText('本阶段进度')).toBeTruthy()
    expect(screen.getByText('第 1/4 步')).toBeTruthy()
    expect(within(workPath).getByText('听客户怎么说')).toBeTruthy()
    expect(within(workPath).getByText('还原实际流程')).toBeTruthy()
    expect(within(workPath).getByText('确认是否值得做')).toBeTruthy()
    expect(within(workPath).getByText('决定下一步')).toBeTruthy()
    expect(within(workPath).getByText('正在进行')).toBeTruthy()
    expect(within(workPath).getByText('下一步')).toBeTruthy()
    expect(screen.queryByText('等待前置事实')).toBeNull()
    expect(screen.getByText('待确认业务流程')).toBeTruthy()
    expect(screen.getByText('还没有识别出具体流程')).toBeTruthy()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.queryByText('项目资料与现场记录')).toBeNull()
    expect(screen.queryByText('Agent 执行入口')).toBeNull()
    expect(screen.queryByText('AI FDE 执行入口')).toBeNull()
    const workbench = view.container.querySelector('[data-fde-stage-workbench]')
    const execution = view.container.querySelector('[data-stage-execution-column]')
    const artifacts = view.container.querySelector('[data-stage-artifact-column]')
    expect(workbench?.getAttribute('data-conversation-composer-layout')).toBe('stage-execution')
    expect(execution).toBeTruthy()
    expect(artifacts).toBeTruthy()
    expect(view.container.querySelector('[data-stage-decision-gate]')).toBeNull()
    expect(view.container.querySelector('[data-stage-review-action]')).toBeNull()
    expect(artifacts?.getAttribute('data-collapsed')).toBe('true')
    expect(screen.queryByText('现场观察记录')).toBeNull()
    const currentRecord = screen.getByRole('button', { name: '查看第 1 阶段记录：发现高价值问题' })
    expect(within(currentRecord).getByText('0/3')).toBeTruthy()
    expect(currentRecord.getAttribute('data-tooltip')).toBe('第 1 阶段 · 发现高价值问题 · 当前阶段 · 0/3 项必备记录')
    expect(screen.queryByRole('button', { name: '查看第 2 阶段记录：定义结果、范围与责任' })).toBeNull()

    expect(screen.getByText('从一个最近发生的案例开始')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '继续核对说法不一致' })).toBeNull()
    const startButton = screen.getByRole('button', { name: '开始梳理真实流程' })
    fireEvent.click(startButton)
    expect(input.prepareDiscoveryDraft).toHaveBeenCalledWith('session-1', 'prepare-interview', [])

    fireEvent.click(currentRecord)
    expect(artifacts?.getAttribute('data-collapsed')).toBeNull()
    const sourceHeading = screen.getByText('当时依据了什么')
    const outputHeading = screen.getByText('留下了什么')
    expect(sourceHeading.compareDocumentPosition(outputHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByText('客户访谈纪要.docx')).toBeTruthy()
    expect(screen.getByText('1.0 KB · 已识别，可预览')).toBeTruthy()
    expect(screen.getByText('客户现状记录')).toBeTruthy()
    expect(screen.getByText('待确认事项')).toBeTruthy()
    expect(screen.getByText('业务流程说明')).toBeTruthy()
    expect(screen.getByText('项目调整记录')).toBeTruthy()
    expect(screen.getAllByText('0/3').length).toBeGreaterThan(0)
    expect(screen.getAllByText('尚未整理').length).toBe(3)
    expect(screen.getByText('按需生成')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '预览客户资料：客户访谈纪要.docx' }))
    expect(input.openProjectFile).toHaveBeenCalledWith(
      'session-1', '/isolated/project', 'fde-resources/客户访谈纪要.docx', '客户访谈纪要.docx',
    )
    fireEvent.click(screen.getByRole('button', { name: '收起项目记录' }))
    expect(artifacts?.getAttribute('data-collapsed')).toBe('true')
    expect(screen.queryByText('客户现状记录')).toBeNull()

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

    expect(screen.getByText('还没有识别出具体流程')).toBeTruthy()
    expect(screen.getByText(/先说清客户目前怎么做/)).toBeTruthy()
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

  it('returns the execution column to the stage goal when the current work changes', () => {
    let surfaces: Record<string, unknown> = { byWorkspace: {} }
    const input = props({
      useProjectSurfaces: <S,>(selector: (state: Record<string, unknown>) => S): S => selector(surfaces),
    })
    const view = render(<ProjectStageWorkbenchHero {...input} />)
    const execution = view.container.querySelector<HTMLElement>('[data-stage-execution-column]')
    expect(execution).toBeTruthy()
    if (execution === null) return

    execution.scrollTop = 144
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

    expect(execution.scrollTop).toBe(0)
    expect(screen.getByText('第 2/4 步')).toBeTruthy()
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

    fireEvent.click(screen.getByRole('button', { name: '查看第 1 阶段记录：发现高价值问题' }))
    expect(screen.getByText('候选材料已齐备')).toBeTruthy()
    expect(screen.getByText('请先阅读记录，再由 FDE 决定是否推进。')).toBeTruthy()
    expect(screen.getByText('退款申请复核')).toBeTruthy()
    expect(screen.getByText('已确认 3')).toBeTruthy()
    expect(screen.getByText('待核对 2')).toBeTruthy()
    expect(screen.getAllByText('已有初稿 · v1').length).toBe(4)
    expect(screen.getByRole('button', { name: '继续核对说法不一致' })).toBeTruthy()
    expect(document.querySelector('[data-stage-artifact-column]')?.contains(document.querySelector('[data-stage-review-action]'))).toBe(true)
    fireEvent.click(screen.getAllByRole('button', { name: '预览' })[0]!)
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
    fireEvent.click(screen.getByRole('button', { name: '开始本阶段工作' }))
    expect(input.prepareStageDraft).toHaveBeenCalledWith('session-1', definition.prompt)

    expect(document.querySelector('[data-stage-artifact-column]')?.getAttribute('data-collapsed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: '查看第 2 阶段记录：定义结果、范围与责任' }))
    const recordTabs = screen.getByRole('navigation', { name: '切换已有阶段记录' })
    expect(within(recordTabs).getByRole('button', { name: '01' })).toBeTruthy()
    expect(within(recordTabs).queryByRole('button', { name: '03' })).toBeNull()
    expect(screen.getAllByText('结果与成功标准')).toHaveLength(2)
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
    expect(screen.getByRole('heading', { name: '本阶段还差 4 项才能评审' })).toBeTruthy()
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
    expect(screen.getByRole('heading', { name: '“调查数据、系统、接口、安全与组织”尚未开始' })).toBeTruthy()
    expect(screen.getByText('先完成当前阶段及此前所有前置阶段，并由 FDE 逐阶段确认。')).toBeTruthy()
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
    expect(screen.getByRole('heading', { name: '定义结果、范围与责任' })).toBeTruthy()
    expect(screen.getByText('当时依据了什么')).toBeTruthy()
    expect(screen.getByText('业务流程说明')).toBeTruthy()
    expect(screen.getByText('已经留下什么')).toBeTruthy()
    expect(screen.getByText('结果与成功标准')).toBeTruthy()
    expect(screen.getByText('已通过 FDE 人工阶段门')).toBeTruthy()
    expect(screen.getByText('项目随后进入“调查数据、系统、接口、安全与组织”。')).toBeTruthy()
    expect(screen.getByText('继续推进')).toBeTruthy()
    expect(screen.queryByText('会依次做什么')).toBeNull()
    expect(screen.queryByRole('button', { name: '开始本阶段工作' })).toBeNull()
  })
})
