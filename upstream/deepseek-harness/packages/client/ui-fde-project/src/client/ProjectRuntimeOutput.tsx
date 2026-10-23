/** Read-only project process output in the official right sidebar. */
import { useEffect } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { RuntimeOutputController } from './runtime-output-controller.ts'
import css from './ProjectRuntimeOutput.module.css'

/** Apply-owned read capability and observable; components have no Context or terminal service. */
export interface ProjectRuntimeOutputInjected {
  hooks: { runtimeOutput: RuntimeOutputController }
  watchOutput: (workspaceId: string) => () => void
}
export type ProjectRuntimeOutputProps = PropsRuntime<'sidebar.right.pane.tab'> & PropsLocale<'fdeProject'> & InjectFace<ProjectRuntimeOutputInjected>

/** Render actual bounded output without an input control or an allocation fallback. */
export function ProjectRuntimeOutput({ sessionId, useTabInfo, useWorkspaces, useRuntimeOutput, watchOutput, t }: ProjectRuntimeOutputProps) {
  const { tab } = useTabInfo()
  const workspace = useWorkspaces(state => state.items.find(item => item.sessionIds.includes(sessionId)))
  const id = workspace?.workspaceId
  const state = useRuntimeOutput(value => id === undefined ? undefined : value[id])
  useEffect(() => {
    if (id !== undefined && tab.visible) return watchOutput(id)
    return undefined
  }, [id, tab.visible, watchOutput])
  return <section className={css.root} aria-label={t('runtime.outputTitle')}>
    <p className={css.notice}>{t('runtime.outputNotice')}</p>
    {id === undefined ? <p role="alert">{t('surface.noProject')}</p>
      : state?.status === 'ready' ? <>
        <p>{state.title} · {t(state.processStatus === 'running' ? 'runtime.shellRunning' : 'runtime.shellExited')}</p>
        {state.truncated && <p role="status">{t('runtime.outputTruncated')}</p>}
        <pre className={css.output}>{state.text || t('runtime.outputEmpty')}</pre>
      </> : <p role={state?.status === 'error' ? 'alert' : 'status'}>{t(state?.status === 'missing' ? 'runtime.outputMissing' : state?.status === 'error' ? 'runtime.outputError' : 'runtime.loading')}</p>}
  </section>
}
