// Auth Callback Page - handles OAuth redirect
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSupabase } from '../lib/supabase';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const AuthCallback = () => {
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      const sb = getSupabase();
      
      // Get session from URL
      const { data, error: sbError } = await sb.auth.getSession();
      
      if (sbError) {
        console.error('Supabase callback error:', sbError);
        setError(sbError.message);
        setTimeout(() => navigate('/login'), 3000);
        return;
      }

      if (data.session) {
        // Get user info from Supabase
        const user = data.session.user;
        
        // Exchange Supabase token for backend JWT
        try {
          const response = await fetch(`${API_URL}/api/auth/supabase-exchange`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: user.email,
              supabase_id: user.id,
              provider: user.app_metadata?.provider || 'google',
            }),
          });
          
          if (response.ok) {
            const tokenData = await response.json();
            // Store backend token (this is what API uses)
            localStorage.setItem('token', tokenData.access_token);
            localStorage.setItem('user', JSON.stringify(tokenData.user));
          }
        } catch (e) {
          console.error('Token exchange error:', e);
        }
        
        // Store Supabase session too
        localStorage.setItem('sb_token', data.session.access_token);
        localStorage.setItem('sb_user', JSON.stringify(user));
        
        // Redirect to dashboard
        navigate('/dashboard');
      } else {
        navigate('/login');
      }
    } catch (err) {
      console.error('Auth callback error:', err);
      setError('Authentication failed');
      setTimeout(() => navigate('/login'), 3000);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        {error ? (
          <>
            <div className="text-red-500 text-lg mb-4">Error: {error}</div>
            <p className="text-gray-500">Redirecting to login...</p>
          </>
        ) : (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Completing sign in...</p>
          </>
        )}
      </div>
    </div>
  );
};

export default AuthCallback;
