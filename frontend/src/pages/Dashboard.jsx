import { useState, useEffect, useRef, useCallback } from 'react';
import React from 'react';
import { Card, Button, Badge, Spinner, EmptyState } from '../components/ui';
import { 
  TrendingUp, TrendingDown, Wallet, PiggyBank, RefreshCw, Camera, 
  CheckCircle, AlertTriangle, XCircle, Clock, Target, Sparkles,
  ArrowUpRight, ArrowDownRight, Zap, Award, Shield, Trophy, Bell,
  BarChart3, Activity, DollarSign, Bitcoin, Globe, Gem, Sun, Moon,
  ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Settings2,
  LineChart, PieChart as PieChartIcon
} from 'lucide-react';
import { formatCurrency, formatNumber, formatPercent } from '../utils/format';
import api from '../services/api';
import { useTranslation } from '../i18n';

// ============================================================================
// ACHIEVEMENTS CONFIGURATION - DIPULIHKAN DAN DIENHANCE
// ============================================================================
const ACHIEVEMENTS = [
  { id: 'budget_master', name: 'Budget Guardian', icon: Shield, color: '#22c55e', description: 'Pengeluaran di bawah budget', requirement: 'Pengeluaran < 80% budget' },
  { id: 'savings_streak', name: 'Master Hemat', icon: Trophy, color: '#f59e0b', description: 'Tabungan naik 3 bulan berturut-turut', requirement: 'Net savings positif 3x' },
  { id: 'first_goal', name: 'Goal Getter', icon: Target, color: '#3b82f6', description: 'Capai target pertama', requirement: 'Selesaikan 1 goal' },
  { id: 'surplus', name: 'Surplus Star', icon: Zap, color: '#8b5cf6', description: 'Tabungan naik 50%', requirement: 'Net savings > 50% income' },
  { id: 'early_bird', name: 'Early Bird', icon: Clock, color: '#06b6d4', description: 'Transaksi sebelum jam 9 pagi', requirement: 'Transaksi < 09:00' },
  { id: 'diverse_saver', name: 'Diversified Saver', icon: PieChartIcon, color: '#ec4899', description: 'Investasi di 3 kategori berbeda', requirement: '3+ kategori investasi' },
];

const ACHIEVEMENT_ICONS = {
  budget_master: Shield,
  savings_streak: Trophy,
  first_goal: Target,
  surplus: Zap,
  early_bird: Clock,
  diverse_saver: PieChartIcon,
};

// ============================================================================
// TIMEFRAME CONFIGURATION - STOCKBIT STYLE
// ============================================================================
const TIMEFRAMES = [
  { key: '1D', label: '1D', description: '24 Jam', granularity: 'hourly', dataPoints: 24, range: 1 },
  { key: '1W', label: '1W', description: '1 Minggu', granularity: 'daily', dataPoints: 7, range: 7 },
  { key: '1M', label: '1M', description: '1 Bulan', granularity: 'daily', dataPoints: 30, range: 30 },
  { key: '3M', label: '3M', description: '3 Bulan', granularity: 'weekly', dataPoints: 13, range: 90 },
  { key: 'YTD', label: 'YTD', description: 'Tahun Ini', granularity: 'monthly', dataPoints: 12, range: 365 },
  { key: '1Y', label: '1Y', description: '1 Tahun', granularity: 'monthly', dataPoints: 12, range: 365 },
  { key: '3Y', label: '3Y', description: '3 Tahun', granularity: 'monthly', dataPoints: 36, range: 1095 },
  { key: '5Y', label: '5Y', description: '5 Tahun', granularity: 'monthly', dataPoints: 60, range: 1825 },
];

// ============================================================================
// CHART COLORS CONFIGURATION
// ============================================================================
const CHART_COLORS = {
  income: '#22c55e',
  expense: '#ef4444',
  savings: '#3b82f6',
  budget: '#f59e0b',
  safe: '#10b981',
  grid: '#e5e7eb',
  crosshair: '#94a3b8',
  dark: {
    grid: '#374151',
    text: '#9ca3af',
    crosshair: '#6b7280',
  }
};

