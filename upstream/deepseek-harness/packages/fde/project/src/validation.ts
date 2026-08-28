/** Read-only validation contract, evidence, and fixed stage outputs. */

import { createHash } from 'node:crypto'
import { readFile, realpath, stat } from 'node:fs/promises'
import { basename, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { withFileLock, writeFileAtomic } from '@deepseek-ai/dsh-atomic-write'
import type {
  ValidationArtifactSnapshot,
  ValidationContractSnapshot,
  ValidationDatasetSnapshot,
  ValidationIssueSnapshot,
  ValidationMetricCategory,
  ValidationMetricSnapshot,
  ValidationMetricSourceSnapshot,
  ValidationMetricStatus,
  ValidationStageSnapshot,
} from './types.ts'
import { VALIDATION_METRIC_CATEGORIES } from './types.ts'

/** Project-relative validation contract path. */
export const VALIDATION_CONTRACT_PATH = '.fde/evaluations/validation.json'
/** FDE confirmation bound to one exact validation contract digest. */
export const VALIDATION_PLAN_APPROVAL_PATH = '.fde/evaluations/validation-plan-approval.json'
/** Canonical validation close-out root. */
export const VALIDATION_ARTIFACT_ROOT = 'fde-deliverables/04-validation'
/** Same-origin route serving one Host-indexed validation output. */
export const VALIDATION_ARTIFACT_FILE_PATH = '/api/fde-project/validation/artifact'

const MAX_CONTRACT_BYTES = 512 * 1024
const MAX_DATASETS = 100
const MAX_METRICS = 200
const MAX_ISSUES = 200
const MAX_SOURCES_PER_METRIC = 20
const MAX_SOURCE_REFERENCES = 40
const MAX_SOURCE_BYTES = 2 * 1024 * 1024
const MAX_APPROVAL_BYTES = 16 * 1024
const SAFE_ID = /^[a-z0-9][a-z0-9._-]{0,119}$/i
const SHA256_DIGEST = /^sha256:[a-f0-9]{64}$/u
const METRIC_STATUSES = new Set<ValidationMetricStatus>(['PASS', 'WARN', 'FAIL', 'NOT_RUN'])
const ISSUE_SEVERITIES = new Set(['critical', 'high', 'medium', 'low'])
const ISSUE_STATUSES = new Set(['open', 'resolved', 'waived'])

interface ValidationArtifactDefinition {
  readonly id: ValidationArtifactSnapshot['id']
  readonly title: string
  readonly path: string
}

/** Fixed documents required before an FDE may submit validation. */
export const VALIDATION_ARTIFACTS: readonly ValidationArtifactDefinition[] = [
  { id: 'validation-plan', title: '验证计划', path: `${VALIDATION_ARTIFACT_ROOT}/validation-plan.md` },
  { id: 'validation-report', title: '验证报告', path: `${VALIDATION_ARTIFACT_ROOT}/validation-report.md` },
  { id: 'validation-baseline', title: '验证基线', path: `${VALIDATION_ARTIFACT_ROOT}/validation-baseline.md` },
]

/** Verified validation document resolved inside one registered Workspace. */
export interface ValidationArtifactFile {
  readonly id: string
  readonly title: string
  readonly name: string
  readonly path: string
  readonly filePath: string
  readonly bytes: number
}

function recordOf(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} 必须是对象。`)
  return value as Record<string, unknown>
}

function textOf(value: unknown, label: string, max = 500): string {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${label} 必须是非空文字。`)
  const result = value.trim()
  if (result.length > max) throw new Error(`${label} 不能超过 ${String(max)} 个字符。`)
  return result
}

function optionalText(value: unknown, label: string, max = 500): string | undefined {
  if (value === undefined || value === null || value === '') return undefined
  return textOf(value, label, max)
}

function idOf(value: unknown, label: string): string {
  const id = textOf(value, label, 120)
  if (!SAFE_ID.test(id)) throw new Error(`${label} 只允许字母、数字、点、下划线和连字符。`)
  return id
}

