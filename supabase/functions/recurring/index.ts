// Recurring Rules API
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
          return await getRule(supabase, userUuid, id);
        }
        return await listRules(supabase, userUuid);
      case 'POST':
        return await createRule(supabase, userUuid, req);
      case 'PUT':
        return await updateRule(supabase, userUuid, req, id);
      case 'DELETE':
        return await deleteRule(supabase, userUuid, id);
      default:
        return errorResponse('Method not allowed', 405);
    }
  } catch (err) {
    console.error('Recurring error:', err);
    return errorResponse(err.message || 'Internal error', 500);
  }
});

async function listRules(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from('recurring_rules')
    .select(`
      *,
      account:accounts(id, name, icon),
      category:categories(id, name, icon)
    `)
    .eq('user_id', userId)
    .order('next_due_date');

  if (error) {
    return errorResponse(error.message);
  }

  return jsonResponse(data || []);
}

async function getRule(supabase: any, userId: string, id: string) {
  const { data, error } = await supabase
    .from('recurring_rules')
    .select(`
      *,
      account:accounts(id, name, icon),
      category:categories(id, name, icon)
    `)
    .eq('id', parseInt(id))
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return errorResponse('Rule not found', 404);
  }

  return jsonResponse(data);
}

async function createRule(supabase: any, userId: string, req: Request) {
  const body = await getRequestBody<{
    account_id: number;
    category_id?: number;
    type: string;
    amount: number;
    description?: string;
    frequency: string;
    interval_value?: number;
    start_date?: string;
    end_date?: string;
    next_due_date?: string;
  }>(req);

  if (!body.account_id || !body.type || !body.amount || !body.frequency) {
    return errorResponse('account_id, type, amount, and frequency are required');
  }

  const { data, error } = await supabase
    .from('recurring_rules')
    .insert({
      user_id: userId,
      account_id: body.account_id,
      category_id: body.category_id || null,
      type: body.type,
      amount: body.amount,
      description: body.description || null,
      frequency: body.frequency,
      interval_value: body.interval_value || 1,
      start_date: body.start_date || new Date().toISOString().split('T')[0],
      end_date: body.end_date || null,
      next_due_date: body.next_due_date || new Date().toISOString().split('T')[0],
    })
    .select()
    .single();

  if (error) {
    return errorResponse(error.message);
  }

  return jsonResponse(data, 201);
}

async function updateRule(supabase: any, userId: string, req: Request, id?: string | null) {
  if (!id) {
    return errorResponse('Rule ID required');
  }

  const body = await getRequestBody<{
    account_id?: number;
    category_id?: number;
    type?: string;
    amount?: number;
    description?: string;
    frequency?: string;
    interval_value?: number;
    start_date?: string;
    end_date?: string;
    next_due_date?: string;
    is_active?: boolean;
  }>(req);

  const { data, error } = await supabase
    .from('recurring_rules')
    .update(body)
    .eq('id', parseInt(id))
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    return errorResponse(error.message);
  }

  if (!data) {
    return errorResponse('Rule not found', 404);
  }

  return jsonResponse(data);
}

async function deleteRule(supabase: any, userId: string, id?: string | null) {
  if (!id) {
    return errorResponse('Rule ID required');
  }

  const { error } = await supabase
    .from('recurring_rules')
    .delete()
    .eq('id', parseInt(id))
    .eq('user_id', userId);

  if (error) {
    return errorResponse(error.message);
  }

  return jsonResponse({ message: 'Rule deleted' });
}
