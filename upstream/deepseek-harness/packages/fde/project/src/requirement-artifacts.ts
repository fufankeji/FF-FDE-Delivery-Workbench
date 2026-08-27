/** Fixed, read-only requirement-research deliverable contract. */

import { realpath, stat } from 'node:fs/promises'
import { join, relative, resolve, sep } from 'node:path'
import type { RequirementArtifactSnapshot, RequirementArtifactsSnapshot } from './types.ts'

/** Project-relative directory containing the requirement-research outputs. */
export const REQUIREMENT_ARTIFACT_ROOT = 'fde-deliverables/01-requirement-research'
/** Same-origin route serving one verified fixed requirement artifact. */
export const REQUIREMENT_ARTIFACT_FILE_PATH = '/api/fde-project/requirements/artifact'

/** The three outputs required before an FDE may complete requirement research. */
export const REQUIREMENT_ARTIFACTS = [
  { id: 'research-report', title: '需求调研报告', fileName: 'requirement-research-report.md' },
  { id: 'confirmation-checklist', title: '需求确认清单', fileName: 'confirmation-checklist.md' },
  { id: 'requirement-baseline', title: '需求基线', fileName: 'requirement-baseline.md' },
] as const

/** Stable identifier accepted by the fixed-artifact file route. */
export type RequirementArtifactId = typeof REQUIREMENT_ARTIFACTS[number]['id']

/** Verified fixed artifact resolved inside one registered Workspace. */
export interface RequirementArtifactFile {
  readonly id: RequirementArtifactId
  readonly title: string
  readonly name: string
  readonly path: string
  readonly filePath: string
  readonly bytes: number
}

function artifactDefinition(id: string): typeof REQUIREMENT_ARTIFACTS[number] | undefined {
  return REQUIREMENT_ARTIFACTS.find(candidate => candidate.id === id)
}

function isInside(root: string, candidate: string): boolean {
  const value = relative(root, candidate)
  return value !== '' && value !== '..' && !value.startsWith(`..${sep}`) && !value.startsWith('../')
}

/**
 * Resolve one enumerated deliverable without accepting a browser-supplied path.
 * @param projectRoot - canonical Workspace path.
 * @param artifactId - one of the three fixed requirement artifact ids.
 * @returns the verified file, or undefined for an unknown id.
 */
export async function resolveRequirementArtifact(
  projectRoot: string,
  artifactId: string,
): Promise<RequirementArtifactFile | undefined> {
  const definition = artifactDefinition(artifactId)
  if (definition === undefined) return undefined
  const canonicalRoot = await realpath(resolve(projectRoot))
  const candidate = await realpath(join(projectRoot, REQUIREMENT_ARTIFACT_ROOT, definition.fileName))
  if (!isInside(canonicalRoot, candidate)) throw new Error('固定产物越过项目目录。')
  const value = await stat(candidate)
  if (!value.isFile()) throw new Error('固定路径不是普通文件。')
  return {
    id: definition.id,
    title: definition.title,
    name: definition.fileName,
    path: `${REQUIREMENT_ARTIFACT_ROOT}/${definition.fileName}`,
    filePath: candidate,
    bytes: value.size,
  }
}

/**
 * Build the same-origin URL for one fixed requirement artifact.
 * @param workspaceId - exact registered project identity.
 * @param artifactId - fixed artifact identity.
 * @returns a URL that carries no filesystem path.
 */
export function requirementArtifactFileUrl(workspaceId: string, artifactId: RequirementArtifactId): string {
  return `${REQUIREMENT_ARTIFACT_FILE_PATH}?${new URLSearchParams({ workspaceId, artifactId }).toString()}`
}

async function inspectArtifact(
  projectRoot: string,
  definition: typeof REQUIREMENT_ARTIFACTS[number],
  workspaceId?: string,
): Promise<RequirementArtifactSnapshot> {
  const path = `${REQUIREMENT_ARTIFACT_ROOT}/${definition.fileName}`
  try {
    const value = await resolveRequirementArtifact(projectRoot, definition.id)
    if (value === undefined) throw new Error('固定产物标识无效。')
    return {
      id: definition.id,
      title: definition.title,
      path,
      status: 'present',
      bytes: value.bytes,
      updatedAt: (await stat(value.filePath)).mtime.toISOString(),
      ...(workspaceId === undefined ? {} : { fileUrl: requirementArtifactFileUrl(workspaceId, definition.id) }),
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

/**
 * Inspect the three fixed outputs without creating or changing project files.
 * @param projectRoot - canonical Workspace path.
 * @param workspaceId - optional browser-visible project identity used only to create fixed file URLs.
 * @returns the bounded status used by Project Progress and the manual stage gate.
 */
export async function loadRequirementArtifacts(projectRoot: string, workspaceId?: string): Promise<RequirementArtifactsSnapshot> {
  const artifacts = await Promise.all(REQUIREMENT_ARTIFACTS.map(
    async definition => await inspectArtifact(projectRoot, definition, workspaceId),
  ))
  return {
    root: REQUIREMENT_ARTIFACT_ROOT,
    requiredCount: REQUIREMENT_ARTIFACTS.length,
    presentCount: artifacts.filter(artifact => artifact.status === 'present').length,
    artifacts,
  }
}
