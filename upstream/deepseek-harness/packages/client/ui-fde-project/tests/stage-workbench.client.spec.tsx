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
    useProjectSources: hook({
      byWorkspace: {
        'workspace-1': {
          status: 'ready',
          files: [{
            sourceId: 'source-1', originalName: '客户访谈纪要.docx', storedName: '客户访谈纪要.docx',
            relativePath: 'fde-resources/客户访谈纪要.docx', extension: 'docx', bytes: 100, mtimeMs: 1,
            mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            parse: { status: 'ready', parser: 'test', parserVersion: '1' },
          }],
        },
      },
    }),
    loadStage: vi.fn(),
    loadProjectSurface: vi.fn(),
    loadProjectSources: vi.fn(),
    openProjectSourceUpload: vi.fn(),
    runDiscoveryAction: vi.fn(async () => {}),
    openProjectFile: vi.fn(async () => {}),
    openProjectConversation: vi.fn(),
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

  it('shows one guided stage surface without duplicating the native composer or project inputs', async () => {
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
    const collapsedArtifacts = screen.getByRole('button', { name: '展开阶段产物' })
    expect(within(collapsedArtifacts).getByText('0/3')).toBeTruthy()
    expect(collapsedArtifacts.getAttribute('data-tooltip')).toBe('本阶段记录 · 0/3 已整理')

    expect(screen.getByText('从一个最近发生的案例开始')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '继续核对说法不一致' })).toBeNull()
    const startButton = screen.getByRole('button', { name: '开始梳理真实流程' })
    fireEvent.click(startButton)
    expect(input.runDiscoveryAction).toHaveBeenCalledWith('session-1', 'prepare-interview', [], '')
    await waitFor(() => { expect(startButton.hasAttribute('disabled')).toBe(false) })

    fireEvent.click(screen.getByRole('button', { name: '展开阶段产物' }))
    expect(artifacts?.getAttribute('data-collapsed')).toBeNull()
    expect(screen.getByText('客户现状记录')).toBeTruthy()
    expect(screen.getByText('待确认事项')).toBeTruthy()
    expect(screen.getByText('业务流程说明')).toBeTruthy()
    expect(screen.getByText('项目调整记录')).toBeTruthy()
    expect(screen.getByText('已整理 0/3')).toBeTruthy()
    expect(screen.getAllByText('尚未整理').length).toBe(3)
    expect(screen.getByText('按需生成')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '收起阶段产物' }))
    expect(artifacts?.getAttribute('data-collapsed')).toBe('true')
    expect(screen.queryByText('客户现状记录')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: '根据客户资料开始梳理（1）' }))
    expect(input.runDiscoveryAction).toHaveBeenCalledWith(
      'session-1',
      'qualify-workflow',
      ['fde-resources/客户访谈纪要.docx'],
      '',
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

  it('shows persisted workflow candidates, previews artifacts, and keeps the FDE decision manual', () => {
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

    fireEvent.click(screen.getByRole('button', { name: '展开阶段产物' }))
    expect(screen.getByText('候选材料已齐备')).toBeTruthy()
    expect(screen.getByText(/阶段仍由 FDE 人工决定/)).toBeTruthy()
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
    expect(input.openProjectPage).toHaveBeenCalledTimes(1)
  })
})
