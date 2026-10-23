import { clientBundle } from '../tsdown.client.ts'
import { buildApp } from './scripts/build-app.mjs'
const base = clientBundle(import.meta.dirname, ['lib/types/index.js'])
export default (options: Parameters<typeof base>[0]) => {
  const configs = base(options)
  return configs.map((config, index) => index === configs.length - 1 && config.entry ? { ...config, onSuccess: buildApp } : config)
}
