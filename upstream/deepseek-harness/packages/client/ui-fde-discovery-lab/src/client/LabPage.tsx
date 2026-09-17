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
    <div className={css.labMetric} data-overview-lab-metric aria-live="polite">
      <span className={css.metricIcon}><SummaryIcon kind="lab" /></span>
      {summary.status === 'ready' ? <div><strong>1</strong><span>{t('lab.count')}</span></div> : <span className={css.metricStatus}>{t(summary.status === 'loading' ? 'workbench.loading' : 'workbench.failed')}</span>}
    </div>
    <div className={css.casesMetric} data-overview-cases-metric aria-live="polite">
      <span className={css.metricIcon}><SummaryIcon kind="cases" /></span>
      {summary.status === 'ready' ? <div><strong>{summary.cases}</strong><span>{t('lab.cases')}</span></div> : <span className={css.metricStatus}>{t(summary.status === 'loading' ? 'workbench.loading' : 'workbench.failed')}</span>}
    </div>
    <article className={css.summaryCard} data-overview-lab>
      <header><span className={css.cardIcon}><SummaryIcon kind="lab" /></span><h2>{t('workbench.lab')}</h2>
        {summary.status === 'ready' && <p className={css.cardTotals}><strong>1</strong> {t('lab.count')}<span aria-hidden="true">·</span><strong>{summary.cases}</strong> {t('lab.cases')}</p>}
      </header>
      <p className={css.summaryDescription}>{t('lab.description')}</p>
      <div className={css.summaryActions}>
        {summary.status === 'error' && <div className={css.summaryNotice} role="alert"><p>{t('lab.unavailable')}</p><Button variant="ghost" size="sm" onClick={() => { setRetry(value => value + 1) }}>{t('lab.retry')}</Button></div>}
        <div className={css.resume} data-started={summary.status === 'ready' && summary.started > 0 || undefined}>
          {summary.status === 'ready' && summary.started > 0 && <p><span className={css.resumeDot} aria-hidden="true" />{t('lab.resumeDescription', { count: summary.started })}</p>}
          <Button className={css.summaryButton} variant="outline" onClick={openLab}>{t(summary.status === 'ready' && summary.started > 0 ? 'lab.resume' : 'lab.open')}<SummaryIcon kind="arrow" /></Button>
        </div>
      </div>
    </article>
  </>
}

/** Lab-owned glyphs keep the summary independent of other feature modules. */
function SummaryIcon({ kind }: { readonly kind: 'lab' | 'cases' | 'arrow' }) {
  return <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === 'lab' && <><path d="M9 3h6M10 3v7L4.5 19a1.3 1.3 0 0 0 1.1 2h12.8a1.3 1.3 0 0 0 1.1-2L14 10V3M8 15h8" /><path d="M10 18h.01M14 18h.01" /></>}
    {kind === 'cases' && <path d="m12 3 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 16l9 5 9-5" />}
    {kind === 'arrow' && <path d="M5 12h14m-6-6 6 6-6 6" />}
  </svg>
}
