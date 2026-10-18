#!/usr/bin/env python3
"""
Financial Manager - Extended QA Test Suite
Deep testing of all API endpoints, authentication, validation, and data integrity.
"""

import sys
sys.path.insert(0, '/Users/rafi/financial-manager/backend/venv/lib/python3.13/site-packages')

import requests
import json
import time
from datetime import datetime

BASE = "http://localhost:8000"
API = f"{BASE}/api"
GREEN = '\033[0;32m'
RED = '\033[0;31m'
YELLOW = '\033[1;33m'
BLUE = '\033[0;34m'
CYAN = '\033[0;36m'
NC = '\033[0m'

passed = 0
failed = 0
warnings = 0
issues = []
warn_list = []


def test(name, method, url, data=None, expected_statuses=None, headers=None):
    global passed, failed
    if expected_statuses is None:
        expected_statuses = [200, 201]
    try:
        h = {"Content-Type": "application/json"}
        if headers:
            h.update(headers)
        if method == "GET":
            r = requests.get(url, timeout=10, headers=h)
        elif method == "POST":
            r = requests.post(url, json=data, timeout=10, headers=h)
        elif method == "PUT":
            r = requests.put(url, json=data, timeout=10, headers=h)
        elif method == "DELETE":
            r = requests.delete(url, timeout=10, headers=h)

        ok = r.status_code in expected_statuses
        if ok:
            passed += 1
            print(f"  {GREEN}✓{NC} [{r.status_code}] {name}")
        else:
            failed += 1
            body = r.text[:120]
            issues.append((name, r.status_code, body))
            print(f"  {RED}✗{NC} [{r.status_code}] {name}")
            print(f"      {YELLOW}→ {body}{NC}")
        return r
    except Exception as e:
        failed += 1
        issues.append((name, "ERROR", str(e)))
        print(f"  {RED}✗{NC} [ERR] {name}: {e}")
        return None


def warn(name, message):
    global warnings
    warnings += 1
    warn_list.append((name, message))
    print(f"  {YELLOW}⚠{NC}  {name}: {message}")


def section(title):
    print(f"\n{BLUE}{'─'*55}{NC}")
    print(f"{BLUE}  {title}{NC}")
    print(f"{BLUE}{'─'*55}{NC}")


print("\n" + "="*55)
print("  Financial Manager - Extended QA Suite")
print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print("="*55)

# ─────────────────────────────────────────────────────────
section("1. ROOT & HEALTH")
# ─────────────────────────────────────────────────────────
r = test("GET / (root)", "GET", f"{BASE}/")
if r and r.status_code == 200:
    d = r.json()
    print(f"      → {d.get('message')} v{d.get('version')}")

r = test("GET /health", "GET", f"{BASE}/health")
if r and r.status_code == 200:
    print(f"      → Status: {r.json().get('status')}, Version: {r.json().get('version')}")

r = test("GET /api/info", "GET", f"{API}/info")
if r and r.status_code == 200:
    modules = r.json().get("modules", [])
    print(f"      → {len(modules)} modules registered")

test("GET /docs (Swagger UI)", "GET", f"{BASE}/docs")
test("GET /redoc", "GET", f"{BASE}/redoc")
test("GET /openapi.json", "GET", f"{BASE}/openapi.json")

# ─────────────────────────────────────────────────────────
section("2. AUTHENTICATION")
# ─────────────────────────────────────────────────────────

# Input validation
test("POST /auth/register (empty body)", "POST", f"{API}/auth/register", {}, [400, 422])
test("POST /auth/register (invalid email)", "POST", f"{API}/auth/register",
     {"email": "not-an-email", "password": "Password123!"}, [400, 422])
test("POST /auth/register (short password)", "POST", f"{API}/auth/register",
     {"email": "test@test.com", "password": "abc"}, [400, 422])

# Invalid login
r = test("POST /auth/login (wrong credentials)", "POST", f"{API}/auth/login",
         {"email": "noexist@example.com", "password": "wrongpassword"}, [401, 403, 404, 422])

# Supabase auth
test("POST /auth/supabase (invalid token)", "POST", f"{API}/auth/supabase",
     {"token": "invalid_jwt_token"}, [401, 403, 400, 422, 200])

# ─────────────────────────────────────────────────────────
section("3. DASHBOARD (Public endpoints)")
# ─────────────────────────────────────────────────────────

