/** Shipped material completeness, not developer-local imports, controls availability. */
import { afterEach, expect, it } from 'vitest'
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { verifyBundledAssets } from '../src/assets.ts'

const packageRoot = fileURLToPath(new URL('../', import.meta.url))
let directory: string | undefined
afterEach(() => { if (directory !== undefined) rmSync(directory, { recursive: true, force: true }); directory = undefined })

function fixture(): string {
  directory = mkdtempSync(join(tmpdir(), 'fde-lab-assets-'))
  cpSync(join(packageRoot, 'assets'), join(directory, 'assets'), { recursive: true })
  cpSync(join(packageRoot, 'assets-manifest.json'), join(directory, 'assets-manifest.json'))
  return directory
}

it('ships all five cases, their 234 originals, calculation modules and licensed font', () => {
  expect(verifyBundledAssets(packageRoot)).toEqual({ files: 248, bytes: 36654779, cases: 5, references: 234 })
  const manifest = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')) as { files: string[] }
  expect(manifest.files).toEqual(expect.arrayContaining(['assets', 'assets-manifest.json', 'THIRD_PARTY_NOTICES.md']))
})

it('rejects another missing case even when the finance case exists', () => {
  const root = fixture()
  rmSync(join(root, 'assets/cases/operations/case.json'))
  expect(() => verifyBundledAssets(root)).toThrow(/ENOENT/)
})

it('rejects a changed original instead of treating an existing directory as complete', () => {
  const root = fixture()
  writeFileSync(join(root, 'assets/cases/finance/case.json'), '{}')
  expect(() => verifyBundledAssets(root)).toThrow('实验室素材校验失败：cases/finance/case.json')
})

it('rejects an omitted required file in the manifest', () => {
  const root = fixture()
  const file = join(root, 'assets-manifest.json')
  const manifest = JSON.parse(readFileSync(file, 'utf8')) as { files: { path: string }[] }
  manifest.files = manifest.files.filter(row => row.path !== 'development/fonts/LICENSE')
  writeFileSync(file, JSON.stringify(manifest))
  expect(() => verifyBundledAssets(root)).toThrow('实验室缺少必需素材：development/fonts/LICENSE')
})

it('rejects an original excluded from the delivery list but still referenced by a case', () => {
  const root = fixture()
  const file = join(root, 'assets-manifest.json')
  const manifest = JSON.parse(readFileSync(file, 'utf8')) as { files: { path: string }[] }
  const original = manifest.files.find(row => row.path.startsWith('source-materials/'))!
  manifest.files = manifest.files.filter(row => row !== original)
  writeFileSync(file, JSON.stringify(manifest))
  expect(() => verifyBundledAssets(root)).toThrow('实验室资料未完整交付：')
})
