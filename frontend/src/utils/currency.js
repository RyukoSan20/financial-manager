/**
 * The currency the whole app shows money in.
 *
 * The language and the currency are two separate choices. Picking
 * Japanese does not change the money into yen, and picking a display
 * currency does not change the language.
 *
 * The amounts in the database stay in the currency they were entered
 * in. This module turns one into another for the display, using the
 * live rates from the server, and says plainly when a rate could not
 * be fetched, so a wrong number is never shown under a symbol it does
 * not belong to.
 */

import { useState, useEffect, useSyncExternalStore } from 'react';
import api from '../services/api';

const STORAGE_KEY = 'displayCurrency';
const RATES_KEY = 'currency_rates_cache';
const RATES_TTL = 60 * 60 * 1000; // one hour

/**
 * The currencies on offer, and how each one is written.
 *
 * The number of decimals and the way the digits are grouped follow the
 * currency, not the language: a yen amount has no cents, and a rupiah
 * amount is grouped with a dot.
 */
export const CURRENCIES = {
  IDR: { symbol: 'Rp', decimals: 0, group: '.', decimal: ',' },
  USD: { symbol: '$', decimals: 2, group: ',', decimal: '.' },
  EUR: { symbol: '€', decimals: 2, group: ',', decimal: '.' },
  JPY: { symbol: '¥', decimals: 0, group: ',', decimal: '.' },
  GBP: { symbol: '£', decimals: 2, group: ',', decimal: '.' },
  AUD: { symbol: 'A$', decimals: 2, group: ',', decimal: '.' },
  SGD: { symbol: 'S$', decimals: 2, group: ',', decimal: '.' },
  MYR: { symbol: 'RM', decimals: 2, group: ',', decimal: '.' },
  CNY: { symbol: 'CN¥', decimals: 2, group: ',', decimal: '.' },
  INR: { symbol: '₹', decimals: 2, group: ',', decimal: '.' },
  THB: { symbol: '฿', decimals: 2, group: ',', decimal: '.' },
  PHP: { symbol: '₱', decimals: 2, group: ',', decimal: '.' },
  KRW: { symbol: '₩', decimals: 0, group: ',', decimal: '.' },
  VND: { symbol: '₫', decimals: 0, group: ',', decimal: '.' },
  HKD: { symbol: 'HK$', decimals: 2, group: ',', decimal: '.' },
  CAD: { symbol: 'C$', decimals: 2, group: ',', decimal: '.' },
  CHF: { symbol: 'Fr', decimals: 2, group: ',', decimal: '.' },
  NZD: { symbol: 'NZ$', decimals: 2, group: ',', decimal: '.' },
  SEK: { symbol: 'kr', decimals: 2, group: ',', decimal: '.' },
  NOK: { symbol: 'kr', decimals: 2, group: ',', decimal: '.' },
  DKK: { symbol: 'kr', decimals: 2, group: ',', decimal: '.' },
  MXN: { symbol: 'MX$', decimals: 2, group: ',', decimal: '.' },
  BRL: { symbol: 'R$', decimals: 2, group: ',', decimal: '.' },
  ZAR: { symbol: 'R', decimals: 2, group: ',', decimal: '.' },
};

export const CURRENCY_CODES = Object.keys(CURRENCIES);

export function currencyConfig(code) {
  return CURRENCIES[code] || CURRENCIES.IDR;
}

/**
 * The store.
 *
 * It lives outside React on purpose: the formatting helpers are
 * imported by twenty files as plain functions, not as hooks, and they
 * all need the current currency and the current rates.
 */
class CurrencyStore {
  constructor() {
    this.currency = this.readStoredCurrency();
    this.rates = {};
    this.ratesAsOf = null;
    this.ratesSource = null;
    this.loading = false;
    this.error = null;
    this.listeners = new Set();
    this.fetchedAt = 0;
    this.fetching = null;
    // True when the browser has been changed but the server has not
    // taken it yet.
    this.dirty = false;
  }

