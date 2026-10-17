// Dashboard API - Summary, cash flow, recent transactions
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
      case 'summary':
        return await getSummary(supabase, userUuid);
      case 'cash-flow':
        return await getCashFlow(supabase, userUuid, url);
      case 'recent':
        return await getRecentTransactions(supabase, userUuid);
      default:
        return errorResponse('Not found', 404);
    }
  } catch (err) {
    console.error('Dashboard error:', err);
    return errorResponse(err.message || 'Internal error', 500);
  }
});

async function getSummary(supabase: any, userId: string) {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay())).toISOString().split('T')[0];

  // Get accounts
  const { data: accounts } = await supabase
    .from('accounts')
    .select('type, balance, credit_limit')
    .eq('user_id', userId)
    .eq('is_archived', false);

  // Get this month transactions
  const { data: monthTx } = await supabase
    .from('transactions')
    .select('type, amount')
    .eq('user_id', userId)
    .gte('date', startOfMonth);

  // Get this week transactions
  const { data: weekTx } = await supabase
    .from('transactions')
    .select('type, amount')
    .eq('user_id', userId)
    .gte('date', startOfWeek);

  // Calculate totals
  let totalBalance = 0;
  let monthIncome = 0;
  let monthExpense = 0;
  let weekIncome = 0;
  let weekExpense = 0;

  for (const acc of accounts || []) {
    if (acc.type === 'credit_card' && acc.credit_limit) {
      const used = acc.credit_limit - acc.balance;
      totalBalance -= Math.max(0, used);
    } else {
      totalBalance += parseFloat(acc.balance);
    }
  }

  for (const tx of monthTx || []) {
    if (tx.type === 'income') monthIncome += parseFloat(tx.amount);
    else if (tx.type === 'expense') monthExpense += parseFloat(tx.amount);
  }

  for (const tx of weekTx || []) {
    if (tx.type === 'income') weekIncome += parseFloat(tx.amount);
    else if (tx.type === 'expense') weekExpense += parseFloat(tx.amount);
  }

  // Get upcoming recurring
  const { data: upcoming } = await supabase
    .from('recurring_rules')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .lte('next_due_date', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
    .order('next_due_date');

  return jsonResponse({
    total_balance: totalBalance,
    monthly: {
      income: monthIncome,
      expense: monthExpense,
      net: monthIncome - monthExpense,
    },
    weekly: {
      income: weekIncome,
      expense: weekExpense,
      net: weekIncome - weekExpense,
    },
    accounts_count: accounts?.length || 0,
    upcoming_recurring: upcoming || [],
  });
}

async function getCashFlow(supabase: any, userId: string, url: URL) {
  const months = parseInt(url.searchParams.get('months') || '6');
  const result = [];

  for (let i = 0; i < months; i++) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const startDate = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
    const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];

    const { data: tx } = await supabase
      .from('transactions')
      .select('type, amount')
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate);

    let income = 0;
    let expense = 0;

    for (const t of tx || []) {
      if (t.type === 'income') income += parseFloat(t.amount);
      else if (t.type === 'expense') expense += parseFloat(t.amount);
    }

    result.push({
      month: date.toLocaleString('id-ID', { month: 'short', year: 'numeric' }),
      income,
      expense,
      net: income - expense,
    });
  }

  return jsonResponse(result.reverse());
}

async function getRecentTransactions(supabase: any, userId: string) {
  const { data } = await supabase
    .from('transactions')
    .select(`
      *,
      account:accounts(id, name, icon, color),
      category:categories(id, name, icon, color)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);

  return jsonResponse(data || []);
}
