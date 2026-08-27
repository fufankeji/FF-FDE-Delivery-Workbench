/** Workspace-scoped requirement Wiki builds, immutable revisions, and source provenance. */

import { createHash, randomUUID } from 'node:crypto'
import {
  lstat, mkdir, readFile, realpath, rename, rm, stat, writeFile,
} from 'node:fs/promises'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import { withFileLock, writeFileAtomic } from '@deepseek-ai/dsh-atomic-write'
import { listProjectSources, type ProjectSourceRecord } from '@deepseek-ai/dsh-fde-source'
import {
  REQUIREMENT_WIKI_RELATIONS,
  REQUIREMENT_WIKI_TOPICS,
  type RequirementWikiBuild,
  type RequirementWikiIssue,
  type RequirementWikiPage,
  type RequirementWikiRelation,
  type RequirementWikiSnapshot,
  type RequirementWikiSource,
  type RequirementWikiVersion,
} from './types.ts'

const WIKI_DIRECTORY = '.fde/requirement-wiki'
const CURRENT_FILE = 'current.json'
const BUILD_FILE = 'build.json'
const VERSIONS_DIRECTORY = 'versions'
const MAX_JSON_BYTES = 2 * 1024 * 1024
const MAX_SOURCES = 30
const MAX_PAGES = 120
const MAX_RELATIONS = 360
const MAX_ISSUES = 80
const MAX_PAGE_BODY = 16_000
const MAX_DERIVED_BYTES = 8 * 1024 * 1024
const SAFE_ID = /^[a-z][a-z0-9_-]{2,79}$/u
const SAFE_SOURCE_ID = /^src_[a-zA-Z0-9_-]{12,80}$/u
const SAFE_FINGERPRINT = /^[a-f0-9]{64}$/u
const BLOCKED_HTML = /<(?:script|iframe|object|embed|link|style)\b|\son[a-z]+\s*=/iu

interface CurrentPointer {
  readonly schemaVersion: 1
  readonly revision: number
  readonly buildId: string
}

interface ManifestPage extends Omit<RequirementWikiPage, 'body'> {
  readonly bodyPath: string
}

interface RequirementWikiManifest extends Omit<RequirementWikiVersion, 'pages'> {
  readonly pages: readonly ManifestPage[]
}

interface ParsedCandidate {
  readonly pages: readonly RequirementWikiPage[]
  readonly relations: readonly RequirementWikiRelation[]
  readonly conflicts: readonly RequirementWikiIssue[]
  readonly unknowns: readonly RequirementWikiIssue[]
}

function recordOf(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} 必须是对象。`)
  return value as Record<string, unknown>
}

function textOf(value: unknown, label: string, max: number): string {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${label} 必须是非空文字。`)
  const text = value.trim()
  if (text.length > max) throw new Error(`${label} 不能超过 ${String(max)} 个字符。`)
  return text
}

function optionalText(value: unknown, label: string, max: number): string | undefined {
  if (value === undefined || value === null || value === '') return undefined
  return textOf(value, label, max)
}

function integerOf(value: unknown, label: string, minimum: number): number {
  if (!Number.isSafeInteger(value) || Number(value) < minimum) throw new Error(`${label} 必须是大于等于 ${String(minimum)} 的整数。`)
  return Number(value)
}

function finiteNumberOf(value: unknown, label: string, minimum: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum) {
    throw new Error(`${label} 必须是大于等于 ${String(minimum)} 的有限数值。`)
  }
  return value
}

function idOf(value: unknown, label: string): string {
  const id = textOf(value, label, 80)
  if (!SAFE_ID.test(id)) throw new Error(`${label} 只能使用小写字母、数字、下划线和连字符，并以字母开头。`)
  return id
}

function assertInside(root: string, candidate: string): void {
  const rel = relative(resolve(root), resolve(candidate))
  if (rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel))) return
  throw new Error('需求 Wiki 文件越过项目目录。')
}

async function readBoundedJson(path: string): Promise<unknown> {
  const info = await stat(path)
  if (!info.isFile() || info.size > MAX_JSON_BYTES) throw new Error('需求 Wiki JSON 无效或超过 2 MiB。')
  return JSON.parse(await readFile(path, 'utf8')) as unknown
}

function uniqueStrings(value: unknown, label: string, maximum: number): string[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > maximum) {
    throw new Error(`${label} 必须包含 1 到 ${String(maximum)} 项。`)
  }
  const values = value.map((item, index) => textOf(item, `${label}[${String(index)}]`, 100))
  if (new Set(values).size !== values.length) throw new Error(`${label} 不能重复。`)
  return values
}

