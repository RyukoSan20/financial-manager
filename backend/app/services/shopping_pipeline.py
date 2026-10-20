"""
Logika bisnis pipeline belanja (bagian yang menyentuh database).

TITIK INTEGRASI — sesuaikan dengan kode transaksimu yang sudah ada:
  1. _create_expense_transaction : buat transaksi pengeluaran + kurangi saldo akun
  2. _void_transaction           : batalkan transaksi + kembalikan saldo akun
Kalau transactions.py sudah punya fungsi create/delete, panggil fungsi itu dari
sini supaya hanya ada SATU jalur kode yang mengubah saldo.

Asumsi nama: app.models.{account,category,transaction,shopping_item}; Account.balance
disimpan sebagai kolom; Transaction punya user_id, type, amount, category_id,
account_id, date, description.
"""
from __future__ import annotations

from datetime import date as Date

from sqlalchemy import and_, func, or_, select, update
from sqlalchemy.orm import Session

from app.models.account import Account
from app.models.category import Category
from app.models.shopping_item import ShoppingItem
from app.models.transaction import Transaction
from app.schemas.kanban_board import (
    BoardItem, PurchaseIn, ReportOut, ReportRow, StageColumn, StageMoveIn,
)
from app.services import shopping_rules as rules


class PipelineError(Exception):
    status_code = 400


class NotFound(PipelineError):
    status_code = 404


class InvalidTransition(PipelineError):
    status_code = 409


class InvalidInput(PipelineError):
    status_code = 422


# --------------------------------------------------------------------------- baca

def _view_stmt(user_id: int):
    """Satu query untuk item + nominal transaksi + nama kategori (tanpa N+1)."""
    return (
        select(ShoppingItem, Transaction.amount, Category.name)
        .outerjoin(Transaction, Transaction.id == ShoppingItem.transaction_id)
        .outerjoin(Category, Category.id == ShoppingItem.category_id)
        .where(ShoppingItem.user_id == user_id)
    )


def _to_view(item: ShoppingItem, tx_amount, category_name) -> BoardItem:
    if tx_amount is not None:
        amount = int(tx_amount)
    elif item.price is not None:
        amount = int(item.price) * item.quantity
    else:
        amount = None
    return BoardItem(
        id=item.id, name=item.name, quantity=item.quantity, price=item.price, amount=amount,
        stage=item.stage, position=item.position, marketplace=item.marketplace,
        category_id=item.category_id, category_name=category_name, product_url=item.product_url,
        tracking_number=item.tracking_number, courier=item.courier, rating=item.rating,
        notes=item.notes, purchased_at=item.purchased_at, received_at=item.received_at,
        transaction_id=item.transaction_id, allowed_next=rules.allowed_next(item.stage),
    )


def get_item_view(db: Session, user_id: int, item_id: int) -> BoardItem:
    row = db.execute(_view_stmt(user_id).where(ShoppingItem.id == item_id)).first()
    if row is None:
        raise NotFound("Item tidak ditemukan.")
    return _to_view(*row)


def _escape_like(text: str) -> str:
    return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def build_board(
    db: Session, user_id: int, *, month: str | None = None, category_id: int | None = None,
    min_price: int | None = None, max_price: int | None = None, q: str | None = None,
    limit: int = 500,
) -> list[StageColumn]:
    stmt = _view_stmt(user_id)

    if month:
        try:
            lo, hi = rules.month_bounds(month)
        except ValueError as exc:
            raise InvalidInput("Format bulan harus YYYY-MM, contoh 2026-10.") from exc
        when = func.coalesce(ShoppingItem.purchased_at, ShoppingItem.created_at)
        # Item rencana (wishlist / mau dibeli) tidak terikat bulan; sisanya difilter.
        stmt = stmt.where(or_(ShoppingItem.stage.in_(("wishlist", "to_buy")), and_(when >= lo, when < hi)))
    if category_id is not None:
        stmt = stmt.where(ShoppingItem.category_id == category_id)
    if min_price is not None:
        stmt = stmt.where(ShoppingItem.price >= min_price)
    if max_price is not None:
        stmt = stmt.where(ShoppingItem.price <= max_price)
    if q:
        stmt = stmt.where(ShoppingItem.name.ilike(f"%{_escape_like(q.strip())}%", escape="\\"))

    stmt = stmt.order_by(ShoppingItem.position, ShoppingItem.id).limit(limit)

    buckets: dict[str, list[BoardItem]] = {s: [] for s in rules.STAGE_ORDER}
    for item, tx_amount, category_name in db.execute(stmt).all():
        buckets[item.stage].append(_to_view(item, tx_amount, category_name))

    return [
        StageColumn(key=s, count=len(v), total=sum(i.amount or 0 for i in v), items=v)
        for s, v in buckets.items()
    ]


