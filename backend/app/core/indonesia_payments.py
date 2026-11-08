"""
The Indonesian payment institutions, in one place.

An Indonesian reader has money in a conventional bank, in a digital
bank, in an e-wallet, in a tap card, on a credit card, and sometimes
in their own shop. Each of those has a number: the bank's code from
Bank Indonesia, the length of the account number, and the phone
number that an e-wallet is reached at.

That knowledge was scattered through the application - some of it in
the account form, some of it in the code that reads a quick entry,
some of it in the transfer screen. So it was wrong in three places
at once, and the reader was asked to remember a bank code they should
not have to remember.

So there is one table of it here, and one in the browser, and they
say the same thing.

Three things this table is for:

- **telling the reader where their money is.** Picking "SeaBank"
  fills in the brand colour, the badge, the Bank Indonesia code and
  the shape of the account number.
- **reading a line of Indonesian.** "kopi jago 10rb gopay" names the
  wallet, and "paket data tsel 50rb" names the operator, and the
  account and the category follow from it.
- **knowing what a transfer costs.** Which rail the money goes over
  decides the fee: same bank is free, BI-FAST is two and a half
  thousand, a real-time online transfer is six and a half thousand,
  and topping up a wallet is whatever that wallet charges.

Nothing here is a secret and nothing here is fetched from the
network. It is a table of public facts about how money moves in
Indonesia, and it is here so that the answer is the same wherever the
reader meets it.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Tuple

# ---------------------------------------------------------------------------
# The kinds of institution
# ---------------------------------------------------------------------------

BANK_CONVENTIONAL = "BANK_CONVENTIONAL"
BANK_DIGITAL = "BANK_DIGITAL"
BANK_SYARIAH = "BANK_SYARIAH"
BANK_BPD = "BANK_BPD"
EWALLET = "EWALLET"
EMONEY_CARD = "EMONEY_CARD"
PULSA_TELCO = "PULSA_TELCO"
PAYLATER_CREDIT = "PAYLATER_CREDIT"
CASH = "CASH"

#: The groups the account form offers, in the order they are offered.
INSTITUTION_GROUPS = [
    (BANK_CONVENTIONAL, "Bank Konvensional"),
    (BANK_DIGITAL, "Bank Digital"),
    (BANK_SYARIAH, "Bank Syariah"),
    (BANK_BPD, "Bank Pembangunan Daerah"),
    (EWALLET, "E-Wallet"),
    (EMONEY_CARD, "Kartu Tap"),
    (PAYLATER_CREDIT, "Paylater & Kredit"),
    (CASH, "Tunai / Cash"),
]


def _institution(
    id: str,
    name: str,
    kind: str,
    code: Optional[str] = None,
    digits: Optional[int] = None,
    aliases: Optional[List[str]] = None,
    color: str = "#64748B",
    number_kind: str = "account",
    topup_fee: Optional[int] = None,
    va_prefix: Optional[str] = None,
    prefixes: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """One institution, in the shape every institution has."""
    return {
        "id": id,
        "name": name,
        "kind": kind,
        "code": code,
        "digits": digits,
        "aliases": list(aliases or []),
        "color": color,
        "number_kind": number_kind,
        "topup_fee": topup_fee,
        "va_prefix": va_prefix,
        "prefixes": list(prefixes or []),
    }


# ---------------------------------------------------------------------------
# The table
# ---------------------------------------------------------------------------

INSTITUTIONS: List[Dict[str, Any]] = [
    # --- the conventional banks -----------------------------------------
    _institution("bca", "BCA", BANK_CONVENTIONAL, "014", 10,
                 ["bca", "mybca", "m-bca", "klikbca", "bank central asia"], "#0A4DA2"),
    _institution("mandiri", "Bank Mandiri", BANK_CONVENTIONAL, "008", 13,
                 ["mandiri", "livin", "livin by mandiri"], "#0B4A9B"),
    _institution("bri", "Bank BRI", BANK_CONVENTIONAL, "002", 15,
                 ["bri", "brimo", "britama", "simpedes"], "#0C7C3F"),
    _institution("bni", "Bank BNI", BANK_CONVENTIONAL, "009", 10,
                 ["bni", "wondr"], "#F26522"),
    _institution("btn", "Bank BTN", BANK_CONVENTIONAL, "200", 16,
                 ["btn", "bale"], "#2E7D32"),
    _institution("cimb", "CIMB Niaga", BANK_CONVENTIONAL, "022", None,
                 ["cimb", "cimb niaga", "octo"], "#B01513"),
    _institution("permata", "Bank Permata", BANK_CONVENTIONAL, "013", None,
                 ["permata", "permatame"], "#6B3FA0"),
    _institution("danamon", "Bank Danamon", BANK_CONVENTIONAL, "011", None,
                 ["danamon"], "#1B7B3E"),
    _institution("ocbc", "Bank OCBC", BANK_CONVENTIONAL, "028", None,
                 ["ocbc", "nyala"], "#C8102E"),
    _institution("maybank", "Maybank", BANK_CONVENTIONAL, "016", None,
                 ["maybank"], "#0B4A9B"),
    _institution("panin", "Bank Panin", BANK_CONVENTIONAL, "019", None,
                 ["panin"], "#0C4DA2"),
    _institution("dbs", "Bank DBS", BANK_CONVENTIONAL, "046", None,
                 ["dbs", "digibank"], "#D0202E"),
    _institution("uob", "Bank UOB", BANK_CONVENTIONAL, "023", None,
                 ["uob", "tmrw"], "#00539B"),
    _institution("hsbc", "HSBC", BANK_CONVENTIONAL, "087", None,
                 ["hsbc"], "#DB0011"),

    # --- the digital banks ----------------------------------------------
    _institution("jago", "Bank Jago", BANK_DIGITAL, "542", 12,
                 ["jago", "kantong jago"], "#0F9D58"),
    _institution("seabank", "SeaBank", BANK_DIGITAL, "535", 12,
                 ["seabank", "sea bank"], "#0A3D91"),
    _institution("blu", "blu by BCA Digital", BANK_DIGITAL, "501", 12,
                 ["blu", "bca digital"], "#0A4DA2"),
    _institution("allo", "Allo Bank", BANK_DIGITAL, "567", None,
                 ["allo", "allobank"], "#1E40AF"),
    _institution("superbank", "Superbank", BANK_DIGITAL, "562", None,
                 ["superbank"], "#0E7490"),
    _institution("bnc", "Bank Neo Commerce", BANK_DIGITAL, "490", None,
                 ["bnc", "neobank", "neo commerce"], "#DB2777"),
    _institution("saqu", "Bank Saqu", BANK_DIGITAL, "548", None,
                 ["saqu"], "#059669"),
    _institution("krom", "Krom Bank", BANK_DIGITAL, "459", None,
                 ["krom"], "#4338CA"),
    _institution("linebank", "Line Bank", BANK_DIGITAL, "484", None,
                 ["line bank", "hanabank", "hana"], "#06C755"),
    _institution("raya", "Bank Raya", BANK_DIGITAL, "494", None,
                 ["raya", "bank raya"], "#B91C1C"),
    _institution("jenius", "Jenius SMBC", BANK_DIGITAL, "213", None,
                 ["jenius", "btpn"], "#1D4ED8"),

    # --- the Islamic banks and the regional ones -----------------------
    _institution("bsi", "Bank Syariah Indonesia", BANK_SYARIAH, "451", None,
                 ["bsi", "byond", "bank syariah indonesia"], "#007A33"),
    _institution("muamalat", "Bank Muamalat", BANK_SYARIAH, "147", None,
                 ["muamalat"], "#0F766E"),
    _institution("bca_syariah", "BCA Syariah", BANK_SYARIAH, "536", None,
                 ["bca syariah", "bcas"], "#1B7B3E"),
    _institution("mega_syariah", "Bank Mega Syariah", BANK_SYARIAH, "506", None,
                 ["mega syariah", "bms"], "#C8102E"),
    _institution("aladin", "Bank Aladin Syariah", BANK_SYARIAH, "947", None,
                 ["aladin", "bank aladin"], "#F59E0B"),
    _institution("bank_dki", "Bank DKI", BANK_BPD, "111", None,
                 ["dki", "jakone", "bank dki"], "#C8102E"),
    _institution("bjb", "Bank BJB", BANK_BPD, "110", None,
                 ["bjb"], "#0C7C3F"),
    _institution("bank_jateng", "Bank Jateng", BANK_BPD, "113", None,
                 ["jateng"], "#0B4A9B"),
    _institution("bank_jatim", "Bank Jatim", BANK_BPD, "114", None,
                 ["jatim"], "#0A4DA2"),
    _institution("bpd_bali", "BPD Bali", BANK_BPD, "129", None,
                 ["bpd bali", "bali"], "#1E3A8A"),

    # --- the e-wallets --------------------------------------------------
    _institution("gopay", "GoPay", EWALLET, None, None,
                 ["gopay", "gojek"], "#00A99D",
                 number_kind="phone", topup_fee=1000),
    _institution("ovo", "OVO", EWALLET, None, None,
                 ["ovo"], "#4C2A85",
                 number_kind="phone", topup_fee=1000, va_prefix="39358"),
    _institution("dana", "DANA", EWALLET, None, None,
                 ["dana"], "#1188FF",
                 number_kind="phone", topup_fee=500, va_prefix="3901"),
    _institution("shopeepay", "ShopeePay", EWALLET, None, None,
                 ["shopeepay", "spay", "shopee pay"], "#EE4D2D",
                 number_kind="phone", topup_fee=1000, va_prefix="122"),
    _institution("linkaja", "LinkAja", EWALLET, None, None,
                 ["linkaja", "link aja"], "#0C7C3F",
                 number_kind="phone", topup_fee=1000),
    _institution("isaku", "i.saku", EWALLET, None, None,
                 ["isaku", "i.saku"], "#005EB8",
                 number_kind="phone", topup_fee=1000),
    _institution("astrapay", "AstraPay", EWALLET, None, None,
                 ["astrapay", "astra pay"], "#E4002B",
                 number_kind="phone", topup_fee=1000),
    _institution("doku", "DOKU", EWALLET, None, None,
                 ["doku"], "#0F9D58",
                 number_kind="phone", topup_fee=1000),
    _institution("paypal", "PayPal", EWALLET, None, None,
                 ["paypal"], "#003087",
                 number_kind="email", topup_fee=1000),

    # --- the tap cards ---------------------------------------------------
    _institution("flazz", "BCA Flazz", EMONEY_CARD, None, 16,
                 ["flazz", "bca flazz"], "#0A4DA2", number_kind="card"),
    _institution("emoney", "Mandiri e-money", EMONEY_CARD, None, None,
                 ["emoney", "e-money", "etoll", "mandiri emoney"], "#0B4A9B",
                 number_kind="card"),
    _institution("brizzi", "BRI Brizzi", EMONEY_CARD, None, None,
                 ["brizzi", "bri brizzi"], "#0C7C3F", number_kind="card"),
    _institution("tapcash", "BNI TapCash", EMONEY_CARD, None, None,
                 ["tapcash", "tap cash"], "#F26522", number_kind="card"),
    _institution("jaklingko", "JakLingko / KMT", EMONEY_CARD, None, None,
                 ["kmt", "jaklingko", "jak lingko"], "#1D4ED8", number_kind="card"),

    # --- the operators ---------------------------------------------------
    _institution("telkomsel", "Telkomsel / by.U", PULSA_TELCO, None, None,
                 ["telkomsel", "tsel", "simpati", "halo", "byu", "by.u"],
                 "#E2001A", number_kind="phone",
                 prefixes=["0811", "0812", "0813", "0821", "0822", "0823",
                           "0851", "0852", "0853"]),
    _institution("indosat", "Indosat IM3 / Tri (3)", PULSA_TELCO, None, None,
                 ["indosat", "im3", "tri", "kartu 3", "bima+"],
                 "#F8B500", number_kind="phone",
                 prefixes=["0814", "0815", "0816", "0855", "0856", "0857", "0858",
                           "0895", "0896", "0897", "0898", "0899"]),
    _institution("xl", "XL / AXIS", PULSA_TELCO, None, None,
                 ["xl", "axis", "myxl", "axisnet"],
                 "#4E2A84", number_kind="phone",
                 prefixes=["0817", "0818", "0819", "0859", "0877", "0878",
                           "0831", "0832", "0833", "0838"]),
    _institution("smartfren", "Smartfren", PULSA_TELCO, None, None,
                 ["smartfren", "sf"],
                 "#E4002B", number_kind="phone",
                 prefixes=["0881", "0882", "0883", "0884", "0885", "0886",
                           "0887", "0888", "0889"]),

    # --- the paylater ----------------------------------------------------
    _institution("spaylater", "SPayLater", PAYLATER_CREDIT, None, None,
                 ["spaylater", "shopee paylater"], "#EE4D2D"),
    _institution("gopaylater", "GoPayLater", PAYLATER_CREDIT, None, None,
                 ["gopaylater", "gopay later"], "#00A99D"),
    _institution("kredivo", "Kredivo", PAYLATER_CREDIT, None, None,
                 ["kredivo"], "#5B2C8D"),
    _institution("akulaku", "Akulaku", PAYLATER_CREDIT, None, None,
                 ["akulaku"], "#0C7C3F"),
    _institution("indodana", "Indodana", PAYLATER_CREDIT, None, None,
                 ["indodana"], "#1D4ED8"),
    _institution("traveloka", "Traveloka PayLater", PAYLATER_CREDIT, None, None,
                 ["traveloka paylater", "traveloka"], "#3C1053"),
    _institution("homecredit", "Home Credit", PAYLATER_CREDIT, None, None,
                 ["home credit", "homecredit"], "#C8102E"),
    _institution("atome", "Atome", PAYLATER_CREDIT, None, None,
                 ["atome"], "#F59E0B"),

    # --- the cash ---------------------------------------------------------
    _institution("cash", "Tunai / Cash", CASH, None, None,
                 ["tunai", "cash"], "#78716C", number_kind="none"),
]

BY_ID: Dict[str, Dict[str, Any]] = {i["id"]: i for i in INSTITUTIONS}

#: Every alias, lowercased, mapped to the institution it names.
_ALIAS_INDEX: Dict[str, Dict[str, Any]] = {}
for _institution_row in INSTITUTIONS:
    for _alias in _institution_row["aliases"]:
        _ALIAS_INDEX[_alias.lower()] = _institution_row
    # The name itself is an alias too.
    _ALIAS_INDEX.setdefault(_institution_row["name"].lower(), _institution_row)


# ---------------------------------------------------------------------------
# The transfer rails
# ---------------------------------------------------------------------------

SESAMA_BANK = "SESAMA_BANK"
BI_FAST = "BI_FAST"
RTOL_ONLINE = "RTOL_ONLINE"
TOPUP_EWALLET = "TOPUP_EWALLET"
QRIS = "QRIS"

#: The rails, and what each one costs.
TRANSFER_METHODS: List[Dict[str, Any]] = [
    {
        "id": SESAMA_BANK,
        "name": "Sesama Bank",
        "fee": 0,
        "kind": "transfer",
        "note": "Gratis Rp 0",
    },
    {
        "id": BI_FAST,
        "name": "BI-FAST",
        "fee": 2500,
        "kind": "transfer",
        "note": "Biaya Rp 2.500",
    },
    {
        "id": RTOL_ONLINE,
        "name": "RTOL Online",
        "fee": 6500,
        "kind": "transfer",
        "note": "Biaya Rp 6.500",
    },
    {
        "id": TOPUP_EWALLET,
        "name": "Top-Up E-Wallet",
        "fee": 1000,
        "kind": "topup",
        "note": "Biaya admin dari e-wallet tujuan",
    },
    {
        "id": QRIS,
        "name": "QRIS",
        "fee": 0,
        "kind": "qris",
        "note": "Gratis Rp 0",
        "mdr": 0.007,
    },
]

TRANSFER_METHOD_BY_ID: Dict[str, Dict[str, Any]] = {
    m["id"]: m for m in TRANSFER_METHODS
}


# ---------------------------------------------------------------------------
# Finding an institution in a line of Indonesian
# ---------------------------------------------------------------------------


def _normalise(text: str) -> str:
    """The text, in the shape the aliases are written in."""
    return re.sub(r"\s+", " ", (text or "").strip().lower())


def detect_provider_from_text(text: str) -> Optional[Dict[str, Any]]:
    """
    The institution a line of Indonesian names.

    "kopi jago 10rb gopay" names GoPay. "makan siang 35rb qris mybca"
    names BCA, by way of QRIS. "paket data tsel 50rb" names Telkomsel.

    The longest alias wins, so "bca digital" finds blu rather than
    BCA, and "shopee paylater" finds SPayLater rather than ShopeePay.

    Returns the institution, or nothing when the line names none.
    """
    haystack = _normalise(text)
    if not haystack:
        return None

    best: Optional[Dict[str, Any]] = None
    best_length = 0

    for alias, institution in _ALIAS_INDEX.items():
        if not alias:
            continue
        if len(alias) <= best_length:
            continue
        if re.search(r"(?<![a-z0-9])" + re.escape(alias) + r"(?![a-z0-9])", haystack):
            best = institution
            best_length = len(alias)

    if best is None:
        return None

    # The transfer rails are named too, and they are not institutions
    # - they are the way the money goes over. QRIS is returned on its
    # own, because a reader who types "qris" is saying how they paid,
    # not which account they paid from.
    if best["id"] == "qris":
        return None

    return best


def detect_transfer_method_from_text(text: str) -> Optional[Dict[str, Any]]:
    """The rail a line of Indonesian names, if it names one."""
    haystack = _normalise(text)
    if not haystack:
        return None

    if re.search(r"(?<![a-z0-9])qris(?![a-z0-9])", haystack):
        return TRANSFER_METHOD_BY_ID[QRIS]
    if re.search(r"(?<![a-z0-9])(bi-?fast|bifast)(?![a-z0-9])", haystack):
        return TRANSFER_METHOD_BY_ID[BI_FAST]
    if re.search(r"(?<![a-z0-9])rtol(?![a-z0-9])", haystack):
        return TRANSFER_METHOD_BY_ID[RTOL_ONLINE]

    return None


def detect_telco_by_phone_prefix(phone_number: str) -> Optional[Dict[str, Any]]:
    """
    The operator a phone number belongs to.

    Indonesian mobile numbers begin 08, and the next two digits say
    who the operator is. A number written the international way, with
    62 in front of it, is the same number.

    "081234567890" is Telkomsel. "081512345678" is Indosat. "087712345678"
    is XL. "088112345678" is Smartfren.

    Returns the operator, or nothing when the number is not one.
    """
    if not phone_number:
        return None

    digits = re.sub(r"\D", "", str(phone_number))

    # +62 812 3456 7890 is the same number as 0812 3456 7890.
    if digits.startswith("62"):
        digits = "0" + digits[2:]
    elif digits.startswith("8") and len(digits) >= 10:
        digits = "0" + digits

    if len(digits) < 4 or not digits.startswith("08"):
        return None

    prefix = digits[:4]
    for institution in INSTITUTIONS:
        if institution["kind"] != PULSA_TELCO:
            continue
        if prefix in institution["prefixes"]:
            return institution

    return None


# ---------------------------------------------------------------------------
# The number
# ---------------------------------------------------------------------------


def validate_account_number(provider_id: str, number: str) -> Dict[str, Any]:
    """
    Is the number the right shape, and how is it written?

    A bank account number is a number of a certain length. An e-wallet
    is a phone number. So the two are checked differently and are
    written differently.

    The answer is the number, whether it is right or not, the reason
    when it is wrong, and the way it should be shown.
    """
    institution = BY_ID.get((provider_id or "").lower())
    if institution is None:
        return {
            "valid": False,
            "formatted": (number or "").strip(),
            "error": "unknown_provider",
            "expected": None,
        }

    raw = (number or "").strip()
    digits = re.sub(r"\D", "", raw)

    kind = institution["number_kind"]

    if kind == "none":
        return {
            "valid": True,
            "formatted": raw,
            "error": None,
            "expected": None,
        }

    if kind == "phone":
        if digits.startswith("62"):
            digits = "0" + digits[2:]
        if not digits:
            return {
                "valid": False,
                "formatted": raw,
                "error": "empty",
                "expected": "08xx-xxxx-xxxx",
            }
        if not digits.startswith("08"):
            return {
                "valid": False,
                "formatted": raw,
                "error": "not_a_phone_number",
                "expected": "08xx-xxxx-xxxx",
            }
        if len(digits) < 10:
            return {
                "valid": False,
                "formatted": format_phone(digits),
                "error": "too_short",
                "expected": "08xx-xxxx-xxxx",
            }
        return {
            "valid": True,
            "formatted": format_phone(digits),
            "error": None,
            "expected": "08xx-xxxx-xxxx",
        }

    if kind == "email":
        if "@" not in raw:
            return {
                "valid": False,
                "formatted": raw,
                "error": "not_an_email",
                "expected": "nama@email.com",
            }
        return {
            "valid": True,
            "formatted": raw,
            "error": None,
            "expected": "nama@email.com",
        }

    # A card, or an account number.
    expected_digits = institution["digits"]
    if kind == "card":
        if len(digits) < 6:
            return {
                "valid": False,
                "formatted": raw,
                "error": "too_short",
                "expected": "Nomor kartu",
            }
        return {
            "valid": True,
            "formatted": format_card(digits),
            "error": None,
            "expected": "Nomor kartu",
        }

    # An account number.
    if not digits:
        return {
            "valid": False,
            "formatted": raw,
            "error": "empty",
            "expected": f"{expected_digits} digit" if expected_digits else "Nomor rekening",
        }
    if expected_digits and len(digits) != expected_digits:
        return {
            "valid": False,
            "formatted": format_account(digits, expected_digits),
            "error": "wrong_length",
            "expected": f"{expected_digits} digit",
        }
    return {
        "valid": True,
        "formatted": format_account(digits, expected_digits),
        "error": None,
        "expected": f"{expected_digits} digit" if expected_digits else "Nomor rekening",
    }


def format_account(digits: str, expected_digits: Optional[int] = None) -> str:
    """
    A bank account number, in the way it is written on the card.

    BCA is written 123-456-7890. BRI, which has fifteen digits, is
    written in groups of four. The grouping follows the length of the
    number, because the lengths differ and a fixed grouping would
    look wrong on half of them.
    """
    digits = re.sub(r"\D", "", digits or "")
    if not digits:
        return ""

    # Ten digits are written in three groups and then a last one:
    # 123-456-7890. Fifteen are written in groups of four:
    # 123-456-7890-1234.
    if expected_digits == 10:
        # Ten digits are 3-3-4: 123-456-7890.
        groups = [digits[i:i + 3] for i in range(0, 6, 3)]
        if len(digits) > 6:
            groups.append(digits[6:])
        return "-".join(groups)

    return "-".join(digits[i:i + 4] for i in range(0, len(digits), 4))


def format_phone(digits: str) -> str:
    """An Indonesian phone number, the way it is written."""
    digits = re.sub(r"\D", "", digits or "")
    if len(digits) < 4:
        return digits
    return "-".join([digits[:4], digits[4:8], digits[8:]])


def format_card(digits: str) -> str:
    """A card number, in groups of four."""
    digits = re.sub(r"\D", "", digits or "")
    return "-".join(digits[i:i + 4] for i in range(0, len(digits), 4))


# ---------------------------------------------------------------------------
# The fee
# ---------------------------------------------------------------------------


def transfer_fee(
    method_id: str,
    target_provider_id: Optional[str] = None,
    amount: Optional[float] = None,
) -> int:
    """
    What a transfer costs.

    The rail decides most of it. A top-up of an e-wallet is charged
    by the wallet, and the wallet decides: DANA is five hundred and
    GoPay is a thousand.

    A QRIS payment by a reader costs nothing. The seven tenths of a
    percent is what it costs the shop, and that is the shop's number
    and not the reader's.
    """
    method = TRANSFER_METHOD_BY_ID.get((method_id or "").upper())
    if method is None:
        return 0

    if method["id"] == TOPUP_EWALLET:
        target = BY_ID.get((target_provider_id or "").lower())
        if target and target.get("topup_fee") is not None:
            return int(target["topup_fee"])
        return int(method["fee"])

    if method["id"] == QRIS:
        # The reader pays nothing. The merchant pays the MDR.
        return 0

    return int(method.get("fee") or 0)


def merchant_mdr(method_id: str = QRIS) -> float:
    """What a shop pays when a reader pays it by QRIS."""
    method = TRANSFER_METHOD_BY_ID.get((method_id or "").upper())
    if method is None:
        return 0.0
    return float(method.get("mdr") or 0.0)


# ---------------------------------------------------------------------------
# The whole table, for the browser
# ---------------------------------------------------------------------------


def registry_for_client() -> Dict[str, Any]:
    """
    The table, in the shape the browser wants it.

    The browser keeps its own copy so that the account form can fill
    itself in without a request. This is how the two copies are kept
    the same.
    """
    return {
        "institutions": INSTITUTIONS,
        "groups": [{"kind": kind, "label": label} for kind, label in INSTITUTION_GROUPS],
        "transferMethods": TRANSFER_METHODS,
    }


def group_label(kind: str) -> str:
    """The name of a group of institutions."""
    for group_kind, label in INSTITUTION_GROUPS:
        if group_kind == kind:
            return label
    return kind


def institutions_in_group(kind: str) -> List[Dict[str, Any]]:
    """The institutions of one group."""
    return [i for i in INSTITUTIONS if i["kind"] == kind]


def find_institution(provider_id: str) -> Optional[Dict[str, Any]]:
    """One institution, by its id."""
    return BY_ID.get((provider_id or "").lower())


__all__ = [
    "BANK_CONVENTIONAL", "BANK_DIGITAL", "BANK_SYARIAH", "BANK_BPD",
    "EWALLET", "EMONEY_CARD", "PULSA_TELCO", "PAYLATER_CREDIT", "CASH",
    "INSTITUTION_GROUPS", "INSTITUTIONS", "BY_ID",
    "SESAMA_BANK", "BI_FAST", "RTOL_ONLINE", "TOPUP_EWALLET", "QRIS",
    "TRANSFER_METHODS", "TRANSFER_METHOD_BY_ID",
    "detect_provider_from_text", "detect_transfer_method_from_text",
    "detect_telco_by_phone_prefix", "validate_account_number",
    "format_account", "format_phone", "format_card",
    "transfer_fee", "merchant_mdr",
    "registry_for_client", "group_label", "institutions_in_group",
    "find_institution",
]
