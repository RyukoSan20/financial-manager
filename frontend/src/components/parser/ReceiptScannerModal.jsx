import { useState, useRef, useEffect, useCallback } from 'react';
import { Modal, Button, Input, Select } from '../ui';
import { Camera, Upload, Loader2, AlertCircle, Check, Sparkles, X } from 'lucide-react';
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
  
  // Editable fields for user modification
  const [merchantName, setMerchantName] = useState('');
  const [amount, setAmount] = useState('');
  const [location, setLocation] = useState('');
  const [transactionDate, setTransactionDate] = useState('');
  
  // Background processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [processingComplete, setProcessingComplete] = useState(false);
  
  const fileInputRef = useRef(null);
  const pollIntervalRef = useRef(null);

  // Load data when modal opens
  useEffect(() => {
    if (isOpen) {
      loadData();
    }
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
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
      setProcessingComplete(false);
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

  // Start background processing with new scan-jobs API
  const startBackgroundProcessing = async () => {
    if (!preview) return;

    setIsProcessing(true);
    setError('');

    try {
      // Convert base64 to blob
      const response = await fetch(preview);
      const blob = await response.blob();
      const file = new File([blob], 'receipt.jpg', { type: 'image/jpeg' });

      // Call new scan-jobs upload endpoint
      const token = localStorage.getItem('token') || localStorage.getItem('sb_token');
      const apiUrl = import.meta.env.VITE_API_URL?.replace(/\/api$/, '') || 'https://financial-manager-production-26f7.up.railway.app';
      
      const formData = new FormData();
      formData.append('file', file);

      const uploadResponse = await fetch(`${apiUrl}/api/scan-jobs/upload`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error('Upload gagal');
      }

      const jobData = await uploadResponse.json();
      setJobId(jobData.job_id);
      
      // Start polling for job status
      pollJobStatus(jobData.job_id);
      
      // Show preview but allow closing - user will be notified when done
      setStep('preview');
      
    } catch (err) {
      console.error('Upload Error:', err);
      setError('Gagal upload: ' + (err.message || 'Unknown error'));
      setIsProcessing(false);
    }
  };

  // Poll job status
  const pollJobStatus = useCallback(async (id) => {
    const token = localStorage.getItem('token') || localStorage.getItem('sb_token');
    const apiUrl = import.meta.env.VITE_API_URL?.replace(/\/api$/, '') || 'https://financial-manager-production-26f7.up.railway.app';
    
    pollIntervalRef.current = setInterval(async () => {
      try {
        const response = await fetch(`${apiUrl}/api/scan-jobs/${id}`, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        });
        
        if (!response.ok) {
          clearInterval(pollIntervalRef.current);
          return;
        }
        
        const data = await response.json();
        
        if (data.status === 'completed') {
          clearInterval(pollIntervalRef.current);
          handleJobComplete(data);
        } else if (data.status === 'failed') {
          clearInterval(pollIntervalRef.current);
          setIsProcessing(false);
          setError(data.error_message || 'Processing failed');
        }
      } catch (err) {
        console.error('Poll error:', err);
      }
    }, 3000); // Poll every 3 seconds
  }, []);

  // Handle job completion
  const handleJobComplete = (jobData) => {
    setIsProcessing(false);
    setProcessingComplete(true);
    
    if (jobData.results?.gemini_parsed) {
      const parsed = jobData.results.gemini_parsed;
      
      // Set editable fields
      setMerchantName(parsed.merchant_name || '');
      setLocation(parsed.address || '');
      setAmount(parsed.total_amount?.toString() || parsed.total_amount?.toString() || '');
      setTransactionDate(parsed.receipt_date || new Date().toISOString().split('T')[0]);
      
      setParsedData({
        ...parsed,
        job_id: jobData.job_id,
      });
      setStep('confirm');
      
      // Trigger success callback for navbar notification
      if (onSuccess) {
        onSuccess({ type: 'scan_complete', job_id: jobData.job_id });
      }
    }
  };

  // Original OCR parse (fallback)
  const handleParseImage = async () => {
    if (!preview) return;

    setLoading(true);
    setError('');

    try {
      const response = await fetch(preview);
      const blob = await response.blob();
      const file = new File([blob], 'receipt.jpg', { type: 'image/jpeg' });

      const formData = new FormData();
      formData.append('file', file);

      const token = localStorage.getItem('token') || localStorage.getItem('sb_token');
      const apiUrl = import.meta.env.VITE_API_URL?.replace(/\/api$/, '') || 'https://financial-manager-production-26f7.up.railway.app';
      
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

      // Validate date
      const isValidIsoDate = (dateStr) => {
        if (!dateStr || typeof dateStr !== 'string') return false;
        const regex = /^\d{4}-\d{2}-\d{2}$/;
        if (!regex.test(dateStr)) return false;
        const d = new Date(dateStr);
        return !isNaN(d.getTime());
      };
      
      const getTodayLocalISO = () => {
        const today = new Date();
        const y = today.getFullYear();
        const m = String(today.getMonth() + 1).padStart(2, '0');
        const d = String(today.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      };
      
      const parsedDate = isValidIsoDate(data.date) ? data.date : getTodayLocalISO();

      // Set editable fields
      setMerchantName(data.merchant_name || '');
      setLocation(data.address || '');
      setAmount(data.amount?.toString() || '');
      setTransactionDate(parsedDate);

      // AI category
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
      let errorMsg = 'Failed to process image';
      if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
        errorMsg = 'Connection error: Cannot reach OCR server.';
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
      // Use editable amount
      const finalAmount = parseFloat(amount) || parseFloat(parsedData.amount) || 0;
      
      await api.transactions.create({
        amount: finalAmount,
        type: parsedData.suggested_type === 'income' ? 'income' : 'expense',
        description: merchantName || parsedData.description || 'Pembelian',
        date: transactionDate || new Date().toISOString().split('T')[0],
        account_id: parseInt(selectedAccount),
        category_id: selectedCategory ? parseInt(selectedCategory) : null,
        merchant_name: merchantName || parsedData.merchant_name,
        confidence_score: parsedData.confidence_score || parsedData.gemini_parsed?.confidence || 0,
        detection_type: 'OCR_RECEIPT',
        receipt_scan_id: parsedData.receipt_scan_id || parsedData.job_id || null,
        latitude: parsedData.latitude,
        longitude: parsedData.longitude,
        merchant_address: location || parsedData.address,
        notes: `Method: ${parsedData.payment_method || 'Not detected'}
${location ? 'Location: ' + location : ''}
${parsedData.items_count > 0 ? 'Items: ' + parsedData.items_count + ' item(s)' : ''}`,
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
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
    setPreview(null);
    setParsedData(null);
    setError('');
    setStep('upload');
    setSelectedCategory('');
    setMerchantName('');
    setAmount('');
    setLocation('');
    setTransactionDate('');
    setIsProcessing(false);
    setProcessingComplete(false);
    setJobId(null);
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
      closeable={!loading && !isProcessing} // Allow close unless processing
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
                  Take a photo or upload a receipt. AI will automatically extract data.
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
            {isProcessing && (
              <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center">
                <div className="text-center text-white">
                  <Loader2 className="w-10 h-10 animate-spin mx-auto mb-2" />
                  <p className="font-medium">Memproses di background...</p>
                  <p className="text-sm opacity-80 mt-1">Form bisa ditutup, notifikasi muncul saat selesai</p>
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

          {/* Processing indicator */}
          {isProcessing && jobId && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-700">
                Job ID: {jobId.substring(0, 8)}... | Processing in background...
              </p>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="flex justify-between">
            <Button variant="secondary" onClick={() => setStep('upload')} disabled={isProcessing}>
              Kembali
            </Button>
            <Button onClick={startBackgroundProcessing} disabled={isProcessing}>
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Processing...
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4 mr-2" />
                  Start Background Scan
                </>
              )}
            </Button>
          </div>
          
          {/* Option to close while processing */}
          {isProcessing && (
            <div className="text-center">
              <Button variant="ghost" size="sm" onClick={handleClose}>
                Tutup form (notifikasi muncul saat selesai)
              </Button>
            </div>
          )}
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
              <p className="font-medium text-green-900">Extraction Complete!</p>
            </div>
            <p className="text-sm text-green-700 mt-1">
              Data berhasil diekstrak. Edit jika perlu, lalu simpan.
            </p>
          </div>

          {/* Editable fields */}
          <div className="border rounded-xl divide-y">
            {/* Merchant Name - EDITABLE */}
            <div className="p-4">
              <label className="text-sm text-gray-500 mb-1 block">Merchant Name</label>
              <Input
                value={merchantName}
                onChange={(e) => setMerchantName(e.target.value)}
                placeholder="Nama merchant/toko"
                className="font-medium"
              />
            </div>
            
            {/* Amount - EDITABLE */}
            <div className="p-4">
              <label className="text-sm text-gray-500 mb-1 block">Total Amount (Rp)</label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="font-bold text-xl"
              />
            </div>
            
            {/* Date - EDITABLE */}
            <div className="p-4">
              <label className="text-sm text-gray-500 mb-1 block">Date</label>
              <Input
                type="date"
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
              />
            </div>
            
            {/* Location - EDITABLE */}
            <div className="p-4">
              <label className="text-sm text-gray-500 mb-1 block">Location</label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Alamat merchant (opsional)"
              />
            </div>
            
            {/* Payment Method - read only */}
            <div className="p-4 flex items-center justify-between">
              <span className="text-gray-500">Method</span>
              <span className="text-sm">{parsedData.payment_method || 'Not detected'}</span>
            </div>
            
            {/* Accuracy - read only */}
            <div className="p-4 flex items-center justify-between">
              <span className="text-gray-500">Accuracy</span>
              <span className="text-sm font-medium">
                {Math.round(parsedData.confidence_score || parsedData.gemini_parsed?.confidence || 0)}%
              </span>
            </div>
            
            {/* Category hint - read only */}
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
              label="Kategori"
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
