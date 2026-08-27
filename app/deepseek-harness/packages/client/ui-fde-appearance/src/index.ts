/** Empty node half for the browser-only FDE appearance plugin. */

/** Cordis plugin name. */
export const name = 'client-ui-fde-appearance'

/** Browser behavior lives in the package's `./client` entry. */
export function apply(): void {}

/** No model-facing content: appearance stays in the browser. */
export const modelExperience = 'none'
