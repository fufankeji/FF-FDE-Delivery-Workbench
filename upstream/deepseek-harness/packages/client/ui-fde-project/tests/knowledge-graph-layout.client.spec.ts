import { describe, expect, it } from 'vitest'
import type { V2KnowledgeGraphSnapshot } from '../src/client/controller.ts'
import { layoutKnowledgeGraph } from '../src/client/knowledge-graph-layout.ts'

describe('project knowledge graph layout', () => {
  it('passes real topology to the native engine without precomputed or fixed coordinates', () => {
    const nodes = Array.from({ length: 9 }, (_, index) => ({
      id: String(index), label: `Object ${String(index)}`, type: `Type${String(index % 3)}`, sourceRefs: [],
    }))
    const snapshot: V2KnowledgeGraphSnapshot = {
      schemaVersion: 1, provider: { id: 'semantica', version: '0.6.7' },
      graphId: 'topology', revision: '1', ontologyVersion: '1', updatedAt: '2026-09-06T00:00:00Z',
      nodes, communities: [],
      edges: [0, 3, 6].flatMap(start => [0, 1].map(offset => ({
        id: `${String(start)}-${String(offset)}`, source: String(start + offset), target: String(start + offset + 1),
        type: 'CONNECTED', weight: 2, sourceRefs: [],
      }))),
    }
    const layout = layoutKnowledgeGraph(snapshot)
    const changedTypes = layoutKnowledgeGraph({ ...snapshot, nodes: nodes.map(node => ({ ...node, type: 'OneType' })) })
    expect(layout.edges.map(edge => [edge.source.id, edge.target.id]))
      .toEqual(changedTypes.edges.map(edge => [edge.source.id, edge.target.id]))
    const byId = new Map(layout.nodes.map(node => [node.id, node]))
    expect(byId.get('1')!.degree).toBe(2)
    for (const node of layout.nodes) {
      for (const coordinate of ['x', 'y', 'z', 'fx', 'fy', 'fz']) {
        expect(node).not.toHaveProperty(coordinate)
      }
    }
  })

  it('adapts the project snapshot without mutating its persisted node and edge references', () => {
    const snapshot: V2KnowledgeGraphSnapshot = {
      schemaVersion: 1,
      provider: { id: 'semantica', version: '0.3.0' },
      graphId: 'project-graph',
      revision: 'build-7',
      ontologyVersion: '0.1.0',
      updatedAt: '2026-09-04T08:30:00.000Z',
      nodes: [
        { id: 'workflow', label: '业务流程', type: 'Workflow', communityId: 'delivery', sourceRefs: ['outcome-contract.md'] },
        { id: 'system', label: '业务系统', type: 'System', communityId: 'delivery', sourceRefs: ['system-access-map.md'] },
        { id: 'owner', label: '业务负责人', type: 'Owner', communityId: 'governance', sourceRefs: ['governance-review.md'] },
      ],
      edges: [
        { id: 'uses', source: 'workflow', target: 'system', type: 'USES', weight: 1, sourceRefs: ['system-access-map.md'] },
        { id: 'owns', source: 'owner', target: 'workflow', type: 'OWNS', weight: 1, sourceRefs: ['governance-review.md'] },
      ],
      communities: [
        { id: 'delivery', label: '交付闭环', level: 0, nodeIds: ['workflow', 'system'] },
        { id: 'governance', label: '责任与治理', level: 0, nodeIds: ['owner'] },
      ],
    }

    const layout = layoutKnowledgeGraph(snapshot)

    expect(layout.nodes).toHaveLength(3)
    expect(layout.edges).toHaveLength(2)
    expect(layout.communities.map(item => item.label)).toEqual(['交付闭环', '责任与治理'])
    expect(layout.nodes.map(node => node.degree)).toEqual([2, 1, 1])
    expect(layout.nodes[0]).not.toBe(snapshot.nodes[0])
    expect(layout.edges[0]).toMatchObject({ id: 'uses', source: { id: 'workflow' }, target: { id: 'system' } })
    expect(snapshot.edges[0]).toEqual({ id: 'uses', source: 'workflow', target: 'system', type: 'USES', weight: 1, sourceRefs: ['system-access-map.md'] })
  })

  it('derives community metadata without inventing nodes, links or spatial clusters', () => {
    const snapshot: V2KnowledgeGraphSnapshot = {
      schemaVersion: 1,
      provider: { id: 'semantica', version: '0.6.7' },
      graphId: 'another-project',
      revision: 'revision-2',
      ontologyVersion: '2.0.0',
      updatedAt: '2026-09-04T10:00:00.000Z',
      nodes: [
        { id: 'alpha', label: 'Alpha', type: 'DomainAlpha', communityId: 'declared', sourceRefs: [] },
        { id: 'beta', label: 'Beta', type: 'DomainBeta', communityId: 'discovered', sourceRefs: [] },
        { id: 'gamma', label: 'Gamma', type: 'DomainBeta', communityId: 'discovered', sourceRefs: [] },
      ],
      edges: [
        { id: 'alpha-beta', source: 'alpha', target: 'beta', type: 'CONNECTS', weight: 2, sourceRefs: [] },
        { id: 'beta-gamma', source: 'beta', target: 'gamma', type: 'CONNECTS', weight: 1, sourceRefs: [] },
      ],
      communities: [
        { id: 'declared', label: 'Declared group', level: 0, nodeIds: ['alpha'] },
      ],
    }

    const before = structuredClone(snapshot)
    const layout = layoutKnowledgeGraph(snapshot)

    expect(layout.communities.map(community => community.id)).toEqual(['declared', 'discovered'])
    expect(layout.communities.find(community => community.id === 'discovered')).toMatchObject({
      label: 'discovered',
      nodeIds: ['beta', 'gamma'],
    })
    expect(layout.nodes.map(node => node.id)).toEqual(snapshot.nodes.map(node => node.id))
    expect(layout.edges.map(edge => edge.id)).toEqual(snapshot.edges.map(edge => edge.id))
    expect(layout.communities.every(community => !('center' in community))).toBe(true)
    expect(snapshot).toEqual(before)
  })
})
