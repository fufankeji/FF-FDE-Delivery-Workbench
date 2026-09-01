/** Project-local sidebar: stage orientation and scoped project actions only. */

import { MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { FdeProjectState } from './stage-controller.ts'
import { fetchStageSkillCatalog, type StageSkillCatalogMethod } from './stage-skill-catalog.ts'
import type { ProjectContextSidebarProps } from './slots.ts'
import { V2_STAGE_NAMES } from './StageWorkbench.tsx'
import css from './StageWorkbench.module.css'

const LEGACY_TO_V2_STAGE: Readonly<Record<FdeProjectState, number>> = {
  requirements: 0, solution: 1, development: 3, validation: 4, pilot: 5, handoff: 6, completed: 7,
}

type SkillCatalogState =
  | { readonly status: 'idle' | 'loading' }
  | { readonly status: 'ready'; readonly methods: readonly StageSkillCatalogMethod[] }
  | { readonly status: 'error'; readonly message: string }

const DISCOVERY_METHOD_COUNT = 7

export function ProjectContextSidebar(props: ProjectContextSidebarProps) {
  const [methodsOpen, setMethodsOpen] = useState(false)
  const [catalogState, setCatalogState] = useState<SkillCatalogState>({ status: 'idle' })
  const [catalogRequestRevision, setCatalogRequestRevision] = useState(0)
  const catalogLoaded = useRef(false)
  const [selectedMethod, setSelectedMethod] = useState<StageSkillCatalogMethod>()
  const workspaceId = String(props.workspaceId)
  const stageState = props.useStageProgress(snapshot => snapshot.byWorkspace[workspaceId])
  const sourceState = props.useProjectSources(snapshot => snapshot.byWorkspace[workspaceId])
  const surfaceState = props.useProjectSurfaces(snapshot => snapshot.byWorkspace[workspaceId])
  useEffect(() => {
    props.loadStage(workspaceId)
    props.loadProjectSources(workspaceId)
    props.loadProjectSurface(workspaceId)
  }, [props.loadProjectSources, props.loadProjectSurface, props.loadStage, workspaceId])
  const stage = stageState?.status === 'ready' ? stageState.value.currentStage : undefined
  const active = stage === undefined ? 0 : LEGACY_TO_V2_STAGE[stage]
  const files = sourceState?.files.length ?? 0
  const surface = surfaceState?.status === 'ready' ? surfaceState.value : undefined
  const artifacts = surface?.requirements.presentCount ?? 0
  useEffect(() => {
    if (!methodsOpen || catalogLoaded.current) return
    const abort = new AbortController()
    setCatalogState({ status: 'loading' })
    void fetchStageSkillCatalog(abort.signal).then((catalog) => {
      const discovery = catalog.stages.find(item => item.id === 'requirements' && item.index === 0)
      if (discovery === undefined || discovery.methods.length !== DISCOVERY_METHOD_COUNT) {
        throw new Error('第一阶段工作方法未完整注册。')
      }
      catalogLoaded.current = true
      setCatalogState({ status: 'ready', methods: discovery.methods })
    }).catch((error: unknown) => {
      if (abort.signal.aborted) return
      setCatalogState({ status: 'error', message: error instanceof Error ? error.message : String(error) })
    })
    return () => { abort.abort() }
  }, [catalogRequestRevision, methodsOpen])
  useEffect(() => {
    if (selectedMethod === undefined) return
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setSelectedMethod(undefined)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => { window.removeEventListener('keydown', closeOnEscape) }
  }, [selectedMethod])
  useEffect(() => {
    if (active !== 0) {
      setMethodsOpen(false)
      setSelectedMethod(undefined)
    }
  }, [active])

  const retryCatalog = (): void => {
    catalogLoaded.current = false
    setCatalogState({ status: 'idle' })
    setCatalogRequestRevision(value => value + 1)
  }

  return (
    <aside className={css.projectSidebar}>
      <header>
        <button type="button" onClick={props.openProjectPage}><span aria-hidden="true">←</span> 项目中心</button>
        <div>
          <span>当前项目</span>
          <strong title={props.title}>{props.title}</strong>
          <small>{props.sessionCount} 个会话 · {files} 份资料 · {artifacts} 份已有材料</small>
        </div>
      </header>

      <nav aria-label="项目交付阶段">
        <span>交付路径</span>
        {V2_STAGE_NAMES.map((name, index) => {
          const current = index === active
          return (
            <div className={css.projectStageBranch} key={name} data-active={current ? 'true' : 'false'} data-complete={index < active ? 'true' : 'false'}>
              <div className={css.projectStageRow}>
                <i>{index < active ? '✓' : String(index + 1).padStart(2, '0')}</i>
                <span><strong>{name}</strong>{current && <small>当前阶段</small>}</span>
              </div>
              {current && index === 0 && (
                <div className={css.stageMethodTree}>
                  <button
                    type="button"
                    className={css.stageMethodToggle}
                    aria-expanded={methodsOpen}
                    onClick={() => { setMethodsOpen(value => !value) }}
                  >
                    <span aria-hidden="true" className={css.stageMethodFolder}>◇</span>
                    <span>本阶段工作方法</span>
                    <b>{DISCOVERY_METHOD_COUNT}</b>
                    <svg aria-hidden="true" viewBox="0 0 16 16"><path d="m5.5 3 5 5-5 5" /></svg>
                  </button>
                  {methodsOpen && (
                    <div className={css.stageMethodList} aria-label="第一阶段工作方法">
                      {catalogState.status === 'loading' && <span className={css.stageMethodMessage}>正在读取工作方法…</span>}
                      {catalogState.status === 'error' && (
                        <div className={css.stageMethodMessage} role="alert">
                          <span>{catalogState.message}</span>
                          <button type="button" onClick={retryCatalog}>重试</button>
                        </div>
                      )}
                      {catalogState.status === 'ready' && catalogState.methods.map((method, methodIndex) => (
                        <button key={method.id} type="button" className={css.stageMethodItem} onClick={() => { setSelectedMethod(method) }}>
                          <span>{String(methodIndex + 1).padStart(2, '0')}</span>
                          <strong>{method.label}</strong>
                          <svg aria-hidden="true" viewBox="0 0 16 16"><path d="m5.5 3 5 5-5 5" /></svg>
                        </button>
                      ))}
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
              <div><span>第一阶段 · 工作方法</span><h2 id="stage-method-title">{selectedMethod.label}</h2><p>{selectedMethod.description}</p></div>
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
