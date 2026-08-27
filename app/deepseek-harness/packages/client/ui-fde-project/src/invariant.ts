/** Package-owned invariant companion for FDE project UI. */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-client-ui-fde-project'

/** Cordis companion plugin name. */
export const name = 'client-ui-fde-project-invariant'
/** Service required before reserving package ownership. */
export const inject = ['invariants']

/** No runtime invariant: Slot entries and their controllers share one apply lifetime. */
const install: InvariantInstaller = () => {}

/** Register this package's invariant companion. */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
