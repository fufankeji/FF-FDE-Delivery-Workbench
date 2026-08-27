/** Stable project-source records and safe project-local file resolution. */

import { createHash, randomUUID } from 'node:crypto'
import {
  lstat, mkdir, readFile, readdir, realpath, rename, stat, unlink, writeFile,
} from 'node:fs/promises'
import { extname, isAbsolute, join, relative, sep } from 'node:path'
import type { PdfFacts } from '@jiaoqsh/dsh-document'
import {
  assertPathInside, PROJECT_RESOURCE_DIRECTORY, type StoredProjectResource,
} from './upload.ts'

/** Project-local root for FDE indexes and replaceable derivatives. */
export const FDE_STATE_DIRECTORY = '.fde'
/** Project-relative directory containing one JSON record per SourceId. */
export const SOURCE_RECORD_DIRECTORY = `${FDE_STATE_DIRECTORY}/sources`
/** Project-relative directory containing replaceable derived Markdown. */
export const DERIVED_DIRECTORY = `${FDE_STATE_DIRECTORY}/derived`
/** Persisted Source-record schema version. */
export const SOURCE_RECORD_VERSION = 1

/** Browser preview family for one original. */
export type ProjectSourcePreviewKind = 'office' | 'pdf' | 'image' | 'text' | 'unsupported'
/** Local-recognition status independent from original storage and preview. */
export type ProjectSourceParseStatus =
  | 'pending'
  | 'processing'
  | 'ready'
  | 'needs-ocr'
  | 'unsupported'
  | 'error'
  | 'stale'

/** Persisted model-free recognition projection for one Source. */
export interface ProjectSourceParseState {
  readonly status: ProjectSourceParseStatus
  readonly parser?: string
  readonly parserVersion?: string
  readonly sourceBytes?: number
  readonly sourceMtimeMs?: number
  readonly derivedPath?: string
  readonly updatedAt?: string
  readonly message?: string
  readonly pdf?: PdfFacts
}

/** Persisted identity and processing projection for one original project file. */
export interface ProjectSourceRecord {
  readonly version: typeof SOURCE_RECORD_VERSION
  readonly sourceId: string
  readonly originalName: string
  readonly storedName: string
  readonly relativePath: string
  readonly mimeType: string
  readonly extension: string
  readonly bytes: number
  readonly createdAt: string
  readonly modifiedAt: string
  readonly mtimeMs: number
  readonly previewKind: ProjectSourcePreviewKind
  readonly parse: ProjectSourceParseState
}

const MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  csv: 'text/csv; charset=utf-8',
  md: 'text/markdown; charset=utf-8',
  markdown: 'text/markdown; charset=utf-8',
  txt: 'text/plain; charset=utf-8',
  json: 'application/json; charset=utf-8',
  yaml: 'application/yaml; charset=utf-8',
  yml: 'application/yaml; charset=utf-8',
  xml: 'application/xml; charset=utf-8',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  avif: 'image/avif',
}

const OFFICE_EXTENSIONS = new Set([
  'docx', 'docm', 'dotx', 'dotm',
  'xlsx', 'xltx', 'xlsm', 'xlsb', 'xls', 'xlt', 'xla', 'xlam', 'xltm', 'csv', 'tsv', 'ods', 'fods',
  'pptx', 'pptm', 'potx', 'potm', 'ppsx', 'ppsm',
])
const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif'])
const TEXT_EXTENSIONS = new Set(['md', 'markdown', 'txt', 'csv', 'json', 'yaml', 'yml', 'xml'])
const PARSEABLE_EXTENSIONS = new Set([
  'doc', 'docm', 'docx', 'odt', 'pdf', 'ppt', 'pptx', 'pptm', 'pps', 'ppsx',
  'xls', 'xlsx', 'xlsm', 'xlsb', 'ods', 'odp', 'rtf', 'epub', 'csv',
  ...TEXT_EXTENSIONS,
])

/**
 * Normalize a filename extension for routing.
 * @param name - stored original name.
 * @returns lowercase extension without the leading dot.
 */
export function sourceExtension(name: string): string {
  return extname(name).slice(1).toLowerCase()
}

/**
 * Resolve the bounded MIME map used by the original-file route.
 * @param name - stored original name.
 * @returns a conservative MIME type.
 */
export function sourceMimeType(name: string): string {
  return MIME_BY_EXTENSION[sourceExtension(name)] ?? 'application/octet-stream'
}

/**
 * Resolve the first-slice preview family for a stored original.
 * @param name - stored original name.
 * @returns the declared preview family or unsupported.
 */
export function sourcePreviewKind(name: string): ProjectSourcePreviewKind {
  const extension = sourceExtension(name)
  if (OFFICE_EXTENSIONS.has(extension)) return 'office'
  if (extension === 'pdf') return 'pdf'
  if (IMAGE_EXTENSIONS.has(extension)) return 'image'
  if (TEXT_EXTENSIONS.has(extension)) return 'text'
  return 'unsupported'
}

