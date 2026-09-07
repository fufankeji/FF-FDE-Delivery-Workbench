import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { configureDesignRoute, createAgentContext, queryAgentContext, readSemanticWorkspace } from '../src/state.ts'

const roots: string[] = []
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))) })
const config = { pythonCommand: 'python3', operationTimeoutMs: 5000, maxSourceBytes: 100000, maxSources: 4 }

it('consumes another domain through the real Python bridge without changing confirmed design files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'fde-context-consume-'))
  roots.push(root)
  const base = await configureDesignRoute(root, { execution: { mechanism: 'software', label: '出版检索', rationale: '查作者与文章' }, semantics: { mode: 'ontology', rationale: '跨来源统一作者身份' } })
  const graph = { entities: [{ id: 'author', type: 'Author', name: 'Lin', confidence: .9, sourceRefs: ['source-1'] }], relationships: [] }
  const state = {
    ...base,
    provider: { ...base.provider, status: 'ready' as const, version: '0.6.7' },
    definition: { ...base.definition, status: 'published' as const, digest: 'definition-1' },
    sources: [{ sourceId: 'source-1', permissionScope: '项目资料读取' }],
    validation: { status: 'passed', checksVersion: 'project-constraints-v1', definitionDigest: 'definition-1', graphRevision: 'graph-1' },
    slice: { status: 'succeeded' }, route: { ...base.route!, conclusion: 'validated' },
  }
  // This test seeds a confirmed record, not a claim that the SDK build ran.
  const evidenceDigest = 'test-confirmed-evidence-digest'
  await writeFile(join(root, '.fde/design/semantica/workspace.json'), JSON.stringify({ ...state, evidenceDigest, decision: { outcome: 'go', evidenceDigest } }))
  await writeFile(join(root, '.fde/design/semantica/graph.json'), JSON.stringify(graph))
  await writeFile(join(root, '.fde/design/knowledge-graph.json'), JSON.stringify({ revision: 'graph-1' }))
  const paths = ['.fde/design/semantica/workspace.json', '.fde/design/semantica/graph.json', '.fde/design/knowledge-graph.json', '.fde/stages/design.json', 'fde-deliverables/04-solution-design/mechanism-selection.md']
  const before = await Promise.all(paths.map(path => readFile(join(root, path), 'utf8')))
  const result = await queryAgentContext(root, config, { seedNodeId: 'author', query: '查看作者来源', maxDepth: 1 })
  expect(result.entities).toHaveLength(1)
  expect(result.graphRevision).toBe('graph-1')
  expect(await Promise.all(paths.map(path => readFile(join(root, path), 'utf8')))).toEqual(before)
  await expect(queryAgentContext(root, config, { query: '只传文字', maxDepth: 1 })).rejects.toThrow('questionId')
  await expect(queryAgentContext(root, config, { seedNodeId: 'other-project', query: '不属于本项目', maxDepth: 1 })).rejects.toThrow()
  expect(await readFile(join(root, paths[0]!), 'utf8')).toBe(before[0])
  await mkdir(join(root, '.fde/design/semantica/runs'), { recursive: true })
  await createAgentContext(root, config, { seedNodeId: 'author', query: '显式编制验证', maxDepth: 1 })
  expect(await readSemanticWorkspace(root)).toMatchObject({ slice: { status: 'stale' }, route: { conclusion: 'pending' } })
})
