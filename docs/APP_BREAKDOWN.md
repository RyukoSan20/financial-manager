# Breakdown Aplikasi FinManager
**Generated:** 2026-10-26 · **Repo:** `~/financial-manager` · **Stack:** FastAPI + React (Vite) + PostgreSQL/Supabase

---

## 1. Arsitektur Umum

```
┌─────────────┐
│  Browser /  │   React SPA (Vite build) — PWA installable
│  PWA Mobile │
└──────┬──────┘
       │ HTTPS /api
┌──────▼──────────────────────────┐
│  Nginx (my-financial-manager.online) │
│  ├── /            → static React build │
│  └── /api/*       → uvicorn :8000      │
└──────┬──────────────────────────┘
       │
┌──────▼────────────────────────────────────────────┐
│  FastAPI app (backend/app/main.py)               │
│  middleware: Logging, CORS, ErrorInterceptor      │
│  ├── api/routes/*   → 40+ router files           │
│  ├── modules/*      → ledger, ai_advisor,        │
│  │                    ai_monitor, integrations    │
│  ├── services/*     → 70+ domain services        │
│  ├── models/*       → 25 SQLAlchemy models       │
│  ├── schemas/*      → Pydantic DTO               │
│  └── core/          → config, security, rbac,    │
│                      tenancy, kms, rate_limit,    │
│                      idempotency, telemetry       │
└──────┬────────────────────────────────────────────┘
       │
┌──────▼──────────────┐      ┌──────────────────────┐
│ PostgreSQL/Supabase │      │ External APIs        │
│ (SQLite utk lokal)   │      │ Gemini, Finnhub,     │
└─────────────────────┘      │ Ninjas, Exchange,    │
                             │ Google Maps, Supabase│
                             │ Auth, Zap-Ink        │
                             └──────────────────────┘
```

**Deploy:** VPS Hostinger `43.173.52.98` (`/opt/financial-manager`) → domain `my-financial-manager.online`. Railway/Vercel sudah deprecated. `VITE_API_URL=https://my-financial-manager.online/api`.

---

## 2. Flow Tree — Alur Pengguna

