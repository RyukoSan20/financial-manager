# Financial Manager - System Architecture Documentation

## 1. SYSTEM OVERVIEW

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FINANCIAL MANAGER APP                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐   │
│  │   FRONTEND      │      │    BACKEND      │      │   EXTERNAL      │   │
│  │   (React/Vite)  │◄────►│  (FastAPI)       │◄────►│   SERVICES      │   │
│  │   Vercel        │      │   Railway       │      │                 │   │
│  └─────────────────┘      └─────────────────┘      └─────────────────┘   │
│           │                        │                        │              │
│           │                        │                        │              │
│           ▼                        ▼                        ▼              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      SUPABASE POSTGRESQL                              │   │
│  │                   (Database + Authentication)                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 2. DEPLOYMENT ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DEPLOYMENT FLOW                                │
└─────────────────────────────────────────────────────────────────────────────┘

  ┌──────────────┐         ┌──────────────┐         ┌──────────────────────┐
  │   LOCAL      │         │   GITHUB    │         │   PRODUCTION         │
  │   DEV       │────►    │   MAIN      │────►    │                      │
  └──────────────┘         └──────────────┘         └──────────────────────┘
                                                            │
                         ┌─────────────────────────────────┬┴───────────────┐
                         │                                 │                │
                         ▼                                 ▼                ▼
                   ┌──────────────┐                 ┌──────────────┐  ┌───────────┐
                   │   FRONTEND  │                 │   BACKEND   │  │  SUPABASE │
                   │   Vercel    │                 │   Railway   │  │  Database │
                   └──────────────┘                 └──────────────┘  └───────────┘
                         │                                 │                │
                         ▼                                 ▼                ▼
              https://frontend-*.vercel.app    https://fin-manager-*.railway.app
                                                                             
URLs:
  - Frontend: https://frontend-wheat-two-86.vercel.app (PRODUCTION)
  - Backend:  https://fin-manager-production.up.railway.app (PRODUCTION)
  - Supabase: https://slrtkzgnwaovzvkjmfwz.supabase.co
```

## 3. FRONTEND ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND STRUCTURE                                │
└─────────────────────────────────────────────────────────────────────────────┘

frontend/
├── public/                      # Static assets
│   ├── icons/                  # PWA icons (72-512px)
│   ├── manifest.json            # PWA manifest
│   └── robots.txt
│
├── src/
│   │
│   ├── main.jsx                # Entry point
│   ├── App.jsx                 # Root component + routing
│   │
│   ├── components/
│   │   │
│   │   ├── common/             # Shared components
│   │   │   ├── AIAssistant.jsx       # AI Chat assistant (NEW: execute actions)
│   │   │   ├── ProtectedRoute.jsx    # Auth guard
│   │   │   └── CurrencyInput.jsx
│   │   │
│   │   ├── layout/             # Layout components
│   │   │   ├── Layout.jsx           # Main layout wrapper
│   │   │   └── Navigation.jsx       # Sidebar navigation
│   │   │
│   │   ├── dashboard/          # Dashboard widgets
│   │   ├── transactions/       # Transaction components
│   │   ├── accounts/          # Account management
│   │   ├── budgets/           # Budget tracking
│   │   ├── goals/             # Savings goals
│   │   ├── debts/             # Debt tracking
│   │   ├── calculators/       # Financial calculators
│   │   ├── parser/            # Text/Receipt parser
│   │   │   ├── TextParserModal.jsx
│   │   │   ├── ReceiptScannerModal.jsx
│   │   │   └── QRScannerModal.jsx
│   │   ├── notifications/     # Push notifications
│   │   └── ui/                # Base UI components
│   │       ├── Button.jsx
│   │       ├── Modal.jsx
│   │       ├── Card.jsx
│   │       ├── Badge.jsx
│   │       └── Spinner.jsx
│   │
│   ├── pages/                 # Route pages
│   │   ├── Login.jsx          # Login (Google OAuth + Email)
│   │   ├── Register.jsx       # Registration
│   │   ├── Dashboard.jsx      # Main dashboard
│   │   ├── Transactions.jsx    # Transaction list
│   │   ├── Accounts.jsx       # Account management
│   │   ├── Budgets.jsx        # Budget page
│   │   ├── Goals.jsx          # Goals page
│   │   ├── Debts.jsx         # Debts page
│   │   ├── Recurring.jsx     # Recurring transactions
│   │   ├── Feed.jsx          # Activity feed
│   │   ├── Settings.jsx       # User settings
│   │   ├── AuthCallback.jsx   # OAuth callback handler
│   │   └── Calculator.jsx     # Calculator hub
│   │
│   ├── services/
│   │   └── api.js             # API client (centralized)
│   │       ├── API_BASE_URL = 'https://fin-manager-production.up.railway.app/api'
│   │       ├── Token management (localStorage)
│   │       └── All API endpoints
│   │
│   ├── context/              # React contexts
│   │   ├── AuthContext.jsx    # Authentication state
│   │   ├── ThemeContext.jsx  # Dark/light mode
│   │   └── NotificationContext.jsx
│   │
│   ├── hooks/                # Custom hooks
│   │   └── useApi.js
│   │
│   ├── lib/
│   │   └── supabase.js       # Supabase client
│   │
│   ├── utils/
│   │   ├── format.js         # Currency/date formatting
│   │   └── i18n.js           # Internationalization
│   │
│   └── i18n/
│       ├── id.js             # Indonesian translations
│       └── ja.js             # Japanese translations
│
├── vercel.json               # Vercel config (rewrites, headers)
└── vite.config.js            # Vite build config
```

