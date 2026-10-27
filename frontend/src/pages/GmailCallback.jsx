// Gmail OAuth Callback Page
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from '../i18n';
import { batch3 } from '../i18n/keys_batch3';
import { batch4 } from '../i18n/keys_batch4';

const GmailCallback = () => {
  const { language } = useTranslation();
  const K = batch3[language]?.gmail_callback;
  const A = batch4[language]?.gmail_callback;
  const [status, setStatus] = useState(A.processing);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Get code and state from URL
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const errorParam = params.get("error");

    if (errorParam) {
      setError(A.denied);
      return;
    }

    if (code) {
      // Store code in localStorage for later processing
      localStorage.setItem("gmail_oauth_code", code);
      localStorage.setItem("gmail_connected_at", new Date().toISOString());
      
      setStatus("✅ " + A.connected);
      
      // Redirect to Gmail page after 2 seconds
      setTimeout(() => {
        navigate("/gmail");
      }, 2000);
    } else {
      setError(A.no_code);
    }
  }, [navigate, A]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full mx-4 text-center">
        {error ? (
          <>
            <div className="text-6xl mb-4">❌</div>
            <h1 className="text-2xl font-bold text-red-600 mb-2">{K.failed}</h1>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => navigate("/gmail")}
              className="w-full py-3 bg-primary-600 text-white rounded-xl font-medium"
            >
              {K.retry}
            </button>
          </>
        ) : (
          <>
            <div className="animate-spin w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">{K.connecting}</h1>
            <p className="text-gray-600 mb-4">{status}</p>
            <p className="text-sm text-gray-500">{K.redirecting}</p>
          </>
        )}
      </div>
    </div>
  );
};

export default GmailCallback;
