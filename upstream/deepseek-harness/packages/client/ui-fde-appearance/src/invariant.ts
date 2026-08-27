/** Package-owned invariant companion for the FDE appearance UI. @module @deepseek-ai/dsh-client-ui-fde-appearance/invariant */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-client-ui-fde-appearance'

/** Cordis companion plugin name. */
export const name = 'client-ui-fde-appearance-invariant'
/** Service required before reserving package ownership. */
export const inject = ['invariants']

/** No runtime invariant: one controller lifetime owns the DOM and theme-token effects. */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant registry.
 * @returns the registration disposer.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
