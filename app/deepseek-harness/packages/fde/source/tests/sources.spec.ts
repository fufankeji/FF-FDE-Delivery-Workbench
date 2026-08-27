import { Buffer } from 'node:buffer'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { strToU8, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import {
  listProjectSources,
  parseProjectSource,
  registerStoredProjectResources,
  createProjectSourceFileHandler,
  createProjectSourceListHandler,
} from '../src/index.ts'
import { storeProjectResourceBatch } from '../src/upload.ts'

function officeArchive(entries: Readonly<Record<string, string>>): Uint8Array {
  return zipSync(Object.fromEntries(Object.entries(entries).map(([name, value]) => [name, strToU8(value)])))
}

function docx(text: string): Uint8Array {
  return officeArchive({
    '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    '_rels/.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    'word/document.xml': `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p><w:sectPr/></w:body></w:document>`,
  })
}

function xlsx(text: string): Uint8Array {
  return officeArchive({
    '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    '_rels/.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml': '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Requirements" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml': `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>${text}</t></is></c></row></sheetData></worksheet>`,
  })
}

function pptx(text: string): Uint8Array {
  return officeArchive({
    '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>',
    '_rels/.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>',
    'ppt/presentation.xml': '<?xml version="1.0" encoding="UTF-8"?><p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst><p:sldSz cx="9144000" cy="6858000"/></p:presentation>',
    'ppt/_rels/presentation.xml.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/></Relationships>',
    'ppt/slides/slide1.xml': `<?xml version="1.0" encoding="UTF-8"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/><p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US"/><a:t>${text}</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`,
  })
}

function pdf(text: string): Uint8Array {
  const stream = `BT /F1 18 Tf 72 720 Td (${text.replace(/[()\\]/gu, value => `\\${value}`)}) Tj ET\n`
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>\nendobj\n',
    `4 0 obj\n<< /Length ${String(Buffer.byteLength(stream))} >>\nstream\n${stream}endstream\nendobj\n`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
  ]
  let output = '%PDF-1.4\n'
  const offsets = [0]
  for (const object of objects) { offsets.push(Buffer.byteLength(output)); output += object }
  const xref = Buffer.byteLength(output)
  output += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(value => `${String(value).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${String(xref)}\n%%EOF\n`
  return Buffer.from(output)
}

async function sourceWorkspace(files: readonly { name: string; data: Uint8Array }[]) {
  const workspace = await mkdtemp(join(tmpdir(), 'fde-sources-'))
  const stored = await storeProjectResourceBatch(workspace, files)
  const records = await registerStoredProjectResources(workspace, stored)
  return { workspace, records }
}

describe('project source records', () => {
  it('keeps stable ids and reconciles an older unindexed original', async () => {
    const { workspace, records } = await sourceWorkspace([{ name: '客户需求.txt', data: Buffer.from('first') }])
    await writeFile(join(workspace, 'fde-resources', '会议纪要.md'), '# meeting')
    const first = await listProjectSources(workspace)
    const second = await listProjectSources(workspace)
    expect(first).toHaveLength(2)
    expect(second.map(item => item.sourceId)).toEqual(first.map(item => item.sourceId))
    expect(first.find(item => item.storedName === '客户需求.txt')?.sourceId).toBe(records[0]?.sourceId)
    expect(first.find(item => item.storedName === '会议纪要.md')?.sourceId).toMatch(/^src_[a-f0-9]{24}$/u)
  })

  it('marks a derived result stale when the original changes', async () => {
    const { workspace, records } = await sourceWorkspace([{ name: 'scope.txt', data: Buffer.from('version one') }])
    const ready = await parseProjectSource(workspace, records[0]!.sourceId)
    expect(ready.parse.status).toBe('ready')
    await writeFile(join(workspace, ready.relativePath), 'version two')
    const [changed] = await listProjectSources(workspace)
    expect(changed?.parse.status).toBe('stale')
  })
})

describe('project source same-origin routes', () => {
  it('lists and reads only the addressed Workspace/Source pair', async () => {
    const alpha = await sourceWorkspace([{ name: '客户说明.txt', data: Buffer.from('alpha original') }])
    const beta = await sourceWorkspace([{ name: '客户说明.txt', data: Buffer.from('beta original') }])
    const options = {
      trusted: () => true,
      workspacePath: (id: string) => ({ alpha: alpha.workspace, beta: beta.workspace } as const)[id as 'alpha' | 'beta'],
      maxFileBytes: 1024,
    }
    const list = createProjectSourceListHandler(options)
    const file = createProjectSourceFileHandler(options)
    const server = createServer((request, response) => {
      if (request.url?.startsWith('/api/fde-project-resources/file') === true) void file(request, response)
      else void list(request, response)
    })
    await new Promise<void>((resolve) => { server.listen(0, '127.0.0.1', resolve) })
    try {
      const address = server.address()
      if (typeof address !== 'object' || address === null) throw new Error('test server has no address')
      const origin = `http://127.0.0.1:${String(address.port)}`
      const listed = await fetch(`${origin}/api/fde-project-resources/list`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ workspaceId: 'alpha' }),
      })
      const payload = await listed.json() as { value: { files: { sourceId: string; fileUrl: string }[] } }
      expect(payload.value.files).toHaveLength(1)
      const original = await fetch(`${origin}${payload.value.files[0]!.fileUrl}`)
      expect(await original.text()).toBe('alpha original')
      const wrongProject = await fetch(`${origin}/api/fde-project-resources/file?workspaceId=beta&sourceId=${alpha.records[0]!.sourceId}`)
      expect(wrongProject.status).toBe(404)
      expect(await wrongProject.text()).not.toContain('alpha original')
    } finally {
      await new Promise<void>((resolve) => { server.close(() => { resolve() }) })
    }
  })
})

describe('local document parsing with generated samples', () => {
  it('extracts DOCX, XLSX, PPTX, PDF, CSV, Markdown and text without model calls', async () => {
    const samples = [
      { name: 'requirement.docx', data: docx('FDE DOCX requirement') },
      { name: 'metrics.xlsx', data: xlsx('FDE XLSX metric') },
      { name: 'solution.pptx', data: pptx('FDE PPTX solution') },
      { name: 'contract.pdf', data: pdf('FDE PDF contract') },
      { name: 'data.csv', data: Buffer.from('name,value\nFDE CSV,accepted') },
      { name: 'notes.md', data: Buffer.from('# FDE Markdown note') },
      { name: 'brief.txt', data: Buffer.from('FDE text brief') },
    ]
    const { workspace, records } = await sourceWorkspace(samples)
    for (const record of records) {
      const parsed = await parseProjectSource(workspace, record.sourceId)
      expect(parsed.parse.status, `${record.storedName}: ${parsed.parse.message ?? ''}`).toBe('ready')
      const markdown = await readFile(join(workspace, parsed.parse.derivedPath!), 'utf8')
      expect(markdown).toContain('FDE')
    }
  }, 30_000)

  it('keeps a damaged Office original and reports a retryable parse failure', async () => {
    const { workspace, records } = await sourceWorkspace([{ name: 'damaged.docx', data: Buffer.from('not a zip') }])
    const parsed = await parseProjectSource(workspace, records[0]!.sourceId)
    expect(parsed.parse.status).toBe('error')
    expect(await readFile(join(workspace, parsed.relativePath), 'utf8')).toBe('not a zip')
  })
})
