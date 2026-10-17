// Transfers API
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
          return await getTransfer(supabase, userUuid, id);
        }
        return await listTransfers(supabase, userUuid, url);
      case 'POST':
        return await createTransfer(supabase, userUuid, req);
      case 'DELETE':
        return await deleteTransfer(supabase, userUuid, id);
      default:
        return errorResponse('Method not allowed', 405);
    }
  } catch (err) {
    console.error('Transfers error:', err);
    return errorResponse(err.message || 'Internal error', 500);
  }
});

async function listTransfers(supabase: any, userId: string, url: URL) {
  const page = url.searchParams.get('page') || '1';
  const limit = url.searchParams.get('limit') || '20';

  const { data, error, count } = await supabase
    .from('transfers')
    .select(`
      *,
      from_account:accounts!from_account_id(id, name, icon, color),
      to_account:accounts!to_account_id(id, name, icon, color)
    `, { count: 'exact' })
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .range((parseInt(page) - 1) * parseInt(limit), parseInt(page) * parseInt(limit) - 1);

  if (error) {
    return errorResponse(error.message);
  }

  return jsonResponse({
    data: data || [],
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: count || 0,
    },
  });
}

async function getTransfer(supabase: any, userId: string, id: string) {
  const { data, error } = await supabase
    .from('transfers')
    .select(`
      *,
      from_account:accounts!from_account_id(id, name, icon, color),
      to_account:accounts!to_account_id(id, name, icon, color)
    `)
    .eq('id', parseInt(id))
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return errorResponse('Transfer not found', 404);
  }

  return jsonResponse(data);
}

async function createTransfer(supabase: any, userId: string, req: Request) {
  const body = await getRequestBody<{
    from_account_id: number;
    to_account_id: number;
    amount: number;
    fee?: number;
    description?: string;
    date?: string;
  }>(req);

  if (!body.from_account_id || !body.to_account_id || !body.amount) {
    return errorResponse('from_account_id, to_account_id, and amount are required');
  }

  if (body.from_account_id === body.to_account_id) {
    return errorResponse('Cannot transfer to same account');
  }

  // Get accounts
  const { data: fromAccount } = await supabase
    .from('accounts')
    .select('id, balance, name')
    .eq('id', body.from_account_id)
    .eq('user_id', userId)
    .single();

  const { data: toAccount } = await supabase
    .from('accounts')
    .select('id, balance, name')
    .eq('id', body.to_account_id)
    .eq('user_id', userId)
    .single();

  if (!fromAccount || !toAccount) {
    return errorResponse('Account not found');
  }

  const transferAmount = body.amount;
  const fee = body.fee || 0;
  const totalDeduction = transferAmount + fee;

  if (parseFloat(fromAccount.balance) < totalDeduction) {
    return errorResponse('Insufficient balance');
  }

  // Create transfer
  const { data: transfer, error } = await supabase
    .from('transfers')
    .insert({
      user_id: userId,
      from_account_id: body.from_account_id,
      to_account_id: body.to_account_id,
      amount: transferAmount,
      fee,
      description: body.description || null,
      date: body.date || new Date().toISOString().split('T')[0],
    })
    .select()
    .single();

  if (error) {
    return errorResponse(error.message);
  }

  // Update balances
  await supabase
    .from('accounts')
    .update({ balance: parseFloat(fromAccount.balance) - totalDeduction })
    .eq('id', body.from_account_id);

  await supabase
    .from('accounts')
    .update({ balance: parseFloat(toAccount.balance) + transferAmount })
    .eq('id', body.to_account_id);

  return jsonResponse({
    ...transfer,
    from_account: fromAccount,
    to_account: toAccount,
  }, 201);
}

async function deleteTransfer(supabase: any, userId: string, id?: string | null) {
  if (!id) {
    return errorResponse('Transfer ID required');
  }

  // Get transfer
  const { data: transfer } = await supabase
    .from('transfers')
    .select('*, from_account:accounts!from_account_id(balance), to_account:accounts!to_account_id(balance)')
    .eq('id', parseInt(id))
    .eq('user_id', userId)
    .single();

  if (!transfer) {
    return errorResponse('Transfer not found', 404);
  }

  // Revert balances
  const totalDeduction = parseFloat(transfer.amount) + parseFloat(transfer.fee || 0);

  await supabase
    .from('accounts')
    .update({ balance: parseFloat(transfer.from_account.balance) + totalDeduction })
    .eq('id', transfer.from_account_id);

  await supabase
    .from('accounts')
    .update({ balance: parseFloat(transfer.to_account.balance) - parseFloat(transfer.amount) })
    .eq('id', transfer.to_account_id);

  // Delete transfer
  await supabase
    .from('transfers')
    .delete()
    .eq('id', parseInt(id));

  return jsonResponse({ message: 'Transfer reversed and deleted' });
}
