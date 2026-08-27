import json
from pathlib import Path
from zipfile import ZipFile

from northlight.api import export_project
from northlight.repository import Repository
from northlight.workspace import PROJECT_DIRS, project_root
from sqlalchemy.orm import Session


def test_project_creates_isolated_workspace(session: Session) -> None:
    project = Repository(session).create_project("Olist analysis")
    root = project_root(project.id)
    assert root.is_dir()
    assert (root / "project.json").is_file()
    for relative in PROJECT_DIRS:
        assert (root / relative).is_dir()


def test_repository_rejects_cross_project_artifact(session: Session) -> None:
    repository = Repository(session)
    first = repository.create_project("First")
    second = repository.create_project("Second")
    path = project_root(first.id) / "datasets" / "derived" / "sample.csv"
    path.write_text("value\n1\n", encoding="utf-8")
    artifact = repository.add_artifact(first.id, "derived", "sample", path)
    try:
        repository.get_artifact(second.id, artifact.id)
    except KeyError:
        pass
    else:
        raise AssertionError("cross-project artifact access was not rejected")


def test_project_rename_archive_and_export_preserve_workspace(session: Session) -> None:
    repository = Repository(session)
    project = repository.create_project("Before")
    updated = repository.update_project(project.id, "After", "archived")
    trigger = repository.add_message(project.id, "user", "分析区域销售")
    repository.create_run(
        project.id,
        trigger_message_id=trigger.id,
        title="区域销售分析",
        intent="analysis",
        source_ids=[],
        skill_ids=[],
        plan=[{"key": "query", "label": "查询业务数据"}],
        runtime="local-fallback",
    )
    descriptor = json.loads((project_root(project.id) / "project.json").read_text())
    assert updated.title == "After"
    assert updated.status == "archived"
    assert descriptor["title"] == "After"
    assert descriptor["status"] == "archived"

    response = export_project(project.id, repository)
    archive = Path(str(response.path))
    with ZipFile(archive) as bundle:
        assert "northlight-export.json" in bundle.namelist()
        assert "workspace/project.json" in bundle.namelist()
        manifest = json.loads(bundle.read("northlight-export.json"))
    assert manifest["project"]["title"] == "After"
    assert manifest["project"]["status"] == "archived"
    assert manifest["runs"][0]["title"] == "区域销售分析"
    assert manifest["runs"][0]["steps"][0]["label"] == "查询业务数据"


def test_project_delete_removes_records_and_moves_workspace_to_trash(session: Session) -> None:
    repository = Repository(session)
    project = repository.create_project("Delete me")
    repository.add_message(project.id, "user", "删除测试")
    workspace = project_root(project.id)

    repository.delete_project(project.id)

    assert not workspace.exists()
    assert session.get(type(project), project.id) is None
    trash = workspace.parent.parent / "trash" / "deleted-projects"
    assert any(path.name.endswith(project.id) for path in trash.iterdir())
