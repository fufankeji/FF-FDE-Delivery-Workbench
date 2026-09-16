import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-fde-project/client'
import { createLabStore } from './stores.ts'
import { LabLauncher, LabModuleLauncher, LabOverlay } from './LabPage.tsx'
/** Owns navigation only; project state is not a dependency. */
export const inject = ['slots']
/** Add one independent entry and an isolated, returnable full-page overlay. */
export function apply(ctx: ClientContext): void {
  const store = createLabStore()
  ctx.slots.inject('fde.workbench.module.action', () => ctx.slots.register({
    name: 'fde.workbench.module.action', id: 'fde-discovery-lab', order: 10, store,
  }, LabModuleLauncher))
  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
    name: 'sidebar.footer.action', id: 'fde-discovery-lab', order: -19, store,
  }, LabLauncher))
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay', id: 'fde-discovery-lab', order: 20, store,
  }, LabOverlay))
}
