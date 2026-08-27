import { describe, expect, it } from 'vitest'
import { projectViewVisible, type FdeProjectViewId } from '../src/client/view-availability.ts'

const visible = (stage: Parameters<typeof projectViewVisible>[1]): FdeProjectViewId[] => (
  ['fde-api-docs', 'fde-architecture', 'fde-observability', 'fde-evaluation'] as const
).filter(id => projectViewVisible(id, stage))

describe('project delivery view availability', () => {
  it('reveals only the views whose business stage has started', () => {
    expect(visible(undefined)).toEqual([])
    expect(visible('requirements')).toEqual([])
    expect(visible('solution')).toEqual(['fde-architecture'])
    expect(visible('development')).toEqual(['fde-api-docs', 'fde-architecture', 'fde-evaluation'])
    expect(visible('validation')).toEqual(['fde-api-docs', 'fde-architecture', 'fde-observability', 'fde-evaluation'])
    expect(visible('handoff')).toEqual(['fde-api-docs', 'fde-architecture', 'fde-observability', 'fde-evaluation'])
  })
})
