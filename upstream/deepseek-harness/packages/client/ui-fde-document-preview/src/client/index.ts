/** Register shared project and Better Sidebar document viewers. */

import { createElement } from 'react'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { ProjectSourcePreviewOwnerProps } from '@deepseek-ai/dsh-client-ui-fde-project/client'
import type { FileViewerProps } from 'dsh-better-sidebar'
import type {} from 'dsh-better-sidebar'
import { DocumentPreview } from './DocumentPreview.tsx'

type ProjectSourcePreviewProps = PropsRuntime<'fde.project.source.preview'> & ProjectSourcePreviewOwnerProps

function ProjectSourcePreview({ source }: ProjectSourcePreviewProps) {
  return createElement(DocumentPreview, {
    url: source.fileUrl,
    name: source.storedName,
    mimeType: source.mimeType,
    size: source.bytes,
    kind: source.previewKind,
  })
}

function BetterSidebarOfficePreview({ mediaUrl, title, path }: FileViewerProps) {
  if (mediaUrl === undefined) return createElement('div', null, 'Office 原件地址不可用。')
  return createElement(DocumentPreview, {
    url: mediaUrl,
    name: title || path.split('/').at(-1) || path,
    kind: 'office',
  })
}

export const inject = ['slots', 'betterSidebar']

/** Install the project-detail occupant and Office file viewer in one lifecycle. */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.betterSidebar.registerFileViewer({
    id: 'fde-office',
    title: 'FDE Office 预览',
    exts: [
      'docx', 'docm', 'dotx', 'dotm',
      'xlsx', 'xltx', 'xlsm', 'xlsb', 'xls', 'xlt', 'xla', 'xlam', 'xltm', 'csv', 'tsv', 'ods', 'fods',
      'pptx', 'pptm', 'potx', 'potm', 'ppsx', 'ppsm',
    ],
    priority: 60,
    fetchStrategy: 'mediaUrl',
    component: BetterSidebarOfficePreview,
  }), 'ui-fde-document-preview: Better Sidebar Office viewer')

  ctx.slots.inject('fde.project.source.preview', () => ctx.slots.register({
    name: 'fde.project.source.preview',
  }, ProjectSourcePreview))
}
