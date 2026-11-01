/**
 * The groups the reader is in.
 *
 * The list of shared bills, with what the reader is owed and what
 * they owe, across every group. The number at the top is the whole
 * of it: the money the friends owe them, less the money they owe
 * their friends.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../../i18n';
import { batch9 } from '../../i18n/keys_batch9';
import { PageHeader } from '../../components/ui/PageHeader';
import HonestEmptyState from '../../components/common/HonestEmptyState';
import { listGroups, getBalances, createGroup } from '../../services/splitApi';
import { useAuth } from '../../context/AuthContext';

export default function SplitDashboardPage() {
  const { language } = useI18n();
  const { user } = useAuth();
  const K = batch9[language]?.split || batch9.id.split;

  const readerId = user?.id ?? null;
  const [groups, setGroups] = useState([]);
  const [balances, setBalances] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    let alive = true;
    listGroups()
      .then(async (list) => {
        if (!alive) return;
        setGroups(list);
        setLoading(false);

        // The balances of every group, asked for one at a time so
        // that one slow group does not hold up the whole page.
        const collected = {};
        for (const group of list) {
          try {
            const rows = await getBalances(group.id);
            collected[group.id] = rows;
          } catch (err) {
            collected[group.id] = [];
          }
        }
        if (alive) setBalances(collected);
      })
      .catch((err) => {
        if (!alive) return;
        setError(err);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  /**
   * What the reader is owed, less what they owe.
   *
   * This is the number that matters across every group, and it is
   * the difference rather than the sum of the two, because a reader
   * who is owed fifty and owes thirty is owed twenty.
   */
  const net = useMemo(() => {
    let owed = 0;
    let owing = 0;

    // Only the reader's own line counts.
    //
    // A group's balances are the balances of everybody at the table.
    // The number at the top of this page is the reader's: what the
    // friends owe them, less what they owe their friends. Adding up
    // the whole table would count the friends' debts as the
    // reader's, and a reader who is owed nothing would be told they
    // owe the whole bill.
    for (const group of groups) {
      const rows = balances[group.id] || [];
      const mine = rows.filter((row) => {
        const member = (group.members || []).find(
          (one) => one.id === row.member_id
        );
        return member && member.user_id === readerId;
      });
      for (const row of mine) {
        const value = Number(row.net_position || 0);
        if (value > 0) owed += value;
        else owing += Math.abs(value);
      }
    }
    return { owed, owing, net: owed - owing };
  }, [balances, groups, readerId]);

  const create = async (event) => {
    event.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    try {
      const group = await createGroup({ name: trimmed });
      setGroups((current) => [...current, group]);
      setNewName('');
      setCreating(false);
    } catch (err) {
      setError(err);
    }
  };

  return (
    <div className="split-dashboard">
      <PageHeader
        title={K.title}
        subtitle={K.subtitle}
        action={
          <button type="button" onClick={() => setCreating((open) => !open)}>
            {K.create_group}
          </button>
        }
      />

      {creating && (
        <form className="split-dashboard__new" onSubmit={create}>
          <label htmlFor="split-new-group">{K.group_name}</label>
          <input
            id="split-new-group"
            type="text"
            value={newName}
            maxLength={100}
            placeholder={K.group_name_placeholder}
            onChange={(event) => setNewName(event.target.value)}
          />
          <button type="submit" disabled={!newName.trim()}>
            {K.create_group}
          </button>
        </form>
      )}

      {!loading && groups.length === 0 && (
        <HonestEmptyState
          title={K.no_groups}
          description={K.no_groups_hint}
        />
      )}

      {groups.length > 0 && (
        <div className="split-dashboard__summary">
          <div className="split-dashboard__figure">
            <span>{K.owed_to_you}</span>
            <strong>{net.owed}</strong>
          </div>
          <div className="split-dashboard__figure">
            <span>{K.you_owe}</span>
            <strong>{net.owing}</strong>
          </div>
          <div className="split-dashboard__figure">
            <span>{K.balances}</span>
            <strong>{net.net}</strong>
          </div>
        </div>
      )}

      <ul className="split-dashboard__groups">
        {groups.map((group) => (
          <li key={group.id}>
            <Link to={`/split/${group.id}`}>
              <span className="split-dashboard__group-name">{group.name}</span>
              <span className="split-dashboard__group-meta">
                {group.member_count} {K.members}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {error && <p className="split-dashboard__error">{error.message || String(error)}</p>}
    </div>
  );
}
