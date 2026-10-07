import { useState, useEffect, useRef, useCallback } from 'react';
import React from 'react';
import { Card, Button, Badge, Spinner, EmptyState } from '../components/ui';
import { 
  TrendingUp, TrendingDown, Wallet, PiggyBank, RefreshCw, Camera, 
  CheckCircle, AlertTriangle, XCircle, Clock, Target, Sparkles,
  ArrowUpRight, ArrowDownRight, Zap, Award, Shield, Trophy, Bell,
  BarChart3, LineChart, PieChart as PieChartIcon, Activity,
  DollarSign, Bitcoin, Globe, Gem
} from 'lucide-react';
import { formatCurrency, formatNumber, formatPercent } from '../utils/format';
import api from '../services/api';
import { useTranslation } from '../i18n';
import { createChart, ColorType, CrosshairMode, LineStyle, LineSeries, AreaSeries } from 'lightweight-charts';

// Achievement badges configuration
const ACHIEVEMENTS = [
  { id: 'budget_master', name: 'Budget Guardian', icon: Shield, color: '#22c55e', description: 'Pengeluaran di bawah budget' },
  { id: 'savings_streak', name: 'Master Hemat', icon: Trophy, color: '#f59e0b', description: 'Tabungan naik 3 bulan berturut-turut' },
  { id: 'first_goal', name: 'Goal Getter', icon: Target, color: '#3b82f6', description: 'Capai target pertama' },
  { id: 'surplus', name: 'Surplus Star', icon: Zap, color: '#8b5cf6', description: 'Tabungan naik 50%' },
];

