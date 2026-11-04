/**
 * The health bento and the shopping catalogue.
 *
 * Two things are checked here, and they are the two things that could
 * quietly go wrong.
 *
 * The first: the ratios on the health page are the ratios the server
 * worked out, with the server's own verdict on whether each one is
 * good. The page used to take the numbers out of the objects and
 * throw the verdict away, which meant the pill had to work out for
 * itself whether a ratio was good - and a second copy of the
 * thresholds is a second copy that drifts.
 *
 * The second: a price that came from the reader's own catalogue is not
 * a price in a shop. The card has to say which one it is showing, on
 * the card itself, because a card can be looked at on its own.
 *
 * Run with: node src/components/health/__tests__/wellnessBento.test.js
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

console.log('wellness bento and shopping catalogue');

// ---------------------------------------------------------------------
// The health page
// ---------------------------------------------------------------------

const healthPage = read('src/pages/HealthCoach.jsx');
const bento = read('src/components/health/CuteWellnessBento.jsx');
const pills = read('src/components/health/FinancialRatioPills.jsx');

check(
  'the page keeps the answer as it is given',
  /setHealthData\(\s*scoreRes\s*\)/.test(healthPage) &&
    /setAuditData\(\s*auditRes\s*\)/.test(healthPage),
  'a failed request gives nothing, and nothing must not be read as a score'
);

check(
  'the page asks the backend in the currency the reader is looking at',
  /api\.healthCoach\.score\(displayCurrency\)/.test(healthPage)
);

check(
  'the page hands the whole ratio to the bento, not just the number',
  /savingsRatio\s*=\s*healthData\?\.savings_ratio\s*\|\|\s*null/.test(healthPage),
  'the verdict the server worked out must survive'
);

check(
  'the bento reads the score from its props',
  /score\s*=\s*0/.test(bento) && /numericScore/.test(bento)
);

check(
  'the bento draws the score as a liquid',
  /FluidProgressBar/.test(bento)
);

check(
  'the bento shows a face, and the face follows the score',
  /mood\s*=\s*numericScore\s*>=\s*60\s*\?\s*'happy'\s*:\s*'worried'/.test(bento),
  'a smile over a bad score would be a lie'
);

check(
  'the bento is a bento grid',
  /BentoGrid/.test(bento) && /BentoItem/.test(bento)
);

// ---------------------------------------------------------------------
// The pills of the ratios
// ---------------------------------------------------------------------

check(
  'a pill reads the value and the status of the ratio it was given',
  /savingsRatio\?\.status/.test(pills) &&
    /emergencyFund\?\.status/.test(pills) &&
    /dsrRatio\?\.status/.test(pills),
  'the status is what says whether the ratio is good'
);

check(
  'a pill shows the value of the ratio',
  /savingsRatio\?\.value/.test(pills) &&
    /emergencyFund\?\.value/.test(pills) &&
    /dsrRatio\?\.value/.test(pills)
);

check(
  'the thresholds are not worked out again in the browser',
  !/IDEAL/.test(pills) && !/>=\s*30\b/.test(pills) && !/>=\s*20\b/.test(pills),
  'the server knows the thresholds; a second copy would drift'
);

// ---------------------------------------------------------------------
// The shopping catalogue
// ---------------------------------------------------------------------

const grid = read('src/components/shopping/VisualProductCatalogGrid.jsx');
const partners = read('src/components/shopping/PartnerMerchantFeedSection.jsx');
const shoppingPage = read('src/pages/Shopping/ShoppingPage.jsx');

check(
  'the grid says where the price came from',
  /local_catalog/.test(grid) && /price_reference/.test(grid),
  'a reference price must never look like a price in a shop'
);

check(
  'the grid has a card for the price and one for the shop',
  /shopping_catalog\.price_reference/.test(grid) &&
    /shopping_catalog\.live_source/.test(grid)
);

check(
  'the grid offers the two things a reader wants to do',
  /shopping_catalog\.save_to_wishlist/.test(grid) && /shopping_catalog\.open/.test(grid)
);

check(
  'the grid saves to the wishlist stage and carries the picture',
  /stage:\s*'wishlist'/.test(grid) && /image_url/.test(grid) && /price_source/.test(grid)
);

check(
  'the partner section reads the shelf of the reader\'s own shops',
  /listMerchants/.test(partners) && /listProducts/.test(partners)
);

check(
  'the shopping page uses the endpoint that already exists',
  /\/shopping-search\/search\?q=/.test(shoppingPage),
  'the search endpoint is already there; a new one would be a copy'
);

check(
  'the shopping page shows the answer as it is given',
  /setCatalogAnswer\(found\)/.test(shoppingPage) &&
    !/catalogAnswer\?\.ok/.test(shoppingPage) &&
    !/await \w+Res\.json\(\)/.test(shoppingPage)
);

check(
  'the shopping page shows both the grid and the partner shops',
  /VisualProductCatalogGrid/.test(shoppingPage) &&
    /PartnerMerchantFeedSection/.test(shoppingPage)
);

// ---------------------------------------------------------------------
// The words
// ---------------------------------------------------------------------

for (const language of ['id', 'en', 'ja']) {
  const table = read(`src/i18n/${language}.js`);
  check(
    `the ${language} words are there`,
    table.includes('shopping_catalog:') && table.includes('status_excellent:')
  );
}

// ---------------------------------------------------------------------

console.log('');
console.log(`wellness bento: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('');
  for (const f of failures) console.log('  FAIL ' + f);
  process.exit(1);
}
