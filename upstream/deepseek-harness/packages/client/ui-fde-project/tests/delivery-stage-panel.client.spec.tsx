// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { DeliveryStagePanel } from '../src/client/DeliveryStagePanel.tsx'

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
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
  it('shows improvement signals from source clauses and opens real records without executing', async () => {
    const supplied = input('improvement', false, true)
    const surface = supplied.surface!
    const delivery = surface.delivery!
    const record = delivery.items[0]!
    const evidence = record.evidence[0]!
    render(<DeliveryStagePanel {...supplied} surface={{ ...surface,
      artifacts: [{ ...surface.artifacts[0]!, id: 'improvement-record', title: '改进与验证记录', path: 'customer/improvement.md' }],
      delivery: { ...delivery,
        semantic: { mode: 'snapshot', schemaVersion: 'customer-schema', graphRevision: 'sha256:customer', summary: '本地读取 17 实体 / 29 关系快照。尚未连接在线服务。', evidence: [{ ...evidence, path: 'customer/catalog.mjs' }] },
        items: [{ ...record, id: 'signal-real', category: 'signal', title: 'ISSUE-72 · 客户长文本', summary: '模拟三天收到 5 条反馈；仅限导出显示，不扩张执行权限。', owner: '客户产品负责人' }, record],
      },
    }} />)
    const signals = screen.getByRole('region', { name: '改进信号表' })
    expect(within(signals).getByText('模拟三天收到 5 条反馈')).toBeTruthy()
    expect(within(signals).getByText('仅限导出显示，不扩张执行权限。')).toBeTruthy()
    expect(screen.queryByText('IMP-001')).toBeNull()
    expect(screen.getByText('17')).toBeTruthy()
    expect(screen.getByText('29')).toBeTruthy()
    expect(screen.getByText('尚未连接在线服务')).toBeTruthy()
    fireEvent.click(within(screen.getByRole('tabpanel')).getByRole('button', { name: '查看改进与验证记录' }))
    await waitFor(() => expect(supplied.props.openProjectFile).toHaveBeenCalledWith('s1', '/project', 'customer/improvement.md', 'improvement.md'))
    fireEvent.click(screen.getByRole('button', { name: '在 Agent 中处理 ↗' }))
    expect(supplied.props.prepareStageDraft).toHaveBeenCalledWith('s1', expect.stringContaining('.fde/stages/improvement.json'))
    fireEvent.click(within(signals).getByRole('button', { name: '证据与详情' }))
    expect(within(await screen.findByRole('dialog')).getByText('模拟三天收到 5 条反馈；仅限导出显示，不扩张执行权限。')).toBeTruthy()
    expect(supplied.props.completeV2Stage).not.toHaveBeenCalled()
  })
  it('keeps improvement preview read-only and missing files unavailable', () => {
    const supplied = input('improvement', true, true)
    render(<DeliveryStagePanel {...supplied} />)
    expect(screen.queryByRole('button', { name: /在 Agent 中处理/ })).toBeNull()
    expect(screen.queryByRole('button', { name: '评审本轮改进' })).toBeNull()
    expect((screen.getByRole('button', { name: '查看改进与验证记录' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('等待信号与发现证据')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '返回当前阶段' }))
    expect(supplied.props.returnToCurrentStage).toHaveBeenCalledWith('w1')
  })
  it('requires explicit confirmation for an improvement review and retains reasoned return', async () => {
    const supplied = input('improvement', false, true)
    render(<DeliveryStagePanel {...supplied} />)
    fireEvent.click(screen.getByRole('button', { name: '评审本轮改进' }))
    expect(screen.getByText('只记录本轮改进评审，仍停留在第八阶段，不执行生产发布。')).toBeTruthy()
    expect(supplied.props.completeV2Stage).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '确认并继续' }))
    await waitFor(() => expect(supplied.props.completeV2Stage).toHaveBeenCalledWith('w1', 7, 'improvement'))
    fireEvent.click(screen.getByRole('button', { name: '返回上一阶段' }))
    fireEvent.change(screen.getByRole('textbox', { name: '返回原因' }), { target: { value: '需要重新核对范围' } })
    fireEvent.click(screen.getByRole('button', { name: '保留证据并返回' }))
    await waitFor(() => expect(supplied.props.returnV2Stage).toHaveBeenCalledWith('w1', 7, '需要重新核对范围'))
  })
  it('does not enable improvement review while evidence is blocked', () => {
    render(<DeliveryStagePanel {...input('improvement')} />)
    expect((screen.getByRole('button', { name: '评审本轮改进' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('客户授权未确认')).toBeTruthy()
  })
  it('visualizes production source values and retains archive, details and tab shortcuts', async () => {
    const supplied = input('production', true, true)
    const surface = supplied.surface!
    const delivery = surface.delivery!
    const record = delivery.items[0]!
    const evidence = record.evidence[0]!
    render(<DeliveryStagePanel {...supplied} actualStage="improvement" surface={{ ...surface, delivery: { ...delivery,
      semantic: { mode: 'snapshot', schemaVersion: 'customer-schema', graphRevision: 'sha256:customer', summary: '本地读取 19 实体 / 27 关系快照。没有在线查询权限。', evidence: [{ ...evidence, path: 'customer/graph.json' }] },
      items: [record,
        { ...record, id: 'release', category: 'release', title: '实际登记的发布批次', summary: '测试发布批次 R-002：20% → 60% → 100%；每批观察 15 分钟，回退目标保持为 previous-r2。' },
        { ...record, id: 'adoption', category: 'adoption', title: '客户采用记录', summary: '模拟三周内 8/10 名操作者活跃，处理 100 个案例；72 条建议采用，采用率 72%。' },
      ],
    } }} />)
    expect(screen.getByText(/第 7 阶段历史记录.*第 8 阶段/)).toBeTruthy()
    expect(screen.getByText('20%')).toBeTruthy()
    expect(screen.getByText('60%')).toBeTruthy()
    expect(screen.getByText('previous-r2')).toBeTruthy()
    expect(screen.getByText('模拟三周内')).toBeTruthy()
    expect(screen.getByLabelText('记录中的采用率 72%')).toBeTruthy()
    expect(screen.getByText('8/10')).toBeTruthy()
    expect(screen.queryByText('85')).toBeNull()
    expect(screen.getByRole('region', { name: '交付与验收档案' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /真实阶段记录.*查看/ }))
    await waitFor(() => expect(supplied.props.openProjectFile).toHaveBeenCalledWith('s1', '/project', 'record.md', 'record.md'))
    fireEvent.click(screen.getAllByRole('button', { name: '证据与详情' })[0]!)
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/20% → 60% → 100%/)).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: '关闭详情' }))
    fireEvent.click(screen.getByRole('button', { name: /查看验收条件/ }))
    expect(screen.getByRole('tab', { name: '验收条件' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('region', { name: '验收条件表' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: '提交 FDE 评审' })).toBeNull()
    expect(supplied.props.completeV2Stage).not.toHaveBeenCalled()
  })
  it('keeps unrecognized production summaries as text instead of inventing charts', () => {
    const supplied = input('production')
    const surface = supplied.surface!
    const delivery = surface.delivery!
    render(<DeliveryStagePanel {...supplied} surface={{ ...surface, delivery: { ...delivery, items: [
      { ...delivery.items[0]!, category: 'release', summary: '发布条件尚未核对。' },
      { ...delivery.items[0]!, id: 'adoption', category: 'adoption', summary: '建议采用率尚未登记。' },
    ] } }} />)
    expect(screen.getAllByText('发布条件尚未核对。').length).toBeGreaterThan(0)
    expect(screen.queryByLabelText('记录中的发布批次')).toBeNull()
    expect(screen.queryByLabelText(/记录中的采用率/)).toBeNull()
    expect(screen.queryByText('85%')).toBeNull()
  })
  it('uses recorded pilot facts for history, semantic counts, files and recovery details', async () => {
    const supplied = input('pilot', true, true)
    const surface = supplied.surface!
    const delivery = surface.delivery!
    const evidence = delivery.items[0]!.evidence[0]!
    const copy = vi.fn(async () => {})
    vi.stubGlobal('navigator', { clipboard: { writeText: copy } })
    render(<DeliveryStagePanel {...supplied} actualStage="improvement" surface={{ ...surface, delivery: {
      ...delivery,
      semantic: { mode: 'snapshot', schemaVersion: 'customer-r3', graphRevision: 'sha256:customer-revision', summary: '本地应用读取 backend/customer.mjs。已登记 12 个实体、34 条关系。尚未接通在线查询服务。', evidence: [{ ...evidence, path: 'backend/customer.mjs' }, { ...evidence, path: '.fde/design/knowledge-graph.json' }] },
      items: [
        { ...delivery.items[0]!, status: 'not_applicable', declaredStatus: 'not_applicable' },
        { ...delivery.items[0]!, id: 'recovery', category: 'recovery', title: '客户恢复演练', summary: '恢复用时 1 分 9 秒，保留已确认草稿。', status: 'passed', declaredStatus: 'passed' },
      ],
    } }} />)
    expect(screen.getByText(/第 6 阶段历史记录.*第 8 阶段/)).toBeTruthy()
    expect(screen.getByText('1 项不适用')).toBeTruthy()
    expect(screen.getByText('12')).toBeTruthy()
    expect(screen.getByText('34')).toBeTruthy()
    expect(screen.queryByText('56')).toBeNull()
    expect(screen.getByText('记录中的恢复用时')).toBeTruthy()
    expect(screen.getByText('customer-r3')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '复制图谱修订' }))
    await waitFor(() => expect(copy).toHaveBeenCalledWith('sha256:customer-revision'))
    await screen.findByRole('status')
    fireEvent.click(screen.getByRole('button', { name: '详情' }))
    await waitFor(() => expect(supplied.props.openProjectFile).toHaveBeenCalledWith('s1', '/project', '.fde/design/knowledge-graph.json', 'knowledge-graph.json'))
    fireEvent.click(screen.getByRole('button', { name: /客户恢复演练/ }))
    const detail = await screen.findByRole('dialog')
    expect(within(detail).getByText('恢复用时 1 分 9 秒，保留已确认草稿。')).toBeTruthy()
    expect(within(detail).queryByRole('button', { name: /在 Agent 中处理/ })).toBeNull()
    expect(supplied.props.completeV2Stage).not.toHaveBeenCalled()
  })
  it('does not invent graph counts when the project summary has none', () => {
    const supplied = input()
    const surface = supplied.surface!
    render(<DeliveryStagePanel {...supplied} surface={{ ...surface, delivery: {
      ...surface.delivery!, semantic: { mode: 'snapshot', schemaVersion: 'r1', graphRevision: 'sha256:unknown', summary: '仅登记快照依赖。', evidence: [] },
    } }} />)
    expect(screen.getByText('实体数未登记')).toBeTruthy()
    expect(screen.getByText('关系数未登记')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '详情' })).toBeNull()
  })
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
  it.each(['pilot', 'production'] as const)('retains explicit confirmation and reasoned return for current %s', async stage => {
    const props = input(stage, false, true)
    render(<DeliveryStagePanel {...props} />)
    fireEvent.click(screen.getByRole('button', { name: '提交 FDE 评审' }))
    expect(props.props.completeV2Stage).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '确认并继续' }))
    await waitFor(() => expect(props.props.completeV2Stage).toHaveBeenCalledWith('w1', 7, stage))
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
