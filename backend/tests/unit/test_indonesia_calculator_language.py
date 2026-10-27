"""
The Indonesian calculators say it in the reader's language.

Two things used to reach the screen in one language only:

- the way the holiday allowance was worked out, which the server
  wrote as an English sentence;
- the message for a failure, which was the server's English sentence.

The server now sends a code as well as the sentence, and the screen
puts the code into the language the reader picked. These are the
checks that keep that true.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="module")
def client():
    return TestClient(app)


def test_thr_sends_a_code_for_the_way_it_was_worked_out(client):
    """
    A full year of service gets a code the screen can translate.
    """
    response = client.post(
        "/api/calculators/id/thr",
        json={"monthly_salary": 5000000, "service_months": 12},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["method_code"] == "full"
    # The sentence is still there, for a log or a developer.
    assert body["method"] == "one month of wages"


def test_thr_sends_a_code_for_a_part_year(client):
    response = client.post(
        "/api/calculators/id/thr",
        json={"monthly_salary": 5000000, "service_months": 6},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["method_code"] == "proportional"
    assert body["service_months"] == 6


def test_thr_sends_a_code_when_it_is_not_owed(client):
    response = client.post(
        "/api/calculators/id/thr",
        json={"monthly_salary": 5000000, "service_months": 0},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["eligible"] is False
    assert body["method_code"] == "not_eligible"


def test_an_unknown_status_comes_back_as_a_code(client):
    """
    The failure carries a code, so the screen can say it in the
    reader's language, and a sentence, so nothing is lost.
    """
    response = client.post(
        "/api/calculators/id/pph21",
        json={"monthly_gross": 10000000, "status": "X/9"},
    )
    assert response.status_code == 400
    detail = response.json()["detail"]
    assert detail["code"] == "unknown_status"
    assert "X/9" in detail["message"]


def test_an_unknown_risk_comes_back_as_a_code(client):
    response = client.post(
        "/api/calculators/id/bpjs",
        json={"monthly_wage": 6000000, "risk": "extreme"},
    )
    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "unknown_risk"

