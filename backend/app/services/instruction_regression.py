"""
The regression suite for the instructions.

A prompt is code. It can be changed in a way that fixes one case and
breaks another, and the only way to know is to keep the cases that
broke and run them again.

Each case here says what the model should answer for a given input.
The suite runs against the real model when one is available, and
against the prompt builder alone when it is not, so a broken prompt is
caught either way.

Two levels:

1. The prompt itself. The builder has to produce a prompt that carries
   the situation and the context. A prompt that drops the context, or
   leaves a hole in a format string, fails here without needing the
   network.

2. The answer. The model has to answer the way the case says. This
   needs the network and a key, and it is skipped when there is none.

Run it with:

    python -m app.services.instruction_regression
"""

import logging
import sys
from typing import Any, Callable, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# The cases
# ---------------------------------------------------------------------------
#
# Each case is (name, instruction, situation, checker).
#
# The checker gets the model's answer and returns True when the answer
# is right. It is a function rather than a fixed value because "the
# amounts add up to the target" and "the direction is expense" are
# different kinds of check.


def _amounts_add_up(answer: Dict[str, Any], target: float, tolerance: float = 1.0) -> bool:
    """The lines have to add up to the number that was asked for."""
    lines = answer.get("lines") or []
    if not lines:
        return False
    total = sum(float(line.get("amount", 0) or 0) for line in lines)
    return abs(total - target) <= tolerance


def _has_line(answer: Dict[str, Any], fragment: str) -> bool:
    """One of the lines has to mention this."""
    lines = answer.get("lines") or []
    lowered = fragment.lower()
    for line in lines:
        if lowered in str(line.get("name", "")).lower():
            return True
    return False


def _all_lines_have_categories(answer: Dict[str, Any]) -> bool:
    """Every line needs a category from the allowed set."""
    allowed = {
        "transport", "accommodation", "food", "documents", "insurance",
        "shopping", "health", "education", "housing", "other",
        "drink", "household", "personal_care", "snack", "medicine",
        "stationery", "clothing", "electronics",
    }
    lines = answer.get("lines") or []
    if not lines:
        return False
    for line in lines:
        if str(line.get("category", "")).lower() not in allowed:
            return False
    return True


def _direction_is(answer: Dict[str, Any], expected: str) -> bool:
    """The direction has to be the expected one."""
    return str(answer.get("direction", "")).lower().strip() == expected


CASES: List[Dict[str, Any]] = [
    # --- goal breakdown -------------------------------------------------
    {
        "name": "goal: a trip breaks into travel costs",
        "instruction": "goal_breakdown",
        "situation": {
            "message": "Liburan ke Jepang",
            "target_amount": 4000000,
            "target_date": "2030-10-23",
            "days_left": 1460,
        },
        "check": lambda a: _amounts_add_up(a, 4000000)
        and _has_line(a, "tiket")
        and _has_line(a, "penginapan"),
        "why": "A trip is transport and somewhere to stay. The lines have "
               "to add up to the target.",
    },
    {
        "name": "goal: a house breaks into property costs",
        "instruction": "goal_breakdown",
        "situation": {
            "message": "Beli rumah",
            "target_amount": 500000000,
            "target_date": "2029-01-01",
            "days_left": 800,
        },
        "check": lambda a: _amounts_add_up(a, 500000000)
        and _has_line(a, "uang muka"),
        "why": "A house is a down payment first of all.",
    },
    {
        "name": "goal: an emergency fund is not spent on things",
        "instruction": "goal_breakdown",
        "situation": {
            "message": "Dana darurat",
            "target_amount": 20000000,
            "target_date": "2028-06-01",
            "days_left": 600,
        },
        "check": lambda a: _amounts_add_up(a, 20000000),
        "why": "A cushion is saved, not spent. The breakdown may be a "
               "single line, but it still has to add up.",
    },
    {
        "name": "goal: the breakdown carries the history",
        "instruction": "goal_breakdown",
        "situation": {
            "message": "Liburan ke Jepang",
            "target_amount": 4000000,
            "target_date": "2030-10-23",
            "days_left": 1460,
            "known_merchants": ["Indomaret", "Garuda Indonesia"],
            "known_products": ["Mie instan", "Beras 5kg"],
        },
        "check": lambda a: True,
        "needs_model": False,
        "why": "The context has to reach the prompt. Checked in the "
               "prompt level test.",
        "prompt_must_contain": ["Indomaret", "Mie instan"],
    },
    # --- transaction breakdown -----------------------------------------
    {
        "name": "purchase: a shop splits into what it sells",
        "instruction": "transaction_breakdown",
        "situation": {
            "message": "beli di indomaret",
            "amount": 5000,
            "merchant": "Indomaret",
        },
        "check": lambda a: _amounts_add_up(a, 5000),
        "why": "The lines have to add up to what was spent.",
    },
    {
        "name": "purchase: the catalog wins over a guess",
        "instruction": "transaction_breakdown",
        "situation": {
            "message": "beli di indomaret",
            "amount": 50000,
            "merchant": "Indomaret",
            "catalog_products": ["Beras 5kg", "Mie instan", "Susu UHT"],
        },
        "check": lambda a: _amounts_add_up(a, 50000)
        and _has_line(a, "beras"),
        "why": "The products the receipts showed are better evidence than "
               "a guess about what a minimarket sells.",
    },
    {
        "name": "purchase: a single item stays a single item",
        "instruction": "transaction_breakdown",
        "situation": {
            "message": "kopi 15000",
            "amount": 15000,
            "merchant": "",
        },
        "check": lambda a: _amounts_add_up(a, 15000),
        "why": "One coffee is one line, not four.",
    },
    # --- direction ------------------------------------------------------
    {
        "name": "direction: paying a bill is money out",
        "instruction": "direction",
        "situation": {"text": "bayar listrik 350rb"},
        "check": lambda a: _direction_is(a, "expense"),
        "why": "A bill is paid, so the money goes out.",
    },
    {
        "name": "direction: a salary received is money in",
        "instruction": "direction",
        "situation": {"text": "terima gaji 5 juta"},
        "check": lambda a: _direction_is(a, "income"),
        "why": "The salary arrived.",
    },
    {
        "name": "direction: paying a salary out is money out",
        "instruction": "direction",
        "situation": {"text": "bayar gaji ke rekening"},
        "check": lambda a: _direction_is(a, "expense"),
        "why": "The object is a salary but the action is a payment. The "
               "action decides.",
    },
    {
        "name": "direction: a share of the profit is money in",
        "instruction": "direction",
        "situation": {"text": "bagi hasil 2 juta"},
        "check": lambda a: _direction_is(a, "income"),
        "why": "A distribution to the user is money received.",
    },
    {
        "name": "direction: a transfer is neither",
        "instruction": "direction",
        "situation": {"text": "transfer ke tabungan 500rb"},
        "check": lambda a: _direction_is(a, "transfer"),
        "why": "The money moved between the user's own accounts.",
    },
    {
        "name": "direction: an instruction word says nothing",
        "instruction": "direction",
        "situation": {"text": "tambah 15000 kopi"},
        "check": lambda a: _direction_is(a, "expense"),
        "why": "'tambah' is the instruction to record it. The coffee is "
               "what the money was for.",
    },
]


