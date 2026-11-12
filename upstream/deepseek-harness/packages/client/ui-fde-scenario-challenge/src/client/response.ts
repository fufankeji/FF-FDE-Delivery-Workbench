/** Decode HTTP responses before exposing records to the resource registry. */
import { z } from 'zod'
import type { AttemptId, ChallengeView } from '@deepseek-ai/dsh-fde-scenario-challenge/types'

const time = z.number().int().nonnegative()
const id = z.string().uuid().transform(value => value as AttemptId)
const domain = z.enum(['value', 'data', 'agents', 'reliability', 'delivery'])
const question = z.object({ id: z.string(), domain, domainLabel: z.string(), prompt: z.string(), options: z.array(z.string()).length(4) })
const chosen = z.number().int().min(0).max(3).nullable()
const view = z.object({
  revision: time, serverNow: time,
  active: z.object({ id, version: z.string(), startedAt: time, deadlineAt: time, revision: time,
    answers: z.array(chosen).length(10), questions: z.array(question).length(10) }).nullable(),
  history: z.array(z.object({ id, version: z.string(), startedAt: time, endedAt: time,
    reason: z.enum(['manual', 'timeout']), elapsedSeconds: time.max(300), correct: time.max(10), wrong: time.max(10), unanswered: time.max(10),
    domains: z.array(z.object({ id: domain, label: z.string(), correct: time.max(2), total: z.literal(2) })).length(5),
    review: z.array(question.extend({ correct: z.number().int().min(0).max(3), chosen,
      outcome: z.enum(['correct', 'wrong', 'unanswered']), explanations: z.array(z.string()).length(4), practice: z.string() })).length(10),
  })).max(20),
})

/** Decode the complete response, rejecting a partial or incompatible state.
 * @param input - Untrusted HTTP JSON.
 * @returns Validated public challenge state.
 */
export function parseView(input: unknown): ChallengeView { return view.parse(input) }
