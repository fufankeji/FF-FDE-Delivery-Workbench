/** Sidebar entry for the root project-progress page. */

import type { ProjectProgressLauncherProps } from './slots.ts'
import css from './project.module.css'

function ProjectManagementIcon() {
  return (
    <svg viewBox="0 0 20 20" width="19" height="19" aria-hidden="true">
      <path d="M3.25 6.25h13.5v8.25A1.5 1.5 0 0 1 15.25 16H4.75a1.5 1.5 0 0 1-1.5-1.5V6.25Z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M6.5 6.25V5a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v1.25M3.25 9h13.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M6.25 11.65h.01m2.15 0h5.3m-7.46 2.1h.01m2.15 0h3.65" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

/** Render a wide sidebar row or compact rail icon from the same action. */
export function ProjectProgressLauncher({ wide, useProjectPage, openProjectPage, t }: ProjectProgressLauncherProps) {
  const active = useProjectPage(state => state.open && ['overview', 'timeline', 'project'].includes(state.view))
  return (
    <button
      type="button"
      className={css.launcher}
      data-wide={wide || undefined}
      data-active={active || undefined}
      aria-label={t('launcher.label')}
      aria-pressed={active}
      title={wide ? undefined : t('launcher.label')}
      onClick={openProjectPage}
    >
      <span className={css.launcherIcon}><ProjectManagementIcon /></span>
      {wide && <span className={css.launcherLabel}>{t('launcher.label')}</span>}
    </button>
  )
}
