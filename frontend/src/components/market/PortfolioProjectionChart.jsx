/**
 * The projection of a portfolio.
 *
 * The reader puts in what they have and what they put away each
 * month, and this shows where that puts them. The picture is a
 * projection, not a promise: it says what would happen if the money
 * kept coming in at the same rate and the return stayed the same.
 * It is labelled as a projection on the chart itself, because a
 * line on a graph that goes up and to the right is the kind of thing
 * people believe too easily.
 *
 * The numbers behind it are worked out here rather than drawn by
 * hand, so the line and the figures under it cannot disagree.
 */

import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

import { formatCurrency } from '../../utils/format';
import { useTranslation } from '../../i18n';
import { batch12 } from '../../i18n/keys_batch12';
import { buildArea, buildPath, projectPortfolio, MONTHS } from '../../utils/portfolioProjection';

export default function PortfolioProjectionChart({
  starting = 0,
  monthly = 0,
  months = MONTHS,
  width = 560,
  height = 220,
  padding = 24,
  // The quotes the last answer was built on. They are shown under
  // the projection so that the words and the picture are visibly
  // about the same thing.
  chartPoints = [],
}) {
  const { language } = useTranslation();
  const K = batch12[language]?.advisor || batch12.id.advisor;

  const points = useMemo(
    () => projectPortfolio(starting, monthly, months),
    [starting, monthly, months],
  );

  const path = useMemo(() => buildPath(points, width, height, padding), [points, width, height, padding]);
  const area = useMemo(() => buildArea(points, width, height, padding), [points, width, height, padding]);

  const first = points[0]?.value || 0;
  const last = points[points.length - 1]?.value || 0;
  const gained = Math.round((last - first) * 100) / 100;
  const direction = gained > 0 ? 'up' : gained < 0 ? 'down' : 'flat';

  const Icon = direction === 'up' ? TrendingUp : direction === 'down' ? TrendingDown : Minus;

  return (
    <div className="rounded-2xl border border-gray-200/70 dark:border-gray-700/70 bg-white/75 dark:bg-gray-900/75 backdrop-blur-md shadow-sm p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">{K.projection_title}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{K.projection_subtitle}</p>
        </div>
        <span
          className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg ${
            direction === 'up'
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
              : direction === 'down'
              ? 'bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-300'
              : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
          }`}
        >
          <Icon size={13} />
          {gained >= 0 ? '+' : ''}{formatCurrency(gained)}
        </span>
      </div>

      {points.length > 1 && (
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto"
          role="img"
          aria-label={K.projection_title}
        >
          <defs>
            <linearGradient id="projectionFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#059669" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#059669" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          <path d={area} fill="url(#projectionFill)" />
          <path
            d={path}
            fill="none"
            stroke="#059669"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}

      {/* The three figures, so the picture has numbers under it. */}
      <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700/60">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{K.projection_start}</p>
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-0.5">{formatCurrency(first)}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{K.projection_monthly}</p>
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-0.5">{formatCurrency(monthly)}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{K.projection_end}</p>
          <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">{formatCurrency(last)}</p>
        </div>
      </div>

      {/* The numbers the last answer stood on. */}
      {chartPoints.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700/60">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5">
            {K.projection_based_on}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {chartPoints.slice(0, 6).map((point, index) => (
              <span
                key={`${point.symbol}-${index}`}
                className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
              >
                <span className="font-semibold">{point.symbol}</span>
                {point.change !== undefined && point.change !== null && (
                  <span className={point.change >= 0 ? 'text-emerald-600' : 'text-red-500'}>
                    {point.change >= 0 ? '+' : ''}
                    {Number(point.change).toFixed(2)}%
                  </span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      <p className="mt-3 text-[11px] text-gray-400">{K.projection_note}</p>
    </div>
  );
}
