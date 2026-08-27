import {
  BarChart3,
  Brain,
  Check,
  Clock3,
  Code2,
  Copy,
  Cpu,
  Database,
  Files,
  FileText,
  GitBranch,
  HardDrive,
  LibraryBig,
  Maximize2,
  Monitor,
  Move,
  Network,
  Radio,
  Search,
  Sparkles,
  X,
  ZoomIn,
  ZoomOut,
  type LucideIcon,
} from "lucide-react";
import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import rawManifest from "../features/architecture/architecture-manifest.json";

type ArchitectureFlow = {
  id: string;
  label: string;
  description: string;
  accent: string;
};

type ArchitectureSource = {
  path: string;
  start_line: number;
  end_line: number;
  sha256: string;
  language: string;
};

type ArchitectureNode = {
  id: string;
  title: string;
  group: string;
  summary: string;
  input: string;
  output: string;
  failure: string;
  flows: string[];
  external: boolean;
  source: ArchitectureSource | null;
  code: string | null;
  x: number;
  y: number;
  width: number;
  icon: string;
};

type ArchitectureEdge = {
  id: string;
  source: string;
  target: string;
  kind: "control" | "data" | "evidence" | "storage";
  label: string;
  flows: string[];
};

type ArchitectureManifest = {
  title: string;
  scope: string;
  source_revision: string;
  canvas: { width: number; height: number };
  groups: { id: string; label: string; y: number; height: number }[];
  flows: ArchitectureFlow[];
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
  limitations: string[];
};

const manifest = rawManifest as ArchitectureManifest;
const NODE_HEIGHT = 130;
const MIN_ZOOM = 0.42;
const MAX_ZOOM = 1.35;

const icons: Record<string, LucideIcon> = {
  monitor: Monitor,
  radio: Radio,
  brain: Brain,
  sparkles: Sparkles,
  network: Network,
  library: LibraryBig,
  database: Database,
  search: Search,
  chart: BarChart3,
  clock: Clock3,
  cpu: Cpu,
  report: FileText,
  files: Files,
  git: GitBranch,
  storage: Database,
  "hard-drive": HardDrive,
};

const edgeKindLabel = {
  control: "控制调用",
  data: "数据返回",
  evidence: "证据登记",
  storage: "文件写入",
};

