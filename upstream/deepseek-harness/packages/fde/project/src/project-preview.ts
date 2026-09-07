/** Isolated loopback preview transport for registered project runtimes. */
import { randomBytes } from 'node:crypto'
import { createServer, request as httpRequest, type IncomingMessage, type ServerResponse, type Server, type OutgoingHttpHeaders } from 'node:http'
import { request as httpsRequest } from 'node:https'
import type { AddressInfo, Socket } from 'node:net'
import type { Duplex } from 'node:stream'

interface PreviewOptions {
  readonly target: (workspaceId: string) => Promise<string | undefined>
  readonly platformPort: number
  readonly timeoutMs: number
}
interface Lease {
  readonly workspaceId: string
  readonly target: URL
  readonly parent: string
  readonly origin: string
  readonly server: Server
  readonly sockets: Set<Socket>
  revalidation?: ReturnType<typeof setInterval>
  pendingCheck?: Promise<void>
}

function targetUrl(value: string, forbiddenPorts: ReadonlySet<number>): URL {
  const url = new URL(value)
  const host = url.hostname.replace(/^\[|\]$/g, '')
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password
    || !(host === 'localhost' || host === '::1' || /^127(?:\.\d{1,3}){3}$/.test(host))
    || forbiddenPorts.has(Number(url.port || (url.protocol === 'https:' ? 443 : 80)))) {
    throw new Error('只允许预览当前项目的独立本地服务，不能代理工作台或外部地址。')
  }
  return url
}

