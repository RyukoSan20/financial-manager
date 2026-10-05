// Feed Page - Transaction review with approve/reject

import React, { useState, useEffect } from 'react';
import { Card, Button, Spinner, Badge } from '../ui';
import { 
  CheckCircle, XCircle, Clock, 
  Receipt, AlertCircle, RefreshCw, Camera
} from 'lucide-react';
import api from '../../services/api';

const FeedPage = () => {
  const [activeTab, setActiveTab] = useState("pending");
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [processingIds, setProcessingIds] = useState(new Set());

  useEffect(() => {
    fetchTransactions();
    fetchStats();
  }, [activeTab]);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const status = activeTab === "all" ? '' : activeTab;
      const params = status ? `?status=${status}` : '';
      const response = await api.get(`/feed/all${params}`);
      setTransactions(response.data || []);
    } catch (error) {
      console.error("Failed to fetch transactions:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get('/feed/stats');
      setStats(response.data || response);
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  };

  const handleApprove = async (transactionId) => {
    setProcessingIds(prev => new Set([...prev, transactionId]));
    try {
      await api.post(`/feed/approve/${transactionId}`);
      setTransactions(prev => 
        prev.map(t => t.id === transactionId ? {...t, status: 'approved'} : t)
      );
      fetchStats();
    } catch (error) {
      console.error("Failed to approve:", error);
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
      await api.post(`/feed/reject/${transactionId}`);
      setTransactions(prev => 
        prev.map(t => t.id === transactionId ? {...t, status: 'rejected'} : t)
      );
      fetchStats();
    } catch (error) {
      console.error("Failed to reject:", error);
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(transactionId);
        return next;
      });
    }
  };

  const formatCurrency = (amount, currency = 'IDR') => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0
    }).format(amount);
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
      ocr_receipt: 'OCR Scan'
    };
    return labels[source] || source || 'Manual';
  };

  return (
    <div className="container mx-auto p-4 max-w-3xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Feed & Review</h1>
        <p className="text-gray-500 dark:text-gray-400">Tinjau dan setujui transaksi masuk</p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="!p-4">
            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
              {stats.pending_count || 0}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Menunggu</div>
          </Card>
          <Card className="!p-4">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {stats.approved_today || 0}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Disetujui Hari Ini</div>
          </Card>
          <Card className="!p-4">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {stats.rejected_today || 0}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Ditolak Hari Ini</div>
          </Card>
          <Card className="!p-4">
            <div className="text-2xl font-bold">
              {formatCurrency(stats.total_pending_amount || 0)}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Total Tertunda</div>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab("pending")}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            activeTab === "pending"
              ? 'bg-yellow-500 text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          <Clock className="w-4 h-4" />
          Menunggu
        </button>
        <button
          onClick={() => setActiveTab("approved")}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            activeTab === "approved"
              ? 'bg-green-500 text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          <CheckCircle className="w-4 h-4" />
          Disetujui
        </button>
        <button
          onClick={() => setActiveTab("all")}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            activeTab === "all"
              ? 'bg-primary-600 text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          <AlertCircle className="w-4 h-4" />
          Semua
        </button>
      </div>

      {/* Transaction List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : transactions.length === 0 ? (
        <Card className="!p-8 text-center">
          <Receipt className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Tidak ada transaksi</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {transactions.map(transaction => (
            <Card key={transaction.id} className="!p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Receipt className="w-4 h-4 text-gray-400" />
                    <span className="font-medium text-gray-900 dark:text-white">
                      {transaction.merchant_name || transaction.description || 'Transaksi'}
                    </span>
                    {getStatusBadge(transaction.status)}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-2">
                    <span>{formatDate(transaction.date)}</span>
                    {transaction.account_name && (
                      <>
                        <span>•</span>
                        <span>{transaction.account_name}</span>
                      </>
                    )}
                    <span>•</span>
                    <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">
                      {getSourceLabel(transaction.source)}
                    </span>
                    {transaction.confidence_score && (
                      <>
                        <span>•</span>
                        <span>{Math.round(transaction.confidence_score * 100)}% confidence</span>
                      </>
                    )}
                  </div>
                  {transaction.items && transaction.items.length > 0 && (
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 text-sm">
                      <div className="font-medium text-gray-700 dark:text-gray-300 mb-1">Items:</div>
                      {transaction.items.slice(0, 3).map((item, idx) => (
                        <div key={idx} className="flex justify-between text-gray-600 dark:text-gray-400">
                          <span>{item.quantity}x {item.name}</span>
                          <span>{formatCurrency(item.total_price)}</span>
                        </div>
                      ))}
                      {transaction.items.length > 3 && (
                        <div className="text-gray-500 dark:text-gray-500 text-center mt-1">
                          +{transaction.items.length - 3} more items
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="text-right ml-4">
                  <div className={`text-xl font-bold ${
                    transaction.type === 'expense' 
                      ? 'text-red-600 dark:text-red-400' 
                      : 'text-green-600 dark:text-green-400'
                  }`}>
                    {transaction.type === 'expense' ? '-' : '+'}
                    {formatCurrency(transaction.amount, transaction.currency)}
                  </div>
                </div>
              </div>
              
              {transaction.status === 'pending' && (
                <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <Button 
                    onClick={() => handleApprove(transaction.id)}
                    disabled={processingIds.has(transaction.id)}
                    className="flex-1 bg-green-600 hover:bg-green-700"
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
                    className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Tolak
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default FeedPage;
