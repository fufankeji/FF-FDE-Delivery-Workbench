from pathlib import Path
from zipfile import ZipFile

import pandas as pd
from northlight.models import InstalledSkill, ProjectSkill
from northlight.query_service import write_chart_spec
from northlight.report_service import ReportService
from northlight.repository import Repository
from northlight.skill_service import SkillService
from northlight.workspace import project_root
from sqlalchemy.orm import Session


def test_report_versions_restore_and_html_are_immutable(session: Session) -> None:
    repository = Repository(session)
    project = repository.create_project("Customer satisfaction")
    service = ReportService(repository)
    first = service.create(project.id, "Olist report", "Evidence-backed summary.", [])
    second = service.revise(
        project.id, first.report_key, "# Revised\n\nNew conclusion.", "Revision"
    )
    restored = service.restore(project.id, first.report_key, 1)
    assert [first.version, second.version, restored.version] == [1, 2, 3]
    assert restored.based_on_version == 1
    first_text = (project_root(project.id) / first.markdown_path).read_text(encoding="utf-8")
    assert "Evidence-backed" in first_text
    html_path = service.render_html(project.id, first.report_key, 3)
    assert html_path.is_file()
    assert "DS4 · AI Analysis Report" in html_path.read_text(encoding="utf-8")


def test_run_report_rejects_other_runs_and_binds_report_artifact(session: Session) -> None:
    repository = Repository(session)
    project = repository.create_project("Two independent runs")
    artifacts = []
    runs = []
    for index in (1, 2):
        path = project_root(project.id) / "datasets" / "derived" / f"run-{index}.csv"
        path.write_text(f"value\n{index}\n", encoding="utf-8")
        artifact = repository.add_artifact(
            project.id, "derived", f"Run {index} result", path, {"rows": 1, "columns": ["value"]}
        )
        trigger = repository.add_message(project.id, "user", f"Run {index}")
        run = repository.create_run(
            project.id,
            trigger.id,
            f"Run {index}",
            "data_qa",
            [],
            [],
            [{"key": "present", "label": "保存结果"}],
            "local-fallback",
        )
        repository.complete_run(project.id, run.id, "succeeded", artifact_ids=[artifact.id])
        artifacts.append(artifact)
        runs.append(run)

    service = ReportService(repository)
    try:
        service.create(
            project.id,
            "Wrong scope",
            None,
            [artifacts[0].id],
            run_id=runs[1].id,
            restrict_to_run=True,
        )
    except ValueError as exc:
        assert "only consume artifacts" in str(exc)
    else:
        raise AssertionError("report accepted an artifact from another run")

    report = service.create(
        project.id,
        "Second run report",
        None,
        [artifacts[1].id],
        run_id=runs[1].id,
        restrict_to_run=True,
    )
    refreshed = repository.get_run(project.id, runs[1].id)
    report_artifact = repository.get_artifact(project.id, refreshed.artifact_ids[-1])
    assert report.run_id == runs[1].id
    assert report.artifact_ids == [artifacts[1].id]
    assert report_artifact.type == "report"
    assert report_artifact.artifact_metadata["run_id"] == runs[1].id
    assert artifacts[0].id not in report.artifact_ids


def test_report_render_failure_keeps_version_recoverable(session: Session) -> None:
    repository = Repository(session)
    project = repository.create_project("Recoverable report render")
    service = ReportService(repository)
    report = service.create(project.id, "Recoverable report", "Evidence-backed summary.", [])
    markdown_path = project_root(project.id) / report.markdown_path
    original = markdown_path.read_text(encoding="utf-8")
    markdown_path.unlink()

    try:
        service.render_html(project.id, report.report_key, report.version)
    except FileNotFoundError:
        pass
    else:
        raise AssertionError("missing Markdown unexpectedly rendered")
    assert repository.get_report_version(project.id, report.report_key, report.version).html_path is None

    markdown_path.write_text(original, encoding="utf-8")
    assert service.render_html(project.id, report.report_key, report.version).is_file()


def test_report_records_default_skill_trigger_and_evidence_gaps(session: Session) -> None:
    repository = Repository(session)
    project = repository.create_project("Evidence gate")
    report = ReportService(repository).create(
        project.id, "Evidence gate report", None, [], "message-123"
    )
    artifact = next(
        item
        for item in repository.list_artifacts(project.id)
        if item.artifact_metadata.get("report_key") == report.report_key
    )
    audit = artifact.artifact_metadata["evidence_audit"]
    assert audit["status"] == "evidence_gaps"
    assert artifact.artifact_metadata["generator_skill"] == "complete-analysis-report"
    assert artifact.artifact_metadata["generator_skill_version"] == "1.1.0"
    assert artifact.artifact_metadata["trigger_message_id"] == "message-123"
    markdown = (project_root(project.id) / report.markdown_path).read_text(encoding="utf-8")
    assert "待补证" in markdown


