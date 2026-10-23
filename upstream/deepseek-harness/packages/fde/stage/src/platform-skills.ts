/** Canonical platform Skill files shared by native loading, the catalog and downloads. */
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, posix, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import type { Context } from '@deepseek-ai/cordis'
import { FileSystemSkillProvider } from '@deepseek-ai/dsh-skill-filesystem'
import { parse } from 'yaml'
import type { StageSkillCatalogValue } from './http.ts'

/** Fixed platform entries; neither project nor user Skill directories are enumerated here. */
export const PLATFORM_SKILL_IDS = [
  'qualify-ai-workflow', 'fde-orient', 'knowledge-interview', 'ownership-map',
  'repo-recon', 'stakeholder-brief', 'reframe-ai-engagement',
] as const

/** Packaged files remain beside src/ and lib/ rather than inside a generated bundle. */
export const PLATFORM_SKILLS_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../skills')

function pathsUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) return pathsUnder(path)
    if (!entry.isFile()) throw new Error(`平台 Skill 不允许符号链接或特殊文件：${entry.name}`)
    return [relative(PLATFORM_SKILLS_ROOT, path).split('\\').join('/')]
  }).sort()
}

function textAt(path: string): string {
  const bytes = readFileSync(resolve(PLATFORM_SKILLS_ROOT, path))
  const text = bytes.toString('utf8')
  if (!Buffer.from(text).equals(bytes)) throw new Error(`平台 Skill 仅接受 UTF-8 文本资源：${path}`)
  return text
}

/**
 * Read one maintained entry without a separate copy of its instructions.
 * @param id - One of the seven platform method identifiers.
 * @returns Metadata and the same trimmed body returned by the native file provider.
 */
export function readPlatformSkill(id: typeof PLATFORM_SKILL_IDS[number]) {
  const entryPath = `${id}/SKILL.md`
  const raw = textAt(entryPath)
  const header = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(raw)
  if (header === null) throw new Error(`平台 Skill 缺少元数据：${id}`)
  const metadata = parse(header[1] ?? '') as { name?: unknown; description?: unknown; metadata?: Record<string, unknown> }
  if (metadata.name !== id || typeof metadata.description !== 'string' || typeof metadata.metadata?.when_to_use !== 'string'
    || typeof metadata.metadata.display_name !== 'string') {
    throw new Error(`平台 Skill 元数据无效：${id}`)
  }
  return {
    name: id, label: metadata.metadata.display_name, description: metadata.description, whenToUse: metadata.metadata.when_to_use,
    source: 'platform', content: raw.slice(header[0].length).trim(), entryPath,
  } as const
}

function filesFor(id: typeof PLATFORM_SKILL_IDS[number]) {
  const known = new Set(pathsUnder(PLATFORM_SKILLS_ROOT))
  const files = new Set([...known].filter(path => path.startsWith(`${id}/`) || path.startsWith('_licenses/')))
  const queue = [...files]
  for (let index = 0; index < queue.length; index += 1) {
    const path = queue[index]
    if (path === undefined || !path.endsWith('.md')) continue
    for (const match of textAt(path).matchAll(/\]\(([^\s)#]+)(?:#[^)]*)?\)/g)) {
      const target = posix.normalize(posix.join(posix.dirname(path), match[1] ?? ''))
      if (!known.has(target) || files.has(target)) continue
      files.add(target)
      queue.push(target)
    }
  }
  const entryPath = `${id}/SKILL.md`
  return [entryPath, ...[...files].filter(path => path !== entryPath).sort()].map((path) => {
    const content = textAt(path)
    return { path, content, sha256: createHash('sha256').update(content).digest('hex') }
  })
}

/**
 * Refresh only platform entries from their files; other stages remain unchanged.
 * @param catalog - Existing stage metadata and grouping.
 * @returns A browser-safe catalog with the complete downloadable platform files.
 */
export function platformSkillCatalog(catalog: StageSkillCatalogValue): StageSkillCatalogValue {
  return { ...catalog, stages: catalog.stages.map(stage => ({ ...stage, methods: stage.methods.map((method) => {
    const id = PLATFORM_SKILL_IDS.find(value => value === method.id)
    if (id === undefined) return method
    return { ...method, ...readPlatformSkill(id), files: filesFor(id) }
  }) })) }
}

/**
 * Mount the native file reader while retaining the prior runtime-method precedence.
 * @param ctx - Owning FDE plugin context; disposal removes its provider and local resources.
 */
export function registerPlatformSkills(ctx: Context): void {
  ctx.skills.registerProvider((control) => {
    const native = new FileSystemSkillProvider(ctx, control, {
      providerName: 'fde-platform', includeDefaultRoots: false, bundledSkillDir: PLATFORM_SKILLS_ROOT, watch: false,
    })
    ctx.effect(() => async () => { await native.dispose() }, 'platform Skill files')
    return {
      name: native.name,
      async list(options) {
        const value = await native.list(options)
        const candidates = Array.isArray(value) ? value : value.candidates
        // Project entries still override these; user entries must not silently replace the old runtime methods.
        const selected = candidates.filter(item => PLATFORM_SKILL_IDS.some(id => id === item.name)).map(item => ({ ...item, rank: 250 }))
        return Array.isArray(value) ? selected : { ...value, candidates: selected }
      },
      get: (candidate, options) => native.get(candidate, options),
    }
  })
}
