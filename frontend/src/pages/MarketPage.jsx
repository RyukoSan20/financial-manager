import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, Button, Badge, Spinner } from '../components/ui';
import { 
  TrendingUp, TrendingDown, RefreshCw, BarChart3,
  Search, X, BookOpen, PieChart, Activity, DollarSign,
  ArrowUpRight, ArrowDownRight, Globe, Bitcoin, Gem, Landmark
} from 'lucide-react';
import { formatNumber } from '../utils/format';

export const MarketPage = () => {
  const [loading, setLoading] = useState(true);
  const [marketData, setMarketData] = useState(null);
  const [selectedSymbol, setSelectedSymbol] = useState('FX_IDC:USDIDR');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('realtime'); // realtime, table, learn
  const [activeTab, setActiveTab] = useState('all'); // all, idx, us, crypto, forex
  const tvContainerRef = useRef(null);

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
    const interval = setInterval(fetchMarketData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [fetchMarketData]);

  // Initialize TradingView widget
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
      theme: 'dark',
      timezone: 'Asia/Jakarta',
      backgroundColor: '#1f2937',
      gridColor: 'rgba(46, 46, 46, 0.3)',
      withdateranges: true,
      compareSymbols: [],
      support_host: 'https://www.tradingview.com',
      studies: ['RSI@tv-basicstudies', 'MASimple@tv-basicstudies'],
      autosize: true,
      watchlist: [
        // Forex
        'FX_IDC:USDIDR', 'FX:EURUSD', 'FX:GBPUSD', 'FX:USDJPY',
        // IDX Stocks
        'IDX:BBCA', 'IDX:BBRI', 'IDX:BMRI', 'IDX:TLKM', 'IDX:ASII', 'IDX:UNVR', 'IDX:ADRO', 'IDX:GOTO',
        // US Stocks
        'NASDAQ:AAPL', 'NASDAQ:MSFT', 'NASDAQ:GOOGL', 'NASDAQ:TSLA', 'NASDAQ:NVDA',
        // Crypto
        'BINANCE:BTCUSDT', 'BINANCE:ETHUSDT',
        // Commodities
        'TVC:GOLD', 'TVC:USOIL',
      ],
    });

    tvContainerRef.current.appendChild(script);
  }, [viewMode, selectedSymbol]);

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
      { symbol: 'IDX:ADRO', name: 'ADRO' },
      { symbol: 'IDX:GOTO', name: 'GOTO' },
    ]},
    { group: '🇺🇸 Saham US', symbols: [
      { symbol: 'NASDAQ:AAPL', name: 'AAPL' },
      { symbol: 'NASDAQ:MSFT', name: 'MSFT' },
      { symbol: 'NASDAQ:GOOGL', name: 'GOOGL' },
      { symbol: 'NASDAQ:TSLA', name: 'TSLA' },
      { symbol: 'NASDAQ:NVDA', name: 'NVDA' },
    ]},
    { group: '₿ Crypto', symbols: [
      { symbol: 'BINANCE:BTCUSDT', name: 'BTC' },
      { symbol: 'BINANCE:ETHUSDT', name: 'ETH' },
      { symbol: 'BINANCE:BNBUSDT', name: 'BNB' },
      { symbol: 'BINANCE:SOLUSDT', name: 'SOL' },
    ]},
    { group: '🪙 Komoditas', symbols: [
      { symbol: 'TVC:GOLD', name: 'GOLD' },
      { symbol: 'TVC:USOIL', name: 'OIL' },
      { symbol: 'TVC:SILVER', name: 'SILVER' },
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
        s.name?.toLowerCase().includes(term)
      );
    }
    
    return filtered;
  };

  // Learning content
  const learningContent = [
    {
      title: '📊 Cara Baca Candlestick',
      icon: BarChart3,
      content: 'Candlestick menunjukkan Open, High, Low, Close (OHLC). Body hijau = harga naik, merah = turun. Shadow atas/bawah menunjukkan range harga.',
    },
    {
      title: '📈 Indikator RSI',
      icon: Activity,
      content: 'RSI (Relative Strength Index) mengukur kecepatan perubahan harga. RSI > 70 = overbought (jenuh beli), RSI < 30 = oversold (jenuh jual).',
    },
    {
      title: '💰 Dollar Cost Averaging',
      icon: DollarSign,
      content: 'Strategi investasi rutin dengan jumlah tetap. Contoh: tiap bulan Rp 500rb. Mengurangi risiko beli di harga tertinggi.',
    },
    {
      title: '🎯 Support & Resistance',
      icon: PieChart,
      content: 'Support = level harga где покупатели вступают. Resistance = level где продавцы вступают. Pecah support = trend turun, pecah resistance = trend naik.',
    },
    {
      title: '⚠️ Risk Management',
      icon: TrendingDown,
      content: 'Jangan investasi lebih dari 10-20% modal di satu saham. Pasang stop-loss untuk batasi kerugian maksimal 5-10%.',
    },
    {
      title: '📚 Diversifikasi',
      icon: Globe,
      content: 'Sebar investasi ke berbagai sektor (bank, consumer, mining) dan asset (saham, obligasi, reksadana) untuk kurangi risiko.',
    },
  ];

  if (loading && !marketData) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
        <span className="ml-3 text-gray-500">Memuat data pasar real-time...</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-gray-900 min-h-screen text-white">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Market Intelligence</h1>
          <p className="text-gray-400 text-sm">
            {marketData?.updated ? `Updated: ${new Date(marketData.updated).toLocaleTimeString()}` : 'Loading...'}
            <span className="ml-2 text-green-400">● Real-Time</span>
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant={viewMode === 'learn' ? 'primary' : 'outline'} onClick={() => setViewMode('learn')} className="border-gray-600">
            <BookOpen className="w-4 h-4 mr-2" />
            Belajar
          </Button>
          <Button size="sm" variant={viewMode === 'table' ? 'primary' : 'outline'} onClick={() => setViewMode('table')} className="border-gray-600">
            <BarChart3 className="w-4 h-4 mr-2" />
            Tabel
          </Button>
          <Button size="sm" variant={viewMode === 'realtime' ? 'primary' : 'outline'} onClick={() => setViewMode('realtime')} className="border-gray-600">
            <Activity className="w-4 h-4 mr-2" />
            Chart
          </Button>
          <Button size="sm" variant="outline" onClick={fetchMarketData} className="border-gray-600">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gray-800 border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-900 rounded-lg">
              <BarChart3 className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Saham IDX</p>
              <p className="text-2xl font-bold">{marketData?.idx_stocks?.total || 0}</p>
            </div>
          </div>
        </Card>
        <Card className="bg-gray-800 border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-900 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Saham US</p>
              <p className="text-2xl font-bold">{marketData?.us_stocks?.total || 0}</p>
            </div>
          </div>
        </Card>
        <Card className="bg-gray-800 border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-yellow-900 rounded-lg">
              <Bitcoin className="w-6 h-6 text-yellow-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Crypto</p>
              <p className="text-2xl font-bold">{marketData?.crypto?.total || 0}</p>
            </div>
          </div>
        </Card>
        <Card className="bg-gray-800 border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-900 rounded-lg">
              <Landmark className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Forex</p>
              <p className="text-2xl font-bold">{marketData?.forex?.total || 0}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Realtime Chart View */}
      {viewMode === 'realtime' && (
        <div className="space-y-4">
          {/* Symbol Selector */}
          <Card className="bg-gray-800 border-gray-700 p-4">
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-gray-400 text-sm mr-2">Chart:</span>
              {symbolOptions.map(group => (
                <div key={group.group} className="flex flex-wrap gap-1">
                  <span className="text-xs text-gray-500 w-full">{group.group}</span>
                  {group.symbols.map(s => (
                    <button
                      key={s.symbol}
                      onClick={() => setSelectedSymbol(s.symbol)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                        selectedSymbol === s.symbol
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
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
          <Card className="bg-gray-800 border-gray-700 overflow-hidden" style={{ height: '600px' }}>
            <div ref={tvContainerRef} className="w-full h-full" />
          </Card>

          {/* Market Movers */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Top Gainers */}
            <Card className="bg-gray-800 border-gray-700 p-4">
              <h3 className="font-semibold text-green-400 mb-3 flex items-center gap-2">
                <ArrowUpRight className="w-5 h-5" /> Top Gainers
              </h3>
              <div className="space-y-2">
                {[...getFilteredStocks(marketData?.idx_stocks?.quotes, 'idx')]
                  .filter(s => s.change_percent > 0)
                  .sort((a, b) => b.change_percent - a.change_percent)
                  .slice(0, 5)
                  .map(stock => (
                    <div key={stock.symbol} className="flex justify-between items-center p-2 bg-gray-700 rounded">
                      <span className="font-medium">{stock.symbol}</span>
                      <span className="text-green-400">+{stock.change_percent?.toFixed(2)}%</span>
                    </div>
                  ))}
              </div>
            </Card>

            {/* Top Losers */}
            <Card className="bg-gray-800 border-gray-700 p-4">
              <h3 className="font-semibold text-red-400 mb-3 flex items-center gap-2">
                <ArrowDownRight className="w-5 h-5" /> Top Losers
              </h3>
              <div className="space-y-2">
                {[...getFilteredStocks(marketData?.idx_stocks?.quotes, 'idx')]
                  .filter(s => s.change_percent < 0)
                  .sort((a, b) => a.change_percent - b.change_percent)
                  .slice(0, 5)
                  .map(stock => (
                    <div key={stock.symbol} className="flex justify-between items-center p-2 bg-gray-700 rounded">
                      <span className="font-medium">{stock.symbol}</span>
                      <span className="text-red-400">{stock.change_percent?.toFixed(2)}%</span>
                    </div>
                  ))}
              </div>
            </Card>
          </div>

          {/* Crypto & Forex Quick View */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-gray-800 border-gray-700 p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Bitcoin className="w-5 h-5 text-yellow-400" /> Crypto
              </h3>
              <div className="space-y-2">
                {marketData?.crypto?.quotes?.slice(0, 6).map(coin => (
                  <div key={coin.symbol} className="flex justify-between items-center p-2 bg-gray-700 rounded">
                    <div>
                      <span className="font-medium">{coin.symbol}</span>
                      <span className="text-gray-400 text-sm ml-2">{formatPrice(coin.price, 'USD')}</span>
                    </div>
                    <span className={coin.change_percent_24h >= 0 ? 'text-green-400' : 'text-red-400'}>
                      {coin.change_percent_24h >= 0 ? '+' : ''}{coin.change_percent_24h?.toFixed(2)}%
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="bg-gray-800 border-gray-700 p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Landmark className="w-5 h-5 text-purple-400" /> Forex
              </h3>
              <div className="space-y-2">
                {marketData?.forex?.quotes?.slice(0, 6).map(fx => (
                  <div key={fx.pair} className="flex justify-between items-center p-2 bg-gray-700 rounded">
                    <span className="font-medium">{fx.pair}</span>
                    <span className={fx.change_percent >= 0 ? 'text-green-400' : 'text-red-400'}>
                      {fx.price?.toFixed(4)} ({fx.change_percent >= 0 ? '+' : ''}{fx.change_percent?.toFixed(2)}%)
                    </span>
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
          <Card className="bg-gray-800 border-gray-700 p-4">
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'all', label: 'All' },
                { key: 'idx', label: '🇮🇩 IDX' },
                { key: 'us', label: '🇺🇸 US' },
                { key: 'crypto', label: '₿ Crypto' },
                { key: 'forex', label: '💱 Forex' },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    activeTab === tab.key ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </Card>

          {/* Search */}
          <Card className="bg-gray-800 border-gray-700 p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Cari saham, crypto, forex..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400"
              />
            </div>
          </Card>

          {/* IDX Stocks Table */}
          {activeTab === 'all' || activeTab === 'idx' ? (
            <Card className="bg-gray-800 border-gray-700 overflow-hidden">
              <div className="p-4 border-b border-gray-700">
                <h3 className="font-semibold">🇮🇩 Saham Indonesia (IDX)</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm">Saham</th>
                      <th className="px-4 py-3 text-right text-sm">Harga</th>
                      <th className="px-4 py-3 text-right text-sm">Change</th>
                      <th className="px-4 py-3 text-right text-sm">Open</th>
                      <th className="px-4 py-3 text-right text-sm">High</th>
                      <th className="px-4 py-3 text-right text-sm">Low</th>
                      <th className="px-4 py-3 text-right text-sm">Volume</th>
                      <th className="px-4 py-3 text-center text-sm">Sektor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {getFilteredStocks(marketData?.idx_stocks?.quotes, 'idx').map(stock => (
                      <tr key={stock.symbol} className="hover:bg-gray-700">
                        <td className="px-4 py-3">
                          <div className="font-medium">{stock.symbol}</div>
                          <div className="text-xs text-gray-400">{stock.name}</div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono">{formatPrice(stock.price)}</td>
                        <td className={`px-4 py-3 text-right font-mono ${stock.change_percent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {stock.change_percent >= 0 ? '+' : ''}{stock.change_percent?.toFixed(2)}%
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-gray-300">{formatPrice(stock.open)}</td>
                        <td className="px-4 py-3 text-right font-mono text-gray-300">{formatPrice(stock.high)}</td>
                        <td className="px-4 py-3 text-right font-mono text-gray-300">{formatPrice(stock.low)}</td>
                        <td className="px-4 py-3 text-right font-mono text-gray-300">{formatVolume(stock.volume)}</td>
                        <td className="px-4 py-3 text-center"><Badge>{stock.sector}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : null}

          {/* US Stocks Table */}
          {activeTab === 'all' || activeTab === 'us' ? (
            <Card className="bg-gray-800 border-gray-700 overflow-hidden">
              <div className="p-4 border-b border-gray-700">
                <h3 className="font-semibold">🇺🇸 Saham Amerika (US)</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm">Saham</th>
                      <th className="px-4 py-3 text-right text-sm">Harga</th>
                      <th className="px-4 py-3 text-right text-sm">Change</th>
                      <th className="px-4 py-3 text-right text-sm">Volume</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {getFilteredStocks(marketData?.us_stocks?.quotes, 'us').map(stock => (
                      <tr key={stock.symbol} className="hover:bg-gray-700">
                        <td className="px-4 py-3">
                          <div className="font-medium">{stock.symbol}</div>
                          <div className="text-xs text-gray-400">{stock.name}</div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono">{formatPrice(stock.price, 'USD')}</td>
                        <td className={`px-4 py-3 text-right font-mono ${stock.change_percent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {stock.change_percent >= 0 ? '+' : ''}{stock.change_percent?.toFixed(2)}%
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-gray-300">{formatVolume(stock.volume)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : null}

          {/* Crypto Table */}
          {activeTab === 'all' || activeTab === 'crypto' ? (
            <Card className="bg-gray-800 border-gray-700 overflow-hidden">
              <div className="p-4 border-b border-gray-700">
                <h3 className="font-semibold">₿ Cryptocurrency</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm">Coin</th>
                      <th className="px-4 py-3 text-right text-sm">Harga</th>
                      <th className="px-4 py-3 text-right text-sm">24h Change</th>
                      <th className="px-4 py-3 text-right text-sm">24h Volume</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {getFilteredStocks(marketData?.crypto?.quotes, 'crypto').map(coin => (
                      <tr key={coin.symbol} className="hover:bg-gray-700">
                        <td className="px-4 py-3 font-medium">{coin.symbol}</td>
                        <td className="px-4 py-3 text-right font-mono">{formatPrice(coin.price, 'USD')}</td>
                        <td className={`px-4 py-3 text-right font-mono ${coin.change_percent_24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {coin.change_percent_24h >= 0 ? '+' : ''}{coin.change_percent_24h?.toFixed(2)}%
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-gray-300">${formatVolume(coin.volume_24h)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : null}

          {/* Forex Table */}
          {activeTab === 'all' || activeTab === 'forex' ? (
            <Card className="bg-gray-800 border-gray-700 overflow-hidden">
              <div className="p-4 border-b border-gray-700">
                <h3 className="font-semibold">💱 Forex</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm">Pair</th>
                      <th className="px-4 py-3 text-right text-sm">Harga</th>
                      <th className="px-4 py-3 text-right text-sm">Change</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {getFilteredStocks(marketData?.forex?.quotes, 'forex').map(fx => (
                      <tr key={fx.pair} className="hover:bg-gray-700">
                        <td className="px-4 py-3 font-medium">{fx.pair}</td>
                        <td className="px-4 py-3 text-right font-mono">{fx.price?.toFixed(4)}</td>
                        <td className={`px-4 py-3 text-right font-mono ${fx.change_percent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {fx.change_percent >= 0 ? '+' : ''}{fx.change_percent?.toFixed(2)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : null}
        </div>
      )}

      {/* Learning View */}
      {viewMode === 'learn' && (
        <div className="space-y-6">
          <Card className="bg-gray-800 border-gray-700 p-6">
            <h2 className="text-xl font-bold mb-2">📚 Panduan Trading untuk Pemula</h2>
            <p className="text-gray-400">Pelajari dasar-dasar analisis teknikal dan manajemen risiko.</p>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {learningContent.map((item, idx) => {
              const Icon = item.icon;
              return (
                <Card key={idx} className="bg-gray-800 border-gray-700 p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-blue-900 rounded-lg">
                      <Icon className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1">{item.title}</h3>
                      <p className="text-sm text-gray-400">{item.content}</p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Quick Tips */}
          <Card className="bg-gray-800 border-gray-700 p-6">
            <h3 className="font-bold text-lg mb-4">💡 Tips Penting</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-yellow-900/30 rounded-lg border border-yellow-700">
                <h4 className="font-semibold text-yellow-400 mb-2">⚠️ Jangan Investasi uang kebutuhan</h4>
                <p className="text-sm text-gray-300">Gunakan hanya uang dingin. Sisihkan 20-30% dari penghasilan.</p>
              </div>
              <div className="p-4 bg-green-900/30 rounded-lg border border-green-700">
                <h4 className="font-semibold text-green-400 mb-2">✅ Mulai dari yang kecil</h4>
                <p className="text-sm text-gray-300">Tidak perlu modal besar. Mulai dengan Rp 100-500rb.</p>
              </div>
              <div className="p-4 bg-blue-900/30 rounded-lg border border-blue-700">
                <h4 className="font-semibold text-blue-400 mb-2">📊 Diversifikasi</h4>
                <p className="text-sm text-gray-300">Sebar ke beberapa sektor untuk kurangi risiko.</p>
              </div>
              <div className="p-4 bg-purple-900/30 rounded-lg border border-purple-700">
                <h4 className="font-semibold text-purple-400 mb-2">🕐 Sabar</h4>
                <p className="text-sm text-gray-300">Saham butuh waktu. Jangan panik jual saat turun sesaat.</p>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default MarketPage;
