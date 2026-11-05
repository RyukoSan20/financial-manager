"""
What the shared bill accepts and what it answers with.

The request shapes are checked before anything is written down, so a
bill that has a price with three decimal places or a claim for a line
that does not exist is refused at the door rather than half-created.

The response shapes keep the numbers as strings where the amount is
money. A number that has been through a JSON encoder as a float has
already lost the last digit of a rupiah, so the money is written as
text and the screen reads it back.
"""

from typing import List, Optional

from pydantic import BaseModel, Field, field_validator
from decimal import Decimal

from app.schemas.base import EmptyStringAsNone


def _money(value: Optional[Decimal]) -> Optional[str]:
    """A number of money, as text."""
    if value is None:
        return None
    return str(value)


class SplitGroupCreate(EmptyStringAsNone):
    """A new group."""

    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    currency: str = Field(default="IDR", max_length=10)
    allow_guest_claims: bool = True

    @field_validator("currency")
    @classmethod
    def _upper(cls, value: str) -> str:
        return (value or "IDR").upper()


class SplitMemberCreate(EmptyStringAsNone):
    """
    A person in a group.

    A member may be a reader of this application or somebody at the
    table with no account at all.
    """

    display_name: str = Field(..., min_length=1, max_length=60)
    user_id: Optional[int] = None
    avatar_url: Optional[str] = Field(None, max_length=255)
    avatar_color: Optional[str] = Field(None, max_length=20)
    is_host: bool = False
    is_present: bool = False


class SplitMemberResponse(BaseModel):
    """One person in a group, as the screen sees them."""

    id: int
    group_id: int
    user_id: Optional[int] = None
    display_name: str
    avatar_url: Optional[str] = None
    avatar_color: Optional[str] = None
    is_host: bool
    is_present: bool
    has_claim_token: bool = False


class SplitGroupResponse(BaseModel):
    """A group, with the members in it."""

    id: int
    owner_id: int
    name: str
    description: Optional[str] = None
    invite_code: str
    currency: str
    is_active: bool
    allow_guest_claims: bool
    members: List[SplitMemberResponse] = []
    member_count: int = 0
    created_at: Optional[str] = None


class SplitItemInput(EmptyStringAsNone):
    """
    One line of a receipt, as it was read.

    The quantity is kept apart from the price, because a line of two
    coffees is two coffees and either of them may be claimed by a
    different person.
    """

    name: str = Field(..., min_length=1, max_length=255)
    raw_name: Optional[str] = Field(None, max_length=255)
    quantity: Decimal = Field(default=Decimal("1"), gt=0)
    unit_price: Decimal = Field(default=Decimal("0"), ge=0)
    total_price: Decimal = Field(default=Decimal("0"), ge=0)
    kind: str = Field(default="item")
    category: Optional[str] = Field(None, max_length=100)
    line_number: Optional[int] = None

    @field_validator("kind")
    @classmethod
    def _known_kind(cls, value: str) -> str:
        allowed = {"item", "tax", "service", "discount"}
        chosen = (value or "item").lower()
        if chosen not in allowed:
            return "item"
        return chosen


class SplitPayerInput(EmptyStringAsNone):
    """Who paid, and how much of the bill they paid."""

    member_id: int
    amount: Decimal = Field(..., ge=0)


