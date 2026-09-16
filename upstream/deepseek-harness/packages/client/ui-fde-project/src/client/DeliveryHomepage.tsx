/** Product-positioning home shown when the FDE workbench first opens. */

import type { MouseEvent, ReactNode } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from './slots.ts'
import { useRef } from 'react'
import { domAnimation, LazyMotion, m, MotionConfig, useMotionTemplate, useMotionValue, useSpring, useTransform } from 'motion/react'
import css from './project.module.css'

const PRINCIPLES = [
  {
    number: '01',
    title: '不把需求当答案',
    description: '进入现场，核对真实流程、例外与决策权。',
    guardrail: '需求是待验证的假设',
  },
  {
    number: '02',
    title: '不默认使用人工智能',
    description: '在规则、软件、模型、智能体与人工之间选择。',
    guardrail: '人工智能是可选机制',
  },
  {
    number: '03',
    title: '不止于成功上线',
    description: '让客户真实验收、接管责任并持续运营。',
    guardrail: '客户接管才算完成',
  },
] as const

const DELIVERY_DOMAINS = [
  { number: '01', title: '发现与纠偏', progress: '3 / 3' },
  { number: '02', title: '决策与设计', progress: '2 / 2' },
  { number: '03', title: '受控交付', progress: '2 / 2' },
  { number: '04', title: '上线与经营', progress: '1 / 2' },
] as const

const LIFECYCLE = [
  { title: '接收需求', symbol: '需', description: '记录初始诉求与假设，不急着承诺方案。' },
  { title: '观察现场', symbol: '察', description: '进入真实工作，核对流程、例外与决策权。' },
  { title: '确认价值', symbol: '值', description: '锁定业务结果、范围边界与验收口径。' },
  { title: '准备数据', symbol: '数', description: '让数据能够支撑判断、验证与追溯。' },
  { title: '选择机制', symbol: '策', description: '选择能安全完成工作的最小机制。' },
  { title: '受控开发', symbol: '建', description: '先打通一个边界清楚的端到端切片。' },
  { title: '真实验证', symbol: '验', description: '用真实案例、真实用户和证据证明结果。' },
  { title: '上线移交', symbol: '交', description: '交付运行手册、权限、责任人与恢复路径。' },
  { title: '持续运营', symbol: '营', description: '持续学习、调整、扩展，必要时安全退役。' },
] as const

/** Adapted from Reactive Resume's MIT-licensed CometCard interaction. */
function DeliveryCometFrame({ children }: { readonly children: ReactNode }) {
  const frameRef = useRef<HTMLDivElement>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const spring = { stiffness: 100, damping: 18, mass: 0.8 }
  const mouseXSpring = useSpring(x, spring)
  const mouseYSpring = useSpring(y, spring)
  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ['-6deg', '6deg'])
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ['6deg', '-6deg'])
  const translateX = useTransform(mouseXSpring, [-0.5, 0.5], ['-10px', '10px'])
  const translateY = useTransform(mouseYSpring, [-0.5, 0.5], ['10px', '-10px'])
  const glareX = useTransform(mouseXSpring, [-0.5, 0.5], ['-16%', '16%'])
  const glareY = useTransform(mouseYSpring, [-0.5, 0.5], ['16%', '-16%'])
  const frameTransform = useMotionTemplate`translate3d(${translateX}, ${translateY}, 0) rotateX(${rotateX}) rotateY(${rotateY})`
  const glareTransform = useMotionTemplate`translate3d(${glareX}, ${glareY}, 0)`

  const move = (event: MouseEvent<HTMLDivElement>): void => {
    const frame = frameRef.current
    if (frame === null) return
    const bounds = frame.getBoundingClientRect()
    x.set((event.clientX - bounds.left) / bounds.width - 0.5)
    y.set((event.clientY - bounds.top) / bounds.height - 0.5)
  }

  const reset = (): void => { x.set(0); y.set(0) }

  return (
    <div className={css.deliveryCometFrame}>
      <m.div
        ref={frameRef}
        style={{ transform: frameTransform }}
        className={css.deliveryCometSurface}
        onMouseMove={move}
        onMouseLeave={reset}
      >
        {children}
        <m.div
          aria-hidden="true"
          style={{ transform: glareTransform }}
          className={css.deliveryCometGlare}
        />
      </m.div>
    </div>
  )
}

