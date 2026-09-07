/** Read-only, version-pinned delivery evidence for Pilot, handover and improvement. */
import { createHash } from 'node:crypto'
import { readFile, realpath, stat } from 'node:fs/promises'
import { isAbsolute, join, relative, sep } from 'node:path'
import type { V2DeliveryEvidence, V2DeliveryItem, V2DeliveryScope, V2DeliverySnapshot, V2LifecycleStageId } from './types.ts'

const CATEGORIES = {
  pilot: ['authorization', 'integration', 'recovery', 'technical', 'business', 'issue'],
  production: ['release', 'adoption', 'acceptance', 'deliverable', 'handover'],
  improvement: ['signal', 'change', 'impact', 'validation', 'release', 'reuse'],
} as const
const REQUIRED = {
  pilot: ['authorization', 'integration', 'recovery', 'technical', 'business'],
  production: ['release', 'adoption', 'acceptance', 'deliverable', 'handover'],
  improvement: ['change', 'impact', 'validation', 'release'],
} as const
const LABELS: Record<string, string> = { authorization: '试点范围与授权', integration: '接入准备', recovery: '接管与恢复', technical: '技术运行证据', business: '试点业务结果', release: '受控发布', adoption: '真实采用', acceptance: '客户验收', deliverable: '交付清单', handover: '责任实操', change: '改进事项', impact: '影响范围', validation: '复测结果' }
type Data = Record<string, unknown>
function object(value: unknown): Data {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('交付记录必须是对象。')
  return value as Data
}
function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 2000) throw new Error(`${label} 必须是 1–2000 字符的文本。`)
  return value.trim()
}
function list(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value) || value.length > 100) throw new Error(`${label} 必须是最多 100 项的数组。`)
  return value
}
function scope(value: unknown): V2DeliveryScope {
  if (value !== 'local' && value !== 'sandbox' && value !== 'pilot' && value !== 'production' && value !== 'prior') throw new Error('环境范围无效。')
  return value
}
function empty(status: 'missing' | 'invalid', message: string): V2DeliverySnapshot {
  return { status, message, version: '', versionCurrent: false, versionFiles: [], environment: { kind: 'prior', label: '尚未登记' }, items: [], reviewBlockers: [message] }
}

/**
 * Validate project-authored records without invoking any runtime or external service.
 * @param root - Registered workspace directory.
 * @param stage - Stage whose fixed record is being projected.
 * @param value - Optional delivery object from that record.
 * @returns File-checked facts, preserving declarations and withholding unsupported passes.
 */
