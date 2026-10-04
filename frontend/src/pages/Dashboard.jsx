import { useState, useEffect, useCallback } from 'react';
import { Card, Button, Spinner, EmptyState } from '../components/ui';
import { 
  TrendingUp, TrendingDown, Wallet, PieChart, 
  Plus, Receipt, FileText, PiggyBank,
  ChevronRight, ChevronLeft, RefreshCw
} from 'lucide-react';
import api from '../services/api';
import { formatCurrency, formatDate } from '../utils/format';
import { useTranslation } from '../i18n';

// Time period options
const TIME_PERIODS = [
  { value: 'today', label: 'time.today', days: 1 },
  { value: 'week', label: 'time.this_week', days: 7 },
  { value: 'month', label: 'time.this_month', days: 30 },
  { value: 'year', label: 'time.this_year', days: 365 },
];

export const Dashboard = ({ onAddTransaction, onScanReceipt }) => {
  const { t, language } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [timePeriod, setTimePeriod] = useState('month');
  const [summary, setSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState([]);
  const [recentJobs, setRecentJobs] = useState([]); // Scan jobs
  
  // Get date range based on time period
  const getDateRange = () => {
    const end = new Date();
    const start = new Date();
    const period = TIME_PERIODS.find(p => p.value === timePeriod);
    
    if (timePeriod === 'today') {
      start.setHours(0, 0, 0, 0);
    } else if (timePeriod === 'week') {
      start.setDate(end.getDate() - 7);
    } else if (timePeriod === 'month') {
      start.setMonth(end.getMonth(), 1);
    } else if (timePeriod === 'year') {
      start.setMonth(0, 1);
    }
    
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    };
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { startDate, endDate } = getDateRange();
      
      // Fetch all data in parallel
      const [summaryRes, transRes, categoryRes, jobsRes] = await Promise.allSettled([
        api.dashboard.summary(startDate, endDate),
        api.transactions.list({ start_date: startDate, end_date: endDate, limit: 10 }),
        api.analytics.expenseBreakdown({ start_date: startDate, end_date: endDate, type: 'expense' }),
        api.scanJobs?.list ? api.scanJobs.list({ status: 'completed' }) : Promise.resolve({ jobs: [] }),
      ]);

      // Extract results
      if (summaryRes.status === 'fulfilled') {
        setSummary(summaryRes.value);
      }
      
      if (transRes.status === 'fulfilled') {
        const data = transRes.value;
        setTransactions(Array.isArray(data) ? data : (data.transactions || []));
      }
      
      if (categoryRes.status === 'fulfilled') {
        const data = categoryRes.value;
        if (data.categories) {
          setCategoryBreakdown(data.categories);
        } else if (Array.isArray(data)) {
          setCategoryBreakdown(data);
        }
      }
      
      if (jobsRes.status === 'fulfilled') {
        const data = jobsRes.value;
        setRecentJobs(data.jobs?.slice(0, 5) || []);
      }
    } catch (error) {
      console.error('Dashboard fetch error:', error);
    } finally {
      setLoading(false);
    }
  }, [timePeriod]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Calculate values
  const income = summary?.total_income || 0;
  const expense = summary?.total_expense || 0;
  const balance = income - expense;
  const transactionCount = transactions.length || summary?.transaction_count || 0;

  // Get transaction type color
  const getTypeColor = (type) => {
    if (type === 'income') return 'text-success-600';
    if (type === 'expense') return 'text-danger-600';
    return 'text-gray-600';
  };

  // Get transaction sign
  const getSign = (type) => {
    return type === 'income' ? '+' : '-';
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t('dashboard.title')}
          </h1>
          <p className="text-gray-500 mt-1">
            {new Date().toLocaleDateString(language === 'id' ? 'id-ID' : language === 'ja' ? 'ja-JP' : 'en-US', { 
              month: 'long', 
              year: 'numeric' 
            })}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Time Period Selector */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {TIME_PERIODS.map((period) => (
          <button
            key={period.value}
            onClick={() => setTimePeriod(period.value)}
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
              timePeriod === period.value
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {t(period.label)}
          </button>
        ))}
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Spinner size="lg" />
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Income Card */}
            <Card className="!p-5">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-lg bg-success-100 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-success-600" />
                </div>
              </div>
              <p className="text-sm text-gray-500 mt-3">{t('dashboard.income')}</p>
              <p className="text-xl font-bold text-success-600 mt-1">
                {formatCurrency(income)}
              </p>
            </Card>

            {/* Expense Card */}
            <Card className="!p-5">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-lg bg-danger-100 flex items-center justify-center">
                  <TrendingDown className="w-5 h-5 text-danger-600" />
                </div>
              </div>
              <p className="text-sm text-gray-500 mt-3">{t('dashboard.expense')}</p>
              <p className="text-xl font-bold text-danger-600 mt-1">
                {formatCurrency(expense)}
              </p>
            </Card>

            {/* Net Flow Card */}
            <Card className="!p-5">
              <div className="flex items-center justify-between">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  balance >= 0 ? 'bg-success-100' : 'bg-danger-100'
                }`}>
                  <Wallet className={`w-5 h-5 ${balance >= 0 ? 'text-success-600' : 'text-danger-600'}`} />
                </div>
              </div>
              <p className="text-sm text-gray-500 mt-3">{t('dashboard.net_flow')}</p>
              <p className={`text-xl font-bold mt-1 ${balance >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                {balance >= 0 ? '+' : ''}{formatCurrency(balance)}
              </p>
            </Card>

            {/* Transaction Count */}
            <Card className="!p-5">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-primary-600" />
                </div>
              </div>
              <p className="text-sm text-gray-500 mt-3">{t('dashboard.transactions_this_month').replace('bulan ini', '')}</p>
              <p className="text-xl font-bold text-gray-900 mt-1">
                {transactionCount}
              </p>
            </Card>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={onAddTransaction}
              className="flex flex-col items-center gap-2 p-4 bg-success-50 rounded-xl hover:bg-success-100 transition-colors"
            >
              <div className="w-12 h-12 rounded-full bg-success-500 flex items-center justify-center">
                <Plus className="w-6 h-6 text-white" />
              </div>
              <span className="text-sm font-medium text-success-700">{t('dashboard.add_transaction')}</span>
            </button>

            <button
              onClick={onScanReceipt}
              className="flex flex-col items-center gap-2 p-4 bg-purple-50 rounded-xl hover:bg-purple-100 transition-colors"
            >
              <div className="w-12 h-12 rounded-full bg-purple-500 flex items-center justify-center">
                <Receipt className="w-6 h-6 text-white" />
              </div>
              <span className="text-sm font-medium text-purple-700">{t('dashboard.scan_receipt')}</span>
            </button>

            <button
              onClick={() => window.location.href = '/reports'}
              className="flex flex-col items-center gap-2 p-4 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors"
            >
              <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center">
                <PieChart className="w-6 h-6 text-white" />
              </div>
              <span className="text-sm font-medium text-blue-700">{t('dashboard.view_reports')}</span>
            </button>
          </div>

          {/* Two Column Layout */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Expense by Category */}
            <Card>
              <div className="px-5 py-4 border-b flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">{t('dashboard.expense_by_category')}</h3>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </div>
              <div className="p-5">
                {categoryBreakdown.length > 0 ? (
                  <div className="space-y-3">
                    {categoryBreakdown.slice(0, 8).map((cat, index) => {
                      const percentage = cat.percentage || (expense > 0 ? (cat.amount / expense) * 100 : 0);
                      const colors = [
                        'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500',
                        'bg-teal-500', 'bg-blue-500', 'bg-indigo-500', 'bg-purple-500'
                      ];
                      return (
                        <div key={index}>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="text-gray-700">{cat.name || cat.category_name || 'Other'}</span>
                            <span className="font-medium text-gray-900">
                              {formatCurrency(cat.amount)} ({percentage.toFixed(1)}%)
                            </span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${colors[index % colors.length]} rounded-full`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <PieChart className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>{t('transaction.no_transactions')}</p>
                  </div>
                )}
              </div>
            </Card>

            {/* Recent Transactions */}
            <Card>
              <div className="px-5 py-4 border-b flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">{t('dashboard.recent_transactions')}</h3>
                <button 
                  onClick={() => window.location.href = '/transactions'}
                  className="text-sm text-primary-600 hover:text-primary-700"
                >
                  {t('dashboard.view_all')}
                </button>
              </div>
              <div className="divide-y">
                {transactions.length > 0 ? (
                  transactions.slice(0, 5).map((trans, index) => (
                    <div key={trans.id || index} className="px-5 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          trans.type === 'income' ? 'bg-success-100 text-success-600' : 'bg-danger-100 text-danger-600'
                        }`}>
                          {trans.type === 'income' ? (
                            <TrendingUp className="w-5 h-5" />
                          ) : (
                            <TrendingDown className="w-5 h-5" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {trans.description || trans.merchant_name || 'Transaction'}
                          </p>
                          <p className="text-sm text-gray-500">
                            {trans.category_name || trans.category?.name || 'Uncategorized'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold ${getTypeColor(trans.type)}`}>
                          {getSign(trans.type)}{formatCurrency(trans.amount)}
                        </p>
                        <p className="text-xs text-gray-400">
                          {trans.date ? formatDate(trans.date) : ''}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="px-5 py-8 text-center">
                    <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-gray-500">{t('transaction.no_transactions')}</p>
                    <Button size="sm" className="mt-3" onClick={onAddTransaction}>
                      <Plus className="w-4 h-4 mr-1" />
                      {t('dashboard.add_transaction')}
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Pending Scan Jobs */}
          {recentJobs.length > 0 && (
            <Card className="border-primary-200 bg-primary-50">
              <div className="px-5 py-4 border-b border-primary-200">
                <h3 className="font-semibold text-primary-900 flex items-center gap-2">
                  <Receipt className="w-5 h-5" />
                  Scan Results Ready
                </h3>
              </div>
              <div className="divide-y">
                {recentJobs.map((job, index) => (
                  <div key={job.job_id || index} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-primary-900">{job.filename || 'Receipt'}</p>
                      <p className="text-sm text-primary-600">
                        {t('scanner.success')} - {job.confidence}% confidence
                      </p>
                    </div>
                    <Button size="sm" variant="outline" className="border-primary-300">
                      View
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default Dashboard;