// Multi-Asset Markets
const MARKET_WIDGETS = [
  { id: 'forex', name: 'Forex', icon: Globe, color: '#10b981' },
  { id: 'crypto', name: 'Crypto', icon: Bitcoin, color: '#f7931a' },
  { id: 'commodities', name: 'Komoditas', icon: Gem, color: '#eab308' },
  { id: 'stocks', name: 'Saham', icon: BarChart3, color: '#6366f1' },
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
  const [cryptoPrices, setCryptoPrices] = useState(null);
  const [commodityPrices, setCommodityPrices] = useState(null);
  const [timeFilter, setTimeFilter] = useState('monthly');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [activeMarket, setActiveMarket] = useState('forex');
  
  // Gamification state
  const [achievements, setAchievements] = useState([]);

  // Initialize date range - stable reference
  const initializeDateRange = React.useCallback((filter) => {
    const now = new Date();
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    
    let start = new Date(now);
    start.setHours(0, 0, 0, 0);
    
    if (filter === 'daily') {
      // Today only - start = end
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
        chartInstanceRef.current.remove();
        chartInstanceRef.current = null;
      }
    };
  }, [cashFlow]);

  const initChart = useCallback(() => {
    if (!cashFlowChartRef.current || cashFlow.length === 0) return;
    
    // Clean up existing chart
    if (chartInstanceRef.current) {
      chartInstanceRef.current.remove();
    }

    const chart = createChart(cashFlowChartRef.current, {
      width: cashFlowChartRef.current.clientWidth,
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

    // Income line (new API)
    const incomeSeries = chart.addSeries(LineSeries, {
      color: CHART_COLORS.income,
      lineWidth: 2,
      title: 'Pemasukan',
      priceFormat: { type: 'custom', formatter: (price) => formatNumber(price) },
    });
    
    // Expense line (new API)
    const expenseSeries = chart.addSeries(LineSeries, {
      color: CHART_COLORS.expense,
      lineWidth: 2,
      title: 'Pengeluaran',
      priceFormat: { type: 'custom', formatter: (price) => formatNumber(price) },
    });

    // Savings area (new API)
    const savingsAreaSeries = chart.addSeries(AreaSeries, {
      color: CHART_COLORS.savings + '40',
      lineColor: CHART_COLORS.savings,
      lineWidth: 2,
      topColor: CHART_COLORS.savings + '40',
      bottomColor: CHART_COLORS.savings + '05',
      title: 'Tabungan',
    });

    // Prepare data
    const chartData = cashFlow.map((item, index) => {
      const date = new Date(item.month || item.date);
      // Use index as time if no proper date
      const time = item.month ? 
        (date.getTime() / 1000) : 
        Math.floor(Date.now() / 1000) - (cashFlow.length - index) * 86400 * 30;
      
      return {
        time: typeof time === 'number' && time > 1000000000 ? time : index,
        income: item.income || item.total_income || 0,
        expense: item.expense || item.total_expense || 0,
        savings: Math.max(0, (item.income || item.total_income || 0) - (item.expense || item.total_expense || 0)),
      };
    });

    incomeSeries.setData(chartData.map(d => ({ time: d.time, value: d.income })));
    expenseSeries.setData(chartData.map(d => ({ time: d.time, value: d.expense })));
    savingsAreaSeries.setData(chartData.map(d => ({ time: d.time, value: d.savings })));

    // Legend update on crosshair move
    chart.subscribeCrosshairMove((param) => {
      if (param.time) {
        const data = param.seriesData;
        // Update legend display if needed
      }
    });

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
        // Handle both { monthly: [...] } and [...] formats
        const cashFlowArray = cashFlowValue?.monthly || cashFlowValue || [];
        setCashFlow(cashFlowArray);
      }
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

  const statusColors = {
    safe: 'text-green-600 bg-green-50 border-green-200',
    caution: 'text-yellow-600 bg-yellow-50 border-yellow-200',
    warning: 'text-orange-600 bg-orange-50 border-orange-200',
    danger: 'text-red-600 bg-red-50 border-red-200',
    neutral: 'text-gray-600 bg-gray-50 border-gray-200',
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
                {t(`time.${filter}`, filter.charAt(0).toUpperCase() + filter.slice(1))}
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
                  ? t('dashboard.budget_exceeded', '⚠️ Anggaran Bulan Ini Jebol!')
                  : spendingRatio.status === 'warning'
                  ? t('dashboard.budget_warning', 'Pengeluaran mendekati batas!')
                  : t('dashboard.budget_ok', 'Pengeluaran masih dalam batas aman')}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold">{formatPercent(spendingRatio.percent, 0)}</p>
            <p className="text-sm opacity-80">{t('dashboard.spent_ratio', 'Rasio Pengeluaran')}</p>
          </div>
        </div>
        {/* Progress Bar */}
        <div className="mt-4">
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${
                spendingRatio.status === 'danger' ? 'bg-red-500' : 
                spendingRatio.status === 'warning' ? 'bg-orange-500' :
                spendingRatio.status === 'caution' ? 'bg-yellow-500' : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(100, spendingRatio.percent)}%` }}
            />
          </div>
        </div>
      </Card>

      {/* Stats Grid - 4 columns */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Income */}
        <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-900/20 dark:to-green-800/10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-700 dark:text-green-400">{t('dashboard.income', 'Pemasukan')}</p>
              <p className="text-xl font-bold text-green-600 dark:text-green-300">
                {summary?.total_income ? formatCurrency(summary.total_income) : t('dashboard.zero', 'Rp 0')}
              </p>
            </div>
            <div className="w-12 h-12 rounded-full bg-green-200/50 dark:bg-green-800/50 flex items-center justify-center">
              <ArrowUpRight className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </Card>

        {/* Expense */}
        <Card className="p-4 bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-900/20 dark:to-red-800/10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-700 dark:text-red-400">{t('dashboard.expense', 'Pengeluaran')}</p>
              <p className="text-xl font-bold text-red-600 dark:text-red-300">
                {summary?.total_expense ? formatCurrency(summary.total_expense) : t('dashboard.zero', 'Rp 0')}
              </p>
            </div>
            <div className="w-12 h-12 rounded-full bg-red-200/50 dark:bg-red-800/50 flex items-center justify-center">
              <ArrowDownRight className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
          </div>
        </Card>

        {/* Net Cash Flow */}
        <Card className={`p-4 bg-gradient-to-br ${
          (summary?.net_cash_flow || 0) >= 0 
            ? 'from-blue-50 to-blue-100/50 dark:from-blue-900/20 dark:to-blue-800/10'
            : 'from-orange-50 to-orange-100/50 dark:from-orange-900/20 dark:to-orange-800/10'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('dashboard.net_flow', 'Arus Kas')}</p>
              <p className={`text-xl font-bold ${
                (summary?.net_cash_flow || 0) >= 0 
                  ? 'text-blue-600 dark:text-blue-300' 
                  : 'text-orange-600 dark:text-orange-300'
              }`}>
                {summary?.net_cash_flow ? formatCurrency(summary.net_cash_flow) : t('dashboard.zero', 'Rp 0')}
              </p>
            </div>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              (summary?.net_cash_flow || 0) >= 0 
                ? 'bg-blue-200/50 dark:bg-blue-800/50' 
                : 'bg-orange-200/50 dark:bg-orange-800/50'
            }`}>
              {(summary?.net_cash_flow || 0) >= 0 ? (
                <TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              ) : (
                <TrendingDown className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              )}
            </div>
          </div>
        </Card>

        {/* Safe-to-Spend */}
        <Card className={`p-4 bg-gradient-to-br ${
          safeToSpend.status === 'danger' 
            ? 'from-red-100 to-red-200/50 dark:from-red-900/40 dark:to-red-800/20 border-2 border-red-300 dark:border-red-700'
            : safeToSpend.status === 'warning'
            ? 'from-orange-50 to-orange-100/50 dark:from-orange-900/20 dark:to-orange-800/10'
            : 'from-green-50 to-green-100/50 dark:from-green-900/20 dark:to-green-800/10'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('dashboard.safe_to_spend', 'Sisa Aman')}</p>
              <p className={`text-xl font-bold ${
                safeToSpend.status === 'danger' ? 'text-red-600 dark:text-red-300' : 
                safeToSpend.status === 'warning' ? 'text-orange-600 dark:text-orange-300' :
                'text-green-600 dark:text-green-300'
              }`}>
                {formatCurrency(safeToSpend.amount)}
              </p>
            </div>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              safeToSpend.status === 'danger' 
                ? 'bg-red-200/50 dark:bg-red-800/50' 
                : safeToSpend.status === 'warning'
                ? 'bg-orange-200/50 dark:bg-orange-800/50'
                : 'bg-green-200/50 dark:bg-green-800/50'
            }`}>
              <Shield className={`w-6 h-6 ${
                safeToSpend.status === 'danger' ? 'text-red-600 dark:text-red-400' : 
                safeToSpend.status === 'warning' ? 'text-orange-600 dark:text-orange-400' :
                'text-green-600 dark:text-green-400'
              }`} />
            </div>
          </div>
          {/* Progress */}
          <div className="mt-2">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-500">{t('dashboard.remaining', 'Sisa')}</span>
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

      {/* TradingView Chart - Full Width */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <LineChart className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {t('dashboard.cash_flow_trend', 'Tren Arus Kas')}
            </h3>
          </div>
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-gray-600 dark:text-gray-400">{t('dashboard.income', 'Pemasukan')}</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-gray-600 dark:text-gray-400">{t('dashboard.expense', 'Pengeluaran')}</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-blue-400" />
              <span className="text-gray-600 dark:text-gray-400">{t('dashboard.savings', 'Tabungan')}</span>
            </div>
          </div>
        </div>
        {cashFlow.length > 0 ? (
          <div ref={cashFlowChartRef} className="w-full h-[300px]" />
        ) : (
          <div className="h-[300px] flex items-center justify-center text-gray-400">
            <div className="text-center">
              <Activity className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>{t('dashboard.no_chart_data', 'Tidak ada data untuk ditampilkan')}</p>
              <p className="text-sm mt-1">{t('dashboard.add_transaction_hint', 'Tambahkan transaksi untuk melihat grafik')}</p>
            </div>
          </div>
        )}
      </Card>

      {/* Multi-Asset Markets */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-purple-600" />
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {t('dashboard.market_overview', 'Overview Pasar')}
            </h3>
          </div>
        </div>
        
        {/* Market Tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          {MARKET_WIDGETS.map(widget => {
            const Icon = widget.icon;
            return (
              <button
                key={widget.id}
                onClick={() => setActiveMarket(widget.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                  activeMarket === widget.id
                    ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                <Icon className="w-4 h-4" style={{ color: widget.color }} />
                <span className="text-sm font-medium">{widget.name}</span>
              </button>
            );
          })}
        </div>

        {/* Market Content */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {activeMarket === 'forex' && exchangeRates ? (
            <>
              <MarketCard name="USD/IDR" value={formatNumber(exchangeRates.rates?.IDR || 15600)} change="Live" positive icon={<Globe className="w-4 h-4 text-green-500" />} />
              <MarketCard name="USD/JPY" value={formatNumber(exchangeRates.rates?.JPY || 149.5)} change="Live" positive={false} icon={<Globe className="w-4 h-4 text-blue-500" />} />
              <MarketCard name="EUR/USD" value={(1 / (exchangeRates.rates?.EUR || 1)).toFixed(4)} change="Live" positive icon={<Globe className="w-4 h-4 text-yellow-500" />} />
              <MarketCard name="GBP/USD" value={(1 / (exchangeRates.rates?.GBP || 1)).toFixed(4)} change="Live" positive={false} icon={<Globe className="w-4 h-4 text-purple-500" />} />
            </>
          ) : null}
          
          {activeMarket === 'crypto' && marketData?.crypto?.prices ? (
            <>
              {marketData.crypto.prices.slice(0, 4).map((coin, idx) => (
                <MarketCard 
                  key={coin.id || `crypto-${idx}`}
                  name={coin.symbol}
                  value={coin.price?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  change={`${coin.change_24h?.toFixed(1) || 0}%`}
                  positive={coin.change_24h >= 0}
                  icon={<Bitcoin className="w-4 h-4 text-orange-500" />}
                />
              ))}
            </>
          ) : null}
          
          {activeMarket === 'commodities' && marketData?.commodities?.prices ? (
            <>
              {marketData.commodities.prices.slice(0, 4).map((item, idx) => (
                <MarketCard 
                  key={item.symbol || `commodity-${idx}`}
                  name={item.name}
                  value={formatNumber(item.price)}
                  change={`${item.change_24h?.toFixed(1) || 0}%`}
                  positive={item.change_24h >= 0}
                  unit={item.unit}
                  icon={<Gem className="w-4 h-4 text-yellow-500" />}
                />
              ))}
            </>
          ) : null}
          
          {activeMarket === 'stocks' && marketData?.stocks?.stocks ? (
            <>
              <MarketCard name="IHSG" value={formatNumber(marketData.stocks.index?.value || 7250)} change={`${marketData.stocks.index?.change_percent?.toFixed(2) || 0}%`} positive={(marketData.stocks.index?.change || 0) >= 0} icon={<BarChart3 className="w-4 h-4 text-red-500" />} />
              {marketData.stocks.stocks.slice(0, 3).map((stock, idx) => (
                <MarketCard 
                  key={stock.symbol || `stock-${idx}`}
                  name={stock.symbol}
                  value={formatNumber(stock.price)}
                  change={`${stock.change?.toFixed(1) || 0}%`}
                  positive={stock.change >= 0}
                  icon={<BarChart3 className="w-4 h-4 text-blue-500" />}
                />
              ))}
            </>
          ) : null}
          
          {!marketData && (
            <div className="col-span-4 text-center py-4 text-gray-400">
              {t('dashboard.loading_market', 'Memuat data pasar...')}
            </div>
          )}
        </div>
        
        {/* Last Updated */}
        {marketData?.updated && (
          <div className="mt-3 pt-3 border-t dark:border-gray-700 text-xs text-gray-400 text-center">
            {t('dashboard.last_update', 'Update')}: {new Date(marketData.updated).toLocaleTimeString()}
          </div>
        )}
      </Card>

      {/* Achievements */}
      {achievements.length > 0 && (
        <Card className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-200 dark:border-purple-800">
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
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700"
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

      {/* Recent Transactions & Pending Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {transactions.slice(0, 5).map((tx) => {
                if (!tx || !tx.id) return null;
                return (
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
            <EmptyState 
              icon={Wallet}
              title={t('dashboard.no_transactions', 'Belum ada transaksi')}
              description={t('dashboard.add_first', 'Tambahkan transaksi pertama Anda')}
            />
          )}
        </Card>

        {/* Pending Feed Review */}
        <Card className={`p-4 ${feedStats && feedStats.pending > 0 ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800' : ''}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {t('dashboard.feed_review', 'Review Transaksi')}
            </h3>
            {feedStats && feedStats.pending > 0 && (
              <Badge variant="warning">{feedStats.pending} {t('dashboard.pending', 'tertunda')}</Badge>
            )}
          </div>
          {feedStats && feedStats.pending > 0 ? (
            <div className="space-y-3">
              <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <div className="flex items-center gap-3">
                  <Bell className="w-5 h-5 text-yellow-600" />
                  <div>
                    <p className="font-medium text-yellow-800 dark:text-yellow-200">
                      {feedStats.pending} {t('dashboard.pending_review', 'transaksi menunggu review')}
                    </p>
                    <p className="text-sm text-yellow-600 dark:text-yellow-400">
                      {t('dashboard.review_prompt', 'Segera tinjau transaksi dari scan struk')}
                    </p>
                  </div>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => window.location.href = '/feed'} className="w-full">
                {t('dashboard.review_now', 'Tinjau Sekarang')}
              </Button>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <CheckCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>{t('dashboard.no_pending', 'Tidak ada transaksi tertunda')}</p>
            </div>
          )}
          
          {/* Quick Stats */}
          {feedStats && (
            <div className="mt-4 pt-4 border-t dark:border-gray-700">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-2xl font-bold text-green-600">{feedStats.approved || 0}</p>
                  <p className="text-xs text-gray-500">{t('dashboard.approved', 'Disetujui')}</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-600">{feedStats.rejected || 0}</p>
                  <p className="text-xs text-gray-500">{t('dashboard.rejected', 'Ditolak')}</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-600">{feedStats.pending || 0}</p>
                  <p className="text-xs text-gray-500">{t('dashboard.pending', 'Tertunda')}</p>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

// Market Card Component
const MarketCard = ({ name, value, change, positive, icon, unit = '' }) => (
  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
    <div className="flex items-center gap-2 mb-1">
      {icon}
      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{name}</span>
    </div>
    <p className="text-lg font-bold text-gray-900 dark:text-white">
      {value}{unit}
    </p>
    <div className={`flex items-center gap-1 text-sm ${positive ? 'text-green-600' : 'text-red-600'}`}>
      {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      <span>{change}</span>
    </div>
  </div>
);

export default Dashboard;
