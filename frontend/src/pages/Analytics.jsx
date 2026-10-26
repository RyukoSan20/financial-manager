import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardHeader, CardBody, Badge, Spinner, Select, Button, ProgressBar } from '../components/ui';
import api from '../services/api';
import {
  TrendingUp, TrendingDown, PieChart, BarChart3, Wallet, Target,
  Calendar, GripVertical, Eye, EyeOff, Settings2, RotateCcw, Info,
  Sparkles, Activity, Layers, ChevronRight
} from 'lucide-react';
import { formatCurrency, formatPercent } from '../utils/format';
import { formatAxisValue } from '../utils/idFormat';
import { useSyncedPreference } from '../hooks/useSyncedPreference';
import { useTranslation } from '../i18n';
import { categoryName } from '../utils/categoryName';
import { chartPalette } from '../utils/appearance';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RePieChart, Pie, Cell,
  BarChart, Bar, Legend, ReferenceLine
} from 'recharts';

/**
 * The colours of the charts.
 *
 * The first is the accent the user picked, so a chart belongs to the
 * scheme. The rest stay put, so two charts of the same thing look the
 * same whatever the scheme is.
 *
 * It is read when the chart is drawn rather than when this file is
 * loaded, because the scheme is not known until the appearance has been
 * applied to the page.
 */
const COLORS = chartPalette;

// The first colour of the chart is the accent the user picked, so the
// chart belongs to the scheme. The rest stay put, so two charts of the
// same thing look the same whatever the scheme is.
//
// It is read when the chart is drawn rather than when this file is
// loaded, because the scheme is not known until the appearance has been
// applied to the page.

const PREFS_KEY = 'fm.analytics.layout.v2';

// The key the layout is stored under in the user's settings on the
// server. The same layout follows the user to another device.
const PREFS_SERVER_KEY = 'analytics_layout';

/**
 * Every widget explains what it is for. Before the redesign the page was a
 * wall of charts with no indication of why the user should care, so each
 * block carries a one-line "what this answers" hint.
 */
const WIDGETS = {
  health: {
    id: 'health',
    labelKey: 'analytics.widget_health_label',
    hintKey: 'analytics.widget_health_hint',
    icon: Activity,
    minWidth: 'full',
  },
  cashflow: {
    id: 'cashflow',
    labelKey: 'analytics.widget_cashflow_label',
    hintKey: 'analytics.widget_cashflow_hint',
    icon: TrendingUp,
    minWidth: 'full',
  },
  categories: {
    id: 'categories',
    labelKey: 'analytics.widget_categories_label',
    hintKey: 'analytics.widget_categories_hint',
    icon: PieChart,
    minWidth: 'half',
  },
  budget: {
    id: 'budget',
    labelKey: 'analytics.widget_budget_label',
    hintKey: 'analytics.widget_budget_hint',
    icon: Target,
    minWidth: 'half',
  },
  topexpenses: {
    id: 'topexpenses',
    labelKey: 'analytics.widget_topexpenses_label',
    hintKey: 'analytics.widget_topexpenses_hint',
    icon: Layers,
    minWidth: 'half',
  },
  patterns: {
    id: 'patterns',
    labelKey: 'analytics.widget_patterns_label',
    hintKey: 'analytics.widget_patterns_hint',
    icon: Calendar,
    minWidth: 'half',
  },
  recurring: {
    id: 'recurring',
    labelKey: 'analytics.widget_recurring_label',
    hintKey: 'analytics.widget_recurring_hint',
    icon: RotateCcw,
    minWidth: 'half',
  },
  monthly: {
    id: 'monthly',
    labelKey: 'analytics.widget_monthly_label',
    hintKey: 'analytics.widget_monthly_hint',
    icon: BarChart3,
    minWidth: 'full',
  },
};

const DEFAULT_LAYOUT = ['health', 'cashflow', 'categories', 'budget', 'topexpenses', 'patterns', 'recurring', 'monthly'];

