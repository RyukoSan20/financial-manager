/**
 * The AI Market Co-Pilot.
 *
 * A reader who is looking at a market page is usually thinking about
 * one thing: what should I do with this money? The tables and the
 * charts tell them what is happening. This tells them what it means.
 *
 * The answers are written by a language model, but they never carry a
 * price. Every number in the answer was read out of a quote by the
 * server, and the server says which quote it came from. The answer
 * carries its source, and the source is shown to the reader: words
 * that came out of the market data are marked as such, and words
 * that did not are marked as the model's opinion.
 *
 * That distinction is the whole point. A reader who is about to put
 * money into something deserves to know which of the two they are
 * reading.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Send, Sparkles, Loader2, AlertCircle, Database, Cpu } from 'lucide-react';

import api from '../../services/api';
import MarkdownText from '../common/MarkdownText';
import { useTranslation } from '../../i18n';
import { batch12 } from '../../i18n/keys_batch12';

const SOURCE_MARKET = 'market_data';
const SOURCE_MODEL = 'model';

/**
 * The values of a key point that the label does not already carry.
 *
 * A point whose label is "There is no data for {symbol} yet" has one
 * value, the symbol, and the label says it. Showing it again on the
 * line below would say it twice.
 */
function remainingValues(point) {
  const values = point?.values || {};
  const names = Object.keys(values);
  if (names.length === 0) return [];
  // The label that was written decides which values it used. The
  // point does not carry the label, so the check is for the shape of
  // the values: a point with a single value is a point whose label
  // carries that value.
  if (names.length === 1) return [];
  return names.map((name) => values[name]).filter((value) => value !== undefined && value !== null);
}

export default function AiMarketAdvisorChat({ symbols = [], onChartPoints }) {
  const { language, t } = useTranslation();
  const K = batch12[language]?.advisor || batch12.id.advisor;

  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([]);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState(null);
  const [suggestions, setSuggestions] = useState([]);

  const endRef = useRef(null);

  // The server has a set of questions it can answer well, and they
  // are offered so the reader does not have to guess what to type.
  useEffect(() => {
    let cancelled = false;
    api.get('/market-advisor/context')
      .then((context) => {
        if (cancelled) return;
        setSuggestions((context?.suggestions || []).slice(0, 4));
      })
      .catch(() => {
        // The suggestions are a help, not a feature. If they cannot
        // be fetched, the box still works.
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  const ask = useCallback(async (text) => {
    const asked = (text || '').trim();
    if (!asked || asking) return;

    setError(null);
    setAsking(true);
    setMessages((current) => [...current, { role: 'reader', text: asked }]);
    setQuestion('');

    try {
      const result = await api.post('/market-advisor/ask', {
        question: asked,
        symbols: symbols.length ? symbols : undefined,
        language,
      });

      setMessages((current) => [
        ...current,
        {
          role: 'advisor',
          text: result?.answer || '',
          source: result?.source || SOURCE_MARKET,
          keyPoints: result?.key_points || [],
        },
      ]);

      // The numbers the answer is built on are handed to the chart,
      // so the picture and the words are about the same thing.
      if (result?.chart_points?.length && onChartPoints) {
        onChartPoints(result.chart_points);
      }
    } catch (err) {
      setError(err?.message || K.askFailed);
      setMessages((current) => current.filter((m) => m.role !== 'reader' || m.text !== asked));
    } finally {
      setAsking(false);
    }
  }, [asking, symbols, language, onChartPoints, K.askFailed]);

  return (
    <div className="rounded-2xl border border-gray-200/70 dark:border-gray-700/70 bg-white/75 dark:bg-gray-900/75 backdrop-blur-md shadow-sm">
      {/* The head of the box. */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 dark:border-gray-700/60">
        <span className="grid place-items-center h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm">
          <Sparkles size={17} />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">{K.title}</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{K.subtitle}</p>
        </div>
      </div>

      {/* The conversation. */}
      <div className="px-5 py-4 space-y-3 max-h-[360px] overflow-y-auto">
        {messages.length === 0 && (
          <div className="text-center py-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">{K.empty}</p>
          </div>
        )}

        {messages.map((message, index) => (
          <div key={index} className="flex flex-col gap-1">
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                message.role === 'reader'
                  ? 'self-end bg-emerald-600 text-white rounded-br-md'
                  : 'self-start bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-bl-md'
              }`}
            >
              {message.role === 'reader' ? (
                message.text
              ) : (
                <MarkdownText text={message.text} />
              )}
            </div>

            {/* Where the words came from. */}
            {message.role === 'advisor' && message.source && (
              <span
                className={`self-start inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full ${
                  message.source === SOURCE_MODEL
                    ? 'bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-300'
                    : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                }`}
              >
                {message.source === SOURCE_MODEL ? <Cpu size={11} /> : <Database size={11} />}
                {message.source === SOURCE_MODEL ? K.source_model : K.source_market}
              </span>
            )}

            {/* The numbers the answer stands on. */}
            {message.keyPoints?.length > 0 && (
              <div className="self-start grid gap-1.5 w-full sm:grid-cols-2 mt-1">
                {message.keyPoints.map((point, pointIndex) => (
                  <div
                    key={pointIndex}
                    className="rounded-xl border border-gray-100 dark:border-gray-700 bg-white/60 dark:bg-gray-800/50 px-3 py-2"
                  >
                    {/* The label is translated. The server sends the
                        key, and drawing it raw put
                        "MARKET_ADVISOR.POINT.PRICE" on the screen
                        where a reader should have seen what the
                        number is.

                        The values that the label itself uses are
                        filled into it, and are not repeated on the
                        line below. */}
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                      {t(point.key, '', point.values)}
                    </p>
                    {remainingValues(point).length > 0 && (
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mt-0.5">
                        {remainingValues(point).join(' · ')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {asking && (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Loader2 size={15} className="animate-spin" />
            {K.thinking}
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 px-3 py-2 text-sm text-red-700 dark:text-red-300">
            <AlertCircle size={15} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* The suggestions, and the box to type in. */}
      {suggestions.length > 0 && messages.length === 0 && (
        <div className="px-5 pb-3 flex flex-wrap gap-1.5">
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              type="button"
              onClick={() => ask(suggestion)}
              className="text-xs px-2.5 py-1 rounded-full border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      <div className="px-5 pb-5">
        <div className="flex items-end gap-2">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                ask(question);
              }
            }}
            rows={1}
            placeholder={K.placeholder}
            className="flex-1 resize-none px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-emerald-500/40 outline-none"
          />
          <button
            type="button"
            onClick={() => ask(question)}
            disabled={asking || !question.trim()}
            className="grid place-items-center h-10 w-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-40 shrink-0"
            aria-label={K.send}
          >
            {asking ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
          </button>
        </div>
        <p className="mt-2 text-[11px] text-gray-400">{K.disclaimer}</p>
      </div>
    </div>
  );
}
