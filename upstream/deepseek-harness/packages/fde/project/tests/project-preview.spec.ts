import { afterEach, describe, expect, it } from 'vitest'
import { createServer, request, type Server, type IncomingHttpHeaders } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { Socket } from 'node:net'
import { ProjectPreviewGateway } from '../src/project-preview.ts'
import { createProjectPreviewRoute } from '../src/http.ts'

const cleanups: (() => Promise<void>)[] = []
afterEach(async () => { for (const close of cleanups.splice(0).reverse()) await close() })
async function listen(server: Server): Promise<string> {
  const sockets = new Set<Socket>()
  server.on('connection', socket => { sockets.add(socket); socket.once('close', () => sockets.delete(socket)) })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  cleanups.push(async () => { for (const socket of sockets) socket.destroy(); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())) })
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`
}
function get(url: string, options: { method?: string; headers?: IncomingHttpHeaders; body?: string } = {}): Promise<{ status: number; headers: IncomingHttpHeaders; body: string }> {
  const parsed = new URL(url)
  return new Promise((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port: parsed.port, path: parsed.pathname + parsed.search, method: options.method ?? 'GET', headers: { host: parsed.host, ...options.headers } }, res => {
      const chunks: Buffer[] = []
      res.on('data', chunk => chunks.push(chunk))
      res.on('error', reject)
      res.on('end', () => resolve({ status: res.statusCode!, headers: res.headers, body: Buffer.concat(chunks).toString() }))
    })
    req.on('error', reject); req.end(options.body)
  })
}

describe('isolated project preview', () => {
  it('serves unchanged pages, root assets, streaming APIs and project-origin writes on separate origins', async () => {
    const seen: { host?: string; origin?: string }[] = []
    const target = await listen(createServer((req, res) => {
      seen.push({ ...req.headers.host && { host: req.headers.host }, ...req.headers.origin && { origin: req.headers.origin } })
      res.setHeader('content-security-policy', "default-src 'self'; script-src 'self'; frame-ancestors 'none'")
      res.setHeader('x-frame-options', 'DENY')
      res.setHeader('set-cookie', 'project=ok; Domain=localhost; Path=/; HttpOnly')
      if (req.url === '/go') { res.writeHead(302, { location: '/page?x=1' }); res.end(); return }
      if (req.url === '/external') { res.writeHead(302, { location: 'https://example.com/' }); res.end(); return }
      if (req.url === '/api/echo') { req.pipe(res); return }
      if (req.url === '/events') { res.write('data: first\n\n'); setImmediate(() => res.end('data: second\n\n')); return }
      res.end(req.url === '/app.js' ? 'fetch("/api/echo")' : '<script src="/app.js"></script>')
    }))
    let active: string | undefined = target + '/'
    const gateway = new ProjectPreviewGateway({ target: async () => active, platformPort: 3099, timeoutMs: 1000 })
    cleanups.push(() => gateway.dispose())
    const a = await gateway.open('a', 'http://127.0.0.1:3099')
    const b = await gateway.open('b', 'http://127.0.0.1:3099')
    const origin = new URL(a.url).origin
    expect(new URL(a.url).hostname).not.toBe(new URL(b.url).hostname)
    expect((await gateway.open('a', 'http://127.0.0.1:3099')).url).toBe(a.url)
    const html = await get(a.url)
    expect(html.status).toBe(200)
    expect(html.body).toBe('<script src="/app.js"></script>')
    expect(html.headers['x-frame-options']).toBeUndefined()
    expect(html.headers['content-security-policy']).toBe("default-src 'self';  script-src 'self'; frame-ancestors 'self' http://127.0.0.1:3099")
    expect(html.headers['set-cookie']).toEqual(['project=ok; Path=/; HttpOnly'])
    expect((await get(origin + '/app.js')).body).toBe('fetch("/api/echo")')
    expect((await get(origin + '/events')).body).toContain('data: second')
    expect((await get(origin + '/api/echo', { method: 'POST', headers: { origin }, body: 'test-input' })).body).toBe('test-input')
    expect(seen.at(-1)).toEqual({ host: new URL(target).host, origin: target })
    expect((await get(origin + '/go')).headers.location).toBe(origin + '/page?x=1')
    expect((await get(origin + '/external')).status).toBe(502)
    expect((await get(a.url, { headers: { host: 'evil.example' } })).status).toBe(403)
    expect((await get(a.url, { headers: { origin: 'http://evil.example' } })).status).toBe(403)
    expect((await get(origin + '/api/echo', { method: 'POST', body: 'blocked' })).status).toBe(403)
    expect((await get(a.url, { headers: { 'sec-fetch-site': 'cross-site', 'sec-fetch-dest': 'script' } })).status).toBe(403)
    active = undefined
    expect((await get(a.url)).status).toBe(403)
    await expect(gateway.open('a', 'http://127.0.0.1:3099')).rejects.toThrow('没有运行')
  })

  it('tunnels WebSocket traffic and rejects cross-origin upgrades', async () => {
    const upstream = createServer()
    upstream.on('upgrade', (req, socket) => {
      expect(req.headers.origin).toBe(target)
      socket.write('HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n')
      socket.on('data', bytes => socket.write(bytes))
    })
    const target = await listen(upstream)
    let active: string | undefined = target + '/'
    const gateway = new ProjectPreviewGateway({ target: async () => active, platformPort: 3099, timeoutMs: 1000 })
    cleanups.push(() => gateway.dispose())
    const preview = new URL((await gateway.open('a', 'http://127.0.0.1:3099')).url)
    const connect = (origin: string) => new Promise<string | number>((resolve, reject) => {
      const req = request({ hostname: '127.0.0.1', port: preview.port, path: '/hmr', headers: { host: preview.host, origin, connection: 'Upgrade', upgrade: 'websocket' } })
      req.on('response', res => { res.resume(); resolve(res.statusCode!) })
      req.on('upgrade', (_res, socket) => {
        socket.once('data', data => { resolve(data.toString()); socket.destroy() })
        socket.on('error', reject); socket.write('hmr-update')
      })
      req.on('error', reject); req.end()
    })
    expect(await connect(preview.origin)).toBe('hmr-update')
    expect(await connect('http://evil.example')).toBe(403)
    await new Promise<void>((resolve, reject) => {
      const req = request({ hostname: '127.0.0.1', port: preview.port, path: '/hmr', headers: { host: preview.host, origin: preview.origin, connection: 'Upgrade', upgrade: 'websocket' } })
      req.once('upgrade', (_res, socket) => {
        active = undefined
        socket.on('error', reject)
        socket.once('end', () => { socket.destroy(); resolve() })
      })
      req.on('error', reject); req.end()
    })
  })

  it('binds only registered local targets and closes old listeners on rebinding', async () => {
    const first = await listen(createServer((_req, res) => res.end('first')))
    const second = await listen(createServer((_req, res) => res.end('second')))
    let target: string | undefined = first + '/'
    const gateway = new ProjectPreviewGateway({ target: async () => target, platformPort: 3099, timeoutMs: 1000 })
    cleanups.push(() => gateway.dispose())
    const old = await gateway.open('a', 'http://127.0.0.1:3099')
    target = second + '/'
    expect((await get(old.url)).status).toBe(403)
    const fresh = await gateway.open('a', 'http://127.0.0.1:3099')
    expect((await get(fresh.url)).body).toBe('second')
    await expect(get(old.url)).rejects.toThrow()
    for (const blocked of ['http://example.com/', 'http://127.0.0.1:3099/', 'http://user:pass@127.0.0.1:4177/', 'http://169.254.169.254/']) {
      target = blocked
      await expect(gateway.open('blocked', 'http://127.0.0.1:3099')).rejects.toThrow()
    }
    await gateway.dispose()
    await expect(get(fresh.url)).rejects.toThrow()
  })

  it('accepts only trusted Workspace IDs at the platform opening route', async () => {
    const route = createProjectPreviewRoute({ trusted: req => req.headers.origin === 'http://platform.test', open: async id => ({ url: `http://preview/${id}`, sourceUrl: 'http://127.0.0.1:4177/' }) })
    const address = await listen(createServer((req, res) => { void route(req, res) }))
    const headers = { origin: 'http://platform.test', 'content-type': 'application/json' }
    expect((await get(address, { method: 'POST', headers, body: '{"workspaceId":"a"}' })).status).toBe(200)
    expect((await get(address, { method: 'POST', headers, body: '{"workspaceId":"a","url":"http://elsewhere"}' })).status).toBe(400)
    expect((await get(address, { method: 'POST', body: '{"workspaceId":"a"}' })).status).toBe(403)
    expect((await get(address, { headers })).status).toBe(405)
  })
})
