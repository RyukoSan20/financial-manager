// Dashboard v2.1
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, Spinner } from '../components/ui';
import { 
  TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight, 
  Target, CreditCard, ChevronRight, RefreshCw, PiggyBank, Receipt
} from 'lucide-react';
import { formatCurrency, formatPercent, formatDate } from '../utils/format';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import api from '../services/api';

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export const Dashboard = () => {
  const [data, setData] = useState(null);
  const [cashFlow, setCashFlow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryRes, cashFlowRes] = await Promise.all([
        api.dashboard.summary(),
        api.dashboard.cashFlow(),
      ]);
      setData(summaryRes);
      setCashFlow(cashFlowRes);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      setError(err.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="mt-4 text-gray-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
        <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <Wallet className="w-10 h-10 text-gray-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">No Data Yet</h2>
        <p className="text-gray-500 text-center mb-6">Add your first account to get started</p>
        <Link 
          to="/accounts"
          className="px-6 py-3 bg-primary-500 text-white rounded-xl font-medium shadow-lg active:bg-primary-600 touch-manipulation"
        >
          Add Account
        </Link>
      </div>
    );
  }

  const {
    total_balance = 0,
    total_income_month = 0,
    total_expense_month = 0,
    net_cash_flow = 0,
    saving_rate = 0,
    total_budget = 0,
    remaining_budget = 0,
    budget_utilization = 0,
    expense_by_category = {},
    account_count = 0
  } = data;

  const chartData = cashFlow?.monthly?.map(m => ({
    month: m.month?.slice(0, 3) || '',
    Income: parseFloat(m.income) || 0,
    Expense: parseFloat(m.expense) || 0,
    Net: parseFloat(m.net) || 0
  })) || [];

  const pieData = Object.entries(expense_by_category)
    .map(([name, amount]) => ({ name, value: parseFloat(amount) }))
    .filter(d => d.value > 0);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500">{formatDate(new Date().toISOString(), 'long')}</p>
        </div>
        <button 
          onClick={fetchData}
          className="p-2.5 text-gray-500 active:bg-gray-100 rounded-xl touch-manipulation"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Balance Card - Mobile Optimized */}
      <div className="bg-gradient-to-br from-primary-500 to-primary-600 rounded-3xl p-6 text-white shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <p className="text-primary-100 text-sm font-medium">Total Balance</p>
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <Wallet className="w-5 h-5 text-white" />
          </div>
        </div>
        <p className="text-4xl font-bold mb-1">{formatCurrency(total_balance)}</p>
        <p className="text-primary-100 text-sm">{account_count} accounts</p>
      </div>

      {/* Quick Stats - Horizontal Scroll on Mobile */}
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 lg:mx-0 lg:px-0 no-scrollbar snap-x">
        {/* Income */}
        <div className="flex-shrink-0 w-36 bg-white rounded-2xl p-4 shadow-sm snap-start">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-success-100 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4 text-success-600" />
            </div>
          </div>
          <p className="text-xs text-gray-500">Income</p>
          <p className="text-lg font-bold text-success-600">{formatCurrency(total_income_month)}</p>
        </div>

        {/* Expense */}
        <div className="flex-shrink-0 w-36 bg-white rounded-2xl p-4 shadow-sm snap-start">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-danger-100 flex items-center justify-center">
              <ArrowDownRight className="w-4 h-4 text-danger-600" />
            </div>
          </div>
          <p className="text-xs text-gray-500">Expense</p>
          <p className="text-lg font-bold text-danger-600">{formatCurrency(total_expense_month)}</p>
        </div>

        {/* Net Cash Flow */}
        <div className="flex-shrink-0 w-36 bg-white rounded-2xl p-4 shadow-sm snap-start">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${net_cash_flow >= 0 ? 'bg-success-100' : 'bg-danger-100'}`}>
              {net_cash_flow >= 0 ? (
                <TrendingUp className="w-4 h-4 text-success-600" />
              ) : (
                <TrendingDown className="w-4 h-4 text-danger-600" />
              )}
            </div>
          </div>
          <p className="text-xs text-gray-500">Net Flow</p>
          <p className={`text-lg font-bold ${net_cash_flow >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
            {formatCurrency(net_cash_flow)}
          </p>
        </div>

        {/* Saving Rate */}
        <div className="flex-shrink-0 w-36 bg-white rounded-2xl p-4 shadow-sm snap-start">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center">
              <PiggyBank className="w-4 h-4 text-primary-600" />
            </div>
          </div>
          <p className="text-xs text-gray-500">Saving Rate</p>
          <p className="text-lg font-bold text-primary-600">{formatPercent(parseFloat(saving_rate) * 100)}</p>
        </div>
      </div>

      {/* Cash Flow Chart */}
      {chartData.length > 0 && (
        <Card className="overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Cash Flow</h3>
            <p className="text-sm text-gray-500">Last 6 months</p>
          </div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" tickFormatter={(v) => `${(v/1000000).toFixed(0)}M`} />
                <Tooltip 
                  formatter={(value) => formatCurrency(value)}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Area type="monotone" dataKey="Income" stackId="1" stroke="#22c55e" fill="#22c55e" fillOpacity={0.15} />
                <Area type="monotone" dataKey="Expense" stackId="2" stroke="#ef4444" fill="#ef4444" fillOpacity={0.15} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Budget Progress */}
      <Card className="overflow-hidden">
        <Link to="/budgets" className="block p-4 border-b border-gray-100 flex items-center justify-between active:bg-gray-50">
          <div>
            <h3 className="font-semibold text-gray-900">Budget Progress</h3>
            <p className="text-sm text-gray-500">
              {formatCurrency(total_budget - remaining_budget)} of {formatCurrency(total_budget)}
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </Link>
        <div className="p-4">
          <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${
                budget_utilization > 100 ? 'bg-danger-500' : 
                budget_utilization > 80 ? 'bg-warning-500' : 'bg-success-500'
              }`}
              style={{ width: `${Math.min(budget_utilization, 100)}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-sm">
            <span className="text-gray-500">{formatPercent(budget_utilization)} used</span>
            <span className={remaining_budget < 0 ? 'text-danger-600 font-medium' : 'text-gray-500'}>
              {formatCurrency(Math.abs(remaining_budget))} {remaining_budget < 0 ? 'over' : 'left'}
            </span>
          </div>
        </div>
      </Card>

      {/* Expense Breakdown */}
      {pieData.length > 0 && (
        <Card className="overflow-hidden">
          <Link to="/analytics" className="block p-4 border-b border-gray-100 flex items-center justify-between active:bg-gray-50">
            <div>
              <h3 className="font-semibold text-gray-900">Expenses by Category</h3>
              <p className="text-sm text-gray-500">This month</p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </Link>
          <div className="p-4">
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={140}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={30}
                    outerRadius={50}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {pieData.slice(0, 4).map((item, index) => (
                  <div key={item.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index] }} />
                      <span className="text-gray-600 truncate">{item.name}</span>
                    </div>
                    <span className="font-medium text-gray-900">{formatPercent((item.value / pieData.reduce((a, b) => a + b.value, 0)) * 100, 0)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link 
          to="/transactions"
          className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3 active:bg-gray-50 touch-manipulation"
        >
          <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
            <Receipt className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Transactions</p>
            <p className="text-sm text-gray-500">View history</p>
          </div>
        </Link>
        
        <Link 
          to="/goals"
          className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3 active:bg-gray-50 touch-manipulation"
        >
          <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
            <Target className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Goals</p>
            <p className="text-sm text-gray-500">Track progress</p>
          </div>
        </Link>
      </div>
    </div>
  );
};

export default Dashboard;
// trigger
