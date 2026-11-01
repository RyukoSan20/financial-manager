
"""
The tables of a shared bill.

A bill shared between people has more than one side to it. There is
the group, the members in it, the receipt the host photographed, the
lines on that receipt, who claimed which line, how much each member
ends up owing, and the payments that settle it.

These are kept in separate tables because they are asked different
questions. The group is asked "which groups am I in". The claims are
asked "who has this coffee". The shares are asked "what does this
bill come to". Merging them into one table would make every one of
those questions slower and the answers harder to trust.

Nothing here changes how a transaction works. A transaction is still
a transaction. What is added is a link from a transaction to the
split bill it came from, so that a reader can see which part of a
month spending was their own and which part was somebody else money
that they were holding.
"""

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from datetime import datetime

from app.core.database import Base


class SplitGroup(Base):
    """
    A group of people who share bills.

    The name is what the group is called in the reader own words.
    `invite_code` is the short piece of the link that is shared, so
    that a friend can open it in a browser without installing
    anything.
    """

    __tablename__ = "split_groups"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)

    # The short code in the shared link. It is looked up on every
    # claim, so it is indexed and it is unique.
    invite_code = Column(String(32), nullable=False, unique=True, index=True)

    # The currency the bills are in. The shares are worked out in
    # this currency, so the rounding follows its rules.
    currency = Column(String(10), default="IDR", nullable=False)

    # Whether the group is still being used. A group is never
    # deleted, because a receipt that was shared is a record of
    # what happened, and the reader may want to look at it again.
    is_active = Column(Boolean, default=True, nullable=False)

    # When the group may be opened by somebody who has no account.
    # A group that is closed cannot be claimed from a link.
    allow_guest_claims = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    owner = relationship("User")
    members = relationship(
        "SplitMember",
        back_populates="group",
        cascade="all, delete-orphan",
        order_by="SplitMember.id",
    )
    expenses = relationship(
        "SplitExpense",
        back_populates="group",
        cascade="all, delete-orphan",
        order_by="SplitExpense.id",
    )
    settlements = relationship(
        "SplitSettlement",
        back_populates="group",
        cascade="all, delete-orphan",
        order_by="SplitSettlement.id",
    )


class SplitMember(Base):
    """
    One person in a group.

    A member may or may not have an account of their own. Somebody
    who was at the table and claimed their food without ever signing
    up is a member with a name and nothing else, and that is the
    whole point of the feature.

    `user_id` is there when the member is also a reader of this
    application. It is null for a guest.
    """

    __tablename__ = "split_members"
    __table_args__ = (
        UniqueConstraint("group_id", "display_name", name="uq_split_member_group_name"),
    )

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("split_groups.id"), nullable=False, index=True)

    # The reader of this application, when there is one.
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)

    # The name the group knows them by. It is what shows on the
    # receipt screen, so it is a short name and not an email address.
    display_name = Column(String(60), nullable=False)

    # A picture, so that the board of claims can show who is here.
    # It is a data address, not a file: the picture lives wherever
    # the reader pictures live.
    avatar_url = Column(String(255), nullable=True)

    # The colour of this member avatar, so that two people with
    # the same name are still told apart.
    avatar_color = Column(String(20), nullable=True)

    # Whether this member is the one who paid for the bill.
    is_host = Column(Boolean, default=False, nullable=False)

    # Whether this member can be reached at the table right now.
    # The board shows a live dot for the members who are.
    is_present = Column(Boolean, default=False, nullable=False)

    # The short token that lets this member claim items from a link
    # without an account. It is issued by the backend and it is
    # scoped to this group.
    claim_token = Column(String(64), nullable=True, index=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    group = relationship("SplitGroup", back_populates="members")
    user = relationship("User")
    claims = relationship(
        "SplitItemClaim",
        back_populates="member",
        cascade="all, delete-orphan",
    )
    payment_methods = relationship(
        "SplitPaymentMethod",
        back_populates="member",
        cascade="all, delete-orphan",
    )


class SplitExpense(Base):
    """
    One receipt, shared.

    The receipt itself is read by the scanner and its lines are kept
    in `SplitItem`. This row holds the shape of the bill: what it
    came to, what was paid for it, and whether it has been published
    to the group yet.

    A bill that is still being checked is `DRAFT`. A bill that has
    been shown to the group is `PUBLISHED`, and only then does it
    touch anybody money.
    """

    __tablename__ = "split_expenses"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("split_groups.id"), nullable=False, index=True)

    # Who put the receipt in. Not necessarily who paid for it.
    created_by_member_id = Column(
        Integer, ForeignKey("split_members.id"), nullable=True, index=True
    )

    # The reader who scanned it, when there is one.
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)

    name = Column(String(150), nullable=True)
    merchant_name = Column(String(150), nullable=True)
    receipt_date = Column(Date, nullable=True)

    # The receipt reader own receipt, when there is one. The
    # picture and the lines stay there, so the split bill does not
    # hold a second copy of the same thing.
    receipt_scan_id = Column(
        Integer, ForeignKey("receipt_scans.id"), nullable=True, index=True
    )

    # The money, in the currency of the group.
    subtotal = Column(Numeric(20, 2), nullable=True)
    tax = Column(Numeric(20, 2), nullable=True)
    service_charge = Column(Numeric(20, 2), nullable=True)
    discount = Column(Numeric(20, 2), nullable=True)
    grand_total = Column(Numeric(20, 2), nullable=True)

    # The difference between the lines and the subtotal that was
    # written on the receipt. It is kept because a bill whose lines
    # do not add up to its own subtotal has to be checked, and the
    # reader needs to be told which way it is out.
    discrepancy = Column(Numeric(20, 2), nullable=True)

    # DRAFT, PUBLISHED, or SETTLED.
    status = Column(String(20), default="DRAFT", nullable=False, index=True)

    # How the bill is to be divided. EQUAL, EXACT, PERCENTAGE, or
    # WEIGHT. An itemised bill is not a mode of dividing; it is a
    # bill where the members claimed their own lines.
    split_mode = Column(String(20), default="ITEMIZED", nullable=False)

    # The account the host paid from, when there is one. It is null
    # for a bill that was paid in cash and not recorded.
    payer_account_id = Column(Integer, ForeignKey("accounts.id"), nullable=True)

    # The transaction this bill became, once it was published. It is
    # null until then, and it stays null for a bill that was never
    # recorded against the reader own money.
    transaction_id = Column(Integer, ForeignKey("transactions.id"), nullable=True, index=True)

    # Whether the reader wants this bill in their own records. A bill
    # shared with friends is often not the reader spending at all.
    record_personal_share = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    group = relationship("SplitGroup", back_populates="expenses")
    items = relationship(
        "SplitItem",
        back_populates="expense",
        cascade="all, delete-orphan",
        order_by="SplitItem.id",
    )
    shares = relationship(
        "SplitCalculatedShare",
        back_populates="expense",
        cascade="all, delete-orphan",
    )
    payers = relationship(
        "SplitPayer",
        back_populates="expense",
        cascade="all, delete-orphan",
    )
    transaction = relationship("Transaction")


