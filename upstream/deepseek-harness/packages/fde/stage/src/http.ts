/** Trusted same-origin JSON route for reading or initializing one project stage. */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace'
import type { ProjectStageRecord } from './spec.ts'
import { FdeStageConflictError, FdeStageTransitionError } from './state.ts'

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

/** Dependencies for the fixed FDE-only requirement-research completion route. */
export interface CompleteRequirementsRouteOptions {
  trusted: (request: IncomingMessage) => boolean
  workspaceExists: (workspaceId: string) => boolean
  requirements: (workspaceId: string) => Promise<{
    readonly artifacts: readonly { readonly title: string; readonly status: 'missing' | 'present' | 'error' }[]
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
      const incomplete = requirements.artifacts.filter(artifact => artifact.status !== 'present')
      if (incomplete.length > 0) {
        throw new FdeStageRequestError(
          'stage-requirements-incomplete',
          409,
          `需求调研产物尚未齐备：${incomplete.map(artifact => artifact.title).join('、')}。`,
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
