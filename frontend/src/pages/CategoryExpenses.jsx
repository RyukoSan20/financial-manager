import { useState, useEffect, useCallback } from 'react';
import { Card, Button, Spinner, Badge, EmptyState, Modal } from '../components/ui';
import { 
  TrendingDown, PieChart, ChevronRight, ChevronDown, 
  Filter, RefreshCw, Edit2, Trash2, Search
} from 'lucide-react';
import api from '../services/api';
import { formatCurrency, formatDate } from '../utils/format';
import { showNotification } from '../components/notifications/NotificationHelper';
import { useTranslation } from '../i18n';

// Default categories
const DEFAULT_CATEGORIES = [
  { id: 1, name: 'Makanan', name_en: 'Food', name_ja: '食品', icon: '🍔', color: 'bg-orange-100 text-orange-600' },
  { id: 2, name: 'Transport', name_en: 'Transport', name_ja: '交通', icon: '🚗', color: 'bg-blue-100 text-blue-600' },
  { id: 3, name: 'Belanja', name_en: 'Shopping', name_ja: '買い物', icon: '🛒', color: 'bg-pink-100 text-pink-600' },
  { id: 4, name: 'Tagihan', name_en: 'Bills', name_ja: '請求', icon: '📄', color: 'bg-purple-100 text-purple-600' },
  { id: 5, name: 'Kesehatan', name_en: 'Health', name_ja: '健康', icon: '💊', color: 'bg-red-100 text-red-600' },
  { id: 6, name: 'Hiburan', name_en: 'Entertainment', name_ja: '娯楽', icon: '🎬', color: 'bg-yellow-100 text-yellow-600' },
  { id: 7, name: 'Pendidikan', name_en: 'Education', name_ja: '教育', icon: '📚', color: 'bg-indigo-100 text-indigo-600' },
  { id: 8, name: 'Rumah', name_en: 'Home', name_ja: '家', icon: '🏠', color: 'bg-green-100 text-green-600' },
  { id: 9, name: 'Asuransi', name_en: 'Insurance', name_ja: '保険', icon: '🛡️', color: 'bg-cyan-100 text-cyan-600' },
  { id: 10, name: 'Jajan', name_en: 'Snacks', name_ja: 'おやつ', icon: '🍿', color: 'bg-amber-100 text-amber-600' },
  { id: 11, name: 'Masa Depan', name_en: 'Future', name_ja: '将来', icon: '🚀', color: 'bg-violet-100 text-violet-600' },
  { id: 12, name: 'Investasi', name_en: 'Investment', name_ja: '投資', icon: '📈', color: 'bg-emerald-100 text-emerald-600' },
];

