// Feed Page - Transaction review with approve/reject

import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button, Spinner, Badge } from '../../components/ui';
import { 
  CheckCircle, XCircle, Clock, 
  Receipt, AlertCircle, RefreshCw, Filter, InboxIcon
} from 'lucide-react';
import api from '../../services/api';

const FeedPage = () => {
  const [activeTab, setActiveTab] = useState("pending");
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [stats, setStats] = useState(null);
  const [processingIds, setProcessingIds] = useState(new Set());
  const [error, setError] = useState(null);
  const [lastFetch, setLastFetch] = useState(0);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Determine status filter
      let endpoint = '/feed/all';
      if (activeTab === 'pending') {
        endpoint = '/feed/pending'; // Use dedicated endpoint
      } else if (activeTab === 'approved') {
        endpoint = '/feed/all?status=approved';
      } else if (activeTab === 'rejected') {
        endpoint = '/feed/all?status=rejected';
      }
      // 'all' tab: just /feed/all (no filter)
      
      const response = await api.request(endpoint);
      
      // API returns direct array or object with data
      const data = response?.data || response || [];
      setTransactions(Array.isArray(data) ? data : []);
      
      // Update last fetch timestamp
      setLastFetch(Date.now());
    } catch (err) {
      console.error("Failed to fetch transactions:", err);
      setError(err.message || 'Gagal memuat transaksi');
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const response = await api.request('/feed/stats');
      
      // API returns direct object or object with data
      const data = response?.data || response || {};
      
      setStats({
        pending_count: data.pending_count ?? data.pending ?? 0,
        approved_today: data.approved_today ?? data.approved ?? 0,
        rejected_today: data.rejected_today ?? data.rejected ?? 0,
        total_pending_amount: data.total_pending_amount ?? data.total_pending ?? 0,
      });
    } catch (err) {
      console.error("Failed to fetch stats:", err);
      // Graceful fallback - don't crash
      setStats({
        pending_count: 0,
        approved_today: 0,
        rejected_today: 0,
        total_pending_amount: 0,
      });
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleApprove = async (transactionId) => {
    setProcessingIds(prev => new Set([...prev, transactionId]));
    try {
      await api.request(`/feed/approve/${transactionId}`, { method: 'POST' });
      // Optimistic update
      setTransactions(prev => 
        prev.map(t => t.id === transactionId ? {...t, status: 'approved'} : t)
      );
      // Refresh stats
      fetchStats();
    } catch (err) {
      console.error("Failed to approve:", err);
      alert('Gagal menyetujui transaksi: ' + (err.message || 'Unknown error'));
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(transactionId);
        return next;
      });
    }
  };

  const handleReject = async (transactionId) => {
    setProcessingIds(prev => new Set([...prev, transactionId]));
    try {
      await api.request(`/feed/reject/${transactionId}`, { method: 'POST' });
      // Optimistic update
      setTransactions(prev => 
        prev.map(t => t.id === transactionId ? {...t, status: 'rejected'} : t)
      );
      // Refresh stats
      fetchStats();
    } catch (err) {
      console.error("Failed to reject:", err);
      alert('Gagal menolak transaksi: ' + (err.message || 'Unknown error'));
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(transactionId);
        return next;
      });
    }
  };

  const formatCurrency = (amount, currency = 'IDR') => {
    if (!amount && amount !== 0) return 'Rp 0';
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(num)) return 'Rp 0';
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: currency || 'IDR',
      minimumFractionDigits: 0
    }).format(num);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', label: 'Menunggu' },
      approved: { color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', label: 'Disetujui' },
      rejected: { color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', label: 'Ditolak' }
    };
    const config = statusConfig[status] || statusConfig.pending;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        {config.label}
      </span>
    );
  };

  const getSourceLabel = (source) => {
    const labels = {
      camera_scan: 'Kamera',
      email_forward: 'Email',
      whatsapp: 'WhatsApp',
      manual: 'Manual',
      ocr_receipt: 'OCR Scan',
      ocr: 'OCR',
      api: 'API',
    };
    return labels[source] || source || 'Manual';
  };

  const getTabCount = (tab) => {
    if (!stats) return null;
    switch (tab) {
      case 'pending': return stats.pending_count;
      case 'approved': return null; // No count for approved
      case 'rejected': return null; // No count for rejected
      default: return null;
    }
  };

  const handleRefresh = () => {
    fetchTransactions();
    fetchStats();
  };

  const tabs = [
    { id: 'pending', label: 'Menunggu', icon: Clock, color: 'yellow' },
    { id: 'approved', label: 'Disetujui', icon: CheckCircle, color: 'green' },
    { id: 'rejected', label: 'Ditolak', icon: XCircle, color: 'red' },
    { id: 'all', label: 'Semua', icon: InboxIcon, color: 'gray' },
  ];

  const getTabColorClasses = (tabId, isActive) => {
    const colors = {
      yellow: isActive ? 'bg-yellow-500 text-white' : 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-200 dark:hover:bg-yellow-900/40',
      green: isActive ? 'bg-green-500 text-white' : 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/40',
      red: isActive ? 'bg-red-500 text-white' : 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/40',
      gray: isActive ? 'bg-gray-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700',
    };
    return colors[tabId.color] || colors.gray;
  };

  return (
    <div className="container mx-auto p-4 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Feed & Review</h1>
          <p className="text-gray-500 dark:text-gray-400">Tinjau dan setujui transaksi masuk</p>
        </div>
        <Button 
          variant="outline" 
          size="sm"
          onClick={handleRefresh}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="!p-4 relative overflow-hidden">
          {loadingStats && (
            <div className="absolute inset-0 bg-white/50 dark:bg-gray-900/50 flex items-center justify-center">
              <Spinner size="sm" />
            </div>
          )}
          <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
            {stats?.pending_count ?? 0}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Menunggu</div>
        </Card>
        <Card className="!p-4 relative overflow-hidden">
          {loadingStats && (
            <div className="absolute inset-0 bg-white/50 dark:bg-gray-900/50 flex items-center justify-center">
              <Spinner size="sm" />
            </div>
          )}
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {stats?.approved_today ?? 0}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Disetujui Hari Ini</div>
        </Card>
        <Card className="!p-4 relative overflow-hidden">
          {loadingStats && (
            <div className="absolute inset-0 bg-white/50 dark:bg-gray-900/50 flex items-center justify-center">
              <Spinner size="sm" />
            </div>
          )}
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">
            {stats?.rejected_today ?? 0}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Ditolak Hari Ini</div>
        </Card>
        <Card className="!p-4 relative overflow-hidden">
          {loadingStats && (
            <div className="absolute inset-0 bg-white/50 dark:bg-gray-900/50 flex items-center justify-center">
              <Spinner size="sm" />
            </div>
          )}
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(stats?.total_pending_amount ?? 0)}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Total Tertunda</div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {['pending', 'approved', 'rejected', 'all'].map(tabId => {
          const tab = tabs.find(t => t.id === tabId);
          if (!tab) return null;
          const Icon = tab.icon;
          const isActive = activeTab === tabId;
          const count = getTabCount(tabId);
          
          return (
            <button
              key={tabId}
              onClick={() => setActiveTab(tabId)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${getTabColorClasses(tabId, isActive)}`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {count !== null && count > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  tab.color === 'yellow' ? 'bg-yellow-200 text-yellow-800' :
                  tab.color === 'green' ? 'bg-green-200 text-green-800' :
                  tab.color === 'red' ? 'bg-red-200 text-red-800' :
                  'bg-gray-200 text-gray-800'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Active Filter Indicator */}
      {activeTab !== 'all' && (
        <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <Filter className="w-4 h-4 text-blue-600" />
          <span className="text-sm text-blue-700 dark:text-blue-300">
            Filter aktif: <strong>{tabs.find(t => t.id === activeTab)?.label}</strong>
          </span>
          <button 
            onClick={() => setActiveTab('all')}
            className="ml-auto text-xs text-blue-600 hover:text-blue-800 dark:hover:text-blue-400"
          >
            Clear filter
          </button>
        </div>
      )}

      {/* Error State */}
      {error && (
        <Card className="!p-4 mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="w-4 h-4 mr-1" />
              Coba Lagi
            </Button>
          </div>
        </Card>
      )}

      {/* Transaction List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12">
          <Spinner size="lg" />
          <p className="mt-4 text-gray-500 dark:text-gray-400">Memuat transaksi...</p>
        </div>
      ) : transactions.length === 0 ? (
        <Card className="!p-8 text-center">
          <InboxIcon className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
            {activeTab === 'pending' 
              ? 'Tidak ada transaksi menunggu persetujuan' 
              : activeTab === 'approved'
              ? 'Belum ada transaksi yang disetujui'
              : activeTab === 'rejected'
              ? 'Belum ada transaksi yang ditolak'
              : 'Belum ada transaksi'}
          </p>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
            {activeTab === 'pending' 
              ? 'Transaksi dari scan receipt atau import email akan muncul di sini untuk ditinjau.' 
              : 'Transaksi akan muncul setelah Anda menyetujui atau menolak transaksi masuk.'}
          </p>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" onClick={() => setActiveTab('pending')}>
              <Clock className="w-4 h-4 mr-2" />
              Lihat Menunggu
            </Button>
            <Button variant="outline" onClick={handleRefresh}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {transactions.length} transaksi
              {activeTab !== 'all' && ` · Filter: ${tabs.find(t => t.id === activeTab)?.label}`}
            </p>
          </div>
          
          {transactions.map(transaction => (
            <Card key={transaction.id} className="!p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Receipt className="w-4 h-4 text-gray-400" />
                    <span className="font-medium text-gray-900 dark:text-white">
                      {transaction.merchant_name || transaction.description || 'Transaksi'}
                    </span>
                    {getStatusBadge(transaction.status)}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-2 flex-wrap">
                    <span>{formatDate(transaction.date)}</span>
                    {transaction.account_name && (
                      <>
                        <span>·</span>
                        <span>{transaction.account_name}</span>
                      </>
                    )}
                    {transaction.source && (
                      <>
                        <span>·</span>
                        <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">
                          {getSourceLabel(transaction.source)}
                        </span>
                      </>
                    )}
                    {transaction.confidence_score !== null && transaction.confidence_score !== undefined && (
                      <>
                        <span>·</span>
                        <span className="text-xs">
                          {Math.round(transaction.confidence_score * 100)}% confidence
                        </span>
                      </>
                    )}
                    {transaction.category_name && (
                      <>
                        <span>·</span>
                        <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs">
                          {transaction.category_name}
                        </span>
                      </>
                    )}
                  </div>
                  
                  {/* Transaction Items */}
                  {transaction.items && transaction.items.length > 0 && (
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 text-sm mb-2">
                      <div className="font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Item ({transaction.items.length})
                      </div>
                      {transaction.items.slice(0, 5).map((item, idx) => (
                        <div key={idx} className="flex justify-between text-gray-600 dark:text-gray-400 py-0.5">
                          <span>{item.quantity || 1}x {item.name}</span>
                          <span className="font-medium">{formatCurrency(item.total_price)}</span>
                        </div>
                      ))}
                      {transaction.items.length > 5 && (
                        <div className="text-gray-500 dark:text-gray-500 text-center mt-1 text-xs">
                          +{transaction.items.length - 5} item lainnya
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Notes */}
                  {transaction.notes && (
                    <div className="text-sm text-gray-600 dark:text-gray-400 italic mt-2 px-2 py-1 bg-gray-50 dark:bg-gray-800/30 rounded">
                      {transaction.notes}
                    </div>
                  )}
                </div>
                
                <div className="text-right ml-4 flex-shrink-0">
                  <div className={`text-xl font-bold ${
                    transaction.type === 'expense' 
                      ? 'text-red-600 dark:text-red-400' 
                      : transaction.type === 'income'
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-gray-900 dark:text-white'
                  }`}>
                    {transaction.type === 'expense' ? '-' : transaction.type === 'income' ? '+' : ''}
                    {formatCurrency(transaction.amount, transaction.currency)}
                  </div>
                </div>
              </div>
              
              {/* Action Buttons */}
              {transaction.status === 'pending' && (
                <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <Button 
                    onClick={() => handleApprove(transaction.id)}
                    disabled={processingIds.has(transaction.id)}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  >
                    {processingIds.has(transaction.id) ? (
                      <Spinner size="sm" />
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Setujui
                      </>
                    )}
                  </Button>
                  <Button 
                    onClick={() => handleReject(transaction.id)}
                    disabled={processingIds.has(transaction.id)}
                    variant="outline"
                    className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 border-red-200 dark:border-red-800"
                  >
                    {processingIds.has(transaction.id) ? (
                      <Spinner size="sm" />
                    ) : (
                      <>
                        <XCircle className="w-4 h-4 mr-2" />
                        Tolak
                      </>
                    )}
                  </Button>
                </div>
              )}
              
              {/* Already Reviewed Indicator */}
              {transaction.status === 'approved' && (
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm">
                    <CheckCircle className="w-4 h-4" />
                    <span>Disetujui</span>
                    {transaction.updated_at && (
                      <span className="text-gray-400">
                        · {formatDate(transaction.updated_at)}
                      </span>
                    )}
                  </div>
                </div>
              )}
              
              {transaction.status === 'rejected' && (
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
                    <XCircle className="w-4 h-4" />
                    <span>Ditolak</span>
                    {transaction.updated_at && (
                      <span className="text-gray-400">
                        · {formatDate(transaction.updated_at)}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </Card>
          ))}
          
          {/* Load More */}
          {transactions.length >= 50 && (
            <div className="text-center py-4">
              <Button variant="outline" onClick={() => {
                // Could implement pagination here
                alert('Pagination coming soon!')
              }}>
                Load More
              </Button>
            </div>
          )}
        </div>
      )}
      
      {/* Quick Tips */}
      <Card className="!p-4 mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
        <h3 className="font-medium text-blue-800 dark:text-blue-200 mb-2 flex items-center gap-2">
          💡 Tips
        </h3>
        <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
          <li>• Gunakan tab untuk memfilter transaksi berdasarkan status</li>
          <li>• Transaksi dari scan receipt atau import email akan masuk sebagai "Menunggu"</li>
          <li>• Setujui transaksi untuk menambahkan ke laporan keuangan Anda</li>
          <li>• Tolak transaksi yang tidak valid untuk menghapusnya dari antrian</li>
        </ul>
      </Card>
    </div>
  );
};

export default FeedPage;
