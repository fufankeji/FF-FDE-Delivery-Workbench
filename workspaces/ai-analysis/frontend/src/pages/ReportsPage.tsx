import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FilePlus2, History, Mountain, Plus } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router-dom";

import { api } from "../api";
import { ReportCanvas } from "../components/ReportCanvas";
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusPill } from "../components/Ui";
import type { ReportVersion } from "../types";

export function ReportsPage() {
  const { projectId = "" } = useParams();
  const client = useQueryClient();
  const [active, setActive] = useState<ReportVersion | null>(null);
  const reports = useQuery({ queryKey: ["reports", projectId], queryFn: () => api.reports(projectId) });
  const artifacts = useQuery({ queryKey: ["artifacts", projectId], queryFn: () => api.artifacts(projectId) });
  const create = useMutation({ mutationFn: () => api.createReport(projectId, "完整数据分析报告", (artifacts.data ?? []).map((item) => item.id)), onSuccess: async (report) => { await client.invalidateQueries({ queryKey: ["reports", projectId] }); setActive(report); } });
  return <div className={`page report-workspace ${active ? "with-canvas" : ""}`}><div className="report-page-main"><PageHeader eyebrow="REPORT WORKSPACE" title="报告工作台" description="Markdown 是内容真相源；每次编辑与恢复都会创建新版本，HTML 只从选定版本生成。" actions={<button className="button primary" onClick={() => create.mutate()} disabled={create.isPending}><Plus size={15} />新建完整报告</button>} />
    {reports.isLoading && <LoadingState label="读取报告版本" />}{reports.error && <ErrorState error={reports.error} />}{!reports.isLoading && !reports.data?.length && <EmptyState title="还没有报告" text="默认报告 Skill 会读取当前项目的真实来源和产物，先生成完整结构，再允许在 Canvas 中继续修改。" action={<button className="button secondary" onClick={() => create.mutate()}><FilePlus2 size={15} />生成第一份报告</button>} />}
    <div className="report-grid">{reports.data?.map((report) => <button className="report-card" key={report.id} onClick={() => setActive(report)}><span className="report-cover"><Mountain size={44} /><i /></span><span className="report-card-body"><StatusPill tone="good">Markdown v{report.version}</StatusPill><b>{report.title}</b><small>{report.note}</small><em><History size={13} />{new Date(report.created_at).toLocaleString("zh-CN")}</em></span></button>)}</div></div>{active && <ReportCanvas projectId={projectId} report={active} onClose={() => setActive(null)} />}</div>;
}
