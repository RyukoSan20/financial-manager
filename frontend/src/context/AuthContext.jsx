// Auth Context with Supabase + Backend fallback
import { createContext, useContext, useState, useEffect } from 'react';
import { getSupabase, isSupabaseConfigured, onAuthStateChange } from '../lib/supabase';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Always set loading to false after mount
    setLoading(false);
    
    if (isSupabaseConfigured()) {
      // Use Supabase auth
      initSupabaseAuth();
    } else {
      // Fallback to backend auth
      checkBackendAuth();
    }
    
    return () => {};
  }, []);

  const initSupabaseAuth = async () => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }
    
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
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
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
      
      return () => subscription.unsubscribe();
    } catch (err) {
      console.error('Supabase auth init error:', err);
      setLoading(false);
    }
  };

  const checkBackendAuth = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/auth/me`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
      } else {
        clearAuth();
      }
    } catch (err) {
      console.error('Backend auth check failed:', err);
      clearAuth();
    } finally {
      setLoading(false);
    }
  };

  const clearAuth = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('sb_token');
    localStorage.removeItem('sb_user');
    localStorage.removeItem('guest_device_id');
    setUser(null);
  };

  // Supabase Auth Functions
  const supabaseLogin = async (email, password) => {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase not configured. Please contact admin.');
    }
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) throw error;
    return data;
  };

  const supabaseRegister = async (email, password) => {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase not configured. Please contact admin.');
    }
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    
    if (error) throw error;
    return data;
  };

  const supabaseGoogleLogin = async () => {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase not configured. Please contact admin.');
    }
    
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/auth/callback',
      },
    });
    
    if (error) throw error;
    return data;
  };

  const supabaseGuestLogin = async () => {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase not configured. Please contact admin.');
    }
    
    const { data, error } = await supabase.auth.signInAnonymously();
    
    if (error) throw error;
    return data;
  };

  const supabaseLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    clearAuth();
  };

  // Backend Auth Functions (fallback)
  const backendLogin = async (email, password) => {
    const res = await fetch(`${API_URL}/api/auth/login`, {
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

  const backendRegister = async (email, password, username = null, fullName = null) => {
    const res = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, username, full_name: fullName }),
    });
    
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.detail || 'Registration failed');
    }
    
    const data = await res.json();
    localStorage.setItem('token', data.access_token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
    return data;
  };

  const backendGuestLogin = async () => {
    let deviceId = localStorage.getItem('guest_device_id');
    
    if (!deviceId) {
      deviceId = 'guest_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
      localStorage.setItem('guest_device_id', deviceId);
    }
    
    const res = await fetch(`${API_URL}/api/auth/guest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: deviceId }),
    });
    
    if (!res.ok) throw new Error('Guest login failed');
    
    const data = await res.json();
    localStorage.setItem('token', data.access_token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
    return data;
  };

  const backendLogout = async () => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        await fetch(`${API_URL}/api/auth/logout`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
        });
      }
    } catch (err) {
      console.error('Logout API error:', err);
    } finally {
      clearAuth();
      window.location.href = '/login';
    }
  };

  // Unified functions - use Supabase if configured, fallback to backend
  const login = async (email, password) => {
    if (isSupabaseConfigured()) {
      return supabaseLogin(email, password);
    }
    return backendLogin(email, password);
  };

  const register = async (email, password) => {
    if (isSupabaseConfigured()) {
      return supabaseRegister(email, password);
    }
    return backendRegister(email, password);
  };

  const googleLogin = async () => {
    if (isSupabaseConfigured()) {
      return supabaseGoogleLogin();
    }
    throw new Error('Google login not configured. Please use email login.');
  };

  const guestLogin = async () => {
    if (isSupabaseConfigured()) {
      return supabaseGuestLogin();
    }
    return backendGuestLogin();
  };

  const logout = async () => {
    if (isSupabaseConfigured()) {
      return supabaseLogout();
    }
    return backendLogout();
  };

  const updateProfile = async (data) => {
    if (isSupabaseConfigured()) {
      // Update via Supabase
      const sb = getSupabase();
      const { data: userData, error } = await sb.auth.updateUser(data);
      if (error) throw error;
      setUser(userData.user);
      return userData.user;
    }
    
    // Fallback to backend
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/api/auth/me`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(data),
    });
    
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.detail || 'Update failed');
    }
    
    const updatedUser = await res.json();
    setUser(updatedUser);
    return updatedUser;
  };

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    isGuest: user?.is_guest || false,
    isSupabase: isSupabaseConfigured(),
    login,
    register,
    googleLogin,
    guestLogin,
    logout,
    updateProfile,
    checkAuth: isSupabaseConfigured() ? initSupabaseAuth : checkBackendAuth,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export default AuthContext;
