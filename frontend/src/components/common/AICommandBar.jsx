/**
 * The command bar.
 *
 * The assistant used to be a window in the bottom left of the screen.
 * It sat on top of the cards the reader came to read: the review of
 * the last transactions, the goals, the balance. A reader who wanted
 * to look at their money had to look past a chat window to do it.
 *
 * So it is a bar at the top of the page now. It never covers a card,
 * and it does three jobs at once, because a reader who opens the
 * application usually wants one of three things:
 *
 *   - to record something they just bought, which is one line:
 *     "kopi jago 15rb"
 *   - to ask something about their money, which is a question
 *   - to go somewhere, which is a name
 *
 * The bar cannot tell these apart perfectly, so it tries the cheapest
 * reading first and the most expensive last: a line that reads as a
 * transaction is recorded straight away, a line that reads as a page
 * name takes the reader there, and anything else is a question for
 * the agent.
 *
 * Nothing here is decided by guesswork alone. The server has the
 * reader's accounts and categories, so the bar asks the server what a
 * line means before it acts on it, and it never records a
 * transaction without saying so first.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, CornerDownLeft, Mic, MicOff, Loader2, X, Command } from 'lucide-react';

import { api } from '../../services/api';
import { useTranslation } from '../../i18n';
import FinBuddyMascot from './FinBuddyMascot';

/**
 * The pages the reader can ask for by name.
 *
 * The bar is a way into the application as well as a way of asking
 * it something, so a reader who types "peta" goes to the map rather
 * than getting a paragraph about maps.
 */
const PAGE_SHORTCUTS = [
  { match: ['peta', 'map', 'lokasi'], to: '/map' },
  { match: ['transaksi', 'transactions', 'riwayat'], to: '/transactions' },
  { match: ['belanja', 'shopping', 'shopping list'], to: '/shopping' },
  { match: ['budget', 'anggaran'], to: '/budgets' },
  { match: ['tujuan', 'goals', 'target'], to: '/goals' },
  { match: ['utang', 'debt'], to: '/debts' },
  { match: ['kesehatan', 'health', 'health coach'], to: '/health-coach' },
  { match: ['pengaturan', 'settings'], to: '/settings' },
  { match: ['tambah', 'add', 'catat'], to: '/add' },
];

const norm = (text) =>
  String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Does this line read as a transaction?
 *
 * "kopi jago 15rb" is one. "berapa saldo saya" is not. The test is
 * the presence of a figure, and the absence of a question.
 */
function readsAsTransaction(text) {
  const t = norm(text);
  if (!t) return false;
  if (/\?$/.test(t.trim())) return false;
  const questionWords = ['berapa', 'berapa', 'how much', 'what is', 'apakah', 'bisakah', 'why', 'kenapa', 'jelaskan'];
  if (questionWords.some((w) => t.startsWith(w))) return false;
  // A figure, in any of the ways a person writes one.
  return /\b\d[\d.,]*\s*(rb|ribu|jt|juta|k|m|ribuan|jutaan)?\b|\d+(?:[.,]\d+)*/.test(t);
}

/**
 * Which page does this line name, if any?
 */
function pageFor(text) {
  const t = norm(text);
  if (!t || t.split(' ').length > 3) return null;
  for (const shortcut of PAGE_SHORTCUTS) {
    if (shortcut.match.some((word) => t === word || t.includes(word))) {
      return shortcut.to;
    }
  }
  return null;
}