function isInside(root: string, candidate: string): boolean {
  const value = relative(root, candidate)
  return value !== '' && value !== '..' && !value.startsWith(`..${sep}`) && !value.startsWith('../')
}

async function evidenceOf(projectRoot: string, raw: unknown, label: string): Promise<{
  readonly path?: string
  readonly available: boolean
  readonly filePath?: string
  readonly bytes?: number
}> {
  const path = optionalText(raw, label, 1_000)
  if (path === undefined) return { available: false }
  if (isAbsolute(path)) throw new Error(`${label} 必须是项目相对路径。`)
  const canonicalRoot = await realpath(resolve(projectRoot))
  try {
    const candidate = await realpath(join(projectRoot, path))
    if (!isInside(canonicalRoot, candidate)) throw new Error(`${label} 越过项目目录。`)
    const value = await stat(candidate)
    return {
      path: path.split(sep).join('/'),
      available: value.isFile(),
      ...(value.isFile() ? { filePath: candidate, bytes: value.size } : {}),
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { path: path.split(sep).join('/'), available: false }
    throw error
  }
}

async function metricSourceOf(
  projectRoot: string,
  raw: unknown,
  metricIndex: number,
  sourceIndex: number,
): Promise<ValidationMetricSourceSnapshot> {
  const label = `metrics[${String(metricIndex)}].sources[${String(sourceIndex)}]`
  const item = recordOf(raw, label)
  const source = await evidenceOf(projectRoot, item.path, `${label}.path`)
  const rawReferences = item.references
  if (!Array.isArray(rawReferences) || rawReferences.length === 0 || rawReferences.length > MAX_SOURCE_REFERENCES) {
    throw new Error(`${label}.references 必须是 1 到 ${String(MAX_SOURCE_REFERENCES)} 项的数组。`)
  }
  const references = rawReferences.map((reference, index) => textOf(reference, `${label}.references[${String(index)}]`, 120))
  if (new Set(references).size !== references.length) throw new Error(`${label}.references 不能重复。`)
  if (source.path === undefined) throw new Error(`${label}.path 必须是非空文字。`)
  if (source.bytes !== undefined && source.bytes > MAX_SOURCE_BYTES) throw new Error(`${label}.path 超过 2 MiB。`)
  const digest = source.available && source.filePath !== undefined
    ? `sha256:${createHash('sha256').update(await readFile(source.filePath)).digest('hex')}`
    : undefined
  return { path: source.path, references, available: source.available, ...(digest === undefined ? {} : { digest }) }
}

function datasetOf(raw: unknown, index: number): ValidationDatasetSnapshot {
  const item = recordOf(raw, `datasets[${String(index)}]`)
  const version = optionalText(item.version, `datasets[${String(index)}].version`, 240)
  const source = optionalText(item.source, `datasets[${String(index)}].source`, 1_000)
  const hash = optionalText(item.hash, `datasets[${String(index)}].hash`, 240)
  return {
    id: idOf(item.id, `datasets[${String(index)}].id`),
    name: textOf(item.name, `datasets[${String(index)}].name`, 240),
    ...(version === undefined ? {} : { version }),
    ...(source === undefined ? {} : { source }),
    ...(hash === undefined ? {} : { hash }),
  }
}

async function metricOf(projectRoot: string, raw: unknown, index: number): Promise<ValidationMetricSnapshot> {
  const item = recordOf(raw, `metrics[${String(index)}]`)
  const rawCategory = textOf(item.category, `metrics[${String(index)}].category`, 40)
  if (!VALIDATION_METRIC_CATEGORIES.includes(rawCategory as ValidationMetricCategory)) {
    throw new Error(`metrics[${String(index)}].category 不受支持。`)
  }
  if (typeof item.required !== 'boolean') throw new Error(`metrics[${String(index)}].required 必须是布尔值。`)
  const rawSources = item.sources
  if (!Array.isArray(rawSources) || rawSources.length === 0 || rawSources.length > MAX_SOURCES_PER_METRIC) {
    throw new Error(`metrics[${String(index)}].sources 必须是 1 到 ${String(MAX_SOURCES_PER_METRIC)} 项的数组。`)
  }
  const sources = await Promise.all(rawSources.map(async (source, sourceIndex) => (
    await metricSourceOf(projectRoot, source, index, sourceIndex)
  )))
  const result = item.result === undefined ? {} : recordOf(item.result, `metrics[${String(index)}].result`)
  const rawStatus = result.status === undefined ? 'NOT_RUN' : textOf(result.status, `metrics[${String(index)}].result.status`, 20).toUpperCase()
  if (!METRIC_STATUSES.has(rawStatus as ValidationMetricStatus)) {
    throw new Error(`metrics[${String(index)}].result.status 不受支持。`)
  }
  const evidence = await evidenceOf(projectRoot, result.evidence, `metrics[${String(index)}].result.evidence`)
  const value = optionalText(result.value, `metrics[${String(index)}].result.value`, 500)
  const waiverReason = optionalText(result.waiverReason, `metrics[${String(index)}].result.waiverReason`, 1_000)
  const manualAcceptance = result.manualAcceptance === undefined
    ? undefined
    : recordOf(result.manualAcceptance, `metrics[${String(index)}].result.manualAcceptance`)
  const manualAcceptanceReason = manualAcceptance === undefined
    ? undefined
    : textOf(manualAcceptance.reason, `metrics[${String(index)}].result.manualAcceptance.reason`, 1_000)
  const manualAcceptanceAt = manualAcceptance === undefined
    ? undefined
    : textOf(manualAcceptance.acceptedAt, `metrics[${String(index)}].result.manualAcceptance.acceptedAt`, 80)
  if (manualAcceptanceAt !== undefined && Number.isNaN(Date.parse(manualAcceptanceAt))) {
    throw new Error(`metrics[${String(index)}].result.manualAcceptance.acceptedAt 必须是有效时间。`)
  }
  const note = optionalText(result.note, `metrics[${String(index)}].result.note`, 1_000)
  return {
    id: idOf(item.id, `metrics[${String(index)}].id`),
    name: textOf(item.name, `metrics[${String(index)}].name`, 240),
    category: rawCategory as ValidationMetricCategory,
    method: textOf(item.method, `metrics[${String(index)}].method`, 1_000),
    threshold: textOf(item.threshold, `metrics[${String(index)}].threshold`, 500),
    sources,
    required: item.required,
    status: rawStatus as ValidationMetricStatus,
    ...(value === undefined ? {} : { value }),
    ...(evidence.path === undefined ? {} : { evidence: evidence.path }),
    evidenceAvailable: evidence.available,
    ...(waiverReason === undefined ? {} : { waiverReason }),
    ...(manualAcceptanceReason === undefined || manualAcceptanceAt === undefined
      ? {}
      : { manualAcceptance: { reason: manualAcceptanceReason, acceptedAt: manualAcceptanceAt } }),
    ...(note === undefined ? {} : { note }),
  }
}

async function issueOf(projectRoot: string, raw: unknown, index: number): Promise<ValidationIssueSnapshot> {
  const item = recordOf(raw, `issues[${String(index)}]`)
  const severity = textOf(item.severity, `issues[${String(index)}].severity`, 20).toLowerCase()
  const status = textOf(item.status, `issues[${String(index)}].status`, 20).toLowerCase()
  if (!ISSUE_SEVERITIES.has(severity)) throw new Error(`issues[${String(index)}].severity 不受支持。`)
  if (!ISSUE_STATUSES.has(status)) throw new Error(`issues[${String(index)}].status 不受支持。`)
  const evidence = await evidenceOf(projectRoot, item.evidence, `issues[${String(index)}].evidence`)
  const resolution = optionalText(item.resolution, `issues[${String(index)}].resolution`, 1_000)
  const waiverReason = optionalText(item.waiverReason, `issues[${String(index)}].waiverReason`, 1_000)
  const waivedAt = optionalText(item.waivedAt, `issues[${String(index)}].waivedAt`, 80)
  if (waivedAt !== undefined && Number.isNaN(Date.parse(waivedAt))) {
    throw new Error(`issues[${String(index)}].waivedAt 必须是有效时间。`)
  }
  return {
    id: idOf(item.id, `issues[${String(index)}].id`),
    title: textOf(item.title, `issues[${String(index)}].title`, 240),
    severity: severity as ValidationIssueSnapshot['severity'],
    status: status as ValidationIssueSnapshot['status'],
    ...(evidence.path === undefined ? {} : { evidence: evidence.path }),
    evidenceAvailable: evidence.available,
    ...(resolution === undefined ? {} : { resolution }),
    ...(waiverReason === undefined ? {} : { waiverReason }),
    ...(waivedAt === undefined ? {} : { waivedAt }),
  }
}

async function parseValidationContract(projectRoot: string, value: unknown): Promise<ValidationContractSnapshot> {
  const contract = recordOf(value, '验证合同')
  if (contract.schemaVersion !== 2) throw new Error('验证合同 schemaVersion 必须是 2。')
  const candidate = recordOf(contract.candidate, 'candidate')
  const candidateId = textOf(candidate.id, 'candidate.id', 240)
  const candidateDescription = optionalText(candidate.description, 'candidate.description', 1_000)
  const candidateSource = optionalText(candidate.source, 'candidate.source', 1_000)
  const environment = textOf(contract.environment, 'environment', 1_000)
  const rawDatasets = contract.datasets ?? []
  const rawMetrics = contract.metrics
  const rawIssues = contract.issues ?? []
  if (!Array.isArray(rawDatasets) || rawDatasets.length > MAX_DATASETS) throw new Error(`datasets 必须是最多 ${String(MAX_DATASETS)} 项的数组。`)
  if (!Array.isArray(rawMetrics) || rawMetrics.length === 0 || rawMetrics.length > MAX_METRICS) throw new Error(`metrics 必须是 1 到 ${String(MAX_METRICS)} 项的数组。`)
  if (!Array.isArray(rawIssues) || rawIssues.length > MAX_ISSUES) throw new Error(`issues 必须是最多 ${String(MAX_ISSUES)} 项的数组。`)
  const datasets = rawDatasets.map(datasetOf)
  const metricResults = await Promise.all(rawMetrics.map(async (metric, index) => {
    try {
      return { metric: await metricOf(projectRoot, metric, index) }
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) }
    }
  }))
  const metrics = metricResults.flatMap(result => result.metric === undefined ? [] : [result.metric])
  const metricErrors = metricResults.flatMap(result => result.error === undefined ? [] : [result.error])
  const issues = await Promise.all(rawIssues.map(async (issue, index) => await issueOf(projectRoot, issue, index)))
  for (const [label, ids] of [['datasets', datasets.map(item => item.id)], ['metrics', metrics.map(item => item.id)], ['issues', issues.map(item => item.id)]] as const) {
    if (new Set(ids).size !== ids.length) throw new Error(`${label} 包含重复 id。`)
  }
  const parsed = {
    path: VALIDATION_CONTRACT_PATH,
    candidateId,
    ...(candidateDescription === undefined ? {} : { candidateDescription }),
    ...(candidateSource === undefined ? {} : { candidateSource }),
    environment,
    datasets,
    metrics,
    issues,
  }
  if (metricErrors.length > 0) {
    const visibleErrors = metricErrors.slice(0, 3).join('；')
    const remaining = metricErrors.length > 3 ? `；另有 ${String(metricErrors.length - 3)} 项错误` : ''
    return {
      status: 'invalid',
      ...parsed,
      message: `验证合同包含 ${String(metricErrors.length)} 个无效指标：${visibleErrors}${remaining}。其余 ${String(metrics.length)} 项仍可查看，但不能确认方案或推进阶段。`,
    }
  }
  return { status: 'ready', ...parsed }
}

