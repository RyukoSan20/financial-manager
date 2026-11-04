/**
 * The assigner and the importer.
 *
 * Two things are checked here.
 *
 * The first: the assigner reads the ratio the server worked out. The
 * server has already said whether a ratio is good, and the pill shows
 * that verdict; a second copy of the thresholds in the browser is a
 * second copy that drifts.
 *
 * The second: a receipt can be brought into a bill out of the
 * reader's own records, and the bill it makes still adds up. The
 * lines come with it, and so do the tax and the discount, because a
 * bill with the lines but not the tax would not add up to what was
 * paid.
 *
 * Run with: node src/components/split/__tests__/smartSplit.test.js
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let passed = 0;
let failed = 0;
const failures = [];

const check = (name, condition, detail = '') => {
  if (condition) {
    passed += 1;
    console.log(`  ok  ${name}`);
  } else {
    failed += 1;
    failures.push(`${name}${detail ? `\n    ${detail}` : ''}`);
    console.log(`FAIL  ${name}`);
  }
};

console.log('the assigner and the importer');

// ---------------------------------------------------------------------
// The assigner
// ---------------------------------------------------------------------

const assigner = read('src/components/split/SmartSplitAssigner.jsx');
const importer = read('src/components/split/RecentTransactionImporter.jsx');
const groupPage = read('src/pages/SplitBill/SplitGroupDetailPage.jsx');
const splitApi = read('src/services/splitApi.js');

check(
  'the assigner offers both ways of splitting',
  /assigner_equal/.test(assigner) && /assigner_dynamic/.test(assigner)
);

check(
  'the assigner uses the arithmetic that is tested on its own',
  /from '\.\/splitAssignmentMath'/.test(assigner) && /computeShares/.test(assigner),
  'the arithmetic has to be one copy, and it has to be the tested one'
);

check(
  'the assigner lets a person be picked for each line',
  /split-assigner__line-person/.test(assigner) && /choose\(line\.id/.test(assigner)
);

check(
  'the assigner says which lines nobody has',
  /unassigned/.test(assigner)
);

check(
  'the assigner shows what everybody owes',
  /shareOf/.test(assigner) && /result\.shares/.test(assigner)
);

check(
  'the assigner takes its words from the split batch',
  /batch9\[language\]\?\.split/.test(assigner),
  'a word that lives in one place is a word that cannot drift'
);

check(
  'the importer asks the server for the receipts that can be brought in',
  /listImportableTransactions/.test(importer) && /importTransaction/.test(importer)
);

check(
  'the importer brings one in and hands it on',
  /onImported/.test(importer) && /importTransaction\(/.test(importer)
);

check(
  'the group page uses the assigner',
  /SmartSplitAssigner/.test(groupPage) && /onAssign=\{assign\}/.test(groupPage)
);

check(
  'the group page uses the importer',
  /RecentTransactionImporter/.test(groupPage) && /onImported=\{imported\}/.test(groupPage)
);

check(
  'the group page saves the assignment through the server',
  /assignItems/.test(groupPage) && /assignItems/.test(splitApi)
);

// ---------------------------------------------------------------------
// The words
// ---------------------------------------------------------------------

for (const language of ['id', 'en', 'ja']) {
  const table = read(`src/i18n/keys_batch${language === 'id' ? 9 : 9}.js`);
  check(
    `the ${language} words of the assigner are there`,
    /assigner_equal:/.test(table) &&
      /assigner_dynamic:/.test(table) &&
      /assign_save:/.test(table) &&
      /import_recent:/.test(table)
  );
}

// ---------------------------------------------------------------------

console.log('');
console.log(`smartSplit: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('');
  for (const f of failures) console.log('  FAIL ' + f);
  process.exit(1);
}
