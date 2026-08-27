/** Trusted same-origin route for project delivery read models. */

import { readFile } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { ProjectSurfaceSnapshot } from './types.ts'

const MAX_BODY_BYTES = 16 * 1024

/** HTTP-safe project request failure with a stable code and status. */
export class FdeProjectRequestError extends Error {
  constructor(readonly code: string, readonly status: number, message: string) {
    super(message)
    this.name = 'FdeProjectRequestError'
  }
}

/** Dependencies of the trusted project snapshot route. */
export interface ProjectRouteOptions {
  readonly trusted: (request: IncomingMessage) => boolean
  readonly snapshot: (workspaceId: string) => Promise<ProjectSurfaceSnapshot | undefined>
  readonly reportFailure?: (error: unknown) => void
}

/** Dependencies of the verified fixed-artifact file route. */
export interface RequirementArtifactFileRouteOptions {
  readonly trusted: (request: IncomingMessage) => boolean
  readonly artifact: (workspaceId: string, artifactId: string) => Promise<{
    readonly name: string
    readonly filePath: string
    readonly bytes: number
  } | undefined>
  readonly maxFileBytes: number
  readonly reportFailure?: (error: unknown) => void
}

/** Dependencies of the exact-revision architecture confirmation route. */
export interface ArchitectureConfirmRouteOptions {
  readonly trusted: (request: IncomingMessage) => boolean
  readonly confirm: (workspaceId: string, revision: number) => Promise<ProjectSurfaceSnapshot | undefined>
  readonly reportFailure?: (error: unknown) => void
}

/** Dependencies of the exact-contract validation-plan confirmation route. */
export interface ValidationPlanConfirmRouteOptions {
  readonly trusted: (request: IncomingMessage) => boolean
  readonly confirm: (workspaceId: string, contractDigest: string) => Promise<ProjectSurfaceSnapshot | undefined>
  readonly reportFailure?: (error: unknown) => void
}

/** Dependencies of the exact-contract validation-metric acceptance route. */
export interface ValidationMetricAcceptRouteOptions {
  readonly trusted: (request: IncomingMessage) => boolean
  readonly accept: (
    workspaceId: string,
    contractDigest: string,
    metricId: string,
    reason: string,
  ) => Promise<ProjectSurfaceSnapshot | undefined>
  readonly reportFailure?: (error: unknown) => void
}

/** Dependencies of the exact-contract validation-issue waiver route. */
export interface ValidationIssueWaiveRouteOptions {
  readonly trusted: (request: IncomingMessage) => boolean
  readonly waive: (
    workspaceId: string,
    contractDigest: string,
    issueId: string,
    reason: string,
  ) => Promise<ProjectSurfaceSnapshot | undefined>
  readonly reportFailure?: (error: unknown) => void
}

/** Dependencies of the exact-contract deployment-trial issue acceptance route. */
export interface DeploymentTrialIssueAcceptRouteOptions {
  readonly trusted: (request: IncomingMessage) => boolean
  readonly accept: (
    workspaceId: string,
    contractDigest: string,
    issueId: string,
    reason: string,
  ) => Promise<ProjectSurfaceSnapshot | undefined>
  readonly reportFailure?: (error: unknown) => void
}

/** Dependencies of the exact-contract deployment-trial readiness confirmation route. */
export interface DeploymentTrialReadinessConfirmRouteOptions {
  readonly trusted: (request: IncomingMessage) => boolean
  readonly confirm: (
    workspaceId: string,
    contractDigest: string,
  ) => Promise<ProjectSurfaceSnapshot | undefined>
  readonly reportFailure?: (error: unknown) => void
}

/** Dependencies of the exact-contract acceptance-handover decision route. */
export interface AcceptanceHandoverDecisionRouteOptions {
  readonly trusted: (request: IncomingMessage) => boolean
  readonly record: (
    workspaceId: string,
    contractDigest: string,
    decision: unknown,
  ) => Promise<ProjectSurfaceSnapshot | undefined>
  readonly reportFailure?: (error: unknown) => void
}

/** Dependencies of the project evaluation baseline route. */
export interface EvaluationBaselineRouteOptions {
  readonly trusted: (request: IncomingMessage) => boolean
  readonly approve: (workspaceId: string, reportPath: string) => Promise<ProjectSurfaceSnapshot | undefined>
  readonly reportFailure?: (error: unknown) => void
}

/** Dependencies of the explicit requirement-Wiki build start route. */
export interface RequirementWikiStartRouteOptions {
  readonly trusted: (request: IncomingMessage) => boolean
  readonly start: (
    workspaceId: string,
    sourceIds: readonly string[],
    expectedRevision: number,
  ) => Promise<ProjectSurfaceSnapshot | undefined>
  readonly reportFailure?: (error: unknown) => void
}