def test_report_uses_registered_evidence_and_embeds_interactive_chart(session: Session) -> None:
    repository = Repository(session)
    project = repository.create_project("Evidence report")
    data_path = project_root(project.id) / "datasets" / "extracts" / "revenue.parquet"
    pd.DataFrame([{"state": "SP", "revenue": 120}, {"state": "RJ", "revenue": 60}]).to_parquet(
        data_path, index=False
    )
    source = repository.add_artifact(
        project.id,
        "extract",
        "Revenue by state",
        data_path,
        {
            "rows": 2,
            "columns": ["state", "revenue"],
            "preview": [{"state": "SP", "revenue": 120}, {"state": "RJ", "revenue": 60}],
        },
    )
    chart = write_chart_spec(
        repository, project.id, source.id, "bar", "state", ["revenue"], "Revenue mix"
    )
    service = ReportService(repository)
    report = service.create(project.id, "Evidence report", None, [source.id, chart.id])
    report_artifact = next(
        item
        for item in repository.list_artifacts(project.id)
        if item.type == "report" and item.artifact_metadata.get("report_key") == report.report_key
    )
    assert report_artifact.artifact_metadata["evidence_audit"]["status"] == "evidence_gaps"
    markdown = (project_root(project.id) / report.markdown_path).read_text(encoding="utf-8")
    assert "SP" in markdown
    assert source.id in markdown
    assert "完整数据产物：2 行 × 2 列；报告摘要展示全部 2 行 × 全部 2 列" in markdown
    assert f"/api/projects/{project.id}/artifacts/{source.id}/download" in markdown
    html = service.render_html(project.id, report.report_key, report.version).read_text(
        encoding="utf-8"
    )
    assert 'class="report-table-frame"' in html
    assert 'class="report-table-scroll"' in html
    assert "report-chart-1" in html
    assert "echarts.init" in html
    assert "Revenue mix" in html


def test_report_does_not_infer_rankings_from_detail_rows(session: Session) -> None:
    repository = Repository(session)
    project = repository.create_project("Detail safety")
    data_path = project_root(project.id) / "datasets" / "extracts" / "training.parquet"
    pd.DataFrame(
        [
            {"state": "SP", "payment": 10.0, "low_review": 1},
            {"state": "RJ", "payment": 200.0, "low_review": 0},
        ]
    ).to_parquet(data_path, index=False)
    detail = repository.add_artifact(
        project.id,
        "extract",
        "Training detail rows",
        data_path,
        {
            "rows": 2,
            "columns": ["state", "payment", "low_review"],
            "query_shape": "detail",
            "preview": [
                {"state": "SP", "payment": 10.0, "low_review": 1},
                {"state": "RJ", "payment": 200.0, "low_review": 0},
            ],
        },
    )
    report = ReportService(repository).create(
        project.id, "Detail-safe report", None, [detail.id]
    )
    markdown = (project_root(project.id) / report.markdown_path).read_text(encoding="utf-8")
    assert "Training detail rows 的首位" not in markdown
    assert "不足以形成承重业务结论" in markdown


def test_report_chart_data_cannot_break_out_of_inline_script(session: Session) -> None:
    repository = Repository(session)
    project = repository.create_project("Report XSS")
    attack = "</script><script>globalThis.NORTHLIGHT_XSS=7731</script>"
    data_path = project_root(project.id) / "datasets" / "extracts" / "xss.parquet"
    pd.DataFrame([{"label": attack, "value": 1}]).to_parquet(data_path, index=False)
    source = repository.add_artifact(
        project.id,
        "extract",
        "Untrusted labels",
        data_path,
        {"rows": 1, "columns": ["label", "value"], "preview": [{"label": attack, "value": 1}]},
    )
    chart = write_chart_spec(
        repository, project.id, source.id, "bar", "label", ["value"], "Untrusted chart"
    )
    service = ReportService(repository)
    report = service.create(project.id, "Safe report", None, [source.id, chart.id])
    html = service.render_html(project.id, report.report_key, 1).read_text(encoding="utf-8")
    assert "</script><script>globalThis.NORTHLIGHT_XSS" not in html
    assert "\\u003c/script\\u003e" in html


def test_skill_install_and_project_enablement(session: Session) -> None:
    repository = Repository(session)
    project = repository.create_project("Skills")
    service = SkillService(repository)
    skill = service.install_builtin()
    enabled = service.enable(project.id, skill.id, service.declared_permissions(skill))
    assert enabled.project_id == project.id
    assert enabled.skill_id == skill.id


def test_builtin_skill_library_installs_content_first_catalog(session: Session) -> None:
    service = SkillService(Repository(session))

    skills = service.install_builtins()

    assert len(skills) == 10
    assert {skill.name for skill in skills} >= {
        "complete-analysis-report",
        "data-quality-audit",
        "sql-business-analysis",
        "metric-root-cause-analysis",
        "visualization-storytelling",
        "feature-engineering-guardrails",
        "model-evaluation-and-fusion",
        "customer-segmentation",
        "time-series-diagnostics",
        "anomaly-investigation",
    }
    quality = next(skill for skill in skills if skill.name == "data-quality-audit")
    catalog = service.catalog_content(quality)
    assert service.is_builtin(quality)
    assert catalog["display_name"] == "数据质量审计"
    assert "业务问题" in str(catalog["body_excerpt"])
    assert len(catalog["highlights"]) == 3
    assert "modeling" in catalog["applies_to"]


