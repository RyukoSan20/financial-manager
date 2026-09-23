// Supabase Client Configuration
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Check if configured
export const isSupabaseConfigured = () => {
  return !!(supabaseUrl && supabaseAnonKey && 
    supabaseUrl !== 'undefined' && supabaseAnonKey !== 'undefined' &&
    supabaseUrl.startsWith('http'));
};

// Create client only if configured
let supabaseInstance = null;

if (isSupabaseConfigured()) {
  try {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
  } catch (e) {
    console.error('Supabase init error:', e);
  }
}

// Fallback mock for when not configured
const mockSupabase = {
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    getUser: async () => ({ data: { user: null }, error: null }),
    signUp: async () => { throw new Error('Supabase not configured'); },
    signInWithPassword: async () => { throw new Error('Supabase not configured'); },
    signInWithOAuth: async () => { throw new Error('Supabase not configured'); },
    signInAnonymously: async () => { throw new Error('Supabase not configured'); },
    signOut: async () => {},
    updateUser: async () => { throw new Error('Supabase not configured'); },
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
  }
};

// Export the client or mock
export const getSupabase = () => supabaseInstance || mockSupabase;

// Legacy export for backward compatibility
export const supabase = supabaseInstance || mockSupabase;

// Auth helpers
export const signUp = async (email, password) => {
  const sb = getSupabase();
  return sb.auth.signUp({ email, password });
};

export const signIn = async (email, password) => {
  const sb = getSupabase();
  return sb.auth.signInWithPassword({ email, password });
};

export const signInWithGoogle = async () => {
  const sb = getSupabase();
  return sb.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin + '/auth/callback',
    },
  });
};

export const signInAnonymously = async () => {
  const sb = getSupabase();
  return sb.auth.signInAnonymously();
};

export const signOut = async () => {
  const sb = getSupabase();
  return sb.auth.signOut();
};

export const getSession = async () => {
  const sb = getSupabase();
  return sb.auth.getSession();
};

export const getUser = async () => {
  const sb = getSupabase();
  return sb.auth.getUser();
};

export const onAuthStateChange = (callback) => {
  const sb = getSupabase();
  return sb.auth.onAuthStateChange(callback);
};
