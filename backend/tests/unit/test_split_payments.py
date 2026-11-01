"""
How a member of a group is paid, and who is allowed to find out.

These are the checks that matter for this feature:

- the account number is not readable in the row on disk;
- the list of methods does not contain the account number at all;
- the number is not revealed to somebody who does not owe the money;
- the number is revealed to somebody who does owe it;
- a cash method needs no number.

Everything here uses synthetic numbers. The real ones are not in the
repository and they are not in the test output either.
"""

from decimal import Decimal

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.models.split_bill import (
    SplitCalculatedShare,
    SplitExpense,
    SplitGroup,
    SplitMember,
    SplitPayer,
    SplitPaymentMethod,
)

import app.models.user  # noqa: F401
import app.models.account  # noqa: F401
import app.models.category  # noqa: F401
import app.models.transaction  # noqa: F401
import app.models.receipt  # noqa: F401

from app.services.split_payment_service import (
    PaymentMethodAccessDenied,
    list_payment_methods,
    outstanding_balance,
    reveal_payment_method,
    save_payment_method,
)

# A made-up number. It is not a real account.
FAKE_NUMBER = "1234567890"
FAKE_NAME = "A. Member"


@pytest.fixture()
def db():
    """
    A database with only the tables this test needs.

    The whole schema cannot be made on a small database because one
    of the other tables uses a column type that only the big one has,
    so the tables that are needed here are copied out of the models
    by hand.
    """
    from sqlalchemy import (
        Boolean,
        Column,
        Date,
        DateTime,
        ForeignKey,
        Integer,
        MetaData,
        Numeric,
        String,
        Table,
        Text,
    )

    engine = create_engine("sqlite:///:memory:")
    private = MetaData()

    Table(
        "users",
        private,
        Column("id", Integer, primary_key=True),
        Column("email", String(255)),
        Column("name", String(100)),
        Column("hashed_password", String(255)),
        Column("is_active", Boolean, default=True),
        Column("created_at", DateTime),
    )
    Table(
        "accounts",
        private,
        Column("id", Integer, primary_key=True),
        Column("user_id", Integer, ForeignKey("users.id"), nullable=False),
        Column("name", String(100)),
        Column("type", String(50)),
        Column("balance", Numeric(20, 2), default=0),
        Column("initial_balance", Numeric(20, 2), default=0),
        Column("currency", String(10), default="IDR"),
        Column("is_deleted", Boolean, default=False),
        Column("created_at", DateTime),
    )
    Table(
        "categories",
        private,
        Column("id", Integer, primary_key=True),
        Column("user_id", Integer, ForeignKey("users.id"), nullable=False),
        Column("name", String(100)),
        Column("type", String(50)),
        Column("is_adjustment", Boolean, default=False),
        Column("created_at", DateTime),
    )
    Table(
        "transactions",
        private,
        Column("id", Integer, primary_key=True),
        Column("user_id", Integer, ForeignKey("users.id"), nullable=False),
        Column("type", String(20), nullable=False),
        Column("amount", Numeric(20, 2), nullable=False),
        Column("currency", String(10), nullable=False, server_default="IDR"),
        Column("date", Date, nullable=False),
        Column("description", String(255)),
        Column("account_id", Integer, ForeignKey("accounts.id"), nullable=False),
        Column("category_id", Integer, ForeignKey("categories.id")),
        Column("is_deleted", Boolean, default=False),
        Column("status", String(20)),
        Column("split_expense_id", Integer),
        Column("split_tx_type", String(30)),
        Column("created_at", DateTime),
        Column("updated_at", DateTime),
    )
    Table(
        "receipt_scans",
        private,
        Column("id", Integer, primary_key=True),
        Column("user_id", Integer, ForeignKey("users.id"), nullable=False),
        Column("image_path", String(255)),
        Column("raw_text", Text),
        Column("created_at", DateTime),
    )

    for name in (
        "split_groups",
        "split_members",
        "split_expenses",
        "split_payers",
        "split_items",
        "split_item_claims",
        "split_calculated_shares",
        "split_settlements",
        "split_payment_methods",
    ):
        Base.metadata.tables[name].to_metadata(private)

    private.create_all(engine)
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


