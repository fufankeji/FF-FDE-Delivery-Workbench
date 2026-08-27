/** Workspace-scoped project runtime state and exact-operation transitions. */

import { randomUUID } from 'node:crypto'
import { mkdir, readFile, stat } from 'node:fs/promises'
import { join, relative, resolve, sep } from 'node:path'
import { withFileLock, writeFileAtomic } from '@deepseek-ai/dsh-atomic-write'
import type { ProjectRuntimeSnapshot, ProjectRuntimeStatus } from './types.ts'

const FDE_DIRECTORY = '.fde'
const RUNTIME_FILE = 'project-runtime.json'
const MAX_RUNTIME_BYTES = 64 * 1024
const OPERATION_PATTERN = /^runtime_[a-f0-9]{32}$/u

/** Stable project-relative runtime record path. */
export const PROJECT_RUNTIME_PATH = `${FDE_DIRECTORY}/${RUNTIME_FILE}`

function recordOf(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} 必须是对象。`)
  return value as Record<string, unknown>
}

function textOf(value: unknown, label: string, max = 1_000): string {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${label} 必须是非空文字。`)
  const text = value.trim()
  if (text.length > max) throw new Error(`${label} 不能超过 ${String(max)} 个字符。`)
  return text
}

function optionalText(value: unknown, label: string, max = 1_000): string | undefined {
  if (value === undefined || value === null || value === '') return undefined
  return textOf(value, label, max)
}

function isLoopback(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase()
  return host === 'localhost' || host === '::1' || /^127(?:\.\d{1,3}){3}$/u.test(host)
}

/** Normalize one verified local project URL and reject broad or credentialed targets. */
export function projectRuntimeUrl(value: unknown, label: string): string | undefined {
  const text = optionalText(value, label, 2_000)
  if (text === undefined) return undefined
  const url = new URL(text)
  if ((url.protocol !== 'http:' && url.protocol !== 'https:') || !isLoopback(url.hostname)) {
    throw new Error(`${label} 只接受本机 loopback HTTP(S) 地址。`)
  }
  if (url.username !== '' || url.password !== '') throw new Error(`${label} 不能包含用户名或密码。`)
  return url.toString()
}

function projectRelative(root: string, value: string, label: string): string {
  const candidate = resolve(root, value)
  const rel = relative(resolve(root), candidate)
  if (rel === '' || rel === '..' || rel.startsWith(`..${sep}`) || rel.startsWith('../')) {
    throw new Error(`${label} 必须位于当前项目内。`)
  }
  return rel.split(sep).join('/')
}

function openApiSourceOf(root: string, value: unknown): string | undefined {
  const text = optionalText(value, 'openapiSource', 2_000)
  if (text === undefined) return undefined
  return /^https?:\/\//iu.test(text)
    ? projectRuntimeUrl(text, 'openapiSource')
    : projectRelative(root, text, 'openapiSource')
}

function parseRuntime(value: unknown, root: string): ProjectRuntimeSnapshot {
  const record = recordOf(value, '项目运行记录')
  if (record.schemaVersion !== 1) throw new Error('项目运行记录 schemaVersion 必须是 1。')
  if (!Number.isSafeInteger(record.revision) || Number(record.revision) < 1) throw new Error('项目运行记录 revision 无效。')
  const statuses: readonly ProjectRuntimeStatus[] = ['stopped', 'starting', 'running', 'stopping', 'blocked']
  if (typeof record.status !== 'string' || !statuses.includes(record.status as ProjectRuntimeStatus)) {
    throw new Error('项目运行记录 status 无效。')
  }
  const action = record.action
  if (action !== 'start' && action !== 'stop') throw new Error('项目运行记录 action 无效。')
  const operationId = textOf(record.operationId, 'operationId', 80)
  if (!OPERATION_PATTERN.test(operationId)) throw new Error('项目运行记录 operationId 无效。')
  const sessionId = textOf(record.sessionId, 'sessionId', 160)
  const previewUrl = projectRuntimeUrl(record.previewUrl, 'previewUrl')
  const docsUrl = projectRuntimeUrl(record.docsUrl, 'docsUrl')
  const baseUrl = projectRuntimeUrl(record.baseUrl, 'baseUrl')
  const openapiSource = openApiSourceOf(root, record.openapiSource)
  const message = optionalText(record.message, 'message', 1_000)
  const terminalTitle = optionalText(record.terminalTitle, 'terminalTitle', 120)
  return {
    schemaVersion: 1,
    revision: Number(record.revision),
    status: record.status as ProjectRuntimeStatus,
    action,
    operationId,
    sessionId,
    updatedAt: textOf(record.updatedAt, 'updatedAt', 80),
    ...(message === undefined ? {} : { message }),
    ...(previewUrl === undefined ? {} : { previewUrl }),
    ...(docsUrl === undefined ? {} : { docsUrl }),
    ...(openapiSource === undefined ? {} : { openapiSource }),
    ...(baseUrl === undefined ? {} : { baseUrl }),
    ...(terminalTitle === undefined ? {} : { terminalTitle }),
  }
}

