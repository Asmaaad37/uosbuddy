import time

import pytest
from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.main import app
from app.security import sign

SECRET = "test-secret"
BODY = b'{"hello":"world"}'


@pytest.fixture
def client():
    app.dependency_overrides[get_settings] = lambda: Settings(ai_service_hmac_secret=SECRET)
    yield TestClient(app)
    app.dependency_overrides.clear()


def signed(timestamp: int, secret: str = SECRET) -> dict[str, str]:
    ts = str(timestamp)
    return {"X-UOSB-Timestamp": ts, "X-UOSB-Signature": sign(secret, ts, BODY)}


def test_health_is_public(client):
    assert client.get("/health").json() == {"status": "ok"}


def test_valid_signature_is_accepted(client):
    res = client.post("/internal/ping", content=BODY, headers=signed(int(time.time())))
    assert res.status_code == 200


@pytest.mark.parametrize(
    "headers",
    [
        {},
        {"X-UOSB-Timestamp": "abc", "X-UOSB-Signature": "00"},
    ],
)
def test_missing_or_malformed_signature_is_rejected(client, headers):
    assert client.post("/internal/ping", content=BODY, headers=headers).status_code == 401


def test_wrong_secret_is_rejected(client):
    headers = signed(int(time.time()), secret="other")
    assert client.post("/internal/ping", content=BODY, headers=headers).status_code == 401


def test_stale_timestamp_is_rejected(client):
    headers = signed(int(time.time()) - 600)
    assert client.post("/internal/ping", content=BODY, headers=headers).status_code == 401


def test_tampered_body_is_rejected(client):
    headers = signed(int(time.time()))
    res = client.post("/internal/ping", content=b'{"hello":"mars"}', headers=headers)
    assert res.status_code == 401


def test_internal_routes_fail_closed_without_secret():
    app.dependency_overrides[get_settings] = lambda: Settings(ai_service_hmac_secret=None)
    try:
        res = TestClient(app).post("/internal/ping", content=BODY, headers=signed(int(time.time())))
        assert res.status_code == 503
    finally:
        app.dependency_overrides.clear()
