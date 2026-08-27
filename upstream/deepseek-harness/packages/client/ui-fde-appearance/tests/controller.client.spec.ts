// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { BUNDLED_APPEARANCE_THEMES } from '../src/client/appearance-themes.ts'
import {
  APPEARANCE_STORAGE_KEY,
  AppearanceController,
  DEFAULT_APPEARANCE,
  normalizeSettings,
  themeTokens,
  type AppearanceStorage,
} from '../src/client/controller.ts'

afterEach(() => {
  window.localStorage.clear()
  document.body.removeAttribute('data-fde-skin')
  document.body.removeAttribute('style')
})

function bench(storage: AppearanceStorage | undefined = window.localStorage) {
  const disposers: ReturnType<typeof vi.fn>[] = []
  const overrideTokens = vi.fn(() => {
    const dispose = vi.fn()
    disposers.push(dispose)
    return dispose
  })
  const controller = new AppearanceController({ overrideTokens }, storage)
  return { controller, overrideTokens, disposers }
}

describe('AppearanceController', () => {
  it('applies the whale skin by default and restores a saved bundled choice', () => {
    const first = bench()
    const disposeFirst = first.controller.start()
    expect(first.controller.getSnapshot()).toMatchObject({ status: 'ready', settings: { builtinTheme: 'whale-maid' } })
    expect(document.body.getAttribute('data-fde-skin')).toBe('active')
    expect(document.body.style.getPropertyValue('--fde-background-image'))
      .toContain(BUNDLED_APPEARANCE_THEMES['whale-maid'].imageUrl)

    const cat = BUNDLED_APPEARANCE_THEMES['cloud-cat']
    first.controller.save({
      builtinTheme: cat.id, imageDataUrl: null, focusY: cat.focusY,
      glassStrength: cat.glassStrength, palette: cat.palette,
    })
    expect(normalizeSettings(JSON.parse(window.localStorage.getItem(APPEARANCE_STORAGE_KEY) ?? '') as unknown))
      .toMatchObject({ builtinTheme: 'cloud-cat' })
    disposeFirst()

    const restored = bench()
    restored.controller.start()
    expect(restored.controller.getSnapshot().settings.builtinTheme).toBe('cloud-cat')
    expect(document.body.style.getPropertyValue('--fde-background-image')).toContain(cat.imageUrl)
  })

  it('removes only its skin effects for the original interface and on dispose', () => {
    document.body.setAttribute('data-foreign', 'kept')
    const fixture = bench()
    const dispose = fixture.controller.start()
    const official = BUNDLED_APPEARANCE_THEMES.official
    fixture.controller.save({
      builtinTheme: official.id, imageDataUrl: null, focusY: official.focusY,
      glassStrength: official.glassStrength, palette: official.palette,
    })
    expect(document.body.hasAttribute('data-fde-skin')).toBe(false)
    expect(document.body.style.getPropertyValue('--fde-background-image')).toBe('')
    expect(fixture.disposers[0]).toHaveBeenCalledOnce()
    expect(document.body.getAttribute('data-foreign')).toBe('kept')
    dispose()
    expect(document.body.getAttribute('data-foreign')).toBe('kept')
  })

  it('keeps the active theme when a later storage write fails', () => {
    let stored = JSON.stringify(DEFAULT_APPEARANCE)
    const storage: AppearanceStorage = {
      getItem: () => stored,
      setItem: (_key, value) => {
        if (normalizeSettings(JSON.parse(value) as unknown).builtinTheme === 'cloud-cat') throw new Error('quota')
        stored = value
      },
    }
    const fixture = bench(storage)
    fixture.controller.start()
    const beforeImage = document.body.style.getPropertyValue('--fde-background-image')
    const cat = BUNDLED_APPEARANCE_THEMES['cloud-cat']
    expect(() => { fixture.controller.save({
      builtinTheme: cat.id, imageDataUrl: null, focusY: cat.focusY,
      glassStrength: cat.glassStrength, palette: cat.palette,
    }) }).toThrow('quota')
    expect(fixture.controller.getSnapshot()).toMatchObject({
      status: 'error', issue: 'save-failed', settings: { builtinTheme: 'whale-maid' },
    })
    expect(document.body.style.getPropertyValue('--fde-background-image')).toBe(beforeImage)
    expect(normalizeSettings(JSON.parse(stored) as unknown)).toMatchObject({ builtinTheme: 'whale-maid' })
  })

  it('falls back atomically from invalid storage and validates custom settings', () => {
    const storage: AppearanceStorage = {
      getItem: () => '{bad json',
      setItem: vi.fn(),
    }
    const fixture = bench(storage)
    fixture.controller.start()
    expect(fixture.controller.getSnapshot()).toMatchObject({
      status: 'error', issue: 'invalid-stored-value', settings: { builtinTheme: 'whale-maid' },
    })
    expect(() => normalizeSettings({ ...DEFAULT_APPEARANCE, builtinTheme: 'unknown' })).toThrow('appearance-theme-invalid')
    expect(normalizeSettings({
      builtinTheme: null,
      imageDataUrl: 'data:image/webp;base64,AAAA',
      focusY: 44,
      glassStrength: 70,
      palette: ['#112233', '#223344', '#334455', '#445566'],
    })).toMatchObject({ builtinTheme: null, focusY: 44 })
  })

  it('keeps light and dark token values paired without changing the color-mode marker', () => {
    document.body.setAttribute('data-ds-dark-theme', '')
    const fixture = bench()
    fixture.controller.start()
    const tokens = themeTokens(DEFAULT_APPEARANCE)
    expect(tokens['--dsw-alias-bg-base']?.light).toMatch(/^rgba\(/u)
    expect(tokens['--dsw-alias-bg-base']?.dark).toMatch(/^rgba\(/u)
    expect(tokens['--dsw-specific-sidebar-fill']).toEqual({
      light: 'rgba(235, 244, 254, 0.42)',
      dark: 'rgba(8, 21, 36, 0.52)',
    })
    expect(document.body.hasAttribute('data-ds-dark-theme')).toBe(true)
    fixture.controller.reset()
    expect(document.body.hasAttribute('data-ds-dark-theme')).toBe(true)
  })
})
