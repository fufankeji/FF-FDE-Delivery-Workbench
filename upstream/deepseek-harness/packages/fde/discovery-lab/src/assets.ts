/** Validate the fixed teaching material shipped with both source and package distributions. */
import { createHash } from 'node:crypto'
import { lstatSync, readFileSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'

const CASE_IDS = ['finance', 'internal-service', 'logistics', 'manufacturing', 'operations']
const REQUIRED = [
  ...CASE_IDS.map(id => `cases/${id}/case.json`),
  'cases/calculate_reference.py', 'cases/check_discoveries.py',
  'cases/calculations_finance_deepening.py', 'cases/calculations_internal_service.py',
  'cases/calculations_logistics.py', 'cases/calculations_operations.py',
  'development/fonts/NotoSansCJKsc-Regular.otf', 'development/fonts/LICENSE', 'THIRD_PARTY_NOTICES.md',
]

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Check the shipped manifest, every file digest and every case's referenced original.
 * @param packageRoot - directory containing assets and assets-manifest.json, never a training data directory.
 * @returns validated file and case counts; performs no writes or model requests.
 * @throws when a required file is missing, changed, linked or outside the material directory.
 */
export function verifyBundledAssets(packageRoot: string): { files: number; bytes: number; cases: number; references: number } {
  const root = resolve(packageRoot, 'assets')
  const manifest: unknown = JSON.parse(readFileSync(join(packageRoot, 'assets-manifest.json'), 'utf8'))
  if (!record(manifest) || manifest.schemaVersion !== 1 || !Array.isArray(manifest.files)) throw new Error('实验室素材清单无效')
  const files = new Map<string, { bytes: number; sha256: string }>()
  let bytes = 0
  for (const item of manifest.files) {
    if (!record(item) || typeof item.path !== 'string' || typeof item.bytes !== 'number'
      || !Number.isSafeInteger(item.bytes) || item.bytes < 0 || typeof item.sha256 !== 'string'
      || !/^[a-f0-9]{64}$/.test(item.sha256)) throw new Error('实验室素材清单条目无效')
    const path = resolve(root, item.path)
    if (!path.startsWith(root + sep) || item.path.includes('\\') || item.path.split('/').includes('..') || files.has(item.path)) {
      throw new Error('实验室素材路径无效')
    }
    let current = root
    for (const part of item.path.split('/')) {
      current = join(current, part)
      if (lstatSync(current).isSymbolicLink()) throw new Error(`实验室素材不允许符号链接：${item.path}`)
    }
    const data = readFileSync(path)
    if (data.length !== item.bytes || createHash('sha256').update(data).digest('hex') !== item.sha256) {
      throw new Error(`实验室素材校验失败：${item.path}`)
    }
    files.set(item.path, { bytes: item.bytes, sha256: item.sha256 })
    bytes += data.length
  }
  for (const name of REQUIRED) if (!files.has(name)) throw new Error(`实验室缺少必需素材：${name}`)
  let references = 0
  for (const id of CASE_IDS) {
    const value: unknown = JSON.parse(readFileSync(join(root, 'cases', id, 'case.json'), 'utf8'))
    if (!record(value) || value.id !== id || !Array.isArray(value.assets)) throw new Error(`实验室案例无效：${id}`)
    for (const asset of value.assets) {
      if (!record(asset) || typeof asset.path !== 'string' || !asset.path.startsWith('source-materials/')) throw new Error(`实验室资料引用无效：${id}`)
      const file = files.get(asset.path)
      if (file === undefined || file.sha256 !== asset.sha256 || file.bytes !== asset.sizeBytes) throw new Error(`实验室资料未完整交付：${asset.path}`)
      references++
    }
  }
  return { files: files.size, bytes, cases: CASE_IDS.length, references }
}
