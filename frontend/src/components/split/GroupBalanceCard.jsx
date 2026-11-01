/**
 * Who owes what, in a group.
 *
 * The card shows the two sides of the group: the people who are owed
 * money and the people who owe it. Underneath, when the debts can be
 * settled with fewer payments than there are debts, the plan for
 * those fewer payments is shown.
 *
 * The plan is the useful part. A group of five people who owe each
 * other in a circle can be settled with two transfers instead of
 * five, and two transfers is two things to do instead of five.
 */

import { useMemo } from 'react';
import { batch9 } from '../../i18n/keys_batch9';

export default function GroupBalanceCard({
  balances = [],
  plan = [],
  members = [],
  language = 'id',
  money = (value) => String(value),
  onSettle = null,
  simplify = false,
  onToggleSimplify = null,
}) {
  const K = batch9[language]?.split || batch9.id.split;

  const byId = useMemo(() => {
    const map = {};
    for (const member of members) map[member.id] = member;
    return map;
  }, [members]);

  const creditors = useMemo(
    () =>
      balances
        .filter((row) => Number(row.net_position) > 0)
        .sort((a, b) => Number(b.net_position) - Number(a.net_position)),
    [balances],
  );

  const debtors = useMemo(
    () =>
      balances
        .filter((row) => Number(row.net_position) < 0)
        .sort((a, b) => Number(a.net_position) - Number(b.net_position)),
    [balances],
  );

  const settled = balances.every((row) => Number(row.net_position) === 0);

  return (
    <div className="split-balance-card">
      <div className="split-balance-card__header">
        <h3>{K.balances}</h3>
        {onToggleSimplify && (
          <label className="split-balance-card__simplify">
            <input
              type="checkbox"
              checked={Boolean(simplify)}
              onChange={(event) => onToggleSimplify(event.target.checked)}
            />
            <span>{K.simplify_debts}</span>
          </label>
        )}
      </div>

      {onToggleSimplify && (
        <p className="split-balance-card__hint">{K.simplify_debts_hint}</p>
      )}

      {settled && (
        <p className="split-balance-card__even">{K.no_settlement_needed}</p>
      )}

      {!settled && (
        <>
          <div className="split-balance-card__columns">
            <div className="split-balance-card__column">
              <h4>{K.owed_to_you}</h4>
              <ul>
                {creditors.map((row) => (
                  <li key={`c-${row.member_id}`}>
                    <span className="split-balance-card__name">
                      {row.display_name ||
                        (byId[row.member_id] || {}).display_name ||
                        ''}
                    </span>
                    <span className="split-balance-card__amount">
                      {money(row.net_position)}
                    </span>
                  </li>
                ))}
                {creditors.length === 0 && <li className="is-empty">-</li>}
              </ul>
            </div>

            <div className="split-balance-card__column">
              <h4>{K.you_owe}</h4>
              <ul>
                {debtors.map((row) => (
                  <li key={`d-${row.member_id}`}>
                    <span className="split-balance-card__name">
                      {row.display_name ||
                        (byId[row.member_id] || {}).display_name ||
                        ''}
                    </span>
                    <span className="split-balance-card__amount">
                      {money(Math.abs(Number(row.net_position)))}
                    </span>
                  </li>
                ))}
                {debtors.length === 0 && <li className="is-empty">-</li>}
              </ul>
            </div>
          </div>

          {simplify && (
            <div className="split-balance-card__plan">
              <h4>{K.settlement_plan}</h4>
              <p className="split-balance-card__hint">{K.settlement_plan_hint}</p>
              {plan.length === 0 ? (
                <p className="split-balance-card__even">{K.no_settlement_needed}</p>
              ) : (
                <ul>
                  {plan.map((step, index) => (
                    <li key={`${step.from_member}-${step.to_member}-${index}`}>
                      <span className="split-balance-card__step">
                        <strong>{step.from_member}</strong>
                        <span className="split-balance-card__arrow">&rarr;</span>
                        <strong>{step.to_member}</strong>
                      </span>
                      <span className="split-balance-card__amount">
                        {money(step.amount)}
                      </span>
                      {onSettle && (
                        <button
                          type="button"
                          className="split-balance-card__settle"
                          onClick={() => onSettle(step)}
                        >
                          {K.settle_up}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
