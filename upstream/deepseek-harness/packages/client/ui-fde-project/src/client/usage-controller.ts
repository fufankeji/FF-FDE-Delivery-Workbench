/** Numeric project usage read model; never fetches conversation text. */
export const STAT_KEYS = ['turns', 'steps', 'llmMs', 'toolMs', 'ttftMs', 'ttftSteps', 'decodeMs', 'decodeTokens'] as const
export const TOKEN_KEYS = ['uncachedInputTokens', 'cacheReadTokens', 'cacheWriteTokens', 'outputTokens'] as const
export type UsageNumbers = Record<typeof STAT_KEYS[number] | typeof TOKEN_KEYS[number], number>
export type UsagePoint = UsageNumbers & { start: number }
export type UsageRow = { sessionId: string; status: 'unavailable' } | {
  sessionId: string; status: 'ready'; stats: Pick<UsageNumbers, typeof STAT_KEYS[number]>
  usage: Pick<UsageNumbers, typeof TOKEN_KEYS[number]>; activity: { buckets: UsagePoint[] }
}
export interface ProjectUsage { workspaceId: string; sessions: UsageRow[] }
export type UsageState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; value: ProjectUsage }

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('用量数据格式不完整。')
  return value as Record<string, unknown>
}
function numbers(value: unknown, keys: readonly string[]): void {
  const row = record(value)
  for (const key of keys) if (typeof row[key] !== 'number' || !Number.isFinite(row[key]) || row[key] < 0) throw new Error('用量数据格式不完整。')
}
function parseUsage(value: unknown, workspaceId: string): ProjectUsage {
  const data = record(value)
  if (data.workspaceId !== workspaceId || !Array.isArray(data.sessions)) throw new Error('项目用量读取结果不匹配。')
  const ids = new Set<string>()
  for (const item of data.sessions) {
    const row = record(item)
    if (typeof row.sessionId !== 'string' || ids.has(row.sessionId)) throw new Error('会话用量记录无效。')
    ids.add(row.sessionId)
    if (row.status === 'unavailable') continue
    if (row.status !== 'ready') throw new Error('会话用量状态无效。')
    numbers(row.stats, STAT_KEYS); numbers(row.usage, TOKEN_KEYS)
    const activity = record(row.activity)
    if (!Array.isArray(activity.buckets)) throw new Error('调用时间记录未加载。')
    for (const point of activity.buckets) numbers(point, [...STAT_KEYS, ...TOKEN_KEYS, 'start'])
  }
  return data as unknown as ProjectUsage
}

/** Apply-owned observable; replacement reads cancel stale requests and never convert failure to zero. */
export class ProjectUsageController {
  private snapshot: { byWorkspace: Record<string, UsageState> } = { byWorkspace: {} }
  private readonly listeners = new Set<() => void>()
  private request?: AbortController
  private disposed = false
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}
  getSnapshot = () => this.snapshot
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  private set(workspaceId: string, value: UsageState): void {
    this.snapshot = { byWorkspace: { ...this.snapshot.byWorkspace, [workspaceId]: value } }
    for (const listener of this.listeners) listener()
  }
  load(workspaceId: string): void {
    if (this.disposed) return
    this.request?.abort()
    const request = new AbortController()
    this.request = request
    this.set(workspaceId, { status: 'loading' })
    void this.fetchImpl(`/api/fde-project/usage?workspaceId=${encodeURIComponent(workspaceId)}`, { signal: request.signal })
      .then(async response => {
        if (!response.ok) throw new Error('项目用量读取失败，请重试。')
        const value = parseUsage(await response.json(), workspaceId)
        if (!request.signal.aborted && !this.disposed) this.set(workspaceId, { status: 'ready', value })
      }).catch(() => {
        if (!request.signal.aborted && !this.disposed) this.set(workspaceId, { status: 'error', message: '项目用量尚未读取成功，不能将其视为零用量。' })
      })
  }
  dispose(): void { this.disposed = true; this.request?.abort(); this.listeners.clear() }
}