/** Dependencies of the explicit requirement-Wiki build abandonment route. */
export interface RequirementWikiAbandonRouteOptions {
  readonly trusted: (request: IncomingMessage) => boolean
  readonly abandon: (workspaceId: string, buildId: string) => Promise<ProjectSurfaceSnapshot | undefined>
  readonly reportFailure?: (error: unknown) => void
}

/** Dependencies of a project runtime start/stop route. */
export interface ProjectRuntimeActionRouteOptions {
  readonly trusted: (request: IncomingMessage) => boolean
  readonly act: (workspaceId: string, sessionId: string) => Promise<ProjectSurfaceSnapshot | undefined>
  readonly reportFailure?: (error: unknown) => void
}

/** Dependencies of a project runtime operation abandonment route. */
export interface ProjectRuntimeAbandonRouteOptions {
  readonly trusted: (request: IncomingMessage) => boolean
  readonly abandon: (workspaceId: string, operationId: string, message: string) => Promise<ProjectSurfaceSnapshot | undefined>
  readonly reportFailure?: (error: unknown) => void
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Uint8Array[] = []
  let total = 0
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    total += bytes.byteLength
    if (total > MAX_BODY_BYTES) {
      request.resume()
      throw new FdeProjectRequestError('invalid-request', 400, '项目页面请求过大。')
    }
    chunks.push(bytes)
  }
  try { return JSON.parse(Buffer.concat(chunks, total).toString('utf8')) as unknown } catch {
    throw new FdeProjectRequestError('invalid-json', 400, '项目页面请求不是有效 JSON。')
  }
}

function workspaceIdOf(value: unknown): string {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new FdeProjectRequestError('invalid-request', 400, '项目页面请求缺少项目。')
  }
  const id = (value as { workspaceId?: unknown }).workspaceId
  if (typeof id !== 'string' || id.trim() === '') throw new FdeProjectRequestError('invalid-request', 400, '项目页面请求缺少项目。')
  return id
}

function architectureConfirmationOf(value: unknown): { readonly workspaceId: string; readonly revision: number } {
  const workspaceId = workspaceIdOf(value)
  const revision = (value as { revision?: unknown }).revision
  if (!Number.isSafeInteger(revision) || Number(revision) < 1) {
    throw new FdeProjectRequestError('invalid-request', 400, '系统架构确认请求缺少有效版本。')
  }
  return { workspaceId, revision: Number(revision) }
}

function validationPlanConfirmationOf(value: unknown): { readonly workspaceId: string; readonly contractDigest: string } {
  const workspaceId = workspaceIdOf(value)
  const contractDigest = (value as { contractDigest?: unknown }).contractDigest
  if (typeof contractDigest !== 'string' || !/^sha256:[a-f0-9]{64}$/u.test(contractDigest)) {
    throw new FdeProjectRequestError('invalid-request', 400, '评估方案确认请求缺少有效合同摘要。')
  }
  return { workspaceId, contractDigest }
}

function validationMetricAcceptanceOf(value: unknown): {
  readonly workspaceId: string
  readonly contractDigest: string
  readonly metricId: string
  readonly reason: string
} {
  const workspaceId = workspaceIdOf(value)
  const input = value as { contractDigest?: unknown; metricId?: unknown; reason?: unknown }
  if (typeof input.contractDigest !== 'string' || !/^sha256:[a-f0-9]{64}$/u.test(input.contractDigest)) {
    throw new FdeProjectRequestError('invalid-request', 400, '人工接受指标请求缺少有效合同摘要。')
  }
  if (typeof input.metricId !== 'string' || !/^[a-z0-9][a-z0-9._-]{0,119}$/iu.test(input.metricId)) {
    throw new FdeProjectRequestError('invalid-request', 400, '人工接受指标请求缺少有效指标标识。')
  }
  if (typeof input.reason !== 'string' || input.reason.trim() === '' || input.reason.trim().length > 1_000) {
    throw new FdeProjectRequestError('invalid-request', 400, '请填写 1 到 1000 个字符的人工接受理由。')
  }
  return {
    workspaceId,
    contractDigest: input.contractDigest,
    metricId: input.metricId,
    reason: input.reason.trim(),
  }
}

function validationIssueWaiverOf(value: unknown): {
  readonly workspaceId: string
  readonly contractDigest: string
  readonly issueId: string
  readonly reason: string
} {
  const workspaceId = workspaceIdOf(value)
  const input = value as { contractDigest?: unknown; issueId?: unknown; reason?: unknown }
  if (typeof input.contractDigest !== 'string' || !/^sha256:[a-f0-9]{64}$/u.test(input.contractDigest)) {
    throw new FdeProjectRequestError('invalid-request', 400, '人工关闭问题请求缺少有效合同摘要。')
  }
  if (typeof input.issueId !== 'string' || !/^[a-z0-9][a-z0-9._-]{0,119}$/iu.test(input.issueId)) {
    throw new FdeProjectRequestError('invalid-request', 400, '人工关闭问题请求缺少有效问题标识。')
  }
  if (typeof input.reason !== 'string' || input.reason.trim() === '' || input.reason.trim().length > 1_000) {
    throw new FdeProjectRequestError('invalid-request', 400, '请填写 1 到 1000 个字符的人工接受理由。')
  }
  return {
    workspaceId,
    contractDigest: input.contractDigest,
    issueId: input.issueId,
    reason: input.reason.trim(),
  }
}

