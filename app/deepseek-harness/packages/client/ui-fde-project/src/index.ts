/** Empty node half for the browser-only FDE project presentation plugin. */

/** Cordis plugin name. */
export const name = 'client-ui-fde-project'

/** Browser behavior lives in the package's `./client` entry. */
export function apply(): void {}

/** No model-facing content: this package only presents project state. */
export const modelExperience = 'none'
