/** Workspace-scoped adapter over the locked dsh-openapi parser and HTTP implementation. */

import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import { defineTool, type JsonValue } from '@deepseek-ai/dsh-tools'
import type { ProjectOpenApiConfig } from './types.ts'
import { loadProjectOpenApiConfig } from './snapshot.ts'
import { projectRootForExecution } from './tool-context.ts'

interface OpenApiOperation {
  readonly api: string
  readonly operationId: string
  readonly method: string
  readonly path: string
  readonly summary?: string
  readonly description?: string
  readonly tags: readonly string[]
  readonly deprecated: boolean
  readonly [key: string]: unknown
}

interface OpenApiCatalog {
  readonly id: string
  readonly title: string
  readonly version?: string
  readonly operations: readonly OpenApiOperation[]
}

interface OpenApiVendor {
  readonly parseOpenApi: (text: string, source: string) => unknown
  readonly buildCatalog: (document: unknown, api: ProjectOpenApiConfig, source: string, maxOperations: number) => OpenApiCatalog
  readonly describeOperation: (operation: OpenApiOperation) => unknown
  readonly loadDocument: (
    source: string,
    policy: { readonly cwd: string; readonly allowPrivateNetwork: boolean; readonly maxSpecBytes: number; readonly maxRedirects: number },
    signal?: AbortSignal,
  ) => Promise<string>
  readonly requestOperation: (
    operation: OpenApiOperation,
    args: unknown,
    api: ProjectOpenApiConfig,
    policy: { readonly timeoutMs: number; readonly maxResponseBytes: number; readonly maxRedirects: number },
    signal?: AbortSignal,
  ) => Promise<unknown>
}

/** Runtime limits owned by the FDE adapter; dsh-openapi enforces them. */
export interface ProjectOpenApiPolicy {
  /** Cooperative load and request timeout in milliseconds. */
  readonly timeoutMs: number
  /** Maximum OpenAPI source bytes accepted from a local file or remote response. */
  readonly maxSpecBytes: number
  /** Maximum response bytes returned from one API call. */
  readonly maxResponseBytes: number
  /** Maximum redirect hops, with every destination revalidated. */
  readonly maxRedirects: number
  /** Maximum operations indexed from one project OpenAPI document. */
  readonly maxOperations: number
}

let vendorPromise: Promise<OpenApiVendor> | undefined

async function vendor(): Promise<OpenApiVendor> {
  vendorPromise ??= (async () => {
    const packageJson = import.meta.resolve('dsh-openapi/package.json')
    const root = dirname(fileURLToPath(packageJson))
    const [openapi, http] = await Promise.all([
      import(pathToFileURL(join(root, 'src', 'openapi.js')).href) as Promise<Pick<OpenApiVendor, 'parseOpenApi' | 'buildCatalog' | 'describeOperation'>>,
      import(pathToFileURL(join(root, 'src', 'http.js')).href) as Promise<Pick<OpenApiVendor, 'loadDocument' | 'requestOperation'>>,
    ])
    return { ...openapi, ...http }
  })()
  return await vendorPromise
}

/**
 * Load and index exactly one Workspace's current OpenAPI source.
 * @param root - canonical Workspace path.
 * @param policy - bounded parser and request limits.
 * @param signal - optional source-load cancellation.
 * @returns the private project API config and indexed catalog.
 */
export async function loadProjectOpenApiCatalog(root: string, policy: ProjectOpenApiPolicy, signal?: AbortSignal): Promise<{
  readonly api: ProjectOpenApiConfig
  readonly catalog: OpenApiCatalog
}> {
  const api = await loadProjectOpenApiConfig(root)
  if (api === null) throw new Error('当前项目尚未配置 OpenAPI 来源。')
  const implementation = await vendor()
  const text = await implementation.loadDocument(api.source, {
    cwd: root,
    allowPrivateNetwork: api.allowPrivateNetwork,
    maxSpecBytes: policy.maxSpecBytes,
    maxRedirects: policy.maxRedirects,
  }, signal)
  const document = implementation.parseOpenApi(text, api.source)
  return { api, catalog: implementation.buildCatalog(document, api, api.source, policy.maxOperations) }
}

function operationSummary(operation: OpenApiOperation): object {
  return {
    api: operation.api,
    operationId: operation.operationId,
    method: operation.method,
    path: operation.path,
    summary: operation.summary,
    tags: operation.tags,
    deprecated: operation.deprecated,
  }
}

function operationOf(catalog: OpenApiCatalog, api: unknown, operationId: unknown): OpenApiOperation {
  if (api !== 'project') throw new Error('当前项目只允许 API id "project"。')
  if (typeof operationId !== 'string' || operationId === '') throw new Error('operationId 不能为空。')
  const operation = catalog.operations.find(item => item.operationId === operationId)
  if (operation === undefined) throw new Error(`当前项目不存在 OpenAPI operationId：${operationId}`)
  return operation
}

