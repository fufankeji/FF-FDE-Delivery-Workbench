/** Shared current-project loading state for conversation project views. */

import { useEffect } from 'react'
import type { ReactNode } from 'react'
import type { ProjectSurfaceLoadState } from './controller.ts'
import type { ProjectViewProps } from './slots.ts'
import css from './project.module.css'

/** Resolve and load the project represented by a conversation view. */
export function useProjectViewState(props: ProjectViewProps): {
  readonly workspace: { readonly workspaceId: string; readonly path: string; readonly title: string } | undefined
  readonly state: ProjectSurfaceLoadState | undefined
} {
  const workspace = props.useWorkspaces((state) => {
    const value = state.items.find(item => item.sessionIds.includes(props.sessionId))
    return value === undefined ? undefined : { workspaceId: String(value.workspaceId), path: value.path, title: value.title }
  })
  const state = props.useProjectSurfaces(snapshot => workspace === undefined ? undefined : snapshot.byWorkspace[workspace.workspaceId])
  useEffect(() => {
    if (workspace !== undefined) props.loadProjectSurface(workspace.workspaceId)
  }, [props.loadProjectSurface, workspace?.workspaceId])
  return { workspace, state }
}

/** Render common loading, error, and unassociated states around one project view. */
export function ProjectViewState({ props, children }: {
  readonly props: ProjectViewProps
  readonly children: (value: NonNullable<Extract<ProjectSurfaceLoadState, { status: 'ready' }>['value']>, workspace: { readonly workspaceId: string; readonly path: string; readonly title: string }) => ReactNode
}) {
  const { workspace, state } = useProjectViewState(props)
  if (workspace === undefined) return <div className={css.surfaceState}>{props.t('surface.noProject')}</div>
  if (state === undefined || state.status === 'loading') return <div className={css.surfaceState} role="status">{props.t('surface.loading')}</div>
  if (state.status === 'error') {
    return (
      <div className={css.surfaceState} role="alert">
        <p>{props.t('surface.failed', { message: state.message })}</p>
        <button type="button" onClick={() => { props.refreshProjectSurface(workspace.workspaceId) }}>{props.t('surface.retry')}</button>
      </div>
    )
  }
  return <>{children(state.value, workspace)}</>
}

/** Consistent heading for project-level conversation views. */
export function ProjectViewHeader({ eyebrow, title, description, onRefresh, refreshLabel, actions }: {
  readonly eyebrow: string
  readonly title: string
  readonly description: string
  readonly onRefresh?: () => void
  readonly refreshLabel?: string
  readonly actions?: ReactNode
}) {
  return (
    <header className={css.surfaceHeader}>
      <div><span>{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>
      <div className={css.headerActions}>
        {actions}
        {onRefresh !== undefined && <button type="button" className={css.secondaryButton} onClick={onRefresh}>{refreshLabel ?? '刷新'}</button>}
      </div>
    </header>
  )
}
