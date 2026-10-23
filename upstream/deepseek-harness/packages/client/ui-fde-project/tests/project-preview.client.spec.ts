// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { resolveProjectPreview } from '../src/client/project-runtime-sidebar.ts'
import { isolatedProjectPreview } from '../src/client/ProjectPreview.tsx'

describe('platform preview entry and embed detection', () => {
  it('requests only the Workspace ID and accepts an isolated platform origin', async () => {
    const url = `http://fde-${'a'.repeat(36)}.localhost:41001/page`
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ ok: true, value: { url } })))
    expect(await resolveProjectPreview('workspace-a', fetcher)).toBe(url)
    expect(fetcher).toHaveBeenCalledWith('/api/fde-project/runtime/preview', expect.objectContaining({ method: 'POST', body: '{"workspaceId":"workspace-a"}' }))
    expect(isolatedProjectPreview(url)).toBe(url)
    fetcher.mockResolvedValue(new Response(JSON.stringify({ ok: true, value: { url: 'http://external.example/' } })))
    await expect(resolveProjectPreview('workspace-a', fetcher)).rejects.toThrow('Invalid isolated')
    fetcher.mockResolvedValue(new Response(JSON.stringify({ ok: false, error: { message: '项目已停止' } }), { status: 409 }))
    await expect(resolveProjectPreview('workspace-a', fetcher)).rejects.toThrow('项目已停止')
  })

  it.each(['https://example.com/', 'http://localhost:3080/', 'http://127.0.0.1:3080/', 'javascript:alert(1)', 'http://fde-'+ 'a'.repeat(36) + '.localhost/', 'http://u:p@fde-'+'a'.repeat(36)+'.localhost:41001/'])('rejects non-issued preview address %s', value => {
    expect(() => isolatedProjectPreview(value)).toThrow()
  })
})
