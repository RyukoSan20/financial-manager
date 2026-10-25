import { useState } from 'react';
import { X, CheckCircle, AlertCircle } from 'lucide-react';
import merchantApi from '../../services/merchantApi';
import { formatCurrency } from '../../utils/format';
import { useTranslation } from '../../i18n';
import { batch2 } from '../../i18n/keys_batch2';

const DailySettlementModal = ({ isOpen, onClose, merchant, onComplete }) => {
  const { language } = useTranslation();
  const K = batch2[language]?.merchant?.daily || batch2.id.merchant.daily;
  const locale = language === 'ja' ? 'ja-JP' : language === 'en' ? 'en-US' : 'id-ID';

  const [transferAmount, setTransferAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const handleSubmit = async () => {
    if (!merchant?.id) return;

    setIsSubmitting(true);
    try {
      const data = await merchantApi.createSettlement(
        merchant.id,
        parseInt(transferAmount) || 0,
        notes
      );
      setResult(data);
      
      setTimeout(() => {
        if (onComplete) onComplete(data);
        onClose();
      }, 2000);
    } catch (err) {
      console.error('Settlement failed:', err);
      alert(K.error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-green-600 text-white">
          <div className="flex items-center gap-2">
            <CheckCircle size={20} />
            <span className="font-semibold">{K.title}</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {result ? (
            // Success Result
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <CheckCircle size={64} className="text-green-500" />
              </div>
              <h3 className="text-xl font-bold">{K.done}</h3>
              <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span>{K.total_sales}</span>
                  <span className="font-bold">{formatCurrency(result.total_sales)}</span>
                </div>
                <div className="flex justify-between text-green-600">
                  <span>{K.qris}</span>
                  <span>{formatCurrency(result.total_qris)}</span>
                </div>
                <div className="flex justify-between text-primary-600">
                  <span>{K.cash}</span>
                  <span>{formatCurrency(result.total_cash)}</span>
                </div>
                <div className="border-t pt-2 flex justify-between">
                  <span>{K.transactions}</span>
                  <span className="font-bold">{result.total_transactions}</span>
                </div>
              </div>
            </div>
          ) : (
            // Form
            <>
              <div className="text-center">
                <p className="text-gray-600 dark:text-gray-400">
                  {merchant?.store_name}
                </p>
                <p className="text-3xl font-bold mt-2">
                  {new Date().toLocaleDateString(locale, {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>

              {/* Transfer Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {K.transfer_label}
                </label>
                <input
                  type="text"
                  value={transferAmount ? parseInt(transferAmount).toLocaleString(locale) : ''}
                  onChange={(e) => setTransferAmount(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="0"
                  className="w-full px-4 py-3 text-xl font-bold text-center border-2 border-green-200 dark:border-green-800 rounded-lg dark:bg-gray-700"
                />
                <p className="text-sm text-gray-500 mt-1">
                  {K.transfer_hint}
                </p>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {K.notes_label}
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={K.notes_placeholder}
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                />
              </div>

              {/* Warning */}
              <div className="flex items-start gap-2 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg">
                <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
                <p className="text-sm">
                  {K.lock_warning}
                </p>
              </div>

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className={`w-full py-4 rounded-lg font-bold text-lg transition ${
                  isSubmitting
                    ? 'bg-gray-300 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                {isSubmitting ? K.processing : K.confirm}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DailySettlementModal;
