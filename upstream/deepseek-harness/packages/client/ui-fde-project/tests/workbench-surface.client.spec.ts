import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

it('distinguishes selected destinations and keeps group captions out of the compact rail', () => {
  const css = readFileSync(new URL('../src/client/workbench.module.css', import.meta.url), 'utf8')
  expect(css).toContain(".navItem[aria-current='page'] { background: var(--dsw-alias-interactive-bg-active); }")
  expect(css).toContain(".nativeNavigation :global(button[aria-current='page']) { color: var(--dsw-alias-state-business-primary); font-weight: 500; }")
  const compact = css.slice(css.indexOf('@media (max-width: 640px)'))
  expect(compact).toContain('.groupLabel, .navBottom small { display: none; }')
  expect(compact).toContain('.introLink { width: 100%; margin: 8px 0 0; font-size: 11px; text-align: center; }')
})

it('keeps the extra native entries scrollable and hides the covered original sidebar from interaction', () => {
  const css = readFileSync(new URL('../src/client/workbench.module.css', import.meta.url), 'utf8')
  expect(css).toContain('.navScroll { flex: 1; min-height: 0; overflow-y: auto; }')
  expect(css).toContain(":global(body[data-fde-workbench='open'] [data-native-sidebar]) { visibility: hidden; pointer-events: none; }")
  expect(css).toContain('.nativeNavigation nav { margin-top: 0; }')
  expect(css).toContain(":global(body[data-fde-native-panel='open'] [data-shell-frame])")
  expect(css).toContain('grid-template-columns: var(--fde-navigation-width) minmax(0, 1fr) 0 !important;')
  expect(css).toContain('[data-shell-sidebar], [data-rightbar-col], [data-side], [data-shell-leading], [data-sidebar-mask], [data-shell-bottom]')
})

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