  readStoredCurrency() {
    if (typeof window === 'undefined') return 'IDR';
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved && CURRENCIES[saved] ? saved : 'IDR';
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getSnapshot() {
    return this.version || 0;
  }

  notify() {
    this.version = (this.version || 0) + 1;
    this.listeners.forEach((l) => l());
  }

  setCurrency(code) {
    const next = (code || 'IDR').toUpperCase();
    if (!CURRENCIES[next] || next === this.currency) return;
    this.currency = next;
    this.dirty = true;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
    this.notify();
    this.pushToServer(next);
  }

  /**
   * Keep the currency on the server, so it follows the user to
   * another device.
   *
   * A change is sent on its own, and a pull happens when the page
   * opens. The server copy only wins when the browser has not been
   * changed locally since the last pull, so a change made here is not
   * undone by an older copy from the server.
   */
  async pushToServer(code) {
    if (typeof window === 'undefined') return;
    try {
      const { api } = await import('../services/api');
      const settings = await api.request('/settings/app');
      if (!settings) return;
      const stored = settings.preferences || {};
      if (stored.displayCurrency === code) return;
      await api.request('/settings/app', {
        method: 'PUT',
        body: JSON.stringify({
          preferences: { ...stored, displayCurrency: code },
        }),
      });
    } catch {
      // The change stays in the browser. It is sent again the next
      // time the currency is changed, or when the page is opened.
      this.pendingSync = code;
    }
  }

  /**
   * Take the currency from the server, if the browser has not been
   * changed since the last pull.
   */
  async pullFromServer() {
    if (typeof window === 'undefined') return;
    try {
      const { api } = await import('../services/api');
      const settings = await api.request('/settings/app');
      if (!settings) return;
      const stored = settings.preferences || {};
      const incoming = stored.displayCurrency;
      if (!incoming || !CURRENCIES[incoming]) return;
      if (this.dirty) return;
      if (incoming === this.currency) return;
      this.currency = incoming;
      window.localStorage.setItem(STORAGE_KEY, incoming);
      this.notify();
    } catch {
      // Offline. The browser copy stands.
    }
  }

  /** The rates, from the cache when they are still fresh. */
  readCache() {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(RATES_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.rates) return null;
      if (Date.now() - (parsed.fetchedAt || 0) > RATES_TTL) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  writeCache() {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(
        RATES_KEY,
        JSON.stringify({
          rates: this.rates,
          asOf: this.ratesAsOf,
          source: this.ratesSource,
          fetchedAt: this.fetchedAt,
        }),
      );
    } catch {
      // A full or blocked storage is not a reason to break the page.
    }
  }

  async loadRates(force = false) {
    const cached = this.readCache();
    if (cached && !force) {
      this.rates = cached.rates;
      this.ratesAsOf = cached.asOf;
      this.ratesSource = cached.source;
      this.fetchedAt = cached.fetchedAt;
      this.notify();
    }

    if (!force && this.fetchedAt && Date.now() - this.fetchedAt < RATES_TTL) {
      return this.rates;
    }

    // One request at a time. Switching the currency a few times in a
    // row must not turn into a few round trips.
    if (this.fetching) return this.fetching;

    this.loading = true;
    this.notify();

    this.fetching = api
      .get('/currency/rates?base=IDR')
      .then((data) => {
        const payload = data?.data || data;
        this.rates = payload?.rates || {};
        this.ratesAsOf = payload?.as_of || null;
        this.ratesSource = payload?.source || null;
        this.fetchedAt = Date.now();
        this.error = null;
        this.writeCache();
        return this.rates;
      })
      .catch((err) => {
        this.error = err?.message || 'Could not fetch the exchange rates';
        throw err;
      })
      .finally(() => {
        this.loading = false;
        this.fetching = null;
        this.notify();
      });

    return this.fetching;
  }

  /**
   * How many of the target currency one of the source is worth.
   *
   * The rates read "how many units of X for one rupiah", so the figure
   * for a pair is the target's rate divided by the source's rate.
   *
   * Null when the pair cannot be worked out, so the caller can leave
   * the amount in its own currency rather than show a wrong number.
   */
  rate(from, to) {
    const src = (from || 'IDR').toUpperCase();
    const dst = (to || 'IDR').toUpperCase();
    if (src === dst) return 1;

    const srcRate = this.rates[src];
    const dstRate = this.rates[dst];
    if (!srcRate || !dstRate) return null;

    return dstRate / srcRate;
  }

  /**
   * Turn an amount into the display currency.
   *
   * Returns null when there is no rate, so the caller can show the
   * amount in its own currency instead of a wrong one.
   */
  convert(amount, from) {
    const src = (from || 'IDR').toUpperCase();
    const rate = this.rate(src, this.currency);
    if (rate === null) return null;
    const value = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
    if (!Number.isFinite(value)) return null;
    return value * rate;
  }

  /**
   * Write a number the way its currency is written.
   */
  static format(value, code) {
    const config = currencyConfig(code);
    const num = Number(value);
    if (!Number.isFinite(num)) return '0';

    const fixed = num.toFixed(config.decimals);
    const [whole, fraction] = fixed.split('.');
    const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, config.group);
    return fraction ? `${grouped}${config.decimal}${fraction}` : grouped;
  }
}

