"""
The instructions the model is given, and how they are applied.

A prompt is a piece of code. It can be wrong in a way that only shows
up on one kind of input, and the way to find that out is to keep the
cases that broke it and run them again after every change.

So the instructions live here, each with a version, and each with the
cases that must keep working. `instruction_registry.py` reads them and
runs them.

The other half is that the same instruction has to be applied to
different situations. A breakdown for a goal in the future, a breakdown
for a purchase at a shop that was scanned yesterday, and a breakdown for
a purchase with no shop at all are three different instructions, not
one instruction with three sentences added.

Each instruction therefore has a builder: a function that takes the
situation and returns the prompt. The prompt carries only what is
relevant to that situation.
"""

import logging
from typing import Any, Callable, Dict, List, Optional

logger = logging.getLogger(__name__)


def _format_money(value: Any) -> str:
    """Rp1.800.000, the way an Indonesian reads it."""
    try:
        return f"Rp{float(value or 0):,.0f}".replace(",", ".")
    except (TypeError, ValueError):
        return "Rp0"


# ---------------------------------------------------------------------------
# Goal breakdown
# ---------------------------------------------------------------------------

GOAL_BREAKDOWN_V1 = """You break a savings goal into the costs that make it up.

The user says: "{message}"
The target amount is: {target}
The target date is: {target_date} ({days_left} days from now)

List the things the money has to cover. For a trip, that is the
transport, the place to stay, the food, the documents, the insurance.
For a house, that is the down payment, the tax, the notary, the
repair. Choose what fits the goal, do not use this list blindly.

Rules:
- The amounts must add up to exactly {target}. Work the numbers out so
  they do.
- Give each line a name in Indonesian, a category, and an amount.
- "category" is one of: transport, accommodation, food, documents,
  insurance, shopping, health, education, housing, other.
- A line that is not a cost (savings, buffer, unexpected) gets
  category "other".
- Do not name a specific airline, hotel or shop. Use a general name
  like "Tiket pesawat", "Penginapan", "Makan dan jajan".
- Reply with JSON only, no prose.

The JSON shape:
{{"lines": [{{"name": "...", "category": "...", "amount": 1234567, "note": "..."}}]}}
"""


GOAL_BREAKDOWN_V2 = """You break a savings goal into the costs that make it up.

The user says: "{message}"
The target amount is: {target}
The target date is: {target_date} ({days_left} days from now)
{context}

Think about what this goal actually involves before you list anything.

Work through it in this order:

1. What is being paid for? Read the message and work out what the
   goal is really about. "Liburan ke Jepang" is a trip. "Beli rumah" is
   a property. "Dana darurat" is a cushion. "Bayar cicilan mobil" is a
   loan.

2. What does that cost break down into? For a trip: the transport
   there and back, the place to stay, the food, the documents, the
   insurance, and anything the traveller would buy there. For a
   property: the down payment, the tax, the notary, the registration,
   the repairs. For a cushion: nothing at all, and the answer is one
   line that says so.

3. What is the size of each part relative to the others? A flight
   costs more than the food. A down payment costs more than the
   notary. If the goal is a loan, the interest is part of the cost and
   belongs in the breakdown.

Rules:
- The amounts must add up to exactly {target}. Work the numbers out so
  they do. Do not round each line to a nice number and then leave a
  gap.
- Give each line a name in Indonesian that the user would recognise.
- "category" is one of: transport, accommodation, food, documents,
  insurance, shopping, health, education, housing, other.
- A line that is not a cost (savings, buffer, unexpected) gets
  category "other".
- Do not name a specific airline, hotel or shop. Use a general name
  like "Tiket pesawat", "Penginapan", "Makan dan jajan". The user has
  not told you which ones they will use.
- Do not invent a number the user did not give and do not pretend to
  know a price. Give a figure the user can argue with, and put the
  reason in the note.
- Reply with JSON only, no prose.

The JSON shape:
{{"lines": [{{"name": "...", "category": "...", "amount": 1234567, "note": "..."}}]}}
"""


# ---------------------------------------------------------------------------
# Transaction breakdown
# ---------------------------------------------------------------------------