function initialParseState(name: string): ProjectSourceParseState {
  const extension = sourceExtension(name)
  if (IMAGE_EXTENSIONS.has(extension)) return { status: 'needs-ocr', message: '图片资料需要 OCR 才能生成文本。' }
  return PARSEABLE_EXTENSIONS.has(extension)
    ? { status: 'pending' }
    : { status: 'unsupported', message: '当前本地识别器不支持此格式。' }
}

async function resolveWorkspace(workspacePath: string): Promise<string> {
  const workspace = await realpath(workspacePath)
  if (!(await lstat(workspace)).isDirectory()) throw new Error('项目目录当前不可用。')
  return workspace
}

async function ensureProjectDirectory(workspace: string, relativeDirectory: string): Promise<string> {
  const requested = join(workspace, relativeDirectory)
  assertPathInside(workspace, requested)
  await mkdir(requested, { recursive: true, mode: 0o700 })
  const info = await lstat(requested)
  if (info.isSymbolicLink() || !info.isDirectory()) throw new Error(`${relativeDirectory}/ 必须是项目内的真实目录。`)
  const resolved = await realpath(requested)
  assertPathInside(workspace, resolved)
  return resolved
}

function recordPath(directory: string, sourceId: string): string {
  if (!/^src_[a-zA-Z0-9_-]{12,80}$/u.test(sourceId)) throw new Error('项目资料标识无效。')
  const target = join(directory, `${sourceId}.json`)
  assertPathInside(directory, target)
  return target
}

async function writeRecord(directory: string, record: ProjectSourceRecord, exclusive = false): Promise<void> {
  const target = recordPath(directory, record.sourceId)
  if (exclusive) {
    await writeFile(target, `${JSON.stringify(record, null, 2)}\n`, { encoding: 'utf8', flag: 'wx', mode: 0o600 })
    return
  }
  const temporary = join(directory, `.record-${randomUUID()}`)
  assertPathInside(directory, temporary)
  try {
    await writeFile(temporary, `${JSON.stringify(record, null, 2)}\n`, { encoding: 'utf8', flag: 'wx', mode: 0o600 })
    await rename(temporary, target)
  } finally {
    await unlink(temporary).catch(() => undefined)
  }
}

function isProjectSourceRecord(value: unknown): value is ProjectSourceRecord {
  if (typeof value !== 'object' || value === null) return false
  const item = value as Partial<ProjectSourceRecord>
  return item.version === SOURCE_RECORD_VERSION
    && typeof item.sourceId === 'string'
    && typeof item.originalName === 'string'
    && typeof item.storedName === 'string'
    && typeof item.relativePath === 'string'
    && typeof item.bytes === 'number'
    && typeof item.mtimeMs === 'number'
    && typeof item.parse === 'object'
    && item.parse !== null
    && typeof item.parse.status === 'string'
}

async function loadRecords(directory: string): Promise<ProjectSourceRecord[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const records: ProjectSourceRecord[] = []
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue
    try {
      const parsed: unknown = JSON.parse(await readFile(join(directory, entry.name), 'utf8'))
      if (isProjectSourceRecord(parsed)) records.push(parsed)
    } catch {
      // One damaged record must not hide the remaining project originals.
    }
  }
  return records
}

function deterministicSourceId(relativePath: string): string {
  return `src_${createHash('sha256').update(relativePath.normalize('NFC')).digest('hex').slice(0, 24)}`
}

function recordForFile(
  storedName: string,
  originalName: string,
  file: Awaited<ReturnType<typeof stat>>,
  sourceId = `src_${randomUUID().replaceAll('-', '')}`,
): ProjectSourceRecord {
  return {
    version: SOURCE_RECORD_VERSION,
    sourceId,
    originalName,
    storedName,
    relativePath: `${PROJECT_RESOURCE_DIRECTORY}/${storedName}`,
    mimeType: sourceMimeType(storedName),
    extension: sourceExtension(storedName),
    bytes: Number(file.size),
    createdAt: file.birthtime.toISOString(),
    modifiedAt: file.mtime.toISOString(),
    mtimeMs: Number(file.mtimeMs),
    previewKind: sourcePreviewKind(storedName),
    parse: initialParseState(storedName),
  }
}

/**
 * Register a just-published upload batch, rolling back partial record files on failure.
 * @param workspacePath - explicit project root backing the addressed Workspace.
 * @param files - originals already published by the atomic upload batch.
 * @returns stable records in upload order.
 */
export async function registerStoredProjectResources(
  workspacePath: string,
  files: readonly StoredProjectResource[],
): Promise<readonly ProjectSourceRecord[]> {
  const workspace = await resolveWorkspace(workspacePath)
  const directory = await ensureProjectDirectory(workspace, SOURCE_RECORD_DIRECTORY)
  const created: string[] = []
  try {
    const records: ProjectSourceRecord[] = []
    for (const file of files) {
      const path = join(workspace, file.relativePath)
      assertPathInside(workspace, path)
      const info = await stat(path)
      const record = recordForFile(file.storedName, file.originalName, info)
      await writeRecord(directory, record, true)
      created.push(recordPath(directory, record.sourceId))
      records.push(record)
    }
    return records
  } catch (error) {
    await Promise.allSettled(created.map(path => unlink(path)))
    throw error
  }
}

