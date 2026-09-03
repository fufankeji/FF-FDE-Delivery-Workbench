/** Structured, Chinese-first reader for one registered stage method. */

import { MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives'
import { useState } from 'react'
import type {
  StageSkillCatalogMethod, StageSkillCatalogReference,
} from './stage-skill-catalog.ts'
import css from './StageWorkbench.module.css'

type MethodTab = 'overview' | 'orchestration' | 'example' | 'references' | 'definition'

interface StageMethodDialogProps {
  readonly method: StageSkillCatalogMethod
  readonly methods: readonly StageSkillCatalogMethod[]
  readonly stageIndex: number
  readonly onClose: () => void
  readonly onSelectMethod: (method: StageSkillCatalogMethod) => void
}

function roleLabel(method: StageSkillCatalogMethod): string {
  if (method.role === 'core') return '核心方法'
  if (method.role === 'conditional' || method.group === 'conditional') return '条件方法'
  if (method.role === 'engineering') return '工程能力'
  return '必做方法'
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

function ReferenceIcon({ kind }: { readonly kind: StageSkillCatalogReference['kind'] }) {
  return <svg className={css.methodReferenceIcon} data-kind={kind} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    {kind === 'markdown' && <><path d="M5 3.5h9l5 5v12H5z" /><path d="M14 3.5v5h5M8 13h8M8 16h6" /></>}
    {kind === 'json' && <><path d="M9 4H7.5A2.5 2.5 0 0 0 5 6.5V9a2 2 0 0 1-2 2 2 2 0 0 1 2 2v4.5A2.5 2.5 0 0 0 7.5 20H9M15 4h1.5A2.5 2.5 0 0 1 19 6.5V9a2 2 0 0 0 2 2 2 2 0 0 0-2 2v4.5a2.5 2.5 0 0 1-2.5 2.5H15" /></>}
    {kind === 'pattern' && <><rect x="3.5" y="4" width="7" height="7" rx="1.5" /><rect x="13.5" y="4" width="7" height="7" rx="1.5" /><rect x="8.5" y="14" width="7" height="7" rx="1.5" /><path d="M7 11v2h5M17 11v2h-5" /></>}
    {kind === 'catalog' && <><path d="M4 5.5h16M4 12h16M4 18.5h16" /><circle cx="7" cy="5.5" r="1.5" /><circle cx="15" cy="12" r="1.5" /><circle cx="10" cy="18.5" r="1.5" /></>}
  </svg>
}

export function StageMethodDialog({ method, methods, stageIndex, onClose, onSelectMethod }: StageMethodDialogProps) {
  const [tab, setTab] = useState<MethodTab>('overview')
  const source = sourceParts(method.source)
  const tabs: readonly { readonly id: MethodTab; readonly label: string }[] = [
    { id: 'overview', label: '概览' },
    ...method.workflow !== undefined || method.collaborators !== undefined
      ? [{ id: 'orchestration' as const, label: '协同关系' }]
      : [],
    ...method.example === undefined ? [] : [{ id: 'example' as const, label: '示例' }],
    ...method.references === undefined ? [] : [{ id: 'references' as const, label: `参考资料 ${String(method.references.length)}` }],
    { id: 'definition', label: '完整定义' },
  ]

  return <div
    className={css.stageMethodDialogLayer}
    role="presentation"
    onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}
  >
    <section className={css.stageMethodDialog} role="dialog" aria-modal="true" aria-labelledby="stage-method-title">
      <header>
        <div className={css.stageMethodDialogHeading}>
          <div className={css.stageMethodDialogEyebrow}>
            <span data-role={method.role ?? method.group}>{roleLabel(method)}</span>
            <b>第 {String(stageIndex + 1)} 阶段</b>
          </div>
          <h2 id="stage-method-title">{method.label}</h2>
          <code>{method.id}</code>
          <p>{method.description}</p>
        </div>
        <button type="button" aria-label="关闭工作方法详情" onClick={onClose}>×</button>
        <nav className={css.stageMethodTabs} aria-label="方法详情栏目">
          {tabs.map(item => <button key={item.id} type="button" aria-current={tab === item.id ? 'page' : undefined} onClick={() => { setTab(item.id) }}>{item.label}</button>)}
        </nav>
      </header>

      <div className={css.stageMethodDialogBody}>
        {tab === 'overview' && <div className={css.stageMethodOverview}>
          <section className={css.stageMethodUsage}>
            <span>什么时候会用</span>
            <p>{method.whenToUse}</p>
          </section>

          {method.answers !== undefined && <section className={css.stageMethodAnswers}>
            <header><span>它负责回答什么</span><h3>进入下一阶段前，先把这些问题说清楚</h3></header>
            <ol>{method.answers.map((answer, index) => <li key={answer}><i>{String(index + 1).padStart(2, '0')}</i><span>{answer}</span></li>)}</ol>
          </section>}

          {method.artifacts !== undefined && <section className={css.stageMethodArtifacts}>
            <header><span>最终形成</span><h3>候选记录，不代表已经通过人工确认</h3></header>
            <div>{method.artifacts.map(artifact => <article key={artifact.path} data-required={artifact.required ? 'true' : undefined}>
              <i aria-hidden="true">{artifact.required ? '记' : '需'}</i>
              <span><strong>{artifact.label}</strong><small>{artifact.purpose}</small><code>{artifact.path}</code></span>
              <b>{artifact.required ? '必备' : '按需'}</b>
            </article>)}</div>
          </section>}

          {method.answers === undefined && method.artifacts === undefined && <section className={css.stageMethodSimpleOverview}>
            <span>方法目标</span><p>{method.description}</p>
            <p>需要查看完整执行约束、固定产物和状态字段时，切换到“完整定义”。</p>
          </section>}
        </div>}

        {tab === 'orchestration' && <div className={css.stageMethodOrchestration}>
          <section className={css.stageMethodDriver}>
            <span>核心驱动</span><strong>{method.label}</strong><code>{method.id}</code>
            <p>Agent 根据当前证据缺口按需协同；这里展示的是能力目录，不代表本次运行已经调用。</p>
          </section>

          {method.workflow !== undefined && <section className={css.stageMethodWorkflow}>
            <header><span>它如何工作</span><h3>持续回到事实和候选判断</h3></header>
            <ol>{method.workflow.map((step, index) => <li key={step}><i>{index + 1}</i><span>{step}</span></li>)}</ol>
          </section>}

          {method.collaborators !== undefined && <section className={css.stageMethodCollaborators}>
            <header><span>根据证据缺口按需协同</span><h3>点击能力查看中文核心定义</h3></header>
            <div>{method.collaborators.map(collaborator => {
              const related = methods.find(item => item.id === collaborator.id)
              return <button key={collaborator.id} type="button" data-role={collaborator.role} disabled={related === undefined} onClick={() => {
                if (related !== undefined) onSelectMethod(related)
              }}>
                <span><i>{collaborator.role === 'conditional' ? '条件方法' : '工程能力'}</i><strong>{collaborator.label}</strong><code>{collaborator.id}</code></span>
                <span><small>何时协同</small><b>{collaborator.condition}</b></span>
                <span><small>贡献结果</small><b>{collaborator.contribution}</b></span>
                <em aria-hidden="true">→</em>
              </button>
            })}</div>
          </section>}
        </div>}

        {tab === 'example' && method.example !== undefined && <div className={css.stageMethodExample}>
          <header><span>方法示例</span><h3>{method.example.title}</h3><p>{method.example.summary}</p><b>示例不代表当前项目已经执行</b></header>
          <ol>{method.example.steps.map((step, index) => <li key={step.batch}>
            <i>{index + 1}</i>
            <article><span>{step.batch}</span><h4>{step.input}</h4><p>{step.finding}</p><div>{step.skills.map(skill => <b key={skill}>{skill}</b>)}</div><footer>候选产物：<strong>{step.output}</strong></footer></article>
          </li>)}</ol>
        </div>}

        {tab === 'references' && method.references !== undefined && <div className={css.stageMethodReferences}>
          <header><span>上游资料库</span><h3>方法引用不等于每次都加载进模型上下文</h3><p>这里只展示固定版本中被核心方法引用的资料；实际加载情况以运行轨迹为准。</p></header>
          {([
            ['method', '方法与 Playbook'],
            ['artifact', 'Artifact 模板'],
            ['control', '模式与控制'],
          ] as const).map(([category, label]) => {
            const references = method.references?.filter(reference => reference.category === category) ?? []
            if (references.length === 0) return null
            return <section key={category}><header><h4>{label}</h4><b>{references.length}</b></header><div>{references.map(reference => <a key={reference.path} href={reference.url} target="_blank" rel="noreferrer">
              <ReferenceIcon kind={reference.kind} />
              <span><strong>{reference.label}</strong><small>{reference.purpose}</small><code>{reference.path}</code></span>
              <em>{referenceAction(reference)} ↗</em>
            </a>)}</div></section>
          })}
        </div>}

        {tab === 'definition' && <div className={css.stageMethodDefinitionTab}>
          <section className={css.stageMethodDefinition}>
            <span>中文 Adapter 完整定义</span>
            <MarkdownText text={method.content} />
          </section>
          <details className={css.stageMethodTechnical}>
            <summary>技术信息</summary>
            <dl>
              <div><dt>Skill</dt><dd><code>{method.id}</code></dd></div>
              <div><dt>来源仓库</dt><dd><code>{source.repository}</code></dd></div>
              {source.commit !== undefined && <div><dt>固定 Commit</dt><dd><code>{source.commit}</code></dd></div>}
              {method.license !== undefined && <div><dt>License</dt><dd>{method.license}</dd></div>}
              {method.sourceLanguage !== undefined && <div><dt>上游语言</dt><dd>英文</dd></div>}
              {method.adapterLanguage !== undefined && <div><dt>产品 Adapter</dt><dd>简体中文</dd></div>}
            </dl>
            {method.sourceUrl !== undefined && <a href={method.sourceUrl} target="_blank" rel="noreferrer">查看固定版本上游来源 ↗</a>}
          </details>
        </div>}
      </div>
    </section>
  </div>
}