# ---------------------------------------------------------------------------
# The runner
# ---------------------------------------------------------------------------


def _run_prompt_level(cases: List[Dict[str, Any]]) -> Tuple[int, int, List[str]]:
    """
    Check the prompts without the network.

    Every case has to produce a prompt that carries its situation, and
    the ones that name something the prompt must contain have to carry
    that too. A format string with a hole in it fails here.
    """
    from app.services.instructions import build_prompt

    passed = 0
    failed: List[str] = []

    for case in cases:
        try:
            prompt = build_prompt(case["instruction"], case["situation"])
        except Exception as exc:  # noqa: BLE001
            failed.append(f"{case['name']}: the prompt could not be built ({exc})")
            continue

        problems: List[str] = []

        if not prompt or len(prompt) < 100:
            problems.append("the prompt is too short to be the real one")

        if "{" in prompt and "}" in prompt:
            # A hole that was not filled in. The templates use doubled
            # braces for the JSON, so only a single brace is a hole.
            import re

            holes = re.findall(r"(?<!\{)\{([a-z_]+)\}(?!\})", prompt)
            if holes:
                problems.append(f"the prompt still has holes: {holes}")

        for needed in case.get("prompt_must_contain", []):
            if needed not in prompt:
                problems.append(f"the prompt does not mention {needed!r}")

        if problems:
            failed.append(f"{case['name']}: " + "; ".join(problems))
        else:
            passed += 1

    return passed, len(cases), failed


def _run_model_level(cases: List[Dict[str, Any]]) -> Tuple[int, int, List[str], str]:
    """
    Check the answers, with the network.

    Returns (passed, total, failures, reason_it_was_skipped).
    """
    from app.services.gemini_client import get_pool
    from app.services.instructions import build_prompt

    if not get_pool().has_keys:
        return 0, len(cases), [], "no Gemini key is configured"

    from app.services.gemini_client import call_gemini_json

    passed = 0
    failed: List[str] = []

    for case in cases:
        if case.get("needs_model") is False:
            continue

        prompt = build_prompt(case["instruction"], case["situation"])
        try:
            answer = call_gemini_json(
                prompt,
                timeout=40,
                temperature=0.1,
                max_output_tokens=1200,
            )
        except Exception as exc:  # noqa: BLE001
            failed.append(f"{case['name']}: the call failed ({exc})")
            continue

        if answer is None:
            failed.append(f"{case['name']}: the model did not answer")
            continue

        if answer is None:
            failed.append(f"{case['name']}: the model did not answer")
            continue

        try:
            ok = bool(case["check"](answer))
        except Exception as exc:  # noqa: BLE001
            failed.append(f"{case['name']}: the check failed ({exc})")
            continue

        if ok:
            passed += 1
        else:
            failed.append(
                f"{case['name']}: the answer was not right ({str(answer)[:200]})"
            )

    total = sum(1 for c in cases if c.get("needs_model") is not False)
    return passed, total, failed, ""


def run(model_level: bool = True) -> int:
    """
    Run the suite.

    Returns the number of failures, so a script can exit on it.
    """
    prompt_passed, prompt_total, prompt_failed = _run_prompt_level(CASES)

    print("=" * 60)
    print("INSTRUCTION REGRESSION")
    print("=" * 60)
    print(f"\nPrompt level ({prompt_total} cases)")
    for failure in prompt_failed:
        print(f"  FAIL  {failure}")
    print(f"  {prompt_passed}/{prompt_total} passed")

    total_failures = len(prompt_failed)

    if model_level:
        model_passed, model_total, model_failed, reason = _run_model_level(CASES)
        print(f"\nModel level ({model_total} cases)")
        if reason:
            print(f"  SKIPPED: {reason}")
        else:
            for failure in model_failed:
                print(f"  FAIL  {failure}")
            print(f"  {model_passed}/{model_total} passed")
        total_failures += len(model_failed)

    print()
    print("=" * 60)
    if total_failures == 0:
        print("ALL PASSED")
    else:
        print(f"{total_failures} FAILED")
    print("=" * 60)

    return total_failures


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    sys.exit(1 if run() else 0)
