/** Current-stage prompt above the composer while a project is still blank. */

import { useEffect } from 'react'
import { FDE_STAGES } from './stages.ts'
import type { FdeStageBlankProps } from './slots.ts'
import css from './stage.module.css'

/** Render the initial project stage without replacing the official Hero. */
export function StageBlankStatus({
  session, sessionId, useWorkspaces, useStageProgress, loadStage, retryStage, openProjectProgress, t,
}: FdeStageBlankProps) {
  const workspace = useWorkspaces(state =>
    state.items.find(item => item.sessionIds.includes(sessionId)))
  const workspaceId = workspace === undefined ? undefined : String(workspace.workspaceId)
  const stage = useStageProgress(snapshot =>
    workspaceId === undefined ? undefined : snapshot.byWorkspace[workspaceId])

  useEffect(() => {
    if (workspaceId !== undefined) loadStage(workspaceId)
  }, [loadStage, workspaceId])

  if (session.composerPhase !== 'blank' || workspaceId === undefined) return null
  if (stage?.status === 'error') {
    return (
      <div className={css.blankStatus} data-compact="true" data-state="error" role="status">
        <span>{t('failed', { message: stage.message })}</span>
        <button type="button" className={css.inlineRetry} onClick={() => { retryStage(workspaceId) }}>
          {t('retry')}
        </button>
      </div>
    )
  }
  if (stage === undefined || stage.status === 'loading') {
    return <div className={css.blankStatus} data-compact="true" data-state="loading" role="status">{t('loading')}</div>
  }
  if (stage.value.currentStage === 'completed') {
    return (
      <section className={css.blankStatus} data-compact="true" data-state="completed" aria-label={t('header.completed')}>
        <span className={css.blankCompletedMark}>✓</span>
        <div className={css.blankCompletedCopy}>
          <strong>{t('completed.name')}</strong>
          <span>{t('completed.hint')}</span>
        </div>
      </section>
    )
  }
  const index = FDE_STAGES.findIndex(item => item.id === stage.value.currentStage)
  const definition = FDE_STAGES[index]
  if (definition === undefined) return null
  return (
    <section
      className={css.blankStatus}
      data-state="ready"
      data-stage={definition.id}
      aria-label={t('header.stage', { current: index + 1, total: FDE_STAGES.length })}
    >
      <span className={css.blankStageBadge}>
        {t('header.stage', { current: index + 1, total: FDE_STAGES.length })}
      </span>
      <div className={css.blankStageCopy}>
        <strong>{t(definition.nameKey)}</strong>
        <span>{t(definition.focusKey)}</span>
      </div>
      <button
        type="button"
        className={css.blankProgressLink}
        onClick={() => { openProjectProgress(workspaceId) }}
      >
        <span>{t('blank.progress')}</span>
        <span aria-hidden="true">→</span>
      </button>
    </section>
  )
}
