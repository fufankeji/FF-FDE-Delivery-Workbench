/** Full Project Progress page beside the persistent project/session sidebar. */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, RefObject } from 'react'
import { readProjectMetadata, STAGE_NAMES } from './project-data.ts'
import { FDE_STAGES, type ProjectStageLoadState } from './stage-controller.ts'
import type { ProjectSourceItem, ProjectSourceLoadState } from './source-controller.ts'
import type { ProjectProgressOverlayProps, RequirementWikiRunTarget } from './slots.ts'
import { RequirementIssuePanel, RequirementWikiPanel } from './RequirementWikiPanel.tsx'
import type { RequirementWikiLoadState } from './wiki-controller.ts'
import css from './project.module.css'

interface ProjectRow {
  readonly workspaceId: string
  readonly title: string
  readonly path: string
  readonly createdAt: string
  readonly sessions: number
  readonly runningSessions: number
  readonly wikiSessionId?: string
  readonly companyName: string
  readonly schedule: ReturnType<typeof readProjectMetadata>['schedule']
  readonly stage: ProjectStageLoadState | undefined
}

function formatDate(value: string): string {
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric' }).format(date)
}

function formatBytes(value: number): string {
  if (value < 1024) return `${String(value)} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}

function currentStageIndex(stage: ProjectStageLoadState | undefined): number {
  return stage?.status === 'ready' ? FDE_STAGES.findIndex(item => item.id === stage.value.currentStage) : -1
}

function stageLabel(stage: ProjectStageLoadState | undefined, loading: string, failed: string): string {
  if (stage === undefined || stage.status === 'loading') return loading
  if (stage.status === 'error') return failed
  return STAGE_NAMES[stage.value.currentStage]
}

function StageBar({ stage }: { readonly stage: ProjectStageLoadState | undefined }) {
  const current = currentStageIndex(stage)
  return (
    <ol className={css.stageBar} aria-label="六阶段交付进度">
      {FDE_STAGES.map((definition, index) => (
        <li key={definition.id} data-state={current < 0 ? 'unknown' : index < current ? 'done' : index === current ? 'current' : 'pending'} title={STAGE_NAMES[definition.id]} />
      ))}
    </ol>
  )
}

function useSidebarOffset(open: boolean): [RefObject<HTMLDivElement>, number] {
  const ref = useRef<HTMLDivElement>(null)
  const [offset, setOffset] = useState(0)
  useLayoutEffect(() => {
    if (!open) return
    const overlay = ref.current?.parentElement
    const frame = overlay?.parentElement
    const sidebar = frame?.firstElementChild
    if (!(sidebar instanceof HTMLElement)) return
    const update = (): void => { setOffset(Math.round(sidebar.getBoundingClientRect().width)) }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(sidebar)
    return () => { observer.disconnect() }
  }, [open])
  return [ref, offset]
}

function useStandalonePage(open: boolean, rootRef: RefObject<HTMLDivElement>): void {
  useLayoutEffect(() => {
    if (!open) return
    document.body.dataset.fdePage = 'project-progress'
    const overlayHost = rootRef.current?.parentElement
    const details = overlayHost?.previousElementSibling
    const center = details?.previousElementSibling
    const hidden = [center, details].filter((item): item is HTMLElement => item instanceof HTMLElement)
    const previous = hidden.map(element => ({
      element,
      visibility: element.style.visibility,
      pointerEvents: element.style.pointerEvents,
      inert: element.inert,
      ariaHidden: element.getAttribute('aria-hidden'),
    }))
    for (const item of previous) {
      item.element.style.visibility = 'hidden'
      item.element.style.pointerEvents = 'none'
      item.element.inert = true
      item.element.setAttribute('aria-hidden', 'true')
    }
    return () => {
      delete document.body.dataset.fdePage
      for (const item of previous) {
        item.element.style.visibility = item.visibility
        item.element.style.pointerEvents = item.pointerEvents
        item.element.inert = item.inert
        if (item.ariaHidden === null) item.element.removeAttribute('aria-hidden')
        else item.element.setAttribute('aria-hidden', item.ariaHidden)
      }
    }
  }, [open, rootRef])
}

function ProjectCard({ row, showProject, labels }: {
  readonly row: ProjectRow
  readonly showProject: (workspaceId: string) => void
  readonly labels: {
    readonly companyMissing: string
    readonly scheduleMissing: string
    readonly view: string
    readonly created: (date: string) => string
    readonly loading: string
    readonly failed: string
  }
}) {
  const index = currentStageIndex(row.stage)
  const currentDefinition = index < 0 ? undefined : FDE_STAGES[index]
  const schedule = row.schedule.status === 'estimated'
    ? `${formatDate(row.schedule.startDate)} — ${formatDate(row.schedule.endDate)}`
    : labels.scheduleMissing
  return (
    <article className={css.projectCard}>
      <div className={css.projectCardTop}>
        <div className={css.projectIdentity}>
          <span className={css.projectMark} aria-hidden="true">{row.title.slice(0, 1).toUpperCase()}</span>
          <div><h2>{row.title}</h2><p>{row.companyName || labels.companyMissing}</p></div>
        </div>
        <span className={css.stageBadge} data-error={row.stage?.status === 'error' || undefined}>{stageLabel(row.stage, labels.loading, labels.failed)}</span>
      </div>
      <StageBar stage={row.stage} />
      <div className={css.stageNames}><span>需求调研</span><span>验收移交</span></div>
      <dl className={css.projectFacts}>
        <div><dt>交付周期</dt><dd>{schedule}</dd></div>
        <div><dt>当前阶段</dt><dd>{currentDefinition === undefined ? '—' : `${String(index + 1)}/6 · ${STAGE_NAMES[currentDefinition.id]}`}</dd></div>
        <div><dt>项目会话</dt><dd>{row.sessions} 个{row.runningSessions > 0 ? ` · ${String(row.runningSessions)} 个运行中` : ''}</dd></div>
      </dl>
      <div className={css.projectCardFoot}>
        <span>{labels.created(formatDate(row.createdAt))}</span>
        <button type="button" onClick={() => { showProject(row.workspaceId) }}>{labels.view}<span aria-hidden="true">→</span></button>
      </div>
    </article>
  )
}

function Timeline({ rows, showProject, todayLabel }: {
  readonly rows: readonly ProjectRow[]
  readonly showProject: (workspaceId: string) => void
  readonly todayLabel: string
}) {
  const scheduled = rows.filter((row): row is ProjectRow & { schedule: { status: 'estimated'; startDate: string; endDate: string } } => row.schedule.status === 'estimated')
  if (scheduled.length === 0) return <div className={css.timelineEmpty}>还没有已确认交付周期的项目。</div>
  const dates = scheduled.flatMap(row => [new Date(`${row.schedule.startDate}T00:00:00`).getTime(), new Date(`${row.schedule.endDate}T00:00:00`).getTime()])
  const day = 86_400_000
  const start = Math.min(...dates) - day * 2
  const end = Math.max(Math.max(...dates) + day * 2, start + day)
  const position = (value: number): number => Math.max(0, Math.min(100, (value - start) / (end - start) * 100))
  const now = Date.now()
  return (
    <div className={css.timelinePanel}>
      <div className={css.timelineScale}>
        <span>{formatDate(new Date(start).toISOString())}</span>
        <span>{formatDate(new Date(end).toISOString())}</span>
      </div>
      <div className={css.timelineRows}>
        {now >= start && now <= end && (
          <div className={css.todayLine} style={{ '--timeline-today': String(position(now) / 100) } as CSSProperties}><span>{todayLabel}</span></div>
        )}
        {scheduled.map((row) => {
          const rowStart = new Date(`${row.schedule.startDate}T00:00:00`).getTime()
          const rowEnd = new Date(`${row.schedule.endDate}T00:00:00`).getTime()
          return (
            <button key={row.workspaceId} type="button" className={css.timelineRow} onClick={() => { showProject(row.workspaceId) }}>
              <span className={css.timelineName}>{row.title}<small>{row.companyName || '未填写所属企业'}</small></span>
              <span className={css.timelineTrack}>
                <span className={css.timelineBar} style={{ left: `${String(position(rowStart))}%`, width: `${String(Math.max(2, position(rowEnd) - position(rowStart)))}%` }}>
                  <span>{stageLabel(row.stage, '读取中', '读取失败')}</span>
                </span>
              </span>
              <span className={css.timelineDates}>{formatDate(row.schedule.startDate)} — {formatDate(row.schedule.endDate)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function parseLabel(source: ProjectSourceItem): string {
  const labels = {
    pending: '待识别', processing: '识别中', ready: '已识别', 'needs-ocr': '需要 OCR',
    unsupported: '暂不支持识别', error: '识别失败', stale: '需要重新识别',
  } as const
  return labels[source.parse.status]
}

function sourceStateLabel(source: ProjectSourceItem): string {
  const preview = source.previewKind === 'unsupported' ? '不支持预览' : '可预览'
  return `${preview} · ${parseLabel(source)}`
}

function ProjectDetail({
  row, sourceState, wikiState, selectedSource, selectSource, parseSource,
  prepareWiki, startWiki, abandonWiki, refreshWiki, enterProject, back, renderPreview,
}: {
  readonly row: ProjectRow
  readonly sourceState: ProjectSourceLoadState | undefined
  readonly wikiState: RequirementWikiLoadState | undefined
  readonly selectedSource: ProjectSourceItem | undefined
  readonly selectSource: (sourceId: string) => void
  readonly parseSource: (sourceId: string) => void
  readonly prepareWiki: (sessionId: string) => Promise<RequirementWikiRunTarget>
  readonly startWiki: (
    sourceIds: readonly string[],
    expectedRevision: number,
    target: RequirementWikiRunTarget,
  ) => Promise<void>
  readonly abandonWiki: (buildId: string) => Promise<void>
  readonly refreshWiki: () => void
  readonly enterProject: () => void
  readonly back: () => void
  readonly renderPreview: (source: ProjectSourceItem) => React.ReactNode
}) {
  const [section, setSection] = useState<'inputs' | 'wiki' | 'conflicts' | 'unknowns'>('inputs')
  useEffect(() => { setSection('inputs') }, [row.workspaceId])
  const canParse = selectedSource !== undefined && ['pending', 'error', 'stale'].includes(selectedSource.parse.status)
  const openSource = (sourceId: string): void => { selectSource(sourceId); setSection('inputs') }
  return (
    <main className={css.detailPage}>
      <div className={css.detailBreadcrumb}><button type="button" onClick={back}>← 返回全部项目</button></div>
      <section className={css.detailHeader}>
        <div className={css.projectIdentity}>
          <span className={css.projectMark} aria-hidden="true">{row.title.slice(0, 1).toUpperCase()}</span>
          <div><h1>{row.title}</h1><p>{row.companyName || '未填写所属企业'} · {stageLabel(row.stage, '读取阶段中', '阶段读取失败')}</p></div>
        </div>
        <button type="button" className={css.enterDeliveryButton} onClick={enterProject}>进入项目交付 <span aria-hidden="true">→</span></button>
      </section>
      <StageBar stage={row.stage} />
      <nav className={css.detailSections} aria-label="项目详情">
        <button type="button" data-active={section === 'inputs' || undefined} onClick={() => { setSection('inputs') }}>
          原始资料 <span>{sourceState?.files.length ?? 0}</span>
        </button>
        <button type="button" data-active={section === 'wiki' || undefined} onClick={() => { setSection('wiki') }}>
          需求知识图谱
        </button>
        <button type="button" data-active={section === 'conflicts' || undefined} onClick={() => { setSection('conflicts') }}>
          冲突与缺口 <span>{wikiState?.value?.current?.conflicts.length ?? 0}</span>
        </button>
        <button type="button" data-active={section === 'unknowns' || undefined} onClick={() => { setSection('unknowns') }}>
          待确认事项 <span>{wikiState?.value?.current?.unknowns.length ?? 0}</span>
        </button>
      </nav>
      {section === 'wiki' && (
        <RequirementWikiPanel
          workspaceId={row.workspaceId}
          runSessionId={row.wikiSessionId}
          wikiState={wikiState}
          sourceState={sourceState}
          onPrepare={prepareWiki}
          onStart={startWiki}
          onAbandon={abandonWiki}
          onRefresh={refreshWiki}
          onOpenSource={openSource}
        />
      )}
      {section === 'conflicts' && (
        <RequirementIssuePanel kind="conflicts" wikiState={wikiState} onOpenSource={openSource} />
      )}
      {section === 'unknowns' && (
        <RequirementIssuePanel kind="unknowns" wikiState={wikiState} onOpenSource={openSource} />
      )}
      {section === 'inputs' && <div className={css.detailLayout}>
        <aside className={css.sourcePanel}>
          <div className={css.sourcePanelHeader}>
            <div><h2>项目资料</h2><span>客户原始文件与本地识别状态</span></div>
            <strong>{sourceState?.files.length ?? 0}</strong>
          </div>
          {sourceState === undefined || sourceState.status === 'loading'
            ? <div className={css.sourceState}>正在读取项目资料…</div>
            : sourceState.status === 'error'
              ? <div className={css.sourceState} data-error>{sourceState.message}</div>
              : sourceState.files.length === 0
                ? <div className={css.sourceState}>还没有项目资料。请从左侧项目行添加。</div>
                : <div className={css.sourceList}>{sourceState.files.map(source => (
                  <button key={source.sourceId} type="button" data-active={selectedSource?.sourceId === source.sourceId || undefined} onClick={() => { selectSource(source.sourceId) }}>
                    <span className={css.sourceExtension}>{source.extension || 'FILE'}</span>
                    <span className={css.sourceText}>
                      <strong>{source.storedName}</strong>
                      <small>{formatBytes(source.bytes)} · {sourceStateLabel(source)}</small>
                    </span>
                  </button>
                ))}</div>}
        </aside>
        <section className={css.previewPanel}>
          {selectedSource === undefined
            ? <div className={css.previewEmpty}><strong>选择一份项目资料</strong><span>这里会显示只读预览和真实处理状态。</span></div>
            : <>
              <header className={css.previewHeader}>
                <div><h2>{selectedSource.storedName}</h2><span>{selectedSource.mimeType} · {formatBytes(selectedSource.bytes)}</span></div>
                <div className={css.previewActions}>
                  <span className={css.sourceStatus} data-status={selectedSource.parse.status}>{parseLabel(selectedSource)}</span>
                  {canParse && <button type="button" onClick={() => { parseSource(selectedSource.sourceId) }}>本地识别</button>}
                  <a href={selectedSource.fileUrl} download={selectedSource.storedName}>下载原件</a>
                </div>
              </header>
              {selectedSource.parse.message !== undefined && <div className={css.sourceNotice}>{selectedSource.parse.message}</div>}
              <div className={css.previewBody}>{renderPreview(selectedSource)}</div>
            </>}
        </section>
      </div>}
    </main>
  )
}

/** Render the global full page while retaining the ordinary project/session sidebar. */
export function ProjectProgressOverlay({
  useProjectPage, useStageProgress, useProjectSources, useRequirementWiki, useWorkspaces, useSessions,
  loadStage, retryStage, loadProjectSources, parseProjectSource, loadRequirementWiki,
  prepareRequirementWikiRun, startRequirementWikiBuild, abandonRequirementWikiBuild, enterProject,
  closeProjectPage, showProjectOverview, showProjectTimeline, showProjectDetail,
  renderSlot, t,
}: ProjectProgressOverlayProps) {
  const page = useProjectPage(state => state)
  const workspaces = useWorkspaces(state => state.items)
  const sessions = useSessions(state => state)
  const stages = useStageProgress(state => state.byWorkspace)
  const sources = useProjectSources(state => state.byWorkspace)
  const requirementWikis = useRequirementWiki(state => state.byWorkspace)
  const [selectedSourceId, setSelectedSourceId] = useState<string | undefined>()
  const [rootRef, sidebarOffset] = useSidebarOffset(page.open)
  useStandalonePage(page.open, rootRef)

  useEffect(() => {
    if (!page.open) return
    for (const workspace of workspaces) loadStage(String(workspace.workspaceId))
  }, [loadStage, page.open, workspaces])

  useEffect(() => {
    if (page.view !== 'project' || page.workspaceId === undefined) return
    setSelectedSourceId(undefined)
    loadProjectSources(page.workspaceId)
    loadRequirementWiki(page.workspaceId)
  }, [loadProjectSources, loadRequirementWiki, page.view, page.workspaceId])

  useEffect(() => {
    if (page.view !== 'project' || page.workspaceId === undefined) return
    const build = requirementWikis[page.workspaceId]?.value?.build
    if (build === null || build === undefined || (build.status !== 'queued' && build.status !== 'running')) return
    const workspaceId = page.workspaceId
    const timer = window.setInterval(() => { loadRequirementWiki(workspaceId, true) }, 2_500)
    return () => { window.clearInterval(timer) }
  }, [loadRequirementWiki, page.view, page.workspaceId, requirementWikis])

  useEffect(() => {
    if (page.view !== 'project' || page.workspaceId === undefined || selectedSourceId !== undefined) return
    const first = sources[page.workspaceId]?.files[0]
    if (first !== undefined) setSelectedSourceId(first.sourceId)
  }, [page.view, page.workspaceId, selectedSourceId, sources])

  useEffect(() => {
    if (!page.open) return
    const onKey = (event: KeyboardEvent): void => { if (event.key === 'Escape') closeProjectPage() }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey) }
  }, [closeProjectPage, page.open])

  const rows = useMemo<readonly ProjectRow[]>(() => workspaces.map((workspace) => {
    const workspaceSessions = workspace.sessionIds.map(id => sessions.byId[id]).filter(item => item !== undefined)
    const wikiSessionId = workspaceSessions.find(item => item.origin !== 'subagent')?.id
    const metadata = readProjectMetadata(workspace.path)
    return {
      workspaceId: String(workspace.workspaceId), title: workspace.title, path: workspace.path,
      createdAt: workspace.createdAt, sessions: workspaceSessions.length,
      runningSessions: workspaceSessions.filter(item => item.running).length,
      ...(wikiSessionId === undefined ? {} : { wikiSessionId: String(wikiSessionId) }),
      companyName: metadata.companyName, schedule: metadata.schedule,
      stage: stages[String(workspace.workspaceId)],
    }
  }), [sessions.byId, stages, workspaces])

  if (!page.open) return null
  const detailRow = page.workspaceId === undefined ? undefined : rows.find(row => row.workspaceId === page.workspaceId)
  const sourceState = page.workspaceId === undefined ? undefined : sources[page.workspaceId]
  const wikiState = page.workspaceId === undefined ? undefined : requirementWikis[page.workspaceId]
  const selectedSource = sourceState?.files.find(source => source.sourceId === selectedSourceId)
  const pendingSchedules = rows.filter(row => row.schedule.status === 'pending-confirmation').length
  const activeSessions = rows.reduce((total, row) => total + row.runningSessions, 0)
  const sessionCount = rows.reduce((total, row) => total + row.sessions, 0)

  return (
    <div ref={rootRef} className={css.pageOverlay} style={{ left: sidebarOffset, width: `calc(100% - ${String(sidebarOffset)}px)` }} data-testid="fde-project-progress">
      <header className={css.pageHeader}>
        <div><span className={css.pageEyebrow}>FF-FDE 工作台</span><h1>{t('progress.title')}</h1><p>{t('progress.subtitle')}</p></div>
        <button type="button" className={css.closeButton} aria-label={t('progress.close')} onClick={closeProjectPage}>×</button>
      </header>

      {page.view === 'project' && detailRow !== undefined
        ? <ProjectDetail
          row={detailRow}
          sourceState={sourceState}
          wikiState={wikiState}
          selectedSource={selectedSource}
          selectSource={setSelectedSourceId}
          parseSource={(sourceId) => {
            void parseProjectSource(detailRow.workspaceId, sourceId)
              .then(() => { loadRequirementWiki(detailRow.workspaceId, true) })
              .catch(() => undefined)
          }}
          prepareWiki={async (sessionId) => {
            return await prepareRequirementWikiRun(detailRow.workspaceId, sessionId)
          }}
          startWiki={async (sourceIds, expectedRevision, target) => {
            await startRequirementWikiBuild(detailRow.workspaceId, sourceIds, expectedRevision, target)
          }}
          abandonWiki={async (buildId) => {
            await abandonRequirementWikiBuild(detailRow.workspaceId, buildId)
          }}
          refreshWiki={() => { loadRequirementWiki(detailRow.workspaceId, true) }}
          enterProject={() => { void enterProject(detailRow.workspaceId) }}
          back={showProjectOverview}
          renderPreview={source => renderSlot('fde.project.source.preview', { source })}
        />
        : <main className={css.pageBody}>
          <section className={css.summaryGrid} aria-label="项目汇总">
            <article><span>{t('progress.total')}</span><strong>{rows.length}</strong><small>全部交付项目</small></article>
            <article><span>{t('progress.active')}</span><strong>{activeSessions}</strong><small>正在运行的会话</small></article>
            <article><span>{t('progress.schedulePending')}</span><strong>{pendingSchedules}</strong><small>需要与客户确认</small></article>
            <article><span>{t('progress.sessions')}</span><strong>{sessionCount}</strong><small>项目内全部会话</small></article>
          </section>
          <div className={css.pageToolbar}>
            <div><h2>全部项目</h2><span>阶段来自项目记录，周期来自新建项目时填写的信息。</span></div>
            <div className={css.segmented}>
              <button type="button" data-active={page.view === 'overview' || undefined} onClick={showProjectOverview}>{t('progress.overview')}</button>
              <button type="button" data-active={page.view === 'timeline' || undefined} onClick={showProjectTimeline}>{t('progress.timeline')}</button>
            </div>
          </div>
          {rows.length === 0
            ? <div className={css.pageEmpty}>{t('progress.empty')}</div>
            : page.view === 'timeline'
              ? <Timeline rows={rows} showProject={showProjectDetail} todayLabel={t('progress.today')} />
              : <div className={css.projectGrid}>{rows.map(row => (
                <ProjectCard key={row.workspaceId} row={row} showProject={showProjectDetail} labels={{
                  companyMissing: t('progress.companyMissing'), scheduleMissing: t('progress.scheduleMissing'),
                  view: t('progress.viewProject'), created: date => t('progress.createdAt', { date }),
                  loading: t('progress.stageLoading'), failed: t('progress.stageError'),
                }} />
              ))}</div>}
          {Object.values(stages).some(stage => stage.status === 'error') && (
            <button type="button" className={css.retryAll} onClick={() => { for (const row of rows) if (row.stage?.status === 'error') retryStage(row.workspaceId) }}>重新读取失败的项目阶段</button>
          )}
        </main>}
    </div>
  )
}
