// Gmail Integration Page
import { useState, useEffect } from "react";

const GmailIntegration = () => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ connected: false });
  const [error, setError] = useState(null);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/integrations/gmail/status`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      if (res.ok) setStatus(await res.json());
    } catch (e) {
      setStatus({ connected: false });
    }
  };

  const connectGmail = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/integrations/gmail/connect`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      const data = await res.json();
      if (data.auth_url) window.location.href = data.auth_url;
      else setError("OAuth URL tidak tersedia");
    } catch (e) {
      setError("Gagal connect Gmail");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 max-w-lg mx-auto pb-20">
      <h1 className="text-2xl font-bold mb-4">Gmail Integration</h1>
      <p className="text-gray-600 mb-6">Import otomatis transaksi dari email bank & e-wallet</p>

      <div className="bg-white rounded-2xl p-6 shadow-sm mb-4">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center text-3xl">📧</div>
          <div>
            <h2 className="font-semibold">{status.connected ? "Gmail Terhubung" : "Gmail Belum Terhubung"}</h2>
            <p className="text-sm text-gray-500">{status.message || "Hubungkan untuk import otomatis"}</p>
          </div>
        </div>
        
        {!status.connected && (
          <button onClick={connectGmail} disabled={loading}
            className="w-full py-3 bg-blue-500 text-white rounded-xl font-medium disabled:opacity-50">
            {loading ? "Memuat..." : "🔗 Hubungkan Gmail"}
          </button>
        )}
      </div>

      <div className="bg-blue-50 rounded-xl p-4">
        <h3 className="font-semibold mb-2">💡 Mendukung:</h3>
        <ul className="text-sm space-y-1 text-gray-600">
          <li>• Email bank (BCA, BNI, Mandiri, dll)</li>
          <li>• Email e-wallet (GoPay, OVO, DANA)</li>
          <li>• Email transfer & mutasi</li>
        </ul>
      </div>

      {error && <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-lg">{error}</div>}
    </div>
  );
};

export default GmailIntegration;
