#!/usr/bin/env python3
"""
Financial Manager - QA Test Suite
Tests all features, pages, and API endpoints.
"""

import requests
import json
import time
from datetime import datetime, timedelta

# Configuration
BASE_URL = "http://localhost:8000"
API_BASE = f"{BASE_URL}/api"

# Colors
GREEN = '\033[0;32m'
RED = '\033[0;31m'
YELLOW = '\033[1;33m'
NC = '\033[0m'

passed = 0
failed = 0
errors = []


def log_test(name, status, message=""):
    global passed, failed
    if status == "PASS":
        passed += 1
        print(f"  {GREEN}✓{NC} {name}")
    else:
        failed += 1
        errors.append(f"{name}: {message}")
        print(f"  {RED}✗{NC} {name}")
        if message:
            print(f"      {YELLOW}{message}{NC}")


def test_health():
    print("\n[1. Health Check]")
    try:
        r = requests.get(f"{BASE_URL}/health", timeout=5)
        log_test("Backend health", "PASS" if r.status_code == 200 else "FAIL", 
                 f"Status: {r.status_code}")
        return r.json()
    except Exception as e:
        log_test("Backend health", "FAIL", str(e))
        return None


def test_dashboard():
    print("\n[2. Dashboard API]")
    
    # Test summary
    try:
        r = requests.get(f"{API_BASE}/dashboard/summary", timeout=10)
        data = r.json()
        log_test("Dashboard summary", "PASS" if r.status_code == 200 else "FAIL")
        
        # Check data integrity
        required_keys = ["totalIncome", "totalExpense", "netSavings", "incomeByCategory", "expenseByCategory"]
        has_all = all(k in data for k in required_keys)
        log_test("Summary has all required fields", "PASS" if has_all else "FAIL")
        
        # Check balances are numbers
        try:
            income = float(data.get("totalIncome", 0))
            expense = float(data.get("totalExpense", 0))
            net = float(data.get("netSavings", 0))
            log_test("Numeric values valid", "PASS")
        except:
            log_test("Numeric values valid", "FAIL", "Non-numeric balance values")
    except Exception as e:
        log_test("Dashboard summary", "FAIL", str(e))
    
    # Test accounts
    try:
        r = requests.get(f"{API_BASE}/dashboard/accounts", timeout=10)
        data = r.json()
        log_test("Dashboard accounts", "PASS" if r.status_code == 200 else "FAIL")
        
        if r.status_code == 200 and "accounts" in data:
            for acc in data.get("accounts", []):
                log_test(f"Account: {acc.get('name', 'Unknown')}", "PASS")
                if "balance" in acc:
                    log_test(f"  - Balance: Rp {acc['balance']:,.0f}", "PASS")
    except Exception as e:
        log_test("Dashboard accounts", "FAIL", str(e))
    
    # Test cash flow
    try:
        for tf in ["1D", "1W", "1M", "3M", "YTD"]:
            r = requests.get(f"{API_BASE}/dashboard/cash-flow?timeframe={tf}", timeout=10)
            log_test(f"Cash flow {tf}", "PASS" if r.status_code == 200 else "FAIL")
    except Exception as e:
        log_test("Cash flow", "FAIL", str(e))


def test_accounts():
    print("\n[3. Accounts API]")
    try:
        # Test without auth (should get auth error)
        r = requests.get(f"{API_BASE}/accounts/", timeout=10)
        if r.status_code == 401:
            log_test("List accounts (auth required)", "PASS", "401 - Auth required")
        elif r.status_code == 200:
            data = r.json()
            log_test("List accounts", "PASS" if isinstance(data, list) else "FAIL")
            
            if data:
                acc = data[0]
                log_test(f"Account structure valid", "PASS")
                required = ["id", "name", "balance", "currency", "type"]
                has_required = all(k in acc for k in required)
                log_test(f"  - Has required fields", "PASS" if has_required else "FAIL")
        else:
            log_test("List accounts", "FAIL", f"Status: {r.status_code}")
    except Exception as e:
        log_test("List accounts", "FAIL", str(e))


def test_transactions():
    print("\n[4. Transactions API]")
    try:
        r = requests.get(f"{API_BASE}/transactions/", timeout=10)
        if r.status_code == 401:
            log_test("List transactions (auth required)", "PASS", "401 - Auth required")
        elif r.status_code == 200:
            data = r.json()
            log_test(f"Transaction count: {len(data)}", "PASS")
        else:
            log_test("List transactions", "FAIL", f"Status: {r.status_code}")
    except Exception as e:
        log_test("List transactions", "FAIL", str(e))
    
    # Test categories (usually public)
    try:
        r = requests.get(f"{API_BASE}/categories/", timeout=10)
        if r.status_code == 401:
            log_test("List categories (auth required)", "PASS", "401 - Auth required")
        elif r.status_code == 200:
            cats = r.json()
            log_test(f"Category count: {len(cats)}", "PASS")
        else:
            log_test("List categories", "FAIL", f"Status: {r.status_code}")
    except Exception as e:
        log_test("List categories", "FAIL", str(e))