/**
 * Ready-made layouts.
 *
 * Choosing one of these is quicker than hiding five widgets one by one,
 * and they are arranged around what a person usually wants to know
 * first. The order of the widgets is what tells the story, so each
 * preset starts with the part that answers the biggest question.
 */
const LAYOUT_PRESETS = {
  ringkasan: {
    id: 'ringkasan',
    labelKey: 'analytics.preset_ringkasan_label',
    descriptionKey: 'analytics.preset_ringkasan_description',
    order: ['health', 'cashflow', 'topexpenses', 'budget', 'categories', 'recurring'],
    hidden: ['patterns', 'monthly'],
  },
  lengkap: {
    id: 'lengkap',
    labelKey: 'analytics.preset_lengkap_label',
    descriptionKey: 'analytics.preset_lengkap_description',
    order: DEFAULT_LAYOUT,
    hidden: [],
  },
  pengeluaran: {
    id: 'pengeluaran',
    labelKey: 'analytics.preset_pengeluaran_label',
    descriptionKey: 'analytics.preset_pengeluaran_description',
    order: ['categories', 'topexpenses', 'patterns', 'budget', 'monthly', 'cashflow'],
    hidden: ['health', 'recurring'],
  },
  tabungan: {
    id: 'tabungan',
    labelKey: 'analytics.preset_tabungan_label',
    descriptionKey: 'analytics.preset_tabungan_description',
    order: ['health', 'cashflow', 'monthly', 'budget', 'recurring', 'categories'],
    hidden: ['topexpenses', 'patterns'],
  },
};

// The layout as it stands when the user has not changed anything. It
// is defined once, so the hook does not see a new object on every
// render.
const DEFAULT_PREFS = {
  order: DEFAULT_LAYOUT,
  hidden: [],
  period: '6',
};

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

/**
 * Make sure the layout is the shape the page expects.
 *
 * The copy on the server may come from an older version of the app, so
 * the widget list is filtered against the ones that exist now and
 * anything missing is added back.
 */
const normalizeAnalyticsPrefs = (stored, defaults) => {
  if (!stored || typeof stored !== 'object') return { ...defaults };

  const order = Array.isArray(stored.order)
    ? stored.order.filter((id) => WIDGETS[id])
    : defaults.order;
  const missing = defaults.order.filter((id) => !order.includes(id));

  return {
    order: [...order, ...missing],
    hidden: Array.isArray(stored.hidden)
      ? stored.hidden.filter((id) => WIDGETS[id])
      : defaults.hidden,
    period: stored.period || defaults.period,
  };
};

const savePrefs = (prefs) => {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* storage unavailable - the page still works, it just forgets */
  }
};

