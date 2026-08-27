/** Agent tools for reading one fixed Wiki build and publishing its complete candidate revision. */

import type { Context } from '@deepseek-ai/cordis'
import { defineTool, type JsonValue } from '@deepseek-ai/dsh-tools'
import { REQUIREMENT_WIKI_RELATIONS, REQUIREMENT_WIKI_TOPICS } from './types.ts'
import {
  markRequirementWikiBuildRunning,
  publishRequirementWiki,
  readCurrentRequirementWiki,
} from './requirement-wiki.ts'
import { projectRootForExecution } from './tool-context.ts'

const render = (_args: unknown, value: unknown) => [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }]

function jsonObject(value: unknown): Record<string, JsonValue> {
  return JSON.parse(JSON.stringify(value)) as Record<string, JsonValue>
}

const sourceIds = {
  type: 'array',
  required: true,
  description: 'One or more SourceIds from requirement_wiki_get for this build.',
  items: { type: 'string' },
} as const

const issueItems = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string', required: true },
    title: { type: 'string', required: true },
    detail: { type: 'string', required: true },
    impact: { type: 'string' },
    pageIds: { type: 'array', items: { type: 'string' } },
    sourceIds,
  },
} as const

/**
 * Register Workspace-scoped requirement Wiki read and complete-publication tools.
 * @param ctx - Plugin context that owns tool registrations and their disposal.
 */
export function registerRequirementWikiTools(ctx: Context): void {
  const get = defineTool({
    name: 'requirement_wiki_get',
    description: 'Start work on one explicit FDE requirement-Wiki build. Returns its fixed project sources and exact current revision; read only the listed derivedPath files before publishing.',
    parameters: {
      buildId: { type: 'string', required: true, description: 'Exact BuildId supplied by the visible FDE project instruction.' },
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render,
    },
    async execute(args, exec) {
      const root = await projectRootForExecution(ctx, exec)
      const [build, current] = await Promise.all([
        markRequirementWikiBuildRunning(root, args.buildId),
        readCurrentRequirementWiki(root),
      ])
      return {
        build: jsonObject(build),
        expectedRevision: current?.revision ?? 0,
        current: current === null ? null : jsonObject(current),
        instruction: 'Only use build.sources. Every page, relation, conflict, and unknown must cite one or more listed SourceIds.',
      }
    },
  })

  const publish = defineTool({
    name: 'requirement_wiki_publish',
    description: 'Atomically publish one complete candidate requirement Wiki for the active build. Call requirement_wiki_get first; partial or untraceable output is rejected and the previous revision remains current.',
    parameters: {
      buildId: { type: 'string', required: true, description: 'Exact active BuildId.' },
      expectedRevision: { type: 'integer', required: true, description: 'Exact revision returned by requirement_wiki_get; 0 when no Wiki exists.' },
      pages: {
        type: 'array', required: true, description: 'Complete candidate knowledge pages.',
        items: { type: 'object', additionalProperties: false, properties: {
          id: { type: 'string', required: true, description: 'Stable lowercase ASCII id.' },
          topic: { type: 'string', required: true, enum: [...REQUIREMENT_WIKI_TOPICS] },
          title: { type: 'string', required: true },
          summary: { type: 'string' },
          body: { type: 'string', required: true, description: 'Candidate Markdown without executable HTML.' },
          sourceIds,
        } },
      },
      relations: {
        type: 'array', required: true, description: 'Relations whose endpoints are ids in pages.',
        items: { type: 'object', additionalProperties: false, properties: {
          id: { type: 'string', required: true },
          from: { type: 'string', required: true },
          to: { type: 'string', required: true },
          type: { type: 'string', required: true, enum: [...REQUIREMENT_WIKI_RELATIONS] },
          label: { type: 'string' },
          directed: { type: 'boolean' },
          sourceIds,
        } },
      },
      conflicts: { type: 'array', required: true, description: 'Contradictory candidate statements that need human resolution.', items: issueItems },
      unknowns: { type: 'array', required: true, description: 'Missing or ambiguous information that needs confirmation.', items: issueItems },
    },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: {
        saved: { type: 'boolean', required: true },
        revision: { type: 'integer', required: true },
        wiki: { type: 'object', required: true, additionalProperties: true },
      } },
      render,
    },
    async execute(args, exec) {
      const root = await projectRootForExecution(ctx, exec)
      const wiki = await publishRequirementWiki(root, args.buildId, args.expectedRevision, {
        pages: args.pages,
        relations: args.relations,
        conflicts: args.conflicts,
        unknowns: args.unknowns,
      }, String(exec.agent?.session.header.id ?? 'project-agent'))
      return { saved: true, revision: wiki.revision, wiki: jsonObject(wiki) }
    },
  })

  ctx.effect(() => ctx.tools.register(get), 'fde-project: requirement_wiki_get')
  ctx.effect(() => ctx.tools.register(publish), 'fde-project: requirement_wiki_publish')
}
