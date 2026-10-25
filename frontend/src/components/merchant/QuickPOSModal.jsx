import { useState, useEffect } from 'react';
import { X, Plus, Minus, ShoppingCart, CreditCard, Banknote, Smartphone } from 'lucide-react';
import merchantApi from '../../services/merchantApi';
import { formatCurrency } from '../../utils/format';

const QuickPOSModal = ({ isOpen, onClose, merchant, onSaleComplete }) => {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [merchants, setMerchants] = useState([]);
  const [selectedMerchant, setSelectedMerchant] = useState(merchant || null);
  const [quickAmounts] = useState([5000, 10000, 20000, 50000, 100000]);

  useEffect(() => {
    if (isOpen) {
      loadMerchants();
    }
  }, [isOpen]);

  const loadMerchants = async () => {
    try {
      const data = await merchantApi.listMerchants();
      setMerchants(data || []);
      if (merchant) {
        setSelectedMerchant(merchant);
      } else if (data && data.length > 0) {
        setSelectedMerchant(data[0]);
      }
    } catch (err) {
      console.error('Failed to load merchants:', err);
    }
  };

  const handleQuickAmount = (value) => {
    setAmount(value.toString());
  };

  const handleInputChange = (e) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    setAmount(value);
  };

  const handleSubmit = async () => {
    if (!selectedMerchant || !amount || parseInt(amount) <= 0) {
      alert('Pilih toko dan masukkan jumlah yang valid');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await merchantApi.quickSale({
        merchant_id: selectedMerchant.id,
        amount: parseInt(amount),
        payment_method: paymentMethod,
        description: description || `Penjualan ${selectedMerchant.store_name}`,
      });

      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          setAmount('');
          setDescription('');
          if (onSaleComplete) onSaleComplete(result);
        }, 1500);
      }
    } catch (err) {
      console.error('Sale failed:', err);
      alert('Gagal mencatat penjualan');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-primary-600 text-white">
          <div className="flex items-center gap-2">
            <ShoppingCart size={20} />
            <span className="font-semibold">Kasir Cepat</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Merchant Selector */}
          {merchants.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Toko
              </label>
              <select
                value={selectedMerchant?.id || ''}
                onChange={(e) => {
                  const m = merchants.find(m => m.id === parseInt(e.target.value));
                  setSelectedMerchant(m);
                }}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              >
                <option value="">Pilih Toko</option>
                {merchants.map(m => (
                  <option key={m.id} value={m.id}>{m.store_name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Metode Bayar
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('CASH')}
                className={`flex flex-col items-center p-3 rounded-lg border-2 transition ${
                  paymentMethod === 'CASH'
                    ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/30 text-primary-600'
                    : 'border-gray-200 dark:border-gray-600'
                }`}
              >
                <Banknote size={24} />
                <span className="text-xs mt-1">Cash</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('QRIS')}
                className={`flex flex-col items-center p-3 rounded-lg border-2 transition ${
                  paymentMethod === 'QRIS'
                    ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/30 text-primary-600'
                    : 'border-gray-200 dark:border-gray-600'
                }`}
              >
                <Smartphone size={24} />
                <span className="text-xs mt-1">QRIS</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('EDC')}
                className={`flex flex-col items-center p-3 rounded-lg border-2 transition ${
                  paymentMethod === 'EDC'
                    ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/30 text-primary-600'
                    : 'border-gray-200 dark:border-gray-600'
                }`}
              >
                <CreditCard size={24} />
                <span className="text-xs mt-1">EDC</span>
              </button>
            </div>
          </div>

          {/* Quick Amount Buttons */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Jumlah Cepat
            </label>
            <div className="grid grid-cols-5 gap-2">
              {quickAmounts.map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => handleQuickAmount(val)}
                  className="px-2 py-2 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                >
                  {formatCurrency(val)}
                </button>
              ))}
            </div>
          </div>

          {/* Amount Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Jumlah (Rp)
            </label>
            <input
              type="text"
              value={amount ? parseInt(amount).toLocaleString('id-ID') : ''}
              onChange={handleInputChange}
              placeholder="0"
              className="w-full px-4 py-3 text-2xl font-bold text-center border-2 border-primary-200 dark:border-primary-800 rounded-lg dark:bg-gray-700"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Deskripsi (opsional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Contoh: 5 kopi hitam"
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            />
          </div>

          {/* Success Message */}
          {success && (
            <div className="p-4 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg text-center">
              ✓ Penjualan berhasil dicatat!
            </div>
          )}

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !amount || parseInt(amount) <= 0}
            className={`w-full py-4 rounded-lg font-bold text-lg transition ${
              isSubmitting || !amount || parseInt(amount) <= 0
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-primary-600 hover:bg-primary-700 text-white'
            }`}
          >
            {isSubmitting ? 'Menyimpan...' : 'Simpan Penjualan'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuickPOSModal;
