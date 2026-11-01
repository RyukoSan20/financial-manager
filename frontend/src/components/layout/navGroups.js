/**
 * The grouped sidebar, as data.
 *
 * The groups, the map of items, and the rules about which pages need
 * the advanced features all live here, in plain JavaScript with no
 * React in it. That way they can be read and checked by a script,
 * rather than only by looking at the screen.
 *
 * `GroupedNav.jsx` draws what is decided here.
 */

import { readerFlag } from '../../utils/featureFlags.js';

/**
 * The groups.
 *
 * The order is the order a reader is likely to want them in: what
 * happened, what is planned, what it means, and then the tools.
 *
 * `advanced` marks the items that are hidden until the advanced
 * features are turned on, which is the `ADVANCED_FEATURES` switch.
 */
export const NAV_GROUPS = [
  {
    key: 'money',
    label: 'sidebar_group_money',
    items: ['dashboard', 'transactions', 'accounts', 'feed'],
  },
  {
    key: 'plan',
    label: 'sidebar_group_plan',
    items: ['budgets', 'goals', 'recurring', 'debts'],
  },
  {
    key: 'insight',
    label: 'sidebar_group_insight',
    items: ['analytics', 'advisor', 'market', 'healthCoach'],
  },
  {
    key: 'tools',
    label: 'sidebar_group_tools',
    items: ['calculators', 'shopping', 'kanban', 'gmail'],
  },
  {
    key: 'other',
    label: 'sidebar_group_other',
    items: ['map', 'categoryExpenses', 'merchant'],
    advanced: true,
  },
  {
    // The shared bill. It is in a group of its own because it is
    // out of the way until it is wanted, and it is behind a switch:
    // a reader who has never shared a bill should not see a page
    // about it in the menu.
    key: 'split',
    label: 'sidebar_group_split',
    items: ['split'],
    flag: 'SMART_SPLIT_BILL',
  },
];

/**
 * The items, by their key.
 *
 * The flat list is the one that is already in the application, so the
 * two views cannot drift apart.
 */
export function buildNavMap(t) {
  return {
    dashboard: { name: t('nav.dashboard'), href: '/', icon: 'LayoutDashboard' },
    transactions: { name: t('nav.transactions'), href: '/transactions', icon: 'Receipt' },
    feed: { name: t('nav.feed'), href: '/feed', icon: 'BellRing' },
    market: { name: t('nav.market'), href: '/market', icon: 'BarChart3' },
    accounts: { name: t('nav.accounts'), href: '/accounts', icon: 'Wallet' },
    budgets: { name: t('nav.budgets'), href: '/budgets', icon: 'PiggyBank' },
    recurring: { name: t('nav.recurring'), href: '/recurring', icon: 'Repeat' },
    goals: { name: t('nav.goals'), href: '/goals', icon: 'Target' },
    debts: { name: t('nav.debts'), href: '/debts', icon: 'CreditCard' },
    split: { name: t('nav.split'), href: '/split', icon: 'Users' },
    calculators: { name: t('nav.calculators'), href: '/calculators', icon: 'Calculator' },
    analytics: { name: t('nav.analytics'), href: '/analytics', icon: 'BarChart3' },
    advisor: { name: t('nav.advisor'), href: '/advisor', icon: 'Sparkles' },
    map: { name: t('nav.map'), href: '/map', icon: 'Map' },
    healthCoach: { name: t('nav.healthCoach'), href: '/health-coach', icon: 'Heart' },
    shopping: { name: t('nav.shopping'), href: '/shopping', icon: 'ShoppingCart' },
    kanban: { name: t('nav.kanban'), href: '/kanban', icon: 'Kanban' },
    gmail: { name: t('nav.gmail'), href: '/gmail', icon: 'Mail' },
    merchant: { name: t('nav.merchant'), href: '/merchant', icon: 'ShoppingBag' },
    categoryExpenses: { name: t('nav.categoryExpenses'), href: '/category-expenses', icon: 'PieChart' },
    settings: { name: t('nav.settings'), href: '/settings', icon: 'Settings' },
  };
}

/**
 * Is the grouped sidebar on?
 *
 * Read on every render rather than once, so that turning the switch
 * on in the settings page changes the sidebar straight away.
 */
export function isGroupedNavOn() {
  return readerFlag('NAV_V2');
}

/**
 * Are the advanced features on?
 */
export function isAdvancedOn() {
  return readerFlag('ADVANCED_FEATURES');
}

/**
 * The groups, with the hidden ones taken out.
 *
 * A group that would end up empty is dropped as well, so an empty
 * heading never appears.
 */
export function visibleGroups(navMap) {
  const advanced = isAdvancedOn();
  const groups = [];
  for (const group of NAV_GROUPS) {
    // A group behind a switch is left out when that switch is off.
    if (group.flag && !readerFlag(group.flag)) continue;
    const items = group.items
      .filter((key) => !(group.advanced && !advanced))
      .map((key) => navMap[key])
      .filter(Boolean);
    if (items.length) groups.push({ ...group, items });
  }
  return groups;
}

/**
 * The pages that need the advanced features to be on.
 *
 * The merchant page is the one the complaint was about: it is a
 * tool for running a shop, and most readers of a personal finance
 * application never need it. So it is out of the menu until the
 * advanced features are turned on.
 */
export const ADVANCED_PAGES = ['/merchant', '/map'];

/**
 * The pages that are behind a switch of their own.
 *
 * The shared bill is one of them. The page is still there when the
 * switch is off - a link that somebody sent to a friend has to
 * work - but the menu does not show it until the reader has asked
 * for it.
 */
export const FLAGGED_PAGES = {
  '/split': 'SMART_SPLIT_BILL',
};

/**
 * Is this page one that needs the advanced features?
 */
export function isAdvancedPage(pathname) {
  return ADVANCED_PAGES.some((path) => pathname.startsWith(path));
}

/**
 * May this page be shown?
 *
 * With the advanced features on, every page is allowed. With them
 * off, the advanced pages are not.
 */
export function canSeePage(pathname) {
  if (!isAdvancedPage(pathname)) return true;
  return isAdvancedOn();
}

/**
 * Is this page one that is behind a switch of its own?
 *
 * The answer is used by the settings page to show what is on and
 * what is off, and by the tests that check that turning a switch
 * off really does hide the thing.
 */
export function flagForPage(pathname) {
  for (const path of Object.keys(FLAGGED_PAGES)) {
    if (pathname === path || pathname.startsWith(`${path}/`)) {
      return FLAGGED_PAGES[path];
    }
  }
  return null;
}
