/** Package-owned invariant companion for the FDE stage UI. @module @deepseek-ai/dsh-client-ui-fde-stage/invariant */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-client-ui-fde-stage'

/** Cordis companion plugin name. */
export const name = 'client-ui-fde-stage-invariant'
/** Service required before reserving package ownership. */
export const inject = ['invariants']

/** No runtime invariant: Slot registrations and the controller share one apply lifetime. */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant registry.
 * @returns the registration disposer.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
