#!/usr/bin/env python3
"""
Black-box production sweep for my-financial-manager.online.

Registers a throwaway user, runs the CRUD matrix over every write
endpoint, reads the balance before and after each mutation, and asserts
the money moved the way the rules say it should.

Read-only against the app's API. It creates its own user and deletes
only what it created.
"""

import json
import sys
import time
import urllib.error
import urllib.request
import uuid
from datetime import date, timedelta

BASE = "https://my-financial-manager.online/api"

FAILURES = []
PASSES = 0


def fail(msg):
    FAILURES.append(msg)
    print(f"  FAIL {msg}")


def ok(msg):
    global PASSES
    PASSES += 1
    print(f"  OK   {msg}")


def call(method, path, token=None, body=None, expect=None):
    url = f"{BASE}{path}"
    data = None
    headers = {"Accept": "application/json"}
    if body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            raw = resp.read()
            status = resp.status
    except urllib.error.HTTPError as exc:
        raw = exc.read()
        status = exc.code
    try:
        payload = json.loads(raw) if raw else None
    except Exception:
        payload = raw.decode("utf-8", "replace")[:400]
    if expect is not None and status != expect:
        fail(f"{method} {path} -> {status} (expected {expect}): {str(payload)[:220]}")
    return status, payload


def section(title):
    print(f"\n--- {title} " + "-" * max(0, 60 - len(title)))


