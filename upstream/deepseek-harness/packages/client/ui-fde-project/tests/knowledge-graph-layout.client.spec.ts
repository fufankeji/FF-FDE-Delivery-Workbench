import { describe, expect, it } from 'vitest'
import type { V2KnowledgeGraphSnapshot } from '../src/client/controller.ts'
import { layoutKnowledgeGraph } from '../src/client/knowledge-graph-layout.ts'

describe('project knowledge graph layout', () => {
  it('lays out the project snapshot without mutating its persisted node and edge references', () => {
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
    expect(layout.nodes.every(node => [node.x, node.y, node.z, node.size].every(Number.isFinite))).toBe(true)
    expect(layout.edges[0]).toMatchObject({ id: 'uses', source: { id: 'workflow' }, target: { id: 'system' } })
    expect(snapshot.edges[0]).toEqual({ id: 'uses', source: 'workflow', target: 'system', type: 'USES', weight: 1, sourceRefs: ['system-access-map.md'] })
  })
})
