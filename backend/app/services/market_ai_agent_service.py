"""
The Market Co-Pilot: answers questions about the market from the data
the server already has.

The rule of this service is simple, and it is the whole point of it:
the answer never carries a number the server did not read from a
quote. When there is no quote for what was asked about, the answer says
so, in plain words, and the chart carries nothing. A made-up price is
worse than no price, because the reader cannot tell the difference.

The service works without a language model. The quotes come from the
same market routes the Market page already uses, so the answer is
about the same numbers the reader is looking at. When a Gemini key is
configured, the model is used to work out WHICH of the available
symbols the question is about, and the wording of the answer is still
built from the templates here, so every word on the screen comes from
the translation files and every number comes from a quote.

The model is optional in every direction: a missing key, a rate limit
or a broken answer makes the service fall back to reading the question
itself. It never raises, and it never breaks the page.
"""

import asyncio
import logging
import re
import threading
import time
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# Where an answer came from. The frontend shows this to the reader, so
# the words have to be honest: "market_data" means the answer was read
# out of the quotes, "language_model" means the model worked out what
# was being asked about before the quotes were read.
SOURCE_MARKET_DATA = "market_data"
SOURCE_LANGUAGE_MODEL = "language_model"
ALLOWED_SOURCES = (SOURCE_MARKET_DATA, SOURCE_LANGUAGE_MODEL)

# How long a snapshot of the market is reused before it is fetched
# again. The page itself refreshes every thirty seconds; the
# co-pilot does not need to be faster than that.
SNAPSHOT_TTL_SECONDS = 60

# The words that look like a ticker but are not one. Without this
# list, a question about "the IDX" would be treated as a question
# about a company called IDX and answered with "no data".
TICKER_STOPWORDS = {
    "IDX", "US", "USA", "UK", "API", "AI", "PDF", "FAQ", "ETF", "IPO",
    "DCA", "RSI", "MACD", "ATH", "ATL", "TV", "SEO", "FOMO", "YOY",
    "QOQ", "P2P", "B2B", "24H", "7D", "30D", "1Y", "5Y", "10Y",
}

# A word that could be a ticker: two to six capital letters.
_TICKER_RE = re.compile(r"\b[A-Z]{2,6}\b")

