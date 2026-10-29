/**
 * Guest login must work on a machine that has no Supabase.
 *
 * Run with: node src/context/__tests__/guestLogin.test.js
 *
 * The guest button used to refuse to do anything unless Supabase was
 * set up. The message it showed was "Guest login is not available",
 * which was true of the code and false of the application: the
 * backend has always been able to make a guest account, and the
 * frontend function that calls it never used Supabase at all.
 *
 * The effect was that a developer without Supabase credentials could
 * not get into the application, and the only way to see any of the
 * work was to set up a database and a real account first.
 *
 * The check here reads the source of the context and asks the
 * questions that matter:
 *
 * - does the guest login call the backend?
 * - is it refused when Supabase is not configured?
 * - is there a dead reference to the old function name?
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(join(HERE, '..', 'AuthContext.jsx'), 'utf-8');

let passed = 0;
let failed = 0;
const failures = [];

function check(name, condition, detail) {
  if (condition) {
    passed += 1;
  } else {
    failed += 1;
    failures.push(`${name}${detail ? `\n    ${detail}` : ''}`);
  }
}

// ---------------------------------------------------------------------------
// The guest login calls the backend
// ---------------------------------------------------------------------------

const guestFn = SOURCE.match(/const backendGuestLogin = async \(\) => \{([\s\S]*?)\n {2}\};/);
check('there is a backend guest login', Boolean(guestFn));

if (guestFn) {
  const body = guestFn[1];
  check(
    'it posts to the guest endpoint',
    body.includes('/guest'),
    `the body was: ${body.slice(0, 120)}`
  );
  check('it sends a device id', body.includes('device_id'));
}

// ---------------------------------------------------------------------------
// It is not refused when Supabase is missing
// ---------------------------------------------------------------------------

const guestLogin = SOURCE.match(/const guestLogin = async \(\) => \{([\s\S]*?)\n {2}\};/);
check('there is a guest login', Boolean(guestLogin));

if (guestLogin) {
  // The comments in the source explain what used to happen, so the
  // check is on the code and not on the whole block. A comment that
  // mentions the old message is not a refusal.
  const body = guestLogin[1]
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');

  check(
    'it does not ask whether Supabase is configured',
    !body.includes('isSupabaseConfigured'),
    'the guest login was still conditional on Supabase being set up'
  );

  check(
    'it does not refuse with a message',
    !body.includes('belum tersedia') && !body.includes('not available'),
    'the guest login still refuses to do anything'
  );

  check(
    'it does not throw',
    !body.includes('throw'),
    'the guest login still throws instead of asking the backend'
  );

  check(
    'it calls the backend guest login',
    body.includes('backendGuestLogin'),
    `the body was: ${body.slice(0, 160)}`
  );
}

// ---------------------------------------------------------------------------
// Nothing refers to the old name
// ---------------------------------------------------------------------------

check(
  'the old function name is gone',
  !SOURCE.includes('supabaseGuestLogin'),
  'supabaseGuestLogin is still in the file. It does not use Supabase, so the name was a lie.'
);

// ---------------------------------------------------------------------------
// The Supabase sign-in still works
// ---------------------------------------------------------------------------

check(
  'the Google sign-in still goes through Supabase',
  SOURCE.includes('supabaseGoogleLogin') || SOURCE.includes('/google/url'),
  'the Google sign-in was removed by mistake'
);

check(
  'the logout still knows about Supabase',
  SOURCE.includes('supabaseLogout'),
  'the logout was removed by mistake'
);

// ---------------------------------------------------------------------------

console.log(`guestLogin: ${passed} passed, ${failed} failed`);
if (failed) {
  console.log(failures.join('\n\n'));
  process.exit(1);
}