function deploymentTrialIssueAcceptanceOf(value: unknown): {
  readonly workspaceId: string
  readonly contractDigest: string
  readonly issueId: string
  readonly reason: string
} {
  const workspaceId = workspaceIdOf(value)
  const input = value as { contractDigest?: unknown; issueId?: unknown; reason?: unknown }
  if (typeof input.contractDigest !== 'string' || !/^sha256:[a-f0-9]{64}$/u.test(input.contractDigest)) {
    throw new FdeProjectRequestError('invalid-request', 400, '人工接受试运行问题请求缺少有效合同摘要。')
  }
  if (typeof input.issueId !== 'string' || !/^[a-z0-9][a-z0-9._-]{0,119}$/iu.test(input.issueId)) {
    throw new FdeProjectRequestError('invalid-request', 400, '人工接受试运行问题请求缺少有效问题标识。')
  }
  if (typeof input.reason !== 'string' || input.reason.trim() === '' || input.reason.trim().length > 1_000) {
    throw new FdeProjectRequestError('invalid-request', 400, '请填写 1 到 1000 个字符的人工接受理由。')
  }
  return {
    workspaceId,
    contractDigest: input.contractDigest,
    issueId: input.issueId,
    reason: input.reason.trim(),
  }
}

function deploymentTrialReadinessConfirmationOf(value: unknown): {
  readonly workspaceId: string
  readonly contractDigest: string
} {
  const workspaceId = workspaceIdOf(value)
  const contractDigest = (value as { contractDigest?: unknown }).contractDigest
  if (typeof contractDigest !== 'string' || !/^sha256:[a-f0-9]{64}$/u.test(contractDigest)) {
    throw new FdeProjectRequestError('invalid-request', 400, '确认部署试运行结论请求缺少有效合同摘要。')
  }
  return { workspaceId, contractDigest }
}

function acceptanceHandoverDecisionOf(value: unknown): {
  readonly workspaceId: string
  readonly contractDigest: string
  readonly decision: unknown
} {
  const workspaceId = workspaceIdOf(value)
  const input = value as { contractDigest?: unknown; decision?: unknown }
  if (typeof input.contractDigest !== 'string' || !/^sha256:[a-f0-9]{64}$/u.test(input.contractDigest)) {
    throw new FdeProjectRequestError('invalid-request', 400, '验收移交人工记录请求缺少有效合同摘要。')
  }
  if (input.decision === null || typeof input.decision !== 'object' || Array.isArray(input.decision)) {
    throw new FdeProjectRequestError('invalid-request', 400, '验收移交人工记录请求缺少结构化决定。')
  }
  return { workspaceId, contractDigest: input.contractDigest, decision: input.decision }
}

function evaluationBaselineOf(value: unknown): { readonly workspaceId: string; readonly reportPath: string } {
  const workspaceId = workspaceIdOf(value)
  const reportPath = (value as { reportPath?: unknown }).reportPath
  if (typeof reportPath !== 'string' || reportPath.trim() === '') {
    throw new FdeProjectRequestError('invalid-request', 400, '评估基线请求缺少报告路径。')
  }
  return { workspaceId, reportPath }
}

function requirementWikiStartOf(value: unknown): {
  readonly workspaceId: string
  readonly sourceIds: readonly string[]
  readonly expectedRevision: number
} {
  const workspaceId = workspaceIdOf(value)
  const sourceIds = (value as { sourceIds?: unknown }).sourceIds
  const expectedRevision = (value as { expectedRevision?: unknown }).expectedRevision
  if (!Array.isArray(sourceIds) || sourceIds.length === 0 || sourceIds.length > 30
    || !sourceIds.every((sourceId): sourceId is string => typeof sourceId === 'string' && sourceId.trim() !== '')
    || new Set(sourceIds).size !== sourceIds.length) {
    throw new FdeProjectRequestError('invalid-request', 400, '需求整理请求需要 1 到 30 个不重复的项目资料标识。')
  }
  if (!Number.isSafeInteger(expectedRevision) || Number(expectedRevision) < 0) {
    throw new FdeProjectRequestError('invalid-request', 400, '需求整理请求缺少有效的当前版本。')
  }
  return { workspaceId, sourceIds, expectedRevision: Number(expectedRevision) }
}

