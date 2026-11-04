/**
 * The projection of a portfolio.
 *
 * The reader puts in what they have and what they put away each
 * month, and this works out where that puts them.
 *
 * The arithmetic is here, apart from the drawing, so that a plain
 * node can check it and so that the line on the chart and the
 * figures under it cannot disagree.
 *
 * The picture is a projection and not a promise: it says what would
 * happen if the money kept coming in at the same rate and the return
 * stayed the same. It is labelled as a projection on the chart
 * itself, because a line on a graph that goes up and to the right is
 * the kind of thing people believe too easily.
 */

/**
 * The months a projection is worked out over.
 */
export const MONTHS = 12;

/**
 * The monthly interest rate the projection assumes.
 *
 * A year of twelve months, compounded monthly. It is a plain guess
 * and it is written down in one place, so that the reader is not
 * told a rate the chart does not use.
 */
export const MONTHLY_RATE = 0.008;

/**
 * What a portfolio is worth after a number of months.
 *
 * Each month the money that was put in grows, and then the new
 * contribution is added. The order matters: the contribution is
 * added at the end of the month, so it does not earn interest in
 * the month it arrives.
 */
/**
 * A number of money, to two places.
 *
 * Rounded through the string, because the arithmetic on floats does
 * not round the way a reader expects: 1.005 * 100 is 100.49999 and
 * rounds down to 100 rather than up to 101.
 */
export function round2(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function projectPortfolio(starting, monthly, months = MONTHS, rate = MONTHLY_RATE) {
  const points = [];
  let value = Number(starting) || 0;
  const contribution = Number(monthly) || 0;

  for (let month = 0; month <= months; month += 1) {
    // Rounded to two places, so that a projection is a number of
    // money and not a string of floating point noise. The rounding
    // is done on the string, because Math.round(1.005 * 100) is
    // 100 and not 101.
    points.push({ month, value: round2(value) });
    value = value * (1 + rate) + contribution;
  }

  return points;
}

/**
 * The path of the chart, as a string the SVG can draw.
 */
export function buildPath(points, width, height, padding) {
  if (!points || points.length < 2) return '';

  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  // A flat line has no height, so it is given one. Otherwise the
  // line would be drawn along the bottom and would look like a
  // collapse rather than a flat.
  const span = max - min || Math.abs(max) || 1;

  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;

  return points
    .map((point, index) => {
      const x = padding + (index / (points.length - 1)) * innerWidth;
      const y = padding + innerHeight - ((point.value - min) / span) * innerHeight;
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
}

/**
 * The area under the line, filled in.
 */
export function buildArea(points, width, height, padding) {
  const path = buildPath(points, width, height, padding);
  if (!path) return '';
  const innerHeight = height - padding * 2;
  return `${path} L${(width - padding).toFixed(2)},${(height - padding + innerHeight).toFixed(2)} L${padding},${(
    height - padding + innerHeight
  ).toFixed(2)} Z`;
}

