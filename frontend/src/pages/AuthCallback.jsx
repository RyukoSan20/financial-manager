// Auth Callback Page - handles OAuth redirect
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSupabase } from '../lib/supabase';

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
      const { data, error } = await sb.auth.getSession();
      
      if (error) {
        console.error('Callback error:', error);
        setError(error.message);
        setTimeout(() => navigate('/login'), 3000);
        return;
      }

      if (data.session) {
        // Store token
        localStorage.setItem('sb_token', data.session.access_token);
        localStorage.setItem('sb_user', JSON.stringify(data.session.user));
        
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
