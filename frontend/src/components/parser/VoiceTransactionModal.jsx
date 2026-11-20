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
 *
 * And what comes back is a whole transaction, not a number. The phrase
 * "beli kopi jago 2 harganya Rp15.000 rasa vanila di Kemayoran" is read
 * as an expense of thirty thousand for two coffees, with the shop, the
 * place and the category each in their own field, and the lines
 * editable before it is saved.
 *
 * The companion is here too. It listens with the reader, it answers out
 * loud what it heard, and it can be asked to put the reading right.
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Modal, Button, Input } from '../ui';
import {
  Mic, X, Loader2, AlertTriangle, Check, RotateCcw, Keyboard,
  Sparkles, Volume2, VolumeX, MapPin,
} from 'lucide-react';
import { apiUrl } from '../../config/url';
import { useTranslation } from '../../i18n';
import { batch2, fill } from '../../i18n/keys_batch2';
import DraggableSparkleMascot from '../mascot/DraggableSparkleMascot';
import LineItemEditor, { toLines, fromLines, linesTotal } from '../transactions/LineItemEditor';
import { speak, isMuted, setMuted, summaryFor } from '../../utils/mascotVoice';

const SpeechRecognitionCtor =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

export const isVoiceSupported = () => Boolean(SpeechRecognitionCtor);

const VOICE_LANG = 'id-ID';

