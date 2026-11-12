/** Strict decoding for private durable records and incoming challenge operations. */
import { z } from 'zod'
import type { AttemptId } from './types.ts'

const id = z.string().uuid().transform(value => value as AttemptId)
const time = z.number().int().nonnegative()
const text = z.string().min(1).max(4000)
const question = z.object({
  id: z.string().min(1).max(80), domain: z.enum(['value', 'data', 'agents', 'reliability', 'delivery']),
  domainLabel: text, prompt: text, options: z.array(text).length(4), correct: z.number().int().min(0).max(3),
  explanations: z.array(text).length(4), practice: text,
}).strict()
const attempt = z.object({
  id, version: z.string().min(1).max(80), startedAt: time, deadlineAt: time,
  questions: z.array(question).length(10), answers: z.array(z.number().int().min(0).max(3).nullable()).length(10),
  revision: time, endedAt: time.nullable(), reason: z.enum(['manual', 'timeout']).nullable(),
}).strict().refine(value => value.deadlineAt === value.startedAt + 300_000
  && new Set(value.questions.map(row => row.id)).size === 10
  && ['value', 'data', 'agents', 'reliability', 'delivery'].every(domain => value.questions.filter(row => row.domain === domain).length === 2)
  && (value.endedAt === null ? value.reason === null : value.reason !== null
    && value.endedAt >= value.startedAt && value.endedAt <= value.deadlineAt
    && (value.reason !== 'timeout' || value.endedAt === value.deadlineAt)))

/** Unknown versions and invalid records fail without overwriting the original file. */
export const stateSchema = z.object({
  schemaVersion: z.literal(1), revision: time, active: attempt.nullable(), history: z.array(attempt).max(20),
}).strict().refine(value => (value.active === null || value.active.endedAt === null)
  && value.history.every(row => row.endedAt !== null)
  && new Set([...(value.active ? [value.active.id] : []), ...value.history.map(row => row.id)]).size === value.history.length + (value.active ? 1 : 0))

/** Mutations accept no score, deadline, answer key, or arbitrary local path. */
export const commandSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('start'), attemptId: id }).strict(),
  z.object({ kind: z.literal('answer'), attemptId: id, revision: time, questionId: z.string().min(1).max(80), choice: z.number().int().min(0).max(3) }).strict(),
  z.object({ kind: z.literal('submit'), attemptId: id, revision: time }).strict(),
])
