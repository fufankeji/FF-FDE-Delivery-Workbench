/** FDE's shipped composition suppresses automatic onboarding, not settings plugins. */
import { fileURLToPath } from 'node:url'
import { loadOverlayPatches } from '@deepseek-ai/dsh-app-boot'
import { expect, it } from 'vitest'

it('disables both automatic dialogs through the shipped Models companion configuration', () => {
  const rows = loadOverlayPatches('onboarding-defaults', fileURLToPath(new URL('../cordis.patch.yml', import.meta.url)))
    .flatMap(patch => patch.insert ?? [])
  const models = rows.filter(row => row.id === 'ui-settings-models')
  expect(models).toHaveLength(1)
  expect(models[0]).toMatchObject({
    name: '@deepseek-ai/dsh-client-ui-settings-models',
    config: { welcomeNotice: false, credentialOnboarding: false },
  })
  for (const id of ['ui-settings', 'ui-settings-models', 'ui-settings-account']) {
    expect(rows.find(row => row.id === id)?.disabled).not.toBe(true)
    expect(rows.find(row => row.id === id)).toBeDefined()
  }
})
