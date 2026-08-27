/** Browser-local image validation, cover crop, and palette extraction. */

import type { AppearancePalette } from './types.ts'

/** Maximum source-image size accepted before local decoding. */
export const MAX_SOURCE_IMAGE_BYTES = 16 * 1024 * 1024
/** Stable palette used until a custom background yields sampled colors. */
export const DEFAULT_PALETTE: AppearancePalette = ['#3b5891', '#1d2739', '#b0c7e8', '#7091cc']

/** User-correctable rejection returned before browser image decoding. */
export type ImageValidationIssue = 'unsupported-type' | 'too-large'

type RGB = [number, number, number]

/**
 * Return the user-correctable reason a browser file cannot enter the image pipeline.
 * @param file - Browser-selected source image.
 * @returns A stable rejection code, or undefined when accepted.
 */
export function validateImageFile(file: File): ImageValidationIssue | undefined {
  if (!/^image\/(png|jpeg|webp)$/u.test(file.type)) return 'unsupported-type'
  if (file.size > MAX_SOURCE_IMAGE_BYTES) return 'too-large'
  return undefined
}

/**
 * Decode an object, data, or same-origin URL into an image element.
 * @param url - Image URL owned by the current browser page.
 * @returns The fully decoded image element.
 */
export async function loadImage(url: string): Promise<HTMLImageElement> {
  const image = new Image()
  image.decoding = 'async'
  image.src = url
  await image.decode()
  return image
}

/**
 * Cover-crop one image to the runtime 16:9 background.
 * @param image - Decoded browser image.
 * @param focusY - Vertical focal position from 0 through 100.
 * @returns A 1920 by 1080 canvas ready for WebP encoding.
 */
export function renderBackground(image: HTMLImageElement, focusY: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = 1920
  canvas.height = 1080
  const context = canvas.getContext('2d', { alpha: false })
  if (context === null) throw new Error('canvas-unavailable')
  const scale = Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight)
  const width = image.naturalWidth * scale
  const height = image.naturalHeight * scale
  const x = (canvas.width - width) / 2
  const y = (canvas.height - height) * (focusY / 100)
  context.drawImage(image, x, y, width, height)
  return canvas
}

/**
 * Extract a stable four-color theme palette from the processed background.
 * @param canvas - Processed 16:9 background canvas.
 * @returns Accent, deep, mist, and highlight colors.
 */
export function extractPalette(canvas: HTMLCanvasElement): AppearancePalette {
  const sample = document.createElement('canvas')
  sample.width = 80
  sample.height = 45
  const context = sample.getContext('2d', { willReadFrequently: true })
  if (context === null) return DEFAULT_PALETTE
  context.drawImage(canvas, 0, 0, sample.width, sample.height)
  const pixels = context.getImageData(0, 0, sample.width, sample.height).data
  const colors: RGB[] = []
  for (let index = 0; index < pixels.length; index += 16) {
    const color: RGB = [pixels[index] ?? 0, pixels[index + 1] ?? 0, pixels[index + 2] ?? 0]
    if (Math.max(...color) - Math.min(...color) < 7 && (color[0] < 28 || color[0] > 238)) continue
    colors.push(color)
  }
  if (colors.length < 20) return DEFAULT_PALETTE

  const byLightness = [...colors].sort((a, b) => luminance(a) - luminance(b))
  let centers: RGB[] = []
  for (const point of [0.08, 0.34, 0.66, 0.92]) {
    const selected = byLightness[Math.floor((byLightness.length - 1) * point)]
    if (selected === undefined) return DEFAULT_PALETTE
    centers.push([...selected])
  }
  for (let round = 0; round < 7; round += 1) {
    const groups: RGB[][] = centers.map(() => [])
    for (const color of colors) {
      let nearest = 0
      let distance = Number.POSITIVE_INFINITY
      centers.forEach((center, index) => {
        const next = colorDistance(color, center)
        if (next < distance) { nearest = index; distance = next }
      })
      const group = groups[nearest]
      if (group === undefined) return DEFAULT_PALETTE
      group.push(color)
    }
    const nextCenters: RGB[] = []
    for (let index = 0; index < groups.length; index += 1) {
      const group = groups[index]
      const previous = centers[index]
      if (group === undefined || previous === undefined) return DEFAULT_PALETTE
      nextCenters.push(group.length === 0 ? previous : average(group))
    }
    centers = nextCenters
  }
  const ordered = [...centers].sort((a, b) => luminance(a) - luminance(b))
  const deepSource = ordered[0]
  const mistSource = ordered.at(-1)
  const accentSource = [...centers].sort((a, b) => saturation(b) - saturation(a))[0]
  if (deepSource === undefined || mistSource === undefined || accentSource === undefined) return DEFAULT_PALETTE
  const highlightSource = centers
    .filter(color => color !== deepSource && color !== accentSource)
    .sort((a, b) => Math.abs(luminance(a) - 145) - Math.abs(luminance(b) - 145))[0] ?? mistSource
  return [
    rgbToHex(normalizeThemeColor(accentSource, 0.42, 0.40)),
    rgbToHex(normalizeThemeColor(deepSource, 0.26, 0.17)),
    rgbToHex(normalizeThemeColor(mistSource, 0.20, 0.80)),
    rgbToHex(normalizeThemeColor(highlightSource, 0.34, 0.62)),
  ]
}

