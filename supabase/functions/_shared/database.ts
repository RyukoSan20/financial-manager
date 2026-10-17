// Shared database utilities for Supabase Edge Functions
// Uses Supabase's built-in PostgreSQL connection

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Database client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

// Admin client (bypasses RLS) for internal operations
export const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

// Public client (respects RLS) for user operations
export function createUserClient(accessToken: string) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } }
  });
}

// Verify JWT and get user
export async function verifyAuth(accessToken: string) {
  try {
    const { data: { user }, error } = await adminClient.auth.getUser(accessToken);
    if (error || !user) {
      throw new Error('Invalid token');
    }
    return user;
  } catch {
    throw new Error('Unauthorized');
  }
}

// CORS headers
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

// Helper to return JSON response
export function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// Helper to return error
export function errorResponse(message: string, status = 400) {
  return jsonResponse({ error: message }, status);
}

// Helper for POST/PUT body
export async function getRequestBody<T>(request: Request): Promise<T> {
  try {
    return await request.json();
  } catch {
    throw new Error('Invalid JSON body');
  }
}