export default function AICommandBar({ userData = {} }) {
  const { t, language } = useTranslation();
  const navigate = useNavigate();

  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [open, setOpen] = useState(false);

  const inputRef = useRef(null);
  const recognitionRef = useRef(null);

  // The words of the bar, in the language the reader is reading in.
  const label = t('ai_assistant.command_bar_label');
  const placeholder = t('ai_assistant.command_bar_placeholder');
  const thinking = t('ai_assistant.command_bar_thinking');
  const listening = t('ai_assistant.command_bar_listening');
  const recorded = t('ai_assistant.command_bar_recorded');
  const failed = t('ai_assistant.command_bar_failed');

  // The voice, when the browser has it.
  useEffect(() => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) return undefined;
    setVoiceSupported(true);
    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = language === 'id' ? 'id-ID' : language === 'ja' ? 'ja-JP' : 'en-US';
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join('');
      setText(transcript);
      setIsListening(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    return () => {
      try {
        recognition.stop();
      } catch (err) {
        /* it was never started */
      }
    };
  }, [language]);

  /**
   * Record the transaction the reader wrote.
   *
   * The server is asked to work out what the line means and to record
   * it, so the bar and the rest of the application always agree about
   * what "kopi jago 15rb" is. The bar never guesses a category and
   * never guesses an account on its own.
   */
  const recordTransaction = useCallback(async (line) => {
    const answer = await api.ai.agent(line, false, []);
    if (!answer || !answer.success) {
      throw new Error('the agent could not record it');
    }
    if (answer.intent === 'unknown') {
      throw new Error('the agent did not understand it');
    }
    return answer;
  }, []);

  /**
   * Ask the agent a question, and show the answer in the bar.
   */
  const askTheAgent = useCallback(async (line) => {
    const result = await api.ai.agent(line, false, []);
    if (result && result.reply) return result.reply;
    if (result && result.message) return result.message;
    return '';
  }, []);

  const submit = useCallback(async () => {
    const line = (text || '').trim();
    if (!line || busy) return;

    setBusy(true);
    setError('');
    setAnswer('');

    try {
      // The cheapest reading first: is it a page the reader wants?
      const page = pageFor(line);
      if (page) {
        navigate(page);
        setText('');
        setOpen(false);
        return;
      }

      // Then: is it a transaction to record?
      if (readsAsTransaction(line)) {
        try {
          const result = await recordTransaction(line);
          const reply = result.reply || result.message || '';
          setAnswer(reply || recorded);
          setText('');
          window.dispatchEvent(new Event('transactionUpdated'));
          return;
        } catch (err) {
          // It might still have been a question that happened to have
          // a number in it. The agent is asked again as a question
          // before the reader is told it failed.
          const reply = await askTheAgent(line).catch(() => '');
          if (reply) {
            setAnswer(reply);
            setText('');
            return;
          }
          setError(failed);
          return;
        }
      }

      // Otherwise it is a question.
      const reply = await askTheAgent(line);
      setAnswer(reply);
      setText('');
    } catch (err) {
      setError(failed);
    } finally {
      setBusy(false);
    }
  }, [text, busy, navigate, recordTransaction, askTheAgent, recorded, failed]);

  const onKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  const toggleVoice = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        setIsListening(false);
      }
    }
  };

  return (
    <div
      className="sticky top-0 z-40 -mx-4 sm:-mx-6 px-4 sm:px-6 pt-3 pb-2 bg-white/90 dark:bg-gray-900/90 backdrop-blur border-b border-gray-100 dark:border-white/10"
      aria-label={label}
    >
      <div className="flex items-center gap-2">
        {/* The mascot, in the corner of the bar. */}
        <span className="hidden sm:flex shrink-0 -ml-1">
          <FinBuddyMascot mood="idle" size={32} />
        </span>

        <div className="flex-1 min-w-0 relative">
          <div className="flex items-center gap-2 rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-800 px-3 py-2 focus-within:border-primary-400 dark:focus-within:border-primary-500 transition-colors">
            <Sparkles className="w-4 h-4 text-primary-500 shrink-0" aria-hidden="true" />
            <input
              ref={inputRef}
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKeyDown}
              onFocus={() => setOpen(true)}
              placeholder={placeholder}
              aria-label={placeholder}
              className="flex-1 min-w-0 bg-transparent outline-none text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400"
            />
            {voiceSupported ? (
              <button
                type="button"
                onClick={toggleVoice}
                title={isListening ? listening : label}
                aria-label={isListening ? listening : label}
                className="shrink-0 p-1 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors"
              >
                {isListening ? (
                  <MicOff className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <Mic className="w-4 h-4" aria-hidden="true" />
                )}
              </button>
            ) : null}
            <button
              type="button"
              onClick={submit}
              disabled={busy || !text.trim()}
              title={label}
              aria-label={label}
              className="shrink-0 p-1 rounded-lg text-gray-400 hover:text-primary-600 disabled:opacity-40 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors"
            >
              {busy ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              ) : (
                <CornerDownLeft className="w-4 h-4" aria-hidden="true" />
              )}
            </button>
          </div>

          {/* The answer, under the bar. It takes the place of the
              window that used to cover the page. */}
          {open && (answer || error) ? (
            <div className="absolute left-0 right-0 top-full mt-2 rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-800 shadow-lg p-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <p className="text-gray-700 dark:text-gray-200 leading-relaxed min-w-0">
                  {error || answer}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setAnswer('');
                    setError('');
                    setOpen(false);
                  }}
                  aria-label="close"
                  className="shrink-0 p-0.5 rounded text-gray-400 hover:text-gray-700"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {/* The mark of the bar, so it reads as a tool and not as
            another card on the page. */}
        <span
          className="hidden sm:flex shrink-0 items-center gap-1 text-[10px] uppercase tracking-widest text-gray-400"
          aria-hidden="true"
        >
          <Command className="w-3 h-3" />
          {busy ? thinking : ''}
        </span>
      </div>
    </div>
  );
}
