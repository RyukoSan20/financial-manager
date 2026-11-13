/**
 * The six tabs of the household page.
 *
 * Each one is a list and the form that adds to it. They are given
 * what the server sent and a set of actions; they keep only what is
 * being typed. Whatever is saved is saved by the page, which then
 * reads the household again, so what is on the screen is always what
 * is in the database.
 */

import { useState } from 'react';
import { useTranslation } from '../../i18n';
import { formatCurrency } from '../../utils/format';
import CountUpNumber from '../ui/CountUpNumber';
import {
  NOTE_COLORS,
  activityKey,
  agendaBadge,
  agendaLine,
  attentionKey,
  noteTilt,
  shortDate,
  todayIso,
  upcomingAgendas,
} from '../../utils/household.js';

const Empty = ({ children }) => (
  <p className="rounded-2xl border border-dashed px-4 py-8 text-center text-sm hh-muted" style={{ borderColor: 'var(--hh-line)' }}>
    {children}
  </p>
);

const DateBadge = ({ value, language }) => {
  const badge = agendaBadge(value, language);
  return (
    <span className="hh-card-forest flex h-14 w-14 flex-none flex-col items-center justify-center !rounded-2xl leading-none">
      <span className="text-[10px] font-extrabold tracking-widest" style={{ color: '#D8F3DC' }}>
        {badge.month}
      </span>
      <span className="mt-1 text-xl font-extrabold tabular-nums">{badge.day}</span>
    </span>
  );
};

const RemoveButton = ({ onClick, label }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    title={label}
    className="hh-button hh-button-ghost !px-2.5 !py-1.5 text-xs"
  >
    ✕
  </button>
);

/* --- Ringkasan ---------------------------------------------------------- */

