/** Trusted same-origin route for project delivery read models. */

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

/** Dependencies of the exact-revision architecture confirmation route. */
export interface ArchitectureConfirmRouteOptions {
  readonly trusted: (request: IncomingMessage) => boolean
  readonly confirm: (workspaceId: string, revision: number) => Promise<ProjectSurfaceSnapshot | undefined>
  readonly reportFailure?: (error: unknown) => void
}

/** Dependencies of the project evaluation baseline route. */
export interface EvaluationBaselineRouteOptions {
  readonly trusted: (request: IncomingMessage) => boolean
  readonly approve: (workspaceId: string, reportPath: string) => Promise<ProjectSurfaceSnapshot | undefined>
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

function evaluationBaselineOf(value: unknown): { readonly workspaceId: string; readonly reportPath: string } {
  const workspaceId = workspaceIdOf(value)
  const reportPath = (value as { reportPath?: unknown }).reportPath
  if (typeof reportPath !== 'string' || reportPath.trim() === '') {
    throw new FdeProjectRequestError('invalid-request', 400, '评估基线请求缺少报告路径。')
  }
  return { workspaceId, reportPath }
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
