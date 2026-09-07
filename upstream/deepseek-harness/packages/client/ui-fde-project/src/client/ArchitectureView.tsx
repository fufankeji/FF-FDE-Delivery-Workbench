/** Project system architecture view and export actions. */

import { useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { ProjectArchitecture } from './controller.ts'
import type { ProjectViewProps } from './slots.ts'
import { ProjectViewHeader, ProjectViewState } from './view-state.tsx'
import css from './project.module.css'

interface NodePosition {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly groupId: string
  readonly groupIndex: number
}

interface ArchitectureGroupLayout {
  readonly id: string
  readonly label: string
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly index: number
  readonly nodeCount: number
}

interface ArchitectureEdgeLayout {
  readonly key: string
  readonly from: string
  readonly to: string
  readonly path: string
  readonly label?: string
  readonly labelX: number
  readonly labelY: number
  readonly dashed: boolean
  readonly tone: number
}

interface ArchitectureLayout {
  readonly width: number
  readonly height: number
  readonly groups: readonly ArchitectureGroupLayout[]
  readonly positions: Readonly<Record<string, NodePosition>>
  readonly edges: readonly ArchitectureEdgeLayout[]
}

const NODE_WIDTH = 226
const NODE_HEIGHT = 88

function clipText(text: string, length: number): string {
  return text.length > length ? `${text.slice(0, length - 1)}…` : text
}

function architectureLayout(architecture: ProjectArchitecture): ArchitectureLayout {
  const groupDefinitions = architecture.groups.map(group => ({ ...group }))
  const knownGroupIds = new Set(groupDefinitions.map(group => group.id))
  for (const node of architecture.nodes) {
    if (node.group !== undefined && !knownGroupIds.has(node.group)) {
      groupDefinitions.push({ id: node.group, label: node.group })
      knownGroupIds.add(node.group)
    }
  }
  if (architecture.nodes.some(node => node.group === undefined) && !knownGroupIds.has('__other')) {
    groupDefinitions.push({ id: '__other', label: '其他组件' })
    knownGroupIds.add('__other')
  }
  if (groupDefinitions.length === 0) {
    groupDefinitions.push({ id: '__other', label: '系统组成' })
    knownGroupIds.add('__other')
  }

  const resolvedGroupId = (groupId: string | undefined): string => {
    if (groupId !== undefined && knownGroupIds.has(groupId)) return groupId
    return '__other'
  }
  const groupIndexById = new Map(groupDefinitions.map((group, index) => [group.id, index]))
  const sourceIndexById = new Map(architecture.nodes.map((node, index) => [node.id, index]))
  const nodesByGroup = new Map(groupDefinitions.map(group => [
    group.id,
    architecture.nodes.filter(node => resolvedGroupId(node.group) === group.id),
  ]))
  const neighborsById = new Map(architecture.nodes.map(node => [node.id, [] as string[]]))
  for (const edge of architecture.edges) {
    neighborsById.get(edge.from)?.push(edge.to)
    neighborsById.get(edge.to)?.push(edge.from)
  }

  const reorderGroup = (targetGroupIndex: number, towardEarlierGroups: boolean): void => {
    const group = groupDefinitions[targetGroupIndex]
    if (group === undefined) return
    const nodes = nodesByGroup.get(group.id)
    if (nodes === undefined || nodes.length < 2) return
    const rankById = new Map<string, number>()
    for (const candidateGroup of groupDefinitions) {
      nodesByGroup.get(candidateGroup.id)?.forEach((node, index) => { rankById.set(node.id, index) })
    }
    const score = (nodeId: string): number | undefined => {
      const ranks = (neighborsById.get(nodeId) ?? []).flatMap((neighborId) => {
        const neighbor = architecture.nodes.find(node => node.id === neighborId)
        if (neighbor === undefined) return []
        const neighborGroupIndex = groupIndexById.get(resolvedGroupId(neighbor.group)) ?? 0
        if (towardEarlierGroups ? neighborGroupIndex >= targetGroupIndex : neighborGroupIndex <= targetGroupIndex) return []
        const rank = rankById.get(neighborId)
        return rank === undefined ? [] : [rank]
      })
      return ranks.length === 0 ? undefined : ranks.reduce((total, rank) => total + rank, 0) / ranks.length
    }
    nodes.sort((left, right) => {
      const leftScore = score(left.id)
      const rightScore = score(right.id)
      if (leftScore === undefined && rightScore === undefined) {
        return (sourceIndexById.get(left.id) ?? 0) - (sourceIndexById.get(right.id) ?? 0)
      }
      if (leftScore === undefined) return 1
      if (rightScore === undefined) return -1
      return leftScore - rightScore || (sourceIndexById.get(left.id) ?? 0) - (sourceIndexById.get(right.id) ?? 0)
    })
  }

  for (let pass = 0; pass < 3; pass += 1) {
    for (let index = 1; index < groupDefinitions.length; index += 1) reorderGroup(index, true)
    for (let index = groupDefinitions.length - 2; index >= 0; index -= 1) reorderGroup(index, false)
  }

  const groupWidth = 276
  const groupGap = 76
  const horizontalPadding = 72
  const groupY = 50
  const nodeTop = 126
  const nodeGap = 28
  const maxRows = Math.max(1, ...groupDefinitions.map(group => nodesByGroup.get(group.id)?.length ?? 0))
  const height = nodeTop + maxRows * NODE_HEIGHT + Math.max(0, maxRows - 1) * nodeGap + 72
  const contentWidth = horizontalPadding * 2 + groupDefinitions.length * groupWidth + Math.max(0, groupDefinitions.length - 1) * groupGap
  const width = Math.max(1080, contentWidth)
  const contentOffset = (width - contentWidth) / 2
  const positions: Record<string, NodePosition> = {}
  const groups = groupDefinitions.map((group, index): ArchitectureGroupLayout => {
    const x = contentOffset + horizontalPadding + index * (groupWidth + groupGap)
    const nodes = nodesByGroup.get(group.id) ?? []
    const startY = nodeTop
    nodes.forEach((node, nodeIndex) => {
      positions[node.id] = {
        x: x + (groupWidth - NODE_WIDTH) / 2,
        y: startY + nodeIndex * (NODE_HEIGHT + nodeGap),
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        groupId: group.id,
        groupIndex: index,
      }
    })
    return {
      id: group.id, label: group.label, x, y: groupY, width: groupWidth,
      height: height - groupY - 32, index, nodeCount: nodes.length,
    }
  })

  const connectionsByNode = new Map<string, number[]>()
  architecture.edges.forEach((edge, edgeIndex) => {
    if (positions[edge.from] === undefined || positions[edge.to] === undefined) return
    connectionsByNode.set(edge.from, [...(connectionsByNode.get(edge.from) ?? []), edgeIndex])
    connectionsByNode.set(edge.to, [...(connectionsByNode.get(edge.to) ?? []), edgeIndex])
  })
  const otherNodeId = (edgeIndex: number, nodeId: string): string => {
    const edge = architecture.edges[edgeIndex]
    if (edge === undefined) return ''
    return edge.from === nodeId ? edge.to : edge.from
  }
  const portOffset = (nodeId: string, edgeIndex: number): number => {
    const indices = [...(connectionsByNode.get(nodeId) ?? [])].sort((left, right) => {
      const leftBox = positions[otherNodeId(left, nodeId)]
      const rightBox = positions[otherNodeId(right, nodeId)]
      return (leftBox?.y ?? 0) - (rightBox?.y ?? 0)
    })
    const rank = indices.indexOf(edgeIndex)
    if (rank < 0 || indices.length < 2) return 0
    const spacing = Math.min(10, 40 / (indices.length - 1))
    return (rank - (indices.length - 1) / 2) * spacing
  }

  const edges = architecture.edges.flatMap((edge, edgeIndex): ArchitectureEdgeLayout[] => {
    const from = positions[edge.from]
    const to = positions[edge.to]
    if (from === undefined || to === undefined) return []
    const y1 = from.y + from.height / 2 + portOffset(edge.from, edgeIndex)
    const y2 = to.y + to.height / 2 + portOffset(edge.to, edgeIndex)
    const groupSpan = Math.abs(from.groupIndex - to.groupIndex)
    let path: string
    let labelX: number
    let labelY: number
    if (groupSpan === 0) {
      const side = edgeIndex % 2 === 0 ? 1 : -1
      const x1 = side > 0 ? from.x + from.width : from.x
      const x2 = side > 0 ? to.x + to.width : to.x
      const railX = side > 0
        ? Math.max(x1, x2) + 24 + (edgeIndex % 3) * 10
        : Math.min(x1, x2) - 24 - (edgeIndex % 3) * 10
      path = `M ${String(x1)} ${String(y1)} C ${String(railX)} ${String(y1)}, ${String(railX)} ${String(y2)}, ${String(x2)} ${String(y2)}`
      labelX = railX
      labelY = (y1 + y2) / 2 - 8
    } else {
      const direction = to.groupIndex > from.groupIndex ? 1 : -1
      const x1 = direction > 0 ? from.x + from.width : from.x
      const x2 = direction > 0 ? to.x : to.x + to.width
      if (groupSpan === 1) {
        const bend = Math.max(58, Math.abs(x2 - x1) * 0.44)
        path = `M ${String(x1)} ${String(y1)} C ${String(x1 + direction * bend)} ${String(y1)}, ${String(x2 - direction * bend)} ${String(y2)}, ${String(x2)} ${String(y2)}`
        labelX = (x1 + x2) / 2
        labelY = (y1 + y2) / 2 - 9
      } else {
        const useTopCorridor = edgeIndex % 2 === 0
        const corridorY = useTopCorridor ? 24 + (edgeIndex % 3) * 10 : height - 20 - (edgeIndex % 3) * 10
        const exitX = x1 + direction * 68
        const entryX = x2 - direction * 68
        path = `M ${String(x1)} ${String(y1)} C ${String(x1 + direction * 34)} ${String(y1)}, ${String(exitX)} ${String(corridorY)}, ${String(exitX)} ${String(corridorY)} L ${String(entryX)} ${String(corridorY)} C ${String(entryX)} ${String(corridorY)}, ${String(x2 - direction * 34)} ${String(y2)}, ${String(x2)} ${String(y2)}`
        labelX = (exitX + entryX) / 2
        labelY = useTopCorridor ? corridorY + 15 : corridorY - 9
      }
    }
    return [{
      key: `${edge.from}-${edge.to}-${String(edgeIndex)}`,
      from: edge.from,
      to: edge.to,
      path,
      ...(edge.label === undefined ? {} : { label: edge.label }),
      labelX,
      labelY,
      dashed: edge.dashed === true,
      tone: edgeIndex % 5,
    }]
  })
  return { width, height, groups, positions, edges }
}

function nodeColor(kind: ProjectArchitecture['nodes'][number]['kind']): { readonly accent: string; readonly fill: string } {
  switch (kind) {
    case 'entry': return { accent: '#38bdf8', fill: '#0d2942' }
    case 'core': return { accent: '#a78bfa', fill: '#211a42' }
    case 'store': return { accent: '#34d399', fill: '#0d302d' }
    case 'external': return { accent: '#fbbf24', fill: '#382715' }
    case 'output': return { accent: '#fb7185', fill: '#3a1829' }
    case 'default': return { accent: '#94a3b8', fill: '#17243a' }
  }
}

function nodeKindLabel(kind: ProjectArchitecture['nodes'][number]['kind']): string {
  switch (kind) {
    case 'entry': return '入口'
    case 'core': return '核心能力'
    case 'store': return '数据存储'
    case 'external': return '外部边界'
    case 'output': return '交付输出'
    case 'default': return '系统组件'
  }
}

function nodeGlyph(kind: ProjectArchitecture['nodes'][number]['kind']): string {
  switch (kind) {
    case 'entry': return '↗'
    case 'core': return '◆'
    case 'store': return '▣'
    case 'external': return '◎'
    case 'output': return '→'
    case 'default': return '◇'
  }
}

function architectureSvgMarkup(architecture: ProjectArchitecture): string {
  const layout = architectureLayout(architecture)
  const escape = (text: string): string => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
  const groupColors = ['#1d4ed8', '#7c3aed', '#0891b2', '#059669', '#db2777']
  const edgeColors = ['#38bdf8', '#818cf8', '#a78bfa', '#2dd4bf', '#fb7185']
  const groups = layout.groups.map((group) => {
    const color = groupColors[group.index % groupColors.length] ?? '#38bdf8'
    return `<g><rect x="${group.x}" y="${group.y}" width="${group.width}" height="${group.height}" rx="22" fill="#0b1830" fill-opacity=".76" stroke="${color}" stroke-opacity=".35"/><path d="M ${group.x + 18} ${group.y + 48} H ${group.x + group.width - 18}" stroke="${color}" stroke-opacity=".45"/><text x="${group.x + 20}" y="${group.y + 31}" fill="#e2e8f0" font-size="13" font-weight="700">${escape(group.label)}</text><text x="${group.x + group.width - 20}" y="${group.y + 31}" text-anchor="end" fill="#94a3b8" font-size="10">${group.nodeCount} NODES</text></g>`
  }).join('')
  const edges = layout.edges.map((edge) => {
    const color = edgeColors[edge.tone] ?? '#38bdf8'
    const label = edge.label === undefined ? '' : `<text x="${edge.labelX}" y="${edge.labelY}" text-anchor="middle" fill="#94a3b8" font-size="9">${escape(clipText(edge.label, 20))}</text>`
    return `<g><path d="${edge.path}" fill="none" stroke="${color}" stroke-opacity=".46" stroke-width="1.5"${edge.dashed ? ' stroke-dasharray="6 6"' : ''} marker-end="url(#arrow)"/>${label}</g>`
  }).join('')
  const nodes = architecture.nodes.map((node) => {
    const box = layout.positions[node.id]
    if (box === undefined) return ''
    const color = nodeColor(node.kind)
    const note = node.note === undefined ? '' : `<text x="${box.x + 18}" y="${box.y + 69}" fill="#94a3b8" font-size="10">${escape(clipText(node.note, 30))}</text>`
    return `<g><rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" rx="15" fill="${color.fill}" stroke="${color.accent}" stroke-opacity=".68"/><rect x="${box.x}" y="${box.y + 16}" width="3" height="${box.height - 32}" rx="2" fill="${color.accent}"/><circle cx="${box.x + 29}" cy="${box.y + 29}" r="12" fill="${color.accent}" fill-opacity=".16" stroke="${color.accent}" stroke-opacity=".7"/><text x="${box.x + 29}" y="${box.y + 33}" text-anchor="middle" fill="${color.accent}" font-size="11">${nodeGlyph(node.kind)}</text><text x="${box.x + 50}" y="${box.y + 25}" fill="${color.accent}" font-size="8" font-weight="700">${escape(nodeKindLabel(node.kind).toUpperCase())}</text><text x="${box.x + 50}" y="${box.y + 47}" fill="#f8fafc" font-size="13" font-weight="650">${escape(clipText(node.label, 20))}</text>${note}</g>`
  }).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}"><title>${escape(architecture.title)}</title><defs><radialGradient id="bg" cx="50%" cy="0%" r="100%"><stop offset="0" stop-color="#102b55"/><stop offset=".55" stop-color="#08172d"/><stop offset="1" stop-color="#050d1c"/></radialGradient><pattern id="grid" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M 28 0 L 0 0 0 28" fill="none" stroke="#5ea4ff" stroke-opacity=".07"/></pattern><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#7dd3fc"/></marker></defs><rect width="100%" height="100%" fill="url(#bg)"/><rect width="100%" height="100%" fill="url(#grid)"/>${groups}${edges}${nodes}</svg>`
}

