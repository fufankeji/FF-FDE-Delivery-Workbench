import type { IncomingMessage, ServerResponse } from 'node:http'
import { describe, expect, it, vi } from 'vitest'
import {
  createCandidateReviewHandler,
  createDefinitionHandler,
  createDesignDecisionHandler,
  createDesignRouteHandler,
  createProviderRunHandler,
  createSliceReportHandler,
  createSourceBindingHandler,
  type SemanticaRouteOptions,
} from '../src/routes.ts'

function request(body: unknown, method = 'POST'): IncomingMessage {
  const bytes = Buffer.from(JSON.stringify(body))
  return {
    method,
    headers: { 'content-type': 'application/json', 'content-length': String(bytes.byteLength) },
    resume: vi.fn(),
    async *[Symbol.asyncIterator]() { yield bytes },
  } as unknown as IncomingMessage
}

function response() {
  let status = 0
  let body = ''
  const headers = new Map<string, string>()
  return {
    value: {
      setHeader: (name: string, value: string) => { headers.set(name, value) },
      writeHead: (next: number) => { status = next },
      end: (next?: string | Uint8Array) => { body = next === undefined ? '' : String(next) },
    } as unknown as ServerResponse,
    snapshot: () => ({ status, body: JSON.parse(body) as Record<string, unknown>, headers }),
  }
}

function options(overrides: Partial<SemanticaRouteOptions> = {}) {
  return {
    trusted: vi.fn(() => true),
    workspacePath: vi.fn((workspaceId: string) => workspaceId === 'project-a' ? '/workspace/a' : undefined),
    snapshot: vi.fn(async (workspaceId: string) => ({ workspaceId, title: 'Project A' }) as never),
    configureRoute: vi.fn(async () => ({})),
    bindSources: vi.fn(async () => ({})),
    saveDefinition: vi.fn(async () => ({})),
    reviewCandidates: vi.fn(async () => ({})),
    run: vi.fn(async () => ({})),
    reportSlice: vi.fn(async () => ({})),
    recordDecision: vi.fn(async () => ({})),
    ...overrides,
  } satisfies SemanticaRouteOptions
}

