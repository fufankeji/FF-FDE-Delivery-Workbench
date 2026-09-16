// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { ProjectResourceComposerAction, ProjectResourceUploadAction } from '../src/client/ProjectResourceUploadAction.tsx'
import { zh } from '../src/client/locales.ts'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const t = makeTranslate(zh) as never

function mount(fetchImpl: typeof fetch) {
  vi.stubGlobal('fetch', fetchImpl)
  return render(<ProjectResourceUploadAction
    usePanelInfo={(() => undefined) as never} useSessionPendingInteraction={(() => new Map()) as never} useResource={(() => undefined) as never} useSessions={(() => undefined) as never}
    useWorkspaces={(() => undefined) as never}
    workspaceId={'workspace-1' as WorkspaceId}
    title="客户项目"
    path="/projects/customer"
    t={t}
  />)
}

describe('ProjectResourceUploadAction', () => {
  it('shows one small project-scoped upload action inside the native composer', () => {
    render(<ProjectResourceComposerAction
      sessionId={'session-1' as never}
      useSession={(() => undefined) as never}
      usePanelInfo={(() => undefined) as never} useSessionPendingInteraction={(() => new Map()) as never} useResource={(() => undefined) as never} useConversation={(() => undefined) as never} useChat={(() => undefined) as never} useTrajectory={(() => undefined) as never} useSessions={(() => undefined) as never}
      useWorkspaces={((selector: (state: unknown) => unknown) => selector({
        items: [{ workspaceId: 'workspace-1', path: '/projects/customer', sessionIds: ['session-1'] }],
      })) as never}
      useProjection={(() => undefined) as never}
      useInput={(() => undefined) as never}
      inputActions={{} as never}
      t={t}
    />)
    const button = screen.getByRole('button', { name: '有客户资料？上传' })
    expect(button).toBeTruthy()
    fireEvent.mouseEnter(button)
    fireEvent.focus(button)
    expect(screen.queryByRole('tooltip')).toBeNull()
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('opens its picker only for the exact project request', () => {
    const view = mount(vi.fn() as unknown as typeof fetch)
    const input = view.container.querySelector('input[type="file"]') as HTMLInputElement
    const click = vi.spyOn(input, 'click').mockImplementation(() => undefined)

    window.dispatchEvent(new CustomEvent('fde:project-source-upload-open', {
      detail: { workspaceId: 'workspace-2' },
    }))
    expect(click).not.toHaveBeenCalled()

    window.dispatchEvent(new CustomEvent('fde:project-source-upload-open', {
      detail: { workspaceId: 'workspace-1' },
    }))
    expect(click).toHaveBeenCalledTimes(1)
  })

  it('uploads a multi-file batch for the exact project and reports success', async () => {
    const changed = vi.fn()
    window.addEventListener('fde:project-sources-changed', changed)
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === '/api/fde-project-resources/parse') {
        expect(JSON.parse(String(init?.body))).toEqual({ workspaceId: 'workspace-1', sourceId: 'src-docx' })
        return new Response(JSON.stringify({ ok: true, value: { file: { sourceId: 'src-docx' } } }), { status: 200 })
      }
      const form = init?.body as FormData
      expect(form.get('workspaceId')).toBe('workspace-1')
      expect(form.getAll('files').map(value => value instanceof File ? value.name : value)).toEqual([
        '需求说明.docx', '系统截图.png',
      ])
      return new Response(JSON.stringify({
        ok: true,
        value: { directory: 'fde-resources', files: [
          { sourceId: 'src-docx', storedName: '需求说明.docx', parse: { status: 'pending' } },
          { sourceId: 'src-image', storedName: '系统截图.png', parse: { status: 'needs-ocr' } },
        ] },
      }), { status: 200, headers: { 'content-type': 'application/json' } })
    }) as typeof fetch
    const view = mount(fetchImpl)
    const input = view.container.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [new File(['doc'], '需求说明.docx'), new File(['png'], '系统截图.png')] } })
    await waitFor(() => { expect(fetchImpl).toHaveBeenCalledWith(
      '/api/fde-project-resources/upload',
      expect.objectContaining({ method: 'POST' }),
    ) })
    expect((await screen.findByRole('alert')).textContent).toContain('已将 2 个文件保存到 fde-resources/')
    await waitFor(() => { expect(fetchImpl).toHaveBeenCalledWith(
      '/api/fde-project-resources/parse',
      expect.objectContaining({ method: 'POST' }),
    ) })
    await waitFor(() => { expect(changed).toHaveBeenCalledTimes(2) })
    window.removeEventListener('fde:project-sources-changed', changed)
  })

  it('shows the Host refusal and remains an isolated project action', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      ok: false,
      error: { code: 'file-too-large', message: '文件超过单文件大小限制。' },
    }), { status: 413, headers: { 'content-type': 'application/json' } })) as typeof fetch
    const view = mount(fetchImpl)
    const input = view.container.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [new File(['large'], 'large.pdf')] } })
    expect((await screen.findByRole('alert')).textContent).toContain('项目资料保存失败：文件超过单文件大小限制。')
    expect(screen.queryByRole('textbox')).toBeNull()
  })
})
