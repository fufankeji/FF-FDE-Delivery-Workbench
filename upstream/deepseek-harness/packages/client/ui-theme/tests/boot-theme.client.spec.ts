// @vitest-environment jsdom
/** The theme bootstrap injection row and the resulting pre-plugin browser theme. */
import { runInNewContext } from 'node:vm'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { bootThemeInjection } from '../src/boot-theme.ts'
import type { ThemePreference } from '../src/theme-settings.ts'
import { THEME_BOOTSTRAP_ATTRIBUTE } from '../src/theme-settings.ts'
import { Context } from '@deepseek-ai/cordis'
import { stubSettingsScope } from '@deepseek-ai/dsh-client-test-runtime'
import { ThemeRuntime } from '../src/client/index.ts'

const DARK_ATTRIBUTE = 'data-ds-dark-theme'

function mockSystemDark(matches: boolean): void {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches }) as MediaQueryList))
}

function executeBootstrap(preference?: ThemePreference): void {
  const row = bootThemeInjection(preference)
  if (row.kind !== 'script') throw new Error('theme bootstrap row is not a script')
  runInNewContext(row.text, { document, matchMedia: globalThis.matchMedia })
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.documentElement.style.removeProperty('color-scheme')
  document.body.removeAttribute(DARK_ATTRIBUTE)
  document.documentElement.removeAttribute(THEME_BOOTSTRAP_ATTRIBUTE)
})

describe('theme bootstrap row', () => {
  it('is a body script row, so it runs before the shell mount', () => {
    mockSystemDark(false)
    const row = bootThemeInjection('dark')
    expect(row).toMatchObject({ kind: 'script', placement: 'body' })
    executeBootstrap('dark')
    expect(document.documentElement.style.colorScheme).toBe('dark')
    expect(document.body.hasAttribute(DARK_ATTRIBUTE)).toBe(true)
  })

  it('lets durable light override a dark OS and clears stale dark state', () => {
    document.body.setAttribute(DARK_ATTRIBUTE, '')
    mockSystemDark(true)
    executeBootstrap('light')
    expect(document.documentElement.style.colorScheme).toBe('light')
    expect(document.body.hasAttribute(DARK_ATTRIBUTE)).toBe(false)
  })

  it.each([
    [true, 'dark', true],
    [false, 'light', false],
  ] as const)('resolves system=%s to %s', (matches, colorScheme, dark) => {
    mockSystemDark(matches)
    executeBootstrap('system')
    expect(document.documentElement.style.colorScheme).toBe(colorScheme)
    expect(document.body.hasAttribute(DARK_ATTRIBUTE)).toBe(dark)
  })

  it('defaults to system and falls back to light when matchMedia is unavailable', () => {
    vi.stubGlobal('matchMedia', undefined)
    executeBootstrap()
    expect(document.documentElement.style.colorScheme).toBe('light')
    expect(document.body.hasAttribute(DARK_ATTRIBUTE)).toBe(false)
  })

  it.each(['light', 'dark', 'system'] as const)('keeps the Host %s preference when LAN settings have no Host mirror', async preference => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    executeBootstrap(preference)
    const ctx = new Context()
    const host = stubSettingsScope<{ preference: ThemePreference }>()
    const theme = new ThemeRuntime(ctx, host.scope)
    expect(theme.getTheme().preference).toBe(preference)
    expect(theme.getTheme().active.colorScheme).toBe(preference === 'light' ? 'light' : 'dark')
    expect(host.set).not.toHaveBeenCalled()
    // Later user actions remain authoritative, rather than being pinned to bootstrap.
    theme.setTheme(preference === 'light' ? 'dark' : 'light')
    expect(host.set).toHaveBeenCalledOnce()
    await ctx.fiber.dispose()
  })

  it('lets the later Host settings snapshot supersede bootstrap without writing a preference', async () => {
    executeBootstrap('light')
    const ctx = new Context()
    const host = stubSettingsScope<{ preference: ThemePreference }>()
    const theme = new ThemeRuntime(ctx, host.scope)
    host.publish({ status: 'ready', value: { preference: 'dark' }, revision: 1, writable: true })
    expect(theme.getTheme().preference).toBe('dark')
    expect(host.set).not.toHaveBeenCalled()
    await ctx.fiber.dispose()
  })
})
