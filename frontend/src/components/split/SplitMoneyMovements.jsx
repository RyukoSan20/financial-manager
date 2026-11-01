/**
 * The money that is owed back, and the money that came back.
 *
 * The reader has a debts page. On it are the loans they took out and
 * the loans they gave. The money that a shared bill left on loan is
 * neither of those, and it is not a transaction either, because money
 * on loan is not spending.
 *
 * So it appears nowhere. The reader has to remember it, or ask.
 *
 * This is where it appears. It is a separate section rather than a
 * row in the debt list, because a loan the reader is paying back and
 * money the reader is owed back are two different things, and adding
 * them into one list would say something that is not true.
 *
 * The section only shows when the shared bill switch is on. A reader
 * who has never switched it on sees the page exactly as it was.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { Card } from '../ui';
import { formatCurrency } from '../../utils/format';
import api from '../../services/api';
import { useTranslation } from '../../i18n';
import { useCurrency } from '../../utils/currency';
import { batch9, fill } from '../../i18n/keys_batch9';

export const SplitMoneyMovements = () => {
  const { language } = useTranslation();
  const { currency: displayCurrency } = useCurrency();
  const K = batch9[language]?.split || batch9.id.split;

  const [receivables, setReceivables] = useState([]);
  const [reimbursements, setReimbursements] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const [owed, returned] = await Promise.all([
        api.debts.splitReceivables().catch(() => ({ receivables: [] })),
        api.transfers.splitReimbursements().catch(() => ({ reimbursements: [] })),
      ]);
      if (cancelled) return;
      setReceivables(owed.receivables || []);
      setReimbursements(returned.reimbursements || []);
      setLoaded(true);
    };

    load();
    return () => { cancelled = true; };
  }, []);

  if (!loaded) return null;

  // Nothing to say: no shared bills, or none outstanding.
  if (receivables.length === 0 && reimbursements.length === 0) return null;

  return (
    <div className="space-y-4">
      {receivables.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <ArrowDownLeft className="w-5 h-5 text-emerald-600" aria-hidden="true" />
            <h3 className="text-lg font-semibold">{K.receivables_title}</h3>
          </div>
          <p className="text-sm text-gray-500 mb-3">{K.receivables_desc}</p>
          <ul className="space-y-2">
            {receivables.map((item, index) => (
              <li
                key={`recv-${index}`}
                className="flex items-center justify-between gap-3 py-2 border-b border-gray-100 last:border-0"
              >
                <div className="min-w-0">
                  <p className="font-medium truncate">{item.group_name || item.name}</p>
                  <p className="text-sm text-gray-500">
                    {fill(K.receivables_days, item.days_outstanding)}
                    {' · '}
                    {item.description}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold text-emerald-600">
                    {formatCurrency(item.amount, item.currency || displayCurrency)}
                  </p>
                  {item.group_id ? (
                    <Link
                      to={`/split/${item.group_id}`}
                      className="text-sm text-primary-600 hover:underline"
                    >
                      {K.receivables_settle}
                    </Link>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {reimbursements.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <ArrowUpRight className="w-5 h-5 text-sky-600" aria-hidden="true" />
            <h3 className="text-lg font-semibold">{K.reimbursements_title}</h3>
          </div>
          <p className="text-sm text-gray-500 mb-3">{K.reimbursements_desc}</p>
          <ul className="space-y-2">
            {reimbursements.map((item, index) => (
              <li
                key={`reim-${index}`}
                className="flex items-center justify-between gap-3 py-2 border-b border-gray-100 last:border-0"
              >
                <div className="min-w-0">
                  <p className="font-medium truncate">{item.group_name || item.name}</p>
                  <p className="text-sm text-gray-500 truncate">{item.description}</p>
                </div>
                <p className="font-semibold text-sky-600 shrink-0">
                  {formatCurrency(item.amount, item.currency || displayCurrency)}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
};

export default SplitMoneyMovements;
