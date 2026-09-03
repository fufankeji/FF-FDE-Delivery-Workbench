/** Project-local sidebar: stage orientation and scoped project actions only. */

import { MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FDE_V2_STAGE_IDS, type FdeProjectState } from './stage-controller.ts'
import { fetchStageSkillCatalog, type StageSkillCatalogMethod } from './stage-skill-catalog.ts'
import type { ProjectContextSidebarProps } from './slots.ts'
import { V2_STAGE_NAMES } from './StageWorkbench.tsx'
import css from './StageWorkbench.module.css'

const LEGACY_TO_V2_STAGE: Readonly<Record<FdeProjectState, number>> = {
  requirements: 0, solution: 1, development: 3, validation: 4, pilot: 5, handoff: 6, completed: 7,
}

function projectMonogram(title: string): string {
  if (/llm[-\s]?wiki/i.test(title)) return 'IW'
  const latinWords = title.match(/[a-z0-9]+/gi)
  if (latinWords !== null && latinWords.length > 0) {
    return latinWords.slice(0, 2).map(word => word[0]?.toUpperCase()).join('')
  }
  return Array.from(title.replace(/\s+/g, '')).slice(0, 1).join('') || '项'
}

type SkillCatalogState =
  | { readonly status: 'idle' | 'loading' }
  | { readonly status: 'ready'; readonly methods: readonly StageSkillCatalogMethod[] }
  | { readonly status: 'error'; readonly message: string }

