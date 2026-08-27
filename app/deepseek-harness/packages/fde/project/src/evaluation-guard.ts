/** Project path and cost guard for the externally supplied evaluation tools. */

import { lstat } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type { PreToolDecision, ToolExecution } from '@deepseek-ai/dsh-tools'
import { projectRootForExecution } from './tool-context.ts'

const EVALUATION_TOOL_NAMES = new Set(['eval_run', 'eval_gate', 'eval_judge_validate'])

function recordOf(value: unknown): Readonly<Record<string, unknown>> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Readonly<Record<string, unknown>>
    : undefined
}

function inside(base: string, candidate: string): boolean {
  if (!isAbsolute(candidate)) return false
  const rel = relative(resolve(base), resolve(candidate))
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !rel.startsWith('../'))
}

async function containsExistingSymlink(root: string, candidate: string): Promise<boolean> {
  const rel = relative(resolve(root), resolve(candidate))
  let current = resolve(root)
  for (const part of rel.split(sep).filter(Boolean)) {
    current = join(current, part)
    try {
      if ((await lstat(current)).isSymbolicLink()) return true
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
      throw error
    }
  }
  return false
}

async function guardedPath(
  workspaceRoot: string,
  base: string,
  value: unknown,
  label: string,
  required: boolean,
): Promise<PreToolDecision | undefined> {
  if (value === undefined && !required) return undefined
  if (typeof value !== 'string' || !inside(base, value)) {
    return { kind: 'deny', reason: `${label} 必须位于当前项目的 ${relative(workspaceRoot, base)}。` }
  }
  if (await containsExistingSymlink(workspaceRoot, value)) {
    return { kind: 'deny', reason: `${label} 不能经过符号链接。` }
  }
  return undefined
}

/**
 * Decide whether one evaluation call stays inside the current project.
 * @param workspaceRoot - canonical registered Workspace path.
 * @param toolName - exact model-visible evaluation tool name.
 * @param rawArgs - frozen untrusted tool arguments.
 * @returns a denial, or undefined when this guard allows delegation.
 */
export async function projectEvaluationDecision(
  workspaceRoot: string,
  toolName: string,
  rawArgs: unknown,
): Promise<PreToolDecision | undefined> {
  if (!EVALUATION_TOOL_NAMES.has(toolName)) return undefined
  if (toolName === 'eval_judge_validate') {
    return { kind: 'deny', reason: 'FDE 第一版未启用 Judge 校准；它可能产生额外模型调用。' }
  }
  const args = recordOf(rawArgs)
  if (args === undefined) return { kind: 'deny', reason: '评估工具参数无效。' }
  const evaluationRoot = join(workspaceRoot, '.fde', 'evaluations')
  if (toolName === 'eval_gate') {
    return await guardedPath(workspaceRoot, evaluationRoot, args.after, 'after', true)
      ?? await guardedPath(workspaceRoot, evaluationRoot, args.before, 'before', false)
  }
  if (args.dsh_bin !== undefined) {
    return { kind: 'deny', reason: 'FDE 项目评估不允许模型覆盖 dsh_bin。' }
  }
  if (args.profile !== undefined && args.profile !== 'headless') {
    return { kind: 'deny', reason: 'FDE 项目评估只允许 headless profile。' }
  }
  const runtimeRoot = join(workspaceRoot, '.runtime', 'fde-evaluations')
  return await guardedPath(workspaceRoot, join(evaluationRoot, 'cases'), args.cases_dir, 'cases_dir', true)
    ?? await guardedPath(workspaceRoot, runtimeRoot, args.output_dir, 'output_dir', true)
    ?? await guardedPath(workspaceRoot, runtimeRoot, args.session_root, 'session_root', false)
}

/**
 * Register the monotonic pre-execution evaluation path guard.
 * @param ctx - Host context carrying tools and Workspaces.
 */
export function registerProjectEvaluationGuard(ctx: Context): void {
  ctx.on('tools/pre-execute', async (exec: ToolExecution, next): Promise<PreToolDecision> => {
    if (!EVALUATION_TOOL_NAMES.has(exec.name)) return await next()
    try {
      const root = await projectRootForExecution(ctx, exec)
      return await projectEvaluationDecision(root, exec.name, exec.arguments) ?? await next()
    } catch (error) {
      return { kind: 'deny', reason: error instanceof Error ? error.message : '当前项目评估授权失败。' }
    }
  })
}
