/** Build the pinned FDE eval plugin whose Git package omits its compiled entry. */
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import ts from 'typescript'

const require = createRequire(new URL('../packages/bundle/web-app/package.json', import.meta.url))
const root = dirname(require.resolve('dsh-eval-harness/package.json'))
const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as { version: string }
if (manifest.version !== '0.4.0') throw new Error('Review the FDE eval build adapter before changing its pinned version')
await mkdir(join(root, 'lib'), { recursive: true })
for (const file of await readdir(join(root, 'src'))) {
  if (!file.endsWith('.ts')) continue
  let source = await readFile(join(root, 'src', file), 'utf8')
  if (file === 'runner.ts') {
    const old = "entry.name === 'session.jsonl' || entry.name === 'session.jsonl.zstd'"
    if (!source.includes(old)) throw new Error('Pinned eval Session discovery no longer matches the reviewed patch')
    source = source.replace(old, '/^session(?:\\.v\\d+)?\\.jsonl(?:\\.zstd)?$/.test(entry.name)')
  }
  const output = ts.transpileModule(source, {
    fileName: file,
    compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext, verbatimModuleSyntax: true },
    reportDiagnostics: true,
  })
  if (output.diagnostics?.some(diagnostic => diagnostic.category === ts.DiagnosticCategory.Error)) {
    throw new Error(`Cannot compile pinned eval source ${file}`)
  }
  await writeFile(join(root, 'lib', file.replace(/\.ts$/, '.js')), output.outputText)
}
console.log('FDE integrations: built dsh-eval-harness 0.4.0 with versioned Session discovery')
