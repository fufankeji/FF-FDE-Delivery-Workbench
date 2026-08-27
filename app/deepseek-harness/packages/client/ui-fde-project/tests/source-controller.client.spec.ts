// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { waitFor } from '@testing-library/react'
import {
  PROJECT_SOURCES_CHANGED_EVENT,
  ProjectSourceController,
  type ProjectSourceItem,
} from '../src/client/source-controller.ts'

const source: ProjectSourceItem = {
  sourceId: 'src_123456789012',
  workspaceId: 'workspace-1',
  originalName: '需求.docx',
  storedName: '需求.docx',
  relativePath: 'fde-resources/需求.docx',
  mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  extension: 'docx',
  bytes: 123,
  createdAt: '2026-08-27T00:00:00.000Z',
  modifiedAt: '2026-08-27T00:00:00.000Z',
  previewKind: 'office',
  fileUrl: '/api/fde-project-resources/file?workspaceId=workspace-1&sourceId=src_123456789012',
  parse: { status: 'pending' },
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('ProjectSourceController', () => {
  it('calls the browser fetch implementation with the global receiver', async () => {
    const fetchImpl = vi.fn(function (this: unknown) {
      if (this !== globalThis) throw new TypeError('Illegal invocation')
      return Promise.resolve(new Response(JSON.stringify({ ok: true, value: { files: [source] } }), { status: 200 }))
    }) as typeof fetch
    vi.stubGlobal('fetch', fetchImpl)
    const controller = new ProjectSourceController()

    controller.load('workspace-1')

    await waitFor(() => { expect(controller.getSnapshot().byWorkspace['workspace-1']?.status).toBe('ready') })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    controller.dispose()
  })

  it('loads, parses, and refreshes the exact project after an upload event', async () => {
    let listCalls = 0
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/parse')) {
        return new Response(JSON.stringify({ ok: true, value: { file: { ...source, parse: { status: 'ready', derivedPath: '.fde/derived/source.md' } } } }), { status: 200 })
      }
      listCalls += 1
      return new Response(JSON.stringify({ ok: true, value: { files: [source] } }), { status: 200 })
    }) as typeof fetch
    const controller = new ProjectSourceController(fetchImpl)
    controller.load('workspace-1')
    await waitFor(() => { expect(controller.getSnapshot().byWorkspace['workspace-1']?.status).toBe('ready') })
    await controller.parse('workspace-1', source.sourceId)
    expect(controller.getSnapshot().byWorkspace['workspace-1']?.files[0]?.parse.status).toBe('ready')
    window.dispatchEvent(new CustomEvent(PROJECT_SOURCES_CHANGED_EVENT, { detail: { workspaceId: 'workspace-1' } }))
    await waitFor(() => { expect(listCalls).toBe(2) })
    controller.dispose()
  })
})
