import { useEffect, useRef } from 'react';
import { clsx } from 'clsx';
import { moneyLayerOn } from '../../utils/animation';

/**
 * A sheet that arrives with a spring.
 *
 * The modals in the application faded in over a dark backdrop, and
 * the panel itself did not move at all. It appeared. A sheet that
 * arrives from slightly below and settles is read as something being
 * handed to the reader.
 *
 * The spring is small - about three per cent - because a large
 * overshoot reads as a toy.
 *
 * The body scroll is locked while the sheet is open, because a page
 * that scrolls under an open sheet is a small trap: the reader
 * scrolls, nothing moves, and it looks broken.
 */
export default function Sheet({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  className = '',
}) {
  const panelRef = useRef(null);

  // Keep the page from scrolling behind the sheet.
  useEffect(() => {
    if (!isOpen) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  // The first control inside the sheet takes the focus, so a reader
  // using the keyboard is not left behind on the page underneath.
  useEffect(() => {
    if (!isOpen) return;
    const node = panelRef.current;
    if (!node) return;
    const focusable = node.querySelector(
      'input, select, textarea, button:not([data-sheet-close])'
    );
    if (focusable && typeof focusable.focus === 'function') {
      focusable.focus({ preventScroll: true });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  const money = moneyLayerOn();

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-end sm:items-center justify-center sm:p-4">
        <div
          className={clsx(
            'fixed inset-0 bg-gray-900/50 dark:bg-black/70',
            money && 'money-sheet-backdrop'
          )}
          onClick={onClose}
        />
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          className={clsx(
            'relative bg-white dark:bg-gray-800 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full dark:border dark:border-white/10',
            sizes[size],
            money && 'money-sheet money-glass',
            className
          )}
        >
          {title ? (
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/10">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {title}
              </h3>
              <button
                type="button"
                data-sheet-close
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 pressable"
                aria-label="Close"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          ) : null}
          <div className="p-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
