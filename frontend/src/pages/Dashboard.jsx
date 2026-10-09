import { useState, useEffect, useRef, useCallback } from 'react';
import React from 'react';
import { Card, Button, Badge, Spinner } from '../components/ui';
import { 
  TrendingUp, TrendingDown, Wallet, PiggyBank, RefreshCw, Camera, 
  CheckCircle, AlertTriangle, XCircle, Clock, Target,
  ArrowUpRight, ArrowDownRight, Zap, Award, Shield, Trophy, Bell,
  BarChart3, Activity, DollarSign, Bitcoin, Globe, Sun, Moon,
  ChevronUp, ChevronDown
} from 'lucide-react';
import { formatCurrency, formatNumber, formatPercent } from '../utils/format';
import api from '../services/api';
import { useTranslation } from '../i18n';

// Achievement badges
const ACHIEVEMENTS = [
  { id: 'budget_master', name: 'Budget Guardian', icon: Shield, color: '#22c55e', description: 'Pengeluaran di bawah budget' },
  { id: 'savings_streak', name: 'Master Hemat', icon: Trophy, color: '#f59e0b', description: 'Tabungan naik 3 bulan berturut-turut' },
  { id: 'first_goal', name: 'Goal Getter', icon: Target, color: '#3b82f6', description: 'Capai target pertama' },
  { id: 'surplus', name: 'Surplus Star', icon: Zap, color: '#8b5cf6', description: 'Tabungan naik 50%' },
];

// Timeframe Configuration - Stockbit Style
const TIMEFRAMES = [
  { key: '1D', label: '1D', description: '24 Jam', granularity: 'hourly' },
  { key: '1W', label: '1W', description: '1 Minggu', granularity: 'daily' },
  { key: '1M', label: '1M', description: '1 Bulan', granularity: 'daily' },
  { key: '3M', label: '3M', description: '3 Bulan', granularity: 'weekly' },
  { key: 'YTD', label: 'YTD', description: 'Tahun Ini', granularity: 'monthly' },
  { key: '1Y', label: '1Y', description: '1 Tahun', granularity: 'monthly' },
  { key: '3Y', label: '3Y', description: '3 Tahun', granularity: 'monthly' },
  { key: '5Y', label: '5Y', description: '5 Tahun', granularity: 'monthly' },
];

// Chart colors
const CHART_COLORS = {
  income: '#22c55e',
  expense: '#ef4444',
  savings: '#3b82f6',
  grid: '#e5e7eb',
  crosshair: '#94a3b8',
};

// Category colors
const CATEGORY_COLORS = {
  salary: '#22c55e', freelance: '#10b981', investment_income: '#06b6d4',
  bonus: '#8b5cf6', other_income: '#6b7280',
  food: '#ef4444', transport: '#f97316', shopping: '#eab308',
  health: '#22c55e', education: '#3b82f6', entertainment: '#ec4899',
  bills: '#8b5cf6', investment: '#14b8a6', other_expense: '#6b7280',
};

// Dark mode toggle
const DarkModeToggle = ({ isDark, onToggle }) => (
  <button
    onClick={onToggle}
    className={`relative w-14 h-7 rounded-full transition-colors duration-300 ${
      isDark ? 'bg-gray-700' : 'bg-gray-300'
    }`}
    aria-label="Toggle dark mode"
  >
    <span className={`absolute top-0.5 w-6 h-6 rounded-full shadow-md flex items-center justify-center transition-all duration-300 ${
      isDark ? 'left-7 bg-yellow-400' : 'left-0.5 bg-white'
    }`}>
      {isDark ? <Moon className="w-3.5 h-3.5 text-gray-800" /> : <Sun className="w-3.5 h-3.5 text-yellow-500" />}
    </span>
  </button>
);

