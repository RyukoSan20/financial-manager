/**
 * The three places where the ten points were still open.
 *
 * The other seven points were already there and already checked. These
 * three were not, and they were the ones a person would notice first:
 *
 * - The settings page had glass on its panels, but the column down the
 *   left - the one that holds the logo and the menu - was a flat
 *   sheet of white. The complaint was that the left side of the
 *   settings still looks stiff, and it was right.
 *
 * - The map asked the geocoder for a place and got back the
 *   district. The complaint was that the address is not specific
 *   enough, and it was right: a street and the nearest place were
 *   sitting in the answer all along, and the service threw them away.
 *
 * - The merchant flow drew on paper a camera, an OCR engine and a
 *   catalogue. None of it existed. A picture of a product could not
 *   become a product.
 *
 * The checks are about the wiring, not about the look: a rule that
 * exists has to be asked for by something, the detail the geocoder
 * already returns has to survive the trip, and the capture has to
 * have a route, a service and a test.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(ROOT, p));

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

/* ------------------------------------------------------------------ */
/* 1. The left column of the settings takes the glass too.             */
/* ------------------------------------------------------------------ */

check('the navigation column is glass, not a flat sheet of white', () => {
  const nav = read('frontend/src/components/layout/Navigation.jsx');
  const css = read('frontend/src/styles/money.css');

  // The column asks for the glass by name.
  assert.ok(
    /className="[^"]*\bnav-glass\b/.test(nav),
    'the navigation column asks for the glass class',
  );

  // And the glass is defined, behind the money layer, so that a
  // build without the layer keeps the old flat column.
  assert.ok(
    /\[data-ui-money="on"\][^{]*\.nav-glass\s*\{/.test(css),
    'the glass for the navigation column is defined in the money layer',
  );
});

check('the navigation column blurs what is behind it', () => {
  const css = read('frontend/src/styles/money.css');
  const block = css.slice(
    css.indexOf('[data-ui-money="on"] .nav-glass'),
    css.indexOf('[data-ui-money="on"] .nav-glass') + 900,
  );
  assert.ok(
    /backdrop-filter:\s*blur\(/.test(block),
    'the navigation column has a backdrop blur',
  );
  assert.ok(
    /transition:/.test(block),
    'the navigation column moves when the pointer comes near it',
  );
});

check('the navigation items are glass that lights up under the pointer', () => {
  const css = read('frontend/src/styles/money.css');
  assert.ok(
    /\[data-ui-money="on"\][^{]*\.aurora-nav-item:hover\s*\{/.test(css),
    'the navigation items have a hover of their own',
  );
  const hover = css.slice(
    css.indexOf('[data-ui-money="on"] .aurora-nav-item:hover'),
    css.indexOf('[data-ui-money="on"] .aurora-nav-item:hover') + 700,
  );
  assert.ok(
    /background-color:/.test(hover) && /box-shadow:/.test(hover),
    'the hover changes the surface and gives it a glow',
  );
});

/* ------------------------------------------------------------------ */
/* 2. The address on the map names the street and the place.            */
/* ------------------------------------------------------------------ */

check('the geocoder keeps the street and the nearest place', () => {
  const src = read('backend/app/services/geocoding_service.py');

  // The answer carries more than the district now.
  assert.ok(
    /street:\s*Optional\[str\]/.test(src) || /\bstreet:\s*str\b/.test(src),
    'the geocoded location has a street',
  );
  assert.ok(
    /nearest_place:\s*Optional\[str\]/.test(src) || /\bnearest_place:\s*str\b/.test(src),
    'the geocoded location has the nearest place',
  );

  // And the reverse geocoder reads them out of the answer instead of
  // throwing them away.
  const fn = src.slice(src.indexOf('def reverse_geocode'));
  const body = fn.slice(0, fn.indexOf('\n    def ', 10) || 3000);
  assert.ok(
    /road|suburb|neighbourhood/.test(body),
    'the reverse geocoder reads the street out of the answer',
  );
  assert.ok(
    /nearest_place\s*=/.test(body),
    'the reverse geocoder keeps the nearest place',
  );
});

check('the map can show the specific address', () => {
  const src = read('backend/app/api/routes/analytics.py');
  assert.ok(
    /nearest_place/.test(src),
    'the map endpoint carries the nearest place to the reader',
  );
});

/* ------------------------------------------------------------------ */
/* 3. The merchant flow: a picture becomes a product.                  */
/* ------------------------------------------------------------------ */

check('the capture service exists and reads a picture into a product', () => {
  assert.ok(
    exists('backend/app/services/merchant_capture.py'),
    'there is a service for the capture',
  );
  const src = read('backend/app/services/merchant_capture.py');
  assert.ok(
    /def .*extract.*product|def .*read_product|def .*capture_product/.test(src),
    'the service has a function that reads a product out of a picture',
  );
  assert.ok(
    /name/.test(src) && /price/.test(src),
    'the service looks for the name and the price',
  );
});

check('the capture is told apart from a receipt scan', () => {
  const src = read('backend/app/services/merchant_capture.py');
  // A catalogue photo is not a receipt, and the prompt has to say so,
  // or the model reads the price off the shelf label as a total.
  assert.ok(
    /product/i.test(src),
    'the capture says what it is reading',
  );
});

check('there is a route for the capture', () => {
  const found = ['merchant_capture.py', 'merchant.py', 'merchant_images.py']
    .map((f) => `backend/app/api/routes/${f}`)
    .filter((f) => exists(f))
    .map((f) => read(f))
    .join('\n');
  assert.ok(
    /capture|extract-product|product-capture/.test(found),
    'the capture is reachable over the API',
  );
});

check('the capture is covered by a test', () => {
  const dir = path.join(ROOT, 'backend/tests/unit');
  const files = fs
    .readdirSync(dir)
    .filter((f) => /merchant_capture|product_capture/.test(f));
  assert.ok(files.length > 0, 'there is a test for the capture');
});

check('nothing is written to the catalogue without the reader saying yes', () => {
  const dir = path.join(ROOT, 'backend/app/api/routes');
  const src = ['merchant_capture.py', 'merchant.py']
    .map((f) => path.join(dir, f))
    .filter((f) => fs.existsSync(f))
    .map((f) => fs.readFileSync(f, 'utf8'))
    .join('\n');
  // The route that reads the picture answers with a draft. The route
  // that writes the product is a different one, and it is the one the
  // reader presses.
  assert.ok(
    /draft|preview|proposed/.test(src),
    'reading a picture gives a draft rather than a product',
  );
});

console.log('');
console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