function stoppedRuntime(): ProjectRuntimeSnapshot {
  return { schemaVersion: 1, revision: 0, status: 'stopped', updatedAt: new Date(0).toISOString() }
}

async function readRuntimeFile(root: string): Promise<ProjectRuntimeSnapshot> {
  const path = join(root, FDE_DIRECTORY, RUNTIME_FILE)
  const info = await stat(path)
  if (!info.isFile() || info.size > MAX_RUNTIME_BYTES) throw new Error('项目运行记录不是文件或超过 64 KiB。')
  return parseRuntime(JSON.parse(await readFile(path, 'utf8')) as unknown, root)
}

/** Read the exact durable runtime record, returning stopped only when absent. */
export async function readProjectRuntime(root: string): Promise<ProjectRuntimeSnapshot> {
  try { return await readRuntimeFile(root) } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return stoppedRuntime()
    throw error
  }
}

/** Read a browser-safe runtime snapshot without turning a malformed file into success. */
export async function loadProjectRuntimeSnapshot(root: string): Promise<ProjectRuntimeSnapshot> {
  try { return await readProjectRuntime(root) } catch (error) {
    return {
      schemaVersion: 1,
      revision: 0,
      status: 'blocked',
      updatedAt: new Date(0).toISOString(),
      message: `项目运行记录无效：${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

async function commitRuntime(root: string, value: ProjectRuntimeSnapshot): Promise<void> {
  await writeFileAtomic(join(root, FDE_DIRECTORY, RUNTIME_FILE), `${JSON.stringify(value, null, 2)}\n`, {
    mode: 0o600,
    dirMode: 0o700,
  })
}

/** Begin one exact start or stop operation against the current runtime state. */
export async function beginProjectRuntimeOperation(
  root: string,
  action: 'start' | 'stop',
  sessionId: string,
): Promise<ProjectRuntimeSnapshot> {
  const ownerSessionId = textOf(sessionId, 'sessionId', 160)
  const path = join(root, FDE_DIRECTORY, RUNTIME_FILE)
  await mkdir(join(root, FDE_DIRECTORY), { recursive: true, mode: 0o700 })
  return await withFileLock(path, async () => {
    const current = await readProjectRuntime(root)
    if (current.status === 'starting' || current.status === 'stopping') throw new Error('当前项目已有运行操作正在进行。')
    if (action === 'start' && current.status === 'running') throw new Error('当前项目已经在运行。')
    if (action === 'start' && current.status === 'blocked' && current.action === 'stop') {
      throw new Error('上一次停止结果仍未确认，请先重试停止。')
    }
    const canRetryStop = current.status === 'blocked'
      && current.action === 'stop'
      && current.previewUrl !== undefined
    if (action === 'stop' && current.status !== 'running' && !canRetryStop) {
      throw new Error('当前项目尚未运行，不能停止。')
    }
    const now = new Date().toISOString()
    const next: ProjectRuntimeSnapshot = {
      schemaVersion: 1,
      revision: current.revision + 1,
      operationId: `runtime_${randomUUID().replaceAll('-', '')}`,
      action,
      status: action === 'start' ? 'starting' : 'stopping',
      sessionId: action === 'stop' ? current.sessionId ?? ownerSessionId : ownerSessionId,
      updatedAt: now,
      message: action === 'start' ? '正在由当前项目 Agent 启动项目。' : '正在由当前项目 Agent 停止项目。',
      ...(action === 'stop' && current.previewUrl !== undefined ? { previewUrl: current.previewUrl } : {}),
      ...(action === 'stop' && current.docsUrl !== undefined ? { docsUrl: current.docsUrl } : {}),
      ...(action === 'stop' && current.openapiSource !== undefined ? { openapiSource: current.openapiSource } : {}),
      ...(action === 'stop' && current.baseUrl !== undefined ? { baseUrl: current.baseUrl } : {}),
      ...(action === 'stop' && current.terminalTitle !== undefined ? { terminalTitle: current.terminalTitle } : {}),
    }
    await commitRuntime(root, next)
    return next
  })
}

/** Settle a start/stop operation after the visible Agent prompt could not be queued. */
export async function abandonProjectRuntimeOperation(
  root: string,
  operationId: string,
  message: string,
): Promise<ProjectRuntimeSnapshot> {
  const id = textOf(operationId, 'operationId', 80)
  const reason = textOf(message, 'message', 1_000)
  const path = join(root, FDE_DIRECTORY, RUNTIME_FILE)
  return await withFileLock(path, async () => {
    const current = await readProjectRuntime(root)
    if (current.operationId !== id || (current.status !== 'starting' && current.status !== 'stopping')) {
      throw new Error('项目运行操作已经变化，请刷新后重试。')
    }
    const next: ProjectRuntimeSnapshot = {
      ...current,
      revision: current.revision + 1,
      status: current.action === 'start' ? 'blocked' : 'running',
      updatedAt: new Date().toISOString(),
      message: reason,
    }
    await commitRuntime(root, next)
    return next
  })
}

/** Agent-authored report for the exact current runtime operation. */
export interface ProjectRuntimeReportInput {
  readonly operationId: string
  readonly status: 'running' | 'stopped' | 'blocked'
  readonly message?: string
  readonly previewUrl?: string
  readonly docsUrl?: string
  readonly openapiSource?: string
  readonly baseUrl?: string
  readonly terminalTitle?: string
}

/** Commit one exact Agent report after validating session, transition, and targets. */
export async function reportProjectRuntime(
  root: string,
  input: ProjectRuntimeReportInput,
  actorSessionId: string,
): Promise<ProjectRuntimeSnapshot> {
  const operationId = textOf(input.operationId, 'operationId', 80)
  const sessionId = textOf(actorSessionId, 'actorSessionId', 160)
  const path = join(root, FDE_DIRECTORY, RUNTIME_FILE)
  return await withFileLock(path, async () => {
    const current = await readProjectRuntime(root)
    if (current.operationId !== operationId) throw new Error('项目运行报告已过期，请读取当前 operationId。')
    if (current.sessionId !== sessionId) throw new Error('项目运行报告必须由发起操作的项目会话提交。')
    if (current.action === undefined) throw new Error('当前项目运行操作缺少动作。')
    const allowed = current.status === 'starting'
      ? ['running', 'blocked']
      : current.status === 'stopping'
        ? ['stopped', 'running', 'blocked']
        : current.status === 'blocked' && current.action === 'start'
          ? ['running', 'blocked']
          : []
    if (!allowed.includes(input.status)) throw new Error(`当前 ${current.status} 状态不能报告为 ${input.status}。`)
    const previewUrl = projectRuntimeUrl(input.previewUrl ?? current.previewUrl, 'previewUrl')
    if (input.status === 'running' && previewUrl === undefined) throw new Error('运行成功必须报告已验证的 previewUrl。')
    const docsUrl = projectRuntimeUrl(input.docsUrl ?? (input.status === 'running' ? current.docsUrl : undefined), 'docsUrl')
    const baseUrl = projectRuntimeUrl(input.baseUrl ?? (input.status === 'running' ? current.baseUrl : undefined), 'baseUrl')
    const openapiSource = openApiSourceOf(root, input.openapiSource ?? (input.status === 'running' ? current.openapiSource : undefined))
    const message = optionalText(input.message, 'message', 1_000)
    const terminalTitle = optionalText(input.terminalTitle ?? current.terminalTitle, 'terminalTitle', 120)
    const next: ProjectRuntimeSnapshot = {
      schemaVersion: 1,
      revision: current.revision + 1,
      operationId,
      action: current.action,
      status: input.status,
      sessionId: current.sessionId,
      updatedAt: new Date().toISOString(),
      ...(message === undefined ? {} : { message }),
      ...(input.status !== 'stopped' && previewUrl !== undefined ? { previewUrl } : {}),
      ...(input.status === 'running' && docsUrl !== undefined ? { docsUrl } : {}),
      ...(input.status === 'running' && openapiSource !== undefined ? { openapiSource } : {}),
      ...(input.status === 'running' && baseUrl !== undefined ? { baseUrl } : {}),
      ...(terminalTitle === undefined ? {} : { terminalTitle }),
    }
    await commitRuntime(root, next)
    return next
  })
}