## 4. BACKEND ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BACKEND STRUCTURE                                 │
└─────────────────────────────────────────────────────────────────────────────┘

backend/
├── main.py                    # FastAPI app entry point
│
├── app/
│   │
│   ├── api/
│   │   └── routes/           # API endpoints
│   │       ├── auth.py             # /api/auth/* - Authentication
│   │       ├── transactions.py     # /api/transactions/* - CRUD transactions
│   │       ├── accounts.py         # /api/accounts/* - Bank accounts
│   │       ├── categories.py       # /api/categories/* - Transaction categories
│   │       ├── budgets.py          # /api/budgets/* - Budget management
│   │       ├── goals.py            # /api/goals/* - Savings goals
│   │       ├── debts.py            # /api/debts/* - Debt tracking
│   │       ├── dashboard.py        # /api/dashboard/* - Dashboard data
│   │       ├── feed.py             # /api/feed/* - Activity feed
│   │       ├── recurring.py        # /api/recurring/* - Recurring transactions
│   │       ├── ai_advisor.py       # /api/ai/* - AI advisor + EXECUTE
│   │       ├── calculators.py      # /api/calculators/* - Financial calculators
│   │       ├── transfers.py        # /api/transfers/* - Account transfers
│   │       ├── parser.py           # /api/parser/* - Text receipt parser
│   │       ├── scan_jobs.py        # /api/scan-jobs/* - OCR scan jobs
│   │       ├── market.py           # /api/market/* - Market data
│   │       ├── finnhub.py          # /api/finnhub/* - Stock prices
│   │       ├── realtime_market.py  # /api/realtime/* - Real-time market
│   │       └── exchange.py         # /api/exchange/* - Currency exchange
│   │
│   ├── core/
│   │   ├── config.py          # Environment config
│   │   ├── database.py        # PostgreSQL connection
│   │   ├── security.py        # JWT token handling
│   │   ├── tenancy.py         # Multi-tenant isolation
│   │   └── storage.py         # File storage (receipts)
│   │
│   ├── models/               # SQLAlchemy ORM models
│   │   ├── user.py           # User model
│   │   ├── account.py        # Bank account model
│   │   ├── transaction.py    # Transaction model
│   │   ├── category.py       # Category model
│   │   ├── budget.py         # Budget model
│   │   ├── goal.py           # Savings goal model
│   │   ├── debt.py           # Debt model
│   │   ├── recurring.py      # Recurring transaction model
│   │   ├── transfer.py       # Transfer model
│   │   ├── receipt.py        # Receipt model
│   │   ├── scan_job.py      # OCR scan job model
│   │   └── activity_log.py  # Activity log model
│   │
│   ├── schemas/             # Pydantic request/response models
│   │   ├── user.py
│   │   ├── account.py
│   │   ├── transaction.py
│   │   ├── dashboard.py
│   │   └── ...
│   │
│   ├── services/            # Business logic
│   │   └── ai_advisor_service.py  # AI advisor logic
│   │
│   └── middleware/
│       └── logging.py       # Request logging
│
├── railway.json             # Railway deployment config
└── requirements.txt         # Python dependencies
```

## 5. DATA MODELS

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            DATABASE SCHEMA                                  │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐
│      USER       │
├─────────────────┤
│ id (PK)         │
│ email           │
│ name            │
│ supabase_id     │
│ preferences     │
│ created_at      │
└────────┬────────┘
         │ 1:N
         ▼
┌─────────────────┐       ┌─────────────────┐
│    ACCOUNT      │       │   CATEGORY      │
├─────────────────┤       ├─────────────────┤
│ id (PK)         │       │ id (PK)         │
│ user_id (FK)    │       │ user_id (FK)    │
│ name            │       │ name            │
│ type            │       │ type (inc/exp)  │
│ balance         │       │ icon            │
│ currency        │       │ color           │
│ is_active       │       │ is_active       │
└────────┬────────┘       └─────────────────┘
         │                        │
         │ 1:N                    │ 1:N
         ▼                        ▼
┌─────────────────┐       ┌─────────────────┐
│   TRANSACTION   │       │    BUDGET       │
├─────────────────┤       ├─────────────────┤
│ id (PK)         │       │ id (PK)         │
│ user_id (FK)    │       │ user_id (FK)    │
│ account_id (FK) │       │ category_id(FK) │
│ category_id(FK) │       │ amount          │
│ type (inc/exp)  │       │ period          │
│ amount          │       │ start_date      │
│ description     │       │ end_date        │
│ date            │       └─────────────────┘
│ is_recurring    │
└────────┬────────┘
         │
         │ 1:N
         ▼
┌─────────────────┐
│  ACTIVITY_LOG   │
├─────────────────┤
│ id (PK)         │
│ user_id (FK)    │
│ action          │
│ entity_type     │
│ entity_id       │
│ details         │
│ created_at      │
└─────────────────┘

Related Models:
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│      GOAL       │  │      DEBT       │  │    RECURRING    │
├─────────────────┤  ├─────────────────┤  ├─────────────────┤
│ id (PK)         │  │ id (PK)         │  │ id (PK)         │
│ user_id (FK)    │  │ user_id (FK)    │  │ user_id (FK)    │
│ name            │  │ creditor        │  │ account_id (FK) │
│ target_amount   │  │ amount          │  │ category_id(FK) │
│ current_amount  │  │ interest_rate   │  │ type            │
│ deadline        │  │ due_date        │  │ amount          │
│ status          │  │ remaining       │  │ frequency       │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

## 6. AUTHENTICATION FLOW

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      GOOGLE OAUTH FLOW                                       │
└─────────────────────────────────────────────────────────────────────────────┘

  ┌─────────┐         ┌─────────────┐         ┌─────────────┐
  │  USER   │         │  FRONTEND   │         │  SUPABASE   │
  └────┬────┘         └──────┬──────┘         └──────┬──────┘
       │                     │                      │
       │  1. Click Google    │                      │
       │  Login              │                      │
       ├────────────────────►│                      │
       │                     │                      │
       │                     │  2. Redirect to      │
       │                     │  Supabase OAuth      │
       │                     ├────────────────────►│
       │                     │                      │
       │                     │  3. User grants     │
       │                     │  permission         │
       │                     │◄────────────────────┤
       │                     │                      │
       │                     │  4. Redirect with    │
       │                     │  access_token to    │
       │                     │  /auth/callback     │
       │                     │◄────────────────────┤
       │                     │                      │
       │                     │  5. POST /api/      │
       │                     │  supabase-exchange  │
       │                     ├────────────────────►│
       │                     │                      │
       │                     │  6. Backend creates  │
       │                     │  user + JWT token    │
       │                     │◄────────────────────┤
       │                     │                      │
       │                     │  7. Store JWT in    │
       │                     │  localStorage       │
       │                     │                      │
       │  8. Redirect to     │                      │
       │  Dashboard          │                      │
       ├────────────────────►│                      │
       │                     │                      │
       ▼                     ▼                      ▼

Backend JWT = Backend auth token (used for all API calls)
Supabase Token = Supabase session (for Supabase services)
```

