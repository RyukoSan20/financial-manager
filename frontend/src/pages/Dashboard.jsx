import { useState, useEffect, useRef } from 'react';
import { Card, Button, Badge, Spinner, EmptyState } from '../components/ui';
import { 
  TrendingUp, TrendingDown, Wallet, PiggyBank, RefreshCw, Camera, 
  CheckCircle, AlertTriangle, XCircle, Clock, Target, Sparkles,
  ArrowUpRight, ArrowDownRight, Zap, Award, Shield, Trophy
} from 'lucide-react';
import { formatCurrency, formatNumber, formatPercent } from '../utils/format';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, 
         XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import api from '../services/api';
import { useTranslation } from '../i18n';

// Achievement badges configuration
const ACHIEVEMENTS = [
  { id: 'budget_master', name: 'Budget Guardian', icon: Shield, color: '#22c55e', description: 'Pengeluaran di bawah budget' },
  { id: 'savings_streak', name: 'Master Hemat', icon: Trophy, color: '#f59e0b', description: 'Tabungan naik 3 bulan berturut-turut' },
  { id: 'first_goal', name: 'Goal Getter', icon: Target, color: '#3b82f6', description: 'Capai target pertama' },
  { id: 'surplus', name: 'Surplus Star', icon: Zap, color: '#8b5cf6', description: 'Tabungan naik 50%' },
];

const CHART_COLORS = {
  income: '#22c55e',
  expense: '#ef4444',
  savings: '#3b82f6',
  budget: '#f59e0b',
  safe: '#10b981',
};

