/**
 * The workspace browser's viewing store: the session-list grouping mode,
 * persisted across reloads. Module level exports the factory only (a
 * module-level handle would pin the store identity across plugin reloads);
 * register() receives the factory and the browser derives its PropsStore
 * share from the return type.
 */
import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-store'
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { reconcileManualOrder, type ArchivedFilter, type SessionRowState } from './tree.ts'

/** Browser-local order account for the hierarchy-free flat Session list. */
export const FLAT_SESSION_ORDER_KEY = '__flat_session_order__'

/** Session-list grouping mode: sibling Workspace sections, a Workspace tree, or one flat list. */
export type SessionGroupBy = 'workspace' | 'workspace-tree' | 'flat'
/** Session order: saved manual positions or current recency. */
export type SessionOrderBy = 'manual' | 'updated'

/** Initial project facts captured by the FDE creation form. */
export interface ProjectMetadata {
  name: string
  companyName: string
  schedule: { status: 'pending-confirmation' } | {
    status: 'estimated'
    startDate: string
    endDate: string
  }
  storagePath: string
  projectRoot?: string
  directoryName?: string
  createdAt: string
}

/** Workspace browser viewing state persisted across surface remounts and reloads. */
type WorkspaceViewState = {
  groupBy: SessionGroupBy
  orderBy: SessionOrderBy
  /** Explicit group expansion keyed by Workspace identity, including descendants in tree mode. */
  groupExpansion: Record<string, boolean>
  /** Shared editable order per Workspace group plus the browser-local flat-list account. */
  sessionOrderByAccount: Record<string, string[]>
  /** Last observed update timestamps per order account for one-time promotion events. */
  sessionUpdatedAtByAccount: Record<string, Record<string, number>>
  /** FDE project metadata keyed by the Host-canonical Workspace path. */
  projectMetadataByPath: Record<string, ProjectMetadata>
  /** User-confirmed default parent directory for newly created projects. */
  defaultProjectRoot?: string
  /** Archived-row visibility; omitted in pre-filter v5 snapshots and read as 'default'. */
  archivedFilter?: ArchivedFilter
}

type SessionOrderSource = {
  members: Readonly<Record<string, readonly SessionId[]>>
  summaries: SessionListState['byId']
  rowState: Pick<SessionRowState, 'pinnedSessionIds' | 'archivedSessionIds'>
}

/**
 * Annotation twin of the actions literal below (the export needs a declared
 * return type); drift fails assignability at the defineStore call.
 */
type WorkspaceViewActions = {
  setGroupBy: (draft: WorkspaceViewState, mode: SessionGroupBy) => void
  setOrderBy: (draft: WorkspaceViewState, mode: SessionOrderBy, initialOrders?: Readonly<Record<string, readonly string[]>>) => void
  syncSessionOrders: (draft: WorkspaceViewState, orders: Readonly<Record<string, readonly string[]>>) => void
  setGroupExpanded: (draft: WorkspaceViewState, key: string, expanded: boolean) => void
  retainAccountKeys: (draft: WorkspaceViewState, workspaceKeys: readonly string[]) => void
  syncSessionOrderAccount: (
    draft: WorkspaceViewState,
    accountKey: string,
    order: string[],
    updatedAt: Record<string, number>,
  ) => void
  setSessionOrder: (draft: WorkspaceViewState, accountKey: string, order: string[], initialOrders?: Readonly<Record<string, readonly string[]>>) => void
  setProjectMetadata: (draft: WorkspaceViewState, path: string, metadata: ProjectMetadata) => void
  setDefaultProjectRoot: (draft: WorkspaceViewState, path: string) => void
  pinSessionOrder: (
    draft: WorkspaceViewState,
    sessionId: string,
    accountKeys: readonly string[],
    source: SessionOrderSource,
  ) => void
  setArchivedFilter: (draft: WorkspaceViewState, filter: ArchivedFilter) => void
}

