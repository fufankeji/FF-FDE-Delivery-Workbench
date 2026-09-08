import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseProjectSource, registerStoredProjectResources } from '@deepseek-ai/dsh-fde-source'
import { storeProjectResourceBatch } from '@deepseek-ai/dsh-fde-source/src/upload.ts'
import {
  DESIGN_GRAPH_PATH,
  DESIGN_STAGE_PATH,
  bindSemanticSources,
  buildGraph,
  checkProvider,
  configureDesignRoute,
  createAgentContext,
  queryAgentContext,
  extractCandidates,
  proposeSchema,
  publishSchema,
  recordFdeDesignDecision,
  reportVerticalSlice,
  reviewCandidates,
  saveSemanticDefinition,
  validateGraph,
  readSemanticWorkspace,
} from '../src/index.ts'
import type { SemanticProviderConfig } from '../src/types.ts'

const ontologyRoute = {
  execution: { mechanism: 'agent', label: '受控 Agent 工作流', rationale: '需要读取当前项目事实并形成可核对候选。' },
  semantics: { mode: 'ontology', rationale: '必须验证跨对象关系、来源和受控上下文查询。' },
} as const

const definition = {
  version: '0.1.0',
  competencyQuestions: [{
    id: 'cq_owner_system', text: '哪个负责人关联哪个系统？', required: true,
    query: { kind: 'edge', sourceType: 'Person', relationshipType: 'owns', targetType: 'System', maxDepth: 1, minAnswers: 1 },
  }],
  classes: [
    {
      id: 'Person', label: '负责人', aliases: ['责任人'], identityKeys: ['name'], properties: [], fieldMappings: [],
      extractionPatterns: ['负责人[:：]\\s*(?<label>[\\u4e00-\\u9fff]{2,8})'],
    },
    {
      id: 'System', label: '系统', aliases: [], identityKeys: ['name'], properties: [], fieldMappings: [],
      extractionPatterns: ['系统[:：]\\s*(?<label>[\\u4e00-\\u9fff]{2,12})'],
    },
  ],
  relationships: [{
    id: 'owns', label: '负责', domain: 'Person', range: 'System', cardinality: 'one-to-many',
    extractionPatterns: ['关系[:：]\\s*(?<source>[\\u4e00-\\u9fff]{2,8})\\s*->\\s*(?<target>[\\u4e00-\\u9fff]{2,12})'],
  }],
  provenanceRules: [{ id: 'source_required', label: '来源必填', description: '每条事实必须回指当前项目材料。' }],
  temporalRules: [{ id: 'valid_time', label: '有效时间', description: '变化事实必须记录有效时间。' }],
  confidenceThreshold: 0.65,
  shaclSeverity: 'Violation',
} as const

