/**
 * The batch files speak the same three languages.
 *
 * Every batch file holds the words for one feature, in three
 * languages. A key that is present in Indonesian but missing in
 * Japanese means the Japanese reader sees an empty space where a
 * sentence should be, and nothing else in the build would notice.
 *
 * So the three languages in every batch file are checked against
 * each other here: the same keys, the same number of them, and no
 * empty words.
 *
 * Run with: node src/i18n/__tests__/batchParity.test.js
 */

import { batch1 } from '../keys_batch1.js';
import { batch2 } from '../keys_batch2.js';
import { batch3 } from '../keys_batch3.js';
import { batch4 } from '../keys_batch4.js';
import { batch5 } from '../keys_batch5.js';
import { batch6 } from '../keys_batch6.js';
import { batch7 } from '../keys_batch7.js';

const BATCHES = {
  batch1,
  batch2,
  batch3,
  batch4,
  batch5,
  batch6,
  batch7,
};

const LANGUAGES = ['id', 'en', 'ja'];

/**
 * Flatten a translation table into "dotted.key": "text".
 */
function flatten(table, prefix = '') {
  const result = {};
  for (const [key, value] of Object.entries(table || {})) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flatten(value, path));
    } else {
      result[path] = value;
    }
  }
  return result;
}

let checks = 0;
let failures = 0;

function check(condition, message) {
  checks += 1;
  if (!condition) {
    failures += 1;
    console.error(`  FAIL ${message}`);
  }
}

for (const [name, batch] of Object.entries(BATCHES)) {
  console.log(`${name}:`);

  // The batch holds all three languages.
  for (const language of LANGUAGES) {
    check(
      Boolean(batch[language]),
      `${name} has no ${language}`
    );
  }

  if (!batch.id || !batch.en || !batch.ja) {
    console.log('  skipped: a language is missing');
    continue;
  }

  const id = flatten(batch.id);
  const en = flatten(batch.en);
  const ja = flatten(batch.ja);

  // The same keys in all three.
  const idKeys = Object.keys(id).sort();
  const enKeys = Object.keys(en).sort();
  const jaKeys = Object.keys(ja).sort();

  check(
    idKeys.length === enKeys.length,
    `${name}: id has ${idKeys.length} keys, en has ${enKeys.length}`
  );
  check(
    idKeys.length === jaKeys.length,
    `${name}: id has ${idKeys.length} keys, ja has ${jaKeys.length}`
  );

  for (const key of idKeys) {
    check(key in en, `${name}: en is missing "${key}"`);
    check(key in ja, `${name}: ja is missing "${key}"`);
  }

  // No empty words.
  for (const language of LANGUAGES) {
    const flat = flatten(batch[language]);
    for (const [key, value] of Object.entries(flat)) {
      check(
        typeof value === 'string' && value.trim().length > 0,
        `${name}.${language}: "${key}" is empty`
      );
    }
  }

  // The number of holes in a sentence is the same in every language,
  // or the values will not land in the right places.
  for (const key of idKeys) {
    const holes = (text) => (String(text).match(/%s/g) || []).length;
    const count = holes(id[key]);
    check(
      holes(en[key]) === count,
      `${name}: "${key}" has ${count} holes in id and ${holes(en[key])} in en`
    );
    check(
      holes(ja[key]) === count,
      `${name}: "${key}" has ${count} holes in id and ${holes(ja[key])} in ja`
    );
  }

  console.log(`  ${idKeys.length} keys, three languages`);
}

console.log('');
console.log(`${checks - failures}/${checks} checks passed`);

if (failures > 0) {
  console.error(`${failures} failed`);
  process.exit(1);
}
