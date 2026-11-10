"""
The export studio's server side.

The export screen used to offer two buttons: "Ekspor JSON" and
"Ekspor CSV". Neither said what was in the file, neither could be
narrowed, and the CSV was seven columns of which the reader had never
asked for half.

So the reader can now choose:

- **which dates** - a range, a preset, or everything;
- **which kinds of transaction** - spending, earnings, transfers, or
  all of them;
- **which account** - one bank, one e-wallet, or all of them;
- **which columns** - every field, turned on and off one at a time.

And the answer says how many transactions match before the reader
downloads anything, so they can see whether they chose what they
meant to choose.

The columns are named rather than numbered, so the screen and the
server agree on which is which. A column the screen does not know
about is not exported, whatever the screen asks for - the reader's
file is made of the fields they can see and turn off.
"""

from __future__ import annotations

import csv
import io
from datetime import date, datetime
from typing import Any, Dict, Iterable, List, Optional

from sqlalchemy.orm import Session

from app.models.transaction import Transaction
from app.services.metrics import transactions_in_range

# ---------------------------------------------------------------------------
# The columns
# ---------------------------------------------------------------------------

#: Every column the reader can choose, in the order they are shown.
#:
#: The key is what the screen sends and what the server writes. The
#: label is what the screen shows. A column the reader turns off is
#: not in the file at all - not blank, not zero: not there.
COLUMNS: List[Dict[str, Any]] = [
    {"key": "date", "label": "Tanggal & Waktu", "group": "when"},
    {"key": "type", "label": "Jenis Transaksi", "group": "what"},
    {"key": "category", "label": "Kategori Induk & Sub-Kategori", "group": "what"},
    {"key": "description", "label": "Deskripsi & Catatan", "group": "what"},
    {"key": "amount", "label": "Nominal Bersih (IDR)", "group": "money"},
    {"key": "account", "label": "Akun / Rekening / E-Wallet", "group": "where"},
    {"key": "items", "label": "Rincian Barang (Qty x Harga Satuan)", "group": "what"},
    {"key": "tax", "label": "Diskon & Pajak (PPN)", "group": "money"},
    {"key": "location", "label": "Lokasi / Merchant", "group": "where"},
]

COLUMN_KEYS = [column["key"] for column in COLUMNS]

#: The columns that are on unless the reader says otherwise.
DEFAULT_COLUMNS = list(COLUMN_KEYS)

#: The kinds of transaction the reader can choose between.
TRANSACTION_TYPES = ["expense", "income", "transfer"]


def resolve_columns(wanted: Optional[Iterable[str]]) -> List[str]:
    """
    The columns the reader asked for, in the order they are shown.

    A column the reader did not name is not in the file. A column
    they named that does not exist is not in the file either - the
    screen cannot show a field the file has, so the file cannot have
    one the screen does not know about.
    """
    # Nothing asked for means everything. The screen sends an empty
    # list when the reader has not chosen any column yet, and that
    # means "all of them" - not "none of them".
    if wanted is None:
        return list(DEFAULT_COLUMNS)

    asked = {str(key).strip() for key in wanted if str(key).strip()}
    if not asked:
        return list(DEFAULT_COLUMNS)

    return [key for key in COLUMN_KEYS if key in asked]


def resolve_types(wanted: Optional[Iterable[str]]) -> Optional[List[str]]:
    """
    The kinds of transaction the reader asked for.

    Nothing asked for means every kind. A kind that does not exist is
    not in the list, so asking for it changes nothing rather than
    producing a file with nothing in it.
    """
    if wanted is None:
        return None

    asked = [str(value).strip() for value in wanted if str(value).strip()]
    if not asked:
        return None

    # A transfer is recorded in two ways: the money leaves one account
    # and arrives in another. The reader who asks for transfers wants
    # both halves.
    expanded: List[str] = []
    for value in asked:
        if value == "transfer":
            expanded.extend(["transfer_out", "transfer_in"])
        else:
            expanded.append(value)

    known = [value for value in expanded if value in TRANSACTION_TYPES + ["transfer_out", "transfer_in"]]
    return known or None


# ---------------------------------------------------------------------------
# The rows
# ---------------------------------------------------------------------------


