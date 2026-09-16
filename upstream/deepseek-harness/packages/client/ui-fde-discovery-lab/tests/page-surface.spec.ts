import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

it('makes the full-page surface opaque even when a skin supplies a translucent base color', () => {
  const css = readFileSync(new URL('../src/client/lab.module.css', import.meta.url), 'utf8')
  const page = css.match(/\.page\s*\{([^}]+)\}/)?.[1]
  expect(page).toBeDefined()
  // Keep a system-color fallback, then reuse the theme RGB with alpha explicitly reset.
  expect(page).toMatch(/background:\s*Canvas;\s*background:\s*rgb\(from var\(--dsw-alias-bg-base\) r g b \/ 1\)/)
})
