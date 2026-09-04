import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../src/client/project.module.css', import.meta.url), 'utf8')
const component = readFileSync(new URL('../src/client/DeliveryHomepage.tsx', import.meta.url), 'utf8')

describe('delivery home motion contract', () => {
  it('uses transform and opacity for explanatory entrance and ambient motion', () => {
    expect(component).toContain("transform: 'translateY(16px)'")
    expect(component).toContain("ease: [0.23, 1, 0.32, 1]")
    expect(css).toContain('@keyframes delivery-signal-float')
    expect(css).toContain('@keyframes delivery-evidence-pulse')
    expect(css).toContain('@keyframes delivery-lifecycle-flow')
    expect(css).toContain('@keyframes delivery-final-orbit-flow')
    expect(css).toContain('transform: translate3d(0, -5px, 0)')
  })

  it('removes spatial and looping motion for reduced-motion users', () => {
    const first = css.indexOf('@media (prefers-reduced-motion: reduce)')
    const start = css.indexOf('@media (prefers-reduced-motion: reduce)', first + 1)
    const end = css.indexOf('@media (max-width: 1100px)', start)
    const reducedMotion = css.slice(start, end)
    expect(reducedMotion).toContain('.deliveryEvidenceParticles')
    expect(reducedMotion).toContain('.deliverySignal > div')
    expect(reducedMotion).toContain('.deliveryLifecycleFeedbackPath')
    expect(reducedMotion).toContain('.deliveryFinalOrbitLines')
    expect(reducedMotion).toContain('animation: none')
    expect(reducedMotion).toContain('.deliveryCometSurface { transform: none !important; }')
  })
})
