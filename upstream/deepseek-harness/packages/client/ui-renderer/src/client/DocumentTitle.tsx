import { useEffect } from 'react'

const DEFAULT_CLIENT_TITLE = 'FF - FDE 交付工作台'

/** Props for the browser title projection. */
export interface DocumentTitleProps {
  /** Durable title of the selected session, or undefined for the product title. */
  title?: string
}

/**
 * Keep the product first, followed by the selected durable session title, and
 * restore the build-selected product title when unmounted.
 * @param props - Selected session title projection.
 * @returns No rendered content.
 */
export function DocumentTitle({ title }: DocumentTitleProps): null {
  const productTitle = process.env.DSH_CLIENT_TITLE ?? DEFAULT_CLIENT_TITLE
  useEffect(() => {
    document.title = title === undefined ? productTitle : `${productTitle} — ${title}`
    return () => { document.title = productTitle }
  }, [productTitle, title])
  return null
}
