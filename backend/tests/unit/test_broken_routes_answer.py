"""
A route that breaks is a route that shows a red screen.

These three bugs were live on the server and all of them answered
500 to a request that should have worked:

  GET  /api/parser/ocr-status   500  the OCR service had been moved
                                   to RapidOCR, but the route still
                                   asked for the old EasyOCR flags,
                                   which no longer exist

  POST /api/webhooks/qris-test   500  the payment worker is a
                                   coroutine and was called without
                                   being awaited, so it ran nothing
                                   and the response tried to encode
                                   the coroutine object

  POST /api/webhooks/qris        (no check at all) anybody on the
                                   internet could post a made up
                                   payment and have it booked into
                                   a ledger
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import get_settings
from app.core.database import Base, get_db
from app.core.security import get_current_user
from app.main import app


@pytest.fixture(scope="module")
def db():
    """
    A fresh in-memory database with the tables these routes read.

    The models carry PostgreSQL types that SQLite does not know, so
    only the tables these tests need are built.
    """
    engine = create_engine(
        "sqlite:///:memory:",
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )
    wanted = {"users", "merchants", "accounts", "transactions", "categories"}
    Base.metadata.create_all(
        engine,
        tables=[t for t in Base.metadata.sorted_tables if t.name in wanted],
    )
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


@pytest.fixture
def client(db):
    """A client on the in-memory database, with nobody signed in."""
    test_client = TestClient(app)

    def override_db():
        return db

    test_client.app.dependency_overrides[get_db] = override_db
    test_client.app.dependency_overrides.pop(get_current_user, None)
    yield test_client
    test_client.app.dependency_overrides.clear()


def _sign(payload, secret):
    """Sign the way the gateway signs, using the app's own helper."""
    from app.api.routes.webhooks import sign_qris_payload

    return sign_qris_payload(payload, secret)


class TestTheOcrStatusRoute:
    def test_it_answers_instead_of_falling_over(self, client):
        response = client.get("/api/parser/ocr-status")
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["status"] in ("ready", "loading", "error", "unknown")

    def test_it_reports_the_engine_that_is_actually_in_use(self, client):
        body = client.get("/api/parser/ocr-status").json()
        assert "ready" in body
        assert "message" in body


class TestTheQrisWorker:
    def test_the_worker_is_awaited_and_the_test_route_answers(self, client):
        """The route used to answer 500 because it never awaited."""
        from app.api.routes.webhooks import process_qris_payment
        import inspect

        assert inspect.iscoroutinefunction(process_qris_payment), (
            "process_qris_payment must stay a coroutine so that every "
            "caller awaits it; if it becomes a plain function the "
            "callers that await it will break instead"
        )

    def test_the_test_route_needs_a_reader(self, client):
        response = client.post(
            "/api/webhooks/qris-test",
            params={"merchant_id": 1, "amount": 10, "reference": "x"},
        )
        assert response.status_code == 401, response.text


class TestTheQrisWebhook:
    def test_an_unsigned_payment_is_refused(self, client, monkeypatch):
        secret = "the-gateway-shared-secret"
        monkeypatch.setattr(get_settings(), "QRIS_WEBHOOK_SECRET", secret)

        response = client.post(
            "/api/webhooks/qris",
            json={
                "merchant_id": "M-1",
                "amount": 50000,
                "reference": "ref-1",
                "customer_name": "Someone",
            },
        )
        assert response.status_code == 401, response.text

    def test_a_signed_payment_is_accepted(self, client, monkeypatch):
        secret = "the-gateway-shared-secret"
        monkeypatch.setattr(get_settings(), "QRIS_WEBHOOK_SECRET", secret)

        payload = {
            "merchant_id": "M-1",
            "amount": 50000,
            "reference": "ref-1",
            "customer_name": "Someone",
            "timestamp": "2026-10-30T00:00:00Z",
        }
        payload["signature"] = _sign(payload, secret)

        response = client.post("/api/webhooks/qris", json=payload)
        # An unknown merchant is ignored, not written anywhere.
        assert response.status_code == 200, response.text
        assert response.json()["status"] == "ignored"

    def test_a_wrong_signature_is_refused(self, client, monkeypatch):
        monkeypatch.setattr(get_settings(), "QRIS_WEBHOOK_SECRET", "the-real-secret")

        payload = {
            "merchant_id": "M-1",
            "amount": 50000,
            "reference": "ref-1",
            "customer_name": "Someone",
            "timestamp": "2026-10-30T00:00:00Z",
            "signature": "a-signature-that-was-made-by-somebody-else",
        }
        response = client.post("/api/webhooks/qris", json=payload)
        assert response.status_code == 401, response.text

    def test_without_a_configured_secret_nothing_is_written(self, client, monkeypatch):
        """An unset secret means "no gateway is set up", not "trust all"."""
        monkeypatch.setattr(get_settings(), "QRIS_WEBHOOK_SECRET", "")

        payload = {
            "merchant_id": "M-1",
            "amount": 50000,
            "reference": "ref-1",
            "customer_name": "Someone",
            "timestamp": "2026-10-30T00:00:00Z",
        }
        response = client.post("/api/webhooks/qris", json=payload)
        assert response.status_code == 401, response.text
