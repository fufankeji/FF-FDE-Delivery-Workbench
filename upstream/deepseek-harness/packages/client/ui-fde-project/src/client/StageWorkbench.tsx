/** Project-stage workbench: business progress around the native Harness executor. */

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { DesignExecutionMechanism, ProjectSurfaceSnapshot, SemanticDefinitionInput, V2DesignSnapshot, V2LifecycleStageId, V2StageSurfaceSnapshot } from './controller.ts'
import type { ProjectSourceItem } from './source-controller.ts'
import { FDE_V2_STAGE_IDS, type FdeProjectState, type FdeV2StageId, type ProjectStageValue } from './stage-controller.ts'
import type { DiscoveryAction, ProjectStageWorkbenchHeroProps, ProjectStageWorkbenchViewProps } from './slots.ts'
import { KnowledgeGraphExplorer } from './KnowledgeGraphExplorer.tsx'
import { EvaluationStagePanel } from './EvaluationStagePanel.tsx'
import { DeliveryStagePanel } from './DeliveryStagePanel.tsx'
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

const FALLBACK_WORK = [
  { id: 'collect-originals', title: '听客户怎么说', purpose: '保留客户原话、已有资料和现场条件。' },
  { id: 'restore-workflow', title: '还原实际流程', purpose: '弄清谁在做、什么时候开始、正常怎么处理、出了问题怎么回退。' },
  { id: 'qualify-value', title: '确认是否值得做', purpose: '确认问题造成什么影响、谁负责、谁来判断结果。' },
  { id: 'form-conclusion', title: '决定下一步', purpose: '整理已确认事实和未解决问题，由 FDE 决定继续、调整还是停止。' },
] as const

function DocumentStatusIcon({ state }: { readonly state: 'current' | 'complete' | 'all' }) {
  return <svg className={css.recordDocumentIcon} data-state={state} viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M5.75 2.75h5.75l3.25 3.25v9.25A1.75 1.75 0 0 1 13 17H5.75A1.75 1.75 0 0 1 4 15.25V4.5a1.75 1.75 0 0 1 1.75-1.75Z" />
    <path d="M11.5 3v3h3M7 9.25h5M7 12h5" />
    {state === 'complete' && <path d="m12.2 15.1 1.25 1.25 2.55-2.8" />}
  </svg>
}

function SparkleIcon() {
  return <svg className={css.promptSparkleIcon} viewBox="0 0 36 36" fill="none" aria-hidden="true">
    <path d="M16 3c.8 7.2 3.8 10.2 11 11-7.2.8-10.2 3.8-11 11-.8-7.2-3.8-10.2-11-11 7.2-.8 10.2-3.8 11-11Z" fill="currentColor" />
    <path d="M28 3.5c.3 2.8 1.7 4.2 4.5 4.5-2.8.3-4.2 1.7-4.5 4.5-.3-2.8-1.7-4.2-4.5-4.5 2.8-.3 4.2-1.7 4.5-4.5Z" fill="currentColor" opacity=".35" />
  </svg>
}

function HistoricalNoticeIcon() {
  return <svg className={css.historicalNoticeIcon} viewBox="0 0 48 48" fill="none" aria-hidden="true">
    <path d="M12 7.5h16.5l7.5 7.5v18.5A4.5 4.5 0 0 1 31.5 38H12a4.5 4.5 0 0 1-4.5-4.5V12A4.5 4.5 0 0 1 12 7.5Z" />
    <path d="M28.5 8v7h7M15 21h9M15 27h7" />
    <circle cx="34.5" cy="33.5" r="9" />
    <path d="M34.5 28.5v5.5l3.5 2" />
  </svg>
}

function HistoricalFactIcon({ type }: { readonly type: 'input' | 'record' | 'gate' }) {
  return <svg className={css.historicalFactIcon} viewBox="0 0 20 20" fill="none" aria-hidden="true">
    {type === 'input' && <><rect x="4" y="4" width="12" height="12" rx="3" /><path d="M7 10h6M10 7v6" /></>}
    {type === 'record' && <><path d="M5 5.5h10v10H5z" /><path d="M7.5 3.5h5v3h-5zM7.5 9h5M7.5 12h4" /></>}
    {type === 'gate' && <><circle cx="10" cy="10" r="7" /><path d="m7 10 2 2 4-4" /></>}
  </svg>
}

function HistoricalArchiveIcon() {
  return <svg className={css.historicalArchiveIcon} viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 2.5 16 5v4.6c0 3.6-2.2 6.1-6 7.9-3.8-1.8-6-4.3-6-7.9V5l6-2.5Z" /><path d="m7.5 10 1.6 1.6 3.5-3.7" /></svg>
}

function EvidenceDocumentIcon() {
  return <svg className={css.evidenceDocumentIcon} viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M5.25 2.75h6l3.5 3.5v10.25a.75.75 0 0 1-.75.75H5.25a.75.75 0 0 1-.75-.75v-13a.75.75 0 0 1 .75-.75Z" />
    <path d="M11.25 3v3.5h3.5M7 10h5.5M7 13h5.5" />
  </svg>
}

function EvidenceShieldIcon({ ready = true }: { readonly ready?: boolean }) {
  return <svg className={css.evidenceShieldIcon} data-ready={ready ? 'true' : 'false'} viewBox="0 0 36 40" fill="none" aria-hidden="true">
    <path d="M18 2.5 32 8v10.7c0 8.1-4.9 13.8-14 18.8C8.9 32.5 4 26.8 4 18.7V8l14-5.5Z" />
    {ready ? <path d="m11.5 19.5 4.2 4.2 9-9.4" /> : <path d="M18 12.5v9M18 27v.5" />}
  </svg>
}

type WorkbenchProps = ProjectStageWorkbenchHeroProps | ProjectStageWorkbenchViewProps

function isStageRecordBlocker(value: string): boolean {
  return value.includes('阶段状态文件') || value.includes('.fde/stages/')
}

function matchesArtifactBlocker(value: string, title: string): boolean {
  return value.includes(title) && (value.includes('尚未形成') || value.includes('无法读取'))
}

function investigationStateLabel(status: 'complete' | 'current' | 'waiting' | 'blocked'): string {
  if (status === 'complete') return '已形成记录'
  if (status === 'current') return '正在调查'
  if (status === 'blocked') return '存在阻塞'
  return '待调查'
}

function investigationFactLabel(status: 'confirmed' | 'conditional' | 'pending' | 'blocked'): string {
  if (status === 'confirmed') return '已确认'
  if (status === 'conditional') return '有条件'
  if (status === 'blocked') return '阻塞'
  return '待确认'
}

function investigationActionLabel(status: 'allowed' | 'conditional' | 'pending' | 'denied' | 'not-applicable'): string {
  if (status === 'allowed') return '允许'
  if (status === 'conditional') return '有条件'
  if (status === 'denied') return '禁止'
  if (status === 'not-applicable') return '—'
  return '待确认'
}

function governanceAreaLabel(area: 'security' | 'privacy' | 'legal' | 'procurement' | 'finance' | 'business'): string {
  return {
    security: '安全',
    privacy: '隐私',
    legal: '法务',
    procurement: '采购',
    finance: '财务',
    business: '业务',
  }[area]
}

type InvestigationIconName = 'database' | 'network' | 'shield' | 'people' | 'monitor' | 'book' | 'document' | 'chart' | 'message' | 'table' | 'lock' | 'scales' | 'cart' | 'finance' | 'building' | 'warning' | 'clock'

