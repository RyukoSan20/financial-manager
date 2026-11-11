/**
 * The nine chapters of the financial profile.
 *
 * The card at the top of the dashboard is called "Profil Keuangan" -
 * the financial profile. It has nine chapters, and the reader moves
 * between them by clicking or by swiping sideways.
 *
 * Each chapter is a different part of the reader's money:
 *
 *   1. This month - the cash flow, and the next thirty days
 *   2. The bank accounts
 *   3. The investments
 *   4. The assets, and the net worth
 *   5. The credit cards and the paylater
 *   6. The debts and the instalments
 *   7. What other people owe
 *   8. The income
 *   9. The reader's own shop
 *
 * This file holds the shape of the nine - the key, the icon, the
 * label - and the arithmetic that turns the server's answer into the
 * one number each chapter is really about.
 *
 * The arithmetic is here, with no React in it, so it can be checked by
 * a script. The card that draws it is in
 * `components/dashboard/FinancialProfileShowcase.jsx`.
 */

/**
 * The nine chapters, in the order they are shown.
 *
 * The key is the one the server sends the chapter under, so the card
 * and the server agree without either of them having to know about
 * the other.
 */
export const CHAPTERS = [
  { key: 'month', icon: '📅', labelKey: 'financial_profile.ch_month' },
  { key: 'accounts', icon: '🏦', labelKey: 'financial_profile.ch_accounts' },
  { key: 'portfolio', icon: '📈', labelKey: 'financial_profile.ch_portfolio' },
  { key: 'net_worth', icon: '🏠', labelKey: 'financial_profile.ch_net_worth' },
  { key: 'credit', icon: '💳', labelKey: 'financial_profile.ch_credit' },
  { key: 'debts', icon: '📉', labelKey: 'financial_profile.ch_debts' },
  { key: 'receivables', icon: '🤝', labelKey: 'financial_profile.ch_receivables' },
  { key: 'income', icon: '💰', labelKey: 'financial_profile.ch_income' },
  { key: 'business', icon: '🏪', labelKey: 'financial_profile.ch_business' },
];

/**
 * The chapter the card opens on.
 *
 * The first one. It is the chapter that answers "how am I doing this
 * month", which is the question a reader has when they open their
 * finances.
 */
export const DEFAULT_CHAPTER = 'month';

/**
 * The number each chapter is really about.
 *
 * Every chapter has one number that matters, and the card shows that
 * one large. The rest of the chapter is the detail under it.
 *
 * A chapter with no data has a number of zero, and says so - it does
 * not show a confident figure of nothing. `hasData` says whether
 * there is anything to show.
 */
export function chapterHeadline(chapterKey, chapters) {
  const chapter = chapters?.[chapterKey] || {};

  switch (chapterKey) {
    case 'month': {
      // What is left over after everything is paid for.
      const value = number(chapter.free_cash);
      return {
        value,
        hasData: number(chapter.income) > 0 || number(chapter.expense) > 0,
        kind: 'money',
      };
    }

    case 'accounts':
      return {
        value: number(chapter.total),
        hasData: number(chapter.count) > 0,
        kind: 'money',
      };

    case 'portfolio':
      return {
        value: number(chapter.total),
        hasData: number(chapter.count) > 0,
        kind: 'money',
      };

    case 'net_worth':
      return {
        value: number(chapter.net_worth),
        hasData: Boolean(chapter.has_snapshot) || number(chapter.liquid) !== 0,
        kind: 'money',
      };

    case 'credit': {
      // How much of the limit is left is the number a reader wants:
      // it is how much they can still spend.
      const remaining = number(chapter.remaining);
      const limit = number(chapter.limit);
      return {
        value: remaining,
        hasData: limit > 0,
        kind: 'money',
      };
    }

    case 'debts':
      return {
        value: number(chapter.principal),
        hasData: number(chapter.count) > 0,
        kind: 'money',
      };

    case 'receivables':
      return {
        value: number(chapter.total),
        hasData: number(chapter.total) > 0,
        kind: 'money',
      };

    case 'income':
      return {
        value: number(chapter.total),
        hasData: number(chapter.total) > 0,
        kind: 'money',
      };

    case 'business':
      return {
        value: number(chapter.month_sales),
        hasData: Boolean(chapter.has_store),
        kind: 'money',
      };

    default:
      return { value: 0, hasData: false, kind: 'money' };
  }
}

/**
 * The lines of detail under the big number.
 *
 * Each chapter explains itself in its own terms, and every line is
 * one the reader can act on. A line that would be zero because there
 * is no data is left out, so the card does not fill up with zeros.
 */
