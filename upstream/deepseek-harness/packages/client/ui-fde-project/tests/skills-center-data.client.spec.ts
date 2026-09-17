import { describe, expect, it } from 'vitest'
import { strFromU8, unzipSync } from 'fflate'
import type { StageSkillCatalogValue } from '../src/client/stage-skill-catalog.ts'
import { searchLibrary, skillArchive, stageOneLibrary, STAGE_ONE_SKILL_IDS } from '../src/client/skills-center-data.ts'

// Load the real Host fixture without merging Host Cordis services into the Client typecheck.
const hostModule = '../../../fde/stage/src/index.ts'
const { DISCOVERY_STAGE_SKILL_CATALOG } = await import(hostModule) as { DISCOVERY_STAGE_SKILL_CATALOG: StageSkillCatalogValue }

describe('stage-one Skill assets', () => {
  const skills = stageOneLibrary(DISCOVERY_STAGE_SKILL_CATALOG)
  it('uses exactly the seven real stage-one methods, preserving their original bodies and triggers', () => {
    expect(skills.map(skill => skill.id)).toEqual(STAGE_ONE_SKILL_IDS)
    for (const skill of skills) {
      const method = DISCOVERY_STAGE_SKILL_CATALOG.stages[0]!.methods.find(item => item.id === skill.id)!
      expect(skill.files.map(file => file.path)).toEqual(['SKILL.md', 'README.md', 'LICENSE', 'NOTICE.md'])
      const definition = skill.files[0]!.content
      expect(definition).toContain(`name: ${method.id}\n`)
      expect(definition).toContain(method.whenToUse)
      expect(definition).toContain(method.content.trim())
      expect(skill.files[1]!.content).toContain(method.source.split('@')[1])
      expect(skill.files[1]!.content).toContain('未验证在其他 Agent 中直接安装或执行的兼容性')
      expect(skill.files[2]!.content).toContain(skill.id === 'qualify-ai-workflow' || skill.id === 'reframe-ai-engagement' ? 'Apache License' : 'MIT License')
    }
  })
  it('downloads exactly the displayed UTF-8 files, with one Skill root and no project content', () => {
    for (const skill of skills) {
      const files = unzipSync(skillArchive(skill))
      expect(Object.keys(files)).toEqual(skill.files.map(file => `${skill.id}/${file.path}`))
      for (const file of skill.files) expect(strFromU8(files[`${skill.id}/${file.path}`]!)).toBe(file.content)
    }
  })
  it('searches the Chinese label, stable id and actual use, keeping order and allowing an empty result', () => {
    expect(searchLibrary(skills, ' QUALIFY-AI ')).toEqual([skills[0]])
    expect(searchLibrary(skills, '访谈业务人员')).toEqual([skills[2]])
    expect(searchLibrary(skills, '代码库')).toEqual([skills[4]])
    expect(searchLibrary(skills, '   ')).toEqual(skills)
    expect(searchLibrary(skills, 'not-an-existing-skill')).toEqual([])
  })
  it('does not manufacture assets when the wire catalog is missing a method or has an unrecognized source', () => {
    expect(() => stageOneLibrary({ schemaVersion: 1, stages: [] })).toThrow('第一阶段方法缺失')
    const stage = DISCOVERY_STAGE_SKILL_CATALOG.stages[0]!
    expect(() => stageOneLibrary({ schemaVersion: 1, stages: [{ ...stage, methods: stage.methods.map((method, index) => index === 0 ? { ...method, source: 'unknown' } : method) }] })).toThrow('第一阶段方法来源无法确认')
  })
})
