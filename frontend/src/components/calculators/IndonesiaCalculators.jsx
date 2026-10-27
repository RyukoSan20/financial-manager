/**
 * The calculators that follow Indonesian rules.
 *
 * The other calculators on the page are the ones any country would
 * want: discount, tip, loan, compound interest. These four are the
 * ones that only make sense here, because they follow Indonesian law
 * and Indonesian institutions.
 *
 * - PPh 21, the income tax an employer withholds
 * - PPN, the sales tax
 * - THR, the religious holiday allowance
 * - BPJS, the insurance contributions
 *
 * The working out is done by the server, in
 * `backend/app/services/calculation/indonesia.py`, so the numbers here
 * are the same as the numbers the rules give. The server holds the
 * rate tables, which change when the rules change; the browser does
 * not hold a copy of them.
 *
 * These are new screens, and they are behind a switch, so a reader
 * who has not asked for them sees the page as it was.
 */

import { useState, useEffect } from 'react';
import { Card, Input, Select } from '../../components/ui';
import { api } from '../../services/api';
import { useTranslation } from '../../i18n';
import { batch5 } from '../../i18n/keys_batch5';

/**
 * One number, with its label, on the right of a row.
 */
const Row = ({ label, value, strong = false }) => (
  <div className="flex justify-between items-center py-1.5">
    <span className={strong ? 'text-sm font-semibold text-gray-900' : 'text-sm text-gray-700'}>
      {label}
    </span>
    <span className={strong ? 'text-base font-bold text-gray-900' : 'text-sm font-medium text-gray-700'}>
      {value}
    </span>
  </div>
);

/**
 * The note that says which rule the numbers come from.
 */
const RuleNote = ({ rule }) => {
  if (!rule) return null;
  return (
    <p className="text-xs text-gray-400 mt-3 pt-3 border-t border-gray-100">
      {rule}
    </p>
  );
};

/**
 * A message shown while a number is being worked out, or when it
 * could not be.
 */
const Message = ({ tone = 'info', children }) => {
  if (!children) return null;
  const tones = {
    info: 'bg-gray-50 text-gray-600',
    error: 'bg-danger-50 text-danger-600',
  };
  return (
    <p className={`text-sm rounded-lg px-3 py-2 ${tones[tone]}`}>
      {children}
    </p>
  );
};

/**
 * Calls the server and holds the answer.
 *
 * The number is worked out by the server because the rate tables
 * live there. While the answer is on its way the screen shows
 * nothing, rather than a number that is still being worked out.
 */
const useCalculation = (path, payload, enabled = true) => {
  const [result, setResult] = useState(null);
  // The error is kept as a code as well as a sentence. The server
  // writes its sentence in one language, so the screen uses the code
  // and puts it in the reader's own language.
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setResult(null);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    api.request(path, { method: 'POST', body: JSON.stringify(payload) })
      .then((data) => {
        if (cancelled) return;
        setResult(data);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setResult(null);
        setError(err?.code || err?.message || 'unknown_error');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, JSON.stringify(payload), enabled]);

  return { result, error, loading };
};

const toNumber = (value) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * The way the allowance was worked out, in the reader's language.
 *
 * The server sends a code rather than a sentence, because the
 * sentence it used to send was written in one language only.
 */
const thrMethod = (keys, result) => {
  if (result.method_code === 'full') return keys.thr_method_full;
  if (result.method_code === 'proportional') {
    return `${result.service_months}/12 ${keys.thr_method_proportional}`;
  }
  return keys.thr_method_not_eligible;
};

/**
 * The message for a failure, in the reader's language.
 *
 * The code comes from the server. When there is no translation for
 * the code, the sentence the server wrote is shown instead, so the
 * reader is never left with nothing at all.
 */
const errorText = (keys, error) => {
  if (!error) return null;
  const key = `calc_error_${error}`;
  const translated = keys[key];
  if (translated) return translated;
  return error;
};

// === PPh 21 ===

