// AI Financial Advisor - Dashboard + Chat Split

import { useState, useEffect, useRef } from "react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

const AIAdvisor = () => {
  const { isAuthenticated } = useAuth();
  const [advice, setAdvice] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [activeTopic, setActiveTopic] = useState("free");
  const messagesEndRef = useRef(null);

  const topics = [
    { id: "news", icon: "📰", name: "Berita", color: "#e3f2fd" },
    { id: "future", icon: "🎯", name: "Proyeksi", color: "#e8f5e9" },
    { id: "balance", icon: "⚖️", name: "Balance", color: "#fff3e0" },
    { id: "debt", icon: "💳", name: "Utang", color: "#ffebee" },
    { id: "invest", icon: "📈", name: "Investasi", color: "#f3e5f5" },
    { id: "budget", icon: "📊", name: "Budgeting", color: "#e0f7fa" },
    { id: "free", icon: "💬", name: "Bebas", color: "#f5f5f5" }
  ];

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [adviceRes, summaryRes] = await Promise.all([
        api.ai.advice(),
        api.ai.summary()
      ]);
      setAdvice(Array.isArray(adviceRes) ? adviceRes : []);
      setSummary(summaryRes);
    } catch (err) {
      console.error("Error:", err);
      setError("Gagal memuat data");
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!message.trim() || sending) return;

    const userMsg = message;
    setMessage("");
    setSending(true);

    setMessages(prev => [...prev, { role: "user", content: userMsg }]);

    try {
      const response = await api.ai.chat({ message: userMsg, topic: activeTopic });
      setMessages(prev => [...prev, { role: "assistant", content: response.response || response }]);
    } catch (err) {
      console.error("Chat error:", err);
      setMessages(prev => [...prev, { role: "assistant", content: "Maaf, terjadi kesalahan." }]);
    } finally {
      setSending(false);
    }
  };

  const selectTopic = (topicId) => {
    setActiveTopic(topicId);
    if (topicId !== "free") {
      const topic = topics.find(t => t.id === topicId);
      setMessage(topic?.name + ": ");
    }
  };

  const getPriorityColor = (priority) => {
    switch(priority) {
      case "high": return "#e74c3c";
      case "medium": return "#f39c12";
      default: return "#27ae60";
    }
  };

  if (loading) {
    return (
      <div className="page">
        <div style={{ textAlign: "center", padding: "3rem" }}>
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      {/* Header */}
      <div style={{ 
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        borderRadius: "16px",
        padding: "1.5rem",
        marginBottom: "1rem",
        color: "white"
      }}>
        <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>AI Financial Advisor</h1>
        <p style={{ opacity: 0.9, fontSize: "0.9rem" }}>Analisis & insights keuangan berbasis AI</p>
      </div>

      {/* Summary Cards - Page 1 */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1.1rem", marginBottom: "0.75rem", color: "#333" }}>
          📊 Ringkasan Keuangan
        </h2>
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", 
          gap: "0.75rem" 
        }}>
          <div style={{ 
            background: "white", 
            borderRadius: "12px", 
            padding: "1rem",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            borderLeft: "4px solid #4caf50"
          }}>
            <div style={{ fontSize: "0.75rem", color: "#666", marginBottom: "0.25rem" }}>💵 Total Saldo</div>
            <div style={{ fontSize: "1.25rem", fontWeight: "bold", color: "#333" }}>
              {summary?.formatted_balance || `Rp ${(summary?.total_balance || 0).toLocaleString('id-ID')}`}
            </div>
          </div>
          
          <div style={{ 
            background: "white", 
            borderRadius: "12px", 
            padding: "1rem",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            borderLeft: "4px solid #2196f3"
          }}>
            <div style={{ fontSize: "0.75rem", color: "#666", marginBottom: "0.25rem" }}>📈 Tabungan/Bulan</div>
            <div style={{ fontSize: "1.25rem", fontWeight: "bold", color: "#333" }}>
              {summary?.savings_rate?.toFixed(1) || 0}%
            </div>
          </div>
          
          <div style={{ 
            background: "white", 
            borderRadius: "12px", 
            padding: "1rem",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            borderLeft: "4px solid #ff9800"
          }}>
            <div style={{ fontSize: "0.75rem", color: "#666", marginBottom: "0.25rem" }}>🎯 Tujuan Aktif</div>
            <div style={{ fontSize: "1.25rem", fontWeight: "bold", color: "#333" }}>
              {summary?.active_goals || 0}
            </div>
          </div>
          
          <div style={{ 
            background: "white", 
            borderRadius: "12px", 
            padding: "1rem",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            borderLeft: "4px solid #e91e63"
          }}>
            <div style={{ fontSize: "0.75rem", color: "#666", marginBottom: "0.25rem" }}>💳 Total Utang</div>
            <div style={{ fontSize: "1.25rem", fontWeight: "bold", color: "#333" }}>
              Rp {(summary?.total_debt || 0).toLocaleString('id-ID')}
            </div>
          </div>
        </div>
      </div>

      {/* AI Advice - Page 1 */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1.1rem", marginBottom: "0.75rem", color: "#333" }}>
          💡 Saran AI
        </h2>
        {advice.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {advice.map((item, i) => (
              <div key={i} style={{ 
                background: "white", 
                borderRadius: "12px", 
                padding: "1rem",
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                borderLeft: `4px solid ${getPriorityColor(item.priority)}`
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                  <div style={{ fontWeight: "600", color: "#333" }}>{item.title}</div>
                  <span style={{ 
                    fontSize: "0.7rem", 
                    padding: "0.25rem 0.5rem",
                    borderRadius: "12px",
                    background: getPriorityColor(item.priority) + "20",
                    color: getPriorityColor(item.priority)
                  }}>
                    {item.priority === "high" ? "Prioritas Tinggi" : item.priority === "medium" ? "Sedang" : "Rendah"}
                  </span>
                </div>
                <p style={{ fontSize: "0.9rem", color: "#666", margin: 0 }}>{item.description}</p>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ 
            background: "#f5f5f5", 
            borderRadius: "12px", 
            padding: "2rem", 
            textAlign: "center",
            color: "#999"
          }}>
            Belum ada saran. Tambahkan transaksi untuk analisis AI.
          </div>
        )}
      </div>

      {/* Topic Selection - Transition to Chat */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1.1rem", marginBottom: "0.75rem", color: "#333" }}>
          💬 Chat dengan AI
        </h2>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {topics.map(topic => (
            <button
              key={topic.id}
              onClick={() => selectTopic(topic.id)}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "20px",
                border: activeTopic === topic.id ? "2px solid #667eea" : "1px solid #ddd",
                background: activeTopic === topic.id ? topic.color : "white",
                cursor: "pointer",
                fontSize: "0.85rem",
                display: "flex",
                alignItems: "center",
                gap: "0.25rem"
              }}
            >
              <span>{topic.icon}</span>
              <span>{topic.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Chat Box - Page 2 */}
      <div style={{ 
        background: "white", 
        borderRadius: "16px", 
        boxShadow: "0 2px 12px rgba(0,0,0,0.1)",
        overflow: "hidden"
      }}>
        {/* Chat Header */}
        <div style={{ 
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          padding: "1rem",
          color: "white"
        }}>
          <div style={{ fontWeight: "600" }}>
            {topics.find(t => t.id === activeTopic)?.icon} AI Chat
          </div>
        </div>

        {/* Messages */}
        <div style={{ 
          padding: "1rem",
          minHeight: "250px",
          maxHeight: "350px",
          overflowY: "auto"
        }}>
          {messages.length === 0 ? (
            <div style={{ textAlign: "center", color: "#999", padding: "2rem" }}>
              <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>💬</div>
              <div>Pilih topik dan mulai percakapan</div>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div key={i} style={{ 
                display: "flex", 
                justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                marginBottom: "0.75rem"
              }}>
                <div style={{
                  maxWidth: "80%",
                  padding: "0.75rem 1rem",
                  borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                  background: msg.role === "user" ? "#667eea" : "#f0f0f0",
                  color: msg.role === "user" ? "#fff" : "#333",
                  fontSize: "0.9rem",
                  whiteSpace: "pre-wrap"
                }}>
                  {msg.content}
                </div>
              </div>
            ))
          )}
          {sending && (
            <div style={{ textAlign: "center", color: "#999", fontSize: "0.9rem" }}>
              AI sedang mengetik...
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form 
          onSubmit={sendMessage} 
          style={{ 
            display: "flex", 
            gap: "0.5rem", 
            padding: "1rem",
            borderTop: "1px solid #eee"
          }}
        >
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ketik pertanyaan..."
            disabled={sending}
            style={{
              flex: 1,
              padding: "0.75rem 1rem",
              border: "1px solid #ddd",
              borderRadius: "24px",
              fontSize: "0.95rem",
              outline: "none"
            }}
          />
          <button 
            type="submit" 
            disabled={sending || !message.trim()}
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              border: "none",
              background: sending ? "#ccc" : "#667eea",
              color: "white",
              fontSize: "1.2rem",
              cursor: sending ? "not-allowed" : "pointer"
            }}
          >
            {sending ? "..." : "➤"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AIAdvisor;
