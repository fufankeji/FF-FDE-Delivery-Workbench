/** Web-native Galaxy View adapted from the pinned Obsidian Galaxy View interaction contract. */

import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { filterRequirementGalaxy, layoutRequirementGalaxy } from './galaxy-layout.ts'
import type {
  RequirementWikiPage,
  RequirementWikiRelation,
  RequirementWikiTopic,
} from './wiki-controller.ts'
import css from './project.module.css'

const TOPIC_LABELS: Readonly<Record<RequirementWikiTopic, string>> = {
  'business-goal': '业务目标',
  role: '角色',
  process: '流程/SOP',
  'system-data': '系统与数据',
  rule: '业务规则',
  constraint: '约束',
  acceptance: '验收方向',
  risk: '风险',
  conflict: '冲突',
  unknown: '未知项',
}

const TOPIC_COLOR_PROPERTIES: Readonly<Record<RequirementWikiTopic, string>> = {
  'business-goal': '--dsw-alias-state-business-primary',
  role: '--dsw-alias-brand-primary',
  process: '--dsw-alias-state-success-primary',
  'system-data': '--dsw-alias-label-primary-bluish',
  rule: '--dsw-alias-state-warn-primary',
  constraint: '--dsw-alias-state-warn-secondary',
  acceptance: '--dsw-alias-state-success-secondary',
  risk: '--dsw-alias-state-error-secondary',
  conflict: '--dsw-alias-state-error-primary',
  unknown: '--dsw-alias-label-secondary',
}

interface RequirementGalaxyViewProps {
  readonly revision: number
  readonly pages: readonly RequirementWikiPage[]
  readonly relations: readonly RequirementWikiRelation[]
  readonly selectedPageId: string | undefined
  readonly onSelectPage: (pageId: string) => void
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = (): void => { setReduced(media.matches) }
    update()
    media.addEventListener('change', update)
    return () => { media.removeEventListener('change', update) }
  }, [])
  return reduced
}

function resolvedCssColor(host: HTMLElement, property: string): string {
  const probe = document.createElement('span')
  probe.style.color = `var(${property})`
  host.append(probe)
  const color = getComputedStyle(probe).color
  probe.remove()
  if (color === '') throw new Error(`Galaxy View 缺少主题颜色 ${property}。`)
  return color
}

function glowTexture(color: THREE.ColorRepresentation): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const context = canvas.getContext('2d')
  if (context === null) return new THREE.CanvasTexture(canvas)
  const value = new THREE.Color(color)
  const rgb = `${String(Math.round(value.r * 255))}, ${String(Math.round(value.g * 255))}, ${String(Math.round(value.b * 255))}`
  const gradient = context.createRadialGradient(64, 64, 2, 64, 64, 62)
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)')
  gradient.addColorStop(0.14, `rgba(${rgb}, 1)`)
  gradient.addColorStop(0.42, `rgba(${rgb}, 0.54)`)
  gradient.addColorStop(1, `rgba(${rgb}, 0)`)
  context.fillStyle = gradient
  context.fillRect(0, 0, 128, 128)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function starPositions(count: number): Float32Array {
  let seed = 0x5f37_59df
  const random = (): number => {
    seed = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    seed ^= seed + Math.imul(seed ^ (seed >>> 7), 61 | seed)
    return ((seed ^ (seed >>> 14)) >>> 0) / 4_294_967_296
  }
  const values = new Float32Array(count * 3)
  for (let index = 0; index < count; index += 1) {
    const radius = 32 + random() * 42
    const theta = random() * Math.PI * 2
    const phi = Math.acos(2 * random() - 1)
    values[index * 3] = radius * Math.sin(phi) * Math.cos(theta)
    values[index * 3 + 1] = radius * Math.cos(phi)
    values[index * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta)
  }
  return values
}

