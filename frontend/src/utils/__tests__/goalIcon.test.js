/**
 * The picture that goes in a goal's square.
 *
 * A goal used to get the same picture whatever it was: a target, in
 * whatever colour the goal happened to have. A goal to pay for an
 * operation and a goal to save for a holiday were drawn the same way,
 * so the reader had to read the name to tell them apart.
 *
 * The goal already says what it is - the server keeps a `goal_type`,
 * and the reader may name an icon of their own - so the square is
 * drawn from that, with the name of the goal as the last word.
 *
 * The name matters more than it looks. "Operasi Lasik" is a medical
 * goal whatever the type says, and the reader is the one who named
 * it.
 *
 * Run with: node src/utils/__tests__/goalIcon.test.js
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

console.log('the picture on a goal');

const source = read('src/utils/goalIcon.js');

check('a goal with nothing said gets the target', () => {
  assert.ok(
    /if \(!goal\) return Target;/.test(source),
    'a goal with nothing said does not get the target'
  );
});

check('"Operasi Lasik" is a medical goal', () => {
  // The word in the name gives the goal away, and the reader is the
  // one who named it.
  assert.ok(
    /\['operasi', Stethoscope\]/.test(source),
    '"operasi" is not recognised as a medical goal'
  );
  assert.ok(
    /\['lasik', Stethoscope\]/.test(source),
    '"lasik" is not recognised as a medical goal'
  );
});

check('the same word is not looked for twice', () => {
  // A repeated word is a copy that has been pasted, and it means one
  // of the two is wrong.
  const words = source.match(/\['[a-z]+', /g) || [];
  const seen = new Set();
  const repeated = [];
  for (const word of words) {
    if (seen.has(word)) repeated.push(word);
    seen.add(word);
  }
  assert.ok(
    repeated.length === 0,
    `the same word is looked for twice: ${repeated.join(', ')}`
  );
});

check('a goal of a known type is drawn from the type', () => {
  assert.ok(
    /savings: PiggyBank/.test(source) &&
      /travel: Plane/.test(source) &&
      /debt_payoff: CreditCard/.test(source),
    'the known types are not drawn from their own picture'
  );
});

check('the reader\'s own icon wins', () => {
  assert.ok(
    /goal\.icon/.test(source),
    'the icon the reader chose is not used'
  );
});

if (failed) {
  console.log(`\n${failed} failing, ${passed} passing`);
  process.exit(1);
}
console.log(`\nall ${passed} passing`);
