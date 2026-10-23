// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { ProjectProgressOverlay } from '../src/client/ProjectProgressOverlay.tsx'
import type { AcceptanceHandoverDecision } from '../src/client/controller.ts'
import { zh } from '../src/client/locales.ts'
import type { ProjectProgressOverlayProps } from '../src/client/slots.ts'

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe(): void {} disconnect(): void {} })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); delete document.body.dataset.fdePage })

const hook = <T,>(value: T) => <S,>(selector: (state: T) => S) => selector(value)

function propsFor(stage: 'pilot' | 'handoff' | 'completed', surface: unknown, actions: {
  readonly completePilot?: () => Promise<void>
  readonly completeHandoff?: () => Promise<void>
  readonly returnToPrevious?: (workspaceId: string, expectedRevision: number, reason: string) => Promise<void>
  readonly acceptDeploymentTrialIssue?: () => Promise<void>
  readonly confirmDeploymentTrialReadiness?: () => Promise<void>
  readonly recordAcceptanceHandoverDecision?: (
    workspaceId: string,
    contractDigest: string,
    decision: AcceptanceHandoverDecision,
  ) => Promise<void>
} = {}): ProjectProgressOverlayProps {
  return {
    useProjectPage: hook({ open: true, view: 'project' as const, workspaceId: 'workspace-1' }),
    useStageProgress: hook({ byWorkspace: { 'workspace-1': { status: 'ready', value: {
      workspaceId: 'workspace-1', currentStage: stage, revision: stage === 'pilot' ? 5 : stage === 'handoff' ? 6 : 7,
      createdAt: '2026-08-27T00:00:00.000Z', updatedAt: '2026-08-27T00:06:00.000Z',
    } } } }),
    useProjectSurfaces: hook({ byWorkspace: { 'workspace-1': { status: 'ready', value: surface } } }),
    useProjectSources: hook({ byWorkspace: { 'workspace-1': { status: 'ready', files: [] } } }),
    useProjectMetadata: hook({ byWorkspace: {} }),
    loadProjectMetadata: vi.fn(),
    useWorkspaces: hook({ phase: 'ready', state: 'idle', archivedSessionIds: [], items: [{
      workspaceId: 'workspace-1', title: '数据分析项目', path: '/project/one', sessionIds: ['session-1'],
      createdAt: '2026-08-27T00:00:00.000Z', updatedAt: '2026-08-27T00:06:00.000Z',
    }] }),
    useSessions: hook({ byId: { 'session-1': { id: 'session-1', displayTitle: '交付会话', running: false, blank: false, updatedAt: 1 } } }),
    loadStage: vi.fn(), retryStage: vi.fn(), loadProjectSurface: vi.fn(), refreshProjectSurface: vi.fn(),
    completeRequirements: vi.fn(), completeSolution: vi.fn(), completeDevelopment: vi.fn(), completeValidation: vi.fn(),
    completePilot: actions.completePilot ?? vi.fn(), completeHandoff: actions.completeHandoff ?? vi.fn(), waiveValidationIssue: vi.fn(),
    returnToPrevious: actions.returnToPrevious ?? vi.fn(),
    acceptDeploymentTrialIssue: actions.acceptDeploymentTrialIssue ?? vi.fn(),
    confirmDeploymentTrialReadiness: actions.confirmDeploymentTrialReadiness ?? vi.fn(),
    recordAcceptanceHandoverDecision: actions.recordAcceptanceHandoverDecision ?? vi.fn(),
    loadProjectSources: vi.fn(), parseProjectSource: vi.fn(),
    enterProject: vi.fn(), reviewProjectArchitecture: vi.fn(), closeProjectPage: vi.fn(), showProjectOverview: vi.fn(),
    showProjectTimeline: vi.fn(), showProjectDetail: vi.fn(), renderSlot: vi.fn(() => <div>固定产物正文</div>),
    t: makeTranslate(zh),
  } as unknown as ProjectProgressOverlayProps
}