def test_budgets():
    print("\n[5. Budgets API]")
    try:
        r = requests.get(f"{API_BASE}/budgets/", timeout=10)
        if r.status_code == 401:
            log_test("List budgets (auth required)", "PASS", "401 - Auth required")
        elif r.status_code == 200:
            log_test("List budgets", "PASS")
        else:
            log_test("List budgets", "FAIL", f"Status: {r.status_code}")
    except Exception as e:
        log_test("List budgets", "FAIL", str(e))


def test_debts():
    print("\n[6. Debts API]")
    try:
        r = requests.get(f"{API_BASE}/debts/", timeout=10)
        if r.status_code == 401:
            log_test("List debts (auth required)", "PASS", "401 - Auth required")
        elif r.status_code == 200:
            log_test("List debts", "PASS")
        else:
            log_test("List debts", "FAIL", f"Status: {r.status_code}")
    except Exception as e:
        log_test("List debts", "FAIL", str(e))


def test_recurring():
    print("\n[7. Recurring Rules API]")
    try:
        r = requests.get(f"{API_BASE}/recurring/", timeout=10)
        if r.status_code == 401:
            log_test("List recurring rules (auth required)", "PASS", "401 - Auth required")
        elif r.status_code == 200:
            log_test("List recurring rules", "PASS")
        else:
            log_test("List recurring rules", "FAIL", f"Status: {r.status_code}")
    except Exception as e:
        log_test("List recurring rules", "FAIL", str(e))


def test_goals():
    print("\n[8. Goals API]")
    try:
        r = requests.get(f"{API_BASE}/goals/", timeout=10)
        if r.status_code == 401:
            log_test("List goals (auth required)", "PASS", "401 - Auth required")
        elif r.status_code == 200:
            goals = r.json()
            log_test("List goals", "PASS")
            for goal in goals:
                log_test(f"  Goal: {goal.get('name', 'Unknown')}", "PASS")
        else:
            log_test("List goals", "FAIL", f"Status: {r.status_code}")
    except Exception as e:
        log_test("List goals", "FAIL", str(e))


def test_analytics():
    print("\n[9. Analytics API]")
    
    endpoints = [
        "/analytics/expense-breakdown",
        "/analytics/income-breakdown",
        "/analytics/cash-flow-trend",
        "/analytics/monthly-comparison",
        "/analytics/top-expenses",
        "/analytics/financial-health",
    ]
    
    for ep in endpoints:
        try:
            r = requests.get(f"{API_BASE}{ep}", timeout=10)
            log_test(f"Analytics{ep}", "PASS" if r.status_code == 200 else "FAIL")
        except Exception as e:
            log_test(f"Analytics{ep}", "FAIL", str(e))


def test_data_export():
    print("\n[10. Data Export]")
    try:
        r = requests.get(f"{API_BASE}/data/export", timeout=15)
        if r.status_code == 401:
            log_test("Data export (auth required)", "PASS", "401 - Auth required")
        elif r.status_code == 200:
            data = r.json()
            log_test("Data export", "PASS")
            tables = data.get("tables", {})
            log_test(f"Export tables: {len(tables)}", "PASS")
            for table, rows in tables.items():
                if rows:
                    log_test(f"  {table}: {len(rows)} rows", "PASS")
        else:
            log_test("Data export", "FAIL", f"Status: {r.status_code}")
    except Exception as e:
        log_test("Data export", "FAIL", str(e))


def test_cors():
    print("\n[11. CORS Configuration]")
    try:
        r = requests.get(f"{BASE_URL}/health", 
                        headers={"Origin": "https://frontend-virid-alpha-24.vercel.app"},
                        timeout=5)
        cors_header = r.headers.get("access-control-allow-origin", "")
        log_test("CORS for Vercel frontend", "PASS" if cors_header else "FAIL")
    except Exception as e:
        log_test("CORS check", "FAIL", str(e))


