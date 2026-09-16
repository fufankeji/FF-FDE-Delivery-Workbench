/** Real Loader, native Agent Loop, JSONL persistence and HTTP; the LLM alone is scripted. */
import { afterEach, expect, it, vi } from 'vitest'
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import LlmRuntime, { LlmAdapter, CallId, createUserMessage, type GenerateOptions, type StreamChunk } from '@deepseek-ai/dsh-llm'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime, { defineContentToolFixture } from '@deepseek-ai/dsh-tools'
import AgentRegistry from '@deepseek-ai/dsh-agent'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import JsonlPersistence from '@deepseek-ai/dsh-session-persistence-jsonl'
import WebServer from '@deepseek-ai/dsh-host-webserver'
import * as Lab from '../src/index.ts'

const contexts: Context[] = []
let directory = ''
afterEach(async () => {
  for (const ctx of contexts.reverse()) await ctx.fiber.dispose()
  contexts.length = 0
  vi.unstubAllEnvs()
  if (directory) await rm(directory, { recursive: true, force: true })
})

function textChunks(text: string): StreamChunk[] {
  return [
    { type: 'block-start', index: 0, blockType: 'text' },
    { type: 'text-delta', index: 0, text },
    { type: 'block-end', index: 0, block: { type: 'text', text } },
    { type: 'finish', reason: { kind: 'stop' } },
  ]
}
function toolChunks(name: string, args: object): StreamChunk[] {
  const id = CallId('call-' + Math.random().toString(36).slice(2))
  const argumentsJson = JSON.stringify(args)
  return [
    { type: 'block-start', index: 0, blockType: 'tool-call' },
    { type: 'tool-call-delta', index: 0, id, name, argumentsDelta: argumentsJson },
    { type: 'block-end', index: 0, block: { type: 'tool-call', id, name, arguments: argumentsJson } },
    { type: 'finish', reason: { kind: 'tool-calls' } },
  ]
}
class OfflineAdapter extends LlmAdapter {
  requests: GenerateOptions[] = []
  steps = 0
  assetId = ''
  forbiddenAssetId = ''
  override resolveModel(provider: string, model: string) {
    return Promise.resolve({ provider, id: model, name: model })
  }
  override async * stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    this.requests.push(options)
    if (options.system?.includes('独立的访谈证据核对员')) {
      yield* textChunks('{"candidates":[]}')
      return
    }
    if (!options.system?.includes('你正在扮演企业访谈')) { yield* textChunks('ordinary'); return }
    this.steps++
    if (this.steps === 1) yield* toolChunks('workspaceMutator', {})
    else if (this.steps === 2) yield* toolChunks('offerCaseAsset', { assetId: this.forbiddenAssetId })
    else if (this.steps === 3) yield* toolChunks('offerCaseAsset', { assetId: this.assetId })
    else yield* textChunks('这是已授权的业务原件，请以原件记录为准。')
  }
}
async function mount(adapter: OfflineAdapter) {
  const configPath = join(directory, 'cordis.yml')
  const modules = new Map<string, unknown>([
    ['llm', LlmRuntime], ['session', SessionStore], ['prompt', SystemPrompt],
    ['tools', ToolRuntime], ['agents', AgentRegistry], ['loop', AgentLoop],
    ['persistence', JsonlPersistence], ['web', WebServer], ['lab', Lab],
  ])
  await writeFile(configPath, [
    '- name: llm', '- name: session', '- name: prompt', "  config: { persona: 'WORKSPACE_ONLY_CONTEXT' }",
    '- name: tools', '- name: agents', '- name: loop', '  config: { agents: [] }',
    '- name: persistence', '  config:', '    root: ' + JSON.stringify(join(directory, 'sessions')),
    '- name: web', "  config: { host: '127.0.0.1', port: 0 }", '- name: lab', '',
  ].join('\n'))
  const ctx = new Context()
  contexts.push(ctx)
  ctx.baseUrl = pathToFileURL(directory).href + '/'
  await ctx.plugin(Loader)
  ctx.loader.builtins.include = Include
  ctx.loader.internal = { version: 'v2', async import(specifier: string) {
    if (!modules.has(specifier)) throw new Error('Unexpected import: ' + specifier)
    return modules.get(specifier)
  } } as unknown as NonNullable<typeof ctx.loader.internal>
  await ctx.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(configPath).href } })
  await ctx.loader.await()
  expect([...ctx.loader.entries()].filter(e => !e.disabled && !e.fiber)).toEqual([])
  ctx.llm.registerAdapter(['offline-lab'], adapter)
  const base = 'http://127.0.0.1:' + ctx.webServer.port
  const response = (path: string, body?: unknown) => fetch(base + '/api/fde-discovery-lab' + path, body === undefined ? {} : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  const api = async (path: string, body?: unknown) => {
    const res = await response(path, body)
    const value = await res.json()
    expect(res.ok, JSON.stringify(value)).toBe(true)
    return value
  }
  return { ctx, base, response, api }
}
it('isolates roles and globals, persists native evidence, restores idle roles and never advances a project', async () => {
  directory = await mkdtemp(join(tmpdir(), 'fde-lab-loader-'))
  vi.stubEnv('DSH_HOME', directory)
  vi.stubEnv('DEEPSEEK_PROVIDER', 'offline-lab')
  vi.stubEnv('DEEPSEEK_MODEL', 'scripted')
  const c = JSON.parse(await readFile(new URL('../.assets/cases/finance/case.json', import.meta.url), 'utf8'))
  const role = c.roles.find((r: { id: string }) => r.id === 'employee')
  const asset = c.assets.find((a: { id: string; releaseGate?: unknown }) => role.assetIds.includes(a.id) && !a.releaseGate)
  const other = c.assets.find((a: { id: string }) => !role.assetIds.includes(a.id))
  const adapter = new OfflineAdapter()
  adapter.assetId = asset.id
  adapter.forbiddenAssetId = other.id
  const first = await mount(adapter)
  let globalExecutions = 0
  first.ctx.tools.register(defineContentToolFixture({
    name: 'workspaceMutator', description: 'unrelated ordinary workspace tool',
    parameters: {},
    execute: () => { globalExecutions++; return [{ type: 'text', text: 'changed' }] },
  }))
  first.ctx.on('agent/pre-step', async (_payload, next) => {
    const value = await next()
    return { ...value, messages: [...(value.messages ?? []), createUserMessage({
      content: [{ type: 'text', text: 'WORKSPACE_ONLY_INSTRUCTION' }],
      source: { kind: 'plugin', plugin: 'unrelated' },
    })] }
  })
  const cases = await first.api('/cases')
  expect(cases).toHaveLength(5)
  expect(JSON.stringify(cases)).not.toContain('factIds')
  const run = await first.api('/cases/finance/start', {})
  const otherRun = await first.api('/cases/operations/start', {})
  expect(adapter.requests).toHaveLength(0)
  expect((await first.response('/runs/' + run.runId + '/assets/' + asset.id)).status).toBe(403)
  expect((await fetch(first.base + '/api/fde-discovery-lab/cases', { headers: { Origin: 'https://evil.example' } })).status).toBe(403)
  expect((await fetch(first.base + '/api/fde-discovery-lab/cases', { headers: { 'Sec-Fetch-Site': 'cross-site' } })).status).toBe(403)
  expect((await fetch(first.base + '/fde-discovery-lab/cases/finance/case.json')).status).toBe(404)
  await first.api('/runs/' + otherRun.runId + '/roles/' + otherRun.case.roles[0].id + '/select', {})
  await first.api('/runs/' + run.runId + '/roles/employee/messages', { requestId: 'first-interview', text: '请提供' + asset.title + '资料给我查看' })
  await expect.poll(async () => JSON.stringify(await first.api('/runs/' + run.runId + '/requests/first-interview')), { timeout: 1500 }).toBe(JSON.stringify({requestId:'first-interview',status:'completed',error:null}))
  await expect.poll(async () => (await first.api('/runs/' + run.runId)).sessions.find((s: { roleId: string }) => s.roleId === 'employee').evaluationStatus, { timeout: 8000 }).toBe('idle')
  const completed = await first.api('/runs/' + run.runId)
  expect(completed.assets.map((a: { id: string }) => a.id)).toEqual([asset.id])
  expect(completed.evidence.some((e: { kind: string }) => e.kind === 'interview')).toBe(true)
  expect(completed.progress.completed).toBe(0)
  expect(globalExecutions).toBe(0)
  expect((await first.response('/runs/' + run.runId + '/assets/' + other.id)).status).toBe(403)
  expect((await first.response('/runs/' + run.runId + '/assets/' + asset.id)).status).toBe(200)
  expect((await first.response('/runs/' + run.runId + '/reports', {})).status).toBe(409)
  for (const request of adapter.requests) {
    expect(request.system).not.toContain('WORKSPACE_ONLY_CONTEXT')
    expect(JSON.stringify(request.messages)).not.toContain('WORKSPACE_ONLY_INSTRUCTION')
    expect(request.tools?.map(tool => tool.name) ?? []).not.toContain('workspaceMutator')
  }
  const ordinary = await first.ctx.agents.create({ sessionId: SessionId('ordinary-project'), agentOptions: { provider: 'offline-lab', model: 'scripted' } })
  ordinary.agent.followup(createUserMessage({ content: [{ type: 'text', text: 'hello' }], source: { kind: 'user' } }))
  await ordinary.agent.whenIdle()
  expect(adapter.requests.at(-1)?.tools?.map(tool => tool.name)).toContain('workspaceMutator')
  expect(adapter.requests.at(-1)?.system).toContain('WORKSPACE_ONLY_CONTEXT')
  await first.ctx.fiber.dispose()
  contexts.pop()

  const restoredAdapter = new OfflineAdapter()
  const second = await mount(restoredAdapter)
  const restored = await second.api('/runs/' + run.runId)
  expect(restored.sessions.find((s: { roleId: string }) => s.roleId === 'employee').messages).toEqual(completed.sessions.find((s: { roleId: string }) => s.roleId === 'employee').messages)
  expect(restored.assets.map((a: { id: string }) => a.id)).toEqual([asset.id])
  expect((await second.api('/runs/' + otherRun.runId)).runId).toBe(otherRun.runId)
  expect(restoredAdapter.requests).toHaveLength(0)
  const restarted = await second.api('/runs/' + run.runId + '/restart', {})
  expect(restarted.runId).not.toBe(run.runId)
  expect((await second.api('/runs/' + otherRun.runId)).runId).toBe(otherRun.runId)
  expect((await second.api('/cases/finance/history'))).toHaveLength(2)
  expect(Lab.inject).not.toContain('workspaceRegistry')
  expect(Lab.inject).not.toContain('fdeStage')
}, 20000)
