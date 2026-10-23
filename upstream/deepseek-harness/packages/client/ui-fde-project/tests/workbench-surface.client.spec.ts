import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

it.each([
  ['ui-fde-project', 'workbench', '.projectMetric'],
  ['ui-fde-project', 'workbench', '.recent'],
  ['ui-fde-project', 'workbench', '.skillsCard'],
  ['ui-fde-discovery-lab', 'lab', '.labMetric, .casesMetric'],
  ['ui-fde-discovery-lab', 'lab', '.summaryCard'],
])('keeps %s %s %s visibly bounded in the overview', (packageName, stylesheet, selector) => {
  const css = readFileSync(new URL(`../../${packageName}/src/client/${stylesheet}.module.css`, import.meta.url), 'utf8')
  const start = css.indexOf(`${selector} {`)
  expect(start).toBeGreaterThanOrEqual(0)
  const surface = css.slice(start, css.indexOf('}', start)).replace(/\s+/g, '')
  expect(surface).toContain('border:.5pxsolidvar(--dsw-alias-border-l4)')
  expect(surface).toContain('border-radius:var(--dsw-radius-lg)')
  expect(surface).toContain('box-sizing:border-box')
  expect(surface).toMatch(/background:var\(--dsw-alias-bg-(layer-1|module-platform)\)/)
  expect(surface).not.toContain('box-shadow:')
})

it('keeps retained work surfaces behind an opaque skin backing without changing theme preferences', () => {
  const css = readFileSync(new URL('../src/client/workbench.module.css', import.meta.url), 'utf8')
  const backdrop = css.match(/\.backdrop\s*\{([^}]+)\}/)?.[1]
  expect(backdrop).toContain('background-color: rgb(from var(--dsw-alias-bg-base) r g b / 1)')
  expect(backdrop).toContain('var(--fde-background-image, none)')
  expect(backdrop).toContain('var(--fde-background-position, 50%)')
  expect(backdrop).toContain('pointer-events: none')
  expect(backdrop).toContain('z-index: 39')
  const frame = css.match(/\.frame\s*\{([^}]+)\}/)?.[1]
  expect(frame).toContain('z-index: 40')
  expect(frame).toContain('background: transparent')
  expect(css).not.toContain('data-ds-dark-theme')
})