describe('stage-four Semantica workspace', () => {
  it('keeps the simple route graph-free and accepts only existing project evidence', async () => {
    const root = await mkdtemp(join(tmpdir(), 'fde-semantica-simple-'))
    const selected = await configureDesignRoute(root, {
      execution: { mechanism: 'software', label: '普通软件与规则', rationale: '确定性合同足以实现当前闭环。' },
      semantics: { mode: 'schema', rationale: '当前任务不需要多跳、来源时间或图推理。' },
    })
    expect(selected.route).toMatchObject({ semantics: { mode: 'schema' }, conclusion: 'not_required' })
    await expect(readFile(join(root, DESIGN_GRAPH_PATH), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(reportVerticalSlice(root, {
      status: 'succeeded', task: '运行确定性纵向切片', result: '得到可验证输出', evidenceRefs: ['evidence/missing.log'],
    })).rejects.toThrow()

    await mkdir(join(root, 'evidence'), { recursive: true })
    await writeFile(join(root, 'evidence', 'slice.log'), 'actual run output\n')
    const completed = await reportVerticalSlice(root, {
      status: 'succeeded', task: '运行确定性纵向切片', result: '得到可验证输出', evidenceRefs: ['evidence/slice.log'],
    })
    expect(completed.route?.conclusion).toBe('not_required')
    expect(completed.slice).toMatchObject({ status: 'succeeded', evidenceRefs: ['evidence/slice.log'] })
    expect(JSON.parse(await readFile(join(root, DESIGN_STAGE_PATH), 'utf8'))).toMatchObject({
      stage: 'design', status: 'review-ready',
      design: { semantics: { mode: 'schema', conclusion: 'not_required' }, graphBuild: { status: 'not_applicable' } },
    })
    const decided = await recordFdeDesignDecision(root, completed.revision, 'go', '已核对真实切片证据，进入 PoC 与 Eval。')
    expect(decided.decision).toMatchObject({ outcome: 'go', workspaceRevision: decided.revision, evidenceDigest: decided.evidenceDigest })

    const revised = await configureDesignRoute(root, {
      execution: { mechanism: 'software', label: '普通软件与规则', rationale: '补充了新的执行边界。' },
      semantics: { mode: 'schema', rationale: '普通 Schema 仍足以表达当前闭环。' },
    })
    expect(revised.decision?.evidenceDigest).not.toBe(revised.evidenceDigest)
    expect(await readFile(join(root, 'fde-deliverables/04-solution-design/mechanism-selection.md'), 'utf8')).toContain('上次 FDE 决定待重评')
  })

  it.each(['revise', 'narrow', 'stop'] as const)('persists the %s FDE outcome without pretending to advance', async (outcome) => {
    const root = await mkdtemp(join(tmpdir(), `fde-semantica-${outcome}-`))
    const selected = await configureDesignRoute(root, ontologyRoute)
    const decided = await recordFdeDesignDecision(root, selected.revision, outcome, `${outcome} 的人工依据`)
    expect(decided.decision).toMatchObject({ outcome, rationale: `${outcome} 的人工依据`, routeConclusion: 'pending', semanticMode: 'ontology' })
    expect(decided.decision?.evidenceDigest).toBe(decided.evidenceDigest)

    await expect(recordFdeDesignDecision(root, selected.revision, outcome, '过期提交')).rejects.toThrow('证据已变化')
  })

  const pythonCommand = process.env.FDE_SEMANTICA_TEST_PYTHON
  const withRuntime = pythonCommand === undefined ? it.skip : it

  withRuntime('runs the real pinned Semantica SDK from project source to validated Agent context', async () => {
    const root = await mkdtemp(join(tmpdir(), 'fde-semantica-runtime-'))
    const stored = await storeProjectResourceBatch(root, [{
      name: '现场记录.md',
      data: Buffer.from('# 现场记录\n\n负责人：张三\n系统：工单系统\n关系：张三 -> 工单系统\n'),
    }])
    const [registered] = await registerStoredProjectResources(root, stored)
    if (registered === undefined) throw new Error('source fixture was not registered')
    await parseProjectSource(root, registered.sourceId)

    const config: SemanticProviderConfig = {
      pythonCommand: pythonCommand!, operationTimeoutMs: 60_000, maxSourceBytes: 1_000_000, maxSources: 4,
    }
    await configureDesignRoute(root, ontologyRoute)
    await bindSemanticSources(root, [registered.sourceId], '仅限当前测试项目第四阶段', 'primary')
    const ready = await checkProvider(root, config)
    expect(ready.provider).toMatchObject({ status: 'ready', version: '0.6.7' })

    await saveSemanticDefinition(root, 0, definition)
    const extracted = await extractCandidates(root, config)
    expect(extracted.candidates.entities).toHaveLength(2)
    expect(extracted.candidates.relationships).toHaveLength(1)
    const proposed = await proposeSchema(root, config)
    expect(proposed.definition.classes.length).toBeGreaterThanOrEqual(2)

    await saveSemanticDefinition(root, proposed.definition.revision, definition)
    const current = await extractCandidates(root, config)
    const decisions = [...current.candidates.entities, ...current.candidates.relationships]
      .map(item => ({ id: item.id, decision: 'accepted' as const }))
    await reviewCandidates(root, decisions)
    await publishSchema(root, config)
    const built = await buildGraph(root, config)
    expect(built.runs.at(-1)).toMatchObject({ kind: 'build', status: 'succeeded' })
    const validated = await validateGraph(root, config)
    expect(validated.validation).toMatchObject({ status: 'passed', structuralValid: true })

    const contextState = await createAgentContext(root, config, {
      questionId: 'cq_owner_system', query: '为负责人到系统的最窄任务提供上下文', maxDepth: 1,
    })
    expect(contextState.context).toMatchObject({ status: 'ready', questionId: 'cq_owner_system' })
    expect(contextState.context?.entities).toHaveLength(2)
    expect(contextState.context?.relationships).toHaveLength(1)

    await mkdir(join(root, 'evidence'), { recursive: true })
    await writeFile(join(root, 'evidence', 'slice.log'), 'vertical slice passed\n')
    const completed = await reportVerticalSlice(root, {
      status: 'succeeded', task: '使用受控上下文完成最窄项目任务', result: '负责人和系统关系可查询且带来源',
      contextRunId: contextState.context!.runId, evidenceRefs: ['evidence/slice.log'],
    })
    expect(completed.route?.conclusion).toBe('validated')
    expect(JSON.parse(await readFile(join(root, DESIGN_GRAPH_PATH), 'utf8'))).toMatchObject({
      schemaVersion: 1, provider: { id: 'semantica', version: '0.6.7' },
    })
    const decided = await recordFdeDesignDecision(root, completed.revision, 'go', '当前本体、图谱、上下文和纵向切片证据均已核对。')
    expect(decided.decision?.evidenceDigest).toBe(decided.evidenceDigest)

    const protectedPaths = ['.fde/design/semantica/workspace.json', '.fde/stages/design.json', DESIGN_GRAPH_PATH]
    const beforeConsume = await Promise.all(protectedPaths.map(path => readFile(join(root, path), 'utf8')))
    const consumed = await queryAgentContext(root, config, {
      questionId: 'cq_owner_system', query: '项目开发查询系统的负责人及来源', maxDepth: 1,
    })
    const assignments = consumed.relationships.map(edge => ({
      owner: consumed.entities.find(entity => entity.id === edge.source)?.name,
      system: consumed.entities.find(entity => entity.id === edge.target)?.name,
      sourceIds: edge.sourceRefs,
    }))
    expect(assignments).toEqual([{ owner: '张三', system: '工单系统', sourceIds: [registered.sourceId] }])
    expect(await Promise.all(protectedPaths.map(path => readFile(join(root, path), 'utf8')))).toEqual(beforeConsume)
    await expect(queryAgentContext(root, { ...config, pythonCommand: '/nonexistent/semantica-python' }, {
      questionId: 'cq_owner_system', query: '不可用环境不得读取缓存成功', maxDepth: 1,
    })).rejects.toThrow('无法启动')

    const reExtracted = await extractCandidates(root, config)
    expect(reExtracted.validation?.status).toBe('stale')
    await expect(queryAgentContext(root, config, { questionId: 'cq_owner_system', query: '拒绝旧图', maxDepth: 1 })).rejects.toThrow('同版本独立验证')
    expect((await readSemanticWorkspace(root)).decision?.outcome).toBe('go')

    const rebound = await bindSemanticSources(root, [registered.sourceId], '仅限当前测试项目第四阶段复核', 'primary')
    expect(rebound.route?.conclusion).toBe('pending')
    expect(rebound.runs.find(item => item.kind === 'build')?.status).toBe('stale')
    expect(rebound.validation?.status).toBe('stale')
    expect(rebound.context?.status).toBe('stale')
    expect(rebound.slice?.status).toBe('stale')
    expect(rebound.decision?.evidenceDigest).not.toBe(rebound.evidenceDigest)
  }, 120_000)
})
