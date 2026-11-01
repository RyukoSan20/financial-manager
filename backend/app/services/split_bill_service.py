"""
The shared bill, from the receipt to the settled debt.

This is where the arithmetic of a shared bill meets the tables it is
written into. The arithmetic itself lives in `split_engine_service`
and `debt_simplifier_service`; this module is the one that decides
what a receipt says, who owes what, and which numbers are written
down.

Two rules run through all of it:

- The total of the shares is the total of the receipt. Not close to
  it. Exactly it.
- A bill that has not been published yet changes nothing. Nothing is
  written to the reader's transactions, nothing moves in their
  accounts, and nothing is owed by anybody. A draft is a draft.
"""

from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.models.split_bill import (
    SplitCalculatedShare,
    SplitExpense,
    SplitGroup,
    SplitItem,
    SplitItemClaim,
    SplitMember,
    SplitPayer,
    SplitSettlement,
)
from app.services.debt_simplifier_service import simplify_debts
from app.services.split_engine_service import (
    exponent_for,
    BillLine,
    allocate_proportionally,
    equal_split,
    largest_remainder,
)

ZERO = Decimal("0")


def _dec(value) -> Decimal:
    """Any number that came from the database, as a decimal."""
    if value is None:
        return ZERO
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def _money(value) -> Decimal:
    """A number of money, to the smallest unit."""
    return _dec(value).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def read_receipt_totals(expense: SplitExpense) -> Dict[str, Decimal]:
    """
    The four numbers that add up to a bill.

    A receipt is read line by line, and the lines are not always
    tidy. A tax line may be missing, a service charge may be written
    as a percentage, and the total on the paper may be the one number
    that is certainly right.
    """
    subtotal = _dec(expense.subtotal)
    tax = _dec(expense.tax)
    service = _dec(expense.service_charge)
    discount = _dec(expense.discount)
    grand = _dec(expense.grand_total)

    if grand == ZERO:
        # The total was not read off the receipt, so it is worked out
        # from the lines.
        grand = subtotal + tax + service - discount

    if subtotal == ZERO:
        # The subtotal was not read off, so it is the total less the
        # extras.
        subtotal = grand - tax - service + discount
        if subtotal < ZERO:
            subtotal = ZERO

    return {
        "subtotal": _money(subtotal),
        "tax": _money(tax),
        "service_charge": _money(service),
        "discount": _money(discount),
        "grand_total": _money(grand),
    }


def lines_total(items: List[SplitItem]) -> Decimal:
    """What the lines of a receipt add up to, on their own."""
    total = ZERO
    for item in items:
        if item.kind != "item":
            continue
        total += _dec(item.total_price)
    return _money(total)


def find_discrepancy(
    items: List[SplitItem], totals: Dict[str, Decimal]
) -> Optional[Decimal]:
    """
    The gap between what the lines say and what the receipt says.

    A receipt whose lines do not add up to its own subtotal is a
    receipt that was read wrong somewhere. The reader is told how
    much the gap is, so they can decide whether it is a tax line
    they missed or a price they have to correct.
    """
    from_lines = lines_total(items)
    subtotal = totals["subtotal"]
    if subtotal == ZERO:
        return None
    # A receipt with no lines on it has nothing to compare against
    # its subtotal. It has not been read wrongly; it has simply not
    # been filled in yet.
    if not any(item.kind == "item" for item in items):
        return None
    difference = from_lines - subtotal
    if difference == ZERO:
        return None
    return _money(difference)


def describe_discrepancy(
    discrepancy: Optional[Decimal], currency: str = "IDR"
) -> Optional[str]:
    """
    The gap, said in words.

    The reader has to be able to see at once whether this is a tax
    line they missed or a price they have to correct, so the amount
    is written the way the currency is written, with the thousands
    mark and no decimals for a currency that has no small unit.
    """
    if discrepancy is None:
        return None
    gap = abs(_dec(discrepancy))
    if gap == ZERO:
        return None

    exponent = exponent_for(currency)
    if exponent == 0:
        shown = f"{gap.quantize(Decimal('1')):,.0f}".replace(",", ".")
    else:
        shown = f"{gap.quantize(Decimal('0.01')):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

    symbol = {"IDR": "Rp", "JPY": "¥", "USD": "$", "EUR": "€"}.get(
        (currency or "IDR").upper(), ""
    )
    return (
        f"There is a difference of {symbol}{shown} between the list of items "
        f"and the subtotal of the receipt."
    )


