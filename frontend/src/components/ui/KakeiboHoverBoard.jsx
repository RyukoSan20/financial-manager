/**
 * KakeiboHoverBoard.
 *
 * A little Japanese-stationery postcard that pops up over whatever it
 * is anchored to - a mascot, a calendar day - and carries a short note
 * or a list of lines. It is the quiet detail layer: the thing it sits
 * on stays calm, and the board shows the breakdown only while the
 * reader is looking at it.
 *
 * It is "collision-aware" in the small way a popover needs to be: it
 * can be placed on either side and flips its little pointer tail to
 * match, so it never points away from its anchor.
 *
 * Presentational only. It draws the `title`, the optional `lines`, and
 * any `children`, and reports a close request.
 */

import { clsx } from 'clsx';

export default function KakeiboHoverBoard({
  title,
  subtitle,
  lines = [],
  side = 'top',
  format = (n) => `Rp${Number(n || 0).toLocaleString('id-ID')}`,
  footerLabel,
  footerValue,
  onClose,
  className = '',
  children,
  ...rest
}) {
  return (
    <div
      role="dialog"
      data-kakeibo-hoverboard
      data-side={side}
      className={clsx('kakeibo-hoverboard', className)}
      {...rest}
    >
      {title ? (
        <div className="kakeibo-hoverboard__head">
          <div className="min-w-0">
            <p className="kakeibo-hoverboard__title">{title}</p>
            {subtitle ? <p className="kakeibo-hoverboard__subtitle">{subtitle}</p> : null}
          </div>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="close"
              className="kakeibo-hoverboard__close"
            >
              ×
            </button>
          ) : null}
        </div>
      ) : null}

      {lines.length ? (
        <ul className="kakeibo-hoverboard__lines">
          {lines.map((line, i) => (
            <li key={line.id ?? `${line.label}-${i}`} className="kakeibo-hoverboard__line">
              <span className="kakeibo-hoverboard__line-label">
                {line.label ?? line.description ?? line.name}
              </span>
              <span className="kakeibo-hoverboard__line-value tabular-nums">
                {line.value !== undefined ? format(line.value) : line.text}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {children}

      {footerLabel !== undefined ? (
        <div className="kakeibo-hoverboard__footer">
          <span>{footerLabel}</span>
          <span className="tabular-nums">
            {typeof footerValue === 'number' ? format(footerValue) : footerValue}
          </span>
        </div>
      ) : null}
    </div>
  );
}

export { KakeiboHoverBoard };