export function SummaryTab({ data, onNavigate, onOpenTab }) {
  const { t, language } = useTranslation();
  const attention = data.attention_items || [];
  const upcoming = upcomingAgendas(data.agendas, todayIso(), 3);

  const attentionLine = (item) => {
    const amount = formatCurrency(item.amount || 0);
    if (item.kind === 'upcoming_bill') {
      if (item.days_left <= 0) return t('household.attn_bill_due', '', { amount });
      return t('household.attn_bill_in', '', { amount, days: item.days_left });
    }
    if (item.kind === 'over_budget') return t('household.attn_over_by', '', { amount });
    return t('household.attn_split_owed', '', { amount, days: item.days_outstanding || 0 });
  };

  const fixLabel = {
    upcoming_bill: t('household.fix_bill'),
    over_budget: t('household.fix_budget'),
    unsettled_split: t('household.fix_split'),
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="hh-card p-5">
        <h3 className="text-base font-bold">{t('household.attention_title')}</h3>
        <p className="mt-0.5 text-xs hh-muted">{t('household.attention_hint')}</p>
        <div className="mt-4 space-y-3">
          {attention.length === 0 ? (
            <Empty>{t('household.attention_empty')}</Empty>
          ) : (
            attention.map((item, index) => (
              <div
                key={`${item.kind}-${index}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-3"
                style={{ borderColor: 'var(--hh-line)' }}
                data-attention={item.kind}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold uppercase tracking-wider hh-muted">
                    {t(attentionKey(item.kind) || 'household.attn_upcoming_bill')}
                  </p>
                  <p className="text-sm font-semibold break-words">{item.title}</p>
                  <p className="text-xs hh-muted">{attentionLine(item)}</p>
                </div>
                <button
                  type="button"
                  className="hh-button !py-2 text-xs"
                  onClick={() => onNavigate(item.href)}
                >
                  {fixLabel[item.kind] || t('household.fix_open')}
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="hh-card p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-bold">{t('household.upcoming_title')}</h3>
          <button type="button" className="hh-button !py-2 text-xs" onClick={() => onOpenTab('agenda')}>
            {t('household.add_agenda_short')}
          </button>
        </div>
        <div className="mt-4 space-y-3">
          {upcoming.length === 0 ? (
            <Empty>{t('household.upcoming_empty')}</Empty>
          ) : (
            upcoming.map((agenda) => (
              <div key={agenda.id} className="flex items-center gap-3">
                <DateBadge value={agenda.date} language={language} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold break-words">{agenda.title}</p>
                  <p className="text-xs hh-muted break-words">{agendaLine(agenda, language)}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

/* --- Agenda ------------------------------------------------------------- */

export function AgendaTab({ data, actions, busy }) {
  const { t, language } = useTranslation();
  const [form, setForm] = useState({ title: '', date: todayIso(), time: '', location: '', kind: 'meeting' });
  const set = (key) => (event) => setForm((value) => ({ ...value, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    if (!form.title.trim() || !form.date) return;
    const saved = await actions.addAgenda(form);
    if (saved) setForm((value) => ({ ...value, title: '', time: '', location: '' }));
  };

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="hh-card grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-6">
        <label className="lg:col-span-2">
          <span className="mb-1 block text-xs font-semibold hh-muted">{t('household.agenda_title_label')}</span>
          <input className="hh-field" value={form.title} onChange={set('title')} maxLength={200}
            placeholder={t('household.agenda_title_placeholder')} required />
        </label>
        <label>
          <span className="mb-1 block text-xs font-semibold hh-muted">{t('household.agenda_date_label')}</span>
          <input type="date" className="hh-field" value={form.date} onChange={set('date')} required />
        </label>
        <label>
          <span className="mb-1 block text-xs font-semibold hh-muted">{t('household.agenda_time_label')}</span>
          <input className="hh-field" value={form.time} onChange={set('time')} maxLength={20} placeholder="19.00" />
        </label>
        <label>
          <span className="mb-1 block text-xs font-semibold hh-muted">{t('household.agenda_location_label')}</span>
          <input className="hh-field" value={form.location} onChange={set('location')} maxLength={200}
            placeholder={t('household.agenda_location_placeholder')} />
        </label>
        <label>
          <span className="mb-1 block text-xs font-semibold hh-muted">{t('household.agenda_kind_label')}</span>
          <select className="hh-field" value={form.kind} onChange={set('kind')}>
            <option value="meeting">{t('household.agenda_kind_meeting')}</option>
            <option value="bill">{t('household.agenda_kind_bill')}</option>
          </select>
        </label>
        <div className="sm:col-span-2 lg:col-span-6">
          <button type="submit" className="hh-button" disabled={busy}>
            {t('household.add_agenda')}
          </button>
        </div>
      </form>

      {(data.agendas || []).length === 0 ? (
        <Empty>{t('household.agenda_empty')}</Empty>
      ) : (
        <ul className="space-y-3">
          {data.agendas.map((agenda) => {
            const done = agenda.status === 'done';
            return (
              <li key={agenda.id} className={`hh-card flex flex-wrap items-center gap-3 p-4 hh-enter ${done ? 'hh-task-done' : ''}`}>
                <DateBadge value={agenda.date} language={language} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold break-words">
                    <span className="hh-task-title">{agenda.title}</span>
                  </p>
                  <p className="text-xs hh-muted break-words">
                    {[
                      agenda.kind === 'bill' ? t('household.agenda_kind_bill') : t('household.agenda_kind_meeting'),
                      agendaLine(agenda, language),
                    ].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <button type="button" className="hh-button hh-button-ghost !py-2 text-xs"
                  onClick={() => actions.toggleAgenda(agenda.id)}>
                  {done ? t('household.mark_upcoming') : t('household.mark_done')}
                </button>
                <RemoveButton label={t('household.remove')} onClick={() => actions.removeAgenda(agenda.id)} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* --- Tugas -------------------------------------------------------------- */

export function TasksTab({ data, actions, busy }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ title: '', assignee: '', reward_points: 10 });
  const members = data.members || [];

  const submit = async (event) => {
    event.preventDefault();
    if (!form.title.trim()) return;
    const saved = await actions.addTask({
      title: form.title,
      assignee: form.assignee || null,
      reward_points: Number(form.reward_points) || 0,
    });
    if (saved) setForm((value) => ({ ...value, title: '' }));
  };

  return (
    <div className="space-y-4">
      <div className="hh-card-forest flex flex-wrap items-center justify-between gap-3 p-4">
        <span className="text-sm font-semibold">{t('household.points_title')}</span>
        <span className="hh-badge tabular-nums">
          ⭐ <CountUpNumber value={data.reward_points || 0} /> {t('household.points_unit')}
        </span>
      </div>

      <form onSubmit={submit} className="hh-card grid gap-3 p-5 sm:grid-cols-4">
        <label className="sm:col-span-2">
          <span className="mb-1 block text-xs font-semibold hh-muted">{t('household.task_title_label')}</span>
          <input className="hh-field" value={form.title} maxLength={200} required
            onChange={(e) => setForm((v) => ({ ...v, title: e.target.value }))}
            placeholder={t('household.task_title_placeholder')} />
        </label>
        <label>
          <span className="mb-1 block text-xs font-semibold hh-muted">{t('household.assignee_label')}</span>
          <select className="hh-field" value={form.assignee}
            onChange={(e) => setForm((v) => ({ ...v, assignee: e.target.value }))}>
            <option value="">{t('household.assignee_anyone')}</option>
            {members.map((member) => (
              <option key={member.id} value={member.name}>{member.name}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-xs font-semibold hh-muted">{t('household.points_label')}</span>
          <input type="number" min={0} max={1000} className="hh-field" value={form.reward_points}
            onChange={(e) => setForm((v) => ({ ...v, reward_points: e.target.value }))} />
        </label>
        <div className="sm:col-span-4">
          <button type="submit" className="hh-button" disabled={busy}>{t('household.add_task')}</button>
        </div>
      </form>

      {(data.tasks || []).length === 0 ? (
        <Empty>{t('household.tasks_empty')}</Empty>
      ) : (
        <ul className="space-y-2">
          {data.tasks.map((task) => (
            <li key={task.id}
              className={`hh-card flex flex-wrap items-center gap-3 p-4 ${task.completed ? 'hh-task-done' : ''}`}
              data-task={task.id}>
              <button type="button" role="checkbox" aria-checked={task.completed ? 'true' : 'false'}
                aria-label={task.title} className="hh-check" onClick={() => actions.toggleTask(task)}>
                {task.completed ? <span aria-hidden="true" className="text-sm font-black text-[#2F4842]">✓</span> : null}
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold break-words">
                  <span className="hh-task-title">{task.title}</span>
                </p>
                {task.assignee ? <p className="text-xs hh-muted">{task.assignee}</p> : null}
              </div>
              <span className="hh-badge tabular-nums">+{task.reward_points}</span>
              <RemoveButton label={t('household.remove')} onClick={() => actions.removeTask(task.id)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* --- Kebutuhan ---------------------------------------------------------- */

export function NeedsTab({ data, actions, busy, accounts, accountId, onAccountChange, onNavigate }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ title: '', estimated_price: '', assignee: '' });
  const members = data.members || [];
  const needs = data.needs || [];
  const open = needs.filter((need) => !need.purchased);
  const estimate = open.reduce((sum, need) => sum + (Number(need.estimated_price) || 0), 0);

  const submit = async (event) => {
    event.preventDefault();
    if (!form.title.trim()) return;
    const saved = await actions.addNeed({
      title: form.title,
      estimated_price: Number(form.estimated_price) || 0,
      assignee: form.assignee || null,
    });
    if (saved) setForm((value) => ({ ...value, title: '', estimated_price: '' }));
  };

  return (
    <div className="space-y-4">
      <div className="hh-card flex flex-wrap items-end justify-between gap-4 p-5">
        <div>
          <p className="text-xs font-semibold hh-muted">{t('household.needs_estimate')}</p>
          <p className="text-xl font-extrabold tabular-nums">
            <CountUpNumber value={estimate} format={(n) => formatCurrency(n)} />
          </p>
        </div>
        {accounts.length > 0 ? (
          <label className="min-w-[12rem] flex-1 sm:max-w-xs">
            <span className="mb-1 block text-xs font-semibold hh-muted">{t('household.pay_from')}</span>
            <select className="hh-field" value={accountId || ''} onChange={(e) => onAccountChange(e.target.value)}>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>{account.name}</option>
              ))}
            </select>
          </label>
        ) : (
          <button type="button" className="hh-button hh-button-ghost text-xs" onClick={() => onNavigate('/accounts')}>
            {t('household.no_account')}
          </button>
        )}
      </div>

      <form onSubmit={submit} className="hh-card grid gap-3 p-5 sm:grid-cols-4">
        <label className="sm:col-span-2">
          <span className="mb-1 block text-xs font-semibold hh-muted">{t('household.need_title_label')}</span>
          <input className="hh-field" value={form.title} maxLength={200} required
            onChange={(e) => setForm((v) => ({ ...v, title: e.target.value }))}
            placeholder={t('household.need_title_placeholder')} />
        </label>
        <label>
          <span className="mb-1 block text-xs font-semibold hh-muted">{t('household.need_price_label')}</span>
          <input type="number" min={0} step="any" inputMode="decimal" className="hh-field" value={form.estimated_price}
            onChange={(e) => setForm((v) => ({ ...v, estimated_price: e.target.value }))} placeholder="0" />
        </label>
        <label>
          <span className="mb-1 block text-xs font-semibold hh-muted">{t('household.assignee_label')}</span>
          <select className="hh-field" value={form.assignee}
            onChange={(e) => setForm((v) => ({ ...v, assignee: e.target.value }))}>
            <option value="">{t('household.assignee_anyone')}</option>
            {members.map((member) => (
              <option key={member.id} value={member.name}>{member.name}</option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap gap-2 sm:col-span-4">
          <button type="submit" className="hh-button" disabled={busy}>{t('household.add_need')}</button>
          {data.wishlist_waiting > 0 ? (
            <button type="button" className="hh-button hh-button-ghost" disabled={busy} onClick={actions.importWishlist}>
              {t('household.import_wishlist', '', { count: data.wishlist_waiting })}
            </button>
          ) : null}
        </div>
      </form>

      {needs.length === 0 ? (
        <Empty>{t('household.needs_empty')}</Empty>
      ) : (
        <ul className="space-y-2">
          {needs.map((need) => (
            <li key={need.id}
              className={`hh-card flex flex-wrap items-center gap-3 p-4 ${need.purchased ? 'hh-task-done' : ''}`}
              data-need={need.id}>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold break-words">
                  <span className="hh-task-title">{need.title}</span>
                </p>
                <p className="text-xs hh-muted tabular-nums">
                  {Number(need.estimated_price) > 0
                    ? t('household.need_estimated', '', { amount: formatCurrency(need.estimated_price) })
                    : t('household.need_no_price')}
                </p>
              </div>
              {need.assignee ? (
                <span className="rounded-full border px-2.5 py-1 text-xs font-semibold" style={{ borderColor: 'var(--hh-line)' }}>
                  {need.assignee}
                </span>
              ) : null}
              {need.purchased ? (
                <span className="hh-badge">{t('household.need_bought')}</span>
              ) : (
                <button type="button" className="hh-button !py-2 text-xs"
                  disabled={busy || !accountId || !(Number(need.estimated_price) > 0)}
                  title={!(Number(need.estimated_price) > 0) ? t('household.need_no_price') : undefined}
                  onClick={() => actions.purchaseNeed(need)}>
                  {t('household.need_buy')}
                </button>
              )}
              <RemoveButton label={t('household.remove')} onClick={() => actions.removeNeed(need.id)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* --- Target ------------------------------------------------------------- */

export function GoalsTab({ data, actions, busy, myGoals }) {
  const { t, language } = useTranslation();
  const [form, setForm] = useState({ name: '', target_amount: '', target_date: '' });
  const [existing, setExisting] = useState('');
  // Which shared goal card has its "add savings" box open, and what
  // the reader has typed into it.
  const [contributing, setContributing] = useState(null);
  const [contributionAmount, setContributionAmount] = useState('');
  const shared = data.goals || [];
  const sharedIds = new Set(shared.map((goal) => goal.id));
  const shareable = (myGoals || []).filter((goal) => !sharedIds.has(goal.id));

  const submit = async (event) => {
    event.preventDefault();
    const amount = Number(form.target_amount) || 0;
    if (!form.name.trim() || amount <= 0) return;
    const saved = await actions.addGoal({
      name: form.name,
      target_amount: amount,
      target_date: form.target_date || null,
    });
    if (saved) setForm({ name: '', target_amount: '', target_date: '' });
  };

  const submitContribution = async (event, goalId) => {
    event.preventDefault();
    const amount = Number(contributionAmount) || 0;
    if (amount <= 0) return;
    const saved = await actions.contributeGoal(goalId, amount);
    if (saved) {
      setContributing(null);
      setContributionAmount('');
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="hh-card grid gap-3 p-5 sm:grid-cols-4">
        <label className="sm:col-span-2">
          <span className="mb-1 block text-xs font-semibold hh-muted">{t('household.goal_name_label')}</span>
          <input className="hh-field" value={form.name} maxLength={100} required
            onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))}
            placeholder={t('household.goal_name_placeholder')} />
        </label>
        <label>
          <span className="mb-1 block text-xs font-semibold hh-muted">{t('household.goal_amount_label')}</span>
          <input type="number" min={1} step="any" inputMode="decimal" className="hh-field" required
            value={form.target_amount} onChange={(e) => setForm((v) => ({ ...v, target_amount: e.target.value }))} />
        </label>
        <label>
          <span className="mb-1 block text-xs font-semibold hh-muted">{t('household.goal_date_label')}</span>
          <input type="date" className="hh-field" value={form.target_date}
            onChange={(e) => setForm((v) => ({ ...v, target_date: e.target.value }))} />
        </label>
        <div className="sm:col-span-4">
          <button type="submit" className="hh-button" disabled={busy}>{t('household.add_goal')}</button>
        </div>
      </form>

      {shareable.length > 0 ? (
        <div className="hh-card flex flex-wrap items-end gap-3 p-5">
          <label className="min-w-[12rem] flex-1">
            <span className="mb-1 block text-xs font-semibold hh-muted">{t('household.share_existing_label')}</span>
            <select className="hh-field" value={existing} onChange={(e) => setExisting(e.target.value)}>
              <option value="">{t('household.share_existing_choose')}</option>
              {shareable.map((goal) => (
                <option key={goal.id} value={goal.id}>{goal.name}</option>
              ))}
            </select>
          </label>
          <button type="button" className="hh-button hh-button-ghost" disabled={busy || !existing}
            onClick={async () => { if (await actions.shareGoal(Number(existing))) setExisting(''); }}>
            {t('household.share_existing')}
          </button>
        </div>
      ) : null}

      {shared.length === 0 ? (
        <Empty>{t('household.goals_empty')}</Empty>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {shared.map((goal) => (
            <li key={goal.id} className="hh-card p-5" data-goal={goal.id}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-bold break-words">{goal.icon ? `${goal.icon} ` : ''}{goal.name}</p>
                <span className="text-sm font-extrabold tabular-nums">
                  <CountUpNumber value={goal.progress_percent || 0} format={(n) => `${Math.round(n)}%`} />
                </span>
              </div>
              <div className="hh-liquid mt-3" role="progressbar" aria-label={goal.name}
                aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(goal.progress_percent || 0)}>
                <div className="hh-liquid-fill" style={{ width: `${goal.progress_percent || 0}%` }} />
              </div>
              <p className="mt-2 text-xs tabular-nums hh-muted">
                {formatCurrency(goal.current_amount, goal.currency)} / {formatCurrency(goal.target_amount, goal.currency)}
              </p>
              <p className="mt-1 text-xs hh-muted">
                {[
                  goal.shared_by ? t('household.goal_shared_by', '', { name: goal.shared_by }) : '',
                  goal.target_date ? shortDate(goal.target_date, language) : '',
                ].filter(Boolean).join(' · ')}
              </p>

              {contributing === goal.id ? (
                <form
                  onSubmit={(event) => submitContribution(event, goal.id)}
                  className="mt-3 flex items-center gap-2"
                >
                  <input
                    type="number"
                    min={1}
                    step="any"
                    inputMode="decimal"
                    autoFocus
                    required
                    className="hh-field flex-1"
                    placeholder={t('household.goal_contribution_placeholder')}
                    value={contributionAmount}
                    onChange={(e) => setContributionAmount(e.target.value)}
                  />
                  <button type="submit" className="hh-button !py-1.5 !px-3 text-xs" disabled={busy}>
                    {t('household.goal_contribution_save')}
                  </button>
                  <button
                    type="button"
                    className="hh-button hh-button-ghost !py-1.5 !px-3 text-xs"
                    onClick={() => { setContributing(null); setContributionAmount(''); }}
                  >
                    {t('household.cancel')}
                  </button>
                </form>
              ) : (
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                  <button
                    type="button"
                    className="font-semibold text-[#2F4842] dark:text-emerald-400 hover:underline"
                    onClick={() => { setContributing(goal.id); setContributionAmount(''); }}
                  >
                    + {t('household.goal_add_savings')}
                  </button>
                  <a
                    href="/goals"
                    className="font-semibold text-[#2F4842] dark:text-emerald-400 hover:underline"
                  >
                    {t('household.goal_open')}
                  </a>
                  <button
                    type="button"
                    className="font-semibold text-rose-600 hover:text-rose-700"
                    disabled={busy}
                    onClick={() => actions.unshareGoal(goal.id)}
                  >
                    {t('household.goal_unshare')}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* --- Catatan ------------------------------------------------------------ */

export function NotesTab({ data, actions, busy }) {
  const { t, language } = useTranslation();
  const [body, setBody] = useState('');
  const [color, setColor] = useState(NOTE_COLORS[0]);

  const submit = async (event) => {
    event.preventDefault();
    if (!body.trim()) return;
    const saved = await actions.addNote({ body, color });
    if (saved) setBody('');
  };

  const sentence = (row) => {
    const key = activityKey(row.action);
    if (!key) return row.detail || row.action;
    return t(key, '', { detail: row.detail || '' });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <form onSubmit={submit} className="hh-card space-y-3 p-5">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold hh-muted">{t('household.note_label')}</span>
            <textarea className="hh-field" rows={3} maxLength={2000} value={body} required
              onChange={(e) => setBody(e.target.value)} placeholder={t('household.note_placeholder')} />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-2" role="radiogroup" aria-label={t('household.note_color')}>
              {NOTE_COLORS.map((name) => (
                <button key={name} type="button" role="radio" aria-checked={color === name ? 'true' : 'false'}
                  aria-label={name} onClick={() => setColor(name)}
                  className={`hh-note-${name} h-7 w-7 rounded-full border-2`}
                  style={{ borderColor: color === name ? '#2F4842' : 'transparent' }} />
              ))}
            </div>
            <button type="submit" className="hh-button" disabled={busy}>{t('household.add_note')}</button>
          </div>
        </form>

        {(data.notes || []).length === 0 ? (
          <Empty>{t('household.notes_empty')}</Empty>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {data.notes.map((note) => (
              <li key={note.id} className={`hh-note hh-note-${NOTE_COLORS.includes(note.color) ? note.color : 'lemon'} hh-enter`}
                style={{ '--note-tilt': `${noteTilt(note.id)}deg` }} data-note={note.id}>
                <p className="whitespace-pre-wrap break-words text-sm">{note.body}</p>
                <div className="mt-3 flex items-center justify-between gap-2 text-xs opacity-70">
                  <span>{[note.author, shortDate(note.created_at, language)].filter(Boolean).join(' · ')}</span>
                  <button type="button" aria-label={t('household.remove')} title={t('household.remove')}
                    className="font-bold" onClick={() => actions.removeNote(note.id)}>✕</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <section className="hh-card p-5">
        <h3 className="text-base font-bold">{t('household.activity_title')}</h3>
        {(data.activity || []).length === 0 ? (
          <p className="mt-3 text-sm hh-muted">{t('household.activity_empty')}</p>
        ) : (
          <ol className="mt-4 space-y-3">
            {data.activity.map((row) => (
              <li key={row.id} className="flex gap-3 text-sm">
                <span className="mt-1.5 h-2 w-2 flex-none rounded-full" style={{ background: '#52796F' }} aria-hidden="true" />
                <div className="min-w-0">
                  <p className="break-words">
                    <span className="font-semibold">{row.actor}</span> {sentence(row)}
                  </p>
                  <p className="text-xs hh-muted">{shortDate(row.created_at, language)}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
