import { describe, expect, it, vi } from 'vitest'
import {
  acceptValidationMetric,
  confirmDeploymentTrialReadiness,
  confirmValidationPlan,
  FdeProjectSurfaceController,
  fetchProjectSurface,
  recordAcceptanceHandoverDecision,
  startProjectRuntime,
  waiveValidationIssue,
} from '../src/client/controller.ts'

const value = {
  workspaceId: 'w-1',
  title: '项目一',
  runtime: { schemaVersion: 1, revision: 0, status: 'stopped', updatedAt: '1970-01-01T00:00:00.000Z' },
  apiDocs: { status: 'unconfigured', message: '尚未配置' },
  architecture: null,
  evaluation: { casesCount: 0, reports: [] },
} as const

describe('FDE project surface controller', () => {
  it('reads the exact project through the same-origin route', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ ok: true, value }), {
      status: 200, headers: { 'content-type': 'application/json' },
    }))
    await expect(fetchProjectSurface('w-1', fetchImpl)).resolves.toEqual(value)
    expect(fetchImpl).toHaveBeenCalledWith('/api/fde-project/snapshot', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ workspaceId: 'w-1' }),
    }))
  })

  it('publishes one load and replaces it on explicit refresh', async () => {
    const original = globalThis.fetch
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ ok: true, value }), { status: 200 }))
    globalThis.fetch = fetchImpl
    try {
      const controller = new FdeProjectSurfaceController()
      controller.load('w-1')
      await vi.waitFor(() => { expect(controller.getSnapshot().byWorkspace['w-1']?.status).toBe('ready') })
      controller.load('w-1')
      expect(fetchImpl).toHaveBeenCalledTimes(1)
      controller.refresh('w-1')
      await vi.waitFor(() => { expect(fetchImpl).toHaveBeenCalledTimes(2) })
      controller.dispose()
    } finally {
      globalThis.fetch = original
    }
  })

  it('begins one project runtime operation through the exact same-origin route', async () => {
    const starting = { ...value, runtime: {
      schemaVersion: 1 as const, revision: 1, status: 'starting' as const,
      action: 'start' as const, operationId: `runtime_${'1'.repeat(32)}`,
      sessionId: 'session-1', updatedAt: '2026-08-27T00:00:00.000Z',
    } }
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ ok: true, value: starting }), { status: 200 }))
    await expect(startProjectRuntime('w-1', 'session-1', fetchImpl)).resolves.toEqual(starting)
    expect(fetchImpl).toHaveBeenCalledWith('/api/fde-project/runtime/start', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ workspaceId: 'w-1', sessionId: 'session-1' }),
    }))
  })

  it('confirms one exact validation contract through the same-origin route', async () => {
    const digest = `sha256:${'1'.repeat(64)}`
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ ok: true, value }), { status: 200 }))
    await expect(confirmValidationPlan('w-1', digest, fetchImpl)).resolves.toEqual(value)
    expect(fetchImpl).toHaveBeenCalledWith('/api/fde-project/validation/confirm-plan', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ workspaceId: 'w-1', contractDigest: digest }),
    }))
  })

  it('submits one explained validation issue waiver through the same-origin route', async () => {
    const digest = `sha256:${'1'.repeat(64)}`
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ ok: true, value }), { status: 200 }))
    await expect(waiveValidationIssue(
      'w-1', digest, 'customer-reconciliation', '客户确认本轮接受，后续补充真实对账数据。', fetchImpl,
    )).resolves.toEqual(value)
    expect(fetchImpl).toHaveBeenCalledWith('/api/fde-project/validation/waive-issue', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        workspaceId: 'w-1', contractDigest: digest, issueId: 'customer-reconciliation',
        reason: '客户确认本轮接受，后续补充真实对账数据。',
      }),
    }))
  })

  it('submits one explained required-metric acceptance through the same-origin route', async () => {
    const digest = `sha256:${'1'.repeat(64)}`
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ ok: true, value }), { status: 200 }))
    await expect(acceptValidationMetric(
      'w-1', digest, 'million-row-performance', '客户确认本轮不具备正式性能设备，试运行阶段补测。', fetchImpl,
    )).resolves.toEqual(value)
    expect(fetchImpl).toHaveBeenCalledWith('/api/fde-project/validation/accept-metric', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        workspaceId: 'w-1', contractDigest: digest, metricId: 'million-row-performance',
        reason: '客户确认本轮不具备正式性能设备，试运行阶段补测。',
      }),
    }))
  })

  it('confirms the exact deployment-trial readiness contract through the same-origin route', async () => {
    const digest = `sha256:${'2'.repeat(64)}`
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ ok: true, value }), { status: 200 }))
    await expect(confirmDeploymentTrialReadiness('w-1', digest, fetchImpl)).resolves.toEqual(value)
    expect(fetchImpl).toHaveBeenCalledWith('/api/fde-project/pilot/confirm-readiness', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ workspaceId: 'w-1', contractDigest: digest }),
    }))
  })

  it('records one exact evidence-backed acceptance and handover decision', async () => {
    const digest = `sha256:${'3'.repeat(64)}`
    const decision = {
      acceptance: { status: 'accepted' as const, summary: '客户已经签署验收记录。', evidence: ['records/acceptance.md'] },
      deliverables: [{ id: 'source', available: true }],
      conditions: [{ id: 'C-1', status: 'resolved' as const }],
      handover: {
        trainingCompleted: true,
        accessResponsibilityTransferred: true,
        operationsResponsibilityTransferred: true,
        evidence: ['records/handover.md'],
      },
    }
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ ok: true, value }), { status: 200 }))
    await expect(recordAcceptanceHandoverDecision('w-1', digest, decision, fetchImpl)).resolves.toEqual(value)
    expect(fetchImpl).toHaveBeenCalledWith('/api/fde-project/handoff/record-decision', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ workspaceId: 'w-1', contractDigest: digest, decision }),
    }))
  })

  it('cancels a pending project read when another project becomes active', async () => {
    const original = globalThis.fetch
    let firstSignal: AbortSignal | undefined
    const fetchImpl: typeof fetch = async (_input, init) => {
      const body = init?.body
      if (typeof body !== 'string') throw new Error('expected a JSON request body')
      const workspaceId = JSON.parse(body) as { workspaceId: string }
      if (workspaceId.workspaceId === 'w-1') {
        firstSignal = init?.signal instanceof AbortSignal ? init.signal : undefined
        return await new Promise<Response>((_resolve, reject) => {
          firstSignal?.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'))
          }, { once: true })
        })
      }
      return new Response(JSON.stringify({ ok: true, value: { ...value, workspaceId: 'w-2' } }), { status: 200 })
    }
    globalThis.fetch = fetchImpl
    try {
      const controller = new FdeProjectSurfaceController()
      controller.load('w-1')
      controller.load('w-2')
      await vi.waitFor(() => { expect(firstSignal?.aborted).toBe(true) })
      await vi.waitFor(() => { expect(controller.getSnapshot().byWorkspace['w-2']?.status).toBe('ready') })
      controller.dispose()
    } finally {
      globalThis.fetch = original
    }
  })
})
