"""
The tables of a shared bill.

A bill shared between people needs more than one table. There is the
group, the members in it, the receipt, the lines on the receipt, who
claimed which line, what each member ends up owing, and the payments
that settle it.

The rule for this file: **it is additive and it is reversible.** Every
table it creates is dropped in the downgrade, and every column it
adds goes with a `DROP COLUMN`. A reader who runs this can undo it
and get back the database they had.

The columns on `transactions` are the two that tie a shared bill to
the reader own records:

- `split_expense_id` — which shared bill this transaction came from.
- `split_tx_type` — which part of it this transaction is. The three
  kinds are `PERSONAL_SHARE` (the reader own part, which is
  spending), `FRONTED_RECEIVABLE` (money the reader put in for
  somebody else, which is not spending) and `SPLIT_REIMBURSEMENT`
  (money coming back, which is not income). Without this column the
  month looks bigger than it was, because the money that was lent out
  would be counted as money that was spent.

Nothing here is run automatically. The owner reads it and runs it.
"""

from alembic import op
import sqlalchemy as sa

# The revision chain. This one follows the transaction tags.
revision = "20261031_smart_split_bill"
down_revision = "20261029_transaction_tags"
branch_labels = None
depends_on = None


def _add_column(table, column):
    """
    Put a column on a table, if the table is there.

    The base tables in this database are not made by alembic: they
    are made from the models at startup. So a fresh database reaches
    this revision with the table already there, and an empty one
    reaches it with nothing. Both have to work.

    The column is also left out when it is already there, because the
    startup migration adds the same column. Running this twice must
    not be an error.
    """
    from sqlalchemy import inspect

    inspector = inspect(op.get_bind())
    if table not in inspector.get_table_names():
        return False
    if column.name in {c["name"] for c in inspector.get_columns(table)}:
        return False
    op.add_column(table, column)
    return True


def _batch_add_column(batch, table_name, column):
    """
    Put a column on a table, if it is not already there.

    The batch form of alembic rewrites the table when the database
    cannot add a column by itself, which is the case for a column
    that carries a foreign key.
    """
    from sqlalchemy import inspect

    inspector = inspect(op.get_bind())
    existing = {c["name"] for c in inspector.get_columns(table_name)}
    if column.name in existing:
        return False
    batch.add_column(column)
    return True


