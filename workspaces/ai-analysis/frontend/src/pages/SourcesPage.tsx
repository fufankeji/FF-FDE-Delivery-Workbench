import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Database, FileArchive, FileSpreadsheet, RefreshCw, ShieldCheck, UploadCloud } from "lucide-react";
import { ChangeEvent, FormEvent, useState } from "react";
import { useParams } from "react-router-dom";

import { api } from "../api";
import { EmptyState, ErrorState, LoadingState, Metric, PageHeader, StatusPill, formatNumber } from "../components/Ui";

const sourceChoices = [
  { type: "csv", title: "CSV", text: "大规模文本表格", icon: FileArchive, accept: ".csv" },
  { type: "excel", title: "Excel", text: "支持多 Sheet 基线", icon: FileSpreadsheet, accept: ".xlsx,.xls" },
  { type: "sqlite", title: "SQLite", text: "只读浏览本地数据库", icon: Database, accept: ".sqlite,.sqlite3,.db" },
] as const;

export function SourcesPage() {
  const { projectId = "" } = useParams();
  const client = useQueryClient();
  const [mysqlOpen, setMysqlOpen] = useState(false);
  const [openSourceId, setOpenSourceId] = useState("");
  const sources = useQuery({ queryKey: ["sources", projectId], queryFn: () => api.sources(projectId), enabled: Boolean(projectId) });
  const upload = useMutation({
    mutationFn: ({ type, file }: { type: string; file: File }) => api.uploadSource(projectId, type, file),
    onSettled: () => client.invalidateQueries({ queryKey: ["sources", projectId] }),
  });
  const mysql = useMutation({
    mutationFn: ({ name, url }: { name: string; url: string }) => api.connectMySQL(projectId, name, url),
    onSuccess: () => { setMysqlOpen(false); },
    onSettled: () => client.invalidateQueries({ queryKey: ["sources", projectId] }),
  });
  const reprofile = useMutation({
    mutationFn: (sourceId: string) => api.reprofileSource(projectId, sourceId),
    onSuccess: () => client.invalidateQueries({ queryKey: ["sources", projectId] }),
  });

  function pick(type: string, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) upload.mutate({ type, file });
    event.target.value = "";
  }

  return (
    <div className="page">
      <PageHeader eyebrow="DATA CONNECTIONS" title="数据源与基线" description="接入时先画像、指纹与校验；文件进入不可变项目副本，数据库始终只读。" actions={<StatusPill tone="good"><ShieldCheck size={13} /> 只读策略开启</StatusPill>} />
      <section className="source-picker-grid">
        {sourceChoices.map((choice) => (
          <label className="source-choice" key={choice.type}>
            <choice.icon size={21} /><span><b>{choice.title}</b><small>{choice.text}</small></span><UploadCloud size={16} />
            <input type="file" accept={choice.accept} onChange={(event) => pick(choice.type, event)} />
          </label>
        ))}
        <button className="source-choice" onClick={() => setMysqlOpen(true)}><Database size={21} /><span><b>MySQL 8.4</b><small>本地只读账号连接</small></span><span className="choice-plus">+</span></button>
      </section>
      {upload.isPending && <div className="activity-banner"><RefreshCw className="spin" size={16} /><div><b>正在复制并建立数据基线</b><span>大文件画像可能需要一点时间，请不要关闭页面。</span></div></div>}
      {(upload.error || mysql.error || reprofile.error) && <ErrorState error={upload.error || mysql.error || reprofile.error} />}

      <section className="section-block">
        <div className="section-heading"><div><span className="eyebrow">SOURCE CATALOG</span><h2>项目中的数据</h2></div><span>{sources.data?.length ?? 0} 个来源</span></div>
        {sources.isLoading && <LoadingState label="读取数据目录" />}
        {!sources.isLoading && !sources.data?.length && <EmptyState title="等待第一个数据源" text="支持 CSV、Excel、SQLite 与本地 MySQL，不会扩展到未经确认的其他数据类型。" />}
        <div className="source-list">
          {sources.data?.map((source) => {
            const groups = sourceGroups(source.baseline);
            const rows = source.baseline.rows ?? groups.reduce((total, group) => total + Number(group.rows ?? 0), 0);
            const fields = source.baseline.columns ?? groups.reduce((total, group) => total + group.fields.length, 0);
            const isOpen = openSourceId === source.id;
            return <article className={`source-card ${isOpen ? "expanded" : ""}`} key={source.id}><span className="source-icon"><Database size={18} /></span><div className="source-main"><div><h3>{source.name}</h3><StatusPill tone={source.status === "changed" ? "warn" : "good"}>{source.status}</StatusPill></div><p>{source.type.toUpperCase()} · 指纹 {source.fingerprint.slice(0, 12)}…</p></div><Metric label="规模" value={formatNumber(rows)} /><Metric label="字段" value={formatNumber(fields)} /><div className="source-actions"><button className="icon-button" title="重新画像" aria-label={`重新画像 ${source.name}`} onClick={() => reprofile.mutate(source.id)} disabled={reprofile.isPending}><RefreshCw className={reprofile.isPending ? "spin" : ""} size={15} /></button><button className="icon-button" aria-label={`展开 ${source.name}`} onClick={() => setOpenSourceId(isOpen ? "" : source.id)}><ChevronDown className={isOpen ? "rotated" : ""} size={15} /></button></div>{isOpen && <SourceCatalogDetail baseline={source.baseline} groups={groups} />}</article>;
          })}
        </div>
      </section>

      {mysqlOpen && <MySQLModal pending={mysql.isPending} error={mysql.error} onClose={() => setMysqlOpen(false)} onSubmit={(name, url) => mysql.mutate({ name, url })} />}
    </div>
  );
}

