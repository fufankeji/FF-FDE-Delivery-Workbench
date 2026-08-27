import json
import os
from pathlib import Path

from northlight.connection_settings import credential_path, save_model_connection
from northlight.settings import Settings, get_settings


def test_default_runtime_is_project_relative(monkeypatch) -> None:
    monkeypatch.delenv("NORTHLIGHT_RUNTIME_ROOT", raising=False)
    settings = Settings(_env_file=None)
    assert settings.runtime_root == Path(".runtime")
    assert not settings.runtime_root.is_absolute()
    assert settings.projects_root == Path(".runtime/projects")


def test_safety_limits_are_bounded() -> None:
    settings = Settings(_env_file=None)
    assert settings.preview_row_limit < settings.query_row_limit
    assert settings.query_row_limit <= 5_000
    assert settings.query_timeout_seconds <= 60


def test_runtime_model_credential_is_protected_and_not_part_of_status_contract(
    tmp_path: Path, monkeypatch
) -> None:
    monkeypatch.setenv("NORTHLIGHT_RUNTIME_ROOT", str(tmp_path / "runtime"))
    monkeypatch.setenv("DEEPSEEK_API_KEY", "pre-test-placeholder")
    monkeypatch.setenv("NORTHLIGHT_MODEL_NAME", "pre-test-model")
    monkeypatch.setenv("NORTHLIGHT_MODEL_BASE_URL", "https://pre-test.invalid")
    get_settings.cache_clear()
    try:
        save_model_connection("test-secret-value", "test-model", "https://example.test")
        path = credential_path()
        assert path.stat().st_mode & 0o077 == 0
        payload = json.loads(path.read_text(encoding="utf-8"))
        assert payload["model"]["api_key"] == "test-secret-value"
        public_status = {
            "configured": bool(os.getenv("DEEPSEEK_API_KEY")),
            "model_name": get_settings().model_name,
            "base_url": get_settings().model_base_url,
        }
        assert "api_key" not in public_status
    finally:
        get_settings.cache_clear()
