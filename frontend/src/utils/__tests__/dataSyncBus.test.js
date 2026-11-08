/**
 * The pages agree with each other.
 *
 * The application had six pages that showed the reader's money, and
 * they were six separate conversations with the server. A reader who
 * recorded a transaction on the dashboard went to the transactions
 * list and saw the old one, went to their profile and saw the old
 * balance, went to the budget and saw the old spending - until they
 * pressed the browser's refresh button.
 *
 * So there is one bus now. Anything that writes says what it wrote,
 * and anything that shows the consequence of that write hears it and
 * asks the server again.
 *
 * These checks hold that the bus exists, that the pages are on it,
 * and that the announcement happens after the write and not before.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');

const read = (relative) => readFileSync(join(ROOT, relative), 'utf8');

const check = (name, fn) => {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (err) {
    console.error(`not ok - ${name}`);
    console.error(`  ${err.message}`);
    process.exitCode = 1;
  }
};

// ---------------------------------------------------------------------------
// The bus
// ---------------------------------------------------------------------------

check('there is one bus, and it has the two ends', () => {
  const bus = read('src/utils/dataSyncBus.js');
  assert.ok(/export function emitDataMutated/.test(bus), 'there is no way to announce');
  assert.ok(/export function useOnDataMutated/.test(bus), 'there is no way to listen');
});

check('the bus carries the name of what changed', () => {
  const bus = read('src/utils/dataSyncBus.js');
  assert.ok(
    /detail:\s*\{\s*kind/.test(bus),
    'the announcement does not say what changed'
  );
});

check('the bus is one event, not one per page', () => {
  const bus = read('src/utils/dataSyncBus.js');
  const names = (bus.match(/EVENT_NAME\s*=\s*'([^']+)'/g) || []).length;
  assert.equal(names, 1, 'there is more than one event');
});

// ---------------------------------------------------------------------------
// The pages that hear
// ---------------------------------------------------------------------------

const LISTENERS = [
  'src/pages/Dashboard.jsx',
  'src/pages/Transactions.jsx',
  'src/pages/ProfileSummary.jsx',
  'src/pages/Budgets.jsx',
  'src/pages/HealthCoach.jsx',
  'src/pages/MerchantMap.jsx',
];

check('every page that shows money hears about a transaction', () => {
  for (const page of LISTENERS) {
    const source = read(page);
    assert.ok(
      /useOnDataMutated/.test(source),
      `${page} does not hear about changes`
    );
    assert.ok(
      /'transaction'/.test(source),
      `${page} does not hear about transactions`
    );
  }
});

check('the pages that hear, really fetch again', () => {
  // A listener that does not refetch is a listener that does
  // nothing. Each page has to call its own loader.
  const expectations = [
    ['src/pages/Transactions.jsx', 'fetchData'],
    ['src/pages/ProfileSummary.jsx', 'load'],
    ['src/pages/Budgets.jsx', 'fetchData'],
    ['src/pages/HealthCoach.jsx', 'loadHealthData'],
    ['src/pages/MerchantMap.jsx', 'fetchData'],
  ];
  for (const [page, loader] of expectations) {
    const source = read(page);
    // The import comes first, so the call is what is found.
    const listenerAt = source.indexOf('useOnDataMutated(\n');
    assert.ok(listenerAt !== -1, `${page} does not listen`);
    const around = source.slice(listenerAt, listenerAt + 400);
    assert.ok(
      around.includes(loader),
      `${page} listens but does not call ${loader} again`
    );
  }
});

// ---------------------------------------------------------------------------
// The pages that speak
// ---------------------------------------------------------------------------

const SPEAKERS = [
  'src/components/ai/TopAiCommandBar.jsx',
  'src/components/layout/AddTransactionPage.jsx',
  'src/pages/Transactions.jsx',
];

check('every page that writes a transaction announces it', () => {
  for (const page of SPEAKERS) {
    const source = read(page);
    assert.ok(
      /emitDataMutated/.test(source),
      `${page} writes a transaction and says nothing`
    );
  }
});

check('the announcement comes after the write', () => {
  // The announcement is a promise about the database, so it must not
  // be made before the server has confirmed the write.
  const checks = [
    ['src/components/layout/AddTransactionPage.jsx', 'api.transactions.create', 'emitDataMutated'],
    ['src/pages/Transactions.jsx', 'api.transactions.update', 'emitDataMutated'],
  ];
  for (const [page, write, announce] of checks) {
    const source = read(page);
    const writeAt = source.indexOf(write);
    const announceAt = source.indexOf(announce, writeAt);
    assert.ok(writeAt !== -1, `${page} has no write`);
    assert.ok(announceAt !== -1, `${page} has no announcement`);
    assert.ok(
      announceAt > writeAt,
      `${page} announces the change before it makes it`
    );
  }
});

check('the old event is gone', () => {
  for (const page of SPEAKERS) {
    const source = read(page);
    assert.ok(
      !/dispatchEvent\(new Event\('transactionUpdated'\)\)/.test(source),
      `${page} still uses the old event, which nothing listens to`
    );
  }
});

// ---------------------------------------------------------------------------
// The proof
// ---------------------------------------------------------------------------

check('the bar shows the transaction it really wrote', () => {
  const bar = read('src/components/ai/TopAiCommandBar.jsx');
  assert.ok(
    /writtenTransaction/.test(bar),
    'the bar keeps no record of what it wrote'
  );
  assert.ok(
    /action_executed\s*===\s*'transaction_created'/.test(bar),
    'the bar does not check that a row was really written'
  );
  assert.ok(
    /to="\/transactions"/.test(bar),
    'the badge does not link to the list of transactions'
  );
  assert.ok(
    /saved_badge/.test(bar),
    'the badge does not say what it is'
  );
});

check('the bar does not announce a write it did not make', () => {
  const bar = read('src/components/ai/TopAiCommandBar.jsx');
  // The announcement is inside the branch where the server said a
  // row was written.
  const announceAt = bar.indexOf("emitDataMutated('transaction'");
  const guardAt = bar.indexOf("action_executed === 'transaction_created'");
  assert.ok(announceAt !== -1, 'the bar never announces');
  assert.ok(guardAt !== -1, 'the bar never checks');
  assert.ok(
    guardAt < announceAt,
    'the bar announces before it has checked'
  );
});

check('the answer is in the flow of the page, not over it', () => {
  const bar = read('src/components/ai/TopAiCommandBar.jsx');
  // The answer used to be absolute, so it floated over the header
  // and the buttons beneath it and the two ran into each other.
  const answerAt = bar.indexOf('open && (answer || error || busy)');
  assert.ok(answerAt !== -1, 'the answer is not there');
  const around = bar.slice(answerAt, answerAt + 1400);
  assert.ok(
    !/className="[^"]*\babsolute\b/.test(around),
    'the answer still floats over the page'
  );
  assert.ok(
    /\brelative\b/.test(around),
    'the answer is not in the flow of the page'
  );
  // And the surface is solid: there is nothing behind it to bleed
  // through.
  assert.ok(
    /\bbg-white\b/.test(around) && !/bg-white\/8/.test(around),
    'the answer is still see-through'
  );
});
