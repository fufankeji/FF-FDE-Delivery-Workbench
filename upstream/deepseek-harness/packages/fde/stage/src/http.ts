/** Trusted same-origin JSON route for reading or initializing one project stage. */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace'
import { FDE_V2_STAGE_IDS, type FdeV2StageId, type ProjectStageRecord } from './spec.ts'
import { FdeStageConflictError, FdeStageReturnError, FdeStageTransitionError } from './state.ts'

const MAX_BODY_BYTES = 16 * 1024

/** Browser-facing route failure with a stable code and HTTP status. */
export class FdeStageRequestError extends Error {
  /**
   * @param code - stable failure code.
   * @param status - HTTP status.
   * @param message - user-readable detail.
   */
  constructor(readonly code: string, readonly status: number, message: string) {
    super(message)
    this.name = 'FdeStageRequestError'
  }
}

/** Dependencies required by the exact project-stage route. */
export interface StageRouteOptions {
  trusted: (request: IncomingMessage) => boolean
  workspaceExists: (workspaceId: string) => boolean
  open: (workspaceId: WorkspaceId) => Promise<ProjectStageRecord>
  reportFailure?: (error: unknown) => void
}

/** One read-only method shown under a project delivery stage. */
export interface StageSkillCatalogMethod {
  readonly id: string
  readonly label: string
  readonly description: string
  readonly whenToUse: string
  readonly source: string
  readonly content: string
  readonly group?: 'required' | 'conditional'
}

/** Browser-safe catalog of methods that the FDE stage plugin actually registers. */
export interface StageSkillCatalogValue {
  readonly schemaVersion: 1
  readonly stages: readonly {
    readonly id: string
    readonly index: number
    readonly methods: readonly StageSkillCatalogMethod[]
  }[]
}

/** Dependencies required by the read-only stage Skill catalog route. */
export interface StageSkillCatalogRouteOptions {
  trusted: (request: IncomingMessage) => boolean
  catalog: StageSkillCatalogValue
  reportFailure?: (error: unknown) => void
}

/** Dependencies for the fixed FDE-only requirement-research completion route. */
export interface CompleteRequirementsRouteOptions {
  trusted: (request: IncomingMessage) => boolean
  workspaceExists: (workspaceId: string) => boolean
  requirements: (workspaceId: string) => Promise<{
    readonly reviewReady: boolean
    readonly blockers: readonly string[]
  }>
  complete: (workspaceId: WorkspaceId, expectedRevision: number) => Promise<ProjectStageRecord>
  reportFailure?: (error: unknown) => void
}

/** Dependencies for the fixed FDE-only solution-design completion route. */
export interface CompleteSolutionRouteOptions {
  trusted: (request: IncomingMessage) => boolean
  workspaceExists: (workspaceId: string) => boolean
  solution: (workspaceId: string) => Promise<{
    readonly artifacts: readonly { readonly title: string; readonly status: 'missing' | 'present' | 'error' }[]
    readonly architecture: { readonly status: string } | null
  }>
  complete: (workspaceId: WorkspaceId, expectedRevision: number) => Promise<ProjectStageRecord>
  reportFailure?: (error: unknown) => void
}

/** Dependencies for the fixed FDE-only project-development completion route. */
export interface CompleteDevelopmentRouteOptions {
  trusted: (request: IncomingMessage) => boolean
  workspaceExists: (workspaceId: string) => boolean
  development: (workspaceId: string) => Promise<{
    readonly artifacts: readonly { readonly title: string; readonly status: 'missing' | 'present' | 'error' }[]
  }>
  complete: (workspaceId: WorkspaceId, expectedRevision: number) => Promise<ProjectStageRecord>
  reportFailure?: (error: unknown) => void
}

/** Dependencies for the fixed FDE-only validation completion route. */
export interface CompleteValidationRouteOptions {
  trusted: (request: IncomingMessage) => boolean
  workspaceExists: (workspaceId: string) => boolean
  validation: (workspaceId: string) => Promise<{
    readonly gateReady: boolean
    readonly blockers: readonly string[]
  }>
  complete: (workspaceId: WorkspaceId, expectedRevision: number) => Promise<ProjectStageRecord>
  reportFailure?: (error: unknown) => void
}

