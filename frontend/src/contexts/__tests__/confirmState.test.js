/**
 * The question has to be taken off the screen when it is answered.
 *
 * This is the bug that was found by driving the real application in a
 * browser: a transaction was deleted, the server answered 204, and
 * the question "delete this transaction?" was still on the screen.
 *
 * The cause was that the promise was settled but the state that
 * decides whether the question is drawn was not cleared, and the two
 * were in different places.
 *
 * These tests check that answering the question does both.
 *
 * Run with: node src/contexts/__tests__/confirmState.test.js
 */

import {
  ask,
  settle,
  isOpen,
  currentRequest,
  REQUEST_EVENT,
  ANSWERED_EVENT,
} from '../confirmState.js';

let passed = 0;
let failed = 0;
const failures = [];

function check(name, actual, expected) {
  if (actual === expected) {
    passed += 1;
  } else {
    failed += 1;
    failures.push(
      `${name}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`
    );
  }
}

// A stand-in for the browser's event target.
const listeners = new Map();
globalThis.window = {
  dispatchEvent(event) {
    const handlers = listeners.get(event.type) || [];
    handlers.forEach((handler) => handler(event));
    return true;
  },
  addEventListener(type, handler) {
    const handlers = listeners.get(type) || [];
    handlers.push(handler);
    listeners.set(type, handlers);
  },
  removeEventListener(type, handler) {
    const handlers = listeners.get(type) || [];
    listeners.set(
      type,
      handlers.filter((h) => h !== handler)
    );
  },
};
globalThis.CustomEvent = class CustomEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.detail = options.detail;
  }
};

// A stand-in for the provider: it draws the question when it is asked
// and takes it away when it is answered. This is what the provider in
// ConfirmContext.jsx does.
let drawn = null;
listeners.set(REQUEST_EVENT, [
  (event) => {
    drawn = event.detail;
  },
]);
listeners.set(ANSWERED_EVENT, [
  () => {
    drawn = null;
  },
]);

async function main() {
  // --- the ordinary case ------------------------------------------------
  {
    drawn = null;
    const promise = ask({ message: 'Delete this transaction?', tone: 'danger' });
    check('the question is drawn', drawn?.message, 'Delete this transaction?');
    check('the question is open', isOpen(), true);

    settle(true);
    const answer = await promise;
    check('the answer is yes', answer, true);
    check('the question is taken off the screen', drawn, null);
    check('the question is no longer open', isOpen(), false);
  }

  // --- saying no --------------------------------------------------------
  {
    drawn = null;
    const promise = ask({ message: 'Delete this goal?' });
    settle(false);
    const answer = await promise;
    check('the answer is no', answer, false);
    check('the question is taken off the screen', drawn, null);
    check('the question is no longer open', isOpen(), false);
  }

  // --- the promise is settled even when nothing asks for it -----------
  {
    drawn = null;
    const promise = ask({ message: 'Delete this account?' });
    // A second question is asked before the first is answered.
    const second = ask({ message: 'Delete this budget?' });
    check(
      'the first question is taken off the screen',
      drawn?.message,
      'Delete this budget?'
    );
    const first = await promise;
    check('the first question is answered with no', first, false);
    settle(true);
    check('the second question is answered with yes', await second, true);
    check('the question is taken off the screen', drawn, null);
  }

  // --- the question that is on screen is the one that was asked -------
  {
    drawn = null;
    const promise = ask({ message: 'Sign out of Gmail?' });
    check('the question on screen is the one asked', currentRequest()?.message, 'Sign out of Gmail?');
    settle(false);
    await promise;
    check('there is no question left', currentRequest(), null);
  }

  // --- answering when nothing is open is harmless ----------------------
  {
    drawn = null;
    settle(true);
    check('answering nothing does not open a question', isOpen(), false);
    check('answering nothing leaves the screen alone', drawn, null);
  }

  console.log(`\nconfirmState: ${passed} passed, ${failed} failed`);
  if (failures.length) {
    failures.forEach((f) => console.log(`\n  FAIL ${f}`));
    process.exit(1);
  }
}

main();
