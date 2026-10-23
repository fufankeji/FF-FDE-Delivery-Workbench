/** Owner-authenticated, read-only access to the recorded project's Agent PTY. */
import type { Context } from '@deepseek-ai/cordis'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type {} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-terminal'
import { SessionId } from '@deepseek-ai/dsh-session'
import { WorkspaceId } from '@deepseek-ai/dsh-workspace'
import { createWebRequestTrust } from '@deepseek-ai/dsh-client-connection'
import { loadProjectRuntimeSnapshot } from './project-runtime.ts'

/** A missing live terminal never implies that the saved project service has stopped. */
export type ProjectRuntimeOutput = { status: 'missing' } | {
  status: 'ready'; sessionId: string; terminalId: string; title: string
  text: string; truncated: boolean; processStatus: 'running' | 'exited'
}

/**
 * Bind the authenticated HTTP reader without exposing terminal input or allocation.
 * @param options - trust predicate and project-scoped read capability.
 * @returns the GET-only route handler.
 */
export function createRuntimeOutputRoute(options: {
  trusted: (request: IncomingMessage) => boolean
  read: (workspaceId: string) => Promise<ProjectRuntimeOutput | undefined>
}) {
  return async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    const send = (status: number, value: unknown): void => {
      if (response.destroyed) return
      response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
      response.end(JSON.stringify(value))
    }
    if (!options.trusted(request)) { send(403, { error: 'forbidden' }); return }
    if (request.method !== 'GET') { request.resume(); send(405, { error: 'read-only' }); return }
    const query = new URL(request.url ?? '/', 'http://localhost').searchParams
    const id = query.get('workspaceId')
    if (!id || id.length > 160 || [...query.keys()].length !== 1 || [...query.keys()].some(key => key !== 'workspaceId')) {
      send(400, { error: 'invalid-project' }); return
    }
    try {
      const value = await options.read(id)
      if (value === undefined) { send(404, { error: 'project-not-found' }); return }
      send(200, { workspaceId: id, ...value })
    } catch {
      // Corrupt runtime records and failed PTY reads are not empty successful output.
      send(409, { error: 'output-unavailable' })
    }
  }
}

/**
 * Resolve only the saved running Session and exact terminal name, without activating an Agent.
 * @param ctx - FDE Host context with Agent and workspace registries.
 * @param workspaceId - registered project identity, never a filesystem path.
 * @returns bounded output, an explicit missing state, or undefined for an invalid project association.
 */
export async function readProjectRuntimeOutput(ctx: Context, workspaceId: string): Promise<ProjectRuntimeOutput | undefined> {
  const workspace = ctx.workspaceRegistry.get(WorkspaceId(workspaceId))
  if (workspace === undefined) return undefined
  const runtime = await loadProjectRuntimeSnapshot(workspace.path)
  if (runtime.sessionId === undefined) return { status: 'missing' }
  if (!workspace.sessionIds.includes(SessionId(runtime.sessionId))) return undefined
  const agent = ctx.agents.get(SessionId(runtime.sessionId))
  if (agent === undefined) return { status: 'missing' }
  const terminals = agent.ctx.get('terminals')
  if (terminals === undefined) return { status: 'missing' }
  const title = runtime.terminalTitle ?? '项目运行'
  const terminal = terminals.list(agent).find(item => item.name === title)
  if (terminal === undefined) return { status: 'missing' }
  const output = terminals.read(agent, terminal.sessionId, { count: 200 })
  const bytes = Buffer.from(output.text)
  const maxBytes = 65_536
  return {
    status: 'ready', sessionId: runtime.sessionId, terminalId: terminal.sessionId, title,
    text: bytes.length > maxBytes ? bytes.subarray(bytes.length - maxBytes).toString('utf8') : output.text,
    truncated: output.truncated || bytes.length > maxBytes, processStatus: terminal.status.kind,
  }
}

/** Register the read-only output route with the existing FDE request identity policy. */
export function registerProjectRuntimeOutput(ctx: Context): void {
  ctx.inject(['agents'], scope => {
    scope.effect(() => scope.webServer.register({
      kind: 'exact', path: '/api/fde-project/runtime/output',
      handler: createRuntimeOutputRoute({
        trusted: createWebRequestTrust(scope.connection),
        read: id => readProjectRuntimeOutput(scope, id),
      }),
    }), 'fde-project: runtime output')
  })
}