export const VoiceTransactionModal = ({ isOpen, onClose, onSave, onReview }) => {
  const { language } = useTranslation();
  const K = batch2[language]?.voice || batch2.id.voice;

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
    location: '',
    account_id: '',
  });
  const [lines, setLines] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [magicWorking, setMagicWorking] = useState(false);
  const [magicMessage, setMagicMessage] = useState('');
  const [celebrate, setCelebrate] = useState(0);
  const [muted, setMutedState] = useState(isMuted());

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
      location: '',
      account_id: '',
    });
    setLines([]);
    setMagicMessage('');
    finalTextRef.current = '';
  }, []);

  useEffect(() => {
    if (isOpen) {
      reset();
      loadAccounts();
    }
    return () => {
      stopListening();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const loadAccounts = async () => {
    try {
      const api = (await import('../../services/api')).default;
      const list = await api.accounts.list();
      setAccounts(Array.isArray(list) ? list : []);
    } catch (err) {
      console.warn('Could not load the accounts:', err?.message || err);
    }
  };

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

  /**
   * Put the reading into the form.
   */
  const applyParsed = useCallback((data, clean) => {
    setParsed(data);
    const itemLines = toLines(data.items);
    setLines(itemLines);
    setForm({
      amount: data.amount != null ? String(data.amount) : '',
      merchant_name: data.merchant_name || '',
      category: data.category || '',
      transaction_type: data.transaction_type || 'expense',
      description: data.description || clean,
      location: data.location || '',
      account_id: data.account_id || '',
    });
  }, []);

  const parseText = useCallback(async (text) => {
    const clean = (text || '').trim();
    if (!clean) {
      setError(K.err_no_voice);
      return;
    }
    setParsing(true);
    setError('');
    setMagicMessage('');
    try {
      // The token is sent so the server knows which reader the
      // parsed transaction belongs to. Without it the endpoint is
      // refused, because a parsed transaction is written to somebody.
      const token = localStorage.getItem('token') || localStorage.getItem('sb_token');
      const response = await fetch(apiUrl('voice/parse'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ text: clean }),
      });

      if (!response.ok) {
        throw new Error(`Server error ${response.status}`);
      }
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error(K.err_not_json);
      }

      const data = await response.json();
      applyParsed(data, clean);
      // The companion says what it heard.
      speak(summaryFor({ ...data, total_amount: data.amount }), { language });
    } catch (err) {
      console.error('Voice parse failed:', err);
      setError(fill(K.err_process, err?.message || err));
    } finally {
      setParsing(false);
    }
  }, [K, applyParsed, language]);

  const startListening = useCallback(() => {
    if (!SpeechRecognitionCtor) {
      setError(K.err_unsupported);
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
        'not-allowed': K.err_mic_denied,
        'service-not-allowed': K.err_service,
        'no-speech': K.err_no_speech,
        'audio-capture': K.err_no_mic,
        network: K.err_network,
        aborted: K.err_aborted,
      };
      setError(messages[event.error] || fill(K.err_generic, event.error));
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
      setError(K.err_start);
    }
  }, [parseText, K]);

  /**
   * Ask the companion to put the reading right.
   */
  const handleAskMascot = async () => {
    if (!parsed) return;
    setMagicWorking(true);
    setMagicMessage('');
    setCelebrate((n) => n + 1);

    try {
      const clean = (recognized || manualText || parsed.raw_text || '').trim();
      const before = parsed;
      await parseText(clean);
      const said = describeVoiceFixes(parsed, before, K);
      setMagicMessage(said);
      speak(said, { language });
    } catch (err) {
      console.error('The mascot could not read the phrase:', err);
      setMagicMessage(K.magic_fixed_nothing);
    } finally {
      setMagicWorking(false);
    }
  };

  const total = useMemo(
    () => (lines.length ? linesTotal(lines) : Number(form.amount) || 0),
    [lines, form.amount]
  );

  const handleSave = async () => {
    if (!parsed) return;
    if (!total || total <= 0) {
      setError(K.err_amount_required);
      return;
    }
    setError('');
    setSaved(true);
    try {
      const accountId = form.account_id || (accounts[0] && accounts[0].id);
      const payload = {
        amount: total,
        merchant_name: form.merchant_name || null,
        category: form.category || null,
        transaction_type: form.transaction_type,
        description: form.description || recognized || manualText,
        location: form.location || null,
        account_id: accountId ? parseInt(accountId, 10) : undefined,
        items: fromLines(lines),
      };

      // When the reader wants to look at what was heard before it is
      // saved, the reading is handed over instead of being written
      // down. What was heard is a guess, and a guess that was heard
      // aloud deserves the same review as a guess that was read off
      // a photograph.
      if (onReview) {
        onReview(payload);
        onClose();
        return;
      }
      await onSave(payload);
      speak(summaryFor({ ...parsed, total_amount: total }, { saved: true }), { language });
      onClose();
    } catch (err) {
      console.error('Voice transaction save failed:', err);
      setSaved(false);
      setError(fill(K.err_save, err?.message || err));
    }
  };

  const handleClose = () => {
    stopListening();
    onClose();
  };

  const toggleMute = () => {
    const next = setMuted(!muted);
    setMutedState(next);
  };

  const supported = isVoiceSupported();
  // The text that will actually be sent to the parser.
  const effectiveText = recognized.trim() || manualText.trim();

  const itemLabels = {
    title: K.items_label,
    add: K.add_item,
    empty: K.no_items,
    name: K.item_name,
    qty: K.item_qty,
    price: K.item_price,
    remove: K.remove_item,
    total: K.items_total,
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={K.title} size="md">
      <div className="space-y-4">
        {/* The companion, and the button that listens. */}
        <div className="relative flex flex-col items-center justify-center py-4">
          {/* The listening pulse. The waves spread out from the button
              while it is listening, so the reader can see that the
              microphone is open without watching it. */}
          {listening && (
            <>
              <span
                className="absolute w-20 h-20 rounded-full border-2 border-red-400/60 animate-ping pointer-events-none"
                aria-hidden="true"
              />
              <span
                className="absolute w-28 h-28 rounded-full border-2 border-red-300/40 animate-ping [animation-delay:0.3s] pointer-events-none"
                aria-hidden="true"
              />
            </>
          )}

          <div className="absolute left-0 bottom-0 z-10">
            <DraggableSparkleMascot
              persona="koneko"
              mood={listening ? 'alert' : parsed ? 'happy' : 'idle'}
              size={88}
              hint={K.magic_button}
              celebrateSignal={celebrate}
            />
          </div>

          <button
            onClick={listening ? stopListening : startListening}
            disabled={parsing}
            className={`w-20 h-20 rounded-full flex items-center justify-center transition-colors relative z-20 ${
              listening
                ? 'bg-red-600 text-white animate-pulse shadow-lg shadow-red-600/50'
                : 'bg-primary-600 text-white hover:bg-primary-600 shadow-lg shadow-primary-500/30'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            aria-label={listening ? K.aria_stop : K.aria_start}
          >
            {parsing ? (
              <Loader2 className="w-9 h-9 animate-spin" />
            ) : (
              <Mic className="w-9 h-9" />
            )}
          </button>
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
            {listening ? K.listening : parsing ? K.processing : K.press_mic}
          </p>

          {/* The mute. The companion is not silent unless the reader
              says so. */}
          <button
            type="button"
            onClick={toggleMute}
            aria-label={muted ? K.mute_off : K.mute_on}
            title={muted ? K.mute_off : K.mute_on}
            className="absolute right-0 bottom-0 p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>

        {!supported && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
            {K.unsupported_banner}
          </div>
        )}

        {/* Recognised speech - read only, never overwritten by the manual field */}
        {recognized && (
          <div className="p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{K.heard}</p>
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
              {K.transaction_text}
            </span>
          </label>
          <div className="flex gap-2">
            <Input
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder={K.ph_example}
              onKeyDown={(e) => {
                if (e.key === 'Enter') parseText(manualText);
              }}
            />
            <Button
              variant="secondary"
              onClick={() => parseText(manualText)}
              disabled={parsing || !manualText.trim()}
            >
              {K.parse}
            </Button>
          </div>
          {recognized && manualText.trim() && (
            <p className="text-xs text-gray-400 mt-1">{K.manual_hint}</p>
          )}
        </div>

        {/* Parsed result - editable before saving */}
        {parsed && (
          <div className="space-y-3 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-green-800 font-medium text-sm">
                <Check className="w-4 h-4" />
                {fill(K.success, (parsed.confidence_score * 100).toFixed(0))}
              </div>
              <button
                type="button"
                onClick={handleAskMascot}
                disabled={magicWorking}
                className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-green-300 text-green-800 hover:bg-green-100 disabled:opacity-60"
              >
                {magicWorking ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                {K.magic_button}
              </button>
            </div>

            {magicMessage && (
              <div className="rounded-lg bg-white border border-green-200 p-3 text-sm text-gray-700">
                <span className="font-medium text-gray-900">{K.magic_said}</span>{' '}
                {magicMessage}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">{K.amount}</label>
                <Input
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">{K.type}</label>
                <select
                  value={form.transaction_type}
                  onChange={(e) => setForm({ ...form, transaction_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="expense">{K.expense}</option>
                  <option value="income">{K.income}</option>
                  <option value="transfer">{K.type_transfer || 'Transfer'}</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1">{K.merchant_source}</label>
              <Input
                value={form.merchant_name}
                onChange={(e) => setForm({ ...form, merchant_name: e.target.value })}
                placeholder={K.ph_merchant}
              />
            </div>

            {/* The place. It is where it happened, not the name of the
                shop, so it has a field of its own. */}
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {K.location_label}
                </span>
              </label>
              <Input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder={K.ph_location || ''}
              />
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1">{K.category}</label>
              <Input
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder={K.ph_category}
              />
            </div>

            {/* The account. It is filled in when the phrase named one
                that matches an account the reader has. */}
            <div>
              <label className="block text-xs text-gray-600 mb-1">{K.account_label}</label>
              <select
                value={form.account_id || ''}
                onChange={(e) => setForm({ ...form, account_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="">{K.choose_account || K.account_label}</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1">{K.note}</label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder={K.ph_note}
              />
            </div>

            {/* The lines of the bill. */}
            <div className="rounded-lg bg-white border border-green-200 p-3">
              <LineItemEditor
                lines={lines}
                onChange={setLines}
                labels={itemLabels}
                fallbackTotal={Number(form.amount) || 0}
              />
            </div>

            {parsed.missing_fields?.length > 0 && (
              <p className="text-xs text-amber-700">
                {fill(K.missing_fields, parsed.missing_fields.join(', '))}
              </p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 flex-wrap">
          {parsed && (
            <Button variant="outline" onClick={() => setParsed(null)}>
              <RotateCcw className="w-4 h-4 mr-1" />
              {K.retry}
            </Button>
          )}
          {listening && (
            <Button variant="outline" onClick={stopListening}>
              <X className="w-4 h-4 mr-1" />
              {K.stop}
            </Button>
          )}
          {parsed && (
            <Button onClick={handleSave} disabled={saved}>
              {saved ? K.saved : K.save}
            </Button>
          )}
          <Button variant="secondary" onClick={handleClose}>
            {K.cancel}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

/**
 * What the companion did, said in words the reader can read.
 */
export const describeVoiceFixes = (after, before, K) => {
  const parts = [];
  const fixes = after?.fixes || [];

  for (const fix of fixes) {
    const [kind, value] = fix.split(':');
    if (kind === 'category' && value) {
      parts.push(K.magic_fixed_category.replace('%s', value));
    } else if (kind === 'account' && value) {
      parts.push(K.magic_fixed_account.replace('%s', value));
    } else if (kind === 'total_from_items' || kind === 'total_recalculated') {
      parts.push(K.magic_fixed_total);
    }
  }

  if (!parts.length && after?.category && !before?.category) {
    parts.push(K.magic_fixed_category.replace('%s', after.category));
  }
  if (!parts.length && after?.account_id && !before?.account_id) {
    parts.push(K.magic_fixed_account.replace('%s', after.account_hint || ''));
  }

  if (!parts.length) return K.magic_fixed_nothing;
  return parts.join(', ') + '.';
};

export default VoiceTransactionModal;
