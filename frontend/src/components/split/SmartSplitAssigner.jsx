/**
 * The assigner: who had what.
 *
 * A shared bill can be filled in two ways. Tapping a plate, one line
 * at a time, is slow when there are eight people and nine dishes.
 * This is the other way: every line gets a row, and every row has a
 * list of the people at the table to pick from.
 *
 * The reader picks the way the bill is split before they pick who had
 * what:
 *
 *   - equally, where everybody pays the same whatever they ate;
 *   - by the lines, where the dish decides, and the tax and the
 *     discount of the receipt are shared in the same proportion as
 *     the lines they were charged on.
 *
 * The numbers are worked out in `splitAssignmentMath.js`, which is
 * pure and is tested on its own. This file draws them and collects
 * what the reader chose; it does not do arithmetic of its own.
 *
 * The words come from the split batch of the language files, so that
 * this panel says the same thing as the rest of the bill.
 */

import { useCallback, useMemo, useState } from 'react';
import { computeShares } from './splitAssignmentMath';
import { batch9 } from '../../i18n/keys_batch9';

/**
 * A number of money, in the way the reader writes it.
 */
export function rupiah(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return 'Rp 0';
  return `Rp ${Math.round(amount).toLocaleString('id-ID')}`;
}

/**
 * The lines of the receipt, in the shape the arithmetic reads.
 *
 * A discount line is not a dish, so it is not a line anybody can be
 * given. The reader sees it in the totals, not in the list of lines
 * to hand out.
 */
export function toLines(items) {
  return (items || [])
    .filter((item) => (item.kind || 'item') === 'item')
    .map((item) => ({
      id: item.id,
      name: item.name,
      quantity: Number(item.quantity || 1),
      unitPrice: Number(item.unit_price || 0),
      subtotal: Number(item.total_price || 0),
      tax: 0,
      discount: 0,
    }));
}

/**
 * The panel.
 *
 * `expense` is the receipt as the server has it. `members` are the
 * people at the table. `onAssign` is called with the map of who had
 * which line, and the server works the bill out again.
 */
