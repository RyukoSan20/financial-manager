/**
 * The login page has to be a gateway, not a form on a coloured box.
 *
 * Two things were wrong with the page it replaces.
 *
 * The first is that it did not tell the reader anything true. The
 * design it was built from promised things this application does not
 * do: two-factor authentication that does not exist anywhere in the
 * code, a "money waiting to be given a job" concept that has no
 * model behind it, and a claim that the data belongs entirely to the
 * reader while the reader's records are handed to a third-party
 * model whenever they ask for advice or scan a receipt.
 *
 * A promise the application cannot keep is worse than no promise. So
 * every claim on the page has to name the thing it is claiming, and
 * that thing has to be found in the code. The test reads the backend
 * and the frontend and checks that each claim is there.
 *
 * The second is that the right-hand column was a picture. A preview
 * that cannot be touched teaches nothing and moves nothing. The
 * figures on it have to be worked out by the same code that works out
 * the real figures, so the reader can change an input and watch the
 * numbers answer.
 *
 * Run with: node src/pages/__tests__/loginGateway.test.js
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { computeBill, largestRemainderSplit } from '../../utils/receiptBill.js';
import { amountsFromSplit, dailyFromSplit, splitAddsUp } from '../../utils/budgetRecipes.js';
import { batch3 as batch } from '../../i18n/keys_batch3.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..');
const BACKEND = path.resolve(ROOT, '..', 'backend', 'app');

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const readBackend = (p) => fs.readFileSync(path.join(BACKEND, p), 'utf8');



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

const PAGE = 'src/pages/Login.jsx';
const source = read(PAGE);

// ---------------------------------------------------------------------------
// The page exists in two columns
// ---------------------------------------------------------------------------

check('the login page has a column for the form and a column for the preview', () => {
  assert.ok(
    /login-gateway/.test(source),
    'the page does not name its own layout'
  );
  assert.ok(
    /login-gateway__form/.test(source) && /login-gateway__preview/.test(source),
    'the two columns are not both there'
  );
});

check('the page reads the flag that decides whether it shows the new shape', () => {
  assert.ok(
    /buildFlag\('LOGIN_GATEWAY'\)/.test(source),
    'the new shape is not behind a switch'
  );
});

check('the old page is still there when the switch is off', () => {
  // The switch decides which shape to draw. Both shapes have to be in
  // the file, or turning the switch off leaves the reader with no
  // page at all.
  assert.ok(
    /login-gateway/.test(source) && /login-legacy/.test(source),
    'the old shape is not kept'
  );
});

// ---------------------------------------------------------------------------
// Every claim on the page is true of the code
// ---------------------------------------------------------------------------

const CLAIMS = [
  {
    name: 'the encryption claim',
    // The page says the credentials are encrypted. That has to be
    // true: there is an AES-256-GCM module, and it is used on the
    // OAuth tokens and on the account details of a split bill.
    backend: ['core/kms_encryption.py'],
    needles: ['AES-256-GCM'],
  },
  {
    name: 'the read-only Gmail claim',
    backend: ['modules/integrations/email_parser/gmail_oauth.py'],
    needles: ['gmail.readonly'],
  },
  {
    name: 'the export claim',
    backend: ['api/routes/data.py'],
    needles: ['export_data'],
  },
  {
    name: 'the delete claim',
    backend: ['api/routes/data.py'],
    needles: ['delete_all_user_data'],
  },
];

for (const claim of CLAIMS) {
  check(`${claim.name} is true of the backend`, () => {
    for (const file of claim.backend) {
      const text = readBackend(file);
      for (const needle of claim.needles) {
        assert.ok(
          text.includes(needle),
          `${file} does not contain "${needle}", so the page would be promising something that is not there`
        );
      }
    }
  });
}

check('the page does not promise two-factor authentication that does not exist', () => {
  // There is no TOTP, no second factor and no authenticator anywhere
  // in the application. A page that says "2FA ready" is promising a
  // thing that does not exist.
  const backend = fs
    .readdirSync(BACKEND, { recursive: true })
    .filter((f) => typeof f === 'string' && f.endsWith('.py'))
    .map((f) => fs.readFileSync(path.join(BACKEND, f), 'utf8'))
    .join('\n');

  const hasTwoFactor = /totp|two_factor|2fa|authenticator/i.test(backend);
  assert.ok(!hasTwoFactor, 'the backend has a second factor after all, so the claim may be made');

  // The words must not be on the page.
  const onPage = /2fa|two[- ]factor|authenticat/i.test(source);
  assert.ok(
    !onPage,
    'the page mentions a second factor, which the application does not have'
  );
});

check('the page does not claim the reader\'s records are never shared', () => {
  // The privacy manifest says the advice and the receipt are handed
  // to a model, and that is the truth. A page that says the records
  // never leave the device is wrong.
  const manifest = read('src/data/privacyManifest.js');
  assert.ok(
    /generativelanguage\.googleapis\.com/.test(manifest),
    'the manifest does not name the model host, so this check means nothing'
  );
  assert.ok(
    !/never leave|stays on your device|100% private|tidak pernah keluar/i.test(source),
    'the page claims the records never leave, which is not true'
  );
});

check('the page links to the privacy page that really exists', () => {
  // The old page linked to /privacy and /terms, and neither is a
  // route. The catch-all sends a reader to /login, so both links were
  // a loop back to where they started.
  const app = read('src/App.jsx');
  const hasPrivacyRoute = /path=["'][^"']*privacy/i.test(app);
  assert.ok(
    hasPrivacyRoute,
    'the privacy page is not a route, so the page must not link to /privacy'
  );
  assert.ok(
    !/\/privacy["']/.test(source) || hasPrivacyRoute,
    'the page links to /privacy, which is not a route'
  );
  assert.ok(
    !/\/terms["']/.test(source),
    'the page links to /terms, which is not a route'
  );
});

// ---------------------------------------------------------------------------
// The preview is worked out by the real code
// ---------------------------------------------------------------------------

check('the preview figures come from the real bill code', () => {
  assert.ok(
    /computeBill/.test(source),
    'the preview does not use the code that works out a real bill'
  );
  assert.ok(
    /largestRemainderSplit|computeSplit/.test(source),
    'the preview does not use the code that divides a bill'
  );
  assert.ok(
    /amountsFromSplit|dailyFromSplit/.test(source),
    'the preview does not use the code that divides a budget'
  );
});

check('the preview is not a picture: the reader can change a number', () => {
  // There has to be an input the reader can move. A preview with no
  // input is a picture, and a picture teaches nothing.
  assert.ok(
    /<input/.test(source),
    'there is no input in the preview, so it is a picture'
  );
  assert.ok(
    /onChange/.test(source),
    'nothing in the preview answers a change'
  );
});

// ---------------------------------------------------------------------------
// The arithmetic behind the preview is right
// ---------------------------------------------------------------------------

check('the split of a bill adds back up to the whole', () => {
  const shares = largestRemainderSplit(210000, [1, 1, 1]);
  assert.equal(shares.reduce((a, b) => a + b, 0), 210000);
  assert.deepEqual(shares, [70000, 70000, 70000]);
});

check('a bill that does not divide evenly still adds back up', () => {
  const shares = largestRemainderSplit(7000, [1, 1, 1]);
  assert.equal(shares.reduce((a, b) => a + b, 0), 7000);
  assert.deepEqual(shares, [2334, 2333, 2333]);
});

check('the tax on the preview is the real tax', () => {
  const bill = computeBill({
    lines: [
      { id: 'a', name: 'Indomie Goreng', quantity: 2, unitPrice: 3500 },
      { id: 'b', name: 'Es Te Manis', quantity: 1, unitPrice: 5000 },
    ],
    taxRuleId: 'pb1',
  });
  assert.equal(bill.subtotal, 12000);
  assert.equal(bill.taxAmount, 1200);
  assert.equal(bill.total, 13200);
});

check('the budget split on the preview adds up to a hundred', () => {
  const split = { needs: 50, wants: 20, savings: 30 };
  assert.equal(splitAddsUp(split), true);
  const amounts = amountsFromSplit(5000000, split);
  assert.equal(
    Object.values(amounts).reduce((a, b) => a + b, 0),
    5000000
  );
  const daily = dailyFromSplit(5000000, split);
  assert.equal(Object.keys(daily).length, 3);
});

check('the lines on the preview add up to the total the reader typed', () => {
  /**
   * This was wrong once, and it was wrong in a way that looked fine.
   *
   * The two example lines were scaled to the reader's total by
   * dividing the total between them, but the quantity was left on the
   * line afterwards. So the line worth half the total was worth half
   * the total AGAIN, and the receipt came to more than the reader
   * typed. The shares then added up to a number that was not on the
   * screen anywhere.
   *
   * So the preview has to be checked against the code, not against
   * the eye: the lines have to add up to the total.
   */
  const EXAMPLE = [
    { quantity: 2, unitPrice: 3500 },
    { quantity: 1, unitPrice: 5000 },
  ];
  const subtotal = 210000;
  const exampleTotal = EXAMPLE.reduce(
    (sum, line) => sum + line.quantity * line.unitPrice,
    0
  );

  const lines = EXAMPLE.map((line) => {
    const value = line.quantity * line.unitPrice;
    const share = (value / exampleTotal) * subtotal;
    return { ...line, unitPrice: Math.round(share / line.quantity) };
  });

  const sum = lines.reduce((total, line) => total + line.quantity * line.unitPrice, 0);
  assert.equal(sum, subtotal, `the lines add up to ${sum}, not ${subtotal}`);

  // And the page has to do this, not a test-only copy of it.
  assert.ok(
    /share\s*\/\s*line\.quantity/.test(source),
    'the page does not divide the share by the quantity'
  );

  // The shares of the total have to add back up to the total.
  const bill = computeBill({
    lines: lines.map((line) => ({ ...line, id: String(line.quantity) })),
    taxRuleId: 'none',
  });
  assert.equal(bill.subtotal, subtotal);
  assert.equal(bill.total, subtotal);

  const shares = largestRemainderSplit(bill.total, [1, 1, 1]);
  assert.equal(shares.reduce((a, b) => a + b, 0), subtotal);
});