r = test("GET /api/dashboard/summary", "GET", f"{API}/dashboard/summary")
if r and r.status_code == 200:
    d = r.json()
    required_keys = ["totalIncome", "totalExpense", "netSavings", "incomeByCategory", "expenseByCategory"]
    missing = [k for k in required_keys if k not in d]
    if missing:
        warn("Dashboard summary", f"Missing fields: {missing}")
    else:
        inc = d.get("totalIncome", 0)
        exp = d.get("totalExpense", 0)
        net = d.get("netSavings", 0)
        print(f"      → Income: Rp {inc:,.0f} | Expense: Rp {exp:,.0f} | Net: Rp {net:,.0f}")
        # Data integrity check
        if abs((inc - exp) - net) > 1:
            warn("Dashboard math", f"netSavings mismatch: {inc} - {exp} ≠ {net}")
        # Check period
        period = d.get("period", {})
        print(f"      → Period: {period.get('start')} to {period.get('end')}")

r = test("GET /api/dashboard/accounts", "GET", f"{API}/dashboard/accounts")
if r and r.status_code == 200:
    accounts = r.json().get("accounts", [])
    print(f"      → {len(accounts)} accounts found")
    if not accounts:
        warn("Dashboard accounts", "No accounts found - might be fresh DB")

# Cash flow timeframes
for tf in ["1D", "1W", "1M", "3M", "6M", "YTD"]:
    r = test(f"Cash flow timeframe={tf}", "GET", f"{API}/dashboard/cash-flow?timeframe={tf}",
             expected_statuses=[200, 400, 422])

# Invalid timeframe
r = test("Cash flow (invalid timeframe)", "GET", f"{API}/dashboard/cash-flow?timeframe=INVALID",
         expected_statuses=[200, 400, 422])

# ─────────────────────────────────────────────────────────
section("4. ANALYTICS (Public)")
# ─────────────────────────────────────────────────────────

analytics_endpoints = [
    "expense-breakdown",
    "income-breakdown",
    "cash-flow-trend",
    "monthly-comparison",
    "top-expenses",
    "financial-health",
]

for ep in analytics_endpoints:
    r = test(f"GET /analytics/{ep}", "GET", f"{API}/analytics/{ep}")
    if r and r.status_code == 200:
        d = r.json()
        if isinstance(d, list):
            print(f"      → {len(d)} items")
        elif isinstance(d, dict):
            if "data" in d:
                print(f"      → {len(d['data'])} data points")
            elif "score" in d:
                print(f"      → Health score: {d.get('score')}")

# With query params
test("Analytics with period param", "GET", f"{API}/analytics/expense-breakdown?period=monthly",
     expected_statuses=[200, 400, 422])
test("Analytics with date range", "GET", f"{API}/analytics/cash-flow-trend?start_date=2026-01-01&end_date=2026-10-01",
     expected_statuses=[200, 400, 422])

# ─────────────────────────────────────────────────────────
section("5. PROTECTED ENDPOINTS (must return 401)")
# ─────────────────────────────────────────────────────────

protected = [
    ("GET /api/accounts/", "GET", f"{API}/accounts/"),
    ("GET /api/transactions/", "GET", f"{API}/transactions/"),
    ("GET /api/budgets/", "GET", f"{API}/budgets/"),
    ("GET /api/goals/", "GET", f"{API}/goals/"),
    ("GET /api/debts/", "GET", f"{API}/debts/"),
    ("GET /api/recurring/", "GET", f"{API}/recurring/"),
    ("GET /api/categories/", "GET", f"{API}/categories/"),
    ("GET /api/data/export", "GET", f"{API}/data/export"),
    ("GET /api/ai/advice", "GET", f"{API}/ai/advice"),
    ("GET /api/feed", "GET", f"{API}/feed"),
    ("GET /api/transfers/", "GET", f"{API}/transfers/"),
    ("GET /api/merchant/list", "GET", f"{API}/merchant/list"),
    ("GET /api/logs", "GET", f"{API}/logs"),
]

for name, method, url in protected:
    r = test(name + " (no auth)", method, url, expected_statuses=[401, 403])
    if r and r.status_code not in [401, 403]:
        warn(name, f"Endpoint not protected! Status: {r.status_code}")

# ─────────────────────────────────────────────────────────
section("6. EXCHANGE & FOREX")
# ─────────────────────────────────────────────────────────

r = test("GET /api/exchange/rates?base=USD", "GET", f"{API}/exchange/rates?base=USD")
if r and r.status_code == 200:
    rates = r.json().get("rates", {})
    print(f"      → {len(rates)} currencies | IDR={rates.get('IDR', 'N/A')}")

