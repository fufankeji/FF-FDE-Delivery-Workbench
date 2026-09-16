import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../src/client/project.module.css', import.meta.url), 'utf8')

describe('delivery home theme contract', () => {
  it('keeps the light homepage palette independent of the workbench theme', () => {
    expect(css).not.toMatch(/:global\(body\[data-ds-dark-theme\]\)\s+\.deliveryHomepage\s*\{/)
    expect(css).toContain('--home-canvas: #fbfbfd;')
    expect(css).toContain('--home-ink: #111827;')
  })

  it('scopes the paired dark surface and text colors to the workbench preview', () => {
    const preview = css.match(/:global\(body\[data-ds-dark-theme\]\)\s+\.deliveryPreviewWindow\s*\{([^}]+)\}/)?.[1]
    expect(preview).toBeDefined()
    expect(preview).toContain('--home-window: #0e1014;')
    expect(preview).toContain('--home-window-ink: #edf0f5;')
  })
})