export const PPh21Calculator = () => {
  const { language, formatCurrency } = useTranslation();
  const K = batch5[language]?.id_calculators;
  const [gross, setGross] = useState('10000000');
  const [status, setStatus] = useState('K/0');

  const { result, error } = useCalculation(
    '/calculators/id/pph21',
    { monthly_gross: toNumber(gross), status },
    toNumber(gross) > 0,
  );

  const statuses = ['TK/0', 'TK/1', 'K/0', 'TK/2', 'TK/3', 'K/1', 'K/2', 'K/3'];

  if (!K) return null;

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card>
        <h3 className="font-semibold text-gray-900 mb-1">{K.pph21_title}</h3>
        <p className="text-sm text-gray-500 mb-4">{K.pph21_subtitle}</p>
        <div className="space-y-4">
          <Input
            label={K.pph21_gross}
            type="number"
            placeholder="10000000"
            value={gross}
            onChange={(e) => setGross(e.target.value)}
          />
          <Select
            label={K.pph21_status}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            options={statuses.map((s) => ({ value: s, label: s }))}
          />
        </div>
      </Card>

      <Card>
        {error ? (
          <Message tone="error">{errorText(K, error)}</Message>
        ) : result ? (
          <div>
            <Row label={K.pph21_category} value={result.category} />
            <Row label={K.pph21_rate} value={`${result.effective_rate}%`} />
            <Row label={K.pph21_tax} value={formatCurrency(result.tax)} strong />
            <Row label={K.pph21_net} value={formatCurrency(result.net_income)} />
            <Row label={K.pph21_ptkp} value={formatCurrency(result.ptkp_annual)} />
            <RuleNote rule={result.rule} />
          </div>
        ) : (
          <Message>{K.pph21_subtitle}</Message>
        )}
      </Card>
    </div>
  );
};

// === PPN ===

export const PPNCalculator = () => {
  const { language, formatCurrency } = useTranslation();
  const K = batch5[language]?.id_calculators;
  const [price, setPrice] = useState('100000');
  const [luxury, setLuxury] = useState(false);

  const { result, error } = useCalculation(
    '/calculators/id/ppn',
    { price: toNumber(price), luxury },
    toNumber(price) > 0,
  );

  if (!K) return null;

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card>
        <h3 className="font-semibold text-gray-900 mb-1">{K.ppn_title}</h3>
        <p className="text-sm text-gray-500 mb-4">{K.ppn_subtitle}</p>
        <div className="space-y-4">
          <Input
            label={K.ppn_price}
            type="number"
            placeholder="100000"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={luxury}
              onChange={(e) => setLuxury(e.target.checked)}
              className="rounded border-gray-300"
            />
            {K.ppn_luxury}
          </label>
        </div>
      </Card>

      <Card>
        {error ? (
          <Message tone="error">{errorText(K, error)}</Message>
        ) : result ? (
          <div>
            <Row label={K.ppn_base} value={formatCurrency(result.base)} />
            <Row label={K.ppn_rate} value={`${result.rate}%`} />
            <Row label={K.ppn_tax} value={formatCurrency(result.tax)} strong />
            <Row label={K.ppn_total} value={formatCurrency(result.total_with_tax)} />
            <RuleNote rule={result.rule} />
          </div>
        ) : (
          <Message>{K.ppn_subtitle}</Message>
        )}
      </Card>
    </div>
  );
};

// === THR ===

export const THRCalculator = () => {
  const { language, formatCurrency } = useTranslation();
  const K = batch5[language]?.id_calculators;
  const [salary, setSalary] = useState('5000000');
  const [allowance, setAllowance] = useState('0');
  const [months, setMonths] = useState('12');

  const { result, error } = useCalculation(
    '/calculators/id/thr',
    {
      monthly_salary: toNumber(salary),
      service_months: Math.round(toNumber(months)),
      fixed_allowance: toNumber(allowance),
    },
    toNumber(salary) > 0,
  );

  if (!K) return null;

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card>
        <h3 className="font-semibold text-gray-900 mb-1">{K.thr_title}</h3>
        <p className="text-sm text-gray-500 mb-4">{K.thr_subtitle}</p>
        <div className="space-y-4">
          <Input
            label={K.thr_salary}
            type="number"
            placeholder="5000000"
            value={salary}
            onChange={(e) => setSalary(e.target.value)}
          />
          <Input
            label={K.thr_allowance}
            type="number"
            placeholder="0"
            value={allowance}
            onChange={(e) => setAllowance(e.target.value)}
          />
          <Input
            label={K.thr_months}
            type="number"
            placeholder="12"
            value={months}
            onChange={(e) => setMonths(e.target.value)}
          />
        </div>
      </Card>

      <Card>
        {error ? (
          <Message tone="error">{errorText(K, error)}</Message>
        ) : result ? (
          <div>
            {result.eligible ? (
              <>
                <Row label={K.thr_one_month} value={formatCurrency(result.one_month_wage)} />
                <Row label={K.thr_result} value={formatCurrency(result.thr)} strong />
                <Row label={K.thr_method} value={thrMethod(K, result)} />
              </>
            ) : (
              <Message>{K.thr_not_eligible}</Message>
            )}
            <RuleNote rule={result.rule} />
          </div>
        ) : (
          <Message>{K.thr_subtitle}</Message>
        )}
      </Card>
    </div>
  );
};

