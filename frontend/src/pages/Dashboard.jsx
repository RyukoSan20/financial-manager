import { useState, useEffect, useRef, useCallback } from 'react';
import React from 'react';
import { Card, Button, Badge, Spinner, EmptyState } from '../components/ui';
import { 
  TrendingUp, TrendingDown, Wallet, PiggyBank, RefreshCw, Camera, 
  CheckCircle, AlertTriangle, XCircle, Clock, Target, Sparkles,
  ArrowUpRight, ArrowDownRight, Zap, Award, Shield, Trophy, Bell,
  BarChart3, Activity, DollarSign, Bitcoin, Globe, Gem, Sun, Moon,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { formatCurrency, formatNumber, formatPercent } from '../utils/format';
import api from '../services/api';
import { useTranslation } from '../i18n';

// Achievement badges configuration
const ACHIEVEMENTS = [
  { id: 'budget_master', name: 'Budget Guardian', icon: Shield, color: '#22c55e', description: 'Pengeluaran di bawah budget' },
  { id: 'savings_streak', name: 'Master Hemat', icon: Trophy, color: '#f59e0b', description: 'Tabungan naik 3 bulan berturut-turut' },
  { id: 'first_goal', name: 'Goal Getter', icon: Target, color: '#3b82f6', description: 'Capai target pertama' },
  { id: 'surplus', name: 'Surplus Star', icon: Zap, color: '#8b5cf6', description: 'Tabungan naik 50%' },
];

// Chart colors
const CHART_COLORS = {
  income: '#22c55e',
  expense: '#ef4444',
  savings: '#3b82f6',
  budget: '#f59e0b',
  safe: '#10b981',
  grid: '#e5e7eb',
  crosshair: '#94a3b8',
};

// Timeframe options
const TIMEFRAMES = [
  { key: 'daily', label: 'Harian', days: 7 },
  { key: 'weekly', label: 'Mingguan', weeks: 8 },
  { key: 'monthly', label: 'Bulanan', months: 12 },
  { key: 'yearly', label: 'Tahunan', months: 12 },
];

// Dark mode toggle component
const DarkModeToggle = ({ isDark, onToggle }) => (
  <button
    onClick={onToggle}
    className="relative w-14 h-7 bg-gray-300 dark:bg-gray-600 rounded-full transition-colors duration-300"
    aria-label="Toggle dark mode"
  >
    <span className="absolute top-0.5 left-0.5 dark:left-6 w-6 h-6 bg-white dark:bg-yellow-400 rounded-full shadow-md flex items-center justify-center transition-all duration-300">
      {isDark ? <Moon className="w-3.5 h-3.5 text-gray-700" /> : <Sun className="w-3.5 h-3.5 text-yellow-500" />}
    </span>
  </button>
);

// Market Card Component with real-time data
const MarketCard = ({ name, value, change, changeValue, positive, unit = '', live = true }) => {
  return (
    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{name}</p>
        {live && (
          <span className="flex items-center gap-1 text-xs text-green-500">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Live
          </span>
        )}
      </div>
      <p className="text-lg font-bold text-gray-900 dark:text-white">
        {value}{unit}
      </p>
      <div className={`flex items-center gap-1 text-sm ${positive ? 'text-green-600' : 'text-red-600'}`}>
        {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        <span>{changeValue !== undefined ? changeValue : change}</span>
      </div>
    </div>
  );
};

export const Dashboard = ({ onAddTransaction, onScanReceipt }) => {
  const { t, language, currency, currencyConfig } = useTranslation();
  
  // Dark mode state
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });
  
  // Chart refs
  const cashFlowChartRef = useRef(null);
  const chartInstanceRef = useRef(null);
  
  // State
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
  const [timeframe, setTimeframe] = useState('monthly');
  const [achievements, setAchievements] = useState([]);
  const [realtimeUpdate, setRealtimeUpdate] = useState(null);

  // Dark mode effect
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Toggle dark mode
  const toggleDarkMode = () => setIsDarkMode(!isDarkMode);

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

  // Fetch cash flow data with timeframe
  const fetchCashFlow = useCallback(async () => {
    try {
      const response = await api.dashboard.cashFlow(timeframe);
      if (response.status === 'success') {
        setCashFlowSeries(response.series || []);
        setChartConfig(response.chartConfig || null);
      } else {
        // Fallback for old format
        const series = response.monthly || response.daily || response.weekly || [];
        setCashFlowSeries(series);
      }
    } catch (err) {
      console.error('Failed to fetch cash flow:', err);
      setCashFlowSeries([]);
    }
  }, [timeframe]);

  // Fetch all dashboard data
  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch user settings
      const settingsResult = await api.get('/settings').catch(() => null);
      if (settingsResult) setUserSettings(settingsResult);
      
      // Fetch all dashboard data in parallel
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

  // Initialize chart when data changes
  useEffect(() => {
    if (cashFlowSeries.length > 0 && cashFlowChartRef.current) {
      initChart();
    }
    return () => {
      if (chartInstanceRef.current) {
        try {
          chartInstanceRef.current.remove();
        } catch (e) {}
        chartInstanceRef.current = null;
      }
    };
  }, [cashFlowSeries, timeframe, isDarkMode]);

  const initChart = useCallback(() => {
    if (!cashFlowChartRef.current || cashFlowSeries.length === 0) return;
    
    import('lightweight-charts').then(({ createChart, ColorType, CrosshairMode, LineStyle, LineSeries, AreaSeries, BarSeries }) => {
      if (chartInstanceRef.current) {
        try {
          chartInstanceRef.current.remove();
        } catch (e) {}
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
        rightPriceScale: {
          borderColor: gridColor,
        },
        timeScale: {
          borderColor: gridColor,
          timeVisible: true,
        },
      });

      // Prepare data with proper labels
      const labels = cashFlowSeries.map(s => s.labelX || s.month || s.label || '');
      const incomeData = cashFlowSeries.map((s, i) => ({ time: i + 1, value: s.totalIncome || s.income || 0 }));
      const expenseData = cashFlowSeries.map((s, i) => ({ time: i + 1, value: -(s.totalExpense || s.expense || 0) }));
      const netSavingsData = cashFlowSeries.map((s, i) => ({ time: i + 1, value: s.netSavings || s.net || 0 }));

      // Mode: Delta (income/expense stacked) or Net Worth (accumulated)
      const mode = chartConfig?.mode || 'delta';

      if (mode === 'delta') {
        // Income line
        const incomeSeries = chart.addSeries(LineSeries, {
          color: CHART_COLORS.income,
          lineWidth: 2,
          title: 'Pemasukan',
        });
        
        // Expense line (shown as negative values)
        const expenseSeries = chart.addSeries(LineSeries, {
          color: CHART_COLORS.expense,
          lineWidth: 2,
          title: 'Pengeluaran',
        });

        incomeSeries.setData(incomeData);
        expenseSeries.setData(expenseData);
      } else {
        // Net Worth mode - Area chart for accumulated savings
        const savingsAreaSeries = chart.addSeries(AreaSeries, {
          color: CHART_COLORS.savings + '40',
          lineColor: CHART_COLORS.savings,
          lineWidth: 2,
          topColor: CHART_COLORS.savings + '40',
          bottomColor: CHART_COLORS.savings + '05',
          title: 'Tabungan Bersih',
        });
        savingsAreaSeries.setData(netSavingsData);
      }

      chart.timeScale().fitContent();
      chartInstanceRef.current = chart;

      // Resize handler
      const handleResize = () => {
        if (chartInstanceRef.current && cashFlowChartRef.current) {
          chartInstanceRef.current.applyOptions({ 
            width: cashFlowChartRef.current.clientWidth 
          });
        }
      };
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }).catch(err => {
      console.error('Failed to load chart library:', err);
    });
  }, [cashFlowSeries, chartConfig]);

  const calculateAchievements = (summaryData, budgetsData, goalsData) => {
    const earned = [];
    
    if (budgetsData && Array.isArray(budgetsData)) {
      const underBudget = budgetsData.filter(b => (b.spent || 0) <= b.amount);
      if (underBudget.length === budgetsData.length && budgetsData.length > 0) {
        earned.push('budget_master');
      }
    }
    
    if (goalsData && Array.isArray(goalsData)) {
      const achievedGoal = goalsData.find(g => g.is_completed);
      if (achievedGoal) earned.push('first_goal');
    }
    
    if (summaryData) {
      const income = summaryData.total_income || 0;
      const expense = summaryData.total_expense || 0;
      if (income > expense && expense > 0) {
        const savingsRate = ((income - expense) / income) * 100;
        if (savingsRate >= 50) earned.push('surplus');
      }
    }
    
    setAchievements(earned);
  };

  // Calculate Safe-to-Spend
  const calculateSafeToSpend = () => {
    if (!summary) return { amount: 0, percent: 0, status: 'safe' };
    
    const totalBudget = budgets.length > 0 
      ? budgets.reduce((sum, b) => sum + (b.amount || 0), 0)
      : (summary.total_budget || 0);
    const totalSpent = budgets.length > 0 
      ? budgets.reduce((sum, b) => sum + (b.spent || 0), 0)
      : (summary.total_spent || 0);
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

  const statusColors = {
    safe: 'text-green-600 bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800',
    caution: 'text-yellow-600 bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800',
    warning: 'text-orange-600 bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800',
    danger: 'text-red-600 bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800',
    neutral: 'text-gray-600 bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-700',
  };

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
      case 'safe': return '💚 Aman';
      case 'caution': return '🟡 Hati-hati';
      case 'warning': return '🟠 Peringatan';
      case 'danger': return '🔴 Bahaya!';
      default: return '⚪ Netral';
    }
  };

  // Format market prices
  const formatMarketPrice = (price, decimals = 2) => {
    if (!price) return '-';
    if (price > 1000) return Math.round(price).toLocaleString();
    return price.toFixed(decimals);
  };

  // Theme colors
  const bgPrimary = isDarkMode ? 'bg-gray-900' : 'bg-gray-50';
  const bgCard = isDarkMode ? 'bg-gray-800' : 'bg-white';
  const textPrimary = isDarkMode ? 'text-white' : 'text-gray-900';
  const textSecondary = isDarkMode ? 'text-gray-400' : 'text-gray-600';
  const borderColor = isDarkMode ? 'border-gray-700' : 'border-gray-200';

  if (loading && !summary) {
    return (
      <div className={`flex items-center justify-center h-64 ${bgPrimary}`}>
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className={`space-y-6 animate-fadeIn p-4 min-h-screen ${bgPrimary}`}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className={`text-2xl font-bold ${textPrimary}`}>
            {t('dashboard.title', 'Dashboard')}
          </h1>
          <p className={`text-sm mt-1 ${textSecondary}`}>
            {new Date().toLocaleDateString(language === 'id' ? 'id-ID' : language === 'ja' ? 'ja-JP' : 'en-US', { month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-3 flex-wrap items-center">
          {/* Dark Mode Toggle */}
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${bgCard} border ${borderColor}`}>
            <Sun className={`w-4 h-4 ${textSecondary}`} />
            <DarkModeToggle isDark={isDarkMode} onToggle={toggleDarkMode} />
            <Moon className={`w-4 h-4 ${textSecondary}`} />
          </div>
          
          {/* Time Filter */}
          <div className={`flex rounded-lg p-1 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
            {TIMEFRAMES.map(tf => (
              <button
                key={tf.key}
                onClick={() => setTimeframe(tf.key)}
                className={`px-3 py-1.5 text-sm rounded-md transition-all duration-200 ${
                  timeframe === tf.key 
                    ? 'bg-blue-600 text-white shadow-md font-medium' 
                    : `${textSecondary} hover:bg-gray-200 dark:hover:bg-gray-600`
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
                {spendingRatio.status === 'danger' 
                  ? '⚠️ Anggaran Bulan Ini Jebol!'
                  : spendingRatio.status === 'warning'
                  ? 'Pengeluaran mendekati batas!'
                  : 'Pengeluaran masih dalam batas aman'}
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
            <div 
              className={`h-3 rounded-full transition-all duration-500 ${
                spendingRatio.percent >= 100 ? 'bg-red-500' : 
                spendingRatio.percent >= 80 ? 'bg-orange-500' : 
                spendingRatio.percent >= 50 ? 'bg-yellow-500' : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(100, spendingRatio.percent)}%` }}
            />
          </div>
        </div>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className={`p-4 ${bgCard} border ${borderColor}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${textSecondary}`}>Total Saldo</p>
              <p className={`text-2xl font-bold ${textPrimary}`}>
                {formatCurrency(summary?.total_balance || 0)}
              </p>
            </div>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isDarkMode ? 'bg-green-900/50' : 'bg-green-100'}`}>
              <Wallet className={`w-6 h-6 ${isDarkMode ? 'text-green-400' : 'text-green-600'}`} />
            </div>
          </div>
        </Card>

        <Card className={`p-4 ${bgCard} border ${borderColor}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${textSecondary}`}>Pemasukan</p>
              <p className={`text-2xl font-bold ${textPrimary}`}>
                {formatCurrency(summary?.total_income || 0)}
              </p>
            </div>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isDarkMode ? 'bg-blue-900/50' : 'bg-blue-100'}`}>
              <TrendingUp className={`w-6 h-6 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
            </div>
          </div>
        </Card>

        <Card className={`p-4 ${bgCard} border ${borderColor}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${textSecondary}`}>Pengeluaran</p>
              <p className={`text-2xl font-bold ${textPrimary}`}>
                {formatCurrency(summary?.total_expense || 0)}
              </p>
            </div>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isDarkMode ? 'bg-red-900/50' : 'bg-red-100'}`}>
              <TrendingDown className={`w-6 h-6 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`} />
            </div>
          </div>
        </Card>

        <Card className={`p-4 ${bgCard} border ${borderColor}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${textSecondary}`}>Arus Kas</p>
              <p className={`text-2xl font-bold ${textPrimary}`}>
                {formatCurrency(summary?.net_cash_flow || 0)}
              </p>
            </div>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isDarkMode ? 'bg-purple-900/50' : 'bg-purple-100'}`}>
              <Activity className={`w-6 h-6 ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`} />
            </div>
          </div>
        </Card>
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
              <div 
                className={`h-4 rounded-full transition-all duration-500 ${
                  safeToSpend.status === 'danger' ? 'bg-red-500' : 
                  safeToSpend.status === 'warning' ? 'bg-orange-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(100, safeToSpend.percent)}%` }}
              />
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className={textSecondary}>Budget</span>
              <span className={`font-medium ${textPrimary}`}>{formatCurrency(summary?.total_budget || 0)}</span>
            </div>
          </div>
          <div className="text-center">
            <p className={`text-3xl font-bold ${textPrimary}`}>
              {formatCurrency(safeToSpend.amount)}
            </p>
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
            <p className={`text-4xl font-bold ${textPrimary}`}>
              {formatCurrency(safeToSpend.amount)}
            </p>
            <p className={`text-sm ${textSecondary}`}>
              Batas pengeluaran harian aman
            </p>
          </div>
        </Card>
      </div>

      {/* Cash Flow Chart with dynamic timeframe */}
      <Card className={`p-4 ${bgCard} border ${borderColor}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity className={`w-5 h-5 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
            <h3 className={`font-semibold ${textPrimary}`}>
              Tren Arus Kas
            </h3>
            <Badge variant="outline" className="ml-2">
              {TIMEFRAMES.find(tf => tf.key === timeframe)?.label || 'Bulanan'}
            </Badge>
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
        {cashFlowSeries.length > 0 ? (
          <div ref={cashFlowChartRef} className="w-full h-[350px]" />
        ) : (
          <div className={`h-[350px] flex items-center justify-center ${textSecondary}`}>
            <div className="text-center">
              <Activity className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Tidak ada data untuk periode ini</p>
              <p className="text-sm mt-1">Tambahkan transaksi untuk melihat grafik</p>
            </div>
          </div>
        )}
        
        {/* Data points indicator */}
        {cashFlowSeries.length > 0 && (
          <div className={`mt-3 pt-3 border-t ${borderColor} text-xs ${textSecondary} text-center`}>
            {cashFlowSeries.length} data points • {chartConfig?.mode === 'net_worth' ? 'Mode Tabungan Bersih' : 'Mode Delta'}
          </div>
        )}
      </Card>

      {/* Market Overview with Real-Time Data */}
      <Card className={`p-4 ${bgCard} border ${borderColor}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className={`w-5 h-5 ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`} />
            <h3 className={`font-semibold ${textPrimary}`}>
              Overview Pasar
            </h3>
          </div>
          {realtimeUpdate && (
            <span className="flex items-center gap-1 text-xs text-green-500">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Updated: {realtimeUpdate.toLocaleTimeString()}
            </span>
          )}
        </div>
        
        {/* Market Content */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {marketData?.forex?.quotes?.slice(0, 4).map((fx, idx) => (
            <MarketCard 
              key={`fx-${idx}`}
              name={fx.pair}
              value={fx.price?.toFixed(fx.price > 100 ? 0 : 4) || '-'}
              changeValue={`${fx.change_percent >= 0 ? '+' : ''}${fx.change_percent?.toFixed(2)}%`}
              positive={fx.change_percent >= 0}
              live
            />
          ))}
          {marketData?.crypto?.quotes?.slice(0, 2).map((coin, idx) => (
            <MarketCard 
              key={`crypto-${idx}`}
              name={coin.symbol}
              value={`$${formatMarketPrice(coin.price)}`}
              changeValue={`${coin.change_percent_24h >= 0 ? '+' : ''}${coin.change_percent_24h?.toFixed(2)}%`}
              positive={coin.change_percent_24h >= 0}
              live
            />
          ))}
        </div>
        
        <div className={`mt-4 pt-3 border-t ${borderColor} text-xs ${textSecondary} text-center`}>
          Data real-time dari Yahoo Finance • Auto-refresh setiap 30 detik
        </div>
      </Card>

      {/* Achievements */}
      {achievements.length > 0 && (
        <Card className={`p-4 ${bgCard} border ${borderColor}`}>
          <div className="flex items-center gap-2 mb-4">
            <Award className="w-5 h-5 text-purple-500" />
            <h3 className={`font-semibold ${textPrimary}`}>
              Pencapaian
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
                  className={`flex items-center gap-2 px-4 py-2 rounded-full ${bgCard} border ${borderColor}`}
                  title={achievement.description}
                >
                  <span style={{ color: achievement.color }}><Icon className="w-5 h-5" /></span>
                  <span className={`font-medium text-sm ${textPrimary}`}>{achievement.name}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className={`p-4 ${bgCard} border ${borderColor}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`font-semibold ${textPrimary}`}>
              Transaksi Terbaru
            </h3>
            <Button variant="ghost" size="sm" onClick={() => window.location.href = '/transactions'}>
              Lihat Semua →
            </Button>
          </div>
          {transactions.length > 0 ? (
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {transactions.slice(0, 5).map((tx, idx) => {
                if (!tx) return null;
                return (
                  <div key={tx.id || idx} className={`flex items-center justify-between py-2 border-b ${borderColor} last:border-0`}>
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
                        <p className={`font-medium ${textPrimary}`}>{tx.description || 'Transaksi'}</p>
                        <p className={`text-sm ${textSecondary}`}>{tx.category_name || tx.category || 'Lainnya'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                        {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount || 0)}
                      </p>
                      <p className={`text-xs ${textSecondary}`}>
                        {tx.date ? new Date(tx.date).toLocaleDateString() : ''}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={`text-center py-8 ${textSecondary}`}>
              <Wallet className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Belum ada transaksi</p>
            </div>
          )}
        </Card>

        {/* Pending Feed Review */}
        <Card className={`p-4 ${bgCard} border ${borderColor}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`font-semibold ${textPrimary}`}>
              Review Transaksi
            </h3>
            {feedStats && feedStats.pending > 0 && (
              <Badge variant="warning">{feedStats.pending} tertunda</Badge>
            )}
          </div>
          {feedStats && feedStats.pending > 0 ? (
            <div className="space-y-3">
              <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-yellow-900/20' : 'bg-yellow-50'} border ${isDarkMode ? 'border-yellow-800' : 'border-yellow-200'}`}>
                <div className="flex items-center gap-3">
                  <Bell className="w-5 h-5 text-yellow-600" />
                  <div>
                    <p className={`font-medium ${isDarkMode ? 'text-yellow-200' : 'text-yellow-800'}`}>
                      {feedStats.pending} transaksi menunggu review
                    </p>
                  </div>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => window.location.href = '/feed'} className="w-full">
                Tinjau Sekarang
              </Button>
            </div>
          ) : (
            <div className={`text-center py-8 ${textSecondary}`}>
              <CheckCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Tidak ada transaksi tertunda</p>
            </div>
          )}
          
          {feedStats && (
            <div className={`mt-4 pt-4 border-t ${borderColor}`}>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-2xl font-bold text-green-600">{feedStats.approved || 0}</p>
                  <p className={`text-xs ${textSecondary}`}>Disetujui</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-600">{feedStats.rejected || 0}</p>
                  <p className={`text-xs ${textSecondary}`}>Ditolak</p>
                </div>
                <div>
                  <p className={`text-2xl font-bold ${textPrimary}`}>{feedStats.pending || 0}</p>
                  <p className={`text-xs ${textSecondary}`}>Tertunda</p>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
