// AI Financial Advisor - Simple Clean Version

import { useState, useEffect, useRef } from "react";
import api from "../services/api";

const AIAdvisor = () => {
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
    { id: "news", name: "📰 Berita", prompt: "Fokus pada berita dan tren ekonomi terkini di Indonesia." },
    { id: "future", name: "🎯 Proyeksi", prompt: "Perencanaan keuangan jangka panjang dan tujuan masa depan." },
    { id: "balance", name: "⚖️ Balance", prompt: "Seimbangkan keuangan dengan usia, karier, dan gaya hidup." },
    { id: "debt", name: "💳 Utang", prompt: "Strategi optimal untuk mengelola dan melunasi utang." },
    { id: "invest", name: "📈 Investasi", prompt: "Strategi investasi dan diversifikasi portofolio." },
    { id: "budget", name: "📊 Budgeting", prompt: "Teknik budgeting terbaik untuk kondisi Anda." },
    { id: "free", name: "💬 Bebas", prompt: "" }
  ];

  useEffect(() => {
    fetchData();
  }, []);

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

    // Add user message
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);

    try {
      const topic = topics.find(t => t.id === activeTopic);
      const topicContext = topic?.prompt || "";

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/ai/chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${localStorage.getItem("token")}`
          },
          body: JSON.stringify({ 
            message: topicContext ? `${topicContext}\n\n${userMsg}` : userMsg,
            topic: activeTopic
          })
        }
      );

      if (!response.ok) throw new Error("Request failed");

      const data = await response.json();
      const aiResponse = data.response || "Maaf, terjadi kesalahan.";

      setMessages(prev => [...prev, { role: "assistant", content: aiResponse }]);
    } catch (err) {
      console.error("Chat error:", err);
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: "Maaf, terjadi kesalahan. Silakan coba lagi." 
      }]);
    } finally {
      setSending(false);
    }
  };

  const selectTopic = (topicId) => {
    setActiveTopic(topicId);
    if (topicId !== "free") {
      const topic = topics.find(t => t.id === topicId);
      setMessage(topic?.prompt || "");
    }
  };

  if (loading) {
    return (
      <div className="page">
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <div className="spinner"></div>
          <p>Memuat...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page" style={{ padding: "1rem", maxWidth: "800px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>AI Advisor</h1>

      {error && (
        <div style={{ background: "#fee", padding: "0.75rem", borderRadius: "8px", marginBottom: "1rem" }}>
          {error} <button onClick={fetchData}>Refresh</button>
        </div>
      )}

      {/* Summary */}
      {summary && (
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(3, 1fr)", 
          gap: "0.75rem", 
          marginBottom: "1rem" 
        }}>
          <div style={{ background: "#f5f5f5", padding: "0.75rem", borderRadius: "8px", textAlign: "center" }}>
            <div style={{ fontSize: "0.75rem", color: "#666" }}>Saldo</div>
            <div style={{ fontWeight: "bold" }}>{summary.formatted_balance || `Rp ${(summary.total_balance || 0).toLocaleString('id-ID')}`}</div>
          </div>
          <div style={{ background: "#f5f5f5", padding: "0.75rem", borderRadius: "8px", textAlign: "center" }}>
            <div style={{ fontSize: "0.75rem", color: "#666" }}>Tabungan</div>
            <div style={{ fontWeight: "bold" }}>{summary.savings_rate?.toFixed(1) || 0}%</div>
          </div>
          <div style={{ background: "#f5f5f5", padding: "0.75rem", borderRadius: "8px", textAlign: "center" }}>
            <div style={{ fontSize: "0.75rem", color: "#666" }}>Tujuan</div>
            <div style={{ fontWeight: "bold" }}>{summary.active_goals || 0}</div>
          </div>
        </div>
      )}

      {/* Topic Pills */}
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
        {topics.map(topic => (
          <button
            key={topic.id}
            onClick={() => selectTopic(topic.id)}
            style={{
              padding: "0.5rem 0.75rem",
              borderRadius: "20px",
              border: activeTopic === topic.id ? "2px solid #007bff" : "1px solid #ddd",
              background: activeTopic === topic.id ? "#e7f3ff" : "#fff",
              cursor: "pointer",
              fontSize: "0.85rem"
            }}
          >
            {topic.name}
          </button>
        ))}
      </div>

      {/* Chat Messages */}
      <div style={{ 
        border: "1px solid #e0e0e0", 
        borderRadius: "12px", 
        padding: "1rem", 
        marginBottom: "1rem",
        minHeight: "300px",
        maxHeight: "calc(100vh - 350px)",
        overflowY: "auto"
      }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: "center", color: "#999", padding: "2rem" }}>
            Tanya tentang keuangan Anda
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} style={{ 
              display: "flex", 
              justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
              marginBottom: "1rem"
            }}>
              <div style={{
                maxWidth: "80%",
                padding: "0.75rem 1rem",
                borderRadius: msg.role === "user" ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
                background: msg.role === "user" ? "#007bff" : "#f0f0f0",
                color: msg.role === "user" ? "#fff" : "#333",
                whiteSpace: "pre-wrap"
              }}>
                {msg.content}
              </div>
            </div>
          ))
        )}
        {sending && (
          <div style={{ textAlign: "center", color: "#999" }}>
            AI sedang mengetik...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} style={{ display: "flex", gap: "0.5rem" }}>
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Tanya AI tentang keuangan..."
          disabled={sending}
          style={{
            flex: 1,
            padding: "0.75rem 1rem",
            border: "1px solid #ddd",
            borderRadius: "24px",
            fontSize: "1rem"
          }}
        />
        <button 
          type="submit" 
          disabled={sending || !message.trim()}
          style={{
            padding: "0.75rem 1.5rem",
            borderRadius: "24px",
            border: "none",
            background: sending ? "#ccc" : "#007bff",
            color: "#fff",
            fontWeight: "bold",
            cursor: sending ? "not-allowed" : "pointer"
          }}
        >
          {sending ? "..." : "Kirim"}
        </button>
      </form>
    </div>
  );
};

export default AIAdvisor;