/** Adapted from Reactive Resume's MIT-licensed two-sided Spotlight. */
function DeliverySpotlight() {
  return (
    <m.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.5 }}
      className={css.deliverySpotlight}
      aria-hidden="true"
    >
      <div className={css.deliverySpotlightSide} data-side="start"><i /><i /><i /></div>
      <div className={css.deliverySpotlightSide} data-side="end"><i /><i /><i /></div>
    </m.div>
  )
}

function DeliveryEvidenceField() {
  return (
    <svg className={css.deliveryEvidenceField} viewBox="0 0 980 790" fill="none" aria-hidden="true" preserveAspectRatio="none">
      <defs>
        <pattern id="delivery-home-grid" width="28" height="28" patternUnits="userSpaceOnUse">
          <path d="M28 0H0V28" stroke="currentColor" strokeOpacity=".13" />
        </pattern>
        <linearGradient id="delivery-home-line" x1="80" y1="630" x2="920" y2="70" gradientUnits="userSpaceOnUse">
          <stop stopColor="#b4bdd5" stopOpacity=".18" />
          <stop offset=".52" stopColor="#7b7ff2" stopOpacity=".64" />
          <stop offset="1" stopColor="#aeb7d0" stopOpacity=".16" />
        </linearGradient>
      </defs>
      <rect x="100" y="45" width="770" height="590" rx="90" fill="url(#delivery-home-grid)" />
      <g stroke="url(#delivery-home-line)" strokeWidth="1">
        <path d="M6 515C137 491 95 167 322 144S570 273 770 182 925 55 974 24" />
        <path d="M68 628C162 592 148 385 306 354S527 423 694 359 846 199 975 207" />
        <path d="M474 776C514 652 433 536 543 452S777 443 868 330 893 142 972 113" />
      </g>
      <g fill="#fff" stroke="#7c83ef" strokeWidth="1">
        <circle cx="101" cy="497" r="4" /><circle cx="322" cy="144" r="4" /><circle cx="603" cy="237" r="4" />
        <circle cx="770" cy="182" r="4" /><circle cx="694" cy="359" r="4" /><circle cx="868" cy="330" r="4" />
        <circle cx="543" cy="452" r="4" /><circle cx="474" cy="776" r="4" />
      </g>
      <g className={css.deliveryEvidenceParticles} fill="#6b72ed">
        <circle cx="224" cy="219" r="3" /><circle cx="460" cy="193" r="3" /><circle cx="817" cy="247" r="3" />
      </g>
    </svg>
  )
}

function DeliverySignalIcon({ type }: { readonly type: 'cases' | 'accuracy' }) {
  if (type === 'cases') return <i className={css.deliverySignalDot} aria-hidden="true" />
  return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <circle cx="10" cy="10" r="7" /><path d="M10 3a7 7 0 0 1 6.7 5" />
  </svg>
}

function DeliverySignal({ type, children, delay }: {
  readonly type: 'cases' | 'accuracy'
  readonly children: ReactNode
  readonly delay: number
}) {
  return (
    <m.div
      className={css.deliverySignal}
      data-delivery-signal={type}
      initial={{ opacity: 0, transform: 'translateY(12px)' }}
      animate={{ opacity: 1, transform: 'translateY(0)' }}
      transition={{ duration: 0.5, delay, ease: [0.23, 1, 0.32, 1] }}
    >
      <div><DeliverySignalIcon type={type} />{children}</div>
    </m.div>
  )
}

