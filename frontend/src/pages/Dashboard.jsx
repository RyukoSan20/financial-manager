import { useState, useEffect, useRef, useCallback } from 'react';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Badge, Spinner, EmptyState } from '../components/ui';
import AnimatedProgressBar from '../components/ui/AnimatedProgressBar';
import CountUpNumber from '../components/ui/CountUpNumber';
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
import { auroraIsOn } from '../components/ui/AuroraCard';
import { useCurrency } from '../utils/currency';
import api, { API_BASE_URL } from '../services/api';
import { apiUrl } from '../config/url';
import { useTranslation } from '../i18n';
import { useOnDataMutated } from '../utils/dataSyncBus';
import { categoryName, categoryKey, transactionCategoryName } from '../utils/categoryName';
import TopAiCommandBar from '../components/ai/TopAiCommandBar';
import ReadinessChecklist from '../components/ReadinessChecklist';
import InsightsPanel from '../components/insights/InsightsPanel';
import MonthTimeline from '../components/dashboard/MonthTimeline';
import SpendingHeatmapCalendar from '../components/analytics/SpendingHeatmapCalendar';
import FinancialProfileShowcase from '../components/dashboard/FinancialProfileShowcase';
import { ForestTicketCard } from '../components/ui/Botanical';
import Onboarding from '../components/dashboard/Onboarding';
import { useTheme } from '../contexts/ThemeContext';
import { IconText } from '../components/ui/IconText';
import { goalIcon } from '../utils/goalIcon';
import { buildFlag } from '../utils/featureFlags';
import { ReadyToBeAssignedBanner, DataAccuracyIndicator } from '../components/fintech/ReadyToBeAssignedBanner';
import { SafeToSpendWidget } from '../components/fintech/SafeToSpendWidget';
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
    <span className={`absolute top-0.5 w-6 h-6 rounded-full shadow-md flex items-center justify-center transition-transform duration-300 ${
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
      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
        mode === 'basic' ? 'bg-primary-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600'
      }`}
    >
      <TrendingUp className="w-3.5 h-3.5" />
      {K.basic}
    </button>
    <button
      onClick={() => onToggle('advanced')}
      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
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
  <div className={`p-3 rounded-lg border transition-[border-color,background-color,box-shadow] hover:shadow-md ${
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
      className={`relative flex flex-col items-center p-3 rounded-xl transition-[background-color,border-color,box-shadow] ${
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
                      className="h-1.5 rounded-full transition-[width]" 
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
        className={`h-full rounded-full transition-[width,background-color] duration-500 ${colors[status] || colors.safe}`}
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
  // The nine chapters of the financial profile.
  const [financialProfile, setFinancialProfile] = useState(null);
  const navigate = useNavigate();
  const [cashFlowSeries, setCashFlowSeries] = useState([]);
  const [chartConfig, setChartConfig] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const fintech = buildFlag('FINTECH_SYNTHESIS');
  const [goals, setGoals] = useState([]);
  const [feedStats, setFeedStats] = useState(null);
  const [achievements, setAchievements] = useState([]);
  const [debts, setDebts] = useState([]);
  const [recurringTransactions, setRecurringTransactions] = useState([]);
  // Which day of this month was the worst one. It is asked for on its
  // own, because a monthly total cannot say it.
  const [dailySpending, setDailySpending] = useState(null);
  
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
  // The page hears about every write to a transaction.
  //
  // The dashboard shows the balance, the spending and the count of
  // transactions. A reader who recorded one in the bar at the top of
  // this page, or on the add page, was shown the figures from before
  // they recorded it, until they pressed the browser's refresh
  // button.
  useOnDataMutated(
    () => {
      fetchData();
      fetchCashFlow();
    },
    ['transaction']
  );

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
        profileData,
        dailySpendingData,
      ] = await Promise.allSettled([
        api.dashboard.summary(null, null, displayCurrency, timeframe, selectedAccount),
        api.transactions.list({ limit: 10 }),
        api.budgets?.list ? api.budgets.list() : Promise.resolve([]),
        api.accounts?.list ? api.accounts.list() : Promise.resolve([]),
        api.goals?.list ? api.goals.list() : Promise.resolve([]),
        api.get('/feed/stats').catch(() => null),
        api.get('/debts').catch(() => []),
        api.get('/recurring').catch(() => []),
        // The financial profile is one request for all nine chapters,
        // so it does not hold the card up while eight other requests
        // are in the air.
        //
        // The order here is the order of the names above. When the
        // two drifted apart the profile card was handed the calendar
        // of spending and said "Belum ada data" to a reader with a
        // month of transactions.
        api.dashboard.financialProfile(displayCurrency).catch(() => null),
        // The calendar of spending: which day was the worst one.
        api.get('/analytics/spending/daily').catch(() => null),
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
      if (profileData.status === 'fulfilled' && profileData.value) setFinancialProfile(profileData.value);
      if (dailySpendingData.status === 'fulfilled' && dailySpendingData.value) {
        setDailySpending(dailySpendingData.value);
      }

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
    api.dashboard.summary(null, null, displayCurrency, timeframe, selectedAccount)
      .then((value) => setSummary(value))
      .catch(() => {});
  }, [displayCurrency, timeframe, selectedAccount]);

  // Fetch cash flow when timeframe changes
  useEffect(() => {
    fetchCashFlow();
  }, [fetchCashFlow]);

  // The four tiles above the chart have to be asked for again when
  // the period or the account changes. They were left showing the
  // old figures, so a reader who changed the period saw the chart
  // move while the numbers stayed where they were.
  useEffect(() => {
    let cancelled = false;
    api.dashboard.summary(null, null, displayCurrency, timeframe, selectedAccount)
      .then((value) => { if (!cancelled) setSummary(value); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [timeframe, selectedAccount]);

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
    <div
      className={`space-y-6 animate-fadeIn p-4 pb-24 md:pb-8 min-h-screen relative ${
        // The light behind the page only shows if the page does not
        // paint over it. With the aurora layer on, the page is
        // transparent and the wash is what is behind it.
        auroraIsOn() ? 'bg-transparent' : bgPrimary
      }`}
    >
      {/* The assistant.

          It used to be a window in the bottom left of the screen, and
          it sat on top of the cards the reader came to read: the
          review of the last transactions, the goals, the balance.

          It is a bar at the top of the page now, so it never covers a
          card. It records a quick transaction, answers a question,
          and takes the reader to a page, all from the same line. */}
      <TopAiCommandBar userData={{
        totalBalance: summary?.total_balance || 0,
        totalIncome: summary?.total_income || 0,
        totalExpense: summary?.total_expense || 0,
      }} />

      {/* The financial profile.

          Nine chapters of the reader's own money in one card: this
          month, the accounts, the investments, the net worth, the
          credit cards, the debts, what other people owe, the income,
          and the reader's own shop.

          It sits at the top of the page, because it is the answer to
          the question the reader came to ask. The bar above it can
          record a transaction or answer a question; this is the
          picture of where they stand.

          The card is drawn only when the answer has arrived, so the
          page does not show an empty shell while it is being fetched. */}
      {financialProfile ? (
        <FinancialProfileShowcase
          profile={financialProfile}
          onRecord={() => navigate('/add')}
        />
      ) : null}

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
        
        {/* The controls of the page.

            They used to be one row of eleven things: a sun, a
            switch, a moon, two modes, eight timeframes, a refresh
            and a camera. Nothing said which of them chose what the
            page was about, and which of them merely acted on it.

            So they are three groups now, and the groups are put
            apart: the timeframes, which say what period the page is
            about, sit on their own; the display mode, which says how
            much of it there is, sits next; and the two actions, which
            do something, sit at the end. */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* What period the page is about. */}
          <div
            className={`flex items-center gap-0.5 p-1 rounded-xl ${
              isDark ? 'bg-white/5 ring-1 ring-white/10' : 'bg-slate-100/80 ring-1 ring-slate-200/70'
            }`}
            role="group"
            aria-label={t('dashboard.timeframe', 'Periode')}
          >
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.key}
                onClick={() => setTimeframe(tf.key)}
                title={t(tf.descriptionKey)}
                aria-pressed={timeframe === tf.key}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
                  timeframe === tf.key
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-white/15 dark:text-white'
                    : `${textSecondary} hover:text-gray-900 dark:hover:text-white`
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>

          {/* How much of it there is. */}
          <ModeToggle mode={displayMode} onToggle={setDisplayMode} isDark={isDarkMode} />

          {/* The theme. The switch says which it is; the sun and the
              moon on either side of it said it twice. */}
          <div
            className={`flex items-center px-1 py-1 rounded-xl ${
              isDark ? 'bg-white/5 ring-1 ring-white/10' : 'bg-slate-100/80 ring-1 ring-slate-200/70'
            }`}
          >
            <DarkModeToggle isDark={isDarkMode} onToggle={toggleTheme} />
          </div>

          {/* What it does. */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              fetchData();
              fetchMarketData();
              fetchCashFlow();
            }}
            title={t('common.refresh', 'Muat ulang')}
            aria-label={t('common.refresh', 'Muat ulang')}
            className="rounded-xl"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>

          {onScanReceipt && (
            <Button variant="default" size="sm" onClick={onScanReceipt} className="gap-2 rounded-xl">
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

      {/* The money that has not been given a job, and how fresh the
          data is. Both are about trust, and both are here because the
          survey behind this work found that the commonest complaint
          about the tools people already use is that the numbers are
          wrong and nothing says so.

          Nothing is drawn at all when the switch is off. */}
      {fintech && (
        <div className="flex flex-col gap-2.5">
          {/* The first thing on the page: what can be spent today.
              It comes before everything else because it is the
              question people open the app to ask. */}
          <SafeToSpendWidget
            cash={summary?.total_balance || 0}
            rules={recurringTransactions}
            goals={goals}
            income={summary?.total_income || 0}
          />
          <DataAccuracyIndicator
            updatedAt={transactions?.[0]?.created_at || null}
            pendingReview={0}
          />
          <ReadyToBeAssignedBanner
            cash={summary?.total_balance || 0}
            budgets={budgets}
            spent={summary?.total_spent || 0}
          />
        </div>
      )}

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
      {/* A balanced 12-column Kakeibo bento row. TOTAL SALDO is the
          deep-sage hero ticket on the left (5 of 12); the three
          cashflow cards share the right (7 of 12) as equal white
          cards, so their titles read in full - never "PEMASUK..." -
          and there is no empty gap under them. */}
      {(() => {
        const balanceValue = summary?.total_balance || 0;
        const balanceCurrency = summary?.total_balance_currency || summary?.currency;
        const cashflowCards = [
          {
            key: 'income',
            label: t('dashboard.total_income'),
            value: summary?.totalIncome || summary?.total_income,
            icon: TrendingUp,
            iconBg: 'bg-[#E8F0ED]',
            iconClass: 'text-[#2F4842]',
            valueClass: 'text-[#2F4842]',
          },
          {
            key: 'expense',
            label: t('dashboard.total_expense'),
            value: summary?.totalExpense || summary?.total_expense,
            icon: TrendingDown,
            iconBg: 'bg-[#FBEDE8]',
            iconClass: 'text-[#AD4530]',
            valueClass: 'text-[#AD4530]',
          },
          {
            key: 'cashflow',
            label: t('dashboard.cash_flow'),
            value: summary?.netSavings || summary?.net_cash_flow,
            icon: Activity,
            iconBg: 'bg-[#EFEDE6]',
            iconClass: 'text-[#52796F]',
            valueClass: 'text-[#2D312E]',
          },
        ];
        return (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            {/* TOTAL SALDO - deep sage ticket. */}
            <div className="lg:col-span-5 summary-amount-measure">
              <ForestTicketCard
                data-testid="balance-ticket"
                className="h-full"
                eyebrow={t('dashboard.total_balance')}
                caption={accounts.length
                  ? t('dashboard.accounts_count', '', { count: accounts.length })
                  : t('dashboard.balance_caption')}
                mascot={{
                  size: 60,
                  state: balanceValue < 0 ? 'alert' : 'idle',
                  label: t('dashboard.total_balance'),
                  lines: [t('dashboard.balance_caption')],
                }}
              >
                {/* The amount is one unbroken line: Rp and the digits
                    never wrap onto two lines. */}
                <p
                  className="mt-2 whitespace-nowrap text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight tabular-nums"
                  data-forest-value
                  style={{ color: '#FFF8E7' }}
                >
                  <AnimatedNumber
                    value={balanceValue}
                    format={(n) => formatNative(n, balanceCurrency)}
                  />
                </p>
              </ForestTicketCard>
            </div>

            {/* Pemasukan · Pengeluaran · Arus Kas - three equal cards. */}
            <div className="lg:col-span-7">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 h-full">
                {cashflowCards.map((card) => {
                  const Icon = card.icon;
                  return (
                    <div key={card.key} className="hh-card summary-amount-measure flex flex-col justify-between p-5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-[#5C6460]">
                          {card.label}
                        </p>
                        <span className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${card.iconBg}`}>
                          <Icon className={`w-4 h-4 ${card.iconClass}`} />
                        </span>
                      </div>
                      <p className={`mt-4 whitespace-nowrap text-xl lg:text-2xl font-bold tabular-nums tracking-tight ${card.valueClass}`}>
                        <AnimatedNumber
                          value={card.value || 0}
                          format={(n) => formatCurrency(n)}
                        />
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

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

          {/* Safe-to-Spend.

              This is the number the reader came for - the money they
              may spend without thinking - so it is the one number on
              the page that is drawn large and on its own.

              The per-day figure is beside it rather than under it,
              because "Rp 83.333 per hari" is the form the number
              takes in a reader's head. A monthly total has to be
              divided before it can be spent; a daily one does not. */}
          <Card className="p-5 shape-card relative overflow-hidden">
            {/* The wash behind the one number that matters. */}
            <div
              className="pointer-events-none absolute inset-0 -z-10"
              style={{
                background:
                  'radial-gradient(120% 90% at 100% 0%, rgba(16,185,129,0.14) 0%, rgba(16,185,129,0) 62%)',
              }}
              aria-hidden="true"
            />

            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-100/80 dark:bg-emerald-500/15 shrink-0">
                  <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </span>
                <h3 className={`font-semibold truncate ${textPrimary}`}>
                  {t('dashboard.safe_to_spend')}
                </h3>
              </div>
              <Badge
                variant={safeToSpend.status === 'safe' ? 'success' : safeToSpend.status === 'warning' ? 'warning' : 'danger'}
                size="sm"
              >
                {safeToSpend.percent.toFixed(0)}% {t('dashboard.remaining_short', 'sisa')}
              </Badge>
            </div>

            {/* The number. One line, never broken. */}
            <p className="text-4xl xl:text-[2.75rem] font-bold tabular-nums whitespace-nowrap leading-none tracking-tight text-gray-900 dark:text-gray-50">
              <AnimatedNumber value={safeToSpend.amount} format={(n) => formatCurrency(n)} />
            </p>
            <p className={`mt-1.5 text-sm ${textSecondary}`}>
              {t('dashboard.safe_to_spend_caption')}
            </p>

            {/* The three ways of reading it.

                The per-day one is the one that decides what the
                reader does today, so it is the one that is given the
                room and the weight. */}
            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-emerald-50/80 dark:bg-emerald-500/10 px-2 py-2.5 text-center ring-1 ring-emerald-200/60 dark:ring-emerald-500/20">
                <p className="text-base font-bold tabular-nums whitespace-nowrap text-emerald-700 dark:text-emerald-300 leading-tight">
                  {formatCurrency((safeToSpend.amount / 30) || 0)}
                </p>
                <p className="mt-0.5 text-[11px] leading-4 text-emerald-700/80 dark:text-emerald-300/70">
                  {t('dashboard.per_day')}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 dark:bg-white/5 px-2 py-2.5 text-center ring-1 ring-slate-200/70 dark:ring-white/10">
                <p className="text-base font-bold tabular-nums whitespace-nowrap text-slate-800 dark:text-slate-100 leading-tight">
                  {formatCurrency((safeToSpend.amount / 4) || 0)}
                </p>
                <p className="mt-0.5 text-[11px] leading-4 text-slate-500 dark:text-slate-400">
                  {t('dashboard.per_week')}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 dark:bg-white/5 px-2 py-2.5 text-center ring-1 ring-slate-200/70 dark:ring-white/10">
                <p className="text-base font-bold tabular-nums whitespace-nowrap text-slate-800 dark:text-slate-100 leading-tight">
                  {formatCurrency(safeToSpend.amount)}
                </p>
                <p className="mt-0.5 text-[11px] leading-4 text-slate-500 dark:text-slate-400">
                  {t('common.total')}
                </p>
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
            className="h-2 rounded-full bg-gradient-to-r from-primary-500 to-primary-400 transition-[width]"
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
      {/* The calendar of spending: which day of the month was the
          worst one. A monthly total cannot say that - the money came
          out on one day rather than spread across thirty - so it is
          asked for on its own. */}
      {dailySpending?.days?.length ? (
        <Card className={`p-4 ${bgCard} border ${borderColor}`}>
          <SpendingHeatmapCalendar days={dailySpending.days} month={dailySpending.month} />
        </Card>
      ) : null}

      {/* GOALS - DIPULIHKAN */}
      {/* ================================================================ */}
      {goals.length > 0 && (
        <Card className={`p-4 ${bgCard} border ${borderColor}`}>
          <div className="flex items-center justify-between mb-4">
            {/* One target, not two. The picture and the word's own
                icon were both being drawn, so the heading read
                "◎ ◎ Target Keuangan". */}
            <div className="flex items-center gap-2">
              <h3 className={`font-semibold ${textPrimary}`}><IconText name="goal" emoji="🎯" on={polished} className="w-5 h-5 text-primary-500">{t('dashboard.financial_goals')}</IconText></h3>
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
                  {/* The picture holds its place and the words are
                      allowed to shrink.

                      Without this the picture could be pushed over the
                      name of the goal, the line under it, and the
                      amount beside it. The goal on the goals page
                      already worked this way; this is the same card
                      and it now behaves the same way. */}
                  <div className="flex items-center gap-4 mb-2">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
                      style={{ backgroundColor: goal.color || '#3b82f6' }}
                    >
                      {/* The picture is the one the goal asks for, not
                          always the same target. */}
                      {(() => {
                        const Icon = goalIcon(goal);
                        return <Icon className="w-5 h-5 shrink-0" />;
                      })()}
                    </div>
                    <div className="min-w-0 flex-1">
                      {/* The name of the goal.

                          It is not cut off. "Operasi Lasik" is short
                          enough to fit, but a goal with a longer name
                          was being cut in half at the edge of the
                          card, and the name of a goal is the one
                          thing on the card the reader came to read. */}
                      <p className={`font-medium whitespace-normal break-words ${textPrimary}`}>{goal.name}</p>
                      <p className={`text-xs whitespace-normal break-words ${textSecondary}`}>{categoryName(goal.category, language) || t('dashboard.savings')}</p>
                    </div>
                    {goal.is_completed && <Badge variant="success">✓</Badge>}
                  </div>
                  {/* The bar fills from nothing to where it should
                      be, so the reader sees the line move. A target
                      that is a third of the way there should look
                      like a third of the way there. */}
                  <div className="mb-2">
                    <AnimatedProgressBar
                      percent={progress}
                      over={false}
                      className={isDark ? '[&>div]:bg-gray-600' : ''}
                    />
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className={textSecondary}>
                      <CountUpNumber value={Number(goal.current_amount) || 0} from={0} format={(n) => formatCurrency(n, goal.currency)} />
                    </span>
                    <span className={`font-medium ${textPrimary}`}>{formatCurrency(goal.target_amount, goal.currency)}</span>
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
