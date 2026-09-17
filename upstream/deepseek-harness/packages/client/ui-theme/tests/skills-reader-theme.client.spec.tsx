// @vitest-environment jsdom
/** Skill palette selectors must reach the body-portaled reader in both themes. */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { Modal } from '@deepseek-ai/dsh-client-ui-primitives'

const css = readFileSync(resolve(import.meta.dirname, '../src/styles/design-platform.css'), 'utf8')

afterEach(() => { cleanup(); document.body.removeAttribute('data-ds-dark-theme') })

it.each([false, true])('applies the library palette to its portaled reader only (dark: %s)', (dark) => {
  if (dark) document.body.setAttribute('data-ds-dark-theme', '')
  const view = render(<><style>{css}</style><main data-skills-center>
    <Modal open headless onClose={() => {}} title="Skill reader"><div data-skill-reader /></Modal>
    <Modal open headless onClose={() => {}} title="Other dialog"><div /></Modal>
  </main></>)
  const dialog = screen.getByRole('dialog', { name: 'Skill reader' })
  const library = view.container.querySelector('[data-skills-center]')!
  const palette = getComputedStyle(dialog)

  expect(library.contains(dialog)).toBe(false)
  for (const name of ['card', 'canvas', 'ink', 'muted', 'border', 'accent']) {
    expect(palette.getPropertyValue(`--dsw-alias-skills-${name}`)).toBe(getComputedStyle(library).getPropertyValue(`--dsw-alias-skills-${name}`))
  }
  expect(palette.getPropertyValue('--dsw-alias-skills-card')).toBe(dark ? 'var(--dsw-alias-bg-layer-1)' : '#fff')
  expect(palette.getPropertyValue('--dsw-alias-skills-canvas')).toBe(dark ? 'var(--dsw-alias-bg-base)' : '#f3faff')
  expect(palette.getPropertyValue('--dsw-alias-skills-ink')).toBe(dark ? 'var(--dsw-alias-label-primary)' : '#10192c')
  expect(getComputedStyle(screen.getByRole('dialog', { name: 'Other dialog' })).getPropertyValue('--dsw-alias-skills-card')).toBe('')
})
