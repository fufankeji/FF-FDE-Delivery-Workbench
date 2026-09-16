import { useEffect, useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type { createLabStore } from './stores.ts'
import css from './lab.module.css'
type LabStore = ReturnType<typeof createLabStore>
type OverlayProps = PropsRuntime<'fde.workbench.lab.page'> & PropsStore<LabStore> & PropsLocale<'fdeProject'>

/** Keep the isolated training frame alive after its first explicit navigation. */
export function LabOverlay({ active, back, useStore, actions, t }: OverlayProps) {
  const opened = useStore(state => state.open)
  useEffect(() => { if (active && !opened) actions.open() }, [active, opened, actions])
  if (!active && !opened) return null
  return <section className={css.page} hidden={!active} aria-label={t('lab.title')}>
    <header className={css.header}>
      <div><strong>{t('lab.title')}</strong><span>{t('lab.independent')}</span></div>
      <button type="button" onClick={back}>{t('lab.return')}</button>
    </header>
    <LabFrame t={t} />
  </section>
}
function LabFrame({ t }: PropsLocale<'fdeProject'>) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  return <div className={css.content}>
    {!loaded && !failed && <div className={css.status} role="status">{t('lab.loading')}</div>}
    {failed && <div className={css.status} role="alert"><p>{t('lab.failed')}</p><Button variant="outline" onClick={() => { setLoaded(false); setFailed(false); setAttempt(value => value + 1) }}>{t('lab.retry')}</Button></div>}
    <iframe key={attempt} className={css.frame} title={t('lab.frame')} src="/fde-discovery-lab/" onLoad={() => setLoaded(true)} onErrorCapture={() => setFailed(true)} />
  </div>
}

type Summary = { readonly status: 'loading' | 'error' } | { readonly status: 'ready'; readonly cases: number; readonly started: number }

/** Read only public case summaries; never create a run or request a model. */
export function LabSummary({ openLab, t }: PropsRuntime<'fde.workbench.lab.summary'> & PropsLocale<'fdeProject'>) {
  const [summary, setSummary] = useState<Summary>({ status: 'loading' })
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setSummary({ status: 'loading' })
    void fetch('/api/fde-discovery-lab/cases', { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('Case catalog unavailable')
      const value: unknown = await response.json()
      if (!Array.isArray(value) || !value.every((row: unknown) => typeof row === 'object' && row !== null && 'id' in row && typeof row.id === 'string')) throw new Error('Invalid case catalog')
      const cases = new Map(value.map((row: { id: string; currentRunId?: string }) => [row.id, row]))
      if (!controller.signal.aborted) setSummary({ status: 'ready', cases: cases.size, started: [...cases.values()].filter(row => typeof row.currentRunId === 'string' && row.currentRunId.length > 0).length })
    }).catch(() => { if (!controller.signal.aborted) setSummary({ status: 'error' }) })
    return () => { controller.abort() }
  }, [retry])
  return <>
    <h2>{t('workbench.lab')}</h2><p>{t('lab.description')}</p>
    <div className={css.summaryMetric} aria-live="polite">
      {summary.status === 'ready' ? <><div><strong>1</strong><span>{t('lab.count')}</span></div><div><strong>{summary.cases}</strong><span>{t('lab.cases')}</span></div></>
        : <span>{t(summary.status === 'loading' ? 'workbench.loading' : 'workbench.failed')}</span>}
    </div>
    {summary.status === 'error' && <div className={css.summaryNotice} role="alert"><p>{t('lab.unavailable')}</p><Button variant="ghost" size="sm" onClick={() => { setRetry(value => value + 1) }}>{t('lab.retry')}</Button></div>}
    {summary.status === 'ready' && summary.started > 0 && <p className={css.resume}>{t('lab.resumeDescription', { count: summary.started })}</p>}
    <Button variant="outline" onClick={openLab}>{t(summary.status === 'ready' && summary.started > 0 ? 'lab.resume' : 'lab.open')} <span aria-hidden="true">→</span></Button>
  </>
}
