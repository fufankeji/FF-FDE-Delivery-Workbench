from __future__ import annotations

import json
import os
import shutil
from collections.abc import Generator
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Annotated, Any
from urllib.parse import urlparse
from uuid import uuid4
from zipfile import ZIP_DEFLATED, ZipFile

import duckdb
import pandas as pd
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field, SecretStr
from sqlalchemy.orm import Session
from sse_starlette.sse import EventSourceResponse

from northlight.agent_runtime import AgentRuntime
from northlight.analysis_service import AnalysisService
from northlight.connection_settings import save_model_connection, test_model_connection
from northlight.data_assets import DataAssetService
from northlight.data_sources import DataSourceService, inspect_mysql_catalog
from northlight.database import session_scope
from northlight.domain import (
    AnalysisRunView,
    ArtifactView,
    ChartRequest,
    ChatRequest,
    ChatResponse,
    CleanRequest,
    DataAssetDictionaryUpdate,
    DataAssetPreview,
    DataAssetUpdate,
    DataAssetUsage,
    DataAssetView,
    FeatureRequest,
    MessageView,
    ModelConnectionRequest,
    ModelConnectionStatus,
    ModelRunRequest,
    MySQLImportRequest,
    MySQLInspectionView,
    MySQLInspectRequest,
    PredictRequest,
    ProfileRequest,
    ProjectCreate,
    ProjectSkillView,
    ProjectView,
    QueryRequest,
    ReportCreate,
    ReportRevision,
    ReportVersionView,
    SkillCatalogView,
    SkillDefaultUpdate,
    SkillInspectionView,
    SkillView,
    SourceType,
    SourceView,
    SystemOverview,
)
from northlight.ml_service import MLService
from northlight.model_jobs import model_job_manager
from northlight.query_service import QueryService, write_chart_spec
from northlight.report_service import ReportService
from northlight.repository import Repository
from northlight.serialization import frame_records
from northlight.settings import get_settings
from northlight.skill_service import SkillService
from northlight.workspace import project_root

router = APIRouter(prefix="/api")


def get_session() -> Generator[Session, None, None]:
    yield from session_scope()


def repo(session: Annotated[Session, Depends(get_session)]) -> Repository:
    return Repository(session)


def handle_error(exc: Exception) -> HTTPException:
    if isinstance(exc, HTTPException):
        return exc
    if isinstance(exc, KeyError):
        return HTTPException(status_code=404, detail=str(exc))
    if isinstance(exc, (ValueError, FileNotFoundError)):
        return HTTPException(status_code=400, detail=str(exc))
    return HTTPException(status_code=500, detail=f"{type(exc).__name__}: {exc}")


def require_same_host_settings_origin(request: Request) -> None:
    """Block cross-host browser pages from invoking secret-consuming settings routes."""
    origin = request.headers.get("origin")
    if not origin:
        return
    origin_host = urlparse(origin).hostname
    request_host = request.url.hostname
    forwarded_host = request.headers.get("x-forwarded-host", "").split(",", maxsplit=1)[0]
    forwarded_hostname = urlparse(f"//{forwarded_host}").hostname if forwarded_host else None
    allowed_hosts = {host.lower() for host in (request_host, forwarded_hostname) if host}
    if not origin_host or origin_host.lower() not in allowed_hosts:
        raise HTTPException(
            status_code=403,
            detail="模型连接设置只允许从当前 DS4 主机页面修改",
        )


def model_key_for_connection_change(payload: ModelConnectionRequest) -> str:
    submitted = payload.api_key.get_secret_value() if payload.api_key else None
    settings = get_settings()
    connection_changed = (
        payload.model_name.strip() != settings.model_name
        or payload.base_url.rstrip("/") != settings.model_base_url.rstrip("/")
    )
    if connection_changed and not submitted:
        raise ValueError("更换模型名称或 API Base URL 时必须重新输入 API Key")
    api_key = submitted or os.getenv("DEEPSEEK_API_KEY")
    if not api_key:
        raise ValueError("请输入 API Key，或先让服务加载受保护凭证")
    return api_key


@router.get("/health")
def health() -> dict[str, object]:
    return {
        "status": "ok",
        "model": "configured" if os.getenv("DEEPSEEK_API_KEY") else "credential_not_in_process",
        "mysql": "configured"
        if any(
            key.startswith(("NORTHLIGHT_MYSQL_SOURCE_", "NORTHLIGHT_DATA_ASSET_"))
            for key in os.environ
        )
        else "not_configured",
        "sandbox": "docker",
    }


@router.post("/projects", response_model=ProjectView)
def create_project(payload: ProjectCreate, repository: Annotated[Repository, Depends(repo)]) -> Any:
    project = repository.create_project(payload.title)
    SkillService(repository).apply_defaults(project.id)
    return project


@router.get("/projects", response_model=list[ProjectView])
def list_projects(repository: Annotated[Repository, Depends(repo)]) -> Any:
    return repository.list_projects()


