/** Platform methods and original course packages share one read-only library. */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Button, Input, MarkdownText, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { fetchStageSkillCatalog } from './stage-skill-catalog.ts'
import { COURSE_SKILLS, resolveSkillFile, saveSkillDownload, searchLibrary, skillArchive, skillFileBytes, stageOneLibrary, type LibrarySkill } from './skills-center-data.ts'
import { SkillsCenterIcon } from './SkillsCenterIcon.tsx'
import css from './skills-center.module.css'

type CatalogState =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly message: string }
  | { readonly status: 'ready'; readonly skills: readonly LibrarySkill[] }

/** Render the fixed library without creating a project, installing a Skill or running an Agent. */
export function SkillsCenter({ t }: PropsLocale<'fdeProject'>) {
  const [catalog, setCatalog] = useState<CatalogState>({ status: 'loading' })
  const [revision, setRevision] = useState(0)
  const [query, setQuery] = useState('')
  const [sourceFilter, setSourceFilter] = useState<'all' | LibrarySkill['source']>('all')
  const [selected, setSelected] = useState<LibrarySkill>()
  const [path, setPath] = useState('SKILL.md')
  const [expanded, setExpanded] = useState(false)
  const [downloadError, setDownloadError] = useState(false)
  const root = useRef<HTMLElement>(null)
  const dialog = useRef<HTMLDivElement>(null)
  const reader = useRef<HTMLDivElement>(null)
  const openingId = useRef<string>()
  const file = selected?.files.find(item => item.path === path)
  const frontmatter = path.endsWith('.md') ? file?.content.match(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/)?.[0] ?? '' : ''
  const summary = (skill: LibrarySkill): string => skill.description
  const courseLabel = (skill: LibrarySkill): string => skill.source === 'course'
    ? `${t('skills.lesson', { number: skill.course.lessonNumber })} · ${skill.course.lessonTitle}` : t('skills.stageTitle')
  const available = [...(catalog.status === 'ready' ? catalog.skills : []), ...COURSE_SKILLS]
  const matches = available.filter(skill => (sourceFilter === 'all' || skill.source === sourceFilter)
    && (searchLibrary([skill], query).length > 0 || summary(skill).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())))

  useEffect(() => {
    const abort = new AbortController()
    setCatalog({ status: 'loading' })
    void fetchStageSkillCatalog(abort.signal).then((value) => {
      if (!abort.signal.aborted) setCatalog({ status: 'ready', skills: stageOneLibrary(value) })
    }).catch((error: unknown) => {
      if (!abort.signal.aborted) setCatalog({ status: 'error', message: error instanceof Error ? error.message : String(error) })
    })
    return () => { abort.abort() }
  }, [revision])

  useLayoutEffect(() => {
    const panel = dialog.current
    if (selected === undefined || panel === null) return
    const opener = root.current?.querySelector<HTMLButtonElement>(`[data-skill-view="${openingId.current}"]`)
    // Modal portals to body; keep every other body branch non-interactive until it closes.
    let layer: HTMLElement = panel
    while (layer.parentElement !== null && layer.parentElement !== document.body) layer = layer.parentElement
    const background = [...document.body.children].flatMap(element =>
      element instanceof HTMLElement && element !== layer ? [{ element, inert: element.getAttribute('inert') }] : [],
    )
    const overflow = document.body.style.overflow
    for (const { element } of background) element.setAttribute('inert', '')
    document.body.style.overflow = 'hidden'
    const containFocus = (event: FocusEvent): void => {
      if (event.target instanceof Node && !panel.contains(event.target)) panel.focus({ preventScroll: true })
    }
    document.addEventListener('focusin', containFocus)
    panel.focus({ preventScroll: true })
    return () => {
      document.removeEventListener('focusin', containFocus)
      for (const { element, inert } of background) {
        if (inert === null) element.removeAttribute('inert')
        else element.setAttribute('inert', inert)
      }
      document.body.style.overflow = overflow
      if (opener?.isConnected) opener.focus({ preventScroll: true })
    }
  }, [selected])

  const open = (skill: LibrarySkill): void => {
    openingId.current = `${skill.source}:${skill.id}`
    setPath(skill.entryPath)
    setExpanded(false)
    setDownloadError(false)
    setSelected(skill)
  }
  const close = (): void => {
    setDownloadError(false)
    setExpanded(false)
    setSelected(undefined)
  }
  const onReaderKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape' && expanded) {
      event.preventDefault()
      event.stopPropagation()
      setExpanded(false)
    }
    if (event.key !== 'Tab') return
    const controls = [...event.currentTarget.querySelectorAll<HTMLElement>(':is(button:not(:disabled), a[href], [tabindex="0"])')]
    const first = controls[0]
    const last = controls.at(-1)
    if (document.activeElement === event.currentTarget
      || (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
      event.preventDefault()
      const next = event.shiftKey ? last : first
      next?.focus()
    }
  }
  const selectFile = (nextPath: string): void => {
    setPath(nextPath)
    setDownloadError(false)
    if (reader.current !== null) reader.current.scrollTop = 0
  }
  const download = (skill: LibrarySkill, currentFile = false): void => {
    setDownloadError(false)
    try {
      if (currentFile) {
        if (file === undefined) throw new Error('Missing library file')
        const filename = file.path.split('/').at(-1) ?? file.path
        const content = file.encoding === 'base64' ? skillFileBytes(file) : file.content
        saveSkillDownload(filename, content, file.mediaType ?? (file.path.endsWith('.md') ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8'))
      } else saveSkillDownload(`${skill.id}.zip`, skillArchive(skill), 'application/zip')
    } catch {
      setDownloadError(true)
    }
  }
  const labels = { code: { copyLabel: t('skills.copy'), copiedLabel: t('skills.copied') }, footnotes: t('skills.footnotes') }

  return <main ref={root} className={css.center} data-skills-center>
    <header className={css.header}>
      <div className={css.heading}><h1>{t('workbench.skills')}</h1><p data-skills-tagline>{t('skills.tagline')}</p></div>
      <div className={css.brandNote}><p>{t('skills.statement')}</p><span>{t('workbench.footer')}</span></div>
    </header>
    {selected === undefined && downloadError && <div className={css.error} role="alert">{t('skills.downloadError')}</div>}
    <>
      <section className={css.stageHeader} aria-labelledby="skills-library-title">
        <div className={css.heading}><h2 id="skills-library-title">{t('skills.libraryTitle')}</h2><p>{t('skills.libraryDescription')}</p></div>
        <div className={css.catalogControls}>
          <div className={css.sourceFilter} role="group" aria-label={t('skills.sourceFilter')}>
            {(['all', 'platform', 'course'] as const).map(source => <Button key={source} variant="ghost" aria-pressed={sourceFilter === source} onClick={() => { setSourceFilter(source) }}>{t(`skills.source.${source}`)}</Button>)}
          </div>
          <label className={css.search}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="10" cy="10" r="7" /><path d="m15 15 6 6" /></svg>
            <Input type="search" aria-label={t('skills.search')} placeholder={t('skills.search')} value={query} onChange={(event) => { setQuery(event.target.value) }} />
          </label>
        </div>
      </section>
      {sourceFilter !== 'course' && (catalog.status === 'loading' ? <p className={css.message} role="status">{t('workbench.loading')}</p>
        : catalog.status === 'error' ? <div className={css.message} role="alert"><p>{t('skills.loadError')}</p><small>{catalog.message}</small><Button variant="outline" onClick={() => { setRevision(value => value + 1) }}>{t('lab.retry')}</Button></div> : null)}
      {matches.length > 0 ? <section className={css.grid} aria-label={t('skills.libraryTitle')}>{matches.map(skill => <article className={css.card} key={`${skill.source}:${skill.id}`} data-skill-card={skill.id} data-source={skill.source} data-tone={skill.source === 'platform' ? skill.number : undefined}>
        <div className={css.cardTop}><span className={css.number}>{skill.source === 'platform' ? String(skill.number).padStart(2, '0') : t('skills.lesson', { number: skill.course.lessonNumber })}</span><span className={css.sourceBadge} data-source={skill.source}>{t(`skills.source.${skill.source}`)}</span><span className={css.icon}><SkillsCenterIcon number={skill.source === 'platform' ? skill.number : 2} /></span></div>
        <div className={css.cardBody}><h3>{skill.label}</h3><p>{summary(skill)}</p>
          <div className={css.cardMeta} title={skill.source === 'course' ? `${skill.course.title} · ${courseLabel(skill)}` : courseLabel(skill)}>{courseLabel(skill)}</div>
          <div className={css.actions}><Button variant="outline" data-skill-view={`${skill.source}:${skill.id}`} onClick={() => { open(skill) }}>{t('skills.view')}</Button><Button variant="primary" onClick={() => { download(skill) }}>{t('skills.download')}</Button></div>
        </div>
      </article>)}</section>
        : (catalog.status === 'ready' || sourceFilter === 'course') && <div className={css.message} role="status"><p>{t('skills.noMatches')}</p><Button variant="outline" onClick={() => { setQuery('') }}>{t('skills.clear')}</Button></div>}
    </>
    {selected !== undefined && <Modal open onClose={close} title={selected.label} headless className={`${css.readerDialog}${expanded ? ` ${css.readerExpanded}` : ''}`}>
      <div ref={dialog} className={css.dialogBody} tabIndex={-1} onKeyDownCapture={onReaderKeyDown} data-skill-reader>
        <header className={css.detailHeading}>
          <div><h2>{selected.label}</h2></div>
          <div className={css.dialogActions}>
            <Button variant="outline" disabled={file === undefined} onClick={() => { download(selected, true) }}>{t('skills.downloadFile')}</Button>
            <Button variant="primary" onClick={() => { download(selected) }}>{t('skills.downloadPackage')}</Button>
            <Button variant="ghost" className={css.iconButton} aria-label={t(expanded ? 'skills.restore' : 'skills.expand')} title={t(expanded ? 'skills.restore' : 'skills.expand')} aria-pressed={expanded} onClick={() => { setExpanded(value => !value) }}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={expanded ? 'M9 3v6H3M15 21v-6h6M9 9 3 3M15 15l6 6' : 'M8 3H3v5M16 21h5v-5M3 3l6 6M21 21l-6-6'} /></svg>
            </Button>
            <Button variant="ghost" className={css.iconButton} aria-label={t('skills.close')} title={t('skills.close')} onClick={close}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
            </Button>
          </div>
        </header>
        {downloadError && <div className={css.dialogError} role="alert">{t('skills.downloadError')}</div>}
        <div className={css.reader}>
          {path !== selected.entryPath && <header className={css.fileHeader}>
            <Button variant="ghost" onClick={() => { selectFile(selected.entryPath) }}>{t('skills.backToContent')}</Button>
            <span>{path.split('/').at(-1)}</span>
          </header>}
          <div ref={reader} className={css.markdown} data-skill-file={path}>
            {file === undefined ? <p className={css.message} role="alert">{t('skills.fileMissing')}</p>
              : file.encoding === 'base64'
                ? file.mediaType === 'image/png'
                  ? <img className={css.resourceImage} src={`data:image/png;base64,${file.content}`} alt={file.path} />
                  : <object className={css.resourcePdf} data={`data:application/pdf;base64,${file.content}`} type="application/pdf" aria-label={file.path}><p>{t('skills.previewFallback')}</p></object>
                : path.endsWith('.md')
                  ? <MarkdownText text={file.content.slice(frontmatter.length)} labels={labels} pathImages={{ resolve(value) {
                    const target = resolveSkillFile(selected.files, path, value)
                    const image = selected.files.find(item => item.path === target)
                    return image?.mediaType === 'image/png' ? `data:image/png;base64,${image.content}` : undefined
                  } }} fileMentions={{ resolve(value) {
                    const target = selected.files.some(item => item.path === value)
                      ? value : resolveSkillFile(selected.files, path, value)
                    return target === undefined ? undefined : { open: () => { selectFile(target) }, label: value, title: `${selected.id}/${target}` }
                  } }} fileLinks={{ resolve(value) {
                    const target = resolveSkillFile(selected.files, path, value)
                    return target === undefined ? undefined : { open: () => { selectFile(target) }, title: `${selected.id}/${target}` }
                  } }} />
                  : <pre>{file.content}</pre>}
          </div>
        </div>
      </div>
    </Modal>}
  </main>
}
