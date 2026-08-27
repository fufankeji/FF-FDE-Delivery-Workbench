/** Filesystem-backed project read models for API docs, architecture, and eval reports. */

import { mkdir, readdir, readFile, stat } from 'node:fs/promises'
import { basename, join, relative, resolve, sep } from 'node:path'
import { withFileLock, writeFileAtomic } from '@deepseek-ai/dsh-atomic-write'
import type {
  ApiDocsSnapshot,
  ArchitectureEdge,
  ArchitectureGroup,
  ArchitectureNode,
  EvaluationCaseSummary,
  EvaluationReportSummary,
  EvaluationSnapshot,
  ProjectArchitecture,
  ProjectOpenApiConfig,
  ProjectRuntimeSnapshot,
  ProjectSurfaceSnapshot,
} from './types.ts'
import { ARCHITECTURE_NODE_KINDS, ARCHITECTURE_STATUSES } from './types.ts'
import { loadRequirementArtifacts, REQUIREMENT_ARTIFACT_ROOT } from './requirement-artifacts.ts'
import { loadSolutionArtifacts, SOLUTION_ARTIFACT_ROOT } from './solution-artifacts.ts'
import { DEVELOPMENT_DOCS_ROOT, loadDevelopmentDocs } from './development-docs.ts'
import { loadRequirementWikiSnapshot, requirementWikiPaths } from './requirement-wiki.ts'
import { loadProjectRuntimeSnapshot, PROJECT_RUNTIME_PATH } from './project-runtime.ts'
import { loadValidationStage, VALIDATION_CONTRACT_PATH } from './validation.ts'
import {
  ACCEPTANCE_HANDOVER_CONTRACT_PATH,
  DEPLOYMENT_TRIAL_CONTRACT_PATH,
  loadAcceptanceHandoverStage,
  loadDeploymentTrialStage,
} from './delivery-closeout.ts'

const FDE_DIRECTORY = '.fde'
const API_DOCS_FILE = 'api-docs.json'
const ARCHITECTURE_FILE = 'architecture.json'
const EVALUATION_DIRECTORY = 'evaluations'
const MAX_JSON_BYTES = 2 * 1024 * 1024
const HTTP_METHODS = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'])

function displayValue(value: unknown): string {
  if (typeof value === 'string') return value
  const encoded: unknown = JSON.stringify(value)
  return typeof encoded === 'string' ? encoded : typeof value
}

function allowedMethodsOf(value: unknown): string[] {
  const methods = value ?? ['GET', 'HEAD']
  if (!Array.isArray(methods) || !methods.every((method): method is string => typeof method === 'string')) {
    throw new Error('allowedMethods 必须是请求方法数组。')
  }
  const allowed = methods.map(method => method.toUpperCase())
  if (allowed.some(method => !HTTP_METHODS.has(method))) throw new Error('allowedMethods 包含不支持的方法。')
  return allowed
}

function recordOf(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} 必须是对象。`)
  }
  return value as Record<string, unknown>
}

function textOf(value: unknown, label: string, max = 240): string {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${label} 必须是非空文字。`)
  const text = value.trim()
  if (text.length > max) throw new Error(`${label} 不能超过 ${String(max)} 个字符。`)
  return text
}

function optionalText(value: unknown, label: string, max = 600): string | undefined {
  if (value === undefined || value === null || value === '') return undefined
  return textOf(value, label, max)
}

async function readJson(path: string): Promise<unknown> {
  const info = await stat(path)
  if (!info.isFile() || info.size > MAX_JSON_BYTES) throw new Error('文件不是受支持的 JSON，或超过 2 MiB。')
  return JSON.parse(await readFile(path, 'utf8')) as unknown
}

function trustedUrl(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null || value === '') return undefined
  const text = textOf(value, label, 2_000)
  const url = new URL(text)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error(`${label} 只支持 HTTP(S)。`)
  url.username = ''
  url.password = ''
  return url.toString()
}

