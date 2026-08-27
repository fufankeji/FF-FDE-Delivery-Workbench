/** Same-origin Source list, original-file, and local-parse HTTP routes. */

import { readFile } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  listProjectSources, resolveProjectSource, type ProjectSourceRecord,
} from './records.ts'
import { parseProjectSource } from './parse.ts'

/** Exact same-origin route that lists/reconciles one project's Source records. */
export const PROJECT_SOURCE_LIST_PATH = '/api/fde-project-resources/list'
/** Exact same-origin route that serves one verified original. */
export const PROJECT_SOURCE_FILE_PATH = '/api/fde-project-resources/file'
/** Exact same-origin route that starts model-free local conversion. */
export const PROJECT_SOURCE_PARSE_PATH = '/api/fde-project-resources/parse'
const MAX_JSON_REQUEST_BYTES = 16 * 1024

/** Explicit trust, Workspace lookup, byte bound, and diagnostics for Source routes. */
export interface ProjectSourceRouteOptions {
  readonly trusted: (request: IncomingMessage) => boolean
  readonly workspacePath: (workspaceId: string) => string | undefined
  readonly maxFileBytes: number
  readonly reportFailure?: (error: unknown) => void
}

interface ProjectSourceRequestBody {
  readonly workspaceId: string
  readonly sourceId?: string
}

/** Browser Source record enriched with its addressed Workspace and read URL. */
export interface PublicProjectSource extends ProjectSourceRecord {
  readonly workspaceId: string
  readonly fileUrl: string
}

class ProjectSourceRouteError extends Error {
  constructor(readonly code: string, readonly status: number, message: string) {
    super(message)
    this.name = 'ProjectSourceRouteError'
  }
}

type ProjectSourceRouteHandler = (request: IncomingMessage, response: ServerResponse) => Promise<void>

function json(response: ServerResponse, status: number, body: object): void {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  response.end(JSON.stringify(body))
}

function fileUrl(workspaceId: string, sourceId: string): string {
  const params = new URLSearchParams({ workspaceId, sourceId })
  return `${PROJECT_SOURCE_FILE_PATH}?${params.toString()}`
}

function publicSource(workspaceId: string, record: ProjectSourceRecord): PublicProjectSource {
  return { ...record, workspaceId, fileUrl: fileUrl(workspaceId, record.sourceId) }
}

async function readJson(request: IncomingMessage): Promise<ProjectSourceRequestBody> {
  const contentType = request.headers['content-type'] ?? ''
  if (!contentType.toLowerCase().startsWith('application/json')) {
    request.resume()
    throw new ProjectSourceRouteError('unsupported-content-type', 415, '项目资料请求必须使用 application/json。')
  }
  const chunks: Uint8Array[] = []
  let total = 0
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    total += bytes.byteLength
    if (total > MAX_JSON_REQUEST_BYTES) {
      request.resume()
      throw new ProjectSourceRouteError('request-too-large', 413, '项目资料请求超过限制。')
    }
    chunks.push(bytes)
  }
  let value: unknown
  try {
    value = JSON.parse(Buffer.concat(chunks, total).toString('utf8'))
  } catch {
    throw new ProjectSourceRouteError('invalid-json', 400, '项目资料请求不是有效 JSON。')
  }
  if (typeof value !== 'object' || value === null) throw new ProjectSourceRouteError('invalid-request', 400, '项目资料请求无效。')
  const body = value as Partial<ProjectSourceRequestBody>
  if (typeof body.workspaceId !== 'string' || body.workspaceId.length < 1 || body.workspaceId.length > 512) {
    throw new ProjectSourceRouteError('invalid-workspace', 400, '缺少有效的项目标识。')
  }
  if (body.sourceId !== undefined && (typeof body.sourceId !== 'string' || body.sourceId.length > 128)) {
    throw new ProjectSourceRouteError('invalid-source', 400, '项目资料标识无效。')
  }
  return { workspaceId: body.workspaceId, ...(body.sourceId === undefined ? {} : { sourceId: body.sourceId }) }
}

function workspaceFor(options: ProjectSourceRouteOptions, workspaceId: string): string {
  const workspace = options.workspacePath(workspaceId)
  if (workspace === undefined) throw new ProjectSourceRouteError('workspace-not-found', 404, '项目不存在或已从工作台移除。')
  return workspace
}

