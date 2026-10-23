/** Exercise the pinned third-party artifact with this workspace's runtime identities. */
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import { Session, SessionId } from '@deepseek-ai/dsh-session'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { expect, it } from 'vitest'

it('mounts the pinned review plugin and preserves status, undo, redo and workspace containment', async () => {
  const require = createRequire(new URL('../package.json', import.meta.url))
  // Dynamic import intentionally tests the distributed artifact, not reconstructed source.
  const Review = await import(pathToFileURL(require.resolve('dsh-file-review-tab')).href)
  const root = await mkdtemp(join(tmpdir(), 'fde-review-'))
  const ctx = new Context()
  try {
    await ctx.plugin(Loader)
    await ctx.plugin(SystemPrompt)
    ctx.loader.builtins.review = Review
    await ctx.loader.create({ name: 'cordis:review' })
    await ctx.loader.await()
    const service = ctx.get('fileReview') as InstanceType<typeof Review.FileReviewService>
    expect(service).toBeDefined()
    const id = SessionId('review-session')
    const agent = { id, session: Session.create(id, [], { id, version: 4, createdAt: 1, isSeeded: false, cwd: root }), runMaintenance: (task: () => Promise<unknown>) => task() }
    const file = { path: 'result.txt', diffs: [{ path: 'result.txt', oldText: 'before\n', newText: 'after\n', oldStart: 1, newStart: 1 }] }
    await writeFile(join(root, file.path), 'after\n')
    expect((await service.status(agent, { action: 'undo', files: [file] })).files[0].state).toBe('applied')
    expect((await service.apply(agent, { action: 'undo', files: [file] })).files[0].state).toBe('undone')
    expect(await readFile(join(root, file.path), 'utf8')).toBe('before\n')
    expect((await service.apply(agent, { action: 'redo', files: [file] })).files[0].state).toBe('applied')
    expect(await readFile(join(root, file.path), 'utf8')).toBe('after\n')
    const outside = { path: '../outside.txt', diffs: file.diffs.map(diff => ({ ...diff, path: '../outside.txt' })) }
    expect((await service.apply(agent, { action: 'undo', files: [outside] })).files[0]).toMatchObject({ state: 'error', changed: false, reason: 'path is outside the session workspace' })
  } finally { await ctx.fiber.dispose(); await rm(root, { recursive: true, force: true }) }
})
