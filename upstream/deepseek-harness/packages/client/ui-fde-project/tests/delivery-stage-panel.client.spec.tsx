// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { DeliveryStagePanel } from '../src/client/DeliveryStagePanel.tsx'

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})
afterEach(cleanup)
function input(stage: 'pilot' | 'production' | 'improvement' = 'pilot', readonly = false, ready = false) {
  const category = stage === 'pilot' ? 'integration' : stage === 'production' ? 'acceptance' : 'change'
  return {
    stage, actualStage: readonly ? 'evaluation' : stage, view: true,
    workspace: { workspaceId: 'w1', title: '另一客户项目', path: '/project' }, sessionId: 's1', stageState: { revision: 7 },
    props: { refreshProjectSurface: vi.fn(), viewProjectStage: vi.fn(), returnToCurrentStage: vi.fn(), prepareStageDraft: vi.fn(), completeV2Stage: vi.fn(async () => {}), returnV2Stage: vi.fn(async () => {}), openProjectFile: vi.fn(async () => {}) },
    surface: {
      id: stage, statePath: `.fde/stages/${stage}.json`, presentCount: 1, requiredCount: 3, reviewReady: ready, reviewBlockers: ready ? [] : ['客户授权未确认'],
      artifacts: [{ id: 'file1', path: 'record.md', title: '真实阶段记录', purpose: '事实来源', status: 'present' }],
      delivery: { status: 'ready', version: 'project-r9', versionCurrent: true, versionFiles: [], environment: { kind: 'local', label: '本地验证' }, reviewBlockers: ready ? [] : ['客户授权未确认'], items: [{
        id: 'r1', category, title: '待核对的真实对象', summary: '未连接生产系统', scope: 'local', version: 'project-r9', required: true,
        status: 'pending', declaredStatus: 'pending', nextAction: '核对负责人', criterion: '有权客户明确签收',
        evidence: [{ path: 'source.md', status: 'present', sha256: 'a'.repeat(64), expectedSha256: 'a'.repeat(64), current: true }],
      }] },
    },
  } as unknown as ComponentProps<typeof DeliveryStagePanel>
}

describe('delivery stage workbenches', () => {
  it('renders the actual completed improvement cycle without an alternate entry', () => {
    const supplied = input('improvement', false, true)
    render(<DeliveryStagePanel {...supplied} stageState={{ ...supplied.stageState, improvementCycles: 1, lastReviewedAt: '2026-09-07T10:00:00Z' }} />)
    expect(screen.getByText('已完成 1 轮改进')).toBeTruthy()
    expect(screen.getByRole('heading', { name: '本轮已完成，持续跟进下一轮改进' })).toBeTruthy()
    expect(screen.queryByText(/完整演示|完整示例|独立模拟进度/)).toBeNull()
    expect(supplied.props.completeV2Stage).not.toHaveBeenCalled()
  })
  it.each([
    ['pilot', '试点运行与交付', '接入与准备'],
    ['production', '生产与验收交接', '验收条件'],
    ['improvement', '运行反馈与持续改进', '改进事项'],
  ] as const)('shows distinct %s tabs and right-side evidence details', async (stage, title, tab) => {
    const props = input(stage)
    render(<DeliveryStagePanel {...props} />)
    expect(screen.getByRole('heading', { name: title, level: 1 })).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: tab }))
    const region = screen.getByRole('tabpanel')
    fireEvent.click(stage === 'production' ? within(region).getByRole('button', { name: '查看' }) : within(region).getByRole('button', { name: /待核对的真实对象/ }))
    const detail = await screen.findByRole('dialog')
    expect(within(detail).getByText('责任人 / 确认人')).toBeTruthy()
    fireEvent.click(within(detail).getByRole('button', { name: /source.md/ }))
    await waitFor(() => expect(props.props.openProjectFile).toHaveBeenCalledWith('s1', '/project', 'source.md', 'source.md'))
    expect(props.props.completeV2Stage).not.toHaveBeenCalled()
  })
  it('future preview never offers mutation even with otherwise-ready evidence', () => {
    const props = input('pilot', true, true)
    const rendered = render(<DeliveryStagePanel {...props} />)
    expect(rendered.container.querySelector('[data-readonly="true"]')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '提交 FDE 评审' })).toBeNull()
    expect(screen.queryByRole('button', { name: /在 Agent 中处理/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /7 · 生产与验收交接/ }))
    expect(props.props.viewProjectStage).toHaveBeenCalledWith('w1', 'production')
    fireEvent.click(screen.getByRole('button', { name: '返回当前阶段' }))
    expect(props.props.returnToCurrentStage).toHaveBeenCalledWith('w1')
    expect(props.props.completeV2Stage).not.toHaveBeenCalled()
  })
  it('keeps unavailable gates disabled and prepares prompts without submitting them', () => {
    const props = input()
    render(<DeliveryStagePanel {...props} />)
    expect((screen.getByRole('button', { name: '提交 FDE 评审' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: '在 Agent 中处理 ↗' }))
    expect(props.props.prepareStageDraft).toHaveBeenCalledWith('s1', expect.stringContaining('.fde/stages/pilot.json'))
    expect(screen.queryByText('项目语义依赖')).toBeNull()
  })
  it('retains explicit confirmation and reasoned return for the current stage', async () => {
    const props = input('pilot', false, true)
    render(<DeliveryStagePanel {...props} />)
    fireEvent.click(screen.getByRole('button', { name: '提交 FDE 评审' }))
    expect(props.props.completeV2Stage).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '确认并继续' }))
    await waitFor(() => expect(props.props.completeV2Stage).toHaveBeenCalledWith('w1', 7, 'pilot'))
    fireEvent.click(screen.getByRole('button', { name: '返回上一阶段' }))
    fireEvent.change(screen.getByRole('textbox', { name: '返回原因' }), { target: { value: '范围变化' } })
    fireEvent.click(screen.getByRole('button', { name: '保留证据并返回' }))
    await waitFor(() => expect(props.props.returnV2Stage).toHaveBeenCalledWith('w1', 7, '范围变化'))
  })
  it('shows load state and supports refresh without executing a project action', () => {
    const props = input()
    render(<DeliveryStagePanel {...props} surface={undefined} />)
    expect(screen.getByRole('status').textContent).toContain('正在读取阶段记录')
    fireEvent.click(screen.getByRole('button', { name: /刷新记录/ }))
    expect(props.props.refreshProjectSurface).toHaveBeenCalledWith('w1')
  })
})
