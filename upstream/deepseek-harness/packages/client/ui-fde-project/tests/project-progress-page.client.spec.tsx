// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { ProjectProgressOverlay } from '../src/client/ProjectProgressOverlay.tsx'
import { zh } from '../src/client/locales.ts'
import type { ProjectProgressOverlayProps } from '../src/client/slots.ts'

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class {
    observe(): void {}
    disconnect(): void {}
  })
})

afterEach(() => { cleanup(); vi.unstubAllGlobals(); delete document.body.dataset.fdePage })

const hook = <T,>(value: T) => <S,>(selector: (state: T) => S) => selector(value)

describe('ProjectProgressOverlay standalone page', () => {
  it('hides the center/details work surfaces while open and restores them on close', () => {
    const frame = document.createElement('div')
    const sidebar = document.createElement('div')
    const center = document.createElement('div')
    const details = document.createElement('div')
    const overlay = document.createElement('div')
    frame.append(sidebar, center, details, overlay)
    document.body.append(frame)
    const props = {
      useProjectPage: hook({ open: true, view: 'overview' as const }),
      useStageProgress: hook({ byWorkspace: {} }),
      useProjectSources: hook({ byWorkspace: {} }),
      useWorkspaces: hook({ items: [] }),
      useSessions: hook({ byId: {} }),
      loadStage: vi.fn(), retryStage: vi.fn(), loadProjectSources: vi.fn(), parseProjectSource: vi.fn(),
      enterProject: vi.fn(), closeProjectPage: vi.fn(), showProjectOverview: vi.fn(),
      showProjectTimeline: vi.fn(), showProjectDetail: vi.fn(), renderSlot: vi.fn(() => null),
      t: makeTranslate(zh),
    } as unknown as ProjectProgressOverlayProps
    const view = render(<ProjectProgressOverlay {...props} />, { container: overlay })
    expect(document.body.dataset.fdePage).toBe('project-progress')
    expect(center.style.visibility).toBe('hidden')
    expect(details.style.visibility).toBe('hidden')
    expect(center.getAttribute('aria-hidden')).toBe('true')
    view.unmount()
    expect(document.body.dataset.fdePage).toBeUndefined()
    expect(center.style.visibility).toBe('')
    expect(details.style.visibility).toBe('')
    frame.remove()
  })
})
