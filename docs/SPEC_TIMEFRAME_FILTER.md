# Financial Dashboard - Timeframe Filter Specification
## Implementasi Mirip Stockbit untuk Cash Flow Chart

---

## 1. KONSEP UTAMA

### 1.1 Timeframe Options
```
1D  = 1 Day (24 jam terakhir, per jam)
1W  = 1 Week (7 hari, per hari)
1M  = 1 Month (30 hari, per hari)
3M  = 3 Months (90 hari, per minggu)
YTD = Year to Date (awal tahun - sekarang, per bulan)
1Y  = 1 Year (365 hari, per bulan)
3Y  = 3 Years, per bulan
5Y  = 5 Years, per bulan
```

### 1.2 Account Filter
```
Options:
- ALL (default) = Gabungan semua akun
- Akun 1 = Budget xxx
- Akun 2 = Budget xxx
```

### 1.3 Category Mapping

**Expense Categories (Pengeluaran):**
| ID | Name | Icon |
|----|------|------|
| food | Makanan & Minuman | 🍔 |
| transport | Transportasi | 🚗 |
| shopping | Belanja | 🛒 |
| health | Kesehatan | 💊 |
| education | Pendidikan | 📚 |
| entertainment | Hiburan | 🎮 |
| bills | Tagihan & Utilitas | 📄 |
| investment | Investasi & Tabungan | 💰 |
| other_expense | Lainnya | 📦 |

**Income Categories (Pemasukan):**
| ID | Name | Icon |
|----|------|------|
| salary | Gaji | 💵 |
| freelance | Freelance | 💻 |
| investment_income | Investasi | 📈 |
| bonus | Bonus | 🎁 |
| other_income | Lainnya | 📦 |

---

## 2. API STRUCTURE (Backend)

### 2.1 Endpoint
```
GET /api/dashboard/cash-flow
```

### 2.2 Query Parameters
```javascript
{
  timeframe: "1D" | "1W" | "1M" | "3M" | "YTD" | "1Y" | "3Y" | "5Y",
  account_id: number | "all" | null,
  start_date: "YYYY-MM-DD" (optional, untuk custom range),
  end_date: "YYYY-MM-DD" (optional, untuk custom range)
}
```

### 2.3 Response JSON Structure
```json
{
  "status": "success",
  "meta": {
    "timeframe": "3M",
    "account_id": "all",
    "startDate": "2026-07-09",
    "endDate": "2026-10-09",
    "granularity": "weekly",  // hourly | daily | weekly | monthly
    "totalDataPoints": 13,
    "totalIncome": 45000000,
    "totalExpense": 32000000,
    "netSavings": 13000000,
    "averageDailyExpense": 1066666,
    "averageDailyIncome": 1500000
  },
  "series": [
    {
      "timestamp": "2026-07-13",
      "labelX": "13 Jul",
      "labelXShort": "13/7",
      "labelXFull": "Minggu, 13 Juli 2026",
      "granularity": "weekly",
      // Income breakdown
      "totalIncome": 5000000,
      "incomeByCategory": {
        "salary": 4000000,
        "freelance": 1000000
      },
      // Expense breakdown
      "totalExpense": 2500000,
      "expenseByCategory": {
        "food": 800000,
        "transport": 500000,
        "shopping": 400000,
        "bills": 600000,
        "other_expense": 200000
      },
      // Net calculation
      "netSavings": 2500000,
      "runningBalance": 2500000,  // Akumulasi dari awal
      // Flags
      "isPositiveMonth": true,
      "highestExpenseCategory": "food",
      "highestExpenseAmount": 800000
    }
  ],
  "categorySummary": {
    "income": {
      "salary": { "total": 36000000, "percentage": 80 },
      "freelance": { "total": 6000000, "percentage": 13.3 },
      "bonus": { "total": 3000000, "percentage": 6.7 }
    },
    "expense": {
      "food": { "total": 9600000, "percentage": 30 },
      "bills": { "total": 7200000, "percentage": 22.5 },
      "transport": { "total": 6000000, "percentage": 18.75 }
    }
  },
  "chartConfig": {
    "mode": "cash_flow",
    "showArea": true,
    "positiveColor": "#22c55e",
    "negativeColor": "#ef4444",
    "yAxisFormat": "currency",
    "xAxisFormat": "date"
  }
}
```

