import { useState, useEffect, useCallback } from 'react';
import { Card, Button, Spinner, Badge } from '../components/ui';
import { 
  TrendingUp, TrendingDown, Wallet, PieChart, 
  Plus, Receipt, FileText, PiggyBank,
  ChevronRight, RefreshCw, Camera, CheckCircle, XCircle, Clock
} from 'lucide-react';
import api from '../services/api';
import { formatCurrency, formatDate } from '../utils/format';
import { useTranslation } from '../i18n';

// Time period options
const TIME_PERIODS = [
  { value: 'today', label: 'time.today', days: 1 },
  { value: 'week', label: 'time.this_week', days: 7 },
  { value: 'month', label: 'time.this_month', days: 30 },
  { value: 'year', label: 'time.this_year', days: 365 },
];

export const Dashboard = ({ onAddTransaction, onScanReceipt }) => {
  const { t, language } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [timePeriod, setTimePeriod] = useState('month');
  const [summary, setSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState([]);
  const [pendingFeed, setPendingFeed] = useState([]);
  const [feedStats, setFeedStats] = useState(null);
  const [processingIds, setProcessingIds] = useState(new Set());
  
  // Get date range based on time period
  const getDateRange = () => {
    const end = new Date();
    const start = new Date();
    
    if (timePeriod === 'today') {
      start.setHours(0, 0, 0, 0);
    } else if (timePeriod === 'week') {
      start.setDate(end.getDate() - 7);
    } else if (timePeriod === 'month') {
      start.setMonth(end.getMonth(), 1);
    } else if (timePeriod === 'year') {
      start.setMonth(0, 1);
    }
    
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    };
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { startDate, endDate } = getDateRange();
      
      // Fetch all data in parallel including Feed stats
      const [summaryRes, transRes, categoryRes, feedStatsRes, pendingRes] = await Promise.allSettled([
        api.dashboard.summary(startDate, endDate),
        api.transactions.list({ start_date: startDate, end_date: endDate, limit: 10 }),
        api.analytics.expenseBreakdown({ start_date: startDate, end_date: endDate, type: 'expense' }),
        api.get('/feed/stats').catch(() => null),
        api.get('/feed/pending?limit=5').catch(() => ({ data: [] })),
      ]);

      if (summaryRes.status === 'fulfilled') setSummary(summaryRes.value);
      if (transRes.status === 'fulfilled') {
        const data = transRes.value;
        setTransactions(Array.isArray(data) ? data : (data.transactions || []));
      }
      if (categoryRes.status === 'fulfilled') {
        const data = categoryRes.value;
        setCategoryBreakdown(data.categories || data || []);
      }
      if (feedStatsRes.status === 'fulfilled' && feedStatsRes.value) {
        setFeedStats(feedStatsRes.value.data || feedStatsRes.value);
      }
      if (pendingRes.status === 'fulfilled') {
        const data = pendingRes.value;
        setPendingFeed(pendingRes.value.data?.data || pendingRes.value.data || []);
      }
    } catch (error) {
      console.error('Dashboard fetch error:', error);
    } finally {
      setLoading(false);
    }
  }, [timePeriod]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Calculate values
  const income = summary?.total_income || 0;
  const expense = summary?.total_expense || 0;
  const balance = income - expense;

  // Handle feed approve/reject
  const handleFeedAction = async (id, action) => {
    setProcessingIds(prev => new Set([...prev, id]));
    try {
      await api.post(`/feed/${action}/${id}`);
      setPendingFeed(prev => prev.filter(item => item.id !== id));
      if (feedStats) {
        setFeedStats(prev => ({
          ...prev,
          pending_count: prev.pending_count - 1,
          ...(action === 'approve' ? { approved_today: prev.approved_today + 1 } : { rejected_today: prev.rejected_today + 1 })
        }));
      }
    } catch (error) {
      console.error(`Failed to ${action} transaction:`, error);
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const getTypeColor = (type) => {
    if (type === 'income') return 'text-success-600';
    if (type === 'expense') return 'text-danger-600';
    return 'text-gray-600';
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header with Scan Button */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t('dashboard.title')}
          </h1>
          <p className="text-gray-500 mt-1">
            {new Date().toLocaleDateString(language === 'id' ? 'id-ID' : language === 'ja' ? 'ja-JP' : 'en-US', { 
              month: 'long', 
              year: 'numeric' 
            })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          {onScanReceipt && (
            <Button variant="default" size="sm" onClick={onScanReceipt} className="gap-2">
              <Camera className="w-4 h-4" />
              {t('dashboard.scan_receipt')}
            </Button>
          )}
        </div>
      </div>

      {/* Feed & Review Banner */}
      {feedStats && feedStats.pending_count > 0 && (
        <Card className="!p-4 border-l-4 border-l-yellow-500 bg-yellow-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">
                  {t('feed.pendingCount')}: {feedStats.pending_count}
                </p>
                <p className="text-sm text-gray-500">
                  {formatCurrency(feedStats.total_pending_amount)} {t('feed.totalPending')}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => window.location.href = '/feed'}>
              {t('feed.pending')} <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </Card>
      )}

      {/* Time Period Selector */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {TIME_PERIODS.map((period) => (
          <button
            key={period.value}
            onClick={() => setTimePeriod(period.value)}
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
              timePeriod === period.value
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {t(period.label)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Spinner size="lg" />
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="!p-5">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-lg bg-success-100 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-success-600" />
                </div>
              </div>
              <p className="text-sm text-gray-500 mt-3">{t('dashboard.income')}</p>
              <p className="text-xl font-bold text-success-600 mt-1">
                {formatCurrency(income)}
              </p>
            </Card>

            <Card className="!p-5">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-lg bg-danger-100 flex items-center justify-center">
                  <TrendingDown className="w-5 h-5 text-danger-600" />
                </div>
              </div>
              <p className="text-sm text-gray-500 mt-3">{t('dashboard.expense')}</p>
              <p className="text-xl font-bold text-danger-600 mt-1">
                {formatCurrency(expense)}
              </p>
            </Card>

            <Card className="!p-5">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                balance >= 0 ? 'bg-success-100' : 'bg-danger-100'
              }`}>
                <Wallet className={`w-5 h-5 ${balance >= 0 ? 'text-success-600' : 'text-danger-600'}`} />
              </div>
              <p className="text-sm text-gray-500 mt-3">{t('dashboard.net_flow')}</p>
              <p className={`text-xl font-bold mt-1 ${balance >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                {balance >= 0 ? '+' : ''}{formatCurrency(balance)}
              </p>
            </Card>

            <Card className="!p-5">
              <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
                <Receipt className="w-5 h-5 text-primary-600" />
              </div>
              <p className="text-sm text-gray-500 mt-3">{t('dashboard.transactions_this_month')}</p>
              <p className="text-xl font-bold text-gray-900 mt-1">
                {summary?.transaction_count || 0}
              </p>
            </Card>
          </div>

          {/* Pending Feed Cards */}
          {pendingFeed.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-yellow-500" />
                {t('feed.pending')}
              </h2>
              {pendingFeed.map((item) => (
                <Card key={item.id} className="!p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Receipt className="w-4 h-4 text-gray-400" />
                        <span className="font-medium">{item.merchant_name || item.description || 'Transaction'}</span>
                        <Badge variant="outline" className="text-xs">
                          {item.source || 'OCR'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                        <span>{formatDate(item.date, language)}</span>
                        <span>•</span>
                        <span className={item.type === 'expense' ? 'text-danger-600' : 'text-success-600'}>
                          {item.type === 'expense' ? '-' : '+'}{formatCurrency(item.amount)}
                        </span>
                        {item.confidence_score && (
                          <>
                            <span>•</span>
                            <span>{Math.round(item.confidence_score * 100)}% confidence</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="text-green-600 hover:text-green-700 hover:bg-green-50"
                        onClick={() => handleFeedAction(item.id, 'approve')}
                        disabled={processingIds.has(item.id)}
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        {t('feed.approve')}
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleFeedAction(item.id, 'reject')}
                        disabled={processingIds.has(item.id)}
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        {t('feed.reject')}
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Recent Transactions */}
          <Card className="!p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">{t('dashboard.recent_transactions')}</h2>
              <Button variant="ghost" size="sm" onClick={() => window.location.href = '/transactions'}>
                {t('dashboard.view_all')} <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
            
            {transactions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Receipt className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>{t('transaction.no_transactions')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {transactions.slice(0, 5).map((transaction) => (
                  <div key={transaction.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        transaction.type === 'income' ? 'bg-success-100' : 'bg-danger-100'
                      }`}>
                        {transaction.type === 'income' ? (
                          <TrendingUp className="w-5 h-5 text-success-600" />
                        ) : (
                          <TrendingDown className="w-5 h-5 text-danger-600" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {transaction.description || transaction.merchant_name || 'Transaction'}
                        </p>
                        <p className="text-sm text-gray-500">
                          {formatDate(transaction.date, language)} • {transaction.category_name || 'Uncategorized'}
                        </p>
                      </div>
                    </div>
                    <p className={`font-semibold ${getTypeColor(transaction.type)}`}>
                      {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Category Breakdown */}
          {categoryBreakdown.length > 0 && (
            <Card className="!p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">{t('dashboard.expense_by_category')}</h2>
                <Button variant="ghost" size="sm" onClick={() => window.location.href = '/category-expenses'}>
                  {t('dashboard.view_all')} <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
              <div className="space-y-3">
                {categoryBreakdown.slice(0, 5).map((cat, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{cat.category_name || cat.name}</span>
                        <span className="text-sm text-gray-500">{formatCurrency(cat.total)}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary-500 rounded-full"
                          style={{ width: `${Math.min((cat.total / expense) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
};
