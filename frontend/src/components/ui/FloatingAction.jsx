import { clsx } from 'clsx';
import { Plus } from 'lucide-react';
import { moneyLayerOn } from '../../utils/animation';

/**
 * The one button that adds something.
 *
 * It breathes. It is the only thing on a phone screen that is meant
 * to be reachable, so it is the only thing that is allowed to move
 * on its own.
 *
 * The breath is a ring that grows and fades, not the button itself.
 * A button that grows and shrinks under the finger is harder to
 * hit, and the ring does not get in the way of the tap.
 *
 * When the button opens a sheet, the icon turns into the shape of
 * the sheet it opened - the same way the original QuickAdd does.
 * The `open` prop says which state it is in.
 */
export default function FloatingAction({
  onClick,
  label,
  open = false,
  className = '',
  icon: Icon = Plus,
}) {
  const money = moneyLayerOn();

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-expanded={open || undefined}
      title={label}
      className={clsx(
        'relative flex items-center justify-center rounded-full',
        'bg-gradient-to-br from-primary-500 to-primary-600 text-white',
        'shadow-lg shadow-primary-500/30 h-14 w-14',
        'transition-transform duration-150 active:scale-95',
        money && 'money-fab money-morph',
        className
      )}
      style={money ? { '--money-fab-colour': 'rgb(16 185 129)' } : undefined}
    >
      <Icon className={clsx('w-7 h-7', money && 'money-morph-icon')} />
    </button>
  );
}
