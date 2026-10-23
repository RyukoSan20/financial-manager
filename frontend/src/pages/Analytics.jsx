import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardHeader, CardBody, Badge, Spinner, Select, Button, ProgressBar } from '../components/ui';
import api from '../services/api';
import {
  TrendingUp, TrendingDown, PieChart, BarChart3, Wallet, Target,
  Calendar, GripVertical, Eye, EyeOff, Settings2, RotateCcw, Info,
  Sparkles, Activity, Layers, ChevronRight
} from 'lucide-react';
import { formatCurrency, formatPercent } from '../utils/format';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RePieChart, Pie, Cell,
  BarChart, Bar, Legend, ReferenceLine
} from 'recharts';

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

const PREFS_KEY = 'fm.analytics.layout.v2';

/**
 * Every widget explains what it is for. Before the redesign the page was a
 * wall of charts with no indication of why the user should care, so each
 * block carries a one-line "what this answers" hint.
 */
const WIDGETS = {
  health: {
    id: 'health',
    label: 'Skor Kesehatan Keuangan',
    hint: 'Ringkasan kondisi keuangan Anda dalam satu angka: tabungan, dana darurat, utang, dan progres target.',
    icon: Activity,
    minWidth: 'full',
  },
  cashflow: {
    id: 'cashflow',
    label: 'Arus Kas Bulanan',
    hint: 'Menunjukkan apakah uang Anda bertambah atau berkurang tiap bulan, dan trennya ke mana.',
    icon: TrendingUp,
    minWidth: 'full',
  },
  categories: {
    id: 'categories',
    label: 'Pengeluaran per Kategori',
    hint: 'Ke mana saja uang Anda pergi. Besaran persentase menunjukkan kategori mana yang paling besar dan mana yang paling kecil.',
    icon: PieChart,
    minWidth: 'half',
  },
  budget: {
    id: 'budget',
    label: 'Anggaran vs Realisasi',
    hint: 'Membandingkan jatah budget dengan pengeluaran nyata, jadi Anda tahu mana yang hampir habis.',
    icon: Target,
    minWidth: 'half',
  },
  topexpenses: {
    id: 'topexpenses',
    label: 'Pengeluaran Terbesar',
    hint: 'Transaksi pengeluaran terbesar yang paling banyak memakan saldo Anda.',
    icon: Layers,
    minWidth: 'half',
  },
  patterns: {
    id: 'patterns',
    label: 'Pola Pengeluaran',
    hint: 'Kapan Anda cenderung belanja: hari apa dalam seminggu dan tanggal berapa dalam bulan.',
    icon: Calendar,
    minWidth: 'half',
  },
  recurring: {
    id: 'recurring',
    label: 'Biaya Berulang',
    hint: 'Tagihan rutin per bulan. Berguna untuk memotong biaya yang tidak lagi Anda perlukan.',
    icon: RotateCcw,
    minWidth: 'half',
  },
  monthly: {
    id: 'monthly',
    label: 'Bulan ke Bulan',
    hint: 'Tabel perbandingan tiap bulan beserta perubahan percentualnya.',
    icon: BarChart3,
    minWidth: 'full',
  },
};

const DEFAULT_LAYOUT = ['health', 'cashflow', 'categories', 'budget', 'topexpenses', 'patterns', 'recurring', 'monthly'];

const loadPrefs = () => {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { order: DEFAULT_LAYOUT, hidden: [], period: '6' };
    const parsed = JSON.parse(raw);
    const order = Array.isArray(parsed.order)
      ? parsed.order.filter((id) => WIDGETS[id])
      : DEFAULT_LAYOUT;
    // Any widget added after the preference was saved still has to show up.
    const missing = DEFAULT_LAYOUT.filter((id) => !order.includes(id));
    return {
      order: [...order, ...missing],
      hidden: Array.isArray(parsed.hidden) ? parsed.hidden.filter((id) => WIDGETS[id]) : [],
      period: parsed.period || '6',
    };
  } catch {
    return { order: DEFAULT_LAYOUT, hidden: [], period: '6' };
  }
};

const savePrefs = (prefs) => {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* storage unavailable - the page still works, it just forgets */
  }
};

