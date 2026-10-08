import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, Button, Badge, Spinner } from '../components/ui';
import { 
  TrendingUp, TrendingDown, RefreshCw, BarChart3,
  Search, BookOpen, PieChart, Activity, DollarSign,
  ArrowUpRight, ArrowDownRight, Globe, Bitcoin, Gem, Landmark,
  Sun, Moon, ChevronUp, ChevronDown, Play, ExternalLink
} from 'lucide-react';
import { formatNumber } from '../utils/format';

// Dark Mode Toggle Component
const ThemeToggle = ({ isDark, onToggle }) => (
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

// Market Card with proper theming
const MarketCard = ({ name, value, change, changeValue, positive, unit = '', isDark }) => {
  return (
    <div className={`p-4 rounded-xl border transition-all hover:shadow-lg ${
      isDark 
        ? 'bg-gray-800/80 border-gray-700 hover:bg-gray-800' 
        : 'bg-white border-gray-200 hover:bg-gray-50'
    }`}>
      <p className={`text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
        {name}
      </p>
      <p className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
        {value}{unit}
      </p>
      <div className={`flex items-center gap-1 text-sm font-medium ${
        positive ? 'text-green-600' : 'text-red-600'
      }`}>
        {positive ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        <span>{changeValue !== undefined ? changeValue : change}</span>
      </div>
    </div>
  );
};

export const MarketPage = () => {
  // Dark mode state
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return true;
  });

  const [loading, setLoading] = useState(true);
  const [marketData, setMarketData] = useState(null);
  const [selectedSymbol, setSelectedSymbol] = useState('FX_IDC:USDIDR');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('realtime'); // realtime, table, learn
  const [activeTab, setActiveTab] = useState('all'); // all, idx, us, crypto, forex, commodities
  const [activeMarketTab, setActiveMarketTab] = useState('forex');
  const tvContainerRef = useRef(null);

  // Apply dark mode
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Toggle dark mode
  const toggleDarkMode = () => setIsDarkMode(!isDarkMode);

  // Fetch all real-time market data
  const fetchMarketData = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch('https://financial-manager-production-26f7.up.railway.app/realtime/summary');
      const data = await resp.json();
      setMarketData(data);
    } catch (err) {
      console.error('Failed to fetch market data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMarketData();
    const interval = setInterval(fetchMarketData, 30000);
    return () => clearInterval(interval);
  }, [fetchMarketData]);

  // Initialize TradingView widget with theme
  useEffect(() => {
    if (viewMode !== 'realtime' || !tvContainerRef.current) return;

    if (tvContainerRef.current) {
      tvContainerRef.current.innerHTML = '';
    }

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      allow_symbol_change: true,
      calendar: false,
      details: true,
      hide_side_toolbar: false,
      hide_top_toolbar: false,
      hide_legend: false,
      hide_volume: false,
      hotlist: false,
      interval: 'D',
      locale: 'id',
      save_image: true,
      style: '1',
      symbol: selectedSymbol,
      theme: isDarkMode ? 'dark' : 'light',
      timezone: 'Asia/Jakarta',
      backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
      gridColor: isDarkMode ? 'rgba(46, 46, 46, 0.3)' : 'rgba(46, 46, 46, 0.1)',
      withdateranges: true,
      compareSymbols: [],
      support_host: 'https://www.tradingview.com',
      studies: ['RSI@tv-basicstudies', 'MASimple@tv-basicstudies'],
      autosize: true,
      watchlist: [
        'FX_IDC:USDIDR', 'FX:EURUSD', 'FX:GBPUSD', 'FX:USDJPY',
        'IDX:BBCA', 'IDX:BBRI', 'IDX:BMRI', 'IDX:TLKM', 'IDX:ASII', 'IDX:UNVR', 'IDX:ADRO', 'IDX:GOTO',
        'NASDAQ:AAPL', 'NASDAQ:MSFT', 'NASDAQ:GOOGL', 'NASDAQ:TSLA', 'NASDAQ:NVDA',
        'BINANCE:BTCUSDT', 'BINANCE:ETHUSDT',
        'TVC:GOLD', 'TVC:USOIL',
      ],
    });

    tvContainerRef.current.appendChild(script);
  }, [viewMode, selectedSymbol, isDarkMode]);

  // Symbol options for TradingView
  const symbolOptions = [
    { group: '💱 Forex', symbols: [
      { symbol: 'FX_IDC:USDIDR', name: 'USD/IDR' },
      { symbol: 'FX:EURUSD', name: 'EUR/USD' },
      { symbol: 'FX:GBPUSD', name: 'GBP/USD' },
      { symbol: 'FX:USDJPY', name: 'USD/JPY' },
    ]},
    { group: '🇮🇩 Saham IDX', symbols: [
      { symbol: 'IDX:BBCA', name: 'BBCA' },
      { symbol: 'IDX:BBRI', name: 'BBRI' },
      { symbol: 'IDX:BMRI', name: 'BMRI' },
      { symbol: 'IDX:TLKM', name: 'TLKM' },
      { symbol: 'IDX:ASII', name: 'ASII' },
      { symbol: 'IDX:UNVR', name: 'UNVR' },
    ]},
    { group: '🇺🇸 Saham US', symbols: [
      { symbol: 'NASDAQ:AAPL', name: 'AAPL' },
      { symbol: 'NASDAQ:MSFT', name: 'MSFT' },
      { symbol: 'NASDAQ:GOOGL', name: 'GOOGL' },
      { symbol: 'NASDAQ:TSLA', name: 'TSLA' },
    ]},
    { group: '₿ Crypto', symbols: [
      { symbol: 'BINANCE:BTCUSDT', name: 'BTC' },
      { symbol: 'BINANCE:ETHUSDT', name: 'ETH' },
    ]},
  ];

  // Format price
  const formatPrice = (price, currency = 'IDR') => {
    if (price === null || price === undefined) return '-';
    if (currency === 'USD') return `$${formatNumber(price, 'en-US')}`;
    if (currency === 'IDR') return `Rp ${formatNumber(price, 'id-ID')}`;
    return formatNumber(price);
  };

  // Format volume
  const formatVolume = (vol) => {
    if (!vol) return '-';
    if (vol >= 1000000000) return `${(vol / 1000000000).toFixed(1)}B`;
    if (vol >= 1000000) return `${(vol / 1000000).toFixed(1)}M`;
    if (vol >= 1000) return `${(vol / 1000).toFixed(0)}K`;
    return vol.toString();
  };

  // Get filtered stocks
  const getFilteredStocks = (stocks, type) => {
    if (!stocks) return [];
    let filtered = [...stocks];
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(s => 
        s.symbol?.toLowerCase().includes(term) || 
        s.name?.toLowerCase().includes(term) ||
        s.pair?.toLowerCase().includes(term)
      );
    }
    
    return filtered;
  };

  // Learning content
  const learningContent = [
    {
      title: '📊 Cara Baca Candlestick',
      icon: BarChart3,
      content: 'Candlestick menunjukkan Open, High, Low, Close (OHLC). Body hijau = harga naik, merah = turun.',
    },
    {
      title: '📈 Indikator RSI',
      icon: Activity,
      content: 'RSI > 70 = overbought (jenuh beli), RSI < 30 = oversold (jenuh jual).',
    },
    {
      title: '💰 Dollar Cost Averaging',
      icon: DollarSign,
      content: 'Strategi investasi rutin dengan jumlah tetap untuk kurangi risiko timing.',
    },
    {
      title: '🎯 Support & Resistance',
      icon: PieChart,
      content: 'Support = level beli, Resistance = level jual. Pecah resistance = trend naik.',
    },
  ];

  // Theme-aware colors
  const bgPrimary = isDarkMode ? 'bg-gray-900' : 'bg-gray-50';
  const bgCard = isDarkMode ? 'bg-gray-800' : 'bg-white';
  const bgCardHover = isDarkMode ? 'hover:bg-gray-750' : 'hover:bg-gray-100';
  const textPrimary = isDarkMode ? 'text-white' : 'text-gray-900';
  const textSecondary = isDarkMode ? 'text-gray-400' : 'text-gray-600';
  const textMuted = isDarkMode ? 'text-gray-500' : 'text-gray-400';
  const borderColor = isDarkMode ? 'border-gray-700' : 'border-gray-200';
  const borderHover = isDarkMode ? 'hover:border-gray-600' : 'hover:border-gray-300';

  if (loading && !marketData) {
    return (
      <div className={`min-h-screen ${bgPrimary} flex items-center justify-center`}>
        <Spinner size="lg" />
        <span className={`ml-3 ${textSecondary}`}>Memuat data pasar...</span>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${bgPrimary} ${textPrimary} p-4 md:p-6`}>
      {/* Header */}
      <div className={`flex flex-wrap justify-between items-center gap-4 mb-6`}>
        <div>
          <h1 className={`text-2xl font-bold ${textPrimary}`}>Market Intelligence</h1>
          <p className={`text-sm ${textSecondary} mt-1`}>
            {marketData?.updated ? `Updated: ${new Date(marketData.updated).toLocaleTimeString()}` : ''}
            <span className="ml-2 text-green-500 flex items-center gap-1">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Real-Time
            </span>
          </p>
        </div>
        <div className="flex gap-3 items-center flex-wrap">
          {/* Theme Toggle */}
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${bgCard} border ${borderColor}`}>
            <Sun className={`w-4 h-4 ${textSecondary}`} />
            <ThemeToggle isDark={isDarkMode} onToggle={toggleDarkMode} />
            <Moon className={`w-4 h-4 ${textSecondary}`} />
          </div>
          
          <Button size="sm" variant={viewMode === 'learn' ? 'primary' : 'outline'}
            onClick={() => setViewMode('learn')}
            className={`${isDarkMode ? 'border-gray-600 text-gray-300' : 'border-gray-300'}`}>
            <BookOpen className="w-4 h-4 mr-2" />
            Belajar
          </Button>
          <Button size="sm" variant={viewMode === 'table' ? 'primary' : 'outline'}
            onClick={() => setViewMode('table')}
            className={`${isDarkMode ? 'border-gray-600 text-gray-300' : 'border-gray-300'}`}>
            <BarChart3 className="w-4 h-4 mr-2" />
            Tabel
          </Button>
          <Button size="sm" variant={viewMode === 'realtime' ? 'primary' : 'outline'}
            onClick={() => setViewMode('realtime')}
            className={`${isDarkMode ? 'border-gray-600 text-gray-300' : 'border-gray-300'}`}>
            <Activity className="w-4 h-4 mr-2" />
            Chart
          </Button>
          <Button size="sm" variant="outline" onClick={fetchMarketData}
            className={`${isDarkMode ? 'border-gray-600 text-gray-300' : 'border-gray-300'}`}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className={`${bgCard} border ${borderColor} p-4`}>
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-blue-900/50' : 'bg-blue-100'}`}>
              <BarChart3 className={`w-6 h-6 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
            </div>
            <div>
              <p className={`text-sm ${textSecondary}`}>Saham IDX</p>
              <p className={`text-2xl font-bold ${textPrimary}`}>{marketData?.idx_stocks?.total || 0}</p>
            </div>
          </div>
        </Card>
        <Card className={`${bgCard} border ${borderColor} p-4`}>
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-green-900/50' : 'bg-green-100'}`}>
              <TrendingUp className={`w-6 h-6 ${isDarkMode ? 'text-green-400' : 'text-green-600'}`} />
            </div>
            <div>
              <p className={`text-sm ${textSecondary}`}>Saham US</p>
              <p className={`text-2xl font-bold ${textPrimary}`}>{marketData?.us_stocks?.total || 0}</p>
            </div>
          </div>
        </Card>
        <Card className={`${bgCard} border ${borderColor} p-4`}>
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-yellow-900/50' : 'bg-yellow-100'}`}>
              <Bitcoin className={`w-6 h-6 ${isDarkMode ? 'text-yellow-400' : 'text-yellow-600'}`} />
            </div>
            <div>
              <p className={`text-sm ${textSecondary}`}>Crypto</p>
              <p className={`text-2xl font-bold ${textPrimary}`}>{marketData?.crypto?.total || 0}</p>
            </div>
          </div>
        </Card>
        <Card className={`${bgCard} border ${borderColor} p-4`}>
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-purple-900/50' : 'bg-purple-100'}`}>
              <Landmark className={`w-6 h-6 ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`} />
            </div>
            <div>
              <p className={`text-sm ${textSecondary}`}>Forex</p>
              <p className={`text-2xl font-bold ${textPrimary}`}>{marketData?.forex?.total || 0}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Realtime Chart View */}
      {viewMode === 'realtime' && (
        <div className="space-y-4">
          {/* Symbol Selector */}
          <Card className={`${bgCard} border ${borderColor} p-4`}>
            <div className="flex flex-wrap gap-2 items-center">
              <span className={`text-sm ${textSecondary} mr-2 font-medium`}>Chart:</span>
              {symbolOptions.map(group => (
                <div key={group.group} className="flex flex-wrap gap-1">
                  <span className={`text-xs ${textMuted} w-full font-medium`}>{group.group}</span>
                  {group.symbols.map(s => (
                    <button
                      key={s.symbol}
                      onClick={() => setSelectedSymbol(s.symbol)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        selectedSymbol === s.symbol
                          ? 'bg-blue-600 text-white shadow-md'
                          : isDarkMode
                            ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </Card>

          {/* TradingView Chart */}
          <Card className={`${bgCard} border ${borderColor} overflow-hidden`} style={{ height: '600px' }}>
            <div ref={tvContainerRef} className="w-full h-full" />
          </Card>

          {/* Quick Market Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {[
              { name: 'USD/IDR', value: marketData?.forex?.quotes?.find(f => f.pair === 'USD/IDR')?.price?.toFixed(0) || '-', change: marketData?.forex?.quotes?.find(f => f.pair === 'USD/IDR')?.change_percent?.toFixed(2) + '%' || '-', positive: (marketData?.forex?.quotes?.find(f => f.pair === 'USD/IDR')?.change_percent || 0) >= 0 },
              { name: 'BTC/USD', value: '$' + (marketData?.crypto?.quotes?.find(c => c.symbol === 'BTC')?.price?.toLocaleString() || '-'), change: (marketData?.crypto?.quotes?.find(c => c.symbol === 'BTC')?.change_percent_24h?.toFixed(2) || '-') + '%', positive: (marketData?.crypto?.quotes?.find(c => c.symbol === 'BTC')?.change_percent_24h || 0) >= 0 },
              { name: 'ETH/USD', value: '$' + (marketData?.crypto?.quotes?.find(c => c.symbol === 'ETH')?.price?.toLocaleString() || '-'), change: (marketData?.crypto?.quotes?.find(c => c.symbol === 'ETH')?.change_percent_24h?.toFixed(2) || '-') + '%', positive: (marketData?.crypto?.quotes?.find(c => c.symbol === 'ETH')?.change_percent_24h || 0) >= 0 },
              { name: 'GOLD', value: '$' + (marketData?.commodities?.quotes?.find(c => c.symbol === 'GOLD')?.price?.toFixed(0) || '-'), change: (marketData?.commodities?.quotes?.find(c => c.symbol === 'GOLD')?.change_percent?.toFixed(2) || '-') + '%', positive: (marketData?.commodities?.quotes?.find(c => c.symbol === 'GOLD')?.change_percent || 0) >= 0 },
              { name: 'BBCA', value: 'Rp ' + (marketData?.idx_stocks?.quotes?.find(s => s.symbol === 'BBCA')?.price?.toLocaleString() || '-'), change: (marketData?.idx_stocks?.quotes?.find(s => s.symbol === 'BBCA')?.change_percent?.toFixed(2) || '-') + '%', positive: (marketData?.idx_stocks?.quotes?.find(s => s.symbol === 'BBCA')?.change_percent || 0) >= 0 },
            ].map((item, idx) => (
              <MarketCard key={idx} {...item} isDark={isDarkMode} />
            ))}
          </div>

          {/* Top Gainers & Losers */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className={`${bgCard} border ${borderColor} p-4`}>
              <h3 className={`font-semibold text-green-500 mb-3 flex items-center gap-2 ${textPrimary}`}>
                <ArrowUpRight className="w-5 h-5" /> Top Gainers
              </h3>
              <div className="space-y-2">
                {[...getFilteredStocks(marketData?.idx_stocks?.quotes, 'idx')]
                  .filter(s => s.change_percent > 0)
                  .sort((a, b) => b.change_percent - a.change_percent)
                  .slice(0, 5)
                  .map(stock => (
                    <div key={stock.symbol} className={`flex justify-between items-center p-3 rounded-lg ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                      <div>
                        <span className={`font-semibold ${textPrimary}`}>{stock.symbol}</span>
                        <span className={`text-sm ${textMuted} ml-2`}>{stock.name}</span>
                      </div>
                      <span className="text-green-500 font-bold">+{stock.change_percent?.toFixed(2)}%</span>
                    </div>
                  ))}
              </div>
            </Card>

            <Card className={`${bgCard} border ${borderColor} p-4`}>
              <h3 className={`font-semibold text-red-500 mb-3 flex items-center gap-2 ${textPrimary}`}>
                <ArrowDownRight className="w-5 h-5" /> Top Losers
              </h3>
              <div className="space-y-2">
                {[...getFilteredStocks(marketData?.idx_stocks?.quotes, 'idx')]
                  .filter(s => s.change_percent < 0)
                  .sort((a, b) => a.change_percent - b.change_percent)
                  .slice(0, 5)
                  .map(stock => (
                    <div key={stock.symbol} className={`flex justify-between items-center p-3 rounded-lg ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                      <div>
                        <span className={`font-semibold ${textPrimary}`}>{stock.symbol}</span>
                        <span className={`text-sm ${textMuted} ml-2`}>{stock.name}</span>
                      </div>
                      <span className="text-red-500 font-bold">{stock.change_percent?.toFixed(2)}%</span>
                    </div>
                  ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Table View */}
      {viewMode === 'table' && (
        <div className="space-y-4">
          {/* Tab Filters */}
          <Card className={`${bgCard} border ${borderColor} p-4`}>
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'forex', label: '💱 Forex' },
                { key: 'idx', label: '📊 IDX' },
                { key: 'us', label: '🇺🇸 US' },
                { key: 'crypto', label: '₿ Crypto' },
                { key: 'commodities', label: '🪙 Commodities' },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeTab === tab.key
                      ? 'bg-blue-600 text-white shadow-md'
                      : isDarkMode
                        ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </Card>

          {/* Search */}
          <Card className={`${bgCard} border ${borderColor} p-4`}>
            <div className="relative">
              <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${textSecondary}`} />
              <input
                type="text"
                placeholder="Cari..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full pl-10 pr-4 py-2.5 rounded-lg border ${borderColor} ${
                  isDarkMode 
                    ? 'bg-gray-700 text-white placeholder-gray-400 border-gray-600' 
                    : 'bg-gray-50 text-gray-900 placeholder-gray-400 border-gray-200'
                } focus:outline-none focus:ring-2 focus:ring-blue-500`}
              />
            </div>
          </Card>

          {/* IDX Stocks Table */}
          {activeTab === 'idx' && (
            <Card className={`${bgCard} border ${borderColor} overflow-hidden`}>
              <div className={`p-4 border-b ${borderColor}`}>
                <h3 className={`font-semibold ${textPrimary}`}>🇮🇩 Saham Indonesia (IDX)</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className={isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50'}>
                    <tr>
                      <th className={`px-4 py-3 text-left text-sm font-semibold ${textSecondary}`}>Saham</th>
                      <th className={`px-4 py-3 text-right text-sm font-semibold ${textSecondary}`}>Harga</th>
                      <th className={`px-4 py-3 text-right text-sm font-semibold ${textSecondary}`}>Change</th>
                      <th className={`px-4 py-3 text-right text-sm font-semibold ${textSecondary}`}>Volume</th>
                      <th className={`px-4 py-3 text-center text-sm font-semibold ${textSecondary}`}>Sektor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {getFilteredStocks(marketData?.idx_stocks?.quotes, 'idx').map(stock => (
                      <tr key={stock.symbol} className={`${bgCardHover} transition-colors`}>
                        <td className={`px-4 py-3`}>
                          <div className={`font-semibold ${textPrimary}`}>{stock.symbol}</div>
                          <div className={`text-xs ${textMuted}`}>{stock.name}</div>
                        </td>
                        <td className={`px-4 py-3 text-right font-mono font-semibold ${textPrimary}`}>{formatPrice(stock.price)}</td>
                        <td className={`px-4 py-3 text-right font-mono font-semibold ${stock.change_percent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {stock.change_percent >= 0 ? '+' : ''}{stock.change_percent?.toFixed(2)}%
                        </td>
                        <td className={`px-4 py-3 text-right font-mono ${textSecondary}`}>{formatVolume(stock.volume)}</td>
                        <td className={`px-4 py-3 text-center`}><Badge variant="outline">{stock.sector}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* US Stocks Table */}
          {activeTab === 'us' && (
            <Card className={`${bgCard} border ${borderColor} overflow-hidden`}>
              <div className={`p-4 border-b ${borderColor}`}>
                <h3 className={`font-semibold ${textPrimary}`}>🇺🇸 Saham Amerika (US)</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className={isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50'}>
                    <tr>
                      <th className={`px-4 py-3 text-left text-sm font-semibold ${textSecondary}`}>Saham</th>
                      <th className={`px-4 py-3 text-right text-sm font-semibold ${textSecondary}`}>Harga</th>
                      <th className={`px-4 py-3 text-right text-sm font-semibold ${textSecondary}`}>Change</th>
                      <th className={`px-4 py-3 text-right text-sm font-semibold ${textSecondary}`}>Volume</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {getFilteredStocks(marketData?.us_stocks?.quotes, 'us').map(stock => (
                      <tr key={stock.symbol} className={`${bgCardHover} transition-colors`}>
                        <td className={`px-4 py-3`}>
                          <div className={`font-semibold ${textPrimary}`}>{stock.symbol}</div>
                          <div className={`text-xs ${textMuted}`}>{stock.name}</div>
                        </td>
                        <td className={`px-4 py-3 text-right font-mono font-semibold ${textPrimary}`}>{formatPrice(stock.price, 'USD')}</td>
                        <td className={`px-4 py-3 text-right font-mono font-semibold ${stock.change_percent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {stock.change_percent >= 0 ? '+' : ''}{stock.change_percent?.toFixed(2)}%
                        </td>
                        <td className={`px-4 py-3 text-right font-mono ${textSecondary}`}>{formatVolume(stock.volume)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Forex Table */}
          {activeTab === 'forex' && (
            <Card className={`${bgCard} border ${borderColor} overflow-hidden`}>
              <div className={`p-4 border-b ${borderColor}`}>
                <h3 className={`font-semibold ${textPrimary}`}>💱 Forex</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className={isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50'}>
                    <tr>
                      <th className={`px-4 py-3 text-left text-sm font-semibold ${textSecondary}`}>Pair</th>
                      <th className={`px-4 py-3 text-right text-sm font-semibold ${textSecondary}`}>Harga</th>
                      <th className={`px-4 py-3 text-right text-sm font-semibold ${textSecondary}`}>Change</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {getFilteredStocks(marketData?.forex?.quotes, 'forex').map(fx => (
                      <tr key={fx.pair} className={`${bgCardHover} transition-colors`}>
                        <td className={`px-4 py-3 font-semibold ${textPrimary}`}>{fx.pair}</td>
                        <td className={`px-4 py-3 text-right font-mono font-semibold ${textPrimary}`}>{fx.price?.toFixed(4)}</td>
                        <td className={`px-4 py-3 text-right font-mono font-semibold ${fx.change_percent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {fx.change_percent >= 0 ? '+' : ''}{fx.change_percent?.toFixed(2)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Crypto Table */}
          {activeTab === 'crypto' && (
            <Card className={`${bgCard} border ${borderColor} overflow-hidden`}>
              <div className={`p-4 border-b ${borderColor}`}>
                <h3 className={`font-semibold ${textPrimary}`}>₿ Cryptocurrency</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className={isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50'}>
                    <tr>
                      <th className={`px-4 py-3 text-left text-sm font-semibold ${textSecondary}`}>Coin</th>
                      <th className={`px-4 py-3 text-right text-sm font-semibold ${textSecondary}`}>Harga</th>
                      <th className={`px-4 py-3 text-right text-sm font-semibold ${textSecondary}`}>24h Change</th>
                      <th className={`px-4 py-3 text-right text-sm font-semibold ${textSecondary}`}>Volume</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {getFilteredStocks(marketData?.crypto?.quotes, 'crypto').map(coin => (
                      <tr key={coin.symbol} className={`${bgCardHover} transition-colors`}>
                        <td className={`px-4 py-3 font-semibold ${textPrimary}`}>{coin.symbol}</td>
                        <td className={`px-4 py-3 text-right font-mono font-semibold ${textPrimary}`}>{formatPrice(coin.price, 'USD')}</td>
                        <td className={`px-4 py-3 text-right font-mono font-semibold ${coin.change_percent_24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {coin.change_percent_24h >= 0 ? '+' : ''}{coin.change_percent_24h?.toFixed(2)}%
                        </td>
                        <td className={`px-4 py-3 text-right font-mono ${textSecondary}`}>${formatVolume(coin.volume_24h)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Commodities Table */}
          {activeTab === 'commodities' && (
            <Card className={`${bgCard} border ${borderColor} overflow-hidden`}>
              <div className={`p-4 border-b ${borderColor}`}>
                <h3 className={`font-semibold ${textPrimary}`}>🪙 Komoditas</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className={isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50'}>
                    <tr>
                      <th className={`px-4 py-3 text-left text-sm font-semibold ${textSecondary}`}>Komoditas</th>
                      <th className={`px-4 py-3 text-right text-sm font-semibold ${textSecondary}`}>Harga</th>
                      <th className={`px-4 py-3 text-right text-sm font-semibold ${textSecondary}`}>Change</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {getFilteredStocks(marketData?.commodities?.quotes, 'commodities').map(item => (
                      <tr key={item.symbol} className={`${bgCardHover} transition-colors`}>
                        <td className={`px-4 py-3`}>
                          <div className={`font-semibold ${textPrimary}`}>{item.symbol}</div>
                          <div className={`text-xs ${textMuted}`}>{item.name}</div>
                        </td>
                        <td className={`px-4 py-3 text-right font-mono font-semibold ${textPrimary}`}>${item.price?.toFixed(2)}/{item.unit}</td>
                        <td className={`px-4 py-3 text-right font-mono font-semibold ${item.change_percent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {item.change_percent >= 0 ? '+' : ''}{item.change_percent?.toFixed(2)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Learning View */}
      {viewMode === 'learn' && (
        <div className="space-y-6">
          <Card className={`${bgCard} border ${borderColor} p-6`}>
            <h2 className={`text-xl font-bold mb-2 ${textPrimary}`}>📚 Panduan Trading untuk Pemula</h2>
            <p className={textSecondary}>Pelajari dasar-dasar analisis teknikal dan manajemen risiko.</p>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {learningContent.map((item, idx) => {
              const Icon = item.icon;
              return (
                <Card key={idx} className={`${bgCard} border ${borderColor} p-5 hover:shadow-lg transition-shadow`}>
                  <div className="flex items-start gap-3">
                    <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-blue-900/50' : 'bg-blue-100'}`}>
                      <Icon className={`w-5 h-5 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                    </div>
                    <div>
                      <h3 className={`font-semibold mb-2 ${textPrimary}`}>{item.title}</h3>
                      <p className={`text-sm ${textSecondary}`}>{item.content}</p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Quick Tips */}
          <Card className={`${bgCard} border ${borderColor} p-6`}>
            <h3 className={`font-bold text-lg mb-4 ${textPrimary}`}>💡 Tips Penting</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className={`p-4 rounded-xl ${isDarkMode ? 'bg-yellow-900/30 border border-yellow-700' : 'bg-yellow-50 border border-yellow-200'}`}>
                <h4 className={`font-semibold mb-2 ${isDarkMode ? 'text-yellow-400' : 'text-yellow-700'}`}>⚠️ Jangan Investasi uang kebutuhan</h4>
                <p className={`text-sm ${textSecondary}`}>Gunakan hanya uang dingin. Sisihkan 20-30% dari penghasilan.</p>
              </div>
              <div className={`p-4 rounded-xl ${isDarkMode ? 'bg-green-900/30 border border-green-700' : 'bg-green-50 border border-green-200'}`}>
                <h4 className={`font-semibold mb-2 ${isDarkMode ? 'text-green-400' : 'text-green-700'}`}>✅ Mulai dari yang kecil</h4>
                <p className={`text-sm ${textSecondary}`}>Tidak perlu modal besar. Mulai dengan Rp 100-500rb.</p>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default MarketPage;