export const currencyStore = new CurrencyStore();

/**
 * The hook.
 *
 * It gives the same thing the store has, and re-renders the component
 * when the store changes.
 */
export function useCurrency() {
  useSyncExternalStore(
    (listener) => currencyStore.subscribe(listener),
    () => currencyStore.getSnapshot(),
    () => currencyStore.getSnapshot(),
  );

  const [, force] = useState(0);
  useEffect(() => {
    const listener = () => force((n) => n + 1);
    currencyStore.subscribe(listener);
    currencyStore.loadRates().catch(() => {});
    currencyStore.pullFromServer().catch(() => {});
    return () => currencyStore.unsubscribe?.(listener);
  }, []);

  return {
    currency: currencyStore.currency,
    setCurrency: (code) => currencyStore.setCurrency(code),
    rates: currencyStore.rates,
    ratesAsOf: currencyStore.ratesAsOf,
    ratesSource: currencyStore.ratesSource,
    loading: currencyStore.loading,
    error: currencyStore.error,
    convert: (amount, from) => currencyStore.convert(amount, from),
    rate: (from, to) => currencyStore.rate(from, to),
    format: (amount, from, options = {}) =>
      formatCurrency(amount, from, options),
    refreshRates: () => currencyStore.loadRates(true).catch(() => {}),
  };
}

/**
 * Show an amount in the display currency.
 *
 * The second argument is the currency the amount is already in, which
 * is the currency of the record it came from. When it is left out the
 * amount is read in rupiah, which is what most of the app stores.
 *
 * When there is no rate for the pair, the amount is shown in its own
 * currency with a marker, never as a wrong number under a symbol it
 * does not belong to.
 */
export function formatCurrency(amount, from, options = {}) {
  const { showSymbol = true, decimals, suffix = '' } = options;

  if (amount === null || amount === undefined || amount === '') return '-';

  const source = (from || 'IDR').toUpperCase();
  const target = currencyStore.currency;
  const value = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
  if (!Number.isFinite(value)) return '-';

  const converted = currencyStore.convert(value, source);

  if (converted === null) {
    // No rate. Show the amount in the currency it is actually in, and
    // say so, rather than showing a wrong number.
    const config = currencyConfig(source);
    const text = CurrencyStore.format(value, source);
    const marked = `${showSymbol ? `${config.symbol} ` : ''}${text}${suffix}`;
    return `${marked} ⚠`;
  }

  const config = currencyConfig(target);
  const digits = decimals === undefined ? config.decimals : decimals;
  const text = CurrencyStore.format(converted, target);
  return `${showSymbol ? `${config.symbol} ` : ''}${text}${suffix}`;
}

/**
 * Show an amount in the currency it is already in, with no conversion.
 *
 * Used where the original currency matters, such as a transfer that
 * crossed two currencies.
 */
/**
 * Add up amounts that may be in different currencies.
 *
 * Each amount is converted into the currency that is on display first,
 * and only then are they added. Adding the raw numbers would give a
 * figure that means nothing, because a yen and a rupiah are not the
 * same thing.
 *
 * The second argument names the field that holds the currency of each
 * record, for example "currency".
 */
export function sumInDisplay(items, amountKey, currencyKey = 'currency') {
  const total = { value: 0, converted: true };
  for (const item of items || []) {
    const raw = item?.[amountKey];
    const value = typeof raw === 'string' ? parseFloat(raw) : Number(raw);
    if (!Number.isFinite(value)) continue;
    const code = item?.[currencyKey] || 'IDR';
    const converted = currencyStore.convert(value, code);
    if (converted === null) {
      // Without a rate the amount cannot be brought over. It is left
      // out rather than counted at the wrong value.
      total.converted = false;
      continue;
    }
    total.value += converted;
  }
  return total.value;
}

export function formatNative(amount, code, options = {}) {
  const { showSymbol = true, suffix = '' } = options;
  if (amount === null || amount === undefined || amount === '') return '-';

  const currency = (code || 'IDR').toUpperCase();
  const value = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
  if (!Number.isFinite(value)) return '-';

  const config = currencyConfig(currency);
  const text = CurrencyStore.format(value, currency);
  return `${showSymbol ? `${config.symbol} ` : ''}${text}${suffix}`;
}

/**
 * A plain number, written the way the display currency is written.
 */
export function formatNumber(value) {
  if (value === null || value === undefined || value === '') return '-';
  const num = Number(value);
  if (!Number.isFinite(num)) return '-';
  return CurrencyStore.format(num, currencyStore.currency);
}

export default currencyStore;
