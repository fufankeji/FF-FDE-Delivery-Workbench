import { afterEach, expect, it, vi } from 'vitest'
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import * as atomic from '@deepseek-ai/dsh-atomic-write'
import { ChallengeStore } from '../src/store.ts'
import { QUESTIONS } from '../src/questions.ts'
import { commandSchema } from '../src/schema.ts'
import type { AttemptId } from '../src/types.ts'

const directories: string[] = []
afterEach(async () => { vi.restoreAllMocks(); for (const path of directories.splice(0)) await rm(path, { recursive: true, force: true }) })
const id = () => randomUUID() as AttemptId
async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'fde-challenge-'))
  directories.push(directory)
  const path = join(directory, 'state.json')
  let now = 1_800_000_000_000
  const store = new ChallengeStore(path, () => now)
  return { directory, path, store, now: () => now, advance: (ms: number) => { now += ms } }
}

it('contains ten Chinese scenarios with two per direction and a reason for every option', () => {
  expect(QUESTIONS).toHaveLength(10)
  expect(new Set(QUESTIONS.map(question => question.id)).size).toBe(10)
  for (const domain of ['value', 'data', 'agents', 'reliability', 'delivery']) expect(QUESTIONS.filter(question => question.domain === domain)).toHaveLength(2)
  for (const question of QUESTIONS) {
    expect(question.options).toHaveLength(4)
    expect(question.explanations).toHaveLength(4)
    for (const text of [question.domainLabel, question.prompt, ...question.options, ...question.explanations, question.practice]) expect(text).toMatch(/[\u4e00-\u9fff]/)
    expect(question.correct).toBeGreaterThanOrEqual(0)
    expect(question.correct).toBeLessThan(4)
  }
  expect(new Set(QUESTIONS.map(question => question.correct)).size).toBe(4)
})

it('restores confirmed answers with the original deadline and withholds answer keys', async () => {
  const f = await fixture(), attemptId = id()
  expect(await f.store.access()).toMatchObject({ active: null, history: [] })
  const start = await f.store.access({ kind: 'start', attemptId })
  expect(start.active?.deadlineAt).toBe(f.now() + 300_000)
  expect(JSON.stringify(start.active)).not.toContain('correct')
  expect(JSON.stringify(start.active)).not.toContain('explanations')
  await f.store.access({ kind: 'answer', attemptId, revision: 0, questionId: QUESTIONS[0]!.id, choice: 1 })
  f.advance(30_000)
  const restored = await new ChallengeStore(f.path, f.now).access()
  expect(restored.active?.answers[0]).toBe(1)
  expect(restored.active?.deadlineAt).toBe(start.active?.deadlineAt)
  expect(restored.active?.revision).toBe(1)
})

it('settles a full submission once, with reproducible scores and stored question snapshots', async () => {
  const f = await fixture(), attemptId = id()
  await f.store.access({ kind: 'start', attemptId })
  for (const [revision, question] of QUESTIONS.entries()) await f.store.access({ kind: 'answer', attemptId, revision, questionId: question.id, choice: question.correct })
  f.advance(87_100)
  const done = await f.store.access({ kind: 'submit', attemptId, revision: 10 })
  expect(done.active).toBeNull()
  expect(done.history[0]).toMatchObject({ correct: 10, wrong: 0, unanswered: 0, elapsedSeconds: 88, reason: 'manual' })
  expect(done.history[0]?.domains.map(domain => domain.correct)).toEqual([2, 2, 2, 2, 2])
  const repeat = await f.store.access({ kind: 'submit', attemptId, revision: 10 })
  expect(repeat.history).toEqual(done.history)
  expect(repeat.revision).toBe(done.revision)
  expect((JSON.parse(await readFile(f.path, 'utf8')) as { history: { questions: unknown[] }[] }).history[0]?.questions).toEqual(QUESTIONS)
})

