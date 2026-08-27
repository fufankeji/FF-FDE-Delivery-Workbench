/** Browser-local appearance state and reversible projection onto ThemeRuntime and the DOM. */

import type { ThemeRuntime, ThemeTokenOverrides } from '@deepseek-ai/dsh-client-ui-theme/client'
import {
  BUNDLED_APPEARANCE_THEMES,
  DEFAULT_BUILTIN_APPEARANCE_THEME,
  resolveAppearanceBackground,
} from './appearance-themes.ts'
import type { AppearancePalette, AppearanceSettings, BuiltinAppearanceTheme } from './types.ts'

/** Versioned localStorage key for the complete browser appearance value. */
export const APPEARANCE_STORAGE_KEY = 'fde.appearance.v1'
/** Leave headroom under common per-Origin localStorage quotas. */
export const MAX_STORED_APPEARANCE_CHARACTERS = 4_000_000

/** Initial appearance before an optional persisted choice loads. */
export const DEFAULT_APPEARANCE: AppearanceSettings = Object.freeze({
  builtinTheme: DEFAULT_BUILTIN_APPEARANCE_THEME,
  imageDataUrl: null,
  focusY: 50,
  glassStrength: 72,
  palette: BUNDLED_APPEARANCE_THEMES[DEFAULT_BUILTIN_APPEARANCE_THEME].palette,
})

/** Stable issue categories rendered by the localized settings page. */
export type AppearanceIssue = 'invalid-stored-value' | 'storage-unavailable' | 'save-failed'

/** Immutable state exposed to the appearance settings page. */
export interface AppearanceSnapshot {
  readonly status: 'ready' | 'saving' | 'error'
  readonly settings: AppearanceSettings
  readonly issue?: AppearanceIssue
  readonly detail?: string
}

/** Minimum browser storage face used by the controller and tests. */
export interface AppearanceStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

/**
 * Resolve localStorage without letting a disabled storage policy break client boot.
 * @returns The current Origin storage, or undefined when browser policy rejects access.
 */
export function browserAppearanceStorage(): AppearanceStorage | undefined {
  try {
    return window.localStorage
  } catch {
    return undefined
  }
}

/** Apply and persist one FDE background without exposing it to Host or Session services. */
export class AppearanceController {
  private readonly theme: Pick<ThemeRuntime, 'overrideTokens'>
  private readonly storage: AppearanceStorage | undefined
  private snapshot: AppearanceSnapshot = { status: 'ready', settings: DEFAULT_APPEARANCE }
  private readonly listeners = new Set<() => void>()
  private disposeTokens: (() => void) | undefined
  private disposed = false
  private started = false
  private previousMarker: string | null = null
  private previousImage = ''
  private previousPosition = ''

  /** Create one apply-scoped browser appearance owner. */
  constructor(theme: Pick<ThemeRuntime, 'overrideTokens'>, storage: AppearanceStorage | undefined) {
    this.theme = theme
    this.storage = storage
  }

  /** Subscribe to immutable appearance changes. */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  /** Return the current immutable snapshot. */
  getSnapshot = (): AppearanceSnapshot => this.snapshot

  /**
   * Apply the saved value or bundled default.
   * @returns A disposer that restores the prior DOM and token state.
   */
  start(): () => void {
    if (this.started) throw new Error('appearance controller already started')
    this.started = true
    const body = document.body
    this.previousMarker = body.getAttribute('data-fde-skin')
    this.previousImage = body.style.getPropertyValue('--fde-background-image')
    this.previousPosition = body.style.getPropertyValue('--fde-background-position')
    const loaded = this.read()
    this.apply(loaded.settings)
    this.publish(loaded)
    return () => { this.dispose() }
  }

