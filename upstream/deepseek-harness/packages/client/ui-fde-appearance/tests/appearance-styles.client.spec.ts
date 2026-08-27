import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const styles = readFileSync(new URL('../src/client/AppearanceSection.module.css', import.meta.url), 'utf8')

describe('FDE skin sidebar projection', () => {
  it('keeps one translucent sidebar layer and removes the duplicate slot fill', () => {
    const block = /:global\(body\[data-fde-skin='active'\] \[data-slot='sidebar'\] > \*\)\s*\{(?<body>[^}]*)\}/u
      .exec(styles)?.groups?.body
    expect(block).toContain('background: transparent !important')
    expect(block).toContain('backdrop-filter: blur(14px) saturate(1.08)')
  })
})
