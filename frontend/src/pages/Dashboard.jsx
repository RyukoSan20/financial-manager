import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Spinner, Badge } from '../components/ui';
import { 
  TrendingUp, TrendingDown, Wallet, PieChart, 
  Plus, Receipt, FileText, PiggyBank,
  ChevronRight, RefreshCw, Camera, CheckCircle, XCircle, Clock,
  Sun, Moon, Sparkles, Target, TrendingFlat,
  AlertTriangle, Check, ArrowRight, CreditCard
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
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [timePeriod, setTimePeriod] = useState('month');
  const [summary, setSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [pendingFeed, setPendingFeed] = useState([]);
  const [feedStats, setFeedStats] = useState(null);
  const [processingIds, setProcessingIds] = useState(new Set());
  const [healthScore, setHealthScore] = useState(null);
  const [aiInsights, setAiInsights] = useState([]);
  
  // Onboarding progress
  const [onboarding, setOnboarding] = useState({
    hasAccount: false,
    hasTransaction: false,
    hasBudget: false,
  });

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
      
      const results = await Promise.allSettled([
        api.dashboard.summary(startDate, endDate),
        api.transactions.list({ start_date: startDate, end_date: endDate, limit: 10 }),
        api.analytics.expenseBreakdown({ start_date: startDate, end_date: endDate, type: 'expense' }),
        api.accounts.list(),
        api.get('/feed/stats').catch(() => null),
        api.get('/feed/pending?limit=3').catch(() => null),
        api.budgets?.list ? api.budgets.list() : Promise.resolve([]),
      ]);

      if (results[0].status === 'fulfilled') setSummary(results[0].value);
      if (results[1].status === 'fulfilled') {
        const data = results[1].value;
        setTransactions(Array.isArray(data) ? data : (data.transactions || []));
      }
      if (results[2].status === 'fulfilled') {
        const data = results[2].value;
        setCategoryBreakdown(data.categories || data || []);
      }
      if (results[3].status === 'fulfilled') {
        const data = results[3].value;
        setAccounts(Array.isArray(data) ? data : []);
        setOnboarding(prev => ({ ...prev, hasAccount: Array.isArray(data) && data.length > 0 }));
      }
      if (results[4].status === 'fulfilled' && results[4].value) {
        setFeedStats(results[4].value.data || results[4].value);
      }
      if (results[5].status === 'fulfilled') {
        setPendingFeed(results[5].value.data?.data || results[5].value.data || []);
      }
      if (results[6].status === 'fulfilled') {
        setOnboarding(prev => ({ ...prev, hasBudget: Array.isArray(results[6].value) && results[6].value.length > 0 }));
      }

      // Calculate health score
      calculateHealthScore(results);
    } catch (error) {
      console.error('Dashboard fetch error:', error);
    } finally {
      setLoading(false);
    }
  }, [timePeriod]);

  const calculateHealthScore = (results) => {
    let score = 50; // Base score
    const insights = [];
    
    // Check if has accounts
    if (results[3]?.status === 'fulfilled' && Array.isArray(results[3].value) && results[3].value.length > 0) {
      score += 10;
    } else {
      insights.push({ type: 'warning', text: 'Tambahkan akun bank atau dompet untuk memulai' });
    }
    
    // Check transaction patterns
    if (results[1]?.status === 'fulfilled') {
      const tx = results[1].value;
      const txArray = Array.isArray(tx) ? tx : tx.transactions || [];
      if (txArray.length > 0) {
        score += 15;
        setOnboarding(prev => ({ ...prev, hasTransaction: true }));
      }
      
      // Analyze spending patterns
      const expense = results[0]?.value?.total_expense || 0;
      const income = results[0]?.value?.total_income || 0;
      
      if (income > 0) {
        const savingsRate = ((income - expense) / income) * 100;
        if (savingsRate >= 20) {
          score += 15;
          insights.push({ type: 'success', text: 'Tabulungan Anda sudah baik! Tingkat savings rate 20%+' });
        } else if (savingsRate >= 10) {
          score += 10;
          insights.push({ type: 'info', text: 'Savings rate Anda 10-20%. Coba naikkan ke 20%+' });
        } else if (savingsRate < 0) {
          score -= 10;
          insights.push({ type: 'danger', text: 'Pengeluaran melebihi pemasukan! Hati-hati.' });
        }
      }
    }
    
    // Check budget
    if (results[6]?.status === 'fulfilled' && Array.isArray(results[6].value) && results[6].value.length > 0) {
      score += 10;
    }
    
    setHealthScore(Math.min(Math.max(score, 0), 100));
    setAiInsights(insights.slice(0, 3));
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Calculate values
  const income = summary?.total_income || 0;
  const expense = summary?.total_expense || 0;
  const balance = income - expense;
  const savingsRate = income > 0 ? ((income - expense) / income) * 100 : 0;

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

  // Get health score color
  const getHealthColor = (score) => {
    if (score >= 80) return { bg: 'bg-green-100', text: 'text-green-600', label: 'Sangat Baik' };
    if (score >= 60) return { bg: 'bg-blue-100', text: 'text-blue-600', label: 'Baik' };
    if (score >= 40) return { bg: 'bg-yellow-100', text: 'text-yellow-600', label: 'Cukup' };
    return { bg: 'bg-red-100', text: 'text-red-600', label: 'Perlu Perbaikan' };
  };

  const healthColor = getHealthColor(healthScore || 0);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header with Scan Button */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
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

      {/* Onboarding Checklist */}
      {(!onboarding.hasAccount || !onboarding.hasTransaction) && (
        <Card className="!p-5 border-l-4 border-l-primary-500">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary-500" />
            Mari Mulai!
          </h3>
          <div className="space-y-2">
            <div className={`flex items-center gap-3 ${onboarding.hasAccount ? 'opacity-50' : ''}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                onboarding.hasAccount ? 'bg-green-500 text-white' : 'bg-gray-200'
              }`}>
                {onboarding.hasAccount ? <Check className="w-4 h-4" /> : <span className="text-xs font-bold">1</span>}
              </div>
              <span className={onboarding.hasAccount ? 'line-through text-gray-400' : 'text-gray-700 dark:text-gray-200'}>
                Hubungkan Akun Bank / Dompet
              </span>
              {!onboarding.hasAccount && (
                <Button size="sm" variant="ghost" onClick={() => navigate('/accounts')}>
                  Setup <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              )}
            </div>
            <div className={`flex items-center gap-3 ${onboarding.hasTransaction ? 'opacity-50' : ''}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                onboarding.hasTransaction ? 'bg-green-500 text-white' : 'bg-gray-200'
              }`}>
                {onboarding.hasTransaction ? <Check className="w-4 h-4" /> : <span className="text-xs font-bold">2</span>}
              </div>
              <span className={onboarding.hasTransaction ? 'line-through text-gray-400' : 'text-gray-700 dark:text-gray-200'}>
                Catat transaksi pertama
              </span>
              {!onboarding.hasTransaction && (
                <Button size="sm" variant="ghost" onClick={() => navigate('/add')}>
                  Catat <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              )}
            </div>
            <div className={`flex items-center gap-3 ${onboarding.hasBudget ? 'opacity-50' : ''}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                onboarding.hasBudget ? 'bg-green-500 text-white' : 'bg-gray-200'
              }`}>
                {onboarding.hasBudget ? <Check className="w-4 h-4" /> : <span className="text-xs font-bold">3</span>}
              </div>
              <span className={onboarding.hasBudget ? 'line-through text-gray-400' : 'text-gray-700 dark:text-gray-200'}>
                Buat Budget bulanan
              </span>
              {!onboarding.hasBudget && (
                <Button size="sm" variant="ghost" onClick={() => navigate('/budgets')}>
                  Buat <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* AI Health Score Widget */}
      {healthScore !== null && (
        <Card className={`!p-5 ${healthColor.bg}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className={`text-4xl font-bold ${healthColor.text}`}>{healthScore}</div>
                <div className="text-xs text-gray-500">/100</div>
              </div>
              <div>
                <p className={`font-semibold ${healthColor.text}`}>{healthColor.label}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Skor Kesehatan Keuangan
                </p>
                {aiInsights.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {aiInsights.map((insight, idx) => (
                      <div key={idx} className="flex items-center gap-1 text-sm">
                        {insight.type === 'success' && <CheckCircle className="w-3 h-3 text-green-500" />}
                        {insight.type === 'warning' && <AlertTriangle className="w-3 h-3 text-yellow-500" />}
                        {insight.type === 'danger' && <XCircle className="w-3 h-3 text-red-500" />}
                        {insight.type === 'info' && <Clock className="w-3 h-3 text-blue-500" />}
                        <span>{insight.text}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/analytics')}>
              Detail <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </Card>
      )}

      {/* Feed & Review Banner */}
      {feedStats && feedStats.pending_count > 0 && (
        <Card className="!p-4 border-l-4 border-l-yellow-500 bg-yellow-50 dark:bg-yellow-900/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-yellow-100 dark:bg-yellow-900 flex items-center justify-center">
                <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {t('feed.pendingCount')}: {feedStats.pending_count}
                </p>
                <p className="text-sm text-gray-500">
                  {formatCurrency(feedStats.total_pending_amount)} {t('feed.totalPending')}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/feed')}>
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
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
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
                <div className="w-10 h-10 rounded-lg bg-success-100 dark:bg-success-900/30 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-success-600 dark:text-success-400" />
                </div>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">{t('dashboard.income')}</p>
              <p className="text-xl font-bold text-success-600 dark:text-success-400 mt-1">
                {formatCurrency(income)}
              </p>
            </Card>

            <Card className="!p-5">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-lg bg-danger-100 dark:bg-danger-900/30 flex items-center justify-center">
                  <TrendingDown className="w-5 h-5 text-danger-600 dark:text-danger-400" />
                </div>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">{t('dashboard.expense')}</p>
              <p className="text-xl font-bold text-danger-600 dark:text-danger-400 mt-1">
                {formatCurrency(expense)}
              </p>
            </Card>

            <Card className="!p-5">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                balance >= 0 ? 'bg-success-100 dark:bg-success-900/30' : 'bg-danger-100 dark:bg-danger-900/30'
              }`}>
                <Wallet className={`w-5 h-5 ${balance >= 0 ? 'text-success-600 dark:text-success-400' : 'text-danger-600 dark:text-danger-400'}`} />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">{t('dashboard.net_flow')}</p>
              <p className={`text-xl font-bold mt-1 ${balance >= 0 ? 'text-success-600 dark:text-success-400' : 'text-danger-600 dark:text-danger-400'}`}>
                {balance >= 0 ? '+' : ''}{formatCurrency(balance)}
              </p>
            </Card>

            <Card className="!p-5">
              <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                <PiggyBank className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">Savings Rate</p>
              <p className={`text-xl font-bold mt-1 ${savingsRate >= 20 ? 'text-success-600 dark:text-success-400' : savingsRate >= 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-danger-600 dark:text-danger-400'}`}>
                {savingsRate.toFixed(1)}%
              </p>
            </Card>
          </div>

          {/* Pending Feed Cards */}
          {pendingFeed.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-yellow-500" />
                {t('feed.pending')}
              </h2>
              {pendingFeed.map((item) => (
                <Card key={item.id} className="!p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Receipt className="w-4 h-4 text-gray-400" />
                        <span className="font-medium text-gray-900 dark:text-white">{item.merchant_name || item.description || 'Transaction'}</span>
                        <Badge variant="outline" className="text-xs">
                          {item.source || 'OCR'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 dark:text-gray-400">
                        <span>{formatDate(item.date, language)}</span>
                        <span>•</span>
                        <span className={item.type === 'expense' ? 'text-danger-600 dark:text-danger-400' : 'text-success-600 dark:text-success-400'}>
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
                        className="text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20"
                        onClick={() => handleFeedAction(item.id, 'approve')}
                        disabled={processingIds.has(item.id)}
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        {t('feed.approve')}
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
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
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('dashboard.recent_transactions')}</h2>
              <Button variant="ghost" size="sm" onClick={() => navigate('/transactions')}>
                {t('dashboard.view_all')} <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
            
            {transactions.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <Receipt className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                <p>{t('transaction.no_transactions')}</p>
                <Button className="mt-3" onClick={() => navigate('/add')}>
                  <Plus className="w-4 h-4 mr-2" />
                  {t('transaction.add_first')}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {transactions.slice(0, 5).map((transaction) => (
                  <div key={transaction.id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        transaction.type === 'income' ? 'bg-success-100 dark:bg-success-900/30' : 'bg-danger-100 dark:bg-danger-900/30'
                      }`}>
                        {transaction.type === 'income' ? (
                          <TrendingUp className="w-5 h-5 text-success-600 dark:text-success-400" />
                        ) : (
                          <TrendingDown className="w-5 h-5 text-danger-600 dark:text-danger-400" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {transaction.description || transaction.merchant_name || 'Transaction'}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {formatDate(transaction.date, language)} • {transaction.category_name || 'Uncategorized'}
                        </p>
                      </div>
                    </div>
                    <p className={`font-semibold ${transaction.type === 'income' ? 'text-success-600 dark:text-success-400' : 'text-danger-600 dark:text-danger-400'}`}>
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
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('dashboard.expense_by_category')}</h2>
                <Button variant="ghost" size="sm" onClick={() => navigate('/category-expenses')}>
                  {t('dashboard.view_all')} <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
              <div className="space-y-3">
                {categoryBreakdown.slice(0, 5).map((cat, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{cat.category_name || cat.name}</span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">{formatCurrency(cat.total)}</span>
                      </div>
                      <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary-500 dark:bg-primary-400 rounded-full transition-all"
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