  /**
   * Persist a complete value before replacing the active DOM and token state.
   * @param settings - Fully processed built-in or custom appearance value.
   */
  save(settings: AppearanceSettings): void {
    const next = normalizeSettings(settings)
    const serialized = JSON.stringify(next)
    if (serialized.length > MAX_STORED_APPEARANCE_CHARACTERS) {
      const error = new Error('processed-image-too-large')
      this.publish({ status: 'error', settings: this.snapshot.settings, issue: 'save-failed', detail: error.message })
      throw error
    }
    this.publish({ status: 'saving', settings: this.snapshot.settings })
    try {
      if (this.storage === undefined) throw new Error('local-storage-unavailable')
      this.storage.setItem(APPEARANCE_STORAGE_KEY, serialized)
      this.apply(next)
      this.publish({ status: 'ready', settings: next })
    } catch (error) {
      this.publish({
        status: 'error',
        settings: this.snapshot.settings,
        issue: this.storage === undefined ? 'storage-unavailable' : 'save-failed',
        detail: messageOf(error),
      })
      throw error
    }
  }

  /** Persist and apply the bundled default skin. */
  reset(): void {
    this.save(DEFAULT_APPEARANCE)
  }

  /** Remove this plugin's observable, token, and DOM effects. */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.disposeTokens?.()
    this.disposeTokens = undefined
    const body = document.body
    if (this.previousMarker === null) body.removeAttribute('data-fde-skin')
    else body.setAttribute('data-fde-skin', this.previousMarker)
    restoreProperty(body, '--fde-background-image', this.previousImage)
    restoreProperty(body, '--fde-background-position', this.previousPosition)
    this.listeners.clear()
  }

  private read(): AppearanceSnapshot {
    if (this.storage === undefined) {
      return { status: 'error', settings: DEFAULT_APPEARANCE, issue: 'storage-unavailable' }
    }
    try {
      const serialized = this.storage.getItem(APPEARANCE_STORAGE_KEY)
      if (serialized === null) return { status: 'ready', settings: DEFAULT_APPEARANCE }
      return { status: 'ready', settings: normalizeSettings(JSON.parse(serialized) as unknown) }
    } catch (error) {
      return {
        status: 'error', settings: DEFAULT_APPEARANCE,
        issue: 'invalid-stored-value', detail: messageOf(error),
      }
    }
  }

  private apply(settings: AppearanceSettings): void {
    const image = resolveAppearanceBackground(settings)
    this.disposeTokens?.()
    this.disposeTokens = undefined
    if (image === null) {
      const body = document.body
      if (this.previousMarker === null) body.removeAttribute('data-fde-skin')
      else body.setAttribute('data-fde-skin', this.previousMarker)
      restoreProperty(body, '--fde-background-image', this.previousImage)
      restoreProperty(body, '--fde-background-position', this.previousPosition)
      return
    }
    this.disposeTokens = this.theme.overrideTokens('fde-appearance', themeTokens(settings))
    document.body.setAttribute('data-fde-skin', 'active')
    document.body.style.setProperty('--fde-background-image', `url("${image}")`)
    document.body.style.setProperty('--fde-background-position', `${String(settings.focusY)}%`)
  }

  private publish(snapshot: AppearanceSnapshot): void {
    this.snapshot = Object.freeze({ ...snapshot })
    for (const listener of this.listeners) listener()
  }
}

/**
 * Convert a validated palette and glass strength into reversible light/dark token pairs.
 * @param settings - Active appearance palette and glass strength.
 * @returns Semantic token overrides with both official color schemes.
 */