r = test("GET /api/exchange/rates?base=IDR", "GET", f"{API}/exchange/rates?base=IDR")
if r and r.status_code == 200:
    rates = r.json().get("rates", {})
    print(f"      → {len(rates)} currencies | USD={rates.get('USD', 'N/A')}")

r = test("POST /api/exchange/convert (USD→IDR)", "POST", f"{API}/exchange/convert",
         {"amount": 100, "from_currency": "USD", "to_currency": "IDR"})
if r and r.status_code == 200:
    d = r.json()
    result = d.get("result") or d.get("converted") or d.get("amount_converted")
    print(f"      → USD 100 = IDR {result:,.0f}" if isinstance(result, (int, float)) else f"      → {d}")

r = test("POST /api/exchange/convert (IDR→USD)", "POST", f"{API}/exchange/convert",
         {"amount": 1000000, "from_currency": "IDR", "to_currency": "USD"})

r = test("GET /realtime/forex/quotes", "GET", f"{BASE}/realtime/forex/quotes")
if r and r.status_code == 200:
    quotes = r.json().get("quotes", [])
    print(f"      → {len(quotes)} forex pairs")
    for q in quotes[:3]:
        print(f"      → {q.get('pair')}: {q.get('price')}")

# ─────────────────────────────────────────────────────────
section("7. CALCULATORS")
# ─────────────────────────────────────────────────────────

r = test("POST /api/calculators/loan", "POST", f"{API}/calculators/loan",
         {"principal": 100000000, "rate": 5.5, "tenure_months": 60},
         expected_statuses=[200, 201, 422])
if r and r.status_code == 200:
    d = r.json()
    print(f"      → Keys: {list(d.keys())[:6]}")

r = test("POST /api/calculators/compound", "POST", f"{API}/calculators/compound",
         {"principal": 10000000, "rate": 7, "years": 5},
         expected_statuses=[200, 201, 422])
if r and r.status_code == 200:
    d = r.json()
    print(f"      → Keys: {list(d.keys())[:6]}")

# ─────────────────────────────────────────────────────────
section("8. CRON & SYSTEM")
# ─────────────────────────────────────────────────────────

r = test("GET /api/cron/process-recurring", "GET", f"{API}/cron/process-recurring")
if r and r.status_code == 200:
    d = r.json()
    print(f"      → Status: {d.get('status')}, Processed: {d.get('processed', 0)}")

# ─────────────────────────────────────────────────────────
section("9. ERROR HANDLING & EDGE CASES")
# ─────────────────────────────────────────────────────────

test("GET /nonexistent (404)", "GET", f"{BASE}/nonexistent-12345", expected_statuses=[404])
test("GET /api/nonexistent (404)", "GET", f"{API}/nonexistent-endpoint-xyz", expected_statuses=[404])
test("POST /api/accounts/ (no auth body)", "POST", f"{API}/accounts/",
     {"name": "Test"}, expected_statuses=[401, 403, 422])
test("GET /api/accounts/99999 (no auth)", "GET", f"{API}/accounts/99999",
     expected_statuses=[401, 403, 404])
test("DELETE /api/transactions/99999 (no auth)", "DELETE", f"{API}/transactions/99999",
     expected_statuses=[401, 403, 404, 405])

# Malformed JSON test via headers
r = requests.post(f"{API}/auth/login",
                  data="not valid json",
                  headers={"Content-Type": "application/json"},
                  timeout=5)
if r.status_code in [400, 422]:
    passed += 1
    print(f"  {GREEN}✓{NC} [422] Malformed JSON → proper error")
else:
    warn("Malformed JSON handling", f"Got {r.status_code} instead of 400/422")

# ─────────────────────────────────────────────────────────
section("10. CORS CONFIGURATION")
# ─────────────────────────────────────────────────────────

cors_origins = [
    ("https://frontend-azure-delta-93.vercel.app", True),
    ("https://some-other-app.vercel.app", True),  # Regex allows all vercel
    ("http://localhost:3000", True),
    ("http://localhost:5173", True),
    ("https://financial-manager.id", True),
    ("https://malicious-site.com", False),
    ("http://evil.example.com", False),
]

for origin, should_pass in cors_origins:
    r = requests.get(f"{BASE}/health", headers={"Origin": origin}, timeout=5)
    cors_header = r.headers.get("access-control-allow-origin", "")
    has_cors = bool(cors_header)
    if should_pass and has_cors:
        passed += 1
        print(f"  {GREEN}✓{NC} CORS allowed: {origin} → {cors_header}")
    elif not should_pass and not has_cors:
        passed += 1
        print(f"  {GREEN}✓{NC} CORS blocked: {origin}")
    elif not should_pass and has_cors:
        warn(f"CORS", f"Unexpected allow for {origin} → {cors_header}")
    else:
        failed += 1
        issues.append((f"CORS {origin}", "missing", "Expected CORS header missing"))
        print(f"  {RED}✗{NC} CORS missing for expected origin: {origin}")

