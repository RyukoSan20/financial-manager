/**
 * Where the money went, drawn as a river.
 *
 * Three columns:
 *
 * - left: where the money came from, by name;
 * - middle: what it was spent on;
 * - right: what is left over, against what was spent.
 *
 * It is drawn with SVG rather than a chart library, for two reasons.
 * The first is that the drawing has to follow the money exactly: each
 * band is the width of the amount it carries, so a band cannot be
 * wider than the money that goes through it. The second is that a
 * page should not pull in a drawing library for one picture.
 *
 * The numbers come from the shared arithmetic, from the transactions
 * themselves. The diagram can only say what the records say, so a
 * missing transaction shows as a smaller band rather than as a
 * prettier picture.
 */

import { useMemo } from 'react';
import { flowFromTransactions, flowDiagram } from '../../utils/decisionWidgets';
import { formatNative } from '../../utils/currency';
import { useTranslation } from '../../i18n';
import { batch3 } from '../../i18n/keys_batch3';

const COLUMN_WIDTH = 150;
const GAP = 26;
const ROW_HEIGHT = 30;
const HEIGHT_PADDING = 12;

export function CashFlowDiagram({
  transactions = [],
  categoryName,
  incomeBreakdown = null,
  expenseBreakdown = null,
}) {
  const { language } = useTranslation();
  const W = batch3[language]?.fintech || {};

  // The page that draws this already has the breakdowns, so they are
  // used when they are there. The transactions are the fallback, for
  // the page that has only those.
  const flow = useMemo(() => {
    if (incomeBreakdown?.breakdown?.length || expenseBreakdown?.breakdown?.length) {
      return flowDiagram({
        income: (incomeBreakdown?.breakdown || []).map((row) => ({
          key: row.name,
          label: row.name,
          value: row.total,
        })),
        expense: (expenseBreakdown?.breakdown || []).map((row) => ({
          key: row.name,
          label: row.name,
          value: row.total,
        })),
      });
    }
    return flowFromTransactions(transactions, { categoryName });
  }, [transactions, categoryName, incomeBreakdown, expenseBreakdown]);

  const hasContent = flow.sources.length > 0 || flow.middle.length > 0;
  if (!hasContent) {
    return (
      <section className="fintech-panel" data-testid="cash-flow-diagram">
        <header className="fintech-panel__head">
          <h3 className="fintech-panel__title">{W.flow_title}</h3>
        </header>
        <p className="fintech-panel__note">{W.flow_empty}</p>
      </section>
    );
  }

  // The bands are drawn to scale: the height of a band is its share
  // of the largest column.
  const rows = Math.max(
    flow.sources.length,
    flow.middle.length,
    flow.sinks.length
  );
  const height = rows * ROW_HEIGHT + HEIGHT_PADDING * 2;
  const width = COLUMN_WIDTH * 3 + GAP * 2;

  // The scale is set by the biggest column, so the picture is never
  // stretched past what the money supports.
  const scale = Math.max(flow.earned, flow.spent, 1);

  const band = (value, index, total) => {
    const h = Math.max(3, (value / scale) * (rows * ROW_HEIGHT));
    const offset =
      HEIGHT_PADDING +
      (index / Math.max(1, total)) * (rows * ROW_HEIGHT) +
      ((total - value) / Math.max(1, scale)) * (rows * ROW_HEIGHT) * 0.5;
    return { h, offset };
  };

  const sourceBands = flow.sources.map((s, i) => ({
    ...s,
    ...band(s.value, i, flow.sources.length),
  }));
  const middleBands = flow.middle.map((m, i) => ({
    ...m,
    ...band(m.value, i, flow.middle.length),
  }));
  const sinkBands = flow.sinks.map((s, i) => ({
    ...s,
    ...band(s.value, i, flow.sinks.length),
  }));

  return (
    <section className="fintech-panel" data-testid="cash-flow-diagram">
      <header className="fintech-panel__head">
        <h3 className="fintech-panel__title">{W.flow_title}</h3>
        <p className="fintech-panel__hint">
          {W.flow_earned}: {formatNative(flow.earned, 'IDR')} · {W.flow_spent}:{' '}
          {formatNative(flow.spent, 'IDR')}
        </p>
      </header>

      <div className="fintech-flow" role="img" aria-label={W.flow_title}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="fintech-flow__svg"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <linearGradient id="fintech-flow-band" x1="0" x2="1">
              <stop offset="0%" stopColor="#059669" stopOpacity="0.30" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.16" />
            </linearGradient>
          </defs>

          {/* The bands: source to middle, middle to sink. */}
          {sourceBands.map((s, i) => {
            const target = middleBands[i % Math.max(1, middleBands.length)];
            if (!target) return null;
            const x1 = COLUMN_WIDTH;
            const x2 = COLUMN_WIDTH + GAP;
            const y1 = s.offset + s.h / 2;
            const y2 = target.offset + target.h / 2;
            return (
              <path
                key={`s-${s.key}`}
                d={`M ${x1} ${y1 - s.h / 2} C ${x1 + GAP / 2} ${y1 - s.h / 2}, ${x2 - GAP / 2} ${y2 - target.h / 2}, ${x2} ${y2 - target.h / 2}
                   L ${x2} ${y2 + target.h / 2}
                   C ${x2 - GAP / 2} ${y2 + target.h / 2}, ${x1 + GAP / 2} ${y1 + s.h / 2}, ${x1} ${y1 + s.h / 2} Z`}
                fill="url(#fintech-flow-band)"
              />
            );
          })}

          {middleBands.map((m, i) => {
            const target = sinkBands[i % Math.max(1, sinkBands.length)];
            if (!target) return null;
            const x1 = COLUMN_WIDTH * 2 + GAP;
            const x2 = COLUMN_WIDTH * 2 + GAP * 2;
            const y1 = m.offset + m.h / 2;
            const y2 = target.offset + target.h / 2;
            return (
              <path
                key={`m-${m.key}`}
                d={`M ${x1} ${y1 - m.h / 2} C ${x1 + GAP / 2} ${y1 - m.h / 2}, ${x2 - GAP / 2} ${y2 - target.h / 2}, ${x2} ${y2 - target.h / 2}
                   L ${x2} ${y2 + target.h / 2}
                   C ${x2 - GAP / 2} ${y2 + target.h / 2}, ${x1 + GAP / 2} ${y1 + m.h / 2}, ${x1} ${y1 + m.h / 2} Z`}
                fill="url(#fintech-flow-band)"
                opacity="0.7"
              />
            );
          })}

          {/* The three columns of labels. */}
          {sourceBands.map((s, i) => (
            <text
              key={`sl-${s.key}`}
              x={0}
              y={s.offset + s.h / 2 + 4}
              className="fintech-flow__label"
            >
              {s.label}
            </text>
          ))}
          {middleBands.map((m, i) => (
            <text
              key={`ml-${m.key}`}
              x={COLUMN_WIDTH + GAP}
              y={m.offset + m.h / 2 + 4}
              className="fintech-flow__label"
            >
              {m.label}
            </text>
          ))}
          {sinkBands.map((s, i) => (
            <text
              key={`kl-${s.key}`}
              x={COLUMN_WIDTH * 2 + GAP * 2}
              y={s.offset + s.h / 2 + 4}
              className="fintech-flow__label"
            >
              {s.label}
            </text>
          ))}
        </svg>

        {/* The amounts, in text, so they can be read and copied. */}
        <div className="fintech-flow__figures">
          <div>
            <p className="fintech-flow__head">{W.flow_sources}</p>
            {flow.sources.map((s) => (
              <p key={s.key} className="fintech-flow__row">
                <span>{s.label}</span>
                <span>{formatNative(s.value, 'IDR')}</span>
              </p>
            ))}
          </div>
          <div>
            <p className="fintech-flow__head">{W.flow_middle}</p>
            {flow.middle.map((m) => (
              <p key={m.key} className="fintech-flow__row">
                <span>{m.label}</span>
                <span>{formatNative(m.value, 'IDR')}</span>
              </p>
            ))}
          </div>
          <div>
            <p className="fintech-flow__head">{W.flow_sinks}</p>
            {flow.sinks.map((s) => (
              <p key={s.key} className="fintech-flow__row">
                <span>{s.label === 'saved' ? W.flow_saved : W.flow_spent}</span>
                <span>{formatNative(s.value, 'IDR')}</span>
              </p>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default CashFlowDiagram;