function projectRelative(root: string, candidate: string): string {
  const resolved = resolve(candidate)
  const rel = relative(resolve(root), resolved)
  if (rel === '' || rel === '..' || rel.startsWith(`..${sep}`) || rel.startsWith('../')) {
    throw new Error('项目文件越过项目目录。')
  }
  return rel.split(sep).join('/')
}

function parseApiDocs(value: unknown, root: string): ApiDocsSnapshot {
  const record = recordOf(value, 'API 文档配置')
  const docsUrl = trustedUrl(record.docsUrl, 'docsUrl')
  const baseUrl = trustedUrl(record.baseUrl, 'baseUrl')
  const rawSource = optionalText(record.openapiSource, 'openapiSource', 2_000)
  const openapiSource = rawSource === undefined
    ? undefined
    : /^https?:\/\//.test(rawSource)
      ? trustedUrl(rawSource, 'openapiSource')
      : projectRelative(root, resolve(root, rawSource))
  const allowedMethods = allowedMethodsOf(record.allowedMethods)
  const allowPrivateNetwork = record.allowPrivateNetwork ?? false
  if (typeof allowPrivateNetwork !== 'boolean') throw new Error('allowPrivateNetwork 必须是布尔值。')
  if (docsUrl === undefined && openapiSource === undefined) throw new Error('至少需要 docsUrl 或 openapiSource。')
  return {
    status: 'configured',
    ...(docsUrl === undefined ? {} : { docsUrl }),
    ...(openapiSource === undefined ? {} : { openapiSource }),
    ...(baseUrl === undefined ? {} : { baseUrl }),
    allowedMethods,
    allowPrivateNetwork,
  }
}

async function loadApiDocs(root: string, runtime: ProjectRuntimeSnapshot): Promise<ApiDocsSnapshot> {
  try {
    return parseApiDocs(await readJson(join(root, FDE_DIRECTORY, API_DOCS_FILE)), root)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      return { status: 'invalid', message: error instanceof Error ? error.message : String(error) }
    }
  }
  if (runtime.status === 'running' && runtime.openapiSource !== undefined) {
    try {
      return parseApiDocs({
        openapiSource: runtime.openapiSource,
        ...(runtime.docsUrl === undefined ? {} : { docsUrl: runtime.docsUrl }),
        ...(runtime.baseUrl === undefined ? {} : { baseUrl: runtime.baseUrl }),
      }, root)
    } catch (error) {
      return { status: 'invalid', message: error instanceof Error ? error.message : String(error) }
    }
  }
  for (const candidate of [
    'openapi.json', 'openapi.yaml', 'openapi.yml',
    'docs/openapi.json', 'docs/openapi.yaml', 'docs/openapi.yml',
    'backend/openapi.json', 'backend/openapi.yaml', 'backend/openapi.yml',
  ]) {
    try {
      const info = await stat(join(root, candidate))
      if (info.isFile()) return { status: 'configured', openapiSource: candidate, allowedMethods: ['GET', 'HEAD'], allowPrivateNetwork: false }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        return { status: 'invalid', message: error instanceof Error ? error.message : String(error) }
      }
    }
  }
  return { status: 'unconfigured', message: '尚未配置 API 文档。' }
}

function stringMapOf(value: unknown, label: string): Record<string, string> {
  if (value === undefined) return {}
  const record = recordOf(value, label)
  const result: Record<string, string> = {}
  for (const [key, entry] of Object.entries(record)) {
    if (key.trim() === '' || typeof entry !== 'string') throw new Error(`${label} 必须是文字键值。`)
    result[key] = entry
  }
  return result
}