/** Dependencies for the fixed FDE-only deployment-trial completion route. */
export interface CompletePilotRouteOptions {
  trusted: (request: IncomingMessage) => boolean
  workspaceExists: (workspaceId: string) => boolean
  deploymentTrial: (workspaceId: string) => Promise<{
    readonly gateReady: boolean
    readonly blockers: readonly string[]
  }>
  complete: (workspaceId: WorkspaceId, expectedRevision: number) => Promise<ProjectStageRecord>
  reportFailure?: (error: unknown) => void
}

/** Dependencies for the fixed FDE-only acceptance-handover completion route. */
export interface CompleteHandoffRouteOptions {
  trusted: (request: IncomingMessage) => boolean
  workspaceExists: (workspaceId: string) => boolean
  acceptanceHandover: (workspaceId: string) => Promise<{
    readonly gateReady: boolean
    readonly blockers: readonly string[]
  }>
  complete: (workspaceId: WorkspaceId, expectedRevision: number) => Promise<ProjectStageRecord>
  reportFailure?: (error: unknown) => void
}

/** Dependencies for the FDE-only, one-step stage-return action. */
export interface ReturnStageRouteOptions {
  trusted: (request: IncomingMessage) => boolean
  workspaceExists: (workspaceId: string) => boolean
  returnToPrevious: (workspaceId: WorkspaceId, expectedRevision: number, reason: string) => Promise<ProjectStageRecord>
  reportFailure?: (error: unknown) => void
}

/** Dependencies for the authoritative V2 stage completion route. */
export interface CompleteV2StageRouteOptions {
  trusted: (request: IncomingMessage) => boolean
  workspaceExists: (workspaceId: string) => boolean
  readiness: (workspaceId: string, stage: FdeV2StageId) => Promise<{
    readonly reviewReady: boolean
    readonly reviewBlockers: readonly string[]
  }>
  complete: (workspaceId: WorkspaceId, expectedRevision: number, stage: FdeV2StageId) => Promise<ProjectStageRecord>
  reportFailure?: (error: unknown) => void
}

/** Dependencies for the authoritative V2 one-stage return route. */
export interface ReturnV2StageRouteOptions {
  trusted: (request: IncomingMessage) => boolean
  workspaceExists: (workspaceId: string) => boolean
  returnToPrevious: (workspaceId: WorkspaceId, expectedRevision: number, reason: string) => Promise<ProjectStageRecord>
  reportFailure?: (error: unknown) => void
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const declaredRaw = request.headers['content-length']
  const declared = typeof declaredRaw === 'string' ? Number(declaredRaw) : undefined
  if (declared !== undefined && (!Number.isSafeInteger(declared) || declared < 0 || declared > MAX_BODY_BYTES)) {
    request.resume()
    throw new FdeStageRequestError('invalid-request', 400, '阶段状态请求无效。')
  }
  const chunks: Uint8Array[] = []
  let total = 0
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    total += bytes.byteLength
    if (total > MAX_BODY_BYTES) {
      request.resume()
      throw new FdeStageRequestError('invalid-request', 400, '阶段状态请求无效。')
    }
    chunks.push(bytes)
  }
  try {
    return JSON.parse(Buffer.concat(chunks, total).toString('utf8')) as unknown
  } catch (error) {
    throw new FdeStageRequestError('invalid-json', 400, `阶段状态请求不是有效 JSON：${String(error)}`)
  }
}

function workspaceIdOf(value: unknown): string {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new FdeStageRequestError('invalid-request', 400, '阶段状态请求缺少项目。')
  }
  const workspaceId = (value as { workspaceId?: unknown }).workspaceId
  if (typeof workspaceId !== 'string' || workspaceId.trim() === '') {
    throw new FdeStageRequestError('invalid-request', 400, '阶段状态请求缺少项目。')
  }
  return workspaceId
}

function completionRequestOf(value: unknown): { workspaceId: string; expectedRevision: number } {
  const workspaceId = workspaceIdOf(value)
  const expectedRevision = (value as { expectedRevision?: unknown }).expectedRevision
  if (!Number.isSafeInteger(expectedRevision) || (expectedRevision as number) < 1) {
    throw new FdeStageRequestError('invalid-request', 400, '阶段确认缺少有效的项目版本。')
  }
  return { workspaceId, expectedRevision: expectedRevision as number }
}

