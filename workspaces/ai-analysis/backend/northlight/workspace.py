from __future__ import annotations

import hashlib
import json
import shutil
from datetime import UTC, datetime
from pathlib import Path
from uuid import UUID

from northlight.settings import get_settings

PROJECT_DIRS = (
    "sources",
    "datasets/raw",
    "datasets/extracts",
    "datasets/derived",
    "queries",
    "code",
    "models",
    "predictions",
    "visuals",
    "reports/versions",
    "reports/html",
    "skills",
    "runs",
)


def validate_project_id(project_id: str) -> str:
    return str(UUID(project_id))


def project_root(project_id: str) -> Path:
    valid = validate_project_id(project_id)
    root = get_settings().projects_root.resolve() / valid
    root.relative_to(get_settings().projects_root.resolve())
    return root


def initialize_project_workspace(project_id: str, title: str) -> Path:
    root = project_root(project_id)
    for relative in PROJECT_DIRS:
        (root / relative).mkdir(parents=True, exist_ok=True)
    descriptor = {"id": project_id, "title": title, "schema_version": 1}
    (root / "project.json").write_text(
        json.dumps(descriptor, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return root


def trash_project_workspace(project_id: str) -> Path:
    root = project_root(project_id)
    if not root.exists():
        raise FileNotFoundError(root)
    trash_root = get_settings().runtime_root.resolve() / "trash" / "deleted-projects"
    trash_root.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%S%fZ")
    destination = trash_root / f"{timestamp}-{validate_project_id(project_id)}"
    root.rename(destination)
    return destination


def restore_project_workspace(project_id: str, trashed: Path) -> None:
    destination = project_root(project_id)
    trashed.resolve().relative_to((get_settings().runtime_root.resolve() / "trash").resolve())
    if destination.exists():
        raise FileExistsError(destination)
    trashed.rename(destination)


def copy_source(project_id: str, source: Path, destination_name: str | None = None) -> Path:
    if not source.is_file():
        raise FileNotFoundError(source)
    safe_name = Path(destination_name or source.name).name
    if safe_name in {"", ".", ".."}:
        raise ValueError("Source file name is invalid")
    destination = project_root(project_id) / "sources" / safe_name
    counter = 2
    while destination.exists():
        destination = destination.with_stem(f"{source.stem}-{counter}")
        counter += 1
    shutil.copy2(source, destination)
    return destination


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def safe_relative(project_id: str, path: Path) -> str:
    return str(path.resolve().relative_to(project_root(project_id).resolve()))
