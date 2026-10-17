// Budgets CRUD API
import { corsHeaders, jsonResponse, errorResponse, getRequestBody, verifySimpleToken } from '../_shared/database.ts';
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
    const id = url.searchParams.get('id');

    switch (req.method) {
      case 'GET':
        if (id) {
          return await getBudget(supabase, userUuid, id);
        }
        return await listBudgets(supabase, userUuid);
      case 'POST':
        return await createBudget(supabase, userUuid, req);
      case 'PUT':
        return await updateBudget(supabase, userUuid, req, id);
      case 'DELETE':
        return await deleteBudget(supabase, userUuid, id);
      default:
        return errorResponse('Method not allowed', 405);
    }
  } catch (err) {
    console.error('Budgets error:', err);
    return errorResponse(err.message || 'Internal error', 500);
  }
});

async function listBudgets(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from('budgets')
    .select(`
      *,
      category:categories(id, name, icon, color)
    `)
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    return errorResponse(error.message);
  }

  // Calculate spent amount for each budget
  const budgets = await Promise.all((data || []).map(async (budget) => {
    const { start, end } = getBudgetPeriod(budget.period_type, budget.start_date);
    
    const { data: tx } = await supabase
      .from('transactions')
      .select('amount')
      .eq('user_id', userId)
      .eq('type', 'expense')
      .eq('category_id', budget.category_id)
      .gte('date', start)
      .lte('date', end);

    const spent = tx?.reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0;

    return {
      ...budget,
      spent,
      remaining: parseFloat(budget.amount) - spent,
      percent_used: budget.amount > 0 ? (spent / budget.amount) * 100 : 0,
    };
  }));

  return jsonResponse(budgets);
}

async function getBudget(supabase: any, userId: string, id: string) {
  const { data, error } = await supabase
    .from('budgets')
    .select(`
      *,
      category:categories(id, name, icon, color)
    `)
    .eq('id', parseInt(id))
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return errorResponse('Budget not found', 404);
  }

  const { start, end } = getBudgetPeriod(data.period_type, data.start_date);
  
  const { data: tx } = await supabase
    .from('transactions')
    .select('amount, date, description')
    .eq('user_id', userId)
    .eq('type', 'expense')
    .eq('category_id', data.category_id)
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: false });

  return jsonResponse({
    ...data,
    spent: tx?.reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0,
    transactions: tx || [],
  });
}

async function createBudget(supabase: any, userId: string, req: Request) {
  const body = await getRequestBody<{
    category_id: number;
    name: string;
    amount: number;
    period_type?: string;
    start_date?: string;
    end_date?: string;
  }>(req);

  if (!body.category_id || !body.name || !body.amount) {
    return errorResponse('category_id, name, and amount are required');
  }

  const { data, error } = await supabase
    .from('budgets')
    .insert({
      user_id: userId,
      category_id: body.category_id,
      name: body.name,
      amount: body.amount,
      period_type: body.period_type || 'monthly',
      start_date: body.start_date || new Date().toISOString().split('T')[0],
      end_date: body.end_date || null,
    })
    .select()
    .single();

  if (error) {
    return errorResponse(error.message);
  }

  return jsonResponse(data, 201);
}

async function updateBudget(supabase: any, userId: string, req: Request, id?: string | null) {
  if (!id) {
    return errorResponse('Budget ID required');
  }

  const body = await getRequestBody<{
    category_id?: number;
    name?: string;
    amount?: number;
    period_type?: string;
    start_date?: string;
    end_date?: string;
    is_active?: boolean;
  }>(req);

  const { data, error } = await supabase
    .from('budgets')
    .update(body)
    .eq('id', parseInt(id))
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    return errorResponse(error.message);
  }

  if (!data) {
    return errorResponse('Budget not found', 404);
  }

  return jsonResponse(data);
}

async function deleteBudget(supabase: any, userId: string, id?: string | null) {
  if (!id) {
    return errorResponse('Budget ID required');
  }

  const { error } = await supabase
    .from('budgets')
    .delete()
    .eq('id', parseInt(id))
    .eq('user_id', userId);

  if (error) {
    return errorResponse(error.message);
  }

  return jsonResponse({ message: 'Budget deleted' });
}

function getBudgetPeriod(periodType: string, startDate: string): { start: string; end: string } {
  const start = new Date(startDate);
  const today = new Date();
  let startStr: string;
  let endStr: string;

  switch (periodType) {
    case 'daily':
      startStr = today.toISOString().split('T')[0];
      endStr = startStr;
      break;
    case 'weekly':
      const dayOfWeek = today.getDay();
      startStr = new Date(today.setDate(today.getDate() - dayOfWeek)).toISOString().split('T')[0];
      endStr = new Date(today.setDate(today.getDate() + 6)).toISOString().split('T')[0];
      break;
    case 'yearly':
      startStr = `${today.getFullYear()}-01-01`;
      endStr = `${today.getFullYear()}-12-31`;
      break;
    default: // monthly
      startStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
      endStr = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
  }

  return { start: startStr, end: endStr };
}
