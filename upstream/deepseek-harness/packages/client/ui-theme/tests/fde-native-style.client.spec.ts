import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

it('lets FDE stage roles inherit the shell theme instead of installing fixed light palettes', () => {
  const css = readFileSync(new URL('../src/styles/fde-evaluation.css', import.meta.url), 'utf8')
  expect(css).not.toContain('data-ds-dark-theme')
  expect(css).not.toMatch(/#[\da-f]{3,8}\b/i)
  expect(css).toContain('--dsw-alias-production-on-dark: var(--dsw-alias-label-primary)')
  expect(css).toContain('--dsw-alias-improvement-review: var(--dsw-alias-state-warn-label)')
})

it('retains explicit warning states while removing invalid legacy display variables', () => {
  for (const name of ['StageWorkbench', 'StageMethodDialog', 'project']) {
    const css = readFileSync(new URL(`../../ui-fde-project/src/client/${name}.module.css`, import.meta.url), 'utf8')
    expect(css).not.toMatch(/--dsw-alias-(?:state-warning|surface-primary|shadow-color)/)
    expect(css).toContain('--dsw-alias-state-warn-')
  }
})
