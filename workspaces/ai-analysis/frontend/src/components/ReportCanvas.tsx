import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import ReactECharts from "echarts-for-react";
import { BarChart3, ChevronLeft, ChevronRight, Code2, Download, ExternalLink, FileText, History, ListTree, MoveHorizontal, PanelLeftClose, PanelLeftOpen, RotateCcw, Save, Sparkles, Table2, X } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Link } from "react-router-dom";
import remarkGfm from "remark-gfm";

import { api } from "../api";
import type { Artifact, ReportVersion } from "../types";
import { ErrorState, LoadingState, StatusPill } from "./Ui";

export function ReportCanvas({ projectId, report, reports = [], onSelectReport = () => undefined, onClose }: { projectId: string; report: ReportVersion; reports?: ReportVersion[]; onSelectReport?: (report: ReportVersion) => void; onClose: () => void }) {
  const client = useQueryClient();
  const versions = useQuery({ queryKey: ["report-versions", projectId, report.report_key], queryFn: () => api.reportVersions(projectId, report.report_key) });
  const ordered = useMemo(() => [...(versions.data ?? [])].sort((a, b) => a.version - b.version), [versions.data]);
  const [version, setVersion] = useState(report.version);
  const content = useQuery({ queryKey: ["report-content", projectId, report.report_key, version], queryFn: () => api.reportContent(projectId, report.report_key, version) });
  const artifacts = useQuery({ queryKey: ["artifacts", projectId], queryFn: () => api.artifacts(projectId) });
  const [markdown, setMarkdown] = useState("");
  const [mode, setMode] = useState<"preview" | "edit">("preview");
  const [outlineCollapsed, setOutlineCollapsed] = useState(false);
  useEffect(() => { setVersion(report.version); setMode("preview"); }, [report.report_key, report.version]);
  useEffect(() => { if (content.data) setMarkdown(content.data.markdown); }, [content.data]);
  const sections = useMemo(() => extractReportSections(markdown), [markdown]);

  const revise = useMutation({
    mutationFn: () => api.reviseReport(projectId, report.report_key, markdown, `Canvas revision based on v${version}`),
    onSuccess: async (next) => { await client.invalidateQueries({ queryKey: ["report-versions", projectId, report.report_key] }); setVersion(next.version); setMode("preview"); },
  });
  const restore = useMutation({
    mutationFn: () => api.restoreReport(projectId, report.report_key, version),
    onSuccess: async (next) => { await client.invalidateQueries({ queryKey: ["report-versions", projectId, report.report_key] }); setVersion(next.version); },
  });
  const html = useMutation({ mutationFn: () => api.generateReportHtml(projectId, report.report_key, version) });
  const index = ordered.findIndex((item) => item.version === version);

  return (
    <aside className="report-canvas">
      <header className="canvas-header"><div><span className="eyebrow">REPORT CANVAS</span>{reports.length > 1 ? <label className="report-document-select"><span>当前报告</span><select aria-label="选择报告文档" value={report.report_key} onChange={(event) => { const selected = reports.find((item) => item.report_key === event.target.value); if (selected) onSelectReport(selected); }}>{reports.map((item) => <option key={item.report_key} value={item.report_key}>{item.title} · v{item.version}</option>)}</select></label> : <h2>{report.title}</h2>}<small>{reports.length > 1 ? `${reports.length} 份项目报告 · 每份保留独立版本链` : "项目报告 · 结论、图表与行动建议保持同一证据口径"}</small></div><button className="icon-button" onClick={onClose} aria-label="关闭报告"><X size={18} /></button></header>
      <div className="canvas-toolbar">
        <div className="version-switch"><button disabled={index <= 0} onClick={() => setVersion(ordered[index - 1].version)}><ChevronLeft size={15} /></button><span><History size={14} />v{version} / {ordered.length || 1}</span><button disabled={index < 0 || index >= ordered.length - 1} onClick={() => setVersion(ordered[index + 1].version)}><ChevronRight size={15} /></button></div>
        <div className="canvas-actions"><button className={mode === "edit" ? "active" : ""} onClick={() => setMode(mode === "edit" ? "preview" : "edit")}><Code2 size={14} />{mode === "edit" ? "预览" : "编辑 MD"}</button><button onClick={() => html.mutate()} disabled={html.isPending}><Download size={14} />生成 HTML</button></div>
      </div>
      <div className="canvas-meta"><StatusPill tone="good">不可变版本</StatusPill><span>{content.data?.report.note}</span>{content.data?.report.based_on_version && <span>基于 v{content.data.report.based_on_version}</span>}<span>{sections.length} 个报告章节</span></div>
      <div className={`canvas-workspace ${outlineCollapsed ? "outline-collapsed" : ""}`}>
        <nav className="canvas-outline" aria-label="报告章节">
          <header>
            <ListTree size={15} />
            <span>报告章节</span>
            <button
              className="canvas-outline-toggle"
              type="button"
              aria-label={outlineCollapsed ? "展开报告目录" : "收起报告目录"}
              title={outlineCollapsed ? "展开报告目录" : "收起报告目录"}
              onClick={() => setOutlineCollapsed((current) => !current)}
            >
              {outlineCollapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
            </button>
          </header>
          <div className="canvas-outline-sections">
            {sections.map((section, index) => <button key={`${section.id}-${index}`} onClick={() => document.getElementById(section.id)?.scrollIntoView({ behavior: "smooth", block: "start" })}><i>{String(index + 1).padStart(2, "0")}</i><span>{section.title}</span></button>)}
            {sections.length === 0 && <p>保存 Markdown 标题后，这里会自动生成目录。</p>}
          </div>
          <footer><Sparkles size={14} /><span>所有结论均可回溯至项目产物</span></footer>
        </nav>
        <div className="canvas-paper-shell">
          <article className="canvas-paper">
            {content.isLoading && <LoadingState label="读取 Markdown 版本" />}
            {content.error && <ErrorState error={content.error} />}
            {mode === "edit" ? <textarea className="markdown-editor" value={markdown} onChange={(event) => setMarkdown(event.target.value)} /> : <><ReportPaperCover report={content.data?.report ?? report} version={version} /><ReportVisuals report={content.data?.report ?? report} artifacts={artifacts.data ?? []} /><ReportEvidenceScope projectId={projectId} /><MarkdownPreview markdown={markdown} /></>}
          </article>
        </div>
      </div>
      {(revise.error || restore.error || html.error) && <ErrorState error={revise.error || restore.error || html.error} />}
      {html.data && <div className="canvas-notice">HTML 已从 v{version} 生成。<a href={api.reportHtmlUrl(projectId, report.report_key, version)} target="_blank" rel="noreferrer">在新窗口查看</a></div>}
      <footer className="canvas-footer"><button className="button ghost" onClick={() => restore.mutate()} disabled={restore.isPending}><RotateCcw size={15} />恢复此版本为最新版</button>{mode === "edit" && <button className="button primary" onClick={() => revise.mutate()} disabled={revise.isPending || !markdown.trim()}><Save size={15} />保存新版本</button>}</footer>
    </aside>
  );
}

function ReportPaperCover({ report, version }: { report: ReportVersion; version: number }) {
  return <header className="canvas-paper-cover"><span>业务分析报告 · VERSION {version}</span><h1>{report.title}</h1><p>基于当前项目的查询、图表、模型和预测产物生成；关键判断均保留可追溯证据。</p><div><small><FileText size={13} />Markdown 真相源</small><small><BarChart3 size={13} />{report.artifact_ids.length} 项引用产物</small></div></header>;
}

function ReportEvidenceScope({ projectId }: { projectId: string }) {
  return <aside className="report-evidence-scope"><Table2 size={16} /><span><b>表格为报告摘要视图</b><small>宽表可横向滚动；完整行列仍保留在项目产物中。</small></span><Link to={`/projects/${projectId}/artifacts`} target="_blank" rel="noreferrer">查看完整数据 <ExternalLink size={13} /></Link></aside>;
}

function ReportVisuals({ report, artifacts }: { report: ReportVersion; artifacts: Artifact[] }) {
  const visuals = report.artifact_ids.map((id) => artifacts.find((item) => item.id === id)).filter((item): item is Artifact => item?.type === "visual").slice(0, 6);
  if (!visuals.length) return null;
  return <section className="canvas-visuals"><header><span className="eyebrow">VISUAL STORY</span><h3><BarChart3 size={20} />关键数据图景</h3><p>先看趋势、结构与异常，再进入完整经营结论。图表与正文引用同一份已登记数据。</p></header><div>{visuals.map((visual) => {
    const source = artifacts.find((item) => item.id === visual.lineage[0]);
    const rows = (source?.metadata.preview as Record<string, unknown>[] | undefined) ?? [];
    return <figure key={visual.id}><figcaption><b>{visual.name}</b><span>{source?.name}</span></figcaption><ReactECharts option={reportChartOption(visual, rows)} style={{ height: 290 }} notMerge /></figure>;
  })}</div></section>;
}

export function reportChartOption(visual: Artifact, rows: Record<string, unknown>[]) {
  const x = String(visual.metadata.x ?? "");
  const y = Array.isArray(visual.metadata.y) ? visual.metadata.y.map(String) : [];
  const type = String(visual.metadata.chart_type ?? "bar");
  const labels = rows.map((row) => String(row[x] ?? ""));
  const palette = ["#c66f2d", "#dca35f", "#6f8d78", "#806d99"];
  const metrics = y.map((name) => ({ name, kind: metricKind(name), max: Math.max(...rows.map((row) => Math.abs(Number(row[name] ?? 0))), 0) }));
  const nonZeroMaxima = metrics.map((metric) => metric.max).filter((value) => value > 0);
  const scaleRatio = nonZeroMaxima.length > 1 ? Math.max(...nonZeroMaxima) / Math.min(...nonZeroMaxima) : 1;
  const useDualAxis = metrics.length === 2 && (scaleRatio >= 20 || metrics[0].kind !== metrics[1].kind);
  const base = { color: palette, backgroundColor: "transparent", tooltip: { trigger: type === "pie" ? "item" : "axis", axisPointer: { type: "cross" } }, legend: { top: 0, textStyle: { color: "#5e5146", fontSize: 12 } }, grid: { left: 58, right: useDualAxis ? 62 : 22, top: 44, bottom: 52 } };
  if (type === "pie") return { ...base, series: [{ type: "pie", radius: ["42%", "72%"], data: labels.map((name, index) => ({ name, value: Number(rows[index]?.[y[0]] ?? 0) })) }] };
  const axes = (useDualAxis ? metrics : metrics.slice(0, 1)).map((metric, index) => ({ type: "value", name: metricUnit(metric.kind), position: index === 1 ? "right" : "left", axisLabel: { formatter: (value: number) => formatMetricTick(value, metric.kind), color: "#75685d" }, nameTextStyle: { color: "#8b6c4e", padding: index === 1 ? [0, 0, 0, 14] : [0, 14, 0, 0] }, splitLine: { show: index === 0, lineStyle: { color: "rgba(89,64,40,.12)" } } }));
  return { ...base, xAxis: { type: "category", data: labels, axisLabel: { rotate: labels.length > 8 ? 24 : 0, color: "#75685d" }, axisLine: { lineStyle: { color: "rgba(89,64,40,.22)" } } }, yAxis: axes, series: metrics.map((metric, index) => ({ name: metric.name, type: index === 1 && useDualAxis ? "line" : type === "area" ? "line" : ["bar", "line", "scatter"].includes(type) ? type : "bar", yAxisIndex: useDualAxis && index === 1 ? 1 : 0, smooth: index === 1 || type === "line" || type === "area", areaStyle: type === "area" && index === 0 ? { opacity: .16 } : undefined, lineStyle: index === 1 ? { width: 2.5 } : undefined, symbolSize: index === 1 ? 7 : undefined, data: rows.map((row) => Number(row[metric.name] ?? 0)), tooltip: { valueFormatter: (value: number) => formatMetricValue(value, metric.kind) } })) };
}

function MarkdownPreview({ markdown }: { markdown: string }) {
  return <article className="markdown-preview"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{ h2: ({ children, ...props }) => <h2 id={reportHeadingId(String(children))} {...props}>{children}</h2>, h3: ({ children, ...props }) => <h3 id={reportHeadingId(String(children))} {...props}>{children}</h3>, table: ({ children }) => <ReportTable>{children}</ReportTable> }}>{markdown}</ReactMarkdown></article>;
}