function credentialsOf(value: unknown): ProjectOpenApiConfig['credentials'] {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > 20) throw new Error('credentials 必须是最多 20 项的数组。')
  return value.map((raw, index) => {
    const item = recordOf(raw, `credentials[${String(index)}]`)
    const header = textOf(item.header, `credentials[${String(index)}].header`, 120)
    const env = textOf(item.env, `credentials[${String(index)}].env`, 120)
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(env)) throw new Error(`credentials[${String(index)}].env 无效。`)
    return { header, env, prefix: optionalText(item.prefix, `credentials[${String(index)}].prefix`, 120) ?? '' }
  })
}

function openApiConfigOf(value: unknown, root: string): ProjectOpenApiConfig | null {
  const record = recordOf(value, 'API 文档配置')
  const rawSource = optionalText(record.openapiSource, 'openapiSource', 2_000)
  if (rawSource === undefined) return null
  const trustedSource = /^https?:\/\//i.test(rawSource) ? trustedUrl(rawSource, 'openapiSource') : undefined
  const source = trustedSource ?? resolve(root, projectRelative(root, resolve(root, rawSource)))
  const baseUrl = trustedUrl(record.baseUrl, 'baseUrl')
  const allowedMethods = allowedMethodsOf(record.allowedMethods)
  const allowPrivateNetwork = record.allowPrivateNetwork ?? false
  if (typeof allowPrivateNetwork !== 'boolean') throw new Error('allowPrivateNetwork 必须是布尔值。')
  return {
    id: 'project', source,
    ...(baseUrl === undefined ? {} : { baseUrl }),
    headers: stringMapOf(record.headers, 'headers'),
    credentials: credentialsOf(record.credentials),
    allowedMethods,
    allowPrivateNetwork,
  }
}

/**
 * Resolve the current Workspace's OpenAPI configuration for model tools.
 * @param root - canonical Workspace path.
 * @returns explicit or discovered configuration, or null when absent.
 */
