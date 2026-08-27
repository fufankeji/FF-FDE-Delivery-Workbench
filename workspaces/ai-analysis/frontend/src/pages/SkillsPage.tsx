import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Code2,
  File,
  FileCode2,
  Folder,
  Maximize2,
  Minimize2,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import { ChangeEvent, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { api } from "../api";
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusPill } from "../components/Ui";
import type { Skill } from "../types";

const filters = [
  { id: "all", label: "全部 Skills" },
  { id: "builtin", label: "系统内置" },
  { id: "user", label: "用户安装" },
  { id: "scripts", label: "含执行脚本" },
];

export function SkillsPage() {
  const client = useQueryClient();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<Skill | null>(null);
  const skills = useQuery({ queryKey: ["skills"], queryFn: api.skills });
  const upload = useMutation({ mutationFn: api.uploadSkill, onSuccess: () => client.invalidateQueries({ queryKey: ["skills"] }) });
  const setDefault = useMutation({ mutationFn: ({ skillId, enabled }: { skillId: string; enabled: boolean }) => api.setDefaultSkill(skillId, enabled), onSuccess: () => client.invalidateQueries({ queryKey: ["skills"] }) });
  const uninstall = useMutation({ mutationFn: api.uninstallSkill, onSuccess: () => client.invalidateQueries({ queryKey: ["skills"] }) });
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (skills.data ?? []).filter((skill) => {
      const description = skillDescription(skill).toLowerCase();
      const matchesQuery = !needle || `${skill.name} ${skill.display_name} ${description} ${skill.body_excerpt} ${skill.highlights.join(" ")}`.toLowerCase().includes(needle);
      const matchesFilter = filter === "all" || skill.origin === filter || (filter === "scripts" && skill.has_scripts);
      return matchesQuery && matchesFilter;
    });
  }, [skills.data, query, filter]);
  const builtinCount = skills.data?.filter((skill) => skill.origin === "builtin").length ?? 0;
  const defaultCount = skills.data?.filter((skill) => skill.default_for_new_projects).length ?? 0;
  function pick(event: ChangeEvent<HTMLInputElement>) { const file = event.target.files?.[0]; if (file) upload.mutate(file); event.target.value = ""; }

  return <div className="page global-management-page">
    <PageHeader eyebrow="SKILLS LIBRARY" title="Skills技能中心" description="在这里管理系统可用的方法与工作流。安装是全局的，具体项目只有在主动启用后才能调用。" actions={<label className="button primary"><Upload size={15} />安装 Skill<input type="file" accept=".zip" onChange={pick} hidden /></label>} />

    <section className="skills-summary-strip" aria-label="Skills 概览"><span><strong>{skills.data?.length ?? 0}</strong> 已安装</span><i /><span><strong>{builtinCount}</strong> 系统内置</span><i /><span><strong>{defaultCount}</strong> 新项目默认</span><p><ShieldCheck size={15} />全局安装不读取数据；权限只在项目主动启用后生效。</p></section>

    <section className="management-catalog-shell skills-catalog-shell">
      <header className="management-section-heading"><div><span className="eyebrow">CAPABILITY CATALOG</span><h2>能力目录</h2><p>浏览、筛选和理解每个 Skill 的适用环节与安全边界。</p></div><span className="management-count"><b>{filtered.length}</b><small>/ {skills.data?.length ?? 0} 个 Skills</small></span></header>
      <section className="catalog-toolbar">
        <label className="catalog-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索 Skill 名称或能力说明" /></label>
        <div className="filter-row" aria-label="Skill 类型筛选">{filters.map((item) => <button type="button" className={filter === item.id ? "active" : ""} key={item.id} onClick={() => setFilter(item.id)}>{item.label}</button>)}</div>
      </section>

      {(upload.error || setDefault.error || uninstall.error) && <ErrorState error={upload.error || setDefault.error || uninstall.error} />}
      {upload.isPending && <div className="activity-banner"><Upload size={16} /><div><b>正在校验并安装 Skill</b><span>清单、权限、入口脚本和内容哈希必须全部通过。</span></div></div>}
      {skills.isLoading && <LoadingState label="读取 Skills 技能库" />}
      {!skills.isLoading && !skills.data?.length && <EmptyState title="Skills 技能库是空的" text="上传带有 SKILL.md 的 zip 包，或重新启动服务恢复内置报告 Skill。" />}
      {!skills.isLoading && skills.data?.length && !filtered.length ? <EmptyState title="没有匹配的 Skill" text="调整搜索词或类型筛选即可继续。" /> : null}

      <section className="skills-library-list">
        {filtered.map((skill) => <article className="library-skill-card content-first" key={skill.id}>
        <main className="library-skill-primary"><header><span className="skill-mark"><FileCode2 size={19} /></span><div><h2>{skillDisplayName(skill)}</h2><p>{skillDescription(skill)}</p></div></header>{skill.body_excerpt && <p className="skill-body-excerpt">{skill.body_excerpt}</p>}<ul className="skill-method-highlights">{skill.highlights.slice(0, 2).map((item) => <li key={item}><span />{item}</li>)}</ul><div className="skill-intent-row">{skill.applies_to.map((item) => <span key={item}>{intentLabel(item)}</span>)}</div></main>
        <aside className="library-skill-secondary"><div className="skill-origin-row"><StatusPill tone={skill.origin === "builtin" ? "good" : "neutral"}>{skill.origin === "builtin" ? "系统内置" : "用户安装"}</StatusPill>{skill.has_scripts && <StatusPill tone="warn"><Code2 size={12} />含脚本</StatusPill>}</div><dl><div><dt>内部名称</dt><dd><code>{skill.name}</code></dd></div><div><dt>版本</dt><dd>v{skill.version}</dd></div><div><dt>项目使用</dt><dd>{skill.project_count}</dd></div><div><dt>文件</dt><dd>{String(skill.manifest.file_count ?? "—")}</dd></div></dl><label className="default-skill-toggle"><span><b>新项目默认启用</b><small>只影响之后创建的项目</small></span><input type="checkbox" checked={skill.default_for_new_projects} onChange={(event) => setDefault.mutate({ skillId: skill.id, enabled: event.target.checked })} disabled={setDefault.isPending} /><i /></label><footer><button className="button secondary compact" onClick={() => setSelected(skill)}>阅读完整 SKILL.md</button><button className="icon-button danger" aria-label={`卸载 ${skill.name}`} title={skill.project_count ? "仍被项目使用，不能卸载" : "卸载 Skill"} disabled={skill.project_count > 0 || uninstall.isPending} onClick={() => window.confirm(`确定从本机卸载 ${skill.name} v${skill.version} 吗？`) && uninstall.mutate(skill.id)}><Trash2 size={14} /></button></footer></aside>
        </article>)}
      </section>
    </section>

    {selected && <SkillDetailModal skill={selected} onClose={() => setSelected(null)} />}
  </div>;
}

