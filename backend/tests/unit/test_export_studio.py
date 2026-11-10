"""
The export studio.

The settings screen used to offer two buttons: "Ekspor JSON" and
"Ekspor CSV". Neither said what was in the file. The CSV was seven
columns, and the reader had never asked for half of them - and there
was no way to say "just October" or "just my spending".

So now the reader chooses:

- which dates;
- which kinds of transaction;
- which account;
- which columns;

and the screen shows them how many transactions match and what they
add up to before anything is downloaded.

What is held here:

- a column the reader turns off is not in the file - not blank, not
  zero: not there;
- a column the screen does not know about is not in the file either,
  whatever the request asks for;
- the file starts with a byte order mark, so that Excel on Windows
  reads the accented letters as letters and not as question marks;
- the transfer is both halves - the money leaving and the money
  arriving - when the reader asks for transfers;
- the lines of a transaction are in the file, and the discount and the
  tax are in the file;
- and the dates, the kinds and the account are applied together, not
  one at a time.

Nothing here touches the production server or a real database.
"""

import sys
from datetime import date
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[2]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.services import export_service  # noqa: E402


# ---------------------------------------------------------------------------
# The columns
# ---------------------------------------------------------------------------

def test_every_column_is_named_and_has_a_label():
    """The screen shows a label, and the file has a heading."""
    for column in export_service.COLUMNS:
        assert column["key"], "a column has no key"
        assert column["label"], f"{column['key']} has no label"


def test_the_columns_the_task_asks_for_are_all_there():
    """The nine fields the reader is offered.

    The reader has to be able to turn off any one of them, and has to
    be able to turn on the ones they want. So all nine are here.
    """
    wanted = {
        "date", "type", "category", "description", "amount",
        "account", "items", "tax", "location",
    }
    assert wanted.issubset(set(export_service.COLUMN_KEYS))


def test_a_column_the_reader_turns_off_is_not_in_the_file():
    """Turned off means gone, not blank.

    A column that is there but empty is a column the reader has to
    delete by hand before they can use the file. A column that is not
    there is a file with only what they asked for.
    """
    assert export_service.resolve_columns(["date", "amount"]) == ["date", "amount"]
    assert export_service.resolve_columns(["amount", "date"]) == ["date", "amount"]


def test_a_column_that_does_not_exist_is_not_in_the_file():
    """The screen cannot show a field the file has, so the file cannot
    have one the screen does not know about."""
    resolved = export_service.resolve_columns(["date", "not_a_column", "amount"])
    assert resolved == ["date", "amount"]


def test_no_columns_asked_for_means_every_column():
    """Nothing asked for means everything, which is what a list of
    nothing says when the reader has not chosen yet."""
    assert export_service.resolve_columns(None) == export_service.DEFAULT_COLUMNS
    assert export_service.resolve_columns([]) == export_service.DEFAULT_COLUMNS


def test_the_columns_keep_the_order_they_are_shown_in():
    """The file's columns are in the order the screen lists them, so
    the preview looks like the file."""
    resolved = export_service.resolve_columns(["amount", "date", "type"])
    assert resolved == ["date", "type", "amount"]


# ---------------------------------------------------------------------------
# The kinds
# ---------------------------------------------------------------------------

def test_a_transfer_is_both_halves():
    """The money leaving and the money arriving.

    A transfer is recorded in two rows: one where the money leaves and
    one where it arrives. A reader who asks for transfers wants both,
    not just the half that leaves.
    """
    resolved = export_service.resolve_types(["transfer"])
    assert "transfer_out" in resolved
    assert "transfer_in" in resolved


def test_no_kinds_asked_for_means_every_kind():
    assert export_service.resolve_types(None) is None
    assert export_service.resolve_types([]) is None


def test_a_kind_that_does_not_exist_changes_nothing():
    """Asking for a kind that does not exist does not produce a file
    with nothing in it."""
    assert export_service.resolve_types(["not_a_type"]) is None


def test_a_spending_kind_is_itself():
    resolved = export_service.resolve_types(["expense", "income"])
    assert resolved == ["expense", "income"]


