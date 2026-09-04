/** Agent-facing bounded graph context and truthful vertical-slice report tools. */

import type { Context } from '@deepseek-ai/cordis'
import { defineTool, type JsonValue, type ToolRunContext } from '@deepseek-ai/dsh-tools'
import { createAgentContext, readSemanticWorkspace, reportVerticalSlice } from './state.ts'
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

/** Register tools that consume only the current project's validated graph. */
export function registerSemanticaTools(ctx: Context, config: SemanticProviderConfig): void {
  const context = defineTool({
    name: 'semantic_context_query',
    description: 'Query the current FDE project validated knowledge graph and persist a bounded Agent context with provenance, time, confidence, schema version, graph revision, and permission scope. Never loads another project or the whole graph by default.',
    parameters: {
      query: { type: 'string', required: true, description: 'Concrete project task or question this context must support.' },
      questionId: { type: 'string', description: 'Optional published competency-question id.' },
      seedNodeId: { type: 'string', description: 'Optional exact current-project graph node id.' },
      maxDepth: { type: 'integer', description: 'Bounded graph depth from 0 to 3; default 1.' },
    },
    output: { schema: { type: 'object', additionalProperties: true }, render },
    async execute(args, exec) {
      const root = await projectRoot(ctx, exec)
      const state = await createAgentContext(root, config, {
        query: args.query,
        ...(args.questionId === undefined ? {} : { questionId: args.questionId }),
        ...(args.seedNodeId === undefined ? {} : { seedNodeId: args.seedNodeId }),
        maxDepth: Math.max(0, Math.min(3, args.maxDepth ?? 1)),
      })
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
}
