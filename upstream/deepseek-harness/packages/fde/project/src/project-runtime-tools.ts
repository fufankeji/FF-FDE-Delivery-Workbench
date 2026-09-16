import type { JsonValue } from '@deepseek-ai/dsh-util-values'
/** Agent tool for reporting one exact project runtime operation. */

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { reportProjectRuntime } from './project-runtime.ts'
import { projectRootForExecution } from './tool-context.ts'

const render = (_args: unknown, value: unknown) => [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }]

function jsonObject(value: unknown): Record<string, JsonValue> {
  return JSON.parse(JSON.stringify(value)) as Record<string, JsonValue>
}

/** Register the exact-operation project runtime report tool. */
export function registerProjectRuntimeTools(ctx: Context): void {
  const report = defineTool({
    name: 'project_runtime_report',
    description: 'Report the truthful result of the current FDE project start or stop operation. Use the exact operationId from the visible instruction; never invent a URL or report success before verification.',
    parameters: {
      operationId: { type: 'string', required: true, description: 'Exact operationId from the current visible start/stop instruction.' },
      status: { type: 'string', required: true, enum: ['running', 'stopped', 'blocked'], description: 'Truthful settled runtime state.' },
      message: { type: 'string', description: 'Concise result or blocker visible to the FDE.' },
      previewUrl: { type: 'string', description: 'Verified loopback HTTP(S) project URL; required for running.' },
      docsUrl: { type: 'string', description: 'Optional verified loopback API documentation URL.' },
      openapiSource: { type: 'string', description: 'Optional verified loopback OpenAPI URL or current-project relative file.' },
      baseUrl: { type: 'string', description: 'Optional verified loopback API base URL.' },
      terminalTitle: { type: 'string', description: 'Title of the persistent project terminal, normally 项目运行.' },
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render,
    },
    async execute(args, exec) {
      const root = await projectRootForExecution(ctx, exec)
      const sessionId = String(exec.agent?.session.header.id ?? '')
      const runtime = await reportProjectRuntime(root, {
        operationId: args.operationId,
        status: args.status,
        ...(args.message === undefined ? {} : { message: args.message }),
        ...(args.previewUrl === undefined ? {} : { previewUrl: args.previewUrl }),
        ...(args.docsUrl === undefined ? {} : { docsUrl: args.docsUrl }),
        ...(args.openapiSource === undefined ? {} : { openapiSource: args.openapiSource }),
        ...(args.baseUrl === undefined ? {} : { baseUrl: args.baseUrl }),
        ...(args.terminalTitle === undefined ? {} : { terminalTitle: args.terminalTitle }),
      }, sessionId)
      return { saved: true, runtime: jsonObject(runtime) }
    },
  })

  ctx.effect(() => ctx.tools.register(report), 'fde-project: project_runtime_report')
}