export default function SmartSplitAssigner({
  expense,
  members = [],
  language = 'id',
  onAssign,
  onModeChange,
  saving = false,
}) {
  const K = batch9[language]?.split || batch9.id.split;

  const [mode, setMode] = useState(
    expense?.split_mode === 'EQUAL' ? 'equal' : 'dynamic',
  );
  const [assignments, setAssignments] = useState({});

  const lines = useMemo(() => toLines(expense?.items), [expense]);

  // The tax and the discount of the receipt, which are shared in the
  // same proportion as the lines they were charged on.
  const tax = Number(expense?.tax || 0);
  const discount = Number(expense?.discount || 0);

  const result = useMemo(
    () =>
      computeShares({
        items: lines,
        members: members.map((member) => ({
          id: member.id,
          name: member.display_name || member.name || '',
        })),
        assignments,
        mode,
        tax: tax > 0 ? tax : undefined,
        discount: discount > 0 ? discount : undefined,
      }),
    [lines, members, assignments, mode, tax, discount],
  );

  /**
   * The person for a line, changed.
   *
   * A line with nobody on it is written as an empty string, so that
   * "no person" and "person number zero" are not the same thing.
   */
  const choose = useCallback((itemId, memberId) => {
    setAssignments((current) => {
      const next = { ...current };
      if (memberId === '' || memberId === null || memberId === undefined) {
        delete next[String(itemId)];
      } else {
        next[String(itemId)] = memberId;
      }
      return next;
    });
  }, []);

  /**
   * Everybody gets the same, and the lines are cleared.
   */
  const chooseEqual = useCallback(() => {
    setMode('equal');
    setAssignments({});
    if (onModeChange) onModeChange('EQUAL');
  }, [onModeChange]);

  const chooseDynamic = useCallback(() => {
    setMode('dynamic');
    if (onModeChange) onModeChange('ITEMIZED');
  }, [onModeChange]);

  /**
   * Give the whole bill to one person.
   */
  const giveAllTo = useCallback(
    (memberId) => {
      setAssignments((current) => {
        const next = { ...current };
        for (const line of lines) next[String(line.id)] = memberId;
        return next;
      });
    },
    [lines],
  );

  /**
   * Say who had what.
   */
  const apply = useCallback(() => {
    if (!onAssign) return;
    onAssign({ ...assignments });
  }, [assignments, onAssign]);

  const shareOf = useCallback(
    (memberId) => {
      const share = result.shares.find(
        (row) => String(row.memberId) === String(memberId),
      );
      return share ? share.total : 0;
    },
    [result],
  );

  if (!lines.length) {
    return (
      <div className="split-assigner split-assigner--empty">
        <p>{K.assigner_nothing_to_assign}</p>
      </div>
    );
  }

  return (
    <section className="split-assigner" aria-label={K.assigner_hint}>
      {/* The way the bill is split. */}
      <div className="split-assigner__modes" role="group">
        <button
          type="button"
          className={
            mode === 'equal'
              ? 'split-assigner__mode split-assigner__mode--on'
              : 'split-assigner__mode'
          }
          onClick={chooseEqual}
          aria-pressed={mode === 'equal'}
        >
          {K.assigner_equal}
        </button>
        <button
          type="button"
          className={
            mode === 'dynamic'
              ? 'split-assigner__mode split-assigner__mode--on'
              : 'split-assigner__mode'
          }
          onClick={chooseDynamic}
          aria-pressed={mode === 'dynamic'}
        >
          {K.assigner_dynamic}
        </button>
      </div>
      <p className="split-assigner__hint">
        {mode === 'equal' ? K.assigner_equal_hint : K.assigner_dynamic_hint}
      </p>

      {mode === 'dynamic' && (
        <>
          {/* The lines, and the person for each of them. */}
          <ul className="split-assigner__lines">
            {lines.map((line) => (
              <li key={line.id} className="split-assigner__line">
                <span className="split-assigner__line-name" title={line.name}>
                  {line.name}
                  {Number(line.quantity || 1) > 1 && (
                    <span className="split-assigner__line-qty">x{line.quantity}</span>
                  )}
                </span>
                <span className="split-assigner__line-price">
                  {rupiah(line.subtotal)}
                </span>
                <select
                  className="split-assigner__line-person"
                  value={assignments[String(line.id)] ?? ''}
                  onChange={(event) => choose(line.id, event.target.value)}
                  aria-label={`${K.assigner_for_person} ${line.name}`}
                >
                  <option value="">{K.assigner_unassigned}</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.display_name || member.name || `#${member.id}`}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>

          {/* The short way: give every line to one person. */}
          <div className="split-assigner__quick">
            {members.map((member) => (
              <button
                key={member.id}
                type="button"
                className="split-assigner__quick-button"
                onClick={() => giveAllTo(member.id)}
              >
                {member.display_name || member.name || `#${member.id}`}
              </button>
            ))}
          </div>
        </>
      )}

      {/* What everybody owes. */}
      <div className="split-assigner__shares">
        <div className="split-assigner__totals">
          <span>{K.subtotal}</span>
          <strong>{rupiah(result.bill.subtotal)}</strong>
          {result.bill.tax > 0 && (
            <>
              <span>{K.tax}</span>
              <strong>{rupiah(result.bill.tax)}</strong>
            </>
          )}
          {result.bill.discount > 0 && (
            <>
              <span>{K.discount}</span>
              <strong>-{rupiah(result.bill.discount)}</strong>
            </>
          )}
          <span>{K.assigner_total}</span>
          <strong>{rupiah(result.total)}</strong>
        </div>

        <ul className="split-assigner__people">
          {members.map((member) => (
            <li key={member.id} className="split-assigner__person">
              <span>{member.display_name || member.name || `#${member.id}`}</span>
              <strong>{rupiah(shareOf(member.id))}</strong>
            </li>
          ))}
        </ul>

        {result.unassigned.count > 0 && (
          <p className="split-assigner__unassigned">
            {K.assigner_unassigned_hint} ({result.unassigned.count})
          </p>
        )}
      </div>

      {mode === 'dynamic' && (
        <button
          type="button"
          className="split-assigner__apply"
          onClick={apply}
          disabled={saving}
        >
          {K.assign_save}
        </button>
      )}
    </section>
  );
}

export { SmartSplitAssigner };
