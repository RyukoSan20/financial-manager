/**
 * The shared bill, in the browser.
 *
 * These are the checks that the rounding adds up, that the proof of
 * a transfer is read the way a bank writes it, and that the guest
 * can claim their food from a link without an account.
 */

import { describe, it, expect } from 'vitest';
import {
  readAmountFromProof,
  parseIndonesianAmount,
  compareProof,
} from '../SettleUpModal';
import {
  equalShares,
  proportionalShares,
} from '../SplitMethodSelector';
import { batch9 } from '../../../i18n/keys_batch9';
import { inviteLink } from '../../../hooks/useLiveReceiptClaim';

describe('the money on a transfer receipt', () => {
  it('reads the amount the way a bank writes it', () => {
    const proof = [
      'Transfer Berhasil',
      'Nominal: Rp150.000',
      'Rekening Tujuan: 1234567890 BCA',
    ].join('\n');

    expect(readAmountFromProof(proof)).toBe(150000);
  });

  it('reads a number with a decimal part', () => {
    expect(readAmountFromProof('Total Transfer: Rp150.000,50')).toBe(150000.5);
  });

  it('reads the English way of writing it too', () => {
    expect(readAmountFromProof('Total: $1,500.25')).toBe(1500.25);
  });

  it('does not read the account number as the amount', () => {
    const proof = [
      'Transfer Berhasil',
      'Rekening Tujuan: 1234567890',
      'Nominal: Rp75.000',
    ].join('\n');

    expect(readAmountFromProof(proof)).toBe(75000);
  });

  it('reads a plain rupiah number', () => {
    expect(parseIndonesianAmount('150.000')).toBe(150000);
    expect(parseIndonesianAmount('150000')).toBe(150000);
    expect(parseIndonesianAmount('1.500.000')).toBe(1500000);
    expect(parseIndonesianAmount('54,50')).toBe(54.5);
  });

  it('knows when the proof says what it should', () => {
    expect(compareProof(150000, 150000).matches).toBe(true);
    expect(compareProof(150000, 150001).matches).toBe(false);
    expect(compareProof(null, 150000).matches).toBe(false);
  });
});

describe('the bill divided equally', () => {
  it('adds up to the whole, to the last rupiah', () => {
    const shares = equalShares(100000, 3);

    const total = shares.reduce((sum, value) => sum + value, 0);
    expect(total).toBeCloseTo(100000, 6);
  });

  it('gives one of them the extra rupiah', () => {
    // Rupiah has no sen, so the leftover is a whole rupiah.
    const shares = equalShares(100000, 3, 0);

    expect(shares).toContain(33334);
    expect(shares.filter((value) => value === 33333)).toHaveLength(2);
  });

  it('gives the extra cent to one of them when there is one', () => {
    const shares = equalShares(100, 3, 2);

    const total = shares.reduce((sum, value) => sum + value, 0);
    expect(total).toBeCloseTo(100, 6);
  });

  it('adds up for a bill in yen too', () => {
    const shares = equalShares(1000, 3);

    const total = shares.reduce((sum, value) => sum + value, 0);
    expect(total).toBeCloseTo(1000, 6);
  });
});

describe('the tax shared in proportion to what was eaten', () => {
  it('gives each person their food plus their share of the tax', () => {
    const items = [
      { id: 1, quantity: 1, total_price: 50000 },
      { id: 2, quantity: 1, total_price: 150000 },
    ];
    const claims = { 1: { a: 1 }, 2: { b: 1 } };

    const shares = proportionalShares(items, claims, {
      tax: 20000,
      service_charge: 0,
      discount: 40000,
      grand_total: 180000,
    });

    expect(shares.a).toBeCloseTo(45000, 2);
    expect(shares.b).toBeCloseTo(135000, 2);
  });
});

describe('the words for the shared bill', () => {
  it('is there in all three languages', () => {
    for (const language of ['id', 'en', 'ja']) {
      expect(batch9[language].split.title).toBeTruthy();
      expect(batch9[language].split.claim_your_items).toBeTruthy();
      expect(batch9[language].split.settle_up).toBeTruthy();
    }
  });

  it('has the same keys in all three languages', () => {
    const id = Object.keys(batch9.id.split).sort();
    const en = Object.keys(batch9.en.split).sort();
    const ja = Object.keys(batch9.ja.split).sort();

    expect(en).toEqual(id);
    expect(ja).toEqual(id);
  });
});

describe('the link a friend opens', () => {
  it('points at the claim page for the group', () => {
    const link = inviteLink('https://example.test', 'ABCD2345');

    expect(link).toBe('https://example.test/split/claim/ABCD2345');
  });

  it('is nothing when there is no code', () => {
    expect(inviteLink('https://example.test', '')).toBe('');
    expect(inviteLink('', 'ABCD2345')).toBe('');
  });
});
