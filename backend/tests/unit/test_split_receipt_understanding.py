"""
The model, and what happens when it is not there.

A model is good at reading what a line of a receipt means. It is not
good at arithmetic, and it is not good at deciding what a receipt
adds up to. So it is asked only about the meaning, and the
arithmetic is worked out here from the lines it points at.

The model is also optional. When it is not configured, when it is
rate-limited, or when its answer does not make sense, the reading
that comes back is the plain one. A receipt that cannot be read by a
model is still a receipt.
"""

from decimal import Decimal

import pytest


def test_without_a_model_the_plain_reading_is_used(monkeypatch):
    """
    No key, no model, no problem. The receipt is still read.
    """
    from app.services.split_receipt_decomposition import read_receipt_with_understanding

    monkeypatch.delenv("GEMINI_API_KEY", raising=False)

    receipt = read_receipt_with_understanding(
        [
            "2x IC KOP SUSU G.AREN 56.000",
            "Nasi Goreng Spesial 35.000",
            "PB1 10% 9.100",
            "TOTAL 100.100",
        ]
    )

    assert len(receipt.items) == 2
    assert receipt.items[0].quantity == Decimal("2")
    assert receipt.tax == Decimal("9100")
    assert receipt.grand_total == Decimal("100100")


def test_the_model_is_only_asked_about_what_the_lines_mean(monkeypatch):
    """
    The model is asked for the meaning of each line and for nothing
    else. It is not asked to add the receipt up, because a model that
    adds up a receipt gets it wrong in a way nobody can see.
    """
    from app.services import split_receipt_decomposition as service

    asked = []

    def fake_call(prompt, **kwargs):
        asked.append(prompt)
        return "[]"

    monkeypatch.setattr(service, "call_gemini_text", fake_call, raising=False)
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")

    service.read_receipt_with_understanding(["Nasi Goreng 35.000"])

    assert asked, "the model was not asked at all"
    prompt = asked[0]
    assert "total" in prompt.lower()
    assert "subtotal" in prompt.lower()


def test_an_answer_from_the_model_that_makes_no_sense_is_ignored(monkeypatch):
    """
    The model said something that is not a list of lines. The plain
    reading is used instead, and the receipt is still read.
    """
    from app.services import split_receipt_decomposition as service

    monkeypatch.setattr(
        service, "call_gemini_text", lambda *a, **k: "this is not json", raising=False
    )
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")

    receipt = service.read_receipt_with_understanding(
        ["2x IC KOP SUSU G.AREN 56.000", "TOTAL 56.000"]
    )

    assert len(receipt.items) == 1
    assert receipt.items[0].quantity == Decimal("2")


def test_an_answer_from_the_model_with_a_line_that_is_not_on_the_receipt_is_ignored(monkeypatch):
    """
    The model made up a line. A line that is not on the receipt is
    not on the receipt, and it is not added to the bill.
    """
    from app.services import split_receipt_decomposition as service

    answer = (
        '[{"line": 1, "name": "Es Kopi Susu Gula Aren", "quantity": "2", '
        '"unit_price": "28000", "total_price": "56000"}]'
    )
    monkeypatch.setattr(service, "call_gemini_text", lambda *a, **k: answer, raising=False)
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")

    receipt = service.read_receipt_with_understanding(
        ["2x IC KOP SUSU G.AREN 56.000", "TOTAL 56.000"]
    )

    assert len(receipt.items) == 1
    assert receipt.items[0].name == "Es Kopi Susu Gula Aren"
    assert receipt.items[0].total_price == Decimal("56000")


def test_the_arithmetic_is_worked_out_here_and_not_by_the_model(monkeypatch):
    """
    The model is asked for the meaning of the lines. The subtotal and
    the total are worked out here, from the lines, so that the
    numbers cannot be wrong in a way nobody sees.
    """
    from app.services import split_receipt_decomposition as service

    answer = (
        '[{"line": 1, "name": "Es Kopi", "quantity": "2", '
        '"unit_price": "28000", "total_price": "56000"}, '
        '{"line": 2, "name": "Nasi Goreng", "quantity": "1", '
        '"unit_price": "35000", "total_price": "35000"}]'
    )
    monkeypatch.setattr(service, "call_gemini_text", lambda *a, **k: answer, raising=False)
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")

    receipt = service.read_receipt_with_understanding(
        [
            "2x IC KOP SUSU G.AREN 56.000",
            "Nasi Goreng Spesial 35.000",
            "SUBTOTAL 91.000",
            "TOTAL 91.000",
        ]
    )

    # The lines add up to 91.000, and the subtotal on the paper says
    # 91.000, so there is no gap.
    assert receipt.subtotal == Decimal("91000")
    assert receipt.discrepancy is None


def test_a_gap_the_model_could_not_hide_is_still_reported(monkeypatch):
    """
    The model says the lines are worth 91.000. The paper says the
    subtotal is 150.000. The gap is still reported, because the paper
    is the paper.
    """
    from app.services import split_receipt_decomposition as service

    answer = (
        '[{"line": 1, "name": "Es Kopi", "quantity": "2", '
        '"unit_price": "28000", "total_price": "56000"}]'
    )
    monkeypatch.setattr(service, "call_gemini_text", lambda *a, **k: answer, raising=False)
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")

    receipt = service.read_receipt_with_understanding(
        ["2x IC KOP SUSU G.AREN 56.000", "SUBTOTAL 150.000", "TOTAL 150.000"]
    )

    assert receipt.discrepancy is not None
    assert abs(receipt.discrepancy) == Decimal("94000")


def test_the_answer_of_the_model_is_treated_as_data_and_not_as_an_instruction(monkeypatch):
    """
    The model is asked about a receipt that somebody else wrote. What
    it says is data about a receipt. It cannot change what this
    function does.
    """
    from app.services import split_receipt_decomposition as service

    answer = (
        '[{"line": 1, "name": "Es Kopi", "quantity": "2", '
        '"unit_price": "28000", "total_price": "56000", '
        '"kind": "tax", "total": "999999999"}]'
    )
    monkeypatch.setattr(service, "call_gemini_text", lambda *a, **k: answer, raising=False)
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")

    receipt = service.read_receipt_with_understanding(
        ["2x IC KOP SUSU G.AREN 56.000", "TOTAL 56.000"]
    )

    # The total on the receipt is the total on the receipt.
    assert receipt.grand_total == Decimal("56000")
    # The kind of a line is decided by what the line says, not by
    # what the model says about it.
    assert receipt.items[0].kind == "item"
