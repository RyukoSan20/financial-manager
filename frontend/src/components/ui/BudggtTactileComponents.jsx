/**
 * The pills and the pacing card.
 *
 * Two pieces that answer the hand:
 *
 * - `BudggtQuickPills` is a row of choices with one lit pill that
 *   slides to whichever was chosen;
 * - `BudggtPacingCard` is the month in three bars - needs, wants and
 *   savings - each with a tick where today is.
 *
 * The arithmetic is in `budggtPacing.js`. The movement is in
 * `styles/mascot-motion.css`: every transition there names what it
 * animates and runs for 280ms on the same curve, and the bars fill
 * over 750ms.
 */

import { useEffect, useRef, useState } from 'react';
import CountUpNumber from './CountUpNumber';
import {
  indicatorFor,
  pacingColor,
  pacingPercent,
  pacingTick,
  pacingTone,
  pacingWidth,
} from './budggtPacing.js';

/**
 * A row of pills with a sliding light.
 *
 * `items` is a list of `{ id, label, icon? }`.
 */
export function BudggtQuickPills({ items = [], activeId, onSelect, ariaLabel, className = '' }) {
  const track = useRef(null);
  const pills = useRef({});
  const [indicator, setIndicator] = useState({ x: 0, width: 0, visible: false });

  // Measure after the pills are drawn, and again when the row is
  // resized: the words are different widths in each language.
  useEffect(() => {
    const measure = () => {
      const boxes = items.map((item) => {
        const node = pills.current[item.id];
        return { id: item.id, left: node?.offsetLeft || 0, width: node?.offsetWidth || 0 };
      });
      setIndicator(indicatorFor(boxes, activeId));
    };
    measure();
    if (typeof ResizeObserver === 'undefined' || !track.current) return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(track.current);
    return () => observer.disconnect();
  }, [items, activeId]);

  return (
    <div
      ref={track}
      role="tablist"
      aria-label={ariaLabel}
      className={`tactile-pills ${className}`}
    >
      <span
        className="tactile-pill-indicator"
        aria-hidden="true"
        style={{
          width: `${indicator.width}px`,
          transform: `translateX(${indicator.x}px)`,
          opacity: indicator.visible ? 1 : 0,
        }}
      />
      {items.map((item) => (
        <button
          key={item.id}
          ref={(node) => {
            pills.current[item.id] = node;
          }}
          type="button"
          role="tab"
          aria-selected={item.id === activeId ? 'true' : 'false'}
          className="tactile-pill"
          onClick={() => onSelect?.(item.id)}
        >
          {item.icon ? <span aria-hidden="true">{item.icon}</span> : null}
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * The month in three bars.
 *
 * `rows` is a list of `{ id, label, spent, limit, color?, goodWhenFull?, note? }`.
 * `formatAmount` turns a number into money; `dayLabel` is the
 * "Hari 24 dari 31" line, already in the reader's language.
 */
export function BudggtPacingCard({
  monthLabel = '',
  dayLabel = '',
  currentDay = 0,
  totalDays = 0,
  rows = [],
  formatAmount = (n) => String(Math.round(n)),
  noLimitLabel = '',
  todayLabel = '',
  className = '',
}) {
  // The bars start at nothing and grow to their width, so the first
  // paint has them empty and the next one fills them.
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const tick = pacingTick(currentDay, totalDays);

  return (
    <section className={`hh-card p-5 sm:p-6 ${className}`} data-pacing-card>
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-base font-bold">{monthLabel}</h2>
        <p className="text-sm hh-muted tabular-nums">{dayLabel}</p>
      </header>

      <div className="mt-5 space-y-5">
        {rows.map((row) => {
          const tone = pacingTone({
            spent: row.spent,
            limit: row.limit,
            currentDay,
            totalDays,
            goodWhenFull: row.goodWhenFull,
          });
          const color = pacingColor(row, tone);
          const width = grown ? pacingWidth(row.spent, row.limit) : 0;
          const percent = Math.round(pacingPercent(row.spent, row.limit));

          return (
            <div key={row.id} data-pacing-row={row.id} data-tone={tone}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ background: color }}
                    aria-hidden="true"
                  />
                  {row.label}
                </span>
                <span className="text-sm tabular-nums">
                  <CountUpNumber value={row.spent || 0} format={formatAmount} />
                  <span className="hh-muted">
                    {' / '}
                    {tone === 'empty' ? noLimitLabel : formatAmount(row.limit || 0)}
                  </span>
                </span>
              </div>

              <div
                className="pacing-track mt-2"
                role="progressbar"
                aria-label={row.label}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.min(100, percent)}
              >
                <div
                  className={`pacing-fill ${tone === 'over' ? 'pacing-fill-over' : ''}`}
                  style={{ width: `${width}%`, background: color }}
                />
                {totalDays > 0 ? (
                  <span
                    className="pacing-tick"
                    style={{ left: `${tick}%` }}
                    title={todayLabel}
                    aria-hidden="true"
                  />
                ) : null}
              </div>

              {row.note ? <p className="mt-1.5 text-xs hh-muted">{row.note}</p> : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default { BudggtQuickPills, BudggtPacingCard };
