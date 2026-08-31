/** V2 project-stage home: business context first, Agent execution second. */

import { useEffect, useMemo, useState } from 'react'
import type { FdeProjectState } from './stage-controller.ts'
import type {
  DiscoveryAction, ProjectStageWorkbenchHeroProps, ProjectStageWorkbenchViewProps,
} from './slots.ts'
import css from './StageWorkbench.module.css'

export const V2_STAGE_NAMES = [
  '发现高价值问题',
  '定义结果、范围与责任',
  '调查数据、系统、接口、安全与组织',
  '设计方案并完成端到端纵向切片',
  '运行 PoC 与 Eval',
  '企业集成、可靠性改造与受控 Pilot',
  '进入生产、推动采用并验收交接',
  '持续改进并沉淀可复用能力',
] as const

const LEGACY_TO_V2_STAGE: Readonly<Record<FdeProjectState, number>> = {
  requirements: 0,
  solution: 1,
  development: 3,
  validation: 4,
  pilot: 5,
  handoff: 6,
  completed: 7,
}

type WorkbenchProps = ProjectStageWorkbenchHeroProps | ProjectStageWorkbenchViewProps

function parseLabel(status: string): string {
  if (status === 'ready') return '已识别'
  if (status === 'needs-ocr') return '需要 OCR'
  if (status === 'processing') return '识别中'
  if (status === 'error') return '识别失败'
  if (status === 'unsupported') return '仅归档'
  return '待识别'
}

