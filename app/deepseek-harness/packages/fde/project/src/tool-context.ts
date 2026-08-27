/** Resolve the registered FDE project that owns one model tool execution. */

import type { Context } from '@deepseek-ai/cordis'
import type { ToolRunContext } from '@deepseek-ai/dsh-tools'

/**
 * Resolve a tool call's Agent cwd through the canonical Workspace registry.
 * @param ctx - Host context carrying the Workspace registry.
 * @param exec - current model tool execution.
 * @returns the canonical registered project path.
 */
export async function projectRootForExecution(
  ctx: Context,
  exec: Pick<ToolRunContext, 'agent'>,
): Promise<string> {
  const cwd = exec.agent?.session.header.cwd
  if (cwd === undefined || cwd === '') throw new Error('项目工具必须从项目会话调用。')
  const workspace = await ctx.workspaceRegistry.resolveByPath(cwd)
  if (workspace === undefined) throw new Error('当前会话目录未注册为项目。')
  return workspace.path
}
