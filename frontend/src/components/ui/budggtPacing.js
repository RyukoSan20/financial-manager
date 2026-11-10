/**
 * The arithmetic of a pacing bar.
 *
 * A pacing bar says two things at once: how much of the limit has
 * been used, and how much of the month has gone. When the bar is
 * ahead of the tick, the money is going faster than the days.
 *
 * It is here, with no React in it, so a script can check it.
 */

export const PACING_COLORS = {
  needs: '#7C3AED', // violet
  wants: '#F59E0B', // amber, while there is room
  savings: '#10B981', // emerald
  warning: '#F97316', // coral: near the limit, or past it
};

/** At this share of the limit a bar is "near" it. */
export const NEAR_LIMIT = 80;

/** How much of the limit has been used, as a percentage. May pass 100. */
export function pacingPercent(spent, limit) {
  const used = Number(spent) || 0;
  const cap = Number(limit) || 0;
  if (cap <= 0) return 0;
  return Math.max(0, (used / cap) * 100);
}

/** How wide to draw the bar. It stops at the end of the track. */
export function pacingWidth(spent, limit) {
  return Math.min(100, pacingPercent(spent, limit));
}

/** Where today is on the bar, as a percentage of the month. */
export function pacingTick(currentDay, totalDays) {
  const day = Number(currentDay) || 0;
  const days = Number(totalDays) || 0;
  if (days <= 0) return 0;
  return Math.max(0, Math.min(100, (day / days) * 100));
}

/**
 * How a row is doing.
 *
 * - "empty": there is no limit to measure against;
 * - "over": past the limit;
 * - "near": at eighty per cent of it or more;
 * - "ahead": under eighty, but further along than the month is;
 * - "calm": otherwise.
 *
 * Savings is the other way round. Filling that bar is the point, so
 * it is never "near" or "over" - a full one is "reached".
 */
export function pacingTone({ spent, limit, currentDay, totalDays, goodWhenFull = false }) {
  if ((Number(limit) || 0) <= 0) return 'empty';
  const percent = pacingPercent(spent, limit);
  if (goodWhenFull) return percent >= 100 ? 'reached' : 'calm';
  if (percent > 100) return 'over';
  if (percent >= NEAR_LIMIT) return 'near';
  if (percent > pacingTick(currentDay, totalDays)) return 'ahead';
  return 'calm';
}

/** The colour of a row's bar. Coral when it is near or past its limit. */
export function pacingColor(row, tone) {
  if (tone === 'over' || tone === 'near') return PACING_COLORS.warning;
  return row.color || PACING_COLORS[row.id] || PACING_COLORS.needs;
}

/**
 * Where the lit pill sits under the chosen word.
 *
 * Given where each pill is, the answer is the left edge and the
 * width of the chosen one. Nothing chosen is nothing lit.
 */
export function indicatorFor(boxes, activeId) {
  const box = (boxes || []).find((entry) => entry.id === activeId);
  if (!box) return { x: 0, width: 0, visible: false };
  return { x: box.left, width: box.width, visible: true };
}
