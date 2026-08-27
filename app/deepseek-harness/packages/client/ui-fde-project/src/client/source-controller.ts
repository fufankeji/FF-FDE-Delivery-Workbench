/** Browser projection for project Source records and local parsing. */

export const PROJECT_SOURCE_LIST_PATH = '/api/fde-project-resources/list'
/** Same-origin route that starts model-free local recognition. */
export const PROJECT_SOURCE_PARSE_PATH = '/api/fde-project-resources/parse'
/** Browser-local notification that one project's visible originals changed. */
export const PROJECT_SOURCES_CHANGED_EVENT = 'fde:project-sources-changed'

/** Rendering family selected for one project original. */
export type ProjectSourcePreviewKind = 'office' | 'pdf' | 'image' | 'text' | 'unsupported'
/** Independent local-recognition status for one original. */
export type ProjectSourceParseStatus = 'pending' | 'processing' | 'ready' | 'needs-ocr' | 'unsupported' | 'error' | 'stale'

/** Browser-safe Source record returned by the Host list/parse routes. */
export interface ProjectSourceItem {
  readonly sourceId: string
  readonly workspaceId: string
  readonly originalName: string
  readonly storedName: string
  readonly relativePath: string
  readonly mimeType: string
  readonly extension: string
  readonly bytes: number
  readonly createdAt: string
  readonly modifiedAt: string
  readonly previewKind: ProjectSourcePreviewKind
  readonly fileUrl: string
  readonly parse: {
    readonly status: ProjectSourceParseStatus
    readonly message?: string
    readonly derivedPath?: string
    readonly updatedAt?: string
  }
}

/** Per-project source-list loading state that retains the last visible files. */
export type ProjectSourceLoadState =
  | { readonly status: 'idle'; readonly files: readonly ProjectSourceItem[] }
  | { readonly status: 'loading'; readonly files: readonly ProjectSourceItem[] }
  | { readonly status: 'ready'; readonly files: readonly ProjectSourceItem[] }
  | { readonly status: 'error'; readonly files: readonly ProjectSourceItem[]; readonly message: string }

/** Immutable project-indexed source projection. */
export interface ProjectSourceSnapshot {
  readonly byWorkspace: Readonly<Record<string, ProjectSourceLoadState>>
}

interface SourceListSuccess { readonly ok: true; readonly value: { readonly files: readonly ProjectSourceItem[] } }
interface SourceParseSuccess { readonly ok: true; readonly value: { readonly file: ProjectSourceItem } }
interface SourceFailure { readonly ok: false; readonly error?: { readonly message?: string } }

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function markProcessing(source: ProjectSourceItem): ProjectSourceItem {
  const { message: _message, ...parse } = source.parse
  return { ...source, parse: { ...parse, status: 'processing' } }
}

async function responseJson<T>(response: Response): Promise<T> {
  let payload: T | SourceFailure
  try { payload = await response.json() as T | SourceFailure } catch (error) { throw new Error(`项目资料服务返回无效响应：${String(error)}`) }
  if (!response.ok || (payload as SourceFailure).ok === false) {
    throw new Error((payload as SourceFailure).error?.message ?? `HTTP ${String(response.status)}`)
  }
  return payload as T
}

/** Apply-scoped observable controller; it has no Session, Composer, or Agent dependency. */
export class ProjectSourceController {
  private snapshot: ProjectSourceSnapshot = { byWorkspace: {} }
  private readonly listeners = new Set<() => void>()
  private readonly loading = new Map<string, AbortController>()
  private readonly parseLoading = new Map<string, AbortController>()
  private readonly fetchImpl: typeof fetch
  private readonly onChanged = (event: Event): void => {
    const detail = (event as CustomEvent<{ workspaceId?: unknown }>).detail
    if (typeof detail?.workspaceId === 'string') this.load(detail.workspaceId, true)
  }

