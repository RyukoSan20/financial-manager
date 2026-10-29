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
import { Camera, Upload, Loader2, AlertCircle, Check, Sparkles, X, RotateCcw, ZoomIn, FileImage, Smartphone, Monitor, Bell } from 'lucide-react';
import api from '../../services/api';
import { apiUrl as buildApiUrl } from '../../config/url';
import { formatCurrency } from '../../utils/format';
import { ScanDiagnostics, LearnFromScan } from './ScanDiagnostics';
import { ReceiptBreakdown } from './ReceiptBreakdown';
import { scanManager, dataUrlToFile } from '../../services/scanManager';
import { categoryName } from '../../utils/categoryName';
import { useTranslation } from '../../i18n';
import { batch1, fill } from '../../i18n/keys_batch1';
import FinBuddyMascot from '../common/FinBuddyMascot';

export const ReceiptScannerModal = ({ isOpen, onClose, onSuccess }) => {
  const { language } = useTranslation();
  const K = batch1[language]?.scanner || batch1.id.scanner;
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
  // The camera that is running right now, kept in a ref so that it can
  // be turned off from a cleanup that was set up before it started.
  const streamRef = useRef(null);
  // When true the scan is queued on the server and the user is sent back
  // to what they were doing. The result arrives as a notification.
  const [backgroundMode, setBackgroundMode] = useState(true);
  // True while a file is being dragged over the drop zone.
  const [isDragging, setIsDragging] = useState(false);

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
      // The stream is kept in a ref as well as in the state, so that
      // the camera can always be turned off, even from a cleanup that
      // was set up before the camera was ever started.
      streamRef.current = mediaStream;
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setUsingCamera(true);
    } catch (err) {
      console.error('Camera error:', err);
      setError(K.cameraDenied);
    }
  };

  const stopCamera = () => {
    const live = streamRef.current || stream;
    if (live) {
      live.getTracks().forEach(track => track.stop());
      streamRef.current = null;
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
      setError(K.invalidFormat);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError(K.fileTooLarge);
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
    // preventDefault has to run on both dragover and drop, otherwise the
    // browser navigates to the dropped file instead of scanning it.
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer?.files?.[0];
    if (!file) {
      setError(K.noFileDropped);
      return;
    }
    if (!file.type.startsWith('image/')) {
      setError(K.notImage);
      return;
    }
    await processFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Without this the browser treats the drop as a navigation.
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Only clear the highlight when the pointer actually leaves the zone.
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDragging(false);
    }
  };

  /**
   * Queue the scan on the server and let the user carry on.
   *
   * The result arrives as a notification that can be tapped or dragged
   * open, so the user is not stuck watching a spinner.
   */
  const processReceiptInBackground = async () => {
    if (!preview) return;

    setLoading(true);
    setProcessingStatus(K.sending);
    setError('');

    try {
      const file = await dataUrlToFile(preview, 'receipt.jpg');
      await scanManager.scanReceipt(file);
      onSuccess?.();
      handleReset();
      onClose();
    } catch (err) {
      console.error('Background scan error:', err);
      setError(
        fill(K.sendFailed, { message: err.message || K.checkConnection })
      );
      setLoading(false);
      setProcessingStatus('');
    }
  };

  const processReceipt = async () => {
    if (!preview) return;

    if (backgroundMode) {
      return processReceiptInBackground();
    }

    setLoading(true);
    setProcessingStatus(K.uploading);
    setError('');

    try {
      // Convert base64 to blob
      const response = await fetch(preview);
      const blob = await response.blob();
      const imageFile = new File([blob], 'receipt.jpg', { type: 'image/jpeg' });

      setProcessingStatus(K.processingOcr);

      // Try backend OCR endpoint
      const token = localStorage.getItem('token') || localStorage.getItem('sb_token');
      const apiUrl = buildApiUrl('parser/parse-receipt');
      
      const formData = new FormData();
      formData.append('file', imageFile);

      const uploadResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        body: formData,
      });

      if (uploadResponse.ok) {
        const data = await uploadResponse.json();
        setParsedData(data);
        // The backend reports confidence either as 0-1 or as a 0-100
        // percentage depending on the parser that produced it. Normalise to
        // a 0-1 fraction so the UI and the stored value are consistent.
        const rawConfidence = data.confidence_score;
        setConfidence(
          typeof rawConfidence === 'number' && rawConfidence > 1
            ? rawConfidence / 100
            : rawConfidence || 0.8
        );
        populateFields(data);
        setStep('edit');
      } else {
        // Fallback to local OCR
        setProcessingStatus(K.localOcr);
        await localOCR();
      }
    } catch (err) {
      console.error('OCR Error:', err);
      setProcessingStatus(K.localOcr);
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
      
      setProcessingStatus(K.doingOcr);

      const result = await Tesseract.recognize(preview, 'eng+ind', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setProcessingStatus(fill(K.ocrProgress, { percent: Math.round(m.progress * 100) }));
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
      setError(K.ocrFailed);
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
      /(\d{1,2})[-/](\d{1,2})[-/](\d{4})/,
      /(\d{4})[-/](\d{1,2})[-/](\d{1,2})/,
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
    let merchant = K.unknownMerchant;
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
      setError(K.pickAccountFirst);
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError(K.invalidAmount);
      return;
    }

    setLoading(true);
    setError('');

    try {
      await api.transactions.create({
        amount: parseFloat(amount),
        type: 'expense',
        description: merchantName || K.receiptScanDesc,
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
      setError(fill(K.saveFailed, { message: err.message || K.unknownError }));
    } finally {
      setLoading(false);
    }
  };

  const getConfidenceLabel = (score) => {
    if (score >= 0.8) return { text: K.confHigh, color: 'text-green-600' };
    if (score >= 0.6) return { text: K.confMedium, color: 'text-yellow-600' };
    return { text: K.confLow, color: 'text-red-600' };
  };

  const confInfo = getConfidenceLabel(confidence);

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => { handleReset(); onClose(); }}
      title={K.title}
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
                  <X className="w-4 h-4 mr-2" /> {K.cancel}
                </Button>
                <Button
                  onClick={capturePhoto}
                  className="bg-primary-600 hover:bg-primary-700"
                >
                  <Camera className="w-4 h-4 mr-2" /> {K.capture}
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Upload Options */}
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={startCamera}
                  className="flex flex-col items-center gap-2 p-6 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                >
                  <Smartphone className="w-8 h-8 text-gray-400" />
                  <span className="text-sm font-medium">{K.camera}</span>
                </button>
                
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center gap-2 p-6 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                >
                  <FileImage className="w-8 h-8 text-gray-400" />
                  <span className="text-sm font-medium">{K.uploadFile}</span>
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                onChange={handleFileSelect}
                className="hidden"
              />

              {/* Drop Zone */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragEnter={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
                  isDragging
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-gray-300 hover:border-primary-500 dark:border-gray-600'
                }`}
              >
                <Upload
                  className={`w-12 h-12 mx-auto mb-4 ${
                    isDragging ? 'text-primary-500' : 'text-gray-400'
                  }`}
                />
                <p className="text-gray-600 dark:text-gray-400">
                  {isDragging
                    ? K.releaseToScan
                    : K.dragDropHint}
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  {K.fileTypes}
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
              alt={K.receiptPreviewAlt}
              className="w-full max-h-64 object-contain"
              style={{ transform: `rotate(${rotation}deg)` }}
            />

            {/* The line of light that goes down the receipt while it
                is being read. It is the one thing in the
                application that is meant to look like it is
                working, so it is the one thing that is allowed to
                move on its own. */}
            {loading && <div className="money-scan-line" />}
            
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
            <div className="flex items-center gap-3 p-4 bg-primary-50 dark:bg-primary-900/30 rounded-lg">
              {/* The mascot, holding its magnifier. It says the same
                  thing the spinner says, and it does it while the
                  reader is waiting rather than after. */}
              <FinBuddyMascot mood="scanning" size={40} className="shrink-0" />
              <Loader2 className="w-5 h-5 animate-spin text-primary-600" />
              <span className="text-primary-700 dark:text-primary-300">{processingStatus}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleReset}
              className="flex-1"
            >
              {K.cancel}
            </Button>
            <Button
              onClick={processReceipt}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : backgroundMode ? (
                <Bell className="w-4 h-4" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {backgroundMode ? K.scanInBackground : K.scanReceipt}
            </Button>
          </div>

          {/* The user can wait for the result here, or let it run in the
              background. The background mode is the default because a
              scan takes several seconds. */}
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
            <input
              type="checkbox"
              checked={backgroundMode}
              onChange={(e) => setBackgroundMode(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-xs text-gray-600 dark:text-gray-400">
              <span className="font-medium text-gray-800 dark:text-gray-200">
                {K.bgTitle}
              </span>
              <br />
              {K.bgDesc}
            </span>
          </label>

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
            <span className="text-sm text-gray-500">{K.ocrConfidence}</span>
            <span className={`text-sm font-medium ${confInfo.color}`}>
              {confInfo.text} ({Math.round(confidence * 100)}%)
            </span>
          </div>

          {/* Scan diagnostics: how the image was restored and which parser ran.
              Shown so a poor scan can be explained instead of looking broken. */}
          {parsedData?.ocr_diagnostics && (
            <ScanDiagnostics diagnostics={parsedData.ocr_diagnostics} />
          )}

          {/* Self-learning: let the user confirm an item name so the
              recogniser learns the vocabulary that appears on their receipts. */}
          {(parsedData?.items?.length > 0) && (
            <LearnFromScan
              items={parsedData.items}
              onLearned={() => {
                // Nothing to refresh in the UI; the catalogue is updated in
                // the background so later scans recognise the term.
              }}
            />
          )}

          {/* The itemised breakdown. The user can see every product, the
              quantity and the discount before the transaction is saved. */}
          <ReceiptBreakdown
            breakdown={parsedData?.breakdown}
            learning={parsedData?.learning}
          />

          {/* Form */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {K.merchantStore}
              </label>
              <input
                type="text"
                value={merchantName}
                onChange={(e) => setMerchantName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                           bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                placeholder={K.merchantPlaceholder}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {K.amount}
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
                {K.location}
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                           bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                placeholder={K.addressPlaceholder}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {K.date}
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
                {K.account}
              </label>
              <select
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                           bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="">{K.pickAccount}</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {K.category}
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                           bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="">{K.pickCategoryOptional}</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {categoryName(cat, language)}
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
              {K.back}
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
              {K.save}
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
