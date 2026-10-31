"""
The fewest payments that clear a group.

When three people owe each other in a circle, paying every debt
directly is more work than it needs to be. A owes B fifty thousand,
B owes C fifty thousand and C owes A fifty thousand. All three debts
can be paid, and none of them needs to be: nobody owes anybody, once
the three are netted against each other.

This module finds the fewest payments that settle a group.

The net position of each member is what matters, not the individual
debts. A member who has paid more than they consumed is owed money;
a member who consumed more than they paid owes money. The sum of the
net positions is always zero - the bill adds up, so the money does
too.

The usual answer is greedy: the biggest debtor pays the biggest
creditor, as far as that goes. That is the standard approach and it
is the right one for the size of group this application deals with -
a table of friends, not a company.

For a small group the exact minimum is also looked for, by trying
the groups of members that cancel each other out and seeing whether
settling them separately takes fewer payments. A group of up to
fifteen people is checked; a bigger one uses the greedy answer,
which gives the same number in nearly every case.

Every amount is a `Decimal`. Money is never a float in this file.
"""

from dataclasses import dataclass
from decimal import ROUND_DOWN, Decimal
from typing import Dict, List, Mapping, Optional, Sequence, Tuple

# The largest group that is checked for a shorter answer. Beyond this
# the number of combinations stops being something a person waits
# for, and the greedy answer is used instead.
EXHAUSTIVE_LIMIT = 15

DEFAULT_EXPONENT = 2


@dataclass
class Transfer:
    """
    One payment: who pays whom, and how much.

    `from_member` and `to_member` are member keys, not names. The
    screen that shows this turns them into names.
    """

    from_member: str
    to_member: str
    amount: Decimal

    def as_dict(self) -> dict:
        return {
            "from_member": self.from_member,
            "to_member": self.to_member,
            "amount": str(self.amount),
        }


def net_positions(
    paid: Mapping[str, Decimal],
    consumed: Mapping[str, Decimal],
) -> Dict[str, Decimal]:
    """
    What each member is owed, or owes.

    A member who paid more than they consumed is owed the difference.
    A member who consumed more than they paid owes the difference.

    Members who appear in only one of the two maps are counted. A
    member who is in neither is left out, because there is nothing to
    say about them.
    """
    members = set(paid.keys()) | set(consumed.keys())
    return {
        member: Decimal(paid.get(member, 0)) - Decimal(consumed.get(member, 0))
        for member in members
    }


def simplify_debts(
    paid: Mapping[str, Decimal],
    consumed: Mapping[str, Decimal],
    exponent: int = DEFAULT_EXPONENT,
) -> List[Transfer]:
    """
    The fewest payments that settle the group.

    `paid` is what each member handed to the shop. `consumed` is what
    each member ate. The payments that come back clear the group
    without changing what anyone ends up with.

    A group that is already square returns nothing.
    """
    positions = net_positions(paid, consumed)

    quant = Decimal(1).scaleb(-exponent)

    # The members who owe, and the members who are owed, in the
    # smallest unit that exists so the arithmetic does not drift.
    debtors: List[Tuple[str, int]] = []
    creditors: List[Tuple[str, int]] = []
    for member, position in positions.items():
        units = int((position / quant).to_integral_value(rounding=ROUND_DOWN))
        if units < 0:
            debtors.append((member, -units))
        elif units > 0:
            creditors.append((member, units))

    if not debtors or not creditors:
        return []

    greedy = _greedy_payments(debtors, creditors, quant)
    if len(debtors) + len(creditors) > EXHAUSTIVE_LIMIT:
        return greedy

    shorter = _search_shorter(debtors, creditors, quant, len(greedy))
    if shorter is not None and len(shorter) < len(greedy):
        return shorter
    return greedy


def _greedy_payments(
    debtors: Sequence[Tuple[str, int]],
    creditors: Sequence[Tuple[str, int]],
    quant: Decimal,
) -> List[Transfer]:
    """
    The standard answer: the biggest debtor pays the biggest creditor.

    The lists are copied, because the caller's lists are not ours to
    change.
    """
    owing = [[member, units] for member, units in debtors]
    owed = [[member, units] for member, units in creditors]
    transfers: List[Transfer] = []

    while owing and owed:
        owing.sort(key=lambda row: row[1], reverse=True)
        owed.sort(key=lambda row: row[1], reverse=True)
        debtor, debt_units = owing[0]
        creditor, credit_units = owed[0]

        units = min(debt_units, credit_units)
        transfers.append(
            Transfer(
                from_member=debtor,
                to_member=creditor,
                amount=Decimal(units) * quant,
            )
        )

        owing[0][1] -= units
        owed[0][1] -= units
        if owing[0][1] == 0:
            owing.pop(0)
        if owed[0][1] == 0:
            owed.pop(0)

    return transfers


def _search_shorter(
    debtors: Sequence[Tuple[str, int]],
    creditors: Sequence[Tuple[str, int]],
    quant: Decimal,
    current_best: int,
) -> Optional[List[Transfer]]:
    """
    Look for an answer that takes fewer payments than the greedy one.

    A group of members whose net positions add up to zero needs no
    payments from the outside. If such a group can be settled with
    fewer payments inside itself than it costs to settle it with
    everybody else, the bill is shorter that way.

    The search is over the groups of members that cancel out. It is
    exponential, which is why it is only used for small groups.
    """
    positions: Dict[str, int] = {}
    for member, units in debtors:
        positions[member] = -units
    for member, units in creditors:
        positions[member] = units

    names = list(positions.keys())
    count = len(names)

    best: Optional[List[Transfer]] = None

    for mask in range(1 << count):
        selected = [index for index in range(count) if mask & (1 << index)]
        if len(selected) < 2:
            continue
        if sum(positions[names[index]] for index in selected) != 0:
            continue
        # A group that only owes, or only is owed, is not a group
        # that cancels itself out.
        if not any(positions[names[index]] < 0 for index in selected):
            continue
        if not any(positions[names[index]] > 0 for index in selected):
            continue

        inside = _settle_group(
            [names[index] for index in selected], positions, quant
        )
        outside = _settle_group(
            [names[index] for index in range(count) if index not in set(selected)],
            positions,
            quant,
        )
        candidate = inside + outside
        if best is None or len(candidate) < len(best):
            best = candidate
            if len(best) == 1:
                break

    if best is not None and len(best) < current_best:
        return best
    return None


def _settle_group(
    names: Sequence[str],
    positions: Mapping[str, int],
    quant: Decimal,
) -> List[Transfer]:
    """
    Settle these members among themselves.
    """
    group_debtors = [
        (name, -positions[name]) for name in names if positions[name] < 0
    ]
    group_creditors = [
        (name, positions[name]) for name in names if positions[name] > 0
    ]
    if not group_debtors or not group_creditors:
        return []
    return _greedy_payments(group_debtors, group_creditors, quant)
