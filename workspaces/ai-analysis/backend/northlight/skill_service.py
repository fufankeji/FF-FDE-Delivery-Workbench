from __future__ import annotations

import hashlib
import json
import re
import shutil
import subprocess
import zipfile
from pathlib import Path
from uuid import uuid4

import yaml
from deepagents.backends.protocol import FileData
from deepagents.backends.utils import create_file_data
from sqlalchemy import select

from northlight.models import InstalledSkill, Project, ProjectSkill
from northlight.repository import Repository
from northlight.settings import get_settings
from northlight.workspace import project_root

MAX_SKILL_ARCHIVE_BYTES = 25 * 1024 * 1024
MAX_SKILL_FILES = 250
MAX_SKILL_UNCOMPRESSED_BYTES = 100 * 1024 * 1024
MAX_AGENT_SKILL_CONTEXT_BYTES = 250_000
MAX_SKILL_INSPECTION_BYTES = 500_000
AGENT_SKILL_TEXT_SUFFIXES = {".md", ".txt", ".yaml", ".yml", ".json", ".py"}
SKILL_NAME_PATTERN = re.compile(r"^[a-z0-9][a-z0-9._-]{1,63}$")
SKILL_VERSION_PATTERN = re.compile(r"^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$")
SKILL_PERMISSION_VALUES = {
    "files": {"none", "project-read", "project-read-write"},
    "database": {"none", "read-only"},
    "network": {"none"},
    "code": {"none", "structured-tools-only", "sandbox-only"},
}


def directory_hash(root: Path) -> str:
    digest = hashlib.sha256()
    for path in sorted(item for item in root.rglob("*") if item.is_file()):
        digest.update(str(path.relative_to(root)).encode())
        digest.update(path.read_bytes())
    return digest.hexdigest()


def parse_skill_header(skill_file: Path) -> dict[str, object]:
    text = skill_file.read_text(encoding="utf-8")
    if not text.startswith("---\n"):
        raise ValueError("SKILL.md must start with YAML front matter")
    _, front_matter, _ = text.split("---", 2)
    payload = yaml.safe_load(front_matter) or {}
    if not isinstance(payload, dict):
        raise ValueError("SKILL.md front matter must be a mapping")
    for field in ("name", "version", "description", "permissions"):
        if field not in payload:
            raise ValueError(f"SKILL.md front matter must define {field}")
    name = payload["name"]
    version = payload["version"]
    description = payload["description"]
    if not isinstance(name, str) or not SKILL_NAME_PATTERN.fullmatch(name):
        raise ValueError("Skill name must be a lowercase slug of 2-64 characters")
    if not isinstance(version, str) or not SKILL_VERSION_PATTERN.fullmatch(version):
        raise ValueError("Skill version must use semantic versioning such as 1.0.0")
    if not isinstance(description, str) or not description.strip():
        raise ValueError("Skill description must be a non-empty string")
    permissions = payload["permissions"]
    if not isinstance(permissions, dict) or set(permissions) != set(SKILL_PERMISSION_VALUES):
        raise ValueError(
            "Skill permissions must declare exactly files, database, network and code"
        )
    for key, allowed in SKILL_PERMISSION_VALUES.items():
        value = permissions.get(key)
        if value not in allowed:
            raise ValueError(f"Unsupported Skill permission {key}={value!r}")
    applies_to = payload.get("applies_to", ["all"])
    if not isinstance(applies_to, list) or not applies_to or not all(
        isinstance(item, str) for item in applies_to
    ):
        raise ValueError("Skill applies_to must be a non-empty list of intent names")
    return payload


