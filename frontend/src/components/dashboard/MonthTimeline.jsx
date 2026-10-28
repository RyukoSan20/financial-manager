// The month timeline.
//
// The dashboard shows what happened this month as a list of days, so
// a reader can see how the month went rather than only the sum of
// it. Each day carries the money in, the money out, and the
// difference.
//
// The list comes from the server, which knows which transactions
// count and which are still waiting in the review queue.

import { useState, useEffect } from 'react';
import { useTranslation } from '../../i18n';
import { batch6 } from '../../i18n/keys_batch6';
import { api } from '../../services/api';
import { formatCurrency } from '../../utils/format';
import { amountSign, isIncoming } from '../../utils/transactionSign';
import { ChevronDown, ChevronRight, CalendarDays } from 'lucide-react';

export default function MonthTimeline() {
  const { language } = useTranslation();
  const K = batch6[language]?.a5 || batch6.id.a5;
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [openDay, setOpenDay] = useState(null);

  useEffect(() => {
    let alive = true;
    api
      .request('/dashboard/month-timeline')
      .then((res) => {
        if (alive) setData(res);
      })
      .catch(() => {
        if (alive) setError(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (error) return null;
  if (!data) return null;

  const days = data.days || [];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <CalendarDays className="w-4 h-4" />
          {K.timeline_title}
        </h3>
        {data.count > 0 && (
          <span className="text-xs text-gray-500">
            {K.timeline_count.replace('{count}', String(data.count))}
          </span>
        )}
      </div>

      {days.length === 0 ? (
        <p className="text-sm text-gray-500 py-4 text-center">{K.timeline_empty}</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 mb-3 text-center">
            <div>
              <p className="text-xs text-gray-500">{K.timeline_income}</p>
              <p className="text-sm font-semibold text-emerald-600">
                {formatCurrency(data.total_income, data.currency)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">{K.timeline_expense}</p>
              <p className="text-sm font-semibold text-rose-600">
                {formatCurrency(data.total_expense, data.currency)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">{K.timeline_net}</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                {formatCurrency(data.net, data.currency)}
              </p>
            </div>
          </div>

          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {days.map((day) => {
              const isOpen = openDay === day.date;
              return (
                <div key={day.date}>
                  <button
                    type="button"
                    onClick={() => setOpenDay(isOpen ? null : day.date)}
                    aria-expanded={isOpen}
                    className="w-full flex items-center gap-2 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded px-1"
                  >
                    {isOpen ? (
                      <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    )}
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {K.timeline_day.replace('{day}', String(day.day))}
                    </span>
                    <span className="ml-auto text-xs text-gray-500">
                      {day.count}
                    </span>
                    <span
                      className={`text-xs font-medium ${
                        day.net >= 0 ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {formatCurrency(day.net, data.currency)}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="pl-6 pr-1 pb-2 space-y-1">
                      {day.transactions.map((tx) => (
                        <div
                          key={tx.id}
                          className="flex items-center justify-between text-xs py-0.5"
                        >
                          <span className="text-gray-600 dark:text-gray-400 truncate">
                            {tx.description || tx.category || '—'}
                          </span>
                          <span
                            className={
                              isIncoming(tx.type)
                                ? 'text-emerald-600'
                                : 'text-rose-600'
                            }
                          >
                            {amountSign(tx.type)}
                            {formatCurrency(tx.amount, data.currency)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
