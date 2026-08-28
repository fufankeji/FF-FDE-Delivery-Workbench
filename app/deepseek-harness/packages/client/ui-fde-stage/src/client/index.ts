/** FDE project-stage browser plugin: one shared controller and two contextual Slot entries. */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { FDE_PROJECT_PROGRESS_OPEN_EVENT, FdeStageProgressController } from './controller.ts'
import { StageBlankStatus } from './StageBlankStatus.tsx'
import { StageHeaderStatus } from './StageHeaderStatus.tsx'
import { en, NS, zh, type FdeStageKey } from './locales.ts'
import type { FdeStageInjected } from './slots.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** FDE six-stage project progress copy. */
    fdeStage: FdeStageKey
  }
}

/** Required Slot and locale services. */
export const inject = ['slots', 'locale']

/**
 * Register the blank prompt and active header status.
 * @param ctx - browser root context.
 */
export function apply(ctx: ClientContext): void {
  const controller = new FdeStageProgressController()
  const injected = (): FdeStageInjected => ({
    hooks: { stageProgress: controller },
    loadStage: (workspaceId) => { controller.load(workspaceId) },
    retryStage: (workspaceId) => { controller.retry(workspaceId) },
    openProjectProgress: (workspaceId) => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(FDE_PROJECT_PROGRESS_OPEN_EVENT, { detail: { workspaceId } }))
      }
    },
  })
  ctx.effect(() => () => { controller.dispose() }, 'ui-fde-stage: controller')
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-fde-stage: dictionaries')
  ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
    name: 'conversation.input.dock',
    id: 'fde-stage-blank',
    order: -20,
    locale: NS,
    inject: injected,
  }, StageBlankStatus))

  ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register({
    name: 'conversation.session.header.utilities',
    id: 'fde-stage-current',
    order: -20,
    locale: NS,
    inject: injected,
  }, StageHeaderStatus))

}
