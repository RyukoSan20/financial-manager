import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';

/**
 * A dialog that behaves like a dialog on a phone.
 *
 * Three things had to be true at once, and none of them was true:
 *
 * 1. The panel has to stand above the page.
 *
 *    The page settles into place when it appears, and settling means
 *    moving, and an element that moves creates a layer of its own.
 *    The z-index of a dialog inside that layer only counts inside
 *    that layer, so the bar at the bottom of the phone - which is a
 *    sibling of the page, not a child of it - came out on top. The
 *    panel was rendered into the page and the buttons at its foot were
 *    under the bar.
 *
 *    So the panel is put on the body itself, where the layer question
 *    does not come up, and where the z-index is compared with the bar
 *    directly.
 *
 * 2. The close button has to be reachable.
 *
 *    It is in the head of the panel, the head does not move when the
 *    panel is taller than the screen, and the head is the one part of
 *    the panel that is always on screen.
 *
 * 3. The buttons at the foot have to be reachable.
 *
 *    The panel is never taller than the screen. What does not fit is
 *    scrolled, and the foot stays where it is.
 */
export const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  footer = null,
  bodyClassName = '',
}) => {
  // The callback of the close button changes every time the page
  // renders, so it is kept in a box. Without the box the listener
  // would be taken off and put on again on every render of the page,
  // and the page behind the panel would flicker between scrollable
  // and not.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    if (!isOpen) return undefined;

    // Escape closes the dialog, as a dialog should.
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        closeRef.current?.();
      }
    };

    document.addEventListener('keydown', onKeyDown);

    // The page behind the panel must not scroll while the panel is
    // open, or the reader loses their place.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-full',
  };

  const panel = (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4">
      {/* The dimming. Clicking it closes the dialog. */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        // The dialog role and aria-modal are how anything on the
        // page can tell that a dialog is open - the companion
        // closes its board when it sees one, so it is never left
        // floating over a form.
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Dialog'}
        className={clsx(
          // The panel is a column: the head stays, the middle
          // scrolls, the foot stays.
          'relative bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full settle-in',
          'flex flex-col max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)]',
          // A phone keeps a bar at the bottom of the screen. The
          // panel sits above it.
          'pb-[calc(4.5rem+env(safe-area-inset-bottom))] sm:pb-0',
          sizes[size]
        )}
      >
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
            <h3 className="text-lg font-semibold">{title}</h3>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="text-gray-400 hover:text-gray-600 pressable flex-shrink-0 p-1 -m-1"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        <div className={clsx('p-6 overflow-y-auto flex-1 min-h-0', bodyClassName)}>
          {children}
        </div>

        {footer && (
          <div className="px-6 py-4 border-t flex-shrink-0 bg-white dark:bg-gray-900 rounded-b-2xl sm:rounded-b-xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  // On the body itself, not inside the page.
  return createPortal(panel, document.body);
};

export default Modal;
