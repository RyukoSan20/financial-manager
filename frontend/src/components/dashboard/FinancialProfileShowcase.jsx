/**
 * The financial profile.
 *
 * The card at the top of the dashboard. It has nine chapters, and the
 * reader moves between them by clicking or by swiping sideways.
 *
 * Each chapter is a different part of the reader's money: this
 * month, the accounts, the investments, the net worth, the credit
 * cards, the debts, what other people owe, the income, and the
 * reader's own shop.
 *
 * Three things this card is careful about:
 *
 * - the big number counts to its new value when the reader moves
 *   between chapters, so the reader sees the size of the change;
 * - a chapter with nothing in it says so, rather than showing a
 *   confident zero;
 * - and the card is a way into the application, not a dead end -
 *   every chapter that has a page of its own offers it.
 *
 * The arithmetic is in `utils/financialProfile.js`, with no React in
 * it, so it can be checked by a script.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { clsx } from 'clsx';
import { Calendar } from 'lucide-react';

import AnimatedNumber from '../common/AnimatedNumber';
import RiggedSvgMascot from '../mascot/RiggedSvgMascot';
import { useTranslation } from '../../i18n';
import { formatCurrency } from '../../utils/format';
import {
  CHAPTERS,
  DEFAULT_CHAPTER,
  chapterDetails,
  chapterHeadline,
  chapterLink,
  timelinePoints,
} from '../../utils/financialProfile';

/**
 * The pastel wave that runs under the big number.
 *
 * It is a picture of a wave, drawn as an SVG path, and it moves very
 * slowly. It is the one piece of decoration on the card, and it is
 * there to make the card feel like a place rather than a table.
 */
function PastelWave({ className = '' }) {
  return (
    <svg
      className={clsx('pointer-events-none absolute inset-x-0 bottom-0 h-10 w-full', className)}
      viewBox="0 0 1200 40"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M0,24 C150,4 350,44 600,24 C850,4 1050,40 1200,22 L1200,40 L0,40 Z"
        fill="currentColor"
        className="text-sky-100/70 dark:text-sky-500/10"
      >
        <animate
          attributeName="d"
          dur="14s"
          repeatCount="indefinite"
          values="M0,24 C150,4 350,44 600,24 C850,4 1050,40 1200,22 L1200,40 L0,40 Z;
                    M0,20 C180,40 320,8 600,22 C880,36 1020,8 1200,26 L1200,40 L0,40 Z;
                    M0,24 C150,4 350,44 600,24 C850,4 1050,40 1200,22 L1200,40 L0,40 Z"
        />
      </path>
    </svg>
  );
}

/**
 * One point on the thirty-day line.
 *
 * The point the reader taps. When they tap it, the point opens and
 * says what it is - a payday, a bill, an instalment, a goal.
 */
function TimelinePoint({ point, selected, onSelect, t }) {
  const kindColor = {
    payday: 'bg-emerald-400 ring-emerald-200',
    bill: 'bg-sky-400 ring-sky-200',
    installment: 'bg-amber-400 ring-amber-200',
    goal: 'bg-violet-400 ring-violet-200',
    spent: 'bg-rose-400 ring-rose-200',
    earned: 'bg-[#52796F] ring-[#D8F3DC]',
  }[point.kind] || 'bg-slate-300 ring-slate-200';

  const kindLabel = {
    payday: t('financial_profile.payday'),
    bill: t('financial_profile.bill'),
    installment: t('financial_profile.installment'),
    goal: t('financial_profile.target'),
    spent: t('financial_profile.spent'),
    earned: t('financial_profile.earned'),
  }[point.kind] || '';

  return (
    <button
      type="button"
      onClick={() => onSelect(point)}
      aria-pressed={selected}
      title={`${kindLabel} · ${point.label}`}
      className="relative flex min-w-[68px] shrink-0 flex-col items-center group"
      data-testid="timeline-node"
    >
      {/* The same empty slot the today node's mascot sits in, so
          every dot lands on the same line. */}
      <span className="h-8 w-full" aria-hidden="true" />
      {selected ? (
        <span className="absolute -top-7 whitespace-nowrap rounded-lg bg-slate-900/90 px-2 py-1 text-[10px] font-medium text-white shadow-sm dark:bg-white/90 dark:text-slate-900 z-10">
          {kindLabel} · {point.label}
        </span>
      ) : null}
      <span
        className={clsx(
          'h-3 w-3 rounded-full ring-4 transition-transform',
          kindColor,
          selected ? 'scale-125' : 'group-hover:scale-110'
        )}
        style={{ marginTop: '-6px' }}
      />
      <span className="text-[9px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
        {shortDate(point.date)}
      </span>
    </button>
  );
}