export async function loadProjectOpenApiConfig(root: string): Promise<ProjectOpenApiConfig | null> {
  try {
    return openApiConfigOf(await readJson(join(root, FDE_DIRECTORY, API_DOCS_FILE)), root)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  const runtime = await loadProjectRuntimeSnapshot(root)
  if (runtime.status === 'running' && runtime.openapiSource !== undefined) {
    return openApiConfigOf({
      openapiSource: runtime.openapiSource,
      ...(runtime.baseUrl === undefined ? {} : { baseUrl: runtime.baseUrl }),
    }, root)
  }
  for (const candidate of [
    'openapi.json', 'openapi.yaml', 'openapi.yml',
    'docs/openapi.json', 'docs/openapi.yaml', 'docs/openapi.yml',
    'backend/openapi.json', 'backend/openapi.yaml', 'backend/openapi.yml',
  ]) {
    try {
      const path = join(root, candidate)
      const info = await stat(path)
      if (info.isFile()) return {
        id: 'project', source: path, headers: {}, credentials: [],
        allowedMethods: ['GET', 'HEAD'], allowPrivateNetwork: false,
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }
  return null
}

/**
 * Validate and normalize one durable project architecture document.
 * @param value - untrusted durable JSON value.
 * @returns the normalized bounded architecture.
 */
export function parseProjectArchitecture(value: unknown): ProjectArchitecture {
  const record = recordOf(value, '系统架构')
  if (record.version !== undefined && record.version !== 1) throw new Error('系统架构 version 必须是 1。')
  const rawGroups = record.groups ?? []
  const rawNodes = record.nodes ?? []
  const rawEdges = record.edges ?? []
  if (!Array.isArray(rawGroups) || rawGroups.length > 12) throw new Error('系统架构分组无效或超过 12 个。')
  if (!Array.isArray(rawNodes) || rawNodes.length > 80) throw new Error('系统架构节点无效或超过 80 个。')
  if (!Array.isArray(rawEdges) || rawEdges.length > 200) throw new Error('系统架构关系无效或超过 200 条。')

  const groupIds = new Set<string>()
  const groups: ArchitectureGroup[] = rawGroups.map((raw, index) => {
    const group = recordOf(raw, `groups[${String(index)}]`)
    const id = textOf(group.id, `groups[${String(index)}].id`, 60)
    if (groupIds.has(id)) throw new Error(`架构分组 ID 重复：${id}`)
    groupIds.add(id)
    return { id, label: textOf(group.label, `groups[${String(index)}].label`) }
  })

  const nodeIds = new Set<string>()
  const nodes: ArchitectureNode[] = rawNodes.map((raw, index) => {
    const node = recordOf(raw, `nodes[${String(index)}]`)
    const id = textOf(node.id, `nodes[${String(index)}].id`, 60)
    if (nodeIds.has(id)) throw new Error(`架构节点 ID 重复：${id}`)
    nodeIds.add(id)
    const kind = node.kind ?? 'default'
    if (typeof kind !== 'string' || !(ARCHITECTURE_NODE_KINDS as readonly string[]).includes(kind)) {
      throw new Error(`架构节点类型无效：${displayValue(kind)}`)
    }
    const group = optionalText(node.group, `nodes[${String(index)}].group`, 60)
    if (group !== undefined && !groupIds.has(group)) throw new Error(`架构节点引用未知分组：${group}`)
    const note = optionalText(node.note, `nodes[${String(index)}].note`, 240)
    return {
      id,
      label: textOf(node.label, `nodes[${String(index)}].label`),
      kind: kind as ArchitectureNode['kind'],
      ...(group === undefined ? {} : { group }),
      ...(note === undefined ? {} : { note }),
    }
  })

  const edgeKeys = new Set<string>()
  const edges: ArchitectureEdge[] = rawEdges.map((raw, index) => {
    const edge = recordOf(raw, `edges[${String(index)}]`)
    const from = textOf(edge.from, `edges[${String(index)}].from`, 60)
    const to = textOf(edge.to, `edges[${String(index)}].to`, 60)
    if (!nodeIds.has(from) || !nodeIds.has(to) || from === to) throw new Error(`架构关系引用无效：${from} → ${to}`)
    const label = optionalText(edge.label, `edges[${String(index)}].label`, 120)
    if (edge.dashed !== undefined && typeof edge.dashed !== 'boolean') throw new Error(`edges[${String(index)}].dashed 必须是布尔值。`)
    const key = `${from}\0${to}\0${label ?? ''}`
    if (edgeKeys.has(key)) throw new Error(`架构关系重复：${from} → ${to}`)
    edgeKeys.add(key)
    return { from, to, ...(label === undefined ? {} : { label }), ...(edge.dashed === true ? { dashed: true } : {}) }
  })

  const status = record.status ?? 'candidate'
  if (typeof status !== 'string' || !(ARCHITECTURE_STATUSES as readonly string[]).includes(status)) {
    throw new Error(`系统架构状态无效：${displayValue(status)}`)
  }
  const revision = record.revision ?? 1
  if (!Number.isSafeInteger(revision) || Number(revision) < 1) throw new Error('系统架构 revision 无效。')
  const updatedAt = record.updatedAt === undefined ? new Date(0).toISOString() : textOf(record.updatedAt, 'updatedAt', 80)
  const summary = optionalText(record.summary, 'summary', 1_000)
  return {
    version: 1,
    revision: Number(revision),
    title: textOf(record.title, 'title'),
    ...(summary === undefined ? {} : { summary }),
    status: status as ProjectArchitecture['status'],
    updatedAt,
    groups,
    nodes,
    edges,
  }
}

async function loadArchitecture(root: string): Promise<{ value: ProjectArchitecture | null; error?: string }> {
  try {
    return { value: parseProjectArchitecture(await readJson(join(root, FDE_DIRECTORY, ARCHITECTURE_FILE))) }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { value: null }
    return { value: null, error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * Read the current valid project architecture, returning null only when absent.
 * @param root - canonical Workspace path.
 * @returns the current architecture or null when no file exists.
 */
export async function readProjectArchitecture(root: string): Promise<ProjectArchitecture | null> {
  try {
    return parseProjectArchitecture(await readJson(join(root, FDE_DIRECTORY, ARCHITECTURE_FILE)))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

async function commitArchitecture(root: string, architecture: ProjectArchitecture): Promise<void> {
  await writeFileAtomic(join(root, FDE_DIRECTORY, ARCHITECTURE_FILE), `${JSON.stringify(architecture, null, 2)}\n`, {
    mode: 0o600,
    dirMode: 0o700,
  })
}

async function archiveArchitecture(root: string, architecture: ProjectArchitecture): Promise<void> {
  const path = join(root, FDE_DIRECTORY, 'architecture-history', `R${String(architecture.revision)}.json`)
  await writeFileAtomic(path, `${JSON.stringify(architecture, null, 2)}\n`, { mode: 0o600, dirMode: 0o700 })
}

/**
 * Atomically publish a complete Agent-authored candidate against an exact revision.
 * @param root - canonical Workspace path.
 * @param value - complete untrusted candidate document.
 * @param expectedRevision - exact current revision, or zero when absent.
 * @returns the committed next candidate.
 */
export async function replaceProjectArchitecture(root: string, value: unknown, expectedRevision: number): Promise<ProjectArchitecture> {
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) throw new Error('expectedRevision 必须是非负整数。')
  const path = join(root, FDE_DIRECTORY, ARCHITECTURE_FILE)
  await mkdir(join(root, FDE_DIRECTORY), { recursive: true, mode: 0o700 })
  return await withFileLock(path, async () => {
    const current = await readProjectArchitecture(root)
    const currentRevision = current?.revision ?? 0
    if (currentRevision !== expectedRevision) {
      throw new Error(`系统架构版本冲突：当前为 R${String(currentRevision)}，请求基于 R${String(expectedRevision)}。`)
    }
    const input = recordOf(value, '系统架构候选')
    const next = parseProjectArchitecture({
      ...input,
      version: 1,
      revision: currentRevision + 1,
      status: 'candidate',
      updatedAt: new Date().toISOString(),
    })
    if (current !== null) await archiveArchitecture(root, current)
    await commitArchitecture(root, next)
    return next
  })
}

/**
 * Atomically confirm the exact displayed candidate without changing its content revision.
 * @param root - canonical Workspace path.
 * @param expectedRevision - exact displayed candidate revision.
 * @returns the confirmed architecture.
 */
export async function confirmProjectArchitecture(root: string, expectedRevision: number): Promise<ProjectArchitecture> {
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1) throw new Error('revision 必须是正整数。')
  const path = join(root, FDE_DIRECTORY, ARCHITECTURE_FILE)
  await mkdir(join(root, FDE_DIRECTORY), { recursive: true, mode: 0o700 })
  return await withFileLock(path, async () => {
    const current = await readProjectArchitecture(root)
    if (current === null) throw new Error('当前项目尚无可确认的系统架构。')
    if (current.revision !== expectedRevision) {
      throw new Error(`系统架构版本冲突：当前为 R${String(current.revision)}，请求确认 R${String(expectedRevision)}。`)
    }
    if (current.status === 'confirmed') return current
    const confirmed = parseProjectArchitecture({ ...current, status: 'confirmed', updatedAt: new Date().toISOString() })
    await commitArchitecture(root, confirmed)
    return confirmed
  })
}

function normalizeStatus(value: unknown, cases: readonly EvaluationCaseSummary[]): EvaluationReportSummary['status'] {
  const upper = typeof value === 'string' ? value.toUpperCase() : ''
  if (upper === 'PASS' || upper === 'WARN' || upper === 'FAIL' || upper === 'N/A') return upper
  if (cases.some(item => item.status === 'error' || item.status === 'fail')) return 'FAIL'
  if (cases.length > 0 && cases.every(item => item.status === 'pass')) return 'PASS'
  return 'UNKNOWN'
}

async function parseEvaluationReport(root: string, path: string): Promise<EvaluationReportSummary> {
  const raw = recordOf(await readJson(path), '评估报告')
  const rawCases = Array.isArray(raw.cases) ? raw.cases : []
  const cases: EvaluationCaseSummary[] = rawCases.slice(0, 200).map((entry, index) => {
    const item = recordOf(entry, `cases[${String(index)}]`)
    const failures = Array.isArray(item.failures)
      ? item.failures.filter((failure): failure is string => typeof failure === 'string').slice(0, 20)
      : []
    return {
      name: typeof item.name === 'string' ? item.name : `case-${String(index + 1)}`,
      status: typeof item.status === 'string' ? item.status : 'unknown',
      failures,
      ...(typeof item.error === 'string' && item.error !== '' ? { error: item.error.slice(0, 1_000) } : {}),
    }
  })
  const summary = raw.summary !== null && typeof raw.summary === 'object' && !Array.isArray(raw.summary)
    ? raw.summary as Record<string, unknown>
    : {}
  const passedValue = summary.passed ?? summary.pass
  const failedValue = summary.failed ?? summary.fail
  const errorValue = summary.errored ?? summary.error
  const passed = Number.isSafeInteger(passedValue) ? Number(passedValue) : cases.filter(item => item.status === 'pass').length
  const failed = Number.isSafeInteger(failedValue) ? Number(failedValue) : cases.filter(item => item.status === 'fail').length
  const errors = Number.isSafeInteger(errorValue) ? Number(errorValue) : cases.filter(item => item.status === 'error').length
  const info = await stat(path)
  const rel = projectRelative(root, path)
  return {
    id: basename(resolve(path, '..')) || basename(path),
    path: rel,
    updatedAt: info.mtime.toISOString(),
    status: normalizeStatus(raw.overall ?? raw.verdict ?? summary.overall, cases),
    passed,
    failed,
    errors,
    total: cases.length || passed + failed + errors,
    cases,
  }
}

async function listReportFiles(root: string): Promise<string[]> {
  const reportsRoot = join(root, FDE_DIRECTORY, EVALUATION_DIRECTORY, 'reports')
  let entries
  try {
    entries = await readdir(reportsRoot, { withFileTypes: true })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
  const paths: string[] = []
  for (const entry of entries) {
    const candidate = entry.isDirectory() ? join(reportsRoot, entry.name, 'report.json') : join(reportsRoot, entry.name)
    if ((entry.isDirectory() || entry.name === 'report.json' || entry.name.endsWith('.report.json'))) paths.push(candidate)
  }
  return paths
}

async function countCases(root: string): Promise<number> {
  try {
    const entries = await readdir(join(root, FDE_DIRECTORY, EVALUATION_DIRECTORY, 'cases'), { withFileTypes: true })
    return entries.filter(entry => entry.isFile() && /\.ya?ml$/i.test(entry.name)).length
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 0
    throw error
  }
}

async function loadEvaluation(root: string): Promise<EvaluationSnapshot> {
  const casesCount = await countCases(root)
  const reports: EvaluationReportSummary[] = []
  for (const path of await listReportFiles(root)) {
    try { reports.push(await parseEvaluationReport(root, path)) } catch { /* malformed reports stay absent */ }
  }
  reports.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  let baseline: EvaluationReportSummary | undefined
  try {
    baseline = await parseEvaluationReport(root, join(root, FDE_DIRECTORY, EVALUATION_DIRECTORY, 'baseline', 'report.json'))
  } catch { /* absence/invalid baseline is represented by undefined */ }
  return {
    casesCount,
    reports: reports.slice(0, 20),
    ...(baseline === undefined ? {} : { baseline }),
    ...(casesCount === 0 && reports.length === 0 ? { message: '尚无评估用例或报告。' } : {}),
  }
}

/**
 * Atomically approve one existing project report as the manual evaluation baseline.
 * @param root - canonical Workspace path.
 * @param reportPath - project-relative path under evaluation reports.
 * @returns the validated source report summary.
 */
export async function approveProjectEvaluationBaseline(root: string, reportPath: string): Promise<EvaluationReportSummary> {
  const candidate = resolve(root, reportPath)
  const rel = projectRelative(root, candidate)
  const reportPrefix = `${FDE_DIRECTORY}/${EVALUATION_DIRECTORY}/reports/`
  if (!rel.startsWith(reportPrefix) || (!rel.endsWith('/report.json') && !rel.endsWith('.report.json'))) {
    throw new Error('只能把当前项目 reports 目录中的有效报告设为基线。')
  }
  const report = await parseEvaluationReport(root, candidate)
  const raw = await readJson(candidate)
  const target = join(root, FDE_DIRECTORY, EVALUATION_DIRECTORY, 'baseline', 'report.json')
  await mkdir(join(root, FDE_DIRECTORY, EVALUATION_DIRECTORY, 'baseline'), { recursive: true, mode: 0o700 })
  await withFileLock(target, async () => {
    await writeFileAtomic(target, `${JSON.stringify(raw, null, 2)}\n`, { mode: 0o600, dirMode: 0o700 })
  })
  return report
}

/**
 * Load one project snapshot without changing project files or sessions.
 * @param input - explicit Workspace identity, display title, and canonical path.
 * @returns bounded API, architecture, and evaluation data.
 */
export async function loadProjectSurfaceSnapshot(input: {
  readonly workspaceId: string
  readonly title: string
  readonly path: string
}): Promise<ProjectSurfaceSnapshot> {
  const runtime = await loadProjectRuntimeSnapshot(input.path)
  const [apiDocs, architecture, evaluation, validation, requirementWiki, requirements, solution, development, deploymentTrial, acceptanceHandover] = await Promise.all([
    loadApiDocs(input.path, runtime),
    loadArchitecture(input.path),
    loadEvaluation(input.path),
    loadValidationStage(input.path, input.workspaceId),
    loadRequirementWikiSnapshot(input.path),
    loadRequirementArtifacts(input.path, input.workspaceId),
    loadSolutionArtifacts(input.path, input.workspaceId),
    loadDevelopmentDocs(input.path, input.workspaceId),
    loadDeploymentTrialStage(input.path, input.workspaceId),
    loadAcceptanceHandoverStage(input.path, input.workspaceId),
  ])
  return {
    workspaceId: input.workspaceId,
    title: input.title,
    runtime,
    apiDocs,
    architecture: architecture.value,
    ...(architecture.error === undefined ? {} : { architectureError: architecture.error }),
    evaluation,
    validation,
    requirementWiki,
    requirements,
    solution,
    development,
    deploymentTrial,
    acceptanceHandover,
  }
}

/** Stable project-relative paths consumed by delivery surfaces. */
export const projectSurfacePaths = {
  runtime: PROJECT_RUNTIME_PATH,
  apiDocs: `${FDE_DIRECTORY}/${API_DOCS_FILE}`,
  architecture: `${FDE_DIRECTORY}/${ARCHITECTURE_FILE}`,
  evaluation: `${FDE_DIRECTORY}/${EVALUATION_DIRECTORY}`,
  validation: VALIDATION_CONTRACT_PATH,
  requirementWiki: requirementWikiPaths.root,
  requirements: REQUIREMENT_ARTIFACT_ROOT,
  solution: SOLUTION_ARTIFACT_ROOT,
  development: DEVELOPMENT_DOCS_ROOT,
  deploymentTrial: DEPLOYMENT_TRIAL_CONTRACT_PATH,
  acceptanceHandover: ACCEPTANCE_HANDOVER_CONTRACT_PATH,
} as const
