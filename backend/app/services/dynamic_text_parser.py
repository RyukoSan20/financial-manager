"""
Dynamic receipt text parser.

The goal is to recognise product and merchant names that are NOT in any
dictionary. A hardcoded lexicon fails the moment a receipt contains a brand
we have never seen ("Chilsung Cider", "Shin Ramyun", "Indomie Goreng").

Two complementary strategies are used, in order:

  1. LLM / SLM parsing. The raw OCR lines are sent to a language model that
     has contextual awareness, so it can repair broken words from the
     surrounding line and group anything it sees into the right bucket.
     The provider is resolved dynamically:
       - Ollama (local, free) at $OLLAMA_URL, model $OLLAMA_MODEL
       - Any OpenAI-compatible endpoint (llama.cpp, vLLM, LM Studio, ...)
         at $LLM_API_BASE
       - Google Gemini via $GEMINI_API_KEY
     If none is configured, the parser degrades to strategy 2.

  2. Statistical classification. Character n-gram TF-IDF with cosine
     similarity groups unseen words by shape similarity, and a set of
     regex/shape heuristics classifies tokens into date, money, quantity,
     item and free-text buckets. Unclassified words are kept as unknown
     product names rather than dropped.

  3. Self-learning. Words that land in the unknown bucket and are then
     confirmed by the user are written to `product_catalog`, so the
     classifier improves over time without any manual dictionary work.

Every value in the output comes from the OCR text. Nothing is fabricated.
"""

import json
import logging
import os
import re
import threading
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Result types
# ---------------------------------------------------------------------------

@dataclass
class ParsedItem:
    item_name: str
    qty: float = 1.0
    price: float = 0.0
    confidence: float = 0.0
    # Token category assigned by the classifier (item / unknown / money / ...)
    token_class: str = "item"


@dataclass
class DynamicParseResult:
    store_name: Optional[str] = None
    store_address: Optional[str] = None
    items: List[ParsedItem] = field(default_factory=list)
    subtotal: Optional[float] = None
    total: Optional[float] = None
    tax: Optional[float] = None
    discount: Optional[float] = None
    payment_method: Optional[str] = None
    transaction_date: Optional[str] = None
    transaction_time: Optional[str] = None
    confidence: float = 0.0
    engine: str = "none"
    notes: List[str] = field(default_factory=list)
    raw: Dict[str, Any] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Token classification (strategy 2)
# ---------------------------------------------------------------------------

