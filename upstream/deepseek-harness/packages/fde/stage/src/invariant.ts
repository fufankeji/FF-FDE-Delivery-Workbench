/** Package-owned invariant companion for FDE project stage. @module @deepseek-ai/dsh-fde-stage/invariant */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-fde-stage'

/** Cordis companion plugin name. */
export const name = 'fde-stage-invariant'
/** Service required before reserving package ownership. */
export const inject = ['invariants']

/** No runtime invariant: storage-domain validates each record and serializes every write. */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant registry.
 * @returns the registration disposer.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