/**
 * The thirty days ahead, as a line.
 *
 * The mascot sits on top of the point that is today, so the reader
 * can see where they are standing before they look at what is
 * coming.
 */
function ThirtyDayRoad({ timeline, t, onRecord }) {
  const [selected, setSelected] = useState(null);

  const points = useMemo(
    () => timelinePoints(timeline, new Date()),
    [timeline]
  );

  const today = new Date();

  // Today is a node in the sequence, placed by date rather than by a
  // percentage, so the stepper stays in chronological order.
  const nodes = useMemo(() => {
    const todayKey = new Date().toISOString().slice(0, 10);
    const list = points.map((point) => ({ isToday: false, point, date: point.date }));
    const atToday = list.findIndex((n) => String(n.date).slice(0, 10) >= todayKey);
    const todayNode = { isToday: true, point: null, date: todayKey };
    if (atToday === -1) list.push(todayNode);
    else list.splice(atToday, 0, todayNode);
    return list;
  }, [points]);

  return (
    <div className="rounded-2xl border border-slate-200/70 dark:border-white/10 bg-white/60 dark:bg-white/[0.03] p-3">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {t('financial_profile.road_30_days')}
        </h4>
        <span className="text-[10px] text-slate-400 dark:text-slate-500">
          {t('financial_profile.tap_point')}
        </span>
      </div>

      {points.length === 0 ? (
        <p className="text-xs text-slate-400 dark:text-slate-500 py-2">
          {t('financial_profile.no_data')}
        </p>
      ) : (
        /* A flex stepper, not percentage coordinates. Every node holds
           at least 68px of its own, so two dates one day apart can no
           longer stack into "11Nov12Nov". It scrolls instead. */
        <div className="relative">
          {/* The connector. It runs through the centre of the dots.
              It used to sit at a fixed 52px, which was above the
              dots of every date except today - and today has the
              mascot above its dot, so its dot sat lower than the
              rest. The line therefore floated in the gap between
              two rows of dots rather than joining them. */}
          <div
            className="pointer-events-none absolute left-0 right-0 top-[46px] h-px bg-[#EAE3D5] dark:bg-white/15"
            aria-hidden="true"
          />
          <div
            className="no-scrollbar relative flex items-start justify-between gap-5 overflow-x-auto py-3 px-2"
            data-testid="timeline-stepper"
          >
            {nodes.map((node) =>
              node.isToday ? (
                <div
                  key="today"
                  className="relative flex min-w-[68px] shrink-0 flex-col items-center"
                  data-testid="timeline-node"
                >
                  {/* The mascot sits in a slot of the same height as
                      the one every other node's empty slot has, so
                      the dots all land on one line. */}
                  <span className="flex h-8 items-end justify-center">
                    <RiggedSvgMascot state="happy" size={30} label={t('financial_profile.today')} />
                  </span>
                  <span className="h-2.5 w-2.5 rounded-full bg-[#2F4842] ring-4 ring-[#D8F3DC]" />
                  <span className="mt-1 text-[9px] font-bold text-[#2F4842] dark:text-[#D8F3DC] whitespace-nowrap">
                    {t('financial_profile.today')}
                  </span>
                </div>
              ) : (
                <TimelinePoint
                  key={`${node.point.kind}-${node.point.date}-${node.point.label}`}
                  point={node.point}
                  selected={selected === node.point}
                  onSelect={(p) => setSelected(selected === p ? null : p)}
                  t={t}
                />
              )
            )}
          </div>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-[10px] text-slate-400 dark:text-slate-500">
          {today.toLocaleDateString(undefined, {
            day: 'numeric',
            month: 'short',
          })}
        </span>
        <button
          type="button"
          onClick={onRecord}
          className="hh-button !rounded-full !px-3 !py-1 !text-[11px]"
        >
          {t('financial_profile.record')}
        </button>
      </div>
    </div>
  );
}

/**
 * A short date, for under a point on the line.
 */
function shortDate(value) {
  const when = new Date(value);
  if (Number.isNaN(when.getTime())) return '';
  return when.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/**
 * The card.
 */
export default function FinancialProfileShowcase({ profile, onRecord }) {
  const { t } = useTranslation();

  const [chapter, setChapter] = useState(DEFAULT_CHAPTER);

  const chapters = useMemo(() => profile?.chapters || {}, [profile]);

  const headline = useMemo(
    () => chapterHeadline(chapter, chapters),
    [chapter, chapters]
  );

  const details = useMemo(
    () => chapterDetails(chapter, chapters, t),
    [chapter, chapters, t]
  );

  const link = chapterLink(chapter);

  // The reader moves to the next chapter with the arrow keys, and the
  // bar is a list of buttons, so it is a list.
  const tabRefs = useRef([]);

  const move = useCallback((delta) => {
    const index = CHAPTERS.findIndex((c) => c.key === chapter);
    const next = (index + delta + CHAPTERS.length) % CHAPTERS.length;
    setChapter(CHAPTERS[next].key);
    tabRefs.current[next]?.focus();
  }, [chapter]);

  // A swipe sideways moves between chapters too. The reader is on a
  // phone as often as not.
  const touchStart = useRef(null);

  const onTouchStart = (event) => {
    touchStart.current = event.touches?.[0]?.clientX ?? null;
  };

  const onTouchEnd = (event) => {
    if (touchStart.current === null) return;
    const end = event.changedTouches?.[0]?.clientX ?? null;
    const start = touchStart.current;
    touchStart.current = null;
    if (end === null) return;
    const distance = end - start;
    // A swipe is a deliberate gesture, so the threshold is a real
    // one - a small movement is a tap, not a swipe.
    if (Math.abs(distance) > 60) {
      move(distance < 0 ? 1 : -1);
    }
  };

  const monthLabel = useMemo(() => {
    const when = new Date();
    return when.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }, []);

  const headlineLabel = {
    month: t('financial_profile.free_cash_month'),
    accounts: t('financial_profile.total_cash'),
    portfolio: t('financial_profile.total_portfolio'),
    net_worth: t('financial_profile.net_worth'),
    credit: t('financial_profile.remaining_limit'),
    debts: t('financial_profile.debt_remaining'),
    receivables: t('financial_profile.receivable_total'),
    income: t('financial_profile.income_total'),
    business: t('financial_profile.month_sales'),
  }[chapter] || t('financial_profile.title');

  return (
    <section
      className="hh-card relative"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      aria-label={t('financial_profile.title')}
    >
      {/* The wave, at the top, behind the header. It is in a layer of
          its own with its own clip, so the card itself does not have
          to clip - and a card that clips would cut the mascot's
          hover board off. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 overflow-hidden rounded-3xl text-emerald-50 dark:text-emerald-500/5">
        <PastelWave />
      </div>

      <div className="relative z-10 p-4 sm:p-5">
        {/* --- the header ------------------------------------------------ */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="font-numeric text-base font-bold text-slate-900 dark:text-slate-50">
            {t('financial_profile.title')}
          </h2>
          <span className="text-[10px] text-slate-400 dark:text-slate-500">
            {t('financial_profile.hint')}
          </span>
        </div>

        {/* --- the chapters ---------------------------------------------- */}
        <div
          className="flex gap-1.5 overflow-x-auto pb-2 mb-4 -mx-1 px-1 no-scrollbar"
          role="tablist"
          aria-label={t('financial_profile.title')}
        >
          {CHAPTERS.map((item, index) => {
            const active = item.key === chapter;
            return (
              <button
                key={item.key}
                ref={(element) => { tabRefs.current[index] = element; }}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setChapter(item.key)}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowRight') { event.preventDefault(); move(1); }
                  if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1); }
                }}
                className={clsx('botanical-pill shrink-0 whitespace-nowrap !py-1.5', active && 'is-active')}
              >
                <span aria-hidden="true">
                  {item.key === 'month' ? <Calendar className="w-3.5 h-3.5 inline -mt-0.5" /> : item.icon}
                </span>
                {t(item.labelKey)}
              </button>
            );
          })}
        </div>

        {/* --- the chapter ----------------------------------------------- */}
        <div className="relative">
          {/* The big number, and the calendar beside it. */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="hh-badge uppercase">
                {chapter === 'month'
                  ? `✨ ${monthLabel}`
                  : `${t('financial_profile.chapter')} ${CHAPTERS.findIndex((c) => c.key === chapter) + 1} · ${headlineLabel}`}
              </p>

              <p className="mt-1.5 font-numeric text-2xl sm:text-3xl font-bold leading-none text-slate-900 dark:text-slate-50 break-words">
                {headline.hasData ? (
                  <AnimatedNumber
                    value={headline.value}
                    format={(n) => formatCurrency(n, profile?.currency || 'IDR')}
                  />
                ) : (
                  <span className="text-base font-semibold text-slate-400 dark:text-slate-500">
                    {t('financial_profile.no_data')}
                  </span>
                )}
              </p>
            </div>

            {/* The floating calendar, on the right. */}
            <div
              className="shrink-0 w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-100 to-violet-100 dark:from-sky-500/15 dark:to-violet-500/15 flex flex-col items-center justify-center animate-[float_6s_ease-in-out_infinite]"
              aria-hidden="true"
            >
              <Calendar className="w-5 h-5 text-sky-500 dark:text-sky-300" aria-hidden="true" />
              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                {new Date().getDate()}
              </span>
            </div>
          </div>

          {/* The wave, under the number. */}
          <div className="relative h-8 -mx-4 sm:-mx-5 mt-2 text-sky-100/60 dark:text-sky-500/10">
            <PastelWave />
          </div>

          {/* The detail, under the wave. */}
          <div className="mt-3">
            {details.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {t('financial_profile.no_data_hint')}
              </p>
            ) : (
              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
                {details.map((line) => (
                  <div key={line.key} className="min-w-0">
                    <dt className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500 truncate">
                      {line.label}
                    </dt>
                    <dd className="font-numeric text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">
                      {line.kind === 'percent'
                        ? `${line.value.toFixed(1)}%`
                        : formatCurrency(line.value, profile?.currency || 'IDR')}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>

          {/* The thirty days, in the first chapter. */}
          {chapter === 'month' ? (
            <div className="mt-4">
              <ThirtyDayRoad
                timeline={chapters.timeline}
                t={t}
                onRecord={onRecord}
              />
            </div>
          ) : null}

          {/* The way into the page of this chapter. */}
          {link ? (
            <div className="mt-4 flex items-center justify-end">
              <Link
                to={link}
                className="inline-flex items-center gap-1 text-xs font-bold text-[#2F4842] dark:text-[#D8F3DC] hover:underline"
              >
                {t('financial_profile.see_all')}
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
