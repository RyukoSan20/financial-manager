/**
 * A place the reader typed must also land on the map.
 *
 * The reader can say where they were in two ways: let the phone tell
 * us, or type the name of the place. Only the first one used to work.
 * When the name was typed, the transaction was saved with the name but
 * without any coordinates, so the place never appeared on the expense
 * map and the spending at that place was invisible.
 *
 * So a typed name has to be turned into coordinates before the
 * transaction is saved. The search endpoint answers with a list of
 * places; the first one is the best match and carries the point.
 */

import fs from 'fs';
import path from 'path';

const pagePath = path.resolve(
  process.cwd(),
  'src/components/layout/AddTransactionPage.jsx'
);
const page = fs.readFileSync(pagePath, 'utf8');

let failures = 0;
function check(name, condition, detail = '') {
  if (condition) {
    console.log(`  ok  ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${name}${detail ? ` -- ${detail}` : ''}`);
  }
}

// The typed name has to be looked up, not just stored as text.
check(
  'the typed place name is looked up for coordinates',
  /search-places/.test(page),
  'no call to the place search endpoint'
);

// The lookup needs the reader's session, the same way the reverse
// geocode does.
check(
  'the place lookup carries the reader\'s session',
  /search-places\?/.test(page) && /Authorization/.test(page),
  'the search is made without the session header'
);

// The coordinates that come back have to reach the transaction.
check(
  'the looked-up coordinates reach the saved transaction',
  /setLocationCoords\(/.test(page),
  'the coordinates from the lookup are never stored'
);

if (failures) {
  console.log(`\n${failures} failing`);
  process.exit(1);
}
console.log('\nall green');
