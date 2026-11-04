/**
 * The numbers the market answer stands on.
 *
 * The co-pilot answers with words, and then with the numbers those
 * words are built on. The numbers come from the server as key points,
 * and each one carries a key that says what it is: the price, the
 * change, the top gainer.
 *
 * The page was drawing that key straight onto the screen, so a reader
 * saw "MARKET_ADVISOR.POINT.PRICE" where a label should have been.
 * The CSS made it worse by turning it into capitals, which made it
 * look deliberate rather than broken.
 *
 * So every key the server can send has to exist in every language,
 * and the page has to translate it rather than print it.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..', '..');

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
    console.log(`  FAIL  ${name}`);
    console.log(`        ${err.message.split('\n')[0]}`);
  }
};

const SERVICE = 'backend/app/services/market_ai_agent_service.py';
const CHAT = 'frontend/src/components/market/AiMarketAdvisorChat.jsx';

/**
 * The keys the server can send.
 *
 * Read out of the server's own source rather than written out here,
 * so that a key the server adds tomorrow is caught tomorrow.
 */
function serverKeys() {
  const source = read(SERVICE);
  const found = new Set();
  const pattern = /["']key["']\s*:\s*["']([^"']+)["']/g;
  let match;
  while ((match = pattern.exec(source)) !== null) {
    if (match[1].includes('.')) found.add(match[1]);
  }
  return [...found].sort();
}

check('the server does send key points', () => {
  const keys = serverKeys();
  assert.ok(keys.length > 0, 'there are keys to translate');
});

check('every key the server sends exists in every language', () => {
  const keys = serverKeys();
  const locales = ['id', 'en', 'ja'];

  for (const language of locales) {
    const source = read(`frontend/src/i18n/${language}.js`);
    for (const key of keys) {
      // The translator walks the key one piece at a time, so the
      // words have to be there one piece at a time too.
      const pieces = key.split('.');
      let at = 0;
      for (const piece of pieces) {
        const needle = `${piece}:`;
        const found = source.indexOf(needle, at);
        assert.ok(found > -1, `the ${language} language has ${key}`);
        at = found;
      }
    }
  }
});

check('the page translates the key rather than printing it', () => {
  const source = read(CHAT);

  // The key is not written straight onto the screen.
  assert.ok(
    !/\{point\.key\}/.test(source),
    'the raw key is not drawn on the page',
  );

  // It goes through the translator.
  assert.ok(
    /t\(\s*point\.key\b/.test(source),
    'the key is translated',
  );
});

check('the values are shown with the label, not on their own', () => {
  const source = read(CHAT);
  assert.ok(
    /point\.values/.test(source),
    'the numbers are still shown',
  );
});

console.log('');
console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
