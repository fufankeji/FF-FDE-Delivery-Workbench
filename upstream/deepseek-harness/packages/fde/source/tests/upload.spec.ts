import { mkdtemp, readFile, readdir, symlink } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createProjectResourceUploadHandler,
  PROJECT_RESOURCE_DIRECTORY,
  sanitizeProjectResourceName,
  storeProjectResourceBatch,
} from '../src/upload.ts'

const servers: ReturnType<typeof createServer>[] = []

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>((resolve) => { server.close(() => { resolve() }) })))
})

async function serve(workspaces: Readonly<Record<string, string>>, limits = {
  maxFileBytes: 1024,
  maxFiles: 4,
  maxBatchBytes: 2048,
}): Promise<string> {
  const handler = createProjectResourceUploadHandler({
    limits,
    trusted: () => true,
    workspacePath: id => workspaces[id],
  })
  const server = createServer((request, response) => { void handler(request, response) })
  servers.push(server)
  await new Promise<void>((resolve) => { server.listen(0, '127.0.0.1', resolve) })
  const address = server.address()
  if (typeof address !== 'object' || address === null) throw new Error('test server has no TCP address')
  return `http://127.0.0.1:${String(address.port)}`
}

function batch(workspaceId: string, files: readonly File[]): FormData {
  const form = new FormData()
  form.set('workspaceId', workspaceId)
  for (const file of files) form.append('files', file, file.name)
  return form
}

describe('project resource storage', () => {
  it('preserves readable Unicode names and removes path/control characters', () => {
    expect(sanitizeProjectResourceName('../../客户 需求?.pdf')).toBe('客户 需求_.pdf')
    expect(sanitizeProjectResourceName('..')).toBe('file')
    expect(sanitizeProjectResourceName('a\0b.txt')).toBe('a_b.txt')
  })

  it('publishes a complete batch in the project and never overwrites a collision', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'fde-source-'))
    const first = await storeProjectResourceBatch(workspace, [
      { name: '客户需求.txt', data: Buffer.from('v1') },
      { name: 'system.pdf', data: Buffer.from('%PDF-demo') },
    ])
    const second = await storeProjectResourceBatch(workspace, [
      { name: '客户需求.txt', data: Buffer.from('v2') },
    ])
    expect(first.map(file => file.relativePath)).toEqual([
      `${PROJECT_RESOURCE_DIRECTORY}/客户需求.txt`,
      `${PROJECT_RESOURCE_DIRECTORY}/system.pdf`,
    ])
    expect(second[0]?.relativePath).toBe(`${PROJECT_RESOURCE_DIRECTORY}/客户需求-1.txt`)
    expect(await readFile(join(workspace, first[0]!.relativePath), 'utf8')).toBe('v1')
    expect(await readFile(join(workspace, second[0]!.relativePath), 'utf8')).toBe('v2')
    expect((await readdir(join(workspace, PROJECT_RESOURCE_DIRECTORY))).some(name => name.startsWith('.upload-'))).toBe(false)
  })

  it('rejects a symlinked resource directory without writing outside the project', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'fde-source-'))
    const outside = await mkdtemp(join(tmpdir(), 'fde-source-outside-'))
    await symlink(outside, join(workspace, PROJECT_RESOURCE_DIRECTORY))
    await expect(storeProjectResourceBatch(workspace, [{ name: 'secret.txt', data: Buffer.from('x') }]))
      .rejects.toMatchObject({ code: 'resource-directory-invalid' })
    expect(await readdir(outside)).toEqual([])
  })
})

describe('project resource upload route', () => {
  it('stores a multi-file request under the addressed Workspace only', async () => {
    const alpha = await mkdtemp(join(tmpdir(), 'fde-source-alpha-'))
    const beta = await mkdtemp(join(tmpdir(), 'fde-source-beta-'))
    const url = await serve({ alpha, beta })
    const response = await fetch(url, {
      method: 'POST',
      body: batch('alpha', [
        new File(['one'], 'one.txt', { type: 'text/plain' }),
        new File(['two'], 'two.docx'),
      ]),
    })
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      value: { directory: PROJECT_RESOURCE_DIRECTORY, files: [{ storedName: 'one.txt' }, { storedName: 'two.docx' }] },
    })
    expect(await readdir(join(alpha, PROJECT_RESOURCE_DIRECTORY))).toEqual(['one.txt', 'two.docx'])
    await expect(readdir(join(beta, PROJECT_RESOURCE_DIRECTORY))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('rejects an invalid batch before publishing any member', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'fde-source-limit-'))
    const url = await serve({ project: workspace }, { maxFileBytes: 3, maxFiles: 4, maxBatchBytes: 8 })
    const response = await fetch(url, {
      method: 'POST',
      body: batch('project', [new File(['ok'], 'ok.txt'), new File(['large'], 'large.txt')]),
    })
    expect(response.status).toBe(413)
    await expect(response.json()).resolves.toMatchObject({ ok: false, error: { code: 'file-too-large' } })
    await expect(readdir(join(workspace, PROJECT_RESOURCE_DIRECTORY))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('does not fall back when the Workspace id is unknown', async () => {
    const url = await serve({})
    const response = await fetch(url, {
      method: 'POST',
      body: batch('missing', [new File(['x'], 'x.txt')]),
    })
    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toMatchObject({ ok: false, error: { code: 'workspace-not-found' } })
  })
})