function optionalUniqueStrings(value: unknown, label: string, maximum: number): string[] {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > maximum) throw new Error(`${label} 必须是最多 ${String(maximum)} 项的数组。`)
  const values = value.map((item, index) => textOf(item, `${label}[${String(index)}]`, 100))
  if (new Set(values).size !== values.length) throw new Error(`${label} 不能重复。`)
  return values
}

function sourceIdsOf(value: unknown, label: string, allowed: ReadonlySet<string>): string[] {
  const sourceIds = uniqueStrings(value, label, MAX_SOURCES)
  for (const sourceId of sourceIds) {
    if (!allowed.has(sourceId)) throw new Error(`${label} 引用了本次输入之外的资料：${sourceId}`)
  }
  return sourceIds
}

function parseSource(value: unknown, label: string): RequirementWikiSource {
  const item = recordOf(value, label)
  const sourceId = textOf(item.sourceId, `${label}.sourceId`, 100)
  if (!SAFE_SOURCE_ID.test(sourceId)) throw new Error(`${label}.sourceId 无效。`)
  const relativePath = textOf(item.relativePath, `${label}.relativePath`, 1_000)
  const derivedPath = textOf(item.derivedPath, `${label}.derivedPath`, 1_000)
  const unsafePath = (path: string): boolean => path.includes('\\')
    || path.split('/').some(segment => segment === '' || segment === '.' || segment === '..')
  if (isAbsolute(relativePath) || isAbsolute(derivedPath)
    || !relativePath.startsWith('fde-resources/') || !derivedPath.startsWith('.fde/derived/')
    || unsafePath(relativePath) || unsafePath(derivedPath)) {
    throw new Error(`${label} 必须引用项目内原件与派生文本。`)
  }
  return {
    sourceId,
    storedName: textOf(item.storedName, `${label}.storedName`, 300),
    relativePath,
    derivedPath,
    bytes: integerOf(item.bytes, `${label}.bytes`, 0),
    mtimeMs: finiteNumberOf(item.mtimeMs, `${label}.mtimeMs`, 0),
    parser: textOf(item.parser, `${label}.parser`, 160),
    parserVersion: textOf(item.parserVersion, `${label}.parserVersion`, 80),
  }
}

function parseSources(value: unknown, label: string): RequirementWikiSource[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_SOURCES) {
    throw new Error(`${label} 必须包含 1 到 ${String(MAX_SOURCES)} 项。`)
  }
  const sources = value.map((item, index) => parseSource(item, `${label}[${String(index)}]`))
  if (new Set(sources.map(source => source.sourceId)).size !== sources.length) throw new Error(`${label} 的 SourceId 不能重复。`)
  return sources
}

function parsePages(value: unknown, allowedSources: ReadonlySet<string>): RequirementWikiPage[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_PAGES) {
    throw new Error(`pages 必须包含 1 到 ${String(MAX_PAGES)} 个知识页。`)
  }
  const ids = new Set<string>()
  return value.map((raw, index) => {
    const page = recordOf(raw, `pages[${String(index)}]`)
    const id = idOf(page.id, `pages[${String(index)}].id`)
    if (ids.has(id)) throw new Error(`知识页 ID 重复：${id}`)
    ids.add(id)
    const topic = textOf(page.topic, `pages[${String(index)}].topic`, 40)
    if (!(REQUIREMENT_WIKI_TOPICS as readonly string[]).includes(topic)) throw new Error(`知识页主题无效：${topic}`)
    const body = textOf(page.body, `pages[${String(index)}].body`, MAX_PAGE_BODY)
    if (BLOCKED_HTML.test(body)) throw new Error(`知识页 ${id} 包含不允许的 HTML 或事件属性。`)
    const summary = optionalText(page.summary, `pages[${String(index)}].summary`, 500)
    return {
      id,
      topic: topic as RequirementWikiPage['topic'],
      title: textOf(page.title, `pages[${String(index)}].title`, 240),
      ...(summary === undefined ? {} : { summary }),
      body,
      sourceIds: sourceIdsOf(page.sourceIds, `pages[${String(index)}].sourceIds`, allowedSources),
    }
  })
}

