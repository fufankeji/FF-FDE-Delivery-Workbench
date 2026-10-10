import { parse as parseYaml } from 'yaml'

export const HTTP_METHODS = Object.freeze([
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'OPTIONS',
  'HEAD',
  'TRACE',
])

const METHOD_KEYS = new Set(HTTP_METHODS.map(method => method.toLowerCase()))

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function decodePointerPart(value) {
  return value.replaceAll('~1', '/').replaceAll('~0', '~')
}

/** Parse and validate one OpenAPI 3.x JSON or YAML document. */
export function parseOpenApi(text, source = '<inline>') {
  let document
  try {
    document = JSON.parse(text)
  } catch {
    try {
      document = parseYaml(text)
    } catch (error) {
      throw new Error(`Cannot parse OpenAPI document ${source}: ${error.message}`)
    }
  }

  if (!isRecord(document)) {
    throw new Error(`OpenAPI document ${source} must have an object root`)
  }
  if (typeof document.openapi !== 'string' || !document.openapi.startsWith('3.')) {
    throw new Error(`OpenAPI document ${source} must declare an OpenAPI 3.x version`)
  }
  if (!isRecord(document.paths)) {
    throw new Error(`OpenAPI document ${source} must contain a paths object`)
  }
  return document
}

/** Resolve a local JSON Pointer reference. Remote references are intentionally unsupported. */
export function resolveLocalRef(document, value) {
  if (!isRecord(value) || typeof value.$ref !== 'string') return value
  if (!value.$ref.startsWith('#/')) {
    throw new Error(`Remote OpenAPI reference is not supported: ${value.$ref}`)
  }

  let current = document
  for (const part of value.$ref.slice(2).split('/').map(decodePointerPart)) {
    if (!isRecord(current) && !Array.isArray(current)) {
      throw new Error(`OpenAPI reference does not resolve: ${value.$ref}`)
    }
    current = current[part]
  }
  if (current === undefined) {
    throw new Error(`OpenAPI reference does not resolve: ${value.$ref}`)
  }
  return current
}

function materialize(document, value, depth = 0, refs = new Set()) {
  if (depth > 8) return value
  if (Array.isArray(value)) {
    return value.map(entry => materialize(document, entry, depth + 1, refs))
  }
  if (!isRecord(value)) return value

  if (typeof value.$ref === 'string') {
    if (refs.has(value.$ref)) return { $ref: value.$ref }
    const nextRefs = new Set(refs)
    nextRefs.add(value.$ref)
    return materialize(document, resolveLocalRef(document, value), depth + 1, nextRefs)
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, materialize(document, entry, depth + 1, refs)]),
  )
}

function renderServerUrl(server, source) {
  if (!isRecord(server) || typeof server.url !== 'string') return null
  let value = server.url
  value = value.replaceAll(/\{([^}]+)\}/g, (_match, variable) => {
    const definition = isRecord(server.variables) ? server.variables[variable] : undefined
    if (!isRecord(definition) || definition.default === undefined) {
      throw new Error(`OpenAPI server variable ${variable} has no default value`)
    }
    return String(definition.default)
  })

  try {
    return new URL(value).toString()
  } catch {
    if (/^https?:\/\//i.test(source)) return new URL(value, source).toString()
    return null
  }
}

