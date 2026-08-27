/** Project-detail requirement Wiki, explicit build confirmation, and traceable issue lists. */

import { MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives'
import { useEffect, useMemo, useRef, useState } from 'react'
import { RequirementGalaxyView, REQUIREMENT_WIKI_TOPIC_LABELS } from './RequirementGalaxyView.tsx'
import type { ProjectSourceItem, ProjectSourceLoadState } from './source-controller.ts'
import type { RequirementWikiRunTarget } from './slots.ts'
import type {
  RequirementWikiIssue,
  RequirementWikiLoadState,
  RequirementWikiPage,
  RequirementWikiSnapshot,
} from './wiki-controller.ts'
import css from './project.module.css'

interface RequirementWikiPanelProps {
  readonly workspaceId: string
  readonly runSessionId: string | undefined
  readonly wikiState: RequirementWikiLoadState | undefined
  readonly sourceState: ProjectSourceLoadState | undefined
  readonly onPrepare: (sessionId: string) => Promise<RequirementWikiRunTarget>
  readonly onStart: (
    sourceIds: readonly string[],
    expectedRevision: number,
    target: RequirementWikiRunTarget,
  ) => Promise<void>
  readonly onAbandon: (buildId: string) => Promise<void>
  readonly onRefresh: () => void
  readonly onOpenSource: (sourceId: string) => void
}

function buildLabel(status: NonNullable<RequirementWikiSnapshot['build']>['status']): string {
  if (status === 'queued') return '等待 Agent'
  if (status === 'running') return '整理中'
  if (status === 'succeeded') return '已发布'
  if (status === 'cancelled') return '已结束'
  return '整理失败'
}

function sourceName(sourceId: string, snapshot: RequirementWikiSnapshot | undefined): string {
  return snapshot?.current?.sources.find(source => source.sourceId === sourceId)?.storedName ?? sourceId
}

function SourceButtons({ sourceIds, snapshot, onOpenSource }: {
  readonly sourceIds: readonly string[]
  readonly snapshot: RequirementWikiSnapshot | undefined
  readonly onOpenSource: (sourceId: string) => void
}) {
  return (
    <div className={css.wikiSourceChips} aria-label="知识来源">
      {sourceIds.map(sourceId => <button key={sourceId} type="button" onClick={() => { onOpenSource(sourceId) }}>来源 · {sourceName(sourceId, snapshot)}</button>)}
    </div>
  )
}

function WikiPageDetail({ page, snapshot, onOpenSource }: {
  readonly page: RequirementWikiPage
  readonly snapshot: RequirementWikiSnapshot | undefined
  readonly onOpenSource: (sourceId: string) => void
}) {
  const relations = snapshot?.current?.relations.filter(relation => relation.from === page.id || relation.to === page.id) ?? []
  const pages = new Map(snapshot?.current?.pages.map(item => [item.id, item]) ?? [])
  return (
    <article className={css.wikiPageDetail}>
      <header>
        <span>{REQUIREMENT_WIKI_TOPIC_LABELS[page.topic]}</span>
        <h3>{page.title}</h3>
        {page.summary !== undefined && <p>{page.summary}</p>}
      </header>
      <div className={css.wikiMarkdown}><MarkdownText text={page.body} /></div>
      <SourceButtons sourceIds={page.sourceIds} snapshot={snapshot} onOpenSource={onOpenSource} />
      {relations.length > 0 && (
        <div className={css.wikiRelations}>
          <h4>关联知识</h4>
          <ul>{relations.map((relation) => {
            const other = relation.from === page.id ? relation.to : relation.from
            return (
              <li key={relation.id}>
                <span>{relation.label ?? relation.type}</span><strong>{pages.get(other)?.title ?? other}</strong>
              </li>
            )
          })}</ul>
        </div>
      )}
    </article>
  )
}

/** Render the candidate Wiki and require a second confirmation before any Agent prompt. */
export function RequirementWikiPanel({
  workspaceId, runSessionId, wikiState, sourceState, onPrepare, onStart, onAbandon, onRefresh, onOpenSource,
}: RequirementWikiPanelProps) {
  const snapshot = wikiState?.value ?? undefined
  const current = snapshot?.current ?? undefined
  const activeBuild = snapshot?.build !== null && snapshot?.build !== undefined
    && (snapshot.build.status === 'queued' || snapshot.build.status === 'running')
    ? snapshot.build
    : undefined
  const available = useMemo(() => sourceState?.files.filter((source): source is ProjectSourceItem & { parse: ProjectSourceItem['parse'] & { status: 'ready'; derivedPath: string } } => (
    source.parse.status === 'ready' && source.parse.derivedPath !== undefined
  )) ?? [], [sourceState?.files])
  const [selectedSources, setSelectedSources] = useState<ReadonlySet<string>>(new Set())
  const [selectedPageId, setSelectedPageId] = useState<string | undefined>()
  const [showSourcePicker, setShowSourcePicker] = useState(false)
  const [confirmation, setConfirmation] = useState<{
    readonly sourceIds: readonly string[]
    readonly target: RequirementWikiRunTarget
  } | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState('')
  const preparationGeneration = useRef(0)

  useEffect(() => {
    setSelectedSources(new Set())
    setSelectedPageId(undefined)
    setShowSourcePicker(false)
    setConfirmation(null)
    setPreparing(false)
    setNotice('')
    preparationGeneration.current += 1
  }, [workspaceId])

  useEffect(() => {
    if (current === undefined) {
      if (wikiState?.status === 'ready' && snapshot?.current === null) setShowSourcePicker(true)
      setSelectedPageId(undefined)
      return
    }
    if (selectedPageId === undefined || !current.pages.some(page => page.id === selectedPageId)) {
      setSelectedPageId(current.pages[0]?.id)
    }
  }, [current, selectedPageId, snapshot?.current, wikiState?.status])

  const selectedPage = current?.pages.find(page => page.id === selectedPageId)
  const toggleSource = (sourceId: string): void => {
    setSelectedSources((previous) => {
      const next = new Set(previous)
      if (next.has(sourceId)) next.delete(sourceId)
      else next.add(sourceId)
      return next
    })
  }
  const prepare = (): void => {
    if (selectedSources.size === 0 || runSessionId === undefined || preparing || submitting || activeBuild !== undefined) return
    const generation = ++preparationGeneration.current
    const sourceIds = [...selectedSources]
    setPreparing(true)
    setNotice('')
    void onPrepare(runSessionId).then(
      (target) => { if (preparationGeneration.current === generation) setConfirmation({ sourceIds, target }) },
      (error: unknown) => {
        if (preparationGeneration.current === generation) {
          setNotice(error instanceof Error ? error.message : String(error))
        }
      },
    ).finally(() => { if (preparationGeneration.current === generation) setPreparing(false) })
  }
  const run = (): void => {
    if (confirmation === null || submitting || activeBuild !== undefined) return
    const confirmed = confirmation
    setConfirmation(null)
    setSubmitting(true)
    setNotice('')
    void onStart(confirmed.sourceIds, current?.revision ?? 0, confirmed.target).then(
      () => { setNotice('整理任务已提交到当前项目 Agent；只有完整 Wiki 发布后才会出现新版本。'); setShowSourcePicker(false) },
      (error: unknown) => { setNotice(error instanceof Error ? error.message : String(error)) },
    ).finally(() => { setSubmitting(false) })
  }

  return (
    <section className={css.wikiRoot}>
      <div className={css.wikiHeader}>
        <div>
          <span className={css.candidateBadge}>候选理解</span>
          <h2>需求知识图谱</h2>
          <p>把散落资料整理为可追溯的知识页、关系、冲突和未知项；查看不会自动确认需求或推进项目阶段。</p>
        </div>
        <div className={css.wikiHeaderActions}>
          {current !== undefined && <span className={css.wikiRevision} data-stale={snapshot?.status === 'stale' || undefined}>R{current.revision} · {snapshot?.status === 'stale' ? '待更新' : '已整理'}</span>}
          <button type="button" onClick={onRefresh}>刷新</button>
          <button type="button" disabled={activeBuild !== undefined} onClick={() => { setShowSourcePicker(value => !value) }}>{current === undefined ? '选择资料' : '更新需求知识'}</button>
        </div>
      </div>

      {wikiState?.status === 'loading' && <p className={css.wikiInlineState}>正在读取需求知识…</p>}
      {wikiState?.status === 'error' && <p className={css.wikiInlineState} data-error>{wikiState.message}</p>}
      {snapshot?.message !== undefined && snapshot.current === null && <p className={css.wikiInlineState}>{snapshot.message}</p>}
      {notice !== '' && <p className={css.actionNotice} role="status">{notice}</p>}

      {activeBuild !== undefined && (
        <div className={css.wikiBuildState} data-status={activeBuild.status}>
          <div>
            <strong>{buildLabel(activeBuild.status)}</strong>
            <p>固定输入 {activeBuild.sources.length} 份资料 · 基于 R{activeBuild.expectedRevision}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              void onAbandon(activeBuild.id).catch((error: unknown) => {
                setNotice(error instanceof Error ? error.message : String(error))
              })
            }}
          >结束本次整理</button>
        </div>
      )}
      {snapshot?.build?.status === 'failed' && (
        <div className={css.wikiBuildState} data-status="failed"><div><strong>上次整理失败</strong><p>{snapshot.build.message ?? '没有发布半成品，上一有效版本保持不变。'}</p></div></div>
      )}
      {snapshot?.build?.status === 'cancelled' && (
        <div className={css.wikiBuildState} data-status="cancelled"><div><strong>本次整理已结束</strong><p>{snapshot.build.message ?? '当前需求知识版本没有变化。'}</p></div></div>
      )}

      {showSourcePicker && (
        <section className={css.wikiSourcePicker}>
          <div><h3>选择本次整理的资料</h3><p>只会把你勾选且“已识别”的派生文本交给当前项目 Agent。</p></div>
          {available.length === 0
            ? <p className={css.wikiInlineState}>当前没有可整理的资料，请先到“原始资料”完成本地识别。</p>
            : <div className={css.wikiSourceChoices}>{available.map(source => (
              <label key={source.sourceId}>
                <input type="checkbox" disabled={preparing || confirmation !== null} checked={selectedSources.has(source.sourceId)} onChange={() => { toggleSource(source.sourceId) }} />
                <span><strong>{source.storedName}</strong><small>{source.parse.derivedPath}</small></span>
              </label>
            ))}</div>}
          {runSessionId === undefined && <p className={css.wikiInlineState}>当前项目没有可用会话，请先进入项目交付建立会话并选择模型。</p>}
          <div className={css.wikiSourcePickerFoot}>
            <span>已选择 {selectedSources.size} 份</span>
            <button
              type="button"
              disabled={selectedSources.size === 0 || runSessionId === undefined || preparing || submitting || activeBuild !== undefined}
              onClick={prepare}
            >{preparing ? '正在读取模型…' : submitting ? '正在提交…' : current === undefined ? '整理需求知识' : '更新需求知识'}</button>
          </div>
        </section>
      )}

      {confirmation !== null && (
        <div className={css.runConfirmation} role="dialog" aria-label="确认整理需求知识">
          <div>
            <strong>确认整理 {confirmation.sourceIds.length} 份项目资料</strong>
            <p>目标会话：{confirmation.target.sessionId}</p>
            <p>
              Provider：{confirmation.target.providerName}（{confirmation.target.provider}） ·
              模型：{confirmation.target.modelName}（{confirmation.target.model}）
            </p>
            <p>确认后该项目 Agent 会读取所选派生文本，可能产生模型费用，并把资料发送给上述 Provider。结果始终是候选理解。</p>
          </div>
          <div>
            <button type="button" className={css.secondaryButton} onClick={() => { setConfirmation(null) }}>暂不整理</button>
            <button type="button" className={css.primaryButton} onClick={run}>确认并整理</button>
          </div>
        </div>
      )}

      {current === undefined
        ? !showSourcePicker && (
          <div className={css.wikiEmpty}>
            <strong>尚未整理需求知识</strong>
            <p>选择已经本地识别的客户资料，Agent 会把它们梳理成可追溯的候选 Wiki 和 Galaxy View。</p>
          </div>
        )
        : <div className={css.wikiGalaxyLayout}>
          <RequirementGalaxyView
            revision={current.revision}
            pages={current.pages}
            relations={current.relations}
            selectedPageId={selectedPageId}
            onSelectPage={setSelectedPageId}
          />
          {selectedPage === undefined
            ? <div className={css.wikiPageEmpty}>选择一个星体或知识页查看内容。</div>
            : <WikiPageDetail page={selectedPage} snapshot={snapshot} onOpenSource={onOpenSource} />}
        </div>}
    </section>
  )
}