export function ProjectContextSidebar(props: ProjectContextSidebarProps) {
  const [expandedStage, setExpandedStage] = useState<number>()
  const [catalogState, setCatalogState] = useState<SkillCatalogState>({ status: 'idle' })
  const [catalogRequestRevision, setCatalogRequestRevision] = useState(0)
  const catalogLoaded = useRef(false)
  const [selectedMethod, setSelectedMethod] = useState<StageSkillCatalogMethod>()
  const workspaceId = String(props.workspaceId)
  const stageState = props.useStageProgress(snapshot => snapshot.byWorkspace[workspaceId])
  const sourceState = props.useProjectSources(snapshot => snapshot.byWorkspace[workspaceId])
  const surfaceState = props.useProjectSurfaces(snapshot => snapshot.byWorkspace[workspaceId])
  const selectedStage = props.useStageView(snapshot => snapshot.byWorkspace[workspaceId])
  const loadActions = useRef({
    loadStage: props.loadStage,
    loadProjectSources: props.loadProjectSources,
    loadProjectSurface: props.loadProjectSurface,
  })
  useEffect(() => {
    loadActions.current.loadStage(workspaceId)
    loadActions.current.loadProjectSources(workspaceId)
    loadActions.current.loadProjectSurface(workspaceId)
  }, [workspaceId])
  const stage = stageState?.status === 'ready' ? stageState.value.currentStage : undefined
  const active = stageState?.status === 'ready' && stageState.value.v2Stage !== undefined
    ? FDE_V2_STAGE_IDS.indexOf(stageState.value.v2Stage)
    : stage === undefined ? 0 : LEGACY_TO_V2_STAGE[stage]
  const activeStageId = FDE_V2_STAGE_IDS[active] ?? 'discovery'
  const viewedStageId = selectedStage ?? activeStageId
  const viewed = Math.max(0, FDE_V2_STAGE_IDS.indexOf(viewedStageId))
  const stageDetailsOpen = expandedStage === viewed
  const files = sourceState?.files.length ?? 0
  const surface = surfaceState?.status === 'ready' ? surfaceState.value : undefined
  const artifacts = surface?.requirements.presentCount ?? 0
  useEffect(() => {
    if (!stageDetailsOpen || catalogLoaded.current) return
    const abort = new AbortController()
    setCatalogState({ status: 'loading' })
    void fetchStageSkillCatalog(abort.signal).then((catalog) => {
      const selected = catalog.stages.find(item => (
        item.index === viewed && (item.id === viewedStageId || (viewed === 0 && item.id === 'requirements'))
      ))
      if (selected === undefined || selected.methods.length === 0) {
        throw new Error('当前阶段工作方法未完整注册。')
      }
      catalogLoaded.current = true
      setCatalogState({ status: 'ready', methods: selected.methods })
    }).catch((error: unknown) => {
      if (abort.signal.aborted) return
      setCatalogState({ status: 'error', message: error instanceof Error ? error.message : String(error) })
    })
    return () => { abort.abort() }
  }, [catalogRequestRevision, stageDetailsOpen, viewed, viewedStageId])
  useEffect(() => {
    if (selectedMethod === undefined) return
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setSelectedMethod(undefined)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => { window.removeEventListener('keydown', closeOnEscape) }
  }, [selectedMethod])
  useEffect(() => {
    catalogLoaded.current = false
    setCatalogState({ status: 'idle' })
    setSelectedMethod(undefined)
  }, [viewed])

  const retryCatalog = (): void => {
    catalogLoaded.current = false
    setCatalogState({ status: 'idle' })
    setCatalogRequestRevision(value => value + 1)
  }

  const toggleStageDetails = (): void => {
    setSelectedMethod(undefined)
    setExpandedStage(stageDetailsOpen ? undefined : viewed)
  }

  const renderMethod = (method: StageSkillCatalogMethod, methodIndex: number) => (
    <button key={method.id} type="button" className={css.stageMethodItem} onClick={() => { setSelectedMethod(method) }}>
      <span>{String(methodIndex + 1).padStart(2, '0')}</span>
      <strong>{method.label}</strong>
      <svg aria-hidden="true" viewBox="0 0 16 16"><path d="m5.5 3 5 5-5 5" /></svg>
    </button>
  )

  const renderCatalogMethods = () => {
    if (catalogState.status !== 'ready') return null
    if (!catalogState.methods.some(method => method.group !== undefined)) {
      return catalogState.methods.map(renderMethod)
    }
    return (['required', 'conditional'] as const).map((group) => {
      const methods = catalogState.methods.filter(method => method.group === group)
      if (methods.length === 0) return null
      const label = group === 'required' ? '必做工作' : '按需处理'
      return (
        <section className={css.stageMethodGroup} key={group} aria-label={label}>
          <div className={css.stageMethodGroupLabel}><span>{label}</span><b>{methods.length}</b></div>
          {methods.map(method => renderMethod(method, catalogState.methods.indexOf(method)))}
        </section>
      )
    })
  }

  return (
    <aside className={css.projectSidebar} data-fde-project-context-sidebar="">
      <header>
        <button type="button" onClick={props.openProjectPage}><span aria-hidden="true">←</span> 返回项目中心</button>
        <span className={css.projectContextEyebrow}>当前项目</span>
        <div className={css.projectIdentityCard}>
          <i aria-hidden="true">{projectMonogram(props.title)}</i>
          <span>
            <strong title={props.title}>{props.title}</strong>
            <small>{props.sessionCount} 个会话 · {files} 份资料 · {artifacts} 份已有材料</small>
          </span>
        </div>
      </header>

      <nav className={css.projectStageNavigation} aria-label="项目交付阶段">
        <div className={css.projectStageNavHeader}>
          <span>交付路径</span>
          <div className={css.projectStageNavActions}>
            {viewed !== active && <button type="button" className={css.projectStageReturn} onClick={() => { props.returnToCurrentStage(workspaceId) }}>返回当前阶段</button>}
            <button
              type="button"
              className={css.projectStageNavControl}
              aria-label={stageDetailsOpen ? '一键收起阶段详情' : '展开当前阶段详情'}
              title={stageDetailsOpen ? '一键收起阶段详情' : '展开当前阶段详情'}
              onClick={toggleStageDetails}
            >
              <svg aria-hidden="true" viewBox="0 0 16 16">
                {stageDetailsOpen
                  ? <><path d="m4 6 4-3 4 3" /><path d="m4 10 4 3 4-3" /></>
                  : <><path d="m4 3 4 3 4-3" /><path d="m4 13 4-3 4 3" /></>}
              </svg>
            </button>
            <button
              type="button"
              className={css.projectStageNavControl}
              aria-label="缩放项目侧栏"
              title="缩放项目侧栏"
              onClick={props.toggleProjectSidebar}
            >
              <svg aria-hidden="true" viewBox="0 0 16 16"><rect x="2.5" y="2.5" width="11" height="11" rx="2" /><path d="M6 3v10" /><path d="m9.5 6-2 2 2 2" /></svg>
            </button>
          </div>
        </div>
        {V2_STAGE_NAMES.map((name, index) => {
          const current = index === active
          const viewing = index === viewed
          const stage = FDE_V2_STAGE_IDS[index]
          if (stage === undefined) return null
          return (
            <div className={css.projectStageBranch} key={name} data-active={current ? 'true' : 'false'} data-viewing={viewing ? 'true' : 'false'} data-complete={index < active ? 'true' : 'false'}>
              {viewing && stageDetailsOpen && <span className={css.projectStageFocusSurface} aria-hidden="true" />}
              <button
                type="button"
                className={css.projectStageRow}
                aria-current={current ? 'step' : undefined}
                aria-expanded={viewing ? stageDetailsOpen : undefined}
                onClick={() => {
                  if (viewing) toggleStageDetails()
                  else {
                    setExpandedStage(index)
                    props.viewProjectStage(workspaceId, stage)
                  }
                }}
              >
                <i>{index < active ? '✓' : String(index + 1).padStart(2, '0')}</i>
                <span><strong>{name}</strong>{current && <small>当前阶段</small>}{viewing && !current && <small>正在查看</small>}</span>
                <svg aria-hidden="true" viewBox="0 0 16 16">{viewing && stageDetailsOpen ? <path d="m3 10.5 5-5 5 5" /> : <path d="m5.5 3 5 5-5 5" />}</svg>
              </button>
              {viewing && stageDetailsOpen && (
                <div className={css.stageMethodTree} data-stage-method-tree="">
                  <div className={css.stageMethodList} aria-label={`第 ${String(index + 1)} 阶段工作方法`}>
                    {catalogState.status === 'loading' && <span className={css.stageMethodMessage}>正在读取工作方法…</span>}
                    {catalogState.status === 'error' && (
                      <div className={css.stageMethodMessage} role="alert">
                        <span>{catalogState.message}</span>
                        <button type="button" onClick={retryCatalog}>重试</button>
                      </div>
                    )}
                    {renderCatalogMethods()}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {selectedMethod !== undefined && typeof document !== 'undefined' && createPortal(
        <div
          className={css.stageMethodDialogLayer}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedMethod(undefined)
          }}
        >
          <section className={css.stageMethodDialog} role="dialog" aria-modal="true" aria-labelledby="stage-method-title">
            <header>
              <div><span>第 {String(viewed + 1)} 阶段 · 工作方法</span><h2 id="stage-method-title">{selectedMethod.label}</h2><p>{selectedMethod.description}</p></div>
              <button type="button" aria-label="关闭工作方法详情" onClick={() => { setSelectedMethod(undefined) }}>×</button>
            </header>
            <div className={css.stageMethodDialogBody}>
              <section className={css.stageMethodUsage}>
                <span>什么时候会用</span>
                <p>{selectedMethod.whenToUse}</p>
              </section>
              <section className={css.stageMethodDefinition}>
                <span>完整方法定义</span>
                <MarkdownText text={selectedMethod.content} />
              </section>
              <details className={css.stageMethodTechnical}>
                <summary>技术信息</summary>
                <dl>
                  <div><dt>Skill</dt><dd><code>{selectedMethod.id}</code></dd></div>
                  <div><dt>固定来源</dt><dd><code>{selectedMethod.source}</code></dd></div>
                </dl>
              </details>
            </div>
          </section>
        </div>,
        document.body,
      )}
    </aside>
  )
}
