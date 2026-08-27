/** Sidebar entry for the root project-progress page. */

import type { ProjectProgressLauncherProps } from './slots.ts'
import css from './project.module.css'

function ProgressIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
      <path d="M3.5 15.5V10m6.5 5.5v-11m6.5 11V7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="m3.5 7.5 5-3 4 2 4-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Render a wide sidebar row or compact rail icon from the same action. */
export function ProjectProgressLauncher({ wide, useProjectPage, openProjectPage, t }: ProjectProgressLauncherProps) {
  const open = useProjectPage(state => state.open)
  return (
    <button
      type="button"
      className={css.launcher}
      data-wide={wide || undefined}
      data-active={open || undefined}
      aria-label={t('launcher.label')}
      aria-pressed={open}
      title={wide ? undefined : t('launcher.label')}
      onClick={openProjectPage}
    >
      <ProgressIcon />
      {wide && <span>{t('launcher.label')}</span>}
    </button>
  )
}
