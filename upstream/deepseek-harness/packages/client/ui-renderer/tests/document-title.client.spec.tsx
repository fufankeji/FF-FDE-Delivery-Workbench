// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { DocumentTitle } from '../src/client/DocumentTitle.tsx'

afterEach(() => {
  cleanup()
  document.title = ''
  vi.unstubAllEnvs()
})

describe('DocumentTitle', () => {
  it('projects a durable title and restores the product title', () => {
    vi.stubEnv('DSH_CLIENT_TITLE', 'DeepSeek Harness')
    document.title = 'stale title'
    const mounted = render(<DocumentTitle />)
    expect(document.title).toBe('DeepSeek Harness')
    mounted.rerender(<DocumentTitle title="First title" />)
    expect(document.title).toBe('DeepSeek Harness — First title')
    mounted.rerender(<DocumentTitle title="Revised title" />)
    expect(document.title).toBe('DeepSeek Harness — Revised title')
    mounted.rerender(<DocumentTitle />)
    expect(document.title).toBe('DeepSeek Harness')
    mounted.unmount()
    expect(document.title).toBe('DeepSeek Harness')
  })

  it('keeps the workbench brand first when the build provides no title', () => {
    vi.stubEnv('DSH_CLIENT_TITLE', '')
    delete process.env.DSH_CLIENT_TITLE
    const mounted = render(<DocumentTitle title="First title" />)
    expect(document.title).toBe('FF - FDE 交付工作台 — First title')
    mounted.unmount()
    expect(document.title).toBe('FF - FDE 交付工作台')
  })
})
