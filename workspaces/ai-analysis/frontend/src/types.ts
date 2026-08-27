export type Project = {
  id: string;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type Source = {
  id: string;
  project_id: string;
  type: "csv" | "excel" | "sqlite" | "mysql";
  name: string;
  status: string;
  fingerprint: string;
  baseline: Record<string, unknown>;
  created_at: string;
};

export type DataAssetUsage = {
  project_id: string;
  project_title: string;
  source_id: string;
  bound_at: string;
};

export type DataAsset = {
  id: string;
  type: "csv" | "excel" | "sqlite" | "mysql";
  name: string;
  description: string;
  tags: string[];
  status: string;
  fingerprint: string;
  baseline: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  usage: DataAssetUsage[];
};

export type DataAssetPreview = {
  asset_id: string;
  unit: string;
  units: string[];
  offset: number;
  limit: number;
  total: number;
  columns: string[];
  fields: Array<Record<string, unknown> & { name: string; description: string }>;
  rows: Record<string, unknown>[];
};

export type Artifact = {
  id: string;
  project_id: string;
  type: string;
  name: string;
  path: string;
  sha256: string;
  status: string;
  metadata: Record<string, unknown>;
  lineage: string[];
  created_at: string;
};

export type ChatResponse = {
  project_id: string;
  message_id: string;
  intent: string;
  content: string;
  tool_calls: string[];
  artifacts: string[];
};

export type Message = {
  id: string;
  project_id: string;
  role: "user" | "assistant";
  intent: string | null;
  content: string;
  tool_calls: string[];
  artifacts: string[];
  created_at: string;
};

export type RunStep = {
  id: string;
  run_id: string;
  position: number;
  key: string;
  label: string;
  status: "pending" | "running" | "succeeded" | "failed" | "skipped";
  tool_names: string[];
  call_ids: string[];
  input_fields: string[];
  artifact_ids: string[];
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
};

export type AnalysisRun = {
  id: string;
  project_id: string;
  trigger_message_id: string;
  result_message_id: string | null;
  retry_of_run_id: string | null;
  title: string;
  intent: string;
  status: "running" | "succeeded" | "failed" | "cancelled";
  source_ids: string[];
  skill_ids: string[];
  plan: { key: string; label: string }[];
  artifact_ids: string[];
  runtime: string;
  cancel_requested: boolean;
  error: string | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  steps: RunStep[];
};

export type ReportVersion = {
  id: string;
  project_id: string;
  run_id: string | null;
  report_key: string;
  version: number;
  title: string;
  markdown_path: string;
  html_path: string | null;
  note: string;
  based_on_version: number | null;
  artifact_ids: string[];
  created_at: string;
};

export type ReportContent = {
  report: ReportVersion;
  markdown: string;
};

export type ArtifactData = {
  artifact_id: string;
  offset: number;
  limit: number;
  columns: string[];
  rows: Record<string, unknown>[];
  total: number | null;
};

export type VisualData = ArtifactData & {
  visual_id: string;
  source_artifact_id: string;
  scope: {
    total_rows: number | null;
    rows_used: number;
    truncated: boolean;
    strategy: string;
    max_points: number;
  };
};

export type Health = {
  status: string;
  model: string;
  mysql: string;
  sandbox: string;
};

export type SystemOverview = Health & {
  project_count: number;
  data_asset_count: number;
  installed_skill_count: number;
  runtime_bytes: number;
  trash_items: number;
  max_upload_bytes: number;
  max_project_source_bytes: number;
  query_row_limit: number;
  query_timeout_seconds: number;
  training_timeout_seconds: number;
};

export type ModelConnectionStatus = {
  configured: boolean;
  model_name: string;
  base_url: string;
  source: string;
  tested: boolean;
  detail: string;
};

export type MySQLInspection = {
  database: string;
  tables: { name: string; rows: number; columns: Record<string, unknown>[] }[];
};

export type Skill = {
  id: string;
  name: string;
  version: string;
  content_hash: string;
  has_scripts: boolean;
  default_for_new_projects: boolean;
  origin: "builtin" | "user";
  project_count: number;
  project_titles: string[];
  display_name: string;
  body_excerpt: string;
  highlights: string[];
  applies_to: string[];
  manifest: Record<string, unknown>;
};

export type SkillInspection = {
  skill_id: string;
  files: { path: string; kind: "file" | "directory"; size: number | null }[];
  selected_path: string;
  content: string;
  truncated: boolean;
};

export type ProjectSkill = {
  project_id: string;
  skill_id: string;
  permissions: Record<string, unknown>;
  enabled_at: string;
};

export type ModelJob = {
  id: string;
  project_id: string;
  status: "running" | "succeeded" | "failed" | "cancelled" | "timed_out";
  message: string;
  elapsed_seconds: number;
  result: Record<string, string> | null;
  error: string | null;
};
