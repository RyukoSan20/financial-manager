// Gmail Integration Page - Beautiful UI
import { useState, useEffect } from "react";
import { useTranslation } from '../i18n';
import { buildFlag } from '../utils/featureFlags';
import { Banknote, Wallet } from 'lucide-react';

const GmailIntegration = () => {
  // With the polish switch off, the emoji stay as they are.
  const polished = buildFlag('UI_POLISH');
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ connected: false, message: t('gmail_integration.loading') });
  const [error, setError] = useState(null);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      
      const res = await fetch(`${import.meta.env.VITE_API_URL}/integrations/gmail/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setStatus(await res.json());
    } catch (e) {
      setStatus({ connected: false, message: t('gmail_integration.not_connected_status') });
    }
  };

  const connectGmail = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${import.meta.env.VITE_API_URL}/integrations/gmail/connect`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.auth_url) window.location.href = data.auth_url;
      else setError(t('gmail_integration.oauth_unavailable'));
    } catch (e) {
      setError(t('gmail_integration.connect_failed'));
    } finally {
      setLoading(false);
    }
  };

  const disconnectGmail = async () => {
    if (!confirm(t('gmail_integration.disconnect_confirm'))) return;
    
    try {
      const token = localStorage.getItem("token");
      await fetch(`${import.meta.env.VITE_API_URL}/integrations/gmail/disconnect`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      setStatus({ connected: false, message: t('gmail_integration.disconnected') });
    } catch (e) {
      setError(t('gmail_integration.disconnect_failed'));
    }
  };

  return (
    <div className="p-4 max-w-lg mx-auto pb-20">
      <h1 className="text-2xl font-bold mb-2">{t('gmail_integration.title')}</h1>
      <p className="text-gray-600 mb-6">
        {t('gmail_integration.subtitle')}
      </p>

      {/* Gmail Connection Card */}
      <div className="bg-white rounded-2xl p-6 shadow-sm mb-4">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-red-400 to-red-600 rounded-2xl flex items-center justify-center">
            <span className="text-3xl">📧</span>
          </div>
          <div className="flex-1">
            <h2 className="font-semibold text-lg">
              {status.connected ? t('gmail_integration.connected_title') : t('gmail_integration.not_connected_title')}
            </h2>
            <p className="text-sm text-gray-500">{status.message}</p>
          </div>
        </div>
        
        {status.connected ? (
          <div className="space-y-3">
            <div className="bg-green-50 rounded-xl p-4 mb-4">
              <h3 className="font-medium text-green-800 mb-2">{t('gmail_integration.features_active')}</h3>
              <ul className="text-sm text-green-700 space-y-1">
                <li>{t('gmail_integration.feature_auto_scan')}</li>
                <li>{t('gmail_integration.feature_bank_import')}</li>
                <li>{t('gmail_integration.feature_ewallet_import')}</li>
                <li>{t('gmail_integration.feature_hourly_sync')}</li>
              </ul>
            </div>
            <button
              onClick={disconnectGmail}
              className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200"
            >
              {t('gmail_integration.disconnect_button')}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-primary-50 rounded-xl p-4">
              <h3 className="font-medium text-primary-800 mb-2">{t('gmail_integration.how_it_works')}</h3>
              <ul className="text-sm text-primary-700 space-y-1">
                <li>{t('gmail_integration.step1')}</li>
                <li>{t('gmail_integration.step2')}</li>
                <li>{t('gmail_integration.step3')}</li>
                <li>{t('gmail_integration.step4')}</li>
              </ul>
            </div>
            
            <div className="bg-gray-50 rounded-xl p-4">
              <h3 className="font-medium text-gray-800 mb-2">{t('gmail_integration.supports')}</h3>
              <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                {polished ? (
                  <>
                    <span className="inline-flex items-center gap-1.5"><Banknote className="w-4 h-4" /> BCA</span>
                    <span className="inline-flex items-center gap-1.5"><Banknote className="w-4 h-4" /> Mandiri</span>
                    <span className="inline-flex items-center gap-1.5"><Banknote className="w-4 h-4" /> BNI</span>
                    <span className="inline-flex items-center gap-1.5"><Banknote className="w-4 h-4" /> BRI</span>
                    <span className="inline-flex items-center gap-1.5"><Wallet className="w-4 h-4" /> GoPay</span>
                    <span className="inline-flex items-center gap-1.5"><Wallet className="w-4 h-4" /> OVO</span>
                    <span className="inline-flex items-center gap-1.5"><Wallet className="w-4 h-4" /> DANA</span>
                    <span className="inline-flex items-center gap-1.5"><Wallet className="w-4 h-4" /> ShopeePay</span>
                  </>
                ) : (
                  <>
                    <span>🏦 BCA</span>
                    <span>🏦 Mandiri</span>
                    <span>🏦 BNI</span>
                    <span>🏦 BRI</span>
                    <span>💚 GoPay</span>
                    <span>💜 OVO</span>
                    <span>💙 DANA</span>
                    <span>💛 ShopeePay</span>
                  </>
                )}
              </div>
            </div>
            
            <button
              onClick={connectGmail}
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  {t('gmail_integration.connecting')}
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M12.545,10.622c-0.141,0-0.283-0.009-0.422-0.027l-3.328,0.917c0.157,0.473,0.474,0.879,0.905,1.146l2.707-1.481L12.545,10.622z"/>
                  </svg>
                  {t('gmail_integration.connect_button')}
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Security Info */}
      <div className="bg-white rounded-xl p-4 shadow-sm">
        <h3 className="font-semibold mb-2 flex items-center gap-2">
          {t('gmail_integration.security')}
        </h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>{t('gmail_integration.security_scope')}</li>
          <li>{t('gmail_integration.security_no_email')}</li>
          <li>{t('gmail_integration.security_token')}</li>
          <li>{t('gmail_integration.security_disconnect')}</li>
        </ul>
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-lg">
          {error}
        </div>
      )}
    </div>
  );
};

export default GmailIntegration;
