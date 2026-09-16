import type { JsonValue } from '@deepseek-ai/dsh-util-values'
/** Project-scoped Agent preparation, bounded graph context and slice reports. */

import type { Context } from '@deepseek-ai/cordis'
import { defineTool, type ToolRunContext } from '@deepseek-ai/dsh-tools'
import { listProjectSources } from '@deepseek-ai/dsh-fde-source'
import { parseSemanticDefinition } from './definition.ts'
import { bindSemanticSources, buildGraph, checkProvider, createAgentContext, extractCandidates, proposeSchema, queryAgentContext, readSemanticWorkspace, reportVerticalSlice, saveSemanticDefinition, validateGraph } from './state.ts'
import type { SemanticProviderConfig } from './types.ts'

const render = (_args: unknown, value: unknown) => [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }]
function jsonObject(value: unknown): Record<string, JsonValue> { return JSON.parse(JSON.stringify(value)) as Record<string, JsonValue> }

async function projectRoot(ctx: Context, exec: Pick<ToolRunContext, 'agent'>): Promise<string> {
  const cwd = exec.agent?.session.header.cwd
  if (cwd === undefined || cwd === '') throw new Error('Semantica 项目工具必须从项目会话调用。')
  const workspace = await ctx.workspaceRegistry.resolveByPath(cwd)
  if (workspace === undefined) throw new Error('当前会话目录未注册为 FDE 项目。')
  return workspace.path
}

async function inspectWorkspace(root: string, section: string, offset: number): Promise<Record<string, JsonValue>> {
  const state = await readSemanticWorkspace(root)
  const candidates = [...state.candidates.entities, ...state.candidates.relationships]
  const pending = candidates.filter(item => item.decision === 'pending').length
  const humanActions = []
  if (state.route === undefined) humanActions.push('在项目工作台确认实现方式和是否采用本体。')
  else if (state.route.semantics.mode === 'ontology') {
    if (state.definition.status !== 'published') humanActions.push('在项目工作台审阅并发布当前本体定义。')
    if (pending > 0) humanActions.push(`在项目工作台审核 ${String(pending)} 项候选知识；Agent 不能代替接受或拒绝。`)
  }
  const result = jsonObject({
    revision: state.revision, route: state.route ?? null, provider: state.provider,
    providerStatusNote: '这是最近一次检查记录；health 执行本次环境检查，consume 查询也会检查实际版本。',
    sources: state.sources, definition: {
      status: state.definition.status, version: state.definition.version, revision: state.definition.revision,
      competencyQuestions: state.definition.competencyQuestions,
    },
    candidates: { status: state.candidates.status, total: candidates.length, pending },
    lastRun: state.runs.at(-1) ?? null, validation: state.validation ?? null,
    slice: state.slice ?? null, decision: state.decision ?? null, humanActions,
    operations: ['health', 'bind-sources', 'save-definition', 'extract', 'propose-schema', 'build', 'validate'],
    sequence: '选择本体路线 → health → 绑定获准来源 → 保存定义草稿 → extract → 可选 propose-schema 后修订草稿并重新抽取 → 人工审核候选并发布定义 → build → validate → semantic_context_query → 运行项目任务并保留证据。后续消费用 purpose=consume。',
  })
  if (section === 'definition') {
    const { status: _status, revision: _revision, digest: _digest, updatedAt: _updatedAt, ...draft } = state.definition
    result.definitionDraft = jsonObject(draft)
  } else if (section === 'candidates') {
    result.items = jsonObject({ values: candidates.slice(offset, offset + 20), offset, total: candidates.length })
  } else if (section === 'sources') {
    const sources = await listProjectSources(root)
    result.availableSources = jsonObject({
      values: sources.slice(offset, offset + 20).map(item => ({
        sourceId: item.sourceId, name: item.originalName, parseStatus: item.parse.status,
      })),
      offset, total: sources.length,
    })
  }
  if (Buffer.byteLength(JSON.stringify(result)) > 128 * 1024) throw new Error('检查结果超过 128 KiB；请在项目工作台查看当前定义与运行记录。')
  return result
}

