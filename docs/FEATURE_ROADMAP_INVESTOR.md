# FINANCIAL MANAGER - INVESTOR PRESENTATION ROADMAP
## "Smart Financial Advisor" - Dari Kalkulator ke AI-Powered Wealth Management

**Version**: 3.0.0 (Vision)
**Target Audience**: Investors
**Last Updated**: October 2026

---

# EXECUTIVE SUMMARY

## Problem Statement
- 65% masyarakat Indonesia tidak punya literasi keuangan yang baik
- Tidak ada tools yang terintegrasi dengan ekosistem keuangan Indonesia (Bank, GoPay, OVO, Shopee, dll)
- Aplikasi keuangan yang ada hanya "catatan" tanpa kemampuan "advice"
- AI financial advisor yang ada (Mint, YNAB) tidak cocok untuk konteks Indonesia

## Solution
**FinManager** = Integration Hub + Smart Calculator + AI Financial Advisor

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FINMANAGER ECOSYSTEM                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│   │  BANK   │  │ GOPAY/  │  │ SHOPEE  │  │  GMAIL  │  │ QRIS/   │        │
│   │  APIs   │  │  OVO    │  │  FOOD   │  │ INVOICE │  │ MERCHANT│        │
│   └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘        │
│        │            │            │            │            │                │
│        └────────────┴────────────┴─────┬──────┴────────────┘                │
│                                         │                                     │
│                                         ▼                                     │
│                              ┌─────────────────────┐                          │
│                              │   UNIFIED LEDGER    │                          │
│                              │   (Single Source    │                          │
│                              │    of Truth)        │                          │
│                              └──────────┬──────────┘                          │
│                                         │                                     │
│                                         ▼                                     │
│   ┌──────────────────────────────────────────────────────────────────────┐   │
│   │                      AI FINANCIAL ADVISOR                             │   │
│   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │   │
│   │  │  Spending   │  │   Budget    │  │  Investment │  │   Risk    │ │   │
│   │  │  Analysis   │  │  Advisor    │  │  Suggestions│  │  Assessment│ │   │
│   │  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘ │   │
│   └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│   ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│   │Dashboard│  │ Reports │  │ Goals   │  │ Alerts  │  │  Plans  │        │
│   └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Value Proposition
1. **Integration First**: Satu platform untuk semua sumber keuangan
2. **Contextual AI**: Advice berdasarkan situasi spesifik user (fresh graduate di Jakarta vs entrepreneur di Surabaya)
3. **Actionable Insights**: Bukan hanya "belanjakan terlalu banyak" tapi "cut 15% dari makan siang untuk mencapai target tabungan dalam 6 bulan"

---

# PHASE 1: FOUNDATION (MVP - Already Built)
## Core Features Summary

### 1.1 Account Management
**Function**: Multi-account financial tracking
- Bank accounts (savings, checking)
- E-wallets (GoPay, OVO, DANA, ShopeePay)
- Cash
- Investments (stocks, crypto - simplified)

**Variables**:
```python
Account {
    id: UUID
    user_id: UUID (FK)
    name: string (e.g., "BCA Savings", "GoPay Main")
    type: enum ['bank', 'ewallet', 'cash', 'investment', 'credit']
    balance: decimal(15,2)
    currency: string ['IDR', 'USD', 'SGD']
    institution: string (e.g., "Bank BCA", "PT Gojek Indonesia")
    account_number: string (masked, last 4 digits)
    is_active: boolean
    is_credit: boolean
    credit_limit: decimal(15,2) [nullable]
    icon: string (emoji or icon name)
    color: string (hex code)
    last_synced: datetime [nullable]
    created_at: datetime
    updated_at: datetime
}
```

**Input**:
```json
{
    "name": "BCA Savings",
    "type": "bank",
    "balance": 15000000,
    "institution": "Bank BCA",
    "account_number": "1234567890",
    "icon": "🏦",
    "color": "#1E3A8A"
}
```

**Output**:
```json
{
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "BCA Savings",
    "type": "bank",
    "balance": 15000000.00,
    "currency": "IDR",
    "institution": "Bank BCA",
    "account_number_masked": "****7890",
    "is_active": true,
    "last_synced": "2026-10-16T10:30:00Z"
}
```

### 1.2 Transaction Management
**Function**: Income/expense tracking with smart categorization

**Transaction Model**:
```python
Transaction {
    id: UUID
    user_id: UUID (FK)
    account_id: UUID (FK)
    category_id: UUID (FK, nullable)
    type: enum ['income', 'expense', 'transfer_out', 'transfer_in']
    amount: decimal(15,2)
    date: date
    description: string
    merchant_name: string [nullable]
    merchant_category: string [nullable] (MCC code)
    location: string [nullable]
    latitude: decimal(10,7) [nullable]
    longitude: decimal(10,7) [nullable]
    tags: array[string] [nullable]
    receipt_url: string [nullable]
    source: enum ['manual', 'bank_sync', 'ocr', 'qr_scan', 'api_import']
    source_id: string [nullable] (original transaction ID from bank/API)
    is_recurring: boolean
    recurring_rule_id: UUID (FK, nullable)
    transfer_id: UUID (FK, nullable)
    ai_category_suggestion: string [nullable]
    ai_confidence: float [nullable] (0.0 - 1.0)
    is_deleted: boolean (soft delete)
    created_at: datetime
    updated_at: datetime
}
```

**Key Endpoints**:
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/transactions/` | List with filters (date range, category, account, type) |
| POST | `/api/transactions/` | Create transaction |
| PUT | `/api/transactions/{id}` | Update transaction |
| DELETE | `/api/transactions/{id}` | Soft delete |
| POST | `/api/transactions/bulk` | Bulk import from CSV/Excel |
| GET | `/api/transactions/summary` | Aggregated summary |

**Filter Parameters**:
```python
# GET /api/transactions/
{
    "start_date": "2026-01-01",
    "end_date": "2026-10-16",
    "account_ids": ["uuid1", "uuid2"],
    "category_ids": ["uuid1", "uuid2"],
    "type": "expense",
    "min_amount": 10000,
    "max_amount": 1000000,
    "search": "makan siang",
    "tags": ["kantor", "rutinitas"],
    "source": "bank_sync",
    "page": 1,
    "limit": 50,
    "sort_by": "date",
    "sort_order": "desc"
}
```

### 1.3 Category System
**Function**: Flexible categorization with AI suggestions

**Category Model**:
```python
Category {
    id: UUID
    user_id: UUID (FK, nullable) # null = system default
    name: string (e.g., "Makanan & Minuman", "Transportasi")
    type: enum ['income', 'expense', 'transfer']
    icon: string (emoji)
    color: string (hex)
    parent_id: UUID (FK, self-reference, nullable) # for subcategories
    mcc_codes: array[string] [nullable] # mapped merchant codes
    keywords: array[string] [nullable] # for auto-categorization
    is_active: boolean
    sort_order: int
    created_at: datetime
}
```

**Default Categories**:
```python
EXPENSE_CATEGORIES = [
    {"name": "🍔 Makanan & Minuman", "keywords": ["makan", "lunch", "dinner", "food", "kopi", "coffee"]},
    {"name": "🚗 Transportasi", "keywords": ["grab", "gojek", "transport", "bensin", "parkir", "tol"]},
    {"name": "🛒 Belanja", "keywords": ["beli", "shop", "mart", "indomaret", "alfamart", "transmart"]},
    {"name": "🏠 Rumah & Utilitas", "keywords": ["listrik", "air", "internet", "wifi", "rent", "kontrak"]},
    {"name": "💊 Kesehatan", "keywords": ["apotek", "obat", "hospital", "clinic", "dokter"]},
    {"name": "🎬 Hiburan", "keywords": ["netflix", "spotify", "game", "bioskop", "nonton"]},
    {"name": "👔 Pakaian", "keywords": ["clothes", "fashion", "zalora", "shopee fashion"]},
    {"name": "📱 Pulsa & Data", "keywords": ["pulsa", "data", "telkomsel", "xl", "indosat"]},
    {"name": "🎁 Hadiah & Donasi", "keywords": ["gift", "hadiah", "donasi", "zakat"]},
    {"name": "📚 Pendidikan", "keywords": ["buku", "kursus", "course", "sekolah", "kuliah"]},
    {"name": "💰 Investasi", "keywords": ["invest", "saham", "reksadana", "crypto"]},
    {"name": "📦 Lainnya", "keywords": []}
]

INCOME_CATEGORIES = [
    {"name": "💼 Gaji", "keywords": ["gaji", "salary", "payroll", "honor"]},
    {"name": "💵 Freelance", "keywords": ["freelance", "project", "bonus"]},
    {"name": "📈 Investasi", "keywords": ["dividen", "capital gain", "return", "bunga"]},
    {"name": "🎁 Hadiah", "keywords": ["gift", "hadiah", "bonus", " THR"]},
    {"name": "💰 Lainnya", "keywords": []}
]
```

### 1.4 Budget Management
**Function**: Spending limits with progress tracking

**Budget Model**:
```python
Budget {
    id: UUID
    user_id: UUID (FK)
    name: string
    amount: decimal(15,2) # budget limit
    period: enum ['daily', 'weekly', 'monthly', 'quarterly', 'yearly']
    start_date: date
    end_date: date [nullable]
    category_id: UUID (FK, nullable) # null = overall budget
    account_id: UUID (FK, nullable) # null = all accounts
    rollover: boolean # carry over unused budget
    rollover_amount: decimal(15,2) [computed]
    alert_threshold: int (percentage, default 80)
    is_active: boolean
    created_at: datetime
}

BudgetProgress {
    budget_id: UUID (FK)
    period_start: date
    period_end: date
    total_budget: decimal(15,2)
    total_spent: decimal(15,2)
    remaining: decimal(15,2)
    percent_used: float
    daily_allowance: decimal(15,2)
    projected_spending: decimal(15,2)
    days_remaining: int
    is_over_budget: boolean
}
```

### 1.5 Goals & Savings
**Function**: Target-based savings with milestones

**Goal Model**:
```python
Goal {
    id: UUID
    user_id: UUID (FK)
    name: string
    description: string [nullable]
    goal_type: enum [
        'emergency_fund',
        'vacation',
        'vehicle',
        'house',
        'education',
        'investment',
        'wedding',
        'retirement',
        'business_capital',
        'custom'
    ]
    target_amount: decimal(15,2)
    current_amount: decimal(15,2)
    target_date: date
    priority: enum ['low', 'medium', 'high', 'critical']
    status: enum ['active', 'completed', 'paused', 'cancelled']
    icon: string
    color: string
    milestones: array[Milestone] [nullable]
    auto_contribution_enabled: boolean
    auto_contribution_account_id: UUID (FK, nullable)
    auto_contribution_amount: decimal(15,2) [nullable]
    auto_contribution_frequency: enum ['daily', 'weekly', 'monthly'] [nullable]
    created_at: datetime
    completed_at: datetime [nullable]
}

Milestone {
    name: string
    target_amount: decimal(15,2)
    target_date: date [nullable]
    is_completed: boolean
    completed_at: datetime [nullable]
}
```

**Logic - Goal Progress Calculation**:
```python
def calculate_goal_progress(goal: Goal) -> GoalProgress:
    # Progress percentage
    progress_pct = (goal.current_amount / goal.target_amount) * 100

    # On track calculation
    days_total = (goal.target_date - goal.created_at).days
    days_elapsed = (today - goal.created_at).days
    expected_progress = (days_elapsed / days_total) * goal.target_amount
    is_on_track = goal.current_amount >= expected_progress

    # Required saving rate
    remaining = goal.target_amount - goal.current_amount
    days_remaining = max(0, (goal.target_date - today).days)

    if days_remaining == 0:
        required_daily = remaining
        required_monthly = remaining
    else:
        required_daily = remaining / days_remaining
        required_monthly = (remaining / days_remaining) * 30

    # Projected completion
    if goal.current_amount > 0:
        daily_rate = goal.current_amount / max(1, days_elapsed)
        projected_completion = today + timedelta(days=remaining/daily_rate)
    else:
        projected_completion = None

    return GoalProgress(
        progress_pct=progress_pct,
        remaining=remaining,
        is_on_track=is_on_track,
        required_daily=required_daily,
        required_monthly=required_monthly,
        projected_completion=projected_completion,
        days_remaining=days_remaining
    )
```

### 1.6 Debt Management
**Function**: Track loans, credit cards, BNPL

**Debt Model**:
```python
Debt {
    id: UUID
    user_id: UUID (FK)
    name: string
    debt_type: enum [
        'credit_card',
        'personal_loan',
        'kta',
        'kpr',
        'kpm',
        'bnpl', # Buy Now Pay Later
        'medical',
        'education',
        'family',
        'other'
    ]
    creditor_name: string
    creditor_type: enum ['bank', 'nbfc', 'peer', 'family', 'other']
    principal: decimal(15,2) # original amount
    current_balance: decimal(15,2) # remaining amount
    interest_rate: decimal(5,2) # annual percentage
    interest_type: enum ['flat', 'reducing']
    tenor_months: int
    monthly_payment: decimal(15,2)
    start_date: date
    due_date: date
    next_payment_date: date
    next_payment_amount: decimal(15,2)
    remaining_months: int
    status: enum ['active', 'paid_off', 'restructured', 'defaulted']
    collateral: string [nullable]
    notes: string [nullable]
    created_at: datetime
}

DebtPayment {
    id: UUID
    debt_id: UUID (FK)
    amount: decimal(15,2)
    principal_portion: decimal(15,2)
    interest_portion: decimal(15,2)
    remaining_balance_after: decimal(15,2)
    payment_date: date
    payment_method: enum ['auto_debit', 'manual', 'transfer']
    receipt_url: string [nullable]
    notes: string [nullable]
    created_at: datetime
}
```

**Logic - Amortization Schedule**:
```python
def generate_amortization_schedule(debt: Debt) -> list[AmortizationEntry]:
    schedule = []
    balance = debt.principal
    monthly_rate = debt.interest_rate / 100 / 12

    for month in range(1, debt.tenor_months + 1):
        if debt.interest_type == 'flat':
            interest = debt.principal * monthly_rate
            principal = debt.monthly_payment - interest
        else:  # reducing balance
            interest = balance * monthly_rate
            principal = debt.monthly_payment - interest

        balance -= principal

        schedule.append(AmortizationEntry(
            month=month,
            payment=debt.monthly_payment,
            principal=principal,
            interest=interest,
            balance=max(0, balance)
        ))

    return schedule
