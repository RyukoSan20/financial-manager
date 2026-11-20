/**
 * The three ways of adding a transaction by reading something.
 *
 * Run with: node src/components/parser/__tests__/parserScreens.test.js
 *
 * These are plain node files, because there is no test runner in this
 * project. Each one prints its own count and exits non-zero when
 * something fails.
 *
 * The three screens - the text parser, the voice input and the receipt
 * scanner - were all broken in ways that cost the reader their
 * purchase:
 *
 *  - the parser read a sentence with two things in it as one lump
 *    with a total on it, and left the account box empty;
 *  - the voice input read the place as the shop;
 *  - the scanner showed a black rectangle and then lost the
 *    transaction.
 *
 * The reading of a sentence is checked by running it. The screens
 * themselves are checked by reading their source, because there is no
 * way to mount a component here.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { localReading } from '../../../features/transactions/nlp/localReading.js';
import { emptyReading } from '../../../features/transactions/nlp/shape.js';

let passed = 0;
let failed = 0;
const failures = [];

function check(name, actual, expected) {
  if (actual === expected) {
    passed += 1;
  } else {
    failed += 1;
    failures.push(
      `${name}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`
    );
  }
}

function ok(name, condition) {
  if (condition) {
    passed += 1;
  } else {
    failed += 1;
    failures.push(name);
  }
}

const HERE = dirname(fileURLToPath(import.meta.url));
const PARSER_DIR = resolve(HERE, '..');

// ---------------------------------------------------------------------------
// The reading, worked out in the browser
//
// This is the fallback for a reader who is offline. It has to be good
// enough to save a transaction from.
// ---------------------------------------------------------------------------

check('an empty reading has no items', emptyReading().items.length, 0);

{
  const reading = localReading('beli 2 kopi susu @18rb sama 1 roti bakar 22rb');
  check('a purchase of two things has two lines', reading.items.length, 2);
  check('the first line is the coffees', reading.items[0].name, 'Kopi Susu');
  check('the count is kept', reading.items[0].quantity, 2);
  check('the price of one is kept', reading.items[0].unit_price, 18000);
  check('the sum of the lines is the total', reading.total_amount, 58000);
}

{
  const reading = localReading('gajian masuk 8.5jt ke bca');
  check('a salary is income', reading.type, 'income');
  check('the salary is read', reading.total_amount, 8500000);
}

{
  const reading = localReading('transfer 500rb dari bca ke ovo');
  check('a transfer is a transfer', reading.type, 'transfer');
  check('the transfer is read', reading.total_amount, 500000);
}

{
  const reading = localReading('beli kopi jago 2 harganya Rp15.000 rasa vanila di Kemayoran');
  check('the place is not the shop', reading.merchant !== 'Kemayoran', true);
  check('the total is the sum of the lines', reading.total_amount, 30000);
  check('the count is kept', reading.items[0].quantity, 2);
  check('the price of one is kept', reading.items[0].unit_price, 15000);
}

{
  const reading = localReading('');
  check('an empty sentence reads as nothing', reading.total_amount, 0);
  check('an empty sentence has no lines', reading.items.length, 0);
}

{
  const reading = localReading('asdkjh qwe zxc');
  check('nonsense does not crash the reading', reading.type, 'expense');
  check('nonsense has no lines', reading.items.length, 0);
}

// ---------------------------------------------------------------------------
// The screens themselves
//
// A source file cannot be run here, so the screens are checked by
// reading them. What is checked is the thing that was broken: the
// camera is attached to the video, the file input is always there,
// the lines can be edited, and the companion is on the screen.
// ---------------------------------------------------------------------------

function readSource(name) {
  return readFileSync(resolve(PARSER_DIR, name), 'utf8');
}

{
  const scanner = readSource('ReceiptScannerModal.jsx');

  ok(
    'the scanner attaches the stream to the video element',
    /video\.srcObject\s*=\s*stream/.test(scanner)
  );
  ok(
    'the stream is attached in an effect, not in the click',
    /useEffect\(\(\)\s*=>\s*\{[\s\S]{0,300}video\.srcObject\s*=\s*stream[\s\S]{0,300}\},\s*\[/.test(
      scanner
    )
  );
  ok(
    'the scanner asks for the back camera',
    /facingMode:\s*\{\s*ideal:\s*'environment'\s*\}/.test(scanner)
  );
  ok('the scanner asks for no sound', /audio:\s*false/.test(scanner));
  ok('the video is muted', /muted/.test(scanner));
  ok(
    'the scanner always offers a file',
    /type="file"[\s\S]{0,200}accept="image\/\*"/.test(scanner)
  );
  ok(
    'the file input can use the camera of the phone',
    /capture="environment"/.test(scanner)
  );
  ok('the scanner says when the camera is starting', /cameraStarting/.test(scanner));
  ok('the scanner offers a retry', /cameraRetry/.test(scanner));
  ok('the scanner can switch camera', /switchCamera/.test(scanner));
  ok('the scanner shows the lines of the bill', /LineItemEditor/.test(scanner));
  ok(
    'the scanner sends the lines with the transaction',
    /items:\s*itemPayload/.test(scanner)
  );
  ok(
    'the scanner queues the receipt for the review',
    /api\.feed\.scanReceipt/.test(scanner)
  );
  ok(
    'the scanner warns when the lines and the total disagree',
    /linesDisagree/.test(scanner)
  );
  ok(
    'the scanner reads the whole receipt even when the server cannot',
    /applyReading/.test(scanner)
  );
}

{
  const parser = readSource('TextParserModal.jsx');

  ok('the parser has the companion on the screen', /DraggableSparkleMascot/.test(parser));
  ok('the parser can ask the companion', /magic_button|Tanya Maskot/.test(parser));
  ok('the parser shows the lines of the bill', /LineItemEditor/.test(parser));
  ok('the parser asks the server to read the sentence', /readSentence/.test(parser));
  ok('the parser explains what was fixed', /describeFixes/.test(parser));
  ok('the parser shows the place on its own', /location/.test(parser));
  ok('the parser picks the account', /account_id/.test(parser));
}

{
  const voice = readSource('VoiceTransactionModal.jsx');

  ok('the voice input has the companion on the screen', /DraggableSparkleMascot/.test(voice));
  ok('the voice input can ask the companion', /magic_button|Tanya Maskot/.test(voice));
  ok('the voice input shows the lines of the bill', /LineItemEditor/.test(voice));
  ok('the voice input reads the sentence aloud', /speak\(/.test(voice));
  ok('the voice input can be muted', /setMuted|isMuted/.test(voice));
  ok('the voice input shows the place on its own', /location/.test(voice));
  ok('the voice input picks the account', /account_id/.test(voice));
  ok('the voice input listens', /recognition|SpeechRecognition/.test(voice));
}

// ---------------------------------------------------------------------------
// The list of lines
//
// The editor is a component, so it cannot be imported here. What is
// checked is that it is used the same way by all three screens, and
// that the screens can add a line and take one away.
// ---------------------------------------------------------------------------

{
  const editor = readFileSync(
    resolve(PARSER_DIR, '..', 'transactions', 'LineItemEditor.jsx'),
    'utf8'
  );

  ok('the editor can add a line', /addRow/.test(editor));
  ok('the editor can take a line away', /removeRow/.test(editor));
  ok('the editor shows the sum of the lines', /linesTotal/.test(editor));
  ok('the editor takes both names for the lines', /items !== undefined \? items : lines/.test(editor));
}

// ---------------------------------------------------------------------------

if (failed) {
  console.error(`\n${failed} failed, ${passed} passed\n`);
  for (const failure of failures) {
    console.error(`  FAIL  ${failure}`);
  }
  console.error('');
  process.exit(1);
}

console.log(`${passed} passed`);