def build_lines(items: List[SplitItem]) -> List[BillLine]:
    """The receipt as the arithmetic wants to see it."""
    return [
        BillLine(
            line_id=str(item.id),
            name=item.name,
            quantity=_dec(item.quantity),
            unit_price=_dec(item.unit_price),
            total_price=_dec(item.total_price),
            kind=item.kind or "item",
        )
        for item in items
    ]


def build_claims(
    db: Session, expense_id: int
) -> Dict[str, Dict[str, Decimal]]:
    """
    Who claimed how much of each line.

    The keys are text on both levels: the line and the member. The
    arithmetic module works in text keys so that the same member
    means the same thing whatever the number behind it was, and the
    keys are turned back into numbers where they are written down.
    """
    rows = (
        db.query(SplitItemClaim)
        .join(SplitItem, SplitItemClaim.item_id == SplitItem.id)
        .filter(SplitItem.expense_id == expense_id)
        .all()
    )
    claims: Dict[str, Dict[str, Decimal]] = {}
    for row in rows:
        line = claims.setdefault(str(row.item_id), {})
        key = str(row.member_id)
        line[key] = line.get(key, ZERO) + _dec(row.quantity)
    return claims


def equal_shares(
    members: List[SplitMember], total: Decimal
) -> Dict[int, Decimal]:
    """The same amount for everybody, with the leftover handed out."""
    keys = [str(member.id) for member in members]
    shares = equal_split(_money(total), keys)
    return {int(key): _money(value) for key, value in shares.items()}


def proportional_shares(
    items: List[SplitItem],
    claims: Dict[str, Dict[int, Decimal]],
    totals: Dict[str, Decimal],
) -> Tuple[Dict[int, Decimal], Dict[int, Decimal], Decimal]:
    """
    What each member pays, with tax, service and discount spread
    across them in proportion to what they ate.

    The tax on a plate of rice is not the same as the tax on a
    steak. Splitting the tax equally would be wrong, and a bill that
    is wrong about tax is wrong about everything.
    """
    allocation = allocate_proportionally(
        build_lines(items),
        {line: {member: amount for member, amount in members.items()} for line, members in claims.items()},
        grand_total=totals["grand_total"],
        tax=totals["tax"],
        service=totals["service_charge"],
        discount=totals["discount"],
    )
    shares = {
        int(key): _money(value) for key, value in allocation.shares.items()
    }
    item_totals = {
        int(key): _money(value) for key, value in allocation.item_totals.items()
    }
    return shares, item_totals, _money(allocation.discrepancy)


def recompute_expense(
    db: Session,
    expense: SplitExpense,
    members: List[SplitMember],
    currency: str = "IDR",
) -> List[SplitCalculatedShare]:
    """
    Work out what everybody owes for this bill, and write it down.

    The written shares replace the ones that were there. A claim that
    was taken back changes the number, and the number that is on the
    screen is the number that was worked out.
    """
    totals = read_receipt_totals(expense)
    grand = totals["grand_total"]

    db.query(SplitCalculatedShare).filter(
        SplitCalculatedShare.expense_id == expense.id
    ).delete(synchronize_session=False)

    items = (
        db.query(SplitItem).filter(SplitItem.expense_id == expense.id).all()
    )

    item_totals: Dict[int, Decimal] = {}
    discrepancy: Optional[Decimal] = None

    if expense.split_mode == "EQUAL":
        shares = equal_shares(members, grand)
    else:
        claims = build_claims(db, expense.id)
        if any(
            quantity > ZERO
            for line in claims.values()
            for quantity in line.values()
        ):
            shares, item_totals, discrepancy = proportional_shares(
                items, claims, totals
            )
        else:
            # Nothing has been claimed yet, so there is nothing to
            # split in proportion to. Everyone pays the same.
            shares = equal_shares(members, grand)

    # The total of the shares is the total of the bill, to the last
    # rupiah. If the engine has done its work, this is already true;
    # if it has not, this is the last chance to make it true.
    shares = {
        int(key): value
        for key, value in largest_remainder(
            {str(k): v for k, v in shares.items()}, grand
        ).items()
    }

    # The gap the reader has to deal with is the one between the
    # lines and the subtotal. That is the gap that means a line was
    # read wrong. The engine's own figure is about the total of the
    # bill against the lines, and it is a different question, so it
    # is not the one that is written down here.
    gap = find_discrepancy(items, totals)
    expense.discrepancy = gap

    rows: List[SplitCalculatedShare] = []
    for member in members:
        amount = _money(shares.get(member.id, ZERO))
        row = SplitCalculatedShare(
            expense_id=expense.id,
            member_id=member.id,
            item_total=_money(item_totals.get(member.id, ZERO)),
            exact_amount=amount,
            final_amount=amount,
            currency=currency or "IDR",
        )
        db.add(row)
        rows.append(row)
    db.flush()
    return rows


