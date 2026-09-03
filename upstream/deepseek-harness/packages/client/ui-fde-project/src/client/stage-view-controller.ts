/** Apply-scoped, Workspace-isolated stage browsing state. */

import type { FdeV2StageId } from './stage-controller.ts'

/** Explicit stage selections only; absence means follow the project's current stage. */
export interface ProjectStageViewSnapshot {
  readonly byWorkspace: Readonly<Record<string, FdeV2StageId>>
}

/** Shares one read-only stage selection across root- and Session-scoped project slots. */
export class ProjectStageViewController {
  private snapshot: ProjectStageViewSnapshot = { byWorkspace: {} }
  private readonly listeners = new Set<() => void>()

  getSnapshot = (): ProjectStageViewSnapshot => this.snapshot

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  view(workspaceId: string, stage: FdeV2StageId): void {
    if (this.snapshot.byWorkspace[workspaceId] === stage) return
    this.replace({ ...this.snapshot.byWorkspace, [workspaceId]: stage })
  }

  followCurrent(workspaceId: string): void {
    if (this.snapshot.byWorkspace[workspaceId] === undefined) return
    const { [workspaceId]: _removed, ...rest } = this.snapshot.byWorkspace
    this.replace(rest)
  }

  dispose(): void { this.listeners.clear() }

  private replace(byWorkspace: Readonly<Record<string, FdeV2StageId>>): void {
    this.snapshot = { byWorkspace }
    for (const listener of this.listeners) listener()
  }
}
