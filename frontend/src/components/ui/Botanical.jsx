/**
 * The botanical studio, as parts.
 *
 * The household page set the look: a warm oat canvas, a lime pill
 * above an editorial serif title, a deep forest card torn from a
 * ticket roll, and the mascot perched on a card's top edge. These
 * are those parts, so every page draws them the same way rather
 * than each page drawing its own.
 *
 * Three parts:
 *
 * - `BotanicalPageHeader`: the badge, the title, the one line under
 *   it, and the button on the right;
 * - `ForestTicketCard`: the dark forest card with the dashed
 *   perforation inside it and the two notches where it was torn;
 * - `PerchedMascot`: the mascot sat on the top edge of whatever it
 *   is given.
 *
 * The colours are the household's, written once here.
 */

import { clsx } from 'clsx';
import RiggedSvgMascot from '../mascot/RiggedSvgMascot';

export const BOTANICAL = Object.freeze({
  canvas: '#FAF9F6',
  card: '#FFFFFF',
  line: '#EAE6DF',
  ink: '#2D312E',
  muted: '#5C6460',
  sage: '#52796F',
  sageDeep: '#2F4842',
  sageHover: '#3D5A52',
  cream: '#F4F1EA',
  terracotta: '#E07A5F',
  // The amount/label colours used inside the deep-sage ticket.
  ticketAmount: '#FFF8E7',
  ticketBadge: '#D8F3DC',
  ticketBadgeInk: '#1B3B32',
  // Legacy aliases, so older references resolve to the Kakeibo palette
  // instead of the retired neon lime / deep forest.
  forest: '#2F4842',
  forestHover: '#3D5A52',
  lime: '#D8F3DC',
  mist: '#F4F1EA',
});

/**
 * The header of a page.
 *
 * `badge` is the short uppercase line in the lime pill. `title` is
 * the name of the page, set in the editorial serif. `subtitle` is
 * the one plain line under it. `action` is the button on the right,
 * if the page has one. `aside` is anything else that goes beside the
 * title - a pill switch, a count.
 */
export function BotanicalPageHeader({
  badge,
  title,
  subtitle,
  action,
  aside,
  icon = '🌿',
  className = '',
  children,
}) {
  return (
    <header
      data-botanical-header
      className={clsx(
        'botanical-header flex flex-wrap items-start justify-between gap-4',
        className
      )}
    >
      <div className="min-w-[min(100%,18rem)] flex-1">
        {badge ? (
          <span className="hh-badge uppercase">
            {icon ? <span aria-hidden="true">{icon}</span> : null} {badge}
          </span>
        ) : null}
        <h1 className="botanical-title mt-3 text-2xl font-extrabold sm:text-3xl">
          {title}
        </h1>
        {subtitle ? <p className="mt-1 text-sm hh-muted">{subtitle}</p> : null}
        {children}
      </div>
      {aside || action ? (
        <div className="flex flex-wrap items-center gap-2">
          {aside}
          {action}
        </div>
      ) : null}
    </header>
  );
}

/**
 * The dark forest card, torn from a ticket roll.
 *
 * `eyebrow` is the small lime line at the top. `title` is the big
 * line. `value` is the number, if there is one, and `caption` the
 * line under it. Anything else goes in `children`.
 *
 * `notches` draws the two half-circles at the sides where the ticket
 * was torn; they are the colour of the canvas, so they are off when
 * the card is on a background of another colour.
 */
export function ForestTicketCard({
  eyebrow,
  title,
  value,
  caption,
  mascot,
  notches = true,
  className = '',
  innerClassName = '',
  children,
  ...rest
}) {
  return (
    <section
      data-forest-ticket
      className={clsx('hh-card-forest forest-ticket relative p-3', mascot ? 'mt-8' : '', className)}
      {...rest}
    >
      {mascot ? <PerchedMascot {...mascot} /> : null}
      <div
        className={clsx(
          'relative rounded-[18px] px-5 py-4',
          notches ? 'hh-ticket' : 'forest-ticket-plain',
          innerClassName
        )}
      >
        {eyebrow ? (
          <p
            data-forest-eyebrow
            className="inline-flex rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.18em]"
            style={{ background: BOTANICAL.ticketBadge, color: BOTANICAL.ticketBadgeInk }}
          >
            {eyebrow}
          </p>
        ) : null}
        {title ? <h2 className="mt-2 text-base font-bold" style={{ color: BOTANICAL.ticketAmount }}>{title}</h2> : null}
        {value !== undefined && value !== null ? (
          <p
            className="mt-2 text-3xl sm:text-4xl font-bold tabular-nums whitespace-nowrap tracking-tight"
            data-forest-value
            style={{ color: BOTANICAL.ticketAmount }}
          >
            {value}
          </p>
        ) : null}
        {caption ? (
          <p className="forest-ticket-caption mt-2 text-xs" style={{ color: '#EDE6D6' }}>
            {caption}
          </p>
        ) : null}
        {children}
      </div>
    </section>
  );
}

/**
 * The mascot on the top edge of a card.
 *
 * The card that holds it is `relative`, and should leave room above
 * (`mt-8`) so the mascot is not standing on whatever is above the
 * card.
 *
 * It sits on the top-right border, clear of the card's title on the
 * left and of anything above it. The offset used to be written twice
 * - once as a class and once as an inline style - and the inline
 * style won, so the mascot sat at a different height on every card.
 * Now there is one rule for it.
 */
export function PerchedMascot({
  side = 'right',
  size = 56,
  state = 'idle',
  mode = 'family',
  label,
  lines,
  className = '',
  ...rest
}) {
  return (
    <div
      data-perched-mascot
      className={clsx(
        // The perch is absolute, so it has no height of its own; the
        // board that opens below it would hang in the air. The
        // padding gives it a body to sit on, and the high z-index
        // keeps it above the card it is perched on.
        'pointer-events-auto absolute -top-9 z-[2] pt-1',
        side === 'left' ? 'left-5' : 'right-5',
        className
      )}
    >
      <RiggedSvgMascot size={size} state={state} mode={mode} label={label} lines={lines} {...rest} />
    </div>
  );
}

/**
 * A plain white botanical card, with room for a perched mascot.
 */
export function BotanicalCard({ mascot, className = '', children, ...rest }) {
  return (
    <section
      className={clsx('hh-card relative p-5', mascot ? 'mt-8 pt-6' : '', className)}
      {...rest}
    >
      {mascot ? <PerchedMascot {...mascot} /> : null}
      {children}
    </section>
  );
}

/**
 * The deep forest button.
 */
export function ForestButton({ className = '', ghost = false, type = 'button', ...rest }) {
  return (
    <button
      type={type}
      className={clsx('hh-button', ghost && 'hh-button-ghost', className)}
      {...rest}
    />
  );
}

export default {
  BOTANICAL,
  BotanicalPageHeader,
  ForestTicketCard,
  PerchedMascot,
  BotanicalCard,
  ForestButton,
};