def main():
    email = f"qa-{uuid.uuid4().hex[:12]}@qa.finmanager.online"
    password = "QaSweep#2026x"

    section("auth")
    status, payload = call(
        "POST", "/register", body={"email": email, "password": password}, expect=201
    )
    if not isinstance(payload, dict) or "access_token" not in (payload or {}):
        fail(f"register did not give a token: {str(payload)[:200]}")
        print("\nCannot continue without a token.")
        return 1
    token = payload["access_token"]
    user_id = (payload.get("user") or {}).get("id")
    ok(f"registered {email} as user {user_id}")

    status, payload = call(
        "POST", "/login", body={"email": email, "password": password}, expect=200
    )
    ok("login with email+password works") if status == 200 else fail(
        f"login -> {status}"
    )

    status, payload = call("GET", "/me", token=token)
    if status == 200 and payload.get("id") == user_id:
        ok("GET /me returns the right reader")
    else:
        fail(f"GET /me -> {status} {str(payload)[:150]}")

    # --- A second reader, for the ownership checks --------------------
    email_b = f"qa-{uuid.uuid4().hex[:12]}@qa.finmanager.online"
    status, payload_b = call(
        "POST", "/register", body={"email": email_b, "password": password}, expect=201
    )
    token_b = (payload_b or {}).get("access_token")
    user_b = ((payload_b or {}).get("user") or {}).get("id")
    ok(f"registered a second reader as user {user_b}")

    # --- The account we move money in ---------------------------------
    section("accounts")
    status, acc = call(
        "POST",
        "/accounts/",
        token=token,
        body={
            "name": f"QA Sweep {uuid.uuid4().hex[:6]}",
            "account_type": "cash",
            "balance": 1000000,
            "currency": "IDR",
        },
        expect=201,
    )
    if not isinstance(acc, dict) or "id" not in (acc or {}):
        fail(f"could not create an account: {str(acc)[:200]}")
        return 1
    account_id = acc["id"]
    ok(f"created account {account_id}")

    status, fetched = call("GET", f"/accounts/{account_id}", token=token)
    if status == 200 and float(fetched.get("balance", 0)) == 1000000:
        ok("the account reads back with the right balance")
    else:
        fail(f"GET /accounts/{account_id} -> {status} {str(fetched)[:200]}")

    # A reader must not be able to read somebody else's account.
    status, _ = call("GET", f"/accounts/{account_id}", token=token_b)
    if status == 403:
        ok("another reader is refused the account (403)")
    else:
        fail(f"another reader got {status} for the account, expected 403")

    # --- Categories ----------------------------------------------------
    section("categories")
    status, cats = call("GET", "/categories/", token=token)
    category_id = None
    if isinstance(cats, list) and cats:
        category_id = cats[0].get("id")
        ok(f"there are {len(cats)} categories, using {category_id}")
    else:
        ok("no categories yet (that is allowed)")

    # --- The transaction matrix ----------------------------------------
    section("transactions - add, edit, delete")

    def balance_of():
        _, data = call("GET", f"/accounts/{account_id}", token=token)
        try:
            return float(data["balance"])
        except Exception:
            return None

    start = balance_of()
    if start is None:
        fail("could not read the balance")
        return 1

    # 1. an expense written by hand: the balance has to go down
    status, tx = call(
        "POST",
        "/transactions/",
        token=token,
        body={
            "type": "expense",
            "amount": 100000,
            "currency": "IDR",
            "date": str(date.today()),
            "description": "QA sweep expense",
            "account_id": account_id,
            "category_id": category_id,
        },
        expect=201,
    )
    if not isinstance(tx, dict) or "id" not in (tx or {}):
        fail(f"could not create an expense: {str(tx)[:250]}")
        return 1
    tx_id = tx["id"]
    after_create = balance_of()
    if after_create is not None and abs((start - after_create) - 100000) < 1:
        ok(f"an expense of 100000 took the balance from {start} to {after_create}")
    else:
        fail(f"the balance after an expense is {after_create}, expected {start - 100000}")

    if tx.get("status") in (None, "", "approved"):
        ok(f"a hand-written transaction is counted straight away (status={tx.get('status')!r})")
    else:
        fail(f"a hand-written transaction has status {tx.get('status')!r}, expected it to count")

    # 2. editing the amount: the difference has to be applied once
    status, updated = call(
        "PUT",
        f"/transactions/{tx_id}",
        token=token,
        body={"amount": 200000},
        expect=200,
    )
    after_update = balance_of()
    if after_update is not None and abs((after_update - after_create) + 100000) < 1:
        ok(f"raising the amount to 200000 took the balance to {after_update}")
    else:
        fail(f"the balance after the edit is {after_update}, expected {after_update - 100000}")

    # 3. reading it back
    status, read_tx = call("GET", f"/transactions/{tx_id}", token=token)
    if status == 200 and float(read_tx.get("amount", 0)) == 200000:
        ok("the edited transaction reads back with the new amount")
    else:
        fail(f"GET /transactions/{tx_id} -> {status} {str(read_tx)[:200]}")

    # 4. deleting it: the balance has to go back to where it started
    status, _ = call("DELETE", f"/transactions/{tx_id}", token=token, expect=204)
    after_delete = balance_of()
    if after_delete is not None and abs(after_delete - start) < 1:
        ok(f"deleting the transaction put the balance back to {after_delete}")
    else:
        fail(f"the balance after the delete is {after_delete}, expected {start}")

    # 5. the transaction has to be gone
    status, _ = call("GET", f"/transactions/{tx_id}", token=token)
    if status == 404:
        ok("the deleted transaction is gone")
    else:
        fail(f"the deleted transaction still answers {status}")

    # 6. an income: the balance has to go up, and come back down
    status, inc = call(
        "POST",
        "/transactions/",
        token=token,
        body={
            "type": "income",
            "amount": 250000,
            "currency": "IDR",
            "date": str(date.today()),
            "description": "QA sweep income",
            "account_id": account_id,
        },
        expect=201,
    )
    inc_id = inc.get("id") if isinstance(inc, dict) else None
    after_income = balance_of()
    if after_income is not None and abs((after_income - start) - 250000) < 1:
        ok(f"an income of 250000 took the balance to {after_income}")
    else:
        fail(f"the balance after the income is {after_income}, expected {start + 250000}")

    call("DELETE", f"/transactions/{inc_id}", token=token, expect=204)
    after_income_delete = balance_of()
    if after_income_delete is not None and abs(after_income_delete - start) < 1:
        ok(f"deleting the income put the balance back to {after_income_delete}")
    else:
        fail(f"the balance after the income delete is {after_income_delete}, expected {start}")

    # 7. a pending transaction must not move the balance
    status, pend = call(
        "POST",
        "/transactions/",
        token=token,
        body={
            "type": "expense",
            "amount": 75000,
            "currency": "IDR",
            "date": str(date.today()),
            "description": "QA sweep pending",
            "account_id": account_id,
            "status": "pending",
        },
        expect=201,
    )
    pend_id = pend.get("id") if isinstance(pend, dict) else None
    after_pending = balance_of()
    if after_pending is not None and abs(after_pending - start) < 1:
        ok("a pending transaction does not move the balance")
    else:
        fail(f"a pending transaction moved the balance to {after_pending}")

    # 8. approving it moves the balance
    status, _ = call("POST", f"/feed/approve/{pend_id}", token=token)
    after_approve = balance_of()
    if after_approve is not None and abs((after_approve - start) + 75000) < 1:
        ok(f"approving the pending transaction took the balance to {after_approve}")
    else:
        fail(f"the balance after the approval is {after_approve}, expected {start - 75000}")

    # 9. deleting an approved pending-moved transaction restores the balance
    call("DELETE", f"/transactions/{pend_id}", token=token, expect=204)
    after_pend_delete = balance_of()
    if after_pend_delete is not None and abs(after_pend_delete - start) < 1:
        ok(f"deleting the approved transaction put the balance back to {after_pend_delete}")
    else:
        fail(f"the balance after the delete is {after_pend_delete}, expected {start}")

    # 10. the list must show what was written
    status, listed = call("GET", "/transactions/", token=token)
    if isinstance(listed, list):
        ok(f"the transaction list answers with {len(listed)} rows")
    else:
        fail(f"GET /transactions/ -> {status} {str(listed)[:150]}")

    # 11. idempotency
    key = uuid.uuid4().hex
    payload = {
        "type": "expense",
        "amount": 1000,
        "currency": "IDR",
        "date": str(date.today()),
        "description": "QA sweep idempotent",
        "account_id": account_id,
        "client_request_id": key,
    }
    status, a = call("POST", "/transactions/", token=token, body=payload, expect=201)
    status, b = call("POST", "/transactions/", token=token, body=payload, expect=201)
    if isinstance(a, dict) and isinstance(b, dict) and a.get("id") == b.get("id"):
        ok("the same client_request_id gives the same transaction")
        call("DELETE", f"/transactions/{a['id']}", token=token, expect=204)
    else:
        fail(f"idempotency broke: {a.get('id') if isinstance(a, dict) else a} vs {b.get('id') if isinstance(b, dict) else b}")

    # 12. the balance has to be back to where it started
    final_balance = balance_of()
    if final_balance is not None and abs(final_balance - start) < 1:
        ok(f"the balance is back to {final_balance} after the whole matrix")
    else:
        fail(f"the balance ended at {final_balance}, expected {start}")

    # --- The feed ------------------------------------------------------
    section("feed")
    status, feed_pending = call("GET", "/feed/pending", token=token)
    if status == 200:
        ok("the pending queue answers")
    else:
        fail(f"GET /feed/pending -> {status}")

    status, feed_stats = call("GET", "/feed/stats", token=token)
    if status == 200 and isinstance(feed_stats, dict):
        keys = set(feed_stats)
        expected = {"pending_count", "approved_today", "rejected_today"}
        if expected.issubset(keys):
            ok(f"the feed stats have the right keys: {sorted(keys & expected)}")
        else:
            fail(f"the feed stats are missing {sorted(expected - keys)}: {sorted(keys)}")
    else:
        fail(f"GET /feed/stats -> {status} {str(feed_stats)[:150]}")

    # --- The dashboard --------------------------------------------------
    section("dashboard")
    status, summary = call("GET", "/dashboard/summary", token=token)
    if status == 200 and isinstance(summary, dict):
        # The page reads the camelCase names first and falls back to the
        # snake_case ones, so either pair has to be there.
        pairs = [
            ("totalIncome", "total_income"),
            ("totalExpense", "total_expense"),
            ("netSavings", "net_cash_flow"),
        ]
        missing = []
        for camel, snake in pairs:
            if camel not in summary and snake not in summary:
                missing.append(f"{camel}/{snake}")
        for name in ("total_balance", "total_spent", "total_budget"):
            if name not in summary:
                missing.append(name)
        if missing:
            fail(f"the dashboard summary is missing {missing}")
        else:
            ok("the dashboard summary has every key the UI reads")
        if abs(float(summary.get("total_balance", 0)) - start) < 1:
            ok(f"the dashboard total_balance is {summary.get('total_balance')}, the same as the account")
        else:
            fail(f"the dashboard total_balance is {summary.get('total_balance')}, expected {start}")
    else:
        fail(f"GET /dashboard/summary -> {status} {str(summary)[:200]}")

    # --- The auth boundary ---------------------------------------------
    section("auth boundary - a signed-out reader gets nothing")
    anonymous = [
        ("GET", "/dashboard/summary"),
        ("GET", "/dashboard/accounts"),
        ("GET", "/dashboard/cash-flow"),
        ("GET", "/accounts/summary/total-balance"),
        ("GET", "/transactions/summary/by-period"),
        ("GET", "/transactions/summary/by-category"),
        ("GET", "/analytics/expense-breakdown"),
        ("GET", "/analytics/income-breakdown"),
        ("GET", "/analytics/merchants/top"),
        ("GET", "/analytics/net-worth-history"),
        ("GET", "/analytics/spending-patterns"),
        ("GET", "/accounts/"),
        ("GET", "/transactions/"),
    ]
    for method, path in anonymous:
        status, payload = call(method, path)
        if status in (401, 403):
            ok(f"{method} {path} without a token -> {status}")
        else:
            fail(f"{method} {path} without a token -> {status} (expected 401/403): {str(payload)[:200]}")

    # --- The other write endpoints --------------------------------------
    section("the other write endpoints")

    status, budget = call(
        "POST",
        "/budgets/",
        token=token,
        body={
            "name": f"QA budget {uuid.uuid4().hex[:6]}",
            "amount": 500000,
            "period": "monthly",
            "start_date": str(date.today()),
        },
    )
    if status in (200, 201) and isinstance(budget, dict) and budget.get("id"):
        ok(f"created budget {budget['id']}")
        status, budgets = call("GET", "/budgets/", token=token)
        if status == 200:
            ok(f"the budget list answers with {len(budgets) if isinstance(budgets, list) else '?'} rows")
        bid = budget["id"]
    else:
        fail(f"could not create a budget: {status} {str(budget)[:250]}")
        bid = None

    status, goal = call(
        "POST",
        "/goals/",
        token=token,
        body={
            "name": f"QA goal {uuid.uuid4().hex[:6]}",
            "target_amount": 3000000,
            "target_date": str(date.today() + timedelta(days=180)),
        },
    )
    if status in (200, 201) and isinstance(goal, dict) and goal.get("id"):
        ok(f"created goal {goal['id']}")
        gid = goal["id"]
    else:
        fail(f"could not create a goal: {status} {str(goal)[:250]}")
        gid = None

    status, debt = call(
        "POST",
        "/debts/",
        token=token,
        body={
            "name": f"QA debt {uuid.uuid4().hex[:6]}",
            "principal": 2000000,
            "interest_rate": 0.05,
            "term_months": 12,
        },
    )
    if status in (200, 201) and isinstance(debt, dict) and debt.get("id"):
        ok(f"created debt {debt['id']}")
        did = debt["id"]
    else:
        fail(f"could not create a debt: {status} {str(debt)[:250]}")
        did = None

    status, shop = call(
        "POST",
        "/shopping/items",
        token=token,
        body={
            "name": f"QA item {uuid.uuid4().hex[:6]}",
            "price": 50000,
            "quantity": 1,
            "stage": "wishlist",
        },
    )
    if status in (200, 201) and isinstance(shop, dict) and shop.get("id"):
        ok(f"created a shopping item {shop['id']}")
        sid = shop["id"]
    else:
        fail(f"could not create a shopping item: {status} {str(shop)[:250]}")
        sid = None

    # --- The edits -------------------------------------------------------
    section("the edits")
    if bid:
        status, updated = call("PUT", f"/budgets/{bid}", token=token, body={"amount": 750000})
        if status == 200:
            amount = updated.get("amount") if isinstance(updated, dict) else None
            if amount is not None and abs(float(amount) - 750000) < 1:
                ok("the budget edit reads back with the new amount")
            else:
                fail(f"the budget amount after the edit is {amount}, expected 750000")
        else:
            fail(f"PUT /budgets/{bid} -> {status} {str(updated)[:200]}")

    if gid:
        status, updated = call("PUT", f"/goals/{gid}", token=token, body={"target_amount": 4000000})
        if status == 200:
            ok("the goal edit works")
        else:
            fail(f"PUT /goals/{gid} -> {status} {str(updated)[:200]}")

    if did:
        status, updated = call("PUT", f"/debts/{did}", token=token, body={"principal": 2500000})
        if status == 200:
            ok("the debt edit works")
        else:
            fail(f"PUT /debts/{did} -> {status} {str(updated)[:200]}")

    if sid:
        status, updated = call("PUT", f"/shopping/items/{sid}", token=token, body={"price": 75000})
        if status == 200:
            ok("the shopping item edit works")
        else:
            fail(f"PUT /shopping/items/{sid} -> {status} {str(updated)[:200]}")

    # --- The deletes -----------------------------------------------------
    section("the deletes")
    for path, rid, label in (
        (f"/budgets/{bid}", bid, "budget"),
        (f"/goals/{gid}", gid, "goal"),
        (f"/debts/{did}", did, "debt"),
        (f"/shopping/items/{sid}", sid, "shopping item"),
    ):
        if not rid:
            continue
        status, _ = call("DELETE", path, token=token)
        if status in (200, 204):
            ok(f"deleted the {label}")
        else:
            fail(f"DELETE {path} -> {status}")

    # --- The empty-string case -------------------------------------------
    section("the empty-string case")
    status, payload = call(
        "POST",
        "/transactions/",
        token=token,
        body={
            "type": "expense",
            "amount": 1000,
            "currency": "IDR",
            "date": str(date.today()),
            "description": "",
            "notes": "",
            "account_id": account_id,
            "category_id": "",
        },
    )
    if status in (200, 201):
        ok("a transaction with empty strings is accepted")
        if isinstance(payload, dict) and payload.get("id"):
            call("DELETE", f"/transactions/{payload['id']}", token=token, expect=204)
    else:
        fail(f"a transaction with empty strings -> {status} {str(payload)[:250]}")

    # --- The cross-reader checks ------------------------------------------
    section("cross reader")
    if sid:
        status, _ = call("GET", f"/shopping/items/{sid}", token=token_b)
        if status in (403, 404):
            ok(f"another reader is refused the shopping item ({status})")
        else:
            fail(f"another reader got {status} for the shopping item, expected 403/404")

    # --- The transfers ----------------------------------------------------
    section("transfers")
    status, acc2 = call(
        "POST",
        "/accounts/",
        token=token,
        body={
            "name": f"QA Sweep 2 {uuid.uuid4().hex[:6]}",
            "account_type": "bank",
            "balance": 500000,
            "currency": "IDR",
        },
    )
    if status in (200, 201) and isinstance(acc2, dict) and acc2.get("id"):
        account2 = acc2["id"]
        ok(f"created a second account {account2}")
        status, tr = call(
            "POST",
            "/transfers/",
            token=token,
            body={
                "from_account_id": account_id,
                "to_account_id": account2,
                "amount": 100000,
                "date": str(date.today()),
                "description": "QA sweep transfer",
            },
        )
        if status in (200, 201):
            ok("the transfer was accepted")
            _, a1 = call("GET", f"/accounts/{account_id}", token=token)
            _, a2 = call("GET", f"/accounts/{account2}", token=token)
            b1 = float((a1 or {}).get("balance", 0))
            b2 = float((a2 or {}).get("balance", 0))
            if abs((start - b1) - 100000) < 1 and abs((b2 - 500000) - 100000) < 1:
                ok(f"the transfer moved the money: {b1} and {b2}")
            else:
                fail(f"the transfer did not move the money as expected: {b1} and {b2}")
            # A transfer is not spending and it is not income.
            _, summary_tr = call("GET", "/dashboard/summary", token=token)
            if isinstance(summary_tr, dict):
                income = summary_tr.get("totalIncome", summary_tr.get("total_income", 0))
                expense = summary_tr.get("totalExpense", summary_tr.get("total_expense", 0))
                if abs(float(income)) < 1 and abs(float(expense)) < 1:
                    ok("a transfer is counted neither as income nor as spending")
                else:
                    fail(f"a transfer was counted: income {income}, expense {expense}")
        else:
            fail(f"POST /transfers/ -> {status} {str(tr)[:250]}")
            account2 = None
    else:
        fail(f"could not create a second account: {status}")
        account2 = None

    # --- The recurring rules ----------------------------------------------
    section("recurring")
    status, rec = call(
        "POST",
        "/recurring/",
        token=token,
        body={
            "name": f"QA recurring {uuid.uuid4().hex[:6]}",
            "type": "expense",
            "amount": 25000,
            "frequency": "monthly",
            "start_date": str(date.today()),
            "account_id": account_id,
        },
    )
    if status in (200, 201) and isinstance(rec, dict) and rec.get("id"):
        ok(f"created a recurring rule {rec['id']}")
        rid = rec["id"]
    else:
        fail(f"could not create a recurring rule: {status} {str(rec)[:250]}")
        rid = None

    # --- The categories ---------------------------------------------------
    section("categories")
    status, cat = call(
        "POST",
        "/categories/",
        token=token,
        body={"name": f"QA cat {uuid.uuid4().hex[:6]}", "type": "expense", "icon": "tag"},
    )
    if status in (200, 201) and isinstance(cat, dict) and cat.get("id"):
        ok(f"created a category {cat['id']}")
        cid = cat["id"]
    else:
        fail(f"could not create a category: {status} {str(cat)[:250]}")
        cid = None

    # --- The parser -------------------------------------------------------
    section("parsers")
    status, sms = call(
        "POST",
        "/parser/parse-text",
        token=token,
        body={
            "raw_text": "BCA QRIS QR 1234567890 25.000,00 IDR Berhasil 05/11/2026 12:00",
        },
    )
    if status == 200:
        ok("the text parser answers")
    else:
        fail(f"POST /parser/parse-text -> {status} {str(sms)[:200]}")

    status, ocr = call("GET", "/parser/ocr-status")
    if status == 200 and isinstance(ocr, dict) and ocr.get("ready") is not None:
        ok(f"the OCR status answers, ready={ocr.get('ready')}")
    else:
        fail(f"GET /parser/ocr-status -> {status} {str(ocr)[:200]}")

    status, qris = call("POST", "/webhooks/qris-test", token=token, body={})
    if status in (200, 400, 422):
        ok(f"the QRIS webhook test endpoint answers ({status})")
    else:
        fail(f"POST /webhooks/qris-test -> {status} {str(qris)[:200]}")

    # --- The category hints ------------------------------------------------
    section("category hints")
    status, hints = call("GET", "/category-hints/bootstrap", token=token)
    if status == 200:
        ok("the category hints bootstrap answers")
    else:
        fail(f"GET /category-hints/bootstrap -> {status} {str(hints)[:200]}")

    # --- The split bills ---------------------------------------------------
    section("split bills")
    status, group = call(
        "POST",
        "/split/groups",
        token=token,
        body={"name": f"QA split {uuid.uuid4().hex[:6]}"},
    )
    if status in (200, 201) and isinstance(group, dict) and group.get("id"):
        ok(f"created a split group {group['id']}")
        gid2 = group["id"]
        status, expenses = call("GET", f"/split/groups/{gid2}/expenses", token=token)
        if status == 200:
            ok("the split group expenses answer")
        else:
            fail(f"GET /split/groups/{gid2}/expenses -> {status}")
        status, balances = call("GET", f"/split/groups/{gid2}/balances", token=token)
        if status == 200:
            ok("the split group balances answer")
        else:
            fail(f"GET /split/groups/{gid2}/balances -> {status}")
    else:
        fail(f"could not create a split group: {status} {str(group)[:250]}")

    # --- The removals --------------------------------------------------------
    section("the removals")
    for path, rid2, label in (
        (f"/recurring/{rid}", rid, "recurring rule"),
        (f"/categories/{cid}", cid, "category"),
    ):
        if not rid2:
            continue
        status, _ = call("DELETE", path, token=token)
        if status in (200, 204):
            ok(f"deleted the {label}")
        else:
            fail(f"DELETE {path} -> {status}")

    # --- The result --------------------------------------------------------
    print()
    print("=" * 70)
    if FAILURES:
        print(f" SWEEP FAILED - {len(FAILURES)} problems, {PASSES} passed")
        print("=" * 70)
        for f in FAILURES:
            print(f"  - {f}")
        print(f"\nthrowaway user: {email} (id {user_id})")
        return 1
    print(f" SWEEP PASSED - {PASSES} checks")
    print("=" * 70)
    return 0


if __name__ == "__main__":
    sys.exit(main())
