// Data export/import API
import { corsHeaders, jsonResponse, errorResponse, verifySimpleToken } from '../_shared/database.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return errorResponse('Unauthorized', 401);
    }

    const token = authHeader.slice(7);
    const userId = verifySimpleToken(token);
    if (!userId) {
      return errorResponse('Invalid token', 401);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: authUsers } = await supabase.auth.admin.listUsers();
    const authUser = authUsers?.users[userId - 1];
    const userUuid = authUser?.id;

    if (!userUuid) {
      return errorResponse('User not found', 404);
    }

    const url = new URL(req.url);
    const action = url.pathname.split('/').pop();

    switch (action) {
      case 'export':
        return await exportData(supabase, userUuid);
      case 'summary':
        return await getDataSummary(supabase, userUuid);
      default:
        return errorResponse('Not found', 404);
    }
  } catch (err) {
    console.error('Data error:', err);
    return errorResponse(err.message || 'Internal error', 500);
  }
});

async function exportData(supabase: any, userId: string) {
  // Fetch all user data
  const [accounts, categories, transactions, budgets, goals, debts, recurring] = await Promise.all([
    supabase.from('accounts').select('*').eq('user_id', userId),
    supabase.from('categories').select('*').eq('user_id', userId),
    supabase.from('transactions').select('*').eq('user_id', userId),
    supabase.from('budgets').select('*').eq('user_id', userId),
    supabase.from('goals').select('*').eq('user_id', userId),
    supabase.from('debts').select('*').eq('user_id', userId),
    supabase.from('recurring_rules').select('*').eq('user_id', userId),
  ]);

  const exportData = {
    exported_at: new Date().toISOString(),
    version: '1.0',
    data: {
      accounts: accounts.data || [],
      categories: categories.data || [],
      transactions: transactions.data || [],
      budgets: budgets.data || [],
      goals: goals.data || [],
      debts: debts.data || [],
      recurring_rules: recurring.data || [],
    },
  };

  return jsonResponse(exportData);
}

async function getDataSummary(supabase: any, userId: string) {
  const [accounts, transactions, goals, debts] = await Promise.all([
    supabase.from('accounts').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('is_archived', false),
    supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('goals').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('debts').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('is_paid_off', false),
  ]);

  return jsonResponse({
    accounts_count: accounts.count || 0,
    transactions_count: transactions.count || 0,
    goals_count: goals.count || 0,
    active_debts_count: debts.count || 0,
  });
}