function safeRecordedRelativePath(record: ProjectSourceRecord): boolean {
  const rel = relative(PROJECT_RESOURCE_DIRECTORY, record.relativePath)
  return record.relativePath.startsWith(`${PROJECT_RESOURCE_DIRECTORY}/`)
    && rel !== '..'
    && !rel.startsWith(`..${sep}`)
    && !isAbsolute(rel)
}

/**
 * Reconcile visible originals with persisted records and return a stable sorted list.
 * @param workspacePath - explicit project root backing the addressed Workspace.
 * @returns present originals with current metadata and parse status.
 */
export async function listProjectSources(workspacePath: string): Promise<readonly ProjectSourceRecord[]> {
  const workspace = await resolveWorkspace(workspacePath)
  const resources = join(workspace, PROJECT_RESOURCE_DIRECTORY)
  let resourceInfo
  try {
    resourceInfo = await lstat(resources)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
  if (resourceInfo.isSymbolicLink() || !resourceInfo.isDirectory()) throw new Error(`${PROJECT_RESOURCE_DIRECTORY}/ 必须是项目内的真实目录。`)
  const resolvedResources = await realpath(resources)
  assertPathInside(workspace, resolvedResources)
  const recordDirectory = await ensureProjectDirectory(workspace, SOURCE_RECORD_DIRECTORY)
  const records = await loadRecords(recordDirectory)
  const byPath = new Map(records.filter(safeRecordedRelativePath).map(record => [record.relativePath, record]))
  const output: ProjectSourceRecord[] = []
  for (const entry of await readdir(resolvedResources, { withFileTypes: true })) {
    if (!entry.isFile() || entry.isSymbolicLink() || entry.name.startsWith('.upload-')) continue
    const relativePath = `${PROJECT_RESOURCE_DIRECTORY}/${entry.name}`
    const filePath = join(resolvedResources, entry.name)
    assertPathInside(resolvedResources, filePath)
    const info = await stat(filePath)
    const existing = byPath.get(relativePath)
    if (existing === undefined) {
      const created = recordForFile(entry.name, entry.name, info, deterministicSourceId(relativePath))
      await writeRecord(recordDirectory, created, true).catch(async (error: unknown) => {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      })
      const current = (await loadRecords(recordDirectory)).find(item => item.relativePath === relativePath) ?? created
      output.push(current)
      continue
    }
    if (existing.bytes !== info.size || existing.mtimeMs !== info.mtimeMs) {
      const updated: ProjectSourceRecord = {
        ...existing,
        bytes: info.size,
        modifiedAt: info.mtime.toISOString(),
        mtimeMs: info.mtimeMs,
        parse: existing.parse.status === 'unsupported' || existing.parse.status === 'needs-ocr'
          ? initialParseState(existing.storedName)
          : { ...existing.parse, status: 'stale', message: '原件已经改变，需要重新识别。' },
      }
      await writeRecord(recordDirectory, updated)
      output.push(updated)
    } else {
      output.push(existing)
    }
  }
  return output.sort((left, right) => right.createdAt.localeCompare(left.createdAt) || left.storedName.localeCompare(right.storedName, 'zh-CN'))
}

/**
 * Resolve one SourceId to a verified regular original file.
 * @param workspacePath - explicit project root backing the addressed Workspace.
 * @param sourceId - stable Source identity to resolve.
 * @returns verified record, metadata directory, project root, and real file path.
 */
export async function resolveProjectSource(
  workspacePath: string,
  sourceId: string,
): Promise<{ readonly workspace: string; readonly recordDirectory: string; readonly record: ProjectSourceRecord; readonly path: string }> {
  const workspace = await resolveWorkspace(workspacePath)
  const records = await listProjectSources(workspace)
  const record = records.find(item => item.sourceId === sourceId)
  if (record === undefined) throw new Error('项目资料不存在或原件已移除。')
  const recordDirectory = await ensureProjectDirectory(workspace, SOURCE_RECORD_DIRECTORY)
  const resources = await realpath(join(workspace, PROJECT_RESOURCE_DIRECTORY))
  const requested = join(workspace, record.relativePath)
  assertPathInside(resources, requested)
  const info = await lstat(requested)
  if (info.isSymbolicLink() || !info.isFile()) throw new Error('项目资料原件不可用。')
  const resolved = await realpath(requested)
  assertPathInside(resources, resolved)
  return { workspace, recordDirectory, record, path: resolved }
}

/**
 * Persist an updated parse projection for one existing source.
 * @param recordDirectory - verified `.fde/sources` directory.
 * @param record - complete replacement Source record.
 */
export async function updateProjectSourceRecord(
  recordDirectory: string,
  record: ProjectSourceRecord,
): Promise<void> {
  await writeRecord(recordDirectory, record)
}

/**
 * Resolve/create the project derived directory.
 * @param workspace - verified project root.
 * @returns verified `.fde/derived` directory.
 */
export async function resolveDerivedDirectory(workspace: string): Promise<string> {
  return ensureProjectDirectory(workspace, DERIVED_DIRECTORY)
}
