/** FDE background chooser over the official Harness theme-token runtime. */

import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent, CSSProperties, ReactNode } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import {
  BUNDLED_APPEARANCE_THEMES,
  DEFAULT_BUILTIN_APPEARANCE_THEME,
  resolveAppearanceBackground,
} from './appearance-themes.ts'
import { extractPalette, loadImage, renderBackground, validateImageFile } from './background-image.ts'
import type { AppearanceController, AppearanceIssue } from './controller.ts'
import type { AppearanceSettings, BuiltinAppearanceTheme } from './types.ts'
import type { FdeAppearanceKey } from './locales.ts'
import css from './AppearanceSection.module.css'

/** Observable and actions injected by the apply-scoped appearance owner. */
export interface AppearanceSectionInjected {
  hooks: { appearance: AppearanceController }
  saveAppearance: (settings: AppearanceSettings) => Promise<void>
  resetAppearance: () => Promise<void>
}

/** Settings section props delivered by the slot renderer. */
export type AppearanceSectionProps =
  PropsRuntime<'settings.section'>
  & PropsLocale<'fdeAppearance'>
  & InjectFace<AppearanceSectionInjected>

const THEME_COPY: Readonly<Record<BuiltinAppearanceTheme, {
  readonly name: FdeAppearanceKey
  readonly description: FdeAppearanceKey
}>> = Object.freeze({
  official: Object.freeze({ name: 'theme.official.name', description: 'theme.official.description' }),
  'whale-maid': Object.freeze({ name: 'theme.whale-maid.name', description: 'theme.whale-maid.description' }),
  'cloud-cat': Object.freeze({ name: 'theme.cloud-cat.name', description: 'theme.cloud-cat.description' }),
  'jiutian-deep-space': Object.freeze({ name: 'theme.jiutian-deep-space.name', description: 'theme.jiutian-deep-space.description' }),
  'jiutian-quantum-glass': Object.freeze({ name: 'theme.jiutian-quantum-glass.name', description: 'theme.jiutian-quantum-glass.description' }),
  'jiutian-dawn-horizon': Object.freeze({ name: 'theme.jiutian-dawn-horizon.name', description: 'theme.jiutian-dawn-horizon.description' }),
})

