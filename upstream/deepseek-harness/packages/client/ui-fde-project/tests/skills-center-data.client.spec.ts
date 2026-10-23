import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { strFromU8, unzipSync } from 'fflate'
import type { StageSkillCatalogValue } from '../src/client/stage-skill-catalog.ts'
import { fetchStageSkillCatalog } from '../src/client/stage-skill-catalog.ts'
import { COURSE_SKILLS, resolveSkillFile, searchLibrary, skillArchive, skillFileTree, stageOneLibrary, STAGE_ONE_SKILL_IDS } from '../src/client/skills-center-data.ts'
import diagnosis from '../src/client/course-skills/fde-business-diagnosis.json'


// Load the real Host fixture without merging Host Cordis services into the Client typecheck.
const hostModule = '../../../fde/stage/src/index.ts'
const { DISCOVERY_STAGE_SKILL_CATALOG: rawCatalog } = await import(hostModule) as { DISCOVERY_STAGE_SKILL_CATALOG: StageSkillCatalogValue }
const platformModule = '../../../fde/stage/src/platform-skills.ts'
const { platformSkillCatalog } = await import(platformModule) as {
  platformSkillCatalog: (value: StageSkillCatalogValue) => StageSkillCatalogValue
}
const DISCOVERY_STAGE_SKILL_CATALOG = platformSkillCatalog(rawCatalog)

describe('standard platform Skill files', () => {
  const skills = stageOneLibrary(DISCOVERY_STAGE_SKILL_CATALOG)
  it('uses the seven Host file packages without another browser content snapshot', () => {
    expect(skills.map(skill => skill.id)).toEqual(STAGE_ONE_SKILL_IDS)
    for (const skill of skills) {
      const method = DISCOVERY_STAGE_SKILL_CATALOG.stages[0]!.methods.find(item => item.id === skill.id)!
      expect(skill.entryPath).toBe(skill.id + '/SKILL.md')
      expect(skill.files).toBe(method.files)
      const entry = skill.files.find(file => file.path === skill.entryPath)!
      expect(entry.content.replace(/^---\n[\s\S]*?\n---\n/, '').trim()).toBe(method.content)
      expect(skill.files.some(file => file.path.startsWith('_licenses/'))).toBe(true)
    }
  })
  it('exports the exact file paths and byte hashes, without duplicating the Skill directory', () => {
    for (const skill of skills) {
      const zip = unzipSync(skillArchive(skill))
      expect(Object.keys(zip)).toEqual(skill.files.map(file => file.path))
      const method = DISCOVERY_STAGE_SKILL_CATALOG.stages[0]!.methods.find(item => item.id === skill.id)!
      for (const file of method.files!) {
        expect(createHash('sha256').update(zip[file.path]!).digest('hex')).toBe(file.sha256)
      }
    }
  })
  it('keeps the shared platform rules and relative resource links inside the download', () => {
    const orient = skills[1]!
    expect(resolveSkillFile(orient.files, orient.entryPath, '../qualify-ai-workflow/references/stage-records.md'))
      .toBe('qualify-ai-workflow/references/stage-records.md')
    expect(resolveSkillFile(orient.files, orient.entryPath, 'assets/orientation.md')).toBe('fde-orient/assets/orientation.md')
    expect(resolveSkillFile(orient.files, orient.entryPath, '../../outside.md')).toBeUndefined()
  })
  it('preserves search order and fails visibly for unavailable platform files', () => {
    expect(searchLibrary(skills, ' QUALIFY-AI ')).toEqual([skills[0]])
    expect(searchLibrary(skills, '访谈业务人员')).toEqual([skills[2]])
    expect(searchLibrary(skills, 'not-an-existing-skill')).toEqual([])
    expect(() => stageOneLibrary({ schemaVersion: 1, stages: [] })).toThrow('第一阶段方法缺失')
    expect(() => stageOneLibrary(rawCatalog)).toThrow('平台 Skill 文件不可用')
  })
  it('rejects a wire file path that would escape a downloaded package', async () => {
    const stage = DISCOVERY_STAGE_SKILL_CATALOG.stages[0]!
    const invalid = { schemaVersion: 1, stages: [{ ...stage, methods: [{ ...stage.methods[0],
      entryPath: '../escape.md', files: [{ path: '../escape.md', content: 'bad', sha256: 'a'.repeat(64) }],
    }] }] }
    const fetch = (async () => new Response(JSON.stringify({ ok: true, value: invalid }))) as typeof globalThis.fetch
    await expect(fetchStageSkillCatalog(undefined, fetch)).rejects.toThrow('阶段工作方法响应无效')
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

  it('forms only real nested directories for both source categories', () => {
    const tree = skillFileTree(course.files)
    expect(tree.map(node => [node.kind, node.path])).toEqual([
      ['file', 'SKILL.md'], ['directory', 'agents'], ['directory', 'assets'], ['directory', 'references'],
    ])
    const assets = tree.find(node => node.path === 'assets')!
    expect(assets.kind === 'directory' && assets.children.map(node => node.path)).toEqual([
      'assets/investigation-record-template.md', 'assets/report-template.md',
    ])
    expect(skillFileTree(stageOneLibrary(DISCOVERY_STAGE_SKILL_CATALOG)[0]!.files).some(node => node.kind === 'directory')).toBe(true)
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
