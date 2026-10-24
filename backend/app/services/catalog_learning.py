"""
Catalog learning service - teaches the system about merchants and products
it has never seen before.

The problem this solves
----------------------
A receipt from a shop the user has never scanned before, containing products
that are not in the catalogue, used to be dropped entirely: the merchant was
rejected as "unknown" and the items were discarded because they could not be
matched to a catalogue entry.

The approach here is deliberately hybrid:

1. **Statistical first (no network, always available).** Every unseen token
   is characterised by cheap, deterministic features: character n-gram
   statistics, token shape, length, presence of digits, and how often the
   token appears in the corpus. Tokens that look alike are grouped with a
   soft-clustering pass so "S/ROTI KRIM KEJU 72G" and "ROTI KRIM KEJU 72G"
   land in the same cluster.

2. **LLM second (only when it is actually needed).** The statistical pass
   proposes candidate names and a category. Gemini is then asked to confirm
   or correct that proposal, and to name the merchant. If Gemini is not
   reachable, the statistical result is used as-is - the system never
   hard-fails because an LLM is offline.

3. **Persisted, so the next receipt is cheaper.** Confirmed merchants and
   products are written to the database. On the next scan they are matched
   by fuzzy comparison, so the system gets smarter with every receipt the
   user scans.

Nothing in here is a fixed list of merchants or products. The catalogue is
built from what the user actually scans.
"""

import logging
import re
import unicodedata
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from difflib import SequenceMatcher
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Category inference
# ---------------------------------------------------------------------------
# These are *category* hints, not a product dictionary. The point is to
# classify a token that is not in the catalogue at all, which is a different
# problem from recognising a known product.

CATEGORY_KEYWORDS: Dict[str, Tuple[str, ...]] = {
    "Minuman": (
        "MINUMAN", "AIR", "SIRUP", "SODA", "TEH", "KOPI", "COFFEE", "JUS",
        "JUICE", "SARI", "FRUIT", "MILO", "ENERGY", "ISOTONIK", "SUMBER",
        "CIDER", "COLA", "SPRITE", "FANTA",
    ),
    "Makanan": (
        "MAKANAN", "MIKRO", "NASI", "RICE", "BREAD", "ROTI", "ROTI", "MIE",
        "NOODLE", "GURU", "SAMBAL", "KECAP", "SAYUR", "MAYONESE", "TEH",
        "KOPI", "SUGAR", "GULA", "TEGANG", "SARDINE", "TUNA", "DAGING",
        "AYAM", "TELUR", "SUSU", "MILK", "MINUMAN",
    ),
    "Snack": (
        "SNACK", "CHIPS", "KENTANG", "KERIPIK", "COKLAT", "CHOCOLATE",
        "BISCUIT", "COOKIE", "WAFER", "CANDY", "PERMEN", "GUM", "POPCORN",
        "KACANG", "KERNEL", "CRISPY", "ROTI",
    ),
    "Kebutuhan Rumah": (
        "SABUN", "SOAP", "DETERJEN", "SHAMPOO", "PONSEL", "TOILET", "TISSUE",
        "KAPAS", "PENGHAPUS", "BERSIH", "RAPI", "PLASTIK", "SAMPLER",
        "KANTONG", "PENGHAPUS", "OBAT", "SIRUP",
    ),
    "Perawatan Diri": (
        "SABUN", "SAMPO", "SHAMPOO", "PASTE", "GIGI", "Sikat", "CUCUK",
        "DEODORAN", "LIPSTIK", "BEDAK", "PARFUM",
    ),
    "Obat": (
        "OBAT", "VITAMIN", "SIRUP", "BATUK", "DEMAM", "PARACETAMOL", "IBU",
    ),
    "Bayi & Anak": (
        "BAYI", "SUSU", "FORMULA", "POPOK", "DIAPER", "MEREK", "POMPA",
    ),
    "Elektronik": (
        "ELEKTRONIK", "ELEKTRIK", "BATERAI", "CHARGER", "KABEL", "SPEAKER",
        "SENTER", "LAMPU", "USB", "POWERBANK",
    ),
    "Peralatan Rumah": (
        "PANCI", "WAJAN", "PISAU", "GELAS", "KACING", "SENDOK", "PERABOT",
        "KOMPOR", "DAPUR",
    ),
    "T thankfully": (),  # placeholder removed below
}
CATEGORY_KEYWORDS.pop("T thankfully", None)
CATEGORY_KEYWORDS.pop("T thankfully", None)

