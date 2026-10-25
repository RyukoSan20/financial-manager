import { useState, useEffect, useRef, useCallback } from 'react';
import { Modal, Button, Input } from '../ui';
import { Mic, X, Loader2, AlertTriangle, Check, RotateCcw, Keyboard } from 'lucide-react';
import { apiUrl } from '../../config/url';

/**
 * Voice transaction input.
 *
 * Speech recognition happens in the browser via the Web Speech API
 * (webkitSpeechRecognition). The recognised text is then parsed server-side
 * by POST /api/voice/parse so that Indonesian number words ("dua puluh lima
 * ribu") resolve to real amounts.
 *
 * Browser support: Chrome, Edge, Safari 14.1+. Firefox does not implement
 * the Web Speech API, so the component degrades to manual text entry.
 *
 * Two bugs this component is specifically built to avoid:
 *
 *  1. The transcript must not be overwritten by the speech engine. When
 *     the user types into the manual field and the recognition then fires
 *     an interim result, the typed text was destroyed. The manual text and
 *     the recognised text are now separate pieces of state.
 *
 *  2. The recogniser must not be torn down mid-utterance. `continuous` is
 *     true and results are accumulated across the whole session, so a
 *     pause in the middle of a sentence no longer discards the text that
 *     was already captured.
 */

const SpeechRecognitionCtor =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

export const isVoiceSupported = () => Boolean(SpeechRecognitionCtor);

const VOICE_LANG = 'id-ID';

