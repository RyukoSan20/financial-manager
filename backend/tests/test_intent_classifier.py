"""
Tests for the intent classifier.

The classifier is what decides whether a message is an instruction, a
question or a suggestion. Money moves because of what it decides, so
the cases here are the ones that used to go wrong.

Run with:
    cd backend && python3 tests/test_intent_classifier.py
"""

import os
import sys
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.intent_classifier import (  # noqa: E402
    INSTRUCTION,
    QUESTION,
    STATEMENT,
    SUGGESTION,
    analyze,
    split_clauses,
)

PASSED = 0
FAILED = []


def check(name: str, condition: bool, detail: Any = "") -> None:
    global PASSED
    if condition:
        PASSED += 1
    else:
        FAILED.append(f"{name}: {detail}")


def kind_of(message: str) -> Any:
    a = analyze(message)
    return a.clauses[0].kind if a.clauses else None


def intent_of(message: str) -> Any:
    a = analyze(message)
    return a.clauses[0].intent if a.clauses else None


# ---------------------------------------------------------------------------
# A single request
# ---------------------------------------------------------------------------

check("add a transaction",
      kind_of("tambah 25000 kopi") == INSTRUCTION
      and intent_of("tambah 25000 kopi") == "add_transaction")

check("add a transaction, politely",
      kind_of("tolong tambah 50000 nasi goreng") == INSTRUCTION,
      kind_of("tolong tambah 50000 nasi goreng"))

check("delete a transaction",
      intent_of("hapus transaksi kopi 25000") == "delete_transaction")

check("set a budget",
      intent_of("set budget makan 500000 per bulan") == "set_budget")

check("budget without a verb is still an order",
      intent_of("budget makan 500000 sebulan") == "set_budget")

check("allocate",
      intent_of("bagi saldo 50% belanja 30% tabungan") == "allocate")

check("a goal",
      intent_of("target rumah 300 juta 2 tahun") == "set_savings_goal")

check("a plan",
      intent_of("bikin plan 1 tahun gaji 6000000 per bulan") == "build_plan")

# ---------------------------------------------------------------------------
# Questions
# ---------------------------------------------------------------------------

check("a balance question",
      kind_of("berapa saldo saya") == QUESTION
      and intent_of("berapa saldo saya") == "query_balance")

check("a budget question",
      intent_of("berapa budget saya?") == "query_budgets")

check("a question with a number in it is not an order",
      kind_of("berapa yang perlu saya tambahkan?") == QUESTION,
      kind_of("berapa yang perlu saya tambahkan?"))

check("a question with an action verb in it is still a question",
      kind_of("berapa saldo saya, tambah 50000 kopi") == QUESTION)

# ---------------------------------------------------------------------------
# Suggestions and statements
# ---------------------------------------------------------------------------

check("a request for advice",
      kind_of("saran dong cara hemat") == SUGGESTION,
      kind_of("saran dong cara hemat"))

check("a negated order is not an order",
      kind_of("jangan hapus transaksi parkirlah") == STATEMENT,
      kind_of("Jangan hapus transaksi parkirlah"))

check("a hedged thought is not an order",
      kind_of("kayaknya pengeluaran saya bulan ini agak banyak ya") == STATEMENT,
      kind_of("kayaknya pengeluaran saya bulan ini agak banyak ya"))

check("a wish is not an order",
      kind_of("saya ingin tambah 50000 kopi") == SUGGESTION,
      kind_of("saya ingin tambah 50000 kopi"))

# ---------------------------------------------------------------------------
# Splitting
# ---------------------------------------------------------------------------

check("a modifier stays with its verb",
      len(split_clauses("tolong tambah 50000 kopi")) == 1,
      split_clauses("tolong tambah 50000 kopi"))

check("a negation stays with its verb",
      len(split_clauses("jangan hapus transaksi parkirlah")) == 1,
      split_clauses("jangan hapus transaksi parkirlah"))

check("a wish stays with its verb",
      len(split_clauses("saya ingin tambah 50000 kopi")) == 1,
      split_clauses("saya ingin tambah 50000 kopi"))

check("a comma splits two requests",
      len(split_clauses("berapa saldo saya, tambah 50000 kopi")) == 2,
      split_clauses("berapa saldo saya, tambah 50000 kopi"))

check("a joiner splits two requests",
      len(split_clauses("tambah 25000 kopi dan tambah 30000 roti")) == 2,
      split_clauses("tambah 25000 kopi dan tambah 30000 roti"))

# ---------------------------------------------------------------------------
# A message with several subjects
# ---------------------------------------------------------------------------

multi = analyze(
    "berapa saldo saya, tambah 50000 teh, dan budget makan 500000 sebulan"
)
check("a message with three subjects is split into three clauses",
      len(multi.clauses) == 3, [c.text for c in multi.clauses])
check("the question is found among the instructions",
      sum(1 for c in multi.clauses if c.kind == QUESTION) == 1,
      [(c.kind, c.text) for c in multi.clauses])
check("the two instructions are found",
      sum(1 for c in multi.clauses if c.kind == INSTRUCTION) == 2,
      [(c.kind, c.text) for c in multi.clauses])
check("the message counts as multi subject",
      multi.is_multi_subject is True)

two = analyze("tambah 25000 kopi, tambah 30000 roti")
check("two transactions are two instructions",
      len(two.instructions) == 2
      and all(c.intent == "add_transaction" for c in two.instructions),
      [(c.kind, c.intent) for c in two.instructions])

# ---------------------------------------------------------------------------

if FAILED:
    print(f"{PASSED} passed, {len(FAILED)} failed")
    for line in FAILED:
        print("  FAIL", line)
    sys.exit(1)

print(f"{PASSED} passed")
