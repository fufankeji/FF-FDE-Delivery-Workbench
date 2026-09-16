import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { expect, it } from 'vitest'

const DIST_ROOT = fileURLToPath(new URL('../dist', import.meta.url))

it('ships install metadata with the built web application', async () => {
  const index = await readFile(join(DIST_ROOT, 'index.html'), 'utf8')
  expect(index).toContain('<link rel="manifest" href="./manifest.webmanifest" />')

  const manifest: unknown = JSON.parse(await readFile(join(DIST_ROOT, 'manifest.webmanifest'), 'utf8'))
  expect(manifest).toEqual({
    id: '/',
    name: 'FF - FDE 交付工作台',
    short_name: 'FF-FDE',
    start_url: '/',
    scope: '/',
    display: 'fullscreen',
    icons: [{
      src: '/ff-brand/ff-logo.png',
      sizes: '300x300',
      type: 'image/png',
      purpose: 'any',
    }],
  })
})

it('ships the unmodified FF brand icon for browser tabs', async () => {
  const index = await readFile(join(DIST_ROOT, 'index.html'), 'utf8')
  expect(index).toContain('href="/ff-brand/ff-logo.png"')
  expect(index).not.toContain('href="/favicon.svg"')
  const favicon = await readFile(join(DIST_ROOT, 'ff-brand/ff-logo.png'))
  expect(createHash('sha256').update(favicon).digest('hex')).toBe('522944bbaee48d98190c8c5a0a0ac80f05b71b1975838807742a782e2aeceedc')
})