const baseSurface = {
  workspaceId: 'workspace-1', title: '数据分析项目',
  runtime: { schemaVersion: 1, revision: 0, status: 'stopped', updatedAt: '1970-01-01T00:00:00.000Z' },
  apiDocs: { status: 'unconfigured', message: '未配置' }, architecture: null,
  evaluation: { casesCount: 0, reports: [] },
  requirements: { root: 'fde-deliverables/01-requirement-research', requiredCount: 3, presentCount: 3, artifacts: [] },
  deploymentTrial: {
    contract: {
      status: 'ready', path: '.fde/deployment-trial.json', digest: `sha256:${'a'.repeat(64)}`, candidateVersion: 'v1.0.0',
      environment: { name: '客户验收环境', summary: '客户内网', authorized: true }, deploymentStatus: 'ready',
      evidence: {
        validationBaseline: { path: 'evidence/validation.md', available: true }, deployment: { path: 'evidence/deployment.md', available: true },
        health: { path: 'evidence/health.md', available: true }, rollback: { path: 'evidence/rollback.md', available: true },
        trial: { path: 'evidence/trial.md', available: true },
      }, issues: [],
    },
    artifacts: { root: 'fde-deliverables/05-deployment-trial', requiredCount: 4, presentCount: 4, items: [
      { id: 'deployment-runbook', title: '部署运行手册', path: 'fde-deliverables/05-deployment-trial/deployment-runbook.md', status: 'present', fileUrl: '/pilot/runbook' },
      { id: 'deployment-baseline', title: '部署基线', path: 'fde-deliverables/05-deployment-trial/deployment-baseline.md', status: 'present', fileUrl: '/pilot/baseline' },
      { id: 'trial-operation-report', title: '试运行报告', path: 'fde-deliverables/05-deployment-trial/trial-operation-report.md', status: 'present', fileUrl: '/pilot/report' },
      { id: 'issue-closure-list', title: '问题闭环清单', path: 'fde-deliverables/05-deployment-trial/issue-closure-list.md', status: 'present', fileUrl: '/pilot/issues' },
    ] }, confirmationReady: true, confirmationBlockers: [], gateReady: true, blockers: [],
  },
  acceptanceHandover: {
    contract: {
      status: 'ready', path: '.fde/acceptance-handover.json', digest: `sha256:${'b'.repeat(64)}`, finalVersion: 'v1.0.0',
      deploymentTrialBaseline: { path: 'evidence/pilot.md', available: true },
      acceptance: { status: 'accepted', summary: '客户确认通过', evidence: [{ path: 'evidence/acceptance.md', available: true }] },
      deliverables: [{ id: 'release', name: '交付源码包', location: 'release.zip', version: 'v1.0.0', checksum: 'sha256:test', available: true, locationType: 'project-file' }],
      conditions: [],
      handover: { trainingCompleted: true, accessResponsibilityTransferred: true, operationsResponsibilityTransferred: true, evidence: [{ path: 'evidence/handover.md', available: true }] },
    },
    artifacts: { root: 'fde-deliverables/06-acceptance-handover', requiredCount: 4, presentCount: 4, items: [
      { id: 'delivery-inventory', title: '交付物清单', path: 'fde-deliverables/06-acceptance-handover/delivery-inventory.md', status: 'present', fileUrl: '/handoff/inventory' },
      { id: 'acceptance-report', title: '项目验收报告', path: 'fde-deliverables/06-acceptance-handover/acceptance-report.md', status: 'present', fileUrl: '/handoff/acceptance' },
      { id: 'operations-and-maintenance-guide', title: '运维使用手册', path: 'fde-deliverables/06-acceptance-handover/operations-and-maintenance-guide.md', status: 'present', fileUrl: '/handoff/operations' },
      { id: 'handover-record', title: '移交确认记录', path: 'fde-deliverables/06-acceptance-handover/handover-record.md', status: 'present', fileUrl: '/handoff/record' },
    ] }, gateReady: true, blockers: [],
  },
}

