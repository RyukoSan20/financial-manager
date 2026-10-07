import { useState, useEffect, useCallback } from 'react';
import { 
  TrendingUp, TrendingDown, Globe, Bitcoin, Gem, BarChart3, 
  DollarSign, RefreshCw, Clock, AlertCircle, CheckCircle, XCircle,
  ArrowUpRight, ArrowDownRight, Zap, CreditCard, Landmark
} from 'lucide-react';
import { Card, Button, Badge, Spinner } from '../components/ui';
import { formatNumber, formatCurrency } from '../utils/format';
import api from '../services/api';
import { useTranslation } from '../i18n';

// Tab definitions
const TABS = [
  { id: 'overview', name: 'Overview', icon: BarChart3 },
  { id: 'commodities', name: 'Komoditas', icon: Gem },
  { id: 'stocks', name: 'Saham', icon: TrendingUp },
  { id: 'crypto', name: 'Crypto', icon: Bitcoin },
  { id: 'forex', name: 'Forex', icon: Globe },
  { id: 'rates', name: 'Suku Bunga', icon: Landmark },
];

export const MarketPage = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState({
    api_ninjas: 'checking',
    finnhub: 'checking',
    coingecko: 'checking',
    frankfurter: 'checking',
  });

  const fetchMarketData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await api.get('/market-intel/summary');
      setData(result);
      setLastUpdate(new Date());
      
      // Update connection status
      if (result.connection_status) {
        setConnectionStatus(result.connection_status);
      }
    } catch (err) {
      console.error('Market data fetch error:', err);
      setError('Gagal memuat data pasar. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMarketData();
    
    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchMarketData, 60000);
    return () => clearInterval(interval);
  }, [fetchMarketData]);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'connected': return <CheckCircle className="w-3 h-3 text-green-500" />;
      case 'disconnected': return <XCircle className="w-3 h-3 text-red-500" />;
      default: return <Clock className="w-3 h-3 text-yellow-500" />;
    }
  };

  const getStatusColor = (change) => {
    if (change > 0) return 'text-green-600';
    if (change < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <BarChart3 className="w-7 h-7 text-purple-600" />
                Market Intelligence
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Data pasar real-time dari berbagai sumber
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={fetchMarketData} disabled={loading}>
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          {/* Connection Status */}
          <div className="flex flex-wrap gap-2 mb-4">
            {Object.entries(connectionStatus).map(([key, status]) => (
              <div key={key} className="flex items-center gap-1.5 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-xs">
                {getStatusIcon(status)}
                <span className="capitalize">{key.replace('_', ' ')}:</span>
                <span className={status === 'connected' ? 'text-green-600' : status === 'disconnected' ? 'text-red-600' : 'text-yellow-600'}>
                  {status}
                </span>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
            {TABS.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                    activeTab === tab.id
                      ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-medium'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {loading && !data ? (
          <div className="flex items-center justify-center h-64">
            <Spinner size="lg" />
            <span className="ml-3 text-gray-500">Memuat data pasar...</span>
          </div>
        ) : error ? (
          <Card className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Gagal Memuat Data
            </h3>
            <p className="text-gray-500 mb-4">{error}</p>
            <Button onClick={fetchMarketData}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Coba Lagi
            </Button>
          </Card>
        ) : (
          <>
            {/* Last Update */}
            {lastUpdate && (
              <div className="text-xs text-gray-400 mb-4 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Update terakhir: {lastUpdate.toLocaleTimeString('id-ID')}
              </div>
            )}

            {/* Tab Content */}
            {activeTab === 'overview' && <OverviewTab data={data} getStatusColor={getStatusColor} />}
            {activeTab === 'commodities' && <CommoditiesTab data={data?.commodities} getStatusColor={getStatusColor} />}
            {activeTab === 'stocks' && <StocksTab data={data?.stocks} getStatusColor={getStatusColor} />}
            {activeTab === 'crypto' && <CryptoTab data={data?.crypto} getStatusColor={getStatusColor} />}
            {activeTab === 'forex' && <ForexTab data={data?.forex} getStatusColor={getStatusColor} />}
            {activeTab === 'rates' && <RatesTab data={data?.interest_rates} />}
          </>
        )}
      </div>
    </div>
  );
};

// ============ OVERVIEW TAB ============
const OverviewTab = ({ data, getStatusColor }) => {
  const { t } = useTranslation();
  
  if (!data) return <Spinner />;
  
  const commodities = data.commodities?.commodities || [];
  const stocks = data.stocks?.stocks || [];
  const crypto = data.crypto?.crypto || [];
  const forex = data.forex?.forex || [];
  const indices = data.indices?.indices || [];

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20">
          <div className="flex items-center gap-2 mb-2">
            <Gem className="w-5 h-5 text-yellow-600" />
            <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Komoditas</span>
          </div>
          <p className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">{commodities.length}</p>
          <p className="text-xs text-yellow-600 dark:text-yellow-400">Harga aktual dari API-Ninjas</p>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-medium text-blue-800 dark:text-blue-200">Saham</span>
          </div>
          <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{stocks.length}</p>
          <p className="text-xs text-blue-600 dark:text-blue-400">Real-time dari Finnhub</p>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20">
          <div className="flex items-center gap-2 mb-2">
            <Bitcoin className="w-5 h-5 text-orange-600" />
            <span className="text-sm font-medium text-orange-800 dark:text-orange-200">Crypto</span>
          </div>
          <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">{crypto.length}</p>
          <p className="text-xs text-orange-600 dark:text-orange-400">Harga dari CoinGecko</p>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20">
          <div className="flex items-center gap-2 mb-2">
            <Globe className="w-5 h-5 text-green-600" />
            <span className="text-sm font-medium text-green-800 dark:text-green-200">Forex</span>
          </div>
          <p className="text-2xl font-bold text-green-900 dark:text-green-100">{forex.length}</p>
          <p className="text-xs text-green-600 dark:text-green-400">Kurs dari Frankfurter</p>
        </Card>
      </div>

      {/* Indices */}
      {indices.length > 0 && (
        <Card className="p-4">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-purple-600" />
            Indeks Pasar Utama
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {indices.map((idx, i) => (
              <div key={i} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">{idx.name}</p>
                <p className="text-lg font-bold">{formatNumber(idx.price)}</p>
                <div className={`flex items-center gap-1 text-sm ${getStatusColor(idx.change_percent)}`}>
                  {idx.change_percent >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  <span>{idx.change_percent?.toFixed(2)}%</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Top Commodities */}
      {commodities.length > 0 && (
        <Card className="p-4">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Gem className="w-5 h-5 text-yellow-600" />
            Harga Komoditas
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b dark:border-gray-700">
                  <th className="pb-2">Nama</th>
                  <th className="pb-2 text-right">Harga</th>
                  <th className="pb-2 text-right">Perubahan</th>
                  <th className="pb-2 text-right">Tertinggi 52w</th>
                  <th className="pb-2 text-right">Terendah 52w</th>
                </tr>
              </thead>
              <tbody>
                {commodities.slice(0, 5).map((c, i) => (
                  <tr key={i} className="border-b dark:border-gray-700 last:border-0">
                    <td className="py-3">
                      <p className="font-medium">{c.name}</p>
                      <p className="text-xs text-gray-500">{c.symbol}</p>
                    </td>
                    <td className="py-3 text-right font-medium">
                      ${formatNumber(c.price)}/{c.unit}
                    </td>
                    <td className={`py-3 text-right ${getStatusColor(c.change_24h_percent)}`}>
                      <div className="flex items-center justify-end gap-1">
                        {c.change_24h_percent >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {c.change_24h_percent?.toFixed(2)}%
                      </div>
                    </td>
                    <td className="py-3 text-right text-gray-500">
                      ${formatNumber(c.high_52w)}
                    </td>
                    <td className="py-3 text-right text-gray-500">
                      ${formatNumber(c.low_52w)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Top Crypto */}
      {crypto.length > 0 && (
        <Card className="p-4">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Bitcoin className="w-5 h-5 text-orange-600" />
            Harga Crypto
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {crypto.slice(0, 8).map((coin, i) => (
              <div key={i} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  {coin.image && <img src={coin.image} alt={coin.symbol} className="w-6 h-6 rounded-full" />}
                  <div>
                    <p className="font-bold">{coin.symbol}</p>
                    <p className="text-xs text-gray-500">{coin.name}</p>
                  </div>
                </div>
                <p className="text-lg font-bold">${formatNumber(coin.price)}</p>
                <div className={`flex items-center gap-1 text-sm ${getStatusColor(coin.change_24h_percent)}`}>
                  {coin.change_24h_percent >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {coin.change_24h_percent?.toFixed(2)}%
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

// ============ COMMODITIES TAB ============
const CommoditiesTab = ({ data, getStatusColor }) => {
  if (!data || !data.commodities) return <Spinner />;
  
  const commodities = data.commodities;
  
  return (
    <Card className="p-4">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Gem className="w-5 h-5 text-yellow-600" />
        Harga Komoditas Real-Time
        <Badge variant="success" className="ml-2">Live</Badge>
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left text-xs text-gray-500 uppercase border-b dark:border-gray-700">
              <th className="pb-3">Komoditas</th>
              <th className="pb-3 text-right">Harga</th>
              <th className="pb-3 text-right">Perubahan 24h</th>
              <th className="pb-3 text-right">Tertinggi</th>
              <th className="pb-3 text-right">Terendah</th>
              <th className="pb-3 text-right">52w High</th>
              <th className="pb-3 text-right">52w Low</th>
              <th className="pb-3">Exchange</th>
            </tr>
          </thead>
          <tbody>
            {commodities.map((c, i) => (
              <tr key={i} className="border-b dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800">
                <td className="py-4">
                  <p className="font-semibold">{c.name}</p>
                  <p className="text-xs text-gray-500">{c.symbol} • {c.unit}</p>
                </td>
                <td className="py-4 text-right font-bold text-lg">
                  ${formatNumber(c.price)}
                </td>
                <td className={`py-4 text-right ${getStatusColor(c.change_24h_percent)}`}>
                  <div className="flex items-center justify-end gap-1">
                    {c.change_24h_percent >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    <span className="font-medium">{c.change_24h_percent?.toFixed(2)}%</span>
                  </div>
                  <p className="text-xs">${Math.abs(c.change_24h || 0).toFixed(2)}</p>
                </td>
                <td className="py-4 text-right text-green-600">
                  ${formatNumber(c.high_24h)}
                </td>
                <td className="py-4 text-right text-red-600">
                  ${formatNumber(c.low_24h)}
                </td>
                <td className="py-4 text-right text-gray-500">
                  ${formatNumber(c.high_52w)}
                </td>
                <td className="py-4 text-right text-gray-500">
                  ${formatNumber(c.low_52w)}
                </td>
                <td className="py-4">
                  <Badge variant="outline">{c.exchange || c.source}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 text-xs text-gray-500 flex items-center gap-2">
        <CheckCircle className="w-3 h-3 text-green-500" />
        Data dari API-Ninjas • Update otomatis setiap 60 detik
      </div>
    </Card>
  );
};

// ============ STOCKS TAB ============
const StocksTab = ({ data, getStatusColor }) => {
  if (!data) return <Spinner />;
  
  const stocks = data.stocks || [];
  
  if (stocks.length === 0 && data.error) {
    return (
      <Card className="p-8 text-center">
        <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">Finnhub API Not Configured</h3>
        <p className="text-gray-500 mb-4">{data.error}</p>
        <p className="text-sm text-gray-400">
          Set FINNHUB_API_KEY di Railway environment variables
        </p>
      </Card>
    );
  }
  
  return (
    <Card className="p-4">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-blue-600" />
        Harga Saham Real-Time
        <Badge variant="success" className="ml-2">Live</Badge>
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left text-xs text-gray-500 uppercase border-b dark:border-gray-700">
              <th className="pb-3">Simbol</th>
              <th className="pb-3 text-right">Harga</th>
              <th className="pb-3 text-right">Perubahan</th>
              <th className="pb-3 text-right">Open</th>
              <th className="pb-3 text-right">High</th>
              <th className="pb-3 text-right">Low</th>
              <th className="pb-3 text-right">Prev Close</th>
            </tr>
          </thead>
          <tbody>
            {stocks.map((stock, i) => (
              <tr key={i} className="border-b dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800">
                <td className="py-4">
                  <p className="font-semibold">{stock.symbol}</p>
                  <p className="text-xs text-gray-500">{stock.name}</p>
                </td>
                <td className="py-4 text-right font-bold text-lg">
                  ${formatNumber(stock.price)}
                </td>
                <td className={`py-4 text-right ${getStatusColor(stock.change_percent)}`}>
                  <div className="flex items-center justify-end gap-1">
                    {stock.change_percent >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    <span className="font-medium">{stock.change_percent?.toFixed(2)}%</span>
                  </div>
                  <p className="text-xs">${stock.change?.toFixed(2)}</p>
                </td>
                <td className="py-4 text-right text-gray-600">
                  ${formatNumber(stock.open)}
                </td>
                <td className="py-4 text-right text-green-600">
                  ${formatNumber(stock.high)}
                </td>
                <td className="py-4 text-right text-red-600">
                  ${formatNumber(stock.low)}
                </td>
                <td className="py-4 text-right text-gray-500">
                  ${formatNumber(stock.prev_close)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 text-xs text-gray-500 flex items-center gap-2">
        <CheckCircle className="w-3 h-3 text-green-500" />
        Data dari Finnhub API • US Stocks & IDX (BBCA.JK, BBRI.JK, TLKM.JK)
      </div>
    </Card>
  );
};

// ============ CRYPTO TAB ============
const CryptoTab = ({ data, getStatusColor }) => {
  if (!data || !data.crypto) return <Spinner />;
  
  const crypto = data.crypto;
  
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Bitcoin className="w-5 h-5 text-orange-600" />
          Harga Crypto Real-Time
          <Badge variant="success" className="ml-2">Live</Badge>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {crypto.map((coin, i) => (
            <div key={i} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3 mb-3">
                {coin.image && <img src={coin.image} alt={coin.symbol} className="w-10 h-10 rounded-full" />}
                <div>
                  <p className="font-bold text-lg">{coin.symbol}</p>
                  <p className="text-sm text-gray-500">{coin.name}</p>
                </div>
              </div>
              <p className="text-2xl font-bold mb-2">${formatNumber(coin.price)}</p>
              <div className={`flex items-center gap-2 text-lg ${getStatusColor(coin.change_24h_percent)}`}>
                {coin.change_24h_percent >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                <span className="font-semibold">{coin.change_24h_percent?.toFixed(2)}%</span>
              </div>
              <div className="mt-3 pt-3 border-t dark:border-gray-700 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-gray-500">24h High</p>
                  <p className="font-medium">${formatNumber(coin.high_24h)}</p>
                </div>
                <div>
                  <p className="text-gray-500">24h Low</p>
                  <p className="font-medium">${formatNumber(coin.low_24h)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
      <div className="text-xs text-gray-500 flex items-center gap-2">
        <CheckCircle className="w-3 h-3 text-green-500" />
        Data dari CoinGecko API • Market Cap & Volume 24h
      </div>
    </div>
  );
};

// ============ FOREX TAB ============
const ForexTab = ({ data, getStatusColor }) => {
  if (!data || !data.forex) return <Spinner />;
  
  const forex = data.forex;
  
  return (
    <Card className="p-4">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Globe className="w-5 h-5 text-green-600" />
        Kurs Forex Real-Time
        <Badge variant="success" className="ml-2">Live</Badge>
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left text-xs text-gray-500 uppercase border-b dark:border-gray-700">
              <th className="pb-3">Pasangan</th>
              <th className="pb-3 text-right">Harga</th>
              <th className="pb-3 text-right">Perubahan</th>
              <th className="pb-3 text-right">Harga Sebelumnya</th>
              <th className="pb-3">Sumber</th>
            </tr>
          </thead>
          <tbody>
            {forex.map((pair, i) => (
              <tr key={i} className="border-b dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800">
                <td className="py-4">
                  <p className="font-semibold text-lg">{pair.pair}</p>
                  <p className="text-xs text-gray-500">Base: {pair.base}</p>
                </td>
                <td className="py-4 text-right font-bold text-lg">
                  {formatNumber(pair.price)}
                </td>
                <td className={`py-4 text-right ${getStatusColor(pair.change_percent)}`}>
                  <div className="flex items-center justify-end gap-1">
                    {pair.change_percent >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    <span className="font-medium">{pair.change_percent?.toFixed(2)}%</span>
                  </div>
                  <p className="text-xs">{pair.change > 0 ? '+' : ''}{pair.change?.toFixed(4)}</p>
                </td>
                <td className="py-4 text-right text-gray-500">
                  {formatNumber(pair.prev_price)}
                </td>
                <td className="py-4">
                  <Badge variant="outline">{pair.source}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 text-xs text-gray-500 flex items-center gap-2">
        <CheckCircle className="w-3 h-3 text-green-500" />
        Data dari Frankfurter API • Update setiap 60 detik
      </div>
    </Card>
  );
};

// ============ INTEREST RATES TAB ============
const RatesTab = ({ data }) => {
  if (!data || !data.rates) return <Spinner />;
  
  const rates = data.rates;
  
  return (
    <Card className="p-4">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Landmark className="w-5 h-5 text-purple-600" />
        Suku Bunga Sentral Dunia
        <Badge variant="success" className="ml-2">Live</Badge>
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left text-xs text-gray-500 uppercase border-b dark:border-gray-700">
              <th className="pb-3">Mata Uang</th>
              <th className="pb-3">Bank Sentral</th>
              <th className="pb-3">Negara</th>
              <th className="pb-3 text-right">Suku Bunga (%)</th>
              <th className="pb-3 text-right">Terakhir Diperbarui</th>
            </tr>
          </thead>
          <tbody>
            {rates.map((rate, i) => (
              <tr key={i} className="border-b dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800">
                <td className="py-4">
                  <p className="font-bold text-xl">{rate.currency}</p>
                </td>
                <td className="py-4 text-gray-600 dark:text-gray-400">
                  {rate.bank}
                </td>
                <td className="py-4 text-gray-600 dark:text-gray-400">
                  {rate.country}
                </td>
                <td className="py-4 text-right">
                  <p className="text-2xl font-bold text-purple-600">{rate.rate}%</p>
                </td>
                <td className="py-4 text-right text-gray-500">
                  {rate.last_updated}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 text-xs text-gray-500 flex items-center gap-2">
        <CheckCircle className="w-3 h-3 text-green-500" />
        Data dari API-Ninjas Interest Rate API
      </div>
    </Card>
  );
};

export default MarketPage;
