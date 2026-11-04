/**
 * Where a goal sits on the Eisenhower board.
 *
 * Four boxes, two questions: is it important, and is it urgent?
 *
 * - important and urgent: do it now;
 * - important and not urgent: plan it;
 * - not important and urgent: delegate it, or do it quickly;
 * - neither: drop it.
 *
 * The mapping is kept here, away from the screen, so it can be
 * checked on its own. Nothing in this file reads the clock or the
 * network: the same goal always lands in the same box.
 *
 * A goal carries its own answer when it has one. The fields read are
 * `important` and `urgent` (or `is_important` and `is_urgent`), and
 * a goal that has already been placed by hand carries `quadrant`.
 * When a goal does not say, `priority` is used: `high` means it
 * matters, and the rest do not.
 */

export const QUADRANT_KEYS = [
  'important_urgent',
  'not_important_urgent',
  'important_not_urgent',
  'not_important_not_urgent',
];

/**
 * The four boxes, in the order they are drawn on the board.
 *
 * `labelKey` is the i18n key of the title of the box. The text of
 * that title lives in the language files, not here, so a goal board
 * reads in the language the reader picked.
 */
export const QUADRANTS = [
  {
    key: 'important_urgent',
    labelKey: 'goals.quadrant_important_urgent',
    important: true,
    urgent: true,
  },
  {
    key: 'not_important_urgent',
    labelKey: 'goals.quadrant_not_important_urgent',
    important: false,
    urgent: true,
  },
  {
    key: 'important_not_urgent',
    labelKey: 'goals.quadrant_important_not_urgent',
    important: true,
    urgent: false,
  },
  {
    key: 'not_important_not_urgent',
    labelKey: 'goals.quadrant_not_important_not_urgent',
    important: false,
    urgent: false,
  },
];

const PRIORITY_IMPORTANT = ['high', 'urgent', 'important'];
const URGENCY_VALUES = {
  urgent: true,
  now: true,
  immediate: true,
  soon: true,
  normal: false,
  later: false,
  not_urgent: false,
  never: false,
};

function truthyOrNull(value) {
  if (value === true || value === 1 || value === 'true' || value === 'yes') return true;
  if (value === false || value === 0 || value === 'false' || value === 'no') return false;
  return null;
}

/**
 * Is this goal important?
 *
 * The goal says so when it can. Otherwise the priority is read:
 * only a high priority goal is an important one.
 */
export function isImportant(goal) {
  if (!goal || typeof goal !== 'object') return false;

  const explicit = truthyOrNull(goal.important ?? goal.is_important);
  if (explicit !== null) return explicit;

  const priority = String(goal.priority ?? '').toLowerCase();
  if (priority) return PRIORITY_IMPORTANT.includes(priority);

  return false;
}

/**
 * Is this goal urgent?
 *
 * The goal says so when it can. Otherwise the urgency is read from
 * the `urgency` field. A goal that says nothing about it is not
 * urgent, because an empty field is not a deadline.
 */
export function isUrgent(goal) {
  if (!goal || typeof goal !== 'object') return false;

  const explicit = truthyOrNull(goal.urgent ?? goal.is_urgent);
  if (explicit !== null) return explicit;

  const urgency = String(goal.urgency ?? '').toLowerCase();
  if (urgency && urgency in URGENCY_VALUES) return URGENCY_VALUES[urgency];

  return false;
}

/**
 * The box a goal belongs in.
 *
 * A goal that has already been placed by hand keeps that place. Every
 * other goal is worked out from whether it is important and whether it
 * is urgent. A goal that is neither lands in the last box.
 */
export function quadrantForGoal(goal) {
  if (!goal || typeof goal !== 'object') return 'not_important_not_urgent';

  const placed = String(goal.quadrant ?? '');
  if (QUADRANT_KEYS.includes(placed)) return placed;

  const important = isImportant(goal);
  const urgent = isUrgent(goal);

  if (important && urgent) return 'important_urgent';
  if (!important && urgent) return 'not_important_urgent';
  if (important && !urgent) return 'important_not_urgent';
  return 'not_important_not_urgent';
}

/**
 * Every goal, sorted into the four boxes.
 *
 * The answer always has all four keys, even when a box is empty, so
 * a board can be drawn without checking whether a box has anything
 * in it.
 */
export function groupGoalsByQuadrant(goals) {
  const grouped = {};
  for (const quadrant of QUADRANTS) {
    grouped[quadrant.key] = [];
  }

  if (!Array.isArray(goals)) return grouped;

  for (const goal of goals) {
    if (!goal || typeof goal !== 'object') continue;
    grouped[quadrantForGoal(goal)].push(goal);
  }

  return grouped;
}

/**
 * The goals of one box.
 */
export function goalsInQuadrant(goals, quadrantKey) {
  const grouped = groupGoalsByQuadrant(goals);
  return grouped[quadrantKey] || [];
}

/**
 * The box a set of important/urgent flags belongs in.
 */
export function quadrantForFlags(important, urgent) {
  if (important && urgent) return 'important_urgent';
  if (!important && urgent) return 'not_important_urgent';
  if (important && !urgent) return 'important_not_urgent';
  return 'not_important_not_urgent';
}

export default QUADRANTS;
