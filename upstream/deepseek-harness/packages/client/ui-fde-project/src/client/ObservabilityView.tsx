/** Project-local observability summary over existing Session projections. */

import { projectRuntimeTotals } from './project-data.ts'
import type { ProjectViewProps } from './slots.ts'
import { ProjectViewHeader } from './view-state.tsx'
import css from './project.module.css'

function compact(value: number): string {
  return new Intl.NumberFormat('zh-CN', { notation: value >= 10_000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(value)
}

function duration(value: number): string {
  if (value < 1_000) return `${String(Math.round(value))} ms`
  if (value < 60_000) return `${(value / 1_000).toFixed(1)} s`
  return `${(value / 60_000).toFixed(1)} min`
}

/** Present live, project-scoped activity without requiring an external telemetry service. */
export function ObservabilityView(props: ProjectViewProps) {
  const workspace = props.useWorkspaces(state => state.items.find(item => item.sessionIds.includes(props.sessionId)))
  const sessions = props.useSessions(state => workspace === undefined
    ? []
    : workspace.sessionIds.map(id => state.byId[id]).filter(item => item !== undefined))
  if (workspace === undefined) return <div className={css.surfaceState}>{props.t('surface.noProject')}</div>
  const totals = projectRuntimeTotals(sessions)
  return (
    <section className={css.surfaceRoot}>
      <ProjectViewHeader
        eyebrow={workspace.title}
        title="项目观测"
        description="汇总当前项目会话的真实运行状态、步骤、耗时和 Token 使用。外部数据导出保持关闭，直到项目明确配置。"
      />
      <div className={css.observeStatus}>
        <span className={css.liveDot} />
        <div><strong>本地观测可用</strong><p>数据直接来自 Harness 的会话投影，并随开发活动更新。</p></div>
        <span className={css.neutralBadge}>外部导出未启用</span>
      </div>
      <div className={css.metricGrid}>
        <article><span>项目会话</span><strong>{totals.sessions}</strong><small>{totals.running > 0 ? `${String(totals.running)} 个正在运行` : '当前无运行任务'}</small></article>
        <article><span>对话轮次</span><strong>{compact(totals.turns)}</strong><small>{compact(totals.steps)} 个执行步骤</small></article>
        <article><span>输入 Token</span><strong>{compact(totals.inputTokens)}</strong><small>包含缓存读写</small></article>
        <article><span>输出 Token</span><strong>{compact(totals.outputTokens)}</strong><small>模型累计输出</small></article>
        <article><span>模型耗时</span><strong>{duration(totals.llmMs)}</strong><small>已完成步骤累计</small></article>
        <article><span>工具耗时</span><strong>{duration(totals.toolMs)}</strong><small>已完成工具调用累计</small></article>
      </div>
      <div className={css.tableSection}>
        <div className={css.sectionHeading}><div><h2>会话运行情况</h2><p>只统计当前项目内的会话。</p></div></div>
        {sessions.length === 0
          ? <div className={css.smallEmpty}>当前项目还没有会话活动。</div>
          : (
            <div className={css.tableScroll}><table className={css.dataTable}>
              <thead><tr><th>会话</th><th>状态</th><th>轮次</th><th>步骤</th><th>Token</th><th>最后活动</th></tr></thead>
              <tbody>{sessions.map((session) => {
                const one = projectRuntimeTotals([session])
                return <tr key={session.id}><td><strong>{session.displayTitle}</strong><small>{String(session.id).slice(0, 8)}</small></td><td><span className={css.sessionStatus} data-running={session.running || undefined}>{session.running ? '运行中' : session.completed ? '已完成' : session.blank ? '未开始' : '等待中'}</span></td><td>{one.turns}</td><td>{one.steps}</td><td>{compact(one.inputTokens + one.outputTokens)}</td><td>{new Date(session.updatedAt).toLocaleString('zh-CN')}</td></tr>
              })}</tbody>
            </table></div>
          )}
      </div>
      <div className={css.observeNotice}>
        <strong>需要跨项目追踪时再启用外部服务</strong>
        <p>已内置 dsh-observe，但默认不采集或发送数据。后续可按项目配置 Langfuse 或 OTLP，并先确认隐私、字段脱敏和凭据管理。</p>
      </div>
    </section>
  )
}
