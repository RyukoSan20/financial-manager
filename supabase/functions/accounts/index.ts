// Accounts CRUD API
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
    const pathParts = url.pathname.split('/');
    const action = pathParts[pathParts.length - 1];

    switch (req.method) {
      case 'GET':
        if (action === 'balance') {
          return await getBalance(supabase, userUuid);
        }
        return await listAccounts(supabase, userUuid, url);
      case 'POST':
        return await createAccount(supabase, userUuid, req);
      case 'PUT':
        return await updateAccount(supabase, userUuid, req, url);
      case 'DELETE':
        return await deleteAccount(supabase, userUuid, req, url);
      default:
        return errorResponse('Method not allowed', 405);
    }
  } catch (err) {
    console.error('Accounts error:', err);
    return errorResponse(err.message || 'Internal error', 500);
  }
});

async function listAccounts(supabase: any, userId: string, url: URL) {
  const type = url.searchParams.get('type');
  const isArchived = url.searchParams.get('archived') === 'true';

  let query = supabase
    .from('accounts')
    .select('*')
    .eq('user_id', userId)
    .eq('is_archived', isArchived)
    .order('created_at', { ascending: false });

  if (type) {
    query = query.eq('type', type);
  }

  const { data, error } = await query;
  if (error) {
    return errorResponse(error.message);
  }

  return jsonResponse(data || []);
}

async function getBalance(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from('accounts')
    .select('type, balance, credit_limit')
    .eq('user_id', userId)
    .eq('is_archived', false);

  if (error) {
    return errorResponse(error.message);
  }

  let totalBalance = 0;
  let totalAssets = 0;
  let totalLiabilities = 0;

  for (const acc of data || []) {
    if (acc.type === 'credit_card' && acc.credit_limit) {
      const used = acc.credit_limit - acc.balance;
      totalLiabilities += Math.max(0, used);
      totalBalance -= Math.max(0, used);
    } else {
      totalBalance += parseFloat(acc.balance);
    }
    if (['cash', 'bank', 'e-wallet', 'investment'].includes(acc.type)) {
      totalAssets += parseFloat(acc.balance);
    }
  }

  return jsonResponse({
    total: totalBalance,
    assets: totalAssets,
    liabilities: totalLiabilities,
    accounts: data || [],
  });
}

async function createAccount(supabase: any, userId: string, req: Request) {
  const body = await getRequestBody<{
    name: string;
    type: string;
    balance?: number;
    currency?: string;
    icon?: string;
    color?: string;
    credit_limit?: number;
    bank_name?: string;
    account_number?: string;
    notes?: string;
  }>(req);

  if (!body.name || !body.type) {
    return errorResponse('Name and type are required');
  }

  const validTypes = ['cash', 'bank', 'e-wallet', 'credit_card', 'investment', 'other'];
  if (!validTypes.includes(body.type)) {
    return errorResponse('Invalid account type');
  }

  const { data, error } = await supabase
    .from('accounts')
    .insert({
      user_id: userId,
      name: body.name,
      type: body.type,
      balance: body.balance || 0,
      currency: body.currency || 'IDR',
      icon: body.icon || '💰',
      color: body.color || '#4CAF50',
      credit_limit: body.credit_limit,
      bank_name: body.bank_name,
      account_number: body.account_number,
      notes: body.notes,
    })
    .select()
    .single();

  if (error) {
    return errorResponse(error.message);
  }

  return jsonResponse(data, 201);
}

async function updateAccount(supabase: any, userId: string, req: Request, url: URL) {
  const id = parseInt(url.searchParams.get('id') || '0');
  if (!id) {
    return errorResponse('Account ID required');
  }

  const body = await getRequestBody<{
    name?: string;
    type?: string;
    balance?: number;
    currency?: string;
    icon?: string;
    color?: string;
    is_active?: boolean;
    is_archived?: boolean;
    credit_limit?: number;
    bank_name?: string;
    account_number?: string;
    notes?: string;
  }>(req);

  const { data, error } = await supabase
    .from('accounts')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    return errorResponse(error.message);
  }

  if (!data) {
    return errorResponse('Account not found', 404);
  }

  return jsonResponse(data);
}

async function deleteAccount(supabase: any, userId: string, req: Request, url: URL) {
  const id = parseInt(url.searchParams.get('id') || '0');
  if (!id) {
    return errorResponse('Account ID required');
  }

  // Check for linked transactions
  const { count } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('account_id', id);

  if (count && count > 0) {
    // Archive instead of delete
    await supabase
      .from('accounts')
      .update({ is_archived: true })
      .eq('id', id)
      .eq('user_id', userId);
    return jsonResponse({ message: 'Account archived (has linked transactions)' });
  }

  const { error } = await supabase
    .from('accounts')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    return errorResponse(error.message);
  }

  return jsonResponse({ message: 'Account deleted' });
}
