// Health Coach Page - AI Financial Health Assessment
import { useState, useEffect } from "react";
import { api } from "../services/api";
import { useTranslation } from '../i18n';

const HealthCoach = () => {
  const { t } = useTranslation();
  const [healthData, setHealthData] = useState(null);
  const [auditData, setAuditData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadHealthData();
  }, []);

  const loadHealthData = async () => {
    try {
      setLoading(true);
      const [scoreRes, auditRes] = await Promise.all([
        api.healthCoach.score().catch(() => null),
        api.healthCoach.audit().catch(() => null)
      ]);
      
      if (scoreRes?.ok) {
        const scoreData = await scoreRes.json();
        setHealthData(scoreData);
      }
      
      if (auditRes?.ok) {
        const auditResult = await auditRes.json();
        setAuditData(auditResult);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    if (value === null || value === undefined) return "Rp 0";
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getGradeColor = (grade) => {
    const colors = {
      A: "bg-green-100 text-green-700",
      B: "bg-blue-100 text-blue-700",
      C: "bg-yellow-100 text-yellow-700",
      D: "bg-orange-100 text-orange-700",
      E: "bg-red-100 text-red-700",
    };
    return colors[grade] || colors.C;
  };

  const getStatusColor = (status) => {
    const colors = {
      excellent: "text-green-600",
      good: "text-blue-600",
      warning: "text-yellow-600",
      danger: "text-red-600",
    };
    return colors[status] || "text-gray-600";
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
  const savingsRatio = healthData?.savings_ratio?.value || 0;
  const emergencyMonths = healthData?.emergency_fund_months?.value || 0;
  const dsr = healthData?.dsr_ratio?.value || 0;

  return (
    <div className="p-4 max-w-lg mx-auto pb-20">
      <h1 className="text-2xl font-bold mb-4">{t('nav.healthCoach')}</h1>
      
      {/* Score Card */}
      <div className="bg-gradient-to-r from-primary-500 to-purple-600 rounded-2xl p-6 text-white mb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm opacity-80">{t('health_coach.score')}</p>
            <p className="text-4xl font-bold">{healthData?.score || 0}</p>
            <p className="text-sm opacity-80 mt-1">
              {t('health_coach.grade')} <span className="font-bold">{healthData?.grade || "-"}</span>
            </p>
          </div>
          <div className="text-center">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold ${healthData?.grade ? 'bg-white/20' : 'bg-gray-600'}`}>
              {healthData?.grade || "?"}
            </div>
          </div>
        </div>
        
        {/* Summary Stats */}
        <div className="mt-4 pt-4 border-t border-white/20 grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs opacity-70">{t('health_coach.monthly_income')}</p>
            <p className="font-semibold">{formatCurrency(summary.monthly_income)}</p>
          </div>
          <div>
            <p className="text-xs opacity-70">{t('health_coach.monthly_expense')}</p>
            <p className="font-semibold">{formatCurrency(summary.monthly_expense)}</p>
          </div>
          <div>
            <p className="text-xs opacity-70">{t('health_coach.total_cash')}</p>
            <p className="font-semibold">{formatCurrency(summary.total_cash)}</p>
          </div>
          <div>
            <p className="text-xs opacity-70">{t('health_coach.total_debt')}</p>
            <p className="font-semibold">{formatCurrency(summary.total_debt)}</p>
          </div>
        </div>
      </div>

      {/* Key Ratios */}
      <div className="bg-white rounded-xl p-4 shadow-sm mb-4">
        <h2 className="font-semibold mb-3">{t('health_coach.financial_ratios')}</h2>
        
        <div className="space-y-3">
          {/* Savings Ratio */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">{t('health_coach.savings_ratio')}</span>
              <span className={getStatusColor(healthData?.savings_ratio?.status)}>
                {savingsRatio.toFixed(1)}%
              </span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary-500 rounded-full transition-all"
                style={{ width: `${Math.min(savingsRatio, 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {healthData?.savings_ratio?.description || t('health_coach.savings_desc_default')}
            </p>
          </div>

          {/* Emergency Fund */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">{t('health_coach.emergency_fund')}</span>
              <span className={getStatusColor(healthData?.emergency_fund_months?.status)}>
                {t('health_coach.months').replace('%value%', emergencyMonths.toFixed(1))}
              </span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-green-500 rounded-full transition-all"
                style={{ width: `${Math.min((emergencyMonths / 6) * 100, 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {t('health_coach.emergency_target')}
            </p>
          </div>

          {/* DSR */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">{t('health_coach.dsr_ratio')}</span>
              <span className={getStatusColor(healthData?.dsr_ratio?.status)}>
                {dsr.toFixed(1)}%
              </span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all ${dsr > 30 ? 'bg-red-500' : dsr > 15 ? 'bg-yellow-500' : 'bg-green-500'}`}
                style={{ width: `${Math.min(dsr, 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {t('health_coach.dsr_note')}
            </p>
          </div>
        </div>
      </div>

      {/* Audit Report */}
      {auditData && (
        <div className="bg-white rounded-xl p-4 shadow-sm mb-4">
          <h2 className="font-semibold mb-3">{t('health_coach.ai_audit')}</h2>
          
          {/* Highlights */}
          {auditData.highlights?.length > 0 && (
            <div className="mb-3">
              {auditData.highlights.map((highlight, idx) => (
                <div key={idx} className="text-sm text-green-600 flex items-start gap-2 mb-1">
                  <span>✅</span>
                  <span>{highlight.replace(/^[✅❌🌟]\s*/, '')}</span>
                </div>
              ))}
            </div>
          )}

          {/* Findings */}
          {auditData.findings?.length > 0 && (
            <div className="space-y-2">
              {auditData.findings.slice(0, 3).map((finding, idx) => (
                <div key={idx} className="bg-yellow-50 p-3 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-yellow-600">⚠️</span>
                    <span className="font-medium text-sm">{finding.title}</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">{finding.description}</p>
                </div>
              ))}
            </div>
          )}

          {/* Recommendations */}
          {auditData.recommendations?.length > 0 && (
            <div className="mt-3 pt-3 border-t">
              <h3 className="text-sm font-medium mb-2">{t('health_coach.improvement_tips')}</h3>
              {auditData.recommendations.map((rec, idx) => (
                <div key={idx} className="text-sm flex items-start gap-2 mb-1">
                  <span>💡</span>
                  <span>{rec}</span>
                </div>
              ))}
            </div>
          )}

          {/* Narrative */}
          {auditData.narrative && (
            <div className="mt-3 p-3 bg-gray-50 rounded-lg">
              <pre className="text-xs text-gray-600 whitespace-pre-wrap font-sans">
                {auditData.narrative}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Refresh Button */}
      <button
        onClick={loadHealthData}
        className="w-full py-3 bg-primary-600 text-white rounded-xl font-medium mt-4"
      >
        {t('health_coach.refresh_data')}
      </button>
    </div>
  );
};

export default HealthCoach;
