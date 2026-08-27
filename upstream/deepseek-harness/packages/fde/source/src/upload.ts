/** Project-scoped ordinary-file upload and atomic batch publication. @module @deepseek-ai/dsh-fde-source/upload */

import { File } from 'node:buffer'
import { constants } from 'node:fs'
import {
  chmod, link, lstat, mkdir, mkdtemp, open, realpath, rm, unlink,
} from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { basename, extname, isAbsolute, join, relative, sep } from 'node:path'

/** Stable visible directory shared by every Session of one FDE project. */
export const PROJECT_RESOURCE_DIRECTORY = 'fde-resources'
/** Multipart envelope allowance beyond the configured aggregate file bytes. */
const MULTIPART_ENVELOPE_BYTES = 1024 * 1024
/** Maximum UTF-8 bytes retained in one physical file name. */
const MAX_STORED_NAME_BYTES = 180

/** Deployment-owned upload limits resolved by the Host plugin. */
export interface ProjectResourceLimits {
  maxFileBytes: number
  maxFiles: number
  maxBatchBytes: number
}

/** One validated browser file before filesystem publication. */
export interface ProjectResourceInput {
  name: string
  data: Uint8Array
}

/** One committed project resource returned to the browser. */
export interface StoredProjectResource {
  originalName: string
  storedName: string
  relativePath: string
  bytes: number
}

/** Typed refusal whose HTTP status and stable code belong to the upload boundary. */
export class ProjectResourceUploadError extends Error {
  /**
   * @param code - stable browser-facing reason.
   * @param status - HTTP status for the exact route.
   * @param message - user-readable failure detail.
   */
  constructor(
    readonly code: string,
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ProjectResourceUploadError'
  }
}

/** Upload handler dependencies kept explicit for focused route tests. */
export interface ProjectResourceUploadHandlerOptions {
  limits: ProjectResourceLimits
  trusted: (request: IncomingMessage) => boolean
  workspacePath: (workspaceId: string) => string | undefined
  registerSources?: (
    workspacePath: string,
    files: readonly StoredProjectResource[],
  ) => Promise<readonly object[]>
  reportFailure?: (error: unknown) => void
}

function trimUtf8(value: string, maximumBytes: number): string {
  let output = ''
  for (const character of value) {
    if (Buffer.byteLength(output + character, 'utf8') > maximumBytes) break
    output += character
  }
  return output
}

/**
 * Preserve a readable Unicode leaf while removing traversal and cross-platform
 * forbidden characters.
 * @param value - untrusted browser filename.
 * @returns a non-empty portable leaf name.
 */
export function sanitizeProjectResourceName(value: string): string {
  const leaf = basename(value.replaceAll('\\', '/')).normalize('NFC')
  const cleaned = leaf
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/gu, '_')
    .replace(/^\.+/u, '')
    .replace(/[ .]+$/u, '')
    .trim()
  const bounded = trimUtf8(cleaned, MAX_STORED_NAME_BYTES)
  return bounded === '' ? 'file' : bounded
}

function collisionName(name: string, attempt: number): string {
  if (attempt === 0) return name
  const extension = extname(name)
  const stem = extension === '' ? name : name.slice(0, -extension.length)
  return `${stem}-${String(attempt)}${extension}`
}

/**
 * Reject a path that is not a strict descendant of the supplied root.
 * @param root - verified containment root.
 * @param target - candidate descendant path.
 */
export function assertPathInside(root: string, target: string): void {
  const rel = relative(root, target)
  if (rel !== '' && !rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel)) return
  throw new ProjectResourceUploadError('unsafe-path', 400, '项目资料路径超出当前项目。')
}

/**
 * Resolve and safely create the visible project resource directory.
 * @param workspacePath - explicit project root backing the addressed Workspace.
 * @returns verified real path of `fde-resources`.
 */
export async function resolveProjectResourceDirectory(workspacePath: string): Promise<string> {
  const workspace = await realpath(workspacePath)
  const workspaceInfo = await lstat(workspace)
  if (!workspaceInfo.isDirectory()) {
    throw new ProjectResourceUploadError('workspace-unavailable', 409, '项目目录当前不可用。')
  }
  const requested = join(workspace, PROJECT_RESOURCE_DIRECTORY)
  await mkdir(requested, { recursive: true, mode: 0o700 })
  const requestedInfo = await lstat(requested)
  if (requestedInfo.isSymbolicLink() || !requestedInfo.isDirectory()) {
    throw new ProjectResourceUploadError(
      'resource-directory-invalid',
      409,
      `${PROJECT_RESOURCE_DIRECTORY}/ 必须是项目内的真实目录。`,
    )
  }
  const directory = await realpath(requested)
  assertPathInside(workspace, directory)
  return directory
}

