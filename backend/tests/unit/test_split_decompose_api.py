"""
Turning a receipt into something people can claim.

The endpoint takes the lines a receipt was read into and gives back
the dishes on it, with the quantity of each kept apart, the tax and
the service charge and the discount put where they belong, and the
gap between the lines and the subtotal reported if there is one.

Nothing is written down. This is a reading, and a reading is a
proposal. The reader looks at it and decides whether to make a bill
out of it.
"""

from decimal import Decimal

def test_the_receipt_is_read_and_the_lines_are_given_back(split_client):
    """
    Two coffees are two coffees, and either of them may be claimed by
    a different person.
    """
    response = split_client.post(
        "/api/split/decompose",
        json={
            "lines": [
                "2x IC KOP SUSU G.AREN 56.000",
                "Nasi Goreng Spesial 35.000",
                "PB1 10% 9.100",
                "SERVICE CHARGE 5% 5.500",
                "Potongan Harga Paket 15.000",
                "TOTAL 90.600",
            ]
        },
    )

    assert response.status_code == 200, response.text
    body = response.json()

    assert len(body["items"]) == 2
    assert body["items"][0]["quantity"] == "2"
    assert body["items"][0]["unit_price"] == "28000.00"
    assert body["items"][0]["total_price"] == "56000.00"
    assert body["tax"] == "9100.00"
    assert body["service_charge"] == "5500.00"
    assert body["discount"] == "15000.00"
    assert body["grand_total"] == "90600.00"


def test_a_receipt_that_does_not_add_up_says_so(split_client):
    response = split_client.post(
        "/api/split/decompose",
        json={
            "lines": [
                "Nasi Goreng Spesial 140.000",
                "SUBTOTAL 150.000",
                "TOTAL 150.000",
            ]
        },
    )

    assert response.status_code == 200, response.text
    body = response.json()

    assert body["discrepancy"] == "-10000.00"


def test_a_receipt_with_nothing_on_it_is_still_an_answer(split_client):
    response = split_client.post("/api/split/decompose", json={"lines": []})

    assert response.status_code == 200, response.text
    body = response.json()

    assert body["items"] == []
    assert body["grand_total"] == "0.00"
    assert body["discrepancy"] is None


def test_nothing_is_written_down(split_client):
    """
    This is a reading. It must not create a receipt, a bill, a group
    or a transaction.
    """
    from app.models.split_bill import SplitExpense, SplitGroup
    from app.models.transaction import Transaction

    db = split_client.db()
    try:
        before = {
            "groups": db.query(SplitGroup).count(),
            "expenses": db.query(SplitExpense).count(),
            "transactions": db.query(Transaction).count(),
        }
    finally:
        db.close()

    split_client.post(
        "/api/split/decompose",
        json={"lines": ["Nasi Goreng 35.000", "TOTAL 35.000"]},
    )

    db = split_client.db()
    try:
        after = {
            "groups": db.query(SplitGroup).count(),
            "expenses": db.query(SplitExpense).count(),
            "transactions": db.query(Transaction).count(),
        }
    finally:
        db.close()

    assert after == before
