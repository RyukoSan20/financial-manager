/**
 * The four boxes of the Eisenhower board.
 *
 * A goal is important, or it is not. It is urgent, or it is not.
 * That makes four boxes, and the board shows all four so a goal can
 * be seen next to the ones it competes with.
 *
 * This component only draws the board. It does not decide where a
 * goal lives, and it does not save anything: it is handed a list of
 * goals and it is told which goal went where. The page that owns the
 * goals decides what to do about it.
 *
 * The labels are read from the language files through the i18n hook,
 * so the board reads in the language the reader picked.
 */
import { useMemo, useState } from 'react';
import { useTranslation } from '../../i18n';
import { QUADRANTS, groupGoalsByQuadrant, quadrantForGoal } from '../../utils/eisenhowerPriority';

function GoalCard({ goal, quadrantKey, onMove, onDragStart, t, labels }) {
  const handleDragStart = (event) => {
    event.dataTransfer.effectAllowed = 'move';
    // Firefox will not start a drag without something to carry.
    event.dataTransfer.setData('text/plain', String(goal.id));
    onDragStart?.(goal.id);
  };

  // A goal can also be moved without a mouse, by picking the box it
  // belongs in from a list. Dragging is a nice way to do it, but it
  // is not the only way.
  const targetKey = goal.quadrant && labels[goal.quadrant] ? goal.quadrant : quadrantKey;

  return (
    <li
      draggable
      onDragStart={handleDragStart}
      className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-800"
    >
      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{goal.name}</p>

      <label className="mt-2 block text-xs text-gray-500 dark:text-gray-400" htmlFor={`goal-quadrant-${goal.id}`}>
        {t('goals.priority')}
      </label>
      <select
        id={`goal-quadrant-${goal.id}`}
        value={targetKey}
        onChange={(event) => onMove?.(goal.id, event.target.value)}
        className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
      >
        {QUADRANTS.map((quadrant) => (
          <option key={quadrant.key} value={quadrant.key}>
            {labels[quadrant.key]}
          </option>
        ))}
      </select>
    </li>
  );
}

export default function GoalPriorityKanban({ goals = [], onMove, className = '' }) {
  const { t } = useTranslation();
  const [overKey, setOverKey] = useState(null);
  const [draggingId, setDraggingId] = useState(null);

  // The title of each box, in the language the reader picked.
  const labels = useMemo(() => {
    const map = {};
    for (const quadrant of QUADRANTS) {
      map[quadrant.key] = t(quadrant.labelKey);
    }
    return map;
  }, [t]);

  const grouped = useMemo(() => groupGoalsByQuadrant(goals), [goals]);

  const handleDrop = (event, quadrantKey) => {
    event.preventDefault();
    setOverKey(null);

    const raw = event.dataTransfer?.getData('text/plain');
    const goalId = raw !== undefined && raw !== null && raw !== '' ? Number(raw) : draggingId;
    setDraggingId(null);

    if (goalId === null || goalId === undefined || Number.isNaN(goalId)) return;
    if (!onMove) return;

    onMove(goalId, quadrantKey);
  };

  return (
    <section className={`space-y-3 ${className}`}>
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('goals.priority_board_title')}</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('goals.priority_board_hint')}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {QUADRANTS.map((quadrant) => {
          const items = grouped[quadrant.key] || [];

          return (
            <div
              key={quadrant.key}
              data-quadrant={quadrant.key}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
                setOverKey(quadrant.key);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setOverKey(null);
              }}
              onDrop={(event) => handleDrop(event, quadrant.key)}
              className={`rounded-xl border p-3 transition-colors ${
                overKey === quadrant.key
                  ? 'border-emerald-400 bg-emerald-50 dark:border-emerald-500 dark:bg-emerald-950/40'
                  : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50'
              }`}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                  {labels[quadrant.key]}
                </h3>
                <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                  {t('goals.quadrant_count').replace('%s', String(items.length))}
                </span>
              </div>

              {items.length === 0 ? (
                <p className="px-1 py-3 text-xs text-gray-500 dark:text-gray-400">{t('goals.priority_board_empty')}</p>
              ) : (
                <ul className="space-y-2">
                  {items.map((goal) => (
                    <GoalCard
                      key={goal.id}
                      goal={goal}
                      quadrantKey={quadrant.key}
                      onMove={onMove}
                      onDragStart={setDraggingId}
                      t={t}
                      labels={labels}
                    />
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export { GoalPriorityKanban, quadrantForGoal };
