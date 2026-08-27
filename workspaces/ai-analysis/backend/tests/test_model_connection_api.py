from fastapi.testclient import TestClient
from northlight.main import app
from northlight.settings import get_settings


def test_model_connection_writes_reject_cross_host_browser_origin(monkeypatch) -> None:
    monkeypatch.setenv("DEEPSEEK_API_KEY", "protected-existing-key")
    monkeypatch.setenv("NORTHLIGHT_MODEL_NAME", "deepseek-v4-flash")
    monkeypatch.setenv("NORTHLIGHT_MODEL_BASE_URL", "https://api.deepseek.com")
    get_settings.cache_clear()
    with TestClient(app) as client:
        response = client.put(
            "/api/system/model-connection",
            headers={"Origin": "http://192.168.3.50:7777"},
            json={
                "model_name": "deepseek-v4-flash",
                "base_url": "http://192.168.3.50:9999",
            },
        )
    assert response.status_code == 403
    assert "当前 DS4 主机" in response.json()["detail"]


def test_model_connection_accepts_matching_trusted_proxy_host(monkeypatch) -> None:
    monkeypatch.setenv("DEEPSEEK_API_KEY", "protected-existing-key")
    monkeypatch.setenv("NORTHLIGHT_MODEL_NAME", "deepseek-v4-flash")
    monkeypatch.setenv("NORTHLIGHT_MODEL_BASE_URL", "https://api.deepseek.com")
    get_settings.cache_clear()
    monkeypatch.setattr("northlight.api.test_model_connection", lambda *_: "通过")
    with TestClient(app) as client:
        response = client.post(
            "/api/system/model-connection/test",
            headers={
                "Origin": "http://192.168.3.129:5173",
                "X-Forwarded-Host": "192.168.3.129:5173",
            },
            json={
                "model_name": "deepseek-v4-flash",
                "base_url": "https://api.deepseek.com",
            },
        )
    assert response.status_code == 200


def test_model_connection_change_requires_new_key_and_never_echoes_it(monkeypatch) -> None:
    monkeypatch.setenv("DEEPSEEK_API_KEY", "protected-existing-key")
    monkeypatch.setenv("NORTHLIGHT_MODEL_NAME", "deepseek-v4-flash")
    monkeypatch.setenv("NORTHLIGHT_MODEL_BASE_URL", "https://api.deepseek.com")
    get_settings.cache_clear()
    tested: list[tuple[str, str, str]] = []
    saved: list[tuple[str, str, str]] = []
    monkeypatch.setattr(
        "northlight.api.test_model_connection",
        lambda key, model, base: tested.append((key, model, base)) or "通过",
    )
    monkeypatch.setattr(
        "northlight.api.save_model_connection",
        lambda key, model, base: saved.append((key, model, base)),
    )
    with TestClient(app) as client:
        missing = client.put(
            "/api/system/model-connection",
            headers={"Origin": "http://testserver:5173"},
            json={"model_name": "next-model", "base_url": "https://next.example.test"},
        )
        accepted = client.put(
            "/api/system/model-connection",
            headers={"Origin": "http://testserver:5173"},
            json={
                "api_key": "new-user-key",
                "model_name": "next-model",
                "base_url": "https://next.example.test",
            },
        )

    assert missing.status_code == 400
    assert "必须重新输入 API Key" in missing.json()["detail"]
    assert accepted.status_code == 200
    assert tested == [("new-user-key", "next-model", "https://next.example.test")]
    assert saved == [("new-user-key", "next-model", "https://next.example.test")]
    assert "api_key" not in accepted.json()