function InvestigationIcon({ name }: { readonly name: InvestigationIconName }) {
  return <svg className={css.investigationSemanticIcon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    {name === 'database' && <><ellipse cx="12" cy="5.2" rx="6.7" ry="2.7" /><path d="M5.3 5.2v6.7c0 1.5 3 2.7 6.7 2.7s6.7-1.2 6.7-2.7V5.2M5.3 11.9v6.7c0 1.5 3 2.7 6.7 2.7s6.7-1.2 6.7-2.7v-6.7" /></>}
    {name === 'network' && <><circle cx="12" cy="5" r="2.3" /><circle cx="5" cy="18" r="2.3" /><circle cx="19" cy="18" r="2.3" /><path d="M10.8 7 6.2 15.9M13.2 7l4.6 8.9M7.3 18h9.4" /></>}
    {name === 'shield' && <><path d="M12 2.7 20 6v5.8c0 4.6-2.7 7.8-8 10.5-5.3-2.7-8-5.9-8-10.5V6l8-3.3Z" /><path d="m8.2 12.1 2.4 2.4 5.2-5.3" /></>}
    {name === 'people' && <><circle cx="9" cy="8" r="3" /><path d="M3.5 20v-1.7c0-3 2.4-5.3 5.5-5.3s5.5 2.3 5.5 5.3V20M15 5.4a3 3 0 0 1 0 5.7M16.2 13.7c2.6.5 4.3 2.4 4.3 4.6V20" /></>}
    {name === 'monitor' && <><rect x="3" y="4" width="18" height="12.5" rx="2" /><path d="M8 21h8M12 16.5V21M7.2 12.8l2.6-2.6 2.1 1.7 4-4" /></>}
    {name === 'book' && <><path d="M4 4.5c3.4-.8 6.1.1 8 2v13c-1.9-1.9-4.6-2.8-8-2V4.5ZM20 4.5c-3.4-.8-6.1.1-8 2v13c1.9-1.9 4.6-2.8 8-2V4.5Z" /></>}
    {name === 'document' && <><path d="M6 2.5h8l4 4V21H6V2.5Z" /><path d="M14 2.8v4h4M9 11h6M9 15h6" /></>}
    {name === 'chart' && <><path d="M4 20V9M4 20h16" /><path d="m7 16 3.2-4 3 2.2L19 6" /><path d="M16 6h3v3" /></>}
    {name === 'message' && <><path d="M4 5.5h16v11H9l-4 3v-3H4v-11Z" /><path d="M8 10h.1M12 10h.1M16 10h.1" /></>}
    {name === 'table' && <><rect x="4" y="3" width="16" height="18" rx="1.5" /><path d="M8 8h8M8 12h8M8 16h8" /></>}
    {name === 'lock' && <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></>}
    {name === 'scales' && <><path d="M12 3v18M7 21h10M5 7h14M7 7l-3 6h6L7 7ZM17 7l-3 6h6l-3-6Z" /></>}
    {name === 'cart' && <><path d="M3 4h2l2.2 10.5h10.6L20 8H7" /><circle cx="9" cy="19" r="1.5" /><circle cx="17" cy="19" r="1.5" /></>}
    {name === 'finance' && <><circle cx="12" cy="12" r="9" /><path d="M8.5 8h7M12 8v9M8.8 12h6.4" /></>}
    {name === 'building' && <><path d="M4 21V7l8-4v18M12 9h8v12M7 9h2M7 13h2M7 17h2M15 13h2M15 17h2" /></>}
    {name === 'warning' && <><circle cx="12" cy="12" r="9" /><path d="M12 7v6M12 17h.1" /></>}
    {name === 'clock' && <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>}
  </svg>
}

function investigationOverviewIcon(index: number): InvestigationIconName {
  return (['database', 'network', 'shield', 'people'] as const)[index] ?? 'document'
}

function investigationNodeIcon(kind: 'system' | 'data' | 'actor' | 'external', index: number): InvestigationIconName {
  if (kind === 'data') return 'table'
  if (kind === 'actor') return 'people'
  if (kind === 'external') return 'message'
  return (['monitor', 'book', 'document', 'chart'] as const)[index % 4] ?? 'monitor'
}

function investigationGovernanceIcon(area: 'security' | 'privacy' | 'legal' | 'procurement' | 'finance' | 'business'): InvestigationIconName {
  const icons: Record<typeof area, InvestigationIconName> = {
    security: 'shield', privacy: 'lock', legal: 'scales', procurement: 'cart', finance: 'finance', business: 'building',
  }
  return icons[area]
}

function InvestigationCircuitArt() {
  return <svg className={css.investigationCircuitArt} viewBox="0 0 420 185" fill="none" aria-hidden="true">
    <g opacity=".42">
      <path d="M4 27h90l18 18h64l20-20h92l18 18h112" />
      <path d="M32 59h86l20 20h71l29-29h86l26 27h70" />
      <path d="M0 99h96l30-30h48l19 19h73l42-42h109" />
      <path d="M10 133h89l36-36h86l22 22h57l31-31h87" />
      <path d="M57 164h82l25-25h76l23 23h89l25-25h43" />
    </g>
    <g className={css.investigationCircuitNodes}>
      <circle cx="94" cy="27" r="3" /><circle cx="176" cy="45" r="3" /><circle cx="288" cy="25" r="3" /><circle cx="350" cy="77" r="3" />
      <circle cx="126" cy="69" r="3" /><circle cx="266" cy="88" r="3" /><circle cx="308" cy="46" r="3" /><circle cx="135" cy="97" r="3" />
      <circle cx="221" cy="119" r="3" /><circle cx="331" cy="88" r="3" /><circle cx="139" cy="164" r="3" /><circle cx="352" cy="162" r="3" />
    </g>
  </svg>
}

function parseInvestigationBlocker(title: string): { readonly title: string; readonly meta: string; readonly impact: string } {
  const [summary = title, impact = '对后续工作的影响待确认'] = title.split('——', 2)
  const details = summary.match(/^(.*?)（(.+)）$/)
  const rawTitle = details?.[1] ?? summary
  const rawMeta = details?.[2] ?? '审批与时间待确认'
  return {
    title: rawTitle.replace(/无\s*API\s*\/\s*数据批准/, 'API / 数据批准'),
    meta: rawMeta.replace(/~\s*/g, '约 ').replace('，', ' · ').replace(/^(AR-\d+)(?!\s*·)\s+(?=\S)/, '$1 · '),
    impact,
  }
}

function designExecutionLabel(execution: V2DesignSnapshot['execution'] | undefined): string {
  if (execution?.label !== undefined) return execution.label
  if (execution?.mechanism === 'manual') return '人工流程优化'
  if (execution?.mechanism === 'rules') return '业务规则'
  if (execution?.mechanism === 'software') return '传统软件'
  if (execution?.mechanism === 'retrieval') return '检索增强'
  if (execution?.mechanism === 'model') return '模型调用'
  if (execution?.mechanism === 'agent') return 'Agent 工作流'
  if (execution?.mechanism === 'hybrid') return '组合实现'
  return '尚未选定'
}

function designExecutionStatus(status: V2DesignSnapshot['execution']['status'] | undefined): string {
  if (status === 'selected') return '已选定'
  if (status === 'candidate') return '候选中'
  return '待判断'
}

function designSemanticsLabel(mode: V2DesignSnapshot['semantics']['mode'] | undefined): string {
  if (mode === 'schema') return '数据结构与开发规格'
  if (mode === 'ontology') return '本体（Ontology）与知识图谱'
  return '尚未决定'
}

function designSemanticConclusion(conclusion: V2DesignSnapshot['semantics']['conclusion'] | undefined): string {
  if (conclusion === 'not_required') return '不需要图谱'
  if (conclusion === 'validated') return '需要图谱，验证通过'
  if (conclusion === 'validation_failed') return '需要图谱，尚未通过验证'
  if (conclusion === 'insufficient_evidence') return '信息不足，暂不决定'
  return '等待验证'
}

function designDecisionLabel(outcome: NonNullable<V2DesignSnapshot['workspace']['decision']>['outcome'] | undefined): string {
  if (outcome === 'go') return '进入下一阶段（Go）'
  if (outcome === 'revise') return '修订方案（Revise）'
  if (outcome === 'narrow') return '缩小范围（Narrow）'
  if (outcome === 'stop') return '停止投入（Stop）'
  return '等待人工决定'
}

function designOntologyStatus(status: V2DesignSnapshot['ontology']['status'] | undefined): string {
  if (status === 'published') return 'Schema 已发布'
  if (status === 'review') return '等待审核'
  if (status === 'draft') return '草稿形成中'
  if (status === 'stale') return '需要重新构建'
  if (status === 'not_started') return '尚未开始'
  return '不适用'
}

function designGraphState(graph: V2DesignSnapshot['graph'] | undefined): { readonly title: string; readonly description: string } {
  if (graph?.status === 'invalid') return { title: '项目图谱快照未通过校验', description: graph.message ?? '请修复快照结构和项目边界后重新构建。' }
  if (graph?.buildStatus === 'running') return { title: 'Semantica 正在构建项目图谱', description: graph.message ?? '完成后刷新阶段记录；工作台不会用演示节点代替真实结果。' }
  if (graph?.buildStatus === 'failed') return { title: '本轮图谱构建失败', description: graph.message ?? '请查看构建证据，修复失败原因后重新运行。' }
  if (graph?.buildStatus === 'cancelled') return { title: '本轮图谱构建已取消', description: graph.message ?? '已保留当前 Schema 与构建记录，可以从已确认版本重新开始。' }
  if (graph?.buildStatus === 'stale') return { title: '图谱快照已经过期', description: graph.message ?? '输入材料或 Schema 已变化，需要重新构建并验证。' }
  if (graph?.status === 'ready' && graph.snapshot?.nodes.length === 0) return { title: '图谱快照中没有可展示的实体', description: '快照已经加载，但没有真实节点；请检查抽取和审核结果。' }
  if (graph?.status === 'missing') return { title: '尚未形成项目知识图谱快照', description: graph.message ?? '发布最小 Ontology Schema 并完成构建后，这里才会显示真实节点和关系。' }
  return { title: '等待本体路线完成前置工作', description: '先列出图谱需要回答的业务问题，审核实体类型与关系，再用项目材料构建知识图谱。' }
}

const DESIGN_MECHANISMS: readonly { readonly id: DesignExecutionMechanism; readonly label: string; readonly description: string }[] = [
  { id: 'manual', label: '人工流程', description: '不构建系统或只优化人工协作。' },
  { id: 'rules', label: '业务规则', description: '稳定条件与确定性规则即可完成。' },
  { id: 'software', label: '传统软件', description: '用明确接口与事务逻辑实现。' },
  { id: 'retrieval', label: '检索 / RAG', description: '核心是从资料中找到依据并生成回答。' },
  { id: 'model', label: '模型调用', description: '需要分类、抽取或生成，不需要自主安排多步任务。' },
  { id: 'agent', label: 'Agent 工作流', description: '需要多步判断、工具调用与人工审批。' },
  { id: 'hybrid', label: '组合实现', description: '组合确定性软件、模型与人工控制。' },
]

type DesignExecutionDetail = {
  readonly label: string
  readonly value: string
  readonly icon: InvestigationIconName
}

function designExecutionDetails(rationale: string | undefined): readonly DesignExecutionDetail[] {
  const source = rationale?.trim() ?? ''
  const decision = source.replace(/^证据\s*[^:：]+[:：]/u, '').split('；', 1)[0] ?? ''
  const fragments = decision.split(/[,，]/u).map(item => item.trim()).filter(Boolean)
  const details = fragments.slice(0, 4).map((value): DesignExecutionDetail => {
    if (/规则|硬门/u.test(value)) return { label: '确定性规则', value, icon: 'shield' }
    if (/软件|流程|审计/u.test(value)) return { label: '传统软件', value, icon: 'monitor' }
    if (/检索|RAG|SourceId/iu.test(value)) return { label: '检索与来源引用', value, icon: 'book' }
    if (/模型|抽取|生成/u.test(value)) return { label: '单次模型调用', value, icon: 'database' }
    return { label: '项目依据', value, icon: 'document' }
  })
  if (details.length > 0) return details
  return [{ label: '选择依据', value: source || '尚未记录选择依据', icon: 'document' }]
}

function designExcludedMechanisms(rationale: string | undefined): string {
  const exclusion = rationale?.split('；').slice(1).join('；').split('。', 1)[0]?.trim() ?? ''
  return exclusion.replace(/本期不采用.*$/u, '').trim() || '未单独记录'
}

function designEvidenceReferences(rationale: string | undefined): string {
  const references = rationale?.match(/src_[0-9a-z]+(?:…|\.\.\.)?/giu) ?? []
  return references.length > 0 ? references.join(' / ') : '尚未登记具体来源引用'
}

function DesignHeroBlueprint() {
  return <svg className={css.designHeroBlueprint} viewBox="0 0 320 210" fill="none" aria-hidden="true">
    <g className={css.designHeroBlueprintGrid}>
      <path d="M12 36h286M12 72h286M12 108h286M12 144h286M12 180h286" />
      <path d="M44 8v194M92 8v194M140 8v194M188 8v194M236 8v194M284 8v194" />
    </g>
    <g className={css.designHeroBlueprintBase}>
      <path d="m160 28 57 27-57 27-57-27 57-27Z" />
      <path d="m160 52 73 35-73 35-73-35 73-35Z" />
      <path d="m160 81 90 42-90 42-90-42 90-42Z" />
      <path d="m160 112 108 50-108 50-108-50 108-50Z" />
      <path d="M160 0v186" />
    </g>
    <g className={css.designHeroBlueprintDetails}>
      <path d="M40 166 8 181M280 166l32 15M66 178l-28 14M254 178l28 14" />
      <circle cx="160" cy="28" r="3" />
      <circle cx="160" cy="82" r="2.5" />
      <circle cx="160" cy="165" r="2" />
    </g>
  </svg>
}

function DesignSemanticRouteArt() {
  return <svg className={css.designSemanticRouteArt} viewBox="0 0 160 118" fill="none" aria-hidden="true">
    <path d="m31 61 23-34 39 18 25-24M31 61l-8 36 43 10 27-62M66 107l42-5 10-31M118 21l17 50-42-26M31 61l62-16M23 97l85 5" />
    <circle cx="31" cy="61" r="7" /><circle cx="54" cy="27" r="6" /><circle cx="93" cy="45" r="8" />
    <circle cx="118" cy="21" r="6" /><circle cx="135" cy="71" r="6" /><circle cx="108" cy="102" r="7" />
    <circle cx="66" cy="107" r="6" /><circle cx="23" cy="97" r="6" />
  </svg>
}

type DesignDrawer = 'route' | 'sources' | 'definition' | 'candidates' | 'context'

function DesignBuildIcon({ name }: { readonly name: 'provider' | 'extract' | 'schema' | 'cube' | 'refresh' | 'check' | 'info' | 'search' | 'bell' | 'calendar' | 'layers' | 'grid' | 'arrow' }) {
  return <svg className={css.designBuildIcon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    {name === 'provider' && <><rect x="3" y="3" width="18" height="7" rx="2" /><rect x="3" y="14" width="18" height="7" rx="2" /><path d="M6 6.5h.1M6 17.5h.1M15 6.5h3M15 17.5h3" /></>}
    {name === 'extract' && <><path d="M3 4h1M7 4h12M3 9h1M7 9h4M3 14h1M7 14h5M3 19h1M7 19h8" /><circle cx="17" cy="11" r="4" /><path d="m19.5 14 2 4M20 20v1" /></>}
    {name === 'schema' && <><circle cx="12" cy="4" r="2" /><circle cx="4" cy="8" r="2" /><circle cx="20" cy="8" r="2" /><path d="M6 7l4-2M14 5l4 2M4 10v5M20 10v5M12 6v9" /><rect x="2" y="16" width="4" height="5" rx="1" /><rect x="10" y="16" width="4" height="5" rx="1" /><rect x="18" y="16" width="4" height="5" rx="1" /></>}
    {name === 'cube' && <><path d="m12 2 9 5v10l-9 5-9-5V7l9-5Z" /><path d="m3 7 9 5 9-5M12 12v10" /></>}
    {name === 'refresh' && <><path d="M20 8a8 8 0 1 0 .1 7M20 3v5h-5" /></>}
    {name === 'check' && <><circle cx="12" cy="12" r="10" fill="currentColor" stroke="none" /><path d="m7 12 3 3 7-7" stroke="var(--dsw-static-neutral-bluish-00)" /></>}
    {name === 'info' && <><circle cx="12" cy="12" r="10" fill="currentColor" stroke="none" /><path d="M12 11v6M12 7v.1" stroke="var(--dsw-static-neutral-bluish-00)" /></>}
    {name === 'search' && <><circle cx="10" cy="10" r="7.5" /><path d="m16 16 5 5M8 8a2 2 0 0 1 4 0c0 2-2 1.5-2 3M10 14v.1" /></>}
    {name === 'bell' && <><path d="M9 4a3 3 0 0 1 6 0M5 10a7 7 0 0 1 14 0v5l2 3H3l2-3v-5ZM9 21h6" /></>}
    {name === 'calendar' && <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 2v6M17 2v6M3 11h18M7 15h4M7 18h3" /></>}
    {name === 'layers' && <><path d="m12 2 9 5-9 5-9-5 9-5Zm-9 11 9 5 9-5M3 18l9 5 9-5M3 12l3-2M18 10l3 2" /></>}
    {name === 'grid' && <><rect x="3" y="3" width="6" height="6" rx="2" /><rect x="15" y="3" width="6" height="6" rx="2" /><rect x="3" y="15" width="6" height="6" rx="2" /><rect x="15" y="15" width="6" height="6" rx="2" /></>}
    {name === 'arrow' && <path d="M3 12h18m-7-7 7 7-7 7" />}
  </svg>
}

function DesignProviderArt() {
  return <svg className={css.designProviderArt} viewBox="0 0 100 90" fill="none" aria-hidden="true">
    <path d="M82 48V19a5 5 0 0 0-5-5H15a5 5 0 0 0-5 5v41a5 5 0 0 0 5 5h43M10 60h48M39 65l-3 12M53 65l3 12M29 77h34" />
    <path d="m47 26 10 5.5v12L47 49l-10-5.5v-12L47 26Zm-10 5.5 10 6 10-6M47 37.5V49" />
    <circle cx="75" cy="65" r="13" /><path d="m69 65 4 4 8-9" />
  </svg>
}

function semanticRunLabel(kind: V2DesignSnapshot['workspace']['runs'][number]['kind']): string {
  return {
    extract: '候选抽取', 'propose-schema': '生成候选 Schema', 'publish-schema': '发布本体',
    build: '构建知识图谱', validate: '校验图谱与查询', context: '生成 Agent 上下文', slice: '运行纵向切片',
  }[kind]
}

function semanticRunStatus(status: V2DesignSnapshot['workspace']['runs'][number]['status']): string {
  if (status === 'succeeded') return '成功'
  if (status === 'failed') return '失败'
  if (status === 'running') return '运行中'
  if (status === 'stale') return '需重新验证'
  if (status === 'cancelled') return '已取消'
  return '等待'
}

const GRAPH_BUILD_LABELS = { not_applicable: '不适用', waiting: '尚未构建', running: '构建中', succeeded: '构建成功', failed: '构建失败', cancelled: '已取消', stale: '需重新构建' } as const
const QUERY_KIND_LABELS = { lookup: '对象查找', edge: '直接关系', path: '多跳路径' } as const
const SOURCE_PARSE_LABELS: Readonly<Record<string, string>> = { ready: '已解析', pending: '待解析', parsing: '解析中', failed: '解析失败', stale: '需重新解析', unsupported: '暂不支持解析' }

function DesignClassIcon({ id, label }: { readonly id: string; readonly label: string }) {
  const text = `${id} ${label}`
  if (/alert|告警/i.test(text)) return <DesignBuildIcon name="bell" />
  if (/store|门店/i.test(text)) return <DesignBuildIcon name="provider" />
  if (/incident|故障/i.test(text)) return <InvestigationIcon name="warning" />
  if (/message|消息/i.test(text)) return <InvestigationIcon name="message" />
  if (/vendor|supplier|维修商|供应商/i.test(text)) return <InvestigationIcon name="people" />
  if (/principal|权限|用户/i.test(text)) return <InvestigationIcon name="shield" />
  if (/source|来源/i.test(text)) return <InvestigationIcon name="database" />
  if (/report|contract|order|记录|合同|工单/i.test(text)) return <InvestigationIcon name="document" />
  return <DesignBuildIcon name="cube" />
}

function DesignRunIcon({ kind }: { readonly kind: V2DesignSnapshot['workspace']['runs'][number]['kind'] }) {
  if (kind === 'validate') return <InvestigationIcon name="shield" />
  if (kind === 'publish-schema') return <InvestigationIcon name="network" />
  if (kind === 'build' || kind === 'slice') return <DesignBuildIcon name="cube" />
  if (kind === 'context') return <DesignBuildIcon name="search" />
  return <DesignBuildIcon name="extract" />
}

function designBlockerCategory(text: string): 'context' | 'ontology' | 'permission' | 'other' {
  if (/权限|获批|批准|审批|外部写入|permission/i.test(text)) return 'permission'
  if (/本体|Ontology|Schema|候选结论|机制/i.test(text)) return 'ontology'
  if (/上下文|切片|context|slice/i.test(text)) return 'context'
  return 'other'
}

function definitionInput(workspace: V2DesignSnapshot['workspace'] | undefined): SemanticDefinitionInput {
  const definition = workspace?.definition
  return {
    version: definition?.version ?? '0.1.0',
    competencyQuestions: definition?.competencyQuestions ?? [],
    classes: definition?.classes ?? [],
    relationships: definition?.relationships ?? [],
    provenanceRules: definition?.provenanceRules ?? [],
    temporalRules: definition?.temporalRules ?? [],
    confidenceThreshold: definition?.confidenceThreshold ?? 0.65,
    shaclSeverity: definition?.shaclSeverity ?? 'Violation',
  }
}

function semanticStepState(done: boolean, active: boolean): 'done' | 'active' | 'waiting' {
  return done ? 'done' : active ? 'active' : 'waiting'
}

function definitionLines(value: string): readonly string[] {
  return value.split('\n').map(item => item.trim()).filter(Boolean)
}

function definitionKeys(value: string): readonly string[] {
  return value.split(/[,，]/u).map(item => item.trim()).filter(Boolean)
}

function nextDefinitionId(prefix: string, values: readonly { readonly id: string }[]): string {
  const ids = new Set(values.map(item => item.id))
  let index = values.length + 1
  while (ids.has(`${prefix}_${String(index)}`)) index += 1
  return `${prefix}_${String(index)}`
}

function OntologyDefinitionEditor({ value, onChange }: {
  readonly value: SemanticDefinitionInput
  readonly onChange: (value: SemanticDefinitionInput) => void
}) {
  const updateQuestion = (index: number, patch: Partial<SemanticDefinitionInput['competencyQuestions'][number]>): void => {
    onChange({ ...value, competencyQuestions: value.competencyQuestions.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) })
  }
  const updateClass = (index: number, patch: Partial<SemanticDefinitionInput['classes'][number]>): void => {
    onChange({ ...value, classes: value.classes.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) })
  }
  const updateRelationship = (index: number, patch: Partial<SemanticDefinitionInput['relationships'][number]>): void => {
    onChange({ ...value, relationships: value.relationships.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) })
  }
  const updateRule = (kind: 'provenanceRules' | 'temporalRules', index: number, patch: Partial<SemanticDefinitionInput[typeof kind][number]>): void => {
    onChange({ ...value, [kind]: value[kind].map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) })
  }
  const classOptions = value.classes.map(item => <option key={item.id} value={item.id}>{item.label || item.id}</option>)

  return <div className={css.designDefinitionEditor}>
    <section className={css.designDefinitionGroup}>
      <header><span><b>01</b><strong>版本与校验设置</strong></span><small>保存为新草稿，不覆盖旧运行证据</small></header>
      <div className={css.designDefinitionGrid}>
        <label>Schema 版本<input value={value.version} onChange={(event) => { onChange({ ...value, version: event.target.value }) }} placeholder="0.1.0" /></label>
        <label>最低抽取分数<input type="number" min="0" max="1" step="0.05" value={value.confidenceThreshold} onChange={(event) => { onChange({ ...value, confidenceThreshold: Number(event.target.value) }) }} /></label>
        <label>SHACL 约束严重级别<select value={value.shaclSeverity} onChange={(event) => { onChange({ ...value, shaclSeverity: event.target.value as SemanticDefinitionInput['shaclSeverity'] }) }}><option value="Violation">Violation · 违规</option><option value="Warning">Warning · 警告</option><option value="Info">Info · 提示</option></select></label>
      </div>
    </section>

    <section className={css.designDefinitionGroup}>
      <header><span><b>02</b><strong>业务问题</strong></span><button type="button" onClick={() => { onChange({ ...value, competencyQuestions: [...value.competencyQuestions, { id: nextDefinitionId('cq', value.competencyQuestions), text: '', required: true, query: { kind: 'lookup', maxDepth: 1, minAnswers: 1 } }] }) }}>＋ 添加问题</button></header>
      <p>列出图谱必须回答的业务问题。必答问题的查询未通过，不能标记方案验证通过。</p>
      <div className={css.designDefinitionList}>{value.competencyQuestions.map((item, index) => <article key={`${item.id}-${String(index)}`}>
        <header><strong>问题 {String(index + 1).padStart(2, '0')}</strong><button type="button" onClick={() => { onChange({ ...value, competencyQuestions: value.competencyQuestions.filter((_, itemIndex) => itemIndex !== index) }) }}>移除</button></header>
        <div className={css.designDefinitionGrid}>
          <label>唯一标识 ID<input value={item.id} onChange={(event) => { updateQuestion(index, { id: event.target.value }) }} /></label>
          <label className={css.designDefinitionWide}>业务问题<input value={item.text} onChange={(event) => { updateQuestion(index, { text: event.target.value }) }} placeholder="例如：某类对象变化会影响哪些任务？" /></label>
          <label>查询方式<select value={item.query.kind} onChange={(event) => { updateQuestion(index, { query: { ...item.query, kind: event.target.value as 'lookup' | 'edge' | 'path' } }) }}><option value="lookup">对象查找</option><option value="edge">直接关系</option><option value="path">多跳路径</option></select></label>
          <label>起点类型<input value={item.query.sourceType ?? ''} onChange={(event) => { updateQuestion(index, { query: { ...item.query, sourceType: event.target.value } }) }} placeholder="Class ID" /></label>
          <label>关系类型<input value={item.query.relationshipType ?? ''} onChange={(event) => { updateQuestion(index, { query: { ...item.query, relationshipType: event.target.value } }) }} placeholder="Relation ID" /></label>
          <label>终点类型<input value={item.query.targetType ?? ''} onChange={(event) => { updateQuestion(index, { query: { ...item.query, targetType: event.target.value } }) }} placeholder="Class ID" /></label>
          <label>最大深度<input type="number" min="1" max="8" value={item.query.maxDepth} onChange={(event) => { updateQuestion(index, { query: { ...item.query, maxDepth: Number(event.target.value) } }) }} /></label>
          <label>最少答案<input type="number" min="1" max="1000" value={item.query.minAnswers} onChange={(event) => { updateQuestion(index, { query: { ...item.query, minAnswers: Number(event.target.value) } }) }} /></label>
          <label className={css.designDefinitionCheck}><input type="checkbox" checked={item.required} onChange={(event) => { updateQuestion(index, { required: event.target.checked }) }} />设为必答问题</label>
        </div>
      </article>)}{value.competencyQuestions.length === 0 && <em>至少定义一个可在当前项目图谱上真实执行的必答问题。</em>}</div>
    </section>

    <section className={css.designDefinitionGroup}>
      <header><span><b>03</b><strong>实体类型、属性与字段映射</strong></span><button type="button" onClick={() => { onChange({ ...value, classes: [...value.classes, { id: nextDefinitionId('class', value.classes), label: '', aliases: [], identityKeys: [], properties: [], fieldMappings: [], extractionPatterns: [] }] }) }}>＋ 添加实体类型</button></header>
      <p>实体类型（Class）定义业务对象；别名记录不同称呼，标识字段用于匹配同一对象，字段映射关联来源字段与本体属性。</p>
      <div className={css.designDefinitionList}>{value.classes.map((item, index) => <article key={`${item.id}-${String(index)}`}>
        <header><strong>Class {String(index + 1).padStart(2, '0')}</strong><button type="button" onClick={() => { onChange({ ...value, classes: value.classes.filter((_, itemIndex) => itemIndex !== index), relationships: value.relationships.filter(relation => relation.domain !== item.id && relation.range !== item.id) }) }}>移除</button></header>
        <div className={css.designDefinitionGrid}>
          <label>唯一标识 ID<input value={item.id} onChange={(event) => { updateClass(index, { id: event.target.value }) }} /></label>
          <label>中文名称<input value={item.label} onChange={(event) => { updateClass(index, { label: event.target.value }) }} /></label>
          <label className={css.designDefinitionWide}>定义<input value={item.description ?? ''} onChange={(event) => { updateClass(index, { description: event.target.value }) }} placeholder="说明这个对象在当前项目中的业务含义" /></label>
          <label className={css.designDefinitionWide}>业务别名<input value={item.aliases.join(', ')} onChange={(event) => { updateClass(index, { aliases: definitionKeys(event.target.value) }) }} placeholder="例如：责任人, Owner" /></label>
          <label className={css.designDefinitionWide}>实体标识字段<input value={item.identityKeys.join(', ')} onChange={(event) => { updateClass(index, { identityKeys: definitionKeys(event.target.value) }) }} placeholder="例如：external_id, name" /></label>
          <label className={css.designDefinitionWide}>抽取规则<textarea value={item.extractionPatterns.join('\n')} onChange={(event) => { updateClass(index, { extractionPatterns: definitionLines(event.target.value) }) }} placeholder="每行一条正则；命名组使用 (?P&lt;label&gt;...)" /></label>
        </div>
        <div className={css.designPropertyList}>
          <header><strong>属性</strong><button type="button" onClick={() => { updateClass(index, { properties: [...item.properties, { id: nextDefinitionId('property', item.properties), label: '', dataType: 'string', required: false, unique: false }] }) }}>＋ 添加属性</button></header>
          {item.properties.map((property, propertyIndex) => <div key={`${property.id}-${String(propertyIndex)}`}>
            <input aria-label={`${item.label || item.id} 属性 ID`} value={property.id} onChange={(event) => { const nextId = event.target.value; updateClass(index, { properties: item.properties.map((current, currentIndex) => currentIndex === propertyIndex ? { ...current, id: nextId } : current), fieldMappings: item.fieldMappings.map(mapping => mapping.targetProperty === property.id ? { ...mapping, targetProperty: nextId } : mapping) }) }} />
            <input aria-label={`${item.label || item.id} 属性名称`} value={property.label} onChange={(event) => { updateClass(index, { properties: item.properties.map((current, currentIndex) => currentIndex === propertyIndex ? { ...current, label: event.target.value } : current) }) }} />
            <select aria-label={`${item.label || item.id} 属性类型`} value={property.dataType} onChange={(event) => { updateClass(index, { properties: item.properties.map((current, currentIndex) => currentIndex === propertyIndex ? { ...current, dataType: event.target.value as typeof current.dataType } : current) }) }}><option value="string">文本</option><option value="number">数字</option><option value="boolean">布尔</option><option value="date">日期</option><option value="datetime">日期时间</option></select>
            <label><input type="checkbox" checked={property.required} onChange={(event) => { updateClass(index, { properties: item.properties.map((current, currentIndex) => currentIndex === propertyIndex ? { ...current, required: event.target.checked } : current) }) }} />必填</label>
            <label><input type="checkbox" checked={property.unique} onChange={(event) => { updateClass(index, { properties: item.properties.map((current, currentIndex) => currentIndex === propertyIndex ? { ...current, unique: event.target.checked } : current) }) }} />唯一</label>
            <button type="button" aria-label={`移除 ${property.label || property.id} 属性`} onClick={() => { updateClass(index, { properties: item.properties.filter((_, currentIndex) => currentIndex !== propertyIndex), fieldMappings: item.fieldMappings.filter(mapping => mapping.targetProperty !== property.id) }) }}>×</button>
          </div>)}
          {item.properties.length === 0 && <em>当前类没有额外属性。</em>}
        </div>
        <div className={css.designMappingList}>
          <header><strong>来源字段映射</strong><button type="button" disabled={item.properties.length === 0} onClick={() => { const targetProperty = item.properties[0]?.id; if (targetProperty !== undefined) updateClass(index, { fieldMappings: [...item.fieldMappings, { sourceField: '', targetProperty }] }) }}>＋ 添加映射</button></header>
          {item.fieldMappings.map((mapping, mappingIndex) => <div key={`${mapping.sourceField}-${mapping.targetProperty}-${String(mappingIndex)}`}>
            <input aria-label={`${item.label || item.id} 来源字段`} value={mapping.sourceField} onChange={(event) => { updateClass(index, { fieldMappings: item.fieldMappings.map((current, currentIndex) => currentIndex === mappingIndex ? { ...current, sourceField: event.target.value } : current) }) }} placeholder="来源字段或抽取命名组" />
            <span aria-hidden="true">→</span>
            <select aria-label={`${item.label || item.id} 目标属性`} value={mapping.targetProperty} onChange={(event) => { updateClass(index, { fieldMappings: item.fieldMappings.map((current, currentIndex) => currentIndex === mappingIndex ? { ...current, targetProperty: event.target.value } : current) }) }}>{item.properties.map(property => <option key={property.id} value={property.id}>{property.label || property.id}</option>)}</select>
            <button type="button" aria-label={`移除 ${mapping.sourceField || '字段'} 映射`} onClick={() => { updateClass(index, { fieldMappings: item.fieldMappings.filter((_, currentIndex) => currentIndex !== mappingIndex) }) }}>×</button>
          </div>)}
          {item.fieldMappings.length === 0 && <em>尚未把来源字段映射到当前类属性。</em>}
        </div>
      </article>)}{value.classes.length === 0 && <em>尚未定义领域对象；可先从代表材料生成候选 Schema，再回来删改。</em>}</div>
    </section>

    <section className={css.designDefinitionGroup}>
      <header><span><b>04</b><strong>关系与约束</strong></span><button type="button" disabled={value.classes.length === 0} onClick={() => { const first = value.classes[0]?.id ?? ''; onChange({ ...value, relationships: [...value.relationships, { id: nextDefinitionId('relation', value.relationships), label: '', domain: first, range: first, cardinality: 'many-to-many', extractionPatterns: [] }] }) }}>＋ 添加关系</button></header>
      <p>定义关系的起点类型（Domain）、终点类型（Range）和数量关系（基数）。抽取规则使用 source 与 target 命名组。</p>
      <div className={css.designDefinitionList}>{value.relationships.map((item, index) => <article key={`${item.id}-${String(index)}`}>
        <header><strong>Relation {String(index + 1).padStart(2, '0')}</strong><button type="button" onClick={() => { onChange({ ...value, relationships: value.relationships.filter((_, itemIndex) => itemIndex !== index) }) }}>移除</button></header>
        <div className={css.designDefinitionGrid}>
          <label>唯一标识 ID<input value={item.id} onChange={(event) => { updateRelationship(index, { id: event.target.value }) }} /></label>
          <label>中文名称<input value={item.label} onChange={(event) => { updateRelationship(index, { label: event.target.value }) }} /></label>
          <label>起点类型（Domain）<select value={item.domain} onChange={(event) => { updateRelationship(index, { domain: event.target.value }) }}>{classOptions}</select></label>
          <label>终点类型（Range）<select value={item.range} onChange={(event) => { updateRelationship(index, { range: event.target.value }) }}>{classOptions}</select></label>
          <label>数量关系<select value={item.cardinality} onChange={(event) => { updateRelationship(index, { cardinality: event.target.value as typeof item.cardinality }) }}><option value="one-to-one">一对一</option><option value="one-to-many">一对多</option><option value="many-to-one">多对一</option><option value="many-to-many">多对多</option></select></label>
          <label className={css.designDefinitionWide}>定义<input value={item.description ?? ''} onChange={(event) => { updateRelationship(index, { description: event.target.value }) }} /></label>
          <label className={css.designDefinitionWide}>抽取规则<textarea value={item.extractionPatterns.join('\n')} onChange={(event) => { updateRelationship(index, { extractionPatterns: definitionLines(event.target.value) }) }} placeholder="每行一条；使用 (?P&lt;source&gt;...) 与 (?P&lt;target&gt;...)" /></label>
        </div>
      </article>)}{value.relationships.length === 0 && <em>当前 Schema 没有关系定义；若业务问题只需对象查找，可以保持为空。</em>}</div>
    </section>

    {(['provenanceRules', 'temporalRules'] as const).map((kind, groupIndex) => <section className={css.designDefinitionGroup} key={kind}>
      <header><span><b>{String(groupIndex + 5).padStart(2, '0')}</b><strong>{kind === 'provenanceRules' ? '来源与冲突规则' : '时间有效规则'}</strong></span><button type="button" onClick={() => { onChange({ ...value, [kind]: [...value[kind], { id: nextDefinitionId(kind === 'provenanceRules' ? 'source_rule' : 'time_rule', value[kind]), label: '', description: '' }] }) }}>＋ 添加规则</button></header>
      <p>{kind === 'provenanceRules' ? '说明每条事实如何引用来源，以及来源冲突时采用什么优先级。' : '说明有效时间、记录时间、过期和历史版本如何处理。'}</p>
      <div className={css.designDefinitionList}>{value[kind].map((item, index) => <article key={`${item.id}-${String(index)}`}>
        <header><strong>Rule {String(index + 1).padStart(2, '0')}</strong><button type="button" onClick={() => { onChange({ ...value, [kind]: value[kind].filter((_, itemIndex) => itemIndex !== index) }) }}>移除</button></header>
        <div className={css.designDefinitionGrid}><label>唯一标识 ID<input value={item.id} onChange={(event) => { updateRule(kind, index, { id: event.target.value }) }} /></label><label>中文名称<input value={item.label} onChange={(event) => { updateRule(kind, index, { label: event.target.value }) }} /></label><label className={css.designDefinitionWide}>规则说明<textarea value={item.description} onChange={(event) => { updateRule(kind, index, { description: event.target.value }) }} /></label></div>
      </article>)}{value[kind].length === 0 && <em>尚未定义{kind === 'provenanceRules' ? '来源规则' : '时间规则'}。</em>}</div>
    </section>)}
  </div>
}

