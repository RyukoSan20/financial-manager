// AI Financial Advisor Page - Enhanced Interactive Version
// Provides personalized AI-powered financial insights with topic selection

import { useState, useEffect, useRef } from "react";
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
  const [selectedTopic, setSelectedTopic] = useState(null);
  const chatEndRef = useRef(null);

  // Topic categories for interactive chat
  const topics = [
    {
      id: "news",
      icon: "📰",
      title: "Berita Finansial",
      desc: "Berita & tren ekonomi terkini",
      prompt: "Berikan saya berita dan tren finansial terkini yang relevan untuk keuangan personal saya."
    },
    {
      id: "future",
      icon: "🎯",
      title: "Proyeksi Masa Depan",
      desc: "Rencanakan tujuan keuangan jangka panjang",
      prompt: "Bantu saya membuat proyeksi dan perencanaan keuangan masa depan, termasuk pensiun, investasi jangka panjang, dan tujuan-tujuan besar saya."
    },
    {
      id: "balance",
      icon: "⚖️",
      title: "Life-Finance Balance",
      desc: "Seimbangkan usia, karier & gaya hidup",
      prompt: "Analisis bagaimana saya bisa menyeimbangkan keuangan dengan usia saya saat ini, tahap karier, dan gaya hidup. Berikan rekomendasi yang realistis."
    },
    {
      id: "debt",
      icon: "💳",
      title: "Strategi Utang",
      desc: "Kelola dan lunasi utang dengan optimal",
      prompt: "Saya ingin strategi optimal untuk mengelola dan melunasi utang saya. Pertimbangkan bunga, prioritas, dan dampak terhadap cash flow."
    },
    {
      id: "invest",
      icon: "📈",
      title: "Strategi Investasi",
      desc: "Diversifikasi & portofolio optimal",
      prompt: "Bantu saya membuat strategi investasi yang terdiversifikasi. Pertimbangkan profil risiko, jangka waktu, dan alokasi aset."
    },
    {
      id: "budget",
      icon: "📊",
      title: "Teknik Budgeting",
      desc: "50/30/20, envelope, zero-based",
      prompt: "Rekomendasikan teknik budgeting terbaik untuk situasi keuangan saya dan bantu buat sistem yang可持续."
    },
    {
      id: "emergency",
      icon: "🛡️",
      title: "Dana Darurat & Asuransi",
      desc: "Proteksi finansial keluarga",
      prompt: "Berapa dana darurat yang saya butuhkan? Kapan perlu asuransi? Bagaimana proteksi finansial keluarga yang ideal?"
    },
    {
      id: "free",
      icon: "💬",
      title: "Chat Bebas",
      desc: "Tanya apa saja tentang keuangan",
      prompt: ""
    }
  ];

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

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

  const handleTopicSelect = (topic) => {
    setSelectedTopic(topic);
    if (topic.id !== "free") {
      setChatMessage(topic.prompt);
    }
  };

  const handleChat = async (e) => {
    e.preventDefault();
    if (!chatMessage.trim() || chatLoading) return;
    
    const userMessage = chatMessage;
    const currentTopic = selectedTopic;
    setChatMessage("");
    setChatLoading(true);
    setSelectedTopic(null);

    // Add user message
    setChatHistory(prev => [...prev, { role: "user", content: userMessage }]);

    try {
      // Add initial AI message
      setChatHistory(prev => [...prev, { role: "assistant", content: "", streaming: true }]);
      
      const response = await fetch(`${import.meta.env.VITE_API_URL}/ai/chat/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({ 
          message: userMessage,
          topic: currentTopic?.id || "free"
        })
      });

      if (!response.ok) throw new Error("Request failed");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        
        // Parse SSE data: format is "data: {...}\n\n"
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const jsonData = JSON.parse(line.slice(6));
              if (jsonData.type === 'chunk' || jsonData.type === 'done') {
                fullResponse = jsonData.content || fullResponse;
                // Update last message with streamed content
                setChatHistory(prev => {
                  const updated = [...prev];
                  if (updated.length > 0) {
                    updated[updated.length - 1] = { 
                      role: "assistant", 
                      content: fullResponse,
                      streaming: jsonData.type !== 'done'
                    };
                  }
                  return updated;
                });
              }
            } catch (e) {
              // Skip invalid JSON, might be partial
            }
          }
        }
      }
    } catch (err) {
      console.error("Chat error:", err);
      // Remove streaming message on error
      setChatHistory(prev => prev.filter((_, i) => i < prev.length - 1));
      // Add error message
      setChatHistory(prev => [...prev, { 
        role: "assistant", 
        content: "Maaf, terjadi kesalahan. Silakan coba lagi." 
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  const clearChat = () => {
    setChatHistory([]);
    setSelectedTopic(null);
  };

  if (loading) {
    return (
      <div className="page">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Memuat AI Advisor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page ai-advisor-page">
      <header className="page-header">
        <h1>💰 AI Financial Advisor</h1>
        <p>Asisten keuangan berbasis AI yang dipersonalisasi</p>
      </header>

      {error && (
        <div className="error-banner" onClick={fetchData}>
          ⚠️ {error} (Klik untuk refresh)
        </div>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="summary-cards">
          <div className="summary-card">
            <span className="card-icon">💵</span>
            <span className="card-label">Total Saldo</span>
            <span className="card-value">{summary.formatted_balance || summary.total_balance?.toLocaleString('id-ID', { style: 'currency', currency: 'IDR' })}</span>
          </div>
          <div className="summary-card">
            <span className="card-icon">📊</span>
            <span className="card-label">Tabungan/Bulan</span>
            <span className="card-value">{summary.savings_rate?.toFixed(1) || 0}%</span>
          </div>
          <div className="summary-card">
            <span className="card-icon">🎯</span>
            <span className="card-label">Tujuan Aktif</span>
            <span className="card-value">{summary.active_goals || 0}</span>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="tab-nav">
        <button 
          className={`tab-btn ${activeTab === "advice" ? "active" : ""}`}
          onClick={() => setActiveTab("advice")}
        >
          📋 Saran AI
        </button>
        <button 
          className={`tab-btn ${activeTab === "chat" ? "active" : ""}`}
          onClick={() => setActiveTab("chat")}
        >
          💬 Chat Advisor
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "advice" ? (
        <div className="advice-section">
          {advice.length > 0 ? (
            <div className="advice-list">
              {advice.map((item, index) => (
                <div key={index} className={`advice-card priority-${item.priority}`}>
                  <div className="advice-header">
                    <span className="advice-icon">
                      {item.category === "savings" ? "💰" : 
                       item.category === "debt" ? "💳" : 
                       item.category === "goals" ? "🎯" : "📊"}
                    </span>
                    <span className="advice-title">{item.title}</span>
                    <span className={`priority-badge ${item.priority}`}>
                      {item.priority === "high" ? "Prioritas Tinggi" : 
                       item.priority === "medium" ? "Sedang" : "Rendah"}
                    </span>
                  </div>
                  <p className="advice-description">{item.description}</p>
                  {item.action_steps && item.action_steps.length > 0 && (
                    <div className="advice-steps">
                      <strong>Langkah-langkah:</strong>
                      <ol>
                        {item.action_steps.map((step, i) => (
                          <li key={i}>{step}</li>
                        ))}
                      </ol>
                    </div>
                  )}
                  {item.impact && (
                    <div className="advice-impact">
                      <strong>Dampak:</strong> {item.impact}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <p>Belum ada saran AI. Tambahkan transaksi untuk mendapatkan insight.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="chat-section">
          {/* Topic Selection */}
          {chatHistory.length === 0 && (
            <div className="topic-selection">
              <h3>Pilih Topik yang Ingin Dibahas</h3>
              <p className="topic-subtitle">Atau ketik pertanyaan bebas di bawah</p>
              <div className="topic-grid">
                {topics.map((topic) => (
                  <button
                    key={topic.id}
                    className={`topic-card ${selectedTopic?.id === topic.id ? "selected" : ""}`}
                    onClick={() => handleTopicSelect(topic)}
                  >
                    <span className="topic-icon">{topic.icon}</span>
                    <span className="topic-title">{topic.title}</span>
                    <span className="topic-desc">{topic.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chat Messages */}
          <div className="chat-messages">
            {chatHistory.map((msg, index) => (
              <div key={index} className={`chat-message ${msg.role}`}>
                <div className="message-avatar">
                  {msg.role === "user" ? "👤" : "🤖"}
                </div>
                <div className="message-content">
                  {msg.content.split('\n').map((line, i) => {
                    // Format markdown-like content
                    let formattedLine = line;
                    // Bold text **text**
                    formattedLine = formattedLine.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                    // Lists
                    if (line.startsWith('•') || line.startsWith('-') || line.startsWith('• ')) {
                      return <li key={i} dangerouslySetInnerHTML={{ __html: formattedLine }} />;
                    }
                    // Numbered lists
                    if (/^\d+\./.test(line)) {
                      return <li key={i} dangerouslySetInnerHTML={{ __html: formattedLine }} />;
                    }
                    // Regular paragraphs
                    if (formattedLine.trim()) {
                      return <p key={i} dangerouslySetInnerHTML={{ __html: formattedLine }} />;
                    }
                    return <br key={i} />;
                  })}
                  {msg.streaming && <span className="typing-indicator">...</span>}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Selected Topic Indicator */}
          {selectedTopic && chatHistory.length === 0 && (
            <div className="selected-topic-indicator">
              <span>{selectedTopic.icon} {selectedTopic.title}</span>
              <button onClick={() => setSelectedTopic(null)}>×</button>
            </div>
          )}

          {/* Chat Input */}
          <form className="chat-input-form" onSubmit={handleChat}>
            <div className="chat-input-wrapper">
              <input
                type="text"
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                placeholder={selectedTopic ? "Tekan enter untuk kirim..." : "Tanya tentang keuangan Anda..."}
                disabled={chatLoading}
              />
              {chatHistory.length > 0 && (
                <button type="button" className="clear-chat-btn" onClick={clearChat}>
                  🗑️
                </button>
              )}
            </div>
            <button type="submit" disabled={chatLoading || !chatMessage.trim()}>
              {chatLoading ? "⏳" : "➤"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default AIAdvisor;