// ============================================================================
// CATEGORY COLORS
// ============================================================================
const CATEGORY_COLORS = {
  // Income
  salary: '#22c55e',
  freelance: '#10b981',
  investment_income: '#06b6d4',
  bonus: '#8b5cf6',
  other_income: '#6b7280',
  // Expense
  food: '#ef4444',
  transport: '#f97316',
  shopping: '#eab308',
  health: '#22c55e',
  education: '#3b82f6',
  entertainment: '#ec4899',
  bills: '#8b5cf6',
  investment: '#14b8a6',
  other_expense: '#6b7280',
};

// ============================================================================
// UTILITY COMPONENTS
// ============================================================================

// Dark Mode Toggle Slider
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

// Mode Toggle (Basic/Advanced)
const ModeToggle = ({ mode, onToggle, isDark }) => (
  <div className={`flex rounded-lg p-1 ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
    <button
      onClick={() => onToggle('basic')}
      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
        mode === 'basic' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600'
      }`}
    >
      <TrendingUp className="w-3.5 h-3.5" />
      Basic
    </button>
    <button
      onClick={() => onToggle('advanced')}
      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
        mode === 'advanced' ? 'bg-purple-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600'
      }`}
    >
      <LineChart className="w-3.5 h-3.5" />
      Advanced
    </button>
  </div>
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

// Achievement Badge Component
const AchievementBadge = ({ achievement, earned, isDark }) => {
  const Icon = ACHIEVEMENT_ICONS[achievement.id] || Award;
  return (
    <div 
      className={`relative flex flex-col items-center p-3 rounded-xl transition-all ${
        earned 
          ? `bg-gradient-to-br from-opacity-20 to-opacity-10` 
          : `opacity-40 grayscale`
      } ${isDark ? 'bg-gray-800/50' : 'bg-white'}`}
      style={earned ? { 
        background: `linear-gradient(135deg, ${achievement.color}20, ${achievement.color}10)`,
        border: `1px solid ${achievement.color}40`
      } : { border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}` }}
      title={`${achievement.name}: ${achievement.description}\nSyarat: ${achievement.requirement}`}
    >
      <div 
        className="w-12 h-12 rounded-full flex items-center justify-center mb-2"
        style={{ backgroundColor: earned ? `${achievement.color}30` : (isDark ? '#374151' : '#e5e7eb') }}
      >
        <Icon className="w-6 h-6" style={{ color: earned ? achievement.color : (isDark ? '#6b7280' : '#9ca3af') }} />
      </div>
      <p className={`text-xs font-medium text-center ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{achievement.name}</p>
      {earned && (
        <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
          <CheckCircle className="w-3 h-3 text-white" />
        </div>
      )}
    </div>
  );
};

// Category Breakdown Component
const CategoryBreakdown = ({ categories, type, isDark, maxItems = 5 }) => {
  const entries = Object.entries(categories || {});
  const total = entries.reduce((sum, [, data]) => sum + (data.total || 0), 0);
  const sortedCategories = entries.sort((a, b) => b[1].total - a[1].total).slice(0, maxItems);
  
  return (
    <div className="space-y-2">
      <h4 className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
        {type === 'income' ? '💰 Rincian Pemasukan' : '💸 Rincian Pengeluaran'}
      </h4>
      {sortedCategories.length > 0 ? (
        <>
          {sortedCategories.map(([key, data]) => {
            const percentage = total > 0 ? ((data.total || 0) / total * 100) : 0;
            return (
              <div key={key} className="flex items-center gap-2">
                <div 
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0" 
                  style={{ backgroundColor: CATEGORY_COLORS[key] || '#6b7280' }} 
                />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className={`capitalize truncate ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      {key.replace(/_/g, ' ')}
                    </span>
                    <span className={`font-medium flex-shrink-0 ml-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      {formatCurrency(data.total || 0)}
                    </span>
                  </div>
                  <div className={`w-full rounded-full h-1.5 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                    <div 
                      className="h-1.5 rounded-full transition-all" 
                      style={{ 
                        width: `${percentage}%`, 
                        backgroundColor: CATEGORY_COLORS[key] || '#6b7280' 
                      }} 
                    />
                  </div>
                </div>
              </div>
            );
          })}
          {entries.length > maxItems && (
            <p className={`text-xs text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              +{entries.length - maxItems} kategori lainnya
            </p>
          )}
        </>
      ) : (
        <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Tidak ada data</p>
      )}
    </div>
  );
};

// Spending Progress Bar
const SpendingProgressBar = ({ current, total, status, isDark }) => {
  const percentage = total > 0 ? Math.min(100, (current / total) * 100) : 0;
  const colors = {
    safe: 'bg-green-500',
    caution: 'bg-yellow-500',
    warning: 'bg-orange-500',
    danger: 'bg-red-500',
  };
  
  return (
    <div className={`w-full rounded-full h-3 overflow-hidden ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
      <div 
        className={`h-full rounded-full transition-all duration-500 ${colors[status] || colors.safe}`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
};

// ============================================================================
// MAIN DASHBOARD COMPONENT
// ============================================================================
export const Dashboard = ({ onAddTransaction, onScanReceipt }) => {
  const { t, language, currency, currencyConfig } = useTranslation();
  
  // ==========================================================================
  // STATE MANAGEMENT - SEMUA STATE DIPULIHKAN
  // ==========================================================================
  
  // Dark mode state
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });
  
  // Display mode (basic/advanced)
  const [displayMode, setDisplayMode] = useState('basic');
  
  // Chart refs
  const cashFlowChartRef = useRef(null);
  const chartInstanceRef = useRef(null);
  
  // Loading states
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  
  // Data states - SEMUA DIPULIHKAN
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
  const [debts, setDebts] = useState([]);
  const [recurringTransactions, setRecurringTransactions] = useState([]);
  
  // NEW: Timeframe & Filter states
  const [timeframe, setTimeframe] = useState('3M');
  const [selectedAccount, setSelectedAccount] = useState('all');
  const [realtimeUpdate, setRealtimeUpdate] = useState(null);
  const [categorySummary, setCategorySummary] = useState({ income: {}, expense: {} });
  const [cashFlowMeta, setCashFlowMeta] = useState({});
  const [chartType, setChartType] = useState('line'); // line, bar, area
  
  // ==========================================================================
  // EFFECTS
  // ==========================================================================
  
  // Dark mode effect
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    // Re-init chart with new theme
    if (cashFlowSeries.length > 0) {
      initChart();
    }
  }, [isDarkMode]);
  
  // Display mode change effect
  useEffect(() => {
    if (cashFlowSeries.length > 0) {
      initChart();
    }
  }, [displayMode]);

  // ==========================================================================
  // DATA FETCHING FUNCTIONS
  // ==========================================================================
  
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
    setChartLoading(true);
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
        // Fallback ke format lama
        setCashFlowSeries(data.monthly || data.daily || data.weekly || []);
      }
    } catch (err) {
      console.error('Failed to fetch cash flow:', err);
      setCashFlowSeries([]);
    } finally {
      setChartLoading(false);
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
        debtsData,
        recurringData,
      ] = await Promise.allSettled([
        api.dashboard.summary(),
        api.transactions.list({ limit: 10 }),
        api.budgets?.list ? api.budgets.list() : Promise.resolve([]),
        api.accounts?.list ? api.accounts.list() : Promise.resolve([]),
        api.goals?.list ? api.goals.list() : Promise.resolve([]),
        api.get('/feed/stats').catch(() => null),
        api.get('/debts').catch(() => []),
        api.get('/recurring').catch(() => []),
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
      if (debtsData.status === 'fulfilled') setDebts(Array.isArray(debtsData.value) ? debtsData.value : []);
      if (recurringData.status === 'fulfilled') setRecurringTransactions(Array.isArray(recurringData.value) ? recurringData.value : []);

      // Calculate achievements
      calculateAchievements(
        summaryData.value, 
        budgetsData.value, 
        goalsData.value,
        transactionsData.value
      );
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

  // ==========================================================================
  // CHART INITIALIZATION - LIGHTWEIGHT-CHARTS
  // ==========================================================================
  
  const initChart = useCallback(() => {
    if (!cashFlowChartRef.current || cashFlowSeries.length === 0) return;
    
    import('lightweight-charts').then(({ 
      createChart, ColorType, CrosshairMode, LineStyle, 
      LineSeries, AreaSeries, HistogramSeries 
    }) => {
      if (chartInstanceRef.current) {
        try { chartInstanceRef.current.remove(); } catch (e) {}
      }

      const isDark = document.documentElement.classList.contains('dark');
      const textColor = isDark ? '#9ca3af' : '#6b7280';
      const gridColor = isDark ? '#374151' : '#e5e7eb';

      const chart = createChart(cashFlowChartRef.current, {
        width: cashFlowChartRef.current.clientWidth || 800,
        height: displayMode === 'advanced' ? 450 : 350,
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
          vertLine: { color: CHART_COLORS.crosshair, labelBackgroundColor: isDark ? '#4b5563' : '#374151' },
          horzLine: { color: CHART_COLORS.crosshair, labelBackgroundColor: isDark ? '#4b5563' : '#374151' },
        },
        rightPriceScale: { borderColor: gridColor },
        timeScale: { 
          borderColor: gridColor, 
          timeVisible: true,
          tickMarkFormatter: (time) => {
            const idx = cashFlowSeries.findIndex(s => s._idx === time);
            if (idx >= 0) return cashFlowSeries[idx].labelX || '';
            return '';
          }
        },
      });

      // Prepare data
      const data = cashFlowSeries.map((item, i) => ({
        time: i + 1,
        _idx: i + 1,
        income: item.totalIncome || item.income || 0,
        expense: item.totalExpense || item.expense || 0,
        savings: item.netSavings || item.net || 0,
      }));

      // Add series based on chart type and display mode
      if (displayMode === 'advanced') {
        // ADVANCED: Full comparison chart with histogram
        const incomeSeries = chart.addSeries(LineSeries, {
          color: CHART_COLORS.income, 
          lineWidth: 2, 
          title: 'Pemasukan',
          crosshairMarkerVisible: true,
        });
        
        const expenseSeries = chart.addSeries(LineSeries, {
          color: CHART_COLORS.expense, 
          lineWidth: 2, 
          title: 'Pengeluaran',
          crosshairMarkerVisible: true,
        });

        // Savings area for advanced
        const savingsAreaSeries = chart.addSeries(AreaSeries, {
          color: CHART_COLORS.savings + '40',
          lineColor: CHART_COLORS.savings,
          lineWidth: 2,
          topColor: CHART_COLORS.savings + '40',
          bottomColor: CHART_COLORS.savings + '05',
          title: 'Tabungan',
          crosshairMarkerVisible: true,
        });

        incomeSeries.setData(data.map(d => ({ time: d.time, value: d.income })));
        expenseSeries.setData(data.map(d => ({ time: d.time, value: d.expense })));
        savingsAreaSeries.setData(data.map(d => ({ time: d.time, value: d.savings })));
      } else {
        // BASIC: Net savings only with area
        const savingsSeries = chart.addSeries(AreaSeries, {
          color: CHART_COLORS.savings + '60',
          lineColor: CHART_COLORS.savings,
          lineWidth: 2,
          topColor: CHART_COLORS.savings + '60',
          bottomColor: CHART_COLORS.savings + '10',
          title: 'Net Savings',
          crosshairMarkerVisible: true,
        });
        
        savingsSeries.setData(data.map(d => ({ time: d.time, value: d.savings })));
        
        // Add baseline at 0
        const baselineSeries = chart.addSeries(LineSeries, {
          color: '#6b7280',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          title: 'Baseline',
        });
        baselineSeries.setData(data.map(d => ({ time: d.time, value: 0 })));
      }

      chart.timeScale().fitContent();
      chartInstanceRef.current = chart;

      // Handle resize
      const handleResize = () => {
        if (chartInstanceRef.current && cashFlowChartRef.current) {
          chartInstanceRef.current.applyOptions({ width: cashFlowChartRef.current.clientWidth });
        }
      };
      window.addEventListener('resize', handleResize);
      return () => {
        window.removeEventListener('resize', handleResize);
      };
    }).catch(err => console.error('Failed to load chart:', err));
  }, [cashFlowSeries, isDarkMode, displayMode]);

  // Initialize chart effect
  useEffect(() => {
    if (cashFlowSeries.length > 0) {
      initChart();
    }
    return () => {
      if (chartInstanceRef.current) {
        try { chartInstanceRef.current.remove(); } catch (e) {}
        chartInstanceRef.current = null;
      }
    };
  }, [cashFlowSeries, displayMode]);

  // ==========================================================================
  // ACHIEVEMENT CALCULATION
  // ==========================================================================
  
  const calculateAchievements = (summaryData, budgetsData, goalsData, transactionsData) => {
    const earned = [];
    const transactions = Array.isArray(transactionsData) ? transactionsData : (transactionsData?.transactions || []);
    const budgets = Array.isArray(budgetsData) ? budgetsData : [];
    const goals = Array.isArray(goalsData) ? goalsData : [];
    
    // Budget Master: Semua budget di bawah 80%
    if (budgets.length > 0) {
      const allUnderBudget = budgets.every(b => (b.spent || 0) <= (b.amount || 0) * 0.8);
      if (allUnderBudget) earned.push('budget_master');
    }
    
    // First Goal: Selesaikan 1 goal
    if (goals.some(g => g.is_completed || g.progress >= 100)) earned.push('first_goal');
    
    // Surplus: Tabungan > 50% income
    if (summaryData) {
      const income = summaryData.total_income || 0;
      const expense = summaryData.total_expense || 0;
      const savings = income - expense;
      if (income > 0 && (savings / income) * 100 >= 50) earned.push('surplus');
    }
    
    // Early Bird: Transaksi sebelum jam 9 pagi
    const hasEarlyTransaction = transactions.some(tx => {
      if (!tx.created_at) return false;
      const hour = new Date(tx.created_at).getHours();
      return hour < 9;
    });
    if (hasEarlyTransaction) earned.push('early_bird');
    
    // Savings Streak: Net positif 3 bulan (simplified check)
    if (summaryData && (summaryData.net_cash_flow || 0) > 0) {
      // In real implementation, check historical data
      earned.push('savings_streak');
    }
    
    setAchievements(earned);
  };

  // ==========================================================================
  // CALCULATIONS
  // ==========================================================================
  
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

  // Status colors and icons
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
    const texts = { 
      safe: '💚 Aman', 
      caution: '🟡 Hati-hati', 
      warning: '🟠 Peringatan', 
      danger: '🔴 Bahaya!', 
      neutral: '⚪ Netral' 
    };
    return texts[status] || '⚪ Netral';
  };

  // Theme colors
  const isDark = isDarkMode;
  const bgPrimary = isDark ? 'bg-gray-900' : 'bg-gray-50';
  const bgCard = isDark ? 'bg-gray-800' : 'bg-white';
  const textPrimary = isDark ? 'text-white' : 'text-gray-900';
  const textSecondary = isDark ? 'text-gray-400' : 'text-gray-600';
  const borderColor = isDark ? 'border-gray-700' : 'border-gray-200';

  // Loading state
  if (loading && !summary) {
    return (
      <div className={`flex items-center justify-center h-64 ${bgPrimary}`}>
        <Spinner size="lg" />
      </div>
    );
  }

  // ==========================================================================
  // RENDER
  // ==========================================================================
  
  return (
    <div className={`space-y-6 animate-fadeIn p-4 min-h-screen ${bgPrimary}`}>
      
      {/* ================================================================ */}
      {/* HEADER */}
      {/* ================================================================ */}
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
          
          {/* Display Mode Toggle (Basic/Advanced) */}
          <ModeToggle mode={displayMode} onToggle={setDisplayMode} isDark={isDarkMode} />
          
          {/* Timeframe Selector */}
          <div className={`flex rounded-lg p-1 ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
            {TIMEFRAMES.map(tf => (
              <button
                key={tf.key}
                onClick={() => setTimeframe(tf.key)}
                title={tf.description}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                  timeframe === tf.key 
                    ? 'bg-blue-600 text-white shadow-md' 
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

      {/* ================================================================ */}
      {/* FINANCIAL HEALTH STATUS - DIPULIHKAN */}
      {/* ================================================================ */}
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
          <SpendingProgressBar 
            current={spendingRatio.percent} 
            total={100} 
            status={spendingRatio.status}
            isDark={isDark}
          />
        </div>
      </Card>

      {/* ================================================================ */}
      {/* SUMMARY CARDS - DIPULIHKAN */}
      {/* ================================================================ */}
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

      {/* ================================================================ */}
      {/* ADVANCED: Budget & Safe-to-Spend */}
      {/* ================================================================ */}
      {displayMode === 'advanced' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Budget Progress */}
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
              <SpendingProgressBar 
                current={summary?.total_spent || 0} 
                total={summary?.total_budget || 0} 
                status={safeToSpend.status}
                isDark={isDark}
              />
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

          {/* Safe-to-Spend */}
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
            <div className={`grid grid-cols-3 gap-2 text-center text-xs ${textSecondary}`}>
              <div>
                <p className="font-bold text-lg text-green-500">{formatCurrency((safeToSpend.amount / 30) || 0)}</p>
                <p>Per Hari</p>
              </div>
              <div>
                <p className="font-bold text-lg text-blue-500">{formatCurrency((safeToSpend.amount / 4) || 0)}</p>
                <p>Per Minggu</p>
              </div>
              <div>
                <p className="font-bold text-lg text-purple-500">{formatCurrency(safeToSpend.amount)}</p>
                <p>Total</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ================================================================ */}
      {/* CASH FLOW CHART - UTAMA */}
      {/* ================================================================ */}
      <Card className={`p-4 ${bgCard} border ${borderColor}`}>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <TrendingUp className={`w-5 h-5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
            <h3 className={`font-semibold ${textPrimary}`}>Tren Arus Kas</h3>
            <Badge variant="outline">{TIMEFRAMES.find(t => t.key === timeframe)?.description || '3 Bulan'}</Badge>
            {displayMode === 'advanced' && (
              <Badge variant="secondary">Advanced</Badge>
            )}
          </div>
          
          <div className="flex gap-4 text-sm items-center">
            {/* Legend */}
            <div className="flex gap-4">
              {displayMode === 'advanced' && (
                <>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span className={textSecondary}>Pemasukan</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <span className={textSecondary}>Pengeluaran</span>
                  </div>
                </>
              )}
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-blue-400" />
                <span className={textSecondary}>Tabungan</span>
              </div>
            </div>
            
            {/* Chart Type Toggle */}
            <div className={`flex rounded p-0.5 ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
              {['line', 'area'].map(type => (
                <button
                  key={type}
                  onClick={() => setChartType(type)}
                  className={`px-2 py-1 text-xs rounded capitalize ${
                    chartType === type ? 'bg-blue-600 text-white' : `${textSecondary} hover:bg-gray-200 dark:hover:bg-gray-600`
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
        </div>
        
        {/* Account Filter */}
        <div className="mb-4 flex items-center gap-3 flex-wrap">
          <label className={`text-sm ${textSecondary}`}>Akun:</label>
          <select
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(e.target.value)}
            className={`px-3 py-1.5 text-sm rounded-lg border ${borderColor} ${bgCard} ${textPrimary}`}
          >
            <option value="all">Semua Akun</option>
            {accounts.map(acc => (
              <option key={acc.id} value={acc.id}>{acc.name} ({formatCurrency(acc.balance || 0)})</option>
            ))}
          </select>
          
          <label className={`text-sm ${textSecondary}`}>Periode:</label>
          <span className={`text-sm font-medium ${textPrimary}`}>
            {cashFlowMeta?.startDate || '-'} s/d {cashFlowMeta?.endDate || '-'}
          </span>
        </div>
        
        {/* Chart */}
        {chartLoading ? (
          <div className={`h-[350px] flex items-center justify-center ${textSecondary}`}>
            <Spinner size="lg" />
            <span className="ml-2">Memuat chart...</span>
          </div>
        ) : cashFlowSeries.length > 0 ? (
          <div ref={cashFlowChartRef} className="w-full" style={{ height: displayMode === 'advanced' ? 450 : 350 }} />
        ) : (
          <div className={`h-[350px] flex flex-col items-center justify-center ${textSecondary}`}>
            <BarChart3 className="w-12 h-12 mb-2 opacity-50" />
            <p>Tidak ada data untuk periode ini</p>
            <p className="text-xs mt-1">Pilih timeframe lain atau tambahkan transaksi</p>
          </div>
        )}
        
        {/* Meta Info - Advanced */}
        {displayMode === 'advanced' && cashFlowMeta?.totalDataPoints > 0 && (
          <div className={`mt-4 pt-4 border-t ${borderColor} grid grid-cols-4 md:grid-cols-6 gap-4 text-sm text-center`}>
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
            <div>
              <p className={textSecondary}>Total Income</p>
              <p className="font-semibold text-green-500">{formatCurrency(cashFlowMeta.totalIncome || 0)}</p>
            </div>
            <div>
              <p className={textSecondary}>Total Expense</p>
              <p className="font-semibold text-red-500">{formatCurrency(cashFlowMeta.totalExpense || 0)}</p>
            </div>
          </div>
        )}
      </Card>

      {/* ================================================================ */}
      {/* ADVANCED: Category Breakdown & Market Overview */}
      {/* ================================================================ */}
      {displayMode === 'advanced' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Category Breakdown */}
          <Card className={`p-4 ${bgCard} border ${borderColor}`}>
            <h3 className={`font-semibold mb-4 ${textPrimary}`}>📊 Rincian Kategori</h3>
            <div className="grid grid-cols-2 gap-4">
              <CategoryBreakdown categories={categorySummary.income} type="income" isDark={isDark} maxItems={5} />
              <CategoryBreakdown categories={categorySummary.expense} type="expense" isDark={isDark} maxItems={5} />
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
                <MarketCard 
                  key={`fx-${i}`} 
                  name={fx.pair} 
                  value={fx.price?.toFixed(fx.price > 100 ? 0 : 4)} 
                  change={`${fx.change_percent >= 0 ? '+' : ''}${fx.change_percent?.toFixed(2)}%`} 
                  positive={fx.change_percent >= 0} 
                  isDark={isDark} 
                />
              ))}
              {marketData?.crypto?.quotes?.slice(0, 2).map((coin, i) => (
                <MarketCard 
                  key={`c-${i}`} 
                  name={coin.symbol} 
                  value={`$${coin.price?.toLocaleString()}`}
                  change={`${coin.change_percent_24h >= 0 ? '+' : ''}${coin.change_percent_24h?.toFixed(2)}%`} 
                  positive={coin.change_percent_24h >= 0} 
                  isDark={isDark} 
                />
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ================================================================ */}
      {/* ACHIEVEMENTS - DIPULIHKAN DAN DIENHANCE */}
      {/* ================================================================ */}
      <Card className={`p-4 ${bgCard} border ${borderColor}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-purple-500" />
            <h3 className={`font-semibold ${textPrimary}`}>🏆 Pencapaian</h3>
            <Badge variant="secondary">{achievements.length}/{ACHIEVEMENTS.length}</Badge>
          </div>
          <p className={`text-xs ${textSecondary}`}>{achievements.length} dari {ACHIEVEMENTS.length} achievement tercapai</p>
        </div>
        
        {/* Achievement Progress Bar */}
        <div className={`w-full rounded-full h-2 mb-4 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
          <div 
            className="h-2 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all"
            style={{ width: `${(achievements.length / ACHIEVEMENTS.length) * 100}%` }}
          />
        </div>
        
        {/* Achievement Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {ACHIEVEMENTS.map(achievement => (
            <AchievementBadge 
              key={achievement.id}
              achievement={achievement}
              earned={achievements.includes(achievement.id)}
              isDark={isDark}
            />
          ))}
        </div>
      </Card>

      {/* ================================================================ */}
      {/* ADVANCED: Debts & Recurring Transactions */}
      {/* ================================================================ */}
      {displayMode === 'advanced' && (debts.length > 0 || recurringTransactions.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Debts */}
          {debts.length > 0 && (
            <Card className={`p-4 ${bgCard} border ${borderColor}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-orange-500" />
                  <h3 className={`font-semibold ${textPrimary}`}>💳 Hutang</h3>
                </div>
                <Badge variant="warning">{debts.length} hutang</Badge>
              </div>
              <div className="space-y-3 max-h-[200px] overflow-y-auto">
                {debts.slice(0, 5).map((debt, idx) => (
                  <div key={debt.id || idx} className={`flex items-center justify-between p-2 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                    <div>
                      <p className={`font-medium text-sm ${textPrimary}`}>{debt.name || debt.description}</p>
                      <p className={`text-xs ${textSecondary}`}>{debt.due_date ? `Jatuh tempo: ${new Date(debt.due_date).toLocaleDateString()}` : ''}</p>
                    </div>
                    <p className="font-bold text-orange-500">{formatCurrency(debt.amount || 0)}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Recurring Transactions */}
          {recurringTransactions.length > 0 && (
            <Card className={`p-4 ${bgCard} border ${borderColor}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 text-blue-500" />
                  <h3 className={`font-semibold ${textPrimary}`}>🔄 Transaksi Berulang</h3>
                </div>
                <Badge variant="info">{recurringTransactions.length}</Badge>
              </div>
              <div className="space-y-3 max-h-[200px] overflow-y-auto">
                {recurringTransactions.slice(0, 5).map((rec, idx) => (
                  <div key={rec.id || idx} className={`flex items-center justify-between p-2 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                    <div>
                      <p className={`font-medium text-sm ${textPrimary}`}>{rec.name || rec.description}</p>
                      <p className={`text-xs ${textSecondary}`}>{rec.frequency || 'Monthly'}</p>
                    </div>
                    <p className={`font-bold ${rec.type === 'income' ? 'text-green-500' : 'text-red-500'}`}>
                      {rec.type === 'income' ? '+' : '-'}{formatCurrency(rec.amount || 0)}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ================================================================ */}
      {/* RECENT TRANSACTIONS & FEED REVIEW - DIPULIHKAN */}
      {/* ================================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Transactions */}
        <Card className={`p-4 ${bgCard} border ${borderColor}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`font-semibold ${textPrimary}`}>Transaksi Terbaru</h3>
            <Button variant="ghost" size="sm" onClick={() => window.location.href = '/transactions'}>
              Lihat Semua →
            </Button>
          </div>
          {transactions.length > 0 ? (
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {transactions.slice(0, 5).map((tx, idx) => (
                <div key={tx.id || idx} className={`flex items-center justify-between py-2 border-b ${borderColor} last:border-0`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tx.type === 'income' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                      {tx.type === 'income' 
                        ? <ArrowUpRight className="w-5 h-5 text-green-600" /> 
                        : <ArrowDownRight className="w-5 h-5 text-red-600" />
                      }
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
              <Button variant="outline" size="sm" className="mt-2" onClick={onAddTransaction}>
                Tambah Transaksi
              </Button>
            </div>
          )}
        </Card>

        {/* Feed Review */}
        <Card className={`p-4 ${bgCard} border ${borderColor}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`font-semibold ${textPrimary}`}>📝 Review Transaksi</h3>
            {feedStats?.pending > 0 && <Badge variant="warning">{feedStats.pending} tertunda</Badge>}
          </div>
          {feedStats?.pending > 0 ? (
            <div className="space-y-3">
              <div className={`p-3 rounded-lg ${isDark ? 'bg-yellow-900/20 border border-yellow-800' : 'bg-yellow-50 border border-yellow-200'}`}>
                <div className="flex items-center gap-3">
                  <Bell className="w-5 h-5 text-yellow-600" />
                  <div>
                    <p className={`font-medium ${isDark ? 'text-yellow-200' : 'text-yellow-800'}`}>{feedStats.pending} transaksi menunggu review</p>
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
            <div className={`mt-4 pt-4 border-t ${borderColor} grid grid-cols-3 gap-2 text-center`}>
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
          )}
        </Card>
      </div>

      {/* ================================================================ */}
      {/* GOALS - DIPULIHKAN */}
      {/* ================================================================ */}
      {goals.length > 0 && (
        <Card className={`p-4 ${bgCard} border ${borderColor}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-500" />
              <h3 className={`font-semibold ${textPrimary}`}>🎯 Target Keuangan</h3>
            </div>
            <Button variant="ghost" size="sm" onClick={() => window.location.href = '/goals'}>
              Lihat Semua →
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {goals.slice(0, 3).map((goal, idx) => {
              const progress = goal.target_amount > 0 ? ((goal.current_amount || 0) / goal.target_amount) * 100 : 0;
              return (
                <div key={goal.id || idx} className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className={`font-medium ${textPrimary}`}>{goal.name}</p>
                      <p className={`text-xs ${textSecondary}`}>{goal.category || 'Tabungan'}</p>
                    </div>
                    {goal.is_completed && <Badge variant="success">✓</Badge>}
                  </div>
                  <div className="mb-2">
                    <div className={`w-full rounded-full h-2 ${isDark ? 'bg-gray-600' : 'bg-gray-200'}`}>
                      <div 
                        className="h-2 rounded-full bg-blue-500 transition-all"
                        style={{ width: `${Math.min(100, progress)}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className={textSecondary}>{formatCurrency(goal.current_amount || 0)}</span>
                    <span className={`font-medium ${textPrimary}`}>{formatCurrency(goal.target_amount)}</span>
                  </div>
                  <p className={`text-xs text-center mt-1 ${textSecondary}`}>{progress.toFixed(0)}% tercapai</p>
                </div>
              );
            })}
          </div>
        </Card>
      )}
      
    </div>
  );
};

export default Dashboard;
