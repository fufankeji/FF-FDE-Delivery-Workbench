/** Trusted same-origin HTTP operations for the stage-four Semantica provider. */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { ProjectSurfaceSnapshot } from '@deepseek-ai/dsh-fde-project'
import type { FdeDesignDecisionOutcome, SemanticDefinition } from './types.ts'

const MAX_BODY_BYTES = 1024 * 1024

export class SemanticaRouteError extends Error {
  constructor(readonly code: string, readonly status: number, message: string) {
    super(message)
    this.name = 'SemanticaRouteError'
  }
}

export interface SemanticaRouteOptions {
  readonly trusted: (request: IncomingMessage) => boolean
  readonly workspacePath: (workspaceId: string) => string | undefined
  readonly snapshot: (workspaceId: string) => Promise<ProjectSurfaceSnapshot | undefined>
  readonly configureRoute: (root: string, input: {
    readonly execution: {
      readonly mechanism: 'manual' | 'rules' | 'software' | 'retrieval' | 'model' | 'agent' | 'hybrid'
      readonly label: string
      readonly rationale: string
    }
    readonly semantics: { readonly mode: 'schema' | 'ontology'; readonly rationale: string }
  }) => Promise<unknown>
  readonly bindSources: (
    root: string,
    sourceIds: readonly string[],
    permissionScope: string,
    authority: 'primary' | 'supporting',
  ) => Promise<unknown>
  readonly saveDefinition: (
    root: string,
    expectedRevision: number,
    input: Omit<SemanticDefinition, 'status' | 'revision' | 'digest' | 'updatedAt'>,
  ) => Promise<unknown>
  readonly reviewCandidates: (
    root: string,
    decisions: readonly { readonly id: string; readonly decision: 'accepted' | 'rejected' }[],
  ) => Promise<unknown>
  readonly run: (
    root: string,
    action: 'health' | 'extract' | 'propose-schema' | 'publish-schema' | 'build' | 'validate' | 'context',
    input: Record<string, unknown>,
  ) => Promise<unknown>
  readonly reportSlice: (root: string, input: {
    readonly status: 'succeeded' | 'failed'
    readonly task: string
    readonly result: string
    readonly contextRunId?: string
    readonly evidenceRefs: readonly string[]
    readonly diagnostics?: readonly string[]
  }) => Promise<unknown>
  readonly recordDecision: (
    root: string,
    expectedRevision: number,
    outcome: FdeDesignDecisionOutcome,
    rationale: string,
  ) => Promise<unknown>
  readonly reportFailure?: (error: unknown) => void
}

type Handler = (request: IncomingMessage, response: ServerResponse) => Promise<void>

function json(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  response.end(JSON.stringify(value))
}

function record(value: unknown, label = '请求'): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new SemanticaRouteError('invalid-request', 400, `${label}必须是 JSON 对象。`)
  return value as Record<string, unknown>
}

function text(value: unknown, label: string, max: number): string {
  if (typeof value !== 'string' || value.trim() === '' || value.trim().length > max) throw new SemanticaRouteError('invalid-request', 400, `${label}必须是 1 到 ${String(max)} 个字符。`)
  return value.trim()
}

function optionalText(value: unknown, label: string, max: number): string | undefined {
  if (value === undefined) return undefined
  return text(value, label, max)
}

function stringArray(value: unknown, label: string, maxItems: number): readonly string[] {
  if (!Array.isArray(value) || value.length > maxItems) throw new SemanticaRouteError('invalid-request', 400, `${label}必须是最多 ${String(maxItems)} 项的字符串数组。`)
  return value.map((item, index) => text(item, `${label}[${String(index)}]`, 1_000))
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  if (!(request.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) {
    request.resume(); throw new SemanticaRouteError('unsupported-content-type', 415, 'Semantica 请求必须使用 application/json。')
  }
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of request) {
    if (typeof chunk !== 'string' && !(chunk instanceof Uint8Array)) {
      throw new SemanticaRouteError('invalid-request', 400, 'Semantica 请求包含无效字节。')
    }
    const bytes = Buffer.from(chunk)
    total += bytes.byteLength
    if (total > MAX_BODY_BYTES) { request.resume(); throw new SemanticaRouteError('request-too-large', 413, 'Semantica 请求超过 1 MiB 限制。') }
    chunks.push(bytes)
  }
  try { return record(JSON.parse(Buffer.concat(chunks, total).toString('utf8')) as unknown) } catch (error) {
    if (error instanceof SemanticaRouteError) throw error
    throw new SemanticaRouteError('invalid-json', 400, 'Semantica 请求不是有效 JSON。')
  }
}

