/**
 * One group: the people in it, the receipts they shared, and what
 * everybody owes.
 *
 * The host's screen. It has the receipt board in the middle, so that
 * the host can see what has been claimed and claim things for people
 * who are not using the link.
 *
 * The share link is at the top, because it is the thing the host
 * needs most: one link, sent to everybody at the table.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useI18n } from '../../i18n';
import { batch9 } from '../../i18n/keys_batch9';
import { PageHeader } from '../../components/ui/PageHeader';
import LiveClaimBoard from '../../components/split/LiveClaimBoard';
import GroupBalanceCard from '../../components/split/GroupBalanceCard';
import SplitMethodSelector from '../../components/split/SplitMethodSelector';
import SettleUpModal from '../../components/split/SettleUpModal';
import { inviteLink } from '../../hooks/useLiveReceiptClaim';
import InviteQr from '../../components/split/InviteQr';
import useLiveBoard from '../../hooks/useLiveBoard';
import {
  hasDiscrepancy,
  discrepancySize,
  linesToCheck,
} from '../../components/split/splitMath';
import {
  getGroup,
  listExpenses,
  getBalances,
  getSettlementPlan,
  claimForMember,
  publishExpense,
  createSettlement,
} from '../../services/splitApi';

export default function SplitGroupDetailPage() {
  const { groupId } = useParams();
  const { language } = useI18n();
  const K = batch9[language]?.split || batch9.id.split;

  const [group, setGroup] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [balances, setBalances] = useState([]);
  const [plan, setPlan] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [simplify, setSimplify] = useState(false);
  const [settling, setSettling] = useState(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const [theGroup, theExpenses, theBalances] = await Promise.all([
        getGroup(groupId),
        listExpenses(groupId),
        getBalances(groupId),
      ]);
      setGroup(theGroup);
      setExpenses(theExpenses);
      setBalances(theBalances);
      setActiveId((current) => {
        if (current && theExpenses.some((row) => row.id === current)) return current;
        return theExpenses.length ? theExpenses[0].id : null;
      });
    } catch (err) {
      setError(err);
    }
  }, [groupId]);

  // The board, live.
  //
  // When somebody at the table taps a plate, the host's screen
  // changes without the host pressing anything. Underneath the
  // stream there is the asking again after a while, so the screen is
  // still right when the connection cannot be kept open.
  useLiveBoard(load, {
    kind: 'host',
    id: groupId,
    enabled: Boolean(groupId),
  });

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!simplify) {
      setPlan([]);
      return;
    }
    getSettlementPlan(groupId)
      .then(setPlan)
      .catch(() => setPlan([]));
  }, [simplify, groupId, balances]);

  const active = useMemo(
    () => expenses.find((row) => row.id === activeId) || null,
    [expenses, activeId],
  );

  const members = group ? group.members || [] : [];

  // The gap between the lines of the receipt and its own subtotal.
  //
  // When there is one, the bill cannot be published: somebody would
  // end up paying for a line that was read wrong. The lines that
  // have to be looked at are worked out, so that the reader is shown
  // where to look rather than being left to find it.
  const gap = hasDiscrepancy(active ? active.discrepancy : null);
  const gapSize = discrepancySize(active ? active.discrepancy : null);
  const linesToFix = useMemo(
    () => (active ? linesToCheck(active.items || [], active.subtotal) : []),
    [active],
  );

  const link = useMemo(() => {
    if (!group) return '';
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return inviteLink(origin, group.invite_code);
  }, [group]);

  const copyLink = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // The browser would not let the page write to the clipboard.
    }
  };

  /**
   * The host saying who had what.
   */
  const claimFor = async (item, memberId) => {
    try {
      const updated = await claimForMember(active.id, {
        item_id: item.id,
        quantity: 1,
        member_id: memberId,
      });
      setExpenses((current) =>
        current.map((row) => (row.id === updated.id ? updated : row)),
      );
    } catch (err) {
      setError(err);
    }
  };

  const publish = async () => {
    if (!active) return;
    // The bill is not published while the lines do not add up. The
    // button is not even there, so there is nothing to press.
    if (hasDiscrepancy(active.discrepancy)) {
      setError(new Error(K.discrepancy_warning));
      return;
    }
    try {
      const updated = await publishExpense(active.id);
      setExpenses((current) =>
        current.map((row) => (row.id === updated.id ? updated : row)),
      );
      const rows = await getBalances(groupId);
      setBalances(rows);
    } catch (err) {
      setError(err);
    }
  };

  const settle = async (step) => {
    try {
      await createSettlement(groupId, {
        from_member_id: step.from_member_id,
        to_member_id: step.to_member_id,
        amount: step.amount,
      });
      setSettling(null);
      const rows = await getBalances(groupId);
      setBalances(rows);
    } catch (err) {
      setError(err);
    }
  };

  if (!group) {
    return <div className="split-group">{error ? error.message : K.title}</div>;
  }

  return (
    <div className="split-group">
      <PageHeader title={group.name} subtitle={K.subtitle} />

      <section className="split-group__link">
        <h3>{K.share_link}</h3>
        <p>{K.share_link_hint}</p>
        <div className="split-group__link-row">
          <code>{group.invite_code}</code>
          <button type="button" onClick={copyLink}>
            {copied ? K.link_copied : K.copy_link}
          </button>
        </div>
        <InviteQr
          link={link}
          title={K.qr_title}
          message={K.share_link_hint}
        />
      </section>

      <section className="split-group__members">
        <h3>{K.members}</h3>
        <ul>
          {members.map((member) => (
            <li key={member.id}>
              <span>{member.display_name}</span>
              {member.is_host && <span className="split-group__badge">{K.host}</span>}
              {member.user_id === null && (
                <span className="split-group__badge">{K.guest}</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="split-group__receipts">
        <h3>{K.receipts}</h3>
        {expenses.length === 0 && <p>{K.no_receipts_hint}</p>}

        {expenses.length > 0 && (
          <div className="split-group__receipt-tabs">
            {expenses.map((expense) => (
              <button
                key={expense.id}
                type="button"
                className={
                  expense.id === activeId
                    ? 'split-group__tab split-group__tab--chosen'
                    : 'split-group__tab'
                }
                onClick={() => setActiveId(expense.id)}
              >
                {expense.merchant_name || expense.name || K.receipts}
                <span>
                  {expense.status === 'PUBLISHED' ? K.published : K.draft}
                </span>
              </button>
            ))}
          </div>
        )}

        {active && (
          <div className="split-group__receipt">
            <div className="split-group__totals">
              <div>
                <span>{K.subtotal}</span>
                <strong>{active.subtotal}</strong>
              </div>
              <div>
                <span>{K.tax}</span>
                <strong>{active.tax}</strong>
              </div>
              <div>
                <span>{K.service_charge}</span>
                <strong>{active.service_charge}</strong>
              </div>
              <div>
                <span>{K.discount}</span>
                <strong>{active.discount}</strong>
              </div>
              <div className="split-group__total">
                <span>{K.grand_total}</span>
                <strong>{active.grand_total}</strong>
              </div>
            </div>

            {gap && (
              <div className="split-group__warning" role="alert">
                <p className="split-group__warning-text">
                  {K.discrepancy_value.replace('%s', gapSize)}
                </p>
                <p className="split-group__warning-hint">
                  {K.discrepancy_warning}
                </p>
              </div>
            )}

            <LiveClaimBoard
              items={active.items || []}
              members={members}
              currentMemberId={null}
              flaggedItemIds={linesToFix}
              onClaim={(item) => {
                // The host taps a plate and then says who had it.
                const next = members.find((member) => !member.is_host);
                if (next) claimFor(item, next.id);
              }}
              language={language}
            />

            <SplitMethodSelector
              mode={active.split_mode}
              members={members}
              total={Number(active.grand_total || 0)}
              language={language}
            />

            {active.status !== 'PUBLISHED' && (
              <div className="split-group__publish">
                {gap ? (
                  <p className="split-group__publish-blocked">
                    {K.discrepancy_blocked}
                  </p>
                ) : (
                  <>
                    <button type="button" onClick={publish}>
                      {K.publish}
                    </button>
                    <p>{K.publish_hint}</p>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      <GroupBalanceCard
        balances={balances}
        plan={plan}
        members={members}
        language={language}
        simplify={simplify}
        onToggleSimplify={setSimplify}
        onSettle={(step) => setSettling(step)}
      />

      <SettleUpModal
        open={Boolean(settling)}
        step={settling}
        language={language}
        onClose={() => setSettling(null)}
        onConfirm={settle}
      />

      {error && <p className="split-group__error">{error.message || String(error)}</p>}
    </div>
  );
}
