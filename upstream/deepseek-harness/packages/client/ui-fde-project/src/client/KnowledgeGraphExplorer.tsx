/**
 * Project knowledge-graph explorer rendered with 3d-force-graph.
 * Semantica remains the graph-data provider; this module owns presentation only.
 */

import ForceGraph3D, {
  type ForceGraph3DInstance,
  type LinkObject,
  type NodeObject,
} from '3d-force-graph'
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import * as THREE from 'three'
import type { V2KnowledgeGraphSnapshot } from './controller.ts'
import {
  layoutKnowledgeGraph,
  type KnowledgeGraphLayout,
  type KnowledgeGraphLayoutCommunity,
  type KnowledgeGraphLayoutEdge,
  type KnowledgeGraphLayoutNode,
} from './knowledge-graph-layout.ts'
import css from './KnowledgeGraphExplorer.module.css'

const COMMUNITY_COLORS = [
  '#60a5fa',
  '#f5b65a',
  '#a78bfa',
  '#fb7185',
  '#34d399',
  '#5eead4',
  '#facc6b',
  '#c4b5fd',
  '#67c5da',
  '#b6c1d5',
] as const
const BACKGROUND_COLOR = '#020306'

type EdgeMode = 'primary' | 'all'

interface ProjectGraphNode extends NodeObject {
  readonly id: string
  readonly label: string
  readonly type: string
  readonly summary?: string
  readonly communityId: string
  readonly communityColor: string
  readonly confidence?: number
  readonly validFrom?: string
  readonly validUntil?: string
  readonly sourceRefs: readonly string[]
  readonly degree: number
  readonly value: number
}

interface ProjectGraphLink extends LinkObject<ProjectGraphNode> {
  readonly id: string
  source: string | ProjectGraphNode
  target: string | ProjectGraphNode
  readonly sourceId: string
  readonly targetId: string
  readonly sourceCommunityId: string
  readonly targetCommunityId: string
  readonly color: string
  readonly type: string
  readonly label?: string
  readonly weight: number
  readonly confidence?: number
  readonly validFrom?: string
  readonly validUntil?: string
  readonly sourceRefs: readonly string[]
  readonly primary: boolean
  readonly curvature: number
}

interface ProjectGraphData {
  readonly nodes: ProjectGraphNode[]
  readonly links: ProjectGraphLink[]
}

interface GraphVisualState {
  readonly edgeMode: EdgeMode
  readonly activeId: string | undefined
  readonly selectedId: string | undefined
  readonly isolatedCommunityId: string | undefined
  readonly relatedNodeIds: ReadonlySet<string>
}

interface OrbitLikeControls {
  autoRotate: boolean
  autoRotateSpeed: number
  enableDamping: boolean
  dampingFactor: number
}

interface GalaxyDust {
  readonly points: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>
  readonly dispose: () => void
}

function communityColor(index: number): string {
  return COMMUNITY_COLORS[index % COMMUNITY_COLORS.length] ?? COMMUNITY_COLORS[0]
}

function dimColor(value: string, factor: number): string {
  const color = new THREE.Color(value).multiplyScalar(factor)
  return `#${color.getHexString()}`
}

function graphEndpointId(value: string | number | ProjectGraphNode): string {
  return typeof value === 'object' ? value.id : String(value)
}

function edgeTouches(edge: ProjectGraphLink, nodeId: string): boolean {
  return edge.sourceId === nodeId || edge.targetId === nodeId
}

function edgeIsVisible(edge: ProjectGraphLink, state: GraphVisualState): boolean {
  if (state.isolatedCommunityId !== undefined
    && (edge.sourceCommunityId !== state.isolatedCommunityId || edge.targetCommunityId !== state.isolatedCommunityId)) return false
  if (state.activeId !== undefined && edgeTouches(edge, state.activeId)) return true
  return state.edgeMode === 'all' || edge.primary
}

function graphNodeColor(node: ProjectGraphNode, state: GraphVisualState): string {
  if (state.activeId === node.id) return '#f7fbff'
  if (state.activeId !== undefined && !state.relatedNodeIds.has(node.id)) return dimColor(node.communityColor, 0.16)
  return node.communityColor
}

