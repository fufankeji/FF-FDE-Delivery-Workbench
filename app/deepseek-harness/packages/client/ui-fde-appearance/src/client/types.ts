/** Accent, deep, mist, and highlight colors derived from one background. */
export type AppearancePalette = readonly [string, string, string, string]

/** Stable identifiers for skins bundled with the FDE Web frontend. */
export type BuiltinAppearanceTheme =
  | 'official'
  | 'whale-maid'
  | 'cloud-cat'
  | 'jiutian-deep-space'
  | 'jiutian-quantum-glass'
  | 'jiutian-dawn-horizon'

/** Browser-local persisted appearance values. */
export interface AppearanceSettings {
  readonly builtinTheme: BuiltinAppearanceTheme | null
  readonly imageDataUrl: string | null
  readonly focusY: number
  readonly glassStrength: number
  readonly palette: AppearancePalette
}
