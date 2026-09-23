import { useState, useEffect } from 'react';
import { Card, Button, Input, Select, Modal, ProgressBar, Badge, EmptyState, Spinner } from '../components/ui';
import { Plus, Target, RefreshCw, Trash2, Edit2, TrendingUp } from 'lucide-react';
import { formatCurrency, formatDate } from '../utils/format';
import api from '../services/api';

export const Budgets = () => {
  const [budgets, setBudgets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [budgetRes, catRes] = await Promise.all([
        api.budgets.list(),
        api.categories.list(),
      ]);
      setBudgets(Array.isArray(budgetRes) ? budgetRes : []);
      setCategories(catRes || []);
    } catch (err) {
      console.error('Failed to fetch budgets:', err);
      setBudgets([]);
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
      alert('Failed to save budget: ' + (err.message || 'Unknown error'));
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this budget?')) return;
    try {
      await api.budgets.delete(id);
      fetchData();
    } catch (err) {
      console.error('Failed to delete budget:', err);
      alert('Failed to delete budget: ' + (err.message || 'Unknown error'));
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Budgets</h1>
          <p className="text-gray-500 mt-1">
            {budgets.length} active budgets
          </p>
        </div>
        <Button onClick={() => { setEditingBudget(null); setShowModal(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Add Budget
        </Button>
      </div>

      {/* Summary */}
      {budgets.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="!p-4">
            <p className="text-sm text-gray-500">Total Budget</p>
            <p className="text-xl font-bold text-gray-900 mt-1">
              {formatCurrency(budgets.reduce((sum, b) => sum + parseFloat(b.amount), 0))}
            </p>
          </Card>
          <Card className="!p-4">
            <p className="text-sm text-gray-500">Total Spent</p>
            <p className="text-xl font-bold text-danger-600 mt-1">
              {formatCurrency(budgets.reduce((sum, b) => sum + parseFloat(b.spent || 0), 0))}
            </p>
          </Card>
          <Card className="!p-4">
            <p className="text-sm text-gray-500">Total Remaining</p>
            <p className="text-xl font-bold text-success-600 mt-1">
              {formatCurrency(budgets.reduce((sum, b) => sum + (parseFloat(b.amount) - parseFloat(b.spent || 0)), 0))}
            </p>
          </Card>
          <Card className="!p-4">
            <p className="text-sm text-gray-500">Avg. Utilization</p>
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
          title="No budgets yet"
          description="Create budgets to track your spending against your goals"
          action={
            <Button onClick={() => setShowModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Budget
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
                        {category?.name || budget.name || 'Budget'}
                      </p>
                      <p className="text-sm text-gray-500">
                        {budget.period === 'monthly' ? 'Monthly' : budget.period === 'weekly' ? 'Weekly' : 'Yearly'}
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
                      <span className="text-gray-500">Spent: </span>
                      <span className="font-medium text-gray-900">{formatCurrency(budget.spent || 0)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Budget: </span>
                      <span className="font-medium text-gray-900">{formatCurrency(budget.amount)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Left: </span>
                      <span className={`font-medium ${remaining >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                        {formatCurrency(remaining)}
                      </span>
                    </div>
                  </div>
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
      />
    </div>
  );
};

const BudgetModal = ({ isOpen, onClose, onSubmit, budget, categories }) => {
  const [form, setForm] = useState({
    category_id: '',
    amount: '',
    period: 'monthly',
    start_date: new Date().toISOString().split('T')[0].slice(0, 7) + '-01',
  });

  useEffect(() => {
    if (budget) {
      setForm({
        category_id: budget.category_id || '',
        amount: budget.amount?.toString() || '',
        period: budget.period || 'monthly',
        start_date: budget.start_date || new Date().toISOString().split('T')[0],
      });
    } else {
      setForm({
        category_id: '',
        amount: '',
        period: 'monthly',
        start_date: new Date().toISOString().split('T')[0],
      });
    }
  }, [budget]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...form,
      category_id: form.category_id ? parseInt(form.category_id) : null,
      amount: parseFloat(form.amount),
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={budget ? 'Edit Budget' : 'Create Budget'} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          label="Category"
          options={categories.filter(c => c.type === 'expense').map(c => ({ value: c.id, label: c.name }))}
          value={form.category_id}
          onChange={(e) => setForm(f => ({ ...f, category_id: e.target.value }))}
          placeholder="Select category"
          required
        />

        <Input
          label="Budget Amount"
          type="number"
          step="1000"
          placeholder="0"
          value={form.amount}
          onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))}
          required
        />

        <Select
          label="Period"
          options={[
            { value: 'weekly', label: 'Weekly' },
            { value: 'monthly', label: 'Monthly' },
            { value: 'yearly', label: 'Yearly' },
          ]}
          value={form.period}
          onChange={(e) => setForm(f => ({ ...f, period: e.target.value }))}
        />

        <Input
          label="Start Date"
          type="date"
          value={form.start_date}
          onChange={(e) => setForm(f => ({ ...f, start_date: e.target.value }))}
        />

        <div className="flex gap-3 pt-4">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" className="flex-1">
            {budget ? 'Update' : 'Create'} Budget
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default Budgets;