class SplitExpenseCreate(EmptyStringAsNone):
    """
    A receipt, shared.

    The lines may be left out when the receipt was already read by
    the scanner: in that case the reader is given the lines it read.
    """

    name: Optional[str] = Field(None, max_length=150)
    merchant_name: Optional[str] = Field(None, max_length=150)
    receipt_date: Optional[str] = None
    receipt_scan_id: Optional[int] = None

    items: List[SplitItemInput] = []
    payers: List[SplitPayerInput] = []

    subtotal: Optional[Decimal] = Field(None, ge=0)
    tax: Optional[Decimal] = Field(None, ge=0)
    service_charge: Optional[Decimal] = Field(None, ge=0)
    discount: Optional[Decimal] = Field(None, ge=0)
    grand_total: Optional[Decimal] = Field(None, ge=0)

    split_mode: str = Field(default="ITEMIZED")
    payer_account_id: Optional[int] = None
    created_by_member_id: Optional[int] = None
    record_personal_share: bool = True

    # The transaction this bill came from, when there is one. A bill
    # made on its own has no transaction, and that is allowed.
    transaction_id: Optional[int] = None

    # Where the bill was, when the reader knows. A bill without a
    # place is still a bill; it just does not go on the map.
    latitude: Optional[Decimal] = Field(None, ge=-90, le=90)
    longitude: Optional[Decimal] = Field(None, ge=-180, le=180)
    place_name: Optional[str] = Field(None, max_length=255)

    @field_validator("split_mode")
    @classmethod
    def _known_mode(cls, value: str) -> str:
        allowed = {"ITEMIZED", "EQUAL", "EXACT", "PERCENTAGE", "WEIGHT"}
        chosen = (value or "ITEMIZED").upper()
        if chosen not in allowed:
            return "ITEMIZED"
        return chosen


class SplitClaimInput(EmptyStringAsNone):
    """
    Somebody claiming part of a line.

    The quantity is how many of the things on that line they took. A
    line of two coffees, claimed by two people, is two claims of one.

    The member is who took it. The host says who had what; the guest
    says it for themselves, and the guest's own member is worked out
    from their pass rather than taken from the request.
    """

    item_id: int
    quantity: Decimal = Field(default=Decimal("1"), gt=0)
    member_id: Optional[int] = None


class SplitShareResponse(BaseModel):
    """What one member owes for one bill."""

    member_id: int
    display_name: str = ""
    item_total: str = "0"
    exact_amount: str = "0"
    final_amount: str = "0"
    is_paid: bool = False


class SplitItemResponse(BaseModel):
    """One line, with who has claimed it."""

    id: int
    name: str
    raw_name: Optional[str] = None
    quantity: str = "1"
    unit_price: str = "0"
    total_price: str = "0"
    kind: str = "item"
    category: Optional[str] = None
    is_verified: bool = False
    is_claimed: bool = False
    claims: List[dict] = []


class SplitExpenseResponse(BaseModel):
    """A receipt, shared, with everything that was worked out."""

    id: int
    group_id: int
    name: Optional[str] = None
    merchant_name: Optional[str] = None
    receipt_date: Optional[str] = None
    status: str = "DRAFT"
    split_mode: str = "ITEMIZED"
    subtotal: Optional[str] = None
    tax: Optional[str] = None
    service_charge: Optional[str] = None
    discount: Optional[str] = None
    grand_total: Optional[str] = None
    discrepancy: Optional[str] = None
    record_personal_share: bool = True
    transaction_id: Optional[int] = None
    items: List[SplitItemResponse] = []
    shares: List[SplitShareResponse] = []
    payers: List[dict] = []
    created_at: Optional[str] = None


class SplitBalanceResponse(BaseModel):
    """
    What one member owes, or is owed, across a whole group.

    `net_position` is positive when the group owes them and negative
    when they owe the group.
    """

    member_id: int
    display_name: str = ""
    net_position: str = "0"
    total_paid: str = "0"
    total_owed: str = "0"


class SplitTransferResponse(BaseModel):
    """One payment that settles part of a group."""

    from_member: str
    to_member: str
    amount: str


class SplitSettlementCreate(EmptyStringAsNone):
    """A payment between two members."""

    from_member_id: int
    to_member_id: int
    amount: Decimal = Field(..., gt=0)
    # Which receipt this payment settles. It is optional, because a
    # payment can be for the whole group rather than for one receipt.
    expense_id: Optional[int] = None
    proof_url: Optional[str] = Field(None, max_length=255)
    proof_amount: Optional[Decimal] = Field(None, ge=0)
    proof_date: Optional[str] = None
    proof_note: Optional[str] = Field(None, max_length=500)


class SplitSettlementResponse(BaseModel):
    """A payment between two members, as the screen sees it."""

    id: int
    group_id: int
    from_member_id: int
    to_member_id: int
    from_member_name: str = ""
    to_member_name: str = ""
    amount: str
    currency: str = "IDR"
    status: str = "PENDING"
    proof_url: Optional[str] = None
    proof_amount: Optional[str] = None
    proof_date: Optional[str] = None
    settled_at: Optional[str] = None
    created_at: Optional[str] = None


