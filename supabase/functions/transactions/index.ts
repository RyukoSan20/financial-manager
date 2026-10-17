// Transactions CRUD API
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
        return await listTransactions(supabase, userUuid, url);
      case 'POST':
        return await createTransaction(supabase, userUuid, req);
      case 'PUT':
        return await updateTransaction(supabase, userUuid, req, id);
      case 'DELETE':
        return await deleteTransaction(supabase, userUuid, id);
      default:
        return errorResponse('Method not allowed', 405);
    }
  } catch (err) {
    console.error('Transactions error:', err);
    return errorResponse(err.message || 'Internal error', 500);
  }
});

async function listTransactions(supabase: any, userId: string, url: URL) {
  const {
    page = '1',
    limit = '20',
    type,
    account_id,
    category_id,
    start_date,
    end_date,
    search,
  } = Object.fromEntries(url.searchParams);

  let query = supabase
    .from('transactions')
    .select(`
      *,
      account:accounts(id, name, icon, color),
      category:categories(id, name, icon, color)
    `, { count: 'exact' })
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .range((parseInt(page) - 1) * parseInt(limit), parseInt(page) * parseInt(limit) - 1);

  if (type) query = query.eq('type', type);
  if (account_id) query = query.eq('account_id', parseInt(account_id));
  if (category_id) query = query.eq('category_id', parseInt(category_id));
  if (start_date) query = query.gte('date', start_date);
  if (end_date) query = query.lte('date', end_date);
  if (search) query = query.ilike('description', `%${search}%`);

  const { data, error, count } = await query;

  if (error) {
    return errorResponse(error.message);
  }

  return jsonResponse({
    data: data || [],
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: count || 0,
      total_pages: Math.ceil((count || 0) / parseInt(limit)),
    },
  });
}

async function createTransaction(supabase: any, userId: string, req: Request) {
  const body = await getRequestBody<{
    account_id: number;
    category_id?: number;
    type: string;
    amount: number;
    description?: string;
    notes?: string;
    date?: string;
    tags?: string[];
  }>(req);

  if (!body.account_id || !body.type || !body.amount) {
    return errorResponse('account_id, type, and amount are required');
  }

  if (!['income', 'expense', 'transfer'].includes(body.type)) {
    return errorResponse('Invalid transaction type');
  }

  // Verify account belongs to user
  const { data: account } = await supabase
    .from('accounts')
    .select('id, balance, type')
    .eq('id', body.account_id)
    .eq('user_id', userId)
    .single();

  if (!account) {
    return errorResponse('Account not found');
  }

  // Start transaction
  const { data: transaction, error: txError } = await supabase
    .from('transactions')
    .insert({
      user_id: userId,
      account_id: body.account_id,
      category_id: body.category_id || null,
      type: body.type,
      amount: body.amount,
      description: body.description || null,
      notes: body.notes || null,
      date: body.date || new Date().toISOString().split('T')[0],
      tags: body.tags || [],
    })
    .select()
    .single();

  if (txError) {
    return errorResponse(txError.message);
  }

  // Update account balance
  const balanceChange = body.type === 'expense' ? -body.amount : body.amount;
  await supabase
    .from('accounts')
    .update({ balance: account.balance + balanceChange })
    .eq('id', body.account_id);

  return jsonResponse(transaction, 201);
}

async function updateTransaction(supabase: any, userId: string, req: Request, id?: string | null) {
  if (!id) {
    return errorResponse('Transaction ID required');
  }

  const txId = parseInt(id);

  // Get existing transaction
  const { data: existing } = await supabase
    .from('transactions')
    .select('*, account:accounts(id, balance)')
    .eq('id', txId)
    .eq('user_id', userId)
    .single();

  if (!existing) {
    return errorResponse('Transaction not found', 404);
  }

  const body = await getRequestBody<{
    account_id?: number;
    category_id?: number;
    type?: string;
    amount?: number;
    description?: string;
    notes?: string;
    date?: string;
    tags?: string[];
  }>(req);

  // Revert old balance change
  const oldChange = existing.type === 'expense' ? -existing.amount : existing.amount;
  await supabase
    .from('accounts')
    .update({ balance: existing.account.balance - oldChange })
    .eq('id', existing.account_id);

  // Apply new transaction
  const newType = body.type || existing.type;
  const newAmount = body.amount || existing.amount;
  const newAccountId = body.account_id || existing.account_id;

  const { data: updated, error } = await supabase
    .from('transactions')
    .update({
      account_id: newAccountId,
      category_id: body.category_id !== undefined ? body.category_id : existing.category_id,
      type: newType,
      amount: newAmount,
      description: body.description !== undefined ? body.description : existing.description,
      notes: body.notes !== undefined ? body.notes : existing.notes,
      date: body.date || existing.date,
      tags: body.tags || existing.tags,
      updated_at: new Date().toISOString(),
    })
    .eq('id', txId)
    .select()
    .single();

  if (error) {
    return errorResponse(error.message);
  }

  // Update new account balance
  const { data: newAccount } = await supabase
    .from('accounts')
    .select('balance')
    .eq('id', newAccountId)
    .single();

  if (newAccount) {
    const newChange = newType === 'expense' ? -newAmount : newAmount;
    await supabase
      .from('accounts')
      .update({ balance: newAccount.balance + newChange })
      .eq('id', newAccountId);
  }

  return jsonResponse(updated);
}

async function deleteTransaction(supabase: any, userId: string, id?: string | null) {
  if (!id) {
    return errorResponse('Transaction ID required');
  }

  const txId = parseInt(id);

  // Get transaction with account
  const { data: existing } = await supabase
    .from('transactions')
    .select('*, account:accounts(id, balance)')
    .eq('id', txId)
    .eq('user_id', userId)
    .single();

  if (!existing) {
    return errorResponse('Transaction not found', 404);
  }

  // Revert balance change
  const balanceChange = existing.type === 'expense' ? existing.amount : -existing.amount;
  await supabase
    .from('accounts')
    .update({ balance: existing.account.balance + balanceChange })
    .eq('id', existing.account_id);

  // Delete transaction
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', txId);

  if (error) {
    return errorResponse(error.message);
  }

  return jsonResponse({ message: 'Transaction deleted' });
}