class SkillService:
    def __init__(self, repository: Repository):
        self.repository = repository
        self.root = get_settings().runtime_root / "skills"
        self.root.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def builtin_sources() -> list[Path]:
        root = Path(__file__).resolve().parent / "skills"
        return sorted(
            path.parent for path in root.glob("*/SKILL.md") if path.parent.is_dir()
        )

    @classmethod
    def builtin_names(cls) -> set[str]:
        return {path.name for path in cls.builtin_sources()}

    def install_builtins(self) -> list[InstalledSkill]:
        installed = [self._install_builtin_source(source) for source in self.builtin_sources()]
        if not installed:
            raise FileNotFoundError("No built-in Skills were found")
        return installed

    def install_builtin(self) -> InstalledSkill:
        """Compatibility entrypoint for consumers that need the report Skill."""
        source = Path(__file__).resolve().parent / "skills" / "complete-analysis-report"
        return self._install_builtin_source(source)

    def _install_builtin_source(self, source: Path) -> InstalledSkill:
        current = self._install_directory(source)
        stale = list(
            self.repository.session.scalars(
                select(InstalledSkill).where(
                    InstalledSkill.name == current.name,
                    InstalledSkill.id != current.id,
                )
            )
        )
        stale_paths: list[Path] = []
        for skill in stale:
            links = list(
                self.repository.session.scalars(
                    select(ProjectSkill).where(ProjectSkill.skill_id == skill.id)
                )
            )
            for link in links:
                replacement = self.repository.session.get(
                    ProjectSkill, {"project_id": link.project_id, "skill_id": current.id}
                )
                if replacement is None:
                    self.repository.session.add(
                        ProjectSkill(
                            project_id=link.project_id,
                            skill_id=current.id,
                            permissions=link.permissions,
                            enabled_at=link.enabled_at,
                        )
                    )
                self.repository.session.delete(link)
            current.default_for_new_projects = (
                current.default_for_new_projects or skill.default_for_new_projects
            )
            stale_paths.append(Path(skill.path))
            self.repository.session.delete(skill)
        self.repository.session.commit()
        for path in stale_paths:
            if path.is_dir() and path.parent.resolve() == self.root.resolve():
                shutil.rmtree(path)
        return current

    def is_builtin(self, skill: InstalledSkill) -> bool:
        return skill.name in self.builtin_names()

    def catalog_content(self, skill: InstalledSkill) -> dict[str, object]:
        front_matter = skill.manifest.get("front_matter", {})
        if not isinstance(front_matter, dict):
            front_matter = {}
        text = (Path(skill.path) / "SKILL.md").read_text(encoding="utf-8")
        body = text.split("---", 2)[-1].strip() if text.startswith("---\n") else text.strip()
        paragraphs: list[str] = []
        current: list[str] = []
        highlights: list[str] = []
        for raw_line in body.splitlines():
            line = raw_line.strip()
            if not line:
                if current:
                    paragraphs.append(" ".join(current))
                    current = []
                continue
            if line.startswith("#"):
                if current:
                    paragraphs.append(" ".join(current))
                    current = []
                continue
            bullet = re.match(r"^(?:[-*]|\d+[.)])\s+(.+)$", line)
            if bullet:
                value = re.sub(r"\s+", " ", bullet.group(1)).strip()
                if value and len(highlights) < 3:
                    highlights.append(value[:180])
                continue
            if not line.startswith((">", "```")):
                current.append(line)
        if current:
            paragraphs.append(" ".join(current))
        excerpt = next((item for item in paragraphs if len(item) >= 24), "")
        applies_to = front_matter.get("applies_to", ["all"])
        if not isinstance(applies_to, list):
            applies_to = [str(applies_to)]
        return {
            "display_name": str(front_matter.get("display_name") or skill.name),
            "body_excerpt": excerpt[:420],
            "highlights": highlights,
            "applies_to": [str(item) for item in applies_to],
        }

    def install_archive(self, archive: Path) -> InstalledSkill:
        if archive.stat().st_size > MAX_SKILL_ARCHIVE_BYTES:
            raise ValueError("Skill archive exceeds 25 MB")
        staging = self.root / ".staging" / hashlib.sha256(archive.read_bytes()).hexdigest()[:16]
        if staging.exists():
            shutil.rmtree(staging)
        staging.mkdir(parents=True)
        with zipfile.ZipFile(archive) as bundle:
            members = bundle.infolist()
            if len(members) > MAX_SKILL_FILES:
                raise ValueError("Skill archive contains too many files")
            if sum(member.file_size for member in members) > MAX_SKILL_UNCOMPRESSED_BYTES:
                raise ValueError("Skill archive expands beyond 100 MB")
            for member in members:
                member_path = Path(member.filename)
                if member_path.is_absolute() or ".." in member_path.parts:
                    raise ValueError(f"Unsafe archive path: {member.filename}")
                if member.is_dir():
                    continue
                destination = (staging / member_path).resolve()
                destination.relative_to(staging.resolve())
                destination.parent.mkdir(parents=True, exist_ok=True)
                with bundle.open(member) as source, destination.open("wb") as output:
                    shutil.copyfileobj(source, output)
        candidates = list(staging.rglob("SKILL.md"))
        if len(candidates) != 1:
            raise ValueError("Skill archive must contain exactly one SKILL.md")
        return self._install_directory(candidates[0].parent)

    def _install_directory(self, source: Path) -> InstalledSkill:
        header = parse_skill_header(source / "SKILL.md")
        has_scripts = (source / "scripts").is_dir()
        entrypoints = header.get("entrypoints")
        if has_scripts:
            if not isinstance(entrypoints, list) or not entrypoints:
                raise ValueError("Script Skills must declare a non-empty entrypoints list")
            for entrypoint in entrypoints:
                relative = Path(str(entrypoint))
                if (
                    relative.is_absolute()
                    or ".." in relative.parts
                    or relative.suffix != ".py"
                    or not (source / "scripts" / relative).is_file()
                ):
                    raise ValueError(f"Invalid or missing Skill entrypoint: {entrypoint}")
            permissions = header["permissions"]
            assert isinstance(permissions, dict)
            if permissions["code"] != "sandbox-only":
                raise ValueError("Script Skills must declare code=sandbox-only")
        content_hash = directory_hash(source)
        skill_id = f"{header['name']}@{content_hash[:12]}"
        existing = self.repository.session.get(InstalledSkill, skill_id)
        if existing:
            return existing
        destination = self.root / skill_id
        if destination.exists():
            shutil.rmtree(destination)
        shutil.copytree(source, destination)
        skill = InstalledSkill(
            id=skill_id,
            name=str(header["name"]),
            version=str(header["version"]),
            content_hash=content_hash,
            path=str(destination),
            has_scripts=has_scripts,
            manifest={"front_matter": header, "file_count": sum(1 for _ in destination.rglob("*"))},
        )
        self.repository.session.add(skill)
        self.repository.session.commit()
        return skill

    def list_installed(self) -> list[InstalledSkill]:
        return list(self.repository.session.scalars(select(InstalledSkill)))

    def inspect(self, skill_id: str, selected_path: str = "SKILL.md") -> dict[str, object]:
        skill = self.repository.session.get(InstalledSkill, skill_id)
        if not skill:
            raise KeyError(f"Skill not installed: {skill_id}")
        root = Path(skill.path).resolve()
        if not root.is_dir():
            raise FileNotFoundError(f"Installed Skill directory is missing: {skill_id}")
        files: list[dict[str, object]] = []
        for path in sorted(root.rglob("*"), key=lambda item: (item.is_file(), str(item))):
            relative_path = path.relative_to(root).as_posix()
            files.append(
                {
                    "path": relative_path,
                    "kind": "file" if path.is_file() else "directory",
                    "size": path.stat().st_size if path.is_file() else None,
                }
            )
        selected_relative = Path(selected_path)
        if selected_relative.is_absolute() or ".." in selected_relative.parts:
            raise ValueError("Skill inspection path must stay inside the installed Skill")
        target = (root / selected_relative).resolve()
        target.relative_to(root)
        if not target.is_file():
            raise FileNotFoundError(f"Skill file not found: {selected_path}")
        if target.suffix.lower() not in AGENT_SKILL_TEXT_SUFFIXES:
            raise ValueError("Only bounded text Skill files can be inspected")
        raw = target.read_bytes()
        truncated = len(raw) > MAX_SKILL_INSPECTION_BYTES
        content = raw[:MAX_SKILL_INSPECTION_BYTES].decode("utf-8", errors="replace")
        return {
            "skill_id": skill.id,
            "files": files,
            "selected_path": selected_relative.as_posix(),
            "content": content,
            "truncated": truncated,
        }

    def usage(self, skill_id: str) -> tuple[int, list[str]]:
        rows = self.repository.session.execute(
            select(Project.title)
            .join(ProjectSkill, ProjectSkill.project_id == Project.id)
            .where(ProjectSkill.skill_id == skill_id)
            .order_by(Project.updated_at.desc())
        ).all()
        titles = [str(row[0]) for row in rows]
        return len(titles), titles

    def set_default(self, skill_id: str, enabled: bool) -> InstalledSkill:
        skill = self.repository.session.get(InstalledSkill, skill_id)
        if not skill:
            raise KeyError(f"Skill not installed: {skill_id}")
        skill.default_for_new_projects = enabled
        self.repository.session.commit()
        return skill

    def apply_defaults(self, project_id: str) -> None:
        statement = select(InstalledSkill).where(
            InstalledSkill.default_for_new_projects.is_(True)
        )
        for skill in self.repository.session.scalars(statement):
            self.enable(project_id, skill.id, self.declared_permissions(skill))

    def enable(
        self, project_id: str, skill_id: str, permissions: dict[str, object]
    ) -> ProjectSkill:
        self.repository.get_project(project_id)
        skill = self.repository.session.get(InstalledSkill, skill_id)
        if not skill:
            raise KeyError(f"Skill not installed: {skill_id}")
        declared = self.declared_permissions(skill)
        if permissions != declared:
            raise ValueError(
                "Granted permissions must exactly match the installed Skill manifest"
            )
        enabled = self.repository.session.get(ProjectSkill, (project_id, skill_id))
        if enabled:
            enabled.permissions = permissions
        else:
            enabled = ProjectSkill(
                project_id=project_id,
                skill_id=skill_id,
                permissions=permissions,
            )
            self.repository.session.add(enabled)
        self.repository.session.commit()
        return enabled

    def list_enabled(self, project_id: str) -> list[ProjectSkill]:
        self.repository.get_project(project_id)
        statement = select(ProjectSkill).where(ProjectSkill.project_id == project_id)
        return list(self.repository.session.scalars(statement))

    @staticmethod
    def declared_permissions(skill: InstalledSkill) -> dict[str, object]:
        front_matter = skill.manifest.get("front_matter", {})
        if not isinstance(front_matter, dict):
            raise ValueError("Installed Skill manifest is invalid")
        permissions = front_matter.get("permissions")
        if not isinstance(permissions, dict):
            raise ValueError("Installed Skill permissions are invalid")
        return {str(key): value for key, value in permissions.items()}

    def enabled_prompt_context(
        self, project_id: str, intent: str, selected_skill_ids: list[str] | None = None
    ) -> tuple[str, list[str]]:
        """Return bounded instructions from prompt/reference Skills enabled for this project."""
        sections: list[str] = []
        selected_ids: list[str] = []
        allowed_ids = set(selected_skill_ids or [])
        for enabled in self.list_enabled(project_id):
            if allowed_ids and enabled.skill_id not in allowed_ids:
                continue
            skill = self.repository.session.get(InstalledSkill, enabled.skill_id)
            if not skill:
                continue
            front_matter = skill.manifest.get("front_matter", {})
            if not isinstance(front_matter, dict):
                continue
            applies_to = front_matter.get("applies_to", ["all"])
            if isinstance(applies_to, str):
                applies_to = [applies_to]
            if not isinstance(applies_to, list):
                continue
            scopes = {str(item) for item in applies_to}
            if not ({"all", intent} & scopes):
                continue
            skill_file = Path(skill.path) / "SKILL.md"
            content = skill_file.read_text(encoding="utf-8")[:20_000]
            sections.append(f"## Enabled Skill: {skill.name} ({skill.id})\n\n{content}")
            selected_ids.append(skill.id)
            if sum(len(section) for section in sections) >= 60_000:
                break
        return "\n\n".join(sections), selected_ids

    def agent_skill_bundle(
        self, project_id: str, intent: str, selected_skill_ids: list[str] | None = None
    ) -> tuple[dict[str, FileData], list[str]]:
        """Build a bounded virtual /skills tree for Deep Agents progressive disclosure."""
        candidates: list[InstalledSkill] = []
        allowed_ids = set(selected_skill_ids or [])
        if allowed_ids:
            enabled_ids = {item.skill_id for item in self.list_enabled(project_id)}
            unknown = allowed_ids - enabled_ids
            if unknown:
                raise ValueError(f"Skills are not enabled in this project: {sorted(unknown)}")
        for enabled in self.list_enabled(project_id):
            if allowed_ids and enabled.skill_id not in allowed_ids:
                continue
            skill = self.repository.session.get(InstalledSkill, enabled.skill_id)
            if not skill:
                continue
            front_matter = skill.manifest.get("front_matter", {})
            if not isinstance(front_matter, dict):
                continue
            applies_to = front_matter.get("applies_to", ["all"])
            if isinstance(applies_to, str):
                applies_to = [applies_to]
            if not isinstance(applies_to, list):
                continue
            scopes = {str(item) for item in applies_to}
            if {"all", intent} & scopes:
                candidates.append(skill)
        if intent == "reporting" and not any(
            skill.name == "complete-analysis-report" for skill in candidates
        ):
            builtins = [
                skill
                for skill in self.list_installed()
                if skill.name == "complete-analysis-report"
            ]
            if builtins:
                candidates.append(max(builtins, key=lambda skill: (skill.created_at, skill.id)))

        files: dict[str, FileData] = {}
        selected_ids: list[str] = []
        emitted_names: set[str] = set()
        copied_bytes = 0
        for skill in candidates:
            if skill.id in selected_ids or skill.name in emitted_names:
                continue
            root = Path(skill.path).resolve()
            safe_name = skill.name
            added = False
            for path in sorted(item for item in root.rglob("*") if item.is_file()):
                resolved = path.resolve()
                resolved.relative_to(root)
                if resolved.suffix.lower() not in AGENT_SKILL_TEXT_SUFFIXES:
                    continue
                content = resolved.read_text(encoding="utf-8")
                size = len(content.encode("utf-8"))
                if copied_bytes + size > MAX_AGENT_SKILL_CONTEXT_BYTES:
                    break
                virtual_path = f"/skills/{safe_name}/{resolved.relative_to(root).as_posix()}"
                files[virtual_path] = create_file_data(content)
                copied_bytes += size
                added = True
            if added:
                selected_ids.append(skill.id)
                emitted_names.add(skill.name)
            if copied_bytes >= MAX_AGENT_SKILL_CONTEXT_BYTES:
                break
        return files, selected_ids

    def disable(self, project_id: str, skill_id: str) -> None:
        enabled = self.repository.session.get(ProjectSkill, (project_id, skill_id))
        if not enabled:
            raise KeyError(f"Skill not enabled in project: {skill_id}")
        self.repository.session.delete(enabled)
        self.repository.session.commit()

    def upgrade(
        self, project_id: str, skill_id: str, permissions: dict[str, object]
    ) -> ProjectSkill:
        target = self.repository.session.get(InstalledSkill, skill_id)
        if not target:
            raise KeyError(f"Skill not installed: {skill_id}")
        for enabled in self.list_enabled(project_id):
            installed = self.repository.session.get(InstalledSkill, enabled.skill_id)
            if installed and installed.name == target.name and installed.id != target.id:
                self.repository.session.delete(enabled)
        self.repository.session.commit()
        return self.enable(project_id, skill_id, permissions)

    def uninstall(self, skill_id: str) -> None:
        skill = self.repository.session.get(InstalledSkill, skill_id)
        if not skill:
            raise KeyError(f"Skill not installed: {skill_id}")
        usage = self.repository.session.scalars(
            select(ProjectSkill).where(ProjectSkill.skill_id == skill_id)
        ).first()
        if usage:
            raise ValueError("Disable this Skill in every project before uninstalling it")
        path = Path(skill.path)
        self.repository.session.delete(skill)
        self.repository.session.commit()
        if path.is_dir():
            shutil.rmtree(path)

    def run_script(
        self,
        project_id: str,
        skill_id: str,
        script: str,
        args: list[str],
    ) -> dict[str, object]:
        enabled = self.repository.session.get(ProjectSkill, (project_id, skill_id))
        if not enabled:
            raise KeyError(f"Skill not enabled in project: {skill_id}")
        skill = self.repository.session.get(InstalledSkill, skill_id)
        if not skill or not skill.has_scripts:
            raise ValueError("Skill does not contain executable scripts")
        relative = Path(script)
        if relative.is_absolute() or ".." in relative.parts or relative.suffix != ".py":
            raise ValueError("Skill script must be a relative Python file")
        source = (Path(skill.path) / "scripts" / relative).resolve()
        source.relative_to((Path(skill.path) / "scripts").resolve())
        if not source.is_file():
            raise FileNotFoundError(source)
        front_matter = skill.manifest.get("front_matter", {})
        entrypoints = front_matter.get("entrypoints", []) if isinstance(front_matter, dict) else []
        if str(relative) not in entrypoints:
            raise ValueError("Skill script is not a declared entrypoint")
        root = project_root(project_id)
        before_files = {str(path.relative_to(root)) for path in root.rglob("*") if path.is_file()}
        run_id = str(uuid4())
        run_dir = root / "skills" / "runs" / run_id
        run_dir.mkdir(parents=True)
        staged_script = run_dir / source.name
        shutil.copy2(source, staged_script)
        runner = Path(__file__).resolve().parents[2] / "scripts" / "run-sandbox.sh"
        command = [str(runner), str(root), str(staged_script.relative_to(root)), *args]
        status = "succeeded"
        try:
            completed = subprocess.run(
                command,
                check=False,
                capture_output=True,
                text=True,
                timeout=min(get_settings().training_timeout_seconds, 300),
            )
            status = "succeeded" if completed.returncode == 0 else "failed"
            stdout = completed.stdout[-50_000:]
            stderr = completed.stderr[-50_000:]
            return_code = completed.returncode
        except subprocess.TimeoutExpired as exc:
            status = "timed_out"
            stdout = str(exc.stdout or "")[-50_000:]
            stderr = str(exc.stderr or "")[-50_000:]
            return_code = 124
        output_paths = [
            path
            for path in sorted(root.rglob("*"))
            if path.is_file()
            and str(path.relative_to(root)) not in before_files
            and run_dir not in path.parents
            and root / "runs" not in path.parents
        ][:100]
        record = {
            "schema_version": 1,
            "run_id": run_id,
            "project_id": project_id,
            "skill_id": skill_id,
            "skill_hash": skill.content_hash,
            "script": str(relative),
            "args": args,
            "permissions": enabled.permissions,
            "declared_permissions": self.declared_permissions(skill),
            "sandbox": {"network": "none", "rootfs": "read_only", "user": 10001},
            "status": status,
            "return_code": return_code,
            "stdout": stdout,
            "stderr": stderr,
            "output_paths": [str(path.relative_to(root)) for path in output_paths],
        }
        record_path = root / "runs" / f"{run_id}-skill.json"
        record_path.write_text(
            json.dumps(record, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        artifact = self.repository.add_artifact(
            project_id,
            "skill_run",
            f"{skill.name} · {relative.name}",
            record_path,
            {key: value for key, value in record.items() if key not in {"stdout", "stderr"}},
            [],
        )
        record["artifact_id"] = artifact.id
        output_artifacts = [
            self.repository.add_artifact(
                project_id,
                "skill_output",
                f"{skill.name} · {path.name}",
                path,
                {"skill_id": skill_id, "run_id": run_id},
                [artifact.id],
            ).id
            for path in output_paths
        ]
        record["output_artifacts"] = output_artifacts
        return record