## 7. TRANSACTION FLOW

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      ADD TRANSACTION FLOW                                     │
└─────────────────────────────────────────────────────────────────────────────┘

  ┌─────────┐         ┌─────────────┐         ┌─────────────┐         ┌──────┐
  │  USER   │         │  FRONTEND   │         │   BACKEND   │         │  DB  │
  └────┬────┘         └──────┬──────┘         └──────┬──────┘         └──┬───┘
       │                     │                      │                   │
       │  1. Fill form /     │                      │                   │
       │  Text parser /     │                      │                   │
       │  AI Assistant      │                      │                   │
       ├────────────────────►│                      │                   │
       │                     │                      │                   │
       │                     │  2. POST /api/       │                   │
       │                     │  transactions/       │                   │
       │                     ├─────────────────────►│                   │
       │                     │                      │                   │
       │                     │                      │  3. Validate +    │
       │                     │                      │  Save to DB       │
       │                     │                      ├──────────────────►│
       │                     │                      │◄──────────────────┤
       │                     │                      │                   │
       │                     │  4. Return created    │                   │
       │                     │  transaction         │                   │
       │                     │◄─────────────────────┤                   │
       │                     │                      │                   │
       │  5. Show success    │                      │                   │
       │  Update UI          │                      │                   │
       ├────────────────────►│                      │                   │
       │                     │                      │                   │
       │  6. Log activity    │                      │                   │
       │                     │  POST /api/feed/    │                   │
       │                     │  activity           │                   │
       │                     ├─────────────────────►│                   │
       │                     │                      │                   │
       ▼                     ▼                      ▼                   ▼