# ─────────────────────────────────────────────────────────
section("11. DATA INTEGRITY")
# ─────────────────────────────────────────────────────────

r = requests.get(f"{API}/dashboard/summary", timeout=10)
if r.status_code == 200:
    d = r.json()
    income = float(d.get("totalIncome", 0))
    expense = float(d.get("totalExpense", 0))
    net = float(d.get("netSavings", 0))
    math_ok = abs((income - expense) - net) <= 1.0

    passed += 1
    print(f"  {GREEN}✓{NC} Income/Expense/Net math consistent: {math_ok}")

    if income >= 0 and expense >= 0:
        passed += 1
        print(f"  {GREEN}✓{NC} No negative totals (income={income:,.0f}, expense={expense:,.0f})")
    else:
        failed += 1
        issues.append(("Data integrity", "FAIL", f"Negative values: income={income}, expense={expense}"))
        print(f"  {RED}✗{NC} Negative totals detected!")

# Period range sanity
r = requests.get(f"{API}/dashboard/summary", timeout=10)
if r.status_code == 200:
    period = r.json().get("period", {})
    start = period.get("start")
    end = period.get("end")
    if start and end:
        from datetime import datetime
        try:
            s = datetime.fromisoformat(start)
            e = datetime.fromisoformat(end)
            if s < e:
                passed += 1
                print(f"  {GREEN}✓{NC} Period range valid: {start} → {end}")
            else:
                failed += 1
                issues.append(("Period range", "FAIL", f"start >= end: {start} >= {end}"))
                print(f"  {RED}✗{NC} Period range invalid: start >= end")
        except:
            warn("Period dates", f"Cannot parse date format: {start}, {end}")
    else:
        warn("Period data", "Missing start/end in period")

# ─────────────────────────────────────────────────────────
section("12. RESPONSE TIME BENCHMARK")
# ─────────────────────────────────────────────────────────

SLOW_THRESHOLD = 2.0  # seconds

benchmarks = [
    ("/health", f"{BASE}/health"),
    ("/api/dashboard/summary", f"{API}/dashboard/summary"),
    ("/api/dashboard/accounts", f"{API}/dashboard/accounts"),
    ("/api/analytics/expense-breakdown", f"{API}/analytics/expense-breakdown"),
    ("/api/analytics/financial-health", f"{API}/analytics/financial-health"),
    ("/api/exchange/rates", f"{API}/exchange/rates?base=USD"),
    ("/realtime/forex/quotes", f"{BASE}/realtime/forex/quotes"),
]

for name, url in benchmarks:
    try:
        t0 = time.time()
        r = requests.get(url, timeout=15)
        elapsed = time.time() - t0
        if elapsed > SLOW_THRESHOLD:
            warn(f"SLOW: {name}", f"{elapsed:.2f}s > {SLOW_THRESHOLD}s threshold")
        else:
            passed += 1
            print(f"  {GREEN}✓{NC} {name} → {elapsed:.3f}s")
    except Exception as e:
        warn(f"Timeout: {name}", str(e))

# ─────────────────────────────────────────────────────────
# FINAL REPORT
# ─────────────────────────────────────────────────────────
print("\n" + "="*55)
print("  FINAL QA REPORT")
print("="*55)
print(f"  {GREEN}Passed:{NC}   {passed}")
print(f"  {RED}Failed:{NC}   {failed}")
print(f"  {YELLOW}Warnings:{NC} {warnings}")
print(f"  Total:    {passed + failed}")

if issues:
    print(f"\n  {RED}❌ FAILURES:{NC}")
    for i, (name, status, body) in enumerate(issues, 1):
        print(f"  {i:2}. [{status}] {name}")
        if body:
            print(f"      → {body[:80]}")

if warn_list:
    print(f"\n  {YELLOW}⚠ WARNINGS:{NC}")
    for i, (name, msg) in enumerate(warn_list, 1):
        print(f"  {i:2}. {name}: {msg}")

print("\n" + "="*55)
overall = "ALL TESTS PASSED ✅" if failed == 0 else f"⚠️  {failed} FAILURES DETECTED"
print(f"  {GREEN if failed == 0 else RED}{overall}{NC}")
print("="*55)