function SkillDetailModal({ skill, onClose }: { skill: Skill; onClose: () => void }) {
  const [selectedPath, setSelectedPath] = useState("SKILL.md");
  const [readerExpanded, setReaderExpanded] = useState(false);
  const inspection = useQuery({ queryKey: ["skill-inspection", skill.id, selectedPath], queryFn: () => api.skillInspection(skill.id, selectedPath) });
  const frontMatter = (skill.manifest.front_matter ?? {}) as Record<string, unknown>;
  const permissions = (frontMatter.permissions ?? {}) as Record<string, unknown>;
  const permissionLabels: Record<string, string> = { files: "文件", database: "数据库", network: "网络", code: "代码" };
  const appliesTo = Array.isArray(frontMatter.applies_to) ? frontMatter.applies_to.map(String) : ["all"];
  const entrypoints = Array.isArray(frontMatter.entrypoints) ? frontMatter.entrypoints.map(String) : [];
  const files = inspection.data?.files ?? [];
  return <div className="modal-backdrop" onMouseDown={onClose}><div className={`modal-card skill-detail-modal skill-inspector-modal${readerExpanded ? " reader-expanded" : ""}`} onMouseDown={(event) => event.stopPropagation()}>
    <header className="skill-inspector-header"><div><span className="eyebrow">SKILL QUALITY INSPECTOR</span><h2>{skillDisplayName(skill)}</h2><p>{skillDescription(skill)}</p></div><button className="button ghost compact" onClick={onClose}>关闭</button></header>
    <div className="skill-source-workspace">
      <aside><header><Folder size={15} /><b>Skill 结构</b><span>{files.filter((item) => item.kind === "file").length} 文件</span></header><div>{files.map((item) => item.kind === "directory" ? <span className="skill-tree-directory" key={item.path}><Folder size={14} />{item.path}</span> : <button type="button" className={selectedPath === item.path ? "active" : ""} key={item.path} onClick={() => setSelectedPath(item.path)}><File size={14} /><span>{item.path}</span><small>{formatBytes(item.size ?? 0)}</small></button>)}</div></aside>
      <main><header><div><FileCode2 size={16} /><b>{inspection.data?.selected_path ?? selectedPath}</b></div><div className="skill-reader-actions">{inspection.data?.truncated && <StatusPill tone="warn">内容已截断</StatusPill>}<button type="button" className="skill-reader-maximize" aria-label={readerExpanded ? "退出最大化阅读" : "最大化阅读区域"} onClick={() => setReaderExpanded((current) => !current)}>{readerExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}<span>{readerExpanded ? "退出专注" : "最大化阅读"}</span></button></div></header>{inspection.isLoading && <LoadingState label="读取 Skill 文件" />}{inspection.error && <ErrorState error={inspection.error} />}{inspection.data && (selectedPath.toLowerCase().endsWith(".md") ? <article className="skill-markdown-preview"><ReactMarkdown remarkPlugins={[remarkGfm]}>{renderSkillMarkdown(inspection.data.content)}</ReactMarkdown></article> : <pre className="skill-code-preview"><code>{inspection.data.content}</code></pre>)}</main>
    </div>
    <details className="skill-inspector-meta"><summary>Skill 权限与安装信息</summary><div><div className="skill-detail-identity"><span><small>内部名称</small><code>{skill.name}</code></span><span><small>版本</small><b>v{skill.version}</b></span><span><small>来源</small><b>{skill.origin === "builtin" ? "DS4 内置" : "用户安装"}</b></span></div><div className="skill-contract-strip"><section><h3>声明权限</h3><div className="permission-list">{Object.entries(permissionLabels).map(([key, label]) => <span key={key}><b>{label}</b>{permissionText(String(permissions[key] ?? "none"))}</span>)}</div></section><section><h3>适用环节</h3><div className="tag-cloud">{appliesTo.map((item) => <span key={item}>{intentLabel(item)}</span>)}</div>{entrypoints.length > 0 && <div className="code-list">{entrypoints.map((item) => <code key={item}>scripts/{item}</code>)}</div>}</section><section><h3>项目使用</h3>{skill.project_titles.length ? <div className="tag-cloud">{skill.project_titles.map((item) => <span key={item}>{item}</span>)}</div> : <p className="quiet-copy">当前没有项目启用。</p>}</section></div></div></details>
    <div className="skill-inspector-footer"><span><small>内容哈希</small><code>{skill.content_hash}</code></span><button className="button primary" onClick={onClose}>检查完成</button></div>
  </div></div>;
}

