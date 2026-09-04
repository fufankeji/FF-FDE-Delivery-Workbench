/** Project-scoped Semantica Host provider. @module @deepseek-ai/dsh-fde-semantica */

import type { Context } from '@deepseek-ai/cordis'
import { isTrustedApiRequest } from '@deepseek-ai/dsh-client-connection'
import { loadProjectSurfaceSnapshot } from '@deepseek-ai/dsh-fde-project'
import type {} from '@deepseek-ai/dsh-host-webserver'
import z from '@deepseek-ai/schemastery'
import { WorkspaceId } from '@deepseek-ai/dsh-workspace'
import {
  createCandidateReviewHandler,
  createDefinitionHandler,
  createDesignDecisionHandler,
  createDesignRouteHandler,
  createProviderRunHandler,
  createSliceReportHandler,
  createSourceBindingHandler,
  type SemanticaRouteOptions,
} from './routes.ts'
import {
  bindSemanticSources,
  buildGraph,
  checkProvider,
  configureDesignRoute,
  createAgentContext,
  extractCandidates,
  proposeSchema,
  publishSchema,
  reportVerticalSlice,
  recordFdeDesignDecision,
  reviewCandidates,
  saveSemanticDefinition,
  validateGraph,
} from './state.ts'
import { registerSemanticaTools } from './tools.ts'
import type { SemanticProviderConfig } from './types.ts'

export * from './state.ts'
export * from './types.ts'
export { SemanticaBridgeError, runSemantica } from './python.ts'
export { SemanticaRouteError } from './routes.ts'

export const name = 'fde-semantica'
export const inject = ['tools', 'webServer', 'workspaceRegistry']

export const FDE_SEMANTICA_ROUTE_PATH = '/api/fde-semantica/route'
export const FDE_SEMANTICA_SOURCES_PATH = '/api/fde-semantica/sources'
export const FDE_SEMANTICA_DEFINITION_PATH = '/api/fde-semantica/definition'
export const FDE_SEMANTICA_CANDIDATES_PATH = '/api/fde-semantica/candidates'
export const FDE_SEMANTICA_RUN_PATH = '/api/fde-semantica/run'
export const FDE_SEMANTICA_SLICE_PATH = '/api/fde-semantica/slice/report'
export const FDE_SEMANTICA_DECISION_PATH = '/api/fde-semantica/decision'

export interface Config {
  readonly pythonCommand: string
  readonly semanticaSource?: string
  readonly operationTimeoutMs: number
  readonly maxSourceBytes: number
  readonly maxSources: number
}

export const Config: z<Config> = z.object({
  pythonCommand: z.string().default('python3'),
  semanticaSource: z.string().default(''),
  operationTimeoutMs: z.number().step(1).min(1_000).default(60_000),
  maxSourceBytes: z.number().step(1).min(1_024).default(2_097_152),
  maxSources: z.number().step(1).min(1).default(12),
})

/** Register same-origin project actions plus two model tools; only the browser action can submit an FDE decision. */
export function apply(ctx: Context, input: Config): void {
  const config: SemanticProviderConfig = {
    pythonCommand: input.pythonCommand,
    ...(input.semanticaSource === undefined || input.semanticaSource.trim() === '' ? {} : { semanticaSource: input.semanticaSource }),
    operationTimeoutMs: input.operationTimeoutMs,
    maxSourceBytes: input.maxSourceBytes,
    maxSources: input.maxSources,
  }
  const root = (workspaceId: string): string | undefined => ctx.workspaceRegistry.get(WorkspaceId(workspaceId))?.path
  const snapshot = async (workspaceId: string) => {
    const workspace = ctx.workspaceRegistry.get(WorkspaceId(workspaceId))
    if (workspace === undefined) return undefined
    return await loadProjectSurfaceSnapshot({ workspaceId, title: workspace.title, path: workspace.path })
  }
  const options: SemanticaRouteOptions = {
    trusted: request => isTrustedApiRequest(request, []), workspacePath: root, snapshot,
    configureRoute: configureDesignRoute,
    bindSources: bindSemanticSources,
    saveDefinition: saveSemanticDefinition,
    reviewCandidates,
    run: async (workspaceRoot, action, value) => {
      if (action === 'health') await checkProvider(workspaceRoot, config)
      else if (action === 'extract') await extractCandidates(workspaceRoot, config)
      else if (action === 'propose-schema') await proposeSchema(workspaceRoot, config)
      else if (action === 'publish-schema') await publishSchema(workspaceRoot, config)
      else if (action === 'build') await buildGraph(workspaceRoot, config)
      else if (action === 'validate') await validateGraph(workspaceRoot, config)
      else {
        if (typeof value.query !== 'string' || typeof value.maxDepth !== 'number') {
          throw new Error('受控上下文查询参数无效。')
        }
        if (value.questionId !== undefined && typeof value.questionId !== 'string') {
          throw new Error('能力问题 ID 无效。')
        }
        if (value.seedNodeId !== undefined && typeof value.seedNodeId !== 'string') {
          throw new Error('起始实体 ID 无效。')
        }
        await createAgentContext(workspaceRoot, config, {
          query: value.query,
          ...(value.questionId === undefined ? {} : { questionId: value.questionId }),
          ...(value.seedNodeId === undefined ? {} : { seedNodeId: value.seedNodeId }),
          maxDepth: value.maxDepth,
        })
      }
    },
    reportSlice: reportVerticalSlice,
    recordDecision: recordFdeDesignDecision,
    reportFailure: (error) => { ctx.logger.warn(error instanceof Error ? error : new Error(String(error))) },
  }
  for (const [path, handler] of [
    [FDE_SEMANTICA_ROUTE_PATH, createDesignRouteHandler(options)],
    [FDE_SEMANTICA_SOURCES_PATH, createSourceBindingHandler(options)],
    [FDE_SEMANTICA_DEFINITION_PATH, createDefinitionHandler(options)],
    [FDE_SEMANTICA_CANDIDATES_PATH, createCandidateReviewHandler(options)],
    [FDE_SEMANTICA_RUN_PATH, createProviderRunHandler(options)],
    [FDE_SEMANTICA_SLICE_PATH, createSliceReportHandler(options)],
    [FDE_SEMANTICA_DECISION_PATH, createDesignDecisionHandler(options)],
  ] as const) ctx.effect(() => ctx.webServer.register({ kind: 'exact', path, handler }), `fde-semantica: ${path}`)
  registerSemanticaTools(ctx, config)
}

export const modelExperience = 'tools-only'
