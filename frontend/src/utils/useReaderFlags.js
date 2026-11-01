/**
 * The switches, and knowing when they change.
 *
 * A switch is kept in the browser's own storage. A menu that reads
 * that storage when it draws is correct when the page loads, but it
 * says nothing about a switch the reader has just turned on: the
 * menu is not redrawn, so the thing the reader just asked for does
 * not appear until the page is loaded again.
 *
 * That is not a small thing. A reader who turns on the shared bill
 * and sees no change concludes that the feature is not there.
 *
 * This hook listens for the change. The switches are written with
 * the same storage event that the browser fires between windows, and
 * the writing side fires it too, so turning a switch on updates the
 * menu at once, in this window and in any other one.
 */

import { useEffect, useState } from 'react';
import { READER_FLAG_CHANGED } from './featureFlags';

/**
 * Redraws the caller when one of the switches changes.
 *
 * The caller reads the switches when it draws, so a redraw is what
 * makes the change visible.
 */
export function useReaderFlags() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const onChanged = () => setTick((n) => n + 1);

    // The event the writing side fires.
    window.addEventListener(READER_FLAG_CHANGED, onChanged);
    // The event the browser fires between windows. It does not fire
    // in the window that made the change, which is why the one above
    // exists.
    window.addEventListener('storage', onChanged);

    return () => {
      window.removeEventListener(READER_FLAG_CHANGED, onChanged);
      window.removeEventListener('storage', onChanged);
    };
  }, []);

  return true;
}

export default useReaderFlags;
