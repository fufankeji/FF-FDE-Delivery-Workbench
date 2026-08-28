/** Project-local observability dashboard over existing Session projections. */

import { useState, type CSSProperties } from 'react'
import {
  projectActivityBuckets, projectRuntimeTotals,
  type ProjectActivityBucket, type ProjectActivityRange,
} from './project-data.ts'
import type { ProjectViewProps } from './slots.ts'
import { ProjectViewHeader } from './view-state.tsx'
import css from './project.module.css'

const RANGE_OPTIONS: readonly { id: ProjectActivityRange; label: string; shortLabel: string }[] = [
  { id: 'today', label: '今天', shortLabel: '今日' },
  { id: '7d', label: '近 7 天', shortLabel: '7 天' },
  { id: '30d', label: '近 30 天', shortLabel: '30 天' },
]

function compact(value: number): string {
  return new Intl.NumberFormat('zh-CN', { notation: value >= 10_000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(value)
}

function duration(value: number): string {
  if (value < 1_000) return `${String(Math.round(value))} ms`
  if (value < 60_000) return `${(value / 1_000).toFixed(1)} s`
  return `${(value / 60_000).toFixed(1)} min`
}

function percent(value: number): string {
  return `${Math.round(value)}%`
}

function ratio(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0
}

function activityLevel(bucket: ProjectActivityBucket, peak: number): number {
  const value = bucket.inputTokens + bucket.outputTokens
  if (value === 0 || peak === 0) return 0
  return Math.min(4, Math.max(1, Math.ceil((value / peak) * 4)))
}

/** Present live, project-scoped activity without requiring an external telemetry service. */
export function ObservabilityView(props: ProjectViewProps) {
  const [range, setRange] = useState<ProjectActivityRange>('today')
  const [hoveredBucketKey, setHoveredBucketKey] = useState<string>()
  const [selectedBucketKey, setSelectedBucketKey] = useState<string>()
  const workspace = props.useWorkspaces(state => state.items.find(item => item.sessionIds.includes(props.sessionId)))
  const sessions = props.useSessions(state => workspace === undefined
    ? []
    : workspace.sessionIds.map(id => state.byId[id]).filter(item => item !== undefined))
  if (workspace === undefined) return <div className={css.surfaceState}>{props.t('surface.noProject')}</div>

  const buckets = projectActivityBuckets(sessions, range)
  const rangeStart = buckets[0]?.start ?? 0
  const rangeEnd = buckets.at(-1)?.end ?? Number.POSITIVE_INFINITY
  const visibleSessions = sessions.filter(session => session.updatedAt >= rangeStart && session.updatedAt < rangeEnd)
  const totals = projectRuntimeTotals(visibleSessions)
  const selectedRange = RANGE_OPTIONS.find(item => item.id === range) as typeof RANGE_OPTIONS[number]
  const totalTokens = totals.inputTokens + totals.outputTokens
  const activeSessions = totals.sessions - totals.blank
  const peakBucket = buckets.reduce((selected, bucket) => (
    bucket.inputTokens + bucket.outputTokens > selected.inputTokens + selected.outputTokens ? bucket : selected
  ), buckets[0] as ProjectActivityBucket)
  const peakTokens = peakBucket.inputTokens + peakBucket.outputTokens
  const activeBuckets = buckets.filter(bucket => bucket.sessions > 0).length
  const averageTokensPerTurn = totals.turns > 0 ? totalTokens / totals.turns : 0
  const averageStepsPerTurn = totals.turns > 0 ? totals.steps / totals.turns : 0
  const runtimeTotal = totals.llmMs + totals.toolMs
  const modelRuntimeRate = ratio(totals.llmMs, runtimeTotal) * 100
  const toolRuntimeRate = ratio(totals.toolMs, runtimeTotal) * 100
  const cacheRate = ratio(totals.cacheReadTokens, totals.inputTokens) * 100
  const averageTtft = totals.ttftSteps > 0 ? totals.ttftMs / totals.ttftSteps : 0
  const decodeRate = totals.decodeMs > 0 ? totals.decodeTokens / (totals.decodeMs / 1_000) : 0
  const maxSessionTokens = Math.max(1, ...visibleSessions.map((session) => {
    const one = projectRuntimeTotals([session])
    return one.inputTokens + one.outputTokens
  }))

  const chartWidth = 920
  const chartHeight = 252
  const chartLeft = 54
  const chartRight = 18
  const chartTop = 18
  const chartBottom = 42
  const chartInnerWidth = chartWidth - chartLeft - chartRight
  const chartInnerHeight = chartHeight - chartTop - chartBottom
  const bucketWidth = chartInnerWidth / Math.max(1, buckets.length)
  const barWidth = range === 'today' ? Math.max(1, bucketWidth * 0.72) : Math.max(5, bucketWidth * (range === '30d' ? 0.62 : 0.52))
  const maxBucketTokens = Math.max(1, ...buckets.map(bucket => bucket.inputTokens + bucket.outputTokens))
  const maxBucketSteps = Math.max(1, ...buckets.map(bucket => bucket.steps))
  const stepPoints = buckets.map((bucket, index) => ({
    x: chartLeft + (index + 0.5) * bucketWidth,
    y: chartTop + chartInnerHeight - (bucket.steps / maxBucketSteps) * chartInnerHeight,
  }))
  const stepPath = stepPoints.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ')
  const activeBucketKey = selectedBucketKey ?? hoveredBucketKey
  const activeBucket = buckets.find(bucket => bucket.key === activeBucketKey)
  const activeBucketIndex = activeBucket === undefined ? -1 : buckets.indexOf(activeBucket)
  const activeBucketX = activeBucketIndex < 0 ? 0 : chartLeft + (activeBucketIndex + 0.5) * bucketWidth
  const activeBucketTotal = activeBucket === undefined ? 0 : activeBucket.inputTokens + activeBucket.outputTokens
  const activeBucketSide = activeBucketX < chartWidth * 0.24 ? 'left' : activeBucketX > chartWidth * 0.76 ? 'right' : 'center'
  const bucketAtClientX = (clientX: number, left: number, width: number): ProjectActivityBucket | undefined => {
    if (width <= 0) return undefined
    const chartX = ((clientX - left) / width) * chartWidth
    const index = Math.floor((chartX - chartLeft) / bucketWidth)
    return index >= 0 && index < buckets.length ? buckets[index] : undefined
  }
  const toggleBucket = (bucket: ProjectActivityBucket) => {
    setSelectedBucketKey(current => current === bucket.key ? undefined : bucket.key)
  }

  return (
    <section className={css.surfaceRoot}>
      <ProjectViewHeader
        eyebrow={workspace.title}
        title="项目用量分析"
        description="汇总项目的 Token 消耗、模型调用、会话活动与运行耗时，帮助 FDE 看清实际使用情况。"
      />

      <div className={css.observeToolbar}>
        <div>
          <strong>运行脉搏</strong>
          <span>按会话最后活动时间归集累计投影</span>
        </div>
        <div className={css.observeRange} aria-label="用量分析时间范围">
          {RANGE_OPTIONS.map(option => (
            <button
              key={option.id}
              type="button"
              aria-pressed={range === option.id}
              onClick={() => {
                setRange(option.id)
                setHoveredBucketKey(undefined)
                setSelectedBucketKey(undefined)
              }}
            >{option.label}</button>
          ))}
        </div>
      </div>

      <div className={css.observeKpis}>
        <article data-tone="business">
          <div><span>TOK</span><small>{selectedRange.shortLabel}总用量</small></div>
          <strong>{compact(totalTokens)}</strong>
          <p>输入 {compact(totals.inputTokens)} · 输出 {compact(totals.outputTokens)}</p>
        </article>
        <article data-tone="warn">
          <div><span>PEAK</span><small>用量峰值</small></div>
          <strong>{compact(peakTokens)}</strong>
          <p>{peakTokens > 0 ? peakBucket.description : '当前范围暂无活动'}</p>
        </article>
        <article data-tone="success">
          <div><span>AVG</span><small>平均每轮</small></div>
          <strong>{compact(averageTokensPerTurn)}</strong>
          <p>{averageStepsPerTurn.toFixed(1)} 步 / 轮 · 共 {compact(totals.turns)} 轮</p>
        </article>
        <article data-tone="accent">
          <div><span>LIVE</span><small>活跃会话</small></div>
          <strong>{activeSessions}<i>/{totals.sessions}</i></strong>
          <p>{totals.running > 0 ? `${String(totals.running)} 个正在运行` : `${String(activeBuckets)} 个活跃时段`}</p>
        </article>
      </div>

      <div className={css.observeVisualGrid}>
        <section className={css.observeChartPanel}>
          <header className={css.observePanelHeader}>
            <div><span>USAGE TREND</span><h2>Token 活跃趋势</h2><p>柱形为输入/输出 Token，折线为执行步骤。</p></div>
            <div className={css.observeLegend}>
              <span data-series="input">输入</span><span data-series="output">输出</span><span data-series="steps">步骤</span>
            </div>
          </header>
          <div className={css.observeChartWrap}>
            <div className={css.observeChartStage}>
              <svg
                className={css.observeChart}
                viewBox={`0 0 ${String(chartWidth)} ${String(chartHeight)}`}
                role="img"
                aria-label={`${selectedRange.label} Token 用量与执行步骤趋势；悬浮查看，点击锁定时段详情`}
                onPointerMove={(event) => {
                  if (selectedBucketKey !== undefined) return
                  const rect = event.currentTarget.getBoundingClientRect()
                  setHoveredBucketKey(bucketAtClientX(event.clientX, rect.left, rect.width)?.key)
                }}
                onPointerLeave={() => { setHoveredBucketKey(undefined) }}
                onClick={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect()
                  const bucket = bucketAtClientX(event.clientX, rect.left, rect.width)
                  if (bucket !== undefined) toggleBucket(bucket)
                }}
              >
                {[0, 0.5, 1].map((position) => {
                  const y = chartTop + chartInnerHeight * position
                  return <g key={position}>
                    <line className={css.observeChartGrid} x1={chartLeft} x2={chartWidth - chartRight} y1={y} y2={y} />
                    <text className={css.observeChartScale} x={chartLeft - 9} y={y + 4}>{compact(maxBucketTokens * (1 - position))}</text>
                  </g>
                })}
                {buckets.map((bucket, index) => {
                  const inputHeight = (bucket.inputTokens / maxBucketTokens) * chartInnerHeight
                  const outputHeight = (bucket.outputTokens / maxBucketTokens) * chartInnerHeight
                  const x = chartLeft + (index + 0.5) * bucketWidth - barWidth / 2
                  const inputY = chartTop + chartInnerHeight - inputHeight
                  const outputY = inputY - outputHeight
                  const showLabel = range === '30d' ? index % 5 === 0 || index === buckets.length - 1 : range !== 'today' || index % 12 === 0
                  return <g key={bucket.key}>
                    <title>{`${bucket.description}：输入 ${compact(bucket.inputTokens)}，输出 ${compact(bucket.outputTokens)}，${String(bucket.steps)} 步`}</title>
                    <rect className={css.observeInputBar} x={x} y={inputY} width={barWidth} height={inputHeight} rx="3" />
                    <rect className={css.observeOutputBar} x={x} y={outputY} width={barWidth} height={outputHeight} rx="3" />
                    {showLabel && <text className={css.observeChartLabel} x={x + barWidth / 2} y={chartHeight - 13}>{bucket.label}</text>}
                  </g>
                })}
                <path className={css.observeStepLine} d={stepPath} />
                {buckets.map((bucket, index) => bucket.steps > 0 && (
                  <circle key={bucket.key} className={css.observeStepPoint} cx={stepPoints[index]?.x} cy={stepPoints[index]?.y} r="4">
                    <title>{`${bucket.description}：${String(bucket.steps)} 个执行步骤`}</title>
                  </circle>
                ))}
                {activeBucket !== undefined && (
                  <g aria-hidden="true">
                    <rect
                      className={css.observeChartSelection}
                      x={activeBucketX - bucketWidth / 2}
                      y={chartTop}
                      width={bucketWidth}
                      height={chartInnerHeight}
                    />
                    <line
                      className={css.observeChartCursor}
                      x1={activeBucketX}
                      x2={activeBucketX}
                      y1={chartTop}
                      y2={chartTop + chartInnerHeight}
                    />
                  </g>
                )}
              </svg>
              {activeBucket !== undefined && (
                <div
                  className={css.observeChartTooltip}
                  data-side={activeBucketSide}
                  data-locked={selectedBucketKey !== undefined || undefined}
                  style={{ '--observe-tooltip-x': `${String((activeBucketX / chartWidth) * 100)}%` } as CSSProperties}
                >
                  <header><span>{activeBucket.description}</span>{selectedBucketKey === undefined
                    ? <em>点击锁定</em>
                    : <button type="button" aria-label="取消时段锁定" onClick={() => { setSelectedBucketKey(undefined) }}>×</button>}</header>
                  <strong>{compact(activeBucketTotal)} <small>Token</small></strong>
                  <dl>
                    <div><dt>输入 / 输出</dt><dd>{compact(activeBucket.inputTokens)} / {compact(activeBucket.outputTokens)}</dd></div>
                    <div><dt>轮次 / 步骤</dt><dd>{activeBucket.turns} / {activeBucket.steps}</dd></div>
                    <div><dt>模型耗时</dt><dd>{duration(activeBucket.llmMs)}</dd></div>
                    <div><dt>工具耗时</dt><dd>{duration(activeBucket.toolMs)}</dd></div>
                  </dl>
                </div>
              )}
            </div>
          </div>
          <footer className={css.observeChartSummary}>
            <span><b>{activeBuckets}</b> 活跃时段</span>
            <span><b>{compact(totals.steps)}</b> 执行步骤</span>
            <span><b>{compact(totalTokens / Math.max(1, activeBuckets))}</b> 活跃时段均值</span>
          </footer>
        </section>

        <aside className={css.observeEfficiencyPanel}>
          <header className={css.observePanelHeader}><div><span>MODEL PULSE</span><h2>模型效率</h2><p>从完整会话投影计算。</p></div></header>
          <div className={css.observeRuntimeFocus}>
            <div
              className={css.observeRuntimeRing}
              style={{ '--observe-runtime-angle': `${String(modelRuntimeRate * 3.6)}deg` } as CSSProperties}
            >
              <span><strong>{percent(modelRuntimeRate)}</strong><small>模型耗时</small></span>
            </div>
            <div>
              <strong>{duration(runtimeTotal)}</strong>
              <span>总处理耗时</span>
              <p>模型 {duration(totals.llmMs)} · 工具 {duration(totals.toolMs)}</p>
            </div>
          </div>
          <div className={css.observeEfficiencyGrid}>
            <article><span>平均首 Token</span><strong>{duration(averageTtft)}</strong><small>{compact(totals.ttftSteps)} 次采样</small></article>
            <article><span>输出速率</span><strong>{decodeRate.toFixed(1)}</strong><small>Token / 秒</small></article>
            <article><span>缓存复用</span><strong>{percent(cacheRate)}</strong><small>{compact(totals.cacheReadTokens)} Token</small></article>
            <article><span>工具占比</span><strong>{percent(toolRuntimeRate)}</strong><small>{duration(totals.toolMs)}</small></article>
          </div>
          <div className={css.observeComposition}>
            <div><span>Token 结构</span><b>{compact(totalTokens)}</b></div>
            <div className={css.observeCompositionBar} aria-label="Token 构成">
              <span data-segment="input" style={{ width: percent(ratio(totals.uncachedInputTokens, totalTokens) * 100) }} />
              <span data-segment="cache" style={{ width: percent(ratio(totals.cacheReadTokens + totals.cacheWriteTokens, totalTokens) * 100) }} />
              <span data-segment="output" style={{ width: percent(ratio(totals.outputTokens, totalTokens) * 100) }} />
            </div>
            <p><span data-series="input">直接输入</span><span data-series="cache">缓存</span><span data-series="output">输出</span></p>
          </div>
        </aside>
      </div>

      <section className={css.observeHeatPanel}>
        <header className={css.observePanelHeader}>
          <div><span>ACTIVITY MATRIX</span><h2>会话活跃热力</h2><p>颜色越深代表该时段累计 Token 越高。</p></div>
          <strong>{peakTokens > 0 ? `峰值 ${compact(peakTokens)}` : '暂无活动'}</strong>
        </header>
        <div
          className={css.observeHeatCells}
          style={{ '--observe-columns': buckets.length } as CSSProperties}
          data-dense={range === 'today' || undefined}
          role="img"
          aria-label={`${selectedRange.label}会话活跃热力图`}
        >
          {buckets.map(bucket => (
            <button
              key={bucket.key}
              type="button"
              data-level={activityLevel(bucket, peakTokens)}
              data-active={activeBucket?.key === bucket.key || undefined}
              tabIndex={bucket.sessions > 0 ? 0 : -1}
              aria-label={`${bucket.description}：${compact(bucket.inputTokens + bucket.outputTokens)} Token，${String(bucket.steps)} 步`}
              onMouseEnter={() => { if (selectedBucketKey === undefined) setHoveredBucketKey(bucket.key) }}
              onMouseLeave={() => { setHoveredBucketKey(undefined) }}
              onFocus={() => { if (selectedBucketKey === undefined) setHoveredBucketKey(bucket.key) }}
              onBlur={() => { setHoveredBucketKey(undefined) }}
              onClick={() => { toggleBucket(bucket) }}
            />
          ))}
        </div>
        {activeBucket !== undefined && (
          <div className={css.observeHeatDetail} data-locked={selectedBucketKey !== undefined || undefined}>
            <span>{activeBucket.description}</span>
            <strong>{compact(activeBucketTotal)} Token</strong>
            <span>输入 {compact(activeBucket.inputTokens)}</span>
            <span>输出 {compact(activeBucket.outputTokens)}</span>
            <span>{activeBucket.turns} 轮 · {activeBucket.steps} 步</span>
            {selectedBucketKey === undefined
              ? <em>点击色块锁定</em>
              : <button type="button" onClick={() => { setSelectedBucketKey(undefined) }}>取消锁定</button>}
          </div>
        )}
        <footer><span>{buckets[0]?.label}</span><span>低 <i data-level="1" /><i data-level="2" /><i data-level="3" /><i data-level="4" /> 高</span><span>{buckets.at(-1)?.label}</span></footer>
      </section>

      <section className={css.observeSessionSection}>
        <div className={css.sectionHeading}>
          <div><h2>会话运行画像</h2><p>{selectedRange.label}内最后活跃的项目会话。</p></div>
          <span>{visibleSessions.length} 个会话</span>
        </div>
        {visibleSessions.length === 0
          ? <div className={css.smallEmpty}>当前时间范围内没有会话活动。</div>
          : (
            <div className={css.tableScroll}><table className={css.dataTable}>
              <thead><tr><th>会话</th><th>状态</th><th>轮次 / 步骤</th><th>Token 用量</th><th>模型 / 工具耗时</th><th>最后活动</th></tr></thead>
              <tbody>{visibleSessions.map((session) => {
                const one = projectRuntimeTotals([session])
                const sessionTokens = one.inputTokens + one.outputTokens
                const sessionStepDensity = one.turns > 0 ? one.steps / one.turns : 0
                return <tr key={session.id}>
                  <td><strong>{session.displayTitle}</strong><small>{String(session.id).slice(0, 8)}</small></td>
                  <td><span className={css.sessionStatus} data-running={session.running || undefined}>{session.running ? '运行中' : session.completed ? '已完成' : session.blank ? '未开始' : '等待中'}</span></td>
                  <td><strong>{one.turns} / {one.steps}</strong><small>{sessionStepDensity.toFixed(1)} 平均步密度</small></td>
                  <td>
                    <div className={css.observeSessionUsage}>
                      <div><span style={{ width: percent(ratio(sessionTokens, maxSessionTokens) * 100) }} /></div>
                      <strong>{compact(sessionTokens)}</strong>
                    </div>
                  </td>
                  <td><strong>{duration(one.llmMs)} / {duration(one.toolMs)}</strong><small>模型 / 工具</small></td>
                  <td>{new Date(session.updatedAt).toLocaleString('zh-CN')}</td>
                </tr>
              })}</tbody>
            </table></div>
          )}
      </section>
    </section>
  )
}