# The currency codes that stand for a pair in the forex table.
_CURRENCY_CODES = {"USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "SGD"}


# ---------------------------------------------------------------------------
# Formatting
# ---------------------------------------------------------------------------

def _grouped(value: float, decimals: int = 2) -> str:
    """A number written the way an Indonesian reader writes it."""
    text = f"{abs(value):,.{decimals}f}"
    text = text.replace(",", "\x00").replace(".", ",").replace("\x00", ".")
    if value < 0:
        text = "-" + text
    return text


def format_price(value: Any, currency: Optional[str] = None) -> str:
    """A price with its currency sign in front of it."""
    number = _as_number(value)
    if number is None:
        return "-"
    code = (currency or "USD").upper()
    if code == "IDR":
        return f"Rp {_grouped(number, 0)}"
    if code in ("USD", "EUR", "GBP", "JPY"):
        return f"{code} {_grouped(number, 2)}"
    return f"{code} {_grouped(number, 2)}"


def format_change(value: Any) -> str:
    """A change in percent, with a sign."""
    number = _as_number(value)
    if number is None:
        return "-"
    return f"{number:+.2f}%"


def _as_number(value: Any) -> Optional[float]:
    try:
        if value is None or isinstance(value, bool):
            return None
        number = float(value)
    except (TypeError, ValueError):
        return None
    if number != number or number in (float("inf"), float("-inf")):
        return None
    return number


# ---------------------------------------------------------------------------
# The quotes the server has
# ---------------------------------------------------------------------------

def _quote(row: Dict[str, Any], kind: str, fallback_currency: Optional[str]) -> Optional[Dict[str, Any]]:
    """One quote, in the shape the co-pilot works with."""
    if not isinstance(row, dict):
        return None
    price = _as_number(row.get("price"))
    if price is None:
        return None
    change = row.get("change_percent")
    if change is None:
        change = row.get("change_percent_24h")
    if change is None:
        change = row.get("change_24h_percent")
    symbol = row.get("symbol") or row.get("pair") or row.get("ticker")
    if not symbol:
        return None
    name = row.get("name") or row.get("description") or str(symbol)
    currency = row.get("currency") or fallback_currency
    return {
        "symbol": str(symbol),
        "name": str(name),
        "kind": kind,
        "price": price,
        "change": _as_number(change),
        "currency": currency,
    }


def flatten_market(payload: Any) -> List[Dict[str, Any]]:
    """
    Every quote the server has, in one list.

    The market summary is written in sections. The co-pilot does not
    care about the sections, so the sections are flattened here and
    the rest of the service works on one list.
    """
    quotes: List[Dict[str, Any]] = []
    if not isinstance(payload, dict):
        return quotes

    for index in payload.get("indices") or []:
        quote = _quote(index, "index", None)
        if quote:
            quotes.append(quote)

    sections = (
        ("idx_stocks", "stock", "IDR"),
        ("us_stocks", "stock", "USD"),
        ("crypto", "crypto", "USD"),
        ("forex", "forex", None),
        ("commodities", "commodity", "USD"),
    )
    for key, kind, currency in sections:
        block = payload.get(key)
        rows = block.get("quotes") if isinstance(block, dict) else block
        if not isinstance(rows, list):
            continue
        for row in rows:
            quote = _quote(row, kind, currency)
            if quote:
                quotes.append(quote)

    return quotes


# ---------------------------------------------------------------------------
# The snapshot
# ---------------------------------------------------------------------------

_snapshot_lock = threading.Lock()
_snapshot: Dict[str, Any] = {"at": 0.0, "payload": None, "error": ""}


async def fetch_market_payload() -> Dict[str, Any]:
    """
    The market summary, from the same route the page uses.

    A failure here is not fatal: the co-pilot answers with whatever
    it has, and says so when it has nothing.
    """
    from app.api.routes.unified_market import get_market_summary

    try:
        payload = await get_market_summary()
    except Exception as exc:  # noqa: BLE001 - the network must not break the page
        logger.info("The market summary could not be read: %s", exc)
        return {}
    return payload if isinstance(payload, dict) else {}


async def get_snapshot(force: bool = False) -> Dict[str, Any]:
    """The market summary, reused for a short while."""
    now = time.time()
    with _snapshot_lock:
        fresh = (
            not force
            and _snapshot["payload"] is not None
            and now - _snapshot["at"] < SNAPSHOT_TTL_SECONDS
        )
        if fresh:
            return _snapshot["payload"]

    payload = await fetch_market_payload()

    with _snapshot_lock:
        _snapshot["at"] = time.time()
        _snapshot["payload"] = payload
    return payload if isinstance(payload, dict) else {}


# ---------------------------------------------------------------------------
# Reading the question
# ---------------------------------------------------------------------------

def _question_tokens(question: str) -> List[str]:
    """
    The names in the question that could be a ticker.

    Only the words the reader wrote in capitals count. A question is
    written in capitals when the reader is naming a ticker, and the
    ordinary words of a question are not written that way. Reading
    every word as capitals would turn "pasar hari ini" into a
    question about a company called PASAR.
    """
    tokens: List[str] = []
    for raw in re.findall(r"\b[A-Z]{2,6}\b", question or ""):
        if raw in TICKER_STOPWORDS:
            continue
        if raw not in tokens:
            tokens.append(raw)
    # A pair such as USD/IDR is one name joined by a slash.
    for pair in re.findall(r"\b[A-Z]{3}/[A-Z]{3}\b", question or ""):
        if pair not in tokens:
            tokens.append(pair)
    return tokens


def match_quotes(
    question: str,
    quotes: List[Dict[str, Any]],
    symbols: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    """The quotes the question is about."""
    wanted = [s.strip().upper() for s in (symbols or []) if s and s.strip()]
    tokens = _question_tokens(question) + wanted
    if not tokens:
        return []

    lowered = (question or "").lower()
    matched: List[Dict[str, Any]] = []
    seen = set()

    for quote in quotes:
        symbol = str(quote.get("symbol", "")).upper()
        name = str(quote.get("name", "")).upper()
        hit = False

        for token in tokens:
            if not token:
                continue
            if token == symbol or token == name:
                hit = True
                break
            if symbol.startswith(token) and token in _CURRENCY_CODES:
                hit = True
                break
            if token and len(token) >= 4 and token in name:
                hit = True
                break
            if "/" in token and (token in symbol or token in name):
                hit = True
                break
        if not hit and name and len(name) >= 4 and name.lower() in lowered:
            hit = True
        if not hit and symbol:
            # A ticker written in small letters is still the ticker.
            if re.search(rf"\b{re.escape(symbol.lower())}\b", lowered):
                hit = True

        if hit and symbol not in seen:
            seen.add(symbol)
            matched.append(quote)

    return matched


def _unknown_symbols(
    question: str,
    quotes: List[Dict[str, Any]],
    symbols: Optional[List[str]] = None,
) -> List[str]:
    """
    The names in the question that the quote table does not have.

    These are the ones the answer has to be honest about: the reader
    asked about something the server has never seen.
    """
    known = {str(q.get("symbol", "")).upper() for q in quotes}
    known |= {str(q.get("name", "")).upper() for q in quotes}
    unknown: List[str] = []
    for token in _question_tokens(question) + [
        s.strip().upper() for s in (symbols or []) if s and s.strip()
    ]:
        if not token or token in known:
            continue
        if token in _CURRENCY_CODES and any(
            k.startswith(token) for k in known
        ):
            continue
        if token not in unknown:
            unknown.append(token)
    return unknown


# ---------------------------------------------------------------------------
# The answer
# ---------------------------------------------------------------------------

_ANSWER_WORDS = {
    "no_data": {
        "id": "Server ini tidak punya data pasar untuk pertanyaan itu, jadi tidak ada harga yang bisa saya tampilkan.",
        "en": "This server has no market data for that question, so there is no price I can show.",
        "ja": "この質問に対する市場データがないため、価格は表示できません。",
    },
    "no_data_symbol": {
        "id": "Data pasar untuk {symbol} tidak ada di server ini, jadi tidak ada harga yang bisa saya tampilkan.",
        "en": "There is no market data for {symbol} on this server, so there is no price I can show.",
        "ja": "このサーバーには {symbol} の市場データがないため、価格は表示できません。",
    },
    "symbol_found": {
        "id": "{symbol} berada di {price} dan bergerak {change} pada data terakhir yang tersimpan.",
        "en": "{symbol} is at {price} and moved {change} on the last data this server holds.",
        "ja": "{symbol} は {price} で、直近のデータでは {change} 動きました。",
    },
    "symbols_found": {
        "id": "Berikut data {count} aset yang ada di server ini: {summary}.",
        "en": "Here is the data for the {count} assets this server holds: {summary}.",
        "ja": "このサーバーが持つ {count} 件の資産データです: {summary}。",
    },
    "overview": {
        "id": "Server ini punya {count} kuotasi pasar. Berikut yang paling bergerak, berdasarkan data terakhir yang tersimpan.",
        "en": "This server holds {count} market quotes. Here are the ones that moved most, on the last data it holds.",
        "ja": "このサーバーには {count} 件の市場データがあります。直近データで最も動いたものです。",
    },
}


def _word(key: str, language: str, values: Optional[Dict[str, Any]] = None) -> str:
    """A sentence in the language of the reader."""
    table = _ANSWER_WORDS.get(key, {})
    text = table.get(language) or table.get("en") or ""
    if not values:
        return text
    for name, value in values.items():
        text = text.replace("{" + name + "}", str(value))
    return text


def _chart_point(quote: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "symbol": str(quote.get("symbol", "")),
        "name": str(quote.get("name", "")),
        "value": _as_number(quote.get("price")) or 0.0,
        "change": _as_number(quote.get("change")),
        "currency": quote.get("currency"),
        "kind": quote.get("kind"),
    }


def answer_question(
    question: str,
    payload: Any,
    symbols: Optional[List[str]] = None,
    language: str = "id",
    source: str = SOURCE_MARKET_DATA,
) -> Dict[str, Any]:
    """
    Answer a question about the market.

    Everything the answer says about a price is read out of the
    payload. When the payload has nothing about the question, the
    answer says that, and the chart is empty.
    """
    language = language if language in ("id", "en", "ja") else "id"
    quotes = flatten_market(payload)

    matched = match_quotes(question, quotes, symbols)

    # Nothing about the question and nothing at all to talk about.
    if not quotes:
        return {
            "answer": _word("no_data", language),
            "answer_key": "market_advisor.answer.no_data",
            "answer_values": {},
            "key_points": [
                {
                    "key": "market_advisor.point.no_data",
                    "values": {},
                }
            ],
            "chart_points": [],
            "source": source,
        }

    # The reader asked about something the server has never seen.
    if not matched:
        unknown = _unknown_symbols(question, quotes, symbols)
        if unknown:
            name = ", ".join(unknown)
            return {
                "answer": _word("no_data_symbol", language, {"symbol": name}),
                "answer_key": "market_advisor.answer.no_data_symbol",
                "answer_values": {"symbol": name},
                "key_points": [
                    {
                        "key": "market_advisor.point.no_data_symbol",
                        "values": {"symbol": name},
                    }
                ],
                "chart_points": [],
                "source": source,
            }

        # The question was general. The answer is about the quotes
        # that moved the most.
        ranked = sorted(
            quotes,
            key=lambda q: abs(_as_number(q.get("change")) or 0.0),
            reverse=True,
        )
        top = ranked[:5]
        gainers = [q for q in quotes if (_as_number(q.get("change")) or 0) > 0]
        losers = [q for q in quotes if (_as_number(q.get("change")) or 0) < 0]

        key_points: List[Dict[str, Any]] = [
            {
                "key": "market_advisor.point.count",
                "values": {"count": len(quotes)},
            }
        ]
        if gainers:
            best = max(gainers, key=lambda q: _as_number(q.get("change")) or 0)
            key_points.append(
                {
                    "key": "market_advisor.point.top_gainer",
                    "values": {
                        "symbol": best.get("symbol"),
                        "price": format_price(best.get("price"), best.get("currency")),
                        "change": format_change(best.get("change")),
                    },
                }
            )
        if losers:
            worst = min(losers, key=lambda q: _as_number(q.get("change")) or 0)
            key_points.append(
                {
                    "key": "market_advisor.point.top_loser",
                    "values": {
                        "symbol": worst.get("symbol"),
                        "price": format_price(worst.get("price"), worst.get("currency")),
                        "change": format_change(worst.get("change")),
                    },
                }
            )

        summary = ", ".join(
            f"{q.get('symbol')} {format_price(q.get('price'), q.get('currency'))}"
            for q in top
        )
        return {
            "answer": _word("overview", language, {"count": len(quotes)}),
            "answer_key": "market_advisor.answer.overview",
            "answer_values": {"count": len(quotes)},
            "key_points": key_points,
            "chart_points": [_chart_point(q) for q in top],
            "source": source,
        }

    # The reader asked about something the server has.
    key_points = []
    chart_points = []
    for quote in matched:
        key_points.append(
            {
                "key": "market_advisor.point.price",
                "values": {
                    "symbol": quote.get("symbol"),
                    "price": format_price(quote.get("price"), quote.get("currency")),
                    "currency": quote.get("currency"),
                },
            }
        )
        key_points.append(
            {
                "key": "market_advisor.point.change",
                "values": {
                    "symbol": quote.get("symbol"),
                    "change": format_change(quote.get("change")),
                },
            }
        )
        chart_points.append(_chart_point(quote))

    first = matched[0]
    summary = ", ".join(
        f"{q.get('symbol')} {format_price(q.get('price'), q.get('currency'))}"
        for q in matched[:4]
    )
    if len(matched) == 1:
        answer_key = "symbol_found"
        answer_values = {
            "symbol": first.get("symbol"),
            "price": format_price(first.get("price"), first.get("currency")),
            "change": format_change(first.get("change")),
        }
    else:
        answer_key = "symbols_found"
        answer_values = {"count": len(matched), "summary": summary}

    return {
        "answer": _word(answer_key, language, answer_values),
        "answer_key": f"market_advisor.answer.{answer_key}",
        "answer_values": answer_values,
        "key_points": key_points,
        "chart_points": chart_points,
        "source": source,
    }


# ---------------------------------------------------------------------------
# The language model, when there is one
# ---------------------------------------------------------------------------

_MODEL_SYSTEM = (
    "You read a finance question and decide which of the listed market "
    "symbols the question is about. Answer with JSON only: "
    '{"symbols": ["..."]}. Use an empty list when the question is general. '
    "Never invent a symbol that is not in the list."
)


def _model_symbols(question: str, quotes: List[Dict[str, Any]]) -> Optional[List[str]]:
    """
    The symbols the model says the question is about.

    Returns None when the model could not be reached or did not give a
    usable answer, so the caller falls back to reading the question
    itself.
    """
    try:
        from app.services.gemini_client import call_gemini_json, get_pool

        if not get_pool().has_keys:
            return None
    except Exception as exc:  # noqa: BLE001 - the model is optional
        logger.info("The language model is not available: %s", exc)
        return None

    listing = ", ".join(
        f"{q.get('symbol')} ({q.get('name')})" for q in quotes[:120]
    )
    prompt = (
        "Market symbols available:\n"
        f"{listing}\n\n"
        f"Question: {question}\n\n"
        "Which of the listed symbols is the question about? JSON only."
    )

    try:
        data = call_gemini_json(
            prompt,
            timeout=20,
            temperature=0.0,
            max_output_tokens=512,
            system_instruction=_MODEL_SYSTEM,
        )
    except Exception as exc:  # noqa: BLE001 - a broken model must not break the page
        logger.info("The language model did not answer: %s", exc)
        return None

    if not isinstance(data, dict):
        return None
    raw = data.get("symbols")
    if not isinstance(raw, list):
        return None

    known = {str(q.get("symbol", "")).upper() for q in quotes}
    chosen: List[str] = []
    for item in raw:
        token = str(item).strip().upper()
        if not token or token in known:
            if token and token not in chosen:
                chosen.append(token)
    return chosen


async def ask_market_advisor(
    question: str,
    symbols: Optional[List[str]] = None,
    language: str = "id",
) -> Dict[str, Any]:
    """
    The whole answer, with the model used when there is one.

    The model is asked which symbols the question is about. The answer
    itself is built from the quotes, so it can only contain numbers
    the server has.
    """
    payload = await get_snapshot()
    quotes = flatten_market(payload)

    source = SOURCE_MARKET_DATA
    chosen: Optional[List[str]] = None

    if quotes and (question or "").strip():
        try:
            chosen = await asyncio.to_thread(
                _model_symbols, question, quotes
            )
        except Exception as exc:  # noqa: BLE001
            logger.info("The language model could not be asked: %s", exc)
            chosen = None
        if chosen is not None:
            source = SOURCE_LANGUAGE_MODEL

    # The symbols the model found and the ones the reader named are
    # both looked for. Neither replaces the other.
    wanted: List[str] = list(symbols or [])
    for symbol in chosen or []:
        if symbol not in wanted:
            wanted.append(symbol)

    result = answer_question(
        question,
        payload,
        symbols=wanted,
        language=language,
        source=source,
    )
    if result.get("source") not in ALLOWED_SOURCES:
        result["source"] = SOURCE_MARKET_DATA
    return result


def build_context(payload: Any) -> Dict[str, Any]:
    """A short summary of what the server currently has."""
    quotes = flatten_market(payload)
    kinds: Dict[str, int] = {}
    for quote in quotes:
        kind = str(quote.get("kind", "other"))
        kinds[kind] = kinds.get(kind, 0) + 1

    symbols = [
        {
            "symbol": quote.get("symbol"),
            "name": quote.get("name"),
            "kind": quote.get("kind"),
            "currency": quote.get("currency"),
        }
        for quote in quotes
    ]

    examples: List[Dict[str, Any]] = []
    first_symbol = None
    for quote in quotes:
        if quote.get("kind") in ("stock", "crypto"):
            first_symbol = quote.get("symbol")
            break
    if first_symbol:
        examples.append(
            {
                "key": "market_advisor.example.price",
                "values": {"symbol": first_symbol},
            }
        )
    examples.append(
        {
            "key": "market_advisor.example.overview",
            "values": {"count": len(quotes)},
        }
    )
    examples.append(
        {
            "key": "market_advisor.example.movers",
            "values": {},
        }
    )

    return {
        "count": len(quotes),
        "kinds": kinds,
        "symbols": symbols,
        "example_questions": examples,
        "has_market_data": bool(quotes),
        "updated": payload.get("updated") if isinstance(payload, dict) else None,
        "source": payload.get("source") if isinstance(payload, dict) else None,
    }