/** Copy read-only projections into the persisted mutable store representation. */
function copySessionOrders(
  orders: Readonly<Record<string, readonly string[]>>,
): Record<string, string[]> {
  return Object.fromEntries(Object.entries(orders).map(([key, order]) => [key, [...order]]))
}

/**
 * Create the workspace browser viewing store handle.
 * @returns the store handle (spec + type + identity + factory in one).
 */
export function createWorkspaceViewStore(): EngineStoreHandle<WorkspaceViewState, WorkspaceViewActions> {
  return defineStore({
    init: (): WorkspaceViewState => ({
      groupBy: 'workspace',
      orderBy: 'updated',
      groupExpansion: {},
      sessionOrderByAccount: {},
      sessionUpdatedAtByAccount: {},
      projectMetadataByPath: {},
      archivedFilter: 'default',
    }),
    persist: 'dsh.workspace.view.v6',
    actions: {
      setGroupBy: (d, mode: SessionGroupBy) => { d.groupBy = mode },
      setOrderBy: (d, mode: SessionOrderBy, initialOrders?: Readonly<Record<string, readonly string[]>>) => {
        if (d.orderBy !== mode && initialOrders !== undefined) {
          d.sessionOrderByAccount = mode === 'manual' ? copySessionOrders(initialOrders) : {}
        }
        d.orderBy = mode
      },
      syncSessionOrders: (d, orders: Readonly<Record<string, readonly string[]>>) => {
        if (d.orderBy === 'manual') Object.assign(d.sessionOrderByAccount, copySessionOrders(orders))
      },
      setGroupExpanded: (d, key: string, expanded: boolean) => { d.groupExpansion[key] = expanded },
      retainAccountKeys: (d, workspaceKeys: readonly string[]) => {
        const retained = new Set(workspaceKeys)
        d.groupExpansion = Object.fromEntries(
          Object.entries(d.groupExpansion).filter(([key]) => retained.has(key)),
        )
        d.sessionOrderByAccount = Object.fromEntries(
          Object.entries(d.sessionOrderByAccount).filter(([key]) => retained.has(key)),
        )
        d.sessionUpdatedAtByAccount = Object.fromEntries(
          Object.entries(d.sessionUpdatedAtByAccount).filter(([key]) => retained.has(key)),
        )
      },
      syncSessionOrderAccount: (d, accountKey: string, order: string[], updatedAt: Record<string, number>) => {
        d.sessionOrderByAccount[accountKey] = order
        d.sessionUpdatedAtByAccount[accountKey] = updatedAt
      },
      setSessionOrder: (d, accountKey: string, order: string[], initialOrders?: Readonly<Record<string, readonly string[]>>) => {
        if (initialOrders !== undefined) {
          if (d.orderBy === 'updated') d.sessionOrderByAccount = copySessionOrders(initialOrders)
          else Object.assign(d.sessionOrderByAccount, copySessionOrders(initialOrders))
          d.orderBy = 'manual'
        }
        d.sessionOrderByAccount[accountKey] = order
      },
      setProjectMetadata: (d, path: string, metadata: ProjectMetadata) => {
        d.projectMetadataByPath ??= {}
        d.projectMetadataByPath[path] = metadata
      },
      setDefaultProjectRoot: (d, path: string) => { d.defaultProjectRoot = path },
      pinSessionOrder: (d, sessionId, accountKeys, source) => {
        const selected = new Set(accountKeys)
        d.sessionOrderByAccount = Object.fromEntries(Object.entries(source.members).map(([key, members]) => {
          const order = reconcileManualOrder(members, d.sessionOrderByAccount[key], source.summaries, source.rowState)
          return [key, selected.has(key) ? [sessionId, ...order.filter(id => id !== sessionId)] : order]
        }))
      },
      setArchivedFilter: (d, filter: ArchivedFilter) => { d.archivedFilter = filter },
    },
  })
}

/** The bound write set of one viewing-store instance (what the UiWorkspace service drives). */
export type WorkspaceViewStoreActions = ReturnType<ReturnType<typeof createWorkspaceViewStore>['create']>['actions']
