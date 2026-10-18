// Gmail Integration Page - Email Transaction Auto-Import
import { useState, useEffect } from "react";
import { api } from "../services/api";

const GmailIntegration = () => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      setLoading(true);
      const data = await api.gmail.status();
      setStatus(data);
    } catch (error) {
      console.error("Failed to check status:", error);
    } finally {
      setLoading(false);
    }
  };

  const connectGmail = async () => {
    try {
      setConnecting(true);
      const data = await api.gmail.connect();
      if (data.auth_url) {
        window.open(data.auth_url, "_blank", "width=500,height=700");
      }
    } catch (error) {
      console.error("Failed to connect:", error);
    } finally {
      setConnecting(false);
    }
  };

  const disconnectGmail = async () => {
    if (!confirm("Putuskan koneksi Gmail?")) return;
    try {
      await api.gmail.disconnect();
      checkStatus();
    } catch (error) {
      console.error("Failed to disconnect:", error);
    }
  };

  const syncEmails = async () => {
    try {
      await api.gmail.sync();
      alert("Sync dimulai! Cek notifikasi nanti.");
    } catch (error) {
      console.error("Failed to sync:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-500 to-orange-500 rounded-xl p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">Gmail Integration</h1>
        <p className="opacity-90">Import otomatis transaksi dari email bank & e-wallet</p>
      </div>

      {/* Status Card */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center ${status?.connected ? "bg-green-100" : "bg-gray-100"}`}>
              <span className="text-3xl">{status?.connected ? "✓" : "📧"}</span>
            </div>
            <div>
              <h3 className="text-xl font-semibold">Gmail {status?.connected ? "Terhubung" : "Belum Terhubung"}</h3>
              <p className="text-gray-500">
                {status?.connected ? "Transaksi akan otomatis diimport" : "Hubungkan Gmail untuk import otomatis"}
              </p>
            </div>
          </div>
          
          {!status?.connected ? (
            <button
              onClick={connectGmail}
              disabled={connecting}
              className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
            >
              {connecting ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"/>
                  </svg>
                  Hubungkan Gmail
                </>
              )}
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={syncEmails}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                🔄 Sync Sekarang
              </button>
              <button
                onClick={disconnectGmail}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Putus
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Supported Services */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold mb-4">Email yang Didukung</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { name: "BCA", icon: "🏦", desc: "Transfer & Mutasi" },
            { name: "Mandiri", icon: "🏛️", desc: "Transfer & Info" },
            { name: "GoPay", icon: "🟢", desc: "Pembayaran" },
            { name: "OVO", icon: "🟣", desc: "Transaksi" },
            { name: "DANA", icon: "🔵", desc: "Pembayaran" },
            { name: "Shopee", icon: "🛒", desc: "Order & Pembayaran" },
            { name: "Tokopedia", icon: "🛍️", desc: "Transaksi" },
            { name: "Grab/GoFood", icon: "🚗", desc: "Order & Ride" },
          ].map((service) => (
            <div key={service.name} className="p-4 bg-gray-50 rounded-lg text-center">
              <span className="text-2xl">{service.icon}</span>
              <p className="font-semibold mt-2">{service.name}</p>
              <p className="text-xs text-gray-500">{service.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* How it works */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold mb-4">Cara Kerja</h3>
        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">1</div>
            <div>
              <h4 className="font-semibold">Hubungkan Gmail</h4>
              <p className="text-sm text-gray-500">Izinkan FinManager membaca email dari bank & e-wallet Anda</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">2</div>
            <div>
              <h4 className="font-semibold">Scanning Otomatis</h4>
              <p className="text-sm text-gray-500">Sistem memindai email baru setiap 15 menit</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">3</div>
            <div>
              <h4 className="font-semibold">Ekstrak Transaksi</h4>
              <p className="text-sm text-gray-500">Nominal, tanggal, dan merchant diekstrak otomatis</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center font-bold">✓</div>
            <div>
              <h4 className="font-semibold">Tambahkan ke Ledger</h4>
              <p className="text-sm text-gray-500">Transaksi masuk ke feed untuk review & approve</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GmailIntegration;