def _group(db, name="Dinner"):
    group = SplitGroup(owner_id=1, name=name, invite_code=f"code-{name}")
    db.add(group)
    db.flush()
    return group


def _member(db, group, name, user_id=None, is_host=False):
    member = SplitMember(
        group_id=group.id,
        display_name=name,
        user_id=user_id,
        is_host=is_host,
        is_present=True,
    )
    db.add(member)
    db.flush()
    return member


def _bill_where_andi_paid_and_budi_owes(db, group, amount="100000"):
    """
    A published dinner: Andi paid for it and Budi owes all of it.
    """
    expense = SplitExpense(
        group_id=group.id,
        status="PUBLISHED",
        subtotal=Decimal(amount),
        grand_total=Decimal(amount),
    )
    db.add(expense)
    db.flush()
    return expense


def _owe(db, group, expense, payer, oweer, amount):
    """
    Say that `oweer` owes `amount` of `expense` to `payer`.
    """
    db.add(SplitPayer(
        expense_id=expense.id,
        member_id=payer.id,
        amount=Decimal(amount),
    ))
    db.add(SplitCalculatedShare(
        expense_id=expense.id,
        member_id=payer.id,
        item_total=Decimal("0"),
        exact_amount=Decimal("0"),
        final_amount=Decimal("0"),
        currency="IDR",
    ))
    db.add(SplitCalculatedShare(
        expense_id=expense.id,
        member_id=oweer.id,
        item_total=Decimal(amount),
        exact_amount=Decimal(amount),
        final_amount=Decimal(amount),
        currency="IDR",
    ))
    db.flush()


# ---------------------------------------------------------------------------
# The number is not readable in the row on disk
# ---------------------------------------------------------------------------


def test_the_stored_account_number_is_not_the_plaintext(db):
    group = _group(db)
    andi = _member(db, group, "Andi", user_id=1)

    method = save_payment_method(
        db,
        member_id=andi.id,
        method_type="BANK",
        label="BCA",
        provider_name="Bank Central Asia",
        account_number=FAKE_NUMBER,
        account_name=FAKE_NAME,
    )
    db.flush()

    stored = method.account_number_encrypted
    assert stored
    assert FAKE_NUMBER not in stored
    assert FAKE_NAME not in (method.account_holder_encrypted or "")


def test_the_stored_account_number_is_not_readable_by_anybody(db):
    """
    The ciphertext on disk does not contain the number, not even as
    part of a longer string, and the last four digits are kept apart
    from it.
    """
    group = _group(db)
    andi = _member(db, group, "Andi", user_id=1)

    method = save_payment_method(
        db,
        member_id=andi.id,
        method_type="EWALLET",
        label="GoPay",
        provider_name="Gojek",
        account_number=FAKE_NUMBER,
        account_name=FAKE_NAME,
    )
    db.flush()

    assert FAKE_NUMBER not in method.account_number_encrypted
    assert method.account_number_hint == "7890"


def test_the_same_number_encrypted_twice_is_not_the_same_text(db):
    """
    The KMS helper uses a random salt and a random nonce, so the same
    number written twice gives two different ciphertexts. That is why
    a method cannot be found by comparing encrypted values.
    """
    group = _group(db)
    andi = _member(db, group, "Andi", user_id=1)

    first = save_payment_method(
        db, andi.id, "BANK", account_number=FAKE_NUMBER
    )
    second = save_payment_method(
        db, andi.id, "BANK", account_number=FAKE_NUMBER
    )
    db.flush()

    assert first.account_number_encrypted != second.account_number_encrypted


# ---------------------------------------------------------------------------
# The list does not contain the number
# ---------------------------------------------------------------------------


