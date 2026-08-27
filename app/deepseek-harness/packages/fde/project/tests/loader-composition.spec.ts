/**
 * REAL-composition coverage: a test-only cordis.yml boots the actual prompt,
 * tool runtime, and FDE project plugin through Loader. One real parsed project
 * Source travels through the trusted start route, both model tools, immutable
 * storage, and the user-facing project snapshot route without a model call.
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Include from '@deepseek-ai/cordis-plugin-include'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import {
  parseProjectSource,
  registerStoredProjectResources,
  storeProjectResourceBatch,
} from '@deepseek-ai/dsh-fde-source'
import { CallId } from '@deepseek-ai/dsh-llm'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import * as FdeProject from '../src/index.ts'

type RouteHandler = (request: IncomingMessage, response: ServerResponse) => void | Promise<void>

let context: Context | undefined
let root: string | undefined

afterEach(async () => {
  await context?.fiber.dispose()
  context = undefined
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
})

function request(body: unknown, host = '127.0.0.1:3080'): IncomingMessage {
  const bytes = Buffer.from(JSON.stringify(body))
  return {
    method: 'POST',
    headers: { host, 'content-length': String(bytes.byteLength), 'sec-fetch-site': 'same-origin' },
    resume: vi.fn(),
    async *[Symbol.asyncIterator]() { yield bytes },
  } as unknown as IncomingMessage
}

function response(): {
  readonly value: ServerResponse
  readonly snapshot: () => { readonly status: number; readonly body: unknown }
} {
  let status = 0
  let body = ''
  return {
    value: {
      writeHead: (next: number) => { status = next },
      end: (next?: string | Uint8Array) => { body = next === undefined ? '' : String(next) },
    } as unknown as ServerResponse,
    snapshot: () => ({ status, body: JSON.parse(body) as unknown }),
  }
}

function resultText(result: { readonly content: readonly { readonly type: string; readonly text?: string }[] }): string {
  return result.content.filter(block => block.type === 'text').map(block => block.text ?? '').join('')
}

async function boot(): Promise<{
  readonly ctx: Context
  readonly workspace: string
  readonly sourceId: string
  readonly routes: Map<string, RouteHandler>
}> {
  root = await mkdtemp(join(tmpdir(), 'fde-project-composition-'))
  await mkdir(join(root, 'workspace'))
  const workspace = await realpath(join(root, 'workspace'))
  const stored = await storeProjectResourceBatch(workspace, [{
    name: '客户需求.md',
    data: Buffer.from('# 目标\n减少交付遗漏，并让每项结论保留来源。'),
  }])
  const [registered] = await registerStoredProjectResources(workspace, stored)
  if (registered === undefined) throw new Error('test source was not registered')
  const source = await parseProjectSource(workspace, registered.sourceId)

  const routes = new Map<string, RouteHandler>()
  const workspaceRecord = { workspaceId: 'workspace-1', title: '客户交付项目', path: workspace, sessionIds: [] }
  const host = {
    name: 'test-fde-project-host',
    apply(ctx: Context) {
      ctx.provide('webServer', {
        register: (route: { readonly path: string; readonly handler: RouteHandler }) => {
          routes.set(route.path, route.handler)
          return () => { routes.delete(route.path) }
        },
      } as never)
      ctx.provide('workspaceRegistry', {
        get: (workspaceId: string) => workspaceId === 'workspace-1' ? workspaceRecord : undefined,
        resolveByPath: async (path: string) => path === workspace ? workspaceRecord : undefined,
      } as never)
    },
  }
  const configPath = join(root, 'cordis.yml')
  await writeFile(configPath, [
    '- name: test-fde-project-host',
    "- name: '@deepseek-ai/dsh-system-prompt'",
    "- name: '@deepseek-ai/dsh-tools'",
    "- name: '@deepseek-ai/dsh-fde-project'",
    '',
  ].join('\n'))

  const ctx = new Context()
  context = ctx
  ctx.baseUrl = pathToFileURL(root).href + '/'
  await ctx.plugin(Loader)
  ctx.loader.builtins.include = Include
  const modules = new Map<string, unknown>([
    ['test-fde-project-host', host],
    ['@deepseek-ai/dsh-system-prompt', SystemPrompt],
    ['@deepseek-ai/dsh-tools', ToolRuntime],
    ['@deepseek-ai/dsh-fde-project', FdeProject],
  ])
  ctx.loader.internal = {
    version: 'v2',
    async import(specifier: string) {
      if (!modules.has(specifier)) throw new Error(`unexpected Loader import: ${specifier}`)
      return modules.get(specifier)
    },
  } as unknown as NonNullable<typeof ctx.loader.internal>
  await ctx.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(configPath).href } })
  await ctx.loader.await()
  return { ctx, workspace, sourceId: source.sourceId, routes }
}

describe('FDE project real Loader composition through cordis.yml', () => {
  it('publishes one traceable Wiki revision from a real parsed Source and exposes it to the project UI', async () => {
    const { ctx, workspace, sourceId, routes } = await boot()
    expect(ctx.tools.schemas().map(schema => schema.name)).toEqual(expect.arrayContaining([
      'architecture_get', 'architecture_set', 'requirement_wiki_get', 'requirement_wiki_publish',
    ]))
    const architectureSet = ctx.tools.schemas().find(schema => schema.name === 'architecture_set')
    expect(architectureSet?.description).toContain('evidence-backed')
    const architectureParameters = JSON.stringify(architectureSet?.parameters)
    expect(architectureParameters).toContain('ordered from entry to delivery output')
    expect(architectureParameters).toContain('Major runtime components')
    expect(architectureParameters).toContain('Material runtime, data-flow, control-flow, or dependency')
    const start = routes.get(FdeProject.FDE_REQUIREMENT_WIKI_START_PATH)
    if (start === undefined) throw new Error('Wiki start route was not registered')

    const denied = response()
    await start(request({ workspaceId: 'workspace-1', sourceIds: [sourceId], expectedRevision: 0 }, 'evil.example'), denied.value)
    expect(denied.snapshot()).toMatchObject({ status: 403, body: { ok: false, error: { code: 'forbidden' } } })

    const started = response()
    await start(request({ workspaceId: 'workspace-1', sourceIds: [sourceId], expectedRevision: 0 }), started.value)
    expect(started.snapshot()).toMatchObject({
      status: 200,
      body: { ok: true, value: { requirementWiki: { status: 'absent', build: { status: 'queued' } } } },
    })
    const build = (started.snapshot().body as {
      value: { requirementWiki: { build: { id: string } } }
    }).value.requirementWiki.build
    const agent = { session: { header: { id: 'session-wiki', cwd: workspace } } } as never

    const get = await ctx.tools.execute({
      signal: new AbortController().signal,
      callId: CallId('wiki-get'),
      name: 'requirement_wiki_get',
      arguments: { buildId: build.id },
      agent,
    })
    expect(get.isError).toBe(false)
    expect(resultText(get)).toContain(`.fde/derived/${sourceId}.md`)

    const publish = await ctx.tools.execute({
      signal: new AbortController().signal,
      callId: CallId('wiki-publish'),
      name: 'requirement_wiki_publish',
      arguments: {
        buildId: build.id,
        expectedRevision: 0,
        pages: [{
          id: 'delivery_goal', topic: 'business-goal', title: '交付目标',
          body: '减少交付遗漏，并让每项结论保留来源。', sourceIds: [sourceId],
        }],
        relations: [],
        conflicts: [],
        unknowns: [],
      },
      agent,
    })
    expect(publish.isError).toBe(false)
    expect(resultText(publish)).toContain('"revision": 1')

    const snapshot = routes.get(FdeProject.FDE_PROJECT_SNAPSHOT_PATH)
    if (snapshot === undefined) throw new Error('project snapshot route was not registered')
    const visible = response()
    await snapshot(request({ workspaceId: 'workspace-1' }), visible.value)
    expect(visible.snapshot()).toMatchObject({
      status: 200,
      body: {
        ok: true,
        value: {
          requirementWiki: {
            status: 'ready',
            current: {
              revision: 1,
              generatedBy: 'session-wiki',
              pages: [{ id: 'delivery_goal', sourceIds: [sourceId] }],
            },
            build: { status: 'succeeded', publishedRevision: 1 },
          },
        },
      },
    })

    await ctx.fiber.dispose()
    context = undefined
    expect(routes.size).toBe(0)
  }, 30_000)
})
