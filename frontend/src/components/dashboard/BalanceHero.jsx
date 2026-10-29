import { clsx } from 'clsx';
import AnimatedNumber from '../common/AnimatedNumber';
import { moneyLayerOn } from '../../utils/animation';

/**
 * The balance.
 *
 * The one number a reader came for, so it is the biggest thing on
 * the page and the only surface made of glass. Everything else on
 * the page is flat and quiet, which is what makes this one read as
 * the point.
 *
 * The number counts to its new value when it changes. `AnimatedNumber`
 * does that, and it will not count when the reader has asked for
 * less movement.
 */
export default function BalanceHero({
  label,
  value,
  format,
  icon: Icon,
  trend,
  className = '',
  children,
}) {
  const money = moneyLayerOn();

  return (
    <section
      className={clsx(
        'money-balance relative overflow-hidden',
        money && 'money-glass',
        className
      )}
    >
      <div className="relative z-10">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              {label}
            </p>

            <p className="mt-2 font-numeric font-bold leading-none text-gray-900 dark:text-gray-50 break-words">
              <AnimatedNumber value={value} format={format} />
            </p>

            {trend ? <div className="mt-3">{trend}</div> : null}
          </div>

          {Icon ? (
            <div className="shrink-0 rounded-2xl bg-white/70 dark:bg-white/10 p-3 text-gray-700 dark:text-gray-200 backdrop-blur-sm">
              <Icon className="h-6 w-6" />
            </div>
          ) : null}
        </div>

        {children ? <div className="mt-4">{children}</div> : null}
      </div>
    </section>
  );
}
