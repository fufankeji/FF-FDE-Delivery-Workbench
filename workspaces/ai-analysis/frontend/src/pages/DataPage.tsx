import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  BookOpenText,
  Check,
  ChevronDown,
  Database,
  FileSpreadsheet,
  Files,
  FolderKanban,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Server,
  Save,
  Table2,
  Tags,
  Trash2,
  Upload,
} from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { api } from "../api";
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusPill, formatNumber } from "../components/Ui";
import type { DataAsset } from "../types";

const typeOptions = [
  { id: "all", label: "全部" },
  { id: "csv", label: "CSV" },
  { id: "excel", label: "Excel" },
  { id: "sqlite", label: "SQLite" },
  { id: "mysql", label: "MySQL" },
];

export function DataPage() {
  const client = useQueryClient();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [openAssetId, setOpenAssetId] = useState("");
  const [mysqlOpen, setMysqlOpen] = useState(false);
  const [bindingAsset, setBindingAsset] = useState<DataAsset | null>(null);
  const [editingAsset, setEditingAsset] = useState<DataAsset | null>(null);
  const assets = useQuery({ queryKey: ["data-assets"], queryFn: api.dataAssets });
  const projects = useQuery({ queryKey: ["projects"], queryFn: api.projects });
  const upload = useMutation({
    mutationFn: ({ sourceType, file }: { sourceType: string; file: File }) => api.uploadDataAsset(sourceType, file),
    onSuccess: () => client.invalidateQueries({ queryKey: ["data-assets"] }),
  });
  const mysql = useMutation({
    mutationFn: ({ name, url }: { name: string; url: string }) => api.connectDataAssetMySQL(name, url),
    onSuccess: async () => { setMysqlOpen(false); await client.invalidateQueries({ queryKey: ["data-assets"] }); },
  });
  const reprofile = useMutation({
    mutationFn: api.reprofileDataAsset,
    onSuccess: () => client.invalidateQueries({ queryKey: ["data-assets"] }),
  });
  const update = useMutation({
    mutationFn: ({ assetId, payload }: { assetId: string; payload: { name: string; description: string; tags: string[] } }) => api.updateDataAsset(assetId, payload),
    onSuccess: async () => { setEditingAsset(null); await client.invalidateQueries({ queryKey: ["data-assets"] }); },
  });
  const remove = useMutation({
    mutationFn: api.deleteDataAsset,
    onSuccess: () => client.invalidateQueries({ queryKey: ["data-assets"] }),
  });

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (assets.data ?? []).filter((asset) => {
      const matchesType = type === "all" || asset.type === type;
      const haystack = `${asset.name} ${asset.description} ${asset.tags.join(" ")}`.toLowerCase();
      return matchesType && (!needle || haystack.includes(needle));
    });
  }, [assets.data, query, type]);

  const projectUsage = new Set((assets.data ?? []).flatMap((asset) => asset.usage.map((item) => item.project_id))).size;
  const rows = (assets.data ?? []).reduce((total, asset) => total + assetRows(asset), 0);
  const bytes = (assets.data ?? []).reduce((total, asset) => total + Number(asset.baseline.bytes ?? 0), 0);

  function pick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) upload.mutate({ sourceType: inferSourceType(file.name), file });
    event.target.value = "";
  }

  return <div className="page global-management-page">
    <PageHeader eyebrow="DATA ASSETS" title="数据资产" description="把常用文件与本地数据库统一登记、画像并复用。资产属于系统，只有明确绑定后才会进入某个分析项目。" actions={<><button className="button secondary" onClick={() => setMysqlOpen(true)}><Server size={15} />连接 MySQL</button><label className="button primary"><Upload size={15} />导入数据资产<input type="file" accept=".csv,.xlsx,.xls,.sqlite,.sqlite3,.db" onChange={pick} hidden /></label></>} />

    <section className="management-metrics" aria-label="数据资产概览">
      <OverviewMetric icon={Files} label="可复用资产" value={assets.data?.length ?? 0} hint="CSV / Excel / SQLite / MySQL" />
      <OverviewMetric icon={FolderKanban} label="已服务项目" value={projectUsage} hint="跨项目复用，项目内仍保持隔离" />
      <OverviewMetric icon={Database} label="已画像数据行" value={formatCompact(rows)} hint="以最新数据基线为准" />
      <OverviewMetric icon={FileSpreadsheet} label="本地文件体积" value={formatBytes(bytes)} hint="数据库连接不计入文件体积" />
    </section>

    <section className="management-catalog-shell">
      <header className="management-section-heading"><div><span className="eyebrow">ASSET CATALOG</span><h2>资产目录</h2><p>先找到可信的数据，再把它带入具体分析项目。</p></div><span className="management-count"><b>{filtered.length}</b><small>/ {assets.data?.length ?? 0} 项资产</small></span></header>
      <section className="catalog-toolbar">
        <label className="catalog-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索资产名称、说明或标签" /></label>
        <div className="filter-row" aria-label="数据类型筛选">{typeOptions.map((item) => <button type="button" className={type === item.id ? "active" : ""} key={item.id} onClick={() => setType(item.id)}>{item.label}</button>)}</div>
      </section>

      {(upload.error || mysql.error || reprofile.error || update.error || remove.error) && <ErrorState error={upload.error || mysql.error || reprofile.error || update.error || remove.error} />}
      {(upload.isPending || mysql.isPending) && <div className="activity-banner"><RefreshCw className="spin" size={16} /><div><b>正在建立全局数据基线</b><span>完成后即可绑定到任意分析项目。</span></div></div>}
      {assets.isLoading && <LoadingState label="读取全局数据资产" />}
      {!assets.isLoading && !assets.data?.length && <EmptyState title="建立第一份可复用数据资产" text="导入 CSV、Excel、SQLite，或连接本地 MySQL。DS4 会先完成结构画像，再交给项目使用。" />}
      {!assets.isLoading && assets.data?.length && !filtered.length ? <EmptyState title="没有匹配的数据资产" text="调整搜索词或数据类型筛选即可继续。" /> : null}

      <section className="asset-catalog" aria-label="数据资产目录">
        {filtered.map((asset) => {
          const open = openAssetId === asset.id;
          const summary = assetSummary(asset);
          return <article className={`asset-row ${open ? "expanded" : ""}`} key={asset.id}>
          <button className="asset-row-main" type="button" onClick={() => setOpenAssetId(open ? "" : asset.id)} aria-expanded={open}>
            <span className={`asset-type-mark ${asset.type}`}><AssetIcon asset={asset} /></span>
            <span className="asset-identity"><span><b>{asset.name}</b><StatusPill tone={asset.status === "ready" ? "good" : "warn"}>{statusLabel(asset.status)}</StatusPill></span><small>{asset.description || "尚未添加业务说明"}</small></span>
            <span className="asset-stat"><small>规模</small><b>{summary.scale}</b></span>
            <span className="asset-stat"><small>结构</small><b>{summary.structure}</b></span>
            <span className="asset-stat"><small>项目</small><b>{asset.usage.length}</b></span>
            <ChevronDown className={open ? "rotated" : ""} size={17} />
          </button>
          <div className="asset-row-actions">
            <button className="button secondary compact" onClick={() => setBindingAsset(asset)}><Plus size={14} />用于项目</button>
            <button className="icon-button" title="编辑资产信息" aria-label={`编辑 ${asset.name}`} onClick={() => setEditingAsset(asset)}><Pencil size={14} /></button>
            <button className="icon-button" title="重新画像" aria-label={`重新画像 ${asset.name}`} onClick={() => reprofile.mutate(asset.id)} disabled={reprofile.isPending}><RefreshCw className={reprofile.isPending ? "spin" : ""} size={14} /></button>
            <button className="icon-button danger" title={asset.usage.length ? "仍被项目使用，不能删除" : "删除资产"} aria-label={`删除 ${asset.name}`} disabled={asset.usage.length > 0 || remove.isPending} onClick={() => window.confirm(`确定删除“${asset.name}”吗？`) && remove.mutate(asset.id)}><Trash2 size={14} /></button>
          </div>
          {open && <AssetDetail asset={asset} />}
          </article>;
        })}
      </section>
    </section>

    {mysqlOpen && <MySQLAssetModal pending={mysql.isPending} error={mysql.error} onClose={() => setMysqlOpen(false)} onSubmit={(name, url) => mysql.mutate({ name, url })} />}
    {bindingAsset && <BindAssetModal asset={bindingAsset} projects={projects.data ?? []} pending={false} onClose={() => setBindingAsset(null)} onBound={async (projectId) => { setBindingAsset(null); await Promise.all([client.invalidateQueries({ queryKey: ["data-assets"] }), client.invalidateQueries({ queryKey: ["sources", projectId] })]); navigate(`/projects/${projectId}/chat`); }} />}
    {editingAsset && <EditAssetModal asset={editingAsset} pending={update.isPending} onClose={() => setEditingAsset(null)} onSubmit={(payload) => update.mutate({ assetId: editingAsset.id, payload })} />}
  </div>;
}

