// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { V2KnowledgeGraphSnapshot } from '../src/client/controller.ts'
import { KnowledgeGraphExplorer } from '../src/client/KnowledgeGraphExplorer.tsx'

afterEach(cleanup)

const snapshot: V2KnowledgeGraphSnapshot = {
  schemaVersion: 1,
  provider: { id: 'semantica', version: '0.6.7' },
  graphId: 'generic-project',
  revision: 'revision-1',
  ontologyVersion: '1.0.0',
  updatedAt: '2026-09-04T10:00:00.000Z',
  nodes: Array.from({ length: 10 }, (_, index) => ({
    id: index === 0 ? 'alpha' : index === 1 ? 'beta' : `entity-${String(index)}`,
    label: index === 0 ? 'Alpha entity' : index === 1 ? 'Beta entity' : `Entity ${String(index + 1)}`,
    type: index === 0 ? 'DomainAlpha' : 'DomainBeta',
    communityId: index === 0 ? 'group-a' : index === 1 ? 'group-b' : `group-${String(index)}`,
    sourceRefs: index === 0 ? ['alpha.md'] : index === 1 ? ['beta.md'] : [],
  })),
  edges: [
    { id: 'alpha-beta', source: 'alpha', target: 'beta', type: 'CONNECTS', weight: 1, sourceRefs: ['relation.md'] },
  ],
  communities: Array.from({ length: 10 }, (_, index) => ({
    id: index === 0 ? 'group-a' : index === 1 ? 'group-b' : `group-${String(index)}`,
    label: `Community ${String(index + 1)}`,
    level: 0,
    nodeIds: [index === 0 ? 'alpha' : index === 1 ? 'beta' : `entity-${String(index)}`],
  })),
}

describe('KnowledgeGraphExplorer', () => {
  it('keeps arbitrary project communities searchable and navigates related entity details', () => {
    render(<KnowledgeGraphExplorer snapshot={snapshot} />)

    expect(screen.getByRole('button', { name: 'Community 10' })).toBeTruthy()
    fireEvent.change(screen.getByLabelText('搜索知识图谱'), { target: { value: 'Alpha' } })
    fireEvent.click(screen.getByRole('button', { name: /Alpha entity.*DomainAlpha/ }))
    expect(screen.getByLabelText('实体详情：Alpha entity')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /CONNECTS → Beta entity/ }))
    expect(screen.getByLabelText('实体详情：Beta entity')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Community 10' }))
    expect(screen.queryByLabelText('实体详情：Beta entity')).toBeNull()
    expect(screen.getByRole('button', { name: 'Community 10' }).getAttribute('aria-pressed')).toBe('true')
  })
})