TRANSACTION_BREAKDOWN_V1 = """You describe the contents of a purchase.

The user said: "{message}"
The amount was: {amount}
The shop was: "{merchant}"

List the things that make up that purchase, so the user can see what
their money went on.

Rules:
- The amounts must add up to exactly {amount}.
- Give each line a name in Indonesian, a category and an amount.
- "category" is one of: food, drink, household, personal_care, snack,
  medicine, stationery, clothing, electronics, other.
- Use a product name the user would recognise, not a brand.
- If you cannot tell what was bought, return one line named after the
  purchase itself.
- Reply with JSON only, no prose.

The JSON shape:
{{"lines": [{{"name": "...", "category": "...", "amount": 1234}}]}}
"""


TRANSACTION_BREAKDOWN_V2 = """You describe the contents of a purchase.

The user said: "{message}"
The amount was: {amount}
The shop was: "{merchant}"
{context}

Work out what was bought, then say what it cost.

What was bought:
- Read the message. "beli kopi 15000" is one coffee. "beli di
  indomaret 50000" is a shop full of things the user did not name, so
  the answer describes what such a shop sells.
- The shop tells you a lot. A minimarket sells food, drinks and things
  for the house. A warung sells food. An apotek sells medicine and
  personal care. A coffee shop sells drinks and food. Read the shop
  name and use what it implies.
- If the catalog section above lists products, those are the products
  this shop really sells. Prefer them.

How much each thing cost:
- The lines must add up to exactly {amount}.
- Split the amount across the lines in proportion to what each thing
  would cost. A 50000 purchase at a minimarket is mostly food and
  drinks, a small amount for household things.
- Do not round each line to a nice number and leave a gap. The last
  line absorbs the remainder.

Rules:
- Give each line a name in Indonesian that the user would recognise.
  "Indomaret" is not a product. "Mi instan" is.
- "category" is one of: food, drink, household, personal_care, snack,
  medicine, stationery, clothing, electronics, other.
- Do not name a brand the user did not mention.
- If you cannot tell what was bought, return one line named after the
  purchase itself.
- Reply with JSON only, no prose.

The JSON shape:
{{"lines": [{{"name": "...", "category": "...", "amount": 1234}}]}}
"""


# ---------------------------------------------------------------------------
# Direction classification
# ---------------------------------------------------------------------------

DIRECTION_V1 = """You decide which way money moved in an Indonesian personal finance transaction.

- "income" means money came in: salary, a bonus, a refund, selling
  something, money received, a transfer that landed in the account.
- "expense" means money went out: buying, paying, a bill, a fee, a
  purchase.
- "transfer" means the money moved between the user's own accounts.

The text is: "{text}"

Reply with JSON only:
{{"direction": "income" or "expense" or "transfer", "confidence": 0.0 to 1.0, "reason": "one short sentence in Indonesian"}}
"""


DIRECTION_V2 = """You decide which way money moved in an Indonesian personal finance transaction.

- "income" means money came in: salary, a bonus, a refund, selling
  something, money received, a transfer that landed in the account.
- "expense" means money went out: buying, paying, a bill, a fee, a
  purchase.
- "transfer" means the money moved between the user's own accounts.

The text is: "{text}"

Read it the way the person who wrote it meant it.

- "bayar listrik 350rb" - paying the electricity bill, money left.
- "bayar gaji ke rekening" - paying a salary into an account, money
  left. "gaji" does not make it income; the direction is decided by
  who did the paying.
- "dibayarkan ke saya" - the money was paid to the user, money arrived.
- "dibayarkan ke rekening BCA" - the money was sent to an account,
  money left.
- "terima kasbon" - the user received a promissory note, money arrived.
- "bagi hasil" - a share of the profit was distributed to the user,
  money arrived.
- "tambah 15000 kopi" - adding a transaction for coffee, money left.
  "tambah" is an instruction, it says nothing about the direction.

The word that carries the meaning is the verb, not the object. "gaji"
and "bonus" are what was received, "bayar" and "beli" are what was
spent, and the direction follows the action.

When the text holds both, the action wins. "bayar gaji" is money out.

Reply with JSON only:
{{"direction": "income" or "expense" or "transfer", "confidence": 0.0 to 1.0, "reason": "one short sentence in Indonesian"}}
"""


# ---------------------------------------------------------------------------
# The registry
# ---------------------------------------------------------------------------


