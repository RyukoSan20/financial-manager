"""
What an account of a given currency is called, and where it is held.

The reader can hold money in more than one currency. Two savings
accounts do not have to be the same thing: a rupiah savings account at
a local bank is not a yen savings account at a Japanese bank. The
type of holding and the place it is held both follow from the currency
and the kind of account.

This module holds that knowledge, so the interface, the backend and
the suggestions all agree on it.
"""

from __future__ import annotations

from typing import Dict, List, Optional

from app.services.currency import SUPPORTED


# The kinds of holding there are, and what they are called in each
# currency. The name is built from a per currency phrase, because
# "tabungan" is not a word in Japanese, and a yen account should not
# be called "tabungan" in the interface.
#
# Each entry is:
#   label      the name of this kind of holding, per currency
#   banks      the places this kind of holding is usually kept at
KIND_LABELS: Dict[str, Dict[str, str]] = {
    "cash": {
        "IDR": "Dompet Tunai", "USD": "Cash Wallet", "EUR": "Cash Wallet",
        "JPY": "現金ウォレット", "GBP": "Cash Wallet", "AUD": "Cash Wallet",
    },
    "bank": {
        "IDR": "Rekening Bank", "USD": "Bank Account", "EUR": "Bank Account",
        "JPY": "銀行口座", "GBP": "Bank Account", "AUD": "Bank Account",
    },
    "savings": {
        "IDR": "Tabungan", "USD": "Savings Account", "EUR": "Savings Account",
        "JPY": "普通預金", "GBP": "Savings Account", "AUD": "Savings Account",
    },
    "e-wallet": {
        "IDR": "Dompet Digital", "USD": "Digital Wallet", "EUR": "Digital Wallet",
        "JPY": "電子マネー", "GBP": "Digital Wallet", "AUD": "Digital Wallet",
    },
    "credit_card": {
        "IDR": "Kartu Kredit", "USD": "Credit Card", "EUR": "Credit Card",
        "JPY": "クレジットカード", "GBP": "Credit Card", "AUD": "Credit Card",
    },
    "investment": {
        "IDR": "Rekening Investasi", "USD": "Investment Account",
        "EUR": "Investment Account", "JPY": "投資口座", "GBP": "Investment Account",
        "AUD": "Investment Account",
    },
}

# Where a holding of this kind is usually kept, per currency. These
# are the well known places in each country, so a new account can be
# set up without the reader having to remember the name of their bank.
KIND_BANKS: Dict[str, Dict[str, List[str]]] = {
    "savings": {
        "IDR": ["Bank Indonesia", "Bank Rakyat Indonesia", "Bank Negara Indonesia",
                "Bank Mandiri", "Bank Central Asia", "Bank Syariah"],
        "USD": ["Chase", "Bank of America", "Wells Fargo", "Citibank"],
        "EUR": ["Deutsche Bank", "BNP Paribas", "Crédit Agricole", "ING"],
        "JPY": ["三菱UFJ銀行", "三井住友銀行", "みずほ銀行", "りそな銀行"],
        "GBP": ["Barclays", "HSBC", "Lloyds Bank", "NatWest"],
        "AUD": ["Commonwealth Bank", "Westpac", "ANZ", "NAB"],
    },
    "bank": {
        "IDR": ["Bank Central Asia", "Bank Mandiri", "Bank Rakyat Indonesia",
                "Bank Negara Indonesia"],
        "USD": ["Chase", "Bank of America", "Wells Fargo"],
        "EUR": ["Deutsche Bank", "BNP Paribas", "ING"],
        "JPY": ["三菱UFJ銀行", "三井住友銀行", "みずほ銀行"],
        "GBP": ["Barclays", "HSBC", "Lloyds Bank"],
        "AUD": ["Commonwealth Bank", "Westpac", "ANZ"],
    },
    "investment": {
        "IDR": ["Bareksa", "Stockbit", "Mirae Asset", "Sucorinvest"],
        "USD": ["Vanguard", "Fidelity", "Charles Schwab", "Interactive Brokers"],
        "EUR": ["Trade Republic", "Scalable Capital", "DEGIRO"],
        "JPY": ["SBI証券", "楽天証券", "大和証券", "Nomura"],
        "GBP": ["Vanguard", "AJ Bell", " Hargrove Neville"],
        "AUD": ["Vanguard", "CommSec", "Macquarie"],
    },
    "e-wallet": {
        "IDR": ["GoPay", "OVO", "DANA", "ShopeePay", "LinkAja"],
        "USD": ["PayPal", "Cash App", "Venmo"],
        "EUR": ["PayPal", "Revolut", "Wise"],
        "JPY": ["PayPay", "楽天ペイ", "d払い", "LINE Pay"],
        "GBP": ["PayPal", "Revolut", "Wise"],
        "AUD": ["PayPal", "Revolut", "Wise"],
    },
}