function parseRelations(
  value: unknown,
  pageIds: ReadonlySet<string>,
  allowedSources: ReadonlySet<string>,
): RequirementWikiRelation[] {
  if (!Array.isArray(value) || value.length > MAX_RELATIONS) throw new Error(`relations 必须是最多 ${String(MAX_RELATIONS)} 项的数组。`)
  const ids = new Set<string>()
  const relationships = new Set<string>()
  return value.map((raw, index) => {
    const relation = recordOf(raw, `relations[${String(index)}]`)
    const id = idOf(relation.id, `relations[${String(index)}].id`)
    if (ids.has(id)) throw new Error(`知识关系 ID 重复：${id}`)
    ids.add(id)
    const from = idOf(relation.from, `relations[${String(index)}].from`)
    const to = idOf(relation.to, `relations[${String(index)}].to`)
    if (!pageIds.has(from) || !pageIds.has(to) || from === to) throw new Error(`知识关系端点无效：${from} → ${to}`)
    const type = textOf(relation.type, `relations[${String(index)}].type`, 40)
    if (!(REQUIREMENT_WIKI_RELATIONS as readonly string[]).includes(type)) throw new Error(`知识关系类型无效：${type}`)
    const directed = relation.directed ?? true
    if (typeof directed !== 'boolean') throw new Error(`relations[${String(index)}].directed 必须是布尔值。`)
    const key = `${from}\0${to}\0${type}\0${String(directed)}`
    if (relationships.has(key)) throw new Error(`知识关系重复：${from} → ${to}`)
    relationships.add(key)
    const label = optionalText(relation.label, `relations[${String(index)}].label`, 160)
    return {
      id,
      from,
      to,
      type: type as RequirementWikiRelation['type'],
      ...(label === undefined ? {} : { label }),
      directed,
      sourceIds: sourceIdsOf(relation.sourceIds, `relations[${String(index)}].sourceIds`, allowedSources),
    }
  })
}

function parseIssues(
  value: unknown,
  label: 'conflicts' | 'unknowns',
  pageIds: ReadonlySet<string>,
  allowedSources: ReadonlySet<string>,
): RequirementWikiIssue[] {
  if (!Array.isArray(value) || value.length > MAX_ISSUES) throw new Error(`${label} 必须是最多 ${String(MAX_ISSUES)} 项的数组。`)
  const ids = new Set<string>()
  return value.map((raw, index) => {
    const issue = recordOf(raw, `${label}[${String(index)}]`)
    const id = idOf(issue.id, `${label}[${String(index)}].id`)
    if (ids.has(id)) throw new Error(`${label} ID 重复：${id}`)
    ids.add(id)
    const pageIdsValue = optionalUniqueStrings(issue.pageIds, `${label}[${String(index)}].pageIds`, 30)
    for (const pageId of pageIdsValue) if (!pageIds.has(pageId)) throw new Error(`${label} 引用了未知知识页：${pageId}`)
    const detail = textOf(issue.detail, `${label}[${String(index)}].detail`, 3_000)
    if (BLOCKED_HTML.test(detail)) throw new Error(`${label} ${id} 包含不允许的 HTML 或事件属性。`)
    const impact = optionalText(issue.impact, `${label}[${String(index)}].impact`, 1_000)
    return {
      id,
      title: textOf(issue.title, `${label}[${String(index)}].title`, 240),
      detail,
      ...(impact === undefined ? {} : { impact }),
      pageIds: pageIdsValue,
      sourceIds: sourceIdsOf(issue.sourceIds, `${label}[${String(index)}].sourceIds`, allowedSources),
    }
  })
}

/**
 * Validate and normalize one complete Agent-authored Wiki candidate.
 * @param value - Untrusted complete candidate received through the tool boundary.
 * @param allowedSourceIds - Exact SourceIds frozen into the active build.
 * @returns Bounded pages, relations, conflicts, and unknowns with valid citations.
 * @throws When any value, identity, relation, citation, content, or aggregate bound is invalid.
 */
export function parseRequirementWikiCandidate(
  value: unknown,
  allowedSourceIds: readonly string[],
): ParsedCandidate {
  const candidate = recordOf(value, '需求 Wiki 候选')
  const allowedSources = new Set(allowedSourceIds)
  if (allowedSources.size === 0) throw new Error('需求 Wiki 构建没有有效来源。')
  const pages = parsePages(candidate.pages, allowedSources)
  const pageIds = new Set(pages.map(page => page.id))
  const parsed = {
    pages,
    relations: parseRelations(candidate.relations ?? [], pageIds, allowedSources),
    conflicts: parseIssues(candidate.conflicts ?? [], 'conflicts', pageIds, allowedSources),
    unknowns: parseIssues(candidate.unknowns ?? [], 'unknowns', pageIds, allowedSources),
  }
  if (Buffer.byteLength(JSON.stringify(parsed), 'utf8') > MAX_JSON_BYTES) throw new Error('需求 Wiki 候选超过 2 MiB。')
  return parsed
}

