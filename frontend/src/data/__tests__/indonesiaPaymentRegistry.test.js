/**
 * The table of Indonesian payment institutions.
 *
 * There are two copies of it: one in the browser and one in the
 * server. They exist because the account form fills itself in without
 * waiting for a request, and the server has to know the same things
 * when it reads a line of Indonesian.
 *
 * Two copies of one table is a way for them to drift. So this holds
 * them the same.
 *
 * What is checked here:
 *
 * - the institutions that matter are all there, with the codes and the
 *   lengths that Indonesia actually uses;
 * - a line of Indonesian names the right institution - "livin" is
 *   Mandiri, "tsel" is Telkomsel, "mybca" is BCA;
 * - a phone number names the operator that owns it, however it is
 *   written;
 * - the number is checked against the length that institution uses,
 *   and is written the way it is written on the card;
 * - and a transfer costs what that rail costs, with the e-wallet's
 *   own fee for a top-up.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  INSTITUTIONS,
  INSTITUTION_BY_ID,
  INSTITUTION_GROUPS,
  TRANSFER_METHODS,
  BANK_CONVENTIONAL,
  BANK_DIGITAL,
  BANK_SYARIAH,
  BANK_BPD,
  EWALLET,
  EMONEY_CARD,
  PULSA_TELCO,
  PAYLATER_CREDIT,
  CASH,
  SESAMA_BANK,
  BI_FAST,
  RTOL_ONLINE,
  TOPUP_EWALLET,
  QRIS,
  detectProviderFromText,
  detectTransferMethodFromText,
  detectTelcoByPhonePrefix,
  validateAccountNumber,
  transferFee,
  merchantMdr,
  institutionsInGroup,
  findInstitution,
  numberHint,
  institutionBadge,
} from '../indonesiaPaymentRegistry.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FRONTEND = join(HERE, '..', '..', '..');

const check = (name, fn) => {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (err) {
    console.error(`not ok - ${name}`);
    console.error(`  ${err.message}`);
    process.exitCode = 1;
  }
};

// ---------------------------------------------------------------------------
// The table
// ---------------------------------------------------------------------------

check('every family of institution is in the table', () => {
  const kinds = new Set(INSTITUTIONS.map((i) => i.kind));
  for (const kind of [
    BANK_CONVENTIONAL, BANK_DIGITAL, BANK_SYARIAH, BANK_BPD,
    EWALLET, EMONEY_CARD, PULSA_TELCO, PAYLATER_CREDIT, CASH,
  ]) {
    assert.ok(kinds.has(kind), `the family ${kind} is missing`);
  }
});

check('the well known banks are there with their codes', () => {
  const expected = {
    bca: '014',
    mandiri: '008',
    bri: '002',
    bni: '009',
    btn: '200',
    bsi: '451',
    jago: '542',
    seabank: '535',
    blu: '501',
  };
  for (const [id, code] of Object.entries(expected)) {
    const institution = INSTITUTION_BY_ID[id];
    assert.ok(institution, `${id} is missing`);
    assert.equal(institution.code, code, `${id} has the wrong code`);
  }
});

check('the account number lengths are the ones used', () => {
  const expected = {
    bca: 10, mandiri: 13, bri: 15, bni: 10, btn: 16,
    jago: 12, seabank: 12, blu: 12,
  };
  for (const [id, digits] of Object.entries(expected)) {
    assert.equal(INSTITUTION_BY_ID[id].digits, digits, `${id} has the wrong length`);
  }
});

check('the ids are unique', () => {
  const ids = INSTITUTIONS.map((i) => i.id);
  assert.equal(ids.length, new Set(ids).size);
});

check('every institution has a name, a kind and a colour', () => {
  for (const institution of INSTITUTIONS) {
    assert.ok(institution.name, `${institution.id} has no name`);
    assert.ok(institution.kind, `${institution.id} has no kind`);
    assert.ok(institution.color, `${institution.id} has no colour`);
  }
});

check('every group has at least one institution', () => {
  for (const group of INSTITUTION_GROUPS) {
    assert.ok(
      institutionsInGroup(group.kind).length > 0,
      `the group ${group.kind} is empty`
    );
  }
});

// ---------------------------------------------------------------------------
// Reading a line of Indonesian
// ---------------------------------------------------------------------------

check('a line names the institution', () => {
  const cases = [
    ['livin', 'mandiri'],
    ['gopay', 'gopay'],
    ['seabank', 'seabank'],
    ['spaylater', 'spaylater'],
    ['tsel', 'telkomsel'],
    ['mybca', 'bca'],
    ['klikbca', 'bca'],
    ['brimo', 'bri'],
    ['gojek', 'gopay'],
    ['kartu 3', 'indosat'],
    ['bca digital', 'blu'],
    ['shopee paylater', 'spaylater'],
    ['kopi jago 10rb gopay', 'gopay'],
    ['makan siang 35rb qris mybca', 'bca'],
    ['paket data tsel 50rb', 'telkomsel'],
  ];
  for (const [text, expected] of cases) {
    const found = detectProviderFromText(text);
    assert.ok(found, `nothing was found in ${text}`);
    assert.equal(found.id, expected, `${text} found the wrong one`);
  }
});

check('the longest alias wins', () => {
  // "bca digital" is blu, not BCA. They are different banks.
  assert.equal(detectProviderFromText('transfer ke bca digital 500rb').id, 'blu');
  assert.equal(detectProviderFromText('transfer ke bca 500rb').id, 'bca');
});

check('a line that names nothing names nothing', () => {
  assert.equal(detectProviderFromText('makan siang 35rb'), null);
  assert.equal(detectProviderFromText(''), null);
  assert.equal(detectProviderFromText(undefined), null);
});

check('a word that only looks like one is not one', () => {
  assert.equal(detectProviderFromText('bcar 10rb'), null);
});

check('the rails are named too', () => {
  assert.equal(detectTransferMethodFromText('qris 50rb').id, QRIS);
  assert.equal(detectTransferMethodFromText('bifast 100rb').id, BI_FAST);
  assert.equal(detectTransferMethodFromText('rtol 100rb').id, RTOL_ONLINE);
  assert.equal(detectTransferMethodFromText('100rb'), null);
});

// ---------------------------------------------------------------------------
// The phone number
// ---------------------------------------------------------------------------

check('the number names the operator', () => {
  const cases = [
    ['081234567890', 'telkomsel'],
    ['081312345678', 'telkomsel'],
    ['082312345678', 'telkomsel'],
    ['085112345678', 'telkomsel'],
    ['081412345678', 'indosat'],
    ['081512345678', 'indosat'],
    ['089512345678', 'indosat'],
    ['081712345678', 'xl'],
    ['087712345678', 'xl'],
    ['083112345678', 'xl'],
    ['088112345678', 'smartfren'],
    ['088912345678', 'smartfren'],
  ];
  for (const [number, expected] of cases) {
    const found = detectTelcoByPhonePrefix(number);
    assert.ok(found, `nothing was found for ${number}`);
    assert.equal(found.id, expected, `${number} found the wrong operator`);
  }
});

check('the number is the same however it is written', () => {
  const ids = [
    detectTelcoByPhonePrefix('081234567890'),
    detectTelcoByPhonePrefix('+6281234567890'),
    detectTelcoByPhonePrefix('0812 3456 7890'),
  ].map((f) => f.id);
  assert.deepEqual(ids, ['telkomsel', 'telkomsel', 'telkomsel']);
});

check('a number that is not a phone number names nothing', () => {
  assert.equal(detectTelcoByPhonePrefix('1234567890'), null);
  assert.equal(detectTelcoByPhonePrefix(''), null);
  assert.equal(detectTelcoByPhonePrefix(undefined), null);
});

check('an unknown prefix names nothing', () => {
  assert.equal(detectTelcoByPhonePrefix('089012345678'), null);
});

// ---------------------------------------------------------------------------
// The number
// ---------------------------------------------------------------------------

check('a bank number is written the way it is on the card', () => {
  const result = validateAccountNumber('bca', '1234567890');
  assert.equal(result.valid, true);
  assert.equal(result.formatted, '123-456-7890');
});

check('a phone number is written the way it is dialled', () => {
  const result = validateAccountNumber('gopay', '081234567890');
  assert.equal(result.valid, true);
  assert.equal(result.formatted, '0812-3456-7890');
});

check('a number of the wrong length is refused', () => {
  const result = validateAccountNumber('bca', '12345');
  assert.equal(result.valid, false);
  assert.equal(result.error, 'wrong_length');
  assert.ok(result.expected.includes('10'));
});

check('an empty number is refused', () => {
  const result = validateAccountNumber('bca', '');
  assert.equal(result.valid, false);
  assert.equal(result.error, 'empty');
});

check('a number that is not a phone number is refused', () => {
  const result = validateAccountNumber('gopay', '12345');
  assert.equal(result.valid, false);
  assert.equal(result.error, 'not_a_phone_number');
});

check('an institution nobody hears of is refused', () => {
  const result = validateAccountNumber('not_a_bank', '1234567890');
  assert.equal(result.valid, false);
  assert.equal(result.error, 'unknown_provider');
});

check('cash takes no number', () => {
  assert.equal(validateAccountNumber('cash', '').valid, true);
});

// ---------------------------------------------------------------------------
// The fee
// ---------------------------------------------------------------------------

check('the rails cost what they cost', () => {
  assert.equal(transferFee(SESAMA_BANK), 0);
  assert.equal(transferFee(BI_FAST), 2500);
  assert.equal(transferFee(RTOL_ONLINE), 6500);
  assert.equal(transferFee(QRIS), 0);
});

check('a top up costs what the wallet charges', () => {
  assert.equal(transferFee(TOPUP_EWALLET, 'dana'), 500);
  assert.equal(transferFee(TOPUP_EWALLET, 'gopay'), 1000);
  assert.equal(transferFee(TOPUP_EWALLET, 'ovo'), 1000);
  assert.equal(transferFee(TOPUP_EWALLET, 'shopeepay'), 1000);
});

check('a shop pays the qris share', () => {
  assert.equal(merchantMdr(QRIS), 0.007);
  assert.equal(transferFee(QRIS), 0);
});

check('a rail nobody hears of costs nothing', () => {
  assert.equal(transferFee('NOT_A_RAIL'), 0);
});

// ---------------------------------------------------------------------------
// The form
// ---------------------------------------------------------------------------

check('the field says what it wants', () => {
  assert.equal(numberHint('seabank'), '12 digit');
  assert.equal(numberHint('gopay'), 'Nomor HP 08xx');
  assert.equal(numberHint('bca'), '10 digit');
});

check('the badge carries the bank code', () => {
  assert.equal(institutionBadge('bca'), 'Kode Bank 014');
  assert.equal(institutionBadge('seabank'), 'Kode Bank 535');
  assert.equal(institutionBadge('gopay'), 'GoPay');
});

// ---------------------------------------------------------------------------
// The two copies
// ---------------------------------------------------------------------------

check('the two copies of the table are the same', () => {
  // The server's copy is the authority. If this fails, the browser
  // and the server disagree about which bank is which, and the reader
  // is shown one thing by the form and another by the agent.
  const server = parseServerInstitutions();

  assert.equal(
    server.length, INSTITUTIONS.length,
    `the server has ${server.length} institutions and the browser has ${INSTITUTIONS.length}`
  );

  for (const institution of INSTITUTIONS) {
    const theirs = server.find((i) => i.id === institution.id);
    assert.ok(theirs, `the server does not have ${institution.id}`);
    assert.equal(theirs.name, institution.name, `${institution.id} has two names`);
    assert.equal(theirs.kind, institution.kind, `${institution.id} has two kinds`);
    assert.equal(theirs.code, institution.code, `${institution.id} has two codes`);
    assert.equal(theirs.digits, institution.digits, `${institution.id} has two lengths`);
  }
});

check('the two copies have the same rails', () => {
  const server = parseServerMethods();

  assert.equal(
    server.length, TRANSFER_METHODS.length,
    `the server has ${server.length} rails and the browser has ${TRANSFER_METHODS.length}`
  );

  for (const method of TRANSFER_METHODS) {
    const theirs = server.find((m) => m.id === method.id);
    assert.ok(theirs, `the server does not have the rail ${method.id}`);
    assert.equal(theirs.fee, method.fee, `${method.id} is charged differently`);
  }
});

/**
 * The institutions as the server writes them.
 *
 * The server's table is the authority, so the browser's copy is
 * checked against the server's own source rather than against a
 * second copy of the same list - which would only prove that the
 * list agrees with itself.
 */
