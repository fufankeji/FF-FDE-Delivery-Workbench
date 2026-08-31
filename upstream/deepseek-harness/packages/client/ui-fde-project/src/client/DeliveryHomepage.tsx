/** Product-positioning home shown when the FDE workbench first opens. */

import type { MouseEvent, ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
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
          <section className={css.deliveryPreviewWindow} aria-label="示例项目动态交付窗口">
            <header className={css.deliveryPreviewBar}>
              <span className={css.deliveryWindowDots} aria-hidden="true"><i /><i /><i /></span>
              <span className={css.deliveryWindowTitle}>FF-FDE工作台 <i>/</i> 售后工单交付</span>
              <span className={css.deliveryWindowStatus}><i aria-hidden="true" />证据实时同步</span>
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
                  <strong><i aria-hidden="true">周</i> 周明 · 交付工程师</strong>
                </div>
              </aside>

              <div className={css.deliveryProofCanvas}>
                <header>
                  <div>
                    <span>验收结果 / 阶段 07</span>
                    <h3>证明一个客户愿意接管的结果</h3>
                  </div>
                  <button type="button" tabIndex={-1}>验证评估 <span aria-hidden="true">⌄</span></button>
                </header>

                <div className={css.deliveryOutcomeFlow} aria-label="从客户需求到接受成果的示例">
                  <article data-kind="reality">
                    <header><span>现场事实</span><i aria-hidden="true">01</i></header>
                    <strong>工单反复重分，<br />而非缺少聊天机器人</strong>
                    <p>来自 12 次访谈与 15 个真实异常案例</p>
                    <footer><i aria-hidden="true" />现场事实已确认</footer>
                  </article>
                  <span className={css.deliveryFlowConnector} aria-hidden="true"><i /><b>→</b></span>
                  <article data-kind="mechanism">
                    <header><span>最小可行机制</span><i aria-hidden="true">02</i></header>
                    <strong>规则路由 + 模型分类<br />+ 低置信度人工复核</strong>
                    <p>自动化边界与回退路径已经明确</p>
                    <footer><i aria-hidden="true" />机制受控运行</footer>
                  </article>
                  <span className={css.deliveryFlowConnector} aria-hidden="true"><i /><b>→</b></span>
                  <article data-kind="accepted">
                    <header><span>客户验收结果</span><i aria-hidden="true">03</i></header>
                    <strong>首派准确率 92%，<br />运营团队可以接管</strong>
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
  const readTheme = (): 'light' | 'dark' => typeof document !== 'undefined' && document.body.hasAttribute('data-ds-dark-theme') ? 'dark' : 'light'
  const [theme, setTheme] = useState<'light' | 'dark'>(readTheme)

  useEffect(() => {
    const syncTheme = (): void => { setTheme(readTheme()) }
    const observer = new MutationObserver(syncTheme)
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-ds-dark-theme'] })
    return () => { observer.disconnect() }
  }, [])

  return (
    <iframe
      title="FF-FDE 九阶段交付生命周期交互图"
      src={`/ff-fde-lifecycle-embed.html?home=1&theme=${theme}`}
      loading="lazy"
      tabIndex={-1}
    />
  )
}

/**
 * Explains the workbench's outcome-first method without replacing its six executable project stages.
 * @param props - Current real-project count and the explicit action that enters project operations.
 * @returns The product hero, principles, and canonical nine-step lifecycle.
 */
