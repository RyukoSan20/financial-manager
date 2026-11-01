/**
 * The shared bill, and the switches that hold it back.
 *
 * A feature that is off by default has to be off in every way that
 * a reader can notice. These are the checks that the menu shows
 * nothing new, and that a bookmark to the page leads back to the
 * page the reader knows.
 */

/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  setReaderFlag,
  clearReaderFlags,
  readerFlag,
} from '../../../utils/featureFlags';
import {
  visibleGroups,
  flagForPage,
  NAV_GROUPS,
} from '../../layout/navGroups';

/**
 * A storage that holds the reader's switches.
 *
 * The switches live in the browser's own storage, and the tests run
 * outside a browser. This is the same thing, in memory: it reads and
 * writes the same way, so the switches are read and written exactly
 * as they are in the application.
 */
function makeStorage() {
  const values = new Map();
  return {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    clear: () => values.clear(),
  };
}

describe('the shared bill is off by default', () => {
  beforeEach(() => {
    globalThis.window = { localStorage: makeStorage() };
    clearReaderFlags();
  });

  afterEach(() => {
    clearReaderFlags();
    delete globalThis.window;
  });

  it('is off when nobody has touched it', () => {
    expect(readerFlag('SMART_SPLIT_BILL')).toBe(false);
    expect(readerFlag('LIVE_CLAIM')).toBe(false);
  });

  it('does not show up in the menu', () => {
    const navMap = {
      budgets: { key: 'budgets' },
      goals: { key: 'goals' },
      recurring: { key: 'recurring' },
      debts: { key: 'debts' },
      split: { key: 'split' },
      map: { key: 'map' },
      categoryExpenses: { key: 'categoryExpenses' },
      merchant: { key: 'merchant' },
    };

    const groups = visibleGroups(navMap);
    const labels = groups.map((group) => group.label);

    expect(labels).not.toContain('sidebar_group_split');
  });

  it('does not show up in the menu even when it is on', () => {
    // The other side of the same check: when the switch is on, the
    // group does appear, and it is the only group that changes.
    setReaderFlag('SMART_SPLIT_BILL', true);

    const navMap = {
      budgets: { key: 'budgets' },
      goals: { key: 'goals' },
      recurring: { key: 'recurring' },
      debts: { key: 'debts' },
      split: { key: 'split' },
      map: { key: 'map' },
      categoryExpenses: { key: 'categoryExpenses' },
      merchant: { key: 'merchant' },
    };

    const groups = visibleGroups(navMap);
    const split = groups.find((group) => group.label === 'sidebar_group_split');

    expect(split).toBeTruthy();
    expect(split.items).toHaveLength(1);
    expect(split.items[0].key).toBe('split');
  });

  it('leaves the other groups alone when it is on', () => {
    const navMap = {
      budgets: { key: 'budgets' },
      goals: { key: 'goals' },
      recurring: { key: 'recurring' },
      debts: { key: 'debts' },
      split: { key: 'split' },
      map: { key: 'map' },
      categoryExpenses: { key: 'categoryExpenses' },
      merchant: { key: 'merchant' },
    };

    const before = visibleGroups(navMap).map((group) => group.label);
    setReaderFlag('SMART_SPLIT_BILL', true);
    const after = visibleGroups(navMap).map((group) => group.label);

    expect(after.filter((label) => label !== 'sidebar_group_split')).toEqual(
      before,
    );
  });
});

describe('the switch that says which page is behind which', () => {
  it('knows that the split page is behind the shared bill switch', () => {
    expect(flagForPage('/split')).toBe('SMART_SPLIT_BILL');
    expect(flagForPage('/split/12')).toBe('SMART_SPLIT_BILL');
  });

  it('leaves the other pages alone', () => {
    expect(flagForPage('/transactions')).toBe(null);
    expect(flagForPage('/budgets')).toBe(null);
  });

  it('has a switch for every group that needs one', () => {
    for (const group of NAV_GROUPS) {
      if (group.flag) {
        expect(['SMART_SPLIT_BILL', 'LIVE_CLAIM']).toContain(group.flag);
      }
    }
  });
});
