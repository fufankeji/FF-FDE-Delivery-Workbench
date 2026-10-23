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

type IconKind = 'clipboard' | 'play' | 'shield' | 'cube' | 'target' | 'chat' | 'refresh' | 'terminal' | 'architecture' | 'chart' | 'file' | 'code' | 'database' | 'lock' | 'arrow' | 'info'

function EvaluationIcon({ kind }: { readonly kind: IconKind }) {
  const paths: Record<IconKind, ReactNode> = {
    clipboard: <><path d="M8 5H5v16h14V5h-3M9 3h6v4H9z" /><path d="M8 12h8M8 16h6" /></>,
    play: <><circle cx="12" cy="12" r="9" /><path d="m10 8 6 4-6 4z" /></>,
    shield: <><path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6z" /><path d="m8 11 3 3 5-6" /></>,
    cube: <><path d="m12 2 9 5v10l-9 5-9-5V7zM3 7l9 5 9-5M12 12v10" /></>,
    target: <><path d="M20 12a8 8 0 1 1-8-8M16 12a4 4 0 1 1-4-4M12 12l8-8M16 4h4v4" /></>,
    chat: <><path d="M3 4h18v13H10l-5 4v-4H3z" /><path d="M7 10h.01M12 10h.01M17 10h.01" /></>,
    refresh: <><path d="M20 4v6h-6M4 20v-6h6M4 9a8 8 0 0 1 14-5l2 3M4 17l2 3a8 8 0 0 0 14-5" /></>,
    terminal: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m7 9 3 3-3 3M13 15h4" /></>,
    architecture: <><rect x="9" y="2" width="6" height="5" rx="1" /><rect x="2" y="17" width="5" height="5" rx="1" /><rect x="10" y="17" width="5" height="5" rx="1" /><rect x="18" y="17" width="5" height="5" rx="1" /><path d="M12 7v5M4 17v-5h17v5M12 12v5" /></>,
    chart: <><path d="M4 20V11h4v9M11 20V7h4v13M18 20V3h4v17M3 7l6-4 5 1 6-3" /></>,
    file: <><path d="M5 2h9l5 5v15H5zM14 2v6h5M8 12h8M8 16h8" /></>,
    code: <><path d="m7 6-5 6 5 6M17 6l5 6-5 6M14 3l-4 18" /></>,
    database: <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0" /></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V6a4 4 0 0 1 8 0v4M12 14v3" /></>,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7h.01" /></>,
  }
  return <svg className={css.icon} aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{paths[kind]}</svg>
}

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
    <header className={css.hero} data-evaluation-hero="">
      <div className={css.heroCopy} data-evaluation-title-group="">
        <span className={css.eyebrow}>第 5/8 阶段 · 运行 PoC 与 Eval</span>
        <div className={css.heroTitle}><h1 data-evaluation-title="">项目运行与验证</h1><span className={css.badge} data-status={ready ? 'PASS' : 'WARN'}>{historical ? '历史阶段记录' : ready ? '等待人工验收' : evaluation?.status === 'invalid' ? '记录待修正' : '等待测试结果'}</span></div>
        <p data-evaluation-intro="">开发在 Agent 对话中进行；这里查看项目成果、测试证据和进入下一阶段的条件。</p>
      </div>
      <div className={css.heroArt} data-evaluation-hero-art="" aria-hidden="true"><img src="/fde-dashboard/evaluation-lab.webp" alt="" width="768" height="512" /></div>
      <div className={css.heroProgress} data-evaluation-progress=""><div><strong>05</strong><span>/ 08</span></div><span>{historical ? '历史阶段' : '当前阶段'}</span></div>
      <button type="button" data-evaluation-refresh="" disabled={busy} onClick={() => { props.refreshProjectSurface(workspace.workspaceId) }}><EvaluationIcon kind="refresh" />刷新阶段记录</button>
    </header>
    {error && <div className={css.error} role="alert">{error}</div>}
    {evaluation?.status === 'invalid' && <div className={css.error} role="alert">{evaluation.message}</div>}

    <div className={css.overview}>
      <section className={css.card} aria-label="本轮受测范围与版本">
        <header><div><span className={css.eyebrow}><EvaluationIcon kind="clipboard" />01 / 本轮受测对象</span><div className={css.candidateTitle}><h2>{evaluation?.candidate.version || '尚未登记受测版本'}</h2><span className={css.badge} data-status={evaluation?.candidate.version ? undefined : 'WARN'}>{evaluation?.testing.current ? '结果对应当前版本' : evaluation?.candidate.version ? '已登记' : '待登记'}</span></div></div></header>
        <p>{evaluation?.candidate.summary || '记录本轮可运行版本与功能范围，不依据文件数量推算开发进度。'}</p>
        <dl className={css.facts}><div><EvaluationIcon kind="cube" /><div><dt>测试环境</dt><dd>{evaluation?.testing.environment || '尚未登记'}</dd></div></div><div><EvaluationIcon kind="target" /><div><dt>必测指标</dt><dd>{required.length > 0 ? `${String(passed)} / ${String(required.length)} 项有通过记录及证据` : '尚未定义'}</dd></div></div></dl>
        {!historical && <button type="button" className={css.textAction} onClick={() => { prepare(surface.prompt) }}><EvaluationIcon kind="chat" />前往 Agent 对话补充记录<EvaluationIcon kind="arrow" /></button>}
        {evaluation?.testing.fingerprint && <details>
          <summary>版本校验值与受测文件（{evaluation.candidate.sourceFiles.length}）</summary>
          <p className={css.muted}>校验值根据下列文件、测试环境和指标定义计算，不包括清单之外的项目文件。</p>
          <code className={css.fingerprint}>{evaluation.testing.fingerprint}</code>
          {fileLinks(evaluation.candidate.sourceFiles)}
        </details>}
      </section>
      <section className={css.card} aria-label="项目运行情况">
        <header><div><span className={css.eyebrow}><EvaluationIcon kind="play" />02 / 项目运行</span><h2 className={css.runtimeTitle}><i className={css.runtimeDot} data-running={!historical && runtime?.status === 'running' || undefined} />{historical ? '历史运行不在此重放' : runtime ? RUNTIME_LABELS[runtime.status] : '运行状态尚未读取'}</h2></div></header>
        <p>{historical ? '此处不使用当前进程状态推断当时运行情况；请查看历史验证报告。' : runtime?.message || '通过下方操作启动或查看项目。服务启动成功不代表测试或阶段验收通过。'}</p>
        {!historical && <div className={`${css.actions} ${css.runtimeActions}`} data-evaluation-runtime-actions="">
          {runtime && <button type="button" className={css.primary} disabled={busy || transitioning} onClick={() => { runtimeAction(runtime.status === 'running' || (runtime.status === 'blocked' && runtime.action === 'stop') ? 'stopProject' : 'startProject') }}><EvaluationIcon kind="play" />{transitioning ? RUNTIME_LABELS[runtime.status] : runtime.status === 'running' ? '停止项目' : runtime.status === 'blocked' && runtime.action === 'stop' ? '重试停止' : '启动项目'}</button>}
          <button type="button" disabled={busy || !runtime?.previewUrl} onClick={() => { runtimeAction('openProjectPreview') }}><EvaluationIcon kind="terminal" />预览项目</button>
          <button type="button" disabled={busy || !runtime?.terminalTitle} onClick={() => { runtimeAction('showProjectTerminal') }}><EvaluationIcon kind="terminal" />{props.t('runtime.terminal')}</button>
          <button type="button" disabled={busy} onClick={() => { void perform(() => props.openProjectCapability(workspace.workspaceId, 'fde-architecture')) }}><EvaluationIcon kind="architecture" />系统架构</button>
        </div>}
      </section>
    </div>

    <section className={`${css.card} ${css.verification}`} aria-label="测试指标与证据">
      <header><div><span className={css.eyebrow}><EvaluationIcon kind="shield" />03 / 验证结果</span><h2>测试指标与证据</h2><p>按项目实际需要设置验证指标，通过记录仍需人工核对。</p></div>
        {!historical && <div className={css.actions}><button type="button" className={css.primary} onClick={() => { prepare(surface.prompt) }}><EvaluationIcon kind="target" />{metrics.length ? '更新验证范围与指标' : '准备验证范围与指标'}</button><button type="button" disabled={busy} onClick={() => { void perform(() => props.openProjectCapability(workspace.workspaceId, 'fde-evaluation')) }}><EvaluationIcon kind="chart" />评估优化</button></div>}
      </header>
      {metrics.length === 0 ? <div className={css.empty}><span className={css.emptyIcon}><EvaluationIcon kind="clipboard" /><EvaluationIcon kind="target" /></span><div><div className={css.emptyTitle}><strong>尚无可展示的测试指标</strong><span className={css.badge}>未运行</span></div><p>根据业务验收条件和当前实现准备指标；结果产生前保持“未运行”。</p></div></div> : <div className={css.tableScroll} role="region" tabIndex={0} aria-label="测试指标表格，可上下和左右滚动"><table>
        <thead><tr><th>验证项目</th><th>验收标准与依据</th><th>实际结果</th><th>状态与证据</th>{!historical && <th>操作</th>}</tr></thead>
        <tbody>{metrics.map(metric => <tr key={metric.id}>
          <td><strong>{metric.title}</strong><small>{metric.kind} · {metric.required ? '必测' : '补充验证'}</small></td>
          <td>{metric.criterion}{fileLinks(metric.sources)}</td>
          <td>{metric.value || '尚无实际结果'}</td>
          <td><span className={css.badge} data-status={metric.status}>{RESULT_LABELS[metric.status]}</span>{metric.status === 'PASS' && (!metric.value || !hasEvidence(metric.evidence)) && <p className={css.errorText}>通过记录缺少有效结果或证据</p>}{fileLinks(metric.evidence)}</td>
          {!historical && <td><button type="button" disabled={!evaluation?.testing.fingerprint} onClick={() => { prepare(`请加载 verification-plan，先读取 project_evaluation_get 和当前项目验证计划，核对指标 ${JSON.stringify(metric.id)}（${metric.title}）的受测范围、环境和权限。对这一项执行当前项目的真实验证，保存原始结果与证据；将本次开始前取得的 testing.fingerprint 写入 evaluation.testing.run。保留其他项的历史证据；如指纹已变，不得把旧结果改签为新版本。需要外部授权或付费调用时先询问，不代替 FDE 确认或推进阶段。`) }}>在对话中验证</button></td>}
        </tr>)}</tbody>
      </table></div>}
      {!historical && <p className={css.actionHint}><EvaluationIcon kind="chat" />验证操作仅将指令填入 Agent 对话，确认发送后才执行。</p>}
    </section>

    <section className={`${css.card} ${css.review}`} aria-label="问题与阶段验收">
      <header><div><span className={css.eyebrow}><EvaluationIcon kind="shield" />04 / 问题与阶段验收</span><h2>{historical ? '第五阶段已有结论与记录' : ready ? '证据已具备，等待 FDE 核对' : '补齐当前版本的证据，再提交阶段验收'}</h2><p>用于判断能否进入企业集成与受控试点（Pilot）；不等于生产批准或客户最终验收。</p></div><span className={css.badge} data-status={ready ? 'PASS' : 'WARN'}>{issues.length} 项待核对</span></header>
      <div className={css.reviewGroups}>
        <section className={css.reviewGroup} aria-label="登记信息"><h3>登记信息</h3><div className={css.registrationRow}><b>01</b><EvaluationIcon kind="file" /><div><strong>受测版本与指标</strong><small>{evaluation?.candidate.version || '请在 Agent 对话中按实际项目情况补充记录。'}</small></div><span className={css.badge} data-status={evaluation?.candidate.version && required.length ? 'PASS' : 'WARN'}>{evaluation?.candidate.version && required.length ? '已登记' : '尚未登记'}</span></div>
        <div className={css.registrationRow}><b>02</b><EvaluationIcon kind="code" /><div><strong>阶段状态记录</strong><code>{surface.statePath}</code></div><span className={css.badge} data-status={surface.stateStatus === 'ready' ? 'PASS' : 'WARN'}>{surface.stateStatus === 'ready' ? '已生成' : surface.stateStatus === 'invalid' ? '读取失败' : '尚未生成'}</span></div></section>
        <section className={css.reviewGroup} aria-label="验收材料"><h3>验收材料</h3><div className={css.artifacts}>{surface.artifacts.map((artifact, index) => <button type="button" key={artifact.id} disabled={busy || artifact.status !== 'present'} onClick={() => { openFile(artifact.path, artifact.title) }}><b>{String(index + 3).padStart(2, '0')}</b><EvaluationIcon kind={index === 0 ? 'clipboard' : index === 2 ? 'database' : 'file'} /><span><strong>{artifact.title}</strong><small>{artifact.status === 'present' ? '查看已保存记录' : artifact.status === 'missing' ? '尚未形成' : '读取失败'}</small></span></button>)}</div><p className={css.reviewNote}><EvaluationIcon kind="info" />非关键待确认事项保留人工判断。</p></section>
      </div>
      {issues.length > 0 && <details className={css.issueDetails}><summary>查看 {issues.length} 项待核对条件详情</summary><ul className={css.blockers}>{issues.map((item, index) => <li key={`${String(index)}-${item}`}>{item}</li>)}</ul></details>}
      {!historical && <>
        <div className={css.reviewActions}><div className={css.actions}><button type="button" className={css.primary} disabled={!ready || busy} onClick={() => { setConfirming(true); setReturning(false) }}><EvaluationIcon kind={ready ? 'shield' : 'lock'} />提交 FDE 阶段验收</button><button type="button" disabled={busy} onClick={() => { setReturning(!returning); setConfirming(false) }}>返回上一阶段</button></div>{!ready && <p>补齐当前版本的有效证据后开放验收。</p>}</div>
        {confirming && ready && <div className={css.confirm} role="group" aria-label="确认阶段验收"><strong>已核对本轮版本、实际结果、风险与权限？</strong><p>确认后进入第六阶段；提交时将重新检查证据是否仍对应当前版本。</p><div className={css.actions}><button type="button" className={css.primary} disabled={busy} onClick={() => { void perform(() => props.completeV2Stage(workspace.workspaceId, stageState.revision, 'evaluation')) }}>确认并进入下一阶段</button><button type="button" disabled={busy} onClick={() => { setConfirming(false) }}>取消</button></div></div>}
        {returning && <div className={css.confirm}><label htmlFor="evaluation-return-reason">返回方案阶段的原因</label><textarea id="evaluation-return-reason" value={reason} onChange={(event) => { setReason(event.target.value) }} placeholder="说明哪些方案、功能范围或权限需要重新确认。" /><button type="button" disabled={busy || !reason.trim()} onClick={() => { void perform(() => props.returnV2Stage(workspace.workspaceId, stageState.revision, reason.trim())) }}>确认返回上一阶段</button></div>}
      </>}
    </section>
    <details className={`${css.card} ${css.records}`} data-evaluation-records=""><summary><EvaluationIcon kind="file" />方案依据与项目记录 · 按阶段查看</summary>{records(openFile)}</details>
    <footer className={css.footer} data-evaluation-footer="">@赋范空间 独家研发</footer>
  </section>
}
