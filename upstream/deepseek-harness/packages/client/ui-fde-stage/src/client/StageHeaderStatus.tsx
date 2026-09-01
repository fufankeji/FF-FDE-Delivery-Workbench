/** Compact current-stage status in the active Session header. */

import { useEffect } from 'react'
import { FDE_V2_STAGE_PRESENTATION, FDE_V2_STAGE_TOTAL } from './stages.ts'
import type { FdeStageHeaderProps } from './slots.ts'
import css from './stage.module.css'

/** Render the current project stage beside existing Session utilities. */
export function StageHeaderStatus({
  sessionId, useWorkspaces, useStageProgress, loadStage, retryStage, t,
}: FdeStageHeaderProps) {
  const workspace = useWorkspaces(state =>
    state.items.find(item => item.sessionIds.includes(sessionId)))
  const workspaceId = workspace === undefined ? undefined : String(workspace.workspaceId)
  const stage = useStageProgress(snapshot =>
    workspaceId === undefined ? undefined : snapshot.byWorkspace[workspaceId])

  useEffect(() => {
    if (workspaceId !== undefined) loadStage(workspaceId)
  }, [loadStage, workspaceId])

  if (workspaceId === undefined) return null
  if (stage === undefined || stage.status === 'loading') {
    return <span className={css.headerStatus} data-state="loading">{t('loading')}</span>
  }
  if (stage.status === 'error') {
    return (
      <button type="button" className={css.headerRetry} onClick={() => { retryStage(workspaceId) }}>
        {t('retry')}
      </button>
    )
  }
  const presentation = FDE_V2_STAGE_PRESENTATION[stage.value.currentStage]
  return (
    <span className={css.headerStatus} data-state="ready">
      <span className={css.statusDot} />
      <span>{t('header.stage', { current: presentation.current, total: FDE_V2_STAGE_TOTAL })}</span>
      <span className={css.headerDivider}>·</span>
      <span className={css.headerName}>{t(presentation.nameKey)}</span>
    </span>
  )
}
