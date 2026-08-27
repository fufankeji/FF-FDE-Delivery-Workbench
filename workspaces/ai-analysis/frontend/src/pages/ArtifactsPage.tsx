import { useQuery } from "@tanstack/react-query";
import { Boxes, Code2, Database, Download, FileText, GitBranch, Image, PackageOpen } from "lucide-react";
import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import { api } from "../api";
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusPill } from "../components/Ui";
import type { Artifact } from "../types";

const icons: Record<string, typeof Boxes> = { extract: Database, derived: Database, code: Code2, visual: Image, model: Boxes, predictions: Database, report: FileText, html: FileText };

export function ArtifactsPage() {
  const { projectId = "" } = useParams();
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<Artifact | null>(null);
  const artifacts = useQuery({ queryKey: ["artifacts", projectId], queryFn: () => api.artifacts(projectId) });
  const types = useMemo(() => Array.from(new Set(artifacts.data?.map((item) => item.type) ?? [])), [artifacts.data]);
  const visible = artifacts.data?.filter((item) => filter === "all" || item.type === filter) ?? [];
  return <div className="page"><PageHeader eyebrow="ARTIFACT REGISTRY" title="产物与血缘" description="每个数据片段、SQL、代码、图表、模型、预测与报告都有内容哈希和输入依赖。" actions={<StatusPill tone="good"><GitBranch size={13} />项目级血缘</StatusPill>} />
    <div className="filter-row"><button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>全部</button>{types.map((type) => <button key={type} className={filter === type ? "active" : ""} onClick={() => setFilter(type)}>{type}</button>)}</div>
    {artifacts.isLoading && <LoadingState label="读取产物登记表" />}{artifacts.error && <ErrorState error={artifacts.error} />}{!artifacts.isLoading && !visible.length && <EmptyState title="还没有项目产物" text="查询、图表、模型和报告完成后都会在这里出现，而不是只存在于聊天消息里。" />}
    <div className="artifact-layout"><div className="artifact-list">{visible.map((artifact) => { const Icon = icons[artifact.type] ?? PackageOpen; return <button className={`artifact-row ${selected?.id === artifact.id ? "selected" : ""}`} key={artifact.id} onClick={() => setSelected(artifact)}><span className="artifact-icon"><Icon size={17} /></span><span className="artifact-title"><b>{artifact.name}</b><small>{artifact.type} · {artifact.sha256.slice(0, 12)}…</small></span><StatusPill tone="good">{artifact.status}</StatusPill><span className="artifact-time">{new Date(artifact.created_at).toLocaleString("zh-CN")}</span></button>; })}</div>{selected && <aside className="artifact-detail"><header><div><span className="eyebrow">ARTIFACT DETAIL</span><h2>{selected.name}</h2></div><a className="icon-button" href={api.artifactDownloadUrl(projectId, selected.id)}><Download size={16} /></a></header><dl><div><dt>稳定 ID</dt><dd>{selected.id}</dd></div><div><dt>内容哈希</dt><dd>{selected.sha256}</dd></div><div><dt>项目路径</dt><dd>{selected.path}</dd></div><div><dt>输入依赖</dt><dd>{selected.lineage.length ? selected.lineage.join("\n") : "根产物"}</dd></div></dl><h3>结构化元数据</h3><pre>{JSON.stringify(selected.metadata, null, 2)}</pre></aside>}</div>
  </div>;
}
