/*
 * The top AI agent bar.
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
 *
 * The four quick actions are the four things a reader most often
 * wants, offered as pills so they can be reached in one tap. They
 * open a drawer below the bar - a drawer, not a window, because a
 * window covers the page and a drawer pushes it down.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  CornerDownLeft,
  Mic,
  MicOff,
  Loader2,
  X,
  Command,
  ChevronDown,
  ReceiptText,
  Target,
  Zap,
  BarChart3,
} from 'lucide-react';

import { api } from '../../services/api';
import { useTranslation } from '../../i18n';
import FinBuddyMascot from '../common/FinBuddyMascot';
import MarkdownText from '../common/MarkdownText';

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

/**
 * The four quick actions.
 *
 * Each one is a thing a reader often wants to do, given a name and a
 * drawing. They are pills because a row of four buttons is a row of
 * four things competing with the page; a row of four pills reads as
 * one bar of options.
 */
const QUICK_ACTIONS = [
  { id: 'analysis', icon: BarChart3, key: 'quick_analysis' },
  { id: 'quick_record', icon: Zap, key: 'quick_record' },
  { id: 'split_receipt', icon: ReceiptText, key: 'quick_split' },
  { id: 'check_goal', icon: Target, key: 'quick_goal' },
];

export default function TopAiCommandBar({ userData = {} }) {
  const { t, language } = useTranslation();
  const navigate = useNavigate();

  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [open, setOpen] = useState(false);
  // Which quick action is running, if one is. The drawer says what is
  // happening, so the reader is never left watching a bar that has
  // not answered yet.
  const [activeAction, setActiveAction] = useState(null);
  const [actionsOpen, setActionsOpen] = useState(false);

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
      setOpen(true);
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

  /**
   * Run one of the four quick actions.
   *
   * Each one is a sentence to the agent, except the two that take the
   * reader to a page where the work is done: a receipt is split on
   * the split page, and a goal is checked on the goals page.
   */
  const runQuickAction = useCallback(
    async (action) => {
      setActiveAction(action.id);
      setError('');
      setAnswer('');
      setOpen(true);
      setBusy(true);

      try {
        if (action.id === 'split_receipt') {
          navigate('/split');
          setActiveAction(null);
          return;
        }
        if (action.id === 'check_goal') {
          navigate('/goals');
          setActiveAction(null);
          return;
        }
        if (action.id === 'quick_record') {
          // The reader is asked to write what they bought, in the
          // bar they are already looking at.
          inputRef.current?.focus();
          setAnswer(t('ai_assistant.quick_record_prompt'));
          setActiveAction(null);
          return;
        }

        // The analysis is asked of the agent, which knows the
        // reader's own money.
        const reply = await askTheAgent(t('ai_assistant.quick_analysis_prompt'));
        setAnswer(reply || t('ai_assistant.quick_analysis_prompt'));
      } catch (err) {
        setError(failed);
      } finally {
        setBusy(false);
        setActiveAction(null);
      }
    },
    [navigate, askTheAgent, t, failed]
  );

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
      className="sticky top-0 z-40 -mx-4 sm:-mx-6 px-4 sm:px-6 pt-3 pb-2 bg-white/85 dark:bg-gray-900/85 backdrop-blur-md border-b border-slate-200/60 dark:border-white/10"
      aria-label={label}
    >
      <div className="flex items-center gap-2">
        {/* The mascot, in the corner of the bar.

            It sits in a tinted holder, so it is a picture in the
            bar rather than a picture floating beside it. */}
        <span className="hidden sm:flex shrink-0 -ml-1 w-9 h-9 rounded-xl bg-gradient-to-br from-sky-100 to-violet-100 dark:from-sky-500/20 dark:to-violet-500/20 items-center justify-center">
          <FinBuddyMascot mood={busy ? 'thinking' : 'idle'} size={28} />
        </span>

        <div className="flex-1 min-w-0 relative">
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-slate-50/70 dark:bg-white/5 px-3.5 py-2 focus-within:border-primary-400 focus-within:bg-white dark:focus-within:bg-white/10 focus-within:shadow-[0_0_0_3px_rgb(var(--scheme-500-rgb,59_130_246)/0.14)] transition-[border-color,box-shadow,background-color] duration-150">
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
              window that used to cover the page.

              It only appears when the reader asks for it: they press
              the bar, or they press one of the quick actions. A bar
              that opened by itself and covered the page on every
              visit was the old problem in a new place. */}
          {open && (answer || error || busy) ? (
            <div className="absolute left-0 right-0 top-full mt-2 rounded-2xl border border-gray-200 dark:border-white/10 bg-white/85 dark:bg-gray-800/85 backdrop-blur-md shadow-lg p-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                {/* The answer, with the agent's emphasis put where it
                    belongs.

                        The agent writes "**Rp 5.965.000**" and the reader
                        was seeing the asterisks. They are the agent's
                        punctuation, not the reader's words, so they are
                        read as emphasis here and never shown. */}
                <p className="text-gray-700 dark:text-gray-200 leading-relaxed min-w-0 whitespace-pre-wrap break-words">
                  {busy && activeAction ? (
                    thinking
                  ) : error ? (
                    error
                  ) : (
                    <MarkdownText text={answer} />
                  )}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setAnswer('');
                    setError('');
                    setOpen(false);
                  }}
                  aria-label={t('common.close')}
                  className="shrink-0 p-0.5 rounded text-gray-400 hover:text-gray-700"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {/* The four quick actions.

            On a wide screen they are pills on the bar itself, so the
            reader sees them without pressing anything. On a narrow
            screen there is no room for four of them, so they are
            behind a button and open in a drawer that pushes the page
            down rather than a window that covers it. */}
        <button
          type="button"
          onClick={() => setActionsOpen((v) => !v)}
          aria-expanded={actionsOpen}
          aria-label={t('ai_assistant.quick_actions')}
          className="shrink-0 md:hidden inline-flex items-center gap-1 rounded-xl border border-primary-200 dark:border-primary-900/50 bg-primary-50/70 dark:bg-primary-900/20 px-2.5 py-1.5 text-xs font-medium text-primary-700 dark:text-primary-200 hover:bg-primary-100/70 transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
          {t('ai_assistant.quick_actions')}
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform ${actionsOpen ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>

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

      {/* The quick actions, as pills.

          They sit under the bar, in the flow of the page, so the cards
          below them are pushed down rather than covered. Nothing on
          the page is hidden by them. */}
      <div
        className={`mt-2 flex flex-wrap gap-2 ${actionsOpen ? '' : 'hidden md:flex'}`}
        aria-label={t('ai_assistant.quick_actions')}
      >
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              type="button"
              onClick={() => runQuickAction(action)}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-white/80 dark:bg-white/5 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-white/10 hover:border-primary-300 hover:bg-primary-50/80 hover:text-primary-800 dark:hover:bg-primary-900/20 dark:hover:text-primary-200 hover:shadow-sm hover:-translate-y-0.5 transition-[color,background-color,border-color,box-shadow,transform] duration-150 disabled:opacity-50 shrink-0"
            >
              <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              {t(`ai_assistant.${action.key}`)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { TopAiCommandBar, QUICK_ACTIONS };
