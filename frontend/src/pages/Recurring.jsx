import { useState, useEffect } from 'react';
import { Card, Button, Input, Select, Modal, Badge, EmptyState, Spinner } from '../components/ui';
import api from '../services/api';
import { BreakdownViewer } from '../components/common/BreakdownViewer';
import { apiUrl as buildApiUrl } from '../config/url';
import { Plus, Repeat, RefreshCw, Trash2, Edit2, Calendar, Clock, Play, Pause } from 'lucide-react';
import SingleAddButton, { isSingleAddOn } from '../components/common/SingleAddButton';
import { formatCurrency, formatDate } from '../utils/format';
import { isIncoming, isOutgoing } from '../utils/transactionSign';
import { useCurrency, sumInDisplay } from '../utils/currency';
import { showNotification } from '../components/notifications/NotificationHelper';
import { categoryName } from '../utils/categoryName';
import { useTranslation } from '../i18n';
import { batch1, fill } from '../i18n/keys_batch1';

// The frequency list is built per language, because the words are read
// when the screen is drawn and not when the module is loaded.
const frequencyValues = ['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'];

// One rule, expressed as a month. The frequency decides how many months
// one entry covers, so the totals can be compared with each other.
const monthlyAmount = (r) => {
  const amount = parseFloat(r.amount) || 0;
  const freq = String(r.frequency || 'monthly').toLowerCase();
  if (freq === 'daily') return amount * 30;
  if (freq === 'weekly') return amount * 4;
  if (freq === 'biweekly') return amount * 2;
  if (freq === 'quarterly') return amount / 3;
  if (freq === 'yearly') return amount / 12;
  return amount;
};

// The server calls the kind of rule `type`, and the name of the rule
// `description`. The page has always read `rule_type` and `name`, so
// every rule looked like an expense with no name, and the monthly
// income and expense totals were both zero.
//
// The two shapes are put into one here, so the page reads one set of
// names and cannot drift from the server again.
const normalizeRule = (rule) => ({
  ...rule,
  rule_type: rule.rule_type || rule.type || 'expense',
  name: rule.name || rule.description || '',
  type: rule.type || rule.rule_type || 'expense',
  description: rule.description || rule.name || '',
});

// The upcoming list is a different shape again: it has no name, and
// the date it names is `next_date`.
const normalizeUpcoming = (item) => ({
  ...item,
  rule_type: item.rule_type || item.type || 'expense',
  name: item.name || item.description || '',
  rule_name: item.rule_name || item.frequency || '',
  date: item.date || item.next_date,
});

