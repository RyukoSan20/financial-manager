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
import KanaheiStationeryMascot from '../mascot/KanaheiStationeryMascot';

// The perched companion is the Kanahei stationery mascot. The rigged
// pixel mascot keeps its own states (idle/happy/celebrate/alert); the
// Kanahei one has no "celebrate", so it maps to "happy".
const KANAHEI_STATE = {
  idle: 'idle',
  happy: 'happy',
  celebrate: 'happy',
  thinking: 'thinking',
  alert: 'alert',
};

export const BOTANICAL = Object.freeze({
  canvas: '#F5F3EC',
  forest: '#112A20',
  forestHover: '#1A3C2E',
  ink: '#0F291E',
  lime: '#BEF264',
  mist: '#ECFDF5',
  line: '#E5E0D5',
  muted: '#5B6B62',
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
          <p className="text-[11px] font-extrabold uppercase tracking-[0.2em]" style={{ color: BOTANICAL.lime }}>
            {eyebrow}
          </p>
        ) : null}
        {title ? <h2 className="mt-1 text-base font-bold" style={{ color: '#FFF8E7' }}>{title}</h2> : null}
        {value !== undefined && value !== null ? (
          <p className="hh-code mt-2 text-3xl sm:text-4xl break-words" data-forest-value style={{ color: '#FFF8E7' }}>
            {value}
          </p>
        ) : null}
        {caption ? <p className="mt-2 text-xs" data-forest-caption style={{ color: '#EDE6D6' }}>{caption}</p> : null}
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
  // `mode` and `lines` belonged to the rigged pixel mascot; they are
  // accepted and ignored here so every existing call site keeps working.
  void mode;
  void lines;
  const note = Array.isArray(lines) && lines.length ? lines[0] : undefined;
  return (
    <div
      data-perched-mascot
      className={clsx(
        'pointer-events-auto absolute -top-8 z-[1]',
        side === 'left' ? 'left-5' : 'right-5',
        className
      )}
      style={{ top: `-${Math.round(size * 0.55)}px` }}
    >
      <KanaheiStationeryMascot
        size={size}
        state={KANAHEI_STATE[state] || 'idle'}
        label={label}
        note={note}
        noteTitle={label}
        {...rest}
      />
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
