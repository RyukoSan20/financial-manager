"""
The arithmetic of a shared bill.

When a bill is shared, the same money is described from two sides. The
host paid the shop the whole amount. Each member consumed a part of
it. Those two numbers are not the same number, and the gap between
them is not lost money - it is money one member is holding for the
others.

This module does the arithmetic, and nothing else. It knows no
database, no request and no language. That is deliberate: a rounding
rule that lives next to the code that reads the receipt is a rule
that gets changed by accident, and a bill that is one rupiah out is a
bill nobody trusts.

Three things live here:

- **Proportional allocation.** Tax, service charge and discount are
  shared in the same proportion as the food, because a person who
  ordered the expensive steak is not the person who gets half the
  service charge on the rice.

- **Largest remainder rounding.** Rp100.000 shared three ways is
  Rp33.333,33,33 each, which is Rp99.999. Something has to give, and
  the international financial standard is that the pennies go to
  the people with the largest remainders, so the parts add up to the
  whole. This module never hands back a total that differs from the
  total it was given.

- **Minimum cash flow.** When three people owe each other in a
  circle, paying each debt directly can take more transfers than
  settling the net position does. This module finds the fewest.

Every amount is a `Decimal`. Money is never a float in this file,
because a float cannot hold Rp33.333,33 and would quietly round it
to something else.
"""

from dataclasses import dataclass, field
from decimal import ROUND_DOWN, ROUND_FLOOR, Decimal
from typing import Dict, Iterable, List, Mapping, Optional, Sequence, Tuple

# How many decimal places a currency keeps. Rupiah has none, so one
# rupiah is the smallest unit that exists. The dollar has two, so the
# smallest unit there is one cent.
CURRENCY_EXPONENTS: Dict[str, int] = {
    "IDR": 0,
    "JPY": 0,
    "KRW": 0,
    "VND": 0,
    "CLP": 0,
    "ISK": 0,
    "USD": 2,
    "EUR": 2,
    "GBP": 2,
    "AUD": 2,
    "SGD": 2,
    "MYR": 2,
    "THB": 2,
    "PHP": 2,
    "CNY": 2,
    "INR": 2,
}

DEFAULT_EXPONENT = 2


def exponent_for(currency: Optional[str]) -> int:
    """
    How many decimal places this currency keeps.

    An unknown currency is given two, which is the cautious answer:
    rounding to a whole unit when the currency does have cents would
    lose money.
    """
    if not currency:
        return DEFAULT_EXPONENT
    return CURRENCY_EXPONENTS.get(str(currency).upper(), DEFAULT_EXPONENT)


def to_minor_units(amount: Decimal, exponent: int) -> int:
    """
    The amount in the smallest unit that exists.

    Rp33.333,33 with no decimals is 33333 units. The floor is taken
    toward zero, so a negative amount floors away from zero too,
    which is what keeps a debt and a credit symmetric.
    """
    quant = Decimal(1).scaleb(-exponent)
    return int((Decimal(amount) / quant).to_integral_value(rounding=ROUND_DOWN))


def from_minor_units(units: int, exponent: int) -> Decimal:
    """The amount back in the currency itself."""
    quant = Decimal(1).scaleb(-exponent)
    return (Decimal(units) * quant).quantize(quant)


