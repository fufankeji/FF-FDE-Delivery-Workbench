import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
/** FDE appearance plugin: one browser-local controller and one settings section. */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-theme/client'
import { AppearanceController, browserAppearanceStorage } from './controller.ts'
import { AppearanceSection } from './AppearanceSection.tsx'
import { en, NS, zh, type FdeAppearanceKey } from './locales.ts'
import type { AppearanceSectionInjected } from './AppearanceSection.tsx'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** FDE skin selection and local-image copy. */
    fdeAppearance: FdeAppearanceKey
  }
}

/** Required Slot, locale, and official theme services. */
export const inject = ['slots', 'locale', 'theme']

/** Register the browser-local theme runtime and its independent settings page. */
export function apply(ctx: ClientContext): void {
  const controller = new AppearanceController(ctx.theme, browserAppearanceStorage())
  ctx.effect(() => controller.start(), 'ui-fde-appearance: runtime')
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-fde-appearance: dictionaries')
  const t = ctx.locale.bind(NS)
  const injected = (): AppearanceSectionInjected => ({
    hooks: { appearance: controller },
    saveAppearance: settings => Promise.resolve().then(() => { controller.save(settings) }),
    resetAppearance: () => Promise.resolve().then(() => { controller.reset() }),
  })
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'fde-appearance',
    order: 30,
    label: () => t('nav'),
    locale: NS,
    inject: injected,
  }, AppearanceSection))
}