function planDigest(contract: ValidationContractSnapshot): string {
  const value = {
    schemaVersion: 2,
    candidate: {
      id: contract.candidateId,
      ...(contract.candidateDescription === undefined ? {} : { description: contract.candidateDescription }),
      ...(contract.candidateSource === undefined ? {} : { source: contract.candidateSource }),
    },
    environment: contract.environment,
    datasets: contract.datasets,
    metrics: contract.metrics.map(metric => ({
      id: metric.id,
      name: metric.name,
      category: metric.category,
      method: metric.method,
      threshold: metric.threshold,
      sources: metric.sources.map(source => ({ path: source.path, references: source.references, digest: source.digest })),
      required: metric.required,
    })),
  }
  return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`
}

function metricNormallySatisfied(metric: ValidationMetricSnapshot): boolean {
  return metric.evidenceAvailable
    && (metric.status === 'PASS' || (metric.status === 'WARN' && metric.waiverReason !== undefined))
}

function metricSatisfied(metric: ValidationMetricSnapshot): boolean {
  return metricNormallySatisfied(metric) || metric.manualAcceptance !== undefined
}

function artifactFileUrl(workspaceId: string, artifactId: string): string {
  return `${VALIDATION_ARTIFACT_FILE_PATH}?${new URLSearchParams({ workspaceId, artifactId }).toString()}`
}

async function inspectArtifact(
  projectRoot: string,
  definition: ValidationArtifactDefinition,
  workspaceId?: string,
): Promise<ValidationArtifactSnapshot> {
  try {
    const canonicalRoot = await realpath(resolve(projectRoot))
    const candidate = await realpath(join(projectRoot, definition.path))
    if (!isInside(canonicalRoot, candidate)) throw new Error('验证产物越过项目目录。')
    const value = await stat(candidate)
    if (!value.isFile()) throw new Error('验证产物路径不是普通文件。')
    return {
      ...definition,
      status: 'present',
      bytes: value.size,
      updatedAt: value.mtime.toISOString(),
      ...(workspaceId === undefined ? {} : { fileUrl: artifactFileUrl(workspaceId, definition.id) }),
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { ...definition, status: 'missing' }
    return { ...definition, status: 'error', message: error instanceof Error ? error.message : String(error) }
  }
}

async function loadContract(projectRoot: string): Promise<ValidationContractSnapshot> {
  try {
    const path = join(projectRoot, VALIDATION_CONTRACT_PATH)
    const value = await stat(path)
    if (!value.isFile() || value.size > MAX_CONTRACT_BYTES) throw new Error('验证合同不是普通 JSON 文件或超过 512 KiB。')
    const contract = await parseValidationContract(projectRoot, JSON.parse(await readFile(path, 'utf8')) as unknown)
    return contract.status === 'ready' ? { ...contract, digest: planDigest(contract) } : contract
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { status: 'missing', path: VALIDATION_CONTRACT_PATH, datasets: [], metrics: [], issues: [], message: '尚未建立验证合同。' }
    }
    return {
      status: 'invalid',
      path: VALIDATION_CONTRACT_PATH,
      datasets: [],
      metrics: [],
      issues: [],
      message: error instanceof Error ? error.message : String(error),
    }
  }
}

async function loadPlanApproval(projectRoot: string, contractDigest: string | undefined, planReady: boolean): Promise<ValidationStageSnapshot['planApproval']> {
  if (!planReady || contractDigest === undefined) {
    return { status: 'unavailable', message: '评估方案尚未满足确认条件。' }
  }
  try {
    const path = join(projectRoot, VALIDATION_PLAN_APPROVAL_PATH)
    const value = await stat(path)
    if (!value.isFile() || value.size > MAX_APPROVAL_BYTES) throw new Error('评估方案确认记录不是普通 JSON 文件或超过 16 KiB。')
    const approval = recordOf(JSON.parse(await readFile(path, 'utf8')) as unknown, '评估方案确认记录')
    if (approval.schemaVersion !== 1) throw new Error('评估方案确认记录 schemaVersion 必须是 1。')
    const approvedDigest = textOf(approval.contractDigest, '评估方案确认记录 contractDigest', 80)
    if (!SHA256_DIGEST.test(approvedDigest)) throw new Error('评估方案确认记录 contractDigest 无效。')
    const confirmedAt = textOf(approval.confirmedAt, '评估方案确认记录 confirmedAt', 80)
    if (Number.isNaN(Date.parse(confirmedAt))) throw new Error('评估方案确认记录 confirmedAt 无效。')
    if (approvedDigest !== contractDigest) {
      return {
        status: 'stale', contractDigest: approvedDigest, confirmedAt,
        message: '评估方案已变更，需要 FDE 重新确认。',
      }
    }
    return { status: 'confirmed', contractDigest: approvedDigest, confirmedAt }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { status: 'pending', contractDigest, message: '评估方案等待 FDE 确认。' }
    }
    return {
      status: 'stale', contractDigest,
      message: error instanceof Error ? error.message : String(error),
    }
  }
}

/** Inspect validation readiness and fixed outputs without changing project files. */
export async function loadValidationStage(projectRoot: string, workspaceId?: string): Promise<ValidationStageSnapshot> {
  const [contract, artifacts] = await Promise.all([
    loadContract(projectRoot),
    Promise.all(VALIDATION_ARTIFACTS.map(async definition => await inspectArtifact(projectRoot, definition, workspaceId))),
  ])
  const planBlockers: string[] = []
  if (contract.status !== 'ready') planBlockers.push(contract.message ?? '验证合同尚未就绪。')
  if (contract.status === 'ready') {
    for (const metric of contract.metrics) {
      for (const source of metric.sources.filter(item => !item.available)) {
        planBlockers.push(`指标“${metric.name}”的来源文件不可读取：${source.path}。`)
      }
    }
  }
  const validationPlan = artifacts.find(item => item.id === 'validation-plan')
  if (validationPlan?.status !== 'present') planBlockers.push('验证计划尚未生成。')
  const planReady = planBlockers.length === 0
  const planApproval = await loadPlanApproval(projectRoot, contract.digest, planReady)
  const blockers = [...planBlockers]
  if (planApproval.status === 'pending') blockers.push('评估方案尚未由 FDE 确认。')
  if (planApproval.status === 'stale') blockers.push(planApproval.message ?? '评估方案需要 FDE 重新确认。')
  for (const metric of contract.metrics.filter(item => item.required)) {
    if (metric.manualAcceptance === undefined) {
      if (metric.status === 'NOT_RUN') blockers.push(`必需指标“${metric.name}”尚未运行。`)
      else {
        if (metric.status === 'FAIL') blockers.push(`必需指标“${metric.name}”未通过。`)
        if (!metric.evidenceAvailable) blockers.push(`必需指标“${metric.name}”缺少可读取证据。`)
        if (metric.status === 'WARN' && metric.waiverReason === undefined) blockers.push(`必需指标“${metric.name}”的 WARN 尚无接受理由。`)
      }
    }
  }
  for (const issue of contract.issues) {
    if ((issue.severity === 'critical' || issue.severity === 'high') && issue.status === 'open') {
      blockers.push(`关键问题“${issue.title}”尚未处理。`)
    }
    if (issue.status === 'waived' && issue.waiverReason === undefined) blockers.push(`问题“${issue.title}”的人工接受决定缺少理由。`)
    if (issue.status === 'waived' && issue.waivedAt === undefined) blockers.push(`问题“${issue.title}”的人工接受决定缺少时间。`)
  }
  for (const artifact of artifacts.filter(item => item.status !== 'present' && item.id !== 'validation-plan')) blockers.push(`${artifact.title}尚未生成。`)
  const requiredMetrics = contract.metrics.filter(item => item.required)
  const satisfiedMetrics = requiredMetrics.filter(metricSatisfied)
  return {
    contract,
    artifacts: {
      root: VALIDATION_ARTIFACT_ROOT,
      requiredCount: VALIDATION_ARTIFACTS.length,
      presentCount: artifacts.filter(item => item.status === 'present').length,
      items: artifacts,
    },
    planReady,
    planBlockers,
    planApproval,
    requiredMetricCount: requiredMetrics.length,
    satisfiedMetricCount: satisfiedMetrics.length,
    gateReady: blockers.length === 0 && planApproval.status === 'confirmed',
    blockers: [...new Set(blockers)],
  }
}

/** Accept one unmet required validation metric while preserving its real result and evidence state. */
export async function acceptValidationMetric(
  projectRoot: string,
  expectedDigest: string,
  metricId: string,
  reason: string,
): Promise<ValidationStageSnapshot> {
  if (!SHA256_DIGEST.test(expectedDigest)) throw new Error('人工接受指标请求缺少有效合同摘要。')
  const expectedMetricId = idOf(metricId, '人工接受指标 metricId')
  const acceptanceReason = textOf(reason, '人工接受指标 reason', 1_000)
  const contractPath = join(projectRoot, VALIDATION_CONTRACT_PATH)
  return await withFileLock(contractPath, async () => {
    const value = await stat(contractPath)
    if (!value.isFile() || value.size > MAX_CONTRACT_BYTES) throw new Error('验证合同不是普通 JSON 文件或超过 512 KiB。')
    const contract = recordOf(JSON.parse(await readFile(contractPath, 'utf8')) as unknown, '验证合同')
    const current = await parseValidationContract(projectRoot, contract)
    if (current.status !== 'ready') throw new Error(current.message ?? '验证合同尚未就绪。')
    if (planDigest(current) !== expectedDigest) throw new Error('评估方案已经变化，请刷新后重新核对。')
    if (!Array.isArray(contract.metrics)) throw new Error('验证合同 metrics 必须是数组。')
    const metricIndex = contract.metrics.findIndex((candidate) => {
      if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) return false
      return (candidate as { id?: unknown }).id === expectedMetricId
    })
    if (metricIndex < 0) throw new Error('要人工接受的指标已经不存在，请刷新后重新核对。')
    const metric = recordOf(contract.metrics[metricIndex], `metrics[${String(metricIndex)}]`)
    const currentMetric = await metricOf(projectRoot, metric, metricIndex)
    if (!currentMetric.required) throw new Error('只有必需指标可以由 FDE 人工接受。')
    if (metricNormallySatisfied(currentMetric)) throw new Error('该指标已经通过正常结果和证据满足门槛，无需人工接受。')
    if (currentMetric.manualAcceptance !== undefined) throw new Error('该指标已经由 FDE 人工接受，请刷新后查看最新状态。')
    const result = metric.result === undefined ? {} : recordOf(metric.result, `metrics[${String(metricIndex)}].result`)
    contract.metrics[metricIndex] = {
      ...metric,
      result: {
        ...result,
        manualAcceptance: {
          reason: acceptanceReason,
          acceptedAt: new Date().toISOString(),
        },
      },
    }
    await writeFileAtomic(contractPath, `${JSON.stringify(contract, null, 2)}\n`, { mode: 0o600, dirMode: 0o700 })
    return await loadValidationStage(projectRoot)
  })
}

/** Confirm the exact validation plan currently displayed to the FDE. */
export async function confirmValidationPlan(projectRoot: string, expectedDigest: string): Promise<ValidationStageSnapshot> {
  if (!SHA256_DIGEST.test(expectedDigest)) throw new Error('评估方案确认请求缺少有效合同摘要。')
  const approvalPath = join(projectRoot, VALIDATION_PLAN_APPROVAL_PATH)
  return await withFileLock(approvalPath, async () => {
    const current = await loadValidationStage(projectRoot)
    if (!current.planReady || current.contract.digest === undefined) {
      throw new Error(current.planBlockers[0] ?? '评估方案尚未满足确认条件。')
    }
    if (current.contract.digest !== expectedDigest) throw new Error('评估方案已经变化，请刷新后重新核对。')
    await writeFileAtomic(approvalPath, `${JSON.stringify({
      schemaVersion: 1,
      contractDigest: expectedDigest,
      confirmedAt: new Date().toISOString(),
    }, null, 2)}\n`, { mode: 0o600, dirMode: 0o700 })
    return await loadValidationStage(projectRoot)
  })
}

/** Accept one still-open validation issue without changing any metric result. */
export async function waiveValidationIssue(
  projectRoot: string,
  expectedDigest: string,
  issueId: string,
  reason: string,
): Promise<ValidationStageSnapshot> {
  if (!SHA256_DIGEST.test(expectedDigest)) throw new Error('人工关闭问题请求缺少有效合同摘要。')
  const expectedIssueId = idOf(issueId, '人工关闭问题 issueId')
  const waiverReason = textOf(reason, '人工关闭问题 reason', 1_000)
  const contractPath = join(projectRoot, VALIDATION_CONTRACT_PATH)
  return await withFileLock(contractPath, async () => {
    const value = await stat(contractPath)
    if (!value.isFile() || value.size > MAX_CONTRACT_BYTES) throw new Error('验证合同不是普通 JSON 文件或超过 512 KiB。')
    const contract = recordOf(JSON.parse(await readFile(contractPath, 'utf8')) as unknown, '验证合同')
    const current = await parseValidationContract(projectRoot, contract)
    if (current.status !== 'ready') throw new Error(current.message ?? '验证合同尚未就绪。')
    if (planDigest(current) !== expectedDigest) throw new Error('评估方案已经变化，请刷新后重新核对。')
    if (!Array.isArray(contract.issues)) throw new Error('验证合同 issues 必须是数组。')
    const issueIndex = contract.issues.findIndex((candidate) => {
      if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) return false
      return (candidate as { id?: unknown }).id === expectedIssueId
    })
    if (issueIndex < 0) throw new Error('要人工关闭的问题已经不存在，请刷新后重新核对。')
    const issue = recordOf(contract.issues[issueIndex], `issues[${String(issueIndex)}]`)
    const currentIssue = await issueOf(projectRoot, issue, issueIndex)
    if (currentIssue.status !== 'open') throw new Error('该问题已经处理，请刷新后查看最新状态。')
    contract.issues[issueIndex] = {
      ...issue,
      status: 'waived',
      waiverReason,
      waivedAt: new Date().toISOString(),
    }
    await writeFileAtomic(contractPath, `${JSON.stringify(contract, null, 2)}\n`, { mode: 0o600, dirMode: 0o700 })
    return await loadValidationStage(projectRoot)
  })
}

/** Resolve one Host-indexed validation document without accepting a browser path. */
export async function resolveValidationArtifact(projectRoot: string, artifactId: string): Promise<ValidationArtifactFile | undefined> {
  const definition = VALIDATION_ARTIFACTS.find(item => item.id === artifactId)
  if (definition === undefined) return undefined
  const snapshot = await inspectArtifact(projectRoot, definition)
  if (snapshot.status !== 'present') return undefined
  const canonicalRoot = await realpath(resolve(projectRoot))
  const candidate = await realpath(join(projectRoot, definition.path))
  if (!isInside(canonicalRoot, candidate)) throw new Error('验证产物越过项目目录。')
  const value = await stat(candidate)
  if (!value.isFile()) throw new Error('验证产物路径不是普通文件。')
  return {
    id: definition.id,
    title: definition.title,
    name: basename(definition.path),
    path: definition.path,
    filePath: candidate,
    bytes: value.size,
  }
}
