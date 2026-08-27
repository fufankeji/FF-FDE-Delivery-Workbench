/** Read-only project-development documentation and progress contract. */

import { readdir, readFile, realpath, stat } from 'node:fs/promises'
import { basename, join, relative, resolve, sep } from 'node:path'
import type {
  DevelopmentArtifactSnapshot,
  DevelopmentDocsSnapshot,
  DevelopmentFeatureSnapshot,
} from './types.ts'

/** Canonical documentation root used as the development progress source. */
export const DEVELOPMENT_DOCS_ROOT = 'docs'
/** Canonical development close-out root. */
export const DEVELOPMENT_CLOSURE_ROOT = 'fde-deliverables/03-project-development'
/** Same-origin route serving one Host-indexed development document. */
export const DEVELOPMENT_ARTIFACT_FILE_PATH = '/api/fde-project/development/artifact'

const MAX_FEATURES = 100
const MAX_DOCUMENT_BYTES = 512 * 1024
const FEATURE_DIRECTORY = /^F\d{3}-[a-z0-9][a-z0-9-]*$/i
const TASK_LINE = /^\s*[-*]\s+\[([ xX])\]\s+/u

interface DevelopmentArtifactDefinition {
  readonly id: string
  readonly title: string
  readonly path: string
  readonly kind: DevelopmentArtifactSnapshot['kind']
}

const CORE_ARTIFACTS: readonly DevelopmentArtifactDefinition[] = [
  { id: 'core-prd', title: '项目 PRD', path: 'docs/PRD.md', kind: 'core' },
  { id: 'core-product-spec', title: '产品总规格', path: 'docs/specs/product-spec.md', kind: 'core' },
  { id: 'core-feature-map', title: 'Feature Map', path: 'docs/specs/feature-map.md', kind: 'core' },
]

/** Fixed documents required before an FDE may submit project development. */
export const DEVELOPMENT_CLOSURE_ARTIFACTS: readonly DevelopmentArtifactDefinition[] = [
  { id: 'closure-implementation-report', title: '实施报告', path: `${DEVELOPMENT_CLOSURE_ROOT}/implementation-report.md`, kind: 'closure' },
  { id: 'closure-runbook', title: '运行手册', path: `${DEVELOPMENT_CLOSURE_ROOT}/runbook.md`, kind: 'closure' },
  { id: 'closure-development-baseline', title: '研发基线', path: `${DEVELOPMENT_CLOSURE_ROOT}/development-baseline.md`, kind: 'closure' },
]

const FEATURE_FILES = [
  { suffix: 'spec', title: 'Feature Spec', fileName: 'spec.md' },
  { suffix: 'plan', title: '实施计划', fileName: 'plan.md' },
  { suffix: 'tasks', title: '任务清单', fileName: 'tasks.md' },
] as const

/** Verified development document resolved inside one registered Workspace. */
export interface DevelopmentArtifactFile {
  readonly id: string
  readonly title: string
  readonly name: string
  readonly path: string
  readonly filePath: string
  readonly bytes: number
}

function isInside(root: string, candidate: string): boolean {
  const value = relative(root, candidate)
  return value !== '' && value !== '..' && !value.startsWith(`..${sep}`) && !value.startsWith('../')
}

function stripQuotes(value: string): string {
  const trimmed = value.trim()
  if (trimmed.length >= 2 && ((trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith("'") && trimmed.endsWith("'")))) return trimmed.slice(1, -1)
  return trimmed
}

function frontmatterOf(content: string): Readonly<Record<string, string>> {
  if (!content.startsWith('---\n') && !content.startsWith('---\r\n')) return {}
  const lines = content.split(/\r?\n/u)
  const result: Record<string, string> = {}
  for (let index = 1; index < Math.min(lines.length, 80); index += 1) {
    const line = lines[index]
    if (line === undefined) continue
    if (line === '---') break
    const separator = line.indexOf(':')
    if (separator < 1) continue
    const key = line.slice(0, separator).trim()
    if (!/^[a-z][a-z0-9_-]*$/i.test(key)) continue
    result[key] = stripQuotes(line.slice(separator + 1))
  }
  return result
}

