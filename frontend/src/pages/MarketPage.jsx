import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, Button, Badge, Spinner } from '../components/ui';
import { 
  TrendingUp, TrendingDown, RefreshCw, BarChart3,
  ArrowUpRight, ArrowDownRight, Search, X, ExternalLink,
  ChevronUp, ChevronDown, Play, BookOpen, TrendingBar
} from 'lucide-react';
import { formatNumber } from '../utils/format';
import api from '../services/api';

// Sector colors
const SECTOR_COLORS = {
  'Banking': { bg: 'bg-blue-100', text: 'text-blue-600' },
  'Consumer': { bg: 'bg-green-100', text: 'text-green-600' },
  'Mining': { bg: 'bg-yellow-100', text: 'text-yellow-600' },
  'Property': { bg: 'bg-purple-100', text: 'text-purple-600' },
  'Telecom': { bg: 'bg-indigo-100', text: 'text-indigo-600' },
  'Automotive': { bg: 'bg-red-100', text: 'text-red-600' },
  'Healthcare': { bg: 'bg-pink-100', text: 'text-pink-600' },
  'Cement': { bg: 'bg-gray-100', text: 'text-gray-600' },
  'US Stock': { bg: 'bg-cyan-100', text: 'text-cyan-600' },
};

// TradingView watchlist symbols
const WATCHLIST_SYMBOLS = [
  // Forex
  { symbol: 'FX_IDC:USDIDR', name: 'USD/IDR', type: 'Forex' },
  { symbol: 'FX:EURUSD', name: 'EUR/USD', type: 'Forex' },
  { symbol: 'FX:GBPUSD', name: 'GBP/USD', type: 'Forex' },
  { symbol: 'FX:USDJPY', name: 'USD/JPY', type: 'Forex' },
  // IDX Stocks
  { symbol: 'IDX:BBCA', name: 'BBCA', type: 'IDX' },
  { symbol: 'IDX:BBRI', name: 'BBRI', type: 'IDX' },
  { symbol: 'IDX:BMRI', name: 'BMRI', type: 'IDX' },
  { symbol: 'IDX:TLKM', name: 'TLKM', type: 'IDX' },
  { symbol: 'IDX:ASII', name: 'ASII', type: 'IDX' },
  { symbol: 'IDX:UNVR', name: 'UNVR', type: 'IDX' },
  { symbol: 'IDX:ADRO', name: 'ADRO', type: 'IDX' },
  // US Stocks
  { symbol: 'NASDAQ:AAPL', name: 'AAPL', type: 'US' },
  { symbol: 'NASDAQ:MSFT', name: 'MSFT', type: 'US' },
  { symbol: 'NASDAQ:GOOGL', name: 'GOOGL', type: 'US' },
  { symbol: 'NASDAQ:TSLA', name: 'TSLA', type: 'US' },
  // Crypto
  { symbol: 'BINANCE:BTCUSDT', name: 'BTC', type: 'Crypto' },
  { symbol: 'BINANCE:ETHUSDT', name: 'ETH', type: 'Crypto' },
  // Commodities
  { symbol: 'TVC:GOLD', name: 'GOLD', type: 'Commodity' },
  { symbol: 'TVC:USOIL', name: 'US OIL', type: 'Commodity' },
];

