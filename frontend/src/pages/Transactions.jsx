import { useState, useEffect } from 'react';
import { Card, Spinner } from '../components/ui';
import { Plus, Search, Filter, ArrowUpRight, ArrowDownRight, RefreshCw, Trash2, X, ChevronDown } from 'lucide-react';
import { formatCurrency, formatDate } from '../utils/format';

const typeOptions = [
  { value: '', label: 'All' },
  { value: 'income', label: 'Income' },
  { value: 'expense', label: 'Expense' },
];

export const Transactions = () => {
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [filters, setFilters] = useState({ type: '', search: '' });
  const [selectedTx, setSelectedTx] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [txRes, accRes, catRes] = await Promise.all([
        fetch('/api/transactions/?limit=100').then(r => r.json()),
        fetch('/api/accounts/').then(r => r.json()),
        fetch('/api/categories/').then(r => r.json()),
      ]);
      setTransactions(Array.isArray(txRes) ? txRes : []);
      setAccounts(Array.isArray(accRes) ? accRes : []);
      setCategories(Array.isArray(catRes) ? catRes : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this transaction?')) return;
    try {
      await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const filteredTransactions = transactions.filter(tx => {
    if (filters.type && tx.type !== filters.type) return false;
    if (filters.search) {
      const search = filters.search.toLowerCase();
      return (
        tx.description?.toLowerCase().includes(search) ||
        tx.amount?.toString().includes(search)
      );
    }
    return true;
  });

  // Group by date
  const groupedTx = filteredTransactions.reduce((acc, tx) => {
    const date = tx.date || 'Unknown';
    if (!acc[date]) acc[date] = [];
    acc[date].push(tx);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="mt-4 text-gray-500">Loading transactions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
          <p className="text-sm text-gray-500">{filteredTransactions.length} transactions</p>
        </div>
        <button 
          onClick={() => window.location.href = '/add'}
          className="p-3 bg-primary-500 text-white rounded-xl shadow-lg active:bg-primary-600 touch-manipulation"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search transactions..."
            className="w-full pl-12 pr-4 py-3 bg-white border-0 rounded-2xl shadow-sm focus:ring-2 focus:ring-primary-500"
            value={filters.search}
            onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
          />
        </div>
        <button
          onClick={() => setShowFilter(!showFilter)}
          className={`p-3 rounded-2xl shadow-sm transition-colors ${
            filters.type ? 'bg-primary-100 text-primary-600' : 'bg-white text-gray-600'
          }`}
        >
          <Filter className="w-5 h-5" />
        </button>
      </div>

      {/* Filter Dropdown */}
      {showFilter && (
        <div className="bg-white rounded-2xl shadow-lg p-2 flex gap-2 animate-slideUp">
          {typeOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => {
                setFilters(f => ({ ...f, type: opt.value }));
                setShowFilter(false);
              }}
              className={`flex-1 py-2.5 rounded-xl font-medium text-sm transition-colors ${
                filters.type === opt.value
                  ? 'bg-primary-500 text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* Transactions List */}
      {filteredTransactions.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] p-4">
          <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <ArrowDownRight className="w-10 h-10 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No transactions yet</h3>
          <p className="text-gray-500 text-center mb-6">Start tracking your finances by adding your first transaction</p>
          <button 
            onClick={() => window.location.href = '/add'}
            className="px-6 py-3 bg-primary-500 text-white rounded-xl font-medium shadow-lg active:bg-primary-600 touch-manipulation"
          >
            Add Transaction
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedTx).map(([date, txs]) => (
            <div key={date}>
              <p className="text-sm font-medium text-gray-500 mb-2 px-1">{formatDate(date, 'full')}</p>
              <div className="space-y-2">
                {txs.map((tx) => {
                  const account = accounts.find(a => a.id === tx.account_id);
                  const category = categories.find(c => c.id === tx.category_id);
                  
                  return (
                    <div 
                      key={tx.id}
                      onClick={() => setSelectedTx(tx)}
                      className="bg-white rounded-2xl p-4 shadow-sm active:bg-gray-50 touch-manipulation cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                            tx.type === 'income' 
                              ? 'bg-success-100 text-success-600' 
                              : tx.type === 'expense'
                              ? 'bg-danger-100 text-danger-600'
                              : 'bg-blue-100 text-blue-600'
                          }`}>
                            {tx.type === 'income' ? (
                              <ArrowUpRight className="w-6 h-6" />
                            ) : (
                              <ArrowDownRight className="w-6 h-6" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 truncate">
                              {tx.description || category?.name || (tx.type === 'income' ? 'Income' : 'Expense')}
                            </p>
                            <p className="text-sm text-gray-500 truncate">
                              {category?.name || account?.name || 'Unknown'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold text-lg ${
                            tx.type === 'income' ? 'text-success-600' : 'text-gray-900'
                          }`}>
                            {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Transaction Detail Sheet */}
      {selectedTx && (
        <BottomSheet onClose={() => setSelectedTx(null)}>
          <div className="p-5">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">Transaction Details</h3>
              <button 
                onClick={() => setSelectedTx(null)}
                className="p-2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center ${
                selectedTx.type === 'income' ? 'bg-success-100' : 'bg-danger-100'
              }`}>
                {selectedTx.type === 'income' ? (
                  <ArrowUpRight className="w-8 h-8 text-success-600" />
                ) : (
                  <ArrowDownRight className="w-8 h-8 text-danger-600" />
                )}
              </div>

              <div className="text-center">
                <p className={`text-3xl font-bold ${
                  selectedTx.type === 'income' ? 'text-success-600' : 'text-gray-900'
                }`}>
                  {selectedTx.type === 'income' ? '+' : '-'}{formatCurrency(selectedTx.amount)}
                </p>
                <p className="text-gray-500 mt-1">{formatDate(selectedTx.date, 'full')}</p>
              </div>

              <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-500">Description</span>
                  <span className="font-medium text-gray-900">{selectedTx.description || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Type</span>
                  <span className={`font-medium ${
                    selectedTx.type === 'income' ? 'text-success-600' : 'text-danger-600'
                  }`}>
                    {selectedTx.type}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Account</span>
                  <span className="font-medium text-gray-900">
                    {accounts.find(a => a.id === selectedTx.account_id)?.name || '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Category</span>
                  <span className="font-medium text-gray-900">
                    {categories.find(c => c.id === selectedTx.category_id)?.name || '-'}
                  </span>
                </div>
              </div>

              <button
                onClick={() => {
                  handleDelete(selectedTx.id);
                  setSelectedTx(null);
                }}
                className="w-full py-3 bg-danger-50 text-danger-600 rounded-xl font-medium active:bg-danger-100 touch-manipulation"
              >
                Delete Transaction
              </button>
            </div>
          </div>
        </BottomSheet>
      )}
    </div>
  );
};

// Bottom Sheet Component
const BottomSheet = ({ isOpen = true, onClose, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div 
        className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-xl animate-slideUp max-h-[85vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center py-3">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>
        {/* Content */}
        <div className="overflow-y-auto max-h-[80vh]">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Transactions;
