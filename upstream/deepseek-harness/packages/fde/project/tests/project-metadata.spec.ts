import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer, type Server } from 'node:http'
import { afterEach, describe, expect, it } from 'vitest'
import { isTrustedApiRequest } from '@deepseek-ai/dsh-client-connection'
import { ensureProjectMetadata, parseProjectMetadata, readProjectMetadata } from '../src/project-metadata.ts'
import { createProjectMetadataRoute } from '../src/http.ts'

const roots: string[] = []
const servers: Server[] = []
const facts = { companyName: '业务方', schedule: { status: 'estimated', startDate: '2026-09-01', endDate: '2026-10-01' } }
async function project(): Promise<string> { const root = await mkdtemp(join(tmpdir(), 'fde-project-metadata-')); roots.push(root); return root }
afterEach(async () => {
  for (const server of servers.splice(0)) await new Promise<void>((resolve, reject) => { server.close(error => error ? reject(error) : resolve()) })
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true })
})

describe('project-owned delivery dates', () => {
  it('persists once, isolates projects, and preserves the first record on concurrent legacy imports', async () => {
    const root = await project()
    expect(await readProjectMetadata(root)).toBeNull()
    const values = await Promise.all([ensureProjectMetadata(root, facts), ensureProjectMetadata(root, { ...facts, companyName: '旧浏览器' })])
    expect(values[0]).toEqual(values[1])
    expect(await readProjectMetadata(root)).toEqual(values[0])
    expect(JSON.parse(await readFile(join(root, '.fde/project-metadata.json'), 'utf8'))).toEqual(values[0])
    expect(await readProjectMetadata(await project())).toBeNull()
    expect(await ensureProjectMetadata(root, { companyName: '其他浏览器', schedule: { status: 'pending-confirmation' } })).toEqual(values[0])
  })

  it.each([
    ['2026-02-30', '2026-10-01'], ['2026-10-01', '2026-09-01'], ['', '2026-10-01'], ['2026-13-01', '2026-14-01'],
  ])('rejects invalid or reversed dates %s — %s', async (startDate, endDate) => {
    const root = await project()
    await expect(ensureProjectMetadata(root, { ...facts, schedule: { status: 'estimated', startDate, endDate } })).rejects.toThrow('有效日期')
    expect(await readProjectMetadata(root)).toBeNull()
  })

  it('keeps unknown dates pending and rejects corrupt files or symlinked records', async () => {
    expect(parseProjectMetadata({ companyName: '', schedule: { status: 'pending-confirmation' } })).toEqual({ companyName: '', schedule: { status: 'pending-confirmation' } })
    const root = await project()
    await mkdir(join(root, '.fde'))
    await writeFile(join(root, '.fde/project-metadata.json'), '{invalid')
    await expect(ensureProjectMetadata(root, facts)).rejects.toThrow()
    expect(await readFile(join(root, '.fde/project-metadata.json'), 'utf8')).toBe('{invalid')
    const other = await project()
    await symlink(join(root, '.fde'), join(other, '.fde'))
    await expect(ensureProjectMetadata(other, facts)).rejects.toThrow('真实目录')
    await rm(join(root, '.fde/project-metadata.json'))
    await writeFile(join(root, 'outside.json'), JSON.stringify(facts))
    await symlink(join(root, 'outside.json'), join(root, '.fde/project-metadata.json'))
    await expect(readProjectMetadata(root)).rejects.toThrow('文件无效')
  })

  it('serves the same durable dates to independent clients and rejects untrusted or unknown targets', async () => {
    const root = await project()
    const route = createProjectMetadataRoute({
      trusted: request => isTrustedApiRequest(request, []),
      read: id => id === 'one' ? readProjectMetadata(root) : Promise.resolve(undefined),
      ensure: (id, value) => id === 'one' ? ensureProjectMetadata(root, value) : Promise.resolve(undefined),
    })
    const server = createServer((request, response) => { void route(request, response) })
    servers.push(server)
    await new Promise<void>(resolve => { server.listen(0, '127.0.0.1', resolve) })
    const address = server.address()
    if (address === null || typeof address === 'string') throw new Error('No HTTP address')
    const url = `http://127.0.0.1:${address.port}`
    const send = (body: unknown, origin = url) => fetch(url, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body) })
    expect(await (await send({ workspaceId: 'one' })).json()).toEqual({ ok: true, workspaceId: 'one', value: null })
    expect((await send({ workspaceId: 'one', metadata: facts })).status).toBe(200)
    expect(await (await send({ workspaceId: 'one' })).json()).toEqual({ ok: true, workspaceId: 'one', value: facts })
    expect((await send({ workspaceId: 'missing', metadata: facts })).status).toBe(404)
    expect((await send({ workspaceId: 'one', path: '/arbitrary' })).status).toBe(400)
    expect((await send({ workspaceId: 'one', metadata: facts }, 'https://untrusted.test')).status).toBe(403)
    expect((await fetch(url, { headers: { origin: url } })).status).toBe(405)
    expect(await readProjectMetadata(root)).toEqual(facts)
  })
})
