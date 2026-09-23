import { useState, useRef } from 'react';
import { Modal, Button, Input } from '../ui';
import { Camera, Upload, Loader2, AlertCircle } from 'lucide-react';
import api from '../../services/api';
import { formatCurrency } from '../../utils/format';

export const ReceiptScannerModal = ({ isOpen, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [step, setStep] = useState('upload'); // upload, preview, confirm
  const [accounts, setAccounts] = useState([]);
  const [confirming, setConfirming] = useState(false);
  const fileInputRef = useRef(null);

  const loadAccounts = async () => {
    try {
      const response = await api.accounts.list();
      setAccounts(Array.isArray(response) ? response : []);
    } catch (err) {
      console.error('Failed to load accounts:', err);
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('Invalid file type. Please upload JPG, PNG, or WebP image.');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('File too large. Maximum size is 5MB.');
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target.result);
    };
    reader.readAsDataURL(file);

    // Load accounts
    await loadAccounts();
    setStep('preview');
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const input = fileInputRef.current;
      if (input) {
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        await handleFileSelect({ target: input });
      }
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleParseImage = async () => {
    if (!preview) return;

    setLoading(true);
    setError('');

    try {
      // Convert base64 to blob
      const response = await fetch(preview);
      const blob = await response.blob();
      const file = new File([blob], 'receipt.jpg', { type: 'image/jpeg' });

      // Call parser endpoint with FormData
      const formData = new FormData();
      formData.append('file', file);

      // Use direct fetch for FormData (api.request doesn't support FormData)
      const token = localStorage.getItem('token') || localStorage.getItem('sb_token');
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      
      const result = await fetch(`${apiUrl}/api/parser/parse-receipt`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        body: formData,
      }).then(r => r.json());

      if (result.status === 'requires_ocr' || result.detail?.includes('OCR')) {
        setError('OCR processing not configured. For receipt scanning, you can use the SMS/QRIS parser instead.');
        setLoading(false);
        return;
      }

      setParsedData(result);
      setStep('confirm');
    } catch (err) {
      console.error('Parse error:', err);
      setError('Failed to process image: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (accountId) => {
    if (!parsedData) return;

    setConfirming(true);
    setError('');

    try {
      await api.transactions.create({
        amount: parseFloat(parsedData.amount),
        type: 'expense', // Receipts are usually expenses
        description: parsedData.description || 'Pembelian',
        date: parsedData.date || new Date().toISOString().split('T')[0],
        account_id: accountId,
        merchant_name: parsedData.merchant_name,
        confidence_score: parsedData.confidence_score,
        detection_type: 'OCR_RECEIPT',
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
    setPreview(null);
    setParsedData(null);
    setError('');
    setStep('upload');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Scan Receipt"
      size="lg"
    >
      {step === 'upload' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Camera className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <p className="font-medium text-blue-900">Upload Receipt Image</p>
                <p className="text-sm text-blue-700 mt-1">
                  Take a photo or upload an image of your receipt. OCR will extract the transaction data.
                </p>
              </div>
            </div>
          </div>

          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-primary-400 hover:bg-gray-50 transition-colors"
          >
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="font-medium text-gray-700">Drop receipt image here</p>
            <p className="text-sm text-gray-500 mt-1">or click to browse</p>
            <p className="text-xs text-gray-400 mt-2">JPG, PNG, WebP (max 5MB)</p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileSelect}
            className="hidden"
          />

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="flex justify-end">
            <Button variant="secondary" onClick={handleClose}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {step === 'preview' && preview && (
        <div className="space-y-4">
          {/* Image preview */}
          <div className="relative">
            <img
              src={preview}
              alt="Receipt preview"
              className="w-full max-h-64 object-contain rounded-lg border"
            />
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="font-medium text-yellow-900">OCR Not Configured</p>
            <p className="text-sm text-yellow-700 mt-1">
              Server-side OCR requires Tesseract or cloud OCR API integration.
              For now, you can manually enter the data.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="flex justify-between">
            <Button variant="secondary" onClick={() => setStep('upload')}>
              Back
            </Button>
            <Button onClick={handleParseImage} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Process Image
            </Button>
          </div>
        </div>
      )}

      {step === 'confirm' && parsedData && (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="font-medium text-green-900">Receipt Processed!</p>
            <p className="text-sm text-green-700 mt-1">
              Transaction data extracted successfully
            </p>
          </div>

          {/* Parsed data preview */}
          <div className="border rounded-lg divide-y">
            <div className="p-3 flex justify-between">
              <span className="text-gray-500">Merchant</span>
              <span className="font-medium">{parsedData.merchant_name || 'Unknown'}</span>
            </div>
            <div className="p-3 flex justify-between">
              <span className="text-gray-500">Amount</span>
              <span className="font-medium text-red-600">
                -{formatCurrency(parsedData.amount)}
              </span>
            </div>
            <div className="p-3 flex justify-between">
              <span className="text-gray-500">Confidence</span>
              <span className="text-sm">
                {Math.round(parsedData.confidence_score * 100)}%
              </span>
            </div>
            <div className="p-3 flex justify-between">
              <span className="text-gray-500">Type</span>
              <span className="text-sm">Expense</span>
            </div>
          </div>

          {/* Account selector */}
          <Select
            label="Save to Account"
            options={accounts.map(a => ({ value: a.id, label: a.name }))}
            onChange={(e) => handleConfirm(parseInt(e.target.value))}
          />

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="flex justify-between">
            <Button variant="secondary" onClick={() => setStep('preview')}>
              Back
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default ReceiptScannerModal;
