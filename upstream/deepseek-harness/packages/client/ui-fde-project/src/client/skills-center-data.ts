/** Canonical platform files from the Host and explicitly supplied course packages. */
import { strToU8, zipSync } from 'fflate/browser'
import type { StageSkillCatalogMethod, StageSkillCatalogValue } from './stage-skill-catalog.ts'
import diagnosis from './course-skills/fde-business-diagnosis.json'

/** Approved display order; other runtime stages remain outside this library. */
export const STAGE_ONE_SKILL_IDS = [
  'qualify-ai-workflow', 'fde-orient', 'knowledge-interview', 'ownership-map',
  'repo-recon', 'stakeholder-brief', 'reframe-ai-engagement',
] as const

/** Original file bytes shared by the reader and downloaded archive. */
export interface SkillFile {
  readonly path: string
  readonly content: string
  readonly encoding?: string
  readonly mediaType?: string
}

/** Content shared by the reader and archive for either source category. */
interface LibrarySkillContent {
  readonly id: string
  readonly label: string
  readonly description: string
  readonly whenToUse: string
  readonly entryPath: string
  readonly files: readonly SkillFile[]
}

/** A standard platform package shared with the native Agent file loader. */
export interface PlatformSkill extends LibrarySkillContent {
  readonly source: 'platform'
  readonly id: typeof STAGE_ONE_SKILL_IDS[number]
  readonly number: number
}

/** A user-provided course snapshot, never registered as an Agent capability. */
export interface CourseSkill extends LibrarySkillContent {
  readonly source: 'course'
  readonly course: { readonly title: string; readonly lessonNumber: number; readonly lessonTitle: string }
  readonly importedAt: string
  readonly version: string
}

/** Source identity remains separate even when two packages share a Skill name. */
export type LibrarySkill = PlatformSkill | CourseSkill

/** Explicitly approved original packages; no runtime filesystem scan or Skill installation. */
export const COURSE_SKILLS: readonly CourseSkill[] = [{ ...diagnosis, source: 'course', entryPath: 'SKILL.md' }]

function filesOf(method: StageSkillCatalogMethod) {
  if (method.source !== 'platform' || method.entryPath === undefined || method.files === undefined) {
    throw new Error(`平台 Skill 文件不可用：${method.id}`)
  }
  return { entryPath: method.entryPath, files: method.files }
}

/**
 * Build only the seven approved packages, failing visibly if the runtime lacks one.
 * @param catalog - Validated runtime catalog.
 * @returns Files and metadata shared by the reader and download actions.
 */
export function stageOneLibrary(catalog: StageSkillCatalogValue): readonly PlatformSkill[] {
  const methods = catalog.stages.find(stage => stage.id === 'requirements' && stage.index === 0)?.methods
  return STAGE_ONE_SKILL_IDS.map((id, index) => {
    const method = methods?.find(item => item.id === id)
    if (method === undefined) throw new Error(`第一阶段方法缺失：${id}`)
    return { ...filesOf(method), source: 'platform', id, number: index + 1,
      label: method.label, description: method.description, whenToUse: method.whenToUse }
  })
}

/**
 * Match authored names, identifiers and uses without changing the source order.
 * @param skills - Available platform and course originals.
 * @param query - User search text.
 * @returns Matching real packages.
 */
export function searchLibrary(skills: readonly LibrarySkill[], query: string): readonly LibrarySkill[] {
  const needle = query.trim().toLocaleLowerCase()
  return skills.filter(skill => [skill.id, skill.label, skill.description, skill.whenToUse,
    ...(skill.source === 'course' ? [skill.course.title, skill.course.lessonTitle, String(skill.course.lessonNumber)] : []),
  ].some(value => value.toLocaleLowerCase().includes(needle)))
}

/** One real file or a directory implied by at least one real file path. */
export type SkillTreeNode =
  | { readonly kind: 'file'; readonly path: string; readonly name: string }
  | { readonly kind: 'directory'; readonly path: string; readonly name: string; readonly children: SkillTreeNode[] }

/**
 * Preserve file order while forming the package's actual nested directories.
 * @param files - The same relative file paths used for archive entries.
 * @returns Root children; no folders without real descendants are added.
 */
export function skillFileTree(files: readonly SkillFile[]): SkillTreeNode[] {
  const root: SkillTreeNode[] = []
  for (const file of files) {
    const parts = file.path.split('/')
    let children = root
    for (const [index, name] of parts.entries()) {
      const path = parts.slice(0, index + 1).join('/')
      if (index === parts.length - 1) children.push({ kind: 'file', name, path })
      else {
        let directory = children.find(node => node.kind === 'directory' && node.path === path)
        if (directory?.kind !== 'directory') {
          directory = { kind: 'directory', name, path, children: [] }
          children.push(directory)
        }
        children = directory.children
      }
    }
  }
  return root
}

/**
 * Resolve a relative document link only when it names an actual package file.
 * @param files - Explicit package contents, never user or system filesystem paths.
 * @param currentPath - The displayed document's package-relative path.
 * @param value - Authored link destination.
 * @returns The contained file path, or undefined for external, escaping or missing targets.
 */
export function resolveSkillFile(files: readonly SkillFile[], currentPath: string, value: string): string | undefined {
  let decoded: string
  try { decoded = decodeURIComponent(value.split(/[?#]/)[0] ?? '') } catch { return undefined }
  if (decoded === '' || /^(?:[a-z][a-z0-9+.-]*:|\/)/i.test(decoded) || decoded.includes('\\')) return undefined
  const parts = currentPath.split('/').slice(0, -1)
  for (const part of decoded.split('/')) {
    if (part === '' || part === '.') continue
    if (part === '..') {
      if (parts.length === 0) return undefined
      parts.pop()
    } else parts.push(part)
  }
  const path = parts.join('/')
  return files.some(file => file.path === path) ? path : undefined
}

/**
 * Encode every original byte under one named Skill directory, preserving source paths.
 * @param skill - Selected library package.
 * @returns A ZIP with a stable file list, without project or filesystem access.
 */
export function skillArchive(skill: LibrarySkill): Uint8Array {
  // fflate identifies entries with instanceof; normalize TextEncoder results from another JS realm.
  return zipSync(Object.fromEntries(skill.files.map(file => [
    skill.source === 'platform' ? file.path : `${skill.id}/${file.path}`, new Uint8Array(skillFileBytes(file)),
  ])), { level: 6 })
}

/**
 * Decode the stored original without normalizing text or binary resources.
 * @param file - Bundled source file.
 * @returns Original downloadable bytes.
 */
export function skillFileBytes(file: SkillFile): Uint8Array {
  return file.encoding === 'base64' ? strToU8(atob(file.content), true) : strToU8(file.content)
}

/**
 * Ask the browser to save generated bytes; no server files or state are written.
 * @param filename - Library-owned download filename.
 * @param content - Exact file or archive content.
 * @param mime - Browser download media type.
 */
export function saveSkillDownload(filename: string, content: string | Uint8Array, mime: string): void {
  const body = typeof content === 'string' ? content : new Uint8Array(content).buffer
  const url = URL.createObjectURL(new Blob([body], { type: mime }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  try { link.click() } finally {
    link.remove()
    // Leave the Blob alive long enough for the browser to begin reading it.
    setTimeout(() => { URL.revokeObjectURL(url) }, 1_000)
  }
}