function skillDescription(skill: Skill) { const frontMatter = skill.manifest.front_matter as Record<string, unknown> | undefined; return String(frontMatter?.description ?? "可复用的数据分析方法与工作流"); }
function skillDisplayName(skill: Skill) { return skill.display_name || skill.name.replaceAll("-", " "); }
function permissionText(value: string) { return ({ none: "禁止", "project-read": "当前项目只读", "project-read-write": "当前项目读写", "read-only": "只读结构化工具", "structured-tools-only": "仅结构化工具", "sandbox-only": "无网络沙箱" } as Record<string, string>)[value] ?? value; }
function intentLabel(value: string) { return ({ all: "全部环节", reporting: "分析报告", visualization: "可视化", modeling: "机器学习", exploration: "探索分析", data_qa: "数据问答" } as Record<string, string>)[value] ?? value; }
function formatBytes(value: number) { if (!value) return "0 B"; const units = ["B", "KB", "MB"]; const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1); return `${(value / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`; }
function renderSkillMarkdown(content: string) {
  if (!content.startsWith("---\n")) return content;
  const closing = content.indexOf("\n---", 4);
  if (closing < 0) return content;
  const frontMatter = content.slice(4, closing);
  const body = content.slice(closing + 4).trimStart();
  return `### SKILL.md 元数据\n\n\`\`\`yaml\n${frontMatter}\n\`\`\`\n\n${body}`;
}
