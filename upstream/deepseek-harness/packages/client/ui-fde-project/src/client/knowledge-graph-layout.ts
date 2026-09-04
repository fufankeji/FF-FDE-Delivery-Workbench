/**
 * Deterministic 3D force layout adapted from GraphRAG Workbench's spherical,
 * community-aware layout. See THIRD_PARTY_NOTICES.md for attribution.
 */

import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type Force,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from 'd3-force-3d'
import type { V2KnowledgeGraphSnapshot } from './controller.ts'

export interface KnowledgeGraphLayoutNode extends SimulationNodeDatum {
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
  readonly size: number
  x: number
  y: number
  z: number
}

export interface KnowledgeGraphLayoutEdge extends SimulationLinkDatum<KnowledgeGraphLayoutNode> {
  readonly id: string
  source: KnowledgeGraphLayoutNode
  target: KnowledgeGraphLayoutNode
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
  readonly center: readonly [number, number, number]
  readonly radius: number
}

export interface KnowledgeGraphLayout {
  readonly nodes: readonly KnowledgeGraphLayoutNode[]
  readonly edges: readonly KnowledgeGraphLayoutEdge[]
  readonly communities: readonly KnowledgeGraphLayoutCommunity[]
  readonly center: readonly [number, number, number]
  readonly radius: number
}

interface CommunitySeed {
  readonly id: string
  readonly label: string
  readonly level: number
  readonly nodeIds: readonly string[]
  readonly x: number
  readonly y: number
  readonly z: number
}

function fibonacciPoint(index: number, count: number, radius: number): readonly [number, number, number] {
  if (count <= 1) return [0, 0, 0]
  const y = 1 - (index / (count - 1)) * 2
  const ring = Math.sqrt(Math.max(0, 1 - y * y))
  const theta = Math.PI * (3 - Math.sqrt(5)) * index
  return [Math.cos(theta) * ring * radius, y * radius, Math.sin(theta) * ring * radius]
}

function graphCommunities(snapshot: V2KnowledgeGraphSnapshot): readonly CommunitySeed[] {
  const declared = snapshot.communities.length > 0
    ? snapshot.communities
    : [...new Set(snapshot.nodes.map(node => node.communityId ?? `type:${node.type}`))].map(id => ({
      id,
      label: id.startsWith('type:') ? id.slice(5) : id,
      level: 0,
      nodeIds: snapshot.nodes.filter(node => (node.communityId ?? `type:${node.type}`) === id).map(node => node.id),
    }))
  const shellRadius = declared.length <= 1 ? 0 : Math.min(52, 22 + declared.length * 5)
  return declared.map((community, index) => {
    const [x, y, z] = fibonacciPoint(index, declared.length, shellRadius)
    return { ...community, x, y, z }
  })
}

function finite(value: number | undefined): number {
  return value !== undefined && Number.isFinite(value) ? value : 0
}

/** Build the bounded layout once; animation never mutates the project snapshot. */
export function layoutKnowledgeGraph(snapshot: V2KnowledgeGraphSnapshot): KnowledgeGraphLayout {
  const degree = new Map(snapshot.nodes.map(node => [node.id, 0]))
  for (const edge of snapshot.edges) {
    degree.set(edge.source, (degree.get(edge.source) ?? 0) + edge.weight)
    degree.set(edge.target, (degree.get(edge.target) ?? 0) + edge.weight)
  }
  const communities = graphCommunities(snapshot)
  const communityById = new Map(communities.map(community => [community.id, community]))
  const localIndex = new Map<string, number>()
  const localCount = new Map<string, number>()
  for (const node of snapshot.nodes) {
    const communityId = node.communityId ?? `type:${node.type}`
    localCount.set(communityId, (localCount.get(communityId) ?? 0) + 1)
  }

  const nodes: KnowledgeGraphLayoutNode[] = snapshot.nodes.map((node) => {
    const communityId = node.communityId ?? `type:${node.type}`
    const community = communityById.get(communityId)
    const index = localIndex.get(communityId) ?? 0
    localIndex.set(communityId, index + 1)
    const count = localCount.get(communityId) ?? 1
    const score = degree.get(node.id) ?? 0
    const size = Math.min(4.8, 1.35 + Math.log2(score + 1) * 0.58)
    const [localX, localY, localZ] = fibonacciPoint(index, count, 5 + Math.sqrt(count) * 3.5)
    return {
      ...node,
      communityId,
      degree: score,
      size,
      x: (community?.x ?? 0) + localX,
      y: (community?.y ?? 0) + localY,
      z: (community?.z ?? 0) + localZ,
    }
  })
  const nodeById = new Map(nodes.map(node => [node.id, node]))
  const edges: KnowledgeGraphLayoutEdge[] = snapshot.edges.flatMap((edge) => {
    const source = nodeById.get(edge.source)
    const target = nodeById.get(edge.target)
    return source === undefined || target === undefined ? [] : [{ ...edge, source, target }]
  })

  const communityForce: Force<KnowledgeGraphLayoutNode> = (alpha) => {
    for (const node of nodes) {
      const community = communityById.get(node.communityId)
      if (community === undefined) continue
      const strength = 0.075 * alpha
      node.vx = finite(node.vx) + (community.x - node.x) * strength
      node.vy = finite(node.vy) + (community.y - node.y) * strength
      node.vz = finite(node.vz) + (community.z - node.z) * strength
    }
  }

  const simulation = forceSimulation(nodes, 3)
    .force('link', forceLink<KnowledgeGraphLayoutNode, KnowledgeGraphLayoutEdge>(edges)
      .id(node => node.id)
      .distance(edge => Math.max(12, 34 - Math.log2(edge.weight + 1) * 5))
      .strength(edge => Math.min(0.42, 0.08 + edge.weight * 0.035)))
    .force('charge', forceManyBody<KnowledgeGraphLayoutNode>().strength(node => -62 - node.degree * 5))
    .force('collision', forceCollide<KnowledgeGraphLayoutNode>().radius(node => node.size + 2.8))
    .force('center', forceCenter<KnowledgeGraphLayoutNode>(0, 0, 0).strength(0.028))
    .force('community', communityForce)
    .stop()
  simulation.tick(Math.min(360, 180 + nodes.length))
  simulation.stop()

  const rawRadius = nodes.reduce((maximum, node) => Math.max(maximum, Math.hypot(node.x, node.y, node.z)), 1)
  const scale = Math.min(1, 78 / rawRadius)
  for (const node of nodes) {
    node.x *= scale
    node.y *= scale
    node.z *= scale
  }
  const laidOutCommunities = communities.map((community): KnowledgeGraphLayoutCommunity => {
    const members = nodes.filter(node => node.communityId === community.id)
    if (members.length === 0) return { ...community, center: [0, 0, 0], radius: 0 }
    const center: [number, number, number] = [
      members.reduce((sum, node) => sum + node.x, 0) / members.length,
      members.reduce((sum, node) => sum + node.y, 0) / members.length,
      members.reduce((sum, node) => sum + node.z, 0) / members.length,
    ]
    const radius = members.reduce((maximum, node) => Math.max(
      maximum,
      Math.hypot(node.x - center[0], node.y - center[1], node.z - center[2]) + node.size,
    ), 4) + 4
    return { id: community.id, label: community.label, level: community.level, nodeIds: community.nodeIds, center, radius }
  })
  const radius = nodes.reduce((maximum, node) => Math.max(maximum, Math.hypot(node.x, node.y, node.z) + node.size), 24)
  return { nodes, edges, communities: laidOutCommunities, center: [0, 0, 0], radius }
}
