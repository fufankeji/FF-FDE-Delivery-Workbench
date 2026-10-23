/** Read-only presentation of one platform-issued isolated project origin. */
import css from './ProjectPreview.module.css'

/** Refuse arbitrary browsing, even for restored or manually edited tab data. */
export function isolatedProjectPreview(value: string): string {
  const url = new URL(value)
  if (url.protocol !== 'http:' || !/^fde-[a-f0-9]{36}\.localhost$/.test(url.hostname) || !url.port || url.username || url.password) {
    throw new Error('Invalid isolated project preview URL')
  }
  return url.href
}

/** The registration adapter supplies only localized copy and the resolved address. */
export function ProjectPreview({ url, title, unavailable }: { url: string | undefined; title: string; unavailable: string }) {
  let source: string | undefined
  try { if (url !== undefined) source = isolatedProjectPreview(url) } catch { /* Restored invalid addresses are never loaded. */ }
  return source === undefined
    ? <p role="alert">{unavailable}</p>
    : <iframe className={css.frame} src={source} title={title} referrerPolicy="no-referrer"
      sandbox="allow-scripts allow-same-origin allow-forms allow-downloads" />
}
