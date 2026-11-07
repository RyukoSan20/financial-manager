import { useState, useEffect, useRef, useMemo } from 'react';
import { Card, Spinner, Badge } from '../components/ui';
import { Plus, Search, Filter, ArrowUpRight, ArrowDownRight, RefreshCw, Trash2, X, ChevronDown, ChevronUp, ScanText, MessageSquare, Edit2, Check, Camera, Clock, BellRing, Mic, ReceiptText, Users } from 'lucide-react';
import { formatCurrency, formatDate } from '../utils/format';
import { amountSign, isIncoming, isOutgoing } from '../utils/transactionSign';
import { TextParserModal } from '../components/parser/TextParserModal';
import { QRScannerModal } from '../components/parser/QRScannerModal';
import { ReceiptScannerModal } from '../components/parser/ReceiptScannerModal';
import { VoiceTransactionModal } from '../components/parser/VoiceTransactionModal';
import { notifyTransactionAdded, notifyTransactionDeleted, notifyTransactionUpdated, notifyError } from '../components/notifications/NotificationHelper';
import SingleAddButton, { isSingleAddOn } from '../components/common/SingleAddButton';
import api from '../services/api';
import { BreakdownViewer } from '../components/common/BreakdownViewer';
import ItemizedReceiptEditorModal from '../components/transactions/ItemizedReceiptEditorModal';
import TransactionEditForm from '../components/transactions/TransactionEditForm';
import ReceiptReviewModal from '../components/transactions/ReceiptReviewModal';
import { categoryName } from '../utils/categoryName';
import { useTranslation } from '../i18n';
import { batch1, fill } from '../i18n/keys_batch1';
import { toast } from '../contexts/ToastContext';
import { ask } from '../contexts/ConfirmContext';
import { ReconciliationBar } from '../components/fintech/ReconciliationBar';
import { useAdjustmentWriter } from '../components/fintech/useAdjustmentWriter';
import { heldCash } from '../utils/decisionWidgets';
import { buildFlag } from '../utils/featureFlags';

// Source badge component
const SourceBadge = ({ type, K }) => {
  const badges = {
    MANUAL: { label: K.manual, color: 'bg-gray-100 text-gray-600' },
    OCR_RECEIPT: { label: K.receipt, color: 'bg-purple-100 text-purple-600' },
    QRIS_TEXT: { label: K.qris, color: 'bg-blue-100 text-blue-600' },
    SMS_BANK: { label: K.sms, color: 'bg-green-100 text-green-600' },
  };
  const badge = badges[type] || badges.MANUAL;
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>
      {badge.label}
    </span>
  );
};

