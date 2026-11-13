/**
 * The household page's small decisions.
 *
 * Which agenda comes next, what to print on a date badge, which
 * words name a role or an action. They are here, with no React in
 * them, so a script can check them.
 */

export const LOCALES = { id: 'id-ID', en: 'en-US', ja: 'ja-JP' };

export const TABS = ['summary', 'agenda', 'tasks', 'needs', 'goals', 'notes'];

export const TAB_ICONS = {
  summary: '🌿',
  agenda: '🗓️',
  tasks: '✅',
  needs: '🛒',
  goals: '🎯',
  notes: '📝',
};

export const NOTE_COLORS = ['lemon', 'mint', 'sky', 'rose', 'lilac', 'peach'];

/** The codes the server refuses with. Each has its own sentence. */
export const ERROR_CODES = [
  'not_allowed',
  'unknown_mode',
  'name_required',
  'invalid_code',
  'code_not_found',
  'invalid_email',
  'title_required',
  'body_required',
  'invalid_price',
  'amount_required',
  'not_found',
];

/** What the audit trail can say happened. */
export const ACTIVITY_ACTIONS = [
  'household_created',
  'mode_changed',
  'renamed',
  'member_joined',
  'member_invited',
  'agenda_added',
  'agenda_done',
  'agenda_removed',
  'task_added',
  'task_done',
  'task_removed',
  'need_added',
  'need_bought',
  'need_removed',
  'wishlist_imported',
  'note_added',
  'note_removed',
  'goal_shared',
  'goal_unshared',
];

export const ATTENTION_KINDS = ['upcoming_bill', 'over_budget', 'unsettled_split'];

export const ROLES = ['host', 'partner', 'member'];

/**
 * A date written as "2026-11-13", as a date in the reader's own day.
 *
 * `new Date('2026-11-13')` is midnight in London, which is the day
 * before for a reader west of it. The parts are read out instead.
 */
export function parseDay(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/** Today as "2026-11-13", in the reader's own day. */
export function todayIso(now = new Date()) {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/** What goes on a date badge: "NOV", "13", "Jum". */
export function agendaBadge(value, language = 'id') {
  const day = parseDay(value);
  if (!day) return { month: '', day: '', weekday: '' };
  const locale = LOCALES[language] || LOCALES.id;
  return {
    month: day.toLocaleDateString(locale, { month: 'short' }).replace('.', '').toUpperCase(),
    day: String(day.getDate()),
    weekday: day.toLocaleDateString(locale, { weekday: 'short' }).replace('.', ''),
  };
}

/** "Jum 19.00 · Rumah Nenek": the line under an agenda's title. */
export function agendaLine(agenda, language = 'id') {
  const { weekday } = agendaBadge(agenda?.date, language);
  const when = [weekday, agenda?.time].filter(Boolean).join(' ');
  return [when, agenda?.location].filter(Boolean).join(' · ');
}

/** The agendas still to come, soonest first. */
export function upcomingAgendas(agendas, today = todayIso(), limit = 3) {
  return (agendas || [])
    .filter((agenda) => agenda.status !== 'done' && String(agenda.date || '') >= today)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || a.id - b.id)
    .slice(0, limit);
}

/** "November 2026", in the reader's language. */
export function monthLabel(year, month, language = 'id') {
  if (!year || !month) return '';
  const locale = LOCALES[language] || LOCALES.id;
  return new Date(year, month - 1, 1).toLocaleDateString(locale, {
    month: 'long',
    year: 'numeric',
  });
}

/** A day and month for a short line: "13 Nov 2026". */
export function shortDate(value, language = 'id') {
  const text = String(value || '');
  const day = parseDay(text) || (text ? new Date(text) : null);
  if (!day || Number.isNaN(day.getTime())) return '';
  const locale = LOCALES[language] || LOCALES.id;
  return day.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** The key of a role's name. Anything unknown is a member. */
export function roleKey(role) {
  return `household.role_${ROLES.includes(role) ? role : 'member'}`;
}

/** The key of what happened, or nothing for an action with no sentence. */
export function activityKey(action) {
  return ACTIVITY_ACTIONS.includes(action) ? `household.act_${action}` : null;
}

/** The key of a kind of thing to look at. */
export function attentionKey(kind) {
  return ATTENTION_KINDS.includes(kind) ? `household.attn_${kind}` : null;
}

/**
 * The key of the sentence for a refusal.
 *
 * The server refuses with a code. A failure that is not one of the
 * codes - the network, a crash - gets the general sentence.
 */
export function errorKey(error) {
  const code = String(error?.message || error || '');
  return ERROR_CODES.includes(code) ? `household.err_${code}` : 'household.err_generic';
}

/** How far a note is turned. Always the same for the same note. */
export function noteTilt(id) {
  const tilts = [-1.5, 1, -0.5, 1.5, 0.5, -1];
  return tilts[Math.abs(Number(id) || 0) % tilts.length];
}

/**
 * The code in a link somebody was sent.
 *
 * `/household?join=76B63290` carries one. Anything that is not eight
 * letters and digits is not a code.
 */
export function joinCodeFromSearch(search) {
  const value = new URLSearchParams(search || '').get('join') || '';
  const code = value.trim().toUpperCase();
  return /^[A-Z0-9]{8}$/.test(code) ? code : '';
}

/** The three rows of the pacing card, from what the server sent. */
export function pacingRows(pacing, labels = {}) {
  if (!pacing) return [];
  const row = (id, source, extra = {}) => ({
    id,
    label: labels[id] || id,
    spent: Number(source?.spent) || 0,
    limit: Number(source?.limit) || 0,
    source: source?.limit_source || 'none',
    ...extra,
  });
  return [
    row('needs', pacing.kebutuhan),
    row('wants', pacing.keinginan),
    row('savings', pacing.tabungan, { goodWhenFull: true }),
  ];
}

/** The account to pay from: the one remembered, if it is still there. */
export function pickAccount(accounts, rememberedId) {
  const list = accounts || [];
  const remembered = list.find((account) => String(account.id) === String(rememberedId));
  return remembered || list[0] || null;
}
