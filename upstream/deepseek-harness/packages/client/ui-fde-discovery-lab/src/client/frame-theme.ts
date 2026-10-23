/** Mirror display-only theme tokens into the same-origin training frame. */

const TOKENS = [
  '--dsw-font-family', '--dsw-alias-bg-base', '--dsw-alias-bg-layer-1',
  '--dsw-alias-bg-layer-2', '--dsw-alias-bg-overlay', '--dsw-alias-bg-mask-1',
  '--dsw-alias-label-primary', '--dsw-alias-label-secondary', '--dsw-alias-label-tertiary',
  '--dsw-alias-label-caption', '--dsw-alias-label-primary-foreground',
  '--dsw-alias-border-l1', '--dsw-alias-border-l2', '--dsw-alias-interactive-bg-hover',
  '--dsw-alias-state-business-primary', '--dsw-alias-state-business-tertiary',
  '--dsw-alias-state-success-primary', '--dsw-alias-state-success-tertiary',
  '--dsw-alias-state-warn-label', '--dsw-alias-state-warn-tertiary',
  '--dsw-alias-state-error-primary', '--dsw-alias-state-error-tertiary',
  '--dsw-alias-button-primary-fill', '--dsw-alias-button-primary-hover',
  '--dsw-elevation-panel', '--dsw-elevation-prominent',
] as const

/**
 * Follow shell theme changes without reloading the frame or touching training data.
 * @param frame - The application-owned, same-origin lab frame.
 * @returns A disposer removing the source observers and load listener.
 */
export function followFrameTheme(frame: HTMLIFrameElement): () => void {
  const source = frame.ownerDocument
  const sync = (): void => {
    const target = frame.contentDocument
    if (target?.body === null || target?.body === undefined || source.defaultView === null) return
    const styles = source.defaultView.getComputedStyle(source.body)
    for (const name of TOKENS) {
      const value = styles.getPropertyValue(name).trim()
      if (value) target.documentElement.style.setProperty(name, value)
      else target.documentElement.style.removeProperty(name)
    }
    target.documentElement.dataset.fdeNativeTheme = 'true'
    target.documentElement.style.colorScheme = source.body.hasAttribute('data-ds-dark-theme') ? 'dark' : 'light'
    target.body.toggleAttribute('data-ds-dark-theme', source.body.hasAttribute('data-ds-dark-theme'))
  }
  const observer = new MutationObserver(sync)
  const options = { attributes: true, attributeFilter: ['class', 'style', 'data-ds-dark-theme'] }
  observer.observe(source.documentElement, options)
  observer.observe(source.body, options)
  frame.addEventListener('load', sync)
  sync()
  return () => { observer.disconnect(); frame.removeEventListener('load', sync) }
}
