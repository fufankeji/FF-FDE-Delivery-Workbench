/** Compose the Chinese challenge through the laboratory's child slot and the resource registry. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-resources/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-fde-discovery-lab/client'
import type { ChallengeView } from '@deepseek-ai/dsh-fde-scenario-challenge/types'
import { ChallengeClient } from './resource.ts'
import { NS, zh } from './locales.ts'
import { ChallengePage } from './ChallengePage.tsx'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface ResourceProtocolMap { 'fde-challenge': ChallengeView }
}

/** Services required before registering the page and its resource protocol. */
export const inject = ['slots', 'resources', 'locale']

/** Install only local challenge UI; no session or project service is requested.
 * @param ctx - Client plugin context.
 */
export function apply(ctx: Context): void {
  const client = new ChallengeClient()
  ctx.effect(() => () => client.dispose(), 'fde-challenge: requests')
  ctx.effect(() => ctx.locale.register(NS, { zh, en: zh }), 'fde-challenge: Chinese copy')
  ctx.effect(() => ctx.resources.register<'fde-challenge'>({
    protocol: 'fde-challenge', open: (_address, { signal }) => client.watch(signal),
  }), 'fde-challenge: resource')
  ctx.effect(() => {
    window.addEventListener('focus', client.refresh)
    return () => window.removeEventListener('focus', client.refresh)
  }, 'fde-challenge: resume on focus')
  ctx.slots.inject('fde.workbench.lab.challenge', () => ctx.slots.register({
    name: 'fde.workbench.lab.challenge', locale: NS,
    inject: () => ({ refresh: client.refresh, mutate: client.mutate.bind(client) }),
  }, ChallengePage))
}
