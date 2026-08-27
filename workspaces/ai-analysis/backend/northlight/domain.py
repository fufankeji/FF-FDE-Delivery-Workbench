from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, SecretStr


class ProjectStatus(StrEnum):
    READY = "ready"
    PROFILING = "profiling"
    FAILED = "failed"
    ARCHIVED = "archived"


class SourceType(StrEnum):
    CSV = "csv"
    EXCEL = "excel"
    SQLITE = "sqlite"
    MYSQL = "mysql"


class SourceStatus(StrEnum):
    PENDING = "pending"
    PROFILING = "profiling"
    READY = "ready"
    CHANGED = "changed"
    FAILED = "failed"


class ArtifactType(StrEnum):
    SOURCE = "source"
    EXTRACT = "extract"
    DERIVED = "derived"
    QUERY = "query"
    CODE = "code"
    VISUAL = "visual"
    MODEL = "model"
    PREDICTIONS = "predictions"
    REPORT = "report"
    HTML = "html"


class Intent(StrEnum):
    NORMAL = "normal"
    DATA_QA = "data_qa"
    EXPLORATION = "exploration"
    VISUALIZATION = "visualization"
    MODELING = "modeling"
    REPORTING = "reporting"
    PROJECT_OPS = "project_ops"


class RunStatus(StrEnum):
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    CANCELLED = "cancelled"


class RunStepStatus(StrEnum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    SKIPPED = "skipped"


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class ProjectCreate(BaseModel):
    title: str = Field(min_length=1, max_length=120)


class ProjectView(ORMModel):
    id: str
    title: str
    status: str
    created_at: datetime
    updated_at: datetime


class SourceView(ORMModel):
    id: str
    project_id: str
    type: str
    name: str
    status: str
    fingerprint: str
    baseline: dict[str, Any]
    created_at: datetime


class DataAssetUsage(BaseModel):
    project_id: str
    project_title: str
    source_id: str
    bound_at: datetime


class DataAssetView(ORMModel):
    id: str
    type: str
    name: str
    description: str
    tags: list[str]
    status: str
    fingerprint: str
    baseline: dict[str, Any]
    created_at: datetime
    updated_at: datetime
    usage: list[DataAssetUsage] = Field(default_factory=list)


class DataAssetUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=240)
    description: str | None = Field(default=None, max_length=1_000)
    tags: list[str] | None = Field(default=None, max_length=12)


class DataAssetDictionaryUpdate(BaseModel):
    unit: str = Field(min_length=1, max_length=240)
    descriptions: dict[str, str] = Field(max_length=500)


class DataAssetPreview(BaseModel):
    asset_id: str
    unit: str
    units: list[str]
    offset: int
    limit: int
    total: int
    columns: list[str]
    fields: list[dict[str, Any]]
    rows: list[dict[str, Any]]


class ArtifactView(ORMModel):
    id: str
    project_id: str
    type: str
    name: str
    path: str
    sha256: str
    status: str
    metadata: dict[str, Any] = Field(validation_alias="artifact_metadata")
    lineage: list[str]
    created_at: datetime


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=20_000)
    source_ids: list[str] = Field(default_factory=list, max_length=50)
    skill_ids: list[str] = Field(default_factory=list, max_length=50)
    retry_of_run_id: str | None = Field(default=None, max_length=36)


class ChatResponse(BaseModel):
    project_id: str
    message_id: str
    intent: Intent
    content: str
    tool_calls: list[str] = Field(default_factory=list)
    artifacts: list[str] = Field(default_factory=list)


class MessageView(ORMModel):
    id: str
    project_id: str
    role: str
    intent: str | None
    content: str
    tool_calls: list[str]
    artifacts: list[str]
    created_at: datetime


class RunStepView(ORMModel):
    id: str
    run_id: str
    position: int
    key: str
    label: str
    status: str
    tool_names: list[str]
    call_ids: list[str]
    input_fields: list[str]
    artifact_ids: list[str]
    error: str | None
    started_at: datetime | None
    completed_at: datetime | None


class AnalysisRunView(ORMModel):
    id: str
    project_id: str
    trigger_message_id: str
    result_message_id: str | None
    retry_of_run_id: str | None
    title: str
    intent: str
    status: str
    source_ids: list[str]
    skill_ids: list[str]
    plan: list[dict[str, Any]]
    artifact_ids: list[str]
    runtime: str
    cancel_requested: bool
    error: str | None
    started_at: datetime
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime
    steps: list[RunStepView]


