/**
 * The health coach page and the shape of the answers it gets.
 *
 * The page reads the answer from the backend, and the answer is the
 * same money the dashboard and the analysis page show. The bug this
 * covers is a page that asks the right question and reads the wrong
 * shape of answer, so it shows nothing at all: the balance is five
 * million rupiah on the dashboard and zero on this page.
 *
 * The API client hands back the body of the answer, not a wrapper
 * around it. A page that asks for `.ok` and `.json()` of that body is
 * asking for a wrapper that is not there, and quietly ends up with
 * nothing.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..');

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let passed = 0;
let failed = 0;
const check = (name, fn) => {
  try {
    fn();
    passed += 1;
    console.log(`  ok  ${name}`);
  } catch (err) {
    failed += 1;
    console.log(`FAIL  ${name}: ${err.message}`);
  }
};

console.log('health coach');

const page = read('src/pages/HealthCoach.jsx');

check('the page does not ask the body whether it succeeded', () => {
  assert.ok(
    !/\w+Res\??\.ok/.test(page),
    'the body of an answer is not a response, so it has no .ok'
  );
  assert.ok(
    !/await \w+Res\.json\(\)/.test(page),
    'the body of an answer has already been read'
  );
});

check('the page takes the answer as it is given', () => {
  assert.ok(
    /setHealthData\(\s*scoreRes\s*\)/.test(page),
    'the score answer must be used as it comes back'
  );
  assert.ok(
    /setAuditData\(\s*auditRes\s*\)/.test(page),
    'the audit answer must be used as it comes back'
  );
});

check('the page still guards against an answer that never arrived', () => {
  assert.ok(
    /if \(scoreRes\)/.test(page),
    'a failed request gives nothing, and nothing must not be read as a score'
  );
  assert.ok(
    /if \(auditRes\)/.test(page),
    'a failed request gives nothing, and nothing must not be read as an audit'
  );
});

check('the page reads the cash and the score from the answer', () => {
  assert.ok(
    /total_cash/.test(page),
    'the page must show the cash the answer carries'
  );
  assert.ok(
    /healthData\??\.score|healthData\.score/.test(page),
    'the page must show the score the answer carries'
  );
});

check('the page asks the backend in the currency the reader is looking at', () => {
  assert.ok(
    /api\.healthCoach\.score\(displayCurrency\)/.test(page),
    'the balances must be converted before the ratios are worked out'
  );
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