// Market Card with real-time data
const MarketCard = ({ name, value, change, positive, isDark }) => (
  <div className={`p-3 rounded-lg border transition-all hover:shadow-md ${
    isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
  }`}>
    <p className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{name}</p>
    <p className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{value}</p>
    <div className={`flex items-center gap-1 text-sm ${positive ? 'text-green-600' : 'text-red-600'}`}>
      {positive ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      <span>{change}</span>
    </div>
  </div>
);

// Category Breakdown Component
const CategoryBreakdown = ({ categories, type, isDark }) => {
  const total = Object.values(categories || {}).reduce((sum, cat) => sum + (cat.total || 0), 0);
  const topCategories = Object.entries(categories || {}).sort((a, b) => b[1].total - a[1].total).slice(0, 5);
  
  return (
    <div className="space-y-2">
      <h4 className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
        {type === 'income' ? '💰 Rincian Pemasukan' : '💸 Rincian Pengeluaran'}
      </h4>
      {topCategories.length > 0 ? topCategories.map(([key, data]) => (
        <div key={key} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[key] || '#6b7280' }} />
          <div className="flex-1">
            <div className="flex justify-between text-xs">
              <span className={`capitalize ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {key.replace(/_/g, ' ')}
              </span>
              <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>{formatCurrency(data.total || 0)}</span>
            </div>
            <div className={`w-full rounded-full h-1 mt-0.5 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
              <div className="h-1 rounded-full" style={{ width: `${data.percentage || 0}%`, backgroundColor: CATEGORY_COLORS[key] || '#6b7280' }} />
            </div>
          </div>
        </div>
      )) : (
        <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Tidak ada data</p>
      )}
    </div>
  );
};

