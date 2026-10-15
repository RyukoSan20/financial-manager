# FR-C01: Dashboard Data Real (NOT Hardcoded)

## Metadata
- **Request ID:** FR-C01
- **Date Created:** 2026-10-14
- **Completed:** 2026-10-15
- **Requested By:** RyukoSan20
- **Status:** Completed

## Problem
Dashboard showing hardcoded values: Total Saldo Rp 8.670.000, Arus Kas Rp -1.430.000, Pemasukan Rp 0, Pengeluaran Rp 0

## Root Cause
Dashboard.jsx fetching from wrong endpoint `/realtime/summary` (stock/crypto data) instead of `/api/dashboard/summary`

## Solution
1. Fixed Dashboard.jsx to use `API_BASE_URL` from services/api.js
2. Changed line 360 from `import.meta.env.VITE_API_URL` to `API_BASE_URL`
3. Added proper import: `import api, { API_BASE_URL } from '../services/api'`
4. Exported `API_BASE_URL` from api.js

## Files Changed
- `frontend/src/pages/Dashboard.jsx`
- `frontend/src/services/api.js`

## Verification
Dashboard now shows real data:
- Total Saldo: Rp 8.670.000 (from DB)
- Pemasukan: Rp 20.000 (from DB)
- Pengeluaran: Rp 1.450.000 (from DB)
