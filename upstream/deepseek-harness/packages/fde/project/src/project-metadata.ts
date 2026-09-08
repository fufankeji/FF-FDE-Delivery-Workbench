/** Project-owned company and estimated delivery dates; independent of stage approval. */

import { lstat, mkdir, readFile, realpath } from 'node:fs/promises'
import { join } from 'node:path'
import { withFileLock, writeFileAtomic } from '@deepseek-ai/dsh-atomic-write'

/** Persisted project creation facts shared by all browsers. */
export interface ProjectMetadata {
  readonly companyName: string
  readonly schedule: { readonly status: 'pending-confirmation' } | {
    readonly status: 'estimated'
    readonly startDate: string
    readonly endDate: string
  }
}

/** Validate browser input and on-disk dates without inferring missing facts. */
export function parseProjectMetadata(value: unknown): ProjectMetadata {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('项目基础信息无效。')
  const record = value as Record<string, unknown>
  if (typeof record.companyName !== 'string' || record.companyName.length > 500) throw new Error('企业名称无效。')
  const schedule = record.schedule as Record<string, unknown> | undefined
  if (schedule?.status === 'pending-confirmation') return { companyName: record.companyName.trim(), schedule: { status: 'pending-confirmation' } }
  const validDate = (date: unknown): date is string => typeof date === 'string'
    && /^\d{4}-\d{2}-\d{2}$/u.test(date)
    && Number.isFinite(Date.parse(`${date}T00:00:00Z`))
    && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date
  if (schedule?.status !== 'estimated' || !validDate(schedule.startDate) || !validDate(schedule.endDate) || schedule.startDate > schedule.endDate) {
    throw new Error('预计交付周期需要有效日期，结束日期不能早于开始日期。')
  }
  return { companyName: record.companyName.trim(), schedule: { status: 'estimated', startDate: schedule.startDate, endDate: schedule.endDate } }
}

function absent(error: unknown): boolean { return (error as NodeJS.ErrnoException).code === 'ENOENT' }

async function metadataPath(root: string, create: boolean): Promise<string | undefined> {
  const directory = join(await realpath(root), '.fde')
  if (create) await mkdir(directory, { recursive: true, mode: 0o700 })
  let info
  try { info = await lstat(directory) } catch (error) { if (absent(error)) return undefined; throw error }
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('项目基础信息目录必须是项目内的真实目录。')
  return join(directory, 'project-metadata.json')
}

/** Read registered project facts; missing files remain absent and corrupt files fail visibly. */
export async function readProjectMetadata(root: string): Promise<ProjectMetadata | null> {
  const path = await metadataPath(root, false)
  if (path === undefined) return null
  let info
  try { info = await lstat(path) } catch (error) { if (absent(error)) return null; throw error }
  if (!info.isFile() || info.isSymbolicLink() || info.size > 16 * 1024) throw new Error('项目基础信息文件无效或过大。')
  return parseProjectMetadata(JSON.parse(await readFile(path, 'utf8')) as unknown)
}

/** Import creation or legacy browser facts only when no project record exists. */
export async function ensureProjectMetadata(root: string, value: unknown): Promise<ProjectMetadata> {
  const parsed = parseProjectMetadata(value)
  const path = await metadataPath(root, true)
  if (path === undefined) throw new Error('项目基础信息目录不可用。')
  return await withFileLock(path, async () => {
    const current = await readProjectMetadata(root)
    if (current !== null) return current
    await writeFileAtomic(path, `${JSON.stringify(parsed, null, 2)}\n`, { mode: 0o600, dirMode: 0o700 })
    return parsed
  })
}
