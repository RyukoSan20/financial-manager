import { useState } from 'react';
import { Modal, Button, Input, Select } from '../ui';
import { Camera, FileText, Loader2, Check } from 'lucide-react';
import api from '../../services/api';
import { formatCurrency } from '../../utils/format';

export const TextParserModal = ({ isOpen, onClose, onSuccess }) => {
  const [rawText, setRawText] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');
  const [selectedResult, setSelectedResult] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [step, setStep] = useState('input'); // input, preview, confirm

  // Load accounts and categories on open
  useState(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    try {
      const [accRes, catRes] = await Promise.all([
        api.accounts.list(),
        api.categories.list('expense'),
      ]);
      setAccounts(Array.isArray(accRes) ? accRes : []);
      setCategories(Array.isArray(catRes) ? catRes : []);
    } catch (err) {
      console.error('Failed to load data:', err);
    }
  };

  const handleParse = async () => {
    if (!rawText.trim()) {
      setError('Please enter SMS or text to parse');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await api.request('/parser/parse-text', {
        method: 'POST',
        body: JSON.stringify({ raw_text: rawText }),
      });
      const parsed = Array.isArray(response) ? response : [];
      
      if (parsed.length === 0) {
        setError('No transactions detected. Try a different format.');
        return;
      }

      setResults(parsed);
      setSelectedResult(parsed[0]);
      setStep('preview');
    } catch (err) {
      console.error('Parse error:', err);
      setError('Failed to parse text: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!selectedResult || !selectedResult.account_id) {
      setError('Please select an account');
      return;
    }

    setConfirming(true);
    setError('');

    try {
      await api.transactions.create({
        amount: parseFloat(selectedResult.amount),
        type: selectedResult.suggested_type === 'income' ? 'income' : 'expense',
        description: selectedResult.description || selectedResult.merchant_name || 'Parsed Transaction',
        date: selectedResult.date || new Date().toISOString().split('T')[0],
        account_id: parseInt(selectedResult.account_id),
        category_id: selectedResult.category_id || null,
        merchant_name: selectedResult.merchant_name,
        raw_source_text: rawText,
        confidence_score: selectedResult.confidence_score,
        detection_type: selectedResult.detection_type,
      });

      onSuccess?.();
      handleClose();
    } catch (err) {
      console.error('Confirm error:', err);
      setError('Failed to save transaction: ' + (err.message || 'Unknown error'));
    } finally {
      setConfirming(false);
    }
  };

  const handleClose = () => {
    setRawText('');
    setResults([]);
    setSelectedResult(null);
    setError('');
    setStep('input');
    onClose();
  };

  const getTypeLabel = (type) => {
    return type === 'CREDIT' ? 'Pemasukan' : 'Pengeluaran';
  };

  const getTypeColor = (type) => {
    return type === 'CREDIT' ? 'text-green-600' : 'text-red-600';
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Parse SMS / QRIS Text"
      size="lg"
    >
      {step === 'input' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <p className="font-medium text-blue-900">Paste SMS or QRIS text</p>
                <p className="text-sm text-blue-700 mt-1">
                  Copy the text from your bank SMS, e-wallet notification, or QRIS payment confirmation.
                </p>
              </div>
            </div>
          </div>

          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder={`Contoh SMS BCA:\nPEMBAYARAN GOJEK 15/09/26 17:30 ke GOPAY-8612 Sejumlah Rp50.000.\n\nContoh QRIS:\nQRIS Payment di WARKOP MAMA Sejumlah Rp25.000.`}
            className="w-full h-48 p-3 border border-gray-300 rounded-lg font-mono text-sm resize-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handleParse} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Parse Text
            </Button>
          </div>
        </div>
      )}

      {step === 'preview' && results.length > 0 && (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="font-medium text-green-900">
              Ditemukan {results.length} transaksi
            </p>
            <p className="text-sm text-green-700 mt-1">
              Pilih transaksi yang ingin disimpan
            </p>
          </div>

          {/* Results list */}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {results.map((result, index) => (
              <div
                key={index}
                onClick={() => setSelectedResult({ ...result, account_id: selectedResult?.account_id })}
                className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                  selectedResult === result
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">
                      {result.merchant_name || result.description || 'Unknown Merchant'}
                    </p>
                    <p className="text-sm text-gray-500">
                      {result.detection_type} • {result.account_source || 'Bank'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${getTypeColor(result.transaction_type)}`}>
                      {result.transaction_type === 'CREDIT' ? '+' : '-'}
                      {formatCurrency(result.amount)}
                    </p>
                    <p className="text-xs text-gray-500">
                      Confidence: {Math.round(result.confidence_score * 100)}%
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Account selector */}
          {selectedResult && (
            <div className="border-t pt-4">
              <Select
                label="Simpan ke Akun"
                value={selectedResult.account_id || ''}
                onChange={(e) => setSelectedResult({ ...selectedResult, account_id: e.target.value })}
                options={accounts.map(a => ({ value: a.id, label: a.name }))}
              />
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="flex justify-between">
            <Button variant="secondary" onClick={() => setStep('input')}>
              Back
            </Button>
            <Button onClick={handleConfirm} disabled={confirming || !selectedResult?.account_id}>
              {confirming ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
              Simpan Transaksi
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default TextParserModal;
