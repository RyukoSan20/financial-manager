# S1 to S25

The workbook `analisis_ui.xlsx` does not contain a sheet called
`Saran Prioritas` with S1 to S25 in column A, so the list could not be
read from it. The list below is the one from the task brief (section 6),
and it is the authority for this work.

`new-feature-request/qa/analisis_ui.xlsx` has these sheets instead:
`Ringkasan`, `Prioritas Fitur`, `Rencana 2 Hari`, `Ditunda`,
`Breakdown Monveo`, `Catatan Sumber`. `Prioritas Fitur` holds seven
numbered items about an app called Monveo, which is not this app and
has no screenshots here. It was not mapped onto S1 to S25, because
guessing which of seven unrelated items meant which of twenty-five
would have invented work rather than recovered it.

## The list

| ID | Item |
|----|------|
| S1 | single source of truth for balance, score, transaction counts |
| S2 | health sub-scores on empty data |
| S3 | AI Advisor minimum-data threshold and disclaimers |
| S4 | default accent not red |
| S5 | one PageHeader pattern |
| S6 | Indonesian UI strings and consistent terms |
| S7 | date/rupiah format utilities and chart axis |
| S8 | non-ASCII text bugs |
| S9 | sidebar grouping |
| S10 | Merchant behind advanced-features flag |
| S11 | onboarding |
| S12 | "this month" timeline |
| S13 | Gmail Sync states |
| S14 | chart single-slice/empty state |
| S15 | sidebar profile card |
| S16 | Delete All Data safeguards |
| S17 | initial balance and negative balance warning |
| S18 | one icon family |
| S19 | friendly streak |
| S20 | input flow |
| S21 | single add button |
| S22 | Indonesia-relevant calculators |
| S23 | accessibility audit |
| S24 | mobile review |
| S25 | opt-in reminders |

## Where each one is handled

| Batch | IDs | State |
|-------|-----|-------|
| A1 | S1, S2, S3, S7, S8, S14, S17 | done |
| A2 | S4, S5, S15, S18 | done |
| A3 | S6, S22 | not started |
| A4 | S13, S16 | not started |
| A5 | S9, S10, S11, S12, S21, S25 | not started |
| A6 | S20 | not started |
| A7 | rows from the reconciled matrix | not started |
| — | S19, S23, S24 | no batch assigned; S23 and S24 are audits, S19 needs a definition of what a streak counts |

## What the code already has

Some of these were written from a partial look at the application, and
the code disagrees. These were checked directly, not taken from the
workbook:

- **S2** already done. `backend/app/api/routes/analytics.py` marks
  each part of the health score with `measurable`, and the response
  carries `has_enough_data` and `measured_parts`.
- **S3** already done. `backend/app/services/ai_advisor_service.py`
  has `MIN_TRANSACTIONS = 3` and a "data belum cukup" path.
- **S4** already correct. The default accent is `emerald`, not red.
- **S8** already clean. No Cyrillic anywhere in `frontend/src` or
  `backend/app`.
- **S16** already half done on the client. `Settings.jsx` asks for a
  confirmation word before deleting. The server side has no such check.
- **S22** already largely done. Seven calculator tabs exist, including
  tax (PPN) and loan (cicilan).
- **S17** partly done. Negative balances are stored, but nothing warns
  the reader about one, and there is no opening-balance question.

## A2: what was done

**S4, default accent not red.** Already correct. The default scheme
is `emerald`, in `frontend/src/utils/appearance.js` and in the backend
default. `rose` exists as a colour a user may choose; it is not the
default. No change needed, and none was made.

**S5, one PageHeader pattern.** New `frontend/src/components/ui/PageHeader.jsx`.
Adopted on Budgets, Goals and Debts. The header each of those pages
wrote is kept as the fallback, so with the switch off the pages are
byte-for-byte what they were. Other pages still have their own
headers; they were left alone to keep the change small.

**S15, sidebar profile card.** `frontend/src/components/layout/UserProfileSection.jsx`.
Two chip rows used `flex` without `flex-wrap`, so on a narrow sidebar
the chips were clipped instead of wrapping. Both rows now wrap, and
each chip holds its own line rather than being squeezed. The date also
used its own formatting; it now uses the shared `formatTanggal`. This
is a FIX: it is on by default, because the card was visibly broken.
The change also removed a crash: `identity.member_since` was read
without a check, and `identity` is not always present.

**S18, one icon family.** New `frontend/src/utils/icons.js` and
`frontend/src/components/ui/IconText.jsx`. The emoji were replaced
with the icon family the application already uses, on nine screens:
Dashboard, Shopping, ShoppingTracker, HealthCoach, MerchantMap,
MarketPage, Catalog, AddTransactionPage, AIAdvisor and Gmail Sync.
The emoji are still there when the switch is off.

### The switches

`frontend/src/utils/featureFlags.js` holds the switches. Each one is
off unless the build turns it on, so nothing changes for a reader
until a switch is deliberately turned on.

| Switch | How it is turned on | What it does |
|--------|--------------------|--------------|
| `UI_POLISH` | `VITE_UI_POLISH=1` at build time | The polish layer: the shared header, the icon family, the `data-ui="polish"` stylesheet |

The polish layer is `frontend/src/styles/polish.css`. Every rule in it
is written to apply only when the root element carries
`data-ui="polish"`, and that attribute is set only when the switch is
on. With the switch off, the rules match nothing.

### How this was checked

- The switch logic: `frontend/src/utils/__tests__/featureFlags.test.js`,
  20 assertions. A switch nobody has touched is off; a broken stored
  value is treated as off rather than as a crash.
- The build was run four ways and the environment object read out of
  the bundle each time: no `VITE_UI_POLISH` gives off, `"1"` gives on,
  `"0"` gives off.
- Every fallback in the pages was kept verbatim, so the switch-off
  page is the page that was there before.
