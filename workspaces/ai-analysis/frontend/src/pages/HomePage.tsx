import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, ArrowRight, ChartNoAxesCombined, Database, Download, ExternalLink, FileSpreadsheet, LibraryBig, Pencil, Plus, RotateCcw } from "lucide-react";
import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";

import { api } from "../api";
import { EmptyState, ErrorState, LoadingState } from "../components/Ui";

export function HomePage() {
  const [title, setTitle] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const projects = useQuery({ queryKey: ["projects"], queryFn: api.projects });
  const create = useMutation({
    mutationFn: api.createProject,
    onSuccess: async (project) => {
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      navigate(`/projects/${project.id}/chat`);
    },
  });
  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { title?: string; status?: "ready" | "archived" } }) => api.updateProject(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
  });

  function renameProject(id: string, current: string) {
    const title = window.prompt("新的项目名称", current)?.trim();
    if (title && title !== current) update.mutate({ id, payload: { title } });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (title.trim()) create.mutate(title.trim());
  }

  return (
    <div className="page home-page">
      <header className="home-toolbar">
        <div className="home-toolbar-copy">
          <span className="eyebrow">ANALYSIS WORKSPACE</span>
          <div className="home-toolbar-message"><h2>今天，想分析什么？</h2><p>连接新数据，或继续最近的分析项目。</p></div>
        </div>
        <button className="button secondary home-toolbar-action" onClick={() => setComposerOpen(true)}><Plus size={15} />新建分析项目</button>
      </header>

      <section className="hero-panel">
        <div className="hero-copy">
          <a className="eyebrow hero-credit" href="https://beyondata.com" target="_blank" rel="noreferrer">赋范空间团队出品<ExternalLink size={12} /></a>
          <h1><span>DS4-AI</span><span>数据分析系统</span></h1>
          <strong>让数据，直接回答业务问题。</strong>
          <p>连接文件与数据库，用自然语言完成查询、可视化、建模与报告。每一次分析，都沉淀为可追溯、可继续工作的独立项目。</p>
          <button className="button primary large" onClick={() => setComposerOpen(true)}>新建分析项目<ArrowRight size={17} /></button>
          <div className="hero-trust" aria-label="产品特性"><span>本地优先</span><span>项目隔离</span><span>过程可追溯</span></div>
        </div>
        <div className="hero-mountain" aria-hidden="true"><div className="signal-line" /><span className="signal one" /><span className="signal two" /></div>
      </section>

      <section className="capability-strip">
        <article><ChartNoAxesCombined /><div><b>交互式数据分析</b><span>用对话驱动查询、图表、建模与预测</span></div></article>
        <article><Database /><div><b>海量数据源</b><span>CSV、Excel、SQLite 与 MySQL 统一分析</span></div></article>
        <article><LibraryBig /><div><b>可拓展 Skills 系统</b><span>按业务场景装配专属方法与工作流</span></div></article>
        <article><FileSpreadsheet /><div><b>可追溯、可定制分析报告</b><span>证据、图表和版本完整保留并持续修改</span></div></article>
      </section>

      <section className="section-block">
        <div className="section-heading"><div><span className="eyebrow">RECENT PROJECTS</span><h2>继续分析</h2></div><button className="button ghost compact" onClick={() => setShowArchived((current) => !current)}>{showArchived ? "隐藏归档" : "查看归档"}</button></div>
        {projects.isLoading && <LoadingState label="读取本地项目" />}
        {projects.error && <ErrorState error={projects.error} />}
        {!projects.isLoading && !projects.data?.length && (
          <EmptyState title="开始第一个分析项目" text="连接数据或直接提问，DS4 会为本次分析建立独立工作区。" action={<button className="button secondary" onClick={() => setComposerOpen(true)}>新建项目</button>} />
        )}
        <div className="project-grid">
          {projects.data?.filter((project) => showArchived ? project.status === "archived" : project.status !== "archived").map((project, index) => (
            <article className={`project-card ${project.status === "archived" ? "archived" : ""}`} key={project.id}>
              <button className="project-open" onClick={() => navigate(`/projects/${project.id}/chat`)}>
                <span className={`project-visual visual-${index % 3}`}><i /></span>
                <span className="project-meta"><small>{new Date(project.updated_at).toLocaleDateString("zh-CN")}</small><b>{project.title}</b><em>{project.status === "archived" ? "只读查看归档" : "进入分析空间"} <ArrowRight size={14} /></em></span>
              </button>
              <span className="project-card-actions"><button aria-label={`重命名 ${project.title}`} onClick={() => renameProject(project.id, project.title)}><Pencil size={13} /></button><a aria-label={`导出 ${project.title}`} href={api.projectExportUrl(project.id)}><Download size={13} /></a><button aria-label={`${project.status === "archived" ? "恢复" : "归档"} ${project.title}`} onClick={() => update.mutate({ id: project.id, payload: { status: project.status === "archived" ? "ready" : "archived" } })}>{project.status === "archived" ? <RotateCcw size={13} /> : <Archive size={13} />}</button></span>
            </article>
          ))}
        </div>
      </section>

      {composerOpen && (
        <div className="modal-backdrop" onMouseDown={() => setComposerOpen(false)}>
          <form className="modal-card" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
            <span className="eyebrow">NEW ANALYSIS PROJECT</span><h2>这次想分析什么？</h2>
            <p>一个项目对应一条对话和一套独立工作区。创建后再选择或上传数据。</p>
            <label>项目名称<input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：Olist 履约与满意度分析" /></label>
            {create.error && <ErrorState error={create.error} />}
            <div className="modal-actions"><button type="button" className="button ghost" onClick={() => setComposerOpen(false)}>取消</button><button className="button primary" disabled={!title.trim() || create.isPending}>{create.isPending ? "正在创建…" : "创建并进入对话"}</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
