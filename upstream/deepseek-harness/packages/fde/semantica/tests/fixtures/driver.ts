import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { boot } from '@deepseek-ai/dsh-app-boot'
import { ToolCallId } from '@deepseek-ai/dsh-llm'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { AgentContextResult } from '../../src/types.ts'

const root = process.env.FDE_TEST_ROOT!
const project = join(root, 'project')
await mkdir(project)
// Loader persists explicit disposal as disabled; each run owns its config copy.
const configPath = join(root, 'cordis.yml')
await writeFile(configPath, await readFile(new URL('./cordis.yml', import.meta.url)))
const ctx = await boot('semantica-tools-test', configPath, undefined, undefined, new URL('./', import.meta.url).href)
try {
  await ctx.workspaceRegistry.create(project)
  const session = ctx.sessions.create(undefined, { meta: { cwd: project } })
  // Direct tool dispatch supplies a real Session; no model or loop turn is claimed.
  const agent = { session, ctx } as unknown as Agent
  const call = async (action: string, input: Record<string, unknown> = {}) => ctx.tools.execute({
    agent, signal: new AbortController().signal, callId: ToolCallId(action),
    name: 'semantic_workspace', arguments: { action, ...input },
  })
  const inspected = await call('inspect')
  assert.equal(inspected.isError, false, JSON.stringify(inspected.content))
  const content = inspected.content[0]
  assert.equal(content?.type, 'text')
  const summary = JSON.parse(content.text) as Record<string, unknown>
  const denied = await call('publish-schema')
  assert.equal(denied.isError, true)
  const unsupported = await ctx.tools.get('semantic_workspace')!.execute({ action: 'publish-schema' }, {
    agent,
  } as never).then(() => false, () => true)
  assert.equal(unsupported, true)
  const noRoute = await call('build')
  assert.equal(noRoute.isError, true)
  await assert.rejects(readFile(join(project, '.fde/design/semantica/workspace.json')), { code: 'ENOENT' })
  let sdk: object | undefined
  if (process.env.FDE_TEST_SDK === '1') {
    const { configureDesignRoute, publishSchema, readSemanticWorkspace, reviewCandidates } = await import('../../src/state.ts')
    const { parseProjectSource, registerStoredProjectResources, resolveProjectSource } = await import('@deepseek-ai/dsh-fde-source')
    const { storeProjectResourceBatch } = await import('../../../source/src/upload.ts')
    const definition: unknown = JSON.parse(await readFile(join(root, 'definition.json'), 'utf8'))
    await configureDesignRoute(project, {
      execution: { mechanism: 'software', label: '出版查询', rationale: '根据资料查询作者作品。' },
      semantics: { mode: 'ontology', rationale: '验证可追踪的作者与作品关系。' },
    })
    const stored = await storeProjectResourceBatch(project, [{ name: 'records.txt', data: Buffer.from('AUTHOR|Lin\nARTICLE|Research\nWRITES|Lin|Research\n') }])
    const [source] = await registerStoredProjectResources(project, stored)
    await parseProjectSource(project, source!.sourceId)
    for (const [action, args] of [
      ['health', {}],
      ['bind-sources', { sourceIds: [source!.sourceId], permissionScope: '当前验证项目读取' }],
      ['save-definition', { expectedRevision: 0, definition }],
      ['extract', {}],
    ] as const) {
      const result = await call(action, args)
      assert.equal(result.isError, false, JSON.stringify(result.content))
    }
    const unapprovedBuild = await call('build')
    assert.equal(unapprovedBuild.isError, true)
    const candidates = (await readSemanticWorkspace(project)).candidates
    // Test actor confirms through the human-owned state operations, not the Agent tool.
    await reviewCandidates(project, [...candidates.entities, ...candidates.relationships].map(item => ({
      id: item.id, decision: 'accepted',
    })))
    await publishSchema(project, {
      pythonCommand: process.env.FDE_SEMANTICA_TEST_PYTHON!, operationTimeoutMs: 60000, maxSourceBytes: 100000, maxSources: 4,
    })
    for (const action of ['build', 'validate']) {
      const result = await call(action)
      assert.equal(result.isError, false, JSON.stringify(result.content))
    }
    const state = await readSemanticWorkspace(project)
    assert.equal(state.validation?.status, 'passed')
    const before = await readFile(join(project, '.fde/design/semantica/workspace.json'), 'utf8')
    const query = () => ctx.tools.execute({
      agent, signal: new AbortController().signal, callId: ToolCallId('consume'), name: 'semantic_context_query',
      arguments: { purpose: 'consume', questionId: 'author_articles', query: '查询作品的作者并列出来源', maxDepth: 1 },
    })
    const consumed = await query()
    assert.equal(consumed.isError, false, JSON.stringify(consumed.content))
    const answer = JSON.parse((consumed.content[0] as { text: string }).text) as AgentContextResult
    const relation = answer.relationships[0]!
    const author = answer.entities.find(item => item.id === relation.source)?.name
    const article = answer.entities.find(item => item.id === relation.target)?.name
    assert.equal(author, 'Lin')
    assert.equal(article, 'Research')
    assert.deepEqual(answer.sources, [source!.sourceId])
    assert.equal(await readFile(join(project, '.fde/design/semantica/workspace.json'), 'utf8'), before)
    const otherProject = join(root, 'another-project')
    await mkdir(otherProject)
    await ctx.workspaceRegistry.create(otherProject)
    const [foreign] = await registerStoredProjectResources(otherProject, await storeProjectResourceBatch(otherProject, [{ name: 'private.txt', data: Buffer.from('other project') }]))
    await parseProjectSource(otherProject, foreign!.sourceId)
    assert.equal((await call('bind-sources', { sourceIds: [foreign!.sourceId], permissionScope: '跨项目尝试' })).isError, true)
    assert.equal(await readFile(join(project, '.fde/design/semantica/workspace.json'), 'utf8'), before)
    const original = await resolveProjectSource(project, source!.sourceId)
    await writeFile(original.path, 'replaced source content')
    assert.equal((await query()).isError, true)
    assert.equal(await readFile(join(project, '.fde/design/semantica/workspace.json'), 'utf8'), before)
    sdk = {
      author, article, sourceCount: answer.sources.length, validation: state.validation?.status,
      mutation: false, staleSourceDenied: true, decision: state.decision ?? null,
    }
  }
  const fiber = [...ctx.loader.entries()].find(entry => entry.options.id === 'semantica')!.fiber!
  await fiber.dispose()
  assert.equal(ctx.tools.get('semantic_workspace'), undefined)
  process.stdout.write(JSON.stringify({
    humanActions: summary.humanActions,
    definition: summary.definition,
    candidates: summary.candidates,
    publicationDenied: denied.isError,
    missingRouteDenied: noRoute.isError,
    disposed: ctx.tools.get('semantic_workspace') === undefined,
    ...(sdk === undefined ? {} : { sdk }),
  }) + '\n')
} finally {
  await ctx.fiber.dispose()
}
