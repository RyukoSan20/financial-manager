import { useState, useEffect, useCallback } from 'react';
import React from 'react';
import { Card, Button, Badge, Spinner } from '../components/ui';
import { 
  TrendingUp, TrendingDown, Wallet, PiggyBank, RefreshCw, 
  CheckCircle, AlertTriangle, Clock, Target, BarChart3
} from 'lucide-react';
import { formatCurrency, formatNumber, formatPercent } from '../utils/format';
import api from '../services/api';
import { useTranslation } from '../i18n';

export const Dashboard = ({ onAddTransaction, onScanReceipt }) => {
  const { t } = useTranslation();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [timeFilter, setTimeFilter] = useState('monthly');

  // Initialize dates
  useEffect(() => {
    const now = new Date();
    const end = now.toISOString().split('T')[0];
    let start;
    
    if (timeFilter === 'daily') {
      start = end;
    } else if (timeFilter === 'weekly') {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      start = d.toISOString().split('T')[0];
    } else if (timeFilter === 'monthly') {
      start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    } else {
      start = `${now.getFullYear()}-01-01`;
    }
    
    fetchData(start, end);
  }, [timeFilter]);

  const fetchData = async (startDate, endDate) => {
    setLoading(true);
    setError(null);
    
    try {
      // Fetch summary and transactions in parallel
      const [summaryRes, txRes] = await Promise.all([
        api.dashboard.summary(startDate, endDate).catch(() => null),
        api.transactions.list({ start_date: startDate, end_date: endDate, limit: 10 }).catch(() => null)
      ]);
      
      if (summaryRes) setSummary(summaryRes);
      if (txRes) {
        const txs = Array.isArray(txRes) ? txRes : (txRes.transactions || []);
        setTransactions(txs);
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      setError('Gagal memuat data');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    const now = new Date();
    const end = now.toISOString().split('T')[0];
    let start;
    
    if (timeFilter === 'daily') start = end;
    else if (timeFilter === 'weekly') {
      const d = new Date(now); d.setDate(d.getDate() - 7);
      start = d.toISOString().split('T')[0];
    } else if (timeFilter === 'monthly') {
      start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    } else {
      start = `${now.getFullYear()}-01-01`;
    }
    
    fetchData(start, end);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      {/* Header with Filter */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('dashboard.title', 'Dashboard')}
          </h1>
          <p className="text-sm text-gray-500">
            {new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-2">
          {/* Time Filter */}
          <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            {['daily', 'weekly', 'monthly', 'yearly'].map(filter => (
              <button
                key={filter}
                onClick={() => setTimeFilter(filter)}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  timeFilter === filter 
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow' 
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                {filter === 'daily' ? 'Harian' : filter === 'weekly' ? 'Mingguan' : filter === 'monthly' ? 'Bulanan' : 'Tahunan'}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {error && (
        <Card className="p-4 bg-red-50 border-red-200">
          <p className="text-red-600">{error}</p>
          <Button onClick={handleRefresh} className="mt-2">Coba Lagi</Button>
        </Card>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4 bg-green-50 dark:bg-green-900/20">
            <p className="text-sm text-green-600 dark:text-green-400">Saldo</p>
            <p className="text-2xl font-bold text-green-700 dark:text-green-300">
              {formatCurrency(summary.total_balance || 0)}
            </p>
          </Card>
          
          <Card className="p-4 bg-blue-50 dark:bg-blue-900/20">
            <p className="text-sm text-blue-600 dark:text-blue-400">Pemasukan</p>
            <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
              {formatCurrency(summary.total_income || 0)}
            </p>
          </Card>
          
          <Card className="p-4 bg-red-50 dark:bg-red-900/20">
            <p className="text-sm text-red-600 dark:text-red-400">Pengeluaran</p>
            <p className="text-2xl font-bold text-red-700 dark:text-red-300">
              {formatCurrency(summary.total_expense || 0)}
            </p>
          </Card>
          
          <Card className="p-4 bg-purple-50 dark:bg-purple-900/20">
            <p className="text-sm text-purple-600 dark:text-purple-400">Arus Kas</p>
            <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
              {formatCurrency(summary.net_cash_flow || 0)}
            </p>
          </Card>
        </div>
      )}

      {/* Financial Status */}
      {summary && (
        <Card className={`p-4 ${
          (summary.expense_ratio || 0) >= 100 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {(summary.expense_ratio || 0) >= 100 ? (
                <AlertTriangle className="w-8 h-8 text-red-500" />
              ) : (
                <CheckCircle className="w-8 h-8 text-green-500" />
              )}
              <div>
                <p className="font-bold text-lg">
                  {(summary.expense_ratio || 0) >= 100 ? 'Pengeluaran Melebihi Batas!' : 'Keuangan Sehat'}
                </p>
                <p className="text-sm opacity-80">
                  Rasio pengeluaran: {formatPercent(summary.expense_ratio || 0)}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold">{formatPercent(summary.saving_rate_percent || 0)}</p>
              <p className="text-sm opacity-80">Tabungan</p>
            </div>
          </div>
        </Card>
      )}

      {/* Budget Progress */}
      {summary && summary.total_budget > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <PiggyBank className="w-5 h-5 text-pink-500" />
              <h3 className="font-semibold">Anggaran</h3>
            </div>
            <span className="text-sm text-gray-500">
              {formatCurrency(summary.total_spent || 0)} / {formatCurrency(summary.total_budget)}
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
            <div 
              className={`h-3 rounded-full transition-all ${
                (summary.budget_utilization || 0) > 100 ? 'bg-red-500' : 
                (summary.budget_utilization || 0) > 80 ? 'bg-yellow-500' : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(100, summary.budget_utilization || 0)}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-sm text-gray-500">
            <span>Terpakai: {formatPercent(summary.budget_utilization || 0)}</span>
            <span>Sisa: {formatCurrency(summary.remaining_budget || 0)}</span>
          </div>
        </Card>
      )}

      {/* Recent Transactions */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-500" />
            Transaksi Terbaru
          </h3>
          <Button variant="ghost" size="sm" onClick={() => window.location.href = '/transactions'}>
            Lihat Semua
          </Button>
        </div>
        
        {transactions && transactions.length > 0 ? (
          <div className="space-y-3">
            {transactions.slice(0, 5).map((tx, idx) => (
              <div key={tx.id || idx} className="flex items-center justify-between py-2 border-b dark:border-gray-700 last:border-0">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    tx.type === 'income' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'
                  }`}>
                    {tx.type === 'income' ? (
                      <TrendingUp className="w-5 h-5 text-green-600" />
                    ) : (
                      <TrendingDown className="w-5 h-5 text-red-600" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {tx.description || 'Transaksi'}
                    </p>
                    <p className="text-sm text-gray-500">
                      {tx.category_name || tx.category || 'Lainnya'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-semibold ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                    {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount || 0)}
                  </p>
                  <p className="text-xs text-gray-400">
                    {tx.date ? new Date(tx.date).toLocaleDateString('id-ID') : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
            <Wallet className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Belum ada transaksi</p>
            <p className="text-sm">Tambahkan transaksi pertama Anda</p>
          </div>
        )}
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Button variant="outline" className="h-20 flex-col gap-2" onClick={() => window.location.href = '/market'}>
          <BarChart3 className="w-6 h-6" />
          <span className="text-sm">Pasar</span>
        </Button>
        <Button variant="outline" className="h-20 flex-col gap-2" onClick={() => window.location.href = '/budgets'}>
          <PiggyBank className="w-6 h-6" />
          <span className="text-sm">Anggaran</span>
        </Button>
        <Button variant="outline" className="h-20 flex-col gap-2" onClick={() => window.location.href = '/goals'}>
          <Target className="w-6 h-6" />
          <span className="text-sm">Target</span>
        </Button>
        <Button variant="outline" className="h-20 flex-col gap-2" onClick={() => window.location.href = '/analytics'}>
          <TrendingUp className="w-6 h-6" />
          <span className="text-sm">Analitik</span>
        </Button>
      </div>
    </div>
  );
};

export default Dashboard;
