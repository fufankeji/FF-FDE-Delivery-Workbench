/** Default Web and Desktop directory-picker pairs, without corrective test overlays. */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
import { composeEntries, loadOverlayPatches, loadProfile } from '@deepseek-ai/dsh-app-boot'

it('ships one complete browse pair and replaces both faces in the Desktop overlay', () => {
  const home = mkdtempSync(join(tmpdir(), 'fde-directory-profile-'))
  try {
    const anchor = fileURLToPath(new URL('../../../../package.json', import.meta.url))
    const profile = loadProfile('dsh web', 'web', anchor, home)
    expect(profile.patches).toEqual([])
    // The CLI owns this launcher row; all directory-picker entries still come from the shipped bundles.
    const layers = [[{ insert: [{ id: '$main', name: '$main' }] }], ...profile.layers.map(layer => layer.patches), profile.patches]
    const warnings: string[] = []
    const activePickers = (rows: ReturnType<typeof composeEntries>) => rows
      .filter(row => row.disabled !== true && row.name?.includes('directory-picker'))
      .map(row => row.name).sort()
    expect(activePickers(composeEntries(layers, message => warnings.push(message)))).toEqual([
      '@deepseek-ai/dsh-client-ui-directory-picker-browse', '@deepseek-ai/dsh-host-directory-picker-browse',
    ])
    const overlay = fileURLToPath(new URL('../../../../../desktop-host/config/desktop.cordis.patch.yml', import.meta.url))
    expect(activePickers(composeEntries([...layers, loadOverlayPatches('dsh desktop', overlay)], message => warnings.push(message))))
      .toEqual(['@deepseek-ai/dsh-client-ui-directory-picker-native', '@deepseek-ai/dsh-host-directory-picker-native'])
    expect(warnings).toEqual([])
  } finally { rmSync(home, { recursive: true, force: true }) }
})
