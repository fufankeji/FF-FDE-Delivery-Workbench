/** Project system architecture view and export actions. */

import { useMemo, useRef, useState } from 'react'
import type { ProjectArchitecture } from './controller.ts'
import type { ProjectViewProps } from './slots.ts'
import { ProjectViewHeader, ProjectViewState } from './view-state.tsx'
import css from './project.module.css'

interface NodePosition { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
interface ArchitectureGroupLayout {
  readonly id: string
  readonly label: string
  readonly x: number
  readonly width: number
  readonly height: number
}

function architectureLayout(architecture: ProjectArchitecture): {
  readonly width: number
  readonly height: number
  readonly groups: readonly ArchitectureGroupLayout[]
  readonly positions: Readonly<Record<string, NodePosition>>
} {
  const declared = architecture.groups
  const hasUngrouped = architecture.nodes.some(node => node.group === undefined)
  const groups = [...declared, ...(hasUngrouped ? [{ id: '__other', label: '其他' }] : [])]
  const normalized = groups.length === 0 ? [{ id: '__other', label: '系统组成' }] : groups
  const groupWidth = 250
  const gap = 24
  const padding = 30
  const nodeWidth = 194
  const nodeHeight = 72
  const rowGap = 22
  const maxRows = Math.max(1, ...normalized.map(group =>
    architecture.nodes.filter(node => (node.group ?? '__other') === group.id).length))
  const height = 92 + maxRows * (nodeHeight + rowGap) + 30
  const positions: Record<string, NodePosition> = {}
  const layoutGroups = normalized.map((group, groupIndex) => {
    const x = padding + groupIndex * (groupWidth + gap)
    const nodes = architecture.nodes.filter(node => (node.group ?? '__other') === group.id)
    nodes.forEach((node, index) => {
      positions[node.id] = {
        x: x + (groupWidth - nodeWidth) / 2,
        y: 72 + index * (nodeHeight + rowGap),
        width: nodeWidth,
        height: nodeHeight,
      }
    })
    return { id: group.id, label: group.label, x, width: groupWidth, height: height - 40 }
  })
  const width = padding * 2 + normalized.length * groupWidth + Math.max(0, normalized.length - 1) * gap
  return { width, height, groups: layoutGroups, positions }
}

function nodeColor(kind: ProjectArchitecture['nodes'][number]['kind']): {
  readonly fill: string
  readonly border: string
  readonly accent: string
} {
  switch (kind) {
    case 'entry': return { fill: '#eff6ff', border: '#93c5fd', accent: '#2563eb' }
    case 'core': return { fill: '#f5f3ff', border: '#c4b5fd', accent: '#7c3aed' }
    case 'store': return { fill: '#ecfdf5', border: '#86efac', accent: '#15803d' }
    case 'external': return { fill: '#fff7ed', border: '#fdba74', accent: '#c2410c' }
    case 'output': return { fill: '#fdf2f8', border: '#f9a8d4', accent: '#be185d' }
    case 'default': return { fill: '#f8fafc', border: '#cbd5e1', accent: '#475569' }
  }
}

function architectureSvgMarkup(architecture: ProjectArchitecture): string {
  const layout = architectureLayout(architecture)
  const escape = (text: string): string => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
  const groups = layout.groups.map(group => `<g><rect x="${group.x}" y="28" width="${group.width}" height="${group.height}" rx="18" fill="#f8fafc" stroke="#e2e8f0"/><text x="${group.x + 18}" y="55" fill="#64748b" font-size="13" font-weight="600">${escape(group.label)}</text></g>`).join('')
  const edges = architecture.edges.map((edge) => {
    const from = layout.positions[edge.from]
    const to = layout.positions[edge.to]
    if (from === undefined || to === undefined) return ''
    const x1 = from.x + from.width / 2
    const y1 = from.y + from.height / 2
    const x2 = to.x + to.width / 2
    const y2 = to.y + to.height / 2
    const path = `<path d="M ${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}" fill="none" stroke="#94a3b8" stroke-width="1.5"${edge.dashed === true ? ' stroke-dasharray="5 5"' : ''} marker-end="url(#arrow)"/>`
    const label = edge.label === undefined ? '' : `<text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 - 6}" text-anchor="middle" fill="#64748b" font-size="11">${escape(edge.label)}</text>`
    return path + label
  }).join('')
  const nodes = architecture.nodes.map((node) => {
    const box = layout.positions[node.id]
    if (box === undefined) return ''
    const color = nodeColor(node.kind)
    const note = node.note === undefined ? '' : `<text x="${box.x + 16}" y="${box.y + 48}" fill="#64748b" font-size="11">${escape(node.note.slice(0, 28))}</text>`
    return `<g><rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" rx="12" fill="${color.fill}" stroke="${color.border}"/><rect x="${box.x}" y="${box.y}" width="4" height="${box.height}" rx="2" fill="${color.accent}"/><text x="${box.x + 16}" y="${box.y + 29}" fill="#0f172a" font-size="14" font-weight="600">${escape(node.label)}</text>${note}</g>`
  }).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}"><defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8"/></marker></defs><rect width="100%" height="100%" fill="#ffffff"/>${groups}${edges}${nodes}</svg>`
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

function architectureStatusLabel(status: ProjectArchitecture['status']): string {
  switch (status) {
    case 'confirmed': return '已确认'
    case 'pending-confirmation': return '待确认'
    case 'impacted': return '受变更影响'
    case 'superseded': return '已替代'
    case 'candidate': return '候选方案'
  }
}

function ArchitectureCanvas({ architecture }: { readonly architecture: ProjectArchitecture }) {
  const layout = useMemo(() => architectureLayout(architecture), [architecture])
  return (
    <svg
      className={css.architectureCanvas}
      viewBox={`0 0 ${String(layout.width)} ${String(layout.height)}`}
      role="img"
      aria-label={architecture.title}
    >
      <defs>
        <marker
          id="fde-architecture-arrow"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" className={css.edgeArrow} />
        </marker>
      </defs>
      {layout.groups.map(group => (
        <g key={group.id}>
          <rect className={css.architectureGroup} x={group.x} y={28} width={group.width} height={group.height} rx={18} />
          <text className={css.groupLabel} x={group.x + 18} y={55}>{group.label}</text>
        </g>
      ))}
      {architecture.edges.map((edge, index) => {
        const from = layout.positions[edge.from]
        const to = layout.positions[edge.to]
        if (from === undefined || to === undefined) return null
        const x1 = from.x + from.width / 2
        const y1 = from.y + from.height / 2
        const x2 = to.x + to.width / 2
        const y2 = to.y + to.height / 2
        return <g key={`${edge.from}-${edge.to}-${String(index)}`}><path className={css.architectureEdge} data-dashed={edge.dashed || undefined} d={`M ${String(x1)} ${String(y1)} C ${String((x1 + x2) / 2)} ${String(y1)}, ${String((x1 + x2) / 2)} ${String(y2)}, ${String(x2)} ${String(y2)}`} markerEnd="url(#fde-architecture-arrow)" />{edge.label !== undefined && <text className={css.edgeLabel} x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 6} textAnchor="middle">{edge.label}</text>}</g>
      })}
      {architecture.nodes.map((node) => {
        const box = layout.positions[node.id]
        if (box === undefined) return null
        return (
          <g key={node.id} className={css.architectureNode} data-kind={node.kind}>
            <rect x={box.x} y={box.y} width={box.width} height={box.height} rx={12} />
            <rect className={css.nodeAccent} x={box.x} y={box.y} width={4} height={box.height} rx={2} />
            <text className={css.nodeLabel} x={box.x + 16} y={box.y + 29}>{node.label}</text>
            {node.note !== undefined && <text className={css.nodeNote} x={box.x + 16} y={box.y + 49}>{node.note.slice(0, 28)}</text>}
          </g>
        )
      })}
    </svg>
  )
}

/** Render the project-owned architecture artifact as a deterministic graph. */
export function ArchitectureView(props: ProjectViewProps) {
  const [exportError, setExportError] = useState('')
  const [actionNotice, setActionNotice] = useState('')
  const [actionPending, setActionPending] = useState(false)
  const [zoom, setZoom] = useState(100)
  const actionRef = useRef(false)
  return (
    <ProjectViewState props={props}>{(snapshot, workspace) => {
      const architecture = snapshot.architecture
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
        <section className={css.surfaceRoot}>
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
            <>
              <div className={css.architectureMeta}>
                <div><span>版本</span><strong>R{architecture.revision}</strong></div>
                <div><span>状态</span><strong>{architectureStatusLabel(architecture.status)}</strong></div>
                <div><span>更新时间</span><strong>{new Date(architecture.updatedAt).toLocaleString('zh-CN')}</strong></div>
                <div><span>规模</span><strong>{architecture.nodes.length} 个节点 · {architecture.edges.length} 条关系</strong></div>
              </div>
              <div className={css.architectureTitleRow}>
                <div className={css.architectureTitle}>
                  <h2>{architecture.title}</h2>
                  {architecture.summary !== undefined && <p>{architecture.summary}</p>}
                </div>
                <div className={css.zoomControls} aria-label="架构图缩放">
                  <button type="button" aria-label="缩小" onClick={() => { setZoom(value => Math.max(60, value - 10)) }}>−</button>
                  <button type="button" onClick={() => { setZoom(100) }}>{zoom}%</button>
                  <button type="button" aria-label="放大" onClick={() => { setZoom(value => Math.min(180, value + 10)) }}>＋</button>
                </div>
              </div>
              {exportError !== '' && <p className={css.inlineError} role="alert">{exportError}</p>}
              <div className={css.architectureScroll}><div style={{ width: `${String(zoom)}%` }}><ArchitectureCanvas architecture={architecture} /></div></div>
            </>
          )}
        </section>
      )
    }}</ProjectViewState>
  )
}
