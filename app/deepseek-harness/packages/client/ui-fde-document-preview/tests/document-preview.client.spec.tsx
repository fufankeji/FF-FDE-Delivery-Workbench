// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'

const fileViewerMock = vi.hoisted(() => vi.fn((_props: unknown) => null))

vi.mock('@file-viewer/react', () => ({ default: fileViewerMock }))
vi.mock('@file-viewer/renderer-word', () => ({
  wordRendererDefinitions: [{ id: 'office-word-openxml' }],
  renderFileViewerWordDocx: vi.fn(),
}))
vi.mock('@file-viewer/renderer-spreadsheet', () => ({
  spreadsheetRendererDefinition: { id: 'office-spreadsheet' },
  renderFileViewerSpreadsheet: vi.fn(),
}))
vi.mock('@file-viewer/renderer-presentation', () => ({
  presentationRendererDefinition: { id: 'office-presentation' },
  renderFileViewerPresentation: vi.fn(),
}))

import { DocumentPreview } from '../src/client/DocumentPreview.tsx'

afterEach(() => {
  cleanup()
  fileViewerMock.mockClear()
})

describe('DocumentPreview Office rendering', () => {
  it('keeps Office pages light instead of inheriting the system dark preference', () => {
    render(<DocumentPreview
      url="/fde/source-file"
      name="customer-source.xlsx"
      kind="office"
    />)

    expect(fileViewerMock).toHaveBeenCalledTimes(1)
    expect(fileViewerMock.mock.calls[0]?.[0]).toMatchObject({
      options: {
        theme: 'light',
        presentation: {
          workerUrl: '/vendor/pptx/pptx.worker.js',
          workerType: 'module',
        },
        toolbar: { theme: false },
      },
    })
  })

  it.each([
    'customer-requirements.docx',
    'customer-data.xlsx',
    'customer-status.pptx',
    'customer-orders.csv',
    'customer-orders.tsv',
  ])('lets File Viewer infer the renderer from the stored filename %s', (name) => {
    render(<DocumentPreview
      url="/fde/source-file"
      name={name}
      kind="office"
    />)

    expect(fileViewerMock).toHaveBeenCalledTimes(1)
    expect(fileViewerMock.mock.calls[0]?.[0]).toMatchObject({ filename: name })
    expect(fileViewerMock.mock.calls[0]?.[0]).not.toHaveProperty('type')
  })
})
