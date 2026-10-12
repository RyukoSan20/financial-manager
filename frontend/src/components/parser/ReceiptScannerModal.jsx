/**
 * Enhanced Receipt Scanner Modal
 * Features:
 * - Camera capture
 * - File upload
 * - Drag & drop
 * - Real-time OCR preview
 * - Multiple language support
 * - Auto-categorization
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { Modal, Button, Input, Select } from '../ui';
import { Camera, Upload, Loader2, AlertCircle, Check, Sparkles, X, RotateCcw, ZoomIn, FileImage, Smartphone, Monitor } from 'lucide-react';
import api from '../../services/api';
import { formatCurrency } from '../../utils/format';

export const ReceiptScannerModal = ({ isOpen, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [step, setStep] = useState('upload'); // upload, preview, edit, confirm
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [processingStatus, setProcessingStatus] = useState('');
  const [confidence, setConfidence] = useState(0);
  
  // Editable fields
  const [merchantName, setMerchantName] = useState('');
  const [amount, setAmount] = useState('');
  const [location, setLocation] = useState('');
  const [transactionDate, setTransactionDate] = useState('');
  const [rawText, setRawText] = useState('');
  
  // Image enhancement
  const [imageMode, setImageMode] = useState('auto'); // auto, document, receipt
  const [rotation, setRotation] = useState(0);
  
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [usingCamera, setUsingCamera] = useState(false);
  const [stream, setStream] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
    return () => {
      stopCamera();
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

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setUsingCamera(true);
    } catch (err) {
      console.error('Camera error:', err);
      setError('Tidak dapat mengakses kamera. Pastikan izin kamera diberikan.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setUsingCamera(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    
    const imageData = canvas.toDataURL('image/jpeg', 0.9);
    setPreview(imageData);
    stopCamera();
    setStep('preview');
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const processFile = async (file) => {
    // Validate file
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    if (!allowedTypes.includes(file.type)) {
      setError('Format tidak valid. Gunakan JPG, PNG, WebP, atau HEIC.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('File terlalu besar. Maksimal 10MB.');
      return;
    }

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
      await processFile(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const processReceipt = async () => {
    if (!preview) return;

    setLoading(true);
    setProcessingStatus('Mengupload gambar...');
    setError('');

    try {
      // Convert base64 to blob
      const response = await fetch(preview);
      const blob = await response.blob();
      const imageFile = new File([blob], 'receipt.jpg', { type: 'image/jpeg' });

      setProcessingStatus('Memproses OCR...');

      // Try backend OCR endpoint
      const token = localStorage.getItem('token') || localStorage.getItem('sb_token');
      const apiUrl = import.meta.env.VITE_API_URL?.replace(/\/api$/, '') || 'http://localhost:8000';
      
      const formData = new FormData();
      formData.append('file', imageFile);

      const uploadResponse = await fetch(`${apiUrl}/api/parser/receipt`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        body: formData,
      });

      if (uploadResponse.ok) {
        const data = await uploadResponse.json();
        setParsedData(data);
        setConfidence(data.confidence_score || 0.8);
        populateFields(data);
        setStep('edit');
      } else {
        // Fallback to local OCR
        setProcessingStatus('OCR lokal...');
        await localOCR();
      }
    } catch (err) {
      console.error('OCR Error:', err);
      setProcessingStatus('OCR lokal...');
      await localOCR();
    } finally {
      setLoading(false);
      setProcessingStatus('');
    }
  };

  // Local OCR fallback using Tesseract.js
  const localOCR = async () => {
    try {
      // Dynamic import Tesseract
      const Tesseract = await import('tesseract.js');
      
      setProcessingStatus('Melakukan OCR...');
      
      const result = await Tesseract.recognize(preview, 'eng+ind', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setProcessingStatus(`OCR: ${Math.round(m.progress * 100)}%`);
          }
        }
      });

      const text = result.data.text;
      setRawText(text);
      
      // Parse the extracted text
      const parsed = parseReceiptText(text);
      setParsedData(parsed);
      setConfidence(result.data.confidence / 100);
      populateFields(parsed);
      setStep('edit');
    } catch (err) {
      console.error('Local OCR Error:', err);
      setError('OCR gagal. Coba gunakan gambar yang lebih jelas.');
      setLoading(false);
    }
  };

  const parseReceiptText = (text) => {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    
    // Amount patterns
    const amountPatterns = [
      /total[:\s]*[Rr]p\.?\s*([\d.,]+)/i,
      /jumlah[:\s]*[Rr]p\.?\s*([\d.,]+)/i,
      /grand\s*total[:\s]*[Rr]p\.?\s*([\d.,]+)/i,
      /subtotal[:\s]*[Rr]p\.?\s*([\d.,]+)/i,
      /[Rr]p\.?\s*([\d.,]+)/,
    ];

    let amount = 0;
    for (const pattern of amountPatterns) {
      const match = text.match(pattern);
      if (match) {
        amount = parseFloat(match[1].replace(/[.,]/g, ''));
        if (amount > 0) break;
      }
    }

    // Date patterns
    const datePatterns = [
      /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/,
      /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/,
    ];

    let date = new Date().toISOString().split('T')[0];
    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        if (match[1].length === 4) {
          date = `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
        } else {
          date = `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
        }
        break;
      }
    }

    // Merchant name (usually first non-empty line or prominent text)
    let merchant = 'Unknown Merchant';
    const firstLines = lines.slice(0, 3);
    for (const line of firstLines) {
      if (line.length > 3 && !line.match(/^\d+$/) && !line.match(/^[Tt]oken/)) {
        merchant = line.substring(0, 50);
        break;
      }
    }

    // Location (look for address keywords)
    let location = '';
    for (const line of lines) {
      if (line.match(/jl\.|jalan|street|address|rt\.|rw\.|kota/i)) {
        location = line.substring(0, 100);
        break;
      }
    }

    return {
      merchant_name: merchant,
      amount: amount.toString(),
      date: date,
      location: location,
      confidence_score: 0.7,
      raw_text: text,
    };
  };

  const populateFields = (data) => {
    setMerchantName(data.merchant_name || '');
    setAmount(data.amount || '');
    setLocation(data.location || '');
    setTransactionDate(data.date || new Date().toISOString().split('T')[0]);
  };

  const handleReset = () => {
    setPreview(null);
    setParsedData(null);
    setStep('upload');
    setMerchantName('');
    setAmount('');
    setLocation('');
    setTransactionDate('');
    setRawText('');
    setError('');
    setConfidence(0);
  };

  const handleConfirm = async () => {
    if (!selectedAccount) {
      setError('Pilih akun terlebih dahulu');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError('Masukkan jumlah yang valid');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await api.transactions.create({
        amount: parseFloat(amount),
        type: 'expense',
        description: merchantName || 'Receipt Scan',
        date: transactionDate,
        account_id: parseInt(selectedAccount),
        category_id: selectedCategory ? parseInt(selectedCategory) : null,
        merchant_name: merchantName,
        location: location,
        raw_source_text: rawText,
        confidence_score: confidence,
        detection_type: 'receipt_ocr',
      });

      onSuccess?.();
      handleReset();
      onClose();
    } catch (err) {
      console.error('Save error:', err);
      setError('Gagal menyimpan: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const getConfidenceLabel = (score) => {
    if (score >= 0.8) return { text: 'Tinggi', color: 'text-green-600' };
    if (score >= 0.6) return { text: 'Sedang', color: 'text-yellow-600' };
    return { text: 'Rendah', color: 'text-red-600' };
  };

  const confInfo = getConfidenceLabel(confidence);

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => { handleReset(); onClose(); }}
      title="Receipt Scanner"
      size="lg"
    >
      {/* Step 1: Upload */}
      {step === 'upload' && (
        <div className="space-y-4">
          {/* Camera Option */}
          {usingCamera ? (
            <div className="relative">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full rounded-lg bg-black"
              />
              <canvas ref={canvasRef} className="hidden" />
              
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                <Button
                  variant="outline"
                  onClick={stopCamera}
                  className="bg-white/80"
                >
                  <X className="w-4 h-4 mr-2" /> Batal
                </Button>
                <Button
                  onClick={capturePhoto}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Camera className="w-4 h-4 mr-2" /> Capture
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Upload Options */}
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={startCamera}
                  className="flex flex-col items-center gap-2 p-6 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                >
                  <Smartphone className="w-8 h-8 text-gray-400" />
                  <span className="text-sm font-medium">Kamera</span>
                </button>
                
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center gap-2 p-6 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                >
                  <FileImage className="w-8 h-8 text-gray-400" />
                  <span className="text-sm font-medium">Upload File</span>
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />

              {/* Drop Zone */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center hover:border-blue-500 transition-colors"
              >
                <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600 dark:text-gray-400">
                  Atau drag & drop gambar receipt di sini
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  JPG, PNG, WebP, HEIC • Maksimal 10MB
                </p>
              </div>
            </>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}
        </div>
      )}

      {/* Step 2: Preview with OCR */}
      {step === 'preview' && (
        <div className="space-y-4">
          {/* Image Preview */}
          <div className="relative rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
            <img
              src={preview}
              alt="Receipt preview"
              className="w-full max-h-64 object-contain"
              style={{ transform: `rotate(${rotation}deg)` }}
            />
            
            {/* Controls */}
            <div className="absolute top-2 right-2 flex gap-2">
              <button
                onClick={() => setRotation(r => (r + 90) % 360)}
                className="p-2 bg-white/80 rounded-full hover:bg-white"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Processing Status */}
          {loading && (
            <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
              <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
              <span className="text-blue-700 dark:text-blue-300">{processingStatus}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleReset}
              className="flex-1"
            >
              Batal
            </Button>
            <Button
              onClick={processReceipt}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              Scan Receipt
            </Button>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}
        </div>
      )}

      {/* Step 3: Edit Parsed Data */}
      {step === 'edit' && (
        <div className="space-y-4">
          {/* Confidence Badge */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">OCR Confidence:</span>
            <span className={`text-sm font-medium ${confInfo.color}`}>
              {confInfo.text} ({Math.round(confidence * 100)}%)
            </span>
          </div>

          {/* Form */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Merchant / Toko
              </label>
              <input
                type="text"
                value={merchantName}
                onChange={(e) => setMerchantName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                           bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                placeholder="Nama merchant"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Jumlah (Rp)
              </label>
              <input
                type="text"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                           bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-medium text-lg"
                placeholder="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Lokasi
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                           bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                placeholder="Alamat (opsional)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tanggal
              </label>
              <input
                type="date"
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                           bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Akun
              </label>
              <select
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                           bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="">Pilih Akun</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Kategori
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                           bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="">Pilih Kategori (opsional)</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => setStep('preview')}
              className="flex-1"
            >
              Kembali
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={loading || !selectedAccount || !amount}
              className="flex-1 flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              Simpan
            </Button>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};

export default ReceiptScannerModal;
