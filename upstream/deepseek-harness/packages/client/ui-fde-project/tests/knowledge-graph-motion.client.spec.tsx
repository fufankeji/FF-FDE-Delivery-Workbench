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
    expect(graph.warmupTicks).toHaveBeenCalledWith(120)
    expect(graph.cooldownTicks).toHaveBeenLastCalledWith(160)
    expect(graph.d3Force).toHaveBeenCalledWith('constellation', expect.any(Function))
    expect(graph.addPass).toHaveBeenCalledOnce()
    expect(graph.nodeThreeObject).toHaveBeenCalledWith(expect.any(Function))
    expect(graph.d3ReheatSimulation).not.toHaveBeenCalled()
    const input = graph.graphData!.mock.calls.find(args => args.length > 0)![0] as { nodes: Record<string, unknown>[] }
    for (const key of ['x', 'y', 'z', 'fx', 'fy', 'fz']) expect(input.nodes[0]).not.toHaveProperty(key)
    input.nodes[0]!.x = 42
    expect(snapshot.nodes[0]).not.toHaveProperty('x')

    fireEvent.click(screen.getByRole('button', { name: '暂停图谱动画' }))
    expect(graph.cooldownTicks).toHaveBeenLastCalledWith(0)
    expect(graph.linkDirectionalParticleSpeed).toHaveBeenLastCalledWith(0)
    fireEvent.click(screen.getByRole('button', { name: '播放图谱动画' }))
    expect(graph.d3ReheatSimulation).toHaveBeenCalledOnce()
  })

  it('precomputes a settled native 3D view when reduced motion is requested', () => {
    environment(true)
    render(<KnowledgeGraphExplorer snapshot={snapshot} />)
    const graph = mock.instances[0]!
    expect(graph.warmupTicks).toHaveBeenCalledWith(240)
    expect(graph.cooldownTicks).toHaveBeenLastCalledWith(0)
    expect(graph.linkDirectionalParticleSpeed).toHaveBeenLastCalledWith(0)
    expect(screen.getByRole('button', { name: '播放图谱动画' })).toBeTruthy()
    expect(graph.d3ReheatSimulation).not.toHaveBeenCalled()
  })

  it('keeps real nodes and connected groups when equal-weight cycles are filtered', () => {
    environment(false)
    const cyclic: V2KnowledgeGraphSnapshot = {
      ...snapshot,
      nodes: ['a', 'b', 'c', 'd', 'e', 'isolated'].map(id => ({ id, label: id, type: 'Object', sourceRefs: [] })),
      edges: [['ab', 'a', 'b'], ['bc', 'b', 'c'], ['ca', 'c', 'a'], ['de', 'd', 'e']].map(([id, source, target]) => ({
        id: id!, source: source!, target: target!, type: 'CONNECTS', weight: 1, sourceRefs: [],
      })),
    }
    const original = JSON.stringify(cyclic)
    render(<KnowledgeGraphExplorer snapshot={cyclic} />)
    const graph = mock.instances[0]!
    const input = graph.graphData!.mock.calls.find(args => args.length > 0)![0] as {
      nodes: { id: string; x?: number; y?: number; z?: number; vx?: number; vy?: number; vz?: number }[];
      links: { id: string }[];
    }
    fireEvent.click(screen.getByRole('button', { name: '主干关系' }))
    const visible = graph.linkVisibility!.mock.lastCall![0] as (link: { id: string }) => boolean
    expect(input.links.filter(visible).map(link => link.id)).toEqual(['ab', 'bc', 'de'])
    expect(input.nodes.map(node => node.id)).toContain('isolated')
    expect(input.nodes).toHaveLength(6)
    fireEvent.click(screen.getByRole('button', { name: '全部关系' }))
    expect(input.links.filter(graph.linkVisibility!.mock.lastCall![0])).toHaveLength(4)

    const force = graph.d3Force!.mock.calls.find(args => args[0] === 'constellation')![1] as
      ((alpha: number) => void) & { initialize(nodes: typeof input.nodes): void }
    const isolated = input.nodes.find(node => node.id === 'isolated')!
    isolated.x = 10_000; isolated.y = 10_000; isolated.z = 10_000
    force.initialize(input.nodes)
    force(1)
    expect(isolated.vx).toBeLessThan(0)
    expect(isolated.vy).toBeLessThan(0)
    expect(isolated.vz).toBeLessThan(0)
    expect(isolated).not.toHaveProperty('fx')
    expect(JSON.stringify(cyclic)).toBe(original)
  })

  it('creates real luminous geometry and disposes its materials and bloom on exit', () => {
    environment(false)
    const { unmount } = render(<KnowledgeGraphExplorer snapshot={snapshot} />)
    const graph = mock.instances[0]!
    const input = graph.graphData!.mock.calls.find(args => args.length > 0)![0]
    const object = graph.nodeThreeObject!.mock.lastCall![0]({ ...input.nodes[0], degree: 3 })
    expect(object.type).toBe('Group')
    expect(object.children.map((child: { type: string }) => child.type)).toEqual(['Mesh', 'Sprite', 'Mesh'])
    const disposals = object.children.map((child: { material: { dispose(): void } }) => vi.spyOn(child.material, 'dispose'))
    const bloom = graph.addPass!.mock.lastCall![0]
    const disposeBloom = vi.spyOn(bloom, 'dispose')
    unmount()
    for (const dispose of disposals) expect(dispose).toHaveBeenCalledOnce()
    expect(graph.removePass).toHaveBeenCalledWith(bloom)
    expect(disposeBloom).toHaveBeenCalledOnce()
  })
})
