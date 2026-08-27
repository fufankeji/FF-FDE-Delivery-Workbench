/** Package-owned invariant companion for FDE project resources. @module @deepseek-ai/dsh-fde-source/invariant */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-fde-source'

/** Cordis companion plugin name. */
export const name = 'fde-source-invariant'
/** Service required before reserving package ownership. */
export const inject = ['invariants']

/** No runtime invariant: filesystem publication is verified at each request and retains no service relationship. */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant registry.
 * @returns the registration disposer.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