function requirementWikiAbandonOf(value: unknown): { readonly workspaceId: string; readonly buildId: string } {
  const workspaceId = workspaceIdOf(value)
  const buildId = (value as { buildId?: unknown }).buildId
  if (typeof buildId !== 'string' || !/^wiki_[a-f0-9]{32}$/u.test(buildId)) {
    throw new FdeProjectRequestError('invalid-request', 400, '结束需求整理请求缺少有效 BuildId。')
  }
  return { workspaceId, buildId }
}

function runtimeActionOf(value: unknown): { readonly workspaceId: string; readonly sessionId: string } {
  const workspaceId = workspaceIdOf(value)
  const sessionId = (value as { sessionId?: unknown }).sessionId
  if (typeof sessionId !== 'string' || sessionId.trim() === '' || sessionId.length > 160) {
    throw new FdeProjectRequestError('invalid-request', 400, '项目运行请求缺少当前会话。')
  }
  return { workspaceId, sessionId: sessionId.trim() }
}

function runtimeAbandonOf(value: unknown): {
  readonly workspaceId: string
  readonly operationId: string
  readonly message: string
} {
  const workspaceId = workspaceIdOf(value)
  const operationId = (value as { operationId?: unknown }).operationId
  const message = (value as { message?: unknown }).message
  if (typeof operationId !== 'string' || !/^runtime_[a-f0-9]{32}$/u.test(operationId)) {
    throw new FdeProjectRequestError('invalid-request', 400, '结束项目运行操作缺少有效 operationId。')
  }
  if (typeof message !== 'string' || message.trim() === '' || message.length > 1_000) {
    throw new FdeProjectRequestError('invalid-request', 400, '结束项目运行操作缺少具体原因。')
  }
  return { workspaceId, operationId, message: message.trim() }
}

function writeJson(response: ServerResponse, status: number, payload: unknown): void {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  response.end(JSON.stringify(payload))
}

/**
 * Create the trusted project snapshot handler.
 * @param options - trust decision, Workspace resolver, and failure reporter.
 * @returns an exact-route HTTP handler.
 */
export function createProjectSnapshotRoute(
  options: ProjectRouteOptions,
): (request: IncomingMessage, response: ServerResponse) => Promise<void> {
  return async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    try {
      if (!options.trusted(request)) throw new FdeProjectRequestError('forbidden', 403, '当前请求不能读取项目页面。')
      if (request.method !== 'POST') {
        request.resume()
        throw new FdeProjectRequestError('method-not-allowed', 405, '项目页面接口只接受 POST。')
      }
      const workspaceId = workspaceIdOf(await readJson(request))
      const snapshot = await options.snapshot(workspaceId)
      if (snapshot === undefined) throw new FdeProjectRequestError('workspace-not-found', 404, '当前项目不存在或已被移除。')
      writeJson(response, 200, { ok: true, value: snapshot })
    } catch (error) {
      if (error instanceof FdeProjectRequestError) {
        writeJson(response, error.status, { ok: false, error: { code: error.code, message: error.message } })
        return
      }
      options.reportFailure?.(error)
      writeJson(response, 500, { ok: false, error: { code: 'internal-error', message: '项目页面读取失败。' } })
    }
  }
}

/**
 * Create the verified fixed-artifact file handler used by read-only previews.
 * @param options - trust decision, fixed-artifact resolver, byte bound, and failure reporter.
 * @returns an exact-route HTTP handler.
 */
export function createRequirementArtifactFileRoute(
  options: RequirementArtifactFileRouteOptions,
): (request: IncomingMessage, response: ServerResponse) => Promise<void> {
  return async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    try {
      if (!options.trusted(request)) throw new FdeProjectRequestError('forbidden', 403, '当前请求不能读取阶段产出。')
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        request.resume()
        response.setHeader('allow', 'GET, HEAD')
        throw new FdeProjectRequestError('method-not-allowed', 405, '阶段产出只接受 GET/HEAD。')
      }
      const url = new URL(request.url ?? '/', 'http://localhost')
      const workspaceId = url.searchParams.get('workspaceId') ?? ''
      const artifactId = url.searchParams.get('artifactId') ?? ''
      if (workspaceId === '' || artifactId === '') {
        throw new FdeProjectRequestError('invalid-request', 400, '阶段产出请求缺少项目或产物标识。')
      }
      const artifact = await options.artifact(workspaceId, artifactId)
      if (artifact === undefined) throw new FdeProjectRequestError('artifact-not-found', 404, '阶段产出不存在或不可用。')
      if (artifact.bytes > options.maxFileBytes) {
        throw new FdeProjectRequestError('artifact-too-large', 413, '阶段产出超过在线预览限制，请在项目交付中打开。')
      }
      const body = request.method === 'HEAD' ? undefined : await readFile(artifact.filePath)
      if (body !== undefined && body.byteLength > options.maxFileBytes) {
        throw new FdeProjectRequestError('artifact-too-large', 413, '阶段产出超过在线预览限制，请在项目交付中打开。')
      }
      response.writeHead(200, {
        'content-type': 'text/markdown; charset=utf-8',
        'content-length': String(body?.byteLength ?? artifact.bytes),
        'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(artifact.name)}`,
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
      })
      response.end(body)
    } catch (error) {
      if (error instanceof FdeProjectRequestError) {
        writeJson(response, error.status, { ok: false, error: { code: error.code, message: error.message } })
        return
      }
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        writeJson(response, 404, { ok: false, error: { code: 'artifact-not-found', message: '阶段产出不存在或不可用。' } })
        return
      }
      options.reportFailure?.(error)
      writeJson(response, 500, { ok: false, error: { code: 'internal-error', message: '阶段产出读取失败。' } })
    }
  }
}

