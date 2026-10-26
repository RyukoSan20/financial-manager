# Metrics

Every number the application shows about a person's money is defined
here once. If two pages disagree, one of them is not using this
document.

The rule underneath all of it: **a figure is either fully converted or
it is left out and listed separately.** A total that mixes converted
and unconverted money is worse than no total, because the reader
cannot tell which part of it is real.

The single implementation of these definitions is
`backend/app/services/metrics.py`. The frontend has its own
counterparts in `frontend/src/utils/idFormat.js` and
`frontend/src/utils/currency.js`, which read the same rules.

---

## 1. Total balance

**Definition.** The sum of the balances of every *active* account,
converted into the display currency.

- Only accounts with `is_active = true` count.
- An account holds the currency it was opened in. Balances in different
  currencies are converted at the live rate before they are added.
- A balance that cannot be converted is **left out of the total** and
  listed under `unconverted` with the reason. It is never added at its
  face value.
- `display_currency` decides the currency of the result. It comes from
  the reader's saved preference, and it is independent of the
  interface language.

**Where it is computed**

| Place | Note |
|---|---|
| `backend/app/services/metrics.py` → `total_balance()` | The definition. Used by new code. |
| `backend/app/services/currency_totals.py` → `total_in_currency()` | The conversion helper underneath it. |
| `backend/app/api/routes/accounts.py` → `GET /api/accounts/summary/total-balance` | Uses the helper. Returns `total`, `by_currency`, `unconverted`. |
| `backend/app/api/routes/dashboard.py` → `GET /api/dashboard/summary` | Uses the helper. Returns `total_balance`, `balance_by_currency`. |
| `backend/app/api/routes/profile.py` → `GET /api/profile/summary` | Uses the helper. Returns `account_balance`, `account_balance_currency`. |
| `backend/app/modules/ai_advisor/health_coach/router.py` | Uses the helper. Returns `total_cash`, `cash_by_currency`. |
| `backend/app/api/routes/analytics.py` | `GET /api/analytics/financial-health` and the net-worth endpoints. |

**Frontend readers**

| Place | Note |
|---|---|
| `frontend/src/pages/Accounts.jsx` | `summary.total_balance` + `summary.currency`. |
| `frontend/src/pages/Dashboard.jsx` | `summary.total_balance` + `summary.total_balance_currency`. |
| `frontend/src/pages/Analytics.jsx` | `health.metrics.total_balance`. |
| `frontend/src/components/layout/UserProfileSection.jsx` | `stats.account_balance` + `stats.account_balance_currency`. |
| `frontend/src/pages/HealthCoach.jsx` | `total_cash` + `currency`. |

**A number is wrong if** two pages show different totals for the same
accounts in the same display currency. The cross-page test in
`backend/tests/test_metrics_consistency.py` checks this.

---

## 2. Savings rate

**Definition.** `(income - expense) / income` over the current calendar
month, where income and expense are the sums of **approved**,
non-deleted transactions in that month.

- Only `status` in `('approved', None, '')` counts. `pending` and
  `rejected` transactions do not.
- A `pending` transaction must not move a balance, and must not move
  this rate.
- When there is no income in the month, the rate is **not measurable**.
  It is not 0. A 0% savings rate is a statement; "no income recorded"
  is a different statement.

**Where it is computed**

| Place | Note |
|---|---|
| `backend/app/services/metrics.py` → `savings_rate()` | The definition. |
| `backend/app/api/routes/analytics.py` → `GET /api/analytics/financial-health` | Drives the `savings_rate` sub-score. |
| `backend/app/services/ai_advisor_service.py` → `get_financial_summary()` | Feeds the AI Advisor. |
| `backend/app/api/routes/dashboard.py` → `GET /api/dashboard/summary` | `savings_rate` for the dashboard card. |

---

## 3. Emergency months

**Definition.** `total_balance / (monthly_expense / 30)`, rounded to one
decimal place. It answers "how many months of normal spending does the
cash on hand cover?"

- When there is no spending in the month, there is no burn rate, so
  there are no emergency months. The figure is **not measurable**.
- The balance used is the total balance above, so it is already in the
  display currency.

**Where it is computed**

| Place | Note |
|---|---|
| `backend/app/modules/ai_advisor/health_coach/financial_ratios.py` | `emergency_months`. |
| `backend/app/api/routes/analytics.py` → `GET /api/analytics/financial-health` | `emergency_target = monthly_expense * 6`. |

---

## 4. Debt ratio

**Definition.** `total_debt / monthly_income`, where `total_debt` is
the sum of `current_balance` over debts that are active and not paid
off, and `monthly_income` is the same income as the savings rate.

- A debt of zero gives a ratio of 0, which is the best possible
  score. It is not "not measurable" — there is a fact to report.
- When there is no income in the month, the ratio cannot be expressed
  as a proportion of income, so it is **not measurable**.

**Where it is computed**

| Place | Note |
|---|---|
| `backend/app/api/routes/analytics.py` → `GET /api/analytics/financial-health` | Drives the `debt_level` sub-score. |
| `backend/app/modules/ai_advisor/health_coach/financial_ratios.py` | `debt_service_ratio` (DSR). |

---

## 5. Health score

**Definition.** Four parts, each worth 25 points:

| Part | Full points when |
|---|---|
| `savings_rate` | Savings rate is 20% or more. |
| `emergency_fund` | Total balance covers 6 months of spending. |
| `debt_level` | Total debt is zero, or at most 36% of monthly income. |
| `goals_progress` | Every active goal is on track for its target date. |

**The rule that matters:** a part that cannot be measured is left out
of **both** the sum and the maximum. It neither adds to the score nor
holds it down.