function OverviewMetric({ icon: Icon, label, value, hint }: { icon: typeof Database; label: string; value: string | number; hint: string }) {
  return <article><span><Icon size={19} /></span><div><small>{label}</small><strong>{value}</strong><p>{hint}</p></div></article>;
}

function AssetIcon({ asset }: { asset: DataAsset }) {
  if (asset.type === "mysql") return <Server size={19} />;
  if (asset.type === "excel") return <FileSpreadsheet size={19} />;
  return <Database size={19} />;
}

function AssetDetail({ asset }: { asset: DataAsset }) {
  const client = useQueryClient();
  const [unit, setUnit] = useState("");
  const [editingDictionary, setEditingDictionary] = useState(false);
  const [descriptions, setDescriptions] = useState<Record<string, string>>({});
  const preview = useQuery({ queryKey: ["data-asset-preview", asset.id, unit], queryFn: () => api.dataAssetPreview(asset.id, unit || undefined), staleTime: 30_000 });
  const dictionary = useMutation({
    mutationFn: () => api.updateDataAssetDictionary(asset.id, preview.data?.unit ?? unit, descriptions),
    onSuccess: async () => {
      setEditingDictionary(false);
      await Promise.all([
        client.invalidateQueries({ queryKey: ["data-assets"] }),
        client.invalidateQueries({ queryKey: ["data-asset-preview", asset.id] }),
      ]);
    },
  });
  useEffect(() => {
    if (!preview.data || editingDictionary) return;
    setDescriptions(Object.fromEntries(preview.data.fields.map((field) => [field.name, field.description])));
  }, [preview.data, editingDictionary]);
  const groups = assetGroups(asset);
  const active = preview.data;
  return <div className="asset-detail data-inspector">
    <div className="asset-detail-meta"><div><span className="eyebrow">DATA INSPECTOR</span><code>{asset.fingerprint.slice(0, 20)}…</code></div><div className="asset-tags"><Tags size={14} />{asset.tags.length ? asset.tags.map((tag) => <span key={tag}>{tag}</span>) : <small>暂无标签</small>}</div></div>
    <section className="asset-overview-strip">
      <div><small>业务说明</small><b>{asset.description || "尚未补充业务口径，可通过编辑资产信息完善"}</b></div>
      <div><small>数据格式</small><b>{asset.type.toUpperCase()}</b></div>
      <div><small>数据单元</small><b>{groups.length} 个</b></div>
      <div><small>最近画像</small><b>{new Date(String(asset.baseline.profiled_at ?? asset.updated_at)).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</b></div>
    </section>
    {preview.isLoading && <LoadingState label="读取字段字典与前 200 条数据" />}
    {preview.error && <ErrorState error={preview.error} />}
    {active && <>
      <div className="data-unit-tabs" role="tablist" aria-label="数据表或工作表">{active.units.map((name) => <button type="button" role="tab" aria-selected={active.unit === name} className={active.unit === name ? "active" : ""} key={name} onClick={() => { setUnit(name); setEditingDictionary(false); }}>{name}</button>)}</div>
      <div className="inspector-section-heading"><div><BookOpenText size={18} /><span><h3>字段字典</h3><p>字段类型、完整度与业务含义放在同一处核对。</p></span></div>{editingDictionary ? <div><button className="button ghost compact" onClick={() => setEditingDictionary(false)}>取消</button><button className="button primary compact" onClick={() => dictionary.mutate()} disabled={dictionary.isPending}><Save size={14} />{dictionary.isPending ? "保存中" : "保存字典"}</button></div> : <button className="button secondary compact" onClick={() => setEditingDictionary(true)}><Pencil size={14} />编辑字段解释</button>}</div>
      {dictionary.error && <ErrorState error={dictionary.error} />}
      <div className="field-dictionary-table"><table><thead><tr><th>字段名称</th><th>类型</th><th>空值</th><th>去重值</th><th>业务解释</th></tr></thead><tbody>{active.fields.map((field) => <tr key={field.name}><td><code>{field.name}</code></td><td>{String(field.dtype ?? "—")}</td><td>{formatNumber(Number(field.nulls ?? 0))}</td><td>{formatNumber(Number(field.unique ?? 0))}</td><td>{editingDictionary ? <input aria-label={`${field.name} 字段解释`} value={descriptions[field.name] ?? ""} onChange={(event) => setDescriptions((current) => ({ ...current, [field.name]: event.target.value }))} /> : field.description}</td></tr>)}</tbody></table></div>
      <div className="inspector-section-heading preview-heading"><div><Table2 size={18} /><span><h3>源数据预览</h3><p>展示 {formatNumber(Math.min(active.total, active.limit))} / {formatNumber(active.total)} 行；最多读取前 200 行，不修改原始数据。</p></span></div><StatusPill tone="neutral">前 200 条</StatusPill></div>
      <div className="source-preview-table"><table><thead><tr>{active.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{active.rows.map((row, index) => <tr key={index}>{active.columns.map((column) => <td key={column}>{formatCell(row[column])}</td>)}</tr>)}</tbody></table></div>
    </>}
    <div className="asset-detail-grid usage-only"><section><header><h3>项目使用</h3><span>{asset.usage.length} 个项目</span></header>{asset.usage.length ? <div className="asset-usage-list">{asset.usage.map((item) => <div key={item.project_id}><Check size={14} /><span><b>{item.project_title}</b><small>{new Date(item.bound_at).toLocaleDateString("zh-CN")} 绑定</small></span></div>)}</div> : <p className="quiet-copy">尚未绑定项目。资产不会自动进入任何分析上下文。</p>}</section></div>
  </div>;
}

function BindAssetModal({ asset, projects, pending, onClose, onBound }: { asset: DataAsset; projects: { id: string; title: string }[]; pending: boolean; onClose: () => void; onBound: (projectId: string) => void }) {
  const [projectId, setProjectId] = useState("");
  const [title, setTitle] = useState(`${asset.name.replace(/\.[^.]+$/, "")}分析`);
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<unknown>(null);
  async function submit(event: FormEvent) {
    event.preventDefault(); setWorking(true); setError(null);
    try {
      const target = mode === "new" ? await api.createProject(title.trim()) : projects.find((item) => item.id === projectId);
      if (!target) throw new Error("请选择要绑定的分析项目");
      await api.bindDataAsset(target.id, asset.id);
      onBound(target.id);
    } catch (value) { setError(value); setWorking(false); }
  }
  return <div className="modal-backdrop" onMouseDown={onClose}><form className="modal-card bind-asset-modal" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}><span className="eyebrow">USE DATA ASSET</span><h2>把 {asset.name} 用于分析</h2><p>DS4 会把资产复制为项目内的独立数据源，不影响其他项目与全局原件。</p><div className="segmented-control"><button type="button" className={mode === "existing" ? "active" : ""} onClick={() => setMode("existing")}>绑定已有项目</button><button type="button" className={mode === "new" ? "active" : ""} onClick={() => setMode("new")}>新建分析项目</button></div>{mode === "existing" ? <label>分析项目<select value={projectId} onChange={(event) => setProjectId(event.target.value)}><option value="">请选择项目</option>{projects.map((project) => <option value={project.id} key={project.id}>{project.title}{asset.usage.some((item) => item.project_id === project.id) ? "（已绑定）" : ""}</option>)}</select></label> : <label>新项目名称<input value={title} onChange={(event) => setTitle(event.target.value)} /></label>}{error ? <ErrorState error={error} /> : null}<div className="modal-actions"><button type="button" className="button ghost" onClick={onClose}>取消</button><button className="button primary" disabled={pending || working || (mode === "existing" ? !projectId : !title.trim())}>{working ? "正在准备项目…" : <>绑定并进入项目<ArrowRight size={14} /></>}</button></div></form></div>;
}

function EditAssetModal({ asset, pending, onClose, onSubmit }: { asset: DataAsset; pending: boolean; onClose: () => void; onSubmit: (payload: { name: string; description: string; tags: string[] }) => void }) {
  const [name, setName] = useState(asset.name);
  const [description, setDescription] = useState(asset.description);
  const [tags, setTags] = useState(asset.tags.join("、"));
  return <div className="modal-backdrop" onMouseDown={onClose}><form className="modal-card" onSubmit={(event) => { event.preventDefault(); onSubmit({ name, description, tags: tags.split(/[、,，]/).map((item) => item.trim()).filter(Boolean) }); }} onMouseDown={(event) => event.stopPropagation()}><span className="eyebrow">ASSET METADATA</span><h2>完善资产信息</h2><p>业务说明与标签会帮助团队更快找到正确数据，不会进入原始文件。</p><label>资产名称<input value={name} onChange={(event) => setName(event.target.value)} /></label><label>业务说明<textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="例如：Olist 2016–2018 年订单、客户与履约数据" /></label><label>标签<input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="电商、履约、客户体验" /></label><div className="modal-actions"><button type="button" className="button ghost" onClick={onClose}>取消</button><button className="button primary" disabled={pending || !name.trim()}>{pending ? "正在保存…" : "保存信息"}</button></div></form></div>;
}

function MySQLAssetModal({ pending, error, onClose, onSubmit }: { pending: boolean; error: unknown; onClose: () => void; onSubmit: (name: string, url: string) => void }) {
  const [name, setName] = useState("本地 MySQL 数据库");
  const [url, setUrl] = useState("");
  return <div className="modal-backdrop" onMouseDown={onClose}><form className="modal-card" onSubmit={(event) => { event.preventDefault(); if (url) onSubmit(name, url); }} onMouseDown={(event) => event.stopPropagation()}><span className="eyebrow">READ-ONLY DATABASE</span><h2>登记 MySQL 数据资产</h2><p>连接串只进入当前受保护后端进程；系统仅保存环境别名与结构画像。</p><label>资产名称<input value={name} onChange={(event) => setName(event.target.value)} /></label><label>SQLAlchemy URL<input type="password" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="mysql+pymysql://reader:••••@127.0.0.1:3307/database" /></label>{error ? <ErrorState error={error} /> : null}<div className="modal-actions"><button type="button" className="button ghost" onClick={onClose}>取消</button><button className="button primary" disabled={!url || pending}>{pending ? "正在测试连接…" : "测试并登记"}</button></div></form></div>;
}

type AssetGroup = { name: string; rows: number; fields: Record<string, unknown>[] };
function assetGroups(asset: DataAsset): AssetGroup[] {
  const nested = (asset.baseline.tables ?? asset.baseline.sheets) as Record<string, unknown>[] | undefined;
  if (Array.isArray(nested)) return nested.map((item) => ({ name: String(item.name), rows: Number(item.rows ?? 0), fields: Array.isArray(item.fields) ? item.fields as Record<string, unknown>[] : [] }));
  return [{ name: String(asset.baseline.format ?? asset.type), rows: Number(asset.baseline.rows ?? 0), fields: Array.isArray(asset.baseline.fields) ? asset.baseline.fields as Record<string, unknown>[] : [] }];
}
function assetRows(asset: DataAsset) { return assetGroups(asset).reduce((total, group) => total + group.rows, 0); }
function assetSummary(asset: DataAsset) { const groups = assetGroups(asset); return { scale: `${formatCompact(assetRows(asset))} 行`, structure: `${groups.length > 1 ? `${groups.length} 表` : `${groups[0]?.fields.length ?? 0} 字段`}` }; }
function inferSourceType(name: string) { const suffix = name.toLowerCase().split(".").pop(); if (suffix === "csv") return "csv"; if (["xlsx", "xls"].includes(suffix ?? "")) return "excel"; if (["sqlite", "sqlite3", "db"].includes(suffix ?? "")) return "sqlite"; throw new Error("仅支持 CSV、Excel 与 SQLite 文件"); }
function statusLabel(status: string) { return ({ ready: "可用", changed: "有变化", profiling: "画像中", failed: "异常" } as Record<string, string>)[status] ?? status; }
function formatCompact(value: number) { return new Intl.NumberFormat("zh-CN", { notation: "compact", maximumFractionDigits: 1 }).format(value); }
function formatBytes(value: number) { if (!value) return "0 B"; const units = ["B", "KB", "MB", "GB"]; const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1); return `${(value / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`; }
function formatCell(value: unknown) { if (value === null || value === undefined || value === "") return "—"; if (typeof value === "object") return JSON.stringify(value); return String(value); }
