import { clientBundle } from '../tsdown.client.ts'
import { buildApp } from './scripts/build-app.mjs'
const base = clientBundle('@deepseek-ai/dsh-client-ui-fde-discovery-lab', ['lib/types/index.js', 'lib/types/invariant.js'])
export default (options: Parameters<typeof base>[0]) => {
  const configs = base(options)
  return configs.map((config, index) => index === configs.length - 1 && config.entry ? { ...config, onSuccess: buildApp } : config)
}
