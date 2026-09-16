/** Platform overview and the deliberately unconnected skills-center page. */
import { useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRenderSlots } from '@deepseek-ai/dsh-client-ui-slots'
import { WorkbenchIcon } from './WorkbenchNavigation.tsx'
import css from './workbench.module.css'

interface RecentProject {
  readonly workspaceId: string
  readonly title: string
  readonly companyName: string
  readonly stage: string
  readonly updatedAt: number
}
type OverviewProps = PropsLocale<'fdeProject'> & PropsRenderSlots<'fde.workbench.lab.summary'> & {
  readonly status: 'loading' | 'error' | 'ready'
  readonly projects: readonly RecentProject[]
  readonly openProjects: () => void
  readonly openLab: () => void
  readonly openSkills: () => void
  readonly createProject: () => void
  readonly enterProject: (workspaceId: string) => Promise<void>
}

/** Show existing facts and direct actions without creating project state. */
export function WorkbenchOverview({ status, projects, openProjects, openLab, openSkills, createProject, enterProject, renderSlot, t }: OverviewProps) {
  const [opening, setOpening] = useState<string>()
  const [error, setError] = useState<string>()
  const recent = projects.toSorted((left, right) => right.updatedAt - left.updatedAt).slice(0, 3)
  const open = (id: string): void => {
    setOpening(id)
    setError(undefined)
    void enterProject(id).catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : String(cause))
    }).finally(() => { setOpening(undefined) })
  }
  return <main className={css.overview}>
    <header className={css.pageHeader}>
      <div><span className={css.eyebrow}>{t('workbench.local')}</span><h1>{t('workbench.title')}</h1><p>{t('workbench.subtitle')}</p></div>
      <Button variant="primary" onClick={createProject}>{t('workbench.create')} <span aria-hidden="true">＋</span></Button>
    </header>
    <section className={css.modules} aria-label={t('workbench.nav')}>
      <article className={css.moduleCard}>
        <span className={css.moduleIcon}><WorkbenchIcon kind="overview" /></span>
        <h2>{t('workbench.projects')}</h2><p>{t('workbench.projectDescription')}</p>
        <div className={css.moduleMetric} aria-live="polite"><strong>{status === 'ready' ? projects.length : t(status === 'error' ? 'workbench.failed' : 'workbench.loading')}</strong>{status === 'ready' && <span>{t('workbench.projectUnit')}</span>}</div>
        <Button variant="outline" onClick={openProjects}>{t('workbench.openProjects')} <span aria-hidden="true">→</span></Button>
      </article>
      <article className={css.moduleCard}>
        <span className={css.moduleIcon}><WorkbenchIcon kind="lab" /></span>
        {renderSlot('fde.workbench.lab.summary', { openLab })}
      </article>
      <article className={css.moduleCard}>
        <span className={css.moduleIcon}><WorkbenchIcon kind="skills" /></span>
        <h2>{t('workbench.skills')}</h2><p>{t('workbench.skillsDescription')}</p>
        <div className={css.moduleMetric}><span className={css.pending}>{t('workbench.pending')}</span></div>
        <Button variant="outline" onClick={openSkills}>{t('workbench.openSkills')} <span aria-hidden="true">→</span></Button>
      </article>
    </section>
    <section className={css.recent} aria-label={t('workbench.recent')}>
      <header><div><h2>{t('workbench.recent')}</h2><p>{t('workbench.recentDescription')}</p></div><Button variant="ghost" onClick={openProjects}>{t('workbench.openProjects')} →</Button></header>
      {status === 'error' ? <p className={css.empty} role="alert">{t('workbench.projectFailure')}</p>
        : status === 'loading' ? <p className={css.empty} role="status">{t('workbench.loading')}</p>
          : recent.length === 0 ? <div className={css.empty}><h3>{t('workbench.noProjects')}</h3><p>{t('workbench.noProjectsDescription')}</p><Button variant="primary" onClick={createProject}>{t('workbench.create')}</Button><Button variant="ghost" onClick={openLab}>{t('lab.open')}</Button></div>
            : <ul>{recent.map(project => <li key={project.workspaceId}>
              <span className={css.projectMark} aria-hidden="true">{project.title.slice(0, 1)}</span>
              <div className={css.projectName}><strong>{project.title}</strong><span>{project.companyName || t('progress.companyMissing')}</span></div>
              <span className={css.projectStage}>{project.stage}</span>
              <Button variant="outline" disabled={opening !== undefined} onClick={() => { open(project.workspaceId) }}>{opening === project.workspaceId ? t('workbench.loading') : t('workbench.enter')} →</Button>
            </li>)}</ul>}
      {error !== undefined && <p className={css.error} role="alert">{error}</p>}
    </section>
    <footer className={css.footer}>{t('workbench.footer')}</footer>
  </main>
}

/** Present the agreed placeholder without querying or exposing Skills. */
export function SkillsCenterPlaceholder({ back, t }: PropsLocale<'fdeProject'> & { readonly back: () => void }) {
  return <main className={css.overview}>
    <header className={css.pageHeader}><div><span className={css.eyebrow}>{t('workbench.local')}</span><h1>{t('workbench.skills')}</h1><p>{t('workbench.skillsDescription')}</p></div></header>
    <section className={css.skillsEmpty}>
      <span className={css.skillsIcon}><WorkbenchIcon kind="skills" /></span>
      <span className={css.pending}>{t('workbench.pending')}</span>
      <h2>{t('workbench.skillsTitle')}</h2><p>{t('workbench.skillsBody')}</p>
      <small>{t('workbench.skillsExisting')}</small>
      <Button variant="outline" onClick={back}>{t('workbench.back')} →</Button>
    </section>
    <footer className={css.footer}>{t('workbench.footer')}</footer>
  </main>
}
