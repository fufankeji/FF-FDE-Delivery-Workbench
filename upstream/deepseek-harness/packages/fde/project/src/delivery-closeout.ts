/** Deployment-trial and acceptance-handover contracts, outputs, and FDE decisions. */

import { createHash } from 'node:crypto'
import { readFile, realpath, stat } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import { withFileLock, writeFileAtomic } from '@deepseek-ai/dsh-atomic-write'
import type {
  AcceptanceConditionSnapshot,
  AcceptanceHandoverDecision,
  AcceptanceDeliverableSnapshot,
  AcceptanceHandoverContractSnapshot,
  AcceptanceHandoverStageSnapshot,
  DeliveryCloseoutArtifactSnapshot,
  DeliveryEvidenceSnapshot,
  DeploymentTrialContractSnapshot,
  DeploymentTrialIssueSnapshot,
  DeploymentTrialStageSnapshot,
} from './types.ts'

/** Project-relative deployment-trial fact contract. */
export const DEPLOYMENT_TRIAL_CONTRACT_PATH = '.fde/deployment-trial.json'
/** Project-relative acceptance-handover fact contract. */
export const ACCEPTANCE_HANDOVER_CONTRACT_PATH = '.fde/acceptance-handover.json'
/** Canonical deployment-trial output root. */
export const DEPLOYMENT_TRIAL_ARTIFACT_ROOT = 'fde-deliverables/05-deployment-trial'
/** Canonical acceptance-handover output root. */
export const ACCEPTANCE_HANDOVER_ARTIFACT_ROOT = 'fde-deliverables/06-acceptance-handover'
/** Same-origin route serving one fixed deployment-trial output. */
export const DEPLOYMENT_TRIAL_ARTIFACT_FILE_PATH = '/api/fde-project/pilot/artifact'
/** Same-origin route serving one fixed acceptance-handover output. */
export const ACCEPTANCE_HANDOVER_ARTIFACT_FILE_PATH = '/api/fde-project/handoff/artifact'

const MAX_CONTRACT_BYTES = 512 * 1024
const MAX_ISSUES = 200
const MAX_DELIVERABLES = 200
const MAX_CONDITIONS = 200
const MAX_ACCEPTANCE_EVIDENCE = 40
const MAX_HANDOVER_EVIDENCE = 40
const SAFE_ID = /^[a-z0-9][a-z0-9._-]{0,119}$/i
const ISSUE_SEVERITIES = new Set(['critical', 'high', 'medium', 'low'])
const ISSUE_STATUSES = new Set(['open', 'resolved', 'accepted', 'deferred'])
const DEPLOYMENT_STATUSES = new Set(['preparing', 'deploying', 'running', 'blocked', 'ready'])
const ACCEPTANCE_STATUSES = new Set(['pending', 'accepted', 'conditionally-accepted', 'returned', 'terminated'])
const CONDITION_STATUSES = new Set(['open', 'resolved', 'accepted'])
const SHA256_DIGEST = /^sha256:[a-f0-9]{64}$/u

interface ArtifactDefinition {
  readonly id: string
  readonly title: string
  readonly fileName: string
}

/** Four fixed documents required to close deployment trial. */
export const DEPLOYMENT_TRIAL_ARTIFACTS: readonly ArtifactDefinition[] = [
  { id: 'deployment-runbook', title: '部署运行手册', fileName: 'deployment-runbook.md' },
  { id: 'deployment-baseline', title: '部署基线', fileName: 'deployment-baseline.md' },
  { id: 'trial-operation-report', title: '试运行报告', fileName: 'trial-operation-report.md' },
  { id: 'issue-closure-list', title: '问题闭环清单', fileName: 'issue-closure-list.md' },
]

/** Four fixed documents required to complete acceptance and handover. */
export const ACCEPTANCE_HANDOVER_ARTIFACTS: readonly ArtifactDefinition[] = [
  { id: 'delivery-inventory', title: '交付物清单', fileName: 'delivery-inventory.md' },
  { id: 'acceptance-report', title: '项目验收报告', fileName: 'acceptance-report.md' },
  { id: 'operations-and-maintenance-guide', title: '运维使用手册', fileName: 'operations-and-maintenance-guide.md' },
  { id: 'handover-record', title: '移交确认记录', fileName: 'handover-record.md' },
]

