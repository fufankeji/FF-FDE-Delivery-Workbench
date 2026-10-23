import { clientBundle } from '../tsdown.client.ts'

const base = clientBundle(import.meta.dirname, ['lib/types/index.js'])

/** Dynamic Office renderers must remain inside the module-table client artifact. */
export default (input: Parameters<typeof base>[0]) => base(input).map(config =>
  config.name === '@deepseek-ai/dsh-client-ui-fde-document-preview/client'
    ? {
        ...config,
        alias: {
          ...config.alias,
          stream: 'stream-browserify',
          'node:stream': 'stream-browserify',
          buffer: 'buffer/',
          'node:buffer': 'buffer/',
          process: 'process/browser',
          'node:process': 'process/browser',
        },
        outputOptions: { ...config.outputOptions, codeSplitting: false },
      }
    : config)
