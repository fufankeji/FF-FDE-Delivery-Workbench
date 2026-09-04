import { describe, expect, it } from 'vitest'
import { projectViewVisible, type FdeProjectViewId } from '../src/client/view-availability.ts'
import type { ProjectSurfaceSnapshot } from '../src/client/controller.ts'

const stopped = {
  runtime: { schemaVersion: 1, revision: 0, status: 'stopped', updatedAt: '1970-01-01T00:00:00.000Z' },
  apiDocs: { status: 'unconfigured', message: '未配置' },
} as ProjectSurfaceSnapshot

const runningWithOpenApi = {
  ...stopped,
  runtime: {
    schemaVersion: 1, revision: 2, status: 'running', updatedAt: '2026-08-27T00:00:00.000Z',
    previewUrl: 'http://127.0.0.1:3000/', openapiSource: 'http://127.0.0.1:8000/openapi.json',
  },
  apiDocs: {
    status: 'configured', openapiSource: 'http://127.0.0.1:8000/openapi.json',
    allowedMethods: ['GET', 'HEAD'], allowPrivateNetwork: false,
  },
} as ProjectSurfaceSnapshot

const visible = (
  stage: Parameters<typeof projectViewVisible>[1],
  surface: ProjectSurfaceSnapshot = stopped,
): FdeProjectViewId[] => (
  ['fde-api-docs', 'fde-architecture', 'fde-observability', 'fde-evaluation'] as const
).filter(id => projectViewVisible(id, stage, surface))

describe('project delivery view availability', () => {
  it('reveals only the views whose business stage has started', () => {
    expect(visible(undefined)).toEqual([])
    expect(visible('requirements')).toEqual([])
    expect(visible('solution')).toEqual([])
    expect(visible('development')).toEqual(['fde-architecture', 'fde-observability'])
    expect(visible('validation')).toEqual(['fde-architecture', 'fde-observability', 'fde-evaluation'])
    expect(visible('handoff')).toEqual(['fde-architecture', 'fde-observability', 'fde-evaluation'])
  })

  it('reveals API docs only while the project is running with a real OpenAPI source', () => {
    expect(visible('development', runningWithOpenApi)).toEqual(['fde-api-docs', 'fde-architecture', 'fde-observability'])
    expect(projectViewVisible('fde-api-docs', 'development', {
      ...runningWithOpenApi,
      apiDocs: { status: 'configured', docsUrl: 'http://127.0.0.1:8000/docs', allowedMethods: ['GET'], allowPrivateNetwork: false },
    })).toBe(false)
  })
})