// ---------------------------------------------------------------------------
// The page still works as a login page
// ---------------------------------------------------------------------------

check('the page still signs in with an email and a password', () => {
  assert.ok(/type=["']email["']/.test(source), 'there is no email field');
  // The type of the password box is the state, so the words 'text' and
  // 'password' are both there, in the same expression.
  assert.ok(
    /type=\{[^}]*password[^}]*\}/.test(source),
    'there is no password field'
  );
  assert.ok(/handleSubmit|onSubmit/.test(source), 'there is no submit');
});

check('the page still offers Google and the guest mode', () => {
  assert.ok(/handleGoogleLogin/.test(source), 'the Google sign-in is gone');
  assert.ok(/handleGuestLogin/.test(source), 'the guest mode is gone');
});

check('the page says which one it is in every language', () => {
  // The words live in the batch file, next to the other login words.
  const batchText = read('src/i18n/keys_batch3.js');
  assert.ok(
    /login_gateway:/.test(batchText),
    'the batch file has no login_gateway words'
  );

  // And the three languages hold the same words, so a reader in any of
  // them sees a sentence and not an empty space.
  for (const language of ['id', 'en', 'ja']) {
    const words = batch[language]?.login_gateway;
    assert.ok(words, `${language} has no login_gateway words`);
    assert.ok(
      Object.keys(words).length > 20,
      `${language} has only ${Object.keys(words).length} words for the new page`
    );
  }

  // The same words in all three.
  const id = Object.keys(batch.id.login_gateway).sort().join(',');
  const en = Object.keys(batch.en.login_gateway).sort().join(',');
  const ja = Object.keys(batch.ja.login_gateway).sort().join(',');
  assert.equal(id, en, 'the English page has different words from the Indonesian one');
  assert.equal(id, ja, 'the Japanese page has different words from the Indonesian one');
});

check('the words for the new page are in all three languages', () => {
  const batch = read('src/i18n/keys_batch3.js');
  // The batch file holds the login words, and it holds them for three
  // languages. The count of "login_gateway" has to be three.
  const count = (batch.match(/login_gateway:/g) || []).length;
  assert.equal(count, 3, `the login words are in ${count} languages, not 3`);
});

// ---------------------------------------------------------------------------
// The result
// ---------------------------------------------------------------------------

console.log('');
console.log(`login gateway: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
