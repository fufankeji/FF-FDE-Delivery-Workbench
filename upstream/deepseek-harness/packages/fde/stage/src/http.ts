/** Trusted same-origin JSON route for reading or initializing one project stage. */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace'
import type { ProjectStageRecord } from './spec.ts'

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
