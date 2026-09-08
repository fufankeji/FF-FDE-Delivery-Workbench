import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execa } from 'execa'
import { expect, it } from 'vitest'

it('loads the real tool composition, reports missing work, denies human actions and disposes registrations', async () => {
  const root = await mkdtemp(join(tmpdir(), 'fde-semantic-tools-'))
  try {
    const result = await execa(process.execPath, ['--import', 'tsx/esm', fileURLToPath(new URL('./fixtures/driver.ts', import.meta.url))], {
      env: { DSH_HOME: join(root, 'home'), FDE_TEST_ROOT: root }, timeout: 30_000,
    })
    expect(JSON.parse(result.stdout)).toEqual({
      humanActions: ['在项目工作台确认实现方式和是否采用本体。'],
      definition: { status: 'missing', version: '0.1.0', revision: 0, competencyQuestions: [] },
      candidates: { status: 'not_run', total: 0, pending: 0 },
      publicationDenied: true, missingRouteDenied: true, disposed: true,
    })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}, 40_000)

it.skipIf(!process.env.FDE_SEMANTICA_TEST_PYTHON)('uses real SDK operations through Agent tools and consumes the graph without changing design evidence', async () => {
  const root = await mkdtemp(join(tmpdir(), 'fde-semantic-sdk-tools-'))
  try {
    await writeFile(join(root, 'definition.json'), JSON.stringify({
      version: '1.0', confidenceThreshold: .6, shaclSeverity: 'Violation', provenanceRules: [], temporalRules: [],
      classes: [
        { id: 'Author', label: '作者', aliases: [], identityKeys: ['name'], properties: [], fieldMappings: [], extractionPatterns: ['AUTHOR\\|(?<label>[^\\n]+)'] },
        { id: 'Article', label: '作品', aliases: [], identityKeys: ['name'], properties: [], fieldMappings: [], extractionPatterns: ['ARTICLE\\|(?<label>[^\\n]+)'] },
      ],
      relationships: [{ id: 'writes', label: '撰写', domain: 'Author', range: 'Article', cardinality: 'one-to-many', extractionPatterns: ['WRITES\\|(?<source>[^|\\n]+)\\|(?<target>[^\\n]+)'] }],
      competencyQuestions: [{ id: 'author_articles', text: '谁撰写了哪些作品？', required: true, query: { kind: 'edge', sourceType: 'Author', relationshipType: 'writes', targetType: 'Article', maxDepth: 1, minAnswers: 1 } }],
    }))
    const result = await execa(process.execPath, ['--import', 'tsx/esm', fileURLToPath(new URL('./fixtures/driver.ts', import.meta.url))], {
      env: { DSH_HOME: join(root, 'home'), FDE_TEST_ROOT: root, FDE_TEST_SDK: '1' }, timeout: 120_000,
    })
    expect((JSON.parse(result.stdout) as { sdk: unknown }).sdk).toEqual({
      author: 'Lin', article: 'Research', sourceCount: 1, validation: 'passed', mutation: false, staleSourceDenied: true, decision: null,
    })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}, 125_000)
