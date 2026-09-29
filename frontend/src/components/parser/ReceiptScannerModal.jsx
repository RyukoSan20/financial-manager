import { useState, useRef, useEffect } from 'react';
import { Modal, Button, Input, Select } from '../ui';
import { Camera, Upload, Loader2, AlertCircle, Check, Sparkles } from 'lucide-react';
import api from '../../services/api';
import { formatCurrency } from '../../utils/format';

export const ReceiptScannerModal = ({ isOpen, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [step, setStep] = useState('upload'); // upload, preview, confirm
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [confirming, setConfirming] = useState(false);
  const fileInputRef = useRef(null);

  // Load data when modal opens
  useEffect(() => {
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
      if (accRes?.length > 0) {
        setSelectedAccount(accRes[0].id.toString());
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('Format tidak valid. Gunakan JPG, PNG, atau WebP.');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('File terlalu besar. Maksimal 10MB.');
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target.result);
      setStep('preview');
      setParsedData(null);
      setError('');
    };
    reader.readAsDataURL(file);
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

      // Get token
      const token = localStorage.getItem('token') || localStorage.getItem('sb_token');
      const apiUrl = import.meta.env.VITE_API_URL?.replace(/\/api$/, '') || 'https://financial-manager-production-a042.up.railway.app';
      
      // Retry logic for cold start
      let parseResponse;
      let lastError = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          parseResponse = await fetch(`${apiUrl}/api/parser/parse-receipt`, {
            method: 'POST',
            headers: token ? { 'Authorization': `Bearer ${token}` } : {},
            body: formData,
          });
          if (parseResponse.ok) break;
        } catch (err) {
          lastError = err;
          if (attempt < 3) {
            console.log(`Attempt ${attempt} failed, retrying in ${attempt * 2}s...`);
            await new Promise(r => setTimeout(r, attempt * 2000));
          }
        }
      }
      
      if (!parseResponse || !parseResponse.ok) {
        throw new Error(lastError?.message || 'OCR server tidak merespons. Coba beberapa saat lagi.');
      }
      
      const data = await parseResponse.json();
      
      if (!parseResponse.ok || data.error || data.detail) {
        throw new Error(data.detail || data.error || 'OCR gagal');
      }

      // Validate date format - check if already ISO YYYY-MM-DD
      const isValidIsoDate = (dateStr) => {
        if (!dateStr || typeof dateStr !== 'string') return false;
        const regex = /^\d{4}-\d{2}-\d{2}$/;
        if (!regex.test(dateStr)) return false;
        const d = new Date(dateStr);
        return !isNaN(d.getTime());
      };
      
      // Get today's date in local format without timezone shift
      const getTodayLocalISO = () => {
        const today = new Date();
        const y = today.getFullYear();
        const m = String(today.getMonth() + 1).padStart(2, '0');
        const d = String(today.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      };
      
      const parsedDate = isValidIsoDate(data.date) ? data.date : getTodayLocalISO();
      
      console.log('OCR Result:', data);
      
      // Set parsed data with AI-suggested category
      const aiCategory = mapCategoryHint(data.category_hint);
      if (aiCategory && !selectedCategory) {
        setSelectedCategory(aiCategory);
      }
      
      setParsedData({
        ...data,
        date: parsedDate
      });
      setStep('confirm');
    } catch (err) {
      console.error('OCR Error:', err);
      // More detailed error message
      let errorMsg = 'Failed to process image';
      if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
        errorMsg = 'Connection error: Cannot reach OCR server. Please check your internet connection.';
      } else {
        errorMsg = 'Failed to process image: ' + (err.message || 'Unknown error');
      }
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Map AI category hint to actual category ID
  const mapCategoryHint = (hint) => {
    const mapping = {
      'food_beverages': categories.find(c => c.name?.toLowerCase().includes('makan') || c.name?.toLowerCase().includes('food'))?.id,
      'transport': categories.find(c => c.name?.toLowerCase().includes('transport') || c.name?.toLowerCase().includes('bensin'))?.id,
      'shopping': categories.find(c => c.name?.toLowerCase().includes('belanja') || c.name?.toLowerCase().includes('shop'))?.id,
      'bills_utilities': categories.find(c => c.name?.toLowerCase().includes('tagihan') || c.name?.toLowerCase().includes('listrik'))?.id,
      'entertainment': categories.find(c => c.name?.toLowerCase().includes('hiburan') || c.name?.toLowerCase().includes('game'))?.id,
      'healthcare': categories.find(c => c.name?.toLowerCase().includes('kesehatan') || c.name?.toLowerCase().includes('obat'))?.id,
    };
    return mapping[hint] || null;
  };

  const handleConfirm = async () => {
    if (!parsedData) return;
    
    if (!selectedAccount) {
      setError('Pilih akun terlebih dahulu');
      return;
    }

    setConfirming(true);
    setError('');

    try {
      const amount = parseFloat(parsedData.amount) || 0;
      
      await api.transactions.create({
        amount: amount,
        type: parsedData.suggested_type === 'income' ? 'income' : 'expense',
        description: parsedData.description || 'Pembelian',
        date: parsedData.date ? parsedData.date.split('T')[0] : new Date().toISOString().split('T')[0],
        account_id: parseInt(selectedAccount),
        category_id: selectedCategory ? parseInt(selectedCategory) : null,
        merchant_name: parsedData.merchant_name,
        confidence_score: parsedData.confidence_score,
        detection_type: 'OCR_RECEIPT',
        latitude: parsedData.latitude,
        longitude: parsedData.longitude,
        merchant_address: parsedData.address,
        notes: `Method: ${parsedData.payment_method || 'Not detected'}\n${parsedData.address ? 'Address: ' + parsedData.address : ''}${parsedData.items_count > 0 ? '\nItems: ' + parsedData.items_count + ' item(s)' : ''}`,
      });

      onSuccess?.();
      handleClose();
    } catch (err) {
      console.error('Save error:', err);
      setError('Failed to save: ' + (err.message || 'Unknown error'));
    } finally {
      setConfirming(false);
    }
  };

  const handleClose = () => {
    setPreview(null);
    setParsedData(null);
    setError('');
    setStep('upload');
    setSelectedCategory('');
    onClose();
  };

  const getCategoryLabel = (hint) => {
    const labels = {
      'food_beverages': '🍔 Makanan & Minuman',
      'transport': '🚗 Transportasi',
      'shopping': '🛒 Belanja',
      'bills_utilities': '📄 Tagihan',
      'entertainment': '🎮 Hiburan',
      'healthcare': '💊 Kesehatan',
      'other': '📦 Lainnya',
    };
    return labels[hint] || '📦 Lainnya';
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Receipt Scanner"
      size="lg"
    >
      {/* Step 1: Upload */}
      {step === 'upload' && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="w-6 h-6 text-purple-600 mt-0.5" />
              <div>
                <p className="font-medium text-purple-900">Receipt Scanner</p>
                <p className="text-sm text-purple-700 mt-1">
                  Take a photo or upload a receipt. AI will automatically extract data and suggest a category.
                </p>
              </div>
            </div>
          </div>

          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-purple-400 hover:bg-purple-50/50 transition-all"
          >
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Upload className="w-8 h-8 text-purple-600" />
            </div>
            <p className="font-medium text-gray-700">Drop gambar struk di sini</p>
            <p className="text-sm text-gray-500 mt-1">atau klik untuk browse</p>
            <p className="text-xs text-gray-400 mt-2">JPG, PNG, WebP (maks 10MB)</p>
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
              Batal
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Preview & Process */}
      {step === 'preview' && preview && (
        <div className="space-y-4">
          {/* Image preview */}
          <div className="relative">
            <img
              src={preview}
              alt="Receipt preview"
              className="w-full max-h-64 object-contain rounded-xl border"
            />
            {loading && (
              <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center">
                <div className="text-center text-white">
                  <Loader2 className="w-10 h-10 animate-spin mx-auto mb-2" />
                  <p className="font-medium">Memproses OCR...</p>
                </div>
              </div>
            )}
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              <p className="font-medium text-purple-900">AI will extract:</p>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-purple-700">
              <span>• Merchant Name</span>
              <span>• Total Amount</span>
              <span>• Date</span>
              <span>• Payment Method</span>
              <span>• Category Suggestion</span>
              <span>• Store Location</span>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="flex justify-between">
            <Button variant="secondary" onClick={() => setStep('upload')}>
              Kembali
            </Button>
            <Button onClick={handleParseImage} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Camera className="w-4 h-4 mr-2" />}
              {loading ? 'Processing...' : 'Process Receipt'}
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Confirm */}
      {step === 'confirm' && parsedData && (
        <div className="space-y-4">
          {/* Success indicator */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                <Check className="w-4 h-4 text-white" />
              </div>
              <p className="font-medium text-green-900">Extraction Success!</p>
            </div>
          </div>

          {/* Parsed data preview */}
          <div className="border rounded-xl divide-y">
            <div className="p-4 flex items-center justify-between">
              <span className="text-gray-500">Merchant</span>
              <span className="font-medium">{parsedData.merchant_name || 'Not detected'}</span>
            </div>
            <div className="p-4 flex items-center justify-between">
              <span className="text-gray-500">Total</span>
              <span className="font-bold text-xl text-red-600">
                -{formatCurrency(parseFloat(parsedData.amount) || 0)}
              </span>
            </div>
            <div className="p-4 flex items-center justify-between">
              <span className="text-gray-500">Date</span>
              <span className="text-sm">
                {parsedData.date ? new Date(parsedData.date).toLocaleDateString('id-ID', { 
                  day: 'numeric', month: 'long', year: 'numeric' 
                }) : 'Today'}
              </span>
            </div>
            <div className="p-4 flex items-center justify-between">
              <span className="text-gray-500">Method</span>
              <span className="text-sm">{parsedData.payment_method || 'Not detected'}</span>
            </div>
            <div className="p-4 flex items-center justify-between">
              <span className="text-gray-500">Accuracy</span>
              <span className="text-sm font-medium">
                {Math.round(parsedData.confidence_score || 0)}%
              </span>
            </div>
            {parsedData.category_hint && (
              <div className="p-4 flex items-center justify-between bg-purple-50">
                <span className="text-gray-500">AI Suggestion</span>
                <span className="text-sm font-medium text-purple-700">
                  {getCategoryLabel(parsedData.category_hint)}
                </span>
              </div>
            )}
            
            {/* Items count */}
            {parsedData.items_count > 0 && (
              <div className="p-4 flex items-center justify-between bg-blue-50">
                <span className="text-gray-500">Items</span>
                <span className="text-sm font-medium text-blue-700">
                  {parsedData.items_count} item(s)
                </span>
              </div>
            )}
            
            {/* Location from merchant */}
            {parsedData.address && (
              <div className="p-4 flex items-center justify-between bg-green-50">
                <span className="text-gray-500">Lokasi Merchant</span>
                <span className="text-sm font-medium text-green-700">
                  📍 {parsedData.address}
                </span>
              </div>
            )}
          </div>

          {/* Account selector */}
          <Select
            label="Save to Account"
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(e.target.value)}
            options={accounts.map(a => ({ value: a.id, label: a.name }))}
          />

          {/* Category selector with AI suggestion */}
          <div>
            <Select
              label="Kategori (AI suggestion tersedia)"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              options={[
                { value: '', label: parsedData.category_hint ? `${getCategoryLabel(parsedData.category_hint)} (disarankan)` : 'Pilih kategori...' },
                ...categories.map(c => ({ value: c.id, label: c.name }))
              ]}
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="flex justify-between pt-2">
            <Button variant="secondary" onClick={() => setStep('preview')}>
              Kembali
            </Button>
            <Button onClick={handleConfirm} disabled={confirming || !selectedAccount}>
              {confirming ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
              Save Transaction
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default ReceiptScannerModal;
