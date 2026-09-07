/** Read-only visual excerpts of production records; never live deployment telemetry. */
import type { V2DeliveryItem } from './controller.ts'
import { DeliveryIcon } from './DeliveryIcon.tsx'
import css from './DeliveryStagePanel.module.css'

function ReleaseSummary({ summary }: { readonly summary: string }) {
  const sequence = summary.match(/\d+(?:\.\d+)?\s*%\s*(?:[→➜]\s*\d+(?:\.\d+)?\s*%\s*)+/)?.[0]
  const steps = sequence?.match(/\d+(?:\.\d+)?\s*%/g)
  const observation = summary.match(/每批观察\s*(\d+(?:\.\d+)?\s*分钟)/)?.[1]
  const rollback = summary.match(/回退目标(?:保持)?(?:为|是)\s*([^，。；\s]+)/)?.[1]
  if (steps == null || steps.some(value => Number.parseFloat(value) > 100)) return <p className={css.productionFallback}>{summary}</p>
  return <>
    <div className={css.releaseSequence} aria-label="记录中的发布批次">{steps.map((value, index) => <div key={index}><strong>{value}</strong><small>{observation === undefined ? '观察时长未登记' : `观察 ${observation}`}</small></div>)}</div>
    <div className={css.rollback}><DeliveryIcon kind="return" /><span>回退目标</span><code>{rollback ?? '未登记'}</code>{rollback !== undefined && <small>按本条发布记录核对</small>}</div>
  </>
}

function AdoptionSummary({ summary }: { readonly summary: string }) {
  const rate = summary.match(/采用率\s*(\d+(?:\.\d+)?)\s*%/)?.[1]
  const active = summary.match(/(\d+\s*\/\s*\d+)\s*名?操作者(?:活跃)?/)?.[1]
  const cases = summary.match(/处理\s*(\d+)\s*个?案例/)?.[1]
  const adopted = summary.match(/(\d+)\s*条建议(?:被)?采用/)?.[1]
  if (rate === undefined || Number(rate) > 100) return <p className={css.productionFallback}>{summary}</p>
  return <div className={css.adoptionMetrics}>
    <div className={css.adoptionRing} aria-label={`记录中的采用率 ${rate}%`}>
      <svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="51" /><circle cx="60" cy="60" r="51" pathLength="100" strokeDasharray={`${rate} 100`} transform="rotate(-90 60 60)" /></svg>
      <span>采用率<strong>{rate}<small>%</small></strong></span>
    </div>
    <dl className={css.adoptionFacts}>{[["users", "活跃操作者", active], ["cases", "处理案例", cases], ["check", "建议采用", adopted]].map(([icon, label, value]) => <div key={label}><dt><DeliveryIcon kind={icon!} />{label}</dt><dd>{value ?? '未登记'}</dd></div>)}</dl>
  </div>
}

/** Present one source record and retain its complete summary and evidence entry. */
export function ProductionRecord({ item, statusLabel, scopeLabel, onOpen }: {
  readonly item: V2DeliveryItem
  readonly statusLabel: string
  readonly scopeLabel: string
  readonly onOpen: () => void
}) {
  const release = item.category === 'release'
  const qualifier = release ? item.summary.match(/^([^：:]+)[：:]/)?.[1] : item.summary.match(/^([^\d]+)(?=\d+\s*\/)/)?.[1]
  return <article className={css.productionRecord} aria-label={item.title}>
    <header><DeliveryIcon kind={release ? 'rocket' : 'chart'} /><h2>{item.title}</h2><span className={css.badge} data-status={item.status}>{statusLabel}</span></header>
    <div className={css.productionRecordBody}>
      <div className={css.productionRecordMeta}>{qualifier !== undefined && <span>{qualifier}</span>}<small>{scopeLabel} · {item.version}</small></div>
      {release ? <ReleaseSummary summary={item.summary} /> : <AdoptionSummary summary={item.summary} />}
      <div className={css.productionRecordFooter}><span>{item.owner ?? '责任人待确认'}</span><button type="button" onClick={onOpen}>证据与详情 <DeliveryIcon kind="external" /></button></div>
      <details className={css.originalSummary}><summary>查看原始记录摘要</summary><p>{item.summary}</p></details>
    </div>
  </article>
}
