/**
 * A page that is behind a switch.
 *
 * The shared bill is off by default. When it is off, the page is not
 * there: the reader who follows a stale bookmark lands on the page
 * they know, and nothing about their records has changed.
 *
 * The guest claim page is a different case. It is behind a switch
 * too, but a guest cannot turn switches on - they have no account
 * and no settings. So the guest page is guarded by the switch that
 * the host turned on, and it says so plainly when it is off.
 */

import { Navigate } from 'react-router-dom';
import { readerFlag } from '../../utils/featureFlags';

/**
 * Is the shared bill on for this reader?
 */
export function splitBillOn() {
  return readerFlag('SMART_SPLIT_BILL');
}

/**
 * Is the guest claim page on?
 *
 * It follows the shared bill, because a guest cannot be given a
 * switch of their own.
 */
export function liveClaimOn() {
  return splitBillOn() && readerFlag('LIVE_CLAIM');
}

/**
 * A page that is only there when its switch is on.
 *
 * When the switch is off, the reader goes back to the list of
 * transactions rather than to a page that says the feature is
 * switched off. A dead end is a worse answer than the page they
 * came from.
 */
export function FlaggedRoute({ flag, children, fallback = '/' }) {
  if (!readerFlag(flag)) {
    return <Navigate to={fallback} replace />;
  }
  return children;
}
