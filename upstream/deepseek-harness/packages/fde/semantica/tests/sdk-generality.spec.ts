import { expect, it } from 'vitest'
import { runSemantica } from '../src/python.ts'
import type { SemanticEntityCandidate, SemanticRelationshipCandidate } from '../src/types.ts'

const pythonCommand = process.env.FDE_SEMANTICA_TEST_PYTHON
const withRuntime = pythonCommand === undefined ? it.skip : it

withRuntime('uses the real SDK for publishing identities, project constraints and time-filtered context', async () => {
  const config = { pythonCommand: pythonCommand!, operationTimeoutMs: 60_000, maxSourceBytes: 100_000, maxSources: 2 }
  const definition = {
    version: '1.0', confidenceThreshold: .6, shaclSeverity: 'Violation',
    classes: [
      {
        id: 'Author', label: '作者', aliases: [], identityKeys: ['email'],
        properties: [{ id: 'email', label: '邮箱', dataType: 'string', required: true, unique: true }],
        fieldMappings: [{ sourceField: 'email', targetProperty: 'email' }],
        extractionPatterns: ['AUTHOR\\|(?<label>[^|\\n]+)\\|(?<email>[^\\n]+)'],
      },
      { id: 'Article', label: '文章', aliases: [], identityKeys: ['name'], properties: [], fieldMappings: [], extractionPatterns: ['ARTICLE\\|(?<label>[^\\n]+)'] },
    ],
    relationships: [{ id: 'writes', label: '撰写', domain: 'Author', range: 'Article', cardinality: 'one-to-many', extractionPatterns: ['WRITES\\|(?<source>[^|\\n]+)\\|(?<target>[^\\n]+)'] }],
    competencyQuestions: [{ id: 'authors', text: '列出独立作者身份', query: { kind: 'lookup', sourceType: 'Author', minAnswers: 3 } }],
    provenanceRules: [], temporalRules: [],
  }
  const extracted = await runSemantica<{ entities: SemanticEntityCandidate[]; relationships: SemanticRelationshipCandidate[]; warnings: string[] }>(config, 'extract', {
    definition,
    documents: [{ sourceId: 'publishing-one', name: 'authors.txt', text: 'AUTHOR|Lin|lin.one@example.test\nAUTHOR|Lin|lin.two@example.test\nAUTHOR|Mei|mei@example.test\nARTICLE|Research\nWRITES|Mei|Research\nWRITES|Lin|Research\n' }],
  })
  expect(extracted.entities).toHaveLength(4)
  const lins = extracted.entities.filter(entity => entity.label === 'Lin')
  expect(lins).toHaveLength(2)
  expect(new Set(lins.map(entity => entity.id)).size).toBe(2)
  expect(extracted.relationships).toHaveLength(1)
  expect(extracted.warnings).toContain('关系 writes 的类型限定端点缺失或有歧义，未自动连接。')
  expect(extracted.warnings.some(warning => warning.includes('Semantica 实体抽取失败'))).toBe(false)

  const published = await runSemantica<{ shacl: string; ontology: { classes: unknown[] } }>(config, 'publish-schema', { definition })
  expect(published.ontology.classes).toHaveLength(2)
  expect(published.shacl).toContain('email')
  type Graph = { entities: { id: string; type: string; properties: Record<string, unknown>; validUntil?: string }[]; relationships: { id: string; source: string; target: string; validUntil?: string }[] }
  const built = await runSemantica<{ graph: Graph }>(config, 'build', { definition, entities: extracted.entities, relationships: extracted.relationships })
  type Validation = { structural: { is_valid: boolean; issues: { code?: string }[] }; questions: { status: string }[] }
  const valid = await runSemantica<Validation>(config, 'validate', { definition, graph: built.graph, allowedSourceIds: ['publishing-one'] })
  expect(valid.structural.is_valid).toBe(true)
  expect(valid.questions[0]?.status).toBe('passed')

  const invalid = structuredClone(built.graph)
  const authors = invalid.entities.filter(entity => entity.type === 'Author')
  const article = invalid.entities.find(entity => entity.type === 'Article')!
  delete authors[0]!.properties.email
  authors[1]!.properties.email = 123
  const edge = invalid.relationships[0]!
  edge.target = edge.source
  invalid.relationships.push({ ...built.graph.relationships[0]!, id: 'another-writer', source: authors[0]!.id, target: article.id })
  invalid.relationships.push({ ...built.graph.relationships[0]!, id: 'third-writer', source: authors[1]!.id, target: article.id })
  const rejected = await runSemantica<Validation>(config, 'validate', { definition, graph: invalid, allowedSourceIds: ['publishing-one'] })
  expect(rejected.structural.is_valid).toBe(false)
  expect(rejected.structural.issues.map(issue => issue.code)).toEqual(expect.arrayContaining(['required', 'identity-missing', 'datatype', 'domain-range', 'cardinality']))

  const expired = structuredClone(built.graph)
  expired.entities.find(entity => entity.type === 'Author')!.validUntil = '2020-01-01T00:00:00Z'
  const context = await runSemantica<{ entities: { id: string }[] }>(config, 'context', { definition, graph: expired, questionId: 'authors', query: '列出仍有效的作者', allowedSourceIds: ['publishing-one'], asOf: '2026-09-07T00:00:00Z' })
  expect(context.entities).toHaveLength(2)
  expect(context.entities.some(entity => entity.id === expired.entities.find(entity => entity.validUntil)?.id)).toBe(false)
  const excluded = await runSemantica<{ entities: unknown[] }>(config, 'context', { definition, graph: built.graph, questionId: 'authors', query: '另一个项目的上下文', allowedSourceIds: ['another-project'] })
  expect(excluded.entities).toEqual([])
}, 120_000)
