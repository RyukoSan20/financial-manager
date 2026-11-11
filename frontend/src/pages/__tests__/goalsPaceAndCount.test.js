/**
 * The goals page: the count, and no raw key.
 *
 * Two things went wrong on the goals page, and these hold them:
 *
 * - the page said "0 target aktif" over two goals, because it
 *   counted `status === 'active'` and the server's `status` is the
 *   pace of a goal (`behind_track`, `on_track`, ...), never the word
 *   "active";
 * - the pace was shown by looking up `goals.status_<status>`, and a
 *   pace with no words of its own leaked onto the page as the key
 *   dressed up as a word: "Status_behind_track".
 *
 * The count is now `is_active && !is_completed`, and the pace is a
 * pill that only ever shows real words.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', '..');

const read = (rel) => readFileSync(join(SRC, rel), 'utf8');

let passed = 0;
let failed = 0;
const check = (name, fn) => {
  try { fn(); passed += 1; console.log(`ok - ${name}`); }
  catch (err) { failed += 1; console.error(`not ok - ${name}`); console.error(`  ${err.message}`); }
};

const GOALS = read('pages/Goals.jsx');

// --- the count -------------------------------------------------------------

check('the active count is the open, unfinished goals - not status === active', () => {
  assert.ok(
    GOALS.includes("g.is_active !== false && !g.is_completed"),
    'the count is of goals that are open and not yet reached'
  );
  assert.ok(
    !GOALS.includes("goals.filter(g => g.status === 'active').length"),
    'the old count by status is gone'
  );
});

// --- the pace --------------------------------------------------------------

check('the pace is only ever asked for by a name the dictionary has', () => {
  // The leak happened because any status was turned into a key. Now
  // only a known pace is looked up; everything else falls back to the
  // plain on-track / behind words.
  assert.ok(GOALS.includes('GOAL_PACES'), 'there is a list of the paces that have words');
  assert.ok(
    GOALS.includes('if (GOAL_PACES.includes(pace)) return t(`goals.pace_${pace}`)'),
    'only a pace in that list is looked up by name'
  );
});

check('the raw status key is never rendered', () => {
  // The badge was `t(`goals.status_${goal.status}`)` - the exact
  // thing that produced "Status_behind_track". It must be gone.
  assert.ok(
    !GOALS.includes('goals.status_${goal.status}'),
    'the status key is not interpolated into the badge any more'
  );
  assert.ok(GOALS.includes('<GoalPaceBadge'), 'the badge is the pace pill');
});

// --- the words exist in every language -------------------------------------

for (const loc of ['id', 'en', 'ja']) {
  check(`the pace words exist in ${loc}`, () => {
    const dict = read(`i18n/${loc}.js`);
    for (const pace of ['on_track', 'slightly_behind', 'behind_track', 'overdue', 'completed', 'paused']) {
      assert.ok(dict.includes(`pace_${pace}:`), `goals.pace_${pace} is missing in ${loc}`);
    }
  });
}

console.log('');
console.log(`the goals page: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
