import { useState, useEffect, useCallback, useMemo } from 'react';
import { BookOpen, TrendingUp, Wallet, Receipt, Percent } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { batch12 } from '../../i18n/keys_batch12';
import { toast } from '../../contexts/ToastContext';
import merchantApi from '../../services/merchantApi';
import { formatCurrency } from '../../utils/format';

/**
 * The book of the shop.
 *
 * A warung owner wants one number: how much came in today, and how
 * much of it is still in the drawer. A studio wants the tax broken
 * out, because the tax office asks about it. A company that sells
 * across borders wants to see the money in three currencies and know
 * which one it really is.
 *
 * So the report is drawn from the sales that are already in the books,
 * and it says plainly which currency each figure is in.
 */

function toNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = Number(String(value).replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function MerchantReportPanel({ merchant, profile }) {
  const { language } = useTranslation();
  const K = batch12[language]?.merchant || batch12.id.merchant;

  const [summary, setSummary] = useState(null);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!merchant?.id) return;
    try {
      const [day, list] = await Promise.all([
        merchantApi.getSummary(merchant.id).catch(() => null),
        merchantApi.listBusinessTransactions(merchant.id, { limit: 200 }),
      ]);
      setSummary(day);
      setSales(Array.isArray(list) ? list : []);
    } catch {
      toast.error(K.report.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [merchant?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const currency = profile?.settings?.transaction_currency || 'IDR';

  // What the tax came to, broken out by the rule that made it.
  const taxByCode = useMemo(() => {
    const totals = new Map();
    for (const sale of sales) {
      for (const tax of sale.taxes || []) {
        const key = tax.tax_code || tax.tax_type || 'TAX';
        const current = totals.get(key) || { amount: 0, rate: tax.tax_rate, behavior: tax.tax_behavior };
        current.amount += toNumber(tax.tax_amount);
        totals.set(key, current);
      }
    }
    return [...totals.entries()].sort((a, b) => b[1].amount - a[1].amount);
  }, [sales]);

  const gross = useMemo(
    () => sales.reduce((sum, sale) => sum + toNumber(sale.subtotal_gross), 0),
    [sales]
  );
  const taxTotal = useMemo(
    () => sales.reduce((sum, sale) => sum + toNumber(sale.total_tax_additive), 0),
    [sales]
  );
  const withheld = useMemo(
    () => sales.reduce((sum, sale) => sum + toNumber(sale.total_withholding_tax), 0),
    [sales]
  );
  const outstanding = useMemo(
    () => sales.reduce((sum, sale) => sum + toNumber(sale.outstanding_amount), 0),
    [sales]
  );

  const best = useMemo(() => {
    if (!sales.length) return null;
    return [...sales].sort(
      (a, b) => toNumber(b.grand_total) - toNumber(a.grand_total)
    )[0];
  }, [sales]);

  if (loading) {
    return <p className="merchant-report__note">{K.report.loading}</p>;
  }

  return (
    <section className="merchant-report">
      <header className="merchant-report__head">
        <BookOpen size={18} aria-hidden="true" />
        <div>
          <h3>{K.report.title}</h3>
          <p>{K.report.subtitle}</p>
        </div>
      </header>

      <div className="merchant-report__cards">
        <div className="merchant-report__card">
          <TrendingUp size={16} aria-hidden="true" />
          <span>{K.report.todaySales}</span>
          <strong>{formatCurrency(toNumber(summary?.today_sales))}</strong>
        </div>
        <div className="merchant-report__card">
          <Wallet size={16} aria-hidden="true" />
          <span>{K.report.qris}</span>
          <strong>{formatCurrency(toNumber(summary?.total_qris))}</strong>
        </div>
        <div className="merchant-report__card">
          <Wallet size={16} aria-hidden="true" />
          <span>{K.report.cash}</span>
          <strong>{formatCurrency(toNumber(summary?.total_cash))}</strong>
        </div>
        <div className="merchant-report__card">
          <Receipt size={16} aria-hidden="true" />
          <span>{K.report.transactions}</span>
          <strong>{toNumber(summary?.today_transactions)}</strong>
        </div>
      </div>

      <div className="merchant-report__totals">
        <p>
          <span>{K.report.grossSales}</span>
          <strong>{formatCurrency(gross)}</strong>
        </p>
        <p>
          <span>{K.report.taxCollected}</span>
          <strong>{formatCurrency(taxTotal)}</strong>
        </p>
        {withheld > 0 && (
          <p className="is-withheld">
            <span>{K.report.withheld}</span>
            <strong>− {formatCurrency(withheld)}</strong>
          </p>
        )}
        {outstanding > 0 && (
          <p className="is-outstanding">
            <span>{K.report.outstanding}</span>
            <strong>{formatCurrency(outstanding)}</strong>
          </p>
        )}
      </div>

      {taxByCode.length > 0 && (
        <div className="merchant-report__tax">
          <h4>
            <Percent size={14} aria-hidden="true" />
            <span>{K.report.taxBreakdown}</span>
          </h4>
          <ul>
            {taxByCode.map(([code, info]) => (
              <li key={code}>
                <span>{code}</span>
                <span>
                  {String(toNumber(info.rate))}% · {formatCurrency(info.amount)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {best && (
        <p className="merchant-report__best">
          {K.report.biggestSale}: <strong>{best.invoice_number}</strong> —{' '}
          {formatCurrency(toNumber(best.grand_total))}
        </p>
      )}

      <p className="merchant-report__currency">{K.report.currencyNote}: {currency}</p>
    </section>
  );
}