export const Analytics = () => {
  const { t, language } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // The layout lives on the server as well as in the browser, so the
  // dashboard looks the same on the phone as on the laptop.
  const [prefs, setPrefs] = useSyncedPreference(
    PREFS_SERVER_KEY,
    PREFS_KEY,
    DEFAULT_PREFS,
    normalizeAnalyticsPrefs
  );
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
      if (failed === results.length) setError(t('analytics.load_error'));
    } catch (err) {
      setError(t('analytics.load_error'));
    } finally {
      setLoading(false);
    }
  }, [period, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // The hook writes to the browser and to the server. `savePrefs` is
  // left in place for the first render, before the server has answered.
  const updatePrefs = (next) => {
    setPrefs(next);
    savePrefs(next);
  };

  /**
   * Use one of the ready-made layouts.
   *
   * The hidden list is taken from the preset as well, so the result is
   * exactly what the preset describes and not just a reordering.
   */
  const applyPreset = (preset) => {
    updatePrefs({
      ...prefs,
      order: [...preset.order],
      hidden: [...preset.hidden],
    });
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
    if (score >= 80) return { label: t('analytics.score_excellent'), color: 'success' };
    if (score >= 60) return { label: t('analytics.score_good'), color: 'warning' };
    if (score >= 40) return { label: t('analytics.score_fair'), color: 'warning' };
    return { label: t('analytics.score_poor'), color: 'danger' };
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
              <h3 className="font-semibold text-gray-900 text-sm sm:text-base truncate">{t(meta.labelKey)}</h3>
            </div>
            {isOpen && (
              <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{t(meta.hintKey)}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setExplain((e) => ({ ...e, [id]: !e[id] }))}
            title={t('analytics.metric_explanation')}
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
                  <p className="text-primary-100 text-sm font-medium">{t('analytics.widget_health_label')}</p>
                  <p className="text-5xl font-bold text-white mt-2">{healthScore}/100</p>
                  <Badge variant={getScoreLabel(healthScore).color} className="mt-2">
                    {getScoreLabel(healthScore).label}
                  </Badge>
                  {(health.message_key || health.message) && (
                    <p className="text-primary-100 text-xs mt-2 max-w-md">
                      {health.message_key ? t(health.message_key) : health.message}
                    </p>
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
                  <div
                    key={key}
                    className={`p-3 rounded-lg ${value.measurable === false ? 'bg-gray-50/60' : 'bg-gray-50'}`}
                  >
                    <p className="text-xs text-gray-500">
                      {value.label_key ? t(value.label_key) : (value.label || key.replace(/_/g, ' '))}
                    </p>
                    {/* A part with no data behind it shows no number at
                        all. Showing "0 out of 25" would read as a bad
                        result rather than an empty measurement. */}
                    {value.measurable === false ? (
                      <p className="text-sm font-medium text-gray-400 mt-0.5">
                        {t('analytics.health_not_measured')}
                      </p>
                    ) : (
                      <p className={`text-lg font-bold mt-0.5 ${getScoreColor(value.score)}`}>
                        {value.score}<span className="text-xs text-gray-400">/{value.max || 25}</span>
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-1 leading-snug">
                      {value.description_key
                        ? t(value.description_key, '', value.description_values || {})
                        : (value.description || value.message)}
                    </p>
                  </div>
                ))}
                {/* The overall score is only worth showing when enough
                    of it could be measured. */}
                {health.has_enough_data === false && (
                  <div className="col-span-2 lg:col-span-4 p-3 rounded-lg bg-amber-50 border border-amber-200">
                    <p className="text-sm text-amber-800">
                      {t('analytics.health_not_enough_data')}
                    </p>
                  </div>
                )}
              </div>
              {health.metrics && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-gray-100">
                  <Metric label={t('analytics.metric_total_balance')} value={formatCurrency(health.metrics.total_balance)} />
                  <Metric label={t('analytics.metric_saving_rate')} value={`${Number(health.metrics.saving_rate || 0).toFixed(1)}%`} />
                  <Metric label={t('analytics.metric_total_debt')} value={formatCurrency(health.metrics.total_debt)} />
                  <Metric label={t('analytics.metric_active_goals')} value={String(health.metrics.active_goals ?? 0)} />
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
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => formatAxisValue(v, language)} />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Legend />
                  <Area type="monotone" dataKey="Income" name={t('analytics.chart_income')} stroke="#22c55e" fill="#22c55e" fillOpacity={0.15} />
                  <Area type="monotone" dataKey="Expense" name={t('analytics.chart_expense')} stroke="#ef4444" fill="#ef4444" fillOpacity={0.15} />
                  <Area type="monotone" dataKey="Net" name={t('analytics.chart_net')} stroke={COLORS()[0]} fill={COLORS()[0]} fillOpacity={0.1} />
                </AreaChart>
              </ResponsiveContainer>
              {cashFlow.trends && (
                <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-gray-100">
                  <Metric
                    label={t('analytics.change_income')}
                    value={`${Number(cashFlow.trends.income_change_pct || 0).toFixed(1)}%`}
                    trend={cashFlow.trends.income_trend}
                  />
                  <Metric
                    label={t('analytics.change_expense')}
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
                          // The server sends the name as it is stored,
                          // which is Indonesian. It is translated here.
                          name: categoryName(b.name, language) || t('category.lainnya'),
                          value: parseFloat(b.total) || 0,
                        }))}
                        cx="50%" cy="50%" outerRadius={85} dataKey="value"
                        // A slice with a border draws that border on
                        // the cut as well, so one slice shows a line
                        // across the middle of the circle. With one
                        // slice there is no cut to show.
                        stroke={expenseBreakdown.breakdown.length > 1 ? '#fff' : 'none'}
                        strokeWidth={expenseBreakdown.breakdown.length > 1 ? 2 : 0}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {expenseBreakdown.breakdown.map((_, i) => (
                          <Cell key={`c-${i}`} fill={COLORS()[i % COLORS().length]} />
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
                          style={{ background: COLORS()[i % COLORS().length] }} />
                        <span className="truncate">{categoryName(b.name, language) || t('category.lainnya')}</span>
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
                  // The server sends the name as it is stored, which is
                // the Indonesian one. It is translated here, so a
                // Japanese reader sees the Japanese word.
                category: (() => {
                  const raw = c.category_name || t('category.lainnya');
                  const name = categoryName(raw, language);
                  return name.length > 14 ? `${name.slice(0, 13)}…` : name;
                })(),
                  budget: parseFloat(c.budget_amount) || 0,
                  actual: parseFloat(c.actual_spent) || 0,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatAxisValue(v, language)} />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Legend />
                  <Bar dataKey="budget" fill={COLORS()[0]} name={t('analytics.chart_budget')} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="actual" fill="#ef4444" name={t('analytics.chart_actual')} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              {budgetComparison.summary && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-gray-100">
                  <Metric label={t('analytics.total_budget')} value={formatCurrency(budgetComparison.summary.total_budget)} />
                  <Metric label={t('analytics.total_actual')} value={formatCurrency(budgetComparison.summary.total_actual)} />
                  <Metric label={t('analytics.budget_remaining')} value={formatCurrency(budgetComparison.summary.total_remaining)} />
                  <Metric
                    label={t('analytics.used_portion')}
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
                {topExpenses.expenses.map((tx) => (
                  <li key={tx.id} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{tx.description || t('analytics.no_description')}</p>
                      <p className="text-xs text-gray-500 truncate">
                        {categoryName(tx.category, language) || t('analytics.no_category')}
                        {tx.account ? ` · ${tx.account}` : ''}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-danger-600 shrink-0">
                      {formatCurrency(tx.amount, tx.currency)}
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
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatAxisValue(v, language)} />
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
                      <p className="text-xs text-gray-400">{t('analytics.transaction_count').replace('%s', p.count)}</p>
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
                <Metric label={t('analytics.per_month')} value={formatCurrency(recurring.total_monthly_recurring)} />
                <Metric label={t('analytics.per_year')} value={formatCurrency(recurring.yearly_recurring)} />
              </div>
              <ul className="space-y-2">
                {recurring.items.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate">{r.description || t('analytics.no_description')}</span>
                    <span className="shrink-0 text-gray-500">
                      {formatCurrency(r.amount, r.currency)} <span className="text-xs">/ {r.frequency}</span>
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
                      <th className="px-5 py-3 text-left font-medium text-gray-600">{t('analytics.table_month')}</th>
                      <th className="px-5 py-3 text-right font-medium text-gray-600">{t('analytics.chart_income')}</th>
                      <th className="px-5 py-3 text-right font-medium text-gray-600">{t('analytics.chart_expense')}</th>
                      <th className="px-5 py-3 text-right font-medium text-gray-600">{t('analytics.table_net')}</th>
                      <th className="px-5 py-3 text-right font-medium text-gray-600">{t('analytics.table_change')}</th>
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
                            {i < monthlyComparison.comparisons.length - 1 && (() => {
                              // A missing or unparsable value must not become
                              // NaN% in the table.
                              const pct = parseFloat(row.change_pct);
                              if (Number.isNaN(pct)) {
                                return <span className="text-xs text-gray-400">-</span>;
                              }
                              return (
                                <Badge variant={pct >= 0 ? 'success' : 'danger'} size="sm">
                                  {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
                                </Badge>
                              );
                            })()}
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
          <h1 className="text-2xl font-bold text-gray-900">{t('nav.analytics')}</h1>
          <p className="text-gray-500 mt-1 text-sm">
            {t('analytics.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            options={[
              { value: '3', label: t('analytics.month_option').replace('%s', '3') },
              { value: '6', label: t('analytics.month_option').replace('%s', '6') },
              { value: '12', label: t('analytics.month_option').replace('%s', '12') },
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
            {t('analytics.customize')}
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-danger-200 bg-danger-50">
          <CardBody className="text-sm text-danger-700">{error}</CardBody>
        </Card>
      )}

      {/* The summary strip: the four numbers that decide whether the
          month went well, in one row before any chart. */}
      {!loading && health && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              label: t('analytics.stat_balance'),
              value: formatCurrency(health.total_balance || 0),
              tone: 'text-gray-900 dark:text-gray-100',
            },
            {
              label: t('analytics.stat_saving_rate'),
              value: `${(health.savings_rate || 0).toFixed(1)}%`,
              tone:
                (health.savings_rate || 0) >= 20
                  ? 'text-success-600 dark:text-success-400'
                  : 'text-warning-600 dark:text-warning-400',
            },
            {
              label: t('analytics.stat_total_debt'),
              value: formatCurrency(health.total_debt || 0),
              tone:
                (health.total_debt || 0) > 0
                  ? 'text-danger-600 dark:text-danger-400'
                  : 'text-gray-900 dark:text-gray-100',
            },
            {
              label: t('analytics.stat_active_goals'),
              value: String(health.active_goals || 0),
              tone: 'text-primary-600 dark:text-primary-400',
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl bg-white dark:bg-gray-800 p-3.5 shadow-sm border border-gray-100 dark:border-gray-700"
            >
              <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {stat.label}
              </div>
              <div
                className={`text-lg font-bold tabular-nums mt-0.5 ${stat.tone}`}
              >
                {stat.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Customisation panel */}
      {customizing && (
        <Card className="border-primary-200">
          <CardHeader className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900 text-sm">{t('analytics.compose_page')}</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {t('analytics.compose_desc')}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={resetLayout}>
              <RotateCcw size={13} className="mr-1" /> {t('analytics.reset')}
            </Button>
          </CardHeader>
          <CardBody>
            {/* The ready-made layouts */}
            <div className="mb-4">
              <div className="text-xs font-medium text-gray-500 mb-2">
                {t('analytics.ready_layouts')}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {Object.values(LAYOUT_PRESETS).map((preset) => {
                  // A widget that was added to the app after the preset
                  // was made is appended to the order, so only the
                  // widgets the preset names are compared.
                  const visible = prefs.order.filter(
                    (id) => !prefs.hidden.includes(id)
                  );
                  const active =
                    visible.length === preset.order.length &&
                    preset.order.every((id, i) => visible[i] === id);
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyPreset(preset)}
                      className={`text-left rounded-lg border-2 p-2.5 transition ${
                        active
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-gray-900">
                          {t(preset.labelKey)}
                        </span>
                        {active && (
                          <span className="text-[10px] text-primary-600 font-medium">
                            {t('analytics.active_badge')}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-gray-500 mt-0.5 leading-snug">
                        {t(preset.descriptionKey)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="text-xs font-medium text-gray-500 mb-1">
              {t('analytics.customize_individually')}
            </div>
          </CardBody>
          <CardBody className="p-0">
            <ul className="divide-y divide-gray-100">
              {prefs.order.map((id) => {
                const meta = WIDGETS[id];
                const hidden = prefs.hidden.includes(id);
                return (
                  <li key={id} className="px-5 py-3 flex items-center gap-3">
                    <GripVertical size={15} className="text-gray-300 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium truncate">{t(meta.labelKey)}</span>
                      <span className="block text-xs text-gray-500 truncate">{t(meta.hintKey)}</span>
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
                        title={hidden ? t('analytics.show') : t('analytics.hide')}
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
            <p className="text-sm mb-3">{t('analytics.all_hidden')}</p>
            <Button variant="outline" size="sm" onClick={resetLayout}>
              {t('analytics.show_all_sections')}
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
