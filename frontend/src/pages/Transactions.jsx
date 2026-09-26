import { useState, useEffect } from 'react';
import { Card, Spinner } from '../components/ui';
import { Plus, Search, Filter, ArrowUpRight, ArrowDownRight, RefreshCw, Trash2, X, ChevronDown, ScanText, MessageSquare, Edit2, Check } from 'lucide-react';
import { formatCurrency, formatDate } from '../utils/format';
import { TextParserModal } from '../components/parser/TextParserModal';
import { ReceiptScannerModal } from '../components/parser/ReceiptScannerModal';
import api from '../services/api';

const typeOptions = [
  { value: '', label: 'All' },
  { value: 'income', label: 'Income' },
  { value: 'expense', label: 'Expense' },
];

// Source badge component
const SourceBadge = ({ type }) => {
  const badges = {
    MANUAL: { label: 'Manual', color: 'bg-gray-100 text-gray-600' },
    OCR_RECEIPT: { label: 'Receipt', color: 'bg-purple-100 text-purple-600' },
    QRIS_TEXT: { label: 'QRIS', color: 'bg-blue-100 text-blue-600' },
    SMS_BANK: { label: 'SMS', color: 'bg-green-100 text-green-600' },
  };
  const badge = badges[type] || badges.MANUAL;
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>
      {badge.label}
    </span>
  );
};