describe('last two project delivery stages', () => {
  it('shows real deployment facts and requires the FDE second confirmation', async () => {
    const completePilot = vi.fn(async () => {})
    render(<ProjectProgressOverlay {...propsFor('pilot', baseSurface, { completePilot })} />)
    expect(screen.getByText('版本、环境与运行证据')).toBeTruthy()
    expect(screen.getAllByText('客户验收环境')).toHaveLength(2)
    expect(screen.getAllByText('5/5')).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: '完成部署试运行' }))
    fireEvent.click(screen.getByRole('button', { name: '确认并进入验收移交' }))
    await waitFor(() => { expect(completePilot).toHaveBeenCalledWith('workspace-1', 5) })
  })

  it('shows final deliverables and requires the last FDE confirmation', async () => {
    const completeHandoff = vi.fn(async () => {})
    render(<ProjectProgressOverlay {...propsFor('handoff', baseSurface, { completeHandoff })} />)
    expect(screen.getByText('最终交付与责任移交')).toBeTruthy()
    expect(screen.getByText('交付源码包')).toBeTruthy()
    expect(screen.getByText('客户确认通过')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '完成验收移交' }))
    fireEvent.click(screen.getByRole('button', { name: '确认并完成项目' }))
    await waitFor(() => { expect(completeHandoff).toHaveBeenCalledWith('workspace-1', 6) })
  })

  it('lets the FDE record acceptance, deliverable, condition, and handover facts before final completion', async () => {
    const recordAcceptanceHandoverDecision = vi.fn(async () => {})
    const surface = {
      ...baseSurface,
      acceptanceHandover: {
        ...baseSurface.acceptanceHandover,
        contract: {
          ...baseSurface.acceptanceHandover.contract,
          acceptance: { status: 'pending' as const, summary: '等待客户验收', evidence: [] },
          deliverables: [{ ...baseSurface.acceptanceHandover.contract.deliverables[0], available: false }],
          conditions: [{ id: 'C-1', title: '补充管理员培训', status: 'open' as const }],
          handover: {
            trainingCompleted: false,
            accessResponsibilityTransferred: false,
            operationsResponsibilityTransferred: false,
            evidence: [],
          },
        },
        gateReady: false,
        blockers: ['企业验收结论尚未达到通过或带条件通过。'],
      },
    }
    render(<ProjectProgressOverlay {...propsFor('handoff', surface, { recordAcceptanceHandoverDecision })} />)
    fireEvent.click(screen.getByRole('button', { name: '记录验收与移交事实' }))
    fireEvent.change(screen.getByLabelText('验收状态'), { target: { value: 'accepted' } })
    fireEvent.change(screen.getByLabelText('验收摘要'), { target: { value: '客户已签署最终验收记录。' } })
    fireEvent.change(screen.getByLabelText('验收证据路径'), { target: { value: 'records/acceptance.md\nrecords/customer-email.md' } })
    fireEvent.click(screen.getByRole('checkbox', { name: /交付源码包/u }))
    fireEvent.change(screen.getByLabelText('补充管理员培训处理状态'), { target: { value: 'resolved' } })
    fireEvent.click(screen.getByRole('checkbox', { name: '培训已完成' }))
    fireEvent.click(screen.getByRole('checkbox', { name: '权限责任已移交' }))
    fireEvent.click(screen.getByRole('checkbox', { name: '运维责任已移交' }))
    fireEvent.change(screen.getByLabelText('移交证据路径'), { target: { value: 'records/handover.md' } })
    fireEvent.click(screen.getByRole('button', { name: '保存验收与移交记录' }))
    await waitFor(() => {
      expect(recordAcceptanceHandoverDecision).toHaveBeenCalledWith('workspace-1', `sha256:${'b'.repeat(64)}`, {
        acceptance: {
          status: 'accepted', summary: '客户已签署最终验收记录。',
          evidence: ['records/acceptance.md', 'records/customer-email.md'],
        },
        deliverables: [{ id: 'release', available: true }],
        conditions: [{ id: 'C-1', status: 'resolved' }],
        handover: {
          trainingCompleted: true,
          accessResponsibilityTransferred: true,
          operationsResponsibilityTransferred: true,
          evidence: ['records/handover.md'],
        },
      })
    })
  })

  it('lets the FDE accept one unresolved deployment risk with a reason', async () => {
    const acceptDeploymentTrialIssue = vi.fn(async () => {})
    const surface = {
      ...baseSurface,
      deploymentTrial: {
        ...baseSurface.deploymentTrial,
        contract: {
          ...baseSurface.deploymentTrial.contract,
          issues: [{
            id: 'P-1', title: '低频登录失败', severity: 'high' as const, status: 'open' as const,
            evidence: 'evidence/login.md', evidenceAvailable: true,
          }],
        },
        gateReady: false,
        blockers: ['严重问题“低频登录失败”尚未关闭或接受。'],
      },
    }
    render(<ProjectProgressOverlay {...propsFor('pilot', surface, { acceptDeploymentTrialIssue })} />)
    fireEvent.click(screen.getByRole('button', { name: '人工接受风险' }))
    fireEvent.change(screen.getByPlaceholderText('说明接受原因、适用范围和后续处理约定'), { target: { value: '客户接受当前范围，下一版本继续观察' } })
    fireEvent.click(screen.getByRole('button', { name: '确认接受风险' }))
    await waitFor(() => {
      expect(acceptDeploymentTrialIssue).toHaveBeenCalledWith('workspace-1', `sha256:${'a'.repeat(64)}`, 'P-1', '客户接受当前范围，下一版本继续观察')
    })
  })

  it('offers an explicit FDE action when only target authorization and trial readiness are pending', async () => {
    const confirmDeploymentTrialReadiness = vi.fn(async () => {})
    const surface = {
      ...baseSurface,
      deploymentTrial: {
        ...baseSurface.deploymentTrial,
        contract: {
          ...baseSurface.deploymentTrial.contract,
          environment: { ...baseSurface.deploymentTrial.contract.environment, authorized: false },
          deploymentStatus: 'preparing' as const,
        },
        confirmationReady: true,
        confirmationBlockers: [],
        gateReady: false,
        blockers: ['目标环境尚未记录 FDE 授权。', '目标环境试运行状态尚未标记为 ready。'],
      },
    }
    render(<ProjectProgressOverlay {...propsFor('pilot', surface, { confirmDeploymentTrialReadiness })} />)
    fireEvent.click(screen.getByRole('button', { name: '确认目标环境与试运行结论' }))
    fireEvent.click(screen.getByRole('button', { name: '确认授权并标记试运行完成' }))
    await waitFor(() => {
      expect(confirmDeploymentTrialReadiness).toHaveBeenCalledWith('workspace-1', `sha256:${'a'.repeat(64)}`)
    })
  })

  it('keeps the handoff record visible after the terminal completion state', () => {
    render(<ProjectProgressOverlay {...propsFor('completed', baseSurface)} />)
    expect(screen.getByRole('button', { name: '重新打开项目' })).toBeTruthy()
    expect(screen.getByText('最终交付与责任移交')).toBeTruthy()
    expect(screen.getByText(/项目状态为“项目已完成”/)).toBeTruthy()
  })

  it('requires a reason and second confirmation before reopening a completed project', async () => {
    const returnToPrevious = vi.fn(async () => {})
    render(<ProjectProgressOverlay {...propsFor('completed', baseSurface, { returnToPrevious })} />)

    fireEvent.click(screen.getByRole('button', { name: '重新打开项目' }))
    const confirm = screen.getByRole('button', { name: '确认重新打开项目' })
    expect((confirm as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByRole('textbox', { name: '返回原因' }), { target: { value: '补充最终移交材料' } })
    fireEvent.click(confirm)

    await waitFor(() => {
      expect(returnToPrevious).toHaveBeenCalledWith('workspace-1', 7, '补充最终移交材料')
    })
  })
})
