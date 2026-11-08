// Health Coach Page - AI Financial Health Assessment
import { useState, useEffect } from "react";
import { api } from "../services/api";
import { useTranslation } from '../i18n';
import { useOnDataMutated } from '../utils/dataSyncBus';
import { useCurrency } from '../utils/currency';
import { buildFlag } from '../utils/featureFlags';
import CuteWellnessBento from '../components/health/CuteWellnessBento';

const HealthCoach = () => {
  const { t } = useTranslation();
  // With the polish switch off, the page keeps the drawings it has.
  const polished = buildFlag('UI_POLISH');
  // The currency the reader is looking at. The accounts do not all
  // hold the same currency, so the backend converts the balances into
  // this one before it works out the ratios.
  const { currency: displayCurrency } = useCurrency();
  const [healthData, setHealthData] = useState(null);
  const [auditData, setAuditData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadHealthData();
  }, []);

  // The health coach reads the reader's money, so it hears about
  // every write to a transaction. A score worked out from yesterday's
  // transactions is not the reader's score.
  useOnDataMutated(
    () => {
      loadHealthData();
    },
    ['transaction']
  );

  // The description of a ratio. The backend names it by a key and
  // gives the numbers that go into it, so it reads in the language of
  // the reader.
  const ratioDescription = (ratio) => {
    if (!ratio) return '';
    if (ratio.description_key) {
      return t(ratio.description_key, '', ratio.description_values || {});
    }
    return ratio.description || '';
  };

  const loadHealthData = async () => {
    try {
      setLoading(true);
      const [scoreRes, auditRes] = await Promise.all([
        api.healthCoach.score(displayCurrency).catch(() => null),
        api.healthCoach.audit(displayCurrency).catch(() => null)
      ]);
      
      // The client hands back the body of the answer, not a wrapper
      // around it. Asking it for `.ok` and then `.json()` asks for a
      // wrapper that is not there, and the page ends up showing
      // nothing: a balance of five million rupiah on the dashboard
      // and zero here.
      //
      // A failed request gives nothing at all, and nothing must not
      // be read as a score.
      if (scoreRes) {
        setHealthData(scoreRes);
      }

      if (auditRes) {
        setAuditData(auditRes);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-700 rounded-lg">
        {t('common.error')}: {error}
      </div>
    );
  }

  const summary = healthData?.summary || {};

  /* The four amounts of the summary are named one by one, so that the
     bento cannot accidentally show a number the server did not send,
     and so that the page itself still says which amounts it shows. */
  const monthlyIncome = summary.monthly_income;
  const monthlyExpense = summary.monthly_expense;
  const totalCash = summary.total_cash;
  const totalDebt = summary.total_debt;

  /* The ratios are the objects the server sent, not the numbers taken
     out of them. The server has already worked out whether a ratio is
     good, and the pill shows that verdict; taking the value out here
     and throwing the status away would lose it. */
  const savingsRatio = healthData?.savings_ratio || null;
  const emergencyFund = healthData?.emergency_fund_months || null;
  const dsrRatio = healthData?.dsr_ratio || null;

  return (
    <div className="p-4 max-w-6xl mx-auto pb-20">
      <h1 className="text-2xl font-bold mb-4">{t('nav.healthCoach')}</h1>

      {/* The bento.

          The score is the one number the reader came for, so it takes
          the wide end of the row and the smaller numbers fit in around
          it. Every number on it is a number the server worked out;
          nothing here is worked out a second time. */}
      <CuteWellnessBento
        score={healthData?.score || 0}
        grade={healthData?.grade || "-"}
        monthlyIncome={monthlyIncome}
        monthlyExpense={monthlyExpense}
        totalCash={totalCash}
        totalDebt={totalDebt}
        savingsRatio={savingsRatio}
        emergencyFund={emergencyFund}
        dsrRatio={dsrRatio}
        ratioDescription={ratioDescription}
        audit={auditData}
        onRefresh={loadHealthData}
        polished={polished}
      />
    </div>
  );
};

export default HealthCoach;
