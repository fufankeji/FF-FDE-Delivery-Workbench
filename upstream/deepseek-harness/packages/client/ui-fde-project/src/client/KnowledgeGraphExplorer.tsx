/**
 * Project knowledge-graph renderer adapted from GraphRAG Workbench's 3D graph
 * scene, force layout, progressive reveal, camera focus, and bloom treatment.
 * See THIRD_PARTY_NOTICES.md for attribution.
 */

import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import type { V2KnowledgeGraphSnapshot } from './controller.ts'
import {
  layoutKnowledgeGraph,
  type KnowledgeGraphLayout,
  type KnowledgeGraphLayoutCommunity,
  type KnowledgeGraphLayoutEdge,
  type KnowledgeGraphLayoutNode,
} from './knowledge-graph-layout.ts'
import css from './KnowledgeGraphExplorer.module.css'

const COMMUNITY_COLORS = [0x47a8ff, 0x36ddbd, 0x8f7aff, 0xffb65c, 0x54d978, 0xff7597, 0x70d8ff, 0xb4d85b] as const
const BACKGROUND_COLOR = 0x030918
const LABEL_COLOR = 0xf2f7ff
const MUTED_LABEL_COLOR = 0xa6b5cc

type EdgeMode = 'primary' | 'all'

function communityColorValue(index: number): number {
  return COMMUNITY_COLORS[index % COMMUNITY_COLORS.length] ?? COMMUNITY_COLORS[0]
}

function colorForCommunity(id: string, communities: readonly KnowledgeGraphLayoutCommunity[]): THREE.Color {
  const index = Math.max(0, communities.findIndex(community => community.id === id))
  return new THREE.Color(communityColorValue(index))
}

function smoothReveal(value: number): number {
  const bounded = Math.min(1, Math.max(0, value))
  return bounded * bounded * (3 - 2 * bounded)
}