export const VoiceTransactionModal = ({ isOpen, onClose, onSave }) => {
  const [listening, setListening] = useState(false);
  const [recognized, setRecognized] = useState('');
  const [manualText, setManualText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const [parsed, setParsed] = useState(null);
  const [form, setForm] = useState({
    amount: '',
    merchant_name: '',
    category: '',
    transaction_type: 'expense',
    description: '',
  });

  const recognitionRef = useRef(null);
  const activeRef = useRef(false);
  const finalTextRef = useRef('');

  const reset = useCallback(() => {
    setRecognized('');
    setManualText('');
    setParsed(null);
    setError('');
    setSaved(false);
    setParsing(false);
    setForm({
      amount: '',
      merchant_name: '',
      category: '',
      transaction_type: 'expense',
      description: '',
    });
    finalTextRef.current = '';
  }, []);

  useEffect(() => {
    if (isOpen) reset();
    return () => {
      stopListening();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const stopListening = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition || !activeRef.current) {
      activeRef.current = false;
      setListening(false);
      return;
    }
    activeRef.current = false;
    try {
      recognition.stop();
    } catch (err) {
      console.warn('Speech recognition stop warning:', err?.message || err);
    }
    setListening(false);
  }, []);

  const parseText = useCallback(async (text) => {
    const clean = (text || '').trim();
    if (!clean) {
      setError('Tidak ada suara yang terdeteksi. Coba lagi.');
      return;
    }
    setParsing(true);
    setError('');
    try {
      const response = await fetch(apiUrl('voice/parse'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: clean }),
      });

      if (!response.ok) {
        throw new Error(`Server error ${response.status}`);
      }
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error('Respons server bukan JSON');
      }

      const data = await response.json();
      setParsed(data);
      setForm({
        amount: data.amount != null ? String(data.amount) : '',
        merchant_name: data.merchant_name || '',
        category: data.category || '',
        transaction_type: data.transaction_type || 'expense',
        description: data.description || clean,
      });
    } catch (err) {
      console.error('Voice parse failed:', err);
      setError('Gagal memproses suara: ' + (err?.message || err));
    } finally {
      setParsing(false);
    }
  }, []);

  const startListening = useCallback(() => {
    if (!SpeechRecognitionCtor) {
      setError(
        'Browser Anda tidak mendukung input suara (Web Speech API). Gunakan Chrome atau Edge, atau ketik manual di bawah.'
      );
      return;
    }

    setError('');
    setParsed(null);
    finalTextRef.current = '';

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = VOICE_LANG;
    // Keep listening across pauses so a long phrase is not cut in half.
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      activeRef.current = true;
      setListening(true);
    };

    recognition.onresult = (event) => {
      let interim = '';
      let final = '';

      // Walk every result from the beginning so nothing is lost when the
      // browser restarts the result index.
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0]?.transcript || '';
        if (result.isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }

      finalTextRef.current = (finalTextRef.current + final).trim();
      setRecognized(finalTextRef.current + (interim ? ' ' + interim : ''));
    };

    recognition.onerror = (event) => {
      activeRef.current = false;
      setListening(false);
      const messages = {
        'not-allowed': 'Izin mikrofon ditolak. Izinkan akses mikrofon di pengaturan browser lalu coba lagi.',
        'service-not-allowed': 'Layanan pengenalan suara tidak tersedia di browser ini.',
        'no-speech': 'Tidak ada suara terdeteksi. Coba lagi lebih dekat ke mikrofon.',
        'audio-capture': 'Mikrofon tidak ditemukan.',
        network: 'Koneksi jaringan bermasalah saat pengenalan suara.',
        aborted: 'Pengenalan suara dibatalkan.',
      };
      setError(messages[event.error] || `Pengenalan suara gagal: ${event.error}`);
    };

    recognition.onend = () => {
      activeRef.current = false;
      setListening(false);
      // Parse whatever was captured when the session ended.
      const finalText = finalTextRef.current.trim();
      if (finalText) {
        parseText(finalText);
      }
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (err) {
      console.warn('Speech recognition start warning:', err?.message || err);
      setError('Tidak dapat memulai pengenalan suara.');
    }
  }, [parseText]);

  const handleSave = async () => {
    if (!parsed) return;
    if (!form.amount || Number(form.amount) <= 0) {
      setError('Jumlah transaksi harus diisi.');
      return;
    }
    setError('');
    setSaved(true);
    try {
      await onSave({
        amount: Number(form.amount),
        merchant_name: form.merchant_name || null,
        category: form.category || null,
        transaction_type: form.transaction_type,
        description: form.description || recognized || manualText,
      });
      onClose();
    } catch (err) {
      console.error('Voice transaction save failed:', err);
      setSaved(false);
      setError('Gagal menyimpan transaksi: ' + (err?.message || err));
    }
  };

  const handleClose = () => {
    stopListening();
    onClose();
  };

  const supported = isVoiceSupported();
  // The text that will actually be sent to the parser.
  const effectiveText = recognized.trim() || manualText.trim();

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Input Transaksi dengan Suara" size="md">
      <div className="space-y-4">
        {/* Mic button */}
        <div className="flex flex-col items-center justify-center py-4">
          <button
            onClick={listening ? stopListening : startListening}
            disabled={parsing}
            className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
              listening
                ? 'bg-red-600 text-white animate-pulse shadow-lg shadow-red-600/50'
                : 'bg-primary-600 text-white hover:bg-primary-600 shadow-lg shadow-primary-500/30'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            aria-label={listening ? 'Hentikan merekam' : 'Mulai merekam'}
          >
            {parsing ? (
              <Loader2 className="w-9 h-9 animate-spin" />
            ) : (
              <Mic className="w-9 h-9" />
            )}
          </button>
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
            {listening
              ? 'Mendengarkan... ucapkan transaksi Anda, lalu tekan Stop'
              : parsing
              ? 'Memproses...'
              : 'Tekan mikrofon dan ucapkan transaksi'}
          </p>
        </div>

        {!supported && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
            Browser Anda tidak mendukung pengenalan suara (Web Speech API). Gunakan Chrome atau Edge,
            atau ketik manual di bawah.
          </div>
        )}

        {/* Recognised speech - read only, never overwritten by the manual field */}
        {recognized && (
          <div className="p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Terdengar:</p>
            <p className="text-sm text-gray-800 dark:text-gray-200">{recognized}</p>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Manual text fallback - always available and never clobbered */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            <span className="inline-flex items-center gap-1.5">
              <Keyboard className="w-3.5 h-3.5" />
              Teks transaksi
            </span>
          </label>
          <div className="flex gap-2">
            <Input
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder="contoh: beli kopi dua puluh lima ribu"
              onKeyDown={(e) => {
                if (e.key === 'Enter') parseText(manualText);
              }}
            />
            <Button
              variant="secondary"
              onClick={() => parseText(manualText)}
              disabled={parsing || !manualText.trim()}
            >
              Parse
            </Button>
          </div>
          {recognized && manualText.trim() && (
            <p className="text-xs text-gray-400 mt-1">
              Teks manual yang akan diproses. Teks yang terdengar tetap tersimpan di atas.
            </p>
          )}
        </div>

        {/* Parsed result - editable before saving */}
        {parsed && (
          <div className="space-y-3 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 text-green-800 font-medium text-sm">
              <Check className="w-4 h-4" />
              Berhasil dikenali (keyakinan {(parsed.confidence_score * 100).toFixed(0)}%)
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Jumlah (Rp)</label>
                <Input
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Tipe</label>
                <select
                  value={form.transaction_type}
                  onChange={(e) => setForm({ ...form, transaction_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="expense">Pengeluaran</option>
                  <option value="income">Pemasukan</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1">Merchant / Sumber</label>
              <Input
                value={form.merchant_name}
                onChange={(e) => setForm({ ...form, merchant_name: e.target.value })}
                placeholder="Nama merchant"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1">Kategori</label>
              <Input
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="contoh: Makanan & Minuman"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1">Catatan</label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Catatan transaksi"
              />
            </div>

            {parsed.missing_fields?.length > 0 && (
              <p className="text-xs text-amber-700">
                Perlu dilengkapi: {parsed.missing_fields.join(', ')}
              </p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 flex-wrap">
          {parsed && (
            <Button variant="outline" onClick={() => setParsed(null)}>
              <RotateCcw className="w-4 h-4 mr-1" />
              Ulangi
            </Button>
          )}
          {listening && (
            <Button variant="outline" onClick={stopListening}>
              <X className="w-4 h-4 mr-1" />
              Stop
            </Button>
          )}
          {parsed && (
            <Button onClick={handleSave} disabled={saved}>
              {saved ? 'Tersimpan' : 'Simpan Transaksi'}
            </Button>
          )}
          <Button variant="secondary" onClick={handleClose}>
            Batal
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default VoiceTransactionModal;
