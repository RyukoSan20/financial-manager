/**
 * The receipt, and the plates on it.
 *
 * This is the screen the friends at the table are looking at. They
 * tap what they ordered, and their share changes under their finger.
 *
 * The board shows three things about a line at once:
 *
 * - what it is, and what it costs;
 * - who has claimed it, so nobody claims the same steak twice;
 * - how much of it is left, because a line of two coffees is two
 *   coffees and not one thing that can be taken twice.
 *
 * A line that has been claimed completely is dimmed but stays
 * readable. It is not removed: the receipt still has to add up, and
 * a line that vanished would make the total wrong.
 */

import { useMemo } from 'react';
import { batch9 } from '../../i18n/keys_batch9';

const AVATAR_COLORS = [
  '#6366f1',
  '#ec4899',
  '#14b8a6',
  '#f59e0b',
  '#8b5cf6',
  '#ef4444',
  '#06b6d4',
  '#84cc16',
];

function colorFor(id) {
  return AVATAR_COLORS[Math.abs(Number(id) || 0) % AVATAR_COLORS.length];
}

function initialsFor(name) {
  const text = String(name || '').trim();
  if (!text) return '?';
  const parts = text.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function LiveClaimBoard({
  items = [],
  members = [],
  currentMemberId = null,
  onClaim,
  onRelease,
  language = 'id',
  money = (value) => String(value),
  disabled = false,
  flaggedItemIds = [],
}) {
  const K = batch9[language]?.split || batch9.id.split;

  const byId = useMemo(() => {
    const map = {};
    for (const member of members) map[member.id] = member;
    return map;
  }, [members]);

  // The lines that have to be looked at, because the receipt does not
  // add up to itself. They are marked, so that the reader is shown
  // where the problem is rather than having to find it.
  const flagged = useMemo(() => new Set(flaggedItemIds || []), [flaggedItemIds]);

  /**
   * How much of each line is claimed, and by whom.
   *
   * The remaining amount is what is left for somebody else to take.
   */
  const lines = useMemo(() => {
    return items.map((item) => {
      const total = Number(item.quantity || 0);
      const claimed = (item.claims || []).reduce((sum, claim) => {
        return sum + Number(claim.quantity || 0);
      }, 0);
      const remaining = Math.max(0, total - claimed);
      const mine = (item.claims || []).find(
        (claim) => Number(claim.member_id) === Number(currentMemberId),
      );
      return { item, total, claimed, remaining, mine };
    });
  }, [items, currentMemberId]);

  return (
    <div className="split-claim-board">
      <div className="split-claim-board__header">
        <h3>{K.claim_your_items}</h3>
        <p>{K.claim_your_items_hint}</p>
      </div>

      {lines.length === 0 && (
        <p className="split-claim-board__empty">{K.no_receipts_hint}</p>
      )}

      <ul className="split-claim-board__items">
        {lines.map(({ item, total, remaining, mine }) => {
          const isMine = Boolean(mine);
          const isGone = remaining <= 0 && !isMine;

          return (
            <li
              key={item.id}
              className={[
                'split-claim-item',
                isMine ? 'split-claim-item--mine' : '',
                isGone ? 'split-claim-item--taken' : '',
                flagged.has(item.id) ? 'split-claim-item--flagged' : '',
              ].join(' ').trim()}
            >
              <button
                type="button"
                className="split-claim-item__button"
                disabled={disabled || (isGone && !isMine)}
                onClick={() => {
                  if (isMine) {
                    if (onRelease) onRelease(item);
                  } else if (onClaim) {
                    onClaim(item);
                  }
                }}
                aria-pressed={isMine}
              >
                <span className="split-claim-item__name">{item.name}</span>
                {flagged.has(item.id) && (
                  <span className="split-claim-item__flag">{K.check_this_line}</span>
                )}
                <span className="split-claim-item__price">
                  {money(item.total_price)}
                </span>
                <span className="split-claim-item__meta">
                  {Number(item.quantity) > 1
                    ? `${item.quantity} x ${money(item.unit_price)}`
                    : money(item.unit_price)}
                </span>

                {isMine && (
                  <span className="split-claim-item__you">
                    {K.claimed_by} {K.you}
                  </span>
                )}

                {isGone && !isMine && (
                  <span className="split-claim-item__taken">
                    {K.claimed_by}:{' '}
                    {(item.claims || [])
                      .map((claim) => {
                        const member = byId[claim.member_id];
                        return member ? member.display_name : '';
                      })
                      .filter(Boolean)
                      .join(', ')}
                  </span>
                )}
              </button>

              {isGone && !isMine && (
                <div className="split-claim-item__faces">
                  {(item.claims || []).map((claim) => {
                    const member = byId[claim.member_id];
                    const color = colorFor(claim.member_id);
                    return (
                      <span
                        key={`${item.id}-${claim.member_id}`}
                        className="split-claim-face"
                        style={{ backgroundColor: color }}
                        title={member ? member.display_name : ''}
                      >
                        {initialsFor(member ? member.display_name : '')}
                      </span>
                    );
                  })}
                </div>
              )}

              {!isGone && Number(item.quantity) > 1 && (
                <div className="split-claim-item__faces">
                  {(item.claims || []).map((claim) => {
                    const member = byId[claim.member_id];
                    const color = colorFor(claim.member_id);
                    return (
                      <span
                        key={`${item.id}-${claim.member_id}`}
                        className="split-claim-face"
                        style={{ backgroundColor: color }}
                        title={member ? member.display_name : ''}
                      >
                        {initialsFor(member ? member.display_name : '')}
                      </span>
                    );
                  })}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export { colorFor, initialsFor };