export const MarketPage = () => {
  const [loading, setLoading] = useState(true);
  const [stocks, setStocks] = useState([]);
  const [selectedStock, setSelectedStock] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sectorFilter, setSectorFilter] = useState('All');
  const [lastUpdate, setLastUpdate] = useState(null);
  const [viewMode, setViewMode] = useState('tradingview'); // tradingview, table, learn
  const [selectedSymbol, setSelectedSymbol] = useState('FX_IDC:USDIDR');
  const tvContainerRef = useRef(null);

  // Fetch IDX stocks
  const fetchStocks = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await api.get('/zap/quotes').catch(() => ({ quotes: [] }));
      if (resp?.quotes) {
        const stockData = resp.quotes.map(s => ({
          symbol: s.code,
          name: s.name,
          price: s.price,
          change: s.change,
          changePercent: s.change_percent,
          high: s.high,
          low: s.low,
          volume: s.volume,
          sector: s.sector,
          market: 'IDX',
        }));
        setStocks(stockData);
      }
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Failed to fetch:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStocks();
    const interval = setInterval(fetchStocks, 60000);
    return () => clearInterval(interval);
  }, [fetchStocks]);

  // Initialize TradingView widget
  useEffect(() => {
    if (viewMode !== 'tradingview' || !tvContainerRef.current) return;

    // Clear previous widget
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
      watchlist: WATCHLIST_SYMBOLS.map(s => s.symbol),
    });

    tvContainerRef.current.appendChild(script);
  }, [viewMode, selectedSymbol]);

  // Filter stocks
  const filteredStocks = stocks.filter(s => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      if (!s.symbol?.toLowerCase().includes(term) && !s.name?.toLowerCase().includes(term)) {
        return false;
      }
    }
    if (sectorFilter !== 'All' && s.sector !== sectorFilter) {
      return false;
    }
    return true;
  });

  const sectors = ['All', ...new Set(stocks.map(s => s.sector).filter(Boolean))];

  // Learning resources for beginners
  const learningResources = [
    { 
      title: 'Apa itu Saham?', 
      icon: BookOpen,
      description: 'Memahami dasar-dasar investasi saham',
      content: 'Saham adalah bukti kepemilikan sebagian dari sebuah perusahaan. Ketika Anda membeli saham, Anda menjadi pemiliki perusahaan tersebut.'
    },
    { 
      title: 'Cara Baca Candlestick', 
      icon: TrendingBar,
      description: 'Mengenal pola grafik harga',
      content: 'Candlestick menunjukkan harga Open, High, Low, dan Close dalam periode tertentu. Body hijau = harga naik, merah = harga turun.'
    },
    { 
      title: 'Analisis Teknikal', 
      icon: TrendingUp,
      description: 'Mempelajari indikator dan grafik',
      content: 'Gunakan RSI untuk mengukur overbought/oversold, SMA untuk trend, dan support/resistance untuk titik masuk/keluar.'
    },
    { 
      title: 'Risk Management', 
      icon: TrendingDown,
      description: 'Mengelola risiko investasi',
      content: 'Jangan investasi lebih dari 10-20% dari modal pada satu saham. Selalu pasang stop-loss untuk membatasi kerugian.'
    },
    { 
      title: 'Dollar Cost Averaging', 
      icon: Play,
      description: 'Strategi investasi berkala',
      content: 'Investasi jumlah tetap secara rutin, bukan membeli sekaligus. Ini mengurangi risiko beli di harga tertinggi.'
    },
    { 
      title: 'Broker & Sekuritas', 
      icon: BarChart3,
      description: 'Memilih platform trading',
      content: 'Pilih broker dengan biaya komisi rendah, fitur lengkap, dan terdaftar di OJK. Contoh: Mirae Asset, Trimegah, MNC Sekuritas.'
    },
  ];

  const formatPrice = (price, market) => {
    if (!price) return '-';
    if (market === 'IDX') return `Rp ${formatNumber(price, 'id-ID')}`;
    return `$${formatNumber(price, 'en-US')}`;
  };

  const formatVolume = (vol) => {
    if (!vol) return '-';
    if (vol >= 1000000000) return `${(vol / 1000000000).toFixed(1)}B`;
    if (vol >= 1000000) return `${(vol / 1000000).toFixed(1)}M`;
    if (vol >= 1000) return `${(vol / 1000).toFixed(0)}K`;
    return vol.toString();
  };

  return (
    <div className="p-6 space-y-6 bg-gray-900 min-h-screen text-white">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Market Intelligence</h1>
          <p className="text-gray-400 text-sm">
            {lastUpdate ? `Updated: ${lastUpdate.toLocaleTimeString()}` : 'Loading...'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setViewMode('learn')} className="border-gray-600">
            <BookOpen className="w-4 h-4 mr-2" />
            Belajar
          </Button>
          <Button size="sm" variant="outline" onClick={() => setViewMode('table')} className="border-gray-600">
            <BarChart3 className="w-4 h-4 mr-2" />
            Tabel
          </Button>
          <Button size="sm" variant={viewMode === 'tradingview' ? 'primary' : 'outline'} onClick={() => setViewMode('tradingview')} className="border-gray-600">
            <TrendingUp className="w-4 h-4 mr-2" />
            Chart
          </Button>
          <Button size="sm" variant="outline" onClick={fetchStocks} className="border-gray-600">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* TradingView Widget View */}
      {viewMode === 'tradingview' && (
        <div className="space-y-4">
          {/* Symbol Selector */}
          <Card className="bg-gray-800 border-gray-700 p-4">
            <div className="flex flex-wrap gap-2">
              <span className="text-gray-400 text-sm mr-2">Watchlist:</span>
              {WATCHLIST_SYMBOLS.map(sym => (
                <button
                  key={sym.symbol}
                  onClick={() => setSelectedSymbol(sym.symbol)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                    selectedSymbol === sym.symbol
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {sym.name}
                </button>
              ))}
            </div>
          </Card>

          {/* TradingView Chart */}
          <Card className="bg-gray-800 border-gray-700 overflow-hidden" style={{ height: '600px' }}>
            <div ref={tvContainerRef} className="w-full h-full" />
          </Card>

          {/* IDX Stocks Quick View */}
          <Card className="bg-gray-800 border-gray-700 p-4">
            <h3 className="font-semibold mb-3">Saham IDX Populer</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {filteredStocks.slice(0, 12).map(stock => {
                const isUp = stock.changePercent >= 0;
                return (
                  <button
                    key={stock.symbol}
                    onClick={() => setSelectedSymbol(`IDX:${stock.symbol}`)}
                    className="p-2 rounded bg-gray-700 hover:bg-gray-600 text-left transition"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-sm">{stock.symbol}</span>
                      <span className={`text-xs ${isUp ? 'text-green-400' : 'text-red-400'}`}>
                        {isUp ? '+' : ''}{stock.changePercent?.toFixed(1)}%
                      </span>
                    </div>
                    <div className="text-xs text-gray-400">{formatPrice(stock.price, stock.market)}</div>
                  </button>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* Table View */}
      {viewMode === 'table' && (
        <div className="space-y-4">
          {/* Filters */}
          <Card className="bg-gray-800 border-gray-700 p-4">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Cari saham..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400"
                />
              </div>
              <select
                value={sectorFilter}
                onChange={(e) => setSectorFilter(e.target.value)}
                className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              >
                {sectors.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </Card>

          {/* Table */}
          <Card className="bg-gray-800 border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Saham</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-300">Harga</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-300">Change</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-300">High</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-300">Low</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-300">Volume</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-300">Sektor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {filteredStocks.map(stock => {
                    const isUp = stock.changePercent >= 0;
                    const sectorStyle = SECTOR_COLORS[stock.sector] || SECTOR_COLORS['Banking'];
                    return (
                      <tr key={stock.symbol} className="hover:bg-gray-700 transition">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg ${isUp ? 'bg-green-900' : 'bg-red-900'} flex items-center justify-center`}>
                              {isUp ? <TrendingUp className="w-4 h-4 text-green-400" /> : <TrendingDown className="w-4 h-4 text-red-400" />}
                            </div>
                            <div>
                              <p className="font-semibold">{stock.symbol}</p>
                              <p className="text-xs text-gray-400">{stock.name}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono">{formatPrice(stock.price, stock.market)}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={isUp ? 'text-green-400' : 'text-red-400'}>
                            {isUp ? '+' : ''}{stock.changePercent?.toFixed(2)}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-gray-300">{formatPrice(stock.high, stock.market)}</td>
                        <td className="px-4 py-3 text-right font-mono text-gray-300">{formatPrice(stock.low, stock.market)}</td>
                        <td className="px-4 py-3 text-right font-mono text-gray-300">{formatVolume(stock.volume)}</td>
                        <td className="px-4 py-3 text-center">
                          <Badge className={`${sectorStyle.bg} ${sectorStyle.text}`}>{stock.sector}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Learning View */}
      {viewMode === 'learn' && (
        <div className="space-y-6">
          <Card className="bg-gray-800 border-gray-700 p-6">
            <h2 className="text-xl font-bold mb-2">📚 Panduan Investasi untuk Pemula</h2>
            <p className="text-gray-400">Pelajari dasar-dasar investasi saham dan trading dengan sumber daya interaktif.</p>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {learningResources.map((resource, idx) => {
              const Icon = resource.icon;
              return (
                <Card key={idx} className="bg-gray-800 border-gray-700 p-4 hover:border-blue-500 transition cursor-pointer">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-blue-900 rounded-lg">
                      <Icon className="w-6 h-6 text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold mb-1">{resource.title}</h3>
                      <p className="text-sm text-gray-400 mb-2">{resource.description}</p>
                      <p className="text-sm text-gray-300">{resource.content}</p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Quick Tips */}
          <Card className="bg-gray-800 border-gray-700 p-6">
            <h3 className="font-bold text-lg mb-4">💡 Tips Penting untuk Pemula</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-yellow-900/30 rounded-lg border border-yellow-700">
                <h4 className="font-semibold text-yellow-400 mb-2">⚠️ Jangan investasi uang kebutuhan</h4>
                <p className="text-sm text-gray-300">Gunakan hanya uang dingin (tidak mendesak) untuk investasi. Sisihkan 20-30% dari penghasilan.</p>
              </div>
              <div className="p-4 bg-green-900/30 rounded-lg border border-green-700">
                <h4 className="font-semibold text-green-400 mb-2">✅ Mulai dari yang kecil</h4>
                <p className="text-sm text-gray-300">Tidak perlu punya banyak modal. Mulai dengan Rp 100-500rb dan naikkan seiring pengalaman.</p>
              </div>
              <div className="p-4 bg-blue-900/30 rounded-lg border border-blue-700">
                <h4 className="font-semibold text-blue-400 mb-2">📊 Diversifikasi</h4>
                <p className="text-sm text-gray-300">Jangan taruh semua di satu saham. Sebar ke beberapa sektor untuk mengurangi risiko.</p>
              </div>
              <div className="p-4 bg-purple-900/30 rounded-lg border border-purple-700">
                <h4 className="font-semibold text-purple-400 mb-2">🕐 Sabar</h4>
                <p className="text-sm text-gray-300">Saham butuh waktu untuk bertumbuh. Jangan panik jual saat harga turun sesaat.</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Loading State */}
      {loading && stocks.length === 0 && (
        <div className="flex items-center justify-center h-64">
          <Spinner size="lg" />
          <span className="ml-3 text-gray-400">Memuat data pasar...</span>
        </div>
      )}
    </div>
  );
};

export default MarketPage;