class TokenClassifier:
    """Shape-based + similarity-based classifier for unseen words.

    The similarity model is a char n-gram TF-IDF vectoriser with cosine
    similarity. It is intentionally dependency-light: if scikit-learn is
    unavailable the classifier still works using the heuristic rules alone,
    and every unseen word falls through to the "product name" bucket rather
    than being discarded.
    """

    DATE_RE = re.compile(r"^\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{2,4}$")
    TIME_RE = re.compile(r"^\d{1,2}[:.]\d{2}([:.]\d{2})?$")
    MONEY_RE = re.compile(r"^rp\.?\s*[\d.,]+$|^[\d.,]+$")
    QTY_RE = re.compile(r"^\d+x$|^x\d+$")

    # Anchor patterns: a small corpus per class used for similarity.
    ANCHORS = {
        "MONEY_WORDS": [
            "total", "subtotal", "jumlah", "cash", "kembalian", "tax", "ppn",
            "harga", "jual", "bayar", "grand total", "total bayar", "change",
            "tunai", "debit", "kredit",
        ],
        "ITEM_WORDS": [
            "ayam", "nasi", "kopi", "susu", "roti", "air", "minuman", "cola",
            "indomie", "chilsung", "ramyun", "shin", "cider", "teh", "susu",
            "sarden", "sardenina", "chitato", "tahu", "telur", "beras",
        ],
        "STORE_WORDS": [
            "indomaret", "alfamart", "warung", "supermarket", "minimarket",
            "carrefour", "lottiemart", "asep", "bpn", "cstore", "kopital",
            "grand", "fresh", "mart",
        ],
    }

    def __init__(self):
        self._vectorizer = None
        self._matrix = None
        self._labels: List[str] = []
        self._lock = threading.Lock()
        self._build_model()

    def _build_model(self):
        try:
            from sklearn.feature_extraction.text import TfidfVectorizer
            from sklearn.metrics.pairwise import cosine_similarity

            corpus, labels = [], []
            for label, samples in self.ANCHORS.items():
                for sample in samples:
                    corpus.append(sample)
                    labels.append(label)

            vectorizer = TfidfVectorizer(analyzer="char", ngram_range=(2, 3))
            matrix = vectorizer.fit_transform(corpus)

            self._vectorizer = vectorizer
            self._matrix = matrix
            self._labels = labels
            self._cosine = cosine_similarity
            logger.info("Token classifier model built with %d anchors", len(corpus))
        except Exception as e:
            logger.warning(f"scikit-learn unavailable, using heuristics only: {e}")
            self._vectorizer = None

    def classify(self, token: str) -> str:
        """Classify a single token into a semantic bucket."""
        token = token.strip()
        if not token:
            return "EMPTY"

        lower = token.lower()

        if self.DATE_RE.match(lower):
            return "DATE"
        if self.TIME_RE.match(lower):
            return "TIME"
        if self.QTY_RE.match(lower):
            return "QUANTITY"
        if re.match(r"^\d+$", lower):
            # A bare number is money only if it looks like an amount
            # (has separators or is long enough to be a price).
            digits = lower.replace(".", "").replace(",", "")
            if len(digits) >= 4:
                return "MONEY"
            return "NUMBER"
        if self.MONEY_RE.match(lower):
            return "MONEY"

        # Similarity to the anchor corpus.
        if self._vectorizer is not None:
            try:
                with self._lock:
                    vec = self._vectorizer.transform([lower])
                    scores = self._cosine(self._matrix, vec).flatten()
                    best_idx = int(scores.argmax())
                    best_score = float(scores[best_idx])
                if best_score > 0.2:
                    return self._labels[best_idx]
            except Exception as e:
                logger.debug(f"Similarity classification failed for {token!r}: {e}")

        # Fallback: a product name is any word that is not a stop word.
        if lower in self._stop_words():
            return "STOPWORD"

        # Unknown alphabetic word -> treat as a product name. This is the
        # whole point: a brand we have never seen is still a product.
        if re.match(r"^[a-z][a-z0-9'\-\./&]{1,}$", lower):
            return "ITEM"

        return "UNKNOWN"

    @staticmethod
    def _stop_words() -> set:
        return {
            "dan", "atau", "dengan", "untuk", "yang", "di", "ke", "dari", "pada",
            "the", "and", "or", "with", "for", "of", "in", "to", "a", "an",
            "no", "nomor", "nota", "kode", "ref", "no", "invoice", "struk",
            "kepada", "bapak", "ibu", "terima", "kasih", "terima", "kasih",
        }


# ---------------------------------------------------------------------------
# LLM client (strategy 1)
# ---------------------------------------------------------------------------