class SplitPaymentMethodCreate(EmptyStringAsNone):
    """
    How a member wants to be paid.

    The account number and the name on the account are encrypted
    before they are written down.
    """

    method_type: str = Field(default="BANK")
    label: Optional[str] = Field(None, max_length=60)
    provider_name: Optional[str] = Field(None, max_length=60)
    account_number: Optional[str] = Field(None, max_length=100)
    account_holder: Optional[str] = Field(None, max_length=100)
    qris_image_url: Optional[str] = Field(None, max_length=255)
    is_default: bool = False

    @field_validator("method_type")
    @classmethod
    def _known_type(cls, value: str) -> str:
        allowed = {"CASH", "BANK", "EWALLET", "QRIS"}
        chosen = (value or "BANK").upper()
        if chosen not in allowed:
            return "BANK"
        return chosen


class SplitPaymentMethodResponse(BaseModel):
    """
    How a member wants to be paid.

    The account number is not in here. It is given out only when
    somebody in the group has something to settle, and then only the
    last four digits are shown before the full number is copied.
    """

    id: int
    member_id: int
    method_type: str = "BANK"
    label: Optional[str] = None
    provider_name: Optional[str] = None
    account_number_hint: Optional[str] = None
    qris_image_url: Optional[str] = None
    is_default: bool = False


class SplitGuestJoin(EmptyStringAsNone):
    """
    Somebody at the table claiming their place in the group.

    They give the name they want to be called. They do not need an
    account, and they do not need to install anything.
    """

    display_name: str = Field(..., min_length=1, max_length=60)


class SplitGuestSessionResponse(BaseModel):
    """
    The short pass a guest is given.

    It is scoped to one group and it lasts a day. It is what lets
    somebody claim their food from a link in a chat window.
    """

    member_id: int
    display_name: str
    claim_token: str
    group_id: int
    group_name: str


class SplitDecomposeRequest(EmptyStringAsNone):
    """
    The lines a receipt was read into.

    This is what the scanner produced. The reader of the receipt
    hands those lines over, and the answer is what each line means
    and what the receipt adds up to.
    """

    lines: List[str] = []
    currency: str = Field(default="IDR", max_length=10)
    # When the reader asks for the model to be used, it is used if it
    # is there. When they do not, the plain reading is used.
    use_model: bool = True


class SplitDecomposedItem(BaseModel):
    """
    One dish on the receipt, with its quantity kept apart.

    A line of two coffees is two coffees, and either of them may be
    claimed by a different person at the table.
    """

    name: str
    raw_name: str = ""
    quantity: str = "1"
    unit_price: str = "0.00"
    total_price: str = "0.00"
    kind: str = "item"
    line_number: Optional[int] = None


class SplitDecomposeResponse(BaseModel):
    """
    A receipt, read.

    Nothing is written down. This is a proposal, and the reader
    decides whether to make a bill out of it.
    """

    items: List[SplitDecomposedItem] = []
    tax: str = "0.00"
    service_charge: str = "0.00"
    discount: str = "0.00"
    subtotal: str = "0.00"
    grand_total: str = "0.00"
    # The gap between the lines and the subtotal, when there is one.
    discrepancy: Optional[str] = None
    # Whether the model was asked, and whether it answered.
    understood_by_model: bool = False


class SplitImportRequest(EmptyStringAsNone):
    """
    A transaction of the reader's, pulled into a bill.

    The tax and the discount are optional. When they are not given,
    the ones the receipt carries are used, so that the bill adds up to
    what was paid without the reader having to type them.
    """

    tax: Optional[Decimal] = Field(default=None, ge=0)
    discount: Optional[Decimal] = Field(default=None, ge=0)


class SplitAssignRequest(EmptyStringAsNone):
    """
    Who had what, all at once.

    The keys of the map are the ids of the lines of the receipt, and
    the values are the ids of the people at the table. A line whose
    value is null is free again.
    """

    assignments: dict = Field(default_factory=dict)
