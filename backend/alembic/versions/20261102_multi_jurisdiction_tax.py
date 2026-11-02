"""
The tables of a merchant that sells in more than one country.

A shop that sells in one country needs one table: the sales. A shop
that sells across borders needs more, because a sale carries more
than an amount and a date. It carries the tax that was charged on it,
under the law of the place it happened in; the money that settled it,
which may have arrived in another currency; the rules of that tax, so
that the sale can be read again later under the rule of the day; and
the entries the sale made in the merchant's books.

So seven tables are made here:

- `merchant_pos_products` — the products a till sells, described the
  way a till needs them: a barcode, a unit, a price.
- `business_transactions` — the sale itself, with the three
  currencies, the two countries, the discount and the totals.
- `business_transaction_items` — the lines of the sale.
- `business_transaction_taxes` — the tax of the sale, one row for
  each tax, with the rate, the base and the tax kept apart.
- `business_transaction_payments` — the money that settled the sale.
- `accounting_entries` — the books of the merchant.
- `tax_rules` — the rules of the world, kept apart from the sales so
  that a rate can change without rewriting history.

The rule for this file: **it is additive and it is reversible.** Every
table it creates is dropped in the downgrade, in the reverse order, so
that nothing is dropped while something still points at it.

Two things are done the way PostgreSQL needs and not the way SQLite
does, because PostgreSQL is the database the server runs on:

- A table is dropped with `op.drop_table`, and a column is never
  taken away with `batch_alter_table`. The batch form makes a copy of
  the table and swaps it, and the copy is a table the other tables
  still point at, so on PostgreSQL it fails in a way that is hard to
  read.
- Nothing here catches a failure and carries on. On PostgreSQL a
  statement that fails leaves the transaction unusable, so every
  statement after it fails too, and the error that is finally
  reported is about a statement that had nothing wrong with it. A
  failure that is caught is a failure that hides the real one.

Nothing here is run automatically. The owner reads it and runs it.
"""

from alembic import op
import sqlalchemy as sa

# The revision chain. This one follows the shared bill.
revision = "20261102_multi_jurisdiction_tax"
down_revision = "20261031_smart_split_bill"
branch_labels = None
depends_on = None


# The tables this migration makes, in the order they are made. The
# order matters: a table that points at another is made after it.
NEW_TABLES = (
    "merchant_pos_products",
    "tax_rules",
    "business_transactions",
    "business_transaction_items",
    "business_transaction_taxes",
    "business_transaction_payments",
    "accounting_entries",
)


def _tables():
    """The tables that are there now."""
    from sqlalchemy import inspect

    return set(inspect(op.get_bind()).get_table_names())