class ReportVersionView(ORMModel):
    id: str
    project_id: str
    run_id: str | None
    report_key: str
    version: int
    title: str
    markdown_path: str
    html_path: str | None
    note: str
    based_on_version: int | None
    artifact_ids: list[str]
    created_at: datetime


class SkillView(ORMModel):
    id: str
    name: str
    version: str
    content_hash: str
    path: str
    has_scripts: bool
    default_for_new_projects: bool
    manifest: dict[str, Any]
    created_at: datetime


class SkillCatalogView(SkillView):
    origin: str
    project_count: int
    project_titles: list[str]
    display_name: str
    body_excerpt: str
    highlights: list[str]
    applies_to: list[str]


class SkillFileView(BaseModel):
    path: str
    kind: str
    size: int | None = None


class SkillInspectionView(BaseModel):
    skill_id: str
    files: list[SkillFileView]
    selected_path: str
    content: str
    truncated: bool = False


class SkillDefaultUpdate(BaseModel):
    enabled: bool


class ModelConnectionRequest(BaseModel):
    api_key: SecretStr | None = None
    model_name: str = Field(default="deepseek-v4-flash", min_length=1, max_length=160)
    base_url: str = Field(default="https://api.deepseek.com", min_length=8, max_length=500)


class ModelConnectionStatus(BaseModel):
    configured: bool
    model_name: str
    base_url: str
    source: str
    tested: bool = False
    detail: str = ""


class MySQLInspectRequest(BaseModel):
    url: SecretStr


class MySQLTableSummary(BaseModel):
    name: str
    rows: int
    columns: list[dict[str, Any]]


class MySQLInspectionView(BaseModel):
    database: str
    tables: list[MySQLTableSummary]


class MySQLImportRequest(BaseModel):
    name: str = Field(min_length=1, max_length=240)
    url: SecretStr
    tables: list[str] = Field(min_length=1, max_length=200)


class SystemOverview(BaseModel):
    status: str
    model: str
    mysql: str
    sandbox: str
    project_count: int
    data_asset_count: int
    installed_skill_count: int
    runtime_bytes: int
    trash_items: int
    max_upload_bytes: int
    max_project_source_bytes: int
    query_row_limit: int
    query_timeout_seconds: int
    training_timeout_seconds: int


class ProjectSkillView(ORMModel):
    project_id: str
    skill_id: str
    permissions: dict[str, Any]
    enabled_at: datetime


class QueryRequest(BaseModel):
    source_id: str
    sql: str = Field(min_length=1, max_length=50_000)
    name: str = Field(default="Query result", max_length=120)
    analysis_dimension: str | None = Field(default=None, max_length=80)
    business_question: str | None = Field(default=None, max_length=240)
    finding_label: str | None = Field(default=None, max_length=120)
    finding_metric: str | None = Field(default=None, max_length=120)
    finding_unit: str | None = Field(default=None, max_length=40)
    metric_additive: bool | None = None


class ChartRequest(BaseModel):
    artifact_id: str
    chart_type: str
    x: str
    y: list[str]
    title: str = Field(max_length=160)


class ReportCreate(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    summary: str | None = None
    business_question: str | None = Field(default=None, max_length=500)
    artifact_ids: list[str] = Field(default_factory=list)
    run_id: str | None = None


class ReportRevision(BaseModel):
    markdown: str = Field(min_length=1)
    note: str = Field(default="Revised through conversation", max_length=240)


class ModelRunRequest(BaseModel):
    artifact_id: str
    task: str
    target: str | None = None
    features: list[str] | None = None
    algorithm: str = "random_forest"
    name: str = "Model experiment"
    random_state: int = 42
    tune: bool = False


class ProfileRequest(BaseModel):
    artifact_id: str
    name: str = "Data quality profile"


class CleanRequest(BaseModel):
    artifact_id: str
    name: str = "Cleaned dataset"
    drop_duplicates: bool = True
    fill_missing: str = Field(default="median_mode", pattern="^(median_mode|drop_rows|none)$")
    clip_outliers: bool = False


class FeatureRequest(BaseModel):
    artifact_id: str
    name: str = "Feature dataset"
    date_columns: list[str] = Field(default_factory=list)
    log_columns: list[str] = Field(default_factory=list)
    ratios: list[dict[str, str]] = Field(default_factory=list)


class PredictRequest(BaseModel):
    model_artifact_id: str
    data_artifact_id: str
    name: str = "Model predictions"
