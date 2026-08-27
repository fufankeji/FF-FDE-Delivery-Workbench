import type {
  Artifact,
  ArtifactData,
  AnalysisRun,
  ChatResponse,
  DataAsset,
  DataAssetPreview,
  Health,
  Message,
  ModelJob,
  ModelConnectionStatus,
  MySQLInspection,
  Project,
  ReportContent,
  ReportVersion,
  Skill,
  SkillInspection,
  ProjectSkill,
  Source,
  SystemOverview,
  VisualData,
} from "./types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(payload.detail ?? response.statusText);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export type ChatStreamEvent =
  | { type: "intent"; intent: string }
  | { type: "activity"; label: string }
  | { type: "token"; content: string }
  | { type: "tool"; name: string; state: "running" | "succeeded" | "failed"; callId: string; argNames: string[] }
  | { type: "run_created"; runId: string; status: string; title: string; intent: string }
  | { type: "plan_ready"; runId: string; plan: { key: string; label: string }[] }
  | { type: "run_completed"; runId: string; status: string; artifactIds: string[]; error: string | null }
  | { type: "error"; message: string; runId: string }
  | { type: "message"; response: ChatResponse }
  | { type: "done" };

async function streamChat(
  projectId: string,
  message: string,
  sourceIds: string[],
  skillIds: string[],
  onEvent: (event: ChatStreamEvent) => void,
  retryOfRunId?: string,
): Promise<ChatResponse> {
  const response = await fetch(`/api/projects/${projectId}/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({ message, source_ids: sourceIds, skill_ids: skillIds, retry_of_run_id: retryOfRunId }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(payload.detail ?? response.statusText);
  }
  if (!response.body) throw new Error("The browser did not expose the chat event stream");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalResponse: ChatResponse | null = null;
  const consume = (block: string) => {
    let eventType = "message";
    const data: string[] = [];
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith("event:")) eventType = line.slice(6).trim();
      if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
    }
    if (!data.length) return;
    const payload = JSON.parse(data.join("\n")) as Record<string, unknown>;
    if (eventType === "intent") onEvent({ type: "intent", intent: String(payload.intent) });
    if (eventType === "activity") onEvent({ type: "activity", label: String(payload.label) });
    if (eventType === "token") onEvent({ type: "token", content: String(payload.content) });
    if (eventType === "tool") onEvent({
      type: "tool",
      name: String(payload.name),
      state: String(payload.state) as "running" | "succeeded" | "failed",
      callId: String(payload.call_id ?? ""),
      argNames: Array.isArray(payload.arg_names) ? payload.arg_names.map(String) : [],
    });
    if (eventType === "run_created") onEvent({ type: "run_created", runId: String(payload.run_id), status: String(payload.status), title: String(payload.title), intent: String(payload.intent) });
    if (eventType === "plan_ready") onEvent({ type: "plan_ready", runId: String(payload.run_id), plan: Array.isArray(payload.plan) ? payload.plan.map((item) => ({ key: String((item as Record<string, unknown>).key), label: String((item as Record<string, unknown>).label) })) : [] });
    if (eventType === "run_completed") onEvent({ type: "run_completed", runId: String(payload.run_id), status: String(payload.status), artifactIds: Array.isArray(payload.artifact_ids) ? payload.artifact_ids.map(String) : [], error: payload.error ? String(payload.error) : null });
    if (eventType === "error") onEvent({ type: "error", message: String(payload.message), runId: String(payload.run_id) });
    if (eventType === "message") {
      finalResponse = payload as ChatResponse;
      onEvent({ type: "message", response: finalResponse });
    }
    if (eventType === "done") onEvent({ type: "done" });
  };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() ?? "";
    blocks.forEach(consume);
    if (done) break;
  }
  if (buffer.trim()) consume(buffer);
  if (!finalResponse) throw new Error("Chat stream ended without a final assistant message");
  return finalResponse;
}

export const api = {
  health: () => request<Health>("/api/health"),
  projects: () => request<Project[]>("/api/projects"),
  createProject: (title: string) =>
    request<Project>("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    }),
  updateProject: (projectId: string, payload: { title?: string; status?: "ready" | "archived" }) =>
    request<Project>(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  deleteProject: (projectId: string) =>
    request<void>(`/api/projects/${projectId}`, { method: "DELETE" }),
  projectExportUrl: (projectId: string) => `/api/projects/${projectId}/export`,
  dataAssets: () => request<DataAsset[]>("/api/data-assets"),
  uploadDataAsset: (sourceType: string, file: File) => {
    const body = new FormData();
    body.append("source_type", sourceType);
    body.append("upload", file);
    return request<DataAsset>("/api/data-assets/file", { method: "POST", body });
  },
  connectDataAssetMySQL: (name: string, url: string) =>
    request<DataAsset>("/api/data-assets/mysql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, url }),
    }),
  updateDataAsset: (assetId: string, payload: { name?: string; description?: string; tags?: string[] }) =>
    request<DataAsset>(`/api/data-assets/${assetId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  reprofileDataAsset: (assetId: string) =>
    request<DataAsset>(`/api/data-assets/${assetId}/reprofile`, { method: "POST" }),
  bindDataAsset: (projectId: string, assetId: string) =>
    request<Source>(`/api/projects/${projectId}/data-assets/${assetId}/bind`, { method: "POST" }),
  deleteDataAsset: (assetId: string) =>
    request<void>(`/api/data-assets/${assetId}`, { method: "DELETE" }),
  dataAssetPreview: (assetId: string, unit?: string, offset = 0, limit = 200) => {
    const params = new URLSearchParams({ offset: String(offset), limit: String(limit) });
    if (unit) params.set("unit", unit);
    return request<DataAssetPreview>(`/api/data-assets/${assetId}/preview?${params.toString()}`);
  },
  updateDataAssetDictionary: (assetId: string, unit: string, descriptions: Record<string, string>) =>
    request<DataAsset>(`/api/data-assets/${assetId}/dictionary`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unit, descriptions }),
    }),
  sources: (projectId: string) => request<Source[]>(`/api/projects/${projectId}/sources`),
  checkSource: (projectId: string, sourceId: string) =>
    request<Source>(`/api/projects/${projectId}/sources/${sourceId}/check`, { method: "POST" }),
  reprofileSource: (projectId: string, sourceId: string) =>
    request<Source>(`/api/projects/${projectId}/sources/${sourceId}/reprofile`, { method: "POST" }),
  uploadSource: (projectId: string, sourceType: string, file: File) => {
    const body = new FormData();
    body.append("source_type", sourceType);
    body.append("upload", file);
    return request<Source>(`/api/projects/${projectId}/sources/file`, { method: "POST", body });
  },
  connectMySQL: (projectId: string, name: string, url: string) =>
    request<Source>(`/api/projects/${projectId}/sources/mysql`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, url }),
    }),
  artifacts: (projectId: string) =>
    request<Artifact[]>(`/api/projects/${projectId}/artifacts`),
  query: (projectId: string, sourceId: string, sql: string, name: string, metadata: Record<string, unknown> = {}) =>
    request<Artifact>(`/api/projects/${projectId}/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source_id: sourceId, sql, name, ...metadata }),
    }),
  chart: (
    projectId: string,
    payload: { artifact_id: string; chart_type: string; x: string; y: string[]; title: string },
  ) =>
    request<Artifact>(`/api/projects/${projectId}/charts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  profile: (projectId: string, artifactId: string) =>
    request<Artifact>(`/api/projects/${projectId}/analysis/profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ artifact_id: artifactId, name: "数据质量画像" }),
    }),
  clean: (projectId: string, artifactId: string) =>
    request<Record<string, Artifact>>(`/api/projects/${projectId}/analysis/clean`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        artifact_id: artifactId,
        name: "标准清洗数据集",
        drop_duplicates: true,
        fill_missing: "median_mode",
        clip_outliers: false,
      }),
    }),
  features: (projectId: string, artifactId: string, dateColumns: string[], logColumns: string[]) =>
    request<Record<string, Artifact>>(`/api/projects/${projectId}/analysis/features`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        artifact_id: artifactId,
        name: "特征工程数据集",
        date_columns: dateColumns,
        log_columns: logColumns,
        ratios: [],
      }),
    }),
  model: (projectId: string, payload: Record<string, unknown>) =>
    request<Record<string, Artifact>>(`/api/projects/${projectId}/models`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  startModelJob: (projectId: string, payload: Record<string, unknown>) =>
    request<ModelJob>(`/api/projects/${projectId}/model-jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  modelJob: (projectId: string, jobId: string) =>
    request<ModelJob>(`/api/projects/${projectId}/model-jobs/${jobId}`),
  cancelModelJob: (projectId: string, jobId: string) =>
    request<ModelJob>(`/api/projects/${projectId}/model-jobs/${jobId}`, { method: "DELETE" }),
  predict: (projectId: string, modelArtifactId: string, dataArtifactId: string) =>
    request<Artifact>(`/api/projects/${projectId}/predictions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model_artifact_id: modelArtifactId,
        data_artifact_id: dataArtifactId,
        name: "当前数据集预测结果",
      }),
    }),
  chat: (projectId: string, message: string) =>
    request<ChatResponse>(`/api/projects/${projectId}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    }),
  chatStream: (
    projectId: string,
    message: string,
    sourceIds: string[],
    skillIds: string[],
    onEvent: (event: ChatStreamEvent) => void,
    retryOfRunId?: string,
  ) => streamChat(projectId, message, sourceIds, skillIds, onEvent, retryOfRunId),
  messages: (projectId: string) => request<Message[]>(`/api/projects/${projectId}/messages`),
  runs: (projectId: string) => request<AnalysisRun[]>(`/api/projects/${projectId}/runs`),
  run: (projectId: string, runId: string) => request<AnalysisRun>(`/api/projects/${projectId}/runs/${runId}`),
  cancelRun: (projectId: string, runId: string) => request<AnalysisRun>(`/api/projects/${projectId}/runs/${runId}`, { method: "DELETE" }),
  shareArtifacts: (projectId: string, artifactIds: string[], content: string, intent = "project_ops") =>
    request<Message>(`/api/projects/${projectId}/messages/artifacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ artifact_ids: artifactIds, content, intent }),
    }),
  artifactData: (
    projectId: string,
    artifactId: string,
    options: { offset?: number; limit?: number; sortBy?: string; sortOrder?: "asc" | "desc"; filterColumn?: string; filterValue?: string } = {},
  ) => {
    const params = new URLSearchParams({
      limit: String(options.limit ?? 25),
      offset: String(options.offset ?? 0),
      sort_order: options.sortOrder ?? "asc",
    });
    if (options.sortBy) params.set("sort_by", options.sortBy);
    if (options.filterColumn) params.set("filter_column", options.filterColumn);
    if (options.filterValue) params.set("filter_value", options.filterValue);
    return (
    request<ArtifactData>(
      `/api/projects/${projectId}/artifacts/${artifactId}/data?${params.toString()}`,
    ));
  },
  artifactDownloadUrl: (projectId: string, artifactId: string) =>
    `/api/projects/${projectId}/artifacts/${artifactId}/download`,
  visualData: (projectId: string, visualId: string) =>
    request<VisualData>(`/api/projects/${projectId}/visuals/${visualId}/data`),
  createReport: (projectId: string, title: string, artifactIds: string[], runId?: string, summary?: string, businessQuestion?: string) =>
    request<ReportVersion>(`/api/projects/${projectId}/reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, artifact_ids: artifactIds, run_id: runId, summary, business_question: businessQuestion }),
    }),
  reports: (projectId: string) =>
    request<ReportVersion[]>(`/api/projects/${projectId}/reports`),
  reportVersions: (projectId: string, reportKey: string) =>
    request<ReportVersion[]>(`/api/projects/${projectId}/reports/${reportKey}`),
  reportContent: (projectId: string, reportKey: string, version: number) =>
    request<ReportContent>(
      `/api/projects/${projectId}/reports/${reportKey}/content/${version}`,
    ),
  reviseReport: (projectId: string, reportKey: string, markdown: string, note: string) =>
    request<ReportVersion>(`/api/projects/${projectId}/reports/${reportKey}/revisions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markdown, note }),
    }),
  restoreReport: (projectId: string, reportKey: string, version: number) =>
    request<ReportVersion>(
      `/api/projects/${projectId}/reports/${reportKey}/restore/${version}`,
      { method: "POST" },
    ),
  generateReportHtml: (projectId: string, reportKey: string, version: number) =>
    request<{ path: string }>(
      `/api/projects/${projectId}/reports/${reportKey}/html/${version}`,
      { method: "POST" },
    ),
  reportHtmlUrl: (projectId: string, reportKey: string, version: number) =>
    `/api/projects/${projectId}/reports/${reportKey}/html/${version}`,
  skills: () => request<Skill[]>("/api/skills"),
  skillInspection: (skillId: string, path = "SKILL.md") =>
    request<SkillInspection>(`/api/skills/${encodeURIComponent(skillId)}/inspection?path=${encodeURIComponent(path)}`),
  setDefaultSkill: (skillId: string, enabled: boolean) =>
    request<Skill>(`/api/skills/${encodeURIComponent(skillId)}/default`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    }),
  systemOverview: () => request<SystemOverview>("/api/system/overview"),
  modelConnection: () => request<ModelConnectionStatus>("/api/system/model-connection"),
  testModelConnection: (payload: { api_key?: string; model_name: string; base_url: string }) =>
    request<ModelConnectionStatus>("/api/system/model-connection/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  updateModelConnection: (payload: { api_key?: string; model_name: string; base_url: string }) =>
    request<ModelConnectionStatus>("/api/system/model-connection", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  inspectMySQL: (url: string) => request<MySQLInspection>("/api/system/mysql/inspect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  }),
  importMySQLTables: (payload: { name: string; url: string; tables: string[] }) =>
    request<DataAsset>("/api/system/mysql/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  uploadSkill: (file: File) => {
    const body = new FormData();
    body.append("upload", file);
    return request<Skill>("/api/skills/upload", { method: "POST", body });
  },
  enableSkill: (projectId: string, skillId: string, permissions: Record<string, unknown>) =>
    request(`/api/projects/${projectId}/skills/${encodeURIComponent(skillId)}/enable`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(permissions),
    }),
  upgradeSkill: (projectId: string, skillId: string, permissions: Record<string, unknown>) =>
    request(`/api/projects/${projectId}/skills/${encodeURIComponent(skillId)}/upgrade`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(permissions),
    }),
  projectSkills: (projectId: string) =>
    request<ProjectSkill[]>(`/api/projects/${projectId}/skills`),
  disableSkill: (projectId: string, skillId: string) =>
    request<void>(`/api/projects/${projectId}/skills/${encodeURIComponent(skillId)}`, {
      method: "DELETE",
    }),
  uninstallSkill: (skillId: string) =>
    request<void>(`/api/skills/${encodeURIComponent(skillId)}`, { method: "DELETE" }),
  runSkill: (projectId: string, skillId: string, script: string, args: string[]) =>
    request<Record<string, unknown>>(
      `/api/projects/${projectId}/skills/${encodeURIComponent(skillId)}/run`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script, args }),
      },
    ),
};