function parseServerInstitutions() {
  const source = readFileSync(serverPath('indonesia_payments.py'), 'utf8');
  const rows = [];

  const pattern = /_institution\(\s*"([^"]+)",\s*"([^"]+)",\s*([A-Z_]+),\s*(None|"[^"]*"),\s*(None|\d+)/g;
  let match;
  while ((match = pattern.exec(source)) !== null) {
    rows.push({
      id: match[1],
      name: match[2],
      kind: match[3],
      code: match[4] === 'None' ? null : match[4].slice(1, -1),
      digits: match[5] === 'None' ? null : Number(match[5]),
    });
  }

  return rows;
}

/**
 * The rails as the server writes them.
 */
function parseServerMethods() {
  const source = readFileSync(serverPath('indonesia_payments.py'), 'utf8');
  const rows = [];

  const pattern = /"id":\s*([A-Z_]+),\s*"name":\s*"[^"]*",\s*"fee":\s*(\d+)/g;
  let match;
  while ((match = pattern.exec(source)) !== null) {
    rows.push({ id: match[1], fee: Number(match[2]) });
  }

  return rows;
}

/**
 * Where the server's table lives.
 */
function serverPath(fileName) {
  return join(FRONTEND, '..', 'backend', 'app', 'core', fileName);
}
