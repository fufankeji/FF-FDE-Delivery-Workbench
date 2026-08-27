import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bot,
  CheckCircle2,
  Cpu,
  Database,
  Eye,
  EyeOff,
  HardDrive,
  KeyRound,
  LockKeyhole,
  Palette,
  RefreshCw,
  RotateCcw,
  Server,
  Save,
  TestTube2,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { api } from "../api";
import { AppearanceControls } from "../components/AppearanceControls";
import { ErrorState, LoadingState, PageHeader, StatusPill } from "../components/Ui";
import type { SystemOverview } from "../types";

const sections = [
  { id: "runtime", label: "AI 与运行时", icon: Bot },
  { id: "security", label: "数据与安全", icon: ShieldCheck },
  { id: "storage", label: "存储与导出", icon: HardDrive },
  { id: "appearance", label: "界面外观", icon: Palette },
] as const;

type SectionId = typeof sections[number]["id"];

function isSectionId(value: string | null): value is SectionId {
  return sections.some((item) => item.id === value);
}

export function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedSection = searchParams.get("tab");
  const section: SectionId = isSectionId(requestedSection) ? requestedSection : "runtime";
  const overview = useQuery({ queryKey: ["system-overview"], queryFn: api.systemOverview, refetchInterval: 30_000 });

  function selectSection(nextSection: SectionId) {
    const next = new URLSearchParams(searchParams);
    next.set("tab", nextSection);
    setSearchParams(next);
  }

  return <div className="page global-management-page">
    <PageHeader eyebrow="SYSTEM SETTINGS" title="系统设置" description="管理 DS4 的运行状态、数据边界、本地存储与界面偏好。项目自己的数据和 Skills 不会在这里被改动。" actions={<StatusPill tone={overview.data?.status === "ok" ? "good" : "warn"}>{overview.data?.status === "ok" ? "本地服务正常" : "正在检查"}</StatusPill>} />
    <div className="settings-workspace">
      <nav className="settings-nav" aria-label="系统设置分类" role="tablist">{sections.map(({ id, label, icon: Icon }) => <button type="button" role="tab" aria-selected={section === id} aria-controls={`settings-panel-${id}`} key={id} className={section === id ? "active" : ""} onClick={() => selectSection(id)}><Icon size={17} /><span>{label}</span></button>)}</nav>
      <main className="settings-content" id={`settings-panel-${section}`} role="tabpanel">
        {overview.isLoading && <LoadingState label="读取系统状态" />}
        {overview.error && <ErrorState error={overview.error} />}
        {section === "runtime" && <RuntimeSettings overview={overview.data} onRefresh={() => overview.refetch()} />}
        {section === "security" && <SecuritySettings overview={overview.data} />}
        {section === "storage" && <StorageSettings overview={overview.data} />}
        {section === "appearance" && <AppearanceSettings />}
      </main>
    </div>
  </div>;
}