/** Render bundled skins, local image processing, preview, save, and reset controls. */
export function AppearanceSection({
  useAppearance, saveAppearance, resetAppearance, t,
}: AppearanceSectionProps): ReactNode {
  const snapshot = useAppearance(state => state)
  const [previewUrl, setPreviewUrl] = useState(resolveAppearanceBackground(snapshot.settings))
  const [selectedUrl, setSelectedUrl] = useState<string | undefined>(undefined)
  const [draftTheme, setDraftTheme] = useState<BuiltinAppearanceTheme | null>(snapshot.settings.builtinTheme)
  const [draftDirty, setDraftDirty] = useState(false)
  const [focusY, setFocusY] = useState(snapshot.settings.focusY)
  const [glassStrength, setGlassStrength] = useState(snapshot.settings.glassStrength)
  const [fileLabel, setFileLabel] = useState(appearanceLabel(snapshot.settings, t))
  const [localMessage, setLocalMessage] = useState<string | undefined>(undefined)
  const [localError, setLocalError] = useState(false)
  const busy = snapshot.status === 'saving'
  const originalSelected = selectedUrl === undefined && draftTheme === 'official'

  useEffect(() => {
    if (draftDirty) return
    setPreviewUrl(resolveAppearanceBackground(snapshot.settings))
    setDraftTheme(snapshot.settings.builtinTheme)
    setFocusY(snapshot.settings.focusY)
    setGlassStrength(snapshot.settings.glassStrength)
    setFileLabel(appearanceLabel(snapshot.settings, t))
  }, [draftDirty, snapshot.settings, t])

  useEffect(() => () => {
    if (selectedUrl !== undefined) URL.revokeObjectURL(selectedUrl)
  }, [selectedUrl])

  const previewStyle = useMemo(() => ({
    '--fde-preview-image': previewUrl === null ? 'none' : `url("${previewUrl}")`,
    '--fde-preview-position': previewUrl === null ? 'center' : `center ${String(focusY)}%`,
    '--fde-preview-overlay-alpha': String(0.18 + glassStrength / 100 * 0.22),
  }) as CSSProperties, [focusY, glassStrength, previewUrl])

  const selectFile = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file === undefined) return
    const issue = validateImageFile(file)
    if (issue !== undefined) {
      setLocalError(true)
      setLocalMessage(t(issue === 'unsupported-type' ? 'error.fileType' : 'error.fileSize'))
      return
    }
    if (selectedUrl !== undefined) URL.revokeObjectURL(selectedUrl)
    const url = URL.createObjectURL(file)
    setSelectedUrl(url)
    setDraftTheme(null)
    setDraftDirty(true)
    setPreviewUrl(url)
    setFocusY(50)
    setFileLabel(`${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} MB`)
    setLocalError(false)
    setLocalMessage(t('message.localOnly'))
  }

  const selectBuiltinTheme = (themeId: BuiltinAppearanceTheme): void => {
    const theme = BUNDLED_APPEARANCE_THEMES[themeId]
    setSelectedUrl(undefined)
    setDraftTheme(themeId)
    setDraftDirty(true)
    setPreviewUrl(theme.imageUrl)
    setFocusY(theme.focusY)
    setGlassStrength(theme.glassStrength)
    setFileLabel(`${t('themes.heading')} · ${t(THEME_COPY[themeId].name)}`)
    setLocalError(false)
    setLocalMessage(t('message.preview'))
  }

  const save = async (): Promise<void> => {
    setLocalError(false)
    setLocalMessage(t('message.processing'))
    let persisting = false
    try {
      let imageDataUrl = snapshot.settings.imageDataUrl
      let palette = snapshot.settings.palette
      if (draftTheme !== null) {
        const theme = BUNDLED_APPEARANCE_THEMES[draftTheme]
        if (theme.imageUrl !== null) await loadImage(theme.imageUrl)
        imageDataUrl = null
        palette = theme.palette
      } else if (selectedUrl !== undefined) {
        const image = await loadImage(selectedUrl)
        const canvas = renderBackground(image, focusY)
        imageDataUrl = canvas.toDataURL('image/webp', 0.86)
        palette = extractPalette(canvas)
      }
      persisting = true
      await saveAppearance({ builtinTheme: draftTheme, imageDataUrl, focusY, glassStrength, palette })
      if (selectedUrl !== undefined) URL.revokeObjectURL(selectedUrl)
      setSelectedUrl(undefined)
      setDraftDirty(false)
      setLocalMessage(t('message.saved'))
    } catch (error) {
      setLocalError(true)
      setLocalMessage(messageOf(error) === 'processed-image-too-large'
        ? t('error.processedTooLarge')
        : t(persisting ? 'issue.save-failed' : 'error.process'))
    }
  }

  const reset = async (): Promise<void> => {
    setLocalError(false)
    try {
      await resetAppearance()
      if (selectedUrl !== undefined) URL.revokeObjectURL(selectedUrl)
      setSelectedUrl(undefined)
      setDraftTheme(DEFAULT_BUILTIN_APPEARANCE_THEME)
      setDraftDirty(false)
      const theme = BUNDLED_APPEARANCE_THEMES[DEFAULT_BUILTIN_APPEARANCE_THEME]
      setPreviewUrl(theme.imageUrl)
      setFocusY(theme.focusY)
      setGlassStrength(theme.glassStrength)
      setFileLabel(`${t('themes.heading')} · ${t(THEME_COPY[DEFAULT_BUILTIN_APPEARANCE_THEME].name)}`)
      setLocalMessage(t('message.reset'))
    } catch {
      setLocalError(true)
      setLocalMessage(t('issue.save-failed'))
    }
  }

  const controllerIssue = snapshot.issue === undefined ? undefined : issueText(snapshot.issue, t)

  return (
    <section className={css.section}>
      <div>
        <h2 className={css.title}>{t('title')}</h2>
        <p className={css.intro}>{t('intro')}</p>
      </div>
      <div>
        <h3 className={css.themeHeading}>{t('themes.heading')}</h3>
        <div className={css.themeGrid} role="group" aria-label={t('themes.heading')}>
          {(Object.keys(BUNDLED_APPEARANCE_THEMES) as BuiltinAppearanceTheme[]).map((themeId) => {
            const theme = BUNDLED_APPEARANCE_THEMES[themeId]
            const selected = selectedUrl === undefined && draftTheme === themeId
            return (
              <button
                key={themeId}
                type="button"
                className={css.themeCard}
                aria-pressed={selected}
                disabled={busy}
                onClick={() => { selectBuiltinTheme(themeId) }}
              >
                <span
                  className={`${css.themeThumbnail}${theme.imageUrl === null ? ` ${css.originalThemeThumbnail}` : ''}`}
                  style={{ backgroundImage: theme.imageUrl === null ? 'none' : `url("${theme.imageUrl}")` }}
                >
                  {theme.imageUrl === null && <span className={css.originalThemeLabel}>{t('theme.original')}</span>}
                  {selected && <span className={css.themeSelected}>{t('theme.selected')}</span>}
                </span>
                <span className={css.themeDetails}>
                  <strong>
                    {t(THEME_COPY[themeId].name)}
                    {themeId === DEFAULT_BUILTIN_APPEARANCE_THEME ? ` · ${t('theme.default')}` : ''}
                  </strong>
                  <small>{t(THEME_COPY[themeId].description)}</small>
                </span>
              </button>
            )
          })}
        </div>
      </div>
      <div
        className={`${css.preview}${previewUrl === null ? ` ${css.originalPreview}` : ''}`}
        style={previewStyle}
        role="img"
        aria-label={t('preview.aria')}
      >
        <div className={css.previewChrome}>
          <span />
          <strong>{t('preview.product')}</strong>
        </div>
        <div className={css.previewGlass}>
          <span>{t('preview.title')}</span>
          <small>{t('preview.format')}</small>
        </div>
      </div>
      <div className={css.fileRow}>
        <div>
          <strong>{fileLabel}</strong>
          <small>{t('custom.support')}</small>
        </div>
        <label className={css.secondaryButton}>
          {t('custom.choose')}
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={selectFile} />
        </label>
      </div>
      <label className={css.rangeRow}>
        <span><b>{t('control.focus')}</b><output>{focusY}%</output></span>
        <input type="range" min="0" max="100" value={focusY} disabled={busy || originalSelected} onChange={(event) => { setFocusY(Number(event.target.value)); setDraftDirty(true) }} />
      </label>
      <label className={css.rangeRow}>
        <span><b>{t('control.glass')}</b><output>{glassStrength}%</output></span>
        <input type="range" min="35" max="92" value={glassStrength} disabled={busy || originalSelected} onChange={(event) => { setGlassStrength(Number(event.target.value)); setDraftDirty(true) }} />
      </label>
      {(localMessage ?? controllerIssue) !== undefined && (
        <p className={localError || snapshot.status === 'error' ? css.error : css.notice} role="status">
          {localMessage ?? controllerIssue}
        </p>
      )}
      <div className={css.actions}>
        <button type="button" className={css.primaryButton} disabled={busy} onClick={() => { void save() }}>
          {busy ? t('action.saving') : t('action.save')}
        </button>
        <button type="button" className={css.secondaryButton} disabled={busy} onClick={() => { void reset() }}>
          {t('action.reset')}
        </button>
      </div>
    </section>
  )
}

function appearanceLabel(
  settings: AppearanceSettings,
  t: AppearanceSectionProps['t'],
): string {
  if (settings.builtinTheme !== null) {
    return `${t('themes.heading')} · ${t(THEME_COPY[settings.builtinTheme].name)}`
  }
  return t('custom.current')
}

function issueText(issue: AppearanceIssue, t: AppearanceSectionProps['t']): string {
  switch (issue) {
    case 'invalid-stored-value': return t('issue.invalid-stored-value')
    case 'storage-unavailable': return t('issue.storage-unavailable')
    case 'save-failed': return t('issue.save-failed')
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