function returnRequestOf(value: unknown): { workspaceId: string; expectedRevision: number; reason: string } {
  const completion = completionRequestOf(value)
  const reason = (value as { reason?: unknown }).reason
  if (typeof reason !== 'string' || reason.trim() === '' || reason.trim().length > 1000) {
    throw new FdeStageRequestError('invalid-request', 400, '返回原因必须填写，且不能超过 1000 个字符。')
  }
  return { ...completion, reason: reason.trim() }
}

function v2CompletionRequestOf(value: unknown): { workspaceId: string; expectedRevision: number; stage: FdeV2StageId } {
  const completion = completionRequestOf(value)
  const stage = (value as { stage?: unknown }).stage
  if (typeof stage !== 'string' || !(FDE_V2_STAGE_IDS as readonly string[]).includes(stage)) {
    throw new FdeStageRequestError('invalid-request', 400, '阶段确认缺少有效的 V2 阶段。')
  }
  return { ...completion, stage: stage as FdeV2StageId }
}

function writeJson(response: ServerResponse, status: number, payload: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(payload))
}

/**
 * Create the POST-only project-stage handler.
 * @param options - trust, Workspace lookup, durable state, and diagnostics.
 * @returns a WebServer route handler.
 */
export function createStageRoute(options: StageRouteOptions): (request: IncomingMessage, response: ServerResponse) => Promise<void> {
  return async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    try {
      if (!options.trusted(request)) throw new FdeStageRequestError('forbidden', 403, '当前请求不能读取项目阶段。')
      if (request.method !== 'POST') {
        request.resume()
        throw new FdeStageRequestError('method-not-allowed', 405, '项目阶段接口只接受 POST。')
      }
      const workspaceId = workspaceIdOf(await readJson(request))
      if (!options.workspaceExists(workspaceId)) {
        throw new FdeStageRequestError('workspace-not-found', 404, '当前项目不存在或已被移除。')
      }
      const record = await options.open(workspaceId as WorkspaceId)
      writeJson(response, 200, { ok: true, value: { workspaceId, ...record } })
    } catch (error) {
      if (error instanceof FdeStageRequestError) {
        writeJson(response, error.status, { ok: false, error: { code: error.code, message: error.message } })
        return
      }
      options.reportFailure?.(error)
      writeJson(response, 500, { ok: false, error: { code: 'internal-error', message: '项目阶段读取失败。' } })
    }
  }
}

/**
 * Create the GET-only catalog for methods registered by this FDE stage plugin.
 * @param options - request trust and the fixed product catalog.
 * @returns a WebServer route handler.
 */
export function createStageSkillCatalogRoute(
  options: StageSkillCatalogRouteOptions,
): (request: IncomingMessage, response: ServerResponse) => Promise<void> {
  return async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    try {
      if (!options.trusted(request)) throw new FdeStageRequestError('forbidden', 403, '当前请求不能读取阶段工作方法。')
      if (request.method !== 'GET') {
        request.resume()
        throw new FdeStageRequestError('method-not-allowed', 405, '阶段工作方法接口只接受 GET。')
      }
      writeJson(response, 200, { ok: true, value: options.catalog })
    } catch (error) {
      if (error instanceof FdeStageRequestError) {
        writeJson(response, error.status, { ok: false, error: { code: error.code, message: error.message } })
        return
      }
      options.reportFailure?.(error)
      writeJson(response, 500, { ok: false, error: { code: 'internal-error', message: '阶段工作方法读取失败。' } })
    }
  }
}

