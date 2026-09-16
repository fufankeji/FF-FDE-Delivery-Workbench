import { useState } from 'react'
import type { PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type { createLabStore } from './stores.ts'
import css from './lab.module.css'
type LabStore = ReturnType<typeof createLabStore>
type LauncherProps = PropsRuntime<'sidebar.footer.action'> & PropsStore<LabStore>
type OverlayProps = PropsRuntime<'shell.overlay'> & PropsStore<LabStore>
type ModuleLauncherProps = PropsRuntime<'fde.workbench.module.action'> & PropsStore<LabStore>

/** Visible in the full-page home and project center, independent of the sidebar. */
export function LabModuleLauncher({ useStore, actions }: ModuleLauncherProps) {
  const open = useStore(state => state.open)
  return <button type="button" className={css.moduleLauncher} aria-pressed={open} title="独立训练，无需创建或选择项目" onClick={() => actions.open()}>
    <span aria-hidden="true">◈</span>业务挖掘实验室
  </button>
}

/** Same entry in expanded and compact sidebars. */
export function LabLauncher({ wide, useStore, actions }: LauncherProps) {
  const open = useStore(state => state.open)
  return <button type="button" className={css.launcher} data-wide={wide || undefined} aria-label="业务挖掘实验室" aria-pressed={open} title={wide ? undefined : '业务挖掘实验室'} onClick={() => actions.open()}>
    <span aria-hidden="true">◈</span>{wide && <span>业务挖掘实验室</span>}
  </button>
}

/** Full-size frame isolates the original app CSS, React and Pixi lifecycle. */
export function LabOverlay({ useStore, actions }: OverlayProps) {
  const open = useStore(state => state.open)
  if (!open) return null
  return <section className={css.page} role="dialog" aria-modal="true" aria-label="业务挖掘实验室">
    <header className={css.header}>
      <div><strong>业务挖掘实验室</strong><span>独立训练 · 不改变项目阶段</span></div>
      <button type="button" onClick={() => actions.close()}>返回工作台</button>
    </header>
    <LabFrame />
  </section>
}
function LabFrame() {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  return <div className={css.content}>
    {!loaded && !failed && <div className={css.status} role="status">正在加载实验室…</div>}
    {failed && <div className={css.status} role="alert">实验室暂时无法打开，请返回后重试。</div>}
    <iframe className={css.frame} title="业务挖掘实验室训练区" src="/fde-discovery-lab/" onLoad={() => setLoaded(true)} onError={() => setFailed(true)} />
  </div>
}
