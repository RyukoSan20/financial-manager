import { useState, useEffect } from 'react';
import { Card, Button, Input, Select, Modal, ProgressBar, Badge, EmptyState, Spinner } from '../components/ui';
import { Plus, CreditCard, RefreshCw, Trash2, Edit2, Calendar, DollarSign, AlertTriangle, CheckCircle } from 'lucide-react';
import { formatCurrency, formatDate } from '../utils/format';
import api from '../services/api';

export const Debts = () => {
  const [debts, setDebts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingDebt, setEditingDebt] = useState(null);
  const [selectedDebt, setSelectedDebt] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [amortization, setAmortization] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    fetchData();
  }, [refreshKey]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.debts.list();
      setDebts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch debts:', err);
      setError('Gagal mengambil data utang: ' + (err.message || 'Unknown error'));
      setDebts([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchAmortization = async (debtId) => {
    try {
      const data = await api.debts.schedule(debtId);
      setAmortization(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch amortization:', err);
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
      alert('Gagal menyimpan utang: ' + (err.message || 'Unknown error'));
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
      
      alert('Pembayaran berhasil dicatat!');
    } catch (err) {
      console.error('Payment failed:', err);
      alert('Gagal mencatat pembayaran: ' + (err.message || 'Unknown error'));
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Hapus utang ini?')) return;
    try {
      await api.debts.delete(id);
      setRefreshKey(k => k + 1); // Force re-render
    } catch (err) {
      console.error(err);
      alert('Gagal menghapus: ' + (err.message || 'Unknown error'));
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
            Coba Lagi
          </Button>
        </Card>
      </div>
    );
  }

  // Calculate totals
  const totalDebt = debts.reduce((sum, d) => sum + parseFloat(d.current_balance || d.remaining_principal || d.principal || 0), 0);
  const totalPrincipal = debts.reduce((sum, d) => sum + parseFloat(d.principal || 0), 0);
  const totalPaid = debts.reduce((sum, d) => sum + parseFloat(d.total_paid || 0), 0);
  const totalMonthly = debts.reduce((sum, d) => sum + parseFloat(d.monthly_payment || 0), 0);
  const activeDebts = debts.filter(d => d.status !== 'paid_off').length;
  const paidOffDebts = debts.filter(d => d.status === 'paid_off').length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Utang & Pinjaman</h1>
          <p className="text-gray-500">Kelola semua utang dan pembayaran</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchData} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => { setEditingDebt(null); setShowModal(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Tambah Utang
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-100 rounded-lg">
              <CreditCard className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Sisa Utang</p>
              <p className="text-xl font-bold text-red-600">{formatCurrency(totalDebt)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Pokok</p>
              <p className="text-xl font-bold text-blue-600">{formatCurrency(totalPrincipal)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Terbayar</p>
              <p className="text-xl font-bold text-green-600">{formatCurrency(totalPaid)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <Calendar className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Angsuran/Bulan</p>
              <p className="text-xl font-bold text-yellow-600">{formatCurrency(totalMonthly)}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Status Badges */}
      <div className="flex gap-4">
        <Badge variant="danger">{activeDebts} Aktif</Badge>
        <Badge variant="success">{paidOffDebts} Lunas</Badge>
      </div>

      {/* Debt List */}
      {debts.length === 0 ? (
        <Card className="text-center py-12">
          <CreditCard className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 mb-4">Belum ada data utang</p>
          <Button onClick={() => { setEditingDebt(null); setShowModal(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Tambah Utang Pertama
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {debts.map((debt) => (
            <Card key={debt.id} className="p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold">{debt.name}</h3>
                    <Badge variant={debt.status === 'paid_off' ? 'success' : debt.status === 'upcoming' ? 'warning' : 'default'}>
                      {debt.status === 'paid_off' ? 'LUNAS' : debt.status === 'upcoming' ? 'Jatuh Tempo' : 'Aktif'}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Pokok</p>
                      <p className="font-medium">{formatCurrency(debt.principal)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Sisa</p>
                      <p className="font-medium text-red-600">{formatCurrency(debt.current_balance)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Terbayar</p>
                      <p className="font-medium text-green-600">{formatCurrency(debt.total_paid || 0)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Angsuran</p>
                      <p className="font-medium">{formatCurrency(debt.monthly_payment)}/bln</p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span>Progres Pelunasan</span>
                      <span className="font-medium">{debt.progress_percent?.toFixed(1) || 0}%</span>
                    </div>
                    <ProgressBar value={debt.progress_percent || 0} />
                  </div>

                  {/* Details */}
                  <div className="grid grid-cols-3 gap-4 mt-4 text-sm text-gray-500">
                    <div>
                      <p>Bunga: {debt.interest_rate}%</p>
                    </div>
                    <div>
                      <p>Sisa: {debt.remaining_months || 0} bulan</p>
                    </div>
                    <div>
                      <p>Jatuh Tempo: {debt.next_payment_date ? formatDate(debt.next_payment_date) : '-'}</p>
                    </div>
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
                    Bayar
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
          onClose={() => { setShowPaymentModal(false); setSelectedDebt(null); }}
          onSubmit={handlePayment}
        />
      )}
    </div>
  );
};

// Add/Edit Debt Modal Component
function DebtModal({ debt, onClose, onSubmit }) {
  const [form, setForm] = useState({
    name: debt?.name || '',
    description: debt?.description || '',
    debt_type: debt?.debt_type || 'personal',
    principal: debt?.principal?.toString() || '',
    interest_rate: debt?.interest_rate?.toString() || '0',
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
      interest_rate: parseFloat(form.interest_rate) || 0,
      tenor_months: parseInt(form.tenor_months) || 12,
    });
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={debt ? 'Edit Utang' : 'Tambah Utang'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Nama Utang"
          value={form.name}
          onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
          required
          placeholder="Contoh: Pinjaman BCA KKB"
        />
        
        <Input
          label="Jumlah Pokok"
          type="number"
          value={form.principal}
          onChange={(e) => setForm(f => ({ ...f, principal: e.target.value }))}
          required
          placeholder="10000000"
        />
        
        <Input
          label="Bunga (% per tahun)"
          type="number"
          value={form.interest_rate}
          onChange={(e) => setForm(f => ({ ...f, interest_rate: e.target.value }))}
          placeholder="12"
        />
        
        <Input
          label="Tenor (bulan)"
          type="number"
          value={form.tenor_months}
          onChange={(e) => setForm(f => ({ ...f, tenor_months: e.target.value }))}
          placeholder="12"
        />
        
        <Input
          label="Tanggal Mulai"
          type="date"
          value={form.start_date}
          onChange={(e) => setForm(f => ({ ...f, start_date: e.target.value }))}
        />
        
        <Input
          label="Nama Pemberi Pinjaman"
          value={form.lender_name}
          onChange={(e) => setForm(f => ({ ...f, lender_name: e.target.value }))}
          placeholder="Contoh: Bank BCA"
        />
        
        <div className="flex gap-2 justify-end pt-4">
          <Button type="button" variant="outline" onClick={onClose}>Batal</Button>
          <Button type="submit">{debt ? 'Simpan' : 'Tambah'}</Button>
        </div>
      </form>
    </Modal>
  );
}

// Payment Modal Component
function PaymentModal({ debt, onClose, onSubmit }) {
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
    <Modal isOpen={true} onClose={onClose} title={`Bayar Utang: ${debt.name}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Sisa Utang</p>
              <p className="font-bold text-red-600">{formatCurrency(debt.current_balance)}</p>
            </div>
            <div>
              <p className="text-gray-500">Angsuran/Bulan</p>
              <p className="font-bold">{formatCurrency(debt.monthly_payment)}</p>
            </div>
          </div>
        </div>
        
        <Input
          label="Jumlah Pembayaran"
          type="number"
          value={form.amount}
          onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))}
          required
          placeholder="100000"
        />
        
        <Input
          label="Tanggal Pembayaran"
          type="date"
          value={form.payment_date}
          onChange={(e) => setForm(f => ({ ...f, payment_date: e.target.value }))}
        />
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Catatan</label>
          <textarea
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={form.notes}
            onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
            rows={2}
            placeholder="Opsional"
          />
        </div>
        
        <div className="flex gap-2 justify-end pt-4">
          <Button type="button" variant="outline" onClick={onClose}>Batal</Button>
          <Button type="submit" variant="success">Bayar Sekarang</Button>
        </div>
      </form>
    </Modal>
  );
}

export default Debts;