function fail(response: ServerResponse, status: number, message: string): void {
  response.writeHead(status, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' })
  response.end(message)
}

function cleanHeaders(headers: IncomingMessage['headers']): OutgoingHttpHeaders {
  const result = { ...headers }
  const connectionTokens = String(headers.connection ?? '').split(',').map(value => value.trim().toLowerCase())
  for (const name of ['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade', ...connectionTokens]) delete result[name]
  return result
}

function upstreamHeaders(request: IncomingMessage, lease: Lease, upgrade: boolean): OutgoingHttpHeaders {
  const headers = cleanHeaders(request.headers)
  headers.host = lease.target.host
  // A project keeps its own same-origin semantics; GUI headers never reach it.
  if (headers.origin === lease.origin) headers.origin = lease.target.origin
  if (typeof headers.referer === 'string') {
    try {
      const referrer = new URL(headers.referer)
      if (referrer.origin === lease.origin) headers.referer = `${lease.target.origin}${referrer.pathname}${referrer.search}`
      else delete headers.referer
    } catch { delete headers.referer /* Invalid referrers carry no project context. */ }
  }
  for (const name of Object.keys(headers)) if (name.startsWith('x-forwarded-') || name === 'forwarded') delete headers[name]
  if (upgrade) { headers.connection = 'Upgrade'; headers.upgrade = 'websocket' }
  return headers
}

function responseHeaders(upstream: IncomingMessage, lease: Lease): OutgoingHttpHeaders {
  const headers = cleanHeaders(upstream.headers)
  delete headers['x-frame-options']
  // Preserve script/style/connect restrictions; only the approved parent changes.
  const policies = String(headers['content-security-policy'] ?? '').split(',').map(policy =>
    policy.split(';').filter(directive => !/^\s*frame-ancestors\b/i.test(directive)).filter(directive => directive.trim()).join('; '))
  headers['content-security-policy'] = policies.map(policy => `${policy ? `${policy}; ` : ''}frame-ancestors 'self' ${lease.parent}`).join(', ')
  headers['referrer-policy'] = 'no-referrer'
  delete headers.refresh
  if (typeof headers.location === 'string') {
    const location = new URL(headers.location, lease.target.origin)
    if (location.origin !== lease.target.origin) throw new Error('项目跳转到其他来源，请直接在浏览器打开原项目地址。')
    headers.location = `${lease.origin}${location.pathname}${location.search}${location.hash}`
  }
  if (upstream.headers['set-cookie']) headers['set-cookie'] = upstream.headers['set-cookie'].map(cookie => cookie.replace(/;\s*domain=[^;]*/ig, ''))
  return headers
}

/** Owns temporary listeners; no proxy address or state is persisted in project files. */
export class ProjectPreviewGateway {
  private readonly leases = new Map<string, Lease>()
  private queue: Promise<unknown> = Promise.resolve()
  private closed = false
  constructor(private readonly options: PreviewOptions) {}

  /** Open or reuse a preview of a registered runtime for one trusted GUI origin. */
  open(workspaceId: string, parentOrigin: string): Promise<{ url: string; sourceUrl: string }> {
    const operation = this.queue.then(async () => {
      if (this.closed) throw new Error('项目预览服务已关闭。')
      const parent = new URL(parentOrigin)
      if (!['http:', 'https:'].includes(parent.protocol) || parent.port !== String(this.options.platformPort)) throw new Error('工作台来源无效。')
      if (parent.protocol === 'https:') throw new Error('当前本地预览使用 HTTP，请直接打开项目原地址。')
      const current = await this.options.target(workspaceId)
      if (!current) throw new Error('当前项目没有运行中的已登记地址。')
      const forbidden = new Set([this.options.platformPort, ...[...this.leases.values()].map(lease => Number(new URL(lease.origin).port))])
      const target = targetUrl(current, forbidden)
      const key = `${workspaceId}\n${parent.origin}`
      const previous = this.leases.get(key)
      if (previous?.target.href === target.href) return { url: `${previous.origin}${target.pathname}${target.search}${target.hash}`, sourceUrl: target.href }
      if (previous) { await this.closeLease(previous); this.leases.delete(key) }
      const server = createServer()
      const sockets = new Set<Socket>()
      server.on('connection', socket => { sockets.add(socket); socket.once('close', () => sockets.delete(socket)) })
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject)
        server.listen(0, '127.0.0.1', () => { server.off('error', reject); resolve() })
      })
      const origin = `http://fde-${randomBytes(18).toString('hex')}.localhost:${(server.address() as AddressInfo).port}`
      const lease: Lease = { workspaceId, target, parent: parent.origin, origin, server, sockets }
      this.leases.set(key, lease)
      // Long-lived streams must not outlive a revoked runtime. One second is
      // the maximum revalidation interval, independent of upstream timeouts.
      lease.revalidation = setInterval(() => {
        if (lease.pendingCheck) return
        lease.pendingCheck = this.options.target(workspaceId).then(current => {
          if (current !== target.href) for (const socket of sockets) socket.destroy()
        }).catch(() => { for (const socket of sockets) socket.destroy() })
          .finally(() => { delete lease.pendingCheck })
      }, 1_000)
      lease.revalidation.unref()
      server.on('request', (request, response) => { void this.forward(lease, request, response) })
      server.on('upgrade', (request, socket, head) => { void this.upgrade(lease, request, socket, head) })
      return { url: `${origin}${target.pathname}${target.search}${target.hash}`, sourceUrl: target.href }
    })
    this.queue = operation.catch(() => undefined)
    return operation
  }

  private async permitted(lease: Lease, request: IncomingMessage): Promise<boolean> {
    if (this.closed || request.headers.host !== new URL(lease.origin).host) return false
    if (!request.url?.startsWith('/') || request.url.startsWith('//')) return false
    if (request.headers.origin !== undefined && request.headers.origin !== lease.origin) return false
    if (request.headers['sec-fetch-site'] === 'cross-site'
      && !(request.headers['sec-fetch-dest'] === 'iframe' && request.headers.origin === undefined)) return false
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method ?? '') && request.headers.origin !== lease.origin) return false
    return await this.options.target(lease.workspaceId) === lease.target.href
  }

  private upstream(lease: Lease, request: IncomingMessage, upgrade: boolean) {
    const transport = lease.target.protocol === 'https:' ? httpsRequest : httpRequest
    return transport({
      protocol: lease.target.protocol,
      hostname: lease.target.hostname === 'localhost' ? '127.0.0.1' : lease.target.hostname.replace(/^\[|\]$/g, ''),
      port: lease.target.port || (lease.target.protocol === 'https:' ? 443 : 80),
      method: request.method,
      path: request.url,
      headers: upstreamHeaders(request, lease, upgrade),
      timeout: this.options.timeoutMs,
    })
  }

  private async forward(lease: Lease, request: IncomingMessage, response: ServerResponse): Promise<void> {
    try {
      if (!await this.permitted(lease, request)) { request.resume(); fail(response, 403, '预览已失效或请求来源未获授权，请从项目工作台重新打开。'); return }
      const upstream = this.upstream(lease, request, false)
      upstream.once('timeout', () => upstream.destroy(new Error('项目响应超时。')))
      upstream.once('error', () => { if (!response.headersSent) fail(response, 502, '项目服务不可用，请查看项目终端。'); else response.destroy() })
      response.once('close', () => upstream.destroy())
      upstream.once('response', result => {
        try {
          response.writeHead(result.statusCode ?? 502, responseHeaders(result, lease))
          result.once('error', () => response.destroy())
          result.pipe(response)
        } catch (error) {
          result.destroy()
          fail(response, 502, error instanceof Error ? error.message : '项目跳转无法预览。')
        }
      })
      request.pipe(upstream)
    } catch { request.resume(); if (!response.headersSent) fail(response, 503, '项目运行状态暂不可用。') }
  }

  private async upgrade(lease: Lease, request: IncomingMessage, socket: Duplex, head: Buffer): Promise<void> {
    try {
      if (request.headers.upgrade?.toLowerCase() !== 'websocket' || request.headers.origin !== lease.origin || !await this.permitted(lease, request)) {
        socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); return
      }
      const upstream = this.upstream(lease, request, true)
      upstream.once('timeout', () => upstream.destroy())
      upstream.once('error', () => socket.destroy())
      socket.once('close', () => upstream.destroy())
      upstream.once('response', response => { response.destroy(); socket.end('HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n') })
      upstream.once('upgrade', (response, remote, remainder) => {
        remote.setTimeout(0)
        socket.on('error', () => remote.destroy())
        remote.on('error', () => socket.destroy())
        socket.once('close', () => remote.destroy())
        remote.once('close', () => socket.destroy())
        const headers = { ...cleanHeaders(response.headers), connection: 'Upgrade', upgrade: 'websocket' }
        socket.write(`HTTP/1.1 101 Switching Protocols\r\n${Object.entries(headers).map(([name, value]) => `${name}: ${String(value)}\r\n`).join('')}\r\n`)
        if (head.length) remote.write(head)
        if (remainder.length) socket.write(remainder)
        remote.pipe(socket).pipe(remote)
      })
      upstream.end()
    } catch { socket.destroy() }
  }

  private async closeLease(lease: Lease): Promise<void> {
    clearInterval(lease.revalidation)
    await lease.pendingCheck
    const closed = new Promise<void>(resolve => lease.server.close(() => resolve()))
    for (const socket of lease.sockets) socket.destroy()
    lease.server.closeAllConnections()
    await closed
  }

  /** Stop listeners and upgraded streams after pending opens settle. */
  async dispose(): Promise<void> {
    this.closed = true
    await this.queue
    await Promise.all([...this.leases.values()].map(lease => this.closeLease(lease)))
    this.leases.clear()
  }
}