function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  URL.revokeObjectURL(url)
}

async function downloadArchitecture(architecture: ProjectArchitecture, format: 'svg' | 'png'): Promise<void> {
  const markup = architectureSvgMarkup(architecture)
  if (format === 'svg') {
    downloadBlob(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }), 'system-architecture.svg')
    return
  }
  const layout = architectureLayout(architecture)
  const image = new Image()
  const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }))
  await new Promise<void>((resolve, reject) => {
    image.onload = () => { resolve() }
    image.onerror = () => { reject(new Error('架构图导出失败。')) }
    image.src = url
  })
  const canvas = document.createElement('canvas')
  canvas.width = layout.width * 2
  canvas.height = layout.height * 2
  const context = canvas.getContext('2d')
  if (context === null) throw new Error('当前浏览器不能导出 PNG。')
  context.scale(2, 2)
  context.drawImage(image, 0, 0)
  URL.revokeObjectURL(url)
  await new Promise<void>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob === null) { reject(new Error('架构图导出失败。')); return }
      downloadBlob(blob, 'system-architecture.png')
      resolve()
    }, 'image/png')
  })
}

interface ArchitectureCanvasProps {
  readonly architecture: ProjectArchitecture
  readonly focusNodeId: string | null
  readonly zoom: number
  readonly onHoverNode: (nodeId: string | null) => void
  readonly onSelectNode: (nodeId: string | null) => void
}

