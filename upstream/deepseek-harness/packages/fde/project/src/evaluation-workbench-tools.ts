/** Read-only current-project candidate and test evidence tool for DSH. */

import type { Context } from '@deepseek-ai/cordis'
import { defineTool, type JsonValue } from '@deepseek-ai/dsh-tools'
import { projectRootForExecution } from './tool-context.ts'
import { loadV2StageSurface } from './v2-stage-surface.ts'

/**
 * Register the stage-five evidence reader; it neither develops projects nor runs tests.
 * @param ctx - Host context with project and tool services.
 */
export function registerEvaluationWorkbenchTools(ctx: Context): void {
  const tool = defineTool({
    name: 'project_evaluation_get',
    description: 'Read current-project stage-five candidate version, test metrics, evidence gaps and the current file-bound testing fingerprint. Read before testing; record actual results with this fingerprint in .fde/stages/evaluation.json. This tool does not run tests, approve results or advance stages.',
    parameters: {},
    output: {
      schema: { type: 'object', additionalProperties: true, properties: {} },
      render: (_args: unknown, value: unknown) => [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
    },
    async execute(_args, exec) {
      const root = await projectRootForExecution(ctx, exec)
      const stage = await loadV2StageSurface(root, 'evaluation')
      return JSON.parse(JSON.stringify({
        statePath: stage.statePath, evaluation: stage.evaluation,
        reviewReady: stage.reviewReady, reviewBlockers: stage.reviewBlockers,
      })) as Record<string, JsonValue>
    },
  })
  ctx.effect(() => ctx.tools.register(tool), 'fde-project: project_evaluation_get')
}
