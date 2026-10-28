# How this application is put together

Everything below was read out of the code on
`chore/baseline-remediation` (commit `e078ec4`), not from memory.

## The shape of it

```
                    the browser
  ┌──────────────────────────────────────────────────────────────┐
  │                                                              │
  │   App.jsx ──── <Routes> ──── one page per path                │
  │      │                                                       │
  │      ├── AuthContext        who is signed in                  │
  │      ├── ThemeContext       theme + accent (saved)            │
  │      ├── NotificationContext                                    │
  │      │                                                       │
  │      └── pages/*.jsx  ──►  components/**/*.jsx                │
  │                │                                              │
  │                ▼                                              │
  │        services/api.js   ← the one door to the backend       │
  │                │                                              │
  │        utils/*.js         idFormat, amountInput, icons, flags │
  │        i18n/index.jsx     id / en / ja + t()                  │
  └────────────────┼─────────────────────────────────────────────┘
                   │  fetch()  +  Authorization: Bearer <jwt>
                   ▼
  ┌──────────────────────────────────────────────────────────────┐
  │                    the backend (FastAPI)                     │
  │                                                              │
  │   main.py ── 45 include_router calls                         │
  │      │                                                       │
  │      ├── api/routes/*.py      44 route files                 │
  │      ├── modules/*            29 files (ai_advisor, gmail…)  │
  │      ├── services/*.py        69 service files               │
  │      ├── models/*.py          23 SQLAlchemy models           │
  │      ├── schemas/*.py         15 Pydantic schemas            │
  │      └── core/*.py            16 files (security, db, kms)   │
  │                                                              │
  │   middleware/logging.py  →  every request is logged          │
  └────────────────┼─────────────────────────────────────────────┘
                   │  SQLAlchemy
                   ▼
              PostgreSQL
```

## The counts

| Where | How many |
|---|---|
| Backend route files | 44 |
| Backend service files | 69 |
| Backend models | 23 |
| Backend schemas | 15 |
| Backend core files | 16 |
| Backend module files | 29 |
| Frontend pages | 33 |
| Frontend components | 48 |
| Frontend utils | 13 |
| Frontend i18n files | 11 |
| Frontend contexts | 3 |
| Frontend stylesheets | 4 (+ `index.css`, 53 kB) |
| Frontend test files | 10 |
| Backend test files | 15 |

Frontend components by folder: `ui` 17, `parser` 7, `common` 7,
`layout` 5, `merchant` 3, `settings` 2, `notifications` 2,
`dashboard` 2, `insights` 1, `calculators` 1, plus `ReadinessChecklist`.

## The functional variables

These are the pieces of state that run through the whole app.

| Variable | Lives in | What it holds | Saved where |
|---|---|---|---|
| `user` | `AuthContext` | the signed-in person | `localStorage` (`token`, `user`), or `sb_token` / `sb_user` for Supabase |
| `loading` | `AuthContext` | auth is still being checked | not saved |
| `theme` | `ThemeContext` | light / dark / system, resolved to the one painted now | `localStorage`, synced to the server |
| `appearance.color_scheme` | `ThemeContext` | the accent colour | server, in the settings blob |
| `preferences` blob | server, `user_settings` | layout, widgets, period | server, synced across devices |
| `featureFlags` | `featureFlags.js` | the reader switches | `localStorage`, one key |
| `VITE_UI_POLISH` | the build | the build switch | the build itself |
| `API_BASE_URL` | `services/api.js` | where the backend is | the build, via `VITE_API_URL` |

### How a preference travels

`hooks/useSyncedPreference.js` is the mechanism, and it is worth
reading in full because it is the one place where the "never alter a
saved preference" rule is actually enforced:

1. The value is written to `localStorage` **immediately**, so the page
   never waits for the network.
2. After 700 ms of quiet, it is pushed to the server, and only if it
   differs from what the server has.
3. Every 60 seconds, and on window focus, it is pulled from the server.
4. The server copy wins **unless** the local copy is dirty — that is,
   unless the user changed it and the save has not gone through yet.
5. On `beforeunload` a pending save is flushed, so it is not lost.

That step 4 is the interesting one: it is what stops a slow save from
overwriting a change the reader has just made.

## The i18n mechanism

`i18n/index.jsx` holds the three locale tables (id / en / ja) and the
`t()` lookup. The lookup falls back to English, and then to a
humanised last segment of the key, so a missing key reads as a
sentence rather than as `some.missing.key`.

Batch files — `keys_batch1.js` … `keys_batch7.js` — are **separate
modules** imported by the component that uses them. They are not
merged into the locale tables. That is the existing pattern, and per
D7 any new text goes through it rather than into a second strings
system.

## The backend

### Every request

```
request
  → middleware/logging.py          logged
  → route handler
      → core/security.py           get_current_user: reads the Bearer
                                   token, loads the user
      → models/*.py                SQLAlchemy row
      → services/*.py              the actual work
      → schemas/*.py               the response shape
  → PostgreSQL
```