function authorize(options: ProjectSourceRouteOptions, request: IncomingMessage, response: ServerResponse): boolean {
  if (options.trusted(request)) return true
  request.resume()
  json(response, 403, { ok: false, error: { code: 'forbidden', message: '只允许从本机工作台读取项目资料。' } })
  return false
}

function fail(options: ProjectSourceRouteOptions, response: ServerResponse, error: unknown): void {
  if (error instanceof ProjectSourceRouteError) {
    json(response, error.status, { ok: false, error: { code: error.code, message: error.message } })
    return
  }
  options.reportFailure?.(error)
  json(response, 500, {
    ok: false,
    error: { code: 'source-operation-failed', message: error instanceof Error ? error.message : '项目资料操作失败，请重试。' },
  })
}

/**
 * Build the list/reconcile route for one explicit project.
 * @param options - trust, Workspace lookup, byte bound, and diagnostics.
 * @returns a WebServer-compatible request handler.
 */
export function createProjectSourceListHandler(options: ProjectSourceRouteOptions): ProjectSourceRouteHandler {
  return async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    if (!authorize(options, request, response)) return
    if (request.method !== 'POST') {
      request.resume(); response.setHeader('allow', 'POST')
      json(response, 405, { ok: false, error: { code: 'method-not-allowed', message: '项目资料列表只接受 POST。' } })
      return
    }
    try {
      const body = await readJson(request)
      const records = await listProjectSources(workspaceFor(options, body.workspaceId))
      json(response, 200, { ok: true, value: { files: records.map(record => publicSource(body.workspaceId, record)) } })
    } catch (error) { fail(options, response, error) }
  }
}

/**
 * Build the verified original-file route for same-origin preview clients.
 * @param options - trust, Workspace lookup, byte bound, and diagnostics.
 * @returns a WebServer-compatible request handler.
 */
export function createProjectSourceFileHandler(options: ProjectSourceRouteOptions): ProjectSourceRouteHandler {
  return async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    if (!authorize(options, request, response)) return
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      request.resume(); response.setHeader('allow', 'GET, HEAD')
      json(response, 405, { ok: false, error: { code: 'method-not-allowed', message: '项目资料原件只接受 GET/HEAD。' } })
      return
    }
    try {
      const url = new URL(request.url ?? PROJECT_SOURCE_FILE_PATH, 'http://localhost')
      const workspaceId = url.searchParams.get('workspaceId') ?? ''
      const sourceId = url.searchParams.get('sourceId') ?? ''
      if (workspaceId === '' || sourceId === '') throw new ProjectSourceRouteError('invalid-request', 400, '缺少项目或资料标识。')
      let resolved
      try {
        resolved = await resolveProjectSource(workspaceFor(options, workspaceId), sourceId)
      } catch {
        throw new ProjectSourceRouteError('source-not-found', 404, '项目资料不存在或原件不可用。')
      }
      if (resolved.record.bytes > options.maxFileBytes) throw new ProjectSourceRouteError('file-too-large', 413, '项目资料超过预览读取限制。')
      response.writeHead(200, {
        'content-type': resolved.record.mimeType,
        'content-length': String(resolved.record.bytes),
        'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(resolved.record.storedName)}`,
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
      })
      if (request.method === 'HEAD') response.end()
      else response.end(await readFile(resolved.path))
    } catch (error) { fail(options, response, error) }
  }
}

/**
 * Build the model-free local-conversion route for one explicit Source.
 * @param options - trust, Workspace lookup, byte bound, and diagnostics.
 * @returns a WebServer-compatible request handler.
 */
export function createProjectSourceParseHandler(options: ProjectSourceRouteOptions): ProjectSourceRouteHandler {
  return async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    if (!authorize(options, request, response)) return
    if (request.method !== 'POST') {
      request.resume(); response.setHeader('allow', 'POST')
      json(response, 405, { ok: false, error: { code: 'method-not-allowed', message: '项目资料识别只接受 POST。' } })
      return
    }
    try {
      const body = await readJson(request)
      if (body.sourceId === undefined || body.sourceId === '') throw new ProjectSourceRouteError('invalid-source', 400, '缺少项目资料标识。')
      const record = await parseProjectSource(workspaceFor(options, body.workspaceId), body.sourceId)
      json(response, 200, { ok: true, value: { file: publicSource(body.workspaceId, record) } })
    } catch (error) { fail(options, response, error) }
  }
}