- `savings_rate` and `debt_level` need income in the month.
- `emergency_fund` needs spending in the month. With no spending there
  is no target to measure against, and giving the full 25 points would
  show a perfect score for an empty month.
- `goals_progress` needs at least one active goal. No goals is not the
  same as being on track with every goal.

The result is `int(total_score / measured_max * 100)`.

`has_enough_data` is true only when at least two parts could be
measured. With one part the score is a guess, and the card says so
rather than presenting a number as a verdict.

**Where it is computed**

| Place | Note |
|---|---|
| `backend/app/api/routes/analytics.py` → `GET /api/analytics/financial-health` | The score, the `breakdown`, `has_enough_data`, `measured_parts`, `measured_max`. |
| `backend/app/modules/ai_advisor/health_coach/router.py` | A separate health read, used by the Health Coach page. It shares the same definitions but has its own presentation. |

---

## 6. Transaction count

**Definition.** The number of transactions belonging to the reader that
have not been soft-deleted (`is_deleted = false`).

- The count is of **all** transactions, not of the current month, and
  not of approved ones only. It answers "how much has this reader
  recorded", which is what the readiness checklist needs.
- A `pending` transaction is still a recorded transaction.

**Where it is computed**

| Place | Note |
|---|---|
| `backend/app/api/routes/profile.py` → `GET /api/profile/summary` | `stats.transaction_count`. |
| `backend/app/services/ai_advisor_service.py` → `get_financial_summary()` | `transaction_count`, used for the AI Advisor data threshold. |
| `backend/app/services/readiness.py` → `build_readiness()` | The transactions step of the setup checklist. |

---

## 7. Spending and income for a period

**Definition.** The sum of `Transaction.amount` over approved,
non-deleted transactions of the given type, in the given date range.

- The type is `income` or `expense`. Both are positive numbers; the
  sign comes from the type, not from the amount.
- Transactions in different currencies are **not** added together
  without conversion. The endpoints that report a period total either
  report it in a single currency or break it down by currency.

**Where it is computed**

| Place | Note |
|---|---|
| `backend/app/api/routes/analytics.py` | Period summaries, category breakdowns, the health score. |
| `backend/app/api/routes/dashboard.py` | Monthly income, expense, cash flow series. |
| `backend/app/api/routes/budgets.py` | Spent-against-budget per category. |

---

## 8. Days active and streak

**Definition.** `days_active` is the number of distinct days in the
last 30 that have at least one transaction. `current_streak` is the
number of consecutive days, counting back from today, that each have at
one transaction.

- A day with no transaction ends the streak. Today not having a
  transaction yet does not break yesterday's streak, so the walk
  starts from today and steps back one day at a time.

**Where it is computed**

| Place | Note |
|---|---|
| `backend/app/api/routes/profile.py` → `GET /api/profile/summary` | `stats.active_days`, `stats.current_streak`. |

---

## 9. Rules that hold everywhere

1. **Approved only.** A `pending` transaction changes no balance, no
   budget figure, no report, and no rate. Only `approved` does.
2. **Currency is never mixed.** Different currencies are converted
   before they are added, or they are not added.
3. **Display currency is a choice, not a language.** Choosing Japanese
   does not change the currency. Choosing a currency does not change
   the language.
4. **No score without data.** A metric that cannot be measured is
   reported as not measurable, not as zero.
5. **One definition per metric.** If a second place needs the same
   number, it calls the shared service rather than repeating the
   calculation.


## What was wrong, and what changed

This section records the defects found while writing this document, so
that the next person does not have to find them again.

### The balance was added up raw in eleven places

An account holds the currency it was opened in. A reader with a rupiah
account and a yen account cannot have their two balances added
together face to face, because the result is a number in no currency
at all.

The total was worked out in five different files, and three of them
added the raw numbers. The places that were wrong:

| Place | What it did |
|---|---|
| `backend/app/api/routes/analytics.py` | The net worth endpoints and the financial health endpoint. |
| `backend/app/api/routes/profile.py` | The balance in the profile header. |
| `backend/app/modules/ai_advisor/router.py` | The context the AI Advisor reads out to the reader. |
| `backend/app/modules/ai_advisor/llm_orchestrator/client.py` | The balance the orchestrator hands to the model. |
| `backend/app/services/ai_agent_executor.py` | The balance the agent reports. |
| `backend/app/modules/ledger/analytics_service.py` | The net worth and the month summary. |

They now all go through `backend/app/services/metrics.py`.

### The profile counted closed accounts

The Dashboard, the Analytics page, the accounts list and the AI
Advisor left closed accounts out of the balance. The profile added
them in. The header and the page underneath it could show two
different numbers for the same reader.

### Three calculations were wrong

`backend/app/services/calculation/formulas.py`. These had never been
run, because the test runner was not installed.

- `calculate_split_bill` raised a `TypeError` instead of reporting
  that a split between zero people is not possible.
- `calculate_income_conversion` had its table the wrong way round.
  A monthly income became a twelfth of what it was instead of twelve
  times. Every row of the table was swapped.
- `calculate_required_saving_for_goal` returned a saving rate with
  cents in it. "44,444.44 a day" is not a figure anyone can act on.

### The tests were reading another checkout

`backend/tests/unit/test_calculations.py` loaded the formulas with an
absolute path into one particular checkout. A test run in a worktree
or a second clone therefore tested the other checkout, and a fix that
had never been written looked like a fix that worked.

It now works the path out from the file's own location, and
`backend/tests/conftest.py` puts this checkout's backend at the front
of the path for every test.