class SplitPayer(Base):
    """
    Who paid for a bill, and how much they paid.

    A bill can be paid by more than one person. That is what happens
    when two friends each hand over cash at the counter for the same
    dinner, and a bill that cannot record that will be wrong.
    """

    __tablename__ = "split_payers"

    id = Column(Integer, primary_key=True, index=True)
    expense_id = Column(Integer, ForeignKey("split_expenses.id"), nullable=False, index=True)
    member_id = Column(Integer, ForeignKey("split_members.id"), nullable=False, index=True)

    amount = Column(Numeric(20, 2), nullable=False)
    currency = Column(String(10), default="IDR", nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)

    expense = relationship("SplitExpense", back_populates="payers")
    member = relationship("SplitMember")


class SplitItem(Base):
    """
    One line of a shared receipt.

    A line is a thing that was ordered. `quantity` is kept apart
    from the price, because a line of two coffees is two coffees
    and either of them may be claimed by a different person.

    `kind` says what the line does to the bill: `item` adds to it,
    `tax` and `service` add to it, `discount` takes away from it.
    """

    __tablename__ = "split_items"

    id = Column(Integer, primary_key=True, index=True)
    expense_id = Column(Integer, ForeignKey("split_expenses.id"), nullable=False, index=True)

    # The line as it was read, and the line as it was understood.
    raw_name = Column(String(255), nullable=True)
    name = Column(String(255), nullable=False)

    quantity = Column(Numeric(10, 2), default=1, nullable=False)
    unit_price = Column(Numeric(20, 2), default=0, nullable=False)
    total_price = Column(Numeric(20, 2), default=0, nullable=False)

    # item, tax, service, discount.
    kind = Column(String(20), default="item", nullable=False)

    category = Column(String(100), nullable=True)

    # Whether the reader has accepted this line as it was read. A
    # line that has not been looked at is not part of the bill.
    is_verified = Column(Boolean, default=False, nullable=False)

    # Whether somebody has claimed this line. A line that is claimed
    # by nobody is not in the bill of anybody, and the screen says so.
    is_claimed = Column(Boolean, default=False, nullable=False)

    # Where the line was on the receipt, so the picture can show it.
    line_number = Column(Integer, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    expense = relationship("SplitExpense", back_populates="items")
    claims = relationship(
        "SplitItemClaim",
        back_populates="item",
        cascade="all, delete-orphan",
    )


class SplitItemClaim(Base):
    """
    Somebody claimed part of a line.

    `quantity` is how many of the things on that line they took. A
    line of two coffees, claimed by two people, is two rows here,
    each with a quantity of one.
    """

    __tablename__ = "split_item_claims"
    __table_args__ = (
        UniqueConstraint(
            "item_id", "member_id", name="uq_split_claim_item_member"
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey("split_items.id"), nullable=False, index=True)
    member_id = Column(Integer, ForeignKey("split_members.id"), nullable=False, index=True)

    quantity = Column(Numeric(10, 2), default=1, nullable=False)

    # When the claim was made. The board of claims shows who claimed
    # what and when.
    claimed_at = Column(DateTime, default=datetime.utcnow)

    item = relationship("SplitItem", back_populates="claims")
    member = relationship("SplitMember", back_populates="claims")


class SplitCalculatedShare(Base):
    """
    What one member owes for one bill.

    This is the answer, written down, so that the screen does not
    have to work it out again each time and so that the answer does
    not change when the rounding was done differently.
    """

    __tablename__ = "split_calculated_shares"

    id = Column(Integer, primary_key=True, index=True)
    expense_id = Column(Integer, ForeignKey("split_expenses.id"), nullable=False, index=True)
    member_id = Column(Integer, ForeignKey("split_members.id"), nullable=False, index=True)

    # The part of the items this member ate.
    item_total = Column(Numeric(20, 2), default=0, nullable=False)

    # The exact share before it was rounded to whole units.
    exact_amount = Column(Numeric(20, 2), nullable=False)

    # What the member actually pays.
    final_amount = Column(Numeric(20, 2), nullable=False)

    currency = Column(String(10), default="IDR", nullable=False)

    # Whether this has been paid. A share is paid when the group has
    # a settlement that covers it.
    is_paid = Column(Boolean, default=False, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)

    expense = relationship("SplitExpense", back_populates="shares")
    member = relationship("SplitMember")


class SplitSettlement(Base):
    """
    A payment that settles part of a group.

    This is the record of money changing hands between members. It is
    not a transaction and it is not income: the money was always the
    reader own, or was owed to the reader, and coming back is not
    earning.
    """

    __tablename__ = "split_settlements"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("split_groups.id"), nullable=False, index=True)

    # Who paid, and who was paid.
    from_member_id = Column(
        Integer, ForeignKey("split_members.id"), nullable=False, index=True
    )
    to_member_id = Column(
        Integer, ForeignKey("split_members.id"), nullable=False, index=True
    )

    amount = Column(Numeric(20, 2), nullable=False)
    currency = Column(String(10), default="IDR", nullable=False)

    # The receipt this payment settles. A settlement belongs to a
    # receipt, so that the money that comes back can be tied to the
    # bill it came back for.
    expense_id = Column(
        Integer, ForeignKey("split_expenses.id"), nullable=True, index=True
    )

    # PENDING, PAID, or CANCELLED.
    status = Column(String(20), default="PENDING", nullable=False, index=True)

    # The proof of the payment: a picture of the transfer receipt.
    proof_url = Column(String(255), nullable=True)

    # What the reader of the picture made of it: the amount that was
    # read and the date it was read.
    proof_amount = Column(Numeric(20, 2), nullable=True)
    proof_date = Column(Date, nullable=True)
    proof_note = Column(Text, nullable=True)

    # The transaction this settlement made, when the money went into
    # an account of the reader own.
    transaction_id = Column(Integer, ForeignKey("transactions.id"), nullable=True, index=True)

    settled_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    group = relationship("SplitGroup", back_populates="settlements")
    from_member = relationship("SplitMember", foreign_keys=[from_member_id])
    to_member = relationship("SplitMember", foreign_keys=[to_member_id])
    transaction = relationship("Transaction")


class SplitPaymentMethod(Base):
    """
    How a member wants to be paid.

    The account number and the name on the account are private. They
    are encrypted before they are written down, and they are only
    read when somebody in the group has something to settle.

    The reason they are kept at all is the practical one: a person
    who owes money should not have to ask for a bank account number
    in a group chat.
    """

    __tablename__ = "split_payment_methods"

    id = Column(Integer, primary_key=True, index=True)
    member_id = Column(Integer, ForeignKey("split_members.id"), nullable=False, index=True)

    # CASH, BANK, EWALLET, or QRIS.
    method_type = Column(String(20), default="BANK", nullable=False)

    # The label the member gave it, so the list reads like theirs:
    # "BCA", "GoPay", "QRIS".
    label = Column(String(60), nullable=True)

    # The bank or wallet name, which is not private in the same way
    # a number is.
    provider_name = Column(String(60), nullable=True)

    # The account number and the name on the account, encrypted.
    account_number_encrypted = Column(Text, nullable=True)
    account_holder_encrypted = Column(Text, nullable=True)

    # The last four digits, kept in the clear so that the list can
    # show which account it is without anybody having to read the
    # whole number.
    account_number_hint = Column(String(8), nullable=True)

    # A picture of a QRIS code, if there is one.
    qris_image_url = Column(String(255), nullable=True)

    # Whether this is the one to use when there is a choice.
    is_default = Column(Boolean, default=False, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    member = relationship("SplitMember", back_populates="payment_methods")
