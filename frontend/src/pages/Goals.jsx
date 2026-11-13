import { useState, useEffect, useMemo, useCallback } from 'react';
import { chartPalette } from '../utils/appearance';
import { Card, Button, Input, Select, Modal, Badge, Spinner, StatCard } from '../components/ui';
import TiltCard from '../components/ui/TiltCard';
import GoalPriorityKanban from '../components/goals/GoalPriorityKanban';
import EditableAiCostBreakdown from '../components/goals/EditableAiCostBreakdown';
import HonestEmptyState from '../components/common/HonestEmptyState';
import { Plus, Target, RefreshCw, Trash2, Edit2, TrendingUp, TrendingDown, Clock, CheckCircle } from 'lucide-react';
import { goalIcon } from '../utils/goalIcon';
import SingleAddButton, { isSingleAddOn } from '../components/common/SingleAddButton';
import { formatCurrency, formatPercent, formatDate } from '../utils/format';
import { useCurrency, sumInDisplay } from '../utils/currency';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import api from '../services/api';
import { BreakdownViewer } from '../components/common/BreakdownViewer';
import { useTranslation } from '../i18n';
import { PageHeader } from '../components/ui/PageHeader';
import { BotanicalPageHeader, ForestTicketCard, ForestButton, PerchedMascot } from '../components/ui/Botanical';
import KanaheiStampRallyCard from '../components/goals/KanaheiStampRallyCard';
import { buildFlag } from '../utils/featureFlags';
import { toast } from '../contexts/ToastContext';
import { ask } from '../contexts/ConfirmContext';

// The accent the user picked is the first colour of the palette.
//
// It is read when the chart is drawn rather than when this file is
// loaded, because the scheme is not known until the appearance has been
// applied to the page.
const COLORS = chartPalette;

/**
 * The pace of a goal, as a pill.
 *
 * The server says how the goal is going - `on_track`,
 * `slightly_behind`, `behind_track`, `overdue`, `completed` - and
 * each of those has words in every language. A pace the server has
 * not named yet falls back to the plain on-track / behind pair rather
 * than leaking a raw key like `Status_behind_track` onto the page.
 */
const PACE_TONE = {
  completed: 'bg-[#D8F3DC] text-[#1B3B32]',
  on_track: 'bg-[#D8F3DC] text-[#1B3B32]',
  slightly_behind: 'bg-amber-100 text-amber-800',
  behind_track: 'bg-amber-100 text-amber-800',
  overdue: 'bg-rose-100 text-rose-800',
  paused: 'bg-slate-200 text-slate-700',
};

export const GOAL_PACES = ['completed', 'on_track', 'slightly_behind', 'behind_track', 'overdue', 'paused'];

export function goalPaceLabel(goal, t) {
  const pace = goal?.is_completed ? 'completed' : goal?.status;
  // Only a pace with words of its own is asked for by name. A pace
  // the dictionary has not met would come back as the key dressed up
  // as a word ("Pace_something"), which is the leak this replaces.
  if (GOAL_PACES.includes(pace)) return t(`goals.pace_${pace}`);
  return (goal?.on_track ?? true) ? t('goals.on_track') : t('goals.behind');
}

