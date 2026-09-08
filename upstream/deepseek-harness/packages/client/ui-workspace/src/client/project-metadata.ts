/** Host-backed project creation facts shared by the sidebar and Project Center. */

/** Shared fields persisted within the registered project. */
export interface ProjectMetadataValue {
  readonly companyName: string
  readonly schedule: { readonly status: 'pending-confirmation' } | {
    readonly status: 'estimated'
    readonly startDate: string
    readonly endDate: string
  }
}

/** A missing record is distinct from loading, failure, and saved dates. */
export type ProjectMetadataState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly value: ProjectMetadataValue | null }
  | { readonly status: 'error'; readonly message: string }

/** Shared read projection and exact-project operations. */
export interface ProjectMetadataService {
  getSnapshot(): { readonly byWorkspace: Readonly<Record<string, ProjectMetadataState>> }
  subscribe(listener: () => void): () => void
  load(workspaceId: string, path: string, force?: boolean): void
  save(workspaceId: string, value: ProjectMetadataValue): Promise<void>
}

function legacyMetadata(path: string): ProjectMetadataValue | undefined {
  if (typeof localStorage === 'undefined') return undefined
  try {
    const raw = localStorage.getItem('dsh.workspace.view.v6')
    const item = raw === null ? undefined : (JSON.parse(raw) as { projectMetadataByPath?: Record<string, ProjectMetadataValue> }).projectMetadataByPath?.[path]
    return item === undefined ? undefined : { companyName: item.companyName, schedule: item.schedule }
  } catch {
    // Unreadable legacy storage cannot supply a migration candidate.
    return undefined
  }
}

/** One apply-scoped request owner; never overwrites an existing project record. */
export class ProjectMetadataController implements ProjectMetadataService {
  private snapshot: ReturnType<ProjectMetadataService['getSnapshot']> = { byWorkspace: {} }
  private readonly listeners = new Set<() => void>()
  private readonly requests = new Map<string, AbortController>()
  private disposed = false
  constructor(private readonly fetchImpl: typeof fetch = (...args) => fetch(...args)) {}

  getSnapshot = (): ReturnType<ProjectMetadataService['getSnapshot']> => this.snapshot
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  load(workspaceId: string, path: string, force = false): void {
    if (this.disposed || (!force && this.snapshot.byWorkspace[workspaceId] !== undefined)) return
    void this.run(workspaceId, undefined, path).catch(() => {
      // The request failure is already published for the GUI retry action.
    })
  }

  async save(workspaceId: string, value: ProjectMetadataValue): Promise<void> {
    await this.run(workspaceId, value)
  }

  /** Stop requests and prevent late completions from publishing after plugin removal. */
  dispose(): void {
    this.disposed = true
    this.listeners.clear()
    for (const request of this.requests.values()) request.abort()
    this.requests.clear()
  }

  private async request(workspaceId: string, signal: AbortSignal, metadata?: ProjectMetadataValue): Promise<ProjectMetadataValue | null> {
    const response = await this.fetchImpl('/api/fde-project/metadata', {
      method: 'POST', headers: { 'content-type': 'application/json' }, signal,
      body: JSON.stringify({ workspaceId, ...(metadata === undefined ? {} : { metadata }) }),
    })
    const result = await response.json() as { ok: boolean; workspaceId?: string; value: ProjectMetadataValue | null; error?: { message?: string } }
    if (!response.ok || !result.ok) throw new Error(result.error?.message ?? '项目基础信息读取或保存失败。')
    if (result.workspaceId !== workspaceId) throw new Error('项目基础信息与当前项目不一致。')
    return result.value
  }

  private async run(workspaceId: string, metadata?: ProjectMetadataValue, path?: string): Promise<void> {
    if (this.disposed) throw new Error('项目页面已关闭。')
    this.requests.get(workspaceId)?.abort()
    const controller = new AbortController()
    this.requests.set(workspaceId, controller)
    this.publish(workspaceId, { status: 'loading' })
    const current = (): boolean => !this.disposed && this.requests.get(workspaceId) === controller
    try {
      let value = await this.request(workspaceId, controller.signal, metadata)
      if (value === null && path !== undefined && current()) {
        const legacy = legacyMetadata(path)
        if (legacy !== undefined) value = await this.request(workspaceId, controller.signal, legacy)
      }
      if (current()) this.publish(workspaceId, { status: 'ready', value })
    } catch (error) {
      if (current()) this.publish(workspaceId, { status: 'error', message: error instanceof Error ? error.message : String(error) })
      throw error
    } finally {
      if (this.requests.get(workspaceId) === controller) this.requests.delete(workspaceId)
    }
  }

  private publish(workspaceId: string, state: ProjectMetadataState): void {
    this.snapshot = { byWorkspace: { ...this.snapshot.byWorkspace, [workspaceId]: state } }
    for (const listener of this.listeners) listener()
  }
}
