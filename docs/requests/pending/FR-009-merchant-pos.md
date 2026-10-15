# FR-009: Merchant POS & Automated Cashflow Pipeline

## Metadata
- **Request ID:** FR-009
- **Date Created:** 2026-10-15
- **Requested By:** RyukoSan20
- **Priority:** High
- **Status:** In Progress

## Request Summary
Fitur untuk Merchant/Toko Harian dengan pencatatan arus kas penjualan otomatis via QRIS webhook dan POS kasir cepat.

## Problem Statement
Pelaku usaha kecil (warung, kedai kopi, toko kelontong) butuh cara cepat mencatat penjualan tanpa ribet. Proses saat ini: buka app → klik tambah transaksi → isi form → save. Terlalu banyak langkah.

## Solution

### Flow 1: QRIS Webhook (Auto)
```
[Pelanggan Bayar via QRIS]
            │
            ▼
[POST /api/webhooks/qris]
            │
            ▼
[FastAPI Processing] → Auto-categorize: "Penjualan Toko"
            │
            ▼
[Supabase PostgreSQL] → Auto update Akun QRIS
            │
            ▼
[Real-time Dashboard Update]
```

### Flow 2: Quick POS (Manual)
```
[Halaman Toko / POS Mode]
        │
        ├──► Quick Amount Buttons (5k, 10k, 20k, 50k, 100k)
        │              │
        │              ▼
        │    [1-Tap Save] ──► Auto update Dashboard
        │
        └──► Voice Input: "Laku 5 kopi 75rb cash"
                   │
                   ▼
          [AI Parser] → Auto-fill form
```

## Implementation Status

### Backend ✅ Completed
- [x] `MERCHANTS` table model
- [x] `MERCHANT_PRODUCTS` table model  
- [x] `DAILY_SETTLEMENTS` table model
- [x] `/api/merchant/` - CRUD endpoints
- [x] `/api/merchant/{id}/summary` - Daily summary
- [x] `/api/merchant/quick-sale` - POS quick sale
- [x] `/api/merchant/{id}/products` - Product catalog
- [x] `/api/merchant/{id}/daily-settlement` - Daily close
- [x] `/api/webhooks/qris` - QRIS payment webhook
- [x] Transaction model: added `is_merchant`, `merchant_id`, `payment_method`, `reference_number`

### Frontend 🔄 In Progress
- [x] `merchantApi.js` - API client
- [x] `QuickPOSModal.jsx` - Kasir cepat component
- [x] `MerchantDashboardWidget.jsx` - Summary widget
- [x] `DailySettlementModal.jsx` - Tutup kasir UI
- [ ] `MerchantManager.jsx` - Full merchant management page
- [ ] Dashboard integration
- [ ] AI enhanced merchant parsing

## API Endpoints

```
POST   /api/merchant/                              # Create merchant
GET    /api/merchant/                             # List merchants
GET    /api/merchant/{id}                         # Get merchant
PUT    /api/merchant/{id}                         # Update merchant
DELETE /api/merchant/{id}                         # Delete merchant
GET    /api/merchant/{id}/summary                 # Daily summary
POST   /api/merchant/quick-sale                   # Quick POS sale
GET    /api/merchant/{id}/products               # List products
POST   /api/merchant/{id}/products               # Add product
POST   /api/merchant/{id}/daily-settlement       # Close day
GET    /api/merchant/{id}/settlements             # Settlement history

POST   /api/webhooks/qris                         # QRIS payment webhook
POST   /api/webhooks/qris-test                    # Test webhook
```

## Database Schema

### MERCHANTS
| Field | Type | Description |
|-------|------|-------------|
| id | INT | Primary key |
| user_id | INT | FK to users |
| store_name | VARCHAR | Nama toko |
| business_type | VARCHAR | grocery, food_stall, coffee_shop, etc |
| qris_merchant_id | VARCHAR | QRIS merchant ID |
| qris_enabled | BOOL | QRIS active |
| is_active | BOOL | Soft delete |

### MERCHANT_PRODUCTS
| Field | Type | Description |
|-------|------|-------------|
| id | INT | Primary key |
| merchant_id | INT | FK to merchants |
| name | VARCHAR | Product name |
| price | FLOAT | Selling price |
| cost_price | FLOAT | HPP |
| stock | INT | Stock qty |

### DAILY_SETTLEMENTS
| Field | Type | Description |
|-------|------|-------------|
| id | INT | Primary key |
| merchant_id | INT | FK to merchants |
| date | DATE | Settlement date |
| total_sales | FLOAT | Total revenue |
| total_qris_sales | FLOAT | QRIS revenue |
| total_cash_sales | FLOAT | Cash revenue |
| net_profit | FLOAT | Net profit |
| status | VARCHAR | pending/completed |

### TRANSACTIONS (Extended)
| Field | Type | Description |
|-------|------|-------------|
| is_merchant | BOOL | Is merchant transaction |
| merchant_id | INT | FK to merchants |
| payment_method | VARCHAR | QRIS, CASH, EDC |
| reference_number | VARCHAR | QRIS ref, receipt # |

## Next Steps
1. Integrate POS modal into Dashboard
2. Add "Toko" menu item in navigation
3. Create full MerchantManager page
4. AI enhancement: "Penjualan toko 500rb via QRIS"
5. Telegram/WhatsApp bot bridge
6. Auto daily cron settlement
