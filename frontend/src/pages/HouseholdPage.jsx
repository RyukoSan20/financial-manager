/**
 * The household page.
 *
 * A family, or two people who run a shop together, share a calendar,
 * chores, a shopping list, targets and notes here. The page is one
 * read of the household and a set of small writes; after each write
 * the household is read again, so the screen is what the database
 * holds and not what the page hoped it would hold.
 *
 * The numbers - how the month is going, what needs attention - are
 * the reader's own. Being in a household does not show anybody else
 * your accounts, and the page says so.
 *
 * `HouseholdView` draws; `HouseholdPage` loads and saves. They are
 * apart so the drawing can be checked without a server.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useTranslation } from '../i18n';
import { toast } from '../contexts/ToastContext';
import { emitDataMutated } from '../utils/dataSyncBus';
import { formatCurrency } from '../utils/format';
import { Modal } from '../components/ui/Modal';
import RiggedSvgMascot from '../components/mascot/RiggedSvgMascot';
import { BudggtPacingCard, BudggtQuickPills } from '../components/ui/BudggtTactileComponents';
import {
  AgendaTab,
  GoalsTab,
  NeedsTab,
  NotesTab,
  SummaryTab,
  TasksTab,
} from '../components/household/HouseholdTabs';
import {
  TABS,
  TAB_ICONS,
  errorKey,
  joinCodeFromSearch,
  monthLabel,
  pacingRows,
  pickAccount,
  roleKey,
  shortDate,
} from '../utils/household.js';

const PAY_ACCOUNT_KEY = 'household_pay_account';

const avatarUrl = (avatar) =>
  `${import.meta.env.BASE_URL}assets/generated/brand/${avatar || 'avatar-default'}.svg`;

const remembered = (key) => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const remember = (key, value) => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // A browser that will not keep it is not a reason to stop.
  }
};

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/* --- the invitation dialog ---------------------------------------------- */

function InviteDialog({ isOpen, onClose, mode, onInvite, onCopied }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ name: '', email: '', role: mode === 'business' ? 'partner' : 'member' });
  const [result, setResult] = useState(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setResult(null);
      setForm({ name: '', email: '', role: mode === 'business' ? 'partner' : 'member' });
    }
  }, [isOpen, mode]);

  const submit = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) return;
    setSending(true);
    const answer = await onInvite({
      name: form.name,
      email: form.email || null,
      role: form.role,
    });
    setSending(false);
    if (answer) setResult(answer);
  };

  const mailto = result && form.email
    ? `mailto:${encodeURIComponent(form.email)}?subject=${encodeURIComponent(t('household.invite_mail_subject'))}&body=${encodeURIComponent(result.message)}`
    : null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('household.invite_title')}>
      <div className="hh-light">
        {result ? (
          <div className="space-y-4">
            <p className="text-sm">{t('household.invite_ready', '', { name: result.member?.name || form.name })}</p>
            <p className="rounded-xl border p-3 text-xs break-all" style={{ borderColor: 'var(--hh-line)' }}>
              {result.invite_link}
            </p>
            <div className="flex flex-wrap gap-2">
              <a className="hh-button" href={result.whatsapp_link} target="_blank" rel="noopener noreferrer">
                {t('household.invite_whatsapp')}
              </a>
              {mailto ? (
                <a className="hh-button hh-button-ghost" href={mailto}>{t('household.invite_email')}</a>
              ) : null}
              <button type="button" className="hh-button hh-button-ghost"
                onClick={async () => { if (await copyText(result.invite_link)) onCopied(t('household.link_copied')); }}>
                {t('household.invite_copy_link')}
              </button>
            </div>
            <p className="text-xs hh-muted">{t('household.invite_note')}</p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold hh-muted">{t('household.invite_name_label')}</span>
              <input className="hh-field" value={form.name} maxLength={100} required autoFocus
                onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold hh-muted">{t('household.invite_email_label')}</span>
              <input type="email" className="hh-field" value={form.email} maxLength={255}
                onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold hh-muted">{t('household.invite_role_label')}</span>
              <select className="hh-field" value={form.role}
                onChange={(e) => setForm((v) => ({ ...v, role: e.target.value }))}>
                <option value="member">{t('household.role_member')}</option>
                <option value="partner">{t('household.role_partner')}</option>
              </select>
            </label>
            <button type="submit" className="hh-button" disabled={sending}>
              {t('household.invite_submit')}
            </button>
          </form>
        )}
      </div>
    </Modal>
  );
}

/* --- the drawing -------------------------------------------------------- */

