/** Project-local sidebar: stage orientation and scoped project actions only. */

import { MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FDE_V2_STAGE_IDS, type FdeProjectState } from './stage-controller.ts'
import {
  fetchStageSkillCatalog,
  type StageSkillCatalogMethod,
  type StageSkillCatalogStage,
} from './stage-skill-catalog.ts'
import type { ProjectContextSidebarProps } from './slots.ts'
import { V2_STAGE_NAMES } from './StageWorkbench.tsx'
import css from './StageWorkbench.module.css'

const LEGACY_TO_V2_STAGE: Readonly<Record<FdeProjectState, number>> = {
  requirements: 0, solution: 1, development: 3, validation: 4, pilot: 5, handoff: 6, completed: 7,
}

const STAGE_METHOD_COUNTS = [7, 9, 7, 7, 7, 7, 8, 7] as const

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
  | { readonly status: 'ready'; readonly stages: readonly StageSkillCatalogStage[] }
  | { readonly status: 'error'; readonly message: string }

interface SelectedStageMethod {
  readonly stageIndex: number
  readonly method: StageSkillCatalogMethod
}

export function ProjectContextSidebar(props: ProjectContextSidebarProps) {
  const [stageDetailsOpen, setStageDetailsOpen] = useState(true)
  const [collapsedMethodStages, setCollapsedMethodStages] = useState<ReadonlySet<string>>(() => new Set())
  const [catalogState, setCatalogState] = useState<SkillCatalogState>({ status: 'idle' })
  const [catalogRequestRevision, setCatalogRequestRevision] = useState(0)
  const catalogLoaded = useRef(false)
  const [selectedMethod, setSelectedMethod] = useState<SelectedStageMethod>()
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
  const files = sourceState?.files.length ?? 0
  const surface = surfaceState?.status === 'ready' ? surfaceState.value : undefined
  const artifacts = surface?.requirements.presentCount ?? 0
  useEffect(() => {
    if (!stageDetailsOpen || catalogLoaded.current) return
    const abort = new AbortController()
    setCatalogState({ status: 'loading' })
    void fetchStageSkillCatalog(abort.signal).then((catalog) => {
      const complete = FDE_V2_STAGE_IDS.every((stageId, stageIndex) => catalog.stages.some(stageItem => (
        stageItem.index === stageIndex
        && (stageItem.id === stageId || (stageIndex === 0 && stageItem.id === 'requirements'))
        && stageItem.methods.length > 0
      )))
      if (!complete) {
        throw new Error('阶段工作方法未完整注册。')
      }
      catalogLoaded.current = true
      setCatalogState({ status: 'ready', stages: catalog.stages })
    }).catch((error: unknown) => {
      if (abort.signal.aborted) return
      setCatalogState({ status: 'error', message: error instanceof Error ? error.message : String(error) })
    })
    return () => { abort.abort() }
  }, [catalogRequestRevision, stageDetailsOpen])
  useEffect(() => {
    if (selectedMethod === undefined) return
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setSelectedMethod(undefined)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => { window.removeEventListener('keydown', closeOnEscape) }
  }, [selectedMethod])
  useEffect(() => {
    setSelectedMethod(undefined)
  }, [viewed])

  const retryCatalog = (): void => {
    catalogLoaded.current = false
    setCatalogState({ status: 'idle' })
    setCatalogRequestRevision(value => value + 1)
  }

  const toggleStageDetails = (): void => {
    if (stageDetailsOpen) {
      setSelectedMethod(undefined)
    } else {
      setCollapsedMethodStages(new Set())
    }
    setStageDetailsOpen(!stageDetailsOpen)
  }

  const toggleStageMethods = (stageId: string): void => {
    setCollapsedMethodStages((current) => {
      const next = new Set(current)
      if (next.has(stageId)) next.delete(stageId)
      else next.add(stageId)
      return next
    })
  }

  const catalogStage = (stageId: string, stageIndex: number): StageSkillCatalogStage | undefined => (
    catalogState.status === 'ready'
      ? catalogState.stages.find(item => (
        item.index === stageIndex && (item.id === stageId || (stageIndex === 0 && item.id === 'requirements'))
      ))
      : undefined
  )

  const renderMethod = (method: StageSkillCatalogMethod, methodIndex: number, stageIndex: number) => (
    <button
      key={method.id}
      type="button"
      className={css.stageMethodItem}
      onClick={() => { setSelectedMethod({ stageIndex, method }) }}
    >
      <span>{String(methodIndex + 1).padStart(2, '0')}</span>
      <strong>{method.label}</strong>
      <svg aria-hidden="true" viewBox="0 0 16 16"><path d="m5.5 3 5 5-5 5" /></svg>
    </button>
  )

  const renderCatalogMethods = (methods: readonly StageSkillCatalogMethod[], stageIndex: number) => {
    if (!methods.some(method => method.group !== undefined)) {
      return methods.map((method, methodIndex) => renderMethod(method, methodIndex, stageIndex))
    }
    return (['required', 'conditional'] as const).map((group) => {
      const groupedMethods = methods.filter(method => method.group === group)
      if (groupedMethods.length === 0) return null
      const label = group === 'required' ? '必做工作' : '按需处理'
      return (
        <section className={css.stageMethodGroup} key={group} aria-label={label}>
          <div className={css.stageMethodGroupLabel}><span>{label}</span><b>{groupedMethods.length}</b></div>
          {groupedMethods.map(method => renderMethod(method, methods.indexOf(method), stageIndex))}
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

      <nav aria-label="项目交付阶段">
        <div className={css.projectStageNavHeader}>
          <span>交付路径</span>
          <div className={css.projectStageNavActions}>
            {viewed !== active && <button type="button" className={css.projectStageReturn} onClick={() => { props.returnToCurrentStage(workspaceId) }}>返回当前阶段</button>}
            <button
              type="button"
              className={css.projectStageNavControl}
              aria-label={stageDetailsOpen ? '一键收起所有阶段方法' : '展开所有阶段方法'}
              title={stageDetailsOpen ? '一键收起所有阶段方法' : '展开所有阶段方法'}
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
          const stageCatalog = catalogStage(stage, index)
          const methodsOpen = !collapsedMethodStages.has(stage)
          return (
            <div className={css.projectStageBranch} key={name} data-active={current ? 'true' : 'false'} data-viewing={viewing ? 'true' : 'false'} data-complete={index < active ? 'true' : 'false'}>
              <button type="button" className={css.projectStageRow} aria-current={current ? 'step' : undefined} onClick={() => { props.viewProjectStage(workspaceId, stage) }}>
                <i>{index < active ? '✓' : String(index + 1).padStart(2, '0')}</i>
                <span><strong>{name}</strong>{current && <small>当前阶段</small>}{viewing && !current && <small>正在查看</small>}</span>
                <svg aria-hidden="true" viewBox="0 0 16 16"><path d="m5.5 3 5 5-5 5" /></svg>
              </button>
              {stageDetailsOpen && (
                <div className={css.stageMethodTree}>
                  <button
                    type="button"
                    className={css.stageMethodToggle}
                    aria-expanded={methodsOpen}
                    onClick={() => { toggleStageMethods(stage) }}
                  >
                    <span aria-hidden="true" className={css.stageMethodFolder}>◇</span>
                    <span>本阶段工作方法</span>
                    <b>{stageCatalog?.methods.length ?? STAGE_METHOD_COUNTS[index]}</b>
                    <svg aria-hidden="true" viewBox="0 0 16 16"><path d="m5.5 3 5 5-5 5" /></svg>
                  </button>
                  {methodsOpen && (
                    <div className={css.stageMethodList} aria-label={`第 ${String(index + 1)} 阶段工作方法`}>
                      {catalogState.status === 'loading' && <span className={css.stageMethodMessage}>正在读取工作方法…</span>}
                      {catalogState.status === 'error' && (
                        <div className={css.stageMethodMessage} role="alert">
                          <span>{catalogState.message}</span>
                          <button type="button" onClick={retryCatalog}>重试</button>
                        </div>
                      )}
                      {stageCatalog === undefined ? null : renderCatalogMethods(stageCatalog.methods, index)}
                    </div>
                  )}
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
              <div><span>第 {String(selectedMethod.stageIndex + 1)} 阶段 · 工作方法</span><h2 id="stage-method-title">{selectedMethod.method.label}</h2><p>{selectedMethod.method.description}</p></div>
              <button type="button" aria-label="关闭工作方法详情" onClick={() => { setSelectedMethod(undefined) }}>×</button>
            </header>
            <div className={css.stageMethodDialogBody}>
              <section className={css.stageMethodUsage}>
                <span>什么时候会用</span>
                <p>{selectedMethod.method.whenToUse}</p>
              </section>
              <section className={css.stageMethodDefinition}>
                <span>完整方法定义</span>
                <MarkdownText text={selectedMethod.method.content} />
              </section>
              <details className={css.stageMethodTechnical}>
                <summary>技术信息</summary>
                <dl>
                  <div><dt>Skill</dt><dd><code>{selectedMethod.method.id}</code></dd></div>
                  <div><dt>固定来源</dt><dd><code>{selectedMethod.method.source}</code></dd></div>
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
