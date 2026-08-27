// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { RequirementWikiPanel } from '../src/client/RequirementWikiPanel.tsx'
import type { ProjectSourceItem } from '../src/client/source-controller.ts'
import type { RequirementWikiRunTarget } from '../src/client/slots.ts'
import type { RequirementWikiSnapshot } from '../src/client/wiki-controller.ts'

const source: ProjectSourceItem = {
  sourceId: 'src_123456789012', workspaceId: 'workspace-1', originalName: '客户需求.txt', storedName: '客户需求.txt',
  relativePath: 'fde-resources/客户需求.txt', mimeType: 'text/plain; charset=utf-8', extension: 'txt', bytes: 32,
  createdAt: '2026-08-27T00:00:00.000Z', modifiedAt: '2026-08-27T00:00:00.000Z', previewKind: 'text',
  fileUrl: '/api/fde-project-resources/file?workspaceId=workspace-1&sourceId=src_123456789012',
  parse: { status: 'ready', derivedPath: '.fde/derived/src_123456789012.md' },
}

const target: RequirementWikiRunTarget = {
  sessionId: 'session-project-1', provider: 'deepseek-official', providerName: 'DeepSeek',
  model: 'deepseek-v4-flash', modelName: 'DeepSeek V4 Flash',
}

const readyWiki: RequirementWikiSnapshot = {
  status: 'ready',
  current: {
    schemaVersion: 1,
    revision: 1,
    buildId: 'wiki_12345678901234567890123456789012',
    generatedAt: '2026-08-27T00:00:00.000Z',
    generatedBy: 'session-project-1',
    sourceCatalogFingerprint: 'a'.repeat(64),
    sources: [{
      sourceId: source.sourceId, storedName: source.storedName, relativePath: source.relativePath,
      derivedPath: source.parse.derivedPath!, bytes: source.bytes, mtimeMs: 1,
      parser: '@jiaoqsh/dsh-document', parserVersion: '0.1.1',
    }],
    pages: [{
      id: 'delivery_goal', topic: 'business-goal', title: '现有知识', body: '已经发布的候选理解。',
      sourceIds: [source.sourceId],
    }],
    relations: [], conflicts: [], unknowns: [],
  },
  build: null,
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe(): void {} disconnect(): void {} })
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('RequirementWikiPanel explicit model boundary', () => {
  it('does not open the update picker while an existing Wiki is still loading', async () => {
    const props = {
      workspaceId: 'workspace-1', runSessionId: 'session-project-1', sourceState: { status: 'ready', files: [source] } as const,
      onPrepare: vi.fn(async () => target), onStart: vi.fn(async () => undefined),
      onAbandon: vi.fn(async () => undefined), onRefresh: vi.fn(), onOpenSource: vi.fn(),
    }
    const view = render(<RequirementWikiPanel {...props} wikiState={{ status: 'loading', value: null }} />)
    view.rerender(<RequirementWikiPanel {...props} wikiState={{ status: 'ready', value: readyWiki }} />)
    await screen.findByRole('heading', { name: '现有知识' })
    expect(screen.queryByRole('heading', { name: '选择本次整理的资料' })).toBeNull()
  })

  it('does not start until the exact project Session, Provider, and model are shown and confirmed', async () => {
    const onPrepare = vi.fn(async () => target)
    const onStart = vi.fn(async () => undefined)
    render(<RequirementWikiPanel
      workspaceId="workspace-1"
      runSessionId="session-project-1"
      wikiState={{ status: 'ready', value: { status: 'absent', current: null, build: null } }}
      sourceState={{ status: 'ready', files: [source] }}
      onPrepare={onPrepare}
      onStart={onStart}
      onAbandon={vi.fn(async () => undefined)}
      onRefresh={vi.fn()}
      onOpenSource={vi.fn()}
    />)

    fireEvent.click(screen.getByRole('checkbox', { name: /客户需求/ }))
    fireEvent.click(screen.getByRole('button', { name: '整理需求知识' }))
    await screen.findByRole('dialog', { name: '确认整理需求知识' })
    expect(screen.getByText(/session-project-1/)).toBeTruthy()
    expect(screen.getByText(/DeepSeek（deepseek-official）/)).toBeTruthy()
    expect(screen.getByText(/DeepSeek V4 Flash（deepseek-v4-flash）/)).toBeTruthy()
    expect(onStart).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '暂不整理' }))
    expect(onStart).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '整理需求知识' }))
    await screen.findByRole('dialog', { name: '确认整理需求知识' })
    fireEvent.click(screen.getByRole('button', { name: '确认并整理' }))
    await waitFor(() => {
      expect(onStart).toHaveBeenCalledWith(['src_123456789012'], 0, target)
    })
    expect(onPrepare).toHaveBeenCalledTimes(2)
  })

  it('keeps build creation unavailable when the project has no Session', () => {
    const onPrepare = vi.fn(async () => target)
    render(<RequirementWikiPanel
      workspaceId="workspace-1"
      runSessionId={undefined}
      wikiState={{ status: 'ready', value: { status: 'absent', current: null, build: null } }}
      sourceState={{ status: 'ready', files: [source] }}
      onPrepare={onPrepare}
      onStart={vi.fn(async () => undefined)}
      onAbandon={vi.fn(async () => undefined)}
      onRefresh={vi.fn()}
      onOpenSource={vi.fn()}
    />)
    fireEvent.click(screen.getByRole('checkbox', { name: /客户需求/ }))
    expect(screen.getByText(/没有可用会话/)).toBeTruthy()
    expect(screen.getByRole<HTMLButtonElement>('button', { name: '整理需求知识' }).disabled).toBe(true)
    expect(onPrepare).not.toHaveBeenCalled()
  })
})
