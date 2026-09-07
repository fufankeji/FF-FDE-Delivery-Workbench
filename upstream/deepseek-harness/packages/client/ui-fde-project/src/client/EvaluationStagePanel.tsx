/** Stage-five information surface; development remains in the native Agent conversation. */

import { useEffect, useState, type ReactNode } from 'react'
import type { ProjectSurfaceSnapshot, V2EvaluationFile, V2StageSurfaceSnapshot } from './controller.ts'
import type { ProjectStageWorkbenchHeroProps, ProjectStageWorkbenchViewProps } from './slots.ts'
import type { FdeV2StageId, ProjectStageValue } from './stage-controller.ts'
import css from './EvaluationStagePanel.module.css'

type WorkbenchProps = ProjectStageWorkbenchHeroProps | ProjectStageWorkbenchViewProps
type RuntimeAction = Parameters<WorkbenchProps['runProjectAction']>[0]
const RESULT_LABELS = { NOT_RUN: '未运行', RUNNING: '运行中', PASS: '已记录通过', WARN: '警告', FAIL: '失败', STALE: '结果已过期' } as const
const RUNTIME_LABELS = { stopped: '未启动', starting: '启动中', running: '运行中', stopping: '停止中', blocked: '运行受阻' } as const

/** Present current candidate, runtime, evidence and the existing manual stage gate. */
export function EvaluationStagePanel({
  props, workspace, sessionId, view, stageState, surface, projectSurface, historicalActualStage, records,
}: {
  readonly props: WorkbenchProps
  readonly workspace: { readonly workspaceId: string; readonly title: string; readonly path: string }
  readonly sessionId: string
  readonly view: boolean
  readonly stageState: ProjectStageValue
  readonly surface: V2StageSurfaceSnapshot | undefined
  readonly projectSurface: ProjectSurfaceSnapshot | undefined
  readonly historicalActualStage?: FdeV2StageId
  readonly records: (openFile: (path: string, title: string) => void) => ReactNode
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [returning, setReturning] = useState(false)
  const [reason, setReason] = useState('')
  const historical = historicalActualStage !== undefined
  const runtime = projectSurface?.runtime
  const evaluation = surface?.evaluation
  const metrics = evaluation?.testing.metrics ?? []
  const required = metrics.filter(metric => metric.required)
  const hasEvidence = (files: readonly V2EvaluationFile[]): boolean => files.length > 0 && files.every(file => file.status === 'present')
  const passed = required.filter(metric => metric.status === 'PASS' && metric.value && hasEvidence(metric.evidence)).length
  const blockers = surface?.reviewBlockers ?? []
  const issues = [...new Set([...blockers, ...(surface?.blockers.filter(item => item.status === 'open').map(item => item.title) ?? [])])]
  const ready = surface?.reviewReady === true && evaluation?.status === 'ready' && evaluation.reviewBlockers.length === 0
  const transitioning = runtime?.status === 'starting' || runtime?.status === 'stopping'

  useEffect(() => {
    if (historical || !transitioning) return
    const timer = window.setInterval(() => { props.pollProjectSurface(workspace.workspaceId) }, 1500)
    return () => { window.clearInterval(timer) }
  }, [historical, transitioning, props.pollProjectSurface, workspace.workspaceId])

  const perform = async (action: () => Promise<void>): Promise<void> => {
    setBusy(true); setError(null)
    try { await action() }
    catch (cause: unknown) { setError(cause instanceof Error ? cause.message : String(cause)) }
    finally { setBusy(false) }
  }
  const openFile = (path: string, title: string): void => {
    void perform(() => props.openProjectFile(sessionId, workspace.path, path, title))
  }
  const runtimeAction = (action: RuntimeAction): void => {
    if (historical) return
    void perform(() => props.runProjectAction(action, workspace.workspaceId, sessionId, workspace.path))
  }
  const prepare = (prompt: string): void => {
    if (!historical) props.prepareStageDraft(sessionId, prompt)
  }
  const fileLinks = (files: readonly V2EvaluationFile[]) => <div className={css.fileLinks}>{files.map(file => <button
    type="button" key={file.path} disabled={file.status !== 'present' || busy}
    title={file.message ?? file.path} onClick={() => { openFile(file.path, file.path.split('/').pop() ?? file.path) }}
  >{file.path}{file.status === 'present' ? '' : file.status === 'missing' ? ' · 文件缺失' : ' · 无法读取'}</button>)}</div>

  if (surface === undefined) return <section className={css.root} role="status"><h2>正在读取第五阶段记录</h2><p>读取失败时可刷新重试，不会启动项目或执行测试。</p><button type="button" onClick={() => { props.refreshProjectSurface(workspace.workspaceId) }}>刷新记录</button></section>

  return <section className={css.root} data-fde-stage-workbench="" data-conversation-hero-project=""
    data-stage="evaluation" data-historical={historical ? 'true' : undefined}
    data-hide-stage-composer={historical ? 'true' : undefined}
    data-conversation-composer-layout={historical ? 'stage-history' : 'stage-evaluation'}
    data-conversation-composer-overlay={view ? '' : undefined}
    aria-label={historical ? '历史阶段：运行 PoC 与 Eval' : '项目阶段工作台：运行 PoC 与 Eval'}>
    {historical && <div className={css.notice}><span>正在回看第五阶段已有记录 · 只读查看，不代表当前文件是当时的冻结快照。</span><button type="button" onClick={() => { props.returnToCurrentStage(workspace.workspaceId) }}>返回当前阶段</button></div>}
    <header className={css.hero}>
      <div>
        <span className={css.eyebrow}>第 5/8 阶段 · 运行 PoC 与 Eval</span><h1>项目运行与验证</h1>
        <p>开发在 Agent 对话中进行；这里查看项目成果、测试证据和进入下一阶段的条件。</p>
      </div>
      <button type="button" disabled={busy} onClick={() => { props.refreshProjectSurface(workspace.workspaceId) }}>刷新阶段记录</button>
    </header>
    {error && <div className={css.error} role="alert">{error}</div>}
    {evaluation?.status === 'invalid' && <div className={css.error} role="alert">{evaluation.message}</div>}

    <div className={css.overview}>
      <section className={css.card} aria-label="本轮受测范围与版本">
        <header><div><span className={css.eyebrow}>本轮受测对象</span><h2>{evaluation?.candidate.version || '尚未登记受测版本'}</h2></div><span className={css.badge}>{evaluation?.testing.current ? '结果对应当前指纹' : '等待有效验证'}</span></header>
        <p>{evaluation?.candidate.summary || '开发出可运行版本后，记录本轮覆盖的功能范围；不据文件数量推算开发进度。'}</p>
        <dl className={css.facts}><div><dt>测试环境</dt><dd>{evaluation?.testing.environment || '尚未登记'}</dd></div><div><dt>必测指标</dt><dd>{required.length > 0 ? `${String(passed)} / ${String(required.length)} 项有通过记录及证据` : '尚未定义'}</dd></div></dl>
        {evaluation?.testing.fingerprint && <details>
          <summary>版本指纹与受测文件（{evaluation.candidate.sourceFiles.length}）</summary>
          <p className={css.muted}>指纹覆盖下列清单、环境与指标定义，不代表已扫描整个项目。</p>
          <code className={css.fingerprint}>{evaluation.testing.fingerprint}</code>
          {fileLinks(evaluation.candidate.sourceFiles)}
        </details>}
      </section>
      <section className={css.card} aria-label="项目运行情况">
        <header><div><span className={css.eyebrow}>项目运行</span><h2>{historical ? '历史运行不在此重放' : runtime ? RUNTIME_LABELS[runtime.status] : '运行状态尚未读取'}</h2></div></header>
        <p>{historical ? '此处不使用当前进程状态推断当时运行情况；请查看历史验证报告。' : runtime?.message || '复用现有项目运行能力。服务启动成功不代表测试或阶段验收通过。'}</p>
        {!historical && <div className={css.actions}>
          {runtime && <button type="button" className={css.primary} disabled={busy || transitioning} onClick={() => { runtimeAction(runtime.status === 'running' || (runtime.status === 'blocked' && runtime.action === 'stop') ? 'stopProject' : 'startProject') }}>{transitioning ? RUNTIME_LABELS[runtime.status] : runtime.status === 'running' ? '停止项目' : runtime.status === 'blocked' && runtime.action === 'stop' ? '重试停止' : '启动项目'}</button>}
          <button type="button" disabled={busy || !runtime?.previewUrl} onClick={() => { runtimeAction('openProjectPreview') }}>预览项目</button>
          <button type="button" disabled={busy || !runtime?.terminalTitle} onClick={() => { runtimeAction('showProjectTerminal') }}>查看终端</button>
          <button type="button" disabled={busy} onClick={() => { void perform(() => props.openProjectCapability(workspace.workspaceId, 'fde-architecture')) }}>系统架构</button>
        </div>}
      </section>
    </div>

    <section className={css.card} aria-label="测试指标与证据">
      <header><div><span className={css.eyebrow}>验证结果</span><h2>测试指标与证据</h2><p>展示项目实际需要的验证，不强制套用 AI 指标；通过记录仍需人工核对。</p></div>
        {!historical && <div className={css.actions}><button type="button" onClick={() => { prepare(surface.prompt) }}>{metrics.length ? '更新验证范围与指标' : '准备验证范围与指标'}</button><button type="button" disabled={busy} onClick={() => { void perform(() => props.openProjectCapability(workspace.workspaceId, 'fde-evaluation')) }}>评估优化</button></div>}
      </header>
      {metrics.length === 0 ? <div className={css.empty}><strong>尚无可展示的测试指标</strong><p>根据业务验收条件和当前实现准备指标；没有运行结果时保持“未运行”，不显示默认通过率。</p></div> : <div className={css.tableScroll} tabIndex={0} aria-label="测试指标表格，可横向滚动"><table>
        <thead><tr><th>验证项目</th><th>验收标准与依据</th><th>实际结果</th><th>状态与证据</th>{!historical && <th>操作</th>}</tr></thead>
        <tbody>{metrics.map(metric => <tr key={metric.id}>
          <td><strong>{metric.title}</strong><small>{metric.kind} · {metric.required ? '必测' : '补充验证'}</small></td>
          <td>{metric.criterion}{fileLinks(metric.sources)}</td>
          <td>{metric.value || '尚无实际结果'}</td>
          <td><span className={css.badge} data-status={metric.status}>{RESULT_LABELS[metric.status]}</span>{metric.status === 'PASS' && (!metric.value || !hasEvidence(metric.evidence)) && <p className={css.errorText}>通过记录缺少有效结果或证据</p>}{fileLinks(metric.evidence)}</td>
          {!historical && <td><button type="button" disabled={!evaluation?.testing.fingerprint} onClick={() => { prepare(`请加载 verification-plan，先读取 project_evaluation_get 和当前项目验证计划，核对指标 ${JSON.stringify(metric.id)}（${metric.title}）的受测范围、环境和权限。对这一项执行当前项目的真实验证，保存原始结果与证据；将本次开始前取得的 testing.fingerprint 写入 evaluation.testing.run。保留其他项的历史证据；如指纹已变，不得把旧结果改签为新版本。需要外部授权或付费调用时先询问，不代替 FDE 确认或推进阶段。`) }}>在对话中验证</button></td>}
        </tr>)}</tbody>
      </table></div>}
      {!historical && <p className={css.muted}>验证按钮只将指令放入 Agent 对话，确认发送后才执行；不是在后台自动运行测试。</p>}
    </section>

    <section className={css.card} aria-label="问题与阶段验收">
      <header><div><span className={css.eyebrow}>问题与阶段验收</span><h2>{historical ? '第五阶段已有结论与记录' : ready ? '证据已具备，等待 FDE 核对' : '还有哪些条件需要补齐'}</h2><p>判断能否进入企业集成与受控 Pilot，不是生产批准或客户最终验收。非关键待确认事项也保留供人工判断。</p></div><span className={css.badge}>{issues.length} 项待核对</span></header>
      {issues.length > 0 && <ul className={css.blockers}>{issues.map((item, index) => <li key={`${String(index)}-${item}`}>{item}</li>)}</ul>}
      <div className={css.artifacts}>{surface.artifacts.map(artifact => <button type="button" key={artifact.id} disabled={busy || artifact.status !== 'present'} onClick={() => { openFile(artifact.path, artifact.title) }}><strong>{artifact.title}</strong><small>{artifact.status === 'present' ? '查看已保存记录' : artifact.status === 'missing' ? '尚未形成' : '读取失败'}</small></button>)}</div>
      {!historical && <>
        <div className={css.actions}><button type="button" className={css.primary} disabled={!ready || busy} onClick={() => { setConfirming(true); setReturning(false) }}>提交 FDE 阶段验收</button><button type="button" disabled={busy} onClick={() => { setReturning(!returning); setConfirming(false) }}>返回上一阶段</button></div>
        {!ready && <p className={css.muted}>补齐当前版本的有效证据后开放验收；不会要求另行维护开发任务清单。</p>}
        {confirming && ready && <div className={css.confirm} role="group" aria-label="确认阶段验收"><strong>已核对本轮版本、实际结果、风险与权限？</strong><p>确认后进入第六阶段；后端会重新读取证据与阶段版本。</p><div className={css.actions}><button type="button" className={css.primary} disabled={busy} onClick={() => { void perform(() => props.completeV2Stage(workspace.workspaceId, stageState.revision, 'evaluation')) }}>确认并进入下一阶段</button><button type="button" disabled={busy} onClick={() => { setConfirming(false) }}>取消</button></div></div>}
        {returning && <div className={css.confirm}><label htmlFor="evaluation-return-reason">返回方案阶段的原因</label><textarea id="evaluation-return-reason" value={reason} onChange={(event) => { setReason(event.target.value) }} placeholder="说明哪些方案、范围或边界需要重新确认。" /><button type="button" disabled={busy || !reason.trim()} onClick={() => { void perform(() => props.returnV2Stage(workspace.workspaceId, stageState.revision, reason.trim())) }}>确认返回上一阶段</button></div>}
      </>}
    </section>
    <details className={css.card}><summary>方案依据与项目记录 · 按阶段查看</summary>{records(openFile)}</details>
    <footer className={css.footer}>@赋范空间 独家研发</footer>
  </section>
}
