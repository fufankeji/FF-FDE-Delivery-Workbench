/** JSON views shared by the challenge Host and its client; answers stay Host-only until settlement. */
import type { Branded } from '@deepseek-ai/dsh-brand'

/** Stable identity of one explicitly started challenge. */
export type AttemptId = Branded<'FdeChallengeAttemptId'>
/** The five fixed practice directions, not ability ratings. */
export type DomainId = 'value' | 'data' | 'agents' | 'reliability' | 'delivery'
/** Public scenario available while answering. */
export interface Question {
  readonly id: string
  readonly domain: DomainId
  readonly domainLabel: string
  readonly prompt: string
  readonly options: readonly string[]
}
/** Host-owned versioned teaching material. */
export interface QuestionDefinition extends Question {
  readonly correct: number
  readonly explanations: readonly string[]
  readonly practice: string
}
/** One durable attempt, including the question snapshot used for its result. */
export interface Attempt {
  readonly id: AttemptId
  readonly version: string
  readonly startedAt: number
  readonly deadlineAt: number
  readonly questions: readonly QuestionDefinition[]
  answers: (number | null)[]
  revision: number
  endedAt: number | null
  reason: 'manual' | 'timeout' | null
}
/** Public in-progress attempt; no answer key or explanations. */
export interface ActiveChallenge {
  readonly id: AttemptId
  readonly version: string
  readonly startedAt: number
  readonly deadlineAt: number
  readonly revision: number
  readonly answers: readonly (number | null)[]
  readonly questions: readonly Question[]
}
/** One scenario's review after the attempt has ended. */
export interface QuestionReview extends QuestionDefinition {
  readonly chosen: number | null
  readonly outcome: 'correct' | 'wrong' | 'unanswered'
}
/** Completed result calculated only from its own immutable question and answer snapshot. */
export interface ChallengeResult {
  readonly id: AttemptId
  readonly version: string
  readonly startedAt: number
  readonly endedAt: number
  readonly reason: 'manual' | 'timeout'
  readonly elapsedSeconds: number
  readonly correct: number
  readonly wrong: number
  readonly unanswered: number
  readonly domains: readonly { id: DomainId; label: string; correct: number; total: number }[]
  readonly review: readonly QuestionReview[]
}
/** Latest committed local state with a server clock sample. */
export interface ChallengeView {
  readonly revision: number
  readonly serverNow: number
  readonly active: ActiveChallenge | null
  readonly history: readonly ChallengeResult[]
}
/** Operations are scoped to an attempt and, for mutable answers, its revision. */
export type ChallengeCommand =
  | { readonly kind: 'start'; readonly attemptId: AttemptId }
  | { readonly kind: 'answer'; readonly attemptId: AttemptId; readonly revision: number; readonly questionId: string; readonly choice: number }
  | { readonly kind: 'submit'; readonly attemptId: AttemptId; readonly revision: number }
/** Stable errors for the localized client. */
export type ChallengeErrorCode = 'invalid' | 'forbidden' | 'conflict' | 'storage' | 'corrupt' | 'unavailable'