export function GoalPaceBadge({ goal, t }) {
  const pace = goal?.is_completed ? 'completed' : goal?.status;
  const tone = PACE_TONE[pace] || ((goal?.on_track ?? true) ? PACE_TONE.on_track : PACE_TONE.behind_track);
  return (
    <span
      data-testid="goal-pace"
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${tone}`}
    >
      {goalPaceLabel(goal, t)}
    </span>
  );
}

export const Goals = () => {
  const { t } = useTranslation();
  // With the polish switch off, the page keeps the header it has.
  const polished = buildFlag('UI_POLISH');
  const { currency: displayCurrency } = useCurrency();
  const [goals, setGoals] = useState([]);
  // The days the reader wrote something down - the stamps on the
  // rally card. It is the one figure on this page that is about the
  // habit rather than about the money.
  const [stampDays, setStampDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const [selectedGoal, setSelectedGoal] = useState(null);

  // Which box of the priority board each goal sits in.
  //
  // The server keeps the goal; the board keeps the order of it. So
  // the answer is read from this browser, and the board is drawn from
  // it. A goal the reader has not touched falls into its box by
  // itself.
  const [quadrants, setQuadrants] = useState(() => {
    try {
      const stored = localStorage.getItem('goal_quadrants');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

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

    // The days that were written down. The list is asked for last, and
    // it is only for the stamps, so a failure here leaves the page
    // exactly as it was.
    try {
      const txs = await api.transactions.list({ limit: 100 });
      const rows = Array.isArray(txs) ? txs : (txs?.transactions || []);
      const days = Array.from(new Set(rows.map((tx) => tx.date).filter(Boolean))).sort();
      setStampDays(days);
    } catch (err) {
      setStampDays([]);
    }
  };

  // The goals as the board sees them: the ones the reader has placed
  // carry the box they were put in.
  const boardGoals = useMemo(
    () =>
      goals.map((goal) => {
        const placed = quadrants[goal.id];
        return placed ? { ...goal, quadrant: placed } : goal;
      }),
    [goals, quadrants]
  );

  const handleMove = useCallback((goalId, quadrantKey) => {
    setQuadrants((previous) => {
      const next = { ...previous, [goalId]: quadrantKey };
      try {
        localStorage.setItem('goal_quadrants', JSON.stringify(next));
      } catch {
        // A browser that will not keep the answer is not a reason to
        // break the board.
      }
      return next;
    });
  }, []);

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
      toast.error(t('goals.save_error').replace('%s', err.message || 'Unknown error'));
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
    if (!(await ask({ message: t('goals.delete_confirm'), tone: 'danger' }))) return;
    try {
      await api.goals.delete(id);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  // How many days in a row the reader has written something down,
  // counting back from today. That is how many of the seven stamps
  // are filled.
  const stampFilled = useMemo(() => {
    if (!stampDays.length) return 0;
    const iso = (d) => d.toISOString().slice(0, 10);
    const today = new Date();
    let filled = 0;
    // Today counts even if it has no transaction yet - the reader is
    // still in the middle of the day.
    for (let i = 0; i < 7; i += 1) {
      const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      if (stampDays.includes(iso(day))) filled += 1;
      else if (i === 0) continue; // today may still be empty
      else break;
    }
    return Math.min(filled, 7);
  }, [stampDays]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  const totalTarget = sumInDisplay(goals, 'target_amount');
  const totalCurrent = sumInDisplay(goals, 'current_amount');
  // The server's `status` is the pace of the goal - on track, behind,
  // overdue, completed - not whether it is live. A goal is active
  // when it is still open and not yet reached. Counting `status ===
  // 'active'` found nothing, and the page said "0 target aktif" above
  // two goals.
  const activeGoals = goals.filter((g) => g.is_active !== false && !g.is_completed).length;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <BotanicalPageHeader
        badge={t('goals.badge')}
        title={t('goals.title')}
        subtitle={t('goals.active_count').replace('%s', activeGoals)}
        action={!isSingleAddOn() ? (
          <ForestButton onClick={() => { setEditingGoal(null); setShowModal(true); }}>
            <Plus className="w-4 h-4" />
            {t('goals.new_goal')}
          </ForestButton>
        ) : null}
      />

      {/* The one add button, in the same place on every page. */}
      <SingleAddButton
        label={t('goals.new_goal')}
        onClick={() => { setEditingGoal(null); setShowModal(true); }}
      />

      {/* The seven-day stamp card. */}
      <KanaheiStampRallyCard
        filled={stampFilled}
        onAction={() => { window.location.href = '/add'; }}
      />

      {/* Summary: the forest ticket, with the three tiles beside it. */}
      {goals.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <ForestTicketCard
            data-testid="goals-summary-ticket"
            eyebrow={t('goals.badge')}
            title={t('goals.total_saved')}
            value={formatCurrency(totalCurrent, displayCurrency)}
            caption={t('goals.saved_of_target', '', {
              target: formatCurrency(totalTarget, displayCurrency),
              percent: totalTarget > 0 ? formatPercent((totalCurrent / totalTarget) * 100) : '0%',
            })}
          >
            <div className="botanical-bar mt-4" aria-hidden="true">
              <span style={{ width: `${totalTarget > 0 ? Math.min(100, (totalCurrent / totalTarget) * 100) : 0}%` }} />
            </div>
          </ForestTicketCard>
          <div className="grid grid-cols-2 gap-4 content-start">
            <Card tier="tile" hue="violet" className="!p-4">
              <p className="text-sm text-gray-500">{t('goals.total_target')}</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{formatCurrency(totalTarget, displayCurrency)}</p>
            </Card>
            <Card tier="tile" hue="amber" className="!p-4">
              <p className="text-sm text-gray-500">{t('goals.remaining')}</p>
              <p className="text-xl font-bold text-warning-600 mt-1">{formatCurrency(totalTarget - totalCurrent, displayCurrency)}</p>
            </Card>
            <Card tier="tile" hue="emerald" className="!p-4">
              <p className="text-sm text-gray-500">{t('goals.total_saved')}</p>
              <p className="text-xl font-bold text-success-600 mt-1">{formatCurrency(totalCurrent, displayCurrency)}</p>
            </Card>
            <Card tier="tile" hue="sky" className="!p-4">
              <p className="text-sm text-gray-500">{t('goals.overall_progress')}</p>
              <p className="text-xl font-bold text-primary-600 mt-1">
                {totalTarget > 0 ? formatPercent((totalCurrent / totalTarget) * 100) : '0%'}
              </p>
            </Card>
          </div>
        </div>
      )}

      {/* Goals List */}
      {goals.length === 0 ? (
        <HonestEmptyState
          titleKey="goals.empty_title"
          descriptionKey="goals.empty_desc"
          hintKey="goals.empty_hint"
          primaryActionKey="goals.create_goal"
          onPrimary={() => setShowModal(true)}
          mascotMood="idle"
        />
      ) : (
        <div className="grid gap-4">
          {goals.map((goal, goalIndex) => {
            const progress = (parseFloat(goal.current_amount) / parseFloat(goal.target_amount)) * 100;
            const remaining = parseFloat(goal.target_amount) - parseFloat(goal.current_amount);
            const isOnTrack = goal.on_track ?? true;
            // The mascot perches on the top goal, the way it does on
            // the household's first card.
            const perched = goalIndex === 0;

            return (
              <TiltCard key={goal.id} className={`rounded-2xl ${perched ? 'mt-8' : ''}`}>
              <Card className="!p-5 hover:shadow-md transition-shadow h-full relative">
                {perched ? (
                  <PerchedMascot
                    size={52}
                    state={isOnTrack ? 'happy' : 'alert'}
                    label={goal.name}
                  />
                ) : null}
                <div className="flex items-start justify-between mb-4">
                  {/* The icon holds its place and the text is allowed
                      to shrink. Without this a long goal name pushed
                      the picture over the words. */}
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-white shrink-0"
                      style={{ backgroundColor: goal.color || COLORS()[0] }}
                    >
                      {/* The picture is the one the goal asks for, not
                          always the same target. */}
                      {(() => {
                        const Icon = goalIcon(goal);
                        return <Icon className="w-6 h-6 shrink-0" />;
                      })()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-900 truncate">{goal.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <GoalPaceBadge goal={goal} t={t} />
                        {goal.priority && (
                          <Badge size="sm" variant="warning">{t(`goals.priority_${goal.priority}`)}</Badge>
                        )}
                        {isOnTrack ? (
                          <span className="text-xs text-[#15803D] flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                          </span>
                        ) : (
                          <span className="text-xs text-[#B45309] flex items-center gap-1">
                            <TrendingDown className="w-3 h-3" />
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
                        className="h-3 rounded-full transition-[width]"
                        style={{ 
                          width: `${Math.min(progress, 100)}%`,
                          backgroundColor: goal.color || COLORS()[0]
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">
                        {t('goals.saved_amount').replace('%s', formatCurrency(goal.current_amount, goal.currency))}
                      </span>
                      <span className="text-gray-500">
                        {t('goals.target_label').replace('%s', formatCurrency(goal.target_amount, goal.currency))}
                      </span>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">{t('goals.remaining')}</span>
                        <span className="font-medium text-gray-900">{formatCurrency(remaining, goal.currency)}</span>
                      </div>
                      {goal.required_monthly_saving && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">{t('goals.monthly_target')}</span>
                          <span className="font-medium text-primary-600">
                            {formatCurrency(goal.required_monthly_saving, goal.currency)}
                          </span>
                        </div>
                      )}
                      {goal.target_date && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">{t('goals.target_date')}</span>
                          <span className="font-medium text-gray-900">{formatDate(goal.target_date)}</span>
                        </div>
                      )}
                      <ForestButton
                        className="w-full mt-2 !rounded-xl"
                        onClick={() => {
                          const amount = prompt(t('goals.contribution_prompt'));
                          if (amount && !isNaN(amount)) {
                            handleContribution(goal.id, parseFloat(amount));
                          }
                        }}
                      >
                        <Plus className="w-4 h-4" /> {t('goals.add_savings')}
                      </ForestButton>
                    </div>
                  </div>

                  <BreakdownViewer
                    parentType="goal"
                    parentId={goal.id}
                    title={t('goals.breakdown_title')}
                    compact
                  />

                  {/* The breakdown the model worked out, which the
                      reader can correct line by line. */}
                  <EditableAiCostBreakdown
                    goalId={goal.id}
                    currency={goal.currency}
                  />
                </div>
              </Card>
              </TiltCard>
            );
          })}
        </div>
      )}

      {/* The priority board: four boxes, and the goals in each. */}
      {goals.length > 0 && (
        <GoalPriorityKanban goals={boardGoals} onMove={handleMove} />
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
                      {formatCurrency(line.amount, line.currency)}
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
