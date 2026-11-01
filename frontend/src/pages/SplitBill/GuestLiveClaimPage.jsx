/**
 * The page a friend opens from a link.
 *
 * This is the one page in the application that asks for no account,
 * installs nothing, and works on the browser that is already in the
 * phone. Somebody at a table taps the link that was sent to them in
 * a chat window and they are in.
 *
 * The screen has three steps:
 *
 * 1. Give a name. That is all that is asked. No password, no
 *    e-mail, no "create an account".
 * 2. Tap what you ordered. The share changes under the finger.
 * 3. See what you owe.
 *
 * The pass that lets them claim is kept in the browser, so that a
 * guest who closes the tab to look at the receipt comes back to the
 * same seat at the table rather than a second one.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useI18n } from '../../i18n';
import { batch9 } from '../../i18n/keys_batch9';
import LiveClaimBoard from '../../components/split/LiveClaimBoard';
import {
  readClaimToken,
  writeClaimToken,
} from '../../hooks/useLiveReceiptClaim';
import useLiveBoard from '../../hooks/useLiveBoard';
import {
  peekGroup,
  joinGroup,
  listGuestExpenses,
  getLiveReceipt,
  claimItem,
  releaseItem,
} from '../../services/splitApi';

export default function GuestLiveClaimPage() {
  const { code } = useParams();
  const { language } = useI18n();
  const K = batch9[language]?.split || batch9.id.split;

  const [group, setGroup] = useState(null);
  const [name, setName] = useState('');
  const [token, setToken] = useState(null);
  const [memberId, setMemberId] = useState(null);
  const [expenseId, setExpenseId] = useState(null);
  const [error, setError] = useState(null);
  const [joining, setJoining] = useState(false);

  // The pass this browser already has for this group, if it has one.
  useEffect(() => {
    if (!code) return;
    const stored = readClaimToken(code);
    if (stored) setToken(stored);
  }, [code]);

  // What the link points at.
  useEffect(() => {
    if (!code) return;
    let alive = true;
    peekGroup(code)
      .then((data) => {
        if (alive) setGroup(data);
      })
      .catch((err) => {
        if (alive) setError(err);
      });
    return () => {
      alive = false;
    };
  }, [code]);

  const join = useCallback(
    async (event) => {
      event.preventDefault();
      const trimmed = name.trim();
      if (!trimmed) return;

      setJoining(true);
      setError(null);
      try {
        const joined = await joinGroup(code, trimmed);
        writeClaimToken(code, joined.claim_token);
        setToken(joined.claim_token);
        setMemberId(joined.member_id);
      } catch (err) {
        setError(err);
      } finally {
        setJoining(false);
      }
    },
    [code, name],
  );

  // The receipt, as it changes. The reader is asked again and again
  // rather than holding a connection open, because a restaurant
  // network is not a good place to hold a connection.
  // The receipt the guest is claiming. It is asked for once the
  // guest has a pass, and it is the one the group has not published
  // yet - the one people are still claiming.
  useEffect(() => {
    if (!token || !code) return;
    let alive = true;
    listGuestExpenses(code, token)
      .then((data) => {
        if (!alive) return;
        if (data && data.expense_id) setExpenseId(data.expense_id);
      })
      .catch(() => {
        // The guest cannot see the receipts. The screen says so by
        // staying empty rather than by showing an error about
        // something the host has not done yet.
      });
    return () => {
      alive = false;
    };
  }, [token, code]);

  const fetcher = useCallback(async () => {
    if (!token || !expenseId) return null;
    return getLiveReceipt(expenseId, token);
  }, [token, expenseId]);

  const {
    data: receipt,
    isStale,
    error: liveError,
  } = useLiveBoard(fetcher, {
    kind: 'guest',
    id: code,
    token,
    enabled: Boolean(token && expenseId),
  });

  /**
   * The receipt to show.
   *
   * Until the live one arrives, the one that was fetched once is
   * shown, so the screen is never empty while it waits.
   */
  const shown = receipt;

  const share = useMemo(() => {
    if (!shown || !shown.shares || shown.shares.length === 0) return null;
    return shown.shares[0];
  }, [shown]);

  const members = useMemo(() => {
    if (!group) return [];
    return (group.members || []).map((member) => ({
      id: member.id,
      display_name: member.display_name,
      avatar_color: member.avatar_color,
      is_host: member.is_host,
    }));
  }, [group]);

  const claim = useCallback(
    async (item) => {
      if (!token || !expenseId) return;
      try {
        await claimItem(expenseId, token, item.id, 1);
      } catch (err) {
        setError(err);
      }
    },
    [token, expenseId],
  );

  const release = useCallback(
    async (item) => {
      if (!token || !expenseId) return;
      try {
        await releaseItem(expenseId, token, item.id);
      } catch (err) {
        setError(err);
      }
    },
    [token, expenseId],
  );

  if (!group && !error) {
    return <div className="split-guest">{K.live}</div>;
  }

  if (error && !group) {
    return (
      <div className="split-guest split-guest--error">
        <p>{error.message || String(error)}</p>
      </div>
    );
  }

  // Before the guest has a name, they are asked for one. That is the
  // whole of it.
  if (!token) {
    return (
      <div className="split-guest">
        <div className="split-guest__panel">
          <h1>{group.group_name}</h1>
          <p>{K.claim_your_items_hint}</p>

          <form onSubmit={join}>
            <label htmlFor="split-guest-name">{K.your_name}</label>
            <input
              id="split-guest-name"
              type="text"
              value={name}
              maxLength={60}
              placeholder={K.your_name_placeholder}
              onChange={(event) => setName(event.target.value)}
            />
            <button type="submit" disabled={joining || !name.trim()}>
              {K.join}
            </button>
          </form>

          <p className="split-guest__hint">{K.join_hint}</p>
          {error && <p className="split-guest__error">{error.message || String(error)}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="split-guest">
      <div className="split-guest__panel">
        <header className="split-guest__header">
          <h1>{group.group_name}</h1>
          <span className="split-guest__live">{K.live}</span>
        </header>

        {isStale && (
          <p className="split-guest__stale">{K.waiting_for_others}</p>
        )}

        {shown && shown.items && shown.items.length > 0 && (
          <LiveClaimBoard
            items={shown.items}
            members={members}
            currentMemberId={memberId}
            onClaim={claim}
            onRelease={release}
            language={language}
            money={(value) => String(value)}
          />
        )}

        {share && (
          <div className="split-guest__share">
            <span>{K.your_share}</span>
            <strong>{share.final_amount}</strong>
          </div>
        )}

        {liveError && (
          <p className="split-guest__error">{liveError.message || String(liveError)}</p>
        )}
        {error && <p className="split-guest__error">{error.message || String(error)}</p>}
      </div>
    </div>
  );
}