function ArchitectureCanvas({ architecture, focusNodeId, zoom, onHoverNode, onSelectNode }: ArchitectureCanvasProps) {
  const layout = useMemo(() => architectureLayout(architecture), [architecture])
  const relatedNodeIds = useMemo(() => {
    if (focusNodeId === null) return new Set<string>()
    const related = new Set([focusNodeId])
    for (const edge of architecture.edges) {
      if (edge.from === focusNodeId) related.add(edge.to)
      if (edge.to === focusNodeId) related.add(edge.from)
    }
    return related
  }, [architecture.edges, focusNodeId])
  return (
    <svg
      className={css.architectureCanvas}
      style={{ '--architecture-zoom': `${String(zoom)}%` } as CSSProperties}
      viewBox={`0 0 ${String(layout.width)} ${String(layout.height)}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={architecture.title}
    >
      <defs>
        <radialGradient id="fde-architecture-background" cx="50%" cy="0%" r="100%">
          <stop offset="0" className={css.architectureBackgroundStart} />
          <stop offset="0.56" className={css.architectureBackgroundMiddle} />
          <stop offset="1" className={css.architectureBackgroundEnd} />
        </radialGradient>
        <pattern id="fde-architecture-grid" width="28" height="28" patternUnits="userSpaceOnUse">
          <path className={css.architectureGridLine} d="M 28 0 L 0 0 0 28" />
        </pattern>
        <filter id="fde-architecture-glow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="7" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <marker id="fde-architecture-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" className={css.edgeArrow} />
        </marker>
      </defs>
      <rect className={css.architectureBackdrop} width={layout.width} height={layout.height} />
      <rect className={css.architectureGrid} width={layout.width} height={layout.height} />
      <circle className={css.architectureAura} data-tone="blue" cx={layout.width * 0.18} cy={layout.height * 0.12} r={layout.width * 0.15} />
      <circle className={css.architectureAura} data-tone="violet" cx={layout.width * 0.58} cy={layout.height * 0.82} r={layout.width * 0.18} />
      <circle className={css.architectureAura} data-tone="mint" cx={layout.width * 0.9} cy={layout.height * 0.3} r={layout.width * 0.13} />
      {layout.groups.map(group => (
        <g key={group.id} className={css.architectureGroup} data-tone={group.index % 5}>
          <rect className={css.groupSurface} x={group.x} y={group.y} width={group.width} height={group.height} rx={22} />
          <path className={css.groupRail} d={`M ${String(group.x + 18)} ${String(group.y + 49)} H ${String(group.x + group.width - 18)}`} />
          <text className={css.groupIndex} x={group.x + 20} y={group.y + 30}>{String(group.index + 1).padStart(2, '0')}</text>
          <text className={css.groupLabel} x={group.x + 49} y={group.y + 30}>{clipText(group.label, 16)}</text>
          <text className={css.groupCount} x={group.x + group.width - 20} y={group.y + 30} textAnchor="end">{group.nodeCount} NODES</text>
        </g>
      ))}
      {layout.edges.map((edge) => {
        const highlighted = focusNodeId !== null && (edge.from === focusNodeId || edge.to === focusNodeId)
        const muted = focusNodeId !== null && !highlighted
        const labelWidth = Math.min(152, Math.max(52, clipText(edge.label ?? '', 20).length * 10 + 18))
        return (
          <g
            key={edge.key}
            className={css.architectureEdgeItem}
            data-highlight={highlighted || undefined}
            data-muted={muted || undefined}
            data-tone={edge.tone}
          >
            <title>{edge.label ?? `${edge.from} → ${edge.to}`}</title>
            <path className={css.architectureEdgeHalo} d={edge.path} />
            <path className={css.architectureEdge} data-dashed={edge.dashed || undefined} d={edge.path} markerEnd="url(#fde-architecture-arrow)" />
            <path className={css.architectureEdgeFlow} d={edge.path} />
            <path className={css.architectureEdgeHit} d={edge.path} />
            {edge.label !== undefined && (
              <g className={css.edgeLabelGroup}>
                <rect
                  className={css.edgeLabelBackdrop}
                  x={edge.labelX - labelWidth / 2}
                  y={edge.labelY - 12}
                  width={labelWidth}
                  height={18}
                  rx={9}
                />
                <text className={css.edgeLabel} x={edge.labelX} y={edge.labelY} textAnchor="middle">{clipText(edge.label, 20)}</text>
              </g>
            )}
          </g>
        )
      })}
      {architecture.nodes.map((node) => {
        const box = layout.positions[node.id]
        if (box === undefined) return null
        const active = focusNodeId === node.id
        const related = focusNodeId !== null && relatedNodeIds.has(node.id)
        const muted = focusNodeId !== null && !related
        return (
          <g
            key={node.id}
            className={css.architectureNode}
            data-architecture-node
            data-kind={node.kind}
            data-active={active || undefined}
            data-related={related || undefined}
            data-muted={muted || undefined}
            role="button"
            tabIndex={0}
            aria-label={`查看 ${node.label}`}
            onMouseEnter={() => { onHoverNode(node.id) }}
            onMouseLeave={() => { onHoverNode(null) }}
            onFocus={() => { onHoverNode(node.id) }}
            onBlur={() => { onHoverNode(null) }}
            onClick={() => { onSelectNode(node.id) }}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return
              event.preventDefault()
              onSelectNode(node.id)
            }}
          >
            <title>{node.note ?? node.label}</title>
            <rect className={css.nodeFocusRing} x={box.x - 4} y={box.y - 4} width={box.width + 8} height={box.height + 8} rx={19} />
            <rect className={css.nodeSurface} x={box.x} y={box.y} width={box.width} height={box.height} rx={15} />
            <rect className={css.nodeAccent} x={box.x} y={box.y + 16} width={3} height={box.height - 32} rx={2} />
            <circle className={css.nodeIcon} cx={box.x + 29} cy={box.y + 29} r={12} />
            <text className={css.nodeGlyph} x={box.x + 29} y={box.y + 33} textAnchor="middle">{nodeGlyph(node.kind)}</text>
            <text className={css.nodeKind} x={box.x + 50} y={box.y + 25}>{nodeKindLabel(node.kind)}</text>
            <text className={css.nodeLabel} x={box.x + 50} y={box.y + 47}>{clipText(node.label, 20)}</text>
            {node.note !== undefined && <text className={css.nodeNote} x={box.x + 18} y={box.y + 69}>{clipText(node.note, 30)}</text>}
            <circle className={css.nodePort} cx={box.x} cy={box.y + box.height / 2} r={3} />
            <circle className={css.nodePort} cx={box.x + box.width} cy={box.y + box.height / 2} r={3} />
          </g>
        )
      })}
    </svg>
  )
}

/** Render the project-owned architecture artifact as an interactive signal graph. */
export function ArchitectureView(props: ProjectViewProps) {
  const [exportError, setExportError] = useState('')
  const [actionNotice, setActionNotice] = useState('')
  const [actionPending, setActionPending] = useState(false)
  const [zoom, setZoom] = useState(100)
  const [motionPaused, setMotionPaused] = useState(false)
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const actionRef = useRef(false)
  const viewportRef = useRef<HTMLDivElement>(null)
  return (
    <ProjectViewState props={props}>{(snapshot, workspace) => {
      const architecture = snapshot.architecture
      const focusNodeId = hoveredNodeId ?? selectedNodeId
      const focusedNode = architecture?.nodes.find(node => node.id === focusNodeId)
      const incomingCount = architecture?.edges.filter(edge => edge.to === focusNodeId).length ?? 0
      const outgoingCount = architecture?.edges.filter(edge => edge.from === focusNodeId).length ?? 0
      const requestDraft = (): void => {
        if (actionPending) return
        setActionPending(true)
        setActionNotice('')
        void props.requestArchitectureDraft(architecture?.revision ?? 0).then(
          () => { setActionNotice('已把架构任务提交到当前会话。Agent 完成后点击“刷新”。') },
          (error: unknown) => { setActionNotice(error instanceof Error ? error.message : String(error)) },
        ).finally(() => { setActionPending(false) })
      }
      const confirm = (): void => {
        if (architecture === null || actionPending) return
        setActionPending(true)
        setActionNotice('')
        void props.confirmProjectArchitecture(workspace.workspaceId, architecture.revision).then(
          () => { setActionNotice(`已确认系统架构 R${String(architecture.revision)}。`) },
          (error: unknown) => { setActionNotice(error instanceof Error ? error.message : String(error)) },
        ).finally(() => { setActionPending(false) })
      }
      const exportAs = (format: 'svg' | 'png'): void => {
        if (architecture === null || actionRef.current) return
        actionRef.current = true
        setExportError('')
        void downloadArchitecture(architecture, format).catch((error: unknown) => {
          setExportError(error instanceof Error ? error.message : String(error))
        }).finally(() => { actionRef.current = false })
      }
      return (
        <section className={`${css.surfaceRoot} ${css.architectureSurface}`} data-conversation-composer-overlay>
          <ProjectViewHeader
            eyebrow={workspace.title}
            title="系统架构"
            description="展示方案阶段确认的系统组成、依赖关系和外部边界。架构文件属于项目，可随代码一起维护。"
            onRefresh={() => { props.refreshProjectSurface(workspace.workspaceId) }}
            refreshLabel={props.t('surface.refresh')}
            actions={<>
              <button type="button" className={css.secondaryButton} disabled={actionPending} onClick={requestDraft}>{architecture === null ? '让 Agent 生成架构' : '让 Agent 修改架构'}</button>
              {architecture !== null && architecture.status !== 'confirmed' && <button type="button" className={css.primaryButton} disabled={actionPending} onClick={confirm}>确认当前架构</button>}
              {architecture !== null && <><button type="button" className={css.secondaryButton} onClick={() => { exportAs('svg') }}>导出 SVG</button><button type="button" className={css.secondaryButton} onClick={() => { exportAs('png') }}>导出 PNG</button></>}
            </>}
          />
          {actionNotice !== '' && <p className={css.actionNotice} role="status">{actionNotice}</p>}
          {snapshot.architectureError !== undefined && <div className={css.artifactError} role="alert"><strong>架构文件无效</strong><p>{snapshot.architectureError}</p></div>}
          {architecture === null && snapshot.architectureError === undefined && (
            <div className={css.emptyArtifact}>
              <span className={css.emptyArtifactIcon}>⌘</span>
              <h2>尚未形成系统架构</h2>
              <p>在方案设计阶段，将确认后的架构写入 <code>.fde/architecture.json</code>。页面只展示真实项目文件。</p>
              <button type="button" className={css.primaryButton} disabled={actionPending} onClick={requestDraft}>{actionPending ? '正在提交…' : '让 Agent 生成架构'}</button>
            </div>
          )}
          {architecture !== null && (
            <div className={css.architectureStage} data-paused={motionPaused || undefined}>
              <div className={css.architectureStageBar}>
                <div className={css.architectureGuide}>
                  <span className={css.architectureLiveDot} />
                  <span>悬停聚焦上下游，点击节点锁定关系</span>
                </div>
                <div className={css.architectureLegend} aria-label="架构节点类型">
                  {(['entry', 'core', 'store', 'external', 'output'] as const).map(kind => <span key={kind} data-kind={kind}><i />{nodeKindLabel(kind)}</span>)}
                </div>
                <div className={css.architectureControls}>
                  <button type="button" aria-label={motionPaused ? '播放连线动画' : '暂停连线动画'} aria-pressed={motionPaused} onClick={() => { setMotionPaused(value => !value) }}>{motionPaused ? '▶' : 'Ⅱ'}</button>
                  <div className={css.zoomControls} aria-label="架构图缩放">
                    <button type="button" aria-label="缩小" onClick={() => { setZoom(value => Math.max(70, value - 10)) }}>−</button>
                    <button type="button" aria-label="适应窗口" title="完整显示架构图；缩放比例相对于适应窗口" onClick={() => {
                      setZoom(100)
                      if (viewportRef.current !== null) {
                        viewportRef.current.scrollLeft = 0
                        viewportRef.current.scrollTop = 0
                      }
                    }}>{zoom === 100 ? '适应' : `${String(zoom)}%`}</button>
                    <button type="button" aria-label="放大" onClick={() => { setZoom(value => Math.min(180, value + 10)) }}>＋</button>
                  </div>
                </div>
              </div>
              {exportError !== '' && <p className={css.inlineError} role="alert">{exportError}</p>}
              <div className={css.architectureViewport} ref={viewportRef}>
                <ArchitectureCanvas
                  architecture={architecture}
                  focusNodeId={focusNodeId}
                  zoom={zoom}
                  onHoverNode={setHoveredNodeId}
                  onSelectNode={setSelectedNodeId}
                />
              </div>
              {focusedNode !== undefined && (
                <aside className={css.architectureInspector} data-kind={focusedNode.kind} aria-live="polite">
                  <div>
                    <span>{nodeKindLabel(focusedNode.kind)}</span>
                    <h3>{focusedNode.label}</h3>
                    {focusedNode.note !== undefined && <p>{focusedNode.note}</p>}
                  </div>
                  <dl>
                    <div><dt>输入关系</dt><dd>{incomingCount}</dd></div>
                    <div><dt>输出关系</dt><dd>{outgoingCount}</dd></div>
                  </dl>
                  {selectedNodeId === focusedNode.id && <button type="button" aria-label="取消节点锁定" onClick={() => { setSelectedNodeId(null) }}>×</button>}
                </aside>
              )}
            </div>
          )}
        </section>
      )
    }}</ProjectViewState>
  )
}