function graphLinkColor(edge: ProjectGraphLink, state: GraphVisualState): string {
  if (state.activeId !== undefined && edgeTouches(edge, state.activeId)) return '#8bd5eb'
  if (state.activeId !== undefined) return '#182633'
  return '#b8c5d4'
}

function graphLinkWidth(edge: ProjectGraphLink, state: GraphVisualState): number {
  if (state.activeId !== undefined && edgeTouches(edge, state.activeId)) return 0.32
  return 0
}

function graphLinkParticles(edge: ProjectGraphLink, state: GraphVisualState): number {
  if (!edgeIsVisible(edge, state)) return 0
  return state.activeId !== undefined && edgeTouches(edge, state.activeId) ? 2 : 0
}

function primaryEdgeIds(edges: readonly KnowledgeGraphLayoutEdge[]): ReadonlySet<string> {
  const weights = edges.map(edge => edge.weight).sort((left, right) => right - left)
  const threshold = weights[Math.max(0, Math.floor(weights.length * 0.36) - 1)] ?? 0
  return new Set(edges.filter(edge => edge.weight >= threshold).map(edge => edge.id))
}

function prepareGraphData(layout: KnowledgeGraphLayout): ProjectGraphData {
  const primary = primaryEdgeIds(layout.edges)
  const communityIndex = new Map(layout.communities.map((community, index) => [community.id, index]))
  const nodes = layout.nodes.map((node): ProjectGraphNode => ({
    id: node.id,
    label: node.label,
    type: node.type,
    ...(node.summary === undefined ? {} : { summary: node.summary }),
    communityId: node.communityId,
    communityColor: communityColor(communityIndex.get(node.communityId) ?? 0),
    ...(node.confidence === undefined ? {} : { confidence: node.confidence }),
    ...(node.validFrom === undefined ? {} : { validFrom: node.validFrom }),
    ...(node.validUntil === undefined ? {} : { validUntil: node.validUntil }),
    sourceRefs: node.sourceRefs,
    degree: node.degree,
    value: 0.72 + Math.min(2.3, Math.log2(Math.max(0, node.degree) + 1) * 0.46),
  }))
  const links = layout.edges.map((edge): ProjectGraphLink => {
    return {
      id: edge.id,
      source: edge.source.id,
      target: edge.target.id,
      sourceId: edge.source.id,
      targetId: edge.target.id,
      sourceCommunityId: edge.source.communityId,
      targetCommunityId: edge.target.communityId,
      color: communityColor(communityIndex.get(edge.source.communityId) ?? 0),
      type: edge.type,
      ...(edge.label === undefined ? {} : { label: edge.label }),
      weight: edge.weight,
      ...(edge.confidence === undefined ? {} : { confidence: edge.confidence }),
      ...(edge.validFrom === undefined ? {} : { validFrom: edge.validFrom }),
      ...(edge.validUntil === undefined ? {} : { validUntil: edge.validUntil }),
      sourceRefs: edge.sourceRefs,
      primary: primary.has(edge.id),
      curvature: edge.source.id === edge.target.id ? 0.42 : 0,
    }
  })
  return { nodes, links }
}

function createNodeTooltip(node: ProjectGraphNode): HTMLElement {
  const value = document.createElement('div')
  value.className = css.graphTooltip!
  const title = document.createElement('strong')
  title.textContent = node.label
  const detail = document.createElement('span')
  detail.textContent = `${node.type} · ${String(node.degree)} 条直接关联`
  value.append(title, detail)
  return value
}

function createLinkTooltip(edge: ProjectGraphLink): HTMLElement {
  const value = document.createElement('div')
  value.className = css.graphTooltip!
  const title = document.createElement('strong')
  title.textContent = edge.label ?? edge.type
  const detail = document.createElement('span')
  detail.textContent = `${graphEndpointId(edge.source)} → ${graphEndpointId(edge.target)}`
  value.append(title, detail)
  return value
}

function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0
    seed = seed + 0x6d2b79f5 | 0
    let value = Math.imul(seed ^ seed >>> 15, 1 | seed)
    value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value
    return ((value ^ value >>> 14) >>> 0) / 4_294_967_296
  }
}

