/** Independent, owner-authenticated challenge routes. No Agent, Workspace or training service dependencies. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { createWebRequestTrust } from '@deepseek-ai/dsh-client-connection'
import { resolve } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { commandSchema } from './schema.ts'
import { ChallengeError, ChallengeStore } from './store.ts'

/** Stable plugin identity. */
export const name = 'fde-scenario-challenge'
/** Uses only the existing authenticated local HTTP carrier. */
export const inject = ['connection', 'webServer']

function reply(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
  res.end(JSON.stringify(body))
}

async function readCommand(req: IncomingMessage) {
  if (!req.headers['content-type']?.startsWith('application/json')) throw new ChallengeError('invalid')
  const parts: Buffer[] = []
  let size = 0
  for await (const part of req) {
    const buffer: Buffer = Buffer.isBuffer(part) ? part : Buffer.from(String(part))
    size += buffer.length
    if (size > 4096) throw new ChallengeError('invalid')
    parts.push(buffer)
  }
  let value: unknown
  try { value = JSON.parse(Buffer.concat(parts).toString('utf8')) } catch (error) { throw new ChallengeError('invalid') }
  const parsed = commandSchema.safeParse(value)
  if (!parsed.success) throw new ChallengeError('invalid')
  return parsed.data
}

/** Register a private state endpoint with disposal tied to the plugin.
 * @param ctx - Host with Connection authentication and WebServer.
 */
export function apply(ctx: Context): void {
  const home = process.env.DSH_HOME
  if (!home) throw new Error('fde-scenario-challenge requires explicit DSH_HOME')
  const store = new ChallengeStore(resolve(home, 'fde-scenario-challenge/state.json'))
  const trusted = createWebRequestTrust(ctx.connection)
  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix', path: '/api/fde-scenario-challenge',
    handler: async (req, res) => {
      if (!trusted(req)) { reply(res, 403, { error: 'forbidden' }); return }
      const path = new URL(req.url ?? '/', 'http://localhost').pathname
      if (path !== '/api/fde-scenario-challenge') { reply(res, 404, { error: 'unavailable' }); return }
      if (req.method !== 'GET' && req.method !== 'POST') { reply(res, 405, { error: 'invalid' }); return }
      try {
        const command = req.method === 'POST' ? await readCommand(req) : undefined
        reply(res, 200, await store.access(command))
      } catch (error) {
        const code = error instanceof ChallengeError ? error.code : 'storage'
        reply(res, code === 'invalid' ? 400 : code === 'conflict' ? 409 : 503, { error: code })
      }
    },
  }), 'fde-scenario-challenge: owner-only API')
}