async function stageFile(path: string, data: Uint8Array): Promise<void> {
  const noFollow = 'O_NOFOLLOW' in constants ? constants.O_NOFOLLOW : 0
  const handle = await open(
    path,
    constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | noFollow,
    0o600,
  )
  try {
    await handle.writeFile(data)
    await handle.sync()
  } finally {
    await handle.close()
  }
}

async function publishUnique(directory: string, staged: string, requestedName: string): Promise<StoredProjectResource> {
  const safeName = sanitizeProjectResourceName(requestedName)
  for (let attempt = 0; attempt < 10_000; attempt += 1) {
    const storedName = collisionName(safeName, attempt)
    const target = join(directory, storedName)
    assertPathInside(directory, target)
    try {
      await link(staged, target)
      const bytes = (await lstat(staged)).size
      return {
        originalName: requestedName,
        storedName,
        relativePath: `${PROJECT_RESOURCE_DIRECTORY}/${storedName}`,
        bytes,
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') continue
      throw error
    }
  }
  throw new ProjectResourceUploadError('name-exhausted', 409, '无法为项目资料分配不冲突的文件名。')
}

/**
 * Stage a complete batch before publishing any member; ordinary publication
 * failures unlink every new member from this batch.
 * @param workspacePath - canonical or resolvable project directory.
 * @param files - already validated browser files.
 * @returns committed resource descriptors in browser order.
 */
export async function storeProjectResourceBatch(
  workspacePath: string,
  files: readonly ProjectResourceInput[],
): Promise<readonly StoredProjectResource[]> {
  const directory = await resolveProjectResourceDirectory(workspacePath)
  const staging = await mkdtemp(join(directory, '.upload-'))
  await chmod(staging, 0o700)
  const staged: string[] = []
  const published: string[] = []
  try {
    for (const [index, file] of files.entries()) {
      const path = join(staging, String(index))
      await stageFile(path, file.data)
      staged.push(path)
    }
    const results: StoredProjectResource[] = []
    for (const [index, file] of files.entries()) {
      const stagedPath = staged[index]
      if (stagedPath === undefined) throw new Error('fde-source: staged batch entry is missing')
      const result = await publishUnique(directory, stagedPath, file.name)
      published.push(join(directory, result.storedName))
      results.push(result)
    }
    return results
  } catch (error) {
    const cleanup = await Promise.allSettled(published.map(path => unlink(path)))
    const failedCleanup = cleanup.find(result => result.status === 'rejected')
    if (failedCleanup?.status === 'rejected') {
      throw new AggregateError([error, failedCleanup.reason], 'project resource batch failed and rollback was incomplete')
    }
    throw error
  } finally {
    await rm(staging, { recursive: true, force: true })
  }
}

async function rollbackStoredProjectResources(
  workspacePath: string,
  files: readonly StoredProjectResource[],
): Promise<void> {
  const workspace = await realpath(workspacePath)
  const paths = files.map((file) => {
    const target = join(workspace, file.relativePath)
    assertPathInside(workspace, target)
    return target
  })
  const results = await Promise.allSettled(paths.map(path => unlink(path)))
  const failure = results.find(result => result.status === 'rejected')
  if (failure?.status === 'rejected') throw failure.reason
}

async function readBody(request: IncomingMessage, maximumBytes: number): Promise<Uint8Array> {
  const declaredRaw = request.headers['content-length']
  const declared = typeof declaredRaw === 'string' ? Number(declaredRaw) : undefined
  if (declared !== undefined && (!Number.isSafeInteger(declared) || declared < 0)) {
    request.resume()
    throw new ProjectResourceUploadError('invalid-length', 400, '上传请求长度无效。')
  }
  if (declared !== undefined && declared > maximumBytes) {
    request.resume()
    throw new ProjectResourceUploadError('batch-too-large', 413, '本次项目资料总大小超过限制。')
  }
  const chunks: Uint8Array[] = []
  let total = 0
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    total += bytes.byteLength
    if (total > maximumBytes) {
      request.resume()
      throw new ProjectResourceUploadError('batch-too-large', 413, '本次项目资料总大小超过限制。')
    }
    chunks.push(bytes)
  }
  return Buffer.concat(chunks, total)
}

function requestHeaders(request: IncomingMessage): Headers {
  const headers = new Headers()
  for (const [name, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(name, item)
    } else if (value !== undefined) {
      headers.set(name, value)
    }
  }
  return headers
}

