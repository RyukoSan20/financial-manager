/**
 * The Eisenhower board.
 *
 * Run with: node src/utils/__tests__/eisenhowerPriority.test.js
 *
 * Four boxes, two questions. The board is only honest if every goal
 * lands in exactly one box, and if the same goal always lands in the
 * same box. These checks are the promise this file makes.
 */

import assert from 'node:assert/strict';

import {
  QUADRANTS,
  QUADRANT_KEYS,
  quadrantForGoal,
  quadrantForFlags,
  groupGoalsByQuadrant,
  goalsInQuadrant,
  isImportant,
  isUrgent,
} from '../eisenhowerPriority.js';

let passed = 0;
let failed = 0;
const failures = [];

function check(name, actual, expected) {
  try {
    assert.deepStrictEqual(actual, expected);
    passed += 1;
    console.log(`ok   ${name}`);
  } catch {
    failed += 1;
    failures.push(
      `${name}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`
    );
    console.log(`FAIL ${name}`);
  }
}

// ---------------------------------------------------------------------------
// The four boxes
// ---------------------------------------------------------------------------

check('there are four boxes', QUADRANTS.length, 4);

check(
  'the boxes have the expected keys',
  QUADRANTS.map((q) => q.key),
  [
    'important_urgent',
    'not_important_urgent',
    'important_not_urgent',
    'not_important_not_urgent',
  ]
);

check('the key list and the boxes agree', QUADRANT_KEYS, QUADRANTS.map((q) => q.key));

for (const quadrant of QUADRANTS) {
  check(
    `the box ${quadrant.key} has an i18n label key`,
    typeof quadrant.labelKey === 'string' && quadrant.labelKey.startsWith('goals.'),
    true
  );
}

// ---------------------------------------------------------------------------
// The two questions
// ---------------------------------------------------------------------------

check('important and urgent goes to the first box', quadrantForFlags(true, true), 'important_urgent');
check('not important and urgent goes to the second box', quadrantForFlags(false, true), 'not_important_urgent');
check('important and not urgent goes to the third box', quadrantForFlags(true, false), 'important_not_urgent');
check('neither goes to the last box', quadrantForFlags(false, false), 'not_important_not_urgent');

check('a goal that is important and urgent is important', isImportant({ important: true, urgent: true }), true);
check('a goal that is important and urgent is urgent', isUrgent({ important: true, urgent: true }), true);
check('a goal with neither flag is not important', isImportant({}), false);
check('a goal with neither flag is not urgent', isUrgent({}), false);

// ---------------------------------------------------------------------------
// A goal lands in exactly one box
// ---------------------------------------------------------------------------

const GOALS = [
  { id: 1, name: 'Dana darurat', important: true, urgent: true },
  { id: 2, name: 'Liburan', important: true, urgent: false },
  { id: 3, name: 'Bayar tagsihan', important: false, urgent: true },
  { id: 4, name: 'Hobi', important: false, urgent: false },
  { id: 5, name: 'Penting saja', important: true },
  { id: 6, name: 'Mendesak saja', urgent: true },
  { id: 7, name: 'Kosong', priority: 'low' },
  { id: 8, name: 'Prioritas tinggi', priority: 'high' },
  { id: 9, name: 'Sudah ditaruh', quadrant: 'important_not_urgent', priority: 'low' },
];

for (const goal of GOALS) {
  const quadrant = quadrantForGoal(goal);
  check(
    `${goal.name} lands in one box`,
    QUADRANT_KEYS.includes(quadrant),
    true
  );
  const grouped = groupGoalsByQuadrant([goal]);
  const total = Object.values(grouped).reduce((sum, list) => sum + list.length, 0);
  check(`${goal.name} is counted once`, total, 1);
}

check(
  'every goal is in exactly one box',
  Object.values(groupGoalsByQuadrant(GOALS)).reduce((sum, list) => sum + list.length, 0),
  GOALS.length
);

check(
  'the same goal always lands in the same box',
  quadrantForGoal(GOALS[0]),
  quadrantForGoal(GOALS[0])
);

// ---------------------------------------------------------------------------
// The mapping of each combination
// ---------------------------------------------------------------------------

check('important and urgent', quadrantForGoal({ important: true, urgent: true }), 'important_urgent');
check('not important and urgent', quadrantForGoal({ important: false, urgent: true }), 'not_important_urgent');
check('important and not urgent', quadrantForGoal({ important: true, urgent: false }), 'important_not_urgent');
check('not important and not urgent', quadrantForGoal({ important: false, urgent: false }), 'not_important_not_urgent');

check('a goal with neither lands in the last box', quadrantForGoal({}), 'not_important_not_urgent');
check('a goal with no fields at all lands in the last box', quadrantForGoal({ name: 'Kosong' }), 'not_important_not_urgent');
check('nothing at all lands in the last box', quadrantForGoal(null), 'not_important_not_urgent');
check('undefined lands in the last box', quadrantForGoal(undefined), 'not_important_not_urgent');

// ---------------------------------------------------------------------------
// The board
// ---------------------------------------------------------------------------

const grouped = groupGoalsByQuadrant(GOALS);

check('the board has all four boxes', Object.keys(grouped).sort(), [...QUADRANT_KEYS].sort());
check('the important and urgent box', grouped.important_urgent.map((g) => g.id), [1]);
check('the not important and urgent box', grouped.not_important_urgent.map((g) => g.id), [3, 6]);
check('the important and not urgent box', grouped.important_not_urgent.map((g) => g.id), [2, 5, 8, 9]);
check('the not important and not urgent box', grouped.not_important_not_urgent.map((g) => g.id), [4, 7]);

check(
  'one box can be read on its own',
  goalsInQuadrant(GOALS, 'important_urgent').map((g) => g.id),
  [1]
);

check('a box nobody asked for is empty', goalsInQuadrant(GOALS, 'no_such_box'), []);

// ---------------------------------------------------------------------------
// Nothing at all
// ---------------------------------------------------------------------------

const emptyBoard = groupGoalsByQuadrant([]);

check('an empty board has four boxes', Object.keys(emptyBoard).length, 4);
check(
  'an empty board has nothing in it',
  Object.values(emptyBoard).every((list) => list.length === 0),
  true
);
check('an empty board can be read on its own', goalsInQuadrant([], 'important_urgent'), []);
check('a board that is not a list is empty', Object.values(groupGoalsByQuadrant(null)).every((l) => l.length === 0), true);
check('a board that is not a list is empty (undefined)', Object.values(groupGoalsByQuadrant(undefined)).every((l) => l.length === 0), true);

// ---------------------------------------------------------------------------

console.log(`eisenhowerPriority: ${passed} passed, ${failed} failed`);
if (failed) {
  console.log(failures.join('\n\n'));
  process.exit(1);
}
