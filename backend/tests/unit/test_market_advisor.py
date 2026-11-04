"""
The AI Market Co-Pilot, over the API.

These checks are about one thing above all: the answer must not carry
a price the server did not read from a quote. A co-pilot that invents
a number is worse than no co-pilot, because the reader cannot tell
the difference.

The live market is not used. A set of quotes is put in its place, so
the answers are the same on every run and on every machine.
"""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.routes import market_advisor
from app.services import market_ai_agent_service


# A small market, written the way the market summary writes it.
SAMPLE_MARKET = {
    "updated": "2026-01-01T00:00:00",
    "source": "Test",
    "indices": [
        {
            "symbol": "COMPOSITE",
            "name": "IHSG",
            "price": 7250.50,
            "change": 58.0,
            "change_percent": 0.81,
        }
    ],
    "idx_stocks": {
        "total": 1,
        "quotes": [
            {
                "symbol": "BBCA",
                "name": "Bank Central Asia",
                "price": 9500,
                "change": 100,
                "change_percent": 1.06,
                "currency": "IDR",
            }
        ],
    },
    "us_stocks": {
        "total": 1,
        "quotes": [
            {
                "symbol": "AAPL",
                "name": "Apple Inc.",
                "price": 230.5,
                "change": -1.5,
                "change_percent": -0.65,
                "currency": "USD",
            }
        ],
    },
    "crypto": {
        "total": 1,
        "quotes": [
            {
                "symbol": "BTC",
                "name": "Bitcoin",
                "price": 95000,
                "change": 1500,
                "change_percent_24h": 1.6,
                "currency": "USD",
            }
        ],
    },
    "forex": {"total": 0, "quotes": []},
    "commodities": {"total": 0, "quotes": []},
}

EMPTY_MARKET = {
    "updated": "2026-01-01T00:00:00",
    "source": "Test",
    "indices": [],
    "idx_stocks": {"total": 0, "quotes": []},
    "us_stocks": {"total": 0, "quotes": []},
    "crypto": {"total": 0, "quotes": []},
    "forex": {"total": 0, "quotes": []},
    "commodities": {"total": 0, "quotes": []},
}


class TheMarket:
    """
    The market the server sees.

    The quotes are put in place of the live ones, so every answer is
    the same on every run.
    """

    def __init__(self, payload):
        self.payload = payload

    def install(self, monkeypatch):
        market = self

        async def fake_snapshot(force: bool = False):
            return market.payload

        monkeypatch.setattr(
            market_ai_agent_service, "get_snapshot", fake_snapshot
        )


@pytest.fixture()
def market(monkeypatch):
    """The market the server sees during a test."""
    holder = TheMarket(SAMPLE_MARKET)
    holder.install(monkeypatch)

    # The language model is not part of these checks. The answers have
    # to be the same whether or not a key is configured.
    monkeypatch.setattr(
        market_ai_agent_service,
        "_model_symbols",
        lambda question, quotes: None,
    )
    return holder


@pytest.fixture()
def client():
    """The application, with the two routes mounted."""
    application = FastAPI()
    application.include_router(
        market_advisor.router, prefix="/api/market-advisor"
    )
    return TestClient(application)


def test_the_answer_has_the_shape_the_page_needs(client, market):
    """An answer comes back with the answer, the points and the source."""
    response = client.post(
        "/api/market-advisor/ask", json={"question": "Berapa harga BBCA?"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["answer"]
    assert isinstance(body["key_points"], list)
    assert isinstance(body["chart_points"], list)
    assert body["source"] in ("market_data", "language_model")


def test_a_price_in_the_answer_is_the_price_of_the_quote(client, market):
    """The answer reads the price out of the quote, it does not make one."""
    response = client.post(
        "/api/market-advisor/ask", json={"question": "Berapa harga BBCA?"}
    )
    assert response.status_code == 200
    body = response.json()
    assert "9.500" in body["answer"]
    point = body["chart_points"][0]
    assert point["symbol"] == "BBCA"
    assert point["value"] == 9500


def test_an_empty_question_is_refused(client, market):
    """A blank question is a bad request, not an empty answer."""
    response = client.post("/api/market-advisor/ask", json={"question": ""})
    assert response.status_code == 422

    response = client.post("/api/market-advisor/ask", json={"question": "   "})
    assert response.status_code == 422


def test_a_question_with_no_data_says_so(client, market):
    """No data means no price. The answer says there is none."""
    market.payload = EMPTY_MARKET
    response = client.post(
        "/api/market-advisor/ask", json={"question": "Berapa harga BBCA?"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["chart_points"] == []
    lowered = body["answer"].lower()
    assert "tidak ada" in lowered or "no market data" in lowered
    # The answer must not carry a number it did not read from a quote.
    assert "9500" not in body["answer"]
    assert "9.500" not in body["answer"]


def test_a_symbol_the_server_has_never_seen_is_honest(client, market):
    """A ticker the quote table does not have gets a plain refusal."""
    response = client.post(
        "/api/market-advisor/ask", json={"question": "Berapa harga ZZZZ?"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["chart_points"] == []
    assert "ZZZZ" in body["answer"]
    # No price for a symbol nobody has a price for.
    assert "Rp " not in body["answer"]
    assert "USD " not in body["answer"]


def test_the_chart_points_are_numbers(client, market):
    """Every number the chart draws is a number."""
    response = client.post(
        "/api/market-advisor/ask", json={"question": "Bagaimana pasar hari ini?"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["chart_points"], "the general question should carry numbers"
    for point in body["chart_points"]:
        assert isinstance(point["value"], (int, float))
        assert point["symbol"]
        if point.get("change") is not None:
            assert isinstance(point["change"], (int, float))


def test_the_source_is_always_one_of_the_two(client, market):
    """The source is what the page tells the reader about."""
    response = client.post(
        "/api/market-advisor/ask", json={"question": "Berapa harga BTC?"}
    )
    assert response.status_code == 200
    assert response.json()["source"] in ("market_data", "language_model")


def test_the_context_endpoint_lists_what_the_server_has(client, market):
    """The page asks this to offer sensible example questions."""
    response = client.get("/api/market-advisor/context")
    assert response.status_code == 200
    body = response.json()
    assert body["has_market_data"] is True
    assert body["count"] > 0
    assert body["example_questions"]
    symbols = [s["symbol"] for s in body["symbols"]]
    assert "BBCA" in symbols


def test_the_context_endpoint_says_when_there_is_nothing(client, market):
    """With no quotes, the page is told there is nothing to ask about."""
    market.payload = EMPTY_MARKET
    response = client.get("/api/market-advisor/context")
    assert response.status_code == 200
    body = response.json()
    assert body["has_market_data"] is False
    assert body["count"] == 0