// === BPJS ===

export const BPJSCalculator = () => {
  const { language, formatCurrency } = useTranslation();
  const K = batch5[language]?.id_calculators;
  const [wage, setWage] = useState('6000000');
  const [risk, setRisk] = useState('low');
  const [family, setFamily] = useState('0');

  const { result, error } = useCalculation(
    '/calculators/id/bpjs',
    {
      monthly_wage: toNumber(wage),
      risk,
      extra_family_members: Math.round(toNumber(family)),
    },
    toNumber(wage) > 0,
  );

  const riskOptions = [
    { value: 'low', label: K.bpjs_risk_low },
    { value: 'medium', label: K.bpjs_risk_medium },
    { value: 'high', label: K.bpjs_risk_high },
  ];

  if (!K) return null;

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card>
        <h3 className="font-semibold text-gray-900 mb-1">{K.bpjs_title}</h3>
        <p className="text-sm text-gray-500 mb-4">{K.bpjs_subtitle}</p>
        <div className="space-y-4">
          <Input
            label={K.bpjs_wage}
            type="number"
            placeholder="6000000"
            value={wage}
            onChange={(e) => setWage(e.target.value)}
          />
          <Select
            label={K.bpjs_risk}
            value={risk}
            onChange={(e) => setRisk(e.target.value)}
            options={riskOptions}
          />
          <Input
            label={K.bpjs_family}
            type="number"
            placeholder="0"
            value={family}
            onChange={(e) => setFamily(e.target.value)}
          />
        </div>
      </Card>

      <Card>
        {error ? (
          <Message tone="error">{errorText(K, error)}</Message>
        ) : result ? (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">
                {K.bpjs_worker}
              </p>
              <Row label={K.bpjs_health} value={formatCurrency(result.worker.health)} />
              {result.worker.health_family > 0 && (
                <Row label={K.bpjs_health_family} value={formatCurrency(result.worker.health_family)} />
              )}
              <Row label={K.bpjs_old_age} value={formatCurrency(result.worker.old_age)} />
              <Row label={K.bpjs_pension} value={formatCurrency(result.worker.pension)} />
              <Row label={K.bpjs_total} value={formatCurrency(result.worker.total)} strong />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">
                {K.bpjs_employer}
              </p>
              <Row label={K.bpjs_health} value={formatCurrency(result.employer.health)} />
              <Row label={K.bpjs_old_age} value={formatCurrency(result.employer.old_age)} />
              <Row label={K.bpjs_pension} value={formatCurrency(result.employer.pension)} />
              <Row label={K.bpjs_accident} value={formatCurrency(result.employer.accident)} />
              <Row label={K.bpjs_death} value={formatCurrency(result.employer.death)} />
              <Row label={K.bpjs_total} value={formatCurrency(result.employer.total)} strong />
            </div>
            <div className="pt-2 border-t border-gray-100">
              <Row label={K.bpjs_take_home} value={formatCurrency(result.take_home)} strong />
            </div>
            <RuleNote rule={result.rule} />
          </div>
        ) : (
          <Message>{K.bpjs_subtitle}</Message>
        )}
      </Card>
    </div>
  );
};

/**
 * The four calculators, together, with the tabs that choose between
 * them.
 */
export const IndonesiaCalculators = () => {
  const { language } = useTranslation();
  const K = batch5[language]?.id_calculators;
  const [tab, setTab] = useState('pph21');

  if (!K) return null;

  const tabs = [
    { id: 'pph21', label: K.tab_pph21 },
    { id: 'ppn', label: K.tab_ppn },
    { id: 'thr', label: K.tab_thr },
    { id: 'bpjs', label: K.tab_bpjs },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 p-1 bg-gray-100 rounded-xl">
        {tabs.map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              tab === item.id
                ? 'bg-white text-primary-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'pph21' && <PPh21Calculator />}
      {tab === 'ppn' && <PPNCalculator />}
      {tab === 'thr' && <THRCalculator />}
      {tab === 'bpjs' && <BPJSCalculator />}
    </div>
  );
};

export default IndonesiaCalculators;
