/**
 * The pins on the map.
 *
 * A pin is two layers. The shape on top is the kind of place - a
 * minimarket is not a supermarket. The circle underneath is the
 * money spent there. Two different facts, two different layers.
 *
 * These checks are about the pin agreeing with the kind, and about
 * the circle growing with the spending and no further.
 */

import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');

const {
  KIND_FRESH_PRODUCE,
  KIND_MINIMARKET,
  KIND_OTHER,
  KIND_RESTAURANT,
  KIND_SUPERMARKET,
  PINS_BY_KIND,
  pinFor,
  circleSize,
  circleColor,
} = await import(path.join(ROOT, 'src/utils/mapPins.js'));

/* --- the shape of the pin --------------------------------------------- */

const kinds = [KIND_MINIMARKET, KIND_SUPERMARKET, KIND_RESTAURANT, KIND_FRESH_PRODUCE];

for (const kind of kinds) {
  assert.ok(PINS_BY_KIND[kind], `${kind} has no pin`);
  assert.strictEqual(pinFor({ kind }), PINS_BY_KIND[kind]);
}

// A minimarket and a supermarket are not the same drawing.
assert.notStrictEqual(PINS_BY_KIND[KIND_MINIMARKET], PINS_BY_KIND[KIND_SUPERMARKET]);
assert.notStrictEqual(PINS_BY_KIND[KIND_RESTAURANT], PINS_BY_KIND[KIND_FRESH_PRODUCE]);

// Every kind has a pin of its own.
assert.strictEqual(new Set(kinds.map((k) => PINS_BY_KIND[k])).size, kinds.length);

/* --- the pin the server sends wins ------------------------------------ */

assert.strictEqual(pinFor({ kind: KIND_MINIMARKET, pin: 'pin-custom' }), 'pin-custom');
assert.strictEqual(pinFor({ kind: KIND_OTHER }), PINS_BY_KIND[KIND_OTHER]);
assert.strictEqual(pinFor(null), PINS_BY_KIND[KIND_OTHER]);

/* --- the circle under the pin ----------------------------------------- */

// Nothing spent, nothing to draw.
assert.strictEqual(circleSize(0, 1000), 22);
assert.strictEqual(circleSize(1000, 0), 22);

// The biggest place has the biggest circle.
assert.ok(circleSize(1000, 1000) > circleSize(100, 1000));

// The circle is bounded, so one huge place does not flatten the rest.
assert.ok(circleSize(1000, 1000) <= 60);
assert.ok(circleSize(1, 1000) >= 18);

// A place that spent more than the biggest (a stale total) does not
// run away.
assert.strictEqual(circleSize(5000, 1000), circleSize(1000, 1000));

/* --- the colour under the pin ----------------------------------------- */

// Each kind has its own colour, so the ground says something too.
const colours = kinds.map((k) => circleColor(k));
assert.strictEqual(new Set(colours).size, kinds.length);

// An unknown kind still has a colour.
assert.ok(circleColor(KIND_OTHER));

console.log('map pins: all checks passed');