export const Recurring = () => {
  const { currency: displayCurrency } = useCurrency();
  const { language } = useTranslation();
  const K = batch1[language]?.recurring || batch1.id.recurring;
  const frequencyOptions = frequencyValues.map((value) => ({
    value,
    label: K.freq[value] || value,
  }));
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
        // The paused rules are shown too, so the reader can start one
        // again. The server hides them unless it is asked for both.
        api.request('/recurring/?active_only=false'),
        api.categories.list(),
        api.accounts.list(),
        api.recurring.upcoming(),
      ]);
      setRules(Array.isArray(rulesRes) ? rulesRes.map(normalizeRule) : []);
      setCategories(Array.isArray(catRes) ? catRes : []);
      setAccounts(Array.isArray(accRes) ? accRes : []);
      setUpcoming(
        Array.isArray(upcomingRes)
          ? upcomingRes.map(normalizeUpcoming)
          : Array.isArray(upcomingRes?.upcoming)
          ? upcomingRes.upcoming.map(normalizeUpcoming)
          : []
      );
    } catch (error) {
      console.error('Failed to fetch recurring data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Manual trigger for processing due recurring rules
  const triggerProcess = async () => {
    if (!confirm(K.processConfirm)) return;
    try {
      setLoading(true);
      const token = localStorage.getItem('token') || localStorage.getItem('sb_token');
      const apiUrl = buildApiUrl('cron/process-recurring');

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : { 'Content-Type': 'application/json' },
      });
      const result = await response.json();
      
      if (result.created > 0 || result.generated > 0) {
        showNotification({
          type: 'success',
          title: K.notif.processedTitle,
          message: fill(K.notif.createdCount, {
            count: result.created || result.generated,
          }),
          category: 'recurring'
        });
        fetchData();
      } else if (result.processed === 0) {
        showNotification({
          type: 'info',
          title: K.notif.noDueTitle,
          message: K.notif.upToDate,
          category: 'recurring'
        });
      } else if (result.details && result.details.length > 0) {
        showNotification({
          type: 'info',
          title: K.notif.checkedTitle,
          message: result.details.join('\n'),
          category: 'recurring'
        });
      } else {
        showNotification({
          type: 'info',
          title: K.notif.noActionTitle,
          message: K.notif.nothingToGenerate,
          category: 'recurring'
        });
      }
    } catch (error) {
      console.error('Process error:', error);
      showNotification({
        type: 'error',
        title: K.notif.failedTitle,
        message: K.notif.failedMsg,
        category: 'recurring'
      });
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
      // The rule was not saved, and the reader has to be told why.
      // The message the server wrote is the one worth showing.
      console.error('Recurring rule save failed:', err);
      showNotification({
        type: 'error',
        title: K.notif.failedTitle,
        message: err?.message || K.notif.failedMsg,
        category: 'recurring',
      });
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
    if (!confirm(K.deleteConfirm)) return;
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
  const totalMonthlyExpense = sumInDisplay(
    activeRules.filter(r => r.rule_type === 'expense').map(r => ({ ...r, _monthly: monthlyAmount(r) })),
    '_monthly'
  );

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
          <h1 className="text-2xl font-bold text-gray-900">{K.title}</h1>
          <p className="text-gray-500 mt-1">{fill(K.activeRulesCount, { count: activeRules.length })}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={triggerProcess}>
            <Play className="w-4 h-4 mr-1" /> {K.processNow}
          </Button>
          {!isSingleAddOn() && (
            <Button onClick={() => { setEditingRule(null); setShowModal(true); }}>
              <Plus className="w-4 h-4 mr-2" />
              {K.newRecurring}
            </Button>
          )}
        </div>
      </div>

      {/* The one add button, in the same place on every page. */}
      <SingleAddButton
        label={K.newRecurring}
        onClick={() => { setEditingRule(null); setShowModal(true); }}
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="!p-4">
          <p className="text-sm text-gray-500">{K.monthlyIncome}</p>
          <p className="text-xl font-bold text-success-600 mt-1">{formatCurrency(totalMonthlyIncome, displayCurrency)}</p>
        </Card>
        <Card className="!p-4">
          <p className="text-sm text-gray-500">{K.monthlyExpense}</p>
          <p className="text-xl font-bold text-danger-600 mt-1">{formatCurrency(totalMonthlyExpense, displayCurrency)}</p>
        </Card>
        <Card className="!p-4">
          <p className="text-sm text-gray-500">{K.netRecurring}</p>
          <p className={`text-xl font-bold mt-1 ${totalMonthlyIncome - totalMonthlyExpense >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
            {formatCurrency(totalMonthlyIncome - totalMonthlyExpense, displayCurrency)}
          </p>
        </Card>
        <Card className="!p-4">
          <p className="text-sm text-gray-500">{K.activeRules}</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{activeRules.length}</p>
        </Card>
      </div>

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-4 border-b">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary-600" />
              <h3 className="font-semibold text-gray-900">{K.upcomingTransactions}</h3>
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
                      {item.rule_type === 'income' ? '+' : '-'}{formatCurrency(item.amount, item.currency)}
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
          title={K.noRecurring}
          description={K.noRecurringDesc}
          action={
            <Button onClick={() => setShowModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              {K.createRecurring}
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
                          {rule.is_active ? (rule.rule_type === 'income' ? K.income : K.expense) : K.paused}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {frequencyOptions.find(f => f.value === rule.frequency)?.label || rule.frequency}
                        </span>
                        {category && <span>{categoryName(category, language)}</span>}
                        {account && <span>{account.name}</span>}
                      </div>
                      {rule.next_occurrence && (
                        <p className="text-sm text-gray-400 mt-1">
                          {fill(K.next, { date: formatDate(rule.next_occurrence) })}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className={`text-xl font-bold ${
                        rule.rule_type === 'income' ? 'text-success-600' : 'text-danger-600'
                      }`}>
                        {rule.rule_type === 'income' ? '+' : '-'}{formatCurrency(rule.amount, rule.currency)}
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
                        title={rule.is_active ? K.pause : K.activate}
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

                  <BreakdownViewer
                    parentType="recurring"
                    parentId={rule.id}
                    title={K.details}
                    compact
                  />
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
  const { language } = useTranslation();
  const K = batch1[language]?.recurring || batch1.id.recurring;
  const frequencyOptions = frequencyValues.map((value) => ({
    value,
    label: K.freq[value] || value,
  }));
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
      alert(K.selectAccountAlert);
      return;
    }
    if (!form.amount || parseFloat(form.amount) <= 0) {
      alert(K.validAmountAlert);
      return;
    }
    // The backend model takes 'type', 'description' and 'start_date'.
    // The fields the backend does not know are left out, and an empty
    // optional date is not sent at all.
    const payload = {
      type: form.rule_type,
      amount: parseFloat(form.amount),
      description: form.name || `${form.rule_type === 'income' ? K.incomeRecurring : K.expenseRecurring}`,
      frequency: form.frequency,
      start_date: form.start_date,
      category_id: form.category_id ? parseInt(form.category_id) : null,
      account_id: parseInt(form.account_id),
      is_active: form.is_active,
    };

    // An empty end date is not sent, so the rule stays open ended.
    if (form.end_date) payload.end_date = form.end_date;

    onSubmit(payload);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={rule ? K.editRecurring : K.newRecurring} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label={K.name}
          placeholder={K.namePlaceholder}
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
            {K.income}
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
            {K.expense}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label={K.amount}
            type="number"
            step="1000"
            placeholder="0"
            value={form.amount}
            onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))}
            required
          />
          <Select
            label={K.frequency}
            options={frequencyOptions}
            value={form.frequency}
            onChange={(e) => setForm(f => ({ ...f, frequency: e.target.value }))}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label={K.startDate}
            type="date"
            value={form.start_date}
            onChange={(e) => setForm(f => ({ ...f, start_date: e.target.value }))}
            required
          />
          <Input
            label={K.endDateOptional}
            type="date"
            value={form.end_date}
            onChange={(e) => setForm(f => ({ ...f, end_date: e.target.value }))}
          />
        </div>

        <Select
          label={K.account}
          options={accounts.map(a => ({ value: a.id, label: a.name }))}
          value={form.account_id}
          onChange={(e) => setForm(f => ({ ...f, account_id: e.target.value }))}
          placeholder={K.selectAccount}
        />

        <Select
          label={K.category}
          options={categories
            .filter(c => c.type === form.rule_type)
            .map(c => ({ value: c.id, label: categoryName(c, language) }))}
          value={form.category_id}
          onChange={(e) => setForm(f => ({ ...f, category_id: e.target.value }))}
          placeholder={K.selectCategory}
        />

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="is_active"
            checked={form.is_active}
            onChange={(e) => setForm(f => ({ ...f, is_active: e.target.checked }))}
            className="w-4 h-4 rounded border-gray-300"
          />
          <label htmlFor="is_active" className="text-sm text-gray-700">{K.active}</label>
        </div>

        <div className="flex gap-3 pt-4">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1">
            {K.cancel}
          </Button>
          <Button type="submit" className="flex-1">
            {rule ? K.update : K.create}
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