/** Create the POST-only, one-stage FDE return action. */
export function createReturnStageRoute(
  options: ReturnStageRouteOptions,
): (request: IncomingMessage, response: ServerResponse) => Promise<void> {
  return async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    let requestedWorkspaceId: string | undefined
    try {
      if (!options.trusted(request)) throw new FdeStageRequestError('forbidden', 403, '当前请求不能返回项目阶段。')
      if (request.method !== 'POST') {
        request.resume()
        throw new FdeStageRequestError('method-not-allowed', 405, '阶段返回接口只接受 POST。')
      }
      const { workspaceId, expectedRevision, reason } = returnRequestOf(await readJson(request))
      requestedWorkspaceId = workspaceId
      if (!options.workspaceExists(workspaceId)) {
        throw new FdeStageRequestError('workspace-not-found', 404, '当前项目不存在或已被移除。')
      }
      const record = await options.returnToPrevious(workspaceId as WorkspaceId, expectedRevision, reason)
      writeJson(response, 200, { ok: true, value: { workspaceId, ...record } })
    } catch (error) {
      if (error instanceof FdeStageRequestError) {
        writeJson(response, error.status, { ok: false, error: { code: error.code, message: error.message } })
        return
      }
      if (error instanceof FdeStageConflictError || error instanceof FdeStageReturnError) {
        writeJson(response, 409, {
          ok: false,
          error: {
            code: error instanceof FdeStageConflictError ? 'stage-revision-conflict' : 'stage-return-unavailable',
            message: error.message,
          },
          ...(requestedWorkspaceId === undefined ? {} : { value: { workspaceId: requestedWorkspaceId, ...error.current } }),
        })
        return
      }
      options.reportFailure?.(error)
      writeJson(response, 500, { ok: false, error: { code: 'internal-error', message: '项目阶段返回失败。' } })
    }
  }
}

/** Create the POST-only authoritative V2 manual gate. */
export function createCompleteV2StageRoute(
  options: CompleteV2StageRouteOptions,
): (request: IncomingMessage, response: ServerResponse) => Promise<void> {
  return async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    let requestedWorkspaceId: string | undefined
    try {
      if (!options.trusted(request)) throw new FdeStageRequestError('forbidden', 403, '当前请求不能确认项目阶段。')
      if (request.method !== 'POST') {
        request.resume()
        throw new FdeStageRequestError('method-not-allowed', 405, '阶段确认接口只接受 POST。')
      }
      const { workspaceId, expectedRevision, stage } = v2CompletionRequestOf(await readJson(request))
      requestedWorkspaceId = workspaceId
      if (!options.workspaceExists(workspaceId)) throw new FdeStageRequestError('workspace-not-found', 404, '当前项目不存在或已被移除。')
      const readiness = await options.readiness(workspaceId, stage)
      if (!readiness.reviewReady) {
        throw new FdeStageRequestError('stage-review-incomplete', 409, `当前阶段尚未达到可评审状态：${readiness.reviewBlockers.join('；')}`)
      }
      const record = await options.complete(workspaceId as WorkspaceId, expectedRevision, stage)
      writeJson(response, 200, { ok: true, value: { workspaceId, ...record } })
    } catch (error) {
      if (error instanceof FdeStageRequestError) {
        writeJson(response, error.status, { ok: false, error: { code: error.code, message: error.message } })
        return
      }
      if (error instanceof FdeStageConflictError || error instanceof FdeStageTransitionError) {
        writeJson(response, 409, {
          ok: false,
          error: { code: error instanceof FdeStageConflictError ? 'stage-revision-conflict' : 'stage-invalid-transition', message: error.message },
          ...(requestedWorkspaceId === undefined ? {} : { value: { workspaceId: requestedWorkspaceId, ...error.current } }),
        })
        return
      }
      options.reportFailure?.(error)
      writeJson(response, 500, { ok: false, error: { code: 'internal-error', message: 'V2 项目阶段确认失败。' } })
    }
  }
}

/** Create the POST-only authoritative V2 one-stage return action. */
export function createReturnV2StageRoute(
  options: ReturnV2StageRouteOptions,
): (request: IncomingMessage, response: ServerResponse) => Promise<void> {
  return createReturnStageRoute(options)
}

