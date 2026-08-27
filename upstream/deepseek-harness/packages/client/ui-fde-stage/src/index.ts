/** Empty node half for the browser-only FDE stage presentation plugin. */

/** Cordis plugin name. */
export const name = 'client-ui-fde-stage'

/** Browser behavior lives in the package's `./client` entry. */
export function apply(): void {}

/** No model-facing content: this package only projects Host stage state. */
export const modelExperience = 'none'