export const Dashboard = ({ onAddTransaction, onScanReceipt }) => {
  const { t, language, currency, currencyConfig } = useTranslation();
  
  // Dark mode
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });
  
  // Chart refs
  const cashFlowChartRef = useRef(null);
  const chartInstanceRef = useRef(null);
  
  // State - ALL ORIGINAL + NEW
  const [loading, setLoading] = useState(true);
  const [userSettings, setUserSettings] = useState(null);
  const [marketData, setMarketData] = useState(null);
  const [summary, setSummary] = useState(null);
  const [cashFlowSeries, setCashFlowSeries] = useState([]);
  const [chartConfig, setChartConfig] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [goals, setGoals] = useState([]);
  const [feedStats, setFeedStats] = useState(null);
  const [achievements, setAchievements] = useState([]);
  
  // NEW: Timeframe & Filter states
  const [timeframe, setTimeframe] = useState('3M');
  const [selectedAccount, setSelectedAccount] = useState('all');
  const [realtimeUpdate, setRealtimeUpdate] = useState(null);
  const [categorySummary, setCategorySummary] = useState({ income: {}, expense: {} });
  const [cashFlowMeta, setCashFlowMeta] = useState({});

  // Dark mode effect
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Fetch market data from realtime API
  const fetchMarketData = useCallback(async () => {
    try {
      const response = await fetch('https://financial-manager-production-26f7.up.railway.app/realtime/summary');
      const data = await response.json();
      setMarketData(data);
      setRealtimeUpdate(new Date());
    } catch (err) {
      console.error('Failed to fetch market data:', err);
    }
  }, []);

  // Fetch cash flow with new timeframe API
  const fetchCashFlow = useCallback(async () => {
    try {
      const params = new URLSearchParams({ timeframe });
      if (selectedAccount !== 'all') {
        params.append('account_id', selectedAccount);
      }
      
      const response = await fetch(`https://financial-manager-production-26f7.up.railway.app/api/dashboard/cash-flow?${params}`);
      const data = await response.json();
      
      if (data.status === 'success') {
        setCashFlowSeries(data.series || []);
        setChartConfig(data.chartConfig || null);
        setCashFlowMeta(data.meta || {});
        setCategorySummary(data.categorySummary || { income: {}, expense: {} });
      } else {
        // Fallback
        setCashFlowSeries(data.monthly || data.daily || data.weekly || []);
      }
    } catch (err) {
      console.error('Failed to fetch cash flow:', err);
      setCashFlowSeries([]);
    }
  }, [timeframe, selectedAccount]);

  // Fetch all dashboard data
  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch user settings
      const settingsResult = await api.get('/settings').catch(() => null);
      if (settingsResult) setUserSettings(settingsResult);
      
      // Fetch all in parallel
      const [
        summaryData,
        transactionsData,
        budgetsData,
        accountsData,
        goalsData,
        feedStatsData,
      ] = await Promise.allSettled([
        api.dashboard.summary(),
        api.transactions.list({ limit: 10 }),
        api.budgets?.list ? api.budgets.list() : Promise.resolve([]),
        api.accounts?.list ? api.accounts.list() : Promise.resolve([]),
        api.goals?.list ? api.goals.list() : Promise.resolve([]),
        api.get('/feed/stats').catch(() => null),
      ]);

      if (summaryData.status === 'fulfilled') setSummary(summaryData.value);
      if (transactionsData.status === 'fulfilled') {
        const txData = transactionsData.value;
        setTransactions(Array.isArray(txData) ? txData : (txData?.transactions || []));
      }
      if (budgetsData.status === 'fulfilled') setBudgets(Array.isArray(budgetsData.value) ? budgetsData.value : []);
      if (accountsData.status === 'fulfilled') setAccounts(Array.isArray(accountsData.value) ? accountsData.value : []);
      if (goalsData.status === 'fulfilled') setGoals(Array.isArray(goalsData.value) ? goalsData.value : []);
      if (feedStatsData.status === 'fulfilled' && feedStatsData.value) setFeedStats(feedStatsData.value);

      calculateAchievements(summaryData.value, budgetsData.value, goalsData.value);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchData();
    fetchMarketData();
  }, []);

  // Fetch cash flow when timeframe changes
  useEffect(() => {
    fetchCashFlow();
  }, [fetchCashFlow]);

  // Initialize chart
  useEffect(() => {
    if (cashFlowSeries.length > 0 && cashFlowChartRef.current) {
      initChart();
    }
    return () => {
      if (chartInstanceRef.current) {
        try { chartInstanceRef.current.remove(); } catch (e) {}
        chartInstanceRef.current = null;
      }
    };
  }, [cashFlowSeries, isDarkMode]);

  const initChart = useCallback(() => {
    if (!cashFlowChartRef.current || cashFlowSeries.length === 0) return;
    
    import('lightweight-charts').then(({ createChart, ColorType, CrosshairMode, LineStyle, LineSeries, AreaSeries }) => {
      if (chartInstanceRef.current) {
        try { chartInstanceRef.current.remove(); } catch (e) {}
      }

      const isDark = document.documentElement.classList.contains('dark');
      const textColor = isDark ? '#9ca3af' : '#6b7280';
      const gridColor = isDark ? '#374151' : '#e5e7eb';

      const chart = createChart(cashFlowChartRef.current, {
        width: cashFlowChartRef.current.clientWidth || 800,
        height: 350,
        layout: {
          background: { type: ColorType.Solid, color: 'transparent' },
          textColor: textColor,
        },
        grid: {
          vertLines: { color: gridColor, style: LineStyle.Dashed },
          horzLines: { color: gridColor, style: LineStyle.Dashed },
        },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: { color: CHART_COLORS.crosshair, labelBackgroundColor: '#374151' },
          horzLine: { color: CHART_COLORS.crosshair, labelBackgroundColor: '#374151' },
        },
        rightPriceScale: { borderColor: gridColor },
        timeScale: { borderColor: gridColor, timeVisible: true },
      });

      const data = cashFlowSeries.map((item, i) => ({
        time: i + 1,
        income: item.totalIncome || item.income || 0,
        expense: item.totalExpense || item.expense || 0,
        savings: item.netSavings || item.net || 0,
      }));

      // Income line
      const incomeSeries = chart.addSeries(LineSeries, {
        color: CHART_COLORS.income, lineWidth: 2, title: 'Pemasukan',
      });
      
      // Expense line
      const expenseSeries = chart.addSeries(LineSeries, {
        color: CHART_COLORS.expense, lineWidth: 2, title: 'Pengeluaran',
      });

      // Savings area
      const savingsAreaSeries = chart.addSeries(AreaSeries, {
        color: CHART_COLORS.savings + '40',
        lineColor: CHART_COLORS.savings,
        lineWidth: 2,
        topColor: CHART_COLORS.savings + '40',
        bottomColor: CHART_COLORS.savings + '05',
        title: 'Tabungan',
      });

      incomeSeries.setData(data.map(d => ({ time: d.time, value: d.income })));
      expenseSeries.setData(data.map(d => ({ time: d.time, value: d.expense })));
      savingsAreaSeries.setData(data.map(d => ({ time: d.time, value: d.savings })));

      chart.timeScale().fitContent();
      chartInstanceRef.current = chart;

      const handleResize = () => {
        if (chartInstanceRef.current && cashFlowChartRef.current) {
          chartInstanceRef.current.applyOptions({ width: cashFlowChartRef.current.clientWidth });
        }
      };
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }).catch(err => console.error('Failed to load chart:', err));
  }, [cashFlowSeries]);

  const calculateAchievements = (summaryData, budgetsData, goalsData) => {
    const earned = [];
    if (budgetsData?.length > 0 && budgetsData.every(b => (b.spent || 0) <= b.amount)) earned.push('budget_master');
    if (goalsData?.some(g => g.is_completed)) earned.push('first_goal');
    if (summaryData) {
      const income = summaryData.total_income || 0;
      const expense = summaryData.total_expense || 0;
      if (income > expense && expense > 0 && ((income - expense) / income) * 100 >= 50) earned.push('surplus');
    }
    setAchievements(earned);
  };

  // Calculate Safe-to-Spend
  const calculateSafeToSpend = () => {
    if (!summary) return { amount: 0, percent: 0, status: 'safe' };
    const totalBudget = budgets.length > 0 ? budgets.reduce((sum, b) => sum + (b.amount || 0), 0) : (summary.total_budget || 0);
    const totalSpent = budgets.length > 0 ? budgets.reduce((sum, b) => sum + (b.spent || 0), 0) : (summary.total_spent || 0);
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
    if (!summary) return { percent: 0, status: 'safe' };
    const income = summary.total_income || 0;
    const expense = summary.total_expense || 0;
    if (income === 0) return { percent: 0, status: 'neutral' };
    const percent = (expense / income) * 100;
    let status = 'safe';
    if (percent >= 100) status = 'danger';
    else if (percent >= 80) status = 'warning';
    else if (percent >= 50) status = 'caution';
    return { percent, status };
  };

  const safeToSpend = calculateSafeToSpend();
  const spendingRatio = calculateSpendingRatio();

  const statusColors = {
    safe: 'text-green-600 bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800',
    caution: 'text-yellow-600 bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800',
    warning: 'text-orange-600 bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800',
    danger: 'text-red-600 bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800',
    neutral: 'text-gray-600 bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-700',
  };

  const getStatusIcon = (status) => {
    const icons = { safe: CheckCircle, caution: Clock, warning: AlertTriangle, danger: XCircle, neutral: TrendingUp };
    const Icon = icons[status] || CheckCircle;
    return <Icon className="w-5 h-5" />;
  };

  const getStatusText = (status) => {
    const texts = { safe: '💚 Aman', caution: '🟡 Hati-hati', warning: '🟠 Peringatan', danger: '🔴 Bahaya!', neutral: '⚪ Netral' };
    return texts[status] || '⚪ Netral';
  };

  // Theme colors
  const bgPrimary = isDarkMode ? 'bg-gray-900' : 'bg-gray-50';
  const bgCard = isDarkMode ? 'bg-gray-800' : 'bg-white';
  const textPrimary = isDarkMode ? 'text-white' : 'text-gray-900';
  const textSecondary = isDarkMode ? 'text-gray-400' : 'text-gray-600';
  const borderColor = isDarkMode ? 'border-gray-700' : 'border-gray-200';

  if (loading && !summary) {
    return <div className={`flex items-center justify-center h-64 ${bgPrimary}`}><Spinner size="lg" /></div>;
  }

  return (
    <div className={`space-y-6 animate-fadeIn p-4 min-h-screen ${bgPrimary}`}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className={`text-2xl font-bold ${textPrimary}`}>{t('dashboard.title', 'Dashboard')}</h1>
          <p className={`text-sm mt-1 ${textSecondary}`}>
            {new Date().toLocaleDateString(language === 'id' ? 'id-ID' : 'en-US', { month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-3 items-center flex-wrap">
          {/* Dark Mode Toggle */}
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${bgCard} border ${borderColor}`}>
            <Sun className={`w-4 h-4 ${textSecondary}`} />
            <DarkModeToggle isDark={isDarkMode} onToggle={() => setIsDarkMode(!isDarkMode)} />
            <Moon className={`w-4 h-4 ${textSecondary}`} />
          </div>
          
          {/* NEW: Timeframe Selector */}
          <div className={`flex rounded-lg p-1 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
            {TIMEFRAMES.map(tf => (
              <button
                key={tf.key}
                onClick={() => setTimeframe(tf.key)}
                title={tf.description}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                  timeframe === tf.key ? 'bg-blue-600 text-white shadow-md' : `${textSecondary} hover:bg-gray-200 dark:hover:bg-gray-600`
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
          
          <Button variant="outline" size="sm" onClick={() => { fetchData(); fetchMarketData(); fetchCashFlow(); }}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          {onScanReceipt && (
            <Button variant="default" size="sm" onClick={onScanReceipt} className="gap-2">
              <Camera className="w-4 h-5" />
              {t('dashboard.scan', 'Scan')}
            </Button>
          )}
        </div>
      </div>

      {/* Financial Health Status */}
      <Card className={`p-4 border-2 ${statusColors[spendingRatio.status]}`}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            {getStatusIcon(spendingRatio.status)}
            <div>
              <p className="font-bold text-lg">{getStatusText(spendingRatio.status)}</p>
              <p className="text-sm opacity-80">
                {spendingRatio.status === 'danger' ? '⚠️ Anggaran Bulan Ini Jebol!' :
                 spendingRatio.status === 'warning' ? 'Pengeluaran mendekati batas!' : 'Pengeluaran masih dalam batas aman'}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold">{formatPercent(spendingRatio.percent, 0)}</p>
            <p className="text-sm opacity-80">Rasio Pengeluaran</p>
          </div>
        </div>
        <div className="mt-4">
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
            <div className={`h-3 rounded-full transition-all duration-500 ${
              spendingRatio.percent >= 100 ? 'bg-red-500' : spendingRatio.percent >= 80 ? 'bg-orange-500' : 
              spendingRatio.percent >= 50 ? 'bg-yellow-500' : 'bg-green-500'
            }`} style={{ width: `${Math.min(100, spendingRatio.percent)}%` }} />
          </div>
        </div>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Saldo', value: summary?.total_balance, icon: Wallet, color: 'green', gradient: 'from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30' },
          { label: 'Pemasukan', value: summary?.total_income, icon: TrendingUp, color: 'blue', gradient: 'from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30' },
          { label: 'Pengeluaran', value: summary?.total_expense, icon: TrendingDown, color: 'red', gradient: 'from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-800/30' },
          { label: 'Arus Kas', value: summary?.net_cash_flow, icon: Activity, color: 'purple', gradient: 'from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30' },
        ].map((card, i) => {
          const Icon = card.icon;
          return (
            <Card key={i} className={`p-4 bg-gradient-to-br ${card.gradient} border ${borderColor}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm text-${card.color}-600 dark:text-${card.color}-400`}>{card.label}</p>
                  <p className={`text-2xl font-bold text-${card.color}-700 dark:text-${card.color}-300`}>{formatCurrency(card.value || 0)}</p>
                </div>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center bg-${card.color}-200 dark:bg-${card.color}-700`}>
                  <Icon className={`w-6 h-6 text-${card.color}-600 dark:text-${card.color}-400`} />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Budget & Safe-to-Spend */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className={`p-4 ${bgCard} border ${borderColor}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <PiggyBank className="w-5 h-5 text-pink-500" />
              <h3 className={`font-semibold ${textPrimary}`}>Anggaran Bulan Ini</h3>
            </div>
            <Badge variant={safeToSpend.status === 'safe' ? 'success' : safeToSpend.status === 'warning' ? 'warning' : 'danger'}>
              {safeToSpend.percent.toFixed(0)}% sisa
            </Badge>
          </div>
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-1">
              <span className={textSecondary}>Terpakai</span>
              <span className={`font-medium ${textPrimary}`}>{formatCurrency(summary?.total_spent || 0)}</span>
            </div>
            <div className={`w-full rounded-full h-4 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
              <div className={`h-4 rounded-full transition-all ${safeToSpend.status === 'danger' ? 'bg-red-500' : safeToSpend.status === 'warning' ? 'bg-orange-500' : 'bg-green-500'}`}
                style={{ width: `${Math.min(100, safeToSpend.percent)}%` }} />
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className={textSecondary}>Budget</span>
              <span className={`font-medium ${textPrimary}`}>{formatCurrency(summary?.total_budget || 0)}</span>
            </div>
          </div>
          <div className="text-center">
            <p className={`text-3xl font-bold ${textPrimary}`}>{formatCurrency(safeToSpend.amount)}</p>
            <p className={`text-sm ${textSecondary}`}>Sisa Budget</p>
          </div>
        </Card>

        <Card className={`p-4 ${bgCard} border ${borderColor}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-500" />
              <h3 className={`font-semibold ${textPrimary}`}>Safe-to-Spend</h3>
            </div>
          </div>
          <div className="text-center mb-4">
            <p className={`text-4xl font-bold ${textPrimary}`}>{formatCurrency(safeToSpend.amount)}</p>
            <p className={`text-sm ${textSecondary}`}>Batas pengeluaran harian aman</p>
          </div>
        </Card>
      </div>

      {/* Cash Flow Chart dengan Timeframe Filter */}
      <Card className={`p-4 ${bgCard} border ${borderColor}`}>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <TrendingUp className={`w-5 h-5 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
            <h3 className={`font-semibold ${textPrimary}`}>Tren Arus Kas</h3>
            <Badge variant="outline">{TIMEFRAMES.find(t => t.key === timeframe)?.description || '3 Bulan'}</Badge>
          </div>
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className={textSecondary}>Pemasukan</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className={textSecondary}>Pengeluaran</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-blue-400" />
              <span className={textSecondary}>Tabungan</span>
            </div>
          </div>
        </div>
        
        {/* Account Filter */}
        <div className="mb-4 flex items-center gap-3">
          <label className={`text-sm ${textSecondary}`}>Akun:</label>
          <select
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(e.target.value)}
            className={`px-3 py-1.5 text-sm rounded-lg border ${borderColor} ${bgCard} ${textPrimary}`}
          >
            <option value="all">Semua Akun</option>
            {accounts.map(acc => (
              <option key={acc.id} value={acc.id}>{acc.name}</option>
            ))}
          </select>
        </div>
        
        {cashFlowSeries.length > 0 ? (
          <div ref={cashFlowChartRef} className="w-full h-[350px]" />
        ) : (
          <div className={`h-[350px] flex items-center justify-center ${textSecondary}`}>
            <Activity className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Tidak ada data untuk periode ini</p>
          </div>
        )}
        
        {/* Meta Info */}
        {cashFlowMeta?.totalDataPoints > 0 && (
          <div className={`mt-3 pt-3 border-t ${borderColor} grid grid-cols-4 gap-4 text-sm text-center`}>
            <div>
              <p className={textSecondary}>Periode</p>
              <p className={`font-semibold ${textPrimary}`}>{cashFlowMeta.periodDays || 0} hari</p>
            </div>
            <div>
              <p className={textSecondary}>Granularity</p>
              <p className={`font-semibold capitalize ${textPrimary}`}>{cashFlowMeta.granularity}</p>
            </div>
            <div>
              <p className={textSecondary}>Data Points</p>
              <p className={`font-semibold ${textPrimary}`}>{cashFlowMeta.totalDataPoints}</p>
            </div>
            <div>
              <p className={textSecondary}>Avg Harian</p>
              <p className={`font-semibold ${textPrimary}`}>{formatCurrency(cashFlowMeta.averageDailyExpense || 0)}</p>
            </div>
          </div>
        )}
      </Card>

      {/* Category Breakdown & Market Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Breakdown */}
        <Card className={`p-4 ${bgCard} border ${borderColor}`}>
          <h3 className={`font-semibold mb-4 ${textPrimary}`}>📊 Rincian Kategori</h3>
          <div className="grid grid-cols-2 gap-4">
            <CategoryBreakdown categories={categorySummary.income} type="income" isDark={isDarkMode} />
            <CategoryBreakdown categories={categorySummary.expense} type="expense" isDark={isDarkMode} />
          </div>
        </Card>

        {/* Market Overview */}
        <Card className={`p-4 ${bgCard} border ${borderColor}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`font-semibold ${textPrimary}`}>📈 Overview Pasar</h3>
            {realtimeUpdate && (
              <span className="flex items-center gap-1 text-xs text-green-500">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                Updated: {realtimeUpdate.toLocaleTimeString()}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {marketData?.forex?.quotes?.slice(0, 4).map((fx, i) => (
              <MarketCard key={`fx-${i}`} name={fx.pair} value={fx.price?.toFixed(fx.price > 100 ? 0 : 4)} 
                change={`${fx.change_percent >= 0 ? '+' : ''}${fx.change_percent?.toFixed(2)}%`} positive={fx.change_percent >= 0} isDark={isDarkMode} />
            ))}
            {marketData?.crypto?.quotes?.slice(0, 2).map((coin, i) => (
              <MarketCard key={`c-${i}`} name={coin.symbol} value={`$${coin.price?.toLocaleString()}`}
                change={`${coin.change_percent_24h >= 0 ? '+' : ''}${coin.change_percent_24h?.toFixed(2)}%`} positive={coin.change_percent_24h >= 0} isDark={isDarkMode} />
            ))}
          </div>
        </Card>
      </div>

      {/* Achievements */}
      {achievements.length > 0 && (
        <Card className={`p-4 ${bgCard} border ${borderColor}`}>
          <div className="flex items-center gap-2 mb-4">
            <Award className="w-5 h-5 text-purple-500" />
            <h3 className={`font-semibold ${textPrimary}`}>Pencapaian</h3>
          </div>
          <div className="flex flex-wrap gap-3">
            {achievements.map(id => {
              const ach = ACHIEVEMENTS.find(a => a.id === id);
              if (!ach) return null;
              const Icon = ach.icon;
              return (
                <div key={id} className={`flex items-center gap-2 px-4 py-2 rounded-full ${bgCard} border ${borderColor}`} title={ach.description}>
                  <span style={{ color: ach.color }}><Icon className="w-5 h-5" /></span>
                  <span className={`font-medium text-sm ${textPrimary}`}>{ach.name}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Recent Transactions & Feed Review */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className={`p-4 ${bgCard} border ${borderColor}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`font-semibold ${textPrimary}`}>Transaksi Terbaru</h3>
            <Button variant="ghost" size="sm" onClick={() => window.location.href = '/transactions'}>Lihat Semua →</Button>
          </div>
          {transactions.length > 0 ? (
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {transactions.slice(0, 5).map((tx, idx) => (
                <div key={tx.id || idx} className={`flex items-center justify-between py-2 border-b ${borderColor} last:border-0`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tx.type === 'income' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                      {tx.type === 'income' ? <ArrowUpRight className="w-5 h-5 text-green-600" /> : <ArrowDownRight className="w-5 h-5 text-red-600" />}
                    </div>
                    <div>
                      <p className={`font-medium ${textPrimary}`}>{tx.description || 'Transaksi'}</p>
                      <p className={`text-sm ${textSecondary}`}>{tx.category_name || tx.category || 'Lainnya'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                      {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount || 0)}
                    </p>
                    <p className={`text-xs ${textSecondary}`}>{tx.date ? new Date(tx.date).toLocaleDateString() : ''}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={`text-center py-8 ${textSecondary}`}>
              <Wallet className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Belum ada transaksi</p>
            </div>
          )}
        </Card>

        <Card className={`p-4 ${bgCard} border ${borderColor}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`font-semibold ${textPrimary}`}>Review Transaksi</h3>
            {feedStats?.pending > 0 && <Badge variant="warning">{feedStats.pending} tertunda</Badge>}
          </div>
          {feedStats?.pending > 0 ? (
            <div className="space-y-3">
              <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-yellow-900/20 border border-yellow-800' : 'bg-yellow-50 border border-yellow-200'}`}>
                <div className="flex items-center gap-3">
                  <Bell className="w-5 h-5 text-yellow-600" />
                  <div>
                    <p className={`font-medium ${isDarkMode ? 'text-yellow-200' : 'text-yellow-800'}`}>{feedStats.pending} transaksi menunggu review</p>
                  </div>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => window.location.href = '/feed'} className="w-full">Tinjau Sekarang</Button>
            </div>
          ) : (
            <div className={`text-center py-8 ${textSecondary}`}>
              <CheckCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Tidak ada transaksi tertunda</p>
            </div>
          )}
          {feedStats && (
            <div className={`mt-4 pt-4 border-t ${borderColor} grid grid-cols-3 gap-2 text-center`}>
              <div><p className="text-2xl font-bold text-green-600">{feedStats.approved || 0}</p><p className={`text-xs ${textSecondary}`}>Disetujui</p></div>
              <div><p className="text-2xl font-bold text-red-600">{feedStats.rejected || 0}</p><p className={`text-xs ${textSecondary}`}>Ditolak</p></div>
              <div><p className={`text-2xl font-bold ${textPrimary}`}>{feedStats.pending || 0}</p><p className={`text-xs ${textSecondary}`}>Tertunda</p></div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
