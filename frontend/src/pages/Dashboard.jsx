import { useState, useEffect, useRef, useCallback } from 'react';
import React from 'react';
import { Card, Button, Badge, Spinner, EmptyState } from '../components/ui';
import { 
  TrendingUp, TrendingDown, Wallet, PiggyBank, RefreshCw, Camera, 
  CheckCircle, AlertTriangle, XCircle, Clock, Target, Sparkles,
  ArrowUpRight, ArrowDownRight, Zap, Award, Shield, Trophy, Bell,
  BarChart3, Activity, DollarSign, Bitcoin, Globe, Gem
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

// Multi-Asset Markets - using string icons instead of components
const MARKET_WIDGETS = [
  { id: 'forex', name: 'Forex', color: '#10b981' },
  { id: 'crypto', name: 'Crypto', color: '#f7931a' },
  { id: 'commodities', name: 'Komoditas', color: '#eab308' },
  { id: 'stocks', name: 'Saham', color: '#6366f1' },
];

// Asset colors for charts
const CHART_COLORS = {
  income: '#22c55e',
  expense: '#ef4444',
  savings: '#3b82f6',
  budget: '#f59e0b',
  safe: '#10b981',
  grid: '#e5e7eb',
  crosshair: '#94a3b8',
};

// Market Card Component - simple functional component
const MarketCard = ({ name, value, change, positive, unit = '' }) => {
  return (
    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{name}</p>
      <p className="text-lg font-bold text-gray-900 dark:text-white">
        {value}{unit}
      </p>
      <div className={`flex items-center gap-1 text-sm ${positive ? 'text-green-600' : 'text-red-600'}`}>
        {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        <span>{change}</span>
      </div>
    </div>
  );
};

export const Dashboard = ({ onAddTransaction, onScanReceipt }) => {
  const { t, language, currency, currencyConfig } = useTranslation();
  
  // Chart refs
  const cashFlowChartRef = useRef(null);
  const chartInstanceRef = useRef(null);
  
  // State
  const [loading, setLoading] = useState(true);
  const [userSettings, setUserSettings] = useState(null);
  const [marketData, setMarketData] = useState(null);
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
  const [activeMarket, setActiveMarket] = useState('forex');
  
  // Gamification state
  const [achievements, setAchievements] = useState([]);

  // Initialize date range
  const initializeDateRange = useCallback((filter) => {
    const now = new Date();
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    
    let start = new Date(now);
    start.setHours(0, 0, 0, 0);
    
    if (filter === 'daily') {
      // Today only
    } else if (filter === 'weekly') {
      start.setDate(end.getDate() - 7);
    } else if (filter === 'monthly') {
      start.setMonth(end.getMonth(), 1);
    } else if (filter === 'yearly') {
      start.setFullYear(end.getFullYear(), 0, 1);
    }
    
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    };
  }, []);

  // Update date range when filter changes
  useEffect(() => {
    const dates = initializeDateRange(timeFilter);
    setStartDate(dates.start);
    setEndDate(dates.end);
  }, [timeFilter, initializeDateRange]);

  // Fetch data when dates are ready
  useEffect(() => {
    if (startDate && endDate) {
      fetchData();
    }
  }, [startDate, endDate]);

  // Initialize chart when data changes
  useEffect(() => {
    if (cashFlow.length > 0 && cashFlowChartRef.current) {
      initChart();
    }
    return () => {
      if (chartInstanceRef.current) {
        try {
          chartInstanceRef.current.remove();
        } catch (e) {
          // Chart already removed
        }
        chartInstanceRef.current = null;
      }
    };
  }, [cashFlow]);

  const initChart = useCallback(() => {
    if (!cashFlowChartRef.current || cashFlow.length === 0) return;
    
    // Dynamically import lightweight-charts
    import('lightweight-charts').then(({ createChart, ColorType, CrosshairMode, LineStyle, LineSeries, AreaSeries }) => {
      // Clean up existing chart
      if (chartInstanceRef.current) {
        try {
          chartInstanceRef.current.remove();
        } catch (e) {
          // Already removed
        }
      }

      const chart = createChart(cashFlowChartRef.current, {
        width: cashFlowChartRef.current.clientWidth || 800,
        height: 300,
        layout: {
          background: { type: ColorType.Solid, color: 'transparent' },
          textColor: '#6b7280',
        },
        grid: {
          vertLines: { color: CHART_COLORS.grid, style: LineStyle.Dashed },
          horzLines: { color: CHART_COLORS.grid, style: LineStyle.Dashed },
        },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: { color: CHART_COLORS.crosshair, labelBackgroundColor: '#374151' },
          horzLine: { color: CHART_COLORS.crosshair, labelBackgroundColor: '#374151' },
        },
        rightPriceScale: {
          borderColor: CHART_COLORS.grid,
        },
        timeScale: {
          borderColor: CHART_COLORS.grid,
          timeVisible: true,
        },
      });

      // Income line
      const incomeSeries = chart.addSeries(LineSeries, {
        color: CHART_COLORS.income,
        lineWidth: 2,
        title: 'Pemasukan',
      });
      
      // Expense line
      const expenseSeries = chart.addSeries(LineSeries, {
        color: CHART_COLORS.expense,
        lineWidth: 2,
        title: 'Pengeluaran',
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

      // Prepare data - ensure valid time values
      const chartData = cashFlow.map((item, index) => {
        const timeValue = index + 1; // Use index as simple time value
        return {
          time: timeValue,
          income: item.income || item.total_income || 0,
          expense: item.expense || item.total_expense || 0,
          savings: Math.max(0, (item.income || item.total_income || 0) - (item.expense || item.total_expense || 0)),
        };
      });

      incomeSeries.setData(chartData.map(d => ({ time: d.time, value: d.income })));
      expenseSeries.setData(chartData.map(d => ({ time: d.time, value: d.expense })));
      savingsAreaSeries.setData(chartData.map(d => ({ time: d.time, value: d.savings })));

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
  }, [cashFlow]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch user settings and market data in parallel
      const [settingsResult, marketResult] = await Promise.allSettled([
        api.get('/settings').catch(() => null),
        api.get('/market/summary').catch(() => null),
      ]);
      
      if (settingsResult.status === 'fulfilled' && settingsResult.value) {
        setUserSettings(settingsResult.value);
      }
      if (marketResult.status === 'fulfilled' && marketResult.value) {
        setMarketData(marketResult.value);
      }
      
      const [
        summaryData,
        cashFlowData,
        transactionsData,
        budgetsData,
        accountsData,
        goalsData,
        feedStatsData,
        exchangeData,
      ] = await Promise.allSettled([
        api.dashboard.summary(startDate, endDate),
        api.dashboard.cashFlow(12),
        api.transactions.list({ start_date: startDate, end_date: endDate, limit: 10 }),
        api.budgets?.list ? api.budgets.list() : Promise.resolve([]),
        api.accounts?.list ? api.accounts.list() : Promise.resolve([]),
        api.goals?.list ? api.goals.list() : Promise.resolve([]),
        api.get('/feed/stats').catch(() => null),
        api.exchange.rates('USD').catch(() => null),
      ]);

      if (summaryData.status === 'fulfilled') setSummary(summaryData.value);
      if (cashFlowData.status === 'fulfilled') {
        const cashFlowValue = cashFlowData.value;
        const cashFlowArray = cashFlowValue?.monthly || cashFlowValue || [];
        setCashFlow(cashFlowArray);
      }
      if (transactionsData.status === 'fulfilled') {
        const txData = transactionsData.value;
        setTransactions(Array.isArray(txData) ? txData : (txData?.transactions || []));
      }
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
    safe: 'text-green-600 bg-green-50 border-green-200',
    caution: 'text-yellow-600 bg-yellow-50 border-yellow-200',
    warning: 'text-orange-600 bg-orange-50 border-orange-200',
    danger: 'text-red-600 bg-red-50 border-red-200',
    neutral: 'text-gray-600 bg-gray-50 border-gray-200',
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'safe': return React.createElement(CheckCircle, { className: "w-5 h-5" });
      case 'caution': return React.createElement(Clock, { className: "w-5 h-5" });
      case 'warning': return React.createElement(AlertTriangle, { className: "w-5 h-5" });
      case 'danger': return React.createElement(XCircle, { className: "w-5 h-5" });
      default: return React.createElement(TrendingUp, { className: "w-5 h-5" });
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

  if (loading && !summary) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn p-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('dashboard.title', 'Dashboard')}
          </h1>
          <p className="text-gray-500 mt-1">
            {new Date().toLocaleDateString(language === 'id' ? 'id-ID' : language === 'ja' ? 'ja-JP' : 'en-US', { month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
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
                {filter === 'daily' ? 'Harian' : filter === 'weekly' ? 'Mingguan' : filter === 'monthly' ? 'Bulanan' : 'Tahunan'}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={fetchData}>
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
              className={`h-3 rounded-full transition-all ${
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
        <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-600 dark:text-green-400">Total Saldo</p>
              <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                {formatCurrency(summary?.total_balance || 0)}
              </p>
            </div>
            <div className="w-12 h-12 rounded-full bg-green-200 dark:bg-green-800 flex items-center justify-center">
              <Wallet className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-600 dark:text-blue-400">Pemasukan</p>
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                {formatCurrency(summary?.total_income || 0)}
              </p>
            </div>
            <div className="w-12 h-12 rounded-full bg-blue-200 dark:bg-blue-800 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-600 dark:text-red-400">Pengeluaran</p>
              <p className="text-2xl font-bold text-red-700 dark:text-red-300">
                {formatCurrency(summary?.total_expense || 0)}
              </p>
            </div>
            <div className="w-12 h-12 rounded-full bg-red-200 dark:bg-red-800 flex items-center justify-center">
              <TrendingDown className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-purple-600 dark:text-purple-400">Arus Kas</p>
              <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                {formatCurrency(summary?.net_cash_flow || 0)}
              </p>
            </div>
            <div className="w-12 h-12 rounded-full bg-purple-200 dark:bg-purple-800 flex items-center justify-center">
              <Activity className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </Card>
      </div>

      {/* Budget & Safe-to-Spend */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Budget Progress */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <PiggyBank className="w-5 h-5 text-pink-500" />
              <h3 className="font-semibold">Anggaran Bulan Ini</h3>
            </div>
            <Badge variant={safeToSpend.status === 'safe' ? 'success' : safeToSpend.status === 'warning' ? 'warning' : 'danger'}>
              {safeToSpend.percent.toFixed(0)}% sisa
            </Badge>
          </div>
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-500">Terpakai</span>
              <span className="font-medium">{formatCurrency(summary?.total_spent || 0)}</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4">
              <div 
                className={`h-4 rounded-full transition-all ${
                  safeToSpend.status === 'danger' ? 'bg-red-500' : 
                  safeToSpend.status === 'warning' ? 'bg-orange-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(100, safeToSpend.percent)}%` }}
              />
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-gray-500">Budget</span>
              <span className="font-medium">{formatCurrency(summary?.total_budget || 0)}</span>
            </div>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(safeToSpend.amount)}
            </p>
            <p className="text-sm text-gray-500">Sisa Budget</p>
          </div>
        </Card>

        {/* Safe to Spend */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-500" />
              <h3 className="font-semibold">Safe-to-Spend</h3>
            </div>
          </div>
          <div className="text-center mb-4">
            <p className="text-4xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(safeToSpend.amount)}
            </p>
            <p className="text-sm text-gray-500">
              Batas pengeluaran harian aman
            </p>
          </div>
          <div className="mt-2">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-500">Sisa</span>
              <span className="font-medium">{formatPercent(safeToSpend.percent, 0)}</span>
            </div>
            <div className="w-full bg-gray-200/50 dark:bg-gray-700/50 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all ${
                  safeToSpend.status === 'danger' ? 'bg-red-500' : 
                  safeToSpend.status === 'warning' ? 'bg-orange-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(100, safeToSpend.percent)}%` }}
              />
            </div>
          </div>
        </Card>
      </div>

      {/* Cash Flow Chart */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Tren Arus Kas
            </h3>
          </div>
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-gray-600 dark:text-gray-400">Pemasukan</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-gray-600 dark:text-gray-400">Pengeluaran</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-blue-400" />
              <span className="text-gray-600 dark:text-gray-400">Tabungan</span>
            </div>
          </div>
        </div>
        {cashFlow.length > 0 ? (
          <div ref={cashFlowChartRef} className="w-full h-[300px]" />
        ) : (
          <div className="h-[300px] flex items-center justify-center text-gray-400">
            <div className="text-center">
              <Activity className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Tidak ada data untuk ditampilkan</p>
              <p className="text-sm mt-1">Tambahkan transaksi untuk melihat grafik</p>
            </div>
          </div>
        )}
      </Card>

      {/* Market Overview */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-purple-600" />
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Overview Pasar
            </h3>
          </div>
        </div>
        
        {/* Market Tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          {MARKET_WIDGETS.map(widget => (
            <button
              key={widget.id}
              onClick={() => setActiveMarket(widget.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                activeMarket === widget.id
                  ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: widget.color }} />
              <span className="text-sm font-medium">{widget.name}</span>
            </button>
          ))}
        </div>

        {/* Market Content */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {activeMarket === 'forex' && exchangeRates && (
            <>
              <MarketCard name="USD/IDR" value={formatNumber(exchangeRates.rates?.IDR || 15600)} change="Live" positive />
              <MarketCard name="USD/JPY" value={formatNumber(exchangeRates.rates?.JPY || 149.5)} change="Live" positive={false} />
              <MarketCard name="EUR/USD" value={(1 / (exchangeRates.rates?.EUR || 1)).toFixed(4)} change="Live" positive />
              <MarketCard name="GBP/USD" value={(1 / (exchangeRates.rates?.GBP || 1)).toFixed(4)} change="Live" positive={false} />
            </>
          )}
          
          {activeMarket === 'crypto' && marketData?.crypto?.prices && (
            <>
              {marketData.crypto.prices.slice(0, 4).map((coin, idx) => (
                <MarketCard 
                  key={coin.id || `crypto-${idx}`}
                  name={coin.symbol}
                  value={coin.price?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  change={`${coin.change_24h?.toFixed(1) || 0}%`}
                  positive={coin.change_24h >= 0}
                />
              ))}
            </>
          )}
          
          {activeMarket === 'commodities' && marketData?.commodities?.prices && (
            <>
              {marketData.commodities.prices.slice(0, 4).map((item, idx) => (
                <MarketCard 
                  key={item.symbol || `commodity-${idx}`}
                  name={item.name}
                  value={formatNumber(item.price)}
                  change={`${item.change_24h?.toFixed(1) || 0}%`}
                  positive={item.change_24h >= 0}
                />
              ))}
            </>
          )}
          
          {activeMarket === 'stocks' && marketData?.stocks?.stocks && (
            <>
              <MarketCard name="IHSG" value={formatNumber(marketData.stocks.index?.value || 7250)} change="Live" positive />
              {marketData.stocks.stocks.slice(0, 3).map((stock, idx) => (
                <MarketCard 
                  key={stock.symbol || `stock-${idx}`}
                  name={stock.symbol}
                  value={formatNumber(stock.price)}
                  change={`${stock.change?.toFixed(1) || 0}%`}
                  positive={stock.change >= 0}
                />
              ))}
            </>
          )}
          
          {!marketData && (
            <div className="col-span-4 text-center py-4 text-gray-400">
              Memuat data pasar...
            </div>
          )}
        </div>
        
        {marketData?.updated && (
          <div className="mt-3 pt-3 border-t dark:border-gray-700 text-xs text-gray-400 text-center">
            Update: {new Date(marketData.updated).toLocaleTimeString()}
          </div>
        )}
      </Card>

      {/* Achievements */}
      {achievements.length > 0 && (
        <Card className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-200 dark:border-purple-800">
          <div className="flex items-center gap-2 mb-4">
            <Award className="w-5 h-5 text-purple-600" />
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Pencapaian
            </h3>
          </div>
          <div className="flex flex-wrap gap-3">
            {achievements.map(achievementId => {
              const achievement = ACHIEVEMENTS.find(a => a.id === achievementId);
              if (!achievement) return null;
              return (
                <div 
                  key={achievementId}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700"
                  title={achievement.description}
                >
                  <span style={{ color: achievement.color }}>{React.createElement(achievement.icon, { className: "w-5 h-5" })}</span>
                  <span className="font-medium text-sm">{achievement.name}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Recent Transactions & Pending Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Transactions */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">
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
                  <div key={tx.id || idx} className="flex items-center justify-between py-2 border-b dark:border-gray-700 last:border-0">
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
                        {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount || 0)}
                      </p>
                      <p className="text-xs text-gray-400">
                        {tx.date ? new Date(tx.date).toLocaleDateString() : ''}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <Wallet className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Belum ada transaksi</p>
              <p className="text-sm">Tambahkan transaksi pertama Anda</p>
            </div>
          )}
        </Card>

        {/* Pending Feed Review */}
        <Card className={`p-4 ${feedStats && feedStats.pending > 0 ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800' : ''}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Review Transaksi
            </h3>
            {feedStats && feedStats.pending > 0 && (
              <Badge variant="warning">{feedStats.pending} tertunda</Badge>
            )}
          </div>
          {feedStats && feedStats.pending > 0 ? (
            <div className="space-y-3">
              <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <div className="flex items-center gap-3">
                  <Bell className="w-5 h-5 text-yellow-600" />
                  <div>
                    <p className="font-medium text-yellow-800 dark:text-yellow-200">
                      {feedStats.pending} transaksi menunggu review
                    </p>
                    <p className="text-sm text-yellow-600 dark:text-yellow-400">
                      Segera tinjau transaksi dari scan struk
                    </p>
                  </div>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => window.location.href = '/feed'} className="w-full">
                Tinjau Sekarang
              </Button>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <CheckCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Tidak ada transaksi tertunda</p>
            </div>
          )}
          
          {feedStats && (
            <div className="mt-4 pt-4 border-t dark:border-gray-700">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-2xl font-bold text-green-600">{feedStats.approved || 0}</p>
                  <p className="text-xs text-gray-500">Disetujui</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-600">{feedStats.rejected || 0}</p>
                  <p className="text-xs text-gray-500">Ditolak</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-600">{feedStats.pending || 0}</p>
                  <p className="text-xs text-gray-500">Tertunda</p>
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
