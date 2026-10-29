import { useState, useEffect, useCallback } from 'react';
import { Card, Button, Input, Modal, ProgressBar, Badge, Spinner } from '../components/ui';
import HonestEmptyState from '../components/common/HonestEmptyState';
import { Plus, CreditCard, RefreshCw, Trash2, Edit2, Calendar, DollarSign, AlertTriangle, CheckCircle } from 'lucide-react';
import SingleAddButton, { isSingleAddOn } from '../components/common/SingleAddButton';
import { formatCurrency, formatDate } from '../utils/format';
import api from '../services/api';
import { BreakdownViewer } from '../components/common/BreakdownViewer';
import { useTranslation } from '../i18n';
import { PageHeader } from '../components/ui/PageHeader';
import { buildFlag } from '../utils/featureFlags';
import { useCurrency, sumInDisplay } from '../utils/currency';

export const Debts = () => {
  const { t } = useTranslation();
  // With the polish switch off, the page keeps the header it has.
  const polished = buildFlag('UI_POLISH');
  const { currency: displayCurrency } = useCurrency();
  const [debts, setDebts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingDebt, setEditingDebt] = useState(null);
  const [selectedDebt, setSelectedDebt] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [amortization, setAmortization] = useState([]);
  // The totals of the schedule: what a month costs, and what the whole
  // debt costs once the interest is counted in.
  const [amortizationSummary, setAmortizationSummary] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.debts.list();
      setDebts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch debts:', err);
      setError(t('debts.load_error').replace('%s', err.message || 'Unknown error'));
      setDebts([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshKey]);

  const fetchAmortization = async (debtId) => {
    try {
      const data = await api.debts.schedule(debtId);
      // The server sends the whole schedule: the money of each month and
      // the totals, all in one object. Only the months are a list.
      setAmortization(Array.isArray(data?.schedule) ? data.schedule : []);
      setAmortizationSummary(
        data && typeof data === 'object'
          ? {
              monthlyPayment: Number(data.monthly_payment || 0),
              totalInterest: Number(data.total_interest || 0),
              totalPayment: Number(data.total_payment || 0),
            }
          : null
      );
    } catch (err) {
      console.error('Failed to fetch amortization:', err);
      setAmortization([]);
      setAmortizationSummary(null);
    }
  };

  const handleSubmit = async (formData) => {
    try {
      if (editingDebt) {
        await api.debts.update(editingDebt.id, formData);
      } else {
        await api.debts.create(formData);
      }
      
      setShowModal(false);
      setEditingDebt(null);
      setRefreshKey(k => k + 1); // Force re-render
    } catch (err) {
      console.error('Failed to save debt:', err);
      alert(t('debts.save_error').replace('%s', err.message || 'Unknown error'));
    }
  };

  const handlePayment = async (debtId, paymentData) => {
    try {
      console.log('Recording payment:', debtId, paymentData);
      const result = await api.debts.payment(debtId, paymentData);
      console.log('Payment recorded:', result);
      
      setShowPaymentModal(false);
      setSelectedDebt(null);
      
      // Force complete re-fetch with new key
      setRefreshKey(k => k + 1);
      
      // Also trigger global refresh
      window.dispatchEvent(new Event('transactionUpdated'));
      
      alert(t('debts.payment_success'));
    } catch (err) {
      console.error('Payment failed:', err);
      alert(t('debts.payment_error').replace('%s', err.message || 'Unknown error'));
    }
  };

  const handleDelete = async (id) => {
    if (!confirm(t('debts.delete_confirm'))) return;
    try {
      await api.debts.delete(id);
      setRefreshKey(k => k + 1); // Force re-render
    } catch (err) {
      console.error(err);
      alert(t('debts.delete_error').replace('%s', err.message || 'Unknown error'));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="text-center py-12">
          <AlertTriangle className="w-12 h-12 mx-auto text-red-500 mb-4" />
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={fetchData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            {t('debts.retry')}
          </Button>
        </Card>
      </div>
    );
  }

  // Calculate totals
  const totalDebt = sumInDisplay(
    debts.map((d) => ({
      ...d,
      _balance: d.current_balance || d.remaining_principal || d.principal || 0,
    })),
    '_balance'
  );
  const totalPrincipal = sumInDisplay(debts, 'principal');
  const totalPaid = sumInDisplay(debts, 'total_paid');
  const totalMonthly = sumInDisplay(debts, 'monthly_payment');
  const activeDebts = debts.filter(d => d.status !== 'paid_off').length;
  const paidOffDebts = debts.filter(d => d.status === 'paid_off').length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      {polished ? (
        <PageHeader
          title={t('debts.title')}
          subtitle={t('debts.subtitle')}
          action={
            <div className="flex gap-2">
              <Button onClick={fetchData} variant="outline">
                <RefreshCw className="w-4 h-4 mr-2" />
                {t('debts.refresh')}
              </Button>
              <Button onClick={() => { setEditingDebt(null); setShowModal(true); }}>
                <Plus className="w-4 h-4 mr-2" />
                {t('debts.add')}
              </Button>
            </div>
          }
        />
      ) : (
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('debts.title')}</h1>
            <p className="text-gray-500">{t('debts.subtitle')}</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={fetchData} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              {t('debts.refresh')}
            </Button>
            {!isSingleAddOn() && (
              <Button onClick={() => { setEditingDebt(null); setShowModal(true); }}>
                <Plus className="w-4 h-4 mr-2" />
                {t('debts.add')}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* The one add button, in the same place on every page. */}
      <SingleAddButton
        label={t('debts.add')}
        onClick={() => { setEditingDebt(null); setShowModal(true); }}
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-100 rounded-lg">
              <CreditCard className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{t('debts.total_remaining')}</p>
              <p className="text-xl font-bold text-red-600">{formatCurrency(totalDebt, displayCurrency)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{t('debts.total_principal')}</p>
              <p className="text-xl font-bold text-primary-600">{formatCurrency(totalPrincipal, displayCurrency)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{t('debts.total_paid')}</p>
              <p className="text-xl font-bold text-green-600">{formatCurrency(totalPaid, displayCurrency)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <Calendar className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{t('debts.monthly_payment')}</p>
              <p className="text-xl font-bold text-yellow-600">{formatCurrency(totalMonthly, displayCurrency)}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Status Badges */}
      <div className="flex gap-4">
        <Badge variant="danger">{t('debts.active_count').replace('%s', activeDebts)}</Badge>
        <Badge variant="success">{t('debts.paid_off_count').replace('%s', paidOffDebts)}</Badge>
      </div>

      {/* Debt List */}
      {debts.length === 0 ? (
        <HonestEmptyState
          titleKey="debts.empty"
          descriptionKey="debts.empty_desc"
          hintKey="debts.empty_hint"
          primaryActionKey="debts.add_first"
          onPrimary={() => { setEditingDebt(null); setShowModal(true); }}
          mascotMood="idle"
        />
      ) : (
        <div className="space-y-4">
          {debts.map((debt) => (
            <Card key={debt.id} className="p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold">{debt.name}</h3>
                    <Badge variant={debt.status === 'paid_off' ? 'success' : debt.status === 'upcoming' ? 'warning' : 'default'}>
                      {debt.status === 'paid_off' ? t('debts.status_paid_off') : debt.status === 'upcoming' ? t('debts.status_due') : t('debts.status_active')}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">{t('debts.principal')}</p>
                      <p className="font-medium">{formatCurrency(debt.principal, debt.currency)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">{t('debts.remaining')}</p>
                      <p className="font-medium text-red-600">{formatCurrency(debt.current_balance, debt.currency)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">{t('debts.paid')}</p>
                      <p className="font-medium text-green-600">{formatCurrency(debt.total_paid || 0, debt.currency)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">{t('debts.installment')}</p>
                      <p className="font-medium">{formatCurrency(debt.monthly_payment, debt.currency)}{t('debts.per_month_suffix')}</p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span>{t('debts.repayment_progress')}</span>
                      <span className="font-medium">{debt.progress_percent?.toFixed(1) || 0}%</span>
                    </div>
                    <ProgressBar value={debt.progress_percent || 0} />
                  </div>

                  {/* Details */}
                  <div className="grid grid-cols-3 gap-4 mt-4 text-sm text-gray-500">
                    <div>
                      <p>{t('debts.interest').replace('%s', Number(debt.interest_rate * 100 || 0).toFixed(2).replace(/\.00$/, ''))}</p>
                    </div>
                    <div>
                      <p>{t('debts.remaining_months').replace('%s', debt.remaining_months || 0)}</p>
                    </div>
                    <div>
                      <p>{t('debts.due_date').replace('%s', debt.next_payment_date ? formatDate(debt.next_payment_date) : '-')}</p>
                    </div>
                  </div>

                  <div className="mt-3">
                    <BreakdownViewer
                      parentType="debt"
                      parentId={debt.id}
                      title={t('debts.breakdown_title')}
                      compact
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 ml-4">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => { setEditingDebt(debt); setShowModal(true); }}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => { setSelectedDebt(debt); setShowPaymentModal(true); fetchAmortization(debt.id); }}
                  >
                    {t('debts.pay')}
                  </Button>
                  <Button 
                    size="sm" 
                    variant="danger"
                    onClick={() => handleDelete(debt.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <DebtModal
          debt={editingDebt}
          onClose={() => { setShowModal(false); setEditingDebt(null); }}
          onSubmit={handleSubmit}
        />
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedDebt && (
        <PaymentModal
          debt={selectedDebt}
          amortization={amortization}
          amortizationSummary={amortizationSummary}
          onClose={() => { setShowPaymentModal(false); setSelectedDebt(null); }}
          onSubmit={handlePayment}
        />
      )}
    </div>
  );
};

// Add/Edit Debt Modal Component
function DebtModal({ debt, onClose, onSubmit }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    name: debt?.name || '',
    description: debt?.description || '',
    debt_type: debt?.debt_type || 'personal',
    principal: debt?.principal?.toString() || '',
    interest_rate: debt?.interest_rate != null
      ? String(Number(debt.interest_rate) * 100)
      : '0',
    tenor_months: debt?.tenor_months?.toString() || '12',
    start_date: debt?.start_date || new Date().toISOString().split('T')[0],
    lender_name: debt?.lender_name || '',
    account_id: debt?.account_id || '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...form,
      principal: parseFloat(form.principal) || 0,
      // The backend stores the rate as a fraction, so 10% is 0.1.
      interest_rate: (parseFloat(form.interest_rate) || 0) / 100,
      tenor_months: parseInt(form.tenor_months) || 12,
    });
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={debt ? t('debts.edit') : t('debts.add')}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label={t('debts.name')}
          value={form.name}
          onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
          required
          placeholder={t('debts.name_placeholder')}
        />
        
        <Input
          label={t('debts.principal_amount')}
          type="number"
          value={form.principal}
          onChange={(e) => setForm(f => ({ ...f, principal: e.target.value }))}
          required
          placeholder="10000000"
        />
        
        <Input
          label={t('debts.interest_rate_label')}
          type="number"
          value={form.interest_rate}
          onChange={(e) => setForm(f => ({ ...f, interest_rate: e.target.value }))}
          placeholder="12"
        />
        
        <Input
          label={t('debts.tenor')}
          type="number"
          value={form.tenor_months}
          onChange={(e) => setForm(f => ({ ...f, tenor_months: e.target.value }))}
          placeholder="12"
        />
        
        <Input
          label={t('debts.start_date')}
          type="date"
          value={form.start_date}
          onChange={(e) => setForm(f => ({ ...f, start_date: e.target.value }))}
        />
        
        <Input
          label={t('debts.lender_name')}
          value={form.lender_name}
          onChange={(e) => setForm(f => ({ ...f, lender_name: e.target.value }))}
          placeholder={t('debts.lender_placeholder')}
        />
        
        <div className="flex gap-2 justify-end pt-4">
          <Button type="button" variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit">{debt ? t('common.save') : t('debts.add')}</Button>
        </div>
      </form>
    </Modal>
  );
}

// Payment Modal Component
function PaymentModal({ debt, amortization, amortizationSummary, onClose, onSubmit }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    amount: debt.monthly_payment?.toString() || debt.current_balance?.toString() || '',
    payment_date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(debt.id, {
      amount: parseFloat(form.amount) || 0,
      payment_date: form.payment_date,
      notes: form.notes,
    });
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={t('debts.pay_title').replace('%s', debt.name)}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">{t('debts.remaining_debt')}</p>
              <p className="font-bold text-red-600">{formatCurrency(debt.current_balance, debt.currency)}</p>
            </div>
            <div>
              <p className="text-gray-500">{t('debts.monthly_payment')}</p>
              <p className="font-bold">{formatCurrency(debt.monthly_payment, debt.currency)}</p>
            </div>
          </div>
        </div>
        
        <Input
          label={t('debts.payment_amount')}
          type="number"
          value={form.amount}
          onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))}
          required
          placeholder="100000"
        />
        
        <Input
          label={t('debts.payment_date')}
          type="date"
          value={form.payment_date}
          onChange={(e) => setForm(f => ({ ...f, payment_date: e.target.value }))}
        />
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('debts.notes')}</label>
          <textarea
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            value={form.notes}
            onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
            rows={2}
            placeholder={t('debts.optional')}
          />
        </div>

        {/* The schedule of the debt: what each month costs, and what
            the whole debt costs once the interest is counted in. */}
        {amortization && amortization.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700">
                {t('debts.schedule_title')}
              </h3>
            </div>
            <div className="max-h-56 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-500 sticky top-0">
                  <tr>
                    <th className="text-left px-2 py-1.5 font-medium">{t('debts.schedule_month')}</th>
                    <th className="text-right px-2 py-1.5 font-medium">{t('debts.schedule_payment')}</th>
                    <th className="text-right px-2 py-1.5 font-medium">{t('debts.schedule_principal')}</th>
                    <th className="text-right px-2 py-1.5 font-medium">{t('debts.schedule_interest')}</th>
                    <th className="text-right px-2 py-1.5 font-medium">{t('debts.schedule_balance')}</th>
                  </tr>
                </thead>
                <tbody>
                  {amortization.map((row) => (
                    <tr key={row.month} className="border-t border-gray-100">
                      <td className="px-2 py-1.5 text-gray-700">{row.month}</td>
                      <td className="px-2 py-1.5 text-right font-medium text-gray-800">
                        {formatCurrency(Number(row.payment || 0), debt.currency)}
                      </td>
                      <td className="px-2 py-1.5 text-right text-gray-600">
                        {formatCurrency(Number(row.principal || 0), debt.currency)}
                      </td>
                      <td className="px-2 py-1.5 text-right text-red-600">
                        {formatCurrency(Number(row.interest || 0), debt.currency)}
                      </td>
                      <td className="px-2 py-1.5 text-right text-gray-600">
                        {formatCurrency(Number(row.balance || 0), debt.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {amortizationSummary && (
              <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs flex justify-between">
                <span className="text-gray-500">{t('debts.schedule_total_interest')}</span>
                <span className="font-semibold text-red-600">
                  {formatCurrency(amortizationSummary.totalInterest, debt.currency)}
                </span>
                <span className="text-gray-500">{t('debts.schedule_total_payment')}</span>
                <span className="font-semibold text-gray-800">
                  {formatCurrency(amortizationSummary.totalPayment, debt.currency)}
                </span>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2 justify-end pt-4">
          <Button type="button" variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" variant="success">{t('debts.pay_now')}</Button>
        </div>
      </form>
    </Modal>
  );
}

export default Debts;
