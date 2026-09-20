import { useState, useEffect } from 'react';
import { Card, Button, Input, Select, Modal, ProgressBar, Badge, EmptyState, Spinner } from '../components/ui';
import { Plus, CreditCard, RefreshCw, Trash2, Edit2, Calendar, DollarSign, AlertTriangle, CheckCircle } from 'lucide-react';
import { formatCurrency, formatDate } from '../utils/format';

export const Debts = () => {
  const [debts, setDebts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [editingDebt, setEditingDebt] = useState(null);
  const [selectedDebt, setSelectedDebt] = useState(null);
  const [amortization, setAmortization] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/debts/');
      const data = await res.json();
      setDebts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAmortization = async (debtId) => {
    try {
      const res = await fetch(`/api/debts/${debtId}/amortization`);
      const data = await res.json();
      setAmortization(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (formData) => {
    try {
      const method = editingDebt ? 'PUT' : 'POST';
      const url = editingDebt 
        ? `/api/debts/${editingDebt.id}` 
        : '/api/debts/';
      
      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      
      setShowModal(false);
      setEditingDebt(null);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handlePayment = async (debtId, paymentData) => {
    try {
      await fetch(`/api/debts/${debtId}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentData),
      });
      setShowPaymentModal(false);
      setSelectedDebt(null);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this debt?')) return;
    try {
      await fetch(`/api/debts/${id}`, { method: 'DELETE' });
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

  const totalDebt = debts.reduce((sum, d) => sum + parseFloat(d.remaining_principal || d.principal), 0);
  const totalMonthly = debts.reduce((sum, d) => sum + parseFloat(d.monthly_payment || 0), 0);
  const activeDebts = debts.filter(d => d.status !== 'paid_off').length;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Debts & Loans</h1>
          <p className="text-gray-500 mt-1">{activeDebts} active debts</p>
        </div>
        <Button onClick={() => { setEditingDebt(null); setShowModal(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Add Debt
        </Button>
      </div>

      {/* Summary Cards */}
      {debts.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="!p-4">
            <p className="text-sm text-gray-500">Total Outstanding</p>
            <p className="text-xl font-bold text-danger-600 mt-1">{formatCurrency(totalDebt)}</p>
          </Card>
          <Card className="!p-4">
            <p className="text-sm text-gray-500">Monthly Payment</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{formatCurrency(totalMonthly)}</p>
          </Card>
          <Card className="!p-4">
            <p className="text-sm text-gray-500">Active Debts</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{activeDebts}</p>
          </Card>
          <Card className="!p-4">
            <p className="text-sm text-gray-500">Paid Off</p>
            <p className="text-xl font-bold text-success-600 mt-1">
              {debts.length - activeDebts}
            </p>
          </Card>
        </div>
      )}

      {/* Debts List */}
      {debts.length === 0 ? (
        <EmptyState
          icon={<CreditCard className="w-8 h-8 text-gray-400" />}
          title="No debts recorded"
          description="Track your loans and credit card debts here"
          action={
            <Button onClick={() => setShowModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Debt
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {debts.map((debt) => {
            const principal = parseFloat(debt.principal);
            const remaining = parseFloat(debt.remaining_principal || principal);
            const progress = ((principal - remaining) / principal) * 100;
            const isOverdue = debt.due_date && new Date(debt.due_date) < new Date();
            
            return (
              <Card key={debt.id} className="!p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      debt.status === 'paid_off' ? 'bg-success-100 text-success-600' :
                      debt.debt_type === 'credit_card' ? 'bg-orange-100 text-orange-600' :
                      'bg-red-100 text-red-600'
                    }`}>
                      <CreditCard className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{debt.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge 
                          size="sm" 
                          variant={debt.status === 'active' ? 'danger' : debt.status === 'paid_off' ? 'success' : 'default'}
                        >
                          {debt.status?.replace('_', ' ')}
                        </Badge>
                        <Badge size="sm">{debt.debt_type?.replace('_', ' ')}</Badge>
                        {isOverdue && debt.status === 'active' && (
                          <span className="text-xs text-danger-600 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Overdue
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setSelectedDebt(debt);
                        fetchAmortization(debt.id);
                      }}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                      title="View Amortization"
                    >
                      <Calendar className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => { setEditingDebt(debt); setShowModal(true); }}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(debt.id)}
                      className="p-2 text-gray-400 hover:text-danger-600 hover:bg-danger-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid lg:grid-cols-4 gap-4">
                  <div className="lg:col-span-3 space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Remaining Principal</span>
                      <span className="font-semibold text-danger-600">{formatCurrency(remaining)}</span>
                    </div>
                    <ProgressBar value={Math.min(progress, 100)} color="danger" size="md" />
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Original</span>
                        <p className="font-medium text-gray-900">{formatCurrency(principal)}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Monthly</span>
                        <p className="font-medium text-gray-900">{formatCurrency(debt.monthly_payment)}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Rate</span>
                        <p className="font-medium text-gray-900">{debt.interest_rate}%</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Remaining</span>
                      <span className="font-medium text-gray-900">{debt.remaining_installments} months</span>
                    </div>
                    {debt.due_date && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Due date</span>
                        <span className="font-medium text-gray-900">{formatDate(debt.due_date)}</span>
                      </div>
                    )}
                    {debt.status === 'active' && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="w-full mt-2"
                        onClick={() => {
                          setSelectedDebt(debt);
                          setShowPaymentModal(true);
                        }}
                      >
                        <DollarSign className="w-4 h-4 mr-1" /> Record Payment
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      <DebtModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingDebt(null); }}
        onSubmit={handleSubmit}
        debt={editingDebt}
      />

      {/* Payment Modal */}
      {selectedDebt && (
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={() => { setShowPaymentModal(false); setSelectedDebt(null); }}
          onSubmit={(data) => handlePayment(selectedDebt.id, data)}
          debt={selectedDebt}
        />
      )}

      {/* Amortization Modal */}
      {selectedDebt && amortization.length > 0 && (
        <Modal
          isOpen={true}
          onClose={() => { setSelectedDebt(null); setAmortization([]); }}
          title={`${selectedDebt.name} - Amortization Schedule`}
          size="lg"
        >
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left">#</th>
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-4 py-2 text-right">Payment</th>
                  <th className="px-4 py-2 text-right">Principal</th>
                  <th className="px-4 py-2 text-right">Interest</th>
                  <th className="px-4 py-2 text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {amortization.map((row, i) => (
                  <tr key={i} className="border-b">
                    <td className="px-4 py-2">{i + 1}</td>
                    <td className="px-4 py-2">{row.date}</td>
                    <td className="px-4 py-2 text-right">{formatCurrency(row.payment)}</td>
                    <td className="px-4 py-2 text-right">{formatCurrency(row.principal_portion)}</td>
                    <td className="px-4 py-2 text-right">{formatCurrency(row.interest_portion)}</td>
                    <td className="px-4 py-2 text-right font-medium">{formatCurrency(row.remaining_balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}
    </div>
  );
};

const DebtModal = ({ isOpen, onClose, onSubmit, debt }) => {
  const [form, setForm] = useState({
    name: '',
    debt_type: 'personal_loan',
    principal: '',
    interest_rate: '0',
    tenor_months: '',
    monthly_payment: '',
    start_date: new Date().toISOString().split('T')[0],
    status: 'active',
  });

  useEffect(() => {
    if (debt) {
      setForm({
        name: debt.name || '',
        debt_type: debt.debt_type || 'personal_loan',
        principal: debt.principal?.toString() || '',
        interest_rate: debt.interest_rate?.toString() || '0',
        tenor_months: debt.tenor_months?.toString() || '',
        monthly_payment: debt.monthly_payment?.toString() || '',
        start_date: debt.start_date || new Date().toISOString().split('T')[0],
        status: debt.status || 'active',
      });
    } else {
      setForm({
        name: '',
        debt_type: 'personal_loan',
        principal: '',
        interest_rate: '0',
        tenor_months: '',
        monthly_payment: '',
        start_date: new Date().toISOString().split('T')[0],
        status: 'active',
      });
    }
  }, [debt]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...form,
      principal: parseFloat(form.principal),
      interest_rate: parseFloat(form.interest_rate),
      tenor_months: parseInt(form.tenor_months),
      monthly_payment: parseFloat(form.monthly_payment),
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={debt ? 'Edit Debt' : 'Add Debt'} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Debt Name"
          placeholder="e.g., KPR Rumah"
          value={form.name}
          onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
          required
        />

        <Select
          label="Debt Type"
          options={[
            { value: 'personal_loan', label: 'Personal Loan' },
            { value: 'kpr', label: 'KPR (Home Loan)' },
            { value: 'kmu', label: 'KMU / Business Loan' },
            { value: 'credit_card', label: 'Credit Card' },
            { value: 'student_loan', label: 'Student Loan' },
            { value: 'other', label: 'Other' },
          ]}
          value={form.debt_type}
          onChange={(e) => setForm(f => ({ ...f, debt_type: e.target.value }))}
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Principal Amount"
            type="number"
            step="1000"
            placeholder="0"
            value={form.principal}
            onChange={(e) => setForm(f => ({ ...f, principal: e.target.value }))}
            required
          />
          <Input
            label="Interest Rate (% per year)"
            type="number"
            step="0.01"
            placeholder="0"
            value={form.interest_rate}
            onChange={(e) => setForm(f => ({ ...f, interest_rate: e.target.value }))}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Tenor (months)"
            type="number"
            placeholder="e.g., 36"
            value={form.tenor_months}
            onChange={(e) => setForm(f => ({ ...f, tenor_months: e.target.value }))}
            required
          />
          <Input
            label="Monthly Payment"
            type="number"
            step="1000"
            placeholder="0"
            value={form.monthly_payment}
            onChange={(e) => setForm(f => ({ ...f, monthly_payment: e.target.value }))}
            required
          />
        </div>

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
            {debt ? 'Update' : 'Add'} Debt
          </Button>
        </div>
      </form>
    </Modal>
  );
};

const PaymentModal = ({ isOpen, onClose, onSubmit, debt }) => {
  const [form, setForm] = useState({
    amount: debt?.monthly_payment?.toString() || '',
    date: new Date().toISOString().split('T')[0],
    principal_portion: '',
    interest_portion: '',
    notes: '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...form,
      amount: parseFloat(form.amount),
      principal_portion: parseFloat(form.principal_portion) || undefined,
      interest_portion: parseFloat(form.interest_portion) || undefined,
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Record Payment" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Payment Amount"
          type="number"
          step="1000"
          placeholder="0"
          value={form.amount}
          onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))}
          required
        />

        <Input
          label="Payment Date"
          type="date"
          value={form.date}
          onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))}
          required
        />

        <Input
          label="Notes (optional)"
          placeholder="Payment reference"
          value={form.notes}
          onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
        />

        <div className="flex gap-3 pt-4">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" className="flex-1">
            Record Payment
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default Debts;