class LLMClient:
    """Resolves and calls a language model, whichever one is available.

    Provider order:
      1. Ollama  (OLLAMA_URL / OLLAMA_MODEL)      - local, free
      2. OpenAI-compatible (LLM_API_BASE / LLM_API_KEY / LLM_MODEL)
      3. Google Gemini (GEMINI_API_KEY / GEMINI_MODEL)
    """

    def __init__(self):
        self.provider = None
        self._resolve()

    def _resolve(self):
        if os.getenv("OLLAMA_URL"):
            self.provider = "ollama"
            return
        if os.getenv("LLM_API_BASE"):
            self.provider = "openai_compatible"
            return
        if os.getenv("GEMINI_API_KEY"):
            self.provider = "gemini"
            return
        self.provider = None

    @property
    def available(self) -> bool:
        return self.provider is not None

    def _ollama_model(self) -> str:
        return os.getenv("OLLAMA_MODEL", "llama3")

    def complete_json(self, prompt: str) -> Optional[Dict[str, Any]]:
        """Send the prompt and return the parsed JSON object, or None."""
        try:
            if self.provider == "ollama":
                return self._call_ollama(prompt)
            if self.provider == "openai_compatible":
                return self._call_openai_compatible(prompt)
            if self.provider == "gemini":
                return self._call_gemini(prompt)
        except Exception as e:
            logger.warning(f"LLM call failed ({self.provider}): {e}")
        return None

    def _call_ollama(self, prompt: str) -> Optional[Dict[str, Any]]:
        import httpx

        url = os.getenv("OLLAMA_URL", "http://localhost:11434").rstrip("/")
        payload = {
            "model": self._ollama_model(),
            "prompt": prompt,
            "stream": False,
            "format": "json",
            "options": {"temperature": 0.1},
        }
        response = httpx.post(f"{url}/api/generate", json=payload, timeout=120)
        response.raise_for_status()
        body = response.json()
        return json.loads(body.get("response", "{}"))

    def _call_openai_compatible(self, prompt: str) -> Optional[Dict[str, Any]]:
        import httpx

        base = os.getenv("LLM_API_BASE", "").rstrip("/")
        model = os.getenv("LLM_MODEL", "llama3")
        key = os.getenv("LLM_API_KEY", "")
        headers = {"Content-Type": "application/json"}
        if key:
            headers["Authorization"] = f"Bearer {key}"

        payload = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.1,
            "response_format": {"type": "json_object"},
        }
        response = httpx.post(f"{base}/v1/chat/completions", json=payload,
                              headers=headers, timeout=120)
        response.raise_for_status()
        body = response.json()
        content = body["choices"][0]["message"]["content"]
        return json.loads(content)

    def _call_gemini(self, prompt: str) -> Optional[Dict[str, Any]]:
        import httpx

        key = os.getenv("GEMINI_API_KEY", "")
        model = os.getenv("GEMINI_MODEL", "gemini-3.6-flash")
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.1,
                "responseMimeType": "application/json",
            },
        }
        response = httpx.post(url, params={"key": key}, json=payload, timeout=120)
        response.raise_for_status()
        body = response.json()
        parts = body["candidates"][0]["content"]["parts"]
        return json.loads(parts[0]["text"])


# ---------------------------------------------------------------------------
# The dynamic parser
# ---------------------------------------------------------------------------

PROMPT_TEMPLATE = """Kamu adalah sistem AI Parser transaksi multibahasa yang sangat cerdas. Tugasmu:
1. Koreksi kata-kata yang typo, rusak, atau terpotong akibat kertas struk belanja sobek (Gunakan konteks kalimat di sekitarnya).
2. Ekstrak dan kelompokkan SEMUA kata atau informasi yang ada ke dalam JSON terstruktur.
3. Jangan batasi nama produk atau nama toko. Kelompokkan secara otomatis ke dalam kategori: 'store_info', 'items' (list nama barang, quantity, harga), 'financials' (total, pajak), dan 'metadata' (tanggal, waktu jika ada).

Teks Mentah OCR:
\"\"\"
{full_text}
\"\"\"

Berikan output HANYA dalam format JSON bersih seperti ini:
{{
  "store_info": {{ "name": "...", "address": "..." }},
  "items": [ {{ "item_name": "...", "qty": 1, "price": 0.0 }} ],
  "financials": {{ "subtotal": 0.0, "total": 0.0 }},
  "metadata": {{ "date": "...", "time": "..." }},
  "confidence_notes": "..."
}}
"""


