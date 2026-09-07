// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { resolveProjectPreview } from '../src/client/project-runtime-sidebar.ts'
import { embeddabilityOf, isAllowedLoopbackUrl } from 'dsh-better-sidebar/src/client/browser.ts'

describe('platform preview entry and embed detection', () => {
  it('requests only the Workspace ID and accepts an isolated platform origin', async () => {
    const url = `http://fde-${'a'.repeat(36)}.localhost:41001/page`
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ ok: true, value: { url } })))
    expect(await resolveProjectPreview('workspace-a', fetcher)).toBe(url)
    expect(fetcher).toHaveBeenCalledWith('/api/fde-project/runtime/preview', expect.objectContaining({ method: 'POST', body: '{"workspaceId":"workspace-a"}' }))
    expect(isAllowedLoopbackUrl(url, new URL(url).host)).toBe(true)
    expect(isAllowedLoopbackUrl(url, '')).toBe(false)
    fetcher.mockResolvedValue(new Response(JSON.stringify({ ok: true, value: { url: 'http://external.example/' } })))
    await expect(resolveProjectPreview('workspace-a', fetcher)).rejects.toThrow('无效')
    fetcher.mockResolvedValue(new Response(JSON.stringify({ ok: false, error: { message: '项目已停止' } }), { status: 409 }))
    await expect(resolveProjectPreview('workspace-a', fetcher)).rejects.toThrow('项目已停止')
  })

  it('matches actual origins, respects CSP precedence and leaves complex policies to the browser', () => {
    const probe = { reachable: true, url: 'http://127.0.0.1:4177/', frameAncestors: ["'self'", 'http://127.0.0.1:3081'] }
    expect(embeddabilityOf(probe, 'http://127.0.0.1:3081')).toBe('embeddable')
    expect(embeddabilityOf(probe, 'http://127.0.0.1:3080')).toBe('blocked')
    expect(embeddabilityOf({ ...probe, xFrameOptions: 'DENY' }, 'http://127.0.0.1:3081')).toBe('embeddable')
    expect(embeddabilityOf({ ...probe, frameAncestors: ["'none'"] }, 'http://127.0.0.1:3081')).toBe('blocked')
    expect(embeddabilityOf({ reachable: true, url: probe.url, xFrameOptions: 'SAMEORIGIN' }, 'http://127.0.0.1:4177')).toBe('embeddable')
    expect(embeddabilityOf({ reachable: true, url: probe.url, xFrameOptions: 'DENY' }, 'http://127.0.0.1:4177')).toBe('blocked')
    expect(embeddabilityOf({ ...probe, frameAncestors: ['https://*.example.com'] }, 'https://preview.example.com')).toBe('unknown')
    expect(embeddabilityOf({ reachable: false }, 'http://127.0.0.1:3081')).toBe('unknown')
  })
})
