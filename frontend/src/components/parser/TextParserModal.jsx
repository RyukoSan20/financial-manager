import { useState, useEffect } from 'react';
import { Modal, Button, Input, Select } from '../ui';
import { Camera, FileText, Loader2, Check, Sparkles, AlertCircle } from 'lucide-react';
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
  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    try {
      const [accRes, catRes] = await Promise.all([
        api.accounts.list(),
        api.categories.list(),
      ]);
      setAccounts(Array.isArray(accRes) ? accRes : []);
      setCategories(Array.isArray(catRes) ? catRes : []);
    } catch (err) {
      console.error('Failed to load data:', err);
    }
  };

  const handleParse = async () => {
    if (!rawText.trim()) {
      setError('Masukkan teks SMS atau QRIS terlebih dahulu');
      return;
    }

    if (rawText.trim().length < 10) {
      setError('Teks terlalu pendek. Minimal 10 karakter.');
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
        setError('Tidak ada transaksi terdeteksi. Coba format SMS yang berbeda.');
        return;
      }

      setResults(parsed);
      setSelectedResult({
        ...parsed[0],
        account_id: parsed[0].account_id || accounts[0]?.id || ''
      });
      setStep('preview');
    } catch (err) {
      console.error('Parse error:', err);
      setError('Gagal parse: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!selectedResult) {
      setError('Pilih transaksi terlebih dahulu');
      return;
    }
    
    if (!selectedResult.account_id) {
      setError('Pilih akun terlebih dahulu');
      return;
    }

    setConfirming(true);
    setError('');

    try {
      const amount = parseFloat(selectedResult.amount) || 0;
      
      await api.transactions.create({
        amount: amount,
        type: selectedResult.suggested_type === 'income' ? 'income' : 'expense',
        description: selectedResult.description || selectedResult.merchant_name || 'Parsed Transaction',
        date: selectedResult.date ? selectedResult.date.split('T')[0] : new Date().toISOString().split('T')[0],
        account_id: parseInt(selectedResult.account_id),
        category_id: selectedResult.category_id || null,
        merchant_name: selectedResult.merchant_name,
        raw_source_text: rawText,
        confidence_score: selectedResult.confidence_score,
        detection_type: selectedResult.detection_type,
        latitude: selectedResult.latitude,
        longitude: selectedResult.longitude,
      });

      onSuccess?.();
      handleClose();
    } catch (err) {
      console.error('Confirm error:', err);
      setError('Gagal menyimpan: ' + (err.message || 'Unknown error'));
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
    return type === 'CREDIT' || type === 'income' ? 'Pemasukan' : 'Pengeluaran';
  };

  const getTypeColor = (type) => {
    return type === 'CREDIT' || type === 'income' ? 'text-green-600' : 'text-red-600';
  };

  const getTypeIcon = (type) => {
    return type === 'CREDIT' || type === 'income' ? '+' : '-';
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Parse SMS / QRIS"
      size="lg"
    >
      {/* Step 1: Input */}
      {step === 'input' && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <FileText className="w-6 h-6 text-blue-600 mt-0.5" />
              <div>
                <p className="font-medium text-blue-900">Parse SMS atau QRIS</p>
                <p className="text-sm text-blue-700 mt-1">
                  Tempel teks notifikasi bank, e-wallet, atau konfirmasi QRIS untuk di-parse otomatis.
                </p>
              </div>
            </div>
          </div>

          <div>
            <textarea
              value={rawText}
              onChange={(e) => {
                setRawText(e.target.value);
                setError('');
              }}
              placeholder={`Tempel teks di sini...\n\nContoh SMS BCA:\nPEMBAYARAN GOJEK 15/09/26 17:30 ke GOPAY-8612 Sejumlah Rp50.000.\n\nContoh QRIS:\nQRIS Payment di WARKOP MAMA Sejumlah Rp25.000.`}
              className="w-full h-48 p-4 border border-gray-200 rounded-xl font-mono text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
            <p className="text-xs text-gray-400 mt-1 text-right">
              {rawText.length} karakter
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={handleClose}>
              Batal
            </Button>
            <Button onClick={handleParse} disabled={loading || !rawText.trim()}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
              {loading ? 'Parsing...' : 'Parse Teks'}
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Preview Results */}
      {step === 'preview' && results.length > 0 && (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                <Check className="w-4 h-4 text-white" />
              </div>
              <p className="font-medium text-green-900">
                Ditemukan {results.length} transaksi
              </p>
            </div>
          </div>

          {/* Results list */}
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {results.map((result, index) => (
              <div
                key={index}
                onClick={() => setSelectedResult({ ...result, account_id: selectedResult?.account_id || accounts[0]?.id || '' })}
                className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${
                  selectedResult === result || selectedResult?.amount === result.amount
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-lg font-bold ${getTypeColor(result.transaction_type)}`}>
                        {getTypeIcon(result.transaction_type)}
                      </span>
                      <p className="font-medium">
                        {result.merchant_name || result.description || 'Unknown'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                      <span className="px-2 py-0.5 bg-gray-100 rounded-full">
                        {result.detection_type}
                      </span>
                      <span>{result.account_source || 'Bank'}</span>
                      {result.confidence_score && (
                        <span className="text-blue-600">
                          {Math.round(result.confidence_score * 100)}% match
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold text-lg ${getTypeColor(result.transaction_type)}`}>
                      {getTypeIcon(result.transaction_type)}{formatCurrency(parseFloat(result.amount) || 0)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Account selector */}
          <div>
            <Select
              label="Simpan ke Akun"
              value={selectedResult?.account_id || ''}
              onChange={(e) => setSelectedResult({ ...selectedResult, account_id: e.target.value })}
              options={accounts.map(a => ({ value: a.id, label: a.name }))}
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="flex justify-between">
            <Button variant="secondary" onClick={() => setStep('input')}>
              Kembali
            </Button>
            <Button 
              onClick={handleConfirm} 
              disabled={confirming || !selectedResult?.account_id}
            >
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