@router.get("/projects/{project_id}", response_model=ProjectView)
def get_project(project_id: str, repository: Annotated[Repository, Depends(repo)]) -> Any:
    try:
        return repository.get_project(project_id)
    except Exception as exc:
        raise handle_error(exc) from exc


@router.post("/projects/{project_id}/sources/file", response_model=SourceView)
def attach_file_source(
    project_id: str,
    source_type: Annotated[SourceType, Form()],
    upload: Annotated[UploadFile, File()],
    repository: Annotated[Repository, Depends(repo)],
) -> Any:
    suffix = Path(upload.filename or "upload").suffix
    temp_path: Path | None = None
    try:
        with NamedTemporaryFile(suffix=suffix, delete=False) as temporary:
            temp_path = Path(temporary.name)
            copied = 0
            while chunk := upload.file.read(1024 * 1024):
                copied += len(chunk)
                if copied > get_settings().max_upload_bytes:
                    raise HTTPException(
                        status_code=413, detail="Upload exceeds configured file limit"
                    )
                temporary.write(chunk)
        return DataSourceService(repository).attach_file(
            project_id, source_type, temp_path, upload.filename
        )
    except Exception as exc:
        raise handle_error(exc) from exc
    finally:
        if temp_path is not None:
            temp_path.unlink(missing_ok=True)


class MySQLConnect(BaseModel):
    name: str = "Local MySQL"
    url: SecretStr


class SkillRunRequest(BaseModel):
    script: str
    args: list[str] = Field(default_factory=list)


class ArtifactMessageRequest(BaseModel):
    artifact_ids: list[str] = Field(min_length=1, max_length=50)
    content: str = Field(min_length=1, max_length=2_000)
    intent: str = Field(default="project_ops", max_length=32)


class ProjectUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=120)
    status: str | None = Field(default=None, pattern="^(ready|archived)$")


@router.patch("/projects/{project_id}", response_model=ProjectView)
def update_project(
    project_id: str,
    payload: ProjectUpdate,
    repository: Annotated[Repository, Depends(repo)],
) -> Any:
    try:
        return repository.update_project(project_id, payload.title, payload.status)
    except Exception as exc:
        raise handle_error(exc) from exc


@router.delete("/projects/{project_id}", status_code=204)
def delete_project(
    project_id: str,
    repository: Annotated[Repository, Depends(repo)],
) -> None:
    try:
        repository.delete_project(project_id)
    except Exception as exc:
        raise handle_error(exc) from exc


@router.get("/projects/{project_id}/export")
def export_project(
    project_id: str, repository: Annotated[Repository, Depends(repo)]
) -> FileResponse:
    try:
        project = repository.get_project(project_id)
        root = project_root(project_id)
        export_root = get_settings().runtime_root / "exports"
        export_root.mkdir(parents=True, exist_ok=True)
        output = export_root / f"northlight-{project_id}-{uuid4().hex[:8]}.zip"
        manifest = {
            "schema_version": 1,
            "project": ProjectView.model_validate(project).model_dump(mode="json"),
            "sources": [
                SourceView.model_validate(item).model_dump(mode="json")
                for item in repository.list_sources(project_id)
            ],
            "artifacts": [
                ArtifactView.model_validate(item).model_dump(mode="json")
                for item in repository.list_artifacts(project_id)
            ],
            "messages": [
                MessageView.model_validate(item).model_dump(mode="json")
                for item in repository.list_messages(project_id)
            ],
            "runs": [
                AnalysisRunView.model_validate(item).model_dump(mode="json")
                for item in repository.list_runs(project_id)
            ],
            "reports": [
                ReportVersionView.model_validate(item).model_dump(mode="json")
                for item in repository.list_latest_reports(project_id)
            ],
            "enabled_skills": [
                {
                    "skill_id": item.skill_id,
                    "permissions": item.permissions,
                    "enabled_at": item.enabled_at.isoformat(),
                }
                for item in SkillService(repository).list_enabled(project_id)
            ],
        }
        with ZipFile(output, "w", compression=ZIP_DEFLATED) as bundle:
            bundle.writestr(
                "northlight-export.json",
                json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
            )
            for path in sorted(item for item in root.rglob("*") if item.is_file()):
                bundle.write(path, f"workspace/{path.relative_to(root).as_posix()}")
        return FileResponse(output, filename=f"{project.title}.northlight.zip")
    except Exception as exc:
        raise handle_error(exc) from exc


@router.post("/projects/{project_id}/sources/mysql", response_model=SourceView)
def attach_mysql_source(
    project_id: str,
    payload: MySQLConnect,
    repository: Annotated[Repository, Depends(repo)],
) -> Any:
    try:
        return DataSourceService(repository).attach_mysql(
            project_id, payload.name, payload.url.get_secret_value()
        )
    except Exception as exc:
        raise handle_error(exc) from exc


@router.get("/projects/{project_id}/sources", response_model=list[SourceView])
def list_sources(project_id: str, repository: Annotated[Repository, Depends(repo)]) -> Any:
    try:
        return repository.list_sources(project_id)
    except Exception as exc:
        raise handle_error(exc) from exc


