/** Project evaluation cases, reports, and explicit run entry. */

import { useState } from 'react'
import type { EvaluationReportSummary } from './controller.ts'
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

/** Present project-scoped regression evidence and ask the current Agent to run it only after a user click. */
export function EvaluationView(props: ProjectViewProps) {
  const [submitting, setSubmitting] = useState(false)
  const [baselinePending, setBaselinePending] = useState(false)
  const [showRunConfirm, setShowRunConfirm] = useState(false)
  const [notice, setNotice] = useState('')
  const sessionRunning = props.useSessions(state => state.byId[props.sessionId]?.running ?? false)
  return (
    <ProjectViewState props={props}>{(snapshot, workspace) => {
      const evaluation = snapshot.evaluation
      const latest = evaluation.reports[0]
      const comparison = latest === undefined || evaluation.baseline === undefined
        ? []
        : latest.cases.map((item) => {
          const before = evaluation.baseline?.cases.find(candidate => candidate.name === item.name)
          const change = before === undefined ? '新增' : before.status === item.status ? '未变化' : before.status === 'pass' ? '回归' : item.status === 'pass' ? '改善' : '变化'
          return { name: item.name, before: before?.status ?? '—', after: item.status, change }
        })
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
            title="项目评估"
            description="用项目内固定用例重复验证关键能力，并把每次结果留在项目目录中，作为进入部署前的真实证据。"
            onRefresh={() => { props.refreshProjectSurface(workspace.workspaceId) }}
            refreshLabel="刷新报告"
            actions={(
              <button
                type="button"
                className={css.primaryButton}
                disabled={submitting || sessionRunning || evaluation.casesCount === 0}
                onClick={() => { setShowRunConfirm(true) }}
              >
                {submitting ? '正在提交…' : sessionRunning ? '当前会话运行中' : '运行评估'}
              </button>
            )}
          />
          <div className={css.evaluationNotice}>
            <strong>运行评估会调用真实 Agent 和模型</strong>
            <p>这里只在你点击“运行评估”后提交任务，可能产生模型费用；页面加载和自动测试不会触发调用。</p>
          </div>
          {showRunConfirm && (
            <div className={css.runConfirmation} role="dialog" aria-label="确认运行项目评估">
              <div>
                <strong>确认运行 {evaluation.casesCount} 个项目用例</strong>
                <p>评估使用当前会话 Agent 的模型配置，串行创建隔离 Headless Trial，并把新报告写入当前项目。模型调用可能产生费用。</p>
              </div>
              <div>
                <button type="button" className={css.secondaryButton} onClick={() => { setShowRunConfirm(false) }}>暂不运行</button>
                <button type="button" className={css.primaryButton} onClick={run}>确认并运行</button>
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
              <h2>尚未建立项目评估</h2>
              <p>先把关键业务路径写成 YAML 用例，放入 <code>.fde/evaluations/cases</code>。用例属于当前项目，不与其他项目混用。</p>
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
