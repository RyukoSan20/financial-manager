import { useState, useEffect } from 'react';
import { chartPalette } from '../utils/appearance';
import { Card, Button, Input, Select, Modal, Badge, EmptyState, Spinner, StatCard } from '../components/ui';
import { Plus, Target, RefreshCw, Trash2, Edit2, TrendingUp, TrendingDown, Clock, CheckCircle } from 'lucide-react';
import { formatCurrency, formatPercent, formatDate } from '../utils/format';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import api from '../services/api';
import { BreakdownViewer } from '../components/common/BreakdownViewer';
import { useTranslation } from '../i18n';

// The accent the user picked is the first colour of the palette.
//
// It is read when the chart is drawn rather than when this file is
// loaded, because the scheme is not known until the appearance has been
// applied to the page.
const COLORS = chartPalette;

export const Goals = () => {
  const { t } = useTranslation();
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const [selectedGoal, setSelectedGoal] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await api.goals.list();
      setGoals(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch goals:', err);
      setGoals([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (formData) => {
    try {
      if (editingGoal) {
        await api.goals.update(editingGoal.id, formData);
      } else {
        await api.goals.create(formData);
      }
      
      setShowModal(false);
      setEditingGoal(null);
      fetchData();
    } catch (err) {
      console.error('Failed to save goal:', err);
      alert(t('goals.save_error').replace('%s', err.message || 'Unknown error'));
    }
  };

  const handleContribution = async (goalId, amount) => {
    try {
      await api.goals.contribute(goalId, { 
        amount, 
        date: new Date().toISOString().split('T')[0] 
      });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm(t('goals.delete_confirm'))) return;
    try {
      await api.goals.delete(id);
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

  const totalTarget = goals.reduce((sum, g) => sum + parseFloat(g.target_amount), 0);
  const totalCurrent = goals.reduce((sum, g) => sum + parseFloat(g.current_amount), 0);
  const activeGoals = goals.filter(g => g.status === 'active').length;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('goals.title')}</h1>
          <p className="text-gray-500 mt-1">{t('goals.active_count').replace('%s', activeGoals)}</p>
        </div>
        <Button onClick={() => { setEditingGoal(null); setShowModal(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          {t('goals.new_goal')}
        </Button>
      </div>

      {/* Summary Cards */}
      {goals.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="!p-4">
            <p className="text-sm text-gray-500">{t('goals.total_target')}</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{formatCurrency(totalTarget)}</p>
          </Card>
          <Card className="!p-4">
            <p className="text-sm text-gray-500">{t('goals.total_saved')}</p>
            <p className="text-xl font-bold text-success-600 mt-1">{formatCurrency(totalCurrent)}</p>
          </Card>
          <Card className="!p-4">
            <p className="text-sm text-gray-500">{t('goals.remaining')}</p>
            <p className="text-xl font-bold text-warning-600 mt-1">{formatCurrency(totalTarget - totalCurrent)}</p>
          </Card>
          <Card className="!p-4">
            <p className="text-sm text-gray-500">{t('goals.overall_progress')}</p>
            <p className="text-xl font-bold text-primary-600 mt-1">
              {totalTarget > 0 ? formatPercent((totalCurrent / totalTarget) * 100) : '0%'}
            </p>
          </Card>
        </div>
      )}

      {/* Goals List */}
      {goals.length === 0 ? (
        <EmptyState
          icon={<Target className="w-8 h-8 text-gray-400" />}
          title={t('goals.empty_title')}
          description={t('goals.empty_desc')}
          action={
            <Button onClick={() => setShowModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              {t('goals.create_goal')}
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4">
          {goals.map((goal) => {
            const progress = (parseFloat(goal.current_amount) / parseFloat(goal.target_amount)) * 100;
            const remaining = parseFloat(goal.target_amount) - parseFloat(goal.current_amount);
            const isOnTrack = goal.on_track ?? true;
            
            return (
              <Card key={goal.id} className="!p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-white"
                      style={{ backgroundColor: goal.color || COLORS()[0] }}
                    >
                      <Target className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{goal.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge 
                          size="sm" 
                          variant={goal.status === 'active' ? 'success' : goal.status === 'completed' ? 'primary' : 'default'}
                        >
                          {t(`goals.status_${goal.status}`)}
                        </Badge>
                        {goal.priority && (
                          <Badge size="sm" variant="warning">{t(`goals.priority_${goal.priority}`)}</Badge>
                        )}
                        {isOnTrack ? (
                          <span className="text-xs text-success-600 flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" /> {t('goals.on_track')}
                          </span>
                        ) : (
                          <span className="text-xs text-danger-600 flex items-center gap-1">
                            <TrendingDown className="w-3 h-3" /> {t('goals.behind')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setEditingGoal(goal); setShowModal(true); }}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(goal.id)}
                      className="p-2 text-gray-400 hover:text-danger-600 hover:bg-danger-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid lg:grid-cols-3 gap-4">
                  <div className="lg:col-span-2 space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">{t('goals.progress')}</span>
                      <span className="font-semibold">{formatPercent(progress)}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div 
                        className="h-3 rounded-full transition-all"
                        style={{ 
                          width: `${Math.min(progress, 100)}%`,
                          backgroundColor: goal.color || COLORS()[0]
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">
                        {t('goals.saved_amount').replace('%s', formatCurrency(goal.current_amount))}
                      </span>
                      <span className="text-gray-500">
                        {t('goals.target_label').replace('%s', formatCurrency(goal.target_amount))}
                      </span>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">{t('goals.remaining')}</span>
                        <span className="font-medium text-gray-900">{formatCurrency(remaining)}</span>
                      </div>
                      {goal.required_monthly_saving && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">{t('goals.monthly_target')}</span>
                          <span className="font-medium text-primary-600">
                            {formatCurrency(goal.required_monthly_saving)}
                          </span>
                        </div>
                      )}
                      {goal.target_date && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">{t('goals.target_date')}</span>
                          <span className="font-medium text-gray-900">{formatDate(goal.target_date)}</span>
                        </div>
                      )}
                      <Button 
                        size="sm" 
                        className="w-full mt-2"
                        onClick={() => {
                          const amount = prompt(t('goals.contribution_prompt'));
                          if (amount && !isNaN(amount)) {
                            handleContribution(goal.id, parseFloat(amount));
                          }
                        }}
                      >
                        <Plus className="w-4 h-4 mr-1" /> {t('goals.add_savings')}
                      </Button>
                    </div>
                  </div>

                  <BreakdownViewer
                    parentType="goal"
                    parentId={goal.id}
                    title={t('goals.breakdown_title')}
                    compact
                  />
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      <GoalModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingGoal(null); }}
        onSubmit={handleSubmit}
        goal={editingGoal}
      />
    </div>
  );
};

const GoalModal = ({ isOpen, onClose, onSubmit, goal }) => {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    name: '',
    target_amount: '',
    current_amount: '0',
    target_date: '',
    goal_type: 'savings',
    color: COLORS()[0],
  });

  // The parts the target has to cover, worked out before the goal is
  // saved so the user can see where the money goes.
  const [preview, setPreview] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState('');

  useEffect(() => {
    setPreview(null);
    setPreviewError('');
  }, [goal]);

  const handlePreview = async () => {
    const amount = parseFloat(form.target_amount);
    if (!amount || amount <= 0) {
      setPreviewError(t('goals.preview_fill_target'));
      return;
    }
    setPreviewing(true);
    setPreviewError('');
    try {
      const res = await api.breakdown.previewGoal({
        name: form.name,
        description: form.name,
        target_amount: amount,
        target_date: form.target_date || null,
      });
      setPreview(res);
    } catch (err) {
      setPreviewError(t('goals.preview_error'));
    } finally {
      setPreviewing(false);
    }
  };

  useEffect(() => {
    if (goal) {
      setForm({
        name: goal.name || '',
        target_amount: goal.target_amount?.toString() || '',
        current_amount: goal.current_amount?.toString() || '0',
        target_date: goal.target_date || '',
        goal_type: goal.goal_type || 'savings',
        color: goal.color || COLORS()[0],
      });
    } else {
      setForm({
        name: '',
        target_amount: '',
        current_amount: '0',
        target_date: '',
        goal_type: 'savings',
        color: COLORS()[0],
      });
    }
  }, [goal]);

  const handleSubmit = (e) => {
    e.preventDefault();
    // Convert date string to ISO format (YYYY-MM-DD) for backend
    const submitData = {
      name: form.name,
      target_amount: parseFloat(form.target_amount),
      current_amount: parseFloat(form.current_amount) || 0,
      goal_type: form.goal_type,
      color: form.color,
    };
    
    // Add target_date only if provided
    if (form.target_date) {
      submitData.target_date = form.target_date;
    }
    
    onSubmit(submitData);
  };

  // The colour the user can pick for a goal. The accent they chose
  // comes first, so it is the colour a goal gets by default.
  const colorOptions = COLORS();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={goal ? t('goals.edit_goal') : t('goals.create_goal')} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label={t('goals.goal_name')}
          placeholder={t('goals.goal_name_placeholder')}
          value={form.name}
          onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
          required
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label={t('goals.target_amount')}
            type="number"
            step="1000"
            placeholder="0"
            value={form.target_amount}
            onChange={(e) => setForm(f => ({ ...f, target_amount: e.target.value }))}
            required
          />
          <Input
            label={t('goals.current_amount')}
            type="number"
            step="1000"
            placeholder="0"
            value={form.current_amount}
            onChange={(e) => setForm(f => ({ ...f, current_amount: e.target.value }))}
          />
        </div>

        <Input
          label={t('goals.target_date')}
          type="date"
          value={form.target_date}
          onChange={(e) => setForm(f => ({ ...f, target_date: e.target.value }))}
        />

        <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
              {t('goals.breakdown_title')}
            </p>
            <button
              type="button"
              onClick={handlePreview}
              disabled={previewing}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {previewing ? t('goals.preview_building') : t('goals.preview_build')}
            </button>
          </div>

          {previewError && (
            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
              {previewError}
            </p>
          )}

          {preview && (
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center gap-2">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {preview.message}
                </p>
                {preview.used_model === false && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                    {t('goals.model_busy')}
                  </span>
                )}
              </div>
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {(preview.lines || []).map((line, index) => (
                  <li
                    key={`${line.name}-${index}`}
                    className="flex items-center justify-between gap-3 py-1.5"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm text-gray-700 dark:text-gray-200">
                      {line.name}
                    </span>
                    <span className="shrink-0 text-sm font-medium text-gray-800 dark:text-gray-200">
                      {formatCurrency(line.amount)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between pt-1.5 text-sm font-semibold">
                <span className="text-gray-700 dark:text-gray-200">{t('goals.total')}</span>
                <span>{formatCurrency(preview.total)}</span>
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">{t('goals.color')}</label>
          <div className="flex gap-2">
            {colorOptions.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setForm(f => ({ ...f, color }))}
                className={`w-8 h-8 rounded-lg ${form.color === color ? 'ring-2 ring-offset-2 ring-gray-400' : ''}`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Select
            label={t('goals.priority')}
            options={[
              { value: 'low', label: t('goals.priority_low') },
              { value: 'medium', label: t('goals.priority_medium') },
              { value: 'high', label: t('goals.priority_high') },
            ]}
            value={form.priority}
            onChange={(e) => setForm(f => ({ ...f, priority: e.target.value }))}
          />
          <Select
            label={t('goals.status')}
            options={[
              { value: 'active', label: t('goals.status_active') },
              { value: 'completed', label: t('goals.status_completed') },
              { value: 'paused', label: t('goals.status_paused') },
            ]}
            value={form.status}
            onChange={(e) => setForm(f => ({ ...f, status: e.target.value }))}
          />
        </div>

        <div className="flex gap-3 pt-4">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1">
            {t('common.cancel')}
          </Button>
          <Button type="submit" className="flex-1">
            {goal ? t('goals.update_goal') : t('goals.create_goal')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default Goals;