function headingOf(content: string): string | undefined {
  const match = /^#\s+(.+)$/mu.exec(content)
  return match?.[1]?.replace(/^F\d{3}\s*[·:-]\s*/u, '').trim()
}

function featureDefinition(directory: string, featureId: string, file: typeof FEATURE_FILES[number]): DevelopmentArtifactDefinition {
  return {
    id: `feature-${featureId}-${file.suffix}`,
    title: file.title,
    path: `docs/specs/${directory}/${file.fileName}`,
    kind: 'feature',
  }
}

function artifactFileUrl(workspaceId: string, artifactId: string): string {
  return `${DEVELOPMENT_ARTIFACT_FILE_PATH}?${new URLSearchParams({ workspaceId, artifactId }).toString()}`
}

async function inspectArtifact(
  projectRoot: string,
  definition: DevelopmentArtifactDefinition,
  workspaceId?: string,
): Promise<DevelopmentArtifactSnapshot> {
  try {
    const canonicalRoot = await realpath(resolve(projectRoot))
    const candidate = await realpath(join(projectRoot, definition.path))
    if (!isInside(canonicalRoot, candidate)) throw new Error('研发文档越过项目目录。')
    const value = await stat(candidate)
    if (!value.isFile()) throw new Error('研发文档路径不是普通文件。')
    return {
      ...definition,
      status: 'present',
      bytes: value.size,
      updatedAt: value.mtime.toISOString(),
      ...(workspaceId === undefined ? {} : { fileUrl: artifactFileUrl(workspaceId, definition.id) }),
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { ...definition, status: 'missing' }
    return {
      ...definition,
      status: 'error',
      message: error instanceof Error ? error.message : String(error),
    }
  }
}

async function readBoundedDocument(projectRoot: string, path: string): Promise<string | undefined> {
  try {
    const candidate = join(projectRoot, path)
    const value = await stat(candidate)
    if (!value.isFile() || value.size > MAX_DOCUMENT_BYTES) return undefined
    return await readFile(candidate, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw error
  }
}

function firstValue(records: readonly Readonly<Record<string, string>>[], key: string): string | undefined {
  return records.map(record => record[key]?.trim()).find(value => value !== undefined && value !== '')
}

async function inspectFeature(
  projectRoot: string,
  directory: string,
  workspaceId?: string,
): Promise<DevelopmentFeatureSnapshot> {
  const id = directory.slice(0, 4).toUpperCase()
  const definitions = FEATURE_FILES.map(file => featureDefinition(directory, id, file))
  const [artifacts, documents] = await Promise.all([
    Promise.all(definitions.map(async definition => await inspectArtifact(projectRoot, definition, workspaceId))),
    Promise.all(definitions.map(async definition => await readBoundedDocument(projectRoot, definition.path))),
  ])
  const metadata = documents.map(content => content === undefined ? {} : frontmatterOf(content))
  const tasks = documents[2]
  let taskTotal = 0
  let taskCompleted = 0
  if (tasks !== undefined) {
    for (const line of tasks.split(/\r?\n/u)) {
      const match = TASK_LINE.exec(line)
      if (match === null) continue
      taskTotal += 1
      if (match[1]?.toLowerCase() === 'x') taskCompleted += 1
    }
  }
  const fallbackTitle = directory.slice(5).split('-').filter(Boolean).join(' ')
  const title = firstValue(metadata, 'title') ?? documents.map(content => content === undefined ? undefined : headingOf(content)).find(Boolean) ?? fallbackTitle
  const plannedStart = firstValue(metadata, 'planned_start')
  const plannedEnd = firstValue(metadata, 'planned_end')
  const milestone = firstValue(metadata, 'milestone')
  const blocker = firstValue(metadata, 'blocker') ?? firstValue(metadata, 'blockers')
  const status = firstValue(metadata, 'status') ?? 'unknown'
  return {
    id,
    title,
    directory: `docs/specs/${directory}`,
    status,
    ...(plannedStart === undefined ? {} : { plannedStart }),
    ...(plannedEnd === undefined ? {} : { plannedEnd }),
    ...(milestone === undefined ? {} : { milestone }),
    ...(blocker === undefined ? {} : { blocker }),
    taskTotal,
    taskCompleted,
    artifacts,
  }
}

async function featureDirectories(projectRoot: string): Promise<readonly string[]> {
  try {
    const entries = await readdir(join(projectRoot, DEVELOPMENT_DOCS_ROOT, 'specs'), { withFileTypes: true })
    return entries
      .filter(entry => entry.isDirectory() && FEATURE_DIRECTORY.test(entry.name))
      .map(entry => entry.name)
      .sort((left, right) => left.localeCompare(right, 'en'))
      .slice(0, MAX_FEATURES)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
}

/** Inspect the project docs and close-out files without changing them. */
export async function loadDevelopmentDocs(projectRoot: string, workspaceId?: string): Promise<DevelopmentDocsSnapshot> {
  const directories = await featureDirectories(projectRoot)
  const duplicateIds = new Set<string>()
  const seenIds = new Set<string>()
  const accepted: string[] = []
  for (const directory of directories) {
    const id = directory.slice(0, 4).toUpperCase()
    if (seenIds.has(id)) duplicateIds.add(id)
    else { seenIds.add(id); accepted.push(directory) }
  }
  const [coreArtifacts, features, closureArtifacts] = await Promise.all([
    Promise.all(CORE_ARTIFACTS.map(async definition => await inspectArtifact(projectRoot, definition, workspaceId))),
    Promise.all(accepted.map(async directory => await inspectFeature(projectRoot, directory, workspaceId))),
    Promise.all(DEVELOPMENT_CLOSURE_ARTIFACTS.map(async definition => await inspectArtifact(projectRoot, definition, workspaceId))),
  ])
  return {
    root: DEVELOPMENT_DOCS_ROOT,
    core: {
      requiredCount: CORE_ARTIFACTS.length,
      presentCount: coreArtifacts.filter(artifact => artifact.status === 'present').length,
      artifacts: coreArtifacts,
    },
    features,
    closure: {
      root: DEVELOPMENT_CLOSURE_ROOT,
      requiredCount: DEVELOPMENT_CLOSURE_ARTIFACTS.length,
      presentCount: closureArtifacts.filter(artifact => artifact.status === 'present').length,
      artifacts: closureArtifacts,
    },
    issues: [...duplicateIds].sort().map(id => `发现重复 Feature ID：${id}；只展示排序后的第一份目录。`),
  }
}

/** Resolve one Host-indexed development document without accepting a browser path. */
export async function resolveDevelopmentArtifact(
  projectRoot: string,
  artifactId: string,
): Promise<DevelopmentArtifactFile | undefined> {
  const snapshot = await loadDevelopmentDocs(projectRoot)
  const all = [
    ...snapshot.core.artifacts,
    ...snapshot.features.flatMap(feature => feature.artifacts),
    ...snapshot.closure.artifacts,
  ]
  const artifact = all.find(candidate => candidate.id === artifactId && candidate.status === 'present')
  if (artifact === undefined) return undefined
  const canonicalRoot = await realpath(resolve(projectRoot))
  const candidate = await realpath(join(projectRoot, artifact.path))
  if (!isInside(canonicalRoot, candidate)) throw new Error('研发文档越过项目目录。')
  const value = await stat(candidate)
  if (!value.isFile()) throw new Error('研发文档路径不是普通文件。')
  return {
    id: artifact.id,
    title: artifact.title,
    name: basename(artifact.path),
    path: artifact.path,
    filePath: candidate,
    bytes: value.size,
  }
}
