// AI Financial Advisor Page
// Provides personalized AI-powered financial insights

import { useState, useEffect } from "react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

const AIAdvisor = () => {
  const { user } = useAuth();
  const [advice, setAdvice] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chatMessage, setChatMessage] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("advice");
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [adviceRes, summaryRes] = await Promise.all([
        api.ai.advice(),
        api.ai.summary(),
      ]);
      
      setAdvice(Array.isArray(adviceRes) ? adviceRes : []);
      setSummary(summaryRes);
    } catch (err) {
      console.error("Error fetching AI data:", err);
      // Show more specific error message
      if (err.message?.includes('401') || err.message?.includes('Unauthorized')) {
        setError("Sesi habis. Silakan login ulang.");
      } else if (err.message?.includes('Failed to fetch') || err.message?.includes('Network')) {
        setError("Tidak dapat terhubung ke server. Periksa koneksi internet Anda.");
      } else {
        setError("Gagal memuat data AI: " + (err.message || 'Error tidak dikenal'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChat = async (e) => {
    e.preventDefault();
    if (!chatMessage.trim() || chatLoading) return;
    
    const userMessage = chatMessage;
    setChatMessage("");
    setChatLoading(true);
    
    // Add user message to history
    setChatHistory(prev => [...prev, { role: "user", text: userMessage }]);
    
    try {
      const response = await api.ai.chat(userMessage);
      setChatHistory(prev => [...prev, { role: "ai", text: response.response || "Maaf, saya tidak bisa menjawab saat ini." }]);
    } catch (err) {
      console.error("Chat error:", err);
      setChatHistory(prev => [...prev, { role: "ai", text: "Terjadi kesalahan. Silakan coba lagi." }]);
    } finally {
      setChatLoading(false);
    }
  };

  // Default questions for users
  const defaultQuestions = [
    "Berapa total saldo saya saat ini?",
    "Berapa tingkat tabungan saya sekarang?",
    "Apa saja pengeluaran terbesar saya bulan ini?",
    "Bagaimana tips menabung lebih banyak?",
    "Bagaimana cara menurunkan pengeluaran?",
  ];

  const handleSuggestionClick = (question) => {
    setChatMessage(question);
  };

  const getCategoryColor = (category) => {
    const colors = {
      savings: "bg-green-100 text-green-700 border-green-200",
      spending: "bg-red-100 text-red-700 border-red-200",
      investment: "bg-blue-100 text-blue-700 border-blue-200",
      debt: "bg-orange-100 text-orange-700 border-orange-200",
      goals: "bg-purple-100 text-purple-700 border-purple-200",
    };
    return colors[category] || "bg-gray-100 text-gray-700 border-gray-200";
  };

  const getPriorityBadge = (priority) => {
    const badges = {
      high: "bg-red-500 text-white",
      medium: "bg-yellow-500 text-white",
      low: "bg-green-500 text-white",
    };
    return badges[priority] || "bg-gray-500 text-white";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary-200 border-t-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Menganalisis keuangan Anda...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold">AI Financial Advisor</h1>
            <p className="text-primary-100 text-sm">Personalized insights based on your finances</p>
          </div>
        </div>
        
        {/* Quick Stats */}
        {summary && (
          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <p className="text-primary-200 text-xs">Total Saldo</p>
              <p className="font-bold text-lg">Rp {summary.total_balance?.toLocaleString("id-ID")}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <p className="text-primary-200 text-xs">Tabungan/Bulan</p>
              <p className="font-bold text-lg">{summary.savings_rate?.toFixed(1)}%</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <p className="text-primary-200 text-xs">Tujuan Aktif</p>
              <p className="font-bold text-lg">{summary.active_goals}</p>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm p-1 flex">
        <button
          onClick={() => setActiveTab("advice")}
          className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
            activeTab === "advice"
              ? "bg-primary-600 text-white"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          Saran AI
        </button>
        <button
          onClick={() => setActiveTab("chat")}
          className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
            activeTab === "chat"
              ? "bg-primary-600 text-white"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          Chat Advisor
        </button>
      </div>

      {/* Advice Tab */}
      {activeTab === "advice" && (
        <div className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-red-700">{error}</p>
              <button onClick={fetchData} className="mt-2 text-sm text-red-600 underline">
                Coba lagi
              </button>
            </div>
          )}
          
          {advice.length > 0 ? (
            advice.map((item, index) => (
              <div
                key={index}
                className={`bg-white rounded-xl shadow-sm border-2 ${getCategoryColor(item.category)}`}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getPriorityBadge(item.priority)}`}>
                          {item.priority === "high" ? "Prioritas Tinggi" : item.priority === "medium" ? "Sedang" : "Rendah"}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-white">
                          {item.category}
                        </span>
                      </div>
                      <h3 className="text-lg font-semibold">{item.title}</h3>
                    </div>
                  </div>
                  
                  <p className="text-gray-700 mb-4">{item.insight}</p>
                  
                  <div className="mb-3">
                    <p className="text-sm font-medium text-gray-600 mb-2">Langkah-langkah:</p>
                    <ul className="space-y-2">
                      {item.action_items?.map((action, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="w-5 h-5 rounded-full bg-green-500 text-white text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                            {i + 1}
                          </span>
                          <span className="text-sm text-gray-700">{action}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  {item.potential_impact && (
                    <div className="bg-white/50 rounded-lg p-3">
                      <p className="text-sm">
                        <span className="font-medium">Dampak: </span>
                        {item.potential_impact}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="bg-white rounded-xl shadow-sm p-8 text-center">
              <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <p className="text-gray-500">Belum ada saran tersedia</p>
              <p className="text-sm text-gray-400 mt-1">Tambahkan transaksi untuk mendapatkan saran</p>
            </div>
          )}
          
          {/* Financial Summary */}
          {summary && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Ringkasan Keuangan</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="text-sm text-blue-600 font-medium">Pemasukan Bulanan</p>
                  <p className="text-xl font-bold text-blue-900">
                    Rp {summary.monthly_income?.toLocaleString("id-ID")}
                  </p>
                </div>
                <div className="bg-red-50 rounded-lg p-4">
                  <p className="text-sm text-red-600 font-medium">Pengeluaran Bulanan</p>
                  <p className="text-xl font-bold text-red-900">
                    Rp {summary.monthly_expense?.toLocaleString("id-ID")}
                  </p>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <p className="text-sm text-green-600 font-medium">Total Utang</p>
                  <p className="text-xl font-bold text-green-900">
                    Rp {summary.total_debt?.toLocaleString("id-ID")}
                  </p>
                </div>
                <div className="bg-purple-50 rounded-lg p-4">
                  <p className="text-sm text-purple-600 font-medium">Tingkat Tabungan</p>
                  <p className="text-xl font-bold text-purple-900">
                    {summary.savings_rate?.toFixed(1)}%
                  </p>
                </div>
              </div>
              
              {summary.top_categories?.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">Top Kategori Pengeluaran:</p>
                  <div className="space-y-2">
                    {summary.top_categories.slice(0, 3).map((cat, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="flex-1">
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary-500 rounded-full"
                              style={{ width: `${cat.percentage}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-sm font-medium text-gray-700 w-24 text-right">
                          {cat.category}
                        </span>
                        <span className="text-sm text-gray-500 w-28 text-right">
                          Rp {cat.total?.toLocaleString("id-ID")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Chat Tab */}
      {activeTab === "chat" && (
        <div className="bg-white rounded-xl shadow-sm flex flex-col h-[500px]">
          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {chatHistory.length === 0 && (
              <div className="text-center py-8">
                <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p className="text-gray-500">Tanya tentang keuangan Anda</p>
                <p className="text-sm text-gray-400 mt-1">Contoh: "Bagaimana cara menabung untuk dana darurat?"</p>
              </div>
            )}
            
            {chatHistory.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    msg.role === "user"
                      ? "bg-primary-600 text-white"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {msg.role === "ai" && (
                    <div className="flex items-center gap-2 mb-2 text-primary-600">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      <span className="text-sm font-medium">AI Advisor</span>
                    </div>
                  )}
                  <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                </div>
              </div>
            ))}
            
            {chatLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-2xl px-4 py-3">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Chat Input */}
          <form onSubmit={handleChat} className="border-t p-4">
            {/* Suggestion Buttons */}
            {chatHistory.length === 0 && !chatLoading && (
              <div className="mb-3">
                <p className="text-xs text-gray-500 mb-2">Pertanyaan populer:</p>
                <div className="flex flex-wrap gap-2">
                  {defaultQuestions.map((q, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleSuggestionClick(q)}
                      className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                placeholder="Tanyakan tentang keuangan..."
                className="flex-1 px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={chatLoading}
              />
              <button
                type="submit"
                disabled={!chatMessage.trim() || chatLoading}
                className="px-4 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tips Section */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Tips Cepat</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span className="font-medium text-green-800">Tabungan</span>
            </div>
            <p className="text-sm text-green-700">Tabung 20% dari penghasilan setiap bulan</p>
          </div>
          
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <span className="font-medium text-blue-800">Anggaran</span>
            </div>
            <p className="text-sm text-blue-700">Gunakan metode 50/30/20 untuk anggaran</p>
          </div>
          
          <div className="bg-purple-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <span className="font-medium text-purple-800">Investasi</span>
            </div>
            <p className="text-sm text-purple-700">Mulai investasi sedini mungkin dengan compound interest</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIAdvisor;
