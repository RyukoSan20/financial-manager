import { useState, useEffect, useCallback } from 'react';
import { Receipt, Globe2, Scale, AlertTriangle, Download } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { batch12 } from '../../i18n/keys_batch12';
import { toast } from '../../contexts/ToastContext';
import merchantApi from '../../services/merchantApi';
import { formatCurrency } from '../../utils/format';

/**
 * The invoice, and the tax that goes with it.
 *
 * A warung owner never writes an invoice number. A freelance studio
 * writes one every month and has to say what the tax office took
 * before the money arrives. A company that sells across borders has to
 * say which currency the sale is in, which currency the book is in,
 * and which currency it will settle in.
 *
 * So this panel shows the fields that belong to the kind of shop, and
 * hides the rest. Which fields belong is decided by the server, and
 * the browser is told; it does not keep a copy of the rules, because
 * a copy drifts.
 */

function toNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = Number(String(value).replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function MerchantInvoicingPanel({ merchant, profile }) {
  const { language } = useTranslation();
  const K = batch12[language]?.merchant || batch12.id.merchant;

  const [transactions, setTransactions] = useState([]);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!merchant?.id) return;
    try {
      const [sales, taxRules] = await Promise.all([
        merchantApi.listBusinessTransactions(merchant.id, { limit: 50 }),
        merchantApi.listTaxRules().catch(() => []),
      ]);
      setTransactions(Array.isArray(sales) ? sales : []);
      setRules(Array.isArray(taxRules) ? taxRules : []);
    } catch {
      toast.error(K.invoicing.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [merchant?.id]);

  useEffect(() => {
    load();
  }, [load]);

  // The server says which fields belong to this kind of shop. The
  // browser asks, and does not decide on its own.
  const canSee = (field) => {
    const fields = profile?.capabilities?.fields;
    if (!fields || typeof fields !== 'object') return false;
    return Boolean(fields[field]?.shown);
  };

  const settings = profile?.settings || {};
  const mode = profile?.profile || 'UMKM';

  return (
    <section className="merchant-invoicing">
      <header className="merchant-invoicing__head">
        <div>
          <h3>{K.invoicing.title}</h3>
          <p>{K.invoicing.subtitle}</p>
        </div>
        <span className="merchant-invoicing__mode">{mode}</span>
      </header>

      {mode === 'CROSS_BORDER' && (
        <div className="merchant-invoicing__currencies">
          <Globe2 size={16} aria-hidden="true" />
          <div>
            <p>
              <strong>{K.invoicing.transactionCurrency}</strong>:{' '}
              {settings.transaction_currency || 'IDR'}
            </p>
            <p>
              <strong>{K.invoicing.functionalCurrency}</strong>:{' '}
              {settings.functional_currency || 'IDR'}
            </p>
            <p>
              <strong>{K.invoicing.settlementCurrency}</strong>:{' '}
              {settings.settlement_currency || 'IDR'}
            </p>
            {settings.default_exchange_rate ? (
              <p className="merchant-invoicing__rate">
                {K.invoicing.rate}: {String(settings.default_exchange_rate)} (
                {settings.exchange_rate_source || 'identity'})
              </p>
            ) : null}
          </div>
        </div>
      )}

      {mode === 'B2B' && (
        <div className="merchant-invoicing__terms">
          <Scale size={16} aria-hidden="true" />
          <p>
            {K.invoicing.paymentTerms}: {settings.payment_terms_days ?? 0} {K.invoicing.days}
          </p>
        </div>
      )}

      {canSee('withholding_tax') && (
        <div className="merchant-invoicing__withholding">
          <AlertTriangle size={16} aria-hidden="true" />
          <p>{K.invoicing.withholdingNote}</p>
        </div>
      )}

      {loading ? (
        <p className="merchant-invoicing__note">{K.invoicing.loading}</p>
      ) : transactions.length === 0 ? (
        <div className="merchant-invoicing__empty">
          <Receipt size={28} aria-hidden="true" />
          <p>{K.invoicing.noInvoices}</p>
        </div>
      ) : (
        <ul className="merchant-invoicing__list">
          {transactions.map((sale) => (
            <li key={sale.id} className="merchant-invoicing__invoice">
              <div className="merchant-invoicing__invoice-head">
                <strong>{sale.invoice_number}</strong>
                <span>{sale.invoice_type}</span>
                <span className={`is-${sale.payment_status}`}>{sale.payment_status}</span>
              </div>

              <ul className="merchant-invoicing__lines">
                {(sale.items || []).map((item) => (
                  <li key={item.id}>
                    <span>{item.item_name}</span>
                    <span>
                      {item.quantity} {item.unit_of_measure} ×{' '}
                      {formatCurrency(toNumber(item.unit_price))}
                    </span>
                    <span>{formatCurrency(toNumber(item.net_item_amount))}</span>
                  </li>
                ))}
              </ul>

              <dl className="merchant-invoicing__totals">
                <div>
                  <dt>{K.invoicing.subtotal}</dt>
                  <dd>{formatCurrency(toNumber(sale.subtotal_gross))}</dd>
                </div>
                {(sale.taxes || []).map((tax) => (
                  <div key={tax.id}>
                    <dt>
                      {tax.tax_code} ({String(toNumber(tax.tax_rate))}%)
                    </dt>
                    <dd>{formatCurrency(toNumber(tax.tax_amount))}</dd>
                  </div>
                ))}
                {toNumber(sale.total_withholding_tax) > 0 && (
                  <div className="is-withheld">
                    <dt>{K.invoicing.withheld}</dt>
                    <dd>− {formatCurrency(toNumber(sale.total_withholding_tax))}</dd>
                  </div>
                )}
                <div className="is-grand">
                  <dt>{K.invoicing.total}</dt>
                  <dd>{formatCurrency(toNumber(sale.grand_total))}</dd>
                </div>
                {toNumber(sale.net_receivable_amount) !== toNumber(sale.grand_total) && (
                  <div>
                    <dt>{K.invoicing.receivable}</dt>
                    <dd>{formatCurrency(toNumber(sale.net_receivable_amount))}</dd>
                  </div>
                )}
              </dl>
            </li>
          ))}
        </ul>
      )}

      {rules.length > 0 && (
        <details className="merchant-invoicing__rules">
          <summary>{K.invoicing.rulesTitle}</summary>
          <ul>
            {rules.map((rule) => (
              <li key={rule.id}>
                <span>
                  {rule.country_code}
                  {rule.state_code ? `-${rule.state_code}` : ''} · {rule.tax_code}
                </span>
                <span>
                  {String(toNumber(rule.nominal_rate))}% · {rule.tax_behavior}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
