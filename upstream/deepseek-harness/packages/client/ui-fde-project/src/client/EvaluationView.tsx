/** Project evaluation cases, reports, and explicit run entry. */

import { useState } from 'react'
import type { CSSProperties } from 'react'
import type { EvaluationReportSummary, ValidationMetricCategory, ValidationMetricStatus } from './controller.ts'
import type { ProjectViewProps } from './slots.ts'
import { ProjectViewHeader, ProjectViewState } from './view-state.tsx'
import css from './project.module.css'

function statusLabel(status: EvaluationReportSummary['status']): string {
  switch (status) {
    case 'PASS': return '通过'
    case 'WARN': return '需关注'
    case 'FAIL': return '未通过'
    case 'N/A': return '无基线'
    case 'UNKNOWN': return '未知'
  }
}

function caseStatusLabel(status: string): string {
  if (status === 'pass') return '通过'
  if (status === 'fail') return '失败'
  if (status === 'error') return '错误'
  return status
}

const VALIDATION_CATEGORY_LABELS: Readonly<Record<ValidationMetricCategory, string>> = {
  business: '业务', functional: '功能', data: '数据', model: '模型', performance: '性能',
  security: '安全', recovery: '恢复', agent: 'Agent',
}

const VALIDATION_CATEGORIES = Object.keys(VALIDATION_CATEGORY_LABELS) as ValidationMetricCategory[]
const VALIDATION_STATUSES: readonly ValidationMetricStatus[] = ['PASS', 'WARN', 'FAIL', 'NOT_RUN']

type ProgressStyle = CSSProperties & { readonly '--progress': string }

function progressStyle(value: number): ProgressStyle {
  return { '--progress': `${String(Math.max(0, Math.min(100, value)))}%` }
}

function validationStatusLabel(status: ValidationMetricStatus): string {
  if (status === 'PASS') return '通过'
  if (status === 'WARN') return '有条件通过'
  if (status === 'FAIL') return '未通过'
  return '待执行'
}

