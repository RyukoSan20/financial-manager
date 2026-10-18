// Health Coach Page - AI Financial Health Assessment
import { useState, useEffect } from "react";
import { api } from "../services/api";

const HealthCoach = () => {
  const [healthData, setHealthData] = useState(null);
  const [auditData, setAuditData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("score");

  useEffect(() => {
    loadHealthScore();
  }, []);

  const loadHealthScore = async () => {
    try {
      setLoading(true);
      const data = await api.healthCoach.score();
      setHealthData(data);
    } catch (error) {
      console.error("Failed to load health score:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadAudit = async () => {
    try {
      setLoading(true);
      const data = await api.healthCoach.audit();
      setAuditData(data);
    } catch (error) {
      console.error("Failed to load audit:", error);
    } finally {
      setLoading(false);
    }
  };

  const getGradeColor = (grade) => {
    const colors = {
      A: "text-green-600 bg-green-100",
      B: "text-blue-600 bg-blue-100",
      C: "text-yellow-600 bg-yellow-100",
      D: "text-orange-600 bg-orange-100",
      E: "text-red-600 bg-red-100",
    };
    return colors[grade] || "text-gray-600 bg-gray-100";
  };

  const getStatusColor = (status) => {
    const colors = {
      excellent: "text-green-600 bg-green-50 border-green-200",
      good: "text-blue-600 bg-blue-50 border-blue-200",
      warning: "text-yellow-600 bg-yellow-50 border-yellow-200",
      danger: "text-red-600 bg-red-50 border-red-200",
    };
    return colors[status] || "text-gray-600 bg-gray-50 border-gray-200";
  };

  if (loading && !healthData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">AI Health Coach</h1>
        <p className="opacity-90">Analisis kesehatan finansial dengan AI</p>
      </div>

      {/* Score Card */}
      {healthData && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Skor Kesehatan Finansial</p>
              <div className="flex items-baseline gap-3">
                <span className="text-5xl font-bold">{healthData.score}</span>
                <span className="text-2xl text-gray-400">/100</span>
              </div>
            </div>
            <div className={`px-6 py-3 rounded-xl font-bold text-2xl ${getGradeColor(healthData.grade)}`}>
              Grade {healthData.grade}
            </div>
          </div>

          {/* Summary */}
          {healthData.summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t">
              <div>
                <p className="text-gray-500 text-xs">Pendapatan Bulanan</p>
                <p className="font-semibold">Rp {healthData.summary.monthly_income?.toLocaleString() || 0}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Pengeluaran Bulanan</p>
                <p className="font-semibold">Rp {healthData.summary.monthly_expense?.toLocaleString() || 0}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Total Cash</p>
                <p className="font-semibold">Rp {healthData.summary.total_cash?.toLocaleString() || 0}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Total Utang</p>
                <p className="font-semibold">Rp {healthData.summary.total_debt?.toLocaleString() || 0}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm">
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab("score")}
            className={`px-6 py-3 font-medium ${activeTab === "score" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500"}`}
          >
            Rasio Keuangan
          </button>
          <button
            onClick={() => { setActiveTab("audit"); loadAudit(); }}
            className={`px-6 py-3 font-medium ${activeTab === "audit" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500"}`}
          >
            Audit AI
          </button>
          <button
            onClick={() => setActiveTab("tips")}
            className={`px-6 py-3 font-medium ${activeTab === "tips" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500"}`}
          >
            Tips Perbaikan
          </button>
        </div>

        <div className="p-6">
          {activeTab === "score" && healthData && (
            <div className="space-y-4">
              {/* Liquidity Ratio */}
              {healthData.liquidity_ratio && (
                <div className={`p-4 rounded-lg border ${getStatusColor(healthData.liquidity_ratio.status)}`}>
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold">Rasio Likuiditas</h3>
                    <span className="font-bold">{healthData.liquidity_ratio.value?.toFixed(1)} bulan</span>
                  </div>
                  <p className="text-sm mt-1 opacity-80">{healthData.liquidity_ratio.description}</p>
                </div>
              )}

              {/* Savings Ratio */}
              {healthData.savings_ratio && (
                <div className={`p-4 rounded-lg border ${getStatusColor(healthData.savings_ratio.status)}`}>
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold">Rasio Tabungan</h3>
                    <span className="font-bold">{(healthData.savings_ratio.value * 100).toFixed(1)}%</span>
                  </div>
                  <p className="text-sm mt-1 opacity-80">{healthData.savings_ratio.description}</p>
                </div>
              )}

              {/* DSR Ratio */}
              {healthData.dsr_ratio && (
                <div className={`p-4 rounded-lg border ${getStatusColor(healthData.dsr_ratio.status)}`}>
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold">Debt Service Ratio</h3>
                    <span className="font-bold">{(healthData.dsr_ratio.value * 100).toFixed(1)}%</span>
                  </div>
                  <p className="text-sm mt-1 opacity-80">{healthData.dsr_ratio.description}</p>
                </div>
              )}

              {/* Emergency Fund */}
              {healthData.emergency_fund_months && (
                <div className={`p-4 rounded-lg border ${getStatusColor(healthData.emergency_fund_months.status)}`}>
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold">Dana Darurat</h3>
                    <span className="font-bold">{healthData.emergency_fund_months.value?.toFixed(1)} bulan</span>
                  </div>
                  <p className="text-sm mt-1 opacity-80">{healthData.emergency_fund_months.description}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === "audit" && (
            <div className="text-center py-8 text-gray-500">
              {loading ? (
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              ) : auditData ? (
                <pre className="text-left whitespace-pre-wrap text-sm">{JSON.stringify(auditData, null, 2)}</pre>
              ) : (
                <p>Klik untuk memuat audit AI</p>
              )}
            </div>
          )}

          {activeTab === "tips" && (
            <div className="space-y-4">
              {healthData?.liquidity_ratio?.status === "danger" && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <h4 className="font-semibold text-yellow-800">💡 Tips: Perkuat Dana Darurat</h4>
                  <p className="text-sm text-yellow-700 mt-1">
                    Targetkan dana darurat 3-6 bulan pengeluaran. Mulai dengan menyimpan 10% dari penghasilan setiap bulan.
                  </p>
                </div>
              )}
              {healthData?.savings_ratio?.value < 0.2 && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-semibold text-blue-800">💡 Tips: Tingkatkan Tabungan</h4>
                  <p className="text-sm text-blue-700 mt-1">
                    Taburkan minimal 20% dari penghasilan. Gunakan metode 50/30/20 untuk alokasi dana.
                  </p>
                </div>
              )}
              {(!healthData?.liquidity_ratio || healthData.liquidity_ratio.status !== "danger") && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <h4 className="font-semibold text-green-800">🎉 Keuangan Sehat!</h4>
                  <p className="text-sm text-green-700 mt-1">
                    Dana darurat Anda sudah mencukupi. Lanjutkan kebiasaan baik ini!
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HealthCoach;
