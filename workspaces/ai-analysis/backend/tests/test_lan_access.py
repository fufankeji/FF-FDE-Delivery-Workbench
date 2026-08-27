from fastapi.testclient import TestClient
from northlight.main import app


def test_private_lan_origin_is_allowed() -> None:
    with TestClient(app) as client:
        response = client.options(
            "/api/health",
            headers={
                "Origin": "http://192.168.1.42:5173",
                "Access-Control-Request-Method": "GET",
            },
        )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://192.168.1.42:5173"


def test_public_origin_is_not_whitelisted() -> None:
    with TestClient(app) as client:
        response = client.options(
            "/api/health",
            headers={
                "Origin": "https://example.com",
                "Access-Control-Request-Method": "GET",
            },
        )
    assert "access-control-allow-origin" not in response.headers
