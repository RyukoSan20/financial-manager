import { useState, useEffect } from 'react';
import { Card, Button, Input, Select, Modal, Badge, EmptyState, Spinner, StatCard } from '../components/ui';
import { Plus, Target, RefreshCw, Trash2, Edit2, TrendingUp, TrendingDown, Clock, CheckCircle } from 'lucide-react';
import { formatCurrency, formatPercent, formatDate } from '../utils/format';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import api from '../services/api';

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export const Goals = () => {
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
      alert('Failed to save goal: ' + (err.message || 'Unknown error'));
    }
  };

  const handleContribution = async (goalId, amount) => {
    try {
      await api.goals.contribute(goalId, { amount });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this goal?')) return;
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
          <h1 className="text-2xl font-bold text-gray-900">Financial Goals</h1>
          <p className="text-gray-500 mt-1">{activeGoals} active goals</p>
        </div>
        <Button onClick={() => { setEditingGoal(null); setShowModal(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          New Goal
        </Button>
      </div>

      {/* Summary Cards */}
      {goals.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="!p-4">
            <p className="text-sm text-gray-500">Total Target</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{formatCurrency(totalTarget)}</p>
          </Card>
          <Card className="!p-4">
            <p className="text-sm text-gray-500">Total Saved</p>
            <p className="text-xl font-bold text-success-600 mt-1">{formatCurrency(totalCurrent)}</p>
          </Card>
          <Card className="!p-4">
            <p className="text-sm text-gray-500">Remaining</p>
            <p className="text-xl font-bold text-warning-600 mt-1">{formatCurrency(totalTarget - totalCurrent)}</p>
          </Card>
          <Card className="!p-4">
            <p className="text-sm text-gray-500">Overall Progress</p>
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
          title="No financial goals yet"
          description="Set your first savings goal to track your progress"
          action={
            <Button onClick={() => setShowModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Goal
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
                      style={{ backgroundColor: goal.color || '#3b82f6' }}
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
                          {goal.status}
                        </Badge>
                        {goal.priority && (
                          <Badge size="sm" variant="warning">{goal.priority}</Badge>
                        )}
                        {isOnTrack ? (
                          <span className="text-xs text-success-600 flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" /> On Track
                          </span>
                        ) : (
                          <span className="text-xs text-danger-600 flex items-center gap-1">
                            <TrendingDown className="w-3 h-3" /> Behind
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
                      <span className="text-gray-500">Progress</span>
                      <span className="font-semibold">{formatPercent(progress)}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div 
                        className="h-3 rounded-full transition-all"
                        style={{ 
                          width: `${Math.min(progress, 100)}%`,
                          backgroundColor: goal.color || '#3b82f6'
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">
                        {formatCurrency(goal.current_amount)} saved
                      </span>
                      <span className="text-gray-500">
                        {formatCurrency(goal.target_amount)} target
                      </span>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Remaining</span>
                        <span className="font-medium text-gray-900">{formatCurrency(remaining)}</span>
                      </div>
                      {goal.required_monthly_saving && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Monthly target</span>
                          <span className="font-medium text-primary-600">
                            {formatCurrency(goal.required_monthly_saving)}
                          </span>
                        </div>
                      )}
                      {goal.target_date && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Target date</span>
                          <span className="font-medium text-gray-900">{formatDate(goal.target_date)}</span>
                        </div>
                      )}
                      <Button 
                        size="sm" 
                        className="w-full mt-2"
                        onClick={() => {
                          const amount = prompt('Enter contribution amount:');
                          if (amount && !isNaN(amount)) {
                            handleContribution(goal.id, parseFloat(amount));
                          }
                        }}
                      >
                        <Plus className="w-4 h-4 mr-1" /> Add Savings
                      </Button>
                    </div>
                  </div>
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
  const [form, setForm] = useState({
    name: '',
    target_amount: '',
    current_amount: '0',
    target_date: '',
    goal_type: 'savings',
    color: '#3b82f6',
  });

  useEffect(() => {
    if (goal) {
      setForm({
        name: goal.name || '',
        target_amount: goal.target_amount?.toString() || '',
        current_amount: goal.current_amount?.toString() || '0',
        target_date: goal.target_date || '',
        goal_type: goal.goal_type || 'savings',
        color: goal.color || '#3b82f6',
      });
    } else {
      setForm({
        name: '',
        target_amount: '',
        current_amount: '0',
        target_date: '',
        goal_type: 'savings',
        color: '#3b82f6',
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

  const colorOptions = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={goal ? 'Edit Goal' : 'Create Goal'} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Goal Name"
          placeholder="e.g., Emergency Fund"
          value={form.name}
          onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
          required
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Target Amount"
            type="number"
            step="1000"
            placeholder="0"
            value={form.target_amount}
            onChange={(e) => setForm(f => ({ ...f, target_amount: e.target.value }))}
            required
          />
          <Input
            label="Current Amount"
            type="number"
            step="1000"
            placeholder="0"
            value={form.current_amount}
            onChange={(e) => setForm(f => ({ ...f, current_amount: e.target.value }))}
          />
        </div>

        <Input
          label="Target Date"
          type="date"
          value={form.target_date}
          onChange={(e) => setForm(f => ({ ...f, target_date: e.target.value }))}
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
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
            label="Priority"
            options={[
              { value: 'low', label: 'Low' },
              { value: 'medium', label: 'Medium' },
              { value: 'high', label: 'High' },
            ]}
            value={form.priority}
            onChange={(e) => setForm(f => ({ ...f, priority: e.target.value }))}
          />
          <Select
            label="Status"
            options={[
              { value: 'active', label: 'Active' },
              { value: 'completed', label: 'Completed' },
              { value: 'paused', label: 'Paused' },
            ]}
            value={form.status}
            onChange={(e) => setForm(f => ({ ...f, status: e.target.value }))}
          />
        </div>

        <div className="flex gap-3 pt-4">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" className="flex-1">
            {goal ? 'Update' : 'Create'} Goal
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default Goals;