function DeliveryPrincipleIcon({ type }: { readonly type: 'process' | 'mechanism' | 'handoff' }) {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    {type === 'process' && <><path d="M7 3h8l4 4v14H7V3Z" /><path d="M15 3v5h5M10 12h5M10 16h3" /><circle cx="18" cy="17" r="3" /><path d="m16.7 17 1 1 1.8-2" /></>}
    {type === 'mechanism' && <><path d="M9 5.2A3.5 3.5 0 0 0 5.8 9a3.3 3.3 0 0 0 .5 5.9A3.7 3.7 0 0 0 10 19V5.8A2.8 2.8 0 0 0 9 5.2ZM15 5.2A3.5 3.5 0 0 1 18.2 9a3.3 3.3 0 0 1-.5 5.9A3.7 3.7 0 0 1 14 19V5.8a2.8 2.8 0 0 1 1-.6Z" /><path d="M10 9H8m2 4H7.5m6.5-4h2m-2 4h2.5M10 16H8.7m5.3 0h1.3" /></>}
    {type === 'handoff' && <><path d="m3 12 3-3 4 3 2-2 3 3 3-2 3 3-5 5-4-3-2 2-7-6Z" /><path d="m6 9 3-3 4 2 2-1 4 4M8.5 14.5l2 2m1.5-1 2 2" /></>}
  </svg>
}

function DeliveryArrowIcon() {
  return <svg viewBox="0 0 28 28" fill="none" aria-hidden="true">
    <path d="M5 14h18" /><path d="m17 8 6 6-6 6" />
  </svg>
}

function DeliveryFinalOrbit() {
  return (
    <svg className={css.deliveryFinalOrbit} viewBox="0 0 760 420" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="delivery-final-orbit-line" x1="25" y1="340" x2="735" y2="45" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8c7bff" stopOpacity="0" />
          <stop offset=".28" stopColor="#8070f6" stopOpacity=".27" />
          <stop offset=".72" stopColor="#8e82f8" stopOpacity=".18" />
          <stop offset="1" stopColor="#9d91ff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="delivery-final-orbit-glow">
          <stop stopColor="#fff" />
          <stop offset=".32" stopColor="#cec7ff" />
          <stop offset="1" stopColor="#8a79fa" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g className={css.deliveryFinalOrbitLines} stroke="url(#delivery-final-orbit-line)" strokeWidth="1.2">
        <ellipse cx="380" cy="210" rx="350" ry="127" transform="rotate(-18 380 210)" />
        <ellipse cx="380" cy="210" rx="294" ry="95" transform="rotate(-27 380 210)" />
        <path d="M40 336C177 284 182 118 369 83c179-34 254 91 353 48" />
      </g>
      <g className={css.deliveryFinalOrbitDots} fill="url(#delivery-final-orbit-glow)">
        <circle cx="117" cy="306" r="14" />
        <circle cx="167" cy="111" r="12" />
        <circle cx="341" cy="53" r="10" />
        <circle cx="504" cy="67" r="12" />
        <circle cx="653" cy="151" r="13" />
      </g>
    </svg>
  )
}

