/** FDE project-resource upload Host plugin. @module @deepseek-ai/dsh-fde-source */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { createWebRequestTrust } from '@deepseek-ai/dsh-client-connection'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { WorkspaceId } from '@deepseek-ai/dsh-workspace'
import {
  createProjectResourceUploadHandler,
  PROJECT_RESOURCE_DIRECTORY,
  type ProjectResourceLimits,
} from './upload.ts'
import { registerStoredProjectResources } from './records.ts'
import {
  createProjectSourceFileHandler,
  createProjectSourceListHandler,
  createProjectSourceParseHandler,
  PROJECT_SOURCE_FILE_PATH,
  PROJECT_SOURCE_LIST_PATH,
  PROJECT_SOURCE_PARSE_PATH,
  type ProjectSourceRouteOptions,
} from './routes.ts'

export {
  createProjectResourceUploadHandler,
  PROJECT_RESOURCE_DIRECTORY,
  ProjectResourceUploadError,
  sanitizeProjectResourceName,
  storeProjectResourceBatch,
} from './upload.ts'
export {
  DERIVED_DIRECTORY,
  FDE_STATE_DIRECTORY,
  listProjectSources,
  registerStoredProjectResources,
  resolveProjectSource,
  SOURCE_RECORD_DIRECTORY,
  type ProjectSourceParseState,
  type ProjectSourceParseStatus,
  type ProjectSourcePreviewKind,
  type ProjectSourceRecord,
} from './records.ts'
export {
  LOCAL_DOCUMENT_PARSER,
  LOCAL_DOCUMENT_PARSER_VERSION,
  parseProjectSource,
} from './parse.ts'
export {
  createProjectSourceFileHandler,
  createProjectSourceListHandler,
  createProjectSourceParseHandler,
  PROJECT_SOURCE_FILE_PATH,
  PROJECT_SOURCE_LIST_PATH,
  PROJECT_SOURCE_PARSE_PATH,
  type ProjectSourceRouteOptions,
  type PublicProjectSource,
} from './routes.ts'
export type {
  ProjectResourceInput,
  ProjectResourceLimits,
  ProjectResourceUploadHandlerOptions,
  StoredProjectResource,
} from './upload.ts'

/** Stable plugin id used by the FDE Web bundle. */
export const name = 'fde-source'
/** The route requires the real Web server and durable Workspace registry. */
export const inject = ['connection', 'webServer', 'workspaceRegistry']

/** Exact same-origin route used by the project-row client action. */
export const PROJECT_RESOURCE_UPLOAD_PATH = '/api/fde-project-resources/upload'
/** Current vertical-slice default: 25 MiB for one source file. */
export const DEFAULT_MAX_FILE_BYTES = 25 * 1024 * 1024
/** Current vertical-slice default: 20 files in one atomic batch. */
export const DEFAULT_MAX_FILES = 20
/** Current vertical-slice default: 100 MiB of file content in one batch. */
export const DEFAULT_MAX_BATCH_BYTES = 100 * 1024 * 1024

/** Host deployment limits for project resource upload. */
export interface Config {
  /** Maximum bytes accepted for one imported project file. */
  maxFileBytes?: number
  /** Maximum files accepted in one all-or-nothing import batch. */
  maxFiles?: number
  /** Maximum aggregate file-content bytes accepted in one import batch. */
  maxBatchBytes?: number
}

/** Validated Cordis configuration. */
export const Config: z<Config> = z.object({
  maxFileBytes: z.number().step(1).min(1).default(DEFAULT_MAX_FILE_BYTES),
  maxFiles: z.number().step(1).min(1).default(DEFAULT_MAX_FILES),
  maxBatchBytes: z.number().step(1).min(1).default(DEFAULT_MAX_BATCH_BYTES),
})

/**
 * Register the deployment-trusted same-origin project resource upload route.
 * @param ctx - Host context carrying WebServer and WorkspaceRegistry.
 * @param config - deployment limits after Loader defaulting.
 */
export function apply(ctx: Context, config: Config = {}): void {
  const trusted = createWebRequestTrust(ctx.connection)
  const limits: ProjectResourceLimits = {
    maxFileBytes: config.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES,
    maxFiles: config.maxFiles ?? DEFAULT_MAX_FILES,
    maxBatchBytes: config.maxBatchBytes ?? DEFAULT_MAX_BATCH_BYTES,
  }
  if (limits.maxBatchBytes < limits.maxFileBytes) {
    throw new Error('fde-source: maxBatchBytes must be greater than or equal to maxFileBytes')
  }
  const handler = createProjectResourceUploadHandler({
    limits,
    trusted,
    workspacePath: workspaceId => ctx.workspaceRegistry.get(WorkspaceId(workspaceId))?.path,
    registerSources: async (workspacePath, files) => registerStoredProjectResources(workspacePath, files),
    reportFailure: (error) => { ctx.logger.warn(error instanceof Error ? error : new Error(String(error))) },
  })
  const sourceRoutes: ProjectSourceRouteOptions = {
    trusted,
    workspacePath: workspaceId => ctx.workspaceRegistry.get(WorkspaceId(workspaceId))?.path,
    maxFileBytes: limits.maxFileBytes,
    reportFailure: (error) => { ctx.logger.warn(error instanceof Error ? error : new Error(String(error))) },
  }
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: PROJECT_RESOURCE_UPLOAD_PATH,
    handler,
  }), `fde-source: ${PROJECT_RESOURCE_UPLOAD_PATH}`)
  for (const [path, routeHandler] of [
    [PROJECT_SOURCE_LIST_PATH, createProjectSourceListHandler(sourceRoutes)],
    [PROJECT_SOURCE_FILE_PATH, createProjectSourceFileHandler(sourceRoutes)],
    [PROJECT_SOURCE_PARSE_PATH, createProjectSourceParseHandler(sourceRoutes)],
  ] as const) {
    ctx.effect(() => ctx.webServer.register({ kind: 'exact', path, handler: routeHandler }), `fde-source: ${path}`)
  }
}

/** No model-facing content: upload stores files but never creates a Session event or prompt. */
export const modelExperience = 'none'

/** Directory exported for diagnostics and downstream file-tree plugins. */
export const resourceDirectory = PROJECT_RESOURCE_DIRECTORY
