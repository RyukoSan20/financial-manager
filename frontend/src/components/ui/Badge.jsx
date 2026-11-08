import { clsx } from 'clsx';

/**
 * A badge.
 *
 * A badge is a small mark that says where something stands. It used
 * to be a soft pastel pill, which was quiet enough to disappear into
 * the card it sat on - the reader's eye went past it and read the
 * number instead, and the number was not the thing that mattered.
 *
 * The mark now has a tint of its own and a ring around it, so it
 * reads as a separate thing without being loud. It is also smaller:
 * a badge is a label, not a sentence, and the labels that need to be
 * read in full are the ones that were being shrunk.
 *
 * The variants are written out in full for each state, because
 * Tailwind's scanner reads the source and not the run time, and a
 * class built by a function never reaches the stylesheet.
 */
export const Badge = ({
  children,
  variant = 'default',
  size = 'md',
  className,
  ...props
}) => {
  const variants = {
    default: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200/70 dark:bg-white/10 dark:text-slate-200 dark:ring-white/15',
    success:
      'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/80 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30',
    danger:
      'bg-rose-50 text-rose-700 ring-1 ring-rose-200/80 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30',
    warning:
      'bg-amber-50 text-amber-800 ring-1 ring-amber-200/80 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30',
    primary:
      'bg-sky-50 text-sky-700 ring-1 ring-sky-200/80 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/30',
    outline:
      'bg-transparent text-slate-600 ring-1 ring-slate-200 dark:text-slate-300 dark:ring-white/15',
    secondary:
      'bg-violet-50 text-violet-700 ring-1 ring-violet-200/80 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-500/30',
  };

  const sizes = {
    // A badge is a label. It is small enough to read in one glance
    // and hold its words whole.
    sm: 'px-2 py-0.5 text-[11px] leading-4',
    md: 'px-2.5 py-0.5 text-xs leading-4',
    lg: 'px-3 py-1 text-sm leading-5',
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 font-medium rounded-full whitespace-nowrap shrink-0',
        variants[variant] || variants.default,
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};

export default Badge;
