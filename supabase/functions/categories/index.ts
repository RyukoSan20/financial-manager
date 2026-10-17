// Categories CRUD API
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

    const url = new URL(req.url);
    const type = url.searchParams.get('type');
    const action = url.pathname.split('/').pop();

    switch (req.method) {
      case 'GET':
        return await listCategories(supabase, userUuid, type, action);
      case 'POST':
        if (action === 'seed') {
          return await seedCategories(supabase, userUuid);
        }
        return await createCategory(supabase, userUuid, req);
      case 'PUT':
        return await updateCategory(supabase, userUuid, req, url);
      case 'DELETE':
        return await deleteCategory(supabase, userUuid, req, url);
      default:
        return errorResponse('Method not allowed', 405);
    }
  } catch (err) {
    console.error('Categories error:', err);
    return errorResponse(err.message || 'Internal error', 500);
  }
});

async function listCategories(supabase: any, userId: string | undefined, type?: string | null, action?: string) {
  // Get system categories + user categories
  let query = supabase
    .from('categories')
    .select('*')
    .or(`is_system.eq.true,user_id.eq.${userId}`);

  if (type) {
    query = query.eq('type', type);
  }

  query = query.eq('is_active', true).order('name');

  const { data, error } = await query;
  if (error) {
    return errorResponse(error.message);
  }

  return jsonResponse(data || []);
}

async function createCategory(supabase: any, userId: string | undefined, req: Request) {
  const body = await getRequestBody<{
    name: string;
    type: string;
    icon?: string;
    color?: string;
    parent_id?: number;
  }>(req);

  if (!body.name || !body.type) {
    return errorResponse('Name and type are required');
  }

  if (!['income', 'expense'].includes(body.type)) {
    return errorResponse('Type must be income or expense');
  }

  const { data, error } = await supabase
    .from('categories')
    .insert({
      user_id: userId || null,
      name: body.name,
      type: body.type,
      icon: body.icon || '📦',
      color: body.color || '#607D8B',
      parent_id: body.parent_id || null,
      is_system: false,
    })
    .select()
    .single();

  if (error) {
    return errorResponse(error.message);
  }

  return jsonResponse(data, 201);
}

async function updateCategory(supabase: any, userId: string | undefined, req: Request, url: URL) {
  const id = parseInt(url.searchParams.get('id') || '0');
  if (!id) {
    return errorResponse('Category ID required');
  }

  const body = await getRequestBody<{
    name?: string;
    type?: string;
    icon?: string;
    color?: string;
    is_active?: boolean;
    parent_id?: number;
  }>(req);

  // Users can only edit their own categories
  const { data: existing } = await supabase
    .from('categories')
    .select('user_id, is_system')
    .eq('id', id)
    .single();

  if (!existing) {
    return errorResponse('Category not found', 404);
  }

  if (existing.is_system && userId) {
    return errorResponse('Cannot edit system categories');
  }

  if (existing.user_id !== userId && userId) {
    return errorResponse('Cannot edit other users categories');
  }

  const { data, error } = await supabase
    .from('categories')
    .update(body)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return errorResponse(error.message);
  }

  return jsonResponse(data);
}

async function deleteCategory(supabase: any, userId: string | undefined, req: Request, url: URL) {
  const id = parseInt(url.searchParams.get('id') || '0');
  if (!id) {
    return errorResponse('Category ID required');
  }

  // Check if category is in use
  const { count } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('category_id', id);

  if (count && count > 0) {
    // Soft delete
    await supabase
      .from('categories')
      .update({ is_active: false })
      .eq('id', id);
    return jsonResponse({ message: 'Category deactivated (has linked transactions)' });
  }

  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id)
    .eq('user_id', userId || 'null');

  if (error) {
    return errorResponse(error.message);
  }

  return jsonResponse({ message: 'Category deleted' });
}

async function seedCategories(supabase: any, userId: string | undefined) {
  const defaultCategories = [
    { name: 'Gaji', type: 'income', icon: '💰', color: '#4CAF50' },
    { name: 'Freelance', type: 'income', icon: '💻', color: '#2196F3' },
    { name: 'Investasi', type: 'income', icon: '📈', color: '#9C27B0' },
    { name: 'Bonus', type: 'income', icon: '🎁', color: '#FF9800' },
    { name: 'Lainnya (Income)', type: 'income', icon: '📦', color: '#607D8B' },
    { name: 'Makanan & Minuman', type: 'expense', icon: '🍔', color: '#F44336' },
    { name: 'Transportasi', type: 'expense', icon: '🚗', color: '#3F51B5' },
    { name: 'Belanja', type: 'expense', icon: '🛒', color: '#E91E63' },
    { name: 'Kesehatan', type: 'expense', icon: '🏥', color: '#00BCD4' },
    { name: 'Pendidikan', type: 'expense', icon: '📚', color: '#795548' },
    { name: 'Hiburan', type: 'expense', icon: '🎬', color: '#FF5722' },
    { name: 'Tagihan & Utilitas', type: 'expense', icon: '📄', color: '#9E9E9E' },
    { name: 'Investasi & Tabungan', type: 'expense', icon: '🏦', color: '#4CAF50' },
    { name: 'Lainnya (Expense)', type: 'expense', icon: '📦', color: '#607D8B' },
  ];

  const { data, error } = await supabase
    .from('categories')
    .upsert(
      defaultCategories.map(cat => ({
        ...cat,
        user_id: userId || null,
        is_system: !userId,
      })),
      { onConflict: 'name,user_id' }
    )
    .select();

  if (error) {
    return errorResponse(error.message);
  }

  return jsonResponse({ message: `Seeded ${data?.length || 0} categories`, categories: data });
}