/** Register shared Provider operations; publication, candidate decisions and FDE decisions stay human-only. */
export function registerSemanticaTools(ctx: Context, config: SemanticProviderConfig): void {
  const workspace = defineTool({
    name: 'semantic_workspace',
    description: 'Inspect or prepare the current project ontology using the same operations as the workbench. Start with inspect. Only run write actions on an explicitly selected ontology route and user-authorized sources. Editing or rerunning invalidates dependent evidence. Cannot select a route, publish, accept/reject candidates or decide a stage. Never edit Provider JSON to fake these operations.',
    parameters: {
      action: { type: 'string', required: true, enum: ['inspect', 'health', 'bind-sources', 'save-definition', 'extract', 'propose-schema', 'build', 'validate'] },
      section: { type: 'string', enum: ['overview', 'sources', 'definition', 'candidates'], description: 'inspect section; sources and candidates are paginated in batches of 20.' },
      offset: { type: 'integer', description: 'Nonnegative page offset, default 0.' },
      sourceIds: { type: 'array', items: { type: 'string' }, description: 'bind-sources replaces the selected set with these current-project SourceIds, not paths.' },
      permissionScope: { type: 'string', description: 'Required for bind-sources: user-authorized use of the selected material. This note does not grant permissions.' },
      authority: { type: 'string', enum: ['primary', 'supporting'] },
      expectedRevision: { type: 'integer', description: 'Required for save-definition: exact definition.revision returned by inspect.' },
      definition: { type: 'object', additionalProperties: true, description: 'Complete editable definition. Obtain definitionDraft with inspect section=definition, then edit classes, relationships, competencyQuestions, provenanceRules, temporalRules, confidenceThreshold and shaclSeverity. No status/revision/digest/updatedAt.' },
    },
    output: { schema: { type: 'object', additionalProperties: true }, render },
    async execute(args, exec) {
      const root = await projectRoot(ctx, exec)
      const offset = args.offset ?? 0
      if (!Number.isSafeInteger(offset) || offset < 0) throw new Error('offset 必须是非负整数。')
      if (args.action === 'inspect') return await inspectWorkspace(root, args.section ?? 'overview', offset)
      if (args.action === 'health') await checkProvider(root, config)
      else {
        if ((await readSemanticWorkspace(root)).route?.semantics.mode !== 'ontology') throw new Error('请先在项目工作台确认是否采用本体；简单路线不构建图谱。')
        switch (args.action) {
          case 'bind-sources':
            if (!args.sourceIds?.length || !args.permissionScope?.trim()) throw new Error('绑定资料必须提供获准使用的 sourceIds 和 permissionScope。')
            await bindSemanticSources(root, args.sourceIds, args.permissionScope, args.authority ?? 'primary')
            break
          case 'save-definition':
            if (args.expectedRevision === undefined || !Number.isSafeInteger(args.expectedRevision) || args.expectedRevision < 0) throw new Error('必须提供当前定义的 expectedRevision。')
            await saveSemanticDefinition(root, args.expectedRevision, parseSemanticDefinition(args.definition))
            break
          case 'extract': await extractCandidates(root, config); break
          case 'propose-schema': await proposeSchema(root, config); break
          case 'build': await buildGraph(root, config); break
          case 'validate': await validateGraph(root, config); break
          default: throw new Error('不允许 Agent 执行此操作；发布、候选审核与阶段决定请由 FDE 在项目工作台确认。')
        }
      }
      return await inspectWorkspace(root, 'overview', 0)
    },
  })
  const context = defineTool({
    name: 'semantic_context_query',
    description: 'Read the current project validated graph by an explicit questionId or seedNodeId. query describes the task, not semantic search. Default consumption is read-only and does not invalidate stage-four evidence. Use purpose=validation only to prepare a new stage-four slice; it replaces the validation context. Textual permission notes are not an authorization engine.',
    parameters: {
      query: { type: 'string', required: true, description: 'Concrete project task or question this context must support.' },
      purpose: { type: 'string', enum: ['consume', 'validation'], description: 'Default consume is read-only. validation explicitly prepares a new stage-four slice and invalidates the previous slice.' },
      questionId: { type: 'string', description: 'Optional published competency-question id.' },
      seedNodeId: { type: 'string', description: 'Optional exact current-project graph node id.' },
      maxDepth: { type: 'integer', description: 'Bounded graph depth from 0 to 3; default 1.' },
    },
    output: { schema: { type: 'object', additionalProperties: true }, render },
    async execute(args, exec) {
      const root = await projectRoot(ctx, exec)
      const input = {
        query: args.query,
        ...(args.questionId === undefined ? {} : { questionId: args.questionId }),
        ...(args.seedNodeId === undefined ? {} : { seedNodeId: args.seedNodeId }),
        maxDepth: args.maxDepth ?? 1,
      }
      if (args.purpose !== 'validation') return jsonObject(await queryAgentContext(root, config, input))
      const state = await createAgentContext(root, config, input)
      if (state.context === undefined) throw new Error('Semantica 未返回 Agent Context。')
      return jsonObject(state.context)
    },
  })
  const report = defineTool({
    name: 'semantic_slice_report',
    description: 'Persist the truthful result of one actually executed stage-four vertical slice. This never runs or invents the business task and never makes the FDE stage decision.',
    parameters: {
      status: { type: 'string', required: true, enum: ['succeeded', 'failed'], description: 'Truthful result of the executed slice.' },
      task: { type: 'string', required: true, description: 'Exact project task that was executed.' },
      result: { type: 'string', required: true, description: 'Observed business result or failure.' },
      contextRunId: { type: 'string', description: 'Required on the ontology route; exact current semantic_context_query run id.' },
      evidenceRefs: { type: 'array', required: true, items: { type: 'string' }, description: 'One or more project-relative logs, outputs, diffs, screenshots, or other run evidence.' },
      diagnostics: { type: 'array', items: { type: 'string' }, description: 'Observed warnings or failures.' },
    },
    output: { schema: { type: 'object', additionalProperties: true }, render },
    async execute(args, exec) {
      const root = await projectRoot(ctx, exec)
      await reportVerticalSlice(root, {
        status: args.status, task: args.task, result: args.result,
        ...(args.contextRunId === undefined ? {} : { contextRunId: args.contextRunId }),
        evidenceRefs: args.evidenceRefs, ...(args.diagnostics === undefined ? {} : { diagnostics: args.diagnostics }),
      })
      const state = await readSemanticWorkspace(root)
      return { saved: true, slice: jsonObject(state.slice) }
    },
  })
  ctx.effect(() => ctx.tools.register(context), 'fde-semantica: semantic_context_query')
  ctx.effect(() => ctx.tools.register(report), 'fde-semantica: semantic_slice_report')
  ctx.effect(() => ctx.tools.register(workspace), 'fde-semantica: semantic_workspace')
}