function workspace(options: SemanticaRouteOptions, body: Record<string, unknown>): { readonly id: string; readonly root: string } {
  const id = text(body.workspaceId, 'workspaceId', 512)
  const root = options.workspacePath(id)
  if (root === undefined) throw new SemanticaRouteError('workspace-not-found', 404, '项目不存在或已从工作台移除。')
  return { id, root }
}

function fail(options: SemanticaRouteOptions, response: ServerResponse, error: unknown): void {
  if (error instanceof SemanticaRouteError) {
    json(response, error.status, { ok: false, error: { code: error.code, message: error.message } }); return
  }
  options.reportFailure?.(error)
  json(response, 409, { ok: false, error: { code: 'semantica-operation-failed', message: error instanceof Error ? error.message : 'Semantica 操作失败。' } })
}

function post(options: SemanticaRouteOptions, action: (body: Record<string, unknown>, root: string) => Promise<void>): Handler {
  return async (request, response) => {
    if (!options.trusted(request)) { request.resume(); json(response, 403, { ok: false, error: { code: 'forbidden', message: '只允许本机项目工作台调用 Semantica。' } }); return }
    if (request.method !== 'POST') { request.resume(); response.setHeader('allow', 'POST'); json(response, 405, { ok: false, error: { code: 'method-not-allowed', message: 'Semantica 操作只接受 POST。' } }); return }
    try {
      const body = await readJson(request)
      const addressed = workspace(options, body)
      await action(body, addressed.root)
      const snapshot = await options.snapshot(addressed.id)
      if (snapshot === undefined) throw new SemanticaRouteError('workspace-not-found', 404, '项目不存在或已从工作台移除。')
      json(response, 200, { ok: true, value: snapshot })
    } catch (error) { fail(options, response, error) }
  }
}

/** Save the two independent mechanism choices. */
export function createDesignRouteHandler(options: SemanticaRouteOptions): Handler {
  return post(options, async (body, root) => {
    const execution = record(body.execution, 'execution')
    const semantics = record(body.semantics, 'semantics')
    const mechanism = execution.mechanism
    if (mechanism !== 'manual' && mechanism !== 'rules' && mechanism !== 'software' && mechanism !== 'retrieval' && mechanism !== 'model' && mechanism !== 'agent' && mechanism !== 'hybrid') {
      throw new SemanticaRouteError('invalid-request', 400, '执行机制无效。')
    }
    const mode = semantics.mode
    if (mode !== 'schema' && mode !== 'ontology') throw new SemanticaRouteError('invalid-request', 400, '语义基础必须是 schema 或 ontology。')
    await options.configureRoute(root, {
      execution: { mechanism, label: text(execution.label, '执行机制名称', 120), rationale: text(execution.rationale, '执行机制依据', 2_000) },
      semantics: { mode, rationale: text(semantics.rationale, '语义基础依据', 2_000) },
    })
  })
}

/** Bind already-indexed project Sources without duplicate upload. */
export function createSourceBindingHandler(options: SemanticaRouteOptions): Handler {
  return post(options, async (body, root) => {
    const authority = body.authority === 'supporting' ? 'supporting' : 'primary'
    await options.bindSources(root, stringArray(body.sourceIds, 'sourceIds', 12), text(body.permissionScope, '材料权限范围', 1_000), authority)
  })
}