function InvestigationStagePanel({ props, workspace, sessionId, view, stageState, surface, historicalActualStage }: {
  readonly props: WorkbenchProps
  readonly workspace: { readonly workspaceId: string; readonly title: string; readonly path: string }
  readonly sessionId: string
  readonly view: boolean
  readonly stageState: ProjectStageValue
  readonly surface: V2StageSurfaceSnapshot | undefined
  readonly historicalActualStage?: FdeV2StageId
}) {
  const [reviewing, setReviewing] = useState(false)
  const [returning, setReturning] = useState(false)
  const [returnReason, setReturnReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (surface === undefined) return <section className={css.state} role="alert"><strong>第三阶段资料尚未加载</strong><span>请刷新项目工作台后重试。</span></section>

  const investigation = surface.investigation
  const currentWork = surface.workItems.find(item => item.id === surface.currentWorkId) ?? surface.workItems[0]
  const openBlockers = surface.blockers.filter(item => item.status === 'open')
  const artifactById = new Map(surface.artifacts.map(artifact => [artifact.id, artifact]))
  const systemMap = artifactById.get('system-access-map')
  const dataReadiness = artifactById.get('data-readiness')
  const governanceReview = artifactById.get('governance-review')
  const structured = investigation !== undefined
  const systemNodes = investigation?.systems ?? []
  const connections = investigation?.connections ?? []
  const actionBoundaries = investigation?.actionBoundaries ?? []
  const dataFindings = investigation?.dataFindings ?? []
  const governanceReviews = investigation?.governanceReviews ?? []
  const historical = historicalActualStage !== undefined
  const actualStageIndex = historicalActualStage === undefined ? -1 : FDE_V2_STAGE_IDS.indexOf(historicalActualStage)

  const openFile = (path: string, title: string): void => {
    setError(null)
    void props.openProjectFile(sessionId, workspace.path, path, title).catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : String(cause))
    })
  }
  const recordInteraction = (artifact: V2StageSurfaceSnapshot['artifacts'][number] | undefined, label: string) => {
    if (artifact?.status !== 'present') return {}
    const open = (): void => { openFile(artifact.path, artifact.title) }
    return {
      role: 'button' as const,
      tabIndex: 0,
      'aria-label': `${label}（${artifact.title}）`,
      'data-investigation-record-link': '',
      onClick: open,
      onKeyDown: (event: KeyboardEvent<HTMLElement>): void => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        open()
      },
    }
  }
  const workItemArtifact = (id: string): V2StageSurfaceSnapshot['artifacts'][number] | undefined => {
    if (id === 'data') return dataReadiness
    if (id === 'owners') return governanceReview
    return systemMap
  }
  const currentWorkArtifact = workItemArtifact(currentWork?.id ?? '')
  const complete = async (): Promise<void> => {
    setSubmitting(true); setError(null)
    try { await props.completeV2Stage(workspace.workspaceId, stageState.revision, 'investigation') }
    catch (cause: unknown) { setError(cause instanceof Error ? cause.message : String(cause)) }
    finally { setSubmitting(false) }
  }
  const returnStage = async (): Promise<void> => {
    if (returnReason.trim() === '') { setError('请先说明为什么要返回上一阶段。'); return }
    setSubmitting(true); setError(null)
    try { await props.returnV2Stage(workspace.workspaceId, stageState.revision, returnReason) }
    catch (cause: unknown) { setError(cause instanceof Error ? cause.message : String(cause)) }
    finally { setSubmitting(false) }
  }

  return <section
    className={`${css.root} ${css.investigationStageRoot} ${historical ? css.browsedStage : ''}`}
    data-fde-stage-workbench=""
    data-conversation-hero-project=""
    data-stage="investigation"
    data-historical={historical ? 'true' : undefined}
    data-hide-stage-composer={historical ? 'true' : undefined}
    data-conversation-composer-layout={historical ? 'stage-history' : 'stage-investigation'}
    data-conversation-composer-overlay={view ? '' : undefined}
    aria-label={historical ? '历史阶段：调查数据、系统、接口、安全与组织' : '项目阶段工作台：调查数据、系统、接口、安全与组织'}
  >
    {historical && <header className={css.browsedStageNotice}>
      <HistoricalNoticeIcon />
      <div><span>阶段完成记录</span><strong>正在查看第 3 阶段，项目当前在“{V2_STAGE_NAMES[actualStageIndex]}”</strong><p>只读查看第三阶段已保存的环境调查结果与记录。</p></div>
      <button type="button" className={css.secondaryButton} onClick={() => { props.returnToCurrentStage(workspace.workspaceId) }}>返回当前阶段 <span aria-hidden="true">→</span></button>
    </header>}
    <div className={css.investigationShell}>
      <main>
        <section className={css.investigationHero} data-investigation-hero="">
          <div>
            <span>第 3/8 阶段 · {historical ? '已完成' : '真实环境尽职调查'}</span>
            <h1 data-investigation-title="">{surface.objective}</h1>
            <p data-investigation-body="">{surface.explanation}</p>
            <div className={css.investigationHeroFacts}>
              <b>{surface.presentCount}/{surface.requiredCount} 份阶段记录</b>
              <b data-tone={openBlockers.length > 0 ? 'warning' : undefined}>{openBlockers.length} 项未解决事项</b>
              <b>{historical ? '已通过 FDE 阶段评审' : surface.reviewReady ? '可提交 FDE 评审' : '尚未进入方案设计'}</b>
            </div>
          </div>
          <div className={css.investigationStageRing} data-investigation-counter="" aria-label={historical ? '第 3/8 阶段已完成' : '当前处于第 3 阶段，共 8 个阶段'}><strong>03</strong><small>/ 08</small></div>
          <InvestigationCircuitArt />
        </section>

        <section className={css.investigationOverview} data-investigation-overview="" aria-label="第三阶段调查总览">
          <header><div><span>01 / 调查总览</span><h2 data-investigation-overview-title="">四个现场条件，分别留下证据</h2></div>{currentWorkArtifact?.status === 'present'
            ? <button type="button" data-investigation-owner-action="" onClick={() => { openFile(currentWorkArtifact.path, currentWorkArtifact.title) }}><InvestigationIcon name="people" />{currentWork?.title ?? '等待调查记录'}</button>
            : <b data-investigation-owner-action=""><InvestigationIcon name="people" />{currentWork?.title ?? '等待调查记录'}</b>}</header>
          <div data-investigation-overview-list="">{surface.workItems.map((item, index) => <article key={item.id} data-status={item.status} {...recordInteraction(workItemArtifact(item.id), `查看调查工作项：${item.title}`)}>
            <i data-investigation-overview-icon=""><InvestigationIcon name={investigationOverviewIcon(index)} /></i>
            <span><small>{['数据能不能用', '系统能不能接', 'AI 允许做到哪一步', '谁负责和谁批准'][index] ?? item.title}</small><strong>{item.title}</strong><p>{item.purpose}</p></span>
            <b>{investigationStateLabel(item.status)}</b>
          </article>)}</div>
        </section>

        <div className={css.investigationPrimaryGrid} data-investigation-primary-grid="">
          <section className={css.environmentMap}>
            <header><div><span>02 / 系统与数据关系</span><h2>系统、数据与接口关系</h2><p>查看已登记的系统、数据流向、负责人和访问条件。</p></div>
              {systemMap?.status === 'present' && <button type="button" onClick={() => { openFile(systemMap.path, systemMap.title) }}>查看系统与访问记录</button>}
            </header>
            {systemNodes.length > 0
              ? <><div className={css.environmentNodes}>{systemNodes.map((node, index) => <article key={node.id} data-kind={node.kind} data-status={node.status} {...recordInteraction(systemMap, `查看系统调查记录：${node.label}`)}>
                <i data-investigation-node-icon=""><InvestigationIcon name={investigationNodeIcon(node.kind, index)} /></i>
                <span><strong>{node.label}</strong><small>{node.owner === undefined ? '负责人待确认' : `负责人 · ${node.owner}`}</small>{node.note !== undefined && <p>{node.note}</p>}</span>
                <b>{investigationFactLabel(node.status)}</b>
              </article>)}</div>
              {connections.length > 0 && <div className={css.environmentConnections}>{connections.map((connection, index) => { const from = systemNodes.find(node => node.id === connection.from)?.label ?? connection.from; const to = systemNodes.find(node => node.id === connection.to)?.label ?? connection.to; return <span key={`${connection.from}-${connection.to}-${String(index)}`} {...recordInteraction(systemMap, `查看系统连接记录：${from}到${to}`)}><b>{from}</b><i>→</i><b>{to}</b><small>{connection.label ?? '关系已登记'}</small></span> })}</div>}</>
              : <div className={css.investigationEmpty}><strong>还没有登记真实系统关系</strong><p>完成数据与系统只读调查后，这里才显示真实系统、数据连接、负责人和访问条件。</p></div>}
          </section>

          <section className={css.actionBoundaryMatrix}>
            <header><span>03 / AI 动作边界</span><h2>读取、建议、草稿和执行不能混淆</h2><p>工具可用不等于获准执行；未知权限始终保持待确认。</p></header>
            <div className={css.actionBoundaryTable}>
              <div><b>调查对象</b><b>读取</b><b>生成建议</b><b>写草稿</b><b>正式执行</b></div>
              {actionBoundaries.map(row => <div key={row.target} data-investigation-action-row="" {...recordInteraction(systemMap, `查看动作边界：${row.target}`)}><strong>{row.target}</strong>{(['read', 'suggest', 'draft', 'execute'] as const).map(action => <span key={action} data-status={row[action]}>{investigationActionLabel(row[action])}</span>)}</div>)}
            </div>
            {actionBoundaries.length === 0 && <div className={css.investigationEmpty}><strong>尚未登记各项操作权限</strong><p>请分别核对读取、生成建议、写草稿和正式执行，不要用一个“有权限”概括。</p></div>}
          </section>
        </div>

        <div className={css.investigationSecondaryGrid} data-investigation-secondary-grid="">
          <section className={css.investigationFindings} data-investigation-findings="">
            <header><div><span>04 / 数据适用性</span><h2 data-investigation-findings-title="">数据质量、字段含义与获取条件</h2></div>{dataReadiness?.status === 'present' && <button type="button" onClick={() => { openFile(dataReadiness.path, dataReadiness.title) }}>查看记录</button>}</header>
            {dataFindings.length > 0 ? <div>{dataFindings.map(item => <article key={item.label} data-status={item.status} {...recordInteraction(dataReadiness, `查看数据调查结果：${item.label}`)}><i data-investigation-finding-icon=""><InvestigationIcon name={item.status === 'confirmed' ? 'shield' : item.status === 'pending' ? 'clock' : 'warning'} /></i><strong>{item.label}</strong><span>{item.value}</span><b>{item.status === 'confirmed' ? '已确认' : item.status === 'warning' ? '需关注' : item.status === 'blocked' ? '阻塞' : '待确认'}</b></article>)}</div> : <div className={css.investigationEmpty}><strong>尚未登记数据质量调查结果</strong><p>{dataReadiness?.status === 'present' ? '已有调查文件，请补充字段质量、缺失率和字段含义等调查结果。' : '数据来源、质量、敏感性和取得方式仍待调查。'}</p></div>}
          </section>

          <section className={css.investigationGovernance} data-investigation-governance="">
            <header><div><span>05 / 治理与责任</span><h2>各类审查独立记录</h2></div>{governanceReview?.status === 'present' && <button type="button" onClick={() => { openFile(governanceReview.path, governanceReview.title) }}>查看记录</button>}</header>
            {governanceReviews.length > 0 ? <div>{governanceReviews.map(item => <article key={item.area} data-status={item.status} {...recordInteraction(governanceReview, `查看治理记录：${governanceAreaLabel(item.area)}`)}><i data-investigation-governance-icon=""><InvestigationIcon name={investigationGovernanceIcon(item.area)} /></i><span><strong>{governanceAreaLabel(item.area)}</strong><small>{item.owner ?? '批准人待确认'}</small>{item.note !== undefined && <p>{item.note}</p>}</span><b>{investigationFactLabel(item.status)}</b></article>)}</div> : <div className={css.investigationEmpty}><strong>安全、隐私和责任结论尚未登记</strong><p>一种审查通过不能替代其他审查；没有有权确认人时必须保持待确认。</p></div>}
          </section>
        </div>

        <section className={css.investigationGate} data-investigation-gate="">
          <header><div><span>06 / 待解决问题、交付文件与阶段评审</span><h2>{historical ? '第三阶段调查与评审记录' : surface.reviewReady ? '环境证据已齐备，等待人工决定' : '还不能进入方案设计'}</h2><p data-investigation-gate-copy="">{historical ? '以下状态来自第三阶段已保存的调查记录。' : structured ? '以下状态来自当前调查记录。' : '尚未保存详细调查结果，请在 Agent 对话中完成调查并更新阶段记录。'}</p></div><b>{surface.presentCount}/{surface.requiredCount} 份记录</b></header>
          <div className={css.investigationArtifacts}>{surface.artifacts.map(artifact => <article key={artifact.id} data-status={artifact.status} data-investigation-artifact-icon=""><i><EvidenceDocumentIcon /></i><span><strong>{artifact.title}</strong><small>{artifact.purpose}</small></span><b>{artifact.status === 'present' ? '已完成' : artifact.status === 'error' ? '读取失败' : '待形成'}</b>{artifact.status === 'present' && <button type="button" onClick={() => { openFile(artifact.path, artifact.title) }}>查看</button>}</article>)}</div>
          {openBlockers.length > 0 && <div className={css.investigationBlockers}><strong>{openBlockers.length} 项待确认事项 · 核对影响范围</strong><div className={css.investigationBlockerTable}><div><b>待确认事项</b><b>审批 / 时间</b><b>对后续工作的影响</b></div>{openBlockers.map((blocker) => { const row = parseInvestigationBlocker(blocker.title); return <div key={blocker.id} data-severity={blocker.severity} data-investigation-blocker-row=""><span><i aria-hidden="true">!</i><b>待确认</b>{row.title}</span><span>{row.meta}</span><span>{row.impact}</span></div> })}</div></div>}
          {historical
            ? <footer className={css.historicalArchiveFooter}><span><HistoricalArchiveIcon /><span>当前只读查看已保存的调查结果与阶段记录。<small>记录完成不等于权限获批。</small></span></span><strong data-investigation-readonly-control="">只读记录</strong></footer>
            : <><div className={css.investigationActions}>
              <button type="button" className={css.primaryButton} onClick={() => { props.prepareStageDraft(sessionId, surface.prompt) }}>开始环境调查</button>
              <button type="button" className={css.secondaryButton} onClick={() => { props.refreshProjectSurface(workspace.workspaceId) }}>刷新调查记录</button>
              {surface.reviewReady && <button type="button" className={css.primaryButton} onClick={() => { setReviewing(value => !value) }}>{reviewing ? '收起人工评审' : '提交 FDE 评审'}</button>}
              <button type="button" className={css.tertiaryButton} onClick={() => { setReturning(value => !value) }}>返回上一阶段</button>
            </div>
            {reviewing && <div className={css.genericReview}><strong>确认环境证据和动作边界已经核对？</strong><p>确认后进入“设计方案并完成端到端纵向切片”。未授权能力仍不能被视为可执行。</p><button type="button" className={css.primaryButton} disabled={submitting} onClick={() => { void complete() }}>{submitting ? '正在提交…' : '确认并继续'}</button></div>}
            {returning && <div className={css.genericReview}><label htmlFor="investigation-return-reason">返回原因</label><textarea id="investigation-return-reason" value={returnReason} onChange={(event) => { setReturnReason(event.target.value) }} placeholder="例如：客户补充了新的业务边界，需要回到第二阶段重新核对。" /><button type="button" className={css.secondaryButton} disabled={submitting} onClick={() => { void returnStage() }}>保留现有材料并返回</button></div>}
            </>}
          {error !== null && <p className={css.inlineError} role="alert">{error}</p>}
        </section>
      </main>
    </div>
  </section>
}

