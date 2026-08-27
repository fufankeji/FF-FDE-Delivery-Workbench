import json
import shutil
import subprocess
from pathlib import Path
from zipfile import ZipFile

import pytest
from northlight.repository import Repository
from northlight.skill_service import SkillService
from northlight.workspace import project_root
from sqlalchemy.orm import Session


@pytest.mark.skipif(shutil.which("docker") is None, reason="Docker CLI is unavailable")
def test_script_skill_runs_without_network_or_rootfs_write(
    tmp_path: Path, session: Session
) -> None:
    image = subprocess.run(
        ["docker", "image", "inspect", "northlight-python-sandbox:0.1"],
        capture_output=True,
        check=False,
    )
    if image.returncode != 0:
        pytest.skip("Northlight sandbox image has not been built")
    archive = tmp_path / "sandbox-skill.zip"
    script = """import json
import os
import socket
from pathlib import Path

payload = {"uid": os.getuid(), "network_blocked": False, "rootfs_read_only": False}
try:
    socket.create_connection(("example.com", 80), timeout=1)
except OSError:
    payload["network_blocked"] = True
try:
    Path("/forbidden.txt").write_text("no", encoding="utf-8")
except OSError:
    payload["rootfs_read_only"] = True
Path("skill-sandbox-output.json").write_text(json.dumps(payload), encoding="utf-8")
print(json.dumps(payload))
"""
    with ZipFile(archive, "w") as bundle:
        bundle.writestr(
            "sandbox-check/SKILL.md",
            "---\nname: sandbox-check\nversion: 1.0.0\n"
            "description: sandbox integration\nentrypoints: [probe.py]\n"
            "permissions:\n  files: project-read-write\n  database: none\n"
            "  network: none\n  code: sandbox-only\n---\n",
        )
        bundle.writestr("sandbox-check/scripts/probe.py", script)
    repository = Repository(session)
    project = repository.create_project("Sandbox skill")
    service = SkillService(repository)
    skill = service.install_archive(archive)
    service.enable(project.id, skill.id, service.declared_permissions(skill))
    result = service.run_script(project.id, skill.id, "probe.py", [])
    assert result["status"] == "succeeded"
    assert result["return_code"] == 0
    output = json.loads(
        (project_root(project.id) / "skill-sandbox-output.json").read_text(encoding="utf-8")
    )
    assert output == {"uid": 10001, "network_blocked": True, "rootfs_read_only": True}


@pytest.mark.skipif(shutil.which("docker") is None, reason="Docker CLI is unavailable")
def test_custom_analysis_skill_produces_project_output(tmp_path: Path, session: Session) -> None:
    image = subprocess.run(
        ["docker", "image", "inspect", "northlight-python-sandbox:0.1"],
        capture_output=True,
        check=False,
    )
    if image.returncode != 0:
        pytest.skip("Northlight sandbox image has not been built")
    fixture = Path(__file__).resolve().parents[2] / "fixtures" / "skills" / "custom-analysis"
    archive = tmp_path / "custom-analysis.zip"
    with ZipFile(archive, "w") as bundle:
        for path in fixture.rglob("*"):
            if path.is_file():
                bundle.write(path, Path("custom-analysis") / path.relative_to(fixture))

    repository = Repository(session)
    project = repository.create_project("Custom analysis")
    source = project_root(project.id) / "datasets" / "raw" / "orders.csv"
    source.write_text("state,revenue\nSP,12\nRJ,7\nSP,8\n", encoding="utf-8")
    service = SkillService(repository)
    skill = service.install_archive(archive)
    service.enable(project.id, skill.id, service.declared_permissions(skill))
    result = service.run_script(project.id, skill.id, "summarize.py", ["datasets/raw/orders.csv"])
    assert result["status"] == "succeeded"
    output = json.loads(
        (project_root(project.id) / "custom-analysis-summary.json").read_text(encoding="utf-8")
    )
    assert output["rows"] == 3
    assert output["numeric_totals"]["revenue"] == 27
    assert repository.get_artifact(project.id, str(result["artifact_id"])).type == "skill_run"
    output_ids = result["output_artifacts"]
    assert isinstance(output_ids, list) and len(output_ids) == 1
    output_artifact = repository.get_artifact(project.id, str(output_ids[0]))
    assert output_artifact.type == "skill_output"
    assert output_artifact.lineage == [result["artifact_id"]]
    assert result["declared_permissions"] == result["permissions"]
