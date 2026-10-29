/**
 * The translations must not carry a letter from the wrong alphabet.
 *
 * Run with: node src/i18n/__tests__/scriptMix.test.js
 *
 * A translation file is read by a person and by a screen reader, so a
 * stray letter from another alphabet is a real mistake. There was one:
 * a Japanese sentence with a few Latin letters in the middle of a
 * word, which read as corruption rather than as a typo.
 *
 * The rule for each language:
 *
 * - Indonesian and English use Latin letters. They may have digits,
 *   punctuation, and the symbols that go with money.
 * - Japanese uses Hiragana, Katakana, and Kanji. It may have the
 *   Latin letters that are used as words of their own, such as "AI"
 *   or "PDF", but only as whole words.
 *
 * One note about Unicode. A few Japanese kanji live in the block
 * that Unicode calls Hangul, because Unicode assigns blocks by
 * order of proposal rather than by language. `宮` in a name is
 * written U+AD90, which sits between the Hangul syllables. It is
 * correct Japanese, so the Hangul check does not apply to the
 * Japanese file.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const I18N_DIR = join(HERE, '..');

let passed = 0;
let failed = 0;
const failures = [];

function check(name, condition, detail) {
  if (condition) {
    passed += 1;
  } else {
    failed += 1;
    failures.push(`${name}${detail ? `\n    ${detail}` : ''}`);
  }
}

// The alphabets that never belong in this application's translations.
const CYRILLIC = /[Ѐ-ӿ]/;
const GREEK = /[Ͱ-Ͽ]/;
const HEBREW = /[֐-׿]/;
const ARABIC = /[؀-ۿ]/;
const THAI = /[฀-๿]/;
const DEVANAGARI = /[ऀ-ॿ]/;
const HANGUL = /[가-힯ᄀ-ᇿ㄰-㆏]/;

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else if (name.endsWith('.js') || name.endsWith('.jsx')) {
      out.push(full);
    }
  }
  return out;
}

const files = walk(I18N_DIR).filter((f) => !f.includes('__tests__'));

// ---------------------------------------------------------------------------
// The alphabets that never belong anywhere
// ---------------------------------------------------------------------------

const alwaysWrong = [
  ['Cyrillic', CYRILLIC],
  ['Greek', GREEK],
  ['Hebrew', HEBREW],
  ['Arabic', ARABIC],
  ['Thai', THAI],
  ['Devanagari', DEVANAGARI],
];

for (const file of files) {
  const content = readFileSync(file, 'utf-8');
  const lines = content.split('\n');

  lines.forEach((line, i) => {
    for (const [name, pattern] of alwaysWrong) {
      const match = line.match(pattern);
      if (match) {
        check(
          `${file.replace(I18N_DIR, 'i18n')}:${i + 1} has no ${name}`,
          false,
          `found "${match[0]}" in: ${line.trim().slice(0, 100)}`
        );
      }
    }
  });
}

check('no alphabet from the wrong part of the world', failed === 0);

// ---------------------------------------------------------------------------
// Hangul, in the files that are written in Latin letters
// ---------------------------------------------------------------------------

const latinFiles = files.filter(
  (f) => !f.endsWith('ja.js') && !f.endsWith('keys_batch7.js')
);
check('there are Latin-script translation files to check', latinFiles.length > 0);

for (const file of latinFiles) {
  const content = readFileSync(file, 'utf-8');
  const lines = content.split('\n');
  lines.forEach((line, i) => {
    const match = line.match(HANGUL);
    if (match) {
      check(
        `${file.replace(I18N_DIR, 'i18n')}:${i + 1} has no Hangul`,
        false,
        `found "${match[0]}" in: ${line.trim().slice(0, 100)}`
      );
    }
  });
}

// ---------------------------------------------------------------------------
// The Japanese files use the Japanese alphabets
// ---------------------------------------------------------------------------

const jaFiles = files.filter((f) => f.endsWith('ja.js') || f.endsWith('keys_batch7.js'));
check('there is a Japanese translation file to check', jaFiles.length > 0);

const JAPANESE = /[぀-ゟ゠-ヿ一-鿿㐀-䶿]/;

for (const file of jaFiles) {
  const content = readFileSync(file, 'utf-8');
  check(
    `${file.replace(I18N_DIR, 'i18n')} has Japanese in it`,
    JAPANESE.test(content),
    'a Japanese file with no Japanese in it is probably the wrong file'
  );
}

// ---------------------------------------------------------------------------

console.log(`scriptMix: ${passed} passed, ${failed} failed`);
if (failed) {
  console.log(failures.join('\n\n'));
  process.exit(1);
}
