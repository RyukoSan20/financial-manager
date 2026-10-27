"""
The Indonesian calculators, over the API.

These are the checks that the endpoints are wired up and that they
answer with the numbers the rules give. The working out itself is
checked in `test_indonesia_calculations.py`.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="module")
def client():
    return TestClient(app)


def test_pph21_endpoint(client):
    """The monthly income tax, for the worked example."""
    response = client.post(
        "/api/calculators/id/pph21",
        json={"monthly_gross": 10000000, "status": "K/0"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["category"] == "A"
    assert body["tax"] == 200000
    assert body["net_income"] == 9800000


def test_pph21_annual_endpoint(client):
    """The tax for the year, and the tax for the last month."""
    response = client.post(
        "/api/calculators/id/pph21/annual",
        json={"monthly_gross": 10000000, "status": "K/0", "employee_pension": 100000},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["annual_tax"] == 2715000
    assert body["december_tax"] == 515000


def test_pph21_daily_endpoint(client):
    response = client.post(
        "/api/calculators/id/pph21/daily",
        json={"daily_gross": 1000000},
    )
    assert response.status_code == 200
    assert response.json()["tax"] == 5000


def test_pph21_rejects_an_unknown_status(client):
    """A status the tables do not cover comes back as a bad request."""
    response = client.post(
        "/api/calculators/id/pph21",
        json={"monthly_gross": 10000000, "status": "X/9"},
    )
    assert response.status_code == 400


def test_ppn_endpoint(client):
    """Ordinary goods pay 11% of the price; luxury goods pay 12%."""
    response = client.post("/api/calculators/id/ppn", json={"price": 100000})
    assert response.status_code == 200
    assert response.json()["tax"] == 11000

    response = client.post(
        "/api/calculators/id/ppn", json={"price": 100000, "luxury": True}
    )
    assert response.status_code == 200
    assert response.json()["tax"] == 12000


def test_thr_endpoint(client):
    response = client.post(
        "/api/calculators/id/thr",
        json={"monthly_salary": 5000000, "service_months": 6},
    )
    assert response.status_code == 200
    assert response.json()["thr"] == 2500000


def test_bpjs_endpoint(client):
    response = client.post(
        "/api/calculators/id/bpjs",
        json={"monthly_wage": 6000000, "risk": "low"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["worker"]["total"] == 240000
    assert body["employer"]["total"] == 614400


def test_bpjs_rejects_an_unknown_risk(client):
    response = client.post(
        "/api/calculators/id/bpjs",
        json={"monthly_wage": 6000000, "risk": "extreme"},
    )
    assert response.status_code == 400


def test_rules_endpoint(client):
    """The rules are published, so a screen can show them."""
    response = client.get("/api/calculators/id/rules")
    assert response.status_code == 200
    body = response.json()
    assert "K/0" in body["pph21"]["statuses"]
    assert body["pph21"]["categories"]["K/0"] == "A"


def test_the_old_calculators_still_answer(client):
    """
    The calculators that were already there are untouched.
    """
    response = client.post(
        "/api/calculators/discount",
        json={"original_price": 100000, "discount_percent": 10},
    )
    assert response.status_code == 200
    assert response.json()["final_price"] == 90000