function GraphNodeInstances({ layout, selectedId, isolatedCommunityId, onSelect, onHover }: {
  readonly layout: KnowledgeGraphLayout
  readonly selectedId: string | undefined
  readonly isolatedCommunityId: string | undefined
  readonly onSelect: (id: string) => void
  readonly onHover: (id?: string) => void
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const startTime = useRef<number>()
  const matrix = useMemo(() => new THREE.Matrix4(), [])
  const position = useMemo(() => new THREE.Vector3(), [])
  const scale = useMemo(() => new THREE.Vector3(), [])
  const quaternion = useMemo(() => new THREE.Quaternion(), [])
  const geometry = useMemo(() => new THREE.IcosahedronGeometry(1, 3), [])
  const material = useMemo(() => new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
    uniforms: { time: { value: 0 }, intensity: { value: 1 } },
    vertexShader: `
      attribute vec3 instanceColor;
      varying vec3 vColor;
      varying float vFresnel;
      varying float vPulseSeed;
      void main() {
        vec4 modelPosition = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vec4 viewPosition = viewMatrix * modelPosition;
        vec3 viewNormal = normalize(normalMatrix * mat3(instanceMatrix) * normal);
        vec3 viewDirection = normalize(-viewPosition.xyz);
        vColor = instanceColor;
        vFresnel = pow(1.0 - max(dot(viewNormal, viewDirection), 0.0), 2.3);
        vPulseSeed = length(modelPosition.xyz) * 0.08;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform float time;
      uniform float intensity;
      varying vec3 vColor;
      varying float vFresnel;
      varying float vPulseSeed;
      void main() {
        float pulse = 0.78 + 0.22 * sin(time * 1.45 + vPulseSeed);
        float core = 0.72 + vFresnel * 1.5;
        vec3 color = vColor * core * pulse * intensity;
        gl_FragColor = vec4(color, 0.84 + vFresnel * 0.14);
      }
    `,
  }), [])

  useEffect(() => () => { geometry.dispose(); material.dispose() }, [geometry, material])

  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (mesh === null) return
    layout.nodes.forEach((node, index) => {
      const color = colorForCommunity(node.communityId, layout.communities)
      const isolated = isolatedCommunityId === undefined || node.communityId === isolatedCommunityId
      const related = selectedId === undefined
        || node.id === selectedId
        || layout.edges.some(edge => (
          (edge.source.id === selectedId && edge.target.id === node.id)
          || (edge.target.id === selectedId && edge.source.id === node.id)
        ))
      if (!isolated) color.multiplyScalar(0.08)
      else if (!related) color.multiplyScalar(0.22)
      mesh.setColorAt(index, color)
    })
    if (mesh.instanceColor !== null) mesh.instanceColor.needsUpdate = true
  }, [isolatedCommunityId, layout, selectedId])

  useFrame(({ clock }) => {
    const mesh = meshRef.current
    if (mesh === null) return
    const startedAt = startTime.current ?? clock.elapsedTime
    startTime.current = startedAt
    const elapsed = clock.elapsedTime - startedAt
    layout.nodes.forEach((node, index) => {
      const reveal = smoothReveal((elapsed - index * 0.018) / 0.42)
      const selectedScale = node.id === selectedId ? 1.42 : 1
      position.set(node.x, node.y, node.z)
      scale.setScalar(node.size * reveal * selectedScale)
      matrix.compose(position, quaternion, scale)
      mesh.setMatrixAt(index, matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
    const timeUniform = material.uniforms.time
    if (timeUniform !== undefined) timeUniform.value = clock.elapsedTime
  })

  return <instancedMesh
    ref={meshRef}
    args={[geometry, material, layout.nodes.length]}
    frustumCulled={false}
    onClick={(event) => {
      event.stopPropagation()
      const instanceId = (event as typeof event & { readonly instanceId?: number }).instanceId
      const node = instanceId === undefined ? undefined : layout.nodes[instanceId]
      if (node !== undefined) onSelect(node.id)
    }}
    onPointerMove={(event) => {
      event.stopPropagation()
      const instanceId = (event as typeof event & { readonly instanceId?: number }).instanceId
      onHover(instanceId === undefined ? undefined : layout.nodes[instanceId]?.id)
    }}
    onPointerOut={() => { onHover(undefined) }}
  />
}

function edgeIsVisible(
  edge: KnowledgeGraphLayoutEdge,
  threshold: number,
  mode: EdgeMode,
  selectedId?: string,
  isolatedCommunityId?: string,
): boolean {
  if (isolatedCommunityId !== undefined
    && (edge.source.communityId !== isolatedCommunityId || edge.target.communityId !== isolatedCommunityId)) return false
  if (selectedId !== undefined && (edge.source.id === selectedId || edge.target.id === selectedId)) return true
  return mode === 'all' || edge.weight >= threshold
}

function GraphEdges({ layout, mode, selectedId, isolatedCommunityId }: {
  readonly layout: KnowledgeGraphLayout
  readonly mode: EdgeMode
  readonly selectedId: string | undefined
  readonly isolatedCommunityId: string | undefined
}) {
  const threshold = useMemo(() => {
    const weights = layout.edges.map(edge => edge.weight).sort((left, right) => right - left)
    return weights[Math.max(0, Math.floor(weights.length * 0.36) - 1)] ?? 0
  }, [layout.edges])
  const edges = useMemo(
    () => layout.edges.filter(edge => edgeIsVisible(edge, threshold, mode, selectedId, isolatedCommunityId)),
    [isolatedCommunityId, layout.edges, mode, selectedId, threshold],
  )
  const geometry = useMemo(() => {
    const positions = new Float32Array(edges.length * 6)
    const colors = new Float32Array(edges.length * 6)
    edges.forEach((edge, index) => {
      positions.set([edge.source.x, edge.source.y, edge.source.z, edge.target.x, edge.target.y, edge.target.z], index * 6)
      const highlighted = selectedId !== undefined && (edge.source.id === selectedId || edge.target.id === selectedId)
      const color = highlighted
        ? colorForCommunity(edge.source.communityId, layout.communities).lerp(new THREE.Color(LABEL_COLOR), 0.48)
        : colorForCommunity(edge.source.communityId, layout.communities).multiplyScalar(selectedId === undefined ? 0.56 : 0.17)
      colors.set([color.r, color.g, color.b, color.r, color.g, color.b], index * 6)
    })
    const value = new THREE.BufferGeometry()
    value.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    value.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return value
  }, [edges, layout.communities, selectedId])
  const material = useMemo(() => new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.54,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }), [])
  useEffect(() => () => { geometry.dispose() }, [geometry])
  useEffect(() => () => { material.dispose() }, [material])
  return <lineSegments geometry={geometry} material={material} frustumCulled={false} />
}

