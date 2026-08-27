// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { RequirementGalaxyView } from '../src/client/RequirementGalaxyView.tsx'
import type { RequirementWikiPage, RequirementWikiRelation } from '../src/client/wiki-controller.ts'

const pages: readonly RequirementWikiPage[] = [
  { id: 'goal', topic: 'business-goal', title: '业务目标', body: '降低人工遗漏', sourceIds: ['src_123456789012'] },
  { id: 'process', topic: 'process', title: '交付流程', body: '分阶段处理', sourceIds: ['src_123456789012'] },
  { id: 'acceptance', topic: 'acceptance', title: '验收规则', body: '所有结果保留证据', sourceIds: ['src_123456789012'] },
]

const relations: readonly RequirementWikiRelation[] = [
  { id: 'goal-process', from: 'goal', to: 'process', type: 'depends-on', directed: true, sourceIds: ['src_123456789012'] },
  { id: 'process-acceptance', from: 'process', to: 'acceptance', type: 'validates', directed: true, sourceIds: ['src_123456789012'] },
]

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe(): void {} disconnect(): void {} })
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('RequirementGalaxyView accessible fallback', () => {
  it('keeps the same searchable pages and relations usable when WebGL is unavailable', async () => {
    const onSelectPage = vi.fn()
    render(<RequirementGalaxyView
      revision={3}
      pages={pages}
      relations={relations}
      selectedPageId="process"
      onSelectPage={onSelectPage}
    />)

    await screen.findByText('Galaxy View 已降级')
    expect(screen.getByText(/无法初始化 WebGL/)).toBeTruthy()
    expect(screen.getByText('3 星体 · 2 关系')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /验收规则/ }))
    expect(onSelectPage).toHaveBeenCalledWith('acceptance')

    fireEvent.change(screen.getByRole('textbox', { name: '搜索知识' }), { target: { value: '证据' } })
    await waitFor(() => { expect(screen.getByText('1 星体 · 0 关系')).toBeTruthy() })
    expect(screen.queryByRole('button', { name: /交付流程/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '显示全部' }))
    expect(screen.getByText('3 星体 · 2 关系')).toBeTruthy()
  })

  it('uses the list directly in a narrow container without attempting to hide the graph data', async () => {
    vi.stubGlobal('ResizeObserver', class {
      constructor(private readonly callback: ResizeObserverCallback) {}
      observe(): void { this.callback([{ contentRect: { width: 400 } } as ResizeObserverEntry], this as unknown as ResizeObserver) }
      disconnect(): void {}
    })
    render(<RequirementGalaxyView
      revision={1}
      pages={pages}
      relations={relations}
      selectedPageId="goal"
      onSelectPage={vi.fn()}
    />)
    await screen.findByText(/当前窗口较窄/)
    expect(screen.getByRole('button', { name: /业务目标/ })).toBeTruthy()
    expect(screen.getByText(/3 页 \/ 2 关系/)).toBeTruthy()
  })
})