/** Save one exact editable definition revision. */
export function createDefinitionHandler(options: SemanticaRouteOptions): Handler {
  return post(options, async (body, root) => {
    if (!Number.isSafeInteger(body.expectedRevision) || Number(body.expectedRevision) < 0) throw new SemanticaRouteError('invalid-request', 400, 'expectedRevision 无效。')
    await options.saveDefinition(root, Number(body.expectedRevision), record(body.definition, 'definition') as unknown as Omit<SemanticDefinition, 'status' | 'revision' | 'digest' | 'updatedAt'>)
  })
}

/** Apply bounded candidate accept/reject decisions. */
export function createCandidateReviewHandler(options: SemanticaRouteOptions): Handler {
  return post(options, async (body, root) => {
    if (!Array.isArray(body.decisions) || body.decisions.length > 1_000) throw new SemanticaRouteError('invalid-request', 400, '候选审核决定无效。')
    const decisions = body.decisions.map((value, index) => {
      const item = record(value, `decisions[${String(index)}]`)
      if (item.decision !== 'accepted' && item.decision !== 'rejected') throw new SemanticaRouteError('invalid-request', 400, '候选审核状态无效。')
      const decision: 'accepted' | 'rejected' = item.decision
      return { id: text(item.id, '候选 ID', 160), decision }
    })
    await options.reviewCandidates(root, decisions)
  })
}

/** Run one explicit Semantica step; build and validation remain independent. */
export function createProviderRunHandler(options: SemanticaRouteOptions): Handler {
  return post(options, async (body, root) => {
    const action = body.action
    if (action !== 'health' && action !== 'extract' && action !== 'propose-schema' && action !== 'publish-schema' && action !== 'build' && action !== 'validate' && action !== 'context') {
      throw new SemanticaRouteError('invalid-request', 400, 'Semantica 运行步骤无效。')
    }
    const input = body.input === undefined ? {} : record(body.input, 'input')
    if (action === 'context') {
      input.query = text(input.query, '上下文查询目的', 1_000)
      input.questionId = optionalText(input.questionId, '能力问题 ID', 120)
      input.seedNodeId = optionalText(input.seedNodeId, '起始实体 ID', 200)
      input.maxDepth = Number.isSafeInteger(input.maxDepth) ? Math.max(0, Math.min(3, Number(input.maxDepth))) : 1
      if (input.questionId === undefined && input.seedNodeId === undefined) throw new SemanticaRouteError('invalid-request', 400, '受控查询至少选择一个能力问题或起始实体。')
    }
    await options.run(root, action, input)
  })
}

/** Record a real slice result supplied by the executing Agent or FDE. */
export function createSliceReportHandler(options: SemanticaRouteOptions): Handler {
  return post(options, async (body, root) => {
    if (body.status !== 'succeeded' && body.status !== 'failed') throw new SemanticaRouteError('invalid-request', 400, '纵向切片状态无效。')
    const contextRunId = optionalText(body.contextRunId, 'Agent Context 运行 ID', 160)
    await options.reportSlice(root, {
      status: body.status,
      task: text(body.task, '纵向切片任务', 2_000), result: text(body.result, '纵向切片结果', 4_000),
      ...(contextRunId === undefined ? {} : { contextRunId }),
      evidenceRefs: stringArray(body.evidenceRefs, '纵向切片证据', 32),
      ...(body.diagnostics === undefined ? {} : { diagnostics: stringArray(body.diagnostics, '纵向切片诊断', 32) }),
    })
  })
}

/** Save one explicit FDE stage-four outcome without conflating it with the mechanism conclusion. */
export function createDesignDecisionHandler(options: SemanticaRouteOptions): Handler {
  return post(options, async (body, root) => {
    if (!Number.isSafeInteger(body.expectedRevision) || Number(body.expectedRevision) < 0) {
      throw new SemanticaRouteError('invalid-request', 400, 'expectedRevision 无效。')
    }
    const outcome = body.outcome
    if (outcome !== 'go' && outcome !== 'revise' && outcome !== 'narrow' && outcome !== 'stop') {
      throw new SemanticaRouteError('invalid-request', 400, 'FDE 决定必须是 go、revise、narrow 或 stop。')
    }
    await options.recordDecision(root, Number(body.expectedRevision), outcome, text(body.rationale, 'FDE 决定依据', 2_000))
  })
}
