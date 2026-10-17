// Goals CRUD API
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
    const id = url.searchParams.get('id');
    const action = pathParts[pathParts.length - 1];

    switch (req.method) {
      case 'GET':
        if (action === 'contributions' && id) {
          return await getContributions(supabase, userUuid, id);
        }
        if (id) {
          return await getGoal(supabase, userUuid, id);
        }
        return await listGoals(supabase, userUuid);
      case 'POST':
        if (action === 'contribute') {
          return await addContribution(supabase, userUuid, req);
        }
        return await createGoal(supabase, userUuid, req);
      case 'PUT':
        if (action === 'contribute') {
          return await addContribution(supabase, userUuid, req);
        }
        return await updateGoal(supabase, userUuid, req, id);
      case 'DELETE':
        return await deleteGoal(supabase, userUuid, id);
      default:
        return errorResponse('Method not allowed', 405);
    }
  } catch (err) {
    console.error('Goals error:', err);
    return errorResponse(err.message || 'Internal error', 500);
  }
});

async function listGoals(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    return errorResponse(error.message);
  }

  const goals = (data || []).map(goal => ({
    ...goal,
    progress: goal.target_amount > 0 ? (parseFloat(goal.current_amount) / parseFloat(goal.target_amount)) * 100 : 0,
    remaining: Math.max(0, parseFloat(goal.target_amount) - parseFloat(goal.current_amount)),
  }));

  return jsonResponse(goals);
}

async function getGoal(supabase: any, userId: string, id: string) {
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .eq('id', parseInt(id))
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return errorResponse('Goal not found', 404);
  }

  const { data: contributions } = await supabase
    .from('goal_contributions')
    .select('*')
    .eq('goal_id', parseInt(id))
    .eq('user_id', userId)
    .order('date', { ascending: false });

  return jsonResponse({
    ...data,
    progress: data.target_amount > 0 ? (parseFloat(data.current_amount) / parseFloat(data.target_amount)) * 100 : 0,
    remaining: Math.max(0, parseFloat(data.target_amount) - parseFloat(data.current_amount)),
    contributions: contributions || [],
  });
}

async function createGoal(supabase: any, userId: string, req: Request) {
  const body = await getRequestBody<{
    name: string;
    target_amount: number;
    current_amount?: number;
    deadline?: string;
    icon?: string;
    color?: string;
    notes?: string;
  }>(req);

  if (!body.name || !body.target_amount) {
    return errorResponse('Name and target_amount are required');
  }

  const { data, error } = await supabase
    .from('goals')
    .insert({
      user_id: userId,
      name: body.name,
      target_amount: body.target_amount,
      current_amount: body.current_amount || 0,
      deadline: body.deadline || null,
      icon: body.icon || '🎯',
      color: body.color || '#4CAF50',
      notes: body.notes || null,
    })
    .select()
    .single();

  if (error) {
    return errorResponse(error.message);
  }

  return jsonResponse(data, 201);
}

async function updateGoal(supabase: any, userId: string, req: Request, id?: string | null) {
  if (!id) {
    return errorResponse('Goal ID required');
  }

  const body = await getRequestBody<{
    name?: string;
    target_amount?: number;
    current_amount?: number;
    deadline?: string;
    icon?: string;
    color?: string;
    notes?: string;
    is_completed?: boolean;
  }>(req);

  const { data, error } = await supabase
    .from('goals')
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
    return errorResponse('Goal not found', 404);
  }

  return jsonResponse(data);
}

async function deleteGoal(supabase: any, userId: string, id?: string | null) {
  if (!id) {
    return errorResponse('Goal ID required');
  }

  const { error } = await supabase
    .from('goals')
    .delete()
    .eq('id', parseInt(id))
    .eq('user_id', userId);

  if (error) {
    return errorResponse(error.message);
  }

  return jsonResponse({ message: 'Goal deleted' });
}

async function addContribution(supabase: any, userId: string, req: Request) {
  const body = await getRequestBody<{
    goal_id: number;
    amount: number;
    date?: string;
    notes?: string;
  }>(req);

  if (!body.goal_id || !body.amount) {
    return errorResponse('goal_id and amount are required');
  }

  // Get current goal
  const { data: goal, error: goalError } = await supabase
    .from('goals')
    .select('id, current_amount, target_amount')
    .eq('id', body.goal_id)
    .eq('user_id', userId)
    .single();

  if (goalError || !goal) {
    return errorResponse('Goal not found', 404);
  }

  // Add contribution
  const { data: contribution, error: contribError } = await supabase
    .from('goal_contributions')
    .insert({
      goal_id: body.goal_id,
      user_id: userId,
      amount: body.amount,
      date: body.date || new Date().toISOString().split('T')[0],
      notes: body.notes || null,
    })
    .select()
    .single();

  if (contribError) {
    return errorResponse(contribError.message);
  }

  // Update goal current_amount
  const newAmount = parseFloat(goal.current_amount) + body.amount;
  const isCompleted = newAmount >= parseFloat(goal.target_amount);

  await supabase
    .from('goals')
    .update({
      current_amount: newAmount,
      is_completed: isCompleted,
      updated_at: new Date().toISOString(),
    })
    .eq('id', body.goal_id);

  return jsonResponse({
    contribution,
    goal: {
      ...goal,
      current_amount: newAmount,
      is_completed: isCompleted,
    },
  }, 201);
}

async function getContributions(supabase: any, userId: string, goalId: string) {
  const { data, error } = await supabase
    .from('goal_contributions')
    .select('*')
    .eq('goal_id', parseInt(goalId))
    .eq('user_id', userId)
    .order('date', { ascending: false });

  if (error) {
    return errorResponse(error.message);
  }

  return jsonResponse(data || []);
}