const renderJson = (_args: unknown, value: unknown) => [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }]

function jsonObject(value: unknown): Record<string, JsonValue> {
  const materialized = JSON.parse(JSON.stringify(value)) as unknown
  if (materialized === null || typeof materialized !== 'object' || Array.isArray(materialized)) {
    throw new Error('dsh-openapi 返回了无效对象。')
  }
  return materialized as Record<string, JsonValue>
}

/**
 * Register dsh-openapi list, describe, and call behavior with Workspace resolution.
 * @param ctx - Host context carrying tools and Workspace registry.
 * @param policy - bounded parser and request limits.
 */
export function registerProjectOpenApiTools(ctx: Context, policy: ProjectOpenApiPolicy): void {
  const list = defineTool({
    name: 'openapi_list',
    description: 'List and search operations from the OpenAPI definition owned by the current FDE project.',
    parameters: {
      api: { type: 'string', description: 'Optional API id; the current project id is project.' },
      search: { type: 'string', description: 'Optional case-insensitive operation search.' },
      limit: { type: 'number', description: 'Maximum operations to return (1-100, default 50).' },
    },
    output: { schema: { type: 'object', additionalProperties: true }, render: renderJson },
    timeoutMs: policy.timeoutMs,
    async execute(args, exec) {
      const root = await projectRootForExecution(ctx, exec)
      const { catalog } = await loadProjectOpenApiCatalog(root, policy, exec.signal)
      if (args.api !== undefined && args.api !== 'project') throw new Error('当前项目只允许 API id "project"。')
      const limit = args.limit === undefined ? 50 : Math.trunc(args.limit)
      if (limit < 1 || limit > 100) throw new Error('limit 必须在 1 到 100 之间。')
      const search = args.search?.toLowerCase()
      const operations = catalog.operations.filter(operation => search === undefined || [
        operation.operationId, operation.method, operation.path,
        operation.summary, operation.description, ...operation.tags,
      ].some(value => value?.toLowerCase().includes(search)))
      return jsonObject({
        apis: [{ id: 'project', title: catalog.title, version: catalog.version, operations: catalog.operations.length }],
        total: operations.length,
        truncated: operations.length > limit,
        operations: operations.slice(0, limit).map(operationSummary),
      })
    },
  })

  const describe = defineTool({
    name: 'openapi_describe',
    description: 'Describe one operation from the current FDE project, including parameters, request body, and responses.',
    parameters: {
      api: { type: 'string', required: true, description: 'Use project for the current FDE project.' },
      operationId: { type: 'string', required: true, description: 'Operation id returned by openapi_list.' },
    },
    output: { schema: { type: 'object', additionalProperties: true }, render: renderJson },
    timeoutMs: policy.timeoutMs,
    async execute(args, exec) {
      const root = await projectRootForExecution(ctx, exec)
      const { catalog } = await loadProjectOpenApiCatalog(root, policy, exec.signal)
      return jsonObject((await vendor()).describeOperation(operationOf(catalog, args.api, args.operationId)))
    },
  })

  const call = defineTool({
    name: 'openapi_call',
    description: 'Call one operation declared and allowed by the current FDE project OpenAPI configuration.',
    parameters: {
      api: { type: 'string', required: true, description: 'Use project for the current FDE project.' },
      operationId: { type: 'string', required: true, description: 'Operation id returned by openapi_list.' },
      path: { type: 'object', additionalProperties: true, description: 'Declared path parameters.' },
      query: { type: 'object', additionalProperties: true, description: 'Declared query parameters.' },
      headers: { type: 'object', additionalProperties: true, description: 'Declared non-credential header parameters.' },
      cookies: { type: 'object', additionalProperties: true, description: 'Declared cookie parameters.' },
      body: { type: 'string', description: 'Raw request body, usually JSON.' },
      contentType: { type: 'string', description: 'Request content type.' },
    },
    output: { schema: { type: 'object', additionalProperties: true }, render: renderJson },
    timeoutMs: policy.timeoutMs,
    async execute(args, exec) {
      const root = await projectRootForExecution(ctx, exec)
      const { api, catalog } = await loadProjectOpenApiCatalog(root, policy, exec.signal)
      const operation = operationOf(catalog, args.api, args.operationId)
      return jsonObject(await (await vendor()).requestOperation(operation, args, api, {
        timeoutMs: policy.timeoutMs,
        maxResponseBytes: policy.maxResponseBytes,
        maxRedirects: policy.maxRedirects,
      }, exec.signal))
    },
  })

  ctx.effect(() => ctx.tools.register(list), 'fde-project: openapi_list')
  ctx.effect(() => ctx.tools.register(describe), 'fde-project: openapi_describe')
  ctx.effect(() => ctx.tools.register(call), 'fde-project: openapi_call')
}