---

## 3. FRONTEND STRUCTURE

### 3.1 State Management
```javascript
// useCashFlowChart.js - Custom Hook
const useCashFlowChart = () => {
  // Timeframe state
  const [timeframe, setTimeframe] = useState('3M');
  const [granularity, setGranularity] = useState('weekly');
  
  // Account filter
  const [selectedAccount, setSelectedAccount] = useState('all');
  const [accountOptions, setAccountOptions] = useState([]);
  
  // Data state
  const [series, setSeries] = useState([]);
  const [categorySummary, setCategorySummary] = useState({});
  const [meta, setMeta] = useState({});
  
  // Loading & Error
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Zoom level (for X-axis density)
  const [zoomLevel, setZoomLevel] = useState('normal'); // compact | normal | expanded
  
  // Chart ref
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  
  return {
    timeframe, setTimeframe,
    granularity,
    selectedAccount, setSelectedAccount,
    accountOptions,
    series, categorySummary, meta,
    loading, error,
    zoomLevel, setZoomLevel,
    chartRef, chartInstance
  };
};
```

### 3.2 Timeframe Configuration
```javascript
const TIMEFRAME_CONFIG = {
  '1D': {
    label: '1D',
    description: '24 Jam Terakhir',
    days: 1,
    granularity: 'hourly',
    maxLabels: 24,
    xAxisFormat: 'time', // HH:MM
    chartType: 'bar'
  },
  '1W': {
    label: '1W',
    description: '7 Hari Terakhir',
    days: 7,
    granularity: 'daily',
    maxLabels: 7,
    xAxisFormat: 'short_date', // Mon
    chartType: 'bar'
  },
  '1M': {
    label: '1M',
    description: '30 Hari Terakhir',
    days: 30,
    granularity: 'daily',
    maxLabels: 10,
    xAxisFormat: 'date', // 13 Jul
    chartType: 'line'
  },
  '3M': {
    label: '3M',
    description: '3 Bulan Terakhir',
    days: 90,
    granularity: 'weekly',
    maxLabels: 12,
    xAxisFormat: 'date', // 13 Jul
    chartType: 'area'
  },
  'YTD': {
    label: 'YTD',
    description: 'Tahun Ini',
    days: null, // From Jan 1 to today
    granularity: 'monthly',
    maxLabels: 12,
    xAxisFormat: 'month', // Jan, Feb, Mar
    chartType: 'area'
  },
  '1Y': {
    label: '1Y',
    description: '1 Tahun Terakhir',
    days: 365,
    granularity: 'monthly',
    maxLabels: 12,
    xAxisFormat: 'month', // Jan, Feb
    chartType: 'area'
  },
  '3Y': {
    label: '3Y',
    description: '3 Tahun Terakhir',
    days: 365 * 3,
    granularity: 'monthly',
    maxLabels: 36,
    xAxisFormat: 'month_year', // Jan '24
    chartType: 'area'
  },
  '5Y': {
    label: '5Y',
    description: '5 Tahun Terakhir',
    days: 365 * 5,
    granularity: 'monthly',
    maxLabels: 60,
    xAxisFormat: 'month_year', // Jan '22
    chartType: 'area'
  }
};
```

### 3.3 Granularity Determination Logic
```javascript
const determineGranularity = (timeframe, zoomLevel) => {
  const baseGranularity = TIMEFRAME_CONFIG[timeframe]?.granularity;
  
  // Adjust based on zoom level
  if (zoomLevel === 'compact') {
    // More compressed view
    switch (baseGranularity) {
      case 'hourly': return 'daily';
      case 'daily': return 'weekly';
      case 'weekly': return 'monthly';
      default: return 'monthly';
    }
  } else if (zoomLevel === 'expanded') {
    // More detailed view
    switch (baseGranularity) {
      case 'monthly': return 'weekly';
      case 'weekly': return 'daily';
      default: return baseGranularity;
    }
  }
  
  return baseGranularity;
};
```

