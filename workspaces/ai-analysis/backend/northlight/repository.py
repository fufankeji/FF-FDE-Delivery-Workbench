from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

from sqlalchemy import delete, func, select, update
from sqlalchemy.orm import Session

from northlight.models import (
    AnalysisRun,
    Artifact,
    DataAsset,
    Message,
    Project,
    ProjectDataAsset,
    ProjectSkill,
    ReportVersion,
    RunStep,
    Source,
)
from northlight.workspace import (
    initialize_project_workspace,
    project_root,
    restore_project_workspace,
    sha256,
    trash_project_workspace,
)


class Repository:
    def __init__(self, session: Session):
        self.session = session

    def create_project(self, title: str) -> Project:
        project_id = str(uuid4())
        workspace = initialize_project_workspace(project_id, title)
        project = Project(id=project_id, title=title, workspace=str(workspace))
        self.session.add(project)
        self.session.commit()
        return project

    def list_projects(self) -> list[Project]:
        return list(self.session.scalars(select(Project).order_by(Project.updated_at.desc())))

    def get_project(self, project_id: str) -> Project:
        project = self.session.get(Project, project_id)
        if not project:
            raise KeyError(f"Project not found: {project_id}")
        return project

    def update_project(
        self, project_id: str, title: str | None = None, status: str | None = None
    ) -> Project:
        project = self.get_project(project_id)
        if title is not None:
            cleaned = title.strip()
            if not cleaned or len(cleaned) > 120:
                raise ValueError("Project title must contain 1 to 120 characters")
            project.title = cleaned
        if status is not None:
            if status not in {"ready", "archived"}:
                raise ValueError("Project status must be ready or archived")
            project.status = status
        project.updated_at = datetime.now(UTC)
        descriptor_path = project_root(project_id) / "project.json"
        descriptor = json.loads(descriptor_path.read_text(encoding="utf-8"))
        descriptor.update({"title": project.title, "status": project.status})
        descriptor_path.write_text(
            json.dumps(descriptor, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        self.session.commit()
        return project

    def delete_project(self, project_id: str) -> None:
        self.get_project(project_id)
        trashed = trash_project_workspace(project_id)
        run_ids = select(AnalysisRun.id).where(AnalysisRun.project_id == project_id)
        try:
            self.session.execute(delete(RunStep).where(RunStep.run_id.in_(run_ids)))
            self.session.execute(
                update(AnalysisRun)
                .where(AnalysisRun.project_id == project_id)
                .values(retry_of_run_id=None, result_message_id=None)
            )
            self.session.execute(delete(ReportVersion).where(ReportVersion.project_id == project_id))
            self.session.execute(delete(AnalysisRun).where(AnalysisRun.project_id == project_id))
            self.session.execute(delete(Message).where(Message.project_id == project_id))
            self.session.execute(
                delete(ProjectDataAsset).where(ProjectDataAsset.project_id == project_id)
            )
            self.session.execute(delete(ProjectSkill).where(ProjectSkill.project_id == project_id))
            self.session.execute(delete(Artifact).where(Artifact.project_id == project_id))
            self.session.execute(delete(Source).where(Source.project_id == project_id))
            self.session.execute(delete(Project).where(Project.id == project_id))
            self.session.commit()
        except Exception:
            self.session.rollback()
            restore_project_workspace(project_id, trashed)
            raise

    def add_source(
        self,
        project_id: str,
        source_type: str,
        name: str,
        fingerprint: str,
        config: dict[str, object],
        baseline: dict[str, object],
        status: str = "ready",
    ) -> Source:
        self.get_project(project_id)
        source = Source(
            id=str(uuid4()),
            project_id=project_id,
            type=source_type,
            name=name,
            status=status,
            fingerprint=fingerprint,
            config=config,
            baseline=baseline,
        )
        self.session.add(source)
        self.session.commit()
        return source

    def get_source(self, project_id: str, source_id: str) -> Source:
        source = self.session.get(Source, source_id)
        if not source or source.project_id != project_id:
            raise KeyError(f"Source not found in project: {source_id}")
        return source

    def list_sources(self, project_id: str) -> list[Source]:
        self.get_project(project_id)
        statement = select(Source).where(Source.project_id == project_id)
        return list(self.session.scalars(statement))

    def add_data_asset(
        self,
        *,
        asset_id: str,
        source_type: str,
        name: str,
        fingerprint: str,
        config: dict[str, object],
        baseline: dict[str, object],
        status: str = "ready",
        description: str = "",
        tags: list[str] | None = None,
    ) -> DataAsset:
        asset = DataAsset(
            id=asset_id,
            type=source_type,
            name=name,
            description=description,
            tags=tags or [],
            status=status,
            fingerprint=fingerprint,
            config=config,
            baseline=baseline,
        )
        self.session.add(asset)
        self.session.commit()
        return asset

    def get_data_asset(self, asset_id: str) -> DataAsset:
        asset = self.session.get(DataAsset, asset_id)
        if not asset:
            raise KeyError(f"Data asset not found: {asset_id}")
        return asset

    def list_data_assets(self) -> list[DataAsset]:
        return list(
            self.session.scalars(select(DataAsset).order_by(DataAsset.updated_at.desc()))
        )

    def update_data_asset(
        self,
        asset_id: str,
        *,
        name: str | None = None,
        description: str | None = None,
        tags: list[str] | None = None,
    ) -> DataAsset:
        asset = self.get_data_asset(asset_id)
        if name is not None:
            asset.name = name.strip()
        if description is not None:
            asset.description = description.strip()
        if tags is not None:
            asset.tags = list(dict.fromkeys(tag.strip() for tag in tags if tag.strip()))[:12]
        asset.updated_at = datetime.now(UTC)
        self.session.commit()
        return asset

    def list_data_asset_bindings(self, asset_id: str) -> list[ProjectDataAsset]:
        statement = (
            select(ProjectDataAsset)
            .where(ProjectDataAsset.asset_id == asset_id)
            .order_by(ProjectDataAsset.bound_at.desc())
        )
        return list(self.session.scalars(statement))

    def get_project_data_asset(
        self, project_id: str, asset_id: str
    ) -> ProjectDataAsset | None:
        return self.session.get(ProjectDataAsset, (project_id, asset_id))

    def bind_data_asset(
        self, project_id: str, asset_id: str, source_id: str
    ) -> ProjectDataAsset:
        self.get_project(project_id)
        self.get_data_asset(asset_id)
        binding = ProjectDataAsset(
            project_id=project_id, asset_id=asset_id, source_id=source_id
        )
        self.session.add(binding)
        self.session.commit()
        return binding

    def delete_data_asset(self, asset_id: str) -> DataAsset:
        asset = self.get_data_asset(asset_id)
        if self.list_data_asset_bindings(asset_id):
            raise ValueError("Data asset is still used by one or more projects")
        self.session.delete(asset)
        self.session.commit()
        return asset

    def add_artifact(
        self,
        project_id: str,
        artifact_type: str,
        name: str,
        path: Path,
        metadata: dict[str, object] | None = None,
        lineage: list[str] | None = None,
    ) -> Artifact:
        self.get_project(project_id)
        root = project_root(project_id)
        relative = str(path.resolve().relative_to(root.resolve()))
        artifact = Artifact(
            id=str(uuid4()),
            project_id=project_id,
            type=artifact_type,
            name=name,
            path=relative,
            sha256=sha256(path),
            artifact_metadata=metadata or {},
            lineage=lineage or [],
        )
        self.session.add(artifact)
        self.session.commit()
        return artifact

    def get_artifact(self, project_id: str, artifact_id: str) -> Artifact:
        artifact = self.session.get(Artifact, artifact_id)
        if not artifact or artifact.project_id != project_id:
            raise KeyError(f"Artifact not found in project: {artifact_id}")
        return artifact

    def list_artifacts(self, project_id: str) -> list[Artifact]:
        self.get_project(project_id)
        statement = (
            select(Artifact)
            .where(Artifact.project_id == project_id)
            .order_by(Artifact.created_at.desc())
        )
        return list(self.session.scalars(statement))

    def add_message(
        self,
        project_id: str,
        role: str,
        content: str,
        intent: str | None = None,
        tool_calls: list[str] | None = None,
        artifacts: list[str] | None = None,
    ) -> Message:
        self.get_project(project_id)
        message = Message(
            id=str(uuid4()),
            project_id=project_id,
            role=role,
            content=content,
            intent=intent,
            tool_calls=tool_calls or [],
            artifacts=artifacts or [],
        )
        self.session.add(message)
        project = self.get_project(project_id)
        project.updated_at = datetime.now(UTC)
        self.session.commit()
        return message

    def list_messages(self, project_id: str) -> list[Message]:
        self.get_project(project_id)
        statement = (
            select(Message).where(Message.project_id == project_id).order_by(Message.created_at)
        )
        return list(self.session.scalars(statement))

    def create_run(
        self,
        project_id: str,
        trigger_message_id: str,
        title: str,
        intent: str,
        source_ids: list[str],
        skill_ids: list[str],
        plan: list[dict[str, object]],
        runtime: str,
        retry_of_run_id: str | None = None,
    ) -> AnalysisRun:
        self.get_project(project_id)
        if retry_of_run_id:
            prior = self.get_run(project_id, retry_of_run_id)
            if prior.status not in {"failed", "cancelled"}:
                raise ValueError("Only a failed or cancelled run can be retried")
        run = AnalysisRun(
            id=str(uuid4()),
            project_id=project_id,
            trigger_message_id=trigger_message_id,
            retry_of_run_id=retry_of_run_id,
            title=title[:240],
            intent=intent,
            source_ids=list(source_ids),
            skill_ids=list(skill_ids),
            plan=plan,
            runtime=runtime,
        )
        self.session.add(run)
        self.session.flush()
        for position, item in enumerate(plan, start=1):
            self.session.add(
                RunStep(
                    id=str(uuid4()),
                    run_id=run.id,
                    position=position,
                    key=str(item["key"]),
                    label=str(item["label"]),
                )
            )
        self.session.commit()
        return self.get_run(project_id, run.id)

    def get_run(self, project_id: str, run_id: str) -> AnalysisRun:
        run = self.session.get(AnalysisRun, run_id)
        if not run or run.project_id != project_id:
            raise KeyError(f"Analysis run not found in project: {run_id}")
        return run

    def list_runs(self, project_id: str) -> list[AnalysisRun]:
        self.get_project(project_id)
        statement = (
            select(AnalysisRun)
            .where(AnalysisRun.project_id == project_id)
            .order_by(AnalysisRun.created_at.desc())
        )
        return list(self.session.scalars(statement).unique())

    def update_run_step(
        self,
        project_id: str,
        run_id: str,
        key: str,
        status: str,
        *,
        tool_name: str | None = None,
        call_id: str | None = None,
        input_fields: list[str] | None = None,
        artifact_ids: list[str] | None = None,
        error: str | None = None,
    ) -> RunStep:
        run = self.get_run(project_id, run_id)
        step = next((item for item in run.steps if item.key == key), None)
        if step is None:
            step = RunStep(
                id=str(uuid4()),
                run_id=run.id,
                position=len(run.steps) + 1,
                key=key,
                label=key,
            )
            self.session.add(step)
        now = datetime.now(UTC)
        step.status = status
        if status == "running" and step.started_at is None:
            step.started_at = now
        if status == "running":
            step.completed_at = None
        if status in {"succeeded", "failed", "skipped"}:
            step.completed_at = now
        if tool_name and tool_name not in step.tool_names:
            step.tool_names = [*step.tool_names, tool_name]
        if call_id and call_id not in step.call_ids:
            step.call_ids = [*step.call_ids, call_id]
        if input_fields:
            step.input_fields = sorted(set([*step.input_fields, *input_fields]))
        if artifact_ids:
            step.artifact_ids = list(dict.fromkeys([*step.artifact_ids, *artifact_ids]))
        if error:
            step.error = error
        run.updated_at = now
        self.session.commit()
        return step

    def complete_run(
        self,
        project_id: str,
        run_id: str,
        status: str,
        *,
        result_message_id: str | None = None,
        artifact_ids: list[str] | None = None,
        error: str | None = None,
    ) -> AnalysisRun:
        run = self.get_run(project_id, run_id)
        now = datetime.now(UTC)
        run.status = status
        run.result_message_id = result_message_id
        run.artifact_ids = list(dict.fromkeys(artifact_ids or []))
        run.error = error
        run.completed_at = now
        run.updated_at = now
        for step in run.steps:
            if step.status == "running":
                step.status = "failed" if status == "failed" else "skipped"
                step.completed_at = now
                if status == "failed" and error:
                    step.error = error
            elif step.status == "pending":
                step.status = "skipped"
                step.completed_at = now
        self.session.commit()
        return run

    def request_run_cancel(self, project_id: str, run_id: str) -> AnalysisRun:
        run = self.get_run(project_id, run_id)
        if run.status != "running":
            return run
        run.cancel_requested = True
        run.updated_at = datetime.now(UTC)
        self.session.commit()
        return run

    def attach_run_artifacts(
        self, project_id: str, run_id: str, artifact_ids: list[str], step_key: str = "present"
    ) -> AnalysisRun:
        run = self.get_run(project_id, run_id)
        for artifact_id in artifact_ids:
            self.get_artifact(project_id, artifact_id)
        run.artifact_ids = list(dict.fromkeys([*run.artifact_ids, *artifact_ids]))
        step = next((item for item in run.steps if item.key == step_key), None)
        if step is not None:
            step.artifact_ids = list(dict.fromkeys([*step.artifact_ids, *artifact_ids]))
        run.updated_at = datetime.now(UTC)
        self.session.commit()
        return run

    def next_report_version(self, project_id: str, report_key: str) -> int:
        statement = (
            select(ReportVersion)
            .where(
                ReportVersion.project_id == project_id,
                ReportVersion.report_key == report_key,
            )
            .order_by(ReportVersion.version.desc())
        )
        latest = self.session.scalars(statement).first()
        return 1 if latest is None else latest.version + 1

    def list_report_versions(self, project_id: str, report_key: str) -> list[ReportVersion]:
        statement = (
            select(ReportVersion)
            .where(
                ReportVersion.project_id == project_id,
                ReportVersion.report_key == report_key,
            )
            .order_by(ReportVersion.version.desc())
        )
        return list(self.session.scalars(statement))

    def list_latest_reports(self, project_id: str) -> list[ReportVersion]:
        self.get_project(project_id)
        latest_versions = (
            select(
                ReportVersion.report_key,
                func.max(ReportVersion.version).label("latest_version"),
            )
            .where(ReportVersion.project_id == project_id)
            .group_by(ReportVersion.report_key)
            .subquery()
        )
        statement = (
            select(ReportVersion)
            .join(
                latest_versions,
                (ReportVersion.report_key == latest_versions.c.report_key)
                & (ReportVersion.version == latest_versions.c.latest_version),
            )
            .where(ReportVersion.project_id == project_id)
            .order_by(ReportVersion.created_at.desc())
        )
        return list(self.session.scalars(statement))

    def get_report_version(self, project_id: str, report_key: str, version: int) -> ReportVersion:
        statement = select(ReportVersion).where(
            ReportVersion.project_id == project_id,
            ReportVersion.report_key == report_key,
            ReportVersion.version == version,
        )
        report = self.session.scalars(statement).first()
        if report is None:
            raise KeyError(f"Report version not found: {report_key} v{version}")
        return report

    def add_report_version(
        self,
        project_id: str,
        report_key: str,
        version: int,
        title: str,
        markdown_path: str,
        artifact_ids: list[str],
        note: str,
        based_on_version: int | None = None,
        run_id: str | None = None,
    ) -> ReportVersion:
        if run_id:
            self.get_run(project_id, run_id)
        report = ReportVersion(
            id=str(uuid4()),
            project_id=project_id,
            run_id=run_id,
            report_key=report_key,
            version=version,
            title=title,
            markdown_path=markdown_path,
            artifact_ids=artifact_ids,
            note=note,
            based_on_version=based_on_version,
        )
        self.session.add(report)
        self.session.commit()
        return report
