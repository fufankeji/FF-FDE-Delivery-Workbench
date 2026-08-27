/** Shared read-only document preview used by project detail and Better Sidebar. */

import { useEffect, useState } from 'react'
import FileViewer, { type ViewerOptions } from '@file-viewer/react'
import browserProcess from 'process/browser'
import { Buffer as BrowserBuffer } from 'buffer/'
import { renderFileViewerWordDocx, wordRendererDefinitions } from '@file-viewer/renderer-word'
import { renderFileViewerSpreadsheet, spreadsheetRendererDefinition } from '@file-viewer/renderer-spreadsheet'
import { presentationRendererDefinition, renderFileViewerPresentation } from '@file-viewer/renderer-presentation'
import css from './DocumentPreview.module.css'

const browserGlobals = globalThis as unknown as { process?: typeof browserProcess; Buffer?: typeof BrowserBuffer }
browserGlobals.process ??= browserProcess
browserGlobals.Buffer ??= BrowserBuffer
const PPTX_WORKER_URL = '/vendor/pptx/pptx.worker.js'

const wordOpenXmlDefinition = wordRendererDefinitions.find(definition => definition.id === 'office-word-openxml')
if (wordOpenXmlDefinition === undefined) throw new Error('FDE document preview: Word OpenXML renderer definition is unavailable')

const officeRenderers = [{
  id: 'fde-word-openxml',
  definitions: [wordOpenXmlDefinition],
  handlers: [{ rendererId: wordOpenXmlDefinition.id, handler: renderFileViewerWordDocx }],
}, {
  id: 'fde-spreadsheet',
  definitions: [spreadsheetRendererDefinition],
  handlers: [{ rendererId: spreadsheetRendererDefinition.id, handler: renderFileViewerSpreadsheet }],
}, {
  id: 'fde-presentation-openxml',
  definitions: [presentationRendererDefinition],
  handlers: [{ rendererId: presentationRendererDefinition.id, handler: renderFileViewerPresentation }],
}] as unknown as NonNullable<ViewerOptions['renderers']>

export type DocumentPreviewKind = 'office' | 'pdf' | 'image' | 'text' | 'unsupported'

export interface DocumentPreviewProps {
  readonly url: string
  readonly name: string
  readonly size?: number
  readonly kind: DocumentPreviewKind
}

function TextPreview({ url, name }: Pick<DocumentPreviewProps, 'url' | 'name'>) {
  const [state, setState] = useState<{ status: 'loading' } | { status: 'ready'; text: string } | { status: 'error'; message: string }>({ status: 'loading' })
  useEffect(() => {
    const controller = new AbortController()
    setState({ status: 'loading' })
    void fetch(url, { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error(`HTTP ${String(response.status)}`)
      return response.text()
    }).then((text) => { setState({ status: 'ready', text }) }).catch((error: unknown) => {
      if (!controller.signal.aborted) setState({ status: 'error', message: error instanceof Error ? error.message : String(error) })
    })
    return () => { controller.abort() }
  }, [url])
  if (state.status === 'loading') return <div className={css.state}>正在加载 {name}…</div>
  if (state.status === 'error') return <div className={css.state} data-error>预览失败：{state.message}</div>
  return <pre className={css.text}>{state.text}</pre>
}

/** Render one same-origin original without exposing edit actions. */
export function DocumentPreview({ url, name, size, kind }: DocumentPreviewProps) {
  if (kind === 'office') {
    return (
      <div className={css.office} data-testid="fde-office-preview">
        <FileViewer
          key={`${url}:${name}`}
          url={url}
          name={name}
          filename={name}
          {...(size === undefined ? {} : { size })}
          options={{
            renderers: officeRenderers,
            rendererMode: 'replace',
            builtinRenderers: 'none',
            autoRenderers: false,
            styleIsolation: 'shadow',
            theme: 'light',
            locale: 'zh-CN',
            presentation: { workerUrl: PPTX_WORKER_URL, workerType: 'module' },
            toolbar: { download: true, print: true, exportHtml: false, theme: false },
          }}
        />
      </div>
    )
  }
  if (kind === 'pdf') {
    return <object className={css.frame} data={url} type="application/pdf" aria-label={`${name} PDF 预览`}><a href={url}>下载 {name}</a></object>
  }
  if (kind === 'image') return <div className={css.imageWrap}><img src={url} alt={name} /></div>
  if (kind === 'text') return <TextPreview url={url} name={name} />
  return (
    <div className={css.state}>
      <strong>当前格式暂不支持预览</strong>
      <span>原件已经保存，可以下载或进入项目交付后使用其他工程工具打开。</span>
      <a href={url} download={name}>下载原件</a>
    </div>
  )
}