export const Dashboard = ({ onAddTransaction, onScanReceipt }) => {
  const { t, language } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [cashFlow, setCashFlow] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [goals, setGoals] = useState([]);
  const [feedStats, setFeedStats] = useState(null);
  const [exchangeRates, setExchangeRates] = useState(null);
  const [timeFilter, setTimeFilter] = useState('monthly');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [processingIds, setProcessingIds] = useState(new Set());

  // Gamification state
  const [achievements, setAchievements] = useState([]);

  useEffect(() => {
    // Initialize date range based on filter
    const now = new Date();
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    
    let start = new Date(now);
    start.setHours(0, 0, 0, 0);
    
    if (timeFilter === 'daily') {
      // Today only
    } else if (timeFilter === 'weekly') {
      start.setDate(end.getDate() - 7);
    } else if (timeFilter === 'monthly') {
      start.setMonth(end.getMonth(), 1);
    } else if (timeFilter === 'yearly') {
      start.setMonth(0, 1);
    }
    
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  }, [timeFilter]);

  useEffect(() => {
    if (startDate && endDate) {
      fetchData();
    }
  }, [startDate, endDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [
        summaryData,
        cashFlowData,
        transactionsData,
        budgetsData,
        accountsData,
        goalsData,
        feedStatsData,
        exchangeData
      ] = await Promise.allSettled([
        api.dashboard.summary(startDate, endDate),
        api.dashboard.cashFlow(6),
        api.transactions.list({ start_date: startDate, end_date: endDate, limit: 10 }),
        api.budgets?.list ? api.budgets.list() : Promise.resolve([]),
        api.accounts?.list ? api.accounts.list() : Promise.resolve([]),
        api.goals?.list ? api.goals.list() : Promise.resolve([]),
        api.get('/feed/stats').catch(() => null),
        api.exchange.rates('USD').catch(() => null),
      ]);

      if (summaryData.status === 'fulfilled') setSummary(summaryData.value);
      if (cashFlowData.status === 'fulfilled') setCashFlow(cashFlowData.value || []);
      if (transactionsData.status === 'fulfilled') setTransactions(transactionsData.value?.transactions || transactionsData.value || []);
      if (budgetsData.status === 'fulfilled') setBudgets(Array.isArray(budgetsData.value) ? budgetsData.value : []);
      if (accountsData.status === 'fulfilled') setAccounts(Array.isArray(accountsData.value) ? accountsData.value : []);
      if (goalsData.status === 'fulfilled') setGoals(Array.isArray(goalsData.value) ? goalsData.value : []);
      if (feedStatsData.status === 'fulfilled' && feedStatsData.value) setFeedStats(feedStatsData.value);
      if (exchangeData.status === 'fulfilled' && exchangeData.value) setExchangeRates(exchangeData.value);

      // Calculate achievements
      calculateAchievements(summaryData.value, budgetsData.value, goalsData.value);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const calculateAchievements = (summaryData, budgetsData, goalsData) => {
    const earned = [];
    
    // Budget Guardian - spending under budget
    if (budgetsData && Array.isArray(budgetsData)) {
      const underBudget = budgetsData.filter(b => (b.spent || 0) <= b.amount);
      if (underBudget.length === budgetsData.length && budgetsData.length > 0) {
        earned.push('budget_master');
      }
    }
    
    // Goal Getter - first goal achieved
    if (goalsData && Array.isArray(goalsData)) {
      const achievedGoal = goalsData.find(g => g.is_completed);
      if (achievedGoal) {
        earned.push('first_goal');
      }
    }
    
    // Surplus Star - savings > expenses
    if (summaryData) {
      const income = summaryData.total_income || 0;
      const expense = summaryData.total_expense || 0;
      if (income > expense && expense > 0) {
        const savingsRate = ((income - expense) / income) * 100;
        if (savingsRate >= 50) {
          earned.push('surplus');
        }
      }
    }
    
    setAchievements(earned);
  };

  // Calculate Safe-to-Spend
  const calculateSafeToSpend = () => {
    if (!summary || !budgets) return { amount: 0, percent: 0, status: 'safe' };
    
    const totalBudget = budgets.reduce((sum, b) => sum + (b.amount || 0), 0);
    const totalSpent = budgets.reduce((sum, b) => sum + (b.spent || 0), 0);
    const remaining = totalBudget - totalSpent;
    const percent = totalBudget > 0 ? (remaining / totalBudget) * 100 : 100;
    
    let status = 'safe';
    if (percent <= 0) status = 'danger';
    else if (percent <= 20) status = 'warning';
    else if (percent <= 50) status = 'caution';
    
    return { amount: Math.max(0, remaining), percent: Math.max(0, percent), status };
  };

  // Calculate spending ratio
  const calculateSpendingRatio = () => {
    if (!summary) return { ratio: 0, percent: 0, status: 'safe' };
    
    const income = summary.total_income || 0;
    const expense = summary.total_expense || 0;
    
    if (income === 0) return { ratio: 0, percent: 0, status: 'neutral' };
    
    const percent = (expense / income) * 100;
    let status = 'safe';
    if (percent >= 100) status = 'danger';
    else if (percent >= 80) status = 'warning';
    else if (percent >= 50) status = 'caution';
    
    return { ratio: expense, percent, status };
  };

  const safeToSpend = calculateSafeToSpend();
  const spendingRatio = calculateSpendingRatio();

  // Chart data preparation
  const cashFlowChartData = cashFlow.map(item => ({
    month: item.month || item.date,
    income: item.income || item.total_income || 0,
    expense: item.expense || item.total_expense || 0,
    savings: (item.income || item.total_income || 0) - (item.expense || item.total_expense || 0),
  }));

  const statusColors = {
    safe: 'text-green-600 bg-green-50',
    caution: 'text-yellow-600 bg-yellow-50',
    warning: 'text-orange-600 bg-orange-50',
    danger: 'text-red-600 bg-red-50',
    neutral: 'text-gray-600 bg-gray-50',
  };

  const getStatusColor = (status) => statusColors[status] || statusColors.neutral;

  const getStatusIcon = (status) => {
    switch (status) {
      case 'safe': return <CheckCircle className="w-5 h-5" />;
      case 'caution': return <Clock className="w-5 h-5" />;
      case 'warning': return <AlertTriangle className="w-5 h-5" />;
      case 'danger': return <XCircle className="w-5 h-5" />;
      default: return <TrendingUp className="w-5 h-5" />;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'safe': return t('dashboard.status_safe', '💚 Aman');
      case 'caution': return t('dashboard.status_caution', '🟡 Hati-hati');
      case 'warning': return t('dashboard.status_warning', '🟠 Peringatan');
      case 'danger': return t('dashboard.status_danger', '🔴 Bahaya!');
      default: return t('dashboard.status_neutral', '⚪ Netral');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('dashboard.title', 'Dashboard')}
          </h1>
          <p className="text-gray-500 mt-1">
            {new Date().toLocaleDateString(language === 'id' ? 'id-ID' : language === 'ja' ? 'ja-JP' : 'en-US', { month: 'long', year: 'numeric' })}
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
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {t(`time.${filter}`, filter.charAt(0).toUpperCase() + filter.slice(1))}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          {onScanReceipt && (
            <Button variant="default" size="sm" onClick={onScanReceipt} className="gap-2">
              <Camera className="w-4 h-4" />
              {t('dashboard.scan_receipt', 'Scan')}
            </Button>
          )}
        </div>
      </div>

      {/* Financial Health Status */}
      <Card className={`p-4 ${getStatusColor(spendingRatio.status)}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getStatusIcon(spendingRatio.status)}
            <div>
              <p className="font-semibold">{getStatusText(spendingRatio.status)}</p>
              <p className="text-sm opacity-80">
                {spendingRatio.status === 'danger' 
                  ? t('dashboard.budget_exceeded', 'Anggaran Bulan Ini Jebol!')
                  : spendingRatio.status === 'warning'
                  ? t('dashboard.budget_warning', 'Pengeluaran mendekati batas!')
                  : t('dashboard.budget_ok', 'Pengeluaran masih dalam batas aman')}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">{formatPercent(spendingRatio.percent, 0)}</p>
            <p className="text-sm opacity-80">{t('dashboard.spent_of_income', 'dari pemasukan')}</p>
          </div>
        </div>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Income */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.income', 'Pemasukan')}</p>
              <p className="text-xl font-bold text-green-600">{formatCurrency(summary?.total_income || 0)}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <ArrowUpRight className="w-5 h-5 text-green-600" />
            </div>
          </div>
        </Card>

        {/* Expense */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.expense', 'Pengeluaran')}</p>
              <p className="text-xl font-bold text-red-600">{formatCurrency(summary?.total_expense || 0)}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <ArrowDownRight className="w-5 h-5 text-red-600" />
            </div>
          </div>
        </Card>

        {/* Net Cash Flow */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.net_flow', 'Arus Kas')}</p>
              <p className={`text-xl font-bold ${(summary?.net_cash_flow || 0) >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                {formatCurrency(summary?.net_cash_flow || 0)}
              </p>
            </div>
            <div className={`w-10 h-10 rounded-full ${(summary?.net_cash_flow || 0) >= 0 ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-orange-100 dark:bg-orange-900/30'} flex items-center justify-center`}>
              {(summary?.net_cash_flow || 0) >= 0 ? <TrendingUp className="w-5 h-5 text-blue-600" /> : <TrendingDown className="w-5 h-5 text-orange-600" />}
            </div>
          </div>
        </Card>

        {/* Safe-to-Spend */}
        <Card className={`p-4 ${safeToSpend.status === 'danger' ? 'border-2 border-red-500' : ''}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.safe_to_spend', 'Sisa Aman')}</p>
              <p className={`text-xl font-bold ${safeToSpend.status === 'danger' ? 'text-red-600' : safeToSpend.status === 'warning' ? 'text-orange-600' : 'text-green-600'}`}>
                {formatCurrency(safeToSpend.amount)}
              </p>
            </div>
            <div className={`w-10 h-10 rounded-full ${safeToSpend.status === 'danger' ? 'bg-red-100 dark:bg-red-900/30' : safeToSpend.status === 'warning' ? 'bg-orange-100 dark:bg-orange-900/30' : 'bg-green-100 dark:bg-green-900/30'} flex items-center justify-center`}>
              <Shield className={`w-5 h-5 ${safeToSpend.status === 'danger' ? 'text-red-600' : 'text-green-600'}`} />
            </div>
          </div>
          <div className="mt-2">
            <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
              <div 
                className={`h-2 rounded-full transition-all ${safeToSpend.status === 'danger' ? 'bg-red-500' : safeToSpend.status === 'warning' ? 'bg-orange-500' : 'bg-green-500'}`}
                style={{ width: `${Math.min(100, safeToSpend.percent)}%` }}
              />
            </div>
          </div>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cash Flow Chart */}
        <Card className="p-4">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
            {t('dashboard.cash_flow_chart', 'Arus Kas Tren')}
          </h3>
          {cashFlowChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={cashFlowChartData}>
                <defs>
                  <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.income} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={CHART_COLORS.income} stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.expense} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={CHART_COLORS.expense} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" tick={{fontSize: 12}} stroke="#9ca3af" />
                <YAxis tick={{fontSize: 12}} stroke="#9ca3af" tickFormatter={(v) => formatNumber(v)} />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Legend />
                <Area type="monotone" dataKey="income" stroke={CHART_COLORS.income} fill="url(#colorIncome)" name={t('dashboard.income', 'Pemasukan')} />
                <Area type="monotone" dataKey="expense" stroke={CHART_COLORS.expense} fill="url(#colorExpense)" name={t('dashboard.expense', 'Pengeluaran')} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-400">
              {t('dashboard.no_chart_data', 'Tidak ada data untuk ditampilkan')}
            </div>
          )}
        </Card>

        {/* Savings Rate Chart */}
        <Card className="p-4">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
            {t('dashboard.savings_rate', 'Rasio Tabungan')}
          </h3>
          <div className="flex items-center justify-center h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: t('dashboard.savings', 'Tabungan'), value: Math.max(0, summary?.net_cash_flow || 0) },
                    { name: t('dashboard.expense', 'Pengeluaran'), value: summary?.total_expense || 0 },
                  ]}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                >
                  <Cell fill={CHART_COLORS.savings} />
                  <Cell fill={CHART_COLORS.expense} />
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute text-center">
              <p className="text-3xl font-bold text-blue-600">{formatPercent(summary?.savings_rate || 0, 0)}</p>
              <p className="text-sm text-gray-500">{t('dashboard.savings_rate_label', 'Tabungan')}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Achievements */}
      {achievements.length > 0 && (
        <Card className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20">
          <div className="flex items-center gap-2 mb-4">
            <Award className="w-5 h-5 text-purple-600" />
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {t('dashboard.achievements', 'Pencapaian')}
            </h3>
          </div>
          <div className="flex flex-wrap gap-3">
            {achievements.map(achievementId => {
              const achievement = ACHIEVEMENTS.find(a => a.id === achievementId);
              if (!achievement) return null;
              const Icon = achievement.icon;
              return (
                <div 
                  key={achievementId}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-white dark:bg-gray-800 shadow-sm"
                  title={achievement.description}
                >
                  <Icon className="w-5 h-5" style={{ color: achievement.color }} />
                  <span className="font-medium text-sm">{achievement.name}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Recent Transactions */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            {t('dashboard.recent_transactions', 'Transaksi Terbaru')}
          </h3>
          <Button variant="ghost" size="sm" onClick={() => window.location.href = '/transactions'}>
            {t('dashboard.view_all', 'Lihat Semua')} →
          </Button>
        </div>
        {transactions.length > 0 ? (
          <div className="space-y-3">
            {transactions.slice(0, 5).map((tx) => (
              <div key={tx.id} className="flex items-center justify-between py-2 border-b dark:border-gray-700 last:border-0">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    tx.type === 'income' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'
                  }`}>
                    {tx.type === 'income' ? (
                      <ArrowUpRight className="w-5 h-5 text-green-600" />
                    ) : (
                      <ArrowDownRight className="w-5 h-5 text-red-600" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{tx.description || 'Transaksi'}</p>
                    <p className="text-sm text-gray-500">{tx.category_name || tx.category || 'Lainnya'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-semibold ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                    {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                  </p>
                  <p className="text-xs text-gray-400">
                    {new Date(tx.date).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState 
            icon={Wallet}
            title={t('dashboard.no_transactions', 'Belum ada transaksi')}
            description={t('dashboard.add_first', 'Tambahkan transaksi pertama Anda')}
          />
        )}
      </Card>

      {/* Exchange Rates Widget */}
      {exchangeRates && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              💱 {t('dashboard.exchange_rates', 'Kurs Mata Uang')}
            </h3>
            <span className="text-xs text-gray-400">
              {t('dashboard.rates_from', 'Update dari')}: Frankfurter API
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(exchangeRates.rates || {}).slice(0, 8).map(([currency, rate]) => (
              <div key={currency} className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-sm text-gray-500">{currency}</p>
                <p className="font-bold text-gray-900 dark:text-white">
                  {typeof rate === 'number' ? rate.toFixed(4) : rate}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Pending Feed Review */}
      {feedStats && feedStats.pending > 0 && (
        <Card className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-yellow-600" />
              <div>
                <p className="font-semibold text-yellow-800 dark:text-yellow-200">
                  {feedStats.pending} {t('dashboard.pending_review', 'transaksi menunggu review')}
                </p>
                <p className="text-sm text-yellow-600 dark:text-yellow-400">
                  {t('dashboard.review_prompt', 'Segera tinjau transaksi dari scan struk')}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => window.location.href = '/feed'}>
              {t('dashboard.review_now', 'Tinjau Sekarang')}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};

export default Dashboard;
