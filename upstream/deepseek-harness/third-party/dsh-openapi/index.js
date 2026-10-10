import typeSchema from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { buildCatalog, describeOperation, HTTP_METHODS, parseOpenApi } from './src/openapi.js'
import { loadDocument, requestOperation } from './src/http.js'

const Schema = typeSchema

export const name = 'dsh-openapi'
export const inject = ['tools']

const credentialSchema = Schema.object({
  header: Schema.string().required(),
  env: Schema.string().required(),
  prefix: Schema.string().default(''),
})

const apiSchema = Schema.object({
  id: Schema.string().required(),
  source: Schema.string().required(),
  baseUrl: Schema.string(),
  headers: Schema.dict(Schema.string()).default({}),
  credentials: Schema.array(credentialSchema).default([]),
  allowedMethods: Schema.array(Schema.union(HTTP_METHODS)).default(['GET', 'HEAD']),
  allowPrivateNetwork: Schema.boolean().default(false),
})

export const Config = Schema.object({
  apis: Schema.array(apiSchema).default([]),
  timeoutMs: Schema.number().default(30_000),
  maxSpecBytes: Schema.number().default(2_097_152),
  maxResponseBytes: Schema.number().default(262_144),
  maxRedirects: Schema.number().default(3),
  maxOperationsPerApi: Schema.number().default(1_000),
})

function normalizeConfig(config = {}) {
  return {
    apis: (config.apis ?? []).map(api => ({
      ...api,
      headers: api.headers ?? {},
      credentials: api.credentials ?? [],
      allowedMethods: api.allowedMethods ?? ['GET', 'HEAD'],
      allowPrivateNetwork: api.allowPrivateNetwork ?? false,
    })),
    timeoutMs: config.timeoutMs ?? 30_000,
    maxSpecBytes: config.maxSpecBytes ?? 2_097_152,
    maxResponseBytes: config.maxResponseBytes ?? 262_144,
    maxRedirects: config.maxRedirects ?? 3,
    maxOperationsPerApi: config.maxOperationsPerApi ?? 1_000,
  }
}

function assertConfig(config) {
  const ids = new Set()
  for (const api of config.apis) {
    if (!api.id?.trim()) throw new Error('Every OpenAPI entry needs a non-empty id')
    if (ids.has(api.id)) throw new Error(`Duplicate OpenAPI id: ${api.id}`)
    ids.add(api.id)
    if (!api.source?.trim()) throw new Error(`OpenAPI entry ${api.id} needs a source`)
    for (const method of api.allowedMethods) {
      if (!HTTP_METHODS.includes(method.toUpperCase())) throw new Error(`Unsupported HTTP method for ${api.id}: ${method}`)
    }
  }
  for (const [name, value, min] of [
    ['timeoutMs', config.timeoutMs, 1],
    ['maxSpecBytes', config.maxSpecBytes, 1_024],
    ['maxResponseBytes', config.maxResponseBytes, 1_024],
    ['maxRedirects', config.maxRedirects, 0],
    ['maxOperationsPerApi', config.maxOperationsPerApi, 1],
  ]) {
    if (!Number.isInteger(value) || value < min) throw new Error(`${name} must be an integer >= ${min}`)
  }
}

function jsonContent(value) {
  return [{ type: 'text', text: JSON.stringify(value, null, 2) }]
}

function operationSummary(operation) {
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

export async function apply(ctx, inputConfig) {
  const config = normalizeConfig(inputConfig)
  assertConfig(config)

  const catalogs = await Promise.all(config.apis.map(async api => {
    const text = await loadDocument(api.source, {
      cwd: process.cwd(),
      allowPrivateNetwork: api.allowPrivateNetwork,
      maxSpecBytes: config.maxSpecBytes,
      maxRedirects: config.maxRedirects,
    })
    return buildCatalog(parseOpenApi(text, api.source), api, api.source, config.maxOperationsPerApi)
  }))
  const apiById = new Map(config.apis.map(api => [api.id, api]))
  const operationByKey = new Map()
  for (const catalog of catalogs) {
    for (const operation of catalog.operations) operationByKey.set(`${catalog.id}:${operation.operationId}`, operation)
  }

  function getOperation(api, operationId) {
    const operation = operationByKey.get(`${api}:${operationId}`)
    if (!operation) throw new Error(`Unknown OpenAPI operation: ${api}/${operationId}`)
    return operation
  }

  ctx.tools.register(defineTool({
    name: 'openapi_list',
    description: 'List configured OpenAPI APIs and search their operations before calling one.',
    parameters: {
      api: { type: 'string', description: 'Optional configured API id' },
      search: { type: 'string', description: 'Optional case-insensitive search over ids, paths, summaries, and tags' },
      limit: { type: 'number', description: 'Maximum operations to return (1-100, default 50)' },
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => jsonContent(value),
    },
    async execute(args) {
      const limit = args.limit === undefined ? 50 : Math.trunc(args.limit)
      if (limit < 1 || limit > 100) throw new Error('limit must be between 1 and 100')
      if (args.api !== undefined && !catalogs.some(catalog => catalog.id === args.api)) {
        throw new Error(`Unknown OpenAPI API: ${args.api}`)
      }
      const search = args.search?.toLowerCase()
      const all = catalogs
        .filter(catalog => args.api === undefined || catalog.id === args.api)
        .flatMap(catalog => catalog.operations)
        .filter(operation => !search || [
          operation.operationId,
          operation.method,
          operation.path,
          operation.summary,
          operation.description,
          ...operation.tags,
        ].some(value => value?.toLowerCase().includes(search)))
      return {
        apis: catalogs.map(catalog => ({
          id: catalog.id,
          title: catalog.title,
          version: catalog.version,
          operations: catalog.operations.length,
        })),
        total: all.length,
        truncated: all.length > limit,
        operations: all.slice(0, limit).map(operationSummary),
      }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'openapi_describe',
    description: 'Describe one OpenAPI operation, including parameters, request body, server, and responses.',
    parameters: {
      api: { type: 'string', required: true, description: 'Configured API id' },
      operationId: { type: 'string', required: true, description: 'Operation id returned by openapi_list' },
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => jsonContent(value),
    },
    async execute(args) {
      return describeOperation(getOperation(args.api, args.operationId))
    },
  }))

  ctx.tools.register(defineTool({
    name: 'openapi_call',
    description: 'Call one configured OpenAPI operation. Only declared parameters and configured HTTP methods are allowed.',
    parameters: {
      api: { type: 'string', required: true, description: 'Configured API id' },
      operationId: { type: 'string', required: true, description: 'Operation id returned by openapi_list' },
      path: { type: 'object', additionalProperties: true, description: 'Declared path parameters' },
      query: { type: 'object', additionalProperties: true, description: 'Declared query parameters' },
      headers: { type: 'object', additionalProperties: true, description: 'Declared header parameters; configured headers and credentials take precedence' },
      cookies: { type: 'object', additionalProperties: true, description: 'Declared cookie parameters' },
      body: { type: 'string', description: 'Raw request body, usually JSON.stringify(...) output' },
      contentType: { type: 'string', description: 'Request content type; defaults to application/json when body is present' },
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => jsonContent(value),
    },
    async execute(args, exec) {
      const operation = getOperation(args.api, args.operationId)
      const api = apiById.get(args.api)
      return requestOperation(operation, args, api, config, exec.signal)
    },
  }))
}
