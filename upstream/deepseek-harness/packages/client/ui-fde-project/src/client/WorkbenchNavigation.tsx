/** Root module navigation, separate from project-scoped stage navigation. */
import { useLayoutEffect } from 'react'
import type { InjectFace, PropsLocale, PropsRenderSlots, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { ProjectPageInjected, ProjectProgressLauncherProps } from './slots.ts'
import css from './workbench.module.css'
import projectCss from './project.module.css'

type NavigationProps = PropsRuntime<'shell.overlay'>
  & PropsRenderSlots<'fde.workbench.lab.page' | 'sidebar.settings.shortcut'>
  & InjectFace<ProjectPageInjected> & PropsLocale<'fdeProject'>

/** A compact, consistent glyph for each platform destination. */
export function WorkbenchIcon({ kind }: { readonly kind: 'dashboard' | 'overview' | 'lab' | 'skills' | 'add' | 'arrow' }) {
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === 'dashboard' && <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></>}
    {kind === 'overview' && <><rect x="3" y="7" width="18" height="14" rx="2" /><path d="M8 7V4h8v3M3 12h18M10 12v3h4v-3" /></>}
    {kind === 'lab' && <><path d="M9 3h6M10 3v7L4.5 19a1.3 1.3 0 0 0 1.1 2h12.8a1.3 1.3 0 0 0 1.1-2L14 10V3M8 15h8" /><path d="M10 18h.01M14 18h.01" /></>}
    {kind === 'skills' && <><path d="m12 3 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 16l9 5 9-5" /></>}
    {kind === 'add' && <path d="M12 4v16M4 12h16" />}
    {kind === 'arrow' && <path d="M5 12h14m-6-6 6 6-6 6" />}
  </svg>
}

/** Render the shared rail and keep the lab occupant mounted across navigation. */
export function WorkbenchNavigation({ useProjectPage, showWorkbenchOverview, showProjectOverview, showWorkbenchLab, showWorkbenchSkills, showProjectHome, returnFromWorkbenchLab, renderSlot, t }: NavigationProps) {
  const page = useProjectPage(state => state)
  const visible = page.open && page.view !== 'home'
  const selected = page.view === 'timeline' || page.view === 'project' ? 'overview' : page.view
  useLayoutEffect(() => {
    if (!visible) return
    document.body.dataset.fdeWorkbench = 'open'
    return () => { delete document.body.dataset.fdeWorkbench }
  }, [visible])
  const items = [
    { id: 'dashboard', label: t('workbench.overview'), open: showWorkbenchOverview },
    { id: 'overview', label: t('workbench.projects'), open: showProjectOverview },
    { id: 'lab', label: t('workbench.lab'), open: showWorkbenchLab },
    { id: 'skills', label: t('workbench.skills'), open: showWorkbenchSkills },
  ] as const
  return <>
    {visible && <aside className={css.navigation}>
      <button type="button" className={css.brand} onClick={showWorkbenchOverview} title={t('workbench.brand')}>
        <img src="/ff-brand/ff-logo.png" alt={t('workbench.logo')} />
        <span>{t('workbench.brand')}</span>
      </button>
      <div className={css.workspaceLabel}><span />{t('workbench.local')}</div>
      <nav aria-label={t('workbench.nav')}>
        {items.map(item => <button key={item.id} type="button" className={css.navItem} aria-current={selected === item.id ? 'page' : undefined} title={item.label} onClick={item.open}>
          <WorkbenchIcon kind={item.id} /><span>{item.label}</span>
        </button>)}
      </nav>
      <div className={css.navBottom}>
        <button type="button" className={css.homeButton} onClick={showProjectHome} title={t('workbench.home')}><WorkbenchIcon kind="arrow" /><span>{t('workbench.home')}</span></button>
        <small>{t('workbench.footer')}</small>
        <div className={css.settingsEntry}>{renderSlot('sidebar.settings.shortcut', { wide: true })}</div>
      </div>
    </aside>}
    {renderSlot('fde.workbench.lab.page', { active: page.open && page.view === 'lab', back: returnFromWorkbenchLab })}
  </>
}

/** Retain the lab shortcut inside the existing project/session sidebar. */
export function WorkbenchLabLauncher({ wide, useProjectPage, showWorkbenchLab, t }: ProjectProgressLauncherProps) {
  const active = useProjectPage(state => state.view === 'lab')
  return <button type="button" className={projectCss.launcher} data-wide={wide || undefined} aria-label={t('lab.title')} aria-pressed={active} title={wide ? undefined : t('lab.title')} onClick={showWorkbenchLab}>
    <span className={projectCss.launcherIcon}><WorkbenchIcon kind="lab" /></span>
    {wide && <span className={projectCss.launcherLabel}>{t('lab.title')}</span>}
  </button>
}
