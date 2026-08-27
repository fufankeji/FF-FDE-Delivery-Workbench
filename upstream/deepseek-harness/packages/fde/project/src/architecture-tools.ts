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
    description: 'Publish one complete candidate architecture for the current FDE project. Call architecture_get first and pass its exact expectedRevision.',
    parameters: {
      expectedRevision: { type: 'integer', required: true, description: 'Exact revision from architecture_get; 0 when absent.' },
      title: { type: 'string', required: true, description: 'Architecture title.' },
      summary: { type: 'string', description: 'Business and technical objective summary.' },
      groups: {
        type: 'array', required: true, description: 'System layers or responsibility groups.',
        items: { type: 'object', additionalProperties: false, properties: {
          id: { type: 'string', required: true }, label: { type: 'string', required: true },
        } },
      },
      nodes: {
        type: 'array', required: true, description: 'System components.',
        items: { type: 'object', additionalProperties: false, properties: {
          id: { type: 'string', required: true },
          label: { type: 'string', required: true },
          kind: { type: 'string', required: true, enum: [...ARCHITECTURE_NODE_KINDS] },
          note: { type: 'string' },
          group: { type: 'string' },
        } },
      },
      edges: {
        type: 'array', required: true, description: 'Directed relationships between existing node ids.',
        items: { type: 'object', additionalProperties: false, properties: {
          from: { type: 'string', required: true },
          to: { type: 'string', required: true },
          label: { type: 'string' },
          dashed: { type: 'boolean' },
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
