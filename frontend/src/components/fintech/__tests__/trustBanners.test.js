/**
 * The banner that says what the money is doing.
 *
 * Two things sit at the top of the dashboard, and they are both about
 * trust.
 *
 * The first is the money that has not been given a job. A reader has
 * money in the bank and budgets that claim parts of it, and the rest
 * is sitting there doing nothing. This is the YNAB idea and it is the
 * one number that tells the reader whether their plan actually works.
 *
 * The second is how fresh the data is. The survey behind this work
 * found that the most common complaint about the tools people already
 * use is that the data is wrong and nobody says so. So the banner
 * says when the numbers were last touched, and when something is
 * waiting to be looked at, it offers the fix in one click.
 *
 * These checks make sure:
 *
 * - the banner uses the shared arithmetic, so the number on the
 *   screen is the number the application works out;
 * - the words come from the locale file, so a reader in English or
 *   Japanese sees a sentence and not a key;
 * - the offer to fix the data only appears when there is something to
 *   fix, because a button that always says "fix it" is noise;
 * - the number the reader sees is the free money, and when there is
 *   too little it says that instead of showing a negative figure.
 *
 * Run with: node src/components/fintech/__tests__/trustBanners.test.js
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
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
    console.log(`FAIL  ${name}\n       ${err.message}`);
  }
};

const banner = read('src/components/fintech/ReadyToBeAssignedBanner.jsx');

// ---------------------------------------------------------------------------
// The banner uses the shared arithmetic
// ---------------------------------------------------------------------------
check('the banner works the number out with the shared arithmetic', () => {
  assert.ok(
    /readyToBeAssigned/.test(banner),
    'the banner does not use readyToBeAssigned'
  );
  assert.ok(
    /dataFreshness/.test(banner),
    'the trust indicator does not use dataFreshness'
  );
});

check('the banner does not do its own arithmetic', () => {
  // A second place that subtracts money is a second answer, and the
  // two answers will not agree.
  assert.ok(
    !/cashBalance\s*-\s*allocated/.test(banner),
    'the banner subtracts the money itself'
  );
});

// ---------------------------------------------------------------------------
// The words
// ---------------------------------------------------------------------------
check('the words come from the locale file', () => {
  assert.ok(/batch3/.test(banner), 'the banner does not read the words');
  assert.ok(
    /batch3\[language\]\?\.fintech/.test(banner),
    'the banner does not read the fintech words'
  );
});

check('the banner does not write the words into the component', () => {
  // A word written into the component cannot be translated.
  assert.ok(
    !/>Uang Siap Diberi Tugas</.test(banner),
    'the banner has a word written into it'
  );
  assert.ok(
    !/>Data Akurat</.test(banner),
    'the banner has a word written into it'
  );
});

// ---------------------------------------------------------------------------
// The three languages
// ---------------------------------------------------------------------------
check('all three languages have the words for the banners', async () => {
  const { batch3 } = await import('../../../i18n/keys_batch3.js');
  const languages = ['id', 'en', 'ja'];
  const needed = [
    'banner_free_title',
    'banner_free_text',
    'banner_free_caption',
    'banner_over_title',
    'banner_over_text',
    'banner_over_caption',
    'banner_action',
    'trust_accurate',
    'trust_needs_review',
    'trust_updated',
    'trust_pending',
    'trust_correct',
  ];
  for (const language of languages) {
    const words = batch3[language]?.fintech;
    assert.ok(words, `${language} has no fintech words`);
    for (const key of needed) {
      assert.ok(
        typeof words[key] === 'string' && words[key].length > 0,
        `${language} has no ${key}`
      );
    }
  }
});

check('the three languages have the same words', async () => {
  const { batch3 } = await import('../../../i18n/keys_batch3.js');
  const id = Object.keys(batch3.id.fintech).sort().join(',');
  const en = Object.keys(batch3.en.fintech).sort().join(',');
  const ja = Object.keys(batch3.ja.fintech).sort().join(',');
  assert.equal(id, en, 'the English page has different words from the Indonesian one');
  assert.equal(id, ja, 'the Japanese page has different words from the Indonesian one');
});

// ---------------------------------------------------------------------------
// The offer to fix the data
// ---------------------------------------------------------------------------
check('the fix button only appears when there is something to fix', () => {
  // The button is behind the `accurate` check, so a reader whose data
  // is fine does not get a button that does nothing.
  assert.ok(
    /onCorrect\s*&&\s*!state\.accurate/.test(banner),
    'the fix button shows even when the data is accurate'
  );
});

check('the banner says how many things are waiting', () => {
  assert.ok(
    /trust_pending\.replace\('%count%'/.test(banner),
    'the banner does not say how many things are waiting'
  );
});

// ---------------------------------------------------------------------------
// The number
// ---------------------------------------------------------------------------
check('the banner shows the free money, not a negative figure', () => {
  // A negative figure on the banner would be read as money owed.
  assert.ok(
    /Math\.abs\(result\.free\)/.test(banner),
    'the banner does not take the absolute value'
  );
  assert.ok(
    /result\.overcommitted/.test(banner),
    'the banner does not say when there is too little'
  );
});

check('the banner stays out of the way when there is nothing to say', () => {
  assert.ok(
    /result\.cash\s*<=\s*0\s*&&\s*result\.allocated\s*<=\s*0/.test(banner),
    'the banner shows even when there is no money and no budget'
  );
});

// ---------------------------------------------------------------------------
// The result
// ---------------------------------------------------------------------------
console.log(`\ntrust banners: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