function DeliveryPreviewWindow() {
  return (
    <div className={css.deliveryPreviewWrap}>
      <m.div
        className={css.deliveryPreviewEntrance}
        initial={{ opacity: 0, transform: 'translateY(48px)' }}
        animate={{ opacity: 1, transform: 'translateY(0)' }}
        transition={{ duration: 0.72, delay: 0.16, ease: [0.23, 1, 0.32, 1] }}
      >
        <DeliveryCometFrame>
          <section className={css.deliveryPreviewWindow} aria-label="示例项目动态交付窗口" data-delivery-preview="">
            <header className={css.deliveryPreviewBar}>
              <span className={css.deliveryWindowDots} aria-hidden="true"><i /><i /><i /></span>
              <span className={css.deliveryWindowTitle}>FF-FDE工作台 <i>/</i> 项目交付流程</span>
              <span className={css.deliveryWindowStatus}><i aria-hidden="true" />阶段与证据</span>
            </header>

            <div className={css.deliveryPreviewBody}>
              <aside className={css.deliveryDomainRail} aria-label="示例交付域">
                <header><span>交付进程</span><strong>从问题到接管</strong></header>
                <nav>
                  {DELIVERY_DOMAINS.map((domain, index) => (
                    <span key={domain.title} data-current={index === 2 || undefined}>
                      <i>{domain.number}</i>
                      <strong>{domain.title}</strong>
                      <small>{domain.progress}</small>
                    </span>
                  ))}
                </nav>
                <div className={css.deliveryDomainOwner}>
                  <span>当前责任人</span>
                  <strong><i aria-hidden="true">责</i> 项目指定责任人</strong>
                </div>
              </aside>

              <div className={css.deliveryProofCanvas}>
                <header>
                  <div>
                    <span>验收结果 / 阶段 07</span>
                    <h3 data-delivery-preview-title="">证明一个客户愿意接管的结果</h3>
                  </div>
                  <button type="button" tabIndex={-1}>验证评估 <span aria-hidden="true">⌄</span></button>
                </header>

                <div className={css.deliveryOutcomeFlow} aria-label="从客户需求到接受成果的示例">
                  <article data-kind="reality">
                    <header><span>现场事实</span><i aria-hidden="true">01</i></header>
                    <strong>确认实际业务问题，<br />而非预设技术答案</strong>
                    <p>从当前项目的访谈、材料与观察中核对</p>
                    <footer><i aria-hidden="true" />现场事实已确认</footer>
                  </article>
                  <span className={css.deliveryFlowConnector} aria-hidden="true"><i /><b>→</b></span>
                  <article data-kind="mechanism">
                    <header><span>最小可行机制</span><i aria-hidden="true">02</i></header>
                    <strong>按业务选择实现机制<br />+ 明确人工复核边界</strong>
                    <p>自动化边界与回退路径已经明确</p>
                    <footer><i aria-hidden="true" />机制受控运行</footer>
                  </article>
                  <span className={css.deliveryFlowConnector} aria-hidden="true"><i /><b>→</b></span>
                  <article data-kind="accepted">
                    <header><span>客户验收结果</span><i aria-hidden="true">03</i></header>
                    <strong>以项目指标证明结果，<br />由实际责任人验收</strong>
                    <p>验收证据、责任人与运行手册齐备</p>
                    <footer><i aria-hidden="true" />等待客户签署</footer>
                  </article>
                </div>

                <section className={css.deliveryLifecyclePanel} aria-labelledby="delivery-lifecycle-title">
                  <header>
                    <div><span>标准交付闭环</span><strong id="delivery-lifecycle-title">九步交付闭环</strong></div>
                    <small>现场证据 <i aria-hidden="true">→</i> 客户验收结果</small>
                  </header>
                  <ol aria-label="九步交付闭环">
                    {LIFECYCLE.map((step, index) => (
                      <li key={step.title} data-complete={index < 7 || undefined} data-current={index === 6 || undefined}>
                        <i>{String(index + 1).padStart(2, '0')}</i><span>{step.title}</span>
                      </li>
                    ))}
                  </ol>
                </section>
              </div>

              <aside className={css.deliveryEvidenceRail} aria-label="示例项目验收状态">
                <header><span>客户验收</span><strong>验收契约</strong></header>
                <div className={css.deliveryAcceptanceScore}>
                  <div><strong>87</strong><span>%</span></div>
                  <p>关键结果已被<br />真实证据支持</p>
                </div>
                <dl>
                  <div><dt>业务价值</dt><dd><i data-state="ready" />已确认</dd></div>
                  <div><dt>真实案例</dt><dd><i data-state="ready" />15 / 15</dd></div>
                  <div><dt>安全边界</dt><dd><i data-state="ready" />已覆盖</dd></div>
                  <div><dt>客户决定</dt><dd><i data-state="waiting" />待签署</dd></div>
                </dl>
                <div className={css.deliveryDecisionCard}>
                  <span>下一项决定</span>
                  <strong>运营负责人确认接管</strong>
                  <small>所有权不会被系统自动转移</small>
                  <button type="button" tabIndex={-1}>查看验收证据 <span aria-hidden="true">→</span></button>
                </div>
              </aside>
            </div>

            <footer className={css.deliveryPreviewFooter}>
              <span><i aria-hidden="true" />证据链已同步 · 刚刚</span>
              <span>自主程度：<strong>受控</strong></span>
              <strong>客户验收结果 <span aria-hidden="true">→</span></strong>
            </footer>
          </section>
        </DeliveryCometFrame>
      </m.div>
    </div>
  )
}

