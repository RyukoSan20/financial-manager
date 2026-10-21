// Auth Callback Page - handles OAuth redirect
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSupabase } from '../lib/supabase';
import { apiUrl } from '../config/url';

export const AuthCallback = () => {
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      // Check for JWT token from backend OAuth callback (direct Google OAuth)
      const urlParams = new URLSearchParams(window.location.search);
      const backendToken = urlParams.get('token');
      const errorParam = urlParams.get('error');
      
      if (errorParam) {
        console.error('OAuth error:', errorParam);
        setError('Authentication failed: ' + errorParam);
        setTimeout(() => navigate('/login'), 3000);
        return;
      }
      
      if (backendToken) {
        // Direct JWT from backend OAuth - store and redirect
        localStorage.setItem('token', backendToken);
        
        // Fetch user info
        try {
          const userRes = await fetch(apiUrl('me'), {
            headers: { 'Authorization': `Bearer ${backendToken}` }
          });
          if (userRes.ok) {
            const userData = await userRes.json();
            localStorage.setItem('user', JSON.stringify(userData));
          }
        } catch (e) {
          console.error('Failed to fetch user:', e);
        }
        
        navigate('/dashboard');
        return;
      }
      
      // Fall back to Supabase flow
      const sb = getSupabase();
      const { data, error: sbError } = await sb.auth.getSession();
      
      if (sbError) {
        console.error('Supabase callback error:', sbError);
        setError(sbError.message);
        setTimeout(() => navigate('/login'), 3000);
        return;
      }

      if (data.session) {
        const user = data.session.user;
        const response = await fetch(apiUrl('supabase-exchange'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: user.email,
            supabase_id: user.id,
            provider: user.app_metadata?.provider || 'google',
          }),
        });
        
        if (!response.ok) {
          throw new Error('Token exchange failed');
        }
        
        const tokenData = await response.json();
        localStorage.setItem('token', tokenData.access_token);
        localStorage.setItem('user', JSON.stringify(tokenData.user));
        localStorage.setItem('sb_token', data.session.access_token);
        localStorage.setItem('sb_user', JSON.stringify(user));
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