# The default holding name for a currency and kind. Used when the
# reader does not name the account themselves.
DEFAULT_NAMES: Dict[str, Dict[str, str]] = {
    "cash": {
        "IDR": "Dompet Tunai", "USD": "Cash Wallet", "EUR": "Cash Wallet",
        "JPY": "現金ウォレット", "GBP": "Cash Wallet", "AUD": "Cash Wallet",
    },
    "bank": {
        "IDR": "Rekening Bank", "USD": "Bank Account", "EUR": "Bank Account",
        "JPY": "銀行口座", "GBP": "Bank Account", "AUD": "Bank Account",
    },
    "savings": {
        "IDR": "Tabungan", "USD": "Savings Account", "EUR": "Savings Account",
        "JPY": "普通預金", "GBP": "Savings Account", "AUD": "Savings Account",
    },
    "e-wallet": {
        "IDR": "Dompet Digital", "USD": "Digital Wallet", "EUR": "Digital Wallet",
        "JPY": "電子マネー", "GBP": "Digital Wallet", "AUD": "Digital Wallet",
    },
    "credit_card": {
        "IDR": "Kartu Kredit", "USD": "Credit Card", "EUR": "Credit Card",
        "JPY": "クレジットカード", "GBP": "Credit Card", "AUD": "Credit Card",
    },
    "investment": {
        "IDR": "Rekening Investasi", "USD": "Investment Account",
        "EUR": "Investment Account", "JPY": "投資口座", "GBP": "Investment Account",
        "AUD": "Investment Account",
    },
}


def _fallback_label(kind: str, currency: str) -> str:
    """The name of a kind of holding, in the language of the currency.

    A currency that is not one of the ones with a phrase of its own
    falls back to the English name, which is a word in most of the
    languages the app is used in.
    """
    labels = KIND_LABELS.get(kind, {})
    if currency in labels:
        return labels[currency]

    # Try the English name of the currency, which most readers will
    # recognise.
    english = {
        "IDR": "IDR", "USD": "USD", "EUR": "EUR", "JPY": "JPY",
        "GBP": "GBP", "AUD": "AUD", "SGD": "SGD", "MYR": "MYR",
        "CNY": "CNY", "INR": "INR", "THB": "THB", "PHP": "PHP",
        "KRW": "KRW", "VND": "VND", "HKD": "HKD", "CAD": "CAD",
        "CHF": "CHF", "NZD": "NZD", "SEK": "SEK", "NOK": "NOK",
        "DKK": "DKK", "MXN": "MXN", "BRL": "BRL", "ZAR": "ZAR",
    }.get(currency, currency)

    english_label = labels.get("USD") or kind.replace("_", " ").title()
    return f"{english_label} ({english})"


def account_kind_label(kind: str, currency: str) -> str:
    """The name of a kind of holding, in the words of its currency."""
    currency = (currency or "IDR").upper()
    return _fallback_label(kind, currency)


def default_account_name(kind: str, currency: str) -> str:
    """The name a new account of this kind and currency is given."""
    currency = (currency or "IDR").upper()
    names = DEFAULT_NAMES.get(kind, {})
    if currency in names:
        return names[currency]
    return _fallback_label(kind, currency)


def suggested_banks(kind: str, currency: str) -> List[str]:
    """The places a holding of this kind is usually kept in this currency."""
    currency = (currency or "IDR").upper()
    banks = KIND_BANKS.get(kind, {})
    if currency in banks:
        return list(banks[currency])
    # Fall back to the banks of the closest currency the app knows.
    for fallback in ("IDR", "USD"):
        if fallback in banks:
            return list(banks[fallback])
    return []


def account_options(currency: str) -> List[dict]:
    """Every kind of holding there is for a currency, with its name.

    This is what the interface shows when a new account is set up. The
    list is the same for every currency, but the names and the banks
    follow the currency.
    """
    currency = (currency or "IDR").upper()
    options = []
    for kind in ("cash", "bank", "savings", "e-wallet", "credit_card", "investment"):
        options.append({
            "kind": kind,
            "label": account_kind_label(kind, currency),
            "default_name": default_account_name(kind, currency),
            "banks": suggested_banks(kind, currency),
            "currency": currency,
        })
    return options


def currency_is_known(currency: Optional[str]) -> bool:
    return (currency or "").upper() in SUPPORTED
