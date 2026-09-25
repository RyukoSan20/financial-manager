import { useState, useEffect } from 'react';
import { Card, Button, Input, Select, Modal, Badge, EmptyState, Spinner } from '../components/ui';
import api from '../services/api';
import { Plus, Repeat, RefreshCw, Trash2, Edit2, Calendar, Clock, Play, Pause } from 'lucide-react';
import { formatCurrency, formatDate } from '../utils/format';

const frequencyOptions = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
];

export const Recurring = () => {
  const [rules, setRules] = useState([]);
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [upcoming, setUpcoming] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rulesRes, catRes, accRes, upcomingRes] = await Promise.all([
        api.recurring.list(),
        api.categories.list(),
        api.accounts.list(),
        api.recurring.upcoming(),
      ]);
      setRules(Array.isArray(rulesRes) ? rulesRes : []);
      setCategories(catRes);
      setAccounts(accRes);
      setUpcoming(Array.isArray(upcomingRes) ? upcomingRes : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (formData) => {
    try {
      if (editingRule) {
        await api.recurring.update(editingRule.id, formData);
      } else {
        await api.recurring.create(formData);
      }
      
      setShowModal(false);
      setEditingRule(null);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleActive = async (rule) => {
    try {
      await api.recurring.update(rule.id, { is_active: !rule.is_active });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this recurring rule?')) return;
    try {
      await api.recurring.delete(id);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  const activeRules = rules.filter(r => r.is_active);
  const totalMonthlyExpense = activeRules
    .filter(r => r.rule_type === 'expense')
    .reduce((sum, r) => {
      let monthly = parseFloat(r.amount);
      if (r.frequency === 'daily') monthly *= 30;
      else if (r.frequency === 'weekly') monthly *= 4;
      else if (r.frequency === 'biweekly') monthly *= 2;
      else if (r.frequency === 'quarterly') monthly /= 3;
      else if (r.frequency === 'yearly') monthly /= 12;
      return sum + monthly;
    }, 0);

  const totalMonthlyIncome = activeRules
    .filter(r => r.rule_type === 'income')
    .reduce((sum, r) => {
      let monthly = parseFloat(r.amount);
      if (r.frequency === 'daily') monthly *= 30;
      else if (r.frequency === 'weekly') monthly *= 4;
      else if (r.frequency === 'biweekly') monthly *= 2;
      else if (r.frequency === 'quarterly') monthly /= 3;
      else if (r.frequency === 'yearly') monthly /= 12;
      return sum + monthly;
    }, 0);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Recurring Transactions</h1>
          <p className="text-gray-500 mt-1">{activeRules.length} active recurring rules</p>
        </div>
        <Button onClick={() => { setEditingRule(null); setShowModal(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          New Recurring
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="!p-4">
          <p className="text-sm text-gray-500">Monthly Income</p>
          <p className="text-xl font-bold text-success-600 mt-1">{formatCurrency(totalMonthlyIncome)}</p>
        </Card>
        <Card className="!p-4">
          <p className="text-sm text-gray-500">Monthly Expense</p>
          <p className="text-xl font-bold text-danger-600 mt-1">{formatCurrency(totalMonthlyExpense)}</p>
        </Card>
        <Card className="!p-4">
          <p className="text-sm text-gray-500">Net Recurring</p>
          <p className={`text-xl font-bold mt-1 ${totalMonthlyIncome - totalMonthlyExpense >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
            {formatCurrency(totalMonthlyIncome - totalMonthlyExpense)}
          </p>
        </Card>
        <Card className="!p-4">
          <p className="text-sm text-gray-500">Active Rules</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{activeRules.length}</p>
        </Card>
      </div>

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-4 border-b">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary-600" />
              <h3 className="font-semibold text-gray-900">Upcoming Transactions</h3>
            </div>
          </CardHeader>
          <CardBody className="!p-0">
            <div className="divide-y">
              {upcoming.slice(0, 5).map((item, i) => (
                <div key={i} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      item.rule_type === 'income' ? 'bg-success-100 text-success-600' : 'bg-danger-100 text-danger-600'
                    }`}>
                      <Repeat className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{item.name}</p>
                      <p className="text-sm text-gray-500">{item.rule_name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${
                      item.rule_type === 'income' ? 'text-success-600' : 'text-danger-600'
                    }`}>
                      {item.rule_type === 'income' ? '+' : '-'}{formatCurrency(item.amount)}
                    </p>
                    <p className="text-sm text-gray-500">{formatDate(item.date)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Rules List */}
      {rules.length === 0 ? (
        <EmptyState
          icon={<Repeat className="w-8 h-8 text-gray-400" />}
          title="No recurring transactions"
          description="Set up recurring income and expenses like salary, rent, or subscriptions"
          action={
            <Button onClick={() => setShowModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Recurring
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4">
          {rules.map((rule) => {
            const category = categories.find(c => c.id === rule.category_id);
            const account = accounts.find(a => a.id === rule.account_id);
            
            return (
              <Card key={rule.id} className="!p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      rule.is_active 
                        ? rule.rule_type === 'income' 
                          ? 'bg-success-100 text-success-600' 
                          : 'bg-danger-100 text-danger-600'
                        : 'bg-gray-100 text-gray-400'
                    }`}>
                      <Repeat className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900">{rule.name}</p>
                        <Badge 
                          size="sm"
                          variant={rule.is_active ? (rule.rule_type === 'income' ? 'success' : 'danger') : 'default'}
                        >
                          {rule.is_active ? rule.rule_type : 'Paused'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {frequencyOptions.find(f => f.value === rule.frequency)?.label || rule.frequency}
                        </span>
                        {category && <span>{category.name}</span>}
                        {account && <span>{account.name}</span>}
                      </div>
                      {rule.next_occurrence && (
                        <p className="text-sm text-gray-400 mt-1">
                          Next: {formatDate(rule.next_occurrence)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className={`text-xl font-bold ${
                        rule.rule_type === 'income' ? 'text-success-600' : 'text-danger-600'
                      }`}>
                        {rule.rule_type === 'income' ? '+' : '-'}{formatCurrency(rule.amount)}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleToggleActive(rule)}
                        className={`p-2 rounded-lg ${
                          rule.is_active 
                            ? 'text-warning-600 hover:bg-warning-50' 
                            : 'text-success-600 hover:bg-success-50'
                        }`}
                        title={rule.is_active ? 'Pause' : 'Activate'}
                      >
                        {rule.is_active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => { setEditingRule(rule); setShowModal(true); }}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(rule.id)}
                        className="p-2 text-gray-400 hover:text-danger-600 hover:bg-danger-50 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      <RecurringModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingRule(null); }}
        onSubmit={handleSubmit}
        rule={editingRule}
        categories={categories}
        accounts={accounts}
      />
    </div>
  );
};

const RecurringModal = ({ isOpen, onClose, onSubmit, rule, categories, accounts }) => {
  const [form, setForm] = useState({
    name: '',
    rule_type: 'expense',
    amount: '',
    frequency: 'monthly',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    is_active: true,
    has_reminder: false,
    category_id: '',
    account_id: '',
  });

  useEffect(() => {
    if (rule) {
      setForm({
        name: rule.name || '',
        rule_type: rule.rule_type || 'expense',
        amount: rule.amount?.toString() || '',
        frequency: rule.frequency || 'monthly',
        start_date: rule.start_date || new Date().toISOString().split('T')[0],
        end_date: rule.end_date || '',
        is_active: rule.is_active ?? true,
        has_reminder: rule.has_reminder ?? false,
        category_id: rule.category_id || '',
        account_id: rule.account_id || '',
      });
    } else {
      setForm({
        name: '',
        rule_type: 'expense',
        amount: '',
        frequency: 'monthly',
        start_date: new Date().toISOString().split('T')[0],
        end_date: '',
        is_active: true,
        has_reminder: false,
        category_id: '',
        account_id: accounts[0]?.id?.toString() || '',
      });
    }
  }, [rule, accounts]);

  const handleSubmit = (e) => {
    e.preventDefault();
    // Validate required fields
    if (!form.account_id) {
      alert('Please select an account');
      return;
    }
    if (!form.amount || parseFloat(form.amount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }
    onSubmit({
      ...form,
      type: form.rule_type, // Backend expects 'type', frontend uses 'rule_type'
      amount: parseFloat(form.amount),
      category_id: form.category_id ? parseInt(form.category_id) : null,
      account_id: parseInt(form.account_id),
      description: form.name || `${form.rule_type} recurring`,
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={rule ? 'Edit Recurring' : 'New Recurring'} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Name"
          placeholder="e.g., Monthly Salary"
          value={form.name}
          onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
          required
        />

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setForm(f => ({ ...f, rule_type: 'income' }))}
            className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
              form.rule_type === 'income' 
                ? 'bg-success-100 text-success-700 border-2 border-success-500' 
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            Income
          </button>
          <button
            type="button"
            onClick={() => setForm(f => ({ ...f, rule_type: 'expense' }))}
            className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
              form.rule_type === 'expense' 
                ? 'bg-danger-100 text-danger-700 border-2 border-danger-500' 
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            Expense
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Amount"
            type="number"
            step="1000"
            placeholder="0"
            value={form.amount}
            onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))}
            required
          />
          <Select
            label="Frequency"
            options={frequencyOptions}
            value={form.frequency}
            onChange={(e) => setForm(f => ({ ...f, frequency: e.target.value }))}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Start Date"
            type="date"
            value={form.start_date}
            onChange={(e) => setForm(f => ({ ...f, start_date: e.target.value }))}
            required
          />
          <Input
            label="End Date (optional)"
            type="date"
            value={form.end_date}
            onChange={(e) => setForm(f => ({ ...f, end_date: e.target.value }))}
          />
        </div>

        <Select
          label="Account"
          options={accounts.map(a => ({ value: a.id, label: a.name }))}
          value={form.account_id}
          onChange={(e) => setForm(f => ({ ...f, account_id: e.target.value }))}
          placeholder="Select account"
        />

        <Select
          label="Category"
          options={categories
            .filter(c => c.type === form.rule_type)
            .map(c => ({ value: c.id, label: c.name }))}
          value={form.category_id}
          onChange={(e) => setForm(f => ({ ...f, category_id: e.target.value }))}
          placeholder="Select category"
        />

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="is_active"
            checked={form.is_active}
            onChange={(e) => setForm(f => ({ ...f, is_active: e.target.checked }))}
            className="w-4 h-4 rounded border-gray-300"
          />
          <label htmlFor="is_active" className="text-sm text-gray-700">Active</label>
        </div>

        <div className="flex gap-3 pt-4">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" className="flex-1">
            {rule ? 'Update' : 'Create'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

const CardHeader = ({ children, className = '' }) => (
  <div className={`px-5 py-4 ${className}`}>{children}</div>
);

const CardBody = ({ children, className = '' }) => (
  <div className={`px-5 py-4 ${className}`}>{children}</div>
);

export default Recurring;
