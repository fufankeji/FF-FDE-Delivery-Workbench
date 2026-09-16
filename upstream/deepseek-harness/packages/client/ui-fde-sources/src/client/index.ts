import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
/** FDE project-resource browser surface: one project-row upload action. */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import { ProjectResourceComposerAction, ProjectResourceUploadAction } from './ProjectResourceUploadAction.tsx'
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
  ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
    name: 'conversation.input.left',
    id: 'fde-project-resources-composer',
    order: 20,
    locale: 'fdeSources',
  }, ProjectResourceComposerAction))
}