# ------------------------------------------------------------------------ tulis

def _locked_item(db: Session, user_id: int, item_id: int) -> ShoppingItem:
    """Kunci baris item (SELECT ... FOR UPDATE) agar dua request bersamaan tidak saling menimpa."""
    item = db.execute(
        select(ShoppingItem)
        .where(ShoppingItem.id == item_id, ShoppingItem.user_id == user_id)
        .with_for_update()
    ).scalar_one_or_none()
    if item is None:
        raise NotFound("Item tidak ditemukan.")
    return item


def _next_position(db: Session, user_id: int, stage: str) -> int:
    top = db.execute(
        select(func.coalesce(func.max(ShoppingItem.position), -1))
        .where(ShoppingItem.user_id == user_id, ShoppingItem.stage == stage)
    ).scalar_one()
    return top + 1


def _create_expense_transaction(db: Session, user_id: int, item: ShoppingItem, data: PurchaseIn) -> int:
    """TITIK INTEGRASI #1. Mengembalikan id transaksi baru. Tidak commit (dipanggil dalam satu transaksi DB)."""
    owns_account = db.execute(
        select(Account.id).where(Account.id == data.account_id, Account.user_id == user_id)
    ).scalar_one_or_none()
    if owns_account is None:
        raise NotFound("Akun tidak ditemukan.")

    category_id = data.category_id or item.category_id
    if category_id is not None:
        usable = db.execute(
            select(Category.id).where(
                Category.id == category_id,
                or_(Category.user_id == user_id, Category.user_id.is_(None)),  # kategori sistem: user_id NULL
            )
        ).scalar_one_or_none()
        if usable is None:
            raise NotFound("Kategori tidak ditemukan.")

    tx = Transaction(
        user_id=user_id, type="expense", amount=data.amount, category_id=category_id,
        account_id=data.account_id, date=data.date or rules.today_wib(),
        description=f"Belanja: {item.name}",
    )
    db.add(tx)
    db.flush()  # dapatkan tx.id

    # Update saldo secara atomik di SQL (bukan baca -> hitung -> tulis) agar aman dari race condition.
    db.execute(
        update(Account)
        .where(Account.id == data.account_id, Account.user_id == user_id)
        .values(balance=Account.balance - data.amount)
    )
    return tx.id


def _void_transaction(db: Session, user_id: int, item: ShoppingItem) -> None:
    """TITIK INTEGRASI #2. Membatalkan transaksi terkait dan mengembalikan saldo.

    Saat ini transaksi dihapus keras. Kalau modelmu punya soft delete (voided_at),
    gunakan itu supaya jejak audit keuangan tidak hilang.
    """
    tx = db.execute(
        select(Transaction).where(Transaction.id == item.transaction_id, Transaction.user_id == user_id).with_for_update()
    ).scalar_one_or_none()
    if tx is not None:
        db.execute(
            update(Account)
            .where(Account.id == tx.account_id, Account.user_id == user_id)
            .values(balance=Account.balance + tx.amount)
        )
        db.delete(tx)
    item.transaction_id = None
    item.purchased_at = None