function SettingsSectionHeader({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return <header className="settings-section-header"><span className="eyebrow">{eyebrow}</span><h2>{title}</h2><p>{text}</p></header>;
}

function RuntimeSettings({ overview, onRefresh }: { overview?: SystemOverview; onRefresh: () => void }) {
  const [mysqlOpen, setMysqlOpen] = useState(false);
  const model = useQuery({ queryKey: ["model-connection"], queryFn: api.modelConnection });
  return <div className="settings-section"><SettingsSectionHeader eyebrow="AI RUNTIME" title="AI 与运行时" text="确认模型、数据库与代码执行环境是否已经准备好。凭证值不会在页面中显示。" />
    <div className="runtime-hero"><span className="runtime-orbit"><Bot size={28} /></span><div><small>默认推理模型</small><h3>{model.data?.model_name ?? "DeepSeek-V4-Flash"}</h3><p>负责意图判断、工具规划、分析解释与报告编排；只接收完成当前任务所需的最小上下文。</p></div><StatusPill tone={overview?.model === "configured" ? "good" : "warn"}>{overview?.model === "configured" ? "凭证已就绪" : "凭证未注入进程"}</StatusPill></div>
    <ModelConnectionPanel initial={model.data} onSaved={async () => { await model.refetch(); onRefresh(); }} />
    <div className="settings-card-grid">
      <RuntimeCard icon={Database} title="本地 MySQL" state={overview?.mysql === "configured"} value={overview?.mysql === "configured" ? "已有连接" : "按需连接"} text="测试只读连接、浏览数据库表，并选择要纳入数据资产中心的表。" actionLabel="连接并导入表" onAction={() => setMysqlOpen(true)} />
      <RuntimeCard icon={Cpu} title="代码沙箱" state={overview?.sandbox === "docker"} value={overview?.sandbox === "docker" ? "Docker 隔离" : String(overview?.sandbox ?? "检查中")} text="无网络、非 root，并限制 CPU、内存与执行时长。" />
      <RuntimeCard icon={KeyRound} title="凭证策略" state value="受保护加载" text="只交给真实消费者读取，不进入浏览器、日志或分析产物。" />
    </div>
    <button className="button secondary settings-refresh" onClick={onRefresh}><RefreshCw size={14} />重新检查运行状态</button>
    {mysqlOpen && <MySQLImportModal onClose={() => setMysqlOpen(false)} onImported={() => { setMysqlOpen(false); onRefresh(); }} />}
  </div>;
}

function RuntimeCard({ icon: Icon, title, state, value, text, actionLabel, onAction }: { icon: typeof Server; title: string; state: boolean; value: string; text: string; actionLabel?: string; onAction?: () => void }) {
  return <article className="runtime-card"><span><Icon size={19} /></span><div><header><h3>{title}</h3><StatusPill tone={state ? "good" : "warn"}>{value}</StatusPill></header><p>{text}</p>{actionLabel && <button className="runtime-card-action" onClick={onAction}>{actionLabel}<span>→</span></button>}</div></article>;
}

function ModelConnectionPanel({ initial, onSaved }: { initial?: { model_name: string; base_url: string; configured: boolean }; onSaved: () => void | Promise<void> }) {
  const [apiKey, setApiKey] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [modelName, setModelName] = useState(initial?.model_name ?? "deepseek-v4-flash");
  const [baseUrl, setBaseUrl] = useState(initial?.base_url ?? "https://api.deepseek.com");
  const [result, setResult] = useState("");
  useEffect(() => { if (initial) { setModelName(initial.model_name); setBaseUrl(initial.base_url); } }, [initial]);
  const payload = () => ({ ...(apiKey ? { api_key: apiKey } : {}), model_name: modelName, base_url: baseUrl });
  const test = useMutation({ mutationFn: () => api.testModelConnection(payload()), onSuccess: (value) => setResult(value.detail) });
  const save = useMutation({ mutationFn: () => api.updateModelConnection(payload()), onSuccess: async (value) => { setResult(value.detail); setApiKey(""); setRevealed(false); await onSaved(); } });
  return <form className="model-connection-panel" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
    <header><span className="model-connection-icon"><KeyRound size={21} /></span><div><span className="eyebrow">MODEL CONNECTION</span><h3>模型 API 与凭证</h3><p>在本页直接更换连接。新 Key 只提交给本机后端，真实测试通过后才写入权限为 600 的受保护文件。</p></div><StatusPill tone={initial?.configured ? "good" : "warn"}>{initial?.configured ? "当前凭证已保存" : "等待配置"}</StatusPill></header>
    <div className="model-connection-form">
      <label className="api-key-field"><span>API Key <small>{initial?.configured ? "连接不变时可留空；改模型或端点必须重填" : "必填"}</small></span><div><input aria-label="API Key" type={revealed ? "text" : "password"} autoComplete="new-password" value={apiKey} onChange={(event) => { setApiKey(event.target.value); setResult(""); }} placeholder={initial?.configured ? "••••••••••••••••（输入新 Key 可覆盖）" : "输入 API Key"} /><button type="button" aria-label={revealed ? "隐藏 API Key" : "显示 API Key"} onClick={() => setRevealed((value) => !value)}>{revealed ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>
      <label><span>模型名称</span><input value={modelName} onChange={(event) => { setModelName(event.target.value); setResult(""); }} /></label>
      <label><span>兼容 API Base URL</span><input value={baseUrl} onChange={(event) => { setBaseUrl(event.target.value); setResult(""); }} /></label>
    </div>
    {(test.error || save.error) && <ErrorState error={test.error || save.error} />}
    <footer><div>{result ? <span className="connection-success"><CheckCircle2 size={16} />{result}</span> : <span className="credential-privacy"><LockKeyhole size={14} />服务端不会把已保存的 Key 回传到页面</span>}</div><span><button type="button" className="button secondary" onClick={() => test.mutate()} disabled={test.isPending || save.isPending || !modelName || !baseUrl}><TestTube2 size={14} />{test.isPending ? "正在测试" : "测试连接"}</button><button className="button primary" disabled={save.isPending || test.isPending || !modelName || !baseUrl}><Save size={14} />{save.isPending ? "验证并保存中" : "验证并保存"}</button></span></footer>
  </form>;
}

function MySQLImportModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const client = useQueryClient();
  const [url, setUrl] = useState("");
  const [name, setName] = useState("本地 MySQL 数据资产");
  const [selected, setSelected] = useState<string[]>([]);
  const inspect = useMutation({ mutationFn: () => api.inspectMySQL(url), onSuccess: (value) => { setSelected(value.tables.map((table) => table.name)); if (value.database) setName(`${value.database} 数据库`); } });
  const importTables = useMutation({ mutationFn: () => api.importMySQLTables({ name, url, tables: selected }), onSuccess: async () => { await client.invalidateQueries({ queryKey: ["data-assets"] }); onImported(); } });
  function submit(event: FormEvent) { event.preventDefault(); if (inspect.data) importTables.mutate(); else inspect.mutate(); }
  const allSelected = Boolean(inspect.data?.tables.length) && selected.length === inspect.data?.tables.length;
  return <div className="modal-backdrop" onMouseDown={onClose}><form className="modal-card connection-modal mysql-import-modal" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}><span className="eyebrow">MYSQL IMPORT</span><h2>连接并选择数据表</h2><p>先验证只读连接并读取表目录，再把选中的表作为一项可复用数据资产纳入 DS4。</p><label>SQLAlchemy URL<input type="password" autoComplete="new-password" value={url} onChange={(event) => { setUrl(event.target.value); inspect.reset(); setSelected([]); }} placeholder="mysql+pymysql://reader:••••@127.0.0.1:3307/database" /></label>{inspect.data && <><label>数据资产名称<input value={name} onChange={(event) => setName(event.target.value)} /></label><section className="mysql-table-picker"><header><div><b>{inspect.data.database}</b><small>{inspect.data.tables.length} 张可访问表</small></div><label><input type="checkbox" checked={allSelected} onChange={(event) => setSelected(event.target.checked ? inspect.data!.tables.map((table) => table.name) : [])} />全选</label></header><div>{inspect.data.tables.map((table) => <label key={table.name}><input type="checkbox" checked={selected.includes(table.name)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, table.name] : current.filter((item) => item !== table.name))} /><span><b>{table.name}</b><small>{formatNumber(table.rows)} 行 · {table.columns.length} 字段</small></span></label>)}</div></section></>}{(inspect.error || importTables.error) && <ErrorState error={inspect.error || importTables.error} />}<div className="modal-actions"><button type="button" className="button ghost" onClick={onClose}>取消</button><button className="button primary" disabled={!url || inspect.isPending || importTables.isPending || (Boolean(inspect.data) && (!selected.length || !name.trim()))}>{inspect.isPending ? "正在读取表目录" : importTables.isPending ? "正在建立数据画像" : inspect.data ? `导入 ${selected.length} 张表` : "测试连接并读取表"}</button></div></form></div>;
}