### The routers, in the order `main.py` registers them

`auth` · `accounts` · `categories` · `transactions` · `transfers` ·
`budgets` · `recurring` · `goals` · `breakdown` · `catalog` · `debts` ·
`analytics` · `dashboard` · `calculators` · `indonesia_calculators` ·
`data` · `parser` · `voice` · `profile` · `learning` · `scans` ·
`ai_advisor` · `feed` · `shopping` · `kanban_board` · `exchange` ·
`currency` · `reminders` · `insights` · `unified_market` · `market` ·
`finnhub` · `ninjas` · `market_intel` · `zap_ink` · `realtime_market` ·
`logs` · `merchant` · `location` · `webhooks` · `analytics` (module) ·
`ai_advisor` (module) · `error` · `gmail` · `health_coach` ·
`location` (module) · `shopping` (module) · `category_hints` ·
`user_settings` · `search`

`scan_jobs` is registered but **commented out** — OCR is disabled.

## The frontend routes

```
/login  /register  /auth/callback        (public)

/                    → Dashboard
/dashboard           → Dashboard
/transactions        → Transactions
/category-expenses   → CategoryExpenses
/accounts            → Accounts
/budgets             → Budgets
/goals               → Goals
/debts               → Debts
/recurring           → Recurring
/calculators         → Calculators
/analytics           → Analytics
/merchant            → MerchantManager      (behind AdvancedPage)
/map                 → MerchantMap          (behind AdvancedPage)
/advisor             → AIAdvisor
/health-coach        → HealthCoach
/shopping            → ShoppingTracker
/shopping/board      → ShoppingBoard
/gmail               → GmailIntegration
/gmail/callback      → GmailCallback
/feed                → FeedPage
/kanban              → ShoppingPage
/market              → MarketPage
/settings            → Settings
/settings/profile    → ProfileSettings
/settings/notifications → NotificationSettings
/settings/app        → AppSettings
/settings/appearance → Appearance
/profile/summary     → ProfileSummary
/catalog             → CatalogPage
/help                → HelpSupport
/more                → MorePage
*                    → redirect to /login
```

## The parts worth reading first

| File | Why |
|---|---|
| `frontend/src/services/api.js` | The one door to the backend. Holds the token, the retry rule (GET only, 429/503), the 401 handling, the payload sanitiser. |
| `backend/app/services/metrics.py` | The one definition of each money metric. Written in A1 so five pages stopped each working it out differently. |
| `backend/app/services/insight_service.py` | The four read-only detectors (A7). |
| `backend/app/services/calculation/indonesia.py` | The Indonesian rules — PPh 21 with the DJP tables, PPN, THR, BPJS, UMK. |
| `frontend/src/utils/featureFlags.js` | The switches, and the rule that an off switch means the old markup exactly. |
| `frontend/src/hooks/useSyncedPreference.js` | How a setting follows the reader between devices without losing a change in flight. |
| `frontend/src/i18n/index.jsx` | The lookup, and the fallback that keeps a missing key readable. |
| `backend/app/core/security.py` | `get_current_user`, the gate on almost every route. |
| `backend/app/core/kms_encryption.py` | The AES-256-GCM module that Q3 will use for the Gmail tokens. |

## Where each batch landed

| Batch | Where it lives |
|---|---|
| A1 metrics | `backend/app/services/metrics.py`, `docs/metrics.md` |
| A2 visual | `utils/featureFlags.js`, `utils/icons.js`, `components/ui/PageHeader.jsx`, `styles/polish.css` |
| A3 language | `i18n/keys_batch4.js`, `keys_batch5.js`, `backend/app/services/calculation/indonesia.py`, `components/calculators/IndonesiaCalculators.jsx` |
| A4 Gmail | `modules/integrations/email_parser/gmail_service.py`, `gmail_router.py` |
| A5 nav/reminders | `components/layout/navGroups.js`, `GroupedNav.jsx`, `backend/app/services/reminder_service.py`, `components/dashboard/MonthTimeline.jsx`, `Onboarding.jsx` |
| A6 transfers | `backend/app/api/routes/transfers.py`, `frontend/src/utils/amountInput.js` |
| A7 insights | `backend/app/services/insight_service.py`, `backend/app/api/routes/insights.py`, `components/insights/InsightsPanel.jsx` |
| A7 privacy | `frontend/src/data/privacyManifest.js`, `pages/Settings/PrivacyPage.jsx` |

## Known gaps in this map

- The privacy manifest is mid-refactor in the working tree, so
  `data/privacyManifest.js` and its test do not agree with each other
  at the moment. The last commit is green.
- The A6 transfer-sign work is uncommitted, so `utils/transactionSign.js`
  is on disk but not in history.
- `main.py` registers 45 routers, and some prefixes are registered
  twice (`analytics`, `ai_advisor`, `location`, `shopping`, `market`).
  The first registration wins, so the second is shadowed. Not fixed —
  it is a finding, not a task.