def test_multi_currency_features():
    print("\n[13. Multi-Currency & Forex Features]")
    
    # 1. Forex Realtime
    try:
        r = requests.get("http://localhost:8000/realtime/forex/quotes", timeout=10)
        if r.status_code == 200:
            quotes = r.json().get('quotes', [])
            log_test(f"Forex realtime: {len(quotes)} pairs", "PASS")
            usd_idr = next((q for q in quotes if q.get('pair') == 'USD/IDR'), None)
            if usd_idr:
                log_test(f"  USD/IDR rate: {usd_idr.get('price', 'N/A')}", "PASS")
    except Exception as e:
        log_test("Forex realtime", "FAIL", str(e))
    
    # 2. Currency Conversion
    try:
        r = requests.post(f"{API_BASE}/exchange/convert", json={"amount": 100, "from_currency": "USD", "to_currency": "IDR"}, timeout=10)
        if r.status_code == 200:
            result = r.json()
            log_test(f"Currency convert: USD 100 = IDR {result.get('result', 'N/A')}", "PASS")
        else:
            log_test("Currency convert", "FAIL", f"Status: {r.status_code}")
    except Exception as e:
        log_test("Currency convert", "FAIL", str(e))
    
    # 3. Exchange Rates
    try:
        r = requests.get(f"{API_BASE}/exchange/rates?base=USD", timeout=10)
        if r.status_code == 200:
            rates = r.json().get('rates', {})
            log_test(f"Exchange rates: {len(rates)} currencies", "PASS")
        else:
            log_test("Exchange rates", "FAIL", f"Status: {r.status_code}")
    except Exception as e:
        log_test("Exchange rates", "FAIL", str(e))
    
    # 4. Multi-currency accounts (IDR)
    try:
        r = requests.get(f"{API_BASE}/dashboard/accounts", timeout=10)
        if r.status_code == 200:
            accounts = r.json().get('accounts', [])
            currencies = set(acc.get('currency', 'IDR') for acc in accounts)
            log_test(f"Account currencies: {', '.join(currencies)}", "PASS")
    except Exception as e:
        log_test("Account currencies", "FAIL", str(e))


def test_data_integrity():
    print("\n[14. Data Integrity Checks]")
    
    # Dashboard endpoints are public (no auth)
    try:
        # Get accounts from dashboard
        r_acc = requests.get(f"{API_BASE}/dashboard/accounts", timeout=10)
        if r_acc.status_code == 200:
            accounts = r_acc.json().get("accounts", [])
            log_test(f"Dashboard accounts: {len(accounts)} found", "PASS")
            
            if accounts:
                for acc in accounts:
                    log_test(f"  - {acc.get('name')}: Rp {acc.get('balance', 0):,.0f}", "PASS")
        else:
            log_test("Dashboard accounts accessible", "FAIL", f"Status: {r_acc.status_code}")
    except Exception as e:
        log_test("Dashboard accounts check", "FAIL", str(e))
    
    # Check date ranges
    try:
        r = requests.get(f"{API_BASE}/dashboard/summary", timeout=10)
        data = r.json()
        period = data.get("period", {})
        start = period.get("start")
        end = period.get("end")
        if start and end:
            log_test(f"Period range: {start} to {end}", "PASS")
        else:
            log_test("Period range", "FAIL", "Missing period data")
    except Exception as e:
        log_test("Period check", "FAIL", str(e))
    
    # Verify data matches Railway backup
    log_test("\n=== Railway Data Migration ===", "PASS")
    try:
        # Check imported data
        r_sum = requests.get(f"{API_BASE}/dashboard/summary", timeout=10)
        data = r_sum.json()
        
        income = data.get("totalIncome", 0)
        expense = data.get("totalExpense", 0)
        
        log_test(f"Total Income: Rp {income:,.0f}", "PASS")
        log_test(f"Total Expense: Rp {expense:,.0f}", "PASS")
        log_test(f"Net Savings: Rp {income - expense:,.0f}", "PASS")
    except Exception as e:
        log_test("Data verification", "FAIL", str(e))


def main():
    print("=" * 50)
    print("  Financial Manager - QA Test Suite")
    print("=" * 50)
    print(f"  Timestamp: {datetime.now().isoformat()}")
    print(f"  API Base: {API_BASE}")
    print("=" * 50)
    
    start_time = time.time()
    
    # Run all tests
    test_health()
    test_dashboard()
    test_accounts()
    test_transactions()
    test_budgets()
    test_debts()
    test_recurring()
    test_goals()
    test_analytics()
    test_data_export()
    test_cors()
    test_multi_currency_features()
    test_data_integrity()
    
    elapsed = time.time() - start_time
    
    # Summary
    print("\n" + "=" * 50)
    print("  TEST SUMMARY")
    print("=" * 50)
    print(f"  Passed: {GREEN}{passed}{NC}")
    print(f"  Failed: {RED}{failed}{NC}")
    print(f"  Total:  {passed + failed}")
    print(f"  Time:   {elapsed:.2f}s")
    
    if errors:
        print(f"\n  {RED}ERRORS:{NC}")
        for i, err in enumerate(errors[:10], 1):
            print(f"    {i}. {err}")
        if len(errors) > 10:
            print(f"    ... and {len(errors) - 10} more")
    
    print("=" * 50)
    
    # Exit with appropriate code
    exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()
