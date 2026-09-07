/** Read-only stage-five candidate and verification projection over project-owned records. */

import { createHash } from 'node:crypto'
import { readFile, realpath, stat } from 'node:fs/promises'
import { isAbsolute, join, relative, sep } from 'node:path'
import type { V2EvaluationFile, V2EvaluationSnapshot } from './types.ts'

type RecordValue = Record<string, unknown>

function record(value: unknown, label: string): RecordValue {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} 必须是对象。`)
  return value as RecordValue
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '' || value.length > 2_000) throw new Error(`${label} 必须是非空文本，且不超过 2000 字符。`)
  return value.trim()
}

function rows(value: unknown, label: string): RecordValue[] {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > 200) throw new Error(`${label} 必须是最多 200 项的数组。`)
  return value.map(item => record(item, label))
}

function paths(value: unknown, label: string): string[] {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > 100) throw new Error(`${label} 必须是最多 100 项的路径数组。`)
  const result = value.map(item => text(item, label))
  if (new Set(result).size !== result.length) throw new Error(`${label} 含重复路径。`)
  return result
}

function unique(items: RecordValue[], label: string, key = 'id'): void {
  const ids = items.map(item => text(item[key], `${label}.${key}`))
  if (new Set(ids).size !== ids.length) throw new Error(`${label} 含重复 ID。`)
}

function empty(status: V2EvaluationSnapshot['status'], message?: string): V2EvaluationSnapshot {
  return {
    status, ...(message === undefined ? {} : { message }),
    candidate: { summary: '', version: '', sourceFiles: [] },
    testing: { environment: '', current: false, metrics: [] },
    reviewBlockers: [message ?? '尚未登记受测版本与指标；请在 Agent 对话中按实际项目情况补充记录。'],
  }
}

/**
 * Inspect DSH-authored development and test records without running the target project.
 * @param root - Registered project directory.
 * @param value - The evaluation object from the validated stage JSON.
 * @returns Current file-bound results and actionable review blockers.
 */
export async function loadEvaluationWorkbench(root: string, value: unknown): Promise<V2EvaluationSnapshot> {
  if (value === undefined) return empty('missing')
  try {
    const data = record(value, 'evaluation')
    const candidate = record(data.candidate ?? {}, 'candidate')
    const testing = record(data.testing ?? {}, 'testing')
    const rootPath = await realpath(root)
    const files = new Map<string, Promise<V2EvaluationFile>>()
    let totalBytes = 0
    const inspect = async (path: string): Promise<V2EvaluationFile> => {
      try {
        if (files.size >= 256) throw new Error('引用文件超过 256 项，请收窄本轮范围。')
        if (isAbsolute(path) || path.includes('\\') || path.split('/').some(part => part === '..' || part === '' || part === '.')) {
          throw new Error('只允许当前项目内的相对文件路径。')
        }
        if (path === '.fde/stages/evaluation.json') throw new Error('阶段状态不能作为自身的开发或测试证据。')
        const resolved = await realpath(join(rootPath, path))
        const rel = relative(rootPath, resolved)
        if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new Error('引用文件越出当前项目。')
        const info = await stat(resolved)
        if (!info.isFile() || info.size === 0 || info.size > 8 * 1024 * 1024) throw new Error('引用必须是非空普通文件，且不超过 8 MiB。')
        totalBytes += info.size
        if (totalBytes > 32 * 1024 * 1024) throw new Error('本轮引用超过 32 MiB，请使用有边界的版本清单。')
        const bytes = await readFile(resolved)
        return { path, status: 'present', sha256: createHash('sha256').update(bytes).digest('hex') }
      } catch (error) {
        return { path, status: (error as NodeJS.ErrnoException).code === 'ENOENT' ? 'missing' : 'error', message: error instanceof Error ? error.message : String(error) }
      }
    }
    const references = async (value: unknown, label: string): Promise<V2EvaluationFile[]> => {
      const result: V2EvaluationFile[] = []
      for (const path of paths(value, label)) {
        let pending = files.get(path)
        if (pending === undefined) { pending = inspect(path); files.set(path, pending) }
        result.push(await pending)
      }
      return result
    }
    const blockers: string[] = []
    const candidateVersion = candidate.version === undefined ? '' : text(candidate.version, 'candidate.version')
    const summary = candidate.summary === undefined ? '' : text(candidate.summary, 'candidate.summary')
    const sourceFiles = await references(candidate.sourceFiles, 'candidate.sourceFiles')
    if (!candidateVersion) blockers.push('尚未记录本轮受测版本。')
    if (sourceFiles.length === 0 || sourceFiles.some(file => file.status !== 'present')) blockers.push('候选版本文件清单缺失或不可读取。')
    const environment = testing.environment === undefined ? '' : text(testing.environment, 'testing.environment')
    const metricRows = rows(testing.metrics, 'metrics')
    unique(metricRows, 'metrics')
    const definitions = []
    for (const metric of metricRows) {
      if (typeof metric.required !== 'boolean') throw new Error('指标 required 必须是布尔值。')
      definitions.push({
        id: text(metric.id, 'metric.id'), title: text(metric.title, 'metric.title'),
        kind: text(metric.kind, 'metric.kind'), required: metric.required,
        criterion: text(metric.criterion, 'metric.criterion'),
        sources: await references(metric.sourceRefs, 'metric.sourceRefs'),
      })
    }
    if (!environment) blockers.push('尚未明确本轮测试环境。')
    if (!definitions.some(metric => metric.required)) blockers.push('尚未准备必测指标与验收标准。')
    for (const metric of definitions) {
      if (metric.sources.length === 0 || metric.sources.some(file => file.status !== 'present')) blockers.push(`指标缺少可读取的验收依据：${metric.title}`)
    }
    const fingerprint = candidateVersion && sourceFiles.length > 0 && sourceFiles.every(file => file.status === 'present') && environment
      ? `sha256:${createHash('sha256').update(JSON.stringify({ candidateVersion, sourceFiles, environment, metrics: definitions })).digest('hex')}`
      : undefined
    const run = testing.run === undefined ? undefined : record(testing.run, 'testing.run')
    const resultRows = rows(run?.results, 'results')
    unique(resultRows, 'results', 'metricId')
    for (const result of resultRows) {
      if (!definitions.some(metric => metric.id === result.metricId)) throw new Error('测试结果包含未知指标。')
      if (!['NOT_RUN', 'RUNNING', 'PASS', 'WARN', 'FAIL'].includes(String(result.status))) throw new Error('测试结果状态无效。')
    }
    const current = fingerprint !== undefined && run?.fingerprint === fingerprint
    const metrics: V2EvaluationSnapshot['testing']['metrics'][number][] = []
    for (const metric of definitions) {
      const result = resultRows.find(item => item.metricId === metric.id)
      const status = result === undefined ? 'NOT_RUN' : !current ? 'STALE' : result.status as 'NOT_RUN' | 'RUNNING' | 'PASS' | 'WARN' | 'FAIL'
      const evidence = await references(result?.evidenceRefs, 'result.evidenceRefs')
      const resultValue = result?.value === undefined ? '' : text(result.value, 'result.value')
      if (metric.required && status !== 'PASS') blockers.push(`必测项尚未通过${status === 'STALE' ? '（版本已过期）' : ''}：${metric.title}`)
      else if (metric.required && (!resultValue || evidence.length === 0 || evidence.some(file => file.status !== 'present'))) blockers.push(`必测项缺少实际结果或可读取证据：${metric.title}`)
      metrics.push({ ...metric, status, value: resultValue, evidence })
    }
    return {
      status: 'ready', candidate: { summary, version: candidateVersion, sourceFiles },
      testing: { environment, ...(fingerprint === undefined ? {} : { fingerprint }), current, metrics },
      reviewBlockers: blockers,
    }
  } catch (error) {
    return empty('invalid', `版本与测试记录无效：${error instanceof Error ? error.message : String(error)}`)
  }
}
