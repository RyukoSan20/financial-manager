/**
 * The reading of a sentence, worked out in the browser.
 *
 * This is the fallback for a reader who is offline, and for a server
 * that cannot be reached. It is deliberately simple: it finds the
 * amount, the kind of transaction, and the things that were bought.
 * It does not match accounts, because the browser does not always
 * know them.
 *
 * It lives on its own, without the network in it, so it can be
 * tested by running it.
 */

import { emptyReading } from './shape.js';

export {
  emptyReading,
  emptyReading as default,
};

/**
 * The words that join two things together.
 */
const JOIN_WORDS = ['sama', 'dan', 'plus', 'kemudian', 'lalu'];

/**
 * The words that say the money is coming in.
 */
const INCOME_WORDS = [
  'gajian', 'gaji', 'masuk', 'terima', 'dapat', 'bonus', 'refund',
  'ganti', 'cashback', 'reimburse', 'dibayar',
];

/**
 * The words that say the money is moving between accounts.
 */
const TRANSFER_WORDS = ['transfer', 'tarik', 'setor', 'pindah', 'kirim', 'top up', 'topup'];

/**
 * The words that are never part of a name.
 */
const NOISE_WORDS = [
  'yang', 'dengan', 'untuk', 'pada', 'saya', 'aku', 'kamu', 'sudah',
  'telah', 'baru', 'lagi', 'aja', 'saja', 'dong', 'sih', 'kok', 'ya',
  'tanggal', 'catatan', 'harga', 'harganya', 'total', 'semua',
  // The word that starts the sentence is not the name of what was
  // bought. "beli kopi susu" is a coffee, not a shop called "Beli".
  'beli', 'buy', 'makan', 'minum', 'order', 'pesan',
];

/**
 * The words that say where something happened.
 */
const PLACE_WORDS = ['di', 'ke', 'dari', 'at', 'in'];

/**
 * A rupiah amount, written out.
 *
 * "15.000" is fifteen thousand, because the dot separates thousands.
 * "8,5jt" is eight and a half million.
 */
const toNumber = (raw) => {
  const text = String(raw || '').trim();
  if (!text) return null;
  let cleaned = text;
  if (cleaned.includes('.') && cleaned.includes(',')) {
    cleaned =
      cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')
        ? cleaned.replace(/\./g, '').replace(',', '.')
        : cleaned.replace(/,/g, '');
  } else if (cleaned.includes('.')) {
    const [, tail] = cleaned.split('.');
    cleaned = tail && tail.length === 3 ? cleaned.replace(/\./g, '') : cleaned;
  } else if (cleaned.includes(',')) {
    const [, tail] = cleaned.split(',');
    cleaned = tail && tail.length === 3 ? cleaned.replace(/,/g, '') : cleaned.replace(',', '.');
  }
  const value = parseFloat(cleaned);
  return Number.isFinite(value) ? value : null;
};

const MONEY = /(?:rp\.?\s*|@\s*)?(\d[\d.,]*)\s*(k|rb|ribu|jt|juta)?(?![a-z])/gi;
const SCALE = { '': 1, k: 1000, rb: 1000, ribu: 1000, jt: 1000000, juta: 1000000 };

const titleCase = (text) =>
  String(text || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => (word === word.toLowerCase() ? word[0].toUpperCase() + word.slice(1) : word))
    .join(' ');

/**
 * The amount of a written phrase.
 */
const amountOf = (text) => {
  let best = null;
  let match;
  MONEY.lastIndex = 0;
  while ((match = MONEY.exec(text)) !== null) {
    const value = toNumber(match[1]);
    if (value === null) continue;
    const amount = value * (SCALE[String(match[2] || '').toLowerCase()] || 1);
    if (amount > 0) best = amount;
  }
  return best;
};

/**
 * The reading, worked out in the browser.
 */
export const localReading = (text) => {
  const sentence = String(text || '').trim();
  const reading = emptyReading();
  reading.raw_text = sentence;

  const lowered = sentence.toLowerCase();

  // The kind.
  const isTransfer = TRANSFER_WORDS.some((word) => lowered.includes(word));
  const isIncome = INCOME_WORDS.some((word) => lowered.includes(word));
  reading.type = isTransfer && !isIncome ? 'transfer' : isIncome ? 'income' : 'expense';

  // The amount.
  reading.total_amount = amountOf(sentence) || 0;

  // The things that were bought. The sentence is cut at the joining
  // words, and each part is read on its own.
  const parts = sentence
    .split(new RegExp(`\\b(${JOIN_WORDS.join('|')})\\b`, 'i'))
    .map((part) => part.trim())
    .filter(Boolean);

  for (const part of parts) {
    // Every amount written in the part.
    //
    // The count and the price are both numbers, so they are told
    // apart by how big they are: a count is small, a price is not.
    // "2 kopi susu 18rb" is two coffees at eighteen thousand, not one
    // thing at two rupiah.
    const found = [];
    let match;
    MONEY.lastIndex = 0;
    while ((match = MONEY.exec(part)) !== null) {
      const value = toNumber(match[1]);
      if (value === null) continue;
      const amount = value * (SCALE[String(match[2] || '').toLowerCase()] || 1);
      found.push({ amount, scaled: Boolean(match[2]), start: match.index });
    }

    // The price is the last amount that is big enough to be a price.
    const prices = found.filter(
      (entry) => entry.scaled || entry.amount >= 1000
    );
    if (!prices.length) continue;

    const price = prices[prices.length - 1];
    const unitPrice = price.amount;

    // The count is the last small number before the price.
    //
    // "beli 2 kopi susu @18rb" is two coffees. The two is written
    // before the name rather than after it, so it is looked for
    // everywhere before the price rather than at the end.
    const before = part.slice(0, price.start);
    const small = found.filter(
      (entry) => entry.start < price.start && !entry.scaled && entry.amount < 1000
    );
    const count = small.length ? small[small.length - 1].amount : 1;
    const quantity = count > 0 ? count : 1;

    const name = before
      .replace(/\d+/g, ' ')
      .split(/\s+/)
      .filter((word) => word && !NOISE_WORDS.includes(word.toLowerCase()))
      .filter((word) => !PLACE_WORDS.includes(word.toLowerCase()))
      .join(' ');

    if (!name) continue;

    reading.items.push({
      name: titleCase(name),
      quantity,
      unit_price: unitPrice,
      subtotal: quantity * unitPrice,
      variant_or_note: null,
      category: null,
    });
  }

  if (reading.items.length) {
    reading.total_amount = reading.items.reduce((sum, item) => sum + item.subtotal, 0);
    if (reading.items.length === 1) reading.merchant = reading.items[0].name;
  }

  reading.description = reading.merchant || '';
  reading.confidence = reading.total_amount ? 0.6 : 0.2;
  return reading;
};
