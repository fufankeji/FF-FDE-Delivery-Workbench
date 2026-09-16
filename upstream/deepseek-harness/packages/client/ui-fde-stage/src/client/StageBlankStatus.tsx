/** Current-stage prompt above the composer while a project is still blank. */

import { useEffect } from 'react'
import type { FdeStageBlankProps } from './slots.ts'
import css from './stage.module.css'

/** Render the initial project stage without replacing the official Hero. */
export function StageBlankStatus({
  session, sessionId, useWorkspaces, useStageProgress, loadStage, retryStage, t,
}: FdeStageBlankProps) {
  const workspace = useWorkspaces(state =>
    state.items.find(item => item.sessionIds.includes(sessionId)))
  const workspaceId = workspace === undefined ? undefined : String(workspace.workspaceId)
  const stage = useStageProgress(snapshot =>
    workspaceId === undefined ? undefined : snapshot.byWorkspace[workspaceId])

  useEffect(() => {
    if (workspaceId !== undefined) loadStage(workspaceId)
  }, [loadStage, workspaceId])

  if (!session.blank || workspaceId === undefined) return null
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
  return (
    <section
      className={css.blankStatus}
      data-compact="true"
      data-state="ready"
      aria-label={t('blank.agent')}
    >
      <span className={css.blankCompletedMark}>✦</span>
      <div className={css.blankCompletedCopy}>
        <strong>{t('blank.agent')}</strong>
        <span>{t('blank.agentHint')}</span>
      </div>
    </section>
  )
}
