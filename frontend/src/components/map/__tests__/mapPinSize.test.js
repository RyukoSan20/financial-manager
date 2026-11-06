/**
 * The size of the drawing on the map.
 *
 * A drawing is written at the size it was drawn at, and the page
 * asks for it at the size it should appear at. The drawing wins if
 * both say something, so a pin that is asked for at 34 pixels wide
 * and written at 120 pixels wide comes out at 120 pixels wide.
 *
 * That is not a small difference. The pin is drawn on top of the
 * circle of spending, and the two have to meet. A pin three times
 * too big stands well above the circle, and the reader is left
 * looking at a map with nothing on it, because the pin that is
 * supposed to be at the place is somewhere else entirely.
 *
 * These checks are about the drawing giving way to the page.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');

const read = (relative) =>
  fs.readFileSync(path.join(ROOT, relative), 'utf8');

/* --- the style that carries the size ---------------------------------- */

const pin = read('src/components/map/MapPlacePin.jsx');
const css = read('src/styles/merchant.css');

// The width and the height are asked for, not left to the drawing.
assert.ok(
  /\.map-pin__shape\s*\{[^}]*width:\s*\d+px/.test(css),
  'the shape of the pin is not given a width, so the drawing decides'
);
assert.ok(
  /\.map-pin__shape\s*\{[^}]*height:\s*\d+px/.test(css),
  'the shape of the pin is not given a height, so the drawing decides'
);

// The legend draws the same drawing smaller, and it must not be
// squashed by the row it sits in.
assert.ok(
  /\.map-pin__swatch\s*\{[^}]*height:/.test(css),
  'the shape in the legend has no height of its own'
);

// The drawing is asked for by its own name, so the page and the
// generator cannot drift apart.
assert.ok(
  /assets\/generated\/pin\/\$\{name\}\.svg/.test(pin),
  'the pin is not read from the generated drawings'
);

/* --- the drawings themselves ------------------------------------------ */

// A drawing that carries its own size is told what size to use.
const svgDir = path.join(ROOT, 'public/assets/generated/pin');
const drawings = fs.readdirSync(svgDir).filter((f) => f.endsWith('.svg'));

assert.ok(drawings.length > 0, 'there are no drawings for the pins');

for (const file of drawings) {
  const content = fs.readFileSync(path.join(svgDir, file), 'utf8');
  assert.ok(
    /viewBox="0 0 \d+ \d+"/.test(content),
    `${file} has no view box, so it cannot be scaled`
  );
  // The page gives the drawing its size, so a drawing that carries a
  // size of its own is made to obey the page.
  assert.ok(
    /width:\s*\d+px/.test(css) && /height:\s*\d+px/.test(css),
    'the page does not give the drawing a size of its own'
  );
}

console.log('map pin size: all checks passed');
