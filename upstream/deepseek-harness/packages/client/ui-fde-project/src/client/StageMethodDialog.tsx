/** Structured, Chinese-first reader for one registered stage method. */

import { MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives'
import { useState, type ReactNode } from 'react'
import { resolveSkillFile } from './skills-center-data.ts'
import type {
  StageSkillCatalogAnswerGroup, StageSkillCatalogArtifact, StageSkillCatalogMethod, StageSkillCatalogReference,
} from './stage-skill-catalog.ts'
import css from './StageMethodDialog.module.css'

type MethodTab = 'overview' | 'orchestration' | 'example' | 'references' | 'definition'
type MethodRole = 'core' | 'conditional' | 'engineering' | 'required'

interface StageMethodDialogProps {
  readonly method: StageSkillCatalogMethod
  readonly methods: readonly StageSkillCatalogMethod[]
  readonly stageIndex: number
  readonly onClose: () => void
  readonly onSelectMethod: (method: StageSkillCatalogMethod) => void
}

function methodRole(method: StageSkillCatalogMethod): MethodRole {
  if (method.role === 'core') return 'core'
  if (method.role === 'conditional' || method.group === 'conditional') return 'conditional'
  if (method.role === 'engineering') return 'engineering'
  return 'required'
}

function roleLabel(method: StageSkillCatalogMethod): string {
  const role = methodRole(method)
  if (role === 'core') return '核心方法'
  if (role === 'conditional') return '条件方法'
  if (role === 'engineering') return '工程能力'
  return '必做方法'
}

function rolePurpose(role: MethodRole): string {
  if (role === 'core') return '判断是否继续投入'
  if (role === 'conditional') return '形成边界调整候选'
  if (role === 'engineering') return '补齐阶段证据'
  return '完成本阶段必要工作'
}

function sourceParts(source: string): { readonly repository: string; readonly commit?: string } {
  const separator = source.lastIndexOf('@')
  return separator < 0
    ? { repository: source }
    : { repository: source.slice(0, separator), commit: source.slice(separator + 1) }
}

function referenceAction(reference: StageSkillCatalogReference): string {
  if (reference.kind === 'json') return '查看结构'
  if (reference.kind === 'pattern') return '浏览模式'
  if (reference.kind === 'catalog') return '查看控制项'
  return '阅读原文'
}

function fallbackAnswerGroups(answers: readonly string[]): readonly StageSkillCatalogAnswerGroup[] {
  if (answers.length <= 2) return [{ label: '阶段判断', tone: 'identity', answers }]
  return [
    { label: '事实与责任', tone: 'identity', answers: answers.slice(0, 2) },
    { label: '流程与证据', tone: 'flow', answers: answers.slice(2, 4) },
    { label: '收益与停止条件', tone: 'value', answers: answers.slice(4) },
  ].filter(group => group.answers.length > 0) as readonly StageSkillCatalogAnswerGroup[]
}

function MethodHeroIllustration() {
  return <svg className={css.heroIllustration} viewBox="0 0 390 246" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="method-hero-edge" x1="64" y1="36" x2="321" y2="217" gradientUnits="userSpaceOnUse">
        <stop stopColor="#587EFF" /><stop offset="1" stopColor="#2954D8" />
      </linearGradient>
      <linearGradient id="method-hero-surface" x1="127" y1="56" x2="274" y2="200" gradientUnits="userSpaceOnUse">
        <stop stopColor="#142E78" stopOpacity=".9" /><stop offset="1" stopColor="#071B4E" stopOpacity=".4" />
      </linearGradient>
      <filter id="method-hero-glow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="5" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
    </defs>
    <g opacity=".52" stroke="#4267D2">
      <path d="M12 180 126 116 378 169" /><path d="M0 205 131 131 371 181" /><path d="M61 224 168 165 363 201" />
      <path d="M37 78 112 35 244 55M287 51l70 38" strokeDasharray="4 7" />
    </g>
    <g stroke="url(#method-hero-edge)" strokeWidth="1.6" strokeLinejoin="round">
      <path d="m90 159 122-70 91 49-122 72-91-51Z" fill="url(#method-hero-surface)" />
      <path d="m90 159v18l91 51 122-72v-18" fill="#07163F" fillOpacity=".54" />
      <path d="m112 137 100-58 72 39-101 59-71-40Z" fill="url(#method-hero-surface)" />
      <path d="m112 137v17l71 40 101-59v-17" fill="#091A4B" fillOpacity=".7" />
      <path d="m134 115 79-46 53 29-80 47-52-30Z" fill="url(#method-hero-surface)" />
      <path d="m134 115v16l52 30 80-47V98" fill="#0A1F5D" fillOpacity=".72" />
      <path d="m158 91 55-32 34 19-55 32-34-19Z" fill="#0C215E" fillOpacity=".78" />
      <path d="m158 91v15l34 19 55-32V78" fill="#07153D" fillOpacity=".72" />
    </g>
    <g stroke="#668BFF" strokeWidth="2" strokeLinecap="round">
      <path d="m183 83 30-17 8 4-30 18-8-5ZM172 94l50-29M199 99l37-22" />
    </g>
    <g transform="translate(255 147)" filter="url(#method-hero-glow)">
      <path d="m0 16 34-16 34 16v39c0 25-15 40-34 50C15 95 0 80 0 55V16Z" fill="#0B1D57" stroke="#678BFF" strokeWidth="2" />
      <path d="m13 24 21-10 21 10v28c0 17-10 28-21 35-12-7-21-18-21-35V24Z" fill="#102969" stroke="#426DF0" />
      <path d="m23 49 8 8 17-20" stroke="#86A3FF" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </g>
    <g fill="#6990FF"><circle cx="74" cy="69" r="2.5" /><circle cx="97" cy="49" r="1.5" /><circle cx="317" cy="74" r="2" /><circle cx="337" cy="103" r="1.5" /></g>
  </svg>
}

function UsageIcon() {
  return <svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><circle cx="24" cy="24" r="16" /><circle cx="24" cy="24" r="9" /><circle cx="24" cy="24" r="3" /><path d="m29 19 9-9m0 0v7m0-7h-7" /></svg>
}

function GroupIcon({ tone }: { readonly tone: StageSkillCatalogAnswerGroup['tone'] }) {
  if (tone === 'flow') return <svg viewBox="0 0 28 28" fill="none" aria-hidden="true"><circle cx="7" cy="7" r="3" /><circle cx="21" cy="7" r="3" /><circle cx="7" cy="21" r="3" /><circle cx="21" cy="21" r="3" /><path d="M10 7h8M7 10v8M21 10v8M10 21h8" /></svg>
  if (tone === 'value') return <svg viewBox="0 0 28 28" fill="none" aria-hidden="true"><path d="m14 3 9 4v6c0 6-3.8 10.3-9 12-5.2-1.7-9-6-9-12V7l9-4Z" /><path d="m11 14 2 2 4-5" /></svg>
  return <svg viewBox="0 0 28 28" fill="none" aria-hidden="true"><circle cx="14" cy="8" r="4" /><path d="M7 23v-3a7 7 0 0 1 14 0v3M5 13h4M19 13h4" /><circle cx="4" cy="13" r="2" /><circle cx="24" cy="13" r="2" /></svg>
}

function DecisionIcon() {
  return <svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="m24 4 17 8v11c0 11-6.8 18.2-17 22-10.2-3.8-17-11-17-22V12l17-8Z" /><circle cx="24" cy="21" r="6" /><path d="M14 37c1.8-5 5-7.4 10-7.4S32.2 32 34 37" /></svg>
}

function ArtifactIcon() {
  return <svg viewBox="0 0 28 28" fill="none" aria-hidden="true"><path d="M7 3h10l5 5v17H7V3Z" /><path d="M17 3v6h5M10 14h9M10 18h9M10 22h6" /></svg>
}

function ReferenceIcon({ kind }: { readonly kind: StageSkillCatalogReference['kind'] }) {
  return <svg className={css.methodReferenceIcon} data-kind={kind} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    {kind === 'markdown' && <><path d="M5 3.5h9l5 5v12H5z" /><path d="M14 3.5v5h5M8 13h8M8 16h6" /></>}
    {kind === 'json' && <><path d="M9 4H7.5A2.5 2.5 0 0 0 5 6.5V9a2 2 0 0 1-2 2 2 2 0 0 1 2 2v4.5A2.5 2.5 0 0 0 7.5 20H9M15 4h1.5A2.5 2.5 0 0 1 19 6.5V9a2 2 0 0 0 2 2 2 0 0 0-2 2v4.5a2.5 2.5 0 0 1-2.5 2.5H15" /></>}
    {kind === 'pattern' && <><rect x="3.5" y="4" width="7" height="7" rx="1.5" /><rect x="13.5" y="4" width="7" height="7" rx="1.5" /><rect x="8.5" y="14" width="7" height="7" rx="1.5" /><path d="M7 11v2h5M17 11v2h-5" /></>}
    {kind === 'catalog' && <><path d="M4 5.5h16M4 12h16M4 18.5h16" /><circle cx="7" cy="5.5" r="1.5" /><circle cx="15" cy="12" r="1.5" /><circle cx="10" cy="18.5" r="1.5" /></>}
  </svg>
}

function TimelineSection({ number, eyebrow, title, subtitle, titleMarker, children }: {
  readonly number: string
  readonly eyebrow: string
  readonly title: string
  readonly subtitle?: string
  readonly titleMarker?: boolean
  readonly children: ReactNode
}) {
  return <section className={css.timelineSection}>
    <div className={css.timelineMarker}><span>{number}</span></div>
    <div className={css.timelineContent}>
      <header className={css.timelineHeading}>
        <span>{number} · {eyebrow}</span>
        <h3 {...titleMarker ? { 'data-method-section-title': '' } : {}}>{title}</h3>
        {subtitle !== undefined && <p>{subtitle}</p>}
      </header>
      {children}
    </div>
  </section>
}

function UsageSection({ method, stageIndex, role }: {
  readonly method: StageSkillCatalogMethod
  readonly stageIndex: number
  readonly role: MethodRole
}) {
  return <TimelineSection number="01" eyebrow="适用时机" title="什么时候会用" titleMarker>
    <div className={css.usageCallout} data-method-usage="">
      <UsageIcon />
      <p>{method.whenToUse}</p>
      <div><span>阶段：第 {String(stageIndex + 1)} 阶段</span><span>目的：{rolePurpose(role)}</span></div>
    </div>
  </TimelineSection>
}

function ArtifactGroup({ label, artifacts, required = false, onInspect }: {
  readonly label: string
  readonly artifacts: readonly StageSkillCatalogArtifact[]
  readonly required?: boolean
  readonly onInspect: () => void
}) {
  return <section className={css.artifactGroup} data-required={required ? 'true' : undefined} aria-label={label}>
    <header><span aria-hidden="true">●</span><strong>{label}</strong></header>
    <div>{artifacts.map(artifact => <article key={artifact.path} data-method-artifact="">
      <ArtifactIcon />
      <div><span><strong>{artifact.label}</strong><b>{artifact.required ? '必备' : '按需'}</b></span><p>{artifact.purpose}</p><code>{artifact.path}</code><button type="button" onClick={onInspect}>查看结构 →</button></div>
    </article>)}</div>
  </section>
}

function CoreOverview({ method, stageIndex, onInspectArtifact }: {
  readonly method: StageSkillCatalogMethod
  readonly stageIndex: number
  readonly onInspectArtifact: () => void
}) {
  const answerGroups = method.answerGroups ?? fallbackAnswerGroups(method.answers ?? [])
  const requiredArtifacts = method.artifacts?.filter(artifact => artifact.required) ?? []
  const optionalArtifacts = method.artifacts?.filter(artifact => !artifact.required) ?? []
  return <div className={css.methodOverview} data-template="core">
    <UsageSection method={method} stageIndex={stageIndex} role="core" />
    {answerGroups.length > 0 && <TimelineSection number="02" eyebrow="核心判断" title="进入下一阶段前，先把这些问题说清楚" subtitle={`${String(answerGroups.length)} 个主题 · ${String(answerGroups.reduce((count, group) => count + group.answers.length, 0))} 个判断`}>
      <div className={css.answerGroups}>
        {answerGroups.map((group, groupIndex) => {
          const answerOffset = answerGroups.slice(0, groupIndex).reduce((count, item) => count + item.answers.length, 0)
          return <article key={group.label} className={css.answerGroup} data-tone={group.tone}>
            <header><GroupIcon tone={group.tone} /><strong>{String.fromCharCode(65 + groupIndex)} · {group.label}</strong></header>
            <ol>{group.answers.map((answer, answerIndex) => <li key={answer}><i>{String(answerOffset + answerIndex + 1).padStart(2, '0')}</i><span>{answer}</span></li>)}</ol>
          </article>
        })}
      </div>
      <div className={css.decisionCallout} data-method-decision=""><DecisionIcon /><div><strong>这些判断只形成候选结论</strong><p>方法帮助整理事实与建议，但是否进入下一阶段仍由 FDE 人工确认。</p></div></div>
    </TimelineSection>}
    {method.artifacts !== undefined && <TimelineSection number="03" eyebrow="待审核记录" title={`最终形成 ${String(method.artifacts.length)} 份候选记录`} subtitle="不是完成状态，也不代表已经通过人工确认">
      {requiredArtifacts.length > 0 && <ArtifactGroup label={`必备 · ${String(requiredArtifacts.length)}`} artifacts={requiredArtifacts} required onInspect={onInspectArtifact} />}
      {optionalArtifacts.length > 0 && <ArtifactGroup label={`按需 · ${String(optionalArtifacts.length)}`} artifacts={optionalArtifacts} onInspect={onInspectArtifact} />}
    </TimelineSection>}
  </div>
}

function SupportingOverview({ method, stageIndex, role }: {
  readonly method: StageSkillCatalogMethod
  readonly stageIndex: number
  readonly role: Exclude<MethodRole, 'core'>
}) {
  const conditional = role === 'conditional'
  return <div className={css.methodOverview} data-template={role}>
    <UsageSection method={method} stageIndex={stageIndex} role={role} />
    <TimelineSection number="02" eyebrow={conditional ? '边界处理' : '执行职责'} title={conditional ? '项目条件变化后，如何提出范围调整' : '这项能力在阶段中负责什么'} subtitle={conditional ? '先保留原始目标和历史，再登记改变边界的新事实。' : '围绕当前证据缺口开展工作，不取代阶段核心判断。'}>
      <div className={css.responsibilityCallout}><GroupIcon tone={conditional ? 'value' : 'flow'} /><p>{method.description}</p></div>
      {conditional && <ol className={css.boundarySteps}>
        <li><i>01</i><span><strong>保留原始边界</strong><small>不删除原目标、来源和当时假设。</small></span></li>
        <li><i>02</i><span><strong>登记触发冲突</strong><small>明确新事实怎样影响成功标准、风险或停止条件。</small></span></li>
        <li><i>03</i><span><strong>提出调整方案</strong><small>记录新边界、安全回退和有权决定的人。</small></span></li>
      </ol>}
    </TimelineSection>
    <TimelineSection number="03" eyebrow={conditional ? '人工决定' : '工作分工'} title={conditional ? '由有权负责人接受或拒绝调整' : '把结果交回阶段核心方法继续判断'}>
      <div className={css.decisionCallout} data-method-decision="" data-tone={conditional ? 'warning' : 'business'}><DecisionIcon /><div><strong>{conditional ? '不会直接改写项目边界' : '不会独立推进项目阶段'}</strong><p>{conditional ? '没有可靠证据或有权决定的人时，调整方案保持待确认。' : '能力只贡献有来源的事实、线索或简报；阶段结论仍回到核心方法，并由 FDE 人工决定。'}</p></div></div>
    </TimelineSection>
  </div>
}

export function StageMethodDialog({ method, methods, stageIndex, onClose, onSelectMethod }: StageMethodDialogProps) {
  const [tab, setTab] = useState<MethodTab>('overview')
  const [definitionPath, setDefinitionPath] = useState<string>()
  const definitionFile = method.files?.find(file => file.path === definitionPath)
  const definition = definitionFile?.content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '') ?? method.content
  const source = sourceParts(method.source)
  const role = methodRole(method)
  const tabs: readonly { readonly id: MethodTab; readonly label: string }[] = [
    { id: 'overview', label: '概览' },
    ...method.workflow !== undefined || method.collaborators !== undefined ? [{ id: 'orchestration' as const, label: '协同关系' }] : [],
    ...method.example === undefined ? [] : [{ id: 'example' as const, label: '示例' }],
    ...method.references === undefined ? [] : [{ id: 'references' as const, label: `参考资料 ${String(method.references.length)}` }],
    { id: 'definition', label: '完整定义' },
  ]

  return <div className={css.dialogLayer} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className={css.dialog} data-stage-method-dialog="" data-role={role} role="dialog" aria-modal="true" aria-labelledby="stage-method-title">
      <header className={css.dialogHero} data-stage-method-header="">
        <div className={css.dialogHeading} data-stage-method-heading="">
          <div className={css.dialogEyebrow}><span>{roleLabel(method)}</span><b>第 {String(stageIndex + 1)} 阶段</b></div>
          <h2 id="stage-method-title" data-stage-method-title="">{method.label}</h2>
          <code data-method-supporting="">{method.id}</code>
          <p data-method-body-copy="">{method.description}</p>
        </div>
        <div className={css.heroArt} data-stage-method-hero-art=""><MethodHeroIllustration /></div>
        <button className={css.closeButton} type="button" aria-label="关闭工作方法详情" onClick={onClose}><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button>
      </header>

      <nav className={css.tabs} data-stage-method-tabs="" aria-label="方法详情栏目">
        {tabs.map(item => <button key={item.id} type="button" aria-current={tab === item.id ? 'page' : undefined} onClick={() => { setTab(item.id) }}>{item.label}</button>)}
      </nav>

      <div className={css.dialogBody} data-stage-method-body="">
        {tab === 'overview' && (role === 'core' ? <CoreOverview method={method} stageIndex={stageIndex} onInspectArtifact={() => { setTab('definition') }} /> : <SupportingOverview method={method} stageIndex={stageIndex} role={role} />)}

        {tab === 'orchestration' && <div className={css.orchestration}>
          <section className={css.driver}><span>主要工作方法</span><strong>{method.label}</strong><code>{method.id}</code><p>Agent 根据当前证据缺口按需协同；这里展示的是能力目录，不代表本次运行已经调用。</p></section>
          {method.workflow !== undefined && <section className={css.workflow}><header><span>它如何工作</span><h3>核对事实并形成建议</h3></header><ol>{method.workflow.map((step, index) => <li key={step}><i>{index + 1}</i><span>{step}</span></li>)}</ol></section>}
          {method.collaborators !== undefined && <section className={css.collaborators}><header><span>根据证据缺口按需协同</span><h3>点击能力查看中文核心定义</h3></header><div>{method.collaborators.map(collaborator => {
            const related = methods.find(item => item.id === collaborator.id)
            return <button key={collaborator.id} type="button" data-role={collaborator.role} disabled={related === undefined} onClick={() => { if (related !== undefined) onSelectMethod(related) }}>
              <span><i>{collaborator.role === 'conditional' ? '条件方法' : '工程能力'}</i><strong>{collaborator.label}</strong><code>{collaborator.id}</code></span>
              <span><small>何时协同</small><b>{collaborator.condition}</b></span><span><small>贡献结果</small><b>{collaborator.contribution}</b></span><em aria-hidden="true">→</em>
            </button>
          })}</div></section>}
        </div>}

        {tab === 'example' && method.example !== undefined && <div className={css.example}>
          <header><span>方法示例</span><h3>{method.example.title}</h3><p>{method.example.summary}</p><b>示例不代表当前项目已经执行</b></header>
          <ol>{method.example.steps.map((step, index) => <li key={step.batch}><i>{index + 1}</i><article><span>{step.batch}</span><h4>{step.input}</h4><p>{step.finding}</p><div>{step.skills.map(skill => <b key={skill}>{skill}</b>)}</div><footer>待审核记录：<strong>{step.output}</strong></footer></article></li>)}</ol>
        </div>}

        {tab === 'references' && method.references !== undefined && <div className={css.references}>
          <header><span>上游资料库</span><h3>方法引用不等于每次都加载进模型上下文</h3><p>这里只展示固定版本中被核心方法引用的资料；实际加载情况以运行轨迹为准。</p></header>
          {([['method', '方法与操作手册'], ['artifact', '交付文件模板'], ['control', '模式与控制']] as const).map(([category, label]) => {
            const references = method.references?.filter(reference => reference.category === category) ?? []
            if (references.length === 0) return null
            return <section key={category}><header><h4>{label}</h4><b>{references.length}</b></header><div>{references.map(reference => <a key={reference.path} href={reference.url} target="_blank" rel="noreferrer"><ReferenceIcon kind={reference.kind} /><span><strong>{reference.label}</strong><small>{reference.purpose}</small><code>{reference.path}</code></span><em>{referenceAction(reference)} ↗</em></a>)}</div></section>
          })}
        </div>}

        {tab === 'definition' && <div className={css.definitionTab}>
          <section className={css.definition}><span>工作方法说明（中文）</span>
            {definitionFile !== undefined && <button type="button" onClick={() => { setDefinitionPath(undefined) }}>{method.label}</button>}
            <MarkdownText text={definition} labels={{ code: { copyLabel: '复制', copiedLabel: '已复制' }, footnotes: '脚注' }} fileLinks={{ resolve(value) {
              const target = resolveSkillFile(method.files ?? [], definitionFile?.path ?? method.entryPath ?? '', value)
              return target === undefined ? undefined : { open: () => { setDefinitionPath(target) }, title: target.split('/').at(-1) ?? target }
            } }} />
          </section>
          {method.source !== 'platform' && <details className={css.technical}><summary>技术信息</summary><dl>
            <div><dt>Skill</dt><dd><code>{method.id}</code></dd></div><div><dt>来源仓库</dt><dd><code>{source.repository}</code></dd></div>
            {source.commit !== undefined && <div><dt>源码提交版本</dt><dd><code>{source.commit}</code></dd></div>}
            {method.license !== undefined && <div><dt>许可证</dt><dd>{method.license}</dd></div>}
            {method.sourceLanguage !== undefined && <div><dt>上游语言</dt><dd>英文</dd></div>}
            {method.adapterLanguage !== undefined && <div><dt>产品适配说明</dt><dd>简体中文</dd></div>}
          </dl>{method.sourceUrl !== undefined && <a href={method.sourceUrl} target="_blank" rel="noreferrer">查看固定版本上游来源 ↗</a>}</details>}
        </div>}
      </div>
    </section>
  </div>
}