export function chapterDetails(chapterKey, chapters, t) {
  const chapter = chapters?.[chapterKey] || {};
  const lines = [];

  switch (chapterKey) {
    case 'month': {
      lines.push({
        key: 'income',
        label: t('financial_profile.income'),
        value: number(chapter.income),
        kind: 'money',
      });
      lines.push({
        key: 'committed',
        label: t('financial_profile.must_pay'),
        value: number(chapter.committed),
        kind: 'money',
      });
      break;
    }

    case 'accounts': {
      for (const group of chapter.by_kind || []) {
        lines.push({
          key: `kind-${group.kind}`,
          label: group.label,
          value: number(group.total),
          kind: 'money',
          count: group.count,
        });
      }
      break;
    }

    case 'portfolio': {
      for (const account of chapter.accounts || []) {
        lines.push({
          key: `portfolio-${account.id}`,
          label: account.name,
          value: number(account.balance),
          kind: 'money',
        });
      }
      break;
    }

    case 'net_worth': {
      lines.push({
        key: 'liquid',
        label: t('financial_profile.cash'),
        value: number(chapter.liquid),
        kind: 'money',
      });
      lines.push({
        key: 'investments',
        label: t('financial_profile.investments'),
        value: number(chapter.investments),
        kind: 'money',
      });
      lines.push({
        key: 'liabilities',
        label: t('financial_profile.liabilities'),
        value: number(chapter.liabilities),
        kind: 'money',
      });
      break;
    }

    case 'credit': {
      lines.push({
        key: 'used',
        label: t('financial_profile.limit_used'),
        value: number(chapter.used),
        kind: 'money',
      });
      lines.push({
        key: 'limit',
        label: t('financial_profile.total_limit'),
        value: number(chapter.limit),
        kind: 'money',
      });
      break;
    }

    case 'debts': {
      lines.push({
        key: 'monthly',
        label: t('financial_profile.monthly_installment'),
        value: number(chapter.monthly),
        kind: 'money',
      });
      if (chapter.dsr !== null && chapter.dsr !== undefined) {
        lines.push({
          key: 'dsr',
          label: t('financial_profile.dsr'),
          value: number(chapter.dsr) * 100,
          kind: 'percent',
        });
      }
      break;
    }

    case 'receivables': {
      lines.push({
        key: 'split',
        label: t('financial_profile.from_split'),
        value: number(chapter.split),
        kind: 'money',
      });
      lines.push({
        key: 'loans',
        label: t('financial_profile.from_loans'),
        value: number(chapter.loans),
        kind: 'money',
      });
      break;
    }

    case 'income': {
      for (const source of chapter.sources || []) {
        lines.push({
          key: `income-${source.category_id ?? source.category}`,
          label: source.category,
          value: number(source.amount),
          kind: 'money',
        });
      }
      break;
    }

    case 'business': {
      lines.push({
        key: 'today',
        label: t('financial_profile.today_sales'),
        value: number(chapter.today_sales),
        kind: 'money',
      });
      lines.push({
        key: 'profit',
        label: t('financial_profile.gross_profit'),
        value: number(chapter.profit),
        kind: 'money',
      });
      lines.push({
        key: 'qris',
        label: t('financial_profile.qris'),
        value: number(chapter.qris),
        kind: 'money',
      });
      lines.push({
        key: 'cash',
        label: t('financial_profile.cash_payment'),
        value: number(chapter.cash),
        kind: 'money',
      });
      break;
    }

    default:
      break;
  }

  return lines.filter((line) => line.value !== 0 || line.alwaysShow);
}

/**
 * The link a chapter sends the reader to.
 *
 * A chapter that has a page of its own offers it, so the card is a
 * way into the application and not a dead end.
 */
export function chapterLink(chapterKey) {
  switch (chapterKey) {
    case 'accounts':
      return '/accounts';
    case 'portfolio':
      return '/market';
    case 'credit':
      return '/accounts';
    case 'debts':
      return '/debts';
    case 'receivables':
      return '/split';
    case 'business':
      return '/merchant';
    default:
      return null;
  }
}

/**
 * The points on the thirty-day line.
 *
 * The line is drawn from today to thirty days ahead, and the points
 * are the things that are going to happen: the payday, the bills that
 * recur, the instalments, and the dates the reader's goals are due.
 *
 * The points are put on the line by how many days away they are, so
 * the spacing on the line means something.
 */
export const TIMELINE_LOOKBACK_DAYS = 7;

export function timelinePoints(timeline, today, horizonDays = 30, lookbackDays = TIMELINE_LOOKBACK_DAYS) {
  const points = [];
  const start = toDate(today);
  const span = horizonDays + lookbackDays;

  for (const item of timeline || []) {
    const when = toDate(item.date);
    if (!when || !start) continue;

    const days = daysBetween(start, when);
    if (days < -lookbackDays || days > horizonDays) continue;

    points.push({
      ...item,
      days,
      // Where on the line the point sits, as a fraction from the
      // first day behind to the last day ahead. Today is at
      // `todayPosition`, not at the left edge.
      position: span > 0 ? (days + lookbackDays) / span : 0,
    });
  }

  points.sort((a, b) => a.days - b.days);
  return points;
}

/**
 * The sign of a number, for the reader.
 *
 * Money that came in is a plus and money that went out is a minus.
 * Zero has no sign, because nothing did not go anywhere.
 */
/** Where today sits on the line, as a fraction. */
export function timelineTodayPosition(horizonDays = 30, lookbackDays = TIMELINE_LOOKBACK_DAYS) {
  const span = horizonDays + lookbackDays;
  return span > 0 ? lookbackDays / span : 0;
}

export function signedValue(value) {
  const number_ = number(value);
  if (number_ > 0) return number_;
  if (number_ < 0) return number_;
  return 0;
}

/**
 * A number, whatever it is.
 *
 * The server sends numbers as numbers and as strings and sometimes
 * sends nothing at all. None of those is a reason to break the page.
 */
export function number(value) {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function daysBetween(from, to) {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / 86400000);
}

export default {
  CHAPTERS,
  DEFAULT_CHAPTER,
  chapterHeadline,
  chapterDetails,
  chapterLink,
  timelinePoints,
  signedValue,
  number,
};
