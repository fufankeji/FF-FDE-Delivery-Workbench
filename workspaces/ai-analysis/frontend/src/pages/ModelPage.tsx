import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import ReactECharts from "echarts-for-react";
import { BrainCircuit, CheckCircle2, GitMerge, MessageSquarePlus, Play, Sparkles, Square } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { api } from "../api";
import { EmptyState, ErrorState, Metric, PageHeader, StatusPill, formatNumber } from "../components/Ui";
import { useColorMode } from "../design/colorMode";
import type { Artifact } from "../types";

const algorithms: Record<string, { value: string; label: string }[]> = {
  classification: [{ value: "random_forest", label: "Random Forest" }, { value: "logistic_regression", label: "Logistic Regression" }, { value: "gradient_boosting", label: "Gradient Boosting" }, { value: "soft_voting", label: "Soft Voting 融合" }, { value: "stacking", label: "Stacking 融合" }],
  regression: [{ value: "random_forest", label: "Random Forest" }, { value: "ridge", label: "Ridge" }, { value: "gradient_boosting", label: "Gradient Boosting" }, { value: "weighted_average", label: "加权平均融合" }, { value: "stacking", label: "Stacking 融合" }],
  clustering: [{ value: "kmeans", label: "K-Means" }],
};

export function ModelPage() {
  const { projectId = "" } = useParams();
  const client = useQueryClient();
  const artifacts = useQuery({ queryKey: ["artifacts", projectId], queryFn: () => api.artifacts(projectId) });
  const datasets = (artifacts.data ?? []).filter((item) => ["extract", "derived"].includes(item.type));
  const experiments = (artifacts.data ?? []).filter((item) => item.type === "model");
  const [artifactId, setArtifactId] = useState("");
  const [task, setTask] = useState("classification");
  const [target, setTarget] = useState("");
  const [algorithm, setAlgorithm] = useState("random_forest");
  const [tune, setTune] = useState(false);
  const [features, setFeatures] = useState<string[]>([]);
  const [result, setResult] = useState<Record<string, Artifact> | null>(null);
  const [jobId, setJobId] = useState("");
  const selected = datasets.find((item) => item.id === artifactId);
  const columns = useMemo(() => (selected?.metadata.columns as string[] | undefined) ?? [], [selected]);
  const selectedFeatures = features.filter((column) => column !== target);
  const run = useMutation({ mutationFn: () => api.startModelJob(projectId, { artifact_id: artifactId, task, target: task === "clustering" ? null : target, features: selectedFeatures, algorithm, name: `${task} · ${algorithm}`, random_state: 42, tune }), onSuccess: (job) => { setResult(null); setJobId(job.id); } });
  const job = useQuery({
    queryKey: ["model-job", projectId, jobId],
    queryFn: () => api.modelJob(projectId, jobId),
    enabled: Boolean(jobId),
    refetchInterval: (query) => query.state.data?.status === "running" ? 750 : false,
  });
  const cancel = useMutation({ mutationFn: () => api.cancelModelJob(projectId, jobId), onSuccess: () => job.refetch() });
  const predict = useMutation({ mutationFn: () => api.predict(projectId, result!.model.id, artifactId), onSuccess: () => client.invalidateQueries({ queryKey: ["artifacts", projectId] }) });
  const share = useMutation({ mutationFn: () => api.shareArtifacts(projectId, Object.values(result!).map((artifact) => artifact.id), `模型实验“${result!.model.name}”已加入会话。指标、模型、复现代码与验证集预测均来自本次真实运行。`, "modeling"), onSuccess: () => client.invalidateQueries({ queryKey: ["messages", projectId] }) });
  function submit(event: FormEvent) { event.preventDefault(); run.mutate(); }
  const metrics = result?.model?.metadata.metrics as Record<string, number> | undefined;
  const training = run.isPending || job.data?.status === "running";

  useEffect(() => {
    if (job.data?.status !== "succeeded" || !job.data.result) return;
    let active = true;
    void api.artifacts(projectId).then((items) => {
      if (!active || !job.data?.result) return;
      const mapped = Object.fromEntries(
        Object.entries(job.data.result).flatMap(([key, id]) => {
          const artifact = items.find((item) => item.id === id);
          return artifact ? [[key, artifact]] : [];
        }),
      ) as Record<string, Artifact>;
      if (mapped.model && mapped.code && mapped.predictions) setResult(mapped);
      void client.invalidateQueries({ queryKey: ["artifacts", projectId] });
    });
    return () => { active = false; };
  }, [client, job.data, projectId]);

  useEffect(() => {
    setFeatures(columns.filter((column) => column !== target));
  }, [artifactId, columns, target]);

  return <div className="page"><PageHeader eyebrow="MODEL LAB" title="模型实验室" description="确认任务、目标与特征后运行可复现 pipeline；代码、模型、指标和预测分别登记为项目产物。" actions={<StatusPill tone="good">随机种子 42</StatusPill>} />
    {!datasets.length && !artifacts.isLoading ? <EmptyState title="需要一个数据片段" text="先在探索工作台通过查询构造训练数据集，然后回到这里建模。" action={<Link className="button primary" to={`/projects/${projectId}/explore`}>创建数据片段</Link>} /> : <div className="model-layout"><form className="model-config" onSubmit={submit}><span className="eyebrow">EXPERIMENT CONFIG</span><h2>训练计划</h2><label>训练数据<select value={artifactId} onChange={(event) => { setArtifactId(event.target.value); setTarget(""); }}><option value="">选择数据产物</option>{datasets.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>任务类型<select value={task} onChange={(event) => { setTask(event.target.value); setAlgorithm(algorithms[event.target.value][0].value); }}><option value="classification">分类</option><option value="regression">回归</option><option value="clustering">聚类</option></select></label>{task !== "clustering" && <label>目标列<select value={target} onChange={(event) => setTarget(event.target.value)}><option value="">选择目标列</option>{columns.map((column) => <option key={column}>{column}</option>)}</select></label>}<label>算法<select value={algorithm} onChange={(event) => setAlgorithm(event.target.value)}>{algorithms[task].map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>{task !== "clustering" && !["soft_voting", "weighted_average", "stacking"].includes(algorithm) && <label className="check-row"><input type="checkbox" checked={tune} onChange={(event) => setTune(event.target.checked)} />运行基础超参数搜索</label>}<div className="feature-cloud selectable"><header><span>显式特征选择</span><small>{selectedFeatures.length} / {Math.max(0, columns.length - (target ? 1 : 0))}</small></header>{columns.filter((column) => column !== target).map((column) => <label key={column} className={features.includes(column) ? "selected" : ""}><input type="checkbox" checked={features.includes(column)} onChange={() => setFeatures((current) => current.includes(column) ? current.filter((item) => item !== column) : [...current, column])} />{column}</label>)}</div><button className="button primary" disabled={!artifactId || !selectedFeatures.length || (task !== "clustering" && !target) || training}><Play size={15} />{training ? "正在训练…" : "开始实验"}</button></form>
      <section className="model-results"><header><div><span className="eyebrow">EXPERIMENT RESULT</span><h2>{result ? result.model.name : "等待训练"}</h2></div>{algorithm.includes("voting") || algorithm.includes("average") || algorithm === "stacking" ? <StatusPill tone="good"><GitMerge size={13} />模型融合</StatusPill> : <StatusPill>单模型</StatusPill>}</header>{training && <div className="training-visual"><span className="training-orbit"><BrainCircuit /></span><h3>{job.data?.message ?? "本地训练正在启动"}</h3><p>独立进程 · 预处理 → 交叉验证 → 训练 → 评估 → 落盘 · {job.data?.elapsed_seconds ?? 0}s</p><div className="progress-track"><i /></div>{jobId && <button className="button ghost compact" onClick={() => cancel.mutate()} disabled={cancel.isPending}><Square size={13} />取消训练</button>}</div>}{(run.error || job.error || (job.data?.error && job.data.status !== "cancelled")) && <ErrorState error={run.error || job.error || new Error(job.data?.error ?? "训练失败")} />}{job.data?.status === "cancelled" && <EmptyState title="训练已经取消" text="独立训练进程已终止；已完成的历史实验产物不会被删除。" />}{!result && !training && !jobId && <EmptyState title="一次实验，一组完整证据" text="模型不会只返回一个分数。DS4 同时保存可复现代码、配置、模型文件和逐行预测。" />}{result && <><div className="metric-grid">{Object.entries(metrics ?? {}).filter(([, value]) => typeof value === "number").map(([key, value]) => <Metric key={key} label={key.replaceAll("_", " ")} value={formatNumber(value)} hint={key.startsWith("cv_") ? "3-fold validation" : "hold-out evaluation"} />)}</div><ModelDiagnostics metrics={metrics ?? {}} task={String(result.model.metadata.task)} /><div className="artifact-receipt"><CheckCircle2 size={20} /><div><b>实验产物已经登记</b><span>{result.code.name} · {result.model.name} · {result.predictions.name}</span></div></div><div className="model-result-actions"><button className="button secondary" onClick={() => predict.mutate()} disabled={predict.isPending}>{predict.isPending ? "正在预测…" : "对当前数据集运行预测"}</button><button className="button secondary" onClick={() => share.mutate()} disabled={share.isPending}><MessageSquarePlus size={14} />加入项目会话</button></div>{predict.error && <ErrorState error={predict.error} />}<div className="model-insight"><Sparkles size={18} /><div><b>如何阅读这个结果</b><p>指标来自固定 20% 验证集，并记录 3 折交叉验证。融合结果仍需与基础模型、业务代价和时间外数据一起判断，不能只看最高分。</p></div></div></>}
      {experiments.length > 0 && <ExperimentComparison experiments={experiments} />}
      </section></div>}
  </div>;
}

function ModelDiagnostics({ metrics, task }: { metrics: Record<string, unknown>; task: string }) {
  const { resolved: colorMode } = useColorMode();
  const importance = (metrics.feature_importance as { feature: string; importance: number }[] | undefined) ?? [];
  const confusion = metrics.confusion_matrix as number[][] | undefined;
  const labels = (metrics.labels as string[] | undefined) ?? [];
  const roc = metrics.roc_curve as { fpr: number[]; tpr: number[] } | undefined;
  const residuals = metrics.residual_quantiles as Record<string, number> | undefined;
  const charts = [] as { title: string; option: Record<string, unknown> }[];
  if (task === "classification" && confusion) charts.push({ title: "混淆矩阵", option: { tooltip: {}, xAxis: { type: "category", data: labels }, yAxis: { type: "category", data: labels }, visualMap: { min: 0, max: Math.max(...confusion.flat()), inRange: { color: ["#282725", "#e49a45"] } }, series: [{ type: "heatmap", data: confusion.flatMap((row, y) => row.map((value, x) => [x, y, value])), label: { show: true } }] } });
  if (roc) charts.push({ title: "ROC 曲线", option: { xAxis: { type: "value", name: "FPR", min: 0, max: 1 }, yAxis: { type: "value", name: "TPR", min: 0, max: 1 }, series: [{ type: "line", data: roc.fpr.map((value, index) => [value, roc.tpr[index]]), smooth: true, itemStyle: { color: "#e49a45" } }] } });
  if (task === "regression" && residuals) charts.push({ title: "残差分位数", option: { xAxis: { type: "category", data: Object.keys(residuals) }, yAxis: { type: "value" }, series: [{ type: "bar", data: Object.values(residuals), itemStyle: { color: "#e49a45" } }] } });
  if (importance.length) charts.push({ title: "特征重要性", option: { grid: { left: 120 }, xAxis: { type: "value" }, yAxis: { type: "category", data: importance.slice(0, 10).map((item) => item.feature).reverse() }, series: [{ type: "bar", data: importance.slice(0, 10).map((item) => item.importance).reverse(), itemStyle: { color: "#cb792d" } }] } });
  return <div className="diagnostic-grid">{charts.map((chart) => <article key={chart.title}><h3>{chart.title}</h3><ReactECharts option={{ ...chart.option, backgroundColor: "transparent", textStyle: { color: colorMode === "light" ? "#6f6257" : "#b7b1a8" } }} style={{ height: 250 }} /></article>)}</div>;
}

function ExperimentComparison({ experiments }: { experiments: Artifact[] }) {
  return <section className="experiment-comparison"><span className="eyebrow">EXPERIMENT HISTORY</span><h3>历史实验横向比较</h3><div className="schema-table"><table><thead><tr><th>实验</th><th>任务</th><th>算法</th><th>主指标</th><th>时间</th></tr></thead><tbody>{experiments.map((experiment) => { const metrics = experiment.metadata.metrics as Record<string, unknown> | undefined; const score = metrics?.f1_weighted ?? metrics?.r2 ?? metrics?.silhouette ?? metrics?.mae; return <tr key={experiment.id}><td>{experiment.name}</td><td>{String(experiment.metadata.task)}</td><td>{String(experiment.metadata.algorithm)}</td><td>{formatNumber(score)}</td><td>{new Date(experiment.created_at).toLocaleString("zh-CN")}</td></tr>; })}</tbody></table></div></section>;
}
