import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import ReactECharts from "echarts-for-react";
import { BarChart3, Bot, Check, ChevronLeft, ChevronRight, Circle, Columns3, Database, Download, FileText, FlaskConical, ImageDown, Layers3, Play, RotateCcw, Save, Send, SlidersHorizontal, Sparkles, Square, Table2, UploadCloud, User, X, XCircle } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Link, useParams, useSearchParams } from "react-router-dom";
import remarkGfm from "remark-gfm";

import { api } from "../api";
import { ReportCanvas } from "../components/ReportCanvas";
import { ErrorState, LoadingState, StatusPill } from "../components/Ui";
import { useColorMode } from "../design/colorMode";
import type { AnalysisRun, Artifact, Message, ReportVersion, Source } from "../types";

type ContextTab = "run" | "results" | "report";

export function ChatPage() {
  const { projectId = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const client = useQueryClient();
  const [message, setMessage] = useState("");
  const [draftMessages, setDraftMessages] = useState<Message[]>([]);
  const [canvasReport, setCanvasReport] = useState<ReportVersion | null>(null);
  const initialPanel = searchParams.get("panel");
  const [contextTab, setContextTab] = useState<ContextTab>(initialPanel === "report" || initialPanel === "results" ? initialPanel : "run");
  const [selectedRunId, setSelectedRunId] = useState("");
  const [selectedArtifactId, setSelectedArtifactId] = useState("");
  const [contextCollapsed, setContextCollapsed] = useState(
    () => typeof window.matchMedia === "function" && window.matchMedia("(max-width: 640px)").matches,
  );
  const [streamActivity, setStreamActivity] = useState("DS4 正在判断任务路径");
  const [streamText, setStreamText] = useState("");
  const [streamTools, setStreamTools] = useState<Record<string, { name: string; state: string }>>({});
  const [streamError, setStreamError] = useState("");
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [workbenchTab, setWorkbenchTab] = useState<"data" | "chart" | "model" | "artifacts" | null>(null);
  const messageScrollRef = useRef<HTMLDivElement>(null);
  const positionedProjectRef = useRef("");
  const project = useQuery({ queryKey: ["project", projectId], queryFn: () => fetch(`/api/projects/${projectId}`).then((value) => value.json()), enabled: Boolean(projectId) });
  const messages = useQuery({ queryKey: ["messages", projectId], queryFn: () => api.messages(projectId), enabled: Boolean(projectId) });
  const sources = useQuery({ queryKey: ["sources", projectId], queryFn: () => api.sources(projectId), enabled: Boolean(projectId) });
  const reports = useQuery({ queryKey: ["reports", projectId], queryFn: () => api.reports(projectId), enabled: Boolean(projectId) });
  const artifacts = useQuery({ queryKey: ["artifacts", projectId], queryFn: () => api.artifacts(projectId), enabled: Boolean(projectId) });
  const runs = useQuery({ queryKey: ["runs", projectId], queryFn: () => api.runs(projectId), enabled: Boolean(projectId), refetchInterval: (query) => query.state.data?.some((run) => run.status === "running") ? 1_000 : false });
  const chat = useMutation({
    mutationFn: ({ value, sourceIds, skillIds, retryOfRunId }: { value: string; sourceIds: string[]; skillIds: string[]; retryOfRunId?: string }) => api.chatStream(projectId, value, sourceIds, skillIds, (event) => {
      if (event.type === "intent") {
        setStreamActivity(event.intent === "normal" ? "已确认这是普通对话" : "已进入数据分析模式");
      }
      if (event.type === "activity") setStreamActivity(event.label);
      if (event.type === "token") setStreamText((current) => current + event.content);
      if (event.type === "tool") setStreamTools((current) => ({
        ...current,
        [event.callId || event.name]: { name: event.name, state: event.state },
      }));
      if (event.type === "run_created") {
        setSelectedRunId(event.runId);
        setContextTab("run");
        void client.invalidateQueries({ queryKey: ["runs", projectId] });
      }
      if (event.type === "tool" || event.type === "run_completed") {
        void client.invalidateQueries({ queryKey: ["runs", projectId] });
      }
      if (event.type === "error") setStreamError(event.message);
    }, retryOfRunId),
    onMutate: () => { setStreamText(""); setStreamTools({}); setStreamError(""); },
    onSuccess: async (response) => {
      setDraftMessages([]);
      await Promise.all([
        client.invalidateQueries({ queryKey: ["messages", projectId] }),
        client.invalidateQueries({ queryKey: ["reports", projectId] }),
        client.invalidateQueries({ queryKey: ["artifacts", projectId] }),
        client.invalidateQueries({ queryKey: ["runs", projectId] }),
      ]);
      if (response.intent === "reporting") {
        const latest = await api.reports(projectId);
        if (latest[0]) { setCanvasReport(latest[0]); setContextTab("report"); }
      }
    },
    onSettled: () => { setStreamActivity("DS4 正在判断任务路径"); setStreamText(""); setStreamTools({}); },
  });
  const createReport = useMutation({
    mutationFn: () => {
      if (!selectedRun) throw new Error("请先完成一轮分析，再从该运行生成报告");
      return api.createReport(projectId, `${project.data?.title ?? "项目"} · 本轮分析报告`, selectedRun.artifact_ids, selectedRun.id);
    },
    onSuccess: async (report) => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["reports", projectId] }),
        client.invalidateQueries({ queryKey: ["artifacts", projectId] }),
        client.invalidateQueries({ queryKey: ["runs", projectId] }),
      ]);
      setCanvasReport(report);
      setContextTab("report");
    },
  });
  const cancelRun = useMutation({
    mutationFn: (runId: string) => api.cancelRun(projectId, runId),
    onSuccess: () => client.invalidateQueries({ queryKey: ["runs", projectId] }),
  });
  useEffect(() => {
    const container = messageScrollRef.current;
    if (!container) return;
    if (chat.isPending || draftMessages.length > 0) {
      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
      return;
    }
    if (messages.data?.length && positionedProjectRef.current !== projectId) {
      requestAnimationFrame(() => {
        const userTurns = container.querySelectorAll<HTMLElement>('[data-message-role="user"]');
        const latestTurn = userTurns.item(userTurns.length - 1);
        container.scrollTo({ top: Math.max(0, (latestTurn?.offsetTop ?? container.scrollHeight) - 26), behavior: "auto" });
        positionedProjectRef.current = projectId;
      });
    }
  }, [projectId, messages.data, draftMessages, chat.isPending]);

  useEffect(() => {
    if (!selectedRunId && runs.data?.[0]) setSelectedRunId(runs.data[0].id);
  }, [runs.data, selectedRunId]);

  useEffect(() => {
    const panel = searchParams.get("panel");
    if (panel === "report") {
      setContextTab("report");
      if (!canvasReport && reports.data?.[0]) setCanvasReport(reports.data[0]);
    }
  }, [searchParams, reports.data, canvasReport]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const value = message.trim();
    if (!value || chat.isPending) return;
    setDraftMessages([{ id: "draft", project_id: projectId, role: "user", intent: null, content: value, tool_calls: [], artifacts: [], created_at: new Date().toISOString() }]);
    setMessage("");
    chat.mutate({
      value,
      sourceIds: selectedSourceIds,
      skillIds: [],
    });
  }

  function retryRun(run: AnalysisRun) {
    if (chat.isPending) return;
    setDraftMessages([{ id: `retry-${run.id}`, project_id: projectId, role: "user", intent: null, content: run.title, tool_calls: [], artifacts: [], created_at: new Date().toISOString() }]);
    chat.mutate({ value: run.title, sourceIds: run.source_ids, skillIds: run.skill_ids, retryOfRunId: run.id });
  }

  function chooseTab(tab: ContextTab) {
    setContextCollapsed(false);
    setContextTab(tab);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (tab === "run") next.delete("panel"); else next.set("panel", tab);
      return next;
    }, { replace: true });
  }

  const allMessages = [...(messages.data ?? []), ...draftMessages];
  const selectedRun = runs.data?.find((run) => run.id === selectedRunId) ?? runs.data?.[0] ?? null;
  return (
    <div className={`conversation-layout context-tab-${contextTab} ${contextCollapsed ? "context-collapsed" : ""}`}>
      <section className="conversation-column">
        <header className="conversation-header"><div><span className="eyebrow">ANALYSIS PROJECT</span><h1>{project.data?.title ?? "分析对话"}</h1><p>{sources.data?.length ? `${sources.data.map((source) => source.name).slice(0, 2).join(" · ")}${sources.data.length > 2 ? ` 等 ${sources.data.length} 个数据源` : ""}` : "尚未关联数据，可先普通对话"}</p></div><div className="conversation-status"><StatusPill tone={sources.data?.length ? "good" : "warn"}><Database size={13} />{sources.data?.length ? "数据已就绪" : "未连接数据"}</StatusPill><button className="button secondary compact" onClick={() => setWorkbenchTab("data")}><Database size={14} />项目数据</button><button className="button secondary compact" onClick={() => setWorkbenchTab("chart")}><Layers3 size={14} />分析工具</button>{contextCollapsed && <button className="icon-button context-toggle" aria-label="展开项目上下文" onClick={() => setContextCollapsed(false)}><ChevronLeft size={16} /></button>}</div></header>

        <div className="message-scroll" ref={messageScrollRef}>
          {messages.isLoading && <LoadingState label="恢复项目对话" />}
          {!messages.isLoading && allMessages.length === 0 && <ConversationWelcome projectId={projectId} hasSources={Boolean(sources.data?.length)} onSuggestion={setMessage} />}
          {allMessages.map((item) => <MessageBubble key={item.id} message={item} artifacts={artifacts.data ?? []} projectId={projectId} onOpenReport={() => { if (reports.data?.[0]) setCanvasReport(reports.data[0]); chooseTab("report"); }} onOpenArtifact={(artifactId) => { setSelectedArtifactId(artifactId); chooseTab("results"); }} />)}
          {chat.isPending && (
            <div className="message-row assistant">
              <span className="avatar"><Bot size={16} /></span>
              <div className="message-bubble">
                <div className="agent-activity">
                  <span className="activity-pulse" />
                  <div><b>{streamActivity}</b><small>普通对话不会访问数据；分析任务只调用当前项目工具。</small></div>
                </div>
                {Object.values(streamTools).length > 0 && <div className="tool-strip"><span><Sparkles size={13} />实时工具</span>{Object.values(streamTools).map((tool) => <code key={tool.name}>{tool.name} · {tool.state}</code>)}</div>}
                {streamText && <MessageMarkdown content={streamText} className="stream-draft" />}
                {streamError && <p className="stream-error">{streamError}</p>}
              </div>
            </div>
          )}
          {chat.error && <ErrorState error={chat.error} />}
        </div>

        <form className="composer" onSubmit={submit}>
          <div className="composer-context">
            <span>本轮数据</span>
            <button type="button" className={selectedSourceIds.length === 0 ? "active" : ""} onClick={() => setSelectedSourceIds([])}>全部</button>
            {sources.data?.map((source) => <button type="button" key={source.id} className={selectedSourceIds.includes(source.id) ? "active" : ""} onClick={() => setSelectedSourceIds((current) => current.includes(source.id) ? current.filter((id) => id !== source.id) : [...current, source.id])}>{source.name}</button>)}
          </div>
          <textarea value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} placeholder={sources.data?.length ? "询问数据、创建图表、训练模型或生成报告…" : "普通对话，或先连接数据后开始分析…"} />
          <button className="send-button" disabled={!message.trim() || chat.isPending}><Send size={17} /></button>
          <span className="composer-foot">DeepSeek-V4-Flash · 本轮数据可控 · Enter 发送</span>
        </form>
      </section>
      <ProjectContextPanel
        tab={contextTab}
        onTab={chooseTab}
        run={selectedRun}
        runs={runs.data ?? []}
        onSelectRun={setSelectedRunId}
        artifacts={artifacts.data ?? []}
        selectedArtifactId={selectedArtifactId}
        onSelectArtifact={setSelectedArtifactId}
        report={canvasReport ?? reports.data?.[0] ?? null}
        reports={reports.data ?? []}
        onSelectReport={setCanvasReport}
        projectId={projectId}
        onCloseReport={() => chooseTab("run")}
        onCreateReport={() => createReport.mutate()}
        createReportPending={createReport.isPending}
        onCancel={(runId) => cancelRun.mutate(runId)}
        onRetry={retryRun}
        onCollapse={() => setContextCollapsed(true)}
      />
      {workbenchTab && <ProjectWorkbenchModal projectId={projectId} initialTab={workbenchTab} sources={sources.data ?? []} artifacts={artifacts.data ?? []} selectedSourceIds={selectedSourceIds} onSelectedSourceIds={setSelectedSourceIds} onClose={() => setWorkbenchTab(null)} onArtifactsChanged={() => client.invalidateQueries({ queryKey: ["artifacts", projectId] })} onSourcesChanged={() => client.invalidateQueries({ queryKey: ["sources", projectId] })} onOpenArtifact={(artifactId) => { setSelectedArtifactId(artifactId); chooseTab("results"); setWorkbenchTab(null); }} />}
    </div>
  );
}

