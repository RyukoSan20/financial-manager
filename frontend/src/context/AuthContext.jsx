// Auth Context with Supabase + Backend fallback
import { createContext, useContext, useState, useEffect } from 'react';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';

// Use VITE_API_URL from environment, fallback to localhost for local dev
const getApiUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    // VITE_API_URL already includes /api
    return import.meta.env.VITE_API_URL;
  }
  // Default to localhost for local development
  return 'https://my-financial-manager.online/api';
};
const API_URL = getApiUrl();

const getRedirectUrl = () => {
  // Dynamic redirect URL based on current origin
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  // Fallback for SSR
  return 'https://frontend-virid-alpha-24.vercel.app';
};

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check localStorage for backend OAuth token first
    const backendToken = localStorage.getItem('token');
    const backendUser = localStorage.getItem('user');
    
    if (backendToken && backendUser) {
      try {
        setUser(JSON.parse(backendUser));
      } catch (e) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    } else if (backendToken) {
      // Token exists but no user - verify with backend
      fetch(`${API_URL}/me`, {
        headers: { 'Authorization': `Bearer ${backendToken}` }
      }).then(res => {
        if (res.ok) return res.json();
        // The server said the session is over. Anything else - it is
        // restarting for a deployment, the network dropped - is not
        // the end of the session, and the token is kept for it.
        if (res.status === 401 || res.status === 403) {
          throw new Error('Invalid token');
        }
        return null;
      }).then(userData => {
        if (!userData) return;
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
      }).catch(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      });
    }
    
    // Also check Supabase
    if (isSupabaseConfigured()) {
      initSupabaseAuth();
    } else {
      checkBackendAuth();
    }
    
    return () => {};
  }, []);

  const initSupabaseAuth = async () => {
    try {
      const supabase = getSupabase();
      
      // Timeout wrapper
      const withTimeout = (promise, ms) => {
        return Promise.race([
          promise,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Supabase timeout')), ms)
          )
        ]);
      };
      
      // Get initial session with timeout
      const { data: { session } } = await withTimeout(
        supabase.auth.getSession(),
        5000 // 5 second timeout
      );
      
      if (session) {
        setUser(session.user);
        localStorage.setItem('sb_token', session.access_token);
        localStorage.setItem('sb_user', JSON.stringify(session.user));
      }
      
      // Listen for auth changes
      supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session) {
          setUser(session.user);
          localStorage.setItem('sb_token', session.access_token);
          localStorage.setItem('sb_user', JSON.stringify(session.user));
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          localStorage.removeItem('sb_token');
          localStorage.removeItem('sb_user');
        }
      });
      
      setLoading(false);
    } catch (err) {
      console.error('Supabase auth error:', err);
      setLoading(false);
    }
  };

  const checkBackendAuth = async () => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const res = await fetch(`${API_URL}/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const userData = await res.json();
          setUser(userData);
        } else if (res.status === 401 || res.status === 403) {
          // The session really is over. The reader has to sign in
          // again, and the token is not worth keeping.
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
        // Anything else - the server restarting for a deploy, a
        // network that dropped - is not the end of the session. The
        // token was thrown away once for a 502, and the reader was
        // signed out in the middle of a deployment for no reason.
      } catch (err) {
        console.error('Backend auth check error:', err);
      }
    }
    setLoading(false);
  };

  const clearAuth = () => {
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('sb_token');
    localStorage.removeItem('sb_user');
  };

  const login = async (email, password) => {
    if (isSupabaseConfigured()) {
      return supabaseLogin(email, password);
    } else {
      return backendLogin(email, password);
    }
  };

  const register = async (email, password) => {
    if (isSupabaseConfigured()) {
      return supabaseRegister(email, password);
    } else {
      return backendRegister(email, password);
    }
  };

  const googleLogin = async () => {
    // Always use backend Google OAuth
    const res = await fetch(`${API_URL}/google/url`);
    if (!res.ok) throw new Error('Google OAuth not available');
    const data = await res.json();
    // Redirect to Google
    window.location.href = data.url;
  };

  const guestLogin = async () => {
    // Guest login is done by the backend, and the backend has always
    // been able to do it. It used to be refused here unless Supabase
    // was set up, which meant that on a machine without Supabase the
    // button said "guest login is not available" even though the
    // endpoint behind it was there and working.
    //
    // Supabase is only needed for the Google sign-in and for the
    // email password path that goes through it. It is not needed to
    // make a guest account.
    return backendGuestLogin();
  };

  const logout = async () => {
    if (isSupabaseConfigured()) {
      return supabaseLogout();
    } else {
      return backendLogout();
    }
  };

  // Supabase Auth Functions
  const supabaseLogin = async (email, password) => {
    const sb = getSupabase();
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    
    // Store Supabase session
    if (data.session) {
      setUser(data.user);
      localStorage.setItem('sb_token', data.session.access_token);
      localStorage.setItem('sb_user', JSON.stringify(data.user));
      
      // Exchange for backend JWT
      try {
        const res = await fetch(`${API_URL}/supabase-exchange`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: data.user.email,
            supabase_id: data.user.id,
            provider: 'email',
          }),
        });
        if (res.ok) {
          const tokenData = await res.json();
          localStorage.setItem('token', tokenData.access_token);
          localStorage.setItem('user', JSON.stringify(tokenData.user));
        }
      } catch (e) {
        console.warn('Backend token exchange failed:', e);
      }
    }
    return data;
  };

  const supabaseRegister = async (email, password) => {
    const sb = getSupabase();
    const { data, error } = await sb.auth.signUp({ email, password });
    if (error) throw error;
    
    // Store Supabase session if auto-signed in
    if (data.session) {
      setUser(data.user);
      localStorage.setItem('sb_token', data.session.access_token);
      localStorage.setItem('sb_user', JSON.stringify(data.user));
    }
    return data;
  };

  const supabaseGoogleLogin = async () => {
    const sb = getSupabase();
    const { data, error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/auth/callback',
      },
    });
    if (error) throw error;
    return data;
  };

  const backendGuestLogin = async () => {
    // The backend makes the guest account. This does not use
    // Supabase at all: the account is a row in the same database as
    // every other account.
    const res = await fetch(`${API_URL}/guest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: crypto.randomUUID() }),
    });
    if (!res.ok) throw new Error('Guest login failed');
    const data = await res.json();
    // Store backend token
    localStorage.setItem('token', data.access_token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
    return data;
  };

  const supabaseLogout = async () => {
    const sb = getSupabase();
    const { error } = await sb.auth.signOut();
    if (error) throw error;
    clearAuth();
  };

  // Backend Auth Functions
  const backendLogin = async (email, password) => {
    const res = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.detail || 'Login failed');
    }
    const data = await res.json();
    localStorage.setItem('token', data.access_token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
    return data;
  };

  const backendRegister = async (email, password) => {
    const res = await fetch(`${API_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.detail || 'Registration failed');
    }
    const data = await res.json();
    // The token is kept, the same as it is after a sign-in.
    //
    // It used to be dropped here. The server hands out a token with the
    // answer, and the answer was thrown away, so a reader who had just
    // made an account was sent back to the sign-in page and asked to
    // sign in with the password they had only just chosen. The
    // registration worked; the reader was simply never signed in.
    localStorage.setItem('token', data.access_token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
    return data;
  };

  const backendLogout = async () => {
    clearAuth();
  };

  const updateProfile = async (data) => {
    if (isSupabaseConfigured()) {
      const sb = getSupabase();
      const { data: userData, error } = await sb.auth.updateUser(data);
      if (error) throw error;
      setUser(userData.user);
      localStorage.setItem('sb_user', JSON.stringify(userData.user));
      return userData.user;
    } else {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || 'Update failed');
      }
      const updatedUser = await res.json();
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
      return updatedUser;
    }
  };

  const isAuthenticated = !!user;

  const value = {
    user,
    loading,
    isAuthenticated,
    login,
    register,
    googleLogin,
    guestLogin,
    logout,
    updateProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
