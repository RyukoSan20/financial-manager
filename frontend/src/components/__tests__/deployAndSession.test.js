/**
 * A deployment must not sign the reader out.
 *
 * The backend is restarted for every deployment that changes it, and
 * for a few seconds it is not answering. The reader's browser is
 * asking at that moment, and the answers come back as 502.
 *
 * Two things went wrong because of it:
 *
 * - the sign-in check threw the token away for any answer that was
 *   not "fine", so a reader was signed out in the middle of a
 *   deployment for no reason at all;
 * - the deployment waited for the backend on its own port, which is
 *   not the way the reader reaches it, so the deploy moved on while
 *   nginx was still answering 502.
 *
 * These checks hold both.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..', '..');
const read = (relative) => readFileSync(join(ROOT, relative), 'utf8');

let passed = 0;
let failed = 0;
const check = (name, fn) => {
  try {
    fn();
    passed += 1;
    console.log(`ok - ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`not ok - ${name}`);
    console.error(`  ${err.message}`);
  }
};

const AUTH = read('frontend/src/context/AuthContext.jsx');
const DEPLOY = read('.github/workflows/deploy.yml');

// ---------------------------------------------------------------------------
// The sign-in check
// ---------------------------------------------------------------------------

check('a server that is busy is not the end of the session', () => {
  // The backend is restarted for a deployment and answers 502 for a
  // few seconds. The token was thrown away for that, and the reader
  // was signed out mid-deployment.
  assert.ok(
    AUTH.includes('res.status === 401 || res.status === 403'),
    'only an answer that says the session is over clears the token'
  );
  assert.ok(
    !/}\s*else\s*\{\s*localStorage\.removeItem\('token'\);/.test(AUTH),
    'there is no branch that clears the token for every other answer'
  );
});

check('the token is still cleared when the session really is over', () => {
  const block = AUTH.slice(AUTH.indexOf('const checkBackendAuth'));
  const branch = block.slice(block.indexOf('res.status === 401'));
  assert.ok(branch.includes("localStorage.removeItem('token')"), 'the token goes');
  assert.ok(branch.includes("localStorage.removeItem('user')"), 'and the user');
});

check('the sign-in check is still there and still asks the server', () => {
  assert.ok(AUTH.includes('const checkBackendAuth = async () => {'), 'the check exists');
  assert.ok(AUTH.includes('/me'), 'it asks who the reader is');
  assert.ok(AUTH.includes('checkBackendAuth();'), 'and it is called');
});

check('a token with no stored user survives a server that is busy', () => {
  // The same thing happened in the other place: a token with no
  // stored user was checked against the server, and any failure
  // threw it away.
  const block = AUTH.slice(AUTH.indexOf('} else if (backendToken) {'));
  // The branch runs to the end of the "else if" block.
  const branch = block.slice(0, block.indexOf('\n    }\n'));
  assert.ok(
    branch.includes('res.status === 401 || res.status === 403'),
    'only an answer that says the session is over throws the token away'
  );
  assert.ok(branch.includes('return null;'), 'and the other answers keep the token');
});

check('the reader is signed in from what is stored, before the server is asked', () => {
  // The stored user is used straight away, so a page that opens
  // during a deployment still shows the reader their own name.
  assert.ok(AUTH.includes("const backendToken = localStorage.getItem('token')"), 'the token is read');
  assert.ok(AUTH.includes('setUser(JSON.parse(backendUser))'), 'and the reader is set from what is stored');
});

// ---------------------------------------------------------------------------
// The deployment
// ---------------------------------------------------------------------------

check('the deployment waits for the backend the way the reader reaches it', () => {
  const step = DEPLOY.slice(DEPLOY.indexOf('- name: Restart backend'));
  const script = step.slice(step.indexOf('script: |'), step.indexOf('- name:', step.indexOf('script: |') + 10));

  assert.ok(script.includes('docker compose restart backend'), 'the backend is restarted');
  assert.ok(
    script.includes('http://localhost/health'),
    'and the wait is against the address the reader uses, not the container port'
  );
  assert.ok(script.includes('Backend healthy through nginx'), 'the wait says what it is waiting for');
});

check('the wait is a wait and not a single try', () => {
  const step = DEPLOY.slice(DEPLOY.indexOf('- name: Restart backend'));
  const script = step.slice(step.indexOf('script: |'), step.indexOf('- name:', step.indexOf('script: |') + 10));
  assert.ok(script.includes('seq 1 24'), 'it is tried again');
  assert.ok(script.includes('sleep 2'), 'and it waits between tries');
  assert.ok(script.includes('::error::Backend did not become healthy'), 'and it fails loudly if it never comes up');
});

check('the smoke test still runs after the restart', () => {
  const restart = DEPLOY.indexOf('- name: Restart backend');
  const smoke = DEPLOY.indexOf('- name: Smoke test');
  assert.ok(restart !== -1 && smoke !== -1, 'both steps are there');
  assert.ok(restart < smoke, 'the smoke test is after the restart');
  assert.ok(DEPLOY.includes('my-financial-manager.online/api/household'), 'and it checks the household route');
});

// ---------------------------------------------------------------------------

console.log('');
console.log(`the deployment and the session: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
