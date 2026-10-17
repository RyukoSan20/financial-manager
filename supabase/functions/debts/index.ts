// Debts CRUD API
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
    const pathParts = url.pathname.split('/');
    const action = pathParts[pathParts.length - 1];

    switch (req.method) {
      case 'GET':
        if (action === 'payments' && id) {
          return await getPayments(supabase, userUuid, id);
        }
        if (id) {
          return await getDebt(supabase, userUuid, id);
        }
        return await listDebts(supabase, userUuid);
      case 'POST':
        if (action === 'payment') {
          return await addPayment(supabase, userUuid, req);
        }
        return await createDebt(supabase, userUuid, req);
      case 'PUT':
        return await updateDebt(supabase, userUuid, req, id);
      case 'DELETE':
        return await deleteDebt(supabase, userUuid, id);
      default:
        return errorResponse('Method not allowed', 405);
    }
  } catch (err) {
    console.error('Debts error:', err);
    return errorResponse(err.message || 'Internal error', 500);
  }
});

async function listDebts(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from('debts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    return errorResponse(error.message);
  }

  const debts = (data || []).map(debt => ({
    ...debt,
    paid_amount: parseFloat(debt.original_amount) - parseFloat(debt.remaining_amount),
    progress: debt.original_amount > 0 
      ? ((parseFloat(debt.original_amount) - parseFloat(debt.remaining_amount)) / parseFloat(debt.original_amount)) * 100 
      : 0,
  }));

  return jsonResponse(debts);
}

async function getDebt(supabase: any, userId: string, id: string) {
  const { data, error } = await supabase
    .from('debts')
    .select('*')
    .eq('id', parseInt(id))
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return errorResponse('Debt not found', 404);
  }

  const { data: payments } = await supabase
    .from('debt_payments')
    .select('*')
    .eq('debt_id', parseInt(id))
    .eq('user_id', userId)
    .order('date', { ascending: false });

  return jsonResponse({
    ...data,
    paid_amount: parseFloat(data.original_amount) - parseFloat(data.remaining_amount),
    progress: data.original_amount > 0 
      ? ((parseFloat(data.original_amount) - parseFloat(data.remaining_amount)) / parseFloat(data.original_amount)) * 100 
      : 0,
    payments: payments || [],
  });
}

async function createDebt(supabase: any, userId: string, req: Request) {
  const body = await getRequestBody<{
    name: string;
    type: string;
    creditor?: string;
    original_amount: number;
    interest_rate?: number;
    start_date?: string;
    due_date?: string;
    installment_amount?: number;
    installments_count?: number;
    notes?: string;
  }>(req);

  if (!body.name || !body.type || !body.original_amount) {
    return errorResponse('Name, type, and original_amount are required');
  }

  const { data, error } = await supabase
    .from('debts')
    .insert({
      user_id: userId,
      name: body.name,
      type: body.type,
      creditor: body.creditor || null,
      original_amount: body.original_amount,
      remaining_amount: body.original_amount,
      interest_rate: body.interest_rate || 0,
      start_date: body.start_date || new Date().toISOString().split('T')[0],
      due_date: body.due_date || null,
      installment_amount: body.installment_amount || null,
      installments_count: body.installments_count || null,
      notes: body.notes || null,
    })
    .select()
    .single();

  if (error) {
    return errorResponse(error.message);
  }

  return jsonResponse(data, 201);
}

async function updateDebt(supabase: any, userId: string, req: Request, id?: string | null) {
  if (!id) {
    return errorResponse('Debt ID required');
  }

  const body = await getRequestBody<{
    name?: string;
    type?: string;
    creditor?: string;
    remaining_amount?: number;
    interest_rate?: number;
    due_date?: string;
    is_paid_off?: boolean;
    notes?: string;
  }>(req);

  const { data, error } = await supabase
    .from('debts')
    .update({
      ...body,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parseInt(id))
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    return errorResponse(error.message);
  }

  if (!data) {
    return errorResponse('Debt not found', 404);
  }

  return jsonResponse(data);
}

async function deleteDebt(supabase: any, userId: string, id?: string | null) {
  if (!id) {
    return errorResponse('Debt ID required');
  }

  const { error } = await supabase
    .from('debts')
    .delete()
    .eq('id', parseInt(id))
    .eq('user_id', userId);

  if (error) {
    return errorResponse(error.message);
  }

  return jsonResponse({ message: 'Debt deleted' });
}

async function addPayment(supabase: any, userId: string, req: Request) {
  const body = await getRequestBody<{
    debt_id: number;
    amount: number;
    date?: string;
    notes?: string;
  }>(req);

  if (!body.debt_id || !body.amount) {
    return errorResponse('debt_id and amount are required');
  }

  // Get debt
  const { data: debt, error: debtError } = await supabase
    .from('debts')
    .select('id, remaining_amount, original_amount, installments_paid')
    .eq('id', body.debt_id)
    .eq('user_id', userId)
    .single();

  if (debtError || !debt) {
    return errorResponse('Debt not found', 404);
  }

  // Add payment
  const { data: payment, error: paymentError } = await supabase
    .from('debt_payments')
    .insert({
      debt_id: body.debt_id,
      user_id: userId,
      amount: body.amount,
      date: body.date || new Date().toISOString().split('T')[0],
      notes: body.notes || null,
    })
    .select()
    .single();

  if (paymentError) {
    return errorResponse(paymentError.message);
  }

  // Update debt
  const newRemaining = Math.max(0, parseFloat(debt.remaining_amount) - body.amount);
  const isPaidOff = newRemaining <= 0;

  await supabase
    .from('debts')
    .update({
      remaining_amount: newRemaining,
      installments_paid: (debt.installments_paid || 0) + 1,
      is_paid_off: isPaidOff,
      updated_at: new Date().toISOString(),
    })
    .eq('id', body.debt_id);

  return jsonResponse({
    payment,
    debt: {
      ...debt,
      remaining_amount: newRemaining,
      is_paid_off: isPaidOff,
    },
  }, 201);
}

async function getPayments(supabase: any, userId: string, debtId: string) {
  const { data, error } = await supabase
    .from('debt_payments')
    .select('*')
    .eq('debt_id', parseInt(debtId))
    .eq('user_id', userId)
    .order('date', { ascending: false });

  if (error) {
    return errorResponse(error.message);
  }

  return jsonResponse(data || []);
}