function DeliveryLifecycleDiagram() {
  const nodes = [
    { id: 'reality', title: '需求与现场', description: '接收需求、观察现场', tone: 'cyan' },
    { id: 'value', title: '价值与数据', description: '确认价值、准备数据', tone: 'coral' },
    { id: 'mechanism', title: '机制选择', description: '选择最小可行机制', tone: 'coral' },
    { id: 'validation', title: '构建与验证', description: '受控开发、真实验证', tone: 'green' },
    { id: 'handoff', title: '移交与运营', description: '上线移交、持续运营', tone: 'purple' },
    { id: 'adjust', title: '调整方案', description: '结果未达验收口径', tone: 'coral' },
  ] as const

  return (
    <div className={css.deliveryLifecycleMapCanvas} data-delivery-lifecycle-map="">
      <div className={css.deliveryLifecycleLaneLabels} aria-hidden="true">
        <span>01 / 九阶段主路径</span>
        <span>02 / 验证与调整</span>
        <span>03 / 客户结果</span>
      </div>
      <svg className={css.deliveryLifecycleConnectors} viewBox="0 0 1050 546" fill="none" aria-hidden="true" preserveAspectRatio="none">
        <defs>
          <marker id="lifecycle-arrow-green" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth">
            <path d="M0 0 8 4 0 8Z" fill="#25a789" />
          </marker>
          <marker id="lifecycle-arrow-red" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth">
            <path d="M0 0 8 4 0 8Z" fill="#e75966" />
          </marker>
        </defs>
        <g className={css.deliveryLifecycleLaneLines}>
          <path d="M84 95H966" />
          <path d="M84 255H966" />
          <path d="M84 425H966" />
        </g>
        <g className={css.deliveryLifecycleMainPath} markerEnd="url(#lifecycle-arrow-green)">
          <path d="M270 142H302" />
          <path d="M435 142H469" />
          <path d="M602 142H634" />
          <path d="M767 142H795" />
        </g>
        <path className={css.deliveryLifecycleFeedbackPath} d="M797 105V80H435V105" markerEnd="url(#lifecycle-arrow-red)" />
        <path className={css.deliveryLifecycleRejectPath} d="M697 178V270" markerEnd="url(#lifecycle-arrow-red)" />
        <path className={css.deliveryLifecycleReturnPath} d="M630 304H584V178" markerEnd="url(#lifecycle-arrow-green)" />
      </svg>
      <span className={css.deliveryLifecycleFeedbackLabel}>新证据进入下一轮</span>
      <span className={css.deliveryLifecycleRejectLabel}>未达验收口径</span>
      <span className={css.deliveryLifecycleReturnLabel}>重新选择机制</span>
      <div className={css.deliveryLifecycleNodes}>
        {nodes.map(node => (
          <article key={node.id} data-lifecycle-node={node.id} data-tone={node.tone}>
            <i aria-hidden="true" />
            <strong data-lifecycle-node-title="">{node.title}</strong>
            <span data-lifecycle-node-copy="">{node.description}</span>
          </article>
        ))}
      </div>
      <div className={css.deliveryLifecycleLegend} aria-label="流程图图例">
        <strong>图例</strong>
        <span data-tone="cyan"><i />开始 <small>1</small></span>
        <span data-tone="green"><i />活动状态 <small>1</small></span>
        <span data-tone="coral"><i />决策 <small>2</small></span>
        <span data-tone="purple"><i />成功/验态 <small>1</small></span>
        <span data-tone="red"><i />失败 / 退出 <small>1</small></span>
      </div>
    </div>
  )
}