# ---------------------------------------------------------------------------
# The file
# ---------------------------------------------------------------------------

def _row(**over):
    """A row of the file, as the export makes it."""
    base = {
        "date": "2026-11-03",
        "type": "expense",
        "category": "Makanan & Minuman",
        "description": "Nasi goreng",
        "amount": 25000.0,
        "account": "BCA",
        "items": [{"name": "Nasi goreng", "quantity": 1, "unit_price": 25000, "total_price": 25000}],
        "tax": {"discount": 0.0, "tax": 0.0},
        "location": "Warung Bu Imas",
    }
    base.update(over)
    return base


def test_the_file_has_a_heading_and_a_row_for_each_line():
    """The file is readable: a heading, then a row per transaction."""
    csv_text = export_service.to_csv(
        ["date", "type", "amount"],
        [_row(), _row(date="2026-11-04")],
    )

    lines = csv_text.strip().split("\n")
    assert len(lines) == 3, csv_text
    assert "Tanggal & Waktu" in lines[0]
    assert "Nominal Bersih (IDR)" in lines[0]
    assert "2026-11-03" in lines[1]
    assert "2026-11-04" in lines[2]


def test_the_file_starts_with_a_byte_order_mark():
    """Excel on Windows reads the accented letters as letters.

    Without the mark, "Penggantian" arrives as a row of question
    marks, and the reader concludes their backup is broken.
    """
    content = export_service.csv_with_bom(["date"], [_row()])

    assert isinstance(content, bytes)
    assert content.startswith(b"\xef\xbb\xbf"), content[:10]


def test_a_turned_off_column_is_not_even_a_heading():
    """The heading of a column that is not there is not there."""
    csv_text = export_service.to_csv(["date", "amount"], [_row()])

    assert "Deskripsi" not in csv_text
    assert "Akun / Rekening" not in csv_text


def test_the_lines_of_a_transaction_are_in_the_file():
    """The count and the price of one, as the reader wrote them."""
    csv_text = export_service.to_csv(["items"], [_row()])

    assert "Nasi goreng" in csv_text
    assert "1 x 25000" in csv_text


def test_the_discount_and_the_tax_are_in_the_file():
    csv_text = export_service.to_csv(
        ["tax"],
        [_row(tax={"discount": 5000.0, "tax": 2500.0})],
    )

    assert "Diskon 5000" in csv_text
    assert "Pajak 2500" in csv_text


def test_a_transaction_with_no_lines_has_an_empty_cell():
    """A transaction typed by hand has no lines, and that is not a
    fault."""
    csv_text = export_service.to_csv(["items"], [_row(items=[])])

    lines = csv_text.split("\n")
    # The heading, then a row with an empty cell - and the cell is
    # empty, not a pair of quotes that Excel would show as text.
    assert len(lines) == 3, repr(csv_text)
    assert lines[1] == "", repr(lines[1])
    assert '""' not in csv_text, repr(csv_text)


def test_a_comma_in_a_description_does_not_break_the_file():
    """The reader's own words go into the file as they are.

    A description of "Kopi, gula, susu" is one field, not three.
    """
    csv_text = export_service.to_csv(
        ["description"],
        [_row(description="Kopi, gula, susu")],
    )

    lines = csv_text.strip().split("\n")
    assert len(lines) == 2, csv_text
    assert '"Kopi, gula, susu"' in csv_text


# ---------------------------------------------------------------------------
# The name of the file
# ---------------------------------------------------------------------------

def test_the_dates_are_in_the_name_of_the_file():
    """A reader with eleven exports in one folder can tell them apart
    without opening any of them."""
    name = export_service.filename_for(
        "transaksi", date(2026, 11, 1), date(2026, 11, 30)
    )

    assert "2026-11-01" in name
    assert "2026-11-30" in name
    assert name.endswith(".csv")


def test_a_file_with_no_dates_is_named_for_the_day():
    name = export_service.filename_for("transaksi", None, None)

    assert name.endswith(".csv")
    assert "transaksi" in name
