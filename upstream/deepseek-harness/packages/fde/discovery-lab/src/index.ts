/** Independent business-discovery training Host plugin. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-session-persistence'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { createWebRequestTrust } from '@deepseek-ai/dsh-client-connection'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TrainingService } from './vendor/training.js'
import { createApiHandler } from './vendor/http.js'

/** Stable Host identity. */
export const name = 'fde-discovery-lab'
/** Only native training and Web services; no project or stage service. */
export const inject = ['connection', 'webServer', 'agents', 'sessions', 'sessionPersistence']
/** Persona prompts and role-limited business tools belong only to lab agents. */
export const modelExperience = 'Training-only personas, evidence evaluation and report prompts.'

/** Mount training under a dedicated namespace without registering Workspaces. */
export function apply(ctx: Context): void {
  const home = process.env.DSH_HOME
  if (!home) throw new Error('fde-discovery-lab requires explicit DSH_HOME')
  // Both emitted entries (lib/index.js) and source-level tests resolve the package root.
  const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const root = join(packageRoot, '.assets')
  const appRoot = resolve(packageRoot, '../../client/ui-fde-discovery-lab/lib/app')
  const trusted = createWebRequestTrust(ctx.connection)
  let service: TrainingService | undefined
  if (existsSync(join(root, 'cases/finance/case.json'))) {
    const dataDir = resolve(home, 'fde-discovery-lab')
    mkdirSync(dataDir, { recursive: true })
    service = new TrainingService(ctx, { root, dataDir })
  } else {
    ctx.logger.warn('业务挖掘实验室素材未导入；运行该包的 import:assets 后重启。')
  }
  const api = service ? createApiHandler(service) : undefined
  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix', path: '/api/fde-discovery-lab',
    handler: async (req, res) => {
      if (!trusted(req)) {
        res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify({ error: '跨站或非可信请求被拒绝' }))
        return
      }
      if (!api) {
        res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify({ error: '实验室素材未安装，请按 README 导入交付包后重启服务。' }))
        return
      }
      await api(req, res)
    },
  }), 'fde-discovery-lab: API')
  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix', path: '/fde-discovery-lab',
    handler: (req, res) => {
      if (!trusted(req)) { res.writeHead(403); res.end(); return }
      if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return }
      const relative = new URL(req.url ?? '/', 'http://localhost').pathname.slice('/fde-discovery-lab'.length)
      const file = relative === '' || relative === '/' ? 'index.html' : relative.slice(1)
      // A fixed build-file whitelist cannot expose case definitions or local paths.
      const mime: Record<string, string> = { 'index.html': 'text/html; charset=utf-8', 'app.js': 'text/javascript; charset=utf-8', 'app.css': 'text/css; charset=utf-8' }
      if (!Object.hasOwn(mime, file)) { res.writeHead(404); res.end(); return }
      const path = join(appRoot, file)
      if (!existsSync(path)) {
        res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' })
        res.end('实验室页面尚未构建，请运行 ui-fde-discovery-lab 的 bundle。')
        return
      }
      const bytes = readFileSync(path)
      res.writeHead(200, { 'Content-Type': mime[file]!, 'Content-Length': bytes.length, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "frame-ancestors 'self'" })
      res.end(req.method === 'HEAD' ? undefined : bytes)
    },
  }), 'fde-discovery-lab: isolated application')
}