def data_asset_view(asset: Any, repository: Repository) -> DataAssetView:
    usage = []
    for binding in repository.list_data_asset_bindings(asset.id):
        project = repository.get_project(binding.project_id)
        usage.append(
            DataAssetUsage(
                project_id=project.id,
                project_title=project.title,
                source_id=binding.source_id,
                bound_at=binding.bound_at,
            )
        )
    return DataAssetView.model_validate(
        {
            "id": asset.id,
            "type": asset.type,
            "name": asset.name,
            "description": asset.description,
            "tags": asset.tags,
            "status": asset.status,
            "fingerprint": asset.fingerprint,
            "baseline": asset.baseline,
            "created_at": asset.created_at,
            "updated_at": asset.updated_at,
            "usage": usage,
        }
    )


@router.get("/data-assets", response_model=list[DataAssetView])
def list_data_assets(repository: Annotated[Repository, Depends(repo)]) -> Any:
    try:
        service = DataAssetService(repository)
        service.import_existing_sources()
        return [data_asset_view(asset, repository) for asset in repository.list_data_assets()]
    except Exception as exc:
        raise handle_error(exc) from exc


@router.post("/data-assets/file", response_model=DataAssetView)
def create_file_data_asset(
    source_type: Annotated[SourceType, Form()],
    upload: Annotated[UploadFile, File()],
    repository: Annotated[Repository, Depends(repo)],
) -> Any:
    suffix = Path(upload.filename or "upload").suffix
    temp_path: Path | None = None
    try:
        with NamedTemporaryFile(suffix=suffix, delete=False) as temporary:
            temp_path = Path(temporary.name)
            copied = 0
            while chunk := upload.file.read(1024 * 1024):
                copied += len(chunk)
                if copied > get_settings().max_upload_bytes:
                    raise HTTPException(
                        status_code=413, detail="Upload exceeds configured file limit"
                    )
                temporary.write(chunk)
        asset = DataAssetService(repository).create_file(
            source_type, temp_path, upload.filename
        )
        return data_asset_view(asset, repository)
    except Exception as exc:
        raise handle_error(exc) from exc
    finally:
        if temp_path is not None:
            temp_path.unlink(missing_ok=True)


@router.post("/data-assets/mysql", response_model=DataAssetView)
def create_mysql_data_asset(
    payload: MySQLConnect,
    repository: Annotated[Repository, Depends(repo)],
) -> Any:
    try:
        asset = DataAssetService(repository).create_mysql(
            payload.name, payload.url.get_secret_value()
        )
        return data_asset_view(asset, repository)
    except Exception as exc:
        raise handle_error(exc) from exc


@router.patch("/data-assets/{asset_id}", response_model=DataAssetView)
def update_data_asset(
    asset_id: str,
    payload: DataAssetUpdate,
    repository: Annotated[Repository, Depends(repo)],
) -> Any:
    try:
        asset = repository.update_data_asset(
            asset_id,
            name=payload.name,
            description=payload.description,
            tags=payload.tags,
        )
        return data_asset_view(asset, repository)
    except Exception as exc:
        raise handle_error(exc) from exc


@router.get("/data-assets/{asset_id}/preview", response_model=DataAssetPreview)
def preview_data_asset(
    asset_id: str,
    repository: Annotated[Repository, Depends(repo)],
    unit: str | None = None,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 200,
) -> Any:
    try:
        return DataAssetService(repository).preview(asset_id, unit, offset, limit)
    except Exception as exc:
        raise handle_error(exc) from exc


@router.patch("/data-assets/{asset_id}/dictionary", response_model=DataAssetView)
def update_data_asset_dictionary(
    asset_id: str,
    payload: DataAssetDictionaryUpdate,
    repository: Annotated[Repository, Depends(repo)],
) -> Any:
    try:
        asset = DataAssetService(repository).update_dictionary(
            asset_id, payload.unit, payload.descriptions
        )
        return data_asset_view(asset, repository)
    except Exception as exc:
        raise handle_error(exc) from exc


@router.post("/data-assets/{asset_id}/reprofile", response_model=DataAssetView)
def reprofile_data_asset(
    asset_id: str, repository: Annotated[Repository, Depends(repo)]
) -> Any:
    try:
        asset = DataAssetService(repository).reprofile(asset_id)
        return data_asset_view(asset, repository)
    except Exception as exc:
        raise handle_error(exc) from exc


@router.post(
    "/projects/{project_id}/data-assets/{asset_id}/bind", response_model=SourceView
)
def bind_data_asset(
    project_id: str,
    asset_id: str,
    repository: Annotated[Repository, Depends(repo)],
) -> Any:
    try:
        return DataAssetService(repository).bind(project_id, asset_id)
    except Exception as exc:
        raise handle_error(exc) from exc


@router.delete("/data-assets/{asset_id}", status_code=204)
def delete_data_asset(
    asset_id: str, repository: Annotated[Repository, Depends(repo)]
) -> None:
    try:
        DataAssetService(repository).delete(asset_id)
    except Exception as exc:
        raise handle_error(exc) from exc


