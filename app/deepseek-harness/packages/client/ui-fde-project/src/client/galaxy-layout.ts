/** Deterministic requirement-Wiki filtering and three-dimensional Galaxy positions. */

import type {
  RequirementWikiPage,
  RequirementWikiRelation,
  RequirementWikiTopic,
} from './wiki-controller.ts'

/** Stable point used by the WebGL renderer and layout tests. */
export interface GalaxyPoint {
  readonly id: string
  readonly x: number
  readonly y: number
  readonly z: number
}

/** Visible subgraph after search, topic, and one-hop focus filters. */
export interface GalaxySubgraph {
  readonly pages: readonly RequirementWikiPage[]
  readonly relations: readonly RequirementWikiRelation[]
}

const TOPICS: readonly RequirementWikiTopic[] = [
  'business-goal', 'role', 'process', 'system-data', 'rule',
  'constraint', 'acceptance', 'risk', 'conflict', 'unknown',
]

function hash32(value: string, seed = 2_166_136_261): number {
  let hash = seed >>> 0
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16_777_619) >>> 0
  }
  return hash
}

function unit(value: string, seed: number): number {
  return hash32(value, seed) / 0xffff_ffff
}

/**
 * Produce stable clustered positions from topic and WikiPageId, independent of array order.
 * @param pages - Complete or filtered Wiki pages to position.
 * @returns One deterministic point for each page, sorted by page id.
 */
export function layoutRequirementGalaxy(pages: readonly RequirementWikiPage[]): readonly GalaxyPoint[] {
  return [...pages].sort((left, right) => left.id.localeCompare(right.id)).map((page) => {
    const topicIndex = Math.max(0, TOPICS.indexOf(page.topic))
    const topicAngle = topicIndex / TOPICS.length * Math.PI * 2
    const angle = topicAngle + (unit(page.id, 0x9e37_79b9) - 0.5) * 0.72
    const radius = 7 + unit(page.id, 0x85eb_ca6b) * 9
    const elevation = (unit(page.id, 0xc2b2_ae35) - 0.5) * 9 + (topicIndex - 4.5) * 0.22
    const depthWave = (unit(page.id, 0x27d4_eb2f) - 0.5) * 2.8
    return {
      id: page.id,
      x: Number((Math.cos(angle) * radius).toFixed(5)),
      y: Number(elevation.toFixed(5)),
      z: Number((Math.sin(angle) * radius + depthWave).toFixed(5)),
    }
  })
}

/**
 * Filter one Wiki graph without creating parallel facts or inferred edges.
 * @param pages - Pages from one immutable Wiki revision.
 * @param relations - Relations from the same revision.
 * @param input - Optional text, topic, and one-hop focus filters.
 * @returns The visible pages and relations whose endpoints both remain visible.
 */
export function filterRequirementGalaxy(
  pages: readonly RequirementWikiPage[],
  relations: readonly RequirementWikiRelation[],
  input: { readonly query?: string; readonly topic?: RequirementWikiTopic | 'all'; readonly focusId?: string },
): GalaxySubgraph {
  const query = input.query?.trim().toLocaleLowerCase('zh-CN') ?? ''
  let visible = new Set(pages.filter((page) => {
    if (input.topic !== undefined && input.topic !== 'all' && page.topic !== input.topic) return false
    if (query === '') return true
    return `${page.title}\n${page.summary ?? ''}\n${page.body}`.toLocaleLowerCase('zh-CN').includes(query)
  }).map(page => page.id))

  if (input.focusId !== undefined && pages.some(page => page.id === input.focusId)) {
    const neighborhood = new Set([input.focusId])
    for (const relation of relations) {
      if (relation.from === input.focusId) neighborhood.add(relation.to)
      if (relation.to === input.focusId) neighborhood.add(relation.from)
    }
    visible = new Set([...visible].filter(id => neighborhood.has(id)))
  }

  return {
    pages: pages.filter(page => visible.has(page.id)),
    relations: relations.filter(relation => visible.has(relation.from) && visible.has(relation.to)),
  }
}