function DesignStagePanel({ props, workspace, sessionId, view, stageState, surface, projectSurface, sourceFiles, historicalActualStage }: {
  readonly props: WorkbenchProps
  readonly workspace: { readonly workspaceId: string; readonly title: string; readonly path: string }
  readonly sessionId: string
  readonly view: boolean
  readonly stageState: ProjectStageValue
  readonly surface: V2StageSurfaceSnapshot | undefined
  readonly projectSurface: ProjectSurfaceSnapshot | undefined
  readonly sourceFiles: readonly ProjectSourceItem[]
  readonly historicalActualStage?: FdeV2StageId
}) {
  const [reviewing, setReviewing] = useState(false)
  const [returning, setReturning] = useState(false)
  const [returnReason, setReturnReason] = useState('')
  const [decisionOutcome, setDecisionOutcome] = useState<'go' | 'revise' | 'narrow' | 'stop'>('go')
  const [decisionRationale, setDecisionRationale] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [drawer, setDrawer] = useState<DesignDrawer | null>(null)
  const [operation, setOperation] = useState<string | null>(null)
  const [routeMechanism, setRouteMechanism] = useState<DesignExecutionMechanism | ''>('')
  const [routeSemanticMode, setRouteSemanticMode] = useState<'schema' | 'ontology' | ''>('')
  const [executionRationale, setExecutionRationale] = useState('')
  const [semanticRationale, setSemanticRationale] = useState('')
  const [selectedSources, setSelectedSources] = useState<readonly string[]>([])
  const [permissionScope, setPermissionScope] = useState('仅限当前项目第四阶段最小纵向切片')
  const [sourceAuthority, setSourceAuthority] = useState<'primary' | 'supporting'>('primary')
  const [definitionDraft, setDefinitionDraft] = useState<SemanticDefinitionInput>(() => definitionInput(undefined))
  const [candidateDecisions, setCandidateDecisions] = useState<Readonly<Record<string, 'accepted' | 'rejected'>>>({})
  const [contextQuestionId, setContextQuestionId] = useState('')
  const [contextSeedId, setContextSeedId] = useState('')
  const [contextQuery, setContextQuery] = useState('为当前最窄纵向切片提供必要的项目事实与约束')
  const [contextDepth, setContextDepth] = useState(1)
  const [relationshipsExpanded, setRelationshipsExpanded] = useState(false)
  const [runsExpanded, setRunsExpanded] = useState(false)
  if (surface === undefined) return <section className={css.state} role="alert"><strong>第四阶段资料尚未加载</strong><span>请刷新项目工作台后重试。</span></section>

  const historical = historicalActualStage !== undefined
  const actualStageIndex = historicalActualStage === undefined ? -1 : FDE_V2_STAGE_IDS.indexOf(historicalActualStage)
  const design = surface.design
  const semanticWorkspace = design?.workspace
  const openBlockers = surface.blockers.filter(item => item.status === 'open')
  const graphSnapshot = design?.graph.snapshot
  const graphReady = design?.semantics.mode === 'ontology'
    && design.graph.status === 'ready'
    && design.graph.buildStatus === 'succeeded'
    && graphSnapshot !== undefined
    && graphSnapshot.nodes.length > 0
  const graphState = designGraphState(design?.graph)
  const ontologyRoute = design?.semantics.mode === 'ontology'
  const schemaRoute = design?.semantics.mode === 'schema'
  const routePending = design === undefined || design.semantics.mode === 'undecided'
  const providerReady = semanticWorkspace?.provider.status === 'ready'
  const acceptedEntityCount = semanticWorkspace?.candidates.entities.filter(item => item.decision === 'accepted').length ?? 0
  const acceptedRelationshipCount = semanticWorkspace?.candidates.relationships.filter(item => item.decision === 'accepted').length ?? 0
  const latestRun = (kind: V2DesignSnapshot['workspace']['runs'][number]['kind']) => [...(semanticWorkspace?.runs ?? [])].reverse().find(item => item.kind === kind)
  const buildRun = latestRun('build')
  const priorArtifacts = [
    ...(projectSurface?.v2Stages.definition?.artifacts ?? []),
    ...(projectSurface?.v2Stages.investigation?.artifacts ?? []),
  ].filter(item => item.status === 'present')
  const priorArtifactGroups = [
    {
      id: 'definition', number: '02', label: '业务与交付约定',
      artifacts: (projectSurface?.v2Stages.definition?.artifacts ?? []).filter(item => item.status === 'present'),
    },
    {
      id: 'investigation', number: '03', label: '环境与访问边界',
      artifacts: (projectSurface?.v2Stages.investigation?.artifacts ?? []).filter(item => item.status === 'present'),
    },
  ].filter(group => group.artifacts.length > 0)
  const executionDetails = designExecutionDetails(design?.execution.rationale)
  const mechanismRecord = surface.artifacts.find(item => item.id === 'mechanism-selection')
  const readySources = sourceFiles.filter(item => item.parse.status === 'ready')
  const definition = semanticWorkspace?.definition
  const classes = definition?.classes ?? []
  const relationships = definition?.relationships ?? []
  const firstClass = classes[0]
  const classStructureSummary = firstClass === undefined ? '尚未定义领域类' : classes.every(item => item.identityKeys.length === firstClass.identityKeys.length && item.properties.length === firstClass.properties.length)
    ? `每类包含 ${firstClass.identityKeys.length} 个标识字段 · ${firstClass.properties.length} 个属性`
    : `共 ${classes.reduce((count, item) => count + item.identityKeys.length, 0)} 个标识字段 · ${classes.reduce((count, item) => count + item.properties.length, 0)} 个属性`
  const sortedRuns = [...(semanticWorkspace?.runs ?? [])].reverse()
  const displayedRuns = runsExpanded ? sortedRuns : sortedRuns.slice(0, 8)
  const runDates = [...new Set(displayedRuns.map(run => new Date(run.startedAt).toLocaleDateString('zh-CN')))]
  const blockerGroups = ([['context', '任务参考信息与业务验证'], ['ontology', '本体与候选结论'], ['permission', '权限与执行范围'], ['other', '其他待核对条件']] as const)
    .map(([id, title]) => ({ id, title, items: [
      ...surface.reviewBlockers.map((text, index) => ({ id: `review-${index}`, text, severity: undefined })),
      ...openBlockers.map(item => ({ id: item.id, text: item.title, severity: item.severity })),
    ].filter(item => designBlockerCategory(item.text) === id) })).filter(group => group.items.length > 0)

  const perform = async (label: string, action: () => Promise<void>): Promise<void> => {
    setOperation(label); setError(null)
    try { await action() }
    catch (cause: unknown) { setError(cause instanceof Error ? cause.message : String(cause)) }
    finally { setOperation(null) }
  }

  const openRoute = (): void => {
    setRouteMechanism(design?.execution.mechanism ?? '')
    setRouteSemanticMode(design?.semantics.mode === 'undecided' ? '' : design?.semantics.mode ?? '')
    setExecutionRationale(design?.execution.rationale ?? '')
    setSemanticRationale(design?.semantics.rationale ?? '')
    setDrawer('route'); setError(null)
  }
  const openSources = (): void => {
    setSelectedSources(semanticWorkspace?.sources.map(item => item.sourceId) ?? [])
    setPermissionScope(semanticWorkspace?.sources[0]?.permissionScope ?? '仅限当前项目第四阶段最小纵向切片')
    setSourceAuthority(semanticWorkspace?.sources[0]?.authority ?? 'primary')
    setDrawer('sources'); setError(null)
  }
  const openDefinition = (): void => {
    setDefinitionDraft(definitionInput(semanticWorkspace))
    setDrawer('definition'); setError(null)
  }
  const openCandidates = (): void => {
    setCandidateDecisions(Object.fromEntries([
      ...(semanticWorkspace?.candidates.entities ?? []), ...(semanticWorkspace?.candidates.relationships ?? []),
    ].filter(item => item.decision !== 'pending').map(item => [item.id, item.decision as 'accepted' | 'rejected'])))
    setDrawer('candidates'); setError(null)
  }
  const openContext = (): void => {
    setContextQuestionId(semanticWorkspace?.definition.competencyQuestions[0]?.id ?? '')
    setContextSeedId(graphSnapshot?.nodes[0]?.id ?? '')
    setDrawer('context'); setError(null)
  }
  const openDecision = (): void => {
    const current = semanticWorkspace?.decision?.status === 'current' ? semanticWorkspace.decision : undefined
    setDecisionOutcome(current?.outcome ?? (surface.reviewReady ? 'go' : 'revise'))
    setDecisionRationale(current?.rationale ?? '')
    setReviewing(value => !value)
    setError(null)
  }

  const saveRoute = async (): Promise<void> => {
    const mechanism = DESIGN_MECHANISMS.find(item => item.id === routeMechanism)
    if (mechanism === undefined || routeSemanticMode === '' || executionRationale.trim() === '' || semanticRationale.trim() === '') {
      setError('请分别选择两条轴，并填写基于当前项目证据的选择依据。'); return
    }
    await perform('保存候选方案', async () => {
      await props.configureDesignRoute(workspace.workspaceId, {
        execution: { mechanism: mechanism.id, label: mechanism.label, rationale: executionRationale.trim() },
        semantics: { mode: routeSemanticMode, rationale: semanticRationale.trim() },
      })
      setDrawer(null)
    })
  }
  const saveSources = async (): Promise<void> => {
    if (selectedSources.length === 0 || selectedSources.length > 12 || permissionScope.trim() === '') {
      setError('请选择 1 到 12 份已识别的代表材料，并说明本轮获准用途。'); return
    }
    await perform('绑定代表材料', async () => {
      await props.bindDesignSources(workspace.workspaceId, selectedSources, permissionScope.trim(), sourceAuthority)
      setDrawer(null)
    })
  }
  const saveDefinition = async (): Promise<void> => {
    await perform('保存 Ontology 草稿', async () => {
      await props.saveDesignDefinition(workspace.workspaceId, semanticWorkspace?.definition.revision ?? 0, definitionDraft)
      setDrawer(null)
    })
  }
  const saveCandidateReview = async (): Promise<void> => {
    const candidates = [...(semanticWorkspace?.candidates.entities ?? []), ...(semanticWorkspace?.candidates.relationships ?? [])]
    const decisions = candidates.flatMap((item) => {
      const decision = candidateDecisions[item.id]
      return decision === undefined || decision === item.decision ? [] : [{ id: item.id, decision }]
    })
    if (decisions.length === 0) { setError('请至少更改一项候选的审核决定。'); return }
    await perform('保存候选审核', async () => {
      await props.reviewDesignCandidates(workspace.workspaceId, decisions)
      setDrawer(null)
    })
  }
  const runSemantica = async (action: Parameters<WorkbenchProps['runDesignSemantica']>[1], input?: Readonly<Record<string, unknown>>): Promise<void> => {
    await perform(action === 'health' ? '检查 Semantica' : `运行${action}`, async () => {
      await props.runDesignSemantica(workspace.workspaceId, action, input)
    })
  }
  const runContext = async (): Promise<void> => {
    if (contextQuestionId === '' && contextSeedId === '') { setError('请选择一个业务问题或起始实体。'); return }
    await perform('生成任务参考信息', async () => {
      await props.runDesignSemantica(workspace.workspaceId, 'context', {
        query: contextQuery.trim(), ...(contextQuestionId === '' ? {} : { questionId: contextQuestionId }),
        ...(contextSeedId === '' ? {} : { seedNodeId: contextSeedId }), maxDepth: contextDepth,
      })
      setDrawer(null)
    })
  }
  const prepareSlice = (): void => {
    const semanticInstruction = ontologyRoute
      ? '先调用 semantic_context_query 获取当前已验证图谱的有边界上下文，并保存返回的 contextRunId。'
      : '当前采用数据结构（Schema） 路线，不要创建 Ontology 或知识图谱占位。'
    props.prepareStageDraft(sessionId, `请基于第四阶段已经选定的候选方案，真正实现并运行一条最窄端到端纵向切片。${semanticInstruction}\n\n必须从当前项目的一份真实输入开始，经过关键判断和受控动作，到达可验证结果；保留终端输出、Diff、测试结果或其他项目内证据。完成后调用 semantic_slice_report，如实提交 succeeded 或 failed、真实任务、观察结果、证据引用${ontologyRoute ? '和当前 contextRunId' : ''}。同时形成或更新生产方案设计，不要替代 FDE 作出阶段决定。`)
  }

  const openFile = (path: string, title: string): void => {
    setError(null)
    void props.openProjectFile(sessionId, workspace.path, path, title).catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : String(cause))
    })
  }
  const submitDecision = async (): Promise<void> => {
    if (semanticWorkspace?.revision === undefined) { setError('第四阶段证据状态尚未建立，请先保存候选方案。'); return }
    if (decisionRationale.trim() === '') { setError('请填写本次 FDE 决定依据。'); return }
    if (decisionOutcome === 'go' && !surface.reviewReady) { setError('当前版本尚未达到可评审状态，不能提交 Go。'); return }
    setSubmitting(true); setError(null)
    try {
      await props.recordDesignDecision(workspace.workspaceId, semanticWorkspace.revision, decisionOutcome, decisionRationale.trim())
      if (decisionOutcome === 'go') await props.completeV2Stage(workspace.workspaceId, stageState.revision, 'design')
      else setReviewing(false)
    } catch (cause: unknown) { setError(cause instanceof Error ? cause.message : String(cause)) }
    finally { setSubmitting(false) }
  }
  const returnStage = async (): Promise<void> => {
    if (returnReason.trim() === '') { setError('请先说明为什么要返回上一阶段。'); return }
    setSubmitting(true); setError(null)
    try { await props.returnV2Stage(workspace.workspaceId, stageState.revision, returnReason) }
    catch (cause: unknown) { setError(cause instanceof Error ? cause.message : String(cause)) }
    finally { setSubmitting(false) }
  }

  return <section
    className={`${css.root} ${css.designStageRoot}${historical ? ` ${css.browsedStage}` : ''}`}
    data-fde-stage-workbench=""
    data-conversation-hero-project=""
    data-stage="design"
    data-historical={historical ? 'true' : undefined}
    data-hide-stage-composer={historical ? 'true' : undefined}
    data-conversation-composer-layout={historical ? 'stage-history' : 'stage-execution'}
    data-conversation-composer-overlay={view ? '' : undefined}
    data-artifacts-collapsed="true"
    aria-label={historical ? '历史阶段：设计方案并完成端到端纵向切片' : '项目阶段工作台：设计方案并完成端到端纵向切片'}
  >
    {historical && <header className={css.browsedStageNotice}>
      <HistoricalNoticeIcon />
      <div><span>阶段完成记录</span><strong>正在查看第 4 阶段，项目当前在“{V2_STAGE_NAMES[actualStageIndex]}”</strong><p>保留当时的实现方式、本体路线、运行证据和人工决定，当前为只读查看。</p></div>
      <button type="button" className={css.secondaryButton} onClick={() => { props.returnToCurrentStage(workspace.workspaceId) }}>返回当前阶段 <span aria-hidden="true">→</span></button>
    </header>}

    <main className={css.designStageShell}>
      <div className={css.designStageIntro} data-design-stage-intro="">
      <section className={css.designHero} data-design-stage-hero="">
        <div className={css.designHeroCopy}>
          <span>第 4/8 阶段 · {historical ? '已完成' : '方案与最小纵向切片'}</span>
          <h1 data-design-primary-title="">{surface.objective}</h1>
          <p data-design-body-copy="">{surface.explanation}</p>
          <div className={css.designHeroFacts}>
            <b data-tone="business">固定记录 {surface.presentCount}/{surface.requiredCount}</b>
            <b data-tone="success"><span>{designExecutionLabel(design?.execution)}</span><em>· {designExecutionStatus(design?.execution.status)}</em></b>
            <b data-tone="warning"><span>{designSemanticsLabel(design?.semantics.mode)}</span><em>· {designSemanticConclusion(design?.semantics.conclusion)}</em></b>
          </div>
        </div>
        <div className={css.designStageRing} data-design-stage-metric="" aria-label={historical ? '第 4/8 阶段已完成' : '当前处于第 4 阶段，共 8 个阶段'}>
          <strong>04<small> / 08</small></strong><span>{historical ? '已完成' : surface.reviewReady ? '待评审' : '设计中'}</span>
        </div>
        <DesignHeroBlueprint />
      </section>

      <section className={css.designEvidenceStrip} data-design-evidence="" aria-label="第四阶段前序依据">
        <header><div><span>01 / 前序依据</span><h2 data-design-section-title="">只使用已确认的业务范围与现场边界</h2></div><b>{priorArtifacts.length} 份可引用记录</b></header>
        <div className={css.designEvidenceGroups}>{priorArtifactGroups.map(group => <section key={group.id}>
          <header>阶段 {group.number} · {group.label}</header>
          <div>{group.artifacts.map(item => <button key={item.id} type="button" aria-label={`查看前序记录：${item.title}`} onClick={() => { openFile(item.path, item.title) }}><EvidenceDocumentIcon /><span><strong>{item.title}</strong><small>{item.path.split('/').at(-1)}</small></span><i>查看</i></button>)}</div>
          <footer>{group.artifacts[0]?.path.slice(0, Math.max(0, group.artifacts[0].path.lastIndexOf('/') + 1))}</footer>
        </section>)}</div>
      </section>

      <section className={css.designRoutePanel} data-design-route="" aria-label="第四阶段实现方案选择">
        <header><div><span>02 / 实现方案与本体选型</span><h2>先决定怎么实现，再决定是否需要本体</h2><p data-design-supporting-copy="">Ontology 不是默认答案；两项判断都必须回到前三阶段的业务、环境和权限证据。</p></div><span className={css.designHeaderActions}><b>{routePending ? '等待判断' : '已记录候选方案'}</b>{!historical && <button type="button" data-design-route-action="" onClick={openRoute}>{routePending ? '开始判断' : '调整方案'}</button>}</span></header>
        <div className={css.designRouteGrid}>
          <article className={css.designExecutionCard} data-state={design?.execution.status ?? 'undecided'}>
            <header><div><span>判断 01 · 实现方式</span><h3>{designExecutionLabel(design?.execution)}</h3></div><b>{designExecutionStatus(design?.execution.status)}</b></header>
            <div className={css.designExecutionCardBody}>
              <dl>{executionDetails.map((detail, index) => <div key={`${detail.label}-${index}`}><dt><InvestigationIcon name={detail.icon} />{detail.label}</dt><dd>{detail.value}</dd></div>)}</dl>
              <aside><div><small>本期不采用</small><p>{designExcludedMechanisms(design?.execution.rationale)}</p></div><div><small>证据</small><p>{designEvidenceReferences(design?.execution.rationale)}</p></div></aside>
            </div>
            {design?.execution.status === 'selected' && <footer><HistoricalArchiveIcon /><span>已记录选型结果</span>{mechanismRecord?.updatedAt && <time>{mechanismRecord.updatedAt.slice(0, 10)}</time>}</footer>}
          </article>
          <span className={css.designRouteArrow} aria-hidden="true"><svg viewBox="0 0 40 24"><path d="M4 12h27M24 5l7 7-7 7" /></svg></span>
          <article className={css.designSemanticDecisionCard} data-state={design?.semantics.mode ?? 'undecided'}>
            <header><div><span>判断 02 · 本体必要性</span><h3>{designSemanticsLabel(design?.semantics.mode)}</h3></div><b>{designSemanticConclusion(design?.semantics.conclusion)}</b></header>
            <div className={css.designSemanticDecisionBody}><DesignSemanticRouteArt /><div><dl><div><dt>选型依据</dt><dd>{design?.semantics.rationale ?? '尚未记录本体必要性判断'}</dd></div></dl><aside><b>是否需要本体与验证是否通过分别记录。</b><span>依据前序业务、环境与权限证据进行判断。</span></aside></div></div>
          </article>
        </div>
      </section>
      </div>

      {schemaRoute && <section className={css.designSimpleRoute} aria-label="不使用图谱的方案">
        <header><div><span>03 / 当前路线 · 数据结构（Schema）</span><h2>按开发规格实现最小业务流程</h2><p>{design?.semantics.rationale ?? '当前业务可用数据结构、接口和常规开发实现，无需构建知识图谱。'}</p></div><b>{designSemanticConclusion(design?.semantics.conclusion)}</b></header>
        <ol><li><i>01</i><span><strong>开发规格</strong><small>定义输入、输出、状态和非目标</small></span></li><li><i>02</i><span><strong>系统与接口边界</strong><small>沿用第三阶段确认的权限和审批要求</small></span></li><li data-done={semanticWorkspace?.slice?.status === 'succeeded' ? 'true' : undefined}><i>03</i><span><strong>最小端到端流程</strong><small>从项目输入运行到可验证结果</small></span></li><li data-done={surface.reviewReady ? 'true' : undefined}><i>04</i><span><strong>FDE 人工决定</strong><small>继续 / 修订 / 缩小范围 / 停止</small></span></li></ol>
        {!historical && <div className={css.designWorkActions}><button type="button" className={css.primaryButton} onClick={prepareSlice}>实现并运行最小业务流程</button><button type="button" className={css.secondaryButton} onClick={() => { props.prepareStageDraft(sessionId, surface.prompt) }}>补充生产方案设计</button></div>}
      </section>}

      {ontologyRoute && <>
        <section className={css.designOntologyProgress} aria-label="本体构建与业务验证步骤">
          <header><div><span>03 / 当前路线 · 本体（Ontology）与知识图谱</span><h2>本体构建与业务验证进度</h2><p>先定义并发布本体，再构建图谱、验证查询，最后用于运行项目任务。</p></div><b>{semanticWorkspace?.provider.status === 'ready' ? `Semantica ${semanticWorkspace.provider.version ?? ''}` : 'Semantica 待检查'}</b></header>
          <div>{[
            ['01', '实现方式选择', design?.execution.status === 'selected', true],
            ['02', '图谱业务问题', (semanticWorkspace?.definition.competencyQuestions.length ?? 0) > 0, design?.execution.status === 'selected'],
            ['03', 'Schema 与关系', (semanticWorkspace?.definition.classes.length ?? 0) > 0, (semanticWorkspace?.definition.competencyQuestions.length ?? 0) > 0],
            ['04', '来源规则', (semanticWorkspace?.definition.provenanceRules.length ?? 0) > 0, (semanticWorkspace?.definition.classes.length ?? 0) > 0],
            ['05', '时间与置信度规则', (semanticWorkspace?.definition.temporalRules.length ?? 0) > 0, (semanticWorkspace?.definition.classes.length ?? 0) > 0],
            ['06', '构建与验证', semanticWorkspace?.validation?.status === 'passed', buildRun?.status === 'succeeded'],
            ['07', '最小业务流程', semanticWorkspace?.slice?.status === 'succeeded', semanticWorkspace?.context?.status === 'ready'],
            ['08', '运行证据', (semanticWorkspace?.runs.filter(item => item.status === 'succeeded').length ?? 0) > 0, true],
            ['09', 'FDE 人工决定', surface.reviewReady, semanticWorkspace?.slice?.status === 'succeeded'],
          ].map(([number, label, done, active]) => <article key={String(number)} data-state={semanticStepState(Boolean(done), Boolean(active))}><i>{String(number)}</i><span><strong>{String(label)}</strong><small>{done ? '当前版本已形成' : active ? '当前可处理' : '等待前置证据'}</small></span></article>)}</div>
        </section>

        <div className={css.designBuildWorkspace} data-design-build-workspace="">
        <section className={css.designPreparation} data-design-preparation="" aria-label="构建准备">
          <header><span>03 / 构建准备</span><h2 data-design-preparation-title="">先绑定材料，再确认构建依据</h2><p data-design-preparation-copy="">材料、执行能力、本体定义与候选审核，分别确认、分别维护。</p></header>
          <div className={css.designSemanticGrid}>
            <section className={css.designSemanticCard} data-design-source-card="">
              <header><span><InvestigationIcon name="document" />本轮代表材料</span><b>{semanticWorkspace?.sources.length ?? 0} / 12</b></header>
              <h3>绑定当前项目已有资料</h3><p>不重复上传；保留材料 ID、版本、权限范围和权威级别。</p>
              <div className={css.designMiniList} data-design-source-list="">{(semanticWorkspace?.sources ?? []).slice(0, 4).map(source => <div key={source.sourceId}><InvestigationIcon name="document" /><span><strong title={source.name}>{source.name}</strong><small>{source.authority === 'primary' ? '主要依据' : '辅助依据'} · {SOURCE_PARSE_LABELS[source.parseStatus] ?? source.parseStatus}</small></span></div>)}{(semanticWorkspace?.sources.length ?? 0) === 0 && <em>尚未绑定代表材料</em>}</div>
              {!historical && <button type="button" data-design-sources-action="" className={css.secondaryButton} onClick={openSources}>选择项目材料</button>}
            </section>
            <section className={css.designSemanticCard} data-design-provider-card="" data-status={semanticWorkspace?.provider.status ?? 'unchecked'}>
              <header><span><DesignBuildIcon name="provider" />本地 Semantica 服务</span><b title={semanticWorkspace?.provider.message}>{providerReady ? '可用' : semanticWorkspace?.provider.status === 'unavailable' ? '不可用' : '待检查'}</b></header>
              <h3 className={css.designVersion}>Semantica {semanticWorkspace?.provider.version ?? semanticWorkspace?.provider.expectedVersion ?? '待检查'}</h3>
              <p className={css.designProviderCapabilities}>抽取 · 本体发布 · 建图<br />验证 · 受控查询</p>
              <DesignProviderArt />
              <p className={css.designProviderNote}>{!providerReady && semanticWorkspace?.provider.message ? semanticWorkspace.provider.message : '逐项目执行，不改写 FDE 人工决定。'}</p>
              {!historical && <button type="button" className={css.secondaryButton} disabled={operation !== null} onClick={() => { void runSemantica('health') }}>{operation === '检查 Semantica' ? '正在检查…' : '检查本地服务'}</button>}
            </section>
            <section className={css.designSemanticCard}>
              <header><span><InvestigationIcon name="network" />本体定义</span><b className={css.designDefinitionStatus}>{designOntologyStatus(design?.ontology.status)}</b></header>
              <h3 className={css.designVersion}>{semanticWorkspace?.definition.version ?? '待定义'}</h3>
              <div className={css.designSemanticMetrics} data-design-definition-metrics=""><strong><b>{semanticWorkspace?.definition.classes.length ?? 0}</b> 类</strong><strong><b>{semanticWorkspace?.definition.relationships.length ?? 0}</b> 关系</strong></div>
              <p className={css.designDefinitionSummary}><span>{semanticWorkspace?.definition.competencyQuestions.length ?? 0} 个业务问题</span><span>{semanticWorkspace?.definition.provenanceRules.length ?? 0} 条来源规则</span><span>阈值 {semanticWorkspace?.definition.confidenceThreshold ?? '待定义'}</span></p>
              {!historical && <button type="button" className={css.secondaryButton} onClick={openDefinition}>审阅与编辑定义</button>}
            </section>
            <section className={css.designSemanticCard} data-design-candidate-card="">
              <header><span><InvestigationIcon name="shield" />候选知识审核</span></header>
              <div className={css.designSemanticMetrics}><strong><b>{semanticWorkspace?.candidates.entities.length ?? 0}</b> 个实体</strong><strong><b>{semanticWorkspace?.candidates.relationships.length ?? 0}</b> 条关系</strong></div>
              <b className={css.designAcceptedCount}>{acceptedEntityCount + acceptedRelationshipCount} 项已接受</b>
              <p className={css.designCandidateNote}>当前使用规则抽取；规则分数不是经评测的事实可信度。候选须核对来源，接受后才能建图。</p>
              {!historical && <button type="button" className={css.secondaryButton} onClick={openCandidates}>查看候选与来源</button>}
            </section>
          </div>
        </section>

        <section className={css.designPipeline} data-design-pipeline="" aria-label="Semantica 分步运行">
          <header><div><span>04 / 构建与验证</span><h2>每一步单独运行，构建成功不等于验证通过</h2></div><b><InvestigationIcon name="clock" />{semanticWorkspace?.runs.length ?? 0} 次运行</b></header>
          <p className={css.designPipelineNotice}><DesignBuildIcon name="info" />材料、本体定义或审核结果变化后，需重新验证图谱、查询和业务流程。</p>
          <div className={css.designPipelineScroll}><table><thead><tr><th scope="col">运行步骤</th><th scope="col">最近结果</th><th scope="col">状态</th><th scope="col">最近运行</th>{!historical && <th scope="col">操作</th>}</tr></thead><tbody>{[
            { id: 'extract' as const, label: '抽取候选', detail: '按项目抽取规则与字段映射处理已绑定材料；不自动推断任意领域关系。', enabled: providerReady && (semanticWorkspace?.sources.length ?? 0) > 0 },
            { id: 'propose-schema' as const, label: '生成候选 Schema', detail: '用代表样本形成候选实体类型与关系，仍需人工删改。', enabled: providerReady && (semanticWorkspace?.candidates.entities.length ?? 0) > 0 },
            { id: 'publish-schema' as const, label: '发布本体', detail: '校验当前定义并冻结版本，同时生成 SHACL。', enabled: providerReady && (semanticWorkspace?.definition.classes.length ?? 0) > 0 },
            { id: 'build' as const, label: '构建项目图谱', detail: '只写入经审核接受且符合当前定义的事实。', enabled: providerReady && semanticWorkspace?.definition.status === 'published' && acceptedEntityCount > 0 },
            { id: 'validate' as const, label: '校验图谱与查询', detail: '分别执行结构校验与必答业务问题真实查询。', enabled: providerReady && buildRun?.status === 'succeeded' },
          ].map((step, index) => { const run = latestRun(step.id); return <tr key={step.id} data-status={run?.status ?? 'waiting'}>
            <th scope="row"><span className={css.designPipelineStep}><i>{String(index + 1).padStart(2, '0')}</i>{step.id === 'publish-schema' ? <InvestigationIcon name="network" /> : step.id === 'validate' ? <InvestigationIcon name="shield" /> : <DesignBuildIcon name={step.id === 'extract' ? 'extract' : step.id === 'propose-schema' ? 'schema' : 'cube'} />}<strong>{step.label}</strong></span></th>
            <td className={css.designPipelineResult}>{run?.summary ?? step.detail}</td>
            <td><span className={css.designRunStatus} data-status={run?.status ?? 'waiting'}>{run?.status === 'succeeded' ? <DesignBuildIcon name="check" /> : <InvestigationIcon name={run?.status === 'failed' ? 'warning' : 'clock'} />}{run === undefined ? '尚未运行' : semanticRunStatus(run.status)}</span></td>
            <td>{run === undefined ? <span className={css.designRunWaiting}>—</span> : <time dateTime={run.startedAt}><span>{new Date(run.startedAt).toLocaleDateString('zh-CN')}</span><strong>{new Date(run.startedAt).toLocaleTimeString('zh-CN', { hour12: false })}</strong></time>}</td>
            {!historical && <td><button type="button" aria-label={`${run?.status === 'succeeded' ? '重新运行' : '运行'}：${step.label}`} data-primary={run?.status === 'stale' ? 'true' : undefined} disabled={!step.enabled || operation !== null || run?.status === 'running'} onClick={() => { void runSemantica(step.id) }}>{run?.status === 'succeeded' && <DesignBuildIcon name="refresh" />}{run?.status === 'running' ? '运行中…' : run?.status === 'succeeded' ? '重新运行' : '运行'}</button></td>}
          </tr> })}</tbody></table></div>
          <footer><InvestigationIcon name="shield" />运行结果与 FDE 阶段评审分别记录。</footer>
        </section>
        </div>

        <section className={`${css.designSchemaPanel} ${css.designDetailSurface}`} data-design-schema="" aria-label="Ontology Schema 摘要">
          <header className={css.designSchemaHeader}>
            <div><span>05 / Schema、来源和时间规则</span><h2 data-design-schema-title="">定义实体类型、属性与关系</h2><p data-design-schema-copy="">先明确要回答的问题，再查看实体类型与关系，最后核对来源与时间规则。</p></div>
            {!historical && <button type="button" data-design-definition-action="" onClick={openDefinition}>打开完整定义</button>}
            <div className={css.designSchemaSummary}><span><DesignBuildIcon name="extract" />{definition?.competencyQuestions.length ?? 0} 个业务问题</span><span><DesignBuildIcon name="grid" />{classes.length} 类 · {relationships.length} 关系</span><span><InvestigationIcon name="shield" />抽取分数 ≥ {definition?.confidenceThreshold ?? '待定义'}</span></div>
          </header>
          <div className={css.designSchemaOverview}>
            <section className={css.designQuestionPanel} data-design-question-list="">
              <header><DesignBuildIcon name="search" /><h3>业务问题</h3><b>{definition?.competencyQuestions.filter(item => item.required).length ?? 0} 项必答</b></header>
              <p>定义查询目标与检查方式</p>
              {(definition?.competencyQuestions ?? []).map(item => <article key={item.id}><code>{item.id}</code><span>{item.text}{!item.required && <small>可选</small>}</span><b>{QUERY_KIND_LABELS[item.query.kind]}</b></article>)}
              {(definition?.competencyQuestions.length ?? 0) === 0 && <em>尚未定义系统必须回答的问题</em>}
            </section>
            <section className={css.designDomainPanel}>
              <header><InvestigationIcon name="network" /><h3>实体类型与关系</h3><b>{classes.length} 类 · {relationships.length} 关系</b></header>
              <h4>实体类型</h4>
              <div className={css.designDomainClasses} data-design-domain-classes="">{classes.map(item => <article key={item.id} title={`${item.identityKeys.length} 个标识字段 · ${item.properties.length} 个属性`}><DesignClassIcon id={item.id} label={item.label} /><span><code>{item.id}</code><strong>{item.label}</strong></span></article>)}</div>
              <p className={css.designClassStructure}>{classStructureSummary}</p>
              <div className={css.designRelationshipHeading}><h4>关系定义</h4>{relationships.length > 5 ? <button type="button" aria-label={relationshipsExpanded ? '收起关系定义' : '查看全部关系定义'} aria-expanded={relationshipsExpanded} onClick={() => { setRelationshipsExpanded(value => !value) }}>{relationshipsExpanded ? '收起' : `展示 ${Math.min(5, relationships.length)} 条`} · 共 {relationships.length} 条</button> : <span>共 {relationships.length} 条</span>}</div>
              <div className={css.designRelationshipTable}><table aria-label="关系定义"><thead><tr><th scope="col">关系标识</th><th scope="col">连接</th></tr></thead><tbody>{(relationshipsExpanded ? relationships : relationships.slice(0, 5)).map(item => <tr key={item.id} title={`${item.label} · ${item.cardinality}`}><td><code>{item.id}</code></td><td><code>{item.domain} → {item.range}</code></td></tr>)}</tbody></table></div>
              {relationships.length === 0 && <em>可先抽取代表样本生成候选，也可手工建立最小定义</em>}
            </section>
          </div>
          <section className={css.designRulesPanel}>
            <header><InvestigationIcon name="shield" /><div><h3>来源、时间与置信度</h3><p>查询过滤绑定来源、分数和已声明有效期；文字规则与权限说明仍需人工核对，不代表已执行授权政策。</p></div></header>
            <div className={css.designRuleGrid} data-design-rule-grid="">
              {[...(definition?.provenanceRules ?? []).map(item => ({ ...item, temporal: false })), ...(definition?.temporalRules ?? []).map(item => ({ ...item, temporal: true }))].map(item => {
                const isolatedFields = item.description.match(/\bfinal_[a-z_]+\b/g) ?? []
                return <article key={item.id} data-warning={isolatedFields.length > 0 ? 'true' : undefined}>
                  {isolatedFields.length > 0 ? <DesignBuildIcon name="layers" /> : item.temporal ? /record|记录/i.test(`${item.id} ${item.label}`) ? <DesignBuildIcon name="calendar" /> : <InvestigationIcon name="clock" /> : <InvestigationIcon name={/conflict|冲突/i.test(`${item.id} ${item.label}`) ? 'network' : 'document'} />}
                  <div><h4>{item.label}</h4><code>{item.id}</code><p>{isolatedFields.length > 0 ? item.description.replace(/^final_\w+(?:、final_\w+)*\s*/, '历史答案字段') : item.description}</p></div>
                  {isolatedFields.length > 0 && <code className={css.designIsolatedFields}>{isolatedFields.join(' · ')}</code>}
                </article>
              })}
              <article><InvestigationIcon name="shield" /><div><h4>最低抽取分数</h4><code>confidence</code><p className={css.designConfidence}><strong>{definition?.confidenceThreshold ?? '—'}</strong><span>SHACL · {definition?.shaclSeverity ?? '待定义'}</span></p></div></article>
            </div>
          </section>
        </section>

        <section className={css.designGraphPanel} aria-label="Ontology 与项目知识图谱">
          <header>
            <div><span>06 / 实例知识图谱</span><h2>从最小 Schema 到可查询的真实项目关系</h2><p>这里只显示当前项目隔离空间内的真实快照；图谱能画出来不等于纵向切片已经通过。</p></div>
            <dl>
              <div><dt>本体</dt><dd>{designOntologyStatus(design?.ontology.status)}</dd></div>
              <div><dt>版本</dt><dd>{design?.ontology.schemaVersion ?? graphSnapshot?.ontologyVersion ?? '待发布'}</dd></div>
              <div><dt>类型</dt><dd>{design?.ontology.classCount ?? '—'} 类 · {design?.ontology.relationshipTypeCount ?? '—'} 种关系</dd></div>
              <div><dt>构建</dt><dd>{GRAPH_BUILD_LABELS[design?.graph.buildStatus ?? 'waiting']}</dd></div>
            </dl>
          </header>
          {graphReady && graphSnapshot !== undefined
            ? <>
              <div className={css.designGraphMeta}>
                <span><small>图谱</small><b>{graphSnapshot.graphId}</b></span>
                <span><small>构建工具</small><b>{graphSnapshot.provider.id}{graphSnapshot.provider.version === undefined ? '' : ` · ${graphSnapshot.provider.version}`}</b></span>
                <span><small>修订</small><b>{graphSnapshot.revision}</b></span>
                <span><small>规模</small><b>{graphSnapshot.nodes.length} 个实体 · {graphSnapshot.edges.length} 条关系</b></span>
              </div>
              <KnowledgeGraphExplorer snapshot={graphSnapshot} />
            </>
            : <div className={css.designGraphEmpty} data-status={design?.graph.status ?? 'missing'}>
              <div aria-hidden="true"><i /><i /><i /><b /></div><span><strong>{graphState.title}</strong><p>{graphState.description}</p><code>{design?.graph.path ?? '.fde/design/knowledge-graph.json'}</code></span>
            </div>}
        </section>

      </>}

      <div className={`${css.designCloseout} ${css.designDetailSurface}`} data-design-closeout="">
      {ontologyRoute && <section className={css.designContextPanel} data-design-context="">
        <header><div><span>07 / Agent 上下文与最小业务流程</span><h2 data-design-context-title="">查询必要子图，再运行真实业务任务</h2><p data-design-context-copy="">从图谱查询当前任务需要的实体与关系，附上来源、适用范围和版本，供 Agent 使用。</p></div><b>{semanticWorkspace?.context?.status === 'ready' ? '上下文已形成' : '等待查询图谱'}</b></header>
        <div className={css.designContextFlow}>
          <article data-ready={semanticWorkspace?.validation?.status === 'passed' ? 'true' : undefined}><DesignBuildIcon name="provider" /><span><strong>01 Agent 任务参考信息</strong><small>{semanticWorkspace?.context === undefined ? '尚未生成' : `${semanticWorkspace.context.status === 'ready' ? '已形成' : semanticWorkspace.context.status === 'stale' ? '需重新验证' : '失败'} · ${semanticWorkspace.context.entityCount} 个实体 · ${semanticWorkspace.context.relationshipCount} 条关系 · ${semanticWorkspace.context.permissionScope}`}</small><p>选择业务问题，查询相关实体与关系，并保留来源和适用范围。</p></span>{!historical && <button type="button" data-design-context-action="" disabled={semanticWorkspace?.validation?.status !== 'passed'} onClick={openContext}>选择问题并查询</button>}</article>
          <DesignBuildIcon name="arrow" />
          <article><DesignBuildIcon name="cube" /><span><strong>02 最小业务流程</strong><small>{semanticWorkspace?.slice === undefined ? '尚未运行真实链路' : `${semanticWorkspace.slice.status === 'succeeded' ? '成功' : semanticWorkspace.slice.status === 'stale' ? '需重新验证' : '失败'} · ${semanticWorkspace.slice.result}`}</small><p>{semanticWorkspace?.context?.status === 'ready' ? '使用当前任务参考信息运行真实业务任务。' : '需要先形成任务参考信息。'}</p></span>{!historical && <button type="button" disabled={semanticWorkspace?.context?.status !== 'ready'} onClick={prepareSlice}>交给 Agent 实现并运行</button>}</article>
        </div>
      </section>}

      {!routePending && <section className={css.designRunEvidence} data-design-run-evidence="">
        <header><div><span>08 / 运行证据</span><h2>保留每次真实操作，不用说明文字代替结果</h2></div><div className={css.designRunCounts}><b>共 {sortedRuns.length} 次运行</b><span>当前展示 {displayedRuns.length} 条</span></div></header>
        {sortedRuns.length > 0 ? <>
          <div className={css.designRunTableScroll}><table data-design-run-table="" aria-label="运行证据"><colgroup><col style={{ width: 210 }} /><col /><col style={{ width: '13%' }} /><col style={{ width: '14%' }} /><col style={{ width: '16%' }} /></colgroup><thead><tr><th scope="col" colSpan={2}>运行事项 / 结果摘要</th><th scope="col">状态</th><th scope="col">证据</th><th scope="col">运行时间{runDates.length === 1 && <span><DesignBuildIcon name="calendar" />{runDates[0]}</span>}</th></tr></thead><tbody>{displayedRuns.map((run, index) => <tr key={run.id} data-status={run.status}>
            <th scope="row"><i>{String(index + 1).padStart(2, '0')}</i><DesignRunIcon kind={run.kind} /><strong>{semanticRunLabel(run.kind)}</strong></th>
            <td>{run.summary ?? run.id}</td><td><span className={css.designEvidenceStatus} data-status={run.status}>{run.status === 'succeeded' ? <DesignBuildIcon name="check" /> : <InvestigationIcon name={run.status === 'failed' ? 'warning' : 'clock'} />}{semanticRunStatus(run.status)}</span></td>
            <td>{run.evidencePaths.length > 0 ? <div className={css.designRunFiles}>{run.evidencePaths.map((path, index) => <button key={path} type="button" aria-label={`查看${semanticRunLabel(run.kind)}证据 ${index + 1}`} onClick={() => { openFile(path, `${semanticRunLabel(run.kind)}证据 ${index + 1}`) }}>证据 {index + 1}</button>)}</div> : '—'}</td>
            <td><time dateTime={run.startedAt}>{runDates.length > 1 && <span>{new Date(run.startedAt).toLocaleDateString('zh-CN')}</span>}{new Date(run.startedAt).toLocaleTimeString('zh-CN', { hour12: false })}</time></td>
          </tr>)}</tbody></table></div>
          {sortedRuns.length > 8 && <button type="button" className={css.designExpandRuns} aria-expanded={runsExpanded} onClick={() => { setRunsExpanded(value => !value) }}>{runsExpanded ? '收起，显示最近 8 次运行' : `查看全部 ${sortedRuns.length} 次运行`}<span aria-hidden="true">{runsExpanded ? '⌃' : '⌄'}</span></button>}
        </> : <p>尚无运行记录。路线选择不是运行证据；请从当前路线执行第一步。</p>}
      </section>}

      <section className={css.designGate} data-design-gate="">
        <header><div><span>09 / FDE 人工决定</span><h2>{historical ? '方案与业务验证记录' : semanticWorkspace?.decision?.status === 'current' ? designDecisionLabel(semanticWorkspace.decision.outcome) : surface.reviewReady ? '候选方案已具备，等待人工决定' : '暂不能进入下一阶段，可修订方案、缩小范围或停止'}</h2><p>{routePending ? '先选择实现方式，并判断是否需要本体。' : ontologyRoute ? '本体路线必须同时证明 Schema、图谱、任务参考信息与真实纵向任务可用。' : '轻量路线仍需用一条最小端到端流程证明方案可运行。'}</p></div><div className={css.designGateStatus}>{!historical && !surface.reviewReady && <span><DesignBuildIcon name="info" />进入下一阶段的条件未满足</span>}<b>{surface.presentCount}/{surface.requiredCount} 份记录</b></div></header>
        <div className={css.designArtifacts}>{surface.artifacts.map(artifact => <article key={artifact.id} data-status={artifact.status}><i><EvidenceDocumentIcon /></i><span><strong>{artifact.title}</strong><small>{artifact.purpose}</small></span><b>{artifact.status === 'present' ? '已形成' : artifact.status === 'error' ? '读取失败' : '待形成'}</b>{artifact.status === 'present' && <button type="button" onClick={() => { openFile(artifact.path, artifact.title) }}>查看</button>}</article>)}</div>
        {blockerGroups.length > 0 && <section className={css.designBlockerGroups} aria-label="当前待处理条件"><h3>当前待处理</h3><div>{blockerGroups.map(group => <section key={group.id}><h4>{group.title}</h4><ul>{group.items.map(item => <li key={item.id} data-severity={item.severity}>{item.text}</li>)}</ul></section>)}</div></section>}
        {semanticWorkspace?.decision !== undefined && <article className={css.designDecisionRecord} data-status={semanticWorkspace.decision.status}>
          <span><small>{semanticWorkspace.decision.status === 'current' ? '当前人工决定' : '上次决定 · 证据变化后需重新验证'}</small><strong>{designDecisionLabel(semanticWorkspace.decision.outcome)}</strong><p>{semanticWorkspace.decision.rationale}</p></span>
          <b>{new Date(semanticWorkspace.decision.decidedAt).toLocaleString('zh-CN')}</b>
        </article>}
        {historical
          ? <footer className={css.historicalArchiveFooter}><span><HistoricalArchiveIcon />当前只读查看已保存的方案、图谱快照、运行证据和人工决定。</span><strong>只读记录</strong></footer>
          : <>
            {reviewing && <div className={`${css.genericReview} ${css.designDecisionReview}`}><strong>对当前证据提交哪一种 FDE 决定？</strong><p>方案验证结果与人工决定分开保存。只有 Go 会推进到“运行 PoC 与 Eval”；其他决定只记录依据并保留在第四阶段。</p><div className={css.designDecisionChoices}>{([
              ['go', '进入下一阶段', '证据齐备，进入 PoC 与 Eval。'],
              ['revise', '修订方案', '保留当前目标，修订方案或实现。'],
              ['narrow', '缩小范围', '收窄目标、动作、数据或适用范围。'],
              ['stop', '停止投入', '当前证据不支持继续投入。'],
            ] as const).map(([outcome, label, description]) => <button key={outcome} type="button" data-selected={decisionOutcome === outcome ? 'true' : undefined} disabled={outcome === 'go' && !surface.reviewReady} onClick={() => { setDecisionOutcome(outcome) }}><b>{label}</b><small>{description}</small></button>)}</div><label htmlFor="design-decision-rationale">决定依据</label><textarea id="design-decision-rationale" value={decisionRationale} onChange={(event) => { setDecisionRationale(event.target.value) }} placeholder="引用当前方案、纵向切片、风险、权限和未解决问题；不要只写结论。" /><button type="button" className={decisionOutcome === 'go' ? css.primaryButton : css.secondaryButton} disabled={submitting || (decisionOutcome === 'go' && !surface.reviewReady)} onClick={() => { void submitDecision() }}>{submitting ? '正在保存…' : decisionOutcome === 'go' ? '确认并进入下一阶段' : `保存 ${designDecisionLabel(decisionOutcome)}`}</button></div>}
            {returning && <div className={css.genericReview}><label htmlFor="design-return-reason">返回原因</label><textarea id="design-return-reason" value={returnReason} onChange={(event) => { setReturnReason(event.target.value) }} placeholder="例如：新的环境证据改变了可用权限，需要回到第三阶段重新核对。" /><button type="button" className={css.secondaryButton} disabled={submitting} onClick={() => { void returnStage() }}>保留现有材料并返回</button></div>}
          </>}
        {error !== null && <p className={css.inlineError} role="alert">{error}</p>}
      </section>
      {!historical && <div className={css.designGateActions} data-design-gate-actions=""><span><InvestigationIcon name="scales" />{routePending ? '请先确定当前候选方案' : surface.reviewReady ? '证据已齐备，等待 FDE 作出决定' : '可提交修订、收窄或停止的决定'}</span>
        {!routePending && <button type="button" className={css.primaryButton} onClick={openDecision}>{reviewing ? '收起人工决定' : '提交 FDE 决定'}</button>}
        <button type="button" className={css.secondaryButton} onClick={() => { setReturning(value => !value) }}>返回上一阶段</button>
      </div>}
      </div>
    </main>

    {drawer !== null && <div className={css.designDrawerBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget && operation === null) setDrawer(null) }}>
      <aside className={css.designDrawer} role="dialog" aria-modal="true" aria-label={drawer === 'route' ? '实现方案与本体选型' : drawer === 'sources' ? '绑定项目材料' : drawer === 'definition' ? '编辑本体定义' : drawer === 'candidates' ? '审核候选知识' : '生成Agent 任务参考信息'}>
        <header><div><span>第四阶段 · {drawer === 'route' ? '实现方案与本体选型' : drawer === 'sources' ? '项目材料绑定' : drawer === 'definition' ? 'Ontology Schema' : drawer === 'candidates' ? '候选知识审核' : 'Agent 上下文'}</span><h2>{drawer === 'route' ? '确定当前候选方案' : drawer === 'sources' ? '选择本轮获准使用的代表材料' : drawer === 'definition' ? '审阅并修改最小领域定义' : drawer === 'candidates' ? '决定哪些候选可以进入正式图谱' : '只查询当前任务需要的子图'}</h2></div><button type="button" aria-label="关闭" disabled={operation !== null} onClick={() => { setDrawer(null) }}>×</button></header>
        <div className={css.designDrawerBody}>
          {drawer === 'route' && <>
            <section className={css.designDrawerSection}><span>选择实现方式</span><div className={css.designChoiceGrid}>{DESIGN_MECHANISMS.map(item => <button key={item.id} type="button" data-selected={routeMechanism === item.id ? 'true' : undefined} onClick={() => { setRouteMechanism(item.id) }}><strong>{item.label}</strong><small>{item.description}</small></button>)}</div><label>选择依据<textarea value={executionRationale} onChange={(event) => { setExecutionRationale(event.target.value) }} placeholder="引用阶段 2/3 的业务结果、权限、风险和成本证据。" /></label></section>
            <section className={css.designDrawerSection}><span>判断是否需要本体与知识图谱</span><div className={css.designChoiceGrid} data-columns="2"><button type="button" data-selected={routeSemanticMode === 'schema' ? 'true' : undefined} onClick={() => { setRouteSemanticMode('schema') }}><strong>数据结构（Schema）</strong><small>对象与接口边界清晰，不需要跨来源实体统一、多跳、来源时间或图推理。</small></button><button type="button" data-selected={routeSemanticMode === 'ontology' ? 'true' : undefined} onClick={() => { setRouteSemanticMode('ontology') }}><strong>本体（Ontology）与知识图谱</strong><small>存在必须验证的复杂关系、来源、时间、多跳查询或多 Agent 共享语义。</small></button></div><label>必要性依据<textarea value={semanticRationale} onChange={(event) => { setSemanticRationale(event.target.value) }} placeholder="说明为什么数据结构（Schema） 足够，或哪些业务问题确实要求正式本体。" /></label></section>
          </>}
          {drawer === 'sources' && <>
            <section className={css.designDrawerSection}><span>已识别项目材料 · {selectedSources.length}/12</span><div className={css.designSourceChoices}>{readySources.map(source => <label key={source.sourceId} data-selected={selectedSources.includes(source.sourceId) ? 'true' : undefined}><input type="checkbox" checked={selectedSources.includes(source.sourceId)} onChange={(event) => { setSelectedSources(current => event.target.checked ? [...current, source.sourceId] : current.filter(id => id !== source.sourceId)) }} /><span><strong>{source.originalName}</strong><small>{source.relativePath} · {(source.bytes / 1024).toFixed(1)} KB</small></span></label>)}{readySources.length === 0 && <p>当前没有已完成本地识别的项目材料。请先从项目资料入口上传或完成识别。</p>}</div></section>
            <section className={css.designDrawerSection}><label>本轮获准用途<textarea value={permissionScope} onChange={(event) => { setPermissionScope(event.target.value) }} /></label><label>来源权威级别<select value={sourceAuthority} onChange={(event) => { setSourceAuthority(event.target.value as 'primary' | 'supporting') }}><option value="primary">主要依据</option><option value="supporting">辅助依据</option></select></label><p>保存后会锁定材料 ID、文件校验值和修改时间；原件变化时必须重新绑定。</p></section>
          </>}
          {drawer === 'definition' && <>
            <div className={css.designDefinitionStats}><span><b>{definitionDraft.competencyQuestions.length}</b>业务问题</span><span><b>{definitionDraft.classes.length}</b>类</span><span><b>{definitionDraft.relationships.length}</b>关系</span><span><b>{definitionDraft.provenanceRules.length + definitionDraft.temporalRules.length}</b>规则</span></div>
            <section className={css.designDrawerSection}><span>本体定义草稿</span><p>以下修改保存后只形成新草稿，并使旧构建、验证、上下文与纵向切片进入需重新验证；发布仍需单独运行 Semantica 校验。</p></section>
            <OntologyDefinitionEditor value={definitionDraft} onChange={setDefinitionDraft} />
          </>}
          {drawer === 'candidates' && <>
            {(semanticWorkspace?.candidates.warnings.length ?? 0) > 0 && <div className={css.designWarnings}>{semanticWorkspace?.candidates.warnings.map((warning, index) => <p key={String(index)}>{warning}</p>)}</div>}
            <section className={css.designDrawerSection}><span>实体候选 · {semanticWorkspace?.candidates.entities.length ?? 0}</span><div className={css.designCandidateList}>{(semanticWorkspace?.candidates.entities ?? []).map(item => <article key={item.id}><span><strong>{item.label}</strong><small>{item.type} · 抽取分数 {Math.round(item.confidence * 100)}% · {item.sourceRefs.length} 个来源</small></span><div><button type="button" data-selected={(candidateDecisions[item.id] ?? item.decision) === 'accepted' ? 'true' : undefined} onClick={() => { setCandidateDecisions(current => ({ ...current, [item.id]: 'accepted' })) }}>接受</button><button type="button" data-rejected={(candidateDecisions[item.id] ?? item.decision) === 'rejected' ? 'true' : undefined} onClick={() => { setCandidateDecisions(current => ({ ...current, [item.id]: 'rejected' })) }}>拒绝</button></div></article>)}</div></section>
            <section className={css.designDrawerSection}><span>关系候选 · {semanticWorkspace?.candidates.relationships.length ?? 0}</span><div className={css.designCandidateList}>{(semanticWorkspace?.candidates.relationships ?? []).map(item => <article key={item.id}><span><strong>{item.label ?? item.type}</strong><small>{item.source} → {item.target} · {item.sourceRefs.length} 个来源</small></span><div><button type="button" data-selected={(candidateDecisions[item.id] ?? item.decision) === 'accepted' ? 'true' : undefined} onClick={() => { setCandidateDecisions(current => ({ ...current, [item.id]: 'accepted' })) }}>接受</button><button type="button" data-rejected={(candidateDecisions[item.id] ?? item.decision) === 'rejected' ? 'true' : undefined} onClick={() => { setCandidateDecisions(current => ({ ...current, [item.id]: 'rejected' })) }}>拒绝</button></div></article>)}</div></section>
          </>}
          {drawer === 'context' && <section className={css.designDrawerSection}><span>当前已验证版本</span><p>Schema {semanticWorkspace?.definition.version} · 图谱 {semanticWorkspace?.validation?.runId ?? '待验证'}。至少选择一个业务问题或起始实体。</p><label>业务问题<select value={contextQuestionId} onChange={(event) => { setContextQuestionId(event.target.value) }}><option value="">不指定业务问题</option>{(semanticWorkspace?.definition.competencyQuestions ?? []).map(item => <option key={item.id} value={item.id}>{item.text}</option>)}</select></label><label>起始实体<select value={contextSeedId} onChange={(event) => { setContextSeedId(event.target.value) }}><option value="">不指定实体</option>{(graphSnapshot?.nodes ?? []).map(item => <option key={item.id} value={item.id}>{item.label} · {item.type}</option>)}</select></label><label>任务目的<textarea value={contextQuery} onChange={(event) => { setContextQuery(event.target.value) }} /></label><label>关系深度<select value={contextDepth} onChange={(event) => { setContextDepth(Number(event.target.value)) }}><option value={0}>仅当前实体</option><option value={1}>1 跳关系</option><option value={2}>2 跳关系</option><option value={3}>3 跳关系</option></select></label></section>}
        </div>
        <footer>{error !== null && <p role="alert">{error}</p>}<div><button type="button" className={css.tertiaryButton} disabled={operation !== null} onClick={() => { setDrawer(null) }}>取消</button>{drawer === 'route' && <button type="button" className={css.primaryButton} disabled={operation !== null} onClick={() => { void saveRoute() }}>{operation ?? '保存候选方案'}</button>}{drawer === 'sources' && <button type="button" className={css.primaryButton} disabled={operation !== null} onClick={() => { void saveSources() }}>{operation ?? '绑定本轮材料'}</button>}{drawer === 'definition' && <button type="button" className={css.primaryButton} disabled={operation !== null} onClick={() => { void saveDefinition() }}>{operation ?? '保存新草稿'}</button>}{drawer === 'candidates' && <button type="button" className={css.primaryButton} disabled={operation !== null} onClick={() => { void saveCandidateReview() }}>{operation ?? '保存审核决定'}</button>}{drawer === 'context' && <button type="button" className={css.primaryButton} disabled={operation !== null || contextQuery.trim() === ''} onClick={() => { void runContext() }}>{operation ?? '生成任务参考信息'}</button>}</div></footer>
      </aside>
    </div>}
  </section>
}

