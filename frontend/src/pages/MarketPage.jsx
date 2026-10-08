import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, Button, Badge, Spinner } from '../components/ui';
import { 
  TrendingUp, TrendingDown, RefreshCw, Clock, BarChart3,
  ArrowUpRight, ArrowDownRight, DollarSign, Activity,
  ChevronUp, ChevronDown, Search, Filter, Star, X
} from 'lucide-react';
import { formatNumber } from '../utils/format';
import api from '../services/api';

// Sector icons/colors
const SECTOR_COLORS = {
  'Banking': { bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-200' },
  'Consumer': { bg: 'bg-green-100', text: 'text-green-600', border: 'border-green-200' },
  'Mining': { bg: 'bg-yellow-100', text: 'text-yellow-600', border: 'border-yellow-200' },
  'Property': { bg: 'bg-purple-100', text: 'text-purple-600', border: 'border-purple-200' },
  'Telecom': { bg: 'bg-indigo-100', text: 'text-indigo-600', border: 'border-indigo-200' },
  'Automotive': { bg: 'bg-red-100', text: 'text-red-600', border: 'border-red-200' },
  'Healthcare': { bg: 'bg-pink-100', text: 'text-pink-600', border: 'border-pink-200' },
  'Cement': { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200' },
};

export const MarketPage = () => {
  const [loading, setLoading] = useState(true);
  const [stocks, setStocks] = useState([]);
  const [filteredStocks, setFilteredStocks] = useState([]);
  const [selectedStock, setSelectedStock] = useState(null);
  const [stockDetail, setStockDetail] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sectorFilter, setSectorFilter] = useState('All');
  const [sortBy, setSortBy] = useState('sector');
  const [sortOrder, setSortOrder] = useState('asc');
  const [lastUpdate, setLastUpdate] = useState(null);
  const [viewMode, setViewMode] = useState('table'); // table, cards, chart
  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);

  // Fetch all stocks
  const fetchStocks = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch IDX stocks and US stocks in parallel
      const [idxStocks, usStocks, cryptoData, forexData] = await Promise.allSettled([
        api.get('/zap/quotes').catch(() => ({ quotes: [] })),
        api.get('/intel/stocks').catch(() => ({ stocks: [] })),
        api.get('/intel/crypto').catch(() => ({ crypto: [] })),
        api.get('/intel/forex').catch(() => ({ forex: [] })),
      ]);

      const allStocks = [];
      
      // Add IDX stocks
      if (idxStocks.status === 'fulfilled' && idxStocks.value?.quotes) {
        for (const stock of idxStocks.value.quotes) {
          allStocks.push({
            ...stock,
            market: 'IDX',
            symbol: stock.code,
            price: stock.price,
            change: stock.change,
            changePercent: stock.change_percent,
            high: stock.high,
            low: stock.low,
            volume: stock.volume,
            sector: stock.sector,
          });
        }
      }

      // Add US stocks
      if (usStocks.status === 'fulfilled' && usStocks.value?.stocks) {
        for (const stock of usStocks.value.stocks) {
          allStocks.push({
            symbol: stock.symbol,
            name: stock.name,
            price: stock.price,
            change: stock.change,
            changePercent: stock.change_percent,
            high: stock.high,
            low: stock.low,
            volume: 0,
            sector: 'US Stock',
            market: 'US',
          });
        }
      }

      setStocks(allStocks);
      setFilteredStocks(allStocks);
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Failed to fetch market data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch single stock detail with candles
  const fetchStockDetail = useCallback(async (symbol) => {
    if (!symbol) return;
    
    try {
      const candlesResp = await api.get(`/zap/candles/${symbol}?interval=1D&range=3mo`);
      const indicatorsResp = await api.get(`/zap/indicators/${symbol}`).catch(() => null);
      
      setStockDetail({
        candles: candlesResp.candles || [],
        indicators: indicatorsResp?.indicators || [],
        latest: indicatorsResp?.latest || {},
      });
      
      // Draw chart after data loads
      setTimeout(() => drawChart(symbol), 100);
    } catch (err) {
      console.error('Failed to fetch stock detail:', err);
    }
  }, []);

  // Draw TradingView-style chart
  const drawChart = useCallback(async (symbol) => {
    if (!chartRef.current || !stockDetail?.candles?.length) return;
    
    try {
      const L = window.lightweightCharts;
      if (!L) {
        // Load library dynamically
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/lightweight-charts@4.1.0/dist/lightweight-charts.standalone.production.js';
        script.onload = () => initChart(symbol);
        document.head.appendChild(script);
      } else {
        initChart(symbol);
      }
    } catch (err) {
      console.error('Chart error:', err);
    }
  }, [stockDetail]);

  const initChart = (symbol) => {
    if (!chartRef.current || !stockDetail?.candles?.length) return;
    const L = window.lightweightCharts;
    if (!L) return;

    // Clear previous chart
    if (chartInstanceRef.current) {
      chartInstanceRef.current.remove();
    }

    const chart = L.createChart(chartRef.current, {
      width: chartRef.current.clientWidth,
      height: 400,
      layout: {
        background: { type: 'solid', color: '#1f2937' },
        textColor: '#9ca3af',
      },
      grid: {
        vertLines: { color: '#374151' },
        horzLines: { color: '#374151' },
      },
      crosshair: {
        mode: L.CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: '#374151',
      },
      timeScale: {
        borderColor: '#374151',
        timeVisible: true,
      },
    });

    // Candlestick series
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    const candleData = stockDetail.candles.map(c => ({
      time: c.time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    candleSeries.setData(candleData);
    chart.timeScale().fitContent();

    // Volume histogram
    const volumeSeries = chart.addHistogramSeries({
      color: '#60a5fa',
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    const volumeData = stockDetail.candles.map(c => ({
      time: c.time,
      value: c.volume,
      color: c.close >= c.open ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)',
    }));

    volumeSeries.setData(volumeData);

    chartInstanceRef.current = chart;

    // Resize handler
    const handleResize = () => {
      if (chartRef.current && chartInstanceRef.current) {
        chartInstanceRef.current.applyOptions({ width: chartRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);
  };

  // Filter and sort stocks
  useEffect(() => {
    let filtered = [...stocks];

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(s =>
        s.symbol?.toLowerCase().includes(term) ||
        s.name?.toLowerCase().includes(term) ||
        s.sector?.toLowerCase().includes(term)
      );
    }

    // Sector filter
    if (sectorFilter !== 'All') {
      filtered = filtered.filter(s => s.sector === sectorFilter);
    }

    // Sort
    filtered.sort((a, b) => {
      let aVal, bVal;
      if (sortBy === 'price') { aVal = a.price; bVal = b.price; }
      else if (sortBy === 'change') { aVal = a.changePercent; bVal = b.changePercent; }
      else if (sortBy === 'volume') { aVal = a.volume || 0; bVal = b.volume || 0; }
      else if (sortBy === 'sector') { aVal = a.sector; bVal = b.sector; }
      else { aVal = a.symbol; bVal = b.symbol; }

      if (typeof aVal === 'string') {
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });

    setFilteredStocks(filtered);
  }, [stocks, searchTerm, sectorFilter, sortBy, sortOrder]);

  // Initial fetch
  useEffect(() => {
    fetchStocks();
    const interval = setInterval(fetchStocks, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [fetchStocks]);

  // Fetch detail when stock selected
  useEffect(() => {
    if (selectedStock) {
      fetchStockDetail(selectedStock.symbol);
    }
  }, [selectedStock, fetchStockDetail]);

  // Get unique sectors
  const sectors = ['All', ...new Set(stocks.map(s => s.sector).filter(Boolean))];

  // Format price with currency
  const formatPrice = (price, market) => {
    if (!price) return '-';
    if (market === 'IDX') {
      return `Rp ${formatNumber(price, 'id-ID')}`;
    }
    return `$${formatNumber(price, 'en-US')}`;
  };

  // Format volume
  const formatVolume = (vol) => {
    if (!vol) return '-';
    if (vol >= 1000000000) return `${(vol / 1000000000).toFixed(2)}B`;
    if (vol >= 1000000) return `${(vol / 1000000).toFixed(1)}M`;
    if (vol >= 1000) return `${(vol / 1000).toFixed(1)}K`;
    return vol.toString();
  };

  if (loading && stocks.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
        <span className="ml-3 text-gray-500">Memuat data pasar...</span>
      </div>
    );
  }

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
          <Button size="sm" variant="outline" onClick={fetchStocks} className="border-gray-600">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gray-800 border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <Activity className="w-8 h-8 text-blue-400" />
            <div>
              <p className="text-gray-400 text-sm">Total Saham</p>
              <p className="text-2xl font-bold">{stocks.length}</p>
            </div>
          </div>
        </Card>
        <Card className="bg-gray-800 border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-green-400" />
            <div>
              <p className="text-gray-400 text-sm">Naik</p>
              <p className="text-2xl font-bold text-green-400">
                {stocks.filter(s => s.changePercent > 0).length}
              </p>
            </div>
          </div>
        </Card>
        <Card className="bg-gray-800 border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <TrendingDown className="w-8 h-8 text-red-400" />
            <div>
              <p className="text-gray-400 text-sm">Turun</p>
              <p className="text-2xl font-bold text-red-400">
                {stocks.filter(s => s.changePercent < 0).length}
              </p>
            </div>
          </div>
        </Card>
        <Card className="bg-gray-800 border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-purple-400" />
            <div>
              <p className="text-gray-400 text-sm">Net Change</p>
              <p className="text-2xl font-bold">
                {stocks.length > 0 ? (
                  stocks.filter(s => s.changePercent > 0).length >= stocks.filter(s => s.changePercent < 0).length 
                    ? <span className="text-green-400">+{stocks.filter(s => s.changePercent > 0).length}</span>
                    : <span className="text-red-400">-{stocks.filter(s => s.changePercent < 0).length}</span>
                ) : '-'}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-gray-800 border-gray-700 p-4">
        <div className="flex flex-wrap gap-4 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Cari saham..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Sector Filter */}
          <select
            value={sectorFilter}
            onChange={(e) => setSectorFilter(e.target.value)}
            className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
          >
            {sectors.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
          >
            <option value="symbol">Simbol</option>
            <option value="sector">Sektor</option>
            <option value="price">Harga</option>
            <option value="change">Perubahan</option>
            <option value="volume">Volume</option>
          </select>

          <Button 
            size="sm" 
            variant="ghost"
            onClick={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')}
            className="text-gray-400"
          >
            {sortOrder === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>
      </Card>

      {/* Stock Table */}
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
              {filteredStocks.map((stock) => {
                const isUp = stock.changePercent >= 0;
                const sectorStyle = SECTOR_COLORS[stock.sector] || SECTOR_COLORS['Banking'];
                
                return (
                  <tr 
                    key={stock.symbol}
                    className="hover:bg-gray-700 cursor-pointer transition"
                    onClick={() => setSelectedStock(stock)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg ${isUp ? 'bg-green-900' : 'bg-red-900'} flex items-center justify-center`}>
                          {isUp ? (
                            <TrendingUp className="w-5 h-5 text-green-400" />
                          ) : (
                            <TrendingDown className="w-5 h-5 text-red-400" />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-white">{stock.symbol}</p>
                          <p className="text-xs text-gray-400">{stock.name || stock.sector}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-white">
                      {formatPrice(stock.price, stock.market)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className={`flex items-center justify-end gap-1 ${isUp ? 'text-green-400' : 'text-red-400'}`}>
                        {isUp ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                        <span className="font-mono">{isUp ? '+' : ''}{stock.changePercent?.toFixed(2)}%</span>
                      </div>
                      <p className={`text-xs text-right ${isUp ? 'text-green-500' : 'text-red-500'}`}>
                        {isUp ? '+' : ''}{stock.change?.toFixed(2)}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-300">
                      {formatPrice(stock.high, stock.market)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-300">
                      {formatPrice(stock.low, stock.market)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-300">
                      {formatVolume(stock.volume)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge className={`${sectorStyle.bg} ${sectorStyle.text}`}>
                        {stock.sector}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredStocks.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            Tidak ada saham yang cocok dengan filter
          </div>
        )}
      </Card>

      {/* Stock Detail Modal */}
      {selectedStock && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-gray-700 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold">{selectedStock.symbol}</h2>
                <p className="text-gray-400 text-sm">{selectedStock.name}</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-2xl font-bold">{formatPrice(selectedStock.price, selectedStock.market)}</p>
                  <p className={selectedStock.changePercent >= 0 ? 'text-green-400' : 'text-red-400'}>
                    {selectedStock.changePercent >= 0 ? '+' : ''}{selectedStock.changePercent?.toFixed(2)}%
                  </p>
                </div>
                <button onClick={() => setSelectedStock(null)} className="text-gray-400 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Chart */}
            <div className="p-4">
              <div ref={chartRef} className="w-full h-[400px]" />
            </div>

            {/* Technical Indicators */}
            {stockDetail?.latest && (
              <div className="p-4 border-t border-gray-700 grid grid-cols-5 gap-4">
                <div className="text-center">
                  <p className="text-gray-400 text-xs">SMA 20</p>
                  <p className="font-mono text-white">
                    {stockDetail.latest.sma20?.toFixed(2) || '-'}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-gray-400 text-xs">SMA 50</p>
                  <p className="font-mono text-white">
                    {stockDetail.latest.sma50?.toFixed(2) || '-'}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-gray-400 text-xs">SMA 200</p>
                  <p className="font-mono text-white">
                    {stockDetail.latest.sma200?.toFixed(2) || '-'}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-gray-400 text-xs">EMA 20</p>
                  <p className="font-mono text-white">
                    {stockDetail.latest.ema20?.toFixed(2) || '-'}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-gray-400 text-xs">RSI 14</p>
                  <p className={`font-mono ${
                    stockDetail.latest.rsi14 > 70 ? 'text-red-400' : 
                    stockDetail.latest.rsi14 < 30 ? 'text-green-400' : 'text-white'
                  }`}>
                    {stockDetail.latest.rsi14?.toFixed(2) || '-'}
                  </p>
                </div>
              </div>
            )}

            {/* Details */}
            <div className="p-4 border-t border-gray-700">
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-gray-400">Open</p>
                  <p className="font-mono">{formatPrice(selectedStock.open, selectedStock.market)}</p>
                </div>
                <div>
                  <p className="text-gray-400">High</p>
                  <p className="font-mono">{formatPrice(selectedStock.high, selectedStock.market)}</p>
                </div>
                <div>
                  <p className="text-gray-400">Low</p>
                  <p className="font-mono">{formatPrice(selectedStock.low, selectedStock.market)}</p>
                </div>
                <div>
                  <p className="text-gray-400">Volume</p>
                  <p className="font-mono">{formatVolume(selectedStock.volume)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketPage;
