import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { Context } from '@deepseek-ai/cordis'
import SkillRegistry from '@deepseek-ai/dsh-skill'
import { expect, it } from 'vitest'
import { DISCOVERY_STAGE_SKILL_CATALOG } from '../src/index.ts'
import { PLATFORM_SKILL_IDS, PLATFORM_SKILLS_ROOT, platformSkillCatalog, registerPlatformSkills } from '../src/platform-skills.ts'

it('loads the same Chinese files through the native provider and catalog, then disposes all seven registrations', async () => {
  const ctx = new Context()
  const registry = ctx.plugin(SkillRegistry)
  let fiber: ReturnType<Context['plugin']> | undefined
  try {
    await registry
    fiber = ctx.plugin({ name: 'platform-skills-test', inject: ['skills'], apply: registerPlatformSkills })
    await fiber
    const summaries = await ctx.skills.list({})
    expect(summaries.map(skill => skill.name).sort()).toEqual([...PLATFORM_SKILL_IDS].sort())
    const catalog = platformSkillCatalog(DISCOVERY_STAGE_SKILL_CATALOG)
    for (const id of PLATFORM_SKILL_IDS) {
      const loaded = await ctx.skills.get(id, {})
      const method = catalog.stages[0]?.methods.find(item => item.id === id)
      expect(loaded?.provider).toBe('fde-platform')
      expect(loaded?.path).toBe(resolve(PLATFORM_SKILLS_ROOT, id, 'SKILL.md'))
      expect(loaded?.resourceBase).toEqual({ kind: 'directory', path: resolve(PLATFORM_SKILLS_ROOT, id) })
      expect(loaded?.content).toBe(method?.content)
      expect(method?.files?.find(file => file.path === method.entryPath)?.content.replace(/^---\n[\s\S]*?\n---\n/, '').trim())
        .toBe(loaded?.content)
      for (const file of method?.files ?? []) {
        const raw = readFileSync(resolve(PLATFORM_SKILLS_ROOT, file.path))
        expect(createHash('sha256').update(raw).digest('hex')).toBe(file.sha256)
      }
    }
    await fiber.dispose()
    expect(await ctx.skills.list({})).toEqual([])
  } finally { await fiber?.dispose(); await registry.dispose() }
})

it('ships every authored Skill resource link without escaping the shared package root', () => {
  const catalog = platformSkillCatalog(DISCOVERY_STAGE_SKILL_CATALOG)
  for (const method of catalog.stages[0]?.methods ?? []) {
    for (const file of method.files ?? []) {
      if (!file.path.endsWith('.md') || file.path.startsWith('_licenses/')) continue
      for (const match of file.content.matchAll(/\]\(([^\s)#]+)(?:#[^)]*)?\)/g)) {
        const target = resolve(PLATFORM_SKILLS_ROOT, file.path, '..', match[1] ?? '')
        expect(target.startsWith(PLATFORM_SKILLS_ROOT)).toBe(true)
        expect(method.files?.some(item => resolve(PLATFORM_SKILLS_ROOT, item.path) === target)).toBe(true)
      }
    }
  }
})
