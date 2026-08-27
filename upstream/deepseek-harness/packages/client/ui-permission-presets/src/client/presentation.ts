/** Machine value of the preset that requires an explicit GUI risk gate. */
export const FULL_ACCESS_PRESET = 'danger-full-access'
const READ_ONLY_PRESET = 'read-only'
const WORKSPACE_WRITE_PRESET = 'workspace-write'

/** Locale keys for the three built-in permission products. */
export type PermissionPresetLabelKey = 'preset.readOnly' | 'preset.workspaceWrite' | 'preset.fullAccess'

/** Translation face shared by the two permission locale namespaces. */
export type PermissionPresetTranslate = (key: PermissionPresetLabelKey) => string

/**
 * Convert conventional kebab-case preset names into user-facing title case.
 * @param name - host-supplied preset label or key.
 * @returns the title-cased conventional key, or a non-kebab label unchanged.
 */
export function displayPresetName(name: string): string {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) return name
  return name.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}

function usesBuiltInName(value: string, name: string): boolean {
  if (name === value) return true
  const displayed = displayPresetName(name)
  if (value === READ_ONLY_PRESET) return displayed === 'Read Only'
  if (value === WORKSPACE_WRITE_PRESET) return displayed === 'Workspace Write'
  if (value === FULL_ACCESS_PRESET) return displayed === 'Full Access' || displayed === 'Full access'
  return false
}

/**
 * Render a permission preset under its product label.
 * @param value - preset machine value.
 * @param name - host-supplied preset name.
 * @param t - optional active-locale translator for built-in presets.
 * @returns the localized built-in product label or conventional custom name.
 */
export function displayPermissionPreset(value: string, name: string, t?: PermissionPresetTranslate): string {
  if (!usesBuiltInName(value, name)) return displayPresetName(name)
  if (value === READ_ONLY_PRESET) return t?.('preset.readOnly') ?? 'Read Only'
  if (value === WORKSPACE_WRITE_PRESET) return t?.('preset.workspaceWrite') ?? 'Workspace Write'
  if (value === FULL_ACCESS_PRESET) return t?.('preset.fullAccess') ?? 'Full access'
  return displayPresetName(name)
}
