/** Fixed, read-only solution-design deliverable contract. */

import { realpath, stat } from 'node:fs/promises'
import { join, relative, resolve, sep } from 'node:path'
import type { SolutionArtifactSnapshot, SolutionArtifactsSnapshot } from './types.ts'

/** Project-relative directory containing the solution-design outputs. */
export const SOLUTION_ARTIFACT_ROOT = 'fde-deliverables/02-solution-design'
/** Same-origin route serving one verified fixed solution artifact. */
export const SOLUTION_ARTIFACT_FILE_PATH = '/api/fde-project/solution/artifact'

/** The five documents required before an FDE may complete solution design. */
export const SOLUTION_ARTIFACTS = [
  { id: 'project-prd', title: '项目 PRD', fileName: 'project-prd.md' },
  { id: 'solution-design', title: '方案设计', fileName: 'solution-design.md' },
  { id: 'development-plan', title: '研发计划', fileName: 'development-plan.md' },
  { id: 'acceptance-plan', title: '验收方案', fileName: 'acceptance-plan.md' },
  { id: 'solution-baseline', title: '方案基线', fileName: 'solution-baseline.md' },
] as const

/** Stable identifier accepted by the fixed-artifact file route. */
export type SolutionArtifactId = typeof SOLUTION_ARTIFACTS[number]['id']

/** Verified fixed artifact resolved inside one registered Workspace. */
export interface SolutionArtifactFile {
  readonly id: SolutionArtifactId
  readonly title: string
  readonly name: string
  readonly path: string
  readonly filePath: string
  readonly bytes: number
}

function artifactDefinition(id: string): typeof SOLUTION_ARTIFACTS[number] | undefined {
  return SOLUTION_ARTIFACTS.find(candidate => candidate.id === id)
}

function isInside(root: string, candidate: string): boolean {
  const value = relative(root, candidate)
  return value !== '' && value !== '..' && !value.startsWith(`..${sep}`) && !value.startsWith('../')
}

/** Resolve one enumerated solution document without accepting a browser path. */
export async function resolveSolutionArtifact(
  projectRoot: string,
  artifactId: string,
): Promise<SolutionArtifactFile | undefined> {
  const definition = artifactDefinition(artifactId)
  if (definition === undefined) return undefined
  const canonicalRoot = await realpath(resolve(projectRoot))
  const candidate = await realpath(join(projectRoot, SOLUTION_ARTIFACT_ROOT, definition.fileName))
  if (!isInside(canonicalRoot, candidate)) throw new Error('固定产物越过项目目录。')
  const value = await stat(candidate)
  if (!value.isFile()) throw new Error('固定路径不是普通文件。')
  return {
    id: definition.id,
    title: definition.title,
    name: definition.fileName,
    path: `${SOLUTION_ARTIFACT_ROOT}/${definition.fileName}`,
    filePath: candidate,
    bytes: value.size,
  }
}

/** Build the same-origin URL for one fixed solution document. */
export function solutionArtifactFileUrl(workspaceId: string, artifactId: SolutionArtifactId): string {
  return `${SOLUTION_ARTIFACT_FILE_PATH}?${new URLSearchParams({ workspaceId, artifactId }).toString()}`
}

async function inspectArtifact(
  projectRoot: string,
  definition: typeof SOLUTION_ARTIFACTS[number],
  workspaceId?: string,
): Promise<SolutionArtifactSnapshot> {
  const path = `${SOLUTION_ARTIFACT_ROOT}/${definition.fileName}`
  try {
    const value = await resolveSolutionArtifact(projectRoot, definition.id)
    if (value === undefined) throw new Error('固定产物标识无效。')
    return {
      id: definition.id,
      title: definition.title,
      path,
      status: 'present',
      bytes: value.bytes,
      updatedAt: (await stat(value.filePath)).mtime.toISOString(),
      ...(workspaceId === undefined ? {} : { fileUrl: solutionArtifactFileUrl(workspaceId, definition.id) }),
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { id: definition.id, title: definition.title, path, status: 'missing' }
    }
    return {
      id: definition.id,
      title: definition.title,
      path,
      status: 'error',
      message: error instanceof Error ? error.message : String(error),
    }
  }
}

/** Inspect the five fixed solution documents without changing project files. */
export async function loadSolutionArtifacts(projectRoot: string, workspaceId?: string): Promise<SolutionArtifactsSnapshot> {
  const artifacts = await Promise.all(SOLUTION_ARTIFACTS.map(
    async definition => await inspectArtifact(projectRoot, definition, workspaceId),
  ))
  return {
    root: SOLUTION_ARTIFACT_ROOT,
    requiredCount: SOLUTION_ARTIFACTS.length,
    presentCount: artifacts.filter(artifact => artifact.status === 'present').length,
    artifacts,
  }
}
