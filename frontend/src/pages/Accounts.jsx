import { useState, useEffect } from 'react';
import { Card, Button, Input, Select, Modal, Badge, Spinner } from '../components/ui';
import HonestEmptyState from '../components/common/HonestEmptyState';
import { Plus, Wallet, Banknote, CreditCard, Smartphone, RefreshCw, Trash2, Edit2, PiggyBank } from 'lucide-react';
import SingleAddButton, { isSingleAddOn } from '../components/common/SingleAddButton';
import api from '../services/api';
import { showNotification } from '../components/notifications/NotificationHelper';
import { useTranslation } from '../i18n';
import { batch3 } from '../i18n/keys_batch3';
import { batch4 } from '../i18n/keys_batch4';
import { CURRENCIES, CURRENCY_CODES, formatNative, useCurrency } from '../utils/currency';
import { formatCurrency } from '../utils/format';

// The kinds of holding there are. The name of each one follows the
// currency it is in, because a rupiah savings account and a yen
// savings account are not the same thing.
const accountTypeOptions = [
  { value: 'bank', icon: Banknote },
  { value: 'savings', icon: PiggyBank },
  { value: 'cash', icon: Wallet },
  { value: 'e-wallet', icon: Smartphone },
  { value: 'credit_card', icon: CreditCard },
  { value: 'investment', icon: PiggyBank },
];

const getAccountIcon = (type) => {
  const option = accountTypeOptions.find(o => o.value === type);
  return option?.icon || Wallet;
};