@router.post("/projects/{project_id}/sources/{source_id}/check", response_model=SourceView)
def check_source_change(
    project_id: str,
    source_id: str,
    repository: Annotated[Repository, Depends(repo)],
) -> Any:
    try:
        return DataSourceService(repository).check_change(project_id, source_id)
    except Exception as exc:
        raise handle_error(exc) from exc


@router.post("/projects/{project_id}/sources/{source_id}/reprofile", response_model=SourceView)
def reprofile_source(
    project_id: str,
    source_id: str,
    repository: Annotated[Repository, Depends(repo)],
) -> Any:
    try:
        return DataSourceService(repository).reprofile(project_id, source_id)
    except Exception as exc:
        raise handle_error(exc) from exc


@router.post("/projects/{project_id}/query", response_model=ArtifactView)
def run_query(
    project_id: str,
    payload: QueryRequest,
    repository: Annotated[Repository, Depends(repo)],
) -> Any:
    try:
        return QueryService(repository).run(
            project_id,
            payload.source_id,
            payload.sql,
            payload.name,
            payload.analysis_dimension,
            payload.business_question,
            payload.finding_label,
            payload.finding_metric,
            payload.finding_unit,
            payload.metric_additive,
        )
    except Exception as exc:
        raise handle_error(exc) from exc


@router.post("/projects/{project_id}/charts", response_model=ArtifactView)
def create_chart(
    project_id: str,
    payload: ChartRequest,
    repository: Annotated[Repository, Depends(repo)],
) -> Any:
    try:
        return write_chart_spec(
            repository,
            project_id,
            payload.artifact_id,
            payload.chart_type,
            payload.x,
            payload.y,
            payload.title,
        )
    except Exception as exc:
        raise handle_error(exc) from exc


@router.post("/projects/{project_id}/analysis/profile", response_model=ArtifactView)
def profile_artifact(
    project_id: str,
    payload: ProfileRequest,
    repository: Annotated[Repository, Depends(repo)],
) -> Any:
    try:
        return AnalysisService(repository).profile(project_id, payload.artifact_id, payload.name)
    except Exception as exc:
        raise handle_error(exc) from exc


@router.post("/projects/{project_id}/analysis/clean")
def clean_artifact(
    project_id: str,
    payload: CleanRequest,
    repository: Annotated[Repository, Depends(repo)],
) -> dict[str, ArtifactView]:
    try:
        result = AnalysisService(repository).clean(
            project_id,
            payload.artifact_id,
            payload.name,
            payload.drop_duplicates,
            payload.fill_missing,
            payload.clip_outliers,
        )
        return {key: ArtifactView.model_validate(value) for key, value in result.items()}
    except Exception as exc:
        raise handle_error(exc) from exc


@router.post("/projects/{project_id}/analysis/features")
def feature_artifact(
    project_id: str,
    payload: FeatureRequest,
    repository: Annotated[Repository, Depends(repo)],
) -> dict[str, ArtifactView]:
    try:
        result = AnalysisService(repository).engineer_features(
            project_id,
            payload.artifact_id,
            payload.name,
            payload.date_columns,
            payload.log_columns,
            payload.ratios,
        )
        return {key: ArtifactView.model_validate(value) for key, value in result.items()}
    except Exception as exc:
        raise handle_error(exc) from exc


@router.get("/projects/{project_id}/artifacts", response_model=list[ArtifactView])
def list_artifacts(project_id: str, repository: Annotated[Repository, Depends(repo)]) -> Any:
    try:
        return repository.list_artifacts(project_id)
    except Exception as exc:
        raise handle_error(exc) from exc


@router.post("/projects/{project_id}/models")
def run_model(
    project_id: str,
    payload: ModelRunRequest,
    repository: Annotated[Repository, Depends(repo)],
) -> dict[str, ArtifactView]:
    try:
        result = MLService(repository).run(
            project_id,
            payload.artifact_id,
            payload.task,
            payload.target,
            payload.features,
            payload.algorithm,
            payload.name,
            payload.random_state,
            payload.tune,
        )
        return {key: ArtifactView.model_validate(value) for key, value in result.items()}
    except Exception as exc:
        raise handle_error(exc) from exc


@router.post("/projects/{project_id}/model-jobs", status_code=202)
def start_model_job(
    project_id: str,
    payload: ModelRunRequest,
    repository: Annotated[Repository, Depends(repo)],
) -> dict[str, object]:
    try:
        return model_job_manager.start(repository, project_id, payload)
    except Exception as exc:
        raise handle_error(exc) from exc


@router.get("/projects/{project_id}/model-jobs/{job_id}")
def model_job_status(project_id: str, job_id: str) -> dict[str, object]:
    try:
        return model_job_manager.status(project_id, job_id)
    except Exception as exc:
        raise handle_error(exc) from exc


@router.delete("/projects/{project_id}/model-jobs/{job_id}")
def cancel_model_job(project_id: str, job_id: str) -> dict[str, object]:
    try:
        return model_job_manager.cancel(project_id, job_id)
    except Exception as exc:
        raise handle_error(exc) from exc