def largest_remainder(
    exact: Mapping[str, Decimal],
    total: Decimal,
    exponent: int = DEFAULT_EXPONENT,
) -> Dict[str, Decimal]:
    """
    Turn exact shares into whole ones that add up to the total.

    `exact` is what each member owes if fractions were allowed. The
    result is what each member owes in the smallest unit that
    exists, and the parts always add up to `total` exactly.

    The method is the one the international standard uses. Each
    share is floored. The difference between the floor and the exact
    share is the remainder. The members with the largest remainders
    are given one extra unit each, until nothing is left over.

    When two remainders are the same, the member who consumed the
    most gets the extra unit, and after that the one whose name
    comes first, so the same bill always splits the same way. A bill
    that splits differently each time it is opened is a bill people
    argue about.

    A total too small to give everyone a unit is handled: the
    members who get nothing are given the zero they are owed, and
    the units go to the members with the largest remainders.
    """
    keys = list(exact.keys())
    if not keys:
        return {}

    total_units = to_minor_units(total, exponent)

    # The floor of each share, and what is left over after the floor.
    floors: Dict[str, int] = {}
    remainders: Dict[str, Decimal] = {}
    for key in keys:
        units = to_minor_units(exact[key], exponent)
        floors[key] = units
        remainders[key] = Decimal(exact[key]) - from_minor_units(units, exponent)

    # How many units are still to hand out.
    left = total_units - sum(floors.values())

    # The order the extra units go in: largest remainder first, then
    # the largest consumption, then the name, so it is decided and not
    # left to chance.
    consumed = {key: Decimal(exact[key]) for key in keys}

    def rank_key(key: str) -> Tuple[Decimal, Decimal, str]:
        """
        Who gets an extra unit, and in what order.

        The largest remainder first. Then the largest consumption,
        because a member who ate more of the bill has more claim on
        the part that was left over. Then the name, in the ordinary
        order, so the answer does not depend on how the members were
        written down.

        The first two are turned around so that sorting this from the
        smallest to the largest puts the member with the largest
        remainder first. The name is not turned around, so it reads
        from a to z.
        """
        return (-remainders[key], -consumed[key], key)

    order = sorted(keys, key=rank_key)

    # The same ranking, but the other way round, for the case where
    # the exact shares add up to more than the total. There the unit
    # is taken from the member with the smallest remainder.
    def demote_key(key: str) -> Tuple[Decimal, Decimal, str]:
        return (remainders[key], consumed[key], key)

    # `left` can be negative when the exact shares add up to more than
    # the total. That is a broken bill, and the answer is to take the
    # units back from the members with the smallest remainders rather
    # than to invent a number.
    if left > 0:
        for index in range(left):
            floors[order[index % len(order)]] += 1
    elif left < 0:
        # Take one unit at a time from the member with the smallest
        # remainder who can afford to lose it.
        takers = sorted(keys, key=demote_key)
        index = 0
        while left < 0 and takers:
            key = takers[index % len(takers)]
            if floors[key] > 0:
                floors[key] -= 1
                left += 1
            index += 1
            if index > len(takers) * 10000:
                break

    return {key: from_minor_units(floors[key], exponent) for key in keys}


def equal_split(
    total: Decimal,
    members: Sequence[str],
    exponent: int = DEFAULT_EXPONENT,
) -> Dict[str, Decimal]:
    """
    The same amount for everyone, with the rounding settled.

    Rp100.000 among three people is Rp33.334 for one of them and
    Rp33.333 for the other two, so that the three add up to
    Rp100.000 and not Rp99.999.
    """
    members = list(members)
    if not members:
        return {}
    share = Decimal(total) / Decimal(len(members))
    exact = {key: share for key in members}
    return largest_remainder(exact, total, exponent)


def percentage_split(
    total: Decimal,
    weights: Mapping[str, Decimal],
    exponent: int = DEFAULT_EXPONENT,
) -> Dict[str, Decimal]:
    """
    A share given by percentage.

    The percentages are read as weights, so they do not have to add up
    to a hundred. If they do not, the rounding is still settled the
    same way, and the parts still add up to the whole.
    """
    keys = list(weights.keys())
    if not keys:
        return {}
    weight_sum = sum(Decimal(value) for value in weights.values())
    if weight_sum == 0:
        return equal_split(total, keys, exponent)
    exact = {
        key: Decimal(total) * Decimal(weights[key]) / weight_sum for key in keys
    }
    return largest_remainder(exact, total, exponent)


def exact_split(
    total: Decimal,
    amounts: Mapping[str, Decimal],
    exponent: int = DEFAULT_EXPONENT,
) -> Dict[str, Decimal]:
    """
    A share given by hand.

    The amounts are taken as they are given. When they do not add up
    to the total, the gap is spread by the largest remainder rule, so
    the parts still add up to the whole.
    """
    keys = list(amounts.keys())
    if not keys:
        return {}
    exact = {key: Decimal(amounts[key]) for key in keys}
    given = sum(exact.values())
    if given == Decimal(total):
        return largest_remainder(exact, total, exponent)
    # The gap is shared out as if it were a share of its own.
    gap = Decimal(total) - given
    gap_share = gap / Decimal(len(keys))
    adjusted = {key: exact[key] + gap_share for key in keys}
    return largest_remainder(adjusted, total, exponent)


@dataclass
class BillLine:
    """
    One line of a bill.

    A line is a thing that was ordered. `kind` says what the line
    does to the total: an `item` adds to it, a `tax` or `service`
    adds to it, a `discount` takes away from it.

    `quantity` is how many of the thing there were. A line of two
    coffees is two coffees, and either of them may be claimed by a
    different person, which is the whole reason the quantity is kept
    apart from the price.
    """

    line_id: str
    name: str
    quantity: Decimal = Decimal("1")
    unit_price: Decimal = Decimal("0")
    total_price: Decimal = Decimal("0")
    kind: str = "item"

    @property
    def is_charge(self) -> bool:
        """Does this line add to the bill, rather than take away."""
        return self.kind != "discount"


