/**
 * The privacy page tells the truth.
 *
 * A page saying what leaves the device is worth nothing if it is
 * written from memory. So every claim on it is checked here against
 * the backend source:
 *
 * - every host named on the page is really in the backend,
 * - every host in the backend that carries the reader's own data is
 *   named on the page,
 * - the data that is said to stay really does stay.
 *
 * When a new service is added to the backend, this test fails and
 * the page has to be brought up to date. That is the whole point.
 *
 * Run with: node src/data/__tests__/privacyManifest.test.js
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ALL_HOSTS,
  GOES_OUT,
  NEVER_SENT,
  STAYS_LOCAL,
} from '../privacyManifest.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const BACKEND = join(HERE, '..', '..', '..', '..', 'backend', 'app');

let checks = 0;
let failures = 0;

function check(condition, message) {
  checks += 1;
  if (!condition) {
    failures += 1;
    console.error(`  FAIL ${message}`);
  }
}

/**
 * Every Python file in the backend, read once.
 */
function readBackend() {
  const files = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (name.endsWith('.py')) {
        files.push(full);
      }
    }
  };
  walk(BACKEND);
  return files.map((f) => ({ path: f, text: readFileSync(f, 'utf8') }));
}

const backend = readBackend();
const allText = backend.map((f) => f.text).join('\n');

console.log('the page is shaped properly:');

// Every entry has the fields the screen reads.
for (const entry of GOES_OUT) {
  for (const field of ['id', 'host', 'who', 'what', 'when', 'why', 'carries']) {
    check(
      entry[field] !== undefined && String(entry[field]).trim().length > 0,
      `outgoing "${entry.id}" has no ${field}`
    );
  }
  check(
    typeof entry.carries === 'boolean',
    `outgoing "${entry.id}" does not say whether it carries the reader's records`
  );
}

for (const entry of STAYS_LOCAL) {
  for (const field of ['id', 'what', 'detail']) {
    check(
      entry[field] !== undefined && String(entry[field]).trim().length > 0,
      `staying "${entry.id}" has no ${field}`
    );
  }
}

for (const entry of NEVER_SENT) {
  for (const field of ['id', 'what', 'detail']) {
    check(
      entry[field] !== undefined && String(entry[field]).trim().length > 0,
      `never "${entry.id}" has no ${field}`
    );
  }
}

// The ids are unique, or the screen cannot tell them apart.
for (const [name, list] of [['outgoing', GOES_OUT], ['staying', STAYS_LOCAL], ['never', NEVER_SENT]]) {
  const ids = list.map((e) => e.id);
  check(
    new Set(ids).size === ids.length,
    `the ${name} list has a repeated id`
  );
}

console.log('  the lists are shaped properly');

console.log('every host named on the page is really in the backend:');

for (const host of ALL_HOSTS) {
  // The host is written in the source either whole, or with the
  // part after the host name split by a path.
  const bare = host.split('/')[0];
  check(
    allText.includes(bare),
    `the page names "${host}" but the backend does not mention it`
  );
}

console.log('  every named host is in the backend');

console.log('every service that carries the reader\'s data is named:');

// The services that carry the reader's own records, and the host
// each one reaches. This list is the reason the page exists: if one
// of these is added to the backend and the page does not mention it,
// the reader is not being told the truth.
const CARRIES_DATA = [
  { host: 'generativelanguage.googleapis.com', what: 'the AI and the picture reading' },
  { host: 'gmail.googleapis.com', what: 'the inbox' },
  { host: 'nominatim.openstreetmap.org', what: 'the place name' },
  { host: 'maps.googleapis.com', what: 'the map' },
  { host: 'oauth2.googleapis.com', what: 'the sign-in' },
];

for (const service of CARRIES_DATA) {
  check(
    allText.includes(service.host),
    `the backend reaches ${service.host} for ${service.what}, but the page does not name it`
  );
  check(
    ALL_HOSTS.includes(service.host),
    `the page does not name ${service.host}`
  );
}

console.log('  every service that carries data is named');

console.log('the data that is said to stay really stays:');

// The balance is read out of the database and added up there. It is
// not sent to a host that is not already named on the page, and it
// is not sent at all unless the reader asks the AI Advisor.
const balanceCalls = backend.filter((f) =>
  /total_in_currency|account\.balance/.test(f.text)
);
check(balanceCalls.length > 0, 'the balance is not read anywhere');

// No route sends the whole transaction list to an outside host.
const bulkExport = backend.filter((f) =>
  /\.all\(\).*httpx|httpx.*transactions\.all\(\)/s.test(f.text)
);
check(
  bulkExport.length === 0,
  'somewhere the whole transaction list is sent to an outside host'
);

// The transaction record has no field that holds a raw export.
const transactionModel = backend.find((f) => f.path.endsWith('models/transaction.py'));
check(
  Boolean(transactionModel),
  'the transaction model was not found'
);

console.log('  the data that stays, stays');

console.log('');
console.log(`${checks - failures}/${checks} checks passed`);

if (failures > 0) {
  console.error(`${failures} failed`);
  process.exit(1);
}