export function themeTokens(settings: AppearanceSettings): ThemeTokenOverrides {
  const [accent, deep, mist, highlight] = settings.palette
  const strength = settings.glassStrength / 100
  const baseAlpha = (0.24 + strength * 0.22).toFixed(2)
  const darkAlpha = (0.31 + strength * 0.22).toFixed(2)
  const layerAlpha = (0.58 + strength * 0.20).toFixed(2)
  const modes = (light: string, dark: string) => ({ light, dark })
  return {
    '--dsw-alias-bg-base': modes(`rgba(246, 250, 255, ${baseAlpha})`, `rgba(7, 17, 29, ${darkAlpha})`),
    '--dsw-alias-bg-layer-1': modes(`rgba(255, 255, 255, ${layerAlpha})`, `rgba(13, 27, 45, ${layerAlpha})`),
    '--dsw-alias-bg-layer-2': modes('rgba(236, 245, 255, 0.86)', 'rgba(18, 36, 57, 0.88)'),
    '--dsw-alias-bg-overlay': modes('rgba(251, 253, 255, 0.96)', 'rgba(11, 23, 39, 0.96)'),
    '--dsw-specific-sidebar-fill': modes('rgba(235, 244, 254, 0.42)', 'rgba(8, 21, 36, 0.52)'),
    '--dsw-specific-input-major': modes('rgba(255, 255, 255, 0.90)', 'rgba(16, 34, 54, 0.92)'),
    '--dsw-specific-menu': modes('rgba(251, 253, 255, 0.97)', 'rgba(11, 25, 42, 0.97)'),
    '--dsw-specific-selector': modes('rgba(236, 246, 255, 0.94)', 'rgba(21, 42, 65, 0.94)'),
    '--dsw-specific-bubble': modes('rgba(219, 238, 255, 0.92)', 'rgba(31, 61, 91, 0.88)'),
    '--dsw-alias-border-l1': modes(`${mist}80`, `${mist}66`),
    '--dsw-alias-border-l2': modes(`${mist}a8`, `${mist}78`),
    '--dsw-alias-brand-primary': modes(accent, highlight),
    '--dsw-alias-state-business-primary': modes(accent, highlight),
    '--dsw-alias-label-primary': modes(deep, '#edf7ff'),
    '--dsw-alias-label-secondary': modes(`${deep}cc`, '#b9cfe2'),
    '--dsw-alias-interactive-bg-hover': modes(`${accent}18`, `${highlight}24`),
  }
}

/**
 * Validate and freeze one value before it reaches storage or the DOM.
 * @param value - Parsed browser storage or a component-produced candidate.
 * @returns A complete immutable appearance value.
 */
export function normalizeSettings(value: unknown): AppearanceSettings {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('appearance-value-invalid')
  const candidate = value as Partial<AppearanceSettings>
  const builtinTheme = candidate.builtinTheme
  const imageDataUrl = candidate.imageDataUrl
  if (builtinTheme !== null && !isBuiltinTheme(builtinTheme)) throw new Error('appearance-theme-invalid')
  if (builtinTheme === null) {
    if (typeof imageDataUrl !== 'string' || !imageDataUrl.startsWith('data:image/webp;base64,')) {
      throw new Error('appearance-image-invalid')
    }
  } else if (imageDataUrl !== null) {
    throw new Error('appearance-source-conflict')
  }
  const focusY = candidate.focusY
  if (typeof focusY !== 'number' || !Number.isInteger(focusY) || focusY < 0 || focusY > 100) {
    throw new Error('appearance-focus-invalid')
  }
  const glassStrength = candidate.glassStrength
  if (typeof glassStrength !== 'number' || !Number.isInteger(glassStrength)
    || glassStrength < 35 || glassStrength > 92) {
    throw new Error('appearance-glass-invalid')
  }
  if (!isPalette(candidate.palette)) throw new Error('appearance-palette-invalid')
  return Object.freeze({
    builtinTheme,
    imageDataUrl,
    focusY,
    glassStrength,
    palette: Object.freeze([
      candidate.palette[0], candidate.palette[1], candidate.palette[2], candidate.palette[3],
    ] as const),
  })
}

function isBuiltinTheme(value: unknown): value is BuiltinAppearanceTheme {
  return typeof value === 'string' && Object.hasOwn(BUNDLED_APPEARANCE_THEMES, value)
}

function isPalette(value: unknown): value is AppearancePalette {
  return Array.isArray(value) && value.length === 4
    && value.every(color => typeof color === 'string' && /^#[\da-f]{6}$/iu.test(color))
}

function restoreProperty(element: HTMLElement, name: string, value: string): void {
  if (value === '') element.style.removeProperty(name)
  else element.style.setProperty(name, value)
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
