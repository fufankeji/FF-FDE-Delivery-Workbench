/** Local, model-free project-document conversion into derived Markdown. */

import { randomUUID } from 'node:crypto'
import { readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import {
  anydocConverter, DocumentConversionError, formatOf, pdfInspectorConverter, routeConverters,
  type ConvertResult,
} from '@jiaoqsh/dsh-document'
import {
  resolveDerivedDirectory, resolveProjectSource, type ProjectSourceRecord,
  updateProjectSourceRecord,
} from './records.ts'
import { assertPathInside } from './upload.ts'

/** Parser identity stored with every current derived result. */
export const LOCAL_DOCUMENT_PARSER = '@jiaoqsh/dsh-document'
/** Exact parser package version stored with every current derived result. */
export const LOCAL_DOCUMENT_PARSER_VERSION = '0.1.1'
const TEXT_EXTENSIONS = new Set(['.md', '.markdown', '.txt', '.json', '.yaml', '.yml', '.xml'])

function readableError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function decodeText(bytes: Uint8Array): string {
  if (bytes.includes(0)) throw new DocumentConversionError('文件包含二进制空字节，不能按文本识别。', 'malformed')
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes).trim()
  if (text.length === 0) throw new DocumentConversionError('文件没有可识别文本。', 'empty')
  return text
}

async function convert(name: string, bytes: Uint8Array, signal: AbortSignal): Promise<ConvertResult> {
  const extension = extname(name).toLowerCase()
  if (TEXT_EXTENSIONS.has(extension)) return { markdown: decodeText(bytes) }
  const format = formatOf(name)
  if (format === undefined) throw new DocumentConversionError('当前本地识别器不支持此格式。', 'unsupported')
  const converter = routeConverters([
    pdfInspectorConverter({ profile: 'compact' }),
    anydocConverter(),
  ])(format)
  return converter.convert({ bytes, format, signal })
}

async function writeDerived(workspace: string, sourceId: string, markdown: string): Promise<string> {
  const directory = await resolveDerivedDirectory(workspace)
  const name = `${sourceId}.md`
  const target = join(directory, name)
  const temporary = join(directory, `.derived-${randomUUID()}`)
  assertPathInside(directory, target)
  assertPathInside(directory, temporary)
  try {
    await writeFile(temporary, `${markdown.trim()}\n`, { encoding: 'utf8', flag: 'wx', mode: 0o600 })
    await rename(temporary, target)
  } finally {
    await unlink(temporary).catch(() => undefined)
  }
  return `.fde/derived/${name}`
}

/**
 * Parse one saved source locally; failures update status but never remove the original.
 * @param workspacePath - explicit project root backing the addressed Workspace.
 * @param sourceId - stable Source identity to convert.
 * @param signal - optional cancellation signal for the local converter.
 * @returns the complete Source record after conversion or classified failure.
 */
export async function parseProjectSource(
  workspacePath: string,
  sourceId: string,
  signal: AbortSignal = new AbortController().signal,
): Promise<ProjectSourceRecord> {
  const resolved = await resolveProjectSource(workspacePath, sourceId)
  const processing: ProjectSourceRecord = {
    ...resolved.record,
    parse: {
      status: 'processing',
      parser: LOCAL_DOCUMENT_PARSER,
      parserVersion: LOCAL_DOCUMENT_PARSER_VERSION,
      sourceBytes: resolved.record.bytes,
      sourceMtimeMs: resolved.record.mtimeMs,
      updatedAt: new Date().toISOString(),
      ...(resolved.record.parse.derivedPath === undefined ? {} : { derivedPath: resolved.record.parse.derivedPath }),
      ...(resolved.record.parse.pdf === undefined ? {} : { pdf: resolved.record.parse.pdf }),
    },
  }
  await updateProjectSourceRecord(resolved.recordDirectory, processing)
  try {
    const result = await convert(processing.storedName, new Uint8Array(await readFile(resolved.path)), signal)
    const derivedPath = await writeDerived(resolved.workspace, sourceId, result.markdown)
    const ready: ProjectSourceRecord = {
      ...processing,
      parse: {
        status: 'ready',
        parser: LOCAL_DOCUMENT_PARSER,
        parserVersion: LOCAL_DOCUMENT_PARSER_VERSION,
        sourceBytes: processing.bytes,
        sourceMtimeMs: processing.mtimeMs,
        derivedPath,
        updatedAt: new Date().toISOString(),
        ...(result.pdf === undefined ? {} : { pdf: result.pdf }),
      },
    }
    await updateProjectSourceRecord(resolved.recordDirectory, ready)
    return ready
  } catch (error) {
    const needsOcr = error instanceof DocumentConversionError && error.code === 'scanned'
    const unsupported = error instanceof DocumentConversionError && error.code === 'unsupported'
    const failed: ProjectSourceRecord = {
      ...processing,
      parse: {
        ...processing.parse,
        status: needsOcr ? 'needs-ocr' : unsupported ? 'unsupported' : 'error',
        updatedAt: new Date().toISOString(),
        message: readableError(error),
      },
    }
    await updateProjectSourceRecord(resolved.recordDirectory, failed)
    return failed
  }
}