export const Accounts = () => {
  const { t, language } = useTranslation();
  const K = batch3[language]?.accounts;
  const A = batch4[language]?.accounts;
  const { currency: displayCurrency } = useCurrency();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [accRes, summaryRes] = await Promise.all([
        api.accounts.list(),
        api.request(`/accounts/summary/total-balance?currency=${encodeURIComponent(displayCurrency)}`),
      ]);
      setAccounts(Array.isArray(accRes) ? accRes : []);
      setSummary(summaryRes);
    } catch (err) {
      console.error('Failed to fetch accounts:', err);
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (formData) => {
    try {
      if (editingAccount) {
        await api.accounts.update(editingAccount.id, formData);
      } else {
        await api.accounts.create(formData);
      }
      
      setShowModal(false);
      setEditingAccount(null);
      fetchData();
    } catch (err) {
      console.error('Failed to save account:', err);
      alert(A.save_failed + (err.message || A.unknown_error));
    }
  };

  const handleDelete = async (id) => {
    const account = accounts.find(a => a.id === id);
    const message = account 
      ? `Archiving "${account.name}"? Transactions will remain. The account will be marked as inactive.`
      : 'Archive this account? All transactions will remain.';
    
    if (!confirm(message)) return;
    
    try {
      const result = await api.accounts.delete(id);
      
      if (result.soft_deleted) {
        showNotification({
          type: 'success',
          title: '✅ Account Archived',
          message: 'Account marked as inactive. Transaction history preserved.',
          category: 'account'
        });
      } else {
        showNotification({
          type: 'success',
          title: '✅ Account Deleted',
          message: 'Account permanently deleted.',
          category: 'account'
        });
      }
      
      fetchData();
    } catch (err) {
      console.error('Failed to delete account:', err);
      showNotification({
        type: 'error',
        title: '❌ Delete Failed',
        message: err.message || 'Failed to delete account',
        category: 'account'
      });
    }
  };

  const groupedAccounts = accounts.reduce((acc, account) => {
    const type = account.account_type;
    if (!acc[type]) acc[type] = [];
    acc[type].push(account);
    return acc;
  }, {});

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
          <h1 className="text-2xl font-bold text-gray-900">{K.title}</h1>
          <p className="text-gray-500 mt-1">
            {accounts.length} {t('accounts.count')} • {t('accounts.total')}:{' '}
            {summary?.total_balance !== undefined && summary?.total_balance !== null
              ? formatNative(summary.total_balance, summary.currency || displayCurrency)
              : '-'}
          </p>
        </div>
        {!isSingleAddOn() && (
          <Button onClick={() => { setEditingAccount(null); setShowModal(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            {K.add_account}
          </Button>
        )}
      </div>

      {/* The one add button, in the same place on every page. */}
      <SingleAddButton
        label={K.add_account}
        onClick={() => { setEditingAccount(null); setShowModal(true); }}
      />

      {/* Account Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="!p-4 text-center layered-surface">
            <p className="text-sm text-gray-500">{t('accounts.total_balance')}</p>
            <p className="text-xl font-bold text-gray-900 mt-1 tabular-nums">
              {formatNative(summary.total_balance, summary.currency || displayCurrency)}
            </p>
          </Card>
        </div>
      )}

      {/* Accounts by Type */}
      {accounts.length === 0 ? (
        <HonestEmptyState
          title={K.empty}
          description={K.empty_hint}
          primaryAction={K.add_account}
          onPrimary={() => setShowModal(true)}
          mascotMood="idle"
        />
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedAccounts).map(([type, accs]) => {
            const typeOption = accountTypeOptions.find(o => o.value === type);
            const Icon = typeOption?.icon || Wallet;
            
            return (
              <div key={type}>
                <h3 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
                  <Icon className="w-4 h-4" />
                  {K.kind_names?.[type] || type}
                </h3>
                <div className="grid gap-3">
                  {accs.map((account) => (
                    // The layered surface is the quiet card: a faint
                    // border, a soft shadow and a measured gradient,
                    // rather than a flat block of colour. The amount
                    // uses tabular figures so a column of balances
                    // lines up and can be compared down the page.
                    <Card
                      key={account.id}
                      className="!p-4 layered-surface layered-surface--interactive"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                            type === 'bank' ? 'bg-blue-100 text-blue-600' :
                            type === 'cash' ? 'bg-green-100 text-green-600' :
                            type === 'e-wallet' ? 'bg-purple-100 text-purple-600' :
                            type === 'credit_card' ? 'bg-orange-100 text-orange-600' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            <Icon className="w-6 h-6" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{account.name}</p>
                            <p className="text-sm text-gray-500">
                              {account.currency}
                              {account.bank_name ? ` · ${account.bank_name}` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className={`font-bold text-lg tabular-nums ${
                              parseFloat(account.balance) >= 0 ? 'text-gray-900' : 'text-danger-600'
                            }`}>
                              {formatNative(account.balance, account.currency)}
                            </p>
                            {account.currency && account.currency !== displayCurrency && (
                              <p className="text-xs text-gray-500 tabular-nums">
                                {formatCurrency(account.balance, account.currency)}
                              </p>
                            )}
                            {parseFloat(account.balance) < 0 && (
                              <p className="text-xs text-danger-600 max-w-[14rem]">
                                {K?.negative_balance_warning}
                              </p>
                            )}
                            <Badge size="sm" variant={account.is_active ? 'success' : 'default'}>
                              {account.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => { setEditingAccount(account); setShowModal(true); }}
                              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(account.id)}
                              className="p-2 text-gray-400 hover:text-danger-600 hover:bg-danger-50 rounded-lg"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      <AccountModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingAccount(null); }}
        onSubmit={handleSubmit}
        account={editingAccount}
      />
    </div>
  );
};

const AccountModal = ({ isOpen, onClose, onSubmit, account }) => {
  const { language } = useTranslation();
  const K = batch3[language]?.accounts;

  const [form, setForm] = useState({
    name: '',
    account_type: 'bank',
    balance: '0',
    currency: 'IDR',
    bank_name: '',
    is_credit: false,
  });

  // The kinds of holding there are for the currency that is chosen.
  // The names and the banks follow the currency.
  const [kinds, setKinds] = useState([]);

  useEffect(() => {
    if (account) {
      setForm({
        name: account.name,
        account_type: account.account_type,
        balance: account.balance?.toString() || '0',
        currency: account.currency || 'IDR',
        bank_name: account.bank_name || '',
        is_credit: account.is_credit || false,
      });
    } else {
      setForm({
        name: '',
        account_type: 'bank',
        balance: '0',
        currency: 'IDR',
        bank_name: '',
        is_credit: false,
      });
    }
  }, [account]);

  // Ask the server what the kinds of holding are called in the currency
  // that is chosen, and which banks they are usually kept at.
  useEffect(() => {
    let cancelled = false;
    api.request(`/accounts/kinds/${form.currency}`)
      .then((data) => {
        if (cancelled) return;
        const payload = data?.data || data;
        setKinds(payload?.options || []);
      })
      .catch(() => {
        if (!cancelled) setKinds([]);
      });
    return () => { cancelled = true; };
  }, [form.currency]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...form,
      balance: parseFloat(form.balance),
      is_credit: form.account_type === 'credit_card',
    });
  };

  const kindOptions = kinds.length
    ? kinds.map((k) => ({ value: k.kind, label: k.label }))
    : accountTypeOptions.map((o) => ({ value: o.value, label: o.value }));

  const bankSuggestions = kinds.find((k) => k.kind === form.account_type)?.banks || [];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={account ? K.edit_account : K.add_account} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* The currency comes first: it decides what the account is called
            and where it is kept. */}
        <Select
          label={K.currency}
          options={CURRENCY_CODES.map((code) => ({
            value: code,
            label: `${CURRENCIES[code].symbol}  ${batch3[language]?.currency?.[code] || code}`,
          }))}
          value={form.currency}
          onChange={(e) => setForm(f => ({ ...f, currency: e.target.value, account_kind: undefined }))}
        />

        <Select
          label={K.account_kind}
          options={kindOptions}
          value={form.account_type}
          onChange={(e) => setForm(f => ({ ...f, account_type: e.target.value }))}
        />

        <Input
          label={K.account_name}
          placeholder={K.account_name_placeholder}
          value={form.name}
          onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
          required
        />

        {bankSuggestions.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {K.bank_name}
            </label>
            <div className="flex flex-wrap gap-2">
              {bankSuggestions.map((bank) => (
                <button
                  type="button"
                  key={bank}
                  onClick={() => setForm(f => ({ ...f, bank_name: bank }))}
                  className={`px-2.5 py-1 rounded-lg text-xs border transition-colors ${
                    form.bank_name === bank
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {bank}
                </button>
              ))}
            </div>
            <Input
              className="mt-2"
              value={form.bank_name}
              onChange={(e) => setForm(f => ({ ...f, bank_name: e.target.value }))}
              placeholder={K.bank_name_placeholder}
            />
          </div>
        )}

        <Input
          label={K.initial_balance}
          type="number"
          step="0.01"
          placeholder="0"
          value={form.balance}
          onChange={(e) => setForm(f => ({ ...f, balance: e.target.value }))}
        />
        {parseFloat(form.balance) < 0 && (
          <p className="text-xs text-danger-600 mt-1">
            {K?.negative_balance_warning}
          </p>
        )}

        <div className="flex gap-3 pt-4">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1">
            {K.cancel}
          </Button>
          <Button type="submit" className="flex-1">
            {account ? K.update : K.add_account}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default Accounts;