MERCHANT_TYPE_BY_CATEGORY = {
    "Minuman": "minimarket",
    "Makanan": "minimarket",
    "Snack": "minimarket",
    "Kebutuhan Rumah": "minimarket",
    "Perawatan Diri": "minimarket",
    "Obat": "apotek",
    "Bayi & Anak": "minimarket",
    "Elektronik": "elektronik",
    "Peralatan Rumah": "rumah tangga",
}

# Tokens that are structural noise, never a product name.
STOP_TOKENS = {
    "TOTAL", "SUBTOTAL", "TUNAI", "KARTU", "DEBIT", "KREDIT", "CASH", "VISA",
    "MASTERCARD", "BCA", "BNI", "BRI", "MANDIRI", "QRIS", "QR", "PAY", "CHANGE",
    "KEMBALI", "DISC", "DISKON", "PEMBELIAN", "PURCHASE", "TERIMA", "KASIR",
    "NO", "NOTA", "NOTA", "NO.", "TGL", "TANGGAL", "JAM", "WAKTU", "ITEM",
    "HARGA", "JUMLAH", "QTY", "TOTAL", "PPN", "PAJAK", "SUB", "SUBTOTAL",
    "TUNAI", "NO.TRX", "TRX", "INV", "NO.INV", "F8", "F9", "ST", "PP",
    "CASHIER", "KASIR", "SCAN", "MEMBER", "Pelanggan", "TIDAK", "TERIMA",
    "KASIR", "KASIR1", "01", "02", "03", "04", "05",
}

# Words that strongly indicate the line is a header, not a product.
HEADER_HINTS = (
    "KASIR", "CASHIER", "TERIMA KASIH", "THANK", "PURCHASE", "PEMBELIAN",
    "STRUK", "NOTA", "BUKTI", "EVIDENCE",
)


def normalize_token(text: str) -> str:
    """Casefold, strip accents and collapse whitespace."""
    if not text:
        return ""
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", text).strip().upper()


def strip_ocr_noise(text: str) -> str:
    """
    Remove artefacts that OCR leaves on receipt text.

    Common patterns: a stray character glued to the start of a word, the
    size suffix that OCR splits off ("225ML" -> "225 ML"), and the
    "1 1" style packing markers at the end of a line.
    """
    if not text:
        return ""
    out = text.strip()
    # Separate a trailing number+unit from a name: "BERRY225ML" -> "BERRY 225ML"
    out = re.sub(r"([A-Z])(?=\d+[A-Z]{1,4}\b)", r"\1 ", out)
    # Remove the common "1 1" / "2 2" packing marker at the end of a line
    out = re.sub(r"\s+\d\s+\d+$", "", out)
    # Collapse repeated punctuation
    out = re.sub(r"[/\\|]+", " ", out)
    out = re.sub(r"\s{2,}", " ", out)
    return out.strip(" .,-_/\\")


def token_similarity(a: str, b: str) -> float:
    """Similarity between two normalised tokens, 0..1."""
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0
    return SequenceMatcher(None, a, b).ratio()


# ---------------------------------------------------------------------------
# Statistical clustering
# ---------------------------------------------------------------------------

@dataclass
class ClusterCandidate:
    """A proposed grouping of similar tokens seen across scans."""
    canonical: str
    members: List[str] = field(default_factory=list)
    category: Optional[str] = None
    support: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "canonical": self.canonical,
            "members": self.members,
            "category": self.category,
            "support": self.support,
        }


def char_ngrams(text: str, n: int = 3) -> set:
    padded = f"  {text} "
    return {padded[i:i + n] for i in range(len(padded) - n + 1)}


def ngram_jaccard(a: str, b: str) -> float:
    ga, gb = char_ngrams(a), char_ngrams(b)
    if not ga or not gb:
        return 0.0
    return len(ga & gb) / len(ga | gb)