/** Verified close-out Markdown file resolved inside one registered Workspace. */
export interface DeliveryCloseoutArtifactFile {
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

function boolOf(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${label} 必须是布尔值。`)
  return value
}

function textArrayOf(value: unknown, label: string, maxItems: number): string[] {
  if (!Array.isArray(value) || value.length > maxItems) throw new Error(`${label} 必须是最多 ${String(maxItems)} 项的数组。`)
  return value.map((item, index) => textOf(item, `${label}[${String(index)}]`, 1_000))
}

function isInside(root: string, candidate: string): boolean {
  const value = relative(root, candidate)
  return value !== '' && value !== '..' && !value.startsWith(`..${sep}`) && !value.startsWith('../')
}

async function projectEvidence(projectRoot: string, raw: unknown, label: string): Promise<DeliveryEvidenceSnapshot> {
  const path = optionalText(raw, label, 1_000)
  if (path === undefined) return { available: false }
  if (isAbsolute(path)) throw new Error(`${label} 必须是项目相对路径。`)
  const normalized = path.split(sep).join('/')
  const canonicalRoot = await realpath(resolve(projectRoot))
  try {
    const candidate = await realpath(join(projectRoot, path))
    if (!isInside(canonicalRoot, candidate)) throw new Error(`${label} 越过项目目录。`)
    const value = await stat(candidate)
    return { path: normalized, available: value.isFile() }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { path: normalized, available: false }
    throw error
  }
}

async function readContract(projectRoot: string, path: string): Promise<unknown> {
  const filePath = join(projectRoot, path)
  const value = await stat(filePath)
  if (!value.isFile() || value.size > MAX_CONTRACT_BYTES) throw new Error('结构化状态文件不是普通 JSON，或超过 512 KiB。')
  return JSON.parse(await readFile(filePath, 'utf8')) as unknown
}

function contractDigest(value: unknown): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`
}

async function deploymentIssueOf(projectRoot: string, raw: unknown, index: number): Promise<DeploymentTrialIssueSnapshot> {
  const item = recordOf(raw, `issues[${String(index)}]`)
  const severity = textOf(item.severity, `issues[${String(index)}].severity`, 20).toLowerCase()
  const status = textOf(item.status, `issues[${String(index)}].status`, 20).toLowerCase()
  if (!ISSUE_SEVERITIES.has(severity)) throw new Error(`issues[${String(index)}].severity 不受支持。`)
  if (!ISSUE_STATUSES.has(status)) throw new Error(`issues[${String(index)}].status 不受支持。`)
  const evidence = await projectEvidence(projectRoot, item.evidence, `issues[${String(index)}].evidence`)
  const resolution = optionalText(item.resolution, `issues[${String(index)}].resolution`, 1_000)
  const decisionReason = optionalText(item.decisionReason, `issues[${String(index)}].decisionReason`, 1_000)
  const owner = optionalText(item.owner, `issues[${String(index)}].owner`, 240)
  return {
    id: idOf(item.id, `issues[${String(index)}].id`),
    title: textOf(item.title, `issues[${String(index)}].title`, 240),
    severity: severity as DeploymentTrialIssueSnapshot['severity'],
    status: status as DeploymentTrialIssueSnapshot['status'],
    ...(evidence.path === undefined ? {} : { evidence: evidence.path }),
    evidenceAvailable: evidence.available,
    ...(resolution === undefined ? {} : { resolution }),
    ...(decisionReason === undefined ? {} : { decisionReason }),
    ...(owner === undefined ? {} : { owner }),
  }
}

async function parseDeploymentTrial(projectRoot: string, value: unknown): Promise<DeploymentTrialContractSnapshot> {
  const record = recordOf(value, '部署试运行状态')
  if (record.schemaVersion !== 1) throw new Error('部署试运行 schemaVersion 必须是 1。')
  const environment = recordOf(record.environment, 'environment')
  const deploymentStatus = textOf(record.status, 'status', 40).toLowerCase()
  if (!DEPLOYMENT_STATUSES.has(deploymentStatus)) throw new Error('status 不受支持。')
  const evidence = recordOf(record.evidence, 'evidence')
  const rawIssues = record.issues ?? []
  if (!Array.isArray(rawIssues) || rawIssues.length > MAX_ISSUES) throw new Error(`issues 必须是最多 ${String(MAX_ISSUES)} 项的数组。`)
  return {
    status: 'ready',
    path: DEPLOYMENT_TRIAL_CONTRACT_PATH,
    digest: contractDigest(value),
    candidateVersion: textOf(record.candidateVersion, 'candidateVersion', 240),
    environment: {
      name: textOf(environment.name, 'environment.name', 240),
      summary: textOf(environment.summary, 'environment.summary', 1_000),
      authorized: boolOf(environment.authorized, 'environment.authorized'),
    },
    deploymentStatus: deploymentStatus as NonNullable<DeploymentTrialContractSnapshot['deploymentStatus']>,
    evidence: {
      validationBaseline: await projectEvidence(projectRoot, evidence.validationBaseline, 'evidence.validationBaseline'),
      deployment: await projectEvidence(projectRoot, evidence.deployment, 'evidence.deployment'),
      health: await projectEvidence(projectRoot, evidence.health, 'evidence.health'),
      rollback: await projectEvidence(projectRoot, evidence.rollback, 'evidence.rollback'),
      trial: await projectEvidence(projectRoot, evidence.trial, 'evidence.trial'),
    },
    issues: await Promise.all(rawIssues.map(async (issue, index) => await deploymentIssueOf(projectRoot, issue, index))),
  }
}

async function deliverableOf(projectRoot: string, raw: unknown, index: number): Promise<AcceptanceDeliverableSnapshot> {
  const item = recordOf(raw, `deliverables[${String(index)}]`)
  const location = textOf(item.location, `deliverables[${String(index)}].location`, 2_000)
  const declaredAvailable = boolOf(item.available, `deliverables[${String(index)}].available`)
  const version = optionalText(item.version, `deliverables[${String(index)}].version`, 240)
  const checksum = optionalText(item.checksum, `deliverables[${String(index)}].checksum`, 240)
  if (/^https?:\/\//i.test(location)) {
    const url = new URL(location)
    url.username = ''
    url.password = ''
    return {
      id: idOf(item.id, `deliverables[${String(index)}].id`),
      name: textOf(item.name, `deliverables[${String(index)}].name`, 240),
      location: url.toString(),
      ...(version === undefined ? {} : { version }),
      ...(checksum === undefined ? {} : { checksum }),
      available: declaredAvailable,
      locationType: 'external',
    }
  }
  const evidence = await projectEvidence(projectRoot, location, `deliverables[${String(index)}].location`)
  return {
    id: idOf(item.id, `deliverables[${String(index)}].id`),
    name: textOf(item.name, `deliverables[${String(index)}].name`, 240),
    location: evidence.path ?? location,
    ...(version === undefined ? {} : { version }),
    ...(checksum === undefined ? {} : { checksum }),
    available: declaredAvailable && evidence.available,
    locationType: 'project-file',
  }
}

function conditionOf(raw: unknown, index: number): AcceptanceConditionSnapshot {
  const item = recordOf(raw, `conditions[${String(index)}]`)
  const status = textOf(item.status, `conditions[${String(index)}].status`, 20).toLowerCase()
  if (!CONDITION_STATUSES.has(status)) throw new Error(`conditions[${String(index)}].status 不受支持。`)
  const reason = optionalText(item.reason, `conditions[${String(index)}].reason`, 1_000)
  const owner = optionalText(item.owner, `conditions[${String(index)}].owner`, 240)
  const followUp = optionalText(item.followUp, `conditions[${String(index)}].followUp`, 1_000)
  return {
    id: idOf(item.id, `conditions[${String(index)}].id`),
    title: textOf(item.title, `conditions[${String(index)}].title`, 240),
    status: status as AcceptanceConditionSnapshot['status'],
    ...(reason === undefined ? {} : { reason }),
    ...(owner === undefined ? {} : { owner }),
    ...(followUp === undefined ? {} : { followUp }),
  }
}

async function parseAcceptanceHandover(projectRoot: string, value: unknown): Promise<AcceptanceHandoverContractSnapshot> {
  const record = recordOf(value, '验收移交状态')
  if (record.schemaVersion !== 1) throw new Error('验收移交 schemaVersion 必须是 1。')
  const acceptance = recordOf(record.acceptance, 'acceptance')
  const acceptanceStatus = textOf(acceptance.status, 'acceptance.status', 40).toLowerCase()
  if (!ACCEPTANCE_STATUSES.has(acceptanceStatus)) throw new Error('acceptance.status 不受支持。')
  const rawDeliverables = record.deliverables ?? []
  const rawConditions = record.conditions ?? []
  const rawAcceptanceEvidence = acceptance.evidence ?? []
  if (!Array.isArray(rawDeliverables) || rawDeliverables.length > MAX_DELIVERABLES) {
    throw new Error(`deliverables 必须是最多 ${String(MAX_DELIVERABLES)} 项的数组。`)
  }
  if (!Array.isArray(rawConditions) || rawConditions.length > MAX_CONDITIONS) {
    throw new Error(`conditions 必须是最多 ${String(MAX_CONDITIONS)} 项的数组。`)
  }
  if (!Array.isArray(rawAcceptanceEvidence) || rawAcceptanceEvidence.length > MAX_ACCEPTANCE_EVIDENCE) {
    throw new Error(`acceptance.evidence 必须是最多 ${String(MAX_ACCEPTANCE_EVIDENCE)} 项的数组。`)
  }
  const handover = recordOf(record.handover, 'handover')
  const rawHandoverEvidence = handover.evidence ?? []
  if (!Array.isArray(rawHandoverEvidence) || rawHandoverEvidence.length > MAX_HANDOVER_EVIDENCE) {
    throw new Error(`handover.evidence 必须是最多 ${String(MAX_HANDOVER_EVIDENCE)} 项的数组。`)
  }
  return {
    status: 'ready',
    path: ACCEPTANCE_HANDOVER_CONTRACT_PATH,
    digest: contractDigest(value),
    finalVersion: textOf(record.finalVersion, 'finalVersion', 240),
    deploymentTrialBaseline: await projectEvidence(projectRoot, record.deploymentTrialBaseline, 'deploymentTrialBaseline'),
    acceptance: {
      status: acceptanceStatus as NonNullable<AcceptanceHandoverContractSnapshot['acceptance']>['status'],
      summary: textOf(acceptance.summary, 'acceptance.summary', 1_000),
      evidence: await Promise.all(rawAcceptanceEvidence.map(async (item, index) => (
        await projectEvidence(projectRoot, item, `acceptance.evidence[${String(index)}]`)
      ))),
    },
    deliverables: await Promise.all(rawDeliverables.map(async (item, index) => await deliverableOf(projectRoot, item, index))),
    conditions: rawConditions.map(conditionOf),
    handover: {
      trainingCompleted: boolOf(handover.trainingCompleted, 'handover.trainingCompleted'),
      accessResponsibilityTransferred: boolOf(handover.accessResponsibilityTransferred, 'handover.accessResponsibilityTransferred'),
      operationsResponsibilityTransferred: boolOf(handover.operationsResponsibilityTransferred, 'handover.operationsResponsibilityTransferred'),
      evidence: await Promise.all(rawHandoverEvidence.map(async (item, index) => (
        await projectEvidence(projectRoot, item, `handover.evidence[${String(index)}]`)
      ))),
    },
  }
}

function acceptanceHandoverDecisionOf(value: unknown): AcceptanceHandoverDecision {
  const record = recordOf(value, '验收移交人工记录')
  const acceptance = recordOf(record.acceptance, 'acceptance')
  const acceptanceStatus = textOf(acceptance.status, 'acceptance.status', 40).toLowerCase()
  if (!ACCEPTANCE_STATUSES.has(acceptanceStatus)) throw new Error('acceptance.status 不受支持。')
  const rawDeliverables = record.deliverables
  const rawConditions = record.conditions
  if (!Array.isArray(rawDeliverables) || rawDeliverables.length > MAX_DELIVERABLES) {
    throw new Error(`deliverables 必须是最多 ${String(MAX_DELIVERABLES)} 项的数组。`)
  }
  if (!Array.isArray(rawConditions) || rawConditions.length > MAX_CONDITIONS) {
    throw new Error(`conditions 必须是最多 ${String(MAX_CONDITIONS)} 项的数组。`)
  }
  const conditions = rawConditions.map((item, index) => {
    const condition = recordOf(item, `conditions[${String(index)}]`)
    const status = textOf(condition.status, `conditions[${String(index)}].status`, 20).toLowerCase()
    if (!CONDITION_STATUSES.has(status)) throw new Error(`conditions[${String(index)}].status 不受支持。`)
    const reason = optionalText(condition.reason, `conditions[${String(index)}].reason`, 1_000)
    const owner = optionalText(condition.owner, `conditions[${String(index)}].owner`, 240)
    const followUp = optionalText(condition.followUp, `conditions[${String(index)}].followUp`, 1_000)
    const result = {
      id: idOf(condition.id, `conditions[${String(index)}].id`),
      status: status as AcceptanceHandoverDecision['conditions'][number]['status'],
      ...(reason === undefined ? {} : { reason }),
      ...(owner === undefined ? {} : { owner }),
      ...(followUp === undefined ? {} : { followUp }),
    }
    if (result.status === 'accepted' && (result.reason === undefined || result.owner === undefined || result.followUp === undefined)) {
      throw new Error(`条件“${result.id}”人工接受时必须填写理由、责任人和后续安排。`)
    }
    return result
  })
  const handover = recordOf(record.handover, 'handover')
  const decision: AcceptanceHandoverDecision = {
    acceptance: {
      status: acceptanceStatus as AcceptanceHandoverDecision['acceptance']['status'],
      summary: textOf(acceptance.summary, 'acceptance.summary', 1_000),
      evidence: textArrayOf(acceptance.evidence ?? [], 'acceptance.evidence', MAX_ACCEPTANCE_EVIDENCE),
    },
    deliverables: rawDeliverables.map((item, index) => {
      const deliverable = recordOf(item, `deliverables[${String(index)}]`)
      return {
        id: idOf(deliverable.id, `deliverables[${String(index)}].id`),
        available: boolOf(deliverable.available, `deliverables[${String(index)}].available`),
      }
    }),
    conditions,
    handover: {
      trainingCompleted: boolOf(handover.trainingCompleted, 'handover.trainingCompleted'),
      accessResponsibilityTransferred: boolOf(handover.accessResponsibilityTransferred, 'handover.accessResponsibilityTransferred'),
      operationsResponsibilityTransferred: boolOf(handover.operationsResponsibilityTransferred, 'handover.operationsResponsibilityTransferred'),
      evidence: textArrayOf(handover.evidence ?? [], 'handover.evidence', MAX_HANDOVER_EVIDENCE),
    },
  }
  if (decision.acceptance.status !== 'pending' && decision.acceptance.evidence.length === 0) {
    throw new Error('记录企业验收结论时必须关联至少一份项目内证据。')
  }
  if (decision.acceptance.status === 'conditionally-accepted' && !decision.conditions.some(item => item.status === 'accepted')) {
    throw new Error('带条件通过必须至少保留一项带责任安排的已接受条件。')
  }
  const handoverRecorded = decision.handover.trainingCompleted
    || decision.handover.accessResponsibilityTransferred
    || decision.handover.operationsResponsibilityTransferred
  if (handoverRecorded && decision.handover.evidence.length === 0) {
    throw new Error('记录责任移交完成时必须关联至少一份项目内证据。')
  }
  return decision
}

function exactDecisionMap<T extends { readonly id: string }>(
  decisions: readonly T[],
  expectedIds: readonly string[],
  label: string,
): ReadonlyMap<string, T> {
  const values = new Map<string, T>()
  for (const decision of decisions) {
    if (values.has(decision.id)) throw new Error(`${label}包含重复标识“${decision.id}”。`)
    values.set(decision.id, decision)
  }
  if (values.size !== expectedIds.length || expectedIds.some(id => !values.has(id))) {
    throw new Error(`${label}已经变化，请刷新后重新核对。`)
  }
  return values
}

function emptyDeploymentContract(status: 'missing' | 'invalid', message?: string): DeploymentTrialContractSnapshot {
  return {
    status,
    path: DEPLOYMENT_TRIAL_CONTRACT_PATH,
    evidence: {
      validationBaseline: { available: false },
      deployment: { available: false },
      health: { available: false },
      rollback: { available: false },
      trial: { available: false },
    },
    issues: [],
    ...(message === undefined ? {} : { message }),
  }
}

function emptyAcceptanceContract(status: 'missing' | 'invalid', message?: string): AcceptanceHandoverContractSnapshot {
  return {
    status,
    path: ACCEPTANCE_HANDOVER_CONTRACT_PATH,
    deploymentTrialBaseline: { available: false },
    deliverables: [],
    conditions: [],
    ...(message === undefined ? {} : { message }),
  }
}

async function resolveArtifact(
  projectRoot: string,
  root: string,
  definitions: readonly ArtifactDefinition[],
  artifactId: string,
): Promise<DeliveryCloseoutArtifactFile | undefined> {
  const definition = definitions.find(candidate => candidate.id === artifactId)
  if (definition === undefined) return undefined
  const canonicalRoot = await realpath(resolve(projectRoot))
  const candidate = await realpath(join(projectRoot, root, definition.fileName))
  if (!isInside(canonicalRoot, candidate)) throw new Error('固定产物越过项目目录。')
  const value = await stat(candidate)
  if (!value.isFile()) throw new Error('固定路径不是普通文件。')
  return {
    id: definition.id,
    title: definition.title,
    name: definition.fileName,
    path: `${root}/${definition.fileName}`,
    filePath: candidate,
    bytes: value.size,
  }
}

async function inspectArtifacts(
  projectRoot: string,
  workspaceId: string | undefined,
  root: string,
  definitions: readonly ArtifactDefinition[],
  route: string,
): Promise<DeploymentTrialStageSnapshot['artifacts']> {
  const items: DeliveryCloseoutArtifactSnapshot[] = await Promise.all(definitions.map(async (definition) => {
    const path = `${root}/${definition.fileName}`
    try {
      const value = await resolveArtifact(projectRoot, root, definitions, definition.id)
      if (value === undefined) throw new Error('固定产物标识无效。')
      return {
        id: definition.id,
        title: definition.title,
        path,
        status: 'present' as const,
        bytes: value.bytes,
        updatedAt: (await stat(value.filePath)).mtime.toISOString(),
        ...(workspaceId === undefined ? {} : {
          fileUrl: `${route}?${new URLSearchParams({ workspaceId, artifactId: definition.id }).toString()}`,
        }),
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { id: definition.id, title: definition.title, path, status: 'missing' as const }
      return { id: definition.id, title: definition.title, path, status: 'error' as const, message: error instanceof Error ? error.message : String(error) }
    }
  }))
  return {
    root,
    requiredCount: definitions.length,
    presentCount: items.filter(item => item.status === 'present').length,
    items,
  }
}

/** Resolve one enumerated deployment-trial output. */
export async function resolveDeploymentTrialArtifact(
  projectRoot: string,
  artifactId: string,
): Promise<DeliveryCloseoutArtifactFile | undefined> {
  return await resolveArtifact(projectRoot, DEPLOYMENT_TRIAL_ARTIFACT_ROOT, DEPLOYMENT_TRIAL_ARTIFACTS, artifactId)
}

/** Resolve one enumerated acceptance-handover output. */
export async function resolveAcceptanceHandoverArtifact(
  projectRoot: string,
  artifactId: string,
): Promise<DeliveryCloseoutArtifactFile | undefined> {
  return await resolveArtifact(projectRoot, ACCEPTANCE_HANDOVER_ARTIFACT_ROOT, ACCEPTANCE_HANDOVER_ARTIFACTS, artifactId)
}

function deploymentTrialConfirmationBlockers(
  contract: DeploymentTrialContractSnapshot,
  artifacts: DeploymentTrialStageSnapshot['artifacts'],
): string[] {
  const blockers: string[] = []
  if (contract.status !== 'ready') blockers.push(contract.message ?? '部署试运行状态尚未就绪。')
  if (artifacts.presentCount !== artifacts.requiredCount) blockers.push('四份部署试运行产物尚未齐备。')
  if (contract.status !== 'ready') return blockers
  for (const [label, evidence] of [
    ['验证基线', contract.evidence.validationBaseline],
    ['部署执行', contract.evidence.deployment],
    ['健康检查', contract.evidence.health],
    ['回滚演练', contract.evidence.rollback],
    ['试运行观察', contract.evidence.trial],
  ] as const) {
    if (!evidence.available) blockers.push(`${label}证据尚不可用。`)
  }
  for (const issue of contract.issues) {
    if ((issue.severity === 'critical' || issue.severity === 'high') && (issue.status === 'open' || issue.status === 'deferred')) {
      blockers.push(`严重问题“${issue.title}”尚未关闭或接受。`)
    }
    if (issue.status === 'resolved' && issue.resolution === undefined) blockers.push(`问题“${issue.title}”缺少解决说明。`)
    if (issue.status === 'accepted' && issue.decisionReason === undefined) blockers.push(`问题“${issue.title}”缺少人工接受理由。`)
    if (issue.status === 'deferred' && (issue.decisionReason === undefined || issue.owner === undefined)) {
      blockers.push(`延期问题“${issue.title}”缺少理由或责任人。`)
    }
  }
  return blockers
}

/** Load deployment-trial facts, fixed outputs, and the Host-derived manual-gate readiness. */
export async function loadDeploymentTrialStage(projectRoot: string, workspaceId?: string): Promise<DeploymentTrialStageSnapshot> {
  let contract: DeploymentTrialContractSnapshot
  try {
    contract = await parseDeploymentTrial(projectRoot, await readContract(projectRoot, DEPLOYMENT_TRIAL_CONTRACT_PATH))
  } catch (error) {
    contract = (error as NodeJS.ErrnoException).code === 'ENOENT'
      ? emptyDeploymentContract('missing', '尚未生成部署试运行状态。')
      : emptyDeploymentContract('invalid', error instanceof Error ? error.message : String(error))
  }
  const artifacts = await inspectArtifacts(
    projectRoot, workspaceId, DEPLOYMENT_TRIAL_ARTIFACT_ROOT, DEPLOYMENT_TRIAL_ARTIFACTS, DEPLOYMENT_TRIAL_ARTIFACT_FILE_PATH,
  )
  const confirmationBlockers = deploymentTrialConfirmationBlockers(contract, artifacts)
  const blockers = [...confirmationBlockers]
  if (contract.status === 'ready') {
    if (contract.environment?.authorized !== true) blockers.push('目标环境尚未记录 FDE 授权。')
    if (contract.deploymentStatus !== 'ready') blockers.push('目标环境试运行状态尚未标记为 ready。')
  }
  return {
    contract,
    artifacts,
    confirmationReady: confirmationBlockers.length === 0,
    confirmationBlockers,
    gateReady: blockers.length === 0,
    blockers,
  }
}

/** Record the FDE's explicit target-environment authorization and trial-readiness conclusion. */
export async function confirmDeploymentTrialReadiness(
  projectRoot: string,
  expectedDigest: string,
): Promise<DeploymentTrialStageSnapshot> {
  if (!SHA256_DIGEST.test(expectedDigest)) throw new Error('确认部署试运行结论请求缺少有效合同摘要。')
  const contractPath = join(projectRoot, DEPLOYMENT_TRIAL_CONTRACT_PATH)
  return await withFileLock(contractPath, async () => {
    const value = await stat(contractPath)
    if (!value.isFile() || value.size > MAX_CONTRACT_BYTES) throw new Error('部署试运行状态不是普通 JSON 文件或超过 512 KiB。')
    const contract = recordOf(JSON.parse(await readFile(contractPath, 'utf8')) as unknown, '部署试运行状态')
    const current = await parseDeploymentTrial(projectRoot, contract)
    if (current.digest !== expectedDigest) throw new Error('部署试运行状态已经变化，请刷新后重新核对。')
    const snapshot = await loadDeploymentTrialStage(projectRoot)
    if (!snapshot.confirmationReady) {
      throw new Error(`部署试运行结论尚不能确认：${snapshot.confirmationBlockers.join('；')}`)
    }
    const environment = recordOf(contract.environment, 'environment')
    contract.environment = { ...environment, authorized: true }
    contract.status = 'ready'
    await writeFileAtomic(contractPath, `${JSON.stringify(contract, null, 2)}\n`, { mode: 0o600, dirMode: 0o700 })
    return await loadDeploymentTrialStage(projectRoot)
  })
}

/** Record the FDE's acceptance of one unresolved deployment-trial issue. */
export async function acceptDeploymentTrialIssue(
  projectRoot: string,
  expectedDigest: string,
  issueId: string,
  reason: string,
): Promise<DeploymentTrialStageSnapshot> {
  if (!SHA256_DIGEST.test(expectedDigest)) throw new Error('人工接受试运行问题请求缺少有效合同摘要。')
  const expectedIssueId = idOf(issueId, '人工接受试运行问题 issueId')
  const decisionReason = textOf(reason, '人工接受试运行问题 reason', 1_000)
  const contractPath = join(projectRoot, DEPLOYMENT_TRIAL_CONTRACT_PATH)
  return await withFileLock(contractPath, async () => {
    const value = await stat(contractPath)
    if (!value.isFile() || value.size > MAX_CONTRACT_BYTES) throw new Error('部署试运行状态不是普通 JSON 文件或超过 512 KiB。')
    const contract = recordOf(JSON.parse(await readFile(contractPath, 'utf8')) as unknown, '部署试运行状态')
    const current = await parseDeploymentTrial(projectRoot, contract)
    if (current.digest !== expectedDigest) throw new Error('部署试运行状态已经变化，请刷新后重新核对。')
    if (!Array.isArray(contract.issues)) throw new Error('部署试运行状态 issues 必须是数组。')
    const issueIndex = contract.issues.findIndex((candidate) => {
      if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) return false
      return (candidate as { id?: unknown }).id === expectedIssueId
    })
    if (issueIndex < 0) throw new Error('要人工接受的问题已经不存在，请刷新后重新核对。')
    const issue = recordOf(contract.issues[issueIndex], `issues[${String(issueIndex)}]`)
    const currentIssue = await deploymentIssueOf(projectRoot, issue, issueIndex)
    if (currentIssue.status !== 'open' && currentIssue.status !== 'deferred') {
      throw new Error('该问题已经处理，请刷新后查看最新状态。')
    }
    contract.issues[issueIndex] = { ...issue, status: 'accepted', decisionReason }
    await writeFileAtomic(contractPath, `${JSON.stringify(contract, null, 2)}\n`, { mode: 0o600, dirMode: 0o700 })
    return await loadDeploymentTrialStage(projectRoot)
  })
}

/** Load final acceptance/handover facts, outputs, and project-completion readiness. */
export async function loadAcceptanceHandoverStage(projectRoot: string, workspaceId?: string): Promise<AcceptanceHandoverStageSnapshot> {
  let contract: AcceptanceHandoverContractSnapshot
  try {
    contract = await parseAcceptanceHandover(projectRoot, await readContract(projectRoot, ACCEPTANCE_HANDOVER_CONTRACT_PATH))
  } catch (error) {
    contract = (error as NodeJS.ErrnoException).code === 'ENOENT'
      ? emptyAcceptanceContract('missing', '尚未生成验收移交状态。')
      : emptyAcceptanceContract('invalid', error instanceof Error ? error.message : String(error))
  }
  const artifacts = await inspectArtifacts(
    projectRoot, workspaceId, ACCEPTANCE_HANDOVER_ARTIFACT_ROOT, ACCEPTANCE_HANDOVER_ARTIFACTS, ACCEPTANCE_HANDOVER_ARTIFACT_FILE_PATH,
  )
  const blockers: string[] = []
  if (contract.status !== 'ready') blockers.push(contract.message ?? '验收移交状态尚未就绪。')
  if (artifacts.presentCount !== artifacts.requiredCount) blockers.push('四份验收移交产物尚未齐备。')
  if (contract.status === 'ready') {
    if (!contract.deploymentTrialBaseline.available) blockers.push('已确认的部署试运行基线尚不可用。')
    const acceptanceStatus = contract.acceptance?.status
    if (acceptanceStatus !== 'accepted' && acceptanceStatus !== 'conditionally-accepted') {
      blockers.push(acceptanceStatus === 'returned' || acceptanceStatus === 'terminated'
        ? '项目已退回或终止，不能完成项目。'
        : '企业验收结论尚未达到通过或带条件通过。')
    }
    if (
      contract.acceptance === undefined
      || contract.acceptance.evidence.length === 0
      || contract.acceptance.evidence.some(item => !item.available)
    ) {
      blockers.push('企业验收证据尚未齐备。')
    }
    if (contract.deliverables.length === 0) blockers.push('交付物清单尚未登记任何条目。')
    if (contract.deliverables.some(item => !item.available)) blockers.push('仍有交付物不可取得。')
    if (contract.conditions.some(item => item.status === 'open')) blockers.push('仍有未决定的验收条件。')
    if (acceptanceStatus === 'conditionally-accepted' && !contract.conditions.some(item => item.status === 'accepted')) {
      blockers.push('带条件通过尚未记录完整条件安排。')
    }
    for (const condition of contract.conditions.filter(item => item.status === 'accepted')) {
      if (condition.reason === undefined || condition.owner === undefined || condition.followUp === undefined) {
        blockers.push(`条件“${condition.title}”缺少理由、责任人或后续安排。`)
      }
    }
    if (contract.handover?.trainingCompleted !== true) blockers.push('培训尚未完成移交。')
    if (contract.handover?.accessResponsibilityTransferred !== true) blockers.push('权限责任尚未完成移交。')
    if (contract.handover?.operationsResponsibilityTransferred !== true) blockers.push('运维责任尚未完成移交。')
    if (
      contract.handover === undefined
      || contract.handover.evidence.length === 0
      || contract.handover.evidence.some(item => !item.available)
    ) {
      blockers.push('移交证据尚未齐备。')
    }
  }
  return { contract, artifacts, gateReady: blockers.length === 0, blockers }
}

/** Record the FDE's evidence-backed acceptance and responsibility-transfer decisions. */
export async function recordAcceptanceHandoverDecision(
  projectRoot: string,
  expectedDigest: string,
  rawDecision: unknown,
): Promise<AcceptanceHandoverStageSnapshot> {
  if (!SHA256_DIGEST.test(expectedDigest)) throw new Error('验收移交人工记录请求缺少有效合同摘要。')
  const decision = acceptanceHandoverDecisionOf(rawDecision)
  const contractPath = join(projectRoot, ACCEPTANCE_HANDOVER_CONTRACT_PATH)
  return await withFileLock(contractPath, async () => {
    const value = await stat(contractPath)
    if (!value.isFile() || value.size > MAX_CONTRACT_BYTES) throw new Error('验收移交状态不是普通 JSON 文件或超过 512 KiB。')
    const contract = recordOf(JSON.parse(await readFile(contractPath, 'utf8')) as unknown, '验收移交状态')
    const current = await parseAcceptanceHandover(projectRoot, contract)
    if (current.digest !== expectedDigest) throw new Error('验收移交状态已经变化，请刷新后重新核对。')
    const deliverableDecisions = exactDecisionMap(decision.deliverables, current.deliverables.map(item => item.id), '交付物决定')
    const conditionDecisions = exactDecisionMap(decision.conditions, current.conditions.map(item => item.id), '验收条件决定')
    const acceptanceEvidence = await Promise.all(decision.acceptance.evidence.map(async (path, index) => (
      await projectEvidence(projectRoot, path, `acceptance.evidence[${String(index)}]`)
    )))
    if (acceptanceEvidence.some(item => !item.available)) throw new Error('企业验收证据包含当前项目内不可读取的文件。')
    const handoverEvidence = await Promise.all(decision.handover.evidence.map(async (path, index) => (
      await projectEvidence(projectRoot, path, `handover.evidence[${String(index)}]`)
    )))
    if (handoverEvidence.some(item => !item.available)) throw new Error('责任移交证据包含当前项目内不可读取的文件。')
    for (const item of current.deliverables) {
      if (deliverableDecisions.get(item.id)?.available !== true || item.locationType === 'external') continue
      const evidence = await projectEvidence(projectRoot, item.location, `deliverables.${item.id}.location`)
      if (!evidence.available) throw new Error(`交付物“${item.name}”的项目内位置当前不可读取。`)
    }
    const rawAcceptance = recordOf(contract.acceptance, 'acceptance')
    contract.acceptance = {
      ...rawAcceptance,
      status: decision.acceptance.status,
      summary: decision.acceptance.summary,
      evidence: [...decision.acceptance.evidence],
    }
    if (!Array.isArray(contract.deliverables)) throw new Error('deliverables 必须是数组。')
    contract.deliverables = contract.deliverables.map((item, index) => {
      const raw = recordOf(item, `deliverables[${String(index)}]`)
      const id = idOf(raw.id, `deliverables[${String(index)}].id`)
      return { ...raw, available: deliverableDecisions.get(id)?.available ?? false }
    })
    if (!Array.isArray(contract.conditions)) throw new Error('conditions 必须是数组。')
    contract.conditions = contract.conditions.map((item, index) => {
      const raw = recordOf(item, `conditions[${String(index)}]`)
      const id = idOf(raw.id, `conditions[${String(index)}].id`)
      const next = conditionDecisions.get(id)
      if (next === undefined) throw new Error('验收条件决定已经变化，请刷新后重新核对。')
      const updated: Record<string, unknown> = { ...raw, status: next.status }
      if (next.reason === undefined) delete updated.reason
      else updated.reason = next.reason
      if (next.owner === undefined) delete updated.owner
      else updated.owner = next.owner
      if (next.followUp === undefined) delete updated.followUp
      else updated.followUp = next.followUp
      return updated
    })
    const rawHandover = recordOf(contract.handover, 'handover')
    contract.handover = {
      ...rawHandover,
      trainingCompleted: decision.handover.trainingCompleted,
      accessResponsibilityTransferred: decision.handover.accessResponsibilityTransferred,
      operationsResponsibilityTransferred: decision.handover.operationsResponsibilityTransferred,
      evidence: [...decision.handover.evidence],
    }
    await writeFileAtomic(contractPath, `${JSON.stringify(contract, null, 2)}\n`, { mode: 0o600, dirMode: 0o700 })
    return await loadAcceptanceHandoverStage(projectRoot)
  })
}
