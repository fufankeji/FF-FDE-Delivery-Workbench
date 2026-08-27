/** Agent tools for reading and atomically publishing project architecture candidates. */

import type { Context } from '@deepseek-ai/cordis'
import { defineTool, type JsonValue } from '@deepseek-ai/dsh-tools'
import { ARCHITECTURE_NODE_KINDS } from './types.ts'
import { readProjectArchitecture, replaceProjectArchitecture } from './snapshot.ts'
import { projectRootForExecution } from './tool-context.ts'

const render = (_args: unknown, value: unknown) => [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }]

function jsonObject(value: unknown): Record<string, JsonValue> {
  return JSON.parse(JSON.stringify(value)) as Record<string, JsonValue>
}

/**
 * Register project architecture read and complete-candidate write tools.
 * @param ctx - Host context carrying tools and Workspace registry.
 */
export function registerProjectArchitectureTools(ctx: Context): void {
  const get = defineTool({
    name: 'architecture_get',
    description: 'Read the current FDE project system architecture and its exact revision before proposing changes.',
    parameters: {},
    output: {
      schema: { type: 'object', additionalProperties: false, properties: {
        exists: { type: 'boolean', required: true },
        expectedRevision: { type: 'integer', required: true },
        path: { type: 'string' },
        architecture: { type: 'object', additionalProperties: true },
      } },
      render,
    },
    async execute(_args, exec) {
      const root = await projectRootForExecution(ctx, exec)
      const architecture = await readProjectArchitecture(root)
      return architecture === null
        ? { exists: false, expectedRevision: 0, path: '.fde/architecture.json' }
        : { exists: true, expectedRevision: architecture.revision, architecture: jsonObject(architecture) }
    },
  })

  const set = defineTool({
    name: 'architecture_set',
    description: 'Publish one complete evidence-backed candidate architecture for the current FDE project. Preserve stable ids, order responsibility groups from entry to output, include only material relationships, and pass the exact expectedRevision returned by architecture_get.',
    parameters: {
      expectedRevision: { type: 'integer', required: true, description: 'Exact revision from architecture_get; 0 when absent.' },
      title: { type: 'string', required: true, description: 'Concise title naming the actual system or candidate architecture.' },
      summary: { type: 'string', description: 'Scope, current-versus-candidate status, key evidence, constraints, and unresolved differences.' },
      groups: {
        type: 'array', required: true, description: 'Stable responsibility groups ordered from entry to delivery output; use kebab-case ids.',
        items: { type: 'object', additionalProperties: false, properties: {
          id: { type: 'string', required: true, description: 'Stable kebab-case group id.' },
          label: { type: 'string', required: true, description: 'Short responsibility label.' },
        } },
      },
      nodes: {
        type: 'array', required: true, description: 'Major runtime components, capabilities, stores, external boundaries, or delivery outputs.',
        items: { type: 'object', additionalProperties: false, properties: {
          id: { type: 'string', required: true, description: 'Stable kebab-case component id; preserve it while the concept remains the same.' },
          label: { type: 'string', required: true, description: 'Short component or capability name.' },
          kind: {
            type: 'string',
            required: true,
            enum: [...ARCHITECTURE_NODE_KINDS],
            description: 'entry=user/system entry; core=orchestration/domain/AI core; store=durable data/evidence; external=outside boundary; output=deliverable; default=other.',
          },
          note: { type: 'string', description: 'Real responsibility, source evidence, constraint, candidate status, or unresolved fact.' },
          group: { type: 'string', description: 'Id of the declared responsibility group that owns this node.' },
        } },
      },
      edges: {
        type: 'array', required: true, description: 'Material runtime, data-flow, control-flow, or dependency relationships between existing node ids.',
        items: { type: 'object', additionalProperties: false, properties: {
          from: { type: 'string', required: true, description: 'Id of the component initiating the relationship.' },
          to: { type: 'string', required: true, description: 'Id of the component receiving the relationship.' },
          label: { type: 'string', description: 'Short action, data, or dependency label.' },
          dashed: { type: 'boolean', description: 'True only for optional, asynchronous, or not-yet-implemented candidate relationships.' },
        } },
      },
    },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: {
        saved: { type: 'boolean', required: true },
        architecture: { type: 'object', required: true, additionalProperties: true },
      } },
      render,
    },
    async execute(args, exec) {
      const root = await projectRootForExecution(ctx, exec)
      const architecture = await replaceProjectArchitecture(root, {
        title: args.title,
        ...(args.summary === undefined ? {} : { summary: args.summary }),
        groups: args.groups,
        nodes: args.nodes,
        edges: args.edges,
      }, args.expectedRevision)
      return { saved: true, architecture: jsonObject(architecture) }
    },
  })

  ctx.effect(() => ctx.tools.register(get), 'fde-project: architecture_get')
  ctx.effect(() => ctx.tools.register(set), 'fde-project: architecture_set')
}