export const Analytics = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [prefs, setPrefs] = useState(loadPrefs);
  const [customizing, setCustomizing] = useState(false);
  const [explain, setExplain] = useState({});

  const [health, setHealth] = useState(null);
  const [cashFlow, setCashFlow] = useState(null);
  const [expenseBreakdown, setExpenseBreakdown] = useState(null);
  const [budgetComparison, setBudgetComparison] = useState(null);
  const [monthlyComparison, setMonthlyComparison] = useState(null);
  const [topExpenses, setTopExpenses] = useState(null);
  const [patterns, setPatterns] = useState(null);
  const [recurring, setRecurring] = useState(null);

  const period = prefs.period;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const results = await Promise.allSettled([
        api.request('/analytics/financial-health'),
        api.request(`/analytics/cash-flow-trend?months=${period}`),
        api.request('/analytics/expense-breakdown?period=monthly'),
        api.request('/analytics/budget-vs-actual'),
        api.request(`/analytics/monthly-comparison?months=${Math.min(6, Math.max(2, Number(period) || 3))}`),
        api.request('/analytics/top-expenses?limit=8'),
        api.request('/analytics/spending-patterns'),
        api.request('/analytics/recurring-expenses'),
      ]);
      const names = ['health', 'cashFlow', 'expenseBreakdown', 'budgetComparison',
        'monthlyComparison', 'topExpenses', 'patterns', 'recurring'];
      const setters = [setHealth, setCashFlow, setExpenseBreakdown, setBudgetComparison,
        setMonthlyComparison, setTopExpenses, setPatterns, setRecurring];
      results.forEach((r, i) => {
        if (r.status === 'fulfilled' && r.value) setters[i](r.value);
        else setters[i](null);
      });
      const failed = results.filter((r) => r.status === 'rejected').length;
      if (failed === results.length) setError('Tidak dapat memuat data analisis.');
    } catch (err) {
      setError('Tidak dapat memuat data analisis.');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const updatePrefs = (next) => {
    setPrefs(next);
    savePrefs(next);
  };

  const toggleHidden = (id) => {
    const hidden = prefs.hidden.includes(id)
      ? prefs.hidden.filter((x) => x !== id)
      : [...prefs.hidden, id];
    updatePrefs({ ...prefs, hidden });
  };

  const moveWidget = (id, direction) => {
    const order = [...prefs.order];
    const idx = order.indexOf(id);
    const target = idx + direction;
    if (target < 0 || target >= order.length) return;
    [order[idx], order[target]] = [order[target], order[idx]];
    updatePrefs({ ...prefs, order });
  };

  const resetLayout = () => {
    updatePrefs({ order: DEFAULT_LAYOUT, hidden: [], period: '6' });
  };

  const visible = useMemo(
    () => prefs.order.filter((id) => !prefs.hidden.includes(id)),
    [prefs.order, prefs.hidden]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-success-600';
    if (score >= 60) return 'text-warning-600';
    return 'text-danger-600';
  };

  const getScoreLabel = (score) => {
    if (score >= 80) return { label: 'Sangat Baik', color: 'success' };
    if (score >= 60) return { label: 'Baik', color: 'warning' };
    if (score >= 40) return { label: 'Cukup', color: 'warning' };
    return { label: 'Perlu Perbaikan', color: 'danger' };
  };

  // The backend names the fields overall_score / description. Older builds
  // of this page read total_score / message and rendered a blank card.
  const healthScore = health ? (health.overall_score ?? health.total_score ?? 0) : 0;
  const healthBreakdown = health?.breakdown || {};

  const Widget = ({ id, children, className = '' }) => {
    const meta = WIDGETS[id];
    const Icon = meta.icon;
    const isOpen = explain[id];
    return (
      <Card className={`overflow-hidden ${meta.minWidth === 'full' ? 'lg:col-span-2' : ''} ${className}`}>
        <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Icon size={16} className="text-primary-600 shrink-0" />
              <h3 className="font-semibold text-gray-900 text-sm sm:text-base truncate">{meta.label}</h3>
            </div>
            {isOpen && (
              <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{meta.hint}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setExplain((e) => ({ ...e, [id]: !e[id] }))}
            title="Penjelasan metrik"
            className="text-gray-400 hover:text-primary-600 transition-colors shrink-0"
          >
            <Info size={15} />
          </button>
        </div>
        {children}
      </Card>
    );
  };

  const renderWidget = (id) => {
    switch (id) {
      case 'health':
        if (!health) return null;
        return (
          <Widget id="health">
            <div className="bg-gradient-to-r from-primary-600 to-primary-500 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-primary-100 text-sm font-medium">Skor Kesehatan Keuangan</p>
                  <p className="text-5xl font-bold text-white mt-2">{healthScore}/100</p>
                  <Badge variant={getScoreLabel(healthScore).color} className="mt-2">
                    {getScoreLabel(healthScore).label}
                  </Badge>
                  {health.message && (
                    <p className="text-primary-100 text-xs mt-2 max-w-md">{health.message}</p>
                  )}
                </div>
                <div className="w-28 h-28 hidden sm:block">
                  <ResponsiveContainer>
                    <RePieChart>
                      <Pie
                        data={[{ value: healthScore }, { value: 100 - healthScore }]}
                        cx="50%" cy="50%" innerRadius={32} outerRadius={50}
                        dataKey="value" strokeWidth={0}
                      >
                        <Cell fill="#22c55e" />
                        <Cell fill="rgba(255,255,255,0.3)" />
                      </Pie>
                    </RePieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
            <CardBody>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {Object.entries(healthBreakdown).map(([key, value]) => (
                  <div key={key} className="p-3 rounded-lg bg-gray-50">
                    <p className="text-xs text-gray-500">{value.label || key.replace(/_/g, ' ')}</p>
                    <p className={`text-lg font-bold mt-0.5 ${getScoreColor(value.score)}`}>
                      {value.score}<span className="text-xs text-gray-400">/{value.max || 25}</span>
                    </p>
                    <p className="text-xs text-gray-400 mt-1 leading-snug">
                      {value.description || value.message}
                    </p>
                  </div>
                ))}
              </div>
              {health.metrics && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-gray-100">
                  <Metric label="Total saldo" value={formatCurrency(health.metrics.total_balance)} />
                  <Metric label="Tingkat tabungan" value={`${Number(health.metrics.saving_rate || 0).toFixed(1)}%`} />
                  <Metric label="Total utang" value={formatCurrency(health.metrics.total_debt)} />
                  <Metric label="Target aktif" value={String(health.metrics.active_goals ?? 0)} />
                </div>
              )}
            </CardBody>
          </Widget>
        );

      case 'cashflow':
        if (!cashFlow?.monthly?.length) return null;
        return (
          <Widget id="cashflow">
            <CardBody>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={cashFlow.monthly.map((m) => ({
                  month: m.month,
                  Income: parseFloat(m.income) || 0,
                  Expense: parseFloat(m.expense) || 0,
                  Net: parseFloat(m.net) || 0,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000000).toFixed(0)}jt`} />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Legend />
                  <Area type="monotone" dataKey="Income" stroke="#22c55e" fill="#22c55e" fillOpacity={0.15} />
                  <Area type="monotone" dataKey="Expense" stroke="#ef4444" fill="#ef4444" fillOpacity={0.15} />
                  <Area type="monotone" dataKey="Net" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} />
                </AreaChart>
              </ResponsiveContainer>
              {cashFlow.trends && (
                <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-gray-100">
                  <Metric
                    label="Perubahan pemasukan"
                    value={`${Number(cashFlow.trends.income_change_pct || 0).toFixed(1)}%`}
                    trend={cashFlow.trends.income_trend}
                  />
                  <Metric
                    label="Perubahan pengeluaran"
                    value={`${Number(cashFlow.trends.expense_change_pct || 0).toFixed(1)}%`}
                    trend={cashFlow.trends.expense_trend}
                  />
                </div>
              )}
            </CardBody>
          </Widget>
        );

      case 'categories':
        if (!expenseBreakdown?.breakdown?.length) return null;
        return (
          <Widget id="categories">
            <CardBody>
              <div className="flex flex-col lg:flex-row gap-4 items-center">
                <div className="w-full lg:w-1/2">
                  <ResponsiveContainer width="100%" height={230}>
                    <RePieChart>
                      <Pie
                        data={expenseBreakdown.breakdown.map((b) => ({
                          name: b.name || 'Lainnya',
                          value: parseFloat(b.total) || 0,
                        }))}
                        cx="50%" cy="50%" outerRadius={85} dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {expenseBreakdown.breakdown.map((_, i) => (
                          <Cell key={`c-${i}`} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                    </RePieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-full lg:w-1/2 space-y-2">
                  {expenseBreakdown.breakdown.slice(0, 6).map((b, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ background: COLORS[i % COLORS.length] }} />
                        <span className="truncate">{b.name || 'Lainnya'}</span>
                      </span>
                      <span className="flex items-center gap-2 shrink-0">
                        <span className="font-medium">{formatCurrency(b.total)}</span>
                        <span className="text-xs text-gray-400 w-10 text-right">
                          {Number(b.percentage || 0).toFixed(0)}%
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </CardBody>
          </Widget>
        );

      case 'budget':
        if (!budgetComparison?.comparisons?.length) return null;
        return (
          <Widget id="budget">
            <CardBody>
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={budgetComparison.comparisons.map((c) => ({
                  category: (c.category_name || 'Lainnya').length > 14
                    ? `${c.category_name.slice(0, 13)}…` : (c.category_name || 'Lainnya'),
                  budget: parseFloat(c.budget_amount) || 0,
                  actual: parseFloat(c.actual_spent) || 0,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000000).toFixed(0)}jt`} />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Legend />
                  <Bar dataKey="budget" fill="#3b82f6" name="Anggaran" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="actual" fill="#ef4444" name="Realisasi" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              {budgetComparison.summary && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-gray-100">
                  <Metric label="Total anggaran" value={formatCurrency(budgetComparison.summary.total_budget)} />
                  <Metric label="Total realisasi" value={formatCurrency(budgetComparison.summary.total_actual)} />
                  <Metric label="Sisa anggaran" value={formatCurrency(budgetComparison.summary.total_remaining)} />
                  <Metric
                    label="Porsi terpakai"
                    value={`${Number(budgetComparison.summary.overall_utilization || 0).toFixed(0)}%`}
                  />
                </div>
              )}
            </CardBody>
          </Widget>
        );

      case 'topexpenses':
        if (!topExpenses?.expenses?.length) return null;
        return (
          <Widget id="topexpenses">
            <CardBody className="p-0">
              <ul className="divide-y divide-gray-100">
                {topExpenses.expenses.map((t) => (
                  <li key={t.id} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{t.description || 'Tanpa deskripsi'}</p>
                      <p className="text-xs text-gray-500 truncate">
                        {t.category || 'Tanpa kategori'}
                        {t.account ? ` · ${t.account}` : ''}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-danger-600 shrink-0">
                      {formatCurrency(t.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Widget>
        );

      case 'patterns':
        if (!patterns?.by_weekday?.length) return null;
        return (
          <Widget id="patterns">
            <CardBody>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={patterns.by_weekday.map((d) => ({
                  day: d.day, total: parseFloat(d.total) || 0,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000000).toFixed(0)}jt`} />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Bar dataKey="total" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              {patterns.by_month_period?.length > 0 && (
                <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-gray-100">
                  {patterns.by_month_period.map((p) => (
                    <div key={p.period} className="p-3 rounded-lg bg-gray-50">
                      <p className="text-xs text-gray-500">{p.label}</p>
                      <p className="text-sm font-bold mt-0.5">{formatCurrency(p.total)}</p>
                      <p className="text-xs text-gray-400">{p.count} transaksi</p>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Widget>
        );

      case 'recurring':
        if (!recurring?.items?.length) return null;
        return (
          <Widget id="recurring">
            <CardBody>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <Metric label="Per bulan" value={formatCurrency(recurring.total_monthly_recurring)} />
                <Metric label="Per tahun" value={formatCurrency(recurring.yearly_recurring)} />
              </div>
              <ul className="space-y-2">
                {recurring.items.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate">{r.description || 'Tanpa deskripsi'}</span>
                    <span className="shrink-0 text-gray-500">
                      {formatCurrency(r.amount)} <span className="text-xs">/ {r.frequency}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Widget>
        );

      case 'monthly':
        if (!monthlyComparison?.comparisons?.length) return null;
        return (
          <Widget id="monthly">
            <CardBody className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="px-5 py-3 text-left font-medium text-gray-600">Bulan</th>
                      <th className="px-5 py-3 text-right font-medium text-gray-600">Pemasukan</th>
                      <th className="px-5 py-3 text-right font-medium text-gray-600">Pengeluaran</th>
                      <th className="px-5 py-3 text-right font-medium text-gray-600">Net</th>
                      <th className="px-5 py-3 text-right font-medium text-gray-600">Perubahan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyComparison.comparisons.map((row, i) => {
                      const net = parseFloat(row.net) || 0;
                      return (
                        <tr key={i} className="border-b border-gray-50">
                          <td className="px-5 py-3 font-medium">{row.month}</td>
                          <td className="px-5 py-3 text-right text-success-600">{formatCurrency(row.income)}</td>
                          <td className="px-5 py-3 text-right text-danger-600">{formatCurrency(row.expense)}</td>
                          <td className={`px-5 py-3 text-right font-medium ${net >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                            {formatCurrency(row.net)}
                          </td>
                          <td className="px-5 py-3 text-right">
                            {i < monthlyComparison.comparisons.length - 1 && (
                              <Badge variant={parseFloat(row.change_pct) >= 0 ? 'success' : 'danger'} size="sm">
                                {parseFloat(row.change_pct) >= 0 ? '+' : ''}{parseFloat(row.change_pct).toFixed(1)}%
                              </Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Widget>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analisis</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Ringkasan kondisi keuangan Anda. Setiap bagian bisa disembunyikan atau diurutkan ulang.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            options={[
              { value: '3', label: '3 bulan' },
              { value: '6', label: '6 bulan' },
              { value: '12', label: '12 bulan' },
            ]}
            value={period}
            onChange={(e) => updatePrefs({ ...prefs, period: e.target.value })}
            className="w-36"
          />
          <Button
            variant={customizing ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setCustomizing((c) => !c)}
          >
            <Settings2 size={14} className="mr-1.5" />
            Atur tampilan
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-danger-200 bg-danger-50">
          <CardBody className="text-sm text-danger-700">{error}</CardBody>
        </Card>
      )}

      {/* Customisation panel */}
      {customizing && (
        <Card className="border-primary-200">
          <CardHeader className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900 text-sm">Susun halaman</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Sembunyikan bagian yang tidak Anda perlukan, atau pindahkan urutannya.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={resetLayout}>
              <RotateCcw size={13} className="mr-1" /> Reset
            </Button>
          </CardHeader>
          <CardBody className="p-0">
            <ul className="divide-y divide-gray-100">
              {prefs.order.map((id) => {
                const meta = WIDGETS[id];
                const hidden = prefs.hidden.includes(id);
                return (
                  <li key={id} className="px-5 py-3 flex items-center gap-3">
                    <GripVertical size={15} className="text-gray-300 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium truncate">{meta.label}</span>
                      <span className="block text-xs text-gray-500 truncate">{meta.hint}</span>
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => moveWidget(id, -1)}
                        className="px-2 py-1 text-xs text-gray-500 hover:text-primary-600 disabled:opacity-30"
                        disabled={prefs.order.indexOf(id) === 0}
                      >
                        <ChevronRight size={14} className="rotate-180" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveWidget(id, 1)}
                        className="px-2 py-1 text-xs text-gray-500 hover:text-primary-600 disabled:opacity-30"
                        disabled={prefs.order.indexOf(id) === prefs.order.length - 1}
                      >
                        <ChevronRight size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleHidden(id)}
                        title={hidden ? 'Tampilkan' : 'Sembunyikan'}
                        className={`px-2 py-1 ${hidden ? 'text-gray-400' : 'text-primary-600'}`}
                      >
                        {hidden ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>
      )}

      {/* Widgets */}
      <div className="grid lg:grid-cols-2 gap-5">
        {visible.map((id) => (
          <div key={id} className="contents">
            {renderWidget(id)}
          </div>
        ))}
      </div>

      {visible.length === 0 && (
        <Card>
          <CardBody className="text-center text-gray-500 py-12">
            <Sparkles size={20} className="mx-auto mb-2 text-gray-400" />
            <p className="text-sm mb-3">Semua bagian disembunyikan.</p>
            <Button variant="outline" size="sm" onClick={resetLayout}>
              Tampilkan semua bagian
            </Button>
          </CardBody>
        </Card>
      )}
    </div>
  );
};

const Metric = ({ label, value, trend }) => (
  <div>
    <p className="text-xs text-gray-500 truncate">{label}</p>
    <p className="text-sm font-bold mt-0.5 flex items-center gap-1">
      {value}
      {trend === 'up' && <TrendingUp size={13} className="text-success-600" />}
      {trend === 'down' && <TrendingDown size={13} className="text-danger-600" />}
    </p>
  </div>
);

export default Analytics;
