/**
 * Sample receipt emails, and a small parser for them.
 *
 * This is the "try it without OAuth" path on the Gmail page: a guest
 * can see what the import reads out of a receipt email without
 * connecting an account. The real import runs on the server
 * (backend/app/modules/integrations/email_parser); this reads the same
 * kinds of lines - an amount in Rupiah, a merchant, a date - and saves
 * nothing.
 */

export const SAMPLE_EMAILS = Object.freeze([
  {
    from: 'BCA <bca@bca.co.id>',
    subject: 'Notifikasi Transaksi Debit BCA',
    body: 'Transaksi Debit\nTanggal : 14/11/2026 12:41\nMerchant : KOPI KENANGAN SUDIRMAN\nJumlah : Rp 38.000,00\nStatus : Berhasil',
  },
  {
    from: 'GoPay <no-reply@gojek.com>',
    subject: 'Pembayaran GoPay berhasil',
    body: 'Kamu membayar ke GoFood - Warung Nasi Bu Sri\nTotal pembayaran Rp45.500\n15 Nov 2026, 19:02',
  },
  {
    from: 'Mandiri <notifikasi@bankmandiri.co.id>',
    subject: 'Dana Masuk - Livin by Mandiri',
    body: 'Transfer masuk dari PT MAJU JAYA\nNominal: Rp 6.250.000\nTanggal: 01/11/2026\nKeterangan: Gaji November',
  },
  {
    from: 'ShopeePay <info@shopee.co.id>',
    subject: 'ShopeePay: Pembayaran Berhasil',
    body: 'Pembayaran ke Shopee Mall - Official Store sebesar Rp 129.900 telah berhasil pada 12-11-2026.',
  },
]);

const SOURCES = [
  ['bca', 'BCA'], ['mandiri', 'Mandiri'], ['bni', 'BNI'], ['bri', 'BRI'],
  ['gojek', 'GoPay'], ['gopay', 'GoPay'], ['ovo', 'OVO'], ['dana', 'DANA'], ['shopee', 'ShopeePay'],
];

/** "Rp 1.234.567,00" or "Rp45.500" -> 1234567 / 45500. */
export function parseRupiah(text) {
  const m = String(text || '').match(/Rp\.?\s*([\d.]+)(?:,(\d{1,2}))?/i);
  if (!m) return 0;
  return Number(m[1].replace(/\./g, '')) || 0;
}

export function parseSampleEmail({ from = '', subject = '', body = '' }) {
  const all = `${from}\n${subject}\n${body}`;
  const lower = all.toLowerCase();
  const source = (SOURCES.find(([needle]) => lower.includes(needle)) || [null, 'Email'])[1];
  const income = /(dana masuk|transfer masuk|kredit|gaji|diterima)/i.test(all);

  let merchant = '';
  const lines = [
    /merchant\s*:\s*(.+)/i,
    /membayar ke\s+(.+)/i,
    /pembayaran ke\s+(.+?)\s+sebesar/i,
    /transfer masuk dari\s+(.+)/i,
  ];
  for (const re of lines) {
    const m = body.match(re);
    if (m) { merchant = m[1].trim(); break; }
  }

  const date =
    (body.match(/(\d{2}[/-]\d{2}[/-]\d{4})/) || [])[1] ||
    (body.match(/(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})/) || [])[1] ||
    '';

  return { source, type: income ? 'income' : 'expense', amount: parseRupiah(body), merchant, date };
}