def _goal_context(situation: Dict[str, Any]) -> str:
    """
    What the model needs to know about this goal, beyond the message.

    The catalog of the shops and products the user has actually bought
    is the most useful thing here: if the user has bought plane tickets
    before, that is a sign the trip involves one.
    """
    parts: List[str] = []

    known_merchants = situation.get("known_merchants") or []
    if known_merchants:
        listed = ", ".join(str(m) for m in known_merchants[:8])
        parts.append(
            "The shops this user has spent money at before: " + listed + "."
        )

    known_products = situation.get("known_products") or []
    if known_products:
        listed = ", ".join(str(p) for p in known_products[:12])
        parts.append(
            "The products this user has bought before: " + listed + "."
        )

    average_amount = situation.get("average_amount")
    if average_amount:
        parts.append(
            "The user usually spends about "
            + _format_money(average_amount)
            + " on a purchase like this."
        )

    if not parts:
        return "There is no history for this user yet, so judge the goal on what it says."

    return "\n".join(parts)


def _transaction_context(situation: Dict[str, Any]) -> str:
    """What the model needs to know about this purchase."""
    parts: List[str] = []

    catalog_products = situation.get("catalog_products") or []
    if catalog_products:
        listed = ", ".join(str(p) for p in catalog_products[:12])
        parts.append(
            "The products this shop is known to sell, from the receipts "
            "scanned here before: " + listed + "."
        )

    merchant_type = situation.get("merchant_type")
    if merchant_type:
        parts.append("This shop is a: " + str(merchant_type) + ".")

    average_amount = situation.get("average_amount")
    if average_amount:
        parts.append(
            "The user usually spends about "
            + _format_money(average_amount)
            + " here."
        )

    if not parts:
        return "There is no history for this shop yet, so judge it on the shop name."

    return "\n".join(parts)


class Instruction:
    """
    One instruction, with its version and its builder.

    The builder turns a situation into a prompt. That is what makes the
    instruction "smart": the prompt carries the history that is
    relevant to this situation and leaves out the history that is not.
    """

    def __init__(
        self,
        name: str,
        version: int,
        template: str,
        builder: Callable[[Dict[str, Any]], str],
        description: str = "",
    ) -> None:
        self.name = name
        self.version = version
        self.template = template
        self.builder = builder
        self.description = description

    def build(self, situation: Dict[str, Any]) -> str:
        """The prompt for this situation."""
        return self.builder(situation)

    def __repr__(self) -> str:
        return f"<Instruction {self.name} v{self.version}>"


def _goal_builder(situation: Dict[str, Any]) -> str:
    target_date = situation.get("target_date")
    days_left = situation.get("days_left", 365)
    return GOAL_BREAKDOWN_V2.format(
        message=situation.get("message", ""),
        target=_format_money(situation.get("target_amount")),
        target_date=target_date or "not set",
        days_left=days_left,
        context=_goal_context(situation),
    )


def _transaction_builder(situation: Dict[str, Any]) -> str:
    return TRANSACTION_BREAKDOWN_V2.format(
        message=situation.get("message", ""),
        amount=_format_money(situation.get("amount")),
        merchant=situation.get("merchant") or "a shop",
        context=_transaction_context(situation),
    )


def _direction_builder(situation: Dict[str, Any]) -> str:
    return DIRECTION_V2.format(text=situation.get("text", ""))


# The instructions in use. Bump the version when the template changes
# and add the case that broke it to the regression file.
REGISTRY: Dict[str, Instruction] = {
    "goal_breakdown": Instruction(
        name="goal_breakdown",
        version=2,
        template=GOAL_BREAKDOWN_V2,
        builder=_goal_builder,
        description="Works out what a savings goal is made of.",
    ),
    "transaction_breakdown": Instruction(
        name="transaction_breakdown",
        version=2,
        template=TRANSACTION_BREAKDOWN_V2,
        builder=_transaction_builder,
        description="Works out what a purchase paid for.",
    ),
    "direction": Instruction(
        name="direction",
        version=2,
        template=DIRECTION_V2,
        builder=_direction_builder,
        description="Decides whether money came in or went out.",
    ),
}


def get_instruction(name: str) -> Instruction:
    """The instruction with this name."""
    if name not in REGISTRY:
        raise KeyError(f"Unknown instruction: {name}")
    return REGISTRY[name]


def build_prompt(name: str, situation: Dict[str, Any]) -> str:
    """The prompt for this instruction and this situation."""
    return get_instruction(name).build(situation)
