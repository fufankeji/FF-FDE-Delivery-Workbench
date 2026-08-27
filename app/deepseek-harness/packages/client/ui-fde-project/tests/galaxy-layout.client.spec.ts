import { describe, expect, it } from 'vitest'
import { filterRequirementGalaxy, layoutRequirementGalaxy } from '../src/client/galaxy-layout.ts'
import type { RequirementWikiPage, RequirementWikiRelation } from '../src/client/wiki-controller.ts'

const pages: readonly RequirementWikiPage[] = [
  { id: 'goal', topic: 'business-goal', title: '业务目标', body: '减少人工遗漏', sourceIds: ['src_123456789012'] },
  { id: 'process', topic: 'process', title: '交付流程', summary: '分阶段交付', body: '需求到验收', sourceIds: ['src_123456789012'] },
  { id: 'acceptance', topic: 'acceptance', title: '验收规则', body: '保留证据', sourceIds: ['src_123456789012'] },
  { id: 'risk', topic: 'risk', title: '排期风险', body: '日期不明确', sourceIds: ['src_123456789012'] },
]

const relations: readonly RequirementWikiRelation[] = [
  { id: 'goal-process', from: 'goal', to: 'process', type: 'depends-on', directed: true, sourceIds: ['src_123456789012'] },
  { id: 'process-acceptance', from: 'process', to: 'acceptance', type: 'validates', directed: true, sourceIds: ['src_123456789012'] },
]

describe('requirement Galaxy layout', () => {
  it('keeps stable three-dimensional positions independent of input order', () => {
    const first = layoutRequirementGalaxy(pages)
    const second = layoutRequirementGalaxy([...pages].reverse())
    expect(second).toEqual(first)
    expect(new Set(first.map(point => `${String(point.x)}:${String(point.y)}:${String(point.z)}`)).size).toBe(pages.length)
  })

  it('filters the same page and relation facts by search, topic, and one-hop focus', () => {
    expect(filterRequirementGalaxy(pages, relations, { query: '证据' })).toEqual({
      pages: [pages[2]], relations: [],
    })
    expect(filterRequirementGalaxy(pages, relations, { topic: 'process' })).toEqual({
      pages: [pages[1]], relations: [],
    })
    const focused = filterRequirementGalaxy(pages, relations, { focusId: 'process' })
    expect(focused.pages.map(page => page.id)).toEqual(['goal', 'process', 'acceptance'])
    expect(focused.relations).toEqual(relations)
    expect(filterRequirementGalaxy(pages, relations, { focusId: 'missing' }).pages).toEqual(pages)
  })
})