function SecuritySettings({ overview }: { overview?: SystemOverview }) {
  return <div className="settings-section"><SettingsSectionHeader eyebrow="DATA & SECURITY" title="数据与安全" text="这些是 DS4 的承重边界。它们是系统级保护，不会被某个项目或 Skill 静默放宽。" />
    <div className="policy-stack">
      <PolicyRow icon={Database} title="数据库只读" text="查询连接启用只读事务，拒绝写入、多语句与越权文件访问。" locked />
      <PolicyRow icon={LockKeyhole} title="项目空间隔离" text="每条对话拥有独立目录；数据、代码、模型、预测与报告不会跨项目共享。" locked />
      <PolicyRow icon={ShieldCheck} title="最小上下文披露" text="远程模型看不到数据库密码、连接串、本地绝对路径、全量原始数据与其他项目内容。" locked />
      <PolicyRow icon={Cpu} title="Skill 脚本沙箱" text="脚本只能访问当前项目授权范围，并在无网络、非 root 的受限容器中运行。" locked />
    </div>
    <section className="settings-data-limits"><header><SlidersHorizontal size={18} /><div><h3>当前资源边界</h3><p>避免一次任务无意中耗尽本机资源。</p></div></header><div><span>单文件上传</span><b>{formatBytes(overview?.max_upload_bytes ?? 0)}</b></div><div><span>单项目原始数据</span><b>{formatBytes(overview?.max_project_source_bytes ?? 0)}</b></div><div><span>查询展示上限</span><b>{formatNumber(overview?.query_row_limit ?? 0)} 行</b></div><div><span>单次查询时限</span><b>{overview?.query_timeout_seconds ?? 0} 秒</b></div><div><span>训练任务时限</span><b>{Math.round((overview?.training_timeout_seconds ?? 0) / 60)} 分钟</b></div></section>
  </div>;
}