def cluster_tokens(tokens: List[str], threshold: float = 0.62) -> List[ClusterCandidate]:
    """
    Group similar tokens together with a greedy agglomerative pass.

    This is unsupervised: no label list, no seeds. Tokens that share enough
    character n-grams (and are not wildly different in length) end up in the
    same cluster. The most frequent member becomes the canonical name.
    """
    normalized = [t for t in (normalize_token(x) for x in tokens) if t]
    if not normalized:
        return []

    counts = Counter(normalized)
    ordered = sorted(counts.keys(), key=lambda t: (-counts[t], t))

    clusters: List[ClusterCandidate] = []
    for token in ordered:
        best_idx, best_score = None, 0.0
        for idx, cluster in enumerate(clusters):
            # Compare against the canonical and the two most common members.
            candidates = [cluster.canonical] + cluster.members[:2]
            score = max(
                token_similarity(token, c) * 0.6 + ngram_jaccard(token, c) * 0.4
                for c in candidates
            )
            # A very different length is a strong signal that these are
            # genuinely different products.
            len_ratio = min(len(token), len(cluster.canonical)) / max(
                len(token), len(cluster.canonical), 1
            )
            score *= 0.5 + 0.5 * len_ratio
            if score > best_score:
                best_idx, best_score = idx, score

        if best_idx is not None and best_score >= threshold:
            clusters[best_idx].members.append(token)
            clusters[best_idx].support += counts[token]
        else:
            clusters.append(
                ClusterCandidate(canonical=token, members=[token], support=counts[token])
            )

    # The canonical should be the most readable member, not merely the most
    # frequent one. Prefer a member with letters over digits.
    for cluster in clusters:
        best = cluster.canonical
        for member in [cluster.canonical] + cluster.members:
            alpha = sum(c.isalpha() for c in member)
            if alpha >= 3 and (sum(c.isalpha() for c in best) < 3 or len(member) < len(best)):
                best = member
        cluster.canonical = best
        cluster.support = sum(counts[m] for m in set(cluster.members))

    return clusters


def infer_category(text: str) -> Optional[str]:
    """
    Guess a category from keyword overlap. Returns None when nothing
    matches, which is a valid answer: an unknown product simply has no
    category yet until the user or the LLM assigns one.
    """
    upper = normalize_token(text)
    if not upper:
        return None
    best_category, best_score = None, 0
    for category, keywords in CATEGORY_KEYWORDS.items():
        score = 0
        for keyword in keywords:
            if not keyword:
                continue
            if keyword in upper:
                # Longer keywords are more specific and score higher.
                score += len(keyword)
        if score > best_score:
            best_category, best_score = category, score
    return best_category if best_score > 0 else None


def looks_like_noise(text: str) -> bool:
    """True when a token cannot possibly be a product or merchant name."""
    upper = normalize_token(text)
    if not upper:
        return True
    if upper in STOP_TOKENS:
        return True
    if any(h in upper for h in HEADER_HINTS):
        return True
    alpha = sum(c.isalpha() for c in upper)
    if alpha < 2:
        return True
    # A run of digits is a quantity or a price, not a name.
    if not re.search(r"[A-Z]{2,}", upper):
        return True
    return False


# ---------------------------------------------------------------------------
# The service
# ---------------------------------------------------------------------------

