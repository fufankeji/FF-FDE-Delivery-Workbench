/** Compact project runtime controls shared by every project delivery view. */

import { useEffect, useRef, useState } from 'react'
import { FDE_STAGE_IDS } from './stage-controller.ts'
import type { ProjectRuntimeHeaderProps } from './slots.ts'
import css from './project.module.css'

/** Show project start, preview, terminal, and stop actions from development onward. */
export function ProjectRuntimeHeader({
  sessionId,
  useWorkspaces,
  useProjectSurfaces,
  useStageProgress,
  loadStage,
  loadProjectSurface,
  pollProjectSurface,
  startProject,
  stopProject,
  openProjectPreview,
  showProjectTerminal,
  continueDevelopment,
  t,
}: ProjectRuntimeHeaderProps) {
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const previousRuntime = useRef<{
    readonly operationId: string | undefined
    readonly status: string
  } | undefined>(undefined)
  const workspace = useWorkspaces(state => state.items.find(item => item.sessionIds.includes(sessionId)))
  const workspaceId = workspace === undefined ? undefined : String(workspace.workspaceId)
  const stage = useStageProgress(snapshot => workspaceId === undefined ? undefined : snapshot.byWorkspace[workspaceId])
  const surface = useProjectSurfaces(snapshot => workspaceId === undefined ? undefined : snapshot.byWorkspace[workspaceId])

  useEffect(() => {
    if (workspaceId === undefined) return
    loadStage(workspaceId)
    loadProjectSurface(workspaceId)
  }, [loadProjectSurface, loadStage, workspaceId])

  const runtime = surface?.status === 'ready' ? surface.value.runtime : undefined
  useEffect(() => {
    if (workspaceId === undefined) return
    const interval = runtime?.status === 'starting' || runtime?.status === 'stopping'
      ? 1_250
      : runtime?.status === 'blocked' && runtime.action === 'start'
        ? 3_000
        : undefined
    if (interval === undefined) return
    const timer = window.setInterval(() => { pollProjectSurface(workspaceId) }, interval)
    return () => { window.clearInterval(timer) }
  }, [pollProjectSurface, runtime?.action, runtime?.status, workspaceId])

  useEffect(() => {
    const previous = previousRuntime.current
    previousRuntime.current = runtime === undefined
      ? undefined
      : { operationId: runtime.operationId, status: runtime.status }
    if (workspace === undefined
      || workspaceId === undefined
      || runtime?.status !== 'running'
      || runtime.operationId === undefined
      || runtime.previewUrl === undefined
      || previous?.operationId !== runtime.operationId
      || (previous.status !== 'starting' && previous.status !== 'blocked')) return
    void openProjectPreview(workspaceId, String(sessionId), workspace.path).catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : String(cause))
    })
  }, [openProjectPreview, runtime, sessionId, workspace, workspaceId])

  if (workspace === undefined || workspaceId === undefined || stage?.status !== 'ready') return null
  if (stage.value.currentStage !== 'completed'
    && FDE_STAGE_IDS.indexOf(stage.value.currentStage) < FDE_STAGE_IDS.indexOf('development')) return null

  const run = async (action: () => Promise<void>): Promise<void> => {
    if (busy) return
    setBusy(true)
    setError(undefined)
    try { await action() } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally { setBusy(false) }
  }

  if (surface === undefined || surface.status === 'loading') {
    return <span className={css.runtimeStatus} data-state="loading">{t('runtime.loading')}</span>
  }
  if (surface.status === 'error') {
    return <span className={css.runtimeStatus} data-state="error" title={surface.message}>{t('runtime.unavailable')}</span>
  }

  const state = runtime?.status ?? 'stopped'
  const detail = error ?? runtime?.message
  const start = () => run(async () => { await startProject(workspaceId, String(sessionId), workspace.path) })
  const stop = () => run(async () => { await stopProject(workspaceId, String(sessionId), workspace.path) })
  const open = () => run(async () => { await openProjectPreview(workspaceId, String(sessionId), workspace.path) })
  const terminal = () => run(async () => { await showProjectTerminal(workspaceId, String(sessionId), workspace.path) })

  return (
    <span className={css.runtimeControl} data-state={state} title={detail}>
      <span className={css.runtimeDot} />
      {state === 'starting' || state === 'stopping' ? (
        <>
          <button type="button" disabled>{t(state === 'starting' ? 'runtime.starting' : 'runtime.stopping')}</button>
          <button type="button" disabled={busy} onClick={() => { void terminal() }}>{t('runtime.terminal')}</button>
        </>
      ) : null}
      {state === 'stopped' ? (
        <>
          <button type="button" disabled={busy} onClick={() => { void start() }}>{t('runtime.start')}</button>
          {runtime?.terminalTitle === undefined ? null : (
            <button type="button" disabled={busy} onClick={() => { void terminal() }}>{t('runtime.terminal')}</button>
          )}
        </>
      ) : null}
      {state === 'running' ? (
        <>
          <button type="button" disabled={busy || runtime?.previewUrl === undefined} onClick={() => { void open() }}>{t('runtime.open')}</button>
          <button type="button" disabled={busy} onClick={() => { void terminal() }}>{t('runtime.terminal')}</button>
          <button type="button" disabled={busy} onClick={() => { void stop() }}>{t('runtime.stop')}</button>
        </>
      ) : null}
      {state === 'blocked' ? (
        <>
          <span className={css.runtimeMessage}>{detail ?? t('runtime.blocked')}</span>
          <button type="button" disabled={busy} onClick={() => { continueDevelopment(String(sessionId)) }}>{t('runtime.continue')}</button>
          {runtime?.action === 'stop' && runtime.previewUrl !== undefined ? (
            <button type="button" disabled={busy} onClick={() => { void open() }}>{t('runtime.open')}</button>
          ) : null}
          {runtime?.terminalTitle === undefined ? null : (
            <button type="button" disabled={busy} onClick={() => { void terminal() }}>{t('runtime.terminal')}</button>
          )}
          <button type="button" disabled={busy} onClick={() => { void (runtime?.action === 'stop' ? stop() : start()) }}>
            {t(runtime?.action === 'stop' ? 'runtime.retryStop' : 'runtime.retryStart')}
          </button>
        </>
      ) : null}
      {error !== undefined && state !== 'blocked' ? <span className={css.runtimeMessage}>{error}</span> : null}
    </span>
  )
}