/**
 * Create the trusted exact-revision architecture confirmation route.
 * @param options - trust decision, confirmation operation, and failure reporter.
 * @returns an exact-route HTTP handler.
 */
export function createArchitectureConfirmRoute(
  options: ArchitectureConfirmRouteOptions,
): (request: IncomingMessage, response: ServerResponse) => Promise<void> {
  return async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    try {
      if (!options.trusted(request)) throw new FdeProjectRequestError('forbidden', 403, '当前请求不能确认系统架构。')
      if (request.method !== 'POST') {
        request.resume()
        throw new FdeProjectRequestError('method-not-allowed', 405, '系统架构确认接口只接受 POST。')
      }
      const input = architectureConfirmationOf(await readJson(request))
      const snapshot = await options.confirm(input.workspaceId, input.revision)
      if (snapshot === undefined) throw new FdeProjectRequestError('workspace-not-found', 404, '当前项目不存在或已被移除。')
      writeJson(response, 200, { ok: true, value: snapshot })
    } catch (error) {
      if (error instanceof FdeProjectRequestError) {
        writeJson(response, error.status, { ok: false, error: { code: error.code, message: error.message } })
        return
      }
      options.reportFailure?.(error)
      writeJson(response, 409, {
        ok: false,
        error: {
          code: 'architecture-confirm-failed',
          message: error instanceof Error ? error.message : '系统架构确认失败。',
        },
      })
    }
  }
}

/**
 * Create the trusted exact-contract validation-plan confirmation route.
 * @param options - trust decision, confirmation operation, and failure reporter.
 * @returns an exact-route HTTP handler.
 */
export function createValidationPlanConfirmRoute(
  options: ValidationPlanConfirmRouteOptions,
): (request: IncomingMessage, response: ServerResponse) => Promise<void> {
  return async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    try {
      if (!options.trusted(request)) throw new FdeProjectRequestError('forbidden', 403, '当前请求不能确认评估方案。')
      if (request.method !== 'POST') {
        request.resume()
        throw new FdeProjectRequestError('method-not-allowed', 405, '评估方案确认接口只接受 POST。')
      }
      const input = validationPlanConfirmationOf(await readJson(request))
      const snapshot = await options.confirm(input.workspaceId, input.contractDigest)
      if (snapshot === undefined) throw new FdeProjectRequestError('workspace-not-found', 404, '当前项目不存在或已被移除。')
      writeJson(response, 200, { ok: true, value: snapshot })
    } catch (error) {
      if (error instanceof FdeProjectRequestError) {
        writeJson(response, error.status, { ok: false, error: { code: error.code, message: error.message } })
        return
      }
      options.reportFailure?.(error)
      writeJson(response, 409, {
        ok: false,
        error: {
          code: 'validation-plan-confirm-failed',
          message: error instanceof Error ? error.message : '评估方案确认失败。',
        },
      })
    }
  }
}

/**
 * Create the trusted exact-contract validation-metric acceptance route.
 * @param options - trust decision, metric acceptance operation, and failure reporter.
 * @returns an exact-route HTTP handler.
 */
export function createValidationMetricAcceptRoute(
  options: ValidationMetricAcceptRouteOptions,
): (request: IncomingMessage, response: ServerResponse) => Promise<void> {
  return async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    try {
      if (!options.trusted(request)) throw new FdeProjectRequestError('forbidden', 403, '当前请求不能人工接受验证指标。')
      if (request.method !== 'POST') {
        request.resume()
        throw new FdeProjectRequestError('method-not-allowed', 405, '人工接受指标接口只接受 POST。')
      }
      const input = validationMetricAcceptanceOf(await readJson(request))
      const snapshot = await options.accept(input.workspaceId, input.contractDigest, input.metricId, input.reason)
      if (snapshot === undefined) throw new FdeProjectRequestError('workspace-not-found', 404, '当前项目不存在或已被移除。')
      writeJson(response, 200, { ok: true, value: snapshot })
    } catch (error) {
      if (error instanceof FdeProjectRequestError) {
        writeJson(response, error.status, { ok: false, error: { code: error.code, message: error.message } })
        return
      }
      options.reportFailure?.(error)
      writeJson(response, 409, {
        ok: false,
        error: {
          code: 'validation-metric-accept-failed',
          message: error instanceof Error ? error.message : '人工接受验证指标失败。',
        },
      })
    }
  }
}

