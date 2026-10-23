/** Visible-view-owned polling for bounded Agent output; never sends commands. */
export type RuntimeOutputState = { status: 'loading' | 'missing' | 'error' } | {
  status: 'ready'; text: string; truncated: boolean; title: string; processStatus: 'running' | 'exited'
}

function parseOutput(value: unknown, workspaceId: string): RuntimeOutputState {
  if (typeof value !== 'object' || value === null) throw new Error('Invalid runtime output')
  const data = value as Record<string, unknown>
  if (data.workspaceId !== workspaceId) throw new Error('Output project mismatch')
  if (data.status === 'missing') return { status: 'missing' }
  if (data.status !== 'ready' || typeof data.text !== 'string' || typeof data.title !== 'string'
    || typeof data.truncated !== 'boolean' || (data.processStatus !== 'running' && data.processStatus !== 'exited')) {
    throw new Error('Invalid runtime output')
  }
  return { status: 'ready', text: data.text, title: data.title, truncated: data.truncated, processStatus: data.processStatus }
}

/** One observable per plugin, with independently retained polling per project. */
export class RuntimeOutputController {
  private snapshot: Readonly<Record<string, RuntimeOutputState>> = {}
  private readonly listeners = new Set<() => void>()
  private readonly watches = new Map<string, { refs: number; abort: AbortController; timer?: ReturnType<typeof setTimeout> }>()
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}
  getSnapshot = () => this.snapshot
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  private publish(id: string, state: RuntimeOutputState): void {
    this.snapshot = { ...this.snapshot, [id]: state }
    for (const listener of this.listeners) listener()
  }
  /** Retain polling while a view is visible; releasing the last view aborts its request. */
  watch = (id: string): (() => void) => {
    let watch = this.watches.get(id)
    if (watch === undefined) {
      watch = { refs: 0, abort: new AbortController() }
      this.watches.set(id, watch)
      this.publish(id, { status: 'loading' })
      const current = watch
      const read = async (): Promise<void> => {
        try {
          const response = await this.fetchImpl(`/api/fde-project/runtime/output?workspaceId=${encodeURIComponent(id)}`, { signal: current.abort.signal })
          if (!response.ok) throw new Error('Runtime output unavailable')
          const state = parseOutput(await response.json(), id)
          if (!current.abort.signal.aborted) this.publish(id, state)
        } catch {
          if (!current.abort.signal.aborted) this.publish(id, { status: 'error' })
        } finally {
          if (!current.abort.signal.aborted) current.timer = setTimeout(() => { void read() }, 1_500)
        }
      }
      void read()
    }
    watch.refs++
    const retained = watch
    let released = false
    return () => {
      if (released) return
      released = true
      if (--retained.refs !== 0) return
      retained.abort.abort()
      clearTimeout(retained.timer)
      this.watches.delete(id)
      const { [id]: _removed, ...remaining } = this.snapshot
      this.snapshot = remaining
    }
  }
  /** Cancel every outstanding request when the plugin leaves. */
  dispose(): void {
    for (const watch of this.watches.values()) { watch.abort.abort(); clearTimeout(watch.timer) }
    this.watches.clear(); this.listeners.clear()
  }
}
