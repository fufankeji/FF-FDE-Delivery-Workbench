/** Read-only project usage; historical projections are rebuilt without opening an Agent. */
import type { Context } from '@deepseek-ai/cordis'
import { createWebRequestTrust } from '@deepseek-ai/dsh-client-connection'
import { SessionId } from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-session-projection'
import type {} from '@deepseek-ai/dsh-session-projection-cache'
import { WorkspaceId } from '@deepseek-ai/dsh-workspace'

/** Register only when the durable projection services are available. */
export function registerProjectUsage(ctx: Context): void {
  ctx.inject(['sessions', 'sessionProjections', 'sessionProjectionCache'], scoped => {
    const trusted = createWebRequestTrust(scoped.webServer)
    scoped.effect(() => scoped.webServer.register({
      kind: 'exact', path: '/api/fde-project/usage',
      handler: async (request, response) => {
        const send = (status: number, value: unknown) => {
          if (response.destroyed) return
          response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
          response.end(JSON.stringify(value))
        }
        if (!trusted(request)) { send(403, { error: '当前请求不能读取项目用量。' }); return }
        if (request.method !== 'GET') { send(405, { error: '用量接口只接受读取请求。' }); return }
        const query = new URL(request.url ?? '/', 'http://localhost').searchParams
        const id = query.get('workspaceId')
        if (!id || [...query.keys()].some(key => key !== 'workspaceId')) { send(400, { error: '请指定已登记的项目。' }); return }
        const workspace = scoped.workspaceRegistry.get(WorkspaceId(id))
        if (workspace === undefined) { send(404, { error: '当前项目不存在。' }); return }
        const abort = new AbortController()
        const onClose = () => { abort.abort() }
        response.once('close', onClose)
        try {
          const sessions: unknown[] = []
          for (const sessionId of new Set(workspace.sessionIds)) {
            if (abort.signal.aborted) return
            try {
              const session = scoped.sessions.get(SessionId(sessionId))
              const snapshot = session === undefined
                ? await scoped.sessionProjectionCache.coldSnapshot(SessionId(sessionId), abort.signal)
                : scoped.sessionProjections.snapshot(session)
              const values = snapshot.values as Record<string, unknown>
              if (values.sessionStats === undefined || values.tokenUsage === undefined || values.sessionActivity === undefined) {
                throw new Error('Usage projections unavailable')
              }
              sessions.push({ sessionId, status: 'ready', stats: values.sessionStats, usage: values.tokenUsage, activity: values.sessionActivity })
            } catch {
              sessions.push({ sessionId, status: 'unavailable' })
            }
          }
          send(200, { workspaceId: id, sessions })
        } finally {
          response.off('close', onClose)
        }
      },
    }), 'fde-project: request-dated usage')
  })
}
