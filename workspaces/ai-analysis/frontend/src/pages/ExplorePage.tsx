import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import ReactECharts from "echarts-for-react";
import { BarChart3, Download, LineChart, Play, Save, ScanSearch, ScatterChart, Sparkles, Table2, WandSparkles } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { api } from "../api";
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusPill, formatNumber } from "../components/Ui";
import { useColorMode } from "../design/colorMode";
import type { Artifact } from "../types";

type ViewMode = "table" | "bar" | "line" | "scatter";

export function ExplorePage() {
  const { projectId = "" } = useParams();
  const { resolved: colorMode } = useColorMode();
  const client = useQueryClient();
  const sources = useQuery({ queryKey: ["sources", projectId], queryFn: () => api.sources(projectId) });
  const [sourceId, setSourceId] = useState("");
  const [sheetName, setSheetName] = useState("");
  const [sql, setSql] = useState("SELECT * FROM data LIMIT 200");
  const [name, setName] = useState("探索结果");
  const [result, setResult] = useState<Artifact | null>(null);
  const [view, setView] = useState<ViewMode>("table");
  const query = useMutation({
    mutationFn: () => api.query(projectId, sourceId, sql, name),
    onSuccess: (artifact) => { setResult(artifact); setView("table"); void client.invalidateQueries({ queryKey: ["artifacts", projectId] }); },
  });
  const rows = (result?.metadata.preview as Record<string, unknown>[] | undefined) ?? [];
  const columns = (result?.metadata.columns as string[] | undefined) ?? [];
  const numeric = useMemo(() => columns.filter((column) => rows.some((row) => typeof row[column] === "number")), [columns, rows]);
  const category = columns.find((column) => !numeric.includes(column)) ?? columns[0];
  const value = numeric[0] ?? columns[1];
  const chart = useMutation({
    mutationFn: () => api.chart(projectId, { artifact_id: result!.id, chart_type: view, x: category, y: [value], title: name }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["artifacts", projectId] }),
  });
  const profile = useMutation({ mutationFn: () => api.profile(projectId, result!.id), onSuccess: () => client.invalidateQueries({ queryKey: ["artifacts", projectId] }) });
  const clean = useMutation({ mutationFn: () => api.clean(projectId, result!.id), onSuccess: (value) => { setResult(value.data); void client.invalidateQueries({ queryKey: ["artifacts", projectId] }); } });
  const features = useMutation({ mutationFn: () => api.features(projectId, result!.id, columns.filter((column) => /date|time|日期|时间/i.test(column)), numeric.slice(0, 2)), onSuccess: (value) => { setResult(value.data); void client.invalidateQueries({ queryKey: ["artifacts", projectId] }); } });
  const selectedSource = sources.data?.find((source) => source.id === sourceId);
  const excelSheets = selectedSource?.type === "excel" && Array.isArray(selectedSource.baseline.sheets) ? (selectedSource.baseline.sheets as { name: string }[]) : [];

  function run(event: FormEvent) { event.preventDefault(); if (sourceId && sql.trim()) query.mutate(); }
  const chartText = colorMode === "light" ? "#6f6257" : "#c6beb2";
  const chartOption = { backgroundColor: "transparent", grid: { left: 50, right: 22, top: 38, bottom: 48 }, tooltip: { trigger: "axis" }, textStyle: { color: chartText, fontSize: 12.5, fontFamily: "Inter, sans-serif" }, xAxis: { type: view === "bar" || view === "line" ? "category" : "value", data: view === "scatter" ? undefined : rows.map((row) => String(row[category] ?? "")), axisLabel: { color: chartText, fontSize: 12.5 } }, yAxis: { type: "value", axisLabel: { color: chartText, fontSize: 12.5 }, splitLine: { lineStyle: { color: colorMode === "light" ? "rgba(79,58,39,.10)" : "rgba(239,229,215,.08)" } } }, series: [{ type: view, data: view === "scatter" ? rows.map((row) => [Number(row[category]), Number(row[value])]) : rows.map((row) => Number(row[value])), itemStyle: { color: "#e49a45" }, lineStyle: { color: "#e49a45", width: 3 }, areaStyle: view === "line" ? { color: "rgba(228,154,69,.18)" } : undefined }] };

  return <div className="page explore-page"><PageHeader eyebrow="DATA EXPLORATION" title="探索工作台" description="SQL 始终只读并自动限制展示行数。查询结果先保存为 Parquet 产物，再在表格与图表之间切换。" actions={result && <a className="button secondary compact" href={api.artifactDownloadUrl(projectId, result.id)}><Download size={14} />下载数据片段</a>} />
    {!sources.data?.length && !sources.isLoading ? <EmptyState title="还没有可查询的数据" text="先连接一个 CSV、Excel、SQLite 或 MySQL 数据源，再从真实基线开始探索。" action={<Link className="button primary" to={`/projects/${projectId}/sources`}>连接数据</Link>} /> : <div className="explore-layout">
      <form className="query-panel" onSubmit={run}><header><span className="eyebrow">READ-ONLY QUERY</span><StatusPill tone="good">LIMIT ≤ 5,000</StatusPill></header><label>数据源<select value={sourceId} onChange={(event) => { setSourceId(event.target.value); const item = sources.data?.find((source) => source.id === event.target.value); const sheets = item?.type === "excel" && Array.isArray(item.baseline.sheets) ? item.baseline.sheets as { name: string }[] : []; const firstSheet = sheets[0]?.name ?? ""; setSheetName(firstSheet); setSql(item?.type === "excel" && firstSheet ? `SELECT * FROM "${firstSheet.replaceAll('"', '""')}" LIMIT 200` : item?.type === "csv" ? "SELECT * FROM data LIMIT 200" : "SELECT * FROM your_table LIMIT 200"); }}><option value="">选择数据源</option>{sources.data?.map((source) => <option key={source.id} value={source.id}>{source.name} · {source.type}</option>)}</select></label>{excelSheets.length > 0 && <label>Excel 工作表<select aria-label="Excel 工作表" value={sheetName} onChange={(event) => { const value = event.target.value; setSheetName(value); setSql(`SELECT * FROM "${value.replaceAll('"', '""')}" LIMIT 200`); }}>{excelSheets.map((sheet) => <option key={sheet.name} value={sheet.name}>{sheet.name}</option>)}</select></label>}<label>结果名称<input value={name} onChange={(event) => setName(event.target.value)} /></label><label className="sql-label">SQL<textarea className="sql-editor" value={sql} onChange={(event) => setSql(event.target.value)} spellCheck={false} /></label><button className="button primary" disabled={!sourceId || !sql.trim() || query.isPending}><Play size={15} />{query.isPending ? "正在执行…" : "运行并保存结果"}</button><div className="query-hints"><b>安全边界</b><span>拒绝 DDL / DML / 多语句</span><span>数据库使用只读事务</span>{excelSheets.length > 0 && <span>可在 SQL 中按工作表名关联：{excelSheets.map((sheet) => sheet.name).join("、")}</span>}<span>结果绑定源指纹与 SQL</span></div></form>
      <section className="result-panel"><header className="result-header"><div><span className="eyebrow">RESULT ARTIFACT</span><h2>{result?.name ?? "查询结果将在这里出现"}</h2></div>{result && <div className="view-switch"><button aria-label="表格视图" className={view === "table" ? "active" : ""} onClick={() => setView("table")}><Table2 size={15} /></button><button aria-label="柱状图视图" className={view === "bar" ? "active" : ""} onClick={() => setView("bar")}><BarChart3 size={15} /></button><button aria-label="折线图视图" className={view === "line" ? "active" : ""} onClick={() => setView("line")}><LineChart size={15} /></button><button aria-label="散点图视图" className={view === "scatter" ? "active" : ""} onClick={() => setView("scatter")}><ScatterChart size={15} /></button></div>}</header>
        {query.isPending && <LoadingState label="DuckDB / 数据库正在执行只读查询" />}{query.error && <ErrorState error={query.error} />}{!result && !query.isPending && <EmptyState title="从一个问题开始" text="选择来源、写下查询；输出不会只留在屏幕上，而会成为带血缘的数据片段。" />}{result && <><div className="result-summary"><span><b>{formatNumber(result.metadata.rows)}</b> 行</span><span><b>{columns.length}</b> 列</span><span><b>{result.sha256.slice(0, 10)}</b> 内容哈希</span><div className="analysis-actions"><button onClick={() => profile.mutate()} disabled={profile.isPending}><ScanSearch size={13} />质量画像</button><button onClick={() => clean.mutate()} disabled={clean.isPending}><WandSparkles size={13} />标准清洗</button><button onClick={() => features.mutate()} disabled={features.isPending}><Sparkles size={13} />特征工程</button></div></div>{(profile.error || clean.error || features.error) && <ErrorState error={profile.error || clean.error || features.error} />}{view === "table" ? <DataTable rows={rows} columns={columns} /> : <div className="chart-stage"><ReactECharts option={chartOption} style={{ height: 420 }} /><button className="button secondary compact chart-save" onClick={() => chart.mutate()} disabled={!category || !value || chart.isPending}><Save size={14} />保存图表产物</button></div>}</>}
      </section>
    </div>}
  </div>;
}

export function DataTable({ rows, columns }: { rows: Record<string, unknown>[]; columns: string[] }) {
  return <div className="table-scroll"><table className="data-table"><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{columns.map((column) => <td key={column}>{formatNumber(row[column])}</td>)}</tr>)}</tbody></table></div>;
}