  constructor(fetchImpl: typeof fetch = fetch) {
    this.fetchImpl = fetchImpl.bind(globalThis)
    if (typeof window !== 'undefined') window.addEventListener(PROJECT_SOURCES_CHANGED_EVENT, this.onChanged)
  }

  /** Read the current immutable Source projection. */
  getSnapshot = (): ProjectSourceSnapshot => this.snapshot
  /** Subscribe to Source projection replacement. */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  /**
   * Load or refresh one explicit Workspace's Source list.
   * @param workspaceId - exact project identity.
   * @param force - bypass the current ready/loading cache when true.
   */
  load(workspaceId: string, force = false): void {
    const current = this.snapshot.byWorkspace[workspaceId]
    if (!force && (current?.status === 'loading' || current?.status === 'ready')) return
    this.loading.get(workspaceId)?.abort()
    const controller = new AbortController()
    this.loading.set(workspaceId, controller)
    this.update(workspaceId, { status: 'loading', files: current?.files ?? [] })
    void this.fetchImpl(PROJECT_SOURCE_LIST_PATH, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ workspaceId }),
      signal: controller.signal,
    }).then(response => responseJson<SourceListSuccess>(response)).then((payload) => {
      if (this.loading.get(workspaceId) !== controller) return
      this.loading.delete(workspaceId)
      this.update(workspaceId, { status: 'ready', files: payload.value.files })
    }).catch((error: unknown) => {
      if (controller.signal.aborted || this.loading.get(workspaceId) !== controller) return
      this.loading.delete(workspaceId)
      this.update(workspaceId, { status: 'error', files: current?.files ?? [], message: errorMessage(error) })
    })
  }

  /**
   * Start local recognition for one explicit Workspace/Source pair.
   * @param workspaceId - exact project identity.
   * @param sourceId - stable Source identity within the project.
   */
  async parse(workspaceId: string, sourceId: string): Promise<void> {
    const key = `${workspaceId}:${sourceId}`
    this.parseLoading.get(key)?.abort()
    const controller = new AbortController()
    this.parseLoading.set(key, controller)
    this.patchSource(workspaceId, sourceId, markProcessing)
    try {
      const response = await this.fetchImpl(PROJECT_SOURCE_PARSE_PATH, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ workspaceId, sourceId }),
        signal: controller.signal,
      })
      const payload = await responseJson<SourceParseSuccess>(response)
      if (this.parseLoading.get(key) !== controller) return
      this.patchSource(workspaceId, sourceId, () => payload.value.file)
    } catch (error) {
      if (controller.signal.aborted || this.parseLoading.get(key) !== controller) return
      this.patchSource(workspaceId, sourceId, source => ({
        ...source,
        parse: { ...source.parse, status: 'error', message: errorMessage(error) },
      }))
      throw error
    } finally {
      if (this.parseLoading.get(key) === controller) this.parseLoading.delete(key)
    }
  }

  /** Abort in-flight requests and release browser listeners/subscribers. */
  dispose(): void {
    if (typeof window !== 'undefined') window.removeEventListener(PROJECT_SOURCES_CHANGED_EVENT, this.onChanged)
    for (const controller of this.loading.values()) controller.abort()
    for (const controller of this.parseLoading.values()) controller.abort()
    this.loading.clear(); this.parseLoading.clear(); this.listeners.clear()
  }

  private patchSource(workspaceId: string, sourceId: string, patch: (source: ProjectSourceItem) => ProjectSourceItem): void {
    const current = this.snapshot.byWorkspace[workspaceId]
    if (current === undefined) return
    this.update(workspaceId, { ...current, files: current.files.map(source => source.sourceId === sourceId ? patch(source) : source) })
  }

  private update(workspaceId: string, state: ProjectSourceLoadState): void {
    this.snapshot = { byWorkspace: { ...this.snapshot.byWorkspace, [workspaceId]: state } }
    for (const listener of this.listeners) listener()
  }
}