```

### 1.7 Recurring Transactions
**Function**: Automate recurring entries

**RecurringRule Model**:
```python
RecurringRule {
    id: UUID
    user_id: UUID (FK)
    account_id: UUID (FK)
    category_id: UUID (FK, nullable)
    name: string
    type: enum ['income', 'expense']
    amount: decimal(15,2)
    frequency: enum ['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly']
    interval: int (every N frequency units)
    start_date: date
    end_date: date [nullable]
    next_occurrence: date
    occurrences_left: int [nullable]
    auto_generate: boolean # auto-create transaction
    auto_post: boolean # auto-post without confirmation
    reminder_days_before: int
    is_active: boolean
    last_generated: datetime [nullable]
    created_at: datetime
}
```

---

# PHASE 2: INTEGRATION HUB (Revenue Driver)

## Overview
Integrasi dengan ekosistem keuangan Indonesia untuk automatic transaction import. Ini adalah differentiator utama kami dibanding kompetitor.

## 2.1 Bank Integration API

### Supported Banks
| Bank | API Type | Data Available |
|------|----------|----------------|
| BCA | Open API | Account balance, transaction history |
| Mandiri | Liv by Mandiri | Account balance, transaction history |
| BRI | BRI API | Account balance, transaction history |
| BNI | BNIDirect | Account balance, transaction history |
| CIMB | CIMB Xplore | Account balance, transaction history |
| BTN | BTN Digital | Account balance, transaction history |
| Jago | Jago API | Full API access |
| Blu by BCA Digital | Blu API | Full API access |
| SeaBank | SeaBank API | Account balance, transaction history |
| Wise | Wise API | Multi-currency, international transfers |

### Integration Model
```python
BankConnection {
    id: UUID
    user_id: UUID (FK)
    bank_id: string (e.g., "BCA", "MANDIRI")
    bank_name: string
    account_id: UUID (FK)
    access_token: string (encrypted)
    refresh_token: string (encrypted)
    token_expires_at: datetime
    last_synced: datetime
    sync_status: enum ['success', 'failed', 'pending']
    sync_error: string [nullable]
    is_active: boolean
    created_at: datetime
    updated_at: datetime
}

BankSyncLog {
    id: UUID
    bank_connection_id: UUID (FK)
    sync_type: enum ['full', 'incremental']
    transactions_synced: int
    accounts_updated: int
    started_at: datetime
    completed_at: datetime [nullable]
    status: enum ['running', 'success', 'failed']
    error_message: string [nullable]
}
```

### API Design
```python
# Bank Connection Endpoints
POST   /api/v1/bank/connect          # Initiate bank connection (OAuth)
GET    /api/v1/bank/connections      # List user's bank connections
DELETE /api/v1/bank/connections/{id} # Disconnect bank
POST   /api/v1/bank/connections/{id}/sync  # Trigger manual sync
GET    /api/v1/bank/connections/{id}/status # Get sync status