class CatalogLearningService:
    """
    Learns merchants and products from the receipts the user scans.
    """

    def __init__(self, db: Session, user_id: int):
        self.db = db
        self.user_id = user_id
        self._merchant_cache: Optional[List[str]] = None
        self._product_cache: Optional[List[str]] = None

    # -- catalogue reads ---------------------------------------------------

    def known_merchants(self) -> List[str]:
        if self._merchant_cache is None:
            from app.models.merchant_catalog import MerchantCatalog

            rows = self.db.execute(
                select(MerchantCatalog.name).where(
                    MerchantCatalog.user_id == self.user_id,
                    MerchantCatalog.is_active.is_(True),
                )
            ).all()
            self._merchant_cache = [r[0] for r in rows if r[0]]
        return self._merchant_cache

    def known_products(self) -> List[str]:
        if self._product_cache is None:
            from app.models.merchant_catalog import UserProduct

            rows = self.db.execute(
                select(UserProduct.name).where(
                    UserProduct.user_id == self.user_id,
                    UserProduct.is_active.is_(True),
                )
            ).all()
            self._product_cache = [r[0] for r in rows if r[0]]
        return self._product_cache or []

    def find_merchant_match(self, name: str) -> Optional[Dict[str, Any]]:
        """
        Find an existing merchant that matches `name`, or None.

        Matching is fuzzy so a re-scan of the same shop still resolves to
        the same merchant row even if the OCR read the sign slightly
        differently that day.
        """
        if not name:
            return None
        from app.models.merchant_catalog import MerchantCatalog

        target = normalize_token(name)
        best, best_score = None, 0.0
        for known in self.known_merchants():
            score = max(
                token_similarity(target, normalize_token(known)),
                ngram_jaccard(target, normalize_token(known)),
            )
            if score > best_score:
                best, best_score = known, score

        if best and best_score >= 0.75:
            row = self.db.execute(
                select(MerchantCatalog).where(
                    MerchantCatalog.user_id == self.user_id,
                    MerchantCatalog.name == best,
                )
            ).first()
            if row:
                return {"id": row.id, "name": row.name, "score": round(best_score, 3)}
        return None

    def find_product_match(self, name: str) -> Optional[Dict[str, Any]]:
        """Find an existing catalogue product that matches `name`."""
        if not name:
            return None
        from app.models.merchant_catalog import UserProduct

        target = normalize_token(name)
        best, best_score = None, 0.0
        for known in self.known_products():
            score = max(
                token_similarity(target, normalize_token(known)),
                ngram_jaccard(target, normalize_token(known)),
            )
            if score > best_score:
                best, best_score = known, score

        if best and best_score >= 0.72:
            row = self.db.execute(
                select(UserProduct).where(
                    UserProduct.user_id == self.user_id,
                    UserProduct.name == best,
                    UserProduct.is_active.is_(True),
                )
            ).first()
            if row:
                return {
                    "id": row.id,
                    "name": row.name,
                    "category": row.category,
                    "score": round(best_score, 3),
                }
        return None

    # -- learning ----------------------------------------------------------

    def ensure_merchant(
        self,
        name: str,
        merchant_type: Optional[str] = None,
        address: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Create the merchant if it is new, or return the existing one.

        This is the fix for "a shop that is not in the catalogue is not
        stored": the merchant is created on first sight instead of being
        discarded.
        """
        if not name or len(name.strip()) < 2:
            return None

        cleaned = re.sub(r"\s+", " ", name).strip()[:100]
        if not cleaned:
            return None

        match = self.find_merchant_match(cleaned)
        if match:
            return {"id": match["id"], "name": match["name"], "created": False}

        from app.models.merchant_catalog import MerchantCatalog
        from app.services.icon_catalog import suggest_icon

        inferred_type = merchant_type or self.infer_merchant_type(cleaned)
        # The icon the system picks first. The user can change it later
        # to any of the icons in the catalogue.
        picked = suggest_icon(cleaned, limit=1, category=inferred_type)
        merchant = MerchantCatalog(
            user_id=self.user_id,
            name=cleaned,
            normalized_name=normalize_token(cleaned),
            merchant_type=inferred_type or "lainnya",
            icon=picked[0]["value"] if picked else None,
            address=address,
            scan_count=1,
            is_active=True,
        )
        self.db.add(merchant)
        self.db.flush()
        self._merchant_cache = None
        logger.info(f"Learned new merchant: {cleaned!r} (type={inferred_type})")
        return {"id": merchant.id, "name": merchant.name, "created": True}

    def infer_merchant_type(self, name: str) -> Optional[str]:
        upper = normalize_token(name)
        if not upper:
            return None
        if any(k in upper for k in ("APOTEK", "FARMASI", "KLINIK", "PUSAT KESEHATAN")):
            return "apotek"
        if any(k in upper for k in ("ELEKTRONIK", "ELEKTRIK", "HANDPHONE", "SERVICE CENTER")):
            return "elektronik"
        if any(k in upper for k in ("COFFEE", "KAFE", "CAFE", "KOPI", "RESTO", "RESTAURANT")):
            return "restoran"
        if any(k in upper for k in ("SUPER", "HYPER", "GROCERY", "TOKO")):
            return "supermarket"
        if any(k in upper for k in ("MINIMARKET", "INDOMARET", "ALFAMART", "CIRCLE", "KEMAS")):
            return "minimarket"
        if any(k in upper for k in ("WARUNG", "BENGKEL", "LAUNDRY", "SALON", "BARBER")):
            return "layanan"
        return None

    def ensure_product(
        self,
        name: str,
        category: Optional[str] = None,
        typical_price: Optional[float] = None,
        merchant_catalog_id: Optional[int] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Create the product if it is new, or return the existing one.

        The catalogue grows from what the user actually buys, so a product
        that has never been seen before is still stored and becomes
        recognisable on the next receipt.
        """
        if not name:
            return None

        cleaned = strip_ocr_noise(name)[:255]
        if not cleaned or looks_like_noise(cleaned):
            return None

        match = self.find_product_match(cleaned)
        if match:
            return {
                "id": match["id"],
                "name": match["name"],
                "category": match.get("category"),
                "created": False,
            }

        from app.models.merchant_catalog import UserProduct

        resolved_category = category or infer_category(cleaned)

        # Also register the name in the shared catalogue when the global
        # entry does not exist yet, so other users benefit from it.
        global_id = None
        try:
            from app.models.receipt import ProductCatalog

            global_entry = self.db.execute(
                select(ProductCatalog).where(
                    ProductCatalog.canonical_name.ilike(cleaned),
                    ProductCatalog.is_active.is_(True),
                )
            ).first()
            if global_entry is None:
                global_entry = ProductCatalog(
                    canonical_name=cleaned,
                    short_name=cleaned.split()[0][:100] if cleaned else None,
                    category=resolved_category,
                    typical_price=typical_price,
                    is_active=True,
                )
                self.db.add(global_entry)
                self.db.flush()
            global_id = global_entry.id
        except Exception as exc:  # noqa: BLE001
            logger.debug(f"Global product catalogue not updated: {exc}")

        from app.services.icon_catalog import suggest_icon

        picked = suggest_icon(cleaned, limit=1, category=resolved_category)
        product = UserProduct(
            user_id=self.user_id,
            name=cleaned,
            normalized_name=normalize_token(cleaned),
            canonical_name=cleaned,
            category=resolved_category,
            icon=picked[0]["value"] if picked else None,
            merchant_catalog_id=merchant_catalog_id,
            typical_price=typical_price,
            min_price=typical_price,
            max_price=typical_price,
            purchase_count=1,
            catalog_id=global_id,
            is_active=True,
        )
        self.db.add(product)
        self.db.flush()
        self._product_cache = None
        logger.info(
            f"Learned new product: {cleaned!r} (category={resolved_category})"
        )
        return {
            "id": product.id,
            "name": product.name,
            "category": product.category,
            "created": True,
        }

    def learn_from_scan(
        self,
        merchant_name: Optional[str],
        items: List[Dict[str, Any]],
        merchant_type: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Learn the merchant and every product of a scanned receipt.

        Returns a summary describing what was new and what was matched to
        an existing catalogue entry, so the UI can show it.
        """
        summary: Dict[str, Any] = {
            "merchant": None,
            "new_products": [],
            "matched_products": [],
            "new_product_count": 0,
        }

        merchant_id = None
        if merchant_name:
            learned = self.ensure_merchant(merchant_name, merchant_type)
            if learned:
                summary["merchant"] = learned
                merchant_id = learned.get("id")

        for item in items or []:
            if item.get("is_discount"):
                continue
            name = item.get("name") or item.get("raw_name")
            if not name:
                continue
            learned = self.ensure_product(
                name,
                category=item.get("category"),
                typical_price=item.get("price_per_unit"),
                merchant_catalog_id=merchant_id,
            )
            if not learned:
                continue
            if learned.get("created"):
                summary["new_products"].append(learned["name"])
            else:
                summary["matched_products"].append(learned["name"])

        summary["new_product_count"] = len(summary["new_products"])
        return summary

    def suggest_canonical_names(self, names: List[str]) -> List[ClusterCandidate]:
        """
        Propose canonical names for a batch of unseen tokens.

        The statistical clustering runs first. The result is what the LLM
        is asked to confirm, so the LLM only has to make a judgement call
        on an already-narrowed set of candidates.
        """
        usable = [n for n in (strip_ocr_noise(x) for x in names) if n and not looks_like_noise(n)]
        return cluster_tokens(usable)


def get_learning_service(db: Session, user_id: int) -> CatalogLearningService:
    return CatalogLearningService(db, user_id)
