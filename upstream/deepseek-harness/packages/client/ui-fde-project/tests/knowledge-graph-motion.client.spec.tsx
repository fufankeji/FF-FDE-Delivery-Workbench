// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { KnowledgeGraphExplorer } from '../src/client/KnowledgeGraphExplorer.tsx'
import type { V2KnowledgeGraphSnapshot } from '../src/client/controller.ts'

const mock = vi.hoisted(() => ({ instances: [] as Record<string, ReturnType<typeof vi.fn>>[] }))
vi.mock('3d-force-graph', async () => {
  const THREE = await import('three')
  return { default: function () {
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera()
    let data = { nodes: [], links: [] }
    const controls = {}
    const methods: Record<string, ReturnType<typeof vi.fn>> = {}
    const graph = new Proxy(methods, {
      get(target, key: string) {
        return target[key] ??= vi.fn((...args: unknown[]) => {
          if (key === 'scene') return scene
          if (key === 'camera') return camera
          if (key === 'controls') return controls
          if (key === 'renderer') return { setPixelRatio() {} }
          if (key === 'graphData') {
            if (args.length === 0) return data
            data = args[0] as typeof data
          }
          return graph
        })
      },
    })
    mock.instances.push(graph)
    return graph
  } }
})

const snapshot: V2KnowledgeGraphSnapshot = {
  schemaVersion: 1, provider: { id: 'test', version: '1' }, graphId: 'any-project',
  revision: '1', ontologyVersion: '1', updatedAt: '2026-09-07',
  nodes: [{ id: 'a', label: 'Object A', type: 'AnyType', sourceRefs: ['source.md'] }],
  edges: [], communities: [],
}

function environment(reduced: boolean) {
  vi.stubGlobal('WebGLRenderingContext', class {})
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  vi.stubGlobal('matchMedia', vi.fn(() => ({
    matches: reduced, addEventListener() {}, removeEventListener() {},
  })))
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); mock.instances.length = 0 })

describe('native graph motion', () => {
  it('starts a live 3D engine without fixed positions or a premature reheat', () => {
    environment(false)
    render(<KnowledgeGraphExplorer snapshot={snapshot} />)
    const graph = mock.instances[0]!
    expect(graph.numDimensions).toHaveBeenCalledWith(3)
    expect(graph.warmupTicks).toHaveBeenCalledWith(40)
    expect(graph.cooldownTicks).toHaveBeenLastCalledWith(Infinity)
    expect(graph.d3ReheatSimulation).not.toHaveBeenCalled()
    const input = graph.graphData!.mock.calls.find(args => args.length > 0)![0] as { nodes: Record<string, unknown>[] }
    for (const key of ['x', 'y', 'z', 'fx', 'fy', 'fz']) expect(input.nodes[0]).not.toHaveProperty(key)
    input.nodes[0]!.x = 42
    expect(snapshot.nodes[0]).not.toHaveProperty('x')

    fireEvent.click(screen.getByRole('button', { name: '暂停图谱动画' }))
    expect(graph.cooldownTicks).toHaveBeenLastCalledWith(0)
    fireEvent.click(screen.getByRole('button', { name: '播放图谱动画' }))
    expect(graph.d3ReheatSimulation).toHaveBeenCalledOnce()
  })

  it('precomputes a settled native 3D view when reduced motion is requested', () => {
    environment(true)
    render(<KnowledgeGraphExplorer snapshot={snapshot} />)
    const graph = mock.instances[0]!
    expect(graph.warmupTicks).toHaveBeenCalledWith(240)
    expect(graph.cooldownTicks).toHaveBeenLastCalledWith(0)
    expect(screen.getByRole('button', { name: '播放图谱动画' })).toBeTruthy()
    expect(graph.d3ReheatSimulation).not.toHaveBeenCalled()
  })
})
