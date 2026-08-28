import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const styles = readFileSync(new URL('../src/client/stage.module.css', import.meta.url), 'utf8')

describe('FDE blank-stage geometry', () => {
  it('uses the same width axis and side clearance as the composer card', () => {
    const block = /\.blankStatus\s*\{(?<body>[^}]*)\}/u.exec(styles)?.groups?.body
    expect(block).toContain('var(--dsh-composer-side-clearance)')
    expect(block).toContain('max-width: var(--dsh-composer-card-max-width)')
    expect(block).toContain('margin: 0 auto')
    expect(block).toContain('min-height: 54px')
    expect(styles).not.toContain('.blankStageRail')
  })
})
