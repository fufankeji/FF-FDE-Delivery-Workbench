/** One private file owns challenge state; reads and writes reconcile the same absolute deadline. */
import { mkdir, readFile, stat } from 'node:fs/promises'
import { dirname } from 'node:path'
import { writeFileAtomic, withFileLock } from '@deepseek-ai/dsh-atomic-write'
import { BANK_VERSION, DURATION_MS, HISTORY_LIMIT, QUESTIONS } from './questions.ts'
import { stateSchema } from './schema.ts'
import type { Attempt, ChallengeCommand, ChallengeErrorCode, ChallengeResult, ChallengeView } from './types.ts'

interface StoredState { schemaVersion: 1; revision: number; active: Attempt | null; history: Attempt[] }

/** Stable, non-sensitive error returned to the localized client. */
export class ChallengeError extends Error {
  constructor(readonly code: ChallengeErrorCode) { super(code) }
}

/** Score a settled snapshot without consulting the current question bank.
 * @param attempt - Previously completed attempt.
 * @returns Immutable review and per-direction counts.
 */
export function resultOf(attempt: Attempt): ChallengeResult {
  if (attempt.endedAt === null || attempt.reason === null) throw new Error('Cannot score an active challenge')
  const review = attempt.questions.map((question, index) => {
    const chosen = attempt.answers[index] ?? null
    return { ...question, chosen, outcome: chosen === null ? 'unanswered' as const : chosen === question.correct ? 'correct' as const : 'wrong' as const }
  })
  const domains = [...new Set(review.map(row => row.domain))].map(id => {
    const rows = review.filter(row => row.domain === id)
    return { id, label: rows[0]!.domainLabel, correct: rows.filter(row => row.outcome === 'correct').length, total: rows.length }
  })
  return {
    id: attempt.id, version: attempt.version, startedAt: attempt.startedAt, endedAt: attempt.endedAt, reason: attempt.reason,
    elapsedSeconds: Math.min(300, Math.ceil((attempt.endedAt - attempt.startedAt) / 1000)),
    correct: review.filter(row => row.outcome === 'correct').length,
    wrong: review.filter(row => row.outcome === 'wrong').length,
    unanswered: review.filter(row => row.outcome === 'unanswered').length, domains, review,
  }
}

function finish(state: StoredState, now: number, reason: 'manual' | 'timeout'): void {
  const active = state.active
  if (!active) return
  active.endedAt = Math.max(active.startedAt, Math.min(now, active.deadlineAt))
  active.reason = reason
  state.history = [active, ...state.history].slice(0, HISTORY_LIMIT)
  state.active = null
  state.revision++
}

function viewOf(state: StoredState, now: number): ChallengeView {
  const active = state.active
  return {
    revision: state.revision, serverNow: now,
    active: active ? {
      id: active.id, version: active.version, startedAt: active.startedAt, deadlineAt: active.deadlineAt,
      answers: active.answers, revision: active.revision,
      questions: active.questions.map(({ id, domain, domainLabel, prompt, options }) => ({ id, domain, domainLabel, prompt, options })),
    } : null,
    history: state.history.map(resultOf),
  }
}

/** Re-reads under a cross-process lock; failed commits publish no in-memory success. */
export class ChallengeStore {
  constructor(private readonly path: string, private readonly now: () => number = Date.now) {}

  private async load(): Promise<StoredState> {
    let body: string
    try {
      if ((await stat(this.path)).size > 2 * 1024 * 1024) throw new ChallengeError('corrupt')
      body = await readFile(this.path, 'utf8')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { schemaVersion: 1, revision: 0, active: null, history: [] }
      throw error
    }
    let parsed: unknown
    try { parsed = JSON.parse(body) } catch (error) { throw new ChallengeError('corrupt') }
    const result = stateSchema.safeParse(parsed)
    if (!result.success) throw new ChallengeError('corrupt')
    return result.data
  }

  /** Read current state or commit one validated operation. Deadline settlement always precedes answers.
   * @param command - Omitted reads and settles overdue attempts; present performs the named operation.
   * @returns Latest committed public state; never exposes active answer keys.
   */
  async access(command?: ChallengeCommand): Promise<ChallengeView> {
    try {
      await mkdir(dirname(this.path), { recursive: true, mode: 0o700 })
      return await withFileLock(this.path, async () => {
        const state = await this.load()
        const before = state.revision
        const now = this.now()
        if (state.active && now >= state.active.deadlineAt) finish(state, state.active.deadlineAt, 'timeout')
        let conflict = false
        if (command?.kind === 'start') {
          if (!state.active && !state.history.some(row => row.id === command.attemptId)) {
            state.active = {
              id: command.attemptId, version: BANK_VERSION, startedAt: now, deadlineAt: now + DURATION_MS,
              questions: structuredClone(QUESTIONS), answers: Array.from({ length: 10 }, () => null),
              revision: 0, endedAt: null, reason: null,
            }
            state.revision++
          }
        } else if (command) {
          const active = state.active
          const settled = state.history.some(row => row.id === command.attemptId)
          if (settled && command.kind === 'submit') {
            // Retrying a completed submission returns its existing history record.
          } else if (settled && !active) {
            // A deadline reached while saving returns the timeout result, never a late answer.
          } else if (!active || active.id !== command.attemptId || active.revision !== command.revision) {
            conflict = true
          } else if (command.kind === 'submit') {
            finish(state, now, 'manual')
          } else {
            const index = active.questions.findIndex(row => row.id === command.questionId)
            if (index < 0) throw new ChallengeError('invalid')
            active.answers[index] = command.choice
            active.revision++
            state.revision++
          }
        }
        if (state.revision !== before) await writeFileAtomic(this.path, JSON.stringify(state), { mode: 0o600, dirMode: 0o700 })
        if (conflict) throw new ChallengeError('conflict')
        return viewOf(state, now)
      })
    } catch (error) {
      if (error instanceof ChallengeError) throw error
      throw new ChallengeError('storage')
    }
  }
}
