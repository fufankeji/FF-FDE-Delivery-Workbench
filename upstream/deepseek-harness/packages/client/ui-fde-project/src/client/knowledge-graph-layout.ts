/** Project graph adapter. Only the renderer's native 3D engine owns positions. */

import type { V2KnowledgeGraphSnapshot } from './controller.ts'

export interface KnowledgeGraphLayoutNode {
  readonly id: string
  readonly label: string
  readonly type: string
  readonly summary?: string
  readonly communityId: string
  readonly confidence?: number
  readonly validFrom?: string
  readonly validUntil?: string
  readonly sourceRefs: readonly string[]
  readonly degree: number
}

export interface KnowledgeGraphLayoutEdge {
  readonly id: string
  readonly source: KnowledgeGraphLayoutNode
  readonly target: KnowledgeGraphLayoutNode
  readonly type: string
  readonly label?: string
  readonly weight: number
  readonly confidence?: number
  readonly validFrom?: string
  readonly validUntil?: string
  readonly sourceRefs: readonly string[]
}

export interface KnowledgeGraphLayoutCommunity {
  readonly id: string
  readonly label: string
  readonly level: number
  readonly nodeIds: readonly string[]
}

export interface KnowledgeGraphLayout {
  readonly nodes: readonly KnowledgeGraphLayoutNode[]
  readonly edges: readonly KnowledgeGraphLayoutEdge[]
  readonly communities: readonly KnowledgeGraphLayoutCommunity[]
}

/** Keep project evidence immutable while preparing native force-graph input. */
export function layoutKnowledgeGraph(snapshot: V2KnowledgeGraphSnapshot): KnowledgeGraphLayout {
  const degree = new Map(snapshot.nodes.map(node => [node.id, 0]))
  for (const edge of snapshot.edges) {
    degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1)
    degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1)
  }
  const nodes = snapshot.nodes.map((node): KnowledgeGraphLayoutNode => ({
    ...node,
    communityId: node.communityId ?? `type:${node.type}`,
    degree: degree.get(node.id) ?? 0,
  }))
  const nodeById = new Map(nodes.map(node => [node.id, node]))
  const edges = snapshot.edges.flatMap((edge): KnowledgeGraphLayoutEdge[] => {
    const source = nodeById.get(edge.source)
    const target = nodeById.get(edge.target)
    return source === undefined || target === undefined ? [] : [{ ...edge, source, target }]
  })
  const declaredById = new Map(snapshot.communities.map(community => [community.id, community]))
  const discoveredIds = [...new Set(nodes.map(node => node.communityId))]
  const orderedIds = [
    ...declaredById.keys(),
    ...discoveredIds.filter(id => !declaredById.has(id)).sort((left, right) => left.localeCompare(right)),
  ]
  const communities = orderedIds.map((id): KnowledgeGraphLayoutCommunity => {
    const declared = declaredById.get(id)
    return {
      id,
      label: declared?.label ?? (id.startsWith('type:') ? id.slice(5) : id),
      level: declared?.level ?? 0,
      nodeIds: nodes.filter(node => node.communityId === id).map(node => node.id),
    }
  })
  return { nodes, edges, communities }
}
