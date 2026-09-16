// @vitest-environment jsdom

import { Context } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { AppearanceSection } from '../src/client/AppearanceSection.tsx'
import { apply, inject } from '../src/client/index.ts'

afterEach(() => {
  window.localStorage.clear()
  document.body.removeAttribute('data-fde-skin')
  document.body.removeAttribute('style')
})

describe('ui-fde-appearance apply', () => {
  it('registers one localized settings section and retracts its theme effects', async () => {
    const ctx = new Context()
    await ctx.plugin(SlotRegistry).await()
    const locale = new LocaleRuntime(ctx)
    locale.setLocale('zh')
    ctx.provide('locale', locale)
    const disposeTokens = vi.fn()
    ctx.provide('theme', { overrideTokens: vi.fn(() => disposeTokens) } as never)
    const slots = ctx.get('slots') as SlotRegistry
    slots.register({
      name: 'root',
      children: { 'settings.section': { kind: 'list', scope: 'root' } },
    } as never, () => null)

    expect(inject).toEqual(['slots', 'locale', 'theme'])
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    const entry = slots.entries('settings.section')[0]!
    expect(entry.component).toBe(AppearanceSection)
    expect(entry.options).toMatchObject({ id: 'fde-appearance', order: 30 })
    expect(typeof entry.options.label === 'function' ? entry.options.label() : entry.options.label).toBe('界面主题')
    expect(document.body.getAttribute('data-fde-skin')).toBe('active')

    await fiber.dispose()
    expect(slots.entries('settings.section')).toHaveLength(0)
    expect(disposeTokens).toHaveBeenCalledOnce()
    expect(document.body.hasAttribute('data-fde-skin')).toBe(false)
  })
})