function luminance([r, g, b]: RGB): number { return 0.2126 * r + 0.7152 * g + 0.0722 * b }
function saturation(color: RGB): number { return Math.max(...color) - Math.min(...color) }
function colorDistance(a: RGB, b: RGB): number { return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2 }
function average(group: RGB[]): RGB {
  return [averageChannel(group, 0), averageChannel(group, 1), averageChannel(group, 2)]
}
function averageChannel(group: RGB[], channel: 0 | 1 | 2): number {
  return Math.round(group.reduce((sum, color) => sum + color[channel], 0) / group.length)
}
function rgbToHex(color: RGB): string { return `#${color.map(value => value.toString(16).padStart(2, '0')).join('')}` }
function normalizeThemeColor(rgb: RGB, minimumSaturation: number, lightness: number): RGB {
  const [hue, saturationValue] = rgbToHsl(rgb)
  return hslToRgb([hue, Math.max(minimumSaturation, saturationValue), lightness])
}
function rgbToHsl([red, green, blue]: RGB): [number, number, number] {
  const [r, g, b] = [red / 255, green / 255, blue / 255]
  const maximum = Math.max(r, g, b)
  const minimum = Math.min(r, g, b)
  const delta = maximum - minimum
  let hue = 0
  if (delta !== 0) {
    if (maximum === r) hue = ((g - b) / delta) % 6
    else if (maximum === g) hue = (b - r) / delta + 2
    else hue = (r - g) / delta + 4
    hue /= 6
    if (hue < 0) hue += 1
  }
  const lightness = (maximum + minimum) / 2
  const saturationValue = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1))
  return [hue, saturationValue, lightness]
}
function hslToRgb([hue, saturationValue, lightness]: [number, number, number]): RGB {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturationValue
  const segment = hue * 6
  const x = chroma * (1 - Math.abs(segment % 2 - 1))
  let rgb: [number, number, number] = [0, 0, 0]
  if (segment < 1) rgb = [chroma, x, 0]
  else if (segment < 2) rgb = [x, chroma, 0]
  else if (segment < 3) rgb = [0, chroma, x]
  else if (segment < 4) rgb = [0, x, chroma]
  else if (segment < 5) rgb = [x, 0, chroma]
  else rgb = [chroma, 0, x]
  const match = lightness - chroma / 2
  return rgb.map(value => Math.round((value + match) * 255)) as RGB
}