function FlowingEdge({ edge, color, offset }: {
  readonly edge: KnowledgeGraphLayoutEdge
  readonly color: THREE.Color
  readonly offset: number
}) {
  const particle = useRef<THREE.Mesh>(null)
  const curve = useMemo(() => {
    const start = new THREE.Vector3(edge.source.x, edge.source.y, edge.source.z)
    const end = new THREE.Vector3(edge.target.x, edge.target.y, edge.target.z)
    const middle = start.clone().lerp(end, 0.5)
    const direction = end.clone().sub(start)
    const normal = direction.clone().cross(new THREE.Vector3(0.2, 1, 0.35)).normalize()
    middle.add(normal.multiplyScalar(Math.min(8, direction.length() * 0.12)))
    return new THREE.QuadraticBezierCurve3(start, middle, end)
  }, [edge])
  const tube = useMemo(
    () => new THREE.TubeGeometry(curve, 32, 0.08 + Math.min(0.12, edge.weight * 0.012), 5, false),
    [curve, edge.weight],
  )
  const lineMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.72,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }), [color])
  const particleGeometry = useMemo(() => new THREE.SphereGeometry(0.34, 12, 12), [])
  const particleMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    color: color.clone().lerp(new THREE.Color(LABEL_COLOR), 0.62),
  }), [color])
  useEffect(() => () => {
    tube.dispose()
    lineMaterial.dispose()
    particleGeometry.dispose()
    particleMaterial.dispose()
  }, [lineMaterial, particleGeometry, particleMaterial, tube])
  useFrame(({ clock }) => {
    const mesh = particle.current
    if (mesh === null) return
    mesh.position.copy(curve.getPoint((clock.elapsedTime * 0.16 + offset) % 1))
  })
  return <group>
    <mesh geometry={tube} material={lineMaterial} />
    <mesh ref={particle} geometry={particleGeometry} material={particleMaterial} />
  </group>
}

function HighlightedEdges({ layout, selectedId }: {
  readonly layout: KnowledgeGraphLayout
  readonly selectedId: string | undefined
}) {
  const edges = selectedId === undefined
    ? []
    : layout.edges
      .filter(edge => edge.source.id === selectedId || edge.target.id === selectedId)
      .slice(0, 16)
  return <>{edges.map((edge, index) => <FlowingEdge
    key={edge.id}
    edge={edge}
    color={colorForCommunity(edge.source.communityId, layout.communities)}
    offset={index / Math.max(1, edges.length)}
  />)}</>
}

function CommunityHalos({ layout, isolatedCommunityId }: {
  readonly layout: KnowledgeGraphLayout
  readonly isolatedCommunityId: string | undefined
}) {
  return <>{layout.communities.filter(community => community.radius > 0).map((community) => {
    const active = isolatedCommunityId === undefined || community.id === isolatedCommunityId
    return <mesh key={community.id} position={community.center}>
      <sphereGeometry args={[community.radius, 28, 18]} />
      <meshBasicMaterial
        color={colorForCommunity(community.id, layout.communities)}
        transparent
        opacity={active ? 0.1 : 0.025}
        wireframe
        depthWrite={false}
      />
    </mesh>
  })}</>
}

function labelTexture(text: string, selected: boolean): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 768
  canvas.height = 128
  const context = canvas.getContext('2d')
  if (context !== null) {
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.font = `${selected ? '700' : '600'} ${selected ? '36' : '30'}px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif`
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.lineWidth = 8
    context.strokeStyle = new THREE.Color(BACKGROUND_COLOR).getStyle()
    context.strokeText(text.length > 24 ? `${text.slice(0, 24)}…` : text, canvas.width / 2, canvas.height / 2)
    context.fillStyle = new THREE.Color(selected ? LABEL_COLOR : MUTED_LABEL_COLOR).getStyle()
    context.fillText(text.length > 24 ? `${text.slice(0, 24)}…` : text, canvas.width / 2, canvas.height / 2)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearFilter
  return texture
}

