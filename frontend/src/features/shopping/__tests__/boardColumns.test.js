/**
 * The four columns of the board.
 *
 * Run with: node src/features/shopping/__tests__/boardColumns.test.js
 *
 * The board in the books has seven stages. The reader thinks in four.
 * This is where the seven are gathered into four, and nothing in the
 * database is changed.
 */

import {
  BOARD_COLUMNS,
  columnFor,
  gatherColumns,
  stageFor,
  canDrop,
  dropAction,
} from '../boardColumns.js';

let passed = 0;
let failed = 0;
const failures = [];

function check(name, actual, expected) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    passed += 1;
  } else {
    failed += 1;
    failures.push(
      `${name}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`
    );
  }
}

// ---------------------------------------------------------------------------
// There are four columns, in the order they are read
// ---------------------------------------------------------------------------

check('there are four columns', BOARD_COLUMNS.length, 4);
check(
  'the columns in order',
  BOARD_COLUMNS.map((c) => c.key),
  ['wishlist', 'saving', 'ready', 'bought']
);

// ---------------------------------------------------------------------------
// Which stage belongs to which column
// ---------------------------------------------------------------------------

check('a thing on the wishlist is in the first column', columnFor('wishlist'), 'wishlist');
check('a thing being saved for is in the second column', columnFor('to_buy'), 'saving');
check('a thing that is ready is in the third column', columnFor('ready'), 'ready');
check('a thing that was ordered is in the fourth column', columnFor('ordered'), 'bought');
check('a thing that is on its way is in the fourth column', columnFor('shipped'), 'bought');
check('a thing that arrived is in the fourth column', columnFor('received'), 'bought');
check(
  'a thing that was cancelled is in no column at all',
  columnFor('cancelled'),
  null
);

// ---------------------------------------------------------------------------
// Gathering seven stages into four columns
// ---------------------------------------------------------------------------

const FROM_THE_SERVER = [
  { stage: 'wishlist', items: [{ id: 1, stage: 'wishlist', name: 'Asus ROG', amount: 100 }] },
  { stage: 'to_buy', items: [{ id: 2, stage: 'to_buy', name: 'Monitor', amount: 200 }] },
  { stage: 'ready', items: [{ id: 3, stage: 'ready', name: 'Keyboard', amount: 300 }] },
  { stage: 'ordered', items: [{ id: 4, stage: 'ordered', name: 'Mouse', amount: 400 }] },
  { stage: 'shipped', items: [{ id: 5, stage: 'shipped', name: 'Cable', amount: 50 }] },
  { stage: 'received', items: [{ id: 6, stage: 'received', name: 'Desk', amount: 600 }] },
  { stage: 'cancelled', items: [{ id: 7, stage: 'cancelled', name: 'Headset', amount: 700 }] },
];

const gathered = gatherColumns(FROM_THE_SERVER);

check('the four columns come back', gathered.length, 4);
check(
  'the first column holds the wishlist',
  gathered[0].items.map((i) => i.id),
  [1]
);
check(
  'the second column holds what is being saved for',
  gathered[1].items.map((i) => i.id),
  [2]
);
check(
  'the third column holds what is ready to buy',
  gathered[2].items.map((i) => i.id),
  [3]
);
check(
  'the fourth column holds what was ordered, what is on its way, and what arrived',
  gathered[3].items.map((i) => i.id),
  [4, 5, 6]
);

// A cancelled thing is in no column. Showing it in either place would
// be a lie: it was not wanted, and it was not bought.
const everywhere = gathered.flatMap((c) => c.items.map((i) => i.id));
check('the cancelled thing is nowhere', everywhere.includes(7), false);

// The count and the total of each column are worked out from what is
// in it, so that the numbers on the column agree with the cards.
check('the first column counts one thing', gathered[0].count, 1);
check('the fourth column counts three things', gathered[3].count, 3);
check('the fourth column adds up', gathered[3].total, 1050);

// ---------------------------------------------------------------------------
// The stage a thing is put in
// ---------------------------------------------------------------------------

check('the first column puts a thing on the wishlist', stageFor('wishlist'), 'wishlist');
check('the second column puts a thing to be saved for', stageFor('saving'), 'to_buy');
check('the third column puts a thing as ready', stageFor('ready'), 'ready');
check('the fourth column puts a thing as ordered', stageFor('bought'), 'ordered');
check('a column that is not there has no stage', stageFor('nonsense'), null);

// ---------------------------------------------------------------------------
// What may be dragged where, and what happens when it is
// ---------------------------------------------------------------------------

const wanted = { id: 1, stage: 'wishlist' };
const saved = { id: 2, stage: 'to_buy' };
const ready = { id: 3, stage: 'ready' };
const ordered = { id: 4, stage: 'ordered' };
const arrived = { id: 6, stage: 'received' };
const cancelled = { id: 7, stage: 'cancelled' };

check('a wanted thing can be moved to the saving column', canDrop(wanted, 'saving'), true);
check('a wanted thing can be moved to the ready column', canDrop(wanted, 'ready'), true);
check('a saved thing can be moved to the ready column', canDrop(saved, 'ready'), true);
check('a saved thing can be moved back to the wishlist', canDrop(saved, 'wishlist'), true);
check('a wanted thing cannot be dropped where it already is', canDrop(wanted, 'wishlist'), false);
check(
  'moving a thing into the bought column means buying it',
  dropAction(wanted, 'bought'),
  'purchase'
);
check(
  'moving a ready thing into the bought column means buying it',
  dropAction(ready, 'bought'),
  'purchase'
);
check(
  'a bought thing cannot go back to the wishlist',
  canDrop(arrived, 'wishlist'),
  false
);
check(
  'a bought thing cannot go back to the saving column',
  canDrop(arrived, 'saving'),
  false
);
check(
  'a bought thing can be moved along the bought column',
  dropAction(ordered, 'bought'),
  null
);
check('a cancelled thing cannot be moved at all', canDrop(cancelled, 'wishlist'), false);
check('there is no column called nonsense', canDrop(wanted, 'nonsense'), false);

// ---------------------------------------------------------------------------

console.log(`boardColumns: ${passed} passed, ${failed} failed`);
if (failed) {
  console.log(failures.join('\n\n'));
  process.exit(1);
}