export function DeliveryHomepage({
  projectCount,
  openProjects,
}: {
  readonly projectCount: number
  readonly openProjects: () => void
}) {
  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domAnimation}>
        <section className={css.deliveryHomepage} aria-label="FF-FDE工作台产品首页">
          <nav className={css.deliveryHomeNav} aria-label="产品首页导航">
            <a href="#fde-home-top" className={css.deliveryBrand} aria-label="FF-FDE工作台首页">
              <img className={css.deliveryBrandLogo} src="/ff-brand/ff-logo.png" alt="" aria-hidden="true" />
              <span>FF-FDE工作台</span>
            </a>
            <button type="button" onClick={openProjects}>
              {projectCount > 0 ? `进入工作台 · ${String(projectCount)}` : '进入工作台'} <span aria-hidden="true">↗</span>
            </button>
          </nav>

          <div id="fde-home-top" className={css.deliveryHero}>
            <DeliverySpotlight />
            <header className={css.deliveryHeroCopy}>
              <m.h2
                initial={{ opacity: 0, transform: 'translateY(16px)' }}
                animate={{ opacity: 1, transform: 'translateY(0)' }}
                transition={{ duration: 0.55, delay: 0.08, ease: [0.23, 1, 0.32, 1] }}
              ><span>把模糊需求，交付成</span><span>客户真正接管的业务结果。</span></m.h2>
            </header>
            <DeliveryPreviewWindow />
            <div className={css.deliveryHeroAfterPreview}>
              <m.p
                initial={{ opacity: 0, transform: 'translateY(12px)' }}
                animate={{ opacity: 1, transform: 'translateY(0)' }}
                transition={{ duration: 0.48, delay: 0.36, ease: [0.23, 1, 0.32, 1] }}
              >从现场理解、价值验证与机制选择开始，完成受控开发、真实验收、上线移交和持续运营。</m.p>
              <m.div
                className={css.deliveryHeroActions}
                initial={{ opacity: 0, transform: 'translateY(12px)' }}
                animate={{ opacity: 1, transform: 'translateY(0)' }}
                transition={{ duration: 0.48, delay: 0.44, ease: [0.23, 1, 0.32, 1] }}
              >
                <button type="button" onClick={openProjects}>
                  {projectCount > 0 ? `进入交付工作台 · ${String(projectCount)} 个项目` : '进入交付工作台'} <span aria-hidden="true">→</span>
                </button>
                <a href="#fde-lifecycle">查看交付生命周期 <span aria-hidden="true">↓</span></a>
              </m.div>
            </div>
            <m.div
              className={css.deliveryScrollIndicator}
              aria-hidden="true"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7, duration: 0.4 }}
            >
              <div><i /></div>
            </m.div>
          </div>

          <section id="fde-lifecycle" className={css.deliveryLifecycleSection} aria-labelledby="fde-lifecycle-title">
            <header className={css.deliveryLifecycleIntro}>
              <div>
                <span><i aria-hidden="true" />九阶段标准生命周期</span>
                <h2 id="fde-lifecycle-title">从现场事实出发，<br />走向客户持续经营。</h2>
              </div>
              <p>每个阶段都有明确的输入、判断与证据出口。阶段可以迭代回退，但不能绕过真实验证直接走向上线。</p>
            </header>

            <div className={css.deliveryLifecycleArchitecture} aria-label="九阶段交付生命周期架构图">
              <DeliveryLifecycleDiagram />
            </div>

            <div className={css.deliveryLifecycleNotes} aria-label="生命周期设计说明">
              {PRINCIPLES.map(principle => (
                <article key={principle.number}>
                  <span>{principle.number}</span>
                  <div><small>{principle.guardrail}</small><h3>{principle.title}</h3><p>{principle.description}</p></div>
                </article>
              ))}
            </div>
          </section>

          <section className={css.deliveryManifesto} aria-label="交付方法核心表达">
            <blockquote>
              <p>模型与算力只是投入，自主程度需要设计；<br /><strong>客户接受的结果，才是真正的产品。</strong></p>
              <cite><a href="https://github.com/davidahmann/fde-guide#the-core-idea" target="_blank" rel="noreferrer">交付方法指南 <span aria-hidden="true">↗</span></a></cite>
            </blockquote>
            <div><span>准备交付真实结果了吗？</span><button type="button" onClick={openProjects}>开始一次真实交付 <span aria-hidden="true">→</span></button></div>
          </section>
        </section>
      </LazyMotion>
    </MotionConfig>
  )
}