def upgrade():
    tables = _tables()

    # --- the products of a till ---------------------------------------------
    if "merchant_pos_products" not in tables:
        op.create_table(
            "merchant_pos_products",
            sa.Column("id", sa.Integer(), primary_key=True, index=True),
            sa.Column(
                "merchant_id",
                sa.Integer(),
                sa.ForeignKey("merchants.id", ondelete="CASCADE"),
                nullable=False,
                index=True,
            ),
            sa.Column("name", sa.String(length=255), nullable=False),
            sa.Column("sku", sa.String(length=50), nullable=True, index=True),
            sa.Column("barcode", sa.String(length=64), nullable=True, index=True),
            sa.Column("image_url", sa.String(length=255), nullable=True),
            sa.Column("category", sa.String(length=100), nullable=True),
            sa.Column("stock_quantity", sa.Numeric(precision=18, scale=6), nullable=False, server_default="0"),
            sa.Column("unit_of_measure", sa.String(length=20), nullable=False, server_default="pcs"),
            sa.Column("conversion_factor", sa.Numeric(precision=18, scale=6), nullable=False, server_default="1"),
            sa.Column("unit_price", sa.Numeric(precision=20, scale=2), nullable=False, server_default="0"),
            sa.Column("min_qty", sa.Numeric(precision=18, scale=6), nullable=True),
            sa.Column("max_qty", sa.Numeric(precision=18, scale=6), nullable=True),
            sa.Column("free_quantity", sa.Numeric(precision=18, scale=6), nullable=False, server_default="0"),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
        )

    # --- the rules of the world ---------------------------------------------
    if "tax_rules" not in tables:
        op.create_table(
            "tax_rules",
            sa.Column("id", sa.Integer(), primary_key=True, index=True),
            sa.Column("country_code", sa.String(length=2), nullable=False, index=True),
            sa.Column("state_code", sa.String(length=10), nullable=True, index=True),
            sa.Column("county_code", sa.String(length=20), nullable=True, index=True),
            sa.Column("city_code", sa.String(length=20), nullable=True, index=True),
            sa.Column("tax_code", sa.String(length=30), nullable=False, index=True),
            sa.Column("tax_type", sa.String(length=30), nullable=False, index=True),
            sa.Column("nominal_rate", sa.Numeric(precision=9, scale=4), nullable=False, server_default="0"),
            sa.Column("dpp_multiplier_numerator", sa.Numeric(precision=9, scale=4), nullable=False, server_default="1"),
            sa.Column("dpp_multiplier_denominator", sa.Numeric(precision=9, scale=4), nullable=False, server_default="1"),
            sa.Column("tax_behavior", sa.String(length=20), nullable=False, server_default="ADDITIVE"),
            sa.Column("effective_from", sa.Date(), nullable=True, index=True),
            sa.Column("effective_to", sa.Date(), nullable=True, index=True),
            sa.Column("rule_version", sa.String(length=30), nullable=True),
            sa.Column("rounding_method", sa.String(length=30), nullable=True, server_default="ROUND_HALF_UP"),
            sa.Column("metadata_json", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
        )

    # --- the sale itself ----------------------------------------------------
    if "business_transactions" not in tables:
        op.create_table(
            "business_transactions",
            sa.Column("id", sa.Integer(), primary_key=True, index=True),
            sa.Column(
                "merchant_id",
                sa.Integer(),
                sa.ForeignKey("merchants.id", ondelete="CASCADE"),
                nullable=False,
                index=True,
            ),
            sa.Column("invoice_number", sa.String(length=60), nullable=False, index=True),
            sa.Column("invoice_type", sa.String(length=20), nullable=False, server_default="POS_RECEIPT", index=True),
            sa.Column("customer_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True, index=True),
            sa.Column("transaction_date", sa.DateTime(), nullable=False),
            sa.Column("timezone", sa.String(length=60), nullable=True, server_default="Asia/Jakarta"),
            sa.Column("locale", sa.String(length=20), nullable=True, server_default="id-ID"),
            sa.Column("transaction_currency", sa.String(length=10), nullable=False, server_default="IDR"),
            sa.Column("functional_currency", sa.String(length=10), nullable=False, server_default="IDR"),
            sa.Column("settlement_currency", sa.String(length=10), nullable=False, server_default="IDR"),
            sa.Column("exchange_rate", sa.Numeric(precision=20, scale=10), nullable=True, server_default="1"),
            sa.Column("exchange_rate_date", sa.Date(), nullable=True),
            sa.Column("exchange_rate_source", sa.String(length=60), nullable=True),
            sa.Column("seller_country", sa.String(length=2), nullable=True, index=True),
            sa.Column("customer_country", sa.String(length=2), nullable=True, index=True),
            sa.Column("tax_region_code", sa.String(length=30), nullable=True, index=True),
            sa.Column("cross_border_flag", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("incoterms", sa.String(length=10), nullable=True),
            sa.Column("customs_value", sa.Numeric(precision=20, scale=2), nullable=True),
            sa.Column("e_invoice_format", sa.String(length=30), nullable=True),
            sa.Column("fiscal_period", sa.String(length=20), nullable=True, index=True),
            sa.Column("subtotal_gross", sa.Numeric(precision=20, scale=2), nullable=False, server_default="0"),
            sa.Column("total_line_discount", sa.Numeric(precision=20, scale=2), nullable=False, server_default="0"),
            sa.Column("transaction_discount_type", sa.String(length=20), nullable=True, server_default="NONE"),
            sa.Column("transaction_discount_rate", sa.Numeric(precision=9, scale=4), nullable=True, server_default="0"),
            sa.Column("transaction_discount_amount", sa.Numeric(precision=20, scale=2), nullable=False, server_default="0"),
            sa.Column("discount_allocation_method", sa.String(length=20), nullable=True, server_default="PROPORTIONAL_VALUE"),
            sa.Column("total_taxable_amount", sa.Numeric(precision=20, scale=2), nullable=False, server_default="0"),
            sa.Column("total_tax_additive", sa.Numeric(precision=20, scale=2), nullable=False, server_default="0"),
            sa.Column("total_withholding_tax", sa.Numeric(precision=20, scale=2), nullable=False, server_default="0"),
            sa.Column("shipping_fee", sa.Numeric(precision=20, scale=2), nullable=False, server_default="0"),
            sa.Column("transaction_fee", sa.Numeric(precision=20, scale=2), nullable=False, server_default="0"),
            sa.Column("processing_fee", sa.Numeric(precision=20, scale=2), nullable=False, server_default="0"),
            sa.Column("import_duty_fee", sa.Numeric(precision=20, scale=2), nullable=False, server_default="0"),
            sa.Column("rounding_amount", sa.Numeric(precision=20, scale=2), nullable=False, server_default="0"),
            sa.Column("grand_total", sa.Numeric(precision=20, scale=2), nullable=False, server_default="0"),
            sa.Column("net_receivable_amount", sa.Numeric(precision=20, scale=2), nullable=False, server_default="0"),
            sa.Column("outstanding_amount", sa.Numeric(precision=20, scale=2), nullable=False, server_default="0"),
            sa.Column("payment_status", sa.String(length=20), nullable=False, server_default="UNPAID", index=True),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
        )

    # --- the lines of the sale ----------------------------------------------
    if "business_transaction_items" not in tables:
        op.create_table(
            "business_transaction_items",
            sa.Column("id", sa.Integer(), primary_key=True, index=True),
            sa.Column(
                "transaction_id",
                sa.Integer(),
                sa.ForeignKey("business_transactions.id", ondelete="CASCADE"),
                nullable=False,
                index=True,
            ),
            sa.Column(
                "product_id",
                sa.Integer(),
                sa.ForeignKey("merchant_pos_products.id", ondelete="SET NULL"),
                nullable=True,
                index=True,
            ),
            sa.Column("item_name", sa.String(length=255), nullable=False),
            sa.Column("sku", sa.String(length=50), nullable=True, index=True),
            sa.Column("quantity", sa.Numeric(precision=18, scale=6), nullable=False, server_default="1"),
            sa.Column("quantity_precision", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("unit_of_measure", sa.String(length=20), nullable=False, server_default="pcs"),
            sa.Column("conversion_factor", sa.Numeric(precision=18, scale=6), nullable=False, server_default="1"),
            sa.Column("base_uom_quantity", sa.Numeric(precision=18, scale=6), nullable=False, server_default="1"),
            sa.Column("unit_price", sa.Numeric(precision=20, scale=2), nullable=False, server_default="0"),
            sa.Column("free_quantity", sa.Numeric(precision=18, scale=6), nullable=False, server_default="0"),
            sa.Column("min_qty", sa.Numeric(precision=18, scale=6), nullable=True),
            sa.Column("max_qty", sa.Numeric(precision=18, scale=6), nullable=True),
            sa.Column("discount_type", sa.String(length=20), nullable=True, server_default="NONE"),
            sa.Column("discount_rate", sa.Numeric(precision=9, scale=4), nullable=True, server_default="0"),
            sa.Column("line_discount_amount", sa.Numeric(precision=20, scale=2), nullable=False, server_default="0"),
            sa.Column("allocated_header_discount", sa.Numeric(precision=20, scale=2), nullable=False, server_default="0"),
            sa.Column("coupon_code", sa.String(length=50), nullable=True),
            sa.Column("promotion_id", sa.Integer(), nullable=True, index=True),
            sa.Column("gross_amount", sa.Numeric(precision=20, scale=2), nullable=False, server_default="0"),
            sa.Column("net_item_amount", sa.Numeric(precision=20, scale=2), nullable=False, server_default="0"),
            sa.Column("created_at", sa.DateTime(), nullable=True),
        )

    # --- the tax of the sale -------------------------------------------------
    if "business_transaction_taxes" not in tables:
        op.create_table(
            "business_transaction_taxes",
            sa.Column("id", sa.Integer(), primary_key=True, index=True),
            sa.Column(
                "transaction_id",
                sa.Integer(),
                sa.ForeignKey("business_transactions.id", ondelete="CASCADE"),
                nullable=False,
                index=True,
            ),
            sa.Column(
                "transaction_item_id",
                sa.Integer(),
                sa.ForeignKey("business_transaction_items.id", ondelete="CASCADE"),
                nullable=True,
                index=True,
            ),
            sa.Column(
                "tax_rule_id",
                sa.Integer(),
                sa.ForeignKey("tax_rules.id", ondelete="SET NULL"),
                nullable=True,
                index=True,
            ),
            sa.Column("tax_code", sa.String(length=30), nullable=False, index=True),
            sa.Column("tax_type", sa.String(length=30), nullable=False, index=True),
            sa.Column("tax_behavior", sa.String(length=20), nullable=False, server_default="ADDITIVE", index=True),
            sa.Column("tax_inclusion", sa.String(length=20), nullable=False, server_default="EXCLUSIVE"),
            sa.Column("tax_category", sa.String(length=20), nullable=False, server_default="STANDARD"),
            sa.Column("tax_base_method", sa.String(length=20), nullable=False, server_default="FULL_NET"),
            sa.Column("tax_rate", sa.Numeric(precision=9, scale=4), nullable=False, server_default="0"),
            sa.Column("taxable_amount", sa.Numeric(precision=20, scale=2), nullable=False, server_default="0"),
            sa.Column("tax_amount", sa.Numeric(precision=20, scale=2), nullable=False, server_default="0"),
            sa.Column("tax_exemption_code", sa.String(length=60), nullable=True),
            sa.Column("tax_exemption_reason", sa.Text(), nullable=True),
            sa.Column("tax_account_id", sa.Integer(), sa.ForeignKey("accounts.id"), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
        )

    # --- the money that settled the sale ------------------------------------
    if "business_transaction_payments" not in tables:
        op.create_table(
            "business_transaction_payments",
            sa.Column("id", sa.Integer(), primary_key=True, index=True),
            sa.Column(
                "transaction_id",
                sa.Integer(),
                sa.ForeignKey("business_transactions.id", ondelete="CASCADE"),
                nullable=False,
                index=True,
            ),
            sa.Column("payment_method", sa.String(length=20), nullable=False, server_default="CASH", index=True),
            sa.Column("payment_currency", sa.String(length=10), nullable=False, server_default="IDR"),
            sa.Column("amount_paid", sa.Numeric(precision=20, scale=2), nullable=False, server_default="0"),
            sa.Column("settlement_exchange_rate", sa.Numeric(precision=20, scale=10), nullable=True, server_default="1"),
            sa.Column("processing_fee", sa.Numeric(precision=20, scale=2), nullable=False, server_default="0"),
            sa.Column("refund_amount", sa.Numeric(precision=20, scale=2), nullable=False, server_default="0"),
            sa.Column("payment_reference", sa.String(length=120), nullable=True, index=True),
            sa.Column("paid_at", sa.DateTime(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
        )

    # --- the books of the merchant ------------------------------------------
    if "accounting_entries" not in tables:
        op.create_table(
            "accounting_entries",
            sa.Column("id", sa.Integer(), primary_key=True, index=True),
            sa.Column(
                "transaction_id",
                sa.Integer(),
                sa.ForeignKey("business_transactions.id", ondelete="CASCADE"),
                nullable=False,
                index=True,
            ),
            sa.Column("account_code", sa.String(length=40), nullable=False, index=True),
            sa.Column("debit_amount", sa.Numeric(precision=20, scale=2), nullable=False, server_default="0"),
            sa.Column("credit_amount", sa.Numeric(precision=20, scale=2), nullable=False, server_default="0"),
            sa.Column("functional_currency", sa.String(length=10), nullable=False, server_default="IDR"),
            sa.Column("fiscal_period", sa.String(length=20), nullable=True, index=True),
            sa.Column("memo", sa.String(length=255), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
        )


def downgrade():
    tables = _tables()

    # The tables go first, in the reverse order they were made, so
    # that nothing is dropped while something still points at it.
    #
    # The indexes go before the tables they stand on, because an
    # index that points at a column that is not there cannot be made.
    # Which indexes are there is asked first rather than found out by
    # trying: on PostgreSQL a statement that fails leaves the
    # transaction unusable, so a failure that is caught still spoils
    # everything that comes after it.
    from sqlalchemy import inspect

    for table in (
        "accounting_entries",
        "business_transaction_payments",
        "business_transaction_taxes",
        "business_transaction_items",
        "business_transactions",
        "tax_rules",
        "merchant_pos_products",
    ):
        if table not in tables:
            continue

        existing_indexes = {
            index["name"]
            for index in inspect(op.get_bind()).get_indexes(table)
            if index["name"]
        }
        for index_name in sorted(existing_indexes):
            if index_name.startswith("ix_"):
                op.drop_index(index_name, table_name=table)

        op.drop_table(table)