function catalogValue(records: readonly ProjectSourceRecord[]): unknown {
  return [...records].sort((left, right) => left.sourceId.localeCompare(right.sourceId)).map(record => ({
    sourceId: record.sourceId,
    relativePath: record.relativePath,
    bytes: record.bytes,
    mtimeMs: record.mtimeMs,
    parse: {
      status: record.parse.status,
      parser: record.parse.parser ?? null,
      parserVersion: record.parse.parserVersion ?? null,
      sourceBytes: record.parse.sourceBytes ?? null,
      sourceMtimeMs: record.parse.sourceMtimeMs ?? null,
      derivedPath: record.parse.derivedPath ?? null,
    },
  }))
}

function catalogFingerprint(records: readonly ProjectSourceRecord[]): string {
  return createHash('sha256').update(JSON.stringify(catalogValue(records))).digest('hex')
}

async function verifiedBuildSource(root: string, record: ProjectSourceRecord): Promise<RequirementWikiSource> {
  const parse = record.parse
  if (parse.status !== 'ready' || parse.derivedPath === undefined
    || parse.parser === undefined || parse.parserVersion === undefined
    || parse.sourceBytes !== record.bytes || parse.sourceMtimeMs !== record.mtimeMs) {
    throw new Error(`项目资料尚未形成当前有效派生文本：${record.storedName}`)
  }
  if (isAbsolute(parse.derivedPath) || !parse.derivedPath.startsWith('.fde/derived/')) throw new Error('项目资料派生路径无效。')
  const workspace = await realpath(root)
  const derivedRoot = await realpath(join(workspace, '.fde', 'derived'))
  assertInside(workspace, derivedRoot)
  const candidate = join(workspace, parse.derivedPath)
  assertInside(derivedRoot, candidate)
  const info = await lstat(candidate)
  if (info.isSymbolicLink() || !info.isFile() || info.size > MAX_DERIVED_BYTES) throw new Error(`项目资料派生文本不可用或超过 8 MiB：${record.storedName}`)
  const resolved = await realpath(candidate)
  assertInside(derivedRoot, resolved)
  return {
    sourceId: record.sourceId,
    storedName: record.storedName,
    relativePath: record.relativePath,
    derivedPath: parse.derivedPath,
    bytes: record.bytes,
    mtimeMs: record.mtimeMs,
    parser: parse.parser,
    parserVersion: parse.parserVersion,
  }
}

async function sourceSnapshot(root: string, sourceIds: readonly string[]): Promise<{
  readonly fingerprint: string
  readonly sources: readonly RequirementWikiSource[]
}> {
  if (sourceIds.length === 0 || sourceIds.length > MAX_SOURCES || new Set(sourceIds).size !== sourceIds.length) {
    throw new Error(`请选择 1 到 ${String(MAX_SOURCES)} 份不重复的项目资料。`)
  }
  const records = await listProjectSources(root)
  const byId = new Map(records.map(record => [record.sourceId, record]))
  const sources: RequirementWikiSource[] = []
  for (const sourceId of sourceIds) {
    if (!SAFE_SOURCE_ID.test(sourceId)) throw new Error('项目资料标识无效。')
    const record = byId.get(sourceId)
    if (record === undefined) throw new Error(`项目资料不存在或不属于当前项目：${sourceId}`)
    sources.push(await verifiedBuildSource(root, record))
  }
  return { fingerprint: catalogFingerprint(records), sources }
}

function wikiRoot(root: string): string {
  return join(root, WIKI_DIRECTORY)
}

function stateLockPath(root: string): string {
  return join(wikiRoot(root), 'state')
}

function revisionName(revision: number): string {
  return `R${String(revision).padStart(6, '0')}`
}

function parseCurrentPointer(value: unknown): CurrentPointer {
  const pointer = recordOf(value, '需求 Wiki 当前指针')
  if (pointer.schemaVersion !== 1) throw new Error('需求 Wiki 当前指针版本无效。')
  const buildId = textOf(pointer.buildId, '需求 Wiki 当前指针 buildId', 100)
  if (!/^wiki_[a-f0-9]{32}$/u.test(buildId)) throw new Error('需求 Wiki 当前指针 buildId 无效。')
  return { schemaVersion: 1, revision: integerOf(pointer.revision, '需求 Wiki 当前 revision', 1), buildId }
}

