/** Project-local sidebar: stage orientation and scoped project actions only. */

import { useEffect } from 'react'
import type { FdeProjectState } from './stage-controller.ts'
import type { ProjectContextSidebarProps } from './slots.ts'
import { V2_STAGE_NAMES } from './StageWorkbench.tsx'
import css from './StageWorkbench.module.css'

const LEGACY_TO_V2_STAGE: Readonly<Record<FdeProjectState, number>> = {
  requirements: 0, solution: 1, development: 3, validation: 4, pilot: 5, handoff: 6, completed: 7,
}

export function ProjectContextSidebar(props: ProjectContextSidebarProps) {
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

  return (
    <aside className={css.projectSidebar}>
      <header>
        <button type="button" onClick={props.openProjectPage}><span aria-hidden="true">←</span> 项目中心</button>
        <div><span>当前项目</span><strong title={props.title}>{props.title}</strong><small>{props.sessionCount} 个会话 · {files} 份资料 · {artifacts} 份已有材料</small></div>
      </header>

      <nav aria-label="项目交付阶段">
        <span>交付路径</span>
        {V2_STAGE_NAMES.map((name, index) => (
          <div key={name} data-active={index === active ? 'true' : 'false'} data-complete={index < active ? 'true' : 'false'}>
            <i>{index < active ? '✓' : String(index + 1).padStart(2, '0')}</i>
            <span><strong>{name}</strong>{index === active && <small>当前阶段</small>}</span>
          </div>
        ))}
      </nav>

      <section>
        <span>项目操作</span>
        <button type="button" onClick={() => { props.openProjectConversation(String(props.sessionId)) }}>
          <i aria-hidden="true">✦</i><span><strong>Agent 执行</strong><small>对话、工具与过程留痕</small></span>
        </button>
        <div className={css.uploadAction}>
          <i aria-hidden="true">＋</i><span><strong>添加项目资料</strong><small>归档原始文件，不触发对话</small></span>{props.projectActions}
        </div>
      </section>
    </aside>
  )
}
