/** Package invariant ownership. */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'
/** Companion name. */
export const name = 'fde-discovery-lab-invariant'
/** Registry dependency. */
export const inject = ['invariants']
/** No runtime invariant: SQLite constraints and scoped tools enforce training ownership at mutation time. */
const install: InvariantInstaller = () => {}
/** Reserve the package's invariant scope. */
export const apply = (ctx: Context): Promise<() => void> => Promise.resolve(ctx.invariants.register('@deepseek-ai/dsh-fde-discovery-lab', install))
