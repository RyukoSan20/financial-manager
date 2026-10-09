import { useState, useEffect, useRef, useCallback } from 'react';
import React from 'react';
import { Card, Button, Badge, Spinner } from '../components/ui';
import { 
  TrendingUp, TrendingDown, Wallet, PiggyBank, RefreshCw, Camera, 
  CheckCircle, AlertTriangle, XCircle, Clock, Target,
  ArrowUpRight, ArrowDownRight, Zap, Award, Shield, Trophy, Bell,
  BarChart3, Activity, Sun, Moon, TrendingBar, PieChart,
  ChevronUp, ChevronDown, ZoomIn, ZoomOut
} from 'lucide-react';
import { formatCurrency, formatPercent } from '../utils/format';
import api from '../services/api';
import { useTranslation } from '../i18n';

// Timeframe Configuration
const TIMEFRAMES = [
  { key: '1D', label: '1D', description: '24 Jam' },
  { key: '1W', label: '1W', description: '1 Minggu' },
  { key: '1M', label: '1M', description: '1 Bulan' },
  { key: '3M', label: '3M', description: '3 Bulan' },
  { key: 'YTD', label: 'YTD', description: 'Tahun Ini' },
  { key: '1Y', label: '1Y', description: '1 Tahun' },
  { key: '3Y', label: '3Y', description: '3 Tahun' },
  { key: '5Y', label: '5Y', description: '5 Tahun' },
];

