/** Real Loader, Connection authentication, HTTP and files; only credential storage is ephemeral. */
import { afterEach, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import WebServer from '@deepseek-ai/dsh-host-webserver'
import * as Connection from '@deepseek-ai/dsh-client-connection'
import { CredentialProvider, type CredentialKey, type CredentialRecord } from '@deepseek-ai/dsh-credentials'
import { mkdtemp, rm, writeFile, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { randomUUID } from 'node:crypto'
import * as Challenge from '../src/index.ts'
import type { ChallengeView } from '../src/types.ts'

class MemoryCredentials extends CredentialProvider {
  private readonly records = new Map<CredentialKey, CredentialRecord>()
  async resolve() { return undefined }
  async describe(): Promise<never> { throw new Error('No provider credentials in challenge tests') }
  async set(): Promise<never> { throw new Error('No provider credentials in challenge tests') }
  async unset(): Promise<never> { throw new Error('No provider credentials in challenge tests') }
  async describeRecord(): Promise<never> { throw new Error('No credential inspection in challenge tests') }
  async listRecords() { return [] }
  async readRecord(key: CredentialKey) { return this.records.get(key) }
  async modifyRecord(key: CredentialKey, mutate: (current: CredentialRecord | undefined) => Promise<CredentialRecord | undefined>) {
    const next = await mutate(this.records.get(key))
    if (next !== undefined) this.records.set(key, next)
    return this.records.get(key)
  }
  async deleteRecord(key: CredentialKey) { this.records.delete(key) }
}

let directory = ''
let ctx: Context | undefined
afterEach(async () => { await ctx?.fiber.dispose(); ctx = undefined; vi.unstubAllEnvs(); if (directory) await rm(directory, { recursive: true, force: true }); directory = '' })

it('boots without model or case assets, enforces owner and origin, persists results, and removes its route on disposal', async () => {
  directory = await mkdtemp(join(tmpdir(), 'fde-challenge-loader-'))
  vi.stubEnv('DSH_HOME', directory)
  const config = join(directory, 'cordis.yml')
  await writeFile(config, '- name: cordis:test-web\n  config: { host: 127.0.0.1, port: 0 }\n- name: cordis:test-credentials\n- name: cordis:test-connection\n- name: cordis:test-challenge\n')
  ctx = new Context()
  ctx.baseUrl = pathToFileURL(directory).href + '/'
  await ctx.plugin(Loader)
  Object.assign(ctx.loader.builtins, { include: Include, 'test-web': WebServer, 'test-credentials': MemoryCredentials, 'test-connection': Connection, 'test-challenge': Challenge })
  await ctx.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(config).href } })
  await ctx.loader.await()
  const owner = ctx
  owner.effect(() => owner.webServer.register({ kind: 'exact', path: '/', handler: (req, res) => { if (owner.connection.authorizeIndex(req, res)) res.end('local fixture') } }))
  const base = `http://127.0.0.1:${owner.webServer.port}`
  const endpoint = `${base}/api/fde-scenario-challenge`
  expect((await fetch(endpoint)).status).toBe(403)
  const login = await fetch(owner.connection.authenticatedUrl(base), { redirect: 'manual' })
  const cookie = login.headers.get('set-cookie')?.split(';')[0]
  expect(cookie).toBeTruthy()
  const headers = { Cookie: cookie!, 'Content-Type': 'application/json' }
  expect((await fetch(endpoint, { headers: { ...headers, Origin: 'https://untrusted.example' } })).status).toBe(403)
  expect((await fetch(endpoint, { headers })).status).toBe(200)
  const attemptId = randomUUID()
  const post = (body: object) => fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body) })
  const start = await post({ kind: 'start', attemptId })
  expect(start.status).toBe(200)
  const initial = await start.json() as ChallengeView
  expect(initial.active?.questions).toHaveLength(10)
  expect(JSON.stringify(initial.active)).not.toContain('explanations')
  expect((await post({ kind: 'answer', attemptId, revision: 0, questionId: 'value-01', choice: 1 })).status).toBe(200)
  expect((await post({ kind: 'answer', attemptId, revision: 0, questionId: 'value-01', choice: 2 })).status).toBe(409)
  expect((await post({ kind: 'submit', attemptId, revision: 1, score: 10 })).status).toBe(400)
  const submitted = await post({ kind: 'submit', attemptId, revision: 1 })
  expect((await submitted.json() as ChallengeView).history[0]).toMatchObject({ correct: 1, unanswered: 9 })
  expect((await readdir(directory)).sort()).toEqual(['cordis.yml', 'fde-scenario-challenge'])
  const entry = [...owner.loader.entries()].find(row => row.options.name === 'cordis:test-challenge')
  expect(entry?.fiber).toBeDefined()
  await entry!.fiber!.dispose()
  expect((await fetch(endpoint, { headers })).status).toBe(404)
})