async function parseMultipartBatch(
  request: IncomingMessage,
  limits: ProjectResourceLimits,
): Promise<{ workspaceId: string; files: ProjectResourceInput[] }> {
  const contentType = request.headers['content-type'] ?? ''
  if (!contentType.toLowerCase().startsWith('multipart/form-data;')) {
    request.resume()
    throw new ProjectResourceUploadError('unsupported-content-type', 415, '项目资料上传必须使用 multipart/form-data。')
  }
  const body = await readBody(request, limits.maxBatchBytes + MULTIPART_ENVELOPE_BYTES)
  let form: FormData
  try {
    const bodyBuffer = new ArrayBuffer(body.byteLength)
    new Uint8Array(bodyBuffer).set(body)
    const webRequest = new Request('http://localhost/fde-project-resources/upload', {
      method: 'POST',
      headers: requestHeaders(request),
      body: bodyBuffer,
    })
    form = await webRequest.formData()
  } catch (error) {
    throw new ProjectResourceUploadError('invalid-multipart', 400, `无法解析项目资料批次：${String(error)}`)
  }
  const workspace = form.get('workspaceId')
  if (typeof workspace !== 'string' || workspace.length < 1 || workspace.length > 512) {
    throw new ProjectResourceUploadError('invalid-workspace', 400, '缺少有效的项目标识。')
  }
  const entries = form.getAll('files')
  if (entries.length < 1) {
    throw new ProjectResourceUploadError('empty-batch', 400, '请选择至少一个项目资料文件。')
  }
  if (entries.length > limits.maxFiles) {
    throw new ProjectResourceUploadError('too-many-files', 413, `一次最多添加 ${String(limits.maxFiles)} 个项目资料。`)
  }
  const files: ProjectResourceInput[] = []
  let total = 0
  for (const entry of entries) {
    if (!(entry instanceof File)) {
      throw new ProjectResourceUploadError('invalid-file', 400, '项目资料批次包含无效文件。')
    }
    if (entry.size > limits.maxFileBytes) {
      throw new ProjectResourceUploadError(
        'file-too-large',
        413,
        `文件“${entry.name}”超过单文件大小限制。`,
      )
    }
    total += entry.size
    if (total > limits.maxBatchBytes) {
      throw new ProjectResourceUploadError('batch-too-large', 413, '本次项目资料总大小超过限制。')
    }
    files.push({ name: entry.name, data: new Uint8Array(await entry.arrayBuffer()) })
  }
  return { workspaceId: workspace, files }
}

function json(response: ServerResponse, status: number, body: object): void {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(body))
}

/**
 * Build the exact upload-route handler.
 * @param options - trust, Workspace lookup, limits, and diagnostics.
 * @returns a WebServer-compatible request handler.
 */
export function createProjectResourceUploadHandler(
  options: ProjectResourceUploadHandlerOptions,
): (request: IncomingMessage, response: ServerResponse) => Promise<void> {
  return async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    if (!options.trusted(request)) {
      request.resume()
      json(response, 403, { ok: false, error: { code: 'forbidden', message: '只允许从本机工作台添加项目资料。' } })
      return
    }
    if (request.method !== 'POST') {
      request.resume()
      response.setHeader('allow', 'POST')
      json(response, 405, { ok: false, error: { code: 'method-not-allowed', message: '项目资料入口只接受 POST。' } })
      return
    }
    try {
      const batch = await parseMultipartBatch(request, options.limits)
      const workspacePath = options.workspacePath(batch.workspaceId)
      if (workspacePath === undefined) {
        throw new ProjectResourceUploadError('workspace-not-found', 404, '项目不存在或已从工作台移除。')
      }
      const stored = await storeProjectResourceBatch(workspacePath, batch.files)
      let files: readonly object[] = stored
      if (options.registerSources !== undefined) {
        try {
          files = await options.registerSources(workspacePath, stored)
        } catch (error) {
          try {
            await rollbackStoredProjectResources(workspacePath, stored)
          } catch (rollbackError) {
            throw new AggregateError([error, rollbackError], 'source registration failed and original rollback was incomplete')
          }
          throw error
        }
      }
      json(response, 200, {
        ok: true,
        value: { directory: PROJECT_RESOURCE_DIRECTORY, files },
      })
    } catch (error) {
      if (error instanceof ProjectResourceUploadError) {
        json(response, error.status, { ok: false, error: { code: error.code, message: error.message } })
        return
      }
      options.reportFailure?.(error)
      json(response, 500, { ok: false, error: { code: 'write-failed', message: '项目资料保存失败，请重试。' } })
    }
  }
}
