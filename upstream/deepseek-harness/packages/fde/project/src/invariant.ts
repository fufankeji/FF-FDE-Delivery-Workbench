/** Package-owned invariant companion for FDE project read models. */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-fde-project'
export const name = 'fde-project-invariant'
export const inject = ['invariants']
/** No runtime invariant: route and tool registrations share the plugin effect lifetime. */
const install: InvariantInstaller = () => {}
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