export async function loadDeliveryWorkbench(root: string, stage: V2LifecycleStageId, value: unknown): Promise<V2DeliverySnapshot> {
  if (stage !== 'pilot' && stage !== 'production' && stage !== 'improvement') throw new Error('不是交付阶段。')
  if (value === undefined) return empty('missing', '尚未登记本阶段交付证据；已有文件仍可查看。')
  try {
    const data = object(value)
    if (data.schemaVersion !== 1) throw new Error('delivery.schemaVersion 必须为 1。')
    const version = text(data.version, 'version')
    const environment = object(data.environment)
    const rootPath = await realpath(root)
    const files = new Map<string, { path: string; status: 'present' | 'missing' | 'error'; sha256?: string; message?: string }>()
    let totalBytes = 0
    const evidence = async (input: unknown): Promise<V2DeliveryEvidence[]> => {
      const result: V2DeliveryEvidence[] = []
      for (const raw of list(input, 'evidence')) {
        const ref = object(raw)
        const path = text(ref.path, 'evidence.path')
        const expectedSha256 = text(ref.sha256, 'evidence.sha256')
        if (!/^[a-f0-9]{64}$/.test(expectedSha256)) throw new Error('证据需要原始 SHA-256 摘要。')
        let file = files.get(path)
        if (file === undefined) {
          if (files.size >= 128) throw new Error('本轮引用超过 128 个文件。')
          try {
            if (isAbsolute(path) || path.includes('\\') || path.split('/').some(part => part === '..' || part === '.' || part === '')) throw new Error('只允许项目内相对路径。')
            if (path === `.fde/stages/${stage}.json`) throw new Error('阶段记录不能自证。')
            const resolved = await realpath(join(rootPath, path))
            const rel = relative(rootPath, resolved)
            if (isAbsolute(rel) || rel === '..' || rel.startsWith(`..${sep}`)) throw new Error('证据超出项目目录。')
            const info = await stat(resolved)
            if (!info.isFile() || info.size === 0 || info.size > 8 * 1024 * 1024) throw new Error('证据必须是 8 MiB 内的非空文件。')
            totalBytes += info.size
            if (totalBytes > 32 * 1024 * 1024) throw new Error('证据总量超过 32 MiB。')
            file = { path, status: 'present', sha256: createHash('sha256').update(await readFile(resolved)).digest('hex') }
          } catch (error) {
            file = { path, status: (error as NodeJS.ErrnoException).code === 'ENOENT' ? 'missing' : 'error', message: error instanceof Error ? error.message : String(error) }
          }
          files.set(path, file)
        }
        result.push({ ...file, expectedSha256, current: file.status === 'present' && file.sha256 === expectedSha256 })
      }
      return result
    }
    const versionFiles = await evidence(data.versionFiles)
    const versionCurrent = versionFiles.length > 0 && versionFiles.every(file => file.current)
    const items: V2DeliveryItem[] = []
    for (const raw of list(data.items, 'items')) {
      const row = object(raw)
      const id = text(row.id, 'item.id')
      if (items.some(item => item.id === id)) throw new Error('交付记录 ID 重复。')
      const category = text(row.category, 'category')
      if (!(CATEGORIES[stage] as readonly string[]).includes(category)) throw new Error(`本阶段不支持类别 ${category}。`)
      const declaredStatus = row.status
      if (declaredStatus !== 'unknown' && declaredStatus !== 'pending' && declaredStatus !== 'running' && declaredStatus !== 'passed' && declaredStatus !== 'failed' && declaredStatus !== 'blocked' && declaredStatus !== 'not_applicable') throw new Error('交付状态无效。')
      if (typeof row.required !== 'boolean') throw new Error('required 必须是布尔值。')
      const refs = await evidence(row.evidence)
      const itemVersion = text(row.version, 'item.version')
      const itemScope = scope(row.scope)
      const observedAt = row.observedAt === undefined ? undefined : text(row.observedAt, 'observedAt')
      if (observedAt !== undefined && !Number.isFinite(Date.parse(observedAt))) throw new Error('观察时间必须是有效日期。')
      const owner = row.owner === undefined ? undefined : text(row.owner, 'owner')
      const resultNeedsProof = ['passed', 'running', 'failed', 'not_applicable'].includes(declaredStatus)
      const current = versionCurrent && itemVersion === version && refs.length > 0 && refs.every(file => file.current)
      items.push({
        id, category, title: text(row.title, 'title'), declaredStatus,
        status: resultNeedsProof && (!current || !observedAt || !owner) ? 'stale' : declaredStatus,
        scope: itemScope, version: itemVersion, summary: text(row.summary, 'summary'),
        required: row.required, evidence: refs,
        ...(owner === undefined ? {} : { owner }),
        ...(observedAt === undefined ? {} : { observedAt }),
        ...(row.criterion === undefined ? {} : { criterion: text(row.criterion, 'criterion') }),
        ...(row.nextAction === undefined ? {} : { nextAction: text(row.nextAction, 'nextAction') }),
      })
    }
    const reviewBlockers: string[] = []
    if (!versionCurrent) reviewBlockers.push('候选版本清单缺失或内容已变化，需重新核对证据。')
    const acceptedScope = stage === 'pilot' ? 'pilot' : 'production'
    if (scope(environment.kind) !== acceptedScope) reviewBlockers.push(`当前环境不是${acceptedScope === 'pilot' ? '试点' : '生产'}范围，不能仅依据本地结果评审。`)
    for (const category of REQUIRED[stage]) {
      const group = items.filter(item => item.category === category && item.required)
      if (group.length === 0 || group.some(item => (item.status !== 'passed' && !(category === 'integration' && item.status === 'not_applicable')) || item.scope !== acceptedScope)) reviewBlockers.push(`${LABELS[category]}尚无当前版本、${acceptedScope === 'pilot' ? '试点' : '生产'}范围的必备通过证据。`)
    }
    for (const item of items.filter(item => item.required && item.status !== 'passed' && !(item.category === 'integration' && item.status === 'not_applicable'))) reviewBlockers.push(`${item.title}仍需处理。`)
    let semantic: V2DeliverySnapshot['semantic']
    if (data.semantic !== undefined) {
      const raw = object(data.semantic)
      if (raw.mode !== 'snapshot' && raw.mode !== 'runtime') throw new Error('语义接入方式无效。')
      const refs = await evidence(raw.evidence)
      semantic = { mode: raw.mode, schemaVersion: text(raw.schemaVersion, 'schemaVersion'), graphRevision: text(raw.graphRevision, 'graphRevision'), summary: text(raw.summary, 'semantic.summary'), evidence: refs }
      if (refs.length === 0 || refs.some(file => !file.current)) reviewBlockers.push('语义依赖证据缺失或已变化。')
    }
    return {
      status: 'ready', version, versionCurrent, versionFiles,
      environment: { kind: scope(environment.kind), label: text(environment.label, 'environment.label') },
      items, reviewBlockers, ...(semantic === undefined ? {} : { semantic }),
    }
  } catch (error) {
    return empty('invalid', error instanceof Error ? error.message : String(error))
  }
}