function ReportTable({ children }: { children?: ReactNode }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const measure = () => setOverflowing(element.scrollWidth > element.clientWidth + 1);
    const frame = requestAnimationFrame(measure);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(element);
    window.addEventListener("resize", measure);
    return () => { cancelAnimationFrame(frame); observer?.disconnect(); window.removeEventListener("resize", measure); };
  }, [children]);
  return <div className={`report-table-frame ${overflowing ? "is-overflowing" : ""}`}>
    {overflowing && <div className="report-table-hint"><MoveHorizontal size={14} />横向滚动查看全部字段</div>}
    <div ref={scroller} className="report-table-scroll" role="region" aria-label="报告数据表" tabIndex={overflowing ? 0 : undefined}><table>{children}</table></div>
  </div>;
}

function extractReportSections(markdown: string) {
  return markdown.split("\n").map((line) => line.match(/^##\s+(.+?)\s*$/)?.[1]?.trim()).filter((title): title is string => Boolean(title)).slice(0, 10).map((title) => ({ title, id: reportHeadingId(title) }));
}

function reportHeadingId(title: string) {
  const normalized = title.toLowerCase().replace(/[`*_()[\]{}:：，,。！？!?]/g, "").trim().replace(/\s+/g, "-");
  return `report-${normalized || "section"}`;
}

type MetricKind = "percent" | "currency" | "number";

function metricKind(name: string): MetricKind {
  const value = name.toLowerCase();
  if (/(rate|ratio|pct|percent|share|占比|率)/.test(value)) return "percent";
  if (/(revenue|gmv|amount|price|payment|sales|income|收入|金额|销售额|客单价)/.test(value)) return "currency";
  return "number";
}

function metricUnit(kind: MetricKind) {
  if (kind === "percent") return "%";
  if (kind === "currency") return "金额";
  return "数值";
}

function formatMetricTick(value: number, kind: MetricKind) {
  if (kind === "percent") return `${value.toFixed(value < 10 ? 1 : 0)}%`;
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return value.toLocaleString("zh-CN");
}

function formatMetricValue(value: number, kind: MetricKind) {
  if (kind === "percent") return `${value.toFixed(2)}%`;
  if (kind === "currency") return `¥${value.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}`;
  return value.toLocaleString("zh-CN", { maximumFractionDigits: 2 });
}