/** Create the POST-only, fixed requirements-to-solution manual gate. */
export function createCompleteRequirementsRoute(
  options: CompleteRequirementsRouteOptions,
): (request: IncomingMessage, response: ServerResponse) => Promise<void> {
  return async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    let requestedWorkspaceId: string | undefined
    try {
      if (!options.trusted(request)) throw new FdeStageRequestError('forbidden', 403, '当前请求不能确认项目阶段。')
      if (request.method !== 'POST') {
        request.resume()
        throw new FdeStageRequestError('method-not-allowed', 405, '阶段确认接口只接受 POST。')
      }
      const { workspaceId, expectedRevision } = completionRequestOf(await readJson(request))
      requestedWorkspaceId = workspaceId
      if (!options.workspaceExists(workspaceId)) {
        throw new FdeStageRequestError('workspace-not-found', 404, '当前项目不存在或已被移除。')
      }
      const requirements = await options.requirements(workspaceId)
      if (!requirements.reviewReady) {
        throw new FdeStageRequestError(
          'stage-requirements-incomplete',
          409,
          `发现阶段候选材料尚未达到可评审状态：${requirements.blockers.join('；')}`,
        )
      }
      const record = await options.complete(workspaceId as WorkspaceId, expectedRevision)
      writeJson(response, 200, { ok: true, value: { workspaceId, ...record } })
    } catch (error) {
      if (error instanceof FdeStageRequestError) {
        writeJson(response, error.status, { ok: false, error: { code: error.code, message: error.message } })
        return
      }
      if (error instanceof FdeStageConflictError || error instanceof FdeStageTransitionError) {
        writeJson(response, 409, {
          ok: false,
          error: { code: error instanceof FdeStageConflictError ? 'stage-revision-conflict' : 'stage-invalid-transition', message: error.message },
          ...(requestedWorkspaceId === undefined ? {} : { value: { workspaceId: requestedWorkspaceId, ...error.current } }),
        })
        return
      }
      options.reportFailure?.(error)
      writeJson(response, 500, { ok: false, error: { code: 'internal-error', message: '需求调研阶段确认失败。' } })
    }
  }
}

/** Create the POST-only, fixed solution-to-development manual gate. */
export function createCompleteSolutionRoute(
  options: CompleteSolutionRouteOptions,
): (request: IncomingMessage, response: ServerResponse) => Promise<void> {
  return async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    let requestedWorkspaceId: string | undefined
    try {
      if (!options.trusted(request)) throw new FdeStageRequestError('forbidden', 403, '当前请求不能确认项目阶段。')
      if (request.method !== 'POST') {
        request.resume()
        throw new FdeStageRequestError('method-not-allowed', 405, '阶段确认接口只接受 POST。')
      }
      const { workspaceId, expectedRevision } = completionRequestOf(await readJson(request))
      requestedWorkspaceId = workspaceId
      if (!options.workspaceExists(workspaceId)) {
        throw new FdeStageRequestError('workspace-not-found', 404, '当前项目不存在或已被移除。')
      }
      const solution = await options.solution(workspaceId)
      const incomplete = solution.artifacts.filter(artifact => artifact.status !== 'present')
      if (incomplete.length > 0) {
        throw new FdeStageRequestError(
          'stage-solution-incomplete',
          409,
          `方案设计产物尚未齐备：${incomplete.map(artifact => artifact.title).join('、')}。`,
        )
      }
      if (solution.architecture?.status !== 'confirmed') {
        throw new FdeStageRequestError(
          'stage-architecture-unconfirmed',
          409,
          '系统架构尚未确认，请先在“系统架构”中审阅并确认当前版本。',
        )
      }
      const record = await options.complete(workspaceId as WorkspaceId, expectedRevision)
      writeJson(response, 200, { ok: true, value: { workspaceId, ...record } })
    } catch (error) {
      if (error instanceof FdeStageRequestError) {
        writeJson(response, error.status, { ok: false, error: { code: error.code, message: error.message } })
        return
      }
      if (error instanceof FdeStageConflictError || error instanceof FdeStageTransitionError) {
        writeJson(response, 409, {
          ok: false,
          error: { code: error instanceof FdeStageConflictError ? 'stage-revision-conflict' : 'stage-invalid-transition', message: error.message },
          ...(requestedWorkspaceId === undefined ? {} : { value: { workspaceId: requestedWorkspaceId, ...error.current } }),
        })
        return
      }
      options.reportFailure?.(error)
      writeJson(response, 500, { ok: false, error: { code: 'internal-error', message: '方案设计阶段确认失败。' } })
    }
  }
}

