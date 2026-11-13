/** Installed default GUI composition, independent of any developer profile. */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { EntryOptions } from '@deepseek-ai/cordis-plugin-loader'
import { composeEntries, initProfile, loadProfile, loadProfileDirectory } from '@deepseek-ai/dsh-app-boot'
import { expect, it, onTestFinished } from 'vitest'

const anchor = fileURLToPath(new URL('../package.json', import.meta.url))

function home(): string {
  const path = mkdtempSync(join(tmpdir(), 'fde-default-context-'))
  onTestFinished(() => { rmSync(path, { recursive: true, force: true }) })
  return path
}

function contextEntries(rows: readonly EntryOptions[]): EntryOptions[] {
  return rows.flatMap(row => [
    ...(row.name === 'dsh-context' ? [row] : []),
    ...(row.group && Array.isArray(row.config) ? contextEntries(row.config) : []),
  ])
}

it('resolves the pinned context plugin and enables exactly one entry in a fresh Web profile', () => {
  const manifest = JSON.parse(readFileSync(anchor, 'utf8')) as { dependencies: Record<string, string> }
  expect(manifest.dependencies['dsh-context']).toBe('0.83.1')
  const plugin = JSON.parse(readFileSync(createRequire(anchor).resolve('dsh-context/package.json'), 'utf8')) as {
    version: string; dsh: { client: { platform: string } }
  }
  expect(plugin.version).toBe('0.83.1')
  expect(plugin.dsh.client.platform).toBe('web')
  const profile = loadProfile('dsh', 'web', anchor, home())
  expect(profile.skippedBundles).toEqual([])
  expect(profile.layers.filter(layer => layer.packageName === 'dsh-context')).toHaveLength(1)
  const entries = contextEntries(composeEntries([...profile.layers.map(layer => layer.patches), profile.patches]))
  expect(entries).toHaveLength(1)
  expect(entries[0]).toMatchObject({ id: 'dsh-context', name: 'dsh-context' })
  expect(entries[0]?.disabled).not.toBe(true)
})

it('preserves an installed profile and its explicit context disable patch without a duplicate entry', () => {
  const dir = join(home(), 'profiles', 'desktop')
  initProfile(dir, ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', 'dsh-context'])
  const patchPath = join(dir, 'cordis.patch.yml')
  writeFileSync(patchPath, JSON.stringify([{ id: 'dsh-context', disabled: true }]))
  const original = readFileSync(join(dir, 'package.json'), 'utf8')
  const profile = loadProfileDirectory('dsh', dir, anchor)
  expect(profile.skippedBundles).toEqual([])
  const entries = contextEntries(composeEntries([...profile.layers.map(layer => layer.patches), profile.patches]))
  expect(entries).toHaveLength(1)
  expect(entries[0]?.disabled).toBe(true)
  expect(readFileSync(join(dir, 'package.json'), 'utf8')).toBe(original)
})

it('does not overwrite an existing Web profile whose user has removed context', () => {
  const root = home()
  const dir = join(root, 'profiles', 'web')
  initProfile(dir, ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app'])
  const original = readFileSync(join(dir, 'package.json'), 'utf8')
  const profile = loadProfile('dsh', 'web', anchor, root)
  expect(profile.skippedBundles).toEqual([])
  expect(profile.layers.some(layer => layer.packageName === 'dsh-context')).toBe(false)
  expect(readFileSync(join(dir, 'package.json'), 'utf8')).toBe(original)
})
