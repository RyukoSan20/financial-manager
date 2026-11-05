"""
The price of a thing the reader has bought before.

When the reader types "Indomie" into the item table, the price of the
Indomie comes back, because they paid it last time. That memory is
built from the lines of the receipts they have already saved, and
from the transactions they have already saved.

The memory is the reader's own: another reader's Indomie is not their
Indomie, so one reader's price must never show up in another's form.
That is the whole point of the endpoint being per-user.

The lines are the better source than the transactions. A transaction
of Rp 12.000 for "Belanja di Warung" says nothing about the price of
the Indomie inside it; the line does.
"""

import pytest
from datetime import date
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy import MetaData
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.database import Base
from app.models.account import Account
from app.models.category import Category
from app.models.receipt import ReceiptItem, ReceiptScan
from app.models.transaction import Transaction
from app.models.user import User

TABLES = (
    "users",
    "accounts",
    "categories",
    "transactions",
    "receipt_scans",
    "receipt_items",
)


class TheReader:
    """The person using the application, whose id is set by the test."""

    def __init__(self):
        self.id = 1


@pytest.fixture()
def reader_db():
    import app.models.user  # noqa: F401
    import app.models.account  # noqa: F401
    import app.models.category  # noqa: F401
    import app.models.transaction  # noqa: F401
    import app.models.receipt  # noqa: F401

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    # Only the tables this test needs are copied, because the whole
    # schema has columns that SQLite cannot make.
    private = MetaData()

    copied = set()

    def copy_table(name):
        if name in copied or name not in Base.metadata.tables:
            return
        copied.add(name)
        source = Base.metadata.tables[name]
        for column in source.columns:
            for foreign_key in column.foreign_keys:
                copy_table(foreign_key.target_fullname.split(".")[0])
        source.to_metadata(private)

    for name in TABLES:
        copy_table(name)

    private.create_all(engine)
    Session = sessionmaker(bind=engine)
    db = Session()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture()
def reader_client(reader_db):
    """
    The application, with a small database behind it, and the receipt
    routes on it.

    The reader is whoever the test says they are, so that one reader's
    memory can be checked not to reach another reader.
    """
    from app.api.routes import receipt_items

    app = FastAPI()
    app.include_router(receipt_items.router, prefix="/api/receipt-items")

    def _db():
        yield reader_db

    the_reader = TheReader()

    app.dependency_overrides[get_db] = _db
    app.dependency_overrides[get_current_user] = lambda: the_reader

    with TestClient(app) as test_client:
        test_client.reader = the_reader
        yield test_client