```

## 8. AI ASSISTANT FLOW (NEW)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      AI ASSISTANT EXECUTE FLOW                              │
└─────────────────────────────────────────────────────────────────────────────┘

  ┌─────────┐         ┌─────────────┐         ┌─────────────┐         ┌──────┐
  │  USER   │         │  FRONTEND   │         │   BACKEND   │         │  DB  │
  └────┬────┘         └──────┬──────┘         └──────┬──────┘         └──┬───┘
       │                     │                      │                   │
       │  "tambah            │                      │                   │
       │  pengeluaran        │                      │                   │
       │  15000 makan        │                      │                   │
       │  indomie"           │                      │                   │
       ├────────────────────►│                      │                   │
       │                     │                      │                   │
       │                     │  POST /api/ai/       │                   │
       │                     │  execute             │                   │
       │                     ├─────────────────────►│                   │
       │                     │                      │                   │
       │                     │                      │  Parse message:   │
       │                     │                      │  - Type: expense  │
       │                     │                      │  - Amount: 15000  │
       │                     │                      │  - Desc: indomie  │
       │                     │                      │                   │
       │                     │                      │  Create           │
       │                     │                      │  Transaction      │
       │                     │                      ├──────────────────►│
       │                     │                      │                   │
       │                     │  Return:             │                   │
       │                     │  {success: true,    │                   │
       │                     │   action: "add",     │                   │
       │                     │   message: "..."}    │                   │
       │                     │◄─────────────────────┤                   │
       │                     │                      │                   │
       │  "Berhasil          │                      │                   │
       │  menambahkan..."    │                      │                   │
       ├────────────────────►│                      │                   │
       │                     │                      │                   │
       │                     │  Trigger refresh     │                   │
       │                     │  Dashboard data      │                   │
       │                     │                      │                   │
       ▼                     ▼                      ▼                   ▼
```

## 9. API ENDPOINTS SUMMARY

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           API ENDPOINTS                                      │
└─────────────────────────────────────────────────────────────────────────────┘

BASE URL: https://fin-manager-production.up.railway.app/api

AUTHENTICATION:
  POST   /auth/login                    # Email login
  POST   /auth/register                 # Email register
  POST   /auth/logout                   # Logout
  POST   /supabase-exchange             # Exchange Supabase token to JWT

ACCOUNTS:
  GET    /accounts/                     # List accounts
  POST   /accounts/                     # Create account
  GET    /accounts/:id                  # Get account
  PUT    /accounts/:id                  # Update account
  DELETE /accounts/:id                  # Delete account

TRANSACTIONS:
  GET    /transactions/                # List transactions (with filters)
  POST   /transactions/                # Create transaction
  GET    /transactions/:id             # Get transaction
  PUT    /transactions/:id             # Update transaction
  DELETE /transactions/:id             # Delete transaction

CATEGORIES:
  GET    /categories/                  # List categories
  POST   /categories/                  # Create category
  PUT    /categories/:id               # Update category
  DELETE /categories/:id               # Delete category

DASHBOARD:
  GET    /dashboard/summary            # Dashboard summary (balance, income, expense)
  GET    /dashboard/cash-flow           # Cash flow chart data
  GET    /dashboard/category-breakdown  # Category breakdown

BUDGETS:
  GET    /budgets/                     # List budgets
  POST   /budgets/                     # Create budget
  PUT    /budgets/:id                  # Update budget
  DELETE /budgets/:id                  # Delete budget