export const CategoryExpenses = () => {
  const { t, language } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState([]);
  const [expandedCategories, setExpandedCategories] = useState({});
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [transRes, catRes, breakdownRes] = await Promise.allSettled([
        api.transactions.list({
          start_date: dateRange.start,
          end_date: dateRange.end,
          type: 'expense',
          limit: 1000
        }),
        api.categories.list('expense'),
        api.analytics.expenseBreakdown({
          start_date: dateRange.start,
          end_date: dateRange.end,
          type: 'expense'
        })
      ]);

      // Handle transactions
      let transData = [];
      if (transRes.status === 'fulfilled') {
        transData = Array.isArray(transRes.value) 
          ? transRes.value 
          : (transRes.value.transactions || []);
      }
      setTransactions(transData);

      // Handle categories
      let catData = [];
      if (catRes.status === 'fulfilled') {
        catData = Array.isArray(catRes.value) ? catRes.value : [];
      }
      // Merge with default categories
      const mergedCategories = [...DEFAULT_CATEGORIES];
      catData.forEach(cat => {
        if (!mergedCategories.find(c => c.id === cat.id)) {
          mergedCategories.push({
            id: cat.id,
            name: cat.name,
            name_en: cat.name,
            name_ja: cat.name,
            icon: '📁',
            color: 'bg-gray-100 text-gray-600'
          });
        }
      });
      setCategories(mergedCategories);

      // Handle breakdown
      if (breakdownRes.status === 'fulfilled') {
        const data = breakdownRes.value;
        setCategoryBreakdown(data.categories || (Array.isArray(data) ? data : []));
      }
    } catch (error) {
      console.error('Failed to fetch category expenses:', error);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Group transactions by category
  const groupedByCategory = transactions.reduce((acc, trans) => {
    const catId = trans.category_id || 'uncategorized';
    if (!acc[catId]) {
      acc[catId] = [];
    }
    acc[catId].push(trans);
    return acc;
  }, {});

  // Calculate total per category
  const categoryTotals = Object.entries(groupedByCategory).reduce((acc, [catId, transList]) => {
    const total = transList.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
    acc[catId] = total;
    return acc;
  }, {});

  // Get category info
  const getCategoryInfo = (catId) => {
    if (catId === 'uncategorized') {
      return { name: 'Uncategorized', icon: '📁', color: 'bg-gray-100 text-gray-600' };
    }
    const cat = categories.find(c => c.id === parseInt(catId));
    return cat || { name: `Category ${catId}`, icon: '📁', color: 'bg-gray-100 text-gray-600' };
  };

  // Get display name based on language
  const getDisplayName = (cat) => {
    if (!cat) return 'Unknown';
    if (language === 'en') return cat.name_en || cat.name;
    if (language === 'ja') return cat.name_ja || cat.name;
    return cat.name;
  };

  // Toggle category expansion
  const toggleCategory = (catId) => {
    setExpandedCategories(prev => ({
      ...prev,
      [catId]: !prev[catId]
    }));
  };

  // Filter transactions by search
  const filteredTransactions = transactions.filter(trans => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      (trans.description || '').toLowerCase().includes(query) ||
      (trans.merchant_name || '').toLowerCase().includes(query) ||
      (trans.location || '').toLowerCase().includes(query)
    );
  });

  // Edit transaction
  const handleEdit = (trans) => {
    setEditingTransaction(trans);
    setShowEditModal(true);
  };

  // Delete transaction
  const handleDelete = async (id) => {
    if (!confirm('Delete this transaction?')) return;
    try {
      await api.transactions.delete(id);
      showNotification({
        type: 'success',
        title: '✅ Deleted',
        message: 'Transaction deleted successfully',
        category: 'transaction'
      });
      fetchData();
    } catch (error) {
      showNotification({
        type: 'error',
        title: '❌ Failed',
        message: 'Failed to delete transaction',
        category: 'transaction'
      });
    }
  };

  // Total expense
  const totalExpense = Object.values(categoryTotals).reduce((sum, val) => sum + val, 0);

  // Get transaction type color
  const getTypeColor = (type) => {
    if (type === 'income') return 'text-success-600';
    return 'text-danger-600';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t('category_expenses.title', 'Expense by Category')}
          </h1>
          <p className="text-gray-500 mt-1">
            {new Date(dateRange.start).toLocaleDateString(language === 'id' ? 'id-ID' : language === 'ja' ? 'ja-JP' : 'en-US', { month: 'long', year: 'numeric' })}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="!p-4">
          <p className="text-sm text-gray-500">{t('dashboard.expense', 'Expense')}</p>
          <p className="text-xl font-bold text-danger-600 mt-1">
            {formatCurrency(totalExpense)}
          </p>
        </Card>
        <Card className="!p-4">
          <p className="text-sm text-gray-500">{t('category_expenses.categories', 'Categories')}</p>
          <p className="text-xl font-bold text-gray-900 mt-1">
            {Object.keys(groupedByCategory).length}
          </p>
        </Card>
        <Card className="!p-4">
          <p className="text-sm text-gray-500">{t('category_expenses.transactions', 'Transactions')}</p>
          <p className="text-xl font-bold text-gray-900 mt-1">
            {transactions.length}
          </p>
        </Card>
        <Card className="!p-4">
          <p className="text-sm text-gray-500">{t('category_expenses.avg', 'Avg/Category')}</p>
          <p className="text-xl font-bold text-gray-900 mt-1">
            {formatCurrency(Object.keys(groupedByCategory).length > 0 ? totalExpense / Object.keys(groupedByCategory).length : 0)}
          </p>
        </Card>
      </div>

      {/* Date Range Filter */}
      <Card className="!p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">From:</span>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="px-3 py-2 border rounded-lg text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">To:</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="px-3 py-2 border rounded-lg text-sm"
            />
          </div>
          <div className="flex-1">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder={t('common.search', 'Search...')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Category List */}
      {Object.keys(groupedByCategory).length === 0 ? (
        <EmptyState
          icon={<PieChart className="w-8 h-8 text-gray-400" />}
          title={t('category_expenses.no_expenses', 'No expenses recorded')}
          description={t('category_expenses.no_expenses_desc', 'Start tracking your expenses to see breakdown by category')}
        />
      ) : (
        <div className="space-y-3">
          {Object.entries(groupedByCategory)
            .sort(([,a], [,b]) => {
              const totalA = categoryTotals[a] || 0;
              const totalB = categoryTotals[b] || 0;
              return totalB - totalA;
            })
            .map(([catId, transList]) => {
              const catInfo = getCategoryInfo(catId);
              const catTotal = categoryTotals[catId] || 0;
              const percentage = totalExpense > 0 ? (catTotal / totalExpense) * 100 : 0;
              const isExpanded = expandedCategories[catId];
              
              return (
                <Card key={catId} className="!p-0 overflow-hidden">
                  {/* Category Header */}
                  <button
                    onClick={() => toggleCategory(catId)}
                    className="w-full !p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${catInfo.color}`}>
                        <span className="text-lg">{catInfo.icon}</span>
                      </div>
                      <div className="text-left">
                        <p className="font-semibold text-gray-900">
                          {getDisplayName(catInfo)}
                        </p>
                        <p className="text-sm text-gray-500">
                          {transList.length} {t('category_expenses.transactions', 'transactions')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-bold text-danger-600">
                          {formatCurrency(catTotal)}
                        </p>
                        <p className="text-sm text-gray-500">
                          {percentage.toFixed(1)}%
                        </p>
                      </div>
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </button>

                  {/* Transaction List (Expandable) */}
                  {isExpanded && (
                    <div className="border-t divide-y">
                      {transList
                        .filter(trans => {
                          if (!searchQuery) return true;
                          const query = searchQuery.toLowerCase();
                          return (
                            (trans.description || '').toLowerCase().includes(query) ||
                            (trans.merchant_name || '').toLowerCase().includes(query) ||
                            (trans.location || '').toLowerCase().includes(query)
                          );
                        })
                        .sort((a, b) => new Date(b.date) - new Date(a.date))
                        .map((trans) => (
                          <div key={trans.id} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50">
                            <div className="flex-1">
                              <p className="font-medium text-gray-900">
                                {trans.description || trans.merchant_name || 'Expense'}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                {trans.merchant_name && (
                                  <span className="text-xs text-gray-500">
                                    🏪 {trans.merchant_name}
                                  </span>
                                )}
                                {trans.location && (
                                  <span className="text-xs text-gray-500">
                                    📍 {trans.location}
                                  </span>
                                )}
                                <span className="text-xs text-gray-400">
                                  {formatDate(trans.date)}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <p className={`font-semibold ${getTypeColor(trans.type)}`}>
                                {trans.type === 'income' ? '+' : '-'}{formatCurrency(trans.amount)}
                              </p>
                              <div className="flex gap-1">
                                <button
                                  onClick={() => handleEdit(trans)}
                                  className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDelete(trans.id)}
                                  className="p-1.5 text-gray-400 hover:text-danger-600 hover:bg-danger-50 rounded"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </Card>
              );
            })}
        </div>
      )}

      {/* Edit Transaction Modal */}
      {showEditModal && editingTransaction && (
        <EditTransactionModal
          isOpen={showEditModal}
          onClose={() => { setShowEditModal(false); setEditingTransaction(null); }}
          transaction={editingTransaction}
          onSave={() => {
            setShowEditModal(false);
            setEditingTransaction(null);
            fetchData();
          }}
        />
      )}
    </div>
  );
};

// Edit Transaction Modal Component
const EditTransactionModal = ({ isOpen, onClose, transaction, onSave }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    amount: '',
    description: '',
    merchant_name: '',
    location: '',
    date: '',
    category_id: '',
  });

  useEffect(() => {
    if (transaction) {
      setForm({
        amount: transaction.amount?.toString() || '',
        description: transaction.description || '',
        merchant_name: transaction.merchant_name || '',
        location: transaction.location || '',
        date: transaction.date || '',
        category_id: transaction.category_id?.toString() || '',
      });
    }
  }, [transaction]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.transactions.update(transaction.id, {
        amount: parseFloat(form.amount),
        description: form.description,
        merchant_name: form.merchant_name,
        location: form.location,
        date: form.date,
        category_id: form.category_id ? parseInt(form.category_id) : null,
      });
      showNotification({
        type: 'success',
        title: '✅ Updated',
        message: 'Transaction updated successfully',
        category: 'transaction'
      });
      onSave();
    } catch (error) {
      showNotification({
        type: 'error',
        title: '❌ Failed',
        message: 'Failed to update transaction',
        category: 'transaction'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('transaction.edit', 'Edit Transaction')} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('transaction.amount', 'Amount')}
          </label>
          <input
            type="number"
            step="0.01"
            required
            value={form.amount}
            onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))}
            className="w-full px-4 py-2 border rounded-lg"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('transaction.description', 'Description')}
          </label>
          <input
            type="text"
            value={form.description}
            onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
            className="w-full px-4 py-2 border rounded-lg"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('transaction.merchant', 'Merchant Name')}
          </label>
          <input
            type="text"
            value={form.merchant_name}
            onChange={(e) => setForm(f => ({ ...f, merchant_name: e.target.value }))}
            className="w-full px-4 py-2 border rounded-lg"
            placeholder="e.g., CIMORY, Indomaret"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('transaction.location', 'Location')}
          </label>
          <input
            type="text"
            value={form.location}
            onChange={(e) => setForm(f => ({ ...f, location: e.target.value }))}
            className="w-full px-4 py-2 border rounded-lg"
            placeholder="e.g., Jakarta"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('transaction.date', 'Date')}
          </label>
          <input
            type="date"
            required
            value={form.date}
            onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))}
            className="w-full px-4 py-2 border rounded-lg"
          />
        </div>

        <div className="flex gap-3 pt-4">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1">
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button type="submit" loading={loading} className="flex-1">
            {t('common.save', 'Save')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default CategoryExpenses;