def purchase_item(db: Session, user_id: int, item_id: int, data: PurchaseIn) -> tuple[BoardItem, int, bool]:
    """Catat pembelian: buat transaksi + pindahkan item. Idempoten per item.

    Memanggil ulang untuk item yang sudah dibeli mengembalikan hasil yang sama
    (already_purchased=True) tanpa membuat transaksi kedua — aman terhadap tap ganda
    dan retry jaringan.
    """
    item = _locked_item(db, user_id, item_id)

    if item.transaction_id is not None:
        existing_tx = item.transaction_id  # ambil sebelum rollback (atribut kedaluwarsa setelahnya)
        db.rollback()  # lepaskan kunci
        return get_item_view(db, user_id, item_id), existing_tx, True

    # Item yang sudah "dibayar" tapi transaksinya terhapus di tempat lain (FK SET NULL)
    # boleh dicatat ulang tanpa mengubah tahapnya.
    orphaned = item.stage in rules.PAID_STAGES
    if not orphaned and not rules.can_move(item.stage, "ordered"):
        raise InvalidTransition(f"Item di tahap '{item.stage}' tidak bisa dicatat sebagai pembelian.")

    tx_id = _create_expense_transaction(db, user_id, item, data)

    item.transaction_id = tx_id
    item.category_id = data.category_id or item.category_id
    item.purchased_at = rules.now_wib()
    if not orphaned:
        if data.mark_received:
            item.stage = "received"
            item.received_at = item.purchased_at
        else:
            item.stage = "ordered"
        item.position = _next_position(db, user_id, item.stage)
    db.commit()

    return get_item_view(db, user_id, item_id), tx_id, False


def move_item(db: Session, user_id: int, item_id: int, data: StageMoveIn) -> BoardItem:
    item = _locked_item(db, user_id, item_id)
    target = data.stage

    if target == item.stage:
        db.rollback()
        return get_item_view(db, user_id, item_id)  # idempoten
    if target == "ordered":
        raise InvalidTransition("Pindah ke 'Dipesan' lewat pencatatan pembelian agar pengeluaran ikut tercatat.")
    if not rules.can_move(item.stage, target):
        raise InvalidTransition(f"Item tidak bisa dipindah dari '{item.stage}' ke '{target}'.")

    if target == "cancelled" and item.transaction_id is not None:
        _void_transaction(db, user_id, item)
    if target == "shipped":
        item.tracking_number = data.tracking_number or item.tracking_number
        item.courier = data.courier or item.courier
    if target == "received":
        item.received_at = rules.now_wib()
        if data.rating is not None:
            item.rating = data.rating
    if data.notes is not None:
        item.notes = data.notes

    item.stage = target
    item.position = _next_position(db, user_id, target)
    db.commit()
    return get_item_view(db, user_id, item_id)


# ---------------------------------------------------------------------- laporan

def expense_report(db: Session, user_id: int, start: Date, end: Date) -> ReportOut:
    if end < start:
        raise InvalidInput("Tanggal akhir harus sama dengan atau setelah tanggal awal.")
    if (end - start).days > 366:
        raise InvalidInput("Rentang laporan maksimal 366 hari.")

    lo, hi = rules.day_range_bounds(start, end)
    rows = db.execute(
        select(Transaction.amount, Category.name, ShoppingItem.marketplace)
        .select_from(ShoppingItem)
        .join(Transaction, Transaction.id == ShoppingItem.transaction_id)
        .outerjoin(Category, Category.id == ShoppingItem.category_id)
        .where(
            ShoppingItem.user_id == user_id,
            ShoppingItem.stage.in_(rules.PAID_STAGES),
            ShoppingItem.purchased_at >= lo,
            ShoppingItem.purchased_at < hi,
        )
        .limit(10_000)
    ).all()

    total = sum(int(r[0]) for r in rows)
    count = len(rows)
    return ReportOut(
        start=start, end=end, total=total, count=count,
        average=total // count if count else 0,
        by_category=[ReportRow(**r) for r in rules.rollup((r[1] or "Tanpa kategori", r[0]) for r in rows)],
        by_marketplace=[ReportRow(**r) for r in rules.rollup((r[2] or "Tanpa toko", r[0]) for r in rows)],
    )
