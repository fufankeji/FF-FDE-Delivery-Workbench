/** Shared navigation state for the root Project Progress page. */

export type ProjectPageView = 'closed' | 'home' | 'dashboard' | 'overview' | 'timeline' | 'project' | 'lab' | 'skills'

/** Immutable root-page navigation state exposed to Slot components. */
export interface ProjectPageSnapshot {
  readonly open: boolean
  readonly view: ProjectPageView
  readonly workspaceId?: string
  /** A temporarily hidden workbench page can be restored from navigation. */
  readonly nativeReturn?: boolean
}

/** Apply-scoped page navigation shared by the sidebar launcher and page. */
export class ProjectPageController {
  private snapshot: ProjectPageSnapshot = { open: true, view: 'home' }
  private readonly listeners = new Set<() => void>()
  private labReturn: ProjectPageSnapshot = { open: true, view: 'dashboard' }
  private nativeReturn: ProjectPageSnapshot | undefined

  /** Read the current immutable page state. */
  getSnapshot = (): ProjectPageSnapshot => this.snapshot

  /** Subscribe to state replacement. */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  /** Open the page at its project overview. */
  open = (): void => { this.set({ open: true, view: 'overview' }) }
  /** Return to the product homepage without opening or changing a project. */
  showHome = (): void => { this.set({ open: true, view: 'home' }) }
  /** Enter the platform overview without selecting a project. */
  showDashboard = (): void => { this.set({ open: true, view: 'dashboard' }) }
  /** Open independent training and remember the page to restore. */
  showLab = (): void => {
    if (this.snapshot.view === 'lab') return
    this.labReturn = this.snapshot.nativeReturn ? { open: false, view: 'closed' } : this.snapshot
    this.set({ open: true, view: 'lab' })
  }
  /** Restore the page from which independent training was opened. */
  returnFromLab = (): void => { if (this.snapshot.view === 'lab') this.set(this.labReturn) }
  /** Open the intentionally unconnected skills-center placeholder. */
  showSkills = (): void => { this.set({ open: true, view: 'skills' }) }
  /** Navigate to the multi-project overview. */
  showOverview = (): void => { this.set({ open: true, view: 'overview' }) }
  /** Navigate to the real-date delivery timeline. */
  showTimeline = (): void => { this.set({ open: true, view: 'timeline' }) }
  /** Navigate to one explicit Workspace's read-only details. */
  showProject = (workspaceId: string): void => { this.set({ open: true, view: 'project', workspaceId }) }
  /** Close Project Progress and restore Project Delivery. */
  close = (): void => { this.set({ open: false, view: 'closed' }) }
  /** Hide page content for official navigation, retaining the exact return position. */
  suspendForNative = (): void => {
    if (!this.snapshot.open) return
    this.nativeReturn = this.snapshot
    this.set({ open: false, view: 'closed', nativeReturn: true })
  }
  /** Restore the retained page without modifying the independent lab return chain. */
  returnFromNative = (): void => {
    if (this.nativeReturn !== undefined) this.set(this.nativeReturn)
  }
  /** Release subscribers at plugin disposal. */
  dispose(): void { this.listeners.clear(); this.nativeReturn = undefined }

  private set(snapshot: ProjectPageSnapshot): void {
    if (!snapshot.nativeReturn) this.nativeReturn = undefined
    if (this.snapshot.open === snapshot.open
      && this.snapshot.view === snapshot.view
      && this.snapshot.workspaceId === snapshot.workspaceId
      && this.snapshot.nativeReturn === snapshot.nativeReturn) return
    this.snapshot = snapshot
    for (const listener of this.listeners) listener()
  }
}
