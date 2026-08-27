// @vitest-environment jsdom

import { useSyncExternalStore } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { AppearanceSection, type AppearanceSectionProps } from '../src/client/AppearanceSection.tsx'
import { AppearanceController } from '../src/client/controller.ts'
import { zh } from '../src/client/locales.ts'

const t = makeTranslate(zh) as AppearanceSectionProps['t']

beforeEach(() => {
  window.localStorage.clear()
  Object.defineProperty(HTMLImageElement.prototype, 'decode', {
    configurable: true,
    value: vi.fn(() => Promise.resolve()),
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  Reflect.deleteProperty(HTMLImageElement.prototype, 'decode')
  document.body.removeAttribute('data-fde-skin')
  document.body.removeAttribute('style')
})

function renderSection() {
  const theme = { overrideTokens: vi.fn(() => vi.fn()) }
  const controller = new AppearanceController(theme, window.localStorage)
  const dispose = controller.start()
  const useAppearance = <T,>(selector: (snapshot: ReturnType<typeof controller.getSnapshot>) => T): T =>
    useSyncExternalStore(controller.subscribe, () => selector(controller.getSnapshot()))
  render(<AppearanceSection {...({
    close: vi.fn(),
    useSessions: vi.fn(),
    useWorkspaces: vi.fn(),
    useAppearance,
    saveAppearance: settings => Promise.resolve().then(() => { controller.save(settings) }),
    resetAppearance: () => Promise.resolve().then(() => { controller.reset() }),
    t,
  } satisfies Partial<AppearanceSectionProps> as AppearanceSectionProps)} />)
  return { controller, dispose }
}

describe('AppearanceSection', () => {
  it('shows six bundled skins and applies an explicitly saved choice', async () => {
    renderSection()
    expect(screen.getAllByRole('button', { name: /官方原版|大肥鱼拟人|云端猫咪|九天·/ })).toHaveLength(6)
    const cat = screen.getByRole('button', { name: /云端猫咪/ })
    fireEvent.click(cat)
    expect(cat.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText(/已更新预览/)).toBeTruthy()
    expect(document.body.style.getPropertyValue('--fde-background-image')).toContain('default-background.webp')

    fireEvent.click(screen.getByRole('button', { name: '保存并应用' }))
    await waitFor(() => {
      expect(document.body.style.getPropertyValue('--fde-background-image')).toContain('cloud-cat-background.webp')
    })
    expect(screen.getByText(/刷新后仍会保留/)).toBeTruthy()
  })

  it('restores the default and keeps image validation local', async () => {
    renderSection()
    fireEvent.click(screen.getByRole('button', { name: /官方原版/ }))
    fireEvent.click(screen.getByRole('button', { name: '保存并应用' }))
    await waitFor(() => { expect(document.body.hasAttribute('data-fde-skin')).toBe(false) })

    fireEvent.click(screen.getByRole('button', { name: '恢复默认' }))
    await waitFor(() => {
      expect(document.body.style.getPropertyValue('--fde-background-image')).toContain('default-background.webp')
    })

    const input = screen.getByLabelText('选择图片') as HTMLInputElement
    fireEvent.change(input, { target: { files: [new File(['text'], 'note.txt', { type: 'text/plain' })] } })
    expect(screen.getByText('请选择 PNG、JPG 或 WebP 图片。')).toBeTruthy()
  })
})
