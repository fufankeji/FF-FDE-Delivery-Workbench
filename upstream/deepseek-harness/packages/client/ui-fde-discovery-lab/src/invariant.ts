/** Package invariant ownership. */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'
/** Companion name. */
export const name = 'client-ui-fde-discovery-lab-invariant'
/** Registry dependency. */
export const inject = ['invariants']
/** No runtime invariant: the apply-owned store and slot effects share one plugin lifetime. */
const install: InvariantInstaller = () => {}
/** Reserve the package's invariant scope. */
export const apply = (ctx: Context): Promise<() => void> => Promise.resolve(ctx.invariants.register('@deepseek-ai/dsh-client-ui-fde-discovery-lab', install))
