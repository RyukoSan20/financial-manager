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
import { formatCurrency, formatNumber, formatPercent, formatNative } from '../utils/format';
import { amountSign, isIncoming, isOutgoing } from '../utils/transactionSign';
import { cleanNumber } from '../utils/idFormat';
import AnimatedNumber from '../components/common/AnimatedNumber';
import { useCurrency } from '../utils/currency';
import api, { API_BASE_URL } from '../services/api';
import { apiUrl } from '../config/url';
import { useTranslation } from '../i18n';
import { categoryName, categoryKey, transactionCategoryName } from '../utils/categoryName';
import AIAssistant from '../components/common/AIAssistant';
import ReadinessChecklist from '../components/ReadinessChecklist';
import InsightsPanel from '../components/insights/InsightsPanel';
import MonthTimeline from '../components/dashboard/MonthTimeline';
import Onboarding from '../components/dashboard/Onboarding';
import { useTheme } from '../contexts/ThemeContext';
import { IconText } from '../components/ui/IconText';
import { buildFlag } from '../utils/featureFlags';
import { batch3 } from '../i18n/keys_batch3';

// ============================================================================
// ACHIEVEMENTS CONFIGURATION - DIPULIHKAN DAN DIENHANCE
// ============================================================================
const ACHIEVEMENTS = [
  { id: 'budget_master', nameKey: 'dashboard.achievement_budget_master_name', icon: Shield, color: '#22c55e', descriptionKey: 'dashboard.achievement_budget_master_description', requirementKey: 'dashboard.achievement_budget_master_requirement' },
  { id: 'savings_streak', nameKey: 'dashboard.achievement_savings_streak_name', icon: Trophy, color: '#f59e0b', descriptionKey: 'dashboard.achievement_savings_streak_description', requirementKey: 'dashboard.achievement_savings_streak_requirement' },
  { id: 'first_goal', nameKey: 'dashboard.achievement_first_goal_name', icon: Target, color: '#3b82f6', descriptionKey: 'dashboard.achievement_first_goal_description', requirementKey: 'dashboard.achievement_first_goal_requirement' },
  { id: 'surplus', nameKey: 'dashboard.achievement_surplus_name', icon: Zap, color: '#8b5cf6', descriptionKey: 'dashboard.achievement_surplus_description', requirementKey: 'dashboard.achievement_surplus_requirement' },
  { id: 'early_bird', nameKey: 'dashboard.achievement_early_bird_name', icon: Clock, color: '#06b6d4', descriptionKey: 'dashboard.achievement_early_bird_description', requirementKey: 'dashboard.achievement_early_bird_requirement' },
  { id: 'diverse_saver', nameKey: 'dashboard.achievement_diverse_saver_name', icon: PieChartIcon, color: '#ec4899', descriptionKey: 'dashboard.achievement_diverse_saver_description', requirementKey: 'dashboard.achievement_diverse_saver_requirement' },
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
  { key: '1D', label: '1D', descriptionKey: 'dashboard.range_1d', granularity: 'hourly', dataPoints: 24, range: 1 },
  { key: '1W', label: '1W', descriptionKey: 'dashboard.range_1w', granularity: 'daily', dataPoints: 7, range: 7 },
  { key: '1M', label: '1M', descriptionKey: 'dashboard.one_month', granularity: 'daily', dataPoints: 30, range: 30 },
  { key: '3M', label: '3M', descriptionKey: 'dashboard.three_months', granularity: 'weekly', dataPoints: 13, range: 90 },
  { key: 'YTD', label: 'YTD', descriptionKey: 'dashboard.range_ytd', granularity: 'monthly', dataPoints: 12, range: 365 },
  { key: '1Y', label: '1Y', descriptionKey: 'dashboard.range_1y', granularity: 'monthly', dataPoints: 12, range: 365 },
  { key: '3Y', label: '3Y', descriptionKey: 'dashboard.range_3y', granularity: 'monthly', dataPoints: 36, range: 1095 },
  { key: '5Y', label: '5Y', descriptionKey: 'dashboard.range_5y', granularity: 'monthly', dataPoints: 60, range: 1825 },
];

