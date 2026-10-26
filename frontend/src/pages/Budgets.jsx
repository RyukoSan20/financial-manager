import { useState, useEffect } from 'react';
import { Card, Button, Input, Select, Modal, ProgressBar, Badge, EmptyState, Spinner } from '../components/ui';
import { Plus, Target, RefreshCw, Trash2, Edit2, TrendingUp } from 'lucide-react';
import { formatCurrency, formatDate } from '../utils/format';
import api from '../services/api';
import { BreakdownViewer } from '../components/common/BreakdownViewer';
import { useTranslation } from '../i18n';
import { PageHeader } from '../components/ui/PageHeader';
import { buildFlag } from '../utils/featureFlags';
import { categoryName } from '../utils/categoryName';

export const Budgets = () => {
  const { t, language } = useTranslation();
  // With the polish switch off, the page keeps the header it has.
  const polished = buildFlag('UI_POLISH');
  const [budgets, setBudgets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [budgetRes, catRes, accRes] = await Promise.all([
        api.budgets.list(),
        api.categories.list(),
        api.accounts.list(),
      ]);
      setBudgets(Array.isArray(budgetRes) ? budgetRes : []);
      setCategories(catRes || []);
      setAccounts(Array.isArray(accRes) ? accRes : []);
    } catch (err) {
      console.error('Failed to fetch budgets:', err);
      setBudgets([]);
      setCategories([]);
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (formData) => {
    try {
      if (editingBudget) {
        await api.budgets.update(editingBudget.id, formData);
      } else {
        await api.budgets.create(formData);
      }
      
      setShowModal(false);
      setEditingBudget(null);
      fetchData();
    } catch (err) {
      console.error('Failed to save budget:', err);
      alert(t('budgets.save_error').replace('%s', err.message || JSON.stringify(err) || 'Unknown error'));
    }
  };

  const handleDelete = async (id) => {
    if (!confirm(t('budgets.delete_confirm'))) return;
    try {
      await api.budgets.delete(id);
      fetchData();
    } catch (err) {
      console.error('Failed to delete budget:', err);
      alert(t('budgets.delete_error').replace('%s', err.message || 'Unknown error'));
    }
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
      {polished ? (
        <PageHeader
          title={t('budgets.title')}
          subtitle={t('budgets.active_count').replace('%s', budgets.length)}
          action={
            <Button onClick={() => { setEditingBudget(null); setShowModal(true); }}>
              <Plus className="w-4 h-4 mr-2" />
              {t('budgets.add')}
            </Button>
          }
        />
      ) : (
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('budgets.title')}</h1>
            <p className="text-gray-500 mt-1">
              {t('budgets.active_count').replace('%s', budgets.length)}
            </p>
          </div>
          <Button onClick={() => { setEditingBudget(null); setShowModal(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            {t('budgets.add')}
          </Button>
        </div>
      )}

      {/* Summary */}
      {budgets.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="!p-4">
            <p className="text-sm text-gray-500">{t('budgets.total_budget')}</p>
            <p className="text-xl font-bold text-gray-900 mt-1">
              {formatCurrency(budgets.reduce((sum, b) => sum + parseFloat(b.amount), 0))}
            </p>
          </Card>
          <Card className="!p-4">
            <p className="text-sm text-gray-500">{t('budgets.total_spent')}</p>
            <p className="text-xl font-bold text-danger-600 mt-1">
              {formatCurrency(budgets.reduce((sum, b) => sum + parseFloat(b.spent || 0), 0))}
            </p>
          </Card>
          <Card className="!p-4">
            <p className="text-sm text-gray-500">{t('budgets.total_remaining')}</p>
            <p className="text-xl font-bold text-success-600 mt-1">
              {formatCurrency(budgets.reduce((sum, b) => sum + (parseFloat(b.amount) - parseFloat(b.spent || 0)), 0))}
            </p>
          </Card>
          <Card className="!p-4">
            <p className="text-sm text-gray-500">{t('budgets.avg_utilization')}</p>
            <p className="text-xl font-bold text-gray-900 mt-1">
              {Math.round(budgets.reduce((sum, b) => sum + (parseFloat(b.spent || 0) / parseFloat(b.amount) * 100), 0) / budgets.length)}%
            </p>
          </Card>
        </div>
      )}

      {/* Budget List */}
      {budgets.length === 0 ? (
        <EmptyState
          icon={<Target className="w-8 h-8 text-gray-400" />}
          title={t('budgets.empty_title')}
          description={t('budgets.empty_desc')}
          action={
            <Button onClick={() => setShowModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              {t('budgets.create')}
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4">
          {budgets.map((budget) => {
            const utilization = (parseFloat(budget.spent || 0) / parseFloat(budget.amount)) * 100;
            const remaining = parseFloat(budget.amount) - parseFloat(budget.spent || 0);
            const category = categories.find(c => c.id === budget.category_id);
            
            return (
              <Card key={budget.id} className="!p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      utilization > 100 ? 'bg-danger-100 text-danger-600' :
                      utilization > 80 ? 'bg-warning-100 text-warning-600' :
                      'bg-primary-100 text-primary-600'
                    }`}>
                      <Target className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">
                        {category ? categoryName(category, language) : (budget.name || t('budgets.default_name'))}
                      </p>
                      <p className="text-sm text-gray-500">
                        {budget.period === 'monthly' ? t('budgets.period_monthly') : budget.period === 'weekly' ? t('budgets.period_weekly') : t('budgets.period_yearly')}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setEditingBudget(budget); setShowModal(true); }}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(budget.id)}
                      className="p-2 text-gray-400 hover:text-danger-600 hover:bg-danger-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <ProgressBar 
                    value={Math.min(utilization, 100)} 
                    color={utilization > 100 ? 'danger' : utilization > 80 ? 'warning' : 'primary'}
                    size="md"
                  />
                  
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <span className="text-gray-500">{t('budgets.spent_label')}</span>
                      <span className="font-medium text-gray-900">{formatCurrency(budget.spent || 0, budget.currency)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">{t('budgets.budget_label')}</span>
                      <span className="font-medium text-gray-900">{formatCurrency(budget.amount, budget.currency)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">{t('budgets.left_label')}</span>
                      <span className={`font-medium ${remaining >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                        {formatCurrency(remaining, budget.currency)}
                      </span>
                    </div>
                  </div>

                  <BreakdownViewer
                    parentType="budget"
                    parentId={budget.id}
                    title={t('budgets.breakdown_title')}
                    compact
                  />
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      <BudgetModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingBudget(null); }}
        onSubmit={handleSubmit}
        budget={editingBudget}
        categories={categories}
        accounts={accounts}
      />
    </div>
  );
};

const BudgetModal = ({ isOpen, onClose, onSubmit, budget, categories, accounts = [] }) => {
  // The language comes with the translator: the name of a category is
  // shown in the language of the reader, and that is decided here.
  const { t, language } = useTranslation();
  const [form, setForm] = useState({
    name: '',
    category_id: '',
    amount: '',
    period: 'monthly',
    start_date: new Date().toISOString().split('T')[0].slice(0, 7) + '-01',
    auto_allocate: false,
    allocation_account_id: '',
  });

  useEffect(() => {
    if (budget) {
      setForm({
        name: budget.name || '',
        category_id: budget.category_id || '',
        amount: budget.amount?.toString() || '',
        period: budget.period || 'monthly',
        start_date: budget.start_date || new Date().toISOString().split('T')[0],
        auto_allocate: budget.auto_allocate || false,
        allocation_account_id: budget.allocation_account_id || '',
      });
    } else {
      setForm({
        name: '',
        category_id: '',
        amount: '',
        period: 'monthly',
        start_date: new Date().toISOString().split('T')[0],
        auto_allocate: false,
        allocation_account_id: '',
      });
    }
  }, [budget]);

  const handleSubmit = (e) => {
    e.preventDefault();
    // Get category name for budget name if category selected
    // The name of the category the budget is for, in the language of
    // the reader. It goes into the name of the budget when the reader
    // did not write one.
    const chosen = categories?.find(c => c.id === parseInt(form.category_id));
    const chosenName = chosen ? categoryName(chosen, language) : t('budgets.general_category');
    const budgetName = form.name || `${chosenName} ${t('budgets.default_name')}`;
    onSubmit({
      ...form,
      name: budgetName,
      category_id: form.category_id ? parseInt(form.category_id) : null,
      amount: parseFloat(form.amount),
      allocation_account_id: form.allocation_account_id ? parseInt(form.allocation_account_id) : null,
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={budget ? t('budgets.edit') : t('budgets.create')} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          label={t('transaction.category')}
          options={categories.filter(c => c.type === 'expense').map(c => ({ value: c.id, label: categoryName(c, language) }))}
          value={form.category_id}
          onChange={(e) => setForm(f => ({ ...f, category_id: e.target.value }))}
          placeholder={t('budgets.select_category')}
          required
        />

        <Input
          label={t('budgets.amount')}
          type="number"
          step="1000"
          placeholder="0"
          value={form.amount}
          onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))}
          required
        />

        <Select
          label={t('budgets.period')}
          options={[
            { value: 'weekly', label: t('budgets.period_weekly') },
            { value: 'monthly', label: t('budgets.period_monthly') },
            { value: 'yearly', label: t('budgets.period_yearly') },
          ]}
          value={form.period}
          onChange={(e) => setForm(f => ({ ...f, period: e.target.value }))}
        />

        <Input
          label={t('budgets.start_date')}
          type="date"
          value={form.start_date}
          onChange={(e) => setForm(f => ({ ...f, start_date: e.target.value }))}
        />

        {/* Auto-Allocate Toggle */}
        <div className="bg-primary-50 border border-primary-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="auto_allocate"
              checked={form.auto_allocate}
              onChange={(e) => setForm(f => ({ ...f, auto_allocate: e.target.checked }))}
              className="mt-1 w-5 h-5 rounded border-primary-300 text-primary-600 focus:ring-primary-500"
            />
            <div className="flex-1">
              <label htmlFor="auto_allocate" className="font-medium text-primary-900 cursor-pointer">
                {t('budgets.auto_allocate')}
              </label>
              <p className="text-sm text-primary-700 mt-1">
                {t('budgets.auto_allocate_desc')}
              </p>
            </div>
          </div>
          
          {form.auto_allocate && (
            <div className="mt-3 pl-8">
              <Select
                label={t('budgets.deduct_from_account')}
                options={accounts.map(a => ({ value: a.id, label: `${a.name} (${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(a.balance)})` }))}
                value={form.allocation_account_id}
                onChange={(e) => setForm(f => ({ ...f, allocation_account_id: e.target.value }))}
                placeholder={t('budgets.select_account')}
              />
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-4">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1">
            {t('common.cancel')}
          </Button>
          <Button type="submit" className="flex-1">
            {budget ? t('budgets.update') : t('budgets.create')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default Budgets;