@router.post("/projects/{project_id}/predictions", response_model=ArtifactView)
def run_prediction(
    project_id: str,
    payload: PredictRequest,
    repository: Annotated[Repository, Depends(repo)],
) -> Any:
    try:
        return MLService(repository).predict(
            project_id,
            payload.model_artifact_id,
            payload.data_artifact_id,
            payload.name,
        )
    except Exception as exc:
        raise handle_error(exc) from exc


@router.post("/projects/{project_id}/chat", response_model=ChatResponse)
def chat(
    project_id: str,
    payload: ChatRequest,
    repository: Annotated[Repository, Depends(repo)],
) -> Any:
    try:
        return AgentRuntime(repository).respond(
            project_id,
            payload.message,
            payload.source_ids,
            payload.skill_ids,
            payload.retry_of_run_id,
        )
    except Exception as exc:
        raise handle_error(exc) from exc


@router.get("/projects/{project_id}/messages", response_model=list[MessageView])
def list_messages(project_id: str, repository: Annotated[Repository, Depends(repo)]) -> Any:
    try:
        return repository.list_messages(project_id)
    except Exception as exc:
        raise handle_error(exc) from exc


@router.get("/projects/{project_id}/runs", response_model=list[AnalysisRunView])
def list_analysis_runs(
    project_id: str, repository: Annotated[Repository, Depends(repo)]
) -> Any:
    try:
        return repository.list_runs(project_id)
    except Exception as exc:
        raise handle_error(exc) from exc


@router.get("/projects/{project_id}/runs/{run_id}", response_model=AnalysisRunView)
def get_analysis_run(
    project_id: str,
    run_id: str,
    repository: Annotated[Repository, Depends(repo)],
) -> Any:
    try:
        return repository.get_run(project_id, run_id)
    except Exception as exc:
        raise handle_error(exc) from exc


@router.delete("/projects/{project_id}/runs/{run_id}", response_model=AnalysisRunView)
def cancel_analysis_run(
    project_id: str,
    run_id: str,
    repository: Annotated[Repository, Depends(repo)],
) -> Any:
    """Request cooperative cancellation; a currently executing tool finishes first."""
    try:
        return repository.request_run_cancel(project_id, run_id)
    except Exception as exc:
        raise handle_error(exc) from exc


@router.post("/projects/{project_id}/messages/artifacts", response_model=MessageView)
def share_artifacts_to_chat(
    project_id: str,
    payload: ArtifactMessageRequest,
    repository: Annotated[Repository, Depends(repo)],
) -> Any:
    try:
        for artifact_id in payload.artifact_ids:
            repository.get_artifact(project_id, artifact_id)
        return repository.add_message(
            project_id,
            "assistant",
            payload.content,
            payload.intent,
            ["share_registered_artifacts"],
            payload.artifact_ids,
        )
    except Exception as exc:
        raise handle_error(exc) from exc


@router.post("/projects/{project_id}/chat/stream")
def chat_stream(
    project_id: str,
    payload: ChatRequest,
    repository: Annotated[Repository, Depends(repo)],
) -> EventSourceResponse:
    def events() -> Generator[dict[str, str], None, None]:
        for item in AgentRuntime(repository).respond_events(
            project_id,
            payload.message,
            payload.source_ids,
            payload.skill_ids,
            payload.retry_of_run_id,
        ):
            event_type = str(item["type"])
            if event_type == "message":
                response = item["response"]
                yield {"event": "message", "data": response.model_dump_json()}
            else:
                yield {
                    "event": event_type,
                    "data": json.dumps(
                        {key: value for key, value in item.items() if key != "type"},
                        ensure_ascii=False,
                    ),
                }

    return EventSourceResponse(events())


@router.get("/projects/{project_id}/reports", response_model=list[ReportVersionView])
def list_reports(project_id: str, repository: Annotated[Repository, Depends(repo)]) -> Any:
    try:
        return repository.list_latest_reports(project_id)
    except Exception as exc:
        raise handle_error(exc) from exc


@router.post("/projects/{project_id}/reports", response_model=ReportVersionView)
def create_report(
    project_id: str,
    payload: ReportCreate,
    repository: Annotated[Repository, Depends(repo)],
) -> Any:
    try:
        report = ReportService(repository).create(
            project_id,
            payload.title,
            payload.summary,
            payload.artifact_ids,
            run_id=payload.run_id,
            restrict_to_run=bool(payload.run_id),
            business_question=payload.business_question,
        )
        return report
    except Exception as exc:
        raise handle_error(exc) from exc


@router.get("/projects/{project_id}/reports/{report_key}", response_model=list[ReportVersionView])
def report_versions(
    project_id: str,
    report_key: str,
    repository: Annotated[Repository, Depends(repo)],
) -> Any:
    return repository.list_report_versions(project_id, report_key)