function chooseBaseUrl(document, pathItem, operation, api, source) {
  if (api.baseUrl) return new URL(api.baseUrl).toString()
  const server = operation.servers?.[0] ?? pathItem.servers?.[0] ?? document.servers?.[0]
  if (server) return renderServerUrl(server, source)
  if (/^https?:\/\//i.test(source)) return new URL('/', source).toString()
  return null
}

function normalizeParameter(document, parameter) {
  const value = resolveLocalRef(document, parameter)
  if (!isRecord(value) || typeof value.name !== 'string' || typeof value.in !== 'string') {
    throw new Error('OpenAPI operation contains an invalid parameter')
  }
  return {
    name: value.name,
    in: value.in,
    required: value.in === 'path' || value.required === true,
    description: typeof value.description === 'string' ? value.description : undefined,
    style: typeof value.style === 'string' ? value.style : undefined,
    explode: typeof value.explode === 'boolean' ? value.explode : undefined,
    schema: value.schema === undefined ? undefined : materialize(document, value.schema),
  }
}

function mergeParameters(document, pathParameters, operationParameters) {
  const merged = new Map()
  for (const parameter of [...(pathParameters ?? []), ...(operationParameters ?? [])]) {
    const normalized = normalizeParameter(document, parameter)
    merged.set(`${normalized.in}:${normalized.name}`, normalized)
  }
  return [...merged.values()]
}

function normalizeRequestBody(document, requestBody) {
  if (requestBody === undefined) return undefined
  const value = resolveLocalRef(document, requestBody)
  if (!isRecord(value)) throw new Error('OpenAPI operation contains an invalid requestBody')
  const content = isRecord(value.content) ? value.content : {}
  return {
    required: value.required === true,
    description: typeof value.description === 'string' ? value.description : undefined,
    content: Object.fromEntries(
      Object.entries(content).map(([contentType, media]) => {
        const schema = isRecord(media) && media.schema !== undefined
          ? materialize(document, media.schema)
          : undefined
        return [contentType, { schema }]
      }),
    ),
  }
}

function normalizeResponses(document, responses) {
  if (!isRecord(responses)) return {}
  return Object.fromEntries(Object.entries(responses).map(([status, response]) => {
    const value = resolveLocalRef(document, response)
    if (!isRecord(value)) return [status, {}]
    return [status, {
      description: typeof value.description === 'string' ? value.description : undefined,
      contentTypes: isRecord(value.content) ? Object.keys(value.content) : [],
    }]
  }))
}

function generatedOperationId(method, path) {
  const suffix = path
    .replaceAll(/\{([^}]+)\}/g, 'by_$1')
    .replaceAll(/[^A-Za-z0-9]+/g, '_')
    .replaceAll(/^_+|_+$/g, '')
  return `${method.toLowerCase()}_${suffix || 'root'}`
}

/** Build a compact, deterministic operation catalog for one configured API. */
export function buildCatalog(document, api, source, maxOperations = 1_000) {
  const operations = []
  const ids = new Set()

  for (const [path, unresolvedPathItem] of Object.entries(document.paths)) {
    const pathItem = resolveLocalRef(document, unresolvedPathItem)
    if (!isRecord(pathItem)) continue

    for (const [methodKey, unresolvedOperation] of Object.entries(pathItem)) {
      if (!METHOD_KEYS.has(methodKey.toLowerCase())) continue
      const operation = resolveLocalRef(document, unresolvedOperation)
      if (!isRecord(operation)) continue

      const method = methodKey.toUpperCase()
      const baseId = typeof operation.operationId === 'string' && operation.operationId.trim()
        ? operation.operationId.trim()
        : generatedOperationId(method, path)
      let operationId = baseId
      let suffix = 2
      while (ids.has(operationId)) operationId = `${baseId}_${suffix++}`
      ids.add(operationId)

      operations.push({
        api: api.id,
        operationId,
        method,
        path,
        baseUrl: chooseBaseUrl(document, pathItem, operation, api, source),
        summary: typeof operation.summary === 'string' ? operation.summary : undefined,
        description: typeof operation.description === 'string' ? operation.description : undefined,
        tags: Array.isArray(operation.tags) ? operation.tags.filter(tag => typeof tag === 'string') : [],
        deprecated: operation.deprecated === true,
        parameters: mergeParameters(document, pathItem.parameters, operation.parameters),
        requestBody: normalizeRequestBody(document, operation.requestBody),
        responses: normalizeResponses(document, operation.responses),
      })

      if (operations.length > maxOperations) {
        throw new Error(`OpenAPI document ${source} exceeds the ${maxOperations} operation limit`)
      }
    }
  }

  return {
    id: api.id,
    title: typeof document.info?.title === 'string' ? document.info.title : api.id,
    version: typeof document.info?.version === 'string' ? document.info.version : undefined,
    source,
    operations,
  }
}

/** Return the model-facing description without internal plugin configuration. */
export function describeOperation(operation) {
  return {
    api: operation.api,
    operationId: operation.operationId,
    method: operation.method,
    path: operation.path,
    baseUrl: operation.baseUrl,
    summary: operation.summary,
    description: operation.description,
    tags: operation.tags,
    deprecated: operation.deprecated,
    parameters: operation.parameters,
    requestBody: operation.requestBody,
    responses: operation.responses,
  }
}