export const Transactions = () => {
  const { language, t } = useTranslation();
  const K = batch1[language]?.txns || batch1.id.txns;
  const typeOptions = [
    { value: '', label: K.all },
    { value: 'income', label: K.income },
    { value: 'expense', label: K.expense },
  ];
  // The reconciliation bar. Behind the switch, so the page is
  // unchanged when it is off.
  const fintech = buildFlag('FINTECH_SYNTHESIS');
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  // Whether the list could be read at all. This is not the same as
  // the list being empty, and the page has to tell them apart: a
  // reader with four transactions must never be told they have none
  // because the server answered with an error.
  const [loadError, setLoadError] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  // The filters the reader can apply to the list.
  //
  // The type and the category are the two questions a list of money is
  // asked most often: which way did it go, and what was it for. The
  // search box answers the third.
  const [filters, setFilters] = useState({
    type: '',
    category: '',
    search: '',
    status: '',
  });

  // Back to the whole list. A filter that cannot be undone is a
  // filter that hides money from the reader.
  const clearFilters = () =>
    setFilters({ type: '', category: '', search: '', status: '' });
  const [selectedTx, setSelectedTx] = useState(null);
  const [showTextParser, setShowTextParser] = useState(false);
  const [showReceiptScanner, setShowReceiptScanner] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  // A receipt that was read, or a transaction that was spoken, waiting
  // for the reader to look at it before it is saved.
  const [reviewReading, setReviewReading] = useState(null);
  // The transaction whose lines are being shared, when the reader
  // opens a bill that is already written down.
  const [splittingTx, setSplittingTx] = useState(null);
  const [prefillQRText, setPreFillQRText] = useState('');
  const [expandedTxId, setExpandedTxId] = useState(null);
  // The receipt being edited, if any. The editor is a window over the
  // page, so only one is ever open.
  const [editingReceipt, setEditingReceipt] = useState(null);
  // The card of the transaction that was just scanned. It is scrolled
  // into view, so the reader lands on the transaction rather than
  // having to look for it.
  const highlightRef = useRef(null);
  const [pendingCount, setPendingCount] = useState(0);
  // The transaction that was just scanned, asked for by the scan
  // result sheet so the reader lands on the right one.
  const [highlightId] = useState(() => {
    const raw = new URLSearchParams(window.location.search).get('highlight');
    return raw ? parseInt(raw, 10) : null;
  });
  // How many transactions have been asked for. The list is read in
  // blocks, because a reader with a year of spending behind them has
  // more than one screen of it, and there was no way to reach any of
  // it past the first hundred.
  const [limit, setLimit] = useState(100);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  
  // Edit mode state
  const [editingTx, setEditingTx] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  // Scroll to the transaction that was just scanned, once the list has
  // arrived. Without this the reader lands at the top of the page and
  // has to find the transaction themselves.
  useEffect(() => {
    if (!highlightId || loading || !transactions.length) return;
    const timer = setTimeout(() => {
      const node = highlightRef.current;
      if (node) node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
    return () => clearTimeout(timer);
  }, [highlightId, loading, transactions.length]);

  // The total the application holds. It is the sum of the balances of
  // the accounts, which is the same figure the accounts page shows,
  // so the two bars can be compared with each other.
  const accountTotal = useMemo(() => heldCash(accounts), [accounts]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [txRes, accRes, catRes, feedStatsRes] = await Promise.allSettled([
        api.transactions.list({ limit }),
        api.accounts.list(),
        api.categories.list(),
        api.get('/feed/stats').catch(() => null),
      ]);
      // A failure of the list is a failure of the list. It is not the
      // same as a list with nothing in it, and it must not be shown
      // as one.
      if (txRes.status === 'rejected') {
        setLoadError(txRes.reason?.message || 'Gagal memuat transaksi');
        setTransactions([]);
        setHasMore(false);
      } else {
        setLoadError(null);
        const rows = Array.isArray(txRes.value) ? txRes.value : [];
        setTransactions(rows);
        // A full block means there is probably more behind it.
        setHasMore(rows.length >= limit);
      }
      setAccounts(Array.isArray(accRes.value) ? accRes.value : []);
      setCategories(Array.isArray(catRes.value) ? catRes.value : []);
      if (feedStatsRes.status === 'fulfilled' && feedStatsRes.value) {
        setPendingCount(feedStatsRes.value.data?.pending_count || feedStatsRes.value.pending_count || 0);
      }
    } catch (err) {
      console.error('Failed to fetch transactions:', err);
      setLoadError(err?.message || 'Gagal memuat transaksi');
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }

  // The writer for the adjusting entry. It asks the reader first,
  // and it says afterwards whether the entry was made.
  const { createAdjustment } = useAdjustmentWriter({
    accounts,
    onDone: fetchData,
  });

  /**
   * Read the next block of transactions.
   *
   * The older ones are appended, so the list the reader is looking at
   * stays where it is.
   */
  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const next = limit + 100;
      const res = await api.transactions.list({ limit: next });
      const rows = Array.isArray(res) ? res : [];
      setTransactions(rows);
      setLimit(next);
      setHasMore(rows.length >= next);
    } catch (err) {
      console.error('Failed to load more transactions:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleDelete = async (id) => {
    if (!(await ask({ message: K.deleteConfirm, tone: 'danger' }))) return;
    try {
      await api.transactions.delete(id);
      fetchData();
      window.dispatchEvent(new Event('transactionUpdated'));
    } catch (err) {
      console.error('Failed to delete transaction:', err);
      toast.error(fill(K.deleteFailed, { message: err.message || K.unknown }));
    }
  };

  /**
   * Save a transaction created from a spoken phrase.
   *
   * The account is required by the API, so the first available account is
   * used when the user did not pick one. The category is matched by name
   * against the user's own category list - if the suggested category does
   * not exist, the transaction is saved without one rather than failing.
   */
  /**
   * Sharing a transaction that is already written down.
   *
   * The lines of the receipt are read, and the bill is brought up
   * with them, so the reader only has to say who had what.
   */
  const startSplit = async (tx) => {
    try {
      const receipt = await api.get(`/receipt-items/${tx.id}`);
      const items = receipt?.items || [];
      setSplittingTx({
        transaction_id: tx.id,
        amount: Number(tx.amount),
        type: tx.type,
        description: tx.description || '',
        date: tx.date,
        account_id: tx.account_id,
        category_id: tx.category_id,
        detection_type: tx.detection_type,
        items: items.map((item) => ({
          name: item.name || item.raw_name || '',
          quantity: Number(item.quantity) || 1,
          unit_price: Number(item.unit_price ?? 0) || 0,
        })),
      });
    } catch (e) {
      // A transaction without a receipt has only one line: itself.
      setSplittingTx({
        transaction_id: tx.id,
        amount: Number(tx.amount),
        type: tx.type,
        description: tx.description || '',
        date: tx.date,
        account_id: tx.account_id,
        category_id: tx.category_id,
        detection_type: tx.detection_type,
        items: [],
      });
    }
  };

  const handleVoiceSave = async (voice) => {
    const accountId = accounts[0]?.id;
    if (!accountId) {
      throw new Error(K.noAccountYet);
    }

    let categoryId = null;
    if (voice.category && categories.length > 0) {
      const match = categories.find(
        (c) => c.name?.toLowerCase() === String(voice.category).toLowerCase()
      );
      categoryId = match?.id || null;
    }

    await api.transactions.create({
      amount: Number(voice.amount),
      type: voice.transaction_type === 'income' ? 'income' : 'expense',
      description: voice.description || voice.merchant_name || K.voiceTransaction,
      date: new Date().toISOString().split('T')[0],
      account_id: parseInt(accountId),
      category_id: categoryId,
      merchant_name: voice.merchant_name || null,
      detection_type: 'VOICE',
      source: 'voice',
      // Idempotency key so a double-tap cannot create two transactions.
      client_request_id:
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `voice-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    });

    notifyTransactionAdded?.({
      amount: Number(voice.amount),
      description: voice.merchant_name || voice.description,
    });

    fetchData();
    window.dispatchEvent(new Event('transactionUpdated'));
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
    setSavingEdit(true);
    try {
      // Only the fields the reader can change are sent. The lines of
      // the bill and the calculation are not part of the update -
      // they are written down through their own routes, which keep
      // the two sides of the receipt in step.
      const payload = {
        description: editForm.description,
        amount: editForm.amount,
        date: editForm.date,
        category_id: editForm.category_id,
        account_id: editForm.account_id,
        // The place the reader gave, so it can be corrected.
        latitude: editForm.latitude ?? null,
        longitude: editForm.longitude ?? null,
        merchant_address: editForm.merchant_address || '',
        // The sub-category, which is the tag on the transaction.
        tags: editForm.tags || '',
      };

      await api.transactions.update(id, payload);
      setEditingTx(null);
      setEditForm({});
      fetchData();
      window.dispatchEvent(new Event('transactionUpdated'));
    } catch (err) {
      console.error('Failed to update transaction:', err);
      toast.error(fill(K.updateFailed, { message: err.message || K.unknown }));
    } finally {
      setSavingEdit(false);
    }
  };

  // Filter transactions
  const filteredTransactions = transactions.filter(tx => {
    if (filters.type && tx.type !== filters.type) return false;
    // The category, when one is chosen. A category with no transactions
    // simply brings nothing back, which is what was asked for.
    if (filters.category && String(tx.category_id) !== String(filters.category))
      return false;
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
          <p className="mt-4 text-gray-500">{K.loading}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">{K.title}</h1>
            {pendingCount > 0 && (
              <button 
                onClick={() => window.location.href = '/feed'}
                className="flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium hover:bg-yellow-200 transition-colors"
              >
                <BellRing className="w-4 h-4" />
                <span>{fill(K.pendingReview, { count: pendingCount })}</span>
              </button>
            )}
          </div>
          <p className="text-sm text-gray-500">{fill(K.count, { count: filteredTransactions.length })}</p>
        </div>
        {!isSingleAddOn() && (
          <button
            onClick={() => window.location.href = '/add'}
            className="p-3 bg-primary-600 text-white rounded-xl shadow-lg active:bg-primary-600"
          >
            <Plus className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* The one add button, in the same place on every page. */}
      <SingleAddButton href="/add" label={K.addTransaction} />

      {/* The reconciliation bar: the reader types in what their bank
          says, and the application says whether the figures agree.
          Behind the switch. */}
      {fintech && (
        <ReconciliationBar
          recorded={accountTotal}
          onCreateEntry={createAdjustment}
        />
      )}

      {/* Smart Parser Buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => setShowTextParser(true)}
          className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary-50 text-primary-600 rounded-xl border border-primary-200 active:bg-primary-100"
        >
          <MessageSquare className="w-5 h-5" />
          <span className="font-medium">{K.smsShort}</span>
        </button>
        <button
          onClick={() => setShowQRScanner(true)}
          className="flex-1 flex items-center justify-center gap-2 py-3 bg-purple-50 text-purple-600 rounded-xl border border-purple-200 active:bg-purple-100"
        >
          <ScanText className="w-5 h-5" />
          <span className="font-medium">{K.qrCode}</span>
        </button>
        <button
          onClick={() => setShowReceiptScanner(true)}
          className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-50 text-green-600 rounded-xl border border-green-200 active:bg-green-100"
        >
          <Camera className="w-5 h-5" />
          <span className="font-medium">{K.receiptShort}</span>
        </button>
        <button
          onClick={() => setShowVoiceModal(true)}
          className="flex-1 flex items-center justify-center gap-2 py-3 bg-orange-50 text-orange-600 rounded-xl border border-orange-200 active:bg-orange-100"
        >
          <Mic className="w-5 h-5" />
          <span className="font-medium">{K.voice}</span>
        </button>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder={K.searchPlaceholder}
            className="w-full pl-12 pr-4 py-3 bg-white border-0 rounded-2xl shadow-sm focus:ring-2 focus:ring-primary-500"
            value={filters.search}
            onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
          />
        </div>
        <button
          onClick={() => setShowFilter(!showFilter)}
          className={`p-3 rounded-2xl shadow-sm transition-colors ${
            filters.category ? 'bg-primary-100 text-primary-600' : 'bg-white text-gray-600'
          }`}
          title={K.filterByCategory}
          aria-label={K.filterByCategory}
          aria-expanded={showFilter}
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

      {/* The way the money went.
          These three choices are on the page, because a list of money
          is asked which way it went more often than anything else, and
          a reader should not have to find a small icon to answer it. */}
      <div className="flex gap-2">
        {typeOptions.map(opt => (
          <button
            key={opt.value}
            onClick={() =>
              setFilters(f => ({ ...f, type: f.type === opt.value ? '' : opt.value }))
            }
            aria-pressed={filters.type === opt.value}
            className={`flex-1 py-2.5 rounded-xl font-medium text-sm transition-colors ${
              filters.type === opt.value
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-white text-gray-600 shadow-sm'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* The category, when one is chosen. */}
      {showFilter && (
        <div className="bg-white rounded-2xl shadow-lg p-3 animate-slideUp space-y-3">
          <div className="flex gap-2">
            <select
              value={filters.category}
              onChange={(e) =>
                setFilters(f => ({ ...f, category: e.target.value }))
              }
              aria-label={K.filterByCategory}
              className="flex-1 px-3 py-2 border rounded-xl text-sm bg-white"
            >
              <option value="">{K.allCategories}</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>
                  {categoryName(c, language)}
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                clearFilters();
                setShowFilter(false);
              }}
              className="px-3 py-2 border rounded-xl text-sm text-gray-600 hover:bg-gray-50 whitespace-nowrap"
            >
              {K.clearFilters}
            </button>
          </div>
        </div>
      )}

      {/* Transactions List */}
      {filteredTransactions.length === 0 ? (
        loadError ? (
          /* The list could not be read. This is not an empty list,
             and it is not shown as one: the reader is told that the
             list could not be loaded, and given a way to try again. */
          <div className="flex flex-col items-center justify-center min-h-[40vh] p-4">
            <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mb-4">
              <RefreshCw className="w-10 h-10 text-red-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {t('transactions.loadFailed')}
            </h3>
            <p className="text-gray-500 text-center mb-6">
              {t('transactions.loadFailedDesc')}
            </p>
            <button
              onClick={() => fetchData()}
              className="px-6 py-3 bg-primary-600 text-white rounded-xl font-medium shadow-lg pressable"
            >
              {t('transactions.retry')}
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[40vh] p-4">
            <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <ArrowDownRight className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{K.noTransactions}</h3>
            <p className="text-gray-500 text-center mb-6">{K.noTransactionsDesc}</p>
            <button
              onClick={() => window.location.href = '/add'}
              className="px-6 py-3 bg-primary-600 text-white rounded-xl font-medium shadow-lg active:bg-primary-600"
            >
              {K.addTransaction}
            </button>
          </div>
        )
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedTx).map(([date, txs]) => (
            <div key={date}>
              <p className="text-sm font-medium text-gray-500 mb-2 px-1">{formatDate(date, 'full')}</p>
              <div className="space-y-2">
                {txs.map((tx, index) => {
                  const account = accounts.find(a => a.id === tx.account_id);
                  const category = categories.find(c => c.id === tx.category_id);
                  const isEditing = editingTx === tx.id;

                  // Edit mode
                  if (isEditing) {
                    // The edit form.
                    //
                    // It was five fields: what it was, how much, which
                    // day, which category, which account. A
                    // transaction recorded with the place, the lines
                    // of the bill, the discount, the tax and the
                    // person it was shared with could not be
                    // corrected with any of that.
                    //
                    // It carries what the add form carries now.
                    return (
                      <div key={tx.id} className="bg-white rounded-2xl p-4 shadow-sm border-2 border-primary-500">
                        <TransactionEditForm
                          transaction={tx}
                          categories={categories}
                          accounts={accounts}
                          language={language}
                          saving={savingEdit}
                          onChange={setEditForm}
                          onSave={() => saveEdit(tx.id)}
                          onCancel={cancelEdit}
                        />
                      </div>
                    );
                  }

                  // Normal display mode
                  const hasItems = tx.items && tx.items.length > 0;
                  const isExpanded = expandedTxId === tx.id;
                  const isHighlighted = highlightId === tx.id;
                  return (
                    <div 
                      key={tx.id}
                      id={`transaction-${tx.id}`}
                      ref={isHighlighted ? highlightRef : undefined}
                      className={`bg-white rounded-2xl p-4 shadow-sm active:bg-gray-50 cursor-pointer group ${
                        isHighlighted
                          ? 'ring-2 ring-primary-500 ring-offset-2 dark:ring-offset-gray-900'
                          : ''
                      } aurora-row money-list-row`}
                      style={{ '--money-row-index': Math.min(index, 12) }}
                      onClick={() => hasItems && setExpandedTxId(isExpanded ? null : tx.id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0 ${
                            isIncoming(tx.type)
                              ? 'bg-success-100 text-success-600'
                              : isOutgoing(tx.type)
                              ? 'bg-danger-100 text-danger-600'
                              : 'bg-blue-100 text-blue-600'
                          }`}>
                            {isIncoming(tx.type) ? (
                              <ArrowUpRight className="w-6 h-6" />
                            ) : (
                              <ArrowDownRight className="w-6 h-6" />
                            )}
                          </div>
                          {/* The text column.

                              It has to be allowed to shrink. Without
                              `min-w-0` on the row inside it, the
                              title kept the width of its own text
                              and was drawn on top of the amount: a
                              reader saw "Manu-Rp 25.000". */}
                          <div className="flex-1 min-w-0 pr-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <p className="font-semibold text-gray-900 truncate min-w-0">
                                {tx.description || (category ? categoryName(category, language) : null) || (tx.type === 'income' ? K.income : K.expense)}
                              </p>
                              <SourceBadge type={tx.detection_type} K={K} />
                              {tx.status === 'pending' && (
                                <span className="flex-shrink-0 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 px-2 py-0.5 text-xs font-medium">
                                  {K.pendingBadge}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-500 truncate">
                              {(category ? categoryName(category, language) : null) || account?.name || K.unknown}
                            </p>
                          </div>
                        </div>
                        {/* The money and the actions.

                            This part never shrinks and never wraps,
                            so the amount is always whole and always
                            in the same place. */}
                        <div className="flex items-start gap-2 sm:gap-3 shrink-0">
                          <div className="text-right shrink-0">
                            <p className={`font-bold text-base sm:text-lg whitespace-nowrap ${
                              isIncoming(tx.type) ? 'text-success-600' : 'text-gray-900'
                            }`}>
                              {amountSign(tx.type)}{formatCurrency(tx.amount, tx.currency)}
                            </p>
                          </div>
                          {/* Chevron dropdown - always visible */}
                          {hasItems && (
                            <button 
                              className="p-1 text-gray-400 hover:text-gray-600"
                              onClick={(e) => { e.stopPropagation(); setExpandedTxId(isExpanded ? null : tx.id); }}
                            >
                              {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                            </button>
                          )}
                          {/* The actions on this row.
                              They used to appear only when the pointer
                              hovered over the row. A touch screen has
                              no hover, so on a phone they were not
                              there at all. They are always drawn
                              now, and they are small and quiet so they
                              do not shout over the money. */}
                          <div className="flex gap-0.5 sm:gap-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); startEdit(tx); }}
                              className="p-2 text-gray-400 hover:text-primary-500 hover:bg-gray-100 rounded-lg"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            {/* Sharing this bill. The reader opens it
                                with the lines already written down, so
                                they only have to say who had what. */}
                            <button
                              onClick={(e) => { e.stopPropagation(); startSplit(tx); }}
                              className="p-2 text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg"
                              title={t('bill.splitTransaction')}
                              aria-label={t('bill.splitTransaction')}
                            >
                              <Users className="w-4 h-4" />
                            </button>
                            {/* Editing the lines of the receipt itself. */}
                            <button
                              onClick={(e) => { e.stopPropagation(); setEditingReceipt(tx); }}
                              className="p-2 text-gray-400 hover:text-purple-500 hover:bg-purple-50 rounded-lg"
                              title={K.editReceipt}
                            >
                              <ReceiptText className="w-4 h-4" />
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
                      {/* Receipt Items Dropdown (Accordion) */}
                      {hasItems && isExpanded && tx.items && tx.items.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <p className="text-xs font-semibold text-gray-500 mb-2">
                            {fill(K.itemsTitle, { count: (tx.items || []).filter(i => !i.is_discount).length })}
                            {(tx.items || []).some(i => i.is_discount) && (
                              <span className="ml-2 text-green-600">
                                {fill(K.includingDiscounts, { count: (tx.items || []).filter(i => i.is_discount).length })}
                              </span>
                            )}
                          </p>
                          <div className="space-y-1 bg-gray-50 rounded-lg p-2">
                            {(tx.items || []).map((item, idx) => {
                              const isDiscount = item.is_discount;
                              const price = Math.abs(item.total_price || 0);
                              return (
                                <div 
                                  key={idx} 
                                  className={`flex justify-between items-center text-sm ${isDiscount ? 'text-red-500 bg-red-50 -mx-2 px-2 rounded' : ''}`}
                                >
                                  <span className={`truncate flex-1 ${isDiscount ? 'font-medium' : 'text-gray-700'}`}>
                                    {isDiscount && <span className="mr-1">{K.discountTag}</span>}
                                    {item.name}
                                    {!isDiscount && (
                                      <span className="text-gray-400">
                                        ({item.quantity || 1}x @ {formatCurrency(item.price_per_unit || 0, item.currency)})
                                      </span>
                                    )}
                                  </span>
                                  <span className={`ml-2 whitespace-nowrap font-medium ${isDiscount ? '' : 'text-gray-600'}`}>
                                    {isDiscount ? '-' : ''}{formatCurrency(price)}
                                  </span>
                                </div>
                              );
                            })}
                            {/* Net Total */}
                            {(tx.items || []).some(i => i.is_discount) && (
                              <div className="flex justify-between items-center text-sm font-semibold border-t border-gray-200 pt-2 mt-2">
                                <span className="text-gray-700">{K.netTotal}</span>
                                <span className="text-gray-900">
                                  {formatCurrency((tx.items || []).reduce((sum, i) => {
                                    const price = i.total_price || 0;
                                    return i.is_discount ? sum - Math.abs(price) : sum + price;
                                  }, 0))}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* A transaction that did not come from a receipt
                          can still carry its own lines. */}
                      {!hasItems && (
                        <div className="mt-3">
                          <BreakdownViewer
                            parentType="transaction"
                            parentId={tx.id}
                            title={K.details}
                            compact
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* The older transactions. Without this, anything past the
              first hundred could not be reached at all. */}
          {hasMore && (
            <div className="flex justify-center py-4">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                {loadingMore ? K.loading : K.loadMore}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Parser Modals */}
      <TextParserModal
        isOpen={showTextParser}
        initialText={prefillQRText}
        onClose={() => { setShowTextParser(false); setPreFillQRText(''); }}
        onSuccess={() => {
          setShowTextParser(false);
          setPreFillQRText('');
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
        onReview={(reading) => setReviewReading(reading)}
      />
      <QRScannerModal
        isOpen={showQRScanner}
        onClose={() => setShowQRScanner(false)}
        onScan={(qrData) => {
          setShowQRScanner(false);
          setPreFillQRText(qrData);
          setShowTextParser(true);
        }}
      />
      <VoiceTransactionModal
        isOpen={showVoiceModal}
        onClose={() => setShowVoiceModal(false)}
        onSave={handleVoiceSave}
        onReview={(reading) => setReviewReading(reading)}
      />
      {/* What was read from paper, or spoken aloud, waiting for the
          reader to look at it before it is saved. */}
      <ReceiptReviewModal
        isOpen={!!reviewReading || !!splittingTx}
        reading={reviewReading || splittingTx}
        categories={categories}
        accounts={accounts}
        existingTransactions={transactions}
        onClose={() => {
          setReviewReading(null);
          setSplittingTx(null);
        }}
        onSaved={() => {
          setReviewReading(null);
          setSplittingTx(null);
          fetchData();
        }}
      />
      {/* The itemised receipt of one transaction, edited line by line. */}
      <ItemizedReceiptEditorModal
        isOpen={!!editingReceipt}
        transactionId={editingReceipt?.id}
        transactionAmount={editingReceipt?.amount}
        categories={categories}
        onClose={() => setEditingReceipt(null)}
        onSaved={() => {
          setEditingReceipt(null);
          fetchData();
        }}
      />
    </div>
  );
};

export default Transactions;