def test_the_list_of_methods_does_not_contain_the_account_number(db):
    group = _group(db)
    andi = _member(db, group, "Andi", user_id=1)

    save_payment_method(
        db,
        member_id=andi.id,
        method_type="BANK",
        label="BCA",
        provider_name="Bank Central Asia",
        account_number=FAKE_NUMBER,
        account_name=FAKE_NAME,
    )
    db.flush()

    rows = list_payment_methods(db, andi.id)

    assert len(rows) == 1
    row = rows[0]
    assert row["method_type"] == "BANK"
    assert row["label"] == "BCA"
    assert row["account_number_hint"] == "7890"

    # There is no key that holds the number, and the value of every
    # key is not the number either.
    assert "account_number" not in row
    assert "account_number_encrypted" not in row
    assert "account_name" not in row
    assert "account_holder_encrypted" not in row
    assert FAKE_NUMBER not in row.values()


# ---------------------------------------------------------------------------
# The reveal
# ---------------------------------------------------------------------------


def test_the_number_is_not_revealed_to_somebody_who_owes_nothing(db):
    group = _group(db)
    andi = _member(db, group, "Andi", user_id=1, is_host=True)
    caca = _member(db, group, "Caca", user_id=3)
    expense = _bill_where_andi_paid_and_budi_owes(db, group)
    _owe(db, group, expense, andi, caca, "0")

    method = save_payment_method(
        db, andi.id, "BANK", account_number=FAKE_NUMBER, account_name=FAKE_NAME
    )
    db.flush()

    with pytest.raises(PermissionError):
        reveal_payment_method(
            db, method.id, requester_user_id=3, group_id=group.id
        )


def test_the_number_is_revealed_to_somebody_who_owes_the_money(db):
    group = _group(db)
    andi = _member(db, group, "Andi", user_id=1, is_host=True)
    budi = _member(db, group, "Budi", user_id=2)
    expense = _bill_where_andi_paid_and_budi_owes(db, group)
    _owe(db, group, expense, andi, budi, "100000")

    method = save_payment_method(
        db, andi.id, "BANK", account_number=FAKE_NUMBER, account_name=FAKE_NAME
    )
    db.flush()

    revealed = reveal_payment_method(
        db, method.id, requester_user_id=2, group_id=group.id
    )

    assert revealed["account_number"] == FAKE_NUMBER
    assert revealed["account_name"] == FAKE_NAME
    assert revealed["method_type"] == "BANK"


def test_the_member_can_always_read_their_own_method(db):
    group = _group(db)
    andi = _member(db, group, "Andi", user_id=1)

    method = save_payment_method(
        db, andi.id, "BANK", account_number=FAKE_NUMBER, account_name=FAKE_NAME
    )
    db.flush()

    revealed = reveal_payment_method(
        db, method.id, requester_user_id=1, group_id=group.id
    )

    assert revealed["account_number"] == FAKE_NUMBER


def test_somebody_from_another_group_is_refused(db):
    other = _group(db, name="Other")
    stranger = _member(db, other, "Stranger", user_id=9)
    method = save_payment_method(
        db, stranger.id, "BANK", account_number=FAKE_NUMBER
    )
    db.flush()

    with pytest.raises(PaymentMethodAccessDenied):
        reveal_payment_method(
            db, method.id, requester_user_id=9, group_id=999
        )


# ---------------------------------------------------------------------------
# Cash needs no number
# ---------------------------------------------------------------------------


def test_a_cash_method_needs_no_account_number(db):
    group = _group(db)
    andi = _member(db, group, "Andi", user_id=1)

    method = save_payment_method(
        db, andi.id, method_type="CASH", label="Cash on the table"
    )
    db.flush()

    assert method.method_type == "CASH"
    assert not method.account_number_encrypted
    assert not method.account_number_hint


def test_a_bank_method_without_an_account_number_is_refused(db):
    group = _group(db)
    andi = _member(db, group, "Andi", user_id=1)

    with pytest.raises(ValueError):
        save_payment_method(db, andi.id, method_type="BANK", label="BCA")


