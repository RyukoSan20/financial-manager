import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, ShoppingBag, Smartphone, Banknote, TrendingUp, Calendar } from 'lucide-react';
import merchantApi from '../services/merchantApi';
import { QuickPOSModal, MerchantDashboardWidget, DailySettlementModal } from '../components/merchant';
import { formatCurrency } from '../utils/format';

const MerchantManager = () => {
  const [merchants, setMerchants] = useState([]);
  const [selectedMerchant, setSelectedMerchant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPOS, setShowPOS] = useState(false);
  const [showSettlement, setShowSettlement] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newMerchant, setNewMerchant] = useState({
    store_name: '',
    business_type: 'grocery',
    store_phone: '',
    store_address: '',
    qris_enabled: false
  });

  useEffect(() => {
    loadMerchants();
  }, []);

  const loadMerchants = async () => {
    setLoading(true);
    try {
      const data = await merchantApi.listMerchants();
      setMerchants(data || []);
      if (data && data.length > 0 && !selectedMerchant) {
        setSelectedMerchant(data[0]);
      }
    } catch (err) {
      console.error('Failed to load merchants:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMerchant = async () => {
    if (!newMerchant.store_name) {
      alert('Nama toko harus diisi');
      return;
    }

    try {
      const created = await merchantApi.createMerchant(newMerchant);
      setMerchants([...merchants, created]);
      setSelectedMerchant(created);
      setShowCreateModal(false);
      setNewMerchant({ store_name: '', business_type: 'grocery', store_phone: '', store_address: '', qris_enabled: false });
    } catch (err) {
      console.error('Failed to create merchant:', err);
      alert('Gagal membuat toko');
    }
  };

  const handleDeleteMerchant = async (id) => {
    if (!confirm('Yakin ingin menghapus toko ini?')) return;

    try {
      await merchantApi.deleteMerchant(id);
      setMerchants(merchants.filter(m => m.id !== id));
      if (selectedMerchant?.id === id) {
        setSelectedMerchant(merchants[0] || null);
      }
    } catch (err) {
      console.error('Failed to delete merchant:', err);
      alert('Gagal menghapus toko');
    }
  };

  const handleSaleComplete = () => {
    loadMerchants();
  };

  const businessTypes = [
    { value: 'grocery', label: 'Toko Kelontong' },
    { value: 'food_stall', label: 'Warung Makan' },
    { value: 'coffee_shop', label: 'Kedai Kopi' },
    { value: 'mini_market', label: 'Minimarket' },
    { value: 'pharmacy', label: 'Apotek' },
    { value: 'restaurant', label: 'Restaurant' },
    { value: 'other', label: 'Lainnya' }
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ShoppingBag className="w-8 h-8 text-primary-600" />
          <h1 className="text-2xl font-bold">Toko / Merchant</h1>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          <Plus size={20} />
          <span>Tambah Toko</span>
        </button>
      </div>

      {merchants.length === 0 ? (
        // Empty State
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-8 text-center">
          <ShoppingBag className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Belum Ada Toko</h2>
          <p className="text-gray-500 mb-4">Tambahkan toko pertama Anda untuk mulai mencatat penjualan</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            + Tambah Toko
          </button>
        </div>
      ) : (
        // Merchant List & Dashboard
        <div className="space-y-6">
          {/* Merchant Selector */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Pilih Toko
            </label>
            <div className="flex gap-2">
              <select
                value={selectedMerchant?.id || ''}
                onChange={(e) => {
                  const m = merchants.find(m => m.id === parseInt(e.target.value));
                  setSelectedMerchant(m);
                }}
                className="flex-1 px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              >
                {merchants.map(m => (
                  <option key={m.id} value={m.id}>{m.store_name}</option>
                ))}
              </select>
              {selectedMerchant && (
                <>
                  <button
                    onClick={() => setShowPOS(true)}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                  >
                    <Banknote size={18} />
                    <span>Kasir</span>
                  </button>
                  <button
                    onClick={() => setShowSettlement(true)}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center gap-2"
                  >
                    <Calendar size={18} />
                    <span>Tutup Kasir</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Merchant Dashboard Widget */}
          {selectedMerchant && (
            <MerchantDashboardWidget
              merchant={selectedMerchant}
              onViewAll={() => setShowSettlement(true)}
            />
          )}

          {/* Merchant Details */}
          {selectedMerchant && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
              <h2 className="font-semibold mb-4">Detail Toko</h2>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-500">Nama Toko</span>
                  <span className="font-medium">{selectedMerchant.store_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Jenis Usaha</span>
                  <span className="font-medium">
                    {businessTypes.find(t => t.value === selectedMerchant.business_type)?.label || selectedMerchant.business_type}
                  </span>
                </div>
                {selectedMerchant.store_phone && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Telepon</span>
                    <span className="font-medium">{selectedMerchant.store_phone}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">QRIS</span>
                  <span className={`font-medium ${selectedMerchant.qris_enabled ? 'text-green-600' : 'text-gray-400'}`}>
                    {selectedMerchant.qris_enabled ? '✓ Aktif' : '✗ Nonaktif'}
                  </span>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t flex gap-2">
                <button className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center justify-center gap-2">
                  <Edit2 size={16} />
                  <span>Edit</span>
                </button>
                <button
                  onClick={() => handleDeleteMerchant(selectedMerchant.id)}
                  className="px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-lg hover:bg-red-200 flex items-center justify-center"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick POS Modal */}
      <QuickPOSModal
        isOpen={showPOS}
        onClose={() => setShowPOS(false)}
        merchant={selectedMerchant}
        onSaleComplete={handleSaleComplete}
      />

      {/* Daily Settlement Modal */}
      <DailySettlementModal
        isOpen={showSettlement}
        onClose={() => setShowSettlement(false)}
        merchant={selectedMerchant}
        onComplete={loadMerchants}
      />

      {/* Create Merchant Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-primary-600 text-white">
              <div className="flex items-center gap-2">
                <Plus size={20} />
                <span className="font-semibold">Tambah Toko Baru</span>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="p-1 hover:bg-white/20 rounded">
                ✕
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nama Toko *</label>
                <input
                  type="text"
                  value={newMerchant.store_name}
                  onChange={(e) => setNewMerchant({...newMerchant, store_name: e.target.value})}
                  placeholder="Contoh: Warung Kopi Pak Rahman"
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Jenis Usaha</label>
                <select
                  value={newMerchant.business_type}
                  onChange={(e) => setNewMerchant({...newMerchant, business_type: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                >
                  {businessTypes.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Telepon</label>
                <input
                  type="text"
                  value={newMerchant.store_phone}
                  onChange={(e) => setNewMerchant({...newMerchant, store_phone: e.target.value})}
                  placeholder="08xxxxxxxxxx"
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Alamat</label>
                <textarea
                  value={newMerchant.store_address}
                  onChange={(e) => setNewMerchant({...newMerchant, store_address: e.target.value})}
                  placeholder="Alamat toko..."
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="qris"
                  checked={newMerchant.qris_enabled}
                  onChange={(e) => setNewMerchant({...newMerchant, qris_enabled: e.target.checked})}
                  className="w-4 h-4"
                />
                <label htmlFor="qris" className="text-sm">Aktifkan QRIS</label>
              </div>
              <button
                onClick={handleCreateMerchant}
                className="w-full py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
              >
                Simpan Toko
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MerchantManager;