# Bank Data Endpoints
GET    /api/v1/bank/accounts/{connection_id}  # Get linked accounts
GET    /api/v1/bank/transactions/{account_id} # Get transactions
POST   /api/v1/bank/transfer                  # Transfer between accounts
GET    /api/v1/bank/balance/{account_id}       # Get balance
```

### Input - Connect Bank
```json
// POST /api/v1/bank/connect
{
    "bank_id": "BCA",
    "redirect_uri": "finmanager://bank-callback",
    "permissions": ["read_balance", "read_transactions", "read_account_details"]
}
```

### Output - Sync Result
```json
{
    "sync_id": "uuid",
    "status": "completed",
    "transactions_synced": 47,
    "new_transactions": 12,
    "duplicate_skipped": 35,
    "duration_seconds": 3.2,
    "accounts": [
        {
            "account_id": "bca-account-123",
            "name": "BCA Savings 1234567890",
            "balance": 15000000,
            "new_transactions": 8
        }
    ]
}
```

## 2.2 E-Wallet Integration

### Supported E-Wallets
| Provider | Integration Method | Data |
|----------|-------------------|------|
| GoPay | Gojek Partner API | Transaction history, balance |
| OVO | OVO API | Transaction history, balance |
| DANA | DANA API | Transaction history, balance |
| ShopeePay | Shopee API | Transaction history, balance |
| LinkAja | LinkAja API | Transaction history, balance |
| iSaku | iSaku API | Transaction history |
| Flazz | Flazz API | Transaction history |
| Brizzi | Brizzi API | Transaction history |

### E-Wallet Model
```python
EWalletConnection {
    id: UUID
    user_id: UUID (FK)
    provider: enum ['gopay', 'ovo', 'dana', 'shopeepay', 'linkaja']
    account_phone: string (masked)
    balance: decimal(15,2)
    access_token: string (encrypted)
    refresh_token: string (encrypted)
    token_expires_at: datetime
    last_synced: datetime
    is_active: boolean
    created_at: datetime
}
```

## 2.3 Merchant Integration (Business Features)

### Supported Platforms
| Platform | Data Available | Use Case |
|----------|---------------|----------|
| Shopee | Sales, orders, expenses, fees | Business owner tracking |
| Tokopedia | Sales, orders, expenses, fees | Business owner tracking |
| GrabFood | Income, expenses, commissions | Driver tracking |
| GoFood | Income, expenses, commissions | Driver tracking |
| Gojek Business | Fleet management, income | Driver tracking |
| Maxim | Income, expenses | Driver tracking |

### Business Transaction Model
```python
MerchantTransaction {
    id: UUID
    user_id: UUID (FK)
    merchant_type: enum ['shopee', 'tokopedia', 'grabfood', 'gofood', 'gojek', 'maxim']
    transaction_id: string (platform's ID)
    type: enum ['sale', 'expense', 'commission', 'withdrawal', 'payout']
    amount: decimal(15,2)
    platform_fee: decimal(15,2) [nullable]
    net_amount: decimal(15,2) [nullable]
    currency: string
    description: string
    order_id: string [nullable]
    product_name: string [nullable]
    quantity: int [nullable]
    date: datetime
    status: enum ['completed', 'pending', 'cancelled', 'refunded']
    raw_data: jsonb (original API response)
    created_at: datetime
}
```

### Business Dashboard Output
```json
{
    "period": {"start": "2026-10-01", "end": "2026-10-16"},
    "platforms": {
        "shopee": {
            "total_sales": 45000000,
            "total_expenses": 8500000,
            "platform_fees": 2250000,
            "net_income": 34250000,
            "order_count": 127,
            "avg_order_value": 354330
        },
        "grabfood": {
            "total_income": 12500000,
            "total_expenses": 3500000,
            "net_income": 9000000,
            "trip_count": 245,
            "avg_trip_value": 51020
        }
    },
    "consolidated": {
        "total_gross": 57500000,
        "total_expenses": 12000000,
        "total_fees": 2250000,
        "net_income": 43250000
    }
}
```

## 2.4 Email Integration (Invoice Parsing)

### Supported Email Patterns
```python
EMAIL_PATTERNS = {
    "bank_statement": {
        "from": ["noreply@bca.co.id", "no-reply@bankmandiri.co.id"],
        "subject": ["Mutasi Rekening", "Bank Statement", "Rekening koran"],
        "parser": "parse_bank_email"
    },
    "ewallet_notification": {
        "from": ["noreply@gojek.com", "notify@ovo.id", "no-reply@shopee.co.id"],
        "subject": ["Pembayaran", "Transfer", "Top Up"],
        "parser": "parse_ewallet_email"
    },
    "online_purchase": {
        "from": ["order@tokopedia.com", "no-reply@shopee.co.id", "noreply@blibli.com"],
        "subject": ["Order Confirmation", "Invoice", "Pembelian"],
        "parser": "parse_purchase_email"
    },
    "subscription": {
        "from": ["netflix.com", "spotify.com", "disney.com"],
        "subject": ["Receipt", "Invoice", "Billing"],
        "parser": "parse_subscription_email"
    }
}
```

### Email Integration Model
```python
EmailIntegration {
    id: UUID
    user_id: UUID (FK)
    email_address: string
    provider: enum ['gmail', 'outlook', 'yahoo', 'imap']
    access_token: string (encrypted, OAuth2)
    refresh_token: string (encrypted)
    token_expires_at: datetime
    sync_enabled: boolean
    sync_frequency: enum ['realtime', 'hourly', 'daily']
    last_synced: datetime
    folders_to_monitor: array[string] ["INBOX", "Promotions"]
    is_active: boolean
    created_at: datetime
}

ParsedEmailTransaction {
    id: UUID
    email_integration_id: UUID (FK)
    message_id: string (Gmail's unique ID)
    subject: string
    from_address: string
    date: datetime
    parsed_amount: decimal(15,2) [nullable]
    parsed_description: string [nullable]
    parsed_merchant: string [nullable]
    parsed_date: date [nullable]
    confidence_score: float
    transaction_created: UUID (FK, nullable)
    raw_content: text
    created_at: datetime
}
```

### Input - Connect Gmail
```json
// POST /api/v1/email/connect
{
    "provider": "gmail",
    "redirect_uri": "finmanager://email-callback",
    "scopes": [
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/gmail.metadata"
    ]
}
```

### Output - Parsed Transaction
```json
{
    "email_id": "msg-12345",
    "subject": "Pembayaran GoPay ke TOKO NASI GORENG",
    "from": "noreply@gojek.com",
    "parsed": {
        "amount": 45000,
        "merchant": "TOKO NASI GORENG",
        "description": "Pembayaran QRIS",
        "date": "2026-10-16",
        "confidence": 0.95
    },
    "category_suggestion": "Makanan & Minuman",
    "action_needed": false,
    "created_transaction_id": "uuid" [nullable]
}
```

## 2.5 QRIS/Receipt Scanner

### QRIS Parser
```python
QRIS_DATA_PATTERNS = {
    "merchant_qris": {
        "prefix": "ID",
        "format": "ID{merchant_id}{outlet_id}{tax_id}*{amount}*{tip?}*{data?}*",
        "parser": "parse_merchant_qris"
    }
}

QRISTransaction {
    id: UUID
    user_id: UUID (FK)
    source: enum ['camera', 'gallery', 'manual_entry']
    qris_raw: string (original QR string)
    merchant_name: string [nullable]
    merchant_id: string [nullable]
    merchant_category: string [nullable] (MCC)
    amount: decimal(15,2)
    tip_amount: decimal(15,2) [nullable]
    currency: string
    transaction_date: datetime
    transaction_id: string [nullable]
    acquirer: string [nullable]
    issuer: string [nullable]
    is_income: boolean (merchant vs customer)
    linked_transaction_id: UUID (FK, nullable)
    created_at: datetime
}
```

### Receipt OCR Model
```python
ReceiptScan {
    id: UUID
    user_id: UUID (FK)
    image_url: string
    merchant_name: string [nullable]
    merchant_address: string [nullable]
    receipt_number: string [nullable]
    date: date [nullable]
    items: array[ReceiptItem] [nullable]
    subtotal: decimal(15,2) [nullable]
    tax: decimal(15,2) [nullable]
    service_charge: decimal(15,2) [nullable]
    tip: decimal(15,2) [nullable]
    total: decimal(15,2)
    payment_method: string [nullable]
    currency: string
    ocr_confidence: float
    ocr_raw_text: text
    linked_transaction_id: UUID (FK, nullable)
    status: enum ['pending', 'processing', 'completed', 'failed']
    created_at: datetime
}

ReceiptItem {
    name: string
    quantity: int
    unit_price: decimal(15,2)
    total_price: decimal(15,2)
    category_suggestion: string [nullable]
}
```

## 2.6 Integration Management API

### Central Integration Dashboard
```python
# GET /api/v1/integrations/
IntegrationStatus {
    integrations: [
        {
            "type": "bank",
            "provider": "BCA",
            "status": "connected",
            "last_sync": "2026-10-16T10:30:00Z",
            "accounts_linked": 2,
            "transactions_synced_today": 47
        },
        {
            "type": "ewallet",
            "provider": "GoPay",
            "status": "connected",
            "last_sync": "2026-10-16T10:25:00Z",
            "transactions_synced_today": 12
        },
        {
            "type": "email",
            "provider": "Gmail",
            "status": "connected",
            "last_sync": "2026-10-16T09:00:00Z",
            "emails_parsed_today": 23
        }
    ],
    "total_transactions_synced_today": 82,
    "last_overall_sync": "2026-10-16T10:30:00Z"
}
```

---

# PHASE 3: AI FINANCIAL ADVISOR (Core Differentiator)

## Overview
AI advisor yang tidak hanya menghitung, tapi memberikan advice kontekstual berdasarkan situasi hidup user.

## 3.1 User Profile & Context

### User Profile Model
```python
UserProfile {
    id: UUID
    user_id: UUID (FK, unique)
    # Demographics
    age: int
    gender: enum ['male', 'female', 'other']
    occupation: enum [
        'fresh_graduate',       # < 1 year work
        'employee',             # Full-time employee
        'freelancer',           # Self-employed, project-based
        'entrepreneur',         # Business owner
        'investor',             # Full-time investor
        'retired',              # Pensioner
        'student',              # Full-time student
        'homemaker',            # Housewife/househusband
        'job_seeker'            # Unemployed
    ]
    employment_status: enum ['fulltime', 'parttime', 'contract', 'probation', 'none']

    # Location & Cost of Living
    city: string
    city_tier: enum ['tier1', 'tier2', 'tier3', 'rural']
    # tier1: Jakarta, Surabaya, Bandung, Medan, Makassar
    # tier2: Semarang, Palembang, Depok, etc.
    # tier3: Other cities
    # rural: Villages

    living_situation: enum [
        'with_parents',         # No rent, minimal expenses
        'owned_house',          # Own property, mortgage paid
        'renting_alone',        # Single household
        'renting_with_family',  # Family household
        'kost',                 # Boarding house
        'kos_kongko'            # Shared kos
    ]

    # Family
    marital_status: enum ['single', 'married', 'divorced', 'widowed']
    children_count: int (default 0)
    children_ages: array[int] [nullable]
    dependents_count: int (default 0)

    # Financial
    monthly_income: decimal(15,2)
    income_type: enum ['fixed', 'variable', 'mixed', 'seasonal', 'irregular']
    income_currency: string
    has_multiple_income_streams: boolean

    # Goals
    primary_financial_goal: enum [
        'emergency_fund',
        'debt_free',
        'home_ownership',
        'investment_portfolio',
        'retirement',
        'business_startup',
        'education_upgrade',
        'travel',
        'marriage',
        'vehicle'
    ]
    target_retirement_age: int [nullable]
    risk_tolerance: enum ['conservative', 'moderate', 'aggressive']

    # Challenges (multi-select)
    financial_challenges: array[enum] [
        'income_too_low',
        'irregular_income',
        'too_much_debt',
        'no_savings_discipline',
        'impulse_spending',
        'family_pressure',
        'peer_pressure',
        'business_cash_flow',
        'tax_complexity',
        'investment_confusion'
    ]

    # Preferences
    preferred_language: enum ['id', 'en']
    notification_preferences: NotificationPrefs
    privacy_level: enum ['minimal', 'standard', 'full']

    # Timestamps
    created_at: datetime
    updated_at: datetime
    last_advice_session: datetime [nullable]
}

NotificationPrefs {
    budget_alerts: boolean
    unusual_spending_alert: boolean
    goal_progress_update: boolean
    weekly_summary: boolean
    monthly_report: boolean
    investment_opportunity: boolean
    bill_reminder: boolean
}
```

### User Situation Context (for AI)
```python
UserSituation {
    user_profile_id: UUID

    # Current Financial State
    total_assets: decimal(15,2)
    total_liabilities: decimal(15,2)
    net_worth: decimal(15,2)
    monthly_income: decimal(15,2)
    monthly_expenses: decimal(15,2)
    savings_rate: float (percentage)

    # Stability
    job_security: enum ['stable', 'somewhat_stable', 'unstable']
    income_volatility: float (0-1, how much income varies)
    expense_volatility: float (0-1)

    # Financial Health Score
    emergency_fund_months: int
    has_health_insurance: boolean
    has_life_insurance: boolean
    has_retirement_fund: boolean
    has_investments: boolean

    # Stress Indicators
    debt_to_income_ratio: float
    credit_utilization: float
    missed_payments_count: int (last 6 months)
    overdraft_count: int (last 6 months)

    # Computed Context
    cost_of_living_index: float (city-based)
    minimum_wage_comparison: float (income vs local minimum)
    lifestyle_creep_risk: float (expense growth vs income growth)

    # Goals Status
    active_goals: array[GoalSummary]
    goal_achievement_rate: float (historical)

    updated_at: datetime
}
```

## 3.2 AI Advisor Engine

### AI Advisor Service Architecture
```python
class FinancialAdvisorEngine:
    """
    Core AI advisor that provides contextual, actionable advice
    based on user's complete financial picture.
    """

    def __init__(self, user_id: UUID):
        self.user_id = user_id
        self.user_profile = self._load_profile()
        self.situation = self._compute_situation()
        self.transaction_history = self._load_transactions()
        self.goals = self._load_goals()

    def get_advice(
        self,
        query: str,
        advice_type: enum ['spending', 'budgeting', 'investing', 'debt', 'saving', 'general']
    ) -> Advice:
        """
        Main advice endpoint.
        Query can be free-text or structured.
        """

    def analyze_spending_pattern(self) -> SpendingAnalysis:
        """Analyze where money goes and identify optimization opportunities."""

    def generate_budget_recommendation(self) -> BudgetRecommendation:
        """Generate personalized budget based on income and goals."""

    def assess_investment_readiness(self) -> InvestmentReadiness:
        """Determine if user is ready for investments."""

    def create_debt_repayment_strategy(self) -> DebtStrategy:
        """Optimize debt payoff order (Avalanche vs Snowball)."""

    def project_financial_future(
        self,
        years: int,
        scenarios: array[Scenario]
    ) -> FinancialProjection:
        """Project net worth under different scenarios."""

    def answer_contextual_question(
        self,
        question: str
    ) -> ContextualAnswer:
        """Answer free-text questions about finances."""
```

### Advice Model
```python
Advice {
    id: UUID
    user_id: UUID (FK)
    advice_type: enum [
        'spending_optimization',
        'budget_recommendation',
        'investment_suggestion',
        'debt_strategy',
        'savings_plan',
        'emergency_prep',
        'insurance_review',
        'tax_planning',
        'goal_revision',
        'lifestyle_adjustment',
        'risk_alert',
        'opportunity_identified'
    ]
    priority: enum ['critical', 'high', 'medium', 'low']
    title: string
    summary: string (2-3 sentences)
    detailed_explanation: text
    actionable_steps: array[ActionableStep]
    expected_impact: ImpactEstimate
    related_data: jsonb
    confidence_score: float
    source_data_points: array[string] (what data was used)
    dismissible: boolean
    dismissed_at: datetime [nullable]
    created_at: datetime
    expires_at: datetime [nullable]
}

ActionableStep {
    step_number: int
    action: string
    description: string
    estimated_time: string (e.g., "5 minutes", "1 week")
    resources_needed: array[string]
    optional: boolean
}

ImpactEstimate {
    metric: string
    current_value: any
    projected_value: any
    improvement_percentage: float
    time_to_see_impact: string
}
```

### Example Advice Outputs

**Example 1: Fresh Graduate in Jakarta**
```json
{
    "advice_type": "budget_recommendation",
    "priority": "high",
    "title": "Optimalkan Budget untuk Fresh Graduate di Jakarta",
    "summary": "Dengan penghasilan Rp 8 juta dan kost di Jakarta, kamu perlu mengalokasikan 50% untuk kebutuhan pokok, 20% tabungan, dan sisanya untuk gaya hidup.",

    "detailed_explanation": "Analisis situasimu:\n\n📊 Profil Kamu:\n- Fresh graduate, 0-1 tahun kerja\n- Kost di Jakarta (Rp 2-3 juta/bulan)\n- Penghasilan Rp 8 juta/bulan\n\n💡 Rekomendasi:\n\n1. **Kebutuhan Pokok (50% = Rp 4 juta)**\n   - Kost: Rp 2.5 juta\n   - Makan: Rp 1 juta (Rp 33k/hari -可能的 dengan masak sendiri)\n   - Transport: Rp 300k (GrabBike untuk sehari-hari)\n   - Pulsa/Internet: Rp 100k\n   - Listrik/Air: Rp 100k\n\n2. **Tabungan & Investasi (20% = Rp 1.6 juta)**\n   - Emergency Fund: Rp 800k (50%)\n   - Deposito/Saham: Rp 400k (25%)\n   - Dana Reserves: Rp 400k (25%)\n\n3. **Gaya Hidup (30% = Rp 2.4 juta)**\n   - Hiburan: Rp 500k\n   - Langganan: Rp 200k\n   - Social: Rp 500k\n   - Shopping: Rp 500k\n   - Sisanya: Tabungan tambahan\n\n⚠️ Perhatian:\n- Kamu belum punya Dana Darurat (target 6x pengeluaran = Rp 24 juta)\n- Mulai dari Rp 800k/bulan, butuh ~30 bulan untuk capai\n- Jangan tergoda lifestyle creep saat dapat raise\n\n🎯 Action Items:\n1. [ ] Buka rekening tabungan terpisah untuk auto-debit\n2. [ ] Download aplikasi tracking expense (FinManager!)\n3. [ ] Set budget limit untuk kategori \"Gaya Hidup\"\n4. [ ] Mulai investasi Rp 100k/bulan di Reksa Dana\n5. [ ] Dalam 6 bulan, naikkan tabungan ke 25% dari penghasilan",

    "actionable_steps": [
        {
            "step_number": 1,
            "action": "Buat rekening tabungan terpisah",
            "description": "Buka rekening khusus untuk tabungan, aktifkan auto-debit Rp 800k/bulan",
            "estimated_time": "30 menit",
            "optional": false
        },
        {
            "step_number": 2,
            "action": "Mulai investasi reksa dana",
            "description": "Download aplikasi like Bibit/Stocker, mulai investasi Rp 100k/bulan di reksa dana indeks",
            "estimated_time": "1 jam pertama, 5 menit/bulan setelahnya",
            "optional": false
        },
        {
            "step_number": 3,
            "action": "Tracking expense",
            "description": "Catat setiap pengeluaran selama 1 bulan untuk dapat baseline",
            "estimated_time": "5 menit/hari",
            "optional": false
        }
    ],

    "expected_impact": {
        "metric": "Net Worth dalam 1 tahun",
        "current_value": "Rp 0",
        "projected_value": "Rp 15-20 juta",
        "improvement_percentage": 100,
        "time_to_see_impact": "12 bulan"
    },

    "confidence_score": 0.87,
    "source_data_points": [
        "User profile: fresh_graduate, jakarta, kost",
        "Estimated income: Rp 8,000,000",
        "Cost of living index: 1.2 (Jakarta tier 1)"
    ]
}
```

**Example 2: Entrepreneur with Variable Income**
```json
{
    "advice_type": "cash_flow_management",
    "priority": "high",
    "title": "Strategi Cash Flow untuk Penghasilan Tidak Tetap",

    "summary": "Sebagai entrepreneur dengan penghasilan fluktuatif, kamu perlu sistem 6-account untuk stabilize cash flow dan tetap konsisten menabung.",

    "detailed_explanation": "📊 Analisis Situasimu:\n\n- Penghasilan bulanan: Rp 15-50 juta (sangat fluktuatif)\n- Pengeluaran bisnis: Rp 5-10 juta\n- Pengeluaran pribadi: Rp 8 juta\n\n💡 Sistem 6-Account yang Saya Rekomendasikan:\n\n**ACCOUNT 1: Income Account (Pokok)**\nSemua penghasilan masuk ke sini.\n\n**ACCOUNT 2: Tax Reserve (10-15%)**\nSetiap masuk, langsung sisihkan 10-15% untuk pajak.\nContoh: Masuk Rp 30 juta → Sisihkan Rp 3-4.5 juta\n\n**ACCOUNT 3: Business Reserve (20%)**\nUntuk reinvestasi bisnis, pembelian inventory, dll.\n\n**ACCOUNT 4: Personal Fixed (Pengeluaran Tetap)**\n±Rp 8 juta untuk: kost, makan, transport\n\n**ACCOUNT 5: Savings Goals (20-25%)**\nUntuk tujuan spesifik: emergency fund, investasi\n\n**ACCOUNT 6: Fun Money (10%)**\nUntuk reward diri, impuls buying di sini aja.\n\n📈 Kenapa Ini Penting:\nTanpa sistem, biasanya entrepreneur:\n- Habisдорогое sebelum bulan selesai\n- Tidak punya dana darurat\n- Sulit konsisten investasi\n- Stress saat bulan \"kosong\"\n\n✅ Manfaat Sistem Ini:\n- Konsisten menabung SEBAGUS apapun bulan\n- Tidak kena surprise saattagihan pajak\n- Bisa invest即使 bulan kurang bagus\n- Mental lebih tenang tentang finances",

    "actionable_steps": [
        {
            "step_number": 1,
            "action": "Buka 5 rekening tambahan",
            "description": "Rekening: Tax Reserve, Business, Personal Fixed, Savings Goals, Fun Money",
            "estimated_time": "2 jam (di bank yang sama untuk mudah transfer)",
            "optional": false
        },
        {
            "step_number": 2,
            "action": "Set up auto-transfer rules",
            "description": "Setiap penghasilan masuk, auto-transfer sesuai persentase",
            "estimated_time": "1 jam",
            "optional": false
        },
        {
            "step_number": 3,
            "action": "Tentukan固定expense",
            "description": "List semua pengeluaran tetap bulanan, masukkan ke Account 4",
            "estimated_time": "30 menit",
            "optional": false
        }
    ],

    "confidence_score": 0.92,
    "source_data_points": [
        "User profile: entrepreneur, variable_income",
        "Transaction history: 6 months",
        "Average income: Rp 25M, variance: 0.6"
    ]
}
```

## 3.3 Spending Analysis Engine

### Analysis Models
```python
SpendingAnalysis {
    user_id: UUID
    period: DateRange
    total_spending: decimal(15,2)
    category_breakdown: array[CategorySpending]
    top_merchants: array[MerchantSpending]
    spending_trends: array[DailySpending]
    anomalies: array[SpendingAnomaly]
    opportunities: array[SavingOpportunity]

    # Comparison
    vs_last_period: PercentChange
    vs_average: PercentChange
    vs_budget: BudgetComparison

    # Insights
    insights: array[SpendingInsight]
    recommendations: array[string]

    generated_at: datetime
}

CategorySpending {
    category_id: UUID
    category_name: string
    amount: decimal(15,2)
    percentage: float
    transaction_count: int
    avg_transaction: decimal(15,2)
    trend: enum ['increasing', 'decreasing', 'stable']
    trend_percentage: float
}

SpendingAnomaly {
    type: enum ['unusual_amount', 'unusual_category', 'unusual_timing', 'duplicate']
    description: string
    amount: decimal(15,2)
    expected_range: Range
    severity: enum ['info', 'warning', 'alert']
    date: date
}

SavingOpportunity {
    category: string
    current_spending: decimal(15,2)
    recommended_spending: decimal(15,2)
    potential_savings: decimal(15,2)
    action: string
    difficulty: enum ['easy', 'medium', 'hard']
}

SpendingInsight {
    type: enum [
        'lifestyle_creep',
        'seasonal_pattern',
        'subscription_bloat',
        'impulse_buying',
        'convenience_tax',
        'underestimated_category'
    ]
    title: string
    description: string
    data_evidence: string
    suggestion: string
}
```

### Analysis Logic
```python
def analyze_spending(user_id: UUID, period: DateRange) -> SpendingAnalysis:
    transactions = get_transactions(user_id, period)

    # 1. Category breakdown
    category_breakdown = {}
    for txn in transactions:
        cat = txn.category.name
        category_breakdown[cat] = category_breakdown.get(cat, 0) + txn.amount

    # 2. Anomaly detection (statistical)
    anomalies = detect_anomalies(transactions)

    # 3. Spending pattern analysis
    patterns = detect_patterns(transactions)

    # 4. Opportunity identification
    opportunities = identify_opportunities(category_breakdown, patterns)

    # 5. Insight generation
    insights = generate_insights(patterns, anomalies, opportunities)

    return SpendingAnalysis(...)

def detect_anomalies(transactions: list) -> list[SpendingAnomaly]:
    """
    Statistical anomaly detection using IQR method.
    """
    # Group by category
    by_category = group_by(transactions, 'category_id')

    anomalies = []
    for cat_id, txns in by_category.items():
        amounts = [t.amount for t in txns]
        q1, q3 = percentile(amounts, [25, 75])
        iqr = q3 - q1
        lower = q1 - 1.5 * iqr
        upper = q3 + 1.5 * iqr

        for txn in txns:
            if txn.amount < lower or txn.amount > upper:
                anomalies.append(SpendingAnomaly(
                    type='unusual_amount',
                    amount=txn.amount,
                    expected_range=Range(lower, upper),
                    severity='warning' if abs(txn.amount - upper) > iqr else 'info'
                ))

    return anomalies

def identify_opportunities(
    category_breakdown: dict,
    patterns: dict
) -> list[SavingOpportunity]:
    """
    Identify areas where user can save money.
    """
    opportunities = []

    # 1. Subscription audit
    subscriptions = get_recurring_transactions(type='subscription')
    if len(subscriptions) > 5:
        opportunities.append(SavingOpportunity(
            category="Subscriptions",
            current_spending=sum(s.amount for s in subscriptions),
            recommendation="Consider consolidating or canceling unused subscriptions",
            potential_savings=sum(s.amount for s in subscriptions if not s.is_essential)
        ))

    # 2. Dining out analysis
    dining = category_breakdown.get('Makanan & Minuman', 0)
    if dining > 2000000:  # 2 juta
        opportunities.append(SavingOpportunity(
            category="Makanan & Minuman",
            current_spending=dining,
            recommended_spending=dining * 0.8,
            potential_savings=dining * 0.2,
            action="Cook more at home, bring lunch to work"
        ))

    # 3. Transport optimization
    transport = category_breakdown.get('Transportasi', 0)
    if transport > 1500000:
        opportunities.append(SavingOpportunity(
            category="Transportasi",
            current_spending=transport,
            recommended_spending=transport * 0.85,
            potential_savings=transport * 0.15,
            action="Consider Gojek passes or monthly passes"
        ))

    return opportunities
```

## 3.4 Budget Advisor

### Budget Recommendation Engine
```python
def generate_budget_recommendation(
    user_profile: UserProfile,
    situation: UserSituation
) -> BudgetRecommendation:
    """
    Generate personalized budget based on:
    1. User's income level
    2. Location/cost of living
    3. Living situation
    4. Family status
    5. Financial goals
    """

    income = situation.monthly_income
    location = user_profile.city

    # Base percentages from income level
    if income < 5000000:  # < 5 juta
        base_needs = 0.65
        base_savings = 0.15
        base_lifestyle = 0.20
    elif income < 15000000:  # 5-15 juta
        base_needs = 0.50
        base_savings = 0.20
        base_lifestyle = 0.30
    elif income < 50000000:  # 15-50 juta
        base_needs = 0.40
        base_savings = 0.25
        base_lifestyle = 0.35
    else:  # > 50 juta
        base_needs = 0.30
        base_savings = 0.30
        base_lifestyle = 0.40

    # Adjust for living situation
    if user_profile.living_situation == 'with_parents':
        base_needs -= 0.15
        base_savings += 0.10
    elif user_profile.living_situation == 'renting_alone':
        base_needs += 0.10
        base_lifestyle -= 0.05

    # Adjust for city tier
    if user_profile.city_tier == 'tier1':
        base_needs *= 1.15  # 15% more expensive
        base_savings *= 0.95
    elif user_profile.city_tier == 'tier3':
        base_needs *= 0.85
        base_savings *= 1.10

    # Adjust for dependents
    if user_profile.dependents_count > 0:
        base_needs += (user_profile.dependents_count * 0.05)
        base_savings -= (user_profile.dependents_count * 0.03)

    # Adjust for goals
    if user_profile.primary_financial_goal == 'emergency_fund':
        base_savings += 0.05
    elif user_profile.primary_financial_goal == 'debt_free':
        base_savings += 0.10

    # Normalize to 100%
    total = base_needs + base_savings + base_lifestyle
    base_needs /= total
    base_savings /= total
    base_lifestyle /= total

    # Generate category breakdown
    categories = get_user_categories(user_profile.user_id)

    budget_recommendation = BudgetRecommendation(
        total_income=income,
        breakdown=BudgetBreakdown(
            needs=BudgetCategory(
                total=income * base_needs,
                categories=[
                    CategoryBudget(
                        category="Kebutuhan Pokok",
                        amount=income * base_needs * 0.50,
                        subcategories=[
                            SubCategoryBudget(name="Makan", amount=income * base_needs * 0.30),
                            SubCategoryBudget(name="Transport", amount=income * base_needs * 0.15),
                            SubCategoryBudget(name="Kebutuhan Rumah", amount=income * base_needs * 0.05)
                        ]
                    ),
                    CategoryBudget(
                        category="Utilitas",
                        amount=income * base_needs * 0.15,
                        subcategories=[
                            SubCategoryBudget(name="Listrik & Air", amount=income * base_needs * 0.08),
                            SubCategoryBudget(name="Internet", amount=income * base_needs * 0.04),
                            SubCategoryBudget(name="Pulsa", amount=income * base_needs * 0.03)
                        ]
                    ),
                    CategoryBudget(
                        category="Asuransi & Kesehatan",
                        amount=income * base_needs * 0.10
                    ),
                    CategoryBudget(
                        category="Pendidikan & Pengembangan",
                        amount=income * base_needs * 0.05
                    ),
                    CategoryBudget(
                        category="Tabungan Darurat",
                        amount=income * base_needs * 0.10
                    )
                ]
            ),
            savings=BudgetCategory(
                total=income * base_savings,
                categories=[
                    CategoryBudget(
                        category="Investasi",
                        amount=income * base_savings * 0.60
                    ),
                    CategoryBudget(
                        category="Dana Reserves",
                        amount=income * base_savings * 0.25
                    ),
                    CategoryBudget(
                        category="Dana Goals",
                        amount=income * base_savings * 0.15
                    )
                ]
            ),
            lifestyle=BudgetCategory(
                total=income * base_lifestyle,
                categories=[
                    CategoryBudget(name="Hiburan", amount=income * base_lifestyle * 0.30),
                    CategoryBudget(name="Social", amount=income * base_lifestyle * 0.25),
                    CategoryBudget(name="Shopping", amount=income * base_lifestyle * 0.25),
                    CategoryBudget(name="Travel", amount=income * base_lifestyle * 0.20)
                ]
            )
        ),
        notes=generate_budget_notes(user_profile, situation),
        warnings=generate_budget_warnings(user_profile, situation)
    )

    return budget_recommendation
```

## 3.5 Financial Projection Engine

### Projection Models
```python
FinancialProjection {
    user_id: UUID
    projection_years: int
    starting_net_worth: decimal(15,2)
    assumptions: ProjectionAssumptions
    scenarios: array[ProjectionScenario]
    milestones: array[FinancialMilestone]
    risk_factors: array[RiskFactor]
    generated_at: datetime
}

ProjectionAssumptions {
    annual_income_growth: float (default 0.05 = 5%)
    annual_expense_growth: float (default 0.03 = 3%)
    annual_investment_return: float (default 0.08 = 8%)
    inflation_rate: float (default 0.04 = 4%)
    tax_rate: float (default 0.05 = 5% for investment)
    salary_increase_frequency: int (years)
}

ProjectionScenario {
    name: string
    probability: float
    annual_data: array[YearlyProjection]
    final_net_worth: decimal(15,2)
    goal_achievement: GoalAchievement
}

YearlyProjection {
    year: int
    age: int
    gross_income: decimal(15,2)
    expenses: decimal(15,2)
    savings: decimal(15,2)
    investments: decimal(15,2)
    investment_returns: decimal(15,2)
    net_worth: decimal(15,2)
    inflation_adjusted_net_worth: decimal(15,2)
}

FinancialMilestone {
    name: string
    target_year: int
    target_amount: decimal(15,2)
    probability: float
    achieved_in_scenario: string [nullable]
}

RiskFactor {
    type: enum ['market_crash', 'job_loss', 'medical_emergency', 'debt_overload']
    impact_description: string
    mitigation_suggestion: string
}
```

### Projection Logic
```python
def project_financial_future(
    user_id: UUID,
    years: int,
    custom_scenarios: list[Scenario] = None
) -> FinancialProjection:
    user = get_user(user_id)
    profile = get_profile(user_id)
    situation = compute_situation(user_id)
    goals = get_active_goals(user_id)

    # Default scenarios
    scenarios = custom_scenarios or [
        Scenario(name="Conservative", probability=0.2,
                 income_growth=0.03, investment_return=0.05),
        Scenario(name="Moderate", probability=0.5,
                 income_growth=0.05, investment_return=0.08),
        Scenario(name="Aggressive", probability=0.3,
                 income_growth=0.08, investment_return=0.12),
    ]

    # Base assumptions
    base_assumptions = ProjectionAssumptions(
        annual_income_growth=profile.estimated_income_growth,
        annual_expense_growth=0.03,  # Assume 3% expense inflation
        annual_investment_return=0.08,
        inflation_rate=0.04,
        tax_rate=0.05,
    )

    # Project each scenario
    projected_scenarios = []
    for scenario in scenarios:
        yearly_data = []
        current_net_worth = situation.net_worth
        current_income = situation.monthly_income * 12
        current_expenses = situation.monthly_expenses * 12

        for year in range(1, years + 1):
            # Apply growth rates
            income = current_income * (1 + scenario.income_growth) ** year
            expenses = current_expenses * (1 + base_assumptions.annual_expense_growth) ** year
            savings = income - expenses - (income * base_assumptions.tax_rate)

            # Investment growth
            investment_value = current_net_worth * (1 + scenario.investment_return) ** year
            investment_returns = investment_value - current_net_worth

            net_worth = current_net_worth + savings + investment_returns

            yearly_data.append(YearlyProjection(
                year=year,
                age=profile.age + year,
                gross_income=income,
                expenses=expenses,
                savings=savings,
                investments=investment_value,
                investment_returns=investment_returns,
                net_worth=net_worth,
                inflation_adjusted=net_worth / ((1 + base_assumptions.inflation_rate) ** year)
            ))

        # Check goal achievement
        goal_achievement = check_goal_achievement(goals, yearly_data)

        projected_scenarios.append(ProjectionScenario(
            name=scenario.name,
            probability=scenario.probability,
            annual_data=yearly_data,
            final_net_worth=yearly_data[-1].net_worth,
            goal_achievement=goal_achievement
        ))

    # Calculate expected (probability-weighted) scenario
    expected_net_worth = sum(
        s.final_net_worth * s.probability
        for s in projected_scenarios
    )

    # Identify milestones
    milestones = identify_milestones(projected_scenarios, goals)

    # Risk factors
    risk_factors = assess_risk_factors(user_profile, situation)

    return FinancialProjection(
        user_id=user_id,
        projection_years=years,
        starting_net_worth=situation.net_worth,
        assumptions=base_assumptions,
        scenarios=projected_scenarios,
        expected_scenario=expected_net_worth,
        milestones=milestones,
        risk_factors=risk_factors,
        generated_at=datetime.now()
    )
```

### Example Projection Output
```json
{
    "user_id": "uuid",
    "projection_years": 10,
    "starting_net_worth": 50000000,
    "expected_scenario": 850000000,

    "assumptions": {
        "annual_income_growth": 0.05,
        "annual_expense_growth": 0.03,
        "annual_investment_return": 0.08,
        "inflation_rate": 0.04
    },

    "scenarios": [
        {
            "name": "Conservative",
            "probability": 0.2,
            "final_net_worth": 350000000,
            "goal_achievement": {
                "emergency_fund": "achieved_year_2",
                "house_downpayment": "achieved_year_7"
            }
        },
        {
            "name": "Moderate",
            "probability": 0.5,
            "final_net_worth": 750000000,
            "goal_achievement": {
                "emergency_fund": "achieved_year_1",
                "house_downpayment": "achieved_year_5",
                "retirement_ready": "achieved_year_8"
            }
        },
        {
            "name": "Aggressive",
            "probability": 0.3,
            "final_net_worth": 1200000000,
            "goal_achievement": {
                "emergency_fund": "achieved_year_1",
                "house_downpayment": "achieved_year_4",
                "retirement_ready": "achieved_year_6"
            }
        }
    ],

    "milestones": [
        {
            "name": "Dana Darurat 6 Bulan",
            "target_amount": 90000000,
            "target_year": 2,
            "achieved_in": "Conservative: Year 2, Moderate: Year 1, Aggressive: Year 1"
        },
        {
            "name": "Uang Muka Rumah",
            "target_amount": 250000000,
            "target_year": 5,
            "achieved_in": "Conservative: Year 7, Moderate: Year 5, Aggressive: Year 4"
        }
    ],

    "risk_factors": [
        {
            "type": "job_loss",
            "impact": "Dengan dana darurat 6 bulan, bisa bertahan 6 bulan tanpa income",
            "mitigation": "Tingkatkan dana darurat ke 12 bulan atau punya side income"
        }
    ]
}
```

## 3.6 Free-Text Question Answering

### Natural Language Interface
```python
# POST /api/v1/ai/ask
class AIAdvisorQAService:
    """
    Answer user's free-text questions about their finances.
    """

    def answer(
        self,
        user_id: UUID,
        question: str,
        context: str = None
    ) -> QAResponse:
        """
        Main Q&A endpoint.
        """
        # 1. Parse intent
        intent = self.nlp.parse_intent(question)

        # 2. Gather relevant data
        relevant_data = self._gather_data(user_id, intent)

        # 3. Generate response based on intent type
        if intent.type == 'comparison':
            return self._generate_comparison(intent, relevant_data)
        elif intent.type == 'projection':
            return self._generate_projection(intent, relevant_data)
        elif intent.type == 'advice':
            return self._generate_advice(intent, relevant_data)
        elif intent.type == 'explanation':
            return self._generate_explanation(intent, relevant_data)
        elif intent.type == 'calculation':
            return self._generate_calculation(intent, relevant_data)
        else:
            return self._generate_general_response(intent, relevant_data)

    def _gather_data(self, user_id: UUID, intent: ParsedIntent) -> DataContext:
        """
        Gather relevant data based on intent.
        """
        context = DataContext()

        # Always load user profile and situation
        context.user_profile = get_profile(user_id)
        context.situation = compute_situation(user_id)

        # Load based on intent
        if intent.needs_transactions:
            context.transactions = get_transactions(
                user_id,
                start_date=intent.date_range.start,
                end_date=intent.date_range.end
            )

        if intent.needs_budget:
            context.budgets = get_budgets(user_id)

        if intent.needs_goals:
            context.goals = get_goals(user_id)

        if intent.needs_debts:
            context.debts = get_debts(user_id)

        return context

    def _generate_advice(self, intent: ParsedIntent, data: DataContext) -> QAResponse:
        """
        Generate advice-based response.
        """
        # Analyze the question
        if 'tabungan' in intent.keywords:
            return self._advice_on_savings(intent, data)
        elif 'investasi' in intent.keywords:
            return self._advice_on_investment(intent, data)
        elif 'budget' in intent.keywords or 'pengeluaran' in intent.keywords:
            return self._advice_on_budget(intent, data)
        elif 'hutang' in intent.keywords or 'cicilan' in intent.keywords:
            return self._advice_on_debt(intent, data)
        else:
            return self._general_financial_advice(intent, data)

    def _advice_on_savings(
        self,
        intent: ParsedIntent,
        data: DataContext
    ) -> QAResponse:
        """
        Provide savings advice based on user's situation.
        """
        income = data.situation.monthly_income
        expenses = data.situation.monthly_expenses
        savings_rate = (income - expenses) / income if income > 0 else 0

        # Calculate recommended savings
        recommended_rate = self._calculate_recommended_savings_rate(data.user_profile)

        if savings_rate < recommended_rate:
            shortfall = (recommended_rate - savings_rate) * income
            response = f"""
            📊 Analisis Tabungan Kamu:

            💰 Tabungan Saat Ini:
            - Tabungan per bulan: Rp {expenses:,.0f}
            - Savings rate: {savings_rate*100:.1f}%

            🎯 Target Savings Rate untuk Kamu:
            - Berdasarkan profilmu ({data.user_profile.occupation} di {data.user_profile.city}),
              target savings rate: {recommended_rate*100:.0f}%

            📈 Gap yang Perlu Diperbaiki:
            - Kamu perlu menabung额外 Rp {shortfall:,.0f}/bulan
            - Ini bisa dicapai dengan:
              1. Kurangi pengeluaran untuk '{intent.suggested_category}' sebesar Rp {shortfall:,.0f}
              2. Atau tingkatkan income sebesar Rp {shortfall:,.0f}

            💡 Tips Cepat:
            - Set up auto-debit untuk tabungan (jangan rely pada 'sisa' uang)
            - Pakai aturan 50/30/20 atau sesuai dengan situasi-mu
            - Mulai dari yang kecil, yang penting konsisten
            """
        else:
            response = f"""
            🎉 Kabar Baik!

            Tabungan kamu sudah di atas target untuk profilmu!

            💰 Status:
            - Savings rate: {savings_rate*100:.1f}%
            - Target: {recommended_rate*100:.0f}%

            📈 Rekomendasi Selanjutnya:
            1. Tingkatkan ke {recommended_rate*1.2*100:.0f}% untuk accelerated savings
            2. Mulai investasi jangka panjang
            3. Percepat pembayaran debt (jika ada)
            """

        return QAResponse(
            answer=response,
            type='advice',
            data_used=['income', 'expenses', 'user_profile'],
            confidence=0.85,
            suggested_actions=self._generate_savings_actions(data)
        )
```

### Example Q&A Interactions

**Q: "Gue harus nabung berapa sih tiap bulan?"**
```json
{
    "question": "Gue harus nabung berapa sih tiap bulan?",
    "answer": "📊 Berdasarkan situasimu:\n\n💰 Profil Kamu:\n- Fresh Graduate, kerja di Jakarta\n- Penghasilan: Rp 8.000.000/bulan\n- Kost Rp 2.500.000/bulan\n\n🎯 Rekomendasi:\n\n1️⃣ **Dana Darurat (Urgent!)**\n   Target: Rp 18.000.000 (6x pengeluaran pokok)\n   Per bulan: Rp 1.500.000\n   Timeline: ~12 bulan\n\n2️⃣ **Tabungan Regular**\n   20% dari penghasilan: Rp 1.600.000/bulan\n   Untuk: Goals, investasi, reserves\n\n📋 Ringkasan:\n- Total tabungan: Rp 3.100.000/bulan (38.75%)\n- Sisa untuk pengeluaran: Rp 4.900.000\n\n⚠️ Catatan:\nIni based on asumsi kamu kost. Kalau tinggal dengan ortu, bisa lebih besar lagi untuk tabungan dan investasi!",
    "confidence": 0.88,
    "suggested_actions": [
        {
            "action": "Buat sub-account 'Dana Darurat'",
            "amount": 1500000,
            "frequency": "monthly",
            "auto_debit": true
        },
        {
            "action": "Mulai investasi reksa dana",
            "amount": 500000,
            "frequency": "monthly",
            "platform": "Bibit atau Bareksa"
        }
    ]
}
```

**Q: "Bisa gak ya gue retire umur 45 dengan 1 Milyar?"**
```json
{
    "question": "Bisa gak ya gue retire umur 45 dengan 1 Milyar?",
    "answer": "🔮 Proyeksi Finansialmu:\n\n📊 Data Kamu:\n- Usia sekarang: 25 tahun\n- Target retirement: 45 tahun (20 tahun lagi)\n- Target: Rp 1.000.000.000\n- Net worth sekarang: Rp 50.000.000\n\n📈 Skenario Proyeksi:\n\n| Skenario | Return/Tahun | Tabungan/Bulan | Bisa? |\n|----------|-------------|----------------|-------|\n| Konservatif | 5% | Rp 1.500.000 | ❌ (hanya Rp 650M) |\n| Moderat | 8% | Rp 1.500.000 | ⚠️ (Rp 950M, almost!) |\n| Moderat | 8% | Rp 2.000.000 | ✅ (Rp 1.2M) |\n| Agresif | 12% | Rp 1.500.000 | ✅ (Rp 1.5M) |\n\n💡 Kesimpulan:\n\nUntuk capai Rp 1M di umur 45, ada 2 opsi:\n\n**Opsi 1: Naikkan Tabungan**\n- Tabung Rp 2.000.000/bulan\n- Return investasi 8%\n- Kamu capai target!\n\n**Opsi 2: Naikkan Risk Tolerance**\n- Tabung Rp 1.500.000/bulan\n- Return investasi 12% (lebih agresif)\n- Bisa dengan portfolio: 70% saham, 30% obligasi\n\n**Opsi 3: Mundurkan Target**\n- Retire di umur 50 dengan asumsi yang sama\n- Lebih realistis dan less stressful\n\n⚠️ Perhatian:\n- Belum termasuk inflation\n- Belum termasuk kemungkinan expense besar (nikah, punya anak)\n- Perlu health insurance dan life insurance\n\n🎯 Action Items:\n1. [ ] Naikkan tabungan ke Rp 2jt/bulan\n2. [ ] Mulai investasi dengan return 8-10%\n3. [ ] Hitung ulang kalau punya rencana besar (nikah, anak)",
    "confidence": 0.82,
    "charts": [
        {
            "type": "line",
            "title": "Proyeksi Net Worth 20 Tahun",
            "data": [...]
        }
    ]
}
```

---

# PHASE 4: PREMIUM FEATURES (Revenue Streams)

## Overview
Premium features untuk subscription model dan B2B opportunities.

## 4.1 Subscription Tiers

### Tier Comparison
```python
SUBSCRIPTION_TIERS = {
    "free": {
        "name": "Gratis",
        "price": 0,
        "period": "forever",
        "features": {
            "accounts": 2,
            "transactions_per_month": 100,
            "integrations": ["manual_entry"],
            "ai_questions_per_day": 5,
            "budgets": 2,
            "goals": 1,
            "reports": ["basic"],
            "export": False,
            "priority_support": False,
            "ads": True
        }
    },
    "starter": {
        "name": "Starter",
        "price": 29000,
        "period": "month",
        "features": {
            "accounts": 5,
            "transactions_per_month": 500,
            "integrations": ["manual_entry", "bank_basic"],
            "ai_questions_per_day": 20,
            "budgets": 10,
            "goals": 5,
            "reports": ["basic", "monthly"],
            "export": "csv",
            "priority_support": False,
            "ads": False
        }
    },
    "pro": {
        "name": "Pro",
        "price": 79000,
        "period": "month",
        "annual_price": 690000,  # Save 2 bulan
        "features": {
            "accounts": -1,  # Unlimited
            "transactions_per_month": -1,
            "integrations": ["manual_entry", "bank_basic", "ewallet", "email", "merchant"],
            "ai_questions_per_day": -1,
            "budgets": -1,
            "goals": -1,
            "reports": ["basic", "monthly", "yearly", "custom"],
            "export": ["csv", "pdf", "excel"],
            "priority_support": True,
            "ads": False,
            "investment_tracking": True,
            "tax_report": True,
            "debt_planning": True,
            "projection_engine": True
        }
    },
    "business": {
        "name": "Business",
        "price": 199000,
        "period": "month",
        "annual_price": 1790000,
        "features": {
            "all_pro_features": True,
            "multi_user": True,  # Up to 5 team members
            "api_access": True,
            "invoice_generation": True,
            "client_management": True,
            "tax_filing_integration": True,
            "accountant_portal": True,
            "custom_branding": False,
            "dedicated_support": True
        }
    },
    "enterprise": {
        "name": "Enterprise",
        "price": "custom",
        "period": "year",
        "features": {
            "all_business_features": True,
            "multi_user": -1,  # Unlimited
            "api_access": True,
            "custom_integrations": True,
            "white_label": True,
            "dedicated_account_manager": True,
            "sla_guarantee": True,
            "on_premise_option": True
        }
    }
}
```

### Subscription Model
```python
Subscription {
    id: UUID
    user_id: UUID (FK)
    tier: enum ['free', 'starter', 'pro', 'business', 'enterprise']
    status: enum ['active', 'cancelled', 'past_due', 'trialing']
    current_period_start: datetime
    current_period_end: datetime
    cancel_at_period_end: boolean
    cancelled_at: datetime [nullable]

    # Billing
    payment_method: enum ['card', 'bank_transfer', 'gopay', 'ovo', 'qris']
    billing_address: Address [nullable]
    tax_id: string [nullable]

    # Trial
    trial_start: datetime [nullable]
    trial_end: datetime [nullable]
    trial_converted_at: datetime [nullable]

    # Usage
    usage_current: UsageStats
    usage_limit: UsageLimits

    created_at: datetime
    updated_at: datetime
}

UsageStats {
    accounts_count: int
    transactions_this_month: int
    ai_questions_today: int
    api_calls_this_month: int
    storage_used_mb: float
}

Invoice {
    id: UUID
    subscription_id: UUID (FK)
    invoice_number: string
    amount: decimal(15,2)
    tax_amount: decimal(15,2)
    total: decimal(15,2)
    currency: string
    status: enum ['draft', 'pending', 'paid', 'failed', 'refunded']
    due_date: date
    paid_at: datetime [nullable]
    items: array[InvoiceItem]
    pdf_url: string [nullable]
}
```

## 4.2 Premium AI Features

### Advanced AI Analysis (Pro+)
```python
PremiumAIAnalysis {
    # Investment Advisor
    investment_portfolio_review: {
        description: "AI review portfolio kamu, rekomendasi rebalancing",
        frequency: "monthly",
        output: {
            "current_allocation": {...},
            "risk_assessment": {...},
            "rebalancing_suggestions": [...],
            "expected_returns": {...}
        }
    },

    # Tax Optimization
    tax_optimization_report: {
        description: "Annual tax planning dan penghematan",
        frequency: "yearly (before tax season)",
        output: {
            "estimated_tax": decimal,
            "deductions_available": [...],
            "tax_saving_suggestions": [...],
            "filing_checklist": [...]
        }
    },

    # Financial Health Score
    detailed_health_score: {
        description: "Comprehensive financial health assessment",
        frequency: "monthly",
        output: {
            "overall_score": int (0-100),
            "categories": {
                "savings": {...},
                "debt": {...},
                "insurance": {...},
                "investment": {...},
                "emergency_prep": {...}
            },
            "improvement_plan": [...],
            "benchmark_comparison": {...}
        }
    },

    # Goal Achievement Probability
    goal_probability_analysis: {
        description: "Chance analysis untuk setiap goal",
        frequency: "on-demand",
        output: {
            "goals": [
                {
                    "name": string,
                    "target": decimal,
                    "current": decimal,
                    "probability": float,
                    "factors": [...],
                    "adjustments_needed": [...]
                }
            ]
        }
    },

    # Custom Financial Plan
    personalized_financial_plan: {
        description: "5-year comprehensive financial roadmap",
        frequency: "yearly",
        output: {
            "current_state": {...},
            "goals": [...],
            "milestones": [...],
            "monthly_action_items": [...],
            "projections": {...}
        }
    }
}
```

### Example Premium Report
```json
{
    "report_type": "financial_health_score",
    "generated_at": "2026-10-16T10:00:00Z",
    "valid_until": "2026-11-16T10:00:00Z",

    "overall_score": 72,
    "grade": "B",
    "trend": "improving",
    "trend_percentage": "+5% from last month",

    "categories": {
        "emergency_prep": {
            "score": 45,
            "grade": "D",
            "status": "critical",
            "details": {
                "current_fund": 15000000,
                "target_fund": 54000000,
                "months_covered": 2,
                "target_months": 6
            },
            "recommendations": [
                "Tingkatkan emergency fund ke 3 bulan dulu (Rp 27 juta)",
                "Alokasikan 30% dari setiap bonus untuk emergency fund",
                "Pertimbangkan untuk membuka deposito terpisah"
            ]
        },
        "savings_rate": {
            "score": 78,
            "grade": "C+",
            "status": "needs_attention",
            "details": {
                "savings_rate": 0.18,
                "target_rate": 0.20,
                "monthly_savings": 1440000,
                "target_savings": 1600000
            }
        },
        "debt_management": {
            "score": 85,
            "grade": "B+",
            "status": "good",
            "details": {
                "debt_to_income": 0.15,
                "credit_utilization": 0.30,
                "payment_history": "on_time"
            }
        },
        "investment": {
            "score": 62,
            "grade": "C",
            "status": "needs_attention",
            "details": {
                "investment_percentage": 0.08,
                "target": 0.15,
                "diversification_score": 0.45,
                "risk_appropriate": true
            }
        },
        "insurance": {
            "score": 30,
            "grade": "F",
            "status": "critical",
            "details": {
                "has_health_insurance": true,
                "has_life_insurance": false,
                "has_disability_insurance": false,
                "coverage_adequate": false
            }
        }
    },

    "priority_actions": [
        {
            "priority": 1,
            "action": "Ambil asuransi jiwa",
            "impact": "Proteksi keluarga dari risiko finansial",
            "estimated_cost": 500000,
            "time_to_implement": "1 minggu"
        },
        {
            "priority": 2,
            "action": "Tingkatkan emergency fund",
            "impact": "Financial safety net",
            "amount_needed": 12000000,
            "timeline": "6 bulan"
        }
    ],

    "benchmark": {
        "same_age": 68,
        "same_income": 70,
        "same_city": 71,
        "overall": 65
    }
}
```

## 4.3 Business Features (Business Tier+)

### Multi-User & Team Management
```python
Team {
    id: UUID
    owner_id: UUID (FK)
    name: string
    business_type: enum ['sole_proprietor', 'partnership', 'pt', 'cv', 'foundation']
    tax_id: string [nullable]

    members: array[TeamMember]
    roles: array[Role]

    created_at: datetime
}

TeamMember {
    user_id: UUID (FK)
    role_id: UUID (FK)
    invited_by: UUID (FK)
    joined_at: datetime
    status: enum ['active', 'invited', 'suspended']
}

Role {
    id: UUID
    name: string
    permissions: array[Permission]

PERMISSIONS = [
    "view_own_finances",
    "view_team_finances",
    "edit_own_finances",
    "edit_team_finances",
    "manage_members",
    "manage_integrations",
    "view_reports",
    "export_data",
    "manage_billing",
    "admin"
]

DEFAULT_ROLES = {
    "owner": ["admin", "manage_billing", "manage_members", ...],
    "accountant": ["view_team_finances", "edit_team_finances", "view_reports", "export_data"],
    "assistant": ["view_own_finances", "edit_own_finances"],
    "viewer": ["view_team_finances"]
}
```

### Invoice Generation (Business)
```python
Invoice {
    id: UUID
    team_id: UUID (FK)
    invoice_number: string (auto-generated)
    customer_name: string
    customer_email: string
    customer_address: string
    customer_phone: string [nullable]

    items: array[InvoiceItem]
    subtotal: decimal(15,2)
    tax_rate: decimal(5,2)
    tax_amount: decimal(15,2)
    discount_amount: decimal(15,2)
    total: decimal(15,2)
    currency: string

    issue_date: date
    due_date: date
    paid_date: date [nullable]
    status: enum ['draft', 'sent', 'viewed', 'paid', 'overdue', 'cancelled']

    payment_instructions: string
    notes: string [nullable]
    terms: string [nullable]

    pdf_url: string [nullable]
    created_at: datetime
    updated_at: datetime
}

InvoiceItem {
    description: string
    quantity: int
    unit_price: decimal(15,2)
    total: decimal(15,2)
}
```

### Client Management (For Accountants/FAs)
```python
Client {
    id: UUID
    advisor_team_id: UUID (FK)
    name: string
    email: string
    phone: string [nullable]
    company: string [nullable]
    tax_id: string [nullable]

    subscription_tier: enum (client's tier)
    status: enum ['active', 'archived', 'prospect']

    finmanager_user_id: UUID [nullable] (if client uses FinManager)

    access_level: enum ['read_only', 'read_write', 'full']
    granted_at: datetime

    notes: text [nullable]
    tags: array[string]

    created_at: datetime
}

ClientAccess {
    client_id: UUID (FK)
    advisor_id: UUID (FK)
    access_granted: datetime
    last_accessed: datetime
    access_log: array[AccessLogEntry]
}
```

## 4.4 White-Label & API Access (Enterprise)

### API Access
```python
APIAccess {
    id: UUID
    team_id: UUID (FK)
    api_key: string (hashed)
    api_secret: string (hashed)

    permissions: array[APIPermission]
    rate_limits: RateLimitConfig

    allowed_ips: array[string] [nullable]
    allowed_domains: array[string] [nullable]

    is_active: boolean
    last_used: datetime

    created_at: datetime
}

API_ENDPOINT_ACCESS = {
    # Read operations
    "read:transactions": "GET /api/v1/transactions/*",
    "read:accounts": "GET /api/v1/accounts/*",
    "read:balance": "GET /api/v1/balance/*",
    "read:goals": "GET /api/v1/goals/*",
    "read:budgets": "GET /api/v1/budgets/*",

    # Write operations
    "write:transactions": "POST/PUT/DELETE /api/v1/transactions/*",
    "write:accounts": "POST/PUT/DELETE /api/v1/accounts/*",

    # Reports
    "read:reports": "GET /api/v1/reports/*",

    # Webhooks
    "write:webhooks": "POST /api/v1/webhooks/*"
}

Webhook {
    id: UUID
    team_id: UUID (FK)
    url: string
    events: array[WebhookEvent]
    secret: string
    is_active: boolean
    created_at: datetime
}

WEBHOOK_EVENTS = [
    "transaction.created",
    "transaction.updated",
    "transaction.deleted",
    "balance.changed",
    "budget.exceeded",
    "goal.milestone_reached",
    "debt.payment_due",
    "sync.completed"
]
```

---

# DATABASE ARCHITECTURE

## 5.1 Complete Schema

### Core Tables
```sql
-- Users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    name VARCHAR(255),
    phone VARCHAR(20),
    avatar_url TEXT,
    auth_provider VARCHAR(50), -- 'email', 'google', 'apple'
    supabase_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_login_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- User Profiles (extended info)
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    age INT,
    gender VARCHAR(20),
    occupation VARCHAR(50),
    employment_status VARCHAR(50),
    city VARCHAR(100),
    city_tier VARCHAR(20),
    living_situation VARCHAR(50),
    marital_status VARCHAR(20),
    children_count INT DEFAULT 0,
    dependents_count INT DEFAULT 0,
    monthly_income DECIMAL(15,2),
    income_type VARCHAR(50),
    primary_financial_goal VARCHAR(100),
    target_retirement_age INT,
    risk_tolerance VARCHAR(50),
    financial_challenges JSONB,
    preferred_language VARCHAR(10) DEFAULT 'id',
    privacy_level VARCHAR(20) DEFAULT 'standard',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Accounts
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- bank, ewallet, cash, investment, credit
    balance DECIMAL(15,2) DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'IDR',
    institution VARCHAR(255),
    account_number VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    is_credit BOOLEAN DEFAULT FALSE,
    credit_limit DECIMAL(15,2),
    icon VARCHAR(50),
    color VARCHAR(20),
    last_synced TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Categories
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- NULL for system categories
    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL, -- income, expense, transfer
    icon VARCHAR(50),
    color VARCHAR(20),
    parent_id UUID REFERENCES categories(id),
    mcc_codes JSONB,
    keywords JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Transactions
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    account_id UUID REFERENCES accounts(id),
    category_id UUID REFERENCES categories(id),
    type VARCHAR(20) NOT NULL, -- income, expense, transfer_out, transfer_in
    amount DECIMAL(15,2) NOT NULL,
    date DATE NOT NULL,
    description TEXT,
    merchant_name VARCHAR(255),
    merchant_category VARCHAR(255),
    location VARCHAR(500),
    latitude DECIMAL(10,7),
    longitude DECIMAL(10,7),
    tags JSONB,
    receipt_url TEXT,
    source VARCHAR(50) DEFAULT 'manual',
    source_id VARCHAR(255),
    is_recurring BOOLEAN DEFAULT FALSE,
    recurring_rule_id UUID,
    transfer_id UUID,
    ai_category_suggestion VARCHAR(255),
    ai_confidence DECIMAL(3,2),
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_transactions_user_date ON transactions(user_id, date DESC);
CREATE INDEX idx_transactions_user_category ON transactions(user_id, category_id);
CREATE INDEX idx_transactions_account ON transactions(account_id);
CREATE INDEX idx_transactions_source ON transactions(source, source_id);

-- Transfers
CREATE TABLE transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    from_account_id UUID REFERENCES accounts(id),
    to_account_id UUID REFERENCES accounts(id),
    amount DECIMAL(15,2) NOT NULL,
    fee DECIMAL(15,2) DEFAULT 0,
    date DATE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Budgets
CREATE TABLE budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    period VARCHAR(20) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    category_id UUID REFERENCES categories(id),
    account_id UUID REFERENCES accounts(id),
    rollover BOOLEAN DEFAULT FALSE,
    alert_threshold INT DEFAULT 80,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Goals
CREATE TABLE goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    goal_type VARCHAR(50),
    target_amount DECIMAL(15,2) NOT NULL,
    current_amount DECIMAL(15,2) DEFAULT 0,
    target_date DATE,
    priority VARCHAR(20) DEFAULT 'medium',
    status VARCHAR(20) DEFAULT 'active',
    icon VARCHAR(50),
    color VARCHAR(20),
    milestones JSONB,
    auto_contribution_enabled BOOLEAN DEFAULT FALSE,
    auto_contribution_account_id UUID,
    auto_contribution_amount DECIMAL(15,2),
    auto_contribution_frequency VARCHAR(20),
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

-- Goal Contributions
CREATE TABLE goal_contributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    goal_id UUID REFERENCES goals(id) ON DELETE CASCADE,
    transaction_id UUID REFERENCES transactions(id),
    amount DECIMAL(15,2) NOT NULL,
    date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Debts
CREATE TABLE debts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    debt_type VARCHAR(50),
    creditor_name VARCHAR(255),
    creditor_type VARCHAR(50),
    principal DECIMAL(15,2) NOT NULL,
    current_balance DECIMAL(15,2) NOT NULL,
    interest_rate DECIMAL(5,2),
    interest_type VARCHAR(20) DEFAULT 'reducing',
    tenor_months INT,
    monthly_payment DECIMAL(15,2),
    start_date DATE,
    due_date DATE,
    next_payment_date DATE,
    next_payment_amount DECIMAL(15,2),
    remaining_months INT,
    status VARCHAR(20) DEFAULT 'active',
    collateral TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Debt Payments
CREATE TABLE debt_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    debt_id UUID REFERENCES debts(id) ON DELETE CASCADE,
    amount DECIMAL(15,2) NOT NULL,
    principal_portion DECIMAL(15,2),
    interest_portion DECIMAL(15,2),
    remaining_balance_after DECIMAL(15,2),
    payment_date DATE NOT NULL,
    payment_method VARCHAR(50),
    receipt_url TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Recurring Rules
CREATE TABLE recurring_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    account_id UUID REFERENCES accounts(id),
    category_id UUID REFERENCES categories(id),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    frequency VARCHAR(20) NOT NULL,
    interval_val INT DEFAULT 1,
    start_date DATE NOT NULL,
    end_date DATE,
    next_occurrence DATE,
    occurrences_left INT,
    auto_generate BOOLEAN DEFAULT FALSE,
    auto_post BOOLEAN DEFAULT FALSE,
    reminder_days_before INT DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    last_generated TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Integrations
CREATE TABLE bank_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    account_id UUID REFERENCES accounts(id),
    bank_id VARCHAR(50) NOT NULL,
    bank_name VARCHAR(255),
    access_token_encrypted TEXT,
    refresh_token_encrypted TEXT,
    token_expires_at TIMESTAMP,
    last_synced TIMESTAMP,
    sync_status VARCHAR(20),
    sync_error TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE ewallet_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    account_phone VARCHAR(50),
    balance DECIMAL(15,2),
    access_token_encrypted TEXT,
    refresh_token_encrypted TEXT,
    token_expires_at TIMESTAMP,
    last_synced TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE email_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    email_address VARCHAR(255) NOT NULL,
    provider VARCHAR(50),
    access_token_encrypted TEXT,
    refresh_token_encrypted TEXT,
    token_expires_at TIMESTAMP,
    sync_enabled BOOLEAN DEFAULT TRUE,
    sync_frequency VARCHAR(20) DEFAULT 'daily',
    last_synced TIMESTAMP,
    folders_to_monitor JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Subscriptions
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    tier VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,
    current_period_start TIMESTAMP,
    current_period_end TIMESTAMP,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    cancelled_at TIMESTAMP,
    payment_method VARCHAR(50),
    trial_start TIMESTAMP,
    trial_end TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Invoices
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID REFERENCES subscriptions(id),
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    tax_amount DECIMAL(15,2) DEFAULT 0,
    total DECIMAL(15,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'IDR',
    status VARCHAR(20) DEFAULT 'pending',
    due_date DATE,
    paid_at TIMESTAMP,
    items JSONB,
    pdf_url TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- AI Advice
CREATE TABLE ai_advice (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    advice_type VARCHAR(50) NOT NULL,
    priority VARCHAR(20),
    title VARCHAR(500),
    summary TEXT,
    detailed_explanation TEXT,
    actionable_steps JSONB,
    expected_impact JSONB,
    confidence_score DECIMAL(3,2),
    source_data_points JSONB,
    dismissible BOOLEAN DEFAULT TRUE,
    dismissed_at TIMESTAMP,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Net Worth Snapshots
CREATE TABLE net_worth_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    total_assets DECIMAL(15,2) NOT NULL,
    total_liabilities DECIMAL(15,2) DEFAULT 0,
    net_worth DECIMAL(15,2) NOT NULL,
    change_from_previous DECIMAL(15,2),
    change_percentage DECIMAL(5,2),
    breakdown JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Activity Log
CREATE TABLE activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    details JSONB,
    ip_address VARCHAR(50),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Teams (Business)
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    business_type VARCHAR(50),
    tax_id VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    role_id UUID,
    status VARCHAR(20) DEFAULT 'active',
    joined_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    permissions JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Business Invoices
CREATE TABLE business_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    customer_name VARCHAR(255),
    customer_email VARCHAR(255),
    customer_address TEXT,
    customer_phone VARCHAR(50),
    items JSONB NOT NULL,
    subtotal DECIMAL(15,2),
    tax_rate DECIMAL(5,2),
    tax_amount DECIMAL(15,2),
    discount_amount DECIMAL(15,2) DEFAULT 0,
    total DECIMAL(15,2),
    currency VARCHAR(10) DEFAULT 'IDR',
    issue_date DATE,
    due_date DATE,
    paid_date DATE,
    status VARCHAR(20) DEFAULT 'draft',
    payment_instructions TEXT,
    notes TEXT,
    pdf_url TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- API Access (Enterprise)
CREATE TABLE api_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    api_key VARCHAR(255) UNIQUE NOT NULL,
    api_secret_encrypted TEXT,
    permissions JSONB,
    rate_limits JSONB,
    allowed_ips JSONB,
    allowed_domains JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    last_used TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    events JSONB NOT NULL,
    secret VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- QRIS and Receipts
CREATE TABLE qris_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    source VARCHAR(20),
    qris_raw TEXT,
    merchant_name VARCHAR(255),
    merchant_id VARCHAR(255),
    merchant_category VARCHAR(255),
    amount DECIMAL(15,2),
    tip_amount DECIMAL(15,2),
    currency VARCHAR(10),
    transaction_date TIMESTAMP,
    acquirer VARCHAR(255),
    issuer VARCHAR(255),
    is_income BOOLEAN,
    linked_transaction_id UUID,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE receipt_scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    image_url TEXT,
    merchant_name VARCHAR(255),
    merchant_address TEXT,
    receipt_number VARCHAR(255),
    date DATE,
    items JSONB,
    subtotal DECIMAL(15,2),
    tax DECIMAL(15,2),
    service_charge DECIMAL(15,2),
    tip DECIMAL(15,2),
    total DECIMAL(15,2),
    payment_method VARCHAR(100),
    currency VARCHAR(10),
    ocr_confidence DECIMAL(3,2),
    ocr_raw_text TEXT,
    linked_transaction_id UUID,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW()
);
```

## 5.2 Database Relationships
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATABASE RELATIONSHIPS                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────┐         ┌──────────────────┐         ┌──────────┐
│   USER   │─────────│  USER_PROFILE    │         │    -     │
└────┬─────┘         └──────────────────┘         └──────────┘
     │
     ├───────────────┬───────────────┬───────────────┬───────────────┐
     │               │               │               │               │
     ▼               ▼               ▼               ▼               ▼
┌─────────┐    ┌───────────┐   ┌───────────┐   ┌───────────┐   ┌─────────┐
│ACCOUNTS │   │CATEGORIES │   │TRANSACTIONS│   │  BUDGETS  │   │  GOALS  │
└────┬────┘   └─────┬─────┘   └─────┬───────┘   └─────┬─────┘   └────┬────┘
     │               │               │               │               │
     │               │               ├───────────────┤               │
     │               │               │               │               │
     │               ▼               ▼               │               │
     │         ┌───────────┐   ┌───────────┐       │               │
     │         │BANK_CONN  │   │ TRANSFERS  │       │               │
     │         │EWALLET    │   └───────────┘       │               │
     │         │EMAIL_CONN │                       │               │
     │         └───────────┘                       │               │
     │                                               │               │
     ├───────────────────────────────┐               │               │
     │                               │               │               │
     ▼                               ▼               ▼               ▼
┌──────────┐                   ┌───────────┐   ┌───────────┐   ┌──────────────┐
│  DEBTS   │                   │RECURRING_ │   │AI_ADVICE │   │GOAL_CONTRIB │
└────┬─────┘                   │  RULES    │   └───────────┘   └──────────────┘
     │                         └───────────┘
     │
     ▼
┌────────────────┐
│ DEBT_PAYMENTS  │
└────────────────┘

BUSINESS TIER:
┌────────┐         ┌──────────────┐         ┌───────────────┐
│ TEAMS  │─────────│ TEAM_MEMBERS │         │ BUSINESS_     │
└───┬────┘         └──────────────┘         │ INVOICES      │
    │                                       └───────────────┘
    │
    ├───────────────┬───────────────┐
    ▼               ▼               ▼
┌─────────┐   ┌───────────┐   ┌───────────┐
│  ROLES  │   │API_ACCESS │   │ WEBHOOKS  │
└─────────┘   └───────────┘   └───────────┘
```

---

# API ARCHITECTURE

## 6.1 API Structure

### Versioning Strategy
```
/api/v1/...  - Current stable version
/api/v2/...  - Next major version (when breaking changes)
/api/internal/... - Internal services
```

### Endpoint Organization
```python
API_ROUTES = {
    # Authentication
    "/api/v1/auth": {
        "login": "POST",
        "register": "POST",
        "logout": "POST",
        "refresh": "POST",
        "forgot_password": "POST",
        "reset_password": "POST",
        "verify_email": "POST",
        "google_callback": "GET",
        "apple_callback": "GET",
    },

    # User
    "/api/v1/users": {
        "me": "GET",
        "update": "PUT",
        "delete": "DELETE",
        "profile": "/api/v1/users/profile",
    },

    "/api/v1/users/profile": {
        "get": "GET",
        "update": "PUT",
        "suggestions": "GET",
    },

    # Accounts
    "/api/v1/accounts": {
        "list": "GET",
        "create": "POST",
        "batch_create": "POST /batch",
    },
    "/api/v1/accounts/{id}": {
        "get": "GET",
        "update": "PUT",
        "delete": "DELETE",
    },
    "/api/v1/accounts/{id}/sync": "POST",
    "/api/v1/accounts/summary": "GET",

    # Transactions
    "/api/v1/transactions": {
        "list": "GET",
        "create": "POST",
        "bulk_create": "POST /bulk",
        "import": "POST /import",
    },
    "/api/v1/transactions/{id}": {
        "get": "GET",
        "update": "PUT",
        "delete": "DELETE",
    },
    "/api/v1/transactions/{id}/categorize": "POST",
    "/api/v1/transactions/summary": "GET",
    "/api/v1/transactions/analytics": "GET",

    # Categories
    "/api/v1/categories": {
        "list": "GET",
        "create": "POST",
        "seed_defaults": "POST /seed",
    },
    "/api/v1/categories/{id}": {
        "get": "GET",
        "update": "PUT",
        "delete": "DELETE",
    },
    "/api/v1/categories/suggest": "GET",

    # Budgets
    "/api/v1/budgets": {
        "list": "GET",
        "create": "POST",
    },
    "/api/v1/budgets/{id}": {
        "get": "GET",
        "update": "PUT",
        "delete": "DELETE",
    },
    "/api/v1/budgets/{id}/progress": "GET",
    "/api/v1/budgets/summary": "GET",

    # Goals
    "/api/v1/goals": {
        "list": "GET",
        "create": "POST",
    },
    "/api/v1/goals/{id}": {
        "get": "GET",
        "update": "PUT",
        "delete": "DELETE",
    },
    "/api/v1/goals/{id}/contribute": "POST",
    "/api/v1/goals/{id}/milestones": "GET",
    "/api/v1/goals/summary": "GET",
    "/api/v1/goals/probability": "GET",

    # Debts
    "/api/v1/debts": {
        "list": "GET",
        "create": "POST",
    },
    "/api/v1/debts/{id}": {
        "get": "GET",
        "update": "PUT",
        "delete": "DELETE",
    },
    "/api/v1/debts/{id}/payment": "POST",
    "/api/v1/debts/{id}/schedule": "GET",
    "/api/v1/debts/summary": "GET",
    "/api/v1/debts/strategy": "GET",

    # Transfers
    "/api/v1/transfers": {
        "list": "GET",
        "create": "POST",
    },
    "/api/v1/transfers/{id}": {
        "get": "GET",
        "delete": "DELETE",
    },

    # Recurring
    "/api/v1/recurring": {
        "list": "GET",
        "create": "POST",
    },
    "/api/v1/recurring/{id}": {
        "get": "GET",
        "update": "PUT",
        "delete": "DELETE",
    },
    "/api/v1/recurring/{id}/generate": "POST",
    "/api/v1/recurring/generate-all": "POST",
    "/api/v1/recurring/upcoming": "GET",

    # Dashboard
    "/api/v1/dashboard": {
        "summary": "GET",
        "cash_flow": "GET",
        "category_breakdown": "GET",
        "recent_transactions": "GET",
        "upcoming_bills": "GET",
        "goal_progress": "GET",
    },

    # Analytics
    "/api/v1/analytics": {
        "spending_analysis": "GET",
        "income_analysis": "GET",
        "net_worth_history": "GET",
        "budget_comparison": "GET",
        "savings_rate": "GET",
        "financial_health": "GET",
        "trend_analysis": "GET",
    },

    # AI Advisor
    "/api/v1/ai": {
        "advice": "GET",
        "advice/{id}": "GET",
        "chat": "POST",
        "ask": "POST",
        "budget_recommendation": "GET",
        "spending_insights": "GET",
        "projection": "GET",
        "health_score": "GET",
    },

    # Integrations
    "/api/v1/integrations": {
        "list": "GET",
        "connect": "POST",
    },
    "/api/v1/integrations/bank": {
        "connect": "POST",
        "callback": "GET",
        "connections": "GET",
    },
    "/api/v1/integrations/bank/{id}": {
        "sync": "POST",
        "disconnect": "DELETE",
    },
    "/api/v1/integrations/ewallet": {...},
    "/api/v1/integrations/email": {...},
    "/api/v1/integrations/merchant": {...},

    # Scanner
    "/api/v1/scan": {
        "qris": "POST",
        "receipt": "POST",
    },
    "/api/v1/scan/{id}": "GET",

    # Parser
    "/api/v1/parser": {
        "text": "POST",
        "sms": "POST",
    },

    # Reports
    "/api/v1/reports": {
        "monthly": "GET",
        "yearly": "GET",
        "custom": "POST",
        "tax": "GET",
    },
    "/api/v1/reports/{id}/download": "GET",

    # Subscription
    "/api/v1/subscription": {
        "current": "GET",
        "upgrade": "POST",
        "downgrade": "POST",
        "cancel": "POST",
    },
    "/api/v1/subscription/invoices": "GET",

    # Team (Business)
    "/api/v1/team": {
        "info": "GET",
        "members": "GET",
        "invite": "POST",
    },
    "/api/v1/team/members/{id}": {
        "update": "PUT",
        "remove": "DELETE",
    },
    "/api/v1/team/invoices": {...},

    # API Access (Enterprise)
    "/api/v1/api-keys": {
        "list": "GET",
        "create": "POST",
    },
    "/api/v1/api-keys/{id}": {
        "revoke": "DELETE",
    },
    "/api/v1/webhooks": {...},

    # Export
    "/api/v1/export": {
        "transactions": "GET",
        "reports": "GET",
    },
}
```

## 6.2 Integration API Design

### Bank Sync Flow
```python
# 1. Initiate connection
# POST /api/v1/integrations/bank/connect
{
    "bank_id": "BCA",
    "account_mask": "1234567890",
    "redirect_uri": "finmanager://bank-callback/BCA"
}

# Response: Redirect to bank's OAuth
# https://oceanatmID.bca.co.id/oauth/authorize?... (example)

# 2. Callback handler
# GET /api/v1/integrations/bank/callback?code=xxx&state=xxx

# 3. Store tokens, trigger first sync
# Background job: sync_account_transactions(connection_id)

# 4. Get sync status
# GET /api/v1/integrations/bank/{connection_id}

# Response:
{
    "id": "uuid",
    "bank": "BCA",
    "status": "connected",
    "last_sync": "2026-10-16T10:30:00Z",
    "sync_status": "success",
    "transactions_synced": 47,
    "accounts": [
        {"id": "uuid", "name": "BCA Savings", "balance": 15000000}
    ]
}
```

### E-Wallet Sync Flow
```python
# Similar to bank but for e-wallets
# POST /api/v1/integrations/ewallet/connect
{
    "provider": "gopay",
    "phone": "81234567890"
}

# Response: OTP sent to phone
# POST /api/v1/integrations/ewallet/verify-otp
{
    "otp": "123456"
}

# Then sync transactions
```

### Email Parsing Flow
```python
# 1. Connect Gmail
# POST /api/v1/integrations/email/connect
# Redirects to Google OAuth

# 2. Callback stores tokens, starts sync
# Background job: scan_emails_for_transactions(user_id)

# 3. Get parsed transactions
# GET /api/v1/integrations/email/parsed
{
    "emails_parsed": 156,
    "transactions_found": 23,
    "pending_review": 5,
    "auto_categorized": 18,
    "latest": [
        {
            "id": "uuid",
            "subject": "Pembayaran GoPay...",
            "amount": 45000,
            "status": "pending_review",
            "action": "POST /api/v1/transactions"
        }
    ]
}
```

## 6.3 Webhook System
```python
# Register webhook
# POST /api/v1/webhooks
{
    "url": "https://your-server.com/webhook",
    "events": [
        "transaction.created",
        "budget.exceeded",
        "goal.milestone_reached"
    ]
}

# Webhook payload
{
    "event": "transaction.created",
    "timestamp": "2026-10-16T10:30:00Z",
    "data": {
        "transaction_id": "uuid",
        "amount": 150000,
        "type": "expense",
        "category": "Makanan & Minuman"
    },
    "signature": "sha256=xxx"  # For verification
}

# Verify signature
def verify_webhook(payload: bytes, signature: str, secret: str) -> bool:
    expected = hmac.new(secret.encode(), payload, sha256).hexdigest()
    return hmac.compare_digest(f"sha256={expected}", signature)
```

---

# STORAGE MANAGEMENT

## 7.1 File Storage Architecture

### Storage Providers
```python
STORAGE_PROVIDERS = {
    "supabase": {
        "type": "s3-compatible",
        "bucket": "finmanager-files",
        "path": "users/{user_id}/{type}/{date}/{filename}"
    },
    "local": {
        "type": "filesystem",
        "path": "/var/data/finmanager"
    }
}

FILE_TYPES = {
    "receipt": {
        "max_size_mb": 10,
        "allowed_formats": ["jpg", "jpeg", "png", "pdf"],
        "compression": True,
        "thumbnail": True
    },
    "export": {
        "max_size_mb": 100,
        "allowed_formats": ["csv", "xlsx", "pdf", "json"],
        "compression": True,
        "expiry_days": 7
    },
    "avatar": {
        "max_size_mb": 5,
        "allowed_formats": ["jpg", "jpeg", "png", "webp"],
        "thumbnail": True,
        "sizes": [32, 64, 128, 256]
    },
    "invoice_pdf": {
        "max_size_mb": 5,
        "allowed_formats": ["pdf"],
        "expiry_days": 365
    }
}
```

### Storage Model
```python
class FileStorage:
    """Manages file uploads with automatic optimization."""

    async def upload_receipt(
        user_id: UUID,
        file: UploadFile,
        metadata: dict
    ) -> StorageResult:
        """
        Upload receipt with compression and OCR processing.
        """
        # 1. Validate file
        validate_file(file, FILE_TYPES["receipt"])

        # 2. Compress image
        compressed = await self._compress_image(file)

        # 3. Generate thumbnail
        thumbnail = await self._generate_thumbnail(compressed)

        # 4. Upload to storage
        path = f"users/{user_id}/receipts/{date}/{uuid4()}.{ext}"
        url = await self.storage.upload(compressed, path)

        # 5. Create database record
        record = await self.db.receipt_scans.create({
            "user_id": user_id,
            "image_url": url,
            "status": "pending_ocr",
            "metadata": metadata
        })

        # 6. Queue OCR job
        await self.queue.enqueue("ocr_process", record.id)

        return StorageResult(
            id=record.id,
            url=url,
            thumbnail_url=thumbnail,
            status="processing"
        )

    async def generate_export(
        user_id: UUID,
        export_type: str,
        format: str
    ) -> StorageResult:
        """
        Generate and upload export file.
        """
        # 1. Generate file based on type
        if format == "csv":
            content = await self._generate_csv(user_id, export_type)
        elif format == "xlsx":
            content = await self._generate_xlsx(user_id, export_type)
        elif format == "pdf":
            content = await self._generate_pdf(user_id, export_type)

        # 2. Compress if large
        if len(content) > 10 * 1024 * 1024:  # 10MB
            content = await self._compress(content)

        # 3. Upload with expiry
        path = f"users/{user_id}/exports/{date}/{export_type}.{format}"
        url = await self.storage.upload(
            content,
            path,
            expires_in=7 * 24 * 3600  # 7 days
        )

        return StorageResult(
            url=url,
            expires_in=7 * 24 * 3600
        )
```

### Storage Usage Tracking
```python
class StorageUsage:
    """Track and limit storage per user based on subscription."""

    async def check_limit(user_id: UUID, file_size: int) -> bool:
        subscription = await self.get_subscription(user_id)
        usage = await self.calculate_usage(user_id)

        max_storage = SUBSCRIPTION_LIMITS[subscription.tier]["storage_mb"]
        max_bytes = max_storage * 1024 * 1024

        return (usage + file_size) <= max_bytes

    async def calculate_usage(user_id: UUID) -> int:
        """Calculate total storage used by user in bytes."""
        result = await self.db.execute("""
            SELECT SUM(size) FROM files WHERE user_id = ?
        """, user_id)
        return result.total_bytes
```

---

# LIBRARIES & EXTENSIONS

## 8.1 Backend Stack

### Core Dependencies
```python
# requirements.txt

# Web Framework
fastapi==0.109.0
uvicorn[standard]==0.27.0
python-multipart==0.0.6

# Database
sqlalchemy==2.0.25
asyncpg==0.29.0
alembic==1.13.1
psycopg2-binary==2.9.9

# Authentication
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
supabase==2.3.4
authlib==1.3.0

# External APIs
httpx==0.26.0
aiohttp==3.9.1
boto3==1.34.14

# AI/ML
openai==1.10.0
anthropic==0.8.1
langchain==0.1.4
langchain-community==0.0.10
chromadb==0.4.22

# OCR & Scanning
pytesseract==0.3.10
Pillow==10.2.0
pdf2image==1.16.3
opencv-python-headless==4.9.0.80

# Data Processing
pandas==2.2.0
numpy==1.26.3
python-dateutil==2.8.2

# Validation & Serialization
pydantic==2.5.3
pydantic-settings==2.1.0
email-validator==2.1.0

# File Processing
python-magic==0.4.27
aiofiles==23.2.1
python-multipart==0.0.6

# Background Jobs
celery==5.3.6
redis==5.0.1
flower==2.0.1

# Monitoring & Logging
structlog==24.1.0
sentry-sdk==1.40.4
prometheus-client==0.19.0

# Utilities
python-dotenv==1.0.0
orjson==3.9.12
cachetools==5.3.2
pydantic[email]==2.5.3
```

### Python Project Structure
```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI app entry
│   │
│   ├── api/
│   │   ├── __init__.py
│   │   ├── deps.py             # Dependencies (auth, db)
│   │   └── routes/
│   │       ├── __init__.py
│   │       ├── auth.py
│   │       ├── users.py
│   │       ├── accounts.py
│   │       ├── transactions.py
│   │       ├── categories.py
│   │       ├── budgets.py
│   │       ├── goals.py
│   │       ├── debts.py
│   │       ├── recurring.py
│   │       ├── transfers.py
│   │       ├── dashboard.py
│   │       ├── analytics.py
│   │       ├── ai_advisor.py
│   │       ├── integrations/
│   │       │   ├── __init__.py
│   │       │   ├── bank.py
│   │       │   ├── ewallet.py
│   │       │   ├── email.py
│   │       │   └── merchant.py
│   │       ├── scanner.py
│   │       ├── reports.py
│   │       ├── subscription.py
│   │       ├── team.py
│   │       └── webhooks.py
│   │
│   ├── core/
│   │   ├── __init__.py
│   │   ├── config.py            # Settings
│   │   ├── database.py          # DB connection
│   │   ├── security.py          # JWT, password hashing
│   │   ├── storage.py          # File storage
│   │   ├── queue.py            # Celery queue
│   │   └── events.py           # Event handlers
│   │
│   ├── models/
│   │   ├── __init__.py
│   │   ├── user.py
│   │   ├── account.py
│   │   ├── transaction.py
│   │   ├── category.py
│   │   ├── budget.py
│   │   ├── goal.py
│   │   ├── debt.py
│   │   ├── recurring.py
│   │   ├── transfer.py
│   │   ├── integration.py
│   │   ├── subscription.py
│   │   ├── team.py
│   │   └── ai_advice.py
│   │
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── user.py
│   │   ├── account.py
│   │   ├── transaction.py
│   │   └── ...
│   │
│   ├── services/
│   │   ├── __init__.py
│   │   ├── auth_service.py
│   │   ├── transaction_service.py
│   │   ├── sync_service.py      # Bank/ewallet sync
│   │   ├── ai_advisor/
│   │   │   ├── __init__.py
│   │   │   ├── advisor_engine.py
│   │   │   ├── spending_analyzer.py
│   │   │   ├── budget_advisor.py
│   │   │   ├── projection_engine.py
│   │   │   └── qa_service.py
│   │   ├── ocr_service.py
│   │   ├── email_parser.py
│   │   └── report_generator.py
│   │
│   ├── tasks/
│   │   ├── __init__.py
│   │   ├── sync_tasks.py         # Celery tasks
│   │   ├── ocr_tasks.py
│   │   ├── email_scan_tasks.py
│   │   └── notification_tasks.py
│   │
│   └── utils/
│       ├── __init__.py
│       ├── calculations.py       # Financial formulas
│       ├── formatters.py        # Currency, date
│       └── validators.py
│
├── tests/
│   ├── __init__.py
│   ├── conftest.py
│   ├── api/
│   ├── services/
│   └── integration/
│
├── alembic/
│   ├── versions/
│   └── env.py
│
├── celery_worker.py
├── celery_beat.py
├── requirements.txt
├── Dockerfile
└── docker-compose.yml
```

## 8.2 Frontend Stack

### Dependencies
```json
// package.json

{
  "dependencies": {
    // Core
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.22.0",

    // UI
    "@radix-ui/react-dialog": "^1.0.5",
    "@radix-ui/react-dropdown-menu": "^2.0.6",
    "@radix-ui/react-select": "^2.0.0",
    "@radix-ui/react-tabs": "^1.0.4",
    "@radix-ui/react-toast": "^1.1.5",
    "@radix-ui/react-tooltip": "^1.0.7",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.1",
    "tailwindcss-animate": "^1.0.7",

    // Styling
    "tailwindcss": "^3.4.1",
    "postcss": "^8.4.35",
    "autoprefixer": "^10.4.17",

    // Icons
    "lucide-react": "^0.323.0",

    // Charts
    "recharts": "^2.15.4",
    "chart.js": "^4.4.1",
    "react-chartjs-2": "^5.2.0",
    "lightweight-charts": "^5.2.1",

    // State Management
    "zustand": "^4.5.0",
    "react-query": "^5.24.0",
    "jotai": "^2.6.4",

    // Forms
    "react-hook-form": "^7.50.0",
    "@hookform/resolvers": "^3.3.4",
    "zod": "^3.22.4",

    // API
    "axios": "^1.6.7",
    "swr": "^2.2.4",

    // Database (local)
    "dexie": "^3.2.5",
    "dexie-react-hooks": "^1.1.7",

    // Auth
    "@supabase/supabase-js": "^2.39.0",

    // Date/Time
    "date-fns": "^3.3.1",
    "dayjs": "^1.11.10",

    // Money/Currency
    "dinero.js": "^2.0.0-alpha.14",
    "currency.js": "^2.0.4",

    // Media
    "html5-qrcode": "^2.3.8",
    "react-webcam": "^7.2.0",
    "tesseract.js": "^5.0.4",

    // Maps
    "leaflet": "^1.9.4",
    "react-leaflet": "^4.2.1",

    // Animations
    "framer-motion": "^11.0.3",
    "@react-spring/web": "^9.7.3",

    // Offline/PWA
    "workbox-window": "^7.0.0",
    "vite-plugin-pwa": "^0.19.0",

    // Utils
    "immer": "^10.0.3",
    "lodash-es": "^4.17.21"
  },

  "devDependencies": {
    "vite": "^5.1.0",
    "@vitejs/plugin-react": "^4.2.1",
    "typescript": "^5.3.3",
    "@types/react": "^18.2.55",
    "@types/react-dom": "^18.2.19",
    "eslint": "^8.56.0",
    "prettier": "^3.2.4",
    "husky": "^9.0.10",
    "lint-staged": "^15.2.0",
    "@playwright/test": "^1.41.2",
    "vitest": "^1.2.2"
  }
}
```

### Frontend Project Structure
```
frontend/
├── public/
│   ├── icons/                  # PWA icons
│   ├── manifest.json
│   └── robots.txt
│
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   │
│   ├── api/                    # API clients
│   │   ├── client.ts           # Axios instance
│   │   ├── auth.ts
│   │   ├── transactions.ts
│   │   ├── accounts.ts
│   │   ├── ai.ts
│   │   └── ...
│   │
│   ├── components/
│   │   ├── ui/                 # Base components (Radix-based)
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── dropdown-menu.tsx
│   │   │   ├── input.tsx
│   │   │   ├── select.tsx
│   │   │   ├── tabs.tsx
│   │   │   ├── toast.tsx
│   │   │   ├── tooltip.tsx
│   │   │   └── ...
│   │   │
│   │   ├── layout/
│   │   │   ├── main-layout.tsx
│   │   │   ├── sidebar.tsx
│   │   │   ├── header.tsx
│   │   │   └── mobile-nav.tsx
│   │   │
│   │   ├── dashboard/
│   │   │   ├── summary-cards.tsx
│   │   │   ├── cash-flow-chart.tsx
│   │   │   ├── category-breakdown.tsx
│   │   │   ├── recent-transactions.tsx
│   │   │   ├── goal-progress.tsx
│   │   │   └── ai-insight-card.tsx
│   │   │
│   │   ├── transactions/
│   │   │   ├── transaction-list.tsx
│   │   │   ├── transaction-form.tsx
│   │   │   ├── transaction-filters.tsx
│   │   │   └── transaction-detail.tsx
│   │   │
│   │   ├── ai-advisor/
│   │   │   ├── chat-interface.tsx
│   │   │   ├── advice-cards.tsx
│   │   │   ├── projection-chart.tsx
│   │   │   └── budget-recommendation.tsx
│   │   │
│   │   ├── scanner/
│   │   │   ├── qris-scanner.tsx
│   │   │   ├── receipt-capture.tsx
│   │   │   └── scan-result.tsx
│   │   │
│   │   └── charts/
│   │       ├── line-chart.tsx
│   │       ├── bar-chart.tsx
│   │       ├── pie-chart.tsx
│   │       ├── area-chart.tsx
│   │       └── goal-progress-chart.tsx
│   │
│   ├── pages/
│   │   ├── auth/
│   │   │   ├── login.tsx
│   │   │   ├── register.tsx
│   │   │   └── callback.tsx
│   │   │
│   │   ├── dashboard/
│   │   │   └── index.tsx
│   │   │
│   │   ├── transactions/
│   │   │   ├── index.tsx
│   │   │   └── [id].tsx
│   │   │
│   │   ├── accounts/
│   │   │   └── index.tsx
│   │   │
│   │   ├── budgets/
│   │   │   └── index.tsx
│   │   │
│   │   ├── goals/
│   │   │   └── index.tsx
│   │   │
│   │   ├── debts/
│   │   │   └── index.tsx
│   │   │
│   │   ├── advisor/
│   │   │   ├── index.tsx
│   │   │   └── chat.tsx
│   │   │
│   │   ├── integrations/
│   │   │   └── index.tsx
│   │   │
│   │   ├── reports/
│   │   │   ├── index.tsx
│   │   │   └── [type].tsx
│   │   │
│   │   ├── settings/
│   │   │   ├── index.tsx
│   │   │   ├── profile.tsx
│   │   │   ├── integrations.tsx
│   │   │   ├── subscription.tsx
│   │   │   └── notification.tsx
│   │   │
│   │   └── business/
│   │       ├── index.tsx
│   │       ├── team.tsx
│   │       ├── invoices.tsx
│   │       └── clients.tsx
│   │
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useTransactions.ts
│   │   ├── useAIAdvisor.ts
│   │   └── ...
│   │
│   ├── stores/
│   │   ├── auth-store.ts       # Zustand
│   │   ├── transaction-store.ts
│   │   └── ui-store.ts
│   │
│   ├── lib/
│   │   ├── supabase.ts
│   │   ├── utils.ts            # cn(), formatCurrency(), etc.
│   │   └── constants.ts
│   │
│   ├── types/
│   │   ├── api.ts
│   │   ├── models.ts
│   │   └── forms.ts
│   │
│   ├── i18n/
│   │   ├── index.ts
│   │   ├── id.ts               # Indonesian
│   │   ├── en.ts               # English
│   │   └── ja.ts               # Japanese
│   │
│   └── workers/
│       ├── sw.ts               # Service worker
│       └── sync.ts             # Background sync
│
├── components.json             # shadcn/ui config
├── tailwind.config.js
├── postcss.config.js
├── tsconfig.json
├── vite.config.ts
└── package.json
```

---

# REVENUE MODEL

## 9.1 Subscription Revenue

### Pricing Strategy
```python
PRICING_STRATEGY = {
    "psychological_pricing": {
        "monthly": [29000, 79000, 199000],  # End in 9
        "yearly": [290000, 690000, 1990000],  # Save 2 months
    },

    "geographic_pricing": {
        "tier1_cities": "full_price",      # Jakarta, Surabaya
        "tier2_cities": "full_price",      # Other major cities
        "tier3_cities": "discounted_20%",   # Smaller cities
        "rural": "discounted_40%"          # Villages
    },

    "promotional_pricing": {
        "first_year": "50% off",
        "student": "60% off (with .edu email)",
        "referral": "1 month free per referral"
    }
}
```

### Conversion Funnel
```
┌─────────────────────────────────────────────────────────────────────┐
│                     USER CONVERSION FUNNEL                          │
└─────────────────────────────────────────────────────────────────────┘

    ┌─────────────┐
    │   VISITORS  │  10,000/month
    └──────┬──────┘
           │  5% sign up
           ▼
    ┌─────────────┐
    │  FREE USERS │  500/month
    └──────┬──────┘
           │  20% activate (add accounts)
           ▼
    ┌─────────────┐
    │  ACTIVE     │  100/month
    │  FREE USERS │
    └──────┬──────┘
           │  10% convert
           ▼
    ┌─────────────┐
    │   PAYING    │  10/month
    │   USERS     │
    └──────┬──────┘
           │
           │ Monthly churn: 5%
           │ Annual churn: 30%
           │
           ▼
    ┌─────────────────────────────────────────┐
    │         REVENUE PROJECTIONS             │
    │                                          │
    │  Year 1:                                  │
    │    - Free users: 12,000                   │
    │    - Paying users: 120                   │
    │    - MRR: Rp 9.48M (avg Rp 79K/user)    │
    │    - ARR: Rp 113.76M                     │
    │                                          │
    │  Year 2:                                  │
    │    - Free users: 30,000                   │
    │    - Paying users: 400                   │
    │    - MRR: Rp 31.6M                       │
    │    - ARR: Rp 379.2M                      │
    │                                          │
    │  Year 3:                                  │
    │    - Free users: 60,000                   │
    │    - Paying users: 1,200                 │
    │    - MRR: Rp 94.8M                       │
    │    - ARR: Rp 1.14B                       │
    └─────────────────────────────────────────┘
```

## 9.2 B2B Revenue Streams

```python
B2B_REVENUE_STREAMS = {
    "accountants": {
        "target": "Tax accountants, financial advisors",
        "tier": "Business",
        "price": "Rp 199,000/month",
        "value_prop": "Manage multiple client finances, generate tax reports",
        "avg_client_count": 20,
        "potential_arpu": 199000 * 20 = 3.98M/team/month
    },

    "small_business": {
        "target": "Sole proprietors, freelancers",
        "tier": "Business",
        "price": "Rp 199,000/month",
        "value_prop": "Invoice generation, expense tracking, tax prep"
    },

    "enterprise": {
        "target": "Large companies with expense management",
        "tier": "Enterprise",
        "price": "Custom (Rp 5-50M/month)",
        "value_prop": "White-label, API access, dedicated support"
    }
}
```

## 9.3 Transaction & Partnership Revenue

```python
TRANSACTION_REVENUE = {
    "bank_sync_fee": {
        "description": "Fee for instant bank sync",
        "model": "per_transaction",
        "amount": "Rp 500 - 1,000 per transaction",
        "note": "Optional, free tier uses daily batch sync"
    },

    "premium_support": {
        "description": "Priority support for free users",
        "model": "one_time",
        "amount": "Rp 50,000"
    },

    "partnership_referral": {
        "description": "Revenue share from partner products",
        "model": "percentage",
        "partners": [
            "Bibit (investment platform)",
            "Ajaib (stock trading)",
            "Bluebird (transport)",
            "Gojek/Grab (ride-hailing)"
        ]
    }
}
```

---

# MARKET OPPORTUNITY

## 10.1 Target Market

```python
MARKET_SEGMENTS = {
    "primary": {
        "segment": "Young Professionals",
        "age": "22-35",
        "income": "Rp 5-20 juta/bulan",
        "count_indonesia": 15_000_000,
        "penetration_target": 0.02,  # 2%
        "target_users": 300_000,
        "willingness_to_pay": "Rp 29-79K/month"
    },

    "secondary": {
        "segment": "Small Business Owners",
        "age": "25-50",
        "income": "Rp 20-100 juta/bulan",
        "count_indonesia": 3_000_000,
        "penetration_target": 0.01,
        "target_users": 30_000,
        "willingness_to_pay": "Rp 199K/month"
    },

    "tertiary": {
        "segment": "Freelancers & Gig Workers",
        "age": "20-40",
        "income": "Variable, Rp 3-30 juta/bulan",
        "count_indonesia": 8_000_000,
        "penetration_target": 0.015,
        "target_users": 120_000,
        "willingness_to_pay": "Rp 29K/month"
    }
}

TOTAL_ADDRESSABLE_MARKET = {
    "users": 450_000,
    "arpu": 50_000,  # Blended average
    "sam": 22_500_000_000,  # Rp 22.5B/month = Rp 270B/year
}
```

## 10.2 Competitive Landscape

```python
COMPETITORS = {
    "local": {
        "money manager": {
            "type": "Direct competitor",
            "strength": "Local market focus",
            "weakness": "No AI, limited integrations"
        },
        "cebong money": {
            "type": "Direct competitor",
            "strength": "Simple UI",
            "weakness": "No bank sync, basic features"
        }
    },

    "global": {
        "mint": {
            "type": "Indirect competitor",
            "market": "US only",
            "note": "Not available in Indonesia"
        },
        "ynab": {
            "type": "Indirect competitor",
            "market": "US/UK",
            "note": "Subscription-only, expensive"
        },
        "copilot": {
            "type": "Indirect competitor",
            "market": "iOS only",
            "note": "No Indonesia support"
        }
    },

    "differentiators": {
        "finmanager_advantage": [
            "🇮🇩 Indonesia-first (Bahasa, lokal bank)",
            "🤖 AI-powered advice (contextual)",
            "📱 Multi-integration (GoPay, OVO, Shopee)",
            "💰 Affordable pricing (starts at Rp 29K)",
            "👥 Family & team features",
            "📊 Business features (invoice, tax)"
        ]
    }
}
```

---

# IMPLEMENTATION ROADMAP

## Phase 1: MVP Enhancement (Months 1-3)
- [ ] Complete current features (accounts, transactions, budgets, goals)
- [ ] Fix existing bugs
- [ ] Improve UI/UX
- [ ] Basic AI advisor (rule-based)

## Phase 2: Integration Hub (Months 4-6)
- [ ] Bank API integration (BCA, Mandiri, BRI as priority)
- [ ] E-wallet integration (GoPay, OVO)
- [ ] Email parser (Gmail)
- [ ] QRIS scanner

## Phase 3: AI Advisor (Months 7-9)
- [ ] ML-based spending categorization
- [ ] Personalized budget recommendations
- [ ] Financial health scoring
- [ ] Natural language Q&A

## Phase 4: Premium Features (Months 10-12)
- [ ] Subscription system
- [ ] Business tier
- [ ] Invoice generation
- [ ] Tax reports

## Phase 5: Scale (Year 2+)
- [ ] Enterprise tier
- [ ] API access
- [ ] White-label
- [ ] Market expansion (Southeast Asia)

---

# SUMMARY

**FinManager** adalah platform manajemen keuangan yang berbeda dari kompetitor karena:

1. **Integration-First**: Koneksi dengan bank, e-wallet, merchant Indonesia
2. **AI-Powered**: Advice berdasarkan konteks hidup user, bukan hanya angka
3. **Actionable**: Setiap insight disertai langkah konkret yang bisa diambil
4. **Affordable**: Mulai dari Rp 29K/bulan, accessible untuk semua kalangan

**Target**:
- 450,000 users dalam 3 tahun
- Rp 270B ARR di tahun ke-3
- Market leader di Indonesia untuk personal finance + AI

**Competitive Edge**:
- Tidak ada kompetitor lokal yang punya AI advisor kontekstual
- Integrasi ekosistem Indonesia (GoPay, OVO, Shopee) - sulit di-replicate
- Bahasa Indonesia native + lokal context

---

*Document Version: 1.0*
*Prepared for: Investor Presentation*
*Date: October 2026*
