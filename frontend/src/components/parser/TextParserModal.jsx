/**
 * Enhanced Text Parser Modal
 * Supports: SMS bank, QRIS, e-wallet notifications, and manual text
 * Improved parsing with multi-language support
 */
import { useState, useEffect, useCallback } from 'react';
import { Modal, Button, Input, Select } from '../ui';
import { Camera, FileText, Loader2, Check, Sparkles, AlertCircle, ChevronDown, ChevronUp, Copy, Trash2, Zap } from 'lucide-react';
import api from '../../services/api';
import { formatCurrency } from '../../utils/format';
import { useTranslation } from '../../i18n';
import { batch4 } from '../../i18n/keys_batch4';

export const TextParserModal = ({ isOpen, onClose, onSuccess }) => {
  // The messages in this screen used to be written in Indonesian, so
  // a reader who picked English still read Indonesian. They are read
  // from the language the reader picked now.
  const { language } = useTranslation();
  const K = batch4[language]?.text_parser;
  const [rawText, setRawText] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');
  const [selectedResult, setSelectedResult] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [step, setStep] = useState('input');
  const [expandedResult, setExpandedResult] = useState(null);
  const [parseDetails, setParseDetails] = useState(null);

  // Sample texts for quick testing
  const sampleTexts = [
    {
      label: '🏦 SMS BCA',
      text: 'Transfer berhasil Rp500.000 dari JOHN DOE ke JANE SMITH. Tanggal: 12/10/2024 14:30. Ref: BC123456'
    },
    {
      label: '📱 GoPay',
      text: 'GOPAY - Pembayaran GoFood Rp45.000 ke WARUNG IBU. Sisa saldo: Rp125.000. 12 Okt 2024 13:45'
    },
    {
      label: '💳 QRIS',
      text: 'QRIS - Pembayaran Rp150.000 di TOKO BANGUNAN. Merchant: Toko Material Jaya. 12/10/24 10:00'
    },
    {
      label: '💰 Transfer Masuk',
      text: 'Anda menerima transfer Rp2.500.000 dari BUDI SANTOSO. Tanggal 12 Oktober 2024 09:15. Saldo: Rp5.750.000'
    }
  ];

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
      setError(K.empty_text);
      return;
    }

    if (rawText.trim().length < 10) {
      setError(K.text_too_short);
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
        // Try local parsing as fallback
        const localParsed = localParse(rawText);
        if (localParsed.length > 0) {
          setResults(localParsed);
          setSelectedResult({
            ...localParsed[0],
            account_id: accounts[0]?.id || ''
          });
          setParseDetails({ method: 'Local Parser', confidence: 0.85 });
        } else {
          setError(K.no_transaction);
        }
        return;
      }

      setResults(parsed);
      setSelectedResult({
        ...parsed[0],
        account_id: parsed[0].account_id || accounts[0]?.id || ''
      });
      setParseDetails({ method: 'AI Parser', confidence: parsed[0].confidence_score });
      setStep('preview');
    } catch (err) {
      console.error('Parse error:', err);
      // Fallback to local parsing
      const localParsed = localParse(rawText);
      if (localParsed.length > 0) {
        setResults(localParsed);
        setSelectedResult({
          ...localParsed[0],
          account_id: accounts[0]?.id || ''
        });
        setParseDetails({ method: 'Local Parser', confidence: 0.75 });
        setStep('preview');
      } else {
        setError(K.parse_failed + ' ' + (err.message || K.unknown_error));
      }
    } finally {
      setLoading(false);
    }
  };

  // Local parsing fallback
  const localParse = (text) => {
    const results = [];
    const upperText = text.toUpperCase();
    
    // Amount patterns (IDR with dots, commas, or plain)
    const amountPatterns = [
      /Rp\.?\s*([\d.,]+)/i,
      /([\d.,]+)\s*Rp/i,
      /(?:total|amount|jumlah|bayar|transfer)\s*:?\s*Rp?\s*([\d.,]+)/i,
      /Rp\s*([\d.,]+)/i,
      /(?:^|\s)([\d]{1,3}(?:[.,]\d{3})+)(?:\s|$)/,
    ];

    let amount = null;
    for (const pattern of amountPatterns) {
      const match = text.match(pattern);
      if (match) {
        const raw = match[1] || match[2];
        amount = parseFloat(raw.replace(/[.,]/g, ''));
        if (!isNaN(amount) && amount > 0) break;
      }
    }

    // Type detection
    let type = 'expense';
    const incomeKeywords = ['masuk', 'terima', 'dari', 'credit', 'incoming', 'deposit', 'received', 'masukan'];
    const expenseKeywords = ['bayar', 'keluar', 'ke', 'debit', 'purchase', 'payment', 'transfer', 'beli'];
    
    for (const kw of incomeKeywords) {
      if (upperText.includes(kw.toUpperCase())) {
        type = 'income';
        break;
      }
    }
    for (const kw of expenseKeywords) {
      if (upperText.includes(kw.toUpperCase()) && type === 'income') {
        // Check if it's actually expense
        const expensePatterns = ['BAYAR', 'BELI', 'PEMBAYARAN', 'PEMBELIAN'];
        for (const ep of expensePatterns) {
          if (upperText.includes(ep)) {
            type = 'expense';
            break;
          }
        }
      }
    }

    // Date extraction
    const datePatterns = [
      /(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/,
      /(\d{4})[-/](\d{1,2})[-/](\d{1,2})/,
      /(\d{1,2})\s+(Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember)\s+(\d{4})/i,
      /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+(\d{4})/i,
    ];
    
    let dateStr = null;
    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        // Simple date construction
        if (match[1].length === 4) {
          dateStr = `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
        } else {
          const year = match[3].length === 2 ? '20' + match[3] : match[3];
          dateStr = `${year}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
        }
        break;
      }
    }

    // Merchant/source extraction
    let merchant = null;
    const merchantPatterns = [
      /(?:di|ke|pada)\s+([A-Z][A-Za-z\s]+?)(?:\.|\s+tanggal|\s+saldo|\s+ref|\s+\d|$)/i,
      /(?:merchant|toko|tempat)\s*:?\s*([A-Za-z\s]+?)(?:\.|$)/i,
    ];
    
    for (const pattern of merchantPatterns) {
      const match = text.match(pattern);
      if (match && match[1] && match[1].length > 2) {
        merchant = match[1].trim();
        break;
      }
    }

    if (amount) {
      results.push({
        amount: amount.toString(),
        transaction_type: type.toUpperCase(),
        suggested_type: type,
        merchant_name: merchant || 'Parsed Transaction',
        description: merchant || K.from_parsed_text,
        date: dateStr || new Date().toISOString().split('T')[0],
        confidence_score: 0.75,
        detection_type: 'local_parser',
        raw_text: text,
      });
    }

    return results;
  };

  const handleConfirm = async () => {
    if (!selectedResult) {
      setError(K.pick_transaction);
      return;
    }
    
    if (!selectedResult.account_id) {
      setError(K.pick_account);
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
        detection_type: selectedResult.detection_type || 'local_parser',
        latitude: selectedResult.latitude,
        longitude: selectedResult.longitude,
      });

      onSuccess?.();
      handleClose();
    } catch (err) {
      console.error('Confirm error:', err);
      setError(K.save_failed + ' ' + (err.message || K.unknown_error));
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
    setParseDetails(null);
    onClose();
  };

  const applySample = (text) => {
    setRawText(text);
  };

  const toggleExpand = (index) => {
    setExpandedResult(expandedResult === index ? null : index);
  };

  const getTypeLabel = (type) => {
    return type === 'CREDIT' || type === 'income' ? 'Pemasukan' : 'Pengeluaran';
  };

  const getTypeColor = (type) => {
    return type === 'CREDIT' || type === 'income' ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50';
  };

  const getConfidenceColor = (score) => {
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Smart Text Parser"
      size="lg"
    >
      {/* Step 1: Input */}
      {step === 'input' && (
        <div className="space-y-4">
          {/* Quick Samples */}
          <div className="bg-primary-50 dark:bg-primary-900/30 rounded-lg p-3">
            <p className="text-sm text-primary-800 dark:text-primary-300 mb-2 font-medium">{K.examples_title}</p>
            <div className="flex flex-wrap gap-2">
              {sampleTexts.map((sample, i) => (
                <button
                  key={i}
                  onClick={() => applySample(sample.text)}
                  className="text-xs px-2 py-1 bg-white dark:bg-gray-700 rounded border border-primary-200 dark:border-primary-700 hover:bg-primary-100 dark:hover:bg-primary-800 transition-colors"
                >
                  {sample.label}
                </button>
              ))}
            </div>
          </div>

          {/* Text Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {K.input_label}
            </label>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder={K.placeholder}
              className="w-full h-40 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                         bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                         placeholder-gray-400 dark:placeholder-gray-500 resize-none
                         focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {/* Quick Actions */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setRawText('')}
              className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1"
            >
              <Trash2 className="w-4 h-4" /> Clear
            </button>
            
            <Button
              onClick={handleParse}
              disabled={loading || !rawText.trim()}
              className="flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Parsing...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Parse Sekarang
                </>
              )}
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

      {/* Step 2: Preview Results */}
      {step === 'preview' && results.length > 0 && (
        <div className="space-y-4">
          {/* Parse Info */}
          {parseDetails && (
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-2 rounded">
              <Zap className="w-4 h-4" />
              <span>Parsed dengan {parseDetails.method}</span>
              <span>•</span>
              <span className={getConfidenceColor(parseDetails.confidence)}>
                {Math.round(parseDetails.confidence * 100)}% confidence
              </span>
            </div>
          )}

          {/* Results List */}
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {results.map((result, index) => (
              <div
                key={index}
                className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                  selectedResult === result 
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30' 
                    : 'border-gray-200 dark:border-gray-700 hover:border-primary-300'
                }`}
                onClick={() => setSelectedResult({ ...result, account_id: result.account_id || accounts[0]?.id || '' })}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* Type Badge */}
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getTypeColor(result.suggested_type || result.transaction_type)}`}>
                      {getTypeLabel(result.suggested_type || result.transaction_type)}
                    </span>
                    
                    {/* Amount */}
                    <p className="text-xl font-bold text-gray-900 dark:text-white mt-2">
                      {formatCurrency(parseFloat(result.amount) || 0)}
                    </p>
                    
                    {/* Description */}
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {result.merchant_name || result.description || 'Transaction'}
                    </p>
                    
                    {/* Date */}
                    {result.date && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {K.result_date} {result.date}
                      </p>
                    )}
                  </div>

                  {/* Expand Button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleExpand(index); }}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  >
                    {expandedResult === index ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </button>
                </div>

                {/* Expanded Details */}
                {expandedResult === index && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 space-y-2 text-sm">
                    {result.reference_number && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Reference:</span>
                        <span className="font-mono">{result.reference_number}</span>
                      </div>
                    )}
                    {result.merchant_address && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Address:</span>
                        <span>{result.merchant_address}</span>
                      </div>
                    )}
                    {result.account_source && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Source:</span>
                        <span>{result.account_source}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-500">Confidence:</span>
                      <span className={getConfidenceColor(result.confidence_score)}>
                        {Math.round(result.confidence_score * 100)}%
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Account Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Akun Tujuan
            </label>
            <select
              value={selectedResult?.account_id || ''}
              onChange={(e) => setSelectedResult({ ...selectedResult, account_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                         bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="">{K.choose_account}</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} - {formatCurrency(acc.balance, acc.currency)}
                </option>
              ))}
            </select>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setStep('input');
                setResults([]);
                setSelectedResult(null);
              }}
              className="flex-1"
            >
              Kembali
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={confirming || !selectedResult?.account_id}
              className="flex-1 flex items-center justify-center gap-2"
            >
              {confirming ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Simpan Transaction
                </>
              )}
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

export default TextParserModal;