/** Present project-scoped regression evidence and ask the current Agent to run it only after a user click. */
export function EvaluationView(props: ProjectViewProps) {
  const [submitting, setSubmitting] = useState(false)
  const [workflowPending, setWorkflowPending] = useState<'prepare' | 'confirm' | 'start'>()
  const [baselinePending, setBaselinePending] = useState(false)
  const [showRunConfirm, setShowRunConfirm] = useState(false)
  const [notice, setNotice] = useState('')
  const [metricStatusFilter, setMetricStatusFilter] = useState<'ALL' | ValidationMetricStatus>('ALL')
  const [metricCategoryFilter, setMetricCategoryFilter] = useState<'ALL' | ValidationMetricCategory>('ALL')
  const sessionRunning = props.useSessions(state => state.byId[props.sessionId]?.running ?? false)
  return (
    <ProjectViewState props={props}>{(snapshot, workspace) => {
      const evaluation = snapshot.evaluation
      const validation = snapshot.validation
      const metrics = validation.contract.metrics
      const statusCounts = Object.fromEntries(VALIDATION_STATUSES.map(status => [
        status,
        metrics.filter(metric => metric.status === status).length,
      ])) as Record<ValidationMetricStatus, number>
      const executedCount = metrics.length - statusCounts.NOT_RUN
      const evidenceCount = metrics.filter(metric => metric.evidenceAvailable).length
      const metricCompletion = validation.requiredMetricCount === 0
        ? 0
        : Math.round(validation.satisfiedMetricCount / validation.requiredMetricCount * 100)
      const evidenceCoverage = metrics.length === 0 ? 0 : Math.round(evidenceCount / metrics.length * 100)
      const artifactCoverage = validation.artifacts.requiredCount === 0
        ? 0
        : Math.round(validation.artifacts.presentCount / validation.artifacts.requiredCount * 100)
      const categoryStats = VALIDATION_CATEGORIES.map((category) => {
        const items = metrics.filter(metric => metric.category === category)
        const completed = items.filter(metric => metric.status !== 'NOT_RUN').length
        return { category, count: items.length, completed }
      }).filter(item => item.count > 0)
      const filteredMetrics = metrics.filter(metric => (
        (metricStatusFilter === 'ALL' || metric.status === metricStatusFilter)
        && (metricCategoryFilter === 'ALL' || metric.category === metricCategoryFilter)
      ))
      const flowSteps = [
        { label: '评估方案', detail: validation.planReady ? '已生成' : '待生成', complete: validation.planReady },
        {
          label: 'FDE 确认',
          detail: validation.planApproval.status === 'confirmed' ? '已确认' : validation.planApproval.status === 'stale' ? '需重审' : '待确认',
          complete: validation.planApproval.status === 'confirmed',
        },
        { label: '真实验证', detail: `${String(executedCount)}/${String(metrics.length)} 已执行`, complete: metrics.length > 0 && executedCount === metrics.length },
        { label: '证据归档', detail: `${String(evidenceCount)}/${String(metrics.length)} 已留证`, complete: metrics.length > 0 && evidenceCount === metrics.length },
        {
          label: '阶段产物',
          detail: `${String(validation.artifacts.presentCount)}/${String(validation.artifacts.requiredCount)} 已生成`,
          complete: validation.artifacts.presentCount === validation.artifacts.requiredCount,
        },
      ]
      const currentFlowIndex = flowSteps.findIndex(step => !step.complete)
      const latest = evaluation.reports[0]
      const comparison = latest === undefined || evaluation.baseline === undefined
        ? []
        : latest.cases.map((item) => {
          const before = evaluation.baseline?.cases.find(candidate => candidate.name === item.name)
          const change = before === undefined ? '新增' : before.status === item.status ? '未变化' : before.status === 'pass' ? '回归' : item.status === 'pass' ? '改善' : '变化'
          return { name: item.name, before: before?.status ?? '—', after: item.status, change }
        })
      const runWorkflow = (action: 'prepare' | 'confirm' | 'start', operation: () => Promise<void>, success: string): void => {
        if (workflowPending !== undefined) return
        setWorkflowPending(action)
        setNotice('')
        void operation().then(
          () => { setNotice(success) },
          (error: unknown) => { setNotice(error instanceof Error ? error.message : String(error)) },
        ).finally(() => { setWorkflowPending(undefined) })
      }
      const approveBaseline = (): void => {
        if (latest === undefined || baselinePending) return
        setBaselinePending(true)
        setNotice('')
        void props.approveEvaluationBaseline(workspace.workspaceId, latest.path).then(
          () => { setNotice(`已将报告 ${latest.id} 设为当前项目基线。`) },
          (error: unknown) => { setNotice(error instanceof Error ? error.message : String(error)) },
        ).finally(() => { setBaselinePending(false) })
      }
      const run = (): void => {
        if (submitting || sessionRunning || evaluation.casesCount === 0) return
        setShowRunConfirm(false)
        setSubmitting(true)
        setNotice('')
        void props.runProjectEvaluation(workspace.path).then(
          () => { setNotice('评估任务已提交到当前会话。Agent 完成后点击“刷新报告”。') },
          (error: unknown) => { setNotice(error instanceof Error ? error.message : String(error)) },
        ).finally(() => { setSubmitting(false) })
      }
      return (
        <section className={css.surfaceRoot}>
          <ProjectViewHeader
            eyebrow={workspace.title}
            title="项目评估优化"
            description="围绕当前候选版本组织指标、真实运行、证据与问题，形成进入部署试运行前可审阅的验证结论。"
            onRefresh={() => { props.refreshProjectSurface(workspace.workspaceId) }}
            refreshLabel="刷新报告"
          />
          <section className={css.validationWorkflow} aria-label="评估流程">
            <article className={css.validationStep} data-status={validation.planReady ? 'complete' : 'current'}>
              <span>1</span>
              <div><strong>生成评估方案</strong><p>从已确认文档提取指标、阈值、方法和来源，形成待确认方案。</p></div>
              <button
                type="button"
                className={css.secondaryButton}
                disabled={workflowPending !== undefined || sessionRunning}
                onClick={() => { runWorkflow('prepare', props.prepareValidationPlan, validation.planReady ? '已提交重新整理评估方案的任务，请在对话完成后刷新页面。' : '已提交生成评估方案的任务，请在对话完成后刷新页面。') }}
              >{workflowPending === 'prepare' ? '正在提交…' : validation.planReady ? '重新生成方案' : '生成评估方案'}</button>
            </article>
            <article className={css.validationStep} data-status={validation.planApproval.status === 'confirmed' ? 'complete' : validation.planReady ? 'current' : 'waiting'}>
              <span>2</span>
              <div><strong>确认评估方案</strong><p>{validation.planApproval.status === 'confirmed'
                ? '当前指标、阈值和来源已经由 FDE 确认。'
                : validation.planApproval.status === 'stale'
                  ? '方案已变更，请重新核对后确认。'
                  : 'FDE 核对指标来源和执行边界后，确认当前版本。'}</p></div>
              <button
                type="button"
                className={css.secondaryButton}
                disabled={!validation.planReady || validation.contract.digest === undefined || validation.planApproval.status === 'confirmed' || workflowPending !== undefined}
                onClick={() => {
                  const digest = validation.contract.digest
                  if (digest === undefined) return
                  runWorkflow('confirm', async () => { await props.confirmValidationPlan(workspace.workspaceId, digest) }, '当前评估方案已由 FDE 确认。')
                }}
              >{workflowPending === 'confirm' ? '正在确认…' : validation.planApproval.status === 'confirmed' ? '已确认' : validation.planApproval.status === 'stale' ? '重新确认方案' : '确认评估方案'}</button>
            </article>
            <article className={css.validationStep} data-status={validation.planApproval.status === 'confirmed' ? 'current' : 'waiting'}>
              <span>3</span>
              <div><strong>开始验证</strong><p>按已确认方案执行真实检查，保存证据并更新报告；不适用的检查保留原因。</p></div>
              <button
                type="button"
                className={css.primaryButton}
                disabled={validation.planApproval.status !== 'confirmed' || workflowPending !== undefined || sessionRunning}
                onClick={() => { runWorkflow('start', props.startValidation, '验证任务已提交到当前对话，请在 Agent 完成后刷新报告。') }}
              >{workflowPending === 'start' ? '正在提交…' : sessionRunning ? '当前会话运行中' : '开始验证'}</button>
            </article>
          </section>
          {validation.contract.status !== 'ready' && (
            <p className={css.actionNotice} data-error>{validation.contract.message ?? '验证合同尚未就绪。'}</p>
          )}

          <section className={css.validationOverview} aria-label="验证总览">
            <article className={css.validationProgressCard}>
              <header><div><span>必需指标完成度</span><strong>{validation.gateReady ? '已满足评审条件' : '验证进行中'}</strong></div><b>{validation.satisfiedMetricCount}/{validation.requiredMetricCount}</b></header>
              <div className={css.validationProgressBody}>
                <div className={css.validationRing} style={progressStyle(metricCompletion)}>
                  <div><strong>{metricCompletion}%</strong><span>已满足</span></div>
                </div>
                <div className={css.validationProgressCopy}>
                  <p>必需指标同时具备合格结果和可读取证据后才计入完成。</p>
                  <div className={css.validationLinearTrack}><span style={progressStyle(metricCompletion)} /></div>
                  <small>{validation.requiredMetricCount - validation.satisfiedMetricCount} 项必需指标仍待完成</small>
                </div>
              </div>
            </article>
            <div className={css.validationKpiGrid}>
              <article data-tone="business"><span>已执行指标</span><strong>{executedCount}<small>/{metrics.length}</small></strong><p>{statusCounts.NOT_RUN} 项仍待运行</p></article>
              <article data-tone="success"><span>证据覆盖</span><strong>{evidenceCoverage}<small>%</small></strong><p>{evidenceCount}/{metrics.length} 项已登记证据</p></article>
              <article data-tone="neutral"><span>阶段产物</span><strong>{validation.artifacts.presentCount}<small>/{validation.artifacts.requiredCount}</small></strong><p>{artifactCoverage}% 已生成</p></article>
              <article data-tone={validation.blockers.length > 0 ? 'warn' : 'success'}><span>当前阻塞</span><strong>{validation.blockers.length}</strong><p>{validation.gateReady ? '可以提交阶段确认' : '需要处理后再提交'}</p></article>
            </div>
          </section>

          <section className={css.validationFlowPanel} aria-label="验证推进情况">
            <header><div><h2>验证推进</h2><p>每一步都来自当前项目的真实状态，不按时间推算。</p></div><span>{currentFlowIndex === -1 ? '全部就绪' : `当前：${flowSteps[currentFlowIndex]?.label ?? '待确认'}`}</span></header>
            <div className={css.validationFlowTrack}>{flowSteps.map((step, index) => (
              <div key={step.label} data-state={step.complete ? 'complete' : index === currentFlowIndex ? 'current' : 'waiting'}>
                <i>{step.complete ? '✓' : index + 1}</i><strong>{step.label}</strong><small>{step.detail}</small>
              </div>
            ))}</div>
          </section>

          <section className={css.validationContextPanel}>
            <header><div><h2>本轮运行上下文</h2><p>结果只对以下候选版本、环境和输入有效。</p></div><code>{validation.contract.path}</code></header>
            <div className={css.validationContextGrid}>
              <article><span>候选版本</span><strong>{validation.contract.candidateId ?? '待登记'}</strong><p>{validation.contract.candidateSource ?? '尚未登记候选版本来源'}</p></article>
              <article><span>验证环境</span><strong>{validation.contract.environment ?? '待登记'}</strong><p>环境变化会使当前评估方案需要重新确认</p></article>
              <article><span>数据与用例</span><strong>{validation.contract.datasets.length} 组</strong><div>{validation.contract.datasets.length === 0 ? <em>当前项目未登记独立数据集</em> : validation.contract.datasets.map(dataset => <b key={dataset.id}>{dataset.name}{dataset.version === undefined ? '' : ` · ${dataset.version}`}</b>)}</div></article>
            </div>
          </section>

          <section className={css.validationCharts}>
            <article className={css.validationChartCard}>
              <header><div><h2>结果分布</h2><p>{metrics.length} 项指标的当前执行状态</p></div></header>
              <div className={css.validationStatusBars}>{VALIDATION_STATUSES.map((status) => {
                const count = statusCounts[status]
                const percent = metrics.length === 0 ? 0 : Math.round(count / metrics.length * 100)
                return <div key={status} data-status={status}>
                  <span>{validationStatusLabel(status)}</span>
                  <div><i style={progressStyle(percent)} /></div>
                  <strong>{count}</strong><small>{percent}%</small>
                </div>
              })}</div>
            </article>
            <article className={css.validationChartCard}>
              <header><div><h2>指标类别</h2><p>查看各类指标的实际执行覆盖</p></div></header>
              {categoryStats.length === 0
                ? <div className={css.validationChartEmpty}>尚未登记指标类别</div>
                : <div className={css.validationCategoryGrid}>{categoryStats.map((item) => {
                  const percent = Math.round(item.completed / item.count * 100)
                  return <div key={item.category} data-category={item.category}>
                    <header><span>{VALIDATION_CATEGORY_LABELS[item.category]}</span><strong>{item.completed}/{item.count}</strong></header>
                    <div><i style={progressStyle(percent)} /></div><small>{percent}% 已执行</small>
                  </div>
                })}</div>}
            </article>
          </section>

          {validation.blockers.length > 0 && (
            <section className={css.validationBlockers} role="status">
              <header><span>!</span><div><h2>进入部署试运行前仍有 {validation.blockers.length} 个阻塞</h2><p>处理后刷新报告，系统会按当前结果重新检查评审条件。</p></div></header>
              <div>{validation.blockers.map((blocker, index) => <p key={blocker}><b>{index + 1}</b>{blocker}</p>)}</div>
            </section>
          )}

          <section className={css.validationMetricSection}>
            <header className={css.validationMetricHeader}>
              <div><h2>本轮验证指标</h2><p>筛选只改变当前页面展示，不修改验证合同。</p></div>
              <span>{filteredMetrics.length}/{metrics.length} 项</span>
            </header>
            <div className={css.validationFilters}>
              <div aria-label="按结果筛选">
                <button type="button" aria-pressed={metricStatusFilter === 'ALL'} onClick={() => { setMetricStatusFilter('ALL') }}>全部 <b>{metrics.length}</b></button>
                {VALIDATION_STATUSES.map(status => <button key={status} type="button" data-status={status} aria-pressed={metricStatusFilter === status} onClick={() => { setMetricStatusFilter(status) }}>{validationStatusLabel(status)} <b>{statusCounts[status]}</b></button>)}
              </div>
              <div aria-label="按类别筛选">
                <button type="button" aria-pressed={metricCategoryFilter === 'ALL'} onClick={() => { setMetricCategoryFilter('ALL') }}>全部类别</button>
                {categoryStats.map(item => <button key={item.category} type="button" aria-pressed={metricCategoryFilter === item.category} onClick={() => { setMetricCategoryFilter(item.category) }}>{VALIDATION_CATEGORY_LABELS[item.category]} <b>{item.count}</b></button>)}
              </div>
            </div>
            {metrics.length === 0
              ? <div className={css.outputState}>尚未定义本项目的验证指标。请先点击“生成评估方案”。</div>
              : filteredMetrics.length === 0
                ? <div className={css.outputState}>当前筛选条件下没有指标。</div>
                : <div className={css.validationMetricList}>{filteredMetrics.map(metric => (
                  <article key={metric.id} className={css.validationMetricCard} data-status={metric.status}>
                    <header>
                      <div className={css.validationMetricIdentity}>
                        <span data-category={metric.category}>{VALIDATION_CATEGORY_LABELS[metric.category]}</span>
                        <div><h3>{metric.name}</h3><p>{metric.id} · {metric.required ? '必需指标' : '可选指标'}</p></div>
                      </div>
                      <span className={css.reportStatus} data-status={metric.status}>{validationStatusLabel(metric.status)}</span>
                    </header>
                    <div className={css.validationMetricBody}>
                      <section><span>验证方法</span><p>{metric.method}</p></section>
                      <section>
                        <span>通过标准</span><p>{metric.threshold}</p>
                        {metric.value === undefined ? null : <strong>当前结果：{metric.value}</strong>}
                      </section>
                      <section><span>指标来源</span>{metric.sources.map(source => <div key={`${source.path}-${source.references.join('-')}`}><code>{source.path}</code><p>{source.references.join('、')}{source.available ? '' : ' · 文件不可读取'}</p></div>)}</section>
                      <section><span>验证证据</span>{metric.evidenceAvailable ? <code>{metric.evidence}</code> : <p>{metric.evidence === undefined ? '尚未登记证据' : `证据不可读取：${metric.evidence}`}</p>}{metric.waiverReason === undefined ? null : <strong>接受理由：{metric.waiverReason}</strong>}</section>
                    </div>
                  </article>
                ))}</div>}
          </section>
          {validation.contract.issues.length > 0 && (
            <div className={css.tableSection}>
              <div className={css.sectionHeading}><div><h2>验证问题</h2><p>critical/high 问题未关闭时不能进入部署试运行。</p></div></div>
              <div className={css.tableScroll}><table className={css.dataTable}>
                <thead><tr><th>问题</th><th>级别</th><th>状态</th><th>处理说明或证据</th></tr></thead>
                <tbody>{validation.contract.issues.map(issue => (
                  <tr key={issue.id}><td><strong>{issue.title}</strong><small>{issue.id}</small></td><td>{issue.severity}</td><td>{issue.status}</td><td>{issue.resolution ?? issue.evidence ?? '—'}</td></tr>
                ))}</tbody>
              </table></div>
            </div>
          )}
          <div className={css.fixedCasesHeader}>
            <div><h2>固定用例回归</h2><p>可选的重复验证方法；没有固定用例不会阻止使用其他方式完成本轮验证。</p></div>
            <button
              type="button"
              className={css.secondaryButton}
              disabled={submitting || sessionRunning || evaluation.casesCount === 0}
              onClick={() => { setShowRunConfirm(true) }}
            >{submitting ? '正在提交…' : '运行固定用例'}</button>
          </div>
          <div className={css.evaluationNotice}>
            <strong>运行固定用例会调用真实 Agent 和模型</strong>
            <p>这里只在你点击“运行固定用例”并再次确认后提交任务，可能产生模型费用；页面加载和自动测试不会触发调用。</p>
          </div>
          {showRunConfirm && (
            <div className={css.runConfirmation} role="dialog" aria-label="确认运行固定用例">
              <div>
                <strong>确认运行 {evaluation.casesCount} 个固定用例</strong>
                <p>评估使用当前会话 Agent 的模型配置，串行创建隔离 Headless Trial，并把新报告写入当前项目。模型调用可能产生费用。</p>
              </div>
              <div>
                <button type="button" className={css.secondaryButton} onClick={() => { setShowRunConfirm(false) }}>暂不运行</button>
                <button type="button" className={css.primaryButton} onClick={run}>确认并运行固定用例</button>
              </div>
            </div>
          )}
          {sessionRunning && (
            <p className={css.actionNotice} role="status">
              当前会话正在执行任务。当前评估插件不提供可靠的独立取消，页面不会显示假取消；请等待本轮结束，已完成报告会保留。
            </p>
          )}
          {notice !== '' && <p className={css.actionNotice} role="status">{notice}</p>}
          <div className={css.metricGrid}>
            <article>
              <span>评估用例</span><strong>{evaluation.casesCount}</strong><small><code>.fde/evaluations/cases</code></small>
            </article>
            <article>
              <span>历史报告</span><strong>{evaluation.reports.length}</strong><small>最近保留 20 次</small>
            </article>
            <article>
              <span>最新结果</span>
              <strong data-status={latest?.status}>{latest === undefined ? '—' : statusLabel(latest.status)}</strong>
              <small>{latest === undefined ? '尚未运行' : new Date(latest.updatedAt).toLocaleString('zh-CN')}</small>
            </article>
            <article>
              <span>对比基线</span>
              <strong>{evaluation.baseline === undefined ? '未设置' : statusLabel(evaluation.baseline.status)}</strong>
              <small>{evaluation.baseline === undefined
                ? '首次评估可先形成基线'
                : `${String(evaluation.baseline.total)} 个基线用例`}</small>
            </article>
          </div>
          {evaluation.casesCount === 0 && evaluation.reports.length === 0 && (
            <div className={css.emptyArtifact}>
              <span className={css.emptyArtifactIcon}>✓</span>
              <h2>尚未建立固定用例</h2>
              <p>需要重复回归时，可把关键业务路径写成 YAML 用例并放入 <code>.fde/evaluations/cases</code>；这不影响使用其他验证方法。</p>
            </div>
          )}
          {latest !== undefined && (
            <div className={css.latestReport}>
              <div className={css.sectionHeading}>
                <div><h2>最新评估结果</h2><p><code>{latest.path}</code></p></div>
                <div className={css.headerActions}>
                  <span className={css.reportStatus} data-status={latest.status}>{statusLabel(latest.status)}</span>
                  <button
                    type="button"
                    className={css.secondaryButton}
                    disabled={baselinePending}
                    onClick={approveBaseline}
                  >
                    {baselinePending ? '正在设置…' : '设为当前基线'}
                  </button>
                </div>
              </div>
              <div className={css.reportSummary}>
                <span><b>{latest.passed}</b> 通过</span>
                <span><b>{latest.failed}</b> 失败</span>
                <span><b>{latest.errors}</b> 错误</span>
                <span><b>{latest.total}</b> 合计</span>
              </div>
              {latest.cases.length > 0 && (
                <div className={css.tableScroll}>
                  <table className={css.dataTable}>
                    <thead><tr><th>用例</th><th>结果</th><th>说明</th></tr></thead>
                    <tbody>{latest.cases.map(item => (
                      <tr key={item.name}>
                        <td><strong>{item.name}</strong></td>
                        <td>
                          <span className={css.caseStatus} data-status={item.status}>{caseStatusLabel(item.status)}</span>
                        </td>
                        <td>{item.error ?? (item.failures.join('；') || '—')}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </div>
          )}
          {evaluation.reports.length > 1 && (
            <div className={css.tableSection}>
              <div className={css.sectionHeading}><div><h2>历史报告</h2><p>按更新时间从新到旧排列。</p></div></div>
              <div className={css.tableScroll}>
                <table className={css.dataTable}>
                  <thead><tr><th>报告</th><th>结果</th><th>通过</th><th>失败/错误</th><th>更新时间</th></tr></thead>
                  <tbody>{evaluation.reports.map(report => (
                    <tr key={`${report.id}-${report.updatedAt}`}>
                      <td><code>{report.id}</code></td>
                      <td><span className={css.reportStatus} data-status={report.status}>{statusLabel(report.status)}</span></td>
                      <td>{report.passed}/{report.total}</td>
                      <td>{report.failed + report.errors}</td>
                      <td>{new Date(report.updatedAt).toLocaleString('zh-CN')}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          )}
          {comparison.length > 0 && (
            <div className={css.tableSection}>
              <div className={css.sectionHeading}>
                <div><h2>与当前基线比较</h2><p>按同名用例比较结果；比较不会修改候选报告或基线。</p></div>
                <span className={css.neutralBadge}>
                  {comparison.filter(item => item.change === '回归').length} 个回归
                </span>
              </div>
              <div className={css.tableScroll}>
                <table className={css.dataTable}>
                  <thead><tr><th>用例</th><th>基线</th><th>当前</th><th>变化</th></tr></thead>
                  <tbody>{comparison.map(item => (
                    <tr key={item.name}>
                      <td><strong>{item.name}</strong></td><td>{item.before}</td><td>{item.after}</td>
                      <td><span className={css.compareStatus} data-change={item.change}>{item.change}</span></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )
    }}</ProjectViewState>
  )
}
