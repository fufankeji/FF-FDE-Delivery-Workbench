/** Native Chinese quiz, with local navigation state and Host-owned answers and deadlines. */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { AttemptId, ChallengeCommand, ChallengeErrorCode, ChallengeResult } from '@deepseek-ai/dsh-fde-scenario-challenge/types'
import { ADDRESS, errorCode, type CommandOutcome } from './resource.ts'
import type {} from './index.ts'
import type {} from './locales.ts'
import css from './challenge.module.css'

type Actions = { refresh: () => void; mutate: (command: ChallengeCommand) => Promise<CommandOutcome> }
type Props = PropsRuntime<'fde.workbench.lab.challenge'> & PropsLocale<'fdeChallenge'> & InjectFace<Actions>

/** Present local challenge data; no component starts a model or reads project state.
 * @param props - Resource hook, local operation callbacks and laboratory navigation.
 * @returns Intro, current attempt, or immutable result review.
 */
export function ChallengePage({ active: visible, openDiscovery, useResource, refresh, mutate, t }: Props) {
  const resource = useResource<'fde-challenge'>(ADDRESS)
  const data = resource.value
  const [selected, setSelected] = useState<AttemptId | null>(null)
  const [index, setIndex] = useState(0)
  const [pending, setPending] = useState(false)
  const [committedRevision, setCommittedRevision] = useState(0)
  const [error, setError] = useState<ChallengeErrorCode | null>(null)
  const [confirm, setConfirm] = useState(false)
  const [tick, setTick] = useState(() => performance.now())
  const startId = useRef<AttemptId | null>(null)
  const expired = useRef<AttemptId | null>(null)
  const active = data?.active
  const clock = useMemo(() => ({ serverNow: data?.serverNow ?? 0, sampledAt: performance.now() }), [data?.serverNow])
  const seconds = active ? Math.max(0, Math.min(300, Math.ceil((active.deadlineAt - clock.serverNow - Math.max(0, tick - clock.sampledAt)) / 1000))) : 0
  useEffect(() => {
    if (!visible) return
    refresh()
    const timer = window.setInterval(() => setTick(performance.now()), 1000)
    return () => window.clearInterval(timer)
  }, [visible, refresh])
  useEffect(() => {
    if (visible && active && seconds === 0 && expired.current !== active.id) {
      expired.current = active.id
      refresh()
    }
  }, [visible, active, seconds, refresh])

  const perform = async (command: ChallengeCommand): Promise<void> => {
    if (pending) return
    setPending(true)
    setError(null)
    try {
      const outcome = await mutate(command)
      if (!outcome.ok) { setError(outcome.code); return }
      setCommittedRevision(outcome.revision)
      if (command.kind === 'start') { setSelected(outcome.attemptId); setIndex(0); startId.current = null }
      setConfirm(false)
    } catch (failure) {
      setError('storage')
    } finally { setPending(false) }
  }
  const start = (): void => {
    if (active) { setSelected(active.id); setIndex(0); return }
    startId.current ??= crypto.randomUUID() as AttemptId
    void perform({ kind: 'start', attemptId: startId.current })
  }
  const current = selected && active?.id === selected ? active : null
  const result = selected ? data?.history.find(row => row.id === selected) : undefined
  const failure = error ?? (resource.status === 'failed' ? errorCode(resource.failure?.message) : null)
  const saving = pending || (data !== undefined && data.revision < committedRevision)
  const blocked = saving || resource.status !== 'live' || failure !== null
  const retry = (): void => { setError(null); expired.current = null; refresh() }

  return <div className={css.page}>
    <div className={css.heading}><span className={css.eyebrow}>{t('eyebrow')}</span><h1>{t('title')}</h1></div>
    {failure && <div className={css.notice} role="alert"><span>{t(`error_${failure}`)}</span><Button variant="outline" size="sm" onClick={retry}>{t('retry')}</Button></div>}
    {!data && !failure && <div className={css.loading} role="status" aria-label={t('loading')}><span className={css.spinner} /></div>}
    {data && selected === null && <>
      <section className={css.intro}>
        <h2>{t('intro')}</h2><p>{t('description')}</p>
        <div className={css.facts}><span>{t('questions')}</span><span>{t('duration')}</span><span>{t('directions')}</span></div>
        <p>{t('rules')}</p><p>{t('clockRule')}</p>
        {active && <p className={css.emphasis}>{t('inProgress')} · {t('answered', { count: active.answers.filter(answer => answer !== null).length, total: 10 })}</p>}
        <Button disabled={blocked} onClick={start}>{t(active ? 'continue' : 'start')}</Button>
        <p className={css.secondary}>{t('boundary')}</p><p className={css.secondary}>{t('privacy')}</p>
      </section>
      <section className={css.history}><div className={css.sectionTitle}><h2>{t('history')}</h2><span>{t('historyLimit')}</span></div>
        {data.history.length === 0 ? <p className={css.secondary}>{t('historyEmpty')}</p> : data.history.map(row => <article key={row.id} className={css.historyRow}>
          <div><time dateTime={new Date(row.endedAt).toISOString()}>{new Date(row.endedAt).toLocaleString('zh-CN', { hour12: false })}</time><p>{t('score', { count: row.correct })} · {t(row.reason)}</p></div>
          <Button variant="ghost" onClick={() => setSelected(row.id)}>{t('historyDetail')}</Button>
        </article>)}
      </section>
    </>}
    {current && <section className={css.answerPanel}>
      <div className={css.answerHeader}>
        <div><h2>{t('questionNumber', { current: index + 1, total: 10 })}</h2><span className={css.secondary}>{t('answered', { count: current.answers.filter(answer => answer !== null).length, total: 10 })}</span></div>
        <div className={css.clock} data-urgent={seconds <= 60 || undefined} aria-label={t('remaining')}><span>{t('remaining')}</span><strong>{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</strong></div>
      </div>
      <div className={css.questionNav} role="group" aria-label={t('questionNav')}>
        {current.questions.map((question, number) => <button key={question.id} type="button" disabled={saving} aria-current={number === index ? 'step' : undefined}
          aria-label={t('jump', { number: number + 1, state: t(current.answers[number] === null ? 'unansweredState' : 'answeredState') })}
          data-answered={current.answers[number] !== null || undefined} onClick={() => setIndex(number)}>{number + 1}</button>)}
      </div>
      <p className={css.domain}>{current.questions[index]!.domainLabel}</p>
      <fieldset className={css.question} disabled={blocked || seconds === 0}>
        <legend>{current.questions[index]!.prompt}</legend>
        {current.questions[index]!.options.map((option, choice) => <label key={choice} className={css.option} data-selected={current.answers[index] === choice || undefined}>
          <input type="radio" name={current.questions[index]!.id} checked={current.answers[index] === choice} onChange={() => { void perform({ kind: 'answer', attemptId: current.id, revision: current.revision, questionId: current.questions[index]!.id, choice }) }} />
          <span>{option}</span>
        </label>)}
      </fieldset>
      <div className={css.answerFooter}><span role="status" className={css.secondary}>{t(seconds === 0 ? 'ending' : saving ? 'saving' : 'saved')}</span>
        <div className={css.actions}><Button variant="ghost" disabled={index === 0 || saving} onClick={() => setIndex(value => value - 1)}>{t('prev')}</Button>
          {index < 9 && <Button variant="outline" disabled={saving} onClick={() => setIndex(value => value + 1)}>{t('next')}</Button>}
          <Button disabled={blocked || seconds === 0} onClick={() => setConfirm(true)}>{t('submit')}</Button>
        </div>
      </div>
      <Modal open={confirm && seconds > 0} title={t('submitTitle')} closeLabel={t('close')} onClose={() => { if (!pending) setConfirm(false) }}>
        <p>{t('submitDescription', { count: current.answers.filter(answer => answer === null).length })}</p>
        <div className={css.actions}><Button variant="outline" disabled={pending} onClick={() => setConfirm(false)}>{t('cancel')}</Button><Button disabled={blocked} onClick={() => { void perform({ kind: 'submit', attemptId: current.id, revision: current.revision }) }}>{t('confirmSubmit')}</Button></div>
      </Modal>
    </section>}
    {selected !== null && !current && !result && !failure && <div className={css.loading} role="status" aria-label={t('loading')}><span className={css.spinner} /></div>}
    {result && <ResultView result={result} t={t} openDiscovery={openDiscovery} back={() => setSelected(null)} />}
    <footer className={css.footer}>{t('footer')}</footer>
  </div>
}

function ResultView({ result, t, openDiscovery, back }: PropsLocale<'fdeChallenge'> & { result: ChallengeResult; openDiscovery: () => void; back: () => void }) {
  return <>
    <section className={css.result}>
      <div className={css.sectionTitle}><h2>{t('result')}</h2><span>{t(result.reason)} · {t('elapsed', { seconds: result.elapsedSeconds })}</span></div>
      <div className={css.score}>{t('score', { count: result.correct })}</div>
      <div className={css.facts}><span>{t('correct')} {result.correct}</span><span>{t('wrong')} {result.wrong}</span><span>{t('unanswered')} {result.unanswered}</span></div>
      <p className={css.secondary}>{t('boundary')}</p><p className={css.secondary}>{t('repeat')}</p>
      <h3>{t('domainResult')}</h3><div className={css.domains}>{result.domains.map(domain => <div key={domain.id}><span>{domain.label}</span><strong>{t('domainScore', { correct: domain.correct, total: domain.total })}</strong></div>)}</div>
      <div className={css.actions}><Button variant="outline" onClick={back}>{t('historyBack')}</Button><Button onClick={openDiscovery}>{t('openDiscovery')}</Button></div>
    </section>
    <section className={css.review}><h2>{t('review')}</h2>{result.review.map((question, number) => <article className={css.reviewCard} key={question.id}>
      <div className={css.sectionTitle}><span>{t('questionNumber', { current: number + 1, total: 10 })} · {question.domainLabel}</span><span data-outcome={question.outcome}>{t(question.outcome)}</span></div>
      <h3>{question.prompt}</h3>
      <p>{t('yourAnswer')}：{question.chosen === null ? t('noAnswer') : question.options[question.chosen]}</p>
      <p className={css.emphasis}>{t('rightAnswer')}：{question.options[question.correct]}</p>
      <details><summary>{t('why')}</summary><ol className={css.explanations}>{question.options.map((option, choice) => <li key={choice}><strong>{option}</strong><p>{question.explanations[choice]}</p></li>)}</ol></details>
      <div className={css.practice}><strong>{t('practice')}</strong><p>{question.practice}</p></div>
    </article>)}</section>
  </>
}
