/** Package-owned invariant companion for the stage-four Semantica provider. */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-fde-semantica'
export const name = 'fde-semantica-invariant'
export const inject = ['invariants']
/** No runtime invariant: project isolation and evidence guards run at each Provider operation. */
const install: InvariantInstaller = () => {}
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
