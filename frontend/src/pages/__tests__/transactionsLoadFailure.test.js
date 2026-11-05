/**
 * The list of transactions must not lie about being empty.
 *
 * The page read its data with a promise that swallows failure. When
 * the server answered with an error, the page took it to mean "there
 * is nothing here", and showed "0 transaksi - Belum ada transaksi".
 *
 * That is the worst possible answer to give. The reader has four
 * transactions, and the page says there are none, and it says it
 * calmly, as if that were a fact about their life rather than a
 * failure to load.
 *
 * So the page has to tell the truth about the difference between
 * "there is nothing here" and "I could not ask".
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
    console.log(`  FAIL  ${name}`);
    console.log(`        ${err.message.split('\n')[0]}`);
  }
};

const PAGE = 'src/pages/Transactions.jsx';

check('the page keeps the failure of the transaction list', () => {
  const source = read(PAGE);
  // The failure of the list has to be noticed. It cannot be left to
  // be the same as an empty list.
  assert.ok(
    source.includes('txRes.status') || source.includes('rejected'),
    'the page does not look at whether the transaction list failed'
  );
});

check('the page says the list could not be loaded', () => {
  const source = read(PAGE);
  assert.ok(
    /loadError|setLoadError|loadFailed|couldNotLoad/.test(source),
    'the page has nowhere to say that the list could not be loaded'
  );
});

check('an empty list and a failed list are not shown the same', () => {
  const source = read(PAGE);
  // The empty state is shown only when there is genuinely nothing.
  // The failure state is a different thing.
  assert.ok(
    /loadError\s*&&|loadError\s*\?/.test(source) || /Gagal Memuat/.test(source),
    'the failure state is not separate from the empty state'
  );
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
