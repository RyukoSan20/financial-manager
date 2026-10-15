# FR-C02: AuthCallback Double /api Path

## Metadata
- **Request ID:** FR-C02
- **Date Created:** 2026-10-13
- **Completed:** 2026-10-15
- **Requested By:** RyukoSan20
- **Status:** Completed

## Problem
AuthCallback making request to `/api/api/supabase-exchange` causing 404

## Root Cause
AuthCallback.jsx line 36 used `${API_URL}/api/supabase-exchange` where API_URL was `/api`, resulting in double `/api/api/`

## Solution
Changed AuthCallback.jsx API_URL from `/api` to full Railway URL:
```javascript
const API_URL = 'https://fin-manager-production.up.railway.app';
```

## Files Changed
- `frontend/src/pages/AuthCallback.jsx`

## Error Before
```
POST https://frontend-wheat-two-86.vercel.app/api/api/supabase-exchange 404
Auth callback error: Token exchange failed: Not Found
```

## Error After
Request goes to correct URL: `https://fin-manager-production.up.railway.app/api/supabase-exchange`