export const Transactions = () => {
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [filters, setFilters] = useState({ type: '', search: '' });
  const [selectedTx, setSelectedTx] = useState(null);
  const [showTextParser, setShowTextParser] = useState(false);
  const [showReceiptScanner, setShowReceiptScanner] = useState(false);
  
  // Edit mode state
  const [editingTx, setEditingTx] = useState(null);
  const [editForm, setEditForm] = useState({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [txRes, accRes, catRes] = await Promise.all([
        api.transactions.list({ limit: 100 }),
        api.accounts.list(),
        api.categories.list(),
      ]);
      setTransactions(Array.isArray(txRes) ? txRes : []);
      setAccounts(Array.isArray(accRes) ? accRes : []);
      setCategories(Array.isArray(catRes) ? catRes : []);
    } catch (err) {
      console.error('Failed to fetch transactions:', err);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this transaction?')) return;
    try {
      await api.transactions.delete(id);
      fetchData();
    } catch (err) {
      console.error('Failed to delete transaction:', err);
      alert('Failed to delete: ' + (err.message || 'Unknown error'));
    }
  };

  // Edit functions
  const startEdit = (tx) => {
    setEditingTx(tx.id);
    setEditForm({
      description: tx.description || '',
      amount: tx.amount,
      type: tx.type,
      date: tx.date,
      category_id: tx.category_id,
      account_id: tx.account_id,
    });
  };

  const cancelEdit = () => {
    setEditingTx(null);
    setEditForm({});
  };

  const saveEdit = async (id) => {
    try {
      await api.transactions.update(id, editForm);
      setEditingTx(null);
      setEditForm({});
      fetchData();
    } catch (err) {
      console.error('Failed to update transaction:', err);
      alert('Failed to update: ' + (err.message || 'Unknown error'));
    }
  };

  // Filter transactions
  const filteredTransactions = transactions.filter(tx => {
    if (filters.type && tx.type !== filters.type) return false;
    if (filters.search) {
      const search = filters.search.toLowerCase();
      const desc = (tx.description || '').toLowerCase();
      const cat = (categories.find(c => c.id === tx.category_id)?.name || '').toLowerCase();
      if (!desc.includes(search) && !cat.includes(search)) return false;
    }
    return true;
  });

  // Group by date
  const groupedTx = filteredTransactions.reduce((acc, tx) => {
    const date = tx.date;
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
    <div className="space-y-4 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
          <p className="text-sm text-gray-500">{filteredTransactions.length} transactions</p>
        </div>
        <button
          onClick={() => window.location.href = '/add'}
          className="p-3 bg-primary-500 text-white rounded-xl shadow-lg active:bg-primary-600"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Smart Parser Buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => setShowTextParser(true)}
          className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-200 active:bg-blue-100"
        >
          <MessageSquare className="w-5 h-5" />
          <span className="font-medium">Parse SMS / QRIS</span>
        </button>
        <button
          onClick={() => setShowReceiptScanner(true)}
          className="flex-1 flex items-center justify-center gap-2 py-3 bg-purple-50 text-purple-600 rounded-xl border border-purple-200 active:bg-purple-100"
        >
          <ScanText className="w-5 h-5" />
          <span className="font-medium">Scan Receipt</span>
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
        <button
          onClick={fetchData}
          className="p-3 bg-white rounded-2xl shadow-sm text-gray-600 active:bg-gray-50"
        >
          <RefreshCw className="w-5 h-5" />
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
            className="px-6 py-3 bg-primary-500 text-white rounded-xl font-medium shadow-lg active:bg-primary-600"
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
                  const isEditing = editingTx === tx.id;

                  // Edit mode
                  if (isEditing) {
                    return (
                      <div key={tx.id} className="bg-white rounded-2xl p-4 shadow-sm border-2 border-primary-500">
                        <div className="space-y-3">
                          <input
                            type="text"
                            value={editForm.description || ''}
                            onChange={(e) => setEditForm(f => ({ ...f, description: e.target.value }))}
                            placeholder="Description"
                            className="w-full px-3 py-2 border rounded-lg"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="number"
                              value={editForm.amount || 0}
                              onChange={(e) => setEditForm(f => ({ ...f, amount: parseFloat(e.target.value) }))}
                              className="px-3 py-2 border rounded-lg"
                            />
                            <input
                              type="date"
                              value={editForm.date || ''}
                              onChange={(e) => setEditForm(f => ({ ...f, date: e.target.value }))}
                              className="px-3 py-2 border rounded-lg"
                            />
                          </div>
                          <div className="flex gap-2">
                            <select
                              value={editForm.category_id || ''}
                              onChange={(e) => setEditForm(f => ({ ...f, category_id: parseInt(e.target.value) || null }))}
                              className="flex-1 px-3 py-2 border rounded-lg"
                            >
                              <option value="">Select Category</option>
                              {categories.filter(c => c.type === editForm.type).map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                            <select
                              value={editForm.account_id || ''}
                              onChange={(e) => setEditForm(f => ({ ...f, account_id: parseInt(e.target.value) }))}
                              className="flex-1 px-3 py-2 border rounded-lg"
                            >
                              <option value="">Select Account</option>
                              {accounts.map(a => (
                                <option key={a.id} value={a.id}>{a.name}</option>
                              ))}
                            </select>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={cancelEdit}
                              className="flex-1 py-2 bg-gray-100 text-gray-600 rounded-lg"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => saveEdit(tx.id)}
                              className="flex-1 py-2 bg-primary-500 text-white rounded-lg flex items-center justify-center gap-2"
                            >
                              <Check className="w-4 h-4" /> Save
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // Normal display mode
                  return (
                    <div 
                      key={tx.id}
                      className="bg-white rounded-2xl p-4 shadow-sm active:bg-gray-50 cursor-pointer group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
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
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-gray-900 truncate">
                                {tx.description || category?.name || (tx.type === 'income' ? 'Income' : 'Expense')}
                              </p>
                              <SourceBadge type={tx.detection_type} />
                            </div>
                            <p className="text-sm text-gray-500 truncate">
                              {category?.name || account?.name || 'Unknown'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className={`font-bold text-lg ${
                              tx.type === 'income' ? 'text-success-600' : 'text-gray-900'
                            }`}>
                              {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                            </p>
                          </div>
                          {/* Action buttons */}
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => { e.stopPropagation(); startEdit(tx); }}
                              className="p-2 text-gray-400 hover:text-primary-500 hover:bg-gray-100 rounded-lg"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDelete(tx.id); }}
                              className="p-2 text-gray-400 hover:text-danger-500 hover:bg-red-50 rounded-lg"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
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

      {/* Parser Modals */}
      <TextParserModal
        isOpen={showTextParser}
        onClose={() => setShowTextParser(false)}
        onSuccess={() => {
          setShowTextParser(false);
          fetchData();
        }}
      />
      <ReceiptScannerModal
        isOpen={showReceiptScanner}
        onClose={() => setShowReceiptScanner(false)}
        onSuccess={() => {
          setShowReceiptScanner(false);
          fetchData();
        }}
      />
    </div>
  );
};

export default Transactions;
