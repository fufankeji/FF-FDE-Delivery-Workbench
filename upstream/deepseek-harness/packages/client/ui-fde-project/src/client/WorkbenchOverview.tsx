/** Platform overview with independent project, lab and Skill-library entries. */
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
  return <main className={css.dashboard} data-overview-dashboard>
    <header className={css.dashboardHeader} data-overview-header>
      <div><span className={css.breadcrumb}>{t('workbench.local')} <span aria-hidden="true">/</span> {t('workbench.overview')}</span><h1>{t('workbench.title')}</h1><p>{t('workbench.subtitle')}</p></div>
      <Button className={css.createButton} variant="primary" onClick={createProject} data-overview-create><WorkbenchIcon kind="add" />{t('workbench.create')}</Button>
    </header>
    <div className={css.projectMetric} data-overview-project-metric aria-live="polite">
      <span className={css.metricIcon}><WorkbenchIcon kind="overview" /></span>
      {status === 'ready' ? <div><strong>{projects.length}</strong><span>{t('workbench.projectUnit')}</span></div> : <span className={css.metricStatus}>{t(status === 'error' ? 'workbench.failed' : 'workbench.loading')}</span>}
    </div>
    <section className={css.recent} aria-label={t('workbench.recent')} data-overview-recent>
      <header><div><h2>{t('workbench.recent')}{status === 'ready' && <span className={css.recentCount}>{recent.length}</span>}</h2><p>{t('workbench.recentDescription')}</p></div><Button className={css.projectsLink} variant="ghost" onClick={openProjects}>{t('workbench.openProjects')}<WorkbenchIcon kind="arrow" /></Button></header>
      {status === 'error' ? <p className={css.empty} role="alert">{t('workbench.projectFailure')}</p>
        : status === 'loading' ? <p className={css.empty} role="status">{t('workbench.loading')}</p>
          : recent.length === 0 ? <div className={css.empty}><h3>{t('workbench.noProjects')}</h3><p>{t('workbench.noProjectsDescription')}</p><Button variant="primary" onClick={createProject}>{t('workbench.create')}</Button><Button variant="ghost" onClick={openLab}>{t('lab.open')}</Button></div>
            : <ul>{recent.map((project, index) => <li key={project.workspaceId}>
              <span className={css.projectMark} data-variant={index} aria-hidden="true"><ProjectMark index={index} /></span>
              <div className={css.projectName}><strong title={project.title}>{project.title}</strong><span title={project.companyName || t('progress.companyMissing')} data-project-company>{project.companyName || t('progress.companyMissing')}</span></div>
              <div className={css.projectStage}><span>{t('workbench.currentStage')}</span><strong title={project.stage}>{project.stage}</strong></div>
              <Button className={css.enterButton} variant="outline" disabled={opening !== undefined} onClick={() => { open(project.workspaceId) }}>{opening === project.workspaceId ? t('workbench.loading') : t('workbench.enter')}<WorkbenchIcon kind="arrow" /></Button>
            </li>)}</ul>}
      {error !== undefined && <p className={css.error} role="alert">{error}</p>}
    </section>
    {renderSlot('fde.workbench.lab.summary', { openLab })}
    <article className={css.skillsCard} data-overview-skills>
      <header><span className={css.cardIcon}><WorkbenchIcon kind="skills" /></span><h2>{t('workbench.skills')}</h2><span className={css.pending}>{t('workbench.skillsAvailable')}</span></header>
      <p>{t('workbench.skillsDescription')}</p>
      <div className={css.cardAction}><Button className={css.skillsButton} variant="outline" onClick={openSkills}>{t('workbench.openSkills')}<WorkbenchIcon kind="arrow" /></Button></div>
    </article>
  </main>
}

/** Decorative row marks; they do not classify projects or change their order. */
function ProjectMark({ index }: { readonly index: number }) {
  return <svg viewBox="0 0 32 32" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {index === 0 ? <path strokeWidth="3" d="M7 27v-7M16 27V12M25 27V4" />
      : index === 1 ? <><path d="M4 28V11l12-8 12 8v17H4ZM12 28v-9h8v9M13 13h6" /></>
        : <><path d="M4 13v15h24V13M2 12l3-9h22l3 9M12 28v-9h8v9" /><path d="M2 12a4.7 4.7 0 0 0 9.3 0 4.7 4.7 0 0 0 9.4 0 4.7 4.7 0 0 0 9.3 0" /></>}
  </svg>
}
