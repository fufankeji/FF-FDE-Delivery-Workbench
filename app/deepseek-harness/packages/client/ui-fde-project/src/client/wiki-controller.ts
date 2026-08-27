/** Browser projection and explicit mutations for one project requirement Wiki. */

/** Trusted project snapshot route owned by `@deepseek-ai/dsh-fde-project`. */
export const FDE_PROJECT_SNAPSHOT_PATH = '/api/fde-project/snapshot'
/** Explicit requirement-Wiki build start route. */
export const FDE_REQUIREMENT_WIKI_START_PATH = '/api/fde-project/requirement-wiki/start'
/** Explicit requirement-Wiki build abandonment route. */
export const FDE_REQUIREMENT_WIKI_ABANDON_PATH = '/api/fde-project/requirement-wiki/abandon'

/** Controlled knowledge topics emitted by the Host. */
export type RequirementWikiTopic =
  | 'business-goal' | 'role' | 'process' | 'system-data' | 'rule'
  | 'constraint' | 'acceptance' | 'risk' | 'conflict' | 'unknown'

/** One fixed input Source exposed to the user and Agent. */
export interface RequirementWikiSource {
  readonly sourceId: string
  readonly storedName: string
  readonly relativePath: string
  readonly derivedPath: string
  readonly bytes: number
  readonly mtimeMs: number
  readonly parser: string
  readonly parserVersion: string
}

/** One traceable candidate knowledge page. */
export interface RequirementWikiPage {
  readonly id: string
  readonly topic: RequirementWikiTopic
  readonly title: string
  readonly summary?: string
  readonly body: string
  readonly sourceIds: readonly string[]
}

/** One traceable relation in the current Wiki revision. */
export interface RequirementWikiRelation {
  readonly id: string
  readonly from: string
  readonly to: string
  readonly type: string
  readonly label?: string
  readonly directed: boolean
  readonly sourceIds: readonly string[]
}

/** One unresolved conflict or missing fact. */
export interface RequirementWikiIssue {
  readonly id: string
  readonly title: string
  readonly detail: string
  readonly impact?: string
  readonly pageIds: readonly string[]
  readonly sourceIds: readonly string[]
}

/** Complete candidate Wiki revision returned by the trusted Host. */
export interface RequirementWikiVersion {
  readonly schemaVersion: 1
  readonly revision: number
  readonly buildId: string
  readonly generatedAt: string
  readonly generatedBy: string
  readonly sourceCatalogFingerprint: string
  readonly sources: readonly RequirementWikiSource[]
  readonly pages: readonly RequirementWikiPage[]
  readonly relations: readonly RequirementWikiRelation[]
  readonly conflicts: readonly RequirementWikiIssue[]
  readonly unknowns: readonly RequirementWikiIssue[]
}

/** Latest explicit requirement-Wiki build state. */
export interface RequirementWikiBuild {
  readonly schemaVersion: 1
  readonly id: string
  readonly status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'
  readonly expectedRevision: number
  readonly sourceCatalogFingerprint: string
  readonly sources: readonly RequirementWikiSource[]
  readonly createdAt: string
  readonly updatedAt: string
  readonly message?: string
  readonly publishedRevision?: number
}

/** Current project requirement-Wiki read model. */
export interface RequirementWikiSnapshot {
  readonly status: 'absent' | 'ready' | 'stale'
  readonly current: RequirementWikiVersion | null
  readonly build: RequirementWikiBuild | null
  readonly message?: string
}

/** Per-project load state retaining the last good Wiki during refresh. */
export interface RequirementWikiLoadState {
  readonly status: 'idle' | 'loading' | 'ready' | 'error'
  readonly value: RequirementWikiSnapshot | null
  readonly message?: string
}

/** Immutable Workspace-keyed requirement-Wiki projection. */
export interface RequirementWikiControllerSnapshot {
  readonly byWorkspace: Readonly<Record<string, RequirementWikiLoadState>>
}

interface ProjectSnapshotSuccess {
  readonly ok: true
  readonly value: { readonly workspaceId: string; readonly requirementWiki: RequirementWikiSnapshot }
}
interface ProjectSnapshotFailure { readonly ok: false; readonly error?: { readonly message?: string } }

async function responseWiki(response: Response, workspaceId: string): Promise<RequirementWikiSnapshot> {
  let payload: ProjectSnapshotSuccess | ProjectSnapshotFailure
  try { payload = await response.json() as ProjectSnapshotSuccess | ProjectSnapshotFailure } catch {
    throw new Error('需求知识图谱服务返回无效响应。')
  }
  if (!payload.ok) throw new Error(payload.error?.message ?? `HTTP ${String(response.status)}`)
  if (!response.ok) throw new Error(`HTTP ${String(response.status)}`)
  if (payload.value.workspaceId !== workspaceId) throw new Error('需求知识图谱响应与当前项目不一致。')
  return payload.value.requirementWiki
}

async function postWiki(
  path: string,
  workspaceId: string,
  input: Readonly<Record<string, unknown>>,
  fetchImpl: typeof fetch,
  signal?: AbortSignal,
): Promise<RequirementWikiSnapshot> {
  const response = await fetchImpl(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ workspaceId, ...input }),
    ...(signal === undefined ? {} : { signal }),
  })
  return await responseWiki(response, workspaceId)
}

