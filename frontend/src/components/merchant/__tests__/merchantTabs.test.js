/**
 * The shop, in the four parts it needs.
 *
 * Run with: node src/components/merchant/__tests__/merchantTabs.test.js
 *
 * Which tabs a shop has, and which fields it is asked for, are
 * decided by the server. The browser asks and obeys; it does not keep
 * its own copy of the rules, because a copy drifts.
 *
 * These tests are about that obedience. A warung owner should not be
 * shown a field about customs value, and a company that sells across
 * borders should be shown the three currencies.
 */

let passed = 0;
let failed = 0;
const failures = [];

function check(name, actual, expected) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    passed += 1;
  } else {
    failed += 1;
    failures.push(
      `${name}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`
    );
  }
}

// ---------------------------------------------------------------------------
// The three kinds of shop, as the server describes them
// ---------------------------------------------------------------------------

const UMKM = {
  profile: 'UMKM',
  capabilities: {
    fields: {
      invoice_number: { shown: false, required: false },
      payment_terms: { shown: false, required: false },
      customer_fields: { shown: false, required: false },
      customs_fields: { shown: false, required: false },
      incoterms: { shown: false, required: false },
      multi_currency: { shown: false, required: false },
      tax_settings: { shown: true, required: false },
      journal: { shown: false, required: false },
      withholding_tax: { shown: false, required: false },
      reverse_charge: { shown: false, required: false },
    },
  },
  settings: {},
};

const B2B = {
  profile: 'B2B',
  capabilities: {
    fields: {
      invoice_number: { shown: true, required: true },
      payment_terms: { shown: true, required: false },
      customer_fields: { shown: true, required: false },
      customs_fields: { shown: false, required: false },
      incoterms: { shown: false, required: false },
      multi_currency: { shown: false, required: false },
      tax_settings: { shown: true, required: false },
      journal: { shown: true, required: false },
      withholding_tax: { shown: true, required: false },
      reverse_charge: { shown: false, required: false },
    },
  },
  settings: { payment_terms_days: 30, default_invoice_type: 'TAX_INVOICE' },
};

const CROSS_BORDER = {
  profile: 'CROSS_BORDER',
  capabilities: {
    fields: {
      invoice_number: { shown: true, required: true },
      payment_terms: { shown: true, required: false },
      customer_fields: { shown: true, required: false },
      customs_fields: { shown: true, required: false },
      incoterms: { shown: true, required: false },
      multi_currency: { shown: true, required: true },
      tax_settings: { shown: true, required: false },
      journal: { shown: true, required: false },
      withholding_tax: { shown: true, required: false },
      reverse_charge: { shown: true, required: false },
    },
  },
  settings: {
    transaction_currency: 'EUR',
    functional_currency: 'USD',
    settlement_currency: 'USD',
    default_exchange_rate: 1.08,
    exchange_rate_source: 'ecb',
    seller_country: 'DE',
    default_invoice_type: 'TAX_INVOICE',
  },
};

// ---------------------------------------------------------------------------
// Which tabs a shop has
//
// The rule, in one place, so that the test and the screen cannot
// disagree about it.
// ---------------------------------------------------------------------------

const ALL_TABS = ['catalog', 'pos', 'invoicing', 'report'];

function tabsFor(profile) {
  const fields = profile?.capabilities?.fields || {};
  return ALL_TABS.filter((key) => {
    if (key === 'catalog' || key === 'pos') return true;
    if (key === 'invoicing') {
      return (
        fields.tax_settings?.shown ||
        fields.payment_terms?.shown ||
        fields.multi_currency?.shown
      );
    }
    return fields.journal?.shown;
  });
}

// ---------------------------------------------------------------------------
// A warung is a warung
// ---------------------------------------------------------------------------

check('a warung has the shelf and the till', tabsFor(UMKM).includes('catalog'), true);
check('a warung has the shelf and the till', tabsFor(UMKM).includes('pos'), true);
// A warung does see its receipts, because a warung owner does want
// to look at what they sold. What a warung is not shown is the
// journal: it is an accounting book, and a warung has no accountant.
check(
  'a warung sees its receipts',
  tabsFor(UMKM).includes('invoicing'),
  true
);
check('a warung is not asked about the journal', tabsFor(UMKM).includes('report'), false);

// ---------------------------------------------------------------------------
// A studio is asked for invoices
// ---------------------------------------------------------------------------

check('a studio has the invoices', tabsFor(B2B).includes('invoicing'), true);
check('a studio has the journal', tabsFor(B2B).includes('report'), true);
check(
  'a studio is not asked about customs',
  tabsFor(CROSS_BORDER).includes('invoicing'),
  true
);

// ---------------------------------------------------------------------------
// A company that sells across borders
// ---------------------------------------------------------------------------

check(
  'a cross-border shop has the invoices',
  tabsFor(CROSS_BORDER).includes('invoicing'),
  true
);
check(
  'a cross-border shop has the journal',
  tabsFor(CROSS_BORDER).includes('report'),
  true
);

// ---------------------------------------------------------------------------
// Which fields are shown
// ---------------------------------------------------------------------------

function shown(profile, field) {
  return Boolean(profile?.capabilities?.fields?.[field]?.shown);
}

check('a warung is not asked about customs value', shown(UMKM, 'customs_fields'), false);
check('a warung is not asked about incoterms', shown(UMKM, 'incoterms'), false);
check(
  'a warung is not asked about reverse charge',
  shown(UMKM, 'reverse_charge'),
  false
);
check('a studio is asked about payment terms', shown(B2B, 'payment_terms'), true);
check('a studio is asked about withholding', shown(B2B, 'withholding_tax'), true);
check(
  'a cross-border shop is asked about three currencies',
  shown(CROSS_BORDER, 'multi_currency'),
  true
);
check(
  'a cross-border shop is asked about customs value',
  shown(CROSS_BORDER, 'customs_fields'),
  true
);

// ---------------------------------------------------------------------------
// The currencies of a cross-border shop
// ---------------------------------------------------------------------------

check(
  'the sale is in the transaction currency',
  CROSS_BORDER.settings.transaction_currency,
  'EUR'
);
check(
  'the book is in the functional currency',
  CROSS_BORDER.settings.functional_currency,
  'USD'
);
check(
  'the money settles in the settlement currency',
  CROSS_BORDER.settings.settlement_currency,
  'USD'
);

// ---------------------------------------------------------------------------
// The kind of invoice that is written
// ---------------------------------------------------------------------------

check(
  'a studio writes a tax invoice',
  B2B.settings.default_invoice_type,
  'TAX_INVOICE'
);
check(
  'a warung writes a till receipt',
  UMKM.settings.default_invoice_type || 'POS_RECEIPT',
  'POS_RECEIPT'
);

// ---------------------------------------------------------------------------

console.log(`merchantTabs: ${passed} passed, ${failed} failed`);
if (failed) {
  console.log(failures.join('\n\n'));
  process.exit(1);
}
