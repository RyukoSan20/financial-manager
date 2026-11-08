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
import { useNavigate, Link } from 'react-router-dom';
import {
  Sparkles,
  CheckCircle2,
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
import { emitDataMutated } from '../../utils/dataSyncBus';

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
  // The transaction that was really written, if one was.
  //
  // The reply says what happened. This is the row the reader can go
  // and look at, and the badge under the reply is the proof that it
  // is there - because the reader was told their lunch was recorded
  // and it was not, and they had no way of telling.
  const [writtenTransaction, setWrittenTransaction] = useState(null);
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
          // The world is told, so every page that shows the
          // consequence of a transaction asks the server again.
          //
          // It is said only after the server confirmed the write,
          // and only when the server says a row was really written.
          // The bar is not allowed to announce a transaction it did
          // not record.
          if (result?.action_executed === 'transaction_created') {
            emitDataMutated('transaction', {
              id: result.transaction?.id,
              amount: result.transaction?.amount,
              type: result.transaction?.type,
            });
            setWrittenTransaction(result.transaction || null);
          } else {
            setWrittenTransaction(null);
          }
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
    /* The bar sits at the top of the page, in the flow of the page.

       It used to be `sticky top-0`, so it stayed with the reader as
       they scrolled and rode down over the cards below it. The
       cards it was covering moved underneath it, and the reader saw
       a bar sliding over their own finances.

       It is now `relative`, in the ordinary flow, at the very top of
       the dashboard. It does not move when the page scrolls, and it
       cannot cover anything, because everything after it is below
       it.

       The panels that open out of the bar - the quick actions and
       the answer - are positioned against this wrapper, so they open
       from the bar and not from the top of the screen. */
    <div
      className="relative z-20 mb-6"
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
            /* The answer.

               It used to float over the page on a half-transparent
               surface, so the "Beranda" header and the "Dasar |
               Lanjutan" buttons showed through it and the two ran
               into each other. A reader could not read the answer
               and could not read the page.

               Now it is in the flow of the page, so the content
               below it is pushed down rather than covered, and the
               surface is solid - there is nothing behind it to bleed
               through. */
            <div className="relative mt-2 mb-4 rounded-2xl border border-emerald-200 dark:border-emerald-500/25 bg-white dark:bg-slate-900 shadow-lg p-4 text-sm z-30">
              <div className="flex items-start justify-between gap-3">
                {/* The answer, with the agent's emphasis put where it
                    belongs.

                    The agent writes "**Rp 5.965.000**" and the reader
                    was seeing the asterisks. They are the agent's
                    punctuation, not the reader's words, so they are
                    read as emphasis here and never shown. */}
                <p className="text-gray-700 dark:text-gray-200 leading-relaxed min-w-0 whitespace-pre-wrap break-words flex-1">
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
                    setWrittenTransaction(null);
                    setOpen(false);
                  }}
                  aria-label={t('common.close')}
                  className="shrink-0 p-1 -m-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:text-gray-200 dark:hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>

              {/* The proof.

                  The reader was told their lunch was recorded and it
                  was not. This badge is the transaction itself - the
                  name, the figure, and a link to the list where it
                  is - so the reader can go and see it rather than
                  take the agent's word for it.

                  It is only drawn when the server said a row was
                  really written. */}
              {writtenTransaction ? (
                <Link
                  to="/transactions"
                  className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-200 text-xs font-medium hover:bg-emerald-100 dark:hover:bg-emerald-500/25 hover:border-emerald-300 transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 truncate">
                    {t('ai_assistant.saved_badge', 'Tersimpan di Transaksi')}:{' '}
                    <span className="font-semibold">
                      {writtenTransaction.description}
                    </span>{' '}
                    <span className="tabular-nums">
                      ({writtenTransaction.type === 'income' ? '+' : '-'}
                      Rp{Number(writtenTransaction.amount || 0).toLocaleString('id-ID')})
                    </span>
                  </span>
                  <span className="shrink-0 font-semibold underline underline-offset-2">
                    Lihat →
                  </span>
                </Link>
              ) : null}
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

          On a wide screen they sit under the bar, in the flow of the
          page, so the cards below them are pushed down rather than
          covered. Nothing on the page is hidden by them.

          On a narrow screen there is no room for four of them on the
          bar, so they open in a panel that hangs from the bar. It is
          positioned against this wrapper - `absolute top-full` - so
          it opens from the bar and not from the top of the screen,
          and it is above the cards below it while it is open. */}
      <div
        className={
          actionsOpen
            ? /* On a narrow screen the panel hangs from the bar:
                 `absolute top-full`, so it opens from the bar and
                 not from the top of the screen, and it is above the
                 cards below it while it is open. On a wide screen
                 it is in the ordinary flow, because there is room
                 for the pills on the bar itself. */
              'absolute top-full left-0 right-0 mt-2 z-30 flex flex-wrap gap-2 p-3 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-slate-900 shadow-lg md:static md:p-0 md:mt-2 md:border-0 md:bg-transparent md:shadow-none'
            : 'hidden md:flex md:flex-wrap md:gap-2'
        }
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