function createGalaxyDust(): GalaxyDust {
  const random = mulberry32(40_407)
  const positions = new Float32Array(1_200 * 3)
  const colors = new Float32Array(1_200 * 3)
  for (let index = 0; index < 1_200; index += 1) {
    const radius = 110 + random() * 250
    const theta = random() * Math.PI * 2
    const phi = Math.acos(2 * random() - 1)
    positions[index * 3] = radius * Math.sin(phi) * Math.cos(theta) * 1.65
    positions[index * 3 + 1] = radius * Math.cos(phi) * 0.84
    positions[index * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta) * 1.18
    const color = new THREE.Color(COMMUNITY_COLORS[index % COMMUNITY_COLORS.length]).multiplyScalar(0.5 + random() * 0.48)
    colors[index * 3] = color.r
    colors[index * 3 + 1] = color.g
    colors[index * 3 + 2] = color.b
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  const material = new THREE.PointsMaterial({
    size: 0.9,
    sizeAttenuation: false,
    vertexColors: true,
    transparent: true,
    opacity: 0.38,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const points = new THREE.Points(geometry, material)
  points.frustumCulled = false
  points.rotation.x = -0.08
  return {
    points,
    dispose: () => {
      geometry.dispose()
      material.dispose()
    },
  }
}

function createGraphLabels(
  host: HTMLElement,
  graph: ForceGraph3DInstance<ProjectGraphNode, ProjectGraphLink>,
  onSelect: (id: string) => void,
) {
  const layer = document.createElement('div')
  layer.className = css.labelLayer!
  host.append(layer)
  const labels = graph.graphData().nodes.map(node => {
    const element = document.createElement('button')
    element.type = 'button'
    element.className = css.nodeLabel!
    element.textContent = node.label
    element.setAttribute('data-graph-label', node.id)
    element.setAttribute('aria-label', `查看实体：${node.label}`)
    element.addEventListener('click', event => { event.stopPropagation(); onSelect(node.id) })
    layer.append(element)
    return { node, element, width: element.offsetWidth }
  }).sort((left, right) => right.node.degree - left.node.degree)
  const point = new THREE.Vector3()
  return {
    update(state: GraphVisualState): void {
      const width = graph.width()
      const height = graph.height()
      const right = state.selectedId === undefined ? width - 20 : width - Math.min(358, width * 0.4)
      const occupied: { x: number, y: number, width: number }[] = []
      const limit = Math.min(24, Math.max(8, Math.floor(width * height / 28000)))
      const ordered = state.activeId === undefined ? labels : [...labels].sort((a, b) =>
        Number(b.node.id === state.activeId) - Number(a.node.id === state.activeId))
      for (const { node, element, width: labelWidth } of ordered) {
        const relevant = state.relatedNodeIds.has(node.id)
        const eligible = state.isolatedCommunityId !== undefined
          ? node.communityId === state.isolatedCommunityId
          : state.activeId !== undefined && relevant
        point.set(node.x ?? 0, node.y ?? 0, node.z ?? 0).project(graph.camera())
        const sx = (point.x + 1) * width / 2
        const sy = (1 - point.y) * height / 2
        const x = sx + 9 + labelWidth < right ? sx + 9 : sx - labelWidth - 9
        const y = sy - 8
        const visible = eligible && occupied.length < limit && point.z > -1 && point.z < 1
          && x >= 16 && x + labelWidth <= right && y > 65 && y < height - 68
          && !occupied.some(box => x < box.x + box.width + 8 && x + labelWidth + 8 > box.x && Math.abs(y - box.y) < 22)
        element.hidden = !visible
        if (!visible) continue
        element.style.transform = `translate3d(${String(x)}px,${String(y)}px,0)`
        element.dataset.active = String(node.id === state.activeId)
        occupied.push({ x, y, width: labelWidth })
      }
    },
    dispose(): void { layer.remove() },
  }
}

function applyVisualState(
  graph: ForceGraph3DInstance<ProjectGraphNode, ProjectGraphLink>,
  state: GraphVisualState,
): void {
  graph
    .nodeVisibility(node => state.isolatedCommunityId === undefined || node.communityId === state.isolatedCommunityId)
    .nodeColor(node => graphNodeColor(node, state))
    .linkVisibility(edge => edgeIsVisible(edge, state))
    .linkColor(edge => graphLinkColor(edge, state))
    .linkWidth(edge => graphLinkWidth(edge, state))
    .linkDirectionalParticles(edge => graphLinkParticles(edge, state))
    .linkDirectionalParticleWidth(edge => state.activeId !== undefined && edgeTouches(edge, state.activeId) ? 0.55 : 0)
    .linkDirectionalParticleColor(edge => graphLinkColor(edge, state))
    .refresh()
}

function focusGraphNode(
  graph: ForceGraph3DInstance<ProjectGraphNode, ProjectGraphLink>,
  selectedId: string,
): void {
  const ids = new Set([selectedId])
  for (const edge of graph.graphData().links) {
    if (edgeTouches(edge, selectedId)) { ids.add(edge.sourceId); ids.add(edge.targetId) }
  }
  fitGraphView(graph, 250, node => ids.has(node.id), true)
}

function fitGraphView(
  graph: ForceGraph3DInstance<ProjectGraphNode, ProjectGraphLink>,
  duration: number,
  filter?: (node: ProjectGraphNode) => boolean,
  inspectorOpen = false,
): void {
  const nodes = graph.graphData().nodes.filter(node => (
    (filter?.(node) ?? true)
    && Number.isFinite(node.x)
    && Number.isFinite(node.y)
    && Number.isFinite(node.z)
  ))
  if (nodes.length === 0) return
  const minimum = {
    x: Math.min(...nodes.map(node => node.x ?? 0)),
    y: Math.min(...nodes.map(node => node.y ?? 0)),
    z: Math.min(...nodes.map(node => node.z ?? 0)),
  }
  const maximum = {
    x: Math.max(...nodes.map(node => node.x ?? 0)),
    y: Math.max(...nodes.map(node => node.y ?? 0)),
    z: Math.max(...nodes.map(node => node.z ?? 0)),
  }
  const center = {
    x: (minimum.x + maximum.x) / 2,
    y: (minimum.y + maximum.y) / 2,
    z: (minimum.z + maximum.z) / 2,
  }
  const camera = graph.camera() as THREE.PerspectiveCamera
  const verticalFov = THREE.MathUtils.degToRad(camera.fov)
  const usableWidth = Math.max(160, graph.width() - (inspectorOpen ? Math.min(358, graph.width() * 0.4) : 100))
  const usableHeight = Math.max(160, graph.height() - 150)
  const aspect = usableWidth / usableHeight
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * aspect)
  const width = Math.max(inspectorOpen ? 180 : 80, maximum.x - minimum.x + 38)
  const height = Math.max(inspectorOpen ? 100 : 50, maximum.y - minimum.y + 28)
  const depth = Math.max(0, maximum.z - minimum.z)
  const distance = Math.max(
    width / (2 * Math.tan(horizontalFov / 2)),
    height / (2 * Math.tan(verticalFov / 2)),
  ) * graph.height() / usableHeight + depth / 2
  const offsetX = inspectorOpen ? distance * Math.tan(verticalFov / 2) * (graph.width() - usableWidth) / graph.height() : 0
  const target = { x: center.x + offsetX, y: center.y - 4, z: center.z }
  graph.cameraPosition({ x: target.x, y: target.y, z: center.z + distance }, target,
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : duration)
}

function ForceGraphCanvas({
  data,
  visualState,
  resetVersion,
  playing,
  onPause,
  onSelect,
  onHover,
  onClear,
}: {
  readonly data: ProjectGraphData
  readonly visualState: GraphVisualState
  readonly resetVersion: number
  readonly playing: boolean
  readonly onPause: () => void
  readonly onSelect: (id: string) => void
  readonly onHover: (id?: string) => void
  readonly onClear: () => void
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const graphRef = useRef<ForceGraph3DInstance<ProjectGraphNode, ProjectGraphLink>>()
  const stateRef = useRef(visualState)
  const playingRef = useRef(playing)
  const previousPlaying = useRef(playing)
  const previousSelectedId = useRef<string>()
  const previousIsolatedCommunityId = useRef<string>()
  const previousResetVersion = useRef(resetVersion)
  stateRef.current = visualState
  playingRef.current = playing

  useEffect(() => {
    const host = hostRef.current
    if (host === null) return
    // The upstream constructor erases generics; graphData below supplies the typed project data.
    const graph = new ForceGraph3D(host, {
      controlType: 'orbit',
      rendererConfig: { antialias: true, alpha: false, powerPreference: 'high-performance' },
    }) as unknown as ForceGraph3DInstance<ProjectGraphNode, ProjectGraphLink>
    graphRef.current = graph
    const dust = createGalaxyDust()
    const scene = graph.scene()
    scene.add(dust.points)
    const renderer = graph.renderer()
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace

    let fitted = false
    let interacted = false
    const fitInitial = (): void => {
      if (fitted || interacted) return
      fitted = true
      // Match upstream's node-count camera distance. Fitting every outlier here
      // turns the reference's immersive network into a tiny distant sphere.
      graph.cameraPosition({ x: 0, y: 0, z: Math.cbrt(Math.max(1, data.nodes.length)) * 170 })
    }
    graph
      .backgroundColor(BACKGROUND_COLOR)
      .showNavInfo(false)
      .numDimensions(3)
      .nodeId('id')
      .nodeVal(node => node.value)
      .nodeRelSize(4)
      .nodeOpacity(0.85)
      .nodeLabel(createNodeTooltip)
      .linkLabel(createLinkTooltip)
      .linkOpacity(0.4)
      .linkCurvature(edge => edge.curvature)
      .linkDirectionalParticleSpeed(0.004)
      .linkHoverPrecision(4)
      // Use the upstream live 3D simulation, never a prepacked 2D layout.
      .warmupTicks(playingRef.current ? 40 : 240)
      .cooldownTicks(playingRef.current ? Infinity : 0)
      .onEngineTick(fitInitial)
      .onEngineStop(fitInitial)
      .onNodeClick(node => { onPause(); onSelect(node.id) })
      .onNodeHover(node => { onHover(node?.id) })
      .onBackgroundClick(() => { onClear() })
      .graphData({
        nodes: data.nodes.map(node => ({ ...node })),
        links: data.links.map(edge => ({ ...edge, source: edge.sourceId, target: edge.targetId })),
      })
    applyVisualState(graph, stateRef.current)
    const labels = createGraphLabels(host, graph, id => { onPause(); onSelect(id) })
    const controls = graph.controls() as OrbitLikeControls
    controls.autoRotate = false
    controls.autoRotateSpeed = 0.7
    controls.enableDamping = true
    controls.dampingFactor = 0.1

    const interrupt = (): void => {
      interacted = true
      onPause()
    }
    host.addEventListener('pointerdown', interrupt)
    host.addEventListener('wheel', interrupt, { passive: true })

    const resize = (): void => {
      const bounds = host.getBoundingClientRect()
      graph.width(Math.max(1, Math.round(bounds.width))).height(Math.max(1, Math.round(bounds.height)))
      const state = stateRef.current
      if (state.selectedId !== undefined) focusGraphNode(graph, state.selectedId)
    }
    resize()
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(resize)
    observer?.observe(host)
    if (observer === undefined) window.addEventListener('resize', resize)

    let animationFrame = 0
    let previousFrame = 0
    let previousTime = 0
    const animate = (time: number): void => {
      const state = stateRef.current
      const moving = fitted && playingRef.current && state.activeId === undefined
      controls.autoRotate = moving
      // A camera-centered sky stays behind the graph at every zoom level.
      dust.points.position.copy(graph.camera().position)
      dust.points.scale.setScalar(20)
      if (moving && previousTime > 0) dust.points.rotation.y += Math.min(50, time - previousTime) * 0.000003
      previousTime = time
      if (time - previousFrame > 32) {
        labels.update(state)
        previousFrame = time
      }
      animationFrame = requestAnimationFrame(animate)
    }
    animationFrame = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(animationFrame)
      observer?.disconnect()
      host.removeEventListener('pointerdown', interrupt)
      host.removeEventListener('wheel', interrupt)
      if (observer === undefined) window.removeEventListener('resize', resize)
      labels.dispose()
      scene.remove(dust.points)
      dust.dispose()
      graph._destructor()
      graphRef.current = undefined
    }
  }, [data, onClear, onHover, onPause, onSelect])

  useEffect(() => {
    const graph = graphRef.current
    if (graph === undefined) return
    const controls = graph.controls() as OrbitLikeControls
    controls.autoRotate = playing && visualState.activeId === undefined
    graph.cooldownTicks(playing ? Infinity : 0)
    // Reheating before the upstream deferred graph initialization would tick an absent layout.
    if (playing && !previousPlaying.current) graph.d3ReheatSimulation()
    previousPlaying.current = playing
  }, [playing])

  useEffect(() => {
    const graph = graphRef.current
    if (graph === undefined) return
    applyVisualState(graph, visualState)
    const isolationChanged = previousIsolatedCommunityId.current !== visualState.isolatedCommunityId
    if (visualState.selectedId !== undefined && previousSelectedId.current !== visualState.selectedId) {
      focusGraphNode(graph, visualState.selectedId)
    } else if (isolationChanged || (previousSelectedId.current !== undefined && visualState.selectedId === undefined)) {
      fitGraphView(
        graph,
        250,
        visualState.isolatedCommunityId === undefined
          ? undefined
          : node => node.communityId === visualState.isolatedCommunityId,
      )
    }
    previousSelectedId.current = visualState.selectedId
    previousIsolatedCommunityId.current = visualState.isolatedCommunityId
  }, [visualState])

  useEffect(() => {
    if (previousResetVersion.current === resetVersion) return
    previousResetVersion.current = resetVersion
    const graph = graphRef.current
    if (graph === undefined) return
    fitGraphView(graph, 250)
  }, [resetVersion])

  return <div ref={hostRef} className={css.graphHost} data-knowledge-graph-renderer="3d-force-graph" />
}

function supportsWebGl(): boolean {
  return typeof window !== 'undefined' && typeof window.WebGLRenderingContext !== 'undefined'
}

function SearchIcon() {
  return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5" stroke="currentColor" strokeWidth="1.5" /><path d="m12.2 12.2 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
}

function ResetIcon() {
  return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4.2 7.2A6.2 6.2 0 1 1 4 12.1M4.2 7.2V3.5M4.2 7.2h3.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

function CloseIcon() {
  return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m5 5 10 10M15 5l-10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
}

function ExpandIcon() {
  return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M7 3H3v4m10-4h4v4M3 13v4h4m10-4v4h-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

function formatConfidence(value: number | undefined): string {
  return value === undefined ? '未登记' : `${String(Math.round(value * 100))}%`
}

function formatTime(value: string | undefined): string {
  return value === undefined ? '未登记' : new Date(value).toLocaleDateString('zh-CN')
}

function relatedNodeIds(layout: KnowledgeGraphLayout, activeId: string | undefined): ReadonlySet<string> {
  const related = new Set<string>()
  if (activeId === undefined) return related
  related.add(activeId)
  for (const edge of layout.edges) {
    if (edge.source.id === activeId) related.add(edge.target.id)
    if (edge.target.id === activeId) related.add(edge.source.id)
  }
  return related
}

export function KnowledgeGraphExplorer({ snapshot }: { readonly snapshot: V2KnowledgeGraphSnapshot }) {
  const rootRef = useRef<HTMLElement>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const layout = useMemo(() => layoutKnowledgeGraph(snapshot), [snapshot])
  const graphData = useMemo(() => prepareGraphData(layout), [layout])
  const [selectedId, setSelectedId] = useState<string>()
  const [hoveredId, setHoveredId] = useState<string>()
  const [query, setQuery] = useState('')
  const [edgeMode, setEdgeMode] = useState<EdgeMode>('all')
  const [playing, setPlaying] = useState(() => !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  const [isolatedCommunityId, setIsolatedCommunityId] = useState<string>()
  const [resetVersion, setResetVersion] = useState(0)
  const selected = selectedId === undefined ? undefined : layout.nodes.find(node => node.id === selectedId)
  const active = hoveredId === undefined ? selected : layout.nodes.find(node => node.id === hoveredId) ?? selected
  const activeId = active?.id
  const visualState = useMemo<GraphVisualState>(() => ({
    edgeMode,
    activeId,
    selectedId,
    isolatedCommunityId,
    relatedNodeIds: relatedNodeIds(layout, activeId),
  }), [activeId, edgeMode, isolatedCommunityId, layout, selectedId])
  const searchResults = query.trim() === ''
    ? []
    : layout.nodes
      .filter(node => `${node.label} ${node.type} ${node.summary ?? ''}`
        .toLocaleLowerCase()
        .includes(query.trim().toLocaleLowerCase()))
      .slice(0, 8)
  const connected = selected === undefined
    ? []
    : layout.edges.filter(edge => edge.source.id === selected.id || edge.target.id === selected.id)
  const legend = layout.communities.filter(community => community.nodeIds.length > 0)

  const pause = useCallback((): void => { setPlaying(false) }, [])
  useEffect(() => {
    const preference = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    const update = (): void => { if (preference?.matches) pause() }
    preference?.addEventListener('change', update)
    return () => { preference?.removeEventListener('change', update) }
  }, [pause])

  useEffect(() => {
    const update = (): void => { setFullscreen(document.fullscreenElement === rootRef.current) }
    document.addEventListener('fullscreenchange', update)
    return () => { document.removeEventListener('fullscreenchange', update) }
  }, [])

  const selectNode = useCallback((id: string): void => {
    setPlaying(false)
    const node = layout.nodes.find(candidate => candidate.id === id)
    setIsolatedCommunityId(current => node !== undefined && current !== undefined && node.communityId !== current
      ? undefined
      : current)
    setSelectedId(id)
    setHoveredId(undefined)
    setQuery('')
  }, [layout.nodes])
  const clearSelection = useCallback((): void => {
    setSelectedId(undefined)
    setHoveredId(undefined)
  }, [])
  const reset = (): void => {
    clearSelection()
    setIsolatedCommunityId(undefined)
    setQuery('')
    setResetVersion(value => value + 1)
  }

  return <section
    ref={rootRef}
    className={css.root}
    data-knowledge-graph
    aria-label={`项目知识图谱：${String(snapshot.nodes.length)} 个节点，${String(snapshot.edges.length)} 条关系`}
  >
    <div
      className={css.canvas}
      data-knowledge-graph-canvas
      data-node-hovered={hoveredId !== undefined}
      onPointerLeave={() => { setHoveredId(undefined) }}
    >
      <div className={css.toolbar} data-knowledge-graph-toolbar>
        <div className={css.search}>
          <input
            value={query}
            onChange={(event) => { setQuery(event.target.value) }}
            placeholder="搜索实体、类型或说明"
            aria-label="搜索知识图谱"
          />
          <SearchIcon />
          {searchResults.length > 0 && <div className={css.searchResults}>
            {searchResults.map(node => <button
              key={node.id}
              type="button"
              onClick={() => { selectNode(node.id) }}
            >
              <span>{node.label}</span>
              <small>{node.type}</small>
            </button>)}
          </div>}
        </div>
        <div className={css.viewControls} aria-label="关系显示范围">
          <button
            type="button"
            data-knowledge-graph-control="primary"
            data-active={edgeMode === 'primary'}
            aria-pressed={edgeMode === 'primary'}
            onClick={() => { setEdgeMode('primary') }}
          >主干关系</button>
          <button
            type="button"
            data-active={edgeMode === 'all'}
            aria-pressed={edgeMode === 'all'}
            onClick={() => { setEdgeMode('all') }}
          >全部关系</button>
        </div>
        <button
          className={css.resetButton}
          type="button"
          aria-label={playing ? '暂停图谱动画' : '播放图谱动画'}
          title={playing ? '暂停动画' : '播放动画'}
          aria-pressed={playing}
          onClick={() => {
            if (!playing) clearSelection()
            setPlaying(value => !value)
          }}
        ><svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          {playing ? <path d="M5 4h3v12H5zm7 0h3v12h-3z" /> : <path d="m6 3 10 7-10 7z" />}
        </svg></button>
        <button className={css.resetButton} type="button" onClick={reset} aria-label="重置知识图谱视角" title="适应视图">
          <ResetIcon />
        </button>
        {document.fullscreenEnabled && <button
          className={css.resetButton}
          type="button"
          aria-label={fullscreen ? '退出图谱全屏' : '全屏查看知识图谱'}
          title={fullscreen ? '退出全屏' : '全屏查看'}
          onClick={() => {
            const request = fullscreen ? document.exitFullscreen() : rootRef.current?.requestFullscreen()
            // A lost user-activation or browser policy may deny fullscreen; the inline graph remains usable.
            void request?.catch(() => {})
          }}
        ><ExpandIcon /></button>}
      </div>

      {supportsWebGl()
        ? <ForceGraphCanvas
          data={graphData}
          visualState={visualState}
          resetVersion={resetVersion}
          playing={playing}
          onPause={pause}
          onSelect={selectNode}
          onHover={setHoveredId}
          onClear={clearSelection}
        />
        : <div className={css.webglFallback} role="img" aria-label="知识图谱三维视图不可用">
          <strong>当前环境无法启动三维图谱</strong>
          <p>图谱快照已经加载；请在支持 WebGL 的浏览器中查看三维节点、关系和镜头交互。</p>
        </div>}

      <div className={css.footer}>
      <div className={css.summary}>
      <div className={css.status} data-knowledge-graph-status>
        {active === undefined
          ? `${String(snapshot.nodes.length)} 个实体 · ${String(snapshot.edges.length)} 条关系`
          : `${active.label} · ${active.type}`}
      </div>
      <div className={css.interactionHint}>拖拽旋转 · 滚轮缩放 · 点击查看</div>
      </div>
      <div className={css.legend} aria-label="知识社区图例">
        {legend.map((community: KnowledgeGraphLayoutCommunity, index) => <button
          key={community.id}
          type="button"
          onClick={() => {
            pause()
            clearSelection()
            setIsolatedCommunityId(current => current === community.id ? undefined : community.id)
          }}
          data-active={isolatedCommunityId === community.id}
          aria-pressed={isolatedCommunityId === community.id}
          style={{ '--legend-color': communityColor(index) } as CSSProperties}
        >
          <i />
          <span>{community.label}</span>
        </button>)}
      </div>
      </div>

      {selected !== undefined && <aside
        className={css.inspector}
        data-knowledge-graph-inspector
        aria-label={`实体详情：${selected.label}`}
      >
        <header>
          <div><small>{selected.type}</small><strong data-knowledge-graph-inspector-title>{selected.label}</strong></div>
          <button
            className={css.closeInspector}
            type="button"
            onClick={clearSelection}
            aria-label="关闭实体详情"
          >
            <CloseIcon />
          </button>
        </header>
        <div className={css.inspectorBody}>
          {selected.summary !== undefined && <p>{selected.summary}</p>}
          <div className={css.inspectorFacts}>
            <span><small>关系数量</small><b>{connected.length}</b></span>
            <span><small>置信度</small><b>{formatConfidence(selected.confidence)}</b></span>
            <span><small>有效开始</small><b>{formatTime(selected.validFrom)}</b></span>
            <span><small>有效结束</small><b>{formatTime(selected.validUntil)}</b></span>
          </div>
          <section className={css.inspectorSection}><span>直接关系</span><ul>{connected.slice(0, 12).map((edge) => {
            const peer: KnowledgeGraphLayoutNode = edge.source.id === selected.id ? edge.target : edge.source
            return <li key={edge.id} className={css.relationItem}>
              <button type="button" className={css.relationButton} onClick={() => { selectNode(peer.id) }}>
                <span>{edge.label ?? edge.type} → {peer.label}</span>
                <code>{formatConfidence(edge.confidence)}</code>
              </button>
            </li>
          })}</ul></section>
          <section className={css.inspectorSection}>
            <span>来源证据</span>
            <ul>{selected.sourceRefs.length === 0
              ? <li className={css.sourceItem}><span>未登记来源</span></li>
              : selected.sourceRefs.map(source => <li key={source} className={css.sourceItem}><code>{source}</code></li>)}</ul>
          </section>
        </div>
      </aside>}
    </div>
  </section>
}
