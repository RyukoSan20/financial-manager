// Konstanta dan helper kecil untuk fitur papan belanja.

/**
 * The stages of the board.
 *
 * The seven stages, with the place of the ready one: a thing that has
 * been decided on but not yet bought. Without it the reader cannot
 * put a card in the third column, which is the column that says the
 * decision has been made.
 *
 * The words are here as a fallback only. The labels the reader sees
 * come from the words of the application, so that the three languages
 * stay in step.
 */
export const STAGES = [
  { key: 'wishlist', label: 'Wishlist', hint: 'Ingin, belum direncanakan' },
  { key: 'to_buy', label: 'Mau dibeli', hint: 'Sudah direncanakan' },
  { key: 'ready', label: 'Siap Checkout', hint: 'Sudah diputuskan, belum dibayar' },
  { key: 'ordered', label: 'Dipesan', hint: 'Sudah dibayar' },
  { key: 'shipped', label: 'Dikirim', hint: 'Dalam perjalanan' },
  { key: 'received', label: 'Diterima', hint: 'Selesai' },
  { key: 'cancelled', label: 'Batal', hint: 'Dibatalkan' },
];

export const STAGE_LABEL = Object.fromEntries(STAGES.map((s) => [s.key, s.label]));

const rupiah = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});
export const idr = (n) => (n == null ? '-' : rupiah.format(n));

// Tanggal "hari ini" menurut WIB, format YYYY-MM-DD (locale en-CA memberi format ISO).
export const wibDate = (d = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(d);
export const wibMonth = () => wibDate().slice(0, 7);
export const monthStart = () => `${wibDate().slice(0, 8)}01`;

// Tahan terhadap dua bentuk respons: array langsung atau { items | data }.
export const toList = (d) => (Array.isArray(d) ? d : d?.items ?? d?.data ?? []);

// Hanya http(s) yang boleh dijadikan tautan (cegah javascript: URL).
export const safeUrl = (u) => (typeof u === 'string' && /^https?:\/\//i.test(u) ? u : null);
