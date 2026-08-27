/** FDE project-resource browser surface: one project-row upload action. */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import { ProjectResourceUploadAction } from './ProjectResourceUploadAction.tsx'
import { en, zh, type FdeSourcesKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Project resource intake copy. */
    fdeSources: FdeSourcesKey
  }
}

/** Required services for the project action Slot and bilingual copy. */
export const inject = ['slots', 'locale']

/**
 * Register the project resource action after ui-workspace declares its child Slot.
 * @param ctx - browser root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register('fdeSources', { zh, en }), 'ui-fde-sources: dictionaries')
  ctx.slots.inject('sidebar.workspaces.projectActions', () => ctx.slots.register({
    name: 'sidebar.workspaces.projectActions',
    id: 'fde-project-resources',
    order: 10,
    locale: 'fdeSources',
  }, ProjectResourceUploadAction))
}
