import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

it('adds native caption clearance only to windowed macOS navigation at both rail widths', () => {
  const css = readFileSync(new URL('../src/client/workbench.module.css', import.meta.url), 'utf8')
  const selector = ":global(html[data-platform='darwin']:not([data-fullscreen])) .navigation"
  const rules = css.split(selector).slice(1).map(part => part.slice(part.indexOf('{') + 1, part.indexOf('}')).trim())
  expect(rules).toEqual([
    'padding-top: calc(20px + var(--dsh-frame-top-clearance, 0px));',
    'padding-top: calc(22px + var(--dsh-frame-top-clearance, 0px));',
  ])
  expect(css.indexOf(selector, css.indexOf(selector) + selector.length)).toBeGreaterThan(css.indexOf('@media (max-width: 640px)'))
  expect(css.match(/\.navigation\s*\{([^}]+)\}/)?.[1]).toContain('padding: 20px 12px')
  expect(css).toContain('.navigation { padding: 22px 8px 12px; }')
  expect(css).not.toMatch(/--dsh-frame-top-clearance\s*:/)
  expect(css.match(/\.brand img\s*\{([^}]+)\}/)?.[1]).toContain('width: 35px; height: 35px;')
})

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