function NodeLabel({ node, selected }: { readonly node: KnowledgeGraphLayoutNode; readonly selected: boolean }) {
  const texture = useMemo(() => labelTexture(node.label, selected), [node.label, selected])
  const material = useMemo(() => new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    opacity: selected ? 1 : 0.76,
  }), [selected, texture])
  useEffect(() => () => { material.dispose(); texture.dispose() }, [material, texture])
  return <sprite
    position={[node.x, node.y + node.size + 2.2, node.z]}
    scale={[selected ? 19 : 15, selected ? 3.2 : 2.5, 1]}
    material={material}
  />
}

function GraphLabels({ layout, selectedId, isolatedCommunityId }: {
  readonly layout: KnowledgeGraphLayout
  readonly selectedId: string | undefined
  readonly isolatedCommunityId: string | undefined
}) {
  const labels = useMemo(() => {
    const visible = layout.nodes.filter(node => isolatedCommunityId === undefined || node.communityId === isolatedCommunityId)
    const leading = [...visible].sort((left, right) => right.degree - left.degree).slice(0, 7)
    const selected = selectedId === undefined ? undefined : layout.nodes.find(node => node.id === selectedId)
    return selected === undefined || leading.some(node => node.id === selected.id) ? leading : [selected, ...leading.slice(0, 6)]
  }, [isolatedCommunityId, layout.nodes, selectedId])
  return <>{labels.map(node => <NodeLabel key={node.id} node={node} selected={node.id === selectedId} />)}</>
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

function GalaxyDust() {
  const points = useRef<THREE.Points>(null)
  const geometry = useMemo(() => {
    const random = mulberry32(40_407)
    const positions = new Float32Array(1_800 * 3)
    const colors = new Float32Array(1_800 * 3)
    for (let index = 0; index < 1_800; index += 1) {
      const radius = 96 + random() * 170
      const theta = random() * Math.PI * 2
      const phi = Math.acos(2 * random() - 1)
      positions[index * 3] = radius * Math.sin(phi) * Math.cos(theta)
      positions[index * 3 + 1] = radius * Math.cos(phi)
      positions[index * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta)
      const color = new THREE.Color(COMMUNITY_COLORS[index % COMMUNITY_COLORS.length]).multiplyScalar(0.55 + random() * 0.4)
      colors[index * 3] = color.r
      colors[index * 3 + 1] = color.g
      colors[index * 3 + 2] = color.b
    }
    const value = new THREE.BufferGeometry()
    value.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    value.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return value
  }, [])
  const material = useMemo(() => new THREE.PointsMaterial({
    size: 0.36,
    vertexColors: true,
    transparent: true,
    opacity: 0.44,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }), [])
  useEffect(() => () => { geometry.dispose(); material.dispose() }, [geometry, material])
  useFrame(({ clock }) => { if (points.current !== null) points.current.rotation.y = clock.elapsedTime * 0.008 })
  return <points ref={points} geometry={geometry} material={material} />
}

function SceneAtmosphere() {
  const { gl, scene } = useThree()
  useEffect(() => {
    const previousBackground = scene.background
    const previousFog = scene.fog
    scene.background = new THREE.Color(BACKGROUND_COLOR)
    scene.fog = new THREE.FogExp2(BACKGROUND_COLOR, 0.005)
    gl.toneMapping = THREE.ACESFilmicToneMapping
    gl.toneMappingExposure = 1.18
    gl.outputColorSpace = THREE.SRGBColorSpace
    return () => { scene.background = previousBackground; scene.fog = previousFog }
  }, [gl, scene])
  return null
}

function CameraRig({ layout, selectedId, resetVersion, onInteraction }: {
  readonly layout: KnowledgeGraphLayout
  readonly selectedId: string | undefined
  readonly resetVersion: number
  readonly onInteraction: () => void
}) {
  const { camera, gl } = useThree()
  const controls = useMemo(() => new OrbitControls(camera, gl.domElement), [camera, gl.domElement])
  const interacted = useRef(false)
  const flight = useRef(1)
  const previousTarget = useRef<string>()
  const previousReset = useRef(resetVersion)
  const target = useMemo(() => layout.nodes.find(node => node.id === selectedId), [layout.nodes, selectedId])
  useEffect(() => {
    controls.enableDamping = true
    controls.dampingFactor = 0.055
    controls.minDistance = 8
    controls.maxDistance = Math.max(300, layout.radius * 4)
    const handleStart = () => { interacted.current = true; onInteraction() }
    controls.addEventListener('start', handleStart)
    return () => { controls.removeEventListener('start', handleStart); controls.dispose() }
  }, [controls, layout.radius, onInteraction])
  useEffect(() => {
    if (previousTarget.current === selectedId) return
    previousTarget.current = selectedId
    flight.current = 1
  }, [selectedId])
  useFrame(({ clock }, delta) => {
    if (previousReset.current !== resetVersion) {
      previousReset.current = resetVersion
      interacted.current = false
      flight.current = 1
    }
    const focus = target === undefined ? new THREE.Vector3(...layout.center) : new THREE.Vector3(target.x, target.y, target.z)
    const distance = target === undefined ? Math.max(76, layout.radius * 1.72) : Math.max(20, target.size * 7.2)
    if (flight.current > 0.002) {
      const desired = focus.clone().add(new THREE.Vector3(0.78, 0.42, 1).normalize().multiplyScalar(distance))
      const alpha = 1 - Math.exp(-delta * 3.8)
      camera.position.lerp(desired, alpha)
      controls.target.lerp(focus, alpha)
      flight.current *= 1 - alpha
    } else if (!interacted.current && target === undefined) {
      const angle = clock.elapsedTime * 0.035
      camera.position.set(Math.cos(angle) * distance, distance * 0.34, Math.sin(angle) * distance)
      controls.target.set(...layout.center)
    }
    controls.update()
  })
  return null
}

function PostEffects() {
  const { gl, scene, camera, size } = useThree()
  const composer = useMemo(() => {
    const value = new EffectComposer(gl)
    value.addPass(new RenderPass(scene, camera))
    value.addPass(new UnrealBloomPass(new THREE.Vector2(size.width, size.height), 1.28, 0.62, 0.12))
    value.addPass(new OutputPass())
    return value
  }, [camera, gl, scene, size.height, size.width])
  useEffect(() => { composer.setSize(size.width, size.height); return () => { composer.dispose() } }, [composer, size.height, size.width])
  useFrame(() => { composer.render() }, 1)
  return null
}

function GraphScene({ layout, selectedId, isolatedCommunityId, edgeMode, resetVersion, onSelect, onHover }: {
  readonly layout: KnowledgeGraphLayout
  readonly selectedId: string | undefined
  readonly isolatedCommunityId: string | undefined
  readonly edgeMode: EdgeMode
  readonly resetVersion: number
  readonly onSelect: (id: string) => void
  readonly onHover: (id?: string) => void
}) {
  const handleInteraction = useMemo(() => () => {}, [])
  return <>
    <SceneAtmosphere />
    <ambientLight intensity={0.34} />
    <pointLight position={[42, 58, 70]} intensity={1.4} color={communityColorValue(0)} />
    <pointLight position={[-58, -22, -46]} intensity={0.8} color={communityColorValue(2)} />
    <GalaxyDust />
    <CommunityHalos layout={layout} isolatedCommunityId={isolatedCommunityId} />
    <GraphEdges layout={layout} mode={edgeMode} selectedId={selectedId} isolatedCommunityId={isolatedCommunityId} />
    <HighlightedEdges layout={layout} selectedId={selectedId} />
    <GraphNodeInstances
      layout={layout}
      selectedId={selectedId}
      isolatedCommunityId={isolatedCommunityId}
      onSelect={onSelect}
      onHover={onHover}
    />
    <GraphLabels layout={layout} selectedId={selectedId} isolatedCommunityId={isolatedCommunityId} />
    <CameraRig layout={layout} selectedId={selectedId} resetVersion={resetVersion} onInteraction={handleInteraction} />
    <PostEffects />
  </>
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
  return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
}

function formatConfidence(value: number | undefined): string {
  return value === undefined ? '未登记' : `${String(Math.round(value * 100))}%`
}

function formatTime(value: string | undefined): string {
  return value === undefined ? '未登记' : new Date(value).toLocaleDateString('zh-CN')
}

export function KnowledgeGraphExplorer({ snapshot }: { readonly snapshot: V2KnowledgeGraphSnapshot }) {
  const layout = useMemo(() => layoutKnowledgeGraph(snapshot), [snapshot])
  const [selectedId, setSelectedId] = useState<string>()
  const [hoveredId, setHoveredId] = useState<string>()
  const [query, setQuery] = useState('')
  const [edgeMode, setEdgeMode] = useState<EdgeMode>('primary')
  const [isolatedCommunityId, setIsolatedCommunityId] = useState<string>()
  const [resetVersion, setResetVersion] = useState(0)
  const selected = selectedId === undefined ? undefined : layout.nodes.find(node => node.id === selectedId)
  const active = hoveredId === undefined ? selected : layout.nodes.find(node => node.id === hoveredId) ?? selected
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
  const legend = layout.communities.slice(0, 8)

  const selectNode = (id: string): void => {
    setSelectedId(id)
    setHoveredId(undefined)
    setQuery('')
  }
  const reset = (): void => {
    setSelectedId(undefined)
    setHoveredId(undefined)
    setIsolatedCommunityId(undefined)
    setQuery('')
    setResetVersion(value => value + 1)
  }

  return <section
    className={css.root}
    aria-label={`项目知识图谱：${String(snapshot.nodes.length)} 个节点，${String(snapshot.edges.length)} 条关系`}
  >
    <div className={css.canvas}>
      <div className={css.toolbar}>
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
            data-active={edgeMode === 'primary'}
            onClick={() => { setEdgeMode('primary') }}
          >主干关系</button>
          <button
            type="button"
            data-active={edgeMode === 'all'}
            onClick={() => { setEdgeMode('all') }}
          >全部关系</button>
        </div>
        <button className={css.resetButton} type="button" onClick={reset} aria-label="重置知识图谱视角">
          <ResetIcon />
        </button>
      </div>

      {supportsWebGl()
        ? <Canvas
          camera={{ position: [96, 48, 118], fov: 52, near: 0.1, far: 2_000 }}
          dpr={[1, 1.7]}
          gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
          onPointerMissed={() => { setSelectedId(undefined) }}
        >
          <GraphScene
            layout={layout}
            selectedId={selectedId}
            isolatedCommunityId={isolatedCommunityId}
            edgeMode={edgeMode}
            resetVersion={resetVersion}
            onSelect={selectNode}
            onHover={setHoveredId}
          />
        </Canvas>
        : <div className={css.webglFallback} role="img" aria-label="知识图谱三维视图不可用">
          <strong>当前环境无法启动三维图谱</strong>
          <p>图谱快照已经加载；请在支持 WebGL 的浏览器中查看三维节点、关系和镜头交互。</p>
        </div>}

      <div className={css.status}>
        {active === undefined
          ? `${String(snapshot.nodes.length)} 个实体 · ${String(snapshot.edges.length)} 条关系`
          : `${active.label} · ${active.type}`}
      </div>
      <div className={css.legend} aria-label="知识社区图例">
        {legend.map((community, index) => <button
          key={community.id}
          type="button"
          onClick={() => {
            setIsolatedCommunityId(current => current === community.id ? undefined : community.id)
          }}
          data-active={isolatedCommunityId === community.id}
          style={{
            '--legend-color': `#${communityColorValue(index).toString(16).padStart(6, '0')}`,
          } as CSSProperties}
        >
          <i />
          <span>{community.label}</span>
        </button>)}
      </div>

      {selected !== undefined && <aside className={css.inspector} aria-label={`实体详情：${selected.label}`}>
        <header>
          <div><small>{selected.type}</small><strong>{selected.label}</strong></div>
          <button
            className={css.closeInspector}
            type="button"
            onClick={() => { setSelectedId(undefined) }}
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
            const peer = edge.source.id === selected.id ? edge.target : edge.source
            return <li key={edge.id}>
              <span>{edge.label ?? edge.type} → {peer.label}</span>
              <code>{formatConfidence(edge.confidence)}</code>
            </li>
          })}</ul></section>
          <section className={css.inspectorSection}>
            <span>来源证据</span>
            <ul>{selected.sourceRefs.length === 0
              ? <li><span>未登记来源</span></li>
              : selected.sourceRefs.map(source => <li key={source}><code>{source}</code></li>)}</ul>
          </section>
        </div>
      </aside>}
    </div>
  </section>
}