/** Create the POST-only, fixed development-to-validation manual gate. */
export function createCompleteDevelopmentRoute(
  options: CompleteDevelopmentRouteOptions,
): (request: IncomingMessage, response: ServerResponse) => Promise<void> {
  return async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    let requestedWorkspaceId: string | undefined
    try {
      if (!options.trusted(request)) throw new FdeStageRequestError('forbidden', 403, '当前请求不能确认项目阶段。')
      if (request.method !== 'POST') {
        request.resume()
        throw new FdeStageRequestError('method-not-allowed', 405, '阶段确认接口只接受 POST。')
      }
      const { workspaceId, expectedRevision } = completionRequestOf(await readJson(request))
      requestedWorkspaceId = workspaceId
      if (!options.workspaceExists(workspaceId)) {
        throw new FdeStageRequestError('workspace-not-found', 404, '当前项目不存在或已被移除。')
      }
      const development = await options.development(workspaceId)
      const incomplete = development.artifacts.filter(artifact => artifact.status !== 'present')
      if (incomplete.length > 0) {
        throw new FdeStageRequestError(
          'stage-development-incomplete',
          409,
          `项目开发收口产物尚未齐备：${incomplete.map(artifact => artifact.title).join('、')}。`,
        )
      }
      const record = await options.complete(workspaceId as WorkspaceId, expectedRevision)
      writeJson(response, 200, { ok: true, value: { workspaceId, ...record } })
    } catch (error) {
      if (error instanceof FdeStageRequestError) {
        writeJson(response, error.status, { ok: false, error: { code: error.code, message: error.message } })
        return
      }
      if (error instanceof FdeStageConflictError || error instanceof FdeStageTransitionError) {
        writeJson(response, 409, {
          ok: false,
          error: { code: error instanceof FdeStageConflictError ? 'stage-revision-conflict' : 'stage-invalid-transition', message: error.message },
          ...(requestedWorkspaceId === undefined ? {} : { value: { workspaceId: requestedWorkspaceId, ...error.current } }),
        })
        return
      }
      options.reportFailure?.(error)
      writeJson(response, 500, { ok: false, error: { code: 'internal-error', message: '项目开发阶段确认失败。' } })
    }
  }
}

/** Create the POST-only, fixed validation-to-pilot manual gate. */
export function createCompleteValidationRoute(
  options: CompleteValidationRouteOptions,
): (request: IncomingMessage, response: ServerResponse) => Promise<void> {
  return async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    let requestedWorkspaceId: string | undefined
    try {
      if (!options.trusted(request)) throw new FdeStageRequestError('forbidden', 403, '当前请求不能确认项目阶段。')
      if (request.method !== 'POST') {
        request.resume()
        throw new FdeStageRequestError('method-not-allowed', 405, '阶段确认接口只接受 POST。')
      }
      const { workspaceId, expectedRevision } = completionRequestOf(await readJson(request))
      requestedWorkspaceId = workspaceId
      if (!options.workspaceExists(workspaceId)) {
        throw new FdeStageRequestError('workspace-not-found', 404, '当前项目不存在或已被移除。')
      }
      const validation = await options.validation(workspaceId)
      if (!validation.gateReady) {
        throw new FdeStageRequestError(
          'stage-validation-incomplete',
          409,
          `验证评估尚未达到进入部署试运行的条件：${validation.blockers.join('；')}`,
        )
      }
      const record = await options.complete(workspaceId as WorkspaceId, expectedRevision)
      writeJson(response, 200, { ok: true, value: { workspaceId, ...record } })
    } catch (error) {
      if (error instanceof FdeStageRequestError) {
        writeJson(response, error.status, { ok: false, error: { code: error.code, message: error.message } })
        return
      }
      if (error instanceof FdeStageConflictError || error instanceof FdeStageTransitionError) {
        writeJson(response, 409, {
          ok: false,
          error: { code: error instanceof FdeStageConflictError ? 'stage-revision-conflict' : 'stage-invalid-transition', message: error.message },
          ...(requestedWorkspaceId === undefined ? {} : { value: { workspaceId: requestedWorkspaceId, ...error.current } }),
        })
        return
      }
      options.reportFailure?.(error)
      writeJson(response, 500, { ok: false, error: { code: 'internal-error', message: '验证评估阶段确认失败。' } })
    }
  }
}