export function HouseholdView({
  data,
  actions,
  busy = false,
  accounts = [],
  accountId = null,
  onAccountChange = () => {},
  myGoals = [],
  pendingJoin = '',
  onNavigate = () => {},
  mascotRef = null,
  initialTab = 'summary',
}) {
  const { t, language } = useTranslation();
  const [tab, setTab] = useState(TABS.includes(initialTab) ? initialTab : 'summary');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(data.name);
  const [joinCode, setJoinCode] = useState('');

  useEffect(() => setName(data.name), [data.name]);

  const members = data.members || [];
  const pacing = data.budget_pacing;
  const overBudget = (data.attention_items || []).some((item) => item.kind === 'over_budget');

  const cheer = (text) => mascotRef?.current?.cheer(text);

  const rows = useMemo(
    () =>
      pacingRows(pacing, {
        needs: t('household.bucket_needs'),
        wants: t('household.bucket_wants'),
        savings: t('household.bucket_savings'),
      }).map((row) => ({
        ...row,
        note: row.source === 'income_rule' ? t('household.limit_from_income') : '',
      })),
    [pacing, t]
  );

  const saveName = async () => {
    setEditingName(false);
    const cleaned = (name || '').trim();
    if (!cleaned || cleaned === data.name) {
      setName(data.name);
      return;
    }
    const saved = await actions.rename(cleaned);
    if (!saved) setName(data.name);
  };

  const copyCode = async () => {
    if (await copyText(data.invite_code)) cheer(t('household.copied'));
    else toast.error(t('household.copy_failed'));
  };

  const submitJoin = async (event) => {
    event.preventDefault();
    if (!joinCode.trim()) return;
    if (await actions.join(joinCode)) setJoinCode('');
  };

  const tabItems = TABS.map((id) => ({ id, label: t(`household.tab_${id}`), icon: TAB_ICONS[id] }));
  const modeItems = [
    { id: 'family', label: t('household.mode_family'), icon: '🏠' },
    { id: 'business', label: t('household.mode_business'), icon: '💼' },
  ];

  return (
    <div className="hh-canvas mx-auto max-w-6xl space-y-5 p-4 sm:p-6" data-household-mode={data.mode}>
      {/* A link somebody was sent. Joining moves the reader to another
          household, so it is asked and not done on arrival. */}
      {pendingJoin && pendingJoin !== data.invite_code ? (
        <div className="hh-card-forest flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-sm">
            {t('household.join_prompt', '', { code: pendingJoin })}
          </p>
          <div className="flex gap-2">
            <button type="button" className="hh-badge" disabled={busy} onClick={() => actions.join(pendingJoin)}>
              {t('household.join_confirm')}
            </button>
            <button type="button" className="text-xs underline" onClick={actions.dismissJoin}>
              {t('household.join_dismiss')}
            </button>
          </div>
        </div>
      ) : null}

      {/* The header */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <span className="hh-badge">🌿 {t('household.badge')}</span>
          {editingName ? (
            <input
              className="hh-field mt-3 !text-2xl !font-extrabold"
              value={name}
              maxLength={120}
              autoFocus
              aria-label={t('household.name_label')}
              onChange={(e) => setName(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
                if (e.key === 'Escape') { setName(data.name); setEditingName(false); }
              }}
            />
          ) : (
            <h1 className="mt-3 flex flex-wrap items-center gap-2 text-2xl font-extrabold sm:text-3xl">
              <span className="break-words">{data.name}</span>
              {data.can_manage ? (
                <button type="button" className="hh-button hh-button-ghost !px-2.5 !py-1 text-xs"
                  onClick={() => setEditingName(true)} aria-label={t('household.rename')}>
                  ✎ {t('household.rename')}
                </button>
              ) : null}
            </h1>
          )}
          <p className="mt-1 text-sm hh-muted">{t('household.subtitle')}</p>
        </div>
        {data.can_manage ? (
          <BudggtQuickPills
            items={modeItems}
            activeId={data.mode}
            ariaLabel={t('household.mode_label')}
            onSelect={(mode) => { if (mode !== data.mode) actions.switchMode(mode); }}
          />
        ) : null}
      </header>

      {/* The members, and the code */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="hh-card relative p-5 pt-6">
          {/* The mascot sits on the top edge of the card. */}
          <div className="absolute -top-9 right-5">
            <RiggedSvgMascot
              ref={mascotRef}
              mode={data.mode === 'business' ? 'business' : 'family'}
              state={overBudget ? 'alert' : 'idle'}
              size={64}
              label={t('household.mascot_label')}
              lines={[
                t('household.mascot_line_1'),
                t('household.mascot_line_2'),
                t('household.mascot_line_3'),
              ]}
            />
          </div>

          <h2 className="pr-20 text-base font-bold">{t('household.members_title')}</h2>
          <p className="mt-0.5 text-xs hh-muted">
            {t('household.members_count', '', { count: members.length })}
            {data.created_at ? ` · ${t('household.active_since', '', { date: shortDate(data.created_at, language) })}` : ''}
          </p>

          <ul className="mt-4 space-y-3">
            {members.map((member) => (
              <li key={member.id} className="flex items-center gap-3" data-member={member.id}>
                <span className="relative flex-none">
                  <img src={avatarUrl(member.avatar)} alt="" className="h-10 w-10 rounded-2xl object-cover" />
                  {member.online ? (
                    <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2"
                      style={{ background: '#22C55E', borderColor: 'var(--hh-card)' }}
                      title={t('household.online')} />
                  ) : null}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold break-words">{member.name}</p>
                  <p className="text-xs hh-muted">
                    {t(roleKey(member.role))}
                    {' · '}
                    {member.status === 'invited'
                      ? t('household.status_invited')
                      : member.online ? t('household.online') : t('household.offline')}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <button type="button" className="hh-button mt-5" onClick={() => setInviteOpen(true)}>
            {t('household.add_member')}
          </button>
        </section>

        <section className="hh-card-forest p-5">
          <div className="hh-ticket px-6 py-5 text-center">
            <p className="text-[11px] font-extrabold tracking-[0.2em]" style={{ color: '#BEF264' }}>
              {t('household.invite_code_label')}
            </p>
            <p className="hh-code mt-2 text-3xl sm:text-4xl" data-invite-code>{data.invite_code}</p>
            <button type="button" className="hh-badge mt-4 !px-4 !py-2 !text-xs" onClick={copyCode}>
              {t('household.copy')}
            </button>
          </div>
          <p className="mt-3 text-xs opacity-80">{t('household.invite_code_hint')}</p>

          <form onSubmit={submitJoin} className="mt-4 flex flex-wrap gap-2">
            <input
              className="hh-field hh-light min-w-0 flex-1 !font-mono uppercase"
              value={joinCode}
              maxLength={8}
              aria-label={t('household.join_label')}
              placeholder={t('household.join_placeholder')}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            />
            <button type="submit" className="hh-badge !px-4 !text-xs" disabled={busy || joinCode.trim().length !== 8}>
              {t('household.join_button')}
            </button>
          </form>
        </section>
      </div>

      {/* The month */}
      {pacing ? (
        <div>
          <BudggtPacingCard
            monthLabel={t('household.pacing_title', '', { month: monthLabel(pacing.year, pacing.month, language) })}
            dayLabel={t('household.day_of', '', { day: pacing.current_day, total: pacing.days_in_month })}
            currentDay={pacing.current_day}
            totalDays={pacing.days_in_month}
            rows={rows}
            formatAmount={(n) => formatCurrency(n)}
            noLimitLabel={t('household.no_limit')}
            todayLabel={t('household.today')}
          />
          <p className="mt-2 px-1 text-xs hh-muted">{t('household.pacing_private')}</p>
        </div>
      ) : null}

      {/* The tabs */}
      <BudggtQuickPills items={tabItems} activeId={tab} onSelect={setTab} ariaLabel={t('household.tabs_label')} />

      <div key={tab} className="hh-enter" role="tabpanel" data-tab={tab}>
        {tab === 'summary' ? <SummaryTab data={data} onNavigate={onNavigate} onOpenTab={setTab} /> : null}
        {tab === 'agenda' ? <AgendaTab data={data} actions={actions} busy={busy} /> : null}
        {tab === 'tasks' ? <TasksTab data={data} actions={actions} busy={busy} /> : null}
        {tab === 'needs' ? (
          <NeedsTab data={data} actions={actions} busy={busy} accounts={accounts}
            accountId={accountId} onAccountChange={onAccountChange} onNavigate={onNavigate} />
        ) : null}
        {tab === 'goals' ? <GoalsTab data={data} actions={actions} busy={busy} myGoals={myGoals} /> : null}
        {tab === 'notes' ? <NotesTab data={data} actions={actions} busy={busy} /> : null}
      </div>

      <InviteDialog
        isOpen={inviteOpen}
        onClose={() => setInviteOpen(false)}
        mode={data.mode}
        onInvite={actions.invite}
        onCopied={cheer}
      />
    </div>
  );
}

/* --- the loading and the saving ----------------------------------------- */

export default function HouseholdPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const mascot = useRef(null);

  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [accountId, setAccountId] = useState(null);
  const [myGoals, setMyGoals] = useState([]);
  const [pendingJoin, setPendingJoin] = useState(() => joinCodeFromSearch(location.search));

  const load = useCallback(async () => {
    try {
      setData(await api.household.get());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  // The reader's own accounts and targets. They are for the two
  // pickers; if they cannot be read the page still works.
  const loadMine = useCallback(async () => {
    const [accountList, goalList] = await Promise.all([
      api.accounts.list().catch(() => []),
      api.goals.list().catch(() => []),
    ]);
    const list = Array.isArray(accountList) ? accountList : [];
    setAccounts(list);
    setAccountId((value) => value || pickAccount(list, remembered(PAY_ACCOUNT_KEY))?.id || null);
    setMyGoals(Array.isArray(goalList) ? goalList : []);
  }, []);

  useEffect(() => {
    load();
    loadMine();
  }, [load, loadMine]);

  /**
   * Do one write, then read the household again.
   *
   * It answers with what the server sent, or nothing when the write
   * was refused - and then the reader is told why, in their language.
   */
  const run = useCallback(
    async (write, { cheer, nod } = {}) => {
      setBusy(true);
      try {
        const answer = await write();
        await load();
        if (cheer) mascot.current?.cheer(cheer);
        if (nod) mascot.current?.nod(nod);
        return answer ?? true;
      } catch (error) {
        toast.error(t(errorKey(error)));
        mascot.current?.warn('');
        return null;
      } finally {
        setBusy(false);
      }
    },
    [load, t]
  );

  const actions = useMemo(
    () => ({
      rename: (name) => run(() => api.household.switchMode({ name }), { nod: t('household.saved') }),
      switchMode: (mode) => run(() => api.household.switchMode({ mode }), { nod: t('household.mode_changed') }),
      join: async (code) => {
        const joined = await run(() => api.household.join(code), { cheer: t('household.joined') });
        if (joined) {
          setPendingJoin('');
          navigate('/household', { replace: true });
        }
        return joined;
      },
      dismissJoin: () => {
        setPendingJoin('');
        navigate('/household', { replace: true });
      },
      invite: (body) => run(() => api.household.invite(body), { nod: t('household.invited') }),

      addAgenda: (body) => run(() => api.household.addAgenda(body), { nod: t('household.agenda_added') }),
      toggleAgenda: (id) => run(() => api.household.toggleAgenda(id)),
      removeAgenda: (id) => run(() => api.household.removeAgenda(id)),

      addTask: (body) => run(() => api.household.addTask(body), { nod: t('household.task_added') }),
      toggleTask: async (task) => {
        // The tick is drawn at once, so the line through the words
        // starts under the reader's finger. If the server refuses,
        // the reload puts it back.
        setData((value) => value && ({
          ...value,
          tasks: value.tasks.map((row) => (row.id === task.id ? { ...row, completed: !row.completed } : row)),
        }));
        const finishing = !task.completed;
        const answer = await run(
          () => api.household.toggleTask(task.id),
          finishing ? { cheer: t('household.task_cheer', '', { points: task.reward_points }) } : {}
        );
        if (!answer) await load();
        return answer;
      },
      removeTask: (id) => run(() => api.household.removeTask(id)),

      addNeed: (body) => run(() => api.household.addNeed(body), { nod: t('household.need_added') }),
      importWishlist: () => run(() => api.household.importWishlist(), { nod: t('household.wishlist_imported') }),
      purchaseNeed: async (need) => {
        if (!accountId) return null;
        const answer = await run(
          () => api.household.purchaseNeed(need.id, { account_id: Number(accountId) }),
          { cheer: t('household.need_recorded') }
        );
        // The other pages are told only after the server has said the
        // expense is written.
        if (answer?.created) emitDataMutated('transaction');
        return answer;
      },
      removeNeed: (id) => run(() => api.household.removeNeed(id)),

      addGoal: async (body) => {
        const answer = await run(async () => {
          const goal = await api.goals.create({
            ...body,
            goal_type: 'savings',
            expand_breakdown: false,
          });
          await api.household.shareGoal(goal.id);
          return goal;
        }, { cheer: t('household.goal_added') });
        if (answer) loadMine();
        return answer;
      },
      shareGoal: (goalId) => run(() => api.household.shareGoal(goalId), { nod: t('household.goal_shared') }),

      addNote: (body) => run(() => api.household.addNote(body), { nod: t('household.note_added') }),
      removeNote: (id) => run(() => api.household.removeNote(id)),
    }),
    [run, t, navigate, accountId, load, loadMine]
  );

  if (failed && !data) {
    return (
      <div className="hh-canvas mx-auto max-w-2xl p-8 text-center">
        <p className="text-sm">{t('household.load_failed')}</p>
        <button type="button" className="hh-button mt-4" onClick={load}>{t('household.retry')}</button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="hh-canvas mx-auto max-w-2xl p-8 text-center text-sm hh-muted" role="status">
        {t('household.loading')}
      </div>
    );
  }

  return (
    <HouseholdView
      data={data}
      actions={actions}
      busy={busy}
      accounts={accounts}
      accountId={accountId}
      onAccountChange={(id) => { setAccountId(id); remember(PAY_ACCOUNT_KEY, String(id)); }}
      myGoals={myGoals}
      pendingJoin={pendingJoin}
      onNavigate={navigate}
      mascotRef={mascot}
    />
  );
}
