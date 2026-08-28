import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  acceptDeploymentTrialIssue,
  confirmDeploymentTrialReadiness,
  loadAcceptanceHandoverStage,
  loadDeploymentTrialStage,
  recordAcceptanceHandoverDecision,
  resolveAcceptanceHandoverArtifact,
  resolveDeploymentTrialArtifact,
} from '../src/delivery-closeout.ts'

async function evidence(root: string, path: string, body = 'evidence'): Promise<void> {
  const file = join(root, path)
  await mkdir(join(file, '..'), { recursive: true })
  await writeFile(file, body)
}

describe('final two FDE delivery stages', () => {
  it('projects a complete deployment trial without treating an open serious issue as ready', async () => {
    const root = await mkdtemp(join(tmpdir(), 'fde-pilot-'))
    const artifactRoot = join(root, 'fde-deliverables', '05-deployment-trial')
    await mkdir(join(root, '.fde'), { recursive: true })
    await mkdir(artifactRoot, { recursive: true })
    for (const file of ['deployment-runbook.md', 'deployment-baseline.md', 'trial-operation-report.md', 'issue-closure-list.md']) {
      await writeFile(join(artifactRoot, file), `# ${file}\n`)
    }
    for (const file of ['validation.md', 'deployment.md', 'health.md', 'rollback.md', 'trial.md', 'issue.md']) {
      await evidence(root, `.fde/evidence/${file}`)
    }
    const contract = {
      schemaVersion: 1,
      candidateVersion: 'v1.0.0',
      environment: { name: '客户验收环境', summary: '客户内网受控试运行', authorized: true },
      status: 'ready',
      evidence: {
        validationBaseline: '.fde/evidence/validation.md', deployment: '.fde/evidence/deployment.md',
        health: '.fde/evidence/health.md', rollback: '.fde/evidence/rollback.md', trial: '.fde/evidence/trial.md',
      },
      issues: [{ id: 'P-1', title: '登录偶发失败', severity: 'high', status: 'open', evidence: '.fde/evidence/issue.md' }],
    }
    await writeFile(join(root, '.fde', 'deployment-trial.json'), JSON.stringify(contract))

    const blocked = await loadDeploymentTrialStage(root, 'w1')
    expect(blocked.artifacts).toMatchObject({ requiredCount: 4, presentCount: 4 })
    expect(blocked.gateReady).toBe(false)
    expect(blocked.blockers).toContain('严重问题“登录偶发失败”尚未关闭或接受。')
    expect(blocked.contract.digest).toMatch(/^sha256:[a-f0-9]{64}$/u)
    await acceptDeploymentTrialIssue(root, blocked.contract.digest as string, 'P-1', '客户接受低频风险，下一版本继续观察')

    const ready = await loadDeploymentTrialStage(root, 'w1')
    expect(ready.gateReady).toBe(true)
    expect(ready.contract.issues[0]).toMatchObject({ status: 'accepted', decisionReason: '客户接受低频风险，下一版本继续观察' })
    expect(ready.contract.evidence.rollback.available).toBe(true)
    expect(ready.artifacts.items[0]?.fileUrl).toBe('/api/fde-project/pilot/artifact?workspaceId=w1&artifactId=deployment-runbook')
    await expect(resolveDeploymentTrialArtifact(root, 'deployment-runbook')).resolves.toMatchObject({ name: 'deployment-runbook.md' })
  })

  it('requires an exact FDE decision before recording target authorization and trial readiness', async () => {
    const root = await mkdtemp(join(tmpdir(), 'fde-pilot-confirm-'))
    const artifactRoot = join(root, 'fde-deliverables', '05-deployment-trial')
    await mkdir(join(root, '.fde'), { recursive: true })
    await mkdir(artifactRoot, { recursive: true })
    for (const file of ['deployment-runbook.md', 'deployment-baseline.md', 'trial-operation-report.md', 'issue-closure-list.md']) {
      await writeFile(join(artifactRoot, file), `# ${file}\n`)
    }
    for (const file of ['validation.md', 'deployment.md', 'health.md', 'rollback.md', 'trial.md']) {
      await evidence(root, `.fde/evidence/${file}`)
    }
    await writeFile(join(root, '.fde', 'deployment-trial.json'), JSON.stringify({
      schemaVersion: 1,
      candidateVersion: 'v1.0.0',
      environment: { name: '客户验收环境', summary: '客户内网受控试运行', authorized: false },
      status: 'preparing',
      evidence: {
        validationBaseline: '.fde/evidence/validation.md', deployment: '.fde/evidence/deployment.md',
        health: '.fde/evidence/health.md', rollback: '.fde/evidence/rollback.md', trial: '.fde/evidence/trial.md',
      },
      issues: [],
    }))

    const pending = await loadDeploymentTrialStage(root)
    expect(pending).toMatchObject({
      confirmationReady: true,
      confirmationBlockers: [],
      gateReady: false,
      blockers: ['目标环境尚未记录 FDE 授权。', '目标环境试运行状态尚未标记为 ready。'],
    })
    const confirmed = await confirmDeploymentTrialReadiness(root, pending.contract.digest as string)
    expect(confirmed).toMatchObject({
      contract: { environment: { authorized: true }, deploymentStatus: 'ready' },
      confirmationReady: true,
      gateReady: true,
      blockers: [],
    })
    await expect(confirmDeploymentTrialReadiness(root, pending.contract.digest as string)).rejects.toThrow('部署试运行状态已经变化')
  })

  it('requires accepted delivery facts and complete responsibility transfer before project completion', async () => {
    const root = await mkdtemp(join(tmpdir(), 'fde-handoff-'))
    const artifactRoot = join(root, 'fde-deliverables', '06-acceptance-handover')
    await mkdir(join(root, '.fde'), { recursive: true })
    await mkdir(artifactRoot, { recursive: true })
    for (const file of ['delivery-inventory.md', 'acceptance-report.md', 'operations-and-maintenance-guide.md', 'handover-record.md']) {
      await writeFile(join(artifactRoot, file), `# ${file}\n`)
    }
    for (const file of ['pilot.md', 'acceptance.md', 'handover.md', 'release.zip']) await evidence(root, `.fde/evidence/${file}`)
    const contract = {
      schemaVersion: 1,
      finalVersion: 'v1.0.0',
      deploymentTrialBaseline: '.fde/evidence/pilot.md',
      acceptance: { status: 'conditionally-accepted', summary: '客户同意按责任表收口', evidence: ['.fde/evidence/acceptance.md'] },
      deliverables: [{ id: 'release', name: '交付源码包', location: '.fde/evidence/release.zip', version: 'v1.0.0', checksum: 'sha256:test', available: true }],
      conditions: [{ id: 'C-1', title: '补充管理员培训', status: 'accepted', reason: '客户指定下周完成', owner: 'FDE', followUp: '2026-09-03 复核' }],
      handover: {
        trainingCompleted: true,
        accessResponsibilityTransferred: true,
        operationsResponsibilityTransferred: false,
        evidence: ['.fde/evidence/handover.md'],
      },
    }
    await writeFile(join(root, '.fde', 'acceptance-handover.json'), JSON.stringify(contract))

    const blocked = await loadAcceptanceHandoverStage(root, 'w1')
    expect(blocked.gateReady).toBe(false)
    expect(blocked.contract.digest).toMatch(/^sha256:[a-f0-9]{64}$/u)
    expect(blocked.contract.acceptance?.evidence).toMatchObject([{ path: '.fde/evidence/acceptance.md', available: true }])
    expect(blocked.blockers).toContain('运维责任尚未完成移交。')
    contract.handover.operationsResponsibilityTransferred = true
    await writeFile(join(root, '.fde', 'acceptance-handover.json'), JSON.stringify(contract))

    const ready = await loadAcceptanceHandoverStage(root, 'w1')
    expect(ready.gateReady).toBe(true)
    expect(ready.contract.deliverables[0]).toMatchObject({ available: true, locationType: 'project-file' })
    expect(ready.artifacts.items[0]?.fileUrl).toBe('/api/fde-project/handoff/artifact?workspaceId=w1&artifactId=delivery-inventory')
    await expect(resolveAcceptanceHandoverArtifact(root, 'delivery-inventory')).resolves.toMatchObject({ name: 'delivery-inventory.md' })
  })

  it('records only the FDE decision fields against an exact acceptance-handover contract', async () => {
    const root = await mkdtemp(join(tmpdir(), 'fde-handoff-decision-'))
    const artifactRoot = join(root, 'fde-deliverables', '06-acceptance-handover')
    await mkdir(join(root, '.fde'), { recursive: true })
    await mkdir(artifactRoot, { recursive: true })
    for (const file of ['delivery-inventory.md', 'acceptance-report.md', 'operations-and-maintenance-guide.md', 'handover-record.md']) {
      await writeFile(join(artifactRoot, file), `# ${file}\n`)
    }
    for (const file of ['pilot.md', 'acceptance-a.md', 'acceptance-b.md', 'handover.md', 'release.zip']) {
      await evidence(root, `.fde/evidence/${file}`)
    }
    const contractPath = join(root, '.fde', 'acceptance-handover.json')
    await writeFile(contractPath, JSON.stringify({
      schemaVersion: 1,
      finalVersion: 'v1.0.0',
      deploymentTrialBaseline: '.fde/evidence/pilot.md',
      acceptance: { status: 'pending', summary: '等待客户验收', evidence: [] },
      deliverables: [{
        id: 'release', name: '交付源码包', location: '.fde/evidence/release.zip',
        version: 'v1.0.0', checksum: 'sha256:test', available: false,
      }],
      conditions: [{ id: 'C-1', title: '补充管理员培训', status: 'open' }],
      handover: {
        trainingCompleted: false,
        accessResponsibilityTransferred: false,
        operationsResponsibilityTransferred: false,
        evidence: [],
      },
    }))

    const pending = await loadAcceptanceHandoverStage(root)
    const updated = await recordAcceptanceHandoverDecision(root, pending.contract.digest as string, {
      acceptance: {
        status: 'accepted',
        summary: '客户已核对最终版本并签署验收记录。',
        evidence: ['.fde/evidence/acceptance-a.md', '.fde/evidence/acceptance-b.md'],
      },
      deliverables: [{ id: 'release', available: true }],
      conditions: [{ id: 'C-1', status: 'resolved' }],
      handover: {
        trainingCompleted: true,
        accessResponsibilityTransferred: true,
        operationsResponsibilityTransferred: true,
        evidence: ['.fde/evidence/handover.md'],
      },
    })

    expect(updated.gateReady).toBe(true)
    expect(updated.contract.acceptance?.evidence).toHaveLength(2)
    expect(updated.contract.deliverables[0]).toMatchObject({ id: 'release', name: '交付源码包', version: 'v1.0.0', available: true })
    const persisted = JSON.parse(await readFile(contractPath, 'utf8')) as Record<string, unknown>
    expect(persisted).toMatchObject({ schemaVersion: 1, finalVersion: 'v1.0.0', deploymentTrialBaseline: '.fde/evidence/pilot.md' })
    expect(persisted.deliverables).toMatchObject([{ id: 'release', name: '交付源码包', location: '.fde/evidence/release.zip', checksum: 'sha256:test' }])
    await expect(recordAcceptanceHandoverDecision(root, pending.contract.digest as string, {
      acceptance: { status: 'pending', summary: '旧页面提交', evidence: [] },
      deliverables: [{ id: 'release', available: false }],
      conditions: [{ id: 'C-1', status: 'open' }],
      handover: {
        trainingCompleted: false,
        accessResponsibilityTransferred: false,
        operationsResponsibilityTransferred: false,
        evidence: [],
      },
    })).rejects.toThrow('验收移交状态已经变化')
  })
})