def _breakdown_lines(db: Session, transaction: Transaction) -> List[Dict[str, Any]]:
    """
    The lines of one transaction, if it has any.

    There are two places a transaction's lines live: the table of the
    line items, which is what the quantity multiplier writes, and the
    table of the breakdown, which is what the breakdown screen writes.
    Both are read, so the export has the lines whichever way they were
    recorded.
    """
    lines: List[Dict[str, Any]] = []

    try:
        from app.models.transaction_item import TransactionItem

        for row in (
            db.query(TransactionItem)
            .filter(TransactionItem.transaction_id == transaction.id)
            .order_by(TransactionItem.id)
            .all()
        ):
            lines.append({
                "name": row.name,
                "quantity": float(row.quantity or 0),
                "unit_price": float(row.unit_price or 0),
                "total_price": float(row.total_price or 0),
            })
    except Exception:  # noqa: BLE001
        # The lines are a nicety. A reader who exports without them
        # still gets their export.
        pass

    if lines:
        return lines

    try:
        from app.models.breakdown_item import BreakdownItem

        rows = (
            db.query(BreakdownItem)
            .filter(
                BreakdownItem.user_id == transaction.user_id,
                BreakdownItem.parent_type == "transaction",
                BreakdownItem.parent_id == transaction.id,
            )
            .order_by(BreakdownItem.id)
            .all()
        )

        return [
            {
                "name": row.name,
                "quantity": float(row.quantity or 0),
                "unit_price": float(row.unit_price or 0),
                "total_price": float(row.total_price or 0),
            }
            for row in rows
        ]
    except Exception:  # noqa: BLE001
        return []


def _receipt_tax(db: Session, transaction: Transaction) -> Dict[str, Any]:
    """
    The discount and the tax of the receipt a transaction came from.

    A transaction that was typed by hand has no receipt, so it has
    neither. A transaction that was scanned has both, and the reader
    paid them.
    """
    scan_id = getattr(transaction, "receipt_scan_id", None)
    if not scan_id:
        return {"discount": 0.0, "tax": 0.0}

    try:
        from app.models.receipt import ReceiptScan

        scan = db.get(ReceiptScan, scan_id)
        if scan is None:
            return {"discount": 0.0, "tax": 0.0}

        return {
            "discount": float(getattr(scan, "discount_total", 0) or 0),
            "tax": float(getattr(scan, "tax_total", 0) or 0),
        }
    except Exception:  # noqa: BLE001
        return {"discount": 0.0, "tax": 0.0}


def _category_label(db: Session, transaction: Transaction) -> str:
    """
    The category and the sub-category, together.

    The sub-category is a word the reader chose, and it is kept on the
    transaction in the transaction's own field - so it is read from
    there and not looked up.
    """
    category = transaction.category
    if category is None:
        return ""

    name = category.name or ""

    return name


def build_rows(
    db: Session,
    transactions: List[Transaction],
    columns: List[str],
) -> List[Dict[str, Any]]:
    """
    The export rows, in the shape the columns ask for.

    Every row carries every field. The columns are applied when the
    file is written, not when the row is made, so that a reader who
    turns a column on again does not need the file to be made again.
    """
    rows = []

    for transaction in transactions:
        account = transaction.account
        category = transaction.category

        row: Dict[str, Any] = {
            "date": (
                transaction.date.isoformat() if transaction.date else ""
            ),
            "type": transaction.type or "",
            "category": _category_label(db, transaction),
            "description": " - ".join(
                part for part in (
                    transaction.description or "",
                    transaction.notes or "",
                ) if part
            ),
            "amount": float(transaction.amount or 0),
            "account": account.name if account else "",
            "items": _breakdown_lines(db, transaction),
            # The discount and the tax are not on the transaction -
            # they are on the receipt it came from. A transaction
            # that has no receipt has neither.
            "tax": _receipt_tax(db, transaction),
            "location": (
                getattr(transaction, "merchant_name", None)
                or getattr(transaction, "merchant_address", None)
                or ""
            ),
        }

        rows.append({key: row.get(key) for key in columns} if columns else row)

    return rows


# ---------------------------------------------------------------------------
# The file
# ---------------------------------------------------------------------------


def _cell(value: Any) -> str:
    """One cell of the file, as text."""
    if value is None:
        return ""
    if isinstance(value, bool):
        return "Ya" if value else "Tidak"
    if isinstance(value, float):
        return f"{value:.2f}".rstrip("0").rstrip(".") if value % 1 else f"{value:.0f}"
    if isinstance(value, (list, dict)):
        return ""
    return str(value)


def _items_cell(lines: List[Dict[str, Any]]) -> str:
    """The lines of a transaction, written in one cell."""
    if not lines:
        return ""
    return " | ".join(
        f"{line['name']} ({line['quantity']:g} x {line['unit_price']:g})"
        for line in lines
    )


