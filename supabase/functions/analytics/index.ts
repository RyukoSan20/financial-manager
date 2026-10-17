// Analytics API - Expense breakdown, trends, insights
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
      case 'expense-breakdown':
        return await getExpenseBreakdown(supabase, userUuid, url);
      case 'income-breakdown':
        return await getIncomeBreakdown(supabase, userUuid, url);
      case 'trends':
        return await getTrends(supabase, userUuid, url);
      case 'insights':
        return await getInsights(supabase, userUuid);
      default:
        return errorResponse('Not found', 404);
    }
  } catch (err) {
    console.error('Analytics error:', err);
    return errorResponse(err.message || 'Internal error', 500);
  }
});

async function getExpenseBreakdown(supabase: any, userId: string, url: URL) {
  const months = parseInt(url.searchParams.get('months') || '1');
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months + 1);
  startDate.setDate(1);

  const { data, error } = await supabase
    .from('transactions')
    .select(`
      amount,
      category:categories(id, name, icon, color)
    `)
    .eq('user_id', userId)
    .eq('type', 'expense')
    .gte('date', startDate.toISOString().split('T')[0]);

  if (error) {
    return errorResponse(error.message);
  }

  // Group by category
  const breakdown: Record<string, { name: string; icon: string; color: string; amount: number; count: number }> = {};
  let total = 0;

  for (const tx of data || []) {
    const catId = tx.category?.id?.toString() || 'uncategorized';
    const catName = tx.category?.name || 'Uncategorized';
    const catIcon = tx.category?.icon || '📦';
    const catColor = tx.category?.color || '#607D8B';

    if (!breakdown[catId]) {
      breakdown[catId] = { name: catName, icon: catIcon, color: catColor, amount: 0, count: 0 };
    }
    breakdown[catId].amount += parseFloat(tx.amount);
    breakdown[catId].count += 1;
    total += parseFloat(tx.amount);
  }

  const result = Object.values(breakdown)
    .map(item => ({
      ...item,
      percentage: total > 0 ? (item.amount / total) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  return jsonResponse({
    total,
    categories: result,
    month_count: months,
  });
}

async function getIncomeBreakdown(supabase: any, userId: string, url: URL) {
  const months = parseInt(url.searchParams.get('months') || '1');
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months + 1);
  startDate.setDate(1);

  const { data, error } = await supabase
    .from('transactions')
    .select(`
      amount,
      category:categories(id, name, icon, color)
    `)
    .eq('user_id', userId)
    .eq('type', 'income')
    .gte('date', startDate.toISOString().split('T')[0]);

  if (error) {
    return errorResponse(error.message);
  }

  const breakdown: Record<string, { name: string; icon: string; color: string; amount: number; count: number }> = {};
  let total = 0;

  for (const tx of data || []) {
    const catId = tx.category?.id?.toString() || 'uncategorized';
    const catName = tx.category?.name || 'Uncategorized';
    const catIcon = tx.category?.icon || '💰';
    const catColor = tx.category?.color || '#4CAF50';

    if (!breakdown[catId]) {
      breakdown[catId] = { name: catName, icon: catIcon, color: catColor, amount: 0, count: 0 };
    }
    breakdown[catId].amount += parseFloat(tx.amount);
    breakdown[catId].count += 1;
    total += parseFloat(tx.amount);
  }

  const result = Object.values(breakdown)
    .map(item => ({
      ...item,
      percentage: total > 0 ? (item.amount / total) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  return jsonResponse({
    total,
    categories: result,
    month_count: months,
  });
}

async function getTrends(supabase: any, userId: string, url: URL) {
  const months = parseInt(url.searchParams.get('months') || '6');
  const result = [];

  for (let i = 0; i < months; i++) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const startDate = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
    const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];

    const { data: tx } = await supabase
      .from('transactions')
      .select('type, amount, date')
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate);

    let income = 0;
    let expense = 0;
    let incomeCount = 0;
    let expenseCount = 0;

    for (const t of tx || []) {
      if (t.type === 'income') {
        income += parseFloat(t.amount);
        incomeCount += 1;
      } else if (t.type === 'expense') {
        expense += parseFloat(t.amount);
        expenseCount += 1;
      }
    }

    result.push({
      month: date.toLocaleString('id-ID', { month: 'short', year: 'numeric' }),
      month_num: date.getMonth() + 1,
      year: date.getFullYear(),
      income,
      expense,
      net: income - expense,
      transaction_count: incomeCount + expenseCount,
      avg_income: incomeCount > 0 ? income / incomeCount : 0,
      avg_expense: expenseCount > 0 ? expense / expenseCount : 0,
    });
  }

  return jsonResponse(result.reverse());
}

async function getInsights(supabase: any, userId: string) {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const startOfPrevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().split('T')[0];
  const endOfPrevMonth = new Date(today.getFullYear(), today.getMonth(), 0).toISOString().split('T')[0];

  // This month
  const { data: thisMonth } = await supabase
    .from('transactions')
    .select('type, amount')
    .eq('user_id', userId)
    .gte('date', startOfMonth);

  // Previous month
  const { data: prevMonth } = await supabase
    .from('transactions')
    .select('type, amount')
    .eq('user_id', userId)
    .gte('date', startOfPrevMonth)
    .lte('date', endOfPrevMonth);

  // Top expense categories this month
  const { data: topExpenses } = await supabase
    .from('transactions')
    .select('amount, category:categories(name, icon)')
    .eq('user_id', userId)
    .eq('type', 'expense')
    .gte('date', startOfMonth)
    .order('amount', { ascending: false })
    .limit(5);

  let thisMonthIncome = 0;
  let thisMonthExpense = 0;
  let prevMonthIncome = 0;
  let prevMonthExpense = 0;

  for (const t of thisMonth || []) {
    if (t.type === 'income') thisMonthIncome += parseFloat(t.amount);
    else if (t.type === 'expense') thisMonthExpense += parseFloat(t.amount);
  }

  for (const t of prevMonth || []) {
    if (t.type === 'income') prevMonthIncome += parseFloat(t.amount);
    else if (t.type === 'expense') prevMonthExpense += parseFloat(t.amount);
  }

  const incomeChange = prevMonthIncome > 0 ? ((thisMonthIncome - prevMonthIncome) / prevMonthIncome) * 100 : 0;
  const expenseChange = prevMonthExpense > 0 ? ((thisMonthExpense - prevMonthExpense) / prevMonthExpense) * 100 : 0;

  return jsonResponse({
    this_month: {
      income: thisMonthIncome,
      expense: thisMonthExpense,
      net: thisMonthIncome - thisMonthExpense,
    },
    vs_last_month: {
      income_change: incomeChange,
      expense_change: expenseChange,
      income_trend: incomeChange > 0 ? 'up' : incomeChange < 0 ? 'down' : 'stable',
      expense_trend: expenseChange > 0 ? 'up' : expenseChange < 0 ? 'down' : 'stable',
    },
    top_expenses: topExpenses || [],
    savings_rate: thisMonthIncome > 0 ? ((thisMonthIncome - thisMonthExpense) / thisMonthIncome) * 100 : 0,
  });
}
