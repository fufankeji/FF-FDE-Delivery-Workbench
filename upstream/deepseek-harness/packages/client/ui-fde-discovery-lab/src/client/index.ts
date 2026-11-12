import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-fde-project/client'
import { createLabStore } from './stores.ts'
import { LabOverlay, LabSummary } from './LabPage.tsx'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    /** Independent challenge, with navigation that never starts business training. */
    'fde.workbench.lab.challenge': { kind: 'single'; scope: 'root'; owner: { active: boolean; openDiscovery: () => void } }
  }
}
/** Owns navigation only; project state is not a dependency. */
export const inject = ['slots']
/** Contribute independent training and its summary to the platform-owned slots. */
export function apply(ctx: ClientContext): void {
  const store = createLabStore()
  ctx.slots.inject('fde.workbench.lab.page', () => ctx.slots.register({
    name: 'fde.workbench.lab.page', store, locale: 'fdeProject',
    children: { 'fde.workbench.lab.challenge': { kind: 'single', scope: 'root' } },
  }, LabOverlay))
  ctx.slots.inject('fde.workbench.lab.summary', () => ctx.slots.register({
    name: 'fde.workbench.lab.summary', locale: 'fdeProject',
  }, LabSummary))
}