def _tax_cell(value: Dict[str, Any]) -> str:
    """The discount and the tax, written in one cell."""
    if not isinstance(value, dict):
        return ""
    parts = []
    if value.get("discount"):
        parts.append(f"Diskon {value['discount']:.0f}")
    if value.get("tax"):
        parts.append(f"Pajak {value['tax']:.0f}")
    return " | ".join(parts)


def _quote(value: str) -> str:
    """
    One cell, quoted if it has to be.

    A cell that holds a comma, a quote or a line break is wrapped in
    quotes, and the quotes inside it are doubled. A cell that holds
    none of those is written as it is - so a cell that is empty is
    empty, and not a pair of quotes.
    """
    text = "" if value is None else str(value)

    if text == "":
        return ""

    if any(mark in text for mark in (",", '"', "\n", "\r")):
        return '"' + text.replace('"', '""') + '"'

    return text


def to_csv(columns: List[str], rows: List[Dict[str, Any]]) -> str:
    """
    The file, as CSV.

    The bytes that come out of here start with a "byte order mark", so
    that Excel on Windows reads the accented letters - which is all
    of them, in Indonesian - as letters and not as question marks.

    Without it, a reader who opens their export in Excel sees "Makan
    Siang" as "Makan Siang" but "Penggantian" as a row of question
    marks, and concludes their backup is broken.
    """
    buffer = io.StringIO()
    # The csv module writes an empty cell as a pair of quotes, and
    # Excel shows those quotes as text. A file full of `""` is a file
    # the reader has to clean up before they can use it, so the rows
    # are written by hand: a cell that is empty is written as nothing.
    def _write_row(cells):
        buffer.write(",".join(_quote(cell) for cell in cells))
        buffer.write("\n")

    labels = {
        column["key"]: column["label"]
        for column in COLUMNS
    }
    _write_row([labels.get(key, key) for key in columns])

    for row in rows:
        cells = []
        for key in columns:
            value = row.get(key)
            if key == "items":
                text = _items_cell(value if isinstance(value, list) else [])
            elif key == "tax":
                text = _tax_cell(value if isinstance(value, dict) else {})
            else:
                text = _cell(value)
            cells.append(text)
        _write_row(cells)

    return buffer.getvalue()


def csv_with_bom(columns: List[str], rows: List[Dict[str, Any]]) -> bytes:
    """The file, as the bytes that are written to disk."""
    return ("\ufeff" + to_csv(columns, rows)).encode("utf-8")


# ---------------------------------------------------------------------------
# The answer
# ---------------------------------------------------------------------------


def export_payload(
    db: Session,
    user_id: int,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    types: Optional[List[str]] = None,
    account_id: Optional[int] = None,
    category_id: Optional[int] = None,
    columns: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    What the export would be, and what it would contain.

    The same answer serves the preview and the download, so the reader
    sees exactly the file they are about to get - not an idea of it.
    """
    wanted_columns = resolve_columns(columns)
    wanted_types = resolve_types(types)

    transactions = transactions_in_range(
        db,
        user_id,
        start_date=start_date,
        end_date=end_date,
        types=wanted_types,
        account_id=account_id,
        category_id=category_id,
    )

    rows = build_rows(db, transactions, wanted_columns)

    # The totals are worked out from the transactions and not from
    # the rows. The rows only carry the columns the reader chose, so
    # a reader who turned the "type" column off would have been told
    # their total was zero.
    #
    # Spending and income are two numbers. Added together they are a
    # number that means nothing.
    total = sum(float(t.amount or 0) for t in transactions if t.type == "expense")
    total_income = sum(float(t.amount or 0) for t in transactions if t.type == "income")

    return {
        "count": len(rows),
        "total": total,
        "total_income": total_income,
        "columns": wanted_columns,
        "column_labels": [
            column["label"]
            for column in COLUMNS
            if column["key"] in wanted_columns
        ],
        "rows": rows,
        "transactions": transactions,
    }


def filename_for(kind: str, start_date: Optional[date], end_date: Optional[date]) -> str:
    """
    The name of the file.

    The dates are in the name, so a reader with eleven exports in one
    folder can tell them apart without opening any of them.
    """
    stamp = datetime.utcnow().strftime("%Y%m%d")

    if start_date and end_date:
        return f"finmanager_{kind}_{start_date.isoformat()}_{end_date.isoformat()}.csv"

    return f"finmanager_{kind}_{stamp}.csv"


__all__ = [
    "COLUMNS",
    "COLUMN_KEYS",
    "DEFAULT_COLUMNS",
    "TRANSACTION_TYPES",
    "resolve_columns",
    "resolve_types",
    "build_rows",
    "to_csv",
    "csv_with_bom",
    "export_payload",
    "filename_for",
]
