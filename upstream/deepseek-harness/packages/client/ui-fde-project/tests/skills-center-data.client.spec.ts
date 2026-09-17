import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { strFromU8, unzipSync } from 'fflate'
import type { StageSkillCatalogValue } from '../src/client/stage-skill-catalog.ts'
import { COURSE_SKILLS, resolveSkillFile, searchLibrary, skillArchive, skillFileTree, stageOneLibrary, STAGE_ONE_SKILL_IDS } from '../src/client/skills-center-data.ts'
import diagnosis from '../src/client/course-skills/fde-business-diagnosis.json'

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

describe('original course Skill assets', () => {
  const course = COURSE_SKILLS[0]!
  it('preserves all six original UTF-8 files and paths in downloads without platform wrapper files', () => {
    expect(COURSE_SKILLS).toHaveLength(1)
    expect(course.source).toBe('course')
    expect(course.course.lessonNumber).toBe(1)
    expect(course.course.title).toBe('FDE企业AI项目实战训练营')
    expect(course.files.map(file => file.path)).toEqual([
      'SKILL.md', 'agents/openai.yaml', 'assets/investigation-record-template.md',
      'assets/report-template.md', 'references/business-assets.md', 'references/interaction-and-diagnosis.md',
    ])
    const zip = unzipSync(skillArchive(course))
    expect(Object.keys(zip)).toEqual(course.files.map(file => `${course.id}/${file.path}`))
    for (const original of diagnosis.files) {
      const bytes = zip[`${course.id}/${original.path}`]!
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(original.sha256)
      expect(strFromU8(bytes)).toBe(original.content)
    }
    expect(searchLibrary(COURSE_SKILLS, '模糊需求')).toEqual([course])
    expect(searchLibrary(COURSE_SKILLS, 'FDE企业AI项目实战训练营')).toEqual([course])
  })

  it('forms only real nested directories while retaining the existing flat platform packages', () => {
    const tree = skillFileTree(course.files)
    expect(tree.map(node => [node.kind, node.path])).toEqual([
      ['file', 'SKILL.md'], ['directory', 'agents'], ['directory', 'assets'], ['directory', 'references'],
    ])
    const assets = tree.find(node => node.path === 'assets')!
    expect(assets.kind === 'directory' && assets.children.map(node => node.path)).toEqual([
      'assets/investigation-record-template.md', 'assets/report-template.md',
    ])
    expect(skillFileTree(stageOneLibrary(DISCOVERY_STAGE_SKILL_CATALOG)[0]!.files).every(node => node.kind === 'file')).toBe(true)
  })

  it('resolves document-relative paths inside the package without making external or template outputs into files', () => {
    expect(resolveSkillFile(course.files, 'SKILL.md', 'references/business-assets.md')).toBe('references/business-assets.md')
    expect(resolveSkillFile(course.files, 'references/business-assets.md', '../assets/report-template.md#section')).toBe('assets/report-template.md')
    expect(resolveSkillFile(course.files, 'SKILL.md', './agents/openai.yaml?raw=1')).toBe('agents/openai.yaml')
    for (const path of ['../../SKILL.md', '%2e%2e/SKILL.md', '/SKILL.md', '\\SKILL.md', 'file:///SKILL.md', 'javascript:alert', 'https://example.com/SKILL.md', '#part', '%zz']) {
      expect(resolveSkillFile(course.files, 'SKILL.md', path)).toBeUndefined()
    }
    expect(resolveSkillFile(course.files, 'assets/report-template.md', '业务资产/完整资产目录.md')).toBeUndefined()
  })
})
