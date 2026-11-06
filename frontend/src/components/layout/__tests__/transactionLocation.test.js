/**
 * The place a transaction happened at.
 *
 * The reader can say where they were. The page asks the phone for the
 * coordinates, or the reader types the name of the place. Either way
 * the place is on the screen, with a tick beside it, and the reader
 * believes it is kept.
 *
 * It was not kept. The coordinates were collected, put in a corner of
 * the page, and never sent with the transaction. The place was drawn
 * on the sheet the reader was looking at, and then thrown away when
 * they saved.
 *
 * The map is where a place becomes useful, because the map reads the
 * coordinates off the transaction. A transaction with no coordinates
 * is a transaction the map has never heard of, and the reader is left
 * looking at a map that does not know where they have been.
 *
 * These checks are about the place surviving the save.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');

const read = (relative) =>
  fs.readFileSync(path.join(ROOT, relative), 'utf8');

const page = read('src/components/layout/AddTransactionPage.jsx');

/* --- the coordinates are sent ----------------------------------------- */

// The place is collected. It has to be sent.
assert.ok(
  /latitude:\s*locationCoords/.test(page),
  'the coordinates are collected but never sent with the transaction'
);
assert.ok(
  /longitude:\s*locationCoords/.test(page),
  'the coordinates are collected but never sent with the transaction'
);

// The address of the shop is what the map looks the place up by.
assert.ok(
  /merchant_address:\s*location/.test(page),
  'the address of the place is not sent with the transaction'
);

// The reader clears the place, so the coordinates are cleared too.
assert.ok(
  /setLocation\(""\);\s*setLocationCoords\(null\)/.test(page),
  'the place can be cleared but the coordinates stay behind'
);

console.log('transaction location: all checks passed');