function StageWorkbenchPanel({ props, workspace, sessionId, view }: {
  readonly props: WorkbenchProps
  readonly workspace: { readonly workspaceId: string; readonly title: string; readonly path: string }
  readonly sessionId: string
  readonly view: boolean
}) {
  const [action, setAction] = useState<DiscoveryAction | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const stageState = props.useStageProgress(snapshot => snapshot.byWorkspace[workspace.workspaceId])
  const surfaceState = props.useProjectSurfaces(snapshot => snapshot.byWorkspace[workspace.workspaceId])
  const sourceState = props.useProjectSources(snapshot => snapshot.byWorkspace[workspace.workspaceId])

  useEffect(() => {
    props.loadStage(workspace.workspaceId)
    props.loadProjectSurface(workspace.workspaceId)
    props.loadProjectSources(workspace.workspaceId)
  }, [props.loadProjectSources, props.loadProjectSurface, props.loadStage, workspace.workspaceId])

  const files = sourceState?.files ?? []
  const recognized = files.filter(file => file.parse.status === 'ready').length
  const surface = surfaceState?.status === 'ready' ? surfaceState.value : undefined
  const stage = stageState?.status === 'ready' ? stageState.value.currentStage : undefined
  const stageIndex = stage === undefined ? 0 : LEGACY_TO_V2_STAGE[stage]
  const currentName = V2_STAGE_NAMES[stageIndex]
  const existingArtifacts = surface?.requirements.artifacts ?? []
  const presentArtifacts = existingArtifacts.filter(item => item.status === 'present')
  const sourcePreview = useMemo(() => files.slice(0, 4), [files])

  const run = (next: DiscoveryAction): void => {
    if (action !== null) return
    setAction(next)
    setActionError(null)
    void props.runDiscoveryAction(sessionId, next).catch((error: unknown) => {
      setAction(null)
      setActionError(error instanceof Error ? error.message : String(error))
    })
  }

  if (stageState?.status === 'error') {
    return (
      <section className={css.state} role="alert" data-conversation-hero-project="">
        <strong>当前阶段读取失败</strong>
        <span>{stageState.message}</span>
      </section>
    )
  }

  if (stage !== undefined && stage !== 'requirements') {
    return (
      <section
        className={css.root}
        data-conversation-hero-project=""
        data-conversation-composer-overlay={view ? '' : undefined}
      >
        <header className={css.topbar}>
          <div><span>{workspace.title}</span><strong>阶段 {stageIndex + 1}/8 · {currentName}</strong></div>
          <button type="button" onClick={props.openProjectPage}>返回项目中心</button>
        </header>
        <div className={css.laterStage}>
          <span>{stage === 'completed' ? '项目交付记录' : '当前阶段'}</span>
          <h1>{stage === 'completed' ? '交付闭环已经完成' : currentName}</h1>
          <p>
            {stage === 'completed'
              ? '项目资料、阶段产物与执行记录仍保留在当前项目中，可通过右侧文件树和 Agent 对话继续查询。'
              : '本轮先完成“发现高价值问题”工作台。这个阶段仍可使用右侧文件树和 Agent 对话继续真实交付，专用业务视图将在对应 Feature 中逐阶段接入。'}
          </p>
          <div className={css.laterActions}>
            <button type="button" className={css.primaryButton} onClick={() => { props.openProjectConversation(sessionId) }}>进入 Agent 执行</button>
            <button type="button" className={css.secondaryButton} onClick={props.openProjectPage}>查看项目管理</button>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section
      className={css.root}
      data-conversation-hero-project=""
      data-conversation-composer-overlay={view ? '' : undefined}
    >
      <header className={css.topbar}>
        <div className={css.projectIdentity}>
          <span>{workspace.title}</span>
          <strong>阶段 1/8 · 发现高价值问题</strong>
        </div>
        <button type="button" className={css.centerLink} onClick={props.openProjectPage}>返回项目中心</button>
      </header>

      <div className={css.questionBand}>
        <div>
          <span>当前要回答的问题</span>
          <h1>哪个真实工作流问题值得继续解决？</h1>
          <p>先核对现场事实、真实流程和责任人，再决定是否进入结果与范围定义。</p>
        </div>
        <span className={css.phaseBadge}>现场发现中</span>
      </div>

      <div className={css.summaryGrid}>
        <article>
          <span>客户原始资料</span>
          <strong>{sourceState?.status === 'loading' ? '读取中' : `${files.length} 份`}</strong>
          <small>{recognized} 份已形成可检索文本</small>
        </article>
        <article>
          <span>真实流程知情者</span>
          <strong className={css.pendingValue}>待确认</strong>
          <small>需要能说明正常路径与例外的人</small>
        </article>
        <article>
          <span>代表案例</span>
          <strong className={css.pendingValue}>待补充</strong>
          <small>至少一个近期正常案例和重要异常</small>
        </article>
        <article>
          <span>已有需求材料</span>
          <strong>{presentArtifacts.length}/{existingArtifacts.length || 3}</strong>
          <small>文件存在不等于现场事实已确认</small>
        </article>
      </div>

      <div className={css.workspaceGrid}>
        <section className={css.panel}>
          <header><div><span>阶段输入</span><h2>已经带进项目的事实来源</h2></div><b>{files.length}</b></header>
          {sourceState?.status === 'error' && <p className={css.inlineError}>{sourceState.message}</p>}
          {sourcePreview.length === 0
            ? (
              <div className={css.emptyPanel}>
                <strong>还没有客户资料</strong>
                <span>请从左侧“添加项目资料”归档原始文档、表格、图片或会议材料。</span>
              </div>
            )
            : (
              <div className={css.sourceList}>
                {sourcePreview.map(file => (
                  <div key={file.sourceId}>
                    <span className={css.fileType}>{file.extension.toUpperCase() || 'FILE'}</span>
                    <span><strong title={file.originalName}>{file.originalName}</strong><small>{file.relativePath}</small></span>
                    <b data-state={file.parse.status}>{parseLabel(file.parse.status)}</b>
                  </div>
                ))}
                {files.length > sourcePreview.length && <small className={css.moreFiles}>其余 {files.length - sourcePreview.length} 份资料可在右侧文件树查看</small>}
              </div>
            )}
        </section>

        <section className={`${css.panel} ${css.evidencePanel}`}>
          <header><div><span>现场证据</span><h2>不要把“有人说过”当成事实</h2></div></header>
          <div className={css.evidenceRows}>
            <div data-state={files.length > 0 ? 'has' : 'missing'}><i /><span><strong>卖出的说法</strong><small>继承简报与客户原始诉求</small></span><b>{files.length > 0 ? '已有资料' : '待补充'}</b></div>
            <div data-state="missing"><i /><span><strong>人员陈述</strong><small>流程知情者、责任人与结果验证者</small></span><b>待访谈</b></div>
            <div data-state="missing"><i /><span><strong>现场观察</strong><small>正常案例、异常案例与人工回退</small></span><b>待记录</b></div>
            <div data-state="missing"><i /><span><strong>系统行为与政策授权</strong><small>真实系统证据、访问边界与风险上限</small></span><b>待核对</b></div>
          </div>
        </section>

        <section className={`${css.panel} ${css.actionPanel}`}>
          <header><div><span>建议下一步</span><h2>先形成可判断的现场证据</h2></div></header>
          <p>{files.length === 0 ? '先归档客户资料，再让 Agent 基于明确来源整理问题。' : '已有资料可以开始资格判断，但代表案例和现场责任人仍需 FDE 补充。'}</p>
          <div className={css.actionButtons}>
            <button type="button" className={css.primaryButton} disabled={files.length === 0 || action !== null} onClick={() => { run('qualify-workflow') }}>
              {action === 'qualify-workflow' ? '正在发起…' : '判断工作流价值'}
            </button>
            <button type="button" className={css.secondaryButton} disabled={action !== null} onClick={() => { run('prepare-interview') }}>生成访谈提纲</button>
            <button type="button" className={css.secondaryButton} disabled={action !== null} onClick={() => { run('reframe-engagement') }}>处理事实冲突</button>
          </div>
          {actionError !== null && <p className={css.inlineError} role="alert">{actionError}</p>}
          <small>点击后进入 Agent 对话，过程、工具和结果在那里完整留痕。</small>
        </section>
      </div>

      <div className={css.outcomeGrid}>
        <section className={css.artifacts}>
          <header><div><span>阶段产物</span><h2>用于继续判断，不是自动通过</h2></div></header>
          <div>
            <article><i>LOG</i><span><strong>现场观察记录</strong><small>人员陈述、观察证据、冲突与来源</small></span><b>待形成</b></article>
            <article><i>CHR</i><span><strong>工作流章程（初稿）</strong><small>问题边界、角色、结果、回退与未知项</small></span><b>待形成</b></article>
            <article><i>RFM</i><span><strong>项目重构记录（按需）</strong><small>现场事实推翻原始诉求时才生成</small></span><b>条件产物</b></article>
          </div>
        </section>
        <aside className={css.decisionCard}>
          <span>FDE 阶段决定</span>
          <h2>现在还不能进入下一阶段</h2>
          <p>仍需明确流程知情者、代表案例、结果验证者、可访问上下文和风险上限。</p>
          <div><b>Go</b><b>调整</b><b>缩小范围</b><b>停止</b></div>
          <button type="button" disabled>证据齐备后由 FDE 决定</button>
        </aside>
      </div>
    </section>
  )
}

/** Replace the generic blank-session hero only for an actual project. */
export function ProjectStageWorkbenchHero(props: ProjectStageWorkbenchHeroProps) {
  if (props.sessionId === undefined || props.workspace === undefined) return <>{props.defaultContent}</>
  return (
    <StageWorkbenchPanel
      props={props}
      sessionId={String(props.sessionId)}
      workspace={{
        workspaceId: String(props.workspace.workspaceId),
        title: props.workspace.title,
        path: props.workspace.path,
      }}
      view={false}
    />
  )
}

/** Keep the same stage home available after the project Session has history. */
export function ProjectStageWorkbenchView(props: ProjectStageWorkbenchViewProps) {
  const workspace = props.useWorkspaces(state => state.items.find(item => item.sessionIds.includes(props.sessionId)))
  if (workspace === undefined) return <div className={css.state}>当前会话未关联项目。</div>
  return (
    <StageWorkbenchPanel
      props={props}
      sessionId={String(props.sessionId)}
      workspace={{ workspaceId: String(workspace.workspaceId), title: workspace.title, path: workspace.path }}
      view
    />
  )
}