/**
 * Create the trusted exact-contract validation-issue waiver route.
 * @param options - trust decision, issue waiver operation, and failure reporter.
 * @returns an exact-route HTTP handler.
 */
export function createValidationIssueWaiveRoute(
  options: ValidationIssueWaiveRouteOptions,
): (request: IncomingMessage, response: ServerResponse) => Promise<void> {
  return async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    try {
      if (!options.trusted(request)) throw new FdeProjectRequestError('forbidden', 403, '当前请求不能人工关闭验证问题。')
      if (request.method !== 'POST') {
        request.resume()
        throw new FdeProjectRequestError('method-not-allowed', 405, '人工关闭问题接口只接受 POST。')
      }
      const input = validationIssueWaiverOf(await readJson(request))
      const snapshot = await options.waive(input.workspaceId, input.contractDigest, input.issueId, input.reason)
      if (snapshot === undefined) throw new FdeProjectRequestError('workspace-not-found', 404, '当前项目不存在或已被移除。')
      writeJson(response, 200, { ok: true, value: snapshot })
    } catch (error) {
      if (error instanceof FdeProjectRequestError) {
        writeJson(response, error.status, { ok: false, error: { code: error.code, message: error.message } })
        return
      }
      options.reportFailure?.(error)
      writeJson(response, 409, {
        ok: false,
        error: {
          code: 'validation-issue-waive-failed',
          message: error instanceof Error ? error.message : '人工关闭验证问题失败。',
        },
      })
    }
  }
}

/**
 * Create the trusted exact-contract deployment-trial issue acceptance route.
 * @param options - trust decision, issue acceptance operation, and failure reporter.
 * @returns an exact-route HTTP handler.
 */
export function createDeploymentTrialIssueAcceptRoute(
  options: DeploymentTrialIssueAcceptRouteOptions,
): (request: IncomingMessage, response: ServerResponse) => Promise<void> {
  return async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    try {
      if (!options.trusted(request)) throw new FdeProjectRequestError('forbidden', 403, '当前请求不能人工接受试运行问题。')
      if (request.method !== 'POST') {
        request.resume()
        throw new FdeProjectRequestError('method-not-allowed', 405, '人工接受试运行问题接口只接受 POST。')
      }
      const input = deploymentTrialIssueAcceptanceOf(await readJson(request))
      const snapshot = await options.accept(input.workspaceId, input.contractDigest, input.issueId, input.reason)
      if (snapshot === undefined) throw new FdeProjectRequestError('workspace-not-found', 404, '当前项目不存在或已被移除。')
      writeJson(response, 200, { ok: true, value: snapshot })
    } catch (error) {
      if (error instanceof FdeProjectRequestError) {
        writeJson(response, error.status, { ok: false, error: { code: error.code, message: error.message } })
        return
      }
      options.reportFailure?.(error)
      writeJson(response, 409, {
        ok: false,
        error: {
          code: 'deployment-trial-issue-accept-failed',
          message: error instanceof Error ? error.message : '人工接受试运行问题失败。',
        },
      })
    }
  }
}

/**
 * Create the trusted exact-contract deployment-trial readiness confirmation route.
 * @param options - trust decision, readiness confirmation operation, and failure reporter.
 * @returns an exact-route HTTP handler.
 */
export function createDeploymentTrialReadinessConfirmRoute(
  options: DeploymentTrialReadinessConfirmRouteOptions,
): (request: IncomingMessage, response: ServerResponse) => Promise<void> {
  return async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    try {
      if (!options.trusted(request)) throw new FdeProjectRequestError('forbidden', 403, '当前请求不能确认部署试运行结论。')
      if (request.method !== 'POST') {
        request.resume()
        throw new FdeProjectRequestError('method-not-allowed', 405, '确认部署试运行结论接口只接受 POST。')
      }
      const input = deploymentTrialReadinessConfirmationOf(await readJson(request))
      const snapshot = await options.confirm(input.workspaceId, input.contractDigest)
      if (snapshot === undefined) throw new FdeProjectRequestError('workspace-not-found', 404, '当前项目不存在或已被移除。')
      writeJson(response, 200, { ok: true, value: snapshot })
    } catch (error) {
      if (error instanceof FdeProjectRequestError) {
        writeJson(response, error.status, { ok: false, error: { code: error.code, message: error.message } })
        return
      }
      options.reportFailure?.(error)
      writeJson(response, 409, {
        ok: false,
        error: {
          code: 'deployment-trial-readiness-confirm-failed',
          message: error instanceof Error ? error.message : '确认部署试运行结论失败。',
        },
      })
    }
  }
}