```
APP START
├── /login ─────► Login.jsx
│    ├── register ─► /register ─► Register.jsx
│    ├── Google OAuth ─► /auth/google/callback ─► AuthCallback.jsx ─► supabase-exchange ─► token
│    └── guest ─► POST /api/auth/guest ─► token (mode terbatas)
├── /auth/callback ─► AuthCallback.jsx (Supabase session → token)
│
└── (RequireAuth) ─► Layout (Sidebar / BottomNav)
     │
     ├── /add ─► AddTransactionPage (full-screen, "+" center button)
     │    ├── Quick Entry (NLP) ─► parseQuickEntry.js ─► isi form otomatis
     │    ├── Text Parser ─► /api/parser/parse-text
     │    ├── Receipt Scan ─► /api/scans/receipt ─► OCR → parser v3.1
     │    ├── QR Scan ─► /api/scans/qr
     │    ├── Voice ─► /api/voice ─► parseQuickEntry
     │    └── Manual form (pilih akun, kategori, tipe)
     │
     ├── /dashboard ─► Dashboard.jsx
     │    ├── Ringkasan saldo per akun
     │    ├── Cash-flow chart (Recharts)
     │    ├── Budget progress bar
     │    ├── Goal progress
     │    ├── Merchant widget
     │    └── ScanNotification (global overlay, draggable)
     │
     ├── /transactions ─► Transactions.jsx
     │    ├── Filter (periode, kategori, akun, tipe)
     │    ├── List + summary by-period / by-category
     │    ├── Edit / Delete
     │    └── Quick add inline
     │
     ├── /category-expenses ─► CategoryExpenses.jsx
     ├── /accounts ─► Accounts.jsx (tambah saldo, transfer antar akun)
     ├── /budgets ─► Budgets.jsx (limit per kategori, progress, sisa)
     ├── /goals ─► Goals.jsx (target, kontribusi, rencana dari gaji)
     ├── /debts ─► Debts.jsx (catat utang, bayar, riwayat)
     ├── /recurring ─► Recurring.jsx (transaksi berulang)
     ├── /calculators ─► Calculators.jsx (diskon, cicilan, bunga majemuk)
     ├── /analytics ─► Analytics.jsx (financial health, tren, breakdown)
     │
     ├── /merchant ─► MerchantManager.jsx (POS/kasir cepat, settlement harian)
     ├── /catalog ─► CatalogPage.jsx (katalog ikon + produk/merek yang dipelajari)
     ├── /map ─► MerchantMap.jsx (lokasi merchant & pola belanja)
     │
     ├── /shopping ─► ShoppingTracker.jsx (wishlist, harga)
     ├── /shopping/board ─► ShoppingBoard.jsx (Kanban belanja)
     ├── /kanban ─► ShoppingPage.jsx (modul ledger.shopping)
     │
     ├── /feed ─► FeedPage.jsx  ← REVIEW QUEUE (approve/reject/batch)
     │    ├── scan-receipt (submit struk → antrean)
     │    ├── /api/feed/pending, /all, /stats
     │    └── approve / reject / batch-approve
     │
     ├── /advisor ─► AIAdvisor.jsx  ← AI CHAT + AGENT
     │    ├── chat / chat-stream (SSE)
     │    ├── /api/ai/agent  → intent classify → plan → execute
     │    └── /api/ai/execute (langsung eksekusi aksi)
     │
     ├── /health-coach ─► HealthCoach.jsx (rasio keuangan + audit)
     ├── /gmail ─► GmailIntegration.jsx (+ /gmail/callback) — import email bank/e-commerce
     ├── /market ─► MarketPage.jsx (/api/market/summary, unified + intel + realtime)
     │
     ├── /profile/summary ─► ProfileSummary.jsx
     ├── /settings ─► Settings.jsx (shell)
     │    ├── /settings/profile ─► ProfileSettings.jsx
     │    ├── /settings/notifications ─► NotificationSettings.jsx
     │    ├── /settings/app ─► AppSettings.jsx
     │    └── /settings/appearance ─► Appearance.jsx (tema, accent, density, sync device)
     │
     └── /help ─► HelpSupport.jsx, /more ─► MorePage.jsx
```

---

## 3. Modul & Halaman Frontend

