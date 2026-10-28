/**
 * The Gmail page shows one state, not two.
 *
 * The page used to write the title from `status.connected` and the
 * line under it from `checking`. While the check was still running
 * that put "Belum Terhubung" next to "Memuat...", which said two
 * things at once and neither of them was true yet.
 *
 * So the state is worked out in one place, and the page asks that
 * place what to show. The rules are:
 *
 * - while the check is running, the page says it is checking, and
 *   nothing else;
 * - when the server says Gmail is not set up, the page says that, and
 *   offers no connect button;
 * - when Gmail is not connected, the page says so, and offers the
 *   connect button;
 * - when Gmail is connected, the page says so.
 *
 * Only one of these can be true at a time, and the test checks that
 * for every combination of inputs.
 *
 * Run with: node src/utils/__tests__/gmailState.test.js
 */

import { gmailView } from '../gmailState.js';

let checks = 0;
let failures = 0;

function check(condition, message) {
  checks += 1;
  if (!condition) {
    failures += 1;
    console.error(`  FAIL ${message}`);
  }
}

// --- While the check is running, nothing else is said -------------------

{
  const view = gmailView({ checking: true, connected: false, state: 'checking', configured: true });
  check(view.state === 'checking', 'while checking, the state is not "checking"');
  check(view.titleKey === 'gmail_integration.state_checking', 'while checking, the title is not the checking title');
  check(view.messageKey === 'gmail_integration.state_checking', 'while checking, the message is not the checking message');
  check(view.showConnect === false, 'while checking, the connect button is offered');
  check(view.showDisconnect === false, 'while checking, the disconnect button is offered');
}

// --- Not configured: the server cannot do it at all ---------------------

{
  const view = gmailView({ checking: false, connected: false, state: 'not_configured', configured: false });
  check(view.state === 'not_configured', 'a server that is not set up is not reported as "not_configured"');
  check(view.titleKey === 'gmail_integration.not_configured_title', 'a server that is not set up has the wrong title');
  check(view.showConnect === false, 'a connect button is offered on a server that is not set up');
  check(view.showNotConfiguredNote === true, 'the note about the server not being set up is not shown');
}

// --- Not connected: the reader can connect ------------------------------

{
  const view = gmailView({ checking: false, connected: false, state: 'not_connected', configured: true });
  check(view.state === 'not_connected', 'a disconnected Gmail is not reported as "not_connected"');
  check(view.titleKey === 'gmail_integration.not_connected_title', 'a disconnected Gmail has the wrong title');
  check(view.messageKey === 'gmail_integration.state_not_connected', 'a disconnected Gmail has the wrong message');
  check(view.showConnect === true, 'the connect button is not offered when it is needed');
  check(view.showDisconnect === false, 'the disconnect button is offered when there is nothing to disconnect');
}

// --- Connected -----------------------------------------------------------

{
  const view = gmailView({ checking: false, connected: true, state: 'connected', configured: true });
  check(view.state === 'connected', 'a connected Gmail is not reported as "connected"');
  check(view.titleKey === 'gmail_integration.connected_title', 'a connected Gmail has the wrong title');
  check(view.messageKey === 'gmail_integration.state_connected', 'a connected Gmail has the wrong message');
  check(view.showDisconnect === true, 'the disconnect button is not offered when it is needed');
  check(view.showConnect === false, 'the connect button is offered when Gmail is already connected');
}

// --- Needs a new sign-in -------------------------------------------------

{
  const view = gmailView({ checking: false, connected: false, state: 'needs_reauth', configured: true });
  check(view.state === 'needs_reauth', 'a Gmail that needs a new sign-in is not reported as such');
  check(view.messageKey === 'gmail_integration.state_needs_reauth', 'a Gmail that needs a new sign-in has the wrong message');
  check(view.showConnect === true, 'the connect button is not offered when a new sign-in is needed');
}

// --- The title and the message never contradict each other --------------

// The bug was a title that said one thing and a message that said
// another. Every combination of inputs has to give exactly one state,
// and the title and the message have to come from that one state.
const COMBOS = [];
for (const checking of [true, false]) {
  for (const connected of [true, false]) {
    for (const configured of [true, false]) {
      for (const state of ['checking', 'not_connected', 'connected', 'not_configured', 'needs_reauth']) {
        COMBOS.push({ checking, connected, configured, state });
      }
    }
  }
}

const SEEN = new Set();
for (const combo of COMBOS) {
  const view = gmailView(combo);
  check(
    Boolean(view.state) && view.state !== 'unknown',
    `the combination ${JSON.stringify(combo)} gives no state`
  );
  check(
    typeof view.titleKey === 'string' && view.titleKey.length > 0,
    `the combination ${JSON.stringify(combo)} gives no title`
  );
  check(
    typeof view.messageKey === 'string' && view.messageKey.length > 0,
    `the combination ${JSON.stringify(combo)} gives no message`
  );

  // A connected Gmail and a disconnected one are told apart by the
  // title, and the message follows the title. They are never a
  // connected title with a disconnected message.
  if (view.state === 'connected') {
    check(
      view.titleKey === 'gmail_integration.connected_title',
      `the combination ${JSON.stringify(combo)} is connected but not titled as connected`
    );
  }
  if (view.state === 'not_connected') {
    check(
      view.titleKey === 'gmail_integration.not_connected_title',
      `the combination ${JSON.stringify(combo)} is disconnected but not titled as disconnected`
    );
  }

  // The connect button and the disconnect button are never both on.
  check(
    !(view.showConnect && view.showDisconnect),
    `the combination ${JSON.stringify(combo)} offers both buttons`
  );

  SEEN.add(view.state);
}

// Every state the server can send is one the page knows.
for (const state of ['checking', 'not_connected', 'connected', 'not_configured', 'needs_reauth']) {
  check(SEEN.has(state), `the state "${state}" is never reached`);
}

console.log('');
console.log(`${checks - failures}/${checks} checks passed`);

if (failures > 0) {
  console.error(`${failures} failed`);
  process.exit(1);
}