### 3.4 Date Range Calculation
```javascript
const calculateDateRange = (timeframe) => {
  const today = new Date();
  const endDate = today.toISOString().split('T')[0];
  let startDate;
  
  switch (timeframe) {
    case '1D':
      startDate = new Date(today);
      startDate.setDate(today.getDate() - 1);
      break;
    case '1W':
      startDate = new Date(today);
      startDate.setDate(today.getDate() - 7);
      break;
    case '1M':
      startDate = new Date(today);
      startDate.setDate(today.getDate() - 30);
      break;
    case '3M':
      startDate = new Date(today);
      startDate.setMonth(today.getMonth() - 3);
      break;
    case 'YTD':
      startDate = new Date(today.getFullYear(), 0, 1); // Jan 1
      break;
    case '1Y':
      startDate = new Date(today);
      startDate.setFullYear(today.getFullYear() - 1);
      break;
    case '3Y':
      startDate = new Date(today);
      startDate.setFullYear(today.getFullYear() - 3);
      break;
    case '5Y':
      startDate = new Date(today);
      startDate.setFullYear(today.getFullYear() - 5);
      break;
    default:
      startDate = new Date(today);
      startDate.setMonth(today.getMonth() - 3);
  }
  
  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate
  };
};
```

### 3.5 X-Axis Label Formatter
```javascript
const formatXAxisLabel = (timestamp, granularity, zoomLevel) => {
  const date = new Date(timestamp);
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  
  if (granularity === 'hourly') {
    return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  }
  
  if (granularity === 'daily') {
    if (zoomLevel === 'expanded') {
      return `${dayNames[date.getDay()]}, ${date.getDate()} ${monthNames[date.getMonth()]}`;
    }
    return `${date.getDate()} ${monthNames[date.getMonth()]}`;
  }
  
  if (granularity === 'weekly') {
    return `${date.getDate()} ${monthNames[date.getMonth()]}`;
  }
  
  if (granularity === 'monthly') {
    if (zoomLevel === 'expanded') {
      return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
    }
    return monthNames[date.getMonth()];
  }
  
  return date.toLocaleDateString('id-ID');
};
```

### 3.6 Chart Configuration
```javascript
const getChartConfig = (timeframe, zoomLevel) => {
  const config = TIMEFRAME_CONFIG[timeframe];
  const granularity = determineGranularity(timeframe, zoomLevel);
  
  return {
    chartType: granularity === 'monthly' ? 'area' : 
               granularity === 'weekly' ? 'area' : 'bar',
    
    series: [
      {
        name: 'Pemasukan',
        dataKey: 'totalIncome',
        color: '#22c55e', // green
        type: 'column',
        yAxisId: 'left'
      },
      {
        name: 'Pengeluaran',
        dataKey: 'totalExpense',
        color: '#ef4444', // red
        type: 'column',
        yAxisId: 'left'
      },
      {
        name: 'Tabungan',
        dataKey: 'netSavings',
        color: '#3b82f6', // blue
        type: granularity === 'monthly' ? 'area' : 'line',
        yAxisId: 'right'
      }
    ],
    
    xAxis: {
      dataKey: 'labelX',
      tickFormatter: (value) => value,
      tickCount: config.maxLabels,
      interval: 'preserveStartEnd'
    },
    
    yAxis: [
      {
        id: 'left',
        orientation: 'left',
        tickFormatter: (value) => formatCurrency(value, 'short'),
        label: 'Rp'
      },
      {
        id: 'right',
        orientation: 'right',
        tickFormatter: (value) => formatCurrency(value, 'short'),
        label: 'Tabungan'
      }
    ],
    
    tooltip: {
      formatter: (value, name) => [formatCurrency(value), name],
      labelFormatter: (label) => label
    },
    
    zoom: {
      enabled: true,
      type: 'x'
    }
  };
};
```

---

## 4. UI COMPONENTS