@dataclass
class Allocation:
    """
    What each member owes, and the arithmetic behind it.

    `shares` is what each member pays in the smallest unit that
    exists. `exact` is the same thing before rounding, which is what
    the screens show when they explain how the number was reached.

    `discrepancy` is the gap between the sum of the item lines and
    the subtotal that was written on the receipt. It is not an
    error in this module - it is what the reader needs to be told,
    because a bill whose lines do not add up to its own subtotal is
    a bill that has to be checked before it is paid.
    """

    shares: Dict[str, Decimal] = field(default_factory=dict)
    exact: Dict[str, Decimal] = field(default_factory=dict)
    item_totals: Dict[str, Decimal] = field(default_factory=dict)
    subtotal: Decimal = Decimal("0")
    tax: Decimal = Decimal("0")
    service: Decimal = Decimal("0")
    discount: Decimal = Decimal("0")
    grand_total: Decimal = Decimal("0")
    discrepancy: Decimal = Decimal("0")

    @property
    def allocated_total(self) -> Decimal:
        """The sum of the shares. Always the grand total, exactly."""
        return sum(self.shares.values(), Decimal("0"))


def allocate_proportionally(
    lines: Sequence[BillLine],
    claims: Mapping[str, Mapping[str, Decimal]],
    grand_total: Optional[Decimal] = None,
    tax: Optional[Decimal] = None,
    service: Optional[Decimal] = None,
    discount: Optional[Decimal] = None,
    exponent: int = DEFAULT_EXPONENT,
) -> Allocation:
    """
    Share a bill in proportion to what each member consumed.

    `claims` says, for each line, who claimed how much of it. A
    member who claimed one of the two coffees is charged for one
    coffee, not for half the line.

    Tax, service charge and discount are shared in the same
    proportion as the items, because that is what they were charged
    on. A member who ate nothing and was charged the service charge
    is a case the receipt itself should be checked for; when the
    items divide the bill evenly, this shares the extras evenly too.

    The grand total is taken from the receipt when it is given. When
    it is not, it is computed from the lines. The two are kept
    apart: the difference is reported as `discrepancy` rather than
    quietly absorbed, because a difference between the lines and the
    subtotal means one of the two was read wrong.
    """
    item_lines = [line for line in lines if line.kind == "item"]
    charge_lines = [line for line in lines if line.kind in ("tax", "service")]
    discount_lines = [line for line in lines if line.kind == "discount"]

    # What each line costs, taken from the line itself. A line with a
    # quantity is worth its total; a line without one is worth its
    # unit price.
    def line_value(line: BillLine) -> Decimal:
        if line.total_price:
            return Decimal(line.total_price)
        return Decimal(line.quantity) * Decimal(line.unit_price)

    # The part of each line each member consumed. A line of two
    # coffees is divided by its quantity, so that a claim of one
    # coffee is worth one coffee.
    item_totals: Dict[str, Decimal] = {}
    for line in item_lines:
        value = line_value(line)
        quantity = Decimal(line.quantity)
        unit_value = value / quantity if quantity else value
        for member, claimed in (claims.get(line.line_id) or {}).items():
            item_totals[member] = item_totals.get(member, Decimal("0")) + (
                unit_value * Decimal(claimed)
            )

    subtotal = sum((line_value(line) for line in item_lines), Decimal("0"))

    tax_total = (
        Decimal(tax)
        if tax is not None
        else sum((line_value(line) for line in charge_lines), Decimal("0"))
    )
    service_total = (
        Decimal(service)
        if service is not None
        else Decimal("0")
    )
    discount_total = (
        Decimal(discount)
        if discount is not None
        else sum((line_value(line) for line in discount_lines), Decimal("0"))
    )

    computed_grand = subtotal + tax_total + service_total - discount_total
    if grand_total is None:
        grand_total = computed_grand
    grand_total = Decimal(grand_total)

    members = sorted(item_totals.keys())
    if not members:
        return Allocation(
            subtotal=subtotal,
            tax=tax_total,
            service=service_total,
            discount=discount_total,
            grand_total=grand_total,
            discrepancy=grand_total - computed_grand,
        )

    # The share of the bill each member carries.
    if subtotal == 0:
        weights = {member: Decimal("1") for member in members}
    else:
        weights = {
            member: item_totals[member] / subtotal for member in members
        }

    exact: Dict[str, Decimal] = {}
    for member in members:
        weight = weights[member]
        exact[member] = (
            item_totals[member]
            + weight * tax_total
            + weight * service_total
            - weight * discount_total
        )

    shares = largest_remainder(exact, grand_total, exponent)

    return Allocation(
        shares=shares,
        exact=exact,
        item_totals=item_totals,
        subtotal=subtotal,
        tax=tax_total,
        service=service_total,
        discount=discount_total,
        grand_total=grand_total,
        discrepancy=grand_total - computed_grand,
    )