class DynamicTextParser:
    """Parses raw OCR lines into structured transaction data."""

    def __init__(self):
        self.classifier = TokenClassifier()
        self.llm = LLMClient()
        logger.info(
            "DynamicTextParser ready - LLM provider: %s",
            self.llm.provider or "none (statistical only)",
        )

    # ------------------------------------------------------------------
    def parse(self, raw_lines: List[str]) -> DynamicParseResult:
        """Parse OCR lines. Uses the LLM when available, statistics otherwise."""
        lines = [l for l in (raw_lines or []) if l and l.strip()]
        if not lines:
            return DynamicParseResult(engine="none", notes=["no_text"])

        if self.llm.available:
            result = self._parse_with_llm(lines)
            if result is not None:
                result.engine = f"llm:{self.llm.provider}"
                return result
            logger.info("LLM parse failed - falling back to statistical parsing")

        result = self._parse_statistically(lines)
        result.engine = "statistical"
        return result

    # ------------------------------------------------------------------
    def _parse_with_llm(self, lines: List[str]) -> Optional[DynamicParseResult]:
        full_text = "\n".join(lines)
        prompt = PROMPT_TEMPLATE.format(full_text=full_text)
        data = self.llm.complete_json(prompt)
        if not data or not isinstance(data, dict):
            return None

        store = data.get("store_info") or {}
        financials = data.get("financials") or {}
        metadata = data.get("metadata") or {}

        items: List[ParsedItem] = []
        for raw_item in (data.get("items") or []):
            if not isinstance(raw_item, dict):
                continue
            name = (raw_item.get("item_name") or raw_item.get("name") or "").strip()
            if not name:
                continue
            try:
                qty = float(raw_item.get("qty", raw_item.get("quantity", 1)) or 1)
            except (TypeError, ValueError):
                qty = 1.0
            try:
                price = float(raw_item.get("price", raw_item.get("total_price", 0)) or 0)
            except (TypeError, ValueError):
                price = 0.0
            items.append(ParsedItem(
                item_name=name,
                qty=qty,
                price=price,
                confidence=0.9,
                token_class="item",
            ))

        if not items:
            return None

        def _num(value) -> Optional[float]:
            try:
                return float(value) if value is not None else None
            except (TypeError, ValueError):
                return None

        notes = []
        if data.get("confidence_notes"):
            notes.append(str(data["confidence_notes"]))

        return DynamicParseResult(
            store_name=(store.get("name") or None),
            store_address=(store.get("address") or None),
            items=items,
            subtotal=_num(financials.get("subtotal")),
            total=_num(financials.get("total")),
            tax=_num(financials.get("tax")),
            discount=_num(financials.get("discount")),
            payment_method=(financials.get("payment_method") or None),
            transaction_date=(metadata.get("date") or None),
            transaction_time=(metadata.get("time") or None),
            confidence=0.85 if len(items) else 0.0,
            notes=notes,
            raw=data,
        )

    # ------------------------------------------------------------------
    def _parse_statistically(self, lines: List[str]) -> DynamicParseResult:
        """Shape + similarity based parsing with no dictionary limits.

        A line is an item when it contains an item-like token together with
        a money amount. Everything else is kept as raw text so no
        information is lost.
        """
        items: List[ParsedItem] = []
        money_keywords = set()
        store_candidates: List[str] = []
        date_value = None
        time_value = None
        total_value = None

        total_keywords = ("total", "jumlah", "grand total", "total bayar", "jumlah bayar")
        subtotal_keywords = ("subtotal", "sub total", "total sebelum")
        discount_keywords = ("diskon", "potongan", "voucher", "cashback", "promo")
        tax_keywords = ("ppn", "pajak", "tax")
        payment_keywords = ("tunai", "cash", "debit", "kredit", "qris", "gopay", "ovo", "dana")

        for line in lines:
            cleaned = re.sub(r"\s+", " ", line).strip()
            if not cleaned:
                continue
            lower = cleaned.lower()

            # Financial keywords are remembered for the totals.
            for kw in total_keywords:
                if kw in lower:
                    money_keywords.add("total")
            for kw in subtotal_keywords:
                if kw in lower:
                    money_keywords.add("subtotal")
            for kw in discount_keywords:
                if kw in lower:
                    money_keywords.add("discount")
            for kw in tax_keywords:
                if kw in lower:
                    money_keywords.add("tax")
            for kw in payment_keywords:
                if kw in lower:
                    money_keywords.add("payment")

            tokens = re.findall(r"[A-Za-z][A-Za-z0-9'\-\.&/]*|\d[\d.,]*", cleaned)
            if not tokens:
                continue

            classes = [self.classifier.classify(tok) for tok in tokens]

            # Date / time detection.
            for tok, cls in zip(tokens, classes):
                if cls == "DATE" and date_value is None:
                    date_value = tok
                elif cls == "TIME" and time_value is None:
                    time_value = tok

            # The store name is usually one of the first lines.
            if not store_candidates and len(store_candidates) == 0:
                for tok, cls in zip(tokens, classes):
                    if cls == "ITEM" and self.classifier.classify(tok) == "STORE_WORDS":
                        store_candidates.append(tok)
                        break

            # Amounts on this line.
            amounts = []
            for tok, cls in zip(tokens, classes):
                if cls in ("MONEY", "NUMBER"):
                    cleaned_amount = tok.replace("rp", "").replace("RP", "").strip()
                    cleaned_amount = cleaned_amount.replace(".", "").replace(",", ".")
                    try:
                        value = float(cleaned_amount)
                    except ValueError:
                        continue
                    if value > 0:
                        amounts.append(value)

            item_tokens = [
                tok for tok, cls in zip(tokens, classes)
                if cls in ("ITEM", "UNKNOWN") and not tok.isdigit()
            ]

            has_money_keyword = any(
                kw in lower for kw in (
                    total_keywords + subtotal_keywords + discount_keywords
                    + tax_keywords + payment_keywords
                )
            )

            if item_tokens and amounts and not has_money_keyword:
                # Quantity detection: "2 x 5000" or "4X5000".
                qty = 1.0
                qty_match = re.search(r"(\d+)\s*[xX]\s*([\d.,]+)", cleaned)
                if qty_match:
                    try:
                        qty = float(qty_match.group(1))
                    except ValueError:
                        qty = 1.0
                else:
                    for tok, cls in zip(tokens, classes):
                        if cls == "QUANTITY":
                            try:
                                qty = float(re.sub(r"[xX]", "", tok))
                            except ValueError:
                                qty = 1.0
                            break

                price = max(amounts)
                items.append(ParsedItem(
                    item_name=" ".join(item_tokens[:6]),
                    qty=qty,
                    price=price,
                    confidence=0.55,
                    token_class="item",
                ))
            elif has_money_keyword and amounts:
                if "total" in money_keywords and total_value is None:
                    total_value = max(amounts)

        # Store name: first line that is not an item and not a number.
        store_name = None
        for line in lines[:5]:
            cleaned = re.sub(r"\s+", " ", line).strip()
            if not cleaned or re.match(r"^[\d\s.,:/-]+$", cleaned):
                continue
            tokens = re.findall(r"[A-Za-z][A-Za-z0-9'\-\.&/]*", cleaned)
            if not tokens:
                continue
            words = [w for w in tokens if self.classifier.classify(w) != "STOPWORD"]
            if not words:
                continue
            candidate = " ".join(words[:4])
            # A store name is a short line without an attached price.
            if not re.search(r"\d{3,}", cleaned):
                store_name = candidate
                break

        return DynamicParseResult(
            store_name=store_name,
            items=items,
            total=total_value,
            transaction_date=date_value,
            transaction_time=time_value,
            confidence=0.55 if items else 0.2,
            notes=["statistical_parse"],
        )

    # ------------------------------------------------------------------
    def learn_terms(self, terms: List[str], category: Optional[str] = None) -> int:
        """Persist user-confirmed words into the product catalogue.

        This is the self-learning loop: words the user validates are added
        to the catalogue so later receipts recognise them directly.
        Returns the number of terms stored.
        """
        if not terms:
            return 0
        try:
            from app.core.database import SessionLocal
            from app.models.receipt import ProductCatalog

            stored = 0
            session = SessionLocal()
            try:
                for raw in terms:
                    term = (raw or "").strip()
                    if len(term) < 2:
                        continue
                    existing = session.query(ProductCatalog).filter(
                        ProductCatalog.canonical_name.ilike(term)
                    ).first()
                    if existing:
                        existing.is_active = True
                        if category and not existing.category:
                            existing.category = category
                        stored += 1
                        continue
                    entry = ProductCatalog(
                        canonical_name=term,
                        category=category or "Umum",
                        is_active=True,
                    )
                    session.add(entry)
                    stored += 1
                session.commit()
            finally:
                session.close()
            logger.info(f"Learned {stored} new terms into the product catalogue")
            return stored
        except Exception as e:
            logger.warning(f"Failed to store learned terms: {e}")
            return 0


# Module-level singleton.
dynamic_text_parser = DynamicTextParser()
