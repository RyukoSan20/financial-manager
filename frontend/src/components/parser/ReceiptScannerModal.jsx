/**
 * The receipt scanner.
 *
 * Three things were wrong with this screen, and all three cost the
 * reader their purchase.
 *
 * The camera showed a black rectangle. The stream was attached to the
 * video element inside the function that started it, but the video
 * element was not on the page yet, so the stream was attached to
 * nothing and the reader was left looking at a black box with a
 * shutter button that could not work.
 *
 * There was no way to scan without a camera. A reader on a laptop
 * with no webcam, or one who says no to the permission prompt, had
 * nothing at all.
 *
 * And the transaction disappeared. The receipt was read, the total was
 * shown, and then the save failed silently: a reader with no account
 * had nowhere to put the money. The transaction was never written
 * down, and the screen said nothing about it.
 *
 * So: the camera is attached properly, with a loading state, a
 * permission error with a retry, and a way to switch between cameras.
 * There is always a way to pick a file. And the result is always
 * complete and editable - the shop, the day, the total, the category,
 * the account, and every line of the bill - so a reader without a
 * key for the vision model still gets something they can correct.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { Modal, Button } from '../ui';
import {
  Camera, Upload, Loader2, AlertCircle, Check, Sparkles, X, RotateCcw,
  FileImage, Smartphone, RefreshCw, CameraOff, ListOrdered,
} from 'lucide-react';
import api from '../../services/api';
import { apiUrl as buildApiUrl } from '../../config/url';
import { formatCurrency } from '../../utils/format';
import { ScanDiagnostics, LearnFromScan } from './ScanDiagnostics';
import { ReceiptBreakdown } from './ReceiptBreakdown';
import { LineItemEditor } from '../transactions/LineItemEditor';
import { scanManager, dataUrlToFile } from '../../services/scanManager';
import { categoryName } from '../../utils/categoryName';
import { useTranslation } from '../../i18n';
import { batch1, fill } from '../../i18n/keys_batch1';
import FinBuddyMascot from '../common/FinBuddyMascot';

export const ReceiptScannerModal = ({ isOpen, onClose, onSuccess, onReview }) => {
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
  // The lines of the bill. This is what makes a receipt a receipt:
  // not one number, but a list of what was bought.
  const [items, setItems] = useState([]);

  // Image enhancement
  const [rotation, setRotation] = useState(0);

  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [usingCamera, setUsingCamera] = useState(false);
  const [stream, setStream] = useState(null);
  // The stream is kept in a ref as well as in the state, so that the
  // camera can always be turned off, even from a cleanup that was set
  // up before the camera was ever started.
  const streamRef = useRef(null);
  // The state of the camera, so the reader is told what is happening:
  // asking, working, refused, or working with no picture.
  const [cameraStatus, setCameraStatus] = useState('idle'); // idle | starting | ready | error | unsupported
  const [cameraError, setCameraError] = useState('');
  // The cameras on this machine, and which one is in use.
  const [cameraList, setCameraList] = useState([]);
  const [activeCamera, setActiveCamera] = useState(0);
  // When true the scan is queued on the server and the user is sent back
  // to what they were doing. The result arrives as a notification.
  const [backgroundMode, setBackgroundMode] = useState(false);
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
      const accountList = Array.isArray(accRes) ? accRes : [];
      setAccounts(accountList);
      setCategories(Array.isArray(catRes) ? catRes : []);
      if (accountList.length > 0 && !selectedAccount) {
        setSelectedAccount(accountList[0].id.toString());
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    }
  };

  /**
   * Attach the camera to the video element.
   *
   * The video element has to be on the page and mounted before the
   * stream can be put on it. That is why this is its own effect: it
   * runs after the render that put the video there, not in the same
   * breath as the request for the camera.
   */
  useEffect(() => {
    if (!usingCamera || !stream || !videoRef.current) return;
    const video = videoRef.current;
    if (video.srcObject !== stream) {
      video.srcObject = stream;
    }
    // Some browsers need the play() call to be made by hand before
    // the picture appears. It is harmless when it is not needed.
    const played = video.play?.();
    if (played && typeof played.catch === 'function') {
      played.catch(() => {});
    }
  }, [usingCamera, stream]);

  const startCamera = async (deviceIndex = activeCamera) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStatus('unsupported');
      setCameraError(K.cameraUnsupported);
      return;
    }

    setCameraStatus('starting');
    setCameraError('');
    setError('');

    try {
      // The list of cameras, so the reader can switch between the
      // front one and the back one.
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter((d) => d.kind === 'videoinput');
        setCameraList(cameras);
      } catch {
        // The list is a nicety. Not being able to read it must not
        // stop the camera from working.
        setCameraList([]);
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          ...(deviceIndex ? { deviceId: { exact: deviceListId(deviceIndex) } } : {}),
        },
        audio: false,
      });

      // The stream is kept in a ref as well as in the state, so that
      // the camera can always be turned off, even from a cleanup that
      // was set up before the camera was ever started.
      streamRef.current = mediaStream;
      setStream(mediaStream);
      setUsingCamera(true);
      setCameraStatus('ready');
    } catch (err) {
      console.error('Camera error:', err);
      setUsingCamera(false);
      setCameraStatus('error');
      setCameraError(
        err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError'
          ? K.cameraDenied
          : err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError'
            ? K.cameraNotFound
            : K.cameraError
      );
    }
  };

  // The device id of a camera in the list, when the list has one.
  const deviceListId = (index) => cameraList[index]?.deviceId;

  const switchCamera = async () => {
    if (cameraList.length < 2) return;
    stopCamera();
    const next = (activeCamera + 1) % cameraList.length;
    setActiveCamera(next);
    await startCamera(next);
  };

  const stopCamera = useCallback(() => {
    const live = streamRef.current || stream;
    if (live) {
      live.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setUsingCamera(false);
    setCameraStatus('idle');
  }, [stream]);

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    if (!videoRef.current.videoWidth) {
      setCameraError(K.cameraNoPicture);
      return;
    }

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
    // The same file can be picked twice in a row, so the input is
    // cleared before the file is read.
    e.target.value = '';
    await processFile(file);
  };

  const processFile = async (file) => {
    // Validate file
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    if (!allowedTypes.includes(file.type) && !file.type.startsWith('image/')) {
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
    reader.onerror = () => setError(K.readFailed);
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
        applyReading(data);
        setStep('edit');
      } else {
        // The server could not read it. The browser tries.
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
      applyReading(parsed);
      setStep('edit');
    } catch (err) {
      console.error('Local OCR Error:', err);
      // Nothing could read the receipt. The reader still gets a form
      // they can fill in by hand, rather than an error and a lost
      // purchase.
      setError(K.ocrFailed);
      setParsedData({ confidence_score: 0, items: [] });
      setItems([]);
      setStep('edit');
    }
  };

  const parseReceiptText = (text) => {
    const lines = text.split('\n').map((l) => l.trim()).filter((l) => l);

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

    // The lines of the bill. A line with a name and a price on it is
    // something that was bought.
    const lineItems = [];
    for (const line of lines) {
      if (/total|subtotal|jumlah|kembali|change|tunai|cash|debit|kredit|credit|pajak|tax|diskon/i.test(line)) {
        continue;
      }
      if (/jl\.|jalan|street|alamat/i.test(line)) continue;
      const priceMatch = line.match(/([\d.,]+)\s*$/);
      if (!priceMatch) continue;
      const name = line.slice(0, priceMatch.index).trim();
      if (!name || name.length < 2) continue;
      if (!/[a-zA-Z]{3,}/.test(name)) continue;
      const unitPrice = parseFloat(priceMatch[1].replace(/[.,]/g, '')) || 0;
      if (unitPrice <= 0) continue;
      const qtyMatch = name.match(/(\d+)\s*x\s*\w/);
      lineItems.push({
        name: name.replace(/\s*\d+\s*x\s*$/, '').trim() || name,
        quantity: qtyMatch ? parseInt(qtyMatch[1], 10) : 1,
        unit_price: unitPrice,
        total_price: unitPrice,
      });
    }

    return {
      merchant_name: merchant,
      amount: amount.toString(),
      date: date,
      location: location,
      confidence_score: 0.7,
      raw_text: text,
      items: lineItems,
    };
  };

  /**
   * Put a reading on the screen.
   *
   * Every reading comes in the same shape, whichever reader produced
   * it, so this is the only place that has to know how to open one.
   */
  const applyReading = (data) => {
    if (!data) return;
    setParsedData(data);

    // The backend reports confidence either as 0-1 or as a 0-100
    // percentage depending on the parser that produced it. Normalise to
    // a 0-1 fraction so the UI and the stored value are consistent.
    const rawConfidence = data.confidence_score ?? data.confidence;
    setConfidence(
      typeof rawConfidence === 'number' && rawConfidence > 1
        ? rawConfidence / 100
        : rawConfidence || 0.8
    );

    const readItems = Array.isArray(data.items) ? data.items : [];
    setItems(
      readItems.map((item) => ({
        name: item.name || '',
        quantity: Number(item.quantity ?? 1) || 1,
        unit_price: Number(item.unit_price ?? item.price_per_unit ?? 0) || 0,
        total_price: Number(item.total_price ?? item.total ?? 0) || 0,
      }))
    );

    setMerchantName(data.merchant_name || '');
    setAmount(
      data.amount !== undefined && data.amount !== null && data.amount !== ''
        ? String(data.total_amount ?? data.amount)
        : ''
    );
    setLocation(data.location || data.merchant_address || '');
    setTransactionDate(data.date || new Date().toISOString().split('T')[0]);
    if (data.raw_text) setRawText(data.raw_text);
  };

  const populateFields = (data) => applyReading(data);

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
    setItems([]);
    setCameraError('');
  };

  /**
   * The lines, as they will be saved.
   *
   * The total of the lines is what the reader sees, so a line whose
   * sum does not match the total is worth pointing out - but it is
   * their receipt, and their total, so their number wins.
   */
  const itemsTotal = items.reduce((sum, item) => {
    const quantity = Number(item.quantity) || 0;
    const unit = Number(item.unit_price) || 0;
    return sum + quantity * unit;
  }, 0);

  const linesDisagree = items.length > 0 && amount && Math.abs(itemsTotal - parseFloat(amount)) > 1;

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

    const itemPayload = items.map((item) => ({
      name: item.name,
      quantity: Number(item.quantity) || 1,
      unit_price: Number(item.unit_price) || 0,
      total_price: Number(item.unit_price || 0) * (Number(item.quantity) || 1),
    }));

    try {
      // When the reader wants to look at the receipt before it is
      // saved, the reading is handed over instead of being written
      // down. The lines are shown to them, with the discount, the tax
      // and the sharing, and they decide.
      if (onReview) {
        onReview({
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
          items: itemPayload,
          // A scan that ran in the background has already written a
          // transaction down, waiting for the review. The review has
          // to know which one it is, or it will make a second and the
          // reader will pay twice for one purchase.
          transaction_id: parsedData?.transaction_id ?? null,
        });
        handleReset();
        onClose();
        return;
      }

      const created = await api.transactions.create({
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
        // The lines go down with the transaction, so they are there
        // in the history and in the review.
        items: itemPayload,
      });

      // The receipt is also queued for the review, so the reader can
      // look at it there with the rest of the things that need
      // looking at.
      try {
        await api.feed.scanReceipt(preview, parseInt(selectedAccount));
      } catch (reviewError) {
        // The transaction is saved either way. The review is a second
        // copy, and failing to make it must not undo the first one.
        console.warn('Could not queue the receipt for review:', reviewError);
      }

      onSuccess?.(created);
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
                muted
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
                {cameraList.length > 1 && (
                  <Button
                    variant="outline"
                    onClick={switchCamera}
                    className="bg-white/80"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" /> {K.switchCamera}
                  </Button>
                )}
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
                  onClick={() => startCamera()}
                  disabled={cameraStatus === 'starting'}
                  className="flex flex-col items-center gap-2 p-6 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors disabled:opacity-60"
                >
                  {cameraStatus === 'starting' ? (
                    <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
                  ) : (
                    <Smartphone className="w-8 h-8 text-gray-400" />
                  )}
                  <span className="text-sm font-medium">
                    {cameraStatus === 'starting' ? K.cameraStarting : K.camera}
                  </span>
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center gap-2 p-6 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                >
                  <FileImage className="w-8 h-8 text-gray-400" />
                  <span className="text-sm font-medium">{K.uploadFile}</span>
                </button>
              </div>

              {/* The file input is always here, whether or not the
                  camera works. It is the way in for the reader with no
                  webcam, and for the reader who says no to the
                  permission. */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileSelect}
                className="hidden"
              />

              {/* The camera's state, said out loud. */}
              {cameraStatus === 'error' && cameraError && (
                <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 rounded-lg text-sm">
                  <CameraOff className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p>{cameraError}</p>
                    <button
                      onClick={() => startCamera()}
                      className="mt-2 inline-flex items-center gap-1 text-sm font-medium underline"
                    >
                      <RefreshCw className="w-3 h-3" /> {K.cameraRetry}
                    </button>
                  </div>
                </div>
              )}

              {cameraStatus === 'unsupported' && cameraError && (
                <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 rounded-lg text-sm">
                  <CameraOff className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <p>{cameraError}</p>
                </div>
              )}

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
                onClick={() => setRotation((r) => (r + 90) % 360)}
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
                <Upload className="w-4 h-4" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {backgroundMode ? K.scanInBackground : K.scanReceipt}
            </Button>
          </div>

          {/* The user can wait for the result here, or let it run in the
              background. The background mode is off by default now,
              because the reader needs to see the lines of the bill
              before the purchase is written down. */}
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

      {/* Step 3: The result, to be read and corrected */}
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

            {/* The lines of the bill. This is the part that makes the
                receipt a receipt, and it is editable so a reader can
                put right what was read wrong. */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <ListOrdered className="w-4 h-4 text-gray-400" />
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {K.rincianBarang}
                </label>
              </div>
              <LineItemEditor items={items} onChange={setItems} currency="IDR" />
              {linesDisagree && (
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                  {fill(K.linesDisagree, { lines: formatCurrency(itemsTotal), total: formatCurrency(parseFloat(amount)) })}
                </p>
              )}
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