export function ArchitecturePage() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; x: number; y: number; panX: number; panY: number } | null>(null);
  const [activeFlow, setActiveFlow] = useState("all");
  const [scale, setScale] = useState(0.7);
  const [pan, setPan] = useState({ x: 38, y: 32 });
  const [selectedNode, setSelectedNode] = useState<ArchitectureNode | null>(null);

  const nodesById = useMemo(
    () => new Map(manifest.nodes.map((node) => [node.id, node])),
    [],
  );
  const selectedFlow = manifest.flows.find((flow) => flow.id === activeFlow);

  function fitCanvas() {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const nextScale = Math.max(
      MIN_ZOOM,
      Math.min(
        0.92,
        (viewport.clientWidth - 74) / manifest.canvas.width,
        (viewport.clientHeight - 64) / manifest.canvas.height,
      ),
    );
    setScale(nextScale);
    setPan({
      x: Math.max(30, (viewport.clientWidth - manifest.canvas.width * nextScale) / 2),
      y: Math.max(26, (viewport.clientHeight - manifest.canvas.height * nextScale) / 2),
    });
  }

  useEffect(() => {
    fitCanvas();
    const viewport = viewportRef.current;
    if (!viewport || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(() => fitCanvas());
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setSelectedNode(null);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  function zoom(next: number, origin?: { x: number; y: number }) {
    const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, next));
    if (origin) {
      const worldX = (origin.x - pan.x) / scale;
      const worldY = (origin.y - pan.y) / scale;
      setPan({ x: origin.x - worldX * clamped, y: origin.y - worldY * clamped });
    }
    setScale(clamped);
  }

  function handleWheel(event: ReactWheelEvent<HTMLDivElement>) {
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    zoom(scale * (event.deltaY > 0 ? 0.92 : 1.08), {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    });
  }

  function beginPan(event: ReactPointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("button, a")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
  }

  function movePan(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setPan({ x: drag.panX + event.clientX - drag.x, y: drag.panY + event.clientY - drag.y });
  }

  function endPan(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
  }

  return (
    <div className="architecture-page">
      <header className="architecture-header">
        <div className="architecture-title">
          <span className="eyebrow">PROJECT FUNCTION ARCHITECTURE</span>
          <h1>从一句业务问题，到一条可追溯的数据证据链。</h1>
          <p>{manifest.scope}</p>
        </div>
        <div className="architecture-metrics" aria-label="架构概览">
          <span><b>{manifest.nodes.length}</b>运行时组件</span>
          <span><b>{manifest.flows.length}</b>条主流程</span>
          <span><b>{manifest.nodes.filter((node) => node.source).length}</b>处真实源码</span>
        </div>
      </header>

      <section className="architecture-control-deck" aria-label="架构流程筛选">
        <div className="architecture-flow-tabs">
          <button className={activeFlow === "all" ? "active" : ""} onClick={() => setActiveFlow("all")}>
            <Network size={15} />全景
          </button>
          {manifest.flows.map((flow) => (
            <button
              key={flow.id}
              className={activeFlow === flow.id ? "active" : ""}
              style={{ "--flow-accent": flow.accent } as CSSProperties}
              onClick={() => setActiveFlow(flow.id)}
            >
              <span className="flow-dot" />{flow.label}
            </button>
          ))}
        </div>
        <p>{selectedFlow?.description ?? "查看 DS4 从交互入口、Agent 编排、分析能力到证据存储的完整运行时。"}</p>
        <div className="architecture-legend" aria-label="连线图例">
          {(Object.entries(edgeKindLabel) as [ArchitectureEdge["kind"], string][]).map(([kind, label]) => (
            <span key={kind} className={`edge-legend ${kind}`}><i />{label}</span>
          ))}
        </div>
      </section>

      <section className="architecture-workspace">
        <div className="architecture-canvas-toolbar">
          <span><Move size={14} />拖拽画布 · 滚轮缩放 · 点击节点查看源码</span>
          <div>
            <button aria-label="缩小架构图" onClick={() => zoom(scale - 0.1)}><ZoomOut size={16} /></button>
            <output aria-label="当前缩放比例">{Math.round(scale * 100)}%</output>
            <button aria-label="放大架构图" onClick={() => zoom(scale + 0.1)}><ZoomIn size={16} /></button>
            <button aria-label="适应视口" onClick={fitCanvas}><Maximize2 size={16} /></button>
          </div>
        </div>

        <div
          ref={viewportRef}
          className="architecture-viewport"
          data-testid="architecture-viewport"
          onWheel={handleWheel}
          onPointerDown={beginPan}
          onPointerMove={movePan}
          onPointerUp={endPan}
          onPointerCancel={endPan}
        >
          <div
            className="architecture-canvas"
            style={{
              width: manifest.canvas.width,
              height: manifest.canvas.height,
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            }}
          >
            <div className="architecture-grid" />
            {manifest.groups.map((group, index) => (
              <section
                className="architecture-lane"
                key={group.id}
                style={{ top: group.y, height: group.height }}
                aria-label={group.label}
              >
                <header><span>0{index + 1}</span>{group.label}</header>
              </section>
            ))}

            <svg className="architecture-edges" viewBox={`0 0 ${manifest.canvas.width} ${manifest.canvas.height}`} aria-hidden="true">
              <defs>
                {(["control", "data", "evidence", "storage"] as const).map((kind) => (
                  <marker key={kind} id={`arrow-${kind}`} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth">
                    <path d="M0,0 L8,4 L0,8 z" className={`arrow-head ${kind}`} />
                  </marker>
                ))}
              </defs>
              {manifest.edges.map((edge) => {
                const source = nodesById.get(edge.source);
                const target = nodesById.get(edge.target);
                if (!source || !target) return null;
                const active = activeFlow === "all" || edge.flows.includes(activeFlow);
                const path = edgePath(source, target, edge.id);
                return (
                  <g key={edge.id} className={`architecture-edge ${edge.kind} ${active ? "active" : "muted"}`}>
                    <path id={`edge-${edge.id}`} d={path} markerEnd={`url(#arrow-${edge.kind})`} />
                    {activeFlow !== "all" && active && (
                      <text><textPath href={`#edge-${edge.id}`} startOffset="50%">{edge.label}</textPath></text>
                    )}
                  </g>
                );
              })}
            </svg>

            {manifest.nodes.map((node) => {
              const active = activeFlow === "all" || node.flows.includes(activeFlow);
              const Icon = icons[node.icon] ?? Code2;
              return (
                <button
                  key={node.id}
                  type="button"
                  className={`architecture-node ${active ? "active" : "muted"} ${node.external ? "external" : ""}`}
                  style={{ left: node.x, top: node.y, width: node.width, height: NODE_HEIGHT }}
                  onClick={() => setSelectedNode(node)}
                  aria-label={`查看 ${node.title} 的架构与源码`}
                >
                  <span className="architecture-node-icon"><Icon size={19} /></span>
                  <span className="architecture-node-copy">
                    <small>{node.external ? "EXTERNAL BOUNDARY" : groupLabel(node.group)}</small>
                    <b>{node.title}</b>
                    <em>{node.summary}</em>
                  </span>
                  <span className="architecture-node-flows">
                    {node.flows.map((flowId) => <i key={flowId} style={{ background: flowColor(flowId) }} />)}
                  </span>
                  <span className="architecture-node-tooltip" role="tooltip">
                    <strong>输入</strong>{node.input}<strong>输出</strong>{node.output}<strong>失败语义</strong>{node.failure}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <footer className="architecture-footer">
        <span><GitBranch size={14} />源码快照 <code>{shortRevision(manifest.source_revision)}</code></span>
        <span>外部边界：{manifest.limitations[0]}</span>
        <span>未覆盖：{manifest.limitations[1]}</span>
      </footer>

      {selectedNode && <SourceDialog node={selectedNode} onClose={() => setSelectedNode(null)} />}
    </div>
  );
}

function SourceDialog({ node, onClose }: { node: ArchitectureNode; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const lines = node.code?.split("\n") ?? [];

  async function copyCode() {
    if (!node.code) return;
    await navigator.clipboard.writeText(node.code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_600);
  }

  return (
    <div className="modal-backdrop architecture-source-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="architecture-source-dialog" role="dialog" aria-modal="true" aria-labelledby="architecture-source-title">
        <header>
          <div>
            <span className="eyebrow">COMPONENT SOURCE</span>
            <h2 id="architecture-source-title">{node.title}</h2>
            <p>{node.summary}</p>
          </div>
          <button className="icon-button" aria-label="关闭源码" onClick={onClose}><X size={18} /></button>
        </header>
        <div className="architecture-contract-grid">
          <article><span>输入</span><p>{node.input}</p></article>
          <article><span>输出</span><p>{node.output}</p></article>
          <article><span>失败语义</span><p>{node.failure}</p></article>
        </div>
        {node.source && node.code ? (
          <div className="architecture-code-shell">
            <header>
              <div><Code2 size={15} /><code>{node.source.path}:{node.source.start_line}-{node.source.end_line}</code></div>
              <button onClick={copyCode}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? "已复制" : "复制源码"}</button>
            </header>
            <pre aria-label={`${node.title} 关键源码`}>
              {lines.map((line, index) => (
                <span key={`${node.source?.start_line}-${index}`}><i>{(node.source?.start_line ?? 1) + index}</i><code>{line || " "}</code></span>
              ))}
            </pre>
            <footer>SHA-256 <code>{node.source.sha256}</code></footer>
          </div>
        ) : (
          <div className="architecture-external-note"><Sparkles size={19} /><div><b>外部组件</b><p>该节点没有本地实现。架构页只声明经过本地适配器验证的输入、输出和失败边界，不虚构供应商内部源码。</p></div></div>
        )}
      </section>
    </div>
  );
}

function edgePath(source: ArchitectureNode, target: ArchitectureNode, edgeId: string) {
  const sourceCenter = { x: source.x + source.width / 2, y: source.y + NODE_HEIGHT / 2 };
  const targetCenter = { x: target.x + target.width / 2, y: target.y + NODE_HEIGHT / 2 };
  const dx = targetCenter.x - sourceCenter.x;
  const dy = targetCenter.y - sourceCenter.y;
  const bend = (edgeId.split("").reduce((total, char) => total + char.charCodeAt(0), 0) % 5 - 2) * 7;
  if (Math.abs(dx) > Math.abs(dy)) {
    const direction = Math.sign(dx) || 1;
    const start = { x: sourceCenter.x + direction * source.width / 2, y: sourceCenter.y + bend };
    const end = { x: targetCenter.x - direction * target.width / 2, y: targetCenter.y + bend };
    const controlX = (start.x + end.x) / 2;
    return `M ${start.x} ${start.y} C ${controlX} ${start.y}, ${controlX} ${end.y}, ${end.x} ${end.y}`;
  }
  const direction = Math.sign(dy) || 1;
  const start = { x: sourceCenter.x + bend, y: sourceCenter.y + direction * NODE_HEIGHT / 2 };
  const end = { x: targetCenter.x + bend, y: targetCenter.y - direction * NODE_HEIGHT / 2 };
  const controlY = (start.y + end.y) / 2;
  return `M ${start.x} ${start.y} C ${start.x} ${controlY}, ${end.x} ${controlY}, ${end.x} ${end.y}`;
}

function flowColor(flowId: string) {
  return manifest.flows.find((flow) => flow.id === flowId)?.accent ?? "#e49a45";
}

function groupLabel(groupId: string) {
  return manifest.groups.find((group) => group.id === groupId)?.label ?? groupId;
}

function shortRevision(revision: string) {
  const commit = revision.match(/git:([a-f0-9]+)/)?.[1]?.slice(0, 10) ?? "unknown";
  const readSet = revision.match(/read-set-sha256:([a-f0-9]+)/)?.[1]?.slice(0, 12) ?? "unknown";
  return `${commit} · ${readSet}`;
}