function PolicyRow({ icon: Icon, title, text, locked }: { icon: typeof Database; title: string; text: string; locked?: boolean }) {
  return <article><span><Icon size={19} /></span><div><h3>{title}</h3><p>{text}</p></div>{locked && <em><LockKeyhole size={13} />系统保护</em>}</article>;
}

function StorageSettings({ overview }: { overview?: SystemOverview }) {
  return <div className="settings-section"><SettingsSectionHeader eyebrow="STORAGE & EXPORT" title="存储与导出" text="数据、项目与 Skills 都保存在本机运行目录；项目可独立导出，删除后的工作区文件会继续留存在本机。" />
    <div className="storage-overview"><article><small>本地占用</small><strong>{formatBytes(overview?.runtime_bytes ?? 0)}</strong><p>包含数据资产、项目产物、模型、报告与缓存。</p></article><article><small>分析项目</small><strong>{overview?.project_count ?? 0}</strong><p>每个项目都有独立工作区与完整分析历史。</p></article><article><small>数据资产</small><strong>{overview?.data_asset_count ?? 0}</strong><p>全局登记，可复制绑定到不同项目。</p></article><article><small>删除留存</small><strong>{overview?.trash_items ?? 0}</strong><p>只保留项目文件；当前版本尚未提供自动恢复入口。</p></article></div>
    <div className="recovery-flow"><div><span><HardDrive size={18} /></span><section><small>01 · 工作中</small><h3>项目独立保存</h3><p>每次查询、代码、模型和报告版本都保留来源与哈希。</p></section></div><i /><div><span><RotateCcw size={18} /></span><section><small>02 · 删除时</small><h3>先留存项目文件</h3><p>项目文件先转移，再清理数据库记录；失败时自动回滚删除。</p></section></div><i /><div><span><CheckCircle2 size={18} /></span><section><small>03 · 需要带走</small><h3>按项目导出</h3><p>在首页的项目卡片上导出完整工作区与结构化清单。</p></section></div></div>
    <div className="settings-note"><Settings2 size={18} /><p><b>桌面本地模式</b><span>DS4 不注册开机自启服务，也不会把运行目录同步到第三方云盘。</span></p></div>
  </div>;
}

function AppearanceSettings() {
  return <div className="settings-section"><SettingsSectionHeader eyebrow="APPEARANCE" title="界面外观" text="选择适合当前工作环境的明暗模式与背景主题。修改会立即应用到首页和分析工作台。" /><div className="settings-appearance refined"><AppearanceControls /></div></div>;
}

function formatNumber(value: number) { return new Intl.NumberFormat("zh-CN").format(value); }
function formatBytes(value: number) { if (!value) return "0 B"; const units = ["B", "KB", "MB", "GB"]; const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1); return `${(value / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`; }
