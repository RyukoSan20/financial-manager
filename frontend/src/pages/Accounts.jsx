import { useState, useEffect } from 'react';
import { Card, Button, Input, Select, Modal, Badge, EmptyState, Spinner } from '../components/ui';
import { Plus, Wallet, Banknote, CreditCard, Smartphone, RefreshCw, Trash2, Edit2, PiggyBank } from 'lucide-react';

const accountTypeOptions = [
  { value: 'bank', label: 'Bank Account', icon: Banknote },
  { value: 'cash', label: 'Cash', icon: Wallet },
  { value: 'e-wallet', label: 'E-Wallet', icon: Smartphone },
  { value: 'credit_card', label: 'Credit Card', icon: CreditCard },
  { value: 'investment', label: 'Investment', icon: PiggyBank },
];

const getAccountIcon = (type) => {
  const option = accountTypeOptions.find(o => o.value === type);
  return option?.icon || Wallet;
};

export const Accounts = () => {
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
        fetch('/api/accounts/').then(r => r.json()),
        fetch('/api/accounts/summary/total-balance').then(r => r.json()),
      ]);
      setAccounts(accRes);
      setSummary(summaryRes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (formData) => {
    try {
      const method = editingAccount ? 'PUT' : 'POST';
      const url = editingAccount 
        ? `/api/accounts/${editingAccount.id}` 
        : '/api/accounts/';
      
      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      
      setShowModal(false);
      setEditingAccount(null);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this account? All transactions will remain.')) return;
    try {
      await fetch(`/api/accounts/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (err) {
      console.error(err);
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
          <h1 className="text-2xl font-bold text-gray-900">Accounts</h1>
          <p className="text-gray-500 mt-1">
            {accounts.length} accounts • Total: {summary?.total_balance ? 
              new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(summary.total_balance)
              : '-'}
          </p>
        </div>
        <Button onClick={() => { setEditingAccount(null); setShowModal(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Add Account
        </Button>
      </div>

      {/* Account Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="!p-4 text-center">
            <p className="text-sm text-gray-500">Total Balance</p>
            <p className="text-xl font-bold text-gray-900 mt-1">
              {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(summary.total_balance)}
            </p>
          </Card>
        </div>
      )}

      {/* Accounts by Type */}
      {accounts.length === 0 ? (
        <EmptyState
          icon={<Wallet className="w-8 h-8 text-gray-400" />}
          title="No accounts yet"
          description="Add your bank accounts, cash, and e-wallets to track your finances"
          action={
            <Button onClick={() => setShowModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Account
            </Button>
          }
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
                  {typeOption?.label || type}
                </h3>
                <div className="grid gap-3">
                  {accs.map((account) => (
                    <Card key={account.id} className="!p-4 hover:shadow-md transition-shadow">
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
                            <p className="text-sm text-gray-500">{account.currency}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className={`font-bold text-lg ${
                              parseFloat(account.balance) >= 0 ? 'text-gray-900' : 'text-danger-600'
                            }`}>
                              {new Intl.NumberFormat('id-ID', { style: 'currency', currency: account.currency || 'IDR', minimumFractionDigits: 0 }).format(account.balance)}
                            </p>
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
  const [form, setForm] = useState({
    name: '',
    account_type: 'bank',
    balance: '0',
    currency: 'IDR',
    is_credit: false,
  });

  useEffect(() => {
    if (account) {
      setForm({
        name: account.name,
        account_type: account.account_type,
        balance: account.balance?.toString() || '0',
        currency: account.currency || 'IDR',
        is_credit: account.is_credit || false,
      });
    } else {
      setForm({
        name: '',
        account_type: 'bank',
        balance: '0',
        currency: 'IDR',
        is_credit: false,
      });
    }
  }, [account]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...form,
      balance: parseFloat(form.balance),
      is_credit: form.account_type === 'credit_card',
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={account ? 'Edit Account' : 'Add Account'} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Account Name"
          placeholder="e.g., BCA Savings"
          value={form.name}
          onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
          required
        />

        <Select
          label="Account Type"
          options={accountTypeOptions.map(o => ({ value: o.value, label: o.label }))}
          value={form.account_type}
          onChange={(e) => setForm(f => ({ ...f, account_type: e.target.value }))}
        />

        <Input
          label="Initial Balance"
          type="number"
          step="0.01"
          placeholder="0"
          value={form.balance}
          onChange={(e) => setForm(f => ({ ...f, balance: e.target.value }))}
        />

        <Select
          label="Currency"
          options={[
            { value: 'IDR', label: 'Indonesian Rupiah (IDR)' },
            { value: 'USD', label: 'US Dollar (USD)' },
          ]}
          value={form.currency}
          onChange={(e) => setForm(f => ({ ...f, currency: e.target.value }))}
        />

        <div className="flex gap-3 pt-4">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" className="flex-1">
            {account ? 'Update' : 'Add'} Account
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default Accounts;
