# Supabase Edge Functions Setup

## Prerequisites
1. Supabase CLI installed: `npm install -g supabase`
2. Supabase project created at https://supabase.com

## Setup Steps

### 1. Login to Supabase
```bash
cd financial-manager/supabase
supabase login
```

### 2. Link to your project
```bash
supabase link --project-ref YOUR_PROJECT_REF
```
Get your project ref from: https://supabase.com/dashboard/project/YOUR_PROJECT_REF

### 3. Run database migration
```bash
supabase db push
```
Or paste the SQL from `migrations/001_financial_manager_schema.sql` into Supabase SQL Editor.

### 4. Deploy Edge Functions
```bash
supabase functions deploy auth
supabase functions deploy accounts
supabase functions deploy categories
supabase functions deploy transactions
supabase functions deploy transfers
supabase functions deploy budgets
supabase functions deploy recurring
supabase functions deploy goals
supabase functions deploy debts
supabase functions deploy analytics
supabase functions deploy dashboard
supabase functions deploy calculators
supabase functions deploy data
supabase functions deploy health
```

Or deploy all at once:
```bash
supabase functions deploy --no-verify-jwt
```

### 5. Set secrets (if needed)
```bash
supabase secrets set SOME_API_KEY=your_key
```

## API Endpoints

After deployment, your functions will be available at:
- `https://YOUR_PROJECT.supabase.co/functions/v1/auth`
- `https://YOUR_PROJECT.supabase.co/functions/v1/accounts`
- `https://YOUR_PROJECT.supabase.co/functions/v1/categories`
- etc.

## Frontend Integration

Update `frontend/src/lib/api.ts` to use Supabase Edge Functions:

```typescript
const SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;

const api = {
  request: async (endpoint, options = {}) => {
    const token = localStorage.getItem('token');
    const res = await fetch(`${FUNCTIONS_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
        ...options.headers,
      },
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  // ... rest of API methods
};
```

## Testing

Test locally:
```bash
supabase functions serve auth --env-file .env.local
```

Test deployed function:
```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```
