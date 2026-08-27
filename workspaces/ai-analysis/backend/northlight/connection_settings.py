from __future__ import annotations

import json
import os
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Any

import httpx
from sqlalchemy.engine import make_url

from northlight.settings import get_settings


def credential_path() -> Path:
    return get_settings().runtime_root / "settings" / "connections.json"


def _read_credentials() -> dict[str, Any]:
    path = credential_path()
    if not path.is_file():
        return {}
    if path.stat().st_mode & 0o077:
        raise PermissionError("Runtime credential file must have mode 600")
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError("Runtime credential file must contain an object")
    return payload


def _write_credentials(payload: dict[str, Any]) -> None:
    path = credential_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    with NamedTemporaryFile(
        mode="w",
        encoding="utf-8",
        dir=path.parent,
        prefix=".connections-",
        suffix=".tmp",
        delete=False,
    ) as handle:
        temporary = Path(handle.name)
        os.chmod(temporary, 0o600)
        handle.write(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
        handle.flush()
        os.fsync(handle.fileno())
    temporary.replace(path)
    os.chmod(path, 0o600)


def load_runtime_credentials() -> None:
    payload = _read_credentials()
    model = payload.get("model", {})
    if isinstance(model, dict):
        api_key = model.get("api_key")
        model_name = model.get("model_name")
        base_url = model.get("base_url")
        if isinstance(api_key, str) and api_key:
            os.environ["DEEPSEEK_API_KEY"] = api_key
        if isinstance(model_name, str) and model_name:
            os.environ["NORTHLIGHT_MODEL_NAME"] = model_name
        if isinstance(base_url, str) and base_url:
            os.environ["NORTHLIGHT_MODEL_BASE_URL"] = base_url
    mysql = payload.get("mysql", {})
    if isinstance(mysql, dict):
        for alias, url in mysql.items():
            if isinstance(alias, str) and isinstance(url, str) and alias.startswith("NORTHLIGHT_"):
                os.environ[alias] = url
    get_settings.cache_clear()


def save_model_connection(api_key: str, model_name: str, base_url: str) -> None:
    payload = _read_credentials()
    payload["model"] = {
        "api_key": api_key,
        "model_name": model_name.strip(),
        "base_url": base_url.rstrip("/"),
    }
    _write_credentials(payload)
    os.environ["DEEPSEEK_API_KEY"] = api_key
    os.environ["NORTHLIGHT_MODEL_NAME"] = model_name.strip()
    os.environ["NORTHLIGHT_MODEL_BASE_URL"] = base_url.rstrip("/")
    get_settings.cache_clear()


def save_mysql_connection(alias: str, url: str) -> None:
    payload = _read_credentials()
    mysql = payload.setdefault("mysql", {})
    if not isinstance(mysql, dict):
        mysql = {}
        payload["mysql"] = mysql
    mysql[alias] = url
    _write_credentials(payload)
    os.environ[alias] = url


def delete_mysql_connection(alias: str) -> None:
    payload = _read_credentials()
    mysql = payload.get("mysql", {})
    if isinstance(mysql, dict) and alias in mysql:
        del mysql[alias]
        _write_credentials(payload)
    os.environ.pop(alias, None)


def restore_mysql_connection(alias: str) -> str | None:
    current = os.getenv(alias)
    if current:
        return current
    payload = _read_credentials()
    mysql = payload.get("mysql", {})
    value = mysql.get(alias) if isinstance(mysql, dict) else None
    if isinstance(value, str) and value:
        os.environ[alias] = value
        return value
    return None


def test_model_connection(api_key: str, model_name: str, base_url: str) -> str:
    endpoint = f"{base_url.rstrip('/')}/chat/completions"
    with httpx.Client(timeout=20.0) as client:
        response = client.post(
            endpoint,
            headers={"Authorization": f"Bearer {api_key}"},
            json={
                "model": model_name,
                "messages": [{"role": "user", "content": "Reply with OK."}],
                "max_tokens": 4,
                "temperature": 0,
            },
        )
        response.raise_for_status()
        payload = response.json()
    choices = payload.get("choices") if isinstance(payload, dict) else None
    if not isinstance(choices, list) or not choices:
        raise RuntimeError("Model endpoint returned no completion choices")
    return "模型连接与最小响应测试通过"


def restore_legacy_local_mysql_aliases(records: list[object]) -> int:
    """Bind legacy local records only when their recorded database matches the fallback URL."""
    fallback = os.getenv("NORTHLIGHT_MYSQL_URL")
    if not fallback:
        return 0
    database = make_url(fallback).database
    restored = 0
    for record in records:
        config = getattr(record, "config", {})
        baseline = getattr(record, "baseline", {})
        if not isinstance(config, dict) or not isinstance(baseline, dict):
            continue
        alias = config.get("connection_env")
        if (
            isinstance(alias, str)
            and alias
            and baseline.get("database") == database
            and not restore_mysql_connection(alias)
        ):
            save_mysql_connection(alias, fallback)
            restored += 1
    return restored
