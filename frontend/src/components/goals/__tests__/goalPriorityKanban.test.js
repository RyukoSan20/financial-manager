/**
 * The goal priority board and the cost breakdown beside it.
 *
 * Run with: node src/components/goals/__tests__/goalPriorityKanban.test.js
 *
 * The board is only honest if the four boxes are the four boxes the
 * helper knows about, and if the components ask for those boxes by
 * name. These checks read the source of the components and the
 * helper they are built on.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  QUADRANTS,
  QUADRANT_KEYS,
  quadrantForGoal,
  groupGoalsByQuadrant,
} from '../../../utils/eisenhowerPriority.js';

const here = dirname(fileURLToPath(import.meta.url));

const read = (...parts) => readFileSync(join(here, ...parts), 'utf8');

const kanbanSource = read('..', 'GoalPriorityKanban.jsx');
const breakdownSource = read('..', 'EditableAiCostBreakdown.jsx');

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

function checkThat(name, condition) {
  check(name, Boolean(condition), true);
}

// ---------------------------------------------------------------------------
// The four boxes
// ---------------------------------------------------------------------------

check('there are four boxes', QUADRANTS.length, 4);

check(
  'the boxes are the ones the board draws',
  QUADRANTS.map((q) => q.key),
  [
    'important_urgent',
    'not_important_urgent',
    'important_not_urgent',
    'not_important_not_urgent',
  ]
);

// The board asks for the boxes by name, and it asks for the same
// names the helper uses. The board does not write the names down
// itself: it reads them from the helper, so the two cannot drift
// apart.
for (const key of QUADRANT_KEYS) {
  checkThat(
    `the helper knows the box ${key}`,
    QUADRANTS.some((quadrant) => quadrant.key === key)
  );
  checkThat(
    `the box ${key} has an i18n key of its own`,
    QUADRANTS.some((quadrant) => quadrant.key === key && quadrant.labelKey.endsWith(key))
  );
}

checkThat(
  'the board reads the boxes from the helper',
  kanbanSource.includes('QUADRANTS')
);

checkThat(
  'the board asks for the goal list from the helper',
  kanbanSource.includes('groupGoalsByQuadrant')
);

checkThat(
  'the board takes the goals as a prop',
  /goals\s*=/.test(kanbanSource)
);

checkThat(
  'the board takes a move handler as a prop',
  /onMove/.test(kanbanSource)
);

checkThat(
  'the board moves a goal by its id',
  /onMove\?\.\(goal\.id,\s*event\.target\.value\)/.test(kanbanSource)
);

checkThat(
  'the board moves a goal on a drop',
  /onMove\(goalId,\s*quadrantKey\)/.test(kanbanSource)
);

checkThat(
  'the board reads its labels from the language files',
  kanbanSource.includes('useTranslation')
);

checkThat(
  'the board reads the title of a box by its i18n key',
  kanbanSource.includes('labelKey')
);

checkThat(
  'the board draws four columns',
  kanbanSource.includes('QUADRANTS.map')
);

// The words of the board live in the language files, not in the
// component.
checkThat(
  'the board does not carry Indonesian words of its own',
  !/Penting|Mendesak|Tidak Penting/.test(kanbanSource)
);

// ---------------------------------------------------------------------------
// The cost breakdown
// ---------------------------------------------------------------------------

checkThat(
  'the breakdown reads its labels from the language files',
  breakdownSource.includes('useTranslation')
);

checkThat(
  'the breakdown has a row for the description',
  breakdownSource.includes('ai_cost_description')
);

checkThat(
  'the breakdown has a row for the price',
  breakdownSource.includes('ai_cost_price')
);

checkThat(
  'the breakdown can add a row',
  breakdownSource.includes('ai_cost_add_row')
);

checkThat(
  'the breakdown can remove a row',
  breakdownSource.includes('ai_cost_remove_row')
);

checkThat(
  'the breakdown shows a running total',
  breakdownSource.includes('ai_cost_total')
);

checkThat(
  'the breakdown does not carry Indonesian words of its own',
  !/Tambah Baris|Hapus Baris|Keterangan|Harga/.test(breakdownSource)
);

// ---------------------------------------------------------------------------
// The page uses both of them
// ---------------------------------------------------------------------------

const goalsPage = read('..', '..', '..', 'pages', 'Goals.jsx');

checkThat('the goals page draws the board', goalsPage.includes('GoalPriorityKanban'));
checkThat('the goals page draws the breakdown', goalsPage.includes('EditableAiCostBreakdown'));
checkThat('the goals page leans the goal cards', goalsPage.includes('TiltCard'));

// ---------------------------------------------------------------------------
// The three languages agree
// ---------------------------------------------------------------------------

const languages = ['id', 'en', 'ja'].map((code) => {
  const source = readFileSync(join(here, '..', '..', '..', 'i18n', `${code}.js`), 'utf8');
  const goals = source.slice(source.indexOf('  goals: {'));
  const end = goals.indexOf('\n  },');
  const block = goals.slice(0, end === -1 ? goals.length : end);
  const keys = [...block.matchAll(/^\s{4}([a-z0-9_]+):/gm)].map((m) => m[1]);
  return { code, keys };
});

const reference = languages[0].keys;

for (const language of languages) {
  checkThat(
    `the ${language.code} file has the goals keys the other files have`,
    reference.every((key) => language.keys.includes(key))
  );
}

checkThat(
  'the three languages have the same number of goal keys',
  languages.every((language) => language.keys.length === reference.length),
  true
);

// The keys the new pieces ask for are really there.
const ASKED_FOR = [
  'priority_board_title',
  'priority_board_hint',
  'priority_board_empty',
  'quadrant_important_urgent',
  'quadrant_not_important_urgent',
  'quadrant_important_not_urgent',
  'quadrant_not_important_not_urgent',
  'quadrant_count',
  'ai_cost_title',
  'ai_cost_hint',
  'ai_cost_empty',
  'ai_cost_estimate_note',
  'ai_cost_add_row',
  'ai_cost_remove_row',
  'ai_cost_description',
  'ai_cost_price',
  'ai_cost_total',
  'ai_cost_description_placeholder',
  'ai_cost_price_placeholder',
];

for (const key of ASKED_FOR) {
  for (const language of languages) {
    checkThat(`the ${language.code} file has the key ${key}`, language.keys.includes(key));
  }
}

// ---------------------------------------------------------------------------
// The board and the helper agree
// ---------------------------------------------------------------------------

const GOALS = [
  { id: 1, important: true, urgent: true },
  { id: 2, important: true, urgent: false },
  { id: 3, important: false, urgent: true },
  { id: 4, important: false, urgent: false },
];

const grouped = groupGoalsByQuadrant(GOALS);

check(
  'the helper puts each goal in the box the board draws',
  Object.keys(grouped).sort(),
  [...QUADRANT_KEYS].sort()
);

check(
  'a goal placed by hand keeps its box',
  quadrantForGoal({ id: 5, quadrant: 'not_important_urgent' }),
  'not_important_urgent'
);

// ---------------------------------------------------------------------------

console.log(`goalPriorityKanban: ${passed} passed, ${failed} failed`);
if (failed) {
  console.log(failures.join('\n\n'));
  process.exit(1);
}
