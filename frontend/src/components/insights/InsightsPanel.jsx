/**
 * What the records already say.
 *
 * Four things the server works out from the reader's own records:
 *
 * - a bill that was paid twice,
 * - a subscription that was never set up,
 * - the balance on each day of the coming month,
 * - what was bought last month and has not bought this month.
 *
 * The screen shows them and does nothing else. It does not delete
 * anything, and it does not create a rule: both of those are the
 * reader's call, and they are made in the place where they belong.
 *
 * Behind the polish switch, so a reader who has not asked for it sees
 * exactly what they saw before.
 */

import React, { useEffect, useState } from 'react';
import { useTranslation } from '../../i18n';
import { api } from '../../services/api';
import { batch7, fill } from '../../i18n/keys_batch7';
import { buildFlag } from '../../utils/featureFlags';
import { formatCurrency } from '../../utils/currency';
import { AlertTriangle, CalendarDays, Repeat, ShoppingCart } from 'lucide-react';

export default function InsightsPanel() {
  const { language } = useTranslation();
  const polished = buildFlag('UI_POLISH');

  const K = batch7[language] || batch7.id;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!polished) return undefined;

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setFailed(false);
      try {
        // The four answers are asked for together. The server works
        // them out from the same records, so asking together costs
        // the same as asking one at a time.
        const [duplicates, subscriptions, calendar, shopping] = await Promise.all([
          api.get('/insights/duplicates').catch(() => ({ duplicates: [] })),
          api.get('/insights/subscriptions').catch(() => ({ subscriptions: [] })),
          api.get('/insights/balance-calendar?days=30').catch(() => ({ calendar: [] })),
          api.get('/insights/shopping-suggestion').catch(() => ({ suggestions: [] })),
        ]);

        if (cancelled) return;
        setData({
          duplicates: duplicates.duplicates || [],
          subscriptions: subscriptions.subscriptions || [],
          calendar: calendar.calendar || [],
          shopping: shopping.suggestions || [],
        });
      } catch (err) {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [polished]);

  // The switch is off: the page is exactly as it was.
  if (!polished) return null;

  const money = (amount, currency) => {
    if (amount === null || amount === undefined) return '-';
    try {
      return formatCurrency(amount, currency || 'IDR');
    } catch (err) {
      return `${currency || 'IDR'} ${Number(amount).toLocaleString()}`;
    }
  };

  const findings = [
    ...(data?.duplicates || []),
    ...(data?.subscriptions || []),
    ...(data?.shopping || []),
  ];

  return (
    <section className="insights-panel" data-ui="polish">
      <header className="insights-panel__header">
        <h2>{K.insights_title}</h2>
        <p>{K.insights_subtitle}</p>
      </header>

      {loading && <p className="insights-panel__status">{K.insights_loading}</p>}

      {failed && <p className="insights-panel__status">{K.insights_none}</p>}

      {!loading && !failed && data && (
        <>
          {findings.length === 0 && (
            <p className="insights-panel__status">{K.insights_none}</p>
          )}

          {/* A bill that was paid twice. */}
          {data.duplicates.length > 0 && (
            <div className="insight-card">
              <h3>
                <AlertTriangle size={18} aria-hidden="true" />
                {K.duplicate_title}
              </h3>
              <p className="insight-card__desc">{K.duplicate_desc}</p>
              <ul className="insight-list">
                {data.duplicates.map((item, index) => (
                  <li key={`dup-${index}`} className="insight-item">
                    <div className="insight-item__main">
                      <strong>{money(item.amount, item.currency)}</strong>
                      <span>
                        {item.confidence === 'high'
                          ? K.duplicate_high
                          : K.duplicate_medium}
                        {' · '}
                        {item.days_apart === 0
                          ? K.duplicate_same_day
                          : fill(K.duplicate_days_apart, item.days_apart)}
                      </span>
                    </div>
                    {item.transactions?.length > 0 && (
                      <ul className="insight-sublist">
                        {item.transactions.map((tx) => (
                          <li key={tx.id}>
                            <span>{tx.date}</span>
                            <span>{tx.description || tx.merchant_name}</span>
                            <span>{money(item.amount, item.currency)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* A subscription that was never set up. */}
          {data.subscriptions.length > 0 && (
            <div className="insight-card">
              <h3>
                <Repeat size={18} aria-hidden="true" />
                {K.subscription_title}
              </h3>
              <p className="insight-card__desc">{K.subscription_desc}</p>
              <ul className="insight-list">
                {data.subscriptions.map((item, index) => (
                  <li key={`sub-${index}`} className="insight-item">
                    <div className="insight-item__main">
                      <strong>{item.merchant}</strong>
                      <span>
                        {money(item.amount, item.currency)}
                        {' · '}
                        {fill(K.subscription_months, item.months_found)}
                      </span>
                    </div>
                    <span className="insight-item__aside">
                      {fill(K.subscription_total, money(item.total_paid, item.currency))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* What to buy this month. */}
          {data.shopping.length > 0 && (
            <div className="insight-card">
              <h3>
                <ShoppingCart size={18} aria-hidden="true" />
                {K.shopping_title}
              </h3>
              <p className="insight-card__desc">{K.shopping_desc}</p>
              <ul className="insight-list">
                {data.shopping.map((item, index) => (
                  <li key={`shop-${index}`} className="insight-item">
                    <div className="insight-item__main">
                      <strong>{item.merchant}</strong>
                      <span>
                        {K.shopping_estimate}: {money(item.estimated_amount, item.currency)}
                      </span>
                    </div>
                    <span className="insight-item__aside">
                      {fill(K.shopping_last_bought, item.last_bought)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* The balance ahead. */}
          {data.calendar.length > 0 && (
            <div className="insight-card">
              <h3>
                <CalendarDays size={18} aria-hidden="true" />
                {K.calendar_title}
              </h3>
              <p className="insight-card__desc">{K.calendar_desc}</p>
              <BalanceCalendar days={data.calendar} money={money} />
            </div>
          )}
        </>
      )}
    </section>
  );
}

/**
 * The balance on each day of the month ahead.
 *
 * The bar goes down on a day a bill comes due and up on a day money
 * comes in. Every day has a bar, so the shape of the month is what
 * the eye takes in first.
 */
function BalanceCalendar({ days, money }) {
  if (!days || days.length === 0) return null;

  const balances = days.map((d) => Number(d.balance) || 0);
  const highest = Math.max(...balances);
  const lowest = Math.min(...balances);
  const spread = highest - lowest || 1;

  return (
    <div className="insight-calendar">
      {days.map((day) => {
        const balance = Number(day.balance) || 0;
        // How far this day sits between the lowest and the highest.
        const height = 20 + ((balance - lowest) / spread) * 60;
        const hasEvents = (day.events || []).length > 0;

        return (
          <div
            key={day.date}
            className={`insight-calendar__day${hasEvents ? ' insight-calendar__day--event' : ''}`}
            title={`${day.date} · ${money(balance, 'IDR')}`}
          >
            <div
              className="insight-calendar__bar"
              style={{ height: `${height}%` }}
              aria-hidden="true"
            />
            <span className="insight-calendar__date">{day.date.slice(8)}</span>
            {hasEvents && (
              <ul className="insight-calendar__events">
                {day.events.map((event, e) => (
                  <li key={`${day.date}-${e}`}>
                    {event.kind === 'income' ? '+' : '−'}
                    {money(event.amount, event.currency)}
                    {event.description ? ` · ${event.description}` : ''}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