/** Create the POST-only, fixed pilot-to-handoff manual gate. */
export function createCompletePilotRoute(
  options: CompletePilotRouteOptions,
): (request: IncomingMessage, response: ServerResponse) => Promise<void> {
  return async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    let requestedWorkspaceId: string | undefined
    try {
      if (!options.trusted(request)) throw new FdeStageRequestError('forbidden', 403, '当前请求不能确认项目阶段。')
      if (request.method !== 'POST') {
        request.resume()
        throw new FdeStageRequestError('method-not-allowed', 405, '阶段确认接口只接受 POST。')
      }
      const { workspaceId, expectedRevision } = completionRequestOf(await readJson(request))
      requestedWorkspaceId = workspaceId
      if (!options.workspaceExists(workspaceId)) {
        throw new FdeStageRequestError('workspace-not-found', 404, '当前项目不存在或已被移除。')
      }
      const deploymentTrial = await options.deploymentTrial(workspaceId)
      if (!deploymentTrial.gateReady) {
        throw new FdeStageRequestError(
          'stage-pilot-incomplete',
          409,
          `部署试运行尚未达到进入验收移交的条件：${deploymentTrial.blockers.join('；')}`,
        )
      }
      const record = await options.complete(workspaceId as WorkspaceId, expectedRevision)
      writeJson(response, 200, { ok: true, value: { workspaceId, ...record } })
    } catch (error) {
      if (error instanceof FdeStageRequestError) {
        writeJson(response, error.status, { ok: false, error: { code: error.code, message: error.message } })
        return
      }
      if (error instanceof FdeStageConflictError || error instanceof FdeStageTransitionError) {
        writeJson(response, 409, {
          ok: false,
          error: { code: error instanceof FdeStageConflictError ? 'stage-revision-conflict' : 'stage-invalid-transition', message: error.message },
          ...(requestedWorkspaceId === undefined ? {} : { value: { workspaceId: requestedWorkspaceId, ...error.current } }),
        })
        return
      }
      options.reportFailure?.(error)
      writeJson(response, 500, { ok: false, error: { code: 'internal-error', message: '部署试运行阶段确认失败。' } })
    }
  }
}

/** Create the POST-only, fixed handoff-to-completed manual gate. */
export function createCompleteHandoffRoute(
  options: CompleteHandoffRouteOptions,
): (request: IncomingMessage, response: ServerResponse) => Promise<void> {
  return async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    let requestedWorkspaceId: string | undefined
    try {
      if (!options.trusted(request)) throw new FdeStageRequestError('forbidden', 403, '当前请求不能确认项目阶段。')
      if (request.method !== 'POST') {
        request.resume()
        throw new FdeStageRequestError('method-not-allowed', 405, '阶段确认接口只接受 POST。')
      }
      const { workspaceId, expectedRevision } = completionRequestOf(await readJson(request))
      requestedWorkspaceId = workspaceId
      if (!options.workspaceExists(workspaceId)) {
        throw new FdeStageRequestError('workspace-not-found', 404, '当前项目不存在或已被移除。')
      }
      const acceptanceHandover = await options.acceptanceHandover(workspaceId)
      if (!acceptanceHandover.gateReady) {
        throw new FdeStageRequestError(
          'stage-handoff-incomplete',
          409,
          `验收移交尚未达到项目完成条件：${acceptanceHandover.blockers.join('；')}`,
        )
      }
      const record = await options.complete(workspaceId as WorkspaceId, expectedRevision)
      writeJson(response, 200, { ok: true, value: { workspaceId, ...record } })
    } catch (error) {
      if (error instanceof FdeStageRequestError) {
        writeJson(response, error.status, { ok: false, error: { code: error.code, message: error.message } })
        return
      }
      if (error instanceof FdeStageConflictError || error instanceof FdeStageTransitionError) {
        writeJson(response, 409, {
          ok: false,
          error: { code: error instanceof FdeStageConflictError ? 'stage-revision-conflict' : 'stage-invalid-transition', message: error.message },
          ...(requestedWorkspaceId === undefined ? {} : { value: { workspaceId: requestedWorkspaceId, ...error.current } }),
        })
        return
      }
      options.reportFailure?.(error)
      writeJson(response, 500, { ok: false, error: { code: 'internal-error', message: '验收移交阶段确认失败。' } })
    }
  }
}