/** Render an actual bounded Three.js graph with an accessible same-data fallback. */
export function RequirementGalaxyView({
  revision, pages, relations, selectedPageId, onSelectPage,
}: RequirementGalaxyViewProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [topic, setTopic] = useState<RequirementWikiTopic | 'all'>('all')
  const [focusId, setFocusId] = useState<string | undefined>()
  const [hoveredId, setHoveredId] = useState<string | undefined>()
  const [fallback, setFallback] = useState<string | undefined>()
  const [narrow, setNarrow] = useState(false)
  const [retry, setRetry] = useState(0)
  const reducedMotion = useReducedMotion()
  const selectedRef = useRef(selectedPageId)
  const onSelectRef = useRef(onSelectPage)
  selectedRef.current = selectedPageId
  onSelectRef.current = onSelectPage

  const graph = useMemo(() => filterRequirementGalaxy(pages, relations, {
    query,
    topic,
    ...(focusId === undefined ? {} : { focusId }),
  }), [focusId, pages, query, relations, topic])
  const positions = useMemo(() => layoutRequirementGalaxy(graph.pages), [graph.pages])
  const pageById = useMemo(() => new Map(pages.map(page => [page.id, page])), [pages])
  const hovered = hoveredId === undefined ? undefined : pageById.get(hoveredId)

  useEffect(() => {
    const host = hostRef.current
    if (host === null) return
    const observer = new ResizeObserver((entries) => { setNarrow((entries[0]?.contentRect.width ?? 0) < 520) })
    observer.observe(host)
    return () => { observer.disconnect() }
  }, [])

  useEffect(() => {
    const host = hostRef.current
    if (host === null || narrow || fallback !== undefined || graph.pages.length === 0) return
    const probe = document.createElement('canvas')
    const context = probe.getContext('webgl2') ?? probe.getContext('webgl')
    if (context === null) {
      setFallback('当前浏览器无法初始化 WebGL，已切换为知识页与关系列表。')
      return
    }

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' })
    } catch (error) {
      setFallback(`Galaxy View 初始化失败：${error instanceof Error ? error.message : String(error)}`)
      return
    }
    const scene = new THREE.Scene()
    const sceneColor = resolvedCssColor(host, '--dsw-alias-bg-base')
    const topicColors = new Map<string, string>()
    for (const property of new Set(Object.values(TOPIC_COLOR_PROPERTIES))) {
      topicColors.set(property, resolvedCssColor(host, property))
    }
    const topicColor = (topicValue: RequirementWikiTopic): string => {
      const property = TOPIC_COLOR_PROPERTIES[topicValue]
      const color = topicColors.get(property)
      if (color === undefined) throw new Error(`Galaxy View 缺少主题颜色 ${property}。`)
      return color
    }
    scene.background = new THREE.Color(sceneColor)
    scene.fog = new THREE.FogExp2(sceneColor, 0.012)
    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 180)
    camera.position.set(0, 5, 38)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = !reducedMotion
    controls.dampingFactor = 0.075
    controls.minDistance = 6
    controls.maxDistance = 82
    controls.enablePan = true
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6))
    renderer.domElement.className = css.galaxyCanvas ?? ''
    renderer.domElement.setAttribute('aria-label', `需求知识 Galaxy View R${String(revision)}`)
    renderer.domElement.tabIndex = 0
    host.append(renderer.domElement)

    const pointById = new Map(positions.map(point => [point.id, point]))
    const textures = new Map<string, THREE.CanvasTexture>()
    const nodeBySprite = new Map<THREE.Object3D, string>()
    const sprites: THREE.Sprite[] = []
    for (const page of graph.pages) {
      const point = pointById.get(page.id)
      if (point === undefined) continue
      const color = topicColor(page.topic)
      let texture = textures.get(color)
      if (texture === undefined) {
        texture = glowTexture(color)
        textures.set(color, texture)
      }
      const material = new THREE.SpriteMaterial({
        map: texture,
        color,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
      const sprite = new THREE.Sprite(material)
      sprite.position.set(point.x, point.y, point.z)
      const selected = page.id === selectedRef.current
      sprite.scale.setScalar(selected ? 2.25 : 1.55)
      sprite.userData.pageId = page.id
      scene.add(sprite)
      nodeBySprite.set(sprite, page.id)
      sprites.push(sprite)
    }

    const linePositions: number[] = []
    const lineColors: number[] = []
    for (const relation of graph.relations) {
      const from = pointById.get(relation.from)
      const to = pointById.get(relation.to)
      const fromPage = pageById.get(relation.from)
      const toPage = pageById.get(relation.to)
      if (from === undefined || to === undefined || fromPage === undefined || toPage === undefined) continue
      linePositions.push(from.x, from.y, from.z, to.x, to.y, to.z)
      for (const color of [topicColor(fromPage.topic), topicColor(toPage.topic)]) {
        const value = new THREE.Color(color)
        lineColors.push(value.r, value.g, value.b)
      }
    }
    const linesGeometry = new THREE.BufferGeometry()
    linesGeometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3))
    linesGeometry.setAttribute('color', new THREE.Float32BufferAttribute(lineColors, 3))
    const linesMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.33,
      blending: THREE.AdditiveBlending,
    })
    const lines = new THREE.LineSegments(linesGeometry, linesMaterial)
    scene.add(lines)

    const starsGeometry = new THREE.BufferGeometry()
    starsGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions(520), 3))
    const starsMaterial = new THREE.PointsMaterial({ color: resolvedCssColor(host, '--dsw-alias-label-primary-bluish'), size: 0.13, transparent: true, opacity: 0.72, depthWrite: false })
    scene.add(new THREE.Points(starsGeometry, starsMaterial))

    if (focusId !== undefined) {
      const focus = pointById.get(focusId)
      if (focus !== undefined) {
        controls.target.set(focus.x, focus.y, focus.z)
        camera.position.set(focus.x + 2, focus.y + 3, focus.z + 16)
      }
    }

    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    const hit = (event: PointerEvent): string | undefined => {
      const bounds = renderer.domElement.getBoundingClientRect()
      pointer.x = (event.clientX - bounds.left) / bounds.width * 2 - 1
      pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1
      raycaster.setFromCamera(pointer, camera)
      const sprite = raycaster.intersectObjects([...nodeBySprite.keys()], false)[0]?.object
      return sprite instanceof THREE.Sprite ? nodeBySprite.get(sprite) : undefined
    }
    const onPointerMove = (event: PointerEvent): void => {
      const pageId = hit(event)
      renderer.domElement.style.cursor = pageId === undefined ? 'grab' : 'pointer'
      setHoveredId(pageId)
    }
    const onPointerLeave = (): void => { setHoveredId(undefined) }
    const onClick = (event: PointerEvent): void => {
      const pageId = hit(event)
      if (pageId !== undefined) onSelectRef.current(pageId)
    }
    const onContextLost = (event: Event): void => {
      event.preventDefault()
      setFallback('WebGL 上下文已丢失，已切换为知识页与关系列表。')
    }
    renderer.domElement.addEventListener('pointermove', onPointerMove)
    renderer.domElement.addEventListener('pointerleave', onPointerLeave)
    renderer.domElement.addEventListener('click', onClick)
    renderer.domElement.addEventListener('webglcontextlost', onContextLost)

    let frame = 0
    const resize = (): void => {
      const width = Math.max(1, host.clientWidth)
      const height = Math.max(320, host.clientHeight)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height, false)
      renderer.render(scene, camera)
    }
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(host)
    resize()
    const render = (): void => {
      controls.update()
      renderer.render(scene, camera)
      frame = requestAnimationFrame(render)
    }
    if (reducedMotion) controls.addEventListener('change', resize)
    else frame = requestAnimationFrame(render)

    return () => {
      if (frame !== 0) cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      controls.removeEventListener('change', resize)
      controls.dispose()
      renderer.domElement.removeEventListener('pointermove', onPointerMove)
      renderer.domElement.removeEventListener('pointerleave', onPointerLeave)
      renderer.domElement.removeEventListener('click', onClick)
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost)
      for (const sprite of sprites) sprite.material.dispose()
      for (const texture of textures.values()) texture.dispose()
      linesGeometry.dispose()
      linesMaterial.dispose()
      starsGeometry.dispose()
      starsMaterial.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [fallback, focusId, graph, narrow, pageById, positions, reducedMotion, retry, revision])

  const effectiveFallback = narrow
    ? '当前窗口较窄，已切换为知识页与关系列表。'
    : fallback

  return (
    <section className={css.galaxyRoot} aria-label="需求知识 Galaxy View">
      <div className={css.galaxyToolbar}>
        <label>
          <span>搜索知识</span>
          <input value={query} onChange={(event) => { setQuery(event.target.value) }} placeholder="标题、摘要或正文" />
        </label>
        <label>
          <span>主题</span>
          <select value={topic} onChange={(event) => { setTopic(event.target.value as RequirementWikiTopic | 'all') }}>
            <option value="all">全部主题</option>
            {Object.entries(TOPIC_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <button type="button" disabled={selectedPageId === undefined} data-active={focusId !== undefined || undefined} onClick={() => { setFocusId(current => current === selectedPageId ? undefined : selectedPageId) }}>
          {focusId === undefined ? '聚焦邻域' : '取消聚焦'}
        </button>
        <button type="button" onClick={() => { setQuery(''); setTopic('all'); setFocusId(undefined) }}>显示全部</button>
        <span className={css.galaxyCount}>{graph.pages.length} 星体 · {graph.relations.length} 关系</span>
      </div>
      <div ref={hostRef} className={css.galaxyViewport} data-testid="requirement-galaxy-view">
        {effectiveFallback !== undefined && (
          <div className={css.galaxyFallback} role="status">
            <strong>Galaxy View 已降级</strong>
            <p>{effectiveFallback}</p>
            {!narrow && <button type="button" onClick={() => { setFallback(undefined); setRetry(value => value + 1) }}>重新尝试三维视图</button>}
          </div>
        )}
        {effectiveFallback === undefined && hovered !== undefined && (
          <div className={css.galaxyTooltip}><strong>{hovered.title}</strong><span>{TOPIC_LABELS[hovered.topic]}</span></div>
        )}
      </div>
      <div className={css.galaxyAccessible}>
        <details open={effectiveFallback !== undefined || graph.pages.length === 0}>
          <summary>知识页与关系列表 · {graph.pages.length} 页 / {graph.relations.length} 关系</summary>
          {graph.pages.length === 0
            ? <p>当前筛选没有知识页。</p>
            : <ul>{graph.pages.map(page => (
              <li key={page.id}>
                <button type="button" data-active={page.id === selectedPageId || undefined} onClick={() => { onSelectPage(page.id) }}>
                  <span data-topic={page.topic} />
                  <strong>{page.title}</strong><small>{TOPIC_LABELS[page.topic]}</small>
                </button>
              </li>
            ))}</ul>}
          {graph.relations.length > 0 && (
            <section><h3>{graph.relations.length} 条知识关系</h3><ul>{graph.relations.map(relation => (
              <li key={relation.id}>{pageById.get(relation.from)?.title ?? relation.from} → {pageById.get(relation.to)?.title ?? relation.to}{relation.label === undefined ? '' : ` · ${relation.label}`}</li>
            ))}</ul></section>
          )}
        </details>
      </div>
    </section>
  )
}

export { TOPIC_LABELS as REQUIREMENT_WIKI_TOPIC_LABELS }
