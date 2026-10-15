# FR-C04: Dashboard API URL Fix

## Metadata
- **Request ID:** FR-C04
- **Date Created:** 2026-10-14
- **Completed:** 2026-10-15
- **Requested By:** RyukoSan20
- **Status:** Completed

## Problem
Dashboard.jsx using `import.meta.env.VITE_API_URL` instead of centralized `API_BASE_URL` from services/api.js

## Root Cause
Line 360 in Dashboard.jsx used direct env var access:
```javascript
const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/dashboard/cash-flow?${params}`);
```

This bypassed the centralized API configuration and caused inconsistent API calls.

## Solution
1. Added export for `API_BASE_URL` in `frontend/src/services/api.js`
2. Updated Dashboard.jsx to import and use `API_BASE_URL`
3. Changed line 360 to use centralized URL

## Files Changed
- `frontend/src/services/api.js` - Added `export const API_BASE_URL`
- `frontend/src/pages/Dashboard.jsx` - Import and use `API_BASE_URL`

## Verification
Dashboard cash flow chart now loads correctly from `/api/dashboard/cash-flow`