async function readCurrentPointer(root: string): Promise<CurrentPointer | null> {
  try { return parseCurrentPointer(await readBoundedJson(join(wikiRoot(root), CURRENT_FILE))) } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

function parseBuild(value: unknown): RequirementWikiBuild {
  const build = recordOf(value, '需求 Wiki 构建')
  if (build.schemaVersion !== 1) throw new Error('需求 Wiki 构建版本无效。')
  const id = textOf(build.id, '需求 Wiki BuildId', 100)
  if (!/^wiki_[a-f0-9]{32}$/u.test(id)) throw new Error('需求 Wiki BuildId 无效。')
  const statusValue = textOf(build.status, '需求 Wiki 构建状态', 20)
  if (!['queued', 'running', 'succeeded', 'failed', 'cancelled'].includes(statusValue)) throw new Error('需求 Wiki 构建状态无效。')
  const fingerprint = textOf(build.sourceCatalogFingerprint, '需求 Wiki 来源指纹', 64)
  if (!SAFE_FINGERPRINT.test(fingerprint)) throw new Error('需求 Wiki 来源指纹无效。')
  const message = optionalText(build.message, '需求 Wiki 构建说明', 1_000)
  const publishedRevision = build.publishedRevision === undefined
    ? undefined
    : integerOf(build.publishedRevision, '需求 Wiki 已发布 revision', 1)
  return {
    schemaVersion: 1,
    id,
    status: statusValue as RequirementWikiBuild['status'],
    expectedRevision: integerOf(build.expectedRevision, '需求 Wiki expectedRevision', 0),
    sourceCatalogFingerprint: fingerprint,
    sources: parseSources(build.sources, '需求 Wiki 构建来源'),
    createdAt: textOf(build.createdAt, '需求 Wiki 构建创建时间', 80),
    updatedAt: textOf(build.updatedAt, '需求 Wiki 构建更新时间', 80),
    ...(message === undefined ? {} : { message }),
    ...(publishedRevision === undefined ? {} : { publishedRevision }),
  }
}

async function readBuild(root: string): Promise<RequirementWikiBuild | null> {
  try { return parseBuild(await readBoundedJson(join(wikiRoot(root), BUILD_FILE))) } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

async function writeBuild(root: string, build: RequirementWikiBuild): Promise<void> {
  await writeFileAtomic(join(wikiRoot(root), BUILD_FILE), `${JSON.stringify(build, null, 2)}\n`, { mode: 0o600, dirMode: 0o700 })
}

function parseManifestSourceFingerprint(value: unknown): string {
  const fingerprint = textOf(value, '需求 Wiki 来源指纹', 64)
  if (!SAFE_FINGERPRINT.test(fingerprint)) throw new Error('需求 Wiki 来源指纹无效。')
  return fingerprint
}

async function readWikiVersion(root: string, pointer: CurrentPointer): Promise<RequirementWikiVersion> {
  const versionRoot = join(wikiRoot(root), VERSIONS_DIRECTORY, revisionName(pointer.revision))
  assertInside(wikiRoot(root), versionRoot)
  const manifestValue = recordOf(await readBoundedJson(join(versionRoot, 'manifest.json')), '需求 Wiki 版本')
  if (manifestValue.schemaVersion !== 1) throw new Error('需求 Wiki 版本 schemaVersion 无效。')
  const revision = integerOf(manifestValue.revision, '需求 Wiki revision', 1)
  if (revision !== pointer.revision) throw new Error('需求 Wiki 当前指针与版本不一致。')
  const buildId = textOf(manifestValue.buildId, '需求 Wiki buildId', 100)
  if (buildId !== pointer.buildId) throw new Error('需求 Wiki 当前指针与构建身份不一致。')
  const sources = parseSources(manifestValue.sources, '需求 Wiki 来源')
  const rawPages = manifestValue.pages
  if (!Array.isArray(rawPages) || rawPages.length === 0 || rawPages.length > MAX_PAGES) throw new Error('需求 Wiki 页面索引无效。')
  const pages: unknown[] = []
  for (let index = 0; index < rawPages.length; index += 1) {
    const page = recordOf(rawPages[index], `pages[${String(index)}]`)
    const id = idOf(page.id, `pages[${String(index)}].id`)
    const bodyPath = textOf(page.bodyPath, `pages[${String(index)}].bodyPath`, 180)
    if (bodyPath !== `pages/${id}.md`) throw new Error(`知识页正文路径与 ID 不一致：${id}`)
    const bodyFile = join(versionRoot, bodyPath)
    assertInside(versionRoot, bodyFile)
    const info = await lstat(bodyFile)
    if (info.isSymbolicLink() || !info.isFile() || info.size > MAX_PAGE_BODY * 4) throw new Error(`知识页正文不可用：${id}`)
    const { bodyPath: _bodyPath, ...metadata } = page
    pages.push({ ...metadata, body: await readFile(bodyFile, 'utf8') })
  }
  const parsed = parseRequirementWikiCandidate({
    pages,
    relations: manifestValue.relations,
    conflicts: manifestValue.conflicts,
    unknowns: manifestValue.unknowns,
  }, sources.map(source => source.sourceId))
  return {
    schemaVersion: 1,
    revision,
    buildId,
    generatedAt: textOf(manifestValue.generatedAt, '需求 Wiki 生成时间', 80),
    generatedBy: textOf(manifestValue.generatedBy, '需求 Wiki 生成主体', 160),
    sourceCatalogFingerprint: parseManifestSourceFingerprint(manifestValue.sourceCatalogFingerprint),
    sources,
    ...parsed,
  }
}

/**
 * Read the current complete Wiki revision, returning null only when absent.
 * @param root - Canonical project Workspace path.
 * @returns The revision named by the atomic current pointer, or null when no pointer exists.
 * @throws When the pointer, manifest, or page files are present but invalid.
 */
export async function readCurrentRequirementWiki(root: string): Promise<RequirementWikiVersion | null> {
  const pointer = await readCurrentPointer(root)
  return pointer === null ? null : await readWikiVersion(root, pointer)
}

/**
 * Read the current requirement Wiki, latest build, and source-currency state without calling a model.
 * @param root - Canonical project Workspace path.
 * @returns A read model that retains a valid current revision while reporting stale or damaged state.
 */
export async function loadRequirementWikiSnapshot(root: string): Promise<RequirementWikiSnapshot> {
  let current: RequirementWikiVersion | null = null
  let build: RequirementWikiBuild | null = null
  const messages: string[] = []
  try { current = await readCurrentRequirementWiki(root) } catch (error) {
    messages.push(error instanceof Error ? error.message : String(error))
  }
  try { build = await readBuild(root) } catch (error) {
    messages.push(error instanceof Error ? error.message : String(error))
  }
  if (current !== null && build !== null && build.id === current.buildId && build.status !== 'succeeded') {
    build = { ...build, status: 'succeeded', publishedRevision: current.revision, updatedAt: current.generatedAt }
  }
  if (current === null) {
    return {
      status: 'absent',
      current: null,
      build,
      message: messages[0] ?? '尚未整理需求知识。',
    }
  }
  try {
    const records = await listProjectSources(root)
    const stale = catalogFingerprint(records) !== current.sourceCatalogFingerprint
    return {
      status: stale ? 'stale' : 'ready',
      current,
      build,
      ...(messages.length === 0 ? {} : { message: messages.join('；') }),
    }
  } catch (error) {
    return {
      status: 'stale',
      current,
      build,
      message: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Start one explicit Wiki build against an exact current revision and fixed Source snapshot.
 * @param root - Canonical project Workspace path.
 * @param sourceIds - User-confirmed SourceIds to freeze into the build.
 * @param expectedRevision - Current revision, or zero when no Wiki exists.
 * @returns The durable queued build with verified Source metadata.
 * @throws When the revision, Sources, derivative files, or active-build state no longer match.
 */
export async function startRequirementWikiBuild(
  root: string,
  sourceIds: readonly string[],
  expectedRevision: number,
): Promise<RequirementWikiBuild> {
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) throw new Error('expectedRevision 必须是非负整数。')
  await mkdir(wikiRoot(root), { recursive: true, mode: 0o700 })
  return await withFileLock(stateLockPath(root), async () => {
    const pointer = await readCurrentPointer(root)
    const currentRevision = pointer?.revision ?? 0
    if (currentRevision !== expectedRevision) {
      throw new Error(`需求 Wiki 版本冲突：当前为 R${String(currentRevision)}，请求基于 R${String(expectedRevision)}。`)
    }
    const existing = await readBuild(root)
    const active = existing !== null && (existing.status === 'queued' || existing.status === 'running')
      && existing.id !== pointer?.buildId
    if (active) throw new Error('当前项目已有需求整理任务，请等待完成或结束本次整理。')
    const snapshot = await sourceSnapshot(root, sourceIds)
    const now = new Date().toISOString()
    const build: RequirementWikiBuild = {
      schemaVersion: 1,
      id: `wiki_${randomUUID().replaceAll('-', '')}`,
      status: 'queued',
      expectedRevision,
      sourceCatalogFingerprint: snapshot.fingerprint,
      sources: snapshot.sources,
      createdAt: now,
      updatedAt: now,
    }
    await writeBuild(root, build)
    return build
  })
}

/**
 * Mark an explicit active build as running when its Agent starts reading it.
 * @param root - Canonical project Workspace path.
 * @param buildId - Exact active BuildId supplied to the Agent.
 * @returns The durable running build, or the unchanged succeeded/running build.
 * @throws When the build is absent, replaced, failed, or cancelled.
 */
export async function markRequirementWikiBuildRunning(root: string, buildId: string): Promise<RequirementWikiBuild> {
  await mkdir(wikiRoot(root), { recursive: true, mode: 0o700 })
  return await withFileLock(stateLockPath(root), async () => {
    const build = await readBuild(root)
    if (build === null || build.id !== buildId) throw new Error('需求 Wiki 构建不存在或已被替代。')
    if (build.status === 'failed') throw new Error('需求 Wiki 构建已经失败。')
    if (build.status === 'cancelled') throw new Error('需求 Wiki 构建已经结束。')
    if (build.status === 'succeeded') return build
    if (build.status === 'running') return build
    const running: RequirementWikiBuild = { ...build, status: 'running', updatedAt: new Date().toISOString() }
    await writeBuild(root, running)
    return running
  })
}

/**
 * Cancel one queued/running build without changing the current Wiki revision.
 * @param root - Canonical project Workspace path.
 * @param buildId - Exact active BuildId to cancel.
 * @param message - Durable user-facing cancellation reason.
 * @returns The durable cancelled build, or an already terminal succeeded/failed build.
 * @throws When the build is absent or has been replaced.
 */
export async function abandonRequirementWikiBuild(
  root: string,
  buildId: string,
  message = '用户已结束本次整理。',
): Promise<RequirementWikiBuild> {
  await mkdir(wikiRoot(root), { recursive: true, mode: 0o700 })
  return await withFileLock(stateLockPath(root), async () => {
    const build = await readBuild(root)
    if (build === null || build.id !== buildId) throw new Error('需求 Wiki 构建不存在或已被替代。')
    if (build.status === 'succeeded' || build.status === 'failed') return build
    const cancelled: RequirementWikiBuild = {
      ...build,
      status: 'cancelled',
      updatedAt: new Date().toISOString(),
      message: textOf(message, '需求 Wiki 结束说明', 1_000),
    }
    await writeBuild(root, cancelled)
    return cancelled
  })
}

async function writeVersion(
  root: string,
  version: RequirementWikiVersion,
): Promise<string> {
  const versionsRoot = join(wikiRoot(root), VERSIONS_DIRECTORY)
  await mkdir(versionsRoot, { recursive: true, mode: 0o700 })
  const finalRoot = join(versionsRoot, revisionName(version.revision))
  const temporaryRoot = join(versionsRoot, `.tmp-${randomUUID()}`)
  assertInside(versionsRoot, finalRoot)
  assertInside(versionsRoot, temporaryRoot)
  const pagesRoot = join(temporaryRoot, 'pages')
  try {
    await mkdir(pagesRoot, { recursive: true, mode: 0o700 })
    const manifestPages: ManifestPage[] = []
    for (const page of version.pages) {
      const bodyPath = `pages/${page.id}.md`
      await writeFile(join(temporaryRoot, bodyPath), `${page.body.trim()}\n`, { encoding: 'utf8', flag: 'wx', mode: 0o600 })
      const { body: _body, ...metadata } = page
      manifestPages.push({ ...metadata, bodyPath })
    }
    const manifest: RequirementWikiManifest = { ...version, pages: manifestPages }
    await writeFile(join(temporaryRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { encoding: 'utf8', flag: 'wx', mode: 0o600 })
    await rename(temporaryRoot, finalRoot)
    return finalRoot
  } catch (error) {
    await rm(temporaryRoot, { recursive: true, force: true })
    throw error
  }
}

function failureMessage(error: unknown): string {
  const message = (error instanceof Error ? error.message : String(error)).trim()
  return (message === '' ? '需求 Wiki 发布失败。' : message).slice(0, 1_000)
}

/**
 * Atomically publish one complete candidate for the exact active build.
 * @param root - Canonical project Workspace path.
 * @param buildId - Exact queued or running BuildId.
 * @param expectedRevision - Revision returned for that build by `requirement_wiki_get`.
 * @param value - Untrusted complete candidate submitted by the Agent.
 * @param generatedBy - Session identity recorded with the immutable revision.
 * @returns The new current revision after its directory and pointer are durable.
 * @throws When the build, revision, frozen Sources, or candidate validation fails; the prior current revision remains unchanged.
 */
export async function publishRequirementWiki(
  root: string,
  buildId: string,
  expectedRevision: number,
  value: unknown,
  generatedBy: string,
): Promise<RequirementWikiVersion> {
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) throw new Error('expectedRevision 必须是非负整数。')
  await mkdir(wikiRoot(root), { recursive: true, mode: 0o700 })
  return await withFileLock(stateLockPath(root), async () => {
    const build = await readBuild(root)
    if (build === null || build.id !== buildId) throw new Error('需求 Wiki 构建不存在或已被替代。')
    if (build.status !== 'queued' && build.status !== 'running') throw new Error('需求 Wiki 构建已经结束，不能再次发布。')
    let unpublishedRoot: string | undefined
    try {
      if (build.expectedRevision !== expectedRevision) throw new Error('需求 Wiki 构建的 expectedRevision 不一致。')
      const pointer = await readCurrentPointer(root)
      const currentRevision = pointer?.revision ?? 0
      if (currentRevision !== expectedRevision) {
        throw new Error(`需求 Wiki 版本冲突：当前为 R${String(currentRevision)}，请求基于 R${String(expectedRevision)}。`)
      }
      const selectedIds = build.sources.map(source => source.sourceId)
      let currentSources: Awaited<ReturnType<typeof sourceSnapshot>>
      try {
        currentSources = await sourceSnapshot(root, selectedIds)
      } catch (error) {
        throw new Error('项目资料在整理期间已经变化，请重新选择资料并更新需求知识。', { cause: error })
      }
      if (currentSources.fingerprint !== build.sourceCatalogFingerprint
        || JSON.stringify(currentSources.sources) !== JSON.stringify(build.sources)) {
        throw new Error('项目资料在整理期间已经变化，请重新选择资料并更新需求知识。')
      }
      const parsed = parseRequirementWikiCandidate(value, selectedIds)
      const version: RequirementWikiVersion = {
        schemaVersion: 1,
        revision: currentRevision + 1,
        buildId,
        generatedAt: new Date().toISOString(),
        generatedBy: textOf(generatedBy, '需求 Wiki 生成主体', 160),
        sourceCatalogFingerprint: build.sourceCatalogFingerprint,
        sources: build.sources,
        ...parsed,
      }
      unpublishedRoot = await writeVersion(root, version)
      const pointerNext: CurrentPointer = { schemaVersion: 1, revision: version.revision, buildId }
      await writeFileAtomic(join(wikiRoot(root), CURRENT_FILE), `${JSON.stringify(pointerNext, null, 2)}\n`, { mode: 0o600, dirMode: 0o700 })
      unpublishedRoot = undefined
      const succeeded: RequirementWikiBuild = {
        ...build,
        status: 'succeeded',
        publishedRevision: version.revision,
        updatedAt: version.generatedAt,
        message: `已发布候选需求 Wiki R${String(version.revision)}。`,
      }
      await writeBuild(root, succeeded).catch(() => undefined)
      return version
    } catch (error) {
      if (unpublishedRoot !== undefined) await rm(unpublishedRoot, { recursive: true, force: true }).catch(() => undefined)
      const failed: RequirementWikiBuild = {
        ...build,
        status: 'failed',
        updatedAt: new Date().toISOString(),
        message: failureMessage(error),
      }
      await writeBuild(root, failed).catch(() => undefined)
      throw error
    }
  })
}

/** Stable project-relative paths owned by the requirement-Wiki subsystem. */
export const requirementWikiPaths = {
  root: WIKI_DIRECTORY,
  current: `${WIKI_DIRECTORY}/${CURRENT_FILE}`,
  build: `${WIKI_DIRECTORY}/${BUILD_FILE}`,
  versions: `${WIKI_DIRECTORY}/${VERSIONS_DIRECTORY}`,
} as const