// ============================================================================
// CHART COLORS CONFIGURATION
// ============================================================================
const CHART_COLORS = {
  income: '#22c55e',
  expense: '#ef4444',
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

/**
 * The savings series is a brand colour rather than a meaning, so it
 * takes the accent of the scheme the user picked. It is read from the
 * document because the scheme is applied to the page, not imported.
 */
function savingsColor() {
  const v = document.documentElement.style.getPropertyValue('--scheme-500').trim();
  return v || '#3b82f6';
}

// ============================================================================
// CATEGORY COLORS
// ============================================================================
// The key of each entry is the system_key the database carries for a
// built-in category. They have to match exactly, or the colour falls
// back to grey and every category looks the same.
const CATEGORY_COLORS = {
  // Income
  salary: '#22c55e',
  freelance: '#10b981',
  investment_income: '#06b6d4',
  bonus: '#8b5cf6',
  other_income: '#6b7280',
  // Expense
  food_drink: '#ef4444',
  transportation: '#f97316',
  shopping: '#eab308',
  health: '#22c55e',
  education: '#3b82f6',
  entertainment: '#ec4899',
  bills_utilities: '#8b5cf6',
  savings_investment: '#14b8a6',
  other_expense: '#6b7280',
  // The older names, kept so a category that was saved before the key
  // was introduced keeps its colour.
  food: '#ef4444',
  transport: '#f97316',
  bills: '#8b5cf6',
  investment: '#14b8a6',
};

// ============================================================================
// UTILITY COMPONENTS
// ============================================================================

// Dark Mode Toggle Slider
const DarkModeToggle = ({ isDark, onToggle }) => {
  const { language } = useTranslation();
  const K = batch3[language]?.dashboard;
  const { t } = useTranslation();
  return (
  <button
    onClick={onToggle}
    className={`relative w-14 h-7 rounded-full transition-colors duration-300 ${
      isDark ? 'bg-gray-700' : 'bg-gray-300'
    }`}
    aria-label={t('dashboard.toggle_dark_mode')}
  >
    <span className={`absolute top-0.5 w-6 h-6 rounded-full shadow-md flex items-center justify-center transition-all duration-300 ${
      isDark ? 'left-7 bg-yellow-400' : 'left-0.5 bg-white'
    }`}>
      {isDark ? <Moon className="w-3.5 h-3.5 text-gray-800" /> : <Sun className="w-3.5 h-3.5 text-yellow-500" />}
    </span>
  </button>
);
};

// Mode Toggle (Basic/Advanced)
const ModeToggle = ({ mode, onToggle, isDark }) => {
  const { language } = useTranslation();
  const K = batch3[language]?.dashboard;
  return (
  <div className={`flex rounded-lg p-1 ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
    <button
      onClick={() => onToggle('basic')}
      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
        mode === 'basic' ? 'bg-primary-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600'
      }`}
    >
      <TrendingUp className="w-3.5 h-3.5" />
      {K.basic}
    </button>
    <button
      onClick={() => onToggle('advanced')}
      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
        mode === 'advanced' ? 'bg-purple-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600'
      }`}
    >
      <LineChart className="w-3.5 h-3.5" />
      {K.advanced}
    </button>
  </div>
  );
};

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
  const { t } = useTranslation();
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
      title={`${achievement.name}: ${t(achievement.descriptionKey)}\n${t('dashboard.achievement_requirement')}: ${t(achievement.requirementKey)}`}
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
  const { t, language } = useTranslation();
  // With the polish switch off, the page keeps the drawings it has.
  const polished = buildFlag('UI_POLISH');
  const entries = Object.entries(categories || {});
  const total = entries.reduce((sum, [, data]) => sum + (data.total || 0), 0);
  const sortedCategories = entries.sort((a, b) => b[1].total - a[1].total).slice(0, maxItems);
  
  return (
    <div className="space-y-2">
      <h4 className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
        <IconText name={type === 'income' ? 'income' : 'expense'} emoji={type === 'income' ? '💰' : '💸'} on={polished}>
          {type === 'income' ? t('dashboard.income_detail') : t('dashboard.expense_detail')}
        </IconText>
      </h4>
      {sortedCategories.length > 0 ? (
        <>
          {sortedCategories.map(([key, data]) => {
            const percentage = total > 0 ? ((data.total || 0) / total * 100) : 0;
            // The key of the group is the name the category is stored
            // under, which is Indonesian. It is translated here, so a
            // Japanese reader sees the Japanese word.
            const label = categoryName(key, language);
            // The colour is looked up by the category key, so the same
            // category keeps the same colour in every language.
            const colorKey = categoryKey(key) || key;
            return (
              <div key={key} className="flex items-center gap-2">
                <div 
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0" 
                  style={{ backgroundColor: CATEGORY_COLORS[colorKey] || '#6b7280' }} 
                />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className={`capitalize truncate ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      {label}
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
                        backgroundColor: CATEGORY_COLORS[colorKey] || '#6b7280' 
                      }} 
                    />
                  </div>
                </div>
              </div>
            );
          })}
          {entries.length > maxItems && (
            <p className={`text-xs text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              +{entries.length - maxItems} {t('dashboard.other_categories')}
            </p>
          )}
        </>
      ) : (
        <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{t('common.noData')}</p>
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
  const { currency: displayCurrency } = useCurrency();
  const { t, language, currency, currencyConfig } = useTranslation();
  // With the polish switch off, the page keeps the drawings it has.
  const polished = buildFlag('UI_POLISH');
  
  // ==========================================================================
  // STATE MANAGEMENT - SEMUA STATE DIPULIHKAN
  // ==========================================================================
  
  // Dark mode comes from the global ThemeContext so the page always matches
  // the toggle in the navigation and the user's saved preference.
  const { isDarkMode, toggleTheme } = useTheme();
  
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
  
  // Re-init the chart when the theme changes so the chart colors follow it.
  useEffect(() => {
    if (cashFlowSeries.length > 0) {
      initChart();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  
  // Fetch market data from the unified market API.
  // Previously this called /realtime/summary, which is backed by Yahoo Finance.
  // Yahoo returns HTTP 429 for datacenter IPs, so that endpoint served empty
  // quote lists (and fell through to the SPA fallback returning HTML).
  // The unified endpoint uses TradingView, which is reachable and live.
  const fetchMarketData = useCallback(async () => {
    try {
      const response = await fetch(apiUrl('market/summary'), {
        headers: { 'Accept': 'application/json' },
        cache: 'no-store',
      });
      const contentType = response.headers.get('content-type') || '';
      if (!response.ok) {
        throw new Error(`Market API ${response.status}`);
      }
      if (!contentType.includes('application/json')) {
        throw new Error(`Market API returned ${contentType || 'unknown content type'}`);
      }
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
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({ timeframe });
      if (selectedAccount !== 'all') {
        params.append('account_id', selectedAccount);
      }
      
      const response = await fetch(`${API_BASE_URL}/dashboard/cash-flow?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) {
        console.error('Cash flow API error:', response.status);
        setCashFlowSeries([]);
        return;
      }
      
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
        api.dashboard.summary(null, null, displayCurrency),
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

  // The totals the server sends are in the currency that is on display.
  // When that choice changes the summary has to be asked for again.
  useEffect(() => {
    if (!displayCurrency) return;
    api.dashboard.summary(null, null, displayCurrency)
      .then((value) => setSummary(value))
      .catch(() => {});
  }, [displayCurrency]);

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
      // The axis formatter. It uses the currency the chart is drawn
      // in, not a fixed one: the same chart shows yen for a reader
      // who reads in yen.
      const axisCurrency = displayCurrency || 'IDR';
      const axisSymbol = { IDR: 'Rp', JPY: '¥', USD: '$', EUR: '€', GBP: '£' }[axisCurrency] || axisCurrency;
      const axisFormatter = (price) => {
        // A chart axis is a whole rupiah, and a difference of two
        // almost equal amounts comes out of the database with a long
        // tail. Cleaning it first means the axis never says
        // "Rp -0.0000014397338687".
        const value = cleanNumber(price);
        if (value >= 1000000000) return `${axisSymbol} ${(value / 1000000000).toFixed(1)}B`;
        if (value >= 1000000) return `${axisSymbol} ${(value / 1000000).toFixed(1)}M`;
        if (value >= 1000) return `${axisSymbol} ${(value / 1000).toFixed(0)}K`;
        return `${axisSymbol} ${value}`;
      };
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
        rightPriceScale: { 
          borderColor: gridColor,
          scaleMargins: { top: 0.1, bottom: 0.2 },
          mode: 1,
        },
        localization: {
          priceFormatter: axisFormatter,
        },
        handleScroll: { mouseWheel: true, pressedMouseMove: true },
        handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
        timeScale: { 
          borderColor: gridColor, 
          timeVisible: true,
          tickMarkFormatter: (time) => {
            // Find matching data point by time
            const idx = data.findIndex(d => d.time === time);
            if (idx >= 0) return data[idx]._labelX || '';
            // Try matching by _idx
            const idx2 = cashFlowSeries.findIndex(s => s._idx === time);
            if (idx2 >= 0) return cashFlowSeries[idx2].labelX || '';
            return '';
          }
        },
      });

      // Prepare data - convert dates to Unix timestamps for TradingView
      const data = cashFlowSeries.map((item, i) => {
        // Parse date string to Unix timestamp
        let timeVal;
        if (item.timestamp) {
          // Convert "2026-09-17" to Unix timestamp
          const date = new Date(item.timestamp);
          timeVal = Math.floor(date.getTime() / 1000);
        } else {
          timeVal = i + 1;
        }
        return {
          time: timeVal,
          _idx: i + 1,
          _labelX: item.labelX || item.labelXShort || '',
          income: cleanNumber(item.totalIncome || item.income || 0),
          expense: cleanNumber(item.totalExpense || item.expense || 0),
          // The saving for the month. It is cleaned here as well, so
          // the line does not dip below zero by a fraction of a
          // rupiah.
          savings: cleanNumber(item.netSavings || item.net || (item.totalIncome - item.totalExpense) || 0),
        };
      });

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
          title: t('dashboard.expense'),
          crosshairMarkerVisible: true,
        });

        // Savings area for advanced
        const savingsAreaSeries = chart.addSeries(AreaSeries, {
          color: savingsColor() + '40',
          lineColor: savingsColor(),
          lineWidth: 2,
          topColor: savingsColor() + '40',
          bottomColor: savingsColor() + '05',
          title: t('dashboard.savings'),
          crosshairMarkerVisible: true,
        });

        incomeSeries.setData(data.map(d => ({ time: d.time, value: d.income })));
        expenseSeries.setData(data.map(d => ({ time: d.time, value: d.expense })));
        savingsAreaSeries.setData(data.map(d => ({ time: d.time, value: d.savings })));
      } else {
        // BASIC: Net savings only with area
        const savingsSeries = chart.addSeries(AreaSeries, {
          color: savingsColor() + '60',
          lineColor: savingsColor(),
          lineWidth: 2,
          topColor: savingsColor() + '60',
          bottomColor: savingsColor() + '10',
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
  }, [cashFlowSeries, isDarkMode, displayMode, displayCurrency, t]);

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
      const income = summaryData.totalIncome || summaryData.total_income || 0;
      const expense = summaryData.totalExpense || summaryData.total_expense || 0;
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
      : (summary.total_spent || 0);
    const totalSpent = budgets.length > 0
      ? budgets.reduce((sum, b) => sum + (b.spent || 0), 0)
      : (summary.totalExpense || summary.total_spent || 0);
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
    const income = summary.totalIncome || summary.total_income || 0;
    const expense = summary.totalExpense || summary.total_expense || 0;
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
      safe: '💚 ' + t('dashboard.status_safe'), 
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
            {new Date().toLocaleDateString(
              language === 'ja' ? 'ja-JP' : language === 'en' ? 'en-US' : 'id-ID',
              { month: 'long', year: 'numeric' }
            )}
          </p>
        </div>
        
        <div className="flex gap-3 items-center flex-wrap">
          {/* Dark Mode Toggle */}
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${bgCard} border ${borderColor}`}>
            <Sun className={`w-4 h-4 ${textSecondary}`} />
            <DarkModeToggle isDark={isDarkMode} onToggle={toggleTheme} />
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
                title={t(tf.descriptionKey)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                  timeframe === tf.key 
                    ? 'bg-primary-600 text-white shadow-md' 
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

      {/* The setup checklist. A new reader with an empty account sees
          this instead of a wall of empty charts. It says what to do
          next and the button goes straight there. */}
      <Onboarding />
      <ReadinessChecklist />

      {/* What the records already say: a bill paid twice, a
          subscription never set up, the balance for the month ahead.
          The panel draws nothing at all when the switch is off. */}
      <InsightsPanel />

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
                {spendingRatio.status === 'danger' ? '⚠️ ' + t('dashboard.budget_exceeded') :
                 spendingRatio.status === 'warning' ? t('dashboard.spending_near_limit') : t('dashboard.spending_within_limit')}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold">{formatPercent(spendingRatio.percent, 0)}</p>
            <p className="text-sm opacity-80">{t('dashboard.spent_ratio')}</p>
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
      {/* The number of columns follows the width that is actually
          available, not the width of the window.

          A window breakpoint gets this wrong: on a 900px window with
          the sidebar open there is only about 830px of content, so
          four columns leave each card narrower than the amount of text
          on it. `auto-fit` fits as many cards as there is room for, each
          at least 240px wide, so the cards stay readable and the
          fourth one wraps to the next row when there is no room. */}
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        {[
          {
            label: t('dashboard.total_balance'),
            // The server already converted this into the currency it
            // names, so it is shown as it is.
            value: summary?.total_balance,
            // The server sends this already in the currency it names,
            // so it is shown as it is rather than converted again.
            currency: summary?.total_balance_currency || summary?.currency,
            alreadyConverted: true,
            icon: Wallet,
            gradient: 'from-green-50 to-green-100 dark:from-green-900/50 dark:to-green-800/40',
            // The classes are written out in full. A class built at
            // runtime, like `text-${color}-600`, is never seen by
            // Tailwind when it scans the source, so it never reaches
            // the stylesheet. In the dark mode the missing rule left
            // the amount in the light colour on a dark background.
            labelClass: 'text-green-700 dark:text-green-300',
            valueClass: 'text-green-800 dark:text-green-100',
            iconBg: 'bg-green-200 dark:bg-green-900',
            iconClass: 'text-green-700 dark:text-green-300',
          },
          {
            label: t('dashboard.total_income'),
            value: summary?.totalIncome || summary?.total_income,
            icon: TrendingUp,
            gradient: 'from-primary-50 to-primary-100 dark:from-primary-900/50 dark:to-primary-800/40',
            labelClass: 'text-primary-700 dark:text-primary-300',
            valueClass: 'text-primary-800 dark:text-primary-100',
            iconBg: 'bg-primary-200 dark:bg-primary-900',
            iconClass: 'text-primary-700 dark:text-primary-300',
          },
          {
            label: t('dashboard.total_expense'),
            value: summary?.totalExpense || summary?.total_expense,
            icon: TrendingDown,
            gradient: 'from-red-50 to-red-100 dark:from-red-900/50 dark:to-red-800/40',
            labelClass: 'text-red-700 dark:text-red-300',
            valueClass: 'text-red-800 dark:text-red-100',
            iconBg: 'bg-red-200 dark:bg-red-900',
            iconClass: 'text-red-700 dark:text-red-300',
          },
          {
            label: t('dashboard.cash_flow'),
            value: summary?.netSavings || summary?.net_cash_flow,
            icon: Activity,
            gradient: 'from-purple-50 to-purple-100 dark:from-purple-900/50 dark:to-purple-800/40',
            labelClass: 'text-purple-700 dark:text-purple-300',
            valueClass: 'text-purple-800 dark:text-purple-100',
            iconBg: 'bg-purple-200 dark:bg-purple-900',
            iconClass: 'text-purple-700 dark:text-purple-300',
          },
        ].map((card, i) => {
          const Icon = card.icon;
          return (
            // The wrapper is what the container query measures. The
            // card cannot be the container itself: a card that is a
            // container cannot paint its own background image, so the
            // gradient would disappear.
            <div key={i} className="summary-amount-measure">
            <Card
              className={`summary-amount p-4 bg-gradient-to-br ${card.gradient} border ${borderColor}`}
            >
              <div className="flex items-start justify-between gap-2 sm:gap-3">
                <div className="min-w-0 flex-1">
                  {/* The label is small and quiet so the amount is the
                      first thing read. */}
                  <p
                    className={`text-xs font-semibold uppercase tracking-wider leading-none truncate ${card.labelClass}`}
                  >
                    {card.label}
                  </p>
                  {/* The amount is never cut off.

                      An amount that shows "Rp 14.610..." is worse than
                      no amount at all, so the size of the text follows
                      how much there is to show. The container query
                      below measures the card itself, not the window,
                      because the card is what the text has to fit in -
                      and a card is narrower on a wide screen with a
                      sidebar than on a narrow one without.

                      The amount still uses tabular figures, so the digits
                      do not move when the value changes. */}
                  <p
                    className={`mt-2 font-numeric font-bold leading-none text-summary-value ${card.valueClass}`}
                  >
                    {/* The amount counts to its new value when the
                        reader changes the date filter or picks another
                        account. Without the count, the old number is
                        gone and the new one is there in the same
                        frame, so the reader sees that the balance
                        changed but not how much. */}
                    {card.alreadyConverted ? (
                      <AnimatedNumber
                        value={card.value || 0}
                        format={(n) => formatNative(n, card.currency)}
                      />
                    ) : (
                      <AnimatedNumber
                        value={card.value || 0}
                        format={(n) => formatCurrency(n)}
                      />
                    )}
                  </p>
                </div>
                <div
                  className={`summary-icon w-8 h-8 sm:w-9 sm:h-9 lg:w-11 lg:h-11 rounded-full flex items-center justify-center shrink-0 ${card.iconBg}`}
                >
                  <Icon className={`w-4 h-4 sm:w-4 sm:h-4 lg:w-5 lg:h-5 ${card.iconClass}`} />
                </div>
              </div>
            </Card>
            </div>
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
                <h3 className={`font-semibold ${textPrimary}`}>{t('dashboard.budget_this_month')}</h3>
              </div>
              <Badge variant={safeToSpend.status === 'safe' ? 'success' : safeToSpend.status === 'warning' ? 'warning' : 'danger'}>
                {safeToSpend.percent.toFixed(0)}% sisa
              </Badge>
            </div>
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span className={textSecondary}>{t('dashboard.used')}</span>
                <span className={`font-medium ${textPrimary}`}>{formatCurrency(summary?.total_spent || 0)}</span>
              </div>
              <SpendingProgressBar 
                current={summary?.total_spent || 0} 
                total={summary?.total_budget || 0} 
                status={safeToSpend.status}
                isDark={isDark}
              />
              <div className="flex justify-between text-sm mt-1">
                <span className={textSecondary}>{t('dashboard.manage_budget')}</span>
                <span className={`font-medium ${textPrimary}`}>{formatCurrency(summary?.total_budget || 0)}</span>
              </div>
            </div>
            <div className="text-center">
              <p className={`text-3xl font-bold ${textPrimary}`}>{formatCurrency(safeToSpend.amount)}</p>
              <p className={`text-sm ${textSecondary}`}>{t('dashboard.budget_remaining')}</p>
            </div>
          </Card>

          {/* Safe-to-Spend */}
          <Card className={`p-4 ${bgCard} border ${borderColor}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-green-500" />
                <h3 className={`font-semibold ${textPrimary}`}>{t('dashboard.safe_to_spend')}</h3>
              </div>
            </div>
            <div className="text-center mb-4">
              <p className={`text-4xl font-bold ${textPrimary}`}>
                <AnimatedNumber value={safeToSpend.amount} format={(n) => formatCurrency(n)} />
              </p>
              <p className={`text-sm ${textSecondary}`}>{t('dashboard.safe_to_spend_caption')}</p>
            </div>
            <div className={`grid grid-cols-3 gap-2 text-center text-xs ${textSecondary}`}>
              <div>
                <p className="font-bold text-lg text-green-500">{formatCurrency((safeToSpend.amount / 30) || 0)}</p>
                <p>{t('dashboard.per_day')}</p>
              </div>
              <div>
                <p className="font-bold text-lg text-primary-500">{formatCurrency((safeToSpend.amount / 4) || 0)}</p>
                <p>{t('dashboard.per_week')}</p>
              </div>
              <div>
                <p className="font-bold text-lg text-purple-500">{formatCurrency(safeToSpend.amount)}</p>
                <p>{t('common.total')}</p>
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
            <TrendingUp className={`w-5 h-5 ${isDark ? 'text-primary-400' : 'text-primary-600'}`} />
            <h3 className={`font-semibold ${textPrimary}`}>{t('dashboard.cash_flow_trend')}</h3>
            <Badge variant="outline">{(() => { const tf = TIMEFRAMES.find(x => x.key === timeframe); return tf ? t(tf.descriptionKey) : t('dashboard.three_months'); })()}</Badge>
            {displayMode === 'advanced' && (
              <Badge variant="secondary">{t('dashboard.advanced')}</Badge>
            )}
          </div>
          
          <div className="flex gap-4 text-sm items-center">
            {/* Legend */}
            <div className="flex gap-4">
              {displayMode === 'advanced' && (
                <>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span className={textSecondary}>{t('dashboard.income')}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <span className={textSecondary}>{t('dashboard.expense')}</span>
                  </div>
                </>
              )}
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-primary-400" />
                <span className={textSecondary}>{t('dashboard.savings')}</span>
              </div>
            </div>
            
            {/* Chart Type Toggle */}
            <div className={`flex rounded p-0.5 ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
              {['line', 'area'].map(type => (
                <button
                  key={type}
                  onClick={() => setChartType(type)}
                  className={`px-2 py-1 text-xs rounded capitalize ${
                    chartType === type ? 'bg-primary-600 text-white' : `${textSecondary} hover:bg-gray-200 dark:hover:bg-gray-600`
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
          <label className={`text-sm ${textSecondary}`}>{t('dashboard.account')}:</label>
          <select
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(e.target.value)}
            className={`px-3 py-1.5 text-sm rounded-lg border ${borderColor} ${bgCard} ${textPrimary}`}
          >
            <option value="all">{t('dashboard.all_accounts')}</option>
            {accounts.map(acc => (
              <option key={acc.id} value={acc.id}>{acc.name} ({formatNative(acc.balance || 0, acc.currency)})</option>
            ))}
          </select>
          
          <label className={`text-sm ${textSecondary}`}>{t('dashboard.period')}:</label>
          <span className={`text-sm font-medium ${textPrimary}`}>
            {cashFlowMeta?.startDate || '-'} s/d {cashFlowMeta?.endDate || '-'}
          </span>
        </div>
        
        {/* Chart */}
        {chartLoading ? (
          <div className={`h-[350px] flex items-center justify-center ${textSecondary}`}>
            <Spinner size="lg" />
            <span className="ml-2">{t('dashboard.loading_chart')}</span>
          </div>
        ) : cashFlowSeries.length > 0 ? (
          <div ref={cashFlowChartRef} className="w-full" style={{ height: displayMode === 'advanced' ? 450 : 350 }} />
        ) : (
          <div className={`h-[350px] flex flex-col items-center justify-center ${textSecondary}`}>
            <BarChart3 className="w-12 h-12 mb-2 opacity-50" />
            <p>{t('dashboard.no_data_this_period')}</p>
            <p className="text-xs mt-1">{t('dashboard.no_data_this_period_hint')}</p>
          </div>
        )}
        
        {/* Meta Info - Advanced */}
        {displayMode === 'advanced' && cashFlowMeta?.totalDataPoints > 0 && (
          <div className={`mt-4 pt-4 border-t ${borderColor} grid grid-cols-4 md:grid-cols-6 gap-4 text-sm text-center`}>
            <div>
              <p className={textSecondary}>{t('dashboard.period')}</p>
              <p className={`font-semibold ${textPrimary}`}>{cashFlowMeta.periodDays || 0} hari</p>
            </div>
            <div>
              <p className={textSecondary}>{t('dashboard.granularity')}</p>
              <p className={`font-semibold capitalize ${textPrimary}`}>{cashFlowMeta.granularity}</p>
            </div>
            <div>
              <p className={textSecondary}>{t('dashboard.data_points')}</p>
              <p className={`font-semibold ${textPrimary}`}>{cashFlowMeta.totalDataPoints}</p>
            </div>
            <div>
              <p className={textSecondary}>{t('dashboard.avg_daily')}</p>
              <p className={`font-semibold ${textPrimary}`}>{formatCurrency(cashFlowMeta.averageDailyExpense || 0)}</p>
            </div>
            <div>
              <p className={textSecondary}>{t('dashboard.income')}</p>
              <p className="font-semibold text-green-500">{formatCurrency(cashFlowMeta.totalIncome || 0)}</p>
            </div>
            <div>
              <p className={textSecondary}>{t('dashboard.expense')}</p>
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
            <h3 className={`font-semibold mb-4 ${textPrimary}`}><IconText name="chart" emoji="📊" on={polished}>{t('dashboard.category_detail')}</IconText></h3>
            <div className="grid grid-cols-2 gap-4">
              <CategoryBreakdown categories={categorySummary.income} type="income" isDark={isDark} maxItems={5} />
              <CategoryBreakdown categories={categorySummary.expense} type="expense" isDark={isDark} maxItems={5} />
            </div>
          </Card>

          {/* Market Overview */}
          <Card className={`p-4 ${bgCard} border ${borderColor}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`font-semibold ${textPrimary}`}><IconText name="chart_line" emoji="📈" on={polished}>{t('dashboard.market_overview')}</IconText></h3>
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
            <h3 className={`font-semibold ${textPrimary}`}><IconText name="trophy" emoji="🏆" on={polished}>{t('dashboard.achievements')}</IconText></h3>
            <Badge variant="secondary">{achievements.length}/{ACHIEVEMENTS.length}</Badge>
          </div>
          <p className={`text-xs ${textSecondary}`}>{achievements.length} / {ACHIEVEMENTS.length} {t('dashboard.achievements_reached')}</p>
        </div>
        
        {/* Achievement Progress Bar */}
        <div className={`w-full rounded-full h-2 mb-4 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
          <div 
            className="h-2 rounded-full bg-gradient-to-r from-purple-500 to-primary-500 transition-all"
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
                  <h3 className={`font-semibold ${textPrimary}`}><IconText name="payment" emoji="💳" on={polished}>{t('dashboard.debts')}</IconText></h3>
                </div>
                <Badge variant="warning">{debts.length} hutang</Badge>
              </div>
              <div className="space-y-3 max-h-[200px] overflow-y-auto">
                {debts.slice(0, 5).map((debt, idx) => (
                  <div key={debt.id || idx} className={`flex items-center justify-between p-2 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                    <div>
                      <p className={`font-medium text-sm ${textPrimary}`}>{debt.name || debt.description}</p>
                      <p className={`text-xs ${textSecondary}`}>{debt.due_date ? `${t('dashboard.due_date')}: ${new Date(debt.due_date).toLocaleDateString(
                          language === 'ja' ? 'ja-JP' : language === 'en' ? 'en-US' : 'id-ID'
                        )}` : ''}</p>
                    </div>
                    <p className="font-bold text-orange-500">{formatCurrency(debt.amount || 0, debt.currency)}</p>
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
                  <RefreshCw className="w-5 h-5 text-primary-500" />
                  <h3 className={`font-semibold ${textPrimary}`}><IconText name="repeat" emoji="🔄" on={polished}>{t('dashboard.recurring')}</IconText></h3>
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
                    <p className={`font-bold ${isIncoming(rec.type) ? 'text-green-500' : 'text-red-500'}`}>
                      {amountSign(rec.type)}{formatCurrency(rec.amount || 0, rec.currency)}
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
        {/* The month, day by day */}
        <MonthTimeline />

        {/* Recent Transactions */}
        <Card className={`p-4 ${bgCard} border ${borderColor}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`font-semibold ${textPrimary}`}>{t('dashboard.recent_transactions')}</h3>
            <Button variant="ghost" size="sm" onClick={() => window.location.href = '/transactions'}>
              {t('dashboard.view_all')} →
            </Button>
          </div>
          {transactions.length > 0 ? (
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {transactions.slice(0, 5).map((tx, idx) => (
                <div key={tx.id || idx} className={`flex items-center justify-between py-2 border-b ${borderColor} last:border-0`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isIncoming(tx.type) ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                      {isIncoming(tx.type)
                        ? <ArrowUpRight className="w-5 h-5 text-green-600" />
                        : <ArrowDownRight className="w-5 h-5 text-red-600" />
                      }
                    </div>
                    <div>
                      <p className={`font-medium ${textPrimary}`}>{tx.description || t('dashboard.transaction')}</p>
                      <p className={`text-sm ${textSecondary}`}>{transactionCategoryName(tx, language) || t('common.other')}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${isIncoming(tx.type) ? 'text-green-600' : 'text-red-600'}`}>
                      {amountSign(tx.type)}{formatCurrency(tx.amount || 0, tx.currency)}
                    </p>
                    <p className={`text-xs ${textSecondary}`}>{tx.date ? new Date(tx.date).toLocaleDateString(
                          language === 'ja' ? 'ja-JP' : language === 'en' ? 'en-US' : 'id-ID'
                        ) : ''}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={`text-center py-8 ${textSecondary}`}>
              <Wallet className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>{t('dashboard.no_transactions')}</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={onAddTransaction}>
                {t('dashboard.add_transaction')}
              </Button>
            </div>
          )}
        </Card>

        {/* Feed Review */}
        <Card className={`p-4 ${bgCard} border ${borderColor}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`font-semibold ${textPrimary}`}><IconText name="file" emoji="📝" on={polished}>{t('dashboard.feed_review')}</IconText></h3>
            {feedStats?.pending_count > 0 && (
              <Badge variant="warning">{feedStats.pending_count} {t('feed.pending')}</Badge>
            )}
          </div>
          {feedStats?.pending_count > 0 ? (
            <div className="space-y-3">
              <div className={`p-3 rounded-lg ${isDark ? 'bg-yellow-900/20 border border-yellow-800' : 'bg-yellow-50 border border-yellow-200'}`}>
                <div className="flex items-center gap-3">
                  <Bell className="w-5 h-5 text-yellow-600" />
                  <div>
                    <p className={`font-medium ${isDark ? 'text-yellow-200' : 'text-yellow-800'}`}>{feedStats.pending_count} {t('dashboard.pending_review_count')}</p>
                  </div>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => window.location.href = '/feed'} className="w-full">
                {t('dashboard.review_now')}
              </Button>
            </div>
          ) : (
            <div className={`text-center py-8 ${textSecondary}`}>
              <CheckCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>{t('dashboard.no_pending')}</p>
            </div>
          )}
          {feedStats && (
            <div className={`mt-4 pt-4 border-t ${borderColor} grid grid-cols-3 gap-2 text-center`}>
              <div>
                <p className="text-2xl font-bold text-green-600">{feedStats.approved_today || 0}</p>
                <p className={`text-xs ${textSecondary}`}>{t('dashboard.approved')}</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">{feedStats.rejected_today || 0}</p>
                <p className={`text-xs ${textSecondary}`}>{t('dashboard.rejected')}</p>
              </div>
              <div>
                <p className={`text-2xl font-bold ${textPrimary}`}>{feedStats.pending_count || 0}</p>
                <p className={`text-xs ${textSecondary}`}>{t('dashboard.pending')}</p>
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
              <Target className="w-5 h-5 text-primary-500" />
              <h3 className={`font-semibold ${textPrimary}`}><IconText name="goal" emoji="🎯" on={polished}>{t('dashboard.financial_goals')}</IconText></h3>
            </div>
            <Button variant="ghost" size="sm" onClick={() => window.location.href = '/goals'}>
              {t('dashboard.view_all')} →
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
                      <p className={`text-xs ${textSecondary}`}>{categoryName(goal.category, language) || t('dashboard.savings')}</p>
                    </div>
                    {goal.is_completed && <Badge variant="success">✓</Badge>}
                  </div>
                  <div className="mb-2">
                    <div className={`w-full rounded-full h-2 ${isDark ? 'bg-gray-600' : 'bg-gray-200'}`}>
                      <div 
                        className="h-2 rounded-full bg-primary-500 transition-all"
                        style={{ width: `${Math.min(100, progress)}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className={textSecondary}>{formatCurrency(goal.current_amount || 0, goal.currency)}</span>
                    <span className={`font-medium ${textPrimary}`}>{formatCurrency(goal.target_amount, goal.currency)}</span>
                  </div>
                  <p className={`text-xs text-center mt-1 ${textSecondary}`}>{progress.toFixed(0)}% tercapai</p>
                </div>
              );
            })}
          </div>
        </Card>
      )}
      
      {/* AI Assistant */}
      <AIAssistant userData={{
        totalBalance: summary?.total_balance || 0,
        totalIncome: summary?.total_income || 0,
        totalExpense: summary?.total_expense || 0,
      }} />
      
    </div>
  );
};

export default Dashboard;