/** Render conflicts or unknowns from the same candidate revision with SourceId traceability. */
export function RequirementIssuePanel({
  kind, wikiState, onOpenSource,
}: {
  readonly kind: 'conflicts' | 'unknowns'
  readonly wikiState: RequirementWikiLoadState | undefined
  readonly onOpenSource: (sourceId: string) => void
}) {
  const snapshot = wikiState?.value ?? undefined
  const items: readonly RequirementWikiIssue[] = kind === 'conflicts'
    ? snapshot?.current?.conflicts ?? []
    : snapshot?.current?.unknowns ?? []
  const title = kind === 'conflicts' ? '冲突与缺口' : '待确认事项'
  const description = kind === 'conflicts'
    ? '不同资料之间相互矛盾或会影响交付的候选判断。'
    : '资料没有给出、表达含糊或需要客户明确回答的问题。'
  return (
    <section className={css.issueRoot}>
      <header><span className={css.candidateBadge}>候选理解</span><h2>{title}</h2><p>{description}</p></header>
      {snapshot?.current === null || snapshot === undefined
        ? <div className={css.wikiEmpty}><strong>尚无可审阅内容</strong><p>先在“需求知识图谱”中整理已识别资料。</p></div>
        : items.length === 0
          ? <div className={css.wikiEmpty}><strong>{kind === 'conflicts' ? '当前版本没有识别到冲突' : '当前版本没有待确认事项'}</strong><p>这只表示 Agent 在当前固定资料中没有列出对应项，不代表客户已确认。</p></div>
          : <div className={css.issueGrid}>{items.map(item => (
            <article key={item.id}>
              <span>{kind === 'conflicts' ? '冲突' : '待确认'}</span>
              <h3>{item.title}</h3>
              <p>{item.detail}</p>
              {item.impact !== undefined && <small>影响：{item.impact}</small>}
              <SourceButtons sourceIds={item.sourceIds} snapshot={snapshot} onOpenSource={onOpenSource} />
            </article>
          ))}</div>}
    </section>
  )
}
