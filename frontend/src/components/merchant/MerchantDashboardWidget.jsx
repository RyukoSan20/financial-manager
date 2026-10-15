import { useState, useEffect } from 'react';
import { TrendingUp, CreditCard, Banknote, ShoppingBag, RefreshCw } from 'lucide-react';
import merchantApi from '../../services/merchantApi';
import { formatCurrency } from '../../utils/format';

const MerchantDashboardWidget = ({ merchant, onViewAll }) => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (merchant?.id) {
      loadSummary();
    }
  }, [merchant]);

  const loadSummary = async () => {
    if (!merchant?.id) return;
    
    setLoading(true);
    try {
      const data = await merchantApi.getSummary(merchant.id);
      setSummary(data);
    } catch (err) {
      console.error('Failed to load merchant summary:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!merchant) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
        <p className="text-gray-500 text-center">Belum ada toko terdaftar</p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl shadow-lg text-white p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ShoppingBag size={20} />
          <span className="font-semibold">{merchant.store_name}</span>
        </div>
        <button
          onClick={loadSummary}
          className="p-1 hover:bg-white/20 rounded"
          disabled={loading}
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Today's Sales */}
      <div className="mb-4">
        <p className="text-blue-200 text-sm">Penjualan Hari Ini</p>
        <p className="text-3xl font-bold">
          {summary ? formatCurrency(summary.today_sales) : 'Rp 0'}
        </p>
        <p className="text-blue-200 text-sm">
          {summary?.today_transactions || 0} transaksi
        </p>
      </div>

      {/* Payment Breakdown */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white/10 rounded-lg p-3">
          <div className="flex items-center gap-2 text-blue-200 text-sm">
            <SmartphoneIcon />
            <span>QRIS</span>
          </div>
          <p className="font-semibold">
            {summary ? formatCurrency(summary.total_qris) : 'Rp 0'}
          </p>
        </div>
        <div className="bg-white/10 rounded-lg p-3">
          <div className="flex items-center gap-2 text-blue-200 text-sm">
            <BanknoteIcon />
            <span>Cash</span>
          </div>
          <p className="font-semibold">
            {summary ? formatCurrency(summary.total_cash) : 'Rp 0'}
          </p>
        </div>
      </div>

      {/* Profit */}
      <div className="bg-white/10 rounded-lg p-3">
        <div className="flex items-center gap-2 text-blue-200 text-sm">
          <TrendingUp size={16} />
          <span>Profit Kotor</span>
        </div>
        <p className="font-semibold">
          {summary ? formatCurrency(summary.gross_profit) : 'Rp 0'}
        </p>
      </div>

      {/* Pending Settlement */}
      {summary?.pending_settlement && (
        <div className="mt-3 bg-yellow-500/20 rounded-lg p-3 border border-yellow-500/30">
          <p className="text-yellow-200 text-sm">⚠️ Settlemen belum dilakukan</p>
          <button
            onClick={onViewAll}
            className="mt-2 w-full py-2 bg-yellow-500 hover:bg-yellow-600 rounded-lg font-medium text-sm"
          >
            Tutup Kasir Sekarang
          </button>
        </div>
      )}
    </div>
  );
};

// Simple icon components
const SmartphoneIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
  </svg>
);

const BanknoteIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);

export default MerchantDashboardWidget;
