/** Stage-one library: cards first, then one read-only Skill directory. */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Button, Input, MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { fetchStageSkillCatalog } from './stage-skill-catalog.ts'
import { saveSkillDownload, searchLibrary, skillArchive, stageOneLibrary, type LibrarySkill } from './skills-center-data.ts'
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
  const [selected, setSelected] = useState<LibrarySkill>()
  const [path, setPath] = useState('SKILL.md')
  const [downloadError, setDownloadError] = useState(false)
  const root = useRef<HTMLElement>(null)
  const reader = useRef<HTMLDivElement>(null)
  const listScroll = useRef(0)
  const openingId = useRef<string>()
  const file = selected?.files.find(item => item.path === path)
  const matches = catalog.status === 'ready' ? catalog.skills.filter(skill =>
    searchLibrary([skill], query).length > 0
    || t(`skills.summary.${skill.id}`).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  ) : []

  useEffect(() => {
    const abort = new AbortController()
    setCatalog({ status: 'loading' })
    void fetchStageSkillCatalog(abort.signal).then(value => {
      if (!abort.signal.aborted) setCatalog({ status: 'ready', skills: stageOneLibrary(value) })
    }).catch((error: unknown) => {
      if (!abort.signal.aborted) setCatalog({ status: 'error', message: error instanceof Error ? error.message : String(error) })
    })
    return () => abort.abort()
  }, [revision])

  useLayoutEffect(() => {
    if (root.current !== null) root.current.scrollTop = selected === undefined ? listScroll.current : 0
    if (selected !== undefined) reader.current?.focus()
    else if (openingId.current !== undefined) root.current?.querySelector<HTMLButtonElement>(`[data-skill-view="${openingId.current}"]`)?.focus({ preventScroll: true })
  }, [selected])

  const open = (skill: LibrarySkill): void => {
    listScroll.current = root.current?.scrollTop ?? 0
    openingId.current = skill.id
    setPath('SKILL.md')
    setDownloadError(false)
    setSelected(skill)
  }
  const selectFile = (nextPath: string): void => {
    setPath(nextPath)
    setDownloadError(false)
    if (root.current !== null) root.current.scrollTop = 0
  }
  const download = (skill: LibrarySkill, currentFile = false): void => {
    setDownloadError(false)
    try {
      if (currentFile) {
        if (file === undefined) throw new Error('Missing library file')
        saveSkillDownload(file.path, file.content, file.path.endsWith('.md') ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8')
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
    {downloadError && <div className={css.error} role="alert">{t('skills.downloadError')}</div>}
    {selected === undefined ? <>
      <section className={css.stageHeader} aria-labelledby="stage-one-skills-title">
        <div className={css.heading}><h2 id="stage-one-skills-title">{t('skills.stageTitle')}</h2><p>{t('skills.stageDescription')}</p></div>
        {catalog.status === 'ready' && <label className={css.search}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="10" cy="10" r="7" /><path d="m15 15 6 6" /></svg>
          <Input type="search" aria-label={t('skills.search')} placeholder={t('skills.search')} value={query} onChange={event => { setQuery(event.target.value); listScroll.current = 0 }} />
        </label>}
      </section>
      {catalog.status === 'loading' ? <p className={css.message} role="status">{t('workbench.loading')}</p>
        : catalog.status === 'error' ? <div className={css.message} role="alert"><p>{t('skills.loadError')}</p><small>{catalog.message}</small><Button variant="outline" onClick={() => setRevision(value => value + 1)}>{t('lab.retry')}</Button></div>
          : matches.length === 0 ? <div className={css.message} role="status"><p>{t('skills.noMatches')}</p><Button variant="outline" onClick={() => setQuery('')}>{t('skills.clear')}</Button></div>
            : <section className={css.grid} aria-label={t('skills.stageTitle')}>{matches.map(skill => <article className={css.card} key={skill.id} data-skill-card={skill.id} data-tone={skill.number}>
              <div className={css.cardTop}><span className={css.number}>{String(skill.number).padStart(2, '0')}</span><span className={css.icon}><SkillsCenterIcon number={skill.number} /></span></div>
              <div className={css.cardBody}><h3>{skill.label}</h3><p>{t(`skills.summary.${skill.id}`)}</p>
                <div className={css.actions}><Button variant="outline" data-skill-view={skill.id} onClick={() => open(skill)}>{t('skills.view')}</Button><Button variant="primary" onClick={() => download(skill)}>{t('skills.download')}</Button></div>
              </div>
            </article>)}</section>}
    </> : <section className={css.detail} aria-label={selected.label}>
      <div className={css.detailHeading}><div><Button variant="ghost" onClick={() => { setDownloadError(false); setSelected(undefined) }}>← {t('skills.back')}</Button><h2>{selected.label}</h2><p>{t('skills.adapter')}</p></div><Button variant="primary" onClick={() => download(selected)}>{t('skills.downloadPackage')}</Button></div>
      <div className={css.readerGrid}>
        <aside className={css.files} aria-label={t('skills.files')}><h3>{t('skills.files')}</h3><code className={css.folder}>{selected.id}/</code>
          <ul>{selected.files.map(item => <li key={item.path}><button type="button" aria-current={path === item.path ? 'page' : undefined} onClick={() => selectFile(item.path)}><span aria-hidden="true">▤</span>{item.path}</button></li>)}</ul>
          <p>{t('skills.readOnly')}</p>
        </aside>
        <div ref={reader} className={css.reader} tabIndex={-1}>
          <header className={css.fileHeader}><code>{selected.id}/{path}</code><Button variant="outline" disabled={file === undefined} onClick={() => download(selected, true)}>{t('skills.downloadFile')}</Button></header>
          {file === undefined ? <p className={css.message} role="alert">{t('skills.fileMissing')}</p>
            : <div className={css.markdown} data-skill-file={path}>{path.endsWith('.md')
              ? <><MarkdownText text={path === 'SKILL.md' ? file.content.replace(/^---\n[\s\S]*?\n---\n/, '') : file.content} labels={labels} fileMentions={{ resolve(value) {
                return selected.files.some(item => item.path === value) ? { open: () => selectFile(value), label: value, title: `${selected.id}/${value}` } : undefined
              } }} /></>
              : <pre>{file.content}</pre>}</div>}
        </div>
      </div>
    </section>}
  </main>
}
