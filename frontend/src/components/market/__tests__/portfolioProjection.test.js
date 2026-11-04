/**
 * The projection of a portfolio.
 *
 * The projection is worked out here rather than drawn by hand, so
 * that the line on the chart and the figures under it cannot
 * disagree. These checks are about that arithmetic.
 */

import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');

// The pure parts live in their own file so that a plain node can
// read them without a bundler.
const { projectPortfolio, buildPath, buildArea } = await import(
  path.join(ROOT, 'src/utils/portfolioProjection.js')
);

/* --- the projection itself -------------------------------------------- */

// Nothing in, nothing out.
const empty = projectPortfolio(0, 0);
assert.strictEqual(empty.length, 13);
assert.ok(empty.every((point) => point.value === 0));

// Nothing put in, but something already there: it grows.
const growing = projectPortfolio(1000000, 0);
assert.ok(growing[growing.length - 1].value > growing[0].value);

// Something put in each month: it grows more.
const withContributions = projectPortfolio(1000000, 500000);
assert.ok(
  withContributions[withContributions.length - 1].value >
    growing[growing.length - 1].value,
  'putting money in has to make a difference',
);

// The number of months is the number asked for.
assert.strictEqual(projectPortfolio(1000, 100, 6).length, 7);

/* --- the money stays money --------------------------------------------- */

// A projection is a number of money, so it does not carry fractions
// of a rupiah. Two places, because a rupiah has no smaller unit
// anybody spends.
const money = projectPortfolio(1000000, 333333.33);
assert.ok(
  money.every((point) => Math.abs(point.value * 100 - Math.round(point.value * 100)) < 1e-6),
  'a projection is money to two places',
);

/* --- the flat line ----------------------------------------------------- */

// A portfolio that neither grows nor shrinks is a flat line, and a
// flat line has to be drawn as one rather than along the bottom,
// where it would look like a collapse.
const flat = projectPortfolio(0, 0);
const flatPath = buildPath(flat, 560, 220, 24);
assert.ok(flatPath.startsWith('M'));
assert.ok(flatPath.includes('L'));
assert.ok(!flatPath.includes('NaN'), 'a flat line is not NaN');

const area = buildArea(flat, 560, 220, 24);
assert.ok(area.startsWith('M'));
assert.ok(area.endsWith('Z'));

/* --- the path ---------------------------------------------------------- */

const rising = projectPortfolio(1000000, 500000);
const line = buildPath(rising, 560, 220, 24);
assert.ok(line.startsWith('M'), 'a path starts by moving');
assert.ok(!line.includes('NaN'), 'a path is made of numbers');

// The path has one point per month, plus the start.
assert.strictEqual(line.split('L').length, rising.length);

// The path stays inside the frame it was given.
for (const chunk of line.split(/[ML]/).filter(Boolean)) {
  const [x, y] = chunk.split(',').map(Number);
  assert.ok(x >= 0 && x <= 560, `x out of frame: ${x}`);
  assert.ok(y >= 0 && y <= 220, `y out of frame: ${y}`);
}

/* --- too few points ---------------------------------------------------- */

// One point is not a line.
assert.strictEqual(buildPath([{ month: 0, value: 100 }], 560, 220, 24), '');
assert.strictEqual(buildArea([{ month: 0, value: 100 }], 560, 220, 24), '');

console.log('portfolio projection: all checks passed');