function ConversationWelcome({ projectId, hasSources, onSuggestion }: { projectId: string; hasSources: boolean; onSuggestion: (value: string) => void }) {
  return <div className="conversation-welcome"><span className="welcome-orbit"><Sparkles /></span><h2>{hasSources ? "数据已经就绪，想先回答哪个业务问题？" : "这是一个全新的独立分析空间。"}</h2><p>{hasSources ? "我会先检查字段与口径，再运行查询或模型，并把每个结果保存成可追溯产物。" : "你可以先普通对话；关联数据后，数据问题才会触发查询、分析与建模。"}</p>{!hasSources && <Link className="button primary" to={`/projects/${projectId}/sources`}>连接数据源<ChevronRight size={15} /></Link>}<div className="prompt-suggestions"><button onClick={() => onSuggestion("梳理这份数据能回答哪些业务问题")}>梳理这份数据能回答哪些业务问题</button><button onClick={() => onSuggestion("检查数据质量并给出清洗建议")}>检查数据质量并给出清洗建议</button><button onClick={() => onSuggestion("生成一份完整数据分析报告")}>生成一份完整数据分析报告</button></div></div>;
}

function ProjectWorkbenchModal({ projectId, initialTab, sources, artifacts, selectedSourceIds, onSelectedSourceIds, onClose, onArtifactsChanged, onSourcesChanged, onOpenArtifact }: {
  projectId: string;
  initialTab: "data" | "chart" | "model" | "artifacts";
  sources: Source[];
  artifacts: Artifact[];
  selectedSourceIds: string[];
  onSelectedSourceIds: (ids: string[]) => void;
  onClose: () => void;
  onArtifactsChanged: () => void;
  onSourcesChanged: () => void;
  onOpenArtifact: (id: string) => void;
}) {
  const [tab, setTab] = useState(initialTab);
  const tabular = artifacts.filter((item) => ["extract", "derived", "predictions"].includes(item.type));
  const [artifactId, setArtifactId] = useState(tabular[0]?.id ?? "");
  const artifact = tabular.find((item) => item.id === artifactId) ?? tabular[0];
  const columns = (artifact?.metadata.columns as string[] | undefined) ?? [];
  const rows = (artifact?.metadata.preview as Record<string, unknown>[] | undefined) ?? [];
  const numeric = columns.filter((column) => rows.some((row) => typeof row[column] === "number"));
  const [chartType, setChartType] = useState("bar");
  const [x, setX] = useState(columns[0] ?? "");
  const [y, setY] = useState(numeric[0] ?? "");
  const [target, setTarget] = useState(columns.at(-1) ?? "");
  const [algorithm, setAlgorithm] = useState("random_forest");
  useEffect(() => { setX(columns[0] ?? ""); setY(numeric[0] ?? ""); setTarget(columns.at(-1) ?? ""); }, [artifactId]);
  const chart = useMutation({ mutationFn: () => api.chart(projectId, { artifact_id: artifact!.id, chart_type: chartType, x, y: [y], title: `${artifact!.name} · ${x} × ${y}` }), onSuccess: () => { onArtifactsChanged(); } });
  const model = useMutation({ mutationFn: () => api.model(projectId, { artifact_id: artifact!.id, task: "classification", target, features: columns.filter((column) => column !== target), algorithm, name: `${algorithm} · ${target}`, random_state: 42, tune: false }), onSuccess: () => onArtifactsChanged() });
  const upload = useMutation({ mutationFn: (file: File) => api.uploadSource(projectId, file.name.toLowerCase().endsWith(".xlsx") || file.name.toLowerCase().endsWith(".xls") ? "excel" : file.name.toLowerCase().endsWith(".db") || file.name.toLowerCase().endsWith(".sqlite") ? "sqlite" : "csv", file), onSuccess: () => onSourcesChanged() });
  return <div className="modal-backdrop project-workbench-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="project-workbench-modal" role="dialog" aria-modal="true" aria-label="项目分析工作台"><header><div><span className="eyebrow">PROJECT WORKBENCH</span><h2>本项目的分析控制台</h2><p>不离开对话，管理本轮数据、创建字段图表、启动模型并查看可追溯产物。</p></div><button className="icon-button" onClick={onClose} aria-label="关闭"><X size={18} /></button></header><nav>{[
    ["data", "项目数据", Database], ["chart", "图表工作室", BarChart3], ["model", "建模实验", FlaskConical], ["artifacts", "项目产物", FileText],
  ].map(([key, label, Icon]) => <button key={String(key)} className={tab === key ? "active" : ""} onClick={() => setTab(key as typeof tab)}><Icon size={15} />{String(label)}</button>)}</nav><div className="project-workbench-body">
    {tab === "data" && <section className="workbench-data"><div className="workbench-intro"><h3>决定本轮 Agent 可以使用哪些数据</h3><p>“自动选择”会让 Agent 根据问题挑选当前项目数据；也可以明确锁定一个或多个来源。</p><button className={selectedSourceIds.length === 0 ? "active" : ""} onClick={() => onSelectedSourceIds([])}>自动选择全部可用数据</button></div><div className="workbench-source-list">{sources.map((source) => <label key={source.id} className={selectedSourceIds.includes(source.id) ? "selected" : ""}><input type="checkbox" checked={selectedSourceIds.includes(source.id)} onChange={() => onSelectedSourceIds(selectedSourceIds.includes(source.id) ? selectedSourceIds.filter((id) => id !== source.id) : [...selectedSourceIds, source.id])} /><span><b>{source.name}</b><small>{source.type.toUpperCase()} · {source.status} · {sourceSize(source)}</small></span><StatusPill tone={source.status === "ready" ? "good" : "warn"}>{source.status === "ready" ? "可分析" : "需复核"}</StatusPill></label>)}</div><label className="workbench-upload"><UploadCloud size={22} /><span><b>添加本地数据</b><small>CSV、Excel 或 SQLite；文件只进入当前项目工作区。</small></span><input type="file" accept=".csv,.xlsx,.xls,.sqlite,.db" onChange={(event) => { const file = event.target.files?.[0]; if (file) upload.mutate(file); }} /></label></section>}
    {tab === "chart" && <section className="workbench-tool"><div><span className="eyebrow">FIELD-DRIVEN CHART</span><h3>按字段组合创建交互图表</h3><p>选择任一查询或衍生数据产物，再自由指定维度、指标与图表类型。保存后会成为可追溯 visual 产物。</p></div>{artifact ? <><div className="workbench-form-grid"><label>数据产物<select value={artifact.id} onChange={(event) => setArtifactId(event.target.value)}>{tabular.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>图表类型<select value={chartType} onChange={(event) => setChartType(event.target.value)}>{["bar", "line", "area", "scatter", "pie", "boxplot", "heatmap"].map((item) => <option key={item}>{item}</option>)}</select></label><label>维度字段<select value={x} onChange={(event) => setX(event.target.value)}>{columns.map((column) => <option key={column}>{column}</option>)}</select></label><label>数值字段<select value={y} onChange={(event) => setY(event.target.value)}>{numeric.map((column) => <option key={column}>{column}</option>)}</select></label></div><div className="workbench-preview"><ReactECharts option={buildArtifactChartOption(rows.slice(0, 100), x, y, chartType, "light")} style={{ height: 300 }} notMerge /></div><button className="button primary" disabled={!x || !y || chart.isPending} onClick={() => chart.mutate()}><Save size={14} />{chart.isPending ? "正在保存…" : "保存为项目图表"}</button>{chart.isSuccess && <p className="workbench-success">图表已保存，可在“项目产物”和会话结果中继续使用。</p>}</> : <WorkbenchEmpty title="先生成一份数据结果" text="在对话中提出查询或探索问题，得到表格产物后即可自由选择字段制图。" />}</section>}
    {tab === "model" && <section className="workbench-tool"><div><span className="eyebrow">MODEL LAB</span><h3>从已确认的数据片段启动模型实验</h3><p>目标字段与特征均来自所选产物；每次训练会保存代码、指标、模型与血缘。</p></div>{artifact ? <><div className="workbench-form-grid"><label>训练数据<select value={artifact.id} onChange={(event) => setArtifactId(event.target.value)}>{tabular.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>目标字段<select value={target} onChange={(event) => setTarget(event.target.value)}>{columns.map((column) => <option key={column}>{column}</option>)}</select></label><label>算法<select value={algorithm} onChange={(event) => setAlgorithm(event.target.value)}>{["logistic_regression", "random_forest", "gradient_boosting", "soft_voting"].map((item) => <option key={item}>{item}</option>)}</select></label><div className="workbench-feature-summary"><b>{Math.max(0, columns.length - 1)} 个候选特征</b><small>{columns.filter((column) => column !== target).slice(0, 6).join(" · ")}</small></div></div><button className="button primary" onClick={() => model.mutate()} disabled={!target || model.isPending}><Play size={14} />{model.isPending ? "正在训练…" : "启动模型实验"}</button>{model.isSuccess && <p className="workbench-success">模型、训练代码和指标已写入项目产物。</p>}</> : <WorkbenchEmpty title="还没有可训练的数据片段" text="先通过对话或 SQL 生成包含目标字段的明细数据，再回到这里建模。" />}</section>}
    {tab === "artifacts" && <section className="workbench-artifacts"><header><h3>{artifacts.length} 项项目产物</h3><p>查询、图表、特征、模型、预测与报告都按时间保留。</p></header><div>{artifacts.slice(0, 30).map((item) => <button key={item.id} onClick={() => onOpenArtifact(item.id)}><span className={`artifact-kind ${item.type}`}>{item.type}</span><span><b>{item.name}</b><small>{new Date(item.created_at).toLocaleString("zh-CN")}</small></span><ChevronRight size={15} /></button>)}</div></section>}
  </div></section></div>;
}

function WorkbenchEmpty({ title, text }: { title: string; text: string }) { return <div className="workbench-empty"><Sparkles size={24} /><h3>{title}</h3><p>{text}</p></div>; }

function sourceSize(source: Source) {
  const baseline = source.baseline;
  const value = baseline.rows ?? baseline.table_count ?? baseline.sheet_count;
  return value ? `${Number(value).toLocaleString()} ${baseline.rows ? "行" : "个数据单元"}` : "已建立基线";
}

export function ProjectContextPanel({ tab, onTab, run, runs, onSelectRun, artifacts, selectedArtifactId, onSelectArtifact, report, reports = [], onSelectReport = () => undefined, projectId, onCloseReport, onCreateReport, createReportPending, onCancel, onRetry, onCollapse = () => undefined }: {
  tab: ContextTab;
  onTab: (tab: ContextTab) => void;
  run: AnalysisRun | null;
  runs: AnalysisRun[];
  onSelectRun: (id: string) => void;
  artifacts: Artifact[];
  selectedArtifactId: string;
  onSelectArtifact: (id: string) => void;
  report: ReportVersion | null;
  reports?: ReportVersion[];
  onSelectReport?: (report: ReportVersion) => void;
  projectId: string;
  onCloseReport: () => void;
  onCreateReport: () => void;
  createReportPending: boolean;
  onCancel: (runId: string) => void;
  onRetry: (run: AnalysisRun) => void;
  onCollapse?: () => void;
}) {
  const runArtifacts = (run?.artifact_ids ?? []).map((id) => artifacts.find((item) => item.id === id)).filter((item): item is Artifact => Boolean(item));
  const selectedArtifact = runArtifacts.find((item) => item.id === selectedArtifactId) ?? runArtifacts[0] ?? null;
  return <aside className={`project-context project-context-${tab}`}>
    <nav className="context-tabs" aria-label="项目上下文">
      <button className={tab === "run" ? "active" : ""} onClick={() => onTab("run")}><Play size={14} /><span>运行</span>{run?.status === "running" && <i />}</button>
      <button className={tab === "results" ? "active" : ""} onClick={() => onTab("results")}><Layers3 size={14} /><span>结果</span>{runArtifacts.length > 0 && <em>{runArtifacts.length}</em>}</button>
      <button className={tab === "report" ? "active" : ""} onClick={() => onTab("report")}><FileText size={14} /><span>报告</span>{report && <em>{reports.length || 1}</em>}</button>
      <button className="context-panel-close" aria-label="收起项目上下文" onClick={onCollapse}><ChevronRight size={17} /></button>
    </nav>
    {tab === "run" && <div className="run-panel">
      {runs.length > 1 && <label className="run-history-select"><span>当前运行</span><select value={run?.id ?? ""} onChange={(event) => onSelectRun(event.target.value)}>{runs.map((item) => <option key={item.id} value={item.id}>{runStatusLabel(item.status)} · {item.title.slice(0, 28)}</option>)}</select></label>}
      {!run && <div className="context-empty"><Play size={24} /><h2>尚无分析运行</h2><p>普通对话不会创建运行。询问数据、图表、模型或报告后，这里会显示真实执行步骤。</p></div>}
      {run && <>
        <section className={`run-status-card ${run.status}`}><span>{runStatusIcon(run.status)}</span><div><small>本轮分析</small><h2>{runStatusLabel(run.status)}</h2><p>{run.cancel_requested && run.status === "running" ? "已请求取消，将在当前工具结束后停止" : run.error ?? `${formatDuration(run.started_at, run.completed_at)} · ${run.runtime === "deep-agents" ? "Deep Agents" : "本地路径"}`}</p></div></section>
        <section className="run-goal"><span className="eyebrow">TASK</span><p>{run.title}</p></section>
        <section className="run-steps"><header><h2>执行步骤</h2><span>{run.steps.filter((step) => step.status === "succeeded").length} / {run.steps.length}</span></header>{run.steps.map((step) => <article key={step.id} className={step.status}><span>{stepIcon(step.status)}</span><div><b>{step.label}</b><small>{step.tool_names.length ? humanToolNames(step.tool_names).join(" · ") : step.status === "pending" ? "等待执行" : step.status === "skipped" ? "本轮无需执行" : "已完成"}</small>{step.error && <p>{step.error}</p>}</div><time>{step.started_at ? formatDuration(step.started_at, step.completed_at) : ""}</time></article>)}</section>
        {runArtifacts.length > 0 && <section className="run-output"><span className="eyebrow">OUTPUT</span><button onClick={() => { onSelectArtifact(runArtifacts[0].id); onTab("results"); }}><BarChart3 size={18} /><span><b>{runArtifacts[0].name}</b><small>{runArtifacts.length} 项结果已绑定到本轮运行</small></span><ChevronRight size={15} /></button></section>}
        <div className="run-actions">{run.status === "running" && <button className="button secondary" onClick={() => onCancel(run.id)} disabled={run.cancel_requested}><Square size={14} />{run.cancel_requested ? "已请求取消" : "取消运行"}</button>}{["failed", "cancelled"].includes(run.status) && <button className="button secondary" onClick={() => onRetry(run)}><RotateCcw size={14} />从中断步骤重试</button>}<button className="button primary" onClick={onCreateReport} disabled={createReportPending || run.status === "running" || runArtifacts.length === 0}><FileText size={14} />生成报告</button></div>
      </>}
    </div>}
    {tab === "results" && <div className="context-results">
      {!run || runArtifacts.length === 0 ? <div className="context-empty"><BarChart3 size={24} /><h2>本轮暂无结果</h2><p>查询、图表、模型和预测结果会与运行绑定并出现在这里。</p></div> : <><header><div><span className="eyebrow">RUN RESULTS</span><h2>{runArtifacts.length} 项可追溯结果</h2></div><select value={selectedArtifact?.id ?? ""} onChange={(event) => onSelectArtifact(event.target.value)}>{runArtifacts.map((artifact) => <option key={artifact.id} value={artifact.id}>{artifact.name}</option>)}</select></header>{selectedArtifact && <MessageArtifactCard artifactId={selectedArtifact.id} artifacts={artifacts} projectId={projectId} />}</>}
    </div>}
    {tab === "report" && (report ? <ReportCanvas projectId={projectId} report={report} reports={reports} onSelectReport={onSelectReport} onClose={onCloseReport} /> : <div className="context-empty report-empty"><FileText size={25} /><h2>把本轮分析整理成报告</h2><p>报告以 Markdown 为真相源，支持 HTML、不可变版本、前后切换与恢复。</p><button className="button primary" onClick={onCreateReport} disabled={createReportPending}><FileText size={14} />{createReportPending ? "正在生成…" : "生成完整报告"}</button></div>)}
  </aside>;
}

function runStatusLabel(status: AnalysisRun["status"]) {
  return { running: "运行中", succeeded: "已完成", failed: "运行失败", cancelled: "已取消" }[status];
}

function runStatusIcon(status: AnalysisRun["status"]) {
  if (status === "succeeded") return <Check size={19} />;
  if (status === "running") return <Sparkles size={19} />;
  return <XCircle size={19} />;
}

function stepIcon(status: AnalysisRun["steps"][number]["status"]) {
  if (status === "succeeded") return <Check size={13} />;
  if (status === "failed") return <XCircle size={13} />;
  if (status === "running") return <Sparkles size={13} />;
  return <Circle size={11} />;
}

function formatDuration(start: string, end: string | null) {
  const seconds = Math.max(0, Math.round(((end ? new Date(end).getTime() : Date.now()) - new Date(start).getTime()) / 1_000));
  if (seconds < 60) return `${seconds} 秒`;
  return `${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`;
}

function humanToolNames(names: string[]) {
  const labels: Record<string, string> = { list_data_sources: "检查数据源", list_project_artifacts: "检查产物", run_read_only_query: "只读查询", profile_data: "数据画像", clean_data: "数据清洗", engineer_features: "特征工程", create_visual: "交互图表", train_model: "模型训练", predict_model: "模型预测", run_project_skill: "运行 Skill", create_complete_report: "完整报告", revise_report: "报告修订", restore_report: "版本恢复", render_report_html: "生成 HTML" };
  return names.map((name) => labels[name] ?? name.replaceAll("_", " "));
}

export function MessageBubble({ message, artifacts, projectId, onOpenReport, onOpenArtifact = () => undefined }: { message: Message; artifacts: Artifact[]; projectId: string; onOpenReport: () => void; onOpenArtifact?: (artifactId: string) => void }) {
  const assistant = message.role === "assistant";
  const visibleArtifacts = message.artifacts.filter((artifactId) => artifacts.find((item) => item.id === artifactId)?.type !== "agent_run");
  const primaryArtifactId = visibleArtifacts.find((artifactId) => artifacts.find((item) => item.id === artifactId)?.type === "visual") ?? visibleArtifacts[0];
  const secondaryArtifacts = visibleArtifacts.filter((artifactId) => artifactId !== primaryArtifactId).map((artifactId) => artifacts.find((item) => item.id === artifactId)).filter((item): item is Artifact => Boolean(item));
  return <div className={`message-row ${assistant ? "assistant" : "user"}`} data-message-role={message.role}><span className="avatar">{assistant ? <Bot size={16} /> : <User size={16} />}</span><div className="message-bubble">{assistant && <header><b>DS4 AI</b><span>{new Date(message.created_at).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</span></header>}<MessageMarkdown content={message.content} />{assistant && message.tool_calls.length > 0 && <section className="analysis-execution-summary"><header><span><Sparkles size={14} />执行摘要</span><b>已完成</b></header><div>{humanToolNames(message.tool_calls).slice(0, 4).map((tool, index) => <span key={`${tool}-${index}`}><i>{index + 1}</i><small>{tool}</small><Check size={13} /></span>)}</div></section>}{primaryArtifactId && <div className="message-primary-artifact" onDoubleClick={() => onOpenArtifact(primaryArtifactId)}><MessageArtifactCard artifactId={primaryArtifactId} artifacts={artifacts} projectId={projectId} /></div>}{secondaryArtifacts.length > 0 && <details className="artifact-bundle"><summary><Layers3 size={14} /><span>其余 {secondaryArtifacts.length} 项分析产物</span><small>表格、图表、模型与预测均已保存</small><ChevronRight size={14} /></summary><div>{secondaryArtifacts.map((artifact) => <button key={artifact.id} onClick={() => onOpenArtifact(artifact.id)}><span>{artifact.type.toUpperCase()}</span><b>{artifact.name}</b><ChevronRight size={14} /></button>)}</div></details>}{assistant && message.intent === "reporting" && <button className="report-result-card" onClick={onOpenReport}><span><FileText size={20} /></span><div><b>完整数据分析报告</b><small>Markdown · 版本化 · 可生成 HTML</small></div><ChevronRight size={17} /></button>}</div></div>;
}

function MessageMarkdown({ content, className = "" }: { content: string; className?: string }) {
  return <div className={`message-markdown ${className}`.trim()}><ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown></div>;
}

export function MessageArtifactCard({ artifactId, artifacts, projectId }: { artifactId: string; artifacts: Artifact[]; projectId: string }) {
  const artifact = artifacts.find((item) => item.id === artifactId);
  const source = artifact?.type === "visual" ? artifacts.find((item) => item.id === artifact.lineage[0]) : artifact;
  const { resolved: colorMode } = useColorMode();
  const [view, setView] = useState<"table" | "chart" | "summary">(artifact?.type === "visual" ? "chart" : "table");
  const [page, setPage] = useState(0);
  const [sortBy, setSortBy] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [filterColumn, setFilterColumn] = useState("");
  const [filterValue, setFilterValue] = useState("");
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
  const [chartType, setChartType] = useState(String(artifact?.metadata.chart_type ?? "bar"));
  const [xColumn, setXColumn] = useState(String(artifact?.metadata.x ?? ""));
  const [yColumn, setYColumn] = useState(String((artifact?.metadata.y as string[] | undefined)?.[0] ?? ""));
  const [chartSettingsOpen, setChartSettingsOpen] = useState(false);
  const chartRef = useRef<ReactECharts>(null);
  useEffect(() => {
    if (artifact?.type === "visual") setView("chart");
  }, [artifact?.id, artifact?.type]);
  const tabular = Boolean(source && ["extract", "derived", "predictions"].includes(source.type));
  const pagedData = useQuery({
    queryKey: ["artifact-data", projectId, source?.id, page, sortBy, sortOrder, filterColumn, filterValue],
    queryFn: () => api.artifactData(projectId, source!.id, { offset: page * 25, limit: 25, sortBy: sortBy || undefined, sortOrder, filterColumn: filterColumn || undefined, filterValue: filterValue || undefined }),
    enabled: tabular && artifact?.type !== "visual",
  });
  const visualData = useQuery({
    queryKey: ["visual-data", projectId, artifact?.id],
    queryFn: () => api.visualData(projectId, artifact!.id),
    enabled: artifact?.type === "visual",
  });
  const rawRows = (artifact?.type === "visual" ? visualData.data?.rows : pagedData.data?.rows) ?? source?.metadata.preview;
  const rawColumns = (artifact?.type === "visual" ? visualData.data?.columns : pagedData.data?.columns) ?? source?.metadata.columns;
  const rows = Array.isArray(rawRows) ? rawRows.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object" && !Array.isArray(row)) : [];
  const columns = Array.isArray(rawColumns) ? rawColumns.map(String) : [];
  const visibleColumns = columns.filter((column) => !hiddenColumns.includes(column));
  const numeric = columns.find((column) => rows.some((row) => typeof row[column] === "number"));
  const category = columns.find((column) => column !== numeric) ?? columns[0];
  const selectedX = columns.includes(xColumn) ? xColumn : (category ?? "");
  const selectedY = columns.includes(yColumn) ? yColumn : (numeric ?? "");
  const chartRows = artifact?.type === "visual" ? rows : rows.slice(0, 100);
  const option = buildArtifactChartOption(chartRows, selectedX, selectedY, chartType, colorMode);
  const saveChart = useMutation({ mutationFn: () => api.chart(projectId, { artifact_id: source!.id, chart_type: chartType, x: selectedX, y: [selectedY], title: `${source!.name} · ${chartType}` }) });
  const exportImage = () => {
    const url = chartRef.current?.getEchartsInstance().getDataURL({ type: "png", pixelRatio: 2, backgroundColor: colorMode === "light" ? "#fffaf3" : "#111313" });
    if (!url) return;
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${source?.name ?? "northlight-chart"}.png`;
    anchor.click();
  };
  if (!artifact) return <div className="message-artifact missing">产物 {artifactId} 尚未载入</div>;
  const visualScope = visualData.data?.scope;
  const displayedRows = artifact.type === "visual" ? rows.slice(page * 25, page * 25 + 25) : rows;
  const totalRows = artifact.type === "visual" ? rows.length : (pagedData.data?.total ?? 0);
  const scopeText = artifact.type === "visual" && visualScope ? `使用 ${visualScope.rows_used} / ${visualScope.total_rows ?? visualScope.rows_used} 行${visualScope.truncated ? " · 已披露截取范围" : " · 完整结果"}` : `当前页 ${rows.length} 行 · 共 ${totalRows} 行`;
  return <section className="message-artifact interactive-result"><header><div><span>{artifact.type.toUpperCase()}</span><b>{artifact.name}</b><small>{scopeText}</small></div>{tabular && <div className="artifact-view-switch"><button aria-label="产物图表视图" className={view === "chart" ? "active" : ""} onClick={() => setView("chart")} disabled={!numeric}><BarChart3 size={14} /><span>图表</span></button><button aria-label="产物表格视图" className={view === "table" ? "active" : ""} onClick={() => setView("table")}><Table2 size={14} /><span>表格</span></button><button aria-label="产物摘要视图" className={view === "summary" ? "active" : ""} onClick={() => setView("summary")}><Sparkles size={14} /><span>摘要</span></button></div>}</header>
    {tabular && view === "table" && <div className="result-toolbar"><select aria-label="筛选字段" value={filterColumn} onChange={(event) => { setFilterColumn(event.target.value); setPage(0); }} disabled={artifact.type === "visual"}><option value="">筛选字段</option>{columns.map((column) => <option key={column}>{column}</option>)}</select><input aria-label="筛选值" value={filterValue} onChange={(event) => { setFilterValue(event.target.value); setPage(0); }} placeholder={artifact.type === "visual" ? "图表数据范围已锁定" : "包含…"} disabled={!filterColumn || artifact.type === "visual"} /><details><summary><Columns3 size={13} />列</summary><div>{columns.map((column) => <label key={column}><input type="checkbox" checked={!hiddenColumns.includes(column)} onChange={() => setHiddenColumns((current) => current.includes(column) ? current.filter((item) => item !== column) : [...current, column])} />{column}</label>)}</div></details><a href={api.artifactDownloadUrl(projectId, source!.id)} download><Download size={13} />数据</a></div>}
    {tabular && view === "table" && <>{pagedData.isLoading || visualData.isLoading ? <LoadingState label="载入结果页" /> : <div className="message-table"><table><thead><tr>{visibleColumns.map((column) => <th key={column}><button onClick={() => { if (artifact.type === "visual") return; setSortOrder(sortBy === column && sortOrder === "asc" ? "desc" : "asc"); setSortBy(column); setPage(0); }}>{column}{sortBy === column ? sortOrder === "asc" ? " ↑" : " ↓" : ""}</button></th>)}</tr></thead><tbody>{displayedRows.map((row, index) => <tr key={index}>{visibleColumns.map((column) => <td key={column}>{String(row[column] ?? "—")}</td>)}</tr>)}</tbody></table></div>}<div className="result-pagination"><span>{totalRows.toLocaleString()} 行 · 第 {page + 1} 页</span><button disabled={page === 0} onClick={() => setPage((current) => current - 1)}><ChevronLeft size={13} /></button><button disabled={(page + 1) * 25 >= totalRows} onClick={() => setPage((current) => current + 1)}><ChevronRight size={13} /></button></div></>}
    {tabular && view === "chart" && <div className="artifact-chart-reading"><div className="artifact-chart-reading-head"><span><b>{selectedY || "指标"}</b><small>按 {selectedX || "维度"} 展示 · {chartRows.length.toLocaleString()} 个数据点</small></span><div><button aria-label="调整图表" aria-expanded={chartSettingsOpen} className={chartSettingsOpen ? "active" : ""} onClick={() => setChartSettingsOpen((current) => !current)}><SlidersHorizontal size={13} />调整图表</button><button aria-label="图片" onClick={exportImage}><ImageDown size={13} />图片</button></div></div>{chartSettingsOpen && <div className="chart-config chart-config-expanded"><select aria-label="图表类型" value={chartType} onChange={(event) => setChartType(event.target.value)}>{["bar", "line", "area", "scatter", "pie", "boxplot", "heatmap"].map((type) => <option key={type}>{type}</option>)}</select><select aria-label="横轴字段" value={selectedX} onChange={(event) => setXColumn(event.target.value)}>{columns.map((column) => <option key={column}>{column}</option>)}</select><select aria-label="数值字段" value={selectedY} onChange={(event) => setYColumn(event.target.value)}>{columns.filter((column) => rows.some((row) => typeof row[column] === "number")).map((column) => <option key={column}>{column}</option>)}</select><button onClick={() => saveChart.mutate()} disabled={!selectedX || !selectedY || saveChart.isPending}><Save size={13} />保存视图</button></div>}<div className="artifact-chart-stage"><ReactECharts ref={chartRef} option={option} style={{ height: 280 }} notMerge /></div></div>}
    {tabular && view === "summary" && <div className="artifact-summary"><span><b>{totalRows.toLocaleString()}</b><small>结果行</small></span><span><b>{columns.length}</b><small>字段</small></span><span><b>{numeric ? "可视化" : "表格"}</b><small>推荐视图</small></span><p>{visualScope?.truncated ? `图表按 ${visualScope.strategy} 策略使用 ${visualScope.rows_used} 行；未使用的数据没有被静默纳入结论。` : "图表、表格与摘要共享同一份结果数据，切换视图不会改变分析口径。"}</p></div>}
    {!tabular && <p className="artifact-receipt">已保存可追溯产物 · {artifact.sha256.slice(0, 12)} · 血缘 {artifact.lineage.length} 项</p>}
    <Link to={`/projects/${projectId}/artifacts`}>查看产物详情 <ChevronRight size={13} /></Link></section>;
}

function buildArtifactChartOption(rows: Record<string, unknown>[], x: string, y: string, type: string, colorMode: "light" | "dark") {
  const labels = rows.map((row) => String(row[x] ?? ""));
  const values = rows.map((row) => Number(row[y] ?? 0));
  const axisStyle = { color: colorMode === "light" ? "#6f6257" : "#c6beb2", fontSize: 12.5, fontFamily: "Inter, sans-serif" };
  const base = { backgroundColor: "transparent", grid: { left: 50, right: 20, top: 32, bottom: 45 }, tooltip: { trigger: type === "scatter" ? "item" : "axis" }, textStyle: axisStyle };
  if (type === "pie") return { ...base, tooltip: { trigger: "item" }, series: [{ type: "pie", radius: ["38%", "72%"], data: labels.map((name, index) => ({ name, value: values[index] })), itemStyle: { borderColor: colorMode === "light" ? "#fffaf3" : "#111313", borderWidth: 2 } }] };
  if (type === "scatter") return { ...base, xAxis: { type: "category", data: labels, axisLabel: axisStyle }, yAxis: { type: "value", axisLabel: axisStyle }, series: [{ type: "scatter", data: values, symbolSize: 11, itemStyle: { color: "#e49a45" } }] };
  if (type === "heatmap") return { ...base, xAxis: { type: "category", data: labels, axisLabel: axisStyle }, yAxis: { type: "category", data: [y], axisLabel: axisStyle }, visualMap: { min: Math.min(...values), max: Math.max(...values), orient: "horizontal", left: "center", bottom: 0, inRange: { color: ["#282725", "#cb792d", "#f1c27d"] } }, series: [{ type: "heatmap", data: values.map((value, index) => [index, 0, value]) }] };
  if (type === "boxplot") return { ...base, xAxis: { type: "category", data: [y], axisLabel: axisStyle }, yAxis: { type: "value", axisLabel: axisStyle }, series: [{ type: "boxplot", data: [boxplot(values)], itemStyle: { color: "#cb792d", borderColor: "#f1c27d" } }] };
  return { ...base, xAxis: { type: "category", data: labels, axisLabel: axisStyle }, yAxis: { type: "value", axisLabel: axisStyle, splitLine: { lineStyle: { color: colorMode === "light" ? "rgba(79,58,39,.10)" : "rgba(239,229,215,.08)" } } }, series: [{ type: type === "area" ? "line" : type, areaStyle: type === "area" ? { opacity: 0.24 } : undefined, smooth: type !== "bar", data: values, itemStyle: { color: "#d98632", borderRadius: type === "bar" ? [5, 5, 0, 0] : undefined } }] };
}

function boxplot(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  const quantile = (ratio: number) => sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * ratio))] ?? 0;
  return [sorted[0] ?? 0, quantile(0.25), quantile(0.5), quantile(0.75), sorted.at(-1) ?? 0];
}