### 3.1 Halaman Inti
| Route | File | Fungsi |
|---|---|---|
| `/login` `/register` | Login/Register.jsx | Auth (email, Google, guest) |
| `/auth/callback` | AuthCallback.jsx | Tukar session Supabase → JWT app |
| `/` `/dashboard` | Dashboard.jsx | Ringkasan keuangan |
| `/transactions` | Transactions.jsx | CRUD transaksi + filter |
| `/category-expenses` | CategoryExpenses.jsx | Pengeluaran per kategori |
| `/accounts` | Accounts.jsx | Kartu, bank, e-wallet; saldo |
| `/budgets` | Budgets.jsx | Anggaran per kategori |
| `/goals` | Goals.jsx | Target tabungan |
| `/debts` | Debts.jsx | Utang & cicilan |
| `/recurring` | Recurring.jsx | Transaksi berulang |
| `/calculators` | Calculators.jsx | Kalkulator keuangan |
| `/analytics` | Analytics.jsx | Health score, tren |
| `/merchant` | MerchantManager.jsx | Kasir/POS merchant |
| `/catalog` | CatalogPage.jsx | Katalog produk & ikon |
| `/map` | MerchantMap.jsx | Peta lokasi belanja |
| `/shopping` `/shopping/board` `/kanban` | ShoppingTracker/ShoppingBoard/ShoppingPage | Belanja & wishlist |
| `/feed` | FeedPage.jsx | Antrean review transaksi |
| `/advisor` | AIAdvisor.jsx | AI advisor & agent |
| `/health-coach` | HealthCoach.jsx | Coach kesehatan keuangan |
| `/gmail` | GmailIntegration.jsx | Sinkronisasi email |
| `/market` | MarketPage.jsx | Data pasar keuangan |
| `/settings/*` | Settings/*.jsx | Profil, notifikasi, app, tampilan |
| `/add` | AddTransactionPage | Tambah transaksi full-screen |

### 3.2 Components
```
components/
├── layout/         Layout.jsx, Navigation.jsx (sidebar desktop + bottom nav mobile), UserProfileSection
├── common/         AIAssistant.jsx, BreakdownViewer.jsx, CurrencyInput/Badge,
│                    ProtectedRoute.jsx, ErrorBoundary.tsx
├── parser/         ReceiptScannerModal, QRScannerModal, TextParserModal,
│                    VoiceTransactionModal, ReceiptBreakdown, ScanDiagnostics, ScanNotification
├── merchant/       QuickPOSModal, DailySettlementModal, MerchantDashboardWidget
├── dashboard/ accounts/ budgets/ goals/ debts/ transactions/ calculators/ notifications/
├── ui/             Button, Card, PixelCard, PixelButton, PixelBadge, PixelProgress,
│                   Modal, Input, Select, Badge, Spinner, EmptyState, ProgressBar, StatCard
```

### 3.3 Feature modules (frontend)
- `features/transactions/nlp/` — parser cepat: `parseQuickEntry.js`, `parseAmount.js`, `normalize.js`, `fuzzyMatch.js`, `suggestCategory.js`, `data/seed-categories.js`, plus golden tests.
- `features/shopping/` — `useShoppingBoard.js` (state), `boardState.js`, `constants.js`, `api.js`, `components/{KanbanBoard,ActionSheet,ExpenseReport}.jsx`.

### 3.4 Infrastruktur frontend
- `contexts/` — ThemeContext, AuthContext, NotificationContext (plus `context/index.js`)
- `i18n/` — `en.js`, `id.js`, `ja.js`, `keys_batch1-3.js` → **3 bahasa** (EN/ID/JA)
- `utils/` — format, currency, i18n, theme, appearance, sanitize, categoryName
- `hooks/` — useApi, useSyncedPreference (cross-device sync)
- `services/` — api.js, merchantApi.js, scanManager.js
- `config/` — api.js (base URL), url.js

---

## 4. Backend — Routes (prefix `/api`)

| Prefix | File | Fungsi inti |
|---|---|---|
| `/api/auth` | auth.py | register, login, guest, google url/callback, me, change-password, password-strength, logout, supabase-exchange, settings/preferences |
| `/api/accounts` | accounts.py | CRUD rekening + total balance |
| `/api/categories` | categories.py | CRUD kategori, seed-defaults |
| `/api/transactions` | transactions.py | CRUD + summary by-period/by-category |
| `/api/transfers` | transfers.py | Transfer antar akun |
| `/api/budgets` | budgets.py | CRUD anggaran |
| `/api/recurring` | recurring.py | CRUD transaksi berulang |
| `/api/goals` | goals.py | CRUD target, contribute |
| `/api/breakdown` | breakdown.py | Pecah satu record jadi baris-baris (Gemini) |
| `/api/catalog` | catalog.py | Katalog produk/ikon |
| `/api/debts` | debts.py | Utang, pembayaran |
| `/api/analytics` | analytics.py | financial-health, cash-flow-trend, expense-breakdown |
| `/api/dashboard` | dashboard.py | summary, cash-flow |
| `/api/calculators` | calculators.py | discount, loan-payment, compound-interest |
| `/api/data` | data.py | Seed/import data |
| `/api/parser` | parser.py | direction, direction/feedback, parse-text, parse-receipt, parse-receipt-base64, confirm, detection-types, ocr-status, ocr-warmup, sample-texts |
| `/api/voice` | voice.py | Input suara → transaksi |
| `/api/profile` | profile.py | Profil & ringkasan |
| `/api/learning` | learning.py | Catatan belajar parser |
| `/api/scans` | scans.py | Scan struk & QR (job async: receipt, qr, get/cancel job) |
| `/api/ai` | ai_advisor.py | advice, summary, analyze-patterns, chat, chat/stream, tips, **agent**, **execute** |
| `/api/feed` | feed.py | scan-receipt, pending, all, stats, approve, reject, batch-approve |
| `/api/shopping` | shopping.py | Modul belanja (router legacy) |
| `/api/kanban` | kanban_board.py | Papan Kanban belanja |
| `/api/exchange` `/api/currency` | exchange.py, currency.py | Kurs & multi-currency |
| `/api/market` | market.py + unified_market.py | Ringkasan & intel pasar |
| `/api/finnhub` `/api/ninjas` | finnhub.py, ninjas.py | Data saham/berita |
| `/api/intel` | market_intel.py | Market intel |
| `/api/realtime` | realtime_market.py | Harga real-time |
| `/api/zap` | zap_ink.py | Notifikasi Zap-Ink |
| `/api/logs` | logs.py | Log aplikasi |
| `/api/merchant` | merchant.py | Data merchant + POS |
| `/api/location` | location.py | Geocode lokasi merchant |
| `/api/webhooks` | webhooks.py | Webhook masuk |
| `/api/settings` | user_settings.py | Preferensi pengguna (sync perangkat) |
| `/api/category-hints` | category_hints.py | Petunjuk kategori |
| `/api/search` | search.py | Pencarian produk |

### 4.1 Backend modules (pola domain-modular)
```
modules/
├── ledger/                 analytics_router+service, location/{models,router,normalizer}, shopping/{models,router,receipt_item_extractor}
├── ai_advisor/             router, llm_orchestrator/client, context_engine/pii_scrubber,
│                           engines/spending_analyzer, health_coach/{router,financial_ratios,audit_generator}
├── ai_monitor/             publisher, ai_agent_consumer, client_error_router
└── integrations/           base_connector, banks/snap_bi_auth,
                            email_parser/{gmail_oauth,gmail_router,email_poller,parser_registry,
                                          templates/{base,bca,gopay_ovo,e_commerce}}
```

---

## 5. Backend — Services (business logic)

**Inti keuangan**
- `calculation_service.py` + `calculation/formulas.py` — engine perhitungan (budget vs periode berbeda = budget berbeda)
- `currency.py`, `currency_rules.py`, `currency_totals.py` — multi-currency asli, konversi total
- `direction_classifier.py` — klasifikasi income vs expense (belajar dari feedback)
- `duration.py` — baca durasi tertulis ("3 tahun", "6 bulan")
- `number_parsing.py`, `item_parser.py`, `lexicon.py`, `validator.py`

**Parser / AI**
- `parser_engine.py` → `v2` → `v3` → `v31` (v3.1 = parser receipt produksi: normalisasi baris, footer boundary, diskon, tanggal, merchant)
- `parser_pipeline.py`, `parser_service.py`, `receipt_parser.py`, `receipt_service.py`, `receipt_breakdown.py`
- `generic_pipeline.py`, `hybrid_pipeline.py` (OCR + rule hybrid)
- `ocr_service.py`, `gemini_vision.py`, `gemini_client.py`, `image_preprocessor.py`
- `llm_structuring.py`, `dynamic_text_parser.py`, `dynamic_geometry.py`, `geometry_engine.py`
- `fuzzy_matcher.py`, `signature_matcher.py`, `merchant_classifier.py`, `confidence_engine.py`
- `ai_agent.py`, `ai_agent_executor.py` (add/delete transaction, set budget, allocate, set goal, build plan, set recurring, query*), `ai_plan_builder.py`, `intent_classifier.py`, `ai_advisor_service.py`
- `instruction_context.py`, `instructions.py`, `instruction_regression.py` (regresi prompt/instructions)

**Belanja & merchant**
- `shopping_pipeline.py`, `shopping_rules.py`, `catalog.py`, `catalog_service.py`, `catalog_learning.py`, `icon_catalog.py`
- `merchant_service.py`, `split_service.py`, `breakdown_service.py`, `transaction_breakdown.py`
- `anchor_engine.py` — memanchor breakdown ke record asli
- `recurring_generator.py`, `goal_breakdown.py`, `readiness.py`
- `geocoding_service.py`, `services/integrations/google_maps.py`
- `template_engine.py`, `services/config/vendor_templates.yaml`

---

## 6. Data Model (SQLAlchemy, 25 model)

| Model | Isi |
|---|---|
| `user.py` | User, preferensi, auth |
| `user_settings.py` | Setelan appearance/notification per user (sync lintas device) |
| `account.py` | Rekening/kartu/e-wallet + saldo |
| `transaction.py` | Transaksi inti (tipe, amount, tanggal, akun, kategori) |
| `transaction_item.py` | Baris/barang di dalam transaksi |
| `breakdown_item.py` | Hasil pecahan record (baris-level, dari Gemini) |
| `transfer.py` | Mutasi antar akun |
| `category.py` / `category_hint.py` | Kategori + petunjuk kategorisasi |
| `budget.py` | Anggaran + periode |
| `goal.py` | Target tabungan + kontribusi |
| `debt.py` | Utang + riwayat bayar |
| `recurring.py` | Aturan transaksi berulang |
| `receipt.py` | Metadata struk yang diparse |
| `scan_job.py` | Job scan async (OCR) |
| `shopping_item.py` | Item belanja/wishlist |
| `merchant.py` | Toko/merchant |
| `merchant_catalog.py` | Produk & harga per merchant |
| `catalog_icon.py` | Ikon katalog |
| `net_worth.py` | Snapshot"net worth |
| `learning_note.py` | Catatan belajar parser |
| `activity_log.py` | Audit trail aktivitas |
| `gmail_credentials.py` | Token Gmail user |
| `shopping (modules)` | Model ledger shopping & location |

---

## 7. Cross-cutting concerns (backend/app/core)

| File | Fungsi |
|---|---|
| `config.py` | Settings dari env (pydantic) |
| `database.py` | Engine, session, `init_db()`, `seed_categories()` |
| `security.py` | Hash password, JWT |
| `rbac.py` | Role-based access control |
| `tenancy.py` | Isolasi data per user |
| `kms_encryption.py` | Enkripsi field sensitif |
| `rate_limiter.py` / `rate_limit.py` | Rate limit (multi-request/detik) |
| `idempotency.py` | Cegah dobel-create |
| `audit_logger.py` | Audit log |
| `telemetry.py` | Telemetri |
| `error_interceptor.py` | Format error seragam |
| `storage.py` | Penyimpanan file |
| `http_client.py` | HTTP client bersama |

**Middleware:** `LoggingMiddleware` di `app/middleware/logging.py`.

---

## 8. Alur AI Agent (inti keunikan produk)

```
User message ("beli kopi 25rb pakai gopay", "hapus transaksi kemaren",
              "budget makan 2jt sebulan", "rencana 5jt dari gaji 8jt")
   │
   ▼
/api/ai/agent  (ai_advisor.py)
   │
   ├─► intent_classifier.py  → klasifikasi SEMUA klausa dalam pesan
   │                          (bukan hanya perintah pertama)
   ├─► ai_plan_builder.py    → AgentPlan (read + repair)
   │     └─► build_plan() : multi-clause plan
   └─► ai_agent_executor.py  → AgentExecutor(db, user_id)
         ├─ add_transaction()   (+_find_category_by_hint, _default_account, auto-create)
         ├─ delete_transaction()
         ├─ set_budget()        (+_period_bounds, durasi dari teks)
         ├─ allocate()
         ├─ set_savings_goal()
         ├─ build_plan()        (rencana dari durasi + income)
         ├─ set_recurring()
         └─ query_* (budgets, balance, expenses, goals, transactions)
   │
   ▼
execute_plan() → hasil + fallback ke AI Advisor bila gagal
```

**Query advisor dengan data nyata:** `2842441 feat: let the assistant answer with the data it has` — advisor tidak lagi berhalusinasi, membaca dari DB.

---

## 9. Pipeline Scan Struk (Receipt → Transaksi)

```
Foto struk / PDF / base64
   │
   ▼
/api/scans/receipt  (async job)
   ├─ image_preprocessor.py  (bersihkan, enhance)
   ├─ ocr_service.py        (ekstraksi teks)
   ├─ gemini_vision.py      (fallback vision OCR)
   ▼
parser_engine_v31.ReceiptParserV31
   ├─ normalize_receipt_line()
   ├─ parse_number_indonesia()   (1.234,56 → 1234.56)
   ├─ is_footer_boundary()       (hentikan di subtotal)
   ├─ parse_single_line_item()
   ├─ parse_discount_line()
   ├─ detect_merchant()
   └─ extract_date()
   │
   ▼
should_use_gemini_fallback_v31() → Gemini kalau confidence rendah
   │
   ▼
/api/feed/pending  →  antrean review (approve / reject / batch-approve)
   │
   ▼
Transaksi resmi dibuat di /api/transactions
```

Ada juga pipeline belanja (`modules/ledger/shopping/receipt_item_extractor.py`) dan breakdown Gemini (`5e98de9 Use Gemini for breakdowns instead of the fixed templates`).

---

## 10. Multi-currency & Localization

- **Currency:** `currency.py` + `currency_rules.py` + `currency_totals.py` — konversi real, `CurrencyInput`/`CurrencyBadge` di UI, "a hand written transaction counts towards the balance, and translate the rest".
- **i18n:** `en.js` / `id.js` / `ja.js` + `keys_batch1-3.js`, halaman sudah full translate (commit `de899b3`, `064e6cc`).
- **Tema:** ThemeContext + Appearance page (accent color, density, theme mode) + `useSyncedPreference` untuk sync antar device.

---

## 11. Feature Roadmap (dari docs/requests/pending)

| ID | Fitur |
|---|---|
| FR-001 | AI Assistant eksekusi aksi |
| FR-002 | Integrasi Maps |
| FR-003 | AI hapus transaksi |
| FR-004 | AI update transaksi |
| FR-005 | Export/import data |
| FR-006 | Laporan PDF |
| FR-007 | Notifikasi budget |
| FR-008 | Bank sync (Snap BI) |
| FR-009 | Merchant POS |

*(FR-003 & FR-004 sebagian sudah ada di `ai_agent_executor.py`: `delete_transaction`, `update`.)*

---

## 12. Testing & QA

- `qa_test.py` (14 KB), `qa_extended.py` (19 KB) — script QA end-to-end di root.
- `frontend/src/features/transactions/nlp/__tests__/` — `golden.test.js`, `fuzzy.test.js` (unit test NLP).
- `testocr/` — harness uji OCR.
- `sample/` — data contoh.
- `AUDIT_REPORT.md` (382 baris) — hasil audit sebelumnya.
- `docs/requests/completed/` — FR-C01..C04 yang sudah selesai (dashboard data real, auth callback double API, PWA icons, dashboard API URL).

---

## 13. Command & Konfigurasi

| File | Isi |
|---|---|
| `nginx.conf` | Reverse proxy + static serving + SSL |
| `docker/` + `docker-compose.yml` | Containerization (Postgres + api + web) |
| `Dockerfile` | Image backend |
| `railway.json`, `RAILWAY_SETUP.md` | Sisa dokumentasi Railway (deprecated) |
| `vercel.json`, `.vercel/` | Sisa config Vercel (deprecated) |
| `scripts/` | Deploy/migration scripts terbaru |
| `start-local*.sh`, `setup-local.sh` | Menjalankan stack lokal |
| `.env.example` | Template env backend |
| `supabase/` | Konfigurasi Supabase (migrasi SQL) |
| `backend/migrations/` | Migration: user_settings, shopping_pipeline, merchant_catalog |

**Domain produksi:** `my-financial-manager.online` · VPS `43.173.52.98` · user `ubuntu` · app di `/opt/financial-manager`.

---

## 14. Ringkasan Executor

Aplikasi ini **bukan** sekadar CRUD keuangan. Empat lapisan pembeda:

1. **Pipeline input multimodal** — teks, suara, foto struk, QR, email bank → transaksi terstruktur, dengan fallback Gemini saat confidence rendah dan antrean review manusia (`/feed`).
2. **AI agent yang benar-benar menulis ke DB** — classify intent → plan → execute aksi (tambah/hapus transaksi, set budget, alokasi, goal, rencana, recurring), bukan sekadar chat.
3. **Multi-currency & localization nyata** — konversi currency, 3 bahasa (EN/ID/JA), tema + appearance yang sync antar device.
4. **Domain merchandising** — katalog produk, merchant/POS, settlement harian, papan Kanban belanja, peta lokasi, dan learning loop (kategori dipelajari dari feedback, produk dipelajari dari struk).

Semua di atas dilayani **satu FastAPI monolith** dengan pemisahan `routes / modules / services / models / schemas / core`, plus React SPA dengan routing per halaman dan sistem `ui/` yang konsisten.
