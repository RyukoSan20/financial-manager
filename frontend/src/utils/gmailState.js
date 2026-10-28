/**
 * What the Gmail page should show.
 *
 * The page used to work this out in two places at once: the title was
 * written from whether Gmail was connected, and the line under it was
 * written from whether the check had finished. While the check was
 * still running that put "Belum Terhubung" next to "Memuat...", which
 * said two things at once, and neither of them was true yet.
 *
 * So the state is worked out here, in one place, and the page asks.
 * There is exactly one answer, and it carries everything the page
 * needs: the title, the message, and which buttons to offer.
 *
 * These are plain functions with no React in them, so they can be
 * checked by a script.
 */

/**
 * The states the server can report, and what each one means.
 *
 * The server sends a code rather than a sentence, so the page can say
 * it in the reader's own language. The codes here are the same ones
 * the server sends.
 */
export const GMAIL_STATES = [
  'checking',
  'not_connected',
  'connected',
  'not_configured',
  'needs_reauth',
];

/**
 * Work out what the page should show.
 *
 * @param checking   whether the check is still running
 * @param connected  whether Gmail is connected
 * @param state      the code the server sent, if it sent one
 * @param configured whether the server has Google set up at all
 *
 * @returns {{ state, titleKey, messageKey, showConnect, showDisconnect,
 *             showNotConfiguredNote }}
 */
export function gmailView({ checking, connected, state, configured } = {}) {
  // While the check is running, that is all the page says. Nothing is
  // known yet, so nothing is claimed.
  if (checking) {
    return {
      state: 'checking',
      titleKey: 'gmail_integration.state_checking',
      messageKey: 'gmail_integration.state_checking',
      showConnect: false,
      showDisconnect: false,
      showNotConfiguredNote: false,
    };
  }

  // The server that cannot do it at all says so, and offers no button
  // that would fail.
  if (configured === false || state === 'not_configured') {
    return {
      state: 'not_configured',
      titleKey: 'gmail_integration.not_configured_title',
      messageKey: 'gmail_integration.state_not_configured',
      showConnect: false,
      showDisconnect: false,
      showNotConfiguredNote: true,
    };
  }

  // Connected is the server's word, and it is trusted: it is only sent
  // when there is a token that works.
  if (connected === true || state === 'connected') {
    return {
      state: 'connected',
      titleKey: 'gmail_integration.connected_title',
      messageKey: 'gmail_integration.state_connected',
      showConnect: false,
      showDisconnect: true,
      showNotConfiguredNote: false,
    };
  }

  // The token is there but it has to be renewed by hand.
  if (state === 'needs_reauth') {
    return {
      state: 'needs_reauth',
      titleKey: 'gmail_integration.not_connected_title',
      messageKey: 'gmail_integration.state_needs_reauth',
      showConnect: true,
      showDisconnect: false,
      showNotConfiguredNote: false,
    };
  }

  // The ordinary case: not connected, and it can be connected.
  return {
    state: 'not_connected',
    titleKey: 'gmail_integration.not_connected_title',
    messageKey: 'gmail_integration.state_not_connected',
    showConnect: true,
    showDisconnect: false,
    showNotConfiguredNote: false,
  };
}

export default { gmailView, GMAIL_STATES };