function EvaluationWorkbench(input: Omit<Parameters<typeof LaterStagePanel>[0], 'stage'>) {
  return <EvaluationStagePanel {...input} records={openFile => <ProjectRecordPanel
    actualStage="evaluation" collapsed={false} hideCollapse
    projectSurface={input.projectSurface} sourceFiles={input.sourceFiles}
    openFile={openFile} onCollapsedChange={() => {}}
  />} />
}

function LaterStagePanel({ props, workspace, sessionId, view, stageState, stage, surface, projectSurface, sourceFiles, historicalActualStage }: {
  readonly props: WorkbenchProps
  readonly workspace: { readonly workspaceId: string; readonly title: string; readonly path: string }
  readonly sessionId: string
  readonly view: boolean
  readonly stageState: ProjectStageValue
  readonly stage: FdeV2StageId
  readonly surface: V2StageSurfaceSnapshot | undefined
  readonly projectSurface: ProjectSurfaceSnapshot | undefined
  readonly sourceFiles: readonly ProjectSourceItem[]
  readonly historicalActualStage?: FdeV2StageId
}) {
  const [artifactsCollapsed, setArtifactsCollapsed] = useState(true)
  const [reviewing, setReviewing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [returning, setReturning] = useState(false)
  const [reviewCollapsed, setReviewCollapsed] = useState(false)
  const [returnReason, setReturnReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const stageOrder = [
    'discovery', 'definition', 'investigation', 'design',
    'evaluation', 'pilot', 'production', 'improvement',
  ] as const
  const index = stageOrder.indexOf(stage)
  const historical = historicalActualStage !== undefined
  const actualStageIndex = historicalActualStage === undefined ? -1 : stageOrder.indexOf(historicalActualStage)
  if (surface === undefined) return <section className={css.state} role="alert"><strong>当前阶段资料尚未加载</strong><span>请刷新项目工作台后重试。</span></section>
  const current = surface.workItems.find(item => item.id === surface.currentWorkId) ?? surface.workItems[0]
  const requiredArtifacts = surface.artifacts.filter(artifact => artifact.required)
  const reviewedCount = historical
    ? requiredArtifacts.length
    : surface.reviewReady ? Math.max(0, requiredArtifacts.length - 1) : 0
  const missingRequiredArtifacts = surface.artifacts.filter(artifact => artifact.required && artifact.status !== 'present')
  const stageRecordBlocker = surface.reviewBlockers.find(isStageRecordBlocker)
  const otherReviewBlockers = surface.reviewBlockers.filter(item => (
    !isStageRecordBlocker(item)
    && !surface.artifacts.some(artifact => matchesArtifactBlocker(item, artifact.title))
  ))
  const reviewReadinessItems = [
    ...(stageRecordBlocker === undefined ? [] : [{
      id: 'stage-progress',
      kind: 'progress',
      category: '阶段进度',
      title: stageRecordBlocker.includes('无法读取') ? '阶段进度读取失败' : '阶段进度尚未保存',
      purpose: stageRecordBlocker.includes('无法读取') ? '请修复阶段记录后刷新工作台。' : '完成第一次梳理后，系统会保存本阶段进度。',
      status: stageRecordBlocker.includes('无法读取') ? '需修复' : '待建立',
    }]),
    ...missingRequiredArtifacts.map(artifact => ({
      id: `artifact-${artifact.id}`,
      kind: 'artifact',
      category: '必备记录',
      title: artifact.title,
      purpose: artifact.status === 'error' ? '文件无法读取，请修复后刷新。' : artifact.purpose,
      status: artifact.status === 'error' ? '需修复' : '待整理',
    })),
    ...otherReviewBlockers.map((item, itemIndex) => ({
      id: `decision-${String(itemIndex)}`,
      kind: 'decision',
      category: '还需确认',
      title: item,
      purpose: '请继续核对事实，并把处理结果写入本阶段记录。',
      status: '待处理',
    })),
  ]
  if (!surface.reviewReady && reviewReadinessItems.length === 0) reviewReadinessItems.push({
    id: 'stage-in-progress',
    kind: 'progress',
    category: '阶段进度',
    title: '本阶段尚未进入可评审状态',
    purpose: '继续完成当前工作并刷新阶段记录。',
    status: '进行中',
  })
  const unresolvedReviewCount = surface.reviewReady
    ? 0
    : reviewReadinessItems.length
  const openFile = (path: string, title: string): void => {
    setError(null)
    void props.openProjectFile(sessionId, workspace.path, path, title).catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : String(cause))
    })
  }
  const complete = async (): Promise<void> => {
    setSubmitting(true); setError(null)
    try { await props.completeV2Stage(workspace.workspaceId, stageState.revision, stage) }
    catch (cause: unknown) { setError(cause instanceof Error ? cause.message : String(cause)) }
    finally { setSubmitting(false) }
  }
  const returnStage = async (): Promise<void> => {
    if (returnReason.trim() === '') { setError('请先说明为什么要返回上一阶段。'); return }
    setSubmitting(true); setError(null)
    try { await props.returnV2Stage(workspace.workspaceId, stageState.revision, returnReason) }
    catch (cause: unknown) { setError(cause instanceof Error ? cause.message : String(cause)) }
    finally { setSubmitting(false) }
  }
  return <section
    className={`${css.root} ${css.genericStageRoot}${historical ? ` ${css.browsedStage}` : ''}`}
    data-fde-stage-workbench=""
    data-conversation-hero-project=""
    data-stage={stage}
    data-historical={historical ? 'true' : undefined}
    data-hide-stage-composer={historical ? 'true' : undefined}
    data-conversation-composer-layout={historical ? 'stage-history' : stage === 'definition' ? 'stage-definition' : 'stage-execution'}
    data-conversation-composer-overlay={view ? '' : undefined}
    data-artifacts-collapsed={artifactsCollapsed ? 'true' : undefined}
    aria-label={`${historical ? '历史' : '项目'}阶段工作台：${surface.title}`}
  >
    {historical && <header className={css.browsedStageNotice}>
      <HistoricalNoticeIcon />
      <div><span>阶段完成记录</span><strong>正在查看第 {surface.index} 阶段，项目当前在“{V2_STAGE_NAMES[actualStageIndex]}”</strong><p>保留本阶段原有工作台与真实记录，当前为只读查看。</p></div>
      <button type="button" className={css.secondaryButton} onClick={() => { props.returnToCurrentStage(workspace.workspaceId) }}>返回当前阶段 <span aria-hidden="true">→</span></button>
    </header>}
    <div className={css.genericStageGrid} data-artifacts-collapsed={artifactsCollapsed ? 'true' : undefined}>
      <main>
        <section className={css.stageOverview} data-definition-hero={stage === 'definition' ? '' : undefined}>
          <header className={css.stageIntro}>
            <span>第 {surface.index}/8 阶段 · {historical ? '已完成' : '本阶段目标'}</span>
            <h1 data-definition-stage-title={stage === 'definition' ? '' : undefined}>{surface.objective}</h1>
            <p>{surface.explanation}</p>
          </header>
          {stage === 'definition' && <>
            <div className={css.definitionHeroDecoration} aria-hidden="true"><img src="/fde-dashboard/project-priority-stack.png" alt="" /></div>
            <div className={css.definitionStageRing} data-definition-stage-ring="" aria-label={`${historical ? '正在查看已完成的' : '当前处于'}第 ${String(surface.index)} 阶段，共 8 个阶段`}><strong>{surface.index}</strong><span>/8</span><small>{historical ? '已完成' : '当前阶段'}</small></div>
          </>}
          <div className={css.workPathMeta}><span>本阶段进度</span><b>{surface.presentCount}/{surface.requiredCount} 项必备记录已形成</b></div>
          <ol
            className={css.workPath}
            data-definition-work-path={stage === 'definition' ? '' : undefined}
            data-progress={stage === 'definition' && surface.reviewReady ? '3' : undefined}
            aria-label={`${surface.title}工作路径`}
          >
            {surface.workItems.map((item, itemIndex) => {
              const awaitingDecision = !historical && stage === 'definition' && surface.reviewReady && itemIndex === surface.workItems.length - 1
              const visibleStatus = awaitingDecision ? 'current' : item.status
              return <li key={item.id} data-status={visibleStatus}>
                <i>{awaitingDecision ? '●' : item.status === 'complete' ? '✓' : String(itemIndex + 1).padStart(2, '0')}</i>
                <span><strong>{item.title}</strong><small>{awaitingDecision || item.status === 'complete' ? '已完成' : item.status === 'current' ? '正在进行' : item.status === 'blocked' ? '存在阻塞' : '待开始'}</small></span>
              </li>
            })}
          </ol>
        </section>

        <section className={css.currentWork} data-definition-current-work={stage === 'definition' ? '' : undefined}>
          <header>
            <span>{historical ? '当时完成' : '现在先做'}</span>
            <b>第 {String(Math.max(1, surface.workItems.findIndex(item => item.id === current?.id) + 1))} 步</b>
          </header>
          <h2>{current?.title ?? surface.title}</h2><p>{current?.purpose ?? surface.explanation}</p>
          <div className={css.promptGuide}>
            {stage === 'definition' && <SparkleIcon />}
            <div className={css.promptGuideCopy}>
              <span>{historical ? '本阶段采用的工作方法' : '可以直接让 Agent 从这里开始'}</span>
              <strong>{surface.prompt}</strong>
              {stage === 'definition' && <mark>{historical ? '阶段已完成，内容只读。' : '不要更改 FDE 确认结论。'}</mark>}
              <small>{historical ? '这是本阶段保存的工作提示，不会触发新的执行。' : '按钮只把提示词放入输入框，不会自动发送，也不会替 FDE 确认阶段。'}</small>
            </div>
            {stage === 'definition' && <i className={css.promptSparkleAccent} aria-hidden="true">✦</i>}
          </div>
          <div className={css.workActions} data-definition-work-actions={stage === 'definition' ? '' : undefined}>
            {historical
              ? <span className={css.stageUpdateStatus}><i />已保存阶段记录 · 只读</span>
              : <><button type="button" className={css.primaryButton} onClick={() => {
                props.prepareStageDraft(sessionId, surface.prompt)
              }}>{stage === 'definition' && <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m5 3 8 5-8 5V3Z" /></svg>}开始本阶段工作</button>
              <button type="button" className={css.secondaryButton} onClick={() => {
                props.refreshProjectSurface(workspace.workspaceId)
              }}>{stage === 'definition' && <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M13 5.5A5.5 5.5 0 1 0 13.2 10M13 2.5v3h-3" /></svg>}刷新阶段记录</button>
              {stage === 'definition' && <span className={css.stageUpdateStatus}><i />阶段记录已更新 · 刚刚</span>}</>}
          </div>
        </section>

        <section className={css.workflowsPanel} data-definition-review={stage === 'definition' ? '' : undefined}>
          <header>
            <div className={css.reviewHeading}>
              <span aria-hidden="true"><svg viewBox="0 0 20 20" fill="none"><path d="M6.5 4.5h7A1.5 1.5 0 0 1 15 6v10H5V6a1.5 1.5 0 0 1 1.5-1.5Z" /><path d="M8 4V2.75h4V4M7.5 9h5M7.5 12h5" /></svg></span>
              <div><small>{historical ? '阶段完成记录' : '评审准备'}</small><h2>{historical ? '已保存的材料与人工决定' : surface.reviewReady ? '材料已具备，请逐项核对' : '本阶段尚未达到评审条件'}</h2><p>{historical ? '以下内容来自本阶段已保存的材料和状态。' : surface.reviewReady ? '文件齐备只代表可以开始评审，是否进入下一阶段仍由 FDE 决定。' : '还需保存阶段进度并补齐必备记录；材料齐备后仍由 FDE 人工判断。'}</p></div>
            </div>
            {surface.reviewReady
              ? <div className={css.reviewSummary} data-definition-review-summary={stage === 'definition' ? '' : undefined}>
                <b data-kind="materials"><i>✓</i>材料齐备 {surface.presentCount}/{surface.requiredCount}</b>
                <b data-kind="manual"><i>⊕</i>人工核对 {reviewedCount}/{requiredArtifacts.length}</b>
                <button type="button" onClick={() => { setReviewCollapsed(value => !value) }}><span aria-hidden="true">⌃</span>{reviewCollapsed ? '展开清单' : '收起清单'}</button>
              </div>
              : <div className={css.pendingReviewSummary}><b>{unresolvedReviewCount} 项待完成</b><span>{surface.presentCount}/{surface.requiredCount} 份必备记录</span></div>}
          </header>
          {surface.reviewReady
            ? !reviewCollapsed && <div className={css.stageReviewArtifacts}>
              {requiredArtifacts.map((artifact, artifactIndex, artifacts) => {
                const reviewPending = !historical && artifactIndex === artifacts.length - 1
                return <article key={artifact.id} data-review-pending={reviewPending ? 'true' : undefined}>
                  <i aria-hidden="true">{reviewPending ? '⊕' : '✓'}</i>
                  <b>{String(artifactIndex + 1).padStart(2, '0')}</b>
                  <span><svg aria-hidden="true" viewBox="0 0 20 20"><path d="M6.5 3.5h6l3 3v8.75A1.75 1.75 0 0 1 13.75 17H6.5a1.75 1.75 0 0 1-1.75-1.75v-10A1.75 1.75 0 0 1 6.5 3.5Z" /><path d="M12.5 3.75v3h3" /></svg><strong>{definitionArtifactTitle(artifact, artifactIndex)}</strong></span>
                  <small>{artifact.purpose}</small>
                  <em>{reviewPending ? '待核对' : '已核对'}</em>
                  {artifact.status === 'present' && <button type="button" onClick={() => { openFile(artifact.path, definitionArtifactTitle(artifact, artifactIndex)) }}>{reviewPending ? '查看并核对' : '查看'} <span aria-hidden="true">›</span></button>}
                </article>
              })}
            </div>
            : <div className={css.reviewReadinessGrid}>
              {reviewReadinessItems.map((item, itemIndex) => <article key={item.id} data-kind={item.kind}>
                <i>{String(itemIndex + 1).padStart(2, '0')}</i>
                <span><small>{item.category}</small><strong>{item.title}</strong><p>{item.purpose}</p></span>
                <b>{item.status}</b>
              </article>)}
            </div>}
          {surface.reviewReady && !reviewCollapsed && <button type="button" className={css.reviewAllRecords} onClick={() => { setArtifactsCollapsed(false) }}>查看全部记录 ({requiredArtifacts.length}) <span aria-hidden="true">›</span></button>}
          {historical
            ? <footer className={css.historicalArchiveFooter}><span><HistoricalArchiveIcon />当前只读查看本阶段已保存的工作记录和交付文件。</span><strong>只读记录</strong></footer>
            : <><div className={css.genericGateActions} data-definition-review-actions={stage === 'definition' ? '' : undefined}>
              {surface.reviewReady && <button type="button" className={css.primaryButton} onClick={() => { setReviewing(value => !value) }}>{reviewing ? '收起人工评审' : stage === 'improvement' ? '评审本轮改进' : '提交 FDE 评审'}</button>}
              <button type="button" className={css.tertiaryButton} onClick={() => { setReturning(value => !value) }}>返回上一阶段</button>
              {stage === 'definition' && <span className={css.gateDecisionHint}><i aria-hidden="true">♢</i>FDE 决定是否进入下一阶段</span>}
            </div>
            {reviewing && <div className={css.genericReview}><strong>确认阶段记录和证据已经核对？</strong><p>{stage === 'improvement' ? '确认后记录一次改进循环，项目仍停留在持续改进阶段。' : `确认后进入“${V2_STAGE_NAMES[Math.min(7, index + 1)]}”。后续仍可带原因返回补充。`}</p><button type="button" className={css.primaryButton} disabled={submitting} onClick={() => { void complete() }}>{submitting ? '正在提交…' : '确认并继续'}</button></div>}
            {returning && <div className={css.genericReview}><label htmlFor="v2-stage-return-reason">返回原因</label><textarea id="v2-stage-return-reason" value={returnReason} onChange={(event) => { setReturnReason(event.target.value) }} placeholder="例如：客户补充了新的业务边界，需要回到上一阶段重新核对。" /><button type="button" className={css.secondaryButton} disabled={submitting} onClick={() => { void returnStage() }}>保留现有材料并返回</button></div>}
            </>}
          {error !== null && <p className={css.inlineError} role="alert">{error}</p>}
        </section>
      </main>

      <aside data-stage-artifact-column="" data-collapsed={artifactsCollapsed ? 'true' : undefined}>
        <ProjectRecordPanel
          actualStage={historicalActualStage ?? stage}
          collapsed={artifactsCollapsed}
          projectSurface={projectSurface}
          sourceFiles={sourceFiles}
          openFile={openFile}
          onCollapsedChange={setArtifactsCollapsed}
        />
      </aside>
    </div>
  </section>
}

type DiscoveryArtifact = {
  readonly id: string
  readonly title: string
  readonly path: string
  readonly required: boolean
  readonly purpose: string
  readonly status: 'missing' | 'present' | 'error'
  readonly structureState?: 'missing' | 'invalid' | 'starter_valid' | 'complete_valid' | 'not_applicable'
  readonly evidenceState?: 'confirmed' | 'inferred' | 'unverified'
  readonly version?: number
  readonly sourceAdapter?: { readonly id: string; readonly version: string; readonly artifact: string }
  readonly evidenceRefs?: readonly { readonly id: string }[]
  readonly message?: string
}

function fallbackArtifacts(surface: ProjectSurfaceSnapshot | undefined): readonly DiscoveryArtifact[] {
  const legacy = surface?.requirements.artifacts ?? []
  const mapped = legacy.map((artifact): DiscoveryArtifact => ({
    ...artifact,
    title: artifact.id === 'research-report'
      ? '现场观察记录'
      : artifact.id === 'confirmation-checklist'
        ? '事实确认清单'
        : '工作流章程',
    required: true,
    purpose: artifact.id === 'research-report'
      ? '记录人员陈述、代表案例、现场观察与未验证推断。'
      : artifact.id === 'confirmation-checklist'
        ? '管理待核对事实、来源、责任人和当前结论。'
        : '冻结候选工作流、业务结果、边界、回退和停止条件。',
  }))
  const defaults: readonly DiscoveryArtifact[] = [
    { id: 'research-report', title: '现场观察记录', path: 'fde-deliverables/01-requirement-research/requirement-research-report.md', required: true, purpose: '记录人员陈述、代表案例、现场观察与未验证推断。', status: 'missing' },
    { id: 'confirmation-checklist', title: '事实确认清单', path: 'fde-deliverables/01-requirement-research/confirmation-checklist.md', required: true, purpose: '管理待核对事实、来源、责任人和当前结论。', status: 'missing' },
    { id: 'requirement-baseline', title: '工作流章程', path: 'fde-deliverables/01-requirement-research/requirement-baseline.md', required: true, purpose: '冻结候选工作流、业务结果、边界、回退和停止条件。', status: 'missing' },
  ]
  return [
    ...(mapped.length === 0 ? defaults : mapped),
    { id: 'engagement-reframe', title: '项目重新界定记录', path: 'fde-deliverables/01-requirement-research/engagement-reframe.md', required: false, purpose: '仅在现场事实推翻原始边界、成功标准或停止条件时需要。', status: 'missing' },
  ]
}

function artifactGap(artifact: DiscoveryArtifact): string {
  if (artifact.status === 'present' && artifact.structureState === 'invalid') return artifact.message ?? '内容已经生成，但还缺少必要信息，请补充后再评审。'
  if (artifact.status === 'present') return '已有初稿，请继续核对信息来源和未确认事项。'
  if (artifact.status === 'error') return artifact.message ?? '暂时无法读取，请修复文件后再继续。'
  if (artifact.id === 'research-report') return '记录客户原话、实际操作步骤，以及正常和异常案例。'
  if (artifact.id === 'confirmation-checklist') return '列出哪些事实已经确认，哪些仍需找谁核对。'
  if (artifact.id === 'requirement-baseline') return '说明要解决的流程、预期结果、负责人和停止条件。'
  return '只有新事实改变了项目范围或成功标准时才需要。'
}

function artifactStatus(artifact: DiscoveryArtifact): string {
  if (artifact.status === 'error') return '读取失败'
  if (artifact.status === 'missing') return artifact.required ? '尚未整理' : '按需生成'
  if (artifact.structureState === 'complete_valid') return `已整理 · v${String(artifact.version ?? 1)}`
  if (artifact.structureState === 'starter_valid') return `已有初稿 · v${String(artifact.version ?? 1)}`
  return '已生成，待核对'
}

function artifactDisplayTitle(artifact: DiscoveryArtifact): string {
  if (artifact.id === 'research-report') return '客户现状记录'
  if (artifact.id === 'confirmation-checklist') return '待确认事项'
  if (artifact.id === 'requirement-baseline') return '业务流程说明'
  if (artifact.id === 'engagement-reframe') return '项目调整记录'
  return artifact.title
}

function definitionArtifactTitle(artifact: DiscoveryArtifact, index: number): string {
  const titles = ['当前基线记录', '成功标准与交付边界', '责任人与停止条件'] as const
  return titles[index] ?? artifactDisplayTitle(artifact)
}

function workflowDisposition(value: 'candidate' | 'selected' | 'deferred' | 'rejected'): string {
  if (value === 'selected') return '当前选择'
  if (value === 'deferred') return '暂缓'
  if (value === 'rejected') return '已排除'
  return '候选'
}

function formatSourceBytes(bytes: number): string {
  if (bytes < 1024) return `${String(bytes)} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes >= 1024 * 100 ? 0 : 1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(bytes >= 1024 * 1024 * 10 ? 0 : 1)} MB`
}

function sourceStatus(file: { readonly previewKind: string; readonly parse: { readonly status: string } }): string {
  if (file.parse.status === 'processing') return '正在识别'
  if (file.parse.status === 'error' || file.parse.status === 'stale') return '待重新处理'
  if (file.parse.status === 'needs-ocr') return '可预览，待 OCR'
  if (file.previewKind === 'unsupported' || file.parse.status === 'unsupported') return '已归档'
  if (file.parse.status === 'ready') return '已识别，可预览'
  return '可预览'
}

function stageArtifacts(surface: ProjectSurfaceSnapshot | undefined, index: number): readonly DiscoveryArtifact[] {
  // oxlint-disable-next-line typescript/no-unnecessary-condition -- persisted pre-V2 snapshots can omit discovery.
  if (index === 0) return surface?.discovery?.artifacts ?? fallbackArtifacts(surface)
  const stage = FDE_V2_STAGE_IDS[index]
  if (stage === undefined || stage === 'discovery') return []
  return surface?.v2Stages[stage as V2LifecycleStageId]?.artifacts ?? []
}

function recommendationLabel(value: V2StageSurfaceSnapshot['recommendation'] | undefined): string | undefined {
  if (value === 'go') return '继续推进'
  if (value === 'revise') return '补充后再推进'
  if (value === 'narrow') return '收窄范围后推进'
  if (value === 'stop') return '停止投入'
  return undefined
}

function recordStageTitle(surface: ProjectSurfaceSnapshot | undefined, index: number): string {
  const stage = FDE_V2_STAGE_IDS[index]
  if (stage === undefined || stage === 'discovery') return V2_STAGE_NAMES[index] ?? '项目记录'
  return surface?.v2Stages[stage as V2LifecycleStageId]?.title ?? V2_STAGE_NAMES[index] ?? '项目记录'
}

function recordStageInputs(surface: ProjectSurfaceSnapshot | undefined, index: number): readonly DiscoveryArtifact[] {
  if (index === 0) return []
  return stageArtifacts(surface, index - 1).filter(artifact => artifact.status === 'present')
}

function ProjectRecordPanel({
  actualStage, collapsed, projectSurface, sourceFiles, openFile, onCollapsedChange, onStartReview, reviewReady = false, hideCollapse = false,
}: {
  readonly actualStage: FdeV2StageId
  readonly collapsed: boolean
  readonly projectSurface: ProjectSurfaceSnapshot | undefined
  readonly sourceFiles: readonly ProjectSourceItem[]
  readonly openFile: (path: string, title: string) => void
  readonly onCollapsedChange: (collapsed: boolean) => void
  readonly onStartReview?: () => void
  readonly reviewReady?: boolean
  readonly hideCollapse?: boolean
}) {
  const actualIndex = Math.max(0, FDE_V2_STAGE_IDS.indexOf(actualStage))
  const [selectedIndex, setSelectedIndex] = useState(actualIndex)
  const [showAll, setShowAll] = useState(false)
  const recordIndexes = Array.from({ length: actualIndex + 1 }, (_, offset) => actualIndex - offset)

  useEffect(() => {
    setSelectedIndex(actualIndex)
    setShowAll(false)
  }, [actualIndex])

  const selectStage = (index: number): void => {
    setSelectedIndex(index)
    setShowAll(false)
    onCollapsedChange(false)
  }
  const selectedTitle = recordStageTitle(projectSurface, selectedIndex)
  const selectedArtifacts = stageArtifacts(projectSurface, selectedIndex)
  const selectedRequired = selectedArtifacts.filter(artifact => artifact.required)
  const selectedPresent = selectedRequired.filter(artifact => artifact.status === 'present').length
  const selectedInputs = recordStageInputs(projectSurface, selectedIndex)
  const selectedIsCurrent = selectedIndex === actualIndex
  const selectedRecommendation = selectedIndex === 0
    ? undefined
    : recommendationLabel(projectSurface?.v2Stages[FDE_V2_STAGE_IDS[selectedIndex] as V2LifecycleStageId]?.recommendation)

  if (collapsed) {
    return <section className={css.projectRecordRail} data-definition-record-rail={actualStage === 'definition' ? '' : undefined} aria-label="项目记录轴">
      <header><svg className={css.artifactRailIcon} viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M6.5 3.5h6l3 3v8.75A1.75 1.75 0 0 1 13.75 17H6.5a1.75 1.75 0 0 1-1.75-1.75v-10A1.75 1.75 0 0 1 6.5 3.5Z" /><path d="M12.5 3.75v3h3M7.5 10h5M7.5 13h5" /></svg><span>项目记录</span></header>
      <div className={css.projectRecordNodes}>
        {recordIndexes.map((index) => {
          const artifacts = stageArtifacts(projectSurface, index)
          const required = artifacts.filter(artifact => artifact.required)
          const present = required.filter(artifact => artifact.status === 'present').length
          const current = index === actualIndex
          const title = recordStageTitle(projectSurface, index)
          return <button
            key={FDE_V2_STAGE_IDS[index]}
            type="button"
            className={css.projectRecordNode}
            data-current={current ? 'true' : undefined}
            aria-label={`查看第 ${String(index + 1)} 阶段记录：${title}`}
            data-tooltip={`第 ${String(index + 1)} 阶段 · ${title} · ${current ? '当前阶段' : '已完成'} · ${String(present)}/${String(required.length)} 项必备记录`}
            onClick={() => { selectStage(index) }}
          ><i>{String(index + 1).padStart(2, '0')}</i><span>{current ? '当前' : '已完成'}</span><b>{present}/{required.length}</b><DocumentStatusIcon state={current ? 'current' : 'complete'} /></button>
        })}
        <button type="button" className={css.projectRecordAllButton} data-definition-record-all={actualStage === 'definition' ? '' : undefined} aria-label="查看全部项目记录" data-tooltip="查看全部已有阶段记录" onClick={() => { setShowAll(true); onCollapsedChange(false) }}>全部<DocumentStatusIcon state="all" /></button>
      </div>
    </section>
  }

  return <section className={css.artifactsPanel} data-project-record-panel="">
    <header>
      <div><span>项目记录</span><h2>{showAll ? '全部已有记录' : selectedTitle}</h2><p>{showAll ? '按阶段查看项目已经留下的依据、交付文件和人工决定。' : selectedIsCurrent ? '当前阶段的资料和记录会随工作持续更新。' : '这是已经由 FDE 确认并推进的历史记录。'}</p></div>
      <div className={css.artifactHeaderActions}><b>{showAll ? `${String(recordIndexes.length)} 个阶段` : `${String(selectedPresent)}/${String(selectedRequired.length)}`}</b>{!hideCollapse && <button type="button" aria-expanded="true" aria-label="收起项目记录" title="收起项目记录" onClick={() => { onCollapsedChange(true) }}>收起</button>}</div>
    </header>

    {showAll
      ? <div className={css.projectRecordSummaryList}>{recordIndexes.map((index) => {
        const artifacts = stageArtifacts(projectSurface, index)
        const required = artifacts.filter(artifact => artifact.required)
        const present = required.filter(artifact => artifact.status === 'present').length
        return <button key={FDE_V2_STAGE_IDS[index]} type="button" onClick={() => { selectStage(index) }}>
          <i>{String(index + 1).padStart(2, '0')}</i>
          <span>
            <strong>{recordStageTitle(projectSurface, index)}</strong>
            <small>{index === actualIndex ? '当前阶段' : '已完成 · FDE 已确认'}</small>
          </span>
          <b>{present}/{required.length}</b>
        </button>
      })}</div>
      : <>
        <nav className={css.projectRecordStageTabs} aria-label="切换已有阶段记录">
          {recordIndexes.map(index => <button
            key={FDE_V2_STAGE_IDS[index]}
            type="button"
            data-active={index === selectedIndex ? 'true' : undefined}
            onClick={() => { setSelectedIndex(index); setShowAll(false) }}
          >{String(index + 1).padStart(2, '0')}</button>)}
        </nav>
        <section className={css.recordGroup} aria-label="阶段输入">
          <header>
            <span><small>阶段输入</small><strong>当时依据了什么</strong></span>
            <b>{selectedIndex === 0 ? sourceFiles.length : selectedInputs.length} 项</b>
          </header>
          {selectedIndex === 0 && sourceFiles.length > 0 && <div className={css.sourceList}>
            {sourceFiles.map(file => <button
              key={file.sourceId} type="button" aria-label={`预览客户资料：${file.originalName}`}
              onClick={() => { openFile(file.relativePath, file.originalName) }}
            >
              <i>{file.extension === '' ? '文件' : file.extension.slice(0, 4).toUpperCase()}</i>
              <span><strong>{file.originalName}</strong><small>{formatSourceBytes(file.bytes)} · {sourceStatus(file)}</small></span>
              <em>打开</em>
            </button>)}
          </div>}
          {selectedIndex > 0 && selectedInputs.length > 0 && <div className={css.sourceList}>
            {selectedInputs.map(artifact => <button
              key={artifact.id} type="button"
              onClick={() => { openFile(artifact.path, artifactDisplayTitle(artifact)) }}
            >
              <i>记</i>
              <span><strong>{artifactDisplayTitle(artifact)}</strong><small>来自上一阶段的已保存记录</small></span>
              <em>打开</em>
            </button>)}
          </div>}
          {(
            (selectedIndex === 0 && sourceFiles.length === 0)
            || (selectedIndex > 0 && selectedInputs.length === 0)
          ) && <p className={css.emptySources}>没有登记可直接追溯的阶段输入。</p>}
        </section>
        <div className={css.outputHeading}>
          <span><small>阶段输出</small><strong>留下了什么</strong></span>
          <b>{selectedPresent}/{selectedRequired.length}</b>
        </div>
        <div className={css.artifactList}>{selectedArtifacts.map(artifact => <article
          key={artifact.id} data-status={artifact.status}
        >
          <header>
            <i>{artifact.required ? '记' : '需'}</i>
            <span><strong>{artifactDisplayTitle(artifact)}</strong><small>{artifactGap(artifact)}</small></span>
          </header>
          <footer>
            <b>{artifactStatus(artifact)}</b>
            {artifact.status === 'present' && <button type="button" onClick={() => {
              openFile(artifact.path, artifactDisplayTitle(artifact))
            }}>预览</button>}
          </footer>
        </article>)}</div>
        <section className={css.projectRecordDecision} data-current={selectedIsCurrent ? 'true' : undefined}>
          <i aria-hidden="true">{selectedIsCurrent ? '○' : '✓'}</i>
          <span>
            <small>人工决定</small>
            <strong>{selectedIsCurrent ? '等待 FDE 完成本阶段判断' : 'FDE 已确认并推进到下一阶段'}</strong>
            {selectedRecommendation !== undefined && <em>当时建议：{selectedRecommendation}</em>}
          </span>
        </section>
        {selectedIsCurrent && reviewReady && onStartReview !== undefined && <div
          className={css.reviewAction} data-stage-review-action=""
        >
          <span><strong>候选材料已齐备</strong><small>请先阅读记录，再由 FDE 决定是否推进。</small></span>
          <button type="button" className={css.primaryButton} onClick={onStartReview}>
            提交 FDE 评审 <span aria-hidden="true">→</span>
          </button>
        </div>}
      </>}
    {!showAll && <button type="button" className={css.projectRecordAllLink} onClick={() => { setShowAll(true) }}>查看全部已有记录</button>}
  </section>
}

function BrowsedStagePanel({ props, workspace, sessionId, view, actualStage, viewedStage, surface, sourceFiles }: {
  readonly props: WorkbenchProps
  readonly workspace: { readonly workspaceId: string; readonly title: string; readonly path: string }
  readonly sessionId: string
  readonly view: boolean
  readonly actualStage: FdeV2StageId
  readonly viewedStage: FdeV2StageId
  readonly surface: ProjectSurfaceSnapshot | undefined
  readonly sourceFiles: readonly ProjectSourceItem[]
}) {
  const [fileError, setFileError] = useState<string | null>(null)
  const actualIndex = FDE_V2_STAGE_IDS.indexOf(actualStage)
  const viewedIndex = FDE_V2_STAGE_IDS.indexOf(viewedStage)
  const historical = viewedIndex < actualIndex
  const later = viewedStage === 'discovery' ? undefined : surface?.v2Stages[viewedStage as V2LifecycleStageId]
  const discovery = surface?.discovery
  const title = viewedStage === 'discovery' ? V2_STAGE_NAMES[0] : later?.title ?? V2_STAGE_NAMES[viewedIndex]
  const objective = viewedStage === 'discovery'
    ? '先弄清客户现在怎么做、哪里出了问题，再决定先解决什么。'
    : later?.objective ?? '本阶段资料尚未加载。'
  const explanation = viewedStage === 'discovery'
    ? '结合客户资料和真实案例还原现状，保留未确认事实，由 FDE 判断是否值得继续投入。'
    : later?.explanation ?? '请返回当前阶段，待项目前置事实具备后再查看。'
  const artifacts = stageArtifacts(surface, viewedIndex)
  const presentArtifacts = artifacts.filter(artifact => artifact.status === 'present')
  const previousArtifacts = viewedIndex > 0
    ? stageArtifacts(surface, viewedIndex - 1).filter(artifact => artifact.status === 'present')
    : []
  const selectedWorkflow = discovery?.workflows.items.find(item => item.id === discovery.workflows.selectedWorkflowId)
    ?? discovery?.workflows.items.find(item => item.disposition === 'selected')
  const stageRecommendation = recommendationLabel(later?.recommendation)
  const stageBlockers = viewedStage === 'discovery'
    ? discovery?.blockers ?? []
    : (later?.blockers ?? []).filter(blocker => blocker.status === 'open').map(blocker => blocker.title)
  const nextStageTitle = V2_STAGE_NAMES[Math.min(viewedIndex + 1, V2_STAGE_NAMES.length - 1)]
  const openFile = (path: string, artifactTitle: string): void => {
    setFileError(null)
    void props.openProjectFile(sessionId, workspace.path, path, artifactTitle).catch((error: unknown) => {
      setFileError(error instanceof Error ? error.message : String(error))
    })
  }

  return <section className={`${css.root} ${css.browsedStage}`} data-stage={viewedStage} data-historical={historical ? 'true' : undefined} data-future={historical ? undefined : 'true'} data-hide-stage-composer="true" data-conversation-composer-layout="stage-history" data-conversation-composer-overlay={view ? '' : undefined} aria-label={`正在查看：${title}`}>
    <header className={css.browsedStageNotice}>
      {historical && <HistoricalNoticeIcon />}
      <div><span>{historical ? '阶段完成记录' : '未开始阶段'}</span><strong>正在查看第 {String(viewedIndex + 1)} 阶段，项目当前在“{V2_STAGE_NAMES[actualIndex]}”</strong><p>{historical ? '以下内容来自当前项目已经保存的资料和阶段记录，不用计划模板补齐缺失事实。' : '这里只说明该阶段何时可以开始，不代表已经安排或执行了工作。'}</p></div>
      <button type="button" className={css.secondaryButton} onClick={() => { props.returnToCurrentStage(workspace.workspaceId) }}>返回当前阶段 {historical && <span aria-hidden="true">→</span>}</button>
    </header>

    {historical
      ? <>
        <section className={css.browsedStageGoal} data-stage-goal="">
          <div className={css.historicalGoalCopy}>
            <span>第 {String(viewedIndex + 1)}/8 阶段 · 已完成</span><h1 data-stage-title="">{title}</h1><p>{explanation}</p>
            <div className={css.historicalGoalFacts}>
              <span><HistoricalFactIcon type="input" />{sourceFiles.length} 份输入材料</span>
              <span><HistoricalFactIcon type="record" />{presentArtifacts.length} 份阶段记录</span>
              <span><HistoricalFactIcon type="gate" />已通过阶段评审</span>
            </div>
          </div>
          <div className={css.historicalCompletionRing} data-stage-ring="" aria-label={`第 ${String(viewedIndex + 1)}/8 阶段已完成`}><strong>{viewedIndex + 1}<small>/8</small></strong><span>已完成</span><i>✓</i></div>
          <div className={css.historicalGoalArt} data-stage-art="" aria-hidden="true"><img src="/fde-dashboard/stage-evidence-stack-3d.webp" alt="" /></div>
          <div className={css.historicalArchiveNote} data-stage-art-note="">◷ 阶段记录 · 只读查看</div>
        </section>
        <section className={css.historicalEvidenceChain} data-evidence-chain="">
          <header className={css.historicalEvidenceHeader}>
            <div><span>评审依据与记录</span><h2 data-evidence-title="">从输入依据到人工结论</h2><p>所有结论均可回到来源材料与阶段记录。</p></div>
            <div className={css.historicalEvidenceDirection} aria-hidden="true"><strong>01</strong><i /><strong>03</strong></div>
          </header>
          <div className={css.historicalStageGrid}>
            <section data-evidence-input="">
              <header className={css.historicalColumnHeader}><div><span>阶段输入</span><h2>当时依据了什么</h2></div><b>{viewedIndex === 0 ? sourceFiles.length : previousArtifacts.length} 份材料</b></header>
              {viewedIndex === 0 && sourceFiles.length > 0 && <span className={css.evidenceGroupLabel}>客户提供</span>}
              <ul className={css.historicalFactList}>
                {viewedIndex === 0 && sourceFiles.map(source => <li key={source.sourceId} data-evidence-row="" data-source-row="">
                  <EvidenceDocumentIcon />
                  <span>
                    <strong data-evidence-row-title="">{source.originalName}</strong>
                    <small>{sourceStatus(source)} · {formatSourceBytes(source.bytes)}</small>
                  </span>
                  <button type="button" onClick={() => {
                    openFile(source.relativePath, source.originalName)
                  }}>预览</button>
                </li>)}
                {viewedIndex > 0 && previousArtifacts.map(artifact => <li key={artifact.id} data-evidence-row="" data-source-row="">
                  <EvidenceDocumentIcon />
                  <span><strong data-evidence-row-title="">{artifactDisplayTitle(artifact)}</strong><small>来自上一阶段的已保存记录</small></span>
                  <button type="button" onClick={() => {
                    openFile(artifact.path, artifactDisplayTitle(artifact))
                  }}>预览</button>
                </li>)}
              </ul>
              {(
                (viewedIndex === 0 && sourceFiles.length === 0)
              || (viewedIndex > 0 && previousArtifacts.length === 0)
              ) && <p className={css.unregisteredFact}>未登记可直接追溯的阶段输入。</p>}
            </section>
            <section data-evidence-output="">
              <header className={css.historicalColumnHeader}><div><span>阶段输出</span><h2>已经留下什么</h2></div><b>{presentArtifacts.length} 份记录</b></header>
              <ul className={css.historicalFactList}>{presentArtifacts.map(artifact => <li key={artifact.id} data-evidence-row="">
                <EvidenceDocumentIcon /><i className={css.evidenceStateDot} aria-hidden="true" />
                <span><strong data-evidence-row-title="">{artifactDisplayTitle(artifact)}</strong><small>{artifact.purpose}</small></span>
                <button type="button" onClick={() => {
                  openFile(artifact.path, artifactDisplayTitle(artifact))
                }}>预览</button>
              </li>)}</ul>
              {presentArtifacts.length === 0 && <p className={css.unregisteredFact}>未发现可读取的阶段交付文件。</p>}
            </section>
            <section data-evidence-decision="">
              <header><span>人工结论</span><h2>当时如何决定</h2></header>
              <div className={css.historicalDecision}><EvidenceShieldIcon /><span><strong>已通过 FDE 阶段评审</strong><small>项目随后进入“{nextStageTitle}”。</small></span></div>
              {selectedWorkflow !== undefined && viewedStage === 'discovery' && <dl><dt>选定业务流程</dt><dd>{selectedWorkflow.title}</dd></dl>}
              {stageRecommendation !== undefined && <dl><dt>阶段建议</dt><dd>{stageRecommendation}</dd></dl>}
              <dl><dt>待解决问题</dt><dd>{stageBlockers.length === 0 ? '未登记待解决问题' : `${String(stageBlockers.length)} 项`}</dd></dl>
              <div className={css.historicalDecisionLink}>查看决策记录 <span aria-hidden="true">→</span></div>
            </section>
          </div>
          <ol className={css.historicalMilestones} data-stage-milestones="" aria-label="阶段工作记录">
            {['接收材料', '梳理业务流程', '核对问题', '记录流程选择', 'FDE 阶段评审'].map(item => <li key={item}><i>✓</i><span>{item}</span></li>)}
          </ol>
          <footer className={css.historicalArchiveFooter}><span><HistoricalArchiveIcon />当前只读查看已保存的阶段资料；本页不提供编辑操作。</span><strong>查看全部阶段记录</strong></footer>
        </section>
      </>
      : <>
        <section className={css.browsedStageGoal}>
          <div className={css.historicalGoalCopy}>
            <span>第 {String(viewedIndex + 1)}/8 阶段 · 尚未开始</span><h1>{title}</h1><p>{explanation}</p>
            <div className={css.historicalGoalFacts}>
              <span><HistoricalFactIcon type="input" />{previousArtifacts.length} 份前置阶段记录</span>
              <span><HistoricalFactIcon type="record" />{artifacts.filter(artifact => artifact.required).length} 份预计必备记录</span>
              <span><HistoricalFactIcon type="gate" />尚未进入阶段评审</span>
            </div>
          </div>
          <div className={css.historicalCompletionRing} data-complete="false" data-future="true" aria-label={`第 ${String(viewedIndex + 1)}/8 阶段尚未开始`}><strong>{viewedIndex + 1}<small>/8</small></strong><span>未开始</span><i>{viewedIndex + 1}</i></div>
          <div className={css.historicalGoalArt} aria-hidden="true"><img src="/fde-dashboard/stage-evidence-stack-3d.webp" alt="" /></div>
          <div className={css.historicalArchiveNote} data-stage-art-note="">◷ 等待“{V2_STAGE_NAMES[actualIndex]}”完成并通过阶段评审</div>
        </section>
        <section className={css.historicalEvidenceChain} data-future-stage="">
          <header className={css.historicalEvidenceHeader}>
            <div><span>阶段准备</span><h2>开始条件与评审要求</h2><p>这里只展示开始条件和预计记录，不把尚未发生的工作写成事实。</p></div>
            <div className={css.historicalEvidenceDirection} aria-hidden="true"><strong>01</strong><i /><strong>03</strong></div>
          </header>
          <div className={css.historicalStageGrid}>
            <section>
              <header><span>阶段输入</span><h2>开始前需要什么</h2></header>
              <ul className={css.historicalFactList}>{previousArtifacts.map(artifact => <li key={artifact.id}>
                <span><strong>{artifactDisplayTitle(artifact)}</strong><small>来自上一阶段的已保存记录</small></span>
                <button type="button" onClick={() => { openFile(artifact.path, artifactDisplayTitle(artifact)) }}>预览</button>
              </li>)}</ul>
              {previousArtifacts.length === 0 && <p className={css.unregisteredFact}>当前阶段尚未完成，前置记录仍在形成。</p>}
            </section>
            <section>
              <header><span>阶段输出</span><h2>开始后预计形成</h2></header>
              <ul className={css.historicalFactList}>{artifacts.map(artifact => <li key={artifact.id} data-status="waiting">
                <span><strong>{artifactDisplayTitle(artifact)}</strong><small>{artifact.required ? '必备记录' : '按需记录'} · {artifact.purpose}</small></span>
              </li>)}</ul>
              {artifacts.length === 0 && <p className={css.unregisteredFact}>阶段记录定义尚未加载。</p>}
            </section>
            <section>
              <header><span>人工结论</span><h2>何时能够开始</h2></header>
              <div className={css.historicalDecision}><i aria-hidden="true">{viewedIndex + 1}</i><span><strong>等待前置阶段完成</strong><small>尚未安排或执行本阶段工作。</small></span></div>
              <dl><dt>当前阶段</dt><dd>{V2_STAGE_NAMES[actualIndex]}</dd><dt>开始条件</dt><dd>先完成此前阶段并由 FDE 确认</dd><dt>阶段目标</dt><dd>{objective}</dd></dl>
            </section>
          </div>
          <ol className={css.historicalMilestones} aria-label={`第 ${String(viewedIndex + 1)} 阶段预计路径`}>
            {['前置阶段完成', '开始条件确认', '执行阶段工作', '形成阶段记录', 'FDE 阶段评审'].map((item, index) => <li key={item} data-status="waiting"><i>{index + 1}</i><span>{item}</span></li>)}
          </ol>
          <footer className={css.historicalArchiveFooter}><span><HistoricalArchiveIcon />当前只读查看；返回当前阶段继续形成真实记录。</span><strong>尚未开始</strong></footer>
        </section>
      </>}
    {fileError !== null && <p className={css.inlineError} role="alert">{fileError}</p>}
  </section>
}

function StageWorkbenchPanel({ props, workspace, sessionId, view }: {
  readonly props: WorkbenchProps
  readonly workspace: { readonly workspaceId: string; readonly title: string; readonly path: string }
  readonly sessionId: string
  readonly view: boolean
}) {
  const [actionError, setActionError] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [reviewMode, setReviewMode] = useState(false)
  const [reviewConfirming, setReviewConfirming] = useState(false)
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [reviewError, setReviewError] = useState<string | null>(null)
  const sessionRunning = props.useSessions(snapshot => (
    snapshot.byId[sessionId as keyof typeof snapshot.byId]?.running ?? false
  ))
  const previousSessionRunning = useRef(sessionRunning)
  const stageState = props.useStageProgress(snapshot => snapshot.byWorkspace[workspace.workspaceId])
  const surfaceState = props.useProjectSurfaces(snapshot => snapshot.byWorkspace[workspace.workspaceId])
  const sourceState = props.useProjectSources(snapshot => snapshot.byWorkspace[workspace.workspaceId])
  const selectedStage = props.useStageView(snapshot => snapshot.byWorkspace[workspace.workspaceId])
  const loadActions = useRef({
    loadStage: props.loadStage,
    refreshProjectSurface: props.refreshProjectSurface,
    loadProjectSources: props.loadProjectSources,
  })

  useEffect(() => {
    loadActions.current.loadStage(workspace.workspaceId)
    loadActions.current.refreshProjectSurface(workspace.workspaceId)
    loadActions.current.loadProjectSources(workspace.workspaceId, true)
  }, [workspace.workspaceId])

  useEffect(() => {
    if (previousSessionRunning.current && !sessionRunning) {
      loadActions.current.refreshProjectSurface(workspace.workspaceId)
      loadActions.current.loadProjectSources(workspace.workspaceId, true)
    }
    previousSessionRunning.current = sessionRunning
  }, [sessionRunning, workspace.workspaceId])

  const files = sourceState?.files ?? []
  const surface = surfaceState?.status === 'ready' ? surfaceState.value : undefined
  const v2Stage = stageState?.status === 'ready'
    ? (stageState.value.v2Stage ?? (['discovery', 'definition', 'investigation', 'design', 'evaluation', 'pilot', 'production', 'improvement'] as const)[LEGACY_TO_V2_STAGE[stageState.value.currentStage]])
    : undefined
  const viewedStage = selectedStage ?? v2Stage
  const discovery = surface?.discovery
  const artifacts: readonly DiscoveryArtifact[] = discovery?.artifacts ?? fallbackArtifacts(surface)
  const requiredArtifacts = artifacts.filter(artifact => artifact.required)
  const presentCount = discovery?.presentCount ?? requiredArtifacts.filter(artifact => artifact.status === 'present').length
  const reviewReady = discovery?.reviewReady ?? presentCount === requiredArtifacts.length
  const hasEngagementReframe = artifacts.some(artifact => artifact.id === 'engagement-reframe' && artifact.status === 'present')
  const fallbackWorkIndex = Math.min(FALLBACK_WORK.length - 1, Math.max(0, presentCount))
  const fallbackWork = FALLBACK_WORK[fallbackWorkIndex]!
  const currentWorkId = discovery?.currentWorkId ?? fallbackWork.id
  const workItems = discovery?.workItems ?? FALLBACK_WORK.map((item, index) => ({
    ...item,
    status: reviewReady || index < fallbackWorkIndex ? 'complete' as const : index === fallbackWorkIndex ? 'current' as const : 'waiting' as const,
  }))
  const currentWork = workItems.find(item => item.id === currentWorkId) ?? workItems[0] ?? fallbackWork
  const currentWorkIndex = Math.max(0, workItems.findIndex(item => item.id === currentWorkId))
  const workflowCatalog = discovery?.workflows ?? {
    path: '.fde/discovery/workflows.json' as const,
    status: 'missing' as const,
    items: [],
  }
  const selectedWorkflow = workflowCatalog.items.find(item => item.id === workflowCatalog.selectedWorkflowId)
    ?? workflowCatalog.items.find(item => item.disposition === 'selected')
    ?? workflowCatalog.items[0]
  const workflowEvidence = selectedWorkflow?.evidence ?? { confirmed: 0, inferred: 0, unverified: 0 }
  const artifactEvidenceCount = artifacts.reduce((total, artifact) => total + (artifact.evidenceRefs?.length ?? 0), 0)
  const artifactCatalogError = artifacts.find(artifact => artifact.message?.includes('Artifact Catalog 无效'))?.message

  const openFile = (relativePath: string, title: string): void => {
    setFileError(null)
    void props.openProjectFile(sessionId, workspace.path, relativePath, title).catch((error: unknown) => {
      setFileError(error instanceof Error ? error.message : String(error))
    })
  }

  const prepareDraft = (action: DiscoveryAction, sourcePaths: readonly string[] = []): void => {
    setActionError(null)
    try {
      props.prepareDiscoveryDraft(sessionId, action, sourcePaths)
    } catch (error: unknown) {
      setActionError(error instanceof Error ? error.message : String(error))
    }
  }

  const continueAfterReview = (action: DiscoveryAction): void => {
    setReviewMode(false)
    setReviewConfirming(false)
    setReviewError(null)
    prepareDraft(action)
  }

  const advanceStage = async (): Promise<void> => {
    if (stageState?.status !== 'ready') {
      setReviewError('当前阶段状态尚未读取完成，请稍后重试。')
      return
    }
    setReviewError(null)
    setReviewSubmitting(true)
    try {
      await props.completeRequirements(workspace.workspaceId, stageState.value.revision)
      setReviewMode(false)
      setReviewConfirming(false)
    } catch (error: unknown) {
      setReviewError(error instanceof Error ? error.message : String(error))
    } finally {
      setReviewSubmitting(false)
    }
  }

  const discoveryActions = () => {
    if (artifactCatalogError !== undefined) {
      return <button type="button" className={css.primaryButton} onClick={() => { prepareDraft('repair-stage-records') }}>修复阶段记录</button>
    }
    if (reviewReady) {
      return <>
        <button type="button" className={css.primaryButton} data-stage-review-action="" onClick={() => { setReviewError(null); setReviewConfirming(false); setReviewMode(true) }}>提交 FDE 评审</button>
        <button type="button" className={css.secondaryButton} onClick={() => { prepareDraft('form-conclusion') }}>继续核对未确认事项</button>
        {hasEngagementReframe && <button type="button" className={css.tertiaryButton} onClick={() => { prepareDraft('reframe-engagement') }}>继续核对范围冲突</button>}
      </>
    }
    if (currentWorkId === 'restore-workflow') {
      return <>
        <button type="button" className={css.primaryButton} onClick={() => { prepareDraft('restore-workflow', files.map(file => file.relativePath)) }}>继续还原实际流程</button>
        <button type="button" className={css.secondaryButton} onClick={() => { prepareDraft('prepare-interview') }}>补充流程访谈</button>
        {hasEngagementReframe && <button type="button" className={css.tertiaryButton} onClick={() => { prepareDraft('reframe-engagement') }}>继续核对范围冲突</button>}
      </>
    }
    if (currentWorkId === 'qualify-value') {
      return <>
        <button type="button" className={css.primaryButton} onClick={() => { prepareDraft('qualify-value') }}>核对问题价值与责任</button>
        {hasEngagementReframe && <button type="button" className={css.secondaryButton} onClick={() => { prepareDraft('reframe-engagement') }}>核对冲突并调整候选边界</button>}
      </>
    }
    if (currentWorkId === 'form-conclusion') {
      return <>
        <button type="button" className={css.primaryButton} onClick={() => { prepareDraft('form-conclusion') }}>整理阶段候选结论</button>
        {hasEngagementReframe && <button type="button" className={css.secondaryButton} onClick={() => { prepareDraft('reframe-engagement') }}>继续处理未决范围冲突</button>}
      </>
    }
    return <>
      <button type="button" className={css.primaryButton} onClick={() => { prepareDraft('prepare-interview') }}>开始梳理真实流程</button>
      {files.length > 0 && <button type="button" className={css.secondaryButton} onClick={() => { prepareDraft('qualify-workflow', files.map(file => file.relativePath)) }}>{`根据客户资料开始梳理（${String(files.length)}）`}</button>}
      {hasEngagementReframe && <button type="button" className={css.tertiaryButton} onClick={() => { prepareDraft('reframe-engagement') }}>继续核对范围冲突</button>}
    </>
  }

  if (stageState?.status === 'error') {
    return <section className={css.state} role="alert"><strong>当前阶段读取失败</strong><span>{stageState.message}</span></section>
  }

  if ((viewedStage === 'evaluation' || viewedStage === 'pilot' || viewedStage === 'production' || viewedStage === 'improvement') && surfaceState?.status === 'error') {
    return <section className={css.state} role="alert"><strong>{viewedStage === 'evaluation' ? '第五阶段记录读取失败' : '交付阶段记录读取失败'}</strong><span>{surfaceState.message}</span><button type="button" onClick={() => { props.refreshProjectSurface(workspace.workspaceId) }}>重新读取阶段记录</button></section>
  }

  if (v2Stage !== undefined && (viewedStage === 'pilot' || viewedStage === 'production' || viewedStage === 'improvement') && stageState?.status === 'ready') {
    return <DeliveryStagePanel
      key={`${workspace.workspaceId}-${viewedStage}-${v2Stage}`}
      props={props} workspace={workspace} sessionId={sessionId} view={view}
      stage={viewedStage} actualStage={v2Stage} stageState={stageState.value}
      surface={surface?.v2Stages[viewedStage]}
    />
  }

  if (v2Stage !== undefined && viewedStage !== undefined && viewedStage !== v2Stage) {
    const historicalInvestigation = viewedStage === 'investigation'
      && FDE_V2_STAGE_IDS.indexOf(viewedStage) < FDE_V2_STAGE_IDS.indexOf(v2Stage)
    if (historicalInvestigation && stageState?.status === 'ready') {
      return <InvestigationStagePanel
        props={props} workspace={workspace} sessionId={sessionId} view={view}
        stageState={stageState.value} surface={surface?.v2Stages.investigation}
        historicalActualStage={v2Stage}
      />
    }
    const historicalDesign = viewedStage === 'design'
      && FDE_V2_STAGE_IDS.indexOf(viewedStage) < FDE_V2_STAGE_IDS.indexOf(v2Stage)
    if (historicalDesign && stageState?.status === 'ready') {
      return <DesignStagePanel
        props={props} workspace={workspace} sessionId={sessionId} view={view}
        stageState={stageState.value} surface={surface?.v2Stages.design}
        projectSurface={surface} sourceFiles={files}
        historicalActualStage={v2Stage}
      />
    }
    const historicalLaterStage = viewedStage !== 'discovery'
      && viewedStage !== 'investigation'
      && viewedStage !== 'design'
      && FDE_V2_STAGE_IDS.indexOf(viewedStage) < FDE_V2_STAGE_IDS.indexOf(v2Stage)
    const historicalLaterSurface = viewedStage === 'discovery' || viewedStage === 'investigation' || viewedStage === 'design'
      ? undefined
      : surface?.v2Stages[viewedStage as V2LifecycleStageId]
    const hasDedicatedHistoricalSurface = Array.isArray(historicalLaterSurface?.workItems)
      && Array.isArray(historicalLaterSurface?.artifacts)
    if (historicalLaterStage && hasDedicatedHistoricalSurface && stageState?.status === 'ready') {
      if (viewedStage === 'evaluation') return <EvaluationWorkbench
        key={`${workspace.workspaceId}-evaluation-history`}
        props={props} workspace={workspace} sessionId={sessionId} view={view}
        stageState={stageState.value} surface={historicalLaterSurface}
        projectSurface={surface} sourceFiles={files} historicalActualStage={v2Stage}
      />
      return <LaterStagePanel
        props={props} workspace={workspace} sessionId={sessionId} view={view}
        stageState={stageState.value} stage={viewedStage}
        surface={historicalLaterSurface}
        projectSurface={surface} sourceFiles={files}
        historicalActualStage={v2Stage}
      />
    }
    return <BrowsedStagePanel
      props={props} workspace={workspace} sessionId={sessionId} view={view}
      actualStage={v2Stage} viewedStage={viewedStage} surface={surface} sourceFiles={files}
    />
  }

  if (v2Stage !== undefined && v2Stage !== 'discovery' && stageState?.status === 'ready') {
    if (v2Stage === 'investigation') {
      return <InvestigationStagePanel
        props={props} workspace={workspace} sessionId={sessionId} view={view}
        stageState={stageState.value} surface={surface?.v2Stages.investigation}
      />
    }
    if (v2Stage === 'design') {
      return <DesignStagePanel
        props={props} workspace={workspace} sessionId={sessionId} view={view}
        stageState={stageState.value} surface={surface?.v2Stages.design}
        projectSurface={surface} sourceFiles={files}
      />
    }
    if (v2Stage === 'evaluation') return <EvaluationWorkbench
      key={`${workspace.workspaceId}-evaluation`}
      props={props} workspace={workspace} sessionId={sessionId} view={view}
      stageState={stageState.value} surface={surface?.v2Stages.evaluation}
      projectSurface={surface} sourceFiles={files}
    />
    return <LaterStagePanel
      props={props} workspace={workspace} sessionId={sessionId} view={view}
      stageState={stageState.value} stage={v2Stage}
      surface={surface?.v2Stages[v2Stage as V2LifecycleStageId]}
      projectSurface={surface} sourceFiles={files}
    />
  }

  const sourceError = sourceState?.status === 'error' ? sourceState.message : null
  const surfaceError = surfaceState?.status === 'error' ? surfaceState.message : null

  if (reviewMode) {
    return (
      <section
        className={`${css.root} ${css.reviewRoot}`}
        data-stage-review-mode=""
        data-conversation-composer-overlay={view ? '' : undefined}
        aria-label="第一阶段 FDE 评审"
      >
        <header className={css.reviewHeader}>
          <button type="button" className={css.tertiaryButton} onClick={() => { setReviewMode(false); setReviewConfirming(false) }}>← 返回阶段工作台</button>
          <div><span>第一阶段 · FDE 评审</span><h1>确认我们是否找对了要解决的问题</h1><p>先核对业务流程、客户资料和未确认事实。提交评审不等于进入下一阶段，最终决定由你作出。</p></div>
          <b>{presentCount}/{requiredArtifacts.length} 项必备记录已整理</b>
        </header>

        <div className={css.reviewGrid}>
          <main>
            <section className={css.reviewWorkflow}>
              <header>
                <div><span>本次评审对象</span><h2>{selectedWorkflow?.title ?? '尚未形成可评审的业务流程'}</h2></div>
                <b>{selectedWorkflow === undefined ? '待补充' : workflowDisposition(selectedWorkflow.disposition)}</b>
              </header>
              {selectedWorkflow === undefined
                ? <p>请返回第一阶段继续还原客户的真实工作流程。</p>
                : <>
                  <p>{selectedWorkflow.problem}</p>
                  <dl>
                    <div><dt>实际由谁处理</dt><dd>{selectedWorkflow.actor}</dd></div>
                    <div><dt>什么时候发生</dt><dd>{selectedWorkflow.trigger}</dd></div>
                  </dl>
                </>}
            </section>

            <section className={css.reviewMetrics} aria-label="评审依据概览">
              <article><span>客户原始资料</span><strong>{files.length}</strong><small>份已归档资料</small></article>
              <article><span>已确认事实</span><strong>{workflowEvidence.confirmed}</strong><small>有明确来源</small></article>
              <article><span>仍待核对</span><strong>{workflowEvidence.unverified}</strong><small>不能当作事实</small></article>
              <article><span>记录证据引用</span><strong>{artifactEvidenceCount}</strong><small>可回到原始依据</small></article>
            </section>

            <section className={css.reviewChecklist}>
              <header><span>请逐项作出人工判断</span><h2>进入下一阶段前，确认下面五件事</h2></header>
              <ol>
                <li><i>1</i><span><strong>实际工作流程已经说清楚</strong><small>谁来做、什么时候开始、经过哪些步骤、问题发生在哪里。</small></span><b>待 FDE 核对</b></li>
                <li><i>2</i><span><strong>事实有来源，未知项没有被当成结论</strong><small>客户资料、访谈和现场观察能够追溯，推断与待确认事项已标明。</small></span><b>待 FDE 核对</b></li>
                <li><i>3</i><span><strong>问题确实值得继续投入</strong><small>业务影响、预期结果以及由谁判断结果已经能够支撑下一步。</small></span><b>待 FDE 核对</b></li>
                <li><i>4</i><span><strong>范围、责任人和停止条件清楚</strong><small>知道本次先做什么、不做什么，遇到什么情况应暂停或调整。</small></span><b>待 FDE 核对</b></li>
                <li><i>5</i><span><strong>重大说法冲突已经处理</strong><small>{hasEngagementReframe ? '已形成项目调整记录，请核对调整依据和决定人。' : '当前未形成项目调整记录；如事实改变原范围，应先返回处理。'}</small></span><b>待 FDE 核对</b></li>
              </ol>
            </section>

            <section className={css.reviewDecision}>
              <header><span>你的决定</span><h2>接下来怎么处理这个问题？</h2><p>只有“进入下一阶段”会改变项目阶段，其他操作都会留在当前阶段继续完善。</p></header>
              {!reviewConfirming
                ? <div className={css.reviewDecisionActions}>
                  <button type="button" className={css.primaryButton} onClick={() => { setReviewConfirming(true) }}>进入下一阶段</button>
                  <button type="button" className={css.secondaryButton} onClick={() => { continueAfterReview('prepare-interview') }}>继续补充调查</button>
                  <button type="button" className={css.secondaryButton} onClick={() => { continueAfterReview('narrow-workflow') }}>缩小问题范围</button>
                  <button type="button" className={css.tertiaryButton} onClick={() => { continueAfterReview('pause-workflow') }}>暂停这个问题</button>
                </div>
                : <div className={css.reviewConfirmation} data-stage-review-confirmation="">
                  <div><strong>确认进入“定义结果、范围与责任”阶段？</strong><small>当前评审对象：{selectedWorkflow?.title ?? '未命名业务流程'}。进入后仍可返回第一阶段补充资料，但本次人工决定会写入项目阶段记录。</small></div>
                  <div><button type="button" className={css.secondaryButton} disabled={reviewSubmitting} onClick={() => { setReviewConfirming(false) }}>返回核对</button><button type="button" className={css.primaryButton} disabled={reviewSubmitting} onClick={() => { void advanceStage() }}>{reviewSubmitting ? '正在提交…' : '确认并进入下一阶段'}</button></div>
                </div>}
              {reviewError !== null && <p className={css.inlineError} role="alert">{reviewError}</p>}
            </section>
          </main>

          <aside className={css.reviewEvidence}>
            <header><span>评审材料</span><h2>回到依据逐项核对</h2><p>文件存在只表示形成了候选记录，不代表客户已经确认。</p></header>
            <section><div><strong>客户原始资料</strong><b>{files.length} 份</b></div>{files.length === 0 ? <p>本阶段没有归档客户资料。</p> : files.map(file => <button key={file.sourceId} type="button" onClick={() => { openFile(file.relativePath, file.originalName) }}><span><strong>{file.originalName}</strong><small>{sourceStatus(file)}</small></span><em>预览</em></button>)}</section>
            <section><div><strong>阶段记录</strong><b>{presentCount}/{requiredArtifacts.length}</b></div>{artifacts.map(artifact => <button key={artifact.id} type="button" disabled={artifact.status !== 'present'} onClick={() => { openFile(artifact.path, artifactDisplayTitle(artifact)) }}><span><strong>{artifactDisplayTitle(artifact)}</strong><small>{artifactStatus(artifact)}</small></span><em>{artifact.status === 'present' ? '预览' : '待补充'}</em></button>)}</section>
            {fileError !== null && <p className={css.inlineError} role="alert">{fileError}</p>}
          </aside>
        </div>
      </section>
    )
  }

  return (
    <section
      className={`${css.root} ${css.browsedStage} ${css.currentDiscoveryStage}`}
      data-conversation-hero-project=""
      data-fde-stage-workbench=""
      data-stage="discovery"
      data-conversation-composer-layout="stage-execution"
      data-conversation-composer-overlay={view ? '' : undefined}
      data-artifacts-collapsed="true"
      aria-label="项目阶段工作台：发现高价值问题"
    >
      <section className={css.browsedStageGoal} data-stage-goal="">
        <div className={css.historicalGoalCopy}>
          <span>第 1/8 阶段 · 进行中</span><h1 data-stage-title="">发现高价值问题</h1>
          <p>结合客户资料和真实案例还原现状，保留未确认事实，由 FDE 判断是否值得继续投入。</p>
          <div className={css.historicalGoalFacts}>
            <span><HistoricalFactIcon type="input" />{files.length} 份输入材料</span>
            <span><HistoricalFactIcon type="record" />{presentCount}/{requiredArtifacts.length} 份必备记录</span>
            <span><HistoricalFactIcon type="gate" />{reviewReady ? '等待提交阶段评审' : '尚未进入阶段评审'}</span>
          </div>
        </div>
        <div className={css.historicalCompletionRing} data-stage-ring="" data-complete="false" aria-label="当前处于第 1/8 阶段">
          <strong>1<small>/8</small></strong><span>进行中</span><i>{currentWorkIndex + 1}</i>
        </div>
        <div className={css.historicalGoalArt} data-stage-art="" aria-hidden="true"><img src="/fde-dashboard/stage-evidence-stack-3d.webp" alt="" /></div>
        <div className={css.historicalArchiveNote} data-stage-art-note="">◷ 当前记录持续更新 · 待 FDE 确认</div>
      </section>

      <section className={css.historicalEvidenceChain} data-evidence-chain="" data-active-stage="">
        <header className={css.historicalEvidenceHeader}>
          <div><span>当前工作 · 第 {String(currentWorkIndex + 1)}/{String(workItems.length)} 步</span><h2 data-evidence-title="">{artifactCatalogError !== undefined ? '修复无效的阶段记录' : reviewReady ? '核对已经整理的记录' : currentWorkIndex === 0 ? '从一个最近发生的案例开始' : (FALLBACK_WORK[currentWorkIndex]?.title ?? currentWork.title)}</h2><p>{artifactCatalogError ?? (reviewReady ? '候选记录已经齐备，请回到依据逐项核对后再作出人工决定。' : (FALLBACK_WORK[currentWorkIndex]?.purpose ?? currentWork.purpose))}</p></div>
          <div className={css.historicalEvidenceDirection} aria-hidden="true"><strong>01</strong><i /><strong>03</strong></div>
        </header>
        <div className={css.historicalStageGrid}>
          <section data-evidence-input="">
            <header className={css.historicalColumnHeader}><div><span>阶段输入</span><h2>现在依据了什么</h2></div><b>{files.length} 份材料</b></header>
            {files.length > 0 && <span className={css.evidenceGroupLabel}>客户提供</span>}
            <ul className={css.historicalFactList}>{files.map(source => <li key={source.sourceId} data-evidence-row="" data-source-row="">
              <EvidenceDocumentIcon /><span><strong data-evidence-row-title="">{source.originalName}</strong><small>{sourceStatus(source)} · {formatSourceBytes(source.bytes)}</small></span>
              <button type="button" aria-label={`预览客户资料：${source.originalName}`} onClick={() => { openFile(source.relativePath, source.originalName) }}>预览</button>
            </li>)}</ul>
            {files.length === 0 && <p className={css.unregisteredFact}>尚未登记客户资料，可直接从真实案例开始。</p>}
          </section>
          <section data-evidence-output="">
            <header className={css.historicalColumnHeader}><div><span>阶段输出</span><h2>正在形成什么</h2></div><b>{presentCount}/{requiredArtifacts.length} 份记录</b></header>
            <ul className={css.historicalFactList}>{artifacts.map(artifact => <li key={artifact.id} data-evidence-row="" data-status={artifact.status}>
              <EvidenceDocumentIcon /><i className={css.evidenceStateDot} data-status={artifact.status} aria-hidden="true" />
              <span><strong data-evidence-row-title="">{artifactDisplayTitle(artifact)}</strong><small>{artifactStatus(artifact)} · {artifactGap(artifact)}</small></span>
              {artifact.status === 'present' && <button type="button" aria-label={`预览阶段记录：${artifactDisplayTitle(artifact)}`} onClick={() => { openFile(artifact.path, artifactDisplayTitle(artifact)) }}>预览</button>}
            </li>)}</ul>
          </section>
          <section data-evidence-decision="">
            <header><span>人工结论</span><h2>接下来如何决定</h2></header>
            <div className={css.historicalDecision} data-ready={reviewReady ? 'true' : undefined}><EvidenceShieldIcon ready={reviewReady} /><span><strong>{artifactCatalogError !== undefined ? '阶段记录未通过校验' : reviewReady ? '候选材料已齐备' : '等待 FDE 完成本阶段判断'}</strong><small>{artifactCatalogError !== undefined ? '先按提示修正阶段记录格式，再继续评审。' : reviewReady ? '核对记录后可提交阶段评审。' : '继续补齐事实与阶段记录。'}</small></span></div>
            <dl><dt>当前工作</dt><dd>{FALLBACK_WORK[currentWorkIndex]?.title ?? currentWork.title}</dd><dt>待确认流程</dt><dd>{selectedWorkflow?.title ?? `${String(workflowCatalog.items.length)} 项`}</dd><dt>事实状态</dt><dd>已确认 {workflowEvidence.confirmed} · 待核对 {workflowEvidence.unverified}</dd><dt>待解决问题</dt><dd>{(discovery?.blockers ?? []).length} 项</dd></dl>
          </section>
        </div>
        <ol className={css.historicalMilestones} data-stage-milestones="" aria-label="第一阶段工作路径">
          {workItems.map((item, index) => {
            const display = FALLBACK_WORK[index] ?? item
            return <li key={item.id} data-status={item.status}><i>{item.status === 'complete' ? '✓' : index + 1}</i><span>{display.title}</span></li>
          })}
          <li data-status={reviewReady ? 'current' : 'waiting'}><i>5</i><span>FDE 阶段评审</span></li>
        </ol>
        <footer className={css.historicalArchiveFooter}>
          <span><HistoricalArchiveIcon />当前阶段记录会随对话与资料持续更新。</span>
          <div className={css.activeStageActions}>
            {discoveryActions()}
          </div>
        </footer>
      </section>
      {workflowCatalog.status === 'invalid' && <p className={css.inlineError} role="alert">业务流程记录读取失败：{workflowCatalog.message ?? '文件结构无效。'}</p>}
      {actionError !== null && <p className={css.inlineError} role="alert">{actionError}</p>}
      {sourceError !== null && <p className={css.inlineError} role="alert">项目资料读取失败：{sourceError}</p>}
      {surfaceError !== null && <p className={css.inlineError} role="alert">阶段记录读取失败：{surfaceError}</p>}
      {fileError !== null && <p className={css.inlineError} role="alert">{fileError}</p>}
    </section>
  )
}

/** Replace the generic blank-session hero only for an actual project. */
export function ProjectStageWorkbenchHero(props: ProjectStageWorkbenchHeroProps) {
  useEffect(() => { props.activateProjectWorkbenchLayout?.() }, [props.activateProjectWorkbenchLayout])
  const enteredProject = props.resolveEnteredProject()
  const sessionId = props.sessionId === undefined ? enteredProject?.sessionId : String(props.sessionId)
  if (sessionId === undefined) return <>{props.defaultContent}</>
  const workspace = props.workspace === undefined
    ? props.resolveProjectWorkspace(sessionId) ?? enteredProject
    : { workspaceId: String(props.workspace.workspaceId), title: props.workspace.title, path: props.workspace.path }
  if (workspace === undefined) return <>{props.defaultContent}</>
  return <StageWorkbenchPanel props={props} sessionId={sessionId} workspace={workspace} view={false} />
}

/** Keep the same stage guidance available after the project Session has history. */
export function ProjectStageWorkbenchView(props: ProjectStageWorkbenchViewProps) {
  const listedWorkspace = props.useWorkspaces(state => state.items.find(item => item.sessionIds.includes(props.sessionId)))
  const workspace = listedWorkspace === undefined
    ? props.resolveProjectWorkspace(String(props.sessionId))
    : { workspaceId: String(listedWorkspace.workspaceId), title: listedWorkspace.title, path: listedWorkspace.path }
  useEffect(() => { props.activateProjectWorkbenchLayout?.() }, [props.activateProjectWorkbenchLayout])
  if (workspace === undefined) return <div className={css.state}>当前会话未关联项目。</div>
  return <StageWorkbenchPanel props={props} sessionId={String(props.sessionId)} workspace={workspace} view />
}
