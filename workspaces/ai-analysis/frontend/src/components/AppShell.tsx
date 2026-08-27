import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Database,
  LibraryBig,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Settings,
  Sparkles,
  Trash2,
} from "lucide-react";
import { CSSProperties, PointerEvent, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

import { api } from "../api";

const SIDEBAR_DEFAULT = 246;
const SIDEBAR_MIN = 220;
const SIDEBAR_MAX = 360;
const SIDEBAR_COLLAPSED = 76;

function initialSidebarWidth() {
  const stored = Number(localStorage.getItem("northlight-sidebar-width"));
  return Number.isFinite(stored) && stored >= SIDEBAR_MIN && stored <= SIDEBAR_MAX
    ? stored
    : SIDEBAR_DEFAULT;
}

export function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const projects = useQuery({ queryKey: ["projects"], queryFn: api.projects });
  const createProject = useMutation({
    mutationFn: () => api.createProject("未命名分析"),
    onSuccess: async (project) => {
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      navigate(`/projects/${project.id}/chat`);
    },
  });
  const renameProject = useMutation({
    mutationFn: ({ projectId, title }: { projectId: string; title: string }) => api.updateProject(projectId, { title }),
    onSuccess: async (project) => {
      queryClient.setQueryData(["project", project.id], project);
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
  const deleteProject = useMutation({
    mutationFn: (projectId: string) => api.deleteProject(projectId),
    onSuccess: async (_result, projectId) => {
      queryClient.removeQueries({ queryKey: ["project", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      if (location.pathname.startsWith(`/projects/${projectId}`)) navigate("/");
    },
  });
  const [sidebarWidth, setSidebarWidth] = useState(initialSidebarWidth);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem("northlight-sidebar-collapsed") === "true",
  );
  const [resizeOrigin, setResizeOrigin] = useState<{ pointerX: number; width: number } | null>(null);
  const renderedWidth = sidebarCollapsed ? SIDEBAR_COLLAPSED : sidebarWidth;
  const frameStyle = { "--sidebar-width": `${renderedWidth}px` } as CSSProperties;
  const isConversation = /^\/projects\/[^/]+\/chat/.test(location.pathname);
  const hasProjects = (projects.data?.length ?? 0) > 0;

  function toggleSidebar() {
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    localStorage.setItem("northlight-sidebar-collapsed", String(next));
  }

  function startResize(event: PointerEvent<HTMLButtonElement>) {
    if (sidebarCollapsed) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setResizeOrigin({ pointerX: event.clientX, width: sidebarWidth });
  }

  function resizeSidebar(event: PointerEvent<HTMLButtonElement>) {
    if (!resizeOrigin || sidebarCollapsed) return;
    setSidebarWidth(Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, resizeOrigin.width + event.clientX - resizeOrigin.pointerX)));
  }

  function finishResize(event: PointerEvent<HTMLButtonElement>) {
    if (!resizeOrigin) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    localStorage.setItem("northlight-sidebar-width", String(sidebarWidth));
    setResizeOrigin(null);
  }

  function resizeWithKeyboard(direction: number) {
    if (sidebarCollapsed) return;
    setSidebarWidth((current) => {
      const next = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, current + direction * 12));
      localStorage.setItem("northlight-sidebar-width", String(next));
      return next;
    });
  }

  function requestRename(projectId: string, currentTitle: string) {
    const nextTitle = window.prompt("修改会话名称", currentTitle)?.trim();
    if (nextTitle && nextTitle !== currentTitle) renameProject.mutate({ projectId, title: nextTitle });
  }

  function requestDelete(projectId: string, title: string) {
    if (window.confirm(`确定删除“${title}”吗？项目中的数据、分析结果和报告将移入回收区。`)) {
      deleteProject.mutate(projectId);
    }
  }

  return (
    <div className={`app-frame ${isConversation ? "app-frame-conversation" : ""}`} style={frameStyle}>
      <aside className={`sidebar ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
        <div className="sidebar-heading">
          <NavLink to="/" className="brand" aria-label="DS4-AI数据分析首页">
            <span className="brand-mark"><img src="/assets/fan-space-logo.png" alt="赋范空间团队 Logo" /></span>
            <span><b>DS4-AI数据分析</b><small>智能数据分析工作台</small></span>
          </NavLink>
          <button className="sidebar-toggle" type="button" aria-label={sidebarCollapsed ? "展开左侧栏" : "收起左侧栏"} aria-expanded={!sidebarCollapsed} onClick={toggleSidebar}>
            {sidebarCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>
        </div>

        <button className="sidebar-new-analysis" type="button" onClick={() => createProject.mutate()} disabled={createProject.isPending}>
          <Plus size={18} /><span>{createProject.isPending ? "正在创建…" : "新建分析"}</span>
        </button>

        <nav className="primary-nav" aria-label="主要导航">
          <NavLink to="/data"><Database size={17} /><span>数据资产</span></NavLink>
          <NavLink to="/skills"><LibraryBig size={17} /><span>Skills技能中心</span></NavLink>
          <NavLink to="/architecture"><Network size={17} /><span>功能架构</span></NavLink>
          <NavLink to="/settings"><Settings size={17} /><span>系统设置</span></NavLink>
        </nav>

        <section className="history-list">
          <header><span>最近分析项目</span></header>
          {projects.data?.slice(0, 8).map((project) => (
            <div className="history-row" key={project.id}>
              <NavLink className="history-item" to={`/projects/${project.id}/chat`}>
                <span className="history-dot" />
                <span><b>{project.title}</b><small>{formatRelative(project.updated_at)}</small></span>
              </NavLink>
              <span className="history-actions">
                <button type="button" aria-label={`重命名 ${project.title}`} title="重命名" onClick={() => requestRename(project.id, project.title)}><Pencil size={13} /></button>
                <button type="button" aria-label={`删除 ${project.title}`} title="删除" onClick={() => requestDelete(project.id, project.title)}><Trash2 size={13} /></button>
              </span>
            </div>
          ))}
          {projects.isError && !hasProjects && (
            <div className="sidebar-load-error" role="status">
              <span>历史项目暂时无法载入</span>
              <button type="button" onClick={() => projects.refetch()} disabled={projects.isFetching}>
                {projects.isFetching ? "正在重试…" : "重新载入"}
              </button>
            </div>
          )}
          {projects.isLoading && !hasProjects && (
            <p className="sidebar-empty">正在恢复历史项目…</p>
          )}
          {!projects.isLoading && !projects.isError && !hasProjects && (
            <p className="sidebar-empty">第一个对话会在这里成为独立项目。</p>
          )}
        </section>

        <section className="sidebar-editorial-card" aria-label="DS4 智能工作区">
          <Sparkles size={18} />
          {isConversation
            ? <div><span>DS4 ANALYSIS</span><b>让数据，直接回答业务问题。</b><small>从查询、图表到模型与报告，全部留在当前项目。</small></div>
            : <div><span>DS4 WORKSPACE</span><b>统一准备分析资产。</b><small>管理数据、Skills 与运行环境，再进入项目完成业务任务。</small></div>}
        </section>
        <div className="privacy-chip"><span />本地优先 · 项目隔离</div>
        <button
          className="sidebar-resize-handle"
          type="button"
          role="separator"
          aria-label="拖拽调整左侧栏宽度"
          aria-orientation="vertical"
          aria-valuemin={SIDEBAR_MIN}
          aria-valuemax={SIDEBAR_MAX}
          aria-valuenow={sidebarWidth}
          onPointerDown={startResize}
          onPointerMove={resizeSidebar}
          onPointerUp={finishResize}
          onPointerCancel={finishResize}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") resizeWithKeyboard(-1);
            if (event.key === "ArrowRight") resizeWithKeyboard(1);
          }}
        />
      </aside>
      <main className="main-stage"><Outlet /></main>
    </div>
  );
}

function formatRelative(value: string) {
  const hours = Math.floor((Date.now() - new Date(value).getTime()) / 3_600_000);
  if (hours < 1) return "刚刚";
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
}