def test_builtin_upgrade_migrates_project_links_and_default(session: Session) -> None:
    repository = Repository(session)
    service = SkillService(repository)
    current = service.install_builtin()
    project = repository.create_project("Builtin upgrade")
    stale_path = service.root / "complete-analysis-report@stale"
    stale_path.mkdir()
    stale = InstalledSkill(
        id="complete-analysis-report@stale",
        name=current.name,
        version="0.9.0",
        content_hash="0" * 64,
        path=str(stale_path),
        has_scripts=False,
        default_for_new_projects=True,
        manifest=current.manifest,
    )
    session.add(stale)
    session.add(
        ProjectSkill(
            project_id=project.id,
            skill_id=stale.id,
            permissions=service.declared_permissions(current),
        )
    )
    session.commit()

    upgraded = service.install_builtin()

    assert session.get(InstalledSkill, stale.id) is None
    assert session.get(
        ProjectSkill, {"project_id": project.id, "skill_id": upgraded.id}
    ) is not None
    assert upgraded.default_for_new_projects is True
    assert not stale_path.exists()


def test_installed_skill_can_be_inspected_without_escaping_root(session: Session) -> None:
    service = SkillService(Repository(session))
    skill = service.install_builtin()

    inspection = service.inspect(skill.id)

    assert inspection["selected_path"] == "SKILL.md"
    assert "完整数据分析报告" in str(inspection["content"])
    assert any(item["path"] == "SKILL.md" for item in inspection["files"])
    try:
        service.inspect(skill.id, "../connections.json")
    except ValueError as exc:
        assert "inside" in str(exc)
    else:
        raise AssertionError("Skill inspection escaped the installed directory")


def test_skill_archive_rejects_path_traversal(tmp_path: Path, session: Session) -> None:
    archive = tmp_path / "unsafe.zip"
    with ZipFile(archive, "w") as bundle:
        bundle.writestr("../SKILL.md", "---\nname: unsafe\n---\n")
    service = SkillService(Repository(session))
    try:
        service.install_archive(archive)
    except ValueError as exc:
        assert "Unsafe archive path" in str(exc)
    else:
        raise AssertionError("path traversal archive was accepted")


def test_skill_versions_upgrade_and_uninstall_have_explicit_semantics(
    tmp_path: Path, session: Session
) -> None:
    repository = Repository(session)
    project = repository.create_project("Skill lifecycle")
    service = SkillService(repository)
    versions = []
    for version in ("1.0.0", "2.0.0"):
        root = tmp_path / version
        root.mkdir()
        (root / "SKILL.md").write_text(
            f"---\nname: cohort-analysis\nversion: {version}\n"
            "description: Compare cohorts.\napplies_to: [exploration]\n"
            "permissions:\n  files: project-read\n  database: read-only\n"
            "  network: none\n  code: structured-tools-only\n---\n"
            f"# Cohort analysis {version}\n",
            encoding="utf-8",
        )
        versions.append(service._install_directory(root))
    service.enable(project.id, versions[0].id, service.declared_permissions(versions[0]))
    service.upgrade(project.id, versions[1].id, service.declared_permissions(versions[1]))
    assert [item.skill_id for item in service.list_enabled(project.id)] == [versions[1].id]
    service.uninstall(versions[0].id)
    try:
        service.uninstall(versions[1].id)
    except ValueError as exc:
        assert "Disable" in str(exc)
    else:
        raise AssertionError("enabled Skill was uninstalled")


def test_skill_manifest_requires_permissions_and_rejects_permission_escalation(
    tmp_path: Path, session: Session
) -> None:
    root = tmp_path / "unsafe-skill"
    root.mkdir()
    (root / "SKILL.md").write_text(
        "---\nname: unsafe-skill\nversion: 1.0.0\n"
        "description: Missing permission contract.\n---\n",
        encoding="utf-8",
    )
    service = SkillService(Repository(session))
    try:
        service._install_directory(root)
    except ValueError as exc:
        assert "permissions" in str(exc)
    else:
        raise AssertionError("Skill without permissions was installed")

    (root / "scripts").mkdir()
    (root / "scripts" / "run.py").write_text("print('ok')\n", encoding="utf-8")
    (root / "SKILL.md").write_text(
        "---\nname: unsafe-skill\nversion: 1.0.0\n"
        "description: Missing script entrypoint.\n"
        "permissions:\n  files: project-read-write\n  database: none\n"
        "  network: none\n  code: sandbox-only\n---\n",
        encoding="utf-8",
    )
    try:
        service._install_directory(root)
    except ValueError as exc:
        assert "entrypoints" in str(exc)
    else:
        raise AssertionError("Script Skill without entrypoints was installed")

    skill = service.install_builtin()
    project = service.repository.create_project("Permission escalation")
    escalated = {**service.declared_permissions(skill), "network": "internet"}
    try:
        service.enable(project.id, skill.id, escalated)
    except ValueError as exc:
        assert "exactly match" in str(exc)
    else:
        raise AssertionError("undeclared permission escalation was accepted")
