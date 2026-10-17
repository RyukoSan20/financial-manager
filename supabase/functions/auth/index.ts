// Auth endpoints: login, register, guest, me
import { corsHeaders, jsonResponse, errorResponse, getRequestBody } from '../_shared/database.ts';
import { hashPassword, verifyPassword, createSimpleToken, verifySimpleToken } from '../_shared/security.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.split('/').pop();

    switch (path) {
      case 'login':
        return await handleLogin(req);
      case 'register':
        return await handleRegister(req);
      case 'guest':
        return await handleGuest(req);
      case 'me':
        return await handleMe(req);
      case 'supabase-exchange':
        return await handleSupabaseExchange(req);
      default:
        return errorResponse('Not found', 404);
    }
  } catch (err) {
    console.error('Auth error:', err);
    return errorResponse(err.message || 'Internal error', 500);
  }
});

async function handleLogin(req: Request) {
  const { email, password } = await getRequestBody<{ email: string; password: string }>(req);

  if (!email || !password) {
    return errorResponse('Email and password required');
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  // Get user from auth.users
  const { data: user, error } = await supabase.auth.admin.listUsers();
  
  if (error) {
    console.error('List users error:', error);
    return errorResponse('Authentication failed', 401);
  }

  const targetUser = user.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
  
  if (!targetUser) {
    return errorResponse('Invalid email or password', 401);
  }

  // Verify password
  const storedHash = targetUser.user_metadata?.password_hash;
  if (!storedHash) {
    return errorResponse('This account uses OAuth. Please sign in with Google.', 401);
  }

  const valid = await verifyPassword(password, storedHash);
  if (!valid) {
    return errorResponse('Invalid email or password', 401);
  }

  // Generate token
  const token = createSimpleToken(parseInt(targetUser.id.replace(/[^0-9]/g, '') || '0'));

  return jsonResponse({
    access_token: token,
    user: {
      id: parseInt(targetUser.id.replace(/[^0-9]/g, '') || '0'),
      email: targetUser.email,
      full_name: targetUser.user_metadata?.full_name || null,
    }
  });
}

async function handleRegister(req: Request) {
  const { email, password, username, full_name } = await getRequestBody<{
    email: string;
    password: string;
    username?: string;
    full_name?: string;
  }>(req);

  if (!email || !password) {
    return errorResponse('Email and password required');
  }

  if (password.length < 8) {
    return errorResponse('Password must be at least 8 characters');
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Create user in Supabase Auth
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      password_hash: await hashPassword(password),
      full_name: full_name || null,
      username: username || null,
    }
  });

  if (error) {
    console.error('Create user error:', error);
    return errorResponse(error.message || 'Registration failed');
  }

  if (!data.user) {
    return errorResponse('Failed to create user');
  }

  // Generate token
  const token = createSimpleToken(parseInt(data.user.id.replace(/[^0-9]/g, '') || '0'));

  return jsonResponse({
    access_token: token,
    user: {
      id: parseInt(data.user.id.replace(/[^0-9]/g, '') || '0'),
      email: data.user.email,
      username: username || null,
      full_name: full_name || null,
    }
  }, 201);
}

async function handleGuest(req: Request) {
  const { device_id } = await getRequestBody<{ device_id: string }>(req);

  if (!device_id || device_id.length < 10) {
    return errorResponse('Invalid device_id');
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const guestEmail = `guest_${device_id}@finmanager.local`;

  // Check if guest exists
  const { data: existing } = await supabase.auth.admin.listUsers();
  const guestUser = existing?.users.find(u => u.email === guestEmail);

  if (guestUser) {
    const token = createSimpleToken(parseInt(guestUser.id.replace(/[^0-9]/g, '') || '0'));
    return jsonResponse({
      access_token: token,
      user: {
        id: parseInt(guestUser.id.replace(/[^0-9]/g, '') || '0'),
        email: guestUser.email,
        is_guest: true,
      }
    });
  }

  // Create guest user
  const tempPassword = crypto.randomUUID();
  const { data, error } = await supabase.auth.admin.createUser({
    email: guestEmail,
    password: tempPassword,
    email_confirm: true,
    user_metadata: {
      password_hash: await hashPassword(tempPassword),
      is_guest: true,
      device_id,
    }
  });

  if (error || !data.user) {
    console.error('Create guest error:', error);
    return errorResponse('Failed to create guest account');
  }

  const token = createSimpleToken(parseInt(data.user.id.replace(/[^0-9]/g, '') || '0'));

  return jsonResponse({
    access_token: token,
    user: {
      id: parseInt(data.user.id.replace(/[^0-9]/g, '') || '0'),
      email: guestEmail,
      is_guest: true,
    }
  }, 201);
}

async function handleMe(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return errorResponse('Unauthorized', 401);
  }

  const token = authHeader.slice(7);
  const userId = verifySimpleToken(token);

  if (!userId) {
    return errorResponse('Invalid or expired token', 401);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { data: users } = await supabase.auth.admin.listUsers();
  const user = users?.users.find(u => parseInt(u.id.replace(/[^0-9]/g, '') || '0') === userId);

  if (!user) {
    return errorResponse('User not found', 404);
  }

  return jsonResponse({
    id: userId,
    email: user.email,
    full_name: user.user_metadata?.full_name || null,
    username: user.user_metadata?.username || null,
    is_guest: user.user_metadata?.is_guest || false,
    created_at: user.created_at,
  });
}

async function handleSupabaseExchange(req: Request) {
  const { email, supabase_id } = await getRequestBody<{
    email: string;
    supabase_id: string;
  }>(req);

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  // Find or create user
  const { data: users } = await supabase.auth.admin.listUsers();
  let user = users?.users.find(u => u.email?.toLowerCase() === email.toLowerCase());

  if (!user) {
    // Create new user
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        supabase_id,
        is_oauth: true,
      }
    });
    
    if (error || !data.user) {
      console.error('Create OAuth user error:', error);
      return errorResponse('Failed to create user');
    }
    user = data.user;
  } else {
    // Update supabase_id if different
    if (user.user_metadata?.supabase_id !== supabase_id) {
      await supabase.auth.admin.updateUserById(user.id, {
        data: { ...user.user_metadata, supabase_id }
      });
    }
  }

  const token = createSimpleToken(parseInt(user.id.replace(/[^0-9]/g, '') || '0'));

  return jsonResponse({
    access_token: token,
    user: {
      id: parseInt(user.id.replace(/[^0-9]/g, '') || '0'),
      email: user.email,
      full_name: user.user_metadata?.full_name || null,
    }
  });
}
