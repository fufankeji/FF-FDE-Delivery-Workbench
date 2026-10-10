import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { readFile, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isPrivateIpv4(address) {
  const parts = address.split('.').map(Number)
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return true
  const [a, b] = parts
  return a === 0 || a === 10 || a === 127 || a >= 224
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 0)
    || (a === 192 && b === 168)
    || (a === 198 && (b === 18 || b === 19))
}

function isPrivateIpv6(address) {
  const normalized = address.toLowerCase().split('%')[0]
  if (normalized === '::' || normalized === '::1') return true
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true
  if (/^fe[89ab]/.test(normalized)) return true
  const mapped = normalized.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  return mapped ? isPrivateIpv4(mapped[1]) : false
}

export function isPrivateAddress(address) {
  const family = isIP(address)
  if (family === 4) return isPrivateIpv4(address)
  if (family === 6) return isPrivateIpv6(address)
  return true
}

/** Reject non-HTTP destinations and hosts that resolve to private networks. */
export async function assertSafeUrl(input, allowPrivateNetwork = false, lookupImpl = lookup) {
  const url = input instanceof URL ? input : new URL(input)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Only HTTP(S) URLs are allowed: ${url.protocol}`)
  }
  if (url.username || url.password) {
    throw new Error('Credentials in API URLs are not allowed')
  }
  if (allowPrivateNetwork) return url

  const hostname = url.hostname.toLowerCase().replaceAll(/^\[|\]$/g, '')
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) {
    throw new Error(`Private network destination is blocked: ${hostname}`)
  }
  if (isIP(hostname)) {
    if (isPrivateAddress(hostname)) throw new Error(`Private network destination is blocked: ${hostname}`)
    return url
  }

  let addresses
  try {
    addresses = await lookupImpl(hostname, { all: true, verbatim: true })
  } catch (error) {
    throw new Error(`Cannot resolve API host ${hostname}: ${error.message}`)
  }
  if (!Array.isArray(addresses) || addresses.length === 0) {
    throw new Error(`Cannot resolve API host ${hostname}`)
  }
  const blocked = addresses.find(entry => isPrivateAddress(entry.address))
  if (blocked) throw new Error(`API host ${hostname} resolves to a private address`)
  return url
}

async function readBoundedBody(response, maxBytes) {
  if (!response.body) return { text: '', truncated: false }
  const reader = response.body.getReader()
  const chunks = []
  let total = 0
  let truncated = false

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (total + value.byteLength > maxBytes) {
      const remaining = Math.max(0, maxBytes - total)
      if (remaining) chunks.push(value.subarray(0, remaining))
      total += remaining
      truncated = true
      await reader.cancel()
      break
    }
    chunks.push(value)
    total += value.byteLength
  }

  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return { text: new TextDecoder().decode(bytes), truncated }
}

/** Fetch one URL with redirect revalidation and a hard response-body cap. */
export async function fetchBounded(input, init, policy, dependencies = {}) {
  const fetchImpl = dependencies.fetchImpl ?? globalThis.fetch
  const lookupImpl = dependencies.lookupImpl ?? lookup
  let url = new URL(input)
  let method = (init.method ?? 'GET').toUpperCase()
  let body = init.body
  const headers = new Headers(init.headers)

  for (let redirects = 0; ; redirects++) {
    await assertSafeUrl(url, policy.allowPrivateNetwork, lookupImpl)
    const response = await fetchImpl(url, { ...init, headers, method, body, redirect: 'manual' })
    if (!REDIRECT_STATUSES.has(response.status)) {
      const content = await readBoundedBody(response, policy.maxBytes)
      return { response, ...content, finalUrl: url.toString(), redirects }
    }

    const location = response.headers.get('location')
    if (!location) throw new Error(`API returned redirect ${response.status} without a Location header`)
    if (redirects >= policy.maxRedirects) throw new Error(`API exceeded the ${policy.maxRedirects} redirect limit`)
    const nextUrl = new URL(location, url)
    if (nextUrl.origin !== url.origin) {
      headers.delete('authorization')
      headers.delete('cookie')
      headers.delete('proxy-authorization')
    }
    url = nextUrl

    if (response.status === 303 || ((response.status === 301 || response.status === 302) && method === 'POST')) {
      method = 'GET'
      body = undefined
    }
  }
}

/** Load a local or remote OpenAPI document without reading beyond the configured cap. */
export async function loadDocument(source, policy, signal, dependencies = {}) {
  if (/^https?:\/\//i.test(source)) {
    const result = await fetchBounded(source, {
      method: 'GET',
      headers: { accept: 'application/json, application/yaml, text/yaml, text/plain' },
      signal,
    }, {
      allowPrivateNetwork: policy.allowPrivateNetwork,
      maxBytes: policy.maxSpecBytes,
      maxRedirects: policy.maxRedirects,
    }, dependencies)
    if (!result.response.ok) throw new Error(`Cannot load OpenAPI document ${source}: HTTP ${result.response.status}`)
    if (result.truncated) throw new Error(`OpenAPI document ${source} exceeds the ${policy.maxSpecBytes} byte limit`)
    return result.text
  }

  const path = source.startsWith('file:') ? fileURLToPath(source) : resolve(policy.cwd, source)
  const info = await stat(path)
  if (!info.isFile()) throw new Error(`OpenAPI source is not a file: ${path}`)
  if (info.size > policy.maxSpecBytes) {
    throw new Error(`OpenAPI document ${path} exceeds the ${policy.maxSpecBytes} byte limit`)
  }
  return readFile(path, { encoding: 'utf8', signal })
}

function ensureObject(value, name) {
  if (value === undefined) return {}
  if (!isRecord(value)) throw new Error(`${name} must be an object`)
  return value
}

function serializeValue(value) {
  if (Array.isArray(value)) return value.map(entry => String(entry))
  if (isRecord(value)) return JSON.stringify(value)
  if (value === null) return ''
  return String(value)
}

function validateParameterKeys(values, parameters, location) {
  const known = new Map(
    parameters.filter(parameter => parameter.in === location).map(parameter => [parameter.name.toLowerCase(), parameter]),
  )
  for (const key of Object.keys(values)) {
    if (!known.has(key.toLowerCase())) throw new Error(`Unknown ${location} parameter: ${key}`)
  }
  for (const parameter of known.values()) {
    const matchingKey = Object.keys(values).find(key => key.toLowerCase() === parameter.name.toLowerCase())
    if (parameter.required && matchingKey === undefined) {
      throw new Error(`Missing required ${location} parameter: ${parameter.name}`)
    }
  }
  return known
}

function combinePaths(basePath, operationPath) {
  const left = basePath === '/' ? '' : basePath.replace(/\/+$/g, '')
  const right = operationPath.replace(/^\/+/, '')
  return `${left}/${right}` || '/'
}

/** Build a request from validated OpenAPI operation metadata and model arguments. */
export function buildOperationRequest(operation, args, api, env = process.env) {
  if (!operation.baseUrl) {
    throw new Error(`Operation ${operation.operationId} has no absolute server URL; configure baseUrl`)
  }
  const method = operation.method.toUpperCase()
  const allowed = new Set(api.allowedMethods.map(value => value.toUpperCase()))
  if (!allowed.has(method)) {
    throw new Error(`Method ${method} is disabled for API ${api.id}; allowedMethods=${[...allowed].join(',')}`)
  }

  const pathValues = ensureObject(args.path, 'path')
  const queryValues = ensureObject(args.query, 'query')
  const headerValues = ensureObject(args.headers, 'headers')
  const cookieValues = ensureObject(args.cookies, 'cookies')
  validateParameterKeys(pathValues, operation.parameters, 'path')
  const queryParameters = validateParameterKeys(queryValues, operation.parameters, 'query')
  validateParameterKeys(headerValues, operation.parameters, 'header')
  validateParameterKeys(cookieValues, operation.parameters, 'cookie')

  let operationPath = operation.path
  for (const parameter of operation.parameters.filter(entry => entry.in === 'path')) {
    const key = Object.keys(pathValues).find(entry => entry.toLowerCase() === parameter.name.toLowerCase())
    if (key === undefined) continue
    const serialized = serializeValue(pathValues[key])
    const value = Array.isArray(serialized) ? serialized.join(',') : serialized
    operationPath = operationPath.replaceAll(`{${parameter.name}}`, encodeURIComponent(value))
  }
  if (/\{[^}]+\}/.test(operationPath)) throw new Error(`Unresolved path parameter in ${operationPath}`)

  const url = new URL(operation.baseUrl)
  url.pathname = combinePaths(url.pathname, operationPath)
  for (const [key, rawValue] of Object.entries(queryValues)) {
    const parameter = queryParameters.get(key.toLowerCase())
    const value = serializeValue(rawValue)
    if (Array.isArray(value) && parameter?.explode !== false) {
      for (const entry of value) url.searchParams.append(parameter.name, entry)
    } else {
      url.searchParams.set(parameter?.name ?? key, Array.isArray(value) ? value.join(',') : value)
    }
  }

  const headers = new Headers({ accept: 'application/json, text/plain;q=0.9, */*;q=0.8' })
  for (const [key, rawValue] of Object.entries(headerValues)) {
    const parameter = operation.parameters.find(entry => entry.in === 'header' && entry.name.toLowerCase() === key.toLowerCase())
    const value = serializeValue(rawValue)
    headers.set(parameter?.name ?? key, Array.isArray(value) ? value.join(',') : value)
  }
  for (const [key, value] of Object.entries(api.headers)) headers.set(key, String(value))
  const cookiePairs = Object.entries(cookieValues).map(([key, rawValue]) => {
    const parameter = operation.parameters.find(entry => entry.in === 'cookie' && entry.name.toLowerCase() === key.toLowerCase())
    const value = serializeValue(rawValue)
    return `${encodeURIComponent(parameter?.name ?? key)}=${encodeURIComponent(Array.isArray(value) ? value.join(',') : value)}`
  })
  if (cookiePairs.length) headers.set('cookie', cookiePairs.join('; '))

  for (const credential of api.credentials) {
    const value = env[credential.env]
    if (!value) throw new Error(`Credential environment variable is not set: ${credential.env}`)
    headers.set(credential.header, `${credential.prefix}${value}`)
  }

  let body
  if (args.body !== undefined) {
    if (method === 'GET' || method === 'HEAD') throw new Error(`${method} requests cannot include a body`)
    if (typeof args.body !== 'string') throw new Error('body must be a string')
    body = args.body
    headers.set('content-type', args.contentType ?? 'application/json')
  } else if (operation.requestBody?.required) {
    throw new Error(`Operation ${operation.operationId} requires a request body`)
  }

  return { url, method, headers, body }
}

function selectedHeaders(headers) {
  const selected = {}
  for (const [key, value] of headers) {
    if (key === 'content-type' || key === 'content-length' || key === 'etag' || key === 'last-modified'
      || key === 'location' || key === 'link' || key === 'retry-after' || key.startsWith('x-ratelimit-')) {
      selected[key] = value
    }
  }
  return selected
}

/** Invoke one indexed operation and return a bounded canonical JSON result. */
export async function requestOperation(operation, args, api, policy, signal, dependencies = {}) {
  const request = buildOperationRequest(operation, args, api, dependencies.env ?? process.env)
  const timeoutSignal = AbortSignal.timeout(policy.timeoutMs)
  const combinedSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal
  const result = await fetchBounded(request.url, {
    method: request.method,
    headers: request.headers,
    body: request.body,
    signal: combinedSignal,
  }, {
    allowPrivateNetwork: api.allowPrivateNetwork,
    maxBytes: policy.maxResponseBytes,
    maxRedirects: policy.maxRedirects,
  }, dependencies)

  const contentType = result.response.headers.get('content-type') ?? ''
  let body = result.text
  if (!result.truncated && /(?:application\/|\+)json\b/i.test(contentType)) {
    try {
      body = result.text === '' ? null : JSON.parse(result.text)
    } catch {
      body = result.text
    }
  }

  return {
    ok: result.response.ok,
    status: result.response.status,
    statusText: result.response.statusText,
    method: request.method,
    url: result.finalUrl,
    redirects: result.redirects,
    headers: selectedHeaders(result.response.headers),
    truncated: result.truncated,
    body,
  }
}