describe('stage-four Semantica same-origin routes', () => {
  it('saves the two route axes only inside the addressed Workspace', async () => {
    const configured = options()
    const handler = createDesignRouteHandler(configured)
    const output = response()
    await handler(request({
      workspaceId: 'project-a',
      execution: { mechanism: 'hybrid', label: '规则与 Agent', rationale: '确定性步骤与受控建议需要组合。' },
      semantics: { mode: 'ontology', rationale: '需要跨来源身份统一与多跳查询。' },
    }), output.value)

    expect(output.snapshot()).toMatchObject({ status: 200, body: { ok: true, value: { workspaceId: 'project-a' } } })
    expect(configured.configureRoute).toHaveBeenCalledWith('/workspace/a', {
      execution: { mechanism: 'hybrid', label: '规则与 Agent', rationale: '确定性步骤与受控建议需要组合。' },
      semantics: { mode: 'ontology', rationale: '需要跨来源身份统一与多跳查询。' },
    })

    const missing = response()
    await handler(request({
      workspaceId: 'project-b',
      execution: { mechanism: 'rules', label: '规则', rationale: '确定性条件。' },
      semantics: { mode: 'schema', rationale: '普通 Schema 足够。' },
    }), missing.value)
    expect(missing.snapshot()).toMatchObject({ status: 404, body: { ok: false, error: { code: 'workspace-not-found' } } })
    expect(configured.configureRoute).toHaveBeenCalledTimes(1)
  })

  it('binds project Sources and forwards one optimistic-lock definition revision', async () => {
    const configured = options()
    const sourceResponse = response()
    await createSourceBindingHandler(configured)(request({
      workspaceId: 'project-a', sourceIds: ['source-1', 'source-2'],
      permissionScope: '仅限第四阶段代表样本', authority: 'supporting',
    }), sourceResponse.value)
    expect(sourceResponse.snapshot().status).toBe(200)
    expect(configured.bindSources).toHaveBeenCalledWith('/workspace/a', ['source-1', 'source-2'], '仅限第四阶段代表样本', 'supporting')

    const definition = { version: '0.1.0', classes: [], relationships: [] }
    const definitionResponse = response()
    await createDefinitionHandler(configured)(request({ workspaceId: 'project-a', expectedRevision: 4, definition }), definitionResponse.value)
    expect(definitionResponse.snapshot().status).toBe(200)
    expect(configured.saveDefinition).toHaveBeenCalledWith('/workspace/a', 4, definition)
  })

  it('forwards explicit candidate decisions without treating pending candidates as accepted', async () => {
    const configured = options()
    const output = response()
    await createCandidateReviewHandler(configured)(request({
      workspaceId: 'project-a',
      decisions: [{ id: 'entity-1', decision: 'accepted' }, { id: 'relation-1', decision: 'rejected' }],
    }), output.value)
    expect(output.snapshot().status).toBe(200)
    expect(configured.reviewCandidates).toHaveBeenCalledWith('/workspace/a', [
      { id: 'entity-1', decision: 'accepted' }, { id: 'relation-1', decision: 'rejected' },
    ])
  })

  it('bounds context traversal and rejects a context request without a question or seed', async () => {
    const configured = options()
    const output = response()
    await createProviderRunHandler(configured)(request({
      workspaceId: 'project-a', action: 'context', input: {
        query: '只返回当前任务需要的事实', seedNodeId: 'node-1', maxDepth: 99,
      },
    }), output.value)
    expect(output.snapshot().status).toBe(200)
    expect(configured.run).toHaveBeenCalledWith('/workspace/a', 'context', {
      query: '只返回当前任务需要的事实', seedNodeId: 'node-1', maxDepth: 3,
    })

    const invalid = response()
    await createProviderRunHandler(configured)(request({
      workspaceId: 'project-a', action: 'context', input: { query: '缺少入口实体', maxDepth: 1 },
    }), invalid.value)
    expect(invalid.snapshot()).toMatchObject({ status: 400, body: { ok: false, error: { code: 'invalid-request' } } })
    expect(configured.run).toHaveBeenCalledTimes(1)
  })

  it('records a truthful slice result and an independent version-bound FDE decision', async () => {
    const configured = options()
    const sliceResponse = response()
    await createSliceReportHandler(configured)(request({
      workspaceId: 'project-a', status: 'failed', task: '运行最窄任务', result: '接口返回权限拒绝',
      contextRunId: 'context-7', evidenceRefs: ['evidence/slice.log'], diagnostics: ['HTTP 403'],
    }), sliceResponse.value)
    expect(sliceResponse.snapshot().status).toBe(200)
    expect(configured.reportSlice).toHaveBeenCalledWith('/workspace/a', {
      status: 'failed', task: '运行最窄任务', result: '接口返回权限拒绝', contextRunId: 'context-7',
      evidenceRefs: ['evidence/slice.log'], diagnostics: ['HTTP 403'],
    })

    const decisionResponse = response()
    await createDesignDecisionHandler(configured)(request({
      workspaceId: 'project-a', expectedRevision: 17, outcome: 'narrow', rationale: '动作权限不足，收窄为只读建议。',
    }), decisionResponse.value)
    expect(decisionResponse.snapshot().status).toBe(200)
    expect(configured.recordDecision).toHaveBeenCalledWith('/workspace/a', 17, 'narrow', '动作权限不足，收窄为只读建议。')
  })

  it('rejects untrusted callers before reading or mutating project state', async () => {
    const configured = options({ trusted: vi.fn(() => false) })
    const output = response()
    await createProviderRunHandler(configured)(request({ workspaceId: 'project-a', action: 'health' }), output.value)
    expect(output.snapshot()).toMatchObject({ status: 403, body: { ok: false, error: { code: 'forbidden' } } })
    expect(configured.workspacePath).not.toHaveBeenCalled()
    expect(configured.run).not.toHaveBeenCalled()
  })
})