def _make_user(db, suffix):
    user = User(
        email=f"price-memory-{suffix}@example.com",
        hashed_password="x",
        full_name=f"Price Memory {suffix}",
        is_active=True,
        is_verified=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user



def _make_account(db, user):
    account = Account(
        user_id=user.id,
        name="Dompet",
        account_type="cash",
        currency="IDR",
        balance=100000,
        is_active=True,
    )
    db.add(account)
    db.commit()
    db.refresh(account)
    return account


def _make_category(db, user, name):
    category = Category(name=name, type="expense", user_id=user.id, is_active=True)
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


def _make_receipt(db, user, transaction, lines):
    scan = ReceiptScan(
        user_id=user.id,
        transaction_id=transaction.id,
        merchant_name="Warung Test",
        total_amount=sum(line[3] for line in lines),
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)

    for index, (name, quantity, unit_price, total) in enumerate(lines):
        db.add(
            ReceiptItem(
                receipt_scan_id=scan.id,
                raw_name=name,
                canonical_name=name,
                quantity=quantity,
                price_per_unit=unit_price,
                total_price=total,
                line_number=index,
                is_discount=False,
            )
        )
    db.commit()
    return scan


def test_the_memory_holds_the_price_of_a_line_of_a_receipt(reader_client, reader_db):
    the_reader = reader_client.reader
    user = _make_user(reader_db, "lines")
    the_reader.id = user.id
    account = _make_account(reader_db, user)
    category = _make_category(reader_db, user, "Makanan")
    transaction = Transaction(
        user_id=user.id,
        account_id=account.id,
        category_id=category.id,
        type="expense",
        amount=12000,
        description="Belanja di Warung",
        date=date(2026, 11, 5),
        is_deleted=False,
    )
    reader_db.add(transaction)
    reader_db.commit()
    reader_db.refresh(transaction)

    _make_receipt(
        reader_db,
        user,
        transaction,
        [
            ("Indomie Goreng", 2, 3500, 7000),
            ("Es Teh", 1, 5000, 5000),
        ],
    )

    response = reader_client.get("/api/receipt-items/price-memory")

    assert response.status_code == 200, response.text
    memory = response.json()
    by_name = {entry["name"]: entry for entry in memory}

    assert "Indomie Goreng" in by_name, memory
    assert by_name["Indomie Goreng"]["unit_price"] == 3500
    assert by_name["Indomie Goreng"]["quantity"] == 2


def test_the_memory_holds_the_price_of_a_whole_transaction(reader_client, reader_db):
    the_reader = reader_client.reader
    user = _make_user(reader_db, "whole")
    the_reader.id = user.id
    account = _make_account(reader_db, user)
    category = _make_category(reader_db, user, "Makanan")
    transaction = Transaction(
        user_id=user.id,
        account_id=account.id,
        category_id=category.id,
        type="expense",
        amount=3500,
        description="Indomie Goreng",
        date=date(2026, 11, 5),
        is_deleted=False,
    )
    reader_db.add(transaction)
    reader_db.commit()

    response = reader_client.get("/api/receipt-items/price-memory")

    assert response.status_code == 200, response.text
    names = {entry["name"] for entry in response.json()}
    assert "Indomie Goreng" in names, response.json()


def test_the_price_of_the_line_wins_over_the_total_of_the_transaction(reader_client, reader_db):
    # A receipt of Rp 12.000 with an Indomie of Rp 3.500 in it has a
    # transaction of Rp 12.000 and a line of Rp 3.500. The price of the
    # Indomie is the line. If the total of the shop overwrites it, the
    # reader is told that the Indomie cost twelve thousand, and the
    # memory teaches them the wrong price.
    user = _make_user(reader_db, "linewins")
    TheReader.id = user.id
    account = _make_account(reader_db, user)
    category = _make_category(reader_db, user, "Makanan")
    transaction = Transaction(
        user_id=user.id,
        account_id=account.id,
        category_id=category.id,
        type="expense",
        amount=12000,
        description="Indomie Goreng",
        date=date(2026, 11, 5),
        is_deleted=False,
    )
    reader_db.add(transaction)
    reader_db.commit()
    reader_db.refresh(transaction)

    _make_receipt(
        reader_db,
        user,
        transaction,
        [("Indomie Goreng", 2, 3500, 7000)],
    )

    response = reader_client.get("/api/receipt-items/price-memory")

    assert response.status_code == 200, response.text
    by_name = {entry["name"]: entry for entry in response.json()}
    assert by_name["Indomie Goreng"]["unit_price"] == 3500, by_name


def test_the_memory_of_one_reader_is_not_shown_to_another(reader_client, reader_db):
    the_reader = reader_client.reader
    mine = _make_user(reader_db, "mine")
    theirs = _make_user(reader_db, "theirs")
    the_reader = reader_client.reader
    account = _make_account(reader_db, mine)
    category = _make_category(reader_db, mine, "Makanan")
    transaction = Transaction(
        user_id=mine.id,
        account_id=account.id,
        category_id=category.id,
        type="expense",
        amount=3500,
        description="Indomie Goreng",
        date=date(2026, 11, 5),
        is_deleted=False,
    )
    reader_db.add(transaction)
    reader_db.commit()

    the_reader.id = theirs.id
    response = reader_client.get("/api/receipt-items/price-memory")

    assert response.status_code == 200, response.text
    names = {entry["name"] for entry in response.json()}
    assert "Indomie Goreng" not in names, response.json()


def test_the_memory_is_not_shown_to_a_stranger(reader_client):
    from fastapi import HTTPException

    reader_client.app.dependency_overrides[get_current_user] = lambda: (_ for _ in ()).throw(
        HTTPException(status_code=401, detail="Not authenticated")
    )
    response = reader_client.get("/api/receipt-items/price-memory")
    assert response.status_code in (401, 403), response.text