### 4.1 TimeframeSelector Component
```jsx
const TimeframeSelector = ({ 
  value, 
  onChange, 
  disabled 
}) => {
  return (
    <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
      {Object.entries(TIMEFRAME_CONFIG).map(([key, config]) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          disabled={disabled}
          className={`
            px-3 py-1.5 text-sm font-medium rounded-md transition-all
            ${value === key 
              ? 'bg-blue-600 text-white shadow-sm' 
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
          title={config.description}
        >
          {config.label}
        </button>
      ))}
    </div>
  );
};
```

### 4.2 AccountFilter Component
```jsx
const AccountFilter = ({
  value,
  onChange,
  accounts,
  disabled
}) => {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={`
        px-3 py-1.5 text-sm rounded-lg border
        bg-white dark:bg-gray-800
        border-gray-300 dark:border-gray-600
        text-gray-900 dark:text-white
        focus:ring-2 focus:ring-blue-500
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      <option value="all">Semua Akun</option>
      {accounts.map(account => (
        <option key={account.id} value={account.id}>
          {account.name} (Budget {formatCurrency(account.budget)})
        </option>
      ))}
    </select>
  );
};
```

### 4.3 CashFlowChart Component
```jsx
const CashFlowChart = ({
  data,
  timeframe,
  zoomLevel,
  onZoomChange,
  loading
}) => {
  const chartConfig = getChartConfig(timeframe, zoomLevel);
  const chartRef = useRef(null);
  
  // Handle zoom
  const handleZoom = (type) => {
    const levels = ['compact', 'normal', 'expanded'];
    const currentIndex = levels.indexOf(zoomLevel);
    
    if (type === 'in' && currentIndex < levels.length - 1) {
      onZoomChange(levels[currentIndex + 1]);
    } else if (type === 'out' && currentIndex > 0) {
      onZoomChange(levels[currentIndex - 1]);
    }
  };
  
  return (
    <div className="relative">
      {/* Chart Controls */}
      <div className="absolute top-2 right-2 z-10 flex gap-2">
        <button
          onClick={() => handleZoom('out')}
          className="p-2 rounded bg-white dark:bg-gray-800 shadow hover:bg-gray-100"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={() => handleZoom('in')}
          className="p-2 rounded bg-white dark:bg-gray-800 shadow hover:bg-gray-100"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
      </div>
      
      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-white/50 dark:bg-gray-900/50 flex items-center justify-center z-20">
          <Spinner />
        </div>
      )}
      
      {/* Chart */}
      <ResponsiveContainer width="100%" height={400}>
        <ComposedChart data={data}>
          {/* Grid */}
          <CartesianGrid strokeDasharray="3 3" />
          
          {/* X-Axis */}
          <XAxis 
            dataKey="labelX"
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => value}
          />
          
          {/* Y-Axis */}
          <YAxis 
            yAxisId="left"
            tickFormatter={(value) => formatCurrency(value, 'short')}
          />
          <YAxis 
            yAxisId="right" 
            orientation="right"
            tickFormatter={(value) => formatCurrency(value, 'short')}
          />
          
          {/* Tooltip */}
          <Tooltip 
            formatter={(value, name) => [formatCurrency(value), name]}
            labelFormatter={(label) => label}
            contentStyle={{
              backgroundColor: 'var(--tooltip-bg)',
              border: '1px solid var(--tooltip-border)'
            }}
          />
          
          {/* Bars */}
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
          
          {/* Line/Area for Savings */}
          {chartConfig.chartType === 'area' ? (
            <Area
              yAxisId="right"
              type="monotone"
              dataKey="netSavings"
              stroke="#3b82f6"
              fill="#3b82f680"
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
    </div>
  );
};
```

### 4.4 CategoryBreakdown Component
```jsx
const CategoryBreakdown = ({ 
  categorySummary, 
  type // 'income' | 'expense'
}) => {
  const categories = categorySummary[type] || {};
  const total = Object.values(categories).reduce((sum, cat) => sum + cat.total, 0);
  
  const categoryColors = {
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
    other_expense: '#6b7280'
  };
  
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400">
        {type === 'income' ? 'Rincian Pemasukan' : 'Rincian Pengeluaran'}
      </h4>
      
      {Object.entries(categories).map(([key, data]) => (
        <div key={key} className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full" 
               style={{ backgroundColor: categoryColors[key] }} />
          <div className="flex-1">
            <div className="flex justify-between text-sm">
              <span className="capitalize">{key.replace('_', ' ')}</span>
              <span>{formatCurrency(data.total)}</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-1">
              <div
                className="h-1.5 rounded-full"
                style={{ 
                  width: `${data.percentage}%`,
                  backgroundColor: categoryColors[key]
                }}
              />
            </div>
          </div>
          <span className="text-xs text-gray-500 w-12 text-right">
            {data.percentage.toFixed(1)}%
          </span>
        </div>
      ))}
    </div>
  );
};
```

---

## 5. IMPLEMENTATION WORKFLOW

### 5.1 Data Fetching Flow
```javascript
// 1. User selects timeframe
const handleTimeframeChange = (newTimeframe) => {
  setTimeframe(newTimeframe);
  // Granularity will auto-determine
  setGranularity(TIMEFRAME_CONFIG[newTimeframe].granularity);
};

// 2. Trigger API call (debounced)
useEffect(() => {
  const fetchData = async () => {
    setLoading(true);
    try {
      const { startDate, endDate } = calculateDateRange(timeframe);
      const response = await api.dashboard.cashFlow({
        timeframe,
        account_id: selectedAccount,
        start_date: startDate,
        end_date: endDate
      });
      
      setSeries(response.series);
      setCategorySummary(response.categorySummary);
      setMeta(response.meta);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };
  
  // Debounce to prevent too many API calls
  const debounceTimer = setTimeout(fetchData, 300);
  
  return () => clearTimeout(debounceTimer);
}, [timeframe, selectedAccount]);
```

### 5.2 Chart Re-render on Data Change
```javascript
useEffect(() => {
  if (series.length > 0 && chartRef.current) {
    // Update chart with new data
    chartInstance.current?.updateOptions({
      series: [
        { name: 'Pemasukan', data: series.map(s => s.totalIncome) },
        { name: 'Pengeluaran', data: series.map(s => s.totalExpense) },
        { name: 'Tabungan', data: series.map(s => s.netSavings) }
      ],
      xaxis: {
        categories: series.map(s => s.labelX)
      }
    });
  }
}, [series]);
```

---

## 6. SUMMARY STATISTICS

### 6.1 Summary Cards
```jsx
const CashFlowSummary = ({ meta }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <SummaryCard
        title="Total Pemasukan"
        value={meta.totalIncome}
        icon={TrendingUp}
        color="green"
        trend={calculateTrend(meta.totalIncome)}
      />
      
      <SummaryCard
        title="Total Pengeluaran"
        value={meta.totalExpense}
        icon={TrendingDown}
        color="red"
        trend={calculateTrend(meta.totalExpense)}
      />
      
      <SummaryCard
        title="Tabungan Bersih"
        value={meta.netSavings}
        icon={PiggyBank}
        color={meta.netSavings >= 0 ? 'blue' : 'red'}
        trend={calculateTrend(meta.netSavings)}
      />
      
      <SummaryCard
        title="Rata-rata Harian"
        value={meta.averageDailyExpense}
        icon={Calendar}
        color="yellow"
        label="Pengeluaran"
      />
    </div>
  );
};
```

---

## 7. DEPLOYMENT CHECKLIST

- [ ] Backend: Update `/api/dashboard/cash-flow` endpoint
- [ ] Backend: Add granularity aggregation logic
- [ ] Backend: Add account filter support
- [ ] Backend: Add category breakdown per period
- [ ] Frontend: Install Recharts or similar
- [ ] Frontend: Implement useCashFlowChart hook
- [ ] Frontend: Create TimeframeSelector component
- [ ] Frontend: Create AccountFilter component
- [ ] Frontend: Create CashFlowChart component
- [ ] Frontend: Create CategoryBreakdown component
- [ ] Frontend: Wire up all components in Dashboard
- [ ] Testing: All 8 timeframe options
- [ ] Testing: Account filter switching
- [ ] Testing: Zoom functionality
- [ ] Testing: Dark mode compatibility