/** Apply-scoped Wiki controller; reading and refreshing never invokes a model. */
export class RequirementWikiController {
  private snapshot: RequirementWikiControllerSnapshot = { byWorkspace: {} }
  private readonly listeners = new Set<() => void>()
  private readonly requests = new Map<string, AbortController>()
  private readonly fetchImpl: typeof fetch
  private disposed = false

  constructor(fetchImpl: typeof fetch = fetch) {
    this.fetchImpl = fetchImpl.bind(globalThis)
  }

  /** Read the current immutable Wiki projection. */
  getSnapshot = (): RequirementWikiControllerSnapshot => this.snapshot
  /** Subscribe to Wiki projection replacement. */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  /**
   * Load or refresh one explicit project's Wiki without invoking an Agent.
   * @param workspaceId - Exact Workspace whose trusted snapshot is requested.
   * @param force - Whether to replace an already ready projection.
   */
  load(workspaceId: string, force = false): void {
    if (this.disposed) return
    const current = this.snapshot.byWorkspace[workspaceId]
    if (!force && (current?.status === 'loading' || current?.status === 'ready')) return
    this.startRequest(workspaceId, FDE_PROJECT_SNAPSHOT_PATH, {})
  }

  /**
   * Create one fixed-input Wiki build after the user has confirmed the model boundary.
   * @param workspaceId - Exact Workspace that owns the build.
   * @param sourceIds - User-confirmed SourceIds from that Workspace.
   * @param expectedRevision - Current Wiki revision, or zero when absent.
   * @returns The project Wiki snapshot after the Host commits the build.
   */
  async startBuild(workspaceId: string, sourceIds: readonly string[], expectedRevision: number): Promise<RequirementWikiSnapshot> {
    return await this.mutate(workspaceId, FDE_REQUIREMENT_WIKI_START_PATH, { sourceIds, expectedRevision })
  }

  /**
   * End one active build without changing the current Wiki revision.
   * @param workspaceId - Exact Workspace that owns the build.
   * @param buildId - Active BuildId to cancel.
   * @returns The project Wiki snapshot after cancellation is durable.
   */
  async abandonBuild(workspaceId: string, buildId: string): Promise<RequirementWikiSnapshot> {
    return await this.mutate(workspaceId, FDE_REQUIREMENT_WIKI_ABANDON_PATH, { buildId })
  }

  /** Abort requests and release subscribers. */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    for (const request of this.requests.values()) request.abort()
    this.requests.clear()
    this.listeners.clear()
  }

  private startRequest(workspaceId: string, path: string, input: Readonly<Record<string, unknown>>): void {
    this.requests.get(workspaceId)?.abort()
    const controller = new AbortController()
    this.requests.set(workspaceId, controller)
    const current = this.snapshot.byWorkspace[workspaceId]
    this.publish(workspaceId, { status: 'loading', value: current?.value ?? null })
    void postWiki(path, workspaceId, input, this.fetchImpl, controller.signal).then(
      (value) => { if (this.canPublish(workspaceId, controller)) this.publish(workspaceId, { status: 'ready', value }) },
      (error: unknown) => {
        if (this.canPublish(workspaceId, controller) && !controller.signal.aborted) {
          this.publish(workspaceId, {
            status: 'error',
            value: current?.value ?? null,
            message: error instanceof Error ? error.message : String(error),
          })
        }
      },
    ).finally(() => { if (this.requests.get(workspaceId) === controller) this.requests.delete(workspaceId) })
  }

  private async mutate(
    workspaceId: string,
    path: string,
    input: Readonly<Record<string, unknown>>,
  ): Promise<RequirementWikiSnapshot> {
    if (this.disposed) throw new Error('需求知识图谱页面已关闭。')
    this.requests.get(workspaceId)?.abort()
    const controller = new AbortController()
    this.requests.set(workspaceId, controller)
    const current = this.snapshot.byWorkspace[workspaceId]
    this.publish(workspaceId, { status: 'loading', value: current?.value ?? null })
    try {
      const value = await postWiki(path, workspaceId, input, this.fetchImpl, controller.signal)
      if (this.canPublish(workspaceId, controller)) this.publish(workspaceId, { status: 'ready', value })
      return value
    } catch (error) {
      if (this.canPublish(workspaceId, controller) && !controller.signal.aborted) {
        this.publish(workspaceId, {
          status: 'error',
          value: current?.value ?? null,
          message: error instanceof Error ? error.message : String(error),
        })
      }
      throw error
    } finally {
      if (this.requests.get(workspaceId) === controller) this.requests.delete(workspaceId)
    }
  }

  private canPublish(workspaceId: string, controller: AbortController): boolean {
    return !this.disposed && this.requests.get(workspaceId) === controller
  }

  private publish(workspaceId: string, state: RequirementWikiLoadState): void {
    this.snapshot = { byWorkspace: { ...this.snapshot.byWorkspace, [workspaceId]: state } }
    for (const listener of this.listeners) listener()
  }
}