// Category colors
const CATEGORY_COLORS = {
  salary: '#22c55e',
  freelance: '#10b981',
  investment_income: '#06b6d4',
  bonus: '#8b5cf6',
  other_income: '#6b7280',
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

// Dark mode toggle
const DarkModeToggle = ({ isDark, onToggle }) => (
  <button
    onClick={onToggle}
    className={`relative w-14 h-7 rounded-full transition-all duration-300 ${
      isDark ? 'bg-gray-700' : 'bg-gray-300'
    }`}
    aria-label="Toggle theme"
  >
    <span className={`absolute top-0.5 w-6 h-6 rounded-full shadow-md flex items-center justify-center transition-all duration-300 ${
      isDark ? 'left-7 bg-yellow-400' : 'left-0.5 bg-white'
    }`}>
      {isDark ? (
        <Moon className="w-3.5 h-3.5 text-gray-800" />
      ) : (
        <Sun className="w-3.5 h-3.5 text-yellow-500" />
      )}
    </span>
  </button>
);

// Market Card
const MarketCard = ({ name, value, change, positive }) => (
  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{name}</p>
    <p className="text-lg font-bold text-gray-900 dark:text-white">{value}</p>
    <div className={`flex items-center gap-1 text-sm ${positive ? 'text-green-600' : 'text-red-600'}`}>
      {positive ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      <span>{change}</span>
    </div>
  </div>
);

// Category Breakdown Component
const CategoryBreakdown = ({ categories, type, isDark }) => {
  const total = Object.values(categories || {}).reduce((sum, cat) => sum + (cat.total || 0), 0);
  
  return (
    <div className="space-y-2">
      <h4 className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
        {type === 'income' ? '💰 Rincian Pemasukan' : '💸 Rincian Pengeluaran'}
      </h4>
      {Object.entries(categories || {}).slice(0, 5).map(([key, data]) => (
        <div key={key} className="flex items-center gap-2">
          <div 
            className="w-2 h-2 rounded-full" 
            style={{ backgroundColor: CATEGORY_COLORS[key] || '#6b7280' }} 
          />
          <div className="flex-1">
            <div className="flex justify-between text-xs">
              <span className={`capitalize ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {key.replace(/_/g, ' ')}
              </span>
              <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                {formatCurrency(data.total || 0)}
              </span>
            </div>
            <div className={`w-full rounded-full h-1 mt-0.5 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
              <div
                className="h-1 rounded-full"
                style={{ 
                  width: `${data.percentage || 0}%`,
                  backgroundColor: CATEGORY_COLORS[key] || '#6b7280'
                }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export const Dashboard = ({ onAddTransaction, onScanReceipt }) => {
  const { t, language } = useTranslation();
  
  // Dark mode
  const [isDarkMode, setIsDarkMode] = useState(() => 
    typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
  );
  
  // Chart refs
  const chartContainerRef = useRef(null);
  const chartInstanceRef = useRef(null);
  
  // State
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [marketData, setMarketData] = useState(null);
  const [timeframe, setTimeframe] = useState('3M');
  const [selectedAccount, setSelectedAccount] = useState('all');
  const [accounts, setAccounts] = useState([]);
  const [cashFlowData, setCashFlowData] = useState({ meta: {}, series: [], categorySummary: {} });
  const [zoomLevel, setZoomLevel] = useState('normal');
  const [recentTransactions, setRecentTransactions] = useState([]);
  
  // Dark mode effect
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  // Theme colors
  const bgPrimary = isDarkMode ? 'bg-gray-900' : 'bg-gray-50';
  const bgCard = isDarkMode ? 'bg-gray-800' : 'bg-white';
  const textPrimary = isDarkMode ? 'text-white' : 'text-gray-900';
  const textSecondary = isDarkMode ? 'text-gray-400' : 'text-gray-600';
  const borderColor = isDarkMode ? 'border-gray-700' : 'border-gray-200';

  // Fetch market data
  const fetchMarketData = useCallback(async () => {
    try {
      const resp = await fetch('https://financial-manager-production-26f7.up.railway.app/realtime/summary');
      const data = await resp.json();
      setMarketData(data);
    } catch (err) {
      console.error('Market data error:', err);
    }
  }, []);

  // Fetch cash flow data with timeframe
  const fetchCashFlow = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ timeframe });
      if (selectedAccount !== 'all') {
        params.append('account_id', selectedAccount);
      }
      
      const resp = await fetch(`https://financial-manager-production-26f7.up.railway.app/api/dashboard/cash-flow?${params}`);
      const data = await resp.json();
      
      if (data.status === 'success') {
        setCashFlowData({
          meta: data.meta,
          series: data.series,
          categorySummary: data.categorySummary
        });
      }
    } catch (err) {
      console.error('Cash flow error:', err);
    } finally {
      setLoading(false);
    }
  }, [timeframe, selectedAccount]);

  // Fetch accounts
  const fetchAccounts = useCallback(async () => {
    try {
      const resp = await fetch('https://financial-manager-production-26f7.up.railway.app/api/dashboard/accounts');
      const data = await resp.json();
      setAccounts(data.accounts || []);
    } catch (err) {
      console.error('Accounts error:', err);
    }
  }, []);

  // Fetch summary
  const fetchSummary = useCallback(async () => {
    try {
      const resp = await api.dashboard.summary();
      setSummary(resp);
    } catch (err) {
      console.error('Summary error:', err);
    }
  }, []);

  // Fetch recent transactions
  const fetchTransactions = useCallback(async () => {
    try {
      const resp = await api.transactions.list({ limit: 5 });
      setRecentTransactions(Array.isArray(resp) ? resp : resp.transactions || []);
    } catch (err) {
      console.error('Transactions error:', err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    Promise.all([
      fetchSummary(),
      fetchMarketData(),
      fetchAccounts(),
      fetchTransactions()
    ]).finally(() => setLoading(false));
  }, []);

  // Fetch cash flow when timeframe changes
  useEffect(() => {
    fetchCashFlow();
  }, [fetchCashFlow]);

  // Render chart with Recharts
  useEffect(() => {
    if (!chartContainerRef.current || !cashFlowData.series?.length) return;

    import('recharts').then(({ ResponsiveContainer, ComposedChart, Bar, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend }) => {
      // Cleanup
      if (chartInstanceRef.current) {
        chartInstanceRef.current = null;
      }

      const { series } = cashFlowData;
      const granularity = cashFlowData.meta?.granularity || 'daily';

      const chart = (
        <ResponsiveContainer width="100%" height={400}>
          <ComposedChart data={series} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#374151' : '#e5e7eb'} />
            <XAxis 
              dataKey="labelX" 
              tick={{ fill: isDarkMode ? '#9ca3af' : '#6b7280', fontSize: 12 }}
              tickLine={{ stroke: isDarkMode ? '#374151' : '#e5e7eb' }}
            />
            <YAxis 
              yAxisId="left"
              tick={{ fill: isDarkMode ? '#9ca3af' : '#6b7280', fontSize: 11 }}
              tickFormatter={(v) => `Rp ${(v / 1000000).toFixed(0)}M`}
            />
            <YAxis 
              yAxisId="right" 
              orientation="right"
              tick={{ fill: isDarkMode ? '#9ca3af' : '#6b7280', fontSize: 11 }}
              tickFormatter={(v) => `Rp ${(v / 1000000).toFixed(0)}M`}
            />
            <Tooltip 
              formatter={(value) => [formatCurrency(value), '']}
              labelStyle={{ color: isDarkMode ? '#fff' : '#000' }}
              contentStyle={{ 
                backgroundColor: isDarkMode ? '#1f2937' : '#fff',
                border: `1px solid ${isDarkMode ? '#374151' : '#e5e7eb'}`
              }}
            />
            <Legend />
            <Bar 
              yAxisId="left"
              dataKey="totalIncome" 
              fill="#22c55e" 
              name="Pemasukan" 
              radius={[4, 4, 0, 0]}
            />
            <Bar 
              yAxisId="left"
              dataKey="totalExpense" 
              fill="#ef4444" 
              name="Pengeluaran" 
              radius={[4, 4, 0, 0]}
            />
            {granularity === 'monthly' || granularity === 'weekly' ? (
              <Area
                yAxisId="right"
                type="monotone"
                dataKey="netSavings"
                stroke="#3b82f6"
                fill="#3b82f640"
                name="Tabungan"
                strokeWidth={2}
              />
            ) : (
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="netSavings"
                stroke="#3b82f6"
                name="Tabungan"
                strokeWidth={2}
                dot={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      );

      chartInstanceRef.current = chart;
      React.createRoot(chartContainerRef.current).render(chart);

      return () => {
        if (chartContainerRef.current) {
          React.createRoot(chartContainerRef.current).unmount();
        }
      };
    });
  }, [cashFlowData, isDarkMode]);

  // Format market price
  const formatPrice = (price) => {
    if (!price) return '-';
    if (price > 1000) return Math.round(price).toLocaleString();
    return price.toFixed(2);
  };

  if (loading && !summary) {
    return (
      <div className={`flex items-center justify-center h-64 ${bgPrimary}`}>
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${bgPrimary} ${textPrimary} p-4 md:p-6`}>
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
        <div>
          <h1 className={`text-2xl font-bold ${textPrimary}`}>Dashboard</h1>
          <p className={`text-sm ${textSecondary} mt-1`}>
            {new Date().toLocaleDateString(language === 'id' ? 'id-ID' : language === 'ja' ? 'ja-JP' : 'en-US', { month: 'long', year: 'numeric' })}
          </p>
        </div>
        
        <div className="flex gap-3 items-center flex-wrap">
          {/* Dark Mode */}
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${bgCard} border ${borderColor}`}>
            <Sun className={`w-4 h-4 ${textSecondary}`} />
            <DarkModeToggle isDark={isDarkMode} onToggle={() => setIsDarkMode(!isDarkMode)} />
            <Moon className={`w-4 h-4 ${textSecondary}`} />
          </div>
          
          <Button variant="outline" size="sm" onClick={() => { fetchSummary(); fetchMarketData(); fetchCashFlow(); }}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className={`${bgCard} border ${borderColor} p-4`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${textSecondary}`}>Total Saldo</p>
              <p className={`text-2xl font-bold ${textPrimary}`}>{formatCurrency(summary?.total_balance || 0)}</p>
            </div>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isDarkMode ? 'bg-green-900/50' : 'bg-green-100'}`}>
              <Wallet className={`w-6 h-6 ${isDarkMode ? 'text-green-400' : 'text-green-600'}`} />
            </div>
          </div>
        </Card>
        
        <Card className={`${bgCard} border ${borderColor} p-4`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${textSecondary}`}>Pemasukan</p>
              <p className={`text-2xl font-bold ${textPrimary}`}>{formatCurrency(summary?.total_income || 0)}</p>
            </div>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isDarkMode ? 'bg-blue-900/50' : 'bg-blue-100'}`}>
              <TrendingUp className={`w-6 h-6 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
            </div>
          </div>
        </Card>
        
        <Card className={`${bgCard} border ${borderColor} p-4`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${textSecondary}`}>Pengeluaran</p>
              <p className={`text-2xl font-bold ${textPrimary}`}>{formatCurrency(summary?.total_expense || 0)}</p>
            </div>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isDarkMode ? 'bg-red-900/50' : 'bg-red-100'}`}>
              <TrendingDown className={`w-6 h-6 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`} />
            </div>
          </div>
        </Card>
        
        <Card className={`${bgCard} border ${borderColor} p-4`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${textSecondary}`}>Arus Kas</p>
              <p className={`text-2xl font-bold ${textPrimary}`}>{formatCurrency(summary?.net_cash_flow || 0)}</p>
            </div>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isDarkMode ? 'bg-purple-900/50' : 'bg-purple-100'}`}>
              <Activity className={`w-6 h-6 ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`} />
            </div>
          </div>
        </Card>
      </div>

      {/* Cash Flow Chart Section */}
      <Card className={`${bgCard} border ${borderColor} p-4 mb-6`}>
        <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
          <div className="flex items-center gap-2">
            <PieChart className={`w-5 h-5 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
            <h3 className={`font-semibold ${textPrimary}`}>Tren Arus Kas</h3>
            <Badge variant="outline">{TIMEFRAMES.find(t => t.key === timeframe)?.description}</Badge>
          </div>
          
          <div className="flex gap-3 items-center flex-wrap">
            {/* Account Filter */}
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
            
            {/* Timeframe Selector */}
            <div className={`flex rounded-lg p-1 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
              {TIMEFRAMES.map(tf => (
                <button
                  key={tf.key}
                  onClick={() => setTimeframe(tf.key)}
                  title={tf.description}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                    timeframe === tf.key 
                      ? 'bg-blue-600 text-white' 
                      : `${textSecondary} hover:bg-gray-200 dark:hover:bg-gray-600`
                  }`}
                >
                  {tf.label}
                </button>
              ))}
            </div>
            
            {/* Zoom Controls */}
            <div className="flex gap-1">
              <button 
                onClick={() => setZoomLevel('compact')}
                className={`p-1.5 rounded ${zoomLevel === 'compact' ? 'bg-blue-600 text-white' : `${bgCard} ${borderColor}`}`}
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setZoomLevel('expanded')}
                className={`p-1.5 rounded ${zoomLevel === 'expanded' ? 'bg-blue-600 text-white' : `${bgCard} ${borderColor}`}`}
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
        
        {/* Chart */}
        {loading ? (
          <div className="h-[400px] flex items-center justify-center">
            <Spinner size="lg" />
          </div>
        ) : cashFlowData.series?.length > 0 ? (
          <div ref={chartContainerRef} className="w-full" />
        ) : (
          <div className={`h-[400px] flex items-center justify-center ${textSecondary}`}>
            <Activity className="w-12 h-12 opacity-50 mr-3" />
            <p>Tidak ada data untuk periode ini</p>
          </div>
        )}
        
        {/* Meta Info */}
        {cashFlowData.meta && (
          <div className={`mt-4 pt-4 border-t ${borderColor} grid grid-cols-2 md:grid-cols-4 gap-4 text-sm`}>
            <div>
              <p className={textSecondary}>Total Period</p>
              <p className={`font-semibold ${textPrimary}`}>{cashFlowData.meta.periodDays || 0} days</p>
            </div>
            <div>
              <p className={textSecondary}>Granularity</p>
              <p className={`font-semibold capitalize ${textPrimary}`}>{cashFlowData.meta.granularity}</p>
            </div>
            <div>
              <p className={textSecondary}>Data Points</p>
              <p className={`font-semibold ${textPrimary}`}>{cashFlowData.meta.totalDataPoints || 0}</p>
            </div>
            <div>
              <p className={textSecondary}>Avg Daily</p>
              <p className={`font-semibold ${textPrimary}`}>{formatCurrency(cashFlowData.meta.averageDailyExpense || 0)}</p>
            </div>
          </div>
        )}
      </Card>

      {/* Category Breakdown & Market Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Breakdown */}
        <Card className={`${bgCard} border ${borderColor} p-4`}>
          <h3 className={`font-semibold mb-4 ${textPrimary}`}>📊 Rincian Kategori</h3>
          <div className="grid grid-cols-2 gap-4">
            <CategoryBreakdown 
              categories={cashFlowData.categorySummary?.income} 
              type="income" 
              isDark={isDarkMode}
            />
            <CategoryBreakdown 
              categories={cashFlowData.categorySummary?.expense} 
              type="expense" 
              isDark={isDarkMode}
            />
          </div>
        </Card>

        {/* Market Overview */}
        <Card className={`${bgCard} border ${borderColor} p-4`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`font-semibold ${textPrimary}`}>📈 Overview Pasar</h3>
            <span className="flex items-center gap-1 text-xs text-green-500">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Live
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {marketData?.forex?.quotes?.slice(0, 2).map((fx, i) => (
              <MarketCard 
                key={i}
                name={fx.pair}
                value={fx.price?.toFixed(fx.price > 100 ? 0 : 4)}
                change={`${fx.change_percent >= 0 ? '+' : ''}${fx.change_percent?.toFixed(2)}%`}
                positive={fx.change_percent >= 0}
              />
            ))}
            {marketData?.crypto?.quotes?.slice(0, 2).map((coin, i) => (
              <MarketCard 
                key={`c-${i}`}
                name={coin.symbol}
                value={`$${formatPrice(coin.price)}`}
                change={`${coin.change_percent_24h >= 0 ? '+' : ''}${coin.change_percent_24h?.toFixed(2)}%`}
                positive={coin.change_percent_24h >= 0}
              />
            ))}
          </div>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card className={`${bgCard} border ${borderColor} p-4 mt-6`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className={`font-semibold ${textPrimary}`}>Transaksi Terbaru</h3>
          <Button variant="ghost" size="sm" onClick={() => window.location.href = '/transactions'}>
            Lihat Semua →
          </Button>
        </div>
        {recentTransactions.length > 0 ? (
          <div className="space-y-3">
            {recentTransactions.map((tx, idx) => (
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
                    <p className={`text-sm ${textSecondary}`}>{tx.category_name || tx.category}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-semibold ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                    {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                  </p>
                  <p className={`text-xs ${textSecondary}`}>
                    {tx.date ? new Date(tx.date).toLocaleDateString() : ''}
                  </p>
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
    </div>
  );
};

export default Dashboard;