def member_item_totals(
    db: Session, expense_id: int
) -> Tuple[Dict[int, Decimal], Dict[int, Decimal]]:
    """
    What each member consumed, and how many things they took.

    The first is the money. The second is the count, which is what
    lets two people share one line of two coffees without either of
    them paying for the other.
    """
    items = (
        db.query(SplitItem).filter(SplitItem.expense_id == expense_id).all()
    )
    items_by_id = {item.id: item for item in items}

    rows = (
        db.query(SplitItemClaim)
        .join(SplitItem, SplitItemClaim.item_id == SplitItem.id)
        .filter(SplitItem.expense_id == expense_id)
        .all()
    )

    money: Dict[int, Decimal] = {}
    count: Dict[int, Decimal] = {}
    for row in rows:
        item = items_by_id.get(row.item_id)
        if item is None:
            continue
        quantity = _dec(row.quantity)
        unit = _dec(item.unit_price)
        if unit == ZERO and _dec(item.quantity) != ZERO:
            unit = _dec(item.total_price) / _dec(item.quantity)
        money[row.member_id] = money.get(row.member_id, ZERO) + unit * quantity
        count[row.member_id] = count.get(row.member_id, ZERO) + quantity
    return money, count


def add_claim(
    db: Session,
    item: SplitItem,
    member_id: int,
    quantity: Decimal,
) -> SplitItemClaim:
    """
    A claim on a line.

    The claim a member already has on that line is replaced rather
    than added to. Tapping the same plate twice should not claim two
    coffees, and a host who changes their mind about the quantity
    should not end up with two claims on one line.
    """
    existing = (
        db.query(SplitItemClaim)
        .filter(
            SplitItemClaim.item_id == item.id,
            SplitItemClaim.member_id == member_id,
        )
        .all()
    )
    for row in existing:
        db.delete(row)
    db.flush()

    claim = SplitItemClaim(
        item_id=item.id,
        member_id=member_id,
        quantity=quantity,
    )
    db.add(claim)
    db.flush()
    return claim


def group_balances(
    db: Session, group: SplitGroup, members: List[SplitMember]
) -> Dict[int, Decimal]:
    """
    What each member owes the group, or is owed by it.

    A member who paid the restaurant and ate a quarter of it is owed
    three quarters. A member who ate a quarter and paid nothing owes
    a quarter.
    """
    expenses = (
        db.query(SplitExpense)
        .filter(
            SplitExpense.group_id == group.id,
            SplitExpense.status == "PUBLISHED",
        )
        .all()
    )
    balances: Dict[int, Decimal] = {member.id: ZERO for member in members}

    for expense in expenses:
        shares = (
            db.query(SplitCalculatedShare)
            .filter(SplitCalculatedShare.expense_id == expense.id)
            .all()
        )
        for share in shares:
            if share.member_id in balances:
                balances[share.member_id] -= _dec(share.final_amount)

        payers = (
            db.query(SplitPayer).filter(SplitPayer.expense_id == expense.id).all()
        )
        for payer in payers:
            if payer.member_id in balances:
                balances[payer.member_id] += _dec(payer.amount)

    # A payment between two members of the group takes the debt off
    # both of them. A settlement that is still waiting for its proof
    # does not: the money has not moved yet.
    settlements = (
        db.query(SplitSettlement)
        .filter(
            SplitSettlement.group_id == group.id,
            SplitSettlement.status == "COMPLETED",
        )
        .all()
    )
    for settlement in settlements:
        amount = _dec(settlement.amount)
        if settlement.from_member_id in balances:
            balances[settlement.from_member_id] += amount
        if settlement.to_member_id in balances:
            balances[settlement.to_member_id] -= amount

    return {member_id: _money(value) for member_id, value in balances.items()}


def settlement_plan(
    db: Session, group: SplitGroup, members: List[SplitMember]
) -> List[Dict]:
    """
    The fewest payments that clear the group.

    Three people owing each other in a circle can be settled with one
    payment instead of three. Nobody wants to sit through three
    transfers to clear one dinner.
    """
    balances = group_balances(db, group, members)
    names = {member.id: member.display_name for member in members}
    transfers = simplify_debts(
        {str(key): value for key, value in balances.items()},
        {},
    )
    return [
        {
            "from_member_id": int(transfer.from_member),
            "to_member_id": int(transfer.to_member),
            "from_member": names.get(int(transfer.from_member), ""),
            "to_member": names.get(int(transfer.to_member), ""),
            "amount": _money(transfer.amount),
        }
        for transfer in transfers
    ]