it('rejects answers at the deadline and separates incorrect from unanswered results', async () => {
  const f = await fixture(), attemptId = id()
  await f.store.access({ kind: 'start', attemptId })
  await f.store.access({ kind: 'answer', attemptId, revision: 0, questionId: QUESTIONS[0]!.id, choice: 0 })
  f.advance(299_999)
  await f.store.access({ kind: 'answer', attemptId, revision: 1, questionId: QUESTIONS[1]!.id, choice: QUESTIONS[1]!.correct })
  f.advance(1)
  const result = await f.store.access({ kind: 'answer', attemptId, revision: 2, questionId: QUESTIONS[2]!.id, choice: QUESTIONS[2]!.correct })
  expect(result.active).toBeNull()
  expect(result.history[0]).toMatchObject({ correct: 1, wrong: 1, unanswered: 8, elapsedSeconds: 300, reason: 'timeout' })
  f.advance(2_000_000)
  expect((await new ChallengeStore(f.path, f.now).access()).history).toEqual(result.history)
})

it('retains one active attempt and rejects stale revisions and stale attempt writes', async () => {
  const f = await fixture(), attemptId = id()
  await f.store.access({ kind: 'start', attemptId })
  expect((await f.store.access({ kind: 'start', attemptId: id() })).active?.id).toBe(attemptId)
  const other = new ChallengeStore(f.path, f.now)
  const writes = await Promise.allSettled([f.store, other].map(store => store.access({ kind: 'answer', attemptId, revision: 0, questionId: QUESTIONS[0]!.id, choice: 1 })))
  expect(writes.filter(write => write.status === 'fulfilled')).toHaveLength(1)
  expect(writes.filter(write => write.status === 'rejected')).toHaveLength(1)
  await expect(f.store.access({ kind: 'submit', attemptId, revision: 0 })).rejects.toMatchObject({ code: 'conflict' })
  await f.store.access({ kind: 'submit', attemptId, revision: 1 })
  const nextId = id()
  await f.store.access({ kind: 'start', attemptId: nextId })
  await expect(other.access({ kind: 'answer', attemptId, revision: 1, questionId: QUESTIONS[0]!.id, choice: 2 })).rejects.toMatchObject({ code: 'conflict' })
  expect((await f.store.access()).active?.id).toBe(nextId)
})

it('keeps the latest twenty completed attempts without rewriting another local domain', async () => {
  const f = await fixture()
  const unrelated = join(f.directory, 'training.sqlite')
  await writeFile(unrelated, 'existing training stays here')
  const ids: AttemptId[] = []
  for (let round = 0; round < 21; round++) {
    const attemptId = id(); ids.push(attemptId)
    await f.store.access({ kind: 'start', attemptId })
    await f.store.access({ kind: 'submit', attemptId, revision: 0 })
    f.advance(1000)
  }
  expect((await f.store.access()).history.map(row => row.id)).toEqual(ids.slice(1).reverse())
  expect(await readFile(unrelated, 'utf8')).toBe('existing training stays here')
})

it('preserves corrupt data and refuses to replace it with an empty attempt', async () => {
  const f = await fixture()
  await writeFile(f.path, '{broken')
  await expect(f.store.access({ kind: 'start', attemptId: id() })).rejects.toMatchObject({ code: 'corrupt' })
  expect(await readFile(f.path, 'utf8')).toBe('{broken')
  await writeFile(f.path, JSON.stringify({ schemaVersion: 2, active: null, history: [], revision: 0 }))
  await expect(f.store.access()).rejects.toMatchObject({ code: 'corrupt' })
})

it('does not publish a failed answer write and can safely read the previously saved state', async () => {
  const f = await fixture(), attemptId = id()
  await f.store.access({ kind: 'start', attemptId })
  const before = await readFile(f.path, 'utf8')
  vi.spyOn(atomic, 'writeFileAtomic').mockRejectedValueOnce(new Error('disk unavailable'))
  await expect(f.store.access({ kind: 'answer', attemptId, revision: 0, questionId: QUESTIONS[0]!.id, choice: 1 })).rejects.toMatchObject({ code: 'storage' })
  expect(await readFile(f.path, 'utf8')).toBe(before)
  expect((await f.store.access()).active?.answers[0]).toBeNull()
})

it('refuses malformed commands and a directory in place of the record', async () => {
  expect(commandSchema.safeParse({ kind: 'start', attemptId: '../other' }).success).toBe(false)
  expect(commandSchema.safeParse({ kind: 'start', attemptId: id(), score: 10 }).success).toBe(false)
  expect(commandSchema.safeParse({ kind: 'answer', attemptId: id(), revision: 0, questionId: 'value-01', choice: 4 }).success).toBe(false)
  const f = await fixture()
  await mkdir(f.path)
  await expect(f.store.access()).rejects.toMatchObject({ code: 'storage' })
})
