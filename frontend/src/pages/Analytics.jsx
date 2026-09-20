import { useState, useEffect } from 'react';
import { Card, Badge, Spinner, EmptyState, Select } from '../components/ui';
import { 
  TrendingUp, TrendingDown, PieChart, BarChart3, 
  DollarSign, CreditCard, Target, Calendar
} from 'lucide-react';
import { formatCurrency, formatPercent, formatDate } from '../utils/format';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RePieChart, Pie, Cell,
  BarChart, Bar, Legend
} from 'recharts';

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export const Analytics = () => {
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState(null);
  const [cashFlow, setCashFlow] = useState(null);
  const [expenseBreakdown, setExpenseBreakdown] = useState(null);
  const [budgetComparison, setBudgetComparison] = useState(null);
  const [monthlyComparison, setMonthlyComparison] = useState(null);
  const [period, setPeriod] = useState('6');

  useEffect(() => {
    fetchData();
  }, [period]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [healthRes, cashFlowRes, expenseRes, budgetRes, monthlyRes] = await Promise.all([
        fetch('/api/analytics/financial-health').then(r => r.json()),
        fetch(`/api/analytics/cash-flow-trend?months=${period}`).then(r => r.json()),
        fetch('/api/analytics/expense-breakdown?period=monthly').then(r => r.json()),
        fetch('/api/analytics/budget-vs-actual').then(r => r.json()),
        fetch(`/api/analytics/monthly-comparison?months=${period}`).then(r => r.json()),
      ]);
      setHealth(healthRes);
      setCashFlow(cashFlowRes);
      setExpenseBreakdown(expenseRes);
      setBudgetComparison(budgetRes);
      setMonthlyComparison(monthlyRes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

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
    if (score >= 80) return { label: 'Excellent', color: 'success' };
    if (score >= 60) return { label: 'Good', color: 'warning' };
    if (score >= 40) return { label: 'Fair', color: 'warning' };
    return { label: 'Needs Improvement', color: 'danger' };
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-500 mt-1">Financial insights and trends</p>
        </div>
        <Select
          options={[
            { value: '3', label: 'Last 3 months' },
            { value: '6', label: 'Last 6 months' },
            { value: '12', label: 'Last 12 months' },
          ]}
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="w-40"
        />
      </div>

      {/* Financial Health Score */}
      {health && (
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-r from-primary-600 to-primary-500 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-primary-100 text-sm font-medium">Financial Health Score</p>
                <p className={`text-5xl font-bold text-white mt-2 ${getScoreColor(health.total_score)}`}>
                  {health.total_score}/100
                </p>
                <Badge variant={getScoreLabel(health.total_score).color} className="mt-2">
                  {getScoreLabel(health.total_score).label}
                </Badge>
              </div>
              <div className="w-32 h-32">
                <ResponsiveContainer>
                  <RePieChart>
                    <Pie
                      data={[{ value: health.total_score }, { value: 100 - health.total_score }]}
                      cx="50%"
                      cy="50%"
                      innerRadius={35}
                      outerRadius={55}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      <Cell fill="#22c55e" />
                      <Cell fill="rgba(255,255,255,0.3)" />
                    </Pie>
                  </RePieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {health.breakdown && Object.entries(health.breakdown).map(([key, value]) => (
                <div key={key} className="text-center">
                  <p className="text-sm text-gray-500 capitalize">
                    {key.replace('_', ' ')}
                  </p>
                  <p className={`text-xl font-bold ${getScoreColor(value.score)}`}>
                    {value.score}/25
                  </p>
                  <p className="text-xs text-gray-400 mt-1">{value.message}</p>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Cash Flow Trend */}
      {cashFlow && cashFlow.monthly && cashFlow.monthly.length > 0 && (
        <Card>
          <Card.Header>
            <h3 className="font-semibold text-gray-900">Cash Flow Trend</h3>
          </Card.Header>
          <Card.Body>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={cashFlow.monthly.map(m => ({
                month: m.month,
                Income: parseFloat(m.income),
                Expense: parseFloat(m.expense),
                Net: parseFloat(m.net),
              }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v/1000000).toFixed(0)}M`} />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Legend />
                <Area type="monotone" dataKey="Income" stackId="1" stroke="#22c55e" fill="#22c55e" fillOpacity={0.2} />
                <Area type="monotone" dataKey="Expense" stackId="2" stroke="#ef4444" fill="#ef4444" fillOpacity={0.2} />
                <Area type="monotone" dataKey="Net" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} />
              </AreaChart>
            </ResponsiveContainer>
          </Card.Body>
        </Card>
      )}

      {/* Expense Breakdown & Budget Comparison */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Expense by Category */}
        {expenseBreakdown && expenseBreakdown.breakdown && expenseBreakdown.breakdown.length > 0 ? (
          <Card>
            <Card.Header>
              <h3 className="font-semibold text-gray-900">Expense by Category</h3>
            </Card.Header>
            <Card.Body>
              <ResponsiveContainer width="100%" height={250}>
                <RePieChart>
                  <Pie
                    data={expenseBreakdown.breakdown.map(b => ({
                      name: b.category_name || 'Other',
                      value: parseFloat(b.total)
                    }))}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {expenseBreakdown.breakdown.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                </RePieChart>
              </ResponsiveContainer>
            </Card.Body>
          </Card>
        ) : (
          <Card>
            <Card.Header>
              <h3 className="font-semibold text-gray-900">Expense by Category</h3>
            </Card.Header>
            <Card.Body className="text-center text-gray-500 py-12">
              No expense data available
            </Card.Body>
          </Card>
        )}

        {/* Budget vs Actual */}
        {budgetComparison && budgetComparison.comparisons && budgetComparison.comparisons.length > 0 ? (
          <Card>
            <Card.Header>
              <h3 className="font-semibold text-gray-900">Budget vs Actual</h3>
            </Card.Header>
            <Card.Body>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={budgetComparison.comparisons.map(c => ({
                  category: c.category_name || 'Other',
                  budget: parseFloat(c.budget_amount),
                  actual: parseFloat(c.actual_spent),
                }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v/1000000).toFixed(0)}M`} />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Legend />
                  <Bar dataKey="budget" fill="#3b82f6" name="Budget" />
                  <Bar dataKey="actual" fill="#ef4444" name="Actual" />
                </BarChart>
              </ResponsiveContainer>
            </Card.Body>
          </Card>
        ) : (
          <Card>
            <Card.Header>
              <h3 className="font-semibold text-gray-900">Budget vs Actual</h3>
            </Card.Header>
            <Card.Body className="text-center text-gray-500 py-12">
              No budget comparison available
            </Card.Body>
          </Card>
        )}
      </div>

      {/* Monthly Comparison */}
      {monthlyComparison && monthlyComparison.comparisons && monthlyComparison.comparisons.length > 0 && (
        <Card>
          <Card.Header>
            <h3 className="font-semibold text-gray-900">Month-over-Month Comparison</h3>
          </Card.Header>
          <Card.Body>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Month</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600">Income</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600">Expense</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600">Net</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyComparison.comparisons.map((row, i) => (
                    <tr key={i} className="border-b">
                      <td className="px-4 py-3 font-medium">{row.month}</td>
                      <td className="px-4 py-3 text-right text-success-600">{formatCurrency(row.income)}</td>
                      <td className="px-4 py-3 text-right text-danger-600">{formatCurrency(row.expense)}</td>
                      <td className={`px-4 py-3 text-right font-medium ${parseFloat(row.net) >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                        {formatCurrency(row.net)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {i < monthlyComparison.comparisons.length - 1 && (
                          <Badge variant={parseFloat(row.change_pct) >= 0 ? 'success' : 'danger'} size="sm">
                            {parseFloat(row.change_pct) >= 0 ? '+' : ''}{parseFloat(row.change_pct).toFixed(1)}%
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card.Body>
        </Card>
      )}
    </div>
  );
};

export default Analytics;
