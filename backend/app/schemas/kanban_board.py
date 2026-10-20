"""
Skema Pydantic v2 untuk papan belanja. Python 3.9+ compatible.
"""
from datetime import date as Date
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

Stage = Literal["wishlist", "to_buy", "ordered", "shipped", "received", "cancelled"]


class BoardItem(BaseModel):
    id: int
    name: str
    quantity: int
    price: Optional[int] = None          # harga satuan rencana
    amount: Optional[int] = None         # total: nominal transaksi bila sudah dibeli, selain itu price x quantity
    stage: Stage
    position: int
    marketplace: Optional[str] = None
    category_id: Optional[int] = None
    category_name: Optional[str] = None
    product_url: Optional[str] = None
    tracking_number: Optional[str] = None
    courier: Optional[str] = None
    rating: Optional[int] = None
    notes: Optional[str] = None
    purchased_at: Optional[datetime] = None
    received_at: Optional[datetime] = None
    transaction_id: Optional[int] = None
    allowed_next: list[Stage]         # UI hanya menawarkan perpindahan yang ada di sini


class StageColumn(BaseModel):
    key: Stage
    count: int
    total: int
    items: list[BoardItem]


class BoardOut(BaseModel):
    columns: list[StageColumn]


class StageMoveIn(BaseModel):
    stage: Stage
    tracking_number: Optional[str] = Field(None, max_length=64)
    courier: Optional[str] = Field(None, max_length=32)
    rating: Optional[int] = Field(None, ge=1, le=5)
    notes: Optional[str] = Field(None, max_length=500)


class PurchaseIn(BaseModel):
    amount: int = Field(gt=0, le=10_000_000_000, description="Total yang dibayar, rupiah utuh")
    account_id: int = Field(ge=1)
    category_id: Optional[int] = Field(None, ge=1)
    date: Optional[Date] = None           # default: hari ini (WIB)
    mark_received: bool = False        # beli langsung di toko -> langsung "received"


class PurchaseOut(BaseModel):
    item: BoardItem
    transaction_id: int
    already_purchased: bool


class ReportRow(BaseModel):
    label: str
    count: int
    total: int


class ReportOut(BaseModel):
    start: Date
    end: Date
    total: int
    count: int
    average: int
    by_category: list[ReportRow]
    by_marketplace: list[ReportRow]