@router.get("/projects/{project_id}/reports/{report_key}/content/{version}")
def report_content(
    project_id: str,
    report_key: str,
    version: int,
    repository: Annotated[Repository, Depends(repo)],
) -> dict[str, object]:
    try:
        report = repository.get_report_version(project_id, report_key, version)
        markdown = (project_root(project_id) / report.markdown_path).read_text(encoding="utf-8")
        return {"report": ReportVersionView.model_validate(report), "markdown": markdown}
    except Exception as exc:
        raise handle_error(exc) from exc


@router.get("/projects/{project_id}/artifacts/{artifact_id}/data")
def artifact_data(
    project_id: str,
    artifact_id: str,
    repository: Annotated[Repository, Depends(repo)],
    limit: Annotated[int, Query(ge=1, le=500)] = 200,
    offset: Annotated[int, Query(ge=0)] = 0,
    sort_by: Annotated[str | None, Query(max_length=240)] = None,
    sort_order: Annotated[str, Query(pattern="^(asc|desc)$")] = "asc",
    filter_column: Annotated[str | None, Query(max_length=240)] = None,
    filter_value: Annotated[str | None, Query(max_length=500)] = None,
) -> dict[str, object]:
    try:
        artifact = repository.get_artifact(project_id, artifact_id)
        path = project_root(project_id) / artifact.path
        raw_columns = artifact.artifact_metadata.get("columns", [])
        columns = [str(column) for column in raw_columns] if isinstance(raw_columns, list) else []
        for requested in (sort_by, filter_column):
            if requested and requested not in columns:
                raise ValueError(f"Unknown artifact column: {requested}")
        if path.suffix == ".parquet":
            connection = duckdb.connect()
            try:
                where = ""
                parameters: list[object] = [str(path)]
                if filter_column and filter_value:
                    where = f" WHERE CAST({_quote_identifier(filter_column)} AS VARCHAR) ILIKE ?"
                    parameters.append(f"%{filter_value}%")
                order = (
                    f" ORDER BY {_quote_identifier(sort_by)} {sort_order.upper()}"
                    if sort_by
                    else ""
                )
                total_row = connection.execute(
                    f"SELECT COUNT(*) FROM read_parquet(?){where}", parameters
                ).fetchone()
                if total_row is None:
                    raise RuntimeError("Artifact count query returned no row")
                total = int(total_row[0])
                frame = connection.execute(
                    f"SELECT * FROM read_parquet(?){where}{order} LIMIT ? OFFSET ?",
                    [*parameters, limit, offset],
                ).df()
            finally:
                connection.close()
        elif path.suffix == ".csv":
            full_frame = pd.read_csv(path)
            if filter_column and filter_value:
                full_frame = full_frame[
                    full_frame[filter_column]
                    .astype("string")
                    .str.contains(filter_value, case=False, na=False, regex=False)
                ]
            if sort_by:
                full_frame = full_frame.sort_values(sort_by, ascending=sort_order == "asc")
            total = len(full_frame)
            frame = full_frame.iloc[offset : offset + limit]
        else:
            raise ValueError("Artifact does not expose tabular data")
        return {
            "artifact_id": artifact.id,
            "offset": offset,
            "limit": limit,
            "columns": list(frame.columns),
            "rows": frame_records(frame),
            "total": total,
        }
    except Exception as exc:
        raise handle_error(exc) from exc


@router.get("/projects/{project_id}/visuals/{visual_id}/data")
def visual_data(
    project_id: str,
    visual_id: str,
    repository: Annotated[Repository, Depends(repo)],
) -> dict[str, object]:
    """Return the exact disclosed row scope shared by a visual's chart and table views."""
    try:
        visual = repository.get_artifact(project_id, visual_id)
        if visual.type != "visual" or not visual.lineage:
            raise ValueError("Artifact is not a data-backed visual")
        scope = visual.artifact_metadata.get("data_scope", {})
        if not isinstance(scope, dict):
            scope = {}
        requested = scope.get("rows_used", 500)
        limit = max(1, min(500, int(requested) if isinstance(requested, (int, float)) else 500))
        payload = artifact_data(
            project_id,
            visual.lineage[0],
            repository,
            limit=limit,
            offset=0,
            sort_by=None,
            sort_order="asc",
            filter_column=None,
            filter_value=None,
        )
        rows = payload.get("rows", [])
        disclosed_scope = {
            **scope,
            "rows_used": len(rows) if isinstance(rows, list) else 0,
            "total_rows": payload.get("total"),
        }
        return {
            **payload,
            "visual_id": visual.id,
            "source_artifact_id": visual.lineage[0],
            "scope": disclosed_scope,
        }
    except Exception as exc:
        raise handle_error(exc) from exc


def _quote_identifier(value: str) -> str:
    return '"' + value.replace('"', '""') + '"'


@router.get("/projects/{project_id}/artifacts/{artifact_id}/download")
def download_artifact(
    project_id: str,
    artifact_id: str,
    repository: Annotated[Repository, Depends(repo)],
) -> FileResponse:
    try:
        artifact = repository.get_artifact(project_id, artifact_id)
        return FileResponse(
            project_root(project_id) / artifact.path, filename=Path(artifact.path).name
        )
    except Exception as exc:
        raise handle_error(exc) from exc