type SourceGroup = { name: string; rows?: unknown; fields: Record<string, unknown>[]; sample: Record<string, unknown>[] };

function sourceGroups(baseline: Record<string, unknown>): SourceGroup[] {
  const nested = (baseline.tables ?? baseline.sheets) as Record<string, unknown>[] | undefined;
  if (Array.isArray(nested)) return nested.map((group) => ({ name: String(group.name), rows: group.rows, fields: Array.isArray(group.fields) ? group.fields as Record<string, unknown>[] : [], sample: Array.isArray(group.sample) ? group.sample as Record<string, unknown>[] : [] }));
  return [{ name: String(baseline.format ?? "dataset"), rows: baseline.rows, fields: Array.isArray(baseline.fields) ? baseline.fields as Record<string, unknown>[] : [], sample: Array.isArray(baseline.sample) ? baseline.sample as Record<string, unknown>[] : [] }];
}

function SourceCatalogDetail({ baseline, groups }: { baseline: Record<string, unknown>; groups: SourceGroup[] }) {
  return <div className="source-catalog-detail"><header><span>画像时间 {String(baseline.profiled_at ?? "未记录")}</span><span>{String(baseline.sample_strategy ?? "有界样本")}</span></header>{groups.map((group) => <section key={group.name}><h4>{group.name} <small>{formatNumber(group.rows)} 行</small></h4><div className="schema-table"><table><thead><tr><th>字段</th><th>类型</th><th>空值</th><th>唯一值</th></tr></thead><tbody>{group.fields.map((field) => <tr key={String(field.name)}><td>{String(field.name)}</td><td>{String(field.dtype ?? "—")}</td><td>{formatNumber(field.nulls)}</td><td>{formatNumber(field.unique)}</td></tr>)}</tbody></table></div>{group.sample.length > 0 && <details><summary>查看 5 行有界样本</summary><pre>{JSON.stringify(group.sample, null, 2)}</pre></details>}</section>)}</div>;
}

function MySQLModal({ pending, error, onClose, onSubmit }: { pending: boolean; error: unknown; onClose: () => void; onSubmit: (name: string, url: string) => void }) {
  const [name, setName] = useState("Local Olist MySQL");
  const [url, setUrl] = useState("");
  function submit(event: FormEvent) { event.preventDefault(); if (url) onSubmit(name, url); }
  return <div className="modal-backdrop" onMouseDown={onClose}><form className="modal-card" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}><span className="eyebrow">READ-ONLY DATABASE</span><h2>连接本地 MySQL</h2><p>连接串只注入当前后端进程，不写入项目数据库、日志或页面历史。</p><label>连接名称<input value={name} onChange={(event) => setName(event.target.value)} /></label><label>SQLAlchemy URL<input type="password" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="mysql+pymysql://reader:••••@127.0.0.1:3307/olist" /></label>{error ? <ErrorState error={error} /> : null}<div className="modal-actions"><button type="button" className="button ghost" onClick={onClose}>取消</button><button className="button primary" disabled={!url || pending}>{pending ? "正在校验…" : "测试并连接"}</button></div></form></div>;
}