/**
 * Explains the workbench's outcome-first method without replacing its six executable project stages.
 * @param props - Current real-project count and the explicit action that enters project operations.
 * @returns The product hero, principles, and canonical nine-step lifecycle.
 */
export function DeliveryHomepage({
  projectCount,
  projectReadError,
  openProjects,
  t,
}: {
  readonly projectCount: number | undefined
  readonly projectReadError: boolean
  readonly openProjects: () => void
} & PropsLocale<'fdeProject'>) {
  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domAnimation}>
        <section className={css.deliveryHomepage} aria-label="FF-FDE工作台产品首页" data-delivery-home="">
          <nav className={css.deliveryHomeNav} aria-label="产品首页导航" data-delivery-nav="">
            <a href="#fde-home-top" className={css.deliveryBrand} aria-label="FF-FDE工作台首页" data-delivery-brand="">
              <img className={css.deliveryBrandLogo} src="/ff-brand/ff-logo.png" alt="" aria-hidden="true" />
              <span>FF-FDE工作台</span>
            </a>
            <div className={css.deliveryHomeNavActions}>
              <button type="button" onClick={openProjects} data-delivery-nav-action="">
                {t('home.enterPlatform')} <span aria-hidden="true">↗</span>
              </button>
            </div>
          </nav>

          <div id="fde-home-top" className={css.deliveryHero} data-delivery-hero="">
            <DeliverySpotlight />
            <DeliveryEvidenceField />
            <header className={css.deliveryHeroCopy} data-delivery-hero-copy="">
              <m.span
                className={css.deliveryHeroEyebrow}
                initial={{ opacity: 0, transform: 'translateY(10px)' }}
                animate={{ opacity: 1, transform: 'translateY(0)' }}
                transition={{ duration: 0.45, delay: 0.04, ease: [0.23, 1, 0.32, 1] }}
              ><i aria-hidden="true" />证据驱动的 FDE 交付系统</m.span>
              <m.h2
                initial={{ opacity: 0, transform: 'translateY(16px)' }}
                animate={{ opacity: 1, transform: 'translateY(0)' }}
                transition={{ duration: 0.55, delay: 0.08, ease: [0.23, 1, 0.32, 1] }}
                data-delivery-title=""
              >把模糊需求，<br />交付成客户<strong>真正接管</strong>的<br />业务结果。</m.h2>
              <m.p
                className={css.deliveryHeroDescription}
                initial={{ opacity: 0, transform: 'translateY(12px)' }}
                animate={{ opacity: 1, transform: 'translateY(0)' }}
                transition={{ duration: 0.48, delay: 0.2, ease: [0.23, 1, 0.32, 1] }}
                data-delivery-description=""
              >从真实流程、价值证据到受控上线，Agent 推进执行，<br />FDE 保留关键决策。每一步都有记录、责任人与验收条件。</m.p>
              <m.p
                className={css.deliveryHeroLive}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.3 }}
                data-delivery-supporting=""
                role="status"
              ><i aria-hidden="true" />{projectReadError ? t('home.projectFailure')
                  : projectCount === undefined ? '正在连接并读取项目…'
                    : `当前 ${String(projectCount)} 个真实项目正在交付 · 证据持续同步`}</m.p>
              <m.div
                className={css.deliveryHeroActions}
                initial={{ opacity: 0, transform: 'translateY(12px)' }}
                animate={{ opacity: 1, transform: 'translateY(0)' }}
                transition={{ duration: 0.48, delay: 0.36, ease: [0.23, 1, 0.32, 1] }}
              >
                <button type="button" onClick={openProjects} data-delivery-primary-action="">
                  {t('home.enterPlatform')} <span aria-hidden="true">→</span>
                </button>
                <a href="#fde-lifecycle" data-delivery-secondary-action="">查看交付生命周期 <span aria-hidden="true">↓</span></a>
              </m.div>
            </header>

            <DeliveryPreviewWindow />
            <DeliverySignal type="cases" delay={0.42}><strong>15 / 15</strong><span>真实案例</span></DeliverySignal>
            <DeliverySignal type="accuracy" delay={0.5}><strong>92%</strong><span>首派准确率</span></DeliverySignal>
          </div>

          <m.p
            className={css.deliveryHeroBridge}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, amount: 0.7 }}
            transition={{ duration: 0.32, ease: [0.23, 1, 0.32, 1] }}
            data-delivery-hero-bridge=""
          ><i aria-hidden="true" />不是交付一个 Demo，而是交付一套客户能持续运行的结果。<i aria-hidden="true" /></m.p>

          <section id="fde-lifecycle" className={css.deliveryLifecycleSection} aria-labelledby="fde-lifecycle-title" data-delivery-lifecycle-section="">
            <header className={css.deliveryLifecycleIntro} data-delivery-lifecycle-intro="">
              <div>
                <span><i aria-hidden="true" />九阶段标准生命周期</span>
                <h2 id="fde-lifecycle-title" data-delivery-lifecycle-title="">从现场事实出发，<br />走向客户<strong>持续经营</strong>。</h2>
              </div>
              <p data-delivery-lifecycle-copy="">每个阶段都有明确的输入、判断与证据出口。阶段可以迭代回退，但不能绕过真实验证直接走向上线。<i aria-hidden="true" /></p>
            </header>

            <div className={css.deliveryLifecycleArchitecture} aria-label="九阶段交付生命周期架构图">
              <DeliveryLifecycleDiagram />
            </div>

            <div className={css.deliveryLifecycleNotes} aria-label="生命周期设计说明" data-delivery-lifecycle-notes="">
              {PRINCIPLES.map((principle, index) => (
                <article key={principle.number} data-lifecycle-principle={principle.number}>
                  <i className={css.deliveryLifecycleNoteIcon} aria-hidden="true"><DeliveryPrincipleIcon type={index === 0 ? 'process' : index === 1 ? 'mechanism' : 'handoff'} /></i>
                  <div><small><b>{principle.number}</b>{principle.guardrail}</small><h3 data-lifecycle-card-title="">{principle.title}</h3><p>{principle.description}</p></div>
                </article>
              ))}
            </div>
          </section>

          <section className={css.deliveryManifesto} aria-label="交付方法核心表达" data-delivery-final-cta="">
            <DeliveryFinalOrbit />
            <blockquote data-delivery-final-copy="">
              <p className={css.deliveryManifestoEyebrow} data-delivery-final-eyebrow="">模型与算力只是投入，自主程度需要设计；</p>
              <p className={css.deliveryManifestoTitle} data-delivery-final-title=""><strong>客户接受的结果</strong>，<br />才是真正的产品。</p>
            </blockquote>
            <i className={css.deliveryManifestoDivider} aria-hidden="true" />
            <div className={css.deliveryManifestoAction} data-delivery-final-action-wrap="">
              <span data-delivery-final-prompt="">准备交付真实结果了吗？</span>
              <button type="button" onClick={openProjects} data-delivery-final-action="">
                <span>{t('home.enterPlatform')}</span><DeliveryArrowIcon />
              </button>
            </div>
          </section>
        </section>
      </LazyMotion>
    </MotionConfig>
  )
}