/**
 * Create the trusted exact-contract acceptance-handover decision route.
 * @param options - trust decision, decision recorder, and failure reporter.
 * @returns an exact-route HTTP handler.
 */
export function createAcceptanceHandoverDecisionRoute(
  options: AcceptanceHandoverDecisionRouteOptions,
): (request: IncomingMessage, response: ServerResponse) => Promise<void> {
  return async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    try {
      if (!options.trusted(request)) throw new FdeProjectRequestError('forbidden', 403, '当前请求不能记录验收移交决定。')
      if (request.method !== 'POST') {
        request.resume()
        throw new FdeProjectRequestError('method-not-allowed', 405, '验收移交人工记录接口只接受 POST。')
      }
      const input = acceptanceHandoverDecisionOf(await readJson(request))
      const snapshot = await options.record(input.workspaceId, input.contractDigest, input.decision)
      if (snapshot === undefined) throw new FdeProjectRequestError('workspace-not-found', 404, '当前项目不存在或已被移除。')
      writeJson(response, 200, { ok: true, value: snapshot })
    } catch (error) {
      if (error instanceof FdeProjectRequestError) {
        writeJson(response, error.status, { ok: false, error: { code: error.code, message: error.message } })
        return
      }
      options.reportFailure?.(error)
      writeJson(response, 409, {
        ok: false,
        error: {
          code: 'acceptance-handover-decision-failed',
          message: error instanceof Error ? error.message : '记录验收移交决定失败。',
        },
      })
    }
  }
}

/**
 * Create the trusted project-report baseline approval route.
 * @param options - trust decision, approval operation, and failure reporter.
 * @returns an exact-route HTTP handler.
 */
export function createEvaluationBaselineRoute(
  options: EvaluationBaselineRouteOptions,
): (request: IncomingMessage, response: ServerResponse) => Promise<void> {
  return async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    try {
      if (!options.trusted(request)) throw new FdeProjectRequestError('forbidden', 403, '当前请求不能设置评估基线。')
      if (request.method !== 'POST') {
        request.resume()
        throw new FdeProjectRequestError('method-not-allowed', 405, '评估基线接口只接受 POST。')
      }
      const input = evaluationBaselineOf(await readJson(request))
      const snapshot = await options.approve(input.workspaceId, input.reportPath)
      if (snapshot === undefined) throw new FdeProjectRequestError('workspace-not-found', 404, '当前项目不存在或已被移除。')
      writeJson(response, 200, { ok: true, value: snapshot })
    } catch (error) {
      if (error instanceof FdeProjectRequestError) {
        writeJson(response, error.status, { ok: false, error: { code: error.code, message: error.message } })
        return
      }
      options.reportFailure?.(error)
      writeJson(response, 409, {
        ok: false,
        error: {
          code: 'evaluation-baseline-failed',
          message: error instanceof Error ? error.message : '评估基线设置失败。',
        },
      })
    }
  }
}

/**
 * Create the trusted explicit requirement-Wiki build start handler.
 * @param options - Trust decision, Workspace-scoped start operation, and failure reporter.
 * @returns An exact-route HTTP handler that publishes no state for rejected requests.
 */
export function createRequirementWikiStartRoute(
  options: RequirementWikiStartRouteOptions,
): (request: IncomingMessage, response: ServerResponse) => Promise<void> {
  return async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    try {
      if (!options.trusted(request)) throw new FdeProjectRequestError('forbidden', 403, '当前请求不能启动需求整理。')
      if (request.method !== 'POST') {
        request.resume()
        throw new FdeProjectRequestError('method-not-allowed', 405, '需求整理接口只接受 POST。')
      }
      const input = requirementWikiStartOf(await readJson(request))
      const snapshot = await options.start(input.workspaceId, input.sourceIds, input.expectedRevision)
      if (snapshot === undefined) throw new FdeProjectRequestError('workspace-not-found', 404, '当前项目不存在或已被移除。')
      writeJson(response, 200, { ok: true, value: snapshot })
    } catch (error) {
      if (error instanceof FdeProjectRequestError) {
        writeJson(response, error.status, { ok: false, error: { code: error.code, message: error.message } })
        return
      }
      options.reportFailure?.(error)
      writeJson(response, 409, {
        ok: false,
        error: {
          code: 'requirement-wiki-start-failed',
          message: error instanceof Error ? error.message : '需求整理启动失败。',
        },
      })
    }
  }
}

