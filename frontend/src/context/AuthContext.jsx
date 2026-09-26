// Auth Context with Supabase + Backend fallback
import { createContext, useContext, useState, useEffect } from 'react';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';

const API_URL = import.meta.env.VITE_API_URL?.replace(/\/api$/, '') || 'http://localhost:8000';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check localStorage first (for OAuth callback)
    const storedUser = localStorage.getItem('sb_user');
    const storedToken = localStorage.getItem('sb_token');
    if (storedUser && storedToken) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        localStorage.removeItem('sb_user');
        localStorage.removeItem('sb_token');
      }
    }
    
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
      
      // Get initial session
      const { data: { session } } = await supabase.auth.getSession();
      
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
        const res = await fetch(`${API_URL}/api/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const userData = await res.json();
          setUser(userData);
        } else {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
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
    if (isSupabaseConfigured()) {
      return supabaseGoogleLogin();
    } else {
      throw new Error('Google login belum tersedia. Gunakan login email.');
    }
  };

  const guestLogin = async () => {
    if (isSupabaseConfigured()) {
      return supabaseGuestLogin();
    } else {
      throw new Error('Guest login belum tersedia. Gunakan login email.');
    }
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
    return data;
  };

  const supabaseRegister = async (email, password) => {
    const sb = getSupabase();
    const { data, error } = await sb.auth.signUp({ email, password });
    if (error) throw error;
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

  const supabaseGuestLogin = async () => {
    // Use backend guest login, not Supabase anonymous
    const res = await fetch(`${API_URL}/api/guest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: crypto.randomUUID() }),
    });
    if (!res.ok) throw new Error('Guest login failed');
    const data = await res.json();
    // Store backend token
    localStorage.setItem('token', data.access_token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setToken(data.access_token);
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
    const res = await fetch(`${API_URL}/api/login`, {
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
    const res = await fetch(`${API_URL}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.detail || 'Registration failed');
    }
    const data = await res.json();
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
      const res = await fetch(`${API_URL}/api/profile`, {
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
