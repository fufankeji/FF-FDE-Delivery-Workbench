/** The challenge resource owns its HTTP read lifecycle; React sees only committed views. */
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { AttemptId, ChallengeCommand, ChallengeErrorCode, ChallengeView } from '@deepseek-ai/dsh-fde-scenario-challenge/types'
import { parseView } from './response.ts'

/** Single resource address; the local Host owns the actual attempt identity. */
export const ADDRESS = 'dsh-resource://fde-challenge/local'
/** Only the operation's identity crosses to navigation; resource values stay registry-owned. */
export type CommandOutcome = { readonly ok: true; readonly attemptId: AttemptId | null; readonly revision: number } | { readonly ok: false; readonly code: ChallengeErrorCode }
const ENDPOINT = '/api/fde-scenario-challenge'
const errorCodes: readonly ChallengeErrorCode[] = ['invalid', 'forbidden', 'conflict', 'storage', 'corrupt', 'unavailable']

/** Narrowly recognize public error codes, without displaying server diagnostics.
 * @param value - Unknown response code or resource diagnostic.
 * @returns Known code or the local-service fallback.
 */
export function errorCode(value: unknown): ChallengeErrorCode {
  return errorCodes.find(code => code === value) ?? 'unavailable'
}

function failure(code: ChallengeErrorCode): RemoteResult<ChallengeView> {
  return { ok: false, error: Object.assign(new Error(code), {
    isDSHRemoteError: true as const, code: 'gateway/internal' as const, details: {},
  }) }
}

/** No private data cache: invalidation wakes the framework-owned resource stream. */
export class ChallengeClient {
  private readonly listeners = new Set<() => void>()
  private readonly lifetime = new AbortController()
  constructor(private readonly request: typeof fetch = fetch) {}

  /** Invalidate after focus, a confirmed mutation, or an explicit retry. */
  refresh = (): void => { for (const listener of this.listeners) listener() }

  /** Abort owned requests and release resource wakeups when the plugin is unloaded. */
  dispose(): void { this.lifetime.abort(); this.refresh(); this.listeners.clear() }

  private async call(command: ChallengeCommand | undefined, signal: AbortSignal): Promise<RemoteResult<ChallengeView>> {
    try {
      // Native fetch rejects a ChallengeClient instance as its Web API receiver.
      const request = this.request
      const response = await request(ENDPOINT, {
        ...(command ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(command) } : {}),
        signal: AbortSignal.any([signal, this.lifetime.signal, AbortSignal.timeout(10_000)]),
      })
      const body: unknown = await response.json()
      if (!response.ok) {
        const code = typeof body === 'object' && body !== null && 'error' in body ? errorCode(body.error) : 'unavailable'
        return failure(code)
      }
      return { ok: true, value: parseView(body) }
    } catch (error) {
      return failure(command ? 'storage' : 'unavailable')
    }
  }

  /** Send a user operation and invalidate the read path on either outcome.
   * @param command - Attempt-scoped operation.
   * @returns Confirmed attempt identity or a localized error code.
   */
  async mutate(command: ChallengeCommand): Promise<CommandOutcome> {
    const result = await this.call(command, this.lifetime.signal)
    this.refresh()
    return result.ok
      ? { ok: true, revision: result.value.revision, attemptId: command.kind === 'start' ? result.value.active?.id ?? result.value.history.find(row => row.id === command.attemptId)?.id ?? null : command.attemptId }
      : { ok: false, code: errorCode(result.error.message) }
  }

  /** Stream the initial read and explicit invalidations, with no polling or duplicate cache.
   * @param signal - Resource holder's cancellation.
   * @returns Frames consumed by the existing resource registry.
   */
  async *watch(signal: AbortSignal): AsyncIterable<RemoteResult<ChallengeView>> {
    let dirty = true
    let wake: (() => void) | undefined
    const notify = (): void => { dirty = true; wake?.() }
    this.listeners.add(notify)
    signal.addEventListener('abort', notify)
    try {
      while (!signal.aborted && !this.lifetime.signal.aborted) {
        dirty = false
        const result = await this.call(undefined, signal)
        if (signal.aborted || this.lifetime.signal.aborted) break
        if (dirty) continue
        yield result
        if (!dirty) await new Promise<void>(resolve => { wake = resolve; if (dirty || signal.aborted || this.lifetime.signal.aborted) resolve() })
        wake = undefined
      }
    } finally {
      this.listeners.delete(notify)
      signal.removeEventListener('abort', notify)
    }
  }
}