GOALS:
  GET    /goals/                       # List goals
  POST   /goals/                       # Create goal
  PUT    /goals/:id                    # Update goal (add savings)
  DELETE /goals/:id                    # Delete goal

DEBTS:
  GET    /debts                        # List debts
  POST   /debts                        # Create debt
  PUT    /debts/:id                   # Update debt (make payment)
  DELETE /debts/:id                   # Delete debt

AI ADVISOR:
  GET    /ai/advice                    # Get AI advice
  GET    /ai/summary                   # Get financial summary
  POST   /ai/chat                      # Chat with AI
  POST   /ai/execute                   # Execute action (NEW: add transaction)

RECURRING:
  GET    /recurring                    # List recurring
  POST   /recurring                    # Create recurring
  PUT    /recurring/:id               # Update recurring
  DELETE /recurring/:id               # Delete recurring

CALCULATORS:
  POST   /calculators/discount         # Discount calculator
  POST   /calculators/tip              # Tip calculator
  POST   /calculators/loan-payment    # Loan payment calculator
  POST   /calculators/compound-interest # Compound interest
  POST   /calculators/budget-allocation # Budget allocation

FEED:
  GET    /feed/stats                   # Activity statistics
  GET    /feed/activity               # Activity log

PARSER:
  POST   /parser/text                  # Parse natural language transaction
  POST   /scan-jobs/upload            # Upload receipt for OCR
  GET    /scan-jobs/:id              # Get scan result

MARKET (External):
  GET    /market/quote                # Stock quote
  GET    /exchange/                   # Currency exchange rates
```

## 10. FEATURE LIST

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          FEATURES IMPLEMENTED                               │
└─────────────────────────────────────────────────────────────────────────────┘

CORE FEATURES:
  ✅ Multi-account management (bank accounts, e-wallets)
  ✅ Transaction tracking (income/expense)
  ✅ Category management
  ✅ Dashboard with balance overview
  ✅ Cash flow chart (monthly)
  ✅ Budget tracking
  ✅ Savings goals
  ✅ Debt tracking
  ✅ Recurring transactions
  ✅ Activity feed

AI FEATURES:
  ✅ AI Chat assistant (advice)
  ✅ AI Execute actions (NEW: add transactions from natural language)

INPUT METHODS:
  ✅ Manual entry
  ✅ Text parser (natural language)
  ✅ Receipt scanner (OCR) - if enabled
  ✅ QR Scanner - if enabled

CALCULATORS:
  ✅ Discount calculator
  ✅ Tax calculator
  ✅ Tip calculator
  ✅ Split bill
  ✅ Loan payment
  ✅ Compound interest
  ✅ Budget allocation
  ✅ Affordability calculator

INTEGRATIONS:
  ✅ Google OAuth
  ✅ Multi-language (Indonesian, Japanese)
  ✅ Dark/Light mode
  ✅ Push notifications
  ✅ PWA support (icons)

EXTERNAL DATA:
  ✅ Currency exchange rates
  ✅ Market data (stocks) - if API configured
  ✅ Real-time market (crypto) - if API configured

MISSING/TO DO:
  ⬜ AI Assistant can execute more actions (delete, update)
  ⬜ Maps integration for location
  ⬜ Export/Import data
  ⬜ Reports (monthly/quarterly PDF)
  ⬜ Notifications for budget limits
  ⬜ Bank sync (Plaid integration)
```

## 11. CONFIGURATION

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ENVIRONMENT CONFIG                                  │
└─────────────────────────────────────────────────────────────────────────────┘

FRONTEND (.env):
  VITE_API_URL=https://fin-manager-production.up.railway.app
  VITE_SUPABASE_URL=https://slrtkzgnwaovzvkjmfwz.supabase.co
  VITE_SUPABASE_ANON_KEY=xxxxx

BACKEND (.env):
  DATABASE_URL=postgresql://user:pass@host:5432/db
  SUPABASE_URL=https://slrtkzgnwaovzvkjmfwz.supabase.co
  SUPABASE_ANON_KEY=xxxxx
  SECRET_KEY=xxxxx
  ALGORITHM=HS256
  ACCESS_TOKEN_EXPIRE_MINUTES=60

VERCEL (vercel.json):
  - SPA fallback: /((?!assets/).*) → /index.html
  - API proxy: /api/* → Railway backend
  - Cache headers for static assets

RAILWAY:
  - Python 3.12
  - Health check: /health
  - Start command: uvicorn main:app
```