@router.post(
    "/projects/{project_id}/reports/{report_key}/revisions", response_model=ReportVersionView
)
def revise_report(
    project_id: str,
    report_key: str,
    payload: ReportRevision,
    repository: Annotated[Repository, Depends(repo)],
) -> Any:
    try:
        return ReportService(repository).revise(
            project_id, report_key, payload.markdown, payload.note
        )
    except Exception as exc:
        raise handle_error(exc) from exc


@router.post(
    "/projects/{project_id}/reports/{report_key}/restore/{version}",
    response_model=ReportVersionView,
)
def restore_report(
    project_id: str,
    report_key: str,
    version: int,
    repository: Annotated[Repository, Depends(repo)],
) -> Any:
    try:
        return ReportService(repository).restore(project_id, report_key, version)
    except Exception as exc:
        raise handle_error(exc) from exc


@router.post("/projects/{project_id}/reports/{report_key}/html/{version}")
def generate_report_html(
    project_id: str,
    report_key: str,
    version: int,
    repository: Annotated[Repository, Depends(repo)],
) -> dict[str, str]:
    try:
        path = ReportService(repository).render_html(project_id, report_key, version)
        return {"path": str(path.relative_to(project_root(project_id)))}
    except Exception as exc:
        raise handle_error(exc) from exc


@router.get("/projects/{project_id}/reports/{report_key}/html/{version}")
def download_report_html(
    project_id: str,
    report_key: str,
    version: int,
    repository: Annotated[Repository, Depends(repo)],
) -> FileResponse:
    report = repository.get_report_version(project_id, report_key, version)
    if not report.html_path:
        raise HTTPException(status_code=404, detail="HTML has not been generated for this version")
    return FileResponse(project_root(project_id) / report.html_path, media_type="text/html")


@router.get("/skills", response_model=list[SkillCatalogView])
def list_skills(repository: Annotated[Repository, Depends(repo)]) -> Any:
    service = SkillService(repository)
    result = []
    for skill in service.list_installed():
        project_count, project_titles = service.usage(skill.id)
        catalog = service.catalog_content(skill)
        result.append(
            SkillCatalogView.model_validate(
                {
                    **SkillView.model_validate(skill).model_dump(),
                    "origin": "builtin" if service.is_builtin(skill) else "user",
                    "project_count": project_count,
                    "project_titles": project_titles,
                    **catalog,
                }
            )
        )
    return result


@router.get("/skills/{skill_id}/inspection", response_model=SkillInspectionView)
def inspect_skill(
    skill_id: str,
    repository: Annotated[Repository, Depends(repo)],
    path: str = "SKILL.md",
) -> Any:
    try:
        return SkillService(repository).inspect(skill_id, path)
    except Exception as exc:
        raise handle_error(exc) from exc


@router.post("/skills/upload", response_model=SkillView)
def upload_skill(
    upload: Annotated[UploadFile, File()],
    repository: Annotated[Repository, Depends(repo)],
) -> Any:
    with NamedTemporaryFile(suffix=".zip", delete=False) as temporary:
        shutil.copyfileobj(upload.file, temporary)
        path = Path(temporary.name)
    try:
        return SkillService(repository).install_archive(path)
    except Exception as exc:
        raise handle_error(exc) from exc
    finally:
        path.unlink(missing_ok=True)


@router.patch("/skills/{skill_id}/default", response_model=SkillCatalogView)
def set_default_skill(
    skill_id: str,
    payload: SkillDefaultUpdate,
    repository: Annotated[Repository, Depends(repo)],
) -> Any:
    try:
        service = SkillService(repository)
        skill = service.set_default(skill_id, payload.enabled)
        project_count, project_titles = service.usage(skill.id)
        catalog = service.catalog_content(skill)
        return SkillCatalogView.model_validate(
            {
                **SkillView.model_validate(skill).model_dump(),
                "origin": "builtin" if service.is_builtin(skill) else "user",
                "project_count": project_count,
                "project_titles": project_titles,
                **catalog,
            }
        )
    except Exception as exc:
        raise handle_error(exc) from exc


def directory_bytes(root: Path) -> int:
    if not root.exists():
        return 0
    return sum(path.stat().st_size for path in root.rglob("*") if path.is_file())


@router.get("/system/overview", response_model=SystemOverview)
def system_overview(repository: Annotated[Repository, Depends(repo)]) -> Any:
    settings = get_settings()
    runtime_root = settings.runtime_root
    trash_root = runtime_root / "trash"
    deleted_projects_root = trash_root / "deleted-projects"
    health_state = health()
    return {
        **health_state,
        "project_count": len(repository.list_projects()),
        "data_asset_count": len(repository.list_data_assets()),
        "installed_skill_count": len(SkillService(repository).list_installed()),
        "runtime_bytes": directory_bytes(runtime_root),
        "trash_items": len(list(deleted_projects_root.iterdir()))
        if deleted_projects_root.exists()
        else 0,
        "max_upload_bytes": settings.max_upload_bytes,
        "max_project_source_bytes": settings.max_project_source_bytes,
        "query_row_limit": settings.query_row_limit,
        "query_timeout_seconds": settings.query_timeout_seconds,
        "training_timeout_seconds": settings.training_timeout_seconds,
    }