def test_an_unknown_method_type_is_refused(db):
    group = _group(db)
    andi = _member(db, group, "Andi", user_id=1)

    with pytest.raises(ValueError):
        save_payment_method(
            db, andi.id, method_type="CRYPTO", account_number=FAKE_NUMBER
        )


# ---------------------------------------------------------------------------
# The balance between two members
# ---------------------------------------------------------------------------


def test_the_balance_between_two_members_is_what_one_owes_the_other(db):
    group = _group(db)
    andi = _member(db, group, "Andi", user_id=1, is_host=True)
    budi = _member(db, group, "Budi", user_id=2)
    caca = _member(db, group, "Caca", user_id=3)
    expense = _bill_where_andi_paid_and_budi_owes(db, group)
    _owe(db, group, expense, andi, budi, "100000")

    assert outstanding_balance(db, group.id, budi.id, andi.id) == Decimal("100000.00")
    # Caca owes nothing to anybody, and Andi owes nobody anything.
    assert outstanding_balance(db, group.id, caca.id, andi.id) == Decimal("0.00")
    assert outstanding_balance(db, group.id, andi.id, budi.id) == Decimal("0.00")


def test_a_draft_bill_owes_nobody_anything(db):
    group = _group(db)
    andi = _member(db, group, "Andi", user_id=1, is_host=True)
    budi = _member(db, group, "Budi", user_id=2)
    expense = SplitExpense(
        group_id=group.id,
        status="DRAFT",
        subtotal=Decimal("100000"),
        grand_total=Decimal("100000"),
    )
    db.add(expense)
    db.flush()
    _owe(db, group, expense, andi, budi, "100000")

    assert outstanding_balance(db, group.id, budi.id, andi.id) == Decimal("0.00")


def test_a_settled_debt_is_no_longer_outstanding(db):
    from app.models.split_bill import SplitSettlement

    group = _group(db)
    andi = _member(db, group, "Andi", user_id=1, is_host=True)
    budi = _member(db, group, "Budi", user_id=2)
    expense = _bill_where_andi_paid_and_budi_owes(db, group)
    _owe(db, group, expense, andi, budi, "100000")

    db.add(SplitSettlement(
        group_id=group.id,
        from_member_id=budi.id,
        to_member_id=andi.id,
        amount=Decimal("100000"),
        status="COMPLETED",
    ))
    db.flush()

    assert outstanding_balance(db, group.id, budi.id, andi.id) == Decimal("0.00")


def test_the_number_is_not_revealed_once_the_debt_is_settled(db):
    from app.models.split_bill import SplitSettlement

    group = _group(db)
    andi = _member(db, group, "Andi", user_id=1, is_host=True)
    budi = _member(db, group, "Budi", user_id=2)
    expense = _bill_where_andi_paid_and_budi_owes(db, group)
    _owe(db, group, expense, andi, budi, "100000")
    method = save_payment_method(
        db, andi.id, "BANK", account_number=FAKE_NUMBER, account_name=FAKE_NAME
    )
    db.add(SplitSettlement(
        group_id=group.id,
        from_member_id=budi.id,
        to_member_id=andi.id,
        amount=Decimal("100000"),
        status="COMPLETED",
    ))
    db.flush()

    with pytest.raises(PermissionError):
        reveal_payment_method(
            db, method.id, requester_user_id=2, group_id=group.id
        )


def test_the_model_row_keeps_the_number_in_the_encrypted_column(db):
    """
    The row that was written down holds the ciphertext and not the
    number, when it is read straight out of the table.
    """
    group = _group(db)
    andi = _member(db, group, "Andi", user_id=1)

    save_payment_method(
        db, andi.id, "QRIS", account_number=FAKE_NUMBER, account_name=FAKE_NAME
    )
    db.flush()

    row = (
        db.query(SplitPaymentMethod)
        .filter(SplitPaymentMethod.member_id == andi.id)
        .first()
    )

    assert FAKE_NUMBER not in (row.account_number_encrypted or "")
    assert row.account_number_hint == "7890"