/**
 * Create the trusted requirement-Wiki build abandonment handler.
 * @param options - Trust decision, Workspace-scoped cancellation operation, and failure reporter.
 * @returns An exact-route HTTP handler for cancelling one active BuildId.
 */
export function createRequirementWikiAbandonRoute(
  options: RequirementWikiAbandonRouteOptions,
): (request: IncomingMessage, response: ServerResponse) => Promise<void> {
  return async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    try {
      if (!options.trusted(request)) throw new FdeProjectRequestError('forbidden', 403, '当前请求不能结束需求整理。')
      if (request.method !== 'POST') {
        request.resume()
        throw new FdeProjectRequestError('method-not-allowed', 405, '结束需求整理接口只接受 POST。')
      }
      const input = requirementWikiAbandonOf(await readJson(request))
      const snapshot = await options.abandon(input.workspaceId, input.buildId)
      if (snapshot === undefined) throw new FdeProjectRequestError('workspace-not-found', 404, '当前项目不存在或已被移除。')
      writeJson(response, 200, { ok: true, value: snapshot })
    } catch (error) {
      if (error instanceof FdeProjectRequestError) {
        writeJson(response, error.status, { ok: false, error: { code: error.code, message: error.message } })
        return
      }
      options.reportFailure?.(error)
      writeJson(response, 409, {
        ok: false,
        error: {
          code: 'requirement-wiki-abandon-failed',
          message: error instanceof Error ? error.message : '结束需求整理失败。',
        },
      })
    }
  }
}

function createProjectRuntimeActionRoute(
  action: 'start' | 'stop',
  options: ProjectRuntimeActionRouteOptions,
): (request: IncomingMessage, response: ServerResponse) => Promise<void> {
  return async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    try {
      const label = action === 'start' ? '启动' : '停止'
      if (!options.trusted(request)) throw new FdeProjectRequestError('forbidden', 403, `当前请求不能${label}项目。`)
      if (request.method !== 'POST') {
        request.resume()
        throw new FdeProjectRequestError('method-not-allowed', 405, `项目${label}接口只接受 POST。`)
      }
      const input = runtimeActionOf(await readJson(request))
      const snapshot = await options.act(input.workspaceId, input.sessionId)
      if (snapshot === undefined) throw new FdeProjectRequestError('workspace-not-found', 404, '当前项目不存在或已被移除。')
      writeJson(response, 200, { ok: true, value: snapshot })
    } catch (error) {
      if (error instanceof FdeProjectRequestError) {
        writeJson(response, error.status, { ok: false, error: { code: error.code, message: error.message } })
        return
      }
      options.reportFailure?.(error)
      writeJson(response, 409, {
        ok: false,
        error: {
          code: `project-runtime-${action}-failed`,
          message: error instanceof Error ? error.message : `项目${action === 'start' ? '启动' : '停止'}失败。`,
        },
      })
    }
  }
}

/** Create the trusted project runtime start route. */
export function createProjectRuntimeStartRoute(
  options: ProjectRuntimeActionRouteOptions,
): (request: IncomingMessage, response: ServerResponse) => Promise<void> {
  return createProjectRuntimeActionRoute('start', options)
}

/** Create the trusted project runtime stop route. */
export function createProjectRuntimeStopRoute(
  options: ProjectRuntimeActionRouteOptions,
): (request: IncomingMessage, response: ServerResponse) => Promise<void> {
  return createProjectRuntimeActionRoute('stop', options)
}

/** Create the trusted route that settles an operation whose Agent prompt could not be queued. */
export function createProjectRuntimeAbandonRoute(
  options: ProjectRuntimeAbandonRouteOptions,
): (request: IncomingMessage, response: ServerResponse) => Promise<void> {
  return async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    try {
      if (!options.trusted(request)) throw new FdeProjectRequestError('forbidden', 403, '当前请求不能结束项目运行操作。')
      if (request.method !== 'POST') {
        request.resume()
        throw new FdeProjectRequestError('method-not-allowed', 405, '项目运行恢复接口只接受 POST。')
      }
      const input = runtimeAbandonOf(await readJson(request))
      const snapshot = await options.abandon(input.workspaceId, input.operationId, input.message)
      if (snapshot === undefined) throw new FdeProjectRequestError('workspace-not-found', 404, '当前项目不存在或已被移除。')
      writeJson(response, 200, { ok: true, value: snapshot })
    } catch (error) {
      if (error instanceof FdeProjectRequestError) {
        writeJson(response, error.status, { ok: false, error: { code: error.code, message: error.message } })
        return
      }
      options.reportFailure?.(error)
      writeJson(response, 409, {
        ok: false,
        error: {
          code: 'project-runtime-abandon-failed',
          message: error instanceof Error ? error.message : '项目运行操作恢复失败。',
        },
      })
    }
  }
}
