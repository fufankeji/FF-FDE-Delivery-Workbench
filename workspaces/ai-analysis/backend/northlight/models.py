from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def utcnow() -> datetime:
    return datetime.now(UTC)


class Base(DeclarativeBase):
    pass


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    title: Mapped[str] = mapped_column(String(120))
    status: Mapped[str] = mapped_column(String(24), default="ready")
    workspace: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )
    sources: Mapped[list[Source]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    artifacts: Mapped[list[Artifact]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    runs: Mapped[list[AnalysisRun]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )


class Source(Base):
    __tablename__ = "sources"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    type: Mapped[str] = mapped_column(String(24))
    name: Mapped[str] = mapped_column(String(240))
    status: Mapped[str] = mapped_column(String(24), default="pending")
    fingerprint: Mapped[str] = mapped_column(String(64), default="")
    config: Mapped[dict[str, object]] = mapped_column(JSON, default=dict)
    baseline: Mapped[dict[str, object]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    project: Mapped[Project] = relationship(back_populates="sources")


class DataAsset(Base):
    """Reusable, global data entry that can be bound into isolated projects."""

    __tablename__ = "data_assets"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    type: Mapped[str] = mapped_column(String(24))
    name: Mapped[str] = mapped_column(String(240))
    description: Mapped[str] = mapped_column(Text, default="")
    tags: Mapped[list[str]] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(String(24), default="pending")
    fingerprint: Mapped[str] = mapped_column(String(64), default="", index=True)
    config: Mapped[dict[str, object]] = mapped_column(JSON, default=dict)
    baseline: Mapped[dict[str, object]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )


class ProjectDataAsset(Base):
    """Records which reusable asset produced a project-local Source copy."""

    __tablename__ = "project_data_assets"

    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), primary_key=True)
    asset_id: Mapped[str] = mapped_column(ForeignKey("data_assets.id"), primary_key=True)
    source_id: Mapped[str] = mapped_column(ForeignKey("sources.id"), unique=True, index=True)
    bound_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Artifact(Base):
    __tablename__ = "artifacts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    type: Mapped[str] = mapped_column(String(32))
    name: Mapped[str] = mapped_column(String(240))
    path: Mapped[str] = mapped_column(Text)
    sha256: Mapped[str] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(24), default="ready")
    artifact_metadata: Mapped[dict[str, object]] = mapped_column("metadata", JSON, default=dict)
    lineage: Mapped[list[str]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    project: Mapped[Project] = relationship(back_populates="artifacts")


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    role: Mapped[str] = mapped_column(String(24))
    intent: Mapped[str | None] = mapped_column(String(32), nullable=True)
    content: Mapped[str] = mapped_column(Text)
    tool_calls: Mapped[list[str]] = mapped_column(JSON, default=list)
    artifacts: Mapped[list[str]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class AnalysisRun(Base):
    """Durable, user-visible execution record for one tool-using chat turn."""

    __tablename__ = "analysis_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    trigger_message_id: Mapped[str] = mapped_column(ForeignKey("messages.id"), index=True)
    result_message_id: Mapped[str | None] = mapped_column(
        ForeignKey("messages.id"), nullable=True, index=True
    )
    retry_of_run_id: Mapped[str | None] = mapped_column(
        ForeignKey("analysis_runs.id"), nullable=True, index=True
    )
    title: Mapped[str] = mapped_column(String(240))
    intent: Mapped[str] = mapped_column(String(32))
    status: Mapped[str] = mapped_column(String(32), default="running", index=True)
    source_ids: Mapped[list[str]] = mapped_column(JSON, default=list)
    skill_ids: Mapped[list[str]] = mapped_column(JSON, default=list)
    plan: Mapped[list[dict[str, object]]] = mapped_column(JSON, default=list)
    artifact_ids: Mapped[list[str]] = mapped_column(JSON, default=list)
    runtime: Mapped[str] = mapped_column(String(40), default="local-fallback")
    cancel_requested: Mapped[bool] = mapped_column(Boolean, default=False)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )
    project: Mapped[Project] = relationship(back_populates="runs")
    steps: Mapped[list[RunStep]] = relationship(
        back_populates="run", cascade="all, delete-orphan", order_by="RunStep.position"
    )


class RunStep(Base):
    """Observable execution step; never stores model chain-of-thought."""

    __tablename__ = "run_steps"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    run_id: Mapped[str] = mapped_column(ForeignKey("analysis_runs.id"), index=True)
    position: Mapped[int] = mapped_column(Integer)
    key: Mapped[str] = mapped_column(String(80))
    label: Mapped[str] = mapped_column(String(160))
    status: Mapped[str] = mapped_column(String(32), default="pending")
    tool_names: Mapped[list[str]] = mapped_column(JSON, default=list)
    call_ids: Mapped[list[str]] = mapped_column(JSON, default=list)
    input_fields: Mapped[list[str]] = mapped_column(JSON, default=list)
    artifact_ids: Mapped[list[str]] = mapped_column(JSON, default=list)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    run: Mapped[AnalysisRun] = relationship(back_populates="steps")


class ReportVersion(Base):
    __tablename__ = "report_versions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    run_id: Mapped[str | None] = mapped_column(
        ForeignKey("analysis_runs.id"), nullable=True, index=True
    )
    report_key: Mapped[str] = mapped_column(String(36), index=True)
    version: Mapped[int]
    title: Mapped[str] = mapped_column(String(160))
    markdown_path: Mapped[str] = mapped_column(Text)
    html_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    note: Mapped[str] = mapped_column(String(240), default="")
    based_on_version: Mapped[int | None] = mapped_column(nullable=True)
    artifact_ids: Mapped[list[str]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class InstalledSkill(Base):
    __tablename__ = "installed_skills"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(160))
    version: Mapped[str] = mapped_column(String(40))
    content_hash: Mapped[str] = mapped_column(String(64))
    path: Mapped[str] = mapped_column(Text)
    has_scripts: Mapped[bool] = mapped_column(default=False)
    default_for_new_projects: Mapped[bool] = mapped_column(Boolean, default=False)
    manifest: Mapped[dict[str, object]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ProjectSkill(Base):
    __tablename__ = "project_skills"

    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), primary_key=True)
    skill_id: Mapped[str] = mapped_column(ForeignKey("installed_skills.id"), primary_key=True)
    permissions: Mapped[dict[str, object]] = mapped_column(JSON, default=dict)
    enabled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
