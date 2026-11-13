import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { expect, it } from 'vitest'
import { chromium, type Page } from 'playwright'
import {
  APP_ICON_VARIANTS, ICON_OUTPUT_DIRECTORY, MASKABLE_ARTWORK_SCALE, MASKABLE_SAFE_RADIUS_RATIO,
  TILE_SOURCE, tileDocument,
} from '../scripts/render-app-icons.ts'

const DIST_ROOT = fileURLToPath(new URL('../dist', import.meta.url))

async function pixels(page: Page, url: string, size: number) {
  return page.evaluate(async ({ url, size }) => {
    const image = new Image()
    image.src = url
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    const context = canvas.getContext('2d')!
    context.drawImage(image, 0, 0, size, size)
    const { data } = context.getImageData(0, 0, size, size)
    let radius = 0
    let ink = 0
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const at = (y * size + x) * 4
        if (data[at + 3] === 0 || data[at]! + data[at + 1]! + data[at + 2]! >= 384) continue
        ink += 1
        radius = Math.max(radius, Math.hypot(x - (size - 1) / 2, y - (size - 1) / 2))
      }
    }
    return {
      width: image.naturalWidth, height: image.naturalHeight, radius, ink,
      corners: [0, size - 1, (size - 1) * size, size * size - 1].map(index => data[index * 4 + 3]),
    }
  }, { url, size })
}

function pngUrl(png: Buffer): string {
  return `data:image/png;base64,${png.toString('base64')}`
}

function svgUrl(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}

it('ships install metadata with the built web application', async () => {
  const index = await readFile(join(DIST_ROOT, 'index.html'), 'utf8')
  expect(index).toContain('<meta name="viewport" content="width=device-width, initial-scale=1" />')
  expect(index).toContain('<link rel="manifest" href="./manifest.webmanifest" />')
  expect(index).toContain('<link rel="apple-touch-icon" href="./apple-touch-icon.png" />')
  expect(index).toContain('<meta name="mobile-web-app-capable" content="yes" />')
  expect(index).toContain('<meta name="apple-mobile-web-app-title" content="DSH" />')
  // No `theme-color` here: `ThemePresenter` owns the single metadata node and
  // follows the resolved in-application theme, which a static media query
  // cannot. The manifest's `theme_color` covers the surrounding chrome before
  // the presenter runs, and `settings-chrome.e2e.ts` pins the live contract.

  const manifest: unknown = JSON.parse(await readFile(join(DIST_ROOT, 'manifest.webmanifest'), 'utf8'))
  // No `id`: a browser resolves an explicit `id` against the start URL's origin,
  // so only an absent `id`, which defaults to the resolved `start_url`, gives
  // each mount its own identity. `public-mount.e2e.ts` reads the resolved form.
  expect(manifest).toEqual({
    name: 'FF - FDE 交付工作台',
    short_name: 'FF-FDE',
    start_url: './',
    scope: './',
    display: 'standalone',
    icons: [{
      src: 'ff-brand/ff-logo.png',
      sizes: '300x300',
      type: 'image/png',
      purpose: 'any',
    }],
  })
})

it('ships the unmodified FF brand icon for browser tabs', async () => {
  const index = await readFile(join(DIST_ROOT, 'index.html'), 'utf8')
  expect(index).toContain('href="./ff-brand/ff-logo.png"')
  expect(index).not.toContain('href="/favicon.svg"')
  const favicon = await readFile(join(DIST_ROOT, 'ff-brand/ff-logo.png'))
  expect(createHash('sha256').update(favicon).digest('hex')).toBe('522944bbaee48d98190c8c5a0a0ac80f05b71b1975838807742a782e2aeceedc')
})

it('preserves fractional coverage along the Apple icon curves', async () => {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage()
    const png = await readFile(join(ICON_OUTPUT_DIRECTORY, 'apple-touch-icon.png'))
    const tile = tileDocument(await readFile(TILE_SOURCE, 'utf8'))
    const [generated, direct] = await page.evaluate(async sources => Promise.all(sources.map(async (source) => {
      const image = new Image()
      image.src = source
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 180
      const context = canvas.getContext('2d')!
      context.drawImage(image, 0, 0, 180, 180)
      const { data } = context.getImageData(0, 0, 180, 180)
      const brightness = (x: number, y: number): number => {
        const at = (y * 180 + x) * 4
        return (data[at]! + data[at + 1]! + data[at + 2]!) / 3
      }
      let partial = 0
      for (let y = 1; y < 179; y += 1) {
        for (let x = 1; x < 179; x += 1) {
          const value = brightness(x, y)
          if (value <= 85 || value >= 200) continue
          // Neighboring ink and background distinguish edge coverage from the
          // source's gradients and shadows, which remain in both renderings.
          const neighbors: number[] = []
          for (let dy = -1; dy <= 1; dy += 1) {
            for (let dx = -1; dx <= 1; dx += 1) neighbors.push(brightness(x + dx, y + dy))
          }
          if (Math.min(...neighbors) < 70 && Math.max(...neighbors) > 220) partial += 1
        }
      }
      return partial
    })), [`data:image/png;base64,${png.toString('base64')}`, `data:image/svg+xml;base64,${Buffer.from(tile).toString('base64')}`])
    expect(generated!).toBeGreaterThan(direct!)
  } finally { await browser.close() }
})

it('keeps the shipped maskable artwork inside its opaque platform safe zone', async () => {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage()
    const maskable = await readFile(join(DIST_ROOT, 'icon-maskable-512.png'))
    const tile = tileDocument(await readFile(TILE_SOURCE, 'utf8'))
    const size = APP_ICON_VARIANTS.find(variant => variant.kind === 'maskable')!.size
    const scaled = await pixels(page, pngUrl(maskable), size)
    const unscaled = await pixels(page, svgUrl(tile), size)
    expect(scaled.radius).toBeLessThanOrEqual(MASKABLE_SAFE_RADIUS_RATIO * size)
    expect(scaled.radius).toBeGreaterThan(unscaled.radius * MASKABLE_ARTWORK_SCALE - 2)
    expect(scaled.corners).toEqual([255, 255, 255, 255])
    expect(unscaled.radius).toBeGreaterThan(MASKABLE_SAFE_RADIUS_RATIO * size)
  } finally {
    await browser.close()
  }
})