def upgrade():
    inspector = __import__("sqlalchemy").inspect(op.get_bind())
    tables = set(inspector.get_table_names())

    # --- the shared bill tables ----------------------------------------------
    if "split_groups" not in tables:
        op.create_table(
            "split_groups",
            sa.Column("id", sa.Integer(), primary_key=True, index=True),
            sa.Column(
                "owner_id",
                sa.Integer(),
                sa.ForeignKey("users.id"),
                nullable=False,
                index=True,
            ),
            sa.Column("name", sa.String(length=100), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("invite_code", sa.String(length=32), nullable=False, unique=True, index=True),
            sa.Column("currency", sa.String(length=10), nullable=False, server_default="IDR"),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("allow_guest_claims", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
        )

    if "split_members" not in tables:
        op.create_table(
            "split_members",
            sa.Column("id", sa.Integer(), primary_key=True, index=True),
            sa.Column(
                "group_id",
                sa.Integer(),
                sa.ForeignKey("split_groups.id"),
                nullable=False,
                index=True,
            ),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True, index=True),
            sa.Column("display_name", sa.String(length=60), nullable=False),
            sa.Column("avatar_url", sa.String(length=255), nullable=True),
            sa.Column("avatar_color", sa.String(length=20), nullable=True),
            sa.Column("is_host", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("is_present", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("claim_token", sa.String(length=64), nullable=True, index=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
            sa.UniqueConstraint("group_id", "display_name", name="uq_split_member_group_name"),
        )

    if "split_expenses" not in tables:
        op.create_table(
            "split_expenses",
            sa.Column("id", sa.Integer(), primary_key=True, index=True),
            sa.Column(
                "group_id",
                sa.Integer(),
                sa.ForeignKey("split_groups.id"),
                nullable=False,
                index=True,
            ),
            sa.Column(
                "created_by_member_id",
                sa.Integer(),
                sa.ForeignKey("split_members.id"),
                nullable=True,
                index=True,
            ),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True, index=True),
            sa.Column("name", sa.String(length=150), nullable=True),
            sa.Column("merchant_name", sa.String(length=150), nullable=True),
            sa.Column("receipt_date", sa.Date(), nullable=True),
            sa.Column(
                "receipt_scan_id",
                sa.Integer(),
                sa.ForeignKey("receipt_scans.id"),
                nullable=True,
                index=True,
            ),
            sa.Column("latitude", sa.Numeric(precision=10, scale=7), nullable=True),
            sa.Column("longitude", sa.Numeric(precision=10, scale=7), nullable=True),
            sa.Column("place_name", sa.String(length=255), nullable=True),
            sa.Column("subtotal", sa.Numeric(precision=20, scale=2), nullable=True),
            sa.Column("tax", sa.Numeric(precision=20, scale=2), nullable=True),
            sa.Column("service_charge", sa.Numeric(precision=20, scale=2), nullable=True),
            sa.Column("discount", sa.Numeric(precision=20, scale=2), nullable=True),
            sa.Column("grand_total", sa.Numeric(precision=20, scale=2), nullable=True),
            sa.Column("discrepancy", sa.Numeric(precision=20, scale=2), nullable=True),
            sa.Column("status", sa.String(length=20), nullable=False, server_default="DRAFT", index=True),
            sa.Column("split_mode", sa.String(length=20), nullable=False, server_default="ITEMIZED"),
            sa.Column("payer_account_id", sa.Integer(), sa.ForeignKey("accounts.id"), nullable=True),
            sa.Column(
                "transaction_id",
                sa.Integer(),
                sa.ForeignKey("transactions.id"),
                nullable=True,
                index=True,
            ),
            sa.Column("record_personal_share", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
        )

    if "split_payers" not in tables:
        op.create_table(
            "split_payers",
            sa.Column("id", sa.Integer(), primary_key=True, index=True),
            sa.Column(
                "expense_id",
                sa.Integer(),
                sa.ForeignKey("split_expenses.id"),
                nullable=False,
                index=True,
            ),
            sa.Column(
                "member_id",
                sa.Integer(),
                sa.ForeignKey("split_members.id"),
                nullable=False,
                index=True,
            ),
            sa.Column("amount", sa.Numeric(precision=20, scale=2), nullable=False),
            sa.Column("currency", sa.String(length=10), nullable=False, server_default="IDR"),
            sa.Column("created_at", sa.DateTime(), nullable=True),
        )

    if "split_items" not in tables:
        op.create_table(
            "split_items",
            sa.Column("id", sa.Integer(), primary_key=True, index=True),
            sa.Column(
                "expense_id",
                sa.Integer(),
                sa.ForeignKey("split_expenses.id"),
                nullable=False,
                index=True,
            ),
            sa.Column("raw_name", sa.String(length=255), nullable=True),
            sa.Column("name", sa.String(length=255), nullable=False),
            sa.Column("quantity", sa.Numeric(precision=10, scale=2), nullable=False, server_default="1"),
            sa.Column("unit_price", sa.Numeric(precision=20, scale=2), nullable=False, server_default="0"),
            sa.Column("total_price", sa.Numeric(precision=20, scale=2), nullable=False, server_default="0"),
            sa.Column("kind", sa.String(length=20), nullable=False, server_default="item"),
            sa.Column("category", sa.String(length=100), nullable=True),
            sa.Column("is_verified", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("is_claimed", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("line_number", sa.Integer(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
        )

    if "split_item_claims" not in tables:
        op.create_table(
            "split_item_claims",
            sa.Column("id", sa.Integer(), primary_key=True, index=True),
            sa.Column(
                "item_id",
                sa.Integer(),
                sa.ForeignKey("split_items.id"),
                nullable=False,
                index=True,
            ),
            sa.Column(
                "member_id",
                sa.Integer(),
                sa.ForeignKey("split_members.id"),
                nullable=False,
                index=True,
            ),
            sa.Column("quantity", sa.Numeric(precision=10, scale=2), nullable=False, server_default="1"),
            sa.Column("claimed_at", sa.DateTime(), nullable=True),
            sa.UniqueConstraint("item_id", "member_id", name="uq_split_claim_item_member"),
        )

    if "split_calculated_shares" not in tables:
        op.create_table(
            "split_calculated_shares",
            sa.Column("id", sa.Integer(), primary_key=True, index=True),
            sa.Column(
                "expense_id",
                sa.Integer(),
                sa.ForeignKey("split_expenses.id"),
                nullable=False,
                index=True,
            ),
            sa.Column(
                "member_id",
                sa.Integer(),
                sa.ForeignKey("split_members.id"),
                nullable=False,
                index=True,
            ),
            sa.Column("item_total", sa.Numeric(precision=20, scale=2), nullable=False, server_default="0"),
            sa.Column("exact_amount", sa.Numeric(precision=20, scale=2), nullable=False),
            sa.Column("final_amount", sa.Numeric(precision=20, scale=2), nullable=False),
            sa.Column("currency", sa.String(length=10), nullable=False, server_default="IDR"),
            sa.Column("is_paid", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("created_at", sa.DateTime(), nullable=True),
        )

    if "split_settlements" not in tables:
        op.create_table(
            "split_settlements",
            sa.Column("id", sa.Integer(), primary_key=True, index=True),
            sa.Column(
                "group_id",
                sa.Integer(),
                sa.ForeignKey("split_groups.id"),
                nullable=False,
                index=True,
            ),
            sa.Column(
                "from_member_id",
                sa.Integer(),
                sa.ForeignKey("split_members.id"),
                nullable=False,
                index=True,
            ),
            sa.Column(
                "to_member_id",
                sa.Integer(),
                sa.ForeignKey("split_members.id"),
                nullable=False,
                index=True,
            ),
            sa.Column("amount", sa.Numeric(precision=20, scale=2), nullable=False),
            sa.Column("currency", sa.String(length=10), nullable=False, server_default="IDR"),
            sa.Column(
                "expense_id",
                sa.Integer(),
                sa.ForeignKey("split_expenses.id"),
                nullable=True,
                index=True,
            ),
            sa.Column("status", sa.String(length=20), nullable=False, server_default="PENDING", index=True),
            sa.Column("proof_url", sa.String(length=255), nullable=True),
            sa.Column("proof_amount", sa.Numeric(precision=20, scale=2), nullable=True),
            sa.Column("proof_date", sa.Date(), nullable=True),
            sa.Column("proof_note", sa.Text(), nullable=True),
            sa.Column(
                "transaction_id",
                sa.Integer(),
                sa.ForeignKey("transactions.id"),
                nullable=True,
                index=True,
            ),
            sa.Column("settled_at", sa.DateTime(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
        )

    # A database that ran an earlier version of this migration has
    # the table but not the column that ties a payment to its
    # receipt. The column is added here, and only if it is missing.
    if "split_settlements" in tables:
        _add_column(
            "split_settlements",
            sa.Column("expense_id", sa.Integer(), nullable=True),
        )

    # --- the two columns on transactions -------------------------------------
    #
    # They are added last, after the tables they point at are there.
    # A column with a foreign key can only be added to a database
    # that already has the table on the other end, and the batch
    # form is used because not every database can add a column that
    # carries a foreign key by itself.
    if "transactions" in tables:
        _add_column(
            "transactions",
            # No foreign key on this column. The link the other way
            # round carries one, and a column cannot be added to an
            # existing table with a foreign key on it in every
            # database this application runs on.
            sa.Column("split_expense_id", sa.Integer(), nullable=True),
        )
        _add_column(
            "transactions",
            sa.Column("split_tx_type", sa.String(length=30), nullable=True),
        )

    if "split_payment_methods" not in tables:
        op.create_table(
            "split_payment_methods",
            sa.Column("id", sa.Integer(), primary_key=True, index=True),
            sa.Column(
                "member_id",
                sa.Integer(),
                sa.ForeignKey("split_members.id"),
                nullable=False,
                index=True,
            ),
            sa.Column("method_type", sa.String(length=20), nullable=False, server_default="BANK"),
            sa.Column("label", sa.String(length=60), nullable=True),
            sa.Column("provider_name", sa.String(length=60), nullable=True),
            sa.Column("account_number_encrypted", sa.Text(), nullable=True),
            sa.Column("account_holder_encrypted", sa.Text(), nullable=True),
            sa.Column("account_number_hint", sa.String(length=8), nullable=True),
            sa.Column("qris_image_url", sa.String(length=255), nullable=True),
            sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
        )


def _drop_column(table_name, name):
    """
    Take a column off a table, if it is there.

    PostgreSQL can take a column away by itself. SQLite cannot, and
    has to have the table rewritten instead, which is what the batch
    form is for. The batch form on PostgreSQL would make a copy of
    the table and swap it, and that copy is a table the other tables
    still point at, so it fails in a way that is hard to read.

    So the plain form is used where the database can do it, and the
    batch form only where it cannot.
    """
    from sqlalchemy import inspect

    inspector = inspect(op.get_bind())
    existing = {c["name"] for c in inspector.get_columns(table_name)}
    if name not in existing:
        return False

    if op.get_bind().dialect.name == "sqlite":
        with op.batch_alter_table(table_name) as batch:
            batch.drop_column(name)
    else:
        op.drop_column(table_name, name)
    return True


def downgrade():
    inspector = __import__("sqlalchemy").inspect(op.get_bind())
    tables = set(inspector.get_table_names())

    # The tables go first, in the reverse order they were made, so
    # that nothing is dropped while something still points at it.
    for table in (
        "split_payment_methods",
        "split_settlements",
        "split_calculated_shares",
        "split_item_claims",
        "split_items",
        "split_payers",
        "split_expenses",
        "split_members",
        "split_groups",
    ):
        if table in tables:
            op.drop_table(table)

    if "transactions" in tables:
        # The indexes go first. An index that points at a column that
        # is not there cannot be made, and the column cannot be taken
        # away while an index is standing on it.
        #
        # Which indexes are there is asked first, rather than trying
        # to drop each one and catching the failure. On PostgreSQL a
        # statement that fails leaves the transaction unusable, so a
        # failure that is caught still spoils everything that comes
        # after it. Asking first means nothing fails at all.
        from sqlalchemy import inspect

        existing_indexes = {
            index["name"]
            for index in inspect(op.get_bind()).get_indexes("transactions")
        }
        for index_name in (
            "ix_transactions_split_expense_id",
            "ix_transactions_split_tx_type",
            "idx_transactions_split_expense",
        ):
            if index_name in existing_indexes:
                op.drop_index(index_name, table_name="transactions")
        _drop_column("transactions", "split_tx_type")
        _drop_column("transactions", "split_expense_id")
