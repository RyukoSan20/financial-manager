// Feed Page - Transaction review with approve/reject

import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button, Spinner, Badge } from '../../components/ui';
import { 
  CheckCircle, XCircle, Clock, 
  Receipt, AlertCircle, RefreshCw, Filter, InboxIcon
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import KanaheiStationeryMascot from '../../components/mascot/KanaheiStationeryMascot';
import { useTranslation } from '../../i18n';
import { transactionCategoryName } from '../../utils/categoryName';
import { amountSign, isIncoming, isOutgoing } from '../../utils/transactionSign';
import { toast } from '../../contexts/ToastContext';

const FeedPage = () => {
  const { t, language } = useTranslation();
  const navigate = useNavigate();
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
      setError(err.message || t('feed.errorFetch'));
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, t]);

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
      toast.error(t('feed.errorApprove') + ': ' + (err.message || t('common.error')));
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
      toast.error(t('feed.errorReject') + ': ' + (err.message || t('common.error')));
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
      pending: { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', label: t('feed.pending') },
      approved: { color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', label: t('feed.approved') },
      rejected: { color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', label: t('feed.rejected') }
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
      camera_scan: t('feed.sourceCamera'),
      email_forward: t('feed.sourceEmail'),
      whatsapp: t('feed.sourceWhatsapp'),
      manual: t('feed.sourceManual'),
      ocr_receipt: t('feed.sourceOCR'),
      ocr: 'OCR',
      api: 'API',
    };
    return labels[source] || source || t('feed.sourceManual');
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
    { id: 'pending', label: t('feed.pending'), icon: Clock, color: 'yellow' },
    { id: 'approved', label: t('feed.approved'), icon: CheckCircle, color: 'green' },
    { id: 'rejected', label: t('feed.rejected'), icon: XCircle, color: 'red' },
    { id: 'all', label: t('feed.all'), icon: InboxIcon, color: 'gray' },
  ];

  // The active tab is the Kakeibo deep sage, not a slate gray. Note
  // the argument is the tab itself: it used to be handed the id string
  // and read `.color` off it, which is undefined on a string, so every
  // tab fell through to gray no matter which one was active.
  const getTabColorClasses = (tab, isActive) => {
    if (isActive) return 'bg-[#2F4842] text-[#FAF9F6] shadow-sm';
    const colors = {
      yellow: 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-200 dark:hover:bg-yellow-900/40',
      green: 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/40',
      red: 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/40',
      gray: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700',
    };
    return colors[tab?.color] || colors.gray;
  };

  return (
    <div className="container mx-auto p-4 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('feed.title')}</h1>
          <p className="text-gray-500 dark:text-gray-400">{t('feed.subtitle')}</p>
        </div>
        <Button 
          variant="outline" 
          size="sm"
          onClick={handleRefresh}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {t('feed.refresh')}
        </Button>
      </div>

      {/* Stats Cards - Kakeibo bento, each with its own ordinal so the
          four read as a sequence rather than four loose numbers. */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { n: '01', value: stats?.pending_count ?? 0, label: t('feed.pending'), tone: 'text-yellow-600 dark:text-yellow-400', badge: 'bg-[#FDE8E4] text-[#9A5B4C]' },
          { n: '02', value: stats?.approved_today ?? 0, label: t('feed.approvedToday'), tone: 'text-green-600 dark:text-green-400', badge: 'bg-[#E3F2EA] text-[#2F4842]' },
          { n: '03', value: stats?.rejected_today ?? 0, label: t('feed.rejectedToday'), tone: 'text-red-600 dark:text-red-400', badge: 'bg-[#FFF6D6] text-[#8A6D1F]' },
          { n: '04', value: formatCurrency(stats?.total_pending_amount ?? 0), label: t('feed.totalPending'), tone: 'text-gray-900 dark:text-white', badge: 'bg-[#EDE7F6] text-[#5B4B8A]' },
        ].map((card) => (
          <Card key={card.n} className="!p-4 relative overflow-hidden" data-testid={`feed-stat-${card.n}`}>
            {loadingStats && (
              <div className="absolute inset-0 bg-white/50 dark:bg-gray-900/50 flex items-center justify-center">
                <Spinner size="sm" />
              </div>
            )}
            <span className={`inline-flex items-center justify-center rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wide mb-1.5 ${card.badge}`}>
              {card.n}
            </span>
            <div className={`text-2xl font-bold ${card.tone}`}>{card.value}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">{card.label}</div>
          </Card>
        ))}
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
              className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${getTabColorClasses(tab, isActive)}`}
              data-testid={`feed-tab-${tabId}`}
              aria-pressed={isActive}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {count !== null && count > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  tab.color === 'yellow' ? 'bg-yellow-200 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200' :
                  tab.color === 'green' ? 'bg-green-200 text-green-800 dark:bg-green-900/40 dark:text-green-200' :
                  tab.color === 'red' ? 'bg-red-200 text-red-800 dark:bg-red-900/40 dark:text-red-200' :
                  'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-100'
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
        <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
          <Filter className="w-4 h-4 text-primary-600" />
          <span className="text-sm text-primary-700 dark:text-primary-300">
            {t('feed.filter_active')} <strong>{tabs.find(tab => tab.id === activeTab)?.label}</strong>
          </span>
          <button 
            onClick={() => setActiveTab('all')}
            className="ml-auto text-xs text-primary-600 hover:text-primary-800 dark:hover:text-primary-400"
          >
            {t('feed.clear_filter')}
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
              {t('feed.retry')}
            </Button>
          </div>
        </Card>
      )}

      {/* Transaction List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12">
          <Spinner size="lg" />
          <p className="mt-4 text-gray-500 dark:text-gray-400">{t('feed.loading')}</p>
        </div>
      ) : transactions.length === 0 ? (
        <Card className="!p-8 text-center">
          <div className="flex justify-center mb-4" data-testid="feed-empty-mascot">
            <KanaheiStationeryMascot mood="happy" />
          </div>
          <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
            {activeTab === 'pending' 
              ? t('feed.empty_pending') 
              : activeTab === 'approved'
              ? t('feed.empty_approved')
              : activeTab === 'rejected'
              ? t('feed.empty_rejected')
              : t('feed.empty')}
          </p>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
            {activeTab === 'pending' 
              ? t('feed.empty_desc_pending') 
              : t('feed.empty_desc_other')}
          </p>
          <div className="flex gap-2 justify-center flex-wrap">
            <Button onClick={() => navigate('/add?scan=1')} data-testid="feed-empty-scan-cta">
              <Receipt className="w-4 h-4 mr-2" />
              {t('feed.scan_or_import', '+ Scan Struk / Import Email')}
            </Button>
            <Button variant="outline" onClick={() => setActiveTab('pending')}>
              <Clock className="w-4 h-4 mr-2" />
              {t('feed.view_pending')}
            </Button>
            <Button variant="outline" onClick={handleRefresh}>
              <RefreshCw className="w-4 h-4 mr-2" />
              {t('feed.refresh')}
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('feed.transaction_count').replace('%count%', transactions.length)}
              {activeTab !== 'all' && ` · ${t('feed.filter_label').replace('%label%', tabs.find(tab => tab.id === activeTab)?.label)}`}
            </p>
          </div>
          
          {transactions.map(transaction => (
            <Card key={transaction.id} className="!p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Receipt className="w-4 h-4 text-gray-400" />
                    <span className="font-medium text-gray-900 dark:text-white">
                      {transaction.merchant_name || transaction.description || t('feed.transaction')}
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
                          {t('feed.confidence').replace('%value%', Math.round(transaction.confidence_score * 100))}
                        </span>
                      </>
                    )}
                    {transaction.category_name && (
                      <>
                        <span>·</span>
                        <span className="px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded text-xs">
                          {transactionCategoryName(transaction, language)}
                        </span>
                      </>
                    )}
                  </div>
                  
                  {/* Transaction Items */}
                  {transaction.items && transaction.items.length > 0 && (
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 text-sm mb-2">
                      <div className="font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('feed.item_count').replace('%count%', transaction.items.length)}
                      </div>
                      {transaction.items.slice(0, 5).map((item, idx) => (
                        <div key={idx} className="flex justify-between text-gray-600 dark:text-gray-400 py-0.5">
                          <span>{item.quantity || 1}x {item.name}</span>
                          <span className="font-medium">{formatCurrency(item.total_price, item.currency)}</span>
                        </div>
                      ))}
                      {transaction.items.length > 5 && (
                        <div className="text-gray-500 dark:text-gray-400 text-center mt-1 text-xs">
                          {t('feed.more_items').replace('%count%', transaction.items.length - 5)}
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
                    isOutgoing(transaction.type)
                      ? 'text-red-600 dark:text-red-400'
                      : isIncoming(transaction.type)
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-gray-900 dark:text-white'
                  }`}>
                    {amountSign(transaction.type)}
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
                        {t('feed.approve')}
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
                        {t('feed.reject')}
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
                    <span>{t('feed.approved')}</span>
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
                    <span>{t('feed.rejected')}</span>
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
                toast.info(t('feed.pagination_soon'))
              }}>
                {t('feed.load_more')}
              </Button>
            </div>
          )}
        </div>
      )}
      
      {/* How the review works - four numbered steps rather than a
          bulleted list, so the order of the work is visible. */}
      <div className="mt-6" data-testid="feed-workflow-cards">
        <h3 className="font-semibold text-[#1F2421] dark:text-[#FAF9F6] mb-3">
          {t('feed.workflow_title', 'Cara Kerja Review Transaksi')}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { n: '01', badge: 'bg-[#FDE8E4] text-[#9A5B4C]', title: t('feed.step1_title', 'Scan & Import'), body: t('feed.step1_body', 'Transaksi dari scan struk atau Gmail otomatis masuk ke antrian.') },
            { n: '02', badge: 'bg-[#E3F2EA] text-[#2F4842]', title: t('feed.step2_title', 'Filter Status'), body: t('feed.step2_body', 'Pantau transaksi di tab Menunggu, Disetujui, atau Ditolak.') },
            { n: '03', badge: 'bg-[#FFF6D6] text-[#8A6D1F]', title: t('feed.step3_title', 'Periksa Rincian'), body: t('feed.step3_body', 'Cek kecocokan item, kategori, dan nominal sebelum disetujui.') },
            { n: '04', badge: 'bg-[#EDE7F6] text-[#5B4B8A]', title: t('feed.step4_title', 'Setujui ke Buku Kas'), body: t('feed.step4_body', 'Sekali klik untuk mencatat otomatis ke laporan & saldo akun.') },
          ].map((step) => (
            <Card key={step.n} className="!p-4" data-testid={`feed-step-${step.n}`}>
              <span className={`inline-flex items-center justify-center rounded-lg px-2 py-0.5 text-xs font-bold tracking-wide mb-2 ${step.badge}`}>
                {step.n}
              </span>
              <p className="font-semibold text-sm text-[#1F2421] dark:text-[#FAF9F6] mb-1">
                {step.title}
              </p>
              <p className="text-xs leading-relaxed text-[#5C6460] dark:text-gray-400">
                {step.body}
              </p>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FeedPage;
