import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
import { LOADER_SMOKE_TEST_TIMEOUT_MS, runLoaderSmoke } from '@deepseek-ai/dsh-loader-smoke'

it('loads generic FDE gates and read-only query schema through the shipped Web composition', async () => {
  const binScript = fileURLToPath(new URL('./fixtures/fde-generality/snapshot.ts', import.meta.url))
  const output = await runLoaderSmoke({
    label: 'FDE generality Web Host snapshot',
    tempDirPrefix: 'fde-generality-loader-',
    binScript,
    libBinScript: binScript,
    configPath: fileURLToPath(new URL('./fixtures/fde-generality/cordis.yml', import.meta.url)),
    tsconfigPath: fileURLToPath(new URL('../../../tsconfig.json', import.meta.url)),
    env: { FDE_SEMANTICA_PYTHON: 'python3', FDE_SEMANTICA_SOURCE: '' },
  })
  expect(JSON.parse(output.stdout)).toMatchSnapshot()
}, LOADER_SMOKE_TEST_TIMEOUT_MS)