@router.get("/system/model-connection", response_model=ModelConnectionStatus)
def model_connection_status() -> Any:
    settings = get_settings()
    return {
        "configured": bool(os.getenv("DEEPSEEK_API_KEY")),
        "model_name": settings.model_name,
        "base_url": settings.model_base_url,
        "source": "protected-runtime" if bool(os.getenv("DEEPSEEK_API_KEY")) else "none",
    }


@router.post(
    "/system/model-connection/test",
    response_model=ModelConnectionStatus,
    dependencies=[Depends(require_same_host_settings_origin)],
)
def test_model_connection_route(payload: ModelConnectionRequest) -> Any:
    try:
        api_key = model_key_for_connection_change(payload)
        detail = test_model_connection(api_key, payload.model_name, payload.base_url)
        return {
            "configured": True,
            "model_name": payload.model_name,
            "base_url": payload.base_url.rstrip("/"),
            "source": "submitted" if payload.api_key else "protected-runtime",
            "tested": True,
            "detail": detail,
        }
    except Exception as exc:
        raise handle_error(exc) from exc


@router.put(
    "/system/model-connection",
    response_model=ModelConnectionStatus,
    dependencies=[Depends(require_same_host_settings_origin)],
)
def update_model_connection(payload: ModelConnectionRequest) -> Any:
    try:
        api_key = model_key_for_connection_change(payload)
        detail = test_model_connection(api_key, payload.model_name, payload.base_url)
        save_model_connection(api_key, payload.model_name, payload.base_url)
        return {
            "configured": True,
            "model_name": payload.model_name,
            "base_url": payload.base_url.rstrip("/"),
            "source": "protected-runtime",
            "tested": True,
            "detail": detail,
        }
    except Exception as exc:
        raise handle_error(exc) from exc


@router.post("/system/mysql/inspect", response_model=MySQLInspectionView)
def inspect_mysql_connection(payload: MySQLInspectRequest) -> Any:
    try:
        return inspect_mysql_catalog(payload.url.get_secret_value())
    except Exception as exc:
        raise handle_error(exc) from exc


@router.post("/system/mysql/import", response_model=DataAssetView)
def import_mysql_tables(
    payload: MySQLImportRequest,
    repository: Annotated[Repository, Depends(repo)],
) -> Any:
    try:
        asset = DataAssetService(repository).create_mysql(
            payload.name, payload.url.get_secret_value(), payload.tables
        )
        return data_asset_view(asset, repository)
    except Exception as exc:
        raise handle_error(exc) from exc


@router.post(
    "/projects/{project_id}/skills/{skill_id}/enable", response_model=ProjectSkillView
)
def enable_skill(
    project_id: str,
    skill_id: str,
    permissions: dict[str, object],
    repository: Annotated[Repository, Depends(repo)],
) -> Any:
    try:
        return SkillService(repository).enable(project_id, skill_id, permissions)
    except Exception as exc:
        raise handle_error(exc) from exc


@router.post(
    "/projects/{project_id}/skills/{skill_id}/upgrade", response_model=ProjectSkillView
)
def upgrade_skill(
    project_id: str,
    skill_id: str,
    permissions: dict[str, object],
    repository: Annotated[Repository, Depends(repo)],
) -> Any:
    try:
        return SkillService(repository).upgrade(project_id, skill_id, permissions)
    except Exception as exc:
        raise handle_error(exc) from exc


@router.get("/projects/{project_id}/skills", response_model=list[ProjectSkillView])
def list_project_skills(project_id: str, repository: Annotated[Repository, Depends(repo)]) -> Any:
    try:
        return SkillService(repository).list_enabled(project_id)
    except Exception as exc:
        raise handle_error(exc) from exc


@router.delete("/projects/{project_id}/skills/{skill_id}", status_code=204)
def disable_skill(
    project_id: str,
    skill_id: str,
    repository: Annotated[Repository, Depends(repo)],
) -> None:
    try:
        SkillService(repository).disable(project_id, skill_id)
    except Exception as exc:
        raise handle_error(exc) from exc


@router.delete("/skills/{skill_id}", status_code=204)
def uninstall_skill(skill_id: str, repository: Annotated[Repository, Depends(repo)]) -> None:
    try:
        SkillService(repository).uninstall(skill_id)
    except Exception as exc:
        raise handle_error(exc) from exc


@router.post("/projects/{project_id}/skills/{skill_id}/run")
def run_skill_script(
    project_id: str,
    skill_id: str,
    payload: SkillRunRequest,
    repository: Annotated[Repository, Depends(repo)],
) -> dict[str, object]:
    try:
        return SkillService(repository).run_script(
            project_id, skill_id, payload.script, payload.args
        )
    except Exception as exc:
        raise handle_error(exc) from exc
